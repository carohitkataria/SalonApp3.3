#!/usr/bin/env python3
"""
Backend Testing Script for Notification Rules System - UPDATED
Tests the 4 notification-related tasks in current_focus
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://notify-control-4.preview.emergentagent.com/api"
TEST_PHONE = "7503070727"
TEST_SALON_ID = "a1221fbc-f5b1-4485-87a9-9ed23d6e1e27"
FALLBACK_SALON_ID = "02ce3728-5ffb-48a9-be59-6556b12d2561"
TEST_USER_ID = "test-user-notification-123"

def log_test(test_name, status, details=""):
    """Log test results"""
    status_icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{status_icon} {test_name}: {status}")
    if details:
        print(f"   {details}")
    print()

def make_request(method, endpoint, data=None, headers=None):
    """Make HTTP request with error handling"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=10)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers, timeout=10)
        elif method == "PUT":
            response = requests.put(url, json=data, headers=headers, timeout=10)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return response
    except Exception as e:
        print(f"Request failed: {e}")
        return None

def test_salon_notification_settings():
    """Test Task 1: Notification Settings - Salon Side (GET/PUT)"""
    print("=" * 60)
    print("TASK 1: NOTIFICATION SETTINGS - SALON SIDE")
    print("=" * 60)
    
    # Test GET endpoint - should return defaults
    response = make_request("GET", f"/salons/{FALLBACK_SALON_ID}/notification-settings")
    if response and response.status_code == 200:
        data = response.json()
        expected_keys = ["new_booking", "booking_change", "membership_purchase", "review_added"]
        
        # Check all expected keys are present and default to True
        all_keys_present = all(key in data for key in expected_keys)
        all_defaults_true = all(data.get(key) == True for key in expected_keys)
        
        if all_keys_present and all_defaults_true:
            log_test("GET salon notification settings", "PASS", 
                    f"All keys present with default True values: {expected_keys}")
        else:
            log_test("GET salon notification settings", "FAIL", 
                    f"Missing keys or wrong defaults. Got: {data}")
    else:
        log_test("GET salon notification settings", "FAIL", 
                f"Request failed. Status: {response.status_code if response else 'No response'}")
    
    # Test PUT endpoint without auth - should return 401/403
    test_data = {"new_booking": False}
    response = make_request("PUT", f"/salons/{FALLBACK_SALON_ID}/notification-settings", data=test_data)
    if response and response.status_code in [401, 403]:
        log_test("PUT salon notification settings (no auth)", "PASS", 
                f"Correctly rejected with status {response.status_code}")
    else:
        log_test("PUT salon notification settings (no auth)", "FAIL", 
                f"Expected 401/403, got {response.status_code if response else 'No response'}")

def test_customer_notification_settings():
    """Test Task 2: Notification Settings - Customer Side (GET/PUT)"""
    print("=" * 60)
    print("TASK 2: NOTIFICATION SETTINGS - CUSTOMER SIDE")
    print("=" * 60)
    
    # Test with phone number without +91 prefix
    response = make_request("GET", f"/customers/{TEST_PHONE}/notification-settings")
    if response and response.status_code == 200:
        data = response.json()
        expected_in_app_keys = ["payment_confirmation", "turn_approaching", "manual_notify", 
                               "membership_added", "booking_status_change", "custom_package"]
        expected_whatsapp_keys = ["whatsapp_payment_confirmation", "whatsapp_turn_approaching", 
                                 "whatsapp_manual_notify", "whatsapp_membership_added", 
                                 "whatsapp_booking_status_change", "whatsapp_booking_confirmation",
                                 "whatsapp_booking_cancelled", "whatsapp_booking_rescheduled"]
        
        all_keys = expected_in_app_keys + expected_whatsapp_keys
        all_keys_present = all(key in data for key in all_keys)
        all_defaults_true = all(data.get(key) == True for key in all_keys)
        
        if all_keys_present and all_defaults_true:
            log_test("GET customer notification settings (no +91)", "PASS", 
                    f"All {len(all_keys)} keys present with default True values")
        else:
            missing_keys = [key for key in all_keys if key not in data]
            log_test("GET customer notification settings (no +91)", "FAIL", 
                    f"Missing keys: {missing_keys} or wrong defaults")
    else:
        log_test("GET customer notification settings (no +91)", "FAIL", 
                f"Request failed. Status: {response.status_code if response else 'No response'}")
    
    # Test with +91 prefix
    response = make_request("GET", f"/customers/+91{TEST_PHONE}/notification-settings")
    if response and response.status_code == 200:
        log_test("GET customer notification settings (+91)", "PASS", 
                "Phone normalization working correctly")
    else:
        log_test("GET customer notification settings (+91)", "FAIL", 
                f"Phone normalization failed. Status: {response.status_code if response else 'No response'}")
    
    # Test PUT with partial update (no auth required)
    test_data = {"whatsapp_booking_confirmation": False}
    response = make_request("PUT", f"/customers/{TEST_PHONE}/notification-settings", data=test_data)
    if response and response.status_code == 200:
        updated_data = response.json()
        if updated_data.get("whatsapp_booking_confirmation") == False:
            log_test("PUT customer notification settings (partial)", "PASS", 
                    "Partial update successful, setting persisted")
            
            # Verify the change persisted by getting settings again
            verify_response = make_request("GET", f"/customers/{TEST_PHONE}/notification-settings")
            if verify_response and verify_response.status_code == 200:
                verify_data = verify_response.json()
                if verify_data.get("whatsapp_booking_confirmation") == False:
                    log_test("PUT customer notification settings (persistence)", "PASS", 
                            "Setting change persisted correctly")
                else:
                    log_test("PUT customer notification settings (persistence)", "FAIL", 
                            "Setting change did not persist")
            else:
                log_test("PUT customer notification settings (persistence)", "FAIL", 
                        "Could not verify persistence")
        else:
            log_test("PUT customer notification settings (partial)", "FAIL", 
                    f"Update failed. Expected whatsapp_booking_confirmation=False, got {updated_data.get('whatsapp_booking_confirmation')}")
    else:
        log_test("PUT customer notification settings (partial)", "FAIL", 
                f"Request failed. Status: {response.status_code if response else 'No response'}")

def test_cancel_booking_via_whatsapp_link():
    """Test Task 3: Cancel Booking via WhatsApp Link"""
    print("=" * 60)
    print("TASK 3: CANCEL BOOKING VIA WHATSAPP LINK")
    print("=" * 60)
    
    # Test with non-existent token ID
    fake_token_id = "non-existent-token-123"
    response = make_request("GET", f"/tokens/{fake_token_id}/cancel-link")
    if response and response.status_code == 404:
        content_type = response.headers.get('content-type', '')
        is_html = 'text/html' in content_type or response.text.strip().startswith('<!DOCTYPE html>')
        
        if is_html:
            log_test("Cancel link (non-existent token)", "PASS", 
                    f"Returns 404 with HTML content (Content-Type: {content_type})")
        else:
            log_test("Cancel link (non-existent token)", "FAIL", 
                    f"Returns 404 but not HTML. Content-Type: {content_type}")
    else:
        log_test("Cancel link (non-existent token)", "FAIL", 
                f"Expected 404, got {response.status_code if response else 'No response'}")
    
    # Try to create a test booking first to test actual cancellation
    print("Creating test booking for cancellation test...")
    booking_data = {
        "salon_id": FALLBACK_SALON_ID,
        "user_id": TEST_USER_ID,
        "customer_name": "Test Customer Cancel",
        "phone": TEST_PHONE,
        "selected_services": [],  # Empty services for testing
        "barber_id": "any",
        "date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
        "shift": "morning",
        "payment_mode": "cash"
    }
    
    booking_response = make_request("POST", "/bookings", data=booking_data)
    
    if booking_response and booking_response.status_code == 200:
        booking_result = booking_response.json()
        token_id = booking_result.get("id")
        token_number = booking_result.get("token_number")
        
        log_test("Create test booking", "PASS", 
                f"Created booking with Token ID: {token_id}, Number: {token_number}")
        
        # Test cancellation via WhatsApp link
        cancel_response = make_request("GET", f"/tokens/{token_id}/cancel-link")
        if cancel_response and cancel_response.status_code == 200:
            content_type = cancel_response.headers.get('content-type', '')
            is_html = 'text/html' in content_type or cancel_response.text.strip().startswith('<!DOCTYPE html>')
            
            if is_html and "cancelled successfully" in cancel_response.text.lower():
                log_test("Cancel booking via WhatsApp link", "PASS", 
                        "Returns HTML success page")
                
                # Verify token status changed to cancelled
                # We can check this by trying to cancel again - should show "already cancelled"
                second_cancel = make_request("GET", f"/tokens/{token_id}/cancel-link")
                if second_cancel and "already cancelled" in second_cancel.text.lower():
                    log_test("Token status update", "PASS", 
                            "Token status correctly set to cancelled")
                else:
                    log_test("Token status update", "FAIL", 
                            "Token status may not have been updated")
                
                # Check if notifications were created
                salon_id = booking_result.get("salon_id")
                customer_notif_response = make_request("GET", f"/notifications/customer/{TEST_PHONE}")
                salon_notif_response = make_request("GET", f"/notifications/salon/{salon_id}")
                
                customer_notifications = []
                salon_notifications = []
                
                if customer_notif_response and customer_notif_response.status_code == 200:
                    customer_notifications = customer_notif_response.json().get("notifications", [])
                
                if salon_notif_response and salon_notif_response.status_code == 200:
                    salon_notifications = salon_notif_response.json().get("notifications", [])
                
                # Look for recent cancellation notifications
                recent_customer_cancel = any(
                    notif.get("type") == "booking_cancelled" and notif.get("related_id") == token_id
                    for notif in customer_notifications[:5]  # Check last 5 notifications
                )
                recent_salon_cancel = any(
                    notif.get("type") == "booking_cancelled" and notif.get("related_id") == token_id
                    for notif in salon_notifications[:5]  # Check last 5 notifications
                )
                
                if recent_customer_cancel and recent_salon_cancel:
                    log_test("Notification creation", "PASS", 
                            "Both customer and salon notifications created")
                elif recent_customer_cancel or recent_salon_cancel:
                    log_test("Notification creation", "WARN", 
                            f"Only {'customer' if recent_customer_cancel else 'salon'} notification found")
                else:
                    log_test("Notification creation", "FAIL", 
                            "No cancellation notifications found")
                
            else:
                log_test("Cancel booking via WhatsApp link", "FAIL", 
                        f"Expected HTML success page, got: {cancel_response.text[:200]}...")
        else:
            log_test("Cancel booking via WhatsApp link", "FAIL", 
                    f"Cancel request failed. Status: {cancel_response.status_code if cancel_response else 'No response'}")
    else:
        log_test("Create test booking", "FAIL", 
                f"Could not create test booking. Status: {booking_response.status_code if booking_response else 'No response'}")

def test_notification_triggers_coverage():
    """Test Task 4: Notification Triggers Coverage"""
    print("=" * 60)
    print("TASK 4: NOTIFICATION TRIGGERS COVERAGE")
    print("=" * 60)
    
    # Test 1: Create new booking and verify salon notification
    print("Testing new booking notification trigger...")
    booking_data = {
        "salon_id": FALLBACK_SALON_ID,
        "user_id": TEST_USER_ID + "-triggers",
        "customer_name": "Test Customer Triggers",
        "phone": TEST_PHONE,
        "selected_services": [],
        "barber_id": "any",
        "date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
        "shift": "noon",
        "payment_mode": "cash"
    }
    
    booking_response = make_request("POST", "/bookings", data=booking_data)
    
    if booking_response and booking_response.status_code == 200:
        booking_result = booking_response.json()
        token_id = booking_result.get("id")
        salon_id = booking_result.get("salon_id")
        
        log_test("Create booking for trigger test", "PASS", 
                f"Created booking {token_id}")
        
        # Check for salon notification with type "new_booking"
        salon_notif_response = make_request("GET", f"/notifications/salon/{salon_id}")
        if salon_notif_response and salon_notif_response.status_code == 200:
            notifications = salon_notif_response.json().get("notifications", [])
            new_booking_notif = any(
                notif.get("type") == "new_booking" and notif.get("related_id") == token_id
                for notif in notifications[:5]  # Check recent notifications
            )
            
            if new_booking_notif:
                log_test("New booking notification trigger", "PASS", 
                        "Salon received new_booking notification")
            else:
                log_test("New booking notification trigger", "FAIL", 
                        "No new_booking notification found for salon")
        else:
            log_test("New booking notification trigger", "FAIL", 
                    "Could not fetch salon notifications")
        
        # Test 2: Customer cancel and verify notifications
        print("Testing customer cancel notification trigger...")
        cancel_response = make_request("POST", f"/tokens/{token_id}/customer-cancel")
        if cancel_response and cancel_response.status_code == 200:
            log_test("Customer cancel booking", "PASS", 
                    "Customer cancel successful")
            
            # Check for customer and salon notifications
            customer_notif_response = make_request("GET", f"/notifications/customer/{TEST_PHONE}")
            salon_notif_response = make_request("GET", f"/notifications/salon/{salon_id}")
            
            customer_cancel_notif = False
            salon_cancel_notif = False
            
            if customer_notif_response and customer_notif_response.status_code == 200:
                customer_notifications = customer_notif_response.json().get("notifications", [])
                customer_cancel_notif = any(
                    notif.get("type") == "booking_cancelled" and notif.get("related_id") == token_id
                    for notif in customer_notifications[:5]
                )
            
            if salon_notif_response and salon_notif_response.status_code == 200:
                salon_notifications = salon_notif_response.json().get("notifications", [])
                salon_cancel_notif = any(
                    notif.get("type") == "booking_cancelled" and notif.get("related_id") == token_id
                    for notif in salon_notifications[:5]
                )
            
            if customer_cancel_notif and salon_cancel_notif:
                log_test("Customer cancel notification triggers", "PASS", 
                        "Both customer and salon cancel notifications created")
            else:
                missing = []
                if not customer_cancel_notif:
                    missing.append("customer")
                if not salon_cancel_notif:
                    missing.append("salon")
                log_test("Customer cancel notification triggers", "FAIL", 
                        f"Missing notifications for: {', '.join(missing)}")
        else:
            log_test("Customer cancel booking", "FAIL", 
                    f"Cancel failed. Status: {cancel_response.status_code if cancel_response else 'No response'}")
    else:
        log_test("Create booking for trigger test", "FAIL", 
                f"Could not create booking. Status: {booking_response.status_code if booking_response else 'No response'}")
    
    # Test 3: Toggle customer notification setting and verify suppression
    print("Testing notification suppression when setting is OFF...")
    
    # Turn off booking_status_change notification
    toggle_data = {"booking_status_change": False}
    toggle_response = make_request("PUT", f"/customers/{TEST_PHONE}/notification-settings", data=toggle_data)
    
    if toggle_response and toggle_response.status_code == 200:
        log_test("Toggle customer notification setting OFF", "PASS", 
                "booking_status_change set to False")
        
        # Create another booking to test suppression
        booking_data_2 = {
            "salon_id": FALLBACK_SALON_ID,
            "user_id": TEST_USER_ID + "-suppression",
            "customer_name": "Test Suppression",
            "phone": TEST_PHONE,
            "selected_services": [],
            "barber_id": "any",
            "date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "shift": "evening",
            "payment_mode": "cash"
        }
        
        booking_response_2 = make_request("POST", "/bookings", data=booking_data_2)
        if booking_response_2 and booking_response_2.status_code == 200:
            booking_result_2 = booking_response_2.json()
            token_id_2 = booking_result_2.get("id")
            
            # Cancel this booking to trigger booking_status_change
            cancel_response_2 = make_request("POST", f"/tokens/{token_id_2}/customer-cancel")
            if cancel_response_2 and cancel_response_2.status_code == 200:
                
                # Check if customer notification was suppressed
                customer_notif_response = make_request("GET", f"/notifications/customer/{TEST_PHONE}")
                if customer_notif_response and customer_notif_response.status_code == 200:
                    notifications = customer_notif_response.json().get("notifications", [])
                    
                    # Look for very recent notifications (should not include booking_cancelled for this token)
                    recent_cancel_notifs = [
                        notif for notif in notifications[:5] 
                        if notif.get("type") == "booking_cancelled" and 
                           notif.get("related_id") == token_id_2
                    ]
                    
                    if not recent_cancel_notifs:
                        log_test("Notification suppression test", "PASS", 
                                "Customer notification correctly suppressed when setting is OFF")
                    else:
                        log_test("Notification suppression test", "FAIL", 
                                "Customer notification was NOT suppressed despite setting being OFF")
                else:
                    log_test("Notification suppression test", "FAIL", 
                            "Could not fetch customer notifications for suppression test")
            else:
                log_test("Notification suppression test", "FAIL", 
                        "Could not cancel booking for suppression test")
        else:
            log_test("Notification suppression test", "FAIL", 
                    "Could not create booking for suppression test")
        
        # Reset the setting back to True
        reset_data = {"booking_status_change": True}
        make_request("PUT", f"/customers/{TEST_PHONE}/notification-settings", data=reset_data)
        
    else:
        log_test("Toggle customer notification setting OFF", "FAIL", 
                "Could not toggle notification setting")
    
    # Test 4: Verify existing notification endpoints still work
    print("Testing existing notification endpoints...")
    
    # Test customer notifications endpoint
    customer_notif_response = make_request("GET", f"/notifications/customer/{TEST_PHONE}")
    if customer_notif_response and customer_notif_response.status_code == 200:
        log_test("Customer notifications endpoint", "PASS", 
                "GET /api/notifications/customer/{phone} working")
    else:
        log_test("Customer notifications endpoint", "FAIL", 
                f"Status: {customer_notif_response.status_code if customer_notif_response else 'No response'}")
    
    # Test customer unread count
    customer_unread_response = make_request("GET", f"/notifications/customer/{TEST_PHONE}/unread-count")
    if customer_unread_response and customer_unread_response.status_code == 200:
        unread_data = customer_unread_response.json()
        if "unread_count" in unread_data:
            log_test("Customer unread count endpoint", "PASS", 
                    f"Unread count: {unread_data['unread_count']}")
        else:
            log_test("Customer unread count endpoint", "FAIL", 
                    "Missing unread_count in response")
    else:
        log_test("Customer unread count endpoint", "FAIL", 
                f"Status: {customer_unread_response.status_code if customer_unread_response else 'No response'}")
    
    # Test salon notifications endpoint
    salon_notif_response = make_request("GET", f"/notifications/salon/{FALLBACK_SALON_ID}")
    if salon_notif_response and salon_notif_response.status_code == 200:
        log_test("Salon notifications endpoint", "PASS", 
                "GET /api/notifications/salon/{salon_id} working")
    else:
        log_test("Salon notifications endpoint", "FAIL", 
                f"Status: {salon_notif_response.status_code if salon_notif_response else 'No response'}")
    
    # Test salon unread count
    salon_unread_response = make_request("GET", f"/notifications/salon/{FALLBACK_SALON_ID}/unread-count")
    if salon_unread_response and salon_unread_response.status_code == 200:
        unread_data = salon_unread_response.json()
        if "unread_count" in unread_data:
            log_test("Salon unread count endpoint", "PASS", 
                    f"Unread count: {unread_data['unread_count']}")
        else:
            log_test("Salon unread count endpoint", "FAIL", 
                    "Missing unread_count in response")
    else:
        log_test("Salon unread count endpoint", "FAIL", 
                f"Status: {salon_unread_response.status_code if salon_unread_response else 'No response'}")

def main():
    """Run all notification tests"""
    print("🧪 NOTIFICATION RULES BACKEND TESTING - UPDATED")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"Test Phone: {TEST_PHONE}")
    print(f"Primary Salon ID: {TEST_SALON_ID}")
    print(f"Fallback Salon ID: {FALLBACK_SALON_ID}")
    print(f"Test User ID: {TEST_USER_ID}")
    print("=" * 60)
    print()
    
    # Run all tests
    test_salon_notification_settings()
    test_customer_notification_settings()
    test_cancel_booking_via_whatsapp_link()
    test_notification_triggers_coverage()
    
    print("=" * 60)
    print("🏁 NOTIFICATION TESTING COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    main()