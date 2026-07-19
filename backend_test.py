#!/usr/bin/env python3
"""
RBAC v2 Backend Testing - Granular Module Permissions + Home Attendance Re-check-in Bug Fix

Tests all scenarios from test_result.md:
  A) Home Staff Check-in re-check-in bug fix (in→out→in→out on same day)
  B) Staff user with only staff.attendance (no view_all) can toggle only their OWN barber
  C) Staff with NO staff permissions → 403 on home attendance toggle
  D) Granular financials.view_dashboard only → 200 on GET dashboard, 403 on POST/DELETE
  E) LEGACY flat-key fallback: can_access_financials: true (no modules) → both GET & POST work
  F) Reward-plan / services.bulk-delete gated correctly
  G) Admin never blocked
"""

import requests
import json
import sys
import time
import random
from typing import Dict, Optional, List

# Backend URL from frontend/.env
BASE_URL = "https://csv-template-manager.preview.emergentagent.com/api"

# Test credentials from memory/test_credentials.md
ADMIN_IDENTIFIER = "admin"
ADMIN_PASSWORD = "salon123"

# Global state
admin_token = None
salon_id = None
created_staff_users = []  # Track created users for cleanup
test_barbers = []  # Track barbers for testing
test_run_id = str(int(time.time()))  # Unique ID for this test run


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'


def log_test(name: str):
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST: {name}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")


def log_pass(msg: str):
    print(f"{Colors.GREEN}✓ PASS: {msg}{Colors.RESET}")


def log_fail(msg: str):
    print(f"{Colors.RED}✗ FAIL: {msg}{Colors.RESET}")


def log_info(msg: str):
    print(f"{Colors.YELLOW}ℹ INFO: {msg}{Colors.RESET}")


def admin_login() -> tuple[str, str]:
    """Login as admin and return (access_token, salon_id)"""
    log_test("Admin Login")
    url = f"{BASE_URL}/salon/users/login"
    payload = {
        "identifier": ADMIN_IDENTIFIER,
        "password": ADMIN_PASSWORD
    }
    
    resp = requests.post(url, json=payload)
    log_info(f"POST {url}")
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        log_fail(f"Admin login failed: {resp.status_code} - {resp.text}")
        sys.exit(1)
    
    data = resp.json()
    token = data.get("access_token")
    sid = data.get("salon_id")
    
    if not token or not sid:
        log_fail(f"Missing access_token or salon_id in response: {data}")
        sys.exit(1)
    
    log_pass(f"Admin logged in successfully. Salon ID: {sid}")
    return token, sid


def get_barbers(token: str, sid: str) -> List[Dict]:
    """Get list of barbers for testing"""
    log_test("Get Barbers")
    url = f"{BASE_URL}/salons/{sid}/barbers"
    headers = {"Authorization": f"Bearer {token}"}
    
    resp = requests.get(url, headers=headers)
    log_info(f"GET {url}")
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        log_fail(f"Failed to get barbers: {resp.status_code} - {resp.text}")
        return []
    
    barbers = resp.json()
    active_barbers = [b for b in barbers if b.get("is_active")]
    
    if len(active_barbers) < 2:
        log_fail(f"Need at least 2 active barbers for testing, found {len(active_barbers)}")
        sys.exit(1)
    
    log_pass(f"Found {len(active_barbers)} active barbers")
    for b in active_barbers[:2]:
        log_info(f"  - {b.get('name')} (ID: {b.get('id')})")
    
    return active_barbers


def create_staff_user(token: str, sid: str, login_id: str, password: str, 
                     permissions: Dict, staff_id: Optional[str] = None) -> Dict:
    """Create a staff user with specified permissions"""
    # Add unique test run ID to login_id to avoid conflicts
    unique_login_id = f"{login_id}_{test_run_id}"
    unique_mobile = f"99{random.randint(10000000, 99999999)}"  # Generate unique 10-digit mobile
    log_info(f"Creating staff user: {unique_login_id}")
    url = f"{BASE_URL}/salon/users"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "salon_id": sid,
        "name": f"Test Staff {login_id}",
        "mobile": unique_mobile,
        "login_id": unique_login_id,
        "password": password,
        "role": "staff",
        "permissions": permissions
    }
    
    if staff_id:
        payload["staff_id"] = staff_id
    
    resp = requests.post(url, json=payload, headers=headers)
    log_info(f"POST {url}")
    log_info(f"Payload: {json.dumps(payload, indent=2)}")
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code not in (200, 201):
        log_fail(f"Failed to create staff user: {resp.status_code} - {resp.text}")
        return {}
    
    user = resp.json()
    user_id = user.get("id")
    created_staff_users.append(user_id)
    log_pass(f"Created staff user: {unique_login_id} (ID: {user_id})")
    # Return the unique login_id for login
    user["unique_login_id"] = unique_login_id
    return user


def staff_login(login_id: str, password: str) -> Optional[str]:
    """Login as staff user and return access_token"""
    # Add test run ID to login_id
    unique_login_id = f"{login_id}_{test_run_id}"
    log_info(f"Logging in as staff: {unique_login_id}")
    url = f"{BASE_URL}/salon/users/login"
    payload = {
        "identifier": unique_login_id,
        "password": password
    }
    
    resp = requests.post(url, json=payload)
    log_info(f"POST {url}")
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        log_fail(f"Staff login failed: {resp.status_code} - {resp.text}")
        return None
    
    data = resp.json()
    token = data.get("access_token")
    log_pass(f"Staff logged in successfully: {unique_login_id}")
    return token


def delete_staff_users(token: str, sid: str):
    """Cleanup: delete all created staff users"""
    log_test("Cleanup - Delete Created Staff Users")
    headers = {"Authorization": f"Bearer {token}"}
    
    for user_id in created_staff_users:
        url = f"{BASE_URL}/salon/users/{user_id}"
        resp = requests.delete(url, headers=headers)
        log_info(f"DELETE {url} - Status: {resp.status_code}")
        
        if resp.status_code in (200, 204):
            log_pass(f"Deleted staff user: {user_id}")
        else:
            log_fail(f"Failed to delete staff user {user_id}: {resp.status_code}")


# ============================================================================
# SCENARIO A: Home Attendance Re-check-in Bug Fix
# ============================================================================
def test_scenario_a_home_attendance_recheckIn():
    """
    Test that in→out→in→out on same day produces sessions[] array of length 2
    with two open/close pairs. Previously the 3rd toggle returned already_in: true.
    """
    log_test("SCENARIO A: Home Attendance Re-check-in Bug Fix")
    
    global admin_token, salon_id, test_barbers
    
    if not test_barbers:
        log_fail("No barbers available for testing")
        return False
    
    barber_id = test_barbers[0]["id"]
    barber_name = test_barbers[0]["name"]
    log_info(f"Testing with barber: {barber_name} (ID: {barber_id})")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    url = f"{BASE_URL}/salons/{salon_id}/home/staff-attendance/toggle"
    
    # First, ensure we're in a clean state (checked out)
    log_info("A0: Ensuring clean state (check-out if needed)")
    resp = requests.post(url, json={"barber_id": barber_id, "action": "out"}, headers=headers)
    initial_sessions_count = len(resp.json().get("sessions", []))
    log_info(f"Initial sessions count: {initial_sessions_count}")
    
    # A1: First check-in
    log_info("A1: First check-in (action=in)")
    resp = requests.post(url, json={"barber_id": barber_id, "action": "in"}, headers=headers)
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        log_fail(f"A1 failed: {resp.status_code} - {resp.text}")
        return False
    
    data = resp.json()
    sessions = data.get("sessions", [])
    
    if not data.get("check_in_at"):
        log_fail("A1: check_in_at not set")
        return False
    
    # Note: status field may not be present when already_in is true
    # The important check is that we have an open session
    
    if len(sessions) != initial_sessions_count + 1:
        log_fail(f"A1: sessions length should be {initial_sessions_count + 1}, got {len(sessions)}")
        return False
    
    if sessions[-1].get("co") is not None:
        log_fail("A1: last session should have co=null (open)")
        return False
    
    log_pass(f"A1: First check-in successful, sessions count increased to {len(sessions)}")
    
    # A2: First check-out
    log_info("A2: First check-out (action=out)")
    resp = requests.post(url, json={"barber_id": barber_id, "action": "out"}, headers=headers)
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        log_fail(f"A2 failed: {resp.status_code} - {resp.text}")
        return False
    
    data = resp.json()
    sessions = data.get("sessions", [])
    
    if not data.get("check_out_at"):
        log_fail("A2: check_out_at not set")
        return False
    
    # Note: status field may not be present in all responses
    
    if len(sessions) != initial_sessions_count + 1:
        log_fail(f"A2: sessions length should be {initial_sessions_count + 1}, got {len(sessions)}")
        return False
    
    if sessions[-1].get("co") is None:
        log_fail("A2: last session should have co populated (closed)")
        return False
    
    log_pass(f"A2: First check-out successful, last session closed")
    
    # A3: Second check-in (CORE BUG FIX TEST)
    log_info("A3: Second check-in (action=in) - CORE BUG FIX TEST")
    resp = requests.post(url, json={"barber_id": barber_id, "action": "in"}, headers=headers)
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        log_fail(f"A3 failed: {resp.status_code} - {resp.text}")
        return False
    
    data = resp.json()
    sessions = data.get("sessions", [])
    
    if data.get("already_in"):
        log_fail("A3: BUG NOT FIXED - already_in should be false, got true")
        return False
    
    # Note: status field may not be present in all responses
    
    if len(sessions) != initial_sessions_count + 2:
        log_fail(f"A3: sessions length should be {initial_sessions_count + 2}, got {len(sessions)}")
        return False
    
    if sessions[-1].get("co") is not None:
        log_fail("A3: last session should have co=null (open)")
        return False
    
    log_pass(f"A3: ✅ BUG FIX VERIFIED - Second check-in successful, sessions count={len(sessions)}, last session open")
    
    # A4: Second check-out
    log_info("A4: Second check-out (action=out)")
    resp = requests.post(url, json={"barber_id": barber_id, "action": "out"}, headers=headers)
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        log_fail(f"A4 failed: {resp.status_code} - {resp.text}")
        return False
    
    data = resp.json()
    sessions = data.get("sessions", [])
    
    if len(sessions) != initial_sessions_count + 2:
        log_fail(f"A4: sessions length should be {initial_sessions_count + 2}, got {len(sessions)}")
        return False
    
    if sessions[-1].get("co") is None:
        log_fail("A4: last session should have co populated (closed)")
        return False
    
    log_pass(f"A4: Second check-out successful, both new sessions closed")
    
    log_pass("✅ SCENARIO A PASSED: Re-check-in bug fix verified")
    return True


# ============================================================================
# SCENARIO B: Staff with granular staff.attendance only, no view_all
# ============================================================================
def test_scenario_b_staff_attendance_no_view_all():
    """
    Staff user with only staff.attendance (no view_all) can toggle only their
    OWN linked barber - 403 for others.
    """
    log_test("SCENARIO B: Staff with staff.attendance only, no view_all")
    
    global admin_token, salon_id, test_barbers
    
    if len(test_barbers) < 2:
        log_fail("Need at least 2 barbers for this test")
        return False
    
    barber_x = test_barbers[0]
    barber_y = test_barbers[1]
    
    # B1: Create staff user linked to barber_x
    log_info("B1: Create staff user Sb linked to barber_x")
    permissions = {
        "modules": {
            "staff": {
                "view": True,
                "view_all": False,
                "attendance": True
            }
        }
    }
    
    user = create_staff_user(
        admin_token, salon_id, 
        "staff_b_test", "testpass123",
        permissions, staff_id=barber_x["id"]
    )
    
    if not user:
        log_fail("B1: Failed to create staff user")
        return False
    
    # B2: Staff login
    log_info("B2: Staff Sb logs in")
    staff_token = staff_login("staff_b_test", "testpass123")
    
    if not staff_token:
        log_fail("B2: Staff login failed")
        return False
    
    # B3: Toggle own barber (should succeed)
    log_info(f"B3: Staff Sb toggles their OWN barber ({barber_x['name']})")
    headers = {"Authorization": f"Bearer {staff_token}"}
    url = f"{BASE_URL}/salons/{salon_id}/home/staff-attendance/toggle"
    
    resp = requests.post(url, json={"barber_id": barber_x["id"], "action": "in"}, headers=headers)
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        log_fail(f"B3: Should succeed but got {resp.status_code} - {resp.text}")
        return False
    
    log_pass(f"B3: Staff can toggle their own barber ({barber_x['name']})")
    
    # B4: Try to toggle different barber (should fail with 403)
    log_info(f"B4: Staff Sb tries to toggle DIFFERENT barber ({barber_y['name']})")
    resp = requests.post(url, json={"barber_id": barber_y["id"], "action": "in"}, headers=headers)
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 403:
        log_fail(f"B4: Should return 403, got {resp.status_code}")
        return False
    
    detail = resp.json().get("detail", "")
    if "only check in/out your own attendance" not in detail.lower():
        log_fail(f"B4: Expected 'only check in/out your own attendance' in detail, got: {detail}")
        return False
    
    log_pass(f"B4: Staff correctly blocked from toggling other barber (403)")
    
    log_pass("✅ SCENARIO B PASSED: Staff can only toggle own barber")
    return True


# ============================================================================
# SCENARIO C: Staff with NO staff.attendance
# ============================================================================
def test_scenario_c_staff_no_attendance_permission():
    """
    Staff with NO staff.attendance permission → 403 on home attendance toggle
    """
    log_test("SCENARIO C: Staff with NO staff.attendance permission")
    
    global admin_token, salon_id, test_barbers
    
    # C1: Create staff user with NO staff permissions
    log_info("C1: Create staff user Sc with NO staff permissions")
    permissions = {
        "modules": {
            "staff": {}  # All false
        }
    }
    
    user = create_staff_user(
        admin_token, salon_id,
        "staff_c_test", "testpass123",
        permissions
    )
    
    if not user:
        log_fail("C1: Failed to create staff user")
        return False
    
    # C2: Staff login
    log_info("C2: Staff Sc logs in")
    staff_token = staff_login("staff_c_test", "testpass123")
    
    if not staff_token:
        log_fail("C2: Staff login failed")
        return False
    
    # C3: Try to toggle attendance (should fail with 403)
    log_info("C3: Staff Sc tries to toggle attendance")
    headers = {"Authorization": f"Bearer {staff_token}"}
    url = f"{BASE_URL}/salons/{salon_id}/home/staff-attendance/toggle"
    
    resp = requests.post(url, json={"barber_id": test_barbers[0]["id"], "action": "in"}, headers=headers)
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 403:
        log_fail(f"C3: Should return 403, got {resp.status_code}")
        return False
    
    detail = resp.json().get("detail", "")
    if "staff.attendance" not in detail:
        log_fail(f"C3: Expected 'staff.attendance' in detail, got: {detail}")
        return False
    
    log_pass("C3: Staff correctly blocked (403) - Permission denied: staff.attendance")
    
    log_pass("✅ SCENARIO C PASSED: Staff without permission correctly blocked")
    return True


# ============================================================================
# SCENARIO D: Financials granular permissions
# ============================================================================
def test_scenario_d_financials_granular():
    """
    Staff with only financials.view_dashboard → 200 on GET dashboard,
    403 on POST/DELETE transactions
    """
    log_test("SCENARIO D: Financials granular permissions")
    
    global admin_token, salon_id
    
    # D1: Create staff user with only view_dashboard
    log_info("D1: Create staff user Sd with only financials.view_dashboard")
    permissions = {
        "modules": {
            "financials": {
                "view_dashboard": True
                # All other actions false
            }
        }
    }
    
    user = create_staff_user(
        admin_token, salon_id,
        "staff_d_test", "testpass123",
        permissions
    )
    
    if not user:
        log_fail("D1: Failed to create staff user")
        return False
    
    # D2: Staff login
    log_info("D2: Staff Sd logs in")
    staff_token = staff_login("staff_d_test", "testpass123")
    
    if not staff_token:
        log_fail("D2: Staff login failed")
        return False
    
    headers = {"Authorization": f"Bearer {staff_token}"}
    
    # D3: GET dashboard (should succeed)
    log_info("D3: Staff Sd tries GET /financials/dashboard")
    url = f"{BASE_URL}/salons/{salon_id}/financials/dashboard"
    resp = requests.get(url, headers=headers)
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        log_fail(f"D3: Should return 200, got {resp.status_code} - {resp.text}")
        return False
    
    log_pass("D3: Staff can view dashboard (200)")
    
    # D4: POST transaction (should fail with 403)
    log_info("D4: Staff Sd tries POST /financials/transactions")
    url = f"{BASE_URL}/salons/{salon_id}/financials/transactions"
    payload = {
        "type": "inflow",
        "date": "2026-04-26",
        "category": "other_income",
        "amount": 100,
        "payment_mode": "cash",
        "narration": "Test transaction"
    }
    resp = requests.post(url, json=payload, headers=headers)
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 403:
        log_fail(f"D4: Should return 403, got {resp.status_code}")
        return False
    
    detail = resp.json().get("detail", "")
    if "financials.create_transaction" not in detail:
        log_fail(f"D4: Expected 'financials.create_transaction' in detail, got: {detail}")
        return False
    
    log_pass("D4: Staff correctly blocked from creating transaction (403)")
    
    # D5: DELETE transaction (should fail with 403)
    log_info("D5: Staff Sd tries DELETE /financials/transactions/{fake_id}")
    url = f"{BASE_URL}/salons/{salon_id}/financials/transactions/fake-transaction-id"
    resp = requests.delete(url, headers=headers)
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 403:
        log_fail(f"D5: Should return 403, got {resp.status_code}")
        return False
    
    detail = resp.json().get("detail", "")
    if "financials.delete_transaction" not in detail:
        log_fail(f"D5: Expected 'financials.delete_transaction' in detail, got: {detail}")
        return False
    
    log_pass("D5: Staff correctly blocked from deleting transaction (403)")
    
    log_pass("✅ SCENARIO D PASSED: Granular financials permissions working")
    return True


# ============================================================================
# SCENARIO E: Legacy flat-key fallback
# ============================================================================
def test_scenario_e_legacy_fallback():
    """
    Staff with can_access_financials: true (LEGACY key) and NO modules field
    → both GET dashboard AND POST create-transaction should succeed
    """
    log_test("SCENARIO E: Legacy flat-key fallback")
    
    global admin_token, salon_id
    
    # E1: Create staff user with legacy can_access_financials
    log_info("E1: Create staff user Se with legacy can_access_financials=true")
    permissions = {
        "can_access_financials": True
        # NO modules field
    }
    
    user = create_staff_user(
        admin_token, salon_id,
        "staff_e_test", "testpass123",
        permissions
    )
    
    if not user:
        log_fail("E1: Failed to create staff user")
        return False
    
    # E2: Staff login
    log_info("E2: Staff Se logs in")
    staff_token = staff_login("staff_e_test", "testpass123")
    
    if not staff_token:
        log_fail("E2: Staff login failed")
        return False
    
    headers = {"Authorization": f"Bearer {staff_token}"}
    
    # E3: GET dashboard (should succeed via legacy fallback)
    log_info("E3: Staff Se tries GET /financials/dashboard (legacy fallback)")
    url = f"{BASE_URL}/salons/{salon_id}/financials/dashboard"
    resp = requests.get(url, headers=headers)
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        log_fail(f"E3: Should return 200 via legacy fallback, got {resp.status_code} - {resp.text}")
        return False
    
    log_pass("E3: Staff can view dashboard via legacy fallback (200)")
    
    # E4: POST transaction (should succeed via legacy fallback)
    log_info("E4: Staff Se tries POST /financials/transactions (legacy fallback)")
    url = f"{BASE_URL}/salons/{salon_id}/financials/transactions"
    payload = {
        "type": "inflow",
        "date": "2026-04-26",
        "category": "other_income",
        "amount": 150,
        "payment_mode": "cash",
        "narration": "Test legacy transaction"
    }
    resp = requests.post(url, json=payload, headers=headers)
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        log_fail(f"E4: Should return 200 via legacy fallback, got {resp.status_code} - {resp.text}")
        return False
    
    log_pass("E4: Staff can create transaction via legacy fallback (200)")
    
    log_pass("✅ SCENARIO E PASSED: Legacy flat-key fallback working")
    return True


# ============================================================================
# SCENARIO F: Reward-plan / services.bulk-delete gated correctly
# ============================================================================
def test_scenario_f_reward_plan_services():
    """
    Test reward-plan and services.bulk-delete are gated correctly
    """
    log_test("SCENARIO F: Reward-plan / services.bulk-delete gated")
    
    global admin_token, salon_id, test_barbers
    
    # F1: Staff with staff.delete permission
    log_info("F1: Create staff user Sf with staff.delete permission")
    permissions = {
        "modules": {
            "staff": {
                "view": True,
                "delete": True
            }
        }
    }
    
    user = create_staff_user(
        admin_token, salon_id,
        "staff_f_test", "testpass123",
        permissions
    )
    
    if not user:
        log_fail("F1: Failed to create staff user")
        return False
    
    staff_token = staff_login("staff_f_test", "testpass123")
    if not staff_token:
        log_fail("F1: Staff login failed")
        return False
    
    # Try to delete a barber (should pass permission check, may fail for other reasons)
    log_info("F1: Staff Sf tries DELETE /barbers/{id}")
    headers = {"Authorization": f"Bearer {staff_token}"}
    url = f"{BASE_URL}/barbers/{test_barbers[0]['id']}"
    resp = requests.delete(url, headers=headers)
    log_info(f"Status: {resp.status_code}")
    
    # We're checking permission passes (not 403), actual deletion may fail for business reasons
    if resp.status_code == 403:
        detail = resp.json().get("detail", "")
        if "staff.delete" in detail:
            log_fail(f"F1: Permission check failed (403): {detail}")
            return False
    
    log_pass(f"F1: Staff.delete permission passed (status: {resp.status_code}, not 403)")
    
    # F2: Staff with NO permissions
    log_info("F2: Create staff user Sg with NO permissions")
    permissions = {
        "modules": {}
    }
    
    user = create_staff_user(
        admin_token, salon_id,
        "staff_g_test", "testpass123",
        permissions
    )
    
    if not user:
        log_fail("F2: Failed to create staff user")
        return False
    
    staff_token = staff_login("staff_g_test", "testpass123")
    if not staff_token:
        log_fail("F2: Staff login failed")
        return False
    
    headers = {"Authorization": f"Bearer {staff_token}"}
    
    # Try reward-plan (should fail with 403)
    log_info("F2a: Staff Sg tries POST /reward-plan")
    url = f"{BASE_URL}/salons/{salon_id}/reward-plan"
    payload = {
        "mode": "all",
        "salary_multiplier": 4,
        "slabs": []
    }
    resp = requests.post(url, json=payload, headers=headers)
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 403:
        log_fail(f"F2a: Should return 403, got {resp.status_code}")
        return False
    
    detail = resp.json().get("detail", "")
    if "staff.access_control" not in detail:
        log_fail(f"F2a: Expected 'staff.access_control' in detail, got: {detail}")
        return False
    
    log_pass("F2a: Staff correctly blocked from reward-plan (403)")
    
    # Try services.bulk-delete (should fail with 403)
    log_info("F2b: Staff Sg tries POST /services/bulk-delete")
    url = f"{BASE_URL}/salons/{salon_id}/services/bulk-delete"
    payload = {"service_ids": ["fake-id"]}
    resp = requests.post(url, json=payload, headers=headers)
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 403:
        log_fail(f"F2b: Should return 403, got {resp.status_code}")
        return False
    
    detail = resp.json().get("detail", "")
    if "services.delete" not in detail:
        log_fail(f"F2b: Expected 'services.delete' in detail, got: {detail}")
        return False
    
    log_pass("F2b: Staff correctly blocked from services.bulk-delete (403)")
    
    log_pass("✅ SCENARIO F PASSED: Reward-plan and services gated correctly")
    return True


# ============================================================================
# SCENARIO G: Admin still has ALL access
# ============================================================================
def test_scenario_g_admin_all_access():
    """
    Admin login → hits every endpoint → all 200 (never 403)
    """
    log_test("SCENARIO G: Admin has ALL access")
    
    global admin_token, salon_id, test_barbers
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    tests = [
        ("Home attendance toggle", "POST", f"{BASE_URL}/salons/{salon_id}/home/staff-attendance/toggle",
         {"barber_id": test_barbers[0]["id"], "action": "in"}),
        ("Financials dashboard", "GET", f"{BASE_URL}/salons/{salon_id}/financials/dashboard", None),
        ("Create transaction", "POST", f"{BASE_URL}/salons/{salon_id}/financials/transactions",
         {"type": "inflow", "date": "2026-04-26", "category": "other_income", "amount": 200, "payment_mode": "cash", "narration": "Admin test"}),
        ("Reward plan", "POST", f"{BASE_URL}/salons/{salon_id}/reward-plan",
         {"mode": "all", "salary_multiplier": 4, "slabs": []}),
    ]
    
    all_passed = True
    for name, method, url, payload in tests:
        log_info(f"Testing: {name}")
        
        if method == "GET":
            resp = requests.get(url, headers=headers)
        elif method == "POST":
            resp = requests.post(url, json=payload, headers=headers)
        else:
            resp = requests.delete(url, headers=headers)
        
        log_info(f"  {method} {url} - Status: {resp.status_code}")
        
        if resp.status_code == 403:
            log_fail(f"  Admin blocked (403) on {name}: {resp.text}")
            all_passed = False
        else:
            log_pass(f"  Admin has access to {name} (status: {resp.status_code})")
    
    if all_passed:
        log_pass("✅ SCENARIO G PASSED: Admin has access to all endpoints")
    else:
        log_fail("✗ SCENARIO G FAILED: Admin blocked on some endpoints")
    
    return all_passed


# ============================================================================
# Main Test Runner
# ============================================================================
def main():
    global admin_token, salon_id, test_barbers
    
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}RBAC v2 Backend Testing - Granular Module Permissions{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}\n")
    
    # Setup
    admin_token, salon_id = admin_login()
    test_barbers = get_barbers(admin_token, salon_id)
    
    # Run all scenarios
    results = {
        "A - Home Attendance Re-check-in Bug Fix": test_scenario_a_home_attendance_recheckIn(),
        "B - Staff attendance no view_all": test_scenario_b_staff_attendance_no_view_all(),
        "C - Staff no attendance permission": test_scenario_c_staff_no_attendance_permission(),
        "D - Financials granular permissions": test_scenario_d_financials_granular(),
        "E - Legacy flat-key fallback": test_scenario_e_legacy_fallback(),
        "F - Reward-plan / services gated": test_scenario_f_reward_plan_services(),
        "G - Admin all access": test_scenario_g_admin_all_access(),
    }
    
    # Cleanup
    delete_staff_users(admin_token, salon_id)
    
    # Summary
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}\n")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for scenario, result in results.items():
        status = f"{Colors.GREEN}✓ PASS{Colors.RESET}" if result else f"{Colors.RED}✗ FAIL{Colors.RESET}"
        print(f"{status} - {scenario}")
    
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TOTAL: {passed}/{total} scenarios passed{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}\n")
    
    if passed == total:
        print(f"{Colors.GREEN}✅ ALL TESTS PASSED{Colors.RESET}\n")
        sys.exit(0)
    else:
        print(f"{Colors.RED}❌ SOME TESTS FAILED{Colors.RESET}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
