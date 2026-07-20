#!/usr/bin/env python3
import requests
from datetime import datetime

BASE_URL = "https://payroll-tracker-273.preview.emergentagent.com/api"

# Login
response = requests.post(f"{BASE_URL}/salon/users/login", json={"identifier": "admin", "password": "salon123"})
data = response.json()
access_token = data["access_token"]
salon_id = data["salon_id"]
headers = {"Authorization": f"Bearer {access_token}"}

print(f"Salon ID: {salon_id}")
print(f"Today: {datetime.now().strftime('%Y-%m-%d')}")

# Get all barbers
response = requests.get(f"{BASE_URL}/salons/{salon_id}/barbers")
all_barbers = response.json()

print(f"\nAll barbers ({len(all_barbers)}):")
for b in all_barbers:
    print(f"  - {b['name']} (ID: {b['id']})")
    print(f"    is_barber: {b.get('is_barber')}")
    print(f"    leave_dates: {b.get('leave_dates', [])}")
    print(f"    last_working_date: {b.get('last_working_date')}")
    print(f"    doj: {b.get('doj')}")

# Get with customer_view
response = requests.get(f"{BASE_URL}/salons/{salon_id}/barbers?available_only=true&customer_view=true")
customer_barbers = response.json()

print(f"\nCustomer view barbers ({len(customer_barbers)}):")
for b in customer_barbers:
    print(f"  - {b['name']} (ID: {b['id']})")
    print(f"    is_barber: {b.get('is_barber')}")
    print(f"    leave_dates: {b.get('leave_dates', [])}")
