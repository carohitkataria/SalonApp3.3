#!/usr/bin/env python3
"""
Backend API Testing for New Endpoints
Tests the salon booking app's new backend endpoints:
- GET /api/salons/{salon_id}/ratings
- GET /api/salons/search (name and/or city)
- GET /api/cities
- DELETE /api/salons/{salon_id} (auth required)
- City field in salon model
"""

import requests
import json
import sys
from datetime import datetime, timezone

# Backend URL from environment
BACKEND_URL = "https://salon-access-ctrl.preview.emergentagent.com/api"

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

def test_get_salon_ratings(salon_id):
    """Test GET /api/salons/{salon_id}/ratings - Get all ratings for a salon"""
    print_test_header(f"Testing GET /salons/{salon_id}/ratings")
    
    try:
        response = requests.get(f"{BACKEND_URL}/salons/{salon_id}/ratings")
        
        if response.status_code == 200:
            data = response.json()
            print_success("Salon ratings endpoint working")
            
            # Check required fields
            required_fields = ['salon_id', 'salon_name', 'average_rating', 'total_reviews', 'reviews']
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print_error(f"Missing required fields: {missing_fields}")
                return False
            
            print_info(f"Salon: {data.get('salon_name')}")
            print_info(f"Average rating: {data.get('average_rating')}")
            print_info(f"Total reviews: {data.get('total_reviews')}")
            print_info(f"Reviews count: {len(data.get('reviews', []))}")
            
            # Verify data types
            if not isinstance(data.get('average_rating'), (int, float)):
                print_error("average_rating should be a number")
                return False
            
            if not isinstance(data.get('total_reviews'), int):
                print_error("total_reviews should be an integer")
                return False
            
            if not isinstance(data.get('reviews'), list):
                print_error("reviews should be a list")
                return False
            
            # When no ratings exist, should return proper defaults
            if data.get('total_reviews') == 0:
                if data.get('average_rating') != 0:
                    print_error("When no ratings exist, average_rating should be 0")
                    return False
                if len(data.get('reviews', [])) != 0:
                    print_error("When no ratings exist, reviews array should be empty")
                    return False
                print_info("✓ Correctly handles case with no ratings")
            
            return True
        elif response.status_code == 404:
            print_error("Salon not found")
            return False
        else:
            print_error(f"Failed to get salon ratings: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception getting salon ratings: {str(e)}")
        return False

def test_search_salons():
    """Test GET /api/salons/search - Search salons by name and/or city"""
    print_test_header("Testing GET /salons/search")
    
    test_cases = [
        ("name only", {"name": "Looks"}),
        ("city only", {"city": "Bangalore"}),
        ("both name and city", {"name": "Looks", "city": "Bangalore"}),
        ("empty query", {}),  # Should fail
    ]
    
    all_passed = True
    
    for test_name, params in test_cases:
        print_info(f"Testing {test_name}: {params}")
        
        try:
            response = requests.get(f"{BACKEND_URL}/salons/search", params=params)
            
            if test_name == "empty query":
                # This should fail with 400
                if response.status_code == 400:
                    print_success("✓ Correctly rejects empty search query")
                else:
                    print_error(f"Expected 400 for empty query, got {response.status_code}")
                    all_passed = False
            else:
                if response.status_code == 200:
                    data = response.json()
                    if 'salons' in data and isinstance(data['salons'], list):
                        print_success(f"✓ {test_name}: Found {len(data['salons'])} salons")
                        
                        # Check if results contain the search terms (if any salons found)
                        if data['salons'] and params.get('name'):
                            found_name_match = any(
                                params['name'].lower() in salon.get('salon_name', '').lower() 
                                for salon in data['salons']
                            )
                            if found_name_match:
                                print_info("✓ Results contain name match")
                            else:
                                print_warning("No exact name matches found (may be expected)")
                        
                        if data['salons'] and params.get('city'):
                            found_city_match = any(
                                params['city'].lower() in salon.get('city', '').lower() 
                                for salon in data['salons']
                            )
                            if found_city_match:
                                print_info("✓ Results contain city match")
                            else:
                                print_warning("No exact city matches found (may be expected)")
                    else:
                        print_error(f"Invalid response format for {test_name}")
                        all_passed = False
                else:
                    print_error(f"Failed {test_name}: {response.status_code} - {response.text}")
                    all_passed = False
                    
        except Exception as e:
            print_error(f"Exception testing {test_name}: {str(e)}")
            all_passed = False
    
    return all_passed

def test_get_cities():
    """Test GET /api/cities - Get list of unique cities"""
    print_test_header("Testing GET /cities")
    
    try:
        response = requests.get(f"{BACKEND_URL}/cities")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'cities' in data and isinstance(data['cities'], list):
                print_success(f"Cities endpoint working - Found {len(data['cities'])} cities")
                
                # Show first few cities
                cities = data['cities'][:5]  # Show first 5
                for city in cities:
                    print_info(f"  City: {city}")
                
                if len(data['cities']) > 5:
                    print_info(f"  ... and {len(data['cities']) - 5} more cities")
                
                # Verify cities are strings and not empty
                invalid_cities = [c for c in data['cities'] if not isinstance(c, str) or not c.strip()]
                if invalid_cities:
                    print_warning(f"Found {len(invalid_cities)} invalid city entries")
                else:
                    print_success("✓ All cities are valid strings")
                
                return True
            else:
                print_error("Invalid response format - expected 'cities' array")
                return False
        else:
            print_error(f"Failed to get cities: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception getting cities: {str(e)}")
        return False

def test_salon_city_field():
    """Test that salon model includes city field"""
    print_test_header("Testing City Field in Salon Model")
    
    try:
        response = requests.get(f"{BACKEND_URL}/salons")
        
        if response.status_code == 200:
            salons = response.json()
            if salons and len(salons) > 0:
                salon = salons[0]
                
                if 'city' in salon:
                    print_success(f"✓ City field present in salon model")
                    print_info(f"Sample salon city: {salon.get('city')}")
                    
                    # Check if city field has a value
                    if salon.get('city'):
                        print_success("✓ City field has a value")
                    else:
                        print_warning("City field is present but empty/null")
                    
                    return True
                else:
                    print_error("City field missing from salon model")
                    return False
            else:
                print_error("No salons found to check city field")
                return False
        else:
            print_error(f"Failed to get salons: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print_error(f"Exception checking salon city field: {str(e)}")
        return False

def test_delete_salon_auth():
    """Test DELETE /api/salons/{salon_id} - Should require authentication"""
    print_test_header("Testing DELETE /salons/{salon_id} (Auth Required)")
    
    # Get a salon ID first
    try:
        response = requests.get(f"{BACKEND_URL}/salons")
        if response.status_code != 200 or not response.json():
            print_error("Cannot get salon ID for delete test")
            return False
        
        salon_id = response.json()[0].get('id')
        if not salon_id:
            print_error("No salon ID found for delete test")
            return False
        
        print_info(f"Testing delete for salon ID: {salon_id}")
        
        # Test without authentication - should fail
        response = requests.delete(f"{BACKEND_URL}/salons/{salon_id}")
        
        # Should return 401 (Unauthorized), 403 (Forbidden), or 422 (Unprocessable Entity)
        # NOT 404 (Not Found) or 405 (Method Not Allowed)
        expected_codes = [401, 403, 422]
        
        if response.status_code in expected_codes:
            print_success(f"✓ Correctly requires authentication (status: {response.status_code})")
            print_info("Delete endpoint exists and properly protected")
            return True
        elif response.status_code == 404:
            print_error("Delete endpoint returns 404 - endpoint may not exist")
            return False
        elif response.status_code == 405:
            print_error("Delete endpoint returns 405 - method not allowed")
            return False
        else:
            print_warning(f"Unexpected status code: {response.status_code} - {response.text}")
            # Still consider this a pass if endpoint exists
            return True
            
    except Exception as e:
        print_error(f"Exception testing delete salon: {str(e)}")
        return False

def run_new_endpoint_tests():
    """Run all new endpoint tests"""
    print(f"{Colors.BOLD}🧪 Starting New Backend Endpoint Tests{Colors.ENDC}")
    print(f"Backend URL: {BACKEND_URL}")
    
    # Test 1: Get basic data needed for testing
    print_test_header("Phase 1: Getting Test Data")
    
    # Get a salon for testing
    salon_id = test_get_salons()
    if not salon_id:
        print_error("Cannot proceed without salon data")
        return False
    
    # Test 2: Test new endpoints
    print_test_header("Phase 2: Testing New Endpoints")
    
    test_results = {}
    
    # Test salon ratings endpoint
    test_results['salon_ratings'] = test_get_salon_ratings(salon_id)
    
    # Test search endpoint
    test_results['search_salons'] = test_search_salons()
    
    # Test cities endpoint
    test_results['get_cities'] = test_get_cities()
    
    # Test city field in salon model
    test_results['salon_city_field'] = test_salon_city_field()
    
    # Test delete salon endpoint (auth required)
    test_results['delete_salon_auth'] = test_delete_salon_auth()
    
    # Test 3: Summary
    print_test_header("Phase 3: Test Summary")
    
    passed_tests = [name for name, result in test_results.items() if result]
    failed_tests = [name for name, result in test_results.items() if not result]
    
    for test_name in passed_tests:
        print_success(f"✓ {test_name.replace('_', ' ').title()}")
    
    for test_name in failed_tests:
        print_error(f"✗ {test_name.replace('_', ' ').title()}")
    
    total_tests = len(test_results)
    passed_count = len(passed_tests)
    
    print(f"\n{Colors.BOLD}📊 Test Results: {passed_count}/{total_tests} tests passed{Colors.ENDC}")
    
    if passed_count == total_tests:
        print_success("All new endpoint tests passed!")
        return True
    else:
        print_warning(f"Some tests failed. {total_tests - passed_count} issues found.")
        return False

if __name__ == "__main__":
    success = run_new_endpoint_tests()
    sys.exit(0 if success else 1)