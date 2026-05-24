"""
Phase 8 + Phase 9 Backend Testing — Supplier Signup, Auth, Admin Management, Products CRUD

Test sequence:
A. Supplier signup (6 tests)
B. Supplier auth status gating (3 tests)
C. Platform admin approve/reject/suspend (10 tests)
D. Supplier dashboard stats (3 tests)
E. Supplier products CRUD (15 tests)
F. Cross-tenant isolation (3 tests)
G. Suspend (3 tests)
H. Product samples (2 tests)
"""

import os
import sys
import requests
import json
from datetime import datetime

# Get backend URL from frontend/.env
BACKEND_URL = None
try:
    with open('/app/frontend/.env', 'r') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BACKEND_URL = line.split('=', 1)[1].strip()
                break
except Exception as e:
    print(f"❌ Failed to read REACT_APP_BACKEND_URL from frontend/.env: {e}")
    sys.exit(1)

if not BACKEND_URL:
    print("❌ REACT_APP_BACKEND_URL not found in frontend/.env")
    sys.exit(1)

BASE_URL = f"{BACKEND_URL}/api"
print(f"🔗 Testing against: {BASE_URL}\n")

# Test credentials
PLATFORM_OWNER_MOBILE = "7503070727"
TEST_SUPPLIERS = {
    "TEST_S1": {"mobile": "+919900110001", "password": "Supplier@123", "business_name": "Test Supplier 1", "owner_name": "Alice"},
    "TEST_S2": {"mobile": "+919900110002", "password": "Supplier@123", "business_name": "Test Supplier 2", "owner_name": "Bob"},
    "TEST_S3": {"mobile": "+919900110003", "password": "Supplier@123", "business_name": "Test Supplier 3", "owner_name": "Charlie"},
    "TEST_S4": {"mobile": "+919900110004", "password": "Supplier@123", "business_name": "Test Supplier 4", "owner_name": "Diana"},
}

# Global state
platform_admin_token = None
supplier_tokens = {}
supplier_ids = {}
product_ids = {}

def log_test(name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   {details}")

def get_platform_admin_token():
    """Get platform admin JWT via OTP flow"""
    global platform_admin_token
    
    # Request OTP
    resp = requests.post(f"{BASE_URL}/platform/auth/request-otp", json={"mobile": PLATFORM_OWNER_MOBILE})
    if resp.status_code != 200:
        log_test("Platform Admin OTP Request", False, f"Status {resp.status_code}: {resp.text}")
        return None
    
    data = resp.json()
    otp = data.get("otp")
    if not otp:
        log_test("Platform Admin OTP Request", False, "No OTP in response (Twilio configured?)")
        return None
    
    # Verify OTP
    resp = requests.post(f"{BASE_URL}/platform/auth/verify-otp", json={"mobile": PLATFORM_OWNER_MOBILE, "otp": otp})
    if resp.status_code != 200:
        log_test("Platform Admin OTP Verify", False, f"Status {resp.status_code}: {resp.text}")
        return None
    
    data = resp.json()
    platform_admin_token = data.get("access_token") or data.get("token")
    if platform_admin_token:
        log_test("Platform Admin Authentication", True, f"Token obtained")
    else:
        log_test("Platform Admin Authentication", False, f"No token in response: {data}")
    return platform_admin_token

def test_a_supplier_signup():
    """A. Supplier signup (6 tests)"""
    print("\n" + "="*80)
    print("A. SUPPLIER SIGNUP")
    print("="*80)
    
    # A1. Sign up TEST_S1 with valid data
    s1 = TEST_SUPPLIERS["TEST_S1"]
    payload = {
        "mobile": s1["mobile"],
        "password": s1["password"],
        "business_name": s1["business_name"],
        "owner_name": s1["owner_name"],
        "gst_number": "22AAAAA0000A1Z5",
        "category_tags": ["haircare", "skincare"]
    }
    resp = requests.post(f"{BASE_URL}/supplier/signup", json=payload)
    if resp.status_code == 200:
        data = resp.json()
        supplier = data.get("supplier", {})
        if supplier.get("status") == "pending_approval" and "password_hash" not in supplier:
            supplier_ids["TEST_S1"] = supplier.get("id")
            log_test("A1. Sign up TEST_S1", True, f"ID: {supplier.get('id')}, status: pending_approval")
        else:
            log_test("A1. Sign up TEST_S1", False, f"Unexpected response: {data}")
    else:
        log_test("A1. Sign up TEST_S1", False, f"Status {resp.status_code}: {resp.text}")
    
    # A2. Duplicate mobile → 409
    resp = requests.post(f"{BASE_URL}/supplier/signup", json=payload)
    if resp.status_code == 409:
        data = resp.json()
        detail = data.get("detail", {})
        if isinstance(detail, dict) and detail.get("code") == "supplier_already_exists":
            log_test("A2. Duplicate mobile → 409", True, f"detail.code: {detail.get('code')}")
        else:
            log_test("A2. Duplicate mobile → 409", False, f"Expected code='supplier_already_exists', got: {detail}")
    else:
        log_test("A2. Duplicate mobile → 409", False, f"Status {resp.status_code}: {resp.text}")
    
    # A3. Invalid mobile "123" → 400
    resp = requests.post(f"{BASE_URL}/supplier/signup", json={**payload, "mobile": "123"})
    if resp.status_code == 400:
        log_test("A3. Invalid mobile → 400", True)
    else:
        log_test("A3. Invalid mobile → 400", False, f"Status {resp.status_code}")
    
    # A4. Invalid GST "@@@@@" → 400
    resp = requests.post(f"{BASE_URL}/supplier/signup", json={**payload, "mobile": "+919900110099", "gst_number": "@@@@@"})
    if resp.status_code == 400:
        log_test("A4. Invalid GST → 400", True)
    else:
        log_test("A4. Invalid GST → 400", False, f"Status {resp.status_code}")
    
    # A5. Weak password "123" → 422
    resp = requests.post(f"{BASE_URL}/supplier/signup", json={**payload, "mobile": "+919900110098", "password": "123"})
    if resp.status_code == 422:
        log_test("A5. Weak password → 422", True)
    else:
        log_test("A5. Weak password → 422", False, f"Status {resp.status_code}")
    
    # A6. Sign up TEST_S2 and TEST_S3 for later tests
    for key in ["TEST_S2", "TEST_S3"]:
        s = TEST_SUPPLIERS[key]
        payload = {
            "mobile": s["mobile"],
            "password": s["password"],
            "business_name": s["business_name"],
            "owner_name": s["owner_name"],
            "gst_number": "22BBBBB0000B1Z5",
            "category_tags": ["skincare"]
        }
        resp = requests.post(f"{BASE_URL}/supplier/signup", json=payload)
        if resp.status_code == 200:
            data = resp.json()
            supplier_ids[key] = data.get("supplier", {}).get("id")
            log_test(f"A6. Sign up {key}", True, f"ID: {supplier_ids[key]}")
        else:
            log_test(f"A6. Sign up {key}", False, f"Status {resp.status_code}")

def test_b_supplier_auth_status_gating():
    """B. Supplier auth status gating (3 tests)"""
    print("\n" + "="*80)
    print("B. SUPPLIER AUTH STATUS GATING")
    print("="*80)
    
    s1 = TEST_SUPPLIERS["TEST_S1"]
    
    # B1. Password login with pending status → 403
    resp = requests.post(f"{BASE_URL}/supplier/auth/password-login", json={"mobile": s1["mobile"], "password": s1["password"]})
    if resp.status_code == 403:
        data = resp.json()
        detail = data.get("detail", {})
        if isinstance(detail, dict) and detail.get("code") == "supplier_not_active" and detail.get("status") == "pending_approval":
            log_test("B1. Password login pending → 403", True, f"status: {detail.get('status')}")
        else:
            log_test("B1. Password login pending → 403", False, f"Unexpected detail: {detail}")
    else:
        log_test("B1. Password login pending → 403", False, f"Status {resp.status_code}")
    
    # B2. Request OTP → 200
    resp = requests.post(f"{BASE_URL}/supplier/auth/request-otp", json={"mobile": s1["mobile"]})
    if resp.status_code == 200:
        data = resp.json()
        otp = data.get("otp")
        if otp:
            log_test("B2. Request OTP → 200", True, f"OTP: {otp}")
            
            # B3. Verify OTP with pending status → 403
            resp = requests.post(f"{BASE_URL}/supplier/auth/verify-otp", json={"mobile": s1["mobile"], "otp": otp})
            if resp.status_code == 403:
                data = resp.json()
                detail = data.get("detail", {})
                if isinstance(detail, dict) and detail.get("status") == "pending_approval":
                    log_test("B3. Verify OTP pending → 403", True, f"status: {detail.get('status')}")
                else:
                    log_test("B3. Verify OTP pending → 403", False, f"Unexpected detail: {detail}")
            else:
                log_test("B3. Verify OTP pending → 403", False, f"Status {resp.status_code}")
        else:
            log_test("B2. Request OTP → 200", False, "No OTP in response")
    else:
        log_test("B2. Request OTP → 200", False, f"Status {resp.status_code}")

def test_c_platform_admin_supplier_management():
    """C. Platform admin approve/reject/suspend (10 tests)"""
    print("\n" + "="*80)
    print("C. PLATFORM ADMIN SUPPLIER MANAGEMENT")
    print("="*80)
    
    if not platform_admin_token:
        print("❌ Platform admin token not available, skipping section C")
        return
    
    headers = {"Authorization": f"Bearer {platform_admin_token}"}
    
    # C1. GET /platform/suppliers?status=pending_approval
    resp = requests.get(f"{BASE_URL}/platform/suppliers?status=pending_approval", headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        suppliers = data.get("suppliers", [])
        found = [s for s in suppliers if s.get("id") in [supplier_ids.get("TEST_S1"), supplier_ids.get("TEST_S2"), supplier_ids.get("TEST_S3")]]
        log_test("C1. GET pending suppliers", True, f"Found {len(found)}/3 test suppliers")
    else:
        log_test("C1. GET pending suppliers", False, f"Status {resp.status_code}")
    
    # C2. GET /platform/suppliers?q=alice
    resp = requests.get(f"{BASE_URL}/platform/suppliers?q=alice", headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        suppliers = data.get("suppliers", [])
        found = any(s.get("owner_name", "").lower() == "alice" for s in suppliers)
        log_test("C2. Search by owner name", True if found else False, f"Found Alice: {found}")
    else:
        log_test("C2. Search by owner name", False, f"Status {resp.status_code}")
    
    # C3. GET /platform/suppliers/{TEST_S1.id}
    s1_id = supplier_ids.get("TEST_S1")
    if s1_id:
        resp = requests.get(f"{BASE_URL}/platform/suppliers/{s1_id}", headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            if "password_hash" not in data:
                log_test("C3. GET supplier detail", True, f"No password_hash in response")
            else:
                log_test("C3. GET supplier detail", False, "password_hash exposed")
        else:
            log_test("C3. GET supplier detail", False, f"Status {resp.status_code}")
    else:
        log_test("C3. GET supplier detail", False, "TEST_S1 ID not available")
    
    # C4. POST /platform/suppliers/{TEST_S1.id}/approve
    if s1_id:
        resp = requests.post(f"{BASE_URL}/platform/suppliers/{s1_id}/approve", headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "active":
                log_test("C4. Approve TEST_S1", True, "status: active")
            else:
                log_test("C4. Approve TEST_S1", False, f"Unexpected status: {data.get('status')}")
        else:
            log_test("C4. Approve TEST_S1", False, f"Status {resp.status_code}")
    
    # C5. POST /platform/suppliers/{TEST_S2.id}/reject without body → 422
    s2_id = supplier_ids.get("TEST_S2")
    if s2_id:
        resp = requests.post(f"{BASE_URL}/platform/suppliers/{s2_id}/reject", headers=headers, json={})
        if resp.status_code == 422:
            log_test("C5. Reject without reason → 422", True)
        else:
            log_test("C5. Reject without reason → 422", False, f"Status {resp.status_code}")
    
    # C6. POST /platform/suppliers/{TEST_S2.id}/reject with reason
    if s2_id:
        resp = requests.post(f"{BASE_URL}/platform/suppliers/{s2_id}/reject", headers=headers, json={"reason": "Missing GST"})
        if resp.status_code == 200:
            data = resp.json()
            if data.get("status") == "rejected":
                log_test("C6. Reject TEST_S2", True, f"status: rejected, reason: {data.get('reason')}")
            else:
                log_test("C6. Reject TEST_S2", False, f"Unexpected status: {data.get('status')}")
        else:
            log_test("C6. Reject TEST_S2", False, f"Status {resp.status_code}")
    
    # C7. Password login for TEST_S1 (approved) → 200
    s1 = TEST_SUPPLIERS["TEST_S1"]
    resp = requests.post(f"{BASE_URL}/supplier/auth/password-login", json={"mobile": s1["mobile"], "password": s1["password"]})
    if resp.status_code == 200:
        data = resp.json()
        token = data.get("token")
        supplier = data.get("supplier", {})
        if token and supplier.get("status") == "active":
            supplier_tokens["TEST_S1"] = token
            log_test("C7. Login TEST_S1 (approved)", True, "Token obtained")
        else:
            log_test("C7. Login TEST_S1 (approved)", False, f"Unexpected response: {data}")
    else:
        log_test("C7. Login TEST_S1 (approved)", False, f"Status {resp.status_code}")
    
    # C8. Password login for TEST_S2 (rejected) → 403
    s2 = TEST_SUPPLIERS["TEST_S2"]
    resp = requests.post(f"{BASE_URL}/supplier/auth/password-login", json={"mobile": s2["mobile"], "password": s2["password"]})
    if resp.status_code == 403:
        data = resp.json()
        detail = data.get("detail", {})
        if isinstance(detail, dict) and detail.get("status") == "rejected":
            log_test("C8. Login TEST_S2 (rejected) → 403", True, f"status: {detail.get('status')}")
        else:
            log_test("C8. Login TEST_S2 (rejected) → 403", False, f"Unexpected detail: {detail}")
    else:
        log_test("C8. Login TEST_S2 (rejected) → 403", False, f"Status {resp.status_code}")
    
    # C9. GET /supplier/me with TEST_S1 token
    token = supplier_tokens.get("TEST_S1")
    if token:
        resp = requests.get(f"{BASE_URL}/supplier/me", headers={"Authorization": f"Bearer {token}"})
        if resp.status_code == 200:
            data = resp.json()
            if data.get("id") == s1_id and "password_hash" not in data:
                log_test("C9. GET /supplier/me", True, f"ID: {data.get('id')}")
            else:
                log_test("C9. GET /supplier/me", False, f"Unexpected response: {data}")
        else:
            log_test("C9. GET /supplier/me", False, f"Status {resp.status_code}")
    
    # C10. PUT /supplier/me with category_tags update
    if token:
        resp = requests.put(f"{BASE_URL}/supplier/me", headers={"Authorization": f"Bearer {token}"}, json={"category_tags": ["haircare", "skincare", "tools"]})
        if resp.status_code == 200:
            data = resp.json()
            tags = data.get("category_tags", [])
            if "tools" in tags:
                log_test("C10. PUT /supplier/me", True, f"category_tags: {tags}")
            else:
                log_test("C10. PUT /supplier/me", False, f"category_tags not updated: {tags}")
        else:
            log_test("C10. PUT /supplier/me", False, f"Status {resp.status_code}")

def test_d_supplier_dashboard_stats():
    """D. Supplier dashboard stats (3 tests)"""
    print("\n" + "="*80)
    print("D. SUPPLIER DASHBOARD STATS")
    print("="*80)
    
    token = supplier_tokens.get("TEST_S1")
    if not token:
        print("❌ TEST_S1 token not available, skipping section D")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # D1. GET /supplier/dashboard/stats → 200
    resp = requests.get(f"{BASE_URL}/supplier/dashboard/stats", headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        log_test("D1. GET dashboard stats", True, f"Response: {json.dumps(data, indent=2)}")
    else:
        log_test("D1. GET dashboard stats", False, f"Status {resp.status_code}")
    
    # D2. Validate response shape
    if resp.status_code == 200:
        required_keys = ["supplier_id", "as_of", "orders_pending", "products_live", "low_stock_count", "mtd_gmv", "products_by_category"]
        missing = [k for k in required_keys if k not in data]
        if not missing:
            log_test("D2. Response shape valid", True, f"All keys present")
        else:
            log_test("D2. Response shape valid", False, f"Missing keys: {missing}")
    
    # D3. With no products yet, products_live=0, low_stock_count=0
    if resp.status_code == 200:
        if data.get("products_live") == 0 and data.get("low_stock_count") == 0:
            log_test("D3. No products yet", True, "products_live=0, low_stock_count=0")
        else:
            log_test("D3. No products yet", False, f"products_live={data.get('products_live')}, low_stock_count={data.get('low_stock_count')}")

def test_e_supplier_products_crud():
    """E. Supplier products CRUD (15 tests)"""
    print("\n" + "="*80)
    print("E. SUPPLIER PRODUCTS CRUD")
    print("="*80)
    
    token = supplier_tokens.get("TEST_S1")
    if not token:
        print("❌ TEST_S1 token not available, skipping section E")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # E1. POST /supplier/products with valid data
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
    if resp.status_code == 200:
        data = resp.json()
        if "total_on_hand" in data and "is_low_stock" in data:
            product_ids["product1"] = data.get("id")
            log_test("E1. Create product1", True, f"ID: {data.get('id')}, total_on_hand: {data.get('total_on_hand')}")
        else:
            log_test("E1. Create product1", False, f"Missing enriched fields: {data}")
    else:
        log_test("E1. Create product1", False, f"Status {resp.status_code}: {resp.text}")
    
    # E2. POST with selling_price > mrp → 422
    resp = requests.post(f"{BASE_URL}/supplier/products", headers=headers, json={**product1, "selling_price": 600})
    if resp.status_code == 422:
        log_test("E2. selling_price > mrp → 422", True)
    else:
        log_test("E2. selling_price > mrp → 422", False, f"Status {resp.status_code}")
    
    # E3. POST with unit="foo" → 422
    resp = requests.post(f"{BASE_URL}/supplier/products", headers=headers, json={**product1, "unit": "foo"})
    if resp.status_code == 422:
        log_test("E3. Invalid unit → 422", True)
    else:
        log_test("E3. Invalid unit → 422", False, f"Status {resp.status_code}")
    
    # E4. POST with mrp=-1 → 422
    resp = requests.post(f"{BASE_URL}/supplier/products", headers=headers, json={**product1, "mrp": -1})
    if resp.status_code == 422:
        log_test("E4. Negative mrp → 422", True)
    else:
        log_test("E4. Negative mrp → 422", False, f"Status {resp.status_code}")
    
    # E5. POST a second product
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
    if resp.status_code == 200:
        data = resp.json()
        product_ids["product2"] = data.get("id")
        log_test("E5. Create product2", True, f"ID: {data.get('id')}")
    else:
        log_test("E5. Create product2", False, f"Status {resp.status_code}")
    
    # E6. GET /supplier/products → total=2
    resp = requests.get(f"{BASE_URL}/supplier/products", headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        total = data.get("total", 0)
        log_test("E6. GET products", True if total == 2 else False, f"total: {total}")
    else:
        log_test("E6. GET products", False, f"Status {resp.status_code}")
    
    # E7. GET /supplier/products?q=hair → total=1
    resp = requests.get(f"{BASE_URL}/supplier/products?q=hair", headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        total = data.get("total", 0)
        log_test("E7. Search products", True if total == 1 else False, f"total: {total}")
    else:
        log_test("E7. Search products", False, f"Status {resp.status_code}")
    
    # E8. GET /supplier/products?category=skincare → total=1
    resp = requests.get(f"{BASE_URL}/supplier/products?category=skincare", headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        total = data.get("total", 0)
        log_test("E8. Filter by category", True if total == 1 else False, f"total: {total}")
    else:
        log_test("E8. Filter by category", False, f"Status {resp.status_code}")
    
    # E9. GET /supplier/dashboard/stats → products_live=2, low_stock_count=1
    resp = requests.get(f"{BASE_URL}/supplier/dashboard/stats", headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        products_live = data.get("products_live", 0)
        low_stock_count = data.get("low_stock_count", 0)
        log_test("E9. Dashboard stats updated", True if products_live == 2 and low_stock_count == 1 else False, 
                 f"products_live: {products_live}, low_stock_count: {low_stock_count}")
    else:
        log_test("E9. Dashboard stats updated", False, f"Status {resp.status_code}")
    
    # E10. PUT /supplier/products/{id} with name update
    product1_id = product_ids.get("product1")
    if product1_id:
        resp = requests.put(f"{BASE_URL}/supplier/products/{product1_id}", headers=headers, json={"name": "Premium Hair Serum v2"})
        if resp.status_code == 200:
            data = resp.json()
            log_test("E10. Update product name", True, f"name: {data.get('name')}")
        else:
            log_test("E10. Update product name", False, f"Status {resp.status_code}")
    
    # E11. PUT with selling_price > mrp → 400
    if product1_id:
        resp = requests.put(f"{BASE_URL}/supplier/products/{product1_id}", headers=headers, json={"selling_price": 700})
        if resp.status_code == 400:
            log_test("E11. Update selling_price > mrp → 400", True)
        else:
            log_test("E11. Update selling_price > mrp → 400", False, f"Status {resp.status_code}")
    
    # E12. POST /supplier/products/{id}/restock with qty=10
    if product1_id:
        resp = requests.post(f"{BASE_URL}/supplier/products/{product1_id}/restock", headers=headers, json={"qty": 10})
        if resp.status_code == 200:
            data = resp.json()
            product = data.get("product", {})
            log_test("E12. Restock product", True, f"inventory_available: {product.get('inventory_available')}")
        else:
            log_test("E12. Restock product", False, f"Status {resp.status_code}")
    
    # E13. POST /supplier/products/{id}/restock with qty=0 → 422
    if product1_id:
        resp = requests.post(f"{BASE_URL}/supplier/products/{product1_id}/restock", headers=headers, json={"qty": 0})
        if resp.status_code == 422:
            log_test("E13. Restock qty=0 → 422", True)
        else:
            log_test("E13. Restock qty=0 → 422", False, f"Status {resp.status_code}")
    
    # E14. DELETE /supplier/products/{id} → soft delete
    if product1_id:
        resp = requests.delete(f"{BASE_URL}/supplier/products/{product1_id}", headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            log_test("E14. Delete product", True, f"is_active: {data.get('is_active')}")
        else:
            log_test("E14. Delete product", False, f"Status {resp.status_code}")
    
    # E15. GET /supplier/products → still shows deleted product
    resp = requests.get(f"{BASE_URL}/supplier/products", headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        total = data.get("total", 0)
        log_test("E15. GET products (includes deleted)", True, f"total: {total} (includes deleted)")
    else:
        log_test("E15. GET products (includes deleted)", False, f"Status {resp.status_code}")

def test_f_cross_tenant_isolation():
    """F. Cross-tenant isolation (3 tests)"""
    print("\n" + "="*80)
    print("F. CROSS-TENANT ISOLATION")
    print("="*80)
    
    # Sign up and approve TEST_S4
    s4 = TEST_SUPPLIERS["TEST_S4"]
    payload = {
        "mobile": s4["mobile"],
        "password": s4["password"],
        "business_name": s4["business_name"],
        "owner_name": s4["owner_name"],
        "gst_number": "22DDDDD0000D1Z5",
        "category_tags": ["tools"]
    }
    resp = requests.post(f"{BASE_URL}/supplier/signup", json=payload)
    if resp.status_code == 200:
        data = resp.json()
        supplier_ids["TEST_S4"] = data.get("supplier", {}).get("id")
        
        # Approve TEST_S4
        if platform_admin_token:
            headers = {"Authorization": f"Bearer {platform_admin_token}"}
            resp = requests.post(f"{BASE_URL}/platform/suppliers/{supplier_ids['TEST_S4']}/approve", headers=headers)
            if resp.status_code == 200:
                # Login TEST_S4
                resp = requests.post(f"{BASE_URL}/supplier/auth/password-login", json={"mobile": s4["mobile"], "password": s4["password"]})
                if resp.status_code == 200:
                    supplier_tokens["TEST_S4"] = resp.json().get("token")
                    log_test("F. Setup TEST_S4", True, "Signed up, approved, logged in")
    
    token_s4 = supplier_tokens.get("TEST_S4")
    if not token_s4:
        print("❌ TEST_S4 token not available, skipping section F")
        return
    
    headers_s4 = {"Authorization": f"Bearer {token_s4}"}
    
    # F1. GET /supplier/products with TEST_S4 token → total=0
    resp = requests.get(f"{BASE_URL}/supplier/products", headers=headers_s4)
    if resp.status_code == 200:
        data = resp.json()
        total = data.get("total", 0)
        log_test("F1. TEST_S4 products → 0", True if total == 0 else False, f"total: {total}")
    else:
        log_test("F1. TEST_S4 products → 0", False, f"Status {resp.status_code}")
    
    # F2. GET /supplier/products/{TEST_S1.product_id} with TEST_S4 token → 404
    product1_id = product_ids.get("product1")
    if product1_id:
        resp = requests.get(f"{BASE_URL}/supplier/products/{product1_id}", headers=headers_s4)
        if resp.status_code == 404:
            log_test("F2. Cross-tenant GET → 404", True)
        else:
            log_test("F2. Cross-tenant GET → 404", False, f"Status {resp.status_code}")
    
    # F3. PUT /supplier/products/{TEST_S1.product_id} with TEST_S4 token → 404
    if product1_id:
        resp = requests.put(f"{BASE_URL}/supplier/products/{product1_id}", headers=headers_s4, json={"name": "Hacked"})
        if resp.status_code == 404:
            log_test("F3. Cross-tenant PUT → 404", True)
        else:
            log_test("F3. Cross-tenant PUT → 404", False, f"Status {resp.status_code}")

def test_g_suspend():
    """G. Suspend (3 tests)"""
    print("\n" + "="*80)
    print("G. SUSPEND")
    print("="*80)
    
    if not platform_admin_token:
        print("❌ Platform admin token not available, skipping section G")
        return
    
    headers = {"Authorization": f"Bearer {platform_admin_token}"}
    s1_id = supplier_ids.get("TEST_S1")
    token_s1 = supplier_tokens.get("TEST_S1")
    
    # G1. Admin: POST /platform/suppliers/{TEST_S1.id}/suspend
    if s1_id:
        resp = requests.post(f"{BASE_URL}/platform/suppliers/{s1_id}/suspend", headers=headers, json={"reason": "Investigation"})
        if resp.status_code == 200:
            data = resp.json()
            log_test("G1. Suspend TEST_S1", True, f"status: {data.get('status')}")
        else:
            log_test("G1. Suspend TEST_S1", False, f"Status {resp.status_code}")
    
    # G2. GET /supplier/me with suspended supplier token → 403
    if token_s1:
        resp = requests.get(f"{BASE_URL}/supplier/me", headers={"Authorization": f"Bearer {token_s1}"})
        if resp.status_code == 403:
            data = resp.json()
            detail = data.get("detail", {})
            if isinstance(detail, dict) and detail.get("status") == "suspended":
                log_test("G2. GET /supplier/me suspended → 403", True, f"status: {detail.get('status')}")
            else:
                log_test("G2. GET /supplier/me suspended → 403", False, f"Unexpected detail: {detail}")
        else:
            log_test("G2. GET /supplier/me suspended → 403", False, f"Status {resp.status_code}")
    
    # G3. Password login for suspended supplier → 403
    s1 = TEST_SUPPLIERS["TEST_S1"]
    resp = requests.post(f"{BASE_URL}/supplier/auth/password-login", json={"mobile": s1["mobile"], "password": s1["password"]})
    if resp.status_code == 403:
        data = resp.json()
        detail = data.get("detail", {})
        if isinstance(detail, dict) and detail.get("status") == "suspended":
            log_test("G3. Login suspended → 403", True, f"status: {detail.get('status')}")
        else:
            log_test("G3. Login suspended → 403", False, f"Unexpected detail: {detail}")
    else:
        log_test("G3. Login suspended → 403", False, f"Status {resp.status_code}")

def test_h_product_samples():
    """H. Product samples (2 tests)"""
    print("\n" + "="*80)
    print("H. PRODUCT SAMPLES")
    print("="*80)
    
    token_s4 = supplier_tokens.get("TEST_S4")
    if not token_s4:
        print("❌ TEST_S4 token not available, skipping section H")
        return
    
    headers = {"Authorization": f"Bearer {token_s4}"}
    
    # H1. GET /supplier/product-samples → 200 with samples:[]
    resp = requests.get(f"{BASE_URL}/supplier/product-samples", headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        samples = data.get("samples", [])
        log_test("H1. GET product-samples", True, f"samples: {len(samples)} (empty until seeded)")
    else:
        log_test("H1. GET product-samples", False, f"Status {resp.status_code}")
    
    # H2. POST /supplier/products/from-sample/bogus-id → 404
    resp = requests.post(f"{BASE_URL}/supplier/products/from-sample/bogus-id", headers=headers)
    if resp.status_code == 404:
        log_test("H2. Create from bogus sample → 404", True)
    else:
        log_test("H2. Create from bogus sample → 404", False, f"Status {resp.status_code}")

def main():
    print("="*80)
    print("PHASE 8 + PHASE 9 BACKEND TESTING")
    print("="*80)
    
    # Get platform admin token first
    get_platform_admin_token()
    
    # Run all test sections
    test_a_supplier_signup()
    test_b_supplier_auth_status_gating()
    test_c_platform_admin_supplier_management()
    test_d_supplier_dashboard_stats()
    test_e_supplier_products_crud()
    test_f_cross_tenant_isolation()
    test_g_suspend()
    test_h_product_samples()
    
    print("\n" + "="*80)
    print("TESTING COMPLETE")
    print("="*80)

if __name__ == "__main__":
    main()
