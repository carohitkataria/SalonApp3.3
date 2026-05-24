/**
 * Placeholder Platform Admin home (Phase 1).
 *
 * Real dashboard with salon management, overrides, analytics, broadcast,
 * audit log, and discount codes will land in Phases 5/6.
 *
 * For now this just confirms the JWT works and exposes a sign-out + a quick
 * profile readout.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Shield, LogOut, Loader2, Crown, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const readAuth = () => {
  try {
    const raw = localStorage.getItem('platform_admin_auth');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export default function PlatformDashboardPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('platform_admin_auth');
    navigate('/platform/login', { replace: true });
  }, [navigate]);

  useEffect(() => {
    const auth = readAuth();
    if (!auth?.token) {
      navigate('/platform/login', { replace: true });
      return;
    }
    axios
      .get(`${API}/platform/auth/me`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      .then((r) => setMe(r.data))
      .catch(() => {
        toast.error('Session expired — please sign in again');
        logout();
      })
      .finally(() => setLoading(false));
  }, [navigate, logout]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!me) return null;

  const fmtTs = (iso) => {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString('en-IN'); } catch { return iso; }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-900 px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Platform Admin Console</h1>
              <p className="text-xs text-zinc-500">SalonHub control plane · restricted</p>
            </div>
          </div>
          <Button variant="ghost" onClick={logout} className="text-zinc-400 hover:text-white">
            <LogOut className="w-4 h-4 mr-2" /> Sign out
          </Button>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="text-emerald-400 text-sm font-semibold uppercase tracking-wider">
              Signed in
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <div className="text-xs uppercase text-zinc-500 mb-1">Name</div>
              <div className="text-white font-medium">{me.name || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-zinc-500 mb-1">Mobile</div>
              <div className="text-white font-mono">{me.mobile}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-zinc-500 mb-1">Email</div>
              <div className="text-white">{me.email || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-zinc-500 mb-1">Role</div>
              <div className="text-white flex items-center gap-1">
                {me.is_owner && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                {me.is_owner ? 'Platform Owner' : 'Platform Admin'}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-zinc-500 mb-1">Last login</div>
              <div className="text-white">{fmtTs(me.last_login_at)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-zinc-500 mb-1">Status</div>
              <div className="text-emerald-400 capitalize">{me.status || 'active'}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
          <h2 className="text-base font-semibold text-amber-200 mb-1">Phase 1 complete</h2>
          <p className="text-sm text-zinc-400">
            Platform auth and bootstrap are live. The full admin console (salon search,
            subscription overrides, broadcast, analytics, audit log, discount codes) will
            arrive in Phases 5 & 6 of the master build plan.
          </p>
        </div>
      </div>
    </div>
  );
}
