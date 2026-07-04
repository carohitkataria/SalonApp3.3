"""
marketing.py — SalonHub 2.0 Marketing Module (M0–M3 slice).

Contained here:
  * Salon channel connections (M0)      – GET /salons/{id}/channels, GET status
  * WhatsApp webhook (M0)                – GET/POST /webhooks/whatsapp
  * Marketing segments CRUD + preview (M2)
  * Salon coupons CRUD + publish/validate (M3)
  * Marketing templates library (skeleton — used by later milestones)
  * Marketing overview stub (M4 lite — real numbers filled by later milestones)
  * Marketing automations placeholder (M6)

Collections used:
  db.salon_channel_connections   {salon_id, provider, phone_number_id, verified, connected_at, ...}
  db.marketing_settings          {salon_id, monthly_cap_inr, freq_cap_per_customer, quiet_hours_start, quiet_hours_end, spend_brake, ...}
  db.marketing_segments          {id, salon_id, name, rules:{logic:"AND"|"OR", conditions:[...]}, ...}
  db.marketing_templates         {id, salon_id, name, category, body, variables:[], status}
  db.marketing_campaigns         {id, salon_id, name, segment_id, template_id, status, schedule_at, ...}
  db.marketing_messages          {id, campaign_id, salon_id, to_phone, status, provider, sent_at, delivered_at, read_at, clicked_at}
  db.marketing_automations       {id, salon_id, trigger, active, template_id, ...}
  db.salon_coupons               {id, salon_id, code, title, type, value, ...}
  db.salon_coupon_redemptions    {id, coupon_id, customer_phone, booking_id, amount, ...}

Router is included by server.py at the end of startup.
"""

from __future__ import annotations

import logging
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator

logger = logging.getLogger(__name__)

# Injected via init_marketing_router at startup
_db = None
_get_current_salon_user = None
_get_current_salon_admin = None

marketing_router = APIRouter(prefix="/api", tags=["marketing"])


def init_marketing_router(*, db, get_current_salon_user, get_current_salon_admin):
    global _db, _get_current_salon_user, _get_current_salon_admin
    _db = db
    _get_current_salon_user = get_current_salon_user
    _get_current_salon_admin = get_current_salon_admin


# ---------- Utilities ----------

def _clean(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return doc
    doc = dict(doc)
    doc.pop("_id", None)
    for k, v in list(doc.items()):
        if isinstance(v, ObjectId):
            doc[k] = str(v)
    return doc


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_phone(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return raw
    p = str(raw).strip()
    if p.startswith("+"):
        return "+" + "".join(ch for ch in p[1:] if ch.isdigit())
    digits = "".join(ch for ch in p if ch.isdigit())
    if len(digits) == 10:
        return "+91" + digits
    if len(digits) > 10:
        return "+" + digits
    return p


def _assert_salon_scope(user: Dict[str, Any], salon_id: str):
    if user and user.get("salon_id") and user.get("salon_id") != salon_id:
        raise HTTPException(status_code=403, detail="Cross-salon access denied")


# ================================================================
# M0 — Channels + Webhook + Provider info
# ================================================================

class ChannelStatus(BaseModel):
    provider: str
    connected: bool
    phone_number_id: Optional[str] = None
    display_number: Optional[str] = None
    status: str  # "connected" | "not_connected" | "action_needed"
    note: Optional[str] = None


@marketing_router.get("/salons/{salon_id}/marketing/ping")
async def marketing_ping(salon_id: str, request: Request):
    """Health check for the marketing module (auth required)."""
    user = await _require_user(request)
    _assert_salon_scope(user, salon_id)
    return {"ok": True, "salon_id": salon_id, "module": "marketing", "ts": _now_iso()}


# Because module-level lambdas don't play nicely with Depends when the target
# is only bound at startup, expose the endpoints using explicit "async request"
# handlers that call the injected auth helper at runtime.
async def _require_user(request: Request) -> Dict[str, Any]:
    if _get_current_salon_user is None:
        raise HTTPException(status_code=500, detail="Marketing auth not initialised")
    # Extract the Authorization header and reuse the standard helper. We import
    # the primitives lazily to avoid circular imports.
    from fastapi.security import HTTPAuthorizationCredentials
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=403, detail="Not authenticated")
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=auth_header.split(" ", 1)[1])
    return await _get_current_salon_user(creds)


async def _require_admin(request: Request) -> Dict[str, Any]:
    user = await _require_user(request)
    if user.get("role") not in ("salon_admin", "platform_admin", "admin"):
        raise HTTPException(status_code=403, detail="Admin required")
    return user


@marketing_router.get("/salons/{salon_id}/marketing/channels")
async def marketing_channels(salon_id: str, request: Request):
    user = await _require_user(request)
    _assert_salon_scope(user, salon_id)

    # WhatsApp — active provider from env; Meta connection state stored in
    # db.salon_channel_connections when Mode B is unlocked (Phase 2).
    from whatsapp_service import get_active_provider, is_meta_configured

    provider = get_active_provider()
    meta_ok = is_meta_configured()
    twilio_ok = bool(os.environ.get("TWILIO_ACCOUNT_SID") and os.environ.get("TWILIO_WHATSAPP_NUMBER"))

    channels = []
    if provider == "meta":
        channels.append(
            ChannelStatus(
                provider="whatsapp_meta",
                connected=meta_ok,
                phone_number_id=os.environ.get("META_WA_PHONE_NUMBER_ID"),
                display_number=os.environ.get("META_WA_DISPLAY_NUMBER"),
                status="connected" if meta_ok else "action_needed",
                note=None if meta_ok else "META_WA_PHONE_NUMBER_ID / META_WA_ACCESS_TOKEN missing",
            ).model_dump()
        )
    else:
        channels.append(
            ChannelStatus(
                provider="whatsapp_twilio",
                connected=twilio_ok,
                phone_number_id=None,
                display_number=(os.environ.get("TWILIO_WHATSAPP_NUMBER") or "").replace("whatsapp:", ""),
                status="connected" if twilio_ok else "not_connected",
                note=None,
            ).model_dump()
        )
    return {"salon_id": salon_id, "active_provider": provider, "channels": channels}


# --------- WhatsApp webhook (Meta) ---------

@marketing_router.get("/webhooks/whatsapp")
async def whatsapp_webhook_verify(
    hub_mode: Optional[str] = Query(default=None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(default=None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(default=None, alias="hub.challenge"),
):
    expected = os.environ.get("META_WA_WEBHOOK_VERIFY_TOKEN") or ""
    if hub_mode == "subscribe" and hub_verify_token and expected and hub_verify_token == expected:
        return PlainTextResponse(hub_challenge or "")
    raise HTTPException(status_code=403, detail="Verify token mismatch")


@marketing_router.post("/webhooks/whatsapp")
async def whatsapp_webhook_event(request: Request):
    raw = await request.body()
    # Best-effort signature check
    from whatsapp_service import verify_meta_signature

    app_secret = os.environ.get("META_WA_APP_SECRET") or ""
    header_sig = request.headers.get("X-Hub-Signature-256") or ""
    if app_secret and not verify_meta_signature(app_secret, raw, header_sig):
        logger.warning("[WA Webhook] invalid signature — dropping")
        # We still return 200 so Meta doesn't disable the webhook while we
        # debug; log the anomaly.
        return {"received": True, "signature_valid": False}

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    # Save raw event for audit / replay
    try:
        await _db.whatsapp_webhook_events.insert_one(
            {"id": str(uuid.uuid4()), "received_at": _now_iso(), "payload": payload}
        )
    except Exception as e:
        logger.warning(f"[WA Webhook] event log failed: {e}")

    # Parse status updates → marketing_messages
    try:
        entries = (payload or {}).get("entry") or []
        for e in entries:
            for change in (e.get("changes") or []):
                value = change.get("value") or {}
                statuses = value.get("statuses") or []
                for s in statuses:
                    wa_msg_id = s.get("id")
                    status = s.get("status")  # sent/delivered/read/failed
                    ts = s.get("timestamp")
                    if not wa_msg_id or not status:
                        continue
                    fields: Dict[str, Any] = {"status": status}
                    stamp = _now_iso()
                    if status == "sent":
                        fields["sent_at"] = stamp
                    elif status == "delivered":
                        fields["delivered_at"] = stamp
                    elif status == "read":
                        fields["read_at"] = stamp
                    elif status == "failed":
                        fields["failed_at"] = stamp
                    await _db.marketing_messages.update_one(
                        {"provider_message_id": wa_msg_id}, {"$set": fields}
                    )
    except Exception as ex:
        logger.warning(f"[WA Webhook] parse error: {ex}")
    return {"received": True, "signature_valid": True}


# ================================================================
# M1 — (Customer master fields lives in server.py — nothing here)
# ================================================================


# ================================================================
# M2 — Marketing Segments
# ================================================================

ALLOWED_FIELDS = {
    "age_min", "age_max",
    "birthday_month", "wedding_anniversary_month", "spouse_birthday_month",
    "last_visit_min_days", "last_visit_max_days",
    "avg_spend_min", "total_spend_min", "visit_count_min",
    "gender", "membership_tier", "has_wallet", "phones",
}


class SegmentCondition(BaseModel):
    field: str
    op: str  # eq, gte, lte, in, contains
    value: Any

    @field_validator("field")
    @classmethod
    def _f(cls, v):
        if v not in ALLOWED_FIELDS:
            raise ValueError(f"Unsupported segment field: {v}")
        return v


class SegmentRules(BaseModel):
    logic: str = "AND"  # AND | OR
    conditions: List[SegmentCondition] = Field(default_factory=list)


class SegmentIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    description: Optional[str] = None
    rules: SegmentRules


def _matches_customer(customer: Dict[str, Any], stats: Dict[str, Any], cond: SegmentCondition, salon_id: str) -> bool:
    f, op, val = cond.field, cond.op, cond.value

    def _int(v, default=None):
        try:
            return int(v)
        except Exception:
            return default

    def _month_of(datestr: Optional[str]) -> Optional[int]:
        if not datestr:
            return None
        try:
            return int(str(datestr)[5:7])
        except Exception:
            return None

    now = datetime.now(timezone.utc)

    if f == "age_min":
        dob = customer.get("dob")
        try:
            y = int(str(dob)[:4])
            age = now.year - y
            return age >= _int(val, 0)
        except Exception:
            return False
    if f == "age_max":
        dob = customer.get("dob")
        try:
            y = int(str(dob)[:4])
            age = now.year - y
            return age <= _int(val, 200)
        except Exception:
            return False
    if f == "birthday_month":
        return _month_of(customer.get("dob")) == _int(val)
    if f == "wedding_anniversary_month":
        return _month_of(customer.get("wedding_anniversary")) == _int(val)
    if f == "spouse_birthday_month":
        return _month_of(customer.get("spouse_date_of_birth")) == _int(val)
    if f == "last_visit_min_days":
        lv = stats.get("last_visit_days")
        return lv is not None and lv >= _int(val, 0)
    if f == "last_visit_max_days":
        lv = stats.get("last_visit_days")
        return lv is not None and lv <= _int(val, 99999)
    if f == "avg_spend_min":
        return (stats.get("avg_spend") or 0) >= float(val or 0)
    if f == "total_spend_min":
        return (stats.get("total_spend") or 0) >= float(val or 0)
    if f == "visit_count_min":
        return (stats.get("visit_count") or 0) >= _int(val, 0)
    if f == "gender":
        return (customer.get("gender") or "").lower() == str(val or "").lower()
    if f == "membership_tier":
        return (stats.get("membership_tier") or "") == str(val or "")
    if f == "has_wallet":
        return bool(stats.get("has_wallet")) == bool(val)
    if f == "phones":
        phones = val if isinstance(val, list) else [val]
        norm = [_normalize_phone(p) for p in phones]
        return customer.get("phone") in norm
    return False


async def _resolve_customers_for_salon(salon_id: str) -> List[Dict[str, Any]]:
    """Return a merged list of customers relevant to this salon by unioning
    global users (`users` collection) with anyone who has a booking here."""
    phones = set()
    # 1) Anyone who has ever booked here
    cursor = _db.tokens.find({"salon_id": salon_id}, {"user_phone": 1, "customer_phone": 1})
    async for t in cursor:
        p = t.get("user_phone") or t.get("customer_phone")
        if p:
            phones.add(_normalize_phone(p))
    # 2) Anyone who has a customer_membership here
    cursor2 = _db.customer_memberships.find({"salon_id": salon_id}, {"customer_phone": 1})
    async for m in cursor2:
        p = m.get("customer_phone")
        if p:
            phones.add(_normalize_phone(p))

    customers: List[Dict[str, Any]] = []
    if phones:
        cursor3 = _db.users.find({"phone": {"$in": list(phones)}})
        async for u in cursor3:
            customers.append(_clean(u))
    return customers


async def _compute_stats(salon_id: str, phone: str) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    stats: Dict[str, Any] = {}
    tokens_cur = _db.tokens.find({"salon_id": salon_id, "user_phone": phone}, {"created_at": 1, "amount": 1, "final_amount": 1, "status": 1})
    total = 0.0
    count = 0
    last_dt: Optional[datetime] = None
    async for t in tokens_cur:
        if t.get("status") == "cancelled":
            continue
        count += 1
        total += float(t.get("final_amount") or t.get("amount") or 0)
        try:
            dt = t.get("created_at")
            if isinstance(dt, str):
                dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
            if isinstance(dt, datetime):
                if not last_dt or dt > last_dt:
                    last_dt = dt
        except Exception:
            pass
    stats["visit_count"] = count
    stats["total_spend"] = round(total, 2)
    stats["avg_spend"] = round(total / count, 2) if count else 0.0
    if last_dt:
        try:
            stats["last_visit_days"] = max(0, (now - last_dt).days)
        except Exception:
            stats["last_visit_days"] = None

    mem = await _db.customer_memberships.find_one({"salon_id": salon_id, "customer_phone": phone})
    if mem:
        stats["has_wallet"] = True
        stats["membership_tier"] = mem.get("plan_name") or "member"
    else:
        stats["has_wallet"] = False
    return stats


async def _evaluate_segment(salon_id: str, rules: SegmentRules) -> List[Dict[str, Any]]:
    customers = await _resolve_customers_for_salon(salon_id)
    out: List[Dict[str, Any]] = []
    for c in customers:
        stats = await _compute_stats(salon_id, c.get("phone"))
        results = [_matches_customer(c, stats, cond, salon_id) for cond in rules.conditions]
        keep = all(results) if rules.logic == "AND" else (any(results) if results else False)
        if not rules.conditions:
            keep = True
        if keep:
            out.append({"phone": c.get("phone"), "name": c.get("name"), **stats})
    return out


@marketing_router.post("/salons/{salon_id}/marketing/segments/preview")
async def preview_segment(salon_id: str, body: SegmentIn, request: Request):
    user = await _require_user(request)
    _assert_salon_scope(user, salon_id)
    matched = await _evaluate_segment(salon_id, body.rules)
    return {"count": len(matched), "sample": matched[:20]}


@marketing_router.post("/salons/{salon_id}/marketing/segments")
async def create_segment(salon_id: str, body: SegmentIn, request: Request):
    user = await _require_user(request)
    _assert_salon_scope(user, salon_id)
    doc = {
        "id": str(uuid.uuid4()),
        "salon_id": salon_id,
        "name": body.name,
        "description": body.description,
        "rules": body.rules.model_dump(),
        "created_at": _now_iso(),
        "created_by": user.get("user_id"),
    }
    await _db.marketing_segments.insert_one(doc)
    return _clean(doc)


@marketing_router.get("/salons/{salon_id}/marketing/segments")
async def list_segments(salon_id: str, request: Request):
    user = await _require_user(request)
    _assert_salon_scope(user, salon_id)
    out = []
    async for s in _db.marketing_segments.find({"salon_id": salon_id}).sort("created_at", -1):
        out.append(_clean(s))
    return {"segments": out}


@marketing_router.get("/salons/{salon_id}/marketing/segments/{seg_id}")
async def get_segment(salon_id: str, seg_id: str, request: Request):
    user = await _require_user(request)
    _assert_salon_scope(user, salon_id)
    s = await _db.marketing_segments.find_one({"id": seg_id, "salon_id": salon_id})
    if not s:
        raise HTTPException(status_code=404, detail="Segment not found")
    return _clean(s)


@marketing_router.put("/salons/{salon_id}/marketing/segments/{seg_id}")
async def update_segment(salon_id: str, seg_id: str, body: SegmentIn, request: Request):
    user = await _require_user(request)
    _assert_salon_scope(user, salon_id)
    upd = {
        "name": body.name,
        "description": body.description,
        "rules": body.rules.model_dump(),
        "updated_at": _now_iso(),
    }
    res = await _db.marketing_segments.update_one({"id": seg_id, "salon_id": salon_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")
    doc = await _db.marketing_segments.find_one({"id": seg_id})
    return _clean(doc)


@marketing_router.delete("/salons/{salon_id}/marketing/segments/{seg_id}")
async def delete_segment(salon_id: str, seg_id: str, request: Request):
    user = await _require_user(request)
    _assert_salon_scope(user, salon_id)
    res = await _db.marketing_segments.delete_one({"id": seg_id, "salon_id": salon_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Segment not found")
    return {"deleted": True, "id": seg_id}


# ================================================================
# M3 — Salon Coupons
# ================================================================

COUPON_TYPES = {"percent", "flat"}


class CouponIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    code: str = Field(..., min_length=2, max_length=30)
    title: str
    description: Optional[str] = None
    type: str = Field(..., description="percent | flat")
    value: float = Field(..., gt=0)
    min_bill_amount: Optional[float] = 0
    max_discount_amount: Optional[float] = None
    per_customer_limit: Optional[int] = 1
    total_cap: Optional[int] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    applicable_service_ids: Optional[List[str]] = None
    applicable_branch_ids: Optional[List[str]] = None
    stackable: Optional[bool] = False
    visibility: Optional[str] = Field(default="private", description="published | private")
    is_active: Optional[bool] = True

    @field_validator("type")
    @classmethod
    def _t(cls, v):
        if v not in COUPON_TYPES:
            raise ValueError("type must be 'percent' or 'flat'")
        return v

    @field_validator("visibility")
    @classmethod
    def _vis(cls, v):
        v = (v or "private").lower()
        if v not in ("published", "private"):
            raise ValueError("visibility must be 'published' or 'private'")
        return v


class CouponValidateIn(BaseModel):
    code: str
    customer_phone: Optional[str] = None
    bill_amount: float = Field(..., ge=0)
    service_ids: Optional[List[str]] = None
    branch_id: Optional[str] = None


def _coupon_active(c: Dict[str, Any]) -> bool:
    now = datetime.now(timezone.utc)
    if not c.get("is_active", True):
        return False
    try:
        if c.get("valid_from"):
            vf = datetime.fromisoformat(str(c["valid_from"]).replace("Z", "+00:00"))
            if now < vf:
                return False
        if c.get("valid_to"):
            vt = datetime.fromisoformat(str(c["valid_to"]).replace("Z", "+00:00"))
            if now > vt:
                return False
    except Exception:
        pass
    return True


async def _emit_socket(event: str, payload: Dict[str, Any]):
    """Best-effort socket.io broadcast if the server exposes a sio instance."""
    try:
        import server as _server  # type: ignore
        sio = getattr(_server, "sio", None)
        if sio is not None:
            await sio.emit(event, payload)
    except Exception:
        pass


@marketing_router.get("/salons/{salon_id}/coupons")
async def list_coupons(salon_id: str, request: Request):
    user = await _require_user(request)
    _assert_salon_scope(user, salon_id)
    out = []
    async for c in _db.salon_coupons.find({"salon_id": salon_id}).sort("created_at", -1):
        out.append(_clean(c))
    return {"coupons": out}


@marketing_router.post("/salons/{salon_id}/coupons")
async def create_coupon(salon_id: str, body: CouponIn, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    code = re.sub(r"\s+", "", body.code).upper()
    exists = await _db.salon_coupons.find_one({"salon_id": salon_id, "code": code})
    if exists:
        raise HTTPException(status_code=409, detail="Coupon code already exists for this salon")
    doc = body.model_dump()
    doc.update(
        {
            "id": str(uuid.uuid4()),
            "salon_id": salon_id,
            "code": code,
            "created_at": _now_iso(),
            "created_by": user.get("user_id"),
            "uses_count": 0,
        }
    )
    await _db.salon_coupons.insert_one(doc)
    await _emit_socket("salon_coupons_updated", {"salon_id": salon_id})
    return _clean(doc)


@marketing_router.get("/salons/{salon_id}/coupons/{coupon_id}")
async def get_coupon(salon_id: str, coupon_id: str, request: Request):
    user = await _require_user(request)
    _assert_salon_scope(user, salon_id)
    c = await _db.salon_coupons.find_one({"id": coupon_id, "salon_id": salon_id})
    if not c:
        raise HTTPException(status_code=404, detail="Coupon not found")
    return _clean(c)


@marketing_router.put("/salons/{salon_id}/coupons/{coupon_id}")
async def update_coupon(salon_id: str, coupon_id: str, body: CouponIn, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    upd = body.model_dump()
    upd["code"] = re.sub(r"\s+", "", body.code).upper()
    upd["updated_at"] = _now_iso()
    res = await _db.salon_coupons.update_one({"id": coupon_id, "salon_id": salon_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    doc = await _db.salon_coupons.find_one({"id": coupon_id})
    await _emit_socket("salon_coupons_updated", {"salon_id": salon_id})
    return _clean(doc)


@marketing_router.delete("/salons/{salon_id}/coupons/{coupon_id}")
async def delete_coupon(salon_id: str, coupon_id: str, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    res = await _db.salon_coupons.delete_one({"id": coupon_id, "salon_id": salon_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    await _emit_socket("salon_coupons_updated", {"salon_id": salon_id})
    return {"deleted": True, "id": coupon_id}


@marketing_router.post("/salons/{salon_id}/coupons/{coupon_id}/publish")
async def publish_coupon(salon_id: str, coupon_id: str, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    res = await _db.salon_coupons.update_one(
        {"id": coupon_id, "salon_id": salon_id}, {"$set": {"visibility": "published", "is_active": True, "updated_at": _now_iso()}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    await _emit_socket("salon_coupons_updated", {"salon_id": salon_id, "coupon_id": coupon_id, "action": "publish"})
    return {"ok": True, "id": coupon_id, "visibility": "published"}


@marketing_router.post("/salons/{salon_id}/coupons/{coupon_id}/unpublish")
async def unpublish_coupon(salon_id: str, coupon_id: str, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    res = await _db.salon_coupons.update_one(
        {"id": coupon_id, "salon_id": salon_id}, {"$set": {"visibility": "private", "updated_at": _now_iso()}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
    await _emit_socket("salon_coupons_updated", {"salon_id": salon_id, "coupon_id": coupon_id, "action": "unpublish"})
    return {"ok": True, "id": coupon_id, "visibility": "private"}


async def _compute_coupon_discount(coupon: Dict[str, Any], bill: float) -> float:
    if coupon.get("type") == "percent":
        d = bill * float(coupon.get("value") or 0) / 100.0
    else:
        d = float(coupon.get("value") or 0)
    max_cap = coupon.get("max_discount_amount")
    if max_cap is not None:
        d = min(d, float(max_cap))
    return max(0.0, round(min(d, bill), 2))


@marketing_router.post("/salons/{salon_id}/coupons/validate")
async def validate_coupon(salon_id: str, body: CouponValidateIn):
    """Public — no auth. Used at checkout by the customer app."""
    code = re.sub(r"\s+", "", body.code).upper()
    c = await _db.salon_coupons.find_one({"salon_id": salon_id, "code": code})
    if not c:
        raise HTTPException(status_code=404, detail="Invalid coupon code")
    if not _coupon_active(c):
        raise HTTPException(status_code=400, detail="Coupon expired or inactive")
    if body.bill_amount < float(c.get("min_bill_amount") or 0):
        raise HTTPException(status_code=400, detail=f"Minimum bill amount is ₹{c.get('min_bill_amount')}")
    # Total cap
    total_cap = c.get("total_cap")
    if total_cap is not None and int(c.get("uses_count") or 0) >= int(total_cap):
        raise HTTPException(status_code=400, detail="Coupon usage limit reached")
    # Per-customer limit
    if body.customer_phone and c.get("per_customer_limit"):
        phone = _normalize_phone(body.customer_phone)
        used = await _db.salon_coupon_redemptions.count_documents(
            {"coupon_id": c.get("id"), "customer_phone": phone}
        )
        if used >= int(c.get("per_customer_limit")):
            raise HTTPException(status_code=400, detail="You have already used this coupon the maximum number of times")
    # Service filter
    if c.get("applicable_service_ids"):
        if not body.service_ids or not any(sid in c["applicable_service_ids"] for sid in body.service_ids):
            raise HTTPException(status_code=400, detail="Coupon not applicable on selected services")
    # Branch filter
    if c.get("applicable_branch_ids") and body.branch_id:
        if body.branch_id not in c["applicable_branch_ids"]:
            raise HTTPException(status_code=400, detail="Coupon not applicable at selected branch")
    discount = await _compute_coupon_discount(c, float(body.bill_amount))
    return {
        "valid": True,
        "coupon": _clean(c),
        "discount_amount": discount,
        "final_amount": round(float(body.bill_amount) - discount, 2),
    }


@marketing_router.get("/public/salons/{salon_id}/coupons")
async def public_coupons(salon_id: str):
    now = datetime.now(timezone.utc).isoformat()
    q = {
        "salon_id": salon_id,
        "visibility": "published",
        "is_active": True,
        "$and": [
            {"$or": [{"valid_from": None}, {"valid_from": {"$exists": False}}, {"valid_from": {"$lte": now}}]},
            {"$or": [{"valid_to": None}, {"valid_to": {"$exists": False}}, {"valid_to": {"$gte": now}}]},
        ],
    }
    out = []
    async for c in _db.salon_coupons.find(q).sort("created_at", -1).limit(50):
        out.append(_clean(c))
    return {"coupons": out}


async def record_coupon_redemption(*, salon_id: str, coupon_id: str, customer_phone: Optional[str],
                                   booking_id: Optional[str], amount: float) -> None:
    """Called by server.py when a booking commits with a coupon."""
    doc = {
        "id": str(uuid.uuid4()),
        "salon_id": salon_id,
        "coupon_id": coupon_id,
        "customer_phone": _normalize_phone(customer_phone),
        "booking_id": booking_id,
        "amount": round(float(amount), 2),
        "redeemed_at": _now_iso(),
    }
    await _db.salon_coupon_redemptions.insert_one(doc)
    await _db.salon_coupons.update_one({"id": coupon_id}, {"$inc": {"uses_count": 1}})


# ================================================================
# M4 (skeleton) — Overview
# ================================================================


@marketing_router.get("/salons/{salon_id}/marketing/overview")
async def marketing_overview(
    salon_id: str,
    request: Request,
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
):
    user = await _require_user(request)
    _assert_salon_scope(user, salon_id)

    # Range defaults (last 30 days)
    now = datetime.now(timezone.utc)
    df = (
        datetime.fromisoformat(date_from.replace("Z", "+00:00"))
        if date_from
        else now - timedelta(days=30)
    )
    dt = datetime.fromisoformat(date_to.replace("Z", "+00:00")) if date_to else now

    # Messages + spend
    match_range = {"$gte": df.isoformat(), "$lte": dt.isoformat()}
    total_sent = await _db.marketing_messages.count_documents(
        {"salon_id": salon_id, "sent_at": match_range}
    )
    delivered = await _db.marketing_messages.count_documents(
        {"salon_id": salon_id, "delivered_at": match_range}
    )
    read = await _db.marketing_messages.count_documents(
        {"salon_id": salon_id, "read_at": match_range}
    )
    failed = await _db.marketing_messages.count_documents(
        {"salon_id": salon_id, "failed_at": match_range}
    )
    spend = 0.0
    async for m in _db.marketing_messages.find(
        {"salon_id": salon_id, "sent_at": match_range}, {"provider_cost": 1}
    ):
        spend += float(m.get("provider_cost") or 0)
    # Coupons
    redemptions = await _db.salon_coupon_redemptions.count_documents(
        {"salon_id": salon_id, "redeemed_at": match_range}
    )
    coupon_revenue = 0.0
    cursor = _db.salon_coupon_redemptions.find(
        {"salon_id": salon_id, "redeemed_at": match_range},
        {"amount": 1},
    )
    async for r in cursor:
        coupon_revenue += float(r.get("amount") or 0)
    # Campaign stats
    campaigns_run = await _db.marketing_campaigns.count_documents(
        {"salon_id": salon_id, "launched_at": match_range}
    )
    automations_active = await _db.marketing_automations.count_documents(
        {"salon_id": salon_id, "active": True}
    )

    return {
        "range": {"from": df.isoformat(), "to": dt.isoformat()},
        "messaging": {
            "sent": total_sent,
            "delivered": delivered,
            "read": read,
            "failed": failed,
            "spend_inr": round(spend, 2),
        },
        "conversion": {
            "coupon_redemptions": redemptions,
            "coupon_discount_amount": round(coupon_revenue, 2),
        },
        "campaigns_run": campaigns_run,
        "automations_active": automations_active,
    }


# ================================================================
# M2/M5 helper — templates library (skeleton)
# ================================================================


class TemplateIn(BaseModel):
    name: str
    category: Optional[str] = "utility"
    body: str
    variables: Optional[List[str]] = None
    lang_code: Optional[str] = "en_US"
    meta_status: Optional[str] = "draft"


@marketing_router.get("/salons/{salon_id}/marketing/templates")
async def list_templates(salon_id: str, request: Request):
    user = await _require_user(request)
    _assert_salon_scope(user, salon_id)
    out = []
    async for t in _db.marketing_templates.find({"salon_id": salon_id}).sort("created_at", -1):
        out.append(_clean(t))
    return {"templates": out}


@marketing_router.post("/salons/{salon_id}/marketing/templates")
async def create_template(salon_id: str, body: TemplateIn, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    doc = body.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "salon_id": salon_id,
        "created_at": _now_iso(),
        "created_by": user.get("user_id"),
    })
    await _db.marketing_templates.insert_one(doc)
    return _clean(doc)


@marketing_router.delete("/salons/{salon_id}/marketing/templates/{tid}")
async def delete_template(salon_id: str, tid: str, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    res = await _db.marketing_templates.delete_one({"id": tid, "salon_id": salon_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"deleted": True, "id": tid}


# ================================================================
# Marketing settings (budget guardrails)
# ================================================================


class MarketingSettingsIn(BaseModel):
    monthly_cap_inr: Optional[float] = 0
    freq_cap_per_customer_per_week: Optional[int] = 3
    quiet_hours_start: Optional[str] = "22:00"
    quiet_hours_end: Optional[str] = "09:00"
    spend_brake: Optional[bool] = False
    consent_required: Optional[bool] = True


@marketing_router.get("/salons/{salon_id}/marketing/settings")
async def get_marketing_settings(salon_id: str, request: Request):
    user = await _require_user(request)
    _assert_salon_scope(user, salon_id)
    doc = await _db.marketing_settings.find_one({"salon_id": salon_id})
    if not doc:
        return MarketingSettingsIn().model_dump() | {"salon_id": salon_id}
    return _clean(doc)


@marketing_router.put("/salons/{salon_id}/marketing/settings")
async def put_marketing_settings(salon_id: str, body: MarketingSettingsIn, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    upd = body.model_dump()
    upd["updated_at"] = _now_iso()
    await _db.marketing_settings.update_one(
        {"salon_id": salon_id}, {"$set": {**upd, "salon_id": salon_id}}, upsert=True
    )
    return {"salon_id": salon_id, **upd}


# ================================================================
# M5 — Campaigns (compose, send, schedule)
# ================================================================

import asyncio
import base64
import hmac as _hmac
import hashlib as _hashlib
import random

CAMPAIGN_STATUSES = {"draft", "scheduled", "running", "completed", "paused", "stopped", "failed"}

# Rough provider costs per message (INR) — used only for spend estimation.
# Real numbers come from webhook `pricing` field once wired; for now use a
# conservative default.
DEFAULT_MSG_COST = {"twilio": 0.60, "meta": 0.90}


class CampaignIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    segment_id: Optional[str] = None      # if None, sends to ad-hoc phones
    ad_hoc_phones: Optional[List[str]] = None
    template_body: str                     # rendered body (with {{name}} etc.)
    template_id: Optional[str] = None
    coupon_id: Optional[str] = None
    schedule_at: Optional[str] = None      # ISO datetime, if given → scheduled
    provider: Optional[str] = None         # override provider for this send


def _render(body: str, ctx: Dict[str, Any]) -> str:
    """Very small mustache-lite renderer — supports {{key}} substitutions only."""
    if not body:
        return ""
    out = body
    for k, v in (ctx or {}).items():
        out = out.replace("{{" + k + "}}", "" if v is None else str(v))
    return out


async def _send_one_campaign_message(
    *,
    salon_id: str,
    campaign_id: str,
    to_phone: str,
    body: str,
    provider: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Send a single message and record a marketing_messages row."""
    from whatsapp_service import send_whatsapp_message, get_active_provider

    active = (provider or get_active_provider()).lower()
    now = _now_iso()
    doc: Dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "campaign_id": campaign_id,
        "salon_id": salon_id,
        "to_phone": _normalize_phone(to_phone),
        "body": body,
        "provider": active,
        "status": "queued",
        "queued_at": now,
        "context": context or {},
    }
    await _db.marketing_messages.insert_one(doc)

    result = await send_whatsapp_message(to_phone, text=body, force_provider=active)
    upd: Dict[str, Any] = {"provider_result": result, "status": result.get("status", "failed")}
    if result.get("status") == "sent":
        upd["sent_at"] = _now_iso()
        upd["provider_cost"] = DEFAULT_MSG_COST.get(active, 0.60)
        if result.get("message_id"):
            upd["provider_message_id"] = result["message_id"]
    elif result.get("status") == "mock":
        upd["sent_at"] = _now_iso()
        upd["provider_cost"] = 0
        upd["mock"] = True
    else:
        upd["failed_at"] = _now_iso()
        upd["error"] = str(result.get("error") or result.get("reason") or "unknown")

    await _db.marketing_messages.update_one({"id": doc["id"]}, {"$set": upd})
    return {"id": doc["id"], "status": upd["status"], "provider": active, "cost": upd.get("provider_cost", 0)}


async def _resolve_campaign_recipients(salon_id: str, campaign: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return [{phone, name, ...}, ...] for either a segment or the ad-hoc list."""
    seg_id = campaign.get("segment_id")
    recipients: List[Dict[str, Any]] = []
    if seg_id:
        seg = await _db.marketing_segments.find_one({"id": seg_id, "salon_id": salon_id})
        if not seg:
            return []
        rules_dict = seg.get("rules") or {"logic": "AND", "conditions": []}
        rules = SegmentRules(**rules_dict)
        recipients = await _evaluate_segment(salon_id, rules)
    else:
        phones = campaign.get("ad_hoc_phones") or []
        for p in phones:
            n = _normalize_phone(p)
            if not n:
                continue
            u = await _db.users.find_one({"phone": n})
            recipients.append({"phone": n, "name": (u or {}).get("name")})
    return recipients


async def _run_campaign(salon_id: str, campaign_id: str) -> None:
    """Background task — send all messages for a campaign."""
    campaign = await _db.marketing_campaigns.find_one({"id": campaign_id, "salon_id": salon_id})
    if not campaign:
        return
    if campaign.get("status") not in ("running", "scheduled"):
        return
    await _db.marketing_campaigns.update_one(
        {"id": campaign_id},
        {"$set": {"status": "running", "launched_at": _now_iso()}},
    )

    body_tpl = campaign.get("template_body") or ""
    coupon = None
    if campaign.get("coupon_id"):
        coupon = await _db.salon_coupons.find_one({"id": campaign["coupon_id"], "salon_id": salon_id})

    recipients = await _resolve_campaign_recipients(salon_id, campaign)
    stats = {"sent": 0, "failed": 0, "delivered": 0, "read": 0}
    for r in recipients:
        # Re-check status — allow pause/stop
        c = await _db.marketing_campaigns.find_one({"id": campaign_id}, {"status": 1})
        if not c or c.get("status") in ("paused", "stopped"):
            break
        ctx = {
            "name": (r.get("name") or "").split(" ")[0] or "there",
            "coupon_code": (coupon or {}).get("code", ""),
            "coupon_title": (coupon or {}).get("title", ""),
            "coupon_value": str((coupon or {}).get("value", "")),
        }
        body = _render(body_tpl, ctx)
        result = await _send_one_campaign_message(
            salon_id=salon_id,
            campaign_id=campaign_id,
            to_phone=r["phone"],
            body=body,
            provider=campaign.get("provider"),
            context=ctx,
        )
        if result["status"] in ("sent", "mock"):
            stats["sent"] += 1
        else:
            stats["failed"] += 1
        # Small yield to avoid hammering the provider
        await asyncio.sleep(0.05)

    final_status = "completed"
    c = await _db.marketing_campaigns.find_one({"id": campaign_id}, {"status": 1})
    if c and c.get("status") == "stopped":
        final_status = "stopped"
    elif c and c.get("status") == "paused":
        final_status = "paused"
    await _db.marketing_campaigns.update_one(
        {"id": campaign_id},
        {"$set": {"status": final_status, "stats": stats, "completed_at": _now_iso()}},
    )


@marketing_router.get("/salons/{salon_id}/marketing/campaigns")
async def list_campaigns(salon_id: str, request: Request):
    user = await _require_user(request)
    _assert_salon_scope(user, salon_id)
    out = []
    async for c in _db.marketing_campaigns.find({"salon_id": salon_id}).sort("created_at", -1):
        out.append(_clean(c))
    return {"campaigns": out}


@marketing_router.post("/salons/{salon_id}/marketing/campaigns")
async def create_campaign(salon_id: str, body: CampaignIn, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    doc = body.model_dump()
    is_scheduled = bool(doc.get("schedule_at"))
    doc.update({
        "id": str(uuid.uuid4()),
        "salon_id": salon_id,
        "status": "scheduled" if is_scheduled else "draft",
        "created_at": _now_iso(),
        "created_by": user.get("user_id"),
        "stats": {"sent": 0, "failed": 0, "delivered": 0, "read": 0},
    })
    await _db.marketing_campaigns.insert_one(doc)
    return _clean(doc)


@marketing_router.get("/salons/{salon_id}/marketing/campaigns/{cid}")
async def get_campaign(salon_id: str, cid: str, request: Request):
    user = await _require_user(request)
    _assert_salon_scope(user, salon_id)
    c = await _db.marketing_campaigns.find_one({"id": cid, "salon_id": salon_id})
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return _clean(c)


@marketing_router.put("/salons/{salon_id}/marketing/campaigns/{cid}")
async def update_campaign(salon_id: str, cid: str, body: CampaignIn, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    upd = body.model_dump()
    upd["updated_at"] = _now_iso()
    res = await _db.marketing_campaigns.update_one({"id": cid, "salon_id": salon_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    c = await _db.marketing_campaigns.find_one({"id": cid})
    return _clean(c)


@marketing_router.delete("/salons/{salon_id}/marketing/campaigns/{cid}")
async def delete_campaign(salon_id: str, cid: str, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    c = await _db.marketing_campaigns.find_one({"id": cid, "salon_id": salon_id}, {"status": 1})
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if c.get("status") == "running":
        raise HTTPException(status_code=400, detail="Cannot delete a running campaign; stop it first")
    await _db.marketing_campaigns.delete_one({"id": cid, "salon_id": salon_id})
    return {"deleted": True, "id": cid}


class CampaignPreviewIn(BaseModel):
    segment_id: Optional[str] = None
    ad_hoc_phones: Optional[List[str]] = None


@marketing_router.post("/salons/{salon_id}/marketing/campaigns/preview-audience")
async def preview_campaign_audience(salon_id: str, body: CampaignPreviewIn, request: Request):
    user = await _require_user(request)
    _assert_salon_scope(user, salon_id)
    dummy_campaign = body.model_dump()
    recipients = await _resolve_campaign_recipients(salon_id, dummy_campaign)
    est_cost = round(len(recipients) * DEFAULT_MSG_COST.get("twilio", 0.60), 2)
    return {"count": len(recipients), "estimated_spend_inr": est_cost, "sample": recipients[:20]}


@marketing_router.post("/salons/{salon_id}/marketing/campaigns/{cid}/launch")
async def launch_campaign(salon_id: str, cid: str, request: Request):
    """Send immediately in the background."""
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    c = await _db.marketing_campaigns.find_one({"id": cid, "salon_id": salon_id})
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if c.get("status") in ("running", "completed"):
        raise HTTPException(status_code=400, detail=f"Campaign is already {c['status']}")
    await _db.marketing_campaigns.update_one(
        {"id": cid}, {"$set": {"status": "running", "launched_at": _now_iso()}}
    )
    asyncio.create_task(_run_campaign(salon_id, cid))
    return {"ok": True, "id": cid, "status": "running"}


@marketing_router.post("/salons/{salon_id}/marketing/campaigns/{cid}/pause")
async def pause_campaign(salon_id: str, cid: str, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    res = await _db.marketing_campaigns.update_one(
        {"id": cid, "salon_id": salon_id, "status": {"$in": ["running", "scheduled"]}},
        {"$set": {"status": "paused", "paused_at": _now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=400, detail="Campaign cannot be paused in its current state")
    return {"ok": True, "id": cid, "status": "paused"}


@marketing_router.post("/salons/{salon_id}/marketing/campaigns/{cid}/resume")
async def resume_campaign(salon_id: str, cid: str, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    c = await _db.marketing_campaigns.find_one(
        {"id": cid, "salon_id": salon_id, "status": "paused"}
    )
    if not c:
        raise HTTPException(status_code=400, detail="Campaign is not paused")
    await _db.marketing_campaigns.update_one(
        {"id": cid}, {"$set": {"status": "running"}}
    )
    asyncio.create_task(_run_campaign(salon_id, cid))
    return {"ok": True, "id": cid, "status": "running"}


@marketing_router.post("/salons/{salon_id}/marketing/campaigns/{cid}/stop")
async def stop_campaign(salon_id: str, cid: str, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    res = await _db.marketing_campaigns.update_one(
        {"id": cid, "salon_id": salon_id, "status": {"$in": ["running", "paused", "scheduled"]}},
        {"$set": {"status": "stopped", "stopped_at": _now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=400, detail="Campaign cannot be stopped in its current state")
    return {"ok": True, "id": cid, "status": "stopped"}


@marketing_router.get("/salons/{salon_id}/marketing/campaigns/{cid}/messages")
async def campaign_messages(salon_id: str, cid: str, request: Request, limit: int = Query(default=100, le=500)):
    user = await _require_user(request)
    _assert_salon_scope(user, salon_id)
    out = []
    cursor = _db.marketing_messages.find({"salon_id": salon_id, "campaign_id": cid}).sort("queued_at", -1).limit(limit)
    async for m in cursor:
        out.append(_clean(m))
    return {"messages": out}


# ================================================================
# M6 — Automations (birthday / anniversary / spouse-b'day / win-back / reminders)
# ================================================================

AUTOMATION_TYPES = {"birthday", "wedding_anniversary", "spouse_birthday", "win_back", "reminder"}


class AutomationIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    type: str
    active: bool = True
    template_body: str
    coupon_id: Optional[str] = None
    threshold_days: Optional[int] = None       # for win_back (last visit ≥ N days)
    offset_days: Optional[int] = None          # for reminder (send N days before/after)
    provider: Optional[str] = None

    @field_validator("type")
    @classmethod
    def _t(cls, v):
        if v not in AUTOMATION_TYPES:
            raise ValueError("Unsupported automation type")
        return v


@marketing_router.get("/salons/{salon_id}/marketing/automations")
async def list_automations(salon_id: str, request: Request):
    user = await _require_user(request)
    _assert_salon_scope(user, salon_id)
    out = []
    async for a in _db.marketing_automations.find({"salon_id": salon_id}).sort("created_at", -1):
        out.append(_clean(a))
    return {"automations": out}


@marketing_router.post("/salons/{salon_id}/marketing/automations")
async def create_automation(salon_id: str, body: AutomationIn, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    doc = body.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "salon_id": salon_id,
        "created_at": _now_iso(),
        "created_by": user.get("user_id"),
        "last_run_at": None,
        "last_run_sent": 0,
    })
    await _db.marketing_automations.insert_one(doc)
    return _clean(doc)


@marketing_router.put("/salons/{salon_id}/marketing/automations/{aid}")
async def update_automation(salon_id: str, aid: str, body: AutomationIn, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    res = await _db.marketing_automations.update_one(
        {"id": aid, "salon_id": salon_id}, {"$set": {**body.model_dump(), "updated_at": _now_iso()}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Automation not found")
    a = await _db.marketing_automations.find_one({"id": aid})
    return _clean(a)


@marketing_router.delete("/salons/{salon_id}/marketing/automations/{aid}")
async def delete_automation(salon_id: str, aid: str, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    res = await _db.marketing_automations.delete_one({"id": aid, "salon_id": salon_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Automation not found")
    return {"deleted": True, "id": aid}


@marketing_router.post("/salons/{salon_id}/marketing/automations/{aid}/run-now")
async def run_automation_now(salon_id: str, aid: str, request: Request):
    """Manually trigger an automation (useful for testing)."""
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    n = await _run_automation(salon_id, aid)
    return {"ok": True, "id": aid, "sent": n}


async def _run_automation(salon_id: str, aid: str) -> int:
    autom = await _db.marketing_automations.find_one({"id": aid, "salon_id": salon_id})
    if not autom or not autom.get("active"):
        return 0
    today = datetime.now(timezone.utc)
    tm = today.month
    td = today.day
    atype = autom.get("type")
    coupon = None
    if autom.get("coupon_id"):
        coupon = await _db.salon_coupons.find_one({"id": autom["coupon_id"], "salon_id": salon_id})

    # 1) Resolve target customers
    customers = await _resolve_customers_for_salon(salon_id)
    targets: List[Dict[str, Any]] = []
    for c in customers:
        dob = c.get("dob") or ""
        wa = c.get("wedding_anniversary") or ""
        sd = c.get("spouse_date_of_birth") or ""
        pick = False
        if atype == "birthday" and dob[5:10] == f"{tm:02d}-{td:02d}":
            pick = True
        elif atype == "wedding_anniversary" and wa[5:10] == f"{tm:02d}-{td:02d}":
            pick = True
        elif atype == "spouse_birthday" and sd[5:10] == f"{tm:02d}-{td:02d}":
            pick = True
        elif atype == "win_back":
            thr = int(autom.get("threshold_days") or 90)
            stats = await _compute_stats(salon_id, c.get("phone"))
            lv = stats.get("last_visit_days")
            if lv is not None and lv >= thr:
                pick = True
        elif atype == "reminder":
            # Reminder: bookings scheduled today at this salon (offset_days=0 default)
            offset = int(autom.get("offset_days") or 0)
            target_date = (today + timedelta(days=offset)).strftime("%Y-%m-%d")
            has_booking = await _db.tokens.count_documents({
                "salon_id": salon_id,
                "user_phone": c.get("phone"),
                "date": target_date,
                "status": {"$nin": ["cancelled", "completed"]},
            })
            if has_booking:
                pick = True
        if pick:
            targets.append(c)

    # 2) Send messages
    body_tpl = autom.get("template_body") or ""
    sent = 0
    for c in targets:
        # Frequency cap — 24h dedup for automations of this type
        one_day_ago = (today - timedelta(hours=20)).isoformat()
        recent = await _db.marketing_messages.count_documents({
            "salon_id": salon_id,
            "to_phone": _normalize_phone(c.get("phone")),
            "context.automation_type": atype,
            "sent_at": {"$gte": one_day_ago},
        })
        if recent:
            continue
        ctx = {
            "name": (c.get("name") or "").split(" ")[0] or "there",
            "spouse_name": c.get("spouse_name") or "",
            "coupon_code": (coupon or {}).get("code", ""),
            "coupon_title": (coupon or {}).get("title", ""),
            "automation_type": atype,
        }
        result = await _send_one_campaign_message(
            salon_id=salon_id,
            campaign_id=f"auto:{aid}",
            to_phone=c.get("phone"),
            body=_render(body_tpl, ctx),
            provider=autom.get("provider"),
            context=ctx,
        )
        if result["status"] in ("sent", "mock"):
            sent += 1
        await asyncio.sleep(0.05)

    await _db.marketing_automations.update_one(
        {"id": aid}, {"$set": {"last_run_at": _now_iso(), "last_run_sent": sent}}
    )
    return sent


async def _run_all_automations_daily():
    """Called by APScheduler once a day — iterates every active automation."""
    try:
        cursor = _db.marketing_automations.find({"active": True})
        async for autom in cursor:
            try:
                await _run_automation(autom["salon_id"], autom["id"])
            except Exception as ex:
                logger.error(f"[Marketing] automation {autom.get('id')} failed: {ex}")
    except Exception as e:
        logger.error(f"[Marketing] daily automation sweep failed: {e}")


async def _run_scheduled_campaigns():
    """Called every 5 minutes — pick up campaigns whose schedule_at has passed."""
    now_iso = _now_iso()
    cursor = _db.marketing_campaigns.find({
        "status": "scheduled",
        "schedule_at": {"$lte": now_iso},
    })
    async for c in cursor:
        try:
            asyncio.create_task(_run_campaign(c["salon_id"], c["id"]))
        except Exception as ex:
            logger.error(f"[Marketing] scheduled campaign kickoff failed: {ex}")


def register_marketing_jobs(scheduler):
    """Called from server.py after scheduler is created."""
    # Daily at 09:00 UTC (~ 14:30 IST)
    scheduler.add_job(_run_all_automations_daily, "cron", hour=9, minute=0, id="marketing.automations.daily")
    # Every 5 minutes for scheduled campaigns
    scheduler.add_job(_run_scheduled_campaigns, "interval", minutes=5, id="marketing.campaigns.scheduled")


# ================================================================
# M7 — Rewards (scratch card & spin wheel)
# ================================================================

REWARD_TYPES = {"scratch", "spin"}
PRIZE_TYPES = {"wallet_credit", "loyalty_points", "coupon", "free_addon", "better_luck"}


class RewardPrize(BaseModel):
    label: str
    weight: float = Field(default=1.0, ge=0)
    prize_type: str
    prize_value: Optional[float] = None
    coupon_code: Optional[str] = None
    note: Optional[str] = None

    @field_validator("prize_type")
    @classmethod
    def _p(cls, v):
        if v not in PRIZE_TYPES:
            raise ValueError("Unsupported prize_type")
        return v


class RewardIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    type: str
    name: str
    active: bool = True
    prize_table: List[RewardPrize]
    max_plays_per_day_per_customer: Optional[int] = 1
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None

    @field_validator("type")
    @classmethod
    def _t(cls, v):
        if v not in REWARD_TYPES:
            raise ValueError("type must be 'scratch' or 'spin'")
        return v


def _play_signing_key() -> bytes:
    return (os.environ.get("JWT_SECRET_KEY") or "salonhub-reward-signer").encode("utf-8")


def _make_play_token(payload: Dict[str, Any]) -> str:
    body = base64.urlsafe_b64encode(
        (str(payload).encode("utf-8"))  # deterministic-ish; we only trust the signature
    ).decode("ascii").rstrip("=")
    sig = _hmac.new(_play_signing_key(), body.encode("ascii"), _hashlib.sha256).hexdigest()[:24]
    return f"{body}.{sig}"


def _verify_play_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        body, sig = token.split(".", 1)
        expected = _hmac.new(_play_signing_key(), body.encode("ascii"), _hashlib.sha256).hexdigest()[:24]
        if not _hmac.compare_digest(sig, expected):
            return None
        raw = base64.urlsafe_b64decode(body + "===").decode("utf-8")
        import ast
        return ast.literal_eval(raw)
    except Exception:
        return None


@marketing_router.get("/salons/{salon_id}/marketing/rewards")
async def list_rewards(salon_id: str, request: Request):
    user = await _require_user(request)
    _assert_salon_scope(user, salon_id)
    out = []
    async for r in _db.reward_configs.find({"salon_id": salon_id}).sort("created_at", -1):
        out.append(_clean(r))
    return {"rewards": out}


@marketing_router.post("/salons/{salon_id}/marketing/rewards")
async def create_reward(salon_id: str, body: RewardIn, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    doc = body.model_dump()
    doc.update({
        "id": str(uuid.uuid4()),
        "salon_id": salon_id,
        "created_at": _now_iso(),
        "created_by": user.get("user_id"),
    })
    await _db.reward_configs.insert_one(doc)
    return _clean(doc)


@marketing_router.put("/salons/{salon_id}/marketing/rewards/{rid}")
async def update_reward(salon_id: str, rid: str, body: RewardIn, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    res = await _db.reward_configs.update_one(
        {"id": rid, "salon_id": salon_id}, {"$set": {**body.model_dump(), "updated_at": _now_iso()}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reward not found")
    r = await _db.reward_configs.find_one({"id": rid})
    return _clean(r)


@marketing_router.delete("/salons/{salon_id}/marketing/rewards/{rid}")
async def delete_reward(salon_id: str, rid: str, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    res = await _db.reward_configs.delete_one({"id": rid, "salon_id": salon_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reward not found")
    return {"deleted": True, "id": rid}


class RewardIssueIn(BaseModel):
    customer_phone: str
    reward_id: Optional[str] = None
    booking_id: Optional[str] = None


async def issue_reward_play(*, salon_id: str, customer_phone: str,
                             reward_id: Optional[str] = None,
                             booking_id: Optional[str] = None) -> Optional[str]:
    """Called (a) manually via the /issue endpoint or (b) automatically from an
    invoice hook in server.py. Returns a play URL or None if nothing to issue."""
    reward = None
    if reward_id:
        reward = await _db.reward_configs.find_one({"id": reward_id, "salon_id": salon_id, "active": True})
    else:
        reward = await _db.reward_configs.find_one({"salon_id": salon_id, "active": True})
    if not reward:
        return None
    # Anti-abuse: per-day cap
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cap = int(reward.get("max_plays_per_day_per_customer") or 1)
    used = await _db.reward_plays.count_documents({
        "salon_id": salon_id,
        "reward_id": reward["id"],
        "customer_phone": _normalize_phone(customer_phone),
        "issued_date": today,
    })
    if used >= cap:
        return None
    play = {
        "id": str(uuid.uuid4()),
        "salon_id": salon_id,
        "reward_id": reward["id"],
        "customer_phone": _normalize_phone(customer_phone),
        "booking_id": booking_id,
        "status": "issued",
        "issued_at": _now_iso(),
        "issued_date": today,
    }
    await _db.reward_plays.insert_one(play)
    token = _make_play_token({"pid": play["id"], "sid": salon_id, "rid": reward["id"]})
    backend_url = os.environ.get("APP_URL") or os.environ.get("BACKEND_PUBLIC_URL") or ""
    return f"{backend_url.rstrip('/')}/api/public/rewards/play/{token}" if backend_url else f"/api/public/rewards/play/{token}"


@marketing_router.post("/salons/{salon_id}/marketing/rewards/{rid}/issue")
async def issue_reward_endpoint(salon_id: str, rid: str, body: RewardIssueIn, request: Request):
    user = await _require_admin(request)
    _assert_salon_scope(user, salon_id)
    url = await issue_reward_play(
        salon_id=salon_id,
        customer_phone=body.customer_phone,
        reward_id=rid,
        booking_id=body.booking_id,
    )
    if not url:
        raise HTTPException(status_code=400, detail="No eligible reward to issue (inactive / cap reached)")
    return {"ok": True, "play_url": url}


def _pick_prize(prize_table: List[Dict[str, Any]]) -> Dict[str, Any]:
    total = sum(float(p.get("weight") or 0) for p in prize_table) or 1.0
    r = random.random() * total
    acc = 0.0
    for p in prize_table:
        acc += float(p.get("weight") or 0)
        if r <= acc:
            return p
    return prize_table[-1]


@marketing_router.get("/public/rewards/play/{token}")
async def get_reward_play(token: str):
    payload = _verify_play_token(token)
    if not payload:
        raise HTTPException(status_code=400, detail="Invalid or expired reward link")
    play = await _db.reward_plays.find_one({"id": payload.get("pid")})
    if not play:
        raise HTTPException(status_code=404, detail="Reward not found")
    reward = await _db.reward_configs.find_one({"id": play.get("reward_id")})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward config missing")
    return {
        "play": _clean(play),
        "reward": {"id": reward["id"], "name": reward.get("name"), "type": reward.get("type")},
        "already_played": play.get("status") == "played",
        "prize": play.get("prize") if play.get("status") == "played" else None,
    }


@marketing_router.post("/public/rewards/play/{token}/spin")
async def spin_reward(token: str):
    payload = _verify_play_token(token)
    if not payload:
        raise HTTPException(status_code=400, detail="Invalid or expired reward link")
    play = await _db.reward_plays.find_one({"id": payload.get("pid")})
    if not play:
        raise HTTPException(status_code=404, detail="Reward not found")
    if play.get("status") == "played":
        return {"already_played": True, "prize": play.get("prize")}
    reward = await _db.reward_configs.find_one({"id": play.get("reward_id")})
    if not reward or not reward.get("active"):
        raise HTTPException(status_code=400, detail="Reward is inactive")
    prize = _pick_prize(reward.get("prize_table") or [])
    now = _now_iso()
    await _db.reward_plays.update_one(
        {"id": play["id"]},
        {"$set": {"status": "played", "prize": prize, "played_at": now}},
    )
    # Apply prize side-effects
    try:
        salon_id = play.get("salon_id")
        phone = play.get("customer_phone")
        if prize.get("prize_type") == "wallet_credit" and salon_id and phone:
            amount = float(prize.get("prize_value") or 0)
            if amount > 0:
                await _db.customer_memberships.update_one(
                    {"salon_id": salon_id, "customer_phone": phone},
                    {"$inc": {"balance": amount}},
                )
                await _db.wallet_transactions.insert_one({
                    "id": str(uuid.uuid4()),
                    "salon_id": salon_id,
                    "customer_phone": phone,
                    "amount": amount,
                    "type": "credit",
                    "note": f"Reward — {prize.get('label')}",
                    "created_at": now,
                })
        elif prize.get("prize_type") == "loyalty_points" and salon_id and phone:
            pts = int(prize.get("prize_value") or 0)
            if pts > 0:
                await _db.loyalty_wallets.update_one(
                    {"salon_id": salon_id, "customer_phone": phone},
                    {"$inc": {"points": pts}},
                    upsert=True,
                )
    except Exception as e:
        logger.warning(f"[Reward] side-effect failed: {e}")
    return {"prize": prize, "played_at": now}

