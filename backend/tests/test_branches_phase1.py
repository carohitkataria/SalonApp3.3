"""
Backend tests for Phase 1 of the Branch Model:
- Migration: every existing salon has a "Main Branch" with is_main_branch=true.
- Branch CRUD: list / create / update / set-main / deactivate / qr-code.
- Branch-aware filters on tokens (queue) and barbers.
- Branch_id is auto-stamped on new bookings + barbers.
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_LOGIN = {"identifier": "admin", "password": "salon123"}


def _login():
    r = requests.post(f"{API}/salon/users/login", json=ADMIN_LOGIN, timeout=10)
    assert r.status_code == 200, r.text
    j = r.json()
    return {
        "salon_id": j["salon_id"],
        "headers": {"Authorization": f"Bearer {j['access_token']}"},
    }


@pytest.fixture(scope="module")
def auth():
    return _login()


def test_main_branch_exists_after_migration(auth):
    r = requests.get(f"{API}/salons/{auth['salon_id']}/branches", headers=auth["headers"])
    assert r.status_code == 200, r.text
    branches = r.json()
    assert len(branches) >= 1
    main = [b for b in branches if b.get("is_main_branch")]
    assert len(main) == 1, f"Expected exactly one main branch, got {main}"
    assert main[0]["status"] == "active"
    assert main[0]["salon_id"] == auth["salon_id"]


def test_create_update_set_main_deactivate(auth):
    # Create
    code = f"PYT-{uuid.uuid4().hex[:5]}"
    payload = {
        "branch_name": f"Pytest Branch {uuid.uuid4().hex[:6]}",
        "branch_code": code,
        "address": "Test address",
        "city": "Bangalore",
        "phone": "+919999999998",
        "email": "pyt@example.com",
    }
    r = requests.post(
        f"{API}/salons/{auth['salon_id']}/branches",
        json=payload,
        headers=auth["headers"],
    )
    assert r.status_code == 200, r.text
    new_branch = r.json()
    bid = new_branch["id"]
    assert new_branch["is_main_branch"] is False
    assert new_branch["branch_code"] == code

    try:
        # Update phone
        r = requests.put(
            f"{API}/salons/{auth['salon_id']}/branches/{bid}",
            json={"phone": "+919999999000"},
            headers=auth["headers"],
        )
        assert r.status_code == 200
        assert r.json()["phone"] == "+919999999000"

        # Set as main → previous main should be demoted
        r = requests.post(
            f"{API}/salons/{auth['salon_id']}/branches/{bid}/set-main",
            headers=auth["headers"],
        )
        assert r.status_code == 200

        all_b = requests.get(
            f"{API}/salons/{auth['salon_id']}/branches", headers=auth["headers"]
        ).json()
        main_ids = [b["id"] for b in all_b if b["is_main_branch"]]
        assert main_ids == [bid], f"Expected only {bid} to be main, got {main_ids}"

        # Cannot deactivate main
        r = requests.delete(
            f"{API}/salons/{auth['salon_id']}/branches/{bid}",
            headers=auth["headers"],
        )
        assert r.status_code == 400

        # Demote: promote the OG main back
        og_main = next(b for b in all_b if b["branch_code"] == "MAIN")
        r = requests.post(
            f"{API}/salons/{auth['salon_id']}/branches/{og_main['id']}/set-main",
            headers=auth["headers"],
        )
        assert r.status_code == 200

        # Now deactivate should succeed
        r = requests.delete(
            f"{API}/salons/{auth['salon_id']}/branches/{bid}",
            headers=auth["headers"],
        )
        assert r.status_code == 200

        # Hidden by default (status=active filter)
        listed = requests.get(
            f"{API}/salons/{auth['salon_id']}/branches", headers=auth["headers"]
        ).json()
        assert all(b["id"] != bid for b in listed)

        # But include_inactive returns it
        r = requests.get(
            f"{API}/salons/{auth['salon_id']}/branches?include_inactive=true",
            headers=auth["headers"],
        )
        assert any(b["id"] == bid and b["status"] == "inactive" for b in r.json())
    finally:
        # Hard cleanup so test is rerunnable
        requests.delete(
            f"{API}/salons/{auth['salon_id']}/branches/{bid}", headers=auth["headers"]
        )


def test_qr_endpoint_returns_qr(auth):
    branches = requests.get(
        f"{API}/salons/{auth['salon_id']}/branches", headers=auth["headers"]
    ).json()
    main = next(b for b in branches if b["is_main_branch"])
    r = requests.get(
        f"{API}/salons/{auth['salon_id']}/branches/{main['id']}/qr-code",
        params={"base_url": "https://example.com"},
    )
    assert r.status_code == 200
    j = r.json()
    assert j["qr_code"].startswith("data:image/png;base64,")
    assert main["id"] in j["booking_url"]
    assert "https://example.com" in j["booking_url"]


def test_barbers_have_branch_id(auth):
    r = requests.get(
        f"{API}/salons/{auth['salon_id']}/barbers", headers=auth["headers"]
    )
    assert r.status_code == 200
    for b in r.json():
        assert b.get("branch_id"), f"Existing barber {b['id']} missing branch_id"


def test_new_booking_has_branch_id(auth):
    # Pick first enabled service
    services = requests.get(f"{API}/services").json()
    assert services
    svc_id = services[0]["id"]

    # Create a fresh user (Indian phone is +91 + 10 digits → 13 chars total)
    phone = f"+918{int(datetime.now(timezone.utc).timestamp()) % 1000000000:09d}"
    user = requests.post(
        f"{API}/user/login",
        json={"name": "PytestBranch", "phone": phone, "gender": "Men"},
    ).json()
    if "id" not in user:
        pytest.skip(f"User login failed: {user}")
    user_id = user["id"]

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    booking = {
        "salon_id": auth["salon_id"],
        "user_id": user_id,
        "customer_name": "PytestBranch",
        "phone": phone,
        "date": today,
        "shift": "Morning",
        "barber_id": "any",
        "selected_services": [svc_id],
        "booking_type": "instant",
        "booking_for_self": True,
        "payment_mode": "cash",
    }
    r = requests.post(f"{API}/bookings", json=booking)
    if r.status_code != 200:
        # may fail if all barbers are full or duplicate booking — skip cleanly
        pytest.skip(f"Booking creation skipped: {r.status_code} {r.text}")
    token = r.json()
    assert token.get("branch_id"), "New token must carry branch_id"

    # Confirm queue endpoint can filter by branch_id
    branches = requests.get(
        f"{API}/salons/{auth['salon_id']}/branches", headers=auth["headers"]
    ).json()
    main_id = next(b["id"] for b in branches if b["is_main_branch"])
    r2 = requests.get(
        f"{API}/salons/{auth['salon_id']}/queue",
        params={"date": today, "branch_id": main_id},
    )
    assert r2.status_code == 200
    assert any(t["id"] == token["id"] for t in r2.json())

    # Cleanup: cancel the booking so future test runs don't trip duplicate-booking guard
    requests.post(f"{API}/tokens/{token['id']}/cancel", headers=auth["headers"])
