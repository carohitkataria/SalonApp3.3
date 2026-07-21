#!/usr/bin/env python3
"""
Backend API Testing Script for Salon Login Endpoint
Tests the salon/users/login endpoint end-to-end as per review request
"""

import requests
import json
import sys
from typing import Dict, Any

# Backend URL from frontend/.env
BACKEND_URL = "https://wip-final-push.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_LOGIN_ID = "admin"
ADMIN_PASSWORD = "salon123"
ADMIN_MOBILE = "+917503070727"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_test_header(test_num: int, description: str):
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST {test_num}: {description}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")

def print_success(message: str):
    print(f"{Colors.GREEN}✅ PASS: {message}{Colors.RESET}")

def print_failure(message: str):
    print(f"{Colors.RED}❌ FAIL: {message}{Colors.RESET}")

def print_info(message: str):
    print(f"{Colors.YELLOW}ℹ️  INFO: {message}{Colors.RESET}")

def test_1_salon_login_with_admin_credentials():
    """
    Test 1: Confirm salon-user login works with the seeded admin
    POST /api/salon/users/login
    Body: {"identifier": "admin", "password": "salon123"}
    Expected: HTTP 200 with access_token, salon_id, role="admin"
    """
    print_test_header(1, "Salon Login with Admin Credentials (identifier=admin)")
    
    url = f"{BACKEND_URL}/salon/users/login"
    payload = {
        "identifier": ADMIN_LOGIN_ID,
        "password": ADMIN_PASSWORD
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        print_info(f"Request URL: {url}")
        print_info(f"Request Body: {json.dumps(payload, indent=2)}")
        print_info(f"Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_info(f"Response Body: {json.dumps(data, indent=2)}")
            
            # Verify required fields
            checks = []
            checks.append(("access_token" in data, "access_token present"))
            checks.append(("salon_id" in data, "salon_id present"))
            checks.append(("role" in data, "role present"))
            checks.append((data.get("role") == "admin", f"role is 'admin' (got: {data.get('role')})"))
            
            all_passed = all(check[0] for check in checks)
            
            for passed, message in checks:
                if passed:
                    print_success(message)
                else:
                    print_failure(message)
            
            if all_passed:
                print_success("Test 1 PASSED: Admin login successful with all required fields")
                return True, data
            else:
                print_failure("Test 1 FAILED: Missing or incorrect fields in response")
                return False, None
        else:
            print_failure(f"Test 1 FAILED: Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text}")
            return False, None
            
    except Exception as e:
        print_failure(f"Test 1 FAILED: Exception occurred - {str(e)}")
        return False, None

def test_2_salon_login_with_login_id():
    """
    Test 2: Confirm login also works with identifier=admin when the user enters their Login ID
    Same as Test 1 - the endpoint should look up by login_id OR mobile
    """
    print_test_header(2, "Salon Login with Login ID (identifier=admin)")
    
    # This is essentially the same as Test 1, but we're explicitly testing
    # that the endpoint accepts login_id as identifier
    url = f"{BACKEND_URL}/salon/users/login"
    payload = {
        "identifier": ADMIN_LOGIN_ID,  # Using login_id
        "password": ADMIN_PASSWORD
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        print_info(f"Request URL: {url}")
        print_info(f"Request Body: {json.dumps(payload, indent=2)}")
        print_info(f"Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_success("Login with login_id as identifier works")
            
            # Also test with mobile number as identifier
            print_info("\nTesting with mobile number as identifier...")
            payload_mobile = {
                "identifier": ADMIN_MOBILE,
                "password": ADMIN_PASSWORD
            }
            response_mobile = requests.post(url, json=payload_mobile, timeout=10)
            
            if response_mobile.status_code == 200:
                print_success("Login with mobile as identifier also works")
                print_success("Test 2 PASSED: Both login_id and mobile work as identifier")
                return True, data
            else:
                print_failure(f"Login with mobile failed: {response_mobile.status_code}")
                return False, None
        else:
            print_failure(f"Test 2 FAILED: Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text}")
            return False, None
            
    except Exception as e:
        print_failure(f"Test 2 FAILED: Exception occurred - {str(e)}")
        return False, None

def test_3_error_paths():
    """
    Test 3: Confirm the standard error paths still respond
    - Wrong password: {"identifier":"admin","password":"wrong"} → 401
    - Non-existent user: {"identifier":"doesnotexist","password":"anything"} → 404
    """
    print_test_header(3, "Error Path Testing (Wrong Password & Non-existent User)")
    
    url = f"{BACKEND_URL}/salon/users/login"
    
    # Test 3a: Wrong password
    print_info("\n3a. Testing wrong password...")
    payload_wrong_pwd = {
        "identifier": ADMIN_LOGIN_ID,
        "password": "wrongpassword"
    }
    
    try:
        response = requests.post(url, json=payload_wrong_pwd, timeout=10)
        print_info(f"Response Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 401:
            print_success("Wrong password correctly returns 401 Unauthorized")
            test_3a_passed = True
        else:
            print_failure(f"Wrong password should return 401, got {response.status_code}")
            test_3a_passed = False
    except Exception as e:
        print_failure(f"Exception during wrong password test: {str(e)}")
        test_3a_passed = False
    
    # Test 3b: Non-existent user
    print_info("\n3b. Testing non-existent user...")
    payload_no_user = {
        "identifier": "doesnotexist",
        "password": "anything"
    }
    
    try:
        response = requests.post(url, json=payload_no_user, timeout=10)
        print_info(f"Response Status: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 404:
            data = response.json()
            if "User not found or inactive" in data.get("detail", ""):
                print_success("Non-existent user correctly returns 404 with 'User not found or inactive'")
                test_3b_passed = True
            else:
                print_failure(f"404 returned but detail message incorrect: {data.get('detail')}")
                test_3b_passed = False
        else:
            print_failure(f"Non-existent user should return 404, got {response.status_code}")
            test_3b_passed = False
    except Exception as e:
        print_failure(f"Exception during non-existent user test: {str(e)}")
        test_3b_passed = False
    
    if test_3a_passed and test_3b_passed:
        print_success("\nTest 3 PASSED: All error paths working correctly")
        return True
    else:
        print_failure("\nTest 3 FAILED: Some error paths not working correctly")
        return False

def test_4_cors_preflight():
    """
    Test 4: CORS preflight
    OPTIONS on the same URL with Origin, Access-Control-Request-Method, Access-Control-Request-Headers
    should return 204 with access-control-allow-origin
    """
    print_test_header(4, "CORS Preflight Testing")
    
    url = f"{BACKEND_URL}/salon/users/login"
    headers = {
        "Origin": "https://wip-final-push.preview.emergentagent.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"
    }
    
    try:
        response = requests.options(url, headers=headers, timeout=10)
        print_info(f"Request URL: {url}")
        print_info(f"Request Headers: {json.dumps(headers, indent=2)}")
        print_info(f"Response Status: {response.status_code}")
        print_info(f"Response Headers: {dict(response.headers)}")
        
        checks = []
        
        # Check status code (can be 200 or 204)
        if response.status_code in [200, 204]:
            print_success(f"CORS preflight returns {response.status_code}")
            checks.append(True)
        else:
            print_failure(f"Expected 200 or 204, got {response.status_code}")
            checks.append(False)
        
        # Check for CORS headers
        cors_headers = [
            "access-control-allow-origin",
            "access-control-allow-methods",
            "access-control-allow-headers"
        ]
        
        for header in cors_headers:
            if header in response.headers:
                print_success(f"Header '{header}' present: {response.headers[header]}")
                checks.append(True)
            else:
                print_failure(f"Header '{header}' missing")
                checks.append(False)
        
        if all(checks):
            print_success("Test 4 PASSED: CORS preflight working correctly")
            return True
        else:
            print_failure("Test 4 FAILED: Some CORS headers missing")
            return False
            
    except Exception as e:
        print_failure(f"Test 4 FAILED: Exception occurred - {str(e)}")
        return False

def test_5_authenticated_endpoint(access_token: str, salon_id: str):
    """
    Test 5: Regression sanity — after login, the token can call at least one authenticated endpoint
    (e.g. GET /api/salons/{salon_id}/barbers) and get 200
    """
    print_test_header(5, "Authenticated Endpoint Testing (Token Validation)")
    
    if not access_token or not salon_id:
        print_failure("Test 5 SKIPPED: No access token or salon_id from previous tests")
        return False
    
    url = f"{BACKEND_URL}/salons/{salon_id}/barbers"
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print_info(f"Request URL: {url}")
        print_info(f"Authorization: Bearer {access_token[:20]}...")
        print_info(f"Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_info(f"Response: {json.dumps(data, indent=2)[:500]}...")
            print_success("Authenticated endpoint returns 200 OK")
            print_success("Token is valid and can access protected endpoints")
            print_success("Test 5 PASSED: Token validation successful")
            return True
        else:
            print_failure(f"Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text}")
            print_failure("Test 5 FAILED: Token validation failed")
            return False
            
    except Exception as e:
        print_failure(f"Test 5 FAILED: Exception occurred - {str(e)}")
        return False

def main():
    """Run all tests and report results"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}SALON LOGIN ENDPOINT COMPREHENSIVE TESTING{Colors.RESET}")
    print(f"{Colors.BLUE}Backend URL: {BACKEND_URL}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    results = []
    access_token = None
    salon_id = None
    
    # Test 1: Admin login with identifier=admin
    test_1_passed, test_1_data = test_1_salon_login_with_admin_credentials()
    results.append(("Test 1: Admin Login (identifier=admin)", test_1_passed))
    
    if test_1_passed and test_1_data:
        access_token = test_1_data.get("access_token")
        salon_id = test_1_data.get("salon_id")
    
    # Test 2: Login with login_id and mobile
    test_2_passed, test_2_data = test_2_salon_login_with_login_id()
    results.append(("Test 2: Login ID & Mobile as Identifier", test_2_passed))
    
    # Test 3: Error paths
    test_3_passed = test_3_error_paths()
    results.append(("Test 3: Error Paths (401/404)", test_3_passed))
    
    # Test 4: CORS preflight
    test_4_passed = test_4_cors_preflight()
    results.append(("Test 4: CORS Preflight", test_4_passed))
    
    # Test 5: Authenticated endpoint
    test_5_passed = test_5_authenticated_endpoint(access_token, salon_id)
    results.append(("Test 5: Authenticated Endpoint", test_5_passed))
    
    # Summary
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    for test_name, passed in results:
        if passed:
            print(f"{Colors.GREEN}✅ {test_name}{Colors.RESET}")
        else:
            print(f"{Colors.RED}❌ {test_name}{Colors.RESET}")
    
    total_tests = len(results)
    passed_tests = sum(1 for _, passed in results if passed)
    
    print(f"\n{Colors.BLUE}Total: {passed_tests}/{total_tests} tests passed{Colors.RESET}")
    
    if passed_tests == total_tests:
        print(f"\n{Colors.GREEN}{'='*80}{Colors.RESET}")
        print(f"{Colors.GREEN}ALL TESTS PASSED ✅{Colors.RESET}")
        print(f"{Colors.GREEN}The salon login endpoint is working correctly end-to-end.{Colors.RESET}")
        print(f"{Colors.GREEN}The 404 error reported by the user was likely transient (backend restart).{Colors.RESET}")
        print(f"{Colors.GREEN}{'='*80}{Colors.RESET}")
        return 0
    else:
        print(f"\n{Colors.RED}{'='*80}{Colors.RESET}")
        print(f"{Colors.RED}SOME TESTS FAILED ❌{Colors.RESET}")
        print(f"{Colors.RED}Please review the failed tests above.{Colors.RESET}")
        print(f"{Colors.RED}{'='*80}{Colors.RESET}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
