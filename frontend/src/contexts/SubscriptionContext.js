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
