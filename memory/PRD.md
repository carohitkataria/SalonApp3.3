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
