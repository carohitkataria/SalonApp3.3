/**
 * Phase 11 — Salon Orders list page.
 *
 * Shows all orders placed from this salon (including pending_payment ones).
 * Used both as the post-checkout landing page (the Cashfree return URL points
 * here) and as the long-lived "my orders" view.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, Loader2, Truck, CheckCircle2, XCircle, Clock, Wallet,
  CreditCard, Package, IndianRupee,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { extractErrorMessage } from '@/utils/apiError';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const STATUS_TABS = [
  { key: '',                 label: 'All' },
  { key: 'pending_payment',  label: 'Awaiting payment' },
  { key: 'confirmed',        label: 'Confirmed' },
  { key: 'shipped',          label: 'Shipped' },
  { key: 'delivered',        label: 'Delivered' },
  { key: 'cancelled',        label: 'Cancelled' },
];

export default function SalonOrdersPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const checkoutId = params.get('checkout_id');

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const authHeaders = useMemo(() => {
    const raw = localStorage.getItem('salon_user_auth');
    let token = localStorage.getItem('salon_admin_token') || localStorage.getItem('access_token');
    if (!token && raw) {
      try { token = JSON.parse(raw).token; } catch (e) { console.debug('Bad salon_user_auth JSON:', e); }
    }
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: 1, page_size: 50 };
      if (statusFilter) params.status = statusFilter;
      const r = await axios.get(`${API}/salon/store/orders`, { headers: authHeaders, params });
      setOrders(r.data.orders || []);
    } catch (e) {
      if (e?.response?.status === 401) {
        toast.error('Session expired'); navigate('/salon/login'); return;
      }
      toast.error(extractErrorMessage(e, 'Failed to load orders'));
    } finally { setLoading(false); }
  }, [authHeaders, statusFilter, navigate]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // After Cashfree redirects back show a toast.
  useEffect(() => {
    if (!checkoutId) return;
    toast.success("We're confirming your payment. Pull-to-refresh if your order doesn't update in a few seconds.");
  }, [checkoutId]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/dashboard')} data-testid="orders-back-btn">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex-1">
            <div className="text-sm font-bold">My orders</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/80">Phase 11 · Store</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate('/salon/marketplace')} data-testid="orders-shop-more-btn">
            Shop more
          </Button>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-3 flex gap-1.5 overflow-x-auto">
          {STATUS_TABS.map(t => (
            <button
              key={t.key || 'all'}
              onClick={() => setStatusFilter(t.key)}
              data-testid={`orders-tab-${t.key || 'all'}`}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
                statusFilter === t.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:border-primary/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="text-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin inline mr-2" /> Loading…</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-xl">
            <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <div className="font-semibold mb-1">No orders yet</div>
            <div className="text-xs text-muted-foreground mb-4">Place your first store order from the marketplace.</div>
            <Button onClick={() => navigate('/salon/marketplace')} data-testid="orders-empty-cta">Browse the store</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(o => <OrderRow key={o.id} o={o} onOpen={() => navigate(`/salon/orders/${o.id}`)} />)}
          </div>
        )}
      </main>
    </div>
  );
}


function OrderRow({ o, onOpen }) {
  const status = o.order_status || 'pending_payment';
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid={`order-row-${o.id}`}
      className="w-full text-left border border-border rounded-xl p-4 bg-card hover:shadow-md transition flex flex-col sm:flex-row sm:items-center gap-3"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <StatusBadge status={status} />
          <PaymentBadge mode={o.payment_mode} status={o.payment_status} />
          <span className="text-[10px] text-muted-foreground">Order #{o.id.slice(0, 8)}</span>
        </div>
        <div className="text-sm font-bold">{o.supplier_name || 'Supplier'}</div>
        <div className="text-xs text-muted-foreground">
          {(o.items || []).length} item{(o.items || []).length !== 1 ? 's' : ''} · {new Date(o.created_at).toLocaleString()}
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-extrabold flex items-center justify-end"><IndianRupee className="w-4 h-4" />{Number(o.total_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">View details →</div>
      </div>
    </button>
  );
}


export function StatusBadge({ status }) {
  const map = {
    pending_payment: { label: 'Awaiting payment', cls: 'bg-amber-500/15 text-amber-600 border-amber-500/40', icon: Clock },
    confirmed:       { label: 'Confirmed',        cls: 'bg-blue-500/15 text-blue-600 border-blue-500/40', icon: CheckCircle2 },
    shipped:         { label: 'Shipped',          cls: 'bg-violet-500/15 text-violet-600 border-violet-500/40', icon: Truck },
    delivered:       { label: 'Delivered',        cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/40', icon: CheckCircle2 },
    cancelled:       { label: 'Cancelled',        cls: 'bg-rose-500/15 text-rose-600 border-rose-500/40', icon: XCircle },
  };
  const cfg = map[status] || { label: status, cls: 'bg-muted text-foreground border-border', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}


export function PaymentBadge({ mode, status }) {
  if (mode === 'cod') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border bg-muted">
        <Wallet className="w-3 h-3" /> COD {status === 'paid' ? '· Paid' : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border bg-muted">
      <CreditCard className="w-3 h-3" /> Online · {status || 'pending'}
    </span>
  );
}
