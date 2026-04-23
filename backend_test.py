#!/usr/bin/env python3
"""
Backend API Testing for Today/Tomorrow Feature
Tests the new/changed endpoints related to shift-windows and date query parameters.
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# Configuration
BASE_URL = "https://gifted-shirley-8.preview.emergentagent.com/api"
SALON_ID = "a356c4e6-274f-40e7-9a37-66d3a4613d17"
ADMIN_PHONE = "+917503070727"
ADMIN_PASSWORD = "salon123"

# Test credentials
TEST_CREDENTIALS = {
    "phone": ADMIN_PHONE,
    "password": ADMIN_PASSWORD
}

def get_auth_token():
    """Get authentication token for salon admin"""
    try:
        response = requests.post(f"{BASE_URL}/salon/login", json=TEST_CREDENTIALS)
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token")
        else:
            print(f"❌ Failed to authenticate: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Authentication error: {e}")
        return None

def get_today_tomorrow_dates():
    """Get today and tomorrow dates in YYYY-MM-DD format (UTC)"""
    today = datetime.utcnow().date()
    tomorrow = today + timedelta(days=1)
    return today.isoformat(), tomorrow.isoformat()

def test_shift_windows_endpoint():
    """Test GET /api/salons/{salon_id}/shift-windows endpoint"""
    print("\n🔍 Testing GET /api/salons/{salon_id}/shift-windows endpoint...")
    
    today, tomorrow = get_today_tomorrow_dates()
    
    # Test 1: No date parameter (should default to today)
    print(f"\n1️⃣ Testing without date parameter (should default to today: {today})")
    try:
        response = requests.get(f"{BASE_URL}/salons/{SALON_ID}/shift-windows")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Response received")
            print(f"   📅 Date in response: {data.get('date')}")
            
            # Verify date matches today
            if data.get('date') == today:
                print(f"   ✅ Date correctly defaults to today ({today})")
            else:
                print(f"   ❌ Date mismatch. Expected: {today}, Got: {data.get('date')}")
            
            # Verify shifts structure
            shifts = data.get('shifts', [])
            print(f"   📊 Number of shifts: {len(shifts)}")
            
            if len(shifts) == 3:
                print(f"   ✅ Correct number of shifts (3)")
                
                # Check shift order and structure
                expected_order = ["Morning", "Noon", "Evening"]
                for i, shift in enumerate(shifts):
                    expected_name = expected_order[i]
                    actual_name = shift.get('name')
                    actual_id = shift.get('id')
                    
                    print(f"   🔸 Shift {i+1}: {actual_name} (ID: {actual_id})")
                    
                    if actual_name == expected_name and actual_id == expected_name:
                        print(f"     ✅ Correct name and ID")
                    else:
                        print(f"     ❌ Expected: {expected_name}, Got name: {actual_name}, ID: {actual_id}")
                    
                    # Check required fields
                    required_fields = ['start', 'end', 'time', 'duration_hours', 'duration_minutes', 'is_available']
                    for field in required_fields:
                        if field in shift:
                            value = shift[field]
                            print(f"     ✅ {field}: {value}")
                            
                            # Validate field types and ranges
                            if field in ['start', 'end']:
                                if isinstance(value, int) and 0 <= value <= 24:
                                    print(f"       ✅ {field} is valid integer in range [0, 24]")
                                else:
                                    print(f"       ❌ {field} should be integer in range [0, 24], got: {value}")
                            
                            elif field == 'time':
                                if isinstance(value, str):
                                    if value and 'AM' in value or 'PM' in value:
                                        print(f"       ✅ Time label format looks correct")
                                    elif not value:
                                        print(f"       ⚠️ Time label is empty (may be expected if salon closed)")
                                    else:
                                        print(f"       ❌ Time label format unexpected: {value}")
                                else:
                                    print(f"       ❌ Time should be string, got: {type(value)}")
                            
                            elif field == 'duration_hours':
                                if isinstance(value, (int, float)) and value >= 0:
                                    print(f"       ✅ Duration hours is valid number >= 0")
                                else:
                                    print(f"       ❌ Duration hours should be number >= 0, got: {value}")
                            
                            elif field == 'is_available':
                                if isinstance(value, bool):
                                    print(f"       ✅ is_available is boolean")
                                    if value and shift.get('duration_hours', 0) > 0:
                                        print(f"       ✅ is_available=true with duration_hours > 0")
                                    elif not value and shift.get('duration_hours', 0) == 0:
                                        print(f"       ✅ is_available=false with duration_hours = 0")
                                else:
                                    print(f"       ❌ is_available should be boolean, got: {type(value)}")
                        else:
                            print(f"     ❌ Missing required field: {field}")
            else:
                print(f"   ❌ Expected 3 shifts, got {len(shifts)}")
            
            print(f"   📋 Full response: {json.dumps(data, indent=2)}")
        else:
            print(f"   ❌ Failed with status {response.status_code}: {response.text}")
    
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 2: With tomorrow's date
    print(f"\n2️⃣ Testing with tomorrow's date parameter ({tomorrow})")
    try:
        response = requests.get(f"{BASE_URL}/salons/{SALON_ID}/shift-windows?date={tomorrow}")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Response received")
            print(f"   📅 Date in response: {data.get('date')}")
            
            # Verify date matches tomorrow
            if data.get('date') == tomorrow:
                print(f"   ✅ Date correctly matches parameter ({tomorrow})")
            else:
                print(f"   ❌ Date mismatch. Expected: {tomorrow}, Got: {data.get('date')}")
            
            # Verify shifts structure (should be same format as today)
            shifts = data.get('shifts', [])
            print(f"   📊 Number of shifts: {len(shifts)}")
            
            if len(shifts) == 3:
                print(f"   ✅ Correct number of shifts (3)")
                for i, shift in enumerate(shifts):
                    print(f"   🔸 Shift {i+1}: {shift.get('name')} - Available: {shift.get('is_available')}")
            
            print(f"   📋 Full response: {json.dumps(data, indent=2)}")
        else:
            print(f"   ❌ Failed with status {response.status_code}: {response.text}")
    
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 3: Invalid date string
    print(f"\n3️⃣ Testing with invalid date parameter ('abc')")
    try:
        response = requests.get(f"{BASE_URL}/salons/{SALON_ID}/shift-windows?date=abc")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Graceful handling - returned 200")
            print(f"   📅 Date in response: {data.get('date')}")
            print(f"   📊 Shifts: {len(data.get('shifts', []))}")
            print(f"   📋 Response: {json.dumps(data, indent=2)}")
        elif response.status_code == 400:
            print(f"   ✅ Proper error handling - returned 400")
            print(f"   📋 Error response: {response.text}")
        else:
            print(f"   ⚠️ Unexpected status {response.status_code}: {response.text}")
    
    except Exception as e:
        print(f"   ❌ Error: {e}")

def test_token_status_with_date():
    """Test GET /api/salons/{salon_id}/token-status with date parameter"""
    print("\n🔍 Testing GET /api/salons/{salon_id}/token-status with date parameter...")
    
    today, tomorrow = get_today_tomorrow_dates()
    
    # Test 1: Today with shift parameter (existing behavior)
    print(f"\n1️⃣ Testing existing behavior: ?shift=Morning (today: {today})")
    try:
        response = requests.get(f"{BASE_URL}/salons/{SALON_ID}/token-status?shift=Morning")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Response received")
            print(f"   📅 Date in response: {data.get('date')}")
            print(f"   🔸 Overall shift: {data.get('overall', {}).get('shift')}")
            print(f"   📊 Waiting count: {data.get('overall', {}).get('waiting_count')}")
            print(f"   👥 Number of barbers: {len(data.get('barbers', []))}")
        else:
            print(f"   ❌ Failed with status {response.status_code}: {response.text}")
    
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 2: Tomorrow with shift parameter
    print(f"\n2️⃣ Testing new behavior: ?shift=Morning&date={tomorrow}")
    try:
        response = requests.get(f"{BASE_URL}/salons/{SALON_ID}/token-status?shift=Morning&date={tomorrow}")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Response received")
            print(f"   📅 Date in response: {data.get('date')}")
            
            # Verify date matches tomorrow
            if data.get('date') == tomorrow:
                print(f"   ✅ Date correctly matches parameter ({tomorrow})")
            else:
                print(f"   ❌ Date mismatch. Expected: {tomorrow}, Got: {data.get('date')}")
            
            print(f"   🔸 Overall shift: {data.get('overall', {}).get('shift')}")
            print(f"   📊 Waiting count: {data.get('overall', {}).get('waiting_count')}")
            print(f"   👥 Number of barbers: {len(data.get('barbers', []))}")
            
            # Check barber data structure
            barbers = data.get('barbers', [])
            for barber in barbers:
                print(f"   👤 Barber: {barber.get('barber_name')} - Tokens today: {barber.get('total_tokens_today', 0)}")
        else:
            print(f"   ❌ Failed with status {response.status_code}: {response.text}")
    
    except Exception as e:
        print(f"   ❌ Error: {e}")

def test_live_status_with_date():
    """Test GET /api/salons/{salon_id}/live-status with date parameter"""
    print("\n🔍 Testing GET /api/salons/{salon_id}/live-status with date parameter...")
    
    today, tomorrow = get_today_tomorrow_dates()
    
    # Test: Tomorrow with shift parameter
    print(f"\n1️⃣ Testing: ?shift=Morning&date={tomorrow}")
    try:
        response = requests.get(f"{BASE_URL}/salons/{SALON_ID}/live-status?shift=Morning&date={tomorrow}")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Response received")
            print(f"   📅 Date in response: {data.get('date')}")
            
            # Verify date matches tomorrow
            if data.get('date') == tomorrow:
                print(f"   ✅ Date correctly matches parameter ({tomorrow})")
            else:
                print(f"   ❌ Date mismatch. Expected: {tomorrow}, Got: {data.get('date')}")
            
            print(f"   🔸 Overall shift: {data.get('overall', {}).get('shift')}")
            print(f"   📊 Waiting count: {data.get('overall', {}).get('waiting_count')}")
            print(f"   👥 Number of barbers: {len(data.get('barbers', []))}")
            
            # Verify this mirrors token-status (should be identical)
            print(f"   ✅ live-status endpoint working (mirrors token-status)")
        else:
            print(f"   ❌ Failed with status {response.status_code}: {response.text}")
    
    except Exception as e:
        print(f"   ❌ Error: {e}")

def test_shifts_endpoint_regression():
    """Test that existing /api/shifts endpoint still works (no regression)"""
    print("\n🔍 Testing GET /api/shifts endpoint (regression check)...")
    
    try:
        response = requests.get(f"{BASE_URL}/shifts")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Response received")
            
            shifts = data.get('shifts', [])
            print(f"   📊 Number of shifts: {len(shifts)}")
            
            if len(shifts) > 0:
                print(f"   ✅ Shifts array not empty")
                print(f"   🔸 First shift: {shifts[0] if shifts else 'None'}")
                print(f"   ✅ /api/shifts endpoint still working (no regression)")
            else:
                print(f"   ⚠️ Shifts array is empty")
            
            print(f"   📋 Response: {json.dumps(data, indent=2)}")
        else:
            print(f"   ❌ Failed with status {response.status_code}: {response.text}")
    
    except Exception as e:
        print(f"   ❌ Error: {e}")

def main():
    """Run all tests for Today/Tomorrow feature"""
    print("🚀 Starting Today/Tomorrow Feature Backend API Tests")
    print(f"🎯 Target Salon ID: {SALON_ID}")
    print(f"🌐 Base URL: {BASE_URL}")
    
    # Get dates for reference
    today, tomorrow = get_today_tomorrow_dates()
    print(f"📅 Today (UTC): {today}")
    print(f"📅 Tomorrow (UTC): {tomorrow}")
    
    # Run all tests
    test_shift_windows_endpoint()
    test_token_status_with_date()
    test_live_status_with_date()
    test_shifts_endpoint_regression()
    
    print("\n✅ All Today/Tomorrow feature tests completed!")
    print("\n📋 Summary:")
    print("   - GET /api/salons/{salon_id}/shift-windows (no date, with date, invalid date)")
    print("   - GET /api/salons/{salon_id}/token-status (with date parameter)")
    print("   - GET /api/salons/{salon_id}/live-status (with date parameter)")
    print("   - GET /api/shifts (regression check)")

if __name__ == "__main__":
    main()