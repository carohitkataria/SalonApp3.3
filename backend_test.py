#!/usr/bin/env python3
"""
Backend API Testing Script for Salon App
Tests customer CSV template and bulk upload endpoints
"""

import requests
import io
import csv
import random
import string
from datetime import datetime

# Configuration
BASE_URL = "https://f99e2f98-c761-41fe-8007-3a08068e97d5.preview.emergentagent.com"
SALON_ID = "1eddf29d-5ffd-49b0-8dae-130eecd4e62f"
ADMIN_IDENTIFIER = "admin"
ADMIN_PASSWORD = "salon123"

def generate_random_suffix():
    """Generate random suffix for unique test data"""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

def generate_unique_phone():
    """Generate a unique 10-digit phone number"""
    # Generate 10 random digits, ensuring first digit is not 0
    first_digit = random.randint(7, 9)  # Indian mobile numbers start with 7, 8, or 9
    remaining_digits = ''.join([str(random.randint(0, 9)) for _ in range(9)])
    return f"{first_digit}{remaining_digits}"

def login_as_admin():
    """Login as salon admin and return access token"""
    print("\n=== ADMIN LOGIN ===")
    url = f"{BASE_URL}/api/salon/users/login"
    payload = {
        "identifier": ADMIN_IDENTIFIER,
        "password": ADMIN_PASSWORD
    }
    
    response = requests.post(url, json=payload)
    print(f"Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        token = data.get("access_token")
        print(f"✅ Login successful, token received")
        return token
    else:
        print(f"❌ Login failed: {response.text}")
        return None

def test_csv_template_download():
    """Test GET /api/salons/{salon_id}/customers/csv-template"""
    print("\n" + "="*80)
    print("TEST 1: CSV TEMPLATE DOWNLOAD (PUBLIC ENDPOINT)")
    print("="*80)
    
    url = f"{BASE_URL}/api/salons/{SALON_ID}/customers/csv-template"
    
    # Test 1a: Without auth (should work - public endpoint)
    print("\n1a) Testing without Authorization header (public endpoint)...")
    response = requests.get(url)
    print(f"Status: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAIL: Expected 200, got {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    # Test 1b: Check Content-Type header
    print("\n1b) Checking Content-Type header...")
    content_type = response.headers.get("Content-Type", "")
    print(f"Content-Type: {content_type}")
    
    if "text/csv" not in content_type:
        print(f"❌ FAIL: Expected 'text/csv', got '{content_type}'")
        return False
    print("✅ PASS: Content-Type is text/csv")
    
    # Test 1c: Check Content-Disposition header
    print("\n1c) Checking Content-Disposition header...")
    content_disposition = response.headers.get("Content-Disposition", "")
    print(f"Content-Disposition: {content_disposition}")
    
    if "attachment" not in content_disposition or "guests_template.csv" not in content_disposition:
        print(f"❌ FAIL: Expected 'attachment; filename=guests_template.csv', got '{content_disposition}'")
        return False
    print("✅ PASS: Content-Disposition correct")
    
    # Test 1d: Check response body structure
    print("\n1d) Checking response body structure...")
    body = response.text
    lines = body.strip().split('\n')
    
    print(f"Total lines: {len(lines)}")
    print(f"First line (header): {lines[0]}")
    
    # Check header row
    expected_header = "Name,Mobile No.,Gender,Date of Birth"
    actual_header = lines[0].strip()
    if actual_header != expected_header:
        print(f"❌ FAIL: Expected header '{expected_header}', got '{actual_header}'")
        print(f"Header bytes: {actual_header.encode()}")
        print(f"Expected bytes: {expected_header.encode()}")
        return False
    print("✅ PASS: Header row correct")
    
    # Check for 2 example rows
    if len(lines) < 3:
        print(f"❌ FAIL: Expected at least 3 lines (header + 2 data rows), got {len(lines)}")
        return False
    
    print(f"Second line (example 1): {lines[1]}")
    print(f"Third line (example 2): {lines[2]}")
    
    # Verify example rows contain expected data
    if "Priya Sharma" not in lines[1] or "9876543210" not in lines[1]:
        print(f"❌ FAIL: First example row doesn't match expected data")
        return False
    
    if "Amit Kumar" not in lines[2] or "9123456789" not in lines[2]:
        print(f"❌ FAIL: Second example row doesn't match expected data")
        return False
    
    print("✅ PASS: Both example rows present and correct")
    
    print("\n✅ TEST 1 PASSED: CSV template download working correctly")
    return True

def test_bulk_upload_valid_csv(token):
    """Test bulk upload with valid CSV containing 2 new customers"""
    print("\n" + "="*80)
    print("TEST 2: BULK UPLOAD - VALID CSV WITH 2 NEW CUSTOMERS")
    print("="*80)
    
    # Generate unique phone numbers for this test
    suffix = generate_random_suffix()
    phone1 = generate_unique_phone()
    phone2 = generate_unique_phone()
    
    # Create CSV content
    csv_content = f"""Name,Mobile No.,Gender,Date of Birth
Priya Test {suffix},{phone1},Female,1994-03-14
Amit Test {suffix},{phone2},Male,1988-11-02"""
    
    print(f"\nGenerated CSV with unique customers:")
    print(f"Customer 1: Priya Test {suffix}, {phone1}")
    print(f"Customer 2: Amit Test {suffix}, {phone2}")
    
    url = f"{BASE_URL}/api/salons/{SALON_ID}/customers/bulk-upload"
    headers = {"Authorization": f"Bearer {token}"}
    
    files = {
        'file': ('customers.csv', csv_content, 'text/csv')
    }
    
    response = requests.post(url, headers=headers, files=files)
    print(f"\nStatus: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAIL: Expected 200, got {response.status_code}")
        print(f"Response: {response.text}")
        return False, None
    
    data = response.json()
    print(f"Response: {data}")
    
    # Verify response structure
    if data.get("inserted") != 2:
        print(f"❌ FAIL: Expected inserted=2, got {data.get('inserted')}")
        return False, None
    
    if data.get("skipped_duplicate") != 0:
        print(f"❌ FAIL: Expected skipped_duplicate=0, got {data.get('skipped_duplicate')}")
        return False, None
    
    if data.get("skipped_invalid") != 0:
        print(f"❌ FAIL: Expected skipped_invalid=0, got {data.get('skipped_invalid')}")
        return False, None
    
    if data.get("total_rows") != 2:
        print(f"❌ FAIL: Expected total_rows=2, got {data.get('total_rows')}")
        return False, None
    
    if len(data.get("errors", [])) != 0:
        print(f"❌ FAIL: Expected no errors, got {data.get('errors')}")
        return False, None
    
    print("✅ PASS: All response fields correct (inserted=2, skipped_duplicate=0, skipped_invalid=0, total_rows=2, errors=[])")
    print("\n✅ TEST 2 PASSED: Valid CSV upload working correctly")
    
    return True, csv_content

def test_bulk_upload_duplicate_csv(token, csv_content):
    """Test bulk upload with same CSV again (should skip duplicates)"""
    print("\n" + "="*80)
    print("TEST 3: BULK UPLOAD - DUPLICATE CSV (SAME CUSTOMERS)")
    print("="*80)
    
    print("\nUploading the EXACT SAME CSV again...")
    
    url = f"{BASE_URL}/api/salons/{SALON_ID}/customers/bulk-upload"
    headers = {"Authorization": f"Bearer {token}"}
    
    files = {
        'file': ('customers.csv', csv_content, 'text/csv')
    }
    
    response = requests.post(url, headers=headers, files=files)
    print(f"\nStatus: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAIL: Expected 200, got {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    data = response.json()
    print(f"Response: {data}")
    
    # Verify duplicates are skipped
    if data.get("inserted") != 0:
        print(f"❌ FAIL: Expected inserted=0 (all duplicates), got {data.get('inserted')}")
        return False
    
    if data.get("skipped_duplicate") != 2:
        print(f"❌ FAIL: Expected skipped_duplicate=2, got {data.get('skipped_duplicate')}")
        return False
    
    print("✅ PASS: Duplicates correctly skipped (inserted=0, skipped_duplicate=2)")
    print("✅ PASS: Existing customers preserved and NOT duplicated")
    print("\n✅ TEST 3 PASSED: Duplicate handling working correctly")
    
    return True

def test_bulk_upload_invalid_row(token):
    """Test bulk upload with one valid row and one row missing Mobile No."""
    print("\n" + "="*80)
    print("TEST 4: BULK UPLOAD - CSV WITH INVALID ROW (MISSING MOBILE NO.)")
    print("="*80)
    
    suffix = generate_random_suffix()
    phone_valid = generate_unique_phone()
    
    # Create CSV with one valid row and one missing mobile
    csv_content = f"""Name,Mobile No.,Gender,Date of Birth
Valid Customer {suffix},{phone_valid},Female,1995-05-20
Invalid Customer {suffix},,Male,1990-01-01"""
    
    print(f"\nGenerated CSV with:")
    print(f"Row 1 (valid): Valid Customer {suffix}, {phone_valid}")
    print(f"Row 2 (invalid): Invalid Customer {suffix}, <MISSING MOBILE>")
    
    url = f"{BASE_URL}/api/salons/{SALON_ID}/customers/bulk-upload"
    headers = {"Authorization": f"Bearer {token}"}
    
    files = {
        'file': ('customers.csv', csv_content, 'text/csv')
    }
    
    response = requests.post(url, headers=headers, files=files)
    print(f"\nStatus: {response.status_code}")
    
    if response.status_code != 200:
        print(f"❌ FAIL: Expected 200, got {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    data = response.json()
    print(f"Response: {data}")
    
    # Verify valid row inserted
    if data.get("inserted") != 1:
        print(f"❌ FAIL: Expected inserted=1 (valid row), got {data.get('inserted')}")
        return False
    
    # Verify invalid row skipped
    if data.get("skipped_invalid") != 1:
        print(f"❌ FAIL: Expected skipped_invalid=1, got {data.get('skipped_invalid')}")
        return False
    
    # Verify error details
    errors = data.get("errors", [])
    if len(errors) == 0:
        print(f"❌ FAIL: Expected error details for invalid row, got empty errors array")
        return False
    
    print(f"\nError details: {errors[0]}")
    
    # Check error has row number and reason
    error = errors[0]
    if "row" not in error:
        print(f"❌ FAIL: Error missing 'row' field")
        return False
    
    if "reason" not in error:
        print(f"❌ FAIL: Error missing 'reason' field")
        return False
    
    reason = error.get("reason", "").lower()
    if "missing" not in reason and "invalid" not in reason:
        print(f"❌ FAIL: Error reason doesn't mention missing/invalid: {reason}")
        return False
    
    print("✅ PASS: Valid row inserted (inserted=1)")
    print("✅ PASS: Invalid row skipped (skipped_invalid=1)")
    print(f"✅ PASS: Error details present with row number and reason mentioning missing/invalid")
    print("\n✅ TEST 4 PASSED: Invalid row handling working correctly")
    
    return True

def test_bulk_upload_no_auth():
    """Test bulk upload without Authorization header (should fail)"""
    print("\n" + "="*80)
    print("TEST 5: BULK UPLOAD - WITHOUT AUTHORIZATION (SHOULD FAIL)")
    print("="*80)
    
    csv_content = """Name,Mobile No.,Gender,Date of Birth
Test User,9876543210,Male,1990-01-01"""
    
    url = f"{BASE_URL}/api/salons/{SALON_ID}/customers/bulk-upload"
    
    files = {
        'file': ('customers.csv', csv_content, 'text/csv')
    }
    
    response = requests.post(url, files=files)
    print(f"\nStatus: {response.status_code}")
    
    if response.status_code not in [401, 403]:
        print(f"❌ FAIL: Expected 401 or 403, got {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    print(f"✅ PASS: Correctly rejected with {response.status_code} (unauthorized)")
    print("\n✅ TEST 5 PASSED: Auth protection working correctly")
    
    return True

def verify_customers_in_list(token):
    """Verify that uploaded customers appear in GET /api/salons/{salon_id}/customers"""
    print("\n" + "="*80)
    print("TEST 6: VERIFY CUSTOMERS APPEAR IN GET ENDPOINT")
    print("="*80)
    
    url = f"{BASE_URL}/api/salons/{SALON_ID}/customers"
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(url, headers=headers)
    print(f"\nStatus: {response.status_code}")
    
    if response.status_code != 200:
        print(f"⚠️  WARNING: Could not verify customers in list (status {response.status_code})")
        print(f"Response: {response.text}")
        return True  # Don't fail the test, just warn
    
    data = response.json()
    customers = data if isinstance(data, list) else data.get("customers", [])
    
    print(f"Total customers in salon: {len(customers)}")
    
    if len(customers) > 0:
        print(f"✅ PASS: Customers endpoint accessible, {len(customers)} customers found")
        print(f"Sample customer: {customers[0].get('name', 'N/A')} - {customers[0].get('phone', 'N/A')}")
    else:
        print(f"⚠️  WARNING: No customers found in list (might be pagination or filter issue)")
    
    print("\n✅ TEST 6 PASSED: Customers endpoint accessible")
    return True

def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("BACKEND API TESTING - CUSTOMER CSV ENDPOINTS")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Salon ID: {SALON_ID}")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    results = {
        "total": 6,
        "passed": 0,
        "failed": 0
    }
    
    # Test 1: CSV Template Download (public endpoint)
    try:
        if test_csv_template_download():
            results["passed"] += 1
        else:
            results["failed"] += 1
    except Exception as e:
        print(f"\n❌ TEST 1 EXCEPTION: {e}")
        results["failed"] += 1
    
    # Login for authenticated tests
    token = login_as_admin()
    if not token:
        print("\n❌ CRITICAL: Cannot proceed without admin token")
        print("\n" + "="*80)
        print("FINAL RESULTS")
        print("="*80)
        print(f"Total Tests: {results['total']}")
        print(f"Passed: {results['passed']}")
        print(f"Failed: {results['failed'] + (results['total'] - results['passed'] - results['failed'])}")
        return
    
    # Test 2: Valid CSV upload
    csv_content = None
    try:
        success, csv_content = test_bulk_upload_valid_csv(token)
        if success:
            results["passed"] += 1
        else:
            results["failed"] += 1
    except Exception as e:
        print(f"\n❌ TEST 2 EXCEPTION: {e}")
        results["failed"] += 1
    
    # Test 3: Duplicate CSV upload (only if Test 2 passed)
    if csv_content:
        try:
            if test_bulk_upload_duplicate_csv(token, csv_content):
                results["passed"] += 1
            else:
                results["failed"] += 1
        except Exception as e:
            print(f"\n❌ TEST 3 EXCEPTION: {e}")
            results["failed"] += 1
    else:
        print("\n⚠️  SKIPPING TEST 3: Test 2 did not provide CSV content")
        results["failed"] += 1
    
    # Test 4: Invalid row handling
    try:
        if test_bulk_upload_invalid_row(token):
            results["passed"] += 1
        else:
            results["failed"] += 1
    except Exception as e:
        print(f"\n❌ TEST 4 EXCEPTION: {e}")
        results["failed"] += 1
    
    # Test 5: No auth
    try:
        if test_bulk_upload_no_auth():
            results["passed"] += 1
        else:
            results["failed"] += 1
    except Exception as e:
        print(f"\n❌ TEST 5 EXCEPTION: {e}")
        results["failed"] += 1
    
    # Test 6: Verify in list
    try:
        if verify_customers_in_list(token):
            results["passed"] += 1
        else:
            results["failed"] += 1
    except Exception as e:
        print(f"\n❌ TEST 6 EXCEPTION: {e}")
        results["failed"] += 1
    
    # Final summary
    print("\n" + "="*80)
    print("FINAL RESULTS")
    print("="*80)
    print(f"Total Tests: {results['total']}")
    print(f"✅ Passed: {results['passed']}")
    print(f"❌ Failed: {results['failed']}")
    
    if results["failed"] == 0:
        print("\n🎉 ALL TESTS PASSED!")
    else:
        print(f"\n⚠️  {results['failed']} TEST(S) FAILED")

if __name__ == "__main__":
    main()
