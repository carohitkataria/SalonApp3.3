/**
 * Appointment drawer for Home v2 — 2-column layout.
 *   LEFT (wider): guest picker, services, products, stylist, schedule fields, billing inputs.
 *   RIGHT (narrower): "Guest details" panel on TOP (3 sections + View full details),
 *     Order details BELOW.
 *
 * Booking modes (Walk-in default):
 *   1. Walk-in queue — add to today's queue.
 *   2. Schedule — future date + SLOT (Morning / Noon / Evening).  NO time input.
 *   3. Direct invoice — walk-out billing.
 *
 * Rules:
 *   • Stylist optional for Walk-in & Schedule modes (mandatory only for Direct
 *     invoice which is a completion/invoicing event). Backend also requires a
 *     stylist to complete/invoice a token, so bookings can be saved without one.
 *   • Schedule mode captures a slot, NOT a specific time.
 *   • Auto-refresh bug guard: reset effect fires only on `open` transitions.
 *     Parent-callback references are held in refs so re-renders never wipe the
 *     form while user is typing.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import CustomerDrawer from './CustomerDrawer';
import GuestProfileModal from './GuestProfileModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CHEV = () => (
  <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
);

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function currentSlot() {
  const h = new Date().getHours();
  if (h < 13) return 'Morning';
  if (h < 17) return 'Noon';
  return 'Evening';
}
function fmtDate(iso, opts = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', opts); } catch { return iso; }
}
const SHIFT_OPTIONS = [
  { id: 'Morning', label: 'Morning', hint: '9 AM – 1 PM' },
  { id: 'Noon',    label: 'Noon',    hint: '1 PM – 5 PM' },
  { id: 'Evening', label: 'Evening', hint: '5 PM – 9 PM' },
];
const PAYMENT_MODES = [
  { id: 'cash', label: 'Cash', ic: (
    <svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v.01M18 14v.01"/></svg>
  ) },
  { id: 'upi',  label: 'UPI', ic: (
    <svg viewBox="0 0 24 24"><path d="M12 2v20M5 9l7-7 7 7M5 15l7 7 7-7"/></svg>
  ) },
  { id: 'card', label: 'Card', ic: (
    <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
  ) },
  { id: 'wallet', label: 'Wallet', ic: (
    <svg viewBox="0 0 24 24"><path d="M20 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6"/><circle cx="17" cy="14" r="1.2"/></svg>
  ) },
];

export default function AppointmentDrawer({
  open, onClose, onSaved, getAuthHeaders, salonId, defaultMode = 'queue',
}) {
  const [services, setServices] = useState([]);
  const [products, setProducts] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [memberships, setMemberships] = useState([]);

  const [mode, setMode] = useState(defaultMode);
  const [customer, setCustomer] = useState(null);
  const [custProfile, setCustProfile] = useState(null);   // fetched full profile
  const [profileOpen, setProfileOpen] = useState(false);  // popup toggle
  const [custSearch, setCustSearch] = useState('');
  const [showSug, setShowSug] = useState(false);
  const [selectedSvc, setSelectedSvc] = useState([]);
  const [category, setCategory] = useState('all');
  const [selectedProd, setSelectedProd] = useState({});
  const [productsOpen, setProductsOpen] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [slot, setSlot] = useState(currentSlot());
  const [couponCode, setCouponCode] = useState('');
  const [discountPct, setDiscountPct] = useState(0);
  const [tip, setTip] = useState(0);
  const [paymentMode, setPaymentMode] = useState('cash');
  // Split-payment (multi-mode) support. Off by default (single mode).
  const [paySplit, setPaySplit] = useState(false);
  // Amounts per mode when split is on: { cash: 0, upi: 0, card: 0, wallet: 0 }.
  // A mode is considered "picked" in split mode when its entry exists (>= 0).
  const [payAmounts, setPayAmounts] = useState({ cash: 0 });
  // Edit-guest drawer (stacked over appointment) — pencil button.
  const [editOpen, setEditOpen] = useState(false);
  // Full-profile drawer (stacked) — "View full details".
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [sellMembershipId, setSellMembershipId] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [subOpen, setSubOpen] = useState(false);

  // Refs so parent re-renders never trigger the reset effect.
  const authRef = useRef(getAuthHeaders);
  const salonRef = useRef(salonId);
  const modeRef = useRef(defaultMode);
  useEffect(() => { authRef.current = getAuthHeaders; }, [getAuthHeaders]);
  useEffect(() => { salonRef.current = salonId; }, [salonId]);
  useEffect(() => { modeRef.current = defaultMode; }, [defaultMode]);

  // Reset + reload ONLY on drawer open. NEVER reset while the user is typing.
  useEffect(() => {
    if (!open) return;
    setMode(modeRef.current || 'queue');
    setCustomer(null); setCustProfile(null); setCustSearch(''); setSelectedSvc([]);
    setSelectedProd({}); setStaffId(''); setDate(todayISO()); setSlot(currentSlot());
    setCouponCode(''); setDiscountPct(0); setTip(0); setPaymentMode('cash');
    setPaySplit(false); setPayAmounts({ cash: 0 });
    setEditOpen(false); setProfileEditOpen(false);
    setSellMembershipId(''); setErrors({}); setCategory('all'); setProductsOpen(false);
    setShowSug(false); setProfileOpen(false);
    (async () => {
      try {
        const headers = authRef.current();
        const sid = salonRef.current;
        const [svcRes, brbRes, custRes, prodRes, memRes] = await Promise.all([
          axios.get(`${API}/salons/${sid}/services/enabled`, { headers }).catch(() => axios.get(`${API}/salons/${sid}/services/all`, { headers })),
          axios.get(`${API}/salons/${sid}/barbers`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/salons/${sid}/customers?limit=2000`, { headers }).catch(() => ({ data: { customers: [] } })),
          axios.get(`${API}/salons/${sid}/inventory`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/salons/${sid}/membership-plans`, { headers }).catch(() => ({ data: [] })),
        ]);
        setServices(Array.isArray(svcRes.data) ? svcRes.data : (svcRes.data?.services || []));
        setBarbers((Array.isArray(brbRes.data) ? brbRes.data : (brbRes.data?.barbers || [])).filter(b => b.is_active !== false));
        setCustomers(Array.isArray(custRes.data) ? custRes.data : (custRes.data?.customers || []));
        setProducts(Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data?.items || []));
        setMemberships(Array.isArray(memRes.data) ? memRes.data : (memRes.data?.plans || []));
      } catch (_) { /* noop */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const categories = useMemo(() => {
    const set = new Set(['all']);
    services.forEach(s => set.add(s.category || 'General'));
    return Array.from(set);
  }, [services]);

  const filteredSvc = useMemo(() => (
    category === 'all' ? services : services.filter(s => (s.category || 'General') === category)
  ), [services, category]);

  const custSuggestions = useMemo(() => {
    const q = custSearch.trim().toLowerCase();
    if (!q) return [];
    return customers.filter(c => (
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q)
    )).slice(0, 8);
  }, [customers, custSearch]);

  const svcSubtotal = useMemo(() => selectedSvc.reduce((t, id) => {
    const s = services.find(x => x.id === id);
    return t + (s ? Number(s.base_price || s.price || 0) : 0);
  }, 0), [selectedSvc, services]);
  const prodSubtotal = useMemo(() => Object.entries(selectedProd).reduce((t, [pid, qty]) => {
    const p = products.find(x => x.id === pid);
    return t + (p && qty > 0 ? Number(p.retail_price || p.selling_price || 0) * Number(qty) : 0);
  }, 0), [selectedProd, products]);
  const subtotal = svcSubtotal + prodSubtotal;
  const discountAmt = Math.round((subtotal * (Number(discountPct) || 0)) / 100);
  const membershipPlan = memberships.find(m => m.id === sellMembershipId);
  const membershipPrice = Number(membershipPlan?.price || 0);
  const grandTotal = Math.max(0, subtotal - discountAmt + Number(tip || 0) + membershipPrice);
  const totalDurationMin = useMemo(() => selectedSvc.reduce((m, id) => {
    const s = services.find(x => x.id === id);
    return m + (s ? Number(s.default_duration || 30) : 0);
  }, 0), [selectedSvc, services]);

  const toggleSvc = (id) => setSelectedSvc(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const setProdQty = (id, qty) => setSelectedProd(prev => {
    const n = { ...prev };
    if (qty <= 0) delete n[id]; else n[id] = qty;
    return n;
  });

  // -------- Split-payment helpers --------
  // In single mode: `paymentMode` selects the one active pill.
  // In split mode: `payAmounts` is the source of truth — a key exists for every picked mode.
  const pickedModes = Object.keys(payAmounts);
  const allocatedTotal = pickedModes.reduce((sum, m) => sum + (Number(payAmounts[m]) || 0), 0);
  const dueRemaining = Math.max(0, Math.round((grandTotal - allocatedTotal) * 100) / 100);

  const enableSplit = () => {
    setPaySplit(true);
    // Seed with the currently-selected single mode carrying the full total.
    setPayAmounts({ [paymentMode]: grandTotal });
  };
  const disableSplit = () => {
    setPaySplit(false);
    // Keep the first picked mode as the new single mode (fallback to cash).
    const first = pickedModes[0] || 'cash';
    setPaymentMode(first);
    setPayAmounts({ [first]: 0 });
  };
  const togglePickedMode = (id) => {
    setPayAmounts(prev => {
      const n = { ...prev };
      if (id in n) {
        // Prevent deselecting the last mode — always keep at least one.
        if (Object.keys(n).length === 1) return n;
        delete n[id];
      } else {
        // New mode gets the current remaining due (rounded).
        n[id] = Math.max(0, Math.round((grandTotal - allocatedTotal) * 100) / 100);
      }
      return n;
    });
  };
  const setPickedAmount = (id, val) => {
    const num = val === '' || val === null || val === undefined ? 0 : Number(val);
    setPayAmounts(prev => ({ ...prev, [id]: isNaN(num) ? 0 : Math.max(0, num) }));
  };
  const applyRemainingTo = (id) => {
    setPayAmounts(prev => {
      const others = Object.entries(prev).reduce((s, [k, v]) => k === id ? s : s + (Number(v) || 0), 0);
      const rem = Math.max(0, Math.round((grandTotal - others) * 100) / 100);
      return { ...prev, [id]: rem };
    });
  };

  const allocState = paySplit ? (
    Math.abs(allocatedTotal - grandTotal) < 0.5 ? 'ok'
      : allocatedTotal > grandTotal ? 'over'
      : 'under'
  ) : 'ok';

  // Fetch full profile every time a customer is chosen so the right panel is rich.
  const fetchProfile = async (phone) => {
    if (!phone) { setCustProfile(null); return; }
    try {
      const res = await axios.get(
        `${API}/salons/${salonRef.current}/customers/profile?phone=${encodeURIComponent(phone)}`,
        { headers: authRef.current() },
      );
      setCustProfile(res.data || null);
    } catch (_) { setCustProfile(null); }
  };

  const chooseCustomer = (c) => {
    setCustomer(c); setCustSearch(c.name || c.phone || ''); setShowSug(false);
    if (c.preferred_barber_id && !staffId) setStaffId(c.preferred_barber_id);
    setErrors(e => ({ ...e, customer: null }));
    fetchProfile(c.phone);
  };

  const stylistRequired = mode === 'direct'; // mandatory only at invoicing
  const modeLabel = mode === 'schedule' ? 'Book appointment' : mode === 'queue' ? 'Add to queue' : 'Create invoice';

  const save = async () => {
    const errs = {};
    if (!customer) errs.customer = 'Select a guest';
    if (!selectedSvc.length && !Object.keys(selectedProd).length) errs.svc = 'Pick at least one service or product';
    if (stylistRequired && !staffId) errs.staff = 'Stylist is mandatory to create an invoice';
    if (mode === 'schedule' && (!date || !slot)) errs.date = 'Date and slot required';
    if (paySplit && grandTotal > 0 && Math.abs(allocatedTotal - grandTotal) >= 0.5) {
      errs.payment = allocatedTotal > grandTotal
        ? `Over-allocated by ₹${(allocatedTotal - grandTotal).toFixed(2)}`
        : `Short by ₹${(grandTotal - allocatedTotal).toFixed(2)}`;
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const headers = authRef.current();
      const sid = salonRef.current;
      const products_payload = Object.entries(selectedProd).map(([pid, qty]) => {
        const p = products.find(x => x.id === pid);
        return { product_id: pid, name: p?.product_name || p?.name, qty: Number(qty), unit_price: Number(p?.retail_price || p?.selling_price || 0) };
      });

      // Payment payload — single mode by default, split when the operator opts in.
      const paymentPayload = paySplit
        ? {
            payment_mode: 'split',
            cash_amount: Number(payAmounts.cash || 0),
            upi_amount: Number(payAmounts.upi || 0),
            wallet_amount: Number(payAmounts.wallet || 0),
            card_amount: Number(payAmounts.card || 0),
            payments: Object.entries(payAmounts)
              .filter(([, v]) => Number(v) > 0)
              .map(([mode, amount]) => ({ mode, amount: Number(amount) })),
          }
        : { payment_mode: paymentMode };

      if (mode === 'direct') {
        await axios.post(`${API}/salons/${sid}/direct-invoice`, {
          customer_name: customer.name, phone: customer.phone, gender: customer.gender || 'Men',
          barber_id: staffId, selected_services: selectedSvc, selected_products: products_payload,
          ...paymentPayload,
          coupon_code: couponCode || null,
          discount_percent: Number(discountPct) || 0, membership_plan_id: sellMembershipId || null,
          tip_amount: Number(tip) || 0, source: 'direct',
        }, { headers });
      } else {
        // Booking / Queue — stylist optional, slot-based scheduling
        await axios.post(`${API}/salons/${sid}/salon-booking`, {
          customer_name: customer.name, phone: customer.phone, gender: customer.gender || 'Men',
          barber_id: staffId || 'any',
          selected_services: selectedSvc,
          selected_products: products_payload,
          shift: mode === 'schedule' ? slot : currentSlot(),
          date: mode === 'schedule' ? date : todayISO(),
          start_time: null, // slot-based; no fixed time
          ...paymentPayload,
          coupon_code: couponCode || null,
          discount_percent: Number(discountPct) || 0,
          membership_plan_id: sellMembershipId || null,
          tip_amount: Number(tip) || 0,
          source: mode === 'queue' ? 'qr' : 'owner',
          booking_type: mode,
        }, { headers });
      }
      onSaved?.({ mode, total: grandTotal });
      onClose?.();
    } catch (e) {
      const raw = e?.response?.data?.detail;
      let msg = 'Save failed';
      if (typeof raw === 'string') msg = raw;
      else if (Array.isArray(raw)) msg = raw.map(x => x?.msg || 'Invalid value').join(', ');
      else if (raw && typeof raw === 'object') msg = raw.msg || 'Save failed';
      setErrors({ save: msg });
    } finally { setSaving(false); }
  };

  // Right-side order details rows
  const svcRows = selectedSvc.map(id => services.find(x => x.id === id)).filter(Boolean);
  const prodRows = Object.entries(selectedProd).map(([pid, qty]) => ({ p: products.find(x => x.id === pid), qty })).filter(r => r.p);

  // Guest details for the right panel (populated on customer select)
  const gd = custProfile || {};
  const preferredBarberName = (barbers.find(b => b.id === gd.preferred_barber_id) || {}).name;
  const membershipLine = gd.membership_active ? (gd.membership_name || 'Active') : 'No membership';

  return ReactDOM.createPortal(
    <>
      <div className={`shv2-overlay ${open ? 'open' : ''}`} onClick={onClose} style={{ zIndex: 9060 }} />
      <aside className={`shv2-drawer ${open ? 'open' : ''}`} style={{ zIndex: 9070 }}>
        <div className="drawer__h">
          <div className="tt">
            <div className="ic">
              <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div>
              <h3>New Appointment</h3>
              <p>Schedule, queue or bill a guest · {barbers.length} stylists available</p>
            </div>
          </div>
          <button className="drawer__close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="book-split">
          {/* ================= LEFT — form details ================= */}
          <div className="book-left">
            {/* Booking type */}
            <div className="fs-title">Booking type</div>
            <div className="mode-pick">
              <button className={`mode ${mode === 'queue' ? 'on' : ''}`} onClick={() => setMode('queue')}>
                <div className="mi"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
                <div><b>Walk-in</b><span>Add to queue now</span></div>
              </button>
              <button className={`mode ${mode === 'schedule' ? 'on' : ''}`} onClick={() => setMode('schedule')}>
                <div className="mi"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
                <div><b>Schedule</b><span>Future date &amp; slot</span></div>
              </button>
              <button className={`mode ${mode === 'direct' ? 'on' : ''}`} onClick={() => setMode('direct')}>
                <div className="mi"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div>
                <div><b>Direct invoice</b><span>Walk-out billing</span></div>
              </button>
            </div>

            {/* Guest */}
            <div className="field full" style={{ marginBottom: 14 }}>
              <label>
                <span>Guest <span className="req">*</span></span>
                <button className="inline-add" onClick={() => {
                  // Duplicate-detection guard: if the user typed a phone that
                  // matches an existing guest, auto-select instead of showing
                  // "New Guest". This spares walk-in staff the New-Guest step
                  // for a returning customer.
                  const digits = (custSearch || '').replace(/\D/g, '');
                  if (digits.length >= 10) {
                    const key = digits.slice(-10);
                    const match = customers.find(c => (c.phone || '').replace(/\D/g, '').endsWith(key));
                    if (match) { chooseCustomer(match); return; }
                  }
                  setSubOpen(true);
                }}>+ New guest</button>
              </label>
              <input className={errors.customer ? 'err' : ''}
                     value={custSearch}
                     onChange={(e) => {
                       const v = e.target.value;
                       setCustSearch(v);
                       setShowSug(true);
                       setCustomer(null);
                       setCustProfile(null);
                       // Duplicate-detection: when the user types (or pastes) a
                       // full 10-digit phone number and it matches EXACTLY one
                       // existing guest, auto-select them so the New-Guest step
                       // is skipped and their name auto-fills.
                       const digits = (v || '').replace(/\D/g, '');
                       if (digits.length >= 10) {
                         const key = digits.slice(-10);
                         const match = customers.find(c => (c.phone || '').replace(/\D/g, '').endsWith(key));
                         if (match) {
                           chooseCustomer(match);
                         }
                       }
                     }}
                     onFocus={() => setShowSug(true)}
                     placeholder="Search by name or phone" />
              {showSug && custSuggestions.length > 0 && (
                <div className="autosug">
                  {custSuggestions.map(c => (
                    <button key={c.id || c.phone} onClick={() => chooseCustomer(c)}>
                      <b>{c.name || 'Unknown'}</b><span>{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              {errors.customer && <span className="msg show">{errors.customer}</span>}
            </div>

            {/* Services */}
            <div className="fs-title">Services <span style={{ color: '#E45C86' }}>*</span></div>
            <div className="svc-cat">
              {categories.map(c => (
                <button key={c} className={category === c ? 'on' : ''} onClick={() => setCategory(c)}>
                  {c === 'all' ? 'All' : c}
                </button>
              ))}
            </div>
            <div className="svc-chips">
              {filteredSvc.length === 0 && <div style={{ color: '#7C8092', fontSize: 12 }}>No services yet.</div>}
              {filteredSvc.map(s => {
                const on = selectedSvc.includes(s.id);
                return (
                  <button key={s.id} className={`svc-chip ${on ? 'on' : ''}`} onClick={() => toggleSvc(s.id)}>
                    <div className="cn">{s.service_name}<span className="rm">×</span></div>
                    <div className="pr">₹{Number(s.base_price || 0).toLocaleString('en-IN')} · <span className="dur">{s.default_duration || 30}m</span></div>
                  </button>
                );
              })}
            </div>
            {errors.svc && <span className="msg show" style={{ display: 'block', marginTop: 6 }}>{errors.svc}</span>}

            {/* Products — collapsible */}
            <div className={`coll ${productsOpen ? 'open' : ''}`} style={{ marginTop: 18 }}>
              <div className="coll__h" onClick={() => setProductsOpen(v => !v)}>
                <span>Products {Object.keys(selectedProd).length > 0 ? `· ${Object.keys(selectedProd).length} added` : ''}</span>
                <CHEV />
              </div>
              <div className="coll__b">
                {products.length === 0 && <div style={{ color: '#7C8092', fontSize: 12 }}>No products in inventory yet.</div>}
                {products.slice(0, 20).map(p => {
                  const qty = selectedProd[p.id] || 0;
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #F3F3F8' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.product_name || p.name}</div>
                        <div style={{ fontSize: 11, color: '#7C8092', fontWeight: 600 }}>₹{Number(p.retail_price || p.selling_price || 0).toLocaleString('en-IN')} · Stock: {p.stock_quantity ?? '—'}</div>
                      </div>
                      <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => setProdQty(p.id, Math.max(0, qty - 1))}>−</button>
                      <div style={{ minWidth: 22, textAlign: 'center', fontWeight: 800 }}>{qty}</div>
                      <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => setProdQty(p.id, qty + 1)}>+</button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stylist + date/slot */}
            <div className="grid2" style={{ marginTop: 12 }}>
              <div className="field">
                <label>Stylist {stylistRequired && <span className="req">*</span>}</label>
                <select value={staffId} onChange={e => { setStaffId(e.target.value); setErrors(er => ({ ...er, staff: null })); }} className={errors.staff ? 'err' : ''}>
                  <option value="">{stylistRequired ? 'Select stylist…' : 'Auto-assign / decide later'}</option>
                  {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                {errors.staff && <span className="msg show">{errors.staff}</span>}
              </div>
              {mode === 'schedule' && (
                <>
                  <div className="field">
                    <label>Date <span className="req">*</span></label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} />
                  </div>
                  <div className="field full">
                    <label>Slot <span className="req">*</span></label>
                    <div className="seg-pick">
                      {SHIFT_OPTIONS.map(s => (
                        <button key={s.id} type="button" className={slot === s.id ? 'on' : ''}
                                onClick={() => setSlot(s.id)}>
                          <b style={{ display: 'block', fontSize: 12 }}>{s.label}</b>
                          <span style={{ display: 'block', fontSize: 10, opacity: 0.75, fontWeight: 600 }}>{s.hint}</span>
                        </button>
                      ))}
                    </div>
                    {errors.date && <span className="msg show">{errors.date}</span>}
                  </div>
                </>
              )}
            </div>

            {/* Billing inputs */}
            <div className="fs-title" style={{ marginTop: 6 }}>Billing</div>
            <div className="grid2">
              <div className="field">
                <label>Coupon code</label>
                <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} />
              </div>
              <div className="field">
                <label>Discount %</label>
                <input type="number" min="0" max="100" value={discountPct} onChange={e => setDiscountPct(e.target.value)} />
              </div>
              <div className="field">
                <label>Tip amount</label>
                <input type="number" min="0" value={tip} onChange={e => setTip(e.target.value)} />
              </div>
              <div className="field full">
                <div className="pay-head">
                  <label style={{ marginBottom: 0 }}>Payment mode</label>
                  {!paySplit ? (
                    <button type="button" className="pay-split-toggle" onClick={enableSplit}
                            data-testid="pay-split-enable"
                            title="Split the amount across multiple modes">
                      <svg viewBox="0 0 24 24"><line x1="12" y1="3" x2="12" y2="21"/><polyline points="8 7 12 3 16 7"/><polyline points="8 17 12 21 16 17"/></svg>
                      Split
                    </button>
                  ) : (
                    <button type="button" className="pay-split-toggle on" onClick={disableSplit}
                            data-testid="pay-split-disable"
                            title="Switch back to single-mode payment">
                      <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      Single
                    </button>
                  )}
                </div>
                <div className="pay-chips" role="radiogroup" aria-label="Payment mode">
                  {PAYMENT_MODES.map(p => {
                    const active = paySplit ? (p.id in payAmounts) : paymentMode === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role={paySplit ? 'checkbox' : 'radio'}
                        aria-checked={active}
                        data-testid={`pay-mode-${p.id}`}
                        className={`pay-chip ${active ? 'on' : ''}`}
                        onClick={() => paySplit ? togglePickedMode(p.id) : setPaymentMode(p.id)}
                      >
                        <span className="pc-ic">{p.ic}</span>
                        <span className="pc-lb">{p.label}</span>
                      </button>
                    );
                  })}
                </div>
                {paySplit && (
                  <div className="pay-split">
                    {pickedModes.map(pm => {
                      const meta = PAYMENT_MODES.find(m => m.id === pm);
                      return (
                        <div key={pm} className="pay-line">
                          <span className="pl-lb">
                            <span className="pl-ic">{meta?.ic}</span>
                            {meta?.label || pm}
                          </span>
                          <div className="pl-amt">
                            <span className="cur">₹</span>
                            <input
                              type="number"
                              min="0"
                              inputMode="decimal"
                              value={payAmounts[pm] ?? 0}
                              onChange={(e) => setPickedAmount(pm, e.target.value)}
                              data-testid={`pay-amount-${pm}`}
                            />
                          </div>
                          <button type="button" className="pl-rem" onClick={() => applyRemainingTo(pm)}
                                  title="Fill remaining amount">= due</button>
                        </div>
                      );
                    })}
                    <div className={`pay-meta ${allocState}`}>
                      Allocated <b>₹{allocatedTotal.toLocaleString('en-IN')}</b> of ₹{grandTotal.toLocaleString('en-IN')}
                      {allocState === 'ok' && <span> · Fully allocated</span>}
                      {allocState === 'under' && <span> · ₹{dueRemaining.toLocaleString('en-IN')} remaining</span>}
                      {allocState === 'over' && <span> · Over by ₹{(allocatedTotal - grandTotal).toLocaleString('en-IN')}</span>}
                    </div>
                    {errors.payment && <span className="msg show">{errors.payment}</span>}
                  </div>
                )}
              </div>
              <div className="field full">
                <label>Sell membership</label>
                <select value={sellMembershipId} onChange={e => setSellMembershipId(e.target.value)}>
                  <option value="">— None —</option>
                  {memberships.map(m => <option key={m.id} value={m.id}>{m.name} · ₹{Number(m.price || 0).toLocaleString('en-IN')}</option>)}
                </select>
              </div>
            </div>
            {errors.save && <div style={{ marginTop: 10, color: '#E45C86', fontSize: 12.5, fontWeight: 700 }}>{errors.save}</div>}
          </div>

          {/* ================= RIGHT — guest details (top) + order details (below) ================= */}
          <div className="book-right">
            {/* --- Guest details panel --- */}
            <div className="gd-card">
              <div className="gd-h">
                <b>Guest details</b>
                {customer && (
                  <div className="gd-acts">
                    <button className="gd-edit" onClick={() => setEditOpen(true)}
                            data-testid="gd-edit-btn" title="Edit guest details" aria-label="Edit guest">
                      <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                    </button>
                    <button className="gd-full" onClick={() => setProfileOpen(true)}
                            data-testid="gd-view-full-btn">View full details</button>
                  </div>
                )}
              </div>

              {!customer && (
                <div className="gd-empty">Select a guest to see their details.</div>
              )}

              {customer && (
                <>
                  {/* Section 1 — identity */}
                  <div className="gd-sec">
                    <div className="gd-row">
                      <span className="k">Name</span>
                      <span className="v">{gd.name || customer.name || '—'}</span>
                    </div>
                    <div className="gd-row">
                      <span className="k">Contact</span>
                      <span className="v">{gd.phone || customer.phone || '—'}</span>
                    </div>
                    <div className="gd-row">
                      <span className="k">DOB</span>
                      <span className="v">{fmtDate(gd.dob)}</span>
                    </div>
                    <div className="gd-row">
                      <span className="k">Anniversary</span>
                      <span className="v">{fmtDate(gd.anniversary)}</span>
                    </div>
                  </div>

                  {/* Section 2 — visit history summary */}
                  <div className="gd-sec">
                    <div className="gd-row">
                      <span className="k">Last visit</span>
                      <span className="v">{fmtDate(gd.last_visit)}</span>
                    </div>
                    <div className="gd-row">
                      <span className="k">Last barber</span>
                      <span className="v">{gd.last_barber_name || '—'}</span>
                    </div>
                    <div className="gd-row">
                      <span className="k">Last invoice</span>
                      <span className="v">{gd.last_invoice_amount != null ? `₹${Number(gd.last_invoice_amount).toLocaleString('en-IN')}` : '—'}</span>
                    </div>
                  </div>

                  {/* Section 3 — membership + wallet */}
                  <div className="gd-sec">
                    <div className="gd-row">
                      <span className="k">Membership</span>
                      <span className="v" style={{ color: gd.membership_active ? '#6C4FE0' : '#7C8092' }}>{membershipLine}</span>
                    </div>
                    <div className="gd-row">
                      <span className="k">Wallet</span>
                      <span className="v" style={{ color: '#12A594' }}>₹{Number(gd.wallet_balance || 0).toLocaleString('en-IN')}</span>
                    </div>
                    {preferredBarberName && (
                      <div className="gd-row">
                        <span className="k">Preferred</span>
                        <span className="v">{preferredBarberName}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* --- Order details (unchanged size, moved below) --- */}
            <div className="os">
              <div className="os__h">
                <b>Order details</b>
                <span className="who">{customer ? customer.name : '— No guest —'}</span>
              </div>

              <div className="os-sec" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
                <div className="lb">Services · {svcRows.length}</div>
                {svcRows.length === 0 && <div className="os-empty">No services picked</div>}
                {svcRows.map(s => (
                  <div key={s.id} className="os-line">
                    <div className="n">{s.service_name}</div>
                    <div className="p">₹{Number(s.base_price || 0).toLocaleString('en-IN')}</div>
                  </div>
                ))}
              </div>

              {prodRows.length > 0 && (
                <div className="os-sec">
                  <div className="lb">Products · {prodRows.length}</div>
                  {prodRows.map(({ p, qty }) => (
                    <div key={p.id} className="os-line">
                      <div className="n">{p.product_name || p.name} × {qty}</div>
                      <div className="p">₹{(Number(p.retail_price || p.selling_price || 0) * qty).toLocaleString('en-IN')}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="os-sec">
                <div className="os-line"><div className="n">Subtotal</div><div className="p">₹{subtotal.toLocaleString('en-IN')}</div></div>
                {discountAmt > 0 && (
                  <div className="os-line"><div className="n">Discount ({discountPct}%)</div><div className="p" style={{ color: '#2FA96A' }}>− ₹{discountAmt.toLocaleString('en-IN')}</div></div>
                )}
                {Number(tip) > 0 && (
                  <div className="os-line"><div className="n">Tip</div><div className="p">+ ₹{Number(tip).toLocaleString('en-IN')}</div></div>
                )}
                {membershipPrice > 0 && (
                  <div className="os-line"><div className="n">Membership</div><div className="p">+ ₹{membershipPrice.toLocaleString('en-IN')}</div></div>
                )}
              </div>

              <div className="os-tot">
                <div className="lb">Grand total</div>
                <div className="val">₹{grandTotal.toLocaleString('en-IN')}</div>
              </div>

              <div className="os-hint">
                {mode === 'queue' && <>Guest will be added to today's queue.</>}
                {mode === 'schedule' && <>Booked for <b>{date}</b> · <b>{slot}</b> slot.</>}
                {mode === 'direct' && <>Invoice will be created immediately.</>}
              </div>
            </div>
          </div>
        </div>

        <div className="drawer__f">
          <span className="hint">Duration: {totalDurationMin} min · {selectedSvc.length} services</span>
          <div className="acts">
            <button className="btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : `${modeLabel} · ₹${grandTotal.toLocaleString('en-IN')}`}
            </button>
          </div>
        </div>
      </aside>

      {/* Stacked customer sub-drawer (add new guest) */}
      <CustomerDrawer
        open={subOpen}
        stacked
        onClose={() => setSubOpen(false)}
        salonId={salonId}
        getAuthHeaders={getAuthHeaders}
        presetName={custSearch}
        source="owner"
        onSaved={(c) => {
          setCustomers(prev => [c, ...prev]);
          chooseCustomer({ id: c.id, name: c.name, phone: c.phone, gender: c.gender, preferred_barber_id: c.preferred_barber_id });
        }}
      />

      {/* Stacked EDIT-guest drawer (pencil button on Guest details) */}
      <CustomerDrawer
        open={editOpen}
        stacked
        onClose={() => setEditOpen(false)}
        salonId={salonId}
        getAuthHeaders={getAuthHeaders}
        source="owner"
        initial={customer ? {
          ...customer,
          ...(custProfile || {}),
          name: (custProfile?.name || customer.name || ''),
          phone: (custProfile?.phone || customer.phone || ''),
        } : null}
        onSaved={(c) => {
          setCustomers(prev => {
            const idx = prev.findIndex(x => (x.phone || '') === (c.phone || ''));
            if (idx >= 0) { const n = [...prev]; n[idx] = { ...prev[idx], ...c }; return n; }
            return [c, ...prev];
          });
          chooseCustomer({ id: c.id, name: c.name, phone: c.phone, gender: c.gender, preferred_barber_id: c.preferred_barber_id });
        }}
      />

      {/* Full guest details — now a stacked drawer over the appointment drawer */}
      <GuestProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        phone={customer?.phone}
        salonId={salonId}
        getAuthHeaders={getAuthHeaders}
        onEdit={() => { setProfileOpen(false); setEditOpen(true); }}
      />
    </>,
    document.body
  );
}
