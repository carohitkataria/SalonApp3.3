import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Award, RefreshCw, Download, IndianRupee, CheckCircle2, Clock, PauseCircle,
  TrendingUp, Users, Filter, AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STATUS_STYLES = {
  Pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40',
  Approved: 'bg-blue-500/15 text-blue-400 border-blue-500/40',
  Paid: 'bg-green-500/15 text-green-400 border-green-500/40',
  Hold: 'bg-red-500/15 text-red-400 border-red-500/40',
};

const STATUS_ICONS = {
  Pending: Clock,
  Approved: CheckCircle2,
  Paid: IndianRupee,
  Hold: PauseCircle,
};

const todayMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthsInRange = (startYM, endYM) => {
  // both inclusive YYYY-MM
  const [sy, sm] = startYM.split('-').map(Number);
  const [ey, em] = endYM.split('-').map(Number);
  const out = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
};

const fmtINR = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function IncentiveDashboard({ salonId, getAuthHeaders, isAdmin = true }) {
  const [month, setMonth] = useState(todayMonth());
  const [barberFilter, setBarberFilter] = useState('all');
  const [rows, setRows] = useState([]);
  const [eligibleBarbers, setEligibleBarbers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [payDialog, setPayDialog] = useState({ open: false, row: null, method: 'cash', amount: '' });
  const [approveDialog, setApproveDialog] = useState({ open: false, row: null, amount: '' });
  const [exporting, setExporting] = useState(false);
  const [exportRange, setExportRange] = useState({ start: todayMonth(), end: todayMonth() });

  const loadIncentives = useCallback(async () => {
    if (!salonId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ month });
      if (barberFilter && barberFilter !== 'all') params.append('barber_id', barberFilter);
      const res = await axios.get(
        `${API}/salons/${salonId}/reward-plan/incentives?${params.toString()}`,
        { headers: getAuthHeaders() }
      );
      setRows(res.data?.incentives || []);
      setSelected(new Set());
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.detail || 'Failed to load incentives';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [salonId, month, barberFilter, getAuthHeaders]);

  const loadBarbers = useCallback(async () => {
    if (!salonId) return;
    try {
      const res = await axios.get(
        `${API}/salons/${salonId}/reward-plan/eligible-barbers`,
        { headers: getAuthHeaders() }
      );
      setEligibleBarbers(res.data?.barbers || []);
    } catch (err) {
      // Not critical
    }
  }, [salonId, getAuthHeaders]);

  useEffect(() => { loadBarbers(); }, [loadBarbers]);
  useEffect(() => { loadIncentives(); }, [loadIncentives]);

  const summary = useMemo(() => {
    const eff = (r) => (r.manual_amount != null ? r.manual_amount : r.incentive_earned) || 0;
    const total = rows.reduce((a, r) => a + eff(r), 0);
    const paid = rows.filter(r => r.status === 'Paid').reduce((a, r) => a + eff(r), 0);
    const approved = rows.filter(r => r.status === 'Approved').reduce((a, r) => a + eff(r), 0);
    const pending = rows.filter(r => r.status === 'Pending').reduce((a, r) => a + eff(r), 0);
    const onHold = rows.filter(r => r.status === 'Hold').reduce((a, r) => a + eff(r), 0);
    const eligibleCount = rows.filter(r => eff(r) > 0).length;
    const avgAch = rows.length
      ? rows.reduce((a, r) => a + (r.achievement_pct || 0), 0) / rows.length
      : 0;
    return { total, paid, approved, pending, onHold, eligibleCount, avgAch };
  }, [rows]);

  const toggleSelect = (key) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === rows.length && rows.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map(r => `${r.barber_id}__${r.month}`)));
    }
  };

  const updateStatus = async (barberId, m, payload, silent = false) => {
    const res = await axios.put(
      `${API}/salons/${salonId}/reward-plan/incentives/${barberId}/${m}/status`,
      payload,
      { headers: getAuthHeaders() }
    );
    if (!silent) toast.success(`Marked ${payload.status}`);
    return res.data?.payout;
  };

  const handleSingleStatus = async (row, status) => {
    if (!isAdmin) {
      toast.error('Only admin can change status');
      return;
    }
    if (status === 'Approved') {
      // Open approve dialog so admin can adjust the amount before approving
      const current = (row.manual_amount != null ? row.manual_amount : row.incentive_earned) || 0;
      setApproveDialog({ open: true, row, amount: String(current) });
      return;
    }
    if (status === 'Paid') {
      // Pre-fill with current effective amount (manual override or auto)
      const current = (row.manual_amount != null ? row.manual_amount : row.incentive_earned) || 0;
      setPayDialog({ open: true, row, method: 'cash', amount: String(current) });
      return;
    }
    try {
      await updateStatus(row.barber_id, row.month, { status });
      await loadIncentives();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to update status');
    }
  };

  const confirmApprove = async () => {
    const { row, amount } = approveDialog;
    if (!row) return;
    const num = parseFloat(amount);
    if (Number.isNaN(num) || num < 0) {
      toast.error('Enter a valid incentive amount');
      return;
    }
    try {
      const payload = { status: 'Approved' };
      // Send manual override only when admin changed the amount
      const auto = Number(row.incentive_earned || 0);
      if (Math.abs(num - auto) > 0.001 || row.manual_amount != null) {
        payload.manual_amount = num;
      }
      await updateStatus(row.barber_id, row.month, payload);
      setApproveDialog({ open: false, row: null, amount: '' });
      await loadIncentives();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to approve');
    }
  };

  const confirmPay = async () => {
    const { row, method, amount } = payDialog;
    if (!row) return;
    const num = parseFloat(amount);
    if (Number.isNaN(num) || num <= 0) {
      toast.error('Enter a valid payout amount');
      return;
    }
    try {
      const payload = { status: 'Paid', payment_method: method };
      const auto = Number(row.incentive_earned || 0);
      if (Math.abs(num - auto) > 0.001 || row.manual_amount != null) {
        payload.manual_amount = num;
      }
      await updateStatus(row.barber_id, row.month, payload);
      toast.success(`Paid via ${method.toUpperCase()} — synced to Financials`);
      setPayDialog({ open: false, row: null, method: 'cash', amount: '' });
      await loadIncentives();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to mark Paid');
    }
  };

  const handleBulk = async (status) => {
    if (!isAdmin) {
      toast.error('Only admin can change status');
      return;
    }
    if (selected.size === 0) {
      toast.error('Select rows first');
      return;
    }
    if (status === 'Paid') {
      toast.error('Bulk Pay is not allowed — open each row to set payment method');
      return;
    }
    const targets = rows.filter(r => selected.has(`${r.barber_id}__${r.month}`));
    let ok = 0, fail = 0;
    for (const r of targets) {
      try {
        await updateStatus(r.barber_id, r.month, { status }, true);
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    toast.success(`${ok} updated to ${status}${fail ? `, ${fail} failed` : ''}`);
    await loadIncentives();
  };

  const exportToCSV = async () => {
    setExporting(true);
    try {
      const months = monthsInRange(exportRange.start, exportRange.end);
      if (months.length === 0) {
        toast.error('Invalid date range');
        return;
      }
      // fetch each month sequentially to keep load low
      const all = [];
      for (const m of months) {
        try {
          const res = await axios.get(
            `${API}/salons/${salonId}/reward-plan/incentives?month=${m}`,
            { headers: getAuthHeaders() }
          );
          for (const row of (res.data?.incentives || [])) {
            all.push(row);
          }
        } catch {
          // skip
        }
      }
      if (all.length === 0) {
        toast.error('No data in selected range');
        return;
      }
      const headers = [
        'Month', 'Employee', 'Salary', 'Target', 'Actual Sales',
        'Achievement %', 'Auto Incentive', 'Adjusted Incentive', 'Effective Payout',
        'Status', 'Payment Method', 'Paid At', 'Notes'
      ];
      const csv = [
        headers.join(','),
        ...all.map(r => {
          const auto = r.incentive_earned || 0;
          const adjusted = r.manual_amount != null ? r.manual_amount : '';
          const effective = r.manual_amount != null ? r.manual_amount : auto;
          return [
            r.month,
            `"${(r.barber_name || '').replace(/"/g, '""')}"`,
            r.salary || 0,
            r.target || 0,
            r.actual_sales || 0,
            (r.achievement_pct || 0).toFixed(2),
            auto,
            adjusted,
            effective,
            r.status || 'Pending',
            r.payment_method || '',
            r.paid_at || '',
            `"${(r.notes || '').replace(/"/g, '""')}"`,
          ].join(',');
        })
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `incentives_${exportRange.start}_to_${exportRange.end}.csv`;
      link.click();
      toast.success(`Exported ${all.length} rows`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="incentive-dashboard">
      {/* Header */}
      <div className="bg-card/50 backdrop-blur-sm border border-gold/20 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-playfair font-bold text-foreground flex items-center">
              <Award className="w-6 h-6 mr-3 text-gold" />
              Employee Incentive Dashboard
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Approve and disburse monthly incentive payouts. "Paid" entries auto-sync to Financials.
            </p>
          </div>
          <Button
            onClick={loadIncentives}
            variant="outline"
            size="sm"
            className="border-gold/30"
            disabled={loading}
            data-testid="incentive-refresh-btn"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Recalculate
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <Label className="mb-2 block text-xs">Month</Label>
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              data-testid="incentive-month-input"
            />
          </div>
          <div>
            <Label className="mb-2 block text-xs">Employee</Label>
            <Select value={barberFilter} onValueChange={setBarberFilter}>
              <SelectTrigger data-testid="incentive-barber-filter">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {eligibleBarbers.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="lg:col-span-2 flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[140px]">
              <Label className="mb-2 block text-xs">Export From</Label>
              <Input
                type="month"
                value={exportRange.start}
                onChange={(e) => setExportRange(s => ({ ...s, start: e.target.value }))}
                data-testid="incentive-export-from"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <Label className="mb-2 block text-xs">Export To</Label>
              <Input
                type="month"
                value={exportRange.end}
                onChange={(e) => setExportRange(s => ({ ...s, end: e.target.value }))}
                data-testid="incentive-export-to"
              />
            </div>
            <Button
              onClick={exportToCSV}
              variant="outline"
              size="sm"
              className="border-gold/30"
              disabled={exporting}
              data-testid="incentive-export-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        </div>
      </div>

      {/* Summary single-row badges */}
      <div className="bg-card/50 backdrop-blur-sm border border-gold/20 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground mr-2">
            <TrendingUp className="w-3 h-3 inline mr-1" /> Summary
          </span>
          <Badge label="Eligible" value={summary.eligibleCount} testid="summary-eligible" />
          <Badge label="Avg Achievement" value={`${summary.avgAch.toFixed(1)}%`} testid="summary-avg-ach" tone="blue" />
          <Badge label="Total Earned" value={fmtINR(summary.total)} testid="summary-total" tone="gold" />
          <Badge label="Approved" value={fmtINR(summary.approved)} testid="summary-approved" tone="blue" />
          <Badge label="Paid" value={fmtINR(summary.paid)} testid="summary-paid" tone="green" />
          <Badge label="Pending" value={fmtINR(summary.pending)} testid="summary-pending" tone="yellow" />
          {summary.onHold > 0 && (
            <Badge label="On Hold" value={fmtINR(summary.onHold)} testid="summary-hold" tone="red" />
          )}
        </div>
      </div>

      {/* Bulk actions bar */}
      {isAdmin && (
        <div className="bg-card/40 border border-gold/15 rounded-xl p-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground flex items-center mr-2">
            <Filter className="w-3 h-3 mr-1" />
            {selected.size > 0 ? `${selected.size} selected` : 'Bulk actions'}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0}
            onClick={() => handleBulk('Approved')}
            className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
            data-testid="bulk-approve-btn"
          >
            <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0}
            onClick={() => handleBulk('Hold')}
            className="border-red-500/40 text-red-400 hover:bg-red-500/10"
            data-testid="bulk-hold-btn"
          >
            <PauseCircle className="w-3 h-3 mr-1" /> Hold
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0}
            onClick={() => handleBulk('Pending')}
            className="border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10"
            data-testid="bulk-reset-btn"
          >
            <Clock className="w-3 h-3 mr-1" /> Reset to Pending
          </Button>
          <span className="text-xs text-muted-foreground ml-2">
            <AlertCircle className="w-3 h-3 inline mr-1" />
            Pay must be done per-row to capture payment method.
          </span>
        </div>
      )}

      {/* Rows */}
      <div className="space-y-3">
        {/* Select-all header */}
        {rows.length > 0 && isAdmin && (
          <div className="flex items-center pl-4 pr-2 text-xs text-muted-foreground">
            <Checkbox
              checked={selected.size === rows.length && rows.length > 0}
              onCheckedChange={toggleSelectAll}
              data-testid="bulk-select-all"
            />
            <span className="ml-3">Select all</span>
          </div>
        )}

        {loading && (
          <div className="text-center py-12 text-muted-foreground">Loading…</div>
        )}

        {!loading && rows.length === 0 && (
          <div className="text-center py-12 bg-card/30 border border-dashed border-gold/20 rounded-xl">
            <Users className="w-10 h-10 mx-auto text-gold/40 mb-3" />
            <p className="text-muted-foreground">
              No incentive data for {month}. Configure a Reward Plan from Staff Management.
            </p>
          </div>
        )}

        {!loading && rows.map((r, idx) => {
          const key = `${r.barber_id}__${r.month}`;
          const StatusIcon = STATUS_ICONS[r.status] || Clock;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              className="bg-card/50 backdrop-blur-sm border border-gold/20 rounded-xl p-4 shadow"
              data-testid={`incentive-row-${r.barber_id}`}
            >
              {/* Row 1 — name + status + actions */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3">
                  {isAdmin && (
                    <Checkbox
                      className="mt-1"
                      checked={selected.has(key)}
                      onCheckedChange={() => toggleSelect(key)}
                      data-testid={`select-${r.barber_id}`}
                    />
                  )}
                  <div>
                    <p className="font-bold text-foreground text-base">
                      {r.barber_name || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Month: {r.month}
                      {r.payment_method ? ` • Paid via ${r.payment_method.toUpperCase()}` : ''}
                    </p>
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${STATUS_STYLES[r.status] || STATUS_STYLES.Pending}`}>
                  <StatusIcon className="w-3 h-3" />
                  {r.status || 'Pending'}
                </div>
              </div>

              {/* Row 2 — single-row badges */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge label="Salary" value={fmtINR(r.salary)} testid={`salary-${r.barber_id}`} />
                <Badge label="Target" value={fmtINR(r.target)} testid={`target-${r.barber_id}`} />
                <Badge label="Actual" value={fmtINR(r.actual_sales)} testid={`actual-${r.barber_id}`} tone="blue" />
                <Badge
                  label="Achievement"
                  value={`${(r.achievement_pct || 0).toFixed(1)}%`}
                  testid={`ach-${r.barber_id}`}
                  tone={(r.achievement_pct || 0) >= 100 ? 'green' : 'yellow'}
                />
                {r.manual_amount != null ? (
                  <>
                    <Badge
                      label="Auto"
                      value={fmtINR(r.incentive_earned)}
                      testid={`auto-${r.barber_id}`}
                    />
                    <Badge
                      label="Adjusted"
                      value={fmtINR(r.manual_amount)}
                      testid={`earned-${r.barber_id}`}
                      tone="gold"
                      emphasis
                    />
                  </>
                ) : (
                  <Badge
                    label="Earned"
                    value={fmtINR(r.incentive_earned)}
                    testid={`earned-${r.barber_id}`}
                    tone="gold"
                    emphasis
                  />
                )}
              </div>

              {/* Row 3 — actions */}
              {isAdmin && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gold/10">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                    onClick={() => handleSingleStatus(r, 'Approved')}
                    disabled={r.status === 'Approved' || r.status === 'Paid'}
                    data-testid={`approve-${r.barber_id}`}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-green-500/40 text-green-400 hover:bg-green-500/10"
                    onClick={() => handleSingleStatus(r, 'Paid')}
                    disabled={r.status === 'Paid'}
                    data-testid={`pay-${r.barber_id}`}
                  >
                    <IndianRupee className="w-3 h-3 mr-1" /> Mark Paid
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/40 text-red-400 hover:bg-red-500/10"
                    onClick={() => handleSingleStatus(r, 'Hold')}
                    disabled={r.status === 'Hold' || r.status === 'Paid'}
                    data-testid={`hold-${r.barber_id}`}
                  >
                    <PauseCircle className="w-3 h-3 mr-1" /> Hold
                  </Button>
                  {r.status !== 'Pending' && r.status !== 'Paid' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSingleStatus(r, 'Pending')}
                      data-testid={`reset-${r.barber_id}`}
                    >
                      <Clock className="w-3 h-3 mr-1" /> Reset
                    </Button>
                  )}
                  {r.linked_expense_id && (
                    <span className="text-xs text-green-500/80 self-center ml-auto">
                      ✓ Synced to Financials
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Pay Dialog */}
      <Dialog open={payDialog.open} onOpenChange={(o) => setPayDialog(p => ({ ...p, open: o }))}>
        <DialogContent data-testid="pay-dialog">
          <DialogHeader>
            <DialogTitle>Mark Incentive Paid</DialogTitle>
            <DialogDescription>
              {payDialog.row && (
                <span>
                  Pay <b>{payDialog.row.barber_name}</b> for <b>{payDialog.row.month}</b>.
                  This will create a linked expense entry in Financials.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Payout Amount (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={payDialog.amount}
                onChange={(e) => setPayDialog(p => ({ ...p, amount: e.target.value }))}
                data-testid="pay-amount-input"
              />
              {payDialog.row && (
                <p className="text-xs text-muted-foreground mt-1">
                  Auto-calculated: {fmtINR(payDialog.row.incentive_earned)}. You may adjust before paying.
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Payment Method</Label>
              <Select
                value={payDialog.method}
                onValueChange={(v) => setPayDialog(p => ({ ...p, method: v }))}
              >
                <SelectTrigger data-testid="pay-method-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPayDialog({ open: false, row: null, method: 'cash', amount: '' })}
              data-testid="pay-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmPay}
              className="bg-green-500/80 text-white hover:bg-green-500"
              data-testid="pay-confirm-btn"
            >
              <IndianRupee className="w-4 h-4 mr-1" /> Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog (with manual amount adjustment) */}
      <Dialog open={approveDialog.open} onOpenChange={(o) => setApproveDialog(p => ({ ...p, open: o }))}>
        <DialogContent data-testid="approve-dialog">
          <DialogHeader>
            <DialogTitle>Approve Incentive</DialogTitle>
            <DialogDescription>
              {approveDialog.row && (
                <span>
                  Approve incentive for <b>{approveDialog.row.barber_name}</b> ({approveDialog.row.month}).
                  Adjust the amount if needed before approving.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Approved Amount (₹)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={approveDialog.amount}
              onChange={(e) => setApproveDialog(p => ({ ...p, amount: e.target.value }))}
              data-testid="approve-amount-input"
            />
            {approveDialog.row && (
              <p className="text-xs text-muted-foreground">
                Auto-calculated: {fmtINR(approveDialog.row.incentive_earned)}. Approving here only locks the
                amount — Financials entry is created when you mark it Paid.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialog({ open: false, row: null, amount: '' })}
              data-testid="approve-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmApprove}
              className="bg-blue-500/80 text-white hover:bg-blue-500"
              data-testid="approve-confirm-btn"
            >
              <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Badge({ label, value, testid, tone = 'default', emphasis = false }) {
  const tones = {
    default: 'bg-card/80 border-border text-foreground',
    gold: 'bg-gold/10 border-gold/40 text-gold',
    green: 'bg-green-500/10 border-green-500/40 text-green-400',
    blue: 'bg-blue-500/10 border-blue-500/40 text-blue-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400',
    red: 'bg-red-500/10 border-red-500/40 text-red-400',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs ${tones[tone] || tones.default} ${emphasis ? 'font-bold' : ''}`}
      data-testid={testid}
    >
      <span className="opacity-70">{label}:</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}
