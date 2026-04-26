"""Backend tests for Phase 2 Incentive Dashboard endpoints."""
import os
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
SALON_ID = "2dad5cd9-5dda-4398-bbb5-a4d12aae7915"
PHONE = "+917503070727"
PASSWORD = "salon123"


@pytest.fixture(scope="module")
def auth_headers():
    r = requests.post(
        f"{BASE_URL}/api/salon/password-login",
        json={"phone": PHONE, "password": PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token")
    assert token
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_eligible_barbers_endpoint(auth_headers):
    r = requests.get(
        f"{BASE_URL}/api/salons/{SALON_ID}/reward-plan/eligible-barbers",
        headers=auth_headers,
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert "barbers" in data
    assert isinstance(data["barbers"], list)
    # All listed barbers must be is_barber True (per backend filter)
    for b in data["barbers"]:
        assert b.get("is_barber", True) is True
        assert "_id" not in b
        assert "id" in b
        assert "name" in b


def test_list_incentives_current_month(auth_headers):
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    r = requests.get(
        f"{BASE_URL}/api/salons/{SALON_ID}/reward-plan/incentives",
        params={"month": month},
        headers=auth_headers,
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("month") == month
    assert "incentives" in data
    assert isinstance(data["incentives"], list)
    for row in data["incentives"]:
        assert "_id" not in row
        for k in ("barber_id", "month", "status"):
            assert k in row, f"missing {k} in {row}"


def test_update_status_invalid_status(auth_headers):
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    # Use a definitely-fake barber to trigger 400 first (bad status), 404 if status was valid
    r = requests.put(
        f"{BASE_URL}/api/salons/{SALON_ID}/reward-plan/incentives/fakeid/{month}/status",
        json={"status": "Bogus"},
        headers=auth_headers,
        timeout=30,
    )
    assert r.status_code == 400


def test_update_paid_requires_payment_method(auth_headers):
    """Find a barber with incentive_earned > 0; if none, skip."""
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    r = requests.get(
        f"{BASE_URL}/api/salons/{SALON_ID}/reward-plan/incentives",
        params={"month": month},
        headers=auth_headers,
        timeout=30,
    )
    assert r.status_code == 200
    rows = r.json().get("incentives", [])
    target = next((x for x in rows if (x.get("incentive_earned") or 0) > 0), None)
    if not target:
        pytest.skip("No incentive-earning row to test Paid path")
    bid = target["barber_id"]
    # Missing payment_method should 400
    r2 = requests.put(
        f"{BASE_URL}/api/salons/{SALON_ID}/reward-plan/incentives/{bid}/{month}/status",
        json={"status": "Paid"},
        headers=auth_headers,
        timeout=30,
    )
    assert r2.status_code == 400, r2.text


def test_paid_creates_financial_transaction_and_links(auth_headers):
    """End-to-end: mark Paid → financial txn created → list_incentives returns linked_expense_id."""
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    r = requests.get(
        f"{BASE_URL}/api/salons/{SALON_ID}/reward-plan/incentives",
        params={"month": month},
        headers=auth_headers,
        timeout=30,
    )
    rows = r.json().get("incentives", [])
    target = next(
        (x for x in rows if (x.get("incentive_earned") or 0) > 0 and x.get("status") != "Paid"),
        None,
    )
    if not target:
        pytest.skip("No unpaid earning row to mark Paid")
    bid = target["barber_id"]
    amount = float(target["incentive_earned"])

    # Mark Paid via UPI
    r2 = requests.put(
        f"{BASE_URL}/api/salons/{SALON_ID}/reward-plan/incentives/{bid}/{month}/status",
        json={"status": "Paid", "payment_method": "upi"},
        headers=auth_headers,
        timeout=30,
    )
    assert r2.status_code == 200, r2.text
    payout = r2.json().get("payout") or {}
    assert payout.get("status") == "Paid"
    assert payout.get("payment_method") == "upi"
    assert payout.get("linked_expense_id"), "Missing linked_expense_id on Paid payout"

    expense_id = payout["linked_expense_id"]

    # Re-fetch to confirm persistence
    r3 = requests.get(
        f"{BASE_URL}/api/salons/{SALON_ID}/reward-plan/incentives",
        params={"month": month},
        headers=auth_headers,
        timeout=30,
    )
    rows3 = r3.json().get("incentives", [])
    persisted = next((x for x in rows3 if x["barber_id"] == bid and x["month"] == month), None)
    assert persisted is not None
    assert persisted.get("status") == "Paid"
    assert persisted.get("payment_method") == "upi"
    assert persisted.get("linked_expense_id") == expense_id

    # Verify financial transaction exists with expected fields
    r4 = requests.get(
        f"{BASE_URL}/api/salons/{SALON_ID}/financials/transactions",
        params={"month": month},
        headers=auth_headers,
        timeout=30,
    )
    assert r4.status_code == 200, r4.text
    txns = r4.json()
    if isinstance(txns, dict):
        txns = txns.get("transactions") or txns.get("data") or []
    matching = [
        t for t in txns
        if t.get("id") == expense_id
        or (t.get("reference_id") == payout.get("id") and t.get("reference_type") == "incentive_payout")
    ]
    assert matching, f"No financial txn found for expense_id={expense_id}"
    txn = matching[0]
    assert txn.get("type") == "outflow"
    assert txn.get("category") == "staff_incentive"
    assert abs(float(txn.get("amount", 0)) - amount) < 0.01
    assert txn.get("payment_mode") == "upi"

    # Idempotency: marking Paid again should NOT create a duplicate
    r5 = requests.put(
        f"{BASE_URL}/api/salons/{SALON_ID}/reward-plan/incentives/{bid}/{month}/status",
        json={"status": "Paid", "payment_method": "upi"},
        headers=auth_headers,
        timeout=30,
    )
    assert r5.status_code == 200
    payout5 = r5.json().get("payout") or {}
    assert payout5.get("linked_expense_id") == expense_id, "Duplicate expense created on re-Paid"
