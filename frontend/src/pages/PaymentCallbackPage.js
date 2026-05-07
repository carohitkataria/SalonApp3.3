import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, XCircle, Loader2, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const getAuthHeaders = () => {
  const salonUserAuth = localStorage.getItem('salon_user_auth');
  if (salonUserAuth) {
    try {
      const authData = JSON.parse(salonUserAuth);
      return { Authorization: `Bearer ${authData.token}` };
    } catch (e) { /* fall through */ }
  }
  const legacyToken = localStorage.getItem('salon_admin_token');
  return legacyToken ? { Authorization: `Bearer ${legacyToken}` } : {};
};

export default function PaymentCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ phase: 'verifying', data: null, error: null });

  const orderId = params.get('order_id');

  const verify = useCallback(async () => {
    let salonId = null;
    try {
      const stored = JSON.parse(localStorage.getItem('salonhub_pending_subscription') || 'null');
      salonId = stored?.salon_id || null;
    } catch (e) { /* ignore */ }

    // Fall back to the salon_id stored in the multi-user auth payload
    if (!salonId) {
      try {
        const auth = JSON.parse(localStorage.getItem('salon_user_auth') || 'null');
        salonId = auth?.salon_id || null;
      } catch (e) { /* ignore */ }
    }

    if (!salonId) {
      setState({ phase: 'error', data: null, error: 'Could not identify salon. Please log in again.' });
      return;
    }
    if (!orderId) {
      setState({ phase: 'error', data: null, error: 'Missing order id in callback URL.' });
      return;
    }

    try {
      const res = await axios.post(
        `${API}/salons/${salonId}/subscription/verify-payment`,
        { order_id: orderId },
        { headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } }
      );
      if (res.data?.success) {
        localStorage.removeItem('salonhub_pending_subscription');
        setState({ phase: 'success', data: res.data, error: null });
      } else if (res.data?.status === 'pending') {
        setState({ phase: 'pending', data: res.data, error: null });
      } else {
        setState({ phase: 'failed', data: res.data, error: null });
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : (detail?.message || err.message);
      setState({ phase: 'error', data: null, error: msg });
    }
  }, [orderId]);

  useEffect(() => {
    verify();
  }, [verify]);

  const goDashboard = () => {
    navigate('/admin/salon-management', { replace: true });
  };

  const renderBody = () => {
    if (state.phase === 'verifying') {
      return (
        <>
          <Loader2 className="w-16 h-16 text-amber-400 animate-spin mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Verifying payment…</h1>
          <p className="text-zinc-400">Please don't close this window.</p>
        </>
      );
    }
    if (state.phase === 'success') {
      return (
        <>
          <CheckCircle2 className="w-20 h-20 text-emerald-400 mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <Crown className="w-7 h-7 text-amber-400" /> Welcome to SalonHub Pro!
          </h1>
          <p className="text-zinc-300 mb-1">Your subscription is active.</p>
          {state.data?.expiry_date && (
            <p className="text-sm text-zinc-500 mb-6">
              Renews on {new Date(state.data.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          )}
          <Button onClick={goDashboard} className="bg-gradient-to-r from-amber-500 to-orange-500">
            Go to Dashboard
          </Button>
        </>
      );
    }
    if (state.phase === 'pending') {
      return (
        <>
          <Loader2 className="w-16 h-16 text-amber-400 animate-spin mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Payment pending</h1>
          <p className="text-zinc-400 max-w-md text-center mb-4">
            Your bank hasn't confirmed yet. We'll auto-update once Cashfree notifies us. You can refresh in a few seconds.
          </p>
          <div className="flex gap-2">
            <Button onClick={verify} variant="outline">Refresh</Button>
            <Button onClick={goDashboard}>Back to Dashboard</Button>
          </div>
        </>
      );
    }
    if (state.phase === 'failed') {
      return (
        <>
          <XCircle className="w-20 h-20 text-rose-500 mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Payment failed</h1>
          <p className="text-zinc-400 max-w-md text-center mb-6">
            We couldn't confirm the payment. No money was charged, or it has been refunded by your bank.
          </p>
          <Button onClick={goDashboard}>Back to Dashboard</Button>
        </>
      );
    }
    return (
      <>
        <XCircle className="w-20 h-20 text-rose-500 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-zinc-400 max-w-md text-center mb-6">{state.error || 'Unknown error'}</p>
        <Button onClick={goDashboard}>Back to Dashboard</Button>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-black to-zinc-950 flex items-center justify-center p-6">
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-10 flex flex-col items-center text-center max-w-lg w-full">
        {renderBody()}
      </div>
    </div>
  );
}
