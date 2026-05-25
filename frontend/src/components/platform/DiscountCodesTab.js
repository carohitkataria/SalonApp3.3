/**
 * Phase 6 (Part D) — Platform Admin Discount Codes Tab.
 * Full CRUD: list / create / edit / disable / view usages.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
  Loader2, Tag, Plus, RefreshCw, Edit3, Power, Eye, X, Calendar,
  TrendingUp, AlertCircle, Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return iso; }
};
const fmtTs = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-IN'); } catch { return iso; }
};
const fmtMoney = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const STATUS_STYLES = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  disabled: 'bg-zinc-500/15 text-foreground/80 border-zinc-500/30',
  expired: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  exhausted: 'bg-primary/15 text-primary border-primary/30',
};

const TYPE_LABEL = {
  free_months: 'Free months',
  percent: 'Percent off',
  flat_per_month: 'Flat / month',
};

const emptyForm = {
  code: '',
  discount_type: 'free_months',
  free_months: 1,
  percent_off: '',
  flat_off_per_month: '',
  duration_months: 1,
  max_total_uses: '',
  max_uses_per_salon: 1,
  valid_from: '',
  valid_until: '',
  is_new_salons_only: false,
  description: '',
  applies_to_branches: 'all',
  applies_to_first_n_branches: '',
};

function CodeFormModal({ open, onClose, initial, onSaved, headers }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setErr('');
      if (initial) {
        setForm({
          code: initial.code || '',
          discount_type: initial.discount_type || 'free_months',
          free_months: initial.free_months ?? 1,
          percent_off: initial.percent_off ?? '',
          flat_off_per_month: initial.flat_off_per_month ?? '',
          duration_months: initial.duration_months ?? 1,
          max_total_uses: initial.max_total_uses ?? '',
          max_uses_per_salon: initial.max_uses_per_salon ?? 1,
          valid_from: initial.valid_from ? initial.valid_from.substring(0, 10) : '',
          valid_until: initial.valid_until ? initial.valid_until.substring(0, 10) : '',
          is_new_salons_only: !!initial.is_new_salons_only,
          description: initial.description || '',
          applies_to_branches: initial.applies_to_branches || 'all',
          applies_to_first_n_branches: initial.applies_to_first_n_branches ?? '',
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [open, initial]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    setErr('');
    // Inline validation
    if (!isEdit && !/^[A-Z0-9_-]{3,40}$/i.test(form.code)) {
      setErr('Code must be 3–40 chars, letters/digits/_/- only');
      return;
    }
    if (form.discount_type === 'free_months' && (!form.free_months || form.free_months < 1)) {
      setErr('free_months must be ≥ 1');
      return;
    }
    if (form.discount_type === 'percent' && (!form.percent_off || form.percent_off <= 0 || form.percent_off > 100)) {
      setErr('percent_off must be between 1 and 100');
      return;
    }
    if (form.discount_type === 'flat_per_month' && (!form.flat_off_per_month || form.flat_off_per_month <= 0)) {
      setErr('flat_off_per_month must be > 0');
      return;
    }
    if (form.valid_from && form.valid_until && new Date(form.valid_until) <= new Date(form.valid_from)) {
      setErr('valid_until must be after valid_from');
      return;
    }
    if (form.applies_to_branches === 'first_n' && (!form.applies_to_first_n_branches || form.applies_to_first_n_branches < 1)) {
      setErr('applies_to_first_n_branches required when applies_to_branches=first_n');
      return;
    }

    const payload = {
      discount_type: form.discount_type,
      duration_months: parseInt(form.duration_months) || 1,
      max_uses_per_salon: parseInt(form.max_uses_per_salon) || 1,
      is_new_salons_only: !!form.is_new_salons_only,
      description: form.description || null,
      applies_to_branches: form.applies_to_branches || 'all',
    };
    if (!isEdit) payload.code = form.code.toUpperCase().trim();
    if (form.discount_type === 'free_months') payload.free_months = parseInt(form.free_months);
    if (form.discount_type === 'percent') payload.percent_off = parseFloat(form.percent_off);
    if (form.discount_type === 'flat_per_month') payload.flat_off_per_month = parseFloat(form.flat_off_per_month);
    if (form.applies_to_branches === 'first_n') payload.applies_to_first_n_branches = parseInt(form.applies_to_first_n_branches);
    if (form.max_total_uses !== '' && form.max_total_uses !== null) payload.max_total_uses = parseInt(form.max_total_uses);
    else payload.max_total_uses = null;
    if (form.valid_from) payload.valid_from = new Date(form.valid_from).toISOString();
    else payload.valid_from = null;
    if (form.valid_until) payload.valid_until = new Date(form.valid_until).toISOString();
    else payload.valid_until = null;

    setSubmitting(true);
    try {
      if (isEdit) {
        const { code, ...editPayload } = payload; // eslint-disable-line no-unused-vars
        await axios.put(`${API}/platform/discount-codes/${initial.id}`, editPayload, { headers });
        toast.success('Code updated');
      } else {
        await axios.post(`${API}/platform/discount-codes`, payload, { headers });
        toast.success('Code created');
      }
      onSaved();
      onClose();
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Failed to save';
      setErr(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-background border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-primary flex items-center gap-2">
            <Tag className="w-4 h-4" /> {isEdit ? 'Edit' : 'Create'} discount code
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {!isEdit && (
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Code</label>
              <Input
                value={form.code}
                onChange={(e) => set('code', e.target.value.toUpperCase())}
                placeholder="LAUNCH50"
                className="mt-1 bg-card border-border text-foreground font-mono uppercase"
                maxLength={40}
              />
              <div className="text-[10px] text-muted-foreground/80 mt-1">3–40 chars, letters/digits/underscore/hyphen.</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Type</label>
              <select
                value={form.discount_type}
                onChange={(e) => set('discount_type', e.target.value)}
                disabled={isEdit}
                className="mt-1 w-full bg-card border border-border text-foreground rounded-md px-3 h-10 disabled:opacity-50"
              >
                <option value="free_months">Free months (skip Cashfree)</option>
                <option value="percent">Percent off</option>
                <option value="flat_per_month">Flat ₹ off per month</option>
              </select>
            </div>

            {form.discount_type === 'free_months' && (
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Free months</label>
                <Input type="number" min="1" value={form.free_months} onChange={(e) => set('free_months', e.target.value)} className="mt-1 bg-card border-border text-foreground" />
              </div>
            )}
            {form.discount_type === 'percent' && (
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Percent off (1–100)</label>
                <Input type="number" min="1" max="100" value={form.percent_off} onChange={(e) => set('percent_off', e.target.value)} className="mt-1 bg-card border-border text-foreground" />
              </div>
            )}
            {form.discount_type === 'flat_per_month' && (
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Flat ₹ off per month</label>
                <Input type="number" min="1" value={form.flat_off_per_month} onChange={(e) => set('flat_off_per_month', e.target.value)} className="mt-1 bg-card border-border text-foreground" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Duration (months)</label>
              <Input type="number" min="1" value={form.duration_months} onChange={(e) => set('duration_months', e.target.value)} className="mt-1 bg-card border-border text-foreground" />
              <div className="text-[10px] text-muted-foreground/80 mt-1">For percent/flat — used for display only.</div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Max uses (global)</label>
              <Input type="number" min="1" value={form.max_total_uses} onChange={(e) => set('max_total_uses', e.target.value)} placeholder="Unlimited" className="mt-1 bg-card border-border text-foreground" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Max uses / salon</label>
              <Input type="number" min="1" value={form.max_uses_per_salon} onChange={(e) => set('max_uses_per_salon', e.target.value)} className="mt-1 bg-card border-border text-foreground" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Applies to branches</label>
              <select
                value={form.applies_to_branches}
                onChange={(e) => set('applies_to_branches', e.target.value)}
                className="mt-1 w-full bg-card border border-border text-foreground rounded-md px-3 h-10"
              >
                <option value="all">All billable branches</option>
                <option value="first_n">First N branches only</option>
              </select>
            </div>
            {form.applies_to_branches === 'first_n' && (
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">First N branches</label>
                <Input type="number" min="1" value={form.applies_to_first_n_branches} onChange={(e) => set('applies_to_first_n_branches', e.target.value)} className="mt-1 bg-card border-border text-foreground" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Valid from</label>
              <Input type="date" value={form.valid_from} onChange={(e) => set('valid_from', e.target.value)} className="mt-1 bg-card border-border text-foreground" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Valid until</label>
              <Input type="date" value={form.valid_until} onChange={(e) => set('valid_until', e.target.value)} className="mt-1 bg-card border-border text-foreground" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground/80 cursor-pointer">
            <input type="checkbox" checked={form.is_new_salons_only} onChange={(e) => set('is_new_salons_only', e.target.checked)} className="rounded" />
            New salons only (salon must have never subscribed before)
          </label>

          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Description (internal)</label>
            <Input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Launch promo for Q3" className="mt-1 bg-card border-border text-foreground" />
          </div>

          {err && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{err}</div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create code'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UsagesDrawer({ code, onClose, headers }) {
  const [usages, setUsages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    axios.get(`${API}/platform/discount-codes/${code.id}/usages`, { headers })
      .then(r => setUsages(r.data?.usages || []))
      .catch(() => toast.error('Failed to load usages'))
      .finally(() => setLoading(false));
  }, [code, headers]);

  return (
    <Dialog open={!!code} onOpenChange={() => onClose()}>
      <DialogContent className="bg-background border-border text-foreground max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-primary flex items-center gap-2">
            <Eye className="w-4 h-4" /> Usages — <span className="font-mono">{code?.code}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/80 font-bold">Total uses</div>
              <div className="text-xl font-bold text-foreground">{code?.current_uses || 0}{code?.max_total_uses ? `/${code.max_total_uses}` : ''}</div>
            </div>
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/80 font-bold">Salons benefited</div>
              <div className="text-xl font-bold text-foreground">{new Set(usages.map(u => u.salon_id)).size}</div>
            </div>
            <div className="rounded-lg border border-border bg-card/60 p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/80 font-bold">Total saved</div>
              <div className="text-xl font-bold text-foreground">{fmtMoney(usages.reduce((s, u) => s + (u.discount_amount || 0), 0))}</div>
            </div>
          </div>
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : usages.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground/80 text-xs">No usages yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-background/60">
                  <tr className="text-[10px] uppercase tracking-widest text-muted-foreground/80 border-b border-border">
                    <th className="text-left px-3 py-2 font-bold">Salon</th>
                    <th className="text-left px-3 py-2 font-bold">Subscription</th>
                    <th className="text-right px-3 py-2 font-bold">Base</th>
                    <th className="text-right px-3 py-2 font-bold">Discount</th>
                    <th className="text-right px-3 py-2 font-bold">Final</th>
                    <th className="text-left px-3 py-2 font-bold">Applied</th>
                  </tr>
                </thead>
                <tbody>
                  {usages.map(u => (
                    <tr key={u.id} className="border-b border-border/40 last:border-0">
                      <td className="px-3 py-2 text-foreground/80 font-mono text-xs">{u.salon_name || u.salon_id?.substring(0, 8)}</td>
                      <td className="px-3 py-2 text-muted-foreground/80 font-mono text-xs">{u.subscription_id?.substring(0, 8)}</td>
                      <td className="px-3 py-2 text-right text-foreground/80">{fmtMoney(u.base_amount)}</td>
                      <td className="px-3 py-2 text-right text-emerald-300">−{fmtMoney(u.discount_amount)}</td>
                      <td className="px-3 py-2 text-right font-bold text-foreground">{fmtMoney(u.final_amount)}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs">{fmtTs(u.applied_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DiscountCodesTab({ headers }) {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [usagesFor, setUsagesFor] = useState(null);
  const [actionBusy, setActionBusy] = useState(null);

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/platform/discount-codes`, {
        headers,
        params: statusFilter ? { status: statusFilter } : {},
      });
      setCodes(r.data?.codes || r.data || []);
    } catch (e) {
      toast.error('Failed to load codes');
    } finally {
      setLoading(false);
    }
  }, [headers, statusFilter]);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return codes;
    return codes.filter(c =>
      (c.code || '').toLowerCase().includes(needle) ||
      (c.description || '').toLowerCase().includes(needle),
    );
  }, [codes, q]);

  const toggleDisable = async (c) => {
    setActionBusy(c.id);
    try {
      if (c.status === 'disabled') {
        await axios.post(`${API}/platform/discount-codes/${c.id}/enable`, {}, { headers });
        toast.success('Code enabled');
      } else {
        await axios.post(`${API}/platform/discount-codes/${c.id}/disable`, {}, { headers });
        toast.success('Code disabled');
      }
      fetchCodes();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed');
    } finally {
      setActionBusy(null);
    }
  };

  const copyCode = (code) => {
    try {
      navigator.clipboard.writeText(code);
      toast.success(`Copied ${code}`);
    } catch {
      toast.error('Copy failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Tag className="w-5 h-5 text-primary" /> Discount codes</h2>
          <p className="text-xs text-muted-foreground/80">Create promo codes salons can apply at checkout.</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
          <Plus className="w-4 h-4 mr-1" /> Create code
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search code or description..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 min-w-[200px] bg-background border-border text-foreground"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-background border border-border text-foreground text-sm rounded-md px-3 h-10"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="expired">Expired</option>
          <option value="exhausted">Exhausted</option>
        </select>
        <Button variant="outline" size="sm" onClick={fetchCodes} disabled={loading}>
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="bg-card/60 border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground/80 text-sm">
            <Tag className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            No codes match.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background/60">
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground/80 border-b border-border">
                  <th className="text-left px-4 py-3 font-bold">Code</th>
                  <th className="text-left px-4 py-3 font-bold">Type</th>
                  <th className="text-left px-4 py-3 font-bold">Value</th>
                  <th className="text-center px-4 py-3 font-bold">Uses</th>
                  <th className="text-left px-4 py-3 font-bold">Validity</th>
                  <th className="text-left px-4 py-3 font-bold">Status</th>
                  <th className="text-right px-4 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const valueDisplay = c.discount_type === 'free_months' ? `${c.free_months} mo free`
                    : c.discount_type === 'percent' ? `${c.percent_off}% off`
                    : `${fmtMoney(c.flat_off_per_month)} / mo`;
                  const usesDisplay = c.max_total_uses ? `${c.current_uses || 0}/${c.max_total_uses}` : `${c.current_uses || 0}/∞`;
                  return (
                    <tr key={c.id} className="border-b border-border/40 last:border-0 hover:bg-background/40">
                      <td className="px-4 py-3">
                        <button onClick={() => copyCode(c.code)} className="flex items-center gap-1 font-mono font-bold text-foreground hover:text-primary">
                          {c.code} <Copy className="w-3 h-3 opacity-50" />
                        </button>
                        {c.description && <div className="text-[11px] text-muted-foreground/80 mt-0.5">{c.description}</div>}
                      </td>
                      <td className="px-4 py-3 text-foreground/80 text-xs">{TYPE_LABEL[c.discount_type] || c.discount_type}</td>
                      <td className="px-4 py-3 text-primary font-semibold text-xs">{valueDisplay}</td>
                      <td className="px-4 py-3 text-center text-foreground/80 text-xs">{usesDisplay}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {c.valid_from ? fmtDate(c.valid_from) : 'Now'} → {c.valid_until ? fmtDate(c.valid_until) : '∞'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border ${STATUS_STYLES[c.status] || STATUS_STYLES.disabled}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setUsagesFor(c)} className="p-1.5 rounded hover:bg-sky-500/15 text-sky-400" title="View usages"><TrendingUp className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { setEditing(c); setShowForm(true); }} className="p-1.5 rounded hover:bg-primary/15 text-primary" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => toggleDisable(c)} disabled={actionBusy === c.id} className={`p-1.5 rounded disabled:opacity-50 ${c.status === 'disabled' ? 'hover:bg-emerald-500/15 text-emerald-400' : 'hover:bg-rose-500/15 text-rose-400'}`} title={c.status === 'disabled' ? 'Enable' : 'Disable'}>
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CodeFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        initial={editing}
        onSaved={fetchCodes}
        headers={headers}
      />
      <UsagesDrawer code={usagesFor} onClose={() => setUsagesFor(null)} headers={headers} />
    </div>
  );
}
