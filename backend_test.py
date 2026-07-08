#!/usr/bin/env python3
"""
Phase 2 Backend Regression Tests
=================================

Tests 6 specific checks:
1. POST /api/platform/salons/{id}/subscription/grant-pro with duration_days and duration_months
2. NEW salon → empty services list
3. Salon creates service → tagged with salon_id
4. Regression: POST /api/salons/{salon_id}/salon-booking still works
5. Regression: POST /api/salons/{salon_id}/direct-invoice still works
6. Regression: GET /api/salons/{salon_id}/home-kpis?date_mode=today returns all required keys
"""

import os
import sys
import requests
import json
import random
import string
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
mongo_client = MongoClient(MONGO_URL)
mongo_db = mongo_client[DB_NAME]

# Backend URL from environment or default
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://1075d602-59d4-41bc-a76b-036ee0647a4f.preview.emergentagent.com").rstrip("/")
API_URL = f"{BASE_URL}/api"

# Test credentials from test_credentials.md
ADMIN_IDENTIFIER = "admin"
ADMIN_PASSWORD = "salon123"

# Test results
test_results = []
total_tests = 0
passed_tests = 0


def log_test(test_name, passed, details=""):
    """Log test result"""
    global total_tests, passed_tests
    total_tests += 1
    if passed:
        passed_tests += 1
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"{status}: {test_name}"
    if details:
        result += f"\n    {details}"
    test_results.append(result)
    print(result)


def random_phone():
    """Generate random 10-digit phone number"""
    return "".join(random.choices(string.digits, k=10))


def random_string(length=6):
    """Generate random alphanumeric string"""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


# ============================================================================
# TEST 1: Platform Admin Login
# ============================================================================

def test_platform_admin_login():
    """Get platform admin JWT token"""
    print("\n" + "="*80)
    print("TEST 1: Platform Admin Authentication")
    print("="*80)
    
    # Check if platform admin exists in database
    try:
        admin = mongo_db.platform_admins.find_one({"mobile": "+917503070727"}, {"_id": 0})
        if not admin:
            log_test("Platform admin check", False, "SKIPPED: PLATFORM_OWNER_MOBILE not seeded (no admin found in DB)")
            return "SKIP"
        log_test("Platform admin check", True, f"Platform admin found: {admin.get('mobile')}")
    except Exception as e:
        log_test("Platform admin check", False, f"Database error: {str(e)}")
        return "SKIP"
    
    # Step 1: Request OTP
    try:
        response = requests.post(
            f"{API_URL}/platform/auth/request-otp",
            json={"mobile": "7503070727"},
            timeout=10
        )
        if response.status_code != 200:
            log_test("Platform admin OTP request", False, f"Status: {response.status_code}, Response: {response.text}")
            return None
        log_test("Platform admin OTP request", True, "OTP requested successfully")
    except Exception as e:
        log_test("Platform admin OTP request", False, str(e))
        return None
    
    # Step 2: Verify OTP (fetch from MongoDB since it's not in response)
    try:
        # Get OTP from MongoDB
        otp_doc = mongo_db.platform_otp.find_one({"mobile": "+917503070727"}, {"_id": 0})
        if not otp_doc:
            log_test("Platform admin OTP verify", False, "No OTP found in database")
            return None
        
        otp = otp_doc.get("otp")
        if not otp:
            log_test("Platform admin OTP verify", False, "OTP field missing in database")
            return None
        
        response = requests.post(
            f"{API_URL}/platform/auth/verify-otp",
            json={"mobile": "7503070727", "otp": otp},
            timeout=10
        )
        if response.status_code != 200:
            log_test("Platform admin OTP verify", False, f"Status: {response.status_code}, Response: {response.text}")
            return None
        
        data = response.json()
        token = data.get("access_token")
        if not token:
            log_test("Platform admin OTP verify", False, "No access_token in response")
            return None
        
        log_test("Platform admin OTP verify", True, f"Token obtained (length: {len(token)})")
        return token
    except Exception as e:
        log_test("Platform admin OTP verify", False, str(e))
        return None


# ============================================================================
# TEST 2: Salon Admin Login
# ============================================================================

def test_salon_admin_login():
    """Get salon admin JWT token"""
    print("\n" + "="*80)
    print("TEST 2: Salon Admin Authentication")
    print("="*80)
    
    try:
        response = requests.post(
            f"{API_URL}/salon/users/login",
            json={"identifier": ADMIN_IDENTIFIER, "password": ADMIN_PASSWORD},
            timeout=10
        )
        if response.status_code != 200:
            log_test("Salon admin login", False, f"Status: {response.status_code}, Response: {response.text}")
            return None, None
        
        data = response.json()
        token = data.get("access_token")
        salon_id = data.get("salon_id")
        
        if not token or not salon_id:
            log_test("Salon admin login", False, f"Missing token or salon_id in response")
            return None, None
        
        log_test("Salon admin login", True, f"Token obtained, salon_id: {salon_id}")
        return token, salon_id
    except Exception as e:
        log_test("Salon admin login", False, str(e))
        return None, None


# ============================================================================
# TEST 3: Grant Pro Access with duration_days and duration_months
# ============================================================================

def test_grant_pro_access(platform_token, salon_id):
    """Test POST /api/platform/salons/{id}/subscription/grant-pro"""
    print("\n" + "="*80)
    print("TEST 3: Grant Pro Access (duration_days and duration_months)")
    print("="*80)
    
    if platform_token == "SKIP":
        log_test("Grant Pro - duration_days=45", False, "SKIPPED: PLATFORM_OWNER_MOBILE not seeded")
        log_test("Grant Pro - duration_months=2", False, "SKIPPED: PLATFORM_OWNER_MOBILE not seeded")
        return
    
    if not platform_token or not salon_id:
        log_test("Grant Pro - duration_days=45", False, "Missing platform token or salon_id")
        log_test("Grant Pro - duration_months=2", False, "Missing platform token or salon_id")
        return
    
    headers = {"Authorization": f"Bearer {platform_token}"}
    
    # Test 3a: Grant with duration_days=45
    try:
        response = requests.post(
            f"{API_URL}/platform/salons/{salon_id}/subscription/grant-pro",
            json={
                "duration_days": 45,
                "reason": "Phase 2 test - 45 days",
                "max_branches": 1
            },
            headers=headers,
            timeout=10
        )
        
        if response.status_code != 200:
            log_test("Grant Pro - duration_days=45", False, f"Status: {response.status_code}, Response: {response.text}")
        else:
            data = response.json()
            subscription_id = data.get("subscription_id")
            
            # Verify expiry date is roughly 45 days from now
            if subscription_id:
                # Get subscription details
                sub_response = requests.get(
                    f"{API_URL}/salons/{salon_id}/subscription/status",
                    headers={"Authorization": f"Bearer {platform_token}"},
                    timeout=10
                )
                if sub_response.status_code == 200:
                    sub_data = sub_response.json()
                    expiry_date = sub_data.get("expiry_date")
                    if expiry_date:
                        expiry_dt = datetime.fromisoformat(expiry_date.replace("Z", "+00:00"))
                        now = datetime.now(timezone.utc)
                        days_diff = (expiry_dt - now).days
                        
                        # Allow ±1 day tolerance
                        if 44 <= days_diff <= 46:
                            log_test("Grant Pro - duration_days=45", True, f"Expiry date ~{days_diff} days from now")
                        else:
                            log_test("Grant Pro - duration_days=45", False, f"Expiry date {days_diff} days from now (expected ~45)")
                    else:
                        log_test("Grant Pro - duration_days=45", False, "No expiry_date in subscription status")
                else:
                    log_test("Grant Pro - duration_days=45", False, f"Failed to get subscription status: {sub_response.status_code}")
            else:
                log_test("Grant Pro - duration_days=45", False, "No subscription_id in response")
    except Exception as e:
        log_test("Grant Pro - duration_days=45", False, str(e))
    
    # Test 3b: Grant with duration_months=2
    try:
        response = requests.post(
            f"{API_URL}/platform/salons/{salon_id}/subscription/grant-pro",
            json={
                "duration_months": 2,
                "reason": "Phase 2 test - 2 months",
                "max_branches": 1
            },
            headers=headers,
            timeout=10
        )
        
        if response.status_code != 200:
            log_test("Grant Pro - duration_months=2", False, f"Status: {response.status_code}, Response: {response.text}")
        else:
            data = response.json()
            subscription_id = data.get("subscription_id")
            
            # Verify expiry date is roughly 60 days from now
            if subscription_id:
                # Get subscription details
                sub_response = requests.get(
                    f"{API_URL}/salons/{salon_id}/subscription/status",
                    headers={"Authorization": f"Bearer {platform_token}"},
                    timeout=10
                )
                if sub_response.status_code == 200:
                    sub_data = sub_response.json()
                    expiry_date = sub_data.get("expiry_date")
                    if expiry_date:
                        expiry_dt = datetime.fromisoformat(expiry_date.replace("Z", "+00:00"))
                        now = datetime.now(timezone.utc)
                        days_diff = (expiry_dt - now).days
                        
                        # Allow ±1 day tolerance (2 months = 60 days)
                        if 59 <= days_diff <= 61:
                            log_test("Grant Pro - duration_months=2", True, f"Expiry date ~{days_diff} days from now")
                        else:
                            log_test("Grant Pro - duration_months=2", False, f"Expiry date {days_diff} days from now (expected ~60)")
                    else:
                        log_test("Grant Pro - duration_months=2", False, "No expiry_date in subscription status")
                else:
                    log_test("Grant Pro - duration_months=2", False, f"Failed to get subscription status: {sub_response.status_code}")
            else:
                log_test("Grant Pro - duration_months=2", False, "No subscription_id in response")
    except Exception as e:
        log_test("Grant Pro - duration_months=2", False, str(e))


# ============================================================================
# TEST 4: NEW salon → empty services list
# ============================================================================

def test_new_salon_empty_services():
    """Test that new salon has empty services list"""
    print("\n" + "="*80)
    print("TEST 4: NEW Salon → Empty Services List")
    print("="*80)
    
    # Register a new salon with unique phone
    unique_phone = f"+91{random_phone()}"
    
    try:
        response = requests.post(
            f"{API_URL}/salon/register",
            json={
                "salon_name": f"Test Salon {random_string()}",
                "owner_name": "Test Owner",
                "phone": unique_phone,
                "address": "Test Address",
                "latitude": 12.9716,
                "longitude": 77.5946,
                "password": "test123456"
            },
            timeout=10
        )
        
        if response.status_code != 200:
            log_test("Register new salon", False, f"Status: {response.status_code}, Response: {response.text}")
            return
        
        data = response.json()
        new_salon_id = data.get("id")
        
        if not new_salon_id:
            log_test("Register new salon", False, f"No salon_id in response. Response: {data}")
            return
        
        log_test("Register new salon", True, f"Salon created: {new_salon_id}")
        
        # Login as the new salon
        login_response = requests.post(
            f"{API_URL}/salon/password-login",
            json={"phone": unique_phone, "password": "test123456"},
            timeout=10
        )
        
        if login_response.status_code != 200:
            log_test("New salon login", False, f"Status: {login_response.status_code}")
            return
        
        login_data = login_response.json()
        new_salon_token = login_data.get("access_token")
        
        if not new_salon_token:
            log_test("New salon login", False, "No access_token in response")
            return
        
        log_test("New salon login", True, "Login successful")
        
        # Get services list - should be empty
        services_response = requests.get(
            f"{API_URL}/salons/{new_salon_id}/services/all",
            headers={"Authorization": f"Bearer {new_salon_token}"},
            timeout=10
        )
        
        if services_response.status_code != 200:
            log_test("New salon services list", False, f"Status: {services_response.status_code}")
            return
        
        services_data = services_response.json()
        # The endpoint returns a dict with "services" key OR a list directly
        if isinstance(services_data, dict):
            services = services_data.get("services", [])
        else:
            services = services_data if isinstance(services_data, list) else []
        
        if len(services) == 0:
            log_test("New salon services list", True, "Services list is empty as expected")
        else:
            log_test("New salon services list", False, f"Expected empty list, got {len(services)} services")
        
    except Exception as e:
        log_test("New salon empty services test", False, str(e))


# ============================================================================
# TEST 5: Salon creates service → tagged with salon_id
# ============================================================================

def test_salon_creates_service(salon_token, salon_id):
    """Test that salon-created service is tagged with salon_id"""
    print("\n" + "="*80)
    print("TEST 5: Salon Creates Service → Tagged with salon_id")
    print("="*80)
    
    if not salon_token or not salon_id:
        log_test("Create service with salon_id", False, "Missing salon token or salon_id")
        return
    
    headers = {"Authorization": f"Bearer {salon_token}"}
    service_name = f"Phase2 Test Service {random_string()}"
    
    try:
        # Create a new service
        response = requests.post(
            f"{API_URL}/services",
            json={
                "service_name": service_name,
                "base_price": 100,
                "default_duration": 15,
                "category": "General"
            },
            headers=headers,
            timeout=10
        )
        
        if response.status_code != 200:
            log_test("Create service", False, f"Status: {response.status_code}, Response: {response.text}")
            return
        
        data = response.json()
        service_id = data.get("id")
        
        if not service_id:
            log_test("Create service", False, "No service_id in response")
            return
        
        log_test("Create service", True, f"Service created: {service_id}")
        
        # Get services list and verify the new service appears with salon_id
        services_response = requests.get(
            f"{API_URL}/salons/{salon_id}/services/all",
            headers=headers,
            timeout=10
        )
        
        if services_response.status_code != 200:
            log_test("Verify service in list", False, f"Status: {services_response.status_code}")
            return
        
        services_data = services_response.json()
        # The endpoint returns a dict with "services" key OR a list directly
        if isinstance(services_data, dict):
            services = services_data.get("services", [])
        else:
            services = services_data if isinstance(services_data, list) else []
        
        # Find the created service
        created_service = None
        for svc in services:
            if svc.get("id") == service_id:
                created_service = svc
                break
        
        if not created_service:
            log_test("Verify service in list", False, f"Service {service_id} not found in services list")
            return
        
        # Check if service has salon_id and is_owned=true
        service_salon_id = created_service.get("salon_id")
        is_owned = created_service.get("is_owned")
        is_enabled = created_service.get("is_enabled_for_salon")
        
        if service_salon_id == salon_id and is_owned is True:
            log_test("Service tagged with salon_id", True, f"salon_id={salon_id}, is_owned=true, is_enabled_for_salon={is_enabled}")
        else:
            log_test("Service tagged with salon_id", False, f"salon_id={service_salon_id} (expected {salon_id}), is_owned={is_owned}")
        
    except Exception as e:
        log_test("Salon creates service test", False, str(e))


# ============================================================================
# TEST 6: Regression - salon-booking still works
# ============================================================================

def test_salon_booking_regression(salon_token, salon_id):
    """Test POST /api/salons/{salon_id}/salon-booking still works"""
    print("\n" + "="*80)
    print("TEST 6: Regression - salon-booking Still Works")
    print("="*80)
    
    if not salon_token or not salon_id:
        log_test("salon-booking regression", False, "Missing salon token or salon_id")
        return
    
    headers = {"Authorization": f"Bearer {salon_token}"}
    
    try:
        # Get barbers
        barbers_response = requests.get(
            f"{API_URL}/salons/{salon_id}/barbers",
            headers=headers,
            timeout=10
        )
        
        if barbers_response.status_code != 200:
            log_test("Get barbers for booking", False, f"Status: {barbers_response.status_code}")
            return
        
        barbers = barbers_response.json()
        if not barbers or len(barbers) == 0:
            log_test("Get barbers for booking", False, "No barbers found")
            return
        
        barber_id = barbers[0].get("id")
        log_test("Get barbers for booking", True, f"Found barber: {barber_id}")
        
        # Get enabled services (or all services if enabled is empty)
        services_response = requests.get(
            f"{API_URL}/salons/{salon_id}/services/all",
            headers=headers,
            timeout=10
        )
        
        if services_response.status_code != 200:
            log_test("Get services for booking", False, f"Status: {services_response.status_code}")
            return
        
        services_data = services_response.json()
        # The endpoint returns a dict with "services" key OR a list directly
        if isinstance(services_data, dict):
            services = services_data.get("services", [])
        else:
            services = services_data if isinstance(services_data, list) else []
        
        if not services or len(services) == 0:
            log_test("Get services for booking", False, "No services found")
            return
        
        service_id = services[0].get("id")
        log_test("Get services for booking", True, f"Found service: {service_id}")
        
        # Create booking
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        booking_response = requests.post(
            f"{API_URL}/salons/{salon_id}/salon-booking",
            json={
                "customer_name": "Test QA Customer",
                "phone": "9999900001",
                "gender": "Men",
                "barber_id": barber_id,
                "selected_services": [service_id],
                "date": today,
                "shift": "Morning",
                "payment_mode": "cash"
            },
            headers=headers,
            timeout=10
        )
        
        if booking_response.status_code != 200:
            log_test("Create salon-booking", False, f"Status: {booking_response.status_code}, Response: {booking_response.text}")
            return
        
        booking_data = booking_response.json()
        token_number = booking_data.get("token_number")
        
        if token_number:
            log_test("Create salon-booking", True, f"Booking created with token: {token_number}")
        else:
            log_test("Create salon-booking", False, "No token_number in response")
        
    except Exception as e:
        log_test("salon-booking regression test", False, str(e))


# ============================================================================
# TEST 7: Regression - direct-invoice still works
# ============================================================================

def test_direct_invoice_regression(salon_token, salon_id):
    """Test POST /api/salons/{salon_id}/direct-invoice still works"""
    print("\n" + "="*80)
    print("TEST 7: Regression - direct-invoice Still Works")
    print("="*80)
    
    if not salon_token or not salon_id:
        log_test("direct-invoice regression", False, "Missing salon token or salon_id")
        return
    
    headers = {"Authorization": f"Bearer {salon_token}"}
    
    try:
        # Get barbers
        barbers_response = requests.get(
            f"{API_URL}/salons/{salon_id}/barbers",
            headers=headers,
            timeout=10
        )
        
        if barbers_response.status_code != 200:
            log_test("Get barbers for invoice", False, f"Status: {barbers_response.status_code}")
            return
        
        barbers = barbers_response.json()
        if not barbers or len(barbers) == 0:
            log_test("Get barbers for invoice", False, "No barbers found")
            return
        
        barber_id = barbers[0].get("id")
        log_test("Get barbers for invoice", True, f"Found barber: {barber_id}")
        
        # Get enabled services (or all services if enabled is empty)
        services_response = requests.get(
            f"{API_URL}/salons/{salon_id}/services/all",
            headers=headers,
            timeout=10
        )
        
        if services_response.status_code != 200:
            log_test("Get services for invoice", False, f"Status: {services_response.status_code}")
            return
        
        services_data = services_response.json()
        # The endpoint returns a dict with "services" key OR a list directly
        if isinstance(services_data, dict):
            services = services_data.get("services", [])
        else:
            services = services_data if isinstance(services_data, list) else []
        
        if not services or len(services) == 0:
            log_test("Get services for invoice", False, "No services found")
            return
        
        service = services[0]
        service_id = service.get("id")
        service_name = service.get("service_name", "Service")
        base_price = service.get("base_price", 100)
        default_duration = service.get("default_duration", 15)
        
        log_test("Get services for invoice", True, f"Found service: {service_id}")
        
        # Create direct invoice
        invoice_response = requests.post(
            f"{API_URL}/salons/{salon_id}/direct-invoice",
            json={
                "customer_name": "Walkin Customer",
                "phone": "9999900002",
                "gender": "Men",
                "barber_id": barber_id,
                "selected_services": [{
                    "service_id": service_id,
                    "service_name": service_name,
                    "base_price": base_price,
                    "default_duration": default_duration
                }],
                "payment_mode": "cash"
            },
            headers=headers,
            timeout=10
        )
        
        if invoice_response.status_code != 200:
            log_test("Create direct-invoice", False, f"Status: {invoice_response.status_code}, Response: {invoice_response.text}")
            return
        
        invoice_data = invoice_response.json()
        success = invoice_data.get("success")
        token_number = invoice_data.get("token_number")
        grand_total = invoice_data.get("totals", {}).get("grand_total", 0)
        
        if success and token_number and grand_total > 0:
            log_test("Create direct-invoice", True, f"Invoice created: token={token_number}, grand_total={grand_total}")
        else:
            log_test("Create direct-invoice", False, f"success={success}, token_number={token_number}, grand_total={grand_total}")
        
    except Exception as e:
        log_test("direct-invoice regression test", False, str(e))


# ============================================================================
# TEST 8: Regression - home-kpis with date_mode=today
# ============================================================================

def test_home_kpis_regression(salon_token, salon_id):
    """Test GET /api/salons/{salon_id}/home-kpis?date_mode=today"""
    print("\n" + "="*80)
    print("TEST 8: Regression - home-kpis with date_mode=today")
    print("="*80)
    
    if not salon_token or not salon_id:
        log_test("home-kpis regression", False, "Missing salon token or salon_id")
        return
    
    headers = {"Authorization": f"Bearer {salon_token}"}
    
    try:
        response = requests.get(
            f"{API_URL}/salons/{salon_id}/home-kpis?date_mode=today",
            headers=headers,
            timeout=10
        )
        
        if response.status_code != 200:
            log_test("home-kpis date_mode=today", False, f"Status: {response.status_code}, Response: {response.text}")
            return
        
        data = response.json()
        
        # Check for all required top-level keys
        required_keys = [
            "date_basis",
            "primary",
            "secondary",
            "staff_leaderboard",
            "reviews",
            "targets",
            "revenue_7d",
            "payment_mix",
            "top_services",
            "busy_hours"
        ]
        
        missing_keys = []
        for key in required_keys:
            if key not in data:
                missing_keys.append(key)
        
        if len(missing_keys) == 0:
            log_test("home-kpis all required keys present", True, f"All {len(required_keys)} keys present")
        else:
            log_test("home-kpis all required keys present", False, f"Missing keys: {', '.join(missing_keys)}")
        
        # Verify specific structures
        if isinstance(data.get("staff_leaderboard"), list):
            log_test("home-kpis staff_leaderboard is array", True)
        else:
            log_test("home-kpis staff_leaderboard is array", False, f"Type: {type(data.get('staff_leaderboard'))}")
        
        if isinstance(data.get("revenue_7d"), list):
            log_test("home-kpis revenue_7d is array", True)
        else:
            log_test("home-kpis revenue_7d is array", False, f"Type: {type(data.get('revenue_7d'))}")
        
        if isinstance(data.get("payment_mix"), dict):
            log_test("home-kpis payment_mix is dict", True)
        else:
            log_test("home-kpis payment_mix is dict", False, f"Type: {type(data.get('payment_mix'))}")
        
        if isinstance(data.get("top_services"), list):
            log_test("home-kpis top_services is array", True)
        else:
            log_test("home-kpis top_services is array", False, f"Type: {type(data.get('top_services'))}")
        
        if isinstance(data.get("busy_hours"), dict):
            log_test("home-kpis busy_hours is dict", True)
            # Check if busy_hours has 24 hour keys
            busy_hours = data.get("busy_hours", {})
            if len(busy_hours) == 24:
                log_test("home-kpis busy_hours has 24 hour keys", True)
            else:
                log_test("home-kpis busy_hours has 24 hour keys", False, f"Found {len(busy_hours)} keys")
        else:
            log_test("home-kpis busy_hours is dict", False, f"Type: {type(data.get('busy_hours'))}")
        
    except Exception as e:
        log_test("home-kpis regression test", False, str(e))


# ============================================================================
# MAIN TEST RUNNER
# ============================================================================

def main():
    """Run all Phase 2 regression tests"""
    print("\n" + "="*80)
    print("PHASE 2 BACKEND REGRESSION TESTS")
    print("="*80)
    print(f"Backend URL: {BASE_URL}")
    print(f"API URL: {API_URL}")
    print("="*80)
    
    # Test 1: Platform admin login
    platform_token = test_platform_admin_login()
    
    # Test 2: Salon admin login
    salon_token, salon_id = test_salon_admin_login()
    
    # Test 3: Grant Pro Access (requires platform token and salon_id)
    if platform_token and salon_id:
        test_grant_pro_access(platform_token, salon_id)
    
    # Test 4: NEW salon → empty services list
    test_new_salon_empty_services()
    
    # Test 5: Salon creates service → tagged with salon_id
    if salon_token and salon_id:
        test_salon_creates_service(salon_token, salon_id)
    
    # Test 6: Regression - salon-booking still works
    if salon_token and salon_id:
        test_salon_booking_regression(salon_token, salon_id)
    
    # Test 7: Regression - direct-invoice still works
    if salon_token and salon_id:
        test_direct_invoice_regression(salon_token, salon_id)
    
    # Test 8: Regression - home-kpis with date_mode=today
    if salon_token and salon_id:
        test_home_kpis_regression(salon_token, salon_id)
    
    # Print summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    for result in test_results:
        print(result)
    
    print("\n" + "="*80)
    print(f"TOTAL: {passed_tests}/{total_tests} tests passed ({int(passed_tests/total_tests*100) if total_tests > 0 else 0}%)")
    print("="*80)
    
    # Exit with appropriate code
    sys.exit(0 if passed_tests == total_tests else 1)


if __name__ == "__main__":
    main()
