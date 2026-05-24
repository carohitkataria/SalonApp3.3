#!/usr/bin/env python3
"""
Phase 6 + Phase 7 Backend Testing Script
Tests platform admin dashboard, broadcasts, and discount code flows
"""

import requests
import json
import os
from datetime import datetime, timedelta

# Read backend URL from frontend/.env
BACKEND_URL = "https://phase6-plus.preview.emergentagent.com/api"

# Platform admin mobile from backend/.env
PLATFORM_OWNER_MOBILE = "7503070727"

# Test results tracking
test_results = {
    "passed": [],
    "failed": [],
    "total": 0
}

def log_test(name, passed, details=""):
    """Log test result"""
    test_results["total"] += 1
    if passed:
        test_results["passed"].append(name)
        print(f"✅ PASS: {name}")
    else:
        test_results["failed"].append({"name": name, "details": details})
        print(f"❌ FAIL: {name}")
        if details:
            print(f"   Details: {details}")

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"Total Tests: {test_results['total']}")
    print(f"Passed: {len(test_results['passed'])}")
    print(f"Failed: {len(test_results['failed'])}")
    print(f"Pass Rate: {len(test_results['passed'])/test_results['total']*100:.1f}%")
    
    if test_results['failed']:
        print("\n❌ FAILED TESTS:")
        for fail in test_results['failed']:
            print(f"  - {fail['name']}")
            if fail['details']:
                print(f"    {fail['details']}")
    print("="*80)

# ============================================================================
# AUTH SETUP
# ============================================================================

def get_platform_admin_token():
    """Get platform admin JWT via OTP flow"""
    print("\n" + "="*80)
    print("PLATFORM ADMIN AUTH SETUP")
    print("="*80)
    
    # Step 1: Request OTP
    print(f"\n1. Requesting OTP for platform admin: {PLATFORM_OWNER_MOBILE}")
    resp = requests.post(
        f"{BACKEND_URL}/platform/auth/request-otp",
        json={"mobile": PLATFORM_OWNER_MOBILE}
    )
    
    if resp.status_code != 200:
        print(f"❌ Failed to request OTP: {resp.status_code} - {resp.text}")
        return None
    
    data = resp.json()
    print(f"✅ OTP requested successfully")
    
    # Extract OTP from response (for testing)
    otp = data.get("otp")
    if not otp:
        print("❌ No OTP in response")
        return None
    
    print(f"   OTP: {otp}")
    
    # Step 2: Verify OTP
    print(f"\n2. Verifying OTP: {otp}")
    resp = requests.post(
        f"{BACKEND_URL}/platform/auth/verify-otp",
        json={"mobile": PLATFORM_OWNER_MOBILE, "otp": otp}
    )
    
    if resp.status_code != 200:
        print(f"❌ Failed to verify OTP: {resp.status_code} - {resp.text}")
        return None
    
    data = resp.json()
    token = data.get("access_token")
    
    if not token:
        print("❌ No access_token in response")
        return None
    
    print(f"✅ Platform admin authenticated successfully")
    print(f"   Token length: {len(token)} chars")
    
    return token

def get_salon_admin_token():
    """Get salon admin JWT using existing salon credentials"""
    print("\n" + "="*80)
    print("SALON ADMIN AUTH SETUP")
    print("="*80)
    
    # Use existing salon admin credentials
    phone = "7503070727"
    password = "salon123"
    
    print(f"\n1. Logging in as salon admin: {phone}")
    resp = requests.post(
        f"{BACKEND_URL}/salon/users/login",
        json={"identifier": phone, "password": password}
    )
    
    if resp.status_code != 200:
        print(f"❌ Failed to login: {resp.status_code} - {resp.text}")
        return None, None
    
    data = resp.json()
    token = data.get("access_token")
    salon_id = data.get("salon_id")
    
    if not token or not salon_id:
        print("❌ Missing access_token or salon_id in response")
        return None, None
    
    print(f"✅ Salon admin authenticated successfully")
    print(f"   Salon ID: {salon_id}")
    print(f"   Token length: {len(token)} chars")
    
    return token, salon_id

# ============================================================================
# PHASE 6 TESTS
# ============================================================================

def test_dashboard_stats(platform_token):
    """Test A: GET /api/platform/dashboard/stats"""
    print("\n" + "="*80)
    print("TEST A: PLATFORM DASHBOARD STATS")
    print("="*80)
    
    # Test A1: Without auth (should fail with 401)
    print("\n[A1] GET /platform/dashboard/stats without auth")
    resp = requests.get(f"{BACKEND_URL}/platform/dashboard/stats")
    log_test(
        "A1: Dashboard stats without auth returns 401",
        resp.status_code == 401,
        f"Expected 401, got {resp.status_code}"
    )
    
    # Test A2: With auth (should succeed with all required keys)
    print("\n[A2] GET /platform/dashboard/stats with auth")
    resp = requests.get(
        f"{BACKEND_URL}/platform/dashboard/stats",
        headers={"Authorization": f"Bearer {platform_token}"}
    )
    
    if resp.status_code != 200:
        log_test(
            "A2: Dashboard stats with auth returns 200",
            False,
            f"Expected 200, got {resp.status_code} - {resp.text}"
        )
        return
    
    log_test("A2: Dashboard stats with auth returns 200", True)
    
    data = resp.json()
    
    # Verify all required keys
    required_keys = [
        "as_of", "salons", "subscriptions", "revenue", 
        "overrides", "discount_codes", "suppliers"
    ]
    
    for key in required_keys:
        log_test(
            f"A2: Response has '{key}' key",
            key in data,
            f"Missing key: {key}"
        )
    
    # Verify nested structure
    if "salons" in data:
        salon_keys = ["total", "active", "suspended"]
        for key in salon_keys:
            log_test(
                f"A2: salons.{key} is numeric",
                key in data["salons"] and isinstance(data["salons"][key], (int, float)),
                f"salons.{key} = {data['salons'].get(key)}"
            )
    
    if "subscriptions" in data:
        sub_keys = ["active", "expired", "granted"]
        for key in sub_keys:
            log_test(
                f"A2: subscriptions.{key} is numeric",
                key in data["subscriptions"] and isinstance(data["subscriptions"][key], (int, float)),
                f"subscriptions.{key} = {data['subscriptions'].get(key)}"
            )
    
    if "revenue" in data:
        rev_keys = ["mtd_amount", "mtd_transaction_count"]
        for key in rev_keys:
            log_test(
                f"A2: revenue.{key} is numeric",
                key in data["revenue"] and isinstance(data["revenue"][key], (int, float)),
                f"revenue.{key} = {data['revenue'].get(key)}"
            )
    
    if "discount_codes" in data:
        dc_keys = ["total", "active", "disabled", "expired", "mtd_uses", "mtd_savings"]
        for key in dc_keys:
            log_test(
                f"A2: discount_codes.{key} is numeric",
                key in data["discount_codes"] and isinstance(data["discount_codes"][key], (int, float)),
                f"discount_codes.{key} = {data['discount_codes'].get(key)}"
            )
    
    print(f"\n📊 Dashboard Stats Sample:")
    print(json.dumps(data, indent=2)[:500] + "...")

def test_broadcasts(platform_token):
    """Test B: POST /api/platform/broadcast + GET /api/platform/broadcasts"""
    print("\n" + "="*80)
    print("TEST B: BROADCAST ENDPOINTS")
    print("="*80)
    
    # Test B1: POST without auth (should fail with 401)
    print("\n[B1] POST /platform/broadcast without auth")
    resp = requests.post(
        f"{BACKEND_URL}/platform/broadcast",
        json={"title": "Test", "message": "Hello", "audience": "all_salons"}
    )
    log_test(
        "B1: Broadcast without auth returns 401",
        resp.status_code == 401,
        f"Expected 401, got {resp.status_code}"
    )
    
    # Test B2: POST with invalid audience (should fail with 422)
    print("\n[B2] POST /platform/broadcast with invalid audience")
    resp = requests.post(
        f"{BACKEND_URL}/platform/broadcast",
        headers={"Authorization": f"Bearer {platform_token}"},
        json={"title": "Test", "message": "Hello", "audience": "invalid_audience"}
    )
    log_test(
        "B2: Broadcast with invalid audience returns 422",
        resp.status_code == 422,
        f"Expected 422, got {resp.status_code}"
    )
    
    # Test B3: POST with too short title (should fail with 422)
    print("\n[B3] POST /platform/broadcast with too short title")
    resp = requests.post(
        f"{BACKEND_URL}/platform/broadcast",
        headers={"Authorization": f"Bearer {platform_token}"},
        json={"title": "T", "message": "X", "audience": "all_salons"}
    )
    log_test(
        "B3: Broadcast with title < 2 chars returns 422",
        resp.status_code == 422,
        f"Expected 422, got {resp.status_code}"
    )
    
    # Test B4: POST with valid data (should succeed)
    print("\n[B4] POST /platform/broadcast with valid data")
    broadcast_data = {
        "title": "Test Broadcast Phase 6",
        "message": "This is a test broadcast message for Phase 6 testing",
        "audience": "all_salons",
        "channels": ["in_app"]
    }
    resp = requests.post(
        f"{BACKEND_URL}/platform/broadcast",
        headers={"Authorization": f"Bearer {platform_token}"},
        json=broadcast_data
    )
    
    if resp.status_code != 200:
        log_test(
            "B4: Broadcast with valid data returns 200",
            False,
            f"Expected 200, got {resp.status_code} - {resp.text}"
        )
        return
    
    log_test("B4: Broadcast with valid data returns 200", True)
    
    data = resp.json()
    broadcast_id = data.get("id")
    
    # Verify response structure
    required_keys = ["id", "target_count", "delivered_count", "failed_count", "audience", "created_at"]
    for key in required_keys:
        log_test(
            f"B4: Response has '{key}' key",
            key in data,
            f"Missing key: {key}"
        )
    
    print(f"\n📢 Broadcast Created:")
    print(f"   ID: {broadcast_id}")
    print(f"   Target Count: {data.get('target_count')}")
    print(f"   Delivered Count: {data.get('delivered_count')}")
    
    # Test B5: GET broadcast history
    print("\n[B5] GET /platform/broadcasts")
    resp = requests.get(
        f"{BACKEND_URL}/platform/broadcasts",
        headers={"Authorization": f"Bearer {platform_token}"}
    )
    
    if resp.status_code != 200:
        log_test(
            "B5: GET broadcasts returns 200",
            False,
            f"Expected 200, got {resp.status_code} - {resp.text}"
        )
        return
    
    log_test("B5: GET broadcasts returns 200", True)
    
    data = resp.json()
    broadcasts = data.get("broadcasts", [])
    
    log_test(
        "B5: Broadcasts list is not empty",
        len(broadcasts) > 0,
        f"Expected at least 1 broadcast, got {len(broadcasts)}"
    )
    
    if broadcasts:
        first = broadcasts[0]
        log_test(
            "B5: First broadcast is the one just sent",
            first.get("id") == broadcast_id,
            f"Expected {broadcast_id}, got {first.get('id')}"
        )
    
    # Test B6-B8: Try different audiences
    audiences = ["premium_salons", "free_salons", "suspended_salons"]
    for i, audience in enumerate(audiences, start=6):
        print(f"\n[B{i}] POST /platform/broadcast with audience={audience}")
        resp = requests.post(
            f"{BACKEND_URL}/platform/broadcast",
            headers={"Authorization": f"Bearer {platform_token}"},
            json={
                "title": f"Test {audience}",
                "message": f"Testing {audience} audience",
                "audience": audience,
                "channels": ["in_app"]
            }
        )
        log_test(
            f"B{i}: Broadcast to {audience} returns 200",
            resp.status_code == 200,
            f"Expected 200, got {resp.status_code}"
        )
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"   Target Count: {data.get('target_count')}")
            print(f"   Delivered Count: {data.get('delivered_count')}")

def test_supplier_stubs(platform_token):
    """Test C: Supplier stub endpoints"""
    print("\n" + "="*80)
    print("TEST C: SUPPLIER STUBS")
    print("="*80)
    
    # Test C1: GET /platform/suppliers
    print("\n[C1] GET /platform/suppliers")
    resp = requests.get(
        f"{BACKEND_URL}/platform/suppliers",
        headers={"Authorization": f"Bearer {platform_token}"}
    )
    
    if resp.status_code != 200:
        log_test(
            "C1: GET suppliers returns 200",
            False,
            f"Expected 200, got {resp.status_code} - {resp.text}"
        )
        return
    
    log_test("C1: GET suppliers returns 200", True)
    
    data = resp.json()
    log_test(
        "C1: Response has 'suppliers' key",
        "suppliers" in data,
        f"Missing 'suppliers' key"
    )
    log_test(
        "C1: Response has 'total' key",
        "total" in data,
        f"Missing 'total' key"
    )
    
    print(f"   Suppliers: {data.get('total', 0)}")
    
    # Test C2: GET with status filter
    print("\n[C2] GET /platform/suppliers?status=pending")
    resp = requests.get(
        f"{BACKEND_URL}/platform/suppliers?status=pending",
        headers={"Authorization": f"Bearer {platform_token}"}
    )
    log_test(
        "C2: GET suppliers with status filter returns 200",
        resp.status_code == 200,
        f"Expected 200, got {resp.status_code}"
    )
    
    # Test C3: POST approve non-existent supplier (should return 404)
    print("\n[C3] POST /platform/suppliers/nonexistent-id/approve")
    resp = requests.post(
        f"{BACKEND_URL}/platform/suppliers/nonexistent-id/approve",
        headers={"Authorization": f"Bearer {platform_token}"}
    )
    log_test(
        "C3: Approve non-existent supplier returns 404",
        resp.status_code == 404,
        f"Expected 404, got {resp.status_code}"
    )
    
    if resp.status_code == 404:
        log_test(
            "C3: Error detail mentions Phase 8",
            "Phase 8" in resp.text,
            f"Expected 'Phase 8' in error message"
        )
    
    # Test C4: POST reject non-existent supplier (should return 404)
    print("\n[C4] POST /platform/suppliers/nonexistent-id/reject")
    resp = requests.post(
        f"{BACKEND_URL}/platform/suppliers/nonexistent-id/reject",
        headers={"Authorization": f"Bearer {platform_token}"}
    )
    log_test(
        "C4: Reject non-existent supplier returns 404",
        resp.status_code == 404,
        f"Expected 404, got {resp.status_code}"
    )

# ============================================================================
# PHASE 7 TESTS
# ============================================================================

def test_discount_code_free_months(platform_token, salon_token, salon_id):
    """Test D: Discount code free_months end-to-end"""
    print("\n" + "="*80)
    print("TEST D: DISCOUNT CODE FREE_MONTHS END-TO-END")
    print("="*80)
    
    # Step 1: Create a free_months discount code
    print("\n[D1] Create free_months discount code")
    code_data = {
        "code": "TESTFREE_PHASE7",
        "discount_type": "free_months",
        "free_months": 1,
        "duration_months": 1,
        "max_uses_per_salon": 1,
        "max_total_uses": None,
        "applies_to_branches": "all"
    }
    resp = requests.post(
        f"{BACKEND_URL}/platform/discount-codes",
        headers={"Authorization": f"Bearer {platform_token}"},
        json=code_data
    )
    
    if resp.status_code != 200:
        log_test(
            "D1: Create free_months code returns 200",
            False,
            f"Expected 200, got {resp.status_code} - {resp.text}"
        )
        return
    
    log_test("D1: Create free_months code returns 200", True)
    
    data = resp.json()
    code_id = data.get("id")
    print(f"   Code ID: {code_id}")
    print(f"   Code: {data.get('code')}")
    
    # Step 2: Find a salon without active subscription
    # For testing, we'll use the current salon and try to create order
    print(f"\n[D2] Create order with free_months code for salon {salon_id}")
    resp = requests.post(
        f"{BACKEND_URL}/salons/{salon_id}/subscription/create-order",
        headers={"Authorization": f"Bearer {salon_token}"},
        json={"discount_code": "TESTFREE_PHASE7"}
    )
    
    if resp.status_code != 200:
        log_test(
            "D2: Create order with free_months code",
            False,
            f"Expected 200, got {resp.status_code} - {resp.text}"
        )
        # This might fail if salon already has active subscription
        # That's okay for testing purposes
        print("   Note: Salon may already have active subscription")
        return
    
    log_test("D2: Create order with free_months code returns 200", True)
    
    data = resp.json()
    
    # Verify response structure
    log_test(
        "D2: Response has is_free_months=true",
        data.get("is_free_months") is True,
        f"Expected True, got {data.get('is_free_months')}"
    )
    
    log_test(
        "D2: Response has free_months_granted=1",
        data.get("free_months_granted") == 1,
        f"Expected 1, got {data.get('free_months_granted')}"
    )
    
    log_test(
        "D2: Response has total_amount=0",
        data.get("total_amount") == 0,
        f"Expected 0, got {data.get('total_amount')}"
    )
    
    log_test(
        "D2: Response has payment_session_id=null",
        data.get("payment_session_id") is None,
        f"Expected None, got {data.get('payment_session_id')}"
    )
    
    log_test(
        "D2: Response has expiry_date",
        "expiry_date" in data,
        "Missing expiry_date"
    )
    
    log_test(
        "D2: Response has subscription_id",
        "subscription_id" in data,
        "Missing subscription_id"
    )
    
    log_test(
        "D2: Response has payment_status='discounted_free'",
        data.get("payment_status") == "discounted_free",
        f"Expected 'discounted_free', got {data.get('payment_status')}"
    )
    
    subscription_id = data.get("subscription_id")
    print(f"\n✅ Free months subscription created:")
    print(f"   Subscription ID: {subscription_id}")
    print(f"   Expiry Date: {data.get('expiry_date')}")
    
    # Step 3: Verify subscription status
    print(f"\n[D3] Verify subscription status")
    resp = requests.get(
        f"{BACKEND_URL}/salons/{salon_id}/subscription/status",
        headers={"Authorization": f"Bearer {salon_token}"}
    )
    
    if resp.status_code == 200:
        data = resp.json()
        log_test(
            "D3: Subscription status is premium",
            data.get("is_premium") is True,
            f"Expected True, got {data.get('is_premium')}"
        )
        print(f"   Status: {data.get('status')}")
        print(f"   Expiry: {data.get('expiry_date')}")
    
    # Step 4: Try to use same code again (should fail with max_uses_per_salon)
    print(f"\n[D4] Try to use same code again (should fail)")
    resp = requests.post(
        f"{BACKEND_URL}/salons/{salon_id}/subscription/create-order",
        headers={"Authorization": f"Bearer {salon_token}"},
        json={"discount_code": "TESTFREE_PHASE7"}
    )
    log_test(
        "D4: Second use of same code returns 400",
        resp.status_code == 400,
        f"Expected 400, got {resp.status_code}"
    )
    
    # Step 5: Try bogus code (should fail)
    print(f"\n[D5] Try bogus discount code (should fail)")
    resp = requests.post(
        f"{BACKEND_URL}/salons/{salon_id}/subscription/create-order",
        headers={"Authorization": f"Bearer {salon_token}"},
        json={"discount_code": "BOGUS_CODE_XYZ"}
    )
    log_test(
        "D5: Bogus code returns 400",
        resp.status_code == 400,
        f"Expected 400, got {resp.status_code}"
    )

def test_discount_code_percent(platform_token, salon_token, salon_id):
    """Test E: Discount code percent carries through"""
    print("\n" + "="*80)
    print("TEST E: DISCOUNT CODE PERCENT REGRESSION")
    print("="*80)
    
    # Step 1: Create a percent discount code
    print("\n[E1] Create percent discount code")
    code_data = {
        "code": "PCT50_PHASE7",
        "discount_type": "percent",
        "percent_off": 50,
        "duration_months": 1,
        "max_uses_per_salon": 5,
        "applies_to_branches": "all"
    }
    resp = requests.post(
        f"{BACKEND_URL}/platform/discount-codes",
        headers={"Authorization": f"Bearer {platform_token}"},
        json=code_data
    )
    
    if resp.status_code != 200:
        log_test(
            "E1: Create percent code returns 200",
            False,
            f"Expected 200, got {resp.status_code} - {resp.text}"
        )
        return
    
    log_test("E1: Create percent code returns 200", True)
    
    data = resp.json()
    print(f"   Code ID: {data.get('id')}")
    print(f"   Code: {data.get('code')}")
    
    # Step 2: Create order with percent code
    # Note: This might fail if salon already has active subscription
    print(f"\n[E2] Create order with percent code")
    resp = requests.post(
        f"{BACKEND_URL}/salons/{salon_id}/subscription/create-order",
        headers={"Authorization": f"Bearer {salon_token}"},
        json={"discount_code": "PCT50_PHASE7"}
    )
    
    if resp.status_code != 200:
        log_test(
            "E2: Create order with percent code",
            False,
            f"Expected 200, got {resp.status_code} - {resp.text}"
        )
        print("   Note: Salon may already have active subscription")
        return
    
    log_test("E2: Create order with percent code returns 200", True)
    
    data = resp.json()
    
    # Verify response structure
    log_test(
        "E2: Response has payment_session_id",
        data.get("payment_session_id") is not None,
        f"Expected payment_session_id, got {data.get('payment_session_id')}"
    )
    
    log_test(
        "E2: Response has base_amount > 0",
        data.get("base_amount", 0) > 0,
        f"Expected > 0, got {data.get('base_amount')}"
    )
    
    base = data.get("base_amount", 0)
    discount = data.get("discount_amount", 0)
    total = data.get("total_amount", 0)
    
    log_test(
        "E2: discount_amount is ~50% of base_amount",
        abs(discount - base * 0.5) < 1,  # Allow 1 rupee tolerance
        f"Expected ~{base * 0.5}, got {discount}"
    )
    
    log_test(
        "E2: total_amount = base_amount - discount_amount",
        abs(total - (base - discount)) < 0.01,
        f"Expected {base - discount}, got {total}"
    )
    
    log_test(
        "E2: Response has is_free_months=false",
        data.get("is_free_months") is False,
        f"Expected False, got {data.get('is_free_months')}"
    )
    
    print(f"\n💰 Percent discount order created:")
    print(f"   Base Amount: ₹{base}")
    print(f"   Discount (50%): ₹{discount}")
    print(f"   Total Amount: ₹{total}")
    print(f"   Payment Session ID: {data.get('payment_session_id')}")

def test_discount_codes_crud(platform_token):
    """Test F: Discount codes admin CRUD regression"""
    print("\n" + "="*80)
    print("TEST F: DISCOUNT CODES ADMIN CRUD REGRESSION")
    print("="*80)
    
    # Test F1: GET /platform/discount-codes
    print("\n[F1] GET /platform/discount-codes")
    resp = requests.get(
        f"{BACKEND_URL}/platform/discount-codes",
        headers={"Authorization": f"Bearer {platform_token}"}
    )
    
    if resp.status_code != 200:
        log_test(
            "F1: GET discount codes returns 200",
            False,
            f"Expected 200, got {resp.status_code} - {resp.text}"
        )
        return
    
    log_test("F1: GET discount codes returns 200", True)
    
    data = resp.json()
    codes = data.get("codes", [])
    
    log_test(
        "F1: Response has codes list",
        isinstance(codes, list),
        f"Expected list, got {type(codes)}"
    )
    
    # Find our test codes
    testfree = next((c for c in codes if c.get("code") == "TESTFREE_PHASE7"), None)
    pct50 = next((c for c in codes if c.get("code") == "PCT50_PHASE7"), None)
    
    log_test(
        "F1: TESTFREE_PHASE7 code exists",
        testfree is not None,
        "Code not found in list"
    )
    
    log_test(
        "F1: PCT50_PHASE7 code exists",
        pct50 is not None,
        "Code not found in list"
    )
    
    if not testfree:
        print("   ⚠️ Cannot continue CRUD tests without TESTFREE_PHASE7 code")
        return
    
    code_id = testfree.get("id")
    print(f"   Found {len(codes)} discount codes")
    print(f"   TESTFREE_PHASE7 ID: {code_id}")
    
    # Test F2: PUT /platform/discount-codes/{id}
    print(f"\n[F2] PUT /platform/discount-codes/{code_id}")
    resp = requests.put(
        f"{BACKEND_URL}/platform/discount-codes/{code_id}",
        headers={"Authorization": f"Bearer {platform_token}"},
        json={"description": "Updated description for testing"}
    )
    
    if resp.status_code != 200:
        log_test(
            "F2: PUT discount code returns 200",
            False,
            f"Expected 200, got {resp.status_code} - {resp.text}"
        )
    else:
        log_test("F2: PUT discount code returns 200", True)
        data = resp.json()
        log_test(
            "F2: Description was updated",
            data.get("description") == "Updated description for testing",
            f"Expected 'Updated description for testing', got {data.get('description')}"
        )
    
    # Test F3: POST /platform/discount-codes/{id}/disable
    print(f"\n[F3] POST /platform/discount-codes/{code_id}/disable")
    resp = requests.post(
        f"{BACKEND_URL}/platform/discount-codes/{code_id}/disable",
        headers={"Authorization": f"Bearer {platform_token}"}
    )
    
    if resp.status_code != 200:
        log_test(
            "F3: Disable code returns 200",
            False,
            f"Expected 200, got {resp.status_code} - {resp.text}"
        )
    else:
        log_test("F3: Disable code returns 200", True)
        data = resp.json()
        log_test(
            "F3: Status is 'disabled'",
            data.get("status") == "disabled",
            f"Expected 'disabled', got {data.get('status')}"
        )
    
    # Test F4: POST /platform/discount-codes/{id}/enable
    print(f"\n[F4] POST /platform/discount-codes/{code_id}/enable")
    resp = requests.post(
        f"{BACKEND_URL}/platform/discount-codes/{code_id}/enable",
        headers={"Authorization": f"Bearer {platform_token}"}
    )
    
    if resp.status_code != 200:
        log_test(
            "F4: Enable code returns 200",
            False,
            f"Expected 200, got {resp.status_code} - {resp.text}"
        )
    else:
        log_test("F4: Enable code returns 200", True)
        data = resp.json()
        log_test(
            "F4: Status is 'active'",
            data.get("status") == "active",
            f"Expected 'active', got {data.get('status')}"
        )
    
    # Test F5: GET /platform/discount-codes/{id}/usages
    print(f"\n[F5] GET /platform/discount-codes/{code_id}/usages")
    resp = requests.get(
        f"{BACKEND_URL}/platform/discount-codes/{code_id}/usages",
        headers={"Authorization": f"Bearer {platform_token}"}
    )
    
    if resp.status_code != 200:
        log_test(
            "F5: GET code usages returns 200",
            False,
            f"Expected 200, got {resp.status_code} - {resp.text}"
        )
    else:
        log_test("F5: GET code usages returns 200", True)
        data = resp.json()
        usages = data.get("usages", [])
        log_test(
            "F5: Usages list is present",
            isinstance(usages, list),
            f"Expected list, got {type(usages)}"
        )
        print(f"   Total usages: {len(usages)}")
    
    # Cleanup: Disable test codes
    print(f"\n[CLEANUP] Disabling test codes")
    for code in [testfree, pct50]:
        if code:
            resp = requests.post(
                f"{BACKEND_URL}/platform/discount-codes/{code['id']}/disable",
                headers={"Authorization": f"Bearer {platform_token}"}
            )
            if resp.status_code == 200:
                print(f"   ✅ Disabled {code['code']}")

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def main():
    """Main test runner"""
    print("\n" + "="*80)
    print("PHASE 6 + PHASE 7 BACKEND TESTING")
    print("="*80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Platform Owner Mobile: {PLATFORM_OWNER_MOBILE}")
    
    # Get platform admin token
    platform_token = get_platform_admin_token()
    if not platform_token:
        print("\n❌ CRITICAL: Failed to get platform admin token. Cannot continue.")
        return
    
    # Get salon admin token
    salon_token, salon_id = get_salon_admin_token()
    if not salon_token or not salon_id:
        print("\n⚠️ WARNING: Failed to get salon admin token. Some tests will be skipped.")
    
    # Run Phase 6 tests
    test_dashboard_stats(platform_token)
    test_broadcasts(platform_token)
    test_supplier_stubs(platform_token)
    
    # Run Phase 7 tests (only if we have salon token)
    if salon_token and salon_id:
        test_discount_code_free_months(platform_token, salon_token, salon_id)
        test_discount_code_percent(platform_token, salon_token, salon_id)
    else:
        print("\n⚠️ SKIPPING Phase 7 tests (no salon admin token)")
    
    # Run discount codes CRUD tests
    test_discount_codes_crud(platform_token)
    
    # Print summary
    print_summary()

if __name__ == "__main__":
    main()
