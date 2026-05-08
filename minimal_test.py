#!/usr/bin/env python3
"""
Minimal test for attendance endpoints to identify the issue
"""

import requests
import json

BASE_URL = "https://menu-parser-1.preview.emergentagent.com/api"
SALON_ID = "91a8e87d-d687-49ea-b3e5-460cc55cf3de"

def test_endpoint(endpoint, method="GET", data=None):
    """Test a single endpoint"""
    url = f"{BASE_URL}{endpoint}"
    print(f"Testing {method} {url}")
    
    try:
        if method == "GET":
            response = requests.get(url, timeout=10)
        elif method == "POST":
            response = requests.post(url, json=data, timeout=10)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)[:500]}...")
            except:
                print(f"Response (text): {response.text[:200]}...")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Exception: {str(e)}")

# Test working endpoint first
print("=== Testing working endpoint ===")
test_endpoint("/services/categories")

print("\n=== Testing barbers endpoint ===")
test_endpoint(f"/salons/{SALON_ID}/barbers")

print("\n=== Testing attendance endpoint ===")
test_endpoint(f"/salons/{SALON_ID}/attendance/2026-04")

print("\n=== Testing salary endpoint ===")
test_endpoint(f"/salons/{SALON_ID}/salary/2026-04")