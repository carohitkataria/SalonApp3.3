#!/usr/bin/env python3
"""
Extended Backend API Testing - Test with enabled services
"""

import requests
import json

BACKEND_URL = "https://customer-experience-4.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

def test_with_enabled_services():
    """Test the services/enabled endpoint with some services enabled"""
    print("🔧 Testing with enabled services...")
    
    # Get salon ID
    response = requests.get(f"{API_BASE}/salons")
    salons = response.json()
    salon_id = salons[0]["id"]
    
    print(f"Using salon: {salon_id}")
    
    # Get all services for this salon
    response = requests.get(f"{API_BASE}/salons/{salon_id}/services/all")
    all_services = response.json()
    
    print(f"Total services available: {len(all_services)}")
    
    # Check how many are currently enabled
    enabled_count = sum(1 for s in all_services if s.get("is_enabled_for_salon", False))
    print(f"Currently enabled services: {enabled_count}")
    
    # Test the enabled services endpoint
    response = requests.get(f"{API_BASE}/salons/{salon_id}/services/enabled")
    enabled_services = response.json()
    
    print(f"Enabled services endpoint returned: {len(enabled_services)} services")
    
    if len(enabled_services) > 0:
        print("✅ Services are enabled and endpoint works correctly")
        for service in enabled_services[:3]:
            print(f"  - {service.get('service_name')}: ₹{service.get('base_price')}")
    else:
        print("ℹ️  No services enabled - this is expected for a fresh salon")
    
    return True

def test_live_status_detailed():
    """Test live-status endpoint in detail"""
    print("\n🔍 Detailed live-status testing...")
    
    # Get salon ID
    response = requests.get(f"{API_BASE}/salons")
    salons = response.json()
    salon_id = salons[0]["id"]
    
    # Test live-status endpoint
    response = requests.get(f"{API_BASE}/salons/{salon_id}/live-status")
    data = response.json()
    
    print(f"Live status response structure:")
    print(f"  - Date: {data.get('date')}")
    print(f"  - Overall section: {list(data.get('overall', {}).keys())}")
    print(f"  - Barbers count: {len(data.get('barbers', []))}")
    
    # Verify total_tokens_today is present for each barber
    barbers = data.get('barbers', [])
    for barber in barbers:
        total_tokens = barber.get('total_tokens_today')
        if total_tokens is not None:
            print(f"  ✅ {barber.get('barber_name')}: total_tokens_today = {total_tokens}")
        else:
            print(f"  ❌ {barber.get('barber_name')}: total_tokens_today MISSING")
    
    return True

if __name__ == "__main__":
    test_with_enabled_services()
    test_live_status_detailed()
    print("\n✅ Extended testing completed!")