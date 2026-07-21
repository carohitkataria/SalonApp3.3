#!/usr/bin/env python3
"""
Detailed verification test for specific Reports module requirements from review request.
"""

import requests
import json

BASE_URL = "https://wip-final-push.preview.emergentagent.com/api"
SALON_ID = "c1ab42d2-dca7-4d8b-9ce9-8dff1942a393"
ADMIN_IDENTIFIER = "admin"
ADMIN_PASSWORD = "salon123"

def login_admin():
    """Login as admin and return access token"""
    url = f"{BASE_URL}/salon/users/login"
    payload = {"identifier": ADMIN_IDENTIFIER, "password": ADMIN_PASSWORD}
    response = requests.post(url, json=payload, timeout=10)
    if response.status_code == 200:
        return response.json().get("access_token")
    return None

def test_sales_response_structure(token):
    """Verify sales endpoint response structure matches review request"""
    url = f"{BASE_URL}/salons/{SALON_ID}/reports/sales"
    headers = {"Authorization": f"Bearer {token}"}
    params = {"view": "month", "date": "2026-07-18"}
    
    response = requests.get(url, headers=headers, params=params, timeout=10)
    if response.status_code == 200:
        data = response.json()
        print("\n=== SALES ENDPOINT RESPONSE STRUCTURE ===")
        print(f"Response keys: {list(data.keys())}")
        print(f"\nFull response:")
        print(json.dumps(data, indent=2))
        
        # Check for by_source field mentioned in review request
        if "by_source" in data:
            print("\n✅ by_source field present")
        else:
            print("\n⚠️  by_source field NOT present (review request mentions it)")
        
        # Verify sorting
        by_staff = data.get("by_staff", [])
        by_service = data.get("by_service", [])
        
        print(f"\nby_staff entries: {len(by_staff)}")
        if by_staff:
            print(f"First entry: {by_staff[0]}")
            staff_sorted = all(by_staff[i]["revenue"] >= by_staff[i+1]["revenue"] 
                              for i in range(len(by_staff)-1)) if len(by_staff) > 1 else True
            print(f"Sorted by revenue desc: {staff_sorted}")
        
        print(f"\nby_service entries: {len(by_service)}")
        if by_service:
            print(f"First entry: {by_service[0]}")
            service_sorted = all(by_service[i]["revenue"] >= by_service[i+1]["revenue"] 
                                for i in range(len(by_service)-1)) if len(by_service) > 1 else True
            print(f"Sorted by revenue desc: {service_sorted}")

def test_waittime_metric(token):
    """Test waittime metric specifically"""
    url = f"{BASE_URL}/salons/{SALON_ID}/reports/metric/wait"
    headers = {"Authorization": f"Bearer {token}"}
    params = {"view": "month", "date": "2026-07-18"}
    
    response = requests.get(url, headers=headers, params=params, timeout=10)
    if response.status_code == 200:
        data = response.json()
        print("\n=== WAITTIME METRIC RESPONSE ===")
        print(f"Response keys: {list(data.keys())}")
        metric = data.get("metric", {})
        print(f"\nMetric object keys: {list(metric.keys())}")
        print(f"Metric ID: {metric.get('id')}")
        print(f"Metric label: {metric.get('label')}")
        print(f"Total (avg wait time): {metric.get('total')}")
        print(f"Lower is better: {metric.get('lower_is_better')}")
        print(f"\nChart data:")
        chart = metric.get("chart", {})
        print(f"Chart title: {chart.get('title')}")
        print(f"Chart kind: {chart.get('kind')}")
        print(f"Chart data points: {len(chart.get('data', []))}")

def test_snapshot_projection_details(token):
    """Detailed check of projection logic for flow vs ratio metrics"""
    url = f"{BASE_URL}/salons/{SALON_ID}/reports/snapshot"
    headers = {"Authorization": f"Bearer {token}"}
    params = {"view": "month", "date": "2026-07-18", "compare": "true"}
    
    response = requests.get(url, headers=headers, params=params, timeout=10)
    if response.status_code == 200:
        data = response.json()
        cards = data.get("cards", [])
        
        print("\n=== SNAPSHOT PROJECTION LOGIC VERIFICATION ===")
        print(f"Total cards: {len(cards)}")
        
        # Flow metrics (should have projection)
        flow_metrics = ["revenue", "appointments", "collections", "guests", "products", "addons"]
        # Ratio/stock metrics (should NOT have projection)
        ratio_stock_metrics = ["utilization", "noshow", "rebooking", "feedback", "avgticket", "membership"]
        
        print("\n--- FLOW METRICS (should project) ---")
        for card in cards:
            if card["id"] in flow_metrics:
                total = card.get("total", 0)
                projected = card.get("projected", 0)
                ratio = projected / total if total > 0 else 0
                print(f"{card['id']:15} | total: {total:10.2f} | projected: {projected:10.2f} | ratio: {ratio:.2f}x")
                if projected < total:
                    print(f"  ⚠️  WARNING: projected < total for flow metric!")
        
        print("\n--- RATIO/STOCK METRICS (should NOT project) ---")
        for card in cards:
            if card["id"] in ratio_stock_metrics:
                total = card.get("total", 0)
                projected = card.get("projected", 0)
                print(f"{card['id']:15} | total: {total:10.2f} | projected: {projected:10.2f}")
                if projected != total:
                    print(f"  ⚠️  WARNING: projected != total for ratio/stock metric!")
        
        print("\n--- TREND AND UP FIELDS (compare=true) ---")
        for card in cards:
            trend = card.get("trend")
            up = card.get("up")
            lower_is_better = card.get("lower_is_better", False)
            print(f"{card['id']:15} | trend: {str(trend):8} | up: {str(up):5} | lower_is_better: {lower_is_better}")

def test_target_persistence(token):
    """Verify target was persisted from earlier PUT"""
    url = f"{BASE_URL}/salons/{SALON_ID}/reports/snapshot"
    headers = {"Authorization": f"Bearer {token}"}
    params = {"view": "month", "date": "2026-07-18"}
    
    response = requests.get(url, headers=headers, params=params, timeout=10)
    if response.status_code == 200:
        data = response.json()
        cards = data.get("cards", [])
        
        print("\n=== TARGET PERSISTENCE CHECK ===")
        revenue_card = next((c for c in cards if c["id"] == "revenue"), None)
        if revenue_card:
            target = revenue_card.get("target")
            print(f"Revenue target: {target}")
            if target == 75000:
                print("✅ Target correctly persisted (75000)")
            else:
                print(f"⚠️  Target is {target}, expected 75000")

def main():
    print("=" * 80)
    print("DETAILED REPORTS MODULE VERIFICATION")
    print("=" * 80)
    
    token = login_admin()
    if not token:
        print("❌ Cannot login")
        return
    
    test_sales_response_structure(token)
    test_waittime_metric(token)
    test_snapshot_projection_details(token)
    test_target_persistence(token)
    
    print("\n" + "=" * 80)
    print("DETAILED VERIFICATION COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    main()
