/**
 * HomeV2Shell.js — reusable Zenoti-style shell (rail + ribbon + topbar).
 *
 * Wraps ANY tab content so all salon dashboard pages share the same left rail,
 * right ribbon and sticky topbar as the Home page. This delivers pending-list
 * item #2 (extend the rail+ribbon shell to Queue, Staff, Services, Finance,
 * Guests, Analytics, Shop, Stock, Marketing, Settings).
 *
 * Usage:
 *   <HomeV2Shell
 *     salon={salon}
 *     salonId={salonId}
 *     getAuthHeaders={getAuthHeaders}
 *     activeTab="queue"            // for rail highlight
 *     onSaved={() => refetch()}    // called after appointment/guest saved
 *   >
 *     <YourTabContent />
 *   </HomeV2Shell>
 *
 * Notes:
 *   • CSS is scoped under `.shv2`. Legacy tab content still renders (this
 *     shell only frames the page). Tab-content re-skinning is a separate
 *     task.
 *   • The New Appointment and Add Guest drawers live inside the shell so
 *     they work on every page — a global CTA the user can hit from anywhere.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { HOME_V2_CSS } from './styles';
import AppointmentDrawer from './AppointmentDrawer';
import CustomerDrawer from './CustomerDrawer';

// ---- Rail items — copies of existing hamburger menu (kept in sync with SalonHomeV2) ----
export const RAIL_ITEMS = [
  { id: 'home',       label: 'Home',      route: '/salon/dashboard?tab=home' },
  { id: 'queue',      label: 'Queue',     route: '/salon/dashboard?tab=queue' },
  { id: 'staff',      label: 'Staff',     route: '/salon/dashboard?tab=staff' },
  { id: 'services',   label: 'Services',  route: '/salon/dashboard?tab=services' },
  { id: 'financials', label: 'Finance',   route: '/salon/dashboard?tab=financials' },
  { id: 'customer-master', label: 'Guests', route: '/salon/dashboard?tab=customer-master' },
  { id: 'analytics',  label: 'Analytics', route: '/salon/dashboard?tab=analytics' },
  { id: 'marketplace',label: 'Shop',      route: '/salon/marketplace' },
  { id: 'inventory',  label: 'Stock',     route: '/salon/dashboard?tab=inventory' },
  { id: 'marketing',  label: 'Marketing', route: '/salon/dashboard?tab=marketing' },
  { id: 'salon',      label: 'Settings',  route: '/salon/dashboard?tab=salon' },
];

// SVG icon set (matches SalonHomeV2 exactly for visual parity)
export const SHELL_ICONS = {
  home:     () => <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>,
  cal:      () => <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  users:    () => <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>,
  chat:     () => <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  chart:    () => <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  gear:     () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  plus:     () => <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  guestAdd: () => <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  cart:     () => <svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  search:   () => <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  bell:     () => <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  help:     () => <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  branch:   () => <svg viewBox="0 0 24 24"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>,
  scissors: () => <svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>,
  rupee:    () => <svg viewBox="0 0 24 24"><path d="M6 3h12M6 8h12M9 3s5 0 5 5c0 4-5 5-5 5H6l7 8"/></svg>,
  tag:      () => <svg viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  send:     () => <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  rotate:   () => <svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>,
};

// Rail icon lookup — id → icon component
const RAIL_ICON = {
  home: SHELL_ICONS.home,
  queue: SHELL_ICONS.cal,
  staff: SHELL_ICONS.users,
  services: SHELL_ICONS.scissors,
  financials: SHELL_ICONS.rupee,
  'customer-master': SHELL_ICONS.guestAdd,
  analytics: SHELL_ICONS.chart,
  marketplace: SHELL_ICONS.cart,
  inventory: SHELL_ICONS.tag,
  marketing: SHELL_ICONS.send,
  salon: SHELL_ICONS.gear,
};

export default function HomeV2Shell({
  salon,
  salonId,
  getAuthHeaders,
  activeTab = 'home',
  onSaved,          // callback fired when appointment or guest saved (parent refetches)
  showTopbar = true,
  unreadNotifCount = 0,
  onLogout,
  children,
}) {
  const navigate = useNavigate();
  const { logout } = useAuth?.() || { logout: null };

  // Global drawers, mounted once per shell — accessible from any tab.
  const [apptOpen, setApptOpen] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);

  // Inject scoped stylesheet once.
  useEffect(() => {
    const id = 'shv2-styles';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = HOME_V2_CSS;
    document.head.appendChild(el);
  }, []);

  const goRail = (item) => navigate(item.route);
  const I = SHELL_ICONS;

  return (
    <div className="shv2">
      {/* ===== RAIL ===== */}
      <aside className="rail">
        <div className="rail__logo"><I.scissors /></div>
        <nav className="rail__nav">
          {RAIL_ITEMS.map((it) => {
            const IconFn = RAIL_ICON[it.id] || I.gear;
            const on = it.id === activeTab;
            return (
              <button
                key={it.id}
                className={`navitem ${on ? 'active' : ''}`}
                onClick={() => goRail(it)}
                title={it.label}
              >
                <IconFn />
                <span>{it.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="rail__foot">
          <button
            className="navitem"
            style={{ height: 44 }}
            onClick={() => { try { onLogout?.(); logout?.(); } catch (_) {} navigate('/'); }}
            title="Logout"
          >
            <I.rotate /><span>Exit</span>
          </button>
          <div className="rail__avatar" title={salon?.salon_name}>
            {(salon?.salon_name || 'SL').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
        </div>
      </aside>

      {/* ===== RIBBON ===== */}
      <aside className="ribbon">
        <button className="ribbon__btn ribbon__cta" data-tip="New Appointment" onClick={() => setApptOpen(true)}><I.plus /></button>
        <button className="ribbon__btn" data-tip="Add Guest" onClick={() => setGuestOpen(true)}><I.guestAdd /></button>
        <button className="ribbon__btn" data-tip="Retail Sale" onClick={() => navigate('/salon/dashboard?tab=inventory')}><I.cart /></button>
        <div className="ribbon__sep" />
        <button className="ribbon__btn" data-tip="Search"><I.search /></button>
        <button className="ribbon__btn" data-tip="Messages" onClick={() => navigate('/salon/dashboard?tab=marketing')}><I.chat /></button>
        <button className="ribbon__btn" data-tip="Notifications" onClick={() => navigate('/salon/dashboard?tab=notifications')}>
          <I.bell />
          {unreadNotifCount > 0 && (
            <span className="dot">{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</span>
          )}
        </button>
        <div className="ribbon__sep" />
        <button className="ribbon__btn" data-tip="Help"><I.help /></button>
      </aside>

      {/* ===== MAIN ===== */}
      <main className="main">
        {showTopbar && (
          <header className="topbar">
            <div className="brand">
              <div className="brand__ic"><I.scissors /></div>
              <div>
                <h1>Salon Dashboard</h1>
                <p>{salon?.salon_name || 'Your Salon'}</p>
              </div>
            </div>
            <div className="topbar__spacer" />
            <div className="searchbox"><I.search /><input placeholder="Search…" /></div>
            <div className="branch"><I.branch /> {salon?.city || 'Main Branch'}</div>
          </header>
        )}

        {/* Tab content — children render here. For legacy tabs we let their
            own layout / theme paint inside; for future re-skinned tabs the
            content will match .shv2 tokens automatically. */}
        <div className="content shv2-tabhost">
          {children}
        </div>
      </main>

      {/* Global appointment + guest drawers (available on every page) */}
      <AppointmentDrawer
        open={apptOpen}
        onClose={() => setApptOpen(false)}
        onSaved={() => { setApptOpen(false); onSaved?.(); toast.success('Appointment saved'); }}
        getAuthHeaders={getAuthHeaders}
        salonId={salonId}
        defaultMode="queue"
      />
      <CustomerDrawer
        open={guestOpen}
        onClose={() => setGuestOpen(false)}
        onSaved={() => { setGuestOpen(false); onSaved?.(); toast.success('Guest saved'); }}
        getAuthHeaders={getAuthHeaders}
        salonId={salonId}
      />
    </div>
  );
}
