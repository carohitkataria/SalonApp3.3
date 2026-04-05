#!/usr/bin/env python3
"""
Backend API Testing for Rating/Review Endpoints
Tests the salon booking app's rating and review functionality
"""

import requests
import json
import sys
from datetime import datetime, timezone

# Backend URL from environment
BACKEND_URL = "https://pin-menu-salon.preview.emergentagent.com/api"

# Test credentials
TEST_USER = {
    "name": "Test User",
    "phone": "9876543210",
    "gender": "Men"
}

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_test_header(test_name):
    print(f"\n{Colors.BLUE}{Colors.BOLD}=== {test_name} ==={Colors.ENDC}")

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.ENDC}")

def print_error(message):
    print(f"{Colors.RED}❌ {message}{Colors.ENDC}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.ENDC}")

def print_info(message):
    print(f"{Colors.BLUE}ℹ️  {message}{Colors.ENDC}")

def test_get_salons():
    """Test getting list of salons"""
    print_test_header("Testing GET /salons")
    
    try:
        response = requests.get(f"{BACKEND_URL}/salons")
        
        if response.status_code == 200:
            salons = response.json()
            if salons and len(salons) > 0:
                print_success(f"Found {len(salons)} salons")
                salon = salons[0]
                print_info(f"First salon: {salon.get('salon_name')} (ID: {salon.get('id')})")
                return salon.get('id')
            else:
                print_error("No salons found in database")
                return None
        else:
            print_error(f"Failed to get salons: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print_error(f"Exception getting salons: {str(e)}")
        return None

def test_get_barbers(salon_id):
    """Test getting barbers for a salon"""
    print_test_header("Testing GET /salons/{salon_id}/barbers")
    
    try:
        response = requests.get(f"{BACKEND_URL}/salons/{salon_id}/barbers")
        
        if response.status_code == 200:
            barbers = response.json()
            if barbers and len(barbers) > 0:
                print_success(f"Found {len(barbers)} barbers for salon")
                barber = barbers[0]
                print_info(f"First barber: {barber.get('name')} (ID: {barber.get('id')})")
                return barber.get('id')
            else:
                print_error("No barbers found for salon")
                return None
        else:
            print_error(f"Failed to get barbers: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print_error(f"Exception getting barbers: {str(e)}")
        return None

def test_user_login():
    """Test user login to get user_id"""
    print_test_header("Testing POST /user/login")
    
    try:
        response = requests.post(f"{BACKEND_URL}/user/login", json=TEST_USER)
        
        if response.status_code == 200:
            user = response.json()
            print_success(f"User login successful: {user.get('name')} (ID: {user.get('id')})")
            return user.get('id')
        else:
            print_error(f"Failed to login user: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print_error(f"Exception during user login: {str(e)}")
        return None

def test_can_rate_token(token_id):
    """Test GET /tokens/{token_id}/can-rate"""
    print_test_header(f"Testing GET /tokens/{token_id}/can-rate")
    
    try:
        response = requests.get(f"{BACKEND_URL}/tokens/{token_id}/can-rate")
        
        if response.status_code == 200:
            data = response.json()
            print_success("Can-rate endpoint working")
            print_info(f"Can rate: {data.get('can_rate')}")
            print_info(f"Is completed: {data.get('is_completed')}")
            print_info(f"Already rated: {data.get('already_rated')}")
            return data
        elif response.status_code == 404:
            print_warning("Token not found (expected for non-existent token)")
            return None
        else:
            print_error(f"Failed to check can-rate: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print_error(f"Exception checking can-rate: {str(e)}")
        return None

def test_barber_ratings(barber_id):
    """Test GET /barbers/{barber_id}/ratings"""
    print_test_header(f"Testing GET /barbers/{barber_id}/ratings")
    
    try:
        response = requests.get(f"{BACKEND_URL}/barbers/{barber_id}/ratings")
        
        if response.status_code == 200:
            data = response.json()
            print_success("Barber ratings endpoint working")
            print_info(f"Barber: {data.get('barber_name')}")
            print_info(f"Average rating: {data.get('average_rating')}")
            print_info(f"Total reviews: {data.get('total_reviews')}")
            print_info(f"Reviews count: {len(data.get('reviews', []))}")
            return data
        elif response.status_code == 404:
            print_error("Barber not found")
            return None
        else:
            print_error(f"Failed to get barber ratings: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print_error(f"Exception getting barber ratings: {str(e)}")
        return None

def test_barber_profile(salon_id, barber_id):
    """Test GET /salons/{salon_id}/barbers/{barber_id}/profile"""
    print_test_header(f"Testing GET /salons/{salon_id}/barbers/{barber_id}/profile")
    
    try:
        response = requests.get(f"{BACKEND_URL}/salons/{salon_id}/barbers/{barber_id}/profile")
        
        if response.status_code == 200:
            data = response.json()
            print_success("Barber profile endpoint working")
            print_info(f"Barber: {data.get('name')}")
            print_info(f"Experience: {data.get('experience')} years")
            print_info(f"Category: {data.get('category')}")
            print_info(f"Specialization: {data.get('specialization')}")
            print_info(f"Average rating: {data.get('average_rating')}")
            print_info(f"Total reviews: {data.get('total_reviews')}")
            print_info(f"Services count: {len(data.get('services', []))}")
            print_info(f"Recent reviews count: {len(data.get('recent_reviews', []))}")
            
            # Check if profile includes required fields
            required_fields = ['name', 'experience', 'category', 'average_rating', 'total_reviews', 'services', 'recent_reviews']
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                print_warning(f"Missing fields in profile: {missing_fields}")
            else:
                print_success("All required profile fields present")
            
            return data
        elif response.status_code == 404:
            print_error("Barber not found")
            return None
        else:
            print_error(f"Failed to get barber profile: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print_error(f"Exception getting barber profile: {str(e)}")
        return None

def test_create_rating_without_token():
    """Test POST /ratings without valid token (should fail)"""
    print_test_header("Testing POST /ratings (without valid token)")
    
    rating_data = {
        "token_id": "non-existent-token",
        "barber_id": "test-barber",
        "salon_id": "test-salon",
        "rating": 5,
        "review": "Great service!"
    }
    
    try:
        response = requests.post(f"{BACKEND_URL}/ratings", json=rating_data)
        
        if response.status_code == 404:
            print_success("Correctly rejected rating for non-existent token")
            return True
        elif response.status_code == 400:
            print_success("Correctly rejected invalid rating request")
            return True
        else:
            print_warning(f"Unexpected response: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception testing rating creation: {str(e)}")
        return False

def test_user_pending_ratings(user_id):
    """Test GET /users/{user_id}/pending-ratings"""
    print_test_header(f"Testing GET /users/{user_id}/pending-ratings")
    
    try:
        response = requests.get(f"{BACKEND_URL}/users/{user_id}/pending-ratings")
        
        if response.status_code == 200:
            pending_ratings = response.json()
            print_success("Pending ratings endpoint working")
            print_info(f"Pending ratings count: {len(pending_ratings)}")
            
            if pending_ratings:
                for i, token in enumerate(pending_ratings[:3]):  # Show first 3
                    print_info(f"  Token {i+1}: {token.get('token_number')} - {token.get('customer_name')} - {token.get('status')}")
            
            return pending_ratings
        else:
            print_error(f"Failed to get pending ratings: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print_error(f"Exception getting pending ratings: {str(e)}")
        return None

def test_rating_endpoints_exist():
    """Test that rating endpoints exist and return proper error messages"""
    print_test_header("Testing Rating Endpoints Existence")
    
    endpoints_to_test = [
        ("POST", "/ratings", {"token_id": "test", "barber_id": "test", "salon_id": "test", "rating": 5, "review": "test"}),
        ("GET", "/barbers/test-barber/ratings", None),
        ("GET", "/salons/test-salon/barbers/test-barber/profile", None),
        ("GET", "/tokens/test-token/can-rate", None),
        ("GET", "/users/test-user/pending-ratings", None)
    ]
    
    all_exist = True
    
    for method, endpoint, data in endpoints_to_test:
        try:
            if method == "POST":
                response = requests.post(f"{BACKEND_URL}{endpoint}", json=data)
            else:
                response = requests.get(f"{BACKEND_URL}{endpoint}")
            
            # Check if endpoint exists (not 404 for route not found)
            if response.status_code == 404 and "Not Found" in response.text:
                print_error(f"{method} {endpoint} - Endpoint does not exist")
                all_exist = False
            else:
                print_success(f"{method} {endpoint} - Endpoint exists (status: {response.status_code})")
                
        except Exception as e:
            print_error(f"Exception testing {method} {endpoint}: {str(e)}")
            all_exist = False
    
    return all_exist

def run_rating_tests():
    """Run all rating/review API tests"""
    print(f"{Colors.BOLD}🧪 Starting Rating/Review API Tests{Colors.ENDC}")
    print(f"Backend URL: {BACKEND_URL}")
    
    # Test 1: Check if rating endpoints exist
    print_test_header("Phase 1: Endpoint Existence Check")
    endpoints_exist = test_rating_endpoints_exist()
    
    if not endpoints_exist:
        print_error("Some rating endpoints are missing. Cannot proceed with full testing.")
        return False
    
    # Test 2: Get basic data needed for testing
    print_test_header("Phase 2: Getting Test Data")
    
    # Get a salon
    salon_id = test_get_salons()
    if not salon_id:
        print_error("Cannot proceed without salon data")
        return False
    
    # Get a barber
    barber_id = test_get_barbers(salon_id)
    if not barber_id:
        print_error("Cannot proceed without barber data")
        return False
    
    # Login user
    user_id = test_user_login()
    if not user_id:
        print_error("Cannot proceed without user login")
        return False
    
    # Test 3: Test rating endpoints with real data
    print_test_header("Phase 3: Testing Rating Endpoints")
    
    # Test can-rate with non-existent token
    test_can_rate_token("non-existent-token")
    
    # Test barber ratings
    barber_ratings = test_barber_ratings(barber_id)
    
    # Test barber profile
    barber_profile = test_barber_profile(salon_id, barber_id)
    
    # Test user pending ratings
    pending_ratings = test_user_pending_ratings(user_id)
    
    # Test creating rating without valid token
    test_create_rating_without_token()
    
    # Test 4: Summary
    print_test_header("Phase 4: Test Summary")
    
    success_count = 0
    total_tests = 6
    
    if endpoints_exist:
        success_count += 1
        print_success("All rating endpoints exist")
    
    if barber_ratings is not None:
        success_count += 1
        print_success("Barber ratings endpoint working")
    
    if barber_profile is not None:
        success_count += 1
        print_success("Barber profile endpoint working")
    
    if pending_ratings is not None:
        success_count += 1
        print_success("User pending ratings endpoint working")
    
    # Additional checks
    if barber_profile and 'recent_reviews' in barber_profile:
        success_count += 1
        print_success("Barber profile includes reviews")
    
    if barber_ratings and 'reviews' in barber_ratings:
        success_count += 1
        print_success("Barber ratings includes review list")
    
    print(f"\n{Colors.BOLD}📊 Test Results: {success_count}/{total_tests} tests passed{Colors.ENDC}")
    
    if success_count == total_tests:
        print_success("All rating/review API tests passed!")
        return True
    else:
        print_warning(f"Some tests failed. {total_tests - success_count} issues found.")
        return False

if __name__ == "__main__":
    success = run_rating_tests()
    sys.exit(0 if success else 1)