"""
Phase 1 Backend Testing — Salon Home KPIs + Direct Invoice

Tests the two NEW backend endpoints added in Phase 1:
1. GET /api/salons/{salon_id}/home-kpis?date_mode=today|tomorrow
2. POST /api/salons/{salon_id}/direct-invoice

Also includes regression test for:
3. POST /api/salons/{salon_id}/salon-booking (existing add-booking flow)

Total: 15+ comprehensive tests
"""

import httpx
import json
import random
import string
from datetime import datetime, date, timedelta

# Configuration
BASE_URL = "https://role-guard-system.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {"identifier": "admin", "password": "salon123"}

# Test state
admin_token = None
salon_id = None
test_service_id = None
test_barber_id = None
test_token_id = None


def random_string(length=8):
    """Generate random string for unique test data"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))


def print_test(test_num, description):
    """Print test header"""
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print('='*80)


def print_result(passed, message=""):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {message}")
    return passed


async def admin_login():
    """Login as salon admin and get token"""
    global admin_token, salon_id
    
    print_test("SETUP", "Admin Login")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/salon/users/login",
            json=ADMIN_CREDENTIALS
        )
        
        if response.status_code != 200:
            print_result(False, f"Login failed: {response.status_code} - {response.text}")
            return False
        
        data = response.json()
        admin_token = data.get("access_token")
        salon_id = data.get("salon_id")
        
        if not admin_token or not salon_id:
            print_result(False, f"Missing token or salon_id in response: {data}")
            return False
        
        print_result(True, f"Logged in successfully. Salon ID: {salon_id}")
        return True


async def get_test_service_and_barber():
    """Get a test service and barber for testing"""
    global test_service_id, test_barber_id
    
    print_test("SETUP", "Get Test Service and Barber")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Get services - try /all first, then /enabled
        response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/services/all",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            services = data if isinstance(data, list) else data.get("services", [])
            if services:
                # Find an enabled service
                for svc in services:
                    if svc.get("is_enabled_for_salon") or svc.get("is_enabled"):
                        test_service_id = svc.get("id")
                        print(f"✓ Found test service: {test_service_id}")
                        break
                if not test_service_id and services:
                    # Fallback to first service
                    test_service_id = services[0].get("id")
                    print(f"✓ Found test service (not enabled): {test_service_id}")
        
        # Get barbers
        response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/barbers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            barbers = data if isinstance(data, list) else data.get("barbers", [])
            if barbers:
                test_barber_id = barbers[0].get("id")
                print(f"✓ Found test barber: {test_barber_id}")
        
        if test_service_id and test_barber_id:
            print_result(True, f"Service: {test_service_id}, Barber: {test_barber_id}")
            return True
        else:
            print_result(False, "Could not find test service or barber")
            return False


# ============================================================================
# ENDPOINT 1: GET /api/salons/{salon_id}/home-kpis
# ============================================================================

async def test_kpis_1_today_default():
    """KPI-1: GET /home-kpis without date_mode → defaults to today, returns 200"""
    print_test("KPI-1", "GET /home-kpis (default today)")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/home-kpis",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        
        # Verify top-level keys
        required_keys = [
            "date_basis", "primary", "secondary", "staff_leaderboard",
            "reviews", "targets", "revenue_7d", "payment_mix", "top_services", "busy_hours"
        ]
        
        missing = [k for k in required_keys if k not in data]
        if missing:
            return print_result(False, f"Missing top-level keys: {missing}")
        
        # Verify date_basis is today
        today_str = date.today().isoformat()
        if data.get("date_basis") != today_str:
            return print_result(False, f"Expected date_basis={today_str}, got {data.get('date_basis')}")
        
        print(f"✓ date_basis: {data['date_basis']}")
        print(f"✓ All top-level keys present: {required_keys}")
        return print_result(True, "Default today mode working")


async def test_kpis_2_primary_structure():
    """KPI-2: Verify primary KPIs structure and numeric types"""
    print_test("KPI-2", "Primary KPIs structure")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/home-kpis?date_mode=today",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        primary = data.get("primary", {})
        
        required_fields = [
            "today_sales", "avg_ticket", "rebooking_rate", "no_show_rate", "chair_utilization"
        ]
        
        missing = [f for f in required_fields if f not in primary]
        if missing:
            return print_result(False, f"Missing primary fields: {missing}")
        
        # Verify all are numbers (not strings)
        for field in required_fields:
            value = primary[field]
            if not isinstance(value, (int, float)):
                return print_result(False, f"{field} is not numeric: {type(value)} = {value}")
        
        print(f"✓ Primary KPIs: {json.dumps(primary, indent=2)}")
        return print_result(True, "Primary KPIs structure valid")


async def test_kpis_3_secondary_structure():
    """KPI-3: Verify secondary KPIs structure"""
    print_test("KPI-3", "Secondary KPIs structure")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/home-kpis?date_mode=today",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        secondary = data.get("secondary", {})
        
        required_fields = [
            "appointments_count", "new_clients_count", "retention_rate",
            "retail_sales", "reminder_confirmation_rate", "waitlist_count"
        ]
        
        missing = [f for f in required_fields if f not in secondary]
        if missing:
            return print_result(False, f"Missing secondary fields: {missing}")
        
        # Verify all are numbers
        for field in required_fields:
            value = secondary[field]
            if not isinstance(value, (int, float)) and value is not None:
                return print_result(False, f"{field} is not numeric: {type(value)} = {value}")
        
        print(f"✓ Secondary KPIs: {json.dumps(secondary, indent=2)}")
        return print_result(True, "Secondary KPIs structure valid")


async def test_kpis_4_staff_leaderboard():
    """KPI-4: Verify staff_leaderboard is array with correct structure"""
    print_test("KPI-4", "Staff leaderboard structure")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/home-kpis?date_mode=today",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        leaderboard = data.get("staff_leaderboard", [])
        
        if not isinstance(leaderboard, list):
            return print_result(False, f"staff_leaderboard is not array: {type(leaderboard)}")
        
        # If empty, that's OK (no data yet)
        if len(leaderboard) == 0:
            print("✓ staff_leaderboard is empty array (no data)")
            return print_result(True, "Empty leaderboard is valid")
        
        # If not empty, verify structure
        first = leaderboard[0]
        required_fields = ["barber_id", "barber_name", "sales", "tips", "bookings", "rebook_pct"]
        missing = [f for f in required_fields if f not in first]
        if missing:
            return print_result(False, f"Missing leaderboard fields: {missing}")
        
        print(f"✓ Leaderboard has {len(leaderboard)} entries")
        print(f"✓ First entry: {json.dumps(first, indent=2)}")
        return print_result(True, "Staff leaderboard structure valid")


async def test_kpis_5_reviews():
    """KPI-5: Verify reviews structure"""
    print_test("KPI-5", "Reviews structure")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/home-kpis?date_mode=today",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        reviews = data.get("reviews", {})
        
        required_fields = ["avg_rating", "total_reviews", "distribution"]
        missing = [f for f in required_fields if f not in reviews]
        if missing:
            return print_result(False, f"Missing review fields: {missing}")
        
        # Verify distribution has keys "1" through "5"
        dist = reviews.get("distribution", {})
        if not isinstance(dist, dict):
            return print_result(False, f"distribution is not dict: {type(dist)}")
        
        for star in ["1", "2", "3", "4", "5"]:
            if star not in dist:
                return print_result(False, f"Missing star rating '{star}' in distribution")
        
        print(f"✓ Reviews: {json.dumps(reviews, indent=2)}")
        return print_result(True, "Reviews structure valid")


async def test_kpis_6_targets():
    """KPI-6: Verify targets structure"""
    print_test("KPI-6", "Targets structure")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/home-kpis?date_mode=today",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        targets = data.get("targets", {})
        
        required_fields = [
            "daily_target", "daily_actual", "monthly_target",
            "monthly_actual", "membership_target", "membership_actual"
        ]
        missing = [f for f in required_fields if f not in targets]
        if missing:
            return print_result(False, f"Missing target fields: {missing}")
        
        print(f"✓ Targets: {json.dumps(targets, indent=2)}")
        return print_result(True, "Targets structure valid")


async def test_kpis_7_revenue_7d():
    """KPI-7: Verify revenue_7d is array of {date, total}"""
    print_test("KPI-7", "Revenue 7d structure")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/home-kpis?date_mode=today",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        revenue_7d = data.get("revenue_7d", [])
        
        if not isinstance(revenue_7d, list):
            return print_result(False, f"revenue_7d is not array: {type(revenue_7d)}")
        
        # Should have 7 entries (even if zeros)
        if len(revenue_7d) != 7:
            print(f"⚠ Warning: revenue_7d has {len(revenue_7d)} entries, expected 7")
        
        # Verify structure if not empty
        if len(revenue_7d) > 0:
            first = revenue_7d[0]
            if "date" not in first or "total" not in first:
                return print_result(False, f"Missing date/total in revenue_7d entry: {first}")
        
        print(f"✓ revenue_7d has {len(revenue_7d)} entries")
        return print_result(True, "Revenue 7d structure valid")


async def test_kpis_8_payment_mix():
    """KPI-8: Verify payment_mix is dict of mode -> amount"""
    print_test("KPI-8", "Payment mix structure")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/home-kpis?date_mode=today",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        payment_mix = data.get("payment_mix", {})
        
        if not isinstance(payment_mix, dict):
            return print_result(False, f"payment_mix is not dict: {type(payment_mix)}")
        
        # If empty, that's OK
        if len(payment_mix) == 0:
            print("✓ payment_mix is empty dict (no data)")
            return print_result(True, "Empty payment_mix is valid")
        
        # Verify all values are numbers
        for mode, amount in payment_mix.items():
            if not isinstance(amount, (int, float)):
                return print_result(False, f"payment_mix[{mode}] is not numeric: {type(amount)}")
        
        print(f"✓ Payment mix: {json.dumps(payment_mix, indent=2)}")
        return print_result(True, "Payment mix structure valid")


async def test_kpis_9_top_services():
    """KPI-9: Verify top_services is array with service_id, service_name, count, revenue"""
    print_test("KPI-9", "Top services structure")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/home-kpis?date_mode=today",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        top_services = data.get("top_services", [])
        
        if not isinstance(top_services, list):
            return print_result(False, f"top_services is not array: {type(top_services)}")
        
        # If empty, that's OK
        if len(top_services) == 0:
            print("✓ top_services is empty array (no data)")
            return print_result(True, "Empty top_services is valid")
        
        # Verify structure
        first = top_services[0]
        required_fields = ["service_id", "service_name", "count", "revenue"]
        missing = [f for f in required_fields if f not in first]
        if missing:
            return print_result(False, f"Missing top_services fields: {missing}")
        
        print(f"✓ Top services has {len(top_services)} entries")
        print(f"✓ First entry: {json.dumps(first, indent=2)}")
        return print_result(True, "Top services structure valid")


async def test_kpis_10_busy_hours():
    """KPI-10: Verify busy_hours is dict with hour keys "0" through "23"""
    print_test("KPI-10", "Busy hours structure")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/home-kpis?date_mode=today",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        busy_hours = data.get("busy_hours", {})
        
        if not isinstance(busy_hours, dict):
            return print_result(False, f"busy_hours is not dict: {type(busy_hours)}")
        
        # Should have keys "0" through "23" (even if zeros)
        for hour in range(24):
            key = str(hour)
            if key not in busy_hours:
                return print_result(False, f"Missing hour '{key}' in busy_hours")
        
        print(f"✓ busy_hours has all 24 hour keys")
        return print_result(True, "Busy hours structure valid")


async def test_kpis_11_tomorrow():
    """KPI-11: GET /home-kpis?date_mode=tomorrow → returns tomorrow's date"""
    print_test("KPI-11", "GET /home-kpis with date_mode=tomorrow")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/home-kpis?date_mode=tomorrow",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        
        # Verify date_basis is tomorrow
        tomorrow_str = (date.today() + timedelta(days=1)).isoformat()
        if data.get("date_basis") != tomorrow_str:
            return print_result(False, f"Expected date_basis={tomorrow_str}, got {data.get('date_basis')}")
        
        print(f"✓ date_basis: {data['date_basis']} (tomorrow)")
        return print_result(True, "Tomorrow mode working")


async def test_kpis_12_no_auth():
    """KPI-12: GET /home-kpis without auth → 401/403"""
    print_test("KPI-12", "GET /home-kpis without auth")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/home-kpis"
        )
        
        if response.status_code in [401, 403]:
            return print_result(True, f"Correctly rejected with {response.status_code}")
        else:
            return print_result(False, f"Expected 401/403, got {response.status_code}")


async def test_kpis_13_empty_data():
    """KPI-13: Verify endpoint doesn't 500 on salon with no data"""
    print_test("KPI-13", "GET /home-kpis with no data (should return zeros, not 500)")
    
    # This test uses the current salon which may or may not have data
    # The key is that it should NOT return 500
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/home-kpis?date_mode=today",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code == 500:
            return print_result(False, f"Endpoint returned 500: {response.text}")
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        
        # Verify arrays exist even when empty
        if not isinstance(data.get("staff_leaderboard"), list):
            return print_result(False, "staff_leaderboard is not array")
        if not isinstance(data.get("top_services"), list):
            return print_result(False, "top_services is not array")
        if not isinstance(data.get("revenue_7d"), list):
            return print_result(False, "revenue_7d is not array")
        
        print("✓ Endpoint returns proper structure even with no/minimal data")
        return print_result(True, "No 500 error on empty data")


# ============================================================================
# ENDPOINT 2: POST /api/salons/{salon_id}/direct-invoice
# ============================================================================

async def test_invoice_1_happy_path():
    """INV-1: POST /direct-invoice with cash payment and 1 service → 200 + token created"""
    print_test("INV-1", "POST /direct-invoice happy path (cash + 1 service)")
    
    if not test_service_id or not test_barber_id:
        return print_result(False, "Missing test service or barber")
    
    phone = f"98765{random.randint(10000, 99999)}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/salons/{salon_id}/direct-invoice",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "customer_name": "Walk-in Test",
                "phone": phone,
                "gender": "Men",
                "barber_id": test_barber_id,
                "selected_services": [test_service_id],
                "payment_mode": "cash",
                "tip_amount": 0,
                "notes": "Test invoice"
            }
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        
        # Verify response structure
        required_fields = ["success", "token_id", "token_number", "totals"]
        missing = [f for f in required_fields if f not in data]
        if missing:
            return print_result(False, f"Missing response fields: {missing}")
        
        if not data.get("success"):
            return print_result(False, f"success is not true: {data}")
        
        global test_token_id
        test_token_id = data.get("token_id")
        
        # Verify totals structure
        totals = data.get("totals", {})
        totals_fields = ["subtotal", "services_total", "grand_total"]
        missing_totals = [f for f in totals_fields if f not in totals]
        if missing_totals:
            return print_result(False, f"Missing totals fields: {missing_totals}")
        
        print(f"✓ Token created: {data['token_number']} (ID: {test_token_id})")
        print(f"✓ Totals: {json.dumps(totals, indent=2)}")
        return print_result(True, "Direct invoice created successfully")


async def test_invoice_2_verify_token():
    """INV-2: Verify token is in db.tokens with status=completed, is_direct_invoice=True"""
    print_test("INV-2", "Verify token in database")
    
    if not test_token_id:
        return print_result(False, "No test_token_id from previous test")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Get specific token by ID
        response = await client.get(
            f"{BASE_URL}/tokens/{test_token_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        our_token = response.json()
        
        # Verify status
        if our_token.get("status") != "completed":
            return print_result(False, f"Expected status=completed, got {our_token.get('status')}")
        
        # Verify is_direct_invoice
        if not our_token.get("is_direct_invoice"):
            return print_result(False, f"is_direct_invoice is not True: {our_token.get('is_direct_invoice')}")
        
        # Verify payment_confirmed
        if not our_token.get("payment_confirmed"):
            return print_result(False, f"payment_confirmed is not True: {our_token.get('payment_confirmed')}")
        
        print(f"✓ Token status: {our_token.get('status')}")
        print(f"✓ is_direct_invoice: {our_token.get('is_direct_invoice')}")
        print(f"✓ payment_confirmed: {our_token.get('payment_confirmed')}")
        return print_result(True, "Token verified in database")


async def test_invoice_3_missing_services():
    """INV-3: POST /direct-invoice with no selected_services → 400"""
    print_test("INV-3", "POST /direct-invoice with missing services")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/salons/{salon_id}/direct-invoice",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "customer_name": "Test",
                "phone": "9876543210",
                "gender": "Men",
                "barber_id": "any",
                "selected_services": [],  # Empty
                "payment_mode": "cash"
            }
        )
        
        if response.status_code == 400:
            return print_result(True, f"Correctly rejected with 400: {response.json().get('detail')}")
        else:
            return print_result(False, f"Expected 400, got {response.status_code}")


async def test_invoice_4_wallet_no_phone():
    """INV-4: POST /direct-invoice with payment_mode=wallet but no phone → should handle gracefully"""
    print_test("INV-4", "POST /direct-invoice with wallet payment but no phone")
    
    if not test_service_id:
        return print_result(False, "Missing test service")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/salons/{salon_id}/direct-invoice",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "customer_name": "Test",
                "phone": "",  # Empty phone
                "gender": "Men",
                "barber_id": "any",
                "selected_services": [test_service_id],
                "payment_mode": "wallet"
            }
        )
        
        # The endpoint may allow wallet without phone (walk-in scenario)
        # or may reject it. Both are acceptable behaviors.
        if response.status_code == 200:
            # Allowed - this is OK for walk-in scenarios
            print("✓ Endpoint allows wallet payment without phone (walk-in scenario)")
            return print_result(True, "Wallet payment handled (200 OK)")
        elif response.status_code in [400, 404]:
            # Rejected - also acceptable
            print(f"✓ Endpoint rejects wallet without phone: {response.json().get('detail')}")
            return print_result(True, f"Correctly rejected with {response.status_code}")
        else:
            return print_result(False, f"Unexpected status {response.status_code}: {response.text}")


async def test_invoice_5_kpis_reflect_sale():
    """INV-5: After invoice, GET /home-kpis should reflect new sale in today_sales"""
    print_test("INV-5", "Verify KPIs reflect new invoice sale")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Get KPIs before
        response_before = await client.get(
            f"{BASE_URL}/salons/{salon_id}/home-kpis?date_mode=today",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response_before.status_code != 200:
            return print_result(False, f"KPIs before failed: {response_before.status_code}")
        
        before_sales = response_before.json().get("primary", {}).get("today_sales", 0)
        
        # Create a new invoice
        phone = f"98765{random.randint(10000, 99999)}"
        response_invoice = await client.post(
            f"{BASE_URL}/salons/{salon_id}/direct-invoice",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "customer_name": "KPI Test",
                "phone": phone,
                "gender": "Men",
                "barber_id": test_barber_id or "any",
                "selected_services": [test_service_id] if test_service_id else [],
                "payment_mode": "cash",
                "tip_amount": 0
            }
        )
        
        if response_invoice.status_code != 200:
            return print_result(False, f"Invoice creation failed: {response_invoice.status_code}")
        
        invoice_total = response_invoice.json().get("totals", {}).get("grand_total", 0)
        
        # Get KPIs after
        response_after = await client.get(
            f"{BASE_URL}/salons/{salon_id}/home-kpis?date_mode=today",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response_after.status_code != 200:
            return print_result(False, f"KPIs after failed: {response_after.status_code}")
        
        after_sales = response_after.json().get("primary", {}).get("today_sales", 0)
        
        # Verify sales increased
        expected_sales = before_sales + invoice_total
        if abs(after_sales - expected_sales) < 0.01:  # Allow small floating point difference
            print(f"✓ Sales before: {before_sales}")
            print(f"✓ Invoice total: {invoice_total}")
            print(f"✓ Sales after: {after_sales}")
            return print_result(True, "KPIs correctly reflect new sale")
        else:
            print(f"⚠ Sales before: {before_sales}")
            print(f"⚠ Invoice total: {invoice_total}")
            print(f"⚠ Sales after: {after_sales}")
            print(f"⚠ Expected: {expected_sales}")
            return print_result(False, f"Sales mismatch: expected {expected_sales}, got {after_sales}")


# ============================================================================
# REGRESSION: POST /api/salons/{salon_id}/salon-booking
# ============================================================================

async def test_regression_1_salon_booking():
    """REG-1: POST /salon-booking (existing add-booking flow) still works"""
    print_test("REG-1", "Regression: POST /salon-booking")
    
    if not test_service_id or not test_barber_id:
        return print_result(False, "Missing test service or barber")
    
    phone = f"98765{random.randint(10000, 99999)}"
    today = date.today().isoformat()
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/salons/{salon_id}/salon-booking",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "customer_name": "Regression Test",
                "phone": phone,
                "gender": "Men",
                "barber_id": test_barber_id,
                "selected_services": [test_service_id],
                "date": today,
                "shift": "Morning",
                "payment_mode": "cash"
            }
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        
        # Verify response has token info
        if "token_number" not in data:
            return print_result(False, f"Missing token_number in response: {data}")
        
        print(f"✓ Booking created: {data.get('token_number')}")
        return print_result(True, "Existing salon-booking endpoint still works")


# ============================================================================
# Main Test Runner
# ============================================================================

async def run_all_tests():
    """Run all Phase 1 backend tests"""
    print("\n" + "="*80)
    print("PHASE 1 BACKEND TESTING — Salon Home KPIs + Direct Invoice")
    print("="*80)
    
    results = []
    
    # Setup
    if not await admin_login():
        print("\n❌ CRITICAL: Admin login failed. Cannot proceed with tests.")
        return
    
    if not await get_test_service_and_barber():
        print("\n⚠ WARNING: Could not get test service/barber. Some tests may fail.")
    
    # KPI Tests (13 tests)
    results.append(await test_kpis_1_today_default())
    results.append(await test_kpis_2_primary_structure())
    results.append(await test_kpis_3_secondary_structure())
    results.append(await test_kpis_4_staff_leaderboard())
    results.append(await test_kpis_5_reviews())
    results.append(await test_kpis_6_targets())
    results.append(await test_kpis_7_revenue_7d())
    results.append(await test_kpis_8_payment_mix())
    results.append(await test_kpis_9_top_services())
    results.append(await test_kpis_10_busy_hours())
    results.append(await test_kpis_11_tomorrow())
    results.append(await test_kpis_12_no_auth())
    results.append(await test_kpis_13_empty_data())
    
    # Invoice Tests (5 tests)
    results.append(await test_invoice_1_happy_path())
    results.append(await test_invoice_2_verify_token())
    results.append(await test_invoice_3_missing_services())
    results.append(await test_invoice_4_wallet_no_phone())
    results.append(await test_invoice_5_kpis_reflect_sale())
    
    # Regression Tests (1 test)
    results.append(await test_regression_1_salon_booking())
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    passed = sum(1 for r in results if r)
    total = len(results)
    print(f"\nTotal: {passed}/{total} tests passed ({passed*100//total}%)")
    
    if passed == total:
        print("\n✅ ALL TESTS PASSED — Phase 1 backend is production-ready!")
    else:
        print(f"\n❌ {total - passed} test(s) failed — review output above for details")
    
    return passed == total


if __name__ == "__main__":
    import asyncio
    asyncio.run(run_all_tests())
