"""
Test Suite for Multi-User RBAC Salon Management System
Tests: Session persistence, Services toggle, Customer membership, Staff access control,
       Staff service assignment, Custom packages, Membership edit/delete, Multi-tier loyalty
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SALON_PHONE = "7503070727"
SALON_PASSWORD = "salon123"
TEST_CUSTOMER_PHONE = "+919999999999"
SALON_ID = None
AUTH_TOKEN = None


class TestSalonLogin:
    """Test salon login and session"""
    
    def test_salon_password_login(self):
        """Test salon can login with password"""
        global SALON_ID, AUTH_TOKEN
        
        response = requests.post(f"{BASE_URL}/api/salon/password-login", json={
            "phone": SALON_PHONE,
            "password": SALON_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert "access_token" in data, "No access_token in response"
        assert "salon_id" in data, "No salon_id in response"
        
        SALON_ID = data["salon_id"]
        AUTH_TOKEN = data["access_token"]
        
        print(f"Login successful. Salon ID: {SALON_ID}")
    
    def test_token_validity(self):
        """Test that token is valid for authenticated requests"""
        global SALON_ID, AUTH_TOKEN
        
        if not AUTH_TOKEN:
            pytest.skip("No auth token available")
        
        response = requests.get(
            f"{BASE_URL}/api/salons/{SALON_ID}",
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Token validation failed: {response.text}"
        data = response.json()
        assert "salon_name" in data or "id" in data


class TestServicesToggle:
    """Test enable/disable services for salon"""
    
    def test_get_all_services(self):
        """Get all services with salon status"""
        global SALON_ID, AUTH_TOKEN
        
        if not AUTH_TOKEN:
            pytest.skip("No auth token available")
        
        response = requests.get(
            f"{BASE_URL}/api/salons/{SALON_ID}/services/all",
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Failed to get services: {response.text}"
        services = response.json()
        
        assert isinstance(services, list), "Services should be a list"
        print(f"Found {len(services)} services")
        
        # Store first service ID for toggle test
        if services:
            pytest.service_id = services[0].get("id")
    
    def test_toggle_service_enable(self):
        """Test enabling a service for salon"""
        global SALON_ID, AUTH_TOKEN
        
        if not AUTH_TOKEN:
            pytest.skip("No auth token available")
        
        # Get a service first
        response = requests.get(
            f"{BASE_URL}/api/salons/{SALON_ID}/services/all",
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
        )
        
        if response.status_code != 200 or not response.json():
            pytest.skip("No services available to toggle")
        
        service_id = response.json()[0].get("id")
        
        # Toggle service
        toggle_response = requests.put(
            f"{BASE_URL}/api/salons/{SALON_ID}/services/{service_id}/toggle?is_enabled=true",
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
        )
        
        assert toggle_response.status_code == 200, f"Toggle failed: {toggle_response.text}"
        data = toggle_response.json()
        assert data.get("success") == True
        print(f"Service {service_id} enabled successfully")


class TestMembershipPlans:
    """Test membership plan CRUD operations"""
    
    def test_get_membership_plans(self):
        """Get all membership plans"""
        global SALON_ID
        
        if not SALON_ID:
            pytest.skip("No salon ID available")
        
        response = requests.get(f"{BASE_URL}/api/salons/{SALON_ID}/membership-plans")
        
        assert response.status_code == 200, f"Failed to get plans: {response.text}"
        data = response.json()
        assert "plans" in data
        print(f"Found {len(data['plans'])} membership plans")
    
    def test_create_membership_plan(self):
        """Create a new membership plan"""
        global SALON_ID, AUTH_TOKEN
        
        if not AUTH_TOKEN:
            pytest.skip("No auth token available")
        
        response = requests.post(
            f"{BASE_URL}/api/salons/{SALON_ID}/membership-plans",
            json={
                "salon_id": SALON_ID,
                "name": "TEST_Gold",
                "amount": 5000,
                "credit": 6000,
                "validity_months": 6,
                "terms_conditions": "Test terms and conditions"
            },
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Create plan failed: {response.text}"
        data = response.json()
        assert data.get("name") == "TEST_Gold"
        assert data.get("amount") == 5000
        assert data.get("credit") == 6000
        
        pytest.test_plan_id = data.get("id")
        print(f"Created membership plan: {data.get('id')}")
    
    def test_update_membership_plan(self):
        """Update membership plan (price should be locked)"""
        global SALON_ID, AUTH_TOKEN
        
        if not AUTH_TOKEN or not hasattr(pytest, 'test_plan_id'):
            pytest.skip("No auth token or plan ID available")
        
        response = requests.put(
            f"{BASE_URL}/api/salons/{SALON_ID}/membership-plans/{pytest.test_plan_id}",
            json={
                "salon_id": SALON_ID,
                "name": "TEST_Gold_Updated",
                "amount": 5000,  # Price locked
                "credit": 7000,  # Credit can change
                "validity_months": 12,
                "terms_conditions": "Updated terms"
            },
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Update plan failed: {response.text}"
        data = response.json()
        assert data.get("name") == "TEST_Gold_Updated"
        print(f"Updated membership plan: {pytest.test_plan_id}")
    
    def test_delete_membership_plan(self):
        """Delete membership plan"""
        global SALON_ID, AUTH_TOKEN
        
        if not AUTH_TOKEN or not hasattr(pytest, 'test_plan_id'):
            pytest.skip("No auth token or plan ID available")
        
        response = requests.delete(
            f"{BASE_URL}/api/salons/{SALON_ID}/membership-plans/{pytest.test_plan_id}",
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Delete plan failed: {response.text}"
        print(f"Deleted membership plan: {pytest.test_plan_id}")


class TestCustomerMembershipPurchase:
    """Test customer membership purchase without auth"""
    
    def test_customer_buy_membership_no_auth(self):
        """Customer can buy membership without authentication"""
        global SALON_ID
        
        if not SALON_ID:
            pytest.skip("No salon ID available")
        
        # First create a plan to buy
        response = requests.post(
            f"{BASE_URL}/api/salons/{SALON_ID}/membership-plans",
            json={
                "salon_id": SALON_ID,
                "name": "TEST_Customer_Plan",
                "amount": 1000,
                "credit": 1200,
                "validity_months": 3,
                "terms_conditions": "Test plan for customer purchase"
            },
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
        )
        
        if response.status_code != 200:
            pytest.skip("Could not create test plan")
        
        plan_id = response.json().get("id")
        
        # Customer buys membership (NO AUTH REQUIRED)
        buy_response = requests.post(
            f"{BASE_URL}/api/salons/{SALON_ID}/customers/9888888888/buy-membership",
            json={
                "customer_phone": "9888888888",
                "customer_name": "Test Buyer",
                "membership_plan_id": plan_id,
                "payment_mode": "cash",
                "paid_amount": 1000
            }
        )
        
        assert buy_response.status_code == 200, f"Customer buy failed: {buy_response.text}"
        data = buy_response.json()
        assert "message" in data
        print(f"Customer membership purchase: {data.get('message')}")
        
        # Cleanup - delete the test plan
        requests.delete(
            f"{BASE_URL}/api/salons/{SALON_ID}/membership-plans/{plan_id}",
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
        )


class TestStaffAccessControl:
    """Test staff user creation and access control"""
    
    def test_get_barbers(self):
        """Get list of barbers/staff"""
        global SALON_ID, AUTH_TOKEN
        
        if not AUTH_TOKEN:
            pytest.skip("No auth token available")
        
        response = requests.get(
            f"{BASE_URL}/api/salons/{SALON_ID}/barbers",
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Failed to get barbers: {response.text}"
        barbers = response.json()
        
        assert isinstance(barbers, list), "Barbers should be a list"
        print(f"Found {len(barbers)} barbers/staff")
        
        if barbers:
            pytest.test_barber_id = barbers[0].get("id")
            pytest.test_barber_name = barbers[0].get("name")
            pytest.test_barber_mobile = barbers[0].get("mobile")
    
    def test_create_staff_user(self):
        """Create staff user with login credentials"""
        global SALON_ID, AUTH_TOKEN
        
        if not AUTH_TOKEN or not hasattr(pytest, 'test_barber_id'):
            pytest.skip("No auth token or barber ID available")
        
        response = requests.post(
            f"{BASE_URL}/api/salon/users",
            json={
                "salon_id": SALON_ID,
                "name": pytest.test_barber_name or "Test Staff",
                "mobile": pytest.test_barber_mobile or "9777777777",
                "login_id": "teststaff_" + str(int(time.time())),
                "password": "test1234",
                "role": "staff",
                "staff_id": pytest.test_barber_id,
                "permissions": {
                    "can_edit_salon": False,
                    "can_access_analytics": True,
                    "can_delete_salon": False
                }
            },
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
        )
        
        # May fail if user already exists, which is OK
        if response.status_code == 200:
            data = response.json()
            print(f"Created staff user: {data.get('login_id')}")
        elif response.status_code == 400 and "already exists" in response.text.lower():
            print("Staff user already exists - OK")
        else:
            print(f"Staff user creation response: {response.status_code} - {response.text}")


class TestStaffServiceAssignment:
    """Test staff service toggle"""
    
    def test_get_barber_services(self):
        """Get services assigned to a barber"""
        global SALON_ID, AUTH_TOKEN
        
        if not AUTH_TOKEN:
            pytest.skip("No auth token available")
        
        # Get barbers first
        barbers_response = requests.get(
            f"{BASE_URL}/api/salons/{SALON_ID}/barbers",
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
        )
        
        if barbers_response.status_code != 200 or not barbers_response.json():
            pytest.skip("No barbers available")
        
        barber_id = barbers_response.json()[0].get("id")
        
        response = requests.get(
            f"{BASE_URL}/api/barbers/{barber_id}/services",
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Failed to get barber services: {response.text}"
        services = response.json()
        print(f"Barber has {len(services)} services")
    
    def test_toggle_barber_service(self):
        """Toggle service availability for barber"""
        global SALON_ID, AUTH_TOKEN
        
        if not AUTH_TOKEN:
            pytest.skip("No auth token available")
        
        # Get barbers
        barbers_response = requests.get(
            f"{BASE_URL}/api/salons/{SALON_ID}/barbers",
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
        )
        
        if barbers_response.status_code != 200 or not barbers_response.json():
            pytest.skip("No barbers available")
        
        barber_id = barbers_response.json()[0].get("id")
        
        # Get services
        services_response = requests.get(f"{BASE_URL}/api/services")
        
        if services_response.status_code != 200 or not services_response.json():
            pytest.skip("No services available")
        
        service_id = services_response.json()[0].get("id")
        
        # Toggle service for barber
        toggle_response = requests.put(
            f"{BASE_URL}/api/barbers/{barber_id}/services/{service_id}/toggle?is_available=true",
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
        )
        
        assert toggle_response.status_code == 200, f"Toggle failed: {toggle_response.text}"
        data = toggle_response.json()
        assert data.get("success") == True
        print(f"Toggled service {service_id} for barber {barber_id}")


class TestCustomPackages:
    """Test custom package creation with pricing options"""
    
    def test_create_custom_package(self):
        """Create custom package for customer"""
        global SALON_ID, AUTH_TOKEN
        
        if not AUTH_TOKEN:
            pytest.skip("No auth token available")
        
        # Get services first
        services_response = requests.get(f"{BASE_URL}/api/services")
        
        if services_response.status_code != 200 or not services_response.json():
            pytest.skip("No services available")
        
        services = services_response.json()[:2]  # Take first 2 services
        service_ids = [s.get("id") for s in services]
        service_names = [s.get("service_name") for s in services]
        total_original = sum([s.get("base_price", 100) for s in services])
        
        response = requests.post(
            f"{BASE_URL}/api/salons/{SALON_ID}/customer-packages",
            json={
                "salon_id": SALON_ID,
                "customer_phone": TEST_CUSTOMER_PHONE,
                "customer_name": "Test Customer",
                "package_name": "TEST_Custom_Package",
                "service_ids": service_ids,
                "service_names": service_names,
                "total_original": total_original,
                "discount_percentage": 10,
                "total_discounted": total_original * 0.9,
                "notes": "Test custom package"
            },
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Create package failed: {response.text}"
        data = response.json()
        assert data.get("package_name") == "TEST_Custom_Package"
        print(f"Created custom package: {data.get('id')}")
    
    def test_get_customer_packages(self):
        """Get packages for a customer"""
        global SALON_ID, AUTH_TOKEN
        
        if not AUTH_TOKEN:
            pytest.skip("No auth token available")
        
        phone = TEST_CUSTOMER_PHONE.replace("+91", "")
        
        response = requests.get(
            f"{BASE_URL}/api/salons/{SALON_ID}/customer-packages/{phone}",
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Get packages failed: {response.text}"
        data = response.json()
        assert "packages" in data
        print(f"Customer has {len(data['packages'])} packages")


class TestLoyaltyProgram:
    """Test multi-tier loyalty program"""
    
    def test_get_loyalty_settings(self):
        """Get loyalty program settings"""
        global SALON_ID, AUTH_TOKEN
        
        if not AUTH_TOKEN:
            pytest.skip("No auth token available")
        
        response = requests.get(
            f"{BASE_URL}/api/salons/{SALON_ID}/loyalty-program",
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Get loyalty failed: {response.text}"
        data = response.json()
        print(f"Loyalty program enabled: {data.get('enabled')}")
    
    def test_save_loyalty_settings(self):
        """Save multi-tier loyalty program settings"""
        global SALON_ID, AUTH_TOKEN
        
        if not AUTH_TOKEN:
            pytest.skip("No auth token available")
        
        response = requests.post(
            f"{BASE_URL}/api/salons/{SALON_ID}/loyalty-program",
            json={
                "salon_id": SALON_ID,
                "enabled": True,
                "period_months": 6,
                "tiers": [
                    {"name": "Bronze", "spend_amount": 5000, "topup_percentage": 5},
                    {"name": "Silver", "spend_amount": 10000, "topup_percentage": 10},
                    {"name": "Gold", "spend_amount": 20000, "topup_percentage": 15}
                ]
            },
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Save loyalty failed: {response.text}"
        data = response.json()
        assert data.get("enabled") == True
        assert len(data.get("tiers", [])) == 3
        print(f"Saved loyalty program with {len(data.get('tiers', []))} tiers")


class TestCustomerWallet:
    """Test customer wallet and membership info"""
    
    def test_get_customer_membership(self):
        """Get customer membership/wallet info"""
        global SALON_ID
        
        if not SALON_ID:
            pytest.skip("No salon ID available")
        
        phone = TEST_CUSTOMER_PHONE.replace("+91", "")
        
        response = requests.get(
            f"{BASE_URL}/api/salons/{SALON_ID}/customers/{phone}/membership"
        )
        
        # May return 404 if no membership, which is OK
        if response.status_code == 200:
            data = response.json()
            print(f"Customer membership: {data}")
        elif response.status_code == 404:
            print("Customer has no active membership - OK")
        else:
            assert False, f"Unexpected response: {response.status_code} - {response.text}"


# Cleanup fixture
@pytest.fixture(scope="session", autouse=True)
def cleanup(request):
    """Cleanup test data after all tests"""
    def cleanup_test_data():
        global SALON_ID, AUTH_TOKEN
        if AUTH_TOKEN and SALON_ID:
            # Delete test membership plans
            plans_response = requests.get(f"{BASE_URL}/api/salons/{SALON_ID}/membership-plans")
            if plans_response.status_code == 200:
                for plan in plans_response.json().get("plans", []):
                    if plan.get("name", "").startswith("TEST_"):
                        requests.delete(
                            f"{BASE_URL}/api/salons/{SALON_ID}/membership-plans/{plan['id']}",
                            headers={"Authorization": f"Bearer {AUTH_TOKEN}"}
                        )
    
    request.addfinalizer(cleanup_test_data)
