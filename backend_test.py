#!/usr/bin/env python3
"""
Backend API Testing Script for Salon Booking System
Focused regression testing on latest backend changes (Round 3)
Testing multi-user auth fixes and on-leave barber handling
"""

import requests
import json
from datetime import datetime, timedelta
import time

# Backend URL from environment
BACKEND_URL = "https://staff-management-pro-2.preview.emergentagent.com/api"

# Test credentials
ADMIN_IDENTIFIER = "admin"
ADMIN_PASSWORD = "salon123"

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_test(test_name):
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}TEST: {test_name}{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")

def print_pass(message):
    print(f"{GREEN}✅ PASS: {message}{RESET}")

def print_fail(message):
    print(f"{RED}❌ FAIL: {message}{RESET}")

def print_info(message):
    print(f"{YELLOW}ℹ️  INFO: {message}{RESET}")

def print_response(response):
    print(f"Status: {response.status_code}")
    try:
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except:
        print(f"Response: {response.text[:500]}")

def get_today_ist():
    """Get today's date in IST (YYYY-MM-DD)"""
    # For testing purposes, we'll use the current date
    return datetime.now().strftime("%Y-%m-%d")

def get_tomorrow_ist():
    """Get tomorrow's date in IST (YYYY-MM-DD)"""
    return (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

# ============================================================================
# SETUP: Login and get admin token + salon_id
# ============================================================================
def setup_admin_auth():
    """Login as admin and return (salon_id, admin_token, headers)"""
    print_info("Setting up admin authentication...")
    
    response = requests.post(
        f"{BACKEND_URL}/salon/users/login",
        json={"identifier": ADMIN_IDENTIFIER, "password": ADMIN_PASSWORD}
    )
    
    if response.status_code != 200:
        print_fail(f"Admin login failed: {response.status_code}")
        print_response(response)
        return None, None, None
    
    data = response.json()
    salon_id = data.get("salon_id")
    admin_token = data.get("access_token")
    role = data.get("role")
    
    print_pass(f"Admin login successful. Salon ID: {salon_id}, Role: {role}")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    return salon_id, admin_token, headers

# ============================================================================
# TEST 1: POST /api/tokens/{token_id}/notify - Multi-user auth + new message
# ============================================================================
def test_notify_endpoint(salon_id, admin_token, headers):
    print_test("TEST 1: POST /api/tokens/{token_id}/notify - Multi-user auth + new message")
    
    # Step a: Get or create a token
    print_info("Step a: Getting existing token or creating one")
    
    today = get_today_ist()
    
    # Try to get existing tokens
    tokens_response = requests.get(
        f"{BACKEND_URL}/salons/{salon_id}/tokens",
        headers=headers,
        params={"date": today}
    )
    
    token_id = None
    if tokens_response.status_code == 200:
        tokens_data = tokens_response.json()
        tokens = tokens_data.get("tokens", [])
        if tokens:
            # Use first waiting token
            for token in tokens:
                if token.get("status") == "waiting":
                    token_id = token.get("id")
                    print_info(f"Using existing token: {token_id}")
                    break
    
    # If no existing token, create one
    if not token_id:
        print_info("No existing waiting token found. Creating new booking...")
        
        # Get enabled services
        services_response = requests.get(
            f"{BACKEND_URL}/salons/{salon_id}/services/enabled",
            headers=headers
        )
        
        if services_response.status_code != 200:
            print_fail(f"Failed to get services: {services_response.status_code}")
            return
        
        services_data = services_response.json()
        services = services_data if isinstance(services_data, list) else services_data.get("services", [])
        
        if not services:
            print_fail("No enabled services found")
            return
        
        service_id = services[0]["id"]
        
        # Create booking
        booking_data = {
            "customer_name": "Notify Test Customer",
            "phone": "9000011111",
            "gender": "Men",
            "barber_id": "any",
            "selected_services": [service_id],
            "payment_mode": "cash",
            "date": today,
            "shift": "Morning"
        }
        
        booking_response = requests.post(
            f"{BACKEND_URL}/salons/{salon_id}/salon-booking",
            headers=headers,
            json=booking_data
        )
        
        if booking_response.status_code == 200:
            token_data = booking_response.json()
            token_id = token_data.get("id")
            print_pass(f"Created new token: {token_id}")
        else:
            print_fail(f"Failed to create booking: {booking_response.status_code}")
            print_response(booking_response)
            return
    
    # Step b: Call POST /api/tokens/{token_id}/notify with admin Bearer token
    print_info(f"\nStep b: Calling POST /api/tokens/{token_id}/notify with admin token")
    
    notify_response = requests.post(
        f"{BACKEND_URL}/tokens/{token_id}/notify",
        headers=headers
    )
    
    print_response(notify_response)
    
    if notify_response.status_code == 200:
        data = notify_response.json()
        message = data.get("message", "")
        
        if message == "Notification sent to customer":
            print_pass(f"Correct response message: '{message}'")
        else:
            print_fail(f"Wrong message. Expected 'Notification sent to customer', got '{message}'")
    else:
        print_fail(f"Expected 200, got {notify_response.status_code}")
    
    # Step c: Call without auth → 401
    print_info("\nStep c: Calling without auth (should get 401)")
    
    notify_no_auth = requests.post(f"{BACKEND_URL}/tokens/{token_id}/notify")
    print_response(notify_no_auth)
    
    if notify_no_auth.status_code in [401, 403]:
        print_pass(f"Correctly rejected without auth: {notify_no_auth.status_code}")
    else:
        print_fail(f"Expected 401/403, got {notify_no_auth.status_code}")
    
    # Step d: Call with token from different salon → 403 or 404
    print_info("\nStep d: Calling with random/mismatched token_id (should get 404 or 403)")
    
    random_token_id = "00000000-0000-0000-0000-000000000000"
    notify_wrong_token = requests.post(
        f"{BACKEND_URL}/tokens/{random_token_id}/notify",
        headers=headers
    )
    print_response(notify_wrong_token)
    
    if notify_wrong_token.status_code == 404:
        detail = notify_wrong_token.json().get("detail", "")
        if "Token not found" in detail:
            print_pass(f"Correctly returns 404 for unknown token: {detail}")
        else:
            print_fail(f"404 but wrong message: {detail}")
    elif notify_wrong_token.status_code == 403:
        print_pass("Correctly returns 403 for mismatched salon")
    else:
        print_fail(f"Expected 404 or 403, got {notify_wrong_token.status_code}")
    
    # Step e: Check backend logs for no exceptions
    print_info("\nStep e: Checking backend logs for exceptions...")
    print_info("(Manual check required: tail /var/log/supervisor/backend.err.log)")
    print_info("Verify no RecursionError or exception in send_booking_notification for type 'salon_calling'")

# ============================================================================
# TEST 2: POST /api/tokens/{token_id}/cancel - Multi-user auth
# ============================================================================
def test_cancel_endpoint(salon_id, admin_token, headers):
    print_test("TEST 2: POST /api/tokens/{token_id}/cancel - Multi-user auth")
    
    # Create a fresh token
    print_info("Creating fresh token for cancellation test...")
    
    today = get_today_ist()
    
    # Get enabled services
    services_response = requests.get(
        f"{BACKEND_URL}/salons/{salon_id}/services/enabled",
        headers=headers
    )
    
    if services_response.status_code != 200:
        print_fail(f"Failed to get services: {services_response.status_code}")
        return
    
    services_data = services_response.json()
    services = services_data if isinstance(services_data, list) else services_data.get("services", [])
    
    if not services:
        print_fail("No enabled services found")
        return
    
    service_id = services[0]["id"]
    
    # Create booking
    booking_data = {
        "customer_name": "Cancel Test Customer",
        "phone": "9000022222",
        "gender": "Men",
        "barber_id": "any",
        "selected_services": [service_id],
        "payment_mode": "cash",
        "date": today,
        "shift": "Noon"
    }
    
    booking_response = requests.post(
        f"{BACKEND_URL}/salons/{salon_id}/salon-booking",
        headers=headers,
        json=booking_data
    )
    
    if booking_response.status_code != 200:
        print_fail(f"Failed to create booking: {booking_response.status_code}")
        print_response(booking_response)
        return
    
    token_data = booking_response.json()
    token_id = token_data.get("id")
    print_pass(f"Created token for cancellation: {token_id}")
    
    # Test: Cancel with admin token → 200
    print_info(f"\nCalling POST /api/tokens/{token_id}/cancel with admin token")
    
    cancel_response = requests.post(
        f"{BACKEND_URL}/tokens/{token_id}/cancel",
        headers=headers
    )
    
    print_response(cancel_response)
    
    if cancel_response.status_code == 200:
        print_pass("Successfully cancelled token with admin auth")
    else:
        print_fail(f"Expected 200, got {cancel_response.status_code}")
    
    # Negative: random uuid → 404
    print_info("\nCalling with random token_id (should get 404)")
    
    random_token_id = "00000000-0000-0000-0000-000000000001"
    cancel_random = requests.post(
        f"{BACKEND_URL}/tokens/{random_token_id}/cancel",
        headers=headers
    )
    print_response(cancel_random)
    
    if cancel_random.status_code == 404:
        print_pass("Correctly returns 404 for unknown token")
    else:
        print_fail(f"Expected 404, got {cancel_random.status_code}")
    
    # No auth → 401
    print_info("\nCalling without auth (should get 401)")
    
    cancel_no_auth = requests.post(f"{BACKEND_URL}/tokens/{token_id}/cancel")
    print_response(cancel_no_auth)
    
    if cancel_no_auth.status_code in [401, 403]:
        print_pass(f"Correctly rejected without auth: {cancel_no_auth.status_code}")
    else:
        print_fail(f"Expected 401/403, got {cancel_no_auth.status_code}")

# ============================================================================
# TEST 3: DELETE /api/salons/{salon_id}/staff-attendance/override/{barber_id}/{date}
# ============================================================================
def test_attendance_delete(salon_id, admin_token, headers):
    print_test("TEST 3: DELETE staff-attendance/override - Clear attendance status")
    
    # Get a barber
    print_info("Getting barber list...")
    
    barbers_response = requests.get(
        f"{BACKEND_URL}/salons/{salon_id}/barbers",
        headers=headers
    )
    
    if barbers_response.status_code != 200:
        print_fail(f"Failed to get barbers: {barbers_response.status_code}")
        return
    
    barbers_data = barbers_response.json()
    barbers = barbers_data if isinstance(barbers_data, list) else barbers_data.get("barbers", [])
    
    if not barbers:
        print_fail("No barbers found")
        return
    
    barber_id = barbers[0]["id"]
    barber_name = barbers[0]["name"]
    print_info(f"Using barber: {barber_name} (ID: {barber_id})")
    
    # Use today's date
    test_date = get_today_ist()
    
    # Step a: PUT a status
    print_info(f"\nStep a: Setting attendance status to 'present' for {test_date}")
    
    put_response = requests.put(
        f"{BACKEND_URL}/salons/{salon_id}/staff-attendance/override/{barber_id}/{test_date}",
        headers=headers,
        json={"status": "present"}
    )
    
    print_response(put_response)
    
    if put_response.status_code == 200:
        print_pass("Successfully set attendance status")
    else:
        print_fail(f"Failed to set status: {put_response.status_code}")
        return
    
    # Step b: DELETE the same path
    print_info(f"\nStep b: Deleting attendance override for {test_date}")
    
    delete_response = requests.delete(
        f"{BACKEND_URL}/salons/{salon_id}/staff-attendance/override/{barber_id}/{test_date}",
        headers=headers
    )
    
    print_response(delete_response)
    
    if delete_response.status_code == 200:
        data = delete_response.json()
        deleted = data.get("deleted")
        record_id = data.get("id")
        
        if deleted is True:
            print_pass(f"Successfully deleted override. ID: {record_id}")
        else:
            print_fail(f"Delete returned 200 but deleted={deleted}")
    else:
        print_fail(f"Expected 200, got {delete_response.status_code}")
    
    # Step c: DELETE again → idempotent (should return deleted: false)
    print_info("\nStep c: Deleting again (should be idempotent)")
    
    delete_again = requests.delete(
        f"{BACKEND_URL}/salons/{salon_id}/staff-attendance/override/{barber_id}/{test_date}",
        headers=headers
    )
    
    print_response(delete_again)
    
    if delete_again.status_code == 200:
        data = delete_again.json()
        deleted = data.get("deleted")
        
        if deleted is False:
            print_pass("Correctly returns deleted: false (idempotent)")
        else:
            print_fail(f"Expected deleted: false, got deleted: {deleted}")
    else:
        print_fail(f"Expected 200, got {delete_again.status_code}")
    
    # Step d: GET monthly attendance to verify cleared
    print_info("\nStep d: Verifying cleared date no longer appears in monthly attendance")
    
    month = test_date[:7]  # YYYY-MM
    attendance_response = requests.get(
        f"{BACKEND_URL}/salons/{salon_id}/staff-attendance/month/{month}",
        headers=headers,
        params={"barber_id": barber_id}
    )
    
    print_response(attendance_response)
    
    if attendance_response.status_code == 200:
        data = attendance_response.json()
        barbers_attendance = data.get("barbers", [])
        
        # Find our barber
        found_barber = None
        for b in barbers_attendance:
            if b.get("barber_id") == barber_id:
                found_barber = b
                break
        
        if found_barber:
            attendance_records = found_barber.get("attendance", [])
            
            # Check if test_date is in attendance records
            date_found = False
            for record in attendance_records:
                if record.get("date") == test_date:
                    date_found = True
                    break
            
            if not date_found:
                print_pass(f"Cleared date {test_date} no longer appears in attendance")
            else:
                print_fail(f"Cleared date {test_date} still appears in attendance")
        else:
            print_info("Barber not found in attendance response (may be expected if no records)")
    else:
        print_fail(f"Failed to get attendance: {attendance_response.status_code}")
    
    # Step e: Without auth → 401/403
    print_info("\nStep e: Calling DELETE without auth (should get 401/403)")
    
    delete_no_auth = requests.delete(
        f"{BACKEND_URL}/salons/{salon_id}/staff-attendance/override/{barber_id}/{test_date}"
    )
    print_response(delete_no_auth)
    
    if delete_no_auth.status_code in [401, 403]:
        print_pass(f"Correctly rejected without auth: {delete_no_auth.status_code}")
    else:
        print_fail(f"Expected 401/403, got {delete_no_auth.status_code}")

# ============================================================================
# TEST 4: GET /api/salons/{salon_id}/barbers?customer_view=true&date=<today>
# ============================================================================
def test_customer_view_on_leave(salon_id, admin_token, headers):
    print_test("TEST 4: GET barbers?customer_view=true - On-leave barbers included with flag")
    
    # Get barbers list
    print_info("Getting barber list...")
    
    barbers_response = requests.get(
        f"{BACKEND_URL}/salons/{salon_id}/barbers",
        headers=headers
    )
    
    if barbers_response.status_code != 200:
        print_fail(f"Failed to get barbers: {barbers_response.status_code}")
        return
    
    barbers_data = barbers_response.json()
    barbers = barbers_data if isinstance(barbers_data, list) else barbers_data.get("barbers", [])
    
    if not barbers:
        print_fail("No barbers found")
        return
    
    test_barber = barbers[0]
    barber_id = test_barber["id"]
    barber_name = test_barber["name"]
    print_info(f"Using barber: {barber_name} (ID: {barber_id})")
    
    today = get_today_ist()
    tomorrow = get_tomorrow_ist()
    
    # Step a: Set leave for today
    print_info(f"\nStep a: Setting leave for {barber_name} on {today}")
    
    # Use the dedicated leave-date endpoint
    leave_response = requests.put(
        f"{BACKEND_URL}/salons/{salon_id}/barbers/{barber_id}/leave-date",
        headers=headers,
        json={"date": today, "is_on_leave": True}
    )
    
    print_response(leave_response)
    
    if leave_response.status_code == 200:
        print_pass(f"Successfully set leave for {today}")
    else:
        print_fail(f"Failed to set leave: {leave_response.status_code}")
        return
    
    # Step b: GET with customer_view=true&date=today
    print_info(f"\nStep b: GET barbers?customer_view=true&date={today}")
    
    customer_view_response = requests.get(
        f"{BACKEND_URL}/salons/{salon_id}/barbers",
        params={"customer_view": "true", "date": today}
    )
    
    print_response(customer_view_response)
    
    if customer_view_response.status_code == 200:
        data = customer_view_response.json()
        barbers_list = data if isinstance(data, list) else data.get("barbers", [])
        
        # Find our test barber
        found_barber = None
        for b in barbers_list:
            if b.get("id") == barber_id:
                found_barber = b
                break
        
        if found_barber:
            print_pass(f"On-leave barber IS in response (not filtered out)")
            
            is_on_leave = found_barber.get("is_on_leave")
            if is_on_leave is True:
                print_pass(f"Barber has is_on_leave=true")
            else:
                print_fail(f"Barber has is_on_leave={is_on_leave}, expected true")
        else:
            print_fail(f"On-leave barber NOT found in response (should be included)")
        
        # Check other barbers have is_on_leave=false
        other_barbers_correct = True
        for b in barbers_list:
            if b.get("id") != barber_id:
                is_on_leave = b.get("is_on_leave")
                if is_on_leave not in [False, None]:
                    other_barbers_correct = False
                    print_fail(f"Other barber {b.get('name')} has is_on_leave={is_on_leave}, expected false/null")
        
        if other_barbers_correct:
            print_pass("Other barbers have is_on_leave=false or null")
    else:
        print_fail(f"Failed to get barbers: {customer_view_response.status_code}")
    
    # Step c: GET with date=tomorrow
    print_info(f"\nStep c: GET barbers?customer_view=true&date={tomorrow}")
    
    tomorrow_response = requests.get(
        f"{BACKEND_URL}/salons/{salon_id}/barbers",
        params={"customer_view": "true", "date": tomorrow}
    )
    
    print_response(tomorrow_response)
    
    if tomorrow_response.status_code == 200:
        data = tomorrow_response.json()
        barbers_list = data if isinstance(data, list) else data.get("barbers", [])
        
        # Find our test barber
        found_barber = None
        for b in barbers_list:
            if b.get("id") == barber_id:
                found_barber = b
                break
        
        if found_barber:
            is_on_leave = found_barber.get("is_on_leave")
            if is_on_leave in [False, None]:
                print_pass(f"Barber has is_on_leave={is_on_leave} for tomorrow (correct)")
            else:
                print_fail(f"Barber has is_on_leave={is_on_leave} for tomorrow, expected false/null")
        else:
            print_info("Barber not found in tomorrow's list")
    else:
        print_fail(f"Failed to get barbers for tomorrow: {tomorrow_response.status_code}")
    
    # Step d: GET with available_only=true&date=today (admin strict mode)
    print_info(f"\nStep d: GET barbers?available_only=true&date={today} (admin strict mode)")
    
    available_only_response = requests.get(
        f"{BACKEND_URL}/salons/{salon_id}/barbers",
        headers=headers,
        params={"available_only": "true", "date": today}
    )
    
    print_response(available_only_response)
    
    if available_only_response.status_code == 200:
        data = available_only_response.json()
        barbers_list = data if isinstance(data, list) else data.get("barbers", [])
        
        # Check if on-leave barber is filtered OUT
        found_barber = None
        for b in barbers_list:
            if b.get("id") == barber_id:
                found_barber = b
                break
        
        if not found_barber:
            print_pass("On-leave barber correctly filtered OUT in available_only mode")
        else:
            print_fail("On-leave barber still in response (should be filtered out)")
    else:
        print_fail(f"Failed to get barbers: {available_only_response.status_code}")
    
    # Step e: Reset leave
    print_info(f"\nStep e: Resetting leave for {barber_name}")
    
    # Use the dedicated leave-date endpoint to remove leave
    reset_response = requests.put(
        f"{BACKEND_URL}/salons/{salon_id}/barbers/{barber_id}/leave-date",
        headers=headers,
        json={"date": today, "is_on_leave": False}
    )
    
    if reset_response.status_code == 200:
        print_pass("Successfully reset leave")
    else:
        print_fail(f"Failed to reset leave: {reset_response.status_code}")

# ============================================================================
# TEST 5: pick_fastest_barber must NOT pick on-leave barbers
# ============================================================================
def test_pick_fastest_barber_skip_on_leave(salon_id, admin_token, headers):
    print_test("TEST 5: pick_fastest_barber must NOT pick on-leave barbers")
    
    # Get barbers list
    print_info("Getting barber list...")
    
    barbers_response = requests.get(
        f"{BACKEND_URL}/salons/{salon_id}/barbers",
        headers=headers
    )
    
    if barbers_response.status_code != 200:
        print_fail(f"Failed to get barbers: {barbers_response.status_code}")
        return
    
    barbers_data = barbers_response.json()
    barbers = barbers_data if isinstance(barbers_data, list) else barbers_data.get("barbers", [])
    
    if len(barbers) < 2:
        print_fail("Need at least 2 barbers to test pick_fastest_barber")
        return
    
    test_barber = barbers[0]
    barber_id = test_barber["id"]
    barber_name = test_barber["name"]
    print_info(f"Setting leave for: {barber_name} (ID: {barber_id})")
    
    today = get_today_ist()
    
    # Step a: Set leave for one barber today
    print_info(f"\nStep a: Setting leave for {barber_name} on {today}")
    
    # Use the dedicated leave-date endpoint
    leave_response = requests.put(
        f"{BACKEND_URL}/salons/{salon_id}/barbers/{barber_id}/leave-date",
        headers=headers,
        json={"date": today, "is_on_leave": True}
    )
    
    if leave_response.status_code != 200:
        print_fail(f"Failed to set leave: {leave_response.status_code}")
        return
    
    print_pass(f"Successfully set leave for {today}")
    
    # Step b: Create bookings with barber_id='any' and verify NOT the on-leave barber
    print_info(f"\nStep b: Creating bookings with barber_id='any' (repeat 3-5 times)")
    
    # Get enabled services
    services_response = requests.get(
        f"{BACKEND_URL}/salons/{salon_id}/services/enabled",
        headers=headers
    )
    
    if services_response.status_code != 200:
        print_fail(f"Failed to get services: {services_response.status_code}")
        return
    
    services_data = services_response.json()
    services = services_data if isinstance(services_data, list) else services_data.get("services", [])
    
    if not services:
        print_fail("No enabled services found")
        return
    
    service_id = services[0]["id"]
    
    # Create 5 bookings
    assigned_barbers = []
    for i in range(5):
        booking_data = {
            "customer_name": f"Pick Test Customer {i+1}",
            "phone": f"900003{i:04d}",
            "gender": "Men",
            "barber_id": "any",
            "selected_services": [service_id],
            "payment_mode": "cash",
            "date": today,
            "shift": "Evening"
        }
        
        booking_response = requests.post(
            f"{BACKEND_URL}/salons/{salon_id}/salon-booking",
            headers=headers,
            json=booking_data
        )
        
        if booking_response.status_code == 200:
            token_data = booking_response.json()
            assigned_barber_id = token_data.get("barber_id")
            assigned_barber_name = token_data.get("barber_name")
            assigned_barbers.append((assigned_barber_id, assigned_barber_name))
            print_info(f"Booking {i+1}: Assigned to {assigned_barber_name} (ID: {assigned_barber_id})")
        else:
            print_fail(f"Booking {i+1} failed: {booking_response.status_code}")
            print_response(booking_response)
    
    # Verify none of the assigned barbers is the on-leave barber
    on_leave_assigned = False
    for assigned_id, assigned_name in assigned_barbers:
        if assigned_id == barber_id:
            on_leave_assigned = True
            print_fail(f"On-leave barber {barber_name} was assigned!")
            break
    
    if not on_leave_assigned:
        print_pass(f"On-leave barber {barber_name} was NOT assigned in any of the {len(assigned_barbers)} bookings")
    
    # Step c: Reset leave
    print_info(f"\nStep c: Resetting leave for {barber_name}")
    
    # Use the dedicated leave-date endpoint to remove leave
    reset_response = requests.put(
        f"{BACKEND_URL}/salons/{salon_id}/barbers/{barber_id}/leave-date",
        headers=headers,
        json={"date": today, "is_on_leave": False}
    )
    
    if reset_response.status_code == 200:
        print_pass("Successfully reset leave")
    else:
        print_fail(f"Failed to reset leave: {reset_response.status_code}")

# ============================================================================
# Main execution
# ============================================================================
if __name__ == "__main__":
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}BACKEND REGRESSION TESTING - ROUND 3 BUG FIXES{RESET}")
    print(f"{BLUE}Multi-user auth fixes + On-leave barber handling{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        # Setup admin auth
        salon_id, admin_token, headers = setup_admin_auth()
        
        if not salon_id or not admin_token:
            print_fail("Failed to setup admin authentication. Exiting.")
            exit(1)
        
        # Run all tests
        test_notify_endpoint(salon_id, admin_token, headers)
        test_cancel_endpoint(salon_id, admin_token, headers)
        test_attendance_delete(salon_id, admin_token, headers)
        test_customer_view_on_leave(salon_id, admin_token, headers)
        test_pick_fastest_barber_skip_on_leave(salon_id, admin_token, headers)
        
        print(f"\n{BLUE}{'='*80}{RESET}")
        print(f"{BLUE}TESTING COMPLETE{RESET}")
        print(f"{BLUE}{'='*80}{RESET}\n")
        
    except Exception as e:
        print_fail(f"Test execution failed with exception: {str(e)}")
        import traceback
        traceback.print_exc()
