"""
Phase 15/16/17 — Customer in-salon Shop.

Lets a customer of a salon (identified by phone) browse the salon's own
sellable inventory PLUS its membership plans as a unified product
catalog, place an order, and the salon admin fulfils it (single-step).

On fulfilment we:
  - decrement qty_total + qty_reserved_for_customer_orders on each line
  - log a `sale_to_customer` movement
  - write a financial_transactions row (inflow / product_sale)
      reference_type = "customer_order"   reference_id = order.id
      staff_id = order.staff_id (may be None)
      exclude_from_incentive = True   (per PRD B7-D)
  - for membership lines, create a `customer_memberships` doc and credit
    the customer wallet exactly the way the salon's own membership
    purchase endpoint does.

Payment modes mirror in-salon booking: cash, upi, wallet, pay_at_salon,
card, other.  We do NOT charge online via Cashfree — the salon collects
payment when the order is handed over.

Endpoints
---------
Customer-side (PUBLIC, no auth — phone identifies):
    GET    /api/customer/salon/{salon_id}/shop/products
    GET    /api/customer/salon/{salon_id}/shop/products/{item_id}
    POST   /api/customer/salon/{salon_id}/shop/notify-me
    POST   /api/customer/salon/{salon_id}/shop/checkout
    GET    /api/customer/shop/orders
    GET    /api/customer/shop/orders/{order_id}
    POST   /api/customer/shop/orders/{order_id}/cancel

Salon-side (Depends salon user):
    GET    /api/salon/customer-orders
    GET    /api/salon/customer-orders/{order_id}
    PUT    /api/salon/customer-orders/{order_id}/items   (partial fulfilment)
    POST   /api/salon/customer-orders/{order_id}/fulfill
    POST   /api/salon/customer-orders/{order_id}/cancel  body: {refund_mode, refund_note}
    POST   /api/salon/customer-orders/{order_id}/complete-refund   (later refund)
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)

# ----- injected by server.py -----
_db = None
_get_current_salon_user = None
_create_in_app_notification = None
_resolve_branch_id = None
_send_low_stock_alert = None  # set by salon_inventory bridge

customer_shop_router = APIRouter(tags=["customer-shop"])
_bearer = HTTPBearer(auto_error=False)

VALID_PAYMENT_MODES = {"cash", "upi", "wallet", "card", "pay_at_salon", "other"}
VALID_REFUND_MODES = {"wallet", "cash", "upi", "bank", "refund_later"}
ITEM_TYPES = {"product", "membership"}

ORDER_STATUSES = {
    "placed",          # customer just placed, awaiting salon
    "fulfilled",       # salon handed over goods + payment captured
    "cancelled",       # cancelled (by customer or salon), reservations released
    "refund_pending",  # cancelled but refund_later — salon still owes
    "refunded",        # refund completed
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _normalise_phone(phone: str) -> str:
    p = (phone or "").strip()
    if not p:
        return p
    if not p.startswith("+91"):
        if p.startswith("91") and len(p) == 12:
            p = "+" + p
        else:
            p = "+91" + p.lstrip("0")
    return p


def init_customer_shop_router(*, db, get_current_salon_user, create_in_app_notification,
                              resolve_branch_id, send_low_stock_alert=None):
    global _db, _get_current_salon_user, _create_in_app_notification, _resolve_branch_id, _send_low_stock_alert
    _db = db
    _get_current_salon_user = get_current_salon_user
    _create_in_app_notification = create_in_app_notification
    _resolve_branch_id = resolve_branch_id
    _send_low_stock_alert = send_low_stock_alert


async def _salon_auth(credentials: HTTPAuthorizationCredentials = Depends(_bearer)):
    if _get_current_salon_user is None:
        raise HTTPException(status_code=500, detail="customer_shop_not_initialised")
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return await _get_current_salon_user(credentials)


# ===================== Models =====================

class CartLineIn(BaseModel):
    item_id: str = Field(..., min_length=1)
    qty: int = Field(..., ge=1)
    item_type: str = Field(default="product")

    @field_validator("item_type")
    @classmethod
    def _v_t(cls, v):
        if v not in ITEM_TYPES:
            raise ValueError(f"item_type must be one of {ITEM_TYPES}")
        return v


class CheckoutPayload(BaseModel):
    customer_phone: str = Field(..., min_length=10)
    customer_name: str = Field(default="", max_length=120)
    items: List[CartLineIn]
    payment_mode: str = Field(default="pay_at_salon")
    branch_id: Optional[str] = None
    note: Optional[str] = Field(default=None, max_length=500)

    @field_validator("payment_mode")
    @classmethod
    def _v_pm(cls, v):
        if v not in VALID_PAYMENT_MODES:
            raise ValueError(f"payment_mode must be one of {VALID_PAYMENT_MODES}")
        return v


class NotifyMeCustomerPayload(BaseModel):
    customer_phone: str = Field(..., min_length=10)
    item_id: str
    item_type: str = Field(default="product")


class EditItemsPayload(BaseModel):
    """Partial fulfilment: salon edits line quantities BEFORE marking fulfilled."""
    items: List[CartLineIn]
    note: Optional[str] = Field(default=None, max_length=500)


class FulfillPayload(BaseModel):
    note: Optional[str] = Field(default=None, max_length=500)
    staff_id: Optional[str] = None
    payment_mode: Optional[str] = None  # salon may override at fulfilment

    @field_validator("payment_mode")
    @classmethod
    def _v_pm(cls, v):
        if v is None:
            return v
        if v not in VALID_PAYMENT_MODES:
            raise ValueError(f"payment_mode must be one of {VALID_PAYMENT_MODES}")
        return v


class CancelPayload(BaseModel):
    refund_mode: Optional[str] = None
    refund_note: Optional[str] = Field(default=None, max_length=500)

    @field_validator("refund_mode")
    @classmethod
    def _v_rm(cls, v):
        if v is None:
            return v
        if v not in VALID_REFUND_MODES:
            raise ValueError(f"refund_mode must be one of {VALID_REFUND_MODES}")
        return v


class CompleteRefundPayload(BaseModel):
    refund_mode: str

    @field_validator("refund_mode")
    @classmethod
    def _v_rm(cls, v):
        if v not in {"wallet", "cash", "upi", "bank"}:
            raise ValueError("refund_mode must be wallet/cash/upi/bank")
        return v


# ===================== Helpers =====================

def _strip(o: dict) -> dict:
    o.pop("_id", None)
    return o


async def _get_membership_plan(plan_id: str, salon_id: str) -> Optional[dict]:
    return await _db.membership_plans.find_one(
        {"id": plan_id, "salon_id": salon_id, "is_active": True},
        {"_id": 0},
    )


async def _get_inventory_item(item_id: str, salon_id: str) -> Optional[dict]:
    return await _db.salon_inventory.find_one(
        {"id": item_id, "salon_id": salon_id, "is_deleted": {"$ne": True}},
        {"_id": 0},
    )


def _line_price_for_product(item: dict, qty: int) -> dict:
    """Return {unit_price, line_subtotal, line_gst, line_total}."""
    selling = float(item.get("selling_price") or 0)
    discount_pct = float(item.get("discount") or 0)
    gst_pct = float(item.get("gst_percent") or 0)
    unit = round(selling * (1 - discount_pct / 100.0), 2)
    sub = round(unit * qty, 2)
    gst = round(sub * gst_pct / 100.0, 2)
    return {
        "unit_price": unit,
        "line_subtotal": sub,
        "line_gst": gst,
        "line_total": round(sub + gst, 2),
        "gst_percent": gst_pct,
        "discount_percent": discount_pct,
    }


def _line_price_for_membership(plan: dict, qty: int) -> dict:
    unit = float(plan.get("amount") or 0)
    sub = round(unit * qty, 2)
    return {
        "unit_price": unit,
        "line_subtotal": sub,
        "line_gst": 0.0,
        "line_total": sub,
        "gst_percent": 0.0,
        "discount_percent": 0.0,
    }


async def _reserve_for_customer(items: List[CartLineIn], salon_id: str) -> List[dict]:
    """Atomically reserve qty for product lines; pass-through for membership lines.

    Returns resolved snapshots. On any failure rolls back & raises 409.
    """
    resolved: list = []
    reserved: list = []  # [(item_id, qty)] for rollback
    try:
        for line in items:
            if line.item_type == "membership":
                plan = await _get_membership_plan(line.item_id, salon_id)
                if not plan:
                    raise HTTPException(status_code=404, detail=f"Membership plan {line.item_id} not found")
                resolved.append({"type": "membership", "doc": plan})
                continue

            # product → atomic reserve
            updated = await _db.salon_inventory.find_one_and_update(
                {
                    "id": line.item_id,
                    "salon_id": salon_id,
                    "is_deleted": {"$ne": True},
                    "availability": {"$in": ["both", "sale_only"]},
                    "$expr": {
                        "$gte": [
                            {"$subtract": [
                                {"$ifNull": ["$qty_total", 0]},
                                {"$add": [
                                    {"$ifNull": ["$qty_reserved_for_internal", 0]},
                                    {"$ifNull": ["$qty_reserved_for_customer_orders", 0]},
                                ]},
                            ]},
                            line.qty,
                        ]
                    },
                },
                {
                    "$inc": {"qty_reserved_for_customer_orders": line.qty},
                    "$set": {"updated_at": _now_iso()},
                },
                return_document=True,
                projection={"_id": 0},
            )
            if not updated:
                # diagnostic check — was it not found vs not enough stock?
                exists = await _get_inventory_item(line.item_id, salon_id)
                if not exists:
                    raise HTTPException(status_code=404, detail=f"Product {line.item_id} not found")
                if exists.get("availability") == "internal_only":
                    raise HTTPException(status_code=409, detail=f"Product {exists.get('name')} not available for customer sale")
                tot = int(exists.get("qty_total") or 0)
                ri = int(exists.get("qty_reserved_for_internal") or 0)
                rc = int(exists.get("qty_reserved_for_customer_orders") or 0)
                avail = max(0, tot - ri - rc)
                raise HTTPException(status_code=409, detail=f"Only {avail} units of '{exists.get('name')}' available")
            reserved.append((line.item_id, line.qty))
            resolved.append({"type": "product", "doc": updated})
        return resolved
    except Exception:
        # rollback
        for iid, q in reserved:
            try:
                await _db.salon_inventory.update_one(
                    {"id": iid, "salon_id": salon_id},
                    {"$inc": {"qty_reserved_for_customer_orders": -q},
                     "$set": {"updated_at": _now_iso()}},
                )
            except Exception as e:
                logger.error(f"[customer_shop] rollback failed for {iid}: {e}")
        raise


async def _release_reservations(order: dict) -> None:
    salon_id = order["salon_id"]
    for line in order.get("items", []):
        if line.get("item_type") != "product":
            continue
        qty_remaining = int(line.get("qty_reserved", 0))
        if qty_remaining <= 0:
            continue
        try:
            await _db.salon_inventory.update_one(
                {"id": line["item_id"], "salon_id": salon_id},
                {"$inc": {"qty_reserved_for_customer_orders": -qty_remaining},
                 "$set": {"updated_at": _now_iso()}},
            )
        except Exception as e:
            logger.error(f"[customer_shop] release reserve failed for {line['item_id']}: {e}")


async def _consume_reservations_and_decrement(order: dict, staff_id: Optional[str]) -> None:
    """Used on fulfill: for each PRODUCT line, deduct qty_total and qty_reserved_for_customer_orders by qty_final."""
    salon_id = order["salon_id"]
    for line in order.get("items", []):
        if line.get("item_type") != "product":
            continue
        qty_final = int(line.get("qty_final") or line.get("qty") or 0)
        qty_reserved = int(line.get("qty_reserved") or 0)
        if qty_final <= 0:
            # nothing to consume — release any leftover reservation
            if qty_reserved > 0:
                await _db.salon_inventory.update_one(
                    {"id": line["item_id"], "salon_id": salon_id},
                    {"$inc": {"qty_reserved_for_customer_orders": -qty_reserved},
                     "$set": {"updated_at": _now_iso()}},
                )
            continue

        # Decrement qty_total by qty_final and qty_reserved by qty_reserved (full reservation released).
        updated = await _db.salon_inventory.find_one_and_update(
            {"id": line["item_id"], "salon_id": salon_id,
             "qty_total": {"$gte": qty_final},
             "qty_reserved_for_customer_orders": {"$gte": qty_reserved}},
            {"$inc": {
                "qty_total": -qty_final,
                "qty_reserved_for_customer_orders": -qty_reserved,
             },
             "$set": {"updated_at": _now_iso()}},
            return_document=True,
            projection={"_id": 0},
        )
        if not updated:
            logger.error(f"[customer_shop] could not consume reservation for {line['item_id']} qty={qty_final}/{qty_reserved}")
            continue

        try:
            await _db.salon_inventory_movements.insert_one({
                "id": str(uuid.uuid4()),
                "inventory_item_id": line["item_id"],
                "salon_id": salon_id,
                "branch_id": order.get("branch_id"),
                "movement_type": "sale_to_customer",
                "qty_delta": -qty_final,
                "qty_after": int(updated.get("qty_total") or 0),
                "reference_type": "customer_order",
                "reference_id": order["id"],
                "staff_id": staff_id,
                "note": f"Customer order {order['id'][:8]} fulfilled",
                "item_name": line.get("name"),
                "created_by": "system",
                "created_at": _now_iso(),
            })
        except Exception as e:
            logger.error(f"[customer_shop] movement insert failed: {e}")

        # Low-stock alert if we just crossed the threshold.
        try:
            if _send_low_stock_alert:
                threshold = int(updated.get("low_stock_threshold") or 0)
                qt = int(updated.get("qty_total") or 0)
                if threshold > 0 and qt <= threshold:
                    await _send_low_stock_alert(updated)
        except Exception as e:
            logger.error(f"[customer_shop] low_stock hook failed: {e}")


async def _post_financial_for_order(order: dict, staff_id: Optional[str], payment_mode: str) -> str:
    """Insert one financial_transactions row covering ALL fulfilled lines.

    Returns the transaction id.
    """
    salon_id = order["salon_id"]
    fulfilled_total = 0.0
    n_product_lines = 0
    for line in order.get("items", []):
        qty_final = int(line.get("qty_final") or line.get("qty") or 0)
        if qty_final <= 0:
            continue
        if line.get("item_type") == "membership":
            unit = float(line.get("unit_price") or 0)
            fulfilled_total += unit * qty_final
        else:
            unit = float(line.get("unit_price") or 0)
            gst_pct = float(line.get("gst_percent") or 0)
            sub = unit * qty_final
            fulfilled_total += sub + sub * gst_pct / 100.0
            n_product_lines += 1

    fulfilled_total = round(fulfilled_total, 2)

    txn_id = str(uuid.uuid4())
    await _db.financial_transactions.insert_one({
        "id": txn_id,
        "salon_id": salon_id,
        "branch_id": order.get("branch_id"),
        "type": "inflow",
        "category": "product_sale",
        "amount": fulfilled_total,
        "payment_mode": payment_mode,
        "narration": f"Customer order · {order.get('customer_name') or order.get('customer_phone')} · order {order['id'][:8]}",
        "reference_id": order["id"],
        "reference_type": "customer_order",
        "staff_id": staff_id,
        "exclude_from_incentive": True,  # B7-D
        "created_by": "system",
        "date": _today_str(),
        "created_at": _now_iso(),
        "customer_phone": order.get("customer_phone"),
    })
    return txn_id


async def _activate_memberships_for_order(order: dict) -> List[str]:
    """For every fulfilled membership line, create customer_memberships docs."""
    salon_id = order["salon_id"]
    customer_phone = order.get("customer_phone")
    created_ids: list = []

    for line in order.get("items", []):
        if line.get("item_type") != "membership":
            continue
        qty_final = int(line.get("qty_final") or line.get("qty") or 0)
        if qty_final <= 0:
            continue
        plan = await _db.membership_plans.find_one({"id": line["item_id"]}, {"_id": 0})
        if not plan:
            continue
        for _ in range(qty_final):
            mid = str(uuid.uuid4())
            now = datetime.now(timezone.utc)
            validity_months = int(plan.get("validity_months") or 12)
            expires_at = now + timedelta(days=30 * validity_months)
            doc = {
                "id": mid,
                "salon_id": salon_id,
                "customer_phone": customer_phone,
                "customer_name": order.get("customer_name") or "",
                "membership_plan_id": plan["id"],
                "membership_plan_name": plan.get("name"),
                "amount": float(plan.get("amount") or 0),
                "credit_total": float(plan.get("credit") or 0),
                "credit_used": 0.0,
                "credit_remaining": float(plan.get("credit") or 0),
                "validity_months": validity_months,
                "tier": plan.get("tier"),
                "color": plan.get("color"),
                "status": "active",
                "purchased_at": now.isoformat(),
                "expires_at": expires_at.isoformat(),
                "source": "customer_shop",
                "source_order_id": order["id"],
            }
            await _db.customer_memberships.insert_one(doc.copy())
            created_ids.append(mid)
    return created_ids


# ===================== Customer endpoints =====================

@customer_shop_router.get("/api/customer/salon/{salon_id}/shop/products")
async def list_shop_products(
    salon_id: str,
    q: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    include_memberships: bool = Query(True),
    in_stock_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """Public — list salon's sellable inventory + memberships."""
    salon = await _db.salons.find_one({"id": salon_id}, {"_id": 0, "id": 1, "salon_name": 1, "status": 1})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")

    query: dict = {
        "salon_id": salon_id,
        "is_deleted": {"$ne": True},
        "availability": {"$in": ["both", "sale_only"]},
    }
    if category:
        query["category"] = category
    if brand:
        query["brand"] = brand
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"brand": {"$regex": q, "$options": "i"}},
        ]

    items: list = []
    cursor = _db.salon_inventory.find(query, {"_id": 0}).sort("name", 1)
    async for doc in cursor:
        total = int(doc.get("qty_total") or 0)
        ri = int(doc.get("qty_reserved_for_internal") or 0)
        rc = int(doc.get("qty_reserved_for_customer_orders") or 0)
        avail = max(0, total - ri - rc)
        if in_stock_only and avail <= 0:
            continue
        items.append({
            "item_type": "product",
            "id": doc["id"],
            "name": doc.get("name"),
            "brand": doc.get("brand"),
            "category": doc.get("category"),
            "image_url": doc.get("image_url"),
            "selling_price": float(doc.get("selling_price") or 0),
            "mrp": float(doc.get("mrp") or 0),
            "discount": float(doc.get("discount") or 0),
            "gst_percent": float(doc.get("gst_percent") or 0),
            "unit": doc.get("unit"),
            "pack_size": doc.get("pack_size"),
            "in_stock": avail > 0,
            "qty_available": avail,
        })

    memberships: list = []
    if include_memberships:
        async for plan in _db.membership_plans.find(
            {"salon_id": salon_id, "is_active": True}, {"_id": 0}
        ):
            if q and q.lower() not in (plan.get("name") or "").lower():
                continue
            memberships.append({
                "item_type": "membership",
                "id": plan["id"],
                "name": plan.get("name"),
                "tier": plan.get("tier"),
                "color": plan.get("color"),
                "selling_price": float(plan.get("amount") or 0),
                "credit": float(plan.get("credit") or 0),
                "validity_months": int(plan.get("validity_months") or 0),
                "terms_conditions": plan.get("terms_conditions") or "",
                "in_stock": True,
                "qty_available": 9999,
                "image_url": plan.get("image_url"),
            })

    # paginate combined list
    combined = memberships + items if include_memberships else items
    total = len(combined)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "products": combined[start:end],
        "total_count": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
        "salon": {"id": salon["id"], "name": salon.get("salon_name")},
    }


@customer_shop_router.get("/api/customer/salon/{salon_id}/shop/products/{item_id}")
async def get_shop_product(salon_id: str, item_id: str, item_type: str = Query("product")):
    if item_type == "membership":
        plan = await _get_membership_plan(item_id, salon_id)
        if not plan:
            raise HTTPException(status_code=404, detail="Membership plan not found")
        return {
            "product": {
                "item_type": "membership",
                "id": plan["id"],
                "name": plan.get("name"),
                "selling_price": float(plan.get("amount") or 0),
                "credit": float(plan.get("credit") or 0),
                "validity_months": int(plan.get("validity_months") or 0),
                "tier": plan.get("tier"),
                "color": plan.get("color"),
                "terms_conditions": plan.get("terms_conditions") or "",
            }
        }
    doc = await _get_inventory_item(item_id, salon_id)
    if not doc or doc.get("availability") == "internal_only":
        raise HTTPException(status_code=404, detail="Product not found")
    total = int(doc.get("qty_total") or 0)
    ri = int(doc.get("qty_reserved_for_internal") or 0)
    rc = int(doc.get("qty_reserved_for_customer_orders") or 0)
    avail = max(0, total - ri - rc)
    return {
        "product": {
            "item_type": "product",
            "id": doc["id"],
            "name": doc.get("name"),
            "brand": doc.get("brand"),
            "category": doc.get("category"),
            "image_url": doc.get("image_url"),
            "selling_price": float(doc.get("selling_price") or 0),
            "mrp": float(doc.get("mrp") or 0),
            "discount": float(doc.get("discount") or 0),
            "gst_percent": float(doc.get("gst_percent") or 0),
            "unit": doc.get("unit"),
            "pack_size": doc.get("pack_size"),
            "in_stock": avail > 0,
            "qty_available": avail,
        }
    }


@customer_shop_router.post("/api/customer/salon/{salon_id}/shop/notify-me")
async def customer_notify_me(salon_id: str, payload: NotifyMeCustomerPayload):
    """Customer subscribes to be notified when a salon product is back in stock."""
    phone = _normalise_phone(payload.customer_phone)
    if payload.item_type == "membership":
        return {"ok": True, "already_subscribed": False, "message": "Membership plans don't go out of stock"}
    item = await _get_inventory_item(payload.item_id, salon_id)
    if not item:
        raise HTTPException(status_code=404, detail="Product not found")
    existing = await _db.stock_notify_requests.find_one({
        "inventory_item_id": payload.item_id,
        "customer_phone": phone,
        "status": "pending",
    })
    if existing:
        return {"ok": True, "already_subscribed": True}
    await _db.stock_notify_requests.insert_one({
        "id": str(uuid.uuid4()),
        "scope": "customer_salon_inventory",
        "inventory_item_id": payload.item_id,
        "item_name": item.get("name"),
        "salon_id": salon_id,
        "customer_phone": phone,
        "status": "pending",
        "created_at": _now_iso(),
    })
    return {"ok": True, "already_subscribed": False}


@customer_shop_router.post("/api/customer/salon/{salon_id}/shop/checkout")
async def customer_checkout(salon_id: str, payload: CheckoutPayload, request: Request):
    salon = await _db.salons.find_one({"id": salon_id}, {"_id": 0, "id": 1, "salon_name": 1, "status": 1})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    if salon.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Salon currently not accepting orders")
    if not payload.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    phone = _normalise_phone(payload.customer_phone)
    branch_id = await _resolve_branch_id(salon_id, payload.branch_id) if _resolve_branch_id else payload.branch_id

    # Atomically reserve stock for products; resolve membership plan docs.
    resolved = await _reserve_for_customer(payload.items, salon_id)

    # Build line snapshots & totals.
    order_items: list = []
    grand_subtotal = 0.0
    grand_gst = 0.0
    for line, r in zip(payload.items, resolved):
        if r["type"] == "membership":
            plan = r["doc"]
            price = _line_price_for_membership(plan, line.qty)
            order_items.append({
                "item_type": "membership",
                "item_id": plan["id"],
                "name": plan.get("name"),
                "image_url": plan.get("image_url"),
                "qty": line.qty,
                "qty_reserved": 0,        # memberships don't reserve stock
                "qty_final": line.qty,    # default = full
                "unit_price": price["unit_price"],
                "line_subtotal": price["line_subtotal"],
                "line_gst": price["line_gst"],
                "line_total": price["line_total"],
                "gst_percent": 0.0,
                "discount_percent": 0.0,
            })
        else:
            item = r["doc"]
            price = _line_price_for_product(item, line.qty)
            order_items.append({
                "item_type": "product",
                "item_id": item["id"],
                "name": item.get("name"),
                "brand": item.get("brand"),
                "image_url": item.get("image_url"),
                "unit": item.get("unit"),
                "pack_size": item.get("pack_size"),
                "qty": line.qty,
                "qty_reserved": line.qty,
                "qty_final": line.qty,    # default = full
                "unit_price": price["unit_price"],
                "line_subtotal": price["line_subtotal"],
                "line_gst": price["line_gst"],
                "line_total": price["line_total"],
                "gst_percent": price["gst_percent"],
                "discount_percent": price["discount_percent"],
            })
        grand_subtotal += price["line_subtotal"]
        grand_gst += price["line_gst"]

    grand_total = round(grand_subtotal + grand_gst, 2)
    order_id = str(uuid.uuid4())
    now = _now_iso()
    order_doc = {
        "id": order_id,
        "salon_id": salon_id,
        "branch_id": branch_id,
        "customer_phone": phone,
        "customer_name": (payload.customer_name or "").strip(),
        "items": order_items,
        "subtotal": round(grand_subtotal, 2),
        "gst_total": round(grand_gst, 2),
        "total_amount": grand_total,
        "payment_mode": payload.payment_mode,
        "payment_status": "pending",
        "order_status": "placed",
        "status_history": [{"status": "placed", "timestamp": now, "note": "Customer placed order"}],
        "note": payload.note,
        "created_at": now,
        "updated_at": now,
    }
    await _db.customer_product_orders.insert_one(order_doc.copy())
    order_doc.pop("_id", None)

    # Best-effort: notify salon admin in-app.
    try:
        if _create_in_app_notification:
            await _create_in_app_notification(
                user_type="salon",
                user_id=salon_id,
                title="New customer order",
                message=f"{phone} placed an order of ₹{grand_total:.2f}",
                notification_type="customer_order_placed",
                setting_key="customer_order_placed",
                salon_id=salon_id,
                related_id=order_id,
            )
    except Exception as e:
        logger.error(f"[customer_shop] salon notify failed: {e}")

    # Best-effort: confirmation to customer.
    try:
        if _create_in_app_notification:
            await _create_in_app_notification(
                user_type="customer",
                user_id=phone,
                title="Order placed",
                message=f"Your order of ₹{grand_total:.2f} at {salon.get('salon_name')} is placed. We'll notify you when ready.",
                notification_type="customer_order_placed",
                setting_key="customer_order_placed",
                salon_id=salon_id,
                related_id=order_id,
            )
    except Exception as e:
        logger.error(f"[customer_shop] customer notify failed: {e}")

    return {"ok": True, "order": order_doc}


@customer_shop_router.get("/api/customer/shop/orders")
async def customer_list_orders(
    customer_phone: str = Query(..., min_length=10),
    salon_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    phone = _normalise_phone(customer_phone)
    q: dict = {"customer_phone": phone}
    if salon_id:
        q["salon_id"] = salon_id
    total = await _db.customer_product_orders.count_documents(q)
    cursor = (
        _db.customer_product_orders.find(q, {"_id": 0})
        .sort("created_at", -1)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    orders = await cursor.to_list(length=page_size)
    return {
        "orders": orders,
        "total_count": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


@customer_shop_router.get("/api/customer/shop/orders/{order_id}")
async def customer_get_order(order_id: str, customer_phone: str = Query(..., min_length=10)):
    phone = _normalise_phone(customer_phone)
    doc = await _db.customer_product_orders.find_one(
        {"id": order_id, "customer_phone": phone}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"order": doc}


@customer_shop_router.post("/api/customer/shop/orders/{order_id}/cancel")
async def customer_cancel_order(order_id: str, customer_phone: str = Query(..., min_length=10)):
    phone = _normalise_phone(customer_phone)
    doc = await _db.customer_product_orders.find_one(
        {"id": order_id, "customer_phone": phone}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    if doc.get("order_status") != "placed":
        raise HTTPException(status_code=409, detail=f"Cannot cancel order in status '{doc.get('order_status')}'")

    await _release_reservations(doc)
    now = _now_iso()
    await _db.customer_product_orders.update_one(
        {"id": order_id},
        {"$set": {"order_status": "cancelled", "updated_at": now,
                  "cancelled_by": "customer", "cancelled_at": now},
         "$push": {"status_history": {"status": "cancelled", "timestamp": now,
                                       "note": "Cancelled by customer"}}},
    )

    # Fire restock notifications (any pending notify-me for these items).
    try:
        for line in doc.get("items", []):
            if line.get("item_type") == "product":
                await _fire_customer_restock_notifications(doc["salon_id"], line["item_id"])
    except Exception as e:
        logger.error(f"[customer_shop] restock notify failed: {e}")

    # Notify salon admin
    try:
        if _create_in_app_notification:
            await _create_in_app_notification(
                user_type="salon",
                user_id=doc["salon_id"],
                title="Customer order cancelled",
                message=f"Order #{order_id[:8]} by {phone} was cancelled by the customer.",
                notification_type="customer_order_cancelled",
                setting_key="customer_order_cancelled",
                salon_id=doc["salon_id"],
                related_id=order_id,
            )
    except Exception:
        pass

    fresh = await _db.customer_product_orders.find_one({"id": order_id}, {"_id": 0})
    return {"ok": True, "order": fresh}


async def _fire_customer_restock_notifications(salon_id: str, inventory_item_id: str) -> int:
    """Notify all customers waiting on this salon inventory item (Phase 16)."""
    sent = 0
    cursor = _db.stock_notify_requests.find({
        "scope": "customer_salon_inventory",
        "inventory_item_id": inventory_item_id,
        "salon_id": salon_id,
        "status": "pending",
    }, {"_id": 0})
    requests_to_close: list = []
    async for req in cursor:
        try:
            if _create_in_app_notification:
                await _create_in_app_notification(
                    user_type="customer",
                    user_id=req["customer_phone"],
                    title="Back in stock",
                    message=f"'{req.get('item_name') or 'A product'}' is back in stock at the salon!",
                    notification_type="stock_back",
                    setting_key="stock_back",
                    salon_id=salon_id,
                    related_id=inventory_item_id,
                )
            requests_to_close.append(req["id"])
            sent += 1
        except Exception as e:
            logger.error(f"[customer_shop] notify customer {req.get('customer_phone')} failed: {e}")
    if requests_to_close:
        await _db.stock_notify_requests.update_many(
            {"id": {"$in": requests_to_close}},
            {"$set": {"status": "notified", "notified_at": _now_iso()}},
        )
    return sent


# ===================== Salon-side endpoints =====================

@customer_shop_router.get("/api/salon/customer-orders")
async def salon_list_customer_orders(
    status: Optional[str] = Query(None),
    branch_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: dict = Depends(_salon_auth),
):
    salon_id = user.get("salon_id") or user.get("sub")
    q: dict = {"salon_id": salon_id}
    if status:
        q["order_status"] = status
    if branch_id:
        q["branch_id"] = branch_id
    total = await _db.customer_product_orders.count_documents(q)
    cursor = (
        _db.customer_product_orders.find(q, {"_id": 0})
        .sort("created_at", -1)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    orders = await cursor.to_list(length=page_size)
    return {
        "orders": orders,
        "total_count": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


@customer_shop_router.get("/api/salon/customer-orders/{order_id}")
async def salon_get_customer_order(order_id: str, user: dict = Depends(_salon_auth)):
    salon_id = user.get("salon_id") or user.get("sub")
    doc = await _db.customer_product_orders.find_one(
        {"id": order_id, "salon_id": salon_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"order": doc}


@customer_shop_router.put("/api/salon/customer-orders/{order_id}/items")
async def salon_edit_order_items(order_id: str, payload: EditItemsPayload, user: dict = Depends(_salon_auth)):
    """Phase 17 partial-fulfilment: salon edits `qty_final` per line BEFORE fulfilling.

    For PRODUCT lines, qty_final may be ≤ qty_reserved.  If qty_final < qty_reserved,
    we release the difference back to stock immediately so the salon can re-sell.
    Membership lines: qty_final can be 0..qty (skip).
    """
    salon_id = user.get("salon_id") or user.get("sub")
    doc = await _db.customer_product_orders.find_one(
        {"id": order_id, "salon_id": salon_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    if doc.get("order_status") != "placed":
        raise HTTPException(status_code=409, detail=f"Cannot edit order in status '{doc.get('order_status')}'")

    # Build map of requested edits.
    edits = {(ln.item_id): int(ln.qty) for ln in payload.items}

    new_items: list = []
    new_subtotal = 0.0
    new_gst = 0.0
    edit_summary: list = []
    for line in doc.get("items", []):
        if line["item_id"] not in edits:
            new_items.append(line)
            new_subtotal += float(line.get("line_subtotal") or 0)
            new_gst += float(line.get("line_gst") or 0)
            continue
        requested = edits[line["item_id"]]
        ordered = int(line.get("qty") or 0)
        if requested < 0 or requested > ordered:
            raise HTTPException(status_code=400, detail=f"qty_final for '{line.get('name')}' must be between 0 and {ordered}")

        if line.get("item_type") == "product":
            old_reserved = int(line.get("qty_reserved") or 0)
            # If we're reducing qty_final and currently reserved exceeds qty_final, release the diff.
            release_qty = max(0, old_reserved - requested)
            if release_qty > 0:
                await _db.salon_inventory.update_one(
                    {"id": line["item_id"], "salon_id": salon_id},
                    {"$inc": {"qty_reserved_for_customer_orders": -release_qty},
                     "$set": {"updated_at": _now_iso()}},
                )
            new_reserved = old_reserved - release_qty
            unit = float(line.get("unit_price") or 0)
            gst_pct = float(line.get("gst_percent") or 0)
            sub = round(unit * requested, 2)
            gst = round(sub * gst_pct / 100.0, 2)
            updated_line = {
                **line,
                "qty_final": requested,
                "qty_reserved": new_reserved,
                "line_subtotal": sub,
                "line_gst": gst,
                "line_total": round(sub + gst, 2),
            }
            new_items.append(updated_line)
            new_subtotal += sub
            new_gst += gst
            edit_summary.append({"item_id": line["item_id"], "from": ordered, "to": requested, "released": release_qty})
        else:
            # membership
            unit = float(line.get("unit_price") or 0)
            sub = round(unit * requested, 2)
            updated_line = {
                **line,
                "qty_final": requested,
                "line_subtotal": sub,
                "line_total": sub,
            }
            new_items.append(updated_line)
            new_subtotal += sub
            edit_summary.append({"item_id": line["item_id"], "from": ordered, "to": requested, "released": 0})

    grand_total = round(new_subtotal + new_gst, 2)
    now = _now_iso()
    await _db.customer_product_orders.update_one(
        {"id": order_id},
        {"$set": {"items": new_items, "subtotal": round(new_subtotal, 2),
                  "gst_total": round(new_gst, 2), "total_amount": grand_total,
                  "updated_at": now},
         "$push": {"status_history": {"status": "edited", "timestamp": now,
                                       "note": payload.note or "Salon edited order quantities",
                                       "edits": edit_summary,
                                       "updated_by": user.get("user_id") or user.get("id")}}},
    )

    # Fire restock notifications for any item whose qty went back up.
    try:
        for e in edit_summary:
            if e["released"] > 0:
                await _fire_customer_restock_notifications(salon_id, e["item_id"])
    except Exception as ex:
        logger.error(f"[customer_shop] edit-restock notify failed: {ex}")

    fresh = await _db.customer_product_orders.find_one({"id": order_id}, {"_id": 0})
    return {"ok": True, "order": fresh, "edits": edit_summary}


@customer_shop_router.post("/api/salon/customer-orders/{order_id}/fulfill")
async def salon_fulfill_order(order_id: str, payload: FulfillPayload, user: dict = Depends(_salon_auth)):
    salon_id = user.get("salon_id") or user.get("sub")
    doc = await _db.customer_product_orders.find_one(
        {"id": order_id, "salon_id": salon_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    if doc.get("order_status") != "placed":
        raise HTTPException(status_code=409, detail=f"Cannot fulfill order in status '{doc.get('order_status')}'")

    payment_mode = payload.payment_mode or doc.get("payment_mode") or "pay_at_salon"
    staff_id = payload.staff_id

    # 1. consume reservations + decrement qty_total + log movements
    await _consume_reservations_and_decrement(doc, staff_id)

    # Refresh doc post-decrement to use latest qty_final for finance.
    doc = await _db.customer_product_orders.find_one({"id": order_id}, {"_id": 0})

    # 2. Finance posting
    txn_id = await _post_financial_for_order(doc, staff_id, payment_mode)

    # 3. Membership activation
    membership_ids = await _activate_memberships_for_order(doc)

    now = _now_iso()
    fulfilled_total = sum(float(ln.get("line_total") or 0) for ln in doc.get("items", []) if int(ln.get("qty_final") or 0) > 0)
    await _db.customer_product_orders.update_one(
        {"id": order_id},
        {"$set": {"order_status": "fulfilled", "payment_status": "paid",
                  "payment_mode": payment_mode,
                  "fulfilled_at": now, "updated_at": now,
                  "fulfilled_by": user.get("user_id") or user.get("id"),
                  "fulfilled_amount": round(fulfilled_total, 2),
                  "financial_transaction_id": txn_id,
                  "created_membership_ids": membership_ids,
                  "staff_id": staff_id},
         "$push": {"status_history": {"status": "fulfilled", "timestamp": now,
                                       "note": payload.note or f"Order fulfilled · ₹{fulfilled_total:.2f}",
                                       "updated_by": user.get("user_id") or user.get("id")}}},
    )

    # Notify customer
    try:
        if _create_in_app_notification:
            await _create_in_app_notification(
                user_type="customer",
                user_id=doc["customer_phone"],
                title="Order fulfilled",
                message=f"Your order has been handed over. Total paid: ₹{fulfilled_total:.2f}",
                notification_type="customer_order_fulfilled",
                setting_key="customer_order_fulfilled",
                salon_id=salon_id,
                related_id=order_id,
            )
    except Exception:
        pass

    fresh = await _db.customer_product_orders.find_one({"id": order_id}, {"_id": 0})
    return {"ok": True, "order": fresh, "financial_transaction_id": txn_id,
            "created_membership_ids": membership_ids}


@customer_shop_router.post("/api/salon/customer-orders/{order_id}/cancel")
async def salon_cancel_order(order_id: str, payload: CancelPayload, user: dict = Depends(_salon_auth)):
    """Salon-initiated cancel.  If payment_status='paid' a refund_mode is required."""
    salon_id = user.get("salon_id") or user.get("sub")
    doc = await _db.customer_product_orders.find_one(
        {"id": order_id, "salon_id": salon_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    if doc.get("order_status") not in ("placed", "fulfilled"):
        raise HTTPException(status_code=409, detail=f"Cannot cancel order in status '{doc.get('order_status')}'")

    now = _now_iso()
    refund_amount = float(doc.get("fulfilled_amount") or doc.get("total_amount") or 0)
    refund_required = doc.get("payment_status") == "paid" and refund_amount > 0

    if refund_required and not payload.refund_mode:
        raise HTTPException(status_code=400, detail="refund_mode is required when cancelling a paid order")

    # If still 'placed' → just release reservations.
    if doc.get("order_status") == "placed":
        await _release_reservations(doc)
        await _db.customer_product_orders.update_one(
            {"id": order_id},
            {"$set": {"order_status": "cancelled", "updated_at": now,
                      "cancelled_by": "salon", "cancelled_at": now,
                      "cancel_note": payload.refund_note},
             "$push": {"status_history": {"status": "cancelled", "timestamp": now,
                                           "note": payload.refund_note or "Cancelled by salon",
                                           "updated_by": user.get("user_id") or user.get("id")}}},
        )
        # Restock notify any waiting customers
        try:
            for line in doc.get("items", []):
                if line.get("item_type") == "product":
                    await _fire_customer_restock_notifications(salon_id, line["item_id"])
        except Exception:
            pass
        fresh = await _db.customer_product_orders.find_one({"id": order_id}, {"_id": 0})
        return {"ok": True, "order": fresh}

    # else fulfilled → must refund.
    refund_record = await _handle_refund(doc, payload.refund_mode, payload.refund_note,
                                          actor=user.get("user_id") or user.get("id"))
    new_status = "refunded" if payload.refund_mode != "refund_later" else "refund_pending"
    await _db.customer_product_orders.update_one(
        {"id": order_id},
        {"$set": {"order_status": new_status, "updated_at": now,
                  "cancelled_by": "salon", "cancelled_at": now,
                  "refund_mode": payload.refund_mode,
                  "refund_amount": refund_amount,
                  "refund_status": "completed" if new_status == "refunded" else "pending",
                  "refund_note": payload.refund_note,
                  "refund_record": refund_record},
         "$push": {"status_history": {"status": new_status, "timestamp": now,
                                       "note": f"Refund {payload.refund_mode} · ₹{refund_amount:.2f}",
                                       "updated_by": user.get("user_id") or user.get("id")}}},
    )

    # Notify customer about cancellation+refund.
    try:
        if _create_in_app_notification:
            if new_status == "refunded":
                msg = f"Your order has been cancelled and ₹{refund_amount:.2f} refunded via {payload.refund_mode}."
            else:
                msg = f"Your order has been cancelled. ₹{refund_amount:.2f} refund will be processed shortly."
            await _create_in_app_notification(
                user_type="customer",
                user_id=doc["customer_phone"],
                title="Order cancelled",
                message=msg,
                notification_type="customer_order_cancelled",
                setting_key="customer_order_cancelled",
                salon_id=salon_id,
                related_id=order_id,
            )
    except Exception:
        pass

    fresh = await _db.customer_product_orders.find_one({"id": order_id}, {"_id": 0})
    return {"ok": True, "order": fresh, "refund_record": refund_record}


async def _handle_refund(order: dict, refund_mode: str, refund_note: Optional[str], actor: str) -> dict:
    """Apply the refund according to `refund_mode`.

    Returns a small record dict that we attach to the order.
    """
    salon_id = order["salon_id"]
    phone = order["customer_phone"]
    amount = float(order.get("fulfilled_amount") or order.get("total_amount") or 0)
    branch_id = order.get("branch_id")
    now = _now_iso()
    record = {
        "id": str(uuid.uuid4()),
        "mode": refund_mode,
        "amount": amount,
        "note": refund_note,
        "actor": actor,
        "created_at": now,
    }

    if refund_mode == "wallet":
        # Credit wallet — find/create customer wallet for this salon.
        wallet = await _db.customer_wallets.find_one(
            {"customer_phone": phone, "salon_id": salon_id}, {"_id": 0}
        )
        if wallet:
            await _db.customer_wallets.update_one(
                {"id": wallet["id"]},
                {"$inc": {"balance": amount},
                 "$set": {"updated_at": now}},
            )
            wallet_id = wallet["id"]
        else:
            wallet_id = str(uuid.uuid4())
            await _db.customer_wallets.insert_one({
                "id": wallet_id,
                "customer_phone": phone,
                "salon_id": salon_id,
                "balance": amount,
                "created_at": now,
                "updated_at": now,
            })
        # Wallet transaction log
        await _db.customer_wallet_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "wallet_id": wallet_id,
            "customer_phone": phone,
            "salon_id": salon_id,
            "type": "credit",
            "amount": amount,
            "balance_after": (wallet.get("balance", 0) if wallet else 0) + amount,
            "reason": "refund_customer_order",
            "reference_id": order["id"],
            "note": refund_note or "Refund credit",
            "created_at": now,
        })
        record["wallet_id"] = wallet_id

    if refund_mode in ("cash", "upi", "bank"):
        # Record outflow financial transaction
        await _db.financial_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "salon_id": salon_id,
            "branch_id": branch_id,
            "type": "outflow",
            "category": "refund",
            "amount": amount,
            "payment_mode": refund_mode,
            "narration": f"Refund · order {order['id'][:8]} · {phone}",
            "reference_id": order["id"],
            "reference_type": "customer_order_refund",
            "created_by": actor,
            "date": _today_str(),
            "created_at": now,
            "customer_phone": phone,
            "exclude_from_incentive": True,
        })

    if refund_mode == "refund_later":
        record["pending"] = True

    return record


@customer_shop_router.post("/api/salon/customer-orders/{order_id}/complete-refund")
async def salon_complete_refund(order_id: str, payload: CompleteRefundPayload, user: dict = Depends(_salon_auth)):
    """Finish a pending refund_later by selecting an actual mode."""
    salon_id = user.get("salon_id") or user.get("sub")
    doc = await _db.customer_product_orders.find_one(
        {"id": order_id, "salon_id": salon_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    if doc.get("order_status") != "refund_pending":
        raise HTTPException(status_code=409, detail=f"Order is not pending refund (status={doc.get('order_status')})")

    record = await _handle_refund(doc, payload.refund_mode, doc.get("refund_note"),
                                   actor=user.get("user_id") or user.get("id"))
    now = _now_iso()
    await _db.customer_product_orders.update_one(
        {"id": order_id},
        {"$set": {"order_status": "refunded", "updated_at": now,
                  "refund_mode": payload.refund_mode,
                  "refund_status": "completed",
                  "refund_record": record},
         "$push": {"status_history": {"status": "refunded", "timestamp": now,
                                       "note": f"Refund completed · {payload.refund_mode}",
                                       "updated_by": user.get("user_id") or user.get("id")}}},
    )
    try:
        if _create_in_app_notification:
            await _create_in_app_notification(
                user_type="customer",
                user_id=doc["customer_phone"],
                title="Refund completed",
                message=f"₹{record['amount']:.2f} refunded via {payload.refund_mode}.",
                notification_type="customer_order_refunded",
                setting_key="customer_order_refunded",
                salon_id=salon_id,
                related_id=order_id,
            )
    except Exception:
        pass

    fresh = await _db.customer_product_orders.find_one({"id": order_id}, {"_id": 0})
    return {"ok": True, "order": fresh, "refund_record": record}


# ===================== Phase 16 hooks =====================

async def fire_restock_notifications_for_product(salon_id: str, inventory_item_id: str) -> int:
    """Called by salon_inventory restock / auto_post_on_delivery when qty crosses 0→positive."""
    return await _fire_customer_restock_notifications(salon_id, inventory_item_id)
