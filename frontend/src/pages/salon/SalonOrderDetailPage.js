/**
 * Phase 11/12 — Salon Order Detail page.
 *
 * Shows items, costs, timeline, shipping address, payment info.
 * Allows the salon to cancel an order that's still pending_payment or
 * confirmed (POST /api/salon/store/orders/{id}/cancel).
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, Loader2, IndianRupee, Truck, Boxes, MapPin, Phone, ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { StatusBadge, PaymentBadge } from './SalonOrdersPage';
import { extractErrorMessage } from '@/utils/apiError';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function SalonOrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const authHeaders = useMemo(() => {
    const raw = localStorage.getItem('salon_user_auth');
    let token = localStorage.getItem('salon_admin_token') || localStorage.getItem('access_token');
    if (!token && raw) {
      try { token = JSON.parse(raw).token; } catch { /* noop */ }
    }
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const fetchOrder = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/salon/store/orders/${orderId}`, { headers: authHeaders });
      setOrder(r.data);
    } catch (e) {
      toast.error(extractErrorMessage(e, 'Order not found'));
      navigate('/salon/orders');
    } finally { setLoading(false); }
  }, [authHeaders, orderId, navigate]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order? Your stock reservation will be released.')) return;
    setCancelling(true);
    try {
      await axios.post(`${API}/salon/store/orders/${orderId}/cancel`, { reason: 'Cancelled by buyer' }, { headers: authHeaders });
      toast.success('Order cancelled');
      fetchOrder();
    } catch (e) {
      toast.error(extractErrorMessage(e, 'Failed to cancel'));
    } finally { setCancelling(false); }
  };

  if (loading || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading order…
      </div>
    );
  }

  const canCancel = ['pending_payment', 'confirmed'].includes(order.order_status);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/salon/orders')} data-testid="order-detail-back-btn">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex-1">
            <div className="text-sm font-bold">Order #{order.id.slice(0, 8)}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/80">Placed {new Date(order.created_at).toLocaleString()}</div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-8 space-y-4">
          <div className="border border-border rounded-xl p-4 bg-card">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <StatusBadge status={order.order_status} />
              <PaymentBadge mode={order.payment_mode} status={order.payment_status} />
            </div>
            <div className="text-sm font-bold mb-1">{order.supplier_name || 'Supplier'}</div>
            {order.order_status === 'pending_payment' && order.reservation_expires_at && (
              <div className="text-xs text-amber-600 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                Reservation expires at {new Date(order.reservation_expires_at).toLocaleTimeString()}.
              </div>
            )}
          </div>

          <div className="border border-border rounded-xl p-4 bg-card">
            <div className="text-sm font-bold mb-3 flex items-center gap-2"><Boxes className="w-4 h-4" /> Items</div>
            <div className="divide-y divide-border">
              {(order.items || []).map(it => (
                <div key={it.product_id} className="py-3 flex items-start gap-3" data-testid={`detail-item-${it.product_id}`}>
                  <div className="w-12 h-12 bg-muted rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                    {it.image_url ? <img src={it.image_url} alt={it.name} className="w-full h-full object-cover" /> : <Boxes className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground">{it.brand}</div>
                    <div className="text-sm font-semibold leading-tight">{it.name}</div>
                    <div className="text-xs text-muted-foreground">Qty {it.qty} × {fmt(it.selling_price)} {it.gst_percent ? `· GST ${it.gst_percent}%` : ''}</div>
                  </div>
                  <div className="text-sm font-bold">{fmt(it.line_total)}</div>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3 mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmt(order.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>{fmt(order.gst_amount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>{order.shipping_fee ? fmt(order.shipping_fee) : 'Free'}</span></div>
              <div className="flex justify-between font-bold pt-1 border-t border-border">
                <span>Total</span>
                <span className="flex items-center"><IndianRupee className="w-4 h-4" />{Number(order.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div className="border border-border rounded-xl p-4 bg-card">
            <div className="text-sm font-bold mb-3">Status timeline</div>
            <div className="space-y-3">
              {(order.status_history || []).slice().reverse().map((h, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-xs font-bold capitalize">{(h.status || '').replace('_', ' ')}</div>
                    <div className="text-xs text-muted-foreground">{h.note}</div>
                    <div className="text-[10px] text-muted-foreground">{new Date(h.timestamp).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <div className="border border-border rounded-xl p-4 bg-card">
            <div className="text-sm font-bold mb-2 flex items-center gap-2"><Truck className="w-4 h-4" /> Shipping</div>
            <div className="text-xs space-y-0.5">
              <div className="font-semibold">{order.shipping_address?.name}</div>
              <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {order.shipping_address?.phone}</div>
              <div className="flex items-start gap-1">
                <MapPin className="w-3 h-3 mt-0.5" />
                <div>
                  {order.shipping_address?.line1}{order.shipping_address?.line2 ? `, ${order.shipping_address.line2}` : ''}<br />
                  {order.shipping_address?.city}, {order.shipping_address?.state} {order.shipping_address?.pincode}
                </div>
              </div>
              {order.tracking_number && (
                <div className="mt-2 border-t border-border pt-2">
                  <div className="font-bold text-foreground">Tracking</div>
                  <div className="text-muted-foreground">{order.shipping_carrier} · {order.tracking_number}</div>
                </div>
              )}
            </div>
          </div>

          {canCancel && (
            <Button variant="destructive" className="w-full" onClick={handleCancel} disabled={cancelling} data-testid="order-cancel-btn">
              {cancelling ? 'Cancelling…' : 'Cancel order'}
            </Button>
          )}
        </aside>
      </main>
    </div>
  );
}
