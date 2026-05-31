#!/usr/bin/env python3
"""
Backend Testing Script for Staff Access + Geo Check-in Feature
Tests all 12 scenarios from the review request
"""

import requests
import json
import random
import string
from datetime import datetime

# Configuration
BASE_URL = "https://geofence-attendance-5.preview.emergentagent.com/api"
SALON_ID = "07415cce-f887-4555-a2e2-3f43da54e1aa"
SALON_LAT = 12.9716
SALON_LNG = 77.5946

# Test credentials
ADMIN_IDENTIFIER = "admin"
ADMIN_PASSWORD = "salon123"

# Test results
test_results = []

def log_test(test_num, description, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"{test_num}. {description}: {status}"
    if details:
        result += f"\n   Details: {details}"
    test_results.append({"num": test_num, "desc": description, "passed": passed, "details": details})
    print(result)
    return passed

def random_string(length=6):
    """Generate random string"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def random_mobile():
    """Generate random 10-digit mobile"""
    return ''.join(random.choices(string.digits, k=10))

# ============================================================
# TEST GROUP A — New permission fields + staff_id in login token
# ============================================================

print("\n" + "="*70)
print("TEST GROUP A — New permission fields + staff_id in login token")
print("="*70 + "\n")

# A1. Admin login returns 200; verify the returned `permissions` object now contains all 4 NEW keys
print("A1. Admin login - verify new permission fields...")
try:
    response = requests.post(
        f"{BASE_URL}/salon/users/login",
        json={"identifier": ADMIN_IDENTIFIER, "password": ADMIN_PASSWORD}
    )
    
    if response.status_code == 200:
        data = response.json()
        admin_token = data.get("access_token")
        admin_salon_id = data.get("salon_id")
        permissions = data.get("permissions", {})
        
        # Check all 4 new keys exist
        has_services = "can_access_services" in permissions
        has_gallery = "can_access_gallery" in permissions
        has_staff = "can_access_staff" in permissions
        has_view_all = "can_view_all_staff" in permissions
        
        all_keys_present = has_services and has_gallery and has_staff and has_view_all
        
        # Admin should have all permissions true
        all_true = (permissions.get("can_access_services") == True and
                   permissions.get("can_access_gallery") == True and
                   permissions.get("can_access_staff") == True and
                   permissions.get("can_view_all_staff") == True)
        
        passed = all_keys_present and all_true
        details = f"Status: {response.status_code}, Keys present: {all_keys_present}, All true: {all_true}, Permissions: {permissions}"
        log_test("A1", "Admin login returns 200 with 4 new permission keys (all true)", passed, details)
    else:
        log_test("A1", "Admin login returns 200 with 4 new permission keys (all true)", False, 
                f"Status: {response.status_code}, Response: {response.text}")
        admin_token = None
        admin_salon_id = None
except Exception as e:
    log_test("A1", "Admin login returns 200 with 4 new permission keys (all true)", False, str(e))
    admin_token = None
    admin_salon_id = None

if not admin_token:
    print("\n❌ CRITICAL: Admin login failed. Cannot proceed with tests.")
    exit(1)

# A2. GET /api/salons/{salon_id}/barbers — pick a real barber id
print("\nA2. Get barbers list - pick a real barber ID...")
try:
    response = requests.get(
        f"{BASE_URL}/salons/{SALON_ID}/barbers",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        barbers = response.json()
        if barbers and len(barbers) > 0:
            BARBER_ID = barbers[0]["id"]
            barber_name = barbers[0].get("name", "Unknown")
            passed = True
            details = f"Status: {response.status_code}, Found {len(barbers)} barbers, Using barber: {barber_name} (ID: {BARBER_ID})"
        else:
            passed = False
            details = f"Status: {response.status_code}, No barbers found"
            BARBER_ID = None
    else:
        passed = False
        details = f"Status: {response.status_code}, Response: {response.text}"
        BARBER_ID = None
    
    log_test("A2", "GET /api/salons/{salon_id}/barbers returns barbers", passed, details)
except Exception as e:
    log_test("A2", "GET /api/salons/{salon_id}/barbers returns barbers", False, str(e))
    BARBER_ID = None

if not BARBER_ID:
    print("\n❌ CRITICAL: No barbers found. Cannot proceed with staff creation tests.")
    exit(1)

# A3. Admin creates a staff user with permissions and staff_id
print("\nA3. Admin creates staff user with permissions and staff_id...")
staff_login_id = f"qastaff_{random_string()}"
staff_mobile = random_mobile()
staff_password = "staff123"

try:
    response = requests.post(
        f"{BASE_URL}/salon/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "salon_id": SALON_ID,
            "name": "QA Staff",
            "mobile": staff_mobile,
            "login_id": staff_login_id,
            "password": staff_password,
            "role": "staff",
            "staff_id": BARBER_ID,
            "permissions": {
                "can_access_services": True,
                "can_access_gallery": False,
                "can_access_staff": True,
                "can_view_all_staff": True
            }
        }
    )
    
    if response.status_code in [200, 201]:
        data = response.json()
        staff_user_id = data.get("id")
        returned_perms = data.get("permissions", {})
        returned_staff_id = data.get("staff_id")
        
        # Verify permissions match
        perms_match = (returned_perms.get("can_access_services") == True and
                      returned_perms.get("can_access_gallery") == False and
                      returned_perms.get("can_access_staff") == True and
                      returned_perms.get("can_view_all_staff") == True)
        
        staff_id_match = returned_staff_id == BARBER_ID
        
        passed = perms_match and staff_id_match
        details = f"Status: {response.status_code}, Perms match: {perms_match}, Staff ID match: {staff_id_match}, User ID: {staff_user_id}"
        log_test("A3", "Admin creates staff with permissions and staff_id", passed, details)
    else:
        log_test("A3", "Admin creates staff with permissions and staff_id", False, 
                f"Status: {response.status_code}, Response: {response.text}")
        staff_user_id = None
except Exception as e:
    log_test("A3", "Admin creates staff with permissions and staff_id", False, str(e))
    staff_user_id = None

if not staff_user_id:
    print("\n❌ CRITICAL: Staff user creation failed. Cannot proceed with staff login tests.")
    exit(1)

# A4. Staff login: verify permissions and staff_id in response
print("\nA4. Staff login - verify permissions and staff_id...")
try:
    response = requests.post(
        f"{BASE_URL}/salon/users/login",
        json={"identifier": staff_login_id, "password": staff_password}
    )
    
    if response.status_code == 200:
        data = response.json()
        staff_token = data.get("access_token")
        permissions = data.get("permissions", {})
        returned_staff_id = data.get("staff_id")
        
        # Verify permissions match exactly
        perms_match = (permissions.get("can_access_services") == True and
                      permissions.get("can_access_gallery") == False and
                      permissions.get("can_access_staff") == True and
                      permissions.get("can_view_all_staff") == True)
        
        staff_id_match = returned_staff_id == BARBER_ID
        
        passed = perms_match and staff_id_match
        details = f"Status: {response.status_code}, Perms match: {perms_match}, Staff ID match: {staff_id_match}, staff_id: {returned_staff_id}"
        log_test("A4", "Staff login returns correct permissions and staff_id", passed, details)
    else:
        log_test("A4", "Staff login returns correct permissions and staff_id", False, 
                f"Status: {response.status_code}, Response: {response.text}")
        staff_token = None
except Exception as e:
    log_test("A4", "Staff login returns correct permissions and staff_id", False, str(e))
    staff_token = None

if not staff_token:
    print("\n❌ WARNING: Staff login failed. Some tests may be skipped.")

# A5. PUT /api/salon/users/{staff_user_id} updating permissions
print("\nA5. Update staff permissions - set can_view_all_staff to false...")
try:
    response = requests.put(
        f"{BASE_URL}/salon/users/{staff_user_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "permissions": {
                "can_access_services": True,
                "can_access_gallery": False,
                "can_access_staff": True,
                "can_view_all_staff": False  # Changed to false
            }
        }
    )
    
    if response.status_code == 200:
        # Re-login staff to verify
        login_response = requests.post(
            f"{BASE_URL}/salon/users/login",
            json={"identifier": staff_login_id, "password": staff_password}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            permissions = data.get("permissions", {})
            
            # Verify can_view_all_staff is now false
            view_all_false = permissions.get("can_view_all_staff") == False
            other_perms_unchanged = (permissions.get("can_access_services") == True and
                                    permissions.get("can_access_gallery") == False and
                                    permissions.get("can_access_staff") == True)
            
            passed = view_all_false and other_perms_unchanged
            details = f"Update status: {response.status_code}, Login status: {login_response.status_code}, can_view_all_staff: {permissions.get('can_view_all_staff')}"
            log_test("A5", "Update permissions persists and reflects on re-login", passed, details)
        else:
            log_test("A5", "Update permissions persists and reflects on re-login", False, 
                    f"Re-login failed: {login_response.status_code}")
    else:
        log_test("A5", "Update permissions persists and reflects on re-login", False, 
                f"Update status: {response.status_code}, Response: {response.text}")
except Exception as e:
    log_test("A5", "Update permissions persists and reflects on re-login", False, str(e))

# A6. Create another staff WITHOUT permissions field and without staff_id
print("\nA6. Create staff without permissions field and without staff_id...")
staff2_login_id = f"qastaff2_{random_string()}"
staff2_mobile = random_mobile()
staff2_password = "staff123"

try:
    response = requests.post(
        f"{BASE_URL}/salon/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "salon_id": SALON_ID,
            "name": "QA Staff 2",
            "mobile": staff2_mobile,
            "login_id": staff2_login_id,
            "password": staff2_password,
            "role": "staff"
            # No permissions field, no staff_id
        }
    )
    
    if response.status_code in [200, 201]:
        # Login and verify defaults
        login_response = requests.post(
            f"{BASE_URL}/salon/users/login",
            json={"identifier": staff2_login_id, "password": staff2_password}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            permissions = data.get("permissions", {})
            returned_staff_id = data.get("staff_id")
            
            # All 4 new keys should be false
            all_false = (permissions.get("can_access_services") == False and
                        permissions.get("can_access_gallery") == False and
                        permissions.get("can_access_staff") == False and
                        permissions.get("can_view_all_staff") == False)
            
            staff_id_null = returned_staff_id is None
            
            passed = all_false and staff_id_null
            details = f"Create status: {response.status_code}, Login status: {login_response.status_code}, All perms false: {all_false}, staff_id null: {staff_id_null}"
            log_test("A6", "Staff without permissions defaults all 4 keys to false and staff_id null", passed, details)
        else:
            log_test("A6", "Staff without permissions defaults all 4 keys to false and staff_id null", False, 
                    f"Login failed: {login_response.status_code}")
    else:
        log_test("A6", "Staff without permissions defaults all 4 keys to false and staff_id null", False, 
                f"Create status: {response.status_code}, Response: {response.text}")
except Exception as e:
    log_test("A6", "Staff without permissions defaults all 4 keys to false and staff_id null", False, str(e))

# ============================================================
# TEST GROUP B — Staff Geo Check-in / Check-out
# ============================================================

print("\n" + "="*70)
print("TEST GROUP B — Staff Geo Check-in / Check-out")
print("="*70 + "\n")

# B7. As admin, PUT /api/salons/{salon_id}/attendance-mode
print("B7. Set attendance mode to geo_checkin...")
try:
    response = requests.put(
        f"{BASE_URL}/salons/{SALON_ID}/attendance-mode",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "mode": "geo_checkin",
            "geo_settings": {
                "check_in_radius_meters": 50,
                "max_check_in_time": "10:30",
                "min_daily_minutes": 480,
                "auto_close_at": "23:59",
                "allow_admin_override": True
            }
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        mode = data.get("attendance_mode")
        geo_settings = data.get("geo_settings", {})
        
        mode_correct = mode == "geo_checkin"
        settings_correct = (geo_settings.get("check_in_radius_meters") == 50 and
                          geo_settings.get("max_check_in_time") == "10:30" and
                          geo_settings.get("min_daily_minutes") == 480)
        
        passed = mode_correct and settings_correct
        details = f"Status: {response.status_code}, Mode: {mode}, Settings correct: {settings_correct}"
        log_test("B7", "Set attendance mode to geo_checkin with settings", passed, details)
    else:
        log_test("B7", "Set attendance mode to geo_checkin with settings", False, 
                f"Status: {response.status_code}, Response: {response.text}")
except Exception as e:
    log_test("B7", "Set attendance mode to geo_checkin with settings", False, str(e))

# B8. Using STAFF token, POST check-in at salon location
print("\nB8. Staff self check-in at salon location...")
if staff_token:
    try:
        response = requests.post(
            f"{BASE_URL}/salons/{SALON_ID}/staff-attendance/check-in",
            headers={"Authorization": f"Bearer {staff_token}"},
            json={
                "barber_id": BARBER_ID,
                "latitude": SALON_LAT,
                "longitude": SALON_LNG,
                "method": "self"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            record = data.get("record", {})
            
            has_check_in = record.get("check_in_at") is not None
            status_present = record.get("status") == "present"
            
            passed = has_check_in and status_present
            details = f"Status: {response.status_code}, check_in_at: {record.get('check_in_at')}, status: {record.get('status')}"
            log_test("B8", "Staff self check-in succeeds with status present", passed, details)
        else:
            log_test("B8", "Staff self check-in succeeds with status present", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        log_test("B8", "Staff self check-in succeeds with status present", False, str(e))
else:
    log_test("B8", "Staff self check-in succeeds with status present", False, "Staff token not available")

# B9. Re-POST the same check-in → expect 409
print("\nB9. Re-POST check-in - expect 409 'Already checked in today'...")
if staff_token:
    try:
        response = requests.post(
            f"{BASE_URL}/salons/{SALON_ID}/staff-attendance/check-in",
            headers={"Authorization": f"Bearer {staff_token}"},
            json={
                "barber_id": BARBER_ID,
                "latitude": SALON_LAT,
                "longitude": SALON_LNG,
                "method": "self"
            }
        )
        
        passed = response.status_code == 409
        details = f"Status: {response.status_code}, Response: {response.text[:200]}"
        log_test("B9", "Re-POST check-in returns 409 'Already checked in today'", passed, details)
    except Exception as e:
        log_test("B9", "Re-POST check-in returns 409 'Already checked in today'", False, str(e))
else:
    log_test("B9", "Re-POST check-in returns 409 'Already checked in today'", False, "Staff token not available")

# B10. POST check-out
print("\nB10. Staff self check-out...")
if staff_token:
    try:
        response = requests.post(
            f"{BASE_URL}/salons/{SALON_ID}/staff-attendance/check-out",
            headers={"Authorization": f"Bearer {staff_token}"},
            json={
                "barber_id": BARBER_ID,
                "latitude": SALON_LAT,
                "longitude": SALON_LNG,
                "method": "self"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            record = data.get("record", {})
            
            has_check_out = record.get("check_out_at") is not None
            has_total_minutes = record.get("total_minutes") is not None
            
            passed = has_check_out and has_total_minutes
            details = f"Status: {response.status_code}, check_out_at: {record.get('check_out_at')}, total_minutes: {record.get('total_minutes')}"
            log_test("B10", "Staff self check-out succeeds with total_minutes", passed, details)
        else:
            log_test("B10", "Staff self check-out succeeds with total_minutes", False, 
                    f"Status: {response.status_code}, Response: {response.text}")
    except Exception as e:
        log_test("B10", "Staff self check-out succeeds with total_minutes", False, str(e))
else:
    log_test("B10", "Staff self check-out succeeds with total_minutes", False, "Staff token not available")

# B11. GET attendance for current month
print("\nB11. GET attendance for current month - verify computed_under_mode...")
current_month = datetime.now().strftime("%Y-%m")
try:
    response = requests.get(
        f"{BASE_URL}/salons/{SALON_ID}/staff-attendance/month/{current_month}",
        headers={"Authorization": f"Bearer {admin_token}"},
        params={"barber_id": BARBER_ID}
    )
    
    if response.status_code == 200:
        data = response.json()
        
        # Find today's record
        today = datetime.now().strftime("%Y-%m-%d")
        today_record = None
        
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and "attendance" in item:
                    for att in item["attendance"]:
                        if att.get("date") == today:
                            today_record = att
                            break
        
        if today_record:
            computed_mode = today_record.get("computed_under_mode")
            passed = computed_mode == "geo_checkin"
            details = f"Status: {response.status_code}, computed_under_mode: {computed_mode}"
            log_test("B11", "Today's attendance has computed_under_mode='geo_checkin'", passed, details)
        else:
            log_test("B11", "Today's attendance has computed_under_mode='geo_checkin'", False, 
                    f"Status: {response.status_code}, Today's record not found in response")
    else:
        log_test("B11", "Today's attendance has computed_under_mode='geo_checkin'", False, 
                f"Status: {response.status_code}, Response: {response.text}")
except Exception as e:
    log_test("B11", "Today's attendance has computed_under_mode='geo_checkin'", False, str(e))

# B12. BLOCKED-OUTSIDE-FENCE test
print("\nB12. Test geo-fence blocking - check-in from far location...")
# We need a fresh barber or to test with a different staff member
# Let's create a new staff user linked to a different barber (if available)

# First, get another barber
try:
    response = requests.get(
        f"{BASE_URL}/salons/{SALON_ID}/barbers",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        barbers = response.json()
        # Find a barber different from BARBER_ID
        other_barber = None
        for b in barbers:
            if b["id"] != BARBER_ID:
                other_barber = b
                break
        
        if other_barber:
            OTHER_BARBER_ID = other_barber["id"]
            
            # Create a new staff user for this barber
            staff3_login_id = f"qastaff3_{random_string()}"
            staff3_mobile = random_mobile()
            staff3_password = "staff123"
            
            create_response = requests.post(
                f"{BASE_URL}/salon/users",
                headers={"Authorization": f"Bearer {admin_token}"},
                json={
                    "salon_id": SALON_ID,
                    "name": "QA Staff 3",
                    "mobile": staff3_mobile,
                    "login_id": staff3_login_id,
                    "password": staff3_password,
                    "role": "staff",
                    "staff_id": OTHER_BARBER_ID,
                    "permissions": {
                        "can_access_services": True,
                        "can_access_gallery": False,
                        "can_access_staff": True,
                        "can_view_all_staff": False
                    }
                }
            )
            
            if create_response.status_code in [200, 201]:
                # Login as this staff
                login_response = requests.post(
                    f"{BASE_URL}/salon/users/login",
                    json={"identifier": staff3_login_id, "password": staff3_password}
                )
                
                if login_response.status_code == 200:
                    staff3_token = login_response.json().get("access_token")
                    
                    # Try to check-in from far location (13.9, 78.9)
                    checkin_response = requests.post(
                        f"{BASE_URL}/salons/{SALON_ID}/staff-attendance/check-in",
                        headers={"Authorization": f"Bearer {staff3_token}"},
                        json={
                            "barber_id": OTHER_BARBER_ID,
                            "latitude": 13.9,
                            "longitude": 78.9,
                            "method": "self"
                        }
                    )
                    
                    # Should get 409 with distance/geo-fence message
                    passed = checkin_response.status_code == 409
                    response_text = checkin_response.text
                    has_distance_msg = "distance" in response_text.lower() or "geo" in response_text.lower() or "fence" in response_text.lower()
                    
                    passed = passed and has_distance_msg
                    details = f"Status: {checkin_response.status_code}, Response: {response_text[:200]}"
                    log_test("B12", "Check-in from far location blocked with 409 and distance message", passed, details)
                else:
                    log_test("B12", "Check-in from far location blocked with 409 and distance message", False, 
                            f"Staff3 login failed: {login_response.status_code}")
            else:
                log_test("B12", "Check-in from far location blocked with 409 and distance message", False, 
                        f"Staff3 creation failed: {create_response.status_code}")
        else:
            # Only one barber available, use the same barber but need to clear today's attendance
            # Since we can't delete via API, we'll document this limitation
            log_test("B12", "Check-in from far location blocked with 409 and distance message", False, 
                    "Only one barber available and already checked in today. Cannot test geo-fence blocking without API to delete attendance.")
    else:
        log_test("B12", "Check-in from far location blocked with 409 and distance message", False, 
                f"Failed to get barbers: {response.status_code}")
except Exception as e:
    log_test("B12", "Check-in from far location blocked with 409 and distance message", False, str(e))

# ============================================================
# SUMMARY
# ============================================================

print("\n" + "="*70)
print("TEST SUMMARY")
print("="*70 + "\n")

passed_count = sum(1 for r in test_results if r["passed"])
total_count = len(test_results)
pass_rate = (passed_count / total_count * 100) if total_count > 0 else 0

print(f"Total Tests: {total_count}")
print(f"Passed: {passed_count}")
print(f"Failed: {total_count - passed_count}")
print(f"Pass Rate: {pass_rate:.1f}%\n")

print("DETAILED RESULTS:\n")

# Group A results
print("TEST GROUP A — New permission fields + staff_id in login token:")
for r in test_results:
    if r["num"].startswith("A"):
        status = "✅ PASS" if r["passed"] else "❌ FAIL"
        print(f"  {r['num']}. {r['desc']}: {status}")

print("\nTEST GROUP B — Staff Geo Check-in / Check-out:")
for r in test_results:
    if r["num"].startswith("B"):
        status = "✅ PASS" if r["passed"] else "❌ FAIL"
        print(f"  {r['num']}. {r['desc']}: {status}")

# Failed tests details
failed_tests = [r for r in test_results if not r["passed"]]
if failed_tests:
    print("\n" + "="*70)
    print("FAILED TESTS DETAILS")
    print("="*70 + "\n")
    for r in failed_tests:
        print(f"{r['num']}. {r['desc']}")
        print(f"   Details: {r['details']}\n")

print("\n" + "="*70)
print("END OF TESTING")
print("="*70)
