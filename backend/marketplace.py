"""
Phase 10 — Salon-facing Marketplace endpoints.

Salons (and any authenticated salon user) can browse the catalogue of
*active suppliers* and place inquiries on products of interest.

Visibility rules:
  - Supplier.status == 'active'
  - Product.is_active == true
  - Product.is_deleted != true
  - Product.inventory_available > 0  (out-of-stock products are hidden)

Endpoints:
  GET  /api/marketplace/products             — paginated, filterable list
  GET  /api/marketplace/products/{id}        — single product detail
  GET  /api/marketplace/categories           — distinct category list (filter UI)
  GET  /api/marketplace/brands               — distinct brand list (filter UI)
  POST /api/marketplace/inquiries            — salon expresses interest in a product
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# Globals injected via init_marketplace_router (server.py wires these in)
_db = None
_get_current_salon_user = None


async def _salon_user_dep():
    """Thin pass-through that lets us swap the real auth dep at runtime."""
    if _get_current_salon_user is None:
        raise HTTPException(status_code=500, detail="marketplace_not_initialised")
    # Call the real dep; FastAPI normally injects via parameter, but since we
    # need to defer binding until init, we await it here as a function.
    raise HTTPException(status_code=500, detail="marketplace_not_initialised")


marketplace_router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])


def init_marketplace_router(*, db, get_current_salon_user):
    """Wire up the router AFTER server.py has defined its auth dep.

    We rebuild the dependency reference inside this module so FastAPI's
    `Depends(_salon_user_dep)` resolves to the real auth function.
    """
    global _db, _get_current_salon_user, _salon_user_dep
    _db = db
    _get_current_salon_user = get_current_salon_user
    # Replace the placeholder with the real dep — FastAPI evaluates the
    # function reference lazily for each request, so this works.
    _salon_user_dep = get_current_salon_user  # type: ignore[assignment]
    # Rebuild router with dep wired: we kept the routes' Depends() pointed to
    # the module attribute `_salon_user_dep`. FastAPI captured the reference
    # at decorator time, so we instead use lambdas that read the current value.
    return marketplace_router


# ---------------- Models ----------------

class InquiryCreate(BaseModel):
    product_id: str = Field(..., min_length=1)
    qty: int = Field(default=1, ge=1, le=100_000)
    message: Optional[str] = Field(default=None, max_length=1000)


# ---------------- Helpers ----------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _attach_supplier_info(product: dict) -> dict:
    """Enrich a product doc with supplier business name + rating."""
    if not product:
        return product
    supplier_id = product.get("supplier_id")
    if supplier_id:
        sup = await _db.suppliers.find_one(
            {"id": supplier_id, "status": "active"},
            {"_id": 0, "id": 1, "business_name": 1, "rating_avg": 1, "rating_count": 1, "city": 1, "state": 1},
        )
        if sup:
            product["supplier"] = {
                "id": sup.get("id"),
                "business_name": sup.get("business_name"),
                "rating_avg": float(sup.get("rating_avg") or 0),
                "rating_count": int(sup.get("rating_count") or 0),
                "city": sup.get("city"),
                "state": sup.get("state"),
            }
    product.pop("inventory_reserved", None)
    return product


async def _active_supplier_ids() -> list:
    cursor = _db.suppliers.find({"status": "active"}, {"_id": 0, "id": 1})
    return [doc["id"] async for doc in cursor]


async def _current_user():
    """Single-source dep used by every marketplace endpoint."""
    if _get_current_salon_user is None:
        raise HTTPException(status_code=500, detail="marketplace_not_initialised")
    # We can't `Depends()` from inside another function easily, so instead we
    # rely on FastAPI's sub-dep resolution by declaring a fresh dep at the
    # route level. See routes below — they each `Depends(_get_current_salon_user)`
    # which is a module-level attribute that *is* set by init_marketplace_router
    # before the app starts serving requests.
    raise HTTPException(status_code=500, detail="should_not_be_called_directly")


def _user_dep():
    """Return the current auth dep callable. Used as Depends() argument."""
    return _get_current_salon_user


# ---------------- Endpoints ----------------
#
# IMPORTANT: each route below resolves auth via `Depends(_resolve_user_dep)` —
# a tiny shim that runs the real dep that was injected at init time. This
# avoids the chicken-and-egg of having to import server.get_current_salon_user
# into this module (which would create a cyclic import).


from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False)


async def _auth(credentials: HTTPAuthorizationCredentials = Depends(_bearer)):
    """Resolve the salon user using the injected auth callable.

    The injected callable is `get_current_salon_user(credentials=...)` from
    server.py, which itself depends on HTTPBearer. We re-implement that here
    using the bearer scheme already imported, then defer to the verify_token
    logic by simply calling the dep with credentials.
    """
    if _get_current_salon_user is None:
        raise HTTPException(status_code=500, detail="marketplace_not_initialised")
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    # The injected dep itself expects `credentials` via FastAPI; call directly.
    return await _get_current_salon_user(credentials)


@marketplace_router.get("/products")
async def list_products(
    q: Optional[str] = Query(None, description="Search in name / brand / description"),
    category: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    sort: str = Query("popular", description="popular | price_asc | price_desc | newest"),
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    user: dict = Depends(_auth),
):
    supplier_ids = await _active_supplier_ids()
    if not supplier_ids:
        return {"products": [], "total": 0, "page": page, "page_size": page_size}

    query: dict = {
        "supplier_id": {"$in": supplier_ids},
        "is_active": True,
        "is_deleted": {"$ne": True},
        "inventory_available": {"$gt": 0},
    }
    if category:
        query["category"] = category
    if brand:
        query["brand"] = brand
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"brand": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]

    sort_clauses = {
        "price_asc":  [("selling_price", 1)],
        "price_desc": [("selling_price", -1)],
        "newest":     [("created_at", -1)],
        "popular":    [("updated_at", -1)],  # MVP proxy until order history exists
    }
    sort_clause = sort_clauses.get(sort, sort_clauses["popular"])

    total = await _db.supplier_products.count_documents(query)
    skip = (page - 1) * page_size

    cursor = _db.supplier_products.find(query, {"_id": 0}).sort(sort_clause).skip(skip).limit(page_size)
    products = []
    async for doc in cursor:
        products.append(await _attach_supplier_info(doc))

    return {
        "products": products,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


@marketplace_router.get("/products/{product_id}")
async def get_product(product_id: str, user: dict = Depends(_auth)):
    doc = await _db.supplier_products.find_one(
        {
            "id": product_id,
            "is_active": True,
            "is_deleted": {"$ne": True},
            "inventory_available": {"$gt": 0},
        },
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Product not available")
    # Confirm supplier is still active (else hide)
    supplier_ids = await _active_supplier_ids()
    if doc.get("supplier_id") not in supplier_ids:
        raise HTTPException(status_code=404, detail="Product not available")
    return await _attach_supplier_info(doc)


@marketplace_router.get("/categories")
async def list_categories(user: dict = Depends(_auth)):
    supplier_ids = await _active_supplier_ids()
    if not supplier_ids:
        return {"categories": []}
    pipeline = [
        {"$match": {
            "supplier_id": {"$in": supplier_ids},
            "is_active": True,
            "is_deleted": {"$ne": True},
            "inventory_available": {"$gt": 0},
        }},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    docs = await _db.supplier_products.aggregate(pipeline).to_list(length=100)
    return {"categories": [{"name": d["_id"], "count": d["count"]} for d in docs if d["_id"]]}


@marketplace_router.get("/brands")
async def list_brands(user: dict = Depends(_auth)):
    supplier_ids = await _active_supplier_ids()
    if not supplier_ids:
        return {"brands": []}
    pipeline = [
        {"$match": {
            "supplier_id": {"$in": supplier_ids},
            "is_active": True,
            "is_deleted": {"$ne": True},
            "inventory_available": {"$gt": 0},
            "brand": {"$nin": [None, ""]},
        }},
        {"$group": {"_id": "$brand", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    docs = await _db.supplier_products.aggregate(pipeline).to_list(length=200)
    return {"brands": [{"name": d["_id"], "count": d["count"]} for d in docs if d["_id"]]}


@marketplace_router.post("/inquiries")
async def create_inquiry(payload: InquiryCreate, user: dict = Depends(_auth)):
    """Salon expresses interest in a product. Stored in marketplace_inquiries.

    Visible to the supplier on their dashboard (Phase 11 will surface them in UI).
    """
    product = await _db.supplier_products.find_one(
        {
            "id": payload.product_id,
            "is_active": True,
            "is_deleted": {"$ne": True},
        },
        {"_id": 0, "id": 1, "name": 1, "supplier_id": 1, "selling_price": 1},
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not available")

    salon_id = user.get("salon_id") or user.get("sub")
    salon = await _db.salons.find_one({"id": salon_id}, {"_id": 0, "id": 1, "salon_name": 1, "phone": 1, "city": 1})

    inquiry_id = str(uuid.uuid4())
    doc = {
        "id": inquiry_id,
        "product_id": payload.product_id,
        "product_name": product.get("name"),
        "supplier_id": product.get("supplier_id"),
        "salon_id": salon_id,
        "salon_name": (salon or {}).get("salon_name"),
        "salon_phone": (salon or {}).get("phone"),
        "salon_city": (salon or {}).get("city"),
        "salon_user_id": user.get("id") or user.get("user_id"),
        "qty": payload.qty,
        "estimated_value": round(float(product.get("selling_price") or 0) * payload.qty, 2),
        "message": payload.message,
        "status": "open",
        "created_at": _now_iso(),
    }
    await _db.marketplace_inquiries.insert_one(doc.copy())
    doc.pop("_id", None)
    return {"ok": True, "inquiry_id": inquiry_id, "inquiry": doc}
