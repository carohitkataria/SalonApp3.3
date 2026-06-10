"""
Tests for the 30-day free trial subscription flow + dual-plan seed.

Covers:
- `GET /api/subscription-plans` returns both Monthly (₹999) and Yearly (₹9999).
- `GET /api/salons/{id}/subscription/status` exposes `trial_used` + `is_trial`.
- `POST /api/salons/{id}/subscription/start-trial` blocks salons that already
  have an active paid subscription (the seeded test salon).
"""
import os

import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


def _login_test_salon():
    r = requests.post(
        f"{API}/salon/password-login",
        json={"phone": "+917503070727", "password": "salon123"},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    j = r.json()
    return {
        "salon_id": j["salon_id"],
        "headers": {"Authorization": f"Bearer {j['access_token']}"},
    }


def test_plans_seeded_with_v3_pricing():
    r = requests.get(f"{API}/subscription-plans", timeout=10)
    assert r.status_code == 200, r.text
    plans = r.json()
    cycles = {p["billing_cycle"]: p for p in plans}
    assert "monthly" in cycles, f"Monthly plan missing: {plans}"
    assert "yearly" in cycles, f"Yearly plan missing: {plans}"
    assert float(cycles["monthly"]["price"]) == 999.0
    assert float(cycles["monthly"]["price_per_branch"]) == 999.0
    assert float(cycles["yearly"]["price"]) == 9999.0
    assert float(cycles["yearly"]["price_per_branch"]) == 9999.0


def test_status_exposes_trial_fields():
    auth = _login_test_salon()
    r = requests.get(
        f"{API}/salons/{auth['salon_id']}/subscription/status", timeout=10
    )
    assert r.status_code == 200, r.text
    body = r.json()
    # The test salon has a seeded paid subscription so trial flags are False.
    assert "trial_used" in body
    assert "is_trial" in body
    assert body["trial_used"] is False
    assert body["is_trial"] is False
    assert body["is_premium"] is True  # seeded 1-year premium


def test_start_trial_blocks_active_subscription():
    auth = _login_test_salon()
    r = requests.post(
        f"{API}/salons/{auth['salon_id']}/subscription/start-trial",
        headers=auth["headers"],
        timeout=10,
    )
    assert r.status_code == 400, r.text
    assert "already" in r.json().get("detail", "").lower()


def test_start_trial_requires_auth():
    auth = _login_test_salon()
    r = requests.post(
        f"{API}/salons/{auth['salon_id']}/subscription/start-trial",
        timeout=10,
    )
    # Either 401 (no token) or 403 (wrong role) — both prove the endpoint is auth-gated.
    assert r.status_code in (401, 403), r.text
