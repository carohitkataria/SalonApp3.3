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


// ===================== Attendance Rules sub-tab (Module 3 placement + Module 4 config) =====================

function AttendanceRulesTab({ salonId, authHeaders }) {
  // Module 4 — the SOURCE OF TRUTH for attendance configuration.
  const [mode, setMode] = useState('service_completion');
  const [history, setHistory] = useState([]);
  const [geo, setGeo] = useState({
    check_in_radius_meters: 50,
    max_check_in_time: '10:30',
    min_daily_minutes: 480,
    allow_admin_override: true,
    auto_close_at: '23:59',
  });
  // Legacy placement-only fields kept for backward compatibility.
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
      if (salon?.attendance_mode) setMode(salon.attendance_mode);
      if (Array.isArray(salon?.attendance_mode_history)) setHistory(salon.attendance_mode_history);
      if (salon?.geo_settings) setGeo((p) => ({ ...p, ...salon.geo_settings }));
    } catch {
      /* defaults retained */
    } finally {
      setLoading(false);
    }
  }, [salonId, authHeaders]);

  useEffect(() => { load(); }, [load]);

  const saveLegacyRules = async () => {
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

  const saveModeAndGeo = async (nextMode = mode) => {
    setSaving(true);
    try {
      const r = await axios.put(
        `${API}/salons/${salonId}/attendance-mode`,
        { mode: nextMode, geo_settings: geo },
        { headers: authHeaders }
      );
      setMode(r.data.attendance_mode);
      setHistory(r.data.attendance_mode_history || []);
      setGeo((p) => ({ ...p, ...(r.data.geo_settings || {}) }));
      toast.success(`Saved — attendance is now '${r.data.attendance_mode === 'geo_checkin' ? 'Geo check-in' : 'Service completion'}'`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to update attendance mode');
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
    <div className="space-y-6 max-w-2xl">
      {/* MODE SELECTOR (Module 4) */}
      <div>
        <h3 className="text-lg font-semibold">How is attendance marked as Present?</h3>
        <p className="text-xs text-muted-foreground">
          Pick exactly one mode. Switching modes is non-destructive — the data
          collected under the other mode is preserved.
        </p>
      </div>

      <div className="space-y-2">
        <label
          className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${mode === 'service_completion' ? 'border-gold bg-gold/5' : 'border-border bg-card hover:bg-muted/30'}`}
          data-testid="mode-service-completion-radio"
        >
          <input
            type="radio"
            name="attendance_mode"
            value="service_completion"
            checked={mode === 'service_completion'}
            onChange={() => setMode('service_completion')}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="font-semibold">By service completion</div>
            <div className="text-xs text-muted-foreground">
              Staff is marked Present if they complete at least one service / booking that day. (Existing behaviour.)
            </div>
          </div>
        </label>

        <label
          className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${mode === 'geo_checkin' ? 'border-gold bg-gold/5' : 'border-border bg-card hover:bg-muted/30'}`}
          data-testid="mode-geo-checkin-radio"
        >
          <input
            type="radio"
            name="attendance_mode"
            value="geo_checkin"
            checked={mode === 'geo_checkin'}
            onChange={() => setMode('geo_checkin')}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="font-semibold">By geo-fenced check-in / check-out</div>
            <div className="text-xs text-muted-foreground">
              Staff must check in within the salon's geo-fence and meet the minimum-hours rule.
            </div>
          </div>
        </label>
      </div>

      {/* Mode B settings */}
      {mode === 'geo_checkin' && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-4" data-testid="geo-settings-panel">
          <h4 className="text-sm font-semibold">Geo check-in settings</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Geo-fence radius (m)</Label>
              <Input
                type="number" min={10} max={2000}
                value={geo.check_in_radius_meters}
                onChange={(e) => setGeo(g => ({ ...g, check_in_radius_meters: Number(e.target.value) }))}
                data-testid="geo-radius-input"
              />
            </div>
            <div>
              <Label>Latest check-in time (HH:MM)</Label>
              <Input
                value={geo.max_check_in_time}
                placeholder="10:30"
                onChange={(e) => setGeo(g => ({ ...g, max_check_in_time: e.target.value }))}
                data-testid="geo-max-checkin-input"
              />
              <p className="text-xs text-muted-foreground mt-1">After this time → half day (late)</p>
            </div>
            <div>
              <Label>Minimum daily minutes</Label>
              <Input
                type="number" min={30} max={1440}
                value={geo.min_daily_minutes}
                onChange={(e) => setGeo(g => ({ ...g, min_daily_minutes: Number(e.target.value) }))}
                data-testid="geo-min-minutes-input"
              />
              <p className="text-xs text-muted-foreground mt-1">Below this → half day (short hours)</p>
            </div>
            <div>
              <Label>Auto check-out cutoff (HH:MM)</Label>
              <Input
                value={geo.auto_close_at}
                placeholder="23:59"
                onChange={(e) => setGeo(g => ({ ...g, auto_close_at: e.target.value }))}
                data-testid="geo-autoclose-input"
              />
              <p className="text-xs text-muted-foreground mt-1">Closes any open check-ins.</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!geo.allow_admin_override}
              onChange={(e) => setGeo(g => ({ ...g, allow_admin_override: e.target.checked }))}
              data-testid="geo-allow-override"
            />
            Allow admin to override outside-fence check-ins
          </label>
        </div>
      )}

      <Button onClick={() => saveModeAndGeo()} disabled={saving} data-testid="attn-mode-save-btn">
        {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save attendance configuration
      </Button>

      {history.length > 0 && (
        <div className="bg-muted/30 rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Mode change history (last 5)</p>
          <ul className="text-xs space-y-1">
            {history.slice(-5).reverse().map((h, idx) => (
              <li key={h.id || idx} className="flex justify-between">
                <span>{h.effective_from_date} — {h.mode === 'geo_checkin' ? 'Geo check-in' : 'Service completion'}</span>
                <span className="text-muted-foreground">{h.changed_at?.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Module 3 — legacy placement fields, kept for backward compatibility. */}
      <details className="bg-card border border-border rounded-xl">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Other attendance thresholds (legacy)</summary>
        <div className="p-4 space-y-3">
          <div>
            <Label>Geofence radius (m) — legacy field</Label>
            <Input
              type="number" min={10} max={1000}
              value={rules.geofence_radius_m}
              onChange={(e) => setRules(r => ({ ...r, geofence_radius_m: Number(e.target.value) }))}
              data-testid="attn-geofence-input"
            />
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
          </div>
          <Button onClick={saveLegacyRules} disabled={saving} data-testid="attn-save-btn">
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save legacy rules
          </Button>
        </div>
      </details>
    </div>
  );
}
