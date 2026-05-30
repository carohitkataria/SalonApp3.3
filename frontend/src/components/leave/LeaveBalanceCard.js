/**
 * Module 2 — Leave Balance Card.
 *
 * Renders a row of chips with each active paid leave type and the barber's
 * current balance.  Opens a "View ledger" drawer with the full movement
 * audit log.
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Loader2, History, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MOVEMENT_LABEL = {
  monthly_accrual:         'Monthly accrual',
  availed:                 'Leave availed',
  year_open_carry_forward: 'Carried forward',
  year_end_lapse:          'Year-end lapse',
  manual_adjustment:       'Manual adjustment',
  type_renamed:            'Leave type changed',
};

export default function LeaveBalanceCard({ salonId, barberId, barberName, getAuthHeaders }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const authHeaders = useMemo(() => {
    if (typeof getAuthHeaders === 'function') return getAuthHeaders();
    const t = localStorage.getItem('salon_admin_token') || localStorage.getItem('access_token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  }, [getAuthHeaders]);

  const fetchBalance = useCallback(async () => {
    if (!salonId || !barberId) return;
    setLoading(true);
    try {
      const r = await axios.get(
        `${API}/salons/${salonId}/barbers/${barberId}/leave-balance`,
        { headers: authHeaders }
      );
      setData(r.data);
    } catch (e) {
      if (e?.response?.status !== 401) console.error('leave balance fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, [salonId, barberId, authHeaders]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  const items = (data?.items || []).filter(i => i.is_paid !== false);

  if (loading && !data) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading leave balances…
      </div>
    );
  }
  if (!data || items.length === 0) return null;

  return (
    <>
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Leave balances</div>
            <div className="text-sm font-semibold">FY {data.financial_year}</div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDrawerOpen(true)}
            data-testid="leave-ledger-btn"
          >
            <History className="w-3.5 h-3.5 mr-1" /> View ledger
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.map((it) => (
            <div
              key={it.leave_type_code}
              data-testid={`leave-chip-${it.leave_type_code}`}
              className="px-3 py-1.5 rounded-full bg-muted/60 border border-border flex items-center gap-2 text-sm"
            >
              <span className="font-semibold">{it.display_name || it.leave_type_code}:</span>
              <span className="text-gold">{Number(it.current_balance || 0).toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">days</span>
            </div>
          ))}
        </div>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Leave Ledger</SheetTitle>
            <SheetDescription>
              {barberName || ''} · FY {data.financial_year}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-2">
            {items.map(it => (
              <BalanceSummary key={it.leave_type_code} balance={it} />
            ))}
          </div>

          <div className="mt-4 border-t border-border pt-3">
            <LedgerMovements
              salonId={salonId}
              barberId={barberId}
              fy={data.financial_year}
              authHeaders={authHeaders}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}


function BalanceSummary({ balance }) {
  return (
    <div className="bg-muted/40 border border-border rounded-lg p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{balance.display_name || balance.leave_type_code}</span>
        <span className="text-base font-bold text-gold">{Number(balance.current_balance || 0).toFixed(1)} d</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-muted-foreground">
        <span>Opening: <b className="text-foreground">{Number(balance.opening_balance || 0).toFixed(1)}</b></span>
        <span>Accrued: <b className="text-foreground">{Number(balance.accrued_ytd || 0).toFixed(1)}</b></span>
        <span>Availed: <b className="text-foreground">{Number(balance.availed_ytd || 0).toFixed(1)}</b></span>
      </div>
    </div>
  );
}


function LedgerMovements({ salonId, barberId, fy, authHeaders }) {
  const [loading, setLoading] = useState(false);
  const [movements, setMovements] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await axios.get(
          `${API}/salons/${salonId}/barbers/${barberId}/leave-balance/ledger`,
          { headers: authHeaders, params: { financial_year: fy, page: 1, page_size: 100 } }
        );
        if (!cancel) setMovements(r.data?.movements || []);
      } catch (e) {
        if (!cancel) setError(e?.response?.data?.detail || 'Failed to load ledger');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [salonId, barberId, fy, authHeaders]);

  if (loading) return <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading movements…</div>;
  if (error) return <div className="text-sm text-red-500">{error}</div>;
  if (movements.length === 0) return <div className="text-sm text-muted-foreground">No ledger entries yet.</div>;

  return (
    <div className="space-y-1.5">
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Movements</div>
      {movements.map(m => (
        <div key={m.id} className="bg-card border border-border rounded-lg p-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {m.qty_delta >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              )}
              <span className="font-medium">{m.leave_type_code}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground truncate">{MOVEMENT_LABEL[m.movement_type] || m.movement_type}</span>
            </div>
            <span className={`font-bold ${m.qty_delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {m.qty_delta >= 0 ? '+' : ''}{Number(m.qty_delta).toFixed(2)}
            </span>
          </div>
          {(m.reason || m.created_at) && (
            <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
              {m.reason ? ` · ${m.reason}` : ''}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
