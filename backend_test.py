#!/usr/bin/env python3
"""
Backend Test Suite for Home v2 Endpoints
Tests the new Home v2 backend endpoints as per review request.
"""

import requests
import json
import random
import string
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://test-salon-login.preview.emergentagent.com/api"
ADMIN_IDENTIFIER = "admin"
ADMIN_PASSWORD = "salon123"

# Test state
access_token = None
salon_id = None
test_customer_phone = None

def log_test(test_name, status, details=""):
    """Log test results"""
    symbol = "✅" if status == "PASS" else "❌"
    print(f"\n{symbol} {test_name}: {status}")
    if details:
        print(f"   {details}")

def truncate_response(response_text, max_length=400):
    """Truncate long response bodies"""
    if len(response_text) > max_length:
        return response_text[:max_length] + "... [truncated]"
    return response_text

def random_string(length=6):
    """Generate random string for test data"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

def random_phone():
    """Generate random 10-digit phone number"""
    return "98987" + ''.join(random.choices(string.digits, k=5))

# ============================================================================
# AUTH
# ============================================================================

def test_auth():
    """Test: Auth - POST /api/salon/users/login"""
    global access_token, salon_id
    
    print("\n" + "="*80)
    print("AUTH TEST")
    print("="*80)
    
    url = f"{BASE_URL}/salon/users/login"
    payload = {
        "identifier": ADMIN_IDENTIFIER,
        "password": ADMIN_PASSWORD
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status: {response.status_code}")
        print(f"Response: {truncate_response(response.text)}")
        
        if response.status_code == 200:
            data = response.json()
            access_token = data.get("access_token")
            salon_id = data.get("salon_id")
            
            if access_token and salon_id:
                log_test("AUTH", "PASS", f"Logged in successfully. salon_id: {salon_id}")
                return True
            else:
                log_test("AUTH", "FAIL", "Missing access_token or salon_id in response")
                return False
        else:
            log_test("AUTH", "FAIL", f"HTTP {response.status_code}: {response.text[:200]}")
            return False
    except Exception as e:
        log_test("AUTH", "FAIL", f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 1: GET /api/salons/{salon_id}/home-kpis?date_mode=today
# ============================================================================

def test_home_kpis_today():
    """Test 1: GET /api/salons/{salon_id}/home-kpis?date_mode=today"""
    print("\n" + "="*80)
    print("TEST 1: HOME-KPIS (date_mode=today)")
    print("="*80)
    
    url = f"{BASE_URL}/salons/{salon_id}/home-kpis?date_mode=today"
    headers = {"Authorization": f"Bearer {access_token}"}
    
    try:
        response = requests.get(url, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {truncate_response(response.text)}")
        
        if response.status_code != 200:
            log_test("HOME-KPIS TODAY", "FAIL", f"HTTP {response.status_code}")
            return False
        
        data = response.json()
        
        # Check for new top-level keys
        required_new_keys = ["customer_count", "staff_attendance", "marketing_perf", "booking_links"]
        missing_keys = [k for k in required_new_keys if k not in data]
        
        if missing_keys:
            log_test("HOME-KPIS TODAY", "FAIL", f"Missing keys: {missing_keys}")
            return False
        
        # Verify customer_count structure
        cc = data.get("customer_count", {})
        if "total" not in cc or "by_source" not in cc:
            log_test("HOME-KPIS TODAY", "FAIL", "customer_count missing 'total' or 'by_source'")
            return False
        
        by_source = cc.get("by_source", {})
        expected_sources = ["online", "qr", "owner", "direct"]
        missing_sources = [s for s in expected_sources if s not in by_source]
        if missing_sources:
            log_test("HOME-KPIS TODAY", "FAIL", f"customer_count.by_source missing: {missing_sources}")
            return False
        
        # Verify staff_attendance structure
        staff_att = data.get("staff_attendance", [])
        if not isinstance(staff_att, list):
            log_test("HOME-KPIS TODAY", "FAIL", "staff_attendance is not an array")
            return False
        
        # Check staff_attendance items have required fields
        if staff_att:
            first_staff = staff_att[0]
            required_staff_fields = ["barber_id", "name", "status", "check_in_at", "check_out_at"]
            missing_staff_fields = [f for f in required_staff_fields if f not in first_staff]
            if missing_staff_fields:
                log_test("HOME-KPIS TODAY", "FAIL", f"staff_attendance item missing: {missing_staff_fields}")
                return False
            
            # Verify status is one of in|late|out
            status = first_staff.get("status")
            if status not in ["in", "late", "out"]:
                log_test("HOME-KPIS TODAY", "FAIL", f"Invalid staff status: {status}")
                return False
        
        # Verify marketing_perf structure
        mp = data.get("marketing_perf", {})
        required_mp_keys = ["sent", "delivered", "clicked", "redeemed", "revenue", "delivered_pct", "click_pct", "campaigns", "channels"]
        missing_mp_keys = [k for k in required_mp_keys if k not in mp]
        if missing_mp_keys:
            log_test("HOME-KPIS TODAY", "FAIL", f"marketing_perf missing: {missing_mp_keys}")
            return False
        
        # Verify booking_links structure
        bl = data.get("booking_links", {})
        required_bl_keys = ["book_url", "home_url", "menu_url"]
        missing_bl_keys = [k for k in required_bl_keys if k not in bl]
        if missing_bl_keys:
            log_test("HOME-KPIS TODAY", "FAIL", f"booking_links missing: {missing_bl_keys}")
            return False
        
        # Verify URLs are non-empty and start with https://
        for key in required_bl_keys:
            url_val = bl.get(key, "")
            if not url_val:
                log_test("HOME-KPIS TODAY", "FAIL", f"booking_links.{key} is empty")
                return False
            if not url_val.startswith("https://"):
                log_test("HOME-KPIS TODAY", "FAIL", f"booking_links.{key} does not start with https://")
                return False
        
        # Verify pre-existing keys still present
        pre_existing_keys = ["primary", "secondary", "staff_leaderboard", "reviews", "targets", "revenue_7d", "payment_mix", "top_services", "busy_hours"]
        missing_pre_keys = [k for k in pre_existing_keys if k not in data]
        if missing_pre_keys:
            log_test("HOME-KPIS TODAY", "FAIL", f"Pre-existing keys missing: {missing_pre_keys}")
            return False
        
        log_test("HOME-KPIS TODAY", "PASS", f"All required keys present. customer_count.total={cc['total']}, staff_attendance count={len(staff_att)}, marketing_perf.sent={mp['sent']}")
        return True
        
    except Exception as e:
        log_test("HOME-KPIS TODAY", "FAIL", f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 2: GET /api/salons/{salon_id}/home-kpis with different date_mode
# ============================================================================

def test_home_kpis_yesterday():
    """Test 2a: GET /api/salons/{salon_id}/home-kpis?date_mode=yesterday"""
    print("\n" + "="*80)
    print("TEST 2a: HOME-KPIS (date_mode=yesterday)")
    print("="*80)
    
    url = f"{BASE_URL}/salons/{salon_id}/home-kpis?date_mode=yesterday"
    headers = {"Authorization": f"Bearer {access_token}"}
    
    try:
        response = requests.get(url, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {truncate_response(response.text)}")
        
        if response.status_code != 200:
            log_test("HOME-KPIS YESTERDAY", "FAIL", f"HTTP {response.status_code}")
            return False
        
        data = response.json()
        mp = data.get("marketing_perf", {})
        
        log_test("HOME-KPIS YESTERDAY", "PASS", f"marketing_perf.sent={mp.get('sent', 0)}")
        return True
        
    except Exception as e:
        log_test("HOME-KPIS YESTERDAY", "FAIL", f"Exception: {str(e)}")
        return False

def test_home_kpis_range():
    """Test 2b: GET /api/salons/{salon_id}/home-kpis?date_mode=range&date_from=2026-07-01&date_to=2026-07-10"""
    print("\n" + "="*80)
    print("TEST 2b: HOME-KPIS (date_mode=range)")
    print("="*80)
    
    url = f"{BASE_URL}/salons/{salon_id}/home-kpis?date_mode=range&date_from=2026-07-01&date_to=2026-07-10"
    headers = {"Authorization": f"Bearer {access_token}"}
    
    try:
        response = requests.get(url, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {truncate_response(response.text)}")
        
        if response.status_code != 200:
            log_test("HOME-KPIS RANGE", "FAIL", f"HTTP {response.status_code}")
            return False
        
        data = response.json()
        mp = data.get("marketing_perf", {})
        
        log_test("HOME-KPIS RANGE", "PASS", f"marketing_perf.sent={mp.get('sent', 0)} (should reflect range, not blow up)")
        return True
        
    except Exception as e:
        log_test("HOME-KPIS RANGE", "FAIL", f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 3: POST /api/salons/{salon_id}/home/staff-attendance/toggle
# ============================================================================

def get_active_barber():
    """Helper: Get an active barber_id"""
    url = f"{BASE_URL}/salons/{salon_id}/barbers"
    headers = {"Authorization": f"Bearer {access_token}"}
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            barbers = data.get("barbers", [])
            active_barbers = [b for b in barbers if b.get("is_active")]
            if active_barbers:
                return active_barbers[0].get("id")
        return None
    except:
        return None

def test_staff_attendance_toggle():
    """Test 3: POST /api/salons/{salon_id}/home/staff-attendance/toggle"""
    print("\n" + "="*80)
    print("TEST 3: STAFF ATTENDANCE TOGGLE")
    print("="*80)
    
    barber_id = get_active_barber()
    if not barber_id:
        log_test("STAFF ATTENDANCE TOGGLE", "SKIP", "No active barbers found")
        return False
    
    print(f"Using barber_id: {barber_id}")
    
    url = f"{BASE_URL}/salons/{salon_id}/home/staff-attendance/toggle"
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Test 3a: Check in
    print("\n--- 3a: Check in (action='in') ---")
    payload = {"barber_id": barber_id, "action": "in"}
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {truncate_response(response.text)}")
        
        if response.status_code != 200:
            log_test("STAFF ATTENDANCE TOGGLE 3a", "FAIL", f"HTTP {response.status_code}")
            return False
        
        data = response.json()
        if not data.get("ok"):
            log_test("STAFF ATTENDANCE TOGGLE 3a", "FAIL", "ok is not true")
            return False
        
        if "check_in_at" not in data:
            log_test("STAFF ATTENDANCE TOGGLE 3a", "FAIL", "check_in_at not in response")
            return False
        
        log_test("STAFF ATTENDANCE TOGGLE 3a", "PASS", f"Check-in successful. check_in_at={data.get('check_in_at')}")
        
    except Exception as e:
        log_test("STAFF ATTENDANCE TOGGLE 3a", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 3b: Check in again (should return already_in or ok:true)
    print("\n--- 3b: Check in again (should handle already checked in) ---")
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {truncate_response(response.text)}")
        
        if response.status_code != 200:
            log_test("STAFF ATTENDANCE TOGGLE 3b", "FAIL", f"HTTP {response.status_code}")
            return False
        
        data = response.json()
        if not data.get("ok"):
            log_test("STAFF ATTENDANCE TOGGLE 3b", "FAIL", "ok is not true")
            return False
        
        log_test("STAFF ATTENDANCE TOGGLE 3b", "PASS", f"Handled duplicate check-in. already_in={data.get('already_in', False)}")
        
    except Exception as e:
        log_test("STAFF ATTENDANCE TOGGLE 3b", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 3c: Check out
    print("\n--- 3c: Check out (action='out') ---")
    payload = {"barber_id": barber_id, "action": "out"}
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {truncate_response(response.text)}")
        
        if response.status_code != 200:
            log_test("STAFF ATTENDANCE TOGGLE 3c", "FAIL", f"HTTP {response.status_code}")
            return False
        
        data = response.json()
        if not data.get("ok"):
            log_test("STAFF ATTENDANCE TOGGLE 3c", "FAIL", "ok is not true")
            return False
        
        if "check_out_at" not in data:
            log_test("STAFF ATTENDANCE TOGGLE 3c", "FAIL", "check_out_at not in response")
            return False
        
        if data.get("status") != "out":
            log_test("STAFF ATTENDANCE TOGGLE 3c", "FAIL", f"status is not 'out', got: {data.get('status')}")
            return False
        
        log_test("STAFF ATTENDANCE TOGGLE 3c", "PASS", f"Check-out successful. check_out_at={data.get('check_out_at')}, status={data.get('status')}")
        
    except Exception as e:
        log_test("STAFF ATTENDANCE TOGGLE 3c", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 3d: Verify by GET home-kpis
    print("\n--- 3d: Verify staff status in home-kpis ---")
    try:
        kpi_url = f"{BASE_URL}/salons/{salon_id}/home-kpis?date_mode=today"
        response = requests.get(kpi_url, headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            log_test("STAFF ATTENDANCE TOGGLE 3d", "FAIL", f"HTTP {response.status_code}")
            return False
        
        data = response.json()
        staff_att = data.get("staff_attendance", [])
        
        # Find the barber we just toggled
        barber_row = next((s for s in staff_att if s.get("barber_id") == barber_id), None)
        
        if not barber_row:
            log_test("STAFF ATTENDANCE TOGGLE 3d", "FAIL", f"Barber {barber_id} not found in staff_attendance")
            return False
        
        if barber_row.get("status") != "out":
            log_test("STAFF ATTENDANCE TOGGLE 3d", "FAIL", f"Barber status is not 'out', got: {barber_row.get('status')}")
            return False
        
        if not barber_row.get("check_out_at"):
            log_test("STAFF ATTENDANCE TOGGLE 3d", "FAIL", "Barber check_out_at is not set")
            return False
        
        log_test("STAFF ATTENDANCE TOGGLE 3d", "PASS", f"Barber status verified in home-kpis: status={barber_row.get('status')}, check_out_at={barber_row.get('check_out_at')}")
        return True
        
    except Exception as e:
        log_test("STAFF ATTENDANCE TOGGLE 3d", "FAIL", f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 4: POST /api/salons/{salon_id}/send-booking-link
# ============================================================================

def test_send_booking_link():
    """Test 4: POST /api/salons/{salon_id}/send-booking-link"""
    print("\n" + "="*80)
    print("TEST 4: SEND BOOKING LINK")
    print("="*80)
    
    url = f"{BASE_URL}/salons/{salon_id}/send-booking-link"
    headers = {"Authorization": f"Bearer {access_token}"}
    
    # Test 4a: link_type=book
    print("\n--- 4a: link_type=book ---")
    payload = {"phone": "9876543210", "link_type": "book"}
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {truncate_response(response.text)}")
        
        if response.status_code != 200:
            log_test("SEND BOOKING LINK 4a", "FAIL", f"HTTP {response.status_code}")
            return False
        
        data = response.json()
        required_keys = ["ok", "sent_to", "link_url", "delivery_status"]
        missing_keys = [k for k in required_keys if k not in data]
        if missing_keys:
            log_test("SEND BOOKING LINK 4a", "FAIL", f"Missing keys: {missing_keys}")
            return False
        
        link_url = data.get("link_url", "")
        if not link_url.endswith("/book"):
            log_test("SEND BOOKING LINK 4a", "FAIL", f"link_url does not end with /book: {link_url}")
            return False
        
        sent_to = data.get("sent_to", "")
        if sent_to != "+919876543210":
            log_test("SEND BOOKING LINK 4a", "FAIL", f"sent_to is not +919876543210: {sent_to}")
            return False
        
        delivery_status = data.get("delivery_status", "")
        if delivery_status not in ["sent", "failed"]:
            log_test("SEND BOOKING LINK 4a", "FAIL", f"delivery_status is not 'sent' or 'failed': {delivery_status}")
            return False
        
        log_test("SEND BOOKING LINK 4a", "PASS", f"link_url={link_url}, sent_to={sent_to}, delivery_status={delivery_status}")
        
    except Exception as e:
        log_test("SEND BOOKING LINK 4a", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 4b: link_type=home
    print("\n--- 4b: link_type=home ---")
    payload = {"phone": "9876543210", "link_type": "home"}
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {truncate_response(response.text)}")
        
        if response.status_code != 200:
            log_test("SEND BOOKING LINK 4b", "FAIL", f"HTTP {response.status_code}")
            return False
        
        data = response.json()
        link_url = data.get("link_url", "")
        
        # Should end with /salons/{id} (no /book, no /menu)
        if "/book" in link_url or "/menu" in link_url:
            log_test("SEND BOOKING LINK 4b", "FAIL", f"link_url should not contain /book or /menu: {link_url}")
            return False
        
        if not link_url.endswith(f"/salons/{salon_id}"):
            log_test("SEND BOOKING LINK 4b", "FAIL", f"link_url does not end with /salons/{salon_id}: {link_url}")
            return False
        
        log_test("SEND BOOKING LINK 4b", "PASS", f"link_url={link_url}")
        
    except Exception as e:
        log_test("SEND BOOKING LINK 4b", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 4c: link_type=menu
    print("\n--- 4c: link_type=menu ---")
    payload = {"phone": "9876543210", "link_type": "menu"}
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {truncate_response(response.text)}")
        
        if response.status_code != 200:
            log_test("SEND BOOKING LINK 4c", "FAIL", f"HTTP {response.status_code}")
            return False
        
        data = response.json()
        link_url = data.get("link_url", "")
        
        if not link_url.endswith("/menu"):
            log_test("SEND BOOKING LINK 4c", "FAIL", f"link_url does not end with /menu: {link_url}")
            return False
        
        log_test("SEND BOOKING LINK 4c", "PASS", f"link_url={link_url}")
        
    except Exception as e:
        log_test("SEND BOOKING LINK 4c", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 4d: Invalid phone
    print("\n--- 4d: Invalid phone ---")
    payload = {"phone": "invalid", "link_type": "book"}
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {truncate_response(response.text)}")
        
        if response.status_code != 400:
            log_test("SEND BOOKING LINK 4d", "FAIL", f"Expected HTTP 400, got {response.status_code}")
            return False
        
        data = response.json()
        detail = data.get("detail", "").lower()
        if "10-digit" not in detail:
            log_test("SEND BOOKING LINK 4d", "FAIL", f"detail does not mention '10-digit': {detail}")
            return False
        
        log_test("SEND BOOKING LINK 4d", "PASS", f"Correctly rejected invalid phone with 400")
        
    except Exception as e:
        log_test("SEND BOOKING LINK 4d", "FAIL", f"Exception: {str(e)}")
        return False
    
    # Test 4e: Invalid link_type
    print("\n--- 4e: Invalid link_type ---")
    payload = {"phone": "9876543210", "link_type": "junk"}
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {truncate_response(response.text)}")
        
        if response.status_code != 400:
            log_test("SEND BOOKING LINK 4e", "FAIL", f"Expected HTTP 400, got {response.status_code}")
            return False
        
        data = response.json()
        detail = data.get("detail", "").lower()
        if "book" not in detail or "home" not in detail or "menu" not in detail:
            log_test("SEND BOOKING LINK 4e", "FAIL", f"detail does not mention 'book|home|menu': {detail}")
            return False
        
        log_test("SEND BOOKING LINK 4e", "PASS", f"Correctly rejected invalid link_type with 400")
        return True
        
    except Exception as e:
        log_test("SEND BOOKING LINK 4e", "FAIL", f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 5: POST /api/salons/{salon_id}/customers with source="owner"
# ============================================================================

def test_create_customer_with_source():
    """Test 5: POST /api/salons/{salon_id}/customers with source='owner'"""
    global test_customer_phone
    
    print("\n" + "="*80)
    print("TEST 5: CREATE CUSTOMER WITH SOURCE='owner'")
    print("="*80)
    
    url = f"{BASE_URL}/salons/{salon_id}/customers"
    headers = {"Authorization": f"Bearer {access_token}"}
    
    random_suffix = random_string()
    test_customer_phone = random_phone()
    
    payload = {
        "name": f"QA Home v2 {random_suffix}",
        "phone": test_customer_phone,
        "gender": "Female",
        "source": "owner",
        "email": "qa@test.com",
        "tags": ["VIP"],
        "notes": "test"
    }
    
    print(f"Creating customer: {payload}")
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {truncate_response(response.text)}")
        
        if response.status_code != 200:
            log_test("CREATE CUSTOMER", "FAIL", f"HTTP {response.status_code}")
            return False
        
        data = response.json()
        customer = data.get("customer", {})
        
        # Verify customer object
        required_fields = ["id", "name", "phone", "source", "tags"]
        missing_fields = [f for f in required_fields if f not in customer]
        if missing_fields:
            log_test("CREATE CUSTOMER", "FAIL", f"Missing fields in customer: {missing_fields}")
            return False
        
        # Verify phone has +91 prefix
        if not customer.get("phone", "").startswith("+91"):
            log_test("CREATE CUSTOMER", "FAIL", f"Phone does not have +91 prefix: {customer.get('phone')}")
            return False
        
        # Verify source is "owner"
        if customer.get("source") != "owner":
            log_test("CREATE CUSTOMER", "FAIL", f"source is not 'owner': {customer.get('source')}")
            return False
        
        # Verify tags
        if customer.get("tags") != ["VIP"]:
            log_test("CREATE CUSTOMER", "FAIL", f"tags is not ['VIP']: {customer.get('tags')}")
            return False
        
        log_test("CREATE CUSTOMER", "PASS", f"Customer created: id={customer.get('id')}, phone={customer.get('phone')}, source={customer.get('source')}")
        
        # Now verify the customer appears in GET /api/salons/{salon_id}/customers
        print("\n--- Verify customer in GET /customers ---")
        get_url = f"{BASE_URL}/salons/{salon_id}/customers"
        response = requests.get(get_url, headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            log_test("VERIFY CUSTOMER IN LIST", "FAIL", f"HTTP {response.status_code}")
            return False
        
        data = response.json()
        customers = data.get("customers", [])
        
        # Find our customer
        normalized_phone = f"+91{test_customer_phone}" if not test_customer_phone.startswith("+91") else test_customer_phone
        found_customer = next((c for c in customers if c.get("phone") == normalized_phone), None)
        
        if not found_customer:
            log_test("VERIFY CUSTOMER IN LIST", "FAIL", f"Customer with phone {normalized_phone} not found in list")
            return False
        
        # Note: The GET /customers endpoint merges data from tokens and salon_customers.
        # The source field might not be directly visible in the merged result, but we can verify the customer exists.
        log_test("VERIFY CUSTOMER IN LIST", "PASS", f"Customer found in list: name={found_customer.get('name')}, phone={found_customer.get('phone')}")
        return True
        
    except Exception as e:
        log_test("CREATE CUSTOMER", "FAIL", f"Exception: {str(e)}")
        return False

# ============================================================================
# TEST 6: REGRESSION - Verify existing endpoints still work
# ============================================================================

def test_regression():
    """Test 6: Regression - verify existing endpoints still work"""
    print("\n" + "="*80)
    print("TEST 6: REGRESSION TESTS")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {access_token}"}
    
    endpoints = [
        f"{BASE_URL}/salons/{salon_id}/barbers",
        f"{BASE_URL}/salons/{salon_id}/services/enabled",
        f"{BASE_URL}/salons/{salon_id}/services/all",
        f"{BASE_URL}/salons/{salon_id}/inventory",
    ]
    
    all_passed = True
    
    for endpoint in endpoints:
        endpoint_name = endpoint.split("/")[-1] if "/" in endpoint else endpoint
        print(f"\n--- Testing {endpoint_name} ---")
        
        try:
            response = requests.get(endpoint, headers=headers)
            print(f"Status: {response.status_code}")
            print(f"Response: {truncate_response(response.text, 200)}")
            
            if response.status_code == 200:
                log_test(f"REGRESSION {endpoint_name}", "PASS", "Endpoint working")
            elif response.status_code == 500:
                log_test(f"REGRESSION {endpoint_name}", "FAIL", "HTTP 500 - Internal Server Error")
                all_passed = False
            else:
                log_test(f"REGRESSION {endpoint_name}", "PASS", f"HTTP {response.status_code} (not 500)")
                
        except Exception as e:
            log_test(f"REGRESSION {endpoint_name}", "FAIL", f"Exception: {str(e)}")
            all_passed = False
    
    return all_passed

# ============================================================================
# CLEANUP: DELETE test customer
# ============================================================================

def test_cleanup():
    """Cleanup: DELETE test customer"""
    global test_customer_phone
    
    if not test_customer_phone:
        print("\n" + "="*80)
        print("CLEANUP: No test customer to delete")
        print("="*80)
        return True
    
    print("\n" + "="*80)
    print("CLEANUP: DELETE TEST CUSTOMER")
    print("="*80)
    
    # Normalize phone
    normalized_phone = f"+91{test_customer_phone}" if not test_customer_phone.startswith("+91") else test_customer_phone
    
    url = f"{BASE_URL}/salons/{salon_id}/customers/{normalized_phone}"
    headers = {"Authorization": f"Bearer {access_token}"}
    
    try:
        response = requests.delete(url, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {truncate_response(response.text)}")
        
        if response.status_code == 200:
            log_test("CLEANUP DELETE", "PASS", f"Test customer deleted: {normalized_phone}")
            return True
        else:
            log_test("CLEANUP DELETE", "FAIL", f"HTTP {response.status_code}")
            return False
            
    except Exception as e:
        log_test("CLEANUP DELETE", "FAIL", f"Exception: {str(e)}")
        return False

# ============================================================================
# MAIN
# ============================================================================

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("HOME V2 BACKEND ENDPOINT TESTING")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin: {ADMIN_IDENTIFIER}")
    
    results = {}
    
    # Auth
    if not test_auth():
        print("\n❌ AUTH FAILED - Cannot proceed with tests")
        return
    
    # Test 1: home-kpis today
    results["Test 1: home-kpis today"] = test_home_kpis_today()
    
    # Test 2: home-kpis with different date_mode
    results["Test 2a: home-kpis yesterday"] = test_home_kpis_yesterday()
    results["Test 2b: home-kpis range"] = test_home_kpis_range()
    
    # Test 3: staff-attendance toggle
    results["Test 3: staff-attendance toggle"] = test_staff_attendance_toggle()
    
    # Test 4: send-booking-link
    results["Test 4: send-booking-link"] = test_send_booking_link()
    
    # Test 5: create customer with source
    results["Test 5: create customer with source"] = test_create_customer_with_source()
    
    # Test 6: regression
    results["Test 6: regression"] = test_regression()
    
    # Cleanup
    results["Cleanup"] = test_cleanup()
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        symbol = "✅" if result else "❌"
        print(f"{symbol} {test_name}: {'PASS' if result else 'FAIL'}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED!")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")

if __name__ == "__main__":
    main()
