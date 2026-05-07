#!/usr/bin/env python3
"""
Test script to check if the attendance system endpoints work with authentication
"""

import requests
import json
from datetime import datetime

BASE_URL = "https://staff-management-pro-2.preview.emergentagent.com/api"
SALON_ID = "91a8e87d-d687-49ea-b3e5-460cc55cf3de"

def log(message):
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def test_with_different_salon():
    """Test with the salon ID from the review request"""
    review_salon_id = "2dad5cd9-5dda-4398-bbb5-a4d12aae7915"
    
    log(f"Testing with review salon ID: {review_salon_id}")
    
    # Check if this salon exists
    response = requests.get(f"{BASE_URL}/salons/{review_salon_id}")
    log(f"Salon check status: {response.status_code}")
    
    if response.status_code == 200:
        salon_data = response.json()
        log(f"Found salon: {salon_data.get('salon_name')}")
        
        # Test attendance endpoint
        response = requests.get(f"{BASE_URL}/salons/{review_salon_id}/attendance/2026-04")
        log(f"Attendance endpoint status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Attendance endpoint working! Barbers: {len(data.get('barbers', []))}")
            return True
        else:
            log(f"❌ Attendance endpoint failed: {response.text}")
            return False
    else:
        log(f"❌ Salon not found: {response.text}")
        return False

def test_service_categories():
    """Test the working service categories endpoint"""
    log("Testing service categories endpoint...")
    
    response = requests.get(f"{BASE_URL}/services/categories")
    log(f"Service categories status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        categories = data.get("categories", [])
        log(f"✅ Service categories working! Found {len(categories)} categories")
        
        # Show first few categories
        for i, cat in enumerate(categories[:3]):
            log(f"   Category {i+1}: {cat.get('name')} - {cat.get('thumbnail_url')[:50]}...")
        
        return True
    else:
        log(f"❌ Service categories failed: {response.text}")
        return False

def main():
    log("🚀 Testing Staff Attendance System - Debugging Version")
    log("=" * 60)
    
    # Test 1: Service categories (known working)
    log("\n--- Test 1: Service Categories ---")
    categories_result = test_service_categories()
    
    # Test 2: Try with different salon ID
    log("\n--- Test 2: Different Salon ID ---")
    salon_result = test_with_different_salon()
    
    # Summary
    log("\n" + "=" * 60)
    log("📊 SUMMARY")
    log("=" * 60)
    
    log(f"Service Categories: {'✅ PASSED' if categories_result else '❌ FAILED'}")
    log(f"Attendance System: {'✅ PASSED' if salon_result else '❌ FAILED'}")
    
    if categories_result and salon_result:
        log("🎉 Both tests passed!")
    elif categories_result:
        log("⚠️ Service categories work, but attendance system has issues")
    else:
        log("❌ Multiple system failures detected")

if __name__ == "__main__":
    main()