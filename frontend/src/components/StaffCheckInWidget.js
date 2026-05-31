/**
 * Staff Check-in / Check-out widget (Geo attendance, Mode B).
 *
 * Renders ONLY when:
 *   - the salon's attendance_mode === 'geo_checkin', AND
 *   - the logged-in user is linked to a staff/barber profile (staffId present).
 *
 * Flow:
 *   - Not checked in  → "Check In" button (uses browser geolocation).
 *   - Checked in      → running timer + "Check Out" button.
 *   - Checked out      → read-only summary for the day.
 *
 * The backend enforces the geo-fence (staff outside the radius are blocked).
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { MapPin, LogIn, LogOut, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// YYYY-MM-DD in IST (matches the backend's attendance record date).
function istToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function formatElapsed(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function StaffCheckInWidget({ salonId, staffId, staffName, getAuthHeaders }) {
  const [mode, setMode] = useState(null);            // salon attendance_mode
  const [record, setRecord] = useState(null);        // today's attendance doc
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);       // check-in/out in progress
  const [now, setNow] = useState(Date.now());
  const timerRef = useRef(null);

  const headers = (typeof getAuthHeaders === 'function' ? getAuthHeaders() : {}) || {};

  const fetchState = useCallback(async () => {
    if (!salonId || !staffId) {
      setLoading(false);
      return;
    }
    try {
      const month = istToday().slice(0, 7);
      const [salonRes, attnRes] = await Promise.all([
        axios.get(`${API}/salons/${salonId}`).catch(() => ({ data: {} })),
        axios
          .get(`${API}/salons/${salonId}/staff-attendance/month/${month}?barber_id=${staffId}`)
          .catch(() => ({ data: {} })),
      ]);
      const salon = salonRes.data?.salon || salonRes.data || {};
      setMode(salon.attendance_mode || 'service_completion');

      const today = istToday();
      const barberData = (attnRes.data?.barbers || []).find((b) => b.barber_id === staffId);
      const todayRec = (barberData?.attendance || []).find((r) => r.date === today) || null;
      setRecord(todayRec);
    } catch (e) {
      // silent — widget just won't render
    } finally {
      setLoading(false);
    }
  }, [salonId, staffId]);

  useEffect(() => { fetchState(); }, [fetchState]);

  // Running clock (only matters while checked-in).
  const isCheckedIn = !!record?.check_in_at && !record?.check_out_at;
  useEffect(() => {
    if (isCheckedIn) {
      timerRef.current = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(timerRef.current);
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, [isCheckedIn]);

  const getPosition = () =>
    new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });

  const doAction = async (kind) => {
    setActing(true);
    try {
      let pos;
      try {
        pos = await getPosition();
      } catch (geoErr) {
        const msg =
          geoErr?.code === 1
            ? 'Location permission denied. Please allow location access to check in.'
            : 'Could not get your location. Please enable GPS/location and try again.';
        toast.error(msg);
        setActing(false);
        return;
      }
      const body = {
        barber_id: staffId,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        method: 'self',
      };
      const url = `${API}/salons/${salonId}/staff-attendance/${kind === 'in' ? 'check-in' : 'check-out'}`;
      const res = await axios.post(url, body, { headers });
      setRecord(res.data?.record || null);
      toast.success(kind === 'in' ? 'Checked in successfully' : 'Checked out successfully');
    } catch (e) {
      const detail = e?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Action failed. Please try again.');
    } finally {
      setActing(false);
    }
  };

  // Render gating
  if (loading) return null;
  if (!staffId) return null;
  if (mode !== 'geo_checkin') return null;

  const checkedOut = !!record?.check_out_at;
  const checkInMs = record?.check_in_at ? new Date(record.check_in_at).getTime() : null;
  const checkOutMs = record?.check_out_at ? new Date(record.check_out_at).getTime() : null;

  const elapsed =
    checkInMs != null ? (checkedOut ? checkOutMs - checkInMs : now - checkInMs) : 0;

  const fmtTime = (iso) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div
      data-testid="staff-checkin-widget"
      className="rounded-xl border border-gold/30 bg-gradient-to-br from-gold/10 to-card p-4 sm:p-5"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gold/15 text-gold">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Attendance Check-in{staffName ? ` · ${staffName}` : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              {checkedOut
                ? 'Your attendance is recorded for today'
                : isCheckedIn
                ? 'You are checked in — remember to check out'
                : 'Tap below to mark your attendance for today'}
            </p>
          </div>
        </div>

        {/* Action area */}
        {!record?.check_in_at && (
          <Button
            onClick={() => doAction('in')}
            disabled={acting}
            data-testid="staff-checkin-btn"
            className="bg-gold text-black hover:bg-gold/90"
          >
            {acting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
            Check In
          </Button>
        )}

        {isCheckedIn && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30">
              <Clock className="w-4 h-4 text-green-600 animate-pulse" />
              <span
                className="text-sm font-mono font-bold text-green-700 dark:text-green-400 tabular-nums"
                data-testid="staff-checkin-timer"
              >
                {formatElapsed(elapsed)}
              </span>
            </div>
            <Button
              onClick={() => doAction('out')}
              disabled={acting}
              data-testid="staff-checkout-btn"
              variant="outline"
              className="border-red-500/40 text-red-600 hover:bg-red-500/10"
            >
              {acting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
              Check Out
            </Button>
          </div>
        )}

        {checkedOut && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-foreground">
              Worked {formatElapsed(elapsed)}
            </span>
          </div>
        )}
      </div>

      {/* Timestamps row */}
      {record?.check_in_at && (
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground border-t border-border pt-2">
          <span>In: <strong className="text-foreground">{fmtTime(record.check_in_at)}</strong></span>
          <span>Out: <strong className="text-foreground">{fmtTime(record.check_out_at)}</strong></span>
          {record?.status && (
            <span className="ml-auto capitalize">
              Status: <strong className="text-foreground">{String(record.status).replace('_', ' ')}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
