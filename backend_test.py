#!/usr/bin/env python3
"""
Backend API Testing for SalonHub - Twilio WhatsApp OTP Security Test
Tests that NO send-otp endpoint returns the OTP in the JSON response.
"""

import requests
import json
from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')

# Configuration
BACKEND_URL = os.getenv('BACKEND_PUBLIC_URL', 'https://login-builder-10.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'salon_app')

# MongoDB connection
mongo_client = MongoClient(MONGO_URL)
db = mongo_client[DB_NAME]

print("=" * 80)
print("TWILIO WHATSAPP OTP SECURITY TEST")
print("=" * 80)
print(f"Backend URL: {BACKEND_URL}")
print(f"MongoDB: {MONGO_URL}/{DB_NAME}")
print("=" * 80)

# Test counters
tests_passed = 0
tests_failed = 0
critical_issues = []

def test_result(test_name, passed, details=""):
    """Record test result"""
    global tests_passed, tests_failed
    if passed:
        tests_passed += 1
        print(f"✅ PASS: {test_name}")
        if details:
            print(f"   {details}")
    else:
        tests_failed += 1
        print(f"❌ FAIL: {test_name}")
        if details:
            print(f"   {details}")
        critical_issues.append(f"{test_name}: {details}")

def check_no_otp_in_response(response_json, endpoint_name):
    """Check that 'otp' key is NOT present in response"""
    if 'otp' in response_json:
        return False, f"SECURITY VIOLATION: 'otp' field found in response: {response_json.get('otp')}"
    return True, "No 'otp' field in response (correct)"

print("\n" + "=" * 80)
print("TEST 1: POST /api/auth/customer/send-otp")
print("=" * 80)
try:
    payload = {
        "phone": "9876500011",
        "purpose": "login"
    }
    response = requests.post(f"{API_BASE}/auth/customer/send-otp", json=payload, timeout=10)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    if response.status_code == 200:
        resp_json = response.json()
        
        # Check 1: No OTP in response
        passed, msg = check_no_otp_in_response(resp_json, "auth/customer/send-otp")
        test_result("auth/customer/send-otp - No OTP in response", passed, msg)
        
        # Check 2: delivery_status present
        if 'delivery_status' in resp_json:
            test_result("auth/customer/send-otp - delivery_status present", True, 
                       f"delivery_status: {resp_json['delivery_status']}")
        else:
            test_result("auth/customer/send-otp - delivery_status present", False, 
                       "delivery_status field missing")
        
        # Check 3: note present
        if 'note' in resp_json:
            test_result("auth/customer/send-otp - note present", True, 
                       f"note: {resp_json['note']}")
        else:
            test_result("auth/customer/send-otp - note present", False, 
                       "note field missing")
    else:
        test_result("auth/customer/send-otp - HTTP 200", False, 
                   f"Got {response.status_code}: {response.text}")
except Exception as e:
    test_result("auth/customer/send-otp", False, f"Exception: {str(e)}")

print("\n" + "=" * 80)
print("TEST 2: POST /api/salon/send-otp")
print("=" * 80)
try:
    payload = {
        "phone": "7503070727"
    }
    response = requests.post(f"{API_BASE}/salon/send-otp", json=payload, timeout=10)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    if response.status_code == 200:
        resp_json = response.json()
        
        # Check 1: No OTP in response
        passed, msg = check_no_otp_in_response(resp_json, "salon/send-otp")
        test_result("salon/send-otp - No OTP in response", passed, msg)
        
        # Check 2: delivery_status present
        if 'delivery_status' in resp_json:
            test_result("salon/send-otp - delivery_status present", True, 
                       f"delivery_status: {resp_json['delivery_status']}")
        else:
            test_result("salon/send-otp - delivery_status present", False, 
                       "delivery_status field missing")
    else:
        test_result("salon/send-otp - HTTP 200", False, 
                   f"Got {response.status_code}: {response.text}")
except Exception as e:
    test_result("salon/send-otp", False, f"Exception: {str(e)}")

print("\n" + "=" * 80)
print("TEST 3: POST /api/customer/send-otp (legacy endpoint)")
print("=" * 80)
try:
    payload = {
        "phone": "7503070727"
    }
    response = requests.post(f"{API_BASE}/customer/send-otp", json=payload, timeout=10)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    if response.status_code == 200:
        resp_json = response.json()
        
        # Check 1: No OTP in response
        passed, msg = check_no_otp_in_response(resp_json, "customer/send-otp")
        test_result("customer/send-otp - No OTP in response", passed, msg)
        
        # Check 2: delivery_status present
        if 'delivery_status' in resp_json:
            test_result("customer/send-otp - delivery_status present", True, 
                       f"delivery_status: {resp_json['delivery_status']}")
        else:
            test_result("customer/send-otp - delivery_status present", False, 
                       "delivery_status field missing")
    elif response.status_code == 404:
        print(f"Note: User not found (404). This is expected if phone is not registered.")
        test_result("customer/send-otp - Endpoint exists", True, 
                   "Endpoint exists (404 for unregistered user is expected)")
    else:
        test_result("customer/send-otp - HTTP 200 or 404", False, 
                   f"Got {response.status_code}: {response.text}")
except Exception as e:
    test_result("customer/send-otp", False, f"Exception: {str(e)}")

print("\n" + "=" * 80)
print("TEST 4: End-to-End OTP Verification Flow")
print("=" * 80)
print("Step 1: Send OTP to phone 9876500012")
try:
    payload = {
        "phone": "9876500012",
        "purpose": "login"
    }
    response = requests.post(f"{API_BASE}/auth/customer/send-otp", json=payload, timeout=10)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    if response.status_code == 200:
        resp_json = response.json()
        
        # Verify no OTP in response
        passed, msg = check_no_otp_in_response(resp_json, "send-otp for verification test")
        test_result("E2E - send-otp returns no OTP", passed, msg)
        
        # Step 2: Read OTP from MongoDB
        print("\nStep 2: Reading OTP from MongoDB...")
        normalized_phone = "+919876500012"
        otp_doc = db.customer_otp.find_one({"phone": normalized_phone})
        
        if otp_doc:
            stored_otp = otp_doc.get('otp')
            print(f"Found OTP in MongoDB: {stored_otp}")
            test_result("E2E - OTP stored in MongoDB", True, f"OTP: {stored_otp}")
            
            # Step 3: Verify OTP
            print("\nStep 3: Verifying OTP...")
            verify_payload = {
                "phone": "9876500012",
                "otp": stored_otp,
                "purpose": "login"
            }
            verify_response = requests.post(f"{API_BASE}/auth/customer/verify-otp", 
                                           json=verify_payload, timeout=10)
            print(f"Status Code: {verify_response.status_code}")
            print(f"Response: {json.dumps(verify_response.json(), indent=2)}")
            
            if verify_response.status_code == 200:
                verify_json = verify_response.json()
                
                # Check for access_token
                if 'access_token' in verify_json:
                    test_result("E2E - verify-otp returns access_token", True, 
                               "access_token present")
                else:
                    test_result("E2E - verify-otp returns access_token", False, 
                               "access_token missing")
                
                # Check for token_type
                if verify_json.get('token_type') == 'bearer':
                    test_result("E2E - verify-otp token_type is bearer", True)
                else:
                    test_result("E2E - verify-otp token_type is bearer", False, 
                               f"Got: {verify_json.get('token_type')}")
                
                # Check for user object
                if 'user' in verify_json:
                    test_result("E2E - verify-otp returns user object", True)
                else:
                    test_result("E2E - verify-otp returns user object", False)
            else:
                test_result("E2E - verify-otp HTTP 200", False, 
                           f"Got {verify_response.status_code}: {verify_response.text}")
        else:
            test_result("E2E - OTP stored in MongoDB", False, 
                       f"No OTP found for {normalized_phone}")
    else:
        test_result("E2E - send-otp HTTP 200", False, 
                   f"Got {response.status_code}: {response.text}")
except Exception as e:
    test_result("E2E verification flow", False, f"Exception: {str(e)}")

print("\n" + "=" * 80)
print("TEST 5: Negative Test - Wrong OTP")
print("=" * 80)
try:
    # First send OTP
    payload = {
        "phone": "9876500012",
        "purpose": "login"
    }
    response = requests.post(f"{API_BASE}/auth/customer/send-otp", json=payload, timeout=10)
    
    if response.status_code == 200:
        # Try to verify with wrong OTP
        print("Attempting to verify with wrong OTP: 000000")
        verify_payload = {
            "phone": "9876500012",
            "otp": "000000",
            "purpose": "login"
        }
        verify_response = requests.post(f"{API_BASE}/auth/customer/verify-otp", 
                                       json=verify_payload, timeout=10)
        print(f"Status Code: {verify_response.status_code}")
        print(f"Response: {json.dumps(verify_response.json(), indent=2)}")
        
        if verify_response.status_code == 400:
            resp_json = verify_response.json()
            if 'Invalid OTP' in str(resp_json.get('detail', '')):
                test_result("Negative - Wrong OTP returns 400 'Invalid OTP'", True)
            else:
                test_result("Negative - Wrong OTP returns 400 'Invalid OTP'", False, 
                           f"Got detail: {resp_json.get('detail')}")
        else:
            test_result("Negative - Wrong OTP returns 400", False, 
                       f"Got {verify_response.status_code}")
    else:
        test_result("Negative - send-otp for negative test", False, 
                   f"Got {response.status_code}")
except Exception as e:
    test_result("Negative test - wrong OTP", False, f"Exception: {str(e)}")

# Summary
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"Total Tests: {tests_passed + tests_failed}")
print(f"✅ Passed: {tests_passed}")
print(f"❌ Failed: {tests_failed}")

if critical_issues:
    print("\n🚨 CRITICAL ISSUES:")
    for issue in critical_issues:
        print(f"  - {issue}")
else:
    print("\n✅ ALL TESTS PASSED - NO CRITICAL ISSUES")

print("=" * 80)

# Exit with appropriate code
exit(0 if tests_failed == 0 else 1)
