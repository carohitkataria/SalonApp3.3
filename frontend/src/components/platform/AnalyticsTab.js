/**
 * Phase 6 (Part A) — Platform Admin Analytics Tab.
 * Pulls aggregated KPIs from /api/platform/dashboard/stats.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Loader2, Building2, Crown, IndianRupee, AlertTriangle, Tag,
  RefreshCw, Pause, Megaphone, Sparkles, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const Kpi = ({ icon: Icon, label, value, sub, tone = 'amber' }) => {
  const tones = {
    amber: 'text-primary bg-primary/10 border-primary/30',
    emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
    rose: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
    violet: 'text-violet-300 bg-violet-500/10 border-violet-500/30',
    sky: 'text-sky-300 bg-sky-500/10 border-sky-500/30',
    zinc: 'text-foreground/80 bg-zinc-500/10 border-zinc-500/30',
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.amber}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold opacity-80">{label}</div>
          <div className="text-2xl font-bold text-foreground mt-1">{value}</div>
          {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
        </div>
        <Icon className="w-5 h-5 opacity-70" />
      </div>
    </div>
  );
};

export default function AnalyticsTab({ headers }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/platform/dashboard/stats`, { headers });
      setStats(r.data);
    } catch (e) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  if (loading && !stats) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!stats) return null;

  const s = stats;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Platform Analytics</h2>
          <p className="text-xs text-muted-foreground/80">Snapshot as of {new Date(s.as_of).toLocaleString('en-IN')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Kpi icon={Building2} label="Total Salons" value={s.salons.total} sub={`${s.salons.active} active · ${s.salons.suspended} suspended`} tone="amber" />
        <Kpi icon={Crown} label="Active Premium" value={s.subscriptions.active} sub={`${s.subscriptions.granted} granted · ${s.subscriptions.expired} expired`} tone="emerald" />
        <Kpi icon={IndianRupee} label="Revenue (MTD)" value={fmtMoney(s.revenue.mtd_amount)} sub={`${s.revenue.mtd_transaction_count} transactions`} tone="sky" />
        <Kpi icon={AlertTriangle} label="Active Overrides" value={s.overrides.active} sub="Comp / branch / trial / pro grants" tone="violet" />
        <Kpi icon={Tag} label="Discount Codes" value={s.discount_codes.active} sub={`${s.discount_codes.total} total · ${s.discount_codes.disabled} disabled`} tone="amber" />
        <Kpi icon={TrendingUp} label="Code Uses (MTD)" value={s.discount_codes.mtd_uses} sub={`${fmtMoney(s.discount_codes.mtd_savings)} saved`} tone="emerald" />
        <Kpi icon={Pause} label="Suspended Salons" value={s.salons.suspended} sub="Includes platform-suspended" tone="rose" />
        <Kpi icon={Sparkles} label="Granted Subs" value={s.subscriptions.granted} sub="Platform-issued active grants" tone="violet" />
        <Kpi icon={Megaphone} label="Suppliers Pending" value={s.suppliers.pending_approval} sub="Awaiting approval (Phase 8)" tone="zinc" />
      </div>

      <div className="rounded-xl border border-border bg-card/40 p-4 text-xs text-muted-foreground">
        <Sparkles className="inline w-3.5 h-3.5 text-primary mr-1 -mt-0.5" />
        Numbers refresh on demand. Revenue is calculated only from successful Cashfree payments in the current calendar month — granted &amp; discounted-free subscriptions are excluded.
      </div>
    </div>
  );
}
