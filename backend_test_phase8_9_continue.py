"""
Phase 8 + Phase 9 Backend Testing — Continue from existing suppliers
"""

import requests
import json

BASE_URL = "https://mvp-error-debug.preview.emergentagent.com/api"
PLATFORM_OWNER_MOBILE = "7503070727"

# Test supplier IDs (from previous run)
SUPPLIER_IDS = {
    "TEST_S1": "fb092f4c-1dff-4062-b125-0c1922ea298f",
    "TEST_S2": "97c49ea1-dc9f-4182-a8e4-561194dda135",
    "TEST_S3": "5259fcaf-569f-4caa-aa22-e93eddf7ed19",
    "TEST_S4": "2a472dea-be49-4399-962c-742d9c3c04e4",
}

TEST_SUPPLIERS = {
    "TEST_S1": {"mobile": "+919900110001", "password": "Supplier@123"},
    "TEST_S2": {"mobile": "+919900110002", "password": "Supplier@123"},
    "TEST_S3": {"mobile": "+919900110003", "password": "Supplier@123"},
    "TEST_S4": {"mobile": "+919900110004", "password": "Supplier@123"},
}

def get_platform_admin_token():
    resp = requests.post(f"{BASE_URL}/platform/auth/request-otp", json={"mobile": PLATFORM_OWNER_MOBILE})
    otp = resp.json().get("otp")
    resp = requests.post(f"{BASE_URL}/platform/auth/verify-otp", json={"mobile": PLATFORM_OWNER_MOBILE, "otp": otp})
    return resp.json().get("access_token")

def log(msg):
    print(msg)

# Get platform admin token
admin_token = get_platform_admin_token()
admin_headers = {"Authorization": f"Bearer {admin_token}"}

log("="*80)
log("C. PLATFORM ADMIN SUPPLIER MANAGEMENT (continued)")
log("="*80)

# C3. GET supplier detail
resp = requests.get(f"{BASE_URL}/platform/suppliers/{SUPPLIER_IDS['TEST_S1']}", headers=admin_headers)
log(f"C3. GET supplier detail: {resp.status_code}")
if resp.status_code == 200:
    data = resp.json()
    log(f"   ✅ No password_hash: {'password_hash' not in data}")
else:
    log(f"   ❌ Failed: {resp.text}")

# C4. Approve TEST_S1
resp = requests.post(f"{BASE_URL}/platform/suppliers/{SUPPLIER_IDS['TEST_S1']}/approve", headers=admin_headers)
log(f"C4. Approve TEST_S1: {resp.status_code}")
if resp.status_code == 200:
    log(f"   ✅ Status: {resp.json().get('status')}")
else:
    log(f"   ❌ Failed: {resp.text}")

# C5. Reject TEST_S2 without reason → 422
resp = requests.post(f"{BASE_URL}/platform/suppliers/{SUPPLIER_IDS['TEST_S2']}/reject", headers=admin_headers, json={})
log(f"C5. Reject without reason: {resp.status_code}")
log(f"   ✅ Expected 422: {resp.status_code == 422}")

# C6. Reject TEST_S2 with reason
resp = requests.post(f"{BASE_URL}/platform/suppliers/{SUPPLIER_IDS['TEST_S2']}/reject", headers=admin_headers, json={"reason": "Missing GST"})
log(f"C6. Reject TEST_S2: {resp.status_code}")
if resp.status_code == 200:
    log(f"   ✅ Status: {resp.json().get('status')}, reason: {resp.json().get('reason')}")
else:
    log(f"   ❌ Failed: {resp.text}")

# C7. Login TEST_S1 (approved)
resp = requests.post(f"{BASE_URL}/supplier/auth/password-login", json={"mobile": TEST_SUPPLIERS['TEST_S1']['mobile'], "password": TEST_SUPPLIERS['TEST_S1']['password']})
log(f"C7. Login TEST_S1 (approved): {resp.status_code}")
if resp.status_code == 200:
    s1_token = resp.json().get("token")
    log(f"   ✅ Token obtained")
else:
    log(f"   ❌ Failed: {resp.text}")
    s1_token = None

# C8. Login TEST_S2 (rejected) → 403
resp = requests.post(f"{BASE_URL}/supplier/auth/password-login", json={"mobile": TEST_SUPPLIERS['TEST_S2']['mobile'], "password": TEST_SUPPLIERS['TEST_S2']['password']})
log(f"C8. Login TEST_S2 (rejected): {resp.status_code}")
if resp.status_code == 403:
    detail = resp.json().get("detail", {})
    log(f"   ✅ Status: {detail.get('status')}")
else:
    log(f"   ❌ Expected 403, got {resp.status_code}")

# C9. GET /supplier/me
if s1_token:
    resp = requests.get(f"{BASE_URL}/supplier/me", headers={"Authorization": f"Bearer {s1_token}"})
    log(f"C9. GET /supplier/me: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        log(f"   ✅ ID: {data.get('id')}, no password_hash: {'password_hash' not in data}")
    else:
        log(f"   ❌ Failed: {resp.text}")

# C10. PUT /supplier/me
if s1_token:
    resp = requests.put(f"{BASE_URL}/supplier/me", headers={"Authorization": f"Bearer {s1_token}"}, json={"category_tags": ["haircare", "skincare", "tools"]})
    log(f"C10. PUT /supplier/me: {resp.status_code}")
    if resp.status_code == 200:
        tags = resp.json().get("category_tags", [])
        log(f"   ✅ category_tags: {tags}")
    else:
        log(f"   ❌ Failed: {resp.text}")

log("\n" + "="*80)
log("D. SUPPLIER DASHBOARD STATS")
log("="*80)

if s1_token:
    headers = {"Authorization": f"Bearer {s1_token}"}
    
    # D1. GET dashboard stats
    resp = requests.get(f"{BASE_URL}/supplier/dashboard/stats", headers=headers)
    log(f"D1. GET dashboard stats: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        log(f"   ✅ Response: {json.dumps(data, indent=2)}")
        
        # D2. Validate shape
        required = ["supplier_id", "as_of", "orders_pending", "products_live", "low_stock_count", "mtd_gmv", "products_by_category"]
        missing = [k for k in required if k not in data]
        log(f"D2. Response shape: {'✅ Valid' if not missing else f'❌ Missing: {missing}'}")
        
        # D3. No products yet
        log(f"D3. No products: ✅ products_live={data.get('products_live')}, low_stock_count={data.get('low_stock_count')}")
    else:
        log(f"   ❌ Failed: {resp.text}")

log("\n" + "="*80)
log("E. SUPPLIER PRODUCTS CRUD")
log("="*80)

if s1_token:
    headers = {"Authorization": f"Bearer {s1_token}"}
    
    # E1. Create product1
    product1 = {
        "name": "Premium Hair Serum",
        "brand": "BrandX",
        "category": "haircare",
        "unit": "ml",
        "pack_size": "100ml",
        "mrp": 499.0,
        "selling_price": 399.0,
        "gst_percent": 18,
        "inventory_available": 50,
        "low_stock_threshold": 10
    }
    resp = requests.post(f"{BASE_URL}/supplier/products", headers=headers, json=product1)
    log(f"E1. Create product1: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        product1_id = data.get("id")
        log(f"   ✅ ID: {product1_id}, total_on_hand: {data.get('total_on_hand')}, is_low_stock: {data.get('is_low_stock')}")
    else:
        log(f"   ❌ Failed: {resp.text}")
        product1_id = None
    
    # E2. selling_price > mrp → 422
    resp = requests.post(f"{BASE_URL}/supplier/products", headers=headers, json={**product1, "selling_price": 600})
    log(f"E2. selling_price > mrp: {resp.status_code} ({'✅' if resp.status_code == 422 else '❌'})")
    
    # E3. Invalid unit → 422
    resp = requests.post(f"{BASE_URL}/supplier/products", headers=headers, json={**product1, "unit": "foo"})
    log(f"E3. Invalid unit: {resp.status_code} ({'✅' if resp.status_code == 422 else '❌'})")
    
    # E4. Negative mrp → 422
    resp = requests.post(f"{BASE_URL}/supplier/products", headers=headers, json={**product1, "mrp": -1})
    log(f"E4. Negative mrp: {resp.status_code} ({'✅' if resp.status_code == 422 else '❌'})")
    
    # E5. Create product2
    product2 = {
        "name": "Skin Toner",
        "category": "skincare",
        "unit": "ml",
        "mrp": 250,
        "selling_price": 250,
        "inventory_available": 3,
        "low_stock_threshold": 5
    }
    resp = requests.post(f"{BASE_URL}/supplier/products", headers=headers, json=product2)
    log(f"E5. Create product2: {resp.status_code}")
    if resp.status_code == 200:
        product2_id = resp.json().get("id")
        log(f"   ✅ ID: {product2_id}")
    else:
        log(f"   ❌ Failed: {resp.text}")
        product2_id = None
    
    # E6. GET products → total=2
    resp = requests.get(f"{BASE_URL}/supplier/products", headers=headers)
    log(f"E6. GET products: {resp.status_code}")
    if resp.status_code == 200:
        total = resp.json().get("total", 0)
        log(f"   {'✅' if total == 2 else '❌'} total: {total}")
    
    # E7. Search products
    resp = requests.get(f"{BASE_URL}/supplier/products?q=hair", headers=headers)
    log(f"E7. Search products: {resp.status_code}")
    if resp.status_code == 200:
        total = resp.json().get("total", 0)
        log(f"   {'✅' if total == 1 else '❌'} total: {total}")
    
    # E8. Filter by category
    resp = requests.get(f"{BASE_URL}/supplier/products?category=skincare", headers=headers)
    log(f"E8. Filter by category: {resp.status_code}")
    if resp.status_code == 200:
        total = resp.json().get("total", 0)
        log(f"   {'✅' if total == 1 else '❌'} total: {total}")
    
    # E9. Dashboard stats updated
    resp = requests.get(f"{BASE_URL}/supplier/dashboard/stats", headers=headers)
    log(f"E9. Dashboard stats updated: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        log(f"   {'✅' if data.get('products_live') == 2 and data.get('low_stock_count') == 1 else '❌'} products_live: {data.get('products_live')}, low_stock_count: {data.get('low_stock_count')}")
    
    # E10. Update product name
    if product1_id:
        resp = requests.put(f"{BASE_URL}/supplier/products/{product1_id}", headers=headers, json={"name": "Premium Hair Serum v2"})
        log(f"E10. Update product name: {resp.status_code}")
        if resp.status_code == 200:
            log(f"   ✅ name: {resp.json().get('name')}")
    
    # E11. Update selling_price > mrp → 400
    if product1_id:
        resp = requests.put(f"{BASE_URL}/supplier/products/{product1_id}", headers=headers, json={"selling_price": 700})
        log(f"E11. Update selling_price > mrp: {resp.status_code} ({'✅' if resp.status_code == 400 else '❌'})")
    
    # E12. Restock
    if product1_id:
        resp = requests.post(f"{BASE_URL}/supplier/products/{product1_id}/restock", headers=headers, json={"qty": 10})
        log(f"E12. Restock: {resp.status_code}")
        if resp.status_code == 200:
            log(f"   ✅ inventory_available: {resp.json().get('product', {}).get('inventory_available')}")
    
    # E13. Restock qty=0 → 422
    if product1_id:
        resp = requests.post(f"{BASE_URL}/supplier/products/{product1_id}/restock", headers=headers, json={"qty": 0})
        log(f"E13. Restock qty=0: {resp.status_code} ({'✅' if resp.status_code == 422 else '❌'})")
    
    # E14. Delete product
    if product1_id:
        resp = requests.delete(f"{BASE_URL}/supplier/products/{product1_id}", headers=headers)
        log(f"E14. Delete product: {resp.status_code}")
        if resp.status_code == 200:
            log(f"   ✅ is_active: {resp.json().get('is_active')}")
    
    # E15. GET products (includes deleted)
    resp = requests.get(f"{BASE_URL}/supplier/products", headers=headers)
    log(f"E15. GET products (includes deleted): {resp.status_code}")
    if resp.status_code == 200:
        log(f"   ✅ total: {resp.json().get('total')}")

log("\n" + "="*80)
log("F. CROSS-TENANT ISOLATION")
log("="*80)

# Approve TEST_S4
resp = requests.post(f"{BASE_URL}/platform/suppliers/{SUPPLIER_IDS['TEST_S4']}/approve", headers=admin_headers)
log(f"F. Approve TEST_S4: {resp.status_code}")

# Login TEST_S4
resp = requests.post(f"{BASE_URL}/supplier/auth/password-login", json={"mobile": TEST_SUPPLIERS['TEST_S4']['mobile'], "password": TEST_SUPPLIERS['TEST_S4']['password']})
log(f"F. Login TEST_S4: {resp.status_code}")
if resp.status_code == 200:
    s4_token = resp.json().get("token")
    s4_headers = {"Authorization": f"Bearer {s4_token}"}
    
    # F1. GET products → 0
    resp = requests.get(f"{BASE_URL}/supplier/products", headers=s4_headers)
    log(f"F1. TEST_S4 products: {resp.status_code}")
    if resp.status_code == 200:
        total = resp.json().get("total", 0)
        log(f"   {'✅' if total == 0 else '❌'} total: {total}")
    
    # F2. Cross-tenant GET → 404
    if product1_id:
        resp = requests.get(f"{BASE_URL}/supplier/products/{product1_id}", headers=s4_headers)
        log(f"F2. Cross-tenant GET: {resp.status_code} ({'✅' if resp.status_code == 404 else '❌'})")
    
    # F3. Cross-tenant PUT → 404
    if product1_id:
        resp = requests.put(f"{BASE_URL}/supplier/products/{product1_id}", headers=s4_headers, json={"name": "Hacked"})
        log(f"F3. Cross-tenant PUT: {resp.status_code} ({'✅' if resp.status_code == 404 else '❌'})")
else:
    log(f"   ❌ Failed to login TEST_S4")

log("\n" + "="*80)
log("G. SUSPEND")
log("="*80)

# G1. Suspend TEST_S1
resp = requests.post(f"{BASE_URL}/platform/suppliers/{SUPPLIER_IDS['TEST_S1']}/suspend", headers=admin_headers, json={"reason": "Investigation"})
log(f"G1. Suspend TEST_S1: {resp.status_code}")
if resp.status_code == 200:
    log(f"   ✅ status: {resp.json().get('status')}")

# G2. GET /supplier/me with suspended token → 403
if s1_token:
    resp = requests.get(f"{BASE_URL}/supplier/me", headers={"Authorization": f"Bearer {s1_token}"})
    log(f"G2. GET /supplier/me suspended: {resp.status_code}")
    if resp.status_code == 403:
        detail = resp.json().get("detail", {})
        log(f"   {'✅' if detail.get('status') == 'suspended' else '❌'} status: {detail.get('status')}")

# G3. Login suspended → 403
resp = requests.post(f"{BASE_URL}/supplier/auth/password-login", json={"mobile": TEST_SUPPLIERS['TEST_S1']['mobile'], "password": TEST_SUPPLIERS['TEST_S1']['password']})
log(f"G3. Login suspended: {resp.status_code}")
if resp.status_code == 403:
    detail = resp.json().get("detail", {})
    log(f"   {'✅' if detail.get('status') == 'suspended' else '❌'} status: {detail.get('status')}")

log("\n" + "="*80)
log("H. PRODUCT SAMPLES")
log("="*80)

if s4_token:
    s4_headers = {"Authorization": f"Bearer {s4_token}"}
    
    # H1. GET product-samples
    resp = requests.get(f"{BASE_URL}/supplier/product-samples", headers=s4_headers)
    log(f"H1. GET product-samples: {resp.status_code}")
    if resp.status_code == 200:
        samples = resp.json().get("samples", [])
        log(f"   ✅ samples: {len(samples)} (empty until seeded)")
    
    # H2. Create from bogus sample → 404
    resp = requests.post(f"{BASE_URL}/supplier/products/from-sample/bogus-id", headers=s4_headers)
    log(f"H2. Create from bogus sample: {resp.status_code} ({'✅' if resp.status_code == 404 else '❌'})")

log("\n" + "="*80)
log("TESTING COMPLETE")
log("="*80)
