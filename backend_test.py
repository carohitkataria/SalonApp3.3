#!/usr/bin/env python3
"""
Backend test for WhatsApp Template example_values flow.
Tests draft validation, persistence, submit shape, and cleanup.
"""

import requests
import json
import random
import string
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "http://localhost:8001/api"
ADMIN_IDENTIFIER = "admin"
ADMIN_PASSWORD = "salon123"

# Global state
access_token: Optional[str] = None
salon_id: Optional[str] = None
created_template_ids = []


def random_suffix(length=4) -> str:
    """Generate random alphanumeric suffix for unique names."""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))


def login_admin() -> Dict[str, Any]:
    """Login as admin and capture access_token and salon_id."""
    global access_token, salon_id
    
    print("\n" + "="*80)
    print("AUTHENTICATION - Admin Login")
    print("="*80)
    
    url = f"{BASE_URL}/salon/users/login"
    payload = {
        "identifier": ADMIN_IDENTIFIER,
        "password": ADMIN_PASSWORD
    }
    
    print(f"POST {url}")
    print(f"Body: {json.dumps(payload, indent=2)}")
    
    try:
        resp = requests.post(url, json=payload, timeout=15)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 200:
            data = resp.json()
            access_token = data.get("access_token")
            salon_id = data.get("salon_id")
            print(f"✅ Login successful")
            print(f"   Access Token: {access_token[:20]}...")
            print(f"   Salon ID: {salon_id}")
            return {"success": True, "data": data}
        else:
            print(f"❌ Login failed with status {resp.status_code}")
            return {"success": False, "status": resp.status_code, "body": resp.text}
    except Exception as e:
        print(f"❌ Login exception: {e}")
        return {"success": False, "error": str(e)}


def get_headers() -> Dict[str, str]:
    """Get authorization headers."""
    if not access_token:
        raise ValueError("Not authenticated - call login_admin() first")
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }


def test_a_draft_missing_examples():
    """A) DRAFT VALIDATION — missing example_values"""
    print("\n" + "="*80)
    print("TEST A) DRAFT VALIDATION — missing example_values")
    print("="*80)
    
    name = f"qa_examples_missing_{random_suffix()}"
    url = f"{BASE_URL}/salons/{salon_id}/marketing/templates/draft"
    payload = {
        "name": name,
        "category": "utility",
        "lang_code": "en",
        "body": "Hi {{1}}, your appointment at {{2}} is confirmed."
    }
    
    print(f"POST {url}")
    print(f"Body: {json.dumps(payload, indent=2)}")
    
    try:
        resp = requests.post(url, json=payload, headers=get_headers(), timeout=15)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 422:
            body = resp.json()
            detail = str(body.get("detail", ""))
            if "{{1}}" in detail and "{{2}}" in detail:
                print(f"✅ PASS: Got 422 with error mentioning both {{{{1}}}} and {{{{2}}}}")
                return {"pass": True, "status": resp.status_code, "body": resp.text[:300]}
            else:
                print(f"⚠️  PARTIAL: Got 422 but error doesn't mention both placeholders")
                print(f"   Detail: {detail}")
                return {"pass": False, "status": resp.status_code, "body": resp.text[:300], "reason": "Error message incomplete"}
        else:
            print(f"❌ FAIL: Expected 422, got {resp.status_code}")
            return {"pass": False, "status": resp.status_code, "body": resp.text[:300]}
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return {"pass": False, "error": str(e)}


def test_b_draft_partial_examples():
    """B) DRAFT VALIDATION — partial example_values"""
    print("\n" + "="*80)
    print("TEST B) DRAFT VALIDATION — partial example_values")
    print("="*80)
    
    name = f"qa_examples_partial_{random_suffix()}"
    url = f"{BASE_URL}/salons/{salon_id}/marketing/templates/draft"
    payload = {
        "name": name,
        "category": "utility",
        "lang_code": "en",
        "body": "Hi {{1}}, your appointment at {{2}} is confirmed.",
        "example_values": {"1": "Riya"}
    }
    
    print(f"POST {url}")
    print(f"Body: {json.dumps(payload, indent=2)}")
    
    try:
        resp = requests.post(url, json=payload, headers=get_headers(), timeout=15)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 422:
            body = resp.json()
            detail = str(body.get("detail", ""))
            if "{{2}}" in detail or "2" in detail:
                print(f"✅ PASS: Got 422 with error mentioning {{{{2}}}} (missing)")
                return {"pass": True, "status": resp.status_code, "body": resp.text[:300]}
            else:
                print(f"⚠️  PARTIAL: Got 422 but error doesn't mention missing {{{{2}}}}")
                print(f"   Detail: {detail}")
                return {"pass": False, "status": resp.status_code, "body": resp.text[:300], "reason": "Error message incomplete"}
        else:
            print(f"❌ FAIL: Expected 422, got {resp.status_code}")
            return {"pass": False, "status": resp.status_code, "body": resp.text[:300]}
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return {"pass": False, "error": str(e)}


def test_c_draft_full_examples():
    """C) DRAFT SUCCESS — full example_values"""
    print("\n" + "="*80)
    print("TEST C) DRAFT SUCCESS — full example_values")
    print("="*80)
    
    name = f"qa_examples_ok_{random_suffix()}"
    url = f"{BASE_URL}/salons/{salon_id}/marketing/templates/draft"
    payload = {
        "name": name,
        "category": "utility",
        "lang_code": "en",
        "body": "Hi {{1}}, your appointment at {{2}} is confirmed.",
        "example_values": {"1": "Riya Sharma", "2": "Style Studio CP"}
    }
    
    print(f"POST {url}")
    print(f"Body: {json.dumps(payload, indent=2)}")
    
    try:
        resp = requests.post(url, json=payload, headers=get_headers(), timeout=15)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 200:
            body = resp.json()
            template_id = body.get("id")
            example_values = body.get("example_values")
            
            if template_id:
                created_template_ids.append(template_id)
                print(f"   Template ID: {template_id}")
            
            if example_values and "1" in example_values and "2" in example_values:
                print(f"✅ PASS: Got 200 with example_values containing keys '1' and '2'")
                print(f"   example_values: {example_values}")
                return {"pass": True, "status": resp.status_code, "body": resp.text[:300], "template_id": template_id}
            else:
                print(f"⚠️  PARTIAL: Got 200 but example_values structure incorrect")
                print(f"   example_values: {example_values}")
                return {"pass": False, "status": resp.status_code, "body": resp.text[:300], "reason": "example_values missing keys"}
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return {"pass": False, "status": resp.status_code, "body": resp.text[:300]}
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return {"pass": False, "error": str(e)}


def test_d_no_placeholder():
    """D) NO-PLACEHOLDER — example_values ignored/allowed empty"""
    print("\n" + "="*80)
    print("TEST D) NO-PLACEHOLDER — example_values ignored/allowed empty")
    print("="*80)
    
    name = f"qa_no_ph_{random_suffix()}"
    url = f"{BASE_URL}/salons/{salon_id}/marketing/templates/draft"
    payload = {
        "name": name,
        "category": "utility",
        "lang_code": "en",
        "body": "Thanks for booking with us!"
    }
    
    print(f"POST {url}")
    print(f"Body: {json.dumps(payload, indent=2)}")
    
    try:
        resp = requests.post(url, json=payload, headers=get_headers(), timeout=15)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        if resp.status_code == 200:
            body = resp.json()
            template_id = body.get("id")
            example_values = body.get("example_values")
            
            if template_id:
                created_template_ids.append(template_id)
                print(f"   Template ID: {template_id}")
            
            if example_values is None or example_values == {}:
                print(f"✅ PASS: Got 200 with example_values null or empty")
                print(f"   example_values: {example_values}")
            else:
                print(f"⚠️  NOTE: example_values is {example_values} (expected null/empty)")
            
            # Test with example_values sent but should be stripped
            print("\n   Testing with example_values={'1':'x'} (should be stripped)...")
            name2 = f"qa_no_ph_with_ex_{random_suffix()}"
            payload2 = {
                "name": name2,
                "category": "utility",
                "lang_code": "en",
                "body": "Thanks for booking with us!",
                "example_values": {"1": "x"}
            }
            resp2 = requests.post(url, json=payload2, headers=get_headers(), timeout=15)
            print(f"   Status: {resp2.status_code}")
            
            if resp2.status_code == 200:
                body2 = resp2.json()
                template_id2 = body2.get("id")
                example_values2 = body2.get("example_values")
                
                if template_id2:
                    created_template_ids.append(template_id2)
                
                if example_values2 is None or example_values2 == {}:
                    print(f"   ✅ PASS: example_values correctly stripped to null/empty")
                    return {"pass": True, "status": resp.status_code, "body": resp.text[:300]}
                else:
                    print(f"   ⚠️  NOTE: example_values not stripped: {example_values2}")
                    return {"pass": True, "status": resp.status_code, "body": resp.text[:300], "note": "example_values not stripped but no placeholders exist"}
            else:
                print(f"   ⚠️  Got {resp2.status_code} when sending example_values with no placeholders")
                return {"pass": True, "status": resp.status_code, "body": resp.text[:300], "note": "First test passed"}
        else:
            print(f"❌ FAIL: Expected 200, got {resp.status_code}")
            return {"pass": False, "status": resp.status_code, "body": resp.text[:300]}
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return {"pass": False, "error": str(e)}


def test_e_submit_twilio(template_id: Optional[str] = None):
    """E) SUBMIT SHAPE (Twilio) — should send variables field"""
    print("\n" + "="*80)
    print("TEST E) SUBMIT SHAPE (Twilio) — should send variables field")
    print("="*80)
    
    if not template_id and created_template_ids:
        template_id = created_template_ids[0]
    
    if not template_id:
        print("⚠️  SKIP: No template_id available from test C")
        return {"pass": False, "reason": "No template_id available"}
    
    url = f"{BASE_URL}/salons/{salon_id}/marketing/templates/{template_id}/submit"
    payload = {"provider": "twilio"}
    
    print(f"POST {url}")
    print(f"Body: {json.dumps(payload, indent=2)}")
    print(f"Template ID: {template_id}")
    
    try:
        resp = requests.post(url, json=payload, headers=get_headers(), timeout=20)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text[:500]}")
        
        # We expect either:
        # - 200 with provider="twilio", sid, approval_status (if Twilio succeeds)
        # - 502 with "Twilio create failed" or "Twilio approval submit failed" (if Twilio API fails)
        # - NOT 400 from our own code saying "Missing example value"
        # - NOT 500 (internal server error)
        
        if resp.status_code == 200:
            body = resp.json()
            provider = body.get("provider")
            sid = body.get("sid")
            approval_status = body.get("approval_status")
            
            if provider == "twilio" and sid and approval_status:
                print(f"✅ PASS: Got 200 with provider='twilio', sid={sid}, approval_status={approval_status}")
                print(f"   This means example_values were persisted and sent to Twilio")
                return {"pass": True, "status": resp.status_code, "body": resp.text[:300]}
            else:
                print(f"⚠️  PARTIAL: Got 200 but response structure incomplete")
                print(f"   provider={provider}, sid={sid}, approval_status={approval_status}")
                return {"pass": False, "status": resp.status_code, "body": resp.text[:300], "reason": "Response structure incomplete"}
        
        elif resp.status_code == 502:
            body_text = resp.text
            if "Twilio create failed" in body_text or "Twilio approval submit failed" in body_text:
                print(f"✅ PASS: Got 502 with Twilio error (expected in sandbox)")
                print(f"   This means our code sent the request correctly but Twilio rejected it")
                print(f"   Importantly, we did NOT get 400 'Missing example value' from our code")
                return {"pass": True, "status": resp.status_code, "body": resp.text[:300], "note": "Twilio API error (expected)"}
            else:
                print(f"⚠️  Got 502 but error message unexpected")
                return {"pass": False, "status": resp.status_code, "body": resp.text[:300], "reason": "Unexpected 502 error"}
        
        elif resp.status_code == 400:
            body_text = resp.text
            if "Missing example value" in body_text:
                print(f"❌ FAIL: Got 400 'Missing example value' from our own code")
                print(f"   This means example_values weren't persisted or weren't sent to Twilio")
                return {"pass": False, "status": resp.status_code, "body": resp.text[:300], "reason": "example_values not persisted"}
            else:
                print(f"⚠️  Got 400 with different error: {body_text[:200]}")
                return {"pass": False, "status": resp.status_code, "body": resp.text[:300], "reason": "Unexpected 400 error"}
        
        elif resp.status_code == 500:
            print(f"❌ FAIL: Got 500 Internal Server Error")
            return {"pass": False, "status": resp.status_code, "body": resp.text[:300], "reason": "Internal server error"}
        
        else:
            print(f"⚠️  Got unexpected status {resp.status_code}")
            return {"pass": False, "status": resp.status_code, "body": resp.text[:300], "reason": f"Unexpected status {resp.status_code}"}
    
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return {"pass": False, "error": str(e)}


def test_g_duplicate_name():
    """G) DUPLICATE NAME — should return 409"""
    print("\n" + "="*80)
    print("TEST G) DUPLICATE NAME — should return 409")
    print("="*80)
    
    # First create a template
    name = f"qa_duplicate_{random_suffix()}"
    url = f"{BASE_URL}/salons/{salon_id}/marketing/templates/draft"
    payload = {
        "name": name,
        "category": "utility",
        "lang_code": "en",
        "body": "Test duplicate name"
    }
    
    print(f"Creating first template with name: {name}")
    print(f"POST {url}")
    print(f"Body: {json.dumps(payload, indent=2)}")
    
    try:
        resp1 = requests.post(url, json=payload, headers=get_headers(), timeout=15)
        print(f"Status: {resp1.status_code}")
        print(f"Response: {resp1.text[:300]}")
        
        if resp1.status_code != 200:
            print(f"⚠️  SKIP: First template creation failed with {resp1.status_code}")
            return {"pass": False, "reason": "First template creation failed"}
        
        body1 = resp1.json()
        template_id = body1.get("id")
        if template_id:
            created_template_ids.append(template_id)
        
        print(f"✓ First template created with ID: {template_id}")
        
        # Now try to create another with the same name
        print(f"\nAttempting to create duplicate template with same name: {name}")
        resp2 = requests.post(url, json=payload, headers=get_headers(), timeout=15)
        print(f"Status: {resp2.status_code}")
        print(f"Response: {resp2.text[:300]}")
        
        if resp2.status_code == 409:
            body2_text = resp2.text
            if "Template name already exists" in body2_text or "already exists" in body2_text:
                print(f"✅ PASS: Got 409 with 'Template name already exists for this salon'")
                return {"pass": True, "status": resp2.status_code, "body": resp2.text[:300]}
            else:
                print(f"⚠️  PARTIAL: Got 409 but error message unexpected")
                return {"pass": False, "status": resp2.status_code, "body": resp2.text[:300], "reason": "Error message unexpected"}
        else:
            print(f"❌ FAIL: Expected 409, got {resp2.status_code}")
            return {"pass": False, "status": resp2.status_code, "body": resp2.text[:300]}
    
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return {"pass": False, "error": str(e)}


def cleanup_templates():
    """Cleanup: DELETE all templates created during testing"""
    print("\n" + "="*80)
    print("CLEANUP - Deleting all created templates")
    print("="*80)
    
    if not created_template_ids:
        print("No templates to clean up")
        return {"deleted": 0}
    
    deleted_count = 0
    failed_count = 0
    
    for template_id in created_template_ids:
        url = f"{BASE_URL}/salons/{salon_id}/marketing/templates/v2/{template_id}"
        print(f"\nDELETE {url}")
        
        try:
            resp = requests.delete(url, headers=get_headers(), timeout=15)
            print(f"Status: {resp.status_code}")
            
            if resp.status_code == 200:
                print(f"✓ Deleted template {template_id}")
                deleted_count += 1
            elif resp.status_code == 404:
                print(f"⚠️  Template {template_id} not found (may have been deleted already)")
                deleted_count += 1
            else:
                print(f"❌ Failed to delete template {template_id}: {resp.status_code}")
                print(f"   Response: {resp.text[:200]}")
                failed_count += 1
        except Exception as e:
            print(f"❌ Exception deleting template {template_id}: {e}")
            failed_count += 1
    
    print(f"\n{'='*80}")
    print(f"Cleanup Summary: {deleted_count} deleted, {failed_count} failed")
    print(f"{'='*80}")
    
    return {"deleted": deleted_count, "failed": failed_count}


def main():
    """Run all tests"""
    print("\n" + "="*80)
    print("WHATSAPP TEMPLATE EXAMPLE_VALUES FLOW - BACKEND TESTING")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Admin Identifier: {ADMIN_IDENTIFIER}")
    
    results = {}
    
    # Step 1: Login
    login_result = login_admin()
    if not login_result.get("success"):
        print("\n❌ CRITICAL: Admin login failed - cannot proceed with tests")
        return
    
    # Step 2: Run all test cases
    results["A_missing_examples"] = test_a_draft_missing_examples()
    results["B_partial_examples"] = test_b_draft_partial_examples()
    results["C_full_examples"] = test_c_draft_full_examples()
    results["D_no_placeholder"] = test_d_no_placeholder()
    
    # Test E uses template from test C
    template_id_for_submit = None
    if results["C_full_examples"].get("pass") and results["C_full_examples"].get("template_id"):
        template_id_for_submit = results["C_full_examples"]["template_id"]
    results["E_submit_twilio"] = test_e_submit_twilio(template_id_for_submit)
    
    results["G_duplicate_name"] = test_g_duplicate_name()
    
    # Step 3: Cleanup
    cleanup_result = cleanup_templates()
    
    # Step 4: Summary
    print("\n" + "="*80)
    print("FINAL SUMMARY")
    print("="*80)
    
    passed = sum(1 for r in results.values() if r.get("pass"))
    total = len(results)
    
    print(f"\nTest Results: {passed}/{total} PASSED\n")
    
    for test_name, result in results.items():
        status = "✅ PASS" if result.get("pass") else "❌ FAIL"
        print(f"{status} - {test_name}")
        if not result.get("pass") and result.get("reason"):
            print(f"       Reason: {result['reason']}")
        if result.get("note"):
            print(f"       Note: {result['note']}")
    
    print(f"\nCleanup: {cleanup_result.get('deleted', 0)} templates deleted")
    
    print("\n" + "="*80)
    print("TESTING COMPLETE")
    print("="*80)


if __name__ == "__main__":
    main()
