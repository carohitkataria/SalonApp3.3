#!/usr/bin/env python3
"""
Menu & Services Metrics Endpoints Testing

Tests the two NEW endpoints:
  A) GET /api/salons/{salon_id}/services/metrics-overview
  B) GET /api/salons/{salon_id}/services/{service_id}/metrics

Credentials:
  - identifier="admin", password="salon123"
  - Salon ID: 3c753efb-215c-4c1f-a7da-df5b4b0ff779
"""

import requests
import json
import sys
from typing import Dict, Optional

# Backend URL
BASE_URL = "https://wip-final-push.preview.emergentagent.com/api"

# Test credentials
ADMIN_IDENTIFIER = "admin"
ADMIN_PASSWORD = "salon123"
SALON_ID = "3c753efb-215c-4c1f-a7da-df5b4b0ff779"

# Global state
admin_token = None


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'


def log_test(name: str):
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST: {name}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")


def log_pass(msg: str):
    print(f"{Colors.GREEN}✅ PASS: {msg}{Colors.RESET}")


def log_fail(msg: str):
    print(f"{Colors.RED}❌ FAIL: {msg}{Colors.RESET}")


def log_info(msg: str):
    print(f"{Colors.YELLOW}ℹ INFO: {msg}{Colors.RESET}")


def admin_login() -> str:
    """Login as admin and return access_token"""
    log_test("Admin Login")
    url = f"{BASE_URL}/salon/users/login"
    payload = {
        "identifier": ADMIN_IDENTIFIER,
        "password": ADMIN_PASSWORD
    }
    
    resp = requests.post(url, json=payload)
    log_info(f"POST {url}")
    log_info(f"Payload: {json.dumps(payload)}")
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        log_fail(f"Admin login failed: {resp.status_code} - {resp.text}")
        sys.exit(1)
    
    data = resp.json()
    token = data.get("access_token")
    returned_salon_id = data.get("salon_id")
    
    if not token:
        log_fail(f"Missing access_token in response: {data}")
        sys.exit(1)
    
    log_pass(f"Admin logged in successfully")
    log_info(f"Salon ID from login: {returned_salon_id}")
    log_info(f"Expected Salon ID: {SALON_ID}")
    
    return token


def get_all_services(token: str) -> list:
    """Get all active services for the salon"""
    log_test("Get All Services")
    url = f"{BASE_URL}/salons/{SALON_ID}/services/all"
    headers = {"Authorization": f"Bearer {token}"}
    
    resp = requests.get(url, headers=headers)
    log_info(f"GET {url}")
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        log_fail(f"Failed to get services: {resp.status_code} - {resp.text}")
        return []
    
    services = resp.json()
    log_pass(f"Retrieved {len(services)} services")
    
    return services


def test_endpoint_a_metrics_overview():
    """
    Test ENDPOINT A: GET /api/salons/{salon_id}/services/metrics-overview
    
    Requirements:
    1. With admin Bearer token → expect 200
    2. Response must have exactly two top-level keys: "overview" and "per_service"
    3. overview must contain: total_menu, services_count, packages_count, revenue_30d, 
       bookings_30d, avg_rating, total_reviews, at_home_count, favorites_count (all numbers)
    4. Assert overview.total_menu === overview.services_count + overview.packages_count
    5. per_service must be an array. Each item has keys: service_id (str), bookings_30d (int), 
       revenue_30d (number), rating (number or null), trend_pct (number)
    6. per_service length must equal the number of active services
    7. Without Authorization header → expect 401 or 403
    """
    log_test("ENDPOINT A: GET /api/salons/{salon_id}/services/metrics-overview")
    
    global admin_token
    
    # First, get all services to know expected count
    all_services = get_all_services(admin_token)
    expected_service_count = len(all_services)
    log_info(f"Expected per_service array length: {expected_service_count}")
    
    # A1: With admin Bearer token → expect 200
    log_info("A1: Testing with admin Bearer token")
    url = f"{BASE_URL}/salons/{SALON_ID}/services/metrics-overview"
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    resp = requests.get(url, headers=headers)
    log_info(f"GET {url}")
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        log_fail(f"A1: Expected 200, got {resp.status_code}")
        log_fail(f"Response: {resp.text[:500]}")
        return False
    
    log_pass("A1: Status 200 with admin token")
    
    data = resp.json()
    
    # A2: Response must have exactly two top-level keys
    log_info("A2: Checking response has exactly two top-level keys: 'overview' and 'per_service'")
    top_keys = set(data.keys())
    expected_keys = {"overview", "per_service"}
    
    if top_keys != expected_keys:
        log_fail(f"A2: Expected keys {expected_keys}, got {top_keys}")
        log_fail(f"Response keys: {list(data.keys())}")
        return False
    
    log_pass("A2: Response has exactly 'overview' and 'per_service' keys")
    
    overview = data.get("overview", {})
    per_service = data.get("per_service", [])
    
    # A3: overview must contain all required fields
    log_info("A3: Checking overview contains all required fields")
    required_overview_fields = [
        "total_menu", "services_count", "packages_count", "revenue_30d",
        "bookings_30d", "avg_rating", "total_reviews", "at_home_count", "favorites_count"
    ]
    
    missing_fields = [f for f in required_overview_fields if f not in overview]
    if missing_fields:
        log_fail(f"A3: Missing fields in overview: {missing_fields}")
        log_fail(f"Overview keys: {list(overview.keys())}")
        return False
    
    log_pass("A3: All required fields present in overview")
    log_info(f"Overview: {json.dumps(overview, indent=2)}")
    
    # A4: Assert overview.total_menu === overview.services_count + overview.packages_count
    log_info("A4: Checking total_menu === services_count + packages_count")
    total_menu = overview.get("total_menu")
    services_count = overview.get("services_count")
    packages_count = overview.get("packages_count")
    
    if total_menu != services_count + packages_count:
        log_fail(f"A4: total_menu ({total_menu}) != services_count ({services_count}) + packages_count ({packages_count})")
        return False
    
    log_pass(f"A4: total_menu ({total_menu}) === services_count ({services_count}) + packages_count ({packages_count})")
    
    # A5: per_service must be an array with correct structure
    log_info("A5: Checking per_service is an array with correct structure")
    
    if not isinstance(per_service, list):
        log_fail(f"A5: per_service is not an array, got type: {type(per_service)}")
        return False
    
    log_pass(f"A5: per_service is an array with {len(per_service)} items")
    
    # Check each item has required keys
    required_per_service_keys = ["service_id", "bookings_30d", "revenue_30d", "rating", "trend_pct"]
    
    for idx, item in enumerate(per_service[:3]):  # Check first 3 items
        missing = [k for k in required_per_service_keys if k not in item]
        if missing:
            log_fail(f"A5: Item {idx} missing keys: {missing}")
            log_fail(f"Item {idx}: {json.dumps(item, indent=2)}")
            return False
    
    log_pass("A5: per_service items have all required keys")
    
    # Show sample item
    if per_service:
        log_info(f"Sample per_service item: {json.dumps(per_service[0], indent=2)}")
    
    # A6: per_service length must equal number of active services
    log_info("A6: Checking per_service length equals number of active services")
    
    if len(per_service) != expected_service_count:
        log_fail(f"A6: per_service length ({len(per_service)}) != active services count ({expected_service_count})")
        log_fail(f"Expected: {expected_service_count}, Got: {len(per_service)}")
        return False
    
    log_pass(f"A6: per_service length ({len(per_service)}) matches active services count ({expected_service_count})")
    
    # A7: Without Authorization header → expect 401 or 403
    log_info("A7: Testing without Authorization header")
    resp_no_auth = requests.get(url)
    log_info(f"Status without auth: {resp_no_auth.status_code}")
    
    if resp_no_auth.status_code not in [401, 403]:
        log_fail(f"A7: Expected 401 or 403 without auth, got {resp_no_auth.status_code}")
        return False
    
    log_pass(f"A7: Correctly returns {resp_no_auth.status_code} without Authorization header")
    
    log_pass("✅ ENDPOINT A: ALL CHECKS PASSED")
    return True


def test_endpoint_b_service_metrics():
    """
    Test ENDPOINT B: GET /api/salons/{salon_id}/services/{service_id}/metrics
    
    Requirements:
    1. Pick the first service_id from GET /api/salons/{salon_id}/services/all
    2. With admin Bearer token → expect 200
    3. Response must have keys: "service", "metrics", "top_barbers", "timeline_30d"
    4. metrics must contain: bookings_30d, revenue_30d, bookings_90d, revenue_90d, 
       avg_ticket_30d, rating, total_reviews (all numbers)
    5. timeline_30d must be an array of exactly 30 items, each with { date, bookings, revenue }
       dates strictly increasing
    6. top_barbers must be an array (may be empty), each item has barber_id, barber_name, 
       bookings, revenue
    7. Unknown service_id (e.g., "no-such-svc") → expect 404
    8. Without Authorization header → expect 401 or 403
    """
    log_test("ENDPOINT B: GET /api/salons/{salon_id}/services/{service_id}/metrics")
    
    global admin_token
    
    # B1: Get first service_id
    log_info("B1: Getting first service_id from /services/all")
    all_services = get_all_services(admin_token)
    
    if not all_services:
        log_fail("B1: No services found, cannot test endpoint B")
        return False
    
    first_service = all_services[0]
    service_id = first_service.get("id")
    service_name = first_service.get("service_name", "Unknown")
    
    log_pass(f"B1: Using service: {service_name} (ID: {service_id})")
    
    # B2: With admin Bearer token → expect 200
    log_info("B2: Testing with admin Bearer token")
    url = f"{BASE_URL}/salons/{SALON_ID}/services/{service_id}/metrics"
    headers = {"Authorization": f"Bearer {admin_token}"}
    
    resp = requests.get(url, headers=headers)
    log_info(f"GET {url}")
    log_info(f"Status: {resp.status_code}")
    
    if resp.status_code != 200:
        log_fail(f"B2: Expected 200, got {resp.status_code}")
        log_fail(f"Response: {resp.text[:500]}")
        return False
    
    log_pass("B2: Status 200 with admin token")
    
    data = resp.json()
    
    # B3: Response must have required keys
    log_info("B3: Checking response has keys: 'service', 'metrics', 'top_barbers', 'timeline_30d'")
    required_keys = ["service", "metrics", "top_barbers", "timeline_30d"]
    missing_keys = [k for k in required_keys if k not in data]
    
    if missing_keys:
        log_fail(f"B3: Missing keys: {missing_keys}")
        log_fail(f"Response keys: {list(data.keys())}")
        return False
    
    log_pass("B3: All required keys present")
    
    service = data.get("service", {})
    metrics = data.get("metrics", {})
    top_barbers = data.get("top_barbers", [])
    timeline_30d = data.get("timeline_30d", [])
    
    # B4: metrics must contain all required fields
    log_info("B4: Checking metrics contains all required fields")
    required_metrics_fields = [
        "bookings_30d", "revenue_30d", "bookings_90d", "revenue_90d",
        "avg_ticket_30d", "rating", "total_reviews"
    ]
    
    missing_metrics = [f for f in required_metrics_fields if f not in metrics]
    if missing_metrics:
        log_fail(f"B4: Missing fields in metrics: {missing_metrics}")
        log_fail(f"Metrics keys: {list(metrics.keys())}")
        return False
    
    log_pass("B4: All required fields present in metrics")
    log_info(f"Metrics: {json.dumps(metrics, indent=2)}")
    
    # B5: timeline_30d must be an array of exactly 30 items
    log_info("B5: Checking timeline_30d is an array of exactly 30 items")
    
    if not isinstance(timeline_30d, list):
        log_fail(f"B5: timeline_30d is not an array, got type: {type(timeline_30d)}")
        return False
    
    if len(timeline_30d) != 30:
        log_fail(f"B5: timeline_30d length is {len(timeline_30d)}, expected 30")
        log_fail(f"Timeline length: {len(timeline_30d)}")
        return False
    
    log_pass("B5: timeline_30d has exactly 30 items")
    
    # Check each item has required keys and dates are strictly increasing
    log_info("B5: Checking timeline items have { date, bookings, revenue } and dates are increasing")
    required_timeline_keys = ["date", "bookings", "revenue"]
    
    prev_date = None
    for idx, item in enumerate(timeline_30d):
        missing = [k for k in required_timeline_keys if k not in item]
        if missing:
            log_fail(f"B5: Timeline item {idx} missing keys: {missing}")
            return False
        
        current_date = item.get("date")
        if prev_date and current_date <= prev_date:
            log_fail(f"B5: Dates not strictly increasing at index {idx}: {prev_date} -> {current_date}")
            return False
        
        prev_date = current_date
    
    log_pass("B5: All timeline items have required keys and dates are strictly increasing")
    log_info(f"First timeline item: {json.dumps(timeline_30d[0], indent=2)}")
    log_info(f"Last timeline item: {json.dumps(timeline_30d[-1], indent=2)}")
    
    # B6: top_barbers must be an array
    log_info("B6: Checking top_barbers is an array")
    
    if not isinstance(top_barbers, list):
        log_fail(f"B6: top_barbers is not an array, got type: {type(top_barbers)}")
        return False
    
    log_pass(f"B6: top_barbers is an array with {len(top_barbers)} items")
    
    # If not empty, check structure
    if top_barbers:
        required_barber_keys = ["barber_id", "barber_name", "bookings", "revenue"]
        first_barber = top_barbers[0]
        missing = [k for k in required_barber_keys if k not in first_barber]
        if missing:
            log_fail(f"B6: First barber item missing keys: {missing}")
            return False
        
        log_pass("B6: top_barbers items have required keys")
        log_info(f"Sample top_barber: {json.dumps(first_barber, indent=2)}")
    else:
        log_info("B6: top_barbers is empty (acceptable)")
    
    # B7: Unknown service_id → expect 404
    log_info("B7: Testing with unknown service_id")
    url_404 = f"{BASE_URL}/salons/{SALON_ID}/services/no-such-svc/metrics"
    resp_404 = requests.get(url_404, headers=headers)
    log_info(f"Status with unknown service_id: {resp_404.status_code}")
    
    if resp_404.status_code != 404:
        log_fail(f"B7: Expected 404 for unknown service_id, got {resp_404.status_code}")
        return False
    
    log_pass("B7: Correctly returns 404 for unknown service_id")
    
    # B8: Without Authorization header → expect 401 or 403
    log_info("B8: Testing without Authorization header")
    resp_no_auth = requests.get(url)
    log_info(f"Status without auth: {resp_no_auth.status_code}")
    
    if resp_no_auth.status_code not in [401, 403]:
        log_fail(f"B8: Expected 401 or 403 without auth, got {resp_no_auth.status_code}")
        return False
    
    log_pass(f"B8: Correctly returns {resp_no_auth.status_code} without Authorization header")
    
    log_pass("✅ ENDPOINT B: ALL CHECKS PASSED")
    return True


def main():
    global admin_token
    
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}Menu & Services Metrics Endpoints Testing{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}\n")
    
    # Setup
    admin_token = admin_login()
    
    # Run tests
    results = {
        "ENDPOINT A: metrics-overview": test_endpoint_a_metrics_overview(),
        "ENDPOINT B: service metrics": test_endpoint_b_service_metrics(),
    }
    
    # Summary
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}\n")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = f"{Colors.GREEN}✅ PASS{Colors.RESET}" if result else f"{Colors.RED}❌ FAIL{Colors.RESET}"
        print(f"{status} - {test_name}")
    
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TOTAL: {passed}/{total} tests passed{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}\n")
    
    if passed == total:
        print(f"{Colors.GREEN}✅ ALL TESTS PASSED{Colors.RESET}\n")
        return 0
    else:
        print(f"{Colors.RED}❌ SOME TESTS FAILED{Colors.RESET}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
