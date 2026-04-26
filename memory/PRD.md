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
### Feb 2026 — Phase 2 of Employee Reward Plan
- ✅ New `IncentiveDashboard.js` mounted as a sub-tab inside Analytics ("Performance" / "Incentives")
- ✅ Single-row badge layout per employee (Salary / Target / Actual / Achievement / Earned) + status pill
- ✅ Bulk actions: Approve, Hold, Reset to Pending (Pay is per-row only, captures payment method)
- ✅ Pay dialog asks payment_method (cash/upi/bank); on confirm, backend auto-creates a linked expense in `financial_transactions` (category=staff_incentive, type=outflow) and stamps `linked_expense_id` on the payout
- ✅ Excel/CSV export across a date-range (start month → end month, all employees)
- ✅ Eligible-barbers dropdown verified (filters `is_barber=true`)
- ✅ Tested via testing_agent_v3_fork — backend 5/5 pytest, frontend full flow pass, no defects

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
