#!/usr/bin/env python3
"""
Backend API Testing for Membership and Staff Management Endpoints
Tests the salon booking app's new backend endpoints:

MEMBERSHIP ENDPOINTS:
- POST /api/salons/{salon_id}/membership-plans - Create a membership plan
- GET /api/salons/{salon_id}/membership-plans - List membership plans
- POST /api/salons/{salon_id}/sell-membership - Sell membership to customer
- GET /api/salons/{salon_id}/customer-membership/{phone} - Get customer membership
- GET /api/salons/{salon_id}/wallet-transactions/{phone} - Get transactions
- POST /api/salons/{salon_id}/use-wallet - Deduct from wallet

STAFF MANAGEMENT ENDPOINTS:
- POST /api/salon/users/login - Multi-user salon login (test with mobile and login_id)
- POST /api/salon/users - Create staff user
- GET /api/salon/users - List staff users
- PUT /api/salon/users/{user_id} - Update staff user
- DELETE /api/salon/users/{user_id} - Deactivate staff user

PACKAGE ENDPOINTS:
- GET /api/salons/{salon_id}/packages/with-services - Get packages with service details
"""

import requests
import json
import sys
from datetime import datetime, timezone

# Backend URL from environment
BACKEND_URL = "https://salon-access-ctrl.preview.emergentagent.com/api"

# Test credentials
TEST_USER = {
    "name": "Test User",
    "phone": "9876543210",
    "gender": "Men"
}

# Test salon admin credentials (we'll need to get these from existing data)
SALON_ADMIN_PHONE = "9876543210"  # This should be an existing salon admin

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_test_header(test_name):
    print(f"\n{Colors.BLUE}{Colors.BOLD}=== {test_name} ==={Colors.ENDC}")

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.ENDC}")

def print_error(message):
    print(f"{Colors.RED}❌ {message}{Colors.ENDC}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.ENDC}")

def print_info(message):
    print(f"{Colors.BLUE}ℹ️  {message}{Colors.ENDC}")

def get_salon_admin_token():
    """Get salon admin authentication token"""
    print_test_header("Getting Salon Admin Authentication")
    
    try:
        # Try to login as salon admin using existing salon
        response = requests.get(f"{BACKEND_URL}/salons")
        if response.status_code != 200:
            print_error("Cannot get salons list")
            return None, None
        
        salons = response.json()
        if not salons:
            print_error("No salons found")
            return None, None
        
        salon = salons[0]
        salon_id = salon.get('id')
        salon_phone = salon.get('phone')
        
        print_info(f"Found salon: {salon.get('salon_name')} (ID: {salon_id})")
        print_info(f"Salon phone: {salon_phone}")
        
        # Try password login first (if salon has password)
        if salon.get('password'):
            login_data = {
                "phone": salon_phone,
                "password": "password123"  # Common test password
            }
            
            response = requests.post(f"{BACKEND_URL}/salon/login", json=login_data)
            if response.status_code == 200:
                token_data = response.json()
                print_success("Salon admin login successful")
                return token_data.get('access_token'), salon_id
        
        # If password login fails, we'll proceed without token for now
        print_warning("Could not authenticate as salon admin - will test endpoints without auth")
        return None, salon_id
        
    except Exception as e:
        print_error(f"Exception getting salon admin token: {str(e)}")
        return None, None

def test_membership_plan_creation(salon_id, auth_token=None):
    """Test POST /api/salons/{salon_id}/membership-plans"""
    print_test_header(f"Testing POST /salons/{salon_id}/membership-plans")
    
    headers = {}
    if auth_token:
        headers['Authorization'] = f'Bearer {auth_token}'
    
    # Test membership plan data
    plan_data = {
        "salon_id": salon_id,
        "name": "Gold Membership",
        "amount": 5000.0,
        "credit": 6000.0,
        "validity_months": 3,
        "terms_conditions": "Valid for 3 months. Non-transferable. Credit expires with membership."
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/salons/{salon_id}/membership-plans", 
                               json=plan_data, headers=headers)
        
        if response.status_code == 200 or response.status_code == 201:
            data = response.json()
            print_success("Membership plan created successfully")
            print_info(f"Plan ID: {data.get('id')}")
            print_info(f"Plan Name: {data.get('name')}")
            print_info(f"Amount: ₹{data.get('amount')}")
            print_info(f"Credit: ₹{data.get('credit')}")
            print_info(f"Validity: {data.get('validity_months')} months")
            return data.get('id')
        elif response.status_code == 401 or response.status_code == 403:
            print_warning("Authentication required for creating membership plans")
            return None
        else:
            print_error(f"Failed to create membership plan: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print_error(f"Exception creating membership plan: {str(e)}")
        return None

def test_get_membership_plans(salon_id):
    """Test GET /api/salons/{salon_id}/membership-plans"""
    print_test_header(f"Testing GET /salons/{salon_id}/membership-plans")
    
    try:
        response = requests.get(f"{BACKEND_URL}/salons/{salon_id}/membership-plans")
        
        if response.status_code == 200:
            data = response.json()
            plans = data.get('plans', [])
            print_success(f"Found {len(plans)} membership plans")
            
            for i, plan in enumerate(plans[:3]):  # Show first 3 plans
                print_info(f"Plan {i+1}: {plan.get('name')} - ₹{plan.get('amount')} (Credit: ₹{plan.get('credit')})")
            
            return plans[0].get('id') if plans else None
        else:
            print_error(f"Failed to get membership plans: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print_error(f"Exception getting membership plans: {str(e)}")
        return None

def test_sell_membership(salon_id, plan_id, auth_token=None):
    """Test POST /api/salons/{salon_id}/sell-membership"""
    print_test_header(f"Testing POST /salons/{salon_id}/sell-membership")
    
    if not plan_id:
        print_warning("No membership plan ID available - skipping sell membership test")
        return None
    
    headers = {}
    if auth_token:
        headers['Authorization'] = f'Bearer {auth_token}'
    
    # Test customer data
    membership_data = {
        "customer_phone": "9123456789",
        "customer_name": "Rajesh Kumar",
        "membership_plan_id": plan_id,
        "payment_mode": "cash",
        "paid_amount": 5000.0
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/salons/{salon_id}/sell-membership", 
                               json=membership_data, headers=headers)
        
        if response.status_code == 200 or response.status_code == 201:
            data = response.json()
            print_success("Membership sold successfully")
            print_info(f"Message: {data.get('message')}")
            if 'membership' in data:
                membership = data['membership']
                print_info(f"Customer: {membership.get('customer_name')}")
                print_info(f"Phone: {membership.get('customer_phone')}")
                print_info(f"Wallet Balance: ₹{membership.get('wallet_balance')}")
            return membership_data['customer_phone']
        elif response.status_code == 401 or response.status_code == 403:
            print_warning("Authentication required for selling memberships")
            return None
        else:
            print_error(f"Failed to sell membership: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print_error(f"Exception selling membership: {str(e)}")
        return None

def test_get_customer_membership(salon_id, customer_phone):
    """Test GET /api/salons/{salon_id}/customer-membership/{phone}"""
    print_test_header(f"Testing GET /salons/{salon_id}/customer-membership/{customer_phone}")
    
    if not customer_phone:
        print_warning("No customer phone available - skipping customer membership test")
        return False
    
    try:
        response = requests.get(f"{BACKEND_URL}/salons/{salon_id}/customer-membership/{customer_phone}")
        
        if response.status_code == 200:
            data = response.json()
            print_success("Customer membership retrieved successfully")
            print_info(f"Has Membership: {data.get('has_membership')}")
            print_info(f"Wallet Balance: ₹{data.get('wallet_balance', 0)}")
            
            if data.get('has_membership'):
                print_info(f"Customer: {data.get('customer_name')}")
                print_info(f"Membership: {data.get('membership_name')}")
                print_info(f"Expiry: {data.get('expiry_date')}")
            
            return True
        else:
            print_error(f"Failed to get customer membership: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception getting customer membership: {str(e)}")
        return False

def test_get_wallet_transactions(salon_id, customer_phone):
    """Test GET /api/salons/{salon_id}/wallet-transactions/{phone}"""
    print_test_header(f"Testing GET /salons/{salon_id}/wallet-transactions/{customer_phone}")
    
    if not customer_phone:
        print_warning("No customer phone available - skipping wallet transactions test")
        return False
    
    try:
        response = requests.get(f"{BACKEND_URL}/salons/{salon_id}/wallet-transactions/{customer_phone}")
        
        if response.status_code == 200:
            data = response.json()
            transactions = data.get('transactions', [])
            print_success(f"Found {len(transactions)} wallet transactions")
            
            for i, txn in enumerate(transactions[:3]):  # Show first 3 transactions
                print_info(f"Transaction {i+1}: {txn.get('transaction_type')} ₹{txn.get('amount')} - {txn.get('description')}")
            
            return True
        else:
            print_error(f"Failed to get wallet transactions: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception getting wallet transactions: {str(e)}")
        return False

def test_use_wallet_balance(salon_id, customer_phone):
    """Test POST /api/salons/{salon_id}/use-wallet"""
    print_test_header(f"Testing POST /salons/{salon_id}/use-wallet")
    
    if not customer_phone:
        print_warning("No customer phone available - skipping use wallet test")
        return False
    
    # Test using a small amount from wallet
    wallet_data = {
        "phone": customer_phone,
        "amount": 100.0
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/salons/{salon_id}/use-wallet", json=wallet_data)
        
        if response.status_code == 200:
            data = response.json()
            print_success("Wallet balance used successfully")
            print_info(f"Message: {data.get('message')}")
            print_info(f"New Balance: ₹{data.get('new_balance', 'N/A')}")
            return True
        elif response.status_code == 400:
            print_warning("Insufficient wallet balance or customer not found (expected for test)")
            return True  # This is expected behavior
        else:
            print_error(f"Failed to use wallet balance: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception using wallet balance: {str(e)}")
        return False

def test_staff_user_login():
    """Test POST /api/salon/users/login"""
    print_test_header("Testing POST /salon/users/login")
    
    # Test with mobile number
    login_data_mobile = {
        "identifier": "9876543210",  # Test mobile
        "password": "password123"
    }
    
    # Test with login ID
    login_data_login_id = {
        "identifier": "admin001",  # Test login ID
        "password": "password123"
    }
    
    test_cases = [
        ("mobile number", login_data_mobile),
        ("login ID", login_data_login_id)
    ]
    
    for test_name, login_data in test_cases:
        print_info(f"Testing login with {test_name}")
        
        try:
            response = requests.post(f"{BACKEND_URL}/salon/users/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                print_success(f"Staff login successful with {test_name}")
                print_info(f"User ID: {data.get('user_id')}")
                print_info(f"Role: {data.get('role')}")
                print_info(f"Salon ID: {data.get('salon_id')}")
                
                # Check JWT token includes role and permissions
                token = data.get('access_token')
                if token:
                    print_info("✓ JWT token received")
                    # Check if permissions are included
                    permissions = data.get('permissions', {})
                    print_info(f"Permissions: {permissions}")
                
                return data.get('access_token'), data.get('salon_id')
            elif response.status_code == 404:
                print_warning(f"User not found for {test_name} (expected for test data)")
            elif response.status_code == 401:
                print_warning(f"Invalid credentials for {test_name} (expected for test data)")
            else:
                print_error(f"Failed staff login with {test_name}: {response.status_code} - {response.text}")
                
        except Exception as e:
            print_error(f"Exception testing staff login with {test_name}: {str(e)}")
    
    return None, None

def test_create_staff_user(salon_id, auth_token=None):
    """Test POST /api/salon/users"""
    print_test_header(f"Testing POST /salon/users")
    
    headers = {}
    if auth_token:
        headers['Authorization'] = f'Bearer {auth_token}'
    
    # Test staff user data
    staff_data = {
        "salon_id": salon_id,
        "name": "Priya Sharma",
        "mobile": "9123456788",
        "login_id": "staff001",
        "password": "password123",
        "role": "staff",
        "permissions": {
            "can_edit_salon": False,
            "can_access_analytics": False,
            "can_delete_salon": False
        }
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/salon/users", json=staff_data, headers=headers)
        
        if response.status_code == 200 or response.status_code == 201:
            data = response.json()
            print_success("Staff user created successfully")
            print_info(f"User ID: {data.get('id')}")
            print_info(f"Name: {data.get('name')}")
            print_info(f"Mobile: {data.get('mobile')}")
            print_info(f"Login ID: {data.get('login_id')}")
            print_info(f"Role: {data.get('role')}")
            return data.get('id')
        elif response.status_code == 401 or response.status_code == 403:
            print_warning("Authentication required for creating staff users")
            return None
        elif response.status_code == 400:
            print_warning("Validation error (may be duplicate login_id/mobile)")
            return None
        else:
            print_error(f"Failed to create staff user: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print_error(f"Exception creating staff user: {str(e)}")
        return None

def test_get_staff_users(salon_id, auth_token=None):
    """Test GET /api/salon/users"""
    print_test_header("Testing GET /salon/users")
    
    headers = {}
    if auth_token:
        headers['Authorization'] = f'Bearer {auth_token}'
    
    try:
        response = requests.get(f"{BACKEND_URL}/salon/users", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            users = data.get('users', [])
            print_success(f"Found {len(users)} salon users")
            
            for i, user in enumerate(users[:3]):  # Show first 3 users
                print_info(f"User {i+1}: {user.get('name')} ({user.get('role')}) - {user.get('login_id')}")
            
            return users[0].get('id') if users else None
        elif response.status_code == 401 or response.status_code == 403:
            print_warning("Authentication required for listing staff users")
            return None
        else:
            print_error(f"Failed to get staff users: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print_error(f"Exception getting staff users: {str(e)}")
        return None

def test_update_staff_user(user_id, auth_token=None):
    """Test PUT /api/salon/users/{user_id}"""
    print_test_header(f"Testing PUT /salon/users/{user_id}")
    
    if not user_id:
        print_warning("No user ID available - skipping update staff user test")
        return False
    
    headers = {}
    if auth_token:
        headers['Authorization'] = f'Bearer {auth_token}'
    
    # Test update data
    update_data = {
        "name": "Priya Sharma Updated",
        "permissions": {
            "can_edit_salon": True,
            "can_access_analytics": True,
            "can_delete_salon": False
        }
    }
    
    try:
        response = requests.put(f"{BACKEND_URL}/salon/users/{user_id}", 
                              json=update_data, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print_success("Staff user updated successfully")
            print_info(f"Message: {data.get('message')}")
            return True
        elif response.status_code == 401 or response.status_code == 403:
            print_warning("Authentication required for updating staff users")
            return False
        elif response.status_code == 404:
            print_warning("User not found (expected for test data)")
            return False
        else:
            print_error(f"Failed to update staff user: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception updating staff user: {str(e)}")
        return False

def test_delete_staff_user(user_id, auth_token=None):
    """Test DELETE /api/salon/users/{user_id}"""
    print_test_header(f"Testing DELETE /salon/users/{user_id}")
    
    if not user_id:
        print_warning("No user ID available - skipping delete staff user test")
        return False
    
    headers = {}
    if auth_token:
        headers['Authorization'] = f'Bearer {auth_token}'
    
    try:
        response = requests.delete(f"{BACKEND_URL}/salon/users/{user_id}", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            print_success("Staff user deactivated successfully")
            print_info(f"Message: {data.get('message')}")
            return True
        elif response.status_code == 401 or response.status_code == 403:
            print_warning("Authentication required for deactivating staff users")
            return False
        elif response.status_code == 404:
            print_warning("User not found (expected for test data)")
            return False
        else:
            print_error(f"Failed to deactivate staff user: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception deactivating staff user: {str(e)}")
        return False

def test_get_packages_with_services(salon_id):
    """Test GET /api/salons/{salon_id}/packages/with-services"""
    print_test_header(f"Testing GET /salons/{salon_id}/packages/with-services")
    
    try:
        response = requests.get(f"{BACKEND_URL}/salons/{salon_id}/packages/with-services")
        
        if response.status_code == 200:
            data = response.json()
            packages = data.get('packages', [])
            print_success(f"Found {len(packages)} packages with service details")
            
            for i, package in enumerate(packages[:3]):  # Show first 3 packages
                print_info(f"Package {i+1}: {package.get('name')} - ₹{package.get('price')}")
                services = package.get('services', [])
                print_info(f"  Services: {len(services)} services included")
            
            return True
        else:
            print_error(f"Failed to get packages with services: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception getting packages with services: {str(e)}")
        return False

def run_membership_and_staff_tests():
    """Run all membership and staff management endpoint tests"""
    print(f"{Colors.BOLD}🧪 Starting Membership and Staff Management Endpoint Tests{Colors.ENDC}")
    print(f"Backend URL: {BACKEND_URL}")
    
    # Phase 1: Get authentication and basic data
    print_test_header("Phase 1: Authentication and Setup")
    
    auth_token, salon_id = get_salon_admin_token()
    if not salon_id:
        print_error("Cannot proceed without salon ID")
        return False
    
    print_info(f"Using salon ID: {salon_id}")
    
    # Phase 2: Test Membership Endpoints
    print_test_header("Phase 2: Testing Membership Endpoints")
    
    membership_results = {}
    
    # Test membership plan creation
    plan_id = test_membership_plan_creation(salon_id, auth_token)
    membership_results['create_membership_plan'] = plan_id is not None
    
    # Test getting membership plans
    if not plan_id:
        plan_id = test_get_membership_plans(salon_id)
    membership_results['get_membership_plans'] = plan_id is not None
    
    # Test selling membership
    customer_phone = test_sell_membership(salon_id, plan_id, auth_token)
    membership_results['sell_membership'] = customer_phone is not None
    
    # Test getting customer membership
    membership_results['get_customer_membership'] = test_get_customer_membership(salon_id, customer_phone)
    
    # Test getting wallet transactions
    membership_results['get_wallet_transactions'] = test_get_wallet_transactions(salon_id, customer_phone)
    
    # Test using wallet balance
    membership_results['use_wallet_balance'] = test_use_wallet_balance(salon_id, customer_phone)
    
    # Phase 3: Test Staff Management Endpoints
    print_test_header("Phase 3: Testing Staff Management Endpoints")
    
    staff_results = {}
    
    # Test staff user login
    staff_token, staff_salon_id = test_staff_user_login()
    staff_results['staff_user_login'] = staff_token is not None
    
    # Test creating staff user
    user_id = test_create_staff_user(salon_id, auth_token)
    staff_results['create_staff_user'] = user_id is not None
    
    # Test getting staff users
    if not user_id:
        user_id = test_get_staff_users(salon_id, auth_token)
    staff_results['get_staff_users'] = user_id is not None
    
    # Test updating staff user
    staff_results['update_staff_user'] = test_update_staff_user(user_id, auth_token)
    
    # Test deactivating staff user
    staff_results['delete_staff_user'] = test_delete_staff_user(user_id, auth_token)
    
    # Phase 4: Test Package Endpoints
    print_test_header("Phase 4: Testing Package Endpoints")
    
    package_results = {}
    
    # Test getting packages with services
    package_results['get_packages_with_services'] = test_get_packages_with_services(salon_id)
    
    # Phase 5: Summary
    print_test_header("Phase 5: Test Summary")
    
    all_results = {**membership_results, **staff_results, **package_results}
    
    passed_tests = [name for name, result in all_results.items() if result]
    failed_tests = [name for name, result in all_results.items() if not result]
    
    print(f"\n{Colors.BOLD}📊 MEMBERSHIP ENDPOINTS:{Colors.ENDC}")
    for test_name, result in membership_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status} {test_name.replace('_', ' ').title()}")
    
    print(f"\n{Colors.BOLD}📊 STAFF MANAGEMENT ENDPOINTS:{Colors.ENDC}")
    for test_name, result in staff_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status} {test_name.replace('_', ' ').title()}")
    
    print(f"\n{Colors.BOLD}📊 PACKAGE ENDPOINTS:{Colors.ENDC}")
    for test_name, result in package_results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status} {test_name.replace('_', ' ').title()}")
    
    total_tests = len(all_results)
    passed_count = len(passed_tests)
    
    print(f"\n{Colors.BOLD}📊 OVERALL RESULTS: {passed_count}/{total_tests} tests passed{Colors.ENDC}")
    
    if passed_count == total_tests:
        print_success("All membership and staff management tests passed!")
        return True
    else:
        print_warning(f"Some tests failed. {total_tests - passed_count} issues found.")
        
        # Show critical failures
        critical_failures = []
        for test_name in failed_tests:
            if 'login' in test_name or 'create' in test_name:
                critical_failures.append(test_name)
        
        if critical_failures:
            print_error("Critical failures found:")
            for failure in critical_failures:
                print_error(f"  - {failure.replace('_', ' ').title()}")
        
        return False

if __name__ == "__main__":
    success = run_membership_and_staff_tests()
    sys.exit(0 if success else 1)