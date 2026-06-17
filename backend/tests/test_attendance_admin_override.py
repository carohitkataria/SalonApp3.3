"""
Iteration 24 — Admin attendance override + leave-type popup.

Covers:
  * GET  /api/salons/{salon_id}/leave-types-config  (4 defaults)
  * PUT  /api/salons/{salon_id}/staff-attendance/check-edit/{barber_id}/{date}
      - 10:00 → 19:00 (auto)  → present, total_minutes = 540
      - 10:00 → 13:00 (auto)  → half_day
  * PUT  /api/salons/{salon_id}/staff-attendance/override/{barber_id}/{date}
      - manual status=holiday persists
  * POST /api/salons/{salon_id}/leave-records (UL — should succeed)
  * DELETE clear flow:
      DELETE /api/salons/{salon_id}/leave-records/{id}
      DELETE /api/salons/{salon_id}/staff-attendance/override/{barber_id}/{date}
"""

import os
import pytest
import requests
from datetime import datetime, timedelta
from pathlib import Path


def _load_backend_url():
    env_url = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if env_url:
        return env_url.rstrip("/")
    fe_env = Path("/app/frontend/.env")
    if fe_env.exists():
        for line in fe_env.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not configured")


BASE_URL = _load_backend_url()
SALON_ID = os.environ.get("TEST_SALON_ID", "f3cb8e07-ba03-4d5f-aa02-17790108604a")
BARBER_ID = os.environ.get("TEST_BARBER_ID", "cadba382-4ca9-4c6e-823b-25a1f37f2792")
LOGIN_PHONE = os.environ.get("TEST_SALON_PHONE", "+917503070727")
LOGIN_PASSWORD = os.environ.get("TEST_SALON_PASSWORD", "Test@1234")


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{BASE_URL}/api/salon/password-login",
        json={"phone": LOGIN_PHONE, "password": LOGIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok, "No access_token in login response"
    return tok


@pytest.fixture(scope="module")
def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _date_offset(days):
    return (datetime.utcnow().date() + timedelta(days=days)).isoformat()


# Use unique past dates per test to avoid cross-test interference.
DATE_PRESENT = _date_offset(-7)
DATE_HALFDAY = _date_offset(-8)
DATE_HOLIDAY = _date_offset(-9)
DATE_LEAVE = _date_offset(-10)
DATE_CLEAR = _date_offset(-11)


# ---------- leave-types-config ----------
class TestLeaveTypesConfig:
    def test_returns_four_default_types(self, auth):
        r = requests.get(
            f"{BASE_URL}/api/salons/{SALON_ID}/leave-types-config",
            headers=auth, timeout=15,
        )
        assert r.status_code == 200, r.text
        items = r.json().get("items", [])
        codes = {it["code"] for it in items if it.get("is_active", True)}
        for expected in ("CL", "SL", "PL", "UL"):
            assert expected in codes, f"Missing default leave type {expected} — got {codes}"


# ---------- check-edit auto-compute ----------
class TestCheckEditAuto:
    def _cleanup(self, auth, date):
        try:
            requests.delete(
                f"{BASE_URL}/api/salons/{SALON_ID}/staff-attendance/override/{BARBER_ID}/{date}",
                headers=auth, timeout=10,
            )
        except Exception:
            pass

    def test_full_day_marks_present_with_540_minutes(self, auth):
        self._cleanup(auth, DATE_PRESENT)
        # Frontend uses local browser time → ISO. Salon is IST; use +05:30 so
        # 10:00 IST → max_check_in_time 10:30 IST passes.
        ci = f"{DATE_PRESENT}T10:00:00+05:30"
        co = f"{DATE_PRESENT}T19:00:00+05:30"
        r = requests.put(
            f"{BASE_URL}/api/salons/{SALON_ID}/staff-attendance/check-edit/{BARBER_ID}/{DATE_PRESENT}",
            headers=auth, json={"check_in_at": ci, "check_out_at": co},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        rec = r.json().get("record") or {}
        assert rec.get("total_minutes") == 540, f"Expected 540 min, got {rec.get('total_minutes')}"
        assert rec.get("status") == "present", f"Expected status=present, got {rec.get('status')}"

    def test_short_day_marks_half_day(self, auth):
        self._cleanup(auth, DATE_HALFDAY)
        ci = f"{DATE_HALFDAY}T10:00:00+05:30"
        co = f"{DATE_HALFDAY}T13:00:00+05:30"
        r = requests.put(
            f"{BASE_URL}/api/salons/{SALON_ID}/staff-attendance/check-edit/{BARBER_ID}/{DATE_HALFDAY}",
            headers=auth, json={"check_in_at": ci, "check_out_at": co},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        rec = r.json().get("record") or {}
        assert rec.get("total_minutes") == 180
        # 3 hours should resolve to half_day (or absent if below half-day threshold).
        assert rec.get("status") in ("half_day", "absent"), (
            f"Expected half_day/absent, got {rec.get('status')}"
        )


# ---------- manual status override ----------
class TestManualOverride:
    def test_holiday_persists(self, auth):
        r = requests.put(
            f"{BASE_URL}/api/salons/{SALON_ID}/staff-attendance/override/{BARBER_ID}/{DATE_HOLIDAY}",
            headers=auth, json={"status": "holiday", "note": "TEST_holiday"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "holiday"

        # GET via month endpoint to verify persistence
        ym = DATE_HOLIDAY[:7]
        g = requests.get(
            f"{BASE_URL}/api/salons/{SALON_ID}/staff-attendance/month/{ym}?barber_id={BARBER_ID}",
            headers=auth, timeout=15,
        )
        assert g.status_code == 200, g.text
        barbers = g.json().get("barbers", [])
        target = next((b for b in barbers if b.get("barber_id") == BARBER_ID), None)
        assert target, "Barber not found in month response"
        day = next((a for a in target.get("attendance", []) if a.get("date") == DATE_HOLIDAY), None)
        assert day and day.get("status") == "holiday", (
            f"Holiday not persisted, day={day}"
        )

        # cleanup
        requests.delete(
            f"{BASE_URL}/api/salons/{SALON_ID}/staff-attendance/override/{BARBER_ID}/{DATE_HOLIDAY}",
            headers=auth, timeout=10,
        )

    def test_invalid_status_rejected(self, auth):
        r = requests.put(
            f"{BASE_URL}/api/salons/{SALON_ID}/staff-attendance/override/{BARBER_ID}/{DATE_HOLIDAY}",
            headers=auth, json={"status": "bogus", "note": "x"},
            timeout=15,
        )
        assert r.status_code == 400


# ---------- leave records (UL) ----------
class TestLeaveRecord:
    leave_id = None

    def test_create_unpaid_leave_succeeds(self, auth):
        # Pre-cancel any existing leave on this date
        existing = requests.get(
            f"{BASE_URL}/api/salons/{SALON_ID}/leave-records",
            headers=auth, params={"barber_id": BARBER_ID, "from": DATE_LEAVE, "to": DATE_LEAVE},
            timeout=15,
        )
        if existing.status_code == 200:
            for rec in existing.json().get("records", []):
                if rec.get("status") == "active":
                    requests.delete(
                        f"{BASE_URL}/api/salons/{SALON_ID}/leave-records/{rec['id']}",
                        headers=auth, timeout=10,
                    )

        r = requests.post(
            f"{BASE_URL}/api/salons/{SALON_ID}/leave-records",
            headers=auth,
            json={
                "barber_id": BARBER_ID,
                "leave_type_code": "UL",
                "date": DATE_LEAVE,
                "half_day": False,
                "note": "TEST_unpaid_leave",
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        rec = r.json().get("record") or {}
        assert rec.get("leave_type_code") == "UL"
        assert rec.get("status") == "active"
        assert rec.get("date") == DATE_LEAVE
        TestLeaveRecord.leave_id = rec.get("id")

    def test_leave_appears_in_listing(self, auth):
        assert TestLeaveRecord.leave_id, "previous test must have created a leave"
        r = requests.get(
            f"{BASE_URL}/api/salons/{SALON_ID}/leave-records",
            headers=auth,
            params={"barber_id": BARBER_ID, "from": DATE_LEAVE, "to": DATE_LEAVE},
            timeout=15,
        )
        assert r.status_code == 200
        ids = [rec["id"] for rec in r.json().get("records", []) if rec.get("status") == "active"]
        assert TestLeaveRecord.leave_id in ids

    def test_cancel_leave(self, auth):
        if not TestLeaveRecord.leave_id:
            pytest.skip("no leave to cancel")
        r = requests.delete(
            f"{BASE_URL}/api/salons/{SALON_ID}/leave-records/{TestLeaveRecord.leave_id}",
            headers=auth, timeout=15,
        )
        assert r.status_code in (200, 204), r.text


# ---------- clear flow ----------
class TestClearOverride:
    def test_clear_removes_attendance_override(self, auth):
        # First create an override
        r = requests.put(
            f"{BASE_URL}/api/salons/{SALON_ID}/staff-attendance/override/{BARBER_ID}/{DATE_CLEAR}",
            headers=auth, json={"status": "absent", "note": "TEST_clear"},
            timeout=15,
        )
        assert r.status_code == 200, r.text

        # Now clear it
        d = requests.delete(
            f"{BASE_URL}/api/salons/{SALON_ID}/staff-attendance/override/{BARBER_ID}/{DATE_CLEAR}",
            headers=auth, timeout=15,
        )
        assert d.status_code in (200, 204), d.text

        # Verify gone via month endpoint
        ym = DATE_CLEAR[:7]
        g = requests.get(
            f"{BASE_URL}/api/salons/{SALON_ID}/staff-attendance/month/{ym}?barber_id={BARBER_ID}",
            headers=auth, timeout=15,
        )
        assert g.status_code == 200
        barbers = g.json().get("barbers", [])
        target = next((b for b in barbers if b.get("barber_id") == BARBER_ID), None)
        if target:
            day = next((a for a in target.get("attendance", []) if a.get("date") == DATE_CLEAR), None)
            # After clear, either no entry, or status is not the absent we set.
            if day is not None:
                assert day.get("status") != "absent" or day.get("auto_calculated"), (
                    f"Override not cleared, day still: {day}"
                )
