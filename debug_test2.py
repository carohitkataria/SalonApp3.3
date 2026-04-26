#!/usr/bin/env python3
"""
More detailed test to debug the ObjectId issue
"""

import requests
import json

BASE_URL = "https://loyalty-wallet-fix.preview.emergentagent.com/api"
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
            "name": "Debug Plan 2",
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
            "customer_name": "Debug User 2",
            "customer_phone": TEST_CUSTOMER_PHONE,
            "membership_plan_id": plan_id,
            "payment_mode": "cash",
            "paid_amount": 100
        }
    )
    
    print(f"Buy membership status: {membership_response.status_code}")
    
    if membership_response.status_code == 200:
        data = membership_response.json()
        
        # Check the actual structure
        print("✅ Response structure analysis:")
        print(f"- Has 'message': {'message' in data}")
        print(f"- Message contains 'Pending': {'Pending' in data.get('message', '')}")
        print(f"- Has 'membership' object: {'membership' in data}")
        
        if 'membership' in data:
            membership_obj = data['membership']
            print(f"- Membership has 'id': {'id' in membership_obj}")
            print(f"- Membership has '_id': {'_id' in membership_obj}")
            
            # Check for any ObjectId-like patterns
            response_str = json.dumps(data)
            if 'ObjectId' in response_str:
                print("❌ Found ObjectId in response!")
            elif '_id' in response_str:
                print("❌ Found _id in response!")
            else:
                print("✅ No ObjectId serialization issues found")
        
        print(f"\nFull response:\n{json.dumps(data, indent=2)}")
    else:
        print(f"❌ Request failed: {membership_response.text}")
    
    # Now test the pending memberships endpoint
    print("\n" + "="*50)
    print("Testing pending memberships endpoint...")
    
    # Try to find the pending memberships endpoint
    pending_response = requests.get(
        f"{BASE_URL}/salons/{SALON_ID}/pending-memberships",
        headers=headers
    )
    
    print(f"Pending memberships status: {pending_response.status_code}")
    if pending_response.status_code == 200:
        print(f"Pending memberships response: {json.dumps(pending_response.json(), indent=2)}")
    else:
        print(f"Pending memberships error: {pending_response.text}")

if __name__ == "__main__":
    test_buy_membership()