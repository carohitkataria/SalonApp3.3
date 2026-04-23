#!/usr/bin/env python3
"""
Test to check sold-memberships endpoint for pending memberships
"""

import requests
import json

BASE_URL = "https://gifted-shirley-8.preview.emergentagent.com/api"
SALON_ID = "a356c4e6-274f-40e7-9a37-66d3a4613d17"
ADMIN_PHONE = "+917503070727"
ADMIN_PASSWORD = "salon123"

def test_sold_memberships():
    # Login first
    login_response = requests.post(
        f"{BASE_URL}/salon/password-login",
        json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD}
    )
    
    if login_response.status_code != 200:
        print(f"Login failed: {login_response.text}")
        return
    
    token = login_response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Check sold memberships
    sold_response = requests.get(
        f"{BASE_URL}/salons/{SALON_ID}/sold-memberships",
        headers=headers
    )
    
    print(f"Sold memberships status: {sold_response.status_code}")
    
    if sold_response.status_code == 200:
        data = sold_response.json()
        memberships = data.get("memberships", [])
        
        print(f"Found {len(memberships)} total memberships")
        
        # Check for pending ones
        pending_count = 0
        confirmed_count = 0
        
        for membership in memberships:
            if membership.get("payment_confirmed") == False:
                pending_count += 1
                print(f"Pending: {membership.get('customer_name')} - {membership.get('membership_name')}")
            else:
                confirmed_count += 1
        
        print(f"Pending: {pending_count}, Confirmed: {confirmed_count}")
        
        if pending_count > 0:
            print("✅ Pending memberships found in sold-memberships endpoint")
        else:
            print("❌ No pending memberships found")
    else:
        print(f"Error: {sold_response.text}")

if __name__ == "__main__":
    test_sold_memberships()