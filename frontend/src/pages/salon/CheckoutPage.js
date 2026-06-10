/**
 * Phase 11 — Checkout flow.
 *
 * Behaviour:
 *  1. Pre-fill shipping defaults from the salon doc.
 *  2. User picks payment mode (Cashfree | COD).
 *  3. On submit we POST /api/salon/store/checkout. The server reserves
 *     inventory + creates one salon_orders doc per supplier + (for Cashfree)
 *     creates a Cashfree order session.
 *  4. For Cashfree: load the Cashfree JS SDK and trigger `cashfree.checkout`
 *     with `paymentSessionId`. The SDK redirects to Cashfree's hosted page
 *     which redirects back to /salon/orders?checkout_id=...
 *  5. For COD: redirect straight to /salon/orders with a toast.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Loader2, ArrowLeft, ShoppingBag, ShieldCheck, Wallet, CreditCard,
  Truck, IndianRupee, AlertTriangle, Boxes,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { extractErrorMessage } from '@/utils/apiError';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const CASHFREE_SDK_URL = 'https://sdk.cashfree.com/js/v3/cashfree.js';

function loadCashfreeSdk() {
  return new Promise((resolve, reject) => {
    if (window.Cashfree) return resolve(window.Cashfree);
    const existing = document.querySelector(`script[src="${CASHFREE_SDK_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Cashfree));
      existing.addEventListener('error', reject);
      return;
    }
    const s = document.createElement('script');
    s.src = CASHFREE_SDK_URL;
    s.async = true;
    s.onload = () => resolve(window.Cashfree);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { salonUser } = useAuth();
  const { items, summary, clear } = useCart();

  const [salonProfile, setSalonProfile] = useState(null);
  const [paymentMode, setPaymentMode] = useState('cashfree');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [shipping, setShipping] = useState({
    name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '',
  });

  const authHeaders = useMemo(() => {
    const raw = localStorage.getItem('salon_user_auth');
    let token = localStorage.getItem('salon_admin_token') || localStorage.getItem('access_token');
    if (!token && raw) {
      try { token = JSON.parse(raw).token; } catch (e) { console.debug("Bad salon_user_auth JSON:", e); }
    }
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // Load salon profile so we can prefill shipping address.
  const fetchSalonProfile = useCallback(async () => {
    const salonId = salonUser?.salonId;
    if (!salonId) return;
    try {
      const r = await axios.get(`${API}/salon/${salonId}`, { headers: authHeaders });
      const s = r.data;
      setSalonProfile(s);
      setShipping(prev => ({
        name: prev.name || s.salon_name || '',
        phone: prev.phone || s.phone || '',
        line1: prev.line1 || s.address || '',
        line2: prev.line2 || '',
        city: prev.city || s.city || '',
        state: prev.state || s.state || '',
        pincode: prev.pincode || s.pincode || '',
      }));
    } catch (e) {
      // Non-fatal: user can still type the address.
      console.warn('Could not load salon profile for prefill', e);
    }
  }, [salonUser?.salonId, authHeaders]);

  useEffect(() => { fetchSalonProfile(); }, [fetchSalonProfile]);

  // Guard: redirect away if cart is empty.
  useEffect(() => {
    if (items.length === 0) {
      // small delay so we don't fight with cart hydration on initial mount
      const t = setTimeout(() => {
        if (items.length === 0) navigate('/salon/marketplace', { replace: true });
      }, 50);
      return () => clearTimeout(t);
    }
  }, [items.length, navigate]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    // Basic validation.
    const missing = ['name', 'phone', 'line1', 'city', 'state', 'pincode']
      .filter(k => !String(shipping[k] || '').trim());
    if (missing.length) {
      toast.error(`Please fill: ${missing.join(', ')}`);
      return;
    }
    const body = {
      items: items.map(i => ({ product_id: i.product_id, qty: i.qty })),
      shipping_address: shipping,
      payment_mode: paymentMode,
      branch_id: null,
      notes: notes || undefined,
    };
    setSubmitting(true);
    try {
      const r = await axios.post(`${API}/salon/store/checkout`, body, { headers: authHeaders });
      const { payment_mode, cashfree_session_id, checkout_id } = r.data;

      if (payment_mode === 'cod') {
        clear();
        toast.success('Order placed! Pay on delivery.');
        navigate('/salon/orders');
        return;
      }

      // Cashfree path
      if (!cashfree_session_id) {
        toast.error('Payment session could not be created');
        return;
      }
      let CashfreeFactory;
      try {
        CashfreeFactory = await loadCashfreeSdk();
      } catch {
        toast.error('Could not load Cashfree. Please try Cash on Delivery.');
        return;
      }
      const cashfree = CashfreeFactory({
        mode: (process.env.REACT_APP_CASHFREE_MODE || 'sandbox').toLowerCase() === 'production'
          ? 'production' : 'sandbox',
      });
      // Clear the cart here so when the user returns from Cashfree we don't
      // double-charge them on retry. The orders are already in the DB.
      clear();
      cashfree.checkout({
        paymentSessionId: cashfree_session_id,
        redirectTarget: '_self',
      });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.code === 'INSUFFICIENT_STOCK') {
        toast.error(detail.message || 'Insufficient stock');
      } else {
        toast.error(extractErrorMessage(err, 'Checkout failed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Group items by supplier so the right rail breaks down what's being shipped.
  const groups = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const key = it.supplier_id || 'unknown';
      if (!map.has(key)) map.set(key, { supplier_id: key, supplier_name: it.supplier_name || 'Supplier', items: [] });
      map.get(key).items.push(it);
    }
    return Array.from(map.values());
  }, [items]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} data-testid="checkout-back-btn">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex-1">
            <div className="text-sm font-bold">Checkout</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/80">Phase 11 · Secure payment</div>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Encrypted
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-12 gap-6">
        {/* Left: shipping + payment */}
        <div className="col-span-12 lg:col-span-7 space-y-5">
          <section className="border border-border rounded-xl p-4">
            <div className="text-sm font-bold mb-3 flex items-center gap-2"><Truck className="w-4 h-4" /> Shipping address</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact name" name="name" value={shipping.name} onChange={(v) => setShipping(s => ({ ...s, name: v }))} testid="checkout-name" />
              <Field label="Phone" name="phone" value={shipping.phone} onChange={(v) => setShipping(s => ({ ...s, phone: v }))} testid="checkout-phone" />
              <Field label="Address line 1" name="line1" value={shipping.line1} onChange={(v) => setShipping(s => ({ ...s, line1: v }))} colspan={2} testid="checkout-line1" />
              <Field label="Address line 2 (optional)" name="line2" value={shipping.line2} onChange={(v) => setShipping(s => ({ ...s, line2: v }))} colspan={2} testid="checkout-line2" />
              <Field label="City" name="city" value={shipping.city} onChange={(v) => setShipping(s => ({ ...s, city: v }))} testid="checkout-city" />
              <Field label="State" name="state" value={shipping.state} onChange={(v) => setShipping(s => ({ ...s, state: v }))} testid="checkout-state" />
              <Field label="Pincode" name="pincode" value={shipping.pincode} onChange={(v) => setShipping(s => ({ ...s, pincode: v }))} testid="checkout-pincode" />
            </div>
          </section>

          <section className="border border-border rounded-xl p-4">
            <div className="text-sm font-bold mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4" /> Payment</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PaymentOption
                active={paymentMode === 'cashfree'}
                onClick={() => setPaymentMode('cashfree')}
                icon={CreditCard}
                title="Pay online"
                desc="UPI, cards, netbanking, wallets (via Cashfree). 15-minute reservation."
                testid="checkout-pm-cashfree"
              />
              <PaymentOption
                active={paymentMode === 'cod'}
                onClick={() => setPaymentMode('cod')}
                icon={Wallet}
                title="Cash on delivery"
                desc="Pay the supplier in cash on delivery. Order confirmed immediately."
                testid="checkout-pm-cod"
              />
            </div>
            {paymentMode === 'cashfree' && (
              <div className="mt-3 text-xs text-muted-foreground flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                Your stock will be reserved for 15 minutes. If payment isn't completed in that window
                the reservation is released and the order is cancelled.
              </div>
            )}
          </section>

          <section className="border border-border rounded-xl p-4">
            <div className="text-sm font-bold mb-2">Order notes (optional)</div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add a note for the supplier (preferred delivery time, etc.)"
              data-testid="checkout-notes"
            />
          </section>
        </div>

        {/* Right: summary */}
        <aside className="col-span-12 lg:col-span-5">
          <div className="sticky top-20 border border-border rounded-xl p-4 space-y-4">
            <div className="text-sm font-bold flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Order summary</div>
            {groups.length === 0 ? (
              <div className="text-xs text-muted-foreground">Your cart is empty.</div>
            ) : (
              <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                {groups.map(g => (
                  <div key={g.supplier_id}>
                    <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">
                      Supplier · {g.supplier_name}
                    </div>
                    {g.items.map(it => (
                      <div key={it.product_id} className="flex items-start gap-2 py-1.5 text-xs">
                        <div className="w-9 h-9 bg-muted rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                          {it.image_url ? <img src={it.image_url} alt="" className="w-full h-full object-cover" /> : <Boxes className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold leading-tight line-clamp-2">{it.name}</div>
                          <div className="text-muted-foreground">Qty {it.qty} × {fmt(it.selling_price)}</div>
                        </div>
                        <div className="font-bold">{fmt(it.selling_price * it.qty)}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-border pt-3 space-y-1 text-sm">
              <Row label="Subtotal" value={fmt(summary.subtotal)} />
              <Row label="GST" value={fmt(summary.gst)} />
              <Row label="Shipping" value="Free" muted />
              <div className="flex justify-between font-bold pt-2 border-t border-border">
                <span>Total</span>
                <span className="flex items-center"><IndianRupee className="w-4 h-4" />{Number(summary.total).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={submitting || items.length === 0} data-testid="checkout-submit-btn">
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Placing order…</>
                : paymentMode === 'cashfree' ? 'Pay & place order' : 'Place COD order'}
            </Button>
          </div>
        </aside>
      </form>
    </div>
  );
}


function Field({ label, name, value, onChange, colspan = 1, testid }) {
  return (
    <div className={colspan === 2 ? 'col-span-2' : ''}>
      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</Label>
      <Input
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testid}
        className="mt-1"
      />
    </div>
  );
}

function PaymentOption({ active, onClick, icon: Icon, title, desc, testid }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      className={`text-left rounded-xl border p-3 transition-colors ${
        active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
      }`}
    >
      <div className="flex items-center gap-2 font-bold text-sm">
        <Icon className="w-4 h-4" /> {title}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{desc}</div>
    </button>
  );
}

function Row({ label, value, muted }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? 'text-muted-foreground' : ''}>{label}</span>
      <span className={muted ? 'text-muted-foreground' : ''}>{value}</span>
    </div>
  );
}
