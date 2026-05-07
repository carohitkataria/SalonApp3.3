"""
Phase 2 extra coverage tests:
- POST /api/salon/users role=branch_manager with EMPTY assigned_branch_ids → 400.
- POST /api/salon/users with role=branch_manager + INVALID branch id → 400.
- PUT /api/salon/users/{id} can change role + assigned_branch_ids.
- Branch-manager scope on /customers, /today-sales (no leakage / 403 on others).
- Branch-manager scope on /barbers admin view, AND customer_view=true must NOT be scoped.
- Staff transfer: same-branch no-op → 400.
- Staff transfer history visible to branch_manager only for their assigned branches.
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_LOGIN = {"identifier": "admin", "password": "salon123"}


def _admin():
    r = requests.post(f"{API}/salon/users/login", json=ADMIN_LOGIN, timeout=10)
    assert r.status_code == 200, r.text
    j = r.json()
    return {"salon_id": j["salon_id"], "headers": {"Authorization": f"Bearer {j['access_token']}"}}


@pytest.fixture(scope="module")
def admin():
    return _admin()


@pytest.fixture(scope="module")
def branches(admin):
    r = requests.get(f"{API}/salons/{admin['salon_id']}/branches", headers=admin["headers"])
    assert r.status_code == 200
    existing = r.json()
    main = next(b for b in existing if b["is_main_branch"])
    extra = next((b for b in existing if b["branch_code"] == "BM-TEST"), None)
    if not extra:
        r = requests.post(
            f"{API}/salons/{admin['salon_id']}/branches",
            json={"branch_name": "BM Test Branch", "branch_code": "BM-TEST", "city": "Bangalore"},
            headers=admin["headers"],
        )
        assert r.status_code == 200, r.text
        extra = r.json()
    return {"main_id": main["id"], "extra_id": extra["id"]}


def _uniq(p="bm"):
    return f"{p}-{uuid.uuid4().hex[:6]}"


def _mob():
    return f"+918{int(datetime.now(timezone.utc).timestamp() * 1000) % 1000000000:09d}"


# ─── User Validation ─────────────────────────────────────────────────────────
def test_branch_manager_empty_assigned_branches_400(admin):
    r = requests.post(
        f"{API}/salon/users",
        json={
            "salon_id": admin["salon_id"],
            "name": "BM-empty",
            "mobile": _mob(),
            "login_id": _uniq("bm"),
            "password": "pwd123",
            "role": "branch_manager",
            "assigned_branch_ids": [],
        },
        headers=admin["headers"],
    )
    assert r.status_code == 400, r.text


def test_branch_manager_invalid_branch_id_400(admin):
    r = requests.post(
        f"{API}/salon/users",
        json={
            "salon_id": admin["salon_id"],
            "name": "BM-bad",
            "mobile": _mob(),
            "login_id": _uniq("bm"),
            "password": "pwd123",
            "role": "branch_manager",
            "assigned_branch_ids": ["not-a-real-branch-id"],
        },
        headers=admin["headers"],
    )
    assert r.status_code == 400, r.text


def test_put_user_change_role_and_branches(admin, branches):
    # Create a staff user, then promote to branch_manager via PUT
    login_id = _uniq("flex")
    r = requests.post(
        f"{API}/salon/users",
        json={
            "salon_id": admin["salon_id"],
            "name": "Flex User",
            "mobile": _mob(),
            "login_id": login_id,
            "password": "pwd123",
            "role": "staff",
        },
        headers=admin["headers"],
    )
    assert r.status_code == 200, r.text
    user = r.json()
    try:
        # PUT — promote
        r2 = requests.put(
            f"{API}/salon/users/{user['id']}",
            json={"role": "branch_manager", "assigned_branch_ids": [branches["main_id"]]},
            headers=admin["headers"],
        )
        assert r2.status_code == 200, r2.text
        updated = r2.json()
        assert updated["role"] == "branch_manager"
        assert updated["assigned_branch_ids"] == [branches["main_id"]]

        # PUT with invalid branch id → 400
        r3 = requests.put(
            f"{API}/salon/users/{user['id']}",
            json={"assigned_branch_ids": ["bogus-id"]},
            headers=admin["headers"],
        )
        assert r3.status_code == 400
    finally:
        requests.delete(f"{API}/salon/users/{user['id']}", headers=admin["headers"])


# ─── Branch-manager Scoping ─────────────────────────────────────────────────
@pytest.fixture
def bm_main(admin, branches):
    """BM assigned only to Main branch."""
    login_id = _uniq("bm")
    r = requests.post(
        f"{API}/salon/users",
        json={
            "salon_id": admin["salon_id"],
            "name": "BM Main",
            "mobile": _mob(),
            "login_id": login_id,
            "password": "pwd123",
            "role": "branch_manager",
            "assigned_branch_ids": [branches["main_id"]],
        },
        headers=admin["headers"],
    )
    assert r.status_code == 200, r.text
    user = r.json()
    tok = requests.post(f"{API}/salon/users/login", json={"identifier": login_id, "password": "pwd123"}).json()
    info = {"user_id": user["id"], "headers": {"Authorization": f"Bearer {tok['access_token']}"}}
    yield info
    requests.delete(f"{API}/salon/users/{user['id']}", headers=admin["headers"])


def test_bm_today_sales_other_branch_403(admin, branches, bm_main):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    r = requests.get(
        f"{API}/salons/{admin['salon_id']}/today-sales",
        params={"date": today, "branch_id": branches["extra_id"]},
        headers=bm_main["headers"],
    )
    assert r.status_code == 403


def test_bm_customers_scoped(admin, branches, bm_main):
    # Auto-scope (no branch_id param) must succeed
    r = requests.get(
        f"{API}/salons/{admin['salon_id']}/customers",
        headers=bm_main["headers"],
    )
    assert r.status_code == 200
    # Explicit unassigned branch → 403
    r2 = requests.get(
        f"{API}/salons/{admin['salon_id']}/customers",
        params={"branch_id": branches["extra_id"]},
        headers=bm_main["headers"],
    )
    assert r2.status_code == 403


def test_bm_barbers_admin_view_scoped(admin, branches, bm_main):
    # Admin view → scoped
    r = requests.get(
        f"{API}/salons/{admin['salon_id']}/barbers",
        params={"branch_id": branches["extra_id"]},
        headers=bm_main["headers"],
    )
    assert r.status_code == 403


def test_bm_barbers_customer_view_not_scoped(admin, branches, bm_main):
    # customer_view=true must NOT be scoped (open endpoint) — even unauthenticated works
    r = requests.get(
        f"{API}/salons/{admin['salon_id']}/barbers",
        params={"customer_view": "true", "branch_id": branches["extra_id"]},
    )
    # should succeed without auth or scope checks
    assert r.status_code == 200, r.text


def test_bm_financials_transactions_other_branch_403(admin, branches, bm_main):
    r = requests.get(
        f"{API}/salons/{admin['salon_id']}/financials/transactions",
        params={"branch_id": branches["extra_id"]},
        headers=bm_main["headers"],
    )
    assert r.status_code == 403


# ─── Transfer extras ─────────────────────────────────────────────────────────
def test_transfer_same_branch_400(admin, branches):
    r = requests.get(
        f"{API}/salons/{admin['salon_id']}/barbers",
        params={"branch_id": branches["main_id"]},
        headers=admin["headers"],
    ).json()
    assert r
    barber = r[0]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    r2 = requests.post(
        f"{API}/salons/{admin['salon_id']}/staff-branch-transfers",
        json={
            "staff_id": barber["id"],
            "from_branch_id": branches["main_id"],
            "to_branch_id": branches["main_id"],
            "transfer_date": today,
        },
        headers=admin["headers"],
    )
    assert r2.status_code == 400, r2.text


def test_bm_transfer_history_scoped(admin, branches, bm_main):
    # BM should get history (auto-scoped) without 403
    r = requests.get(
        f"{API}/salons/{admin['salon_id']}/staff-branch-transfers",
        headers=bm_main["headers"],
    )
    assert r.status_code == 200
    # All entries should touch the assigned branch
    for t in r.json():
        assert (
            t.get("from_branch_id") == branches["main_id"]
            or t.get("to_branch_id") == branches["main_id"]
        ), f"BM saw non-assigned transfer: {t}"
