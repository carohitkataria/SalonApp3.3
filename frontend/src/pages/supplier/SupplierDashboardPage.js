/**
 * Phase 9 — Supplier Dashboard page.
 * 4 KPI cards + category breakdown + low-stock callout.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Loader2, ShoppingCart, Boxes, AlertTriangle, IndianRupee,
  TrendingUp, ArrowRight, Sparkles,
} from 'lucide-react';
import { useSupplierAuth } from '@/contexts/SupplierAuthContext';
import SupplierLayout from '@/components/supplier/SupplierLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const Kpi = ({ icon: Icon, label, value, sub, tone = 'amber', to, testid }) => {
  const tones = {
    amber: 'text-primary bg-primary/10 border-primary/30 hover:border-primary/60',
    emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60',
    rose: 'text-rose-300 bg-rose-500/10 border-rose-500/30 hover:border-rose-500/60',
    sky: 'text-sky-300 bg-sky-500/10 border-sky-500/30 hover:border-sky-500/60',
  };
  const inner = (
    <div data-testid={testid} className={`rounded-2xl border p-5 transition-colors ${tones[tone] || tones.amber}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold opacity-80">{label}</div>
          <div className="text-3xl font-bold text-foreground mt-1">{value}</div>
          {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
        </div>
        <Icon className="w-6 h-6 opacity-70" />
      </div>
    </div>
  );
  if (to) return <Link to={to}>{inner}</Link>;
  return inner;
};

export default function SupplierDashboardPage() {
  const { authHeaders, supplier } = useSupplierAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!authHeaders) return;
    setLoading(true);
    try {
      const r = await axios.get(`${API}/supplier/dashboard/stats`, { headers: authHeaders });
      setStats(r.data);
    } catch (e) {
      console.error('Failed to load stats', e);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <SupplierLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back, <span className="text-primary">{supplier?.owner_name?.split(' ')[0] || 'Supplier'}</span> 👋
        </h1>
        <p className="text-sm text-muted-foreground/80 mt-1">Here's your business at a glance.</p>
      </div>

      {loading && !stats ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : !stats ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm p-4">Could not load dashboard.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid="supplier-dashboard-kpis">
            <Kpi
              icon={ShoppingCart}
              label="Orders pending"
              value={stats.orders_pending}
              sub="Awaiting your action"
              tone="amber"
              testid="supplier-dashboard-kpi-orders"
            />
            <Kpi
              icon={Boxes}
              label="Products live"
              value={stats.products_live}
              sub={`${stats.products_by_category?.length || 0} categories`}
              tone="emerald"
              to="/supplier/products"
              testid="supplier-dashboard-kpi-products"
            />
            <Kpi
              icon={AlertTriangle}
              label="Low stock items"
              value={stats.low_stock_count}
              sub="Re-stock soon"
              tone="rose"
              to="/supplier/products"
              testid="supplier-dashboard-kpi-lowstock"
            />
            <Kpi
              icon={IndianRupee}
              label="GMV (MTD)"
              value={fmtMoney(stats.mtd_gmv)}
              sub="Gross value this month"
              tone="sky"
              testid="supplier-dashboard-kpi-gmv"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Category breakdown */}
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card/40 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Products by category</h3>
                <Link to="/supplier/products" className="text-xs text-primary hover:text-primary font-bold uppercase tracking-widest flex items-center gap-1">
                  Manage <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {stats.products_by_category?.length > 0 ? (
                <div className="space-y-3">
                  {stats.products_by_category.map((c) => {
                    const max = Math.max(...stats.products_by_category.map(x => x.count));
                    const pct = max > 0 ? Math.round((c.count / max) * 100) : 0;
                    return (
                      <div key={c.category}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-foreground/80 font-medium capitalize">{c.category}</span>
                          <span className="text-muted-foreground/80 font-mono">{c.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center">
                  <Boxes className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No products yet.</p>
                  <Link to="/supplier/products" className="inline-flex items-center gap-1 mt-3 text-primary text-xs font-bold uppercase tracking-widest hover:text-primary">
                    <Sparkles className="w-3 h-3" /> Add your first product <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="rounded-2xl border border-border bg-card/40 p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">Quick actions</h3>
              <div className="space-y-2">
                <Link to="/supplier/products?action=add" className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/40 hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">Add a product</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/80" />
                </Link>
                <Link to="/supplier/products?action=samples" className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/40 hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">Browse samples</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/80" />
                </Link>
              </div>
              <div className="mt-6 pt-4 border-t border-border text-xs text-muted-foreground/80">
                Updated {new Date(stats.as_of).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </>
      )}
    </SupplierLayout>
  );
}
