import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

/**
 * AuthCallback — handles the Emergent OAuth redirect for ALL audiences.
 *
 * URL shape: `/auth/callback?aud=customer#session_id=<id>`
 *
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS,
 * THIS BREAKS THE AUTH.
 */
export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const processed = useRef(false);
  const [status, setStatus] = useState('Signing you in…');

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const params = new URLSearchParams(location.search);
    const audience = (params.get('aud') || 'customer').toLowerCase();

    // session_id arrives in the URL fragment per the Emergent playbook
    const hash = window.location.hash || '';
    const sessionIdMatch = hash.match(/session_id=([^&]+)/);
    const sessionId = sessionIdMatch ? decodeURIComponent(sessionIdMatch[1]) : null;

    if (!sessionId) {
      setStatus('No session_id received from Google. Redirecting back to login…');
      const back = {
        customer: '/login',
        salon: '/salon/login',
        platform: '/platform/login',
        supplier: '/supplier/login',
      }[audience] || '/login';
      setTimeout(() => navigate(back, { replace: true }), 1500);
      return;
    }

    (async () => {
      try {
        const res = await axios.post(`${API}/auth/google`, {
          session_id: sessionId,
          audience,
        });
        const data = res.data || {};
        const token = data.access_token || data.token;

        if (audience === 'customer') {
          if (token) localStorage.setItem('user_token', token);
          if (data.user) localStorage.setItem('user_data', JSON.stringify(data.user));
          if (data.user?.phone) localStorage.setItem('customer_phone', data.user.phone);
          toast.success(`Welcome${data.user?.name ? `, ${data.user.name}` : ''}!`);
          navigate('/', { replace: true });
        } else if (audience === 'salon') {
          if (token) localStorage.setItem('salon_token', token);
          if (data.salon_id) localStorage.setItem('salon_id', data.salon_id);
          if (data.user) localStorage.setItem('salon_user', JSON.stringify(data.user));
          toast.success(`Welcome${data.user?.name ? `, ${data.user.name}` : ''}!`);
          navigate('/salon/dashboard', { replace: true });
        } else if (audience === 'platform') {
          const blob = JSON.stringify({ token, admin: data.admin, ts: Date.now() });
          localStorage.setItem('platform_admin_auth', blob);
          toast.success(`Welcome, ${data.admin?.name || 'Platform Admin'}`);
          navigate('/platform', { replace: true });
        } else if (audience === 'supplier') {
          if (token) localStorage.setItem('salonhub_supplier_token', token);
          if (data.supplier) localStorage.setItem('salonhub_supplier_user', JSON.stringify(data.supplier));
          toast.success(`Welcome${data.supplier?.name ? `, ${data.supplier.name}` : ''}!`);
          navigate(
            data.supplier?.status === 'active' ? '/supplier/dashboard' : '/supplier/pending',
            { replace: true },
          );
        } else {
          navigate('/', { replace: true });
        }
      } catch (err) {
        const detail = err?.response?.data?.detail || 'Google sign-in failed';
        toast.error(detail);
        const back = {
          customer: '/login',
          salon: '/salon/login',
          platform: '/platform/login',
          supplier: '/supplier/login',
        }[audience] || '/login';
        setTimeout(() => navigate(back, { replace: true }), 1500);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background" data-testid="auth-callback-page">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
        <p className="text-sm text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
