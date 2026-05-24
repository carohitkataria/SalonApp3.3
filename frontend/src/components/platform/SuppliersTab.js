/**
 * Phase 6 (Part A) — Platform Admin Suppliers Tab (stub).
 * Full implementation arrives with Phase 8 (signup flow).
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Loader2, Package, Check, X, RefreshCw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const fmtTs = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-IN'); } catch { return iso; }
};

export default function SuppliersTab({ headers }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [busyId, setBusyId] = useState(null);

  const fetch = useCallback(async () => {
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

  useEffect(() => { fetch(); }, [fetch]);

  const act = async (id, action) => {
    setBusyId(id);
    try {
      await axios.post(`${API}/platform/suppliers/${id}/${action}`, {}, { headers });
      toast.success(`Supplier ${action}d`);
      fetch();
    } catch (e) {
      toast.error(e?.response?.data?.detail || `Failed to ${action} supplier`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><Package className="w-5 h-5 text-amber-400" /> Suppliers</h2>
          <p className="text-xs text-zinc-500">Approve / reject supplier signups.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 text-white text-sm rounded-md px-3 h-9"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <Button variant="outline" size="sm" onClick={fetch}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
        ) : suppliers.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">No suppliers yet.</p>
            <p className="text-zinc-600 text-xs mt-2">Supplier signup flow will be available once Phase 8 lands.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-950/60">
                <tr className="text-[10px] uppercase tracking-widest text-zinc-500 border-b border-zinc-800">
                  <th className="text-left px-4 py-3 font-bold">Supplier</th>
                  <th className="text-left px-4 py-3 font-bold">Contact</th>
                  <th className="text-left px-4 py-3 font-bold">Status</th>
                  <th className="text-left px-4 py-3 font-bold">Created</th>
                  <th className="text-right px-4 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id} className="border-b border-zinc-800/40 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{s.business_name || s.name || s.id}</div>
                      {s.gst_number && <div className="text-xs text-zinc-500">GST: {s.gst_number}</div>}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      <div className="text-xs">{s.owner_name || '—'}</div>
                      <div className="font-mono text-[11px] text-zinc-500">{s.phone || s.mobile || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded ${
                        s.approval_status === 'approved' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' :
                        s.approval_status === 'rejected' ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30' :
                        'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}>{s.approval_status || 'pending'}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{fmtTs(s.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {(s.approval_status || 'pending') === 'pending' && (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => act(s.id, 'approve')} disabled={busyId === s.id} className="p-1.5 rounded hover:bg-emerald-500/15 text-emerald-400 disabled:opacity-50" title="Approve"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => act(s.id, 'reject')} disabled={busyId === s.id} className="p-1.5 rounded hover:bg-rose-500/15 text-rose-400 disabled:opacity-50" title="Reject"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-zinc-400">
        <Info className="inline w-3.5 h-3.5 text-amber-400 mr-1 -mt-0.5" />
        Approve / reject buttons are wired and will trigger WhatsApp + email notifications once supplier signup goes live in Phase 8. The list is empty until then.
      </div>
    </div>
  );
}
