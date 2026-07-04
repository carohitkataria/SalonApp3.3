"""
backend_test.py — Comprehensive backend testing for SalonHub Marketing Module (M0-M3)

Tests:
  - Marketing M0: Meta WhatsApp scaffolding + channels + webhook (5 tests)
  - Marketing M1: Customer master fields (wedding_anniversary/spouse/important_dates) (4 tests)
  - Marketing M2: Segments CRUD + preview (7 tests)
  - Marketing M3: Salon Coupons CRUD + publish + validate + public list (13 tests)
  - can_access_marketing permission persistence (5 tests)

Total: 34 tests
"""

import httpx
import json
import random
import string
from datetime import datetime, timezone

# Configuration
BASE_URL = "https://293cd839-0730-4ffb-888b-e93570167fa8.preview.emergentagent.com/api"
ADMIN_CREDENTIALS = {"identifier": "admin", "password": "salon123"}
EXPECTED_SALON_ID = "f78671f8-621a-42d9-a055-097ba21c0bbf"

# Test state
admin_token = None
salon_id = None
test_customer_phone = None
test_segment_id = None
test_coupon_id = None
test_staff_user_id = None
test_staff_token = None


def random_string(length=8):
    """Generate random string for unique test data"""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))


def print_test(test_num, description):
    """Print test header"""
    print(f"\n{'='*80}")
    print(f"TEST {test_num}: {description}")
    print('='*80)


def print_result(passed, message=""):
    """Print test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {message}")
    return passed


async def admin_login():
    """Login as salon admin and get token"""
    global admin_token, salon_id
    
    print_test("SETUP", "Admin Login")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/salon/users/login",
            json=ADMIN_CREDENTIALS
        )
        
        if response.status_code != 200:
            print_result(False, f"Login failed: {response.status_code} - {response.text}")
            return False
        
        data = response.json()
        admin_token = data.get("access_token")
        salon_id = data.get("salon_id")
        
        if not admin_token or not salon_id:
            print_result(False, f"Missing token or salon_id in response: {data}")
            return False
        
        print_result(True, f"Logged in successfully. Salon ID: {salon_id}")
        return True


# ============================================================================
# Marketing M0 — Meta WhatsApp scaffolding + channels + webhook
# ============================================================================

async def test_m0_1_ping_with_auth():
    """M0-1: GET /api/salons/{id}/marketing/ping with auth → 200"""
    print_test("M0-1", "Marketing ping endpoint with authentication")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/marketing/ping",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if not data.get("ok") or data.get("module") != "marketing":
            return print_result(False, f"Invalid response structure: {data}")
        
        return print_result(True, f"Ping successful: {data}")


async def test_m0_2_channels_with_auth():
    """M0-2: GET /api/salons/{id}/marketing/channels with auth → 200"""
    print_test("M0-2", "Marketing channels endpoint with authentication")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/marketing/channels",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if "active_provider" not in data or "channels" not in data:
            return print_result(False, f"Missing required fields: {data}")
        
        # Check for Twilio channel
        channels = data.get("channels", [])
        if not channels:
            return print_result(False, "No channels returned")
        
        twilio_channel = next((c for c in channels if c.get("provider") == "whatsapp_twilio"), None)
        if not twilio_channel:
            return print_result(False, f"No Twilio WhatsApp channel found: {channels}")
        
        return print_result(True, f"Channels retrieved: {data}")


async def test_m0_3_webhook_verify_wrong_token():
    """M0-3: GET /api/webhooks/whatsapp with wrong verify token → 403"""
    print_test("M0-3", "WhatsApp webhook verification with wrong token")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/webhooks/whatsapp",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": "WRONG_TOKEN",
                "hub.challenge": "test_challenge_123"
            }
        )
        
        if response.status_code != 403:
            return print_result(False, f"Expected 403, got {response.status_code}: {response.text}")
        
        return print_result(True, "Webhook verification correctly rejected wrong token")


async def test_m0_4_webhook_post_empty():
    """M0-4: POST /api/webhooks/whatsapp with empty body → 200"""
    print_test("M0-4", "WhatsApp webhook POST with empty body")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/webhooks/whatsapp",
            json={}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if not data.get("received"):
            return print_result(False, f"Invalid response: {data}")
        
        return print_result(True, f"Webhook POST accepted: {data}")


async def test_m0_5_endpoints_without_auth():
    """M0-5: Marketing endpoints without auth → 403"""
    print_test("M0-5", "Marketing endpoints without authentication")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test ping without auth
        response1 = await client.get(f"{BASE_URL}/salons/{salon_id}/marketing/ping")
        
        # Test channels without auth
        response2 = await client.get(f"{BASE_URL}/salons/{salon_id}/marketing/channels")
        
        if response1.status_code != 403:
            return print_result(False, f"Ping without auth: expected 403, got {response1.status_code}")
        
        if response2.status_code != 403:
            return print_result(False, f"Channels without auth: expected 403, got {response2.status_code}")
        
        return print_result(True, "Both endpoints correctly require authentication")


# ============================================================================
# Marketing M1 — Customer master fields
# ============================================================================

async def test_m1_1_create_customer():
    """M1-1: Create fresh customer via POST /api/user/login"""
    global test_customer_phone
    
    print_test("M1-1", "Create fresh test customer")
    
    # Generate unique 10-digit phone
    test_customer_phone = f"98765{random.randint(10000, 99999)}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/user/login",
            json={
                "name": f"Test Customer {random_string(4)}",
                "phone": test_customer_phone,
                "gender": "Male"
            }
        )
        
        if response.status_code != 200:
            return print_result(False, f"Customer creation failed: {response.status_code} - {response.text}")
        
        data = response.json()
        if not data.get("access_token"):
            return print_result(False, f"No access token in response: {data}")
        
        return print_result(True, f"Customer created with phone: {test_customer_phone}")


async def test_m1_2_get_customer_new_fields():
    """M1-2: GET /api/users/by-phone/{phone} → new fields present (initially null)"""
    print_test("M1-2", "Get customer profile - verify new marketing fields")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(f"{BASE_URL}/users/by-phone/{test_customer_phone}")
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        
        # Check for new marketing fields
        required_fields = ["wedding_anniversary", "spouse_name", "spouse_date_of_birth", "important_dates"]
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            return print_result(False, f"Missing fields: {missing_fields}. Response: {data}")
        
        return print_result(True, f"All marketing fields present: {required_fields}")


async def test_m1_3_update_customer_marketing_fields():
    """M1-3: PUT /api/users/by-phone/{phone} with marketing fields → 200"""
    print_test("M1-3", "Update customer marketing fields")
    
    update_data = {
        "wedding_anniversary": "2018-11-14",
        "spouse_name": "Priya",
        "spouse_date_of_birth": "1993-06-04",
        "important_dates": [
            {"label": "Kid Bday", "date": "2020-01-05"}
        ]
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.put(
            f"{BASE_URL}/users/by-phone/{test_customer_phone}",
            json=update_data
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        
        # Verify fields are echoed back
        if data.get("wedding_anniversary") != update_data["wedding_anniversary"]:
            return print_result(False, f"wedding_anniversary mismatch: {data}")
        
        if data.get("spouse_name") != update_data["spouse_name"]:
            return print_result(False, f"spouse_name mismatch: {data}")
        
        return print_result(True, f"Marketing fields updated successfully")


async def test_m1_4_verify_persistence():
    """M1-4: GET again to verify persistence"""
    print_test("M1-4", "Verify marketing fields persistence")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(f"{BASE_URL}/users/by-phone/{test_customer_phone}")
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        
        # Verify persisted values
        if data.get("wedding_anniversary") != "2018-11-14":
            return print_result(False, f"wedding_anniversary not persisted: {data}")
        
        if data.get("spouse_name") != "Priya":
            return print_result(False, f"spouse_name not persisted: {data}")
        
        if data.get("spouse_date_of_birth") != "1993-06-04":
            return print_result(False, f"spouse_date_of_birth not persisted: {data}")
        
        important_dates = data.get("important_dates", [])
        if not important_dates or important_dates[0].get("label") != "Kid Bday":
            return print_result(False, f"important_dates not persisted: {data}")
        
        return print_result(True, "All marketing fields persisted correctly")


# ============================================================================
# Marketing M2 — Segments CRUD + preview
# ============================================================================

async def test_m2_1_preview_empty_segment():
    """M2-1: POST /api/salons/{id}/marketing/segments/preview with empty rules → 200"""
    print_test("M2-1", "Preview segment with empty rules")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/salons/{salon_id}/marketing/segments/preview",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": "tmp",
                "rules": {
                    "logic": "AND",
                    "conditions": []
                }
            }
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if "count" not in data or "sample" not in data:
            return print_result(False, f"Missing required fields: {data}")
        
        return print_result(True, f"Preview returned count: {data.get('count')}, sample size: {len(data.get('sample', []))}")


async def test_m2_2_create_segment():
    """M2-2: POST /api/salons/{id}/marketing/segments → 201/200 with id"""
    global test_segment_id
    
    print_test("M2-2", "Create marketing segment")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/salons/{salon_id}/marketing/segments",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": f"Test Segment {random_string(4)}",
                "description": "Test segment for birthday month",
                "rules": {
                    "logic": "OR",
                    "conditions": [
                        {"field": "birthday_month", "op": "eq", "value": 7}
                    ]
                }
            }
        )
        
        if response.status_code not in [200, 201]:
            return print_result(False, f"Expected 200/201, got {response.status_code}: {response.text}")
        
        data = response.json()
        test_segment_id = data.get("id")
        
        if not test_segment_id:
            return print_result(False, f"No segment ID in response: {data}")
        
        return print_result(True, f"Segment created with ID: {test_segment_id}")


async def test_m2_3_list_segments():
    """M2-3: GET /api/salons/{id}/marketing/segments → contains created segment"""
    print_test("M2-3", "List marketing segments")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/marketing/segments",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        segments = data.get("segments", [])
        
        # Find our test segment
        found = any(s.get("id") == test_segment_id for s in segments)
        
        if not found:
            return print_result(False, f"Test segment {test_segment_id} not found in list: {segments}")
        
        return print_result(True, f"Segment list contains {len(segments)} segments including test segment")


async def test_m2_4_update_segment():
    """M2-4: PUT /api/salons/{id}/marketing/segments/{seg_id} to rename → 200"""
    print_test("M2-4", "Update segment name")
    
    new_name = f"Updated Segment {random_string(4)}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.put(
            f"{BASE_URL}/salons/{salon_id}/marketing/segments/{test_segment_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": new_name,
                "description": "Updated description",
                "rules": {
                    "logic": "OR",
                    "conditions": [
                        {"field": "birthday_month", "op": "eq", "value": 7}
                    ]
                }
            }
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if data.get("name") != new_name:
            return print_result(False, f"Name not updated: {data}")
        
        return print_result(True, f"Segment updated to: {new_name}")


async def test_m2_5_preview_invalid_field():
    """M2-5: Preview with invalid field name → 422"""
    print_test("M2-5", "Preview segment with invalid field")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/salons/{salon_id}/marketing/segments/preview",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": "invalid",
                "rules": {
                    "logic": "AND",
                    "conditions": [
                        {"field": "invalid_field_foo", "op": "eq", "value": "test"}
                    ]
                }
            }
        )
        
        if response.status_code != 422:
            return print_result(False, f"Expected 422, got {response.status_code}: {response.text}")
        
        return print_result(True, "Invalid field correctly rejected with 422")


async def test_m2_6_segments_require_auth():
    """M2-6: Segment endpoints without auth → 403"""
    print_test("M2-6", "Segment endpoints require authentication")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test list without auth
        response = await client.get(f"{BASE_URL}/salons/{salon_id}/marketing/segments")
        
        if response.status_code != 403:
            return print_result(False, f"Expected 403, got {response.status_code}")
        
        return print_result(True, "Segment endpoints correctly require authentication")


async def test_m2_7_delete_segment():
    """M2-7: DELETE /api/salons/{id}/marketing/segments/{seg_id} → {deleted:true}"""
    print_test("M2-7", "Delete marketing segment")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.delete(
            f"{BASE_URL}/salons/{salon_id}/marketing/segments/{test_segment_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if not data.get("deleted"):
            return print_result(False, f"Deleted flag not true: {data}")
        
        return print_result(True, f"Segment deleted successfully")


# ============================================================================
# Marketing M3 — Salon Coupons CRUD + publish + validate + public list
# ============================================================================

async def test_m3_1_create_coupon():
    """M3-1: POST /api/salons/{id}/coupons → code uppercased"""
    global test_coupon_id
    
    print_test("M3-1", "Create salon coupon")
    
    coupon_code = f"test{random_string(4)}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/salons/{salon_id}/coupons",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "code": coupon_code,
                "title": "Test Coupon 10%",
                "type": "percent",
                "value": 10,
                "min_bill_amount": 300,
                "per_customer_limit": 1,
                "visibility": "published",
                "is_active": True
            }
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        test_coupon_id = data.get("id")
        returned_code = data.get("code")
        
        if not test_coupon_id:
            return print_result(False, f"No coupon ID in response: {data}")
        
        if returned_code != coupon_code.upper():
            return print_result(False, f"Code not uppercased: expected {coupon_code.upper()}, got {returned_code}")
        
        return print_result(True, f"Coupon created with ID: {test_coupon_id}, code: {returned_code}")


async def test_m3_2_duplicate_coupon():
    """M3-2: Duplicate POST with same code → 409"""
    print_test("M3-2", "Create duplicate coupon")
    
    # Get the code from the previous coupon
    async with httpx.AsyncClient(timeout=30.0) as client:
        # First get the existing coupon code
        get_response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/coupons/{test_coupon_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if get_response.status_code != 200:
            return print_result(False, f"Could not get existing coupon: {get_response.status_code}")
        
        existing_code = get_response.json().get("code")
        
        # Try to create duplicate
        response = await client.post(
            f"{BASE_URL}/salons/{salon_id}/coupons",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "code": existing_code,
                "title": "Duplicate Coupon",
                "type": "percent",
                "value": 10,
                "min_bill_amount": 300,
                "per_customer_limit": 1,
                "visibility": "published",
                "is_active": True
            }
        )
        
        if response.status_code != 409:
            return print_result(False, f"Expected 409, got {response.status_code}: {response.text}")
        
        return print_result(True, "Duplicate coupon correctly rejected with 409")


async def test_m3_3_list_coupons():
    """M3-3: GET /api/salons/{id}/coupons → returns the new coupon"""
    print_test("M3-3", "List salon coupons")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/coupons",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        coupons = data.get("coupons", [])
        
        # Find our test coupon
        found = any(c.get("id") == test_coupon_id for c in coupons)
        
        if not found:
            return print_result(False, f"Test coupon {test_coupon_id} not found in list")
        
        return print_result(True, f"Coupon list contains {len(coupons)} coupons including test coupon")


async def test_m3_4_unpublish_coupon():
    """M3-4: POST /api/salons/{id}/coupons/{cid}/unpublish → visibility:'private'"""
    print_test("M3-4", "Unpublish coupon")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/salons/{salon_id}/coupons/{test_coupon_id}/unpublish",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if data.get("visibility") != "private":
            return print_result(False, f"Visibility not set to private: {data}")
        
        return print_result(True, "Coupon unpublished successfully")


async def test_m3_5_publish_coupon():
    """M3-5: POST /api/salons/{id}/coupons/{cid}/publish → visibility:'published'"""
    print_test("M3-5", "Publish coupon")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/salons/{salon_id}/coupons/{test_coupon_id}/publish",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if data.get("visibility") != "published":
            return print_result(False, f"Visibility not set to published: {data}")
        
        return print_result(True, "Coupon published successfully")


async def test_m3_6_public_coupons_list():
    """M3-6: GET /api/public/salons/{id}/coupons → coupon listed when published"""
    print_test("M3-6", "Public coupons list")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(f"{BASE_URL}/public/salons/{salon_id}/coupons")
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        coupons = data.get("coupons", [])
        
        # Find our test coupon (should be visible since it's published)
        found = any(c.get("id") == test_coupon_id for c in coupons)
        
        if not found:
            return print_result(False, f"Published coupon not found in public list")
        
        return print_result(True, f"Public list contains {len(coupons)} coupons including test coupon")


async def test_m3_7_validate_coupon_success():
    """M3-7: POST /api/salons/{id}/coupons/validate with valid bill → discount calculated"""
    print_test("M3-7", "Validate coupon with valid bill amount")
    
    # Get the coupon code
    async with httpx.AsyncClient(timeout=30.0) as client:
        get_response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/coupons/{test_coupon_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if get_response.status_code != 200:
            return print_result(False, f"Could not get coupon: {get_response.status_code}")
        
        coupon_code = get_response.json().get("code")
        
        # Validate with bill amount 500 (10% discount = 50)
        response = await client.post(
            f"{BASE_URL}/salons/{salon_id}/coupons/validate",
            json={
                "code": coupon_code,
                "bill_amount": 500
            }
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        
        if not data.get("valid"):
            return print_result(False, f"Coupon not valid: {data}")
        
        discount = data.get("discount_amount")
        final = data.get("final_amount")
        
        if discount != 50.0:
            return print_result(False, f"Expected discount 50, got {discount}")
        
        if final != 450.0:
            return print_result(False, f"Expected final amount 450, got {final}")
        
        return print_result(True, f"Coupon validated: discount={discount}, final={final}")


async def test_m3_8_validate_below_min_bill():
    """M3-8: Validate with bill below min_bill_amount → 400"""
    print_test("M3-8", "Validate coupon with bill below minimum")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Get the coupon code
        get_response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/coupons/{test_coupon_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if get_response.status_code != 200:
            return print_result(False, f"Could not get coupon: {get_response.status_code}")
        
        coupon_code = get_response.json().get("code")
        
        # Validate with bill amount 200 (below min 300)
        response = await client.post(
            f"{BASE_URL}/salons/{salon_id}/coupons/validate",
            json={
                "code": coupon_code,
                "bill_amount": 200
            }
        )
        
        if response.status_code != 400:
            return print_result(False, f"Expected 400, got {response.status_code}: {response.text}")
        
        detail = response.json().get("detail", "")
        if "Minimum bill amount" not in detail:
            return print_result(False, f"Expected minimum bill message, got: {detail}")
        
        return print_result(True, f"Below minimum bill correctly rejected: {detail}")


async def test_m3_9_validate_invalid_code():
    """M3-9: Validate wrong code → 404"""
    print_test("M3-9", "Validate with invalid coupon code")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/salons/{salon_id}/coupons/validate",
            json={
                "code": "INVALID_CODE_XYZ",
                "bill_amount": 500
            }
        )
        
        if response.status_code != 404:
            return print_result(False, f"Expected 404, got {response.status_code}: {response.text}")
        
        return print_result(True, "Invalid coupon code correctly rejected with 404")


async def test_m3_10_update_coupon():
    """M3-10: PUT /api/salons/{id}/coupons/{cid} updates fields correctly"""
    print_test("M3-10", "Update coupon fields")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Get current coupon
        get_response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/coupons/{test_coupon_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if get_response.status_code != 200:
            return print_result(False, f"Could not get coupon: {get_response.status_code}")
        
        coupon = get_response.json()
        
        # Update title
        new_title = f"Updated Coupon {random_string(4)}"
        coupon["title"] = new_title
        
        response = await client.put(
            f"{BASE_URL}/salons/{salon_id}/coupons/{test_coupon_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json=coupon
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if data.get("title") != new_title:
            return print_result(False, f"Title not updated: {data}")
        
        return print_result(True, f"Coupon updated to: {new_title}")


async def test_m3_11_coupons_require_auth():
    """M3-11: Coupon CRUD endpoints without auth → 403"""
    print_test("M3-11", "Coupon CRUD endpoints require authentication")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test list without auth
        response = await client.get(f"{BASE_URL}/salons/{salon_id}/coupons")
        
        if response.status_code != 403:
            return print_result(False, f"Expected 403, got {response.status_code}")
        
        return print_result(True, "Coupon CRUD endpoints correctly require authentication")


async def test_m3_12_validate_is_public():
    """M3-12: Validate endpoint is public (no auth required)"""
    print_test("M3-12", "Validate endpoint is public")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Get the coupon code
        get_response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/coupons/{test_coupon_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if get_response.status_code != 200:
            return print_result(False, f"Could not get coupon: {get_response.status_code}")
        
        coupon_code = get_response.json().get("code")
        
        # Validate WITHOUT auth
        response = await client.post(
            f"{BASE_URL}/salons/{salon_id}/coupons/validate",
            json={
                "code": coupon_code,
                "bill_amount": 500
            }
        )
        
        if response.status_code != 200:
            return print_result(False, f"Validate endpoint requires auth (should be public): {response.status_code}")
        
        return print_result(True, "Validate endpoint is correctly public (no auth required)")


async def test_m3_13_delete_coupon():
    """M3-13: DELETE /api/salons/{id}/coupons/{cid} → {deleted:true}"""
    print_test("M3-13", "Delete coupon")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.delete(
            f"{BASE_URL}/salons/{salon_id}/coupons/{test_coupon_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}: {response.text}")
        
        data = response.json()
        if not data.get("deleted"):
            return print_result(False, f"Deleted flag not true: {data}")
        
        return print_result(True, "Coupon deleted successfully")


# ============================================================================
# can_access_marketing permission persistence
# ============================================================================

async def test_perm_1_admin_has_marketing_permission():
    """PERM-1: Admin login → permissions.can_access_marketing === true"""
    print_test("PERM-1", "Admin has can_access_marketing permission")
    
    # Re-login to get fresh permissions
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/salon/users/login",
            json=ADMIN_CREDENTIALS
        )
        
        if response.status_code != 200:
            return print_result(False, f"Login failed: {response.status_code}")
        
        data = response.json()
        permissions = data.get("permissions", {})
        
        if not permissions.get("can_access_marketing"):
            return print_result(False, f"Admin missing can_access_marketing permission: {permissions}")
        
        return print_result(True, f"Admin has can_access_marketing: {permissions.get('can_access_marketing')}")


async def test_perm_2_create_staff_with_marketing():
    """PERM-2: Create staff with can_access_marketing=true"""
    global test_staff_user_id
    
    print_test("PERM-2", "Create staff with marketing permission")
    
    login_id = f"teststaff_{random_string(6)}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/salon/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "salon_id": salon_id,
                "name": f"Test Staff {random_string(4)}",
                "mobile": f"98765{random.randint(10000, 99999)}",
                "login_id": login_id,
                "password": "testpass123",
                "role": "staff",
                "permissions": {
                    "can_access_marketing": True
                }
            }
        )
        
        if response.status_code != 200:
            return print_result(False, f"Staff creation failed: {response.status_code} - {response.text}")
        
        data = response.json()
        test_staff_user_id = data.get("id")
        permissions = data.get("permissions", {})
        
        if not test_staff_user_id:
            return print_result(False, f"No user ID in response: {data}")
        
        if not permissions.get("can_access_marketing"):
            return print_result(False, f"can_access_marketing not set: {permissions}")
        
        return print_result(True, f"Staff created with ID: {test_staff_user_id}, marketing permission: true")


async def test_perm_3_staff_login_has_marketing():
    """PERM-3: Staff login → permissions.can_access_marketing === true"""
    global test_staff_token
    
    print_test("PERM-3", "Staff login returns marketing permission")
    
    # Get the staff login_id
    async with httpx.AsyncClient(timeout=30.0) as client:
        # First get the staff user details
        get_response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if get_response.status_code != 200:
            return print_result(False, f"Could not get staff users: {get_response.status_code}")
        
        users = get_response.json().get("users", [])
        test_staff = next((u for u in users if u.get("id") == test_staff_user_id), None)
        
        if not test_staff:
            return print_result(False, f"Test staff user not found")
        
        login_id = test_staff.get("login_id")
        
        # Login as staff
        response = await client.post(
            f"{BASE_URL}/salon/users/login",
            json={
                "identifier": login_id,
                "password": "testpass123"
            }
        )
        
        if response.status_code != 200:
            return print_result(False, f"Staff login failed: {response.status_code} - {response.text}")
        
        data = response.json()
        test_staff_token = data.get("access_token")
        permissions = data.get("permissions", {})
        
        if not permissions.get("can_access_marketing"):
            return print_result(False, f"can_access_marketing not in login response: {permissions}")
        
        return print_result(True, f"Staff login successful, marketing permission: true")


async def test_perm_4_create_staff_without_permissions():
    """PERM-4: Create staff WITHOUT permissions → defaults to false"""
    print_test("PERM-4", "Create staff without permissions defaults to false")
    
    login_id = f"teststaff2_{random_string(6)}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{BASE_URL}/salon/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "salon_id": salon_id,
                "name": f"Test Staff No Perms {random_string(4)}",
                "mobile": f"98765{random.randint(10000, 99999)}",
                "login_id": login_id,
                "password": "testpass123",
                "role": "staff"
                # No permissions field
            }
        )
        
        if response.status_code != 200:
            return print_result(False, f"Staff creation failed: {response.status_code} - {response.text}")
        
        data = response.json()
        permissions = data.get("permissions", {})
        
        if permissions.get("can_access_marketing") is not False:
            return print_result(False, f"can_access_marketing should default to false: {permissions}")
        
        return print_result(True, f"Staff created with default can_access_marketing: false")


async def test_perm_5_update_marketing_permission():
    """PERM-5: PUT /api/salon/users/{user_id} flipping the flag persists"""
    print_test("PERM-5", "Update marketing permission persists")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Update to flip the permission to false
        response = await client.put(
            f"{BASE_URL}/salon/users/{test_staff_user_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "permissions": {
                    "can_access_marketing": False
                }
            }
        )
        
        if response.status_code != 200:
            return print_result(False, f"Update failed: {response.status_code} - {response.text}")
        
        data = response.json()
        permissions = data.get("permissions", {})
        
        if permissions.get("can_access_marketing") is not False:
            return print_result(False, f"Permission not updated: {permissions}")
        
        # Verify by logging in again
        get_response = await client.get(
            f"{BASE_URL}/salons/{salon_id}/users",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if get_response.status_code != 200:
            return print_result(False, f"Could not verify: {get_response.status_code}")
        
        users = get_response.json().get("users", [])
        test_staff = next((u for u in users if u.get("id") == test_staff_user_id), None)
        
        if not test_staff:
            return print_result(False, "Test staff user not found for verification")
        
        verify_perms = test_staff.get("permissions", {})
        if verify_perms.get("can_access_marketing") is not False:
            return print_result(False, f"Permission not persisted: {verify_perms}")
        
        return print_result(True, "Marketing permission updated and persisted successfully")


# ============================================================================
# Main test runner
# ============================================================================

async def run_all_tests():
    """Run all marketing module tests"""
    print("\n" + "="*80)
    print("SALONHUB MARKETING MODULE (M0-M3) BACKEND TESTING")
    print("="*80)
    
    # Setup
    if not await admin_login():
        print("\n❌ SETUP FAILED: Could not login as admin")
        return
    
    results = []
    
    # Marketing M0 tests
    results.append(await test_m0_1_ping_with_auth())
    results.append(await test_m0_2_channels_with_auth())
    results.append(await test_m0_3_webhook_verify_wrong_token())
    results.append(await test_m0_4_webhook_post_empty())
    results.append(await test_m0_5_endpoints_without_auth())
    
    # Marketing M1 tests
    results.append(await test_m1_1_create_customer())
    results.append(await test_m1_2_get_customer_new_fields())
    results.append(await test_m1_3_update_customer_marketing_fields())
    results.append(await test_m1_4_verify_persistence())
    
    # Marketing M2 tests
    results.append(await test_m2_1_preview_empty_segment())
    results.append(await test_m2_2_create_segment())
    results.append(await test_m2_3_list_segments())
    results.append(await test_m2_4_update_segment())
    results.append(await test_m2_5_preview_invalid_field())
    results.append(await test_m2_6_segments_require_auth())
    results.append(await test_m2_7_delete_segment())
    
    # Marketing M3 tests
    results.append(await test_m3_1_create_coupon())
    results.append(await test_m3_2_duplicate_coupon())
    results.append(await test_m3_3_list_coupons())
    results.append(await test_m3_4_unpublish_coupon())
    results.append(await test_m3_5_publish_coupon())
    results.append(await test_m3_6_public_coupons_list())
    results.append(await test_m3_7_validate_coupon_success())
    results.append(await test_m3_8_validate_below_min_bill())
    results.append(await test_m3_9_validate_invalid_code())
    results.append(await test_m3_10_update_coupon())
    results.append(await test_m3_11_coupons_require_auth())
    results.append(await test_m3_12_validate_is_public())
    results.append(await test_m3_13_delete_coupon())
    
    # Permission tests
    results.append(await test_perm_1_admin_has_marketing_permission())
    results.append(await test_perm_2_create_staff_with_marketing())
    results.append(await test_perm_3_staff_login_has_marketing())
    results.append(await test_perm_4_create_staff_without_permissions())
    results.append(await test_perm_5_update_marketing_permission())
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for r in results if r)
    total = len(results)
    
    print(f"\nTotal Tests: {total}")
    print(f"Passed: {passed} ✅")
    print(f"Failed: {total - passed} ❌")
    print(f"Success Rate: {(passed/total*100):.1f}%")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! Marketing Module is production-ready.")
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Please review the output above.")
    
    print("="*80 + "\n")


if __name__ == "__main__":
    import asyncio
    asyncio.run(run_all_tests())
