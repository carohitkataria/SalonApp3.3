#!/usr/bin/env python3
"""
Quick OTP authentication test
"""

import requests
import time

BASE_URL = "https://brave-hopper-11.preview.emergentagent.com/api"
ADMIN_PHONE = "+917503070727"

def get_latest_otp():
    """Get the latest OTP from logs"""
    import subprocess
    try:
        result = subprocess.run(['tail', '-n', '50', '/var/log/supervisor/backend.err.log'], 
                              capture_output=True, text=True)
        lines = result.stdout.split('\n')
        for line in reversed(lines):
            if f"Generated OTP for {ADMIN_PHONE}:" in line:
                otp = line.split(': ')[-1]
                return otp.strip()
    except:
        pass
    return None

def test_otp_auth():
    # Send OTP
    print("Sending OTP...")
    response = requests.post(f"{BASE_URL}/salon/send-otp", json={"phone": ADMIN_PHONE})
    print(f"OTP send response: {response.json()}")
    
    # Wait a moment for the log to be written
    time.sleep(2)
    
    # Get OTP from logs
    otp = get_latest_otp()
    if otp:
        print(f"Found OTP in logs: {otp}")
        
        # Verify OTP
        verify_response = requests.post(f"{BASE_URL}/salon/verify-otp", json={
            "phone": ADMIN_PHONE,
            "otp": otp
        })
        print(f"OTP verify response: {verify_response.status_code}")
        print(f"Response data: {verify_response.json()}")
        
        if verify_response.status_code == 200:
            data = verify_response.json()
            if "access_token" in data:
                print(f"✅ Authentication successful!")
                print(f"Token: {data['access_token'][:20]}...")
                print(f"Salon ID: {data.get('salon_id')}")
                return data['access_token'], data.get('salon_id')
    else:
        print("❌ Could not find OTP in logs")
    
    return None, None

if __name__ == "__main__":
    token, salon_id = test_otp_auth()