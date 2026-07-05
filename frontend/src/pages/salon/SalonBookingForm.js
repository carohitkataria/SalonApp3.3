/**
 * SalonBookingForm.js — Shared form UI for both:
 *   - New Booking (POST /api/salons/{salonId}/salon-booking)
 *   - Quick Invoice (POST /api/salons/{salonId}/direct-invoice)
 *
 * Presents services as chips (grouped by category), and includes coupon +
 * membership upsell + wallet payment.
 */
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  User, Phone, ArrowLeft, Scissors, Wallet, CreditCard,
  Banknote, Smartphone, Search, TicketPercent, BadgeCheck, X, Loader2, Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSalonAuthHeaders, getSalonId } from './salonAuthHelper';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PAYMENT_MODES = [
  { id: 'cash', label: 'Cash', icon: Banknote, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/40' },
  { id: 'upi', label: 'UPI', icon: Smartphone, color: 'text-blue-500 bg-blue-500/10 border-blue-500/40' },
  { id: 'card', label: 'Card', icon: CreditCard, color: 'text-purple-500 bg-purple-500/10 border-purple-500/40' },
  { id: 'wallet', label: 'Wallet', icon: Wallet, color: 'text-amber-500 bg-amber-500/10 border-amber-500/40' },
];

export default function SalonBookingForm({
  mode = 'booking',              // 'booking' | 'invoice'
  onSubmitted,                   // callback(response)
  submitLabel = 'Create Booking',
  pageTitle = 'New Booking',
  pageSubtitle = 'Fill in customer + services to create a booking',
  headerAccent = 'gold',
}) {
  const navigate = useNavigate();
  const salonId = getSalonId();

  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [membershipPlans, setMembershipPlans] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [form, setForm] = useState({
    customer_name: '',
    phone: '',
    gender: 'Men',
    barber_id: 'any',
    selected_services: [],
    payment_mode: 'cash',
  });

  const [walletInfo, setWalletInfo] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponInfo, setCouponInfo] = useState(null); // { discount_amount, coupon }
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [selectedMembershipId, setSelectedMembershipId] = useState('');
  const [tipAmount, setTipAmount] = useState(0);
  const [category, setCategory] = useState('All');
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!salonId) {
      navigate('/salon/login');
      return;
    }
    fetchInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInitial = async () => {
    try {
      const [bRes, sRes, mRes, cRes] = await Promise.all([
        axios.get(`${API}/salons/${salonId}/barbers`, { headers: getSalonAuthHeaders() }),
        (async () => {
          try {
            const r = await axios.get(`${API}/salons/${salonId}/services/enabled`);
            const arr = Array.isArray(r.data) ? r.data : (r.data?.services || r.data?.enabled_services || []);
            if (arr && arr.length > 0) return { data: arr };
          } catch (e) { /* fall through */ }
          try {
            const r2 = await axios.get(`${API}/services`);
            return { data: r2.data || [] };
          } catch (e2) {
            return { data: [] };
          }
        })(),
        axios.get(`${API}/salons/${salonId}/membership-plans`, { headers: getSalonAuthHeaders() })
          .catch(() => ({ data: { plans: [] } })),
        axios.get(`${API}/salons/${salonId}/customers`, { headers: getSalonAuthHeaders() })
          .catch(() => ({ data: { customers: [] } })),
      ]);
      setBarbers(bRes.data?.barbers || bRes.data || []);
      const svcRaw = sRes.data;
      const svcData = Array.isArray(svcRaw)
        ? svcRaw
        : (svcRaw?.services || svcRaw?.enabled_services || []);
      setServices(Array.isArray(svcData) ? svcData : []);
      setMembershipPlans(mRes.data?.plans || mRes.data || []);
      setCustomers(cRes.data?.customers || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load booking data');
    }
  };

  // Filter services by category
  const categories = useMemo(() => {
    const set = new Set(services.map((s) => s.category || 'General'));
    return ['All', ...Array.from(set)];
  }, [services]);

  const visibleServices = useMemo(() => {
    if (category === 'All') return services;
    return services.filter((s) => (s.category || 'General') === category);
  }, [category, services]);

  const selectedServiceObjs = useMemo(
    () => services.filter((s) => form.selected_services.includes(s.id)),
    [services, form.selected_services]
  );

  // Money
  const subtotal = useMemo(
    () => selectedServiceObjs.reduce((sum, s) => sum + Number(s.base_price || 0), 0),
    [selectedServiceObjs]
  );

  const selectedMembership = useMemo(
    () => membershipPlans.find((p) => p.id === selectedMembershipId) || null,
    [membershipPlans, selectedMembershipId]
  );

  const membershipDiscountPct = Number(
    selectedMembership?.discount_percentage || selectedMembership?.service_discount_pct || 0
  );
  const membershipDiscountAmt = Math.round(subtotal * membershipDiscountPct) / 100;
  const membershipSalePrice = Number(selectedMembership?.price || selectedMembership?.plan_price || 0);

  const couponDiscount = Number(couponInfo?.discount_amount || 0);
  const servicesTotal = Math.max(0, subtotal - membershipDiscountAmt - couponDiscount);
  const grandTotal = Math.max(0, servicesTotal + membershipSalePrice + Number(tipAmount || 0));

  const toggleService = (id) => {
    setForm((prev) => ({
      ...prev,
      selected_services: prev.selected_services.includes(id)
        ? prev.selected_services.filter((x) => x !== id)
        : [...prev.selected_services, id],
    }));
  };

  const handleSelectCustomer = async (c) => {
    setSelectedCustomer(c);
    setForm((prev) => ({
      ...prev,
      customer_name: c.name,
      phone: c.phone,
      gender: c.gender || 'Men',
    }));
    try {
      const phoneQ = String(c.phone || '').replace(/^\+91/, '').replace(/\D/g, '');
      if (phoneQ) {
        const res = await axios.get(`${API}/salons/${salonId}/customers/${phoneQ}/wallet`);
        setWalletInfo(res.data || null);
      } else {
        setWalletInfo(null);
      }
    } catch (e) {
      setWalletInfo(null);
    }
  };

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    try {
      const res = await axios.post(
        `${API}/salons/${salonId}/coupons/validate`,
        {
          code: couponCode.trim().toUpperCase(),
          bill_amount: Math.max(0, subtotal - membershipDiscountAmt),
          customer_phone: form.phone || undefined,
          service_ids: form.selected_services,
        }
      );
      setCouponInfo(res.data);
      toast.success(`Coupon applied — ₹${res.data.discount_amount} off`);
    } catch (err) {
      setCouponInfo(null);
      toast.error(err.response?.data?.detail || 'Invalid coupon');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setCouponInfo(null);
    setCouponCode('');
  };

  const canSubmit = form.selected_services.length > 0
    && (form.customer_name || '').trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error('Enter customer name and select at least one service');
      return;
    }
    if (form.payment_mode === 'wallet' && !form.phone) {
      toast.error('Customer phone required for wallet payment');
      return;
    }
    setSubmitting(true);
    try {
      const endpoint = mode === 'invoice'
        ? `${API}/salons/${salonId}/direct-invoice`
        : `${API}/salons/${salonId}/salon-booking`;

      const payload = {
        customer_name: form.customer_name,
        phone: form.phone,
        gender: form.gender,
        barber_id: form.barber_id,
        selected_services: form.selected_services,
        payment_mode: form.payment_mode,
        coupon_code: couponCode.trim().toUpperCase() || undefined,
        membership_plan_id: selectedMembershipId || undefined,
        tip_amount: Number(tipAmount) || 0,
        notes: notes || undefined,
      };
      const res = await axios.post(endpoint, payload, { headers: getSalonAuthHeaders() });
      toast.success(mode === 'invoice' ? 'Invoice generated' : 'Booking created');
      if (onSubmitted) onSubmitted(res.data);
      else navigate('/salon/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCustomers = customerSearch.trim()
    ? customers.filter((c) => {
        const q = customerSearch.trim().toLowerCase();
        return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q);
      }).slice(0, 8)
    : [];

  const accentBar = headerAccent === 'invoice'
    ? 'from-emerald-500 to-teal-600'
    : 'from-gold to-amber-500';

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky header */}
      <div className={`sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md`}>
        <div className="max-w-[1180px] mx-auto flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate('/salon/dashboard')}
            className="p-2 rounded-lg hover:bg-muted transition"
            title="Back to Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className={`text-xl md:text-2xl font-bold bg-gradient-to-r ${accentBar} bg-clip-text text-transparent`}>{pageTitle}</h1>
            <p className="text-xs text-muted-foreground">{pageSubtitle}</p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            data-testid="submit-booking-form"
            className={`hidden md:inline-flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm transition ${
              canSubmit && !submitting
                ? mode === 'invoice'
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-gold hover:bg-gold/90 text-black'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {submitLabel} · ₹{grandTotal.toFixed(0)}
          </button>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 pb-32 lg:pb-8">
        {/* LEFT — customer + services */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer */}
          <section className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2"><User className="w-4 h-4 text-gold" /> Customer</h3>
              {selectedCustomer && (
                <button onClick={() => { setSelectedCustomer(null); setWalletInfo(null); setForm({ ...form, customer_name: '', phone: '' }); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><X className="w-3 h-3" /> Clear</button>
              )}
            </div>

            {/* Existing customer search */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search existing customer by name or phone…"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
              {filteredCustomers.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {filteredCustomers.map((c) => (
                    <button
                      key={c.id || c.phone}
                      onClick={() => { handleSelectCustomer(c); setCustomerSearch(''); }}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between"
                    >
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                placeholder="Customer name"
                className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Phone (10 digits)"
                className="px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
              <div className="flex gap-2">
                {['Men', 'Women', 'Kids'].map((g) => (
                  <button
                    key={g}
                    onClick={() => setForm({ ...form, gender: g })}
                    className={`flex-1 px-2 py-2 rounded-lg text-xs font-semibold border transition ${
                      form.gender === g ? 'bg-gold text-black border-gold' : 'bg-background border-border hover:bg-muted'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {walletInfo?.has_membership && (
              <div className="mt-3 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 px-3 py-2 rounded-lg flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Wallet balance</span>
                <span className="font-bold">₹{Number(walletInfo.wallet_balance || 0).toFixed(0)}</span>
              </div>
            )}
          </section>

          {/* Barber */}
          <section className="bg-card border border-border rounded-2xl p-4">
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Scissors className="w-4 h-4 text-gold" /> Assign Stylist</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setForm({ ...form, barber_id: 'any' })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                  form.barber_id === 'any' ? 'bg-gold text-black border-gold' : 'bg-background border-border hover:border-gold/40'
                }`}
              >
                Any Available
              </button>
              {barbers.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setForm({ ...form, barber_id: b.id })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    form.barber_id === b.id ? 'bg-gold text-black border-gold' : 'bg-background border-border hover:border-gold/40'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </section>

          {/* Services — chips */}
          <section className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Services <span className="text-xs text-muted-foreground">({form.selected_services.length} selected)</span></h3>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
                    category === c ? 'bg-foreground text-background border-foreground' : 'bg-background border-border hover:border-gold/40'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {visibleServices.length === 0 && (
                <p className="text-xs text-muted-foreground">No services in this category</p>
              )}
              {visibleServices.map((s) => {
                const on = form.selected_services.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleService(s.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition inline-flex items-center gap-1.5 ${
                      on ? 'bg-gold text-black border-gold shadow' : 'bg-background border-border hover:border-gold/40'
                    }`}
                    title={s.service_name}
                  >
                    <span>{s.service_name}</span>
                    <span className={`text-[10px] font-bold ${on ? 'text-black/70' : 'text-muted-foreground'}`}>
                      ₹{Number(s.base_price || 0)}
                    </span>
                    {on && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Notes */}
          <section className="bg-card border border-border rounded-2xl p-4">
            <h3 className="text-sm font-bold mb-2">Notes (optional)</h3>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests, styling preferences, etc."
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </section>
        </div>

        {/* RIGHT — order summary */}
        <div className="space-y-4">
          {/* Coupon + Membership */}
          <section className="bg-card border border-border rounded-2xl p-4 space-y-4">
            <div>
              <label className="text-xs font-bold flex items-center gap-1 mb-2"><TicketPercent className="w-3.5 h-3.5 text-blue-500" /> Coupon Code</label>
              {couponInfo ? (
                <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/40 rounded-lg px-3 py-2">
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{couponCode.toUpperCase()}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">-₹{couponDiscount.toFixed(0)}</span>
                    <button onClick={removeCoupon} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                    className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm uppercase focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />
                  <button
                    onClick={validateCoupon}
                    disabled={!couponCode.trim() || validatingCoupon || subtotal === 0}
                    className="px-3 py-2 rounded-lg bg-blue-500 text-white text-xs font-semibold disabled:bg-muted disabled:text-muted-foreground"
                  >
                    {validatingCoupon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply'}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold flex items-center gap-1 mb-2"><BadgeCheck className="w-3.5 h-3.5 text-purple-500" /> Sell Membership (with this order)</label>
              <select
                value={selectedMembershipId}
                onChange={(e) => setSelectedMembershipId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40"
              >
                <option value="">— None —</option>
                {membershipPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · ₹{p.price || p.plan_price || 0} · {(p.discount_percentage || p.service_discount_pct || 0)}% off
                  </option>
                ))}
              </select>
              {selectedMembership && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Applies {membershipDiscountPct}% off (₹{membershipDiscountAmt.toFixed(0)}) to this order + adds ₹{Number(selectedMembership.credit || 0)} wallet credit.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold mb-2 block">Tip (optional)</label>
              <input
                type="number"
                min="0"
                value={tipAmount || ''}
                onChange={(e) => setTipAmount(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
            </div>
          </section>

          {/* Order summary */}
          <section className="bg-card border border-border rounded-2xl p-4">
            <h3 className="text-sm font-bold mb-3">Order Summary</h3>
            <div className="space-y-1.5 text-sm">
              <Row label="Subtotal" value={subtotal} />
              {membershipDiscountAmt > 0 && (
                <Row label={`Membership (${membershipDiscountPct}% off)`} value={-membershipDiscountAmt} negative />
              )}
              {couponDiscount > 0 && (
                <Row label={`Coupon (${couponCode})`} value={-couponDiscount} negative />
              )}
              <div className="border-t border-border pt-2 mt-2">
                <Row label="Services total" value={servicesTotal} bold />
              </div>
              {membershipSalePrice > 0 && <Row label="Membership sale" value={membershipSalePrice} />}
              {Number(tipAmount) > 0 && <Row label="Tip" value={Number(tipAmount)} />}
              <div className="border-t border-border pt-2 mt-2 flex items-center justify-between">
                <span className="text-sm font-bold">Grand Total</span>
                <span className="text-2xl font-bold text-gold">₹{grandTotal.toFixed(0)}</span>
              </div>
            </div>
          </section>

          {/* Payment mode */}
          <section className="bg-card border border-border rounded-2xl p-4">
            <h3 className="text-sm font-bold mb-3">Payment Mode</h3>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_MODES.map((pm) => {
                const on = form.payment_mode === pm.id;
                const Icon = pm.icon;
                const disabled = pm.id === 'wallet' && (!walletInfo?.has_membership || (walletInfo?.wallet_balance || 0) <= 0);
                return (
                  <button
                    key={pm.id}
                    onClick={() => !disabled && setForm({ ...form, payment_mode: pm.id })}
                    disabled={disabled}
                    className={`flex flex-col items-center gap-1 px-2 py-3 rounded-lg border-2 transition text-xs font-semibold ${
                      on ? pm.color : 'bg-background border-border hover:border-gold/40 text-foreground'
                    } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <Icon className="w-5 h-5" />
                    {pm.label}
                    {pm.id === 'wallet' && walletInfo?.has_membership && (
                      <span className="text-[10px] font-normal">₹{Number(walletInfo.wallet_balance).toFixed(0)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Mobile submit */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className={`lg:hidden w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-base transition ${
              canSubmit && !submitting
                ? mode === 'invoice'
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-gold hover:bg-gold/90 text-black'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            {submitLabel} · ₹{grandTotal.toFixed(0)}
          </button>
        </div>
      </div>

      {/* Mobile sticky bottom */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border p-3 z-40">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className={`w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-base ${
            canSubmit && !submitting
              ? mode === 'invoice'
                ? 'bg-emerald-500 text-white'
                : 'bg-gold text-black'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          {submitLabel} · ₹{grandTotal.toFixed(0)}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, negative = false, bold = false }) {
  return (
    <div className={`flex items-center justify-between ${bold ? 'font-bold' : ''}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`${negative ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
        {negative ? '-' : ''}₹{Math.abs(value).toFixed(0)}
      </span>
    </div>
  );
}
