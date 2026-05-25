/**
 * Platform Admin — Suppliers Tab.
 * Lists supplier applications with status filter; supports approve / reject / suspend.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Loader2, Package, Check, X, RefreshCw, Info, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const fmtTs = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-IN'); } catch { return iso; }
};

const STATUS_BADGE = {
  pending_approval: 'bg-primary/15 text-primary border-primary/30',
  active:           'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejected:         'bg-rose-500/15 text-rose-300 border-rose-500/30',
  suspended:        'bg-zinc-500/15 text-foreground/80 border-zinc-500/30',
};

const STATUS_LABEL = {
  pending_approval: 'PENDING',
  active: 'ACTIVE',
  rejected: 'REJECTED',
  suspended: 'SUSPENDED',
};

export default function SuppliersTab({ headers }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending_approval');
  const [busyId, setBusyId] = useState(null);
  const [rejectFor, setRejectFor] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/platform/suppliers`, {
        headers,
        params: statusFilter ? { status: statusFilter } : {},
      });
      setSuppliers(r.data?.suppliers || []);
    } catch (e) {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [headers, statusFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const approve = async (id) => {
    setBusyId(id);
    try {
      await axios.post(`${API}/platform/suppliers/${id}/approve`, {}, { headers });
      toast.success('Supplier approved');
      fetchList();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to approve');
    } finally { setBusyId(null); }
  };

  const reject = async () => {
    if (!rejectFor || !rejectReason.trim()) {
      toast.error('Reason is required'); return;
    }
    setBusyId(rejectFor);
    try {
      await axios.post(`${API}/platform/suppliers/${rejectFor}/reject`, { reason: rejectReason.trim() }, { headers });
      toast.success('Supplier rejected');
      setRejectFor(null);
      setRejectReason('');
      fetchList();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to reject');
    } finally { setBusyId(null); }
  };

  const suspend = async (id) => {
    const reason = window.prompt('Reason for suspending this supplier?');
    if (!reason || !reason.trim()) return;
    setBusyId(id);
    try {
      await axios.post(`${API}/platform/suppliers/${id}/suspend`, { reason: reason.trim() }, { headers });
      toast.success('Supplier suspended');
      fetchList();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to suspend');
    } finally { setBusyId(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Package className="w-5 h-5 text-primary" /> Suppliers</h2>
          <p className="text-xs text-muted-foreground">Approve, reject, or suspend supplier applications.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            data-testid="platform-suppliers-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-card border border-border text-foreground text-sm rounded-md px-3 h-9"
          >
            <option value="">All</option>
            <option value="pending_approval">Pending</option>
            <option value="active">Active</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </select>
          <Button variant="outline" size="sm" onClick={fetchList} data-testid="platform-suppliers-refresh-btn">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : suppliers.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No suppliers in this status.</p>
            <p className="text-muted-foreground/70 text-xs mt-2">Adjust the filter or refresh.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background/50">
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-3 font-bold">Supplier</th>
                  <th className="text-left px-4 py-3 font-bold">Contact</th>
                  <th className="text-left px-4 py-3 font-bold">Status</th>
                  <th className="text-left px-4 py-3 font-bold">Created</th>
                  <th className="text-right px-4 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => {
                  const status = s.status || 'pending_approval';
                  return (
                    <tr key={s.id} data-testid={`platform-supplier-row-${s.id}`} className="border-b border-border/40 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{s.business_name || s.id}</div>
                        {s.gst_number && <div className="text-xs text-muted-foreground">GST: {s.gst_number}</div>}
                        {s.category_tags?.length > 0 && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {s.category_tags.slice(0, 3).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground/80">
                        <div className="text-xs">{s.owner_name || '—'}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{s.mobile || '—'}</div>
                        {s.email && <div className="text-[11px] text-muted-foreground">{s.email}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border ${STATUS_BADGE[status] || STATUS_BADGE.pending_approval}`}>
                          {STATUS_LABEL[status] || status}
                        </span>
                        {status === 'rejected' && s.rejection_reason && (
                          <div className="text-[10px] text-rose-300/80 mt-1 max-w-[200px]">↳ {s.rejection_reason}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{fmtTs(s.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {(status === 'pending_approval' || status === 'rejected' || status === 'suspended') && (
                            <button
                              onClick={() => approve(s.id)}
                              disabled={busyId === s.id}
                              data-testid={`platform-supplier-approve-${s.id}`}
                              className="p-1.5 rounded hover:bg-emerald-500/15 text-emerald-500 disabled:opacity-50"
                              title="Approve"
                            ><Check className="w-3.5 h-3.5" /></button>
                          )}
                          {status === 'pending_approval' && (
                            <button
                              onClick={() => { setRejectFor(s.id); setRejectReason(''); }}
                              disabled={busyId === s.id}
                              data-testid={`platform-supplier-reject-${s.id}`}
                              className="p-1.5 rounded hover:bg-rose-500/15 text-rose-500 disabled:opacity-50"
                              title="Reject"
                            ><X className="w-3.5 h-3.5" /></button>
                          )}
                          {status === 'active' && (
                            <button
                              onClick={() => suspend(s.id)}
                              disabled={busyId === s.id}
                              data-testid={`platform-supplier-suspend-${s.id}`}
                              className="p-1.5 rounded hover:bg-primary/15 text-primary disabled:opacity-50"
                              title="Suspend"
                            ><Pause className="w-3.5 h-3.5" /></button>
                          )}
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

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
        <Info className="inline w-3.5 h-3.5 text-primary mr-1 -mt-0.5" />
        Approve / Reject / Suspend send WhatsApp notifications to the supplier.
      </div>

      {rejectFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/70 backdrop-blur-sm" onClick={() => setRejectFor(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <h3 className="text-base font-bold text-foreground mb-1">Reject supplier?</h3>
            <p className="text-xs text-muted-foreground mb-4">The supplier will receive this reason via WhatsApp.</p>
            <Input
              autoFocus
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. GST number could not be verified"
              data-testid="platform-supplier-reject-reason"
              className="bg-background border-border text-foreground"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setRejectFor(null)}>Cancel</Button>
              <Button onClick={reject} data-testid="platform-supplier-reject-submit" className="bg-rose-500 hover:bg-rose-600 text-foreground">Reject</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
