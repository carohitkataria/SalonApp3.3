#!/usr/bin/env python3
"""
Phase 1b Regression Test Suite
Tests home-kpis date_mode extensions and direct-invoice/salon-booking with products
"""

import requests
import json
from datetime import datetime, timedelta
import os

# Load environment
BACKEND_URL = os.getenv('REACT_APP_BACKEND_URL', 'https://salon-dashboard-pro-6.preview.emergentagent.com')
BASE_URL = f"{BACKEND_URL}/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_LOGIN = "admin"
ADMIN_PASSWORD = "salon123"
SALON_ID = "0464ce08-74d1-4351-abd0-5bde9eecc7a6"

# Global variables
admin_token = None
test_inventory_id = None
initial_stock = None

def log_test(test_name, status, details=""):
    """Log test results"""
    symbol = "✅" if status == "PASS" else "❌"
    print(f"\n{symbol} {test_name}: {status}")
    if details:
        print(f"   {details}")

def login_admin():
    """Login as admin and get token"""
    global admin_token
    print("\n" + "="*80)
    print("PHASE 1B REGRESSION TEST - AUTHENTICATION")
    print("="*80)
    
    url = f"{BASE_URL}/salon/users/login"
    payload = {
        "identifier": ADMIN_LOGIN,
        "password": ADMIN_PASSWORD
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Login URL: {url}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            admin_token = data.get('access_token')
            salon_id = data.get('salon_id')
            log_test("Admin Login", "PASS", f"Token obtained, salon_id: {salon_id}")
            return True
        else:
            log_test("Admin Login", "FAIL", f"Status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        log_test("Admin Login", "FAIL", f"Exception: {str(e)}")
        return False

def get_auth_headers():
    """Get authorization headers"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }

def get_inventory_items():
    """Helper to get inventory items from API"""
    try:
        inv_url = f"{BASE_URL}/salon/inventory"
        inv_response = requests.get(inv_url, headers=get_auth_headers())
        if inv_response.status_code == 200:
            data = inv_response.json()
            return data.get('inventory_items', []) if isinstance(data, dict) else data
    except:
        pass
    return []

def get_or_create_inventory_item():
    """Get existing inventory item or create a test one"""
    global test_inventory_id, initial_stock
    
    print("\n" + "="*80)
    print("INVENTORY SETUP")
    print("="*80)
    
    # Try to get existing inventory
    url = f"{BASE_URL}/salon/inventory"
    try:
        response = requests.get(url, headers=get_auth_headers())
        print(f"GET {url}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            items = data.get('inventory_items', []) if isinstance(data, dict) else data
            if items and len(items) > 0:
                item = items[0]
                test_inventory_id = item.get('id')
                initial_stock = item.get('stock_quantity', 0)
                log_test("Get Inventory", "PASS", f"Found item: {item.get('name')}, stock: {initial_stock}, id: {test_inventory_id}")
                return True
        
        # Create a test inventory item
        print("\nNo inventory found, creating test item...")
        create_url = f"{BASE_URL}/salon/inventory"
        payload = {
            "name": "Test Shampoo Phase1b",
            "category": "General",
            "purchase_price": 100,
            "retail_price": 250,
            "stock_quantity": 50,
            "sku_code": "TEST-PHASE1B-001"
        }
        
        response = requests.post(create_url, json=payload, headers=get_auth_headers())
        print(f"POST {create_url}")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            item = response.json()
            test_inventory_id = item.get('id')
            initial_stock = item.get('stock_quantity', 50)
            log_test("Create Inventory", "PASS", f"Created item: {item.get('name')}, stock: {initial_stock}, id: {test_inventory_id}")
            return True
        else:
            log_test("Create Inventory", "FAIL", f"Status {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Inventory Setup", "FAIL", f"Exception: {str(e)}")
        return False

def test_home_kpis_date_modes():
    """Test 1: GET /api/salons/{salon_id}/home-kpis with date_mode extensions"""
    print("\n" + "="*80)
    print("TEST 1: GET /api/salons/{salon_id}/home-kpis — date_mode extensions")
    print("="*80)
    
    base_url = f"{BASE_URL}/salons/{SALON_ID}/home-kpis"
    
    # Calculate dates
    today = datetime.now().strftime('%Y-%m-%d')
    yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    three_days_ago = (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d')
    
    test_cases = [
        {
            "name": "1a) date_mode=today (default)",
            "params": {},
            "expected_date_basis": today
        },
        {
            "name": "1b) date_mode=yesterday",
            "params": {"date_mode": "yesterday"},
            "expected_date_basis": yesterday
        },
        {
            "name": "1c) date_mode=range with date_from & date_to",
            "params": {
                "date_mode": "range",
                "date_from": three_days_ago,
                "date_to": today
            },
            "expected_date_basis": today
        },
        {
            "name": "1d) date_mode=range without params (defaults to today)",
            "params": {"date_mode": "range"},
            "expected_date_basis": today
        },
        {
            "name": "1e) date_mode=week",
            "params": {"date_mode": "week"},
            "expected_date_basis": None  # Just check 200
        }
    ]
    
    for test_case in test_cases:
        try:
            response = requests.get(base_url, params=test_case["params"], headers=get_auth_headers())
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required top-level keys
                required_keys = ['primary', 'secondary', 'staff_leaderboard', 'reviews', 
                               'targets', 'revenue_7d', 'payment_mix', 'top_services', 
                               'busy_hours', 'date_basis']
                
                missing_keys = [key for key in required_keys if key not in data]
                
                if missing_keys:
                    log_test(test_case["name"], "FAIL", f"Missing keys: {missing_keys}")
                else:
                    # Check date_basis if expected
                    if test_case["expected_date_basis"]:
                        actual_date = data.get('date_basis')
                        if actual_date == test_case["expected_date_basis"]:
                            log_test(test_case["name"], "PASS", f"date_basis={actual_date}, all keys present")
                        else:
                            log_test(test_case["name"], "FAIL", f"Expected date_basis={test_case['expected_date_basis']}, got {actual_date}")
                    else:
                        log_test(test_case["name"], "PASS", f"Status 200, all keys present")
            else:
                log_test(test_case["name"], "FAIL", f"Status {response.status_code}: {response.text[:200]}")
                
        except Exception as e:
            log_test(test_case["name"], "FAIL", f"Exception: {str(e)}")

def test_direct_invoice_with_products():
    """Test 2: POST /api/salons/{salon_id}/direct-invoice with products"""
    print("\n" + "="*80)
    print("TEST 2: POST /api/salons/{salon_id}/direct-invoice — with products")
    print("="*80)
    
    url = f"{BASE_URL}/salons/{SALON_ID}/direct-invoice"
    
    # Get a service ID first
    services_url = f"{BASE_URL}/salons/{SALON_ID}/services/enabled"
    try:
        response = requests.get(services_url, headers=get_auth_headers())
        services = response.json() if response.status_code == 200 else []
        service_id = services[0]['id'] if services else "cf2c81bc-dd05-4c1b-a737-267b25ea801d"
    except:
        service_id = "cf2c81bc-dd05-4c1b-a737-267b25ea801d"
    
    # Test 2a: Services only (regression)
    print("\n--- Test 2a: Services only (regression from Phase 1) ---")
    payload_services_only = {
        "customer_name": "Services Only Test",
        "phone": "9876500010",
        "gender": "Men",
        "barber_id": None,
        "selected_services": [
            {
                "service_id": service_id,
                "service_name": "Test Haircut",
                "base_price": 300,
                "default_duration": 30
            }
        ],
        "selected_products": [],
        "payment_mode": "cash"
    }
    
    try:
        response = requests.post(url, json=payload_services_only, headers=get_auth_headers())
        if response.status_code == 200:
            data = response.json()
            totals = data.get('totals', {})
            subtotal = totals.get('subtotal', 0)
            grand_total = totals.get('grand_total', 0)
            log_test("2a) Services only", "PASS", f"Status 200, subtotal={subtotal}, grand_total={grand_total}")
        else:
            log_test("2a) Services only", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("2a) Services only", "FAIL", f"Exception: {str(e)}")
    
    # Test 2b: Products only (no services) - NEW in Phase 1b
    print("\n--- Test 2b: Products only (no selected_services) ---")
    payload_products_only = {
        "customer_name": "Product Only",
        "phone": "9876500001",
        "gender": "Men",
        "barber_id": None,
        "selected_services": [],
        "selected_products": [
            {
                "product_id": test_inventory_id or "dummy-id",
                "name": "Test Shampoo",
                "qty": 2,
                "unit_price": 250
            }
        ],
        "payment_mode": "cash"
    }
    
    try:
        response = requests.post(url, json=payload_products_only, headers=get_auth_headers())
        if response.status_code == 200:
            data = response.json()
            totals = data.get('totals', {})
            subtotal = totals.get('subtotal', 0)
            grand_total = totals.get('grand_total', 0)
            token_id = data.get('token_id')
            
            # Verify totals
            if subtotal >= 500 and grand_total >= 500:
                log_test("2b) Products only - totals", "PASS", f"subtotal={subtotal}, grand_total={grand_total}")
            else:
                log_test("2b) Products only - totals", "FAIL", f"Expected >=500, got subtotal={subtotal}, grand_total={grand_total}")
            
            # Verify token has selected_products
            if token_id:
                token_url = f"{BASE_URL}/tokens/{token_id}"
                token_response = requests.get(token_url, headers=get_auth_headers())
                if token_response.status_code == 200:
                    token_data = token_response.json()
                    selected_products = token_data.get('selected_products', [])
                    if len(selected_products) == 1 and selected_products[0].get('qty') == 2:
                        log_test("2b) Products only - token verification", "PASS", f"Token has selected_products array with qty=2")
                    else:
                        log_test("2b) Products only - token verification", "FAIL", f"Token selected_products: {selected_products}")
        else:
            log_test("2b) Products only", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("2b) Products only", "FAIL", f"Exception: {str(e)}")
    
    # Test 2c: Services + Products together
    print("\n--- Test 2c: Services + Products together ---")
    
    # Get current stock before
    stock_before = None
    if test_inventory_id:
        items = get_inventory_items()
        for item in items:
            if item.get('id') == test_inventory_id:
                stock_before = item.get('stock_quantity')
                break
    
    payload_both = {
        "customer_name": "Services Plus Products",
        "phone": "9876500002",
        "gender": "Women",
        "barber_id": None,
        "selected_services": [
            {
                "service_id": service_id,
                "service_name": "Test Haircut",
                "base_price": 300,
                "default_duration": 30
            }
        ],
        "selected_products": [
            {
                "product_id": test_inventory_id or "dummy-id",
                "name": "Test Shampoo",
                "qty": 1,
                "unit_price": 250
            }
        ],
        "payment_mode": "cash"
    }
    
    try:
        response = requests.post(url, json=payload_both, headers=get_auth_headers())
        if response.status_code == 200:
            data = response.json()
            totals = data.get('totals', {})
            subtotal = totals.get('subtotal', 0)
            grand_total = totals.get('grand_total', 0)
            
            # Verify totals include both services and products
            expected_min = 300 + 250  # service + product
            if subtotal >= expected_min:
                log_test("2c) Services + Products - totals", "PASS", f"subtotal={subtotal} (includes services+products)")
            else:
                log_test("2c) Services + Products - totals", "FAIL", f"Expected >={expected_min}, got {subtotal}")
            
            # Check stock decrement
            if test_inventory_id and stock_before is not None:
                items = get_inventory_items()
                for item in items:
                    if item.get('id') == test_inventory_id:
                        stock_after = item.get('stock_quantity')
                        if stock_after == stock_before - 1:
                            log_test("2c) Inventory decrement", "PASS", f"Stock: {stock_before} → {stock_after}")
                        else:
                            log_test("2c) Inventory decrement", "FAIL", f"Expected {stock_before - 1}, got {stock_after}")
                        break
        else:
            log_test("2c) Services + Products", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("2c) Services + Products", "FAIL", f"Exception: {str(e)}")
    
    # Test 2d: Missing both services and products
    print("\n--- Test 2d: Missing both services and products → 400 ---")
    payload_empty = {
        "customer_name": "Empty Order",
        "phone": "9876500003",
        "gender": "Men",
        "barber_id": None,
        "selected_services": [],
        "selected_products": [],
        "payment_mode": "cash"
    }
    
    try:
        response = requests.post(url, json=payload_empty, headers=get_auth_headers())
        if response.status_code == 400:
            error_msg = response.json().get('detail', '')
            if 'service' in error_msg.lower() or 'product' in error_msg.lower():
                log_test("2d) Missing both → 400", "PASS", f"Correctly rejected: {error_msg}")
            else:
                log_test("2d) Missing both → 400", "PARTIAL", f"Got 400 but message unclear: {error_msg}")
        else:
            log_test("2d) Missing both → 400", "FAIL", f"Expected 400, got {response.status_code}")
    except Exception as e:
        log_test("2d) Missing both → 400", "FAIL", f"Exception: {str(e)}")
    
    # Test 2e: Wallet payment without phone
    print("\n--- Test 2e: Wallet payment without phone ---")
    payload_wallet_no_phone = {
        "customer_name": "Walk-in Wallet",
        "phone": "",
        "gender": "Men",
        "barber_id": None,
        "selected_services": [
            {
                "service_id": service_id,
                "service_name": "Test Haircut",
                "base_price": 300,
                "default_duration": 30
            }
        ],
        "selected_products": [],
        "payment_mode": "wallet"
    }
    
    try:
        response = requests.post(url, json=payload_wallet_no_phone, headers=get_auth_headers())
        # Should either work (walk-in) or error 400 (membership required)
        if response.status_code in [200, 400]:
            log_test("2e) Wallet without phone", "PASS", f"Status {response.status_code} (expected behavior)")
        else:
            log_test("2e) Wallet without phone", "FAIL", f"Unexpected status {response.status_code}")
    except Exception as e:
        log_test("2e) Wallet without phone", "FAIL", f"Exception: {str(e)}")

def test_salon_booking_with_products():
    """Test 3: POST /api/salons/{salon_id}/salon-booking with products"""
    print("\n" + "="*80)
    print("TEST 3: POST /api/salons/{salon_id}/salon-booking — with products (regression)")
    print("="*80)
    
    url = f"{BASE_URL}/salons/{SALON_ID}/salon-booking"
    
    # Get a service ID
    services_url = f"{BASE_URL}/salons/{SALON_ID}/services/enabled"
    try:
        response = requests.get(services_url, headers=get_auth_headers())
        services = response.json() if response.status_code == 200 else []
        service_id = services[0]['id'] if services else "cf2c81bc-dd05-4c1b-a737-267b25ea801d"
    except:
        service_id = "cf2c81bc-dd05-4c1b-a737-267b25ea801d"
    
    # Get barber ID
    barbers_url = f"{BASE_URL}/salons/{SALON_ID}/barbers"
    try:
        response = requests.get(barbers_url, headers=get_auth_headers())
        barbers = response.json() if response.status_code == 200 else []
        barber_id = barbers[0]['id'] if barbers else "a8c9c773-0c00-4f4b-903c-2a94b77222c4"
    except:
        barber_id = "a8c9c773-0c00-4f4b-903c-2a94b77222c4"
    
    # Test 3a: Pure service booking (regression)
    print("\n--- Test 3a: Pure service booking (regression) ---")
    payload_service = {
        "customer_name": "Service Booking",
        "phone": "9876500020",
        "gender": "Men",
        "barber_id": barber_id,
        "date": datetime.now().strftime('%Y-%m-%d'),
        "shift": "Morning",
        "selected_services": [
            {
                "service_id": service_id,
                "service_name": "Test Haircut",
                "base_price": 300,
                "default_duration": 30
            }
        ],
        "selected_products": []
    }
    
    try:
        response = requests.post(url, json=payload_service, headers=get_auth_headers())
        if response.status_code == 200:
            data = response.json()
            token_id = data.get('token_id')
            log_test("3a) Pure service booking", "PASS", f"Status 200, token_id={token_id}")
        else:
            log_test("3a) Pure service booking", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("3a) Pure service booking", "FAIL", f"Exception: {str(e)}")
    
    # Test 3b: Services + Products
    print("\n--- Test 3b: Services + Products ---")
    
    # Get stock before
    stock_before = None
    if test_inventory_id:
        items = get_inventory_items()
        for item in items:
            if item.get('id') == test_inventory_id:
                stock_before = item.get('stock_quantity')
                break
    
    payload_both = {
        "customer_name": "Booking with Products",
        "phone": "9876500021",
        "gender": "Women",
        "barber_id": barber_id,
        "date": datetime.now().strftime('%Y-%m-%d'),
        "shift": "Morning",
        "selected_services": [
            {
                "service_id": service_id,
                "service_name": "Test Haircut",
                "base_price": 300,
                "default_duration": 30
            }
        ],
        "selected_products": [
            {
                "product_id": test_inventory_id or "dummy-id",
                "name": "Test Shampoo",
                "qty": 2,
                "unit_price": 250
            }
        ]
    }
    
    try:
        response = requests.post(url, json=payload_both, headers=get_auth_headers())
        if response.status_code == 200:
            data = response.json()
            token_id = data.get('token_id')
            total_amount = data.get('total_amount', 0)
            
            # Verify token created
            log_test("3b) Booking with products - creation", "PASS", f"Status 200, token_id={token_id}, total={total_amount}")
            
            # Verify token has selected_products
            if token_id:
                token_url = f"{BASE_URL}/tokens/{token_id}"
                token_response = requests.get(token_url, headers=get_auth_headers())
                if token_response.status_code == 200:
                    token_data = token_response.json()
                    selected_products = token_data.get('selected_products', [])
                    if len(selected_products) > 0:
                        log_test("3b) Token has selected_products", "PASS", f"Products: {len(selected_products)} items")
                    else:
                        log_test("3b) Token has selected_products", "FAIL", "No selected_products in token")
            
            # Check stock decrement
            if test_inventory_id and stock_before is not None:
                items = get_inventory_items()
                for item in items:
                    if item.get('id') == test_inventory_id:
                        stock_after = item.get('stock_quantity')
                        expected_stock = stock_before - 2  # qty=2
                        if stock_after == expected_stock:
                            log_test("3b) Inventory decrement", "PASS", f"Stock: {stock_before} → {stock_after}")
                        else:
                            log_test("3b) Inventory decrement", "FAIL", f"Expected {expected_stock}, got {stock_after}")
                        break
        else:
            log_test("3b) Booking with products", "FAIL", f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("3b) Booking with products", "FAIL", f"Exception: {str(e)}")

def main():
    """Run all Phase 1b regression tests"""
    print("\n" + "="*80)
    print("PHASE 1B REGRESSION TEST SUITE")
    print("Testing: home-kpis date_mode extensions + direct-invoice/salon-booking with products")
    print("="*80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"Salon ID: {SALON_ID}")
    print(f"Admin Login: {ADMIN_LOGIN}")
    
    # Step 1: Login
    if not login_admin():
        print("\n❌ CRITICAL: Admin login failed. Cannot proceed with tests.")
        return
    
    # Step 2: Setup inventory
    if not get_or_create_inventory_item():
        print("\n⚠️  WARNING: Inventory setup failed. Product tests may fail.")
    
    # Step 3: Run tests
    test_home_kpis_date_modes()
    test_direct_invoice_with_products()
    test_salon_booking_with_products()
    
    # Summary
    print("\n" + "="*80)
    print("PHASE 1B REGRESSION TEST COMPLETE")
    print("="*80)
    print("\nReview the test results above.")
    print("Focus: REGRESSION — nothing that used to work should break.")

if __name__ == "__main__":
    main()
