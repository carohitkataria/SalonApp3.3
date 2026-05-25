/**
 * Phase 12 — Supplier Orders inbox.
 *
 * Lists every order that has reached at least 'confirmed' (pending_payment
 * orders are intentionally hidden from suppliers until payment lands).
 * Tabs: Confirmed | Shipped | Delivered | Cancelled.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Truck, CheckCircle2, XCircle, Package, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import SupplierLayout from '@/components/supplier/SupplierLayout';
import { useSupplierAuth } from '@/contexts/SupplierAuthContext';
import { extractErrorMessage } from '@/utils/apiError';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STATUS_TABS = [
  { key: '',          label: 'All' },
  { key: 'confirmed', label: 'New' },
  { key: 'shipped',   label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function SupplierOrdersPage() {
  const navigate = useNavigate();
  const { token } = useSupplierAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const authHeaders = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: 1, page_size: 100 };
      if (statusFilter) params.status = statusFilter;
      const r = await axios.get(`${API}/supplier/orders`, { headers: authHeaders, params });
      setOrders(r.data.orders || []);
    } catch (e) {
      toast.error(extractErrorMessage(e, 'Failed to load orders'));
    } finally { setLoading(false); }
  }, [authHeaders, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return (
    <SupplierLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold">Orders</h1>
          <p className="text-sm text-muted-foreground">Manage incoming salon orders end-to-end.</p>
        </div>

        <div className="flex gap-1.5 overflow-x-auto">
          {STATUS_TABS.map(t => (
            <button
              key={t.key || 'all'}
              onClick={() => setStatusFilter(t.key)}
              data-testid={`supplier-orders-tab-${t.key || 'all'}`}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
                statusFilter === t.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:border-primary/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin inline mr-2" /> Loading…</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-xl">
            <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <div className="font-semibold mb-1">No orders here</div>
            <div className="text-xs text-muted-foreground">When salons place orders they'll show up here.</div>
          </div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Order</th>
                  <th className="text-left p-3 hidden sm:table-cell">Buyer</th>
                  <th className="text-left p-3 hidden md:table-cell">Placed</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Total</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-t border-border hover:bg-muted/40" data-testid={`supplier-order-row-${o.id}`}>
                    <td className="p-3">
                      <div className="font-bold">#{o.id.slice(0, 8)}</div>
                      <div className="text-[10px] text-muted-foreground">{(o.items || []).length} items</div>
                    </td>
                    <td className="p-3 hidden sm:table-cell">{o.salon_name || '—'}</td>
                    <td className="p-3 hidden md:table-cell text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</td>
                    <td className="p-3"><StatusPill status={o.order_status} /></td>
                    <td className="p-3 text-right font-bold"><span className="inline-flex items-center"><IndianRupee className="w-3.5 h-3.5" />{Number(o.total_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/supplier/orders/${o.id}`)} data-testid={`supplier-order-view-${o.id}`}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SupplierLayout>
  );
}


export function StatusPill({ status }) {
  const map = {
    confirmed: { label: 'New',       cls: 'bg-blue-500/15 text-blue-600 border-blue-500/40', icon: CheckCircle2 },
    shipped:   { label: 'Shipped',   cls: 'bg-violet-500/15 text-violet-600 border-violet-500/40', icon: Truck },
    delivered: { label: 'Delivered', cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/40', icon: CheckCircle2 },
    cancelled: { label: 'Cancelled', cls: 'bg-rose-500/15 text-rose-600 border-rose-500/40', icon: XCircle },
  };
  const cfg = map[status] || { label: status, cls: 'bg-muted', icon: CheckCircle2 };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}
