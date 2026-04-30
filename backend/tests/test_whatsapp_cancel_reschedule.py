"""Tests for Phase-2 WhatsApp cancel / reschedule flow.

Covers:
  * GET  /api/tokens/{id}/cancel-link  -> HTML confirmation page (no DB change)
  * POST /api/tokens/{id}/cancel-link  -> Actually cancels, returns success HTML
  * GET  /api/tokens/{id}/cancel-link  for already-cancelled / nonexistent
  * GET  /api/tokens/{id}/public-details (waiting / completed / missing)
  * PUT  /api/tokens/{id}/customer-reschedule (update same token, reject finished)
  * Regression smoke: POST /api/tokens/{id}/customer-cancel still works

Seed tokens tagged _seed_test=True and removed in module teardown.
Uses synchronous pymongo to avoid event-loop tangles.
"""

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
import requests
from pymongo import MongoClient


def _load_env_file(path: Path):
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        v = v.strip().strip('"').strip("'")
        os.environ.setdefault(k.strip(), v)


_load_env_file(Path("/app/frontend/.env"))
_load_env_file(Path("/app/backend/.env"))

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

# Seed IDs exist in test_database
SALON_ID = "b742cd5f-e3f8-4b63-872b-b83d84841d2c"
BARBER_ID = "8df34a0a-754a-4f56-b3c9-dff6788f3e3c"
BARBER_NAME = "Imran"
SERVICE_HAIRCUT = "a0adafbd-598b-4ccc-af18-694455b0de89"  # Imran price ₹180
SERVICE_BEARD = "0593d8bd-bf68-486d-a9bf-034d18772e6e"    # Imran price ₹96


def _make_token_doc(status: str = "waiting", number: str = "M99") -> dict:
    now = datetime.now(timezone.utc).isoformat()
    today = now[:10]
    return {
        "id": str(uuid.uuid4()),
        "salon_id": SALON_ID,
        "token_number": number,
        "customer_name": "TEST_Customer",
        "phone": "+919999999901",
        "user_id": "+919999999901",
        "date": today,
        "shift": "morning",
        "barber_id": BARBER_ID,
        "barber_name": BARBER_NAME,
        "selected_services": [SERVICE_HAIRCUT],
        "total_amount": 180.0,
        "status": status,
        "payment_status": "pending",
        "payment_mode": "cash",
        "payment_confirmed": False,
        "source": "app",
        "booking_type": "self",
        "booking_for_self": True,
        "created_at": now,
        "_seed_test": True,
    }


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(MONGO_URL)
    yield c[DB_NAME]
    c[DB_NAME].tokens.delete_many({"_seed_test": True})
    c.close()


@pytest.fixture
def waiting_token(mongo):
    doc = _make_token_doc(status="waiting")
    mongo.tokens.insert_one(dict(doc))
    yield doc
    mongo.tokens.delete_one({"id": doc["id"]})


@pytest.fixture
def cancelled_token(mongo):
    doc = _make_token_doc(status="cancelled", number="M77")
    mongo.tokens.insert_one(dict(doc))
    yield doc
    mongo.tokens.delete_one({"id": doc["id"]})


@pytest.fixture
def completed_token(mongo):
    doc = _make_token_doc(status="completed", number="M66")
    mongo.tokens.insert_one(dict(doc))
    yield doc
    mongo.tokens.delete_one({"id": doc["id"]})


# ================= GET /cancel-link =================

class TestCancelLinkGet:
    def test_get_cancel_link_shows_confirmation_page(self, waiting_token, mongo):
        r = requests.get(f"{BASE_URL}/api/tokens/{waiting_token['id']}/cancel-link", timeout=15)
        assert r.status_code == 200, r.text[:300]
        body = r.text
        for needle in ["Cancel this booking?", "Yes, Cancel", "No, Keep Booking"]:
            assert needle in body, f"Missing '{needle}' in cancel-link GET HTML"
        assert "The Looks Unisex Salon" in body
        assert f"#{waiting_token['token_number']}" in body
        # Must NOT mutate DB
        fresh = mongo.tokens.find_one({"id": waiting_token["id"]}, {"_id": 0})
        assert fresh["status"] == "waiting", "GET must NOT mutate token status"

    def test_get_cancel_link_for_already_cancelled(self, cancelled_token):
        r = requests.get(f"{BASE_URL}/api/tokens/{cancelled_token['id']}/cancel-link", timeout=15)
        assert r.status_code == 200
        assert "already cancelled" in r.text.lower()

    def test_get_cancel_link_for_missing_token(self):
        bogus = f"missing-{uuid.uuid4()}"
        r = requests.get(f"{BASE_URL}/api/tokens/{bogus}/cancel-link", timeout=15)
        assert r.status_code == 404
        assert "not found" in r.text.lower()


# ================= POST /cancel-link =================

class TestCancelLinkPost:
    def test_post_cancel_link_confirms_and_cancels(self, waiting_token, mongo):
        r = requests.post(f"{BASE_URL}/api/tokens/{waiting_token['id']}/cancel-link", timeout=15)
        assert r.status_code == 200, r.text[:300]
        assert "Cancellation Confirmed" in r.text
        fresh = mongo.tokens.find_one({"id": waiting_token["id"]}, {"_id": 0})
        assert fresh["status"] == "cancelled"

    def test_post_cancel_link_on_completed_is_rejected(self, completed_token, mongo):
        r = requests.post(f"{BASE_URL}/api/tokens/{completed_token['id']}/cancel-link", timeout=15)
        assert r.status_code == 400
        assert "cannot be cancelled" in r.text.lower()
        fresh = mongo.tokens.find_one({"id": completed_token["id"]}, {"_id": 0})
        assert fresh["status"] == "completed"


# ================= GET /public-details =================

class TestPublicDetails:
    def test_public_details_waiting(self, waiting_token):
        r = requests.get(f"{BASE_URL}/api/tokens/{waiting_token['id']}/public-details", timeout=15)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        for k in ["id", "salon_id", "date", "shift", "barber_id",
                  "selected_services", "token_number", "status"]:
            assert k in data, f"Missing key '{k}' in public-details response"
        assert data["id"] == waiting_token["id"]
        assert data["salon_id"] == SALON_ID
        assert data["status"] == "waiting"
        assert data["selected_services"] == [SERVICE_HAIRCUT]
        assert isinstance(data["selected_services"], list)
        assert data["token_number"] == waiting_token["token_number"]

    def test_public_details_completed_rejected(self, completed_token):
        r = requests.get(f"{BASE_URL}/api/tokens/{completed_token['id']}/public-details", timeout=15)
        assert r.status_code == 400

    def test_public_details_cancelled_rejected(self, cancelled_token):
        r = requests.get(f"{BASE_URL}/api/tokens/{cancelled_token['id']}/public-details", timeout=15)
        assert r.status_code == 400

    def test_public_details_missing(self):
        r = requests.get(f"{BASE_URL}/api/tokens/missing-{uuid.uuid4()}/public-details", timeout=15)
        assert r.status_code == 404


# ================= PUT /customer-reschedule =================

class TestCustomerReschedule:
    def test_reschedule_updates_same_token(self, waiting_token, mongo):
        before = mongo.tokens.count_documents({"phone": waiting_token["phone"]})
        body = {
            "date": waiting_token["date"],
            "shift": "evening",
            "barber_id": BARBER_ID,
            "selected_services": [SERVICE_HAIRCUT, SERVICE_BEARD],  # 180 + 96 = 276
        }
        r = requests.put(
            f"{BASE_URL}/api/tokens/{waiting_token['id']}/customer-reschedule",
            json=body,
            timeout=15,
        )
        assert r.status_code == 200, r.text[:400]
        payload = r.json()
        assert "token" in payload
        updated = payload["token"]
        assert updated["id"] == waiting_token["id"]
        assert updated["shift"] == "evening"
        assert sorted(updated["selected_services"]) == sorted([SERVICE_HAIRCUT, SERVICE_BEARD])
        # recomputed total ~ 276
        assert abs(updated["total_amount"] - 276.0) < 0.5, updated["total_amount"]
        after = mongo.tokens.count_documents({"phone": waiting_token["phone"]})
        assert after == before, f"Token count changed: {before} -> {after}"
        fresh = mongo.tokens.find_one({"id": waiting_token["id"]}, {"_id": 0})
        assert fresh["shift"] == "evening"
        assert fresh["status"] == "waiting"

    def test_reschedule_rejects_cancelled(self, cancelled_token):
        body = {"shift": "evening", "selected_services": [SERVICE_HAIRCUT], "barber_id": BARBER_ID}
        r = requests.put(
            f"{BASE_URL}/api/tokens/{cancelled_token['id']}/customer-reschedule",
            json=body,
            timeout=15,
        )
        assert r.status_code == 400

    def test_reschedule_rejects_completed(self, completed_token):
        body = {"shift": "evening", "selected_services": [SERVICE_HAIRCUT], "barber_id": BARBER_ID}
        r = requests.put(
            f"{BASE_URL}/api/tokens/{completed_token['id']}/customer-reschedule",
            json=body,
            timeout=15,
        )
        assert r.status_code == 400

    def test_reschedule_missing_token_404(self):
        r = requests.put(
            f"{BASE_URL}/api/tokens/missing-{uuid.uuid4()}/customer-reschedule",
            json={"shift": "morning", "selected_services": [SERVICE_HAIRCUT], "barber_id": BARBER_ID},
            timeout=15,
        )
        assert r.status_code == 404


# ================= Regression: customer-cancel app endpoint =================

class TestRegressionCustomerCancel:
    def test_customer_cancel_endpoint_still_works(self, waiting_token, mongo):
        r = requests.post(
            f"{BASE_URL}/api/tokens/{waiting_token['id']}/customer-cancel",
            timeout=15,
        )
        assert r.status_code in (200, 204), f"{r.status_code} {r.text[:300]}"
        fresh = mongo.tokens.find_one({"id": waiting_token["id"]}, {"_id": 0})
        assert fresh["status"] == "cancelled"
