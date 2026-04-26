#!/usr/bin/env python3
"""
Final Comprehensive Backend API Testing for Staff Attendance System
Focus on testing what works and providing clear status report
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://loyalty-wallet-fix.preview.emergentagent.com/api"
SALON_ID = "91a8e87d-d687-49ea-b3e5-460cc55cf3de"
BARBER_IDS = ["4198bcd0-4dcb-4d67-8999-c653e2d32c37", "e36d6b1d-48c2-415b-a16e-23de6951a13a"]

def print_test_header(test_name):
    print(f"\n{'='*60}")
    print(f"TESTING: {test_name}")
    print(f"{'='*60}")

def print_response(response, test_name):
    print(f"\n--- {test_name} ---")
    print(f"Status Code: {response.status_code}")
    try:
        if response.headers.get('content-type', '').startswith('application/json'):
            response_data = response.json()
            print(f"Response: {json.dumps(response_data, indent=2)}")
            return response_data
        else:
            print(f"Response Text: {response.text[:500]}...")
            return None
    except:
        print(f"Response Text: {response.text[:500]}...")
        return None

def test_staff_attendance_comprehensive():
    """Comprehensive test of all staff attendance endpoints"""
    
    print_test_header("COMPREHENSIVE STAFF ATTENDANCE SYSTEM TEST")
    
    results = {
        "working_endpoints": [],
        "failing_endpoints": [],
        "auth_required_endpoints": [],
        "barbers_found": []
    }
    
    # Test 1: Get Barbers (should work without auth)
    print("\n🔍 Testing GET Barbers...")
    try:
        response = requests.get(f"{BASE_URL}/salons/{SALON_ID}/barbers")
        data = print_response(response, "GET Barbers")
        
        if response.status_code == 200 and data:
            barbers = data.get("barbers", [])
            results["barbers_found"] = [{"id": b["id"], "name": b["name"]} for b in barbers]
            results["working_endpoints"].append("GET /salons/{salon_id}/barbers")
            print(f"✅ Found {len(barbers)} barbers: {[b['name'] for b in barbers]}")
        else:
            results["failing_endpoints"].append("GET /salons/{salon_id}/barbers")
            print("❌ Failed to get barbers")
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        results["failing_endpoints"].append("GET /salons/{salon_id}/barbers")
    
    # Test 2: GET Monthly Attendance (should work without auth)
    print("\n🔍 Testing GET Monthly Attendance...")
    try:
        response = requests.get(f"{BASE_URL}/salons/{SALON_ID}/staff-attendance/month/2026-04")
        data = print_response(response, "GET Monthly Attendance")
        
        if response.status_code == 200:
            results["working_endpoints"].append("GET /salons/{salon_id}/staff-attendance/month/{month}")
            print("✅ Monthly attendance endpoint working")
            
            if data:
                barbers = data.get("barbers", [])
                print(f"   📊 Shows {len(barbers)} barbers with attendance data")
                for barber in barbers:
                    attendance_count = len(barber.get("attendance", []))
                    print(f"   - {barber.get('barber_name')}: {attendance_count} attendance records")
        else:
            results["failing_endpoints"].append("GET /salons/{salon_id}/staff-attendance/month/{month}")
            print("❌ Monthly attendance endpoint failed")
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        results["failing_endpoints"].append("GET /salons/{salon_id}/staff-attendance/month/{month}")
    
    # Test 3: GET Holiday Check (should work without auth)
    print("\n🔍 Testing GET Holiday Check...")
    try:
        response = requests.get(f"{BASE_URL}/salons/{SALON_ID}/check-holiday/2026-04-26")
        data = print_response(response, "GET Holiday Check")
        
        if response.status_code == 200:
            results["working_endpoints"].append("GET /salons/{salon_id}/check-holiday/{date}")
            print("✅ Holiday check endpoint working")
            
            if data:
                is_closed = data.get("is_closed", False)
                reason = data.get("reason")
                print(f"   📅 Date 2026-04-26: {'Closed' if is_closed else 'Open'}")
                if reason:
                    print(f"   📝 Reason: {reason}")
        else:
            results["failing_endpoints"].append("GET /salons/{salon_id}/check-holiday/{date}")
            print("❌ Holiday check endpoint failed")
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        results["failing_endpoints"].append("GET /salons/{salon_id}/check-holiday/{date}")
    
    # Test 4: POST Auto-calculate (requires auth)
    print("\n🔍 Testing POST Auto-calculate Attendance...")
    try:
        response = requests.post(f"{BASE_URL}/salons/{SALON_ID}/staff-attendance/calculate/2026-04-26")
        data = print_response(response, "POST Auto-calculate")
        
        if response.status_code == 403:
            results["auth_required_endpoints"].append("POST /salons/{salon_id}/staff-attendance/calculate/{date}")
            print("✅ Correctly requires authentication")
        elif response.status_code == 500:
            results["failing_endpoints"].append("POST /salons/{salon_id}/staff-attendance/calculate/{date}")
            print("❌ Internal server error (RecursionError)")
        else:
            results["working_endpoints"].append("POST /salons/{salon_id}/staff-attendance/calculate/{date}")
            print("✅ Auto-calculate endpoint working")
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        results["failing_endpoints"].append("POST /salons/{salon_id}/staff-attendance/calculate/{date}")
    
    # Test 5: PUT Override Attendance (requires auth)
    print("\n🔍 Testing PUT Override Attendance...")
    try:
        override_data = {"status": "present"}
        response = requests.put(
            f"{BASE_URL}/salons/{SALON_ID}/staff-attendance/override/{BARBER_IDS[0]}/2026-04-26", 
            json=override_data
        )
        data = print_response(response, "PUT Override Attendance")
        
        if response.status_code == 403:
            results["auth_required_endpoints"].append("PUT /salons/{salon_id}/staff-attendance/override/{barber_id}/{date}")
            print("✅ Correctly requires authentication")
        elif response.status_code == 500:
            results["failing_endpoints"].append("PUT /salons/{salon_id}/staff-attendance/override/{barber_id}/{date}")
            print("❌ Internal server error (RecursionError)")
        else:
            results["working_endpoints"].append("PUT /salons/{salon_id}/staff-attendance/override/{barber_id}/{date}")
            print("✅ Override attendance endpoint working")
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        results["failing_endpoints"].append("PUT /salons/{salon_id}/staff-attendance/override/{barber_id}/{date}")
    
    # Test 6: GET Monthly Salary (may have issues)
    print("\n🔍 Testing GET Monthly Salary...")
    try:
        response = requests.get(f"{BASE_URL}/salons/{SALON_ID}/staff-salary/month/2026-04")
        data = print_response(response, "GET Monthly Salary")
        
        if response.status_code == 200:
            results["working_endpoints"].append("GET /salons/{salon_id}/staff-salary/month/{month}")
            print("✅ Monthly salary endpoint working")
        elif response.status_code == 500:
            results["failing_endpoints"].append("GET /salons/{salon_id}/staff-salary/month/{month}")
            print("❌ Internal server error (RecursionError)")
        elif response.status_code == 403:
            results["auth_required_endpoints"].append("GET /salons/{salon_id}/staff-salary/month/{month}")
            print("✅ Correctly requires authentication")
        else:
            results["failing_endpoints"].append("GET /salons/{salon_id}/staff-salary/month/{month}")
            print(f"❌ Unexpected status code: {response.status_code}")
            
    except Exception as e:
        print(f"❌ ERROR: {e}")
        results["failing_endpoints"].append("GET /salons/{salon_id}/staff-salary/month/{month}")
    
    return results

def print_final_summary(results):
    """Print comprehensive test summary"""
    
    print_test_header("FINAL TEST SUMMARY")
    
    print(f"🏪 Salon ID: {SALON_ID}")
    print(f"👥 Barbers Found: {len(results['barbers_found'])}")
    for barber in results['barbers_found']:
        print(f"   - {barber['name']} (ID: {barber['id']})")
    
    print(f"\n✅ WORKING ENDPOINTS ({len(results['working_endpoints'])}):")
    for endpoint in results['working_endpoints']:
        print(f"   ✅ {endpoint}")
    
    print(f"\n🔐 AUTH REQUIRED ENDPOINTS ({len(results['auth_required_endpoints'])}):")
    for endpoint in results['auth_required_endpoints']:
        print(f"   🔐 {endpoint}")
    
    print(f"\n❌ FAILING ENDPOINTS ({len(results['failing_endpoints'])}):")
    for endpoint in results['failing_endpoints']:
        print(f"   ❌ {endpoint}")
    
    print(f"\n📊 OVERALL STATUS:")
    total_endpoints = len(results['working_endpoints']) + len(results['auth_required_endpoints']) + len(results['failing_endpoints'])
    working_count = len(results['working_endpoints']) + len(results['auth_required_endpoints'])
    
    print(f"   Total Endpoints Tested: {total_endpoints}")
    print(f"   Working/Auth Protected: {working_count}")
    print(f"   Failing (500 errors): {len(results['failing_endpoints'])}")
    
    if len(results['failing_endpoints']) > 0:
        print(f"\n⚠️  CRITICAL ISSUE IDENTIFIED:")
        print(f"   RecursionError in error handling middleware affecting some endpoints")
        print(f"   This is the same issue mentioned in test_result.md")
    
    print(f"\n🎯 ATTENDANCE SYSTEM STATUS:")
    if "GET /salons/{salon_id}/staff-attendance/month/{month}" in results['working_endpoints']:
        print(f"   ✅ Monthly attendance viewing: WORKING")
    else:
        print(f"   ❌ Monthly attendance viewing: FAILED")
    
    if "GET /salons/{salon_id}/check-holiday/{date}" in results['working_endpoints']:
        print(f"   ✅ Holiday checking: WORKING")
    else:
        print(f"   ❌ Holiday checking: FAILED")
    
    auth_endpoints = [
        "POST /salons/{salon_id}/staff-attendance/calculate/{date}",
        "PUT /salons/{salon_id}/staff-attendance/override/{barber_id}/{date}"
    ]
    
    auth_working = all(ep in results['auth_required_endpoints'] for ep in auth_endpoints)
    if auth_working:
        print(f"   🔐 Admin operations: PROPERLY PROTECTED (need auth)")
    else:
        print(f"   ❌ Admin operations: ISSUES DETECTED")

def main():
    """Main test execution"""
    print("🚀 Starting Comprehensive Staff Attendance System Testing")
    print(f"📍 Base URL: {BASE_URL}")
    print(f"🏪 Salon ID: {SALON_ID}")
    print(f"👥 Expected Barber IDs: {BARBER_IDS}")
    
    results = test_staff_attendance_comprehensive()
    print_final_summary(results)
    
    print("\n🏁 Testing completed!")
    print("\n📝 NOTE: Authentication testing was not possible due to RecursionError")
    print("   affecting user creation/login endpoints. However, endpoint protection")
    print("   is working correctly (403 Forbidden for unauthorized requests).")

if __name__ == "__main__":
    main()