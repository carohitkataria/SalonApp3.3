#!/usr/bin/env python3
"""
Backend API Testing Script for SalonHub Pro Subscription System
Tests all subscription endpoints (A-H) as specified in the review request.
"""
import requests
import json
import sys
from typing import Dict, Any, Optional

# Backend URL from environment
BACKEND_URL = "https://staff-management-pro-2.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
LOGIN_ENDPOINT = f"{BACKEND_URL}/salon/users/login"
LOGIN_CREDENTIALS = {
    "identifier": "admin",
    "password": "salon123"
}

# Global variables for auth
access_token: Optional[str] = None
salon_id: Optional[str] = None
headers: Dict[str, str] = {}


def print_section(title: str):
    """Print a formatted section header."""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def print_test(test_name: str, status: str, details: str = ""):
    """Print test result."""
    status_symbol = "✅" if status == "PASS" else "❌"
    print(f"\n{status_symbol} {test_name}: {status}")
    if details:
        print(f"   {details}")


def login() -> bool:
    """Login and get access token and salon_id."""
    global access_token, salon_id, headers
    
    print_section("AUTHENTICATION")
    print(f"Logging in with credentials: {LOGIN_CREDENTIALS['identifier']}")
    
    try:
        response = requests.post(LOGIN_ENDPOINT, json=LOGIN_CREDENTIALS, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            access_token = data.get("access_token")
            salon_id = data.get("salon_id")
            
            if access_token and salon_id:
                headers = {"Authorization": f"Bearer {access_token}"}
                print(f"✅ Login successful!")
                print(f"   Salon ID: {salon_id}")
                print(f"   Token: {access_token[:20]}...")
                return True
            else:
                print(f"❌ Login response missing access_token or salon_id")
                print(f"   Response: {json.dumps(data, indent=2)}")
                return False
        else:
            print(f"❌ Login failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False


def test_a_get_active_plan():
    """A) GET /api/subscription-plans/active"""
    print_section("TEST A: GET /api/subscription-plans/active")
    
    try:
        url = f"{BACKEND_URL}/subscription-plans/active"
        response = requests.get(url, timeout=10)
        
        print(f"URL: {url}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify required fields
            required_fields = ["id", "plan_name", "price", "billing_cycle", "status", "is_default", "features"]
            missing_fields = [f for f in required_fields if f not in data]
            
            if missing_fields:
                print_test("TEST A", "FAIL", f"Missing fields: {missing_fields}")
                return False
            
            # Verify values
            if data.get("plan_name") != "SalonHub Pro":
                print_test("TEST A", "FAIL", f"Expected plan_name='SalonHub Pro', got '{data.get('plan_name')}'")
                return False
            
            if data.get("price") != 499.0:
                print_test("TEST A", "FAIL", f"Expected price=499.0, got {data.get('price')}")
                return False
            
            if data.get("billing_cycle") != "monthly":
                print_test("TEST A", "FAIL", f"Expected billing_cycle='monthly', got '{data.get('billing_cycle')}'")
                return False
            
            if data.get("status") != "active":
                print_test("TEST A", "FAIL", f"Expected status='active', got '{data.get('status')}'")
                return False
            
            if data.get("is_default") != True:
                print_test("TEST A", "FAIL", f"Expected is_default=true, got {data.get('is_default')}")
                return False
            
            if not isinstance(data.get("features"), list) or len(data.get("features", [])) == 0:
                print_test("TEST A", "FAIL", f"Expected non-empty features list, got {data.get('features')}")
                return False
            
            print_test("TEST A", "PASS", "All fields present and correct")
            return True
        else:
            print_test("TEST A", "FAIL", f"Expected 200, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_test("TEST A", "FAIL", f"Exception: {e}")
        return False


def test_b_subscription_status():
    """B) GET /api/salons/{salon_id}/subscription/status"""
    print_section("TEST B: GET /api/salons/{salon_id}/subscription/status")
    
    try:
        url = f"{BACKEND_URL}/salons/{salon_id}/subscription/status"
        response = requests.get(url, timeout=10)
        
        print(f"URL: {url}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # For a salon that has never paid, expect:
            # is_premium=false, status="free", expiry_date=null, subscription=null, plan object present
            
            if data.get("is_premium") != False:
                print_test("TEST B", "FAIL", f"Expected is_premium=false, got {data.get('is_premium')}")
                return False
            
            if data.get("status") != "free":
                print_test("TEST B", "FAIL", f"Expected status='free', got '{data.get('status')}'")
                return False
            
            if data.get("expiry_date") is not None:
                print_test("TEST B", "FAIL", f"Expected expiry_date=null, got {data.get('expiry_date')}")
                return False
            
            if data.get("subscription") is not None:
                print_test("TEST B", "FAIL", f"Expected subscription=null, got {data.get('subscription')}")
                return False
            
            if "plan" not in data or not isinstance(data.get("plan"), dict):
                print_test("TEST B", "FAIL", f"Expected plan object, got {data.get('plan')}")
                return False
            
            print_test("TEST B", "PASS", "Subscription status correct for free plan")
            return True
        else:
            print_test("TEST B", "FAIL", f"Expected 200, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_test("TEST B", "FAIL", f"Exception: {e}")
        return False


def test_c_create_order():
    """C) POST /api/salons/{salon_id}/subscription/create-order"""
    print_section("TEST C: POST /api/salons/{salon_id}/subscription/create-order")
    
    try:
        url = f"{BACKEND_URL}/salons/{salon_id}/subscription/create-order"
        response = requests.post(url, json={}, headers=headers, timeout=15)
        
        print(f"URL: {url}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify required fields
            required_fields = ["order_id", "payment_session_id", "amount", "currency", "plan", "subscription_id", "cashfree_env"]
            missing_fields = [f for f in required_fields if f not in data]
            
            if missing_fields:
                print_test("TEST C", "FAIL", f"Missing fields: {missing_fields}")
                return False
            
            # Verify values
            if not data.get("order_id", "").startswith("SH-"):
                print_test("TEST C", "FAIL", f"Expected order_id to start with 'SH-', got '{data.get('order_id')}'")
                return False
            
            if not data.get("payment_session_id"):
                print_test("TEST C", "FAIL", f"Expected non-empty payment_session_id")
                return False
            
            if data.get("amount") != 499.0:
                print_test("TEST C", "FAIL", f"Expected amount=499.0, got {data.get('amount')}")
                return False
            
            if data.get("currency") != "INR":
                print_test("TEST C", "FAIL", f"Expected currency='INR', got '{data.get('currency')}'")
                return False
            
            if data.get("cashfree_env") != "PROD":
                print_test("TEST C", "FAIL", f"Expected cashfree_env='PROD', got '{data.get('cashfree_env')}'")
                return False
            
            # Verify transaction was created - check via transactions endpoint
            order_id = data.get("order_id")
            print(f"\n   Verifying transaction record for order_id: {order_id}")
            
            tx_url = f"{BACKEND_URL}/salons/{salon_id}/subscription/transactions"
            tx_response = requests.get(tx_url, headers=headers, timeout=10)
            
            if tx_response.status_code == 200:
                transactions = tx_response.json()
                print(f"   Found {len(transactions)} transaction(s)")
                
                # Find the transaction for this order
                matching_tx = None
                for tx in transactions:
                    if tx.get("gateway_order_id") == order_id:
                        matching_tx = tx
                        break
                
                if matching_tx:
                    print(f"   ✅ Transaction found with payment_status: {matching_tx.get('payment_status')}")
                    if matching_tx.get("payment_status") != "pending":
                        print_test("TEST C", "FAIL", f"Expected transaction payment_status='pending', got '{matching_tx.get('payment_status')}'")
                        return False
                else:
                    print_test("TEST C", "FAIL", f"Transaction not found for order_id {order_id}")
                    return False
            else:
                print(f"   ⚠️  Could not verify transaction (status {tx_response.status_code})")
            
            print_test("TEST C", "PASS", f"Order created successfully: {order_id}")
            
            # Store order_id for test D
            global created_order_id
            created_order_id = order_id
            
            return True
        else:
            print_test("TEST C", "FAIL", f"Expected 200, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_test("TEST C", "FAIL", f"Exception: {e}")
        return False


def test_d_verify_payment():
    """D) POST /api/salons/{salon_id}/subscription/verify-payment"""
    print_section("TEST D: POST /api/salons/{salon_id}/subscription/verify-payment")
    
    if not created_order_id:
        print_test("TEST D", "SKIP", "No order_id from test C")
        return False
    
    try:
        url = f"{BACKEND_URL}/salons/{salon_id}/subscription/verify-payment"
        payload = {"order_id": created_order_id}
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        
        print(f"URL: {url}")
        print(f"Payload: {json.dumps(payload)}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # For an unpaid order, expect success=false and status in ("pending", "payment_failed")
            if data.get("success") != False:
                print_test("TEST D", "FAIL", f"Expected success=false, got {data.get('success')}")
                return False
            
            status = data.get("status")
            if status not in ("pending", "payment_failed"):
                print_test("TEST D", "FAIL", f"Expected status in ('pending', 'payment_failed'), got '{status}'")
                return False
            
            print_test("TEST D", "PASS", f"Verify payment returned success=false, status='{status}' (expected for unpaid order)")
            return True
        else:
            print_test("TEST D", "FAIL", f"Expected 200, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_test("TEST D", "FAIL", f"Exception: {e}")
        return False


def test_e_paywall_branches():
    """E) PAYWALL - branches (POST /api/salons/{salon_id}/branches)"""
    print_section("TEST E: PAYWALL - POST /api/salons/{salon_id}/branches")
    
    try:
        url = f"{BACKEND_URL}/salons/{salon_id}/branches"
        payload = {
            "branch_name": "Test Branch",
            "branch_code": "TST",
            "city": "Bangalore"
        }
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        print(f"URL: {url}")
        print(f"Payload: {json.dumps(payload)}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 402:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify the error structure
            detail = data.get("detail", {})
            
            if detail.get("error") != "subscription_required":
                print_test("TEST E", "FAIL", f"Expected error='subscription_required', got '{detail.get('error')}'")
                return False
            
            if detail.get("limit_type") != "max_branches":
                print_test("TEST E", "FAIL", f"Expected limit_type='max_branches', got '{detail.get('limit_type')}'")
                return False
            
            if not isinstance(detail.get("current_count"), int) or detail.get("current_count") < 1:
                print_test("TEST E", "FAIL", f"Expected current_count >= 1, got {detail.get('current_count')}")
                return False
            
            if detail.get("max_allowed") != 1:
                print_test("TEST E", "FAIL", f"Expected max_allowed=1, got {detail.get('max_allowed')}")
                return False
            
            if detail.get("plan_price") != 499.0:
                print_test("TEST E", "FAIL", f"Expected plan_price=499.0, got {detail.get('plan_price')}")
                return False
            
            if detail.get("plan_name") != "SalonHub Pro":
                print_test("TEST E", "FAIL", f"Expected plan_name='SalonHub Pro', got '{detail.get('plan_name')}'")
                return False
            
            if not detail.get("message"):
                print_test("TEST E", "FAIL", f"Expected non-empty message")
                return False
            
            print_test("TEST E", "PASS", f"Paywall correctly blocked branch creation (current: {detail.get('current_count')}, max: {detail.get('max_allowed')})")
            return True
        else:
            print_test("TEST E", "FAIL", f"Expected 402, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_test("TEST E", "FAIL", f"Exception: {e}")
        return False


def test_f_paywall_staff():
    """F) PAYWALL - staff/barbers (POST /api/salons/{salon_id}/barbers)"""
    print_section("TEST F: PAYWALL - POST /api/salons/{salon_id}/barbers")
    
    try:
        # First, check current barber count
        barbers_url = f"{BACKEND_URL}/salons/{salon_id}/barbers"
        barbers_response = requests.get(barbers_url, timeout=10)
        
        if barbers_response.status_code == 200:
            barbers = barbers_response.json()
            active_barbers = [b for b in barbers if b.get("is_active") == True]
            print(f"Current active barbers: {len(active_barbers)}")
            
            if len(active_barbers) < 1:
                print_test("TEST F", "SKIP", "Need at least 1 active barber for paywall test")
                return False
        
        # Now try to add a new barber
        url = f"{BACKEND_URL}/salons/{salon_id}/barbers"
        payload = {
            "name": "TestBarber",
            "experience": 3,
            "category": "junior",
            "mobile": "+919999999999",
            "salon_id": salon_id
        }
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        
        print(f"URL: {url}")
        print(f"Payload: {json.dumps(payload)}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 402:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Verify the error structure
            detail = data.get("detail", {})
            
            if detail.get("error") != "subscription_required":
                print_test("TEST F", "FAIL", f"Expected error='subscription_required', got '{detail.get('error')}'")
                return False
            
            if detail.get("limit_type") != "max_staff":
                print_test("TEST F", "FAIL", f"Expected limit_type='max_staff', got '{detail.get('limit_type')}'")
                return False
            
            if not isinstance(detail.get("current_count"), int) or detail.get("current_count") < 1:
                print_test("TEST F", "FAIL", f"Expected current_count >= 1, got {detail.get('current_count')}")
                return False
            
            if detail.get("max_allowed") != 1:
                print_test("TEST F", "FAIL", f"Expected max_allowed=1, got {detail.get('max_allowed')}")
                return False
            
            if detail.get("plan_price") != 499.0:
                print_test("TEST F", "FAIL", f"Expected plan_price=499.0, got {detail.get('plan_price')}")
                return False
            
            if detail.get("plan_name") != "SalonHub Pro":
                print_test("TEST F", "FAIL", f"Expected plan_name='SalonHub Pro', got '{detail.get('plan_name')}'")
                return False
            
            if not detail.get("message"):
                print_test("TEST F", "FAIL", f"Expected non-empty message")
                return False
            
            print_test("TEST F", "PASS", f"Paywall correctly blocked staff creation (current: {detail.get('current_count')}, max: {detail.get('max_allowed')})")
            return True
        else:
            print_test("TEST F", "FAIL", f"Expected 402, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_test("TEST F", "FAIL", f"Exception: {e}")
        return False


def test_g_webhook():
    """G) WEBHOOK (POST /api/subscriptions/webhook)"""
    print_section("TEST G: POST /api/subscriptions/webhook")
    
    try:
        url = f"{BACKEND_URL}/subscriptions/webhook"
        payload = {"data": {"order": {"order_id": "FAKE"}}}
        # No signature headers
        response = requests.post(url, json=payload, timeout=10)
        
        print(f"URL: {url}")
        print(f"Payload: {json.dumps(payload)}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Expect received: true, verified: false
            if data.get("received") != True:
                print_test("TEST G", "FAIL", f"Expected received=true, got {data.get('received')}")
                return False
            
            if data.get("verified") != False:
                print_test("TEST G", "FAIL", f"Expected verified=false, got {data.get('verified')}")
                return False
            
            print_test("TEST G", "PASS", "Webhook endpoint handled invalid signature correctly")
            return True
        else:
            print_test("TEST G", "FAIL", f"Expected 200, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_test("TEST G", "FAIL", f"Exception: {e}")
        return False


def test_h_admin_plan_update():
    """H) ADMIN PLAN UPDATE (PUT /api/admin/subscription-plans/{plan_id})"""
    print_section("TEST H: PUT /api/admin/subscription-plans/{plan_id}")
    
    try:
        # First, get the active plan to get its ID
        plan_url = f"{BACKEND_URL}/subscription-plans/active"
        plan_response = requests.get(plan_url, timeout=10)
        
        if plan_response.status_code != 200:
            print_test("TEST H", "FAIL", f"Could not get active plan: {plan_response.status_code}")
            return False
        
        plan = plan_response.json()
        plan_id = plan.get("id")
        print(f"Active plan ID: {plan_id}")
        
        # Update price to 599
        url = f"{BACKEND_URL}/admin/subscription-plans/{plan_id}"
        payload = {"price": 599}
        response = requests.put(url, json=payload, headers=headers, timeout=10)
        
        print(f"\nURL: {url}")
        print(f"Payload: {json.dumps(payload)}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if data.get("price") != 599.0:
                print_test("TEST H", "FAIL", f"Expected price=599.0, got {data.get('price')}")
                return False
            
            print(f"✅ Price updated to 599")
            
            # Reset price to 499
            print(f"\nResetting price to 499...")
            reset_payload = {"price": 499}
            reset_response = requests.put(url, json=reset_payload, headers=headers, timeout=10)
            
            if reset_response.status_code == 200:
                reset_data = reset_response.json()
                print(f"Reset response: {json.dumps(reset_data, indent=2)}")
                
                if reset_data.get("price") != 499.0:
                    print_test("TEST H", "FAIL", f"Expected reset price=499.0, got {reset_data.get('price')}")
                    return False
                
                print(f"✅ Price reset to 499")
                print_test("TEST H", "PASS", "Admin plan update working correctly")
                return True
            else:
                print_test("TEST H", "FAIL", f"Reset failed with status {reset_response.status_code}: {reset_response.text}")
                return False
        else:
            print_test("TEST H", "FAIL", f"Expected 200, got {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print_test("TEST H", "FAIL", f"Exception: {e}")
        return False


def main():
    """Run all tests."""
    print("\n" + "=" * 80)
    print("  SALONHUB PRO SUBSCRIPTION SYSTEM - BACKEND TESTING")
    print("=" * 80)
    
    # Login first
    if not login():
        print("\n❌ AUTHENTICATION FAILED - Cannot proceed with tests")
        sys.exit(1)
    
    # Run all tests
    results = {}
    
    results["A"] = test_a_get_active_plan()
    results["B"] = test_b_subscription_status()
    results["C"] = test_c_create_order()
    results["D"] = test_d_verify_payment()
    results["E"] = test_e_paywall_branches()
    results["F"] = test_f_paywall_staff()
    results["G"] = test_g_webhook()
    results["H"] = test_h_admin_plan_update()
    
    # Summary
    print_section("TEST SUMMARY")
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  Test {test}: {status}")
    
    print(f"\n  Total: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)


# Global variable to store order_id from test C
created_order_id = None

if __name__ == "__main__":
    main()
