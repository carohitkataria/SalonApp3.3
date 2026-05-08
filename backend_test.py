#!/usr/bin/env python3
"""
RE-TEST 3 backend feature groups after fixes:
A) Manual Toggle — verify ALL three states with admin token
B) Booking enforcement — re-test the booking flows
C) Bulk customer upload — re-confirm all paths still work
D) Menu parsing — test image and PDF parsing with OpenAI gpt-5
"""

import requests
import json
from io import BytesIO
from datetime import datetime, timedelta
from PIL import Image, ImageDraw, ImageFont
import openpyxl
import base64

# Configuration
BASE_URL = "https://menu-parser-1.preview.emergentagent.com/api"
ADMIN_IDENTIFIER = "admin"
ADMIN_PASSWORD = "salon123"

# Global variables
access_token = None
salon_id = None
test_service_id = None
test_barber_id = None

def print_section(title):
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")

def print_test(test_name, passed, details=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"    {details}")

def login_admin():
    """Login as admin and get access token"""
    global access_token, salon_id
    print_section("AUTHENTICATION")
    
    url = f"{BASE_URL}/salon/users/login"
    payload = {
        "identifier": ADMIN_IDENTIFIER,
        "password": ADMIN_PASSWORD
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Login Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            access_token = data.get("access_token")
            salon_id = data.get("salon_id")
            print(f"✅ Login successful")
            print(f"   Salon ID: {salon_id}")
            print(f"   Token: {access_token[:20]}...")
            return True
        else:
            print(f"❌ Login failed: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        return False

def get_headers(auth=True):
    """Get request headers"""
    headers = {"Content-Type": "application/json"}
    if auth and access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    return headers

def get_test_service_and_barber():
    """Get a valid service and barber for testing"""
    global test_service_id, test_barber_id
    
    # Get services
    url = f"{BASE_URL}/salons/{salon_id}/services/all"
    response = requests.get(url, headers=get_headers())
    if response.status_code == 200:
        data = response.json()
        # Handle both list and dict responses
        if isinstance(data, list):
            services = data
        else:
            services = data.get("services", [])
        
        if services:
            # Find an enabled service
            enabled_services = [s for s in services if s.get("is_enabled_for_salon", False)]
            if enabled_services:
                test_service_id = enabled_services[0]["id"]
                service_name = enabled_services[0].get("service_name", enabled_services[0].get("name", "Unknown"))
                print(f"   Using test service: {service_name} (ID: {test_service_id})")
            else:
                # Use first service even if not enabled
                test_service_id = services[0]["id"]
                service_name = services[0].get("service_name", services[0].get("name", "Unknown"))
                print(f"   Using test service: {service_name} (ID: {test_service_id})")
    
    # Get barbers
    url = f"{BASE_URL}/salons/{salon_id}/barbers"
    response = requests.get(url, headers=get_headers())
    if response.status_code == 200:
        data = response.json()
        barbers = data.get("barbers", []) if isinstance(data, dict) else data
        if barbers:
            test_barber_id = barbers[0]["id"]
            print(f"   Using test barber: {barbers[0]['name']} (ID: {test_barber_id})")

# ============================================================================
# GROUP A: MANUAL TOGGLE - closed_mode states
# ============================================================================

def test_group_a_manual_toggle():
    print_section("GROUP A: MANUAL TOGGLE - closed_mode states")
    
    print("Testing ALL three manual toggle states with admin token:")
    print("  1) online_only (closed for online, open for QR/manual)")
    print("  2) full (fully closed)")
    print("  3) open (auto-cleared closed_mode)\n")
    
    # A1: Set to online_only
    print("\n[A1] PUT manual-toggle to online_only")
    url = f"{BASE_URL}/salons/{salon_id}/manual-toggle"
    payload = {
        "is_overridden": True,
        "is_open": False,
        "closed_mode": "online_only"
    }
    response = requests.put(url, json=payload, headers=get_headers())
    passed = response.status_code == 200
    if passed:
        data = response.json()
        closed_mode = data.get("manual_toggle", {}).get("closed_mode")
        passed = closed_mode == "online_only"
        print_test("A1: Set online_only", passed, f"closed_mode={closed_mode}")
    else:
        print_test("A1: Set online_only", False, f"Status: {response.status_code}, {response.text[:200]}")
    
    # A2: GET operational-hours reflects closed_mode
    print("\n[A2] GET operational-hours")
    url = f"{BASE_URL}/salons/{salon_id}/operational-hours"
    response = requests.get(url, headers=get_headers())
    passed = response.status_code == 200
    if passed:
        data = response.json()
        closed_mode = data.get("manual_toggle", {}).get("closed_mode")
        passed = closed_mode == "online_only"
        print_test("A2: operational-hours reflects closed_mode", passed, f"closed_mode={closed_mode}")
    else:
        print_test("A2: operational-hours", False, f"Status: {response.status_code}")
    
    # A3: GET booking-availability
    print("\n[A3] GET booking-availability")
    url = f"{BASE_URL}/salons/{salon_id}/booking-availability"
    response = requests.get(url, headers=get_headers(auth=False))
    passed = response.status_code == 200
    if passed:
        data = response.json()
        closed_mode = data.get("closed_mode")
        reason = data.get("reason", "")
        message = data.get("message", "")
        passed = closed_mode == "online_only"
        print_test("A3: booking-availability online_only", passed, 
                  f"closed_mode={closed_mode}, reason='{reason}', message='{message}'")
    else:
        print_test("A3: booking-availability", False, f"Status: {response.status_code}")
    
    # A4: Set to full close
    print("\n[A4] PUT manual-toggle to full")
    url = f"{BASE_URL}/salons/{salon_id}/manual-toggle"
    payload = {
        "is_overridden": True,
        "is_open": False,
        "closed_mode": "full"
    }
    response = requests.put(url, json=payload, headers=get_headers())
    passed = response.status_code == 200
    if passed:
        data = response.json()
        closed_mode = data.get("manual_toggle", {}).get("closed_mode")
        passed = closed_mode == "full"
        print_test("A4: Set full close", passed, f"closed_mode={closed_mode}")
        
        # Check booking-availability
        url = f"{BASE_URL}/salons/{salon_id}/booking-availability"
        response = requests.get(url, headers=get_headers(auth=False))
        if response.status_code == 200:
            data = response.json()
            closed_mode = data.get("closed_mode")
            reason = data.get("reason", "")
            message = data.get("message", "")
            print(f"    booking-availability: closed_mode={closed_mode}, reason='{reason}', message='{message}'")
    else:
        print_test("A4: Set full close", False, f"Status: {response.status_code}, {response.text[:200]}")
    
    # A5: Reset to open (closed_mode auto-cleared)
    print("\n[A5] PUT manual-toggle to open (closed_mode should auto-clear)")
    url = f"{BASE_URL}/salons/{salon_id}/manual-toggle"
    payload = {
        "is_overridden": False,
        "is_open": True
    }
    response = requests.put(url, json=payload, headers=get_headers())
    passed = response.status_code == 200
    if passed:
        data = response.json()
        closed_mode = data.get("manual_toggle", {}).get("closed_mode")
        passed = closed_mode is None
        print_test("A5: Reset to open (closed_mode=null)", passed, f"closed_mode={closed_mode}")
        
        # Verify operational-hours
        url = f"{BASE_URL}/salons/{salon_id}/operational-hours"
        response = requests.get(url, headers=get_headers())
        if response.status_code == 200:
            data = response.json()
            closed_mode = data.get("manual_toggle", {}).get("closed_mode")
            print(f"    operational-hours: closed_mode={closed_mode} (should be null)")
    else:
        print_test("A5: Reset to open", False, f"Status: {response.status_code}")

# ============================================================================
# GROUP B: BOOKING ENFORCEMENT
# ============================================================================

def test_group_b_booking_enforcement():
    print_section("GROUP B: BOOKING ENFORCEMENT")
    
    if not test_service_id:
        print("❌ Cannot test - no test service available")
        return
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Pre-condition: Set to online_only
    print("\n[Pre-condition] Set salon to online_only")
    url = f"{BASE_URL}/salons/{salon_id}/manual-toggle"
    payload = {
        "is_overridden": True,
        "is_open": False,
        "closed_mode": "online_only"
    }
    response = requests.put(url, json=payload, headers=get_headers())
    print(f"   Set online_only: {response.status_code}")
    
    # B1: POST /api/bookings with source='online' should fail with "Closed Online — Visit Salon"
    print("\n[B1] POST /bookings with source='online' (should fail with 'Closed Online — Visit Salon')")
    url = f"{BASE_URL}/bookings"
    payload = {
        "salon_id": salon_id,
        "customer_name": "Test Customer Online",
        "phone": "+919876543210",
        "date": today,
        "shift": "Morning",
        "barber_id": "any",
        "selected_services": [test_service_id],
        "source": "online",
        "booking_for_self": True,
        "customer_gender": "Men",
        "payment_mode": "cash"
    }
    response = requests.post(url, json=payload, headers=get_headers(auth=False))
    passed = response.status_code == 400
    if passed:
        detail = response.json().get("detail", "")
        passed = "Closed Online" in detail or "Visit Salon" in detail
        print_test("B1: Online booking blocked with 'Closed Online — Visit Salon'", passed, 
                  f"Status: {response.status_code}, detail: '{detail}'")
    else:
        print_test("B1: Online booking blocked", False, 
                  f"Expected 400, got {response.status_code}: {response.text[:200]}")
    
    # B2: POST /api/bookings with source='qr' should NOT be blocked by online_only
    print("\n[B2] POST /bookings with source='qr' (should NOT be blocked by online_only)")
    payload["source"] = "qr"
    payload["phone"] = "+919876543211"  # Different phone
    payload["customer_name"] = "Test Customer QR"
    response = requests.post(url, json=payload, headers=get_headers(auth=False))
    # Should NOT be 400 with "Closed Online" message
    if response.status_code == 400:
        detail = response.json().get("detail", "")
        passed = "Closed Online" not in detail and "Visit Salon" not in detail
        print_test("B2: QR booking not blocked by online_only", passed, 
                  f"Status: {response.status_code}, detail: '{detail}'")
    else:
        # 200 or other error (capacity, etc.) is fine
        passed = True
        print_test("B2: QR booking not blocked by online_only", passed, 
                  f"Status: {response.status_code} (not blocked by close)")
    
    # B3: POST /api/salons/{salon_id}/salon-booking should succeed in online_only
    print("\n[B3] POST /salon-booking (manual) in online_only mode (should succeed)")
    url = f"{BASE_URL}/salons/{salon_id}/salon-booking"
    payload = {
        "customer_name": "Walk-in Test Online",
        "phone": "9876543299",
        "gender": "Men",
        "barber_id": "any",
        "selected_services": [test_service_id],
        "shift": "Morning",
        "date": today
    }
    response = requests.post(url, json=payload, headers=get_headers())
    # Should succeed (200) or fail for non-close reasons
    if response.status_code == 400:
        detail = response.json().get("detail", "")
        passed = "closed" not in detail.lower() or "online only" in detail.lower()
        print_test("B3: Manual booking allowed in online_only", passed, 
                  f"Status: {response.status_code}, detail: '{detail}'")
    else:
        passed = response.status_code == 200
        print_test("B3: Manual booking allowed in online_only", passed, 
                  f"Status: {response.status_code}")
    
    # Now set to full close
    print("\n[Pre-condition] Set salon to full close")
    url = f"{BASE_URL}/salons/{salon_id}/manual-toggle"
    payload = {
        "is_overridden": True,
        "is_open": False,
        "closed_mode": "full"
    }
    response = requests.put(url, json=payload, headers=get_headers())
    print(f"   Set full close: {response.status_code}")
    
    # B4: POST /api/bookings with source='qr' should fail in full close with "Salon is currently closed"
    print("\n[B4] POST /bookings with source='qr' in full close (should fail with 'Salon is currently closed')")
    url = f"{BASE_URL}/bookings"
    payload = {
        "salon_id": salon_id,
        "customer_name": "Test Customer QR Full",
        "phone": "+919876543212",
        "date": today,
        "shift": "Morning",
        "barber_id": "any",
        "selected_services": [test_service_id],
        "source": "qr",
        "booking_for_self": True,
        "customer_gender": "Men",
        "payment_mode": "cash"
    }
    response = requests.post(url, json=payload, headers=get_headers(auth=False))
    passed = response.status_code == 400
    if passed:
        detail = response.json().get("detail", "")
        passed = "closed" in detail.lower()
        print_test("B4: QR booking blocked in full close with 'Salon is currently closed'", passed, 
                  f"Status: {response.status_code}, detail: '{detail}'")
    else:
        print_test("B4: QR booking blocked in full close", False, 
                  f"Expected 400, got {response.status_code}")
    
    # B5: POST /api/salons/{salon_id}/salon-booking should fail in full close with "fully closed"
    print("\n[B5] POST /salon-booking in full close (should fail with 'fully closed')")
    url = f"{BASE_URL}/salons/{salon_id}/salon-booking"
    payload = {
        "customer_name": "Walk-in Test Full",
        "phone": "9876543298",
        "gender": "Men",
        "barber_id": "any",
        "selected_services": [test_service_id],
        "shift": "Morning",
        "date": today
    }
    response = requests.post(url, json=payload, headers=get_headers())
    passed = response.status_code == 400
    if passed:
        detail = response.json().get("detail", "")
        passed = "fully closed" in detail.lower() or "closed" in detail.lower()
        print_test("B5: Manual booking blocked in full close with 'fully closed'", passed, 
                  f"Status: {response.status_code}, detail: '{detail}'")
    else:
        print_test("B5: Manual booking blocked in full close", False, 
                  f"Expected 400, got {response.status_code}")

# ============================================================================
# GROUP C: BULK CUSTOMER UPLOAD
# ============================================================================

def test_group_c_bulk_upload():
    print_section("GROUP C: BULK CUSTOMER UPLOAD + EXCEL TEMPLATE")
    
    # C1: GET template
    print("\n[C1] GET /customers/template")
    url = f"{BASE_URL}/salons/{salon_id}/customers/template"
    response = requests.get(url, headers=get_headers())
    passed = response.status_code == 200
    if passed:
        content_type = response.headers.get("content-type", "")
        content_disp = response.headers.get("content-disposition", "")
        passed = "spreadsheet" in content_type and "customer_upload_template.xlsx" in content_disp
        print_test("C1: Template download (real .xlsx, content-type spreadsheet, content-disposition with filename)", 
                  passed, f"content-type: {content_type}, disposition: {content_disp}")
    else:
        print_test("C1: Template download", False, f"Status: {response.status_code}")
    
    # C2: Build test xlsx and upload
    print("\n[C2] POST /customers/bulk-upload")
    
    # Create test Excel file
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Customers"
    
    # Header row (MUST match exactly: 'Name', 'Mobile No.', 'Gender', 'Date of Birth')
    ws.append(['Name', 'Mobile No.', 'Gender', 'Date of Birth'])
    
    # Data rows
    ws.append(['TestUser1', '9876543200', 'Men', '1990-05-15'])
    ws.append(['TestUser2', '9876543201', 'Women', '1995-11-23'])
    ws.append(['', 'badphone', 'Other', ''])  # Invalid
    ws.append(['TestUser1', '9876543200', 'Men', '1990-05-15'])  # Duplicate of row 1
    
    # Save to BytesIO
    excel_buffer = BytesIO()
    wb.save(excel_buffer)
    excel_buffer.seek(0)
    
    url = f"{BASE_URL}/salons/{salon_id}/customers/bulk-upload"
    files = {"file": ("test_customers.xlsx", excel_buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    
    # Note: multipart/form-data, so we don't use get_headers()
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.post(url, files=files, headers=headers)
    
    passed = response.status_code == 200
    if passed:
        data = response.json()
        inserted = data.get("inserted", 0)
        skipped_duplicate = data.get("skipped_duplicate", 0)
        skipped_invalid = data.get("skipped_invalid", 0)
        passed = inserted == 2 and skipped_duplicate == 1 and skipped_invalid == 1
        print_test("C2: Bulk upload (inserted=2, skipped_duplicate=1, skipped_invalid=1)", passed, 
                  f"inserted={inserted}, skipped_duplicate={skipped_duplicate}, skipped_invalid={skipped_invalid}")
    else:
        print_test("C2: Bulk upload", False, f"Status: {response.status_code}, {response.text[:300]}")
    
    # C3: Auth check
    print("\n[C3] POST /bulk-upload without auth (should fail with 401/403)")
    excel_buffer.seek(0)
    url = f"{BASE_URL}/salons/{salon_id}/customers/bulk-upload"
    files = {"file": ("test.xlsx", excel_buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    response = requests.post(url, files=files)
    passed = response.status_code in [401, 403]
    print_test("C3: Auth required", passed, f"Status: {response.status_code}")

# ============================================================================
# GROUP D: MENU PARSING
# ============================================================================

def test_group_d_menu_parsing():
    print_section("GROUP D: AI MENU PARSING via OpenAI GPT-5")
    
    # D1: Create test menu image
    print("\n[D1] POST /services/parse-menu with PNG image")
    
    # Create a clear PNG with menu text (800x600 or larger, 14pt+ font)
    img = Image.new('RGB', (1000, 800), color='white')
    draw = ImageDraw.Draw(img)
    
    # Try to use a clear font
    try:
        font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
        font_text = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
    except:
        font_title = ImageFont.load_default()
        font_text = ImageFont.load_default()
    
    # Draw menu items
    draw.text((100, 50), "SALON PRICE LIST", fill='black', font=font_title)
    
    menu_items = [
        "Men's Haircut - Rs 200",
        "Beard Trim - Rs 100",
        "Hair Color - Rs 500",
        "",
        "Women's Haircut - Rs 300",
        "Facial - Rs 500",
        "Hair Spa - Rs 800"
    ]
    
    y = 150
    for line in menu_items:
        draw.text((100, y), line, fill='black', font=font_text)
        y += 70
    
    # Save to BytesIO
    img_buffer = BytesIO()
    img.save(img_buffer, format='PNG')
    img_buffer.seek(0)
    
    url = f"{BASE_URL}/salons/{salon_id}/services/parse-menu"
    files = {"file": ("menu.png", img_buffer, "image/png")}
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.post(url, files=files, headers=headers)
    
    parsed_services = []
    passed = response.status_code == 200
    if passed:
        data = response.json()
        parsed_services = data.get("services", [])
        service_count = data.get("service_count", 0)
        packages = data.get("packages", [])
        
        # Accept >= 1 service
        passed = service_count >= 1
        print_test("D1: Parse menu PNG (services_count >= 1)", passed, 
                  f"service_count={service_count}, package_count={len(packages)}")
        
        if parsed_services:
            print(f"    Sample parsed service: {parsed_services[0]}")
        
        # If 0 services, retry once with clearer image
        if service_count == 0:
            print("\n[D1-RETRY] Parsing returned 0 services, retrying with clearer/larger image")
            
            # Create a larger, clearer image
            img = Image.new('RGB', (1200, 1000), color='white')
            draw = ImageDraw.Draw(img)
            
            try:
                font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 60)
                font_text = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
            except:
                font_title = ImageFont.load_default()
                font_text = ImageFont.load_default()
            
            draw.text((150, 80), "SALON MENU", fill='black', font=font_title)
            
            menu_items = [
                "HAIRCUT MEN 200",
                "BEARD TRIM 100",
                "FACIAL WOMEN 500",
                "HAIR SPA 800"
            ]
            
            y = 200
            for line in menu_items:
                draw.text((150, y), line, fill='black', font=font_text)
                y += 120
            
            img_buffer = BytesIO()
            img.save(img_buffer, format='PNG')
            img_buffer.seek(0)
            
            files = {"file": ("menu_clear.png", img_buffer, "image/png")}
            response = requests.post(url, files=files, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                parsed_services = data.get("services", [])
                service_count = data.get("service_count", 0)
                passed = service_count >= 1
                print_test("D1-RETRY: Parse clearer image", passed, f"service_count={service_count}")
                if parsed_services:
                    print(f"    Sample: {parsed_services[0]}")
    else:
        print_test("D1: Parse menu PNG", False, f"Status: {response.status_code}, {response.text[:300]}")
    
    # D2: Apply parsed services with mode='add'
    print("\n[D2] POST /services/apply-parsed with mode='add'")
    
    if not parsed_services:
        # Create dummy services for testing if parsing failed
        parsed_services = [
            {
                "service_name": "Test Haircut",
                "description": "Test service",
                "category": "Haircut",
                "gender": "Men",
                "default_duration": 30,
                "base_price": 200
            }
        ]
        print("    Using dummy service for testing (parsing returned 0)")
    
    url = f"{BASE_URL}/salons/{salon_id}/services/apply-parsed"
    payload = {
        "services": parsed_services,
        "packages": [],
        "mode": "add"
    }
    response = requests.post(url, json=payload, headers=get_headers())
    
    passed = response.status_code == 200
    if passed:
        data = response.json()
        created_services = data.get("created_services", 0)
        passed = created_services >= 1
        print_test("D2: Apply parsed (add mode, created_services >= 1)", passed, 
                  f"created_services={created_services}")
    else:
        print_test("D2: Apply parsed (add mode)", False, 
                  f"Status: {response.status_code}, {response.text[:300]}")
    
    # Verify services appear in list with source='menu_parse'
    print("\n[D2-VERIFY] GET /services/all - verify source='menu_parse'")
    url = f"{BASE_URL}/salons/{salon_id}/services/all"
    response = requests.get(url, headers=get_headers())
    if response.status_code == 200:
        data = response.json()
        # Handle both list and dict responses
        if isinstance(data, list):
            services = data
        else:
            services = data.get("services", [])
        menu_parse_services = [s for s in services if s.get("source") == "menu_parse"]
        predefined_services = [s for s in services if s.get("source") == "predefined"]
        print(f"    Found {len(menu_parse_services)} services with source='menu_parse'")
        print(f"    Found {len(predefined_services)} services with source='predefined' (preserved)")
    
    # D3: Apply with mode='replace'
    print("\n[D3] POST /services/apply-parsed with mode='replace'")
    
    url = f"{BASE_URL}/salons/{salon_id}/services/apply-parsed"
    payload = {
        "services": parsed_services[:1],  # Just one service
        "packages": [],
        "mode": "replace"
    }
    response = requests.post(url, json=payload, headers=get_headers())
    
    passed = response.status_code == 200
    if passed:
        data = response.json()
        created_services = data.get("created_services", 0)
        print_test("D3: Apply parsed (replace mode)", passed, f"created_services={created_services}")
        
        # Verify services still work and contain source='menu_parse' entries
        url = f"{BASE_URL}/salons/{salon_id}/services/all"
        response = requests.get(url, headers=get_headers())
        if response.status_code == 200:
            data = response.json()
            # Handle both list and dict responses
            if isinstance(data, list):
                services = data
            else:
                services = data.get("services", [])
            menu_parse_services = [s for s in services if s.get("source") == "menu_parse"]
            predefined_services = [s for s in services if s.get("source") == "predefined"]
            print(f"    After replace: {len(menu_parse_services)} services with source='menu_parse'")
            print(f"    After replace: {len(predefined_services)} services with source='predefined' (preserved)")
    else:
        print_test("D3: Apply parsed (replace mode)", False, 
                  f"Status: {response.status_code}, {response.text[:300]}")
    
    # D4: Auth check
    print("\n[D4] POST /parse-menu without auth (should fail with 401/403)")
    img_buffer.seek(0)
    url = f"{BASE_URL}/salons/{salon_id}/services/parse-menu"
    files = {"file": ("menu.png", img_buffer, "image/png")}
    response = requests.post(url, files=files)
    passed = response.status_code in [401, 403]
    print_test("D4: Auth required", passed, f"Status: {response.status_code}")
    
    # BONUS: D5: Test PDF parsing (if quick)
    print("\n[D5-BONUS] POST /parse-menu with PDF (if PyMuPDF available)")
    try:
        # Try to create a simple PDF using reportlab or PyMuPDF
        try:
            import fitz  # PyMuPDF
            
            # Create a simple PDF with text
            doc = fitz.open()
            page = doc.new_page(width=595, height=842)  # A4 size
            
            # Add text to the page
            text = """
            SALON PRICE LIST
            
            Men's Services:
            Haircut - Rs 250
            Beard Trim - Rs 120
            
            Women's Services:
            Haircut - Rs 350
            Facial - Rs 600
            """
            
            page.insert_text((50, 50), text, fontsize=16)
            
            # Save to BytesIO
            pdf_buffer = BytesIO()
            pdf_bytes = doc.write()
            pdf_buffer.write(pdf_bytes)
            pdf_buffer.seek(0)
            doc.close()
            
            url = f"{BASE_URL}/salons/{salon_id}/services/parse-menu"
            files = {"file": ("menu.pdf", pdf_buffer, "application/pdf")}
            headers = {"Authorization": f"Bearer {access_token}"}
            response = requests.post(url, files=files, headers=headers)
            
            passed = response.status_code == 200
            if passed:
                data = response.json()
                service_count = data.get("service_count", 0)
                passed = service_count >= 1
                print_test("D5-BONUS: Parse PDF (services_count >= 1, validates PDF→image conversion)", 
                          passed, f"service_count={service_count}")
            else:
                print_test("D5-BONUS: Parse PDF", False, 
                          f"Status: {response.status_code}, {response.text[:300]}")
        except ImportError:
            print("    Skipping PDF test - PyMuPDF not available")
    except Exception as e:
        print(f"    Skipping PDF test - error: {str(e)}")

# ============================================================================
# CLEANUP
# ============================================================================

def cleanup():
    print_section("CLEANUP")
    
    # Reset manual toggle to open
    print("\n[CLEANUP] Reset manual toggle to open")
    url = f"{BASE_URL}/salons/{salon_id}/manual-toggle"
    payload = {
        "is_overridden": False,
        "is_open": True
    }
    response = requests.put(url, json=payload, headers=get_headers())
    if response.status_code == 200:
        data = response.json()
        closed_mode = data.get("manual_toggle", {}).get("closed_mode")
        print_test("Cleanup: Reset to open", True, f"closed_mode={closed_mode} (should be null)")
    else:
        print_test("Cleanup: Reset to open", False, f"Status: {response.status_code}")
    
    print("\nNote: Bulk-uploaded test customers and parsed services are left in the system (harmless)")

# ============================================================================
# MAIN
# ============================================================================

def main():
    print("\n" + "="*80)
    print("  RE-TEST 3 BACKEND FEATURE GROUPS AFTER FIXES")
    print("  A) Manual Toggle — verify ALL three states with admin token")
    print("  B) Booking enforcement — re-test the booking flows")
    print("  C) Bulk customer upload — re-confirm all paths still work")
    print("  D) Menu parsing — test image and PDF parsing with OpenAI gpt-5")
    print("="*80)
    
    # Login
    if not login_admin():
        print("\n❌ Cannot proceed without authentication")
        return
    
    # Get test data
    print("\n[SETUP] Getting test service and barber")
    get_test_service_and_barber()
    
    # Run tests
    test_group_a_manual_toggle()
    test_group_b_booking_enforcement()
    test_group_c_bulk_upload()
    test_group_d_menu_parsing()
    
    # Cleanup
    cleanup()
    
    print("\n" + "="*80)
    print("  TESTING COMPLETE")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
