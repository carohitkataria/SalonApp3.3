"""
Phase 9 (Part B) — Supplier products + dashboard + product samples.

Endpoints:
  GET    /api/supplier/dashboard/stats
  GET    /api/supplier/products
  POST   /api/supplier/products
  PUT    /api/supplier/products/{id}
  DELETE /api/supplier/products/{id}                 (soft delete -> is_active=false)
  GET    /api/supplier/product-samples               (list seed samples — pagination + filter)
  POST   /api/supplier/products/from-sample/{id}     (create product from template)
  POST   /api/supplier/products/{id}/restock         (body: {qty})
  GET    /api/supplier/products/{id}                 (single product detail)

Stock semantics (per spec):
  - inventory_available  -> sellable now
  - inventory_reserved   -> sold but not yet shipped
  - total_on_hand        -> available + reserved (display only)
  - low_stock_threshold  -> trigger for KPI count
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from supplier_auth import require_supplier  # FastAPI dependency

logger = logging.getLogger(__name__)

# Injected by init_supplier_products_router
_db = None
_in_app_notifier = None

supplier_products_router = APIRouter(prefix="/api/supplier", tags=["supplier-products"])

ALLOWED_UNITS = {"piece", "ml", "g", "kg", "litre", "pack"}


def set_notification_hook(in_app_notifier=None):
    """Wire Phase 16 notify-me hook after server load."""
    global _in_app_notifier
    _in_app_notifier = in_app_notifier


# ---------- Models ----------

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    brand: Optional[str] = Field(default=None, max_length=140)
    category: str = Field(..., min_length=2, max_length=100)
    sub_category: Optional[str] = Field(default=None, max_length=100)
    images: List[str] = Field(default_factory=list)
    unit: str = Field(...)
    pack_size: Optional[str] = Field(default=None, max_length=50)
    mrp: float = Field(..., gt=0)
    selling_price: float = Field(..., gt=0)
    gst_percent: float = Field(default=0.0, ge=0, le=100)
    hsn_code: Optional[str] = Field(default=None, max_length=20)
    inventory_available: int = Field(default=0, ge=0)
    inventory_reserved: int = Field(default=0, ge=0)
    low_stock_threshold: int = Field(default=0, ge=0)
    is_active: bool = True
    min_order_qty: int = Field(default=1, ge=1)

    @field_validator("unit")
    @classmethod
    def unit_must_be_valid(cls, v: str) -> str:
        if v not in ALLOWED_UNITS:
            raise ValueError(f"unit must be one of {sorted(ALLOWED_UNITS)}")
        return v

    @field_validator("selling_price")
    @classmethod
    def selling_lte_mrp(cls, v: float, info) -> float:
        mrp = info.data.get("mrp")
        if mrp is not None and v > mrp:
            raise ValueError("selling_price cannot exceed mrp")
        return v


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    sub_category: Optional[str] = None
    images: Optional[List[str]] = None
    unit: Optional[str] = None
    pack_size: Optional[str] = None
    mrp: Optional[float] = None
    selling_price: Optional[float] = None
    gst_percent: Optional[float] = None
    hsn_code: Optional[str] = None
    inventory_available: Optional[int] = None
    inventory_reserved: Optional[int] = None
    low_stock_threshold: Optional[int] = None
    is_active: Optional[bool] = None
    min_order_qty: Optional[int] = None


class RestockRequest(BaseModel):
    qty: int = Field(..., gt=0, le=1_000_000)


# ---------- Helpers ----------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _enrich(product: dict) -> dict:
    """Add computed display fields."""
    if not product:
        return product
    p = {k: v for k, v in product.items() if not k.startswith("_")}
    avail = int(p.get("inventory_available") or 0)
    reserved = int(p.get("inventory_reserved") or 0)
    p["total_on_hand"] = avail + reserved
    p["is_low_stock"] = avail <= int(p.get("low_stock_threshold") or 0) and (p.get("low_stock_threshold") or 0) > 0
    return p


# ---------- Init ----------

def init_supplier_products_router(*, db):
    global _db
    _db = db
    return supplier_products_router


# ---------- Dashboard ----------

@supplier_products_router.get("/dashboard/stats")
async def supplier_dashboard_stats(supplier: dict = Depends(require_supplier)):
    """KPIs for the supplier dashboard.

    orders_pending and mtd_gmv rely on `supplier_orders` (Phase 10). Until then they are 0.
    """
    supplier_id = supplier["id"]
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    # Products live
    products_live = await _db.supplier_products.count_documents({
        "supplier_id": supplier_id,
        "is_active": True,
        "is_deleted": {"$ne": True},
    })

    # Low-stock count
    pipeline = [
        {"$match": {
            "supplier_id": supplier_id,
            "is_active": True,
            "is_deleted": {"$ne": True},
        }},
        {"$match": {
            "$expr": {
                "$and": [
                    {"$gt": ["$low_stock_threshold", 0]},
                    {"$lte": ["$inventory_available", "$low_stock_threshold"]},
                ]
            }
        }},
        {"$count": "n"},
    ]
    low_stock_docs = await _db.supplier_products.aggregate(pipeline).to_list(length=1)
    low_stock_count = int(low_stock_docs[0]["n"]) if low_stock_docs else 0

    orders_pending = 0
    mtd_gmv = 0.0
    if "supplier_orders" in await _db.list_collection_names():
        orders_pending = await _db.supplier_orders.count_documents({
            "supplier_id": supplier_id,
            "status": {"$in": ["pending", "confirmed", "processing"]},
        })
        gmv_pipe = [
            {"$match": {
                "supplier_id": supplier_id,
                "status": {"$in": ["delivered", "completed", "shipped", "confirmed"]},
                "created_at": {"$gte": month_start},
            }},
            {"$group": {"_id": None, "gmv": {"$sum": "$total_amount"}}},
        ]
        gmv_docs = await _db.supplier_orders.aggregate(gmv_pipe).to_list(length=1)
        mtd_gmv = float(gmv_docs[0]["gmv"]) if gmv_docs else 0.0

    # Categories breakdown for chart
    cat_pipe = [
        {"$match": {
            "supplier_id": supplier_id,
            "is_active": True,
            "is_deleted": {"$ne": True},
        }},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    by_cat = await _db.supplier_products.aggregate(cat_pipe).to_list(length=50)

    return {
        "supplier_id": supplier_id,
        "as_of": now.isoformat(),
        "orders_pending": orders_pending,
        "products_live": products_live,
        "low_stock_count": low_stock_count,
        "mtd_gmv": mtd_gmv,
        "products_by_category": [{"category": c["_id"], "count": c["count"]} for c in by_cat],
    }


# ---------- Products CRUD ----------

@supplier_products_router.get("/products")
async def list_products(
    is_active: Optional[bool] = Query(None),
    category: Optional[str] = Query(None),
    q: Optional[str] = Query(None, description="Search in name/brand"),
    supplier: dict = Depends(require_supplier),
):
    query: dict = {
        "supplier_id": supplier["id"],
        # Always hide soft-deleted products from the supplier's own catalog.
        "is_deleted": {"$ne": True},
    }
    if is_active is not None:
        query["is_active"] = is_active
    if category:
        query["category"] = category
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"brand": {"$regex": q, "$options": "i"}},
        ]
    cursor = _db.supplier_products.find(query, {"_id": 0}).sort("updated_at", -1)
    docs = [_enrich(d) async for d in cursor]
    return {"products": docs, "total": len(docs)}


@supplier_products_router.get("/products/{product_id}")
async def get_product(product_id: str, supplier: dict = Depends(require_supplier)):
    doc = await _db.supplier_products.find_one(
        {"id": product_id, "supplier_id": supplier["id"], "is_deleted": {"$ne": True}},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    return _enrich(doc)


@supplier_products_router.post("/products")
async def create_product(payload: ProductCreate, supplier: dict = Depends(require_supplier)):
    product_id = str(uuid.uuid4())
    now = _now_iso()
    doc = payload.model_dump()
    doc.update({
        "id": product_id,
        "supplier_id": supplier["id"],
        "created_at": now,
        "updated_at": now,
    })
    await _db.supplier_products.insert_one(doc.copy())
    return _enrich(doc)


@supplier_products_router.put("/products/{product_id}")
async def update_product(product_id: str, payload: ProductUpdate, supplier: dict = Depends(require_supplier)):
    existing = await _db.supplier_products.find_one(
        {"id": product_id, "supplier_id": supplier["id"], "is_deleted": {"$ne": True}},
        {"_id": 0},
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")

    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}

    if "unit" in updates and updates["unit"] not in ALLOWED_UNITS:
        raise HTTPException(status_code=400, detail=f"unit must be one of {sorted(ALLOWED_UNITS)}")

    merged = {**existing, **updates}
    if merged.get("selling_price") and merged.get("mrp") and merged["selling_price"] > merged["mrp"]:
        raise HTTPException(status_code=400, detail="selling_price cannot exceed mrp")

    updates["updated_at"] = _now_iso()
    await _db.supplier_products.update_one({"id": product_id}, {"$set": updates})
    new_doc = await _db.supplier_products.find_one({"id": product_id}, {"_id": 0})
    return _enrich(new_doc)


@supplier_products_router.delete("/products/{product_id}")
async def delete_product(product_id: str, supplier: dict = Depends(require_supplier)):
    """Soft delete — sets is_deleted=True. Hides from catalog & marketplace; data preserved.

    Distinct from is_active=False (which is an intentional 'draft' state the supplier
    controls). Once deleted, the product no longer appears in /products list and cannot
    be edited or restocked.
    """
    existing = await _db.supplier_products.find_one(
        {"id": product_id, "supplier_id": supplier["id"], "is_deleted": {"$ne": True}},
        {"_id": 0, "id": 1},
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    now = _now_iso()
    await _db.supplier_products.update_one(
        {"id": product_id},
        {"$set": {
            "is_deleted": True,
            "is_active": False,
            "deleted_at": now,
            "updated_at": now,
        }},
    )
    return {"ok": True, "product_id": product_id, "is_deleted": True}


@supplier_products_router.post("/products/{product_id}/restock")
async def restock_product(product_id: str, payload: RestockRequest, supplier: dict = Depends(require_supplier)):
    existing = await _db.supplier_products.find_one(
        {"id": product_id, "supplier_id": supplier["id"], "is_deleted": {"$ne": True}},
        {"_id": 0},
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    was_zero = int(existing.get("inventory_available") or 0) == 0
    new_avail = int(existing.get("inventory_available") or 0) + payload.qty
    await _db.supplier_products.update_one(
        {"id": product_id},
        {"$set": {"inventory_available": new_avail, "updated_at": _now_iso()}},
    )
    updated = await _db.supplier_products.find_one({"id": product_id}, {"_id": 0})

    # Phase 16 — fire any pending salon notify-me requests when product is back in stock.
    fired = 0
    if was_zero and _in_app_notifier is not None:
        try:
            cursor = _db.stock_notify_requests.find({
                "product_id": product_id,
                "status": "pending",
            }, {"_id": 0})
            ids_to_close: list = []
            async for req in cursor:
                try:
                    await _in_app_notifier(
                        user_type="salon",
                        user_id=req["salon_id"],
                        title="Back in stock",
                        message=f"'{req.get('product_name') or existing.get('name')}' is back in stock and available to order.",
                        notification_type="stock_back",
                        setting_key="stock_back",
                        salon_id=req["salon_id"],
                        related_id=product_id,
                    )
                    ids_to_close.append(req["id"])
                    fired += 1
                except Exception as e:
                    logger.error(f"[supplier_products] notify salon failed: {e}")
            if ids_to_close:
                await _db.stock_notify_requests.update_many(
                    {"id": {"$in": ids_to_close}},
                    {"$set": {"status": "notified", "notified_at": _now_iso()}},
                )
        except Exception as e:
            logger.error(f"[supplier_products] notify-me sweep failed: {e}")

    return {"ok": True, "added_qty": payload.qty, "salon_notifications_sent": fired, "product": _enrich(updated)}


# ---------- Product Samples (read-only catalogue) ----------

@supplier_products_router.get("/product-samples")
async def list_samples(
    category: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    supplier: dict = Depends(require_supplier),  # auth-protected
):
    query: dict = {}
    if category:
        query["category"] = category
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"brand_placeholder": {"$regex": q, "$options": "i"}},
        ]
    cursor = _db.supplier_product_samples.find(query, {"_id": 0}).sort("category", 1)
    docs = await cursor.to_list(length=200)
    return {"samples": docs, "total": len(docs)}


@supplier_products_router.post("/products/from-sample/{sample_id}")
async def create_product_from_sample(sample_id: str, supplier: dict = Depends(require_supplier)):
    sample = await _db.supplier_product_samples.find_one({"id": sample_id}, {"_id": 0})
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    product_id = str(uuid.uuid4())
    now = _now_iso()
    suggested_mrp = float(sample.get("suggested_mrp") or 0) or 1.0
    doc = {
        "id": product_id,
        "supplier_id": supplier["id"],
        "name": sample.get("name") or "Untitled",
        "description": sample.get("description"),
        "brand": sample.get("brand_placeholder"),
        "category": sample.get("category") or "Misc",
        "sub_category": sample.get("sub_category"),
        "images": [sample["sample_image_url"]] if sample.get("sample_image_url") else [],
        "unit": sample.get("unit") if sample.get("unit") in ALLOWED_UNITS else "piece",
        "pack_size": sample.get("pack_size"),
        "mrp": suggested_mrp,
        # default selling price = 85% of MRP (standard supplier wholesale margin)
        "selling_price": round(suggested_mrp * 0.85, 2),
        "gst_percent": float(sample.get("gst_percent") or 0),
        "hsn_code": sample.get("hsn_code"),
        "inventory_available": 0,
        "inventory_reserved": 0,
        "low_stock_threshold": 5,
        "is_active": False,  # supplier should review before publishing
        "min_order_qty": 1,
        "from_sample_id": sample_id,
        "created_at": now,
        "updated_at": now,
    }
    await _db.supplier_products.insert_one(doc.copy())
    return _enrich(doc)
