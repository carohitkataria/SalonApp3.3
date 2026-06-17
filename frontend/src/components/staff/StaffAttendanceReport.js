/**
 * Module 4 — Phase 7: Staff Attendance Report (salon-wide consolidated)
 *
 * Renders a filterable, downloadable staff-attendance report.  Driven by
 *   GET /api/salons/{salon_id}/staff-attendance/report
 * which returns one row per (barber × date) with status code (P/H/A/L/HOL),
 * leave-type label when on leave, check-in / out, worked minutes, override
 * fields and the mode that governed that day (so a month spanning a mode
 * switch reads correctly).
 *
 * Filters:
 *   - start_date / end_date (defaults: this calendar month)
 *   - branch (optional)
 *   - employees (multi-select, optional)
 *
 * Actions:
 *   - "Download CSV" — hits the same endpoint with format=csv.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Loader2, Download, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STATUS_BADGE = {
  P:   'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
  H:   'bg-amber-500/15 text-amber-700 border-amber-500/30',
  A:   'bg-rose-500/15 text-rose-700 border-rose-500/30',
  L:   'bg-sky-500/15 text-sky-700 border-sky-500/30',
  HOL: 'bg-purple-500/15 text-purple-700 border-purple-500/30',
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIso() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export default function StaffAttendanceReport({ salonId, getAuthHeaders }) {
  const [startDate, setStartDate] = useState(firstOfMonthIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [barbers, setBarbers] = useState([]);
  const [selectedBarberIds, setSelectedBarberIds] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const headers = useMemo(() => getAuthHeaders?.() || {}, [getAuthHeaders]);

  // Load branches + barbers once.
  useEffect(() => {
    if (!salonId) return;
    (async () => {
      try {
        const [brRes, bRes] = await Promise.all([
          axios.get(`${API}/salons/${salonId}/branches`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API}/salons/${salonId}/barbers`, { headers }).catch(() => ({ data: [] })),
        ]);
        setBranches(Array.isArray(brRes.data) ? brRes.data : (brRes.data?.branches || []));
        const list = Array.isArray(bRes.data) ? bRes.data : (bRes.data?.barbers || bRes.data?.items || []);
        setBarbers(list.filter((b) => b.is_active !== false));
      } catch (e) {
        /* silent — UI still works without filters */
      }
    })();
  }, [salonId, headers]);

  const filteredBarbers = useMemo(() => {
    if (!branchId) return barbers;
    return barbers.filter((b) => b.branch_id === branchId);
  }, [barbers, branchId]);

  const load = useCallback(async () => {
    if (!salonId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        format: 'json',
      });
      if (branchId) params.set('branch_id', branchId);
      if (selectedBarberIds.length) params.set('barber_ids', selectedBarberIds.join(','));
      const r = await axios.get(`${API}/salons/${salonId}/staff-attendance/report?${params}`, { headers });
      setRows(r.data?.rows || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to load attendance report');
    } finally {
      setLoading(false);
    }
  }, [salonId, startDate, endDate, branchId, selectedBarberIds, headers]);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const downloadCsv = async () => {
    if (!salonId) return;
    setDownloading(true);
    try {
      const params = new URLSearchParams({
        start_date: startDate, end_date: endDate, format: 'csv',
      });
      if (branchId) params.set('branch_id', branchId);
      if (selectedBarberIds.length) params.set('barber_ids', selectedBarberIds.join(','));
      const r = await axios.get(
        `${API}/salons/${salonId}/staff-attendance/report?${params}`,
        { headers, responseType: 'blob' },
      );
      const blob = new Blob([r.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${startDate}_to_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'CSV download failed');
    } finally {
      setDownloading(false);
    }
  };

  const toggleBarber = (id) => {
    setSelectedBarberIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  return (
    <div className="space-y-4" data-testid="staff-attendance-report">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <Label className="text-xs">Start date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                 data-testid="rpt-start-date" className="w-40" />
        </div>
        <div>
          <Label className="text-xs">End date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                 data-testid="rpt-end-date" className="w-40" />
        </div>
        {branches.length > 0 && (
          <div>
            <Label className="text-xs">Branch</Label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              data-testid="rpt-branch-select"
              className="h-10 w-48 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.branch_name || b.id}</option>
              ))}
            </select>
          </div>
        )}
        <Button onClick={load} disabled={loading} data-testid="rpt-apply-btn">
          {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Filter className="w-4 h-4 mr-1" />}
          Apply
        </Button>
        <Button onClick={downloadCsv} disabled={downloading || !rows.length} variant="outline" data-testid="rpt-download-csv">
          {downloading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
          Download CSV
        </Button>
      </div>

      {/* Staff filter chips */}
      {filteredBarbers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filteredBarbers.map((b) => {
            const active = selectedBarberIds.includes(b.id);
            return (
              <button
                key={b.id}
                onClick={() => toggleBarber(b.id)}
                data-testid={`rpt-barber-chip-${b.id}`}
                className={`px-3 py-1 text-xs rounded-full border ${
                  active
                    ? 'bg-gold/15 border-gold/40 text-foreground'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {b.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Branch</th>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Staff</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Leave</th>
              <th className="text-left px-3 py-2">Check-in</th>
              <th className="text-left px-3 py-2">Check-out</th>
              <th className="text-left px-3 py-2">Worked</th>
              <th className="text-left px-3 py-2">Marked By</th>
              <th className="text-left px-3 py-2">Mode</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
            ) : !rows.length ? (
              <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">No data in this range.</td></tr>
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.staff_id}-${r.date}-${i}`} className="border-t border-border">
                  <td className="px-3 py-2">{r.branch}</td>
                  <td className="px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2">{r.staff_name}</td>
                  <td className="px-3 py-2">
                    {r.status ? (
                      <span className={`px-2 py-0.5 rounded border text-[10px] ${STATUS_BADGE[r.status] || ''}`}>
                        {r.status}
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2">{r.leave_type || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.check_in ? new Date(r.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.check_out ? new Date(r.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {r.worked_minutes != null
                      ? `${Math.floor(r.worked_minutes / 60)}h ${r.worked_minutes % 60}m`
                      : '—'}
                  </td>
                  <td className="px-3 py-2" title={r.marked_by_name || ''} data-testid={`marked-by-${r.staff_id}-${r.date}`}>
                    {(() => {
                      const lbl = r.marked_by_label || '—';
                      const tone =
                        lbl === 'Admin' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                        : lbl === 'Staff' ? 'bg-violet-500/10 text-violet-600 border-violet-500/30'
                        : lbl === 'Auto' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                        : 'text-muted-foreground';
                      return lbl === '—'
                        ? <span className="text-muted-foreground">—</span>
                        : <span className={`px-2 py-0.5 rounded border text-[10px] ${tone}`}>{lbl}</span>;
                    })()}
                  </td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">
                    {r.mode === 'geo_checkin' ? 'Geo' : r.mode === 'service_completion' ? 'Service' : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Each row reflects the attendance mode active on that specific date — so months spanning a switch read correctly.
      </p>
    </div>
  );
}
