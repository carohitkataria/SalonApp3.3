/**
 * Module 2 — Leave Configuration tab.
 *
 * Table of leave types with edit dialog.  Lives inside StaffSettingsPage.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const YE_OPTIONS = [
  { value: 'carry_forward', label: 'Carry forward up to N days' },
  { value: 'lapse',         label: 'Lapse N% of unused balance' },
  { value: 'forfeit',       label: 'Forfeit all unused balance' },
];

export default function LeaveConfigTab({ salonId, authHeaders }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // { mode: 'create' | 'edit', data: {...} }

  const headers = useMemo(() => (
    typeof authHeaders === 'function' ? authHeaders() : (authHeaders || {})
  ), [authHeaders]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/salons/${salonId}/leave-types-config`,
        { headers, params: { include_inactive: true } });
      setItems(r.data?.items || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to load leave types');
    } finally {
      setLoading(false);
    }
  }, [salonId, headers]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openCreate = () => {
    setEditing({
      mode: 'create',
      data: {
        code: '', display_name: '', is_paid: true, monthly_accrual: 1.0,
        ye_mode: 'carry_forward', ye_max_cf: 10, ye_lapse_pct: 50,
        max_balance_cap: '', allow_negative_balance: false,
        applies_to: 'all', display_order: items.length * 10 + 10, is_active: true,
      },
    });
  };

  const openEdit = (item) => {
    let ye_mode = 'forfeit';
    let ye_max_cf = 10;
    let ye_lapse_pct = 50;
    if (item.carry_forward_rule?.enabled) {
      ye_mode = 'carry_forward';
      ye_max_cf = item.carry_forward_rule.max_carry_forward;
    } else if (item.lapse_rule?.enabled) {
      ye_mode = 'lapse';
      ye_lapse_pct = item.lapse_rule.lapse_percent;
    }
    setEditing({
      mode: 'edit',
      data: {
        id: item.id,
        code: item.code,
        display_name: item.display_name,
        is_paid: item.is_paid,
        monthly_accrual: item.monthly_accrual,
        ye_mode, ye_max_cf, ye_lapse_pct,
        max_balance_cap: item.max_balance_cap ?? '',
        allow_negative_balance: item.allow_negative_balance,
        applies_to: item.applies_to || 'all',
        display_order: item.display_order || 0,
        is_active: item.is_active !== false,
      },
    });
  };

  const submit = async () => {
    if (!editing) return;
    const d = editing.data;
    if (!d.display_name?.trim()) { toast.error('Display name is required'); return; }
    if (editing.mode === 'create' && !d.code?.trim()) { toast.error('Code is required'); return; }

    // Build year-end rule payload.
    let carry_forward_rule = null;
    let lapse_rule = null;
    if (d.ye_mode === 'carry_forward') {
      carry_forward_rule = { enabled: true, max_carry_forward: Number(d.ye_max_cf) || 0 };
    } else if (d.ye_mode === 'lapse') {
      lapse_rule = { enabled: true, lapse_percent: Number(d.ye_lapse_pct) || 0 };
    }

    const payload = {
      display_name: d.display_name.trim(),
      is_paid: !!d.is_paid,
      monthly_accrual: Number(d.monthly_accrual) || 0,
      carry_forward_rule,
      lapse_rule,
      max_balance_cap: d.max_balance_cap === '' || d.max_balance_cap === null ? null : Number(d.max_balance_cap),
      allow_negative_balance: !!d.allow_negative_balance,
      applies_to: d.applies_to,
      display_order: Number(d.display_order) || 0,
      is_active: !!d.is_active,
    };

    try {
      if (editing.mode === 'create') {
        await axios.post(`${API}/salons/${salonId}/leave-types-config`,
          { ...payload, code: d.code.trim().toUpperCase() },
          { headers });
        toast.success('Leave type added');
      } else {
        // Need to send clear_* flags if rule went from non-null to null.
        const upPayload = { ...payload };
        if (!payload.carry_forward_rule) { upPayload.clear_carry_forward = true; delete upPayload.carry_forward_rule; }
        if (!payload.lapse_rule)         { upPayload.clear_lapse = true;         delete upPayload.lapse_rule; }
        await axios.put(`${API}/salons/${salonId}/leave-types-config/${d.id}`,
          upPayload, { headers });
        toast.success('Leave type updated');
      }
      setEditing(null);
      fetchItems();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Save failed');
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Deactivate leave type "${item.code}"?  Existing balances are preserved.`)) return;
    try {
      await axios.delete(`${API}/salons/${salonId}/leave-types-config/${item.id}`, { headers });
      toast.success('Leave type deactivated');
      fetchItems();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold">Leave Types</h3>
          <p className="text-xs text-muted-foreground">Configure accrual, paid status, and year-end behaviour per leave type.</p>
        </div>
        <Button onClick={openCreate} data-testid="add-leave-type-btn">
          <Plus className="w-4 h-4 mr-1" /> Add leave type
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No leave types yet — defaults will appear after a refresh.</div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-center">Paid</th>
                  <th className="px-3 py-2 text-center">Accrual / month</th>
                  <th className="px-3 py-2 text-left">Year-end</th>
                  <th className="px-3 py-2 text-center">Cap</th>
                  <th className="px-3 py-2 text-center">Active</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  let yeText = 'Forfeit';
                  if (item.carry_forward_rule?.enabled) yeText = `Carry up to ${item.carry_forward_rule.max_carry_forward}d`;
                  else if (item.lapse_rule?.enabled) yeText = `Lapse ${item.lapse_rule.lapse_percent}%`;
                  return (
                    <tr key={item.id} className="border-t border-border" data-testid={`leave-row-${item.code}`}>
                      <td className="px-3 py-2 font-mono">{item.code}</td>
                      <td className="px-3 py-2">{item.display_name}</td>
                      <td className="px-3 py-2 text-center">{item.is_paid ? '✓' : '—'}</td>
                      <td className="px-3 py-2 text-center">{Number(item.monthly_accrual || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-xs">{yeText}</td>
                      <td className="px-3 py-2 text-center text-xs">{item.max_balance_cap ?? '—'}</td>
                      <td className="px-3 py-2 text-center">
                        {item.is_active ? <span className="text-green-500">●</span> : <span className="text-muted-foreground">●</span>}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(item)} data-testid={`edit-leave-${item.code}`}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {item.is_active && (
                          <Button size="sm" variant="ghost" onClick={() => remove(item)} data-testid={`del-leave-${item.code}`}>
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-xl">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>{editing.mode === 'create' ? 'Add leave type' : `Edit ${editing.data.code}`}</DialogTitle>
                <DialogDescription>
                  Carry-forward and lapse rules are mutually exclusive.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Code</Label>
                    <Input
                      value={editing.data.code}
                      disabled={editing.mode === 'edit'}
                      onChange={(e) => setEditing(s => ({ ...s, data: { ...s.data, code: e.target.value.toUpperCase() } }))}
                      placeholder="e.g. CL"
                      data-testid="leave-code-input"
                    />
                  </div>
                  <div>
                    <Label>Display name</Label>
                    <Input
                      value={editing.data.display_name}
                      onChange={(e) => setEditing(s => ({ ...s, data: { ...s.data, display_name: e.target.value } }))}
                      placeholder="e.g. Casual Leave"
                      data-testid="leave-name-input"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between bg-muted/30 rounded p-3">
                  <div>
                    <div className="text-sm font-medium">Paid leave</div>
                    <div className="text-xs text-muted-foreground">If unchecked, salary continues during this leave (no deduction)? — keep policy-aligned</div>
                  </div>
                  <Switch
                    checked={!!editing.data.is_paid}
                    onCheckedChange={(v) => setEditing(s => ({ ...s, data: { ...s.data, is_paid: v } }))}
                  />
                </div>

                <div>
                  <Label>Monthly accrual (days)</Label>
                  <Input
                    type="number" step="0.5" min={0} max={10}
                    value={editing.data.monthly_accrual}
                    onChange={(e) => setEditing(s => ({ ...s, data: { ...s.data, monthly_accrual: e.target.value } }))}
                    data-testid="leave-accrual-input"
                  />
                  {!editing.data.is_paid && editing.data.monthly_accrual > 0 && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-600">
                      <AlertTriangle className="w-3.5 h-3.5" /> Unpaid leave with monthly accrual is unusual.
                    </div>
                  )}
                </div>

                <div>
                  <Label className="mb-2 block">Year-end behaviour</Label>
                  <div className="space-y-2">
                    {YE_OPTIONS.map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          checked={editing.data.ye_mode === opt.value}
                          onChange={() => setEditing(s => ({ ...s, data: { ...s.data, ye_mode: opt.value } }))}
                          data-testid={`leave-ye-${opt.value}`}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                  {editing.data.ye_mode === 'carry_forward' && (
                    <div className="mt-2">
                      <Label>Max carry forward (days)</Label>
                      <Input
                        type="number" step="1" min={0}
                        value={editing.data.ye_max_cf}
                        onChange={(e) => setEditing(s => ({ ...s, data: { ...s.data, ye_max_cf: e.target.value } }))}
                      />
                    </div>
                  )}
                  {editing.data.ye_mode === 'lapse' && (
                    <div className="mt-2">
                      <Label>Lapse percent (%)</Label>
                      <Input
                        type="number" step="1" min={0} max={100}
                        value={editing.data.ye_lapse_pct}
                        onChange={(e) => setEditing(s => ({ ...s, data: { ...s.data, ye_lapse_pct: e.target.value } }))}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Max balance cap (optional)</Label>
                    <Input
                      type="number" min={0}
                      value={editing.data.max_balance_cap}
                      onChange={(e) => setEditing(s => ({ ...s, data: { ...s.data, max_balance_cap: e.target.value } }))}
                      placeholder="None"
                    />
                  </div>
                  <div>
                    <Label>Applies to</Label>
                    <select
                      className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                      value={editing.data.applies_to}
                      onChange={(e) => setEditing(s => ({ ...s, data: { ...s.data, applies_to: e.target.value } }))}
                    >
                      <option value="all">All staff</option>
                      <option value="permanent_only">Permanent only</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-muted/30 rounded p-3">
                  <div>
                    <div className="text-sm font-medium">Allow negative balance</div>
                    <div className="text-xs text-muted-foreground">Useful for unpaid leave or LOP scenarios.</div>
                  </div>
                  <Switch
                    checked={!!editing.data.allow_negative_balance}
                    onCheckedChange={(v) => setEditing(s => ({ ...s, data: { ...s.data, allow_negative_balance: v } }))}
                  />
                </div>

                {editing.mode === 'edit' && (
                  <div className="flex items-center justify-between bg-muted/30 rounded p-3">
                    <div>
                      <div className="text-sm font-medium">Active</div>
                      <div className="text-xs text-muted-foreground">Inactive types can't be marked but balances are kept.</div>
                    </div>
                    <Switch
                      checked={!!editing.data.is_active}
                      onCheckedChange={(v) => setEditing(s => ({ ...s, data: { ...s.data, is_active: v } }))}
                    />
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={submit} data-testid="leave-save-btn">Save</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
