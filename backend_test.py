#!/usr/bin/env python3
"""
Focused Regression Tests for Iteration 3 Changes
- Subscription status endpoint verification
- Barber profile update with null/empty string handling
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://premium-features-fix.preview.emergentagent.com/api"
SALON_ID = "c72d0479-1131-42ec-a952-89cd33b80de0"

# Test credentials
ADMIN_PHONE = "+917503070727"
ADMIN_LOGIN_ID = "admin"
ADMIN_PASSWORD = "salon123"

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def add_pass(self, test_name: str):
        self.passed += 1
        print(f"{GREEN}✓ PASS{RESET}: {test_name}")
    
    def add_fail(self, test_name: str, reason: str):
        self.failed += 1
        error_msg = f"{test_name}: {reason}"
        self.errors.append(error_msg)
        print(f"{RED}✗ FAIL{RESET}: {error_msg}")
    
    def print_summary(self):
        print(f"\n{'='*60}")
        print(f"TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total Passed: {GREEN}{self.passed}{RESET}")
        print(f"Total Failed: {RED}{self.failed}{RESET}")
        if self.errors:
            print(f"\n{RED}Failed Tests:{RESET}")
            for error in self.errors:
                print(f"  - {error}")
        print(f"{'='*60}\n")
        return self.failed == 0

def print_section(title: str):
    print(f"\n{BLUE}{'='*60}")
    print(f"{title}")
    print(f"{'='*60}{RESET}\n")

def print_response(response: requests.Response):
    """Print response details for debugging"""
    print(f"  Status: {response.status_code}")
    try:
        print(f"  Response: {json.dumps(response.json(), indent=2)}")
    except:
        print(f"  Response: {response.text[:500]}")

# ============================================================================
# TEST 1: Subscription Status Endpoint
# ============================================================================

def test_subscription_status(result: TestResult):
    """Test GET /api/salons/{salon_id}/subscription/status"""
    print_section("TEST 1: Subscription Status Endpoint")
    
    url = f"{BASE_URL}/salons/{SALON_ID}/subscription/status"
    print(f"Testing: GET {url}")
    
    try:
        response = requests.get(url, timeout=10)
        print_response(response)
        
        if response.status_code != 200:
            result.add_fail(
                "Subscription Status - HTTP Status",
                f"Expected 200, got {response.status_code}"
            )
            return
        
        result.add_pass("Subscription Status - HTTP 200")
        
        data = response.json()
        
        # Check is_premium
        if data.get("is_premium") == True:
            result.add_pass("Subscription Status - is_premium === true")
        else:
            result.add_fail(
                "Subscription Status - is_premium",
                f"Expected true, got {data.get('is_premium')}"
            )
        
        # Check status
        if data.get("status") == "active":
            result.add_pass("Subscription Status - status === 'active'")
        else:
            result.add_fail(
                "Subscription Status - status",
                f"Expected 'active', got {data.get('status')}"
            )
        
        # Check days_remaining > 300
        days_remaining = data.get("days_remaining")
        if days_remaining is not None and days_remaining > 300:
            result.add_pass(f"Subscription Status - days_remaining > 300 (actual: {days_remaining})")
        else:
            result.add_fail(
                "Subscription Status - days_remaining",
                f"Expected > 300, got {days_remaining}"
            )
        
        # Check subscription object
        subscription = data.get("subscription")
        if subscription:
            # Check payment_status
            if subscription.get("payment_status") == "paid":
                result.add_pass("Subscription Status - payment_status === 'paid'")
            else:
                result.add_fail(
                    "Subscription Status - payment_status",
                    f"Expected 'paid', got {subscription.get('payment_status')}"
                )
            
            # Check is_test_seed
            if subscription.get("is_test_seed") == True:
                result.add_pass("Subscription Status - is_test_seed === true")
            else:
                result.add_fail(
                    "Subscription Status - is_test_seed",
                    f"Expected true, got {subscription.get('is_test_seed')}"
                )
        else:
            result.add_fail(
                "Subscription Status - subscription object",
                "subscription object is missing"
            )
    
    except Exception as e:
        result.add_fail("Subscription Status - Exception", str(e))

# ============================================================================
# TEST 2: Barber Profile Update
# ============================================================================

def login_admin() -> Optional[Dict[str, Any]]:
    """Login as admin and return token + salon_id"""
    print_section("Admin Login")
    
    url = f"{BASE_URL}/salon/users/login"
    
    # Try with login_id first
    payload = {
        "identifier": ADMIN_LOGIN_ID,
        "password": ADMIN_PASSWORD
    }
    
    print(f"Attempting login: POST {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        print_response(response)
        
        if response.status_code == 200:
            data = response.json()
            print(f"{GREEN}✓ Login successful{RESET}")
            return {
                "access_token": data.get("access_token"),
                "salon_id": data.get("salon_id")
            }
        else:
            # Try with phone number
            print(f"\n{YELLOW}Retrying with phone number...{RESET}")
            payload = {
                "identifier": ADMIN_PHONE,
                "password": ADMIN_PASSWORD
            }
            print(f"Payload: {json.dumps(payload, indent=2)}")
            
            response = requests.post(url, json=payload, timeout=10)
            print_response(response)
            
            if response.status_code == 200:
                data = response.json()
                print(f"{GREEN}✓ Login successful{RESET}")
                return {
                    "access_token": data.get("access_token"),
                    "salon_id": data.get("salon_id")
                }
            else:
                print(f"{RED}✗ Login failed{RESET}")
                return None
    
    except Exception as e:
        print(f"{RED}✗ Login exception: {e}{RESET}")
        return None

def get_or_create_barber(auth_token: str, salon_id: str) -> Optional[str]:
    """Get existing barber or create one if none exist"""
    print_section("Get/Create Barber")
    
    # Try to get existing barbers
    url = f"{BASE_URL}/salons/{salon_id}/barbers"
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    print(f"Getting barbers: GET {url}")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print_response(response)
        
        if response.status_code == 200:
            barbers = response.json()
            if barbers and len(barbers) > 0:
                barber_id = barbers[0].get("id")
                print(f"{GREEN}✓ Found existing barber: {barber_id}{RESET}")
                return barber_id
        
        # No barbers found, create one
        print(f"\n{YELLOW}No barbers found, creating test barber...{RESET}")
        create_url = f"{BASE_URL}/salons/{salon_id}/barbers"
        payload = {
            "name": "Test Barber",
            "mobile": "+919876543210",
            "category": "Senior",
            "experience": 3
        }
        
        print(f"Creating barber: POST {create_url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        
        response = requests.post(create_url, json=payload, headers=headers, timeout=10)
        print_response(response)
        
        if response.status_code in [200, 201]:
            barber_id = response.json().get("id")
            print(f"{GREEN}✓ Created barber: {barber_id}{RESET}")
            return barber_id
        else:
            print(f"{RED}✗ Failed to create barber{RESET}")
            return None
    
    except Exception as e:
        print(f"{RED}✗ Exception: {e}{RESET}")
        return None

def test_barber_update(result: TestResult):
    """Test PUT /api/barbers/{barber_id} with various payloads"""
    print_section("TEST 2: Barber Profile Update")
    
    # Login
    auth_data = login_admin()
    if not auth_data:
        result.add_fail("Barber Update - Login", "Failed to login as admin")
        return
    
    access_token = auth_data["access_token"]
    salon_id = auth_data["salon_id"]
    
    # Get or create barber
    barber_id = get_or_create_barber(access_token, salon_id)
    if not barber_id:
        result.add_fail("Barber Update - Get/Create Barber", "Failed to get or create barber")
        return
    
    headers = {"Authorization": f"Bearer {access_token}"}
    url = f"{BASE_URL}/barbers/{barber_id}"
    
    # Test Case A: Update with null values (frontend fix - should work now)
    print(f"\n{BLUE}Test Case A: Update with null values{RESET}")
    payload_a = {
        "name": "Test Name Updated",
        "compensation": None,
        "experience": 0,
        "doj": None,
        "dob": None,
        "last_working_date": None
    }
    
    print(f"Testing: PUT {url}")
    print(f"Payload: {json.dumps(payload_a, indent=2)}")
    
    try:
        response = requests.put(url, json=payload_a, headers=headers, timeout=10)
        print_response(response)
        
        if response.status_code == 200:
            result.add_pass("Barber Update - Test Case A (null values) - HTTP 200")
            data = response.json()
            if data.get("name") == "Test Name Updated":
                result.add_pass("Barber Update - Test Case A - name updated correctly")
        else:
            result.add_fail(
                "Barber Update - Test Case A (null values)",
                f"Expected 200, got {response.status_code}"
            )
    except Exception as e:
        result.add_fail("Barber Update - Test Case A", f"Exception: {e}")
    
    # Test Case B: Update with valid values
    print(f"\n{BLUE}Test Case B: Update with valid values{RESET}")
    payload_b = {
        "compensation": 25000,
        "experience": 5,
        "doj": "2024-01-15",
        "dob": "1995-06-20"
    }
    
    print(f"Testing: PUT {url}")
    print(f"Payload: {json.dumps(payload_b, indent=2)}")
    
    try:
        response = requests.put(url, json=payload_b, headers=headers, timeout=10)
        print_response(response)
        
        if response.status_code == 200:
            result.add_pass("Barber Update - Test Case B (valid values) - HTTP 200")
            data = response.json()
            
            if data.get("compensation") == 25000:
                result.add_pass("Barber Update - Test Case B - compensation === 25000")
            else:
                result.add_fail(
                    "Barber Update - Test Case B - compensation",
                    f"Expected 25000, got {data.get('compensation')}"
                )
            
            if data.get("experience") == 5:
                result.add_pass("Barber Update - Test Case B - experience === 5")
            else:
                result.add_fail(
                    "Barber Update - Test Case B - experience",
                    f"Expected 5, got {data.get('experience')}"
                )
        else:
            result.add_fail(
                "Barber Update - Test Case B (valid values)",
                f"Expected 200, got {response.status_code}"
            )
    except Exception as e:
        result.add_fail("Barber Update - Test Case B", f"Exception: {e}")
    
    # Test Case C: Negative test - empty string (should fail with 422)
    print(f"\n{BLUE}Test Case C: Negative test - empty string compensation{RESET}")
    payload_c = {
        "compensation": ""
    }
    
    print(f"Testing: PUT {url}")
    print(f"Payload: {json.dumps(payload_c, indent=2)}")
    
    try:
        response = requests.put(url, json=payload_c, headers=headers, timeout=10)
        print_response(response)
        
        if response.status_code == 422:
            result.add_pass("Barber Update - Test Case C (empty string) - HTTP 422 (correctly rejected)")
        else:
            result.add_fail(
                "Barber Update - Test Case C (empty string)",
                f"Expected 422 (validation error), got {response.status_code}"
            )
    except Exception as e:
        result.add_fail("Barber Update - Test Case C", f"Exception: {e}")
    
    # Verify GET reflects the updates from Test Case B
    print(f"\n{BLUE}Verify GET reflects updates{RESET}")
    get_url = f"{BASE_URL}/salons/{salon_id}/barbers"
    
    print(f"Testing: GET {get_url}")
    
    try:
        response = requests.get(get_url, headers=headers, timeout=10)
        print_response(response)
        
        if response.status_code == 200:
            barbers = response.json()
            updated_barber = next((b for b in barbers if b.get("id") == barber_id), None)
            
            if updated_barber:
                if updated_barber.get("compensation") == 25000:
                    result.add_pass("Barber Update - GET verification - compensation === 25000")
                else:
                    result.add_fail(
                        "Barber Update - GET verification - compensation",
                        f"Expected 25000, got {updated_barber.get('compensation')}"
                    )
                
                if updated_barber.get("experience") == 5:
                    result.add_pass("Barber Update - GET verification - experience === 5")
                else:
                    result.add_fail(
                        "Barber Update - GET verification - experience",
                        f"Expected 5, got {updated_barber.get('experience')}"
                    )
            else:
                result.add_fail(
                    "Barber Update - GET verification",
                    f"Barber {barber_id} not found in response"
                )
        else:
            result.add_fail(
                "Barber Update - GET verification",
                f"Expected 200, got {response.status_code}"
            )
    except Exception as e:
        result.add_fail("Barber Update - GET verification", f"Exception: {e}")

# ============================================================================
# TEST 3: No Regression - Public Barbers List
# ============================================================================

def test_public_barbers_list(result: TestResult):
    """Test GET /api/salons/{salon_id}/barbers (no auth)"""
    print_section("TEST 3: No Regression - Public Barbers List")
    
    url = f"{BASE_URL}/salons/{SALON_ID}/barbers"
    print(f"Testing: GET {url} (no auth)")
    
    try:
        response = requests.get(url, timeout=10)
        print_response(response)
        
        if response.status_code == 200:
            result.add_pass("Public Barbers List - HTTP 200")
        else:
            result.add_fail(
                "Public Barbers List",
                f"Expected 200, got {response.status_code}"
            )
    
    except Exception as e:
        result.add_fail("Public Barbers List - Exception", str(e))

# ============================================================================
# MAIN
# ============================================================================

def main():
    print(f"\n{BLUE}{'='*60}")
    print(f"FOCUSED REGRESSION TESTS - ITERATION 3")
    print(f"{'='*60}{RESET}\n")
    print(f"Base URL: {BASE_URL}")
    print(f"Salon ID: {SALON_ID}")
    print(f"Admin: {ADMIN_LOGIN_ID} / {ADMIN_PHONE}")
    
    result = TestResult()
    
    # Run tests
    test_subscription_status(result)
    test_barber_update(result)
    test_public_barbers_list(result)
    
    # Print summary
    success = result.print_summary()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
