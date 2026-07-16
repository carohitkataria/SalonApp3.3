/**
 * SalonSettingsV3.js — Redesigned Settings page (gold theme).
 *
 * Layout: two-pane workspace. Left = accordion section-nav (7 groups × sub-subs).
 * Right = per-section content pane. Wraps existing settings components so the
 * backend surface is unchanged; adds RBAC gating on every sub-section.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SETTINGS_V3_CSS } from './SettingsV3Styles';
import MyProfile from '@/components/MyProfile';
import BranchManagement from '@/components/BranchManagement';
import OperationalHoursModule from '@/components/OperationalHoursModule';
import PaymentVendorSetup from '@/components/PaymentVendorSetup';
import SalonNotificationSettings from '@/components/SalonNotificationSettings';
import StaffAccessManagement from '@/components/StaffAccessManagement';
import StaffSettingsContent from '@/components/staff/StaffSettingsContent';

// Section definitions — mirrors the mock's NAV structure exactly.
const NAV = [
  {
    k: 'business', label: 'Business profile',
    ico: <><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></>,
    subs: [
      { k: 'details', label: 'Salon details', perm: ['salon_settings', 'edit_profile'] },
      { k: 'branches', label: 'Branches', perm: ['salon_settings', 'edit_branches'] },
      { k: 'hours', label: 'Business hours', perm: ['salon_settings', 'edit_hours'] },
    ],
  },
  {
    k: 'staff', label: 'Staff & attendance',
    ico: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></>,
    subs: [
      { k: 'method', label: 'Attendance method', perm: ['staff', 'attendance'] },
      { k: 'checkinout', label: 'Check-in / check-out rules', perm: ['staff', 'attendance'] },
      { k: 'leave', label: 'Leave & holidays', perm: ['staff', 'attendance'] },
      { k: 'payroll', label: 'Payroll & incentives', perm: ['staff', 'salary_view'] },
    ],
  },
  {
    k: 'access', label: 'Roles & access',
    ico: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    subs: [
      { k: 'login', label: 'Login identity', perm: ['salon_settings', 'manage_users'] },
      { k: 'roles', label: 'Manage staff access', perm: ['salon_settings', 'manage_users'] },
    ],
  },
  {
    k: 'services', label: 'Services & pricing',
    ico: <><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/></>,
    subs: [
      { k: 'catalogue', label: 'Service catalogue', perm: ['services', 'view'] },
      { k: 'barber', label: 'Per-barber pricing', perm: ['services', 'view'] },
      { k: 'tax', label: 'Taxes & invoicing', perm: ['salon_settings', 'edit_profile'] },
    ],
  },
  {
    k: 'booking', label: 'Booking & queue',
    ico: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    subs: [
      { k: 'online', label: 'Online booking', perm: ['salon_settings', 'edit_profile'] },
      { k: 'queue', label: 'Walk-in queue', perm: ['salon_settings', 'edit_profile'] },
    ],
  },
  {
    k: 'payments', label: 'Payments & wallet',
    ico: <><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></>,
    subs: [
      { k: 'gateway', label: 'Payment gateway', perm: ['salon_settings', 'edit_profile'] },
      { k: 'counter', label: 'Counter methods', perm: ['salon_settings', 'edit_profile'] },
      { k: 'wallet', label: 'Marketing wallet', perm: ['marketing', 'view'] },
    ],
  },
  {
    k: 'notif', label: 'Notifications',
    ico: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    subs: [
      { k: 'guest', label: 'Guest messages', perm: ['salon_settings', 'edit_notifications'] },
      { k: 'staffn', label: 'Staff & owner alerts', perm: ['salon_settings', 'edit_notifications'] },
    ],
  },
];

export default function SalonSettingsV3({ salonId, salon, setSalon, getAuthHeaders, onDeleteSalon }) {
  const { hasModulePermission, salonUser } = useAuth();
  const isAdmin = salonUser?.role === 'admin' || salonUser?.role === 'branch_manager';
  const permAllowed = (perm) => {
    if (!perm) return true;
    if (isAdmin) return true;
    return !!hasModulePermission?.(perm[0], perm[1]);
  };

  const [sec, setSec] = useState('business');
  const [sub, setSub] = useState('details');

  // Inject scoped CSS once
  useEffect(() => {
    const id = 'settings-v3-styles';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = SETTINGS_V3_CSS;
    document.head.appendChild(el);
  }, []);

  // First allowed group + sub on first mount (skip locked ones)
  useEffect(() => {
    const firstAllowed = NAV.find((g) => g.subs.some((s) => permAllowed(s.perm)));
    if (!firstAllowed) return;
    const firstSub = firstAllowed.subs.find((s) => permAllowed(s.perm));
    setSec(firstAllowed.k);
    setSub(firstSub?.k || firstAllowed.subs[0].k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonUser?.userId]);

  const currentGroup = useMemo(() => NAV.find((g) => g.k === sec) || NAV[0], [sec]);
  const currentSubConfig = useMemo(() => currentGroup.subs.find((s) => s.k === sub), [currentGroup, sub]);
  const currentAllowed = permAllowed(currentSubConfig?.perm);

  const go = (kSec, kSub) => {
    const grp = NAV.find((g) => g.k === kSec);
    if (!grp) return;
    const subCfg = grp.subs.find((s) => s.k === kSub);
    if (!permAllowed(subCfg?.perm)) return;
    setSec(kSec); setSub(kSub);
  };

  const RbacLock = () => (
    <div className="rbac-lock">
      <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      You don't have permission to view this section.
    </div>
  );

  // ---------- section renderers ----------
  const renderContent = () => {
    if (!currentAllowed) return <RbacLock />;
    const key = `${sec}.${sub}`;

    // Business profile
    if (key === 'business.details') {
      return (
        <>
          <div className="bhead"><h3>Salon details</h3><p>Appears on invoices, booking links and WhatsApp messages.</p></div>
          <div className="block">
            <MyProfile salon={salon} onUpdate={(u) => setSalon?.(u)} getAuthHeaders={getAuthHeaders} onDeleteSalon={onDeleteSalon} />
          </div>
          <div className="block">
            <h4>Payment vendor setup</h4><p className="bs">Configure Cashfree (or your gateway) for online payments.</p>
            <PaymentVendorSetup salon={salon} getAuthHeaders={getAuthHeaders} />
          </div>
        </>
      );
    }
    if (key === 'business.branches') {
      return (
        <>
          <div className="bhead"><h3>Branches</h3><p>Staff, stock and reports are tracked per branch.</p></div>
          <div className="block"><BranchManagement salonId={salonId} /></div>
        </>
      );
    }
    if (key === 'business.hours') {
      return (
        <>
          <div className="bhead"><h3>Business hours</h3><p>Drives online booking slots and the queue.</p></div>
          <div className="block"><OperationalHoursModule salonId={salonId} /></div>
        </>
      );
    }

    // Staff & attendance — wraps existing StaffSettingsContent
    if (sec === 'staff') {
      const defaultTab =
        sub === 'method' ? 'attendance-mode' :
        sub === 'checkinout' ? 'attendance-mode' :
        sub === 'leave' ? 'leave-holidays' :
        sub === 'payroll' ? 'incentives' : 'incentives';
      return (
        <>
          <div className="bhead">
            <h3>{currentSubConfig.label}</h3>
            <p>The single source that drives how the Staff page marks attendance & pays salary.</p>
          </div>
          <div className="block">
            <StaffSettingsContent
              salonId={salonId}
              getAuthHeaders={getAuthHeaders}
              isAdmin={isAdmin}
              useUrlTab={false}
              defaultTab={defaultTab}
              key={defaultTab}
            />
          </div>
        </>
      );
    }

    // Roles & access
    if (key === 'access.login') {
      return (
        <>
          <div className="bhead"><h3>Login identity</h3><p>How staff sign in to the app.</p></div>
          <div className="block">
            <h4>Mobile number is the login ID</h4>
            <p className="bs">Mandatory and unique for every staff member.</p>
            <div className="note-box">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              <span>Every staff member must have a unique mobile number — it is their identifier across attendance, payroll and access.</span>
            </div>
            <p style={{ marginTop: 16, fontSize: 12.5, color: 'var(--muted)' }}>
              Add and manage staff accounts under <b>Roles &amp; Access → Manage staff access</b>.
            </p>
          </div>
        </>
      );
    }
    if (key === 'access.roles') {
      return (
        <>
          <div className="bhead"><h3>Manage staff access</h3><p>Grant per-module permissions to every staff account.</p></div>
          <div className="block"><StaffAccessManagement /></div>
        </>
      );
    }

    // Services & pricing
    if (key === 'services.catalogue' || key === 'services.barber') {
      return (
        <>
          <div className="bhead"><h3>{currentSubConfig.label}</h3><p>Salon-level services and base prices — per-barber overrides live on the Staff page.</p></div>
          <div className="block">
            <div className="note-box">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              <span>Open the <b>Services &amp; Offerings</b> tab from the hamburger menu to add, edit and enable/disable services for the salon. Barber-specific pricing is set on the Staff page → Services &amp; pricing.</span>
            </div>
          </div>
        </>
      );
    }
    if (key === 'services.tax') {
      return (
        <>
          <div className="bhead"><h3>Taxes &amp; invoicing</h3><p>GST-ready invoices for India.</p></div>
          <div className="block">
            <p className="bs">Tax and invoice numbering is edited from the salon profile screen for now.</p>
          </div>
        </>
      );
    }

    // Booking & queue — placeholder note pointing at existing settings
    if (sec === 'booking') {
      return (
        <>
          <div className="bhead"><h3>{currentSubConfig.label}</h3><p>Booking &amp; queue rules for guests and walk-ins.</p></div>
          <div className="block">
            <div className="note-box">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              <span>Booking window, buffer and slot duration are configured on the salon profile card above. Advanced queue settings are on the Queue tab.</span>
            </div>
          </div>
        </>
      );
    }

    // Payments
    if (key === 'payments.gateway') {
      return (
        <>
          <div className="bhead"><h3>Payment gateway</h3><p>Online payments and wallet top-ups.</p></div>
          <div className="block"><PaymentVendorSetup salon={salon} getAuthHeaders={getAuthHeaders} /></div>
        </>
      );
    }
    if (key === 'payments.counter') {
      return (
        <>
          <div className="bhead"><h3>Counter methods</h3><p>Payments accepted at checkout.</p></div>
          <div className="block">
            <p className="bs">Counter methods (cash, UPI, card, wallet, pay-later) are always available on the checkout screen.</p>
          </div>
        </>
      );
    }
    if (key === 'payments.wallet') {
      return (
        <>
          <div className="bhead"><h3>Marketing wallet</h3><p>Prepaid balance for WhatsApp / SMS / Email.</p></div>
          <div className="block">
            <p className="bs">Manage your marketing wallet balance and top-ups from the Marketing tab.</p>
          </div>
        </>
      );
    }

    // Notifications
    if (sec === 'notif') {
      return (
        <>
          <div className="bhead"><h3>{currentSubConfig.label}</h3><p>Configure automatic messages and internal alerts.</p></div>
          <div className="block"><SalonNotificationSettings salonId={salonId} getAuthHeaders={getAuthHeaders} /></div>
        </>
      );
    }

    return <div className="rbac-lock">Coming soon</div>;
  };

  return (
    <div className="setv3">
      <div className="phead">
        <h2>
          <span className="hic">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </span>
          Settings
        </h2>
        <p>Single source for every salon configuration.</p>
      </div>

      <div className="workspace">
        <div className="pane-l">
          <div className="nav-head">Settings</div>
          <div className="setnav">
            {NAV.map((n) => {
              const on = n.k === sec;
              const groupAllowed = n.subs.some((s) => permAllowed(s.perm));
              if (!groupAllowed) return null;
              const firstAllowedSub = n.subs.find((s) => permAllowed(s.perm));
              return (
                <div key={n.k} className={`sgroup ${on ? 'on' : ''}`}>
                  <button className="sn" onClick={() => go(n.k, firstAllowedSub.k)}>
                    <svg className="ic" viewBox="0 0 24 24">{n.ico}</svg>
                    {n.label}
                    <svg className="chev" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                  <div className="subnav">
                    {n.subs.map((sc) => {
                      const allowed = permAllowed(sc.perm);
                      if (!allowed) return null;
                      return (
                        <button key={sc.k} className={`subitem ${on && sub === sc.k ? 'on' : ''}`}
                          onClick={(e) => { e.stopPropagation(); go(n.k, sc.k); }}>
                          {sc.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="pane-r">
          <div className="pane-body">{renderContent()}</div>
        </div>
      </div>
    </div>
  );
}
