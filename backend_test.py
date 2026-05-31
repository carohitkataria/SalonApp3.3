#!/usr/bin/env python3
"""
Backend API Testing for SalonHub - CSV Service Uploader Test
Tests the CSV Service Uploader endpoints with additive upload requirements.
"""

import requests
import json
import io
import random
import string
from pymongo import MongoClient
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')

# Configuration
BACKEND_URL = os.getenv('BACKEND_PUBLIC_URL', 'https://login-builder-10.preview.emergentagent.com')
API_BASE = f"{BACKEND_URL}/api"
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.getenv('DB_NAME', 'salon_app')

# MongoDB connection
mongo_client = MongoClient(MONGO_URL)
db = mongo_client[DB_NAME]

print("=" * 80)
print("CSV SERVICE UPLOADER TEST")
print("=" * 80)
print(f"Backend URL: {BACKEND_URL}")
print(f"MongoDB: {MONGO_URL}/{DB_NAME}")
print("=" * 80)

# Test counters
tests_passed = 0
tests_failed = 0
critical_issues = []

def test_result(test_name, passed, details=""):
    """Record test result"""
    global tests_passed, tests_failed
    if passed:
        tests_passed += 1
        print(f"✅ PASS: {test_name}")
        if details:
            print(f"   {details}")
    else:
        tests_failed += 1
        print(f"❌ FAIL: {test_name}")
        if details:
            print(f"   {details}")
        critical_issues.append(f"{test_name}: {details}")

def generate_random_suffix():
    """Generate random suffix for unique service names"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

# ============================================================================
# STEP 0: Admin Login
# ============================================================================
print("\n" + "=" * 80)
print("STEP 0: Admin Login")
print("=" * 80)

access_token = None
salon_id = None

try:
    # Try login with identifier "admin"
    login_payload = {
        "identifier": "admin",
        "password": "salon123"
    }
    response = requests.post(f"{API_BASE}/salon/users/login", json=login_payload, timeout=10)
    print(f"Login Status Code: {response.status_code}")
    
    if response.status_code == 200:
        resp_json = response.json()
        access_token = resp_json.get('access_token')
        salon_id = resp_json.get('salon_id')
        print(f"✅ Login successful")
        print(f"   Access Token: {access_token[:20]}...")
        print(f"   Salon ID: {salon_id}")
        test_result("Admin Login", True, f"Salon ID: {salon_id}")
    else:
        # Try alternative login with phone
        print(f"First login attempt failed, trying with phone...")
        login_payload = {
            "identifier": "+917503070727",
            "password": "salon123"
        }
        response = requests.post(f"{API_BASE}/salon/users/login", json=login_payload, timeout=10)
        print(f"Login Status Code: {response.status_code}")
        
        if response.status_code == 200:
            resp_json = response.json()
            access_token = resp_json.get('access_token')
            salon_id = resp_json.get('salon_id')
            print(f"✅ Login successful with phone")
            print(f"   Access Token: {access_token[:20]}...")
            print(f"   Salon ID: {salon_id}")
            test_result("Admin Login", True, f"Salon ID: {salon_id}")
        else:
            print(f"Response: {response.text}")
            test_result("Admin Login", False, f"Status {response.status_code}: {response.text}")
            print("\n❌ Cannot proceed without authentication. Exiting.")
            exit(1)
except Exception as e:
    test_result("Admin Login", False, f"Exception: {str(e)}")
    print("\n❌ Cannot proceed without authentication. Exiting.")
    exit(1)

if not access_token or not salon_id:
    print("\n❌ Missing access_token or salon_id. Exiting.")
    exit(1)

headers = {"Authorization": f"Bearer {access_token}"}

# ============================================================================
# TEST 1: CSV Template Download
# ============================================================================
print("\n" + "=" * 80)
print("TEST 1: CSV Template Download")
print("=" * 80)

try:
    response = requests.get(f"{API_BASE}/salons/{salon_id}/services/csv-template", timeout=10)
    print(f"Status Code: {response.status_code}")
    print(f"Content-Type: {response.headers.get('Content-Type')}")
    
    if response.status_code == 200:
        test_result("Template - HTTP 200", True)
        
        # Check Content-Type
        content_type = response.headers.get('Content-Type', '')
        if 'text/csv' in content_type:
            test_result("Template - Content-Type is text/csv", True, f"Content-Type: {content_type}")
        else:
            test_result("Template - Content-Type is text/csv", False, f"Got: {content_type}")
        
        # Check header row contains service_name
        csv_content = response.text
        lines = csv_content.strip().split('\n')
        if lines:
            header_row = lines[0].lower()
            print(f"Header row: {lines[0]}")
            
            if 'service_name' in header_row:
                test_result("Template - Header contains service_name", True)
            else:
                test_result("Template - Header contains service_name", False, f"Header: {lines[0]}")
            
            # Check for other expected columns
            expected_columns = ['description', 'category', 'gender_tag', 'default_duration', 
                              'base_price', 'price_type', 'is_favorite', 'available_at_home', 
                              'thumbnail_url', 'images']
            missing_columns = [col for col in expected_columns if col not in header_row]
            
            if not missing_columns:
                test_result("Template - All expected columns present", True, 
                          f"Found all {len(expected_columns)} columns")
            else:
                test_result("Template - All expected columns present", False, 
                          f"Missing: {', '.join(missing_columns)}")
        else:
            test_result("Template - Has content", False, "Empty response")
    else:
        test_result("Template - HTTP 200", False, f"Got {response.status_code}: {response.text}")
except Exception as e:
    test_result("Template Download", False, f"Exception: {str(e)}")

# ============================================================================
# TEST 2: Upload Valid New Services (Additive)
# ============================================================================
print("\n" + "=" * 80)
print("TEST 2: Upload Valid New Services (Additive)")
print("=" * 80)

# Generate unique service names with random suffix
rand_suffix = generate_random_suffix()
service_names = [
    f"QA Haircut {rand_suffix}",
    f"QA Spa {rand_suffix}",
    f"QA Shave {rand_suffix}"
]

print(f"Creating CSV with 3 unique services (suffix: {rand_suffix})")
print(f"Service names: {service_names}")

# Create CSV content
csv_content = "service_name,description,category,gender_tag,default_duration,base_price,price_type,is_favorite,available_at_home,thumbnail_url,images\n"
csv_content += f"{service_names[0]},Professional haircut and styling,Hair,Men,30,250,fixed,false,false,,\n"
csv_content += f"{service_names[1]},Relaxing spa treatment,Spa,Unisex,45,600,onwards,true,true,,\n"
csv_content += f"{service_names[2]},Clean shave with hot towel,Grooming,Men,20,150,fixed,false,false,,\n"

try:
    # Upload CSV
    files = {'file': ('services.csv', csv_content, 'text/csv')}
    response = requests.post(
        f"{API_BASE}/salons/{salon_id}/services/upload-csv",
        files=files,
        headers=headers,
        timeout=10
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    if response.status_code == 200:
        resp_json = response.json()
        
        # Check success field
        if resp_json.get('success') == True:
            test_result("Upload - success=true", True)
        else:
            test_result("Upload - success=true", False, f"Got: {resp_json.get('success')}")
        
        # Check created count
        created = resp_json.get('created', 0)
        if created == 3:
            test_result("Upload - created=3", True, f"Created: {created}")
        else:
            test_result("Upload - created=3", False, f"Expected 3, got {created}")
        
        # Check skipped_duplicates
        skipped = resp_json.get('skipped_duplicates', -1)
        if skipped == 0:
            test_result("Upload - skipped_duplicates=0", True)
        else:
            test_result("Upload - skipped_duplicates=0", False, f"Got: {skipped}")
        
        # Check errors array is empty
        errors = resp_json.get('errors', None)
        if errors is not None and len(errors) == 0:
            test_result("Upload - errors=[] (empty)", True)
        else:
            test_result("Upload - errors=[] (empty)", False, f"Got: {errors}")
        
        # Check total_rows
        total_rows = resp_json.get('total_rows', 0)
        if total_rows == 3:
            test_result("Upload - total_rows=3", True)
        else:
            test_result("Upload - total_rows=3", False, f"Got: {total_rows}")
        
        # Verify services appear in enabled services list
        print("\nVerifying services in enabled list...")
        enabled_response = requests.get(
            f"{API_BASE}/salons/{salon_id}/services/enabled",
            timeout=10
        )
        
        if enabled_response.status_code == 200:
            enabled_services = enabled_response.json()
            enabled_names = [s.get('service_name', '') for s in enabled_services]
            
            print(f"Total enabled services: {len(enabled_services)}")
            print(f"Looking for: {service_names}")
            
            all_found = all(name in enabled_names for name in service_names)
            
            if all_found:
                test_result("Upload - Services appear in enabled list", True, 
                          f"All 3 services found in enabled list")
            else:
                missing = [name for name in service_names if name not in enabled_names]
                test_result("Upload - Services appear in enabled list", False, 
                          f"Missing: {missing}")
        else:
            test_result("Upload - Check enabled services", False, 
                      f"Enabled endpoint returned {enabled_response.status_code}")
    else:
        test_result("Upload - HTTP 200", False, f"Got {response.status_code}: {response.text}")
except Exception as e:
    test_result("Upload Valid Services", False, f"Exception: {str(e)}")

# ============================================================================
# TEST 3: Re-upload Same CSV (Must NOT Duplicate)
# ============================================================================
print("\n" + "=" * 80)
print("TEST 3: Re-upload Same CSV (Must NOT Duplicate)")
print("=" * 80)

print(f"Re-uploading the EXACT same CSV with services: {service_names}")

try:
    # Upload the same CSV again
    files = {'file': ('services.csv', csv_content, 'text/csv')}
    response = requests.post(
        f"{API_BASE}/salons/{salon_id}/services/upload-csv",
        files=files,
        headers=headers,
        timeout=10
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    if response.status_code == 200:
        resp_json = response.json()
        
        # Check created count is 0
        created = resp_json.get('created', -1)
        if created == 0:
            test_result("Re-upload - created=0", True, "No new services created (correct)")
        else:
            test_result("Re-upload - created=0", False, f"Expected 0, got {created}")
        
        # Check skipped_duplicates is 3
        skipped = resp_json.get('skipped_duplicates', 0)
        if skipped == 3:
            test_result("Re-upload - skipped_duplicates=3", True, "All 3 services skipped as duplicates")
        else:
            test_result("Re-upload - skipped_duplicates=3", False, f"Expected 3, got {skipped}")
        
        # Verify services appear EXACTLY ONCE in enabled list
        print("\nVerifying services appear EXACTLY ONCE...")
        enabled_response = requests.get(
            f"{API_BASE}/salons/{salon_id}/services/enabled",
            timeout=10
        )
        
        if enabled_response.status_code == 200:
            enabled_services = enabled_response.json()
            
            # Count occurrences of each service name
            for service_name in service_names:
                count = sum(1 for s in enabled_services if s.get('service_name') == service_name)
                
                if count == 1:
                    test_result(f"Re-upload - '{service_name}' appears exactly once", True)
                else:
                    test_result(f"Re-upload - '{service_name}' appears exactly once", False, 
                              f"Found {count} occurrences")
        else:
            test_result("Re-upload - Check enabled services", False, 
                      f"Enabled endpoint returned {enabled_response.status_code}")
    else:
        test_result("Re-upload - HTTP 200", False, f"Got {response.status_code}: {response.text}")
except Exception as e:
    test_result("Re-upload Same CSV", False, f"Exception: {str(e)}")

# ============================================================================
# TEST 4: Row-Level Error Handling
# ============================================================================
print("\n" + "=" * 80)
print("TEST 4: Row-Level Error Handling")
print("=" * 80)

# Create CSV with one row missing service_name and one valid row
rand_suffix2 = generate_random_suffix()
valid_service_name = f"QA Valid Service {rand_suffix2}"

print(f"Creating CSV with 1 invalid row (empty service_name) and 1 valid row")
print(f"Valid service name: {valid_service_name}")

csv_error_content = "service_name,description,category,gender_tag,default_duration,base_price,price_type,is_favorite,available_at_home,thumbnail_url,images\n"
csv_error_content += ",This row has no service name,Hair,Men,30,250,fixed,false,false,,\n"  # Empty service_name
csv_error_content += f"{valid_service_name},Valid service with all fields,Spa,Women,40,500,fixed,false,false,,\n"

try:
    files = {'file': ('services_error.csv', csv_error_content, 'text/csv')}
    response = requests.post(
        f"{API_BASE}/salons/{salon_id}/services/upload-csv",
        files=files,
        headers=headers,
        timeout=10
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    if response.status_code == 200:
        resp_json = response.json()
        
        # Check created count is 1
        created = resp_json.get('created', 0)
        if created == 1:
            test_result("Error handling - created=1", True, "Valid row was created")
        else:
            test_result("Error handling - created=1", False, f"Expected 1, got {created}")
        
        # Check errors array is non-empty
        errors = resp_json.get('errors', [])
        if len(errors) > 0:
            test_result("Error handling - errors is non-empty", True, f"Found {len(errors)} error(s)")
            
            # Check error contains row number and reason
            error = errors[0]
            if 'row' in error and 'reason' in error:
                test_result("Error handling - error has row and reason", True, 
                          f"Row: {error['row']}, Reason: {error['reason']}")
                
                # Check reason mentions missing service_name
                if 'service_name' in error['reason'].lower():
                    test_result("Error handling - reason mentions service_name", True, 
                              f"Reason: {error['reason']}")
                else:
                    test_result("Error handling - reason mentions service_name", False, 
                              f"Reason: {error['reason']}")
            else:
                test_result("Error handling - error has row and reason", False, 
                          f"Error structure: {error}")
        else:
            test_result("Error handling - errors is non-empty", False, "errors array is empty")
        
        # Verify valid service was created
        print("\nVerifying valid service was created...")
        enabled_response = requests.get(
            f"{API_BASE}/salons/{salon_id}/services/enabled",
            timeout=10
        )
        
        if enabled_response.status_code == 200:
            enabled_services = enabled_response.json()
            enabled_names = [s.get('service_name', '') for s in enabled_services]
            
            if valid_service_name in enabled_names:
                test_result("Error handling - Valid service created", True, 
                          f"'{valid_service_name}' found in enabled list")
            else:
                test_result("Error handling - Valid service created", False, 
                          f"'{valid_service_name}' not found")
        else:
            test_result("Error handling - Check enabled services", False, 
                      f"Enabled endpoint returned {enabled_response.status_code}")
    else:
        test_result("Error handling - HTTP 200", False, f"Got {response.status_code}: {response.text}")
except Exception as e:
    test_result("Row-Level Error Handling", False, f"Exception: {str(e)}")

# ============================================================================
# TEST 5: Auth Required
# ============================================================================
print("\n" + "=" * 80)
print("TEST 5: Auth Required")
print("=" * 80)

print("Attempting upload WITHOUT Authorization header...")

csv_auth_test = "service_name,description,category,gender_tag,default_duration,base_price,price_type,is_favorite,available_at_home,thumbnail_url,images\n"
csv_auth_test += "Test Service,Test description,Hair,Men,30,250,fixed,false,false,,\n"

try:
    files = {'file': ('services_auth.csv', csv_auth_test, 'text/csv')}
    response = requests.post(
        f"{API_BASE}/salons/{salon_id}/services/upload-csv",
        files=files,
        # NO headers with Authorization
        timeout=10
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:200]}")
    
    # Should return 401 or 403
    if response.status_code in [401, 403]:
        test_result("Auth - Returns 401 or 403 without token", True, 
                  f"Got {response.status_code} (correct)")
    else:
        test_result("Auth - Returns 401 or 403 without token", False, 
                  f"Expected 401/403, got {response.status_code}")
except Exception as e:
    test_result("Auth Required", False, f"Exception: {str(e)}")

# ============================================================================
# Summary
# ============================================================================
print("\n" + "=" * 80)
print("TEST SUMMARY")
print("=" * 80)
print(f"Total Tests: {tests_passed + tests_failed}")
print(f"✅ Passed: {tests_passed}")
print(f"❌ Failed: {tests_failed}")

if critical_issues:
    print("\n🚨 CRITICAL ISSUES:")
    for issue in critical_issues:
        print(f"  - {issue}")
else:
    print("\n✅ ALL TESTS PASSED - NO CRITICAL ISSUES")

print("=" * 80)

# Exit with appropriate code
exit(0 if tests_failed == 0 else 1)
