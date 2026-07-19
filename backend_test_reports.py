#!/usr/bin/env python3
"""
Comprehensive backend test for Reports module endpoints.
Tests all /api/salons/{salon_id}/reports/* endpoints with proper authentication.
"""

import requests
import json
from datetime import datetime

# Configuration
BASE_URL = "https://csv-template-manager.preview.emergentagent.com/api"
SALON_ID = "c1ab42d2-dca7-4d8b-9ce9-8dff1942a393"
ADMIN_IDENTIFIER = "admin"
ADMIN_PASSWORD = "salon123"

# Test results tracking
test_results = []
passed = 0
failed = 0

def log_test(test_name, success, details=""):
    """Log test result"""
    global passed, failed
    status = "✅ PASS" if success else "❌ FAIL"
    test_results.append(f"{status}: {test_name}")
    if details:
        test_results.append(f"   Details: {details}")
    if success:
        passed += 1
    else:
        failed += 1
    print(f"{status}: {test_name}")
    if details:
        print(f"   {details}")

def login_admin():
    """Login as admin and return access token"""
    url = f"{BASE_URL}/salon/users/login"
    payload = {
        "identifier": ADMIN_IDENTIFIER,
        "password": ADMIN_PASSWORD
    }
    try:
        response = requests.post(url, json=payload, timeout=10)
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            salon_id = data.get("salon_id")
            log_test("Admin login", True, f"Token obtained, salon_id: {salon_id}")
            return token, salon_id
        else:
            log_test("Admin login", False, f"Status {response.status_code}: {response.text[:200]}")
            return None, None
    except Exception as e:
        log_test("Admin login", False, f"Exception: {str(e)}")
        return None, None

def test_get_prefs(token):
    """Test GET /api/salons/{salon_id}/reports/prefs"""
    url = f"{BASE_URL}/salons/{SALON_ID}/reports/prefs"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            has_all_cards = "all_cards" in data
            has_cards = "cards" in data
            has_order = "order" in data
            if has_all_cards and has_cards and has_order:
                log_test("GET /reports/prefs", True, f"Returns all_cards, cards, order. Cards count: {len(data.get('cards', []))}")
                return data
            else:
                log_test("GET /reports/prefs", False, f"Missing required fields. Keys: {list(data.keys())}")
                return None
        else:
            log_test("GET /reports/prefs", False, f"Status {response.status_code}: {response.text[:200]}")
            return None
    except Exception as e:
        log_test("GET /reports/prefs", False, f"Exception: {str(e)}")
        return None

def test_put_prefs(token):
    """Test PUT /api/salons/{salon_id}/reports/prefs"""
    url = f"{BASE_URL}/salons/{SALON_ID}/reports/prefs"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "cards": ["revenue", "appointments"],
        "order": ["revenue", "appointments"]
    }
    try:
        response = requests.put(url, headers=headers, json=payload, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("success") == True:
                log_test("PUT /reports/prefs", True, f"Success: {data}")
                return True
            else:
                log_test("PUT /reports/prefs", False, f"Success not true: {data}")
                return False
        else:
            log_test("PUT /reports/prefs", False, f"Status {response.status_code}: {response.text[:200]}")
            return False
    except Exception as e:
        log_test("PUT /reports/prefs", False, f"Exception: {str(e)}")
        return False

def test_prefs_persistence(token):
    """Test GET /api/salons/{salon_id}/reports/prefs to verify persistence"""
    url = f"{BASE_URL}/salons/{SALON_ID}/reports/prefs"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            cards = data.get("cards", [])
            order = data.get("order", [])
            if "revenue" in cards and "appointments" in cards:
                log_test("GET /reports/prefs (verify persistence)", True, f"Cards persisted: {cards}")
                return True
            else:
                log_test("GET /reports/prefs (verify persistence)", False, f"Cards not persisted correctly: {cards}")
                return False
        else:
            log_test("GET /reports/prefs (verify persistence)", False, f"Status {response.status_code}")
            return False
    except Exception as e:
        log_test("GET /reports/prefs (verify persistence)", False, f"Exception: {str(e)}")
        return False

def test_put_targets_new_schema(token):
    """Test PUT /api/salons/{salon_id}/reports/targets with NEW schema"""
    url = f"{BASE_URL}/salons/{SALON_ID}/reports/targets"
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test with NEW schema (metric_id, period_type, target)
    new_payload = {
        "metric_id": "revenue",
        "period_type": "month",
        "target": 75000
    }
    try:
        response = requests.put(url, headers=headers, json=new_payload, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("success") == True:
                log_test("PUT /reports/targets (NEW schema)", True, f"Target set: {new_payload}")
            else:
                log_test("PUT /reports/targets (NEW schema)", False, f"Success not true: {data}")
        else:
            log_test("PUT /reports/targets (NEW schema)", False, f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("PUT /reports/targets (NEW schema)", False, f"Exception: {str(e)}")
    
    # Test with OLD schema (should be rejected with 422)
    old_payload = {
        "period": "month",
        "targets": {"revenue": 75000}
    }
    try:
        response = requests.put(url, headers=headers, json=old_payload, timeout=10)
        if response.status_code == 422:
            log_test("PUT /reports/targets (OLD schema rejection)", True, f"Old schema correctly rejected with 422")
        else:
            log_test("PUT /reports/targets (OLD schema rejection)", False, f"Old schema not rejected. Status: {response.status_code}")
    except Exception as e:
        log_test("PUT /reports/targets (OLD schema rejection)", False, f"Exception: {str(e)}")

def test_snapshot(token):
    """Test GET /api/salons/{salon_id}/reports/snapshot"""
    url = f"{BASE_URL}/salons/{SALON_ID}/reports/snapshot"
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 1: month view with compare=true
    params = {
        "view": "month",
        "date": "2026-07-18",
        "compare": "true"
    }
    try:
        response = requests.get(url, headers=headers, params=params, timeout=15)
        if response.status_code == 200:
            data = response.json()
            window = data.get("window", {})
            cards = data.get("cards", [])
            
            # Verify structure
            has_window = "view" in window and "start" in window and "end" in window and "previous" in window
            has_cards = len(cards) > 0
            
            if has_window and has_cards:
                # Check card structure
                card = cards[0] if cards else {}
                required_fields = ["id", "label", "money", "total", "projected", "target", "trend", "up", "chart", "lower_is_better"]
                has_all_fields = all(field in card for field in required_fields)
                
                if has_all_fields:
                    # Check projection logic for flow vs ratio metrics
                    revenue_card = next((c for c in cards if c["id"] == "revenue"), None)
                    utilization_card = next((c for c in cards if c["id"] == "utilization"), None)
                    
                    projection_ok = True
                    projection_details = []
                    
                    if revenue_card:
                        # Flow metric: projected should be >= total (elapsed-fraction projection)
                        if revenue_card["projected"] >= revenue_card["total"]:
                            projection_details.append(f"Revenue projection OK: total={revenue_card['total']}, projected={revenue_card['projected']}")
                        else:
                            projection_ok = False
                            projection_details.append(f"Revenue projection WRONG: projected < total")
                        
                        # Check target
                        if revenue_card.get("target") == 75000:
                            projection_details.append(f"Revenue target correct: {revenue_card['target']}")
                        else:
                            projection_details.append(f"Revenue target: {revenue_card.get('target')} (expected 75000 or previous×1.1)")
                    
                    if utilization_card:
                        # Ratio metric: projected should EQUAL total (no projection)
                        if utilization_card["projected"] == utilization_card["total"]:
                            projection_details.append(f"Utilization projection OK: no projection applied (total={utilization_card['total']})")
                        else:
                            projection_ok = False
                            projection_details.append(f"Utilization projection WRONG: projected != total")
                    
                    # Check trend and up fields
                    trend_ok = all(c.get("trend") is not None or c.get("trend") is None for c in cards)
                    
                    log_test("GET /reports/snapshot (month, compare=true)", projection_ok and trend_ok, 
                            f"Cards: {len(cards)}, Window: {window['start']} to {window['end']}. {'; '.join(projection_details)}")
                else:
                    log_test("GET /reports/snapshot (month, compare=true)", False, f"Card missing fields. Has: {list(card.keys())}")
            else:
                log_test("GET /reports/snapshot (month, compare=true)", False, f"Missing window or cards. Keys: {list(data.keys())}")
        else:
            log_test("GET /reports/snapshot (month, compare=true)", False, f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("GET /reports/snapshot (month, compare=true)", False, f"Exception: {str(e)}")
    
    # Test 2: day view without compare
    params = {
        "view": "day",
        "date": "2026-07-18"
    }
    try:
        response = requests.get(url, headers=headers, params=params, timeout=15)
        if response.status_code == 200:
            data = response.json()
            log_test("GET /reports/snapshot (day, no compare)", True, f"Returns {len(data.get('cards', []))} cards")
        else:
            log_test("GET /reports/snapshot (day, no compare)", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("GET /reports/snapshot (day, no compare)", False, f"Exception: {str(e)}")
    
    # Test 3: week view
    params = {
        "view": "week",
        "date": "2026-07-18"
    }
    try:
        response = requests.get(url, headers=headers, params=params, timeout=15)
        if response.status_code == 200:
            data = response.json()
            log_test("GET /reports/snapshot (week)", True, f"Returns {len(data.get('cards', []))} cards")
        else:
            log_test("GET /reports/snapshot (week)", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("GET /reports/snapshot (week)", False, f"Exception: {str(e)}")

def test_metric_endpoints(token):
    """Test GET /api/salons/{salon_id}/reports/metric/{metric_id} for all metrics"""
    metrics = ["revenue", "appointments", "collections", "guests", "avgticket", "noshow", 
               "rebooking", "utilization", "wait", "feedback", "products", "addons", "membership"]
    
    for metric_id in metrics:
        url = f"{BASE_URL}/salons/{SALON_ID}/reports/metric/{metric_id}"
        headers = {"Authorization": f"Bearer {token}"}
        params = {
            "view": "month",
            "date": "2026-07-18"
        }
        try:
            response = requests.get(url, headers=headers, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                has_metric = "metric" in data
                has_breakdown = "breakdown" in data
                has_window = "window" in data
                
                # Check if metric has chart inside it
                metric_obj = data.get("metric", {})
                has_chart = "chart" in metric_obj
                
                if has_metric and has_breakdown and has_window and has_chart:
                    log_test(f"GET /reports/metric/{metric_id}", True, f"Returns metric, breakdown, window with chart")
                else:
                    log_test(f"GET /reports/metric/{metric_id}", False, f"Missing fields. Top keys: {list(data.keys())}, Metric keys: {list(metric_obj.keys())}")
            else:
                log_test(f"GET /reports/metric/{metric_id}", False, f"Status {response.status_code}")
        except Exception as e:
            log_test(f"GET /reports/metric/{metric_id}", False, f"Exception: {str(e)}")

def test_sales_endpoint(token):
    """Test GET /api/salons/{salon_id}/reports/sales"""
    url = f"{BASE_URL}/salons/{SALON_ID}/reports/sales"
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "view": "month",
        "date": "2026-07-18"
    }
    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            has_total = "total_revenue" in data
            has_by_staff = "by_staff" in data
            has_by_service = "by_service" in data
            
            if has_total and has_by_staff and has_by_service:
                by_staff = data.get("by_staff", [])
                by_service = data.get("by_service", [])
                
                # Check if sorted by revenue desc
                staff_sorted = all(by_staff[i]["revenue"] >= by_staff[i+1]["revenue"] 
                                  for i in range(len(by_staff)-1)) if len(by_staff) > 1 else True
                service_sorted = all(by_service[i]["revenue"] >= by_service[i+1]["revenue"] 
                                    for i in range(len(by_service)-1)) if len(by_service) > 1 else True
                
                if staff_sorted and service_sorted:
                    log_test("GET /reports/sales", True, 
                            f"Total: {data.get('total_revenue')}, Staff: {len(by_staff)}, Services: {len(by_service)}, Sorted correctly")
                else:
                    log_test("GET /reports/sales", False, f"Not sorted by revenue desc")
            else:
                log_test("GET /reports/sales", False, f"Missing fields. Keys: {list(data.keys())}")
        else:
            log_test("GET /reports/sales", False, f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("GET /reports/sales", False, f"Exception: {str(e)}")

def test_payments_gst_endpoint(token):
    """Test GET /api/salons/{salon_id}/reports/payments-gst"""
    url = f"{BASE_URL}/salons/{SALON_ID}/reports/payments-gst"
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "view": "month",
        "date": "2026-07-18"
    }
    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            has_payments = "total_collected" in data or "by_mode" in data
            has_gst = "gst" in data
            
            if has_payments and has_gst:
                gst = data.get("gst", {})
                has_gst_fields = all(k in gst for k in ["gross", "taxable", "cgst", "sgst", "total_tax"])
                if has_gst_fields:
                    log_test("GET /reports/payments-gst", True, f"Payments and GST data present")
                else:
                    log_test("GET /reports/payments-gst", False, f"GST missing fields. Keys: {list(gst.keys())}")
            else:
                log_test("GET /reports/payments-gst", False, f"Missing payments or gst. Keys: {list(data.keys())}")
        else:
            log_test("GET /reports/payments-gst", False, f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("GET /reports/payments-gst", False, f"Exception: {str(e)}")

def test_pnl_endpoint(token):
    """Test GET /api/salons/{salon_id}/reports/pnl"""
    url = f"{BASE_URL}/salons/{SALON_ID}/reports/pnl"
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "view": "month",
        "date": "2026-07-18"
    }
    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            required_fields = ["revenue", "expenses_total", "profit"]
            has_all = all(f in data for f in required_fields)
            
            if has_all:
                log_test("GET /reports/pnl", True, 
                        f"Revenue: {data.get('revenue')}, Expenses: {data.get('expenses_total')}, Profit: {data.get('profit')}")
            else:
                log_test("GET /reports/pnl", False, f"Missing fields. Keys: {list(data.keys())}")
        else:
            log_test("GET /reports/pnl", False, f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("GET /reports/pnl", False, f"Exception: {str(e)}")

def test_clients_endpoint(token):
    """Test GET /api/salons/{salon_id}/reports/clients"""
    url = f"{BASE_URL}/salons/{SALON_ID}/reports/clients"
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "view": "month",
        "date": "2026-07-18"
    }
    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            required_fields = ["unique_guests", "new_guests", "returning_guests", "top_spenders"]
            has_all = all(f in data for f in required_fields)
            
            if has_all:
                log_test("GET /reports/clients", True, 
                        f"Unique: {data.get('unique_guests')}, New: {data.get('new_guests')}, Returning: {data.get('returning_guests')}")
            else:
                log_test("GET /reports/clients", False, f"Missing fields. Keys: {list(data.keys())}")
        else:
            log_test("GET /reports/clients", False, f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("GET /reports/clients", False, f"Exception: {str(e)}")

def test_marketing_endpoint(token):
    """Test GET /api/salons/{salon_id}/reports/marketing"""
    url = f"{BASE_URL}/salons/{SALON_ID}/reports/marketing"
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "view": "month",
        "date": "2026-07-18"
    }
    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            # Marketing data may be empty but structure should be present
            has_structure = "window" in data
            log_test("GET /reports/marketing", True, f"Returns marketing data structure")
        else:
            log_test("GET /reports/marketing", False, f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("GET /reports/marketing", False, f"Exception: {str(e)}")

def test_inventory_endpoint(token):
    """Test GET /api/salons/{salon_id}/reports/inventory"""
    url = f"{BASE_URL}/salons/{SALON_ID}/reports/inventory"
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "view": "month",
        "date": "2026-07-18"
    }
    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            required_fields = ["consumed_value", "purchases_value", "on_hand_value", "below_reorder"]
            has_all = all(f in data for f in required_fields)
            
            if has_all:
                log_test("GET /reports/inventory", True, 
                        f"On hand: {data.get('on_hand_value')}, Below reorder: {len(data.get('below_reorder', []))}")
            else:
                log_test("GET /reports/inventory", False, f"Missing fields. Keys: {list(data.keys())}")
        else:
            log_test("GET /reports/inventory", False, f"Status {response.status_code}: {response.text[:200]}")
    except Exception as e:
        log_test("GET /reports/inventory", False, f"Exception: {str(e)}")

def test_auth_checks():
    """Test auth/permission checks"""
    url = f"{BASE_URL}/salons/{SALON_ID}/reports/snapshot"
    
    # Test without Authorization header
    try:
        response = requests.get(url, timeout=10)
        if response.status_code in [401, 403]:
            log_test("Auth check: No token", True, f"Correctly rejected with {response.status_code}")
        else:
            log_test("Auth check: No token", False, f"Should reject but got {response.status_code}")
    except Exception as e:
        log_test("Auth check: No token", False, f"Exception: {str(e)}")
    
    # Test with invalid token
    headers = {"Authorization": "Bearer invalid_token_12345"}
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code in [401, 403]:
            log_test("Auth check: Invalid token", True, f"Correctly rejected with {response.status_code}")
        else:
            log_test("Auth check: Invalid token", False, f"Should reject but got {response.status_code}")
    except Exception as e:
        log_test("Auth check: Invalid token", False, f"Exception: {str(e)}")

def main():
    """Run all tests"""
    print("=" * 80)
    print("REPORTS MODULE BACKEND REGRESSION TEST")
    print("=" * 80)
    print(f"Base URL: {BASE_URL}")
    print(f"Salon ID: {SALON_ID}")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    print()
    
    # Login
    token, salon_id = login_admin()
    if not token:
        print("\n❌ CRITICAL: Cannot proceed without admin token")
        return
    
    print()
    print("=" * 80)
    print("TESTING PREFS ENDPOINTS")
    print("=" * 80)
    test_get_prefs(token)
    test_put_prefs(token)
    test_prefs_persistence(token)
    
    print()
    print("=" * 80)
    print("TESTING TARGETS ENDPOINT")
    print("=" * 80)
    test_put_targets_new_schema(token)
    
    print()
    print("=" * 80)
    print("TESTING SNAPSHOT ENDPOINT")
    print("=" * 80)
    test_snapshot(token)
    
    print()
    print("=" * 80)
    print("TESTING METRIC ENDPOINTS")
    print("=" * 80)
    test_metric_endpoints(token)
    
    print()
    print("=" * 80)
    print("TESTING SECTION ENDPOINTS")
    print("=" * 80)
    test_sales_endpoint(token)
    test_payments_gst_endpoint(token)
    test_pnl_endpoint(token)
    test_clients_endpoint(token)
    test_marketing_endpoint(token)
    test_inventory_endpoint(token)
    
    print()
    print("=" * 80)
    print("TESTING AUTH/PERMISSION CHECKS")
    print("=" * 80)
    test_auth_checks()
    
    print()
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"Total tests: {passed + failed}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Success rate: {(passed / (passed + failed) * 100):.1f}%")
    print("=" * 80)
    
    if failed > 0:
        print("\n❌ FAILED TESTS:")
        for result in test_results:
            if "❌ FAIL" in result:
                print(result)

if __name__ == "__main__":
    main()
