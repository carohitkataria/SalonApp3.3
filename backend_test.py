#!/usr/bin/env python3
"""
Phase 1b Regression Test Suite
Tests the two bug fixes:
1. home-kpis: Handles BOTH raw string IDs and dict objects in selected_services
2. direct-invoice: Service price lookup with fallback through multiple price fields
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# Configuration
BASE_URL = "https://salon-dashboard-pro-6.preview.emergentagent.com"
SALON_ID = "0464ce08-74d1-4351-abd0-5bde9eecc7a6"
LOGIN_ID = "admin"
PASSWORD = "salon123"

# Test results tracking
tests_passed = 0
tests_failed = 0
test_results = []

def log_test(test_name, passed, details=""):
    """Log test result"""
    global tests_passed, tests_failed
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"{status}: {test_name}"
    if details:
        result += f"\n    {details}"
    test_results.append(result)
    print(result)
    if passed:
        tests_passed += 1
    else:
        tests_failed += 1

def login():
    """Login and get access token"""
    print("\n" + "="*80)
    print("AUTHENTICATION")
    print("="*80)
    
    url = f"{BASE_URL}/api/salon/users/login"
    payload = {
        "identifier": LOGIN_ID,
        "password": PASSWORD
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Login request: POST {url}")
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            salon_id = data.get("salon_id")
            print(f"✅ Login successful")
            print(f"   Salon ID: {salon_id}")
            print(f"   Token: {token[:50]}...")
            return token, salon_id
        else:
            print(f"❌ Login failed: {response.text}")
            return None, None
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        return None, None

def test_home_kpis_date_modes(token):
    """Test GET /api/salons/{salon_id}/home-kpis with different date_mode values"""
    print("\n" + "="*80)
    print("TEST GROUP 1: home-kpis with different date_mode values")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    base_url = f"{BASE_URL}/api/salons/{SALON_ID}/home-kpis"
    
    # Test 1: date_mode=today
    print("\n--- Test 1.1: date_mode=today ---")
    try:
        response = requests.get(f"{base_url}?date_mode=today", headers=headers)
        print(f"GET {base_url}?date_mode=today")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            # Check for required keys
            required_keys = ["date_basis", "primary", "secondary", "staff_leaderboard", 
                           "reviews", "targets", "revenue_7d", "payment_mix", 
                           "top_services", "busy_hours"]
            missing_keys = [k for k in required_keys if k not in data]
            
            if not missing_keys:
                log_test("home-kpis date_mode=today", True, 
                        f"Returns 200 with all required keys. date_basis={data.get('date_basis')}")
            else:
                log_test("home-kpis date_mode=today", False, 
                        f"Missing keys: {missing_keys}")
        else:
            log_test("home-kpis date_mode=today", False, 
                    f"Expected 200, got {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("home-kpis date_mode=today", False, f"Exception: {str(e)}")
    
    # Test 2: date_mode=yesterday
    print("\n--- Test 1.2: date_mode=yesterday ---")
    try:
        response = requests.get(f"{base_url}?date_mode=yesterday", headers=headers)
        print(f"GET {base_url}?date_mode=yesterday")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
            date_basis = data.get("date_basis", "")
            
            if yesterday in date_basis:
                log_test("home-kpis date_mode=yesterday", True, 
                        f"Returns 200 with date_basis={date_basis}")
            else:
                log_test("home-kpis date_mode=yesterday", False, 
                        f"date_basis mismatch: expected {yesterday}, got {date_basis}")
        else:
            log_test("home-kpis date_mode=yesterday", False, 
                    f"Expected 200, got {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("home-kpis date_mode=yesterday", False, f"Exception: {str(e)}")
    
    # Test 3: date_mode=range with date_from and date_to
    print("\n--- Test 1.3: date_mode=range with date_from and date_to ---")
    try:
        date_from = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        date_to = datetime.now().strftime("%Y-%m-%d")
        url = f"{base_url}?date_mode=range&date_from={date_from}&date_to={date_to}"
        
        response = requests.get(url, headers=headers)
        print(f"GET {url}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            date_basis = data.get("date_basis", "")
            
            if date_from in date_basis and date_to in date_basis:
                log_test("home-kpis date_mode=range", True, 
                        f"Returns 200 with date_basis={date_basis}")
            else:
                log_test("home-kpis date_mode=range", False, 
                        f"date_basis mismatch: expected range {date_from} to {date_to}, got {date_basis}")
        else:
            log_test("home-kpis date_mode=range", False, 
                    f"Expected 200, got {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("home-kpis date_mode=range", False, f"Exception: {str(e)}")
    
    # Test 4: date_mode=week
    print("\n--- Test 1.4: date_mode=week ---")
    try:
        response = requests.get(f"{base_url}?date_mode=week", headers=headers)
        print(f"GET {base_url}?date_mode=week")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log_test("home-kpis date_mode=week", True, 
                    f"Returns 200 with date_basis={data.get('date_basis')}")
        else:
            log_test("home-kpis date_mode=week", False, 
                    f"Expected 200, got {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("home-kpis date_mode=week", False, f"Exception: {str(e)}")

def get_test_service_and_product(token):
    """Get a test service and product for testing"""
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get services
    services_url = f"{BASE_URL}/api/salons/{SALON_ID}/services/enabled"
    response = requests.get(services_url, headers=headers)
    
    service_id = None
    service_price = 0
    
    if response.status_code == 200:
        services_data = response.json()
        # Handle both array and dict responses
        if isinstance(services_data, list):
            services = services_data
        else:
            services = services_data.get("services", [])
        
        if services:
            service = services[0]
            service_id = service.get("id")
            service_price = service.get("base_price", 0)
            print(f"Using service: {service.get('name')} (ID: {service_id}, Price: ₹{service_price})")
    
    # Get inventory products
    inventory_url = f"{BASE_URL}/api/salon/inventory"
    response = requests.get(inventory_url, headers=headers)
    
    product_id = None
    product_price = 0
    
    if response.status_code == 200:
        inventory_data = response.json()
        # Handle both array and dict responses
        if isinstance(inventory_data, list):
            items = inventory_data
        else:
            items = inventory_data.get("items", [])
        
        if items:
            product = items[0]
            product_id = product.get("id")
            product_price = product.get("selling_price", 0)
            print(f"Using product: {product.get('name')} (ID: {product_id}, Price: ₹{product_price})")
    
    return service_id, service_price, product_id, product_price

def test_direct_invoice(token):
    """Test POST /api/salons/{salon_id}/direct-invoice with different scenarios"""
    print("\n" + "="*80)
    print("TEST GROUP 2: direct-invoice with services and products")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/api/salons/{SALON_ID}/direct-invoice"
    
    # Get test data
    service_id, service_price, product_id, product_price = get_test_service_and_product(token)
    
    if not service_id:
        print("⚠️  No services found, skipping direct-invoice tests")
        return
    
    # Test 2.1: Services only (regression test)
    print("\n--- Test 2.1: direct-invoice with services only ---")
    try:
        payload = {
            "selected_services": [service_id],
            "payment_mode": "cash",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "shift": "Morning"
        }
        
        response = requests.post(url, json=payload, headers=headers)
        print(f"POST {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            totals = data.get("totals", {})
            subtotal = totals.get("subtotal", 0)
            grand_total = totals.get("grand_total", 0)
            
            print(f"Response totals: subtotal={subtotal}, grand_total={grand_total}")
            
            if subtotal > 0 and subtotal >= service_price:
                log_test("direct-invoice services only", True, 
                        f"subtotal={subtotal} (expected >={service_price}), grand_total={grand_total}")
            else:
                log_test("direct-invoice services only", False, 
                        f"subtotal={subtotal} should be >={service_price}. Response: {json.dumps(totals, indent=2)}")
        else:
            log_test("direct-invoice services only", False, 
                    f"Expected 200, got {response.status_code}: {response.text[:500]}")
    except Exception as e:
        log_test("direct-invoice services only", False, f"Exception: {str(e)}")
    
    # Test 2.2: Products only
    if product_id:
        print("\n--- Test 2.2: direct-invoice with products only ---")
        try:
            payload = {
                "selected_products": [
                    {
                        "product_id": product_id,
                        "name": "Test Product",
                        "qty": 1,
                        "unit_price": product_price
                    }
                ],
                "payment_mode": "cash",
                "date": datetime.now().strftime("%Y-%m-%d"),
                "shift": "Morning"
            }
            
            response = requests.post(url, json=payload, headers=headers)
            print(f"POST {url}")
            print(f"Payload: {json.dumps(payload, indent=2)}")
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                totals = data.get("totals", {})
                subtotal = totals.get("subtotal", 0)
                grand_total = totals.get("grand_total", 0)
                
                print(f"Response totals: subtotal={subtotal}, grand_total={grand_total}")
                
                if subtotal >= product_price and grand_total >= product_price:
                    log_test("direct-invoice products only", True, 
                            f"subtotal={subtotal}, grand_total={grand_total}")
                else:
                    log_test("direct-invoice products only", False, 
                            f"subtotal={subtotal} should be >={product_price}")
            else:
                log_test("direct-invoice products only", False, 
                        f"Expected 200, got {response.status_code}: {response.text[:500]}")
        except Exception as e:
            log_test("direct-invoice products only", False, f"Exception: {str(e)}")
        
        # Test 2.3: Services + Products
        print("\n--- Test 2.3: direct-invoice with services + products ---")
        try:
            payload = {
                "selected_services": [service_id],
                "selected_products": [
                    {
                        "product_id": product_id,
                        "name": "Test Product",
                        "qty": 1,
                        "unit_price": product_price
                    }
                ],
                "payment_mode": "cash",
                "date": datetime.now().strftime("%Y-%m-%d"),
                "shift": "Morning"
            }
            
            response = requests.post(url, json=payload, headers=headers)
            print(f"POST {url}")
            print(f"Payload: {json.dumps(payload, indent=2)}")
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                totals = data.get("totals", {})
                subtotal = totals.get("subtotal", 0)
                grand_total = totals.get("grand_total", 0)
                
                expected_min = service_price + product_price
                print(f"Response totals: subtotal={subtotal}, grand_total={grand_total}")
                print(f"Expected minimum: {expected_min} (service {service_price} + product {product_price})")
                
                if subtotal >= expected_min:
                    log_test("direct-invoice services + products", True, 
                            f"subtotal={subtotal} >= {expected_min}, grand_total={grand_total}")
                else:
                    log_test("direct-invoice services + products", False, 
                            f"subtotal={subtotal} should be >={expected_min}")
            else:
                log_test("direct-invoice services + products", False, 
                        f"Expected 200, got {response.status_code}: {response.text[:500]}")
        except Exception as e:
            log_test("direct-invoice services + products", False, f"Exception: {str(e)}")
    else:
        print("⚠️  No products found, skipping products tests")

def test_salon_booking(token):
    """Test POST /api/salons/{salon_id}/salon-booking with services + products"""
    print("\n" + "="*80)
    print("TEST GROUP 3: salon-booking with services + products")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/api/salons/{SALON_ID}/salon-booking"
    
    # Get test data
    service_id, service_price, product_id, product_price = get_test_service_and_product(token)
    
    if not service_id or not product_id:
        print("⚠️  Missing test data, skipping salon-booking test")
        return
    
    # Get a barber
    barbers_url = f"{BASE_URL}/api/salons/{SALON_ID}/barbers"
    response = requests.get(barbers_url, headers=headers)
    barber_id = None
    
    if response.status_code == 200:
        barbers = response.json().get("barbers", [])
        if barbers:
            barber_id = barbers[0].get("id")
            print(f"Using barber ID: {barber_id}")
    
    if not barber_id:
        print("⚠️  No barbers found, skipping salon-booking test")
        return
    
    print("\n--- Test 3.1: salon-booking with services + products ---")
    try:
        payload = {
            "customer_name": "Test Customer",
            "customer_phone": "9876543210",
            "selected_services": [service_id],
            "selected_products": [
                {
                    "product_id": product_id,
                    "name": "Test Product",
                    "qty": 1,
                    "unit_price": product_price
                }
            ],
            "barber_id": barber_id,
            "payment_mode": "cash",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "shift": "Morning"
        }
        
        response = requests.post(url, json=payload, headers=headers)
        print(f"POST {url}")
        print(f"Payload: {json.dumps(payload, indent=2)}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token_data = data.get("token", {})
            total_amount = token_data.get("total_amount", 0)
            selected_products = token_data.get("selected_products", [])
            
            expected_min = service_price + product_price
            print(f"Response: total_amount={total_amount}")
            print(f"Expected minimum: {expected_min}")
            print(f"selected_products in token: {len(selected_products)} items")
            
            if total_amount >= expected_min and len(selected_products) > 0:
                log_test("salon-booking services + products", True, 
                        f"total_amount={total_amount} >= {expected_min}, token contains selected_products")
            else:
                log_test("salon-booking services + products", False, 
                        f"total_amount={total_amount} should be >={expected_min}, selected_products={len(selected_products)}")
        else:
            log_test("salon-booking services + products", False, 
                    f"Expected 200, got {response.status_code}: {response.text[:500]}")
    except Exception as e:
        log_test("salon-booking services + products", False, f"Exception: {str(e)}")

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total_tests = tests_passed + tests_failed
    pass_rate = (tests_passed / total_tests * 100) if total_tests > 0 else 0
    
    print(f"\nTotal Tests: {total_tests}")
    print(f"Passed: {tests_passed} ✅")
    print(f"Failed: {tests_failed} ❌")
    print(f"Pass Rate: {pass_rate:.1f}%")
    
    print("\n" + "="*80)
    print("DETAILED RESULTS")
    print("="*80)
    for result in test_results:
        print(result)
    
    print("\n" + "="*80)
    if tests_failed == 0:
        print("✅ ALL TESTS PASSED - Phase 1b regression tests successful!")
    else:
        print(f"❌ {tests_failed} TEST(S) FAILED - Review failures above")
    print("="*80)

def main():
    """Main test execution"""
    print("="*80)
    print("PHASE 1B REGRESSION TEST SUITE")
    print("Testing bug fixes for home-kpis and direct-invoice")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Salon ID: {SALON_ID}")
    print(f"Login ID: {LOGIN_ID}")
    
    # Login
    token, salon_id = login()
    if not token:
        print("\n❌ Authentication failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Run tests
    test_home_kpis_date_modes(token)
    test_direct_invoice(token)
    test_salon_booking(token)
    
    # Print summary
    print_summary()
    
    # Exit with appropriate code
    sys.exit(0 if tests_failed == 0 else 1)

if __name__ == "__main__":
    main()
