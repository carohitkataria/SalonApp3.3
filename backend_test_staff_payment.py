#!/usr/bin/env python3
"""
Backend test for Staff Payment Enhancements — July 20, 2026
Tests three new backend surfaces:
1. Salary payment financial-transaction enrichment (barber_id/name/month/date)
2. One-off staff payment endpoint (Advance & Full & Final)
3. Staff payment-history endpoint (Salary + Advance + F&F merged)
"""
import requests
import json
import os
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path

# Load environment
load_dotenv(Path(__file__).parent / "backend" / ".env")
load_dotenv(Path(__file__).parent / "frontend" / ".env")

BACKEND_URL = os.getenv("REACT_APP_BACKEND_URL", "").rstrip("/")

print(f"Backend URL: {BACKEND_URL}")
print("=" * 80)

# Step 0: Admin Login
print("\n### STEP 0 - ADMIN LOGIN ###\n")
login_response = requests.post(
    f"{BACKEND_URL}/api/salon/users/login",
    json={"identifier": "admin", "password": "salon123"}
)
print(f"Login Status: {login_response.status_code}")
if login_response.status_code == 200:
    login_data = login_response.json()
    access_token = login_data.get("access_token")
    salon_id = login_data.get("salon_id")
    print(f"✅ Login successful")
    print(f"   Salon ID: {salon_id}")
    print(f"   Access token obtained")
    headers = {"Authorization": f"Bearer {access_token}"}
else:
    print(f"❌ Login failed: {login_response.text}")
    exit(1)

print("\n" + "=" * 80)

# Step 1: Get active barbers
print("\n### STEP 1 - GET ACTIVE BARBERS ###\n")
barbers_response = requests.get(
    f"{BACKEND_URL}/api/salons/{salon_id}/barbers",
    headers=headers
)
print(f"Status: {barbers_response.status_code}")
if barbers_response.status_code == 200:
    barbers = barbers_response.json()
    if len(barbers) > 0:
        barber = barbers[0]
        barber_id = barber.get("id")
        barber_name = barber.get("name")
        print(f"✅ Found {len(barbers)} active barbers")
        print(f"   Using barber: {barber_name} (ID: {barber_id})")
    else:
        print(f"❌ No active barbers found")
        exit(1)
else:
    print(f"❌ Failed to get barbers: {barbers_response.text}")
    exit(1)

print("\n" + "=" * 80)

# ============================================================================
# SECTION A: ONE-OFF PAYMENT HAPPY PATHS & GUARDS
# ============================================================================
print("\n### SECTION A: ONE-OFF PAYMENT ENDPOINT ###\n")

# A1: POST advance with valid data
print("\nA1) POST one-off-payment (advance) with valid data")
advance_payload = {
    "payment_type": "advance",
    "amount": 500,
    "payment_method": "cash",
    "note": "Test advance",
    "month": "2026-07"
}
advance_response = requests.post(
    f"{BACKEND_URL}/api/salons/{salon_id}/barbers/{barber_id}/one-off-payment",
    headers=headers,
    json=advance_payload
)
print(f"Status: {advance_response.status_code}")
if advance_response.status_code == 200:
    advance_data = advance_response.json()
    txn = advance_data.get("transaction", {})
    print(f"✅ PASS: Advance payment created")
    print(f"   Transaction ID: {txn.get('id')}")
    print(f"   Category: {txn.get('category')}")
    print(f"   Payment Type: {txn.get('payment_type')}")
    print(f"   Barber ID: {txn.get('barber_id')}")
    print(f"   Barber Name: {txn.get('barber_name')}")
    print(f"   Month: {txn.get('month')}")
    print(f"   Date: {txn.get('date')}")
    
    # Verify fields
    checks = []
    checks.append(("category == 'staff_advance'", txn.get('category') == 'staff_advance'))
    checks.append(("payment_type == 'advance'", txn.get('payment_type') == 'advance'))
    checks.append(("barber_id is set", txn.get('barber_id') == barber_id))
    checks.append(("barber_name is set", txn.get('barber_name') == barber_name))
    checks.append(("month == '2026-07'", txn.get('month') == '2026-07'))
    checks.append(("date is today (YYYY-MM-DD)", len(txn.get('date', '')) == 10))
    
    for check_name, result in checks:
        if result:
            print(f"   ✓ {check_name}")
        else:
            print(f"   ✗ {check_name}")
else:
    print(f"❌ FAIL: {advance_response.text}")

print("\n" + "-" * 80)

# A2: POST ff with valid data
print("\nA2) POST one-off-payment (ff) with valid data")
ff_payload = {
    "payment_type": "ff",
    "amount": 2500,
    "payment_method": "upi",
    "note": "FF"
}
ff_response = requests.post(
    f"{BACKEND_URL}/api/salons/{salon_id}/barbers/{barber_id}/one-off-payment",
    headers=headers,
    json=ff_payload
)
print(f"Status: {ff_response.status_code}")
if ff_response.status_code == 200:
    ff_data = ff_response.json()
    txn = ff_data.get("transaction", {})
    print(f"✅ PASS: F&F payment created")
    print(f"   Transaction ID: {txn.get('id')}")
    print(f"   Category: {txn.get('category')}")
    print(f"   Payment Type: {txn.get('payment_type')}")
    
    # Verify fields
    checks = []
    checks.append(("category == 'staff_ff'", txn.get('category') == 'staff_ff'))
    checks.append(("payment_type == 'ff'", txn.get('payment_type') == 'ff'))
    
    for check_name, result in checks:
        if result:
            print(f"   ✓ {check_name}")
        else:
            print(f"   ✗ {check_name}")
else:
    print(f"❌ FAIL: {ff_response.text}")

print("\n" + "-" * 80)

# A3: amount=0 → 400
print("\nA3) POST one-off-payment with amount=0 (should fail)")
zero_amount_payload = {
    "payment_type": "advance",
    "amount": 0,
    "payment_method": "cash"
}
zero_response = requests.post(
    f"{BACKEND_URL}/api/salons/{salon_id}/barbers/{barber_id}/one-off-payment",
    headers=headers,
    json=zero_amount_payload
)
print(f"Status: {zero_response.status_code}")
if zero_response.status_code == 400:
    error_detail = zero_response.json().get("detail", "")
    print(f"✅ PASS: Correctly rejected with 400")
    print(f"   Error: {error_detail}")
    if "Amount must be greater than zero" in error_detail:
        print(f"   ✓ Error message correct")
    else:
        print(f"   ✗ Error message incorrect (expected 'Amount must be greater than zero')")
else:
    print(f"❌ FAIL: Expected 400, got {zero_response.status_code}")

print("\n" + "-" * 80)

# A4: payment_type='xxx' → 400
print("\nA4) POST one-off-payment with invalid payment_type (should fail)")
invalid_type_payload = {
    "payment_type": "xxx",
    "amount": 100,
    "payment_method": "cash"
}
invalid_type_response = requests.post(
    f"{BACKEND_URL}/api/salons/{salon_id}/barbers/{barber_id}/one-off-payment",
    headers=headers,
    json=invalid_type_payload
)
print(f"Status: {invalid_type_response.status_code}")
if invalid_type_response.status_code == 400:
    error_detail = invalid_type_response.json().get("detail", "")
    print(f"✅ PASS: Correctly rejected with 400")
    print(f"   Error: {error_detail}")
    if "payment_type must be 'advance' or 'ff'" in error_detail:
        print(f"   ✓ Error message correct")
    else:
        print(f"   ✗ Error message incorrect (expected \"payment_type must be 'advance' or 'ff'\")")
else:
    print(f"❌ FAIL: Expected 400, got {invalid_type_response.status_code}")

print("\n" + "-" * 80)

# A5: payment_method='paypal' → 400
print("\nA5) POST one-off-payment with invalid payment_method (should fail)")
invalid_method_payload = {
    "payment_type": "advance",
    "amount": 100,
    "payment_method": "paypal"
}
invalid_method_response = requests.post(
    f"{BACKEND_URL}/api/salons/{salon_id}/barbers/{barber_id}/one-off-payment",
    headers=headers,
    json=invalid_method_payload
)
print(f"Status: {invalid_method_response.status_code}")
if invalid_method_response.status_code == 400:
    error_detail = invalid_method_response.json().get("detail", "")
    print(f"✅ PASS: Correctly rejected with 400")
    print(f"   Error: {error_detail}")
    if "Invalid payment method. Use: cash, upi, bank" in error_detail:
        print(f"   ✓ Error message correct")
    else:
        print(f"   ✗ Error message incorrect (expected 'Invalid payment method. Use: cash, upi, bank')")
else:
    print(f"❌ FAIL: Expected 400, got {invalid_method_response.status_code}")

print("\n" + "-" * 80)

# A6: Unknown barber_id → 404
print("\nA6) POST one-off-payment with unknown barber_id (should fail)")
unknown_barber_payload = {
    "payment_type": "advance",
    "amount": 100,
    "payment_method": "cash"
}
unknown_barber_response = requests.post(
    f"{BACKEND_URL}/api/salons/{salon_id}/barbers/unknown-barber-id/one-off-payment",
    headers=headers,
    json=unknown_barber_payload
)
print(f"Status: {unknown_barber_response.status_code}")
if unknown_barber_response.status_code == 404:
    error_detail = unknown_barber_response.json().get("detail", "")
    print(f"✅ PASS: Correctly rejected with 404")
    print(f"   Error: {error_detail}")
    if "Staff not found" in error_detail:
        print(f"   ✓ Error message correct")
    else:
        print(f"   ✗ Error message incorrect (expected 'Staff not found')")
else:
    print(f"❌ FAIL: Expected 404, got {unknown_barber_response.status_code}")

print("\n" + "-" * 80)

# A7: No Authorization → 403
print("\nA7) POST one-off-payment without Authorization header (should fail)")
no_auth_payload = {
    "payment_type": "advance",
    "amount": 100,
    "payment_method": "cash"
}
no_auth_response = requests.post(
    f"{BACKEND_URL}/api/salons/{salon_id}/barbers/{barber_id}/one-off-payment",
    json=no_auth_payload
)
print(f"Status: {no_auth_response.status_code}")
if no_auth_response.status_code == 403:
    print(f"✅ PASS: Correctly rejected with 403")
else:
    print(f"❌ FAIL: Expected 403, got {no_auth_response.status_code}")

print("\n" + "=" * 80)

# ============================================================================
# SECTION B: PAYMENT-HISTORY ENDPOINT
# ============================================================================
print("\n### SECTION B: PAYMENT-HISTORY ENDPOINT ###\n")

# B1: GET payment-history → 200
print("\nB1) GET payment-history (should return advance + ff created above)")
history_response = requests.get(
    f"{BACKEND_URL}/api/salons/{salon_id}/barbers/{barber_id}/payment-history?limit=25",
    headers=headers
)
print(f"Status: {history_response.status_code}")
if history_response.status_code == 200:
    history_data = history_response.json()
    payments = history_data.get("payments", [])
    print(f"✅ PASS: Payment history retrieved")
    print(f"   Total payments: {len(payments)}")
    print(f"   Barber ID: {history_data.get('barber_id')}")
    
    # Display payments
    for i, payment in enumerate(payments[:5]):  # Show first 5
        print(f"\n   Payment {i+1}:")
        print(f"      ID: {payment.get('id')}")
        print(f"      Date: {payment.get('date')}")
        print(f"      Type: {payment.get('type')}")
        print(f"      Type Label: {payment.get('type_label')}")
        print(f"      Category: {payment.get('category')}")
        print(f"      Amount: {payment.get('amount')}")
        print(f"      Payment Method: {payment.get('payment_method')}")
        print(f"      Month: {payment.get('month')}")
    
    # B2: Confirm type_label mapping
    print("\n   Checking type_label mapping:")
    type_label_checks = {
        "staff_salary": "Salary",
        "staff_advance": "Advance",
        "staff_ff": "Full & Final"
    }
    for payment in payments:
        category = payment.get('category')
        type_label = payment.get('type_label')
        if category in type_label_checks:
            expected_label = type_label_checks[category]
            if type_label == expected_label:
                print(f"   ✓ {category} → '{type_label}' (correct)")
            else:
                print(f"   ✗ {category} → '{type_label}' (expected '{expected_label}')")
    
    # Check if sorted by created_at descending
    print("\n   Checking sort order (created_at descending):")
    if len(payments) > 1:
        is_sorted = True
        for i in range(len(payments) - 1):
            if payments[i].get('created_at', '') < payments[i+1].get('created_at', ''):
                is_sorted = False
                break
        if is_sorted:
            print(f"   ✓ Payments sorted by created_at descending")
        else:
            print(f"   ✗ Payments NOT sorted correctly")
    else:
        print(f"   ⚠ Only {len(payments)} payment(s), cannot verify sort order")
else:
    print(f"❌ FAIL: {history_response.text}")

print("\n" + "-" * 80)

# B3: Unknown barber_id → 200 with payments=[]
print("\nB3) GET payment-history with unknown barber_id (should return empty array)")
unknown_history_response = requests.get(
    f"{BACKEND_URL}/api/salons/{salon_id}/barbers/unknown-barber-id/payment-history?limit=25",
    headers=headers
)
print(f"Status: {unknown_history_response.status_code}")
if unknown_history_response.status_code == 200:
    unknown_history_data = unknown_history_response.json()
    payments = unknown_history_data.get("payments", [])
    print(f"✅ PASS: Returned 200 with payments array")
    print(f"   Payments count: {len(payments)}")
    if len(payments) == 0:
        print(f"   ✓ Payments array is empty (correct)")
    else:
        print(f"   ⚠ Payments array not empty (expected empty for unknown barber)")
else:
    print(f"❌ FAIL: Expected 200, got {unknown_history_response.status_code}")

print("\n" + "-" * 80)

# B4: No Authorization → 403
print("\nB4) GET payment-history without Authorization header (should fail)")
no_auth_history_response = requests.get(
    f"{BACKEND_URL}/api/salons/{salon_id}/barbers/{barber_id}/payment-history?limit=25"
)
print(f"Status: {no_auth_history_response.status_code}")
if no_auth_history_response.status_code == 403:
    print(f"✅ PASS: Correctly rejected with 403")
else:
    print(f"❌ FAIL: Expected 403, got {no_auth_history_response.status_code}")

print("\n" + "=" * 80)

# ============================================================================
# SECTION C: SALARY PAYMENT REGRESSION
# ============================================================================
print("\n### SECTION C: SALARY PAYMENT REGRESSION ###\n")

# C1: Ensure salary record exists for 2026-07
print("\nC1) GET staff-salary for month 2026-07 (auto-creates if not exists)")
salary_month_response = requests.get(
    f"{BACKEND_URL}/api/salons/{salon_id}/staff-salary/month/2026-07",
    headers=headers
)
print(f"Status: {salary_month_response.status_code}")
if salary_month_response.status_code == 200:
    salary_data = salary_month_response.json()
    barbers_salary = salary_data.get("barbers", [])
    print(f"✅ PASS: Salary records retrieved/created for 2026-07")
    print(f"   Barbers count: {len(barbers_salary)}")
    
    # Find our test barber
    test_barber_salary = None
    for b in barbers_salary:
        if b.get("barber_id") == barber_id:
            test_barber_salary = b
            break
    
    if test_barber_salary:
        print(f"   Found salary record for {barber_name}")
        print(f"      Base Salary: {test_barber_salary.get('base_salary')}")
        print(f"      Total Payable: {test_barber_salary.get('total_payable')}")
        print(f"      Is Paid: {test_barber_salary.get('is_paid')}")
    else:
        print(f"   ⚠ Salary record for {barber_name} not found in response")
else:
    print(f"❌ FAIL: {salary_month_response.text}")

print("\n" + "-" * 80)

# C2: POST salary payment → 200
print("\nC2) POST staff-salary/pay for barber {barber_name} for 2026-07")
salary_pay_payload = {
    "payment_method": "upi",
    "note": "test"
}
salary_pay_response = requests.post(
    f"{BACKEND_URL}/api/salons/{salon_id}/staff-salary/pay/{barber_id}/2026-07",
    headers=headers,
    json=salary_pay_payload
)
print(f"Status: {salary_pay_response.status_code}")
if salary_pay_response.status_code == 200:
    salary_pay_data = salary_pay_response.json()
    txn = salary_pay_data.get("transaction", {})
    print(f"✅ PASS: Salary payment created")
    print(f"   Transaction ID: {txn.get('id')}")
    print(f"   Category: {txn.get('category')}")
    print(f"   Payment Type: {txn.get('payment_type')}")
    print(f"   Barber ID: {txn.get('barber_id')}")
    print(f"   Barber Name: {txn.get('barber_name')}")
    print(f"   Month: {txn.get('month')}")
    print(f"   Date: {txn.get('date')}")
    
    # Verify enriched fields
    checks = []
    checks.append(("category == 'staff_salary'", txn.get('category') == 'staff_salary'))
    checks.append(("payment_type == 'salary'", txn.get('payment_type') == 'salary'))
    checks.append(("barber_id matches", txn.get('barber_id') == barber_id))
    checks.append(("barber_name matches", txn.get('barber_name') == barber_name))
    checks.append(("month == '2026-07'", txn.get('month') == '2026-07'))
    checks.append(("date is today (YYYY-MM-DD)", len(txn.get('date', '')) == 10))
    
    for check_name, result in checks:
        if result:
            print(f"   ✓ {check_name}")
        else:
            print(f"   ✗ {check_name}")
elif salary_pay_response.status_code == 400:
    error_detail = salary_pay_response.json().get("detail", "")
    if "already paid" in error_detail.lower():
        print(f"⚠ INFO: Salary already paid for this month")
        print(f"   This is expected if test was run multiple times")
        print(f"   Skipping salary payment verification")
    else:
        print(f"❌ FAIL: {error_detail}")
else:
    print(f"❌ FAIL: {salary_pay_response.text}")

print("\n" + "-" * 80)

# C3: Re-run payment-history → salary row appears
print("\nC3) GET payment-history again (should include salary payment)")
final_history_response = requests.get(
    f"{BACKEND_URL}/api/salons/{salon_id}/barbers/{barber_id}/payment-history?limit=25",
    headers=headers
)
print(f"Status: {final_history_response.status_code}")
if final_history_response.status_code == 200:
    final_history_data = final_history_response.json()
    payments = final_history_data.get("payments", [])
    print(f"✅ PASS: Payment history retrieved")
    print(f"   Total payments: {len(payments)}")
    
    # Check if salary payment is at position 0 (newest)
    if len(payments) > 0:
        first_payment = payments[0]
        print(f"\n   First payment (newest):")
        print(f"      Type Label: {first_payment.get('type_label')}")
        print(f"      Category: {first_payment.get('category')}")
        print(f"      Amount: {first_payment.get('amount')}")
        print(f"      Month: {first_payment.get('month')}")
        print(f"      Linked Salary ID: {first_payment.get('linked_salary_id')}")
        
        # Check if it's a salary payment
        if first_payment.get('type_label') == 'Salary':
            print(f"   ✓ Newest payment is Salary (correct)")
            expected_linked_id = f"{salon_id}_{barber_id}_2026-07"
            if first_payment.get('linked_salary_id') == expected_linked_id:
                print(f"   ✓ linked_salary_id matches expected format")
            else:
                print(f"   ⚠ linked_salary_id: {first_payment.get('linked_salary_id')}")
                print(f"      Expected: {expected_linked_id}")
        else:
            print(f"   ⚠ Newest payment is not Salary (might be from previous test run)")
    
    # Count payment types
    salary_count = sum(1 for p in payments if p.get('type_label') == 'Salary')
    advance_count = sum(1 for p in payments if p.get('type_label') == 'Advance')
    ff_count = sum(1 for p in payments if p.get('type_label') == 'Full & Final')
    
    print(f"\n   Payment type summary:")
    print(f"      Salary: {salary_count}")
    print(f"      Advance: {advance_count}")
    print(f"      Full & Final: {ff_count}")
else:
    print(f"❌ FAIL: {final_history_response.text}")

print("\n" + "=" * 80)
print("\n### ALL TESTS COMPLETE ###\n")
