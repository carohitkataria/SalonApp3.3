#!/usr/bin/env python3
"""
Backend API Testing Script for Salon Management System
Testing specific endpoints mentioned in review request:
1. Customer Buy Membership flow (ObjectId fix verification)
2. User Profile Endpoints (GET/PUT /users/by-phone)
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://notify-control-4.preview.emergentagent.com/api"
SALON_ID = "a356c4e6-274f-40e7-9a37-66d3a4613d17"
ADMIN_PHONE = "+917503070727"
ADMIN_PASSWORD = "salon123"
TEST_CUSTOMER_PHONE = "7503070727"

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.test_results = []
        
    def log_result(self, test_name: str, success: bool, details: str):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "status": status,
            "details": details
        })
        print(f"{status}: {test_name}")
        print(f"   {details}")
        print()
        
    def login_salon_admin(self) -> bool:
        """Login as salon admin and get access token"""
        try:
            response = self.session.post(
                f"{BASE_URL}/salon/password-login",
                json={
                    "phone": ADMIN_PHONE,
                    "password": ADMIN_PASSWORD
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data.get("access_token")
                if self.admin_token:
                    self.session.headers.update({
                        "Authorization": f"Bearer {self.admin_token}"
                    })
                    self.log_result(
                        "Salon Admin Login",
                        True,
                        f"Successfully logged in. Token: {self.admin_token[:20]}..."
                    )
                    return True
                else:
                    self.log_result(
                        "Salon Admin Login",
                        False,
                        f"No access_token in response: {data}"
                    )
                    return False
            else:
                self.log_result(
                    "Salon Admin Login",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Salon Admin Login",
                False,
                f"Exception: {str(e)}"
            )
            return False
    
    def create_membership_plan(self) -> Optional[str]:
        """Create a new membership plan and return plan_id"""
        try:
            plan_data = {
                "salon_id": SALON_ID,
                "name": "Gold E2E",
                "amount": 500,
                "credit": 600,
                "validity_months": 12,
                "terms_conditions": "Test T&C"
            }
            
            response = self.session.post(
                f"{BASE_URL}/salons/{SALON_ID}/membership-plans",
                json=plan_data
            )
            
            if response.status_code == 200:
                data = response.json()
                plan_id = data.get("id")
                if plan_id:
                    self.log_result(
                        "Create Membership Plan",
                        True,
                        f"Plan created successfully. ID: {plan_id}, Name: {data.get('name')}, Amount: {data.get('amount')}"
                    )
                    return plan_id
                else:
                    self.log_result(
                        "Create Membership Plan",
                        False,
                        f"No 'id' field in response: {data}"
                    )
                    return None
            else:
                self.log_result(
                    "Create Membership Plan",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return None
                
        except Exception as e:
            self.log_result(
                "Create Membership Plan",
                False,
                f"Exception: {str(e)}"
            )
            return None
    
    def buy_membership_as_customer(self, plan_id: str) -> bool:
        """Buy membership as customer and verify ObjectId fix"""
        try:
            membership_data = {
                "customer_name": "Test",
                "customer_phone": TEST_CUSTOMER_PHONE,
                "membership_plan_id": plan_id,
                "payment_mode": "cash",
                "paid_amount": 500
            }
            
            # Remove admin auth for customer endpoint
            headers = self.session.headers.copy()
            if "Authorization" in headers:
                del headers["Authorization"]
            
            response = requests.post(
                f"{BASE_URL}/salons/{SALON_ID}/customers/{TEST_CUSTOMER_PHONE}/buy-membership",
                json=membership_data,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for ObjectId serialization issues
                has_object_id = "_id" in str(data)
                has_proper_id = "id" in str(data)
                
                # Check for "Pending" in message
                message = data.get("message", "")
                has_pending = "Pending" in message
                
                # Check membership object structure
                membership_obj = data.get("membership", {})
                membership_has_id = "id" in membership_obj
                membership_has_object_id = "_id" in membership_obj
                
                success = (
                    not has_object_id and 
                    has_proper_id and 
                    has_pending and 
                    membership_has_id and 
                    not membership_has_object_id
                )
                
                details = f"Response: {json.dumps(data, indent=2)[:500]}..."
                if not success:
                    issues = []
                    if has_object_id:
                        issues.append("Found '_id' field (ObjectId serialization issue)")
                    if not has_proper_id:
                        issues.append("Missing 'id' field")
                    if not has_pending:
                        issues.append("Message doesn't contain 'Pending'")
                    if not membership_has_id:
                        issues.append("Membership object missing 'id' field")
                    if membership_has_object_id:
                        issues.append("Membership object has '_id' field (ObjectId issue)")
                    details = f"Issues: {', '.join(issues)}. " + details
                
                self.log_result(
                    "Customer Buy Membership",
                    success,
                    details
                )
                return success
            else:
                self.log_result(
                    "Customer Buy Membership",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Customer Buy Membership",
                False,
                f"Exception: {str(e)}"
            )
            return False
    
    def check_pending_memberships(self) -> bool:
        """Check pending memberships with salon auth"""
        try:
            response = self.session.get(
                f"{BASE_URL}/salons/{SALON_ID}/pending-memberships"
            )
            
            if response.status_code == 200:
                data = response.json()
                memberships = data if isinstance(data, list) else data.get("memberships", [])
                
                # Look for the membership we just created
                found_pending = False
                for membership in memberships:
                    if (membership.get("customer_phone") == TEST_CUSTOMER_PHONE and 
                        membership.get("payment_confirmed") == False):
                        found_pending = True
                        break
                
                self.log_result(
                    "Check Pending Memberships",
                    found_pending,
                    f"Found {len(memberships)} pending memberships. Target membership found: {found_pending}"
                )
                return found_pending
            else:
                self.log_result(
                    "Check Pending Memberships",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Check Pending Memberships",
                False,
                f"Exception: {str(e)}"
            )
            return False
    
    def test_user_profile_get(self) -> bool:
        """Test GET /api/users/by-phone/{phone}"""
        try:
            response = requests.get(f"{BASE_URL}/users/by-phone/{TEST_CUSTOMER_PHONE}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check for required extended fields
                required_fields = ["name", "phone", "gender"]
                extended_fields = ["dob", "email", "address", "city", "pincode"]
                
                has_required = all(field in data for field in required_fields)
                has_extended = all(field in data for field in extended_fields)
                
                success = has_required and has_extended
                
                details = f"User data: {json.dumps(data, indent=2)}"
                if not success:
                    missing = [f for f in required_fields + extended_fields if f not in data]
                    details = f"Missing fields: {missing}. " + details
                
                self.log_result(
                    "User Profile GET",
                    success,
                    details[:500] + "..." if len(details) > 500 else details
                )
                return success
            else:
                self.log_result(
                    "User Profile GET",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_result(
                "User Profile GET",
                False,
                f"Exception: {str(e)}"
            )
            return False
    
    def test_user_profile_put(self) -> bool:
        """Test PUT /api/users/by-phone/{phone}"""
        try:
            update_data = {
                "name": "Rohit Updated",
                "gender": "Male",
                "dob": "1990-01-15",
                "email": "r@test.com",
                "address": "Line 1",
                "city": "Mumbai",
                "pincode": "400001"
            }
            
            response = requests.put(
                f"{BASE_URL}/users/by-phone/{TEST_CUSTOMER_PHONE}",
                json=update_data
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify updated values are in response
                success = True
                for key, expected_value in update_data.items():
                    if data.get(key) != expected_value:
                        success = False
                        break
                
                details = f"Updated user data: {json.dumps(data, indent=2)}"
                if not success:
                    details = f"Some values not updated correctly. " + details
                
                self.log_result(
                    "User Profile PUT",
                    success,
                    details[:500] + "..." if len(details) > 500 else details
                )
                return success
            else:
                self.log_result(
                    "User Profile PUT",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_result(
                "User Profile PUT",
                False,
                f"Exception: {str(e)}"
            )
            return False
    
    def test_user_profile_persistence(self) -> bool:
        """Test that PUT changes are persisted by doing another GET"""
        try:
            response = requests.get(f"{BASE_URL}/users/by-phone/{TEST_CUSTOMER_PHONE}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if our updates are still there
                expected_values = {
                    "name": "Rohit Updated",
                    "gender": "Male",
                    "dob": "1990-01-15",
                    "email": "r@test.com",
                    "address": "Line 1",
                    "city": "Mumbai",
                    "pincode": "400001"
                }
                
                success = True
                for key, expected_value in expected_values.items():
                    if data.get(key) != expected_value:
                        success = False
                        break
                
                details = f"Persisted data verification: {json.dumps(data, indent=2)}"
                if not success:
                    details = f"Some values not persisted correctly. " + details
                
                self.log_result(
                    "User Profile Persistence",
                    success,
                    details[:500] + "..." if len(details) > 500 else details
                )
                return success
            else:
                self.log_result(
                    "User Profile Persistence",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_result(
                "User Profile Persistence",
                False,
                f"Exception: {str(e)}"
            )
            return False
    
    def test_user_profile_404(self) -> bool:
        """Test PUT with non-existent phone returns 404"""
        try:
            update_data = {
                "name": "Should Not Work",
                "gender": "Male"
            }
            
            response = requests.put(
                f"{BASE_URL}/users/by-phone/9999900000",
                json=update_data
            )
            
            success = response.status_code == 404
            
            self.log_result(
                "User Profile 404 Test",
                success,
                f"Expected 404, got {response.status_code}: {response.text[:200]}"
            )
            return success
                
        except Exception as e:
            self.log_result(
                "User Profile 404 Test",
                False,
                f"Exception: {str(e)}"
            )
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🧪 Starting Backend API Testing")
        print("=" * 50)
        
        # Test 1: Login as salon admin
        if not self.login_salon_admin():
            print("❌ Cannot proceed without admin authentication")
            return
        
        # Test 2: Create membership plan
        plan_id = self.create_membership_plan()
        if not plan_id:
            print("❌ Cannot proceed without membership plan")
            return
        
        # Test 3: Customer buy membership (ObjectId fix verification)
        self.buy_membership_as_customer(plan_id)
        
        # Test 4: Check pending memberships
        self.check_pending_memberships()
        
        # Test 5-8: User profile endpoints
        self.test_user_profile_get()
        self.test_user_profile_put()
        self.test_user_profile_persistence()
        self.test_user_profile_404()
        
        # Summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(1 for result in self.test_results if "✅" in result["status"])
        total = len(self.test_results)
        
        for result in self.test_results:
            print(f"{result['status']}: {result['test']}")
        
        print(f"\n🎯 OVERALL: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED!")
        else:
            print("⚠️  Some tests failed - see details above")

if __name__ == "__main__":
    tester = APITester()
    tester.run_all_tests()