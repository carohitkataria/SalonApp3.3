#!/usr/bin/env python3
"""
Backend API Testing Script for Bug-Fix Verification
Tests the priority items from the review request
"""

import requests
import json
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://salon-booking-fix-7.preview.emergentagent.com/api"
ADMIN_IDENTIFIER = "admin"
ADMIN_PASSWORD = "salon123"

# Will be populated after login
ACCESS_TOKEN = None
SALON_ID = None

def print_test_header(test_name):
    """Print a formatted test header"""
    print("\n" + "="*80)
    print(f"TEST: {test_name}")
    print("="*80)

def print_result(success, message, details=None):
    """Print test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if details:
        print(f"Details: {json.dumps(details, indent=2)}")

def get_ist_date(days_offset=0):
    """Get date in IST timezone (approximation using UTC+5:30)"""
    # IST is UTC+5:30
    utc_now = datetime.utcnow()
    ist_now = utc_now + timedelta(hours=5, minutes=30)
    date = ist_now + timedelta(days=days_offset)
    return date.strftime('%Y-%m-%d')

def test_admin_login():
    """Test 1: Admin login to get access token"""
    global ACCESS_TOKEN, SALON_ID
    
    print_test_header("Admin Login")
    
    # Try the multi-user login endpoint first
    url = f"{BASE_URL}/salon/users/login"
    payload = {
        "identifier": ADMIN_IDENTIFIER,
        "password": ADMIN_PASSWORD
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Request: POST {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            ACCESS_TOKEN = data.get('access_token')
            SALON_ID = data.get('salon_id')
            print_result(True, "Admin login successful", {
                "salon_id": SALON_ID,
                "role": data.get('role'),
                "has_token": bool(ACCESS_TOKEN)
            })
            return True
        else:
            print(f"Response: {response.text}")
            
            # Try legacy endpoint
            print("\nTrying legacy endpoint...")
            url = f"{BASE_URL}/salon/login"
            payload = {
                "login_id": ADMIN_IDENTIFIER,
                "password": ADMIN_PASSWORD
            }
            response = requests.post(url, json=payload)
            print(f"Request: POST {url}")
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                ACCESS_TOKEN = data.get('access_token')
                SALON_ID = data.get('salon_id')
                print_result(True, "Admin login successful (legacy endpoint)", {
                    "salon_id": SALON_ID,
                    "has_token": bool(ACCESS_TOKEN)
                })
                return True
            else:
                print(f"Response: {response.text}")
                print_result(False, "Admin login failed on both endpoints")
                return False
                
    except Exception as e:
        print_result(False, f"Admin login exception: {str(e)}")
        return False

def test_operational_hours():
    """Test 2: PUT /api/salons/{salon_id}/operational-hours"""
    print_test_header("Update Operational Hours (Multi-User Auth Fix)")
    
    if not ACCESS_TOKEN or not SALON_ID:
        print_result(False, "Skipped - no access token")
        return False
    
    url = f"{BASE_URL}/salons/{SALON_ID}/operational-hours"
    headers = {"Authorization": f"Bearer {ACCESS_TOKEN}"}
    
    # Build operational hours payload
    payload = {
        "monday": {
            "is_open": True,
            "open_time": "09:00",
            "close_time": "21:00",
            "shifts": [
                {"name": "Morning", "start_time": "09:00", "end_time": "13:00"}
            ],
            "lunch_break": None
        },
        "tuesday": {
            "is_open": True,
            "open_time": "09:00",
            "close_time": "21:00",
            "shifts": [
                {"name": "Morning", "start_time": "09:00", "end_time": "13:00"}
            ],
            "lunch_break": None
        },
        "wednesday": {
            "is_open": True,
            "open_time": "09:00",
            "close_time": "21:00",
            "shifts": [
                {"name": "Morning", "start_time": "09:00", "end_time": "13:00"}
            ],
            "lunch_break": None
        },
        "thursday": {
            "is_open": True,
            "open_time": "09:00",
            "close_time": "21:00",
            "shifts": [
                {"name": "Morning", "start_time": "09:00", "end_time": "13:00"}
            ],
            "lunch_break": None
        },
        "friday": {
            "is_open": True,
            "open_time": "09:00",
            "close_time": "21:00",
            "shifts": [
                {"name": "Morning", "start_time": "09:00", "end_time": "13:00"}
            ],
            "lunch_break": None
        },
        "saturday": {
            "is_open": True,
            "open_time": "09:00",
            "close_time": "21:00",
            "shifts": [
                {"name": "Morning", "start_time": "09:00", "end_time": "13:00"}
            ],
            "lunch_break": None
        },
        "sunday": {
            "is_open": True,
            "open_time": "09:00",
            "close_time": "21:00",
            "shifts": [
                {"name": "Morning", "start_time": "09:00", "end_time": "13:00"}
            ],
            "lunch_break": None
        }
    }
    
    try:
        response = requests.put(url, json=payload, headers=headers)
        print(f"Request: PUT {url}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, "Operational hours updated successfully", {
                "has_operational_hours": "operational_hours" in data
            })
            
            # Verify by fetching salon details
            verify_url = f"{BASE_URL}/salons/{SALON_ID}"
            verify_response = requests.get(verify_url)
            if verify_response.status_code == 200:
                salon_data = verify_response.json()
                has_hours = "operational_hours" in salon_data
                print_result(has_hours, "Verification: Operational hours persisted in salon data")
            
            return True
        else:
            print(f"Response: {response.text}")
            print_result(False, f"Failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_salon_booking():
    """Test 3: POST /api/salons/{salon_id}/salon-booking"""
    print_test_header("Create Salon Booking (Fixed Missing Arg)")
    
    if not ACCESS_TOKEN or not SALON_ID:
        print_result(False, "Skipped - no access token")
        return False
    
    headers = {"Authorization": f"Bearer {ACCESS_TOKEN}"}
    
    # First, get enabled services
    services_url = f"{BASE_URL}/salons/{SALON_ID}/services/enabled"
    try:
        services_response = requests.get(services_url)
        if services_response.status_code != 200:
            print_result(False, "Could not fetch enabled services")
            return False
        
        services = services_response.json()
        
        # If no enabled services, try to enable one
        if not services:
            print("No enabled services found. Attempting to enable a service...")
            
            # Get all services
            all_services_url = f"{BASE_URL}/services/categories"
            all_services_response = requests.get(all_services_url)
            
            if all_services_response.status_code == 200:
                categories = all_services_response.json()
                if categories and 'categories' in categories:
                    # Try to get services for the first category
                    first_category = categories['categories'][0]['name']
                    category_services_url = f"{BASE_URL}/services?category={first_category}"
                    category_services_response = requests.get(category_services_url)
                    
                    if category_services_response.status_code == 200:
                        all_services = category_services_response.json()
                        if all_services:
                            # Try to enable the first service
                            first_service_id = all_services[0]['id']
                            toggle_url = f"{BASE_URL}/salons/{SALON_ID}/services/{first_service_id}/toggle"
                            toggle_response = requests.post(toggle_url, headers=headers)
                            
                            if toggle_response.status_code == 200:
                                print(f"Enabled service: {all_services[0]['name']}")
                                # Retry getting enabled services
                                services_response = requests.get(services_url)
                                if services_response.status_code == 200:
                                    services = services_response.json()
        
        if not services:
            print_result(False, "No enabled services found and could not enable any")
            print("Note: This is a data issue, not a code bug. The salon-booking endpoint cannot be tested without enabled services.")
            return False
        
        service_id = services[0]['id']
        service_name = services[0].get('service_name', services[0].get('name', 'Unknown'))
        print(f"Using service: {service_name} (ID: {service_id})")
        
    except Exception as e:
        print_result(False, f"Error fetching services: {str(e)}")
        return False
    
    # Get shift windows for today
    today = get_ist_date()
    shift_url = f"{BASE_URL}/salons/{SALON_ID}/shift-windows?date={today}"
    try:
        shift_response = requests.get(shift_url)
        if shift_response.status_code != 200:
            print_result(False, "Could not fetch shift windows")
            return False
        
        shift_data = shift_response.json()
        # Handle both array and object responses
        if isinstance(shift_data, dict) and 'shifts' in shift_data:
            shifts = shift_data['shifts']
        else:
            shifts = shift_data
            
        if not shifts:
            print_result(False, "No shifts available")
            return False
        
        # Find first available shift
        shift_name = None
        for shift in shifts:
            if shift.get('is_available'):
                shift_name = shift['name']
                break
        
        if not shift_name:
            shift_name = shifts[0]['name']  # Use first shift even if not marked available
        
        print(f"Using shift: {shift_name}")
        
    except Exception as e:
        print_result(False, f"Error fetching shifts: {str(e)}")
        return False
    
    # Create booking
    url = f"{BASE_URL}/salons/{SALON_ID}/salon-booking"
    headers = {"Authorization": f"Bearer {ACCESS_TOKEN}"}
    
    payload = {
        "customer_name": "Test Manual Booking",
        "phone": "9999988888",
        "gender": "Men",
        "barber_id": "any",
        "selected_services": [service_id],
        "payment_mode": "cash",
        "date": today,
        "shift": shift_name
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"Request: POST {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token_id = data.get('id')
            token_number = data.get('token_number')
            status = data.get('status')
            
            print_result(True, "Booking created successfully", {
                "token_id": token_id,
                "token_number": token_number,
                "status": status
            })
            
            # Verify token appears in tokens list
            tokens_url = f"{BASE_URL}/salons/{SALON_ID}/tokens?date={today}"
            tokens_response = requests.get(tokens_url, headers=headers)
            if tokens_response.status_code == 200:
                tokens = tokens_response.json()
                token_found = any(t.get('id') == token_id for t in tokens)
                print_result(token_found, f"Verification: Token {token_number} found in tokens list")
            
            return token_id  # Return token_id for use in call/recall tests
        else:
            print(f"Response: {response.text}")
            print_result(False, f"Failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print_result(False, f"Exception: {str(e)}")
        return False

def test_token_call_recall(token_id):
    """Test 4: POST /api/tokens/{token_id}/call and /recall"""
    print_test_header("Token Call/Recall (WebSocket Payload Enhancement)")
    
    if not ACCESS_TOKEN or not token_id:
        print_result(False, "Skipped - no token_id")
        return False
    
    headers = {"Authorization": f"Bearer {ACCESS_TOKEN}"}
    
    # Test call endpoint
    call_url = f"{BASE_URL}/tokens/{token_id}/call"
    try:
        response = requests.post(call_url, headers=headers)
        print(f"Request: POST {call_url}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print_result(True, "Token call successful")
        else:
            print(f"Response: {response.text}")
            print_result(False, f"Token call failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print_result(False, f"Token call exception: {str(e)}")
        return False
    
    # Test recall endpoint
    recall_url = f"{BASE_URL}/tokens/{token_id}/recall"
    try:
        response = requests.post(recall_url, headers=headers)
        print(f"Request: POST {recall_url}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print_result(True, "Token recall successful")
            print("\nNote: WebSocket broadcast payloads now include phone, token_number, salon_id, barber_name")
            print("(Cannot verify WebSocket payload without actual WebSocket connection)")
            return True
        else:
            print(f"Response: {response.text}")
            print_result(False, f"Token recall failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print_result(False, f"Token recall exception: {str(e)}")
        return False

def test_smoke_checks():
    """Test 5: Smoke checks for regression"""
    print_test_header("Smoke Checks (Regression Prevention)")
    
    if not SALON_ID:
        print_result(False, "Skipped - no salon_id")
        return False
    
    all_passed = True
    
    # Test 1: GET barbers
    url = f"{BASE_URL}/salons/{SALON_ID}/barbers"
    try:
        response = requests.get(url)
        print(f"\n1. GET {url}")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            barbers = response.json()
            print_result(True, f"Barbers endpoint working - returned {len(barbers)} barbers")
        else:
            print_result(False, f"Barbers endpoint failed with status {response.status_code}")
            all_passed = False
    except Exception as e:
        print_result(False, f"Barbers endpoint exception: {str(e)}")
        all_passed = False
    
    # Test 2: GET services/enabled
    url = f"{BASE_URL}/salons/{SALON_ID}/services/enabled"
    try:
        response = requests.get(url)
        print(f"\n2. GET {url}")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            services = response.json()
            print_result(True, f"Services/enabled endpoint working - returned {len(services)} services")
        else:
            print_result(False, f"Services/enabled endpoint failed with status {response.status_code}")
            all_passed = False
    except Exception as e:
        print_result(False, f"Services/enabled endpoint exception: {str(e)}")
        all_passed = False
    
    # Test 3: GET shift-windows
    today = get_ist_date()
    url = f"{BASE_URL}/salons/{SALON_ID}/shift-windows?date={today}"
    try:
        response = requests.get(url)
        print(f"\n3. GET {url}")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            shift_data = response.json()
            # Handle both array and object responses
            if isinstance(shift_data, dict) and 'shifts' in shift_data:
                shifts = shift_data['shifts']
            else:
                shifts = shift_data
            print_result(True, f"Shift-windows endpoint working - returned {len(shifts)} shifts")
            for shift in shifts:
                print(f"   - {shift['name']}: {shift.get('time', 'N/A')}")
        else:
            print_result(False, f"Shift-windows endpoint failed with status {response.status_code}")
            all_passed = False
    except Exception as e:
        print_result(False, f"Shift-windows endpoint exception: {str(e)}")
        all_passed = False
    
    return all_passed

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("BACKEND API TESTING - BUG FIX VERIFICATION")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin Credentials: {ADMIN_IDENTIFIER} / {ADMIN_PASSWORD}")
    print("="*80)
    
    results = {
        "admin_login": False,
        "operational_hours": False,
        "salon_booking": False,
        "token_call_recall": False,
        "smoke_checks": False
    }
    
    # Test 1: Admin Login
    results["admin_login"] = test_admin_login()
    
    if not results["admin_login"]:
        print("\n❌ CRITICAL: Admin login failed. Cannot proceed with authenticated tests.")
        return
    
    # Test 2: Operational Hours
    results["operational_hours"] = test_operational_hours()
    
    # Test 3: Salon Booking
    token_id = test_salon_booking()
    results["salon_booking"] = bool(token_id)
    
    # Test 4: Token Call/Recall
    if token_id:
        results["token_call_recall"] = test_token_call_recall(token_id)
    
    # Test 5: Smoke Checks
    results["smoke_checks"] = test_smoke_checks()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name.replace('_', ' ').title()}")
    
    total = len(results)
    passed = sum(1 for v in results.values() if v)
    
    print("="*80)
    print(f"TOTAL: {passed}/{total} tests passed")
    print("="*80)

if __name__ == "__main__":
    main()
