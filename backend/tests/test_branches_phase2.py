"""
Phase 2 Branch Model tests:
- branch_manager role in salon_users + assigned_branch_ids.
- Login returns assigned_branch_ids in SalonUserToken.
- Mobile-number login for salon_users works alongside login_id.
- RBAC scoping: branch manager sees only their assigned branches + only their scoped data
  on queue / today-sales / financials / customers / barbers.
- Staff transfer endpoints:
  - POST /api/salons/{salon_id}/staff-branch-transfers moves the barber.
  - GET  /api/salons/{salon_id}/staff-branch-transfers returns history.
  - Branch-manager may transfer only within their assigned branches.
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_LOGIN = {
    "identifier": os.environ.get("TEST_SALON_IDENTIFIER", "admin"),
    "password": os.environ.get("TEST_SALON_PASSWORD", "salon123"),
}


def _admin_auth():
    r = requests.post(f"{API}/salon/users/login", json=ADMIN_LOGIN, timeout=10)
    assert r.status_code == 200, r.text
    j = r.json()
    return {
        "salon_id": j["salon_id"],
        "user_id": j["user_id"],
        "headers": {"Authorization": f"Bearer {j['access_token']}"},
    }


@pytest.fixture(scope="module")
def admin():
    return _admin_auth()


@pytest.fixture(scope="module")
def branches(admin):
    """Return Main Branch + create a second "BM-Test" branch so we have 2 to work with."""
    r = requests.get(f"{API}/salons/{admin['salon_id']}/branches", headers=admin["headers"])
    assert r.status_code == 200
    existing = r.json()
    main = next(b for b in existing if b["is_main_branch"])

    # Find-or-create a second branch
    extra = next((b for b in existing if b["branch_code"] == "BM-TEST"), None)
    if not extra:
        r = requests.post(
            f"{API}/salons/{admin['salon_id']}/branches",
            json={
                "branch_name": "BM Test Branch",
                "branch_code": "BM-TEST",
                "city": "Bangalore",
                "phone": "+919999000111",
            },
            headers=admin["headers"],
        )
        assert r.status_code == 200, r.text
        extra = r.json()

    yield {"main_id": main["id"], "extra_id": extra["id"]}


def _unique_login_id(prefix="bm"):
    return f"{prefix}-{uuid.uuid4().hex[:6]}"


def _unique_mobile():
    return f"+918{int(datetime.now(timezone.utc).timestamp() * 1000) % 1000000000:09d}"


@pytest.fixture
def branch_manager(admin, branches):
    """Create a branch_manager user restricted to Main branch, yield login info, and cleanup."""
    login_id = _unique_login_id("bm")
    mobile = _unique_mobile()
    password = os.environ.get("TEST_BRANCH_MANAGER_PASSWORD", "bmpass123")

    r = requests.post(
        f"{API}/salon/users",
        json={
            "salon_id": admin["salon_id"],
            "name": "Branch Mgr Test",
            "mobile": mobile,
            "login_id": login_id,
            "password": password,
            "role": "branch_manager",
            "assigned_branch_ids": [branches["main_id"]],
        },
        headers=admin["headers"],
    )
    assert r.status_code == 200, r.text
    user = r.json()
    assert user["role"] == "branch_manager"
    assert user["assigned_branch_ids"] == [branches["main_id"]]

    # Login
    r = requests.post(f"{API}/salon/users/login", json={"identifier": login_id, "password": password})
    assert r.status_code == 200, r.text
    tok = r.json()
    assert tok["role"] == "branch_manager"
    assert tok["assigned_branch_ids"] == [branches["main_id"]]

    info = {
        "user_id": user["id"],
        "login_id": login_id,
        "mobile": mobile,
        "password": password,
        "token": tok["access_token"],
        "headers": {"Authorization": f"Bearer {tok['access_token']}"},
    }
    yield info

    # Cleanup — deactivate user
    requests.delete(f"{API}/salon/users/{user['id']}", headers=admin["headers"])


def test_login_returns_assigned_branch_ids(admin, branches, branch_manager):
    # The fixture already asserted the token contents. Re-verify one more time
    # by logging in via mobile (Phase 2 requirement: mobile-number login works).
    r = requests.post(
        f"{API}/salon/users/login",
        json={"identifier": branch_manager["mobile"], "password": branch_manager["password"]},
    )
    assert r.status_code == 200, r.text
    tok = r.json()
    assert tok["role"] == "branch_manager"
    assert branches["main_id"] in tok["assigned_branch_ids"]


def test_branch_manager_list_branches_is_scoped(branches, branch_manager):
    r = requests.get(
        f"{API}/salons/{_admin_auth()['salon_id']}/branches",
        headers=branch_manager["headers"],
    )
    assert r.status_code == 200
    ids = [b["id"] for b in r.json()]
    assert ids == [branches["main_id"]], f"Manager must see only assigned branches; got {ids}"


def test_branch_manager_cannot_create_branch(admin, branch_manager):
    r = requests.post(
        f"{API}/salons/{admin['salon_id']}/branches",
        json={"branch_name": "Manager-shouldnt-create"},
        headers=branch_manager["headers"],
    )
    assert r.status_code == 403


def test_branch_manager_queue_auto_scopes_to_assigned(admin, branches, branch_manager):
    # Admin sees all branches; manager without branch_id should be scoped to assigned[0]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    r = requests.get(
        f"{API}/salons/{admin['salon_id']}/queue",
        params={"date": today},
        headers=branch_manager["headers"],
    )
    assert r.status_code == 200
    for tok in r.json():
        # Any token returned must match the manager's assigned branch
        assert tok.get("branch_id") == branches["main_id"]


def test_branch_manager_cannot_query_other_branch(admin, branches, branch_manager):
    # Try to explicitly query the branch that's NOT assigned
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    r = requests.get(
        f"{API}/salons/{admin['salon_id']}/queue",
        params={"date": today, "branch_id": branches["extra_id"]},
        headers=branch_manager["headers"],
    )
    assert r.status_code == 403


def test_branch_manager_financials_scoped(admin, branches, branch_manager):
    r = requests.get(
        f"{API}/salons/{admin['salon_id']}/financials/dashboard",
        params={"period": "daily"},
        headers=branch_manager["headers"],
    )
    assert r.status_code == 200
    # No 403 needed; just ensure no cross-branch leakage
    for txn in r.json().get("transactions", []):
        assert txn.get("branch_id") == branches["main_id"]

    # Explicit other branch → 403
    r2 = requests.get(
        f"{API}/salons/{admin['salon_id']}/financials/dashboard",
        params={"period": "daily", "branch_id": branches["extra_id"]},
        headers=branch_manager["headers"],
    )
    assert r2.status_code == 403


def test_staff_transfer_admin_flow(admin, branches):
    # Find a barber in Main branch
    r = requests.get(
        f"{API}/salons/{admin['salon_id']}/barbers",
        params={"branch_id": branches["main_id"]},
        headers=admin["headers"],
    )
    assert r.status_code == 200
    barbers = r.json()
    assert barbers, "No barbers in main branch to transfer"
    barber = barbers[0]

    transfer_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    r = requests.post(
        f"{API}/salons/{admin['salon_id']}/staff-branch-transfers",
        json={
            "staff_id": barber["id"],
            "from_branch_id": branches["main_id"],
            "to_branch_id": branches["extra_id"],
            "transfer_date": transfer_date,
            "remarks": "pytest transfer",
        },
        headers=admin["headers"],
    )
    assert r.status_code == 200, r.text
    trans = r.json()
    assert trans["from_branch_id"] == branches["main_id"]
    assert trans["to_branch_id"] == branches["extra_id"]

    try:
        # Verify barber moved
        updated = requests.get(
            f"{API}/salons/{admin['salon_id']}/barbers",
            params={"branch_id": branches["extra_id"]},
            headers=admin["headers"],
        ).json()
        assert any(b["id"] == barber["id"] for b in updated)

        # History endpoint
        r2 = requests.get(
            f"{API}/salons/{admin['salon_id']}/staff-branch-transfers",
            params={"staff_id": barber["id"]},
            headers=admin["headers"],
        )
        assert r2.status_code == 200
        history = r2.json()
        assert any(t["id"] == trans["id"] for t in history)
    finally:
        # Transfer back so other tests see the original layout
        requests.post(
            f"{API}/salons/{admin['salon_id']}/staff-branch-transfers",
            json={
                "staff_id": barber["id"],
                "from_branch_id": branches["extra_id"],
                "to_branch_id": branches["main_id"],
                "transfer_date": transfer_date,
                "remarks": "pytest revert",
            },
            headers=admin["headers"],
        )


def test_branch_manager_cannot_transfer_outside_assigned(admin, branches, branch_manager):
    # Pick a barber currently in main branch
    r = requests.get(
        f"{API}/salons/{admin['salon_id']}/barbers",
        params={"branch_id": branches["main_id"]},
        headers=admin["headers"],
    )
    barbers = r.json()
    assert barbers
    barber = barbers[0]

    # Manager assigned only to Main → cannot transfer staff INTO BM-TEST
    r = requests.post(
        f"{API}/salons/{admin['salon_id']}/staff-branch-transfers",
        json={
            "staff_id": barber["id"],
            "from_branch_id": branches["main_id"],
            "to_branch_id": branches["extra_id"],
            "transfer_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        },
        headers=branch_manager["headers"],
    )
    assert r.status_code == 403


def test_staff_role_cannot_transfer(admin, branches):
    # Create a staff user
    login_id = _unique_login_id("staff")
    mobile = _unique_mobile()
    pw = "staffpass123"
    r = requests.post(
        f"{API}/salon/users",
        json={
            "salon_id": admin["salon_id"],
            "name": "Staff Test",
            "mobile": mobile,
            "login_id": login_id,
            "password": pw,
            "role": "staff",
        },
        headers=admin["headers"],
    )
    assert r.status_code == 200, r.text
    staff = r.json()
    try:
        tok = requests.post(
            f"{API}/salon/users/login",
            json={"identifier": login_id, "password": pw},
        ).json()
        headers = {"Authorization": f"Bearer {tok['access_token']}"}
        # Attempt transfer → 403
        r = requests.post(
            f"{API}/salons/{admin['salon_id']}/staff-branch-transfers",
            json={
                "staff_id": "dummy",
                "to_branch_id": branches["main_id"],
                "transfer_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            },
            headers=headers,
        )
        assert r.status_code == 403
    finally:
        requests.delete(f"{API}/salon/users/{staff['id']}", headers=admin["headers"])
