"""Backend tests for Phase 2 Incentive Dashboard endpoints (with manual_amount).

Covers the new behavior:
- Approve persists manual_amount; does NOT create a financial txn
- Paid creates ONE financial txn for effective_amount = manual_amount or auto
- Strict idempotency on re-Paid (also when linked_expense_id is null)
- Pay without override uses auto incentive_earned
- Pay with override but earned=0 still creates one txn for the override
- Negative manual_amount returns 400

The test seeds a single completed token (_user_test=true) so the auto
incentive_earned > 0, then cleans it up at the end.
"""

import os
import asyncio
import uuid
import pytest
import requests
from datetime import datetime, timezone

# Backend env (Mongo) ----------------------------------------------------------
import sys
sys.path.insert(0, "/app/backend")
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
SALON_ID = os.environ.get("TEST_SALON_ID", "2dad5cd9-5dda-4398-bbb5-a4d12aae7915")
PHONE = os.environ.get("TEST_SALON_PHONE", "+917503070727")
PASSWORD = os.environ.get("TEST_SALON_PASSWORD", "salon123")
BARBER_ID = os.environ.get("TEST_BARBER_ID", "5d7d3064-2580-4a43-ae3e-73cdcaefd9de")  # Imran
SEED_AMOUNT = 41250  # ach=110% (assuming salary=37500); within 100-120% slab → earned > 0
MONTH = datetime.now(timezone.utc).strftime("%Y-%m")
BOOKING_DATE = f"{MONTH}-15"

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "test_database")


# --------------------------------------------------------------- shared fixtures
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


@pytest.fixture(scope="module", autouse=True)
def seed_token_and_cleanup():
    """Seed ONE completed token for Imran so incentive_earned > 0; cleanup after."""

    async def _setup():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        # Wipe any prior _user_test tokens & financial txns + reset payouts
        await db.tokens.delete_many({"_user_test": True})
        await db.financial_transactions.delete_many(
            {"salon_id": SALON_ID, "reference_type": "incentive_payout"}
        )
        await db.incentive_payouts.update_many(
            {"salon_id": SALON_ID, "month": MONTH},
            {"$set": {"status": "Pending", "manual_amount": None,
                      "linked_expense_id": None, "payment_method": None,
                      "paid_at": None}},
        )
        # Insert a completed token
        token_doc = {
            "id": str(uuid.uuid4()),
            "_user_test": True,
            "salon_id": SALON_ID,
            "barber_id": BARBER_ID,
            "barber_name": "Imran",
            "customer_name": "USER_TEST",
            "customer_phone": "+910000000001",
            "services": [{"id": "s1", "name": "Haircut", "price": SEED_AMOUNT}],
            "total_amount": SEED_AMOUNT,
            "status": "completed",
            "payment_status": "paid",
            "payment_mode": "cash",
            "date": BOOKING_DATE,
            "booking_date": BOOKING_DATE,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.tokens.insert_one(token_doc)
        client.close()

    async def _teardown():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        await db.tokens.delete_many({"_user_test": True})
        await db.financial_transactions.delete_many(
            {"salon_id": SALON_ID, "reference_type": "incentive_payout"}
        )
        await db.incentive_payouts.update_many(
            {"salon_id": SALON_ID, "month": MONTH},
            {"$set": {"status": "Pending", "manual_amount": None,
                      "linked_expense_id": None, "payment_method": None,
                      "paid_at": None}},
        )
        client.close()

    asyncio.get_event_loop().run_until_complete(_setup())
    yield
    asyncio.get_event_loop().run_until_complete(_teardown())


def _list_incentives(headers):
    r = requests.get(
        f"{BASE_URL}/api/salons/{SALON_ID}/reward-plan/incentives",
        params={"month": MONTH}, headers=headers, timeout=30,
    )
    assert r.status_code == 200, r.text
    return r.json().get("incentives", [])


def _row_for_imran(headers):
    rows = _list_incentives(headers)
    return next((x for x in rows if x["barber_id"] == BARBER_ID), None)


def _list_txns(headers):
    r = requests.get(
        f"{BASE_URL}/api/salons/{SALON_ID}/financials/transactions",
        params={"month": MONTH}, headers=headers, timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    return body if isinstance(body, list) else (body.get("transactions") or body.get("data") or [])


def _put_status(headers, body):
    return requests.put(
        f"{BASE_URL}/api/salons/{SALON_ID}/reward-plan/incentives/{BARBER_ID}/{MONTH}/status",
        json=body, headers=headers, timeout=30,
    )


# ------------------------------------------------------------------- basic GETs
def test_eligible_barbers(auth_headers):
    r = requests.get(
        f"{BASE_URL}/api/salons/{SALON_ID}/reward-plan/eligible-barbers",
        headers=auth_headers, timeout=30,
    )
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data.get("barbers"), list)
    for b in data["barbers"]:
        assert "_id" not in b


def test_list_incentives_has_manual_amount_field(auth_headers):
    rows = _list_incentives(auth_headers)
    assert rows, "Expected at least one incentive row after seeding"
    row = next(x for x in rows if x["barber_id"] == BARBER_ID)
    assert "_id" not in row
    assert "manual_amount" in row, "list_incentives must expose manual_amount"
    assert row["manual_amount"] is None
    # earned is positive thanks to seed
    assert float(row.get("incentive_earned") or 0) > 0


def test_negative_manual_amount_rejected(auth_headers):
    r = _put_status(auth_headers, {"status": "Approved", "manual_amount": -1})
    assert r.status_code == 400, r.text


# ------------------------------------------------------------- Approve flow
def test_approve_persists_manual_amount_no_financial_txn(auth_headers):
    # Sanity: zero existing incentive txns
    txns_before = [t for t in _list_txns(auth_headers)
                   if t.get("reference_type") == "incentive_payout"]
    assert len(txns_before) == 0

    r = _put_status(auth_headers, {"status": "Approved", "manual_amount": 5000})
    assert r.status_code == 200, r.text
    payout = r.json().get("payout") or {}
    assert payout.get("status") == "Approved"
    assert float(payout.get("manual_amount")) == 5000.0
    assert not payout.get("linked_expense_id")

    # No financial txn should exist after Approve
    txns_after = [t for t in _list_txns(auth_headers)
                  if t.get("reference_type") == "incentive_payout"]
    assert len(txns_after) == 0, f"Approve must NOT create a financial txn: {txns_after}"

    # Persisted via GET
    row = _row_for_imran(auth_headers)
    assert row["status"] == "Approved"
    assert float(row["manual_amount"]) == 5000.0


# ------------------------------------------------------------- Paid w/ override
def test_paid_with_override_creates_single_txn_for_manual(auth_headers):
    r = _put_status(auth_headers, {"status": "Paid", "payment_method": "upi"})
    assert r.status_code == 200, r.text
    payout = r.json().get("payout") or {}
    assert payout.get("status") == "Paid"
    assert payout.get("payment_method") == "upi"
    assert payout.get("linked_expense_id")
    expense_id = payout["linked_expense_id"]

    txns = [t for t in _list_txns(auth_headers)
            if t.get("reference_type") == "incentive_payout"
            and t.get("reference_id") == payout.get("id")]
    assert len(txns) == 1, f"Expected exactly ONE txn, got {len(txns)}"
    txn = txns[0]
    assert txn["id"] == expense_id
    assert txn["type"] == "outflow"
    assert txn["category"] == "staff_incentive"
    assert txn["payment_mode"] == "upi"
    # Should equal MANUAL override (5000), not the auto incentive_earned
    assert abs(float(txn["amount"]) - 5000.0) < 0.01, (
        f"txn amount {txn['amount']} != manual override 5000"
    )


# ------------------------------------------------------------- Idempotency
def test_paid_again_no_duplicate(auth_headers):
    pay1 = _put_status(auth_headers, {"status": "Paid", "payment_method": "upi"})
    expense_id_1 = (pay1.json().get("payout") or {}).get("linked_expense_id")
    pay2 = _put_status(auth_headers, {"status": "Paid", "payment_method": "upi"})
    assert pay2.status_code == 200
    expense_id_2 = (pay2.json().get("payout") or {}).get("linked_expense_id")
    assert expense_id_1 and expense_id_1 == expense_id_2

    txns = [t for t in _list_txns(auth_headers)
            if t.get("reference_type") == "incentive_payout"]
    assert len(txns) == 1, f"Duplicate financial txns on re-Paid: {len(txns)}"


def test_paid_idempotency_when_linked_expense_id_null(auth_headers):
    """Even if linked_expense_id is wiped, backend reuses txn via reference_id."""

    async def _wipe_link():
        client = AsyncIOMotorClient(MONGO_URL)
        await client[DB_NAME].incentive_payouts.update_one(
            {"salon_id": SALON_ID, "barber_id": BARBER_ID, "month": MONTH},
            {"$set": {"linked_expense_id": None}},
        )
        client.close()

    asyncio.get_event_loop().run_until_complete(_wipe_link())

    r = _put_status(auth_headers, {"status": "Paid", "payment_method": "upi"})
    assert r.status_code == 200
    payout = r.json().get("payout") or {}
    assert payout.get("linked_expense_id"), "Backend must re-link the existing txn"

    txns = [t for t in _list_txns(auth_headers)
            if t.get("reference_type") == "incentive_payout"]
    assert len(txns) == 1, f"Lookup-by-reference idempotency failed: {len(txns)} txns"


# -------------------------------------------- Pay without override (auto path)
def test_pay_without_override_uses_auto(auth_headers):
    # Reset to Pending and clear manual_amount + financials
    async def _reset():
        client = AsyncIOMotorClient(MONGO_URL)
        await client[DB_NAME].financial_transactions.delete_many(
            {"salon_id": SALON_ID, "reference_type": "incentive_payout"}
        )
        await client[DB_NAME].incentive_payouts.update_one(
            {"salon_id": SALON_ID, "barber_id": BARBER_ID, "month": MONTH},
            {"$set": {"status": "Pending", "manual_amount": None,
                      "linked_expense_id": None, "payment_method": None,
                      "paid_at": None}},
        )
        client.close()

    asyncio.get_event_loop().run_until_complete(_reset())

    row = _row_for_imran(auth_headers)
    auto_earned = float(row["incentive_earned"])
    assert auto_earned > 0

    r = _put_status(auth_headers, {"status": "Paid", "payment_method": "cash"})
    assert r.status_code == 200, r.text

    txns = [t for t in _list_txns(auth_headers)
            if t.get("reference_type") == "incentive_payout"]
    assert len(txns) == 1
    assert abs(float(txns[0]["amount"]) - auto_earned) < 0.01
    assert txns[0]["payment_mode"] == "cash"


# ----------------------------- Pay override when auto earned=0 (different barber)
def test_pay_override_when_auto_zero(auth_headers):
    """Find a barber with incentive_earned=0; admin sets manual_amount=200 then Paid → 1 txn."""
    rows = _list_incentives(auth_headers)
    target = next(
        (x for x in rows
         if (x.get("incentive_earned") or 0) == 0
         and x["barber_id"] != BARBER_ID
         and x.get("status") != "Paid"),
        None,
    )
    if not target:
        pytest.skip("No zero-earned barber to exercise override-with-zero-auto path")

    other_bid = target["barber_id"]

    # Approve with manual_amount=200, then Paid
    r1 = requests.put(
        f"{BASE_URL}/api/salons/{SALON_ID}/reward-plan/incentives/{other_bid}/{MONTH}/status",
        json={"status": "Approved", "manual_amount": 200}, headers=auth_headers, timeout=30,
    )
    assert r1.status_code == 200, r1.text

    r2 = requests.put(
        f"{BASE_URL}/api/salons/{SALON_ID}/reward-plan/incentives/{other_bid}/{MONTH}/status",
        json={"status": "Paid", "payment_method": "cash"}, headers=auth_headers, timeout=30,
    )
    assert r2.status_code == 200, r2.text
    payout = r2.json().get("payout") or {}
    assert payout.get("linked_expense_id")

    txns = [t for t in _list_txns(auth_headers)
            if t.get("reference_type") == "incentive_payout"
            and t.get("reference_id") == payout.get("id")]
    assert len(txns) == 1
    assert abs(float(txns[0]["amount"]) - 200.0) < 0.01


# --------------------------------------------------------- payment_method gate
def test_paid_requires_payment_method(auth_headers):
    rows = _list_incentives(auth_headers)
    target = next((x for x in rows
                   if (x.get("incentive_earned") or 0) > 0 and x.get("status") != "Paid"),
                  None)
    if not target:
        pytest.skip("No unpaid earning row to test missing payment_method")
    bid = target["barber_id"]
    r = requests.put(
        f"{BASE_URL}/api/salons/{SALON_ID}/reward-plan/incentives/{bid}/{MONTH}/status",
        json={"status": "Paid"}, headers=auth_headers, timeout=30,
    )
    assert r.status_code == 400


def test_invalid_status(auth_headers):
    r = _put_status(auth_headers, {"status": "Bogus"})
    assert r.status_code == 400
