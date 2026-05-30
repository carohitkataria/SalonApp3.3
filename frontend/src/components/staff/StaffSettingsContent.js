/**
 * Module 3 — Staff Settings (reusable inner content).
 *
 * Renders the 4 sub-tabs that make up the consolidated staff policy area:
 *   - Incentive Rules
 *   - Leave Configuration
 *   - Attendance Rules
 *   - Holiday Calendar (stub)
 *
 * Used by:
 *   - `pages/salon/StaffSettingsPage.js` (standalone /salon/staff/settings page)
 *   - `pages/EnhancedSalonDashboard.js`  (inline inside Salon Settings → Staff tab)
 *
 * Keeps `?tab=…` query-param navigation when `useUrlTab` is true.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Briefcase, CalendarCheck, MapPin, CalendarRange, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import EmployeeRewardPlan from '@/components/EmployeeRewardPlan';
import LeaveConfigTab from '@/components/leave/LeaveConfigTab';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TABS = [
  { id: 'incentives',  label: 'Incentive Rules',     icon: Briefcase },
  { id: 'leave',       label: 'Leave Configuration', icon: CalendarCheck },
  { id: 'attendance',  label: 'Attendance Rules',    icon: MapPin },
  { id: 'holidays',    label: 'Holiday Calendar',    icon: CalendarRange },
];

export default function StaffSettingsContent({
  salonId,
  authHeaders,
  getAuthHeaders,
  isAdmin = true,
  useUrlTab = true,
  defaultTab = 'incentives',
}) {
  // Tab state: optionally synced with URL.
  const [searchParams, setSearchParams] = useSearchParams();
  const [localTab, setLocalTab] = useState(defaultTab);
  const activeTab = useUrlTab ? (searchParams.get('tab') || defaultTab) : localTab;

  const setTab = (id) => {
    if (useUrlTab) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', id);
      setSearchParams(next);
    } else {
      setLocalTab(id);
    }
  };

  // Resolve auth headers once.
  const headers = useMemo(() => {
    if (authHeaders) return authHeaders;
    if (typeof getAuthHeaders === 'function') return getAuthHeaders();
    const t = localStorage.getItem('salon_admin_token') || localStorage.getItem('access_token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  }, [authHeaders, getAuthHeaders]);

  const headersGetter = useCallback(() => headers, [headers]);

  if (!salonId) return null;

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={`staff-settings-tab-${t.id}`}
              className={`px-3 py-2 rounded-t-md text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? 'border-gold text-gold font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab body */}
      <div className="pt-2">
        {activeTab === 'incentives' && (
          <EmployeeRewardPlan
            salonId={salonId}
            getAuthHeaders={headersGetter}
            isAdmin={isAdmin}
          />
        )}

        {activeTab === 'leave' && (
          <LeaveConfigTab salonId={salonId} authHeaders={headers} />
        )}

        {activeTab === 'attendance' && (
          <AttendanceRulesTab salonId={salonId} authHeaders={headers} />
        )}

        {activeTab === 'holidays' && (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarRange className="w-12 h-12 mx-auto opacity-40 mb-3" />
            Holiday calendar configuration is coming soon.
          </div>
        )}
      </div>
    </div>
  );
}


// ===================== Attendance Rules sub-tab =====================

function AttendanceRulesTab({ salonId, authHeaders }) {
  const [rules, setRules] = useState({
    geofence_radius_m: 50,
    late_mark_threshold_min: 15,
    required_hours_per_day: 8,
    auto_absent_cutoff_hour: 22,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/salons/${salonId}`, { headers: authHeaders });
      const salon = r.data?.salon || r.data;
      if (salon?.attendance_rules) setRules((p) => ({ ...p, ...salon.attendance_rules }));
    } catch {
      /* defaults retained */
    } finally {
      setLoading(false);
    }
  }, [salonId, authHeaders]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await axios.patch(
        `${API}/salons/${salonId}`,
        { attendance_rules: rules },
        { headers: authHeaders }
      );
      toast.success('Attendance rules saved');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to save attendance rules');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <h3 className="text-lg font-semibold">Attendance Rules</h3>
        <p className="text-xs text-muted-foreground">
          Geofence and timing thresholds for staff check-in.
        </p>
      </div>
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <div>
          <Label>Geofence radius (m)</Label>
          <Input
            type="number" min={10} max={1000}
            value={rules.geofence_radius_m}
            onChange={(e) => setRules(r => ({ ...r, geofence_radius_m: Number(e.target.value) }))}
            data-testid="attn-geofence-input"
          />
          <p className="text-xs text-muted-foreground mt-1">
            How close must a barber be to the salon to check in.
          </p>
        </div>
        <div>
          <Label>Late mark threshold (min)</Label>
          <Input
            type="number" min={0} max={120}
            value={rules.late_mark_threshold_min}
            onChange={(e) => setRules(r => ({ ...r, late_mark_threshold_min: Number(e.target.value) }))}
          />
        </div>
        <div>
          <Label>Required hours per day</Label>
          <Input
            type="number" min={1} max={16} step={0.5}
            value={rules.required_hours_per_day}
            onChange={(e) => setRules(r => ({ ...r, required_hours_per_day: Number(e.target.value) }))}
          />
        </div>
        <div>
          <Label>Auto-absent cutoff (hour, 0-23)</Label>
          <Input
            type="number" min={0} max={23}
            value={rules.auto_absent_cutoff_hour}
            onChange={(e) => setRules(r => ({ ...r, auto_absent_cutoff_hour: Number(e.target.value) }))}
          />
          <p className="text-xs text-muted-foreground mt-1">
            If no check-in by this hour, staff is auto-marked absent.
          </p>
        </div>
      </div>
      <Button onClick={save} disabled={saving} data-testid="attn-save-btn">
        {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save attendance rules
      </Button>
    </div>
  );
}
