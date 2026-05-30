/**
 * Module 3 — Staff Settings page.
 *
 * Single, discoverable page that hosts all staff-related policy:
 *   - Tab 1: Incentive Rules (existing EmployeeRewardPlan component)
 *   - Tab 2: Leave Configuration (new LeaveConfigTab)
 *   - Tab 3: Attendance Rules (geofence radius / late mark / etc.)
 *   - Tab 4: Holiday Calendar (stub)
 *
 * Reachable from two entry points (both link here with ?tab=…):
 *   - Staff section in the dashboard
 *   - Salon Settings → Staff Settings
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, CalendarCheck, MapPin, CalendarRange, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import axios from 'axios';
import SalonHamburgerMenu from '@/components/salon/SalonHamburgerMenu';
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

export default function StaffSettingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'incentives';

  // Pull auth + salonId from localStorage (same convention used elsewhere).
  const { salonId, authHeaders, getAuthHeaders, isAdmin } = useMemo(() => {
    let sid = null;
    let token = localStorage.getItem('salon_admin_token') || localStorage.getItem('access_token');
    const raw = localStorage.getItem('salon_user_auth');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        sid = parsed.salon_id || parsed.salonId || parsed.user?.salon_id;
        if (!token) token = parsed.token;
      } catch { /* noop */ }
    }
    if (!sid) sid = localStorage.getItem('salon_id');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return {
      salonId: sid,
      authHeaders: headers,
      getAuthHeaders: () => headers,
      isAdmin: true,
    };
  }, []);

  useEffect(() => {
    if (!salonId) {
      toast.error('Please log in as salon admin');
      navigate('/admin/login');
    }
  }, [salonId, navigate]);

  const setTab = (id) => setSearchParams({ tab: id });

  if (!salonId) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <SalonHamburgerMenu activeId="staff-settings" />
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex-1">
            <div className="text-sm font-bold">Staff Settings</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/80">
              Incentives · Leave · Attendance · Holidays
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-2 flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                data-testid={`staff-settings-tab-${t.id}`}
                className={`px-3 py-2 rounded-t-md text-sm flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                  active ? 'border-gold text-gold font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'incentives' && (
          <EmployeeRewardPlan
            salonId={salonId}
            getAuthHeaders={getAuthHeaders}
            isAdmin={isAdmin}
          />
        )}

        {activeTab === 'leave' && (
          <LeaveConfigTab salonId={salonId} authHeaders={authHeaders} />
        )}

        {activeTab === 'attendance' && (
          <AttendanceRulesTab salonId={salonId} authHeaders={authHeaders} />
        )}

        {activeTab === 'holidays' && (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarRange className="w-12 h-12 mx-auto opacity-40 mb-3" />
            Holiday calendar configuration is coming soon.
          </div>
        )}
      </main>
    </div>
  );
}


// ===================== Attendance Rules tab =====================

function AttendanceRulesTab({ salonId, authHeaders }) {
  const [rules, setRules] = useState({
    geofence_radius_m: 50,
    late_mark_threshold_min: 15,
    required_hours_per_day: 8,
    auto_absent_cutoff_hour: 22, // 10 PM
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Try /api/salons/{id}/settings/attendance — back-compat with whatever currently exists.
      const r = await axios.get(`${API}/salons/${salonId}`, { headers: authHeaders });
      const salon = r.data?.salon || r.data;
      if (salon?.attendance_rules) setRules((p) => ({ ...p, ...salon.attendance_rules }));
    } catch { /* noop — defaults remain */ }
    finally { setLoading(false); }
  }, [salonId, authHeaders]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await axios.patch(`${API}/salons/${salonId}`, { attendance_rules: rules }, { headers: authHeaders });
      toast.success('Attendance rules saved');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to save attendance rules');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <h3 className="text-lg font-semibold">Attendance Rules</h3>
        <p className="text-xs text-muted-foreground">Geofence and timing thresholds for staff check-in.</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <div>
          <Label>Geofence radius (m)</Label>
          <Input type="number" min={10} max={1000}
            value={rules.geofence_radius_m}
            onChange={(e) => setRules(r => ({ ...r, geofence_radius_m: Number(e.target.value) }))}
            data-testid="attn-geofence-input"
          />
          <p className="text-xs text-muted-foreground mt-1">How close must a barber be to the salon to check in.</p>
        </div>
        <div>
          <Label>Late mark threshold (min)</Label>
          <Input type="number" min={0} max={120}
            value={rules.late_mark_threshold_min}
            onChange={(e) => setRules(r => ({ ...r, late_mark_threshold_min: Number(e.target.value) }))}
          />
        </div>
        <div>
          <Label>Required hours per day</Label>
          <Input type="number" min={1} max={16} step={0.5}
            value={rules.required_hours_per_day}
            onChange={(e) => setRules(r => ({ ...r, required_hours_per_day: Number(e.target.value) }))}
          />
        </div>
        <div>
          <Label>Auto-absent cutoff (hour, 0-23)</Label>
          <Input type="number" min={0} max={23}
            value={rules.auto_absent_cutoff_hour}
            onChange={(e) => setRules(r => ({ ...r, auto_absent_cutoff_hour: Number(e.target.value) }))}
          />
          <p className="text-xs text-muted-foreground mt-1">If no check-in by this hour, staff is auto-marked absent.</p>
        </div>
      </div>
      <Button onClick={save} disabled={saving} data-testid="attn-save-btn">
        {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save attendance rules
      </Button>
    </div>
  );
}
