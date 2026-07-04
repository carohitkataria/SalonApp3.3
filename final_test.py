#!/usr/bin/env python3
"""
Final comprehensive test for the review request
"""

import requests
import json
import re

BASE_URL = "https://task-completion-sync.preview.emergentagent.com/api"
SALON_ID = "a356c4e6-274f-40e7-9a37-66d3a4613d17"
ADMIN_PHONE = "+917503070727"
ADMIN_PASSWORD = "salon123"
TEST_CUSTOMER_PHONE = "7503070727"

def test_customer_buy_membership():
    print("🧪 Testing Customer Buy Membership Flow")
    print("=" * 50)
    
    # Login first
    login_response = requests.post(
        f"{BASE_URL}/salon/password-login",
        json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD}
    )
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.text}")
        return False
    
    token = login_response.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    print(f"✅ Salon admin login successful")
    
    # Create plan
    plan_response = requests.post(
        f"{BASE_URL}/salons/{SALON_ID}/membership-plans",
        json={
            "salon_id": SALON_ID,
            "name": "Gold E2E",
            "amount": 500,
            "credit": 600,
            "validity_months": 12,
            "terms_conditions": "Test T&C"
        },
        headers=headers
    )
    
    if plan_response.status_code != 200:
        print(f"❌ Plan creation failed: {plan_response.text}")
        return False
    
    plan_data = plan_response.json()
    plan_id = plan_data.get("id")
    print(f"✅ Membership plan created: {plan_id}")
    
    # Buy membership (no auth)
    membership_response = requests.post(
        f"{BASE_URL}/salons/{SALON_ID}/customers/{TEST_CUSTOMER_PHONE}/buy-membership",
        json={
            "customer_name": "Test",
            "customer_phone": TEST_CUSTOMER_PHONE,
            "membership_plan_id": plan_id,
            "payment_mode": "cash",
            "paid_amount": 500
        }
    )
    
    print(f"Buy membership status: {membership_response.status_code}")
    
    if membership_response.status_code == 200:
        data = membership_response.json()
        
        # Check for ObjectId serialization issues - more precise check
        response_str = json.dumps(data)
        
        # Look for actual _id fields (not substrings)
        has_object_id_field = '"_id"' in response_str
        has_proper_id = "id" in data.get("membership", {})
        has_pending = "Pending" in data.get("message", "")
        membership_obj = data.get("membership", {})
        membership_has_id = "id" in membership_obj
        membership_has_object_id = "_id" in membership_obj
        
        success = (
            not has_object_id_field and 
            has_proper_id and 
            has_pending and 
            membership_has_id and 
            not membership_has_object_id
        )
        
        if success:
            print("✅ Customer buy membership - WORKING")
            print(f"   - No ObjectId serialization issues")
            print(f"   - Message contains 'Pending': {has_pending}")
            print(f"   - Membership object has 'id' field: {membership_has_id}")
            print(f"   - No '_id' field in membership object: {not membership_has_object_id}")
        else:
            print("❌ Customer buy membership - FAILED")
            issues = []
            if has_object_id_field:
                issues.append("Found '_id' field in response")
            if not has_proper_id:
                issues.append("Missing 'id' field")
            if not has_pending:
                issues.append("Message doesn't contain 'Pending'")
            if not membership_has_id:
                issues.append("Membership object missing 'id' field")
            if membership_has_object_id:
                issues.append("Membership object has '_id' field")
            print(f"   Issues: {', '.join(issues)}")
        
        # Test pending memberships endpoint
        print("\n🧪 Testing Pending Memberships Endpoint")
        pending_response = requests.get(
            f"{BASE_URL}/salons/{SALON_ID}/pending-memberships",
            headers=headers
        )
        
        if pending_response.status_code == 200:
            pending_data = pending_response.json()
            memberships = pending_data if isinstance(pending_data, list) else pending_data.get("memberships", [])
            
            # Look for our membership
            found_pending = False
            for membership in memberships:
                if (membership.get("customer_phone") == f"+91{TEST_CUSTOMER_PHONE}" and 
                    membership.get("payment_confirmed") == False):
                    found_pending = True
                    break
            
            if found_pending:
                print("✅ Pending memberships endpoint - WORKING")
                print(f"   - Found {len(memberships)} pending memberships")
                print(f"   - Target membership found with payment_confirmed=false")
            else:
                print("❌ Pending memberships endpoint - FAILED")
                print(f"   - Found {len(memberships)} pending memberships but target not found")
        elif pending_response.status_code == 404:
            print("❌ Pending memberships endpoint - NOT FOUND")
            print("   - Endpoint /api/salons/{salon_id}/pending-memberships does not exist")
        else:
            print(f"❌ Pending memberships endpoint - ERROR {pending_response.status_code}")
            print(f"   - {pending_response.text}")
        
        return success
    else:
        print(f"❌ Buy membership failed: {membership_response.text}")
        return False

def test_user_profile_endpoints():
    print("\n🧪 Testing User Profile Endpoints")
    print("=" * 50)
    
    # Test GET
    get_response = requests.get(f"{BASE_URL}/users/by-phone/{TEST_CUSTOMER_PHONE}")
    
    if get_response.status_code == 200:
        user_data = get_response.json()
        
        # Check for required extended fields
        required_fields = ["name", "phone", "gender"]
        extended_fields = ["dob", "email", "address", "city", "pincode"]
        
        has_required = all(field in user_data for field in required_fields)
        has_extended = all(field in user_data for field in extended_fields)
        
        if has_required and has_extended:
            print("✅ GET /api/users/by-phone/{phone} - WORKING")
            print(f"   - All required fields present: {required_fields}")
            print(f"   - All extended fields present: {extended_fields}")
        else:
            print("❌ GET /api/users/by-phone/{phone} - FAILED")
            missing = [f for f in required_fields + extended_fields if f not in user_data]
            print(f"   - Missing fields: {missing}")
            return False
    else:
        print(f"❌ GET /api/users/by-phone/{phone} - FAILED: {get_response.status_code}")
        return False
    
    # Test PUT
    update_data = {
        "name": "Rohit Updated",
        "gender": "Male",
        "dob": "1990-01-15",
        "email": "r@test.com",
        "address": "Line 1",
        "city": "Mumbai",
        "pincode": "400001"
    }
    
    put_response = requests.put(
        f"{BASE_URL}/users/by-phone/{TEST_CUSTOMER_PHONE}",
        json=update_data
    )
    
    if put_response.status_code == 200:
        updated_data = put_response.json()
        
        # Verify updated values
        success = all(updated_data.get(key) == value for key, value in update_data.items())
        
        if success:
            print("✅ PUT /api/users/by-phone/{phone} - WORKING")
            print(f"   - All values updated correctly")
        else:
            print("❌ PUT /api/users/by-phone/{phone} - FAILED")
            print(f"   - Some values not updated correctly")
            return False
    else:
        print(f"❌ PUT /api/users/by-phone/{phone} - FAILED: {put_response.status_code}")
        return False
    
    # Test persistence
    verify_response = requests.get(f"{BASE_URL}/users/by-phone/{TEST_CUSTOMER_PHONE}")
    
    if verify_response.status_code == 200:
        verified_data = verify_response.json()
        
        # Check if updates persisted
        success = all(verified_data.get(key) == value for key, value in update_data.items())
        
        if success:
            print("✅ User profile persistence - WORKING")
            print(f"   - All updated values persisted correctly")
        else:
            print("❌ User profile persistence - FAILED")
            print(f"   - Some values not persisted")
            return False
    else:
        print(f"❌ User profile persistence check - FAILED: {verify_response.status_code}")
        return False
    
    # Test 404 for non-existent user
    not_found_response = requests.put(
        f"{BASE_URL}/users/by-phone/9999900000",
        json={"name": "Should Not Work"}
    )
    
    if not_found_response.status_code == 404:
        print("✅ PUT non-existent user - WORKING")
        print(f"   - Correctly returns 404 for non-existent phone")
    else:
        print(f"❌ PUT non-existent user - FAILED: Expected 404, got {not_found_response.status_code}")
        return False
    
    return True

def main():
    print("🧪 BACKEND API TESTING - REVIEW REQUEST")
    print("Testing ObjectId fixes and User Profile endpoints")
    print("=" * 60)
    
    membership_success = test_customer_buy_membership()
    profile_success = test_user_profile_endpoints()
    
    print("\n" + "=" * 60)
    print("📊 FINAL RESULTS")
    print("=" * 60)
    
    print(f"1. Customer Buy Membership: {'✅ PASS' if membership_success else '❌ FAIL'}")
    print(f"2. User Profile Endpoints: {'✅ PASS' if profile_success else '❌ FAIL'}")
    
    if membership_success and profile_success:
        print("\n🎉 ALL TESTS PASSED!")
    else:
        print("\n⚠️  Some tests failed - see details above")

if __name__ == "__main__":
    main()