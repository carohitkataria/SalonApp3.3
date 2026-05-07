"""
Cashfree Payment Gateway service module.

Handles:
- Order creation (Cashfree PG Orders API v2023-08-01)
- Order/payment status fetch (verification)
- Webhook signature verification (HMAC-SHA256, base64)

Uses raw HTTPS calls via `httpx` (async) so we don't take an SDK dependency.
"""
import os
import hmac
import hashlib
import base64
import logging
import httpx

logger = logging.getLogger(__name__)

CASHFREE_ENV = (os.environ.get("CASHFREE_ENV") or "TEST").strip().upper()
CASHFREE_APP_ID = os.environ.get("CASHFREE_APP_ID", "").strip()
CASHFREE_SECRET_KEY = os.environ.get("CASHFREE_SECRET_KEY", "").strip()
CASHFREE_API_VERSION = os.environ.get("CASHFREE_API_VERSION", "2023-08-01").strip()
CASHFREE_WEBHOOK_SECRET = (os.environ.get("CASHFREE_WEBHOOK_SECRET") or CASHFREE_SECRET_KEY).strip()

if CASHFREE_ENV == "PROD":
    CASHFREE_BASE_URL = "https://api.cashfree.com/pg"
else:
    CASHFREE_BASE_URL = "https://sandbox.cashfree.com/pg"


def is_configured() -> bool:
    """Return True if Cashfree creds look usable."""
    return bool(CASHFREE_APP_ID and CASHFREE_SECRET_KEY)


def _headers() -> dict:
    return {
        "x-api-version": CASHFREE_API_VERSION,
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


async def create_order(
    *,
    order_id: str,
    order_amount: float,
    customer_id: str,
    customer_name: str,
    customer_email: str,
    customer_phone: str,
    return_url: str,
    notify_url: str = None,
    order_note: str = "",
    order_currency: str = "INR",
) -> dict:
    """
    Create a Cashfree order. Returns the parsed JSON response which includes
    `payment_session_id` (used by Cashfree JS SDK for hosted checkout).
    """
    if not is_configured():
        raise RuntimeError("Cashfree credentials are not configured")

    payload = {
        "order_id": order_id,
        "order_amount": float(order_amount),
        "order_currency": order_currency,
        "customer_details": {
            "customer_id": str(customer_id),
            "customer_name": customer_name or "Customer",
            "customer_email": customer_email or "noreply@salonhub.in",
            "customer_phone": customer_phone,
        },
        "order_meta": {
            "return_url": return_url,
        },
        "order_note": order_note or "SalonHub Subscription",
    }
    if notify_url:
        payload["order_meta"]["notify_url"] = notify_url

    url = f"{CASHFREE_BASE_URL}/orders"
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(url, json=payload, headers=_headers())

    if r.status_code >= 400:
        logger.error(f"[Cashfree] create_order failed {r.status_code}: {r.text}")
        # Try to parse error
        try:
            data = r.json()
        except Exception:
            data = {"raw": r.text}
        raise RuntimeError(f"Cashfree create_order failed: {data}")

    return r.json()


async def fetch_order(order_id: str) -> dict:
    """Fetch the latest status of a Cashfree order."""
    if not is_configured():
        raise RuntimeError("Cashfree credentials are not configured")

    url = f"{CASHFREE_BASE_URL}/orders/{order_id}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(url, headers=_headers())

    if r.status_code >= 400:
        logger.error(f"[Cashfree] fetch_order failed {r.status_code}: {r.text}")
        try:
            data = r.json()
        except Exception:
            data = {"raw": r.text}
        raise RuntimeError(f"Cashfree fetch_order failed: {data}")

    return r.json()


async def fetch_payments_for_order(order_id: str) -> list:
    """Fetch all payments for a given order. Returns a list (may be empty)."""
    if not is_configured():
        raise RuntimeError("Cashfree credentials are not configured")

    url = f"{CASHFREE_BASE_URL}/orders/{order_id}/payments"
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(url, headers=_headers())

    if r.status_code == 404:
        return []
    if r.status_code >= 400:
        logger.error(f"[Cashfree] fetch_payments failed {r.status_code}: {r.text}")
        return []

    data = r.json()
    if isinstance(data, list):
        return data
    return []


def verify_webhook_signature(raw_body: bytes, timestamp: str, signature: str) -> bool:
    """
    Verify Cashfree webhook signature.
    Per docs: HMAC-SHA256(secret_key, timestamp + raw_body) -> base64
    """
    if not (timestamp and signature):
        return False
    try:
        secret = CASHFREE_WEBHOOK_SECRET.encode("utf-8")
        body_str = raw_body.decode("utf-8") if isinstance(raw_body, (bytes, bytearray)) else str(raw_body)
        signed_payload = (str(timestamp) + body_str).encode("utf-8")
        digest = hmac.new(secret, signed_payload, hashlib.sha256).digest()
        computed = base64.b64encode(digest).decode("utf-8")
        return hmac.compare_digest(computed, signature)
    except Exception as e:
        logger.error(f"[Cashfree] verify_webhook_signature error: {e}")
        return False
