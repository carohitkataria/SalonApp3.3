#!/usr/bin/env python3
"""
Backend Test Suite for Phase 1.5 - Barber Availability & Leave Management
Tests new fields: last_working_date, leave_dates
Tests new endpoints: toggle leave date, bulk mark present, filtered listing
"""

import requests
import json
from datetime import datetime, timedelta, timezone

# Configuration
BASE_URL = "https://customer-experience-4.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {
    "identifier": "admin",
    "password": "salon123"
}

# Global variables
access_token = None
salon_id = None
test_barber_id = None
test_barber_original_data = {}

def print_test_header(test_name):
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")

def login_admin():
    """Login as admin and get access token"""
    global access_token, salon_id
    print_test_header("Admin Login")
    
    url = f"{BASE_URL}/salon/users/login"
    response = requests.post(url, json=ADMIN_CREDENTIALS)
    
    if response.status_code == 200:
        data = response.json()
        access_token = data.get("access_token")
        salon_id = data.get("salon_id")
        print_result(True, f"Admin login successful. Salon ID: {salon_id}")
        return True
    else:
        print_result(False, f"Admin login failed: {response.status_code} - {response.text}")
        return False

def get_auth_headers():
    """Return authorization headers"""
    return {"Authorization": f"Bearer {access_token}"}

def get_test_barber():
    """Get a barber to use for testing"""
    global test_barber_id, test_barber_original_data
    print_test_header("Get Test Barber")
    
    url = f"{BASE_URL}/salons/{salon_id}/barbers"
    response = requests.get(url)
    
    if response.status_code == 200:
        barbers = response.json()
        if barbers:
            test_barber_id = barbers[0]["id"]
            test_barber_original_data = {
                "last_working_date": barbers[0].get("last_working_date"),
                "leave_dates": barbers[0].get("leave_dates", [])
            }
            print_result(True, f"Test barber: {barbers[0]['name']} (ID: {test_barber_id})")
            print(f"   Original last_working_date: {test_barber_original_data['last_working_date']}")
            print(f"   Original leave_dates: {test_barber_original_data['leave_dates']}")
            return True
        else:
            print_result(False, "No barbers found in salon")
            return False
    else:
        print_result(False, f"Failed to get barbers: {response.status_code} - {response.text}")
        return False

def test_1_update_barber_new_fields():
    """Test 1: Update barber with last_working_date and leave_dates"""
    print_test_header("Test 1: Update Barber with New Fields")
    
    # Set test values
    test_last_working_date = "2026-12-31"
    test_leave_dates = ["2026-06-15", "2026-06-16"]
    
    # Update barber
    url = f"{BASE_URL}/barbers/{test_barber_id}"
    payload = {
        "last_working_date": test_last_working_date,
        "leave_dates": test_leave_dates
    }
    
    print(f"   Updating barber with: {payload}")
    response = requests.put(url, json=payload, headers=get_auth_headers())
    
    if response.status_code != 200:
        print_result(False, f"Update failed: {response.status_code} - {response.text}")
        return False
    
    # Verify by re-fetching
    url = f"{BASE_URL}/salons/{salon_id}/barbers"
    response = requests.get(url)
    
    if response.status_code == 200:
        barbers = response.json()
        barber = next((b for b in barbers if b["id"] == test_barber_id), None)
        
        if barber:
            actual_lwd = barber.get("last_working_date")
            actual_leave_dates = barber.get("leave_dates", [])
            
            if actual_lwd == test_last_working_date and set(actual_leave_dates) == set(test_leave_dates):
                print_result(True, f"Fields persisted correctly")
                print(f"   last_working_date: {actual_lwd}")
                print(f"   leave_dates: {actual_leave_dates}")
                return True
            else:
                print_result(False, f"Fields mismatch. Expected lwd={test_last_working_date}, leave_dates={test_leave_dates}")
                print(f"   Got lwd={actual_lwd}, leave_dates={actual_leave_dates}")
                return False
        else:
            print_result(False, "Barber not found after update")
            return False
    else:
        print_result(False, f"Failed to verify: {response.status_code} - {response.text}")
        return False

def test_2_filtered_listing_last_working_date():
    """Test 2: Filtered listing with available_only and date parameters"""
    print_test_header("Test 2: Filtered Listing - last_working_date")
    
    # First, set last_working_date to yesterday
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Update barber with last_working_date = yesterday
    url = f"{BASE_URL}/barbers/{test_barber_id}"
    payload = {"last_working_date": yesterday}
    
    print(f"   Setting last_working_date to yesterday: {yesterday}")
    response = requests.put(url, json=payload, headers=get_auth_headers())
    
    if response.status_code != 200:
        print_result(False, f"Update failed: {response.status_code} - {response.text}")
        return False
    
    # Test 2a: GET with date=tomorrow (barber should NOT appear)
    print(f"\n   Test 2a: GET with date=tomorrow ({tomorrow}) - barber should NOT appear")
    url = f"{BASE_URL}/salons/{salon_id}/barbers?available_only=true&date={tomorrow}"
    response = requests.get(url)
    
    if response.status_code == 200:
        barbers = response.json()
        barber_ids = [b["id"] for b in barbers]
        
        if test_barber_id not in barber_ids:
            print_result(True, f"Barber correctly excluded (date > last_working_date)")
        else:
            print_result(False, f"Barber should be excluded but was included")
            return False
    else:
        print_result(False, f"Request failed: {response.status_code} - {response.text}")
        return False
    
    # Test 2b: GET with date=yesterday (barber MUST appear)
    print(f"\n   Test 2b: GET with date=yesterday ({yesterday}) - barber MUST appear")
    url = f"{BASE_URL}/salons/{salon_id}/barbers?available_only=true&date={yesterday}"
    response = requests.get(url)
    
    if response.status_code == 200:
        barbers = response.json()
        barber_ids = [b["id"] for b in barbers]
        
        if test_barber_id in barber_ids:
            print_result(True, f"Barber correctly included (date == last_working_date)")
            return True
        else:
            print_result(False, f"Barber should be included but was excluded")
            return False
    else:
        print_result(False, f"Request failed: {response.status_code} - {response.text}")
        return False

def test_3_toggle_leave_date():
    """Test 3: Toggle leave date endpoint"""
    print_test_header("Test 3: Toggle Leave Date")
    
    # First, reset last_working_date to future date
    future_date = "2026-12-31"
    url = f"{BASE_URL}/barbers/{test_barber_id}"
    payload = {"last_working_date": future_date, "leave_dates": []}
    
    print(f"   Resetting barber: last_working_date={future_date}, leave_dates=[]")
    response = requests.put(url, json=payload, headers=get_auth_headers())
    
    if response.status_code != 200:
        print_result(False, f"Reset failed: {response.status_code} - {response.text}")
        return False
    
    # Pick a future date within employment window
    test_leave_date = "2026-06-20"
    
    # Test 3a: Toggle ON - add leave date
    print(f"\n   Test 3a: Toggle ON - add leave date {test_leave_date}")
    url = f"{BASE_URL}/salons/{salon_id}/barbers/{test_barber_id}/leave-date"
    payload = {"date": test_leave_date, "is_on_leave": True}
    
    response = requests.put(url, json=payload, headers=get_auth_headers())
    
    if response.status_code != 200:
        print_result(False, f"Toggle ON failed: {response.status_code} - {response.text}")
        return False
    
    data = response.json()
    if test_leave_date not in data.get("leave_dates", []):
        print_result(False, f"Leave date not in response: {data}")
        return False
    
    print_result(True, f"Leave date added to response: {data['leave_dates']}")
    
    # Verify in DB by fetching barber
    url = f"{BASE_URL}/salons/{salon_id}/barbers"
    response = requests.get(url)
    
    if response.status_code == 200:
        barbers = response.json()
        barber = next((b for b in barbers if b["id"] == test_barber_id), None)
        
        if barber and test_leave_date in barber.get("leave_dates", []):
            print_result(True, f"Leave date persisted in DB: {barber.get('leave_dates')}")
        else:
            print_result(False, f"Leave date not in DB. Got: {barber.get('leave_dates') if barber else 'barber not found'}")
            return False
    else:
        print_result(False, f"Failed to verify DB: {response.status_code}")
        return False
    
    # Test 3b: Verify filtered listing excludes barber on leave date
    print(f"\n   Test 3b: Verify available_only=true&date={test_leave_date} excludes barber")
    url = f"{BASE_URL}/salons/{salon_id}/barbers?available_only=true&date={test_leave_date}"
    response = requests.get(url)
    
    if response.status_code == 200:
        barbers = response.json()
        barber_ids = [b["id"] for b in barbers]
        
        if test_barber_id not in barber_ids:
            print_result(True, f"Barber correctly excluded on leave date")
        else:
            print_result(False, f"Barber should be excluded but was included")
            return False
    else:
        print_result(False, f"Request failed: {response.status_code}")
        return False
    
    # Test 3c: Verify GET leave-dates endpoint
    print(f"\n   Test 3c: Verify GET /leave-dates endpoint")
    url = f"{BASE_URL}/salons/{salon_id}/barbers/{test_barber_id}/leave-dates"
    response = requests.get(url, headers=get_auth_headers())
    
    if response.status_code == 200:
        data = response.json()
        if test_leave_date in data.get("leave_dates", []):
            print_result(True, f"GET /leave-dates returns correct data: {data}")
        else:
            print_result(False, f"Leave date not in GET response: {data}")
            return False
    else:
        print_result(False, f"GET /leave-dates failed: {response.status_code}")
        return False
    
    # Test 3d: Verify attendance record created
    print(f"\n   Test 3d: Verify attendance record with status='absent'")
    month = test_leave_date[:7]  # YYYY-MM
    url = f"{BASE_URL}/salons/{salon_id}/staff-attendance/month/{month}?barber_id={test_barber_id}"
    response = requests.get(url, headers=get_auth_headers())
    
    if response.status_code == 200:
        data = response.json()
        # Find attendance record for test_leave_date
        attendance_found = False
        for barber_data in data.get("barbers", []):
            if barber_data.get("barber_id") == test_barber_id:
                for record in barber_data.get("attendance", []):
                    if record.get("date") == test_leave_date and record.get("status") == "absent":
                        attendance_found = True
                        print_result(True, f"Attendance record found with status='absent': {record}")
                        break
        
        if not attendance_found:
            print_result(False, f"Attendance record not found or status != 'absent'. Data: {data}")
            return False
    else:
        print_result(False, f"Failed to get attendance: {response.status_code}")
        return False
    
    # Test 3e: Toggle OFF - remove leave date
    print(f"\n   Test 3e: Toggle OFF - remove leave date {test_leave_date}")
    url = f"{BASE_URL}/salons/{salon_id}/barbers/{test_barber_id}/leave-date"
    payload = {"date": test_leave_date, "is_on_leave": False}
    
    response = requests.put(url, json=payload, headers=get_auth_headers())
    
    if response.status_code != 200:
        print_result(False, f"Toggle OFF failed: {response.status_code} - {response.text}")
        return False
    
    data = response.json()
    if test_leave_date in data.get("leave_dates", []):
        print_result(False, f"Leave date still in response after toggle OFF: {data}")
        return False
    
    print_result(True, f"Leave date removed from response: {data['leave_dates']}")
    
    # Verify in DB
    url = f"{BASE_URL}/salons/{salon_id}/barbers"
    response = requests.get(url)
    
    if response.status_code == 200:
        barbers = response.json()
        barber = next((b for b in barbers if b["id"] == test_barber_id), None)
        
        if barber and test_leave_date not in barber.get("leave_dates", []):
            print_result(True, f"Leave date removed from DB: {barber.get('leave_dates')}")
            return True
        else:
            print_result(False, f"Leave date still in DB: {barber.get('leave_dates') if barber else 'barber not found'}")
            return False
    else:
        print_result(False, f"Failed to verify DB: {response.status_code}")
        return False

def test_4_bulk_mark_all_present():
    """Test 4: Bulk mark all present endpoint"""
    print_test_header("Test 4: Bulk Mark All Present")
    
    # Use a past date for testing
    test_date = "2026-04-20"
    
    # Get all barbers first
    url = f"{BASE_URL}/salons/{salon_id}/barbers"
    response = requests.get(url)
    
    if response.status_code != 200:
        print_result(False, f"Failed to get barbers: {response.status_code}")
        return False
    
    all_barbers = response.json()
    if len(all_barbers) < 2:
        print(f"   Warning: Only {len(all_barbers)} barber(s) available for testing")
    
    # Setup: Set one barber's last_working_date to before test_date
    if len(all_barbers) >= 1:
        barber1_id = all_barbers[0]["id"]
        url = f"{BASE_URL}/barbers/{barber1_id}"
        payload = {"last_working_date": "2026-04-15", "leave_dates": []}  # Before test_date
        
        print(f"\n   Setup: Setting barber {all_barbers[0]['name']} last_working_date to 2026-04-15")
        response = requests.put(url, json=payload, headers=get_auth_headers())
        
        if response.status_code != 200:
            print_result(False, f"Setup failed: {response.status_code}")
            return False
    
    # Setup: Add another barber to leave_dates for test_date
    if len(all_barbers) >= 2:
        barber2_id = all_barbers[1]["id"]
        url = f"{BASE_URL}/barbers/{barber2_id}"
        payload = {"last_working_date": "2026-12-31", "leave_dates": [test_date]}
        
        print(f"   Setup: Adding barber {all_barbers[1]['name']} to leave on {test_date}")
        response = requests.put(url, json=payload, headers=get_auth_headers())
        
        if response.status_code != 200:
            print_result(False, f"Setup failed: {response.status_code}")
            return False
    
    # Test: Call bulk mark all present
    print(f"\n   Calling POST /staff-attendance/mark-all-present/{test_date}")
    url = f"{BASE_URL}/salons/{salon_id}/staff-attendance/mark-all-present/{test_date}"
    response = requests.post(url, headers=get_auth_headers())
    
    if response.status_code != 200:
        print_result(False, f"Bulk mark failed: {response.status_code} - {response.text}")
        return False
    
    data = response.json()
    print(f"   Response: {json.dumps(data, indent=2)}")
    
    # Verify response structure
    if "marked" not in data or "skipped" not in data:
        print_result(False, f"Response missing required fields: {data}")
        return False
    
    print_result(True, f"Marked {data['marked']} barbers, skipped {len(data['skipped'])} barbers")
    
    # Verify skipped reasons
    skipped_reasons = {s["barber_id"]: s["reason"] for s in data["skipped"]}
    
    if len(all_barbers) >= 1:
        if barber1_id in skipped_reasons:
            if skipped_reasons[barber1_id] == "after_last_working_day":
                print_result(True, f"Barber 1 correctly skipped with reason 'after_last_working_day'")
            else:
                print_result(False, f"Barber 1 skipped with wrong reason: {skipped_reasons[barber1_id]}")
                return False
        else:
            print_result(False, f"Barber 1 should be skipped but wasn't")
            return False
    
    if len(all_barbers) >= 2:
        if barber2_id in skipped_reasons:
            if skipped_reasons[barber2_id] == "on_leave":
                print_result(True, f"Barber 2 correctly skipped with reason 'on_leave'")
            else:
                print_result(False, f"Barber 2 skipped with wrong reason: {skipped_reasons[barber2_id]}")
                return False
        else:
            print_result(False, f"Barber 2 should be skipped but wasn't")
            return False
    
    # Verify attendance records created for marked barbers
    print(f"\n   Verifying attendance records created")
    month = test_date[:7]
    url = f"{BASE_URL}/salons/{salon_id}/staff-attendance/month/{month}"
    response = requests.get(url, headers=get_auth_headers())
    
    if response.status_code == 200:
        attendance_data = response.json()
        marked_count = 0
        
        for barber_data in attendance_data.get("barbers", []):
            barber_id = barber_data.get("barber_id")
            if barber_id not in skipped_reasons:
                # This barber should have been marked
                for record in barber_data.get("attendance", []):
                    if record.get("date") == test_date and record.get("status") == "present":
                        marked_count += 1
                        break
        
        if marked_count == data["marked"]:
            print_result(True, f"All {marked_count} marked barbers have attendance records with status='present'")
            return True
        else:
            print_result(False, f"Expected {data['marked']} present records, found {marked_count}")
            return False
    else:
        print_result(False, f"Failed to verify attendance: {response.status_code}")
        return False

def test_5_override_validation():
    """Test 5: Override validation for joining date and last working date"""
    print_test_header("Test 5: Override Validation")
    
    # Setup: Set barber with specific doj and last_working_date
    url = f"{BASE_URL}/barbers/{test_barber_id}"
    payload = {
        "doj": "2026-01-15",
        "last_working_date": "2026-04-15",
        "leave_dates": []
    }
    
    print(f"   Setup: Setting barber doj=2026-01-15, last_working_date=2026-04-15")
    response = requests.put(url, json=payload, headers=get_auth_headers())
    
    if response.status_code != 200:
        print_result(False, f"Setup failed: {response.status_code}")
        return False
    
    # Test 5a: Try to mark present before doj (should fail)
    print(f"\n   Test 5a: Try to mark present on 2026-01-10 (before doj) - should fail")
    url = f"{BASE_URL}/salons/{salon_id}/staff-attendance/override/{test_barber_id}/2026-01-10"
    payload = {"status": "present", "note": "Test before doj"}
    
    response = requests.put(url, json=payload, headers=get_auth_headers())
    
    if response.status_code == 400:
        error_detail = response.json().get("detail", "")
        if "joining date" in error_detail.lower():
            print_result(True, f"Correctly rejected with 400: {error_detail}")
        else:
            print_result(False, f"Got 400 but wrong error message: {error_detail}")
            return False
    else:
        print_result(False, f"Expected 400, got {response.status_code}: {response.text}")
        return False
    
    # Test 5b: Try to mark present after last_working_date (should fail)
    print(f"\n   Test 5b: Try to mark present on 2026-04-20 (after last_working_date) - should fail")
    url = f"{BASE_URL}/salons/{salon_id}/staff-attendance/override/{test_barber_id}/2026-04-20"
    payload = {"status": "present", "note": "Test after last working date"}
    
    response = requests.put(url, json=payload, headers=get_auth_headers())
    
    if response.status_code == 400:
        error_detail = response.json().get("detail", "")
        if "last working" in error_detail.lower():
            print_result(True, f"Correctly rejected with 400: {error_detail}")
        else:
            print_result(False, f"Got 400 but wrong error message: {error_detail}")
            return False
    else:
        print_result(False, f"Expected 400, got {response.status_code}: {response.text}")
        return False
    
    # Test 5c: Mark absent before doj (should succeed)
    print(f"\n   Test 5c: Mark absent on 2026-01-10 (before doj) - should succeed")
    url = f"{BASE_URL}/salons/{salon_id}/staff-attendance/override/{test_barber_id}/2026-01-10"
    payload = {"status": "absent", "note": "Test absent before doj"}
    
    response = requests.put(url, json=payload, headers=get_auth_headers())
    
    if response.status_code == 200:
        print_result(True, f"Absent status allowed regardless of doj")
    else:
        print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        return False
    
    # Test 5d: Mark holiday after last_working_date (should succeed)
    print(f"\n   Test 5d: Mark holiday on 2026-04-20 (after last_working_date) - should succeed")
    url = f"{BASE_URL}/salons/{salon_id}/staff-attendance/override/{test_barber_id}/2026-04-20"
    payload = {"status": "holiday", "note": "Test holiday after last working date"}
    
    response = requests.put(url, json=payload, headers=get_auth_headers())
    
    if response.status_code == 200:
        print_result(True, f"Holiday status allowed regardless of last_working_date")
        return True
    else:
        print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        return False

def test_6_customer_view_filter():
    """Test 6: Customer-view filter (available_only=true&customer_view=true)"""
    print_test_header("Test 6: Customer-View Filter")
    
    # Get today's date in IST (same as backend)
    ist = timezone(timedelta(hours=5, minutes=30))
    today = datetime.now(ist).strftime("%Y-%m-%d")
    
    # Setup: Ensure we have at least 2 barbers with different states
    url = f"{BASE_URL}/salons/{salon_id}/barbers"
    response = requests.get(url)
    
    if response.status_code != 200:
        print_result(False, f"Failed to get barbers: {response.status_code}")
        return False
    
    all_barbers = response.json()
    if len(all_barbers) < 2:
        print(f"   Warning: Only {len(all_barbers)} barber(s) available for testing")
    
    # Setup barber 1: is_barber=True, available today
    if len(all_barbers) >= 1:
        barber1_id = all_barbers[0]["id"]
        url = f"{BASE_URL}/barbers/{barber1_id}"
        payload = {
            "is_barber": True,
            "last_working_date": "2026-12-31",
            "leave_dates": [],
            "doj": "2020-01-01"
        }
        
        print(f"\n   Setup: Setting barber 1 ({all_barbers[0]['name']}) as available today")
        response = requests.put(url, json=payload, headers=get_auth_headers())
        
        if response.status_code != 200:
            print_result(False, f"Setup failed: {response.status_code}")
            return False
    
    # Setup barber 2: is_barber=True, on leave today
    if len(all_barbers) >= 2:
        barber2_id = all_barbers[1]["id"]
        url = f"{BASE_URL}/barbers/{barber2_id}"
        payload = {
            "is_barber": True,
            "last_working_date": "2026-12-31",
            "leave_dates": [today],
            "doj": "2020-01-01"
        }
        
        print(f"   Setup: Setting barber 2 ({all_barbers[1]['name']}) on leave today")
        response = requests.put(url, json=payload, headers=get_auth_headers())
        
        if response.status_code != 200:
            print_result(False, f"Setup failed: {response.status_code}")
            return False
    
    # Test: GET with customer_view=true (no date param, defaults to today)
    print(f"\n   Calling GET /barbers?available_only=true&customer_view=true")
    url = f"{BASE_URL}/salons/{salon_id}/barbers?available_only=true&customer_view=true"
    response = requests.get(url)
    
    if response.status_code != 200:
        print_result(False, f"Request failed: {response.status_code} - {response.text}")
        return False
    
    barbers = response.json()
    barber_ids = [b["id"] for b in barbers]
    
    print(f"   Response: {len(barbers)} barber(s) returned")
    
    # Verify all returned barbers have is_barber=True
    all_are_barbers = all(b.get("is_barber") == True for b in barbers)
    if all_are_barbers:
        print_result(True, f"All returned barbers have is_barber=True")
    else:
        print_result(False, f"Some returned barbers have is_barber=False")
        return False
    
    # Verify barber 1 is included
    if len(all_barbers) >= 1:
        if barber1_id in barber_ids:
            print_result(True, f"Barber 1 (available today) correctly included")
        else:
            print_result(False, f"Barber 1 should be included but wasn't")
            return False
    
    # Verify barber 2 is excluded (on leave today)
    if len(all_barbers) >= 2:
        if barber2_id not in barber_ids:
            print_result(True, f"Barber 2 (on leave today) correctly excluded")
            return True
        else:
            print_result(False, f"Barber 2 should be excluded but was included")
            return False
    
    return True

def restore_original_state():
    """Restore barber to original state"""
    print_test_header("Cleanup: Restore Original State")
    
    url = f"{BASE_URL}/barbers/{test_barber_id}"
    payload = {
        "last_working_date": test_barber_original_data["last_working_date"],
        "leave_dates": test_barber_original_data["leave_dates"]
    }
    
    print(f"   Restoring barber to original state: {payload}")
    response = requests.put(url, json=payload, headers=get_auth_headers())
    
    if response.status_code == 200:
        print_result(True, "Barber restored to original state")
    else:
        print_result(False, f"Failed to restore: {response.status_code} - {response.text}")

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("PHASE 1.5 BACKEND TEST SUITE")
    print("Barber Availability & Leave Management")
    print("="*80)
    
    # Login
    if not login_admin():
        print("\n❌ CRITICAL: Admin login failed. Cannot proceed with tests.")
        return
    
    # Get test barber
    if not get_test_barber():
        print("\n❌ CRITICAL: No test barber available. Cannot proceed with tests.")
        return
    
    # Run tests
    results = {}
    
    try:
        results["Test 1: Update barber new fields"] = test_1_update_barber_new_fields()
        results["Test 2: Filtered listing"] = test_2_filtered_listing_last_working_date()
        results["Test 3: Toggle leave date"] = test_3_toggle_leave_date()
        results["Test 4: Bulk mark all present"] = test_4_bulk_mark_all_present()
        results["Test 5: Override validation"] = test_5_override_validation()
        results["Test 6: Customer-view filter"] = test_6_customer_view_filter()
    finally:
        # Always try to restore original state
        restore_original_state()
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\n{'='*80}")
    print(f"TOTAL: {passed}/{total} tests passed")
    print(f"{'='*80}\n")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
