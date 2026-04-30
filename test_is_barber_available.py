#!/usr/bin/env python3
from datetime import datetime, timedelta, timezone

def is_barber_available_on(barber, date_str):
    """Return True if this barber is allowed to take bookings / be visible to customers on date_str."""
    if not date_str:
        return True
    try:
        # Joining date
        doj = (barber.get("doj") or "").strip()
        if doj and date_str < doj:
            print(f"  ❌ Excluded: date {date_str} < doj {doj}")
            return False
        # Last working date
        lwd = (barber.get("last_working_date") or "").strip()
        if lwd and date_str > lwd:
            print(f"  ❌ Excluded: date {date_str} > last_working_date {lwd}")
            return False
        # Per-date leave list
        leave_dates = barber.get("leave_dates") or []
        if isinstance(leave_dates, list) and date_str in leave_dates:
            print(f"  ❌ Excluded: date {date_str} in leave_dates {leave_dates}")
            return False
        # Legacy global on_leave flag — only treat as "leave today"
        ist = timezone(timedelta(hours=5, minutes=30))
        today_ist = datetime.now(ist).strftime("%Y-%m-%d")
        if barber.get("on_leave") is True and date_str == today_ist:
            print(f"  ❌ Excluded: on_leave=True and date {date_str} == today {today_ist}")
            return False
        print(f"  ✅ Available")
        return True
    except Exception as e:
        print(f"  ⚠️ Error: {e}")
        return True

# Test data
barber_abdul = {
    "name": "Abdul",
    "is_barber": True,
    "leave_dates": ["2026-04-30"],
    "last_working_date": "2026-12-31",
    "doj": "2020-01-01"
}

today = datetime.now(timezone(timedelta(hours=5, minutes=30))).strftime("%Y-%m-%d")
print(f"Today (IST): {today}")
print(f"\nTesting Abdul on {today}:")
result = is_barber_available_on(barber_abdul, today)
print(f"Result: {result}")
