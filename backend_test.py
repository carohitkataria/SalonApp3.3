#!/usr/bin/env python3
"""
Backend API Testing Script for Salon Management System
Tests the continuation tasks: OTP verification, loyalty rewards, and staff access control
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BASE_URL = "https://loyalty-wallet-fix.preview.emergentagent.com/api"
SALON_ID = "91a8e87d-d687-49ea-b3e5-460cc55cf3de"  # Updated to working salon ID
ADMIN_PHONE = "+917503070727"
ADMIN_PASSWORD = "salon123"
TEST_CUSTOMER_PHONE = "9876543210"
EXISTING_CUSTOMER_PHONE = "7503070727"

class BackendTester:
    def __init__(self):
        self.admin_token = None
        self.staff_token = None
        self.staff_user_id = None
        
    def log(self, message):
        """Log test messages with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {message}")
        
    def make_request(self, method, endpoint, data=None, headers=None, params=None):
        """Make HTTP request with error handling"""
        url = f"{BASE_URL}{endpoint}"
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=headers, params=params, timeout=30)
            elif method.upper() == "PUT":
                response = requests.put(url, json=data, headers=headers, params=params, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=headers, params=params, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            self.log(f"{method} {endpoint} -> {response.status_code}")
            
            # Try to parse JSON response
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text}
                
            return {
                "status_code": response.status_code,
                "data": response_data,
                "success": 200 <= response.status_code < 300
            }
        except Exception as e:
            self.log(f"ERROR: {method} {endpoint} failed: {str(e)}")
            return {
                "status_code": 0,
                "data": {"error": str(e)},
                "success": False
            }
    
    def authenticate_admin(self):
        """Authenticate as admin user"""
        self.log("=== ADMIN AUTHENTICATION ===")
        
        # Try to get fresh OTP and authenticate
        self.log("Getting fresh OTP for authentication...")
        otp_response = self.make_request("POST", "/salon/send-otp", {
            "phone": ADMIN_PHONE
        })
        
        if otp_response["success"]:
            self.log(f"OTP sent successfully: {otp_response['data']}")
            
            # Get OTP from logs
            import subprocess
            import time
            time.sleep(2)  # Wait for log to be written
            
            try:
                result = subprocess.run(['tail', '-n', '50', '/var/log/supervisor/backend.err.log'], 
                                      capture_output=True, text=True)
                lines = result.stdout.split('\n')
                otp = None
                for line in reversed(lines):
                    if f"Generated OTP for {ADMIN_PHONE}:" in line:
                        otp = line.split(': ')[-1].strip()
                        break
                
                if otp:
                    self.log(f"Found OTP in logs: {otp}")
                    
                    # Verify OTP
                    verify_response = self.make_request("POST", "/salon/verify-otp", {
                        "phone": ADMIN_PHONE,
                        "otp": otp
                    })
                    
                    if verify_response["success"] and "access_token" in verify_response["data"]:
                        self.admin_token = verify_response["data"]["access_token"]
                        actual_salon_id = verify_response["data"].get("salon_id")
                        self.log(f"✅ Admin authenticated successfully (OTP login)")
                        self.log(f"   Token: {self.admin_token[:20]}...")
                        self.log(f"   Salon ID: {actual_salon_id}")
                        
                        # Update salon ID if different
                        global SALON_ID
                        if actual_salon_id and actual_salon_id != SALON_ID:
                            self.log(f"   Updating SALON_ID from {SALON_ID} to {actual_salon_id}")
                            SALON_ID = actual_salon_id
                        
                        return True
                    else:
                        self.log(f"❌ OTP verification failed: {verify_response['data']}")
                else:
                    self.log("❌ Could not find OTP in logs")
            except Exception as e:
                self.log(f"❌ Error getting OTP from logs: {e}")
        else:
            self.log(f"❌ Failed to send OTP: {otp_response['data']}")
        
        # Fallback attempts
        self.log("Trying salon password login...")
        response = self.make_request("POST", "/salon/password-login", {
            "phone": ADMIN_PHONE,
            "password": ADMIN_PASSWORD
        })
        
        if response["success"] and "access_token" in response["data"]:
            self.admin_token = response["data"]["access_token"]
            self.log(f"✅ Admin authenticated successfully (salon password login)")
            self.log(f"   Token: {self.admin_token[:20]}...")
            self.log(f"   Salon ID: {response['data'].get('salon_id')}")
            return True
        else:
            self.log(f"❌ Salon password login failed: {response['data']}")
            
            # Try salon user login as fallback
            self.log("Trying salon user login...")
            response = self.make_request("POST", "/salon/users/login", {
                "identifier": ADMIN_PHONE,
                "password": ADMIN_PASSWORD
            })
            
            if response["success"] and "access_token" in response["data"]:
                self.admin_token = response["data"]["access_token"]
                self.log(f"✅ Admin authenticated successfully (salon user login)")
                self.log(f"   Token: {self.admin_token[:20]}...")
                self.log(f"   Salon ID: {response['data'].get('salon_id')}")
                return True
            else:
                self.log(f"❌ Salon user login also failed: {response['data']}")
                self.log("⚠️  Continuing without authentication to test public endpoints")
                return False
    
    def test_customer_otp_flow(self):
        """Test Customer OTP Verification Flow"""
        self.log("\n=== CUSTOMER OTP VERIFICATION FLOW ===")
        
        # First, login the customer to create/get user record
        self.log("0. Customer login to create user record")
        login_response = self.make_request("POST", "/user/login", {
            "name": "Test Customer",
            "phone": TEST_CUSTOMER_PHONE,
            "gender": "Male"
        })
        
        if login_response["success"]:
            self.log(f"✅ Customer login successful")
            self.log(f"   User ID: {login_response['data'].get('id')}")
        else:
            self.log(f"❌ Customer login failed: {login_response['data']}")
        
        # Test 1: Send OTP
        self.log("1. Testing POST /customer/send-otp")
        response = self.make_request("POST", "/customer/send-otp", {
            "phone": TEST_CUSTOMER_PHONE
        })
        
        send_otp_success = False
        actual_otp = None
        if response["success"]:
            self.log(f"✅ OTP send request successful")
            self.log(f"   Response: {response['data']}")
            send_otp_success = True
            # Extract OTP if provided in response (for testing when WhatsApp fails)
            actual_otp = response['data'].get('otp')
        else:
            self.log(f"❌ OTP send failed: {response['data']}")
            
        # Test 2: Check OTP status
        self.log("2. Testing GET /customer/{phone}/otp-status")
        response = self.make_request("GET", f"/customer/{TEST_CUSTOMER_PHONE}/otp-status")
        
        otp_status_success = False
        if response["success"]:
            self.log(f"✅ OTP status check successful")
            self.log(f"   Response: {response['data']}")
            otp_status = response['data']
            otp_status_success = True
        else:
            self.log(f"❌ OTP status check failed: {response['data']}")
            otp_status = {}
            
        # Test 3: Verify OTP (try with actual OTP if available, otherwise test OTP)
        self.log("3. Testing POST /customer/verify-otp")
        test_otp = actual_otp if actual_otp else "123456"
        self.log(f"   Using OTP: {test_otp}")
        
        response = self.make_request("POST", "/customer/verify-otp", {
            "phone": TEST_CUSTOMER_PHONE,
            "otp": test_otp
        })
        
        verify_endpoint_exists = response["status_code"] != 404
        verify_success = False
        if response["success"]:
            self.log(f"✅ OTP verification successful")
            self.log(f"   Response: {response['data']}")
            verify_success = True
        else:
            self.log(f"❌ OTP verification failed: {response['data']}")
            
        # Test 4: Check OTP status after verification (if verification was successful)
        if verify_success:
            self.log("4. Testing OTP status after verification")
            response = self.make_request("GET", f"/customer/{TEST_CUSTOMER_PHONE}/otp-status")
            if response["success"]:
                self.log(f"✅ Post-verification status check successful")
                self.log(f"   Response: {response['data']}")
            else:
                self.log(f"❌ Post-verification status check failed: {response['data']}")
            
        return {
            "send_otp": send_otp_success,
            "check_status": otp_status_success,
            "verify_endpoint_exists": verify_endpoint_exists,
            "verify_success": verify_success
        }
    
    def test_loyalty_reward_logic(self):
        """Test Loyalty Reward Logic"""
        self.log("\n=== LOYALTY REWARD LOGIC ===")
        
        # Test combined wallet balance endpoint
        self.log("Testing GET /salons/{salon_id}/customers/{phone}/wallet")
        response = self.make_request("GET", f"/salons/{SALON_ID}/customers/{EXISTING_CUSTOMER_PHONE}/wallet")
        
        if response["success"]:
            self.log(f"✅ Wallet balance endpoint working")
            wallet_data = response['data']
            self.log(f"   Has membership: {wallet_data.get('has_membership')}")
            self.log(f"   Has loyalty wallet: {wallet_data.get('has_loyalty_wallet')}")
            self.log(f"   Total wallet balance: {wallet_data.get('wallet_balance')}")
            self.log(f"   Membership balance: {wallet_data.get('membership_balance')}")
            self.log(f"   Loyalty balance: {wallet_data.get('loyalty_balance')}")
            
            # Verify required fields are present
            required_fields = ['has_membership', 'has_loyalty_wallet', 'wallet_balance', 'membership_balance', 'loyalty_balance']
            missing_fields = [field for field in required_fields if field not in wallet_data]
            
            if missing_fields:
                self.log(f"⚠️  Missing required fields: {missing_fields}")
                return False
            else:
                self.log(f"✅ All required fields present in response")
                return True
        else:
            self.log(f"❌ Wallet balance endpoint failed: {response['data']}")
            return False
    
    def test_staff_access_control(self):
        """Test Staff Access Control (can_access_financials)"""
        self.log("\n=== STAFF ACCESS CONTROL ===")
        
        if not self.admin_token:
            self.log("❌ Admin token required for staff management")
            return False
            
        headers = {"Authorization": f"Bearer {self.admin_token}"}
        
        # Test 1: Create staff user with can_access_financials: true
        self.log("1. Creating staff user with can_access_financials: true")
        staff_data = {
            "salon_id": SALON_ID,
            "name": "Test Staff Financial",
            "mobile": "+919876543210",
            "login_id": "teststaff_financial",
            "password": "staff123",
            "role": "staff",
            "permissions": {
                "can_edit_salon": False,
                "can_access_analytics": False,
                "can_access_financials": True,
                "can_delete_salon": False
            }
        }
        
        response = self.make_request("POST", "/salon/users", staff_data, headers)
        
        if response["success"]:
            self.log(f"✅ Staff user created successfully")
            staff_user = response['data']
            self.staff_user_id = staff_user.get('id')
            self.log(f"   Staff ID: {self.staff_user_id}")
            self.log(f"   Permissions: {staff_user.get('permissions')}")
        else:
            self.log(f"❌ Staff user creation failed: {response['data']}")
            return False
            
        # Test 2: Login as staff user
        self.log("2. Testing staff login")
        response = self.make_request("POST", "/salon/users/login", {
            "identifier": "teststaff_financial",
            "password": "staff123"
        })
        
        if response["success"] and "access_token" in response["data"]:
            self.staff_token = response["data"]["access_token"]
            staff_permissions = response["data"].get("permissions", {})
            self.log(f"✅ Staff login successful")
            self.log(f"   Token: {self.staff_token[:20]}...")
            self.log(f"   can_access_financials: {staff_permissions.get('can_access_financials')}")
            
            # Verify permission is present and true
            if staff_permissions.get('can_access_financials') is True:
                self.log(f"✅ can_access_financials permission correctly set to True")
                staff_login_success = True
            else:
                self.log(f"❌ can_access_financials permission not set correctly")
                staff_login_success = False
        else:
            self.log(f"❌ Staff login failed: {response['data']}")
            staff_login_success = False
            
        # Test 3: Create staff user WITHOUT can_access_financials
        self.log("3. Creating staff user WITHOUT can_access_financials")
        staff_data_no_financial = {
            "salon_id": SALON_ID,
            "name": "Test Staff No Financial",
            "mobile": "+919876543211",
            "login_id": "teststaff_no_financial",
            "password": "staff123",
            "role": "staff",
            "permissions": {
                "can_edit_salon": False,
                "can_access_analytics": True,
                "can_access_financials": False,
                "can_delete_salon": False
            }
        }
        
        response = self.make_request("POST", "/salon/users", staff_data_no_financial, headers)
        
        if response["success"]:
            self.log(f"✅ Staff user (no financial access) created successfully")
            
            # Login as this staff user
            response = self.make_request("POST", "/salon/users/login", {
                "identifier": "teststaff_no_financial",
                "password": "staff123"
            })
            
            if response["success"]:
                no_financial_permissions = response["data"].get("permissions", {})
                self.log(f"✅ Staff (no financial) login successful")
                self.log(f"   can_access_financials: {no_financial_permissions.get('can_access_financials')}")
                
                if no_financial_permissions.get('can_access_financials') is False:
                    self.log(f"✅ can_access_financials correctly set to False")
                    no_financial_test_success = True
                else:
                    self.log(f"❌ can_access_financials should be False")
                    no_financial_test_success = False
            else:
                self.log(f"❌ Staff (no financial) login failed: {response['data']}")
                no_financial_test_success = False
        else:
            self.log(f"❌ Staff user (no financial) creation failed: {response['data']}")
            no_financial_test_success = False
            
        return {
            "staff_creation": response["success"] if 'response' in locals() else False,
            "staff_login_with_financials": staff_login_success,
            "staff_without_financials": no_financial_test_success
        }
    
    def run_all_tests(self):
        """Run all backend tests"""
        self.log("🚀 Starting Backend API Tests")
        self.log(f"Base URL: {BASE_URL}")
        self.log(f"Salon ID: {SALON_ID}")
        
        results = {}
        
        # Try to authenticate admin (but continue even if it fails)
        auth_success = self.authenticate_admin()
            
        # Test 1: Customer OTP Verification Flow (doesn't require auth)
        results["otp_flow"] = self.test_customer_otp_flow()
        
        # Test 2: Loyalty Reward Logic (doesn't require auth)
        results["loyalty_rewards"] = self.test_loyalty_reward_logic()
        
        # Test 3: Staff Access Control (requires auth)
        if auth_success:
            results["staff_access_control"] = self.test_staff_access_control()
        else:
            self.log("\n=== STAFF ACCESS CONTROL ===")
            self.log("❌ Skipping staff access control tests - admin authentication required")
            results["staff_access_control"] = {"skipped": True, "reason": "No admin authentication"}
        
        # Summary
        self.log("\n" + "="*50)
        self.log("📊 TEST SUMMARY")
        self.log("="*50)
        
        # OTP Flow Summary
        otp_results = results.get("otp_flow", {})
        self.log(f"🔐 Customer OTP Flow:")
        self.log(f"   Send OTP endpoint: {'✅' if otp_results.get('send_otp') else '❌'}")
        self.log(f"   OTP status endpoint: {'✅' if otp_results.get('check_status') else '❌'}")
        self.log(f"   Verify OTP endpoint: {'✅' if otp_results.get('verify_endpoint_exists') else '❌'}")
        self.log(f"   OTP verification: {'✅' if otp_results.get('verify_success') else '❌'}")
        
        # Loyalty Rewards Summary
        loyalty_success = results.get("loyalty_rewards", False)
        self.log(f"💰 Loyalty Rewards: {'✅' if loyalty_success else '❌'}")
        
        # Staff Access Control Summary
        staff_results = results.get("staff_access_control", {})
        if staff_results.get("skipped"):
            self.log(f"👥 Staff Access Control: ⚠️  SKIPPED ({staff_results.get('reason')})")
        else:
            self.log(f"👥 Staff Access Control:")
            self.log(f"   Staff creation: {'✅' if staff_results.get('staff_creation') else '❌'}")
            self.log(f"   Login with financials: {'✅' if staff_results.get('staff_login_with_financials') else '❌'}")
            self.log(f"   Login without financials: {'✅' if staff_results.get('staff_without_financials') else '❌'}")
        
        return results

if __name__ == "__main__":
    tester = BackendTester()
    results = tester.run_all_tests()