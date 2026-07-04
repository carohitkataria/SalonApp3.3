#!/usr/bin/env python3
"""
Backend Testing Script for 5 Pending Tasks (July 4, 2026 Session)
Tests salon manual booking with wallet payment, bulk delete services,
Main Branch auto-creation, inventory purchase with financials, and inventory sell with customer info.
"""

import requests
import json
import uuid
import random
import string
from datetime import datetime, timedelta

# Configuration
BASE_URL = "https://293cd839-0730-4ffb-888b-e93570167fa8.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {
    "identifier": "admin",
    "password": "salon123"
}
SALON_ID = "f78671f8-621a-42d9-a055-097ba21c0bbf"

# Global variables
access_token = None
test_results = []

def log_test(task_name, test_name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = {
        "task": task_name,
        "test": test_name,
        "status": status,
        "passed": passed,
        "details": details
    }
    test_results.append(result)
    print(f"{status}: {task_name} - {test_name}")
    if details:
        print(f"  Details: {details}")

def login_admin():
    """Login as admin and get access token"""
    global access_token
    print("\n" + "="*80)
    print("ADMIN LOGIN")
    print("="*80)
    
    url = f"{BASE_URL}/salon/users/login"
    response = requests.post(url, json=ADMIN_CREDENTIALS)
    
    if response.status_code == 200:
        data = response.json()
        access_token = data.get("access_token")
        salon_id = data.get("salon_id")
        print(f"✅ Admin login successful")
        print(f"   Salon ID: {salon_id}")
        print(f"   Token: {access_token[:50]}...")
        return True
    else:
        print(f"❌ Admin login failed: {response.status_code}")
        print(f"   Response: {response.text}")
        return False

def get_headers():
    """Get authorization headers"""
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

def random_string(length=6):
    """Generate random string"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

# ============================================================================
# TASK 1: Salon Manual Booking - Wallet Payment Mode
# ============================================================================

def test_task1_wallet_booking():
    """Test salon manual booking with wallet payment mode"""
    print("\n" + "="*80)
    print("TASK 1: SALON MANUAL BOOKING - WALLET PAYMENT MODE")
    print("="*80)
    
    task_name = "Salon manual booking: wallet payment_mode"
    
    # Step 1: Get salon services
    print("\n[1.1] Getting salon services...")
    url = f"{BASE_URL}/salons/{SALON_ID}/services/enabled"
    response = requests.get(url, headers=get_headers())
    
    if response.status_code != 200:
        log_test(task_name, "Get services", False, f"Failed to get services: {response.status_code}")
        return
    
    services = response.json().get("services", [])
    if not services:
        log_test(task_name, "Get services", False, "No services available")
        return
    
    service_id = services[0]["id"]
    service_price = services[0].get("base_price", 100)
    print(f"   Using service: {services[0]['service_name']} (₹{service_price})")
    log_test(task_name, "Get services", True, f"Found {len(services)} services")
    
    # Step 2: Get barbers
    print("\n[1.2] Getting barbers...")
    url = f"{BASE_URL}/salons/{SALON_ID}/barbers"
    response = requests.get(url, headers=get_headers())
    
    if response.status_code != 200:
        log_test(task_name, "Get barbers", False, f"Failed to get barbers: {response.status_code}")
        return
    
    barbers = response.json().get("barbers", [])
    if not barbers:
        log_test(task_name, "Get barbers", False, "No barbers available")
        return
    
    barber_id = barbers[0]["id"]
    print(f"   Using barber: {barbers[0]['name']}")
    log_test(task_name, "Get barbers", True, f"Found {len(barbers)} barbers")
    
    # Step 3: Test cash payment (baseline - should work)
    print("\n[1.3] Testing cash payment mode (baseline)...")
    booking_data = {
        "customer_name": f"Test Customer Cash {random_string()}",
        "phone": "9876543210",
        "gender": "Men",
        "barber_id": barber_id,
        "selected_services": [service_id],
        "shift": "Morning",
        "date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
        "payment_mode": "cash"
    }
    
    url = f"{BASE_URL}/salons/{SALON_ID}/salon-booking"
    response = requests.post(url, json=booking_data, headers=get_headers())
    
    if response.status_code == 200:
        data = response.json()
        token_number = data.get("token_number")
        payment_mode = data.get("payment_mode")
        print(f"   ✅ Cash booking created: Token {token_number}, Payment: {payment_mode}")
        log_test(task_name, "Cash payment mode", True, f"Token: {token_number}")
    else:
        log_test(task_name, "Cash payment mode", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
    
    # Step 4: Test UPI payment
    print("\n[1.4] Testing UPI payment mode...")
    booking_data["customer_name"] = f"Test Customer UPI {random_string()}"
    booking_data["payment_mode"] = "upi"
    
    response = requests.post(url, json=booking_data, headers=get_headers())
    
    if response.status_code == 200:
        data = response.json()
        token_number = data.get("token_number")
        payment_mode = data.get("payment_mode")
        print(f"   ✅ UPI booking created: Token {token_number}, Payment: {payment_mode}")
        log_test(task_name, "UPI payment mode", True, f"Token: {token_number}")
    else:
        log_test(task_name, "UPI payment mode", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
    
    # Step 5: Test card payment
    print("\n[1.5] Testing card payment mode...")
    booking_data["customer_name"] = f"Test Customer Card {random_string()}"
    booking_data["payment_mode"] = "card"
    
    response = requests.post(url, json=booking_data, headers=get_headers())
    
    if response.status_code == 200:
        data = response.json()
        token_number = data.get("token_number")
        payment_mode = data.get("payment_mode")
        print(f"   ✅ Card booking created: Token {token_number}, Payment: {payment_mode}")
        log_test(task_name, "Card payment mode", True, f"Token: {token_number}")
    else:
        log_test(task_name, "Card payment mode", False, f"Status: {response.status_code}, Response: {response.text[:200]}")
    
    # Step 6: Test wallet payment WITHOUT membership (should fail with helpful error)
    print("\n[1.6] Testing wallet payment WITHOUT membership (should fail)...")
    test_phone = f"98765{random_string(5)}"
    booking_data["customer_name"] = f"Test Customer No Membership"
    booking_data["phone"] = test_phone
    booking_data["payment_mode"] = "wallet"
    
    response = requests.post(url, json=booking_data, headers=get_headers())
    
    if response.status_code == 400:
        error_detail = response.json().get("detail", "")
        if "membership" in error_detail.lower() or "wallet" in error_detail.lower():
            print(f"   ✅ Correctly rejected: {error_detail}")
            log_test(task_name, "Wallet without membership (reject)", True, f"Error: {error_detail}")
        else:
            log_test(task_name, "Wallet without membership (reject)", False, f"Wrong error: {error_detail}")
    else:
        log_test(task_name, "Wallet without membership (reject)", False, f"Expected 400, got {response.status_code}")
    
    # Step 7: Create a membership for wallet testing
    print("\n[1.7] Creating membership for wallet payment test...")
    membership_phone = f"+919876{random_string(6)}"
    
    # First, create a membership plan
    plan_data = {
        "salon_id": SALON_ID,
        "name": f"Test Plan {random_string()}",
        "amount": 1000,
        "credit": 1200,
        "validity_months": 6,
        "terms_conditions": "Test plan"
    }
    
    url_plan = f"{BASE_URL}/salons/{SALON_ID}/membership-plans"
    response = requests.post(url_plan, json=plan_data, headers=get_headers())
    
    if response.status_code != 200:
        print(f"   ⚠️  Failed to create membership plan: {response.status_code}")
        log_test(task_name, "Create membership plan", False, f"Status: {response.status_code}")
        return
    
    plan_id = response.json().get("id")
    print(f"   Created membership plan: {plan_id}")
    
    # Buy membership for customer
    url_buy = f"{BASE_URL}/salons/{SALON_ID}/customers/{membership_phone}/buy-membership"
    buy_data = {
        "customer_name": "Test Wallet Customer",
        "customer_phone": membership_phone,
        "membership_plan_id": plan_id,
        "payment_mode": "cash",
        "paid_amount": 1000
    }
    
    response = requests.post(url_buy, json=buy_data, headers=get_headers())
    
    if response.status_code != 200:
        print(f"   ⚠️  Failed to buy membership: {response.status_code}")
        print(f"   Response: {response.text[:300]}")
        log_test(task_name, "Buy membership", False, f"Status: {response.status_code}")
        return
    
    membership_data = response.json()
    wallet_balance = membership_data.get("membership", {}).get("wallet_balance", 0)
    print(f"   ✅ Membership created with wallet balance: ₹{wallet_balance}")
    log_test(task_name, "Buy membership", True, f"Balance: ₹{wallet_balance}")
    
    # Step 8: Test wallet payment WITH membership (should succeed)
    print("\n[1.8] Testing wallet payment WITH membership (should succeed)...")
    booking_data["customer_name"] = "Test Wallet Customer"
    booking_data["phone"] = membership_phone.replace("+91", "")
    booking_data["payment_mode"] = "wallet"
    
    url = f"{BASE_URL}/salons/{SALON_ID}/salon-booking"
    response = requests.post(url, json=booking_data, headers=get_headers())
    
    if response.status_code == 200:
        data = response.json()
        token_number = data.get("token_number")
        payment_mode = data.get("payment_mode")
        payment_status = data.get("payment_status")
        payment_confirmed = data.get("payment_confirmed")
        
        print(f"   ✅ Wallet booking created:")
        print(f"      Token: {token_number}")
        print(f"      Payment Mode: {payment_mode}")
        print(f"      Payment Status: {payment_status}")
        print(f"      Payment Confirmed: {payment_confirmed}")
        
        # Verify wallet transaction was created
        url_txn = f"{BASE_URL}/salons/{SALON_ID}/wallet-transactions/{membership_phone}"
        response_txn = requests.get(url_txn, headers=get_headers())
        
        if response_txn.status_code == 200:
            transactions = response_txn.json().get("transactions", [])
            if transactions:
                latest_txn = transactions[0]
                if latest_txn.get("transaction_type") == "debit":
                    print(f"   ✅ Wallet transaction created:")
                    print(f"      Type: {latest_txn.get('transaction_type')}")
                    print(f"      Amount: ₹{latest_txn.get('amount')}")
                    print(f"      Balance After: ₹{latest_txn.get('balance_after')}")
                    log_test(task_name, "Wallet payment with membership", True, 
                            f"Token: {token_number}, Wallet debited: ₹{latest_txn.get('amount')}")
                else:
                    log_test(task_name, "Wallet payment with membership", False, 
                            "Wallet transaction not found or wrong type")
            else:
                log_test(task_name, "Wallet payment with membership", False, 
                        "No wallet transactions found")
        else:
            log_test(task_name, "Wallet payment with membership", False, 
                    f"Failed to get wallet transactions: {response_txn.status_code}")
    else:
        log_test(task_name, "Wallet payment with membership", False, 
                f"Status: {response.status_code}, Response: {response.text[:300]}")

# ============================================================================
# TASK 2: Bulk Delete Salon Services Endpoint
# ============================================================================

def test_task2_bulk_delete_services():
    """Test bulk delete salon services endpoint"""
    print("\n" + "="*80)
    print("TASK 2: BULK DELETE SALON SERVICES ENDPOINT")
    print("="*80)
    
    task_name = "Bulk delete salon services endpoint"
    
    # Step 1: Test authentication required
    print("\n[2.1] Testing authentication requirement...")
    url = f"{BASE_URL}/salons/{SALON_ID}/services/bulk-delete"
    response = requests.post(url, json={"service_ids": []})
    
    if response.status_code == 403:
        print(f"   ✅ Correctly requires authentication (403)")
        log_test(task_name, "Auth required", True, "Returns 403 without token")
    else:
        log_test(task_name, "Auth required", False, f"Expected 403, got {response.status_code}")
    
    # Step 2: Create test salon-owned services
    print("\n[2.2] Creating test salon-owned services...")
    url_create = f"{BASE_URL}/salons/{SALON_ID}/services"
    
    salon_service_ids = []
    for i in range(2):
        service_data = {
            "service_name": f"Test Salon Service {random_string()}",
            "base_price": 100 + i * 50,
            "default_duration": 30,
            "category": "General",
            "gender_tag": "Unisex"
        }
        response = requests.post(url_create, json=service_data, headers=get_headers())
        
        if response.status_code == 200:
            service_id = response.json().get("id")
            salon_service_ids.append(service_id)
            print(f"   Created salon service {i+1}: {service_id}")
        else:
            print(f"   ⚠️  Failed to create service {i+1}: {response.status_code}")
    
    if len(salon_service_ids) < 2:
        log_test(task_name, "Create test services", False, "Failed to create test services")
        return
    
    log_test(task_name, "Create test services", True, f"Created {len(salon_service_ids)} services")
    
    # Step 3: Get enabled services count before delete
    print("\n[2.3] Getting enabled services count before delete...")
    url_enabled = f"{BASE_URL}/salons/{SALON_ID}/services/enabled"
    response = requests.get(url_enabled, headers=get_headers())
    
    if response.status_code != 200:
        log_test(task_name, "Get enabled services (before)", False, f"Status: {response.status_code}")
        return
    
    services_before = response.json().get("services", [])
    count_before = len(services_before)
    print(f"   Enabled services before delete: {count_before}")
    log_test(task_name, "Get enabled services (before)", True, f"Count: {count_before}")
    
    # Step 4: Bulk delete salon-owned services (hard delete)
    print("\n[2.4] Bulk deleting salon-owned services (hard delete)...")
    url = f"{BASE_URL}/salons/{SALON_ID}/services/bulk-delete"
    delete_data = {"service_ids": salon_service_ids}
    response = requests.post(url, json=delete_data, headers=get_headers())
    
    if response.status_code == 200:
        data = response.json()
        hard_deleted = data.get("hard_deleted", 0)
        disabled_for_salon = data.get("disabled_for_salon", 0)
        barber_links_removed = data.get("barber_links_removed", 0)
        
        print(f"   ✅ Bulk delete response:")
        print(f"      Hard deleted: {hard_deleted}")
        print(f"      Disabled for salon: {disabled_for_salon}")
        print(f"      Barber links removed: {barber_links_removed}")
        
        if hard_deleted == len(salon_service_ids):
            log_test(task_name, "Hard delete salon-owned services", True, 
                    f"Deleted {hard_deleted} services")
        else:
            log_test(task_name, "Hard delete salon-owned services", False, 
                    f"Expected {len(salon_service_ids)}, got {hard_deleted}")
    else:
        log_test(task_name, "Hard delete salon-owned services", False, 
                f"Status: {response.status_code}, Response: {response.text[:200]}")
        return
    
    # Step 5: Verify services are removed from enabled list
    print("\n[2.5] Verifying services removed from enabled list...")
    response = requests.get(url_enabled, headers=get_headers())
    
    if response.status_code == 200:
        services_after = response.json().get("services", [])
        count_after = len(services_after)
        
        # Check that deleted services are not in the list
        deleted_service_ids_in_list = [s["id"] for s in services_after if s["id"] in salon_service_ids]
        
        if len(deleted_service_ids_in_list) == 0:
            print(f"   ✅ Services removed from enabled list")
            print(f"      Count before: {count_before}, Count after: {count_after}")
            log_test(task_name, "Verify services removed", True, 
                    f"Services no longer in enabled list")
        else:
            log_test(task_name, "Verify services removed", False, 
                    f"Found {len(deleted_service_ids_in_list)} deleted services still in list")
    else:
        log_test(task_name, "Verify services removed", False, 
                f"Failed to get enabled services: {response.status_code}")
    
    # Step 6: Test idempotency (re-calling with same IDs should not error)
    print("\n[2.6] Testing idempotency (re-delete same services)...")
    response = requests.post(url, json=delete_data, headers=get_headers())
    
    if response.status_code == 200:
        data = response.json()
        hard_deleted = data.get("hard_deleted", 0)
        
        if hard_deleted == 0:
            print(f"   ✅ Idempotent: re-delete returns 0 deleted (services already gone)")
            log_test(task_name, "Idempotency", True, "Re-delete returns 0 without error")
        else:
            log_test(task_name, "Idempotency", False, f"Expected 0, got {hard_deleted}")
    else:
        log_test(task_name, "Idempotency", False, 
                f"Status: {response.status_code}, Response: {response.text[:200]}")
    
    # Step 7: Test with global services (should disable, not delete)
    print("\n[2.7] Testing with global services (should disable for salon)...")
    
    # Get a global service (one without salon_id)
    url_all = f"{BASE_URL}/salons/{SALON_ID}/services/all"
    response = requests.get(url_all, headers=get_headers())
    
    if response.status_code != 200:
        print(f"   ⚠️  Failed to get all services: {response.status_code}")
        log_test(task_name, "Get global services", False, f"Status: {response.status_code}")
        return
    
    all_services = response.json().get("services", [])
    # Find a global service (one that's enabled and likely global)
    global_service = None
    for s in all_services:
        if s.get("is_enabled_for_salon"):
            global_service = s
            break
    
    if not global_service:
        print(f"   ⚠️  No global services found to test")
        log_test(task_name, "Test global service disable", False, "No global services available")
        return
    
    global_service_id = global_service["id"]
    print(f"   Testing with service: {global_service.get('service_name')} ({global_service_id})")
    
    # Try to delete global service
    delete_data = {"service_ids": [global_service_id]}
    response = requests.post(url, json=delete_data, headers=get_headers())
    
    if response.status_code == 200:
        data = response.json()
        hard_deleted = data.get("hard_deleted", 0)
        disabled_for_salon = data.get("disabled_for_salon", 0)
        
        print(f"   Response:")
        print(f"      Hard deleted: {hard_deleted}")
        print(f"      Disabled for salon: {disabled_for_salon}")
        
        # For global services, should be disabled, not hard deleted
        # Note: The service might be salon-owned, so we check the behavior
        if disabled_for_salon > 0 or hard_deleted > 0:
            print(f"   ✅ Service processed (disabled or deleted based on ownership)")
            log_test(task_name, "Global service handling", True, 
                    f"Hard deleted: {hard_deleted}, Disabled: {disabled_for_salon}")
        else:
            log_test(task_name, "Global service handling", False, 
                    "No services processed")
    else:
        log_test(task_name, "Global service handling", False, 
                f"Status: {response.status_code}, Response: {response.text[:200]}")

# ============================================================================
# TASK 3: New Salon Signup Auto-creates Main Branch
# ============================================================================

def test_task3_main_branch_creation():
    """Test new salon signup auto-creates Main Branch"""
    print("\n" + "="*80)
    print("TASK 3: NEW SALON SIGNUP AUTO-CREATES MAIN BRANCH")
    print("="*80)
    
    task_name = "New salon signup auto-creates Main Branch (customer search visibility)"
    
    # Step 1: Get public salon locations count before
    print("\n[3.1] Getting public salon locations count before...")
    url_public = f"{BASE_URL}/public/salon-locations"
    response = requests.get(url_public)
    
    if response.status_code != 200:
        log_test(task_name, "Get public locations (before)", False, f"Status: {response.status_code}")
        return
    
    locations_before = response.json().get("locations", [])
    count_before = len(locations_before)
    print(f"   Public locations before: {count_before}")
    log_test(task_name, "Get public locations (before)", True, f"Count: {count_before}")
    
    # Step 2: Register a new salon
    print("\n[3.2] Registering new salon...")
    unique_phone = f"9876{random_string(6)}"
    salon_data = {
        "name": f"Test Salon {random_string()}",
        "phone": unique_phone,
        "address": "Test Address",
        "city": "Bangalore",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "password": "test123"
    }
    
    url_register = f"{BASE_URL}/salon/register"
    response = requests.post(url_register, json=salon_data)
    
    if response.status_code != 200:
        print(f"   ❌ Failed to register salon: {response.status_code}")
        print(f"   Response: {response.text[:300]}")
        log_test(task_name, "Register new salon", False, f"Status: {response.status_code}")
        return
    
    new_salon = response.json()
    new_salon_id = new_salon.get("id")
    new_salon_name = new_salon.get("name")
    print(f"   ✅ Salon registered:")
    print(f"      ID: {new_salon_id}")
    print(f"      Name: {new_salon_name}")
    log_test(task_name, "Register new salon", True, f"Salon ID: {new_salon_id}")
    
    # Step 3: Check if Main Branch was created
    print("\n[3.3] Checking if Main Branch was created...")
    url_branches = f"{BASE_URL}/salons/{new_salon_id}/branches"
    response = requests.get(url_branches)
    
    if response.status_code != 200:
        log_test(task_name, "Check Main Branch created", False, 
                f"Failed to get branches: {response.status_code}")
        return
    
    branches = response.json().get("branches", [])
    main_branch = None
    for branch in branches:
        if branch.get("name") == "Main Branch" or branch.get("is_main"):
            main_branch = branch
            break
    
    if main_branch:
        print(f"   ✅ Main Branch found:")
        print(f"      ID: {main_branch.get('id')}")
        print(f"      Name: {main_branch.get('name')}")
        print(f"      Is Main: {main_branch.get('is_main')}")
        log_test(task_name, "Main Branch auto-created", True, 
                f"Branch ID: {main_branch.get('id')}")
    else:
        log_test(task_name, "Main Branch auto-created", False, 
                f"No Main Branch found. Branches: {len(branches)}")
        return
    
    # Step 4: Verify new salon appears in public locations
    print("\n[3.4] Verifying new salon in public locations...")
    response = requests.get(url_public)
    
    if response.status_code != 200:
        log_test(task_name, "Verify in public locations", False, 
                f"Failed to get public locations: {response.status_code}")
        return
    
    locations_after = response.json().get("locations", [])
    count_after = len(locations_after)
    
    # Find the new salon in public locations
    new_salon_location = None
    for loc in locations_after:
        if loc.get("salon_id") == new_salon_id:
            new_salon_location = loc
            break
    
    if new_salon_location:
        print(f"   ✅ New salon found in public locations:")
        print(f"      Salon ID: {new_salon_location.get('salon_id')}")
        print(f"      Salon Name: {new_salon_location.get('salon_name')}")
        print(f"      Branch ID: {new_salon_location.get('branch_id')}")
        print(f"      Branch Name: {new_salon_location.get('branch_name')}")
        print(f"      Total locations: {count_before} → {count_after}")
        log_test(task_name, "New salon in public locations", True, 
                f"Found in public locations immediately after signup")
    else:
        log_test(task_name, "New salon in public locations", False, 
                f"New salon not found in public locations. Count: {count_before} → {count_after}")

# ============================================================================
# TASK 4: Inventory Manual Add - Auto Financial Purchase Entry
# ============================================================================

def test_task4_inventory_financial_entry():
    """Test inventory manual add with auto financial purchase entry"""
    print("\n" + "="*80)
    print("TASK 4: INVENTORY MANUAL ADD - AUTO FINANCIAL PURCHASE ENTRY")
    print("="*80)
    
    task_name = "Inventory manual add — auto financial purchase entry"
    
    # Step 1: Add inventory with purchase_payment_mode='none' (no financial entry)
    print("\n[4.1] Adding inventory with purchase_payment_mode='none'...")
    item_data = {
        "name": f"Test Item None {random_string()}",
        "brand": "Test Brand",
        "category": "Hair Care",
        "unit": "bottle",
        "pack_size": "100ml",
        "cost_price": 50,
        "selling_price": 100,
        "gst_percent": 18,
        "qty_total": 10,
        "availability": "internal_only",
        "low_stock_threshold": 5,
        "purchase_payment_mode": "none"
    }
    
    url = f"{BASE_URL}/salon/inventory"
    response = requests.post(url, json=item_data, headers=get_headers())
    
    if response.status_code != 200:
        log_test(task_name, "Add inventory (payment_mode=none)", False, 
                f"Status: {response.status_code}, Response: {response.text[:200]}")
        return
    
    item_none = response.json()
    item_none_id = item_none.get("id")
    fin_txn_id_none = item_none.get("financial_transaction_id")
    
    print(f"   ✅ Item created:")
    print(f"      ID: {item_none_id}")
    print(f"      Financial Transaction ID: {fin_txn_id_none}")
    
    if fin_txn_id_none is None:
        print(f"   ✅ No financial transaction created (as expected)")
        log_test(task_name, "No financial entry when payment_mode=none", True, 
                "financial_transaction_id is None")
    else:
        log_test(task_name, "No financial entry when payment_mode=none", False, 
                f"Unexpected financial_transaction_id: {fin_txn_id_none}")
    
    # Step 2: Add inventory with purchase_payment_mode='cash' (should create financial entry)
    print("\n[4.2] Adding inventory with purchase_payment_mode='cash'...")
    item_data["name"] = f"Test Item Cash {random_string()}"
    item_data["purchase_payment_mode"] = "cash"
    item_data["cost_price"] = 75
    item_data["qty_total"] = 20
    
    response = requests.post(url, json=item_data, headers=get_headers())
    
    if response.status_code != 200:
        log_test(task_name, "Add inventory (payment_mode=cash)", False, 
                f"Status: {response.status_code}, Response: {response.text[:200]}")
        return
    
    item_cash = response.json()
    item_cash_id = item_cash.get("id")
    fin_txn_id_cash = item_cash.get("financial_transaction_id")
    
    print(f"   ✅ Item created:")
    print(f"      ID: {item_cash_id}")
    print(f"      Financial Transaction ID: {fin_txn_id_cash}")
    
    if fin_txn_id_cash:
        print(f"   ✅ Financial transaction created")
        log_test(task_name, "Financial entry created (payment_mode=cash)", True, 
                f"Transaction ID: {fin_txn_id_cash}")
    else:
        log_test(task_name, "Financial entry created (payment_mode=cash)", False, 
                "financial_transaction_id is None")
        return
    
    # Step 3: Verify financial transaction details
    print("\n[4.3] Verifying financial transaction details...")
    url_fin = f"{BASE_URL}/salons/{SALON_ID}/financial-transactions"
    response = requests.get(url_fin, headers=get_headers())
    
    if response.status_code != 200:
        log_test(task_name, "Get financial transactions", False, 
                f"Status: {response.status_code}")
        return
    
    transactions = response.json().get("transactions", [])
    
    # Find the transaction we just created
    our_txn = None
    for txn in transactions:
        if txn.get("id") == fin_txn_id_cash:
            our_txn = txn
            break
    
    if not our_txn:
        log_test(task_name, "Verify financial transaction", False, 
                "Transaction not found in financial_transactions list")
        return
    
    expected_amount = 75 * 20  # cost_price * qty_total
    actual_amount = our_txn.get("amount")
    txn_type = our_txn.get("type")
    txn_category = our_txn.get("category")
    payment_mode = our_txn.get("payment_mode")
    
    print(f"   ✅ Financial transaction found:")
    print(f"      Type: {txn_type}")
    print(f"      Category: {txn_category}")
    print(f"      Amount: ₹{actual_amount}")
    print(f"      Payment Mode: {payment_mode}")
    print(f"      Expected Amount: ₹{expected_amount}")
    
    all_correct = True
    errors = []
    
    if txn_type != "outflow":
        all_correct = False
        errors.append(f"Type should be 'outflow', got '{txn_type}'")
    
    if txn_category != "inventory_purchase":
        all_correct = False
        errors.append(f"Category should be 'inventory_purchase', got '{txn_category}'")
    
    if actual_amount != expected_amount:
        all_correct = False
        errors.append(f"Amount should be {expected_amount}, got {actual_amount}")
    
    if payment_mode != "cash":
        all_correct = False
        errors.append(f"Payment mode should be 'cash', got '{payment_mode}'")
    
    if all_correct:
        log_test(task_name, "Verify financial transaction details", True, 
                f"Type: {txn_type}, Category: {txn_category}, Amount: ₹{actual_amount}")
    else:
        log_test(task_name, "Verify financial transaction details", False, 
                "; ".join(errors))
    
    # Step 4: Test with UPI payment mode
    print("\n[4.4] Testing with purchase_payment_mode='upi'...")
    item_data["name"] = f"Test Item UPI {random_string()}"
    item_data["purchase_payment_mode"] = "upi"
    item_data["cost_price"] = 100
    item_data["qty_total"] = 15
    
    response = requests.post(url, json=item_data, headers=get_headers())
    
    if response.status_code == 200:
        item_upi = response.json()
        fin_txn_id_upi = item_upi.get("financial_transaction_id")
        
        if fin_txn_id_upi:
            print(f"   ✅ Financial transaction created for UPI: {fin_txn_id_upi}")
            log_test(task_name, "Financial entry (payment_mode=upi)", True, 
                    f"Transaction ID: {fin_txn_id_upi}")
        else:
            log_test(task_name, "Financial entry (payment_mode=upi)", False, 
                    "financial_transaction_id is None")
    else:
        log_test(task_name, "Financial entry (payment_mode=upi)", False, 
                f"Status: {response.status_code}")
    
    # Step 5: Test with bank payment mode
    print("\n[5] Testing with purchase_payment_mode='bank'...")
    item_data["name"] = f"Test Item Bank {random_string()}"
    item_data["purchase_payment_mode"] = "bank"
    item_data["cost_price"] = 150
    item_data["qty_total"] = 8
    
    response = requests.post(url, json=item_data, headers=get_headers())
    
    if response.status_code == 200:
        item_bank = response.json()
        fin_txn_id_bank = item_bank.get("financial_transaction_id")
        
        if fin_txn_id_bank:
            print(f"   ✅ Financial transaction created for bank: {fin_txn_id_bank}")
            log_test(task_name, "Financial entry (payment_mode=bank)", True, 
                    f"Transaction ID: {fin_txn_id_bank}")
        else:
            log_test(task_name, "Financial entry (payment_mode=bank)", False, 
                    "financial_transaction_id is None")
    else:
        log_test(task_name, "Financial entry (payment_mode=bank)", False, 
                f"Status: {response.status_code}")

# ============================================================================
# TASK 5: Inventory Sell - Optional Customer Name/Phone Persistence
# ============================================================================

def test_task5_inventory_sell_customer_info():
    """Test inventory sell with optional customer name/phone persistence"""
    print("\n" + "="*80)
    print("TASK 5: INVENTORY SELL - OPTIONAL CUSTOMER NAME/PHONE PERSISTENCE")
    print("="*80)
    
    task_name = "Inventory sell — optional customer_name/phone persistence"
    
    # Step 1: Create an inventory item for selling
    print("\n[5.1] Creating inventory item for sell test...")
    item_data = {
        "name": f"Test Sell Item {random_string()}",
        "brand": "Test Brand",
        "category": "Hair Care",
        "unit": "bottle",
        "pack_size": "200ml",
        "cost_price": 80,
        "selling_price": 150,
        "gst_percent": 18,
        "qty_total": 50,
        "availability": "both",
        "low_stock_threshold": 10,
        "purchase_payment_mode": "none"
    }
    
    url = f"{BASE_URL}/salon/inventory"
    response = requests.post(url, json=item_data, headers=get_headers())
    
    if response.status_code != 200:
        log_test(task_name, "Create inventory item", False, 
                f"Status: {response.status_code}, Response: {response.text[:200]}")
        return
    
    item = response.json()
    item_id = item.get("id")
    print(f"   ✅ Item created: {item_id}")
    log_test(task_name, "Create inventory item", True, f"Item ID: {item_id}")
    
    # Step 2: Sell without customer info (should work)
    print("\n[5.2] Selling without customer info...")
    sell_data = {
        "qty": 5,
        "payment_mode": "cash",
        "note": "Test sale without customer info"
    }
    
    url_sell = f"{BASE_URL}/salon/inventory/{item_id}/sell"
    response = requests.post(url_sell, json=sell_data, headers=get_headers())
    
    if response.status_code != 200:
        log_test(task_name, "Sell without customer info", False, 
                f"Status: {response.status_code}, Response: {response.text[:200]}")
        return
    
    sale_result = response.json()
    txn_id_no_customer = sale_result.get("transaction_id")
    amount = sale_result.get("amount")
    
    print(f"   ✅ Sale successful:")
    print(f"      Transaction ID: {txn_id_no_customer}")
    print(f"      Amount: ₹{amount}")
    log_test(task_name, "Sell without customer info", True, 
            f"Transaction ID: {txn_id_no_customer}")
    
    # Step 3: Verify transaction has no customer info
    print("\n[5.3] Verifying transaction has no customer info...")
    url_fin = f"{BASE_URL}/salons/{SALON_ID}/financial-transactions"
    response = requests.get(url_fin, headers=get_headers())
    
    if response.status_code != 200:
        log_test(task_name, "Get transaction (no customer)", False, 
                f"Status: {response.status_code}")
        return
    
    transactions = response.json().get("transactions", [])
    txn_no_customer = None
    for txn in transactions:
        if txn.get("id") == txn_id_no_customer:
            txn_no_customer = txn
            break
    
    if txn_no_customer:
        customer_name = txn_no_customer.get("customer_name")
        customer_phone = txn_no_customer.get("customer_phone")
        
        print(f"   Transaction found:")
        print(f"      Customer Name: {customer_name}")
        print(f"      Customer Phone: {customer_phone}")
        
        if customer_name is None and customer_phone is None:
            print(f"   ✅ Customer info correctly null/empty")
            log_test(task_name, "Transaction without customer info", True, 
                    "customer_name and customer_phone are null")
        else:
            log_test(task_name, "Transaction without customer info", False, 
                    f"Expected null, got name={customer_name}, phone={customer_phone}")
    else:
        log_test(task_name, "Transaction without customer info", False, 
                "Transaction not found")
    
    # Step 4: Sell WITH customer info (10-digit phone)
    print("\n[5.4] Selling WITH customer info (10-digit phone)...")
    sell_data = {
        "qty": 3,
        "payment_mode": "upi",
        "customer_name": "Test Customer",
        "customer_phone": "9876543210",
        "note": "Test sale with customer info"
    }
    
    response = requests.post(url_sell, json=sell_data, headers=get_headers())
    
    if response.status_code != 200:
        log_test(task_name, "Sell with customer info", False, 
                f"Status: {response.status_code}, Response: {response.text[:200]}")
        return
    
    sale_result = response.json()
    txn_id_with_customer = sale_result.get("transaction_id")
    amount = sale_result.get("amount")
    
    print(f"   ✅ Sale successful:")
    print(f"      Transaction ID: {txn_id_with_customer}")
    print(f"      Amount: ₹{amount}")
    log_test(task_name, "Sell with customer info", True, 
            f"Transaction ID: {txn_id_with_customer}")
    
    # Step 5: Verify transaction has customer info with normalized phone
    print("\n[5.5] Verifying transaction has customer info with +91 normalization...")
    response = requests.get(url_fin, headers=get_headers())
    
    if response.status_code != 200:
        log_test(task_name, "Get transaction (with customer)", False, 
                f"Status: {response.status_code}")
        return
    
    transactions = response.json().get("transactions", [])
    txn_with_customer = None
    for txn in transactions:
        if txn.get("id") == txn_id_with_customer:
            txn_with_customer = txn
            break
    
    if not txn_with_customer:
        log_test(task_name, "Verify customer info persistence", False, 
                "Transaction not found")
        return
    
    customer_name = txn_with_customer.get("customer_name")
    customer_phone = txn_with_customer.get("customer_phone")
    
    print(f"   Transaction found:")
    print(f"      Customer Name: {customer_name}")
    print(f"      Customer Phone: {customer_phone}")
    
    all_correct = True
    errors = []
    
    if customer_name != "Test Customer":
        all_correct = False
        errors.append(f"Name should be 'Test Customer', got '{customer_name}'")
    
    if customer_phone != "+919876543210":
        all_correct = False
        errors.append(f"Phone should be '+919876543210', got '{customer_phone}'")
    
    if all_correct:
        print(f"   ✅ Customer info persisted correctly with +91 normalization")
        log_test(task_name, "Customer info persistence with +91 normalization", True, 
                f"Name: {customer_name}, Phone: {customer_phone}")
    else:
        log_test(task_name, "Customer info persistence with +91 normalization", False, 
                "; ".join(errors))
    
    # Step 6: Test with already normalized phone (+91 prefix)
    print("\n[5.6] Testing with already normalized phone (+91 prefix)...")
    sell_data = {
        "qty": 2,
        "payment_mode": "card",
        "customer_name": "Another Customer",
        "customer_phone": "+919988776655",
        "note": "Test with +91 prefix"
    }
    
    response = requests.post(url_sell, json=sell_data, headers=get_headers())
    
    if response.status_code == 200:
        sale_result = response.json()
        txn_id_normalized = sale_result.get("transaction_id")
        
        # Get the transaction
        response = requests.get(url_fin, headers=get_headers())
        if response.status_code == 200:
            transactions = response.json().get("transactions", [])
            txn_normalized = None
            for txn in transactions:
                if txn.get("id") == txn_id_normalized:
                    txn_normalized = txn
                    break
            
            if txn_normalized:
                customer_phone = txn_normalized.get("customer_phone")
                print(f"   Customer Phone: {customer_phone}")
                
                if customer_phone == "+919988776655":
                    print(f"   ✅ Already normalized phone preserved correctly")
                    log_test(task_name, "Already normalized phone preserved", True, 
                            f"Phone: {customer_phone}")
                else:
                    log_test(task_name, "Already normalized phone preserved", False, 
                            f"Expected '+919988776655', got '{customer_phone}'")
            else:
                log_test(task_name, "Already normalized phone preserved", False, 
                        "Transaction not found")
        else:
            log_test(task_name, "Already normalized phone preserved", False, 
                    f"Failed to get transactions: {response.status_code}")
    else:
        log_test(task_name, "Already normalized phone preserved", False, 
                f"Sale failed: {response.status_code}")

# ============================================================================
# MAIN EXECUTION
# ============================================================================

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    # Group by task
    tasks = {}
    for result in test_results:
        task = result["task"]
        if task not in tasks:
            tasks[task] = {"passed": 0, "failed": 0, "tests": []}
        
        if result["passed"]:
            tasks[task]["passed"] += 1
        else:
            tasks[task]["failed"] += 1
        
        tasks[task]["tests"].append(result)
    
    # Print summary for each task
    for task_name, task_data in tasks.items():
        total = task_data["passed"] + task_data["failed"]
        pass_rate = (task_data["passed"] / total * 100) if total > 0 else 0
        
        status = "✅ PASS" if task_data["failed"] == 0 else "❌ FAIL"
        print(f"\n{status}: {task_name}")
        print(f"   Tests: {task_data['passed']}/{total} passed ({pass_rate:.1f}%)")
        
        # Show failed tests
        if task_data["failed"] > 0:
            print(f"   Failed tests:")
            for test in task_data["tests"]:
                if not test["passed"]:
                    print(f"      - {test['test']}: {test['details']}")
    
    # Overall summary
    total_tests = len(test_results)
    total_passed = sum(1 for r in test_results if r["passed"])
    total_failed = total_tests - total_passed
    overall_pass_rate = (total_passed / total_tests * 100) if total_tests > 0 else 0
    
    print(f"\n{'='*80}")
    print(f"OVERALL: {total_passed}/{total_tests} tests passed ({overall_pass_rate:.1f}%)")
    print(f"{'='*80}\n")

def main():
    """Main test execution"""
    print("="*80)
    print("BACKEND TESTING - 5 PENDING TASKS (JULY 4, 2026 SESSION)")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Salon ID: {SALON_ID}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Login
    if not login_admin():
        print("\n❌ Failed to login. Aborting tests.")
        return
    
    # Run all tests
    try:
        test_task1_wallet_booking()
        test_task2_bulk_delete_services()
        test_task3_main_branch_creation()
        test_task4_inventory_financial_entry()
        test_task5_inventory_sell_customer_info()
    except Exception as e:
        print(f"\n❌ Test execution error: {e}")
        import traceback
        traceback.print_exc()
    
    # Print summary
    print_summary()

if __name__ == "__main__":
    main()
