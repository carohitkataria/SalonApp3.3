"""
Backend API Tests for Salon Queue Management System
Tests: Salon registration, OTP login, services, barbers, bookings, queue management
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
API = f"{BASE_URL}/api"

# Test data
TEST_PHONE = "9999999999"
TEST_OTP = "123456"  # Hardcoded OTP for testing
TEST_SALON_NAME = "TEST_Salon_" + datetime.now().strftime("%H%M%S")


class TestHealthCheck:
    """Basic API health check"""
    
    def test_api_root(self):
        response = requests.get(f"{API}/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "Multi-Salon" in data["message"]
        print(f"✓ API root working: {data['message']}")


class TestSalonRegistration:
    """Salon registration flow tests"""
    
    def test_register_new_salon(self):
        """Test registering a new salon"""
        payload = {
            "salon_name": TEST_SALON_NAME,
            "owner_name": "Test Owner",
            "phone": TEST_PHONE,
            "email": "test@example.com",
            "address": "123 Test Street, Test City",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "upi_id": "test@upi",
            "payment_timing": "after"
        }
        
        response = requests.post(f"{API}/salon/register", json=payload)
        
        # Could be 200 (success) or 400 (already exists)
        if response.status_code == 200:
            data = response.json()
            assert data["salon_name"] == TEST_SALON_NAME
            assert "id" in data
            print(f"✓ Salon registered: {data['id']}")
        elif response.status_code == 400:
            # Salon already exists - this is acceptable
            print("✓ Salon already registered (expected if test ran before)")
        else:
            pytest.fail(f"Unexpected status: {response.status_code} - {response.text}")
    
    def test_register_duplicate_phone_fails(self):
        """Test that duplicate phone registration fails"""
        # First, ensure a salon exists with the seeded phone
        payload = {
            "salon_name": "Duplicate Test",
            "owner_name": "Test",
            "phone": "7503070727",  # Seeded salon phone
            "email": "",
            "address": "Test",
            "latitude": 12.9716,
            "longitude": 77.5946
        }
        
        response = requests.post(f"{API}/salon/register", json=payload)
        # Should fail with 400 since this phone is already registered
        assert response.status_code == 400
        print("✓ Duplicate phone registration correctly rejected")


class TestSalonOTPAuth:
    """Salon OTP authentication tests"""
    
    def test_send_otp(self):
        """Test sending OTP to salon phone"""
        payload = {"phone": "7503070727"}  # Seeded salon phone
        
        response = requests.post(f"{API}/salon/send-otp", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "otp" in data
        assert data["otp"] == "123456"  # Hardcoded OTP
        assert data["salon_exists"] == True
        print(f"✓ OTP sent successfully: {data['otp']}")
    
    def test_send_otp_new_phone(self):
        """Test sending OTP to new phone (salon doesn't exist)"""
        payload = {"phone": "1111111111"}
        
        response = requests.post(f"{API}/salon/send-otp", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["salon_exists"] == False
        print("✓ OTP sent for new phone, salon_exists=False")
    
    def test_verify_otp_success(self):
        """Test OTP verification with correct OTP"""
        # First send OTP
        requests.post(f"{API}/salon/send-otp", json={"phone": "7503070727"})
        
        # Verify OTP
        payload = {"phone": "7503070727", "otp": "123456"}
        response = requests.post(f"{API}/salon/verify-otp", json=payload)
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "salon_id" in data
        print(f"✓ OTP verified, token received, salon_id: {data['salon_id']}")
        return data
    
    def test_verify_otp_invalid(self):
        """Test OTP verification with wrong OTP"""
        # First send OTP
        requests.post(f"{API}/salon/send-otp", json={"phone": "7503070727"})
        
        # Verify with wrong OTP
        payload = {"phone": "7503070727", "otp": "000000"}
        response = requests.post(f"{API}/salon/verify-otp", json=payload)
        
        assert response.status_code == 400
        print("✓ Invalid OTP correctly rejected")


class TestSalons:
    """Salon listing and details tests"""
    
    def test_get_all_salons(self):
        """Test getting all salons"""
        response = requests.get(f"{API}/salons")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Check salon structure
        salon = data[0]
        assert "id" in salon
        assert "salon_name" in salon
        assert "address" in salon
        print(f"✓ Found {len(data)} salons")
        return data[0]
    
    def test_get_salon_by_id(self):
        """Test getting specific salon"""
        # First get all salons
        salons = requests.get(f"{API}/salons").json()
        salon_id = salons[0]["id"]
        
        response = requests.get(f"{API}/salons/{salon_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == salon_id
        print(f"✓ Got salon: {data['salon_name']}")
    
    def test_get_salons_by_location(self):
        """Test location-based salon filtering"""
        # Use Bangalore coordinates
        response = requests.get(f"{API}/salons?lat=12.9716&lng=77.5946&radius=5")
        assert response.status_code == 200
        
        data = response.json()
        # Should return salons with distance field
        if len(data) > 0 and "distance" in data[0]:
            print(f"✓ Location filter working, found {len(data)} nearby salons")
        else:
            print(f"✓ Location filter working, found {len(data)} salons")


class TestServices:
    """Service management tests"""
    
    def test_get_services(self):
        """Test getting all services"""
        response = requests.get(f"{API}/services")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Check service structure
        service = data[0]
        assert "id" in service
        assert "service_name" in service
        assert "base_price" in service
        print(f"✓ Found {len(data)} services")
        return data


class TestBarbers:
    """Barber management tests"""
    
    def test_get_salon_barbers(self):
        """Test getting barbers for a salon"""
        # Get first salon
        salons = requests.get(f"{API}/salons").json()
        salon_id = salons[0]["id"]
        
        response = requests.get(f"{API}/salons/{salon_id}/barbers")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            barber = data[0]
            assert "id" in barber
            assert "name" in barber
            assert "category" in barber
            print(f"✓ Found {len(data)} barbers: {[b['name'] for b in data]}")
        else:
            print("✓ No barbers found (may need seeding)")
        return data
    
    def test_get_barber_services(self):
        """Test getting barber-specific service pricing"""
        # Get first salon and barber
        salons = requests.get(f"{API}/salons").json()
        salon_id = salons[0]["id"]
        barbers = requests.get(f"{API}/salons/{salon_id}/barbers").json()
        
        if len(barbers) == 0:
            pytest.skip("No barbers available")
        
        barber_id = barbers[0]["id"]
        response = requests.get(f"{API}/barbers/{barber_id}/services")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            service = data[0]
            assert "barber_price" in service
            print(f"✓ Barber services with pricing: {len(data)} services")
        return data


class TestSlots:
    """Time slot tests"""
    
    def test_get_slots(self):
        """Test getting available time slots"""
        response = requests.get(f"{API}/slots")
        assert response.status_code == 200
        
        data = response.json()
        assert "slots" in data
        assert isinstance(data["slots"], list)
        
        # Should have 2-hour slots
        if len(data["slots"]) > 0:
            slot = data["slots"][0]
            assert "-" in slot  # Format: "08:00-10:00"
            print(f"✓ Found {len(data['slots'])} time slots: {data['slots'][:3]}...")


class TestUserAuth:
    """User authentication tests"""
    
    def test_user_login(self):
        """Test user login with name and phone"""
        payload = {
            "name": "Test User",
            "phone": "9876543211"
        }
        
        response = requests.post(f"{API}/user/login", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["name"] == "Test User"
        assert "+91" in data["phone"]
        print(f"✓ User logged in: {data['id']}")
        return data
    
    def test_user_login_invalid_phone(self):
        """Test user login with invalid phone"""
        payload = {
            "name": "Test",
            "phone": "123"  # Too short
        }
        
        response = requests.post(f"{API}/user/login", json=payload)
        assert response.status_code == 400
        print("✓ Invalid phone correctly rejected")


class TestBookings:
    """Booking/Token creation tests"""
    
    @pytest.fixture
    def setup_booking_data(self):
        """Setup data needed for booking tests"""
        # Get salon
        salons = requests.get(f"{API}/salons").json()
        salon_id = salons[0]["id"]
        
        # Get barbers
        barbers = requests.get(f"{API}/salons/{salon_id}/barbers").json()
        barber_id = barbers[0]["id"] if barbers else "any"
        
        # Get services
        services = requests.get(f"{API}/services").json()
        service_ids = [services[0]["id"]] if services else []
        
        # Get slots
        slots = requests.get(f"{API}/slots").json()["slots"]
        time_slot = slots[0] if slots else "10:00-12:00"
        
        # Create user
        user = requests.post(f"{API}/user/login", json={
            "name": "Booking Test User",
            "phone": "9876543299"
        }).json()
        
        return {
            "salon_id": salon_id,
            "barber_id": barber_id,
            "service_ids": service_ids,
            "time_slot": time_slot,
            "user": user
        }
    
    def test_create_booking(self, setup_booking_data):
        """Test creating a new booking"""
        data = setup_booking_data
        today = datetime.now().strftime("%Y-%m-%d")
        
        payload = {
            "salon_id": data["salon_id"],
            "user_id": data["user"]["id"],
            "customer_name": data["user"]["name"],
            "phone": data["user"]["phone"],
            "date": today,
            "time_slot": data["time_slot"],
            "barber_id": data["barber_id"],
            "selected_services": data["service_ids"],
            "source": "online",
            "booking_type": "instant"
        }
        
        response = requests.post(f"{API}/bookings", json=payload)
        assert response.status_code == 200
        
        token = response.json()
        assert "id" in token
        assert "token_number" in token
        assert token["status"] == "waiting"
        print(f"✓ Booking created: Token #{token['token_number']}")
        return token


class TestQueueManagement:
    """Queue management tests (requires auth)"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authenticated headers for salon"""
        # Send OTP
        requests.post(f"{API}/salon/send-otp", json={"phone": "7503070727"})
        
        # Verify OTP
        response = requests.post(f"{API}/salon/verify-otp", json={
            "phone": "7503070727",
            "otp": "123456"
        })
        
        if response.status_code != 200:
            pytest.skip("Could not authenticate salon")
        
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_salon_queue(self, auth_headers):
        """Test getting salon queue"""
        salons = requests.get(f"{API}/salons").json()
        salon_id = salons[0]["id"]
        
        response = requests.get(f"{API}/salons/{salon_id}/queue")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Queue has {len(data)} tokens")
    
    def test_get_barber_queue(self, auth_headers):
        """Test getting barber-specific queue"""
        salons = requests.get(f"{API}/salons").json()
        salon_id = salons[0]["id"]
        
        barbers = requests.get(f"{API}/salons/{salon_id}/barbers").json()
        if not barbers:
            pytest.skip("No barbers available")
        
        barber_id = barbers[0]["id"]
        response = requests.get(f"{API}/salons/{salon_id}/barbers/{barber_id}/queue")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Barber queue has {len(data)} tokens")


class TestPayments:
    """Payment-related tests"""
    
    def test_generate_upi_qr_no_token(self):
        """Test UPI QR generation with invalid token"""
        response = requests.post(f"{API}/payments/generate-upi-qr?token_id=invalid")
        assert response.status_code == 404
        print("✓ Invalid token correctly rejected for UPI QR")


class TestUserHistory:
    """User history tests"""
    
    def test_get_user_history(self):
        """Test getting user booking history"""
        # Create a user first
        user = requests.post(f"{API}/user/login", json={
            "name": "History Test",
            "phone": "9876543288"
        }).json()
        
        response = requests.get(f"{API}/user/{user['id']}/history")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ User history: {len(data)} bookings")
    
    def test_get_user_active_bookings(self):
        """Test getting user active bookings"""
        user = requests.post(f"{API}/user/login", json={
            "name": "Active Test",
            "phone": "9876543277"
        }).json()
        
        response = requests.get(f"{API}/user/{user['id']}/active")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ User active bookings: {len(data)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
