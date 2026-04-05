import requests
import sys
from datetime import datetime, timedelta
import json
import uuid

class SalonAPITester:
    def __init__(self, base_url="https://booking-perf-fix-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_tokens = []

    def log_result(self, test_name, success, response_data=None, error=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
        else:
            print(f"❌ {test_name} - FAILED: {error}")
        
        self.test_results.append({
            "test": test_name,
            "success": success,
            "response": response_data,
            "error": str(error) if error else None
        })

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=10)

            success = response.status_code == expected_status
            response_data = None
            
            if response.headers.get('content-type', '').startswith('application/json'):
                try:
                    response_data = response.json()
                except:
                    pass
            
            if success:
                self.log_result(name, True, response_data)
                return True, response_data
            else:
                self.log_result(name, False, response_data, f"Expected {expected_status}, got {response.status_code}")
                return False, response_data

        except Exception as e:
            self.log_result(name, False, None, str(e))
            return False, {}

    def test_root_endpoint(self):
        """Test API root"""
        success, response = self.run_test("API Root", "GET", "", 200)
        return success

    def test_get_barbers(self):
        """Test getting barbers list"""
        success, response = self.run_test("Get Barbers", "GET", "barbers", 200)
        if success and response:
            print(f"   Found {len(response)} barbers")
            if len(response) >= 4:
                print("   ✅ Expected 4 barbers found")
            else:
                print(f"   ⚠️  Expected 4 barbers, found {len(response)}")
        return success, response

    def test_time_slots_generation(self):
        """Test time slots for different days"""
        test_results = []
        
        # Test today (should work unless Tuesday)
        today = datetime.now().date()
        today_str = today.isoformat()
        
        success, response = self.run_test(f"Time Slots - Today ({today_str})", "GET", f"time-slots/{today_str}", 200)
        test_results.append(success)
        
        if success and response:
            slots = response.get('slots', [])
            print(f"   Found {len(slots)} time slots for today")
            if today.weekday() == 1:  # Tuesday
                if len(slots) == 0:
                    print("   ✅ Tuesday correctly shows no slots (closed)")
                else:
                    print("   ❌ Tuesday should be closed")
            elif today.weekday() == 6:  # Sunday
                if len(slots) > 40:  # 6AM-11PM with 20min slots
                    print("   ✅ Sunday shows extended hours (6AM-11PM)")
                else:
                    print(f"   ⚠️  Sunday might not show full hours: {len(slots)} slots")
            else:
                if len(slots) > 30:  # 9AM-11PM with 20min slots
                    print("   ✅ Regular day shows normal hours (9AM-11PM)")
                else:
                    print(f"   ⚠️  Regular day might not show full hours: {len(slots)} slots")

        # Test Sunday specifically
        next_sunday = today + timedelta(days=(6 - today.weekday()) % 7)
        if next_sunday == today and today.weekday() != 6:
            next_sunday += timedelta(days=7)
        
        sunday_str = next_sunday.isoformat()
        success, response = self.run_test(f"Time Slots - Sunday ({sunday_str})", "GET", f"time-slots/{sunday_str}", 200)
        test_results.append(success)
        
        # Test Tuesday (should be closed)
        next_tuesday = today + timedelta(days=(1 - today.weekday()) % 7)
        if next_tuesday == today and today.weekday() != 1:
            next_tuesday += timedelta(days=7)
        
        tuesday_str = next_tuesday.isoformat()
        success, response = self.run_test(f"Time Slots - Tuesday ({tuesday_str}) - Should be empty", "GET", f"time-slots/{tuesday_str}", 200)
        test_results.append(success)
        
        if success and response:
            slots = response.get('slots', [])
            if len(slots) == 0:
                print("   ✅ Tuesday correctly shows no slots (closed)")
            else:
                print(f"   ❌ Tuesday should be closed but shows {len(slots)} slots")

        return all(test_results)

    def test_create_token(self, barber_data):
        """Test token creation"""
        if not barber_data or len(barber_data) == 0:
            print("❌ No barbers available for token creation test")
            return False, None
        
        # Use tomorrow's date to ensure we have a fresh day
        tomorrow = (datetime.now() + timedelta(days=1)).date()
        tomorrow_str = tomorrow.isoformat()
        
        # Skip if tomorrow is Tuesday
        if tomorrow.weekday() == 1:
            tomorrow += timedelta(days=1)
            tomorrow_str = tomorrow.isoformat()

        barber = barber_data[0]
        
        token_data = {
            "customer_name": "Test Customer",
            "phone": "9876543210",
            "date": tomorrow_str,
            "time_slot": "10:00",
            "barber_id": barber['id'],
            "barber_name": barber['name'],
            "source": "online"
        }

        success, response = self.run_test("Create Token", "POST", "tokens", 200, token_data)
        
        if success and response:
            print(f"   Token created: #{response.get('token_number', 'N/A')}")
            print(f"   Token ID: {response.get('id', 'N/A')}")
            self.created_tokens.append(response)
            return True, response
        
        return False, None

    def test_get_tokens(self):
        """Test getting tokens"""
        tomorrow_str = (datetime.now() + timedelta(days=1)).date().isoformat()
        success, response = self.run_test("Get Tokens", "GET", f"tokens?date={tomorrow_str}", 200)
        
        if success and response:
            print(f"   Found {len(response)} tokens for tomorrow")
        
        return success, response

    def test_current_token(self):
        """Test current token endpoint"""
        tomorrow_str = (datetime.now() + timedelta(days=1)).date().isoformat()
        success, response = self.run_test("Get Current Token", "GET", f"tokens/current?date={tomorrow_str}", 200)
        return success, response

    def test_next_tokens(self):
        """Test next tokens endpoint"""
        tomorrow_str = (datetime.now() + timedelta(days=1)).date().isoformat()
        success, response = self.run_test("Get Next Tokens", "GET", f"tokens/next/{tomorrow_str}?limit=3", 200)
        
        if success and response:
            print(f"   Found {len(response)} next tokens")
        
        return success, response

    def test_analytics(self):
        """Test analytics endpoint"""
        tomorrow_str = (datetime.now() + timedelta(days=1)).date().isoformat()
        success, response = self.run_test("Get Analytics", "GET", f"analytics/{tomorrow_str}", 200)
        
        if success and response:
            print(f"   Analytics - Total: {response.get('total_tokens', 0)}, Waiting: {response.get('waiting', 0)}")
        
        return success, response

    def test_staff_controls(self):
        """Test staff control endpoints"""
        if not self.created_tokens:
            print("❌ No tokens available for staff control tests")
            return False
        
        token = self.created_tokens[0]
        tomorrow_str = (datetime.now() + timedelta(days=1)).date().isoformat()
        
        # Test next token
        success1, response1 = self.run_test("Staff - Call Next Token", "POST", f"staff/next-token/{tomorrow_str}", 200)
        
        # Test skip token
        success2, response2 = self.run_test("Staff - Skip Token", "POST", f"staff/skip-token/{token['id']}", 200)
        
        # Test recall token
        success3, response3 = self.run_test("Staff - Recall Token", "POST", f"staff/recall-token/{token['id']}", 200)
        
        return all([success1, success2, success3])

    def test_qr_code_generation(self):
        """Test QR code generation"""
        success, response = self.run_test("Generate QR Code", "GET", "qr-code", 200)
        
        if success and response:
            if 'qr_code' in response and 'booking_url' in response:
                print("   ✅ QR code data structure is correct")
                print(f"   Booking URL: {response['booking_url']}")
                return True
            else:
                print("   ❌ QR code response missing required fields")
                return False
        
        return False

def main():
    print("🏪 Starting Salon Token Booking System API Tests")
    print("=" * 60)
    
    tester = SalonAPITester()
    
    # Test sequence
    print("\n📡 Testing Basic API Connectivity...")
    tester.test_root_endpoint()
    
    print("\n👥 Testing Barber Management...")
    barber_success, barber_data = tester.test_get_barbers()
    
    print("\n⏰ Testing Time Slot Generation...")
    tester.test_time_slots_generation()
    
    print("\n🎫 Testing Token Operations...")
    if barber_success:
        token_success, token_data = tester.test_create_token(barber_data)
        tester.test_get_tokens()
        tester.test_current_token()
        tester.test_next_tokens()
    else:
        print("❌ Skipping token tests - no barbers available")
    
    print("\n📊 Testing Analytics...")
    tester.test_analytics()
    
    print("\n🎛️  Testing Staff Controls...")
    tester.test_staff_controls()
    
    print("\n📱 Testing QR Code Generation...")
    tester.test_qr_code_generation()
    
    # Summary
    print("\n" + "=" * 60)
    print(f"📊 TEST SUMMARY")
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 ALL TESTS PASSED!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} TESTS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())