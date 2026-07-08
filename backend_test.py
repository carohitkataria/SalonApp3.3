#!/usr/bin/env python3
"""
Cashfree Easy Split Payment Module Testing
Tests all 7 checks as specified in the review request.
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://jovial-mcclintock-6.preview.emergentagent.com/api"
ADMIN_IDENTIFIER = "admin"
ADMIN_PASSWORD = "salon123"

# Test results storage
test_results = []

def log_test(check_num, endpoint, method, expected_status, actual_status, passed, details=""):
    """Log test result"""
    result = {
        "check": check_num,
        "endpoint": endpoint,
        "method": method,
        "expected_status": expected_status,
        "actual_status": actual_status,
        "passed": passed,
        "details": details,
        "timestamp": datetime.now().isoformat()
    }
    test_results.append(result)
    status_icon = "✅" if passed else "❌"
    print(f"\n{status_icon} CHECK {check_num}: {method} {endpoint}")
    print(f"   Expected: {expected_status} | Actual: {actual_status}")
    if details:
        print(f"   Details: {details}")
    return passed

def admin_login():
    """Login as admin and return token + salon_id"""
    print("\n" + "="*80)
    print("ADMIN LOGIN")
    print("="*80)
    
    url = f"{BASE_URL}/salon/users/login"
    payload = {
        "identifier": ADMIN_IDENTIFIER,
        "password": ADMIN_PASSWORD
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        print(f"Login Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            salon_id = data.get("salon_id")
            print(f"✅ Login successful")
            print(f"   Salon ID: {salon_id}")
            print(f"   Token: {token[:50]}..." if token else "   Token: None")
            return token, salon_id
        else:
            print(f"❌ Login failed: {response.text}")
            return None, None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None, None

def create_test_booking(salon_id, token):
    """Create a test booking to get a token_id for check 6"""
    print("\n" + "="*80)
    print("CREATING TEST BOOKING FOR CHECK 6")
    print("="*80)
    
    # First, get an active barber
    url = f"{BASE_URL}/salons/{salon_id}/barbers"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code != 200:
            print(f"❌ Failed to get barbers: {response.status_code}")
            return None
        
        barbers = response.json()
        active_barbers = [b for b in barbers if b.get("is_active")]
        if not active_barbers:
            print("❌ No active barbers found")
            return None
        
        barber_id = active_barbers[0]["id"]
        print(f"Using barber: {active_barbers[0].get('name')} (ID: {barber_id})")
        
        # Get an enabled service
        url = f"{BASE_URL}/salons/{salon_id}/services/enabled"
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            print(f"❌ Failed to get services: {response.status_code}")
            return None
        
        services = response.json()
        if not services:
            print("❌ No enabled services found")
            return None
        
        service_id = services[0]["id"]
        print(f"Using service: {services[0].get('service_name')} (ID: {service_id})")
        
        # Create booking
        url = f"{BASE_URL}/salons/{salon_id}/salon-booking"
        booking_payload = {
            "customer_name": "Test Customer Payment",
            "phone": "9876543210",
            "gender": "Male",
            "barber_id": barber_id,
            "selected_services": [service_id],
            "date": "2026-05-10",
            "shift": "Morning",
            "payment_mode": "cash"
        }
        
        response = requests.post(url, json=booking_payload, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            token_id = data.get("id")
            token_number = data.get("token_number")
            print(f"✅ Booking created: Token {token_number} (ID: {token_id})")
            return token_id
        else:
            print(f"❌ Failed to create booking: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error creating booking: {e}")
        return None

def run_check_1(salon_id, token):
    """CHECK 1: GET /api/salons/{salon_id}/payment-vendor/status"""
    print("\n" + "="*80)
    print("CHECK 1: GET payment-vendor/status")
    print("="*80)
    
    url = f"{BASE_URL}/salons/{salon_id}/payment-vendor/status"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        status = response.status_code
        
        if status == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Check required fields
            has_onboarded = "onboarded" in data
            has_in_app = "in_app_payment_enabled" in data
            has_status = "status" in data
            
            onboarded_false = data.get("onboarded") == False
            in_app_false = data.get("in_app_payment_enabled") == False
            status_null = data.get("status") is None
            
            all_correct = (has_onboarded and has_in_app and has_status and 
                          onboarded_false and in_app_false and status_null)
            
            details = f"onboarded={data.get('onboarded')}, in_app_payment_enabled={data.get('in_app_payment_enabled')}, status={data.get('status')}"
            
            return log_test(1, url, "GET", 200, status, all_correct, details)
        else:
            return log_test(1, url, "GET", 200, status, False, response.text[:200])
            
    except Exception as e:
        return log_test(1, url, "GET", 200, "ERROR", False, str(e))

def run_check_2(salon_id, token):
    """CHECK 2: POST /api/salons/{salon_id}/payment-vendor/onboard with valid data (expect 502)"""
    print("\n" + "="*80)
    print("CHECK 2: POST payment-vendor/onboard with valid data (expect 502)")
    print("="*80)
    
    url = f"{BASE_URL}/salons/{salon_id}/payment-vendor/onboard"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "upi_vpa": "testsalon@okhdfcbank",
        "account_holder": "Test Holder",
        "pan": "ABCDE1234F"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        status = response.status_code
        
        print(f"Response Status: {status}")
        print(f"Response: {response.text[:500]}")
        
        if status == 502:
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            detail = data.get("detail", "")
            
            # Check that it mentions onboard or Cashfree
            has_helpful_message = ("onboard" in detail.lower() or "cashfree" in detail.lower() or 
                                  "vendor" in detail.lower() or "payment" in detail.lower())
            
            # Verify vendor row was NOT persisted - check status endpoint again
            status_url = f"{BASE_URL}/salons/{salon_id}/payment-vendor/status"
            status_response = requests.get(status_url, headers=headers, timeout=10)
            if status_response.status_code == 200:
                status_data = status_response.json()
                still_not_onboarded = status_data.get("onboarded") == False
                
                passed = has_helpful_message and still_not_onboarded
                details = f"detail='{detail}', vendor_persisted={not still_not_onboarded}"
                return log_test(2, url, "POST", 502, status, passed, details)
            else:
                return log_test(2, url, "POST", 502, status, has_helpful_message, f"detail='{detail}'")
        else:
            return log_test(2, url, "POST", 502, status, False, f"Expected 502, got {status}. Response: {response.text[:200]}")
            
    except Exception as e:
        return log_test(2, url, "POST", 502, "ERROR", False, str(e))

def run_check_3(salon_id, token):
    """CHECK 3: POST /api/salons/{salon_id}/payment-vendor/onboard with empty body (expect 400)"""
    print("\n" + "="*80)
    print("CHECK 3: POST payment-vendor/onboard with empty body (expect 400)")
    print("="*80)
    
    url = f"{BASE_URL}/salons/{salon_id}/payment-vendor/onboard"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {}
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        status = response.status_code
        
        print(f"Response Status: {status}")
        print(f"Response: {response.text[:500]}")
        
        if status == 400:
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            detail = data.get("detail", "")
            
            # Check that it mentions UPI or bank account
            has_helpful_message = ("upi" in detail.lower() or "bank" in detail.lower() or 
                                  "account" in detail.lower())
            
            details = f"detail='{detail}'"
            return log_test(3, url, "POST", 400, status, has_helpful_message, details)
        else:
            return log_test(3, url, "POST", 400, status, False, f"Expected 400, got {status}. Response: {response.text[:200]}")
            
    except Exception as e:
        return log_test(3, url, "POST", 400, "ERROR", False, str(e))

def run_check_4(salon_id, token):
    """CHECK 4: POST /api/salons/{salon_id}/payment-vendor/onboard with BOTH upi and bank (expect 400)"""
    print("\n" + "="*80)
    print("CHECK 4: POST payment-vendor/onboard with BOTH upi and bank (expect 400)")
    print("="*80)
    
    url = f"{BASE_URL}/salons/{salon_id}/payment-vendor/onboard"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "upi_vpa": "test@okhdfcbank",
        "bank_account_number": "1234567890",
        "bank_ifsc": "HDFC0001234",
        "account_holder": "Test Holder"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        status = response.status_code
        
        print(f"Response Status: {status}")
        print(f"Response: {response.text[:500]}")
        
        if status == 400:
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            detail = data.get("detail", "")
            
            # Check that it mentions choosing one
            has_helpful_message = ("either" in detail.lower() or "not both" in detail.lower() or 
                                  "choose" in detail.lower())
            
            details = f"detail='{detail}'"
            return log_test(4, url, "POST", 400, status, has_helpful_message, details)
        else:
            return log_test(4, url, "POST", 400, status, False, f"Expected 400, got {status}. Response: {response.text[:200]}")
            
    except Exception as e:
        return log_test(4, url, "POST", 400, "ERROR", False, str(e))

def run_check_5(salon_id):
    """CHECK 5: GET /api/service-payments/salon/{salon_id}/available (public, no auth)"""
    print("\n" + "="*80)
    print("CHECK 5: GET service-payments/salon/{salon_id}/available (public)")
    print("="*80)
    
    url = f"{BASE_URL}/service-payments/salon/{salon_id}/available"
    
    try:
        response = requests.get(url, timeout=10)
        status = response.status_code
        
        print(f"Response Status: {status}")
        print(f"Response: {response.text[:500]}")
        
        if status == 200:
            data = response.json()
            
            has_salon_id = "salon_id" in data
            has_in_app = "in_app_payment_enabled" in data
            in_app_false = data.get("in_app_payment_enabled") == False
            
            passed = has_salon_id and has_in_app and in_app_false
            details = f"salon_id={data.get('salon_id')}, in_app_payment_enabled={data.get('in_app_payment_enabled')}"
            
            return log_test(5, url, "GET", 200, status, passed, details)
        else:
            return log_test(5, url, "GET", 200, status, False, f"Expected 200, got {status}. Response: {response.text[:200]}")
            
    except Exception as e:
        return log_test(5, url, "GET", 200, "ERROR", False, str(e))

def run_check_6(salon_id, token):
    """CHECK 6: POST /api/service-payments/create-order (expect 409)"""
    print("\n" + "="*80)
    print("CHECK 6: POST service-payments/create-order (expect 409)")
    print("="*80)
    
    # Create a test booking first
    token_id = create_test_booking(salon_id, token)
    if not token_id:
        return log_test(6, "N/A", "POST", 409, "SETUP_FAILED", False, "Could not create test booking")
    
    url = f"{BASE_URL}/service-payments/create-order"
    payload = {"token_id": token_id}
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        status = response.status_code
        
        print(f"Response Status: {status}")
        print(f"Response: {response.text[:500]}")
        
        if status == 409:
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            detail = data.get("detail", "")
            
            # Check that it mentions not set up for in-app payment
            has_helpful_message = ("not set up" in detail.lower() or "in-app payment" in detail.lower() or 
                                  "vendor" in detail.lower() or "kyc" in detail.lower())
            
            details = f"detail='{detail}'"
            return log_test(6, url, "POST", 409, status, has_helpful_message, details)
        else:
            return log_test(6, url, "POST", 409, status, False, f"Expected 409, got {status}. Response: {response.text[:200]}")
            
    except Exception as e:
        return log_test(6, url, "POST", 409, "ERROR", False, str(e))

def run_check_7(salon_id, token):
    """CHECK 7: REGRESSION - POST /api/subscriptions/create-order (existing subscription flow)"""
    print("\n" + "="*80)
    print("CHECK 7: REGRESSION - POST subscriptions/create-order")
    print("="*80)
    
    # First, get an active plan
    pricing_url = f"{BASE_URL}/subscription-plans/active"
    
    try:
        response = requests.get(pricing_url, timeout=10)
        if response.status_code != 200:
            return log_test(7, pricing_url, "GET", 200, response.status_code, False, "Could not get active plan")
        
        plan_data = response.json()
        plan_id = plan_data.get("id")
        if not plan_id:
            return log_test(7, pricing_url, "GET", 200, 200, False, "No plan_id in response")
        
        print(f"Using plan: {plan_data.get('plan_name')} (ID: {plan_id})")
        
        # Now create order
        url = f"{BASE_URL}/subscriptions/create-order"
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "plan_id": plan_id,
            "duration_months": 1
        }
        
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        status = response.status_code
        
        print(f"Response Status: {status}")
        print(f"Response: {response.text[:500]}")
        
        # Accept 200 with payment_session_id OR 502/503 with helpful error (NOT 500)
        if status == 200:
            data = response.json()
            has_session_id = "payment_session_id" in data
            
            if has_session_id:
                details = f"payment_session_id present, subscription flow working"
                return log_test(7, url, "POST", "200 or 502/503", status, True, details)
            else:
                details = f"200 but no payment_session_id: {json.dumps(data)}"
                return log_test(7, url, "POST", "200 or 502/503", status, False, details)
        elif status in [502, 503]:
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            detail = data.get("detail", "")
            
            # This is acceptable - Cashfree might not be configured or have issues
            details = f"Acceptable error (502/503): {detail}"
            return log_test(7, url, "POST", "200 or 502/503", status, True, details)
        elif status == 500:
            details = f"FAIL: Got 500 crash instead of 502/503. Response: {response.text[:200]}"
            return log_test(7, url, "POST", "200 or 502/503", status, False, details)
        else:
            details = f"Unexpected status {status}. Response: {response.text[:200]}"
            return log_test(7, url, "POST", "200 or 502/503", status, False, details)
            
    except Exception as e:
        return log_test(7, url, "POST", "200 or 502/503", "ERROR", False, str(e))

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for r in test_results if r["passed"])
    total = len(test_results)
    
    print(f"\nTotal Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {total - passed}")
    print(f"Success Rate: {(passed/total*100):.1f}%\n")
    
    for result in test_results:
        status_icon = "✅" if result["passed"] else "❌"
        print(f"{status_icon} CHECK {result['check']}: {result['method']} {result['endpoint'].split('/api/')[-1]}")
        print(f"   Expected: {result['expected_status']} | Actual: {result['actual_status']}")
        if result['details']:
            print(f"   {result['details']}")
    
    print("\n" + "="*80)

def main():
    """Main test runner"""
    print("="*80)
    print("CASHFREE EASY SPLIT PAYMENT MODULE TESTING")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin: {ADMIN_IDENTIFIER}")
    print(f"Time: {datetime.now().isoformat()}")
    
    # Login
    token, salon_id = admin_login()
    if not token or not salon_id:
        print("\n❌ FATAL: Admin login failed. Cannot proceed with tests.")
        return
    
    # Run all checks
    run_check_1(salon_id, token)
    run_check_2(salon_id, token)
    run_check_3(salon_id, token)
    run_check_4(salon_id, token)
    run_check_5(salon_id)
    run_check_6(salon_id, token)
    run_check_7(salon_id, token)
    
    # Print summary
    print_summary()

if __name__ == "__main__":
    main()
