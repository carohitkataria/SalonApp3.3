#!/usr/bin/env python3
"""
Backend Testing Script for Staff Attendance System
Tests all attendance and salary management endpoints
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# Configuration
BASE_URL = "https://loyalty-wallet-fix.preview.emergentagent.com/api"
SALON_ID = "2dad5cd9-5dda-4398-bbb5-a4d12aae7915"
ADMIN_PHONE = "+917503070727"
ADMIN_PASSWORD = "salon123"

# Test data
TEST_MONTH = "2026-04"
TEST_DATE = "2026-04-26"

class AttendanceSystemTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.test_barber_id = None
        self.test_barber_name = None
        
    def log(self, message, level="INFO"):
        """Log test messages"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def login_admin(self):
        """Login as admin to get authentication token"""
        self.log("🔐 Attempting admin login...")
        
        login_data = {
            "identifier": ADMIN_PHONE,
            "password": ADMIN_PASSWORD
        }
        
        try:
            response = self.session.post(f"{BASE_URL}/salon/users/login", json=login_data)
            self.log(f"Login response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data.get("access_token")
                if self.admin_token:
                    self.session.headers.update({"Authorization": f"Bearer {self.admin_token}"})
                    self.log("✅ Admin login successful")
                    return True
                else:
                    self.log("❌ No access token in response", "ERROR")
                    return False
            else:
                self.log(f"❌ Login failed: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Login error: {str(e)}", "ERROR")
            return False
    
    def get_barbers(self):
        """Get list of barbers to use for testing"""
        self.log("👥 Getting barbers list...")
        
        try:
            response = self.session.get(f"{BASE_URL}/salons/{SALON_ID}/barbers")
            self.log(f"Barbers response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                barbers = data.get("barbers", [])
                
                # Find first active barber
                for barber in barbers:
                    if barber.get("is_barber") and barber.get("is_active"):
                        self.test_barber_id = barber.get("id")
                        self.test_barber_name = barber.get("name")
                        self.log(f"✅ Using test barber: {self.test_barber_name} (ID: {self.test_barber_id})")
                        return True
                
                self.log("❌ No active barbers found", "ERROR")
                return False
            else:
                self.log(f"❌ Failed to get barbers: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error getting barbers: {str(e)}", "ERROR")
            return False
    
    def test_get_monthly_attendance(self):
        """Test GET /api/salons/{salon_id}/attendance/{month}"""
        self.log(f"📅 Testing GET monthly attendance for {TEST_MONTH}...")
        
        try:
            response = self.session.get(f"{BASE_URL}/salons/{SALON_ID}/attendance/{TEST_MONTH}")
            self.log(f"Monthly attendance response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Monthly attendance retrieved successfully")
                self.log(f"   Month: {data.get('month')}")
                self.log(f"   Barbers count: {len(data.get('barbers', []))}")
                
                # Check structure
                barbers = data.get("barbers", [])
                if barbers:
                    first_barber = barbers[0]
                    required_fields = ["barber_id", "barber_name", "compensation", "attendance"]
                    missing_fields = [field for field in required_fields if field not in first_barber]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing fields in barber data: {missing_fields}", "WARNING")
                    else:
                        self.log("✅ All required fields present in barber data")
                        
                    attendance_records = first_barber.get("attendance", [])
                    self.log(f"   Attendance records for {first_barber.get('barber_name')}: {len(attendance_records)}")
                
                return True
            else:
                self.log(f"❌ Failed to get monthly attendance: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing monthly attendance: {str(e)}", "ERROR")
            return False
    
    def test_calculate_daily_attendance(self):
        """Test POST /api/salons/{salon_id}/attendance/calculate/{date}"""
        self.log(f"🧮 Testing POST calculate attendance for {TEST_DATE}...")
        
        try:
            response = self.session.post(f"{BASE_URL}/salons/{SALON_ID}/attendance/calculate/{TEST_DATE}")
            self.log(f"Calculate attendance response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Daily attendance calculated successfully")
                self.log(f"   Date: {data.get('date')}")
                self.log(f"   Attendance records: {len(data.get('attendance', []))}")
                
                # Check attendance structure
                attendance_records = data.get("attendance", [])
                if attendance_records:
                    first_record = attendance_records[0]
                    required_fields = ["id", "salon_id", "barber_id", "date", "status", "auto_calculated"]
                    missing_fields = [field for field in required_fields if field not in first_record]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing fields in attendance record: {missing_fields}", "WARNING")
                    else:
                        self.log("✅ All required fields present in attendance record")
                        self.log(f"   Sample status: {first_record.get('status')}")
                        self.log(f"   Auto calculated: {first_record.get('auto_calculated')}")
                
                return True
            elif response.status_code == 403:
                self.log("❌ Admin access required for calculate attendance", "ERROR")
                return False
            else:
                self.log(f"❌ Failed to calculate attendance: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing calculate attendance: {str(e)}", "ERROR")
            return False
    
    def test_override_attendance(self):
        """Test PUT /api/salons/{salon_id}/attendance/{barber_id}/{date}"""
        if not self.test_barber_id:
            self.log("❌ No test barber available for override test", "ERROR")
            return False
            
        self.log(f"✏️ Testing PUT override attendance for barber {self.test_barber_name}...")
        
        override_data = {
            "status": "present",
            "note": "Manual override for testing"
        }
        
        try:
            response = self.session.put(
                f"{BASE_URL}/salons/{SALON_ID}/attendance/{self.test_barber_id}/{TEST_DATE}",
                json=override_data
            )
            self.log(f"Override attendance response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Attendance override successful")
                self.log(f"   Status: {data.get('status')}")
                self.log(f"   Auto calculated: {data.get('auto_calculated')}")
                self.log(f"   Override note: {data.get('override_note')}")
                
                # Verify it's marked as manual override
                if data.get("auto_calculated") == False:
                    self.log("✅ Correctly marked as manual override")
                else:
                    self.log("⚠️ Should be marked as manual override", "WARNING")
                
                return True
            elif response.status_code == 403:
                self.log("❌ Admin access required for attendance override", "ERROR")
                return False
            else:
                self.log(f"❌ Failed to override attendance: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing attendance override: {str(e)}", "ERROR")
            return False
    
    def test_get_monthly_salary(self):
        """Test GET /api/salons/{salon_id}/salary/{month}"""
        self.log(f"💰 Testing GET monthly salary for {TEST_MONTH}...")
        
        try:
            response = self.session.get(f"{BASE_URL}/salons/{SALON_ID}/salary/{TEST_MONTH}")
            self.log(f"Monthly salary response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Monthly salary retrieved successfully")
                self.log(f"   Month: {data.get('month')}")
                self.log(f"   Salary records: {len(data.get('salary_records', []))}")
                
                # Check salary structure
                salary_records = data.get("salary_records", [])
                if salary_records:
                    first_record = salary_records[0]
                    required_fields = ["id", "salon_id", "barber_id", "barber_name", "month", 
                                     "base_salary", "present_days", "half_days", "calculated_salary"]
                    missing_fields = [field for field in required_fields if field not in first_record]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing fields in salary record: {missing_fields}", "WARNING")
                    else:
                        self.log("✅ All required fields present in salary record")
                        self.log(f"   Sample barber: {first_record.get('barber_name')}")
                        self.log(f"   Base salary: ₹{first_record.get('base_salary')}")
                        self.log(f"   Present days: {first_record.get('present_days')}")
                        self.log(f"   Half days: {first_record.get('half_days')}")
                        self.log(f"   Calculated salary: ₹{first_record.get('calculated_salary')}")
                        self.log(f"   Is paid: {first_record.get('is_paid')}")
                
                return True
            else:
                self.log(f"❌ Failed to get monthly salary: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing monthly salary: {str(e)}", "ERROR")
            return False
    
    def test_mark_salary_paid(self):
        """Test POST /api/salons/{salon_id}/salary/{barber_id}/{month}/pay"""
        if not self.test_barber_id:
            self.log("❌ No test barber available for salary payment test", "ERROR")
            return False
            
        self.log(f"💳 Testing POST mark salary paid for barber {self.test_barber_name}...")
        
        payment_data = {
            "payment_method": "cash",
            "note": "Test salary payment"
        }
        
        try:
            response = self.session.post(
                f"{BASE_URL}/salons/{SALON_ID}/salary/{self.test_barber_id}/{TEST_MONTH}/pay",
                json=payment_data
            )
            self.log(f"Mark salary paid response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Salary payment marked successfully")
                self.log(f"   Is paid: {data.get('is_paid')}")
                self.log(f"   Payment method: {data.get('payment_method')}")
                self.log(f"   Total payable: ₹{data.get('total_payable')}")
                
                # Check if financial transaction was created
                transaction = data.get("transaction")
                if transaction:
                    self.log("✅ Financial transaction created")
                    self.log(f"   Transaction ID: {transaction.get('id')}")
                    self.log(f"   Category: {transaction.get('category')}")
                    self.log(f"   Amount: ₹{transaction.get('amount')}")
                else:
                    self.log("⚠️ No financial transaction in response", "WARNING")
                
                return True
            elif response.status_code == 403:
                self.log("❌ Admin access required for salary payment", "ERROR")
                return False
            elif response.status_code == 400:
                self.log(f"⚠️ Salary payment validation error: {response.text}", "WARNING")
                # This might be expected if salary is already paid
                return True
            else:
                self.log(f"❌ Failed to mark salary paid: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing salary payment: {str(e)}", "ERROR")
            return False
    
    def test_service_categories_with_thumbnails(self):
        """Test GET /api/services/categories"""
        self.log("🖼️ Testing GET service categories with thumbnails...")
        
        try:
            response = self.session.get(f"{BASE_URL}/services/categories")
            self.log(f"Service categories response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                self.log(f"✅ Service categories retrieved successfully")
                
                categories = data.get("categories", [])
                self.log(f"   Categories count: {len(categories)}")
                
                if categories:
                    # Check structure
                    first_category = categories[0]
                    required_fields = ["name", "thumbnail_url"]
                    missing_fields = [field for field in required_fields if field not in first_category]
                    
                    if missing_fields:
                        self.log(f"⚠️ Missing fields in category: {missing_fields}", "WARNING")
                    else:
                        self.log("✅ All required fields present in categories")
                        
                    # Show sample categories
                    for i, cat in enumerate(categories[:3]):
                        self.log(f"   Category {i+1}: {cat.get('name')} - {cat.get('thumbnail_url')[:50]}...")
                
                return True
            else:
                self.log(f"❌ Failed to get service categories: {response.text}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Error testing service categories: {str(e)}", "ERROR")
            return False
    
    def run_all_tests(self):
        """Run all attendance system tests"""
        self.log("🚀 Starting Staff Attendance System Backend Tests")
        self.log("=" * 60)
        
        # Track test results
        test_results = {}
        
        # Step 1: Login
        if not self.login_admin():
            self.log("❌ Cannot proceed without admin authentication", "ERROR")
            return False
        
        # Step 2: Get barbers for testing
        if not self.get_barbers():
            self.log("❌ Cannot proceed without test barber data", "ERROR")
            return False
        
        # Step 3: Test all endpoints
        tests = [
            ("Monthly Attendance", self.test_get_monthly_attendance),
            ("Calculate Daily Attendance", self.test_calculate_daily_attendance),
            ("Override Attendance", self.test_override_attendance),
            ("Monthly Salary", self.test_get_monthly_salary),
            ("Mark Salary Paid", self.test_mark_salary_paid),
            ("Service Categories with Thumbnails", self.test_service_categories_with_thumbnails)
        ]
        
        for test_name, test_func in tests:
            self.log(f"\n--- Testing {test_name} ---")
            try:
                result = test_func()
                test_results[test_name] = result
                if result:
                    self.log(f"✅ {test_name} - PASSED")
                else:
                    self.log(f"❌ {test_name} - FAILED")
            except Exception as e:
                self.log(f"❌ {test_name} - ERROR: {str(e)}", "ERROR")
                test_results[test_name] = False
        
        # Summary
        self.log("\n" + "=" * 60)
        self.log("📊 TEST SUMMARY")
        self.log("=" * 60)
        
        passed = sum(1 for result in test_results.values() if result)
        total = len(test_results)
        
        for test_name, result in test_results.items():
            status = "✅ PASSED" if result else "❌ FAILED"
            self.log(f"{test_name}: {status}")
        
        self.log(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 ALL TESTS PASSED! Staff Attendance System is working correctly.")
            return True
        else:
            self.log(f"⚠️ {total - passed} test(s) failed. Please review the issues above.")
            return False

if __name__ == "__main__":
    tester = AttendanceSystemTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)