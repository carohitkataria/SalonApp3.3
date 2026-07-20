/**
 * SalonSettingsV3.js — Redesigned Settings page (gold theme).
 *
 * Every sub-section is INLINED (matches the attached mock exactly instead of
 * wrapping arbitrary existing components). Data is loaded from the salon record
 * and saved back via PUT /api/salons/{salon_id} partial updates.
 *
 * RBAC: every sub-section is gated by hasModulePermission and locked
 * sub-sections are hidden from the left nav.
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { SETTINGS_V3_CSS } from './SettingsV3Styles';
import StaffAccessManagement from '@/components/StaffAccessManagement';
import EmployeeRewardPlan from '@/components/EmployeeRewardPlan';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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
      { k: 'method', label: 'Attendance method & rules', perm: ['staff', 'attendance'] },
      { k: 'leave', label: 'Leave & holidays', perm: ['staff', 'attendance'] },
      { k: 'payroll', label: 'Payroll & incentives', perm: ['staff', 'salary_view'] },
    ],
  },
  {
    k: 'access', label: 'Roles & access',
    ico: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    subs: [
      { k: 'login', label: 'Login identity', perm: ['salon_settings', 'manage_users'] },
      { k: 'roles', label: 'Roles & permissions', perm: ['salon_settings', 'manage_users'] },
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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ------- Small reusable UI atoms scoped to `.setv3` -------
function SubscriptionBadge({ salon }) {
  if (!salon) return null;
  const plan = salon.subscription_plan || salon.plan || 'free';
  const expiryRaw =
    salon.subscription_expiry ||
    salon.plan_expiry ||
    salon.subscription?.expiry ||
    salon.subscription?.expires_at ||
    salon.subscription?.end_date ||
    null;
  const expiryDate = expiryRaw ? new Date(expiryRaw) : null;
  const days = expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  const isPaid = String(plan).toLowerCase() !== 'free' && String(plan).toLowerCase() !== 'trial';
  const tone = !isPaid ? 'sub-free' : days == null ? 'sub-active' : days < 0 ? 'sub-expired' : days <= 15 ? 'sub-warn' : 'sub-active';

  let human;
  if (!isPaid) human = 'Free plan';
  else if (!expiryDate) human = `${plan.toUpperCase()} · Active`;
  else if (days < 0) human = `${plan.toUpperCase()} · Expired ${Math.abs(days)}d ago`;
  else human = `${plan.toUpperCase()} · Renews in ${days}d`;

  const expiryLabel = expiryDate
    ? expiryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className={`sub-badge ${tone}`} data-testid="settings-sub-badge">
      <div className="sub-badge-ic">
        <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </div>
      <div>
        <div className="sub-badge-t">{human}</div>
        {expiryLabel && <div className="sub-badge-s">Expires · {expiryLabel}</div>}
      </div>
    </div>
  );
}
function OptRow({ label, hint, on, onChange, testid }) {
  return (
    <div className="opt-row">
      <div className="on-l"><b>{label}</b>{hint && <span>{hint}</span>}</div>
      <button type="button" className={`toggle ${on ? 'on' : ''}`} onClick={onChange} data-testid={testid} aria-pressed={on} />
    </div>
  );
}

function SaveRow({ onClick, disabled, testid, label = 'Save' }) {
  return (
    <div className="save-row">
      <button className="btn-primary" onClick={onClick} disabled={disabled} data-testid={testid}>
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>{label}
      </button>
    </div>
  );
}

function SectionHeader({ title, sub }) {
  return <div className="bhead"><h3>{title}</h3>{sub && <p>{sub}</p>}</div>;
}

// ============================================================================

export default function SalonSettingsV3({ salonId, salon, setSalon, getAuthHeaders }) {
  const { hasModulePermission, salonUser } = useAuth();
  const isAdmin = salonUser?.role === 'admin' || salonUser?.role === 'branch_manager';
  const permAllowed = (perm) => {
    if (!perm) return true;
    if (isAdmin) return true;
    return !!hasModulePermission?.(perm[0], perm[1]);
  };

  const [sec, setSec] = useState('business');
  const [sub, setSub] = useState('details');
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();

  // ------ Editable state (backed by salon record) ------
  const [form, setForm] = useState({});
  const [initial, setInitial] = useState({});
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState([]);
  const [services, setServices] = useState([]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  // Inject scoped CSS once
  useEffect(() => {
    const id = 'settings-v3-styles';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = SETTINGS_V3_CSS;
    document.head.appendChild(el);
  }, []);

  // First allowed section
  useEffect(() => {
    const firstAllowed = NAV.find((g) => g.subs.some((s) => permAllowed(s.perm)));
    if (!firstAllowed) return;
    const firstSub = firstAllowed.subs.find((s) => permAllowed(s.perm));
    setSec(firstAllowed.k);
    setSub(firstSub?.k || firstAllowed.subs[0].k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonUser?.userId]);

  // Load initial state from salon record
  useEffect(() => {
    if (!salon) return;
    const hoursDef = DAYS.reduce((a, d) => { a[d.toLowerCase()] = { open: true, start: '10:00', end: '20:00' }; return a; }, {});
    const next = {
      // Salon details
      name: salon.name || salon.salon_name || '',
      phone: salon.phone || '',
      email: salon.email || '',
      address: salon.address || '',
      city: salon.city || '',
      owner_name: salon.owner_name || '',
      description: salon.description || '',
      logo_url: salon.logo_url || '',
      // Hours
      business_hours: salon.business_hours || hoursDef,
      // Attendance
      attendance_method: salon.attendance_mode || salon.attendance_method || 'checkinout',
      shift_start: salon.shift_start || '10:00',
      shift_end: salon.shift_end || '20:00',
      grace_period_min: salon.grace_period_min ?? 15,
      half_day_max_hours: salon.half_day_max_hours ?? 4,
      min_hours_full_day: salon.min_hours_full_day ?? 8,
      overtime_after_hours: salon.overtime_after_hours ?? 9,
      auto_checkout: salon.auto_checkout ?? true,
      auto_checkout_time: salon.auto_checkout_time || '21:00',
      allow_self_checkin: salon.allow_self_checkin ?? true,
      geofence_required: salon.geofence_required ?? false,
      photo_on_checkin: salon.photo_on_checkin ?? false,
      admin_edit_past_attendance: salon.admin_edit_past_attendance ?? true,
      // Leave
      weekly_off: salon.weekly_off || 'Sunday',
      paid_leaves_per_year: salon.paid_leaves_per_year ?? 12,
      carry_forward_leaves: salon.carry_forward_leaves ?? false,
      holiday_calendar: salon.holiday_calendar || 'India',
      // Payroll
      salary_cycle: salon.salary_cycle || 'monthly_1',
      absent_deduction: salon.absent_deduction || 'pro_rata',
      incentive_rule: salon.incentive_rule || 'percent_over_target',
      incentive_percent: salon.incentive_percent ?? 10,
      monthly_target_per_stylist: salon.monthly_target_per_stylist ?? 120000,
      include_retail_in_incentive: salon.include_retail_in_incentive ?? true,
      // Login identity
      otp_login: salon.otp_login ?? true,
      require_pin_billing: salon.require_pin_billing ?? false,
      auto_logout_after_shift: salon.auto_logout_after_shift ?? true,
      // Services
      allow_barber_price_override: salon.allow_barber_price_override ?? true,
      show_barber_price_on_booking: salon.show_barber_price_on_booking ?? true,
      category_based_pricing: salon.category_based_pricing ?? false,
      // Tax
      is_gst_registered: salon.is_gst_registered ?? !!(salon.gstin && salon.gstin.trim()),
      gstin: salon.gstin || '',
      gst_rate: salon.gst_rate ?? 18,
      invoice_prefix: salon.invoice_prefix || 'INV-',
      next_invoice_no: salon.next_invoice_no ?? 1000,
      invoice_footer: salon.invoice_footer || '',
      prices_include_tax: salon.prices_include_tax ?? true,
      round_off_invoice: salon.round_off_invoice ?? true,
      // Lunch (backend already accepts these)
      lunch_start: salon.lunch_start || '',
      lunch_end: salon.lunch_end || '',
      // Booking
      online_booking_enabled: salon.online_booking_enabled ?? true,
      online_booking_paused: salon.online_booking_paused ?? false,
      online_paused_message: salon.online_paused_message || 'Salon is open — walk-ins welcome. Online booking is paused.',
      allow_guest_choose_barber: salon.allow_guest_choose_barber ?? true,
      require_advance_payment: salon.require_advance_payment ?? false,
      slot_duration_min: salon.slot_duration_min ?? 30,
      buffer_between_appts: salon.buffer_between_appts ?? 5,
      advance_booking_days: salon.advance_booking_days ?? 30,
      cancellation_window_hours: salon.cancellation_window_hours ?? 2,
      // Queue
      walkin_queue_enabled: salon.walkin_queue_enabled ?? true,
      show_live_wait_time: salon.show_live_wait_time ?? true,
      auto_assign_next_barber: salon.auto_assign_next_barber ?? false,
      average_service_time_min: salon.average_service_time_min ?? 30,
      max_queue_size: salon.max_queue_size ?? 15,
      // Payments
      gateway_test_mode: salon.gateway_test_mode ?? false,
      counter_cash: salon.counter_cash ?? true,
      counter_upi: salon.counter_upi ?? true,
      counter_card: salon.counter_card ?? true,
      counter_wallet: salon.counter_wallet ?? true,
      counter_pay_later: salon.counter_pay_later ?? false,
      // Notifications
      notif_appointment_reminders: salon.notif_appointment_reminders ?? true,
      notif_booking_confirmations: salon.notif_booking_confirmations ?? true,
      notif_review_requests: salon.notif_review_requests ?? true,
      notif_birthday_wishes: salon.notif_birthday_wishes ?? true,
      marketing_optin_required: salon.marketing_optin_required ?? true,
      notif_daily_summary_owner: salon.notif_daily_summary_owner ?? false,
      notif_late_checkin_alert: salon.notif_late_checkin_alert ?? true,
      notif_low_stock_alert: salon.notif_low_stock_alert ?? true,
      notif_new_booking_alert: salon.notif_new_booking_alert ?? true,
    };
    setForm(next);
    setInitial(next);
  }, [salon]);

  // Load branches once
  useEffect(() => {
    (async () => {
      if (!salonId) return;
      try {
        const res = await axios.get(`${API}/salons/${salonId}/branches`, { headers: getAuthHeaders?.() || {} });
        setBranches(res.data?.branches || res.data || []);
      } catch (_) {}
    })();
  }, [salonId, getAuthHeaders]);

  // Load services when needed
  useEffect(() => {
    if (!salonId || sec !== 'services' || sub !== 'catalogue') return;
    (async () => {
      try {
        const res = await axios.get(`${API}/salons/${salonId}/services/enabled`).catch(() => ({ data: [] }));
        setServices(Array.isArray(res.data) ? res.data : []);
      } catch (_) {}
    })();
  }, [salonId, sec, sub]);

  const [addBranchOpen, setAddBranchOpen] = useState(false);
  const [newBranch, setNewBranch] = useState({ branch_name: '', branch_code: '', address: '', city: '', phone: '', email: '' });
  const [creatingBranch, setCreatingBranch] = useState(false);

  const createBranch = async () => {
    const name = (newBranch.branch_name || '').trim();
    if (!name) return toast.error('Branch name is required');
    setCreatingBranch(true);
    try {
      const res = await axios.post(
        `${API}/salons/${salonId}/branches`,
        {
          branch_name: name,
          branch_code: (newBranch.branch_code || '').trim() || null,
          address: newBranch.address || null,
          city: newBranch.city || null,
          phone: newBranch.phone || null,
          email: newBranch.email || null,
        },
        { headers: getAuthHeaders?.() || {} },
      );
      const b = res.data || {};
      setBranches((prev) => [...(prev || []), b]);
      setNewBranch({ branch_name: '', branch_code: '', address: '', city: '', phone: '', email: '' });
      setAddBranchOpen(false);
      toast.success('Branch created');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not create branch');
    } finally {
      setCreatingBranch(false);
    }
  };

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const toggle = (k) => set({ [k]: !form[k] });

  const save = useCallback(async (subset = null) => {
    if (!salonId) return;
    setSaving(true);
    try {
      const payload = subset ? Object.fromEntries(subset.map((k) => [k, form[k]])) : { ...form };
      // Backend uses `salon_name`, our form key is `name`
      if ('name' in payload) {
        payload.salon_name = payload.name;
        delete payload.name;
      }
      // Backend uses `attendance_mode`, our form key is `attendance_method`
      if ('attendance_method' in payload) {
        payload.attendance_mode = payload.attendance_method;
        delete payload.attendance_method;
      }
      const res = await axios.put(`${API}/salons/${salonId}`, payload, { headers: getAuthHeaders?.() || {} });
      const updated = res.data || {};
      setSalon?.(updated);
      setInitial((prev) => ({ ...prev, ...(subset ? Object.fromEntries(subset.map((k) => [k, form[k]])) : form) }));
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [salonId, form, getAuthHeaders, setSalon]);

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

  // ---------- Sub-section renderers ----------
  const RENDERERS = {
    'business.details': () => (
      <>
        <SectionHeader title="Salon details" sub="Appears on invoices, booking links and WhatsApp messages." />
        <div className="block">
          <div className="logo-up">
            <div className="logo">
              {form.logo_url ? (
                <img src={form.logo_url} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} />
              ) : (
                <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              )}
            </div>
            <div>
              <b style={{ fontSize: 14 }}>Salon logo</b>
              <p className="hint">PNG or JPG, up to 5 MB</p>
              <label className="btn-ghost" style={{ marginTop: 8, display: 'inline-flex' }}>
                <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                {form.logo_url ? 'Change logo' : 'Upload'}
                <input type="file" accept="image/png,image/jpeg" style={{ display: 'none' }} onChange={async (e) => {
                  const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
                  if (f.size > 5 * 1024 * 1024) return toast.error('Max 5 MB');
                  const dataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
                  set({ logo_url: dataUrl });
                }} data-testid="settings-logo-upload" />
              </label>
            </div>
          </div>
          <div className="grid2">
            <div className="field full"><label>Salon name <span className="req">*</span></label>
              <input value={form.name || ''} onChange={(e) => set({ name: e.target.value })} data-testid="setg-salon-name" /></div>
            <div className="field"><label>Phone</label>
              <input value={form.phone || ''} onChange={(e) => set({ phone: e.target.value })} /></div>
            <div className="field"><label>Email</label>
              <input value={form.email || ''} onChange={(e) => set({ email: e.target.value })} /></div>
            <div className="field full"><label>Address</label>
              <input value={form.address || ''} onChange={(e) => set({ address: e.target.value })} /></div>
            <div className="field"><label>City</label>
              <input value={form.city || ''} onChange={(e) => set({ city: e.target.value })} /></div>
            <div className="field"><label>Owner</label>
              <input value={form.owner_name || ''} onChange={(e) => set({ owner_name: e.target.value })} /></div>
            <div className="field full"><label>About (booking page)</label>
              <textarea value={form.description || ''} onChange={(e) => set({ description: e.target.value })} /></div>
          </div>
        </div>
        <SaveRow onClick={() => save()} disabled={saving || !dirty} testid="setg-details-save" />
      </>
    ),

    'business.branches': () => (
      <>
        <SectionHeader title="Branches" sub="Staff, stock and reports are tracked per branch." />
        <div className="block">
          <h4 className="row-btn">Locations
            <button className="btn-primary" onClick={() => setAddBranchOpen((v) => !v)} data-testid="setg-add-branch-btn">
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {addBranchOpen ? 'Close' : 'Add branch'}
            </button>
          </h4>
          <p className="bs">Manage all salon locations.</p>

          {addBranchOpen && (
            <div className="block" style={{ marginTop: 10, background: '#FDFAFC' }}>
              <h4>Create new branch</h4>
              <div className="grid2">
                <div className="field"><label>Branch name <span className="req">*</span></label>
                  <input
                    value={newBranch.branch_name}
                    placeholder="e.g. Trimmy's — Whitefield"
                    onChange={(e) => setNewBranch({ ...newBranch, branch_name: e.target.value })}
                    data-testid="setg-new-branch-name"
                  />
                </div>
                <div className="field"><label>Branch code</label>
                  <input
                    value={newBranch.branch_code}
                    placeholder="e.g. BLR-02"
                    onChange={(e) => setNewBranch({ ...newBranch, branch_code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="field full"><label>Address</label>
                  <input value={newBranch.address} onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })} />
                </div>
                <div className="field"><label>City</label>
                  <input value={newBranch.city} onChange={(e) => setNewBranch({ ...newBranch, city: e.target.value })} />
                </div>
                <div className="field"><label>Phone</label>
                  <input value={newBranch.phone} onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })} />
                </div>
                <div className="field"><label>Email</label>
                  <input value={newBranch.email} type="email" onChange={(e) => setNewBranch({ ...newBranch, email: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn-ghost" onClick={() => setAddBranchOpen(false)} disabled={creatingBranch}>Cancel</button>
                <button className="btn-primary" onClick={createBranch} disabled={creatingBranch} data-testid="setg-create-branch-save">
                  {creatingBranch ? 'Creating…' : 'Create branch'}
                </button>
              </div>
            </div>
          )}

          {branches.length === 0 && (
            <div className="list-row">
              <div className="li"><svg viewBox="0 0 24 24"><path d="M9 22V12h6v10"/><path d="M2 10.6L12 2l10 8.6"/></svg></div>
              <div className="ld"><b>{form.name || 'Main Branch'}</b><span>{form.address || form.city || 'Primary location'}</span></div>
              <span className="status-pill ok">Active</span>
            </div>
          )}
          {branches.map((b) => (
            <div className="list-row" key={b.id || b.branch_id || b.name || b.branch_name}>
              <div className="li"><svg viewBox="0 0 24 24"><path d="M9 22V12h6v10"/><path d="M2 10.6L12 2l10 8.6"/></svg></div>
              <div className="ld"><b>{b.branch_name || b.name || 'Branch'}</b><span>{b.address || b.city || ''}{b.staff_count != null ? ` · ${b.staff_count} staff` : ''}{b.branch_code ? ` · ${b.branch_code}` : ''}</span></div>
              <span className={`status-pill ${b.status === 'inactive' || b.is_active === false ? '' : 'ok'}`}>{b.status === 'inactive' || b.is_active === false ? 'Inactive' : 'Active'}</span>
            </div>
          ))}
        </div>
      </>
    ),

    'business.hours': () => (
      <>
        <SectionHeader title="Business hours" sub="Drives online booking slots and the queue." />
        <div className="block">
          {DAYS.map((d) => {
            const key = d.toLowerCase();
            const rec = form.business_hours?.[key] || { open: true, start: '10:00', end: '20:00' };
            const upd = (patch) => set({ business_hours: { ...(form.business_hours || {}), [key]: { ...rec, ...patch } } });
            return (
              <div className="hour-row" key={d}>
                <div className="dow">{d.slice(0, 3)}</div>
                <button type="button" className={`toggle ${rec.open ? 'on' : ''}`} onClick={() => upd({ open: !rec.open })} data-testid={`setg-hours-toggle-${key}`} />
                <div className="times">
                  {rec.open ? (
                    <>
                      <input type="time" value={rec.start} onChange={(e) => upd({ start: e.target.value })} />
                      <span className="to">to</span>
                      <input type="time" value={rec.end} onChange={(e) => upd({ end: e.target.value })} />
                    </>
                  ) : <span className="closed">Closed</span>}
                </div>
              </div>
            );
          })}
        </div>
        <SaveRow onClick={() => save(['business_hours'])} disabled={saving || !dirty} testid="setg-hours-save" />
      </>
    ),

    'staff.method': () => {
      const ci = form.attendance_method === 'checkinout';
      const disabledStyle = !ci ? { opacity: 0.55, pointerEvents: 'none' } : {};
      return (
      <>
        <SectionHeader title="Attendance method & rules" sub="The single source that drives how the Staff page marks attendance." />
        <div className="block">
          <h4>How is attendance recorded?</h4>
          <p className="bs">The Staff page attendance drawer changes to match this choice.</p>
          <div className="method-pick">
            {[
              { m: 'checkinout', title: 'Check-in / Check-out', desc: 'Staff clock in and out. Drawer shows time fields per date + A / P / H / Holiday / Leave.',
                ico: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></> },
              { m: 'service_completion', title: 'Service completion', desc: 'Attendance from services completed. Drawer shows A / P / H / Holiday / Leave only.',
                ico: <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></> },
            ].map((o) => (
              <button key={o.m} type="button" className={`method ${form.attendance_method === o.m ? 'on' : ''}`}
                onClick={() => set({ attendance_method: o.m })} data-testid={`setg-att-method-${o.m}`}>
                <span className="rd" />
                <div className="mtop"><div className="mi"><svg viewBox="0 0 24 24">{o.ico}</svg></div><b>{o.title}</b></div>
                <p>{o.desc}</p>
              </button>
            ))}
          </div>
          <div className="note-box">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            {ci
              ? 'Check-in / check-out rules below are active. Changes save on the button at the bottom.'
              : 'Rules below are disabled because Service completion is selected. Pick Check-in / Check-out to edit them.'}
          </div>
        </div>

        <div className="block" style={disabledStyle}>
          <h4>Shift &amp; timing</h4><p className="bs">Used to auto-flag late arrivals, half-days and overtime.</p>
          <div className="grid3">
            <div className="field"><label>Shift start</label><input type="time" value={form.shift_start || ''} disabled={!ci} onChange={(e) => set({ shift_start: e.target.value })} /></div>
            <div className="field"><label>Shift end</label><input type="time" value={form.shift_end || ''} disabled={!ci} onChange={(e) => set({ shift_end: e.target.value })} /></div>
            <div className="field"><label>Grace period (min)</label><input type="number" value={form.grace_period_min ?? 0} disabled={!ci} onChange={(e) => set({ grace_period_min: Number(e.target.value) || 0 })} /><span className="hint">Late after this</span></div>
            <div className="field"><label>Half-day if under (hrs)</label><input type="number" value={form.half_day_max_hours ?? 0} disabled={!ci} onChange={(e) => set({ half_day_max_hours: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>Full day minimum (hrs)</label><input type="number" value={form.min_hours_full_day ?? 0} disabled={!ci} onChange={(e) => set({ min_hours_full_day: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>Overtime after (hrs)</label><input type="number" value={form.overtime_after_hours ?? 0} disabled={!ci} onChange={(e) => set({ overtime_after_hours: Number(e.target.value) || 0 })} /></div>
          </div>
          <h4 style={{ marginTop: 20 }}>Lunch break</h4>
          <p className="bs">Deducted from worked hours when computing full-day / half-day.</p>
          <div className="grid3">
            <div className="field"><label>Lunch start</label>
              <input type="time" value={form.lunch_start || ''} onChange={(e) => set({ lunch_start: e.target.value })} data-testid="setg-lunch-start" /></div>
            <div className="field"><label>Lunch end</label>
              <input type="time" value={form.lunch_end || ''} onChange={(e) => set({ lunch_end: e.target.value })} data-testid="setg-lunch-end" /></div>
            <div className="field"><label>Duration</label>
              <input value={(() => {
                if (!form.lunch_start || !form.lunch_end) return '—';
                const [a, b] = [form.lunch_start, form.lunch_end].map((t) => {
                  const [h, m] = t.split(':').map(Number); return h * 60 + m;
                });
                const mins = b - a;
                if (mins <= 0) return '—';
                return `${mins} min`;
              })()} disabled /></div>
          </div>
        </div>
        <div className="block" style={disabledStyle}>
          <h4>Automation &amp; control</h4><p className="bs">How check-ins are captured.</p>
          <OptRow label="Auto check-out" hint="Close open sessions at a fixed time" on={!!form.auto_checkout} onChange={() => ci && toggle('auto_checkout')} testid="setg-auto-checkout" />
          {form.auto_checkout && (
            <div className="grid3" style={{ margin: '12px 0' }}>
              <div className="field"><label>Auto check-out time</label><input type="time" value={form.auto_checkout_time || ''} disabled={!ci} onChange={(e) => set({ auto_checkout_time: e.target.value })} /></div>
            </div>
          )}
          <OptRow label="Allow staff self check-in" hint="Staff can clock in from their own login" on={!!form.allow_self_checkin} onChange={() => ci && toggle('allow_self_checkin')} />
          <OptRow label="Require geo-fence" hint="Only allow check-in at the salon location" on={!!form.geofence_required} onChange={() => ci && toggle('geofence_required')} />
          <OptRow label="Photo on check-in" hint="Capture a selfie when clocking in" on={!!form.photo_on_checkin} onChange={() => ci && toggle('photo_on_checkin')} />
          <OptRow label="Admin can edit past attendance" hint="Owner/manager can backdate records" on={!!form.admin_edit_past_attendance} onChange={() => toggle('admin_edit_past_attendance')} />
        </div>
        <SaveRow onClick={() => save()} disabled={saving || !dirty} testid="setg-method-save" />
      </>
      );
    },    'staff.leave': () => (
      <>
        <SectionHeader title="Leave & holidays" sub="Weekly offs, holiday calendar and leave policy." />
        <div className="block">
          <h4>Weekly off &amp; holidays</h4><p className="bs">Auto-marked on the attendance drawer.</p>
          <div className="grid2">
            <div className="field"><label>Weekly off</label>
              <select value={form.weekly_off || 'Sunday'} onChange={(e) => set({ weekly_off: e.target.value })}>
                <option>Sunday</option><option>Monday</option><option>Rotational</option><option>None</option>
              </select></div>
            <div className="field"><label>Paid leaves / year</label>
              <input type="number" value={form.paid_leaves_per_year ?? 0} onChange={(e) => set({ paid_leaves_per_year: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>Carry forward unused leaves</label>
              <select value={form.carry_forward_leaves ? 'Yes' : 'No'} onChange={(e) => set({ carry_forward_leaves: e.target.value === 'Yes' })}>
                <option>No</option><option>Yes</option>
              </select></div>
            <div className="field"><label>Holiday calendar</label>
              <select value={form.holiday_calendar || 'India'} onChange={(e) => set({ holiday_calendar: e.target.value })}>
                <option value="India">India — national holidays</option>
                <option value="Custom">Custom</option>
              </select></div>
          </div>
        </div>
        <SaveRow onClick={() => save()} disabled={saving || !dirty} testid="setg-leave-save" />
      </>
    ),

    'staff.payroll': () => (
      <>
        <SectionHeader title="Payroll & incentives" sub="Cycle and deductions, plus the Employee Reward Plan used when marking salary paid." />
        <div className="block">
          <h4>Salary</h4><p className="bs">Cycle and deductions.</p>
          <div className="grid2">
            <div className="field"><label>Salary cycle</label>
              <select value={form.salary_cycle || 'monthly_1'} onChange={(e) => set({ salary_cycle: e.target.value })}>
                <option value="monthly_1">Monthly (paid on 1st)</option>
                <option value="monthly_7">Monthly (paid on 7th)</option>
                <option value="weekly">Weekly</option>
              </select></div>
            <div className="field"><label>Absent deduction</label>
              <select value={form.absent_deduction || 'pro_rata'} onChange={(e) => set({ absent_deduction: e.target.value })}>
                <option value="pro_rata">Pro-rata per day</option>
                <option value="none">None</option>
              </select></div>
          </div>
          <div className="save-row" style={{ marginTop: 12 }}>
            <button className="btn-primary" onClick={() => save(['salary_cycle', 'absent_deduction'])} disabled={saving} data-testid="setg-payroll-cycle-save">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Save salary rules
            </button>
          </div>
        </div>
        <div className="block reward-plan-host">
          <EmployeeRewardPlan salonId={salonId} getAuthHeaders={getAuthHeaders} isAdmin={isAdmin} />
        </div>
      </>
    ),

    'access.login': () => (
      <>
        <SectionHeader title="Login identity" sub="How staff sign in to the app." />
        <div className="block">
          <h4>Mobile number is the login ID</h4>
          <p className="bs">Mandatory and unique for every staff member.</p>
          <div className="note-box">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            <span>Every staff member must have a unique mobile number — it is their identifier across attendance, payroll and access.</span>
          </div>
          <div style={{ marginTop: 14 }}>
            <OptRow label="OTP login" hint="Staff sign in with an OTP to their mobile" on={!!form.otp_login} onChange={() => toggle('otp_login')} />
            <OptRow label="Require PIN for billing" hint="Extra PIN before creating invoices" on={!!form.require_pin_billing} onChange={() => toggle('require_pin_billing')} />
            <OptRow label="Auto-logout after shift" hint="Sign staff out at check-out" on={!!form.auto_logout_after_shift} onChange={() => toggle('auto_logout_after_shift')} />
          </div>
        </div>
        <SaveRow onClick={() => save()} disabled={saving || !dirty} testid="setg-login-save" />
      </>
    ),

    'access.roles': () => (
      <>
        <SectionHeader title="Roles & permissions" sub="Grant per-module permissions to every staff account." />
        <div className="block">
          <StaffAccessManagement />
        </div>
      </>
    ),

    'services.catalogue': () => (
      <>
        <SectionHeader title="Service catalogue" sub="Salon-level services and base prices." />
        <div className="block">
          <h4 className="row-btn">Services
            <button className="btn-ghost" onClick={() => toast.info('Manage services from the Services tab')}>
              <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add service
            </button>
          </h4>
          <p className="bs">Base price applies unless a barber has an override.</p>
          {services.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--muted)', padding: '10px 0' }}>No services yet. Add them from the Services tab.</p>
          )}
          {services.map((s) => (
            <div className="list-row" key={s.id}>
              <div className="li"><svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/></svg></div>
              <div className="ld"><b>{s.service_name || s.name}</b><span>{s.default_duration || s.duration || 30} min</span></div>
              <span className="tag">₹{Number(s.base_price || s.price || 0).toLocaleString('en-IN')}</span>
            </div>
          ))}
        </div>
      </>
    ),

    'services.barber': () => (
      <>
        <SectionHeader title="Per-barber pricing" sub="Each barber can have their own price for a service." />
        <div className="block">
          <h4>How it works</h4>
          <p className="bs">Set on the Staff page → select barber → Services &amp; pricing.</p>
          <div className="note-box">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            <span>Tick the services a barber performs and optionally override the salon price (e.g. a Master charges ₹400 for a haircut vs the ₹300 base). Only ticked services are bookable with that barber.</span>
          </div>
          <div style={{ marginTop: 14 }}>
            <OptRow label="Allow per-barber price override" hint="Barbers can have custom prices" on={!!form.allow_barber_price_override} onChange={() => toggle('allow_barber_price_override')} />
            <OptRow label="Show barber price on booking page" hint="Guests see the barber-specific price" on={!!form.show_barber_price_on_booking} onChange={() => toggle('show_barber_price_on_booking')} />
            <OptRow label="Category-based default pricing" hint="Auto-set price by Junior / Star / Master" on={!!form.category_based_pricing} onChange={() => toggle('category_based_pricing')} />
          </div>
        </div>
        <SaveRow onClick={() => save()} disabled={saving || !dirty} testid="setg-barber-price-save" />
      </>
    ),

    'services.tax': () => (
      <>
        <SectionHeader title="Taxes & invoicing" sub="GST-ready invoices for India." />
        <div className="block">
          <OptRow
            label="Salon is GST registered"
            hint="Turn off to hide GST from invoices, reports, and totals"
            on={!!form.is_gst_registered}
            onChange={() => toggle('is_gst_registered')}
            testid="setg-gst-registered"
          />
          {form.is_gst_registered && (
            <div className="grid2" style={{ marginTop: 12 }}>
              <div className="field"><label>GSTIN <span className="req">*</span></label>
                <input
                  value={form.gstin || ''}
                  placeholder="15-digit GSTIN"
                  onChange={(e) => set({ gstin: e.target.value.toUpperCase() })}
                  data-testid="setg-gstin"
                />
                {form.is_gst_registered && !((form.gstin || '').trim()) && (
                  <span className="idnote" style={{ color: 'var(--red)' }}>
                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                    GSTIN is required when the salon is GST-registered
                  </span>
                )}
              </div>
              <div className="field"><label>Default GST rate</label>
                <select value={form.gst_rate ?? 18} onChange={(e) => set({ gst_rate: Number(e.target.value) })}>
                  <option value={28}>28%</option>
                  <option value={18}>18%</option>
                  <option value={12}>12%</option>
                  <option value={5}>5%</option>
                  <option value={0}>0%</option>
                </select></div>
            </div>
          )}
          <div className="grid2" style={{ marginTop: 12 }}>
            <div className="field"><label>Invoice prefix</label><input value={form.invoice_prefix || ''} onChange={(e) => set({ invoice_prefix: e.target.value })} /></div>
            <div className="field"><label>Next invoice no.</label><input type="number" value={form.next_invoice_no ?? 1000} onChange={(e) => set({ next_invoice_no: Number(e.target.value) || 0 })} /></div>
            <div className="field full"><label>Invoice footer / terms</label><textarea value={form.invoice_footer || ''} onChange={(e) => set({ invoice_footer: e.target.value })} /></div>
          </div>
          <div style={{ marginTop: 8 }}>
            {form.is_gst_registered && (
              <OptRow label="Prices include tax" hint="Show tax-inclusive pricing" on={!!form.prices_include_tax} onChange={() => toggle('prices_include_tax')} />
            )}
            <OptRow label="Round off invoice total" hint="Round to nearest rupee" on={!!form.round_off_invoice} onChange={() => toggle('round_off_invoice')} />
          </div>
        </div>
        <SaveRow
          onClick={() => {
            if (form.is_gst_registered && !((form.gstin || '').trim())) {
              toast.error('GSTIN is required when GST-registered');
              return;
            }
            save();
          }}
          disabled={saving || !dirty}
          testid="setg-tax-save"
        />
      </>
    ),

    'booking.online': () => (
      <>
        <SectionHeader title="Online booking" sub="Booking link, QR and slot rules." />
        <div className="block">
          <OptRow label="Online booking" hint="Guests can book via link / QR" on={!!form.online_booking_enabled} onChange={() => toggle('online_booking_enabled')} testid="setg-online-booking" />
          <OptRow
            label="Pause online booking (walk-in only)"
            hint="Salon stays visible online but online booking is stopped and guests see a walk-in message"
            on={!!form.online_booking_paused}
            onChange={() => toggle('online_booking_paused')}
            testid="setg-online-paused"
          />
          {form.online_booking_paused && (
            <div className="field" style={{ marginTop: 10 }}>
              <label>Message shown to guests while paused</label>
              <input
                value={form.online_paused_message || ''}
                placeholder="Salon is open — walk-ins welcome…"
                onChange={(e) => set({ online_paused_message: e.target.value })}
                data-testid="setg-online-paused-msg"
              />
            </div>
          )}
          <OptRow label="Allow guest to choose barber" hint="Show barber selection on booking" on={!!form.allow_guest_choose_barber} onChange={() => toggle('allow_guest_choose_barber')} />
          <OptRow label="Require advance payment" hint="Collect payment at booking" on={!!form.require_advance_payment} onChange={() => toggle('require_advance_payment')} />
          <div className="grid2" style={{ marginTop: 14 }}>
            <div className="field"><label>Default slot duration</label>
              <select value={form.slot_duration_min ?? 30} onChange={(e) => set({ slot_duration_min: Number(e.target.value) })}>
                <option value={15}>15 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option>
              </select></div>
            <div className="field"><label>Buffer between appointments</label>
              <select value={form.buffer_between_appts ?? 0} onChange={(e) => set({ buffer_between_appts: Number(e.target.value) })}>
                <option value={0}>0 min</option><option value={5}>5 min</option><option value={10}>10 min</option>
              </select></div>
            <div className="field"><label>Advance booking window</label>
              <select value={form.advance_booking_days ?? 30} onChange={(e) => set({ advance_booking_days: Number(e.target.value) })}>
                <option value={15}>15 days</option><option value={30}>30 days</option><option value={60}>60 days</option>
              </select></div>
            <div className="field"><label>Cancellation window</label>
              <select value={form.cancellation_window_hours ?? 2} onChange={(e) => set({ cancellation_window_hours: Number(e.target.value) })}>
                <option value={2}>2 hours before</option><option value={4}>4 hours before</option><option value={24}>24 hours before</option>
              </select></div>
          </div>
        </div>
        <SaveRow onClick={() => save()} disabled={saving || !dirty} testid="setg-booking-save" />
      </>
    ),

    'booking.queue': () => (
      <>
        <SectionHeader title="Walk-in queue" sub="Live queue behaviour at the salon." />
        <div className="block">
          <OptRow label="Walk-in queue" hint="Front desk can add walk-ins" on={!!form.walkin_queue_enabled} onChange={() => toggle('walkin_queue_enabled')} />
          <OptRow label="Show live wait time to guests" hint="Publish estimated wait on the QR page" on={!!form.show_live_wait_time} onChange={() => toggle('show_live_wait_time')} />
          <OptRow label="Auto-assign next free barber" hint="Queue picks the first available" on={!!form.auto_assign_next_barber} onChange={() => toggle('auto_assign_next_barber')} />
          <div className="grid2" style={{ marginTop: 14 }}>
            <div className="field"><label>Average service time (min)</label>
              <input type="number" value={form.average_service_time_min ?? 30} onChange={(e) => set({ average_service_time_min: Number(e.target.value) || 0 })} /></div>
            <div className="field"><label>Max queue size</label>
              <input type="number" value={form.max_queue_size ?? 15} onChange={(e) => set({ max_queue_size: Number(e.target.value) || 0 })} /></div>
          </div>
        </div>
        <SaveRow onClick={() => save()} disabled={saving || !dirty} testid="setg-queue-save" />
      </>
    ),

    'payments.gateway': () => (
      <>
        <SectionHeader title="Payment gateway" sub="Online payments and wallet top-ups." />
        <div className="block">
          <div className="list-row">
            <div className="li"><svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
            <div className="ld"><b>Cashfree</b><span>UPI · Cards · Netbanking</span></div>
            <span className={`status-pill ${salon?.cashfree_configured ? 'ok' : ''}`}>{salon?.cashfree_configured ? 'Connected' : 'Not connected'}</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <OptRow label="Test mode" hint="Use sandbox keys" on={!!form.gateway_test_mode} onChange={() => toggle('gateway_test_mode')} />
          </div>
        </div>
        <SaveRow onClick={() => save(['gateway_test_mode'])} disabled={saving || !dirty} testid="setg-gateway-save" />
      </>
    ),

    'payments.counter': () => (
      <>
        <SectionHeader title="Counter methods" sub="Payments accepted at checkout." />
        <div className="block">
          <OptRow label="Cash" hint="Accept cash at counter" on={!!form.counter_cash} onChange={() => toggle('counter_cash')} testid="setg-counter-cash" />
          <OptRow label="UPI" hint="QR / UPI ID at counter" on={!!form.counter_upi} onChange={() => toggle('counter_upi')} />
          <OptRow label="Card" hint="Card machine" on={!!form.counter_card} onChange={() => toggle('counter_card')} />
          <OptRow label="Wallet" hint="Guest prepaid wallet" on={!!form.counter_wallet} onChange={() => toggle('counter_wallet')} />
          <OptRow label="Pay later" hint="Allow unpaid invoices" on={!!form.counter_pay_later} onChange={() => toggle('counter_pay_later')} />
        </div>
        <SaveRow onClick={() => save()} disabled={saving || !dirty} testid="setg-counter-save" />
      </>
    ),

    'payments.wallet': () => (
      <>
        <SectionHeader title="Marketing wallet" sub="Prepaid balance for WhatsApp / SMS / Email." />
        <div className="block">
          <h4>Wallet</h4>
          <p className="bs">Actual-cost billing — first recharge activates marketing.</p>
          <div className="list-row">
            <div className="li"><svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
            <div className="ld"><b>Balance</b><span>{salon?.marketing_wallet_auto_recharge ? `Auto-recharge on · below ₹${salon?.marketing_wallet_recharge_threshold || 200}` : 'Auto-recharge off'}</span></div>
            <span className="tag">₹{Number(salon?.marketing_wallet_balance || 0).toLocaleString('en-IN')}</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn-ghost" onClick={() => toast.info('Open Marketing tab to manage the wallet')}>
              <svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>Open marketing wallet
            </button>
          </div>
        </div>
      </>
    ),

    'notif.guest': () => (
      <>
        <SectionHeader title="Guest messages" sub="Automatic messages to customers." />
        <div className="block">
          <OptRow label="Appointment reminders" hint="WhatsApp 24h + 2h before" on={!!form.notif_appointment_reminders} onChange={() => toggle('notif_appointment_reminders')} />
          <OptRow label="Booking confirmations" hint="On booking & checkout" on={!!form.notif_booking_confirmations} onChange={() => toggle('notif_booking_confirmations')} />
          <OptRow label="Review requests" hint="Sent after checkout" on={!!form.notif_review_requests} onChange={() => toggle('notif_review_requests')} />
          <OptRow label="Birthday & anniversary wishes" hint="With an offer" on={!!form.notif_birthday_wishes} onChange={() => toggle('notif_birthday_wishes')} />
          <OptRow label="Marketing opt-in required" hint="Only message guests who opted in" on={!!form.marketing_optin_required} onChange={() => toggle('marketing_optin_required')} />
        </div>
        <SaveRow onClick={() => save()} disabled={saving || !dirty} testid="setg-notif-guest-save" />
      </>
    ),

    'notif.staffn': () => (
      <>
        <SectionHeader title="Staff & owner alerts" sub="Internal notifications." />
        <div className="block">
          <OptRow label="Daily summary to owner" hint="End-of-day revenue & attendance" on={!!form.notif_daily_summary_owner} onChange={() => toggle('notif_daily_summary_owner')} />
          <OptRow label="Late check-in alert" hint="Notify owner when staff is late" on={!!form.notif_late_checkin_alert} onChange={() => toggle('notif_late_checkin_alert')} />
          <OptRow label="Low stock alert" hint="When inventory hits reorder level" on={!!form.notif_low_stock_alert} onChange={() => toggle('notif_low_stock_alert')} />
          <OptRow label="New booking alert to barber" hint="WhatsApp the assigned barber" on={!!form.notif_new_booking_alert} onChange={() => toggle('notif_new_booking_alert')} />
        </div>
        <SaveRow onClick={() => save()} disabled={saving || !dirty} testid="setg-notif-staff-save" />
      </>
    ),
  };

  const renderContent = () => {
    if (!currentAllowed) return <RbacLock />;
    const key = `${sec}.${sub}`;
    const fn = RENDERERS[key];
    return fn ? fn() : <div className="rbac-lock">Coming soon</div>;
  };

  const filteredNav = useMemo(() => {
    return NAV.map((n) => {
      const allowedSubs = n.subs.filter((s) => permAllowed(s.perm));
      if (allowedSubs.length === 0) return null;
      if (!q) return { ...n, subs: allowedSubs, matched: allowedSubs, groupMatched: true };
      const groupMatch = n.label.toLowerCase().includes(q);
      const matchedSubs = allowedSubs.filter((s) => s.label.toLowerCase().includes(q));
      if (!groupMatch && matchedSubs.length === 0) return null;
      return { ...n, subs: allowedSubs, matched: groupMatch ? allowedSubs : matchedSubs, groupMatched: groupMatch };
    }).filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, salonUser?.userId]);

  const highlight = (text) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return (
      <>{text.slice(0, idx)}<span className="hit">{text.slice(idx, idx + q.length)}</span>{text.slice(idx + q.length)}</>
    );
  };

  return (
    <div className="setv3">
      <div className="phead">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2>
              <span className="hic">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </span>
              Settings
            </h2>
            <p>Single source for every salon configuration.</p>
          </div>
          <SubscriptionBadge salon={salon} />
        </div>
      </div>

      <div className="workspace">
        <div className="pane-l">
          <div className="nav-head">Settings</div>
          <div className="nav-search">
            <div className="nav-search-box">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="search" placeholder="Search settings…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="settings-search-input" />
              {search && (
                <button className="clr" onClick={() => setSearch('')} data-testid="settings-search-clear" aria-label="Clear">
                  <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }}>
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="setnav">
            {q && filteredNav.length === 0 && (
              <div className="no-match" data-testid="settings-search-nomatch">
                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <div>No settings match "{search}"</div>
              </div>
            )}
            {filteredNav.map((n) => {
              const on = q ? true : n.k === sec;
              const firstMatched = n.matched[0] || n.subs[0];
              return (
                <div key={n.k} className={`sgroup ${on ? 'on' : ''}`}>
                  <button className="sn" onClick={() => go(n.k, firstMatched.k)}>
                    <svg className="ic" viewBox="0 0 24 24">{n.ico}</svg>
                    {highlight(n.label)}
                    <svg className="chev" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                  <div className="subnav">
                    {n.subs.map((sc) => {
                      if (q && !n.matched.includes(sc)) return null;
                      return (
                        <button key={sc.k} className={`subitem ${n.k === sec && sub === sc.k ? 'on' : ''}`}
                          onClick={(e) => { e.stopPropagation(); go(n.k, sc.k); }}
                          data-testid={`settings-nav-${n.k}-${sc.k}`}>
                          {highlight(sc.label)}
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
