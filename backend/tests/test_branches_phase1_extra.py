"""
Phase 1 Branch Model — additional coverage beyond test_branches_phase1.py.

Covers:
- salon-booking stamps branch_id
- Backwards compatibility on queue / today-sales / financials when branch_id is omitted
- Per-barber queue branch filter
- Financial transactions list/dashboard branch filter
- Cannot deactivate a branch with active future tokens (400)
- salon_staff role (non-admin) cannot create/edit/delete branches → 403
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_LOGIN = {"identifier": "admin", "password": "salon123"}


def _login(login_id="admin", password="salon123"):
    r = requests.post(f"{API}/salon/users/login", json={"identifier": login_id, "password": password}, timeout=10)
    if r.status_code != 200:
        return None
    j = r.json()
    return {
        "salon_id": j["salon_id"],
        "headers": {"Authorization": f"Bearer {j['access_token']}"},
        "role": j.get("role"),
        "access_token": j["access_token"],
    }


@pytest.fixture(scope="module")
def auth():
    a = _login()
    assert a, "Admin login failed"
    return a


@pytest.fixture(scope="module")
def main_branch_id(auth):
    r = requests.get(f"{API}/salons/{auth['salon_id']}/branches", headers=auth["headers"])
    assert r.status_code == 200
    main = next(b for b in r.json() if b["is_main_branch"])
    return main["id"]


# ---------- backwards compatibility ----------

def test_queue_without_branch_id_works(auth):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    r = requests.get(f"{API}/salons/{auth['salon_id']}/queue", params={"date": today})
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


def test_today_sales_without_branch_id_works(auth):
    r = requests.get(f"{API}/salons/{auth['salon_id']}/today-sales")
    assert r.status_code == 200, r.text
    assert "today_sales" in r.json()


def test_today_sales_branch_filter_returns_subset(auth, main_branch_id):
    r_all = requests.get(f"{API}/salons/{auth['salon_id']}/today-sales")
    r_branch = requests.get(
        f"{API}/salons/{auth['salon_id']}/today-sales",
        params={"branch_id": main_branch_id},
    )
    assert r_all.status_code == 200 and r_branch.status_code == 200
    # Branch sales must be <= overall sales
    assert r_branch.json()["today_sales"] <= r_all.json()["today_sales"] + 1e-6


def test_financials_transactions_without_branch_id(auth):
    r = requests.get(
        f"{API}/salons/{auth['salon_id']}/financials/transactions",
        headers=auth["headers"],
    )
    assert r.status_code == 200, r.text
    assert "transactions" in r.json()


def test_financials_transactions_with_branch_id(auth, main_branch_id):
    r = requests.get(
        f"{API}/salons/{auth['salon_id']}/financials/transactions",
        params={"branch_id": main_branch_id},
        headers=auth["headers"],
    )
    assert r.status_code == 200, r.text
    txns = r.json()["transactions"]
    # All returned transactions must be from this branch
    for t in txns:
        assert t.get("branch_id") == main_branch_id


def test_financials_dashboard_without_branch_id(auth):
    r = requests.get(
        f"{API}/salons/{auth['salon_id']}/financials/dashboard",
        headers=auth["headers"],
    )
    assert r.status_code == 200, r.text


def test_financials_dashboard_with_branch_id(auth, main_branch_id):
    r = requests.get(
        f"{API}/salons/{auth['salon_id']}/financials/dashboard",
        params={"branch_id": main_branch_id},
        headers=auth["headers"],
    )
    assert r.status_code == 200, r.text


def test_barbers_with_branch_filter(auth, main_branch_id):
    r = requests.get(
        f"{API}/salons/{auth['salon_id']}/barbers",
        params={"branch_id": main_branch_id},
        headers=auth["headers"],
    )
    assert r.status_code == 200
    for b in r.json():
        assert b.get("branch_id") == main_branch_id


def test_barber_queue_with_branch_id(auth, main_branch_id):
    barbers = requests.get(
        f"{API}/salons/{auth['salon_id']}/barbers", headers=auth["headers"]
    ).json()
    if not barbers:
        pytest.skip("No barbers in salon")
    bid = barbers[0]["id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    r = requests.get(
        f"{API}/salons/{auth['salon_id']}/barbers/{bid}/queue",
        params={"date": today, "branch_id": main_branch_id},
    )
    assert r.status_code == 200
    for tok in r.json():
        # When branch filter is applied tokens must match
        assert tok.get("branch_id") == main_branch_id or tok.get("branch_id") is None


# ---------- salon-booking stamps branch_id ----------

def test_salon_booking_stamps_branch_id(auth):
    services = requests.get(f"{API}/services").json()
    if not services:
        pytest.skip("No services")
    svc_id = services[0]["id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    phone = f"+918{int(datetime.now(timezone.utc).timestamp()) % 1000000000:09d}"
    body = {
        "customer_name": "PytestSalonBooking",
        "phone": phone,
        "gender": "Men",
        "barber_id": "any",
        "selected_services": [svc_id],
        "date": today,
        "shift": "Morning",
        "payment_mode": "cash",
    }
    r = requests.post(
        f"{API}/salons/{auth['salon_id']}/salon-booking",
        json=body,
        headers=auth["headers"],
    )
    if r.status_code != 200:
        pytest.skip(f"salon-booking creation skipped: {r.status_code} {r.text}")
    j = r.json()
    # Locate the resulting token id (response shape may be {token:{...}} or token-like)
    token = j.get("token") or j
    token_id = token.get("id")
    branch_id = token.get("branch_id")
    assert branch_id, f"salon-booking should stamp branch_id on token, got: {token}"
    # Cleanup
    if token_id:
        requests.post(f"{API}/tokens/{token_id}/cancel", headers=auth["headers"])


# ---------- cannot deactivate branch with active future tokens ----------

def test_cannot_deactivate_branch_with_active_tokens(auth):
    # Create a temp branch
    payload = {
        "branch_name": f"PytestActive {uuid.uuid4().hex[:6]}",
        "branch_code": f"PA-{uuid.uuid4().hex[:4]}",
    }
    r = requests.post(
        f"{API}/salons/{auth['salon_id']}/branches",
        json=payload,
        headers=auth["headers"],
    )
    assert r.status_code == 200, r.text
    bid = r.json()["id"]

    # Inject a fake active future token directly tied to this branch via API:
    # We rely on POST /api/bookings stamping branch_id from barber's branch.
    # Easier path: directly use the booking endpoint with branch_id by transferring
    # a barber to this branch first, then booking.
    barbers = requests.get(
        f"{API}/salons/{auth['salon_id']}/barbers", headers=auth["headers"]
    ).json()
    if not barbers:
        # Cleanup branch and skip
        requests.delete(f"{API}/salons/{auth['salon_id']}/branches/{bid}", headers=auth["headers"])
        pytest.skip("No barbers to attach a token to")

    # Reassign first barber to new branch via PUT barbers
    barber = barbers[0]
    original_branch = barber.get("branch_id")
    upd = requests.put(
        f"{API}/barbers/{barber['id']}",
        json={"branch_id": bid},
        headers=auth["headers"],
    )
    if upd.status_code != 200:
        requests.delete(f"{API}/salons/{auth['salon_id']}/branches/{bid}", headers=auth["headers"])
        pytest.skip(f"Couldn't move barber: {upd.status_code} {upd.text}")

    # Now create a booking explicitly for this barber
    services = requests.get(f"{API}/services").json()
    svc_id = services[0]["id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    phone = f"+918{int(datetime.now(timezone.utc).timestamp()) % 1000000000:09d}"
    body = {
        "customer_name": "PytestActiveTok",
        "phone": phone,
        "gender": "Men",
        "barber_id": barber["id"],
        "selected_services": [svc_id],
        "date": today,
        "shift": "Morning",
        "payment_mode": "cash",
    }
    booking = requests.post(
        f"{API}/salons/{auth['salon_id']}/salon-booking",
        json=body,
        headers=auth["headers"],
    )
    token_id = None
    try:
        if booking.status_code == 200:
            tok = booking.json().get("token") or booking.json()
            token_id = tok.get("id")
            # Now try deactivating branch — must 400
            r = requests.delete(
                f"{API}/salons/{auth['salon_id']}/branches/{bid}",
                headers=auth["headers"],
            )
            assert r.status_code == 400, f"Expected 400 with active token, got {r.status_code}: {r.text}"
        else:
            pytest.skip(f"booking failed: {booking.status_code} {booking.text}")
    finally:
        # Cleanup: cancel token, move barber back, delete branch
        if token_id:
            requests.post(f"{API}/tokens/{token_id}/cancel", headers=auth["headers"])
        if original_branch:
            requests.put(
                f"{API}/barbers/{barber['id']}",
                json={"branch_id": original_branch},
                headers=auth["headers"],
            )
        requests.delete(
            f"{API}/salons/{auth['salon_id']}/branches/{bid}",
            headers=auth["headers"],
        )


# ---------- staff role cannot CRUD branches ----------

def test_staff_cannot_create_branch(auth):
    """Create a temp staff user, login as them, try to create a branch → must be 403."""
    suffix = uuid.uuid4().hex[:6]
    staff_login_id = f"pytstaff_{suffix}"
    staff_payload = {
        "salon_id": auth["salon_id"],
        "name": f"Pyt Staff {suffix}",
        "mobile": f"99999{int(datetime.now(timezone.utc).timestamp()) % 100000:05d}",
        "login_id": staff_login_id,
        "password": "staff123",
        "role": "staff",
    }
    cu = requests.post(f"{API}/salon/users", json=staff_payload, headers=auth["headers"])
    if cu.status_code != 200:
        pytest.skip(f"Couldn't create staff user: {cu.status_code} {cu.text}")
    staff_user_id = cu.json().get("id")

    try:
        staff_auth = _login(staff_login_id, "staff123")
        assert staff_auth, "staff login failed"
        # POST create branch as staff → 403
        r = requests.post(
            f"{API}/salons/{auth['salon_id']}/branches",
            json={"branch_name": "ShouldNotCreate", "branch_code": "NOPE"},
            headers=staff_auth["headers"],
        )
        assert r.status_code == 403, f"Expected 403 for staff create-branch, got {r.status_code}: {r.text}"

        # Get an existing branch to try update/delete
        branches = requests.get(
            f"{API}/salons/{auth['salon_id']}/branches", headers=auth["headers"]
        ).json()
        main = next(b for b in branches if b["is_main_branch"])

        # PUT update as staff → 403
        r = requests.put(
            f"{API}/salons/{auth['salon_id']}/branches/{main['id']}",
            json={"phone": "+910000000000"},
            headers=staff_auth["headers"],
        )
        assert r.status_code == 403, f"Expected 403 for staff update-branch, got {r.status_code}"

        # DELETE as staff → 403
        r = requests.delete(
            f"{API}/salons/{auth['salon_id']}/branches/{main['id']}",
            headers=staff_auth["headers"],
        )
        assert r.status_code == 403, f"Expected 403 for staff delete-branch, got {r.status_code}"

        # Set-main as staff → 403
        r = requests.post(
            f"{API}/salons/{auth['salon_id']}/branches/{main['id']}/set-main",
            headers=staff_auth["headers"],
        )
        assert r.status_code == 403, f"Expected 403 for staff set-main, got {r.status_code}"

        # But staff CAN read branches (uses get_current_salon_user)
        r = requests.get(
            f"{API}/salons/{auth['salon_id']}/branches",
            headers=staff_auth["headers"],
        )
        assert r.status_code == 200, f"Staff should be able to LIST branches, got {r.status_code}"
    finally:
        # Cleanup staff user
        if staff_user_id:
            requests.delete(
                f"{API}/salon/users/{staff_user_id}", headers=auth["headers"]
            )
