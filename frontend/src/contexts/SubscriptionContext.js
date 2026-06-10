import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SubscriptionContext = createContext({
  status: null,
  plan: null,
  loading: false,
  paywallOpen: false,
  paywallReason: null,
  appliedDiscountCode: null,
  appliedDiscountQuote: null,
  refresh: () => {},
  openPaywall: () => {},
  closePaywall: () => {},
  setAppliedDiscount: () => {},
  clearAppliedDiscount: () => {},
});

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider = ({ salonId, children }) => {
  const [status, setStatus] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState(null);
  const [appliedDiscountCode, setAppliedDiscountCode] = useState(null);
  const [appliedDiscountQuote, setAppliedDiscountQuote] = useState(null);

  const refresh = useCallback(async () => {
    if (!salonId) return;
    try {
      setLoading(true);
      const [statusRes, planRes] = await Promise.all([
        axios.get(`${API}/salons/${salonId}/subscription/status`),
        axios.get(`${API}/subscription-plans/active`),
      ]);
      setStatus(statusRes.data);
      setPlan(planRes.data);
    } catch (e) {
      // Best-effort; keep previous state
      console.warn('Subscription refresh failed:', e?.response?.data || e.message);
    } finally {
      setLoading(false);
    }
  }, [salonId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-start a free trial when the user arrived from the landing-page CTA.
  // This is a one-shot side-effect: if `start_trial_intent` is set in
  // localStorage and the salon hasn't paid + hasn't already used the trial,
  // we call the backend `start-trial` endpoint and refresh the status.
  useEffect(() => {
    if (!salonId) return;
    let cancelled = false;
    const tryStartTrial = async () => {
      const intent = (() => {
        try { return localStorage.getItem('start_trial_intent'); } catch (_e) { return null; }
      })();
      if (intent !== 'true') return;
      // Clear the flag immediately so we never retry on subsequent mounts.
      try { localStorage.removeItem('start_trial_intent'); } catch (_e) { /* ignore */ }

      // Build auth header from existing localStorage session.
      const authHeaders = (() => {
        try {
          const sa = JSON.parse(localStorage.getItem('salon_user_auth') || 'null');
          if (sa?.token) return { Authorization: `Bearer ${sa.token}` };
        } catch (_e) { /* ignore */ }
        const legacy = localStorage.getItem('salon_admin_token');
        return legacy ? { Authorization: `Bearer ${legacy}` } : {};
      })();
      if (!authHeaders.Authorization) return; // not logged in yet

      try {
        await axios.post(
          `${API}/salons/${salonId}/subscription/start-trial`,
          {},
          { headers: authHeaders }
        );
        if (!cancelled) {
          await refresh();
        }
      } catch (e) {
        // Silent on the common "trial already used" / "already subscribed" cases.
        console.warn('[Subscription] start-trial skipped:', e?.response?.data?.detail || e.message);
      }
    };
    tryStartTrial();
    return () => { cancelled = true; };
  }, [salonId, refresh]);

  const openPaywall = useCallback((reason = null) => {
    setPaywallReason(reason);
    setPaywallOpen(true);
  }, []);

  const closePaywall = useCallback(() => {
    setPaywallOpen(false);
    setPaywallReason(null);
  }, []);

  // Phase 7 — applied discount code persistence (in-memory, cleared on success/manual remove)
  const setAppliedDiscount = useCallback((code, quote) => {
    setAppliedDiscountCode(code || null);
    setAppliedDiscountQuote(quote || null);
  }, []);

  const clearAppliedDiscount = useCallback(() => {
    setAppliedDiscountCode(null);
    setAppliedDiscountQuote(null);
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        status,
        plan,
        loading,
        paywallOpen,
        paywallReason,
        appliedDiscountCode,
        appliedDiscountQuote,
        refresh,
        openPaywall,
        closePaywall,
        setAppliedDiscount,
        clearAppliedDiscount,
        isPremium: status?.is_premium || false,
        salonId,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

/**
 * Helper: detect 402 subscription_required responses from axios errors
 * and return a normalized object {limit_type, message, plan_price, plan_name} or null.
 */
export const parseSubscriptionError = (err) => {
  const status = err?.response?.status;
  if (status !== 402) return null;
  const detail = err?.response?.data?.detail;
  if (detail && typeof detail === 'object' && detail.error === 'subscription_required') {
    return detail;
  }
  return null;
};
