#!/usr/bin/env python3
import requests
from datetime import datetime, timedelta, timezone

BASE_URL = "https://task-completion-sync.preview.emergentagent.com/api"

# Get IST today
ist = timezone(timedelta(hours=5, minutes=30))
today_ist = datetime.now(ist).strftime("%Y-%m-%d")

print(f"Today (IST): {today_ist}")

# Login
response = requests.post(f"{BASE_URL}/salon/users/login", json={"identifier": "admin", "password": "salon123"})
data = response.json()
access_token = data["access_token"]
salon_id = data["salon_id"]
headers = {"Authorization": f"Bearer {access_token}"}

# Get all barbers
response = requests.get(f"{BASE_URL}/salons/{salon_id}/barbers")
all_barbers = response.json()

if len(all_barbers) >= 2:
    barber2_id = all_barbers[1]["id"]
    
    # Update barber 2 to be on leave TODAY (IST)
    print(f"\nSetting barber 2 ({all_barbers[1]['name']}) on leave today: {today_ist}")
    url = f"{BASE_URL}/barbers/{barber2_id}"
    payload = {
        "is_barber": True,
        "last_working_date": "2026-12-31",
        "leave_dates": [today_ist],
        "doj": "2020-01-01"
    }
    response = requests.put(url, json=payload, headers=headers)
    print(f"Update response: {response.status_code}")
    
    # Get with customer_view
    print(f"\nGetting barbers with customer_view=true")
    response = requests.get(f"{BASE_URL}/salons/{salon_id}/barbers?available_only=true&customer_view=true")
    customer_barbers = response.json()
    
    print(f"Customer view returned {len(customer_barbers)} barber(s):")
    for b in customer_barbers:
        print(f"  - {b['name']} (ID: {b['id']})")
    
    barber_ids = [b["id"] for b in customer_barbers]
    
    if barber2_id not in barber_ids:
        print(f"\n✅ PASS: Barber 2 correctly excluded (on leave today)")
    else:
        print(f"\n❌ FAIL: Barber 2 should be excluded but was included")
        print(f"Barber 2 data from response:")
        barber2 = next((b for b in customer_barbers if b["id"] == barber2_id), None)
        if barber2:
            print(f"  leave_dates: {barber2.get('leave_dates')}")
            print(f"  last_working_date: {barber2.get('last_working_date')}")
            print(f"  doj: {barber2.get('doj')}")
