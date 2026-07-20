#!/usr/bin/env python3
"""
Phase 7 Free Months Re-Test Script
Tests the free_months discount code flow end-to-end after Cashfree check fix
"""

import requests
import json
import os
from datetime import datetime, timedelta, timezone

# Read backend URL from frontend/.env
BACKEND_URL = "https://payroll-tracker-273.preview.emergentagent.com/api"

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
    print("PHASE 7 FREE_MONTHS RE-TEST SUMMARY")
    print("="*80)
    print(f"Total Tests: {test_results['total']}")
    print(f"Passed: {len(test_results['passed'])}")
    print(f"Failed: {len(test_results['failed'])}")
    if test_results['total'] > 0:
        print(f"Pass Rate: {len(test_results['passed'])/test_results['total']*100:.1f}%")
    
    if test_results['failed']:
        print("\n❌ FAILED TESTS:")
        for fail in test_results['failed']:
            print(f"  - {fail['name']}")
            if fail.get('details'):
                print(f"    {fail['details']}")

def get_platform_admin_token():
    """Get platform admin JWT via OTP flow"""
    print("\n" + "="*80)
    print("PLATFORM ADMIN AUTHENTICATION")
    print("="*80)
    
    # Step 1: Request OTP
    print(f"\n1. Requesting OTP for {PLATFORM_OWNER_MOBILE}...")
    resp = requests.post(
        f"{BACKEND_URL}/platform/auth/request-otp",
        json={"mobile": PLATFORM_OWNER_MOBILE}
    )
    print(f"   Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"   ❌ Failed to request OTP: {resp.text}")
        return None
    
    data = resp.json()
    otp = data.get("otp")
    print(f"   ✅ OTP received: {otp}")
    
    # Step 2: Verify OTP
    print(f"\n2. Verifying OTP...")
    resp = requests.post(
        f"{BACKEND_URL}/platform/auth/verify-otp",
        json={"mobile": PLATFORM_OWNER_MOBILE, "otp": otp}
    )
    print(f"   Status: {resp.status_code}")
    
    if resp.status_code != 200:
        print(f"   ❌ Failed to verify OTP: {resp.text}")
        return None
    
    data = resp.json()
    token = data.get("access_token")
    print(f"   ✅ Platform admin token received (length: {len(token)})")
    
    return token

def get_salon_admin_token(salon_id):
    """Get salon admin JWT"""
    print("\n" + "="*80)
    print("SALON ADMIN AUTHENTICATION")
    print("="*80)
    
    # Try to login with existing credentials
    print(f"\n1. Attempting salon admin login for salon {salon_id}...")
    
    # First, let's get the salon users to find admin credentials
    resp = requests.post(
        f"{BACKEND_URL}/salon/users/login",
        json={
            "salon_id": salon_id,
            "identifier": "admin",
            "password": "salon123"
        }
    )
    print(f"   Status: {resp.status_code}")
    
    if resp.status_code == 200:
        data = resp.json()
        token = data.get("access_token")
        print(f"   ✅ Salon admin token received (length: {len(token)})")
        return token
    else:
        print(f"   ❌ Failed to login: {resp.text}")
        return None

def find_salon_without_subscription(platform_token):
    """Find a salon without active subscription"""
    print("\n" + "="*80)
    print("FINDING SALON WITHOUT ACTIVE SUBSCRIPTION")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {platform_token}"}
    
    # Get list of salons
    resp = requests.get(
        f"{BACKEND_URL}/platform/salons?page=1&page_size=50",
        headers=headers
    )
    
    if resp.status_code != 200:
        print(f"   ❌ Failed to get salons: {resp.text}")
        # Fallback to known salon ID from DB
        print(f"   Using fallback salon ID: 7cb86f8a-fe14-4d96-8884-cc4f34338af0")
        return "7cb86f8a-fe14-4d96-8884-cc4f34338af0"
    
    data = resp.json()
    salons = data.get("salons", [])
    print(f"   Found {len(salons)} salons")
    
    if len(salons) == 0:
        # Fallback to known salon ID from DB
        print(f"   No salons returned from API. Using fallback salon ID: 7cb86f8a-fe14-4d96-8884-cc4f34338af0")
        return "7cb86f8a-fe14-4d96-8884-cc4f34338af0"
    
    # Check each salon's subscription status
    for salon in salons:
        salon_id = salon.get("id")
        salon_name = salon.get("salon_name", "Unknown")
        
        # Get subscription status
        resp = requests.get(f"{BACKEND_URL}/salons/{salon_id}/subscription/status")
        
        if resp.status_code == 200:
            sub_data = resp.json()
            is_premium = sub_data.get("is_premium", False)
            
            if not is_premium:
                print(f"   ✅ Found salon without active subscription: {salon_name} (ID: {salon_id})")
                return salon_id
    
    print(f"   ⚠️ All salons have active subscriptions. Using first salon: {salons[0].get('salon_name')} (ID: {salons[0].get('id')})")
    return salons[0].get("id")

def run_phase7_free_months_tests():
    """Run Phase 7 free_months end-to-end tests"""
    
    # Step 1: Get platform admin token
    platform_token = get_platform_admin_token()
    if not platform_token:
        print("\n❌ CRITICAL: Cannot proceed without platform admin token")
        return
    
    # Step 2: Find salon without subscription
    salon_id = find_salon_without_subscription(platform_token)
    if not salon_id:
        print("\n❌ CRITICAL: Cannot find suitable salon for testing")
        return
    
    # Step 3: Get salon admin token
    salon_token = get_salon_admin_token(salon_id)
    if not salon_token:
        print("\n❌ CRITICAL: Cannot proceed without salon admin token")
        return
    
    platform_headers = {"Authorization": f"Bearer {platform_token}"}
    salon_headers = {"Authorization": f"Bearer {salon_token}"}
    
    print("\n" + "="*80)
    print("PHASE 7 FREE_MONTHS TESTS")
    print("="*80)
    
    # Test 1: Create discount code with free_months type
    print("\n1. Creating discount code PHASE7_RETEST...")
    resp = requests.post(
        f"{BACKEND_URL}/platform/discount-codes",
        headers=platform_headers,
        json={
            "code": "PHASE7_RETEST",
            "discount_type": "free_months",
            "free_months": 1,
            "duration_months": 1,
            "max_uses_per_salon": 1,
            "applies_to_branches": "all"
        }
    )
    print(f"   Status: {resp.status_code}")
    
    if resp.status_code == 200:
        code_data = resp.json()
        code_id = code_data.get("id")
        print(f"   ✅ Discount code created: {code_id}")
        log_test("Create free_months discount code", True)
    else:
        print(f"   ❌ Failed: {resp.text}")
        log_test("Create free_months discount code", False, resp.text)
        return
    
    # Test 2: Use discount code in create-order (should NOT hit 503)
    print(f"\n2. Creating subscription order with discount code for salon {salon_id}...")
    resp = requests.post(
        f"{BACKEND_URL}/salons/{salon_id}/subscription/create-order",
        headers=salon_headers,
        json={"discount_code": "PHASE7_RETEST"}
    )
    print(f"   Status: {resp.status_code}")
    print(f"   Response: {json.dumps(resp.json(), indent=2)}")
    
    if resp.status_code == 200:
        order_data = resp.json()
        
        # Verify response structure
        checks = [
            ("is_free_months", order_data.get("is_free_months") == True),
            ("free_months_granted", order_data.get("free_months_granted") == 1),
            ("total_amount", order_data.get("total_amount") == 0),
            ("payment_session_id", order_data.get("payment_session_id") is None),
            ("subscription_id", order_data.get("subscription_id") is not None),
            ("payment_status", order_data.get("payment_status") == "discounted_free"),
            ("expiry_date", order_data.get("expiry_date") is not None),
            ("base_amount", order_data.get("base_amount", 0) > 0),
            ("discount_amount", order_data.get("discount_amount") == order_data.get("base_amount"))
        ]
        
        all_passed = True
        for field, passed in checks:
            if passed:
                print(f"   ✅ {field}: {order_data.get(field)}")
            else:
                print(f"   ❌ {field}: expected value not found (got: {order_data.get(field)})")
                all_passed = False
        
        log_test("Create order with free_months code - response structure", all_passed)
        
        subscription_id = order_data.get("subscription_id")
        
        # Verify expiry date is ~30 days from now
        expiry_date_str = order_data.get("expiry_date")
        if expiry_date_str:
            expiry_date = datetime.fromisoformat(expiry_date_str.replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            days_diff = (expiry_date - now).days
            
            if 28 <= days_diff <= 32:
                print(f"   ✅ Expiry date is ~30 days from now ({days_diff} days)")
                log_test("Expiry date calculation", True)
            else:
                print(f"   ❌ Expiry date is {days_diff} days from now (expected ~30)")
                log_test("Expiry date calculation", False, f"Got {days_diff} days, expected ~30")
        
    else:
        print(f"   ❌ Failed: {resp.text}")
        log_test("Create order with free_months code", False, resp.text)
        return
    
    # Test 3: Verify subscription status is now active premium
    print(f"\n3. Verifying subscription status for salon {salon_id}...")
    resp = requests.get(f"{BACKEND_URL}/salons/{salon_id}/subscription/status")
    print(f"   Status: {resp.status_code}")
    
    if resp.status_code == 200:
        status_data = resp.json()
        is_premium = status_data.get("is_premium", False)
        
        if is_premium:
            print(f"   ✅ Salon is now premium")
            log_test("Subscription status after free_months", True)
        else:
            print(f"   ❌ Salon is not premium: {json.dumps(status_data, indent=2)}")
            log_test("Subscription status after free_months", False, "is_premium is False")
    else:
        print(f"   ❌ Failed: {resp.text}")
        log_test("Subscription status after free_months", False, resp.text)
    
    # Test 4: Verify discount code usage in DB
    print(f"\n4. Verifying discount code usage...")
    resp = requests.get(
        f"{BACKEND_URL}/platform/discount-codes/{code_id}/usages",
        headers=platform_headers
    )
    print(f"   Status: {resp.status_code}")
    
    if resp.status_code == 200:
        usages_data = resp.json()
        usages = usages_data.get("usages", [])
        
        if len(usages) == 1:
            usage = usages[0]
            if usage.get("salon_id") == salon_id and usage.get("subscription_id") == subscription_id:
                print(f"   ✅ Usage record found: salon_id={salon_id}, subscription_id={subscription_id}")
                log_test("Discount code usage record", True)
            else:
                print(f"   ❌ Usage record mismatch: {json.dumps(usage, indent=2)}")
                log_test("Discount code usage record", False, "Usage record data mismatch")
        else:
            print(f"   ❌ Expected 1 usage, found {len(usages)}")
            log_test("Discount code usage record", False, f"Expected 1 usage, found {len(usages)}")
    else:
        print(f"   ❌ Failed: {resp.text}")
        log_test("Discount code usage record", False, resp.text)
    
    # Test 5: Verify current_uses incremented
    print(f"\n5. Verifying discount code current_uses...")
    resp = requests.get(
        f"{BACKEND_URL}/platform/discount-codes",
        headers=platform_headers
    )
    print(f"   Status: {resp.status_code}")
    
    if resp.status_code == 200:
        codes_data = resp.json()
        codes = codes_data.get("codes", [])
        
        phase7_code = next((c for c in codes if c.get("code") == "PHASE7_RETEST"), None)
        
        if phase7_code:
            current_uses = phase7_code.get("current_uses", 0)
            if current_uses == 1:
                print(f"   ✅ current_uses = 1")
                log_test("Discount code current_uses incremented", True)
            else:
                print(f"   ❌ current_uses = {current_uses} (expected 1)")
                log_test("Discount code current_uses incremented", False, f"Got {current_uses}, expected 1")
        else:
            print(f"   ❌ Code PHASE7_RETEST not found in list")
            log_test("Discount code current_uses incremented", False, "Code not found")
    else:
        print(f"   ❌ Failed: {resp.text}")
        log_test("Discount code current_uses incremented", False, resp.text)
    
    # Test 6: Try to use code again (should fail with max_uses_per_salon)
    print(f"\n6. Attempting to use code again (should fail)...")
    resp = requests.post(
        f"{BACKEND_URL}/salons/{salon_id}/subscription/create-order",
        headers=salon_headers,
        json={"discount_code": "PHASE7_RETEST"}
    )
    print(f"   Status: {resp.status_code}")
    
    if resp.status_code == 400:
        error_data = resp.json()
        detail = error_data.get("detail", "")
        
        if "max_uses_per_salon" in detail.lower() or "already used" in detail.lower():
            print(f"   ✅ Correctly rejected: {detail}")
            log_test("Max uses per salon enforcement", True)
        else:
            print(f"   ⚠️ Rejected but with unexpected reason: {detail}")
            log_test("Max uses per salon enforcement", True, f"Unexpected error message: {detail}")
    else:
        print(f"   ❌ Expected 400, got {resp.status_code}: {resp.text}")
        log_test("Max uses per salon enforcement", False, f"Expected 400, got {resp.status_code}")
    
    # Test 7: Try invalid code
    print(f"\n7. Attempting to use invalid code...")
    resp = requests.post(
        f"{BACKEND_URL}/salons/{salon_id}/subscription/create-order",
        headers=salon_headers,
        json={"discount_code": "DOES_NOT_EXIST"}
    )
    print(f"   Status: {resp.status_code}")
    
    if resp.status_code == 400:
        error_data = resp.json()
        detail = error_data.get("detail", "")
        print(f"   ✅ Correctly rejected: {detail}")
        log_test("Invalid code rejection", True)
    else:
        print(f"   ❌ Expected 400, got {resp.status_code}: {resp.text}")
        log_test("Invalid code rejection", False, f"Expected 400, got {resp.status_code}")
    
    # Test 8: Cleanup - disable code
    print(f"\n8. Disabling discount code...")
    resp = requests.post(
        f"{BACKEND_URL}/platform/discount-codes/{code_id}/disable",
        headers=platform_headers
    )
    print(f"   Status: {resp.status_code}")
    
    if resp.status_code == 200:
        print(f"   ✅ Code disabled")
        log_test("Disable discount code", True)
    else:
        print(f"   ❌ Failed: {resp.text}")
        log_test("Disable discount code", False, resp.text)
    
    # Test 9: REGRESSION - create-order without discount_code should still return 503
    print(f"\n9. REGRESSION TEST: create-order without discount_code (should return 503)...")
    
    # First, find a different salon without subscription
    print("   Finding another salon for regression test...")
    resp = requests.get(
        f"{BACKEND_URL}/platform/salons?page=1&page_size=50",
        headers=platform_headers
    )
    
    if resp.status_code == 200:
        salons = resp.json().get("salons", [])
        
        # Find a salon different from the one we just used
        regression_salon_id = None
        for salon in salons:
            test_salon_id = salon.get("id")
            if test_salon_id != salon_id:
                # Check if it has no subscription
                resp = requests.get(f"{BACKEND_URL}/salons/{test_salon_id}/subscription/status")
                if resp.status_code == 200:
                    sub_data = resp.json()
                    if not sub_data.get("is_premium", False):
                        regression_salon_id = test_salon_id
                        print(f"   Found salon for regression test: {test_salon_id}")
                        break
        
        if regression_salon_id:
            # Get salon admin token for this salon
            resp = requests.post(
                f"{BACKEND_URL}/salon/users/login",
                json={
                    "salon_id": regression_salon_id,
                    "identifier": "admin",
                    "password": "salon123"
                }
            )
            
            if resp.status_code == 200:
                regression_token = resp.json().get("access_token")
                regression_headers = {"Authorization": f"Bearer {regression_token}"}
                
                # Try create-order without discount_code
                resp = requests.post(
                    f"{BACKEND_URL}/salons/{regression_salon_id}/subscription/create-order",
                    headers=regression_headers,
                    json={}
                )
                print(f"   Status: {resp.status_code}")
                
                if resp.status_code == 503:
                    error_data = resp.json()
                    detail = error_data.get("detail", "")
                    
                    if "payment gateway" in detail.lower() or "not configured" in detail.lower():
                        print(f"   ✅ Correctly returns 503: {detail}")
                        log_test("Regression: 503 without discount_code", True)
                    else:
                        print(f"   ⚠️ Returns 503 but unexpected message: {detail}")
                        log_test("Regression: 503 without discount_code", True, f"Unexpected message: {detail}")
                else:
                    print(f"   ❌ Expected 503, got {resp.status_code}: {resp.text}")
                    log_test("Regression: 503 without discount_code", False, f"Expected 503, got {resp.status_code}")
            else:
                print(f"   ⚠️ Could not login to regression salon, skipping regression test")
                log_test("Regression: 503 without discount_code", False, "Could not login to regression salon")
        else:
            print(f"   ⚠️ Could not find suitable salon for regression test, skipping")
            log_test("Regression: 503 without discount_code", False, "No suitable salon found")
    else:
        print(f"   ⚠️ Could not get salons list for regression test, skipping")
        log_test("Regression: 503 without discount_code", False, "Could not get salons list")

if __name__ == "__main__":
    print("="*80)
    print("PHASE 7 FREE_MONTHS RE-TEST")
    print("Testing discount code free_months flow after Cashfree check fix")
    print("="*80)
    
    run_phase7_free_months_tests()
    
    print_summary()
