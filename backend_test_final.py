#!/usr/bin/env python3
"""
FINAL Comprehensive Backend Testing - July 4, 2026 Session
Tests all 5 sections with proper fixes
"""

import requests
import json
from datetime import datetime
import random

BASE_URL = "https://slot-scheduling-wip.preview.emergentagent.com"
ADMIN_IDENTIFIER = "admin"
ADMIN_PASSWORD = "salon123"

admin_token = None
salon_id = None
test_results = []

def log_result(section, test, passed, details=""):
    status = "✅" if passed else "❌"
    test_results.append({"section": section, "test": test, "passed": passed, "details": details})
    print(f"{status} {section} | {test}")
    if details:
        print(f"    {details}")

def admin_login():
    global admin_token, salon_id
    url = f"{BASE_URL}/api/salon/users/login"
    payload = {"identifier": ADMIN_IDENTIFIER, "password": ADMIN_PASSWORD}
    resp = requests.post(url, json=payload, timeout=30)
    if resp.status_code == 200:
        data = resp.json()
        admin_token = data.get("access_token")
        salon_id = data.get("salon_id")
        log_result("AUTH", "Admin login", True, f"salon_id={salon_id}")
        return True
    log_result("AUTH", "Admin login", False, f"Status {resp.status_code}")
    return False

def get_headers():
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

print("="*80)
print("SALONHUB BACKEND TESTING - JULY 4, 2026 SESSION (FINAL)")
print("="*80)

if not admin_login():
    exit(1)

# ===== SECTION 1: WALLET BOOKING =====
print("\n" + "="*80)
print("SECTION 1: SALON MANUAL BOOKING — WALLET PAYMENT MODE")
print("="*80)

# Create membership plan
plan_url = f"{BASE_URL}/api/salons/{salon_id}/membership-plans"
plan_payload = {
    "salon_id": salon_id,
    "name": "Test Plan Jul",
    "amount": 1000,
    "credit": 2000,
    "validity_months": 6,
    "terms_conditions": "Test"
}

resp = requests.post(plan_url, json=plan_payload, headers=get_headers(), timeout=30)
if resp.status_code in [200, 201]:
    plan_id = resp.json().get("id")
    log_result("WALLET", "Create membership plan", True, f"plan_id={plan_id}")
    
    # Buy membership
    customer_phone = "7503070911"
    buy_url = f"{BASE_URL}/api/salons/{salon_id}/customers/{customer_phone}/buy-membership"
    buy_payload = {
        "customer_name": "Wallet Cust",
        "customer_phone": customer_phone,
        "membership_plan_id": plan_id,
        "payment_mode": "cash",
        "paid_amount": 1000
    }
    
    resp = requests.post(buy_url, json=buy_payload, timeout=30)
    if resp.status_code in [200, 201]:
        membership_id = resp.json().get("membership", {}).get("id") or resp.json().get("id")
        log_result("WALLET", "Buy membership", True, f"membership_id={membership_id}")
        
        # Confirm payment
        confirm_url = f"{BASE_URL}/api/salons/{salon_id}/memberships/{membership_id}/confirm-payment"
        resp = requests.post(confirm_url, headers=get_headers(), timeout=30)
        if resp.status_code == 200:
            log_result("WALLET", "Confirm payment", True)
            
            # Check wallet balance
            wallet_url = f"{BASE_URL}/api/salons/{salon_id}/customer-membership/{customer_phone}"
            resp = requests.get(wallet_url, timeout=30)
            if resp.status_code == 200:
                wallet_balance = resp.json().get("wallet_balance", 0)
                log_result("WALLET", "Wallet balance confirmed", wallet_balance > 0, f"balance={wallet_balance}")
                
                # Enable a service first
                all_services_url = f"{BASE_URL}/api/salons/{salon_id}/services/all"
                resp = requests.get(all_services_url, timeout=30)
                if resp.status_code == 200:
                    all_services = resp.json()
                    if len(all_services) > 0:
                        service_id = all_services[0].get("id")
                        
                        # Enable the service
                        enable_url = f"{BASE_URL}/api/salons/{salon_id}/services/{service_id}/enable"
                        resp = requests.post(enable_url, headers=get_headers(), timeout=30)
                        log_result("WALLET", "Enable service", resp.status_code == 200, f"service_id={service_id}")
                        
                        # T1a: Successful wallet booking
                        today = datetime.now().strftime("%Y-%m-%d")
                        booking_url = f"{BASE_URL}/api/salons/{salon_id}/salon-booking"
                        booking_payload = {
                            "customer_name": "Wallet Cust",
                            "phone": customer_phone,
                            "gender": "Men",
                            "barber_id": "any",
                            "selected_services": [service_id],
                            "shift": "Morning",
                            "date": today,
                            "payment_mode": "wallet"
                        }
                        
                        resp = requests.post(booking_url, json=booking_payload, headers=get_headers(), timeout=30)
                        if resp.status_code == 200:
                            data = resp.json()
                            success = (data.get("payment_mode") == "wallet" and 
                                     data.get("payment_status") == "paid" and 
                                     data.get("payment_confirmed") == True)
                            log_result("WALLET", "T1a - Successful wallet booking", success, 
                                     f"mode={data.get('payment_mode')}, status={data.get('payment_status')}")
                            
                            # Check wallet balance decreased
                            resp = requests.get(wallet_url, timeout=30)
                            if resp.status_code == 200:
                                new_balance = resp.json().get("wallet_balance", 0)
                                log_result("WALLET", "T1a - Wallet balance decreased", new_balance < wallet_balance,
                                         f"old={wallet_balance}, new={new_balance}")
                            
                            # Check wallet transaction
                            txn_url = f"{BASE_URL}/api/salons/{salon_id}/wallet-transactions/{customer_phone}"
                            resp = requests.get(txn_url, timeout=30)
                            if resp.status_code == 200:
                                txns = resp.json()
                                log_result("WALLET", "T1a - Wallet transaction created", len(txns) > 0,
                                         f"count={len(txns)}")
                        else:
                            log_result("WALLET", "T1a - Successful wallet booking", False, f"Status {resp.status_code}")
                        
                        # T1b: Without phone
                        booking_no_phone = booking_payload.copy()
                        del booking_no_phone["phone"]
                        resp = requests.post(booking_url, json=booking_no_phone, headers=get_headers(), timeout=30)
                        log_result("WALLET", "T1b - Wallet booking without phone rejected", resp.status_code == 400,
                                 f"Status {resp.status_code}")
                        
                        # T1c: No membership
                        booking_no_membership = booking_payload.copy()
                        booking_no_membership["phone"] = "9999999999"
                        resp = requests.post(booking_url, json=booking_no_membership, headers=get_headers(), timeout=30)
                        log_result("WALLET", "T1c - No membership rejected", resp.status_code == 400,
                                 f"Status {resp.status_code}")

# ===== SECTION 2: BULK DELETE =====
print("\n" + "="*80)
print("SECTION 2: BULK DELETE SALON SERVICES")
print("="*80)

# The issue is that POST /api/services creates services with salon_id=null
# Let me check if there's a different endpoint or if we need to use the DB directly
# For now, let's document this as a BUG

log_result("BULK_DELETE", "ISSUE FOUND", False, 
          "POST /api/services creates services with salon_id=null instead of the actual salon_id. " +
          "This causes bulk-delete to not recognize them as salon-owned services. " +
          "The endpoint returns hard_deleted=0 because it can't find services with matching salon_id.")

# Test other aspects
bulk_url = f"{BASE_URL}/api/salons/{salon_id}/services/bulk-delete"

# T2b: Empty body
resp = requests.post(bulk_url, json={}, headers=get_headers(), timeout=30)
log_result("BULK_DELETE", "T2b - Empty body rejected", resp.status_code == 400, f"Status {resp.status_code}")

# T2c: Non-existent ID
fake_id = "00000000-0000-0000-0000-000000000000"
resp = requests.post(bulk_url, json={"service_ids": [fake_id]}, headers=get_headers(), timeout=30)
log_result("BULK_DELETE", "T2c - Non-existent ID (no crash)", resp.status_code == 200 and resp.json().get("ok"),
         f"Status {resp.status_code}")

# T2d: Auth required
resp = requests.post(bulk_url, json={"service_ids": [fake_id]}, timeout=30)
log_result("BULK_DELETE", "T2d - Auth required", resp.status_code in [401, 403], f"Status {resp.status_code}")

# ===== SECTION 3: NEW SALON MAIN BRANCH =====
print("\n" + "="*80)
print("SECTION 3: NEW SALON AUTO-CREATES MAIN BRANCH")
print("="*80)

register_url = f"{BASE_URL}/api/salon/register"
# Use 10-digit phone (will be prefixed with +91 to make 13 chars total)
unique_phone = f"9999{random.randint(100000, 999999)}"
register_payload = {
    "salon_name": "Test New Salon Jul",
    "owner_name": "Owner",
    "phone": unique_phone,
    "email": "n@ex.com",
    "address": "X Y Z",
    "city": "Bangalore",
    "latitude": 12.97,
    "longitude": 77.59,
    "password": "pass1234"
}

resp = requests.post(register_url, json=register_payload, timeout=30)
if resp.status_code in [200, 201]:
    new_salon_id = resp.json().get("id") or resp.json().get("salon_id")
    log_result("MAIN_BRANCH", "Create new salon", True, f"salon_id={new_salon_id}")
    
    # Check branches
    branches_url = f"{BASE_URL}/api/public/salons/{new_salon_id}/branches"
    resp = requests.get(branches_url, timeout=30)
    if resp.status_code == 200:
        branches = resp.json()
        if len(branches) == 1:
            branch = branches[0]
            success = branch.get("is_main_branch") and branch.get("branch_name") == "Main Branch"
            log_result("MAIN_BRANCH", "Main branch auto-created", success,
                     f"name={branch.get('branch_name')}, is_main={branch.get('is_main_branch')}")
        else:
            log_result("MAIN_BRANCH", "Main branch auto-created", False, f"Found {len(branches)} branches")
    
    # Check public locations
    locations_url = f"{BASE_URL}/api/public/salon-locations?city=Bangalore"
    resp = requests.get(locations_url, timeout=30)
    if resp.status_code == 200:
        locations = resp.json()
        found = any(loc.get("salon_id") == new_salon_id for loc in locations)
        log_result("MAIN_BRANCH", "Salon in public locations", found, f"Found in {len(locations)} locations")
else:
    log_result("MAIN_BRANCH", "Create new salon", False, f"Status {resp.status_code}: {resp.text}")

# ===== SECTION 4: INVENTORY AUTO FINANCIAL =====
print("\n" + "="*80)
print("SECTION 4: INVENTORY MANUAL ADD — AUTO FINANCIAL ENTRY")
print("="*80)

inventory_url = f"{BASE_URL}/api/salon/inventory"

# T4a: Auto-record purchase
inventory_payload = {
    "name": "Test Serum Jul",
    "category": "Skincare",
    "unit": "bottle",
    "cost_price": 200,
    "selling_price": 350,
    "qty_total": 5,
    "availability": "both",
    "low_stock_threshold": 2,
    "purchase_payment_mode": "cash",
    "purchase_note": "Bulk purchase"
}

resp = requests.post(inventory_url, json=inventory_payload, headers=get_headers(), timeout=30)
if resp.status_code == 200:
    item_data = resp.json()
    item_id = item_data.get("id")
    fin_txn_id = item_data.get("financial_transaction_id")
    
    if item_id and fin_txn_id:
        log_result("INVENTORY", "T4a - Auto financial entry created", True, f"item_id={item_id}, fin_txn_id={fin_txn_id}")
        
        # Verify transaction
        fin_url = f"{BASE_URL}/api/salons/{salon_id}/financials/transactions"
        resp = requests.get(fin_url, headers=get_headers(), timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            txns = data.get("transactions", [])
            txn = next((t for t in txns if t.get("id") == fin_txn_id), None)
            
            if txn:
                expected_amount = 200 * 5
                success = (txn.get("amount") == expected_amount and 
                          txn.get("payment_mode") == "cash" and 
                          txn.get("reference_type") == "manual_inventory_add" and 
                          "Test Serum Jul" in txn.get("narration", ""))
                log_result("INVENTORY", "T4a - Financial transaction verified", success,
                         f"amount={txn.get('amount')} (expected {expected_amount}), mode={txn.get('payment_mode')}")
            else:
                log_result("INVENTORY", "T4a - Financial transaction verified", False, "Transaction not found")
    else:
        log_result("INVENTORY", "T4a - Auto financial entry created", False, f"Missing IDs")
else:
    log_result("INVENTORY", "T4a - Auto financial entry created", False, f"Status {resp.status_code}")

# T4b: No finance entry with mode=none
inventory_none = {
    "name": "Test Serum Jul B",
    "cost_price": 100,
    "qty_total": 3,
    "purchase_payment_mode": "none"
}

resp = requests.post(inventory_url, json=inventory_none, headers=get_headers(), timeout=30)
if resp.status_code == 200:
    fin_txn_id = resp.json().get("financial_transaction_id")
    log_result("INVENTORY", "T4b - No finance entry with mode=none", not fin_txn_id,
             f"fin_txn_id={fin_txn_id}")
else:
    log_result("INVENTORY", "T4b - No finance entry with mode=none", False, f"Status {resp.status_code}")

# T4c: Zero cost
inventory_zero = {
    "name": "Test Serum Jul C",
    "cost_price": 0,
    "qty_total": 5,
    "purchase_payment_mode": "cash"
}

resp = requests.post(inventory_url, json=inventory_zero, headers=get_headers(), timeout=30)
if resp.status_code == 200:
    fin_txn_id = resp.json().get("financial_transaction_id")
    log_result("INVENTORY", "T4c - No finance entry for zero cost", not fin_txn_id,
             f"fin_txn_id={fin_txn_id}")
else:
    log_result("INVENTORY", "T4c - No finance entry for zero cost", False, f"Status {resp.status_code}")

# T4d: Invalid payment mode
inventory_invalid = {
    "name": "Test X",
    "purchase_payment_mode": "paytm"
}

resp = requests.post(inventory_url, json=inventory_invalid, headers=get_headers(), timeout=30)
log_result("INVENTORY", "T4d - Invalid payment mode rejected", resp.status_code in [400, 422],
         f"Status {resp.status_code}")

# ===== SECTION 5: INVENTORY SELL =====
print("\n" + "="*80)
print("SECTION 5: INVENTORY SELL — CUSTOMER FIELDS")
print("="*80)

# Create item with stock
inventory_sell = {
    "name": "Test Product Sell Jul",
    "category": "Haircare",
    "unit": "bottle",
    "cost_price": 100,
    "selling_price": 200,
    "qty_total": 10,
    "availability": "both",
    "purchase_payment_mode": "none"
}

resp = requests.post(inventory_url, json=inventory_sell, headers=get_headers(), timeout=30)
if resp.status_code == 200:
    item_id = resp.json().get("id")
    log_result("SELL", "Create inventory item", True, f"item_id={item_id}")
    
    # Sell with customer fields
    sell_url = f"{BASE_URL}/api/salon/inventory/{item_id}/sell"
    sell_payload = {
        "qty": 1,
        "payment_mode": "upi",
        "customer_name": "Rohit K",
        "customer_phone": "9876543210"
    }
    
    resp = requests.post(sell_url, json=sell_payload, headers=get_headers(), timeout=30)
    if resp.status_code == 200:
        sell_data = resp.json()
        txn_id = sell_data.get("transaction_id")
        log_result("SELL", "Sell with customer fields", True, f"txn_id={txn_id}, amount={sell_data.get('amount')}")
        
        # Verify customer fields in transaction
        fin_url = f"{BASE_URL}/api/salons/{salon_id}/financials/transactions"
        resp = requests.get(fin_url, headers=get_headers(), timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            txns = data.get("transactions", [])
            txn = next((t for t in txns if t.get("id") == txn_id), None)
            
            if txn:
                success = (txn.get("customer_name") == "Rohit K" and 
                          txn.get("customer_phone") == "+919876543210" and 
                          txn.get("category") == "product_sale" and 
                          txn.get("inventory_item_id") == item_id and 
                          "Rohit K" in txn.get("narration", ""))
                log_result("SELL", "Customer fields in transaction", success,
                         f"name={txn.get('customer_name')}, phone={txn.get('customer_phone')}")
            else:
                log_result("SELL", "Customer fields in transaction", False, "Transaction not found")
    else:
        log_result("SELL", "Sell with customer fields", False, f"Status {resp.status_code}")
else:
    log_result("SELL", "Create inventory item", False, f"Status {resp.status_code}")

# ===== SUMMARY =====
print("\n" + "="*80)
print("TEST SUMMARY")
print("="*80)

sections = {}
for r in test_results:
    section = r["section"]
    if section not in sections:
        sections[section] = {"passed": 0, "failed": 0}
    if r["passed"]:
        sections[section]["passed"] += 1
    else:
        sections[section]["failed"] += 1

total_passed = sum(s["passed"] for s in sections.values())
total_failed = sum(s["failed"] for s in sections.values())
total = total_passed + total_failed

print(f"\nOVERALL: {total_passed}/{total} PASSED ({total_passed*100//total if total > 0 else 0}%)")
print(f"         {total_failed} FAILED\n")

for section, stats in sections.items():
    status = "✅" if stats["failed"] == 0 else "❌"
    print(f"{status} {section}: {stats['passed']}/{stats['passed']+stats['failed']} passed")

print("\n" + "="*80)
print("DETAILED RESULTS")
print("="*80)

for section in sections.keys():
    print(f"\n{section}:")
    for r in test_results:
        if r["section"] == section:
            status = "✅" if r["passed"] else "❌"
            print(f"  {status} {r['test']}")
            if r["details"]:
                print(f"      {r['details']}")

print("\n" + "="*80)
