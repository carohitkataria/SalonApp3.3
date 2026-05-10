# SalonHub — Luxury Redesign

## Phase 1 Delivered (this iteration) — Visual reskin only, no IA changes

### Palette
**Light (cream / editorial)**
- Background: `#F7F2E8` (cream)
- Card: `#FFFCF7` (ivory white)
- Primary (brass): `#A88438`
- Bronze accent: `#8E5530`
- Sage (success / open): `#6E7A6A`
- Espresso text: `#1A1814`

**Dark (warm charcoal)**
- Background: `#0E0C09` (warm obsidian)
- Card: `#18150F` (warm charcoal)
- Primary (brass): `#C9A961` (warm)
- Bronze accent: `#B07849`
- Sage: `#8C9988`
- Cream text: `#F0E7D4`

### Typography
- **Display serif**: Fraunces (variable, modern luxury editorial — replaces Playfair as primary, with `playfair` aliased to Fraunces for back-compat)
- **Body sans**: Manrope (kept)
- **Numerals**: Bebas Neue (kept)
- Italic flourishes used sparingly on key words ("perfect", "Salonhub", "no fuss") for editorial luxury feel

### Pages reskinned
- `LandingPage` — full overhaul (was Google rainbow → editorial luxe)
- `UserLoginPage` — cream/dark luxury card, brass focus rings
- `SalonSelectionPage` — refined cards, pill-shaped search, view toggles, status pills
- `SalonMainPage` — luxe header, refined welcome banner, unified action + stat cards, refined live queue modal
- `CustomerLayout` — refined sidebar with eyebrow labels, lux-card glow, theme toggle in footer
- `SalonHubLogo` — minimal scissor-ribbon mark, italic "hub" wordmark
- `ThemeToggle` — circular brass-bordered tile

### Other pages (token-driven inheritance — visually consistent already)
- `HistoryPage`, `CustomerProfilePage`, `CustomerWalletPage`, `CustomerNotificationsPage`,
  `TokenDashboard`, `ServicesBrowser`, `BarberProfilePage`, `SalonRatingsPage`, salon-tabs/*
- Most semantic colors (`text-gold`, `bg-gold`, `border-gold`) automatically map to brass via Tailwind alias.
  Result: 100% of the app instantly inherits the luxury tones without per-file edits.

### Scope **NOT** touched (intentional)
- `EnhancedSalonDashboard` (admin) and admin-side components (per your instruction: P1 = customer-facing).
- Any backend / API logic.
- Internal admin sub-tabs, modals, and reports.

---

## Phase 2 Proposal — Information Architecture (awaiting your confirmation)

> All of these are **proposals only**. None of these have been implemented yet — please review and tell me which ones to proceed with.

### A. Replace floating hamburger + bell with a unified top bar
**Today:** Two floating round buttons in opposite corners (top-left hamburger, top-right bell), plus the page header below. Three layered chromes feels noisy.

**Proposed:** A single sticky top bar (height 64px) with:
- Left: hamburger + breadcrumb (Discover / The Looks Unisex Salon · Bangalore)
- Center: search (when on `/salons`) or salon address (when on `/salon/:id`)
- Right: theme toggle + bell + avatar menu
- Cleaner mobile: hamburger collapses everything else into an overflow sheet.

**Win:** ~40px vertical real estate back, less visual chrome, single source of truth for "where am I".

### B. Bottom tab bar on mobile (≤ 640px)
**Today:** Mobile users open a hamburger sheet to navigate.

**Proposed:** 4-tab bottom nav: **Discover · Bookings · Wallet · You** (replaces hamburger on mobile only; sidebar remains on desktop).

**Win:** Standard mobile-app feel; reduces taps to switch between core sections.

### C. Sidebar re-grouping (desktop)
**Today (flat list):**
> Find New Salon → [Salon: Dashboard, Book, Wallet, Services, Barbers, Shop, Gallery, About] → My History, My Profile, Help, Bug, Logout

**Proposed (3 groups):**
1. **DISCOVER**
   - Find a Salon
2. **AT THIS SALON** (`{currentSalon.name}` — collapsible)
   - Overview · Book Appointment · Live Queue · Services · Stylists · Boutique · Gallery · About
3. **YOU**
   - My Bookings (merges current "Live tracker" + "History")
   - My Wallet (was salon-scoped, becomes global/tabbed by salon)
   - My Profile
4. **Footer:** Help · Report Bug · Theme · Sign out

**Wins:**
- "Live Queue" moves up as a first-class action under the salon group (was buried under the dashboard tab).
- "My Wallet" becomes a global node with per-salon balances inside (was stuck per-salon, hard to discover).
- "My History" + active token tracker merge into one "My Bookings" with tabs (active/past).

### D. Salon detail page tabs → Sticky sub-nav
**Today:** Five tabs (`dashboard` is implied default) accessed via the hamburger menu only.

**Proposed:** A horizontal sticky sub-nav under the salon header with explicit tabs:
**Overview · Services · Stylists · Boutique · Gallery · About**
+ a pinned **"Book"** CTA on the right.

**Win:** Discoverable navigation; one less click; maps to how guests think about a salon.

### E. Rename for clarity / luxury voice
- "Barbers" → **"Stylists"** (already changed in sidebar/labels — confirm if you want this rolled across the app, including admin)
- "Shop" → **"Boutique"** (luxe)
- "Find New Salon" → **"Find a Salon"** (less utilitarian)
- "Book Appointment" → keep
- "Dashboard" → **"Overview"** (less corporate)

### F. Removed clutter (low-risk)
- "Total Token" eyebrow on active booking → keep, but rename to **"Token"** (cleaner)
- Multiple status pills on salon cards → cap at 1 (the most important one)
- Carousel arrows on salon images → keyboard / swipe only, hide visual arrows (cleaner)

---

## Confirmation needed

Please let me know which IA changes from the list above I should proceed with. Pick any combination of A · B · C · D · E · F (or "all"), or veto any.

I'll then implement the picked items in Phase 2, plus extend the luxury reskin to:
- The booking flow (`SinglePageBooking`)
- `HistoryPage`, `CustomerProfilePage`, `CustomerWalletPage`, `CustomerNotificationsPage`
- The salon-detail tab content (`SalonServicesTab`, `SalonBarbersTab`, etc.)
- Admin dashboard (further session, P3)
