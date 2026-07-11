/**
 * Appointment drawer for Home v2 — 2-column layout.
 *   LEFT (wider): guest picker, services, products, stylist, schedule fields, billing inputs.
 *   RIGHT (narrower, sticky): "Order details" sidebar with selected services/products,
 *     discounts, tip, membership, grand total.
 *
 * Booking modes (Walk-in default per user override):
 *   1. Walk-in queue — add to today's queue.
 *   2. Schedule — future date+time. Auto-selects today + current 15-min slot.
 *   3. Direct invoice — walk-out billing.
 *
 * Rules:
 *   • Services in chips with category filter (open).
 *   • Products in a collapsible section.
 *   • Stylist NOT auto-selected; save blocked with clear error until picked.
 *   • Custom-tag safe: new guest sub-drawer stacks on top with smooth close.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import CustomerDrawer from './CustomerDrawer';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CHEV = () => (
  <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
);

function nowTimeHHMM() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(Math.floor(d.getMinutes() / 15) * 15).padStart(2, '0');
  return `${h}:${m}`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function buildTimeSlots() {
  const out = [];
  for (let h = 8; h < 22; h++) {
    for (let m = 0; m < 60; m += 15) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return out;
}
const PAYMENT_MODES = [
  { id: 'cash', label: 'Cash' },
  { id: 'upi',  label: 'UPI' },
  { id: 'card', label: 'Card' },
  { id: 'wallet', label: 'Wallet' },
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
  const [custSearch, setCustSearch] = useState('');
  const [showSug, setShowSug] = useState(false);
  const [selectedSvc, setSelectedSvc] = useState([]);
  const [category, setCategory] = useState('all');
  const [selectedProd, setSelectedProd] = useState({});
  const [productsOpen, setProductsOpen] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(nowTimeHHMM());
  const [couponCode, setCouponCode] = useState('');
  const [discountPct, setDiscountPct] = useState(0);
  const [tip, setTip] = useState(0);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [sellMembershipId, setSellMembershipId] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [subOpen, setSubOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(defaultMode);
    setCustomer(null); setCustSearch(''); setSelectedSvc([]);
    setSelectedProd({}); setStaffId(''); setDate(todayISO()); setTime(nowTimeHHMM());
    setCouponCode(''); setDiscountPct(0); setTip(0); setPaymentMode('cash');
    setSellMembershipId(''); setErrors({}); setCategory('all'); setProductsOpen(false);
    (async () => {
      try {
        const headers = getAuthHeaders();
        const [svcRes, brbRes, custRes, prodRes, memRes] = await Promise.all([
          axios.get(`${API}/salons/${salonId}/services/enabled`, { headers }).catch(() => axios.get(`${API}/salons/${salonId}/services/all`, { headers })),
          axios.get(`${API}/salons/${salonId}/barbers`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/salons/${salonId}/customers?limit=2000`, { headers }).catch(() => ({ data: { customers: [] } })),
          axios.get(`${API}/salons/${salonId}/inventory`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/salons/${salonId}/membership-plans`, { headers }).catch(() => ({ data: [] })),
        ]);
        setServices(Array.isArray(svcRes.data) ? svcRes.data : (svcRes.data?.services || []));
        setBarbers((Array.isArray(brbRes.data) ? brbRes.data : (brbRes.data?.barbers || [])).filter(b => b.is_active !== false));
        setCustomers(Array.isArray(custRes.data) ? custRes.data : (custRes.data?.customers || []));
        setProducts(Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data?.items || []));
        setMemberships(Array.isArray(memRes.data) ? memRes.data : (memRes.data?.plans || []));
      } catch (_) { /* noop */ }
    })();
  }, [open, defaultMode, salonId, getAuthHeaders]);

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

  const chooseCustomer = (c) => {
    setCustomer(c); setCustSearch(c.name || c.phone || ''); setShowSug(false);
    // If guest has a preferred barber saved, gently pre-hint it
    if (c.preferred_barber_id && !staffId) setStaffId(c.preferred_barber_id);
    setErrors(e => ({ ...e, customer: null }));
  };

  const modeLabel = mode === 'schedule' ? 'Book appointment' : mode === 'queue' ? 'Add to queue' : 'Create invoice';

  const save = async () => {
    const errs = {};
    if (!customer) errs.customer = 'Select a guest';
    if (!selectedSvc.length && !Object.keys(selectedProd).length) errs.svc = 'Pick at least one service or product';
    if (!staffId) errs.staff = 'Assign a stylist (mandatory)';
    if (mode === 'schedule' && (!date || !time)) errs.date = 'Date and time required';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const headers = getAuthHeaders();
      const products_payload = Object.entries(selectedProd).map(([pid, qty]) => {
        const p = products.find(x => x.id === pid);
        return { product_id: pid, name: p?.product_name || p?.name, qty: Number(qty), unit_price: Number(p?.retail_price || p?.selling_price || 0) };
      });
      const shift = time < '12:00' ? 'Morning' : (time < '16:00' ? 'Noon' : 'Evening');

      if (mode === 'direct') {
        await axios.post(`${API}/salons/${salonId}/direct-invoice`, {
          customer_name: customer.name, phone: customer.phone, gender: customer.gender || 'Men',
          barber_id: staffId, selected_services: selectedSvc, selected_products: products_payload,
          payment_mode: paymentMode, coupon_code: couponCode || null,
          discount_percent: Number(discountPct) || 0, membership_plan_id: sellMembershipId || null,
          tip_amount: Number(tip) || 0, source: 'direct',
        }, { headers });
      } else {
        await axios.post(`${API}/salons/${salonId}/salon-booking`, {
          customer_name: customer.name, phone: customer.phone, gender: customer.gender || 'Men',
          barber_id: staffId, selected_services: selectedSvc, selected_products: products_payload,
          shift, date: mode === 'schedule' ? date : todayISO(),
          start_time: mode === 'schedule' ? time : null,
          payment_mode: paymentMode, coupon_code: couponCode || null,
          discount_percent: Number(discountPct) || 0, membership_plan_id: sellMembershipId || null,
          tip_amount: Number(tip) || 0,
          source: mode === 'queue' ? 'qr' : 'owner',
          booking_type: mode,
        }, { headers });
      }
      onSaved?.({ mode, total: grandTotal });
      onClose?.();
    } catch (e) {
      const detail = e?.response?.data?.detail || 'Save failed';
      setErrors({ save: typeof detail === 'string' ? detail : 'Save failed' });
    } finally { setSaving(false); }
  };

  // Right-side order details rows
  const svcRows = selectedSvc.map(id => services.find(x => x.id === id)).filter(Boolean);
  const prodRows = Object.entries(selectedProd).map(([pid, qty]) => ({ p: products.find(x => x.id === pid), qty })).filter(r => r.p);

  return (
    <>
      <div className={`shv2-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`shv2-drawer ${open ? 'open' : ''}`}>
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
            {/* Booking type — smaller chips, Walk-in default */}
            <div className="fs-title">Booking type</div>
            <div className="mode-pick">
              <button className={`mode ${mode === 'queue' ? 'on' : ''}`} onClick={() => setMode('queue')}>
                <div className="mi"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
                <div><b>Walk-in</b><span>Add to queue now</span></div>
              </button>
              <button className={`mode ${mode === 'schedule' ? 'on' : ''}`} onClick={() => setMode('schedule')}>
                <div className="mi"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
                <div><b>Schedule</b><span>Future date & time</span></div>
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
                <button className="inline-add" onClick={() => setSubOpen(true)}>+ New guest</button>
              </label>
              <input className={errors.customer ? 'err' : ''}
                     value={custSearch}
                     onChange={(e) => { setCustSearch(e.target.value); setShowSug(true); setCustomer(null); }}
                     onFocus={() => setShowSug(true)}
                     placeholder="Search by name or phone…" />
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

            {/* Stylist + date/time */}
            <div className="grid2" style={{ marginTop: 12 }}>
              <div className="field">
                <label>Stylist <span className="req">*</span></label>
                <select value={staffId} onChange={e => { setStaffId(e.target.value); setErrors(er => ({ ...er, staff: null })); }} className={errors.staff ? 'err' : ''}>
                  <option value="">Select stylist…</option>
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
                  <div className="field">
                    <label>Start time <span className="req">*</span></label>
                    <select value={time} onChange={e => setTime(e.target.value)}>
                      {buildTimeSlots().map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Billing inputs */}
            <div className="fs-title" style={{ marginTop: 6 }}>Billing</div>
            <div className="grid2">
              <div className="field">
                <label>Coupon code</label>
                <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder="WELCOME10" />
              </div>
              <div className="field">
                <label>Discount %</label>
                <input type="number" min="0" max="100" value={discountPct} onChange={e => setDiscountPct(e.target.value)} placeholder="0" />
              </div>
              <div className="field">
                <label>Tip amount</label>
                <input type="number" min="0" value={tip} onChange={e => setTip(e.target.value)} placeholder="0" />
              </div>
              <div className="field">
                <label>Payment mode</label>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                  {PAYMENT_MODES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div className="field full">
                <label>Sell membership (optional)</label>
                <select value={sellMembershipId} onChange={e => setSellMembershipId(e.target.value)}>
                  <option value="">— None —</option>
                  {memberships.map(m => <option key={m.id} value={m.id}>{m.name} · ₹{Number(m.price || 0).toLocaleString('en-IN')}</option>)}
                </select>
              </div>
            </div>
            {errors.save && <div style={{ marginTop: 10, color: '#E45C86', fontSize: 12.5, fontWeight: 700 }}>{errors.save}</div>}
          </div>

          {/* ================= RIGHT — sticky order details ================= */}
          <div className="book-right">
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
                {mode === 'schedule' && <>Booked for <b>{date}</b> at <b>{time}</b>.</>}
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

      {/* Stacked customer sub-drawer */}
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
    </>
  );
}
