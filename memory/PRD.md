# Salon Operations Suite — PRD

## Original Problem Statement
A multi-tenant salon management SaaS (React + FastAPI + MongoDB). Most recent feature requests:
1. Booking dashboards: Today/Tomorrow toggle on Salon + Token dashboards.
2. Browser in-app notifications with sound.
3. Operational time → Shift timing for customers; show shift inside slot chips (mobile-friendly).
4. Loyalty program: per-tier time period (months).
5. Staff access control fixes: cache bug across logins, quick actions follow permissions, "Financials" permission via checkbox, all services visible to staff.
6. Employee Reward Plan (Incentive Module): Global/individual plans, salary-linked or manual targets, slab-based %, automatic monthly calculation, dashboard view in Analytics, payment control linked to Financials.
7. **Branch Model (BRD):** Convert single-location salons → multi-branch chains. New `salon_branches` & `staff_branch_transfers` tables, `branch_id` on every transactional collection, branch-aware queries, Branch Manager role, Add/Edit branch UI, branch dropdown in admin header, customer-side branch switching.
8. **May 2026 — Luxury Redesign (P1: customer-facing).** Rethink the look and feel of the entire customer experience. Keep all functionality intact. Reduce visual noise, embrace luxury aesthetic, both light + dark themes.

## Test Credentials
- Phone: 7503070727  •  Password: salon123
- Salon ID: b5c6b0ca-66ec-431b-8dc8-387de72fa67c
- Multi-user login: identifier=`admin`, password=`salon123` → returns JWT

## Architecture
- Backend: FastAPI (`/app/backend/server.py`) ~9.9k lines, MongoDB.
- Collections: salons, **salon_branches** (NEW), **staff_branch_transfers** (NEW, Phase 2), barbers, tokens, attendance, financial_transactions, salon_customers, invoices, salon_users, customer_memberships, wallet_transactions, salon_reward_plans, incentive_payouts, salary_records.
- Branch-aware fields: `branch_id` on tokens, barbers, attendance, financial_transactions, salon_customers, invoices, salon_users, customer_memberships, wallet_transactions, incentive_payouts, salary_records.
- Frontend: React + Tailwind + shadcn/ui at `/app/frontend/src/`. New `BranchContext`, `BranchManagement` page, `BranchSelector` header dropdown.

## Implemented (CHANGELOG)

### May 31, 2026 — Module 7: Per-Service Barber Assignment on Modify Booking ✅
- ✅ **Token schema** (additive, backward-compatible): `service_assignments[]` (per-line `{service_id, barber_id, barber_name_snapshot, service_price, discount_amount, line_total}`), `order_discount_percent`, `order_discount_amount`, `subtotal`.
- ✅ **New unified backend endpoint** `PUT /api/tokens/{token_id}/modify` (auth: `get_current_salon_user`) replaces the prior chain of `update-services` + `change-barber` + `update-amount` for the Modify dialog. Validates main barber & line barbers (rejects "any"), resolves per-line prices via `barber_services` → falls back to `service.base_price`, supports both Discount % AND Final ₹ inputs ("last-edited wins"), pro-rata discount allocation per line, recomputes incentive payouts for ALL touched barbers (current month).
- ✅ **Revenue attribution helpers**: `attribute_token_revenue_to_barbers(token)` and `attribute_token_revenue_to_services(token)` — used by incentives + reports. Legacy tokens (no assignments) credit full `total_amount` to the main `barber_id`.
- ✅ **Incentive engine** (`_get_barber_actual_sales`): now sums per-barber line shares across completed tokens in the month. Reads the OR-matched query on `barber_id` plus `service_assignments.barber_id`.
- ✅ **Reports updated to be split-aware**: `/api/analytics/barber-wise-sales` and `/api/analytics/service-wise-sales` use the new helpers. Legacy tokens still resolve correctly.
- ✅ **Frontend Modify dialog** (`EnhancedSalonDashboard.js`): 2-tab UI (Pick services / Barber assignment). Per-service barber dropdowns with live per-barber prices (testids `assignment-barber-{sid}`, `assignment-price-{sid}`, `assignment-name-{sid}`). Main-barber dropdown overwrites all line barbers; individual line edits afterward are independent. Discount % + Final ₹ inputs sync bidirectionally. "Any available" removed from this screen. Save is disabled while subtotal is 0 (defensive against data-loss).
- ✅ **Tests**: `/app/backend/tests/test_module7_modify_booking.py` — 11 passed / 1 soft-skipped. Frontend Playwright via testing_agent_v3_fork iteration 23 — 100% green (both iteration-22 UI bugs resolved).

### May 31, 2026 — Module 6: Services Menu QR + Frictionless Booking ✅
- ✅ **Removed forced-login walls** on `HomePage`, `SalonSelectionPage`, `SalonMainPage`, `ServicesBrowser`, and `SinglePageBooking`. Customers can now browse salons, pick services, and reach the booking page without an account.
- ✅ **`BookingIntentContext`** (`/app/frontend/src/contexts/BookingIntentContext.js`) — sessionStorage with 30-min TTL preserves the cart (salon, branch, services, barber, date, shift) across the sign-in detour. Hydrated on `SinglePageBooking` mount; cleared after a successful booking.
- ✅ **Inline identity capture at checkout** — when not signed in, the payment step shows a `guest-identity-card` with Name + Mobile + Gender inputs (no OTP) and a "Sign in for faster bookings" CTA. On Confirm we lazily call `/api/user/login` (creates `is_otp_verified=false` user) and then `POST /api/bookings`. The booker-for-others toggle is hidden when unauthenticated.
- ✅ **Backend tagging**: `tokens.is_otp_verified_at_booking` snapshot is set from the booker's User at booking time. History UI shows an amber `Express booking — placed without OTP verification` badge for `is_otp_verified_at_booking === false`.
- ✅ **New public route `/salon/:salonId/menu`** (`SalonMenuPage.js`) — printable services menu reached via the new QR. Grouped by category, multi-select with sticky Book Now bar, navigates to `/book/:salonId?services=…` carrying the selection.
- ✅ **New backend endpoints**:
   - `GET /api/salons/{salon_id}/menu?branch={branch_id}` — public; returns `{salon, branch, services}` in one call.
   - `GET /api/salons/{salon_id}/branches/{branch_id}/services-menu-qr?base_url=…` — returns `{qr_code (base64 PNG data URI), menu_url, branch_name}`.
- ✅ **Branch Management** — every branch card now shows both **Booking QR** and **Menu QR** buttons; same dialog with a context-aware title, description, and Download link.
- ✅ **Testing**: 9/9 backend pytest cases (`/app/backend/tests/test_services_menu_qr_module6.py`) + frontend smoke (testing_agent_v3_fork iteration 21) all green. No regressions to the existing booking-QR endpoint.

### May 31, 2026 — Module 4 (Phase 7 + 8 + cross-module gap fixes): Frontend + Payroll + Reports ✅
- ✅ **Cross-module gap fixes (backend)**:
   - `leave_records.leave_type_snapshot` (Module 2) — every leave record now captures `{code, display_name, is_paid}` at create time. `get_monthly_salary` reads `paid/unpaid_leave_days` from the snapshot, so admins editing a leave-type's `is_paid` mid-month does NOT retroactively change historical LOP.
   - `auto_close_open_checkins_job` skips locked months (salary already paid) — won't overwrite paid attendance.
   - `GET /api/salons/{salon_id}/staff-attendance/month/{month}` now returns top-level `attendance_mode` + per-barber `has_login` + `no_checkin_capability` so the UI can warn admins that Mode-B-without-login staff need manual marking.
   - **NEW endpoint** `GET /api/salons/{salon_id}/staff-attendance/report?start_date=&end_date=&branch_id=&barber_ids=&format=json|csv` — salon-wide consolidated attendance with status code per (staff × date), respects `computed_under_mode` so months spanning a mode switch read correctly. CSV download path included.
- ✅ **Frontend (Phase 7)**:
   - `staff/StaffSettingsContent.js → AttendanceRulesTab` rewritten as Module 4's source of truth: two-radio mode selector + Mode B `geo_settings` panel (radius, max check-in time, min daily minutes, auto-close, allow-admin-override toggle) + mode-history viewer (last 5). Calls `PUT /api/salons/{id}/attendance-mode`. Legacy Module 3 fields collapsed into a "details" pane.
   - `staff/StaffAttendanceReport.js` (new) — date range + branch + multi-staff filter chips + colour-coded P/H/A/L/HOL badges + CSV download via the new endpoint.
   - `Analytics.js` gained a third sub-tab **Staff Attendance** that embeds `StaffAttendanceReport`.
   - `StaffAttendanceTab.js` — salary card now surfaces `leave_breakdown` chips (per leave-type day counts) + the *"LOP deduction (X days × ₹Y/day) = ₹Z"* line and prefers `final_payable` over `total_payable`. Pay-modal also uses `final_payable`. Calendar cell shows worked-duration (e.g., "7h 45m") when `computed_under_mode='geo_checkin'`.
- ✅ **Testing**: 50/50 backend pytest green (15 + 11 + 20 + 4 new cross-module gap tests). 4/4 frontend critical flows verified by the testing agent on the public preview URL: mode selector + geo panel save, Analytics Staff Attendance sub-tab, salary card test-ids, calendar duration cell.

### May 31, 2026 — Module 4 (Phase 1 backend): Attendance Mode toggle + Payroll-with-Leave-Types + Lock-on-Paid ✅
- ✅ **New module `backend/attendance_mode.py`** (~530 LOC):
   - `PUT /api/salons/{salon_id}/attendance-mode` — toggle between `"service_completion"` (Mode A, default, preserves existing behaviour) and `"geo_checkin"` (Mode B, new). Stamps every change into `attendance_mode_history[]` with `effective_from_date = today IST`.
   - `POST /api/salons/{salon_id}/staff-attendance/check-in` — Mode B geo-fenced self/admin check-in (haversine vs branch lat/lng, fallback salon lat/lng). Beyond `check_in_radius_meters` → 409 unless `method='admin_on_behalf'` and `allow_admin_override=true`.
   - `POST /api/salons/{salon_id}/staff-attendance/check-out` — computes `total_minutes` and final status via `compute_mode_b_status` (late_checkin / short_hours / present).
   - `PUT  /api/salons/{salon_id}/staff-attendance/check-edit/{barber_id}/{date}` — admin override of check-in/out times + optional forced status.
   - Helpers: `resolve_mode_for_date`, `is_attendance_locked`, `compute_mode_b_status`, `haversine_meters`.
   - Scheduled job `auto_close_open_checkins_job` runs at 23:55 IST.
- ✅ **Salon model additive fields**: `attendance_mode`, `attendance_mode_history`, `geo_settings`. `SalonUpdate` accepts the same.
- ✅ **AttendanceRecord model additive fields**: `check_in_at/lat/lng/distance_meters/method`, `check_out_*`, `total_minutes`, `computed_under_mode`, `half_day_reason`. Both Mode A and Mode B raw data coexist on the same doc — switching modes is non-destructive.
- ✅ **`calculate_barber_attendance_for_date` refactored** to dispatch by the mode active on the date.
- ✅ **Salary refactor (`GET /staff-salary/month/{month}`)** — `working_days_in_month`, leave breakdown bucketed by `is_paid`, `lop_deduction`, `final_payable`, `attendance_mode_snapshot`. Skip recalc when `is_paid=true`.
- ✅ **Lock-on-paid** — all attendance write paths return **423** when the month's salary is paid.
- ✅ **Bug fix bonus**: `POST /staff-salary/pay/.../{month}` no longer 500s (ObjectId leak in response).

### May 31, 2026 — Module 2: Leave Tracker & Leave Settings backend verified ✅
- ✅ **`backend/leave_tracker.py`** wired into `server.py` (1040 LOC). Endpoints:
   - `GET/POST/PUT/DELETE /api/salons/{salon_id}/leave-types-config[/{id}]` — CL/SL/PL/UL auto-seeded on first GET; carry_forward and lapse rules are mutually exclusive (400); duplicate code → 409.
   - `GET /api/salons/{salon_id}/barbers/{barber_id}/leave-balance[?financial_year=]` — auto-creates one row per active leave-type; Indian FY format `YYYY-YY`.
   - `GET /api/salons/{salon_id}/barbers/{barber_id}/leave-balance/ledger` — paginated `leave_balance_movements` newest-first; filter by `leave_type_code`.
   - `POST /api/salons/{salon_id}/barbers/{barber_id}/leave-balance/adjust` — manual adjustments; respects `max_balance_cap` (clamps positive deltas) and `allow_negative_balance` (clamps negative deltas).
   - `POST/PUT/DELETE/GET /api/salons/{salon_id}/leave-records[/{id}]` — debits balance by 1 (or 0.5 for half-day), duplicate `(barber, date)` → 409, insufficient balance → 409, atomic rollback on PUT type-change if target balance insufficient, soft-cancel on DELETE, `barbers.leave_dates` kept in sync.
   - Scheduled jobs: `_leave_accrual_job_wrapper` (monthly accrual; runs 19:00 UTC daily, only acts on IST day=1), `_leave_year_end_wrapper` (FY year-end close on Apr 1 IST).
- ✅ **Bug fix during testing**: PUT `/leave-records/{id}` rollback path was passing a stale `old_balance` dict back into `_apply_balance_change`, causing the OLD type balance to be double-debited when the target type was insufficient. Fixed by capturing the post-restore balance dict and using it for the rollback call.
- ✅ **Consistency fix**: POST `/leave-types-config` mutual-exclusion now raises `HTTPException(400)` (was raising Pydantic `ValueError` → 422), matching the PUT behaviour.
- ✅ **Backend test suite**: `/app/backend/tests/test_leave_tracker_module2.py` — 20/20 pytest assertions pass against the live preview URL.

### May 31, 2026 — Module 3: Staff Settings consolidated + attendance_rules persistence ✅
- ✅ **Inline Staff Settings**: `StaffSettingsContent` (Incentives · Leave · Attendance · Holidays) now renders both at `/salon/staff/settings` and inline inside Salon Settings → Staff.
- ✅ **Backend bug fix bundle (`server.py`)**:
   - `SalonUpdate` gained `attendance_rules: Optional[Dict[str, Any]]`.
   - `Salon` response model gained `attendance_rules` so `GET /api/salons/{id}` echoes it.
   - `PUT /api/salons/{salon_id}` migrated from legacy `get_current_salon` to `get_current_salon_admin` (so the multi-user `salon_admin` JWT works); adds `salon_id` ownership check (403 on mismatch).
   - Added `@api_router.patch("/salons/{salon_id}")` alias on the same handler so the frontend's `axios.patch` call from `StaffSettingsContent.js → AttendanceRulesTab.save` succeeds.

### May 30, 2026 — Module 3: Staff Settings consolidated inline in Salon Settings ✅
- ✅ **Reusable `StaffSettingsContent`** at `/app/frontend/src/components/staff/StaffSettingsContent.js` — renders the four sub-tabs (Incentive Rules, Leave Configuration, Attendance Rules, Holiday Calendar stub). Accepts `useUrlTab` prop so it can run with `?tab=…` URL sync (standalone page) or with local state (inline embed).
- ✅ **`StaffSettingsPage`** refactored to a thin wrapper around `StaffSettingsContent`. `/salon/staff/settings` URL still works and now uses URL-synced sub-tabs.
- ✅ **Salon Settings → Staff** tab in `EnhancedSalonDashboard.js` now renders `StaffSettingsContent` inline (no more "Open in another page" placeholder). Same UI is reachable both inline and via the direct URL.
- ✅ **Hyperlink button at Staff section** (dashboard left-menu → Staff) — converted the bordered button to a gold text-hyperlink ("Open Staff Settings →") that navigates to `/salon/staff/settings`.
- ✅ Leave-types defaults (CL/SL/PL/UL) verified end-to-end via Playwright login → Settings → Staff → Leave Configuration.


### May 2026 — Phase 1: Luxury Redesign (Customer-facing) ✅
- ✅ **Token foundations rewritten** in `frontend/src/index.css` — both light (cream/ivory) and dark (warm charcoal) modes, with brass/champagne primary, bronze accent, sage success, espresso text. All shadcn semantic tokens remapped. New utilities: `.eyebrow`, `.eyebrow-brass`, `.serif-display`, `.serif-italic`, `.lux-card`, `.brass-glow-pulse`, `.brass-text`, `.hero-wash`, `.glass-warm`, `.bg-grain`, `.pill-open/closed/amber/brass/bronze`.
- ✅ **Tailwind config extended** with `brass`, `champagne`, `bronze`, `sage`, `ivory`, `cream`, `espresso`, `taupe` color tokens. `gold` aliased to brass for back-compat (every existing `text-gold`, `bg-gold` instance now renders brass automatically across all 60+ files without per-file edits).
- ✅ **Typography swapped**: Fraunces (variable luxury serif, replaces Playfair as display) + Manrope (body, kept) + Bebas Neue (numerals, kept). Italic flourishes used sparingly on key words.
- ✅ **Pages reskinned end-to-end**: `LandingPage` (full overhaul, was Google rainbow), `UserLoginPage`, `SalonSelectionPage` (cards, search, view toggles, map markers), `SalonMainPage` (welcome banner, action cards, stat cards, live queue modal, status icons), `CustomerLayout` (sidebar with eyebrow labels & footer theme toggle), `SalonHubLogo` (refined scissor-ribbon mark), `ThemeToggle` (luxe brass tile).
- ✅ **Functionality preserved**: Login → Salons → Salon detail → Sidebar nav → Theme toggle → Mobile responsive — all flows verified working via screenshots.
- ✅ **No backend changes**.
- 📄 **IA proposal** documented in `/app/memory/REDESIGN_NOTES.md` — 6 IA enhancements (top bar, mobile bottom-tabs, sidebar grouping, sticky tab nav, renaming, declutter) **awaiting user confirmation** before implementation.

### May 2026 — Phase 2: Multi-theme + Salon home overhaul ✅
- ✅ **Multi-theme system** — `ThemeContext` rewritten to support 5 named themes via `data-theme` attribute on `<html>`:
   • **Ivory** (light, pure white + brass) — replaces ad-hoc cream as the original light theme
   • **Obsidian** (dark, warm charcoal + brass) — original dark theme preserved
   • **Velvet Royal** (dark, deep purple `#5C2B84` + electric gold `#FFC000`)
   • **Midnight** (dark, deep navy + champagne)
   • **Sand** (light, warm beige + terracotta)
   All themes wired through CSS variables (`--brass-rgb`, `--bronze-rgb`, `--sage-rgb`, etc.) so Tailwind classes (`text-brass`, `bg-brass-soft`, `pill-brass`, `lux-card`, `brass-text`, `hero-wash`) adapt automatically. Synchronous theme apply on module load avoids first-paint flash. Legacy `salon_theme` localStorage key migrated → `salon_theme_id`.
- ✅ **`ThemePicker`** component — dropdown with named swatches (compact sidebar tile + label-pill variants). Opens up/down based on available space. Lives in CustomerLayout sidebar footer + landing-page header + login-page corner. Replaces old `ThemeToggle` (kept as legacy compatibility shim).
- ✅ **Salon home page redesigned** as a single scrollable narrative (luzo.app-inspired), `SalonMainPage.renderDashboard`:
   1. **Sticky top strip** (z-30): branch dropdown (with branch switching that updates `?branch=` in URL) + Book / Live Queue / Wallet (with live ₹ balance) actions. Replaces old separate header + action cards row.
   2. **Hero gallery** (1 large + 2 thumb tiles, "View all photos" CTA → gallery tab).
   3. **Salon identity** (gender tag eyebrow, name in Fraunces serif, branch sub-title, OPEN/CLOSED pill computed from `operational_hours` + `manual_toggle`, today's hours, rating chip).
   4. **Services section** — fetches from `/api/salons/:id/services/enabled`, top 8 in a grid w/ image+name+price+duration, "View all" jumps to services tab.
   5. **Stylists section** — fetches from `/api/salons/:id/barbers`, all stylists as horizontal chips with avatar + rating.
   6. **About section** — Address card (with phone + Get Directions) + Operational Hours card (today highlighted in brass).
   7. **Reviews section** — fetches from `/api/salons/:id/ratings?limit=10`, auto-scrolling marquee carousel of reviews with text content (paused on hover, click to view all).
- ✅ **Branch dropdown** in sticky strip — fetches `/api/public/salons/:id/branches`, lists all branches, syncs `?branch=` URL param on switch (deep-linkable).
- ✅ **No backend changes** — all uses pre-existing endpoints. All `data-testid`s preserved + new ones added (`branch-dropdown-btn`, `branch-option-{id}`, `strip-book-btn`, `strip-queue-btn`, `strip-wallet-btn`, `theme-picker-btn`, `theme-option-{id}`, `service-tile-{id}`, `stylist-chip-{id}`, `reviews-marquee`, etc.).

### Phase 3 — Pending (awaiting user direction)
- IA enhancements from `/app/memory/REDESIGN_NOTES.md` (6 proposals — pending confirmation).
- Reskin remaining customer pages (`SinglePageBooking`, `HistoryPage`, `CustomerProfilePage`, `CustomerWalletPage`, etc.) with the same theme tokens (already inherit basic palette, but need component-level polish).
- Admin dashboard reskin.


### Feb 2026 — Phase 2: Branch Manager Role + Staff Transfers (Iteration 12) ✅
- ✅ **New role `branch_manager`** in `salon_users`. Coexists with `admin` & `staff`. Multi-branch support via `assigned_branch_ids: List[str]`. SalonUser validation: a branch_manager **must** have at least one assigned branch (400 otherwise) and every branch id must belong to the same salon.
- ✅ **JWT now carries `assigned_branch_ids`**. `SalonUserToken` exposes them so the frontend can scope before any API call.
- ✅ **Mobile-number login** alongside `login_id` — `POST /api/salon/users/login`'s `identifier` field already accepted both; verified end-to-end with `+91…` formatted numbers in tests.
- ✅ **PUT `/api/salon/users/{user_id}`** now also updates `role` and `assigned_branch_ids`, validates branch ownership, and **returns the updated user document** so the frontend can re-render immediately.
- ✅ **Server-side RBAC helpers** (`is_branch_manager`, `assigned_branch_ids_for`, `enforce_branch_for_manager`). Behaviour for branch-manager calls:
  - No `branch_id` query param → auto-scope to `assigned_branch_ids[0]`.
  - Explicit `branch_id` not in their list → 403.
  - Empty `assigned_branch_ids` → 403 on data endpoints.
- ✅ **Scoped endpoints**: `GET /branches`, `GET /queue`, `GET /barbers/{id}/queue`, `GET /barbers` (admin view only), `GET /today-sales`, `GET /financials/transactions`, `GET /financials/dashboard`, `GET /customers`. Customer-view of barbers stays open (public booking).
- ✅ **Staff Branch Transfer API**:
  - `POST /api/salons/{salon_id}/staff-branch-transfers` — admin can transfer any staff between any active branches; branch_manager can only transfer when **both** `from_branch_id` and `to_branch_id` are in their assigned list; staff role → 403; same-branch → 400. Inserts a `staff_branch_transfers` row + updates `barbers.branch_id` immediately.
  - `GET /api/salons/{salon_id}/staff-branch-transfers?staff_id=…&branch_id=…` returns history. Branch_manager auto-scoped to transfers touching their assigned branches.
- ✅ **Frontend `AuthContext`** exposes `isBranchManager()`, `getAssignedBranchIds()`, persists `assignedBranchIds` in localStorage.
- ✅ **Frontend StaffAccessManagement** (`Salon Users` page) gains a **Role dropdown** (Staff / Branch Manager / Admin) and a multi-select **Assigned Branches** panel that appears for branch_manager. The user list shows a purple "Branch Manager" badge + the names of their branches.
- ✅ **Frontend BarberManagement** (`Staff Management`):
  - Each staff card now shows a **📍 branch pill** ("Main Branch" / "Whitefield Branch" etc.).
  - When ≥ 2 branches exist and the current user is admin or branch_manager, an **arrow icon "Transfer"** opens a dialog with target-branch dropdown, transfer-date picker and remarks. On submit it calls the new transfer API and refreshes the list.
- ✅ **Frontend BranchManagement** (`Branches` admin page) is **read-only** for branch_manager: Add disabled, Set-Main / Deactivate / Edit hidden; QR generation stays available.
- ✅ **Frontend dashboard left-menu**: branch_manager sees Home, Token Queue, Staff Management, Services, Financials, Customer Master, Analytics, Gallery, Branches. Salon Settings stays admin-only.
- ✅ **HTTPException leak fix**: the `try/except` wrapping `GET /barbers` was swallowing 403 RBAC errors and returning 500. Now re-raises HTTPException correctly.
- ✅ **Tests**: 36/36 backend pytest assertions pass — `tests/test_branches_phase1.py` (5) + `test_branches_phase1_extra.py` (12) + `test_branches_phase2.py` (9) + `test_branches_phase2_extra.py` (10). Frontend smoke verified end-to-end via Playwright (admin transferred Imran Main → Whitefield with success toast; BM login showed scoped header dropdown listing only Whitefield).

### Feb 2026 — Phase 1: Branch Model Foundation (Iteration 11) ✅
- ✅ **New collections**: `salon_branches`, `staff_branch_transfers`. Models: `Branch{Create,Update}`, `StaffBranchTransfer{Create}`.
- ✅ **Migration on startup** (`migrate_branches`): for every existing salon → auto-create one "Main Branch" (`is_main_branch=true`, code "MAIN") inheriting salon address/coords/phone. Idempotent. Back-fills `branch_id` on every existing doc in 11 collections (tokens, barbers, attendance, financial_transactions, salon_customers, invoices, salon_users, customer_memberships, wallet_transactions, incentive_payouts, salary_records). Successfully back-filled 3 legacy docs in dev seed.
- ✅ **Branch CRUD endpoints** (admin-only, salon-scoped):
  - `GET /api/salons/{salon_id}/branches?include_inactive=false`
  - `POST /api/salons/{salon_id}/branches`
  - `GET /api/salons/{salon_id}/branches/{branch_id}`
  - `PUT /api/salons/{salon_id}/branches/{branch_id}`
  - `DELETE /api/salons/{salon_id}/branches/{branch_id}` — soft-delete (status=inactive). Cannot delete the main branch. Cannot deactivate a branch with active future tokens (400).
  - `POST /api/salons/{salon_id}/branches/{branch_id}/set-main` — promotes & demotes the previous main atomically.
  - `GET /api/salons/{salon_id}/branches/{branch_id}/qr-code?base_url=...` — public, returns base64 PNG embedding `/salon/{salon_id}?branch={branch_id}`.
- ✅ **Branch-aware filters** (all backwards-compatible — omitting `branch_id` returns cross-branch data so legacy clients keep working):
  - `GET /api/salons/{salon_id}/queue?branch_id=...`
  - `GET /api/salons/{salon_id}/barbers/{barber_id}/queue?branch_id=...`
  - `GET /api/salons/{salon_id}/barbers?branch_id=...`
  - `GET /api/salons/{salon_id}/today-sales?branch_id=...`
  - `GET /api/salons/{salon_id}/financials/transactions?branch_id=...`
  - `GET /api/salons/{salon_id}/financials/dashboard?branch_id=...`
  - `GET /api/salons/{salon_id}/customers?branch_id=...`
- ✅ **Auto branch_id stamping** on creation: `POST /api/bookings`, `POST /api/salons/{id}/salon-booking`, `POST /api/salons/{id}/barbers`, `POST /api/salons/{id}/customers`, `POST /api/salons/{id}/financials/transactions`. Resolution order: explicit body field → barber's branch → salon's main branch.
- ✅ **Per-token financial logging** also stamps `branch_id` so revenue analytics stay branch-aware.
- ✅ **Frontend**:
  - New `BranchContext` (auto-loads branches on salon-user login, persists selected branch in localStorage, fires `branch-changed` events).
  - `<BranchSelector />` dropdown in admin header (shows current branch, star for main, click-to-switch).
  - New "Branches" admin tab (admin-only, hidden for staff): list cards (Main badge, Inactive pill, address/phone/email), Add/Edit dialog (name, code, address, city, lat/long, phone, email, "Set as Main" toggle), per-branch QR dialog with download, "Set Main" / "Deactivate" actions.
  - Dashboard `fetchBarbers`/`fetchTokens`/`fetchDailySales` re-fetch on branch change with `branch_id` query param. Manual booking sends `branch_id`.
  - Branch code uniqueness enforced server-side per salon (case-insensitive 400 on duplicate).
  - `resolve_branch_id` only ever returns ACTIVE branches → an inactive branch can never become a silent default.
- ✅ **Tested**: 17/17 backend pytest assertions pass (`tests/test_branches_phase1.py` + `tests/test_branches_phase1_extra.py`). Frontend smoke verified end-to-end via Playwright (login → header dropdown → Branches admin → Add/Edit/QR → switch branch refreshes dashboard).
- ✅ **Backwards compatibility**: every existing legacy endpoint still works without `branch_id` and returns cross-branch data — zero breaking changes.

### Feb 2026 — Phase 2 WhatsApp flows + Customer auto-refresh (Iteration 10)
- ✅ **Item 7 — WhatsApp Cancel confirmation page**: `GET /api/tokens/{id}/cancel-link` now renders an "Are you sure?" HTML interstitial with cancel/keep buttons. Wallet refunds preserved; salon + customer in-app notifications still fire.
- ✅ **Item 8 — WhatsApp Reschedule link**: `GET /api/tokens/{id}/public-details` (unauth) + `PUT /api/tokens/{id}/customer-reschedule`. Frontend `SinglePageBooking.js` handles `?modify=<tokenId>`.
- ✅ **Total recompute logic**: reschedule only recomputes `total_amount` when `selected_services` or `barber_id` actually change.
- ✅ **Item 6 — Customer auto-refresh**: `useAutoRefresh` hook on `WalletDisplay` (20s), `ActiveBookingTracker` (15s), `HistoryPage` (20s); pauses while tab hidden.
- ✅ **Item 1 — Salon auto-refresh**: optimistic UI on token actions + 20s polling fallback.
- ✅ Backend tested 14/14; no regressions.

### Feb 2026 — Booking capacity + Incentive correctness fixes (Iteration 9)
- ✅ **Capacity rule**: `get_barber_blocked_minutes_used` now excludes `completed`. Slot freed within same shift on completion.
- ✅ **Actual sales bug**: `_get_barber_actual_sales` now uses `$or` on `date` / `booking_date` / `created_at`.
- ✅ **Slab over-achievement**: When achievement % exceeds the highest defined slab's `to_pct`, the highest **crossed** slab still applies.

### Feb 2026 — Phase 2 of Employee Reward Plan + Manual Adjustment
- ✅ `IncentiveDashboard.js` mounted as a sub-tab inside Analytics ("Performance" / "Incentives").
- ✅ Single-row badge layout per employee + status pill, bulk actions, manual amount adjustment.
- ✅ Strict Financials sync rule: row created **only on Paid**, idempotent.
- ✅ Excel/CSV export across a date range.

### Earlier this session
- Today/Tomorrow toggles, Browser notifications + sound, Shift timing chips, Loyalty per-tier time period, Staff access control hardening, Employee Reward Plan Phase 1.

## Roadmap (P0/P1/P2)

### P0 — Phase 3: Customer UX
- Customer booking flow submits `branch_id` (default to nearest active branch by lat/long, fall back to main).
- "Switch Branch" dropdown on `/salon/:salonId` page so customers can navigate between branches of the same brand.
- Per-branch operational hours + holidays (currently shared at salon level).

### P1
- Reverse-sync incentives (Paid → Approved should offer to reverse-credit the linked financial txn).
- BM dashboard "All My Branches" rollup card.
- Email/SMS notification when a staff is transferred.

### P2
- Modularize `server.py` (split into routes/, models/, services/) — over 10k lines now.
- Per-branch loyalty rules (chain-wide vs branch-specific) — sold at one branch, valid at all.
- Per-branch reports / analytics rollups.
- Code review backlog from Iteration 11:
  - `update_branch` PUT should accept explicit `is_main_branch=false` (currently only `set-main` POST can demote).
  - QR endpoint rate-limiting.

## Key API Endpoints (Branch Module)
- `GET    /api/salons/{salon_id}/branches[?include_inactive=true]`
- `POST   /api/salons/{salon_id}/branches`
- `GET    /api/salons/{salon_id}/branches/{branch_id}`
- `PUT    /api/salons/{salon_id}/branches/{branch_id}`
- `DELETE /api/salons/{salon_id}/branches/{branch_id}` (soft delete)
- `POST   /api/salons/{salon_id}/branches/{branch_id}/set-main`
- `GET    /api/salons/{salon_id}/branches/{branch_id}/qr-code[?base_url=...]` (public)
- `POST   /api/salons/{salon_id}/staff-branch-transfers` (Phase 2)
- `GET    /api/salons/{salon_id}/staff-branch-transfers[?staff_id=&branch_id=]` (Phase 2)
- All listed legacy endpoints accept optional `branch_id` query param.

## Known Notes
- Reward Plan Phase 2 testing seeded one completed token (`_seed_test=true`, ₹1,20,000) for barber Imran. Cleanup: `db.tokens.delete_many({_seed_test: true})` if needed.
- After Phase 1, every salon has at least one `salon_branches` doc (auto-created on startup). Idempotent: rerunning the migration is safe.
- Frontend admin Branches page is reachable via Hamburger menu → Branches (no direct URL).

---

## Phase 8 & 9 — Supplier Marketplace (May 2026) ✅

### Backend (✅ 45/45 tests passed in earlier iteration)
- `supplier_auth.py`: signup, OTP & password login, JWT (separate from salon admin), `/api/supplier/me` profile gate (returns 403 with `code=supplier_not_active` for pending/rejected/suspended).
- `supplier_products.py`: dashboard stats (KPIs), full product CRUD, restock, **soft-delete via `is_deleted` flag (NOT `is_active`)** — deleted items hidden from all supplier-facing reads. Product samples list & "create from sample" endpoints.
- `platform_admin_management.py`: supplier approval/rejection wiring with WhatsApp notification on approve.
- **Permanent 30+ product seed** at `/app/backend/data/product_samples_seed.py` — 31 samples across haircare (7), tools (7), consumables (5), skincare (5), beard (3), equipment (4). Seeded on every startup, idempotent upsert by `id`. **Images are stable Unsplash CDN URLs** — independent of database state.

### Frontend (✅ 9/10 + delete-bug fix verified end-to-end)
- `SupplierAuthContext` (separate JWT in localStorage `salonhub_supplier_token`).
- `/supplier/login` (Password + OTP tabs), `/supplier/signup` (5-step), `/supplier/pending` (status-gated message), `/supplier/dashboard` (4 KPI cards + category chart), `/supplier/products` (catalog + samples tabs, CRUD modals, restock, delete).
- "Become a Supplier" link added to landing-page Footer (Company column).
- All critical elements have `data-testid` attributes for stable e2e.

### Key API Endpoints (Phase 8/9)
- `POST /api/supplier/signup`
- `POST /api/supplier/auth/request-otp`, `POST /api/supplier/auth/verify-otp`, `POST /api/supplier/auth/password-login`
- `GET  /api/supplier/me`
- `GET  /api/supplier/dashboard/stats`
- `GET/POST/PUT/DELETE /api/supplier/products[/:id]`
- `POST /api/supplier/products/:id/restock`
- `GET  /api/supplier/product-samples`
- `POST /api/supplier/products/from-sample/:sample_id`
- `POST /api/platform/suppliers/:id/approve`
- `POST /api/platform/suppliers/:id/reject`

### Known follow-ups (P2 — Phase 10+)
- Marketplace browse for salons (B2B catalog discovery).
- Cart, Checkout, Orders, Inventory sync between supplier `supplier_products` and salon inventory.
- Modularize `server.py` (now 12.4k lines) — split into `routes/`, `models/`, `services/`.
- Split `SupplierProductsPage.js` (605 lines) into ProductCatalog / ProductSamples / EditorModal / RestockModal / DeleteModal sub-components.
- Optional: add `loggingOut` sentinel to SupplierAuthContext to eliminate the brief `/supplier/login` flash before `window.location.replace('/')` on logout (cosmetic, not user-visible).
