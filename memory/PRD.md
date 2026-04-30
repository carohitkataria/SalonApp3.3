# Salon Operations Suite — PRD

## Original Problem Statement
A multi-tenant salon management SaaS (React + FastAPI + MongoDB). Most recent feature requests:
1. Booking dashboards: Today/Tomorrow toggle on Salon + Token dashboards.
2. Browser in-app notifications with sound.
3. Operational time → Shift timing for customers; show shift inside slot chips (mobile-friendly).
4. Loyalty program: per-tier time period (months).
5. Staff access control fixes: cache bug across logins, quick actions follow permissions, "Financials" permission via checkbox, all services visible to staff.
6. Employee Reward Plan (Incentive Module): Global/individual plans, salary-linked or manual targets, slab-based %, automatic monthly calculation, dashboard view in Analytics, payment control linked to Financials.

## Test Credentials
- Phone: 7503070727  •  Password: salon123
- Salon ID: 2dad5cd9-5dda-4398-bbb5-a4d12aae7915

## Architecture
- Backend: FastAPI (`/app/backend/server.py`) ~7600 lines, MongoDB (collections: salons, barbers, tokens, salon_reward_plans, incentive_payouts, financial_transactions, etc.)
- Frontend: React + Tailwind + shadcn/ui at `/app/frontend/src/`

## Implemented (CHANGELOG)
### Feb 2026 — Phase 2 WhatsApp flows + Customer auto-refresh (Iteration 10)
- ✅ **Item 7 — WhatsApp Cancel confirmation page**: `GET /api/tokens/{id}/cancel-link` now renders an "Are you sure?" HTML interstitial showing salon, token #, customer, date, shift, service count, amount, with "No, Keep Booking" + "Yes, Cancel" buttons. The actual cancel happens on `POST /api/tokens/{id}/cancel-link` (submitted via form from the interstitial). Wallet refunds preserved; salon + customer in-app notifications still fire.
- ✅ **Item 8 — WhatsApp Reschedule link**: new `GET /api/tokens/{id}/public-details` (unauth) returns booking details for hydration; new `PUT /api/tokens/{id}/customer-reschedule` updates the SAME token (services/barber/date/shift/payment). Frontend `SinglePageBooking.js` handles `?modify=<tokenId>` — shows a gold "Modifying booking #N" banner (`data-testid="reschedule-banner"`), preloads all fields, submits via PUT instead of POST /bookings.
- ✅ **Total recompute logic (correctness)**: reschedule only recomputes `total_amount` when `selected_services` or `barber_id` actually change (pure shift/date edits keep the existing price). Falls back to sum of `base_price` when barber=any.
- ✅ **Item 6 — Customer auto-refresh**: `useAutoRefresh` hook consumed by `WalletDisplay` (20s), `ActiveBookingTracker` (15s), `HistoryPage` (20s); pauses while tab hidden, re-runs immediately on visibility. Customer session in `AuthContext` uses `localStorage.salon_user` with NO expiry → infinite auto-login until explicit logout.
- ✅ **Item 1 — Salon auto-refresh**: optimistic UI on token actions + 20s polling fallback in `EnhancedSalonDashboard` (carried over from Phase 1.5).
- ✅ Backend tested 14/14 via testing agent; no regressions.

### Feb 2026 — Booking capacity + Incentive correctness fixes (Iteration 9)
- ✅ **Capacity rule**: `get_barber_blocked_minutes_used` now excludes `completed` (in addition to `cancelled` / `skipped`). When Imran finishes a booking, the slot is freed within the same shift — he can take another booking immediately if duration permits.
- ✅ **Actual sales bug**: `_get_barber_actual_sales` was matching on `booking_date`, but tokens are stored with `date`. Fixed via `$or` on `date` / `booking_date` / `created_at` fallback. Imran's 4 real tokens now sum correctly to ₹63,360.
- ✅ **Slab over-achievement**: When achievement % exceeds the highest defined slab's `to_pct`, the highest **crossed** slab still applies (no penalty for over-performance). Imran at 168.96% now earns 30% of ₹63,360 = ₹19,008 via the 120-150% slab.
- ✅ Token complete handler picks up `date` first (with `booking_date` legacy fallback) when triggering incentive recompute.

### Feb 2026 — Phase 2 of Employee Reward Plan + Manual Adjustment
- ✅ New `IncentiveDashboard.js` mounted as a sub-tab inside Analytics ("Performance" / "Incentives")
- ✅ Single-row badge layout per employee (Salary / Target / Actual / Achievement / Earned) + status pill
- ✅ Bulk actions: Approve, Hold, Reset to Pending (Pay is per-row only, captures payment method)
- ✅ **Approve dialog**: admin can manually adjust the incentive amount (with "Use Auto" reset), persisted as `manual_amount` on the payout
- ✅ **Pay dialog**: pre-fills with effective amount (manual override or auto), admin can further edit
- ✅ **Strict Financials sync rule**: a `financial_transactions` row is created **only on Paid**, **never on Approve**, and is **fully idempotent** even if `linked_expense_id` is lost (looks up by reference_id + reference_type). Effective amount = `manual_amount` if set else `incentive_earned`.
- ✅ Excel/CSV export across a date-range (Auto Incentive, Adjusted Incentive, Effective Payout columns)
- ✅ Eligible-barbers dropdown verified (filters `is_barber=true`)
- ✅ Full e2e tested via testing_agent_v3_fork — backend 10/10 pytest, frontend full flow pass
- ✅ Cleaned up stale test seed (₹1.2L token) and 2 orphan ₹1000 financial transactions that were causing the user's reported 480% achievement / earned=0 bug

### Earlier this session
- Today/Tomorrow toggles (Salon + Token dashboards)
- Browser notifications + sound (`utils/browserNotifications.js`)
- Shift timing chips on customer booking
- Loyalty per-tier time period
- Staff access control hardening (cache reset on login/logout, quick-actions permission gating, `can_access_financials` checkbox, fixed Analytics access)
- Employee Reward Plan Phase 1: backend models, calculation engine (slab types: additional_pct / total_pct / fixed_amount), APIs, auto recompute on token completion, Setup UI in Staff Management

## Roadmap (P0/P1/P2)
### P1
- Reverse-sync: when an admin moves an incentive away from "Paid", offer to remove or reverse-credit the linked financial transaction
- Parallelize bulk status updates (Promise.allSettled with concurrency cap) for large salons

### P2
- Modularize `server.py` (split into routes/, models/, services/) — over 7500 lines
- Add aria-labels to bulk-select-all checkbox + per-row checkboxes for a11y
- Hide Approve/Hold buttons after Paid (cleaner UX)

## Key API Endpoints (Incentive Module)
- `GET    /api/salons/{salon_id}/reward-plan`
- `POST   /api/salons/{salon_id}/reward-plan`
- `GET    /api/salons/{salon_id}/reward-plan/eligible-barbers`
- `GET    /api/salons/{salon_id}/reward-plan/incentives?month=YYYY-MM[&barber_id=X]`
- `PUT    /api/salons/{salon_id}/reward-plan/incentives/{barber_id}/{month}/status`
   - body: `{ status: Pending|Approved|Paid|Hold, payment_method?: cash|upi|bank, notes?: string }`
   - status=Paid auto-inserts financial_transactions row + sets `linked_expense_id`

## Known Notes
- Reward Plan Phase 2 testing seeded one completed token (`_seed_test=true`, ₹1,20,000) for barber Imran (id 5d7d3064-2580-4a43-ae3e-73cdcaefd9de) to validate flow. Cleanup: `db.tokens.delete_many({_seed_test: true})` if needed.
