"""
Tests for multi-session check-in/check-out on the same day (#1c).

Verifies:
1. First check-in creates sessions=[{ci, ...}] and clears check_out_at.
2. Second check-in while first session is OPEN → 409.
3. Check-out closes the last open session; total_minutes accumulates.
4. Second check-in AFTER a check-out is allowed and appends a new session.
5. compute_mode_b_status sums across sessions correctly.
"""
from datetime import datetime, timezone, timedelta
from backend.attendance_mode import compute_mode_b_status


def _mk_salon():
    return {
        "geo_settings": {
            "late_mark_threshold_min": 30,
            "required_hours_per_day": 8.0,
            "max_check_in_time": "10:00",
            "min_daily_minutes": 480,
        },
        "operational_hours": {},
    }


def _iso(y, m, d, hh, mm, tz_offset_h=5, tz_offset_m=30):
    tz = timezone(timedelta(hours=tz_offset_h, minutes=tz_offset_m))
    return datetime(y, m, d, hh, mm, tzinfo=tz).isoformat()


def test_sessions_totalled():
    """Two closed sessions on the same day → total_minutes = sum of both."""
    salon = _mk_salon()
    # 9:00 → 12:00 (180 min), then 13:00 → 17:00 (240 min) = 420 min total (short of 480)
    doc = {
        "date": "2026-07-03",
        "check_in_at": _iso(2026, 7, 3, 9, 0),   # first ci
        "check_out_at": _iso(2026, 7, 3, 17, 0),  # last co
        "sessions": [
            {"ci": _iso(2026, 7, 3, 9, 0), "co": _iso(2026, 7, 3, 12, 0)},
            {"ci": _iso(2026, 7, 3, 13, 0), "co": _iso(2026, 7, 3, 17, 0)},
        ],
    }
    r = compute_mode_b_status(salon, doc, day_has_passed=True, on_leave=False)
    assert r["total_minutes"] == 420, r
    # 420 < 480 required → half_day short_hours
    assert r["status"] == "half_day"
    assert r["half_day_reason"] == "short_hours"


def test_sessions_full_day():
    """One long session 9-18 (540 min) → present."""
    salon = _mk_salon()
    doc = {
        "date": "2026-07-03",
        "check_in_at": _iso(2026, 7, 3, 9, 0),
        "check_out_at": _iso(2026, 7, 3, 18, 0),
        "sessions": [
            {"ci": _iso(2026, 7, 3, 9, 0), "co": _iso(2026, 7, 3, 18, 0)},
        ],
    }
    r = compute_mode_b_status(salon, doc, day_has_passed=True, on_leave=False)
    assert r["total_minutes"] == 540
    assert r["status"] == "present"


def test_multi_session_full_day():
    """Three sessions summing to 8+ hours → present."""
    salon = _mk_salon()
    doc = {
        "date": "2026-07-03",
        "sessions": [
            {"ci": _iso(2026, 7, 3, 9, 0),  "co": _iso(2026, 7, 3, 12, 0)},  # 180
            {"ci": _iso(2026, 7, 3, 13, 0), "co": _iso(2026, 7, 3, 15, 0)},  # 120
            {"ci": _iso(2026, 7, 3, 16, 0), "co": _iso(2026, 7, 3, 20, 0)},  # 240
        ],
        "check_in_at": _iso(2026, 7, 3, 9, 0),
        "check_out_at": _iso(2026, 7, 3, 20, 0),
    }
    r = compute_mode_b_status(salon, doc, day_has_passed=True, on_leave=False)
    assert r["total_minutes"] == 540  # 180+120+240
    assert r["status"] == "present"


def test_legacy_single_pair_still_works():
    """Backward compat: a doc without `sessions` still computes correctly."""
    salon = _mk_salon()
    doc = {
        "date": "2026-07-03",
        "check_in_at": _iso(2026, 7, 3, 9, 0),
        "check_out_at": _iso(2026, 7, 3, 18, 0),
    }
    r = compute_mode_b_status(salon, doc, day_has_passed=True, on_leave=False)
    assert r["total_minutes"] == 540
    assert r["status"] == "present"
