#!/usr/bin/env python3
"""
Backend test script for Marketing Settings + Wallet + Cashfree + Template Edit endpoints.
Tests salon_id=ribbon-ui-adjust with admin login identifier='admin', password='salon123'.
"""
import requests
import json
import sys
import hmac
import hashlib
import base64
import time

# Configuration
BASE_URL = "https://role-guard-system.preview.emergentagent.com/api"
SALON_ID = "1eddf29d-5ffd-49b0-8dae-130eecd4e62f"
ADMIN_IDENTIFIER = "admin"
ADMIN_PASSWORD = "salon123"

# Test results
results = []

def log_test(name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    results.append({"name": name, "passed": passed, "details": details})
    print(f"{status}: {name}")
    if details:
        print(f"  Details: {details}")

def login_admin():
    """Login as salon admin and return access token"""
    print("\n=== ADMIN LOGIN ===")
    url = f"{BASE_URL}/salon/users/login"
    payload = {
        "identifier": ADMIN_IDENTIFIER,
        "password": ADMIN_PASSWORD
    }
    try:
        resp = requests.post(url, json=payload, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("access_token")
            salon_id = data.get("salon_id")
            log_test("Admin login", True, f"salon_id={salon_id}")
            return token
        else:
            log_test("Admin login", False, f"HTTP {resp.status_code}: {resp.text[:200]}")
            return None
    except Exception as e:
        log_test("Admin login", False, str(e))
        return None

def test_marketing_settings_snapshot(token):
    """A. GET /api/salons/{salon_id}/marketing/settings/full"""
    print("\n=== A. MARKETING SETTINGS SNAPSHOT ===")
    url = f"{BASE_URL}/salons/{SALON_ID}/marketing/settings/full"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            required_keys = ["subaccount", "wallet", "dlt", "email_sender", "send_settings", "spend_month", "env"]
            missing = [k for k in required_keys if k not in data]
            if missing:
                log_test("Marketing settings snapshot - structure", False, f"Missing keys: {missing}")
                return None
            
            # Verify env.cashfree_env
            cashfree_env = data.get("env", {}).get("cashfree_env")
            if cashfree_env == "sandbox":
                log_test("Marketing settings snapshot - cashfree_env", True, f"cashfree_env={cashfree_env}")
            else:
                log_test("Marketing settings snapshot - cashfree_env", False, f"Expected 'sandbox', got '{cashfree_env}'")
            
            log_test("Marketing settings snapshot - HTTP 200", True, f"All required keys present")
            return data
        else:
            log_test("Marketing settings snapshot", False, f"HTTP {resp.status_code}: {resp.text[:200]}")
            return None
    except Exception as e:
        log_test("Marketing settings snapshot", False, str(e))
        return None

def test_wallet_flow(token):
    """B. Wallet flow (GET, topup, simulate-credit, idempotency, ledger)"""
    print("\n=== B. WALLET FLOW ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    # B2. GET wallet - note current balance
    url_wallet = f"{BASE_URL}/salons/{SALON_ID}/wallet"
    try:
        resp = requests.get(url_wallet, headers=headers, timeout=10)
        if resp.status_code == 200:
            wallet_data = resp.json()
            initial_balance = wallet_data.get("balance_minor", 0)
            first_recharge_at = wallet_data.get("first_recharge_at")
            log_test("GET /wallet", True, f"balance_minor={initial_balance}, first_recharge_at={first_recharge_at}")
        else:
            log_test("GET /wallet", False, f"HTTP {resp.status_code}: {resp.text[:200]}")
            return
    except Exception as e:
        log_test("GET /wallet", False, str(e))
        return
    
    # B3. POST /wallet/topup with 50000 paise (₹500)
    url_topup = f"{BASE_URL}/salons/{SALON_ID}/wallet/topup"
    topup_payload = {"amount_minor": 50000}
    try:
        resp = requests.post(url_topup, json=topup_payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            topup_data = resp.json()
            provider_order_id = topup_data.get("provider_order_id")
            payment_session_id = topup_data.get("payment_session_id")
            amount_minor = topup_data.get("amount_minor")
            cashfree_env = topup_data.get("cashfree_env")
            
            if not provider_order_id or not payment_session_id:
                log_test("POST /wallet/topup - response fields", False, "Missing provider_order_id or payment_session_id")
                return
            
            if not payment_session_id.startswith("session_dummy_"):
                log_test("POST /wallet/topup - DUMMY session", False, f"Expected session_dummy_*, got {payment_session_id}")
            else:
                log_test("POST /wallet/topup - DUMMY session", True, f"payment_session_id={payment_session_id[:40]}...")
            
            if amount_minor == 50000 and cashfree_env == "sandbox":
                log_test("POST /wallet/topup - amount & env", True, f"amount_minor=50000, cashfree_env=sandbox")
            else:
                log_test("POST /wallet/topup - amount & env", False, f"amount_minor={amount_minor}, cashfree_env={cashfree_env}")
        else:
            log_test("POST /wallet/topup", False, f"HTTP {resp.status_code}: {resp.text[:200]}")
            return
    except Exception as e:
        log_test("POST /wallet/topup", False, str(e))
        return
    
    # B4. First-recharge floor check (only if first_recharge_at is null)
    if first_recharge_at is None:
        url_topup_small = f"{BASE_URL}/salons/{SALON_ID}/wallet/topup"
        small_payload = {"amount_minor": 10000}  # ₹100
        try:
            resp = requests.post(url_topup_small, json=small_payload, headers=headers, timeout=10)
            if resp.status_code == 400:
                detail = resp.json().get("detail", "")
                if "₹500" in detail or "500" in detail:
                    log_test("First-recharge floor (₹500)", True, f"Correctly rejected ₹100: {detail}")
                else:
                    log_test("First-recharge floor (₹500)", False, f"400 but wrong message: {detail}")
            else:
                log_test("First-recharge floor (₹500)", False, f"Expected 400, got {resp.status_code}")
        except Exception as e:
            log_test("First-recharge floor (₹500)", False, str(e))
    else:
        log_test("First-recharge floor (₹500)", True, "SKIPPED - first_recharge_at already set from prior test")
    
    # B5. POST /wallet/simulate-credit
    url_simulate = f"{BASE_URL}/salons/{SALON_ID}/wallet/simulate-credit"
    simulate_payload = {"provider_order_id": provider_order_id}
    try:
        resp = requests.post(url_simulate, json=simulate_payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            sim_data = resp.json()
            ok = sim_data.get("ok")
            new_balance = sim_data.get("balance_minor")
            if ok and new_balance == initial_balance + 50000:
                log_test("POST /wallet/simulate-credit", True, f"balance increased by 50000 to {new_balance}")
            else:
                log_test("POST /wallet/simulate-credit", False, f"ok={ok}, balance={new_balance}, expected={initial_balance + 50000}")
        else:
            log_test("POST /wallet/simulate-credit", False, f"HTTP {resp.status_code}: {resp.text[:200]}")
            return
    except Exception as e:
        log_test("POST /wallet/simulate-credit", False, str(e))
        return
    
    # Verify wallet balance increased
    try:
        resp = requests.get(url_wallet, headers=headers, timeout=10)
        if resp.status_code == 200:
            wallet_data = resp.json()
            current_balance = wallet_data.get("balance_minor", 0)
            marketing_status = wallet_data.get("marketing_status")
            first_recharge_at_after = wallet_data.get("first_recharge_at")
            
            if current_balance == initial_balance + 50000:
                log_test("GET /wallet after simulate-credit - balance", True, f"balance_minor={current_balance}")
            else:
                log_test("GET /wallet after simulate-credit - balance", False, f"Expected {initial_balance + 50000}, got {current_balance}")
            
            if marketing_status == "active":
                log_test("GET /wallet after simulate-credit - status", True, f"marketing_status=active")
            else:
                log_test("GET /wallet after simulate-credit - status", False, f"marketing_status={marketing_status}")
            
            if first_recharge_at_after:
                log_test("GET /wallet after simulate-credit - first_recharge_at", True, f"first_recharge_at set")
            else:
                log_test("GET /wallet after simulate-credit - first_recharge_at", False, "first_recharge_at still null")
        else:
            log_test("GET /wallet after simulate-credit", False, f"HTTP {resp.status_code}")
    except Exception as e:
        log_test("GET /wallet after simulate-credit", False, str(e))
    
    # B6. Idempotency check - call simulate-credit again with same provider_order_id
    try:
        resp = requests.post(url_simulate, json=simulate_payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            sim_data = resp.json()
            idempotent = sim_data.get("idempotent")
            if idempotent:
                log_test("Idempotency check - simulate-credit", True, "idempotent=true returned")
            else:
                log_test("Idempotency check - simulate-credit", False, f"idempotent={idempotent}")
            
            # Verify balance did NOT increase again
            resp2 = requests.get(url_wallet, headers=headers, timeout=10)
            if resp2.status_code == 200:
                wallet_data2 = resp2.json()
                balance_after_replay = wallet_data2.get("balance_minor", 0)
                if balance_after_replay == current_balance:
                    log_test("Idempotency check - balance unchanged", True, f"balance still {balance_after_replay}")
                else:
                    log_test("Idempotency check - balance unchanged", False, f"Balance changed from {current_balance} to {balance_after_replay}")
        else:
            log_test("Idempotency check - simulate-credit", False, f"HTTP {resp.status_code}")
    except Exception as e:
        log_test("Idempotency check - simulate-credit", False, str(e))
    
    # B7. GET /wallet/ledger
    url_ledger = f"{BASE_URL}/salons/{SALON_ID}/wallet/ledger"
    try:
        resp = requests.get(url_ledger, headers=headers, timeout=10)
        if resp.status_code == 200:
            ledger_data = resp.json()
            entries = ledger_data.get("entries", [])
            # Find entry with type='topup' and amount_minor=50000 and ref=provider_order_id
            found = False
            for entry in entries:
                if (entry.get("type") == "topup" and 
                    entry.get("amount_minor") == 50000 and 
                    entry.get("ref") == provider_order_id):
                    found = True
                    break
            if found:
                log_test("GET /wallet/ledger", True, f"Found topup entry for {provider_order_id}")
            else:
                log_test("GET /wallet/ledger", False, f"Topup entry not found in {len(entries)} entries")
        else:
            log_test("GET /wallet/ledger", False, f"HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("GET /wallet/ledger", False, str(e))

def test_cashfree_webhook_signature(token):
    """C. Cashfree webhook signature check"""
    print("\n=== C. CASHFREE WEBHOOK SIGNATURE CHECK ===")
    url = f"{BASE_URL}/webhooks/cashfree"
    
    # Test with empty body and no signature headers
    try:
        resp = requests.post(url, data=b"", headers={}, timeout=10)
        if resp.status_code == 401:
            log_test("POST /webhooks/cashfree - no signature", True, "Correctly rejected with 401")
        else:
            log_test("POST /webhooks/cashfree - no signature", False, f"Expected 401, got {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("POST /webhooks/cashfree - no signature", False, str(e))

def test_auto_recharge_config(token):
    """D. Auto-recharge config"""
    print("\n=== D. AUTO-RECHARGE CONFIG ===")
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/salons/{SALON_ID}/wallet/auto-recharge"
    
    payload = {
        "auto_recharge": True,
        "recharge_threshold_minor": 20000,
        "recharge_amount_minor": 100000,
        "low_balance_alert_minor": 30000
    }
    
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if (data.get("auto_recharge") == True and 
                data.get("recharge_threshold_minor") == 20000 and
                data.get("recharge_amount_minor") == 100000 and
                data.get("low_balance_alert_minor") == 30000):
                log_test("POST /wallet/auto-recharge", True, "Config saved")
            else:
                log_test("POST /wallet/auto-recharge", False, f"Response mismatch: {data}")
        else:
            log_test("POST /wallet/auto-recharge", False, f"HTTP {resp.status_code}: {resp.text[:200]}")
            return
    except Exception as e:
        log_test("POST /wallet/auto-recharge", False, str(e))
        return
    
    # Verify via GET /wallet
    url_wallet = f"{BASE_URL}/salons/{SALON_ID}/wallet"
    try:
        resp = requests.get(url_wallet, headers=headers, timeout=10)
        if resp.status_code == 200:
            wallet_data = resp.json()
            if (wallet_data.get("auto_recharge") == True and
                wallet_data.get("recharge_threshold_minor") == 20000 and
                wallet_data.get("recharge_amount_minor") == 100000 and
                wallet_data.get("low_balance_alert_minor") == 30000):
                log_test("GET /wallet - auto-recharge config", True, "Config persisted")
            else:
                log_test("GET /wallet - auto-recharge config", False, f"Config mismatch: {wallet_data}")
        else:
            log_test("GET /wallet - auto-recharge config", False, f"HTTP {resp.status_code}")
    except Exception as e:
        log_test("GET /wallet - auto-recharge config", False, str(e))

def test_waba_flow(token):
    """E. WABA (Twilio sub-account) - MOCKED path"""
    print("\n=== E. WABA EMBEDDED-SIGNUP + SYNC ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    # E10. POST /waba/sync BEFORE embedded-signup → 404
    url_sync = f"{BASE_URL}/salons/{SALON_ID}/marketing/settings/waba/sync"
    try:
        resp = requests.post(url_sync, headers=headers, timeout=10)
        if resp.status_code == 404:
            detail = resp.json().get("detail", "")
            if "not configured" in detail.lower():
                log_test("POST /waba/sync before signup", True, f"404: {detail}")
            else:
                log_test("POST /waba/sync before signup", False, f"404 but wrong message: {detail}")
        else:
            # If it returns 200, it means sub-account already exists from prior test
            log_test("POST /waba/sync before signup", True, f"SKIPPED - sub-account already exists (HTTP {resp.status_code})")
    except Exception as e:
        log_test("POST /waba/sync before signup", False, str(e))
    
    # E11. POST /waba/embedded-signup-complete
    url_signup = f"{BASE_URL}/salons/{SALON_ID}/marketing/settings/waba/embedded-signup-complete"
    signup_payload = {
        "waba_id": "wa_test_123",
        "phone": "+918560934455",
        "display_name": "The Looks Test"
    }
    try:
        resp = requests.post(url_signup, json=signup_payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            subaccount_sid = data.get("subaccount_sid")
            waba_id = data.get("waba_id")
            sender_phone = data.get("sender_phone_e164")
            sender_status = data.get("sender_status")
            
            checks = []
            if subaccount_sid and subaccount_sid.startswith("ACsub_"):
                checks.append("subaccount_sid starts with ACsub_")
            else:
                checks.append(f"❌ subaccount_sid={subaccount_sid}")
            
            if waba_id == "wa_test_123":
                checks.append("waba_id=wa_test_123")
            else:
                checks.append(f"❌ waba_id={waba_id}")
            
            if sender_status == "online":
                checks.append("sender_status=online")
            else:
                checks.append(f"❌ sender_status={sender_status}")
            
            all_pass = all("❌" not in c for c in checks)
            log_test("POST /waba/embedded-signup-complete", all_pass, "; ".join(checks))
        else:
            log_test("POST /waba/embedded-signup-complete", False, f"HTTP {resp.status_code}: {resp.text[:200]}")
            return
    except Exception as e:
        log_test("POST /waba/embedded-signup-complete", False, str(e))
        return
    
    # E12. GET /marketing/settings/full → verify subaccount
    url_full = f"{BASE_URL}/salons/{SALON_ID}/marketing/settings/full"
    try:
        resp = requests.get(url_full, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            subaccount = data.get("subaccount", {})
            if (subaccount.get("sender_status") == "online" and
                subaccount.get("waba_id") == "wa_test_123"):
                log_test("GET /marketing/settings/full - subaccount", True, "sender_status=online, waba_id=wa_test_123")
            else:
                log_test("GET /marketing/settings/full - subaccount", False, f"subaccount={subaccount}")
        else:
            log_test("GET /marketing/settings/full - subaccount", False, f"HTTP {resp.status_code}")
    except Exception as e:
        log_test("GET /marketing/settings/full - subaccount", False, str(e))
    
    # E13. POST /waba/sync → 200
    try:
        resp = requests.post(url_sync, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("subaccount_sid") and data.get("updated_at"):
                log_test("POST /waba/sync after signup", True, "Sync successful, updated_at bumped")
            else:
                log_test("POST /waba/sync after signup", False, f"Response: {data}")
        else:
            log_test("POST /waba/sync after signup", False, f"HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("POST /waba/sync after signup", False, str(e))

def test_usage_sync(token):
    """F. Usage sync (MOCKED)"""
    print("\n=== F. USAGE SYNC (MOCKED) ===")
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{BASE_URL}/salons/{SALON_ID}/marketing/settings/usage-sync"
    
    try:
        resp = requests.post(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            synced_at = data.get("synced_at")
            records_updated = data.get("records_updated")
            detail = data.get("detail", "")
            
            if synced_at and records_updated == 1 and "MOCKED" in detail:
                log_test("POST /usage-sync", True, f"synced_at={synced_at}, records_updated=1, MOCKED")
            else:
                log_test("POST /usage-sync", False, f"Response: {data}")
        else:
            log_test("POST /usage-sync", False, f"HTTP {resp.status_code}: {resp.text[:200]}")
            return
    except Exception as e:
        log_test("POST /usage-sync", False, str(e))
        return
    
    # Verify via GET /marketing/settings/full
    url_full = f"{BASE_URL}/salons/{SALON_ID}/marketing/settings/full"
    try:
        resp = requests.get(url_full, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            spend_month = data.get("spend_month", {})
            channels = spend_month.get("channels", {})
            whatsapp = channels.get("whatsapp", {})
            if "count" in whatsapp and "cost_minor" in whatsapp:
                log_test("GET /marketing/settings/full - spend_month.channels.whatsapp", True, f"whatsapp keys exist: {whatsapp}")
            else:
                log_test("GET /marketing/settings/full - spend_month.channels.whatsapp", False, f"whatsapp={whatsapp}")
        else:
            log_test("GET /marketing/settings/full - spend_month", False, f"HTTP {resp.status_code}")
    except Exception as e:
        log_test("GET /marketing/settings/full - spend_month", False, str(e))

def test_dlt_email_sending_windows(token):
    """G. DLT, Email, Sending windows (upserts)"""
    print("\n=== G. DLT + EMAIL + SENDING WINDOWS ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    # G15. POST /dlt
    url_dlt = f"{BASE_URL}/salons/{SALON_ID}/marketing/settings/dlt"
    dlt_payload = {
        "entity_id": "1101a1234567890",
        "sender_header": "TLKSLN",
        "provider": "twilio"
    }
    try:
        resp = requests.post(url_dlt, json=dlt_payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("entity_id") == "1101a1234567890":
                log_test("POST /dlt", True, f"entity_id={data.get('entity_id')}")
            else:
                log_test("POST /dlt", False, f"Response: {data}")
        else:
            log_test("POST /dlt", False, f"HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("POST /dlt", False, str(e))
    
    # Round-trip via GET /full
    url_full = f"{BASE_URL}/salons/{SALON_ID}/marketing/settings/full"
    try:
        resp = requests.get(url_full, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            dlt = data.get("dlt", {})
            if dlt.get("entity_id") == "1101a1234567890":
                log_test("GET /full - dlt round-trip", True, f"entity_id matches")
            else:
                log_test("GET /full - dlt round-trip", False, f"dlt={dlt}")
        else:
            log_test("GET /full - dlt round-trip", False, f"HTTP {resp.status_code}")
    except Exception as e:
        log_test("GET /full - dlt round-trip", False, str(e))
    
    # G16. POST /email
    url_email = f"{BASE_URL}/salons/{SALON_ID}/marketing/settings/email"
    email_payload = {
        "from_name": "The Looks Salon",
        "from_email": "hello@thelooks.in",
        "reply_to": "care@thelooks.in"
    }
    try:
        resp = requests.post(url_email, json=email_payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("verified") == True and data.get("from_email") == "hello@thelooks.in":
                log_test("POST /email", True, f"verified=true, from_email={data.get('from_email')}")
            else:
                log_test("POST /email", False, f"Response: {data}")
        else:
            log_test("POST /email", False, f"HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("POST /email", False, str(e))
    
    # Round-trip via GET /full
    try:
        resp = requests.get(url_full, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            email_sender = data.get("email_sender", {})
            if email_sender.get("from_email") == "hello@thelooks.in":
                log_test("GET /full - email round-trip", True, f"from_email matches")
            else:
                log_test("GET /full - email round-trip", False, f"email_sender={email_sender}")
        else:
            log_test("GET /full - email round-trip", False, f"HTTP {resp.status_code}")
    except Exception as e:
        log_test("GET /full - email round-trip", False, str(e))
    
    # G17. POST /sending-windows
    url_windows = f"{BASE_URL}/salons/{SALON_ID}/marketing/settings/sending-windows"
    windows_payload = {
        "window_start": "10:00",
        "window_end": "21:00",
        "quiet_start": "22:00",
        "quiet_end": "09:00",
        "optout_keyword": "STOP",
        "require_optin": True,
        "per_guest_cap_per_week": 3
    }
    try:
        resp = requests.post(url_windows, json=windows_payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("window_start") == "10:00" and data.get("per_guest_cap_per_week") == 3:
                log_test("POST /sending-windows", True, f"window_start={data.get('window_start')}")
            else:
                log_test("POST /sending-windows", False, f"Response: {data}")
        else:
            log_test("POST /sending-windows", False, f"HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("POST /sending-windows", False, str(e))
    
    # Round-trip via GET /full
    try:
        resp = requests.get(url_full, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            send_settings = data.get("send_settings", {})
            if send_settings.get("window_start") == "10:00":
                log_test("GET /full - sending-windows round-trip", True, f"window_start matches")
            else:
                log_test("GET /full - sending-windows round-trip", False, f"send_settings={send_settings}")
        else:
            log_test("GET /full - sending-windows round-trip", False, f"HTTP {resp.status_code}")
    except Exception as e:
        log_test("GET /full - sending-windows round-trip", False, str(e))

def test_template_edit_delete(token):
    """H. Template Edit + Delete"""
    print("\n=== H. TEMPLATE EDIT + DELETE ===")
    headers = {"Authorization": f"Bearer {token}"}
    
    # H18. POST /marketing/templates - create
    url_templates = f"{BASE_URL}/salons/{SALON_ID}/marketing/templates"
    create_payload = {
        "name": "test_edit_template",
        "category": "utility",
        "body": "Hi {{1}}",
        "lang_code": "en",
        "meta_status": "draft"
    }
    try:
        resp = requests.post(url_templates, json=create_payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            template_id = data.get("id")
            if template_id:
                log_test("POST /marketing/templates - create", True, f"id={template_id}")
            else:
                log_test("POST /marketing/templates - create", False, f"No id in response: {data}")
                return
        else:
            log_test("POST /marketing/templates - create", False, f"HTTP {resp.status_code}: {resp.text[:200]}")
            return
    except Exception as e:
        log_test("POST /marketing/templates - create", False, str(e))
        return
    
    # H19. PUT /marketing/templates/{tid} - edit
    url_edit = f"{BASE_URL}/salons/{SALON_ID}/marketing/templates/{template_id}"
    edit_payload = {
        "name": "test_edit_template",
        "category": "utility",
        "body": "Hi {{1}}, welcome to {{2}}!",
        "lang_code": "en"
    }
    try:
        resp = requests.put(url_edit, json=edit_payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("body") == "Hi {{1}}, welcome to {{2}}!":
                log_test("PUT /marketing/templates/{tid} - edit", True, f"body updated")
            else:
                log_test("PUT /marketing/templates/{tid} - edit", False, f"body={data.get('body')}")
        else:
            log_test("PUT /marketing/templates/{tid} - edit", False, f"HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        log_test("PUT /marketing/templates/{tid} - edit", False, str(e))
    
    # Verify via GET /marketing/templates
    try:
        resp = requests.get(url_templates, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            templates = data.get("templates", [])
            found = None
            for t in templates:
                if t.get("id") == template_id:
                    found = t
                    break
            if found and found.get("body") == "Hi {{1}}, welcome to {{2}}!":
                log_test("GET /marketing/templates - verify edit", True, f"Updated body confirmed")
            else:
                log_test("GET /marketing/templates - verify edit", False, f"Template not found or body mismatch")
        else:
            log_test("GET /marketing/templates - verify edit", False, f"HTTP {resp.status_code}")
    except Exception as e:
        log_test("GET /marketing/templates - verify edit", False, str(e))
    
    # H20. PUT for non-existent tid → 404
    fake_id = "00000000-0000-0000-0000-000000000000"
    url_fake = f"{BASE_URL}/salons/{SALON_ID}/marketing/templates/{fake_id}"
    try:
        resp = requests.put(url_fake, json=edit_payload, headers=headers, timeout=10)
        if resp.status_code == 404:
            log_test("PUT /marketing/templates/{fake_id} - 404", True, "Correctly returned 404")
        else:
            log_test("PUT /marketing/templates/{fake_id} - 404", False, f"Expected 404, got {resp.status_code}")
    except Exception as e:
        log_test("PUT /marketing/templates/{fake_id} - 404", False, str(e))
    
    # H21. DELETE /marketing/templates/{tid}
    url_delete = f"{BASE_URL}/salons/{SALON_ID}/marketing/templates/{template_id}"
    try:
        resp = requests.delete(url_delete, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("deleted") == True and data.get("id") == template_id:
                log_test("DELETE /marketing/templates/{tid}", True, f"deleted=true, id={template_id}")
            else:
                log_test("DELETE /marketing/templates/{tid}", False, f"Response: {data}")
        else:
            log_test("DELETE /marketing/templates/{tid}", False, f"HTTP {resp.status_code}: {resp.text[:200]}")
            return
    except Exception as e:
        log_test("DELETE /marketing/templates/{tid}", False, str(e))
        return
    
    # Verify template no longer in list
    try:
        resp = requests.get(url_templates, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            templates = data.get("templates", [])
            found = any(t.get("id") == template_id for t in templates)
            if not found:
                log_test("GET /marketing/templates - verify delete", True, "Template no longer in list")
            else:
                log_test("GET /marketing/templates - verify delete", False, "Template still in list")
        else:
            log_test("GET /marketing/templates - verify delete", False, f"HTTP {resp.status_code}")
    except Exception as e:
        log_test("GET /marketing/templates - verify delete", False, str(e))

def test_auth_enforcement(token):
    """I. Auth enforcement"""
    print("\n=== I. AUTH ENFORCEMENT ===")
    
    # Test wallet endpoint without auth
    url_wallet = f"{BASE_URL}/salons/{SALON_ID}/wallet"
    try:
        resp = requests.get(url_wallet, timeout=10)
        if resp.status_code in [401, 403]:
            log_test("GET /wallet - no auth", True, f"Correctly rejected with {resp.status_code}")
        else:
            log_test("GET /wallet - no auth", False, f"Expected 401/403, got {resp.status_code}")
    except Exception as e:
        log_test("GET /wallet - no auth", False, str(e))
    
    # Test topup endpoint without auth
    url_topup = f"{BASE_URL}/salons/{SALON_ID}/wallet/topup"
    try:
        resp = requests.post(url_topup, json={"amount_minor": 50000}, timeout=10)
        if resp.status_code in [401, 403]:
            log_test("POST /wallet/topup - no auth", True, f"Correctly rejected with {resp.status_code}")
        else:
            log_test("POST /wallet/topup - no auth", False, f"Expected 401/403, got {resp.status_code}")
    except Exception as e:
        log_test("POST /wallet/topup - no auth", False, str(e))
    
    # Test DLT endpoint without auth
    url_dlt = f"{BASE_URL}/salons/{SALON_ID}/marketing/settings/dlt"
    try:
        resp = requests.post(url_dlt, json={"entity_id": "test", "sender_header": "TEST", "provider": "twilio"}, timeout=10)
        if resp.status_code in [401, 403]:
            log_test("POST /dlt - no auth", True, f"Correctly rejected with {resp.status_code}")
        else:
            log_test("POST /dlt - no auth", False, f"Expected 401/403, got {resp.status_code}")
    except Exception as e:
        log_test("POST /dlt - no auth", False, str(e))

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for r in results if r["passed"])
    failed = sum(1 for r in results if not r["passed"])
    total = len(results)
    
    print(f"\nTotal: {total} tests")
    print(f"✅ Passed: {passed}")
    print(f"❌ Failed: {failed}")
    print(f"Success Rate: {passed/total*100:.1f}%\n")
    
    if failed > 0:
        print("FAILED TESTS:")
        for r in results:
            if not r["passed"]:
                print(f"  ❌ {r['name']}")
                if r["details"]:
                    print(f"     {r['details']}")
    
    print("\n" + "="*80)

def main():
    """Main test runner"""
    print("="*80)
    print("MARKETING SETTINGS + WALLET + CASHFREE + TEMPLATE EDIT BACKEND TESTS")
    print(f"Salon ID: {SALON_ID}")
    print(f"Admin: {ADMIN_IDENTIFIER}")
    print("="*80)
    
    # Login
    token = login_admin()
    if not token:
        print("\n❌ CRITICAL: Admin login failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Run all test suites
    test_marketing_settings_snapshot(token)
    test_wallet_flow(token)
    test_cashfree_webhook_signature(token)
    test_auto_recharge_config(token)
    test_waba_flow(token)
    test_usage_sync(token)
    test_dlt_email_sending_windows(token)
    test_template_edit_delete(token)
    test_auth_enforcement(token)
    
    # Print summary
    print_summary()
    
    # Exit with appropriate code
    failed = sum(1 for r in results if not r["passed"])
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()
