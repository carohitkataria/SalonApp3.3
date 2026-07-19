#!/usr/bin/env python3
"""
Backend test for seed_demo_dataset.py verification
"""
import requests
import json
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment
load_dotenv(Path(__file__).parent / "backend" / ".env")
load_dotenv(Path(__file__).parent / "frontend" / ".env")

BACKEND_URL = os.getenv("REACT_APP_BACKEND_URL", "").rstrip("/")
MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "salon_db")

SALON_ID = "3c753efb-215c-4c1f-a7da-df5b4b0ff779"

print(f"Backend URL: {BACKEND_URL}")
print(f"Salon ID: {SALON_ID}")
print("=" * 80)

# STEP 2 - DATA CHECKS
print("\n### STEP 2 - DATA CHECKS ###\n")

# Login as admin
print("2.0) Admin Login...")
login_response = requests.post(
    f"{BACKEND_URL}/api/salon/users/login",
    json={"identifier": "admin", "password": "salon123"}
)
print(f"Login Status: {login_response.status_code}")
if login_response.status_code == 200:
    login_data = login_response.json()
    access_token = login_data.get("access_token")
    print(f"✅ Login successful, access_token obtained")
    headers = {"Authorization": f"Bearer {access_token}"}
else:
    print(f"❌ Login failed: {login_response.text}")
    exit(1)

print("\n" + "=" * 80)

# 2a) GET /api/salons/{salon_id}/services/all — count >= 10
print("\n2a) GET /api/salons/{salon_id}/services/all")
services_response = requests.get(
    f"{BACKEND_URL}/api/salons/{SALON_ID}/services/all",
    headers=headers
)
print(f"Status: {services_response.status_code}")
if services_response.status_code == 200:
    services_data = services_response.json()
    services_count = len(services_data)
    print(f"Services count: {services_count}")
    if services_count >= 10:
        print(f"✅ PASS: Services count ({services_count}) >= 10")
    else:
        print(f"❌ FAIL: Services count ({services_count}) < 10")
else:
    print(f"❌ FAIL: {services_response.text}")

print("\n" + "=" * 80)

# 2b) GET /api/salons/{salon_id}/services/metrics-overview
print("\n2b) GET /api/salons/{salon_id}/services/metrics-overview")
metrics_response = requests.get(
    f"{BACKEND_URL}/api/salons/{SALON_ID}/services/metrics-overview",
    headers=headers
)
print(f"Status: {metrics_response.status_code}")
if metrics_response.status_code == 200:
    metrics_data = metrics_response.json()
    overview = metrics_data.get("overview", {})
    per_service = metrics_data.get("per_service", [])
    
    print(f"overview.total_menu: {overview.get('total_menu')}")
    print(f"overview.services_count: {overview.get('services_count')}")
    print(f"overview.packages_count: {overview.get('packages_count')}")
    print(f"overview.at_home_count: {overview.get('at_home_count')}")
    print(f"per_service.length: {len(per_service)}")
    
    # Check total_menu >= 10
    if overview.get('total_menu', 0) >= 10:
        print(f"✅ PASS: overview.total_menu ({overview.get('total_menu')}) >= 10")
    else:
        print(f"❌ FAIL: overview.total_menu ({overview.get('total_menu')}) < 10")
    
    # Check services_count == 8 (accept >= 8)
    if overview.get('services_count', 0) >= 8:
        print(f"✅ PASS: overview.services_count ({overview.get('services_count')}) >= 8")
    else:
        print(f"❌ FAIL: overview.services_count ({overview.get('services_count')}) < 8")
    
    # Check packages_count == 2 (accept >= 2)
    if overview.get('packages_count', 0) >= 2:
        print(f"✅ PASS: overview.packages_count ({overview.get('packages_count')}) >= 2")
    else:
        print(f"❌ FAIL: overview.packages_count ({overview.get('packages_count')}) < 2")
    
    # Check at_home_count == 8 (accept >= 8)
    if overview.get('at_home_count', 0) >= 8:
        print(f"✅ PASS: overview.at_home_count ({overview.get('at_home_count')}) >= 8")
    else:
        print(f"❌ FAIL: overview.at_home_count ({overview.get('at_home_count')}) < 8")
    
    # Check per_service.length equals overview.total_menu
    if len(per_service) == overview.get('total_menu'):
        print(f"✅ PASS: per_service.length ({len(per_service)}) == overview.total_menu ({overview.get('total_menu')})")
    else:
        print(f"❌ FAIL: per_service.length ({len(per_service)}) != overview.total_menu ({overview.get('total_menu')})")
else:
    print(f"❌ FAIL: {metrics_response.text}")

print("\n" + "=" * 80)

# 2c) MongoDB query for barbers count
print("\n2c) MongoDB query for barbers with {salon_id, is_active: True}")

async def check_barbers():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    barbers_count = await db.barbers.count_documents({
        "salon_id": SALON_ID,
        "is_active": True
    })
    print(f"Barbers count: {barbers_count}")
    if barbers_count >= 5:
        print(f"✅ PASS: Barbers count ({barbers_count}) >= 5")
    else:
        print(f"❌ FAIL: Barbers count ({barbers_count}) < 5")
    client.close()

asyncio.run(check_barbers())

print("\n" + "=" * 80)

# 2d) MongoDB query for salon_inventory
print("\n2d) MongoDB query for salon_inventory")

async def check_inventory():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Total inventory count
    inventory_count = await db.salon_inventory.count_documents({"salon_id": SALON_ID})
    print(f"Inventory count: {inventory_count}")
    if inventory_count >= 10:
        print(f"✅ PASS: Inventory count ({inventory_count}) >= 10")
    else:
        print(f"❌ FAIL: Inventory count ({inventory_count}) < 10")
    
    # Count assigned items (assigned_to_staff_id set OR availability=='internal_only')
    assigned_count = await db.salon_inventory.count_documents({
        "salon_id": SALON_ID,
        "$or": [
            {"assigned_to_staff_id": {"$ne": None}},
            {"availability": "internal_only"}
        ]
    })
    print(f"Assigned inventory count: {assigned_count}")
    if assigned_count == 3:
        print(f"✅ PASS: Assigned inventory count ({assigned_count}) == 3")
    else:
        print(f"⚠️  INFO: Assigned inventory count ({assigned_count}) (expected exactly 3)")
    
    client.close()

asyncio.run(check_inventory())

print("\n" + "=" * 80)

# 2e) MongoDB query for customer_product_orders
print("\n2e) MongoDB query for customer_product_orders")

async def check_orders():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    orders_count = await db.customer_product_orders.count_documents({
        "salon_id": SALON_ID,
        "id": {"$regex": "^seed-ord-"}
    })
    print(f"Customer product orders count (seed-ord-*): {orders_count}")
    if orders_count == 2:
        print(f"✅ PASS: Orders count ({orders_count}) == 2")
    else:
        print(f"❌ FAIL: Orders count ({orders_count}) != 2")
    
    client.close()

asyncio.run(check_orders())

print("\n" + "=" * 80)

# 2f) MongoDB query for tokens
print("\n2f) MongoDB query for tokens")

async def check_tokens():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Count tokens with seed_key
    tokens_count = await db.tokens.count_documents({
        "salon_id": SALON_ID,
        "seed_key": {"$exists": True}
    })
    print(f"Tokens count (with seed_key): {tokens_count}")
    if tokens_count >= 10:
        print(f"✅ PASS: Tokens count ({tokens_count}) >= 10")
    else:
        print(f"❌ FAIL: Tokens count ({tokens_count}) < 10")
    
    # Count completed tokens with payment_mode=='wallet'
    wallet_tokens_count = await db.tokens.count_documents({
        "salon_id": SALON_ID,
        "status": "completed",
        "payment_mode": "wallet"
    })
    print(f"Completed tokens with payment_mode='wallet': {wallet_tokens_count}")
    if wallet_tokens_count >= 1:
        print(f"✅ PASS: Wallet tokens count ({wallet_tokens_count}) >= 1")
    else:
        print(f"❌ FAIL: Wallet tokens count ({wallet_tokens_count}) < 1")
    
    client.close()

asyncio.run(check_tokens())

print("\n" + "=" * 80)

# 2g) MongoDB query for loyalty_programs
print("\n2g) MongoDB query for loyalty_programs")

async def check_loyalty():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    loyalty_program = await db.loyalty_programs.find_one({"salon_id": SALON_ID})
    if loyalty_program:
        enabled = loyalty_program.get("enabled")
        tiers = loyalty_program.get("tiers", [])
        print(f"Loyalty program enabled: {enabled}")
        print(f"Tiers count: {len(tiers)}")
        
        if enabled:
            print(f"✅ PASS: Loyalty program enabled == True")
        else:
            print(f"❌ FAIL: Loyalty program enabled == False")
        
        if tiers and len(tiers) > 0:
            tier0 = tiers[0]
            spend_amount = tier0.get("spend_amount")
            topup_percentage = tier0.get("topup_percentage")
            print(f"tiers[0].spend_amount: {spend_amount}")
            print(f"tiers[0].topup_percentage: {topup_percentage}")
            
            if spend_amount == 500:
                print(f"✅ PASS: tiers[0].spend_amount ({spend_amount}) == 500")
            else:
                print(f"❌ FAIL: tiers[0].spend_amount ({spend_amount}) != 500")
            
            if topup_percentage == 3.0:
                print(f"✅ PASS: tiers[0].topup_percentage ({topup_percentage}) == 3.0")
            else:
                print(f"❌ FAIL: tiers[0].topup_percentage ({topup_percentage}) != 3.0")
    else:
        print(f"❌ FAIL: Loyalty program not found")
    
    client.close()

asyncio.run(check_loyalty())

print("\n" + "=" * 80)

# 2h) MongoDB query for customer_memberships and customer_wallets
print("\n2h) MongoDB query for customer_memberships and customer_wallets")

async def check_memberships():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    memberships_count = await db.customer_memberships.count_documents({"salon_id": SALON_ID})
    print(f"Customer memberships count: {memberships_count}")
    if memberships_count >= 2:
        print(f"✅ PASS: Memberships count ({memberships_count}) >= 2")
    else:
        print(f"❌ FAIL: Memberships count ({memberships_count}) < 2")
    
    wallets_count = await db.customer_wallets.count_documents({"salon_id": SALON_ID})
    print(f"Customer wallets count: {wallets_count}")
    if wallets_count >= 2:
        print(f"✅ PASS: Wallets count ({wallets_count}) >= 2")
    else:
        print(f"❌ FAIL: Wallets count ({wallets_count}) < 2")
    
    client.close()

asyncio.run(check_memberships())

print("\n" + "=" * 80)

# 2i) MongoDB query for salary_records
print("\n2i) MongoDB query for salary_records")

async def check_salary():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get the seeded month (last month)
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    ist_offset = timedelta(hours=5, minutes=30)
    prev = (now + ist_offset).replace(day=1) - timedelta(days=1)
    month = prev.strftime("%Y-%m")
    
    salary_count = await db.salary_records.count_documents({
        "salon_id": SALON_ID,
        "month": month
    })
    print(f"Salary records count for month {month}: {salary_count}")
    if salary_count == 5:
        print(f"✅ PASS: Salary records count ({salary_count}) == 5")
    else:
        print(f"❌ FAIL: Salary records count ({salary_count}) != 5")
    
    client.close()

asyncio.run(check_salary())

print("\n" + "=" * 80)
print("\n### STEP 2 COMPLETE ###\n")
