/**
 * Phase 15/17 — Salon-side Customer Orders page.
 *
 * Lists incoming customer orders for the salon admin.  Each row shows the
 * customer phone, total, status, and exposes actions:
 *   - Fulfill (single-step, auto-posts to finance + decrements inventory)
 *   - Edit items (partial fulfillment) — set per-line qty_final
 *   - Cancel (with optional refund mode)
 *   - Complete refund (for refund_pending orders)
 *
 * Uses the shared `SalonHamburgerMenu` so the salon admin keeps the global
 * nav on this page (Phase 17 polish).
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, Loader2, Filter, CheckCircle, XCircle, Edit3, Banknote, Smartphone,
  Wallet, Clock, RefreshCw, Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import SalonHamburgerMenu from '@/components/salon/SalonHamburgerMenu';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const STATUS_BADGE = {
  placed:         'bg-blue-500/15 text-blue-600 border-blue-500/40',
  fulfilled:      'bg-green-500/15 text-green-600 border-green-500/40',
  cancelled:      'bg-gray-500/15 text-gray-600 border-gray-500/40',
  refund_pending: 'bg-amber-500/15 text-amber-600 border-amber-500/40',
  refunded:       'bg-purple-500/15 text-purple-600 border-purple-500/40',
};

const STATUS_LABEL = {
  placed: 'New',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
  refund_pending: 'Refund pending',
  refunded: 'Refunded',
};

const PAYMENT_MODE_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'wallet', label: 'Salon Wallet' },
  { value: 'card', label: 'Card' },
  { value: 'pay_at_salon', label: 'Pay at salon (track later)' },
  { value: 'other', label: 'Other' },
];

const REFUND_MODE_OPTIONS = [
  { value: 'wallet',       label: 'Credit to salon wallet',       icon: Wallet },
  { value: 'cash',         label: 'Cash',                          icon: Banknote },
  { value: 'upi',          label: 'UPI',                           icon: Smartphone },
  { value: 'bank',         label: 'Bank transfer',                 icon: Package },
  { value: 'refund_later', label: 'Refund later',                  icon: Clock },
];

export default function SalonCustomerOrdersPage() {
  const navigate = useNavigate();

  const authHeaders = useMemo(() => {
    const raw = localStorage.getItem('salon_user_auth');
    let token = localStorage.getItem('salon_admin_token') || localStorage.getItem('access_token');
    if (!token && raw) {
      try { token = JSON.parse(raw).token; } catch (e) { console.debug("Bad salon_user_auth JSON:", e); }
    }
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('placed');
  const [active, setActive] = useState(null);  // order detail dialog
  const [editing, setEditing] = useState(null); // edit-items dialog state
  const [cancelling, setCancelling] = useState(null);
  const [completingRefund, setCompletingRefund] = useState(null);
  const [fulfillingPayment, setFulfillingPayment] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      const r = await axios.get(`${API}/salon/customer-orders`, { headers: authHeaders, params });
      setOrders(r.data?.orders || []);
    } catch (e) {
      if (e?.response?.status === 401) {
        toast.error('Please log in as salon admin');
        navigate('/admin/login');
        return;
      }
      toast.error(e?.response?.data?.detail || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, authHeaders, navigate]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Fulfill (single-step)
  const fulfillOrder = async () => {
    if (!fulfillingPayment) return;
    const { order, paymentMode, note } = fulfillingPayment;
    try {
      await axios.post(`${API}/salon/customer-orders/${order.id}/fulfill`,
        { payment_mode: paymentMode, note },
        { headers: authHeaders });
      toast.success('Order fulfilled · finance posted');
      setFulfillingPayment(null);
      setActive(null);
      fetchOrders();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Fulfilment failed');
    }
  };

  // Cancel
  const submitCancel = async () => {
    if (!cancelling) return;
    const { order, refundMode, refundNote } = cancelling;
    try {
      await axios.post(`${API}/salon/customer-orders/${order.id}/cancel`,
        { refund_mode: refundMode, refund_note: refundNote },
        { headers: authHeaders });
      toast.success(refundMode === 'refund_later' ? 'Order cancelled · refund pending' : 'Order cancelled');
      setCancelling(null);
      setActive(null);
      fetchOrders();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Cancel failed');
    }
  };

  // Complete refund (refund_later → mode picker)
  const submitCompleteRefund = async () => {
    if (!completingRefund) return;
    const { order, refundMode } = completingRefund;
    try {
      await axios.post(`${API}/salon/customer-orders/${order.id}/complete-refund`,
        { refund_mode: refundMode },
        { headers: authHeaders });
      toast.success('Refund completed');
      setCompletingRefund(null);
      setActive(null);
      fetchOrders();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Refund failed');
    }
  };

  // Edit items (partial fulfillment)
  const submitEditItems = async () => {
    if (!editing) return;
    const { order, lineEdits, note } = editing;
    try {
      const items = order.items
        .map((l) => ({
          item_id: l.item_id,
          item_type: l.item_type,
          qty: lineEdits[l.item_id] ?? l.qty,
        }))
        .filter(it => it.qty >= 0);
      await axios.put(`${API}/salon/customer-orders/${order.id}/items`,
        { items, note },
        { headers: authHeaders });
      toast.success('Order updated');
      setEditing(null);
      fetchOrders();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Update failed');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <SalonHamburgerMenu activeId="customer-orders" />
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex-1">
            <div className="text-sm font-bold">Customer Orders</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/80">Products & memberships purchased by customers · Phase 15</div>
          </div>
          <Button size="sm" variant="outline" onClick={fetchOrders}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 flex items-center gap-2 overflow-x-auto">
          {['placed', 'fulfilled', 'cancelled', 'refund_pending', 'refunded', 'all'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              data-testid={`co-status-${s}`}
              className={`px-3 py-1 text-xs rounded-full border whitespace-nowrap transition-colors ${
                statusFilter === s ? 'bg-gold text-black border-gold font-semibold' : 'bg-card border-border hover:bg-muted'
              }`}
            >{s === 'all' ? 'All' : STATUS_LABEL[s] || s}</button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="text-center py-16"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto opacity-50 mb-3" />
            No orders in this status.
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(o => (
              <div
                key={o.id}
                data-testid={`co-row-${o.id}`}
                className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">#{o.id.slice(0, 8)}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${STATUS_BADGE[o.order_status] || 'bg-muted text-muted-foreground border-border'}`}>
                      {STATUS_LABEL[o.order_status] || o.order_status}
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</span>
                  </div>
                  <div className="font-semibold mt-1 truncate">
                    {o.customer_name ? `${o.customer_name} · ` : ''}{o.customer_phone}
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {(o.items || []).length} item(s) · {fmt(o.total_amount)} · {o.payment_mode}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setActive(o)} data-testid={`co-view-${o.id}`}>View</Button>
                  {o.order_status === 'placed' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setEditing({ order: o, lineEdits: Object.fromEntries((o.items||[]).map(l => [l.item_id, l.qty])), note: '' })} data-testid={`co-edit-${o.id}`}>
                        <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                      <Button size="sm" onClick={() => setFulfillingPayment({ order: o, paymentMode: o.payment_mode || 'cash', note: '' })} data-testid={`co-fulfill-${o.id}`}>
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Fulfill
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setCancelling({ order: o, refundMode: '', refundNote: '' })} data-testid={`co-cancel-${o.id}`}>
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel
                      </Button>
                    </>
                  )}
                  {o.order_status === 'fulfilled' && (
                    <Button size="sm" variant="destructive" onClick={() => setCancelling({ order: o, refundMode: 'cash', refundNote: '' })} data-testid={`co-cancel-${o.id}`}>
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel + refund
                    </Button>
                  )}
                  {o.order_status === 'refund_pending' && (
                    <Button size="sm" onClick={() => setCompletingRefund({ order: o, refundMode: 'cash' })} data-testid={`co-refund-${o.id}`}>
                      <Wallet className="w-3.5 h-3.5 mr-1" /> Complete refund
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ===== Detail dialog ===== */}
      <Dialog open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent className="max-w-2xl">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>Order #{active.id.slice(0, 8)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Customer:</span> {active.customer_name || '—'}</div>
                  <div><span className="text-muted-foreground">Phone:</span> {active.customer_phone}</div>
                  <div><span className="text-muted-foreground">Status:</span> {STATUS_LABEL[active.order_status] || active.order_status}</div>
                  <div><span className="text-muted-foreground">Payment:</span> {active.payment_mode} ({active.payment_status})</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Placed:</span> {new Date(active.created_at).toLocaleString()}</div>
                </div>
                <div className="border-t border-border pt-2">
                  <div className="font-semibold mb-1">Items</div>
                  {(active.items || []).map((l, i) => (
                    <div key={`${l.product_id || l.name}-${i}`} className="flex justify-between text-sm py-1 border-b border-border/50 last:border-0">
                      <div>
                        <div>{l.name} × {l.qty}</div>
                        {l.qty_final !== undefined && l.qty_final !== l.qty && (
                          <div className="text-xs text-amber-600">Fulfilled: {l.qty_final}</div>
                        )}
                      </div>
                      <div>{fmt(l.line_total)}</div>
                    </div>
                  ))}
                  <div className="flex justify-between mt-2 font-bold pt-2 border-t border-border">
                    <span>Total</span>
                    <span>{fmt(active.fulfilled_amount ?? active.total_amount)}</span>
                  </div>
                </div>
                {active.status_history && (
                  <div className="border-t border-border pt-2">
                    <div className="font-semibold mb-1">History</div>
                    <div className="text-xs space-y-0.5 max-h-32 overflow-y-auto">
                      {active.status_history.map((h, i) => (
                        <div key={`${h.timestamp || ''}-${i}`}>
                          <span className="text-muted-foreground">{new Date(h.timestamp).toLocaleString()}:</span> {h.status} {h.note ? `· ${h.note}` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Fulfill payment dialog ===== */}
      <Dialog open={!!fulfillingPayment} onOpenChange={(v) => !v && setFulfillingPayment(null)}>
        <DialogContent>
          {fulfillingPayment && (
            <>
              <DialogHeader>
                <DialogTitle>Fulfill order · {fmt(fulfillingPayment.order.total_amount)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Payment mode</Label>
                  <select
                    className="w-full mt-1 bg-background border border-border rounded px-3 py-2 text-sm"
                    value={fulfillingPayment.paymentMode}
                    onChange={(e) => setFulfillingPayment(s => ({ ...s, paymentMode: e.target.value }))}
                  >
                    {PAYMENT_MODE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Note (optional)</Label>
                  <Textarea
                    value={fulfillingPayment.note}
                    onChange={(e) => setFulfillingPayment(s => ({ ...s, note: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                  Confirming will <strong>decrement inventory</strong>, log a sale, and post a financial transaction.
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setFulfillingPayment(null)}>Cancel</Button>
                <Button onClick={fulfillOrder} data-testid="fulfill-confirm-btn">
                  <CheckCircle className="w-4 h-4 mr-1" /> Confirm fulfill
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Edit items (partial fulfillment) dialog ===== */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-lg">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>Edit order quantities</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  Reduce any line to partially fulfill. Setting to 0 will skip that item entirely and release the reservation.
                </div>
                {editing.order.items.map((l) => (
                  <div key={l.item_id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{l.name}</div>
                      <div className="text-xs text-muted-foreground">Ordered: {l.qty} · Unit {fmt(l.unit_price)}</div>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={l.qty}
                      value={editing.lineEdits[l.item_id]}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(parseInt(e.target.value || '0', 10), l.qty));
                        setEditing(s => ({ ...s, lineEdits: { ...s.lineEdits, [l.item_id]: v } }));
                      }}
                      className="w-20"
                      data-testid={`edit-qty-${l.item_id}`}
                    />
                  </div>
                ))}
                <div>
                  <Label>Note (optional)</Label>
                  <Textarea
                    value={editing.note}
                    onChange={(e) => setEditing(s => ({ ...s, note: e.target.value }))}
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={submitEditItems}>Save edits</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Cancel + refund dialog ===== */}
      <Dialog open={!!cancelling} onOpenChange={(v) => !v && setCancelling(null)}>
        <DialogContent>
          {cancelling && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {cancelling.order.order_status === 'fulfilled'
                    ? `Cancel & refund · ${fmt(cancelling.order.fulfilled_amount || cancelling.order.total_amount)}`
                    : 'Cancel order'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {cancelling.order.order_status === 'fulfilled' && (
                  <div>
                    <Label className="mb-2 block">Refund mode</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {REFUND_MODE_OPTIONS.map(o => {
                        const Icon = o.icon;
                        const active = cancelling.refundMode === o.value;
                        return (
                          <button
                            key={o.value}
                            onClick={() => setCancelling(s => ({ ...s, refundMode: o.value }))}
                            data-testid={`refund-mode-${o.value}`}
                            className={`p-3 rounded-lg border text-left transition-colors ${
                              active ? 'border-gold bg-gold/10' : 'border-border hover:bg-muted'
                            }`}
                          >
                            <Icon className="w-4 h-4 mb-1" />
                            <div className="text-sm font-semibold">{o.label}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div>
                  <Label>Note (optional)</Label>
                  <Textarea
                    value={cancelling.refundNote}
                    onChange={(e) => setCancelling(s => ({ ...s, refundNote: e.target.value }))}
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCancelling(null)}>Keep order</Button>
                <Button
                  variant="destructive"
                  onClick={submitCancel}
                  disabled={cancelling.order.order_status === 'fulfilled' && !cancelling.refundMode}
                  data-testid="cancel-confirm-btn"
                >
                  Confirm cancel
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Complete refund dialog ===== */}
      <Dialog open={!!completingRefund} onOpenChange={(v) => !v && setCompletingRefund(null)}>
        <DialogContent>
          {completingRefund && (
            <>
              <DialogHeader>
                <DialogTitle>Complete refund · {fmt(completingRefund.order.refund_amount || completingRefund.order.total_amount)}</DialogTitle>
              </DialogHeader>
              <div>
                <Label className="mb-2 block">Refund mode</Label>
                <div className="grid grid-cols-2 gap-2">
                  {REFUND_MODE_OPTIONS.filter(o => o.value !== 'refund_later').map(o => {
                    const Icon = o.icon;
                    const active = completingRefund.refundMode === o.value;
                    return (
                      <button
                        key={o.value}
                        onClick={() => setCompletingRefund(s => ({ ...s, refundMode: o.value }))}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          active ? 'border-gold bg-gold/10' : 'border-border hover:bg-muted'
                        }`}
                      >
                        <Icon className="w-4 h-4 mb-1" />
                        <div className="text-sm font-semibold">{o.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCompletingRefund(null)}>Cancel</Button>
                <Button onClick={submitCompleteRefund}>Complete</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
