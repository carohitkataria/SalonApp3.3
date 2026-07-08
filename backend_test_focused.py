#!/usr/bin/env python3
"""
Focused Backend Testing for Failed Tests - July 4, 2026
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://jovial-mcclintock-6.preview.emergentagent.com"
ADMIN_IDENTIFIER = "admin"
ADMIN_PASSWORD = "salon123"

admin_token = None
salon_id = None

def admin_login():
    global admin_token, salon_id
    url = f"{BASE_URL}/api/salon/users/login"
    payload = {"identifier": ADMIN_IDENTIFIER, "password": ADMIN_PASSWORD}
    resp = requests.post(url, json=payload, timeout=30)
    if resp.status_code == 200:
        data = resp.json()
        admin_token = data.get("access_token")
        salon_id = data.get("salon_id")
        print(f"✅ Logged in: salon_id={salon_id}")
        return True
    print(f"❌ Login failed: {resp.status_code}")
    return False

def get_headers():
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

print("="*80)
print("FOCUSED BACKEND TESTS - JULY 4, 2026")
print("="*80)

if not admin_login():
    exit(1)

# ===== TEST 1: Wallet Booking (need to create/enable services first) =====
print("\n" + "="*80)
print("TEST 1: WALLET BOOKING - Check Services")
print("="*80)

# Check enabled services
services_url = f"{BASE_URL}/api/salons/{salon_id}/services/enabled"
resp = requests.get(services_url, timeout=30)
print(f"\nGET {services_url}")
print(f"Status: {resp.status_code}")
if resp.status_code == 200:
    services = resp.json()
    print(f"Enabled services count: {len(services)}")
    if len(services) == 0:
        print("⚠️  No enabled services - need to enable some first")
        # Try to get all services
        all_url = f"{BASE_URL}/api/salons/{salon_id}/services/all"
        resp = requests.get(all_url, timeout=30)
        if resp.status_code == 200:
            all_services = resp.json()
            print(f"Total services: {len(all_services)}")
            if len(all_services) > 0:
                print(f"First service: {all_services[0].get('service_name')} (id: {all_services[0].get('id')})")
    else:
        service_id = services[0].get("id")
        print(f"✅ Found service: {services[0].get('service_name')} (id: {service_id})")
        
        # Now test wallet booking
        print("\nTesting wallet booking with service...")
        customer_phone = "7503070911"
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
        print(f"POST {booking_url}")
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ Wallet booking successful!")
            print(f"   payment_mode: {data.get('payment_mode')}")
            print(f"   payment_status: {data.get('payment_status')}")
            print(f"   payment_confirmed: {data.get('payment_confirmed')}")
        else:
            print(f"❌ Wallet booking failed: {resp.text}")

# ===== TEST 2: Bulk Delete Investigation =====
print("\n" + "="*80)
print("TEST 2: BULK DELETE - Investigation")
print("="*80)

# Check the service we created
service_id = "ce5cf9bc-4224-48c7-95f7-ddc531b85d75"
global_id = "f0b24ef4-755a-4c9f-b950-3e89e761c20c"

print(f"\nChecking if services exist...")
all_url = f"{BASE_URL}/api/salons/{salon_id}/services/all"
resp = requests.get(all_url, timeout=30)
if resp.status_code == 200:
    all_services = resp.json()
    salon_svc = next((s for s in all_services if s.get("id") == service_id), None)
    global_svc = next((s for s in all_services if s.get("id") == global_id), None)
    
    print(f"Salon service {service_id}: {'Found' if salon_svc else 'NOT FOUND'}")
    if salon_svc:
        print(f"  salon_id: {salon_svc.get('salon_id')}")
        print(f"  is_enabled_for_salon: {salon_svc.get('is_enabled_for_salon')}")
    
    print(f"Global service {global_id}: {'Found' if global_svc else 'NOT FOUND'}")
    if global_svc:
        print(f"  salon_id: {global_svc.get('salon_id')}")
        print(f"  is_enabled_for_salon: {global_svc.get('is_enabled_for_salon')}")

# Try bulk delete again with fresh services
print("\nCreating fresh services for bulk delete test...")
create_url = f"{BASE_URL}/api/services"
service_payload = {
    "salon_id": salon_id,
    "service_name": f"Test Service {datetime.now().strftime('%H%M%S')}",
    "category": "General",
    "base_price": 100,
    "default_duration": 30,
    "gender_tag": "Unisex"
}

resp = requests.post(create_url, json=service_payload, headers=get_headers(), timeout=30)
if resp.status_code in [200, 201]:
    new_service = resp.json()
    new_service_id = new_service.get("id")
    print(f"✅ Created salon service: {new_service_id}")
    
    # Find a global service
    resp = requests.get(all_url, timeout=30)
    if resp.status_code == 200:
        all_services = resp.json()
        global_svc = next((s for s in all_services if s.get("salon_id") != salon_id), None)
        if global_svc:
            global_svc_id = global_svc.get("id")
            print(f"✅ Found global service: {global_svc_id}")
            
            # Now test bulk delete
            print("\nTesting bulk delete...")
            bulk_url = f"{BASE_URL}/api/salons/{salon_id}/services/bulk-delete"
            delete_payload = {"service_ids": [new_service_id, global_svc_id]}
            
            resp = requests.post(bulk_url, json=delete_payload, headers=get_headers(), timeout=30)
            print(f"POST {bulk_url}")
            print(f"Status: {resp.status_code}")
            if resp.status_code == 200:
                result = resp.json()
                print(f"Response: {json.dumps(result, indent=2)}")
                print(f"✅ ok: {result.get('ok')}")
                print(f"   hard_deleted: {result.get('hard_deleted')}")
                print(f"   disabled_for_salon: {result.get('disabled_for_salon')}")
            else:
                print(f"❌ Failed: {resp.text}")

# ===== TEST 3: New Salon Registration with +91 =====
print("\n" + "="*80)
print("TEST 3: NEW SALON REGISTRATION")
print("="*80)

register_url = f"{BASE_URL}/api/salon/register"
unique_phone = f"+91750399{datetime.now().strftime('%H%M%S')}"
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

print(f"\nPOST {register_url}")
print(f"Phone: {unique_phone}")
resp = requests.post(register_url, json=register_payload, timeout=30)
print(f"Status: {resp.status_code}")
if resp.status_code in [200, 201]:
    salon_data = resp.json()
    new_salon_id = salon_data.get("id") or salon_data.get("salon_id")
    print(f"✅ Created salon: {new_salon_id}")
    
    # Check branches
    branches_url = f"{BASE_URL}/api/public/salons/{new_salon_id}/branches"
    resp = requests.get(branches_url, timeout=30)
    print(f"\nGET {branches_url}")
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        branches = resp.json()
        print(f"Branches count: {len(branches)}")
        if len(branches) > 0:
            branch = branches[0]
            print(f"✅ Main branch: {branch.get('branch_name')}")
            print(f"   is_main_branch: {branch.get('is_main_branch')}")
        else:
            print(f"❌ No branches found")
else:
    print(f"❌ Failed: {resp.text}")

# ===== TEST 4: Financial Transactions API Format =====
print("\n" + "="*80)
print("TEST 4: FINANCIAL TRANSACTIONS API")
print("="*80)

fin_url = f"{BASE_URL}/api/salons/{salon_id}/financials/transactions"
resp = requests.get(fin_url, headers=get_headers(), timeout=30)
print(f"\nGET {fin_url}")
print(f"Status: {resp.status_code}")
if resp.status_code == 200:
    data = resp.json()
    print(f"Response type: {type(data)}")
    print(f"Keys: {list(data.keys()) if isinstance(data, dict) else 'N/A'}")
    
    if isinstance(data, dict) and "transactions" in data:
        txns = data["transactions"]
        print(f"✅ Transactions count: {len(txns)}")
        if len(txns) > 0:
            print(f"First transaction keys: {list(txns[0].keys())}")
            print(f"Sample: category={txns[0].get('category')}, amount={txns[0].get('amount')}")
    else:
        print(f"❌ Unexpected format: {data}")

print("\n" + "="*80)
print("FOCUSED TESTS COMPLETE")
print("="*80)
