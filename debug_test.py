#!/usr/bin/env python3
"""
Simple test to debug the ObjectId issue
"""

import requests
import json

BASE_URL = "https://barber-queue-hub.preview.emergentagent.com/api"
SALON_ID = "a356c4e6-274f-40e7-9a37-66d3a4613d17"
ADMIN_PHONE = "+917503070727"
ADMIN_PASSWORD = "salon123"
TEST_CUSTOMER_PHONE = "7503070727"

def test_buy_membership():
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
    
    # Create plan
    plan_response = requests.post(
        f"{BASE_URL}/salons/{SALON_ID}/membership-plans",
        json={
            "salon_id": SALON_ID,
            "name": "Debug Plan",
            "amount": 100,
            "credit": 120,
            "validity_months": 6,
            "terms_conditions": "Debug T&C"
        },
        headers=headers
    )
    
    if plan_response.status_code != 200:
        print(f"Plan creation failed: {plan_response.text}")
        return
    
    plan_id = plan_response.json().get("id")
    print(f"Created plan: {plan_id}")
    
    # Buy membership (no auth)
    membership_response = requests.post(
        f"{BASE_URL}/salons/{SALON_ID}/customers/{TEST_CUSTOMER_PHONE}/buy-membership",
        json={
            "customer_name": "Debug User",
            "customer_phone": TEST_CUSTOMER_PHONE,
            "membership_plan_id": plan_id,
            "payment_mode": "cash",
            "paid_amount": 100
        }
    )
    
    print(f"Buy membership status: {membership_response.status_code}")
    print(f"Response: {json.dumps(membership_response.json(), indent=2)}")
    
    # Check for _id in response
    response_text = membership_response.text
    if "_id" in response_text:
        print("❌ FOUND _id in response - ObjectId serialization issue!")
        # Find where _id appears
        lines = response_text.split('\n')
        for i, line in enumerate(lines):
            if '_id' in line:
                print(f"Line {i}: {line}")
    else:
        print("✅ No _id found in response")

if __name__ == "__main__":
    test_buy_membership()