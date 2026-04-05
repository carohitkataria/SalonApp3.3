#!/usr/bin/env python3
"""
Backend API Testing for Salon Booking App
Tests the specific endpoints mentioned in the review request:
1. GET /api/shifts
2. GET /api/salons/{salon_id}/live-status (or token-status)
3. GET /api/salons/{salon_id}/services/enabled
"""

import requests
import json
import sys
from datetime import datetime

# Backend URL from environment
BACKEND_URL = "https://booking-perf-fix-1.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"Testing: {test_name}")
    print(f"{'='*60}")

def print_result(endpoint, status_code, response_data, expected_fields=None):
    print(f"\nEndpoint: {endpoint}")
    print(f"Status Code: {status_code}")
    
    if status_code == 200:
        print("✅ Request successful")
        if expected_fields:
            print(f"Response structure check:")
            for field in expected_fields:
                if field in response_data:
                    print(f"  ✅ {field}: present")
                else:
                    print(f"  ❌ {field}: MISSING")
        
        # Print sample of response data
        if isinstance(response_data, dict):
            print(f"Response keys: {list(response_data.keys())}")
        elif isinstance(response_data, list) and len(response_data) > 0:
            print(f"Response is list with {len(response_data)} items")
            if isinstance(response_data[0], dict):
                print(f"First item keys: {list(response_data[0].keys())}")
    else:
        print(f"❌ Request failed")
        print(f"Response: {response_data}")

def test_shifts_endpoint():
    """Test GET /api/shifts endpoint"""
    print_test_header("GET /api/shifts")
    
    try:
        response = requests.get(f"{API_BASE}/shifts", timeout=10)
        data = response.json()
        
        expected_fields = ["shifts"]
        print_result("/api/shifts", response.status_code, data, expected_fields)
        
        if response.status_code == 200 and "shifts" in data:
            shifts = data["shifts"]
            print(f"\nShifts found: {len(shifts)}")
            for shift in shifts:
                if isinstance(shift, dict):
                    print(f"  - {shift.get('name', 'Unknown')}: {shift.get('time', 'No time')}")
                    # Check required fields
                    required_shift_fields = ["id", "name", "time"]
                    for field in required_shift_fields:
                        if field not in shift:
                            print(f"    ❌ Missing field: {field}")
                        else:
                            print(f"    ✅ {field}: {shift[field]}")
        
        return response.status_code == 200 and "shifts" in data
        
    except Exception as e:
        print(f"❌ Error testing shifts endpoint: {str(e)}")
        return False

def get_salon_id():
    """Get a valid salon ID from the database"""
    print_test_header("Getting Salon ID")
    
    try:
        response = requests.get(f"{API_BASE}/salons", timeout=10)
        data = response.json()
        
        if response.status_code == 200 and len(data) > 0:
            salon_id = data[0]["id"]
            salon_name = data[0].get("salon_name", "Unknown")
            print(f"✅ Found salon: {salon_name} (ID: {salon_id})")
            return salon_id
        else:
            print(f"❌ Failed to get salons: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ Error getting salon ID: {str(e)}")
        return None

def test_live_status_endpoint(salon_id):
    """Test GET /api/salons/{salon_id}/live-status endpoint"""
    print_test_header(f"GET /api/salons/{salon_id}/live-status")
    
    # First try the live-status endpoint as mentioned in review request
    try:
        response = requests.get(f"{API_BASE}/salons/{salon_id}/live-status", timeout=10)
        data = response.json()
        
        if response.status_code == 404:
            print("❌ /live-status endpoint not found, trying /token-status instead...")
            return test_token_status_endpoint(salon_id)
        
        expected_fields = ["overall", "barbers"]
        print_result(f"/api/salons/{salon_id}/live-status", response.status_code, data, expected_fields)
        
        if response.status_code == 200:
            return validate_live_status_response(data)
        
        return False
        
    except Exception as e:
        print(f"❌ Error testing live-status endpoint: {str(e)}")
        print("Trying /token-status endpoint instead...")
        return test_token_status_endpoint(salon_id)

def test_token_status_endpoint(salon_id):
    """Test GET /api/salons/{salon_id}/token-status endpoint (alternative to live-status)"""
    print_test_header(f"GET /api/salons/{salon_id}/token-status")
    
    try:
        response = requests.get(f"{API_BASE}/salons/{salon_id}/token-status", timeout=10)
        data = response.json()
        
        expected_fields = ["overall", "barbers"]
        print_result(f"/api/salons/{salon_id}/token-status", response.status_code, data, expected_fields)
        
        if response.status_code == 200:
            return validate_live_status_response(data)
        
        return False
        
    except Exception as e:
        print(f"❌ Error testing token-status endpoint: {str(e)}")
        return False

def validate_live_status_response(data):
    """Validate the structure of live-status/token-status response"""
    success = True
    
    # Check overall section
    if "overall" in data:
        overall = data["overall"]
        print(f"\n📊 Overall Status:")
        overall_fields = ["current_token", "waiting_count", "shift"]
        for field in overall_fields:
            if field in overall:
                print(f"  ✅ {field}: {overall[field]}")
            else:
                print(f"  ❌ {field}: MISSING")
                success = False
    else:
        print(f"❌ Missing 'overall' section")
        success = False
    
    # Check barbers section
    if "barbers" in data:
        barbers = data["barbers"]
        print(f"\n👨‍💼 Barbers ({len(barbers)} found):")
        
        required_barber_fields = [
            "barber_id", "barber_name", "category", "specialization",
            "current_token", "waiting_count", "total_tokens_today", "queue_status"
        ]
        
        for i, barber in enumerate(barbers):
            print(f"\n  Barber {i+1}: {barber.get('barber_name', 'Unknown')}")
            for field in required_barber_fields:
                if field in barber:
                    print(f"    ✅ {field}: {barber[field]}")
                    # Special check for total_tokens_today
                    if field == "total_tokens_today":
                        if isinstance(barber[field], int) and barber[field] >= 0:
                            print(f"      ✅ total_tokens_today is valid integer: {barber[field]}")
                        else:
                            print(f"      ❌ total_tokens_today should be non-negative integer")
                            success = False
                else:
                    print(f"    ❌ {field}: MISSING")
                    if field == "total_tokens_today":
                        print(f"      ❌ CRITICAL: total_tokens_today field is missing!")
                    success = False
    else:
        print(f"❌ Missing 'barbers' section")
        success = False
    
    return success

def test_salon_enabled_services(salon_id):
    """Test GET /api/salons/{salon_id}/services/enabled endpoint"""
    print_test_header(f"GET /api/salons/{salon_id}/services/enabled")
    
    try:
        response = requests.get(f"{API_BASE}/salons/{salon_id}/services/enabled", timeout=10)
        data = response.json()
        
        print_result(f"/api/salons/{salon_id}/services/enabled", response.status_code, data)
        
        if response.status_code == 200:
            if isinstance(data, list):
                print(f"\n💼 Enabled Services ({len(data)} found):")
                
                if len(data) == 0:
                    print("  ⚠️  No services enabled for this salon")
                    return True  # Empty list is valid
                
                # Check structure of services
                required_service_fields = ["id", "service_name", "base_price"]
                for i, service in enumerate(data[:3]):  # Check first 3 services
                    print(f"\n  Service {i+1}: {service.get('service_name', 'Unknown')}")
                    for field in required_service_fields:
                        if field in service:
                            print(f"    ✅ {field}: {service[field]}")
                        else:
                            print(f"    ❌ {field}: MISSING")
                
                if len(data) > 3:
                    print(f"  ... and {len(data) - 3} more services")
                
                return True
            else:
                print(f"❌ Expected array response, got: {type(data)}")
                return False
        
        return False
        
    except Exception as e:
        print(f"❌ Error testing enabled services endpoint: {str(e)}")
        return False

def run_all_tests():
    """Run all backend API tests"""
    print("🚀 Starting Backend API Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"API Base: {API_BASE}")
    
    results = {}
    
    # Test 1: Shifts endpoint
    results["shifts"] = test_shifts_endpoint()
    
    # Get salon ID for other tests
    salon_id = get_salon_id()
    if not salon_id:
        print("❌ Cannot continue tests without valid salon ID")
        return results
    
    # Test 2: Live status endpoint (with total_tokens_today)
    results["live_status"] = test_live_status_endpoint(salon_id)
    
    # Test 3: Salon enabled services
    results["enabled_services"] = test_salon_enabled_services(salon_id)
    
    # Summary
    print_test_header("TEST SUMMARY")
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All tests passed!")
    else:
        print("⚠️  Some tests failed - check details above")
    
    return results

if __name__ == "__main__":
    results = run_all_tests()
    
    # Exit with error code if any tests failed
    if not all(results.values()):
        sys.exit(1)
    else:
        sys.exit(0)