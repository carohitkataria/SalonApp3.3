#!/usr/bin/env python3
"""
Backend Testing Script - Re-test PUT /api/barbers/{barber_id} endpoint
After main agent's fix to use Depends(get_current_salon_user)
"""

import requests
import json
from typing import Dict, Any, Optional

# Base URL from frontend/.env
BASE_URL = "https://customer-experience-4.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_LOGIN_ID = "admin"
ADMIN_PASSWORD = "salon123"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_test(msg: str):
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}TEST: {msg}{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")

def print_pass(msg: str):
    print(f"{Colors.GREEN}✅ PASS: {msg}{Colors.END}")

def print_fail(msg: str):
    print(f"{Colors.RED}❌ FAIL: {msg}{Colors.END}")

def print_info(msg: str):
    print(f"{Colors.YELLOW}ℹ️  INFO: {msg}{Colors.END}")

def login_admin() -> tuple[str, str]:
    """Login as admin and return (token, salon_id)"""
    print_test("Step 1: Admin Login")
    
    url = f"{BASE_URL}/salon/users/login"
    payload = {
        "identifier": ADMIN_LOGIN_ID,
        "password": ADMIN_PASSWORD
    }
    
    print_info(f"POST {url}")
    print_info(f"Payload: {json.dumps(payload, indent=2)}")
    
    response = requests.post(url, json=payload)
    print_info(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        token = data.get('access_token')
        salon_id = data.get('salon_id')
        print_pass(f"Login successful - Salon ID: {salon_id}")
        print_info(f"Token: {token[:30]}...")
        return token, salon_id
    else:
        print_fail(f"Login failed: {response.text}")
        raise Exception("Admin login failed")

def test_barber_profile_update(token: str, salon_id: str):
    """Test PUT /api/barbers/{barber_id} - profile update with salon admin token"""
    print_test("Step 2: Get Barbers List")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get list of barbers
    url = f"{BASE_URL}/salons/{salon_id}/barbers"
    print_info(f"GET {url}")
    response = requests.get(url, headers=headers)
    print_info(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print_fail(f"Failed to get barbers: {response.text}")
        return False
    
    barbers_data = response.json()
    barbers = barbers_data if isinstance(barbers_data, list) else barbers_data.get('barbers', [])
    
    if not barbers:
        print_fail("No barbers found in salon")
        return False
    
    barber = barbers[0]
    barber_id = barber['id']
    original_name = barber.get('name', 'Unknown')
    original_designation = barber.get('designation', '')
    original_experience = barber.get('experience', 0)
    
    print_pass(f"Found {len(barbers)} barbers")
    print_info(f"Selected barber: {original_name} (ID: {barber_id})")
    print_info(f"Original - Name: {original_name}, Designation: '{original_designation}', Experience: {original_experience}")
    
    # Test 1: Update barber profile with admin token
    print_test("Step 3: PUT /api/barbers/{barber_id} with Authorization")
    
    update_url = f"{BASE_URL}/barbers/{barber_id}"
    update_payload = {
        "name": original_name,  # Keep original name
        "designation": "Senior Stylist - QA Test",
        "experience": 7
    }
    
    print_info(f"PUT {update_url}")
    print_info(f"Payload: {json.dumps(update_payload, indent=2)}")
    print_info(f"Headers: Authorization: Bearer {token[:30]}...")
    
    response = requests.put(update_url, json=update_payload, headers=headers)
    print_info(f"Status: {response.status_code}")
    print_info(f"Response: {response.text[:500]}")
    
    if response.status_code != 200:
        print_fail(f"Profile update failed with status {response.status_code}")
        print_fail(f"Response: {response.text}")
        return False
    
    response_data = response.json()
    print_pass("Profile update request successful (200 OK)")
    print_info(f"Response includes updated designation: {response_data.get('designation')}")
    
    # Verify changes persisted
    print_test("Step 4: Verify Changes Persisted")
    
    print_info(f"GET {url}")
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        print_fail(f"Failed to verify changes: {response.text}")
        return False
    
    updated_barbers_data = response.json()
    updated_barbers = updated_barbers_data if isinstance(updated_barbers_data, list) else updated_barbers_data.get('barbers', [])
    updated_barber = next((b for b in updated_barbers if b['id'] == barber_id), None)
    
    if not updated_barber:
        print_fail("Updated barber not found")
        return False
    
    print_info(f"Updated barber - Name: {updated_barber.get('name')}, Designation: '{updated_barber.get('designation')}', Experience: {updated_barber.get('experience')}")
    
    if (updated_barber.get('designation') == "Senior Stylist - QA Test" and
        updated_barber.get('experience') == 7):
        print_pass("Designation and experience updated correctly")
    else:
        print_fail(f"Fields not updated correctly")
        print_fail(f"Expected: designation='Senior Stylist - QA Test', experience=7")
        print_fail(f"Got: designation='{updated_barber.get('designation')}', experience={updated_barber.get('experience')}")
        return False
    
    # Restore original values
    print_test("Step 5: Restore Original Values")
    
    restore_payload = {
        "name": original_name,
        "designation": original_designation,
        "experience": original_experience
    }
    
    print_info(f"PUT {update_url}")
    print_info(f"Payload: {json.dumps(restore_payload, indent=2)}")
    
    response = requests.put(update_url, json=restore_payload, headers=headers)
    print_info(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        print_pass("Original values restored successfully")
    else:
        print_fail(f"Failed to restore original values: {response.text}")
        print_info("Note: This is not critical, but dataset may be modified")
    
    # Test 2: Negative case - without authorization
    print_test("Step 6: Negative Test - Without Authorization Header")
    
    print_info(f"PUT {update_url} (no Authorization header)")
    response = requests.put(update_url, json=update_payload)
    print_info(f"Status: {response.status_code}")
    
    if response.status_code in [401, 403]:
        print_pass(f"Correctly rejected without authorization ({response.status_code})")
    else:
        print_fail(f"Expected 401/403, got {response.status_code}")
        print_fail(f"Response: {response.text}")
        return False
    
    return True

def main():
    """Run barber profile update test"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}RE-TEST: PUT /api/barbers/{{barber_id}} ENDPOINT{Colors.END}")
    print(f"{Colors.BLUE}After main agent's fix to use Depends(get_current_salon_user){Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}\n")
    
    test_passed = False
    
    try:
        # Login and test
        token, salon_id = login_admin()
        test_passed = test_barber_profile_update(token, salon_id)
        
    except Exception as e:
        print_fail(f"Testing failed with error: {e}")
        import traceback
        traceback.print_exc()
    
    # Print final result
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}FINAL RESULT{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}\n")
    
    if test_passed:
        print(f"{Colors.GREEN}✅ PASS - PUT /api/barbers/{{barber_id}} endpoint working correctly{Colors.END}")
        print(f"{Colors.GREEN}  - Salon admin token successfully updates barber profile{Colors.END}")
        print(f"{Colors.GREEN}  - Changes persist correctly{Colors.END}")
        print(f"{Colors.GREEN}  - Unauthorized requests correctly rejected{Colors.END}\n")
    else:
        print(f"{Colors.RED}❌ FAIL - PUT /api/barbers/{{barber_id}} endpoint has issues{Colors.END}\n")

if __name__ == "__main__":
    main()
