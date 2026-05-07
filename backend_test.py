#!/usr/bin/env python3
"""
Backend API Testing Script for Staff Documents and Hard Delete Endpoints
Tests staff document upload/list/delete and hardened DELETE staff endpoint
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Base URL from frontend/.env
BASE_URL = "https://staff-management-pro-2.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_CREDENTIALS = {
    "identifier": "admin",
    "password": "salon123"
}

# Test results tracking
test_results = []

def log_test(test_name: str, passed: bool, details: str = ""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"{status} - {test_name}"
    if details:
        result += f"\n    {details}"
    test_results.append((test_name, passed, details))
    print(result)

def make_request(method: str, endpoint: str, headers: Optional[Dict] = None, 
                 json_data: Optional[Dict] = None, params: Optional[Dict] = None) -> tuple:
    """Make HTTP request and return (status_code, response_json, error)"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, params=params, timeout=30)
        elif method == "POST":
            resp = requests.post(url, headers=headers, json=json_data, timeout=30)
        elif method == "PUT":
            resp = requests.put(url, headers=headers, json=json_data, timeout=30)
        elif method == "DELETE":
            resp = requests.delete(url, headers=headers, timeout=30)
        else:
            return (0, None, f"Unsupported method: {method}")
        
        try:
            return (resp.status_code, resp.json(), None)
        except:
            return (resp.status_code, resp.text, None)
    except Exception as e:
        return (0, None, str(e))

def test_admin_login() -> tuple:
    """Test A: Admin login and get salon_id + access_token"""
    print("\n" + "="*80)
    print("AUTHENTICATION TEST")
    print("="*80)
    
    status, data, error = make_request("POST", "/salon/users/login", json_data=ADMIN_CREDENTIALS)
    
    if error:
        log_test("Admin Login", False, f"Request failed: {error}")
        return None, None
    
    if status != 200:
        log_test("Admin Login", False, f"Expected 200, got {status}: {data}")
        return None, None
    
    if not isinstance(data, dict) or "access_token" not in data or "salon_id" not in data:
        log_test("Admin Login", False, f"Missing access_token or salon_id in response: {data}")
        return None, None
    
    access_token = data["access_token"]
    salon_id = data["salon_id"]
    
    log_test("Admin Login", True, f"salon_id={salon_id}, token received")
    return salon_id, access_token

def get_active_barber(salon_id: str, auth_headers: Dict) -> Optional[str]:
    """Get first active barber ID"""
    print("\n" + "="*80)
    print("GET ACTIVE BARBER")
    print("="*80)
    
    status, data, error = make_request("GET", f"/salons/{salon_id}/barbers", headers=auth_headers)
    
    if error or status != 200:
        log_test("Get Active Barber", False, f"Failed to get barbers: {status} {data}")
        return None
    
    if not isinstance(data, list):
        log_test("Get Active Barber", False, f"Expected list, got: {type(data)}")
        return None
    
    # Find first active barber
    for barber in data:
        if barber.get("is_active") == True:
            barber_id = barber.get("id")
            barber_name = barber.get("name", "Unknown")
            log_test("Get Active Barber", True, f"Found barber: {barber_name} (ID: {barber_id})")
            return barber_id
    
    log_test("Get Active Barber", False, "No active barbers found")
    return None

def test_staff_documents(barber_id: str, auth_headers: Dict):
    """Test A: Staff Documents endpoints"""
    print("\n" + "="*80)
    print("A) STAFF DOCUMENTS TESTS")
    print("="*80)
    
    # A1) GET /api/barbers/{barber_id}/documents - expect empty list initially
    print("\nA1) GET /api/barbers/{barber_id}/documents (list without file_data)")
    status, data, error = make_request("GET", f"/barbers/{barber_id}/documents", headers=auth_headers)
    
    if error:
        log_test("A1: List documents", False, f"Request failed: {error}")
        return None
    
    if status != 200:
        log_test("A1: List documents", False, f"Expected 200, got {status}: {data}")
        return None
    
    if not isinstance(data, dict) or "barber_id" not in data or "documents" not in data:
        log_test("A1: List documents", False, f"Missing barber_id or documents in response: {data}")
        return None
    
    if data["barber_id"] != barber_id:
        log_test("A1: List documents", False, f"barber_id mismatch: expected {barber_id}, got {data['barber_id']}")
        return None
    
    if not isinstance(data["documents"], list):
        log_test("A1: List documents", False, f"documents should be a list, got: {type(data['documents'])}")
        return None
    
    initial_doc_count = len(data["documents"])
    log_test("A1: List documents", True, f"Returns {barber_id=}, documents list with {initial_doc_count} items")
    
    # A2) POST /api/barbers/{barber_id}/documents - upload document
    print("\nA2) POST /api/barbers/{barber_id}/documents (upload)")
    
    # Small 1x1 PNG base64 (valid image)
    test_file_data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII="
    
    upload_body = {
        "doc_type": "aadhar_front",
        "label": "Aadhar (Front)",
        "file_data": test_file_data,
        "mime_type": "image/png",
        "file_name": "test.png"
    }
    
    status, data, error = make_request("POST", f"/barbers/{barber_id}/documents", 
                                       headers=auth_headers, json_data=upload_body)
    
    if error:
        log_test("A2: Upload document", False, f"Request failed: {error}")
        return None
    
    if status != 200:
        log_test("A2: Upload document", False, f"Expected 200, got {status}: {data}")
        return None
    
    # Handle response wrapper
    if isinstance(data, dict) and "document" in data:
        data = data["document"]
    
    # Verify response structure
    required_fields = ["id", "doc_type", "label", "file_name", "mime_type", "size_kb", "uploaded_at"]
    missing_fields = [f for f in required_fields if f not in data]
    
    if missing_fields:
        log_test("A2: Upload document", False, f"Missing required fields: {missing_fields}")
        return None
    
    # Verify file_data is NOT in response
    if "file_data" in data:
        log_test("A2: Upload document", False, "file_data should NOT be in upload response")
        return None
    
    # Verify field values
    if data["doc_type"] != "aadhar_front":
        log_test("A2: Upload document", False, f"doc_type mismatch: expected 'aadhar_front', got {data['doc_type']}")
        return None
    
    if data["label"] != "Aadhar (Front)":
        log_test("A2: Upload document", False, f"label mismatch: expected 'Aadhar (Front)', got {data['label']}")
        return None
    
    if data["file_name"] != "test.png":
        log_test("A2: Upload document", False, f"file_name mismatch: expected 'test.png', got {data['file_name']}")
        return None
    
    if data["mime_type"] != "image/png":
        log_test("A2: Upload document", False, f"mime_type mismatch: expected 'image/png', got {data['mime_type']}")
        return None
    
    if not isinstance(data["size_kb"], (int, float)) or data["size_kb"] < 0:
        log_test("A2: Upload document", False, f"size_kb should be >= 0, got {data['size_kb']}")
        return None
    
    doc_id = data["id"]
    log_test("A2: Upload document", True, 
             f"Document uploaded: id={doc_id}, doc_type={data['doc_type']}, label={data['label']}, "
             f"file_name={data['file_name']}, size_kb={data['size_kb']}, file_data NOT in response ✓")
    
    # A3) GET /api/barbers/{barber_id}/documents/{doc_id} - get single document WITH file_data
    print("\nA3) GET /api/barbers/{barber_id}/documents/{doc_id} (get single with file_data)")
    status, data, error = make_request("GET", f"/barbers/{barber_id}/documents/{doc_id}", headers=auth_headers)
    
    if error:
        log_test("A3: Get single document", False, f"Request failed: {error}")
        return None
    
    if status != 200:
        log_test("A3: Get single document", False, f"Expected 200, got {status}: {data}")
        return None
    
    # Verify all fields including file_data
    required_fields_with_data = required_fields + ["file_data"]
    missing_fields = [f for f in required_fields_with_data if f not in data]
    
    if missing_fields:
        log_test("A3: Get single document", False, f"Missing required fields: {missing_fields}")
        return None
    
    # Verify file_data matches what we uploaded
    if data["file_data"] != test_file_data:
        log_test("A3: Get single document", False, "file_data does not match uploaded data")
        return None
    
    log_test("A3: Get single document", True, 
             f"Document retrieved with file_data: id={data['id']}, file_data matches uploaded ✓")
    
    # A4) GET /api/barbers/{barber_id}/documents - verify document is in list
    print("\nA4) GET /api/barbers/{barber_id}/documents (verify uploaded doc in list)")
    status, data, error = make_request("GET", f"/barbers/{barber_id}/documents", headers=auth_headers)
    
    if error or status != 200:
        log_test("A4: Verify doc in list", False, f"Failed to list documents: {status} {data}")
        return None
    
    documents = data.get("documents", [])
    doc_found = any(doc.get("id") == doc_id for doc in documents)
    
    if not doc_found:
        log_test("A4: Verify doc in list", False, f"Uploaded document {doc_id} not found in list")
        return None
    
    log_test("A4: Verify doc in list", True, f"Uploaded document found in list (total: {len(documents)} docs)")
    
    # A5) DELETE /api/barbers/{barber_id}/documents/{doc_id}
    print("\nA5) DELETE /api/barbers/{barber_id}/documents/{doc_id}")
    status, data, error = make_request("DELETE", f"/barbers/{barber_id}/documents/{doc_id}", headers=auth_headers)
    
    if error:
        log_test("A5: Delete document", False, f"Request failed: {error}")
        return None
    
    if status != 200:
        log_test("A5: Delete document", False, f"Expected 200, got {status}: {data}")
        return None
    
    if not isinstance(data, dict) or "message" not in data or "doc_id" not in data:
        log_test("A5: Delete document", False, f"Missing message or doc_id in response: {data}")
        return None
    
    if data["doc_id"] != doc_id:
        log_test("A5: Delete document", False, f"doc_id mismatch in response: expected {doc_id}, got {data['doc_id']}")
        return None
    
    log_test("A5: Delete document", True, f"Document deleted: {data['message']}, doc_id={data['doc_id']}")
    
    # A6) GET /api/barbers/{barber_id}/documents - verify document is removed
    print("\nA6) GET /api/barbers/{barber_id}/documents (verify doc removed)")
    status, data, error = make_request("GET", f"/barbers/{barber_id}/documents", headers=auth_headers)
    
    if error or status != 200:
        log_test("A6: Verify doc removed", False, f"Failed to list documents: {status} {data}")
        return None
    
    documents = data.get("documents", [])
    doc_still_exists = any(doc.get("id") == doc_id for doc in documents)
    
    if doc_still_exists:
        log_test("A6: Verify doc removed", False, f"Document {doc_id} still exists after deletion")
        return None
    
    log_test("A6: Verify doc removed", True, f"Document successfully removed from list (total: {len(documents)} docs)")
    
    # A7) GET /api/barbers/{barber_id}/documents WITHOUT auth - expect 401/403
    print("\nA7) GET /api/barbers/{barber_id}/documents WITHOUT auth (expect 401/403)")
    status, data, error = make_request("GET", f"/barbers/{barber_id}/documents")
    
    if error:
        log_test("A7: No auth rejection", False, f"Request failed: {error}")
        return None
    
    if status not in [401, 403]:
        log_test("A7: No auth rejection", False, f"Expected 401 or 403, got {status}: {data}")
        return None
    
    log_test("A7: No auth rejection", True, f"Correctly rejected with {status}")
    
    # A8) GET /api/barbers/{barber_id}/documents/non-existent-id - expect 404
    print("\nA8) GET /api/barbers/{barber_id}/documents/non-existent-id (expect 404)")
    status, data, error = make_request("GET", f"/barbers/{barber_id}/documents/non-existent-id-xyz", 
                                       headers=auth_headers)
    
    if error:
        log_test("A8: Not found 404", False, f"Request failed: {error}")
        return None
    
    if status != 404:
        log_test("A8: Not found 404", False, f"Expected 404, got {status}: {data}")
        return None
    
    if isinstance(data, dict) and "detail" in data:
        if data["detail"] != "Document not found":
            log_test("A8: Not found 404", False, f"Expected detail 'Document not found', got: {data['detail']}")
            return None
    
    log_test("A8: Not found 404", True, f"Correctly returned 404 with detail: {data.get('detail', 'N/A')}")
    
    return doc_id

def test_hard_delete_staff(salon_id: str, auth_headers: Dict):
    """Test B: Hard DELETE staff endpoint"""
    print("\n" + "="*80)
    print("B) HARD DELETE STAFF TESTS")
    print("="*80)
    
    # B1) Try to create temp barber - expect 402 paywall
    print("\nB1) POST /api/salons/{salon_id}/barbers (expect 402 paywall)")
    
    temp_barber_body = {
        "name": "TempDeleteMe",
        "experience": 1,
        "category": "junior",
        "mobile": "+919900000000",
        "salon_id": salon_id
    }
    
    status, data, error = make_request("POST", f"/salons/{salon_id}/barbers", 
                                       headers=auth_headers, json_data=temp_barber_body)
    
    if error:
        log_test("B1: Create temp barber (paywall)", False, f"Request failed: {error}")
        return
    
    if status == 402:
        log_test("B1: Create temp barber (paywall)", True, 
                 f"Correctly blocked by paywall (402): {data.get('detail', 'N/A')}")
        print("\n⚠️  SKIPPING B2 - Cannot create temp barber due to paywall (expected behavior)")
    elif status == 200 or status == 201:
        temp_barber_id = data.get("id")
        log_test("B1: Create temp barber (paywall)", True, 
                 f"Temp barber created (no paywall): {temp_barber_id}")
        
        # B2) DELETE the temp barber
        print("\nB2) DELETE /api/barbers/{temp_barber_id} (delete temp barber)")
        status, data, error = make_request("DELETE", f"/barbers/{temp_barber_id}", headers=auth_headers)
        
        if error:
            log_test("B2: Delete temp barber", False, f"Request failed: {error}")
        elif status != 200:
            log_test("B2: Delete temp barber", False, f"Expected 200, got {status}: {data}")
        else:
            # Verify response structure
            required_fields = ["message", "barber_id", "barber_name", "login_access_removed", "preserved_records"]
            missing_fields = [f for f in required_fields if f not in data]
            
            if missing_fields:
                log_test("B2: Delete temp barber", False, f"Missing required fields: {missing_fields}")
            else:
                preserved = data.get("preserved_records", {})
                log_test("B2: Delete temp barber", True, 
                         f"Deleted: {data['barber_name']}, login_access_removed={data['login_access_removed']}, "
                         f"preserved_records={preserved}")
    else:
        log_test("B1: Create temp barber (paywall)", False, 
                 f"Unexpected status {status}: {data}")
    
    # B3) DELETE without auth - expect 401/403
    print("\nB3) DELETE /api/barbers/dummy-id-123 WITHOUT auth (expect 401/403)")
    status, data, error = make_request("DELETE", "/barbers/dummy-id-123")
    
    if error:
        log_test("B3: Delete without auth", False, f"Request failed: {error}")
    elif status not in [401, 403]:
        log_test("B3: Delete without auth", False, f"Expected 401 or 403, got {status}: {data}")
    else:
        log_test("B3: Delete without auth", True, f"Correctly rejected with {status}")
    
    # B4) DELETE non-existent barber - expect 404
    print("\nB4) DELETE /api/barbers/non-existent-id-xyz WITH auth (expect 404)")
    status, data, error = make_request("DELETE", "/barbers/non-existent-id-xyz", headers=auth_headers)
    
    if error:
        log_test("B4: Delete non-existent", False, f"Request failed: {error}")
    elif status != 404:
        log_test("B4: Delete non-existent", False, f"Expected 404, got {status}: {data}")
    else:
        if isinstance(data, dict) and "detail" in data:
            if data["detail"] != "Barber not found":
                log_test("B4: Delete non-existent", False, 
                         f"Expected detail 'Barber not found', got: {data['detail']}")
            else:
                log_test("B4: Delete non-existent", True, 
                         f"Correctly returned 404 with detail: {data['detail']}")
        else:
            log_test("B4: Delete non-existent", True, f"Correctly returned 404")

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    total = len(test_results)
    passed = sum(1 for _, p, _ in test_results if p)
    failed = total - passed
    
    print(f"\nTotal Tests: {total}")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"Success Rate: {(passed/total*100):.1f}%")
    
    if failed > 0:
        print("\n" + "="*80)
        print("FAILED TESTS:")
        print("="*80)
        for name, passed, details in test_results:
            if not passed:
                print(f"\n❌ {name}")
                if details:
                    print(f"   {details}")
    
    return passed, failed

def main():
    """Main test execution"""
    print("="*80)
    print("STAFF DOCUMENTS & HARD DELETE BACKEND API TESTS")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Credentials: {ADMIN_CREDENTIALS['identifier']}")
    
    # Step 1: Admin login
    salon_id, access_token = test_admin_login()
    if not salon_id or not access_token:
        print("\n❌ CRITICAL: Admin login failed. Cannot proceed with tests.")
        sys.exit(1)
    
    auth_headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    # Step 2: Get active barber
    barber_id = get_active_barber(salon_id, auth_headers)
    if not barber_id:
        print("\n❌ CRITICAL: No active barber found. Cannot proceed with document tests.")
        sys.exit(1)
    
    # Step 3: Test staff documents
    test_staff_documents(barber_id, auth_headers)
    
    # Step 4: Test hard delete staff
    test_hard_delete_staff(salon_id, auth_headers)
    
    # Step 5: Print summary
    passed, failed = print_summary()
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()
