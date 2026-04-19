"""
Test Manual Customer Addition and Salon-Side Booking Features
- POST /api/salons/{salon_id}/customers - Add customer manually
- POST /api/salons/{salon_id}/salon-booking - Create booking from salon side
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SALON_ID = "a1221fbc-f5b1-4485-87a9-9ed23d6e1e27"

@pytest.fixture(scope="module")
def auth_headers():
    """Get authentication headers by logging in as salon admin"""
    # Login as salon admin
    response = requests.post(f"{BASE_URL}/api/salon/login", json={
        "phone": "7503070727",
        "password": "salon123"
    })
    if response.status_code == 200:
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    # Try legacy login
    response = requests.post(f"{BASE_URL}/api/salon/verify-otp", json={
        "phone": "+917503070727",
        "otp": "123456"
    })
    if response.status_code == 200:
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    pytest.skip("Could not authenticate - skipping authenticated tests")

@pytest.fixture(scope="module")
def services(auth_headers):
    """Get available services for the salon"""
    response = requests.get(f"{BASE_URL}/api/salons/{SALON_ID}/services", headers=auth_headers)
    if response.status_code == 200:
        return response.json().get("services", [])
    return []

@pytest.fixture(scope="module")
def barbers(auth_headers):
    """Get available barbers for the salon"""
    response = requests.get(f"{BASE_URL}/api/salons/{SALON_ID}/barbers", headers=auth_headers)
    if response.status_code == 200:
        return response.json()
    return []


class TestManualCustomerAddition:
    """Test POST /api/salons/{salon_id}/customers endpoint"""
    
    def test_add_customer_with_all_fields(self, auth_headers):
        """Test adding customer with name, phone, and gender"""
        unique_phone = f"+919{uuid.uuid4().hex[:9]}"
        payload = {
            "name": "TEST_Customer_Full",
            "phone": unique_phone,
            "gender": "Men"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/salons/{SALON_ID}/customers",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "customer" in data
        assert data["customer"]["name"] == "TEST_Customer_Full"
        assert data["customer"]["gender"] == "Men"
        print(f"✓ Customer added with all fields: {data['customer']['id']}")
    
    def test_add_customer_name_only(self, auth_headers):
        """Test adding customer with only name (walk-in without phone)"""
        payload = {
            "name": "TEST_WalkIn_Customer",
            "phone": "",
            "gender": "Women"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/salons/{SALON_ID}/customers",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "customer" in data
        assert data["customer"]["name"] == "TEST_WalkIn_Customer"
        assert data["customer"]["gender"] == "Women"
        print(f"✓ Walk-in customer added without phone: {data['customer']['id']}")
    
    def test_add_customer_kids_gender(self, auth_headers):
        """Test adding customer with Kids gender"""
        unique_phone = f"+919{uuid.uuid4().hex[:9]}"
        payload = {
            "name": "TEST_Kid_Customer",
            "phone": unique_phone,
            "gender": "Kids"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/salons/{SALON_ID}/customers",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["customer"]["gender"] == "Kids"
        print(f"✓ Kid customer added: {data['customer']['id']}")
    
    def test_add_customer_missing_name(self, auth_headers):
        """Test that adding customer without name fails"""
        payload = {
            "name": "",
            "phone": "+919999999999",
            "gender": "Men"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/salons/{SALON_ID}/customers",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for missing name, got {response.status_code}"
        print("✓ Correctly rejected customer without name")
    
    def test_add_customer_duplicate_phone_updates(self, auth_headers):
        """Test that adding customer with existing phone updates the record"""
        unique_phone = f"+919{uuid.uuid4().hex[:9]}"
        
        # First add
        payload1 = {
            "name": "TEST_Original_Name",
            "phone": unique_phone,
            "gender": "Men"
        }
        response1 = requests.post(
            f"{BASE_URL}/api/salons/{SALON_ID}/customers",
            json=payload1,
            headers=auth_headers
        )
        assert response1.status_code == 200
        
        # Second add with same phone - should update
        payload2 = {
            "name": "TEST_Updated_Name",
            "phone": unique_phone,
            "gender": "Women"
        }
        response2 = requests.post(
            f"{BASE_URL}/api/salons/{SALON_ID}/customers",
            json=payload2,
            headers=auth_headers
        )
        
        assert response2.status_code == 200
        data = response2.json()
        assert "Customer updated" in data.get("message", "")
        assert data["customer"]["name"] == "TEST_Updated_Name"
        print("✓ Duplicate phone correctly updates existing customer")


class TestSalonSideBooking:
    """Test POST /api/salons/{salon_id}/salon-booking endpoint"""
    
    def test_create_booking_with_existing_customer(self, auth_headers, services, barbers):
        """Test creating booking with existing customer details"""
        if not services:
            pytest.skip("No services available")
        
        service_id = services[0]["id"]
        barber_id = barbers[0]["id"] if barbers else "any"
        
        payload = {
            "customer_name": "TEST_Booking_Customer",
            "phone": "+919876500001",
            "gender": "Men",
            "barber_id": barber_id,
            "selected_services": [service_id],
            "payment_mode": "cash"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/salons/{SALON_ID}/salon-booking",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["customer_name"] == "TEST_Booking_Customer"
        assert data["status"] == "waiting"
        assert data["source"] == "salon"
        assert "token_number" in data
        print(f"✓ Booking created with token #{data['token_number']}")
    
    def test_create_booking_adhoc_customer_name_only(self, auth_headers, services):
        """Test creating booking with ad-hoc customer (name only)"""
        if not services:
            pytest.skip("No services available")
        
        service_id = services[0]["id"]
        
        payload = {
            "customer_name": "TEST_Adhoc_WalkIn",
            "phone": "",
            "gender": "Women",
            "barber_id": "any",
            "selected_services": [service_id],
            "payment_mode": "upi"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/salons/{SALON_ID}/salon-booking",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["customer_name"] == "TEST_Adhoc_WalkIn"
        assert data["customer_gender"] == "Women"
        assert data["payment_mode"] == "upi"
        print(f"✓ Ad-hoc booking created with token #{data['token_number']}")
    
    def test_create_booking_multiple_services(self, auth_headers, services, barbers):
        """Test creating booking with multiple services"""
        if len(services) < 2:
            pytest.skip("Need at least 2 services")
        
        service_ids = [services[0]["id"], services[1]["id"]]
        barber_id = barbers[0]["id"] if barbers else "any"
        
        payload = {
            "customer_name": "TEST_MultiService_Customer",
            "phone": "+919876500002",
            "gender": "Men",
            "barber_id": barber_id,
            "selected_services": service_ids,
            "payment_mode": "card"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/salons/{SALON_ID}/salon-booking",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert len(data["selected_services"]) == 2
        assert data["total_amount"] > 0
        print(f"✓ Multi-service booking created: ₹{data['total_amount']}")
    
    def test_create_booking_pay_later_mode(self, auth_headers, services):
        """Test creating booking with pay_later payment mode"""
        if not services:
            pytest.skip("No services available")
        
        service_id = services[0]["id"]
        
        payload = {
            "customer_name": "TEST_PayLater_Customer",
            "phone": "",
            "gender": "Men",
            "barber_id": "any",
            "selected_services": [service_id],
            "payment_mode": "pay_later"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/salons/{SALON_ID}/salon-booking",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["payment_mode"] == "pay_later"
        print(f"✓ Pay-later booking created with token #{data['token_number']}")
    
    def test_create_booking_auto_shift_detection(self, auth_headers, services):
        """Test that shift is auto-detected when not provided"""
        if not services:
            pytest.skip("No services available")
        
        service_id = services[0]["id"]
        
        payload = {
            "customer_name": "TEST_AutoShift_Customer",
            "phone": "",
            "gender": "Men",
            "barber_id": "any",
            "selected_services": [service_id],
            "payment_mode": "cash"
            # No shift provided - should auto-detect
        }
        
        response = requests.post(
            f"{BASE_URL}/api/salons/{SALON_ID}/salon-booking",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["shift"] in ["Morning", "Noon", "Evening"]
        print(f"✓ Auto-detected shift: {data['shift']}")
    
    def test_create_booking_saves_customer(self, auth_headers, services):
        """Test that booking with phone saves customer to database"""
        if not services:
            pytest.skip("No services available")
        
        unique_phone = f"+919{uuid.uuid4().hex[:9]}"
        service_id = services[0]["id"]
        
        payload = {
            "customer_name": "TEST_SavedCustomer",
            "phone": unique_phone,
            "gender": "Women",
            "barber_id": "any",
            "selected_services": [service_id],
            "payment_mode": "cash"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/salons/{SALON_ID}/salon-booking",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        # Verify customer was saved
        customers_response = requests.get(
            f"{BASE_URL}/api/salons/{SALON_ID}/customers",
            headers=auth_headers
        )
        assert customers_response.status_code == 200
        customers = customers_response.json().get("customers", [])
        
        # Find the customer we just created
        found = any(c.get("phone") == unique_phone for c in customers)
        assert found, "Customer should be saved when booking with phone"
        print("✓ Customer automatically saved from booking")


class TestCustomerListEndpoint:
    """Test GET /api/salons/{salon_id}/customers endpoint"""
    
    def test_get_customers_list(self, auth_headers):
        """Test fetching customer list"""
        response = requests.get(
            f"{BASE_URL}/api/salons/{SALON_ID}/customers",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "customers" in data
        assert isinstance(data["customers"], list)
        print(f"✓ Retrieved {len(data['customers'])} customers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
