#!/usr/bin/env python3
"""
Backend API Testing Script for Salon Booking System
Focused regression testing on three recent backend changes
"""

import requests
import json
from datetime import datetime, timedelta

# Backend URL from environment
BACKEND_URL = "https://salon-booking-fix-7.preview.emergentagent.com/api"

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
        print(f"Response: {response.text}")

# ============================================================================
# TEST 1: Customer send-otp response shape FIXED
# ============================================================================
def test_customer_send_otp():
    print_test("TEST 1: Customer send-otp response shape")
    
    # Test 1a: Non-existent user (should get 404)
    print_info("Test 1a: Send OTP to non-registered phone (should get 404)")
    non_existent_phone = "9999999999"
    response = requests.post(
        f"{BACKEND_URL}/customer/send-otp",
        json={"phone": non_existent_phone}
    )
    print_response(response)
    
    if response.status_code == 404:
        data = response.json()
        if data.get("detail") == "User not found. Please login first.":
            print_pass("Non-existent user correctly returns 404 with expected message")
        else:
            print_fail(f"404 returned but wrong message: {data.get('detail')}")
    else:
        print_fail(f"Expected 404, got {response.status_code}")
    
    # Test 1b: Registered user (need to find or create one)
    print_info("\nTest 1b: Send OTP to registered user")
    
    # First, let's try to login as admin to get a salon_id
    admin_response = requests.post(
        f"{BACKEND_URL}/salon/users/login",
        json={"identifier": ADMIN_IDENTIFIER, "password": ADMIN_PASSWORD}
    )
    
    if admin_response.status_code == 200:
        admin_data = admin_response.json()
        salon_id = admin_data.get("salon_id")
        admin_token = admin_data.get("access_token")
        print_info(f"Admin login successful. Salon ID: {salon_id}")
        
        # Try to find an existing user by checking recent bookings
        headers = {"Authorization": f"Bearer {admin_token}"}
        tokens_response = requests.get(
            f"{BACKEND_URL}/salons/{salon_id}/tokens",
            headers=headers,
            params={"date": datetime.now().strftime("%Y-%m-%d")}
        )
        
        registered_phone = None
        if tokens_response.status_code == 200:
            tokens = tokens_response.json().get("tokens", [])
            for token in tokens:
                if token.get("phone") and token["phone"].startswith("+91"):
                    registered_phone = token["phone"]
                    break
        
        if not registered_phone:
            # Try to create a user via customer login (OTP-based)
            # For testing, we'll use a known test phone
            test_phone = "7503070727"
            
            # First check if this user exists
            user_check = requests.get(f"{BACKEND_URL}/users/by-phone/{test_phone}")
            if user_check.status_code == 200:
                registered_phone = f"+91{test_phone}"
                print_info(f"Found existing user: {registered_phone}")
            else:
                print_info("No registered users found to test with. Skipping registered user test.")
                return
        
        if registered_phone:
            # Now test send-otp for registered user
            otp_response = requests.post(
                f"{BACKEND_URL}/customer/send-otp",
                json={"phone": registered_phone.replace("+91", "")}
            )
            print_response(otp_response)
            
            if otp_response.status_code == 200:
                data = otp_response.json()
                
                # Check for required fields
                has_delivery_status = "delivery_status" in data
                has_note = "note" in data
                delivery_status = data.get("delivery_status")
                note = data.get("note", "")
                
                print_info(f"delivery_status: {delivery_status}")
                print_info(f"note: {note}")
                
                # Verify delivery_status field exists
                if has_delivery_status:
                    print_pass("Response contains delivery_status field")
                else:
                    print_fail("Response missing delivery_status field")
                
                # Verify delivery_status is one of expected values
                if delivery_status in ['sent', 'mock', 'failed']:
                    print_pass(f"delivery_status has valid value: {delivery_status}")
                else:
                    print_fail(f"delivery_status has invalid value: {delivery_status}")
                
                # Verify note matches delivery_status
                if delivery_status == 'sent':
                    expected_note = "OTP sent to your WhatsApp. Please check your messages."
                    if note == expected_note:
                        print_pass(f"Note matches 'sent' status: {note}")
                    else:
                        print_fail(f"Note mismatch for 'sent'. Expected: '{expected_note}', Got: '{note}'")
                elif delivery_status == 'mock':
                    expected_note = "⚠️ Twilio not configured - OTP shown for testing"
                    if note == expected_note:
                        print_pass(f"Note matches 'mock' status: {note}")
                    else:
                        print_fail(f"Note mismatch for 'mock'. Expected: '{expected_note}', Got: '{note}'")
                elif delivery_status == 'failed':
                    expected_note = "OTP delivery failed. Please try again."
                    if note == expected_note:
                        print_pass(f"Note matches 'failed' status: {note}")
                    else:
                        print_fail(f"Note mismatch for 'failed'. Expected: '{expected_note}', Got: '{note}'")
                
                # Verify OLD note is NOT present
                old_note = "OTP included because WhatsApp delivery failed"
                if old_note not in note:
                    print_pass("Old note text NOT present (correct)")
                else:
                    print_fail(f"Old note text still present: {old_note}")
                
            else:
                print_fail(f"Expected 200, got {otp_response.status_code}")
    else:
        print_fail(f"Admin login failed: {admin_response.status_code}")

# ============================================================================
# TEST 2: Salon send-otp note
# ============================================================================
def test_salon_send_otp():
    print_test("TEST 2: Salon send-otp note")
    
    # Test with the known salon phone
    salon_phone = "7503070727"
    
    response = requests.post(
        f"{BACKEND_URL}/salon/send-otp",
        json={"phone": salon_phone}
    )
    print_response(response)
    
    if response.status_code == 200:
        data = response.json()
        
        delivery_status = data.get("delivery_status")
        note = data.get("note", "")
        
        print_info(f"delivery_status: {delivery_status}")
        print_info(f"note: {note}")
        
        # Verify delivery_status field exists
        if "delivery_status" in data:
            print_pass("Response contains delivery_status field")
        else:
            print_fail("Response missing delivery_status field")
        
        # Verify note based on delivery_status
        if delivery_status == 'sent':
            expected_note = "OTP sent to your WhatsApp. Please check your messages."
            if note == expected_note:
                print_pass(f"Note matches 'sent' status: {note}")
            else:
                print_fail(f"Note mismatch for 'sent'. Expected: '{expected_note}', Got: '{note}'")
        elif delivery_status == 'mock':
            expected_note = "⚠️ Twilio not configured - OTP shown for testing"
            if note == expected_note:
                print_pass(f"Note matches 'mock' status: {note}")
            else:
                print_fail(f"Note mismatch for 'mock'. Expected: '{expected_note}', Got: '{note}'")
        elif delivery_status == 'failed':
            expected_note = "OTP delivery failed. Please try again."
            if note == expected_note:
                print_pass(f"Note matches 'failed' status: {note}")
            else:
                print_fail(f"Note mismatch for 'failed'. Expected: '{expected_note}', Got: '{note}'")
        
        # Verify OLD note is NOT present
        old_note = "OTP included because WhatsApp delivery failed"
        if old_note not in note:
            print_pass("Old note text NOT present (correct)")
        else:
            print_fail(f"Old note text still present: {old_note}")
    else:
        print_fail(f"Expected 200, got {response.status_code}")

# ============================================================================
# TEST 3: Salon manual booking auto-assigns barber when barber_id == "any"
# ============================================================================
def test_salon_manual_booking_auto_assign():
    print_test("TEST 3: Salon manual booking auto-assigns barber")
    
    # Login as admin
    admin_response = requests.post(
        f"{BACKEND_URL}/salon/users/login",
        json={"identifier": ADMIN_IDENTIFIER, "password": ADMIN_PASSWORD}
    )
    
    if admin_response.status_code != 200:
        print_fail(f"Admin login failed: {admin_response.status_code}")
        return
    
    admin_data = admin_response.json()
    salon_id = admin_data.get("salon_id")
    admin_token = admin_data.get("access_token")
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    print_info(f"Admin login successful. Salon ID: {salon_id}")
    
    # Step a: Find an enabled service
    print_info("\nStep a: Finding enabled services")
    services_response = requests.get(
        f"{BACKEND_URL}/salons/{salon_id}/services/enabled",
        headers=headers
    )
    
    if services_response.status_code != 200:
        print_fail(f"Failed to get enabled services: {services_response.status_code}")
        return
    
    services_data = services_response.json()
    # Handle both list and dict responses
    if isinstance(services_data, list):
        services = services_data
    else:
        services = services_data.get("services", [])
    
    if not services:
        print_fail("No enabled services found")
        return
    
    service_id = services[0]["id"]
    service_name = services[0].get("service_name", services[0].get("name", "Unknown"))
    print_info(f"Using service: {service_name} (ID: {service_id})")
    
    # Get today's date in IST
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Step b: Create booking with barber_id="any"
    print_info(f"\nStep b: Creating booking with barber_id='any'")
    booking_data = {
        "customer_name": "Auto Assign QA",
        "phone": "9000099000",
        "gender": "Men",
        "barber_id": "any",
        "selected_services": [service_id],
        "payment_mode": "cash",
        "date": today,
        "shift": "Morning"
    }
    
    print_info(f"Request body: {json.dumps(booking_data, indent=2)}")
    
    booking_response = requests.post(
        f"{BACKEND_URL}/salons/{salon_id}/salon-booking",
        headers=headers,
        json=booking_data
    )
    
    print_response(booking_response)
    
    if booking_response.status_code == 200:
        token_data = booking_response.json()
        token_id = token_data.get("id")
        barber_id = token_data.get("barber_id")
        barber_name = token_data.get("barber_name")
        token_number = token_data.get("token_number")
        
        print_info(f"Token created: {token_number}")
        print_info(f"Barber ID: {barber_id}")
        print_info(f"Barber Name: {barber_name}")
        
        # Step c: Verify barber_id is NOT "any"
        if barber_id and barber_id != "any":
            print_pass(f"barber_id is resolved to real UUID: {barber_id}")
        else:
            print_fail(f"barber_id is still 'any' or empty: {barber_id}")
        
        # Verify barber_name is NOT "Any Available"
        if barber_name and barber_name != "Any Available":
            print_pass(f"barber_name is set to actual name: {barber_name}")
        else:
            print_fail(f"barber_name is 'Any Available' or empty: {barber_name}")
        
        # Step d: Verify token shows up in tokens list
        print_info(f"\nStep d: Verifying token in token-status")
        tokens_response = requests.get(
            f"{BACKEND_URL}/salons/{salon_id}/token-status",
            headers=headers,
            params={"date": today}
        )
        
        if tokens_response.status_code == 200:
            status_data = tokens_response.json()
            barbers = status_data.get("barbers", [])
            
            # Find the barber that has our token
            found_barber = None
            for barber in barbers:
                if barber.get("barber_id") == barber_id:
                    found_barber = barber
                    break
            
            if found_barber:
                print_pass(f"Barber found in token-status: {found_barber.get('barber_name')}")
                print_info(f"Barber waiting_count: {found_barber.get('waiting_count')}")
                print_info(f"Barber total_tokens_today: {found_barber.get('total_tokens_today')}")
                
                # Verify the barber has at least one token
                if found_barber.get('total_tokens_today', 0) > 0:
                    print_pass(f"Barber has tokens today: {found_barber.get('total_tokens_today')}")
                else:
                    print_fail(f"Barber has no tokens today")
            else:
                print_fail(f"Barber {barber_id} not found in token-status")
        else:
            print_fail(f"Failed to get token-status: {tokens_response.status_code}")
        
        # Step e: Test with real barber_id (not "any")
        print_info(f"\nStep e: Creating booking with specific barber_id")
        
        # Get list of barbers
        barbers_response = requests.get(
            f"{BACKEND_URL}/salons/{salon_id}/barbers",
            headers=headers
        )
        
        if barbers_response.status_code == 200:
            barbers_data = barbers_response.json()
            # Handle both list and dict responses
            if isinstance(barbers_data, list):
                barbers = barbers_data
            else:
                barbers = barbers_data.get("barbers", [])
            if barbers:
                specific_barber_id = barbers[0]["id"]
                specific_barber_name = barbers[0]["name"]
                
                print_info(f"Using specific barber: {specific_barber_name} (ID: {specific_barber_id})")
                
                booking_data_specific = {
                    "customer_name": "Specific Barber QA",
                    "phone": "9000099001",
                    "gender": "Men",
                    "barber_id": specific_barber_id,
                    "selected_services": [service_id],
                    "payment_mode": "cash",
                    "date": today,
                    "shift": "Noon"
                }
                
                booking_response_specific = requests.post(
                    f"{BACKEND_URL}/salons/{salon_id}/salon-booking",
                    headers=headers,
                    json=booking_data_specific
                )
                
                if booking_response_specific.status_code == 200:
                    token_data_specific = booking_response_specific.json()
                    
                    if token_data_specific.get("barber_id") == specific_barber_id:
                        print_pass(f"Specific barber_id preserved: {specific_barber_id}")
                    else:
                        print_fail(f"Specific barber_id not preserved: {token_data_specific.get('barber_id')}")
                    
                    if token_data_specific.get("barber_name") == specific_barber_name:
                        print_pass(f"Specific barber_name preserved: {specific_barber_name}")
                    else:
                        print_fail(f"Specific barber_name not preserved: {token_data_specific.get('barber_name')}")
                else:
                    print_fail(f"Failed to create booking with specific barber: {booking_response_specific.status_code}")
            else:
                print_info("No barbers found to test specific barber booking")
        else:
            print_fail(f"Failed to get barbers list: {barbers_response.status_code}")
        
        # Step f: Edge case - all barbers full (skip if not feasible)
        print_info("\nStep f: Edge case - all barbers full (skipping as not feasible to set up)")
        
    elif booking_response.status_code == 400:
        error_detail = booking_response.json().get("detail", "")
        if "All barbers are fully booked" in error_detail:
            print_pass(f"Correctly returns 400 when all barbers full: {error_detail}")
        else:
            print_fail(f"400 error but wrong message: {error_detail}")
    else:
        print_fail(f"Expected 200, got {booking_response.status_code}")

# ============================================================================
# Main execution
# ============================================================================
if __name__ == "__main__":
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}BACKEND REGRESSION TESTING - THREE RECENT CHANGES{RESET}")
    print(f"{BLUE}{'='*80}{RESET}")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        test_customer_send_otp()
        test_salon_send_otp()
        test_salon_manual_booking_auto_assign()
        
        print(f"\n{BLUE}{'='*80}{RESET}")
        print(f"{BLUE}TESTING COMPLETE{RESET}")
        print(f"{BLUE}{'='*80}{RESET}\n")
        
    except Exception as e:
        print_fail(f"Test execution failed with exception: {str(e)}")
        import traceback
        traceback.print_exc()
