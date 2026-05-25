/**
 * Phase 8 (Part B) — Supplier Auth Context.
 *
 * Manages: supplier JWT (localStorage 'salonhub_supplier_token'),
 * current supplier profile, login (OTP or password), logout.
 *
 * Status gating: if profile fetch returns 403 with code='supplier_not_active',
 * we capture the status (pending_approval / rejected / suspended) so the
 * /supplier/pending screen can display the right message.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const TOKEN_KEY = 'salonhub_supplier_token';

const SupplierAuthContext = createContext({
  supplier: null,
  token: null,
  loading: false,
  blockedStatus: null,           // 'pending_approval' | 'rejected' | 'suspended' | null
  blockedDetail: null,           // { status, message, rejection_reason }
  authHeaders: {},
  loginWithPassword: async () => {},
  requestOtp: async () => {},
  verifyOtp: async () => {},
  signup: async () => {},
  logout: () => {},
  refresh: async () => {},
});

export const SupplierAuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(false);
  const [blockedStatus, setBlockedStatus] = useState(null);
  const [blockedDetail, setBlockedDetail] = useState(null);

  // Stable headers object — only re-created when token changes.
  // Consumers can safely include this in useEffect dependency arrays.
  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : null),
    [token],
  );

  const refresh = useCallback(async () => {
    if (!token) {
      setSupplier(null);
      return;
    }
    setLoading(true);
    try {
      const r = await axios.get(`${API}/supplier/me`, { headers: authHeaders });
      setSupplier(r.data);
      setBlockedStatus(null);
      setBlockedDetail(null);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 403 && detail && typeof detail === 'object' && detail.code === 'supplier_not_active') {
        setBlockedStatus(detail.status);
        setBlockedDetail(detail);
        // Don't clear token immediately — let /supplier/pending consume it for retry.
      } else if (e?.response?.status === 401) {
        // Invalid/expired token
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setSupplier(null);
      }
    } finally {
      setLoading(false);
    }
  }, [token, authHeaders]);

  useEffect(() => { refresh(); }, [refresh]);

  const _handleLoginResponse = (data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setSupplier(data.supplier || null);
    setBlockedStatus(null);
    setBlockedDetail(null);
  };

  const _handleBlockedResponse = (e) => {
    const detail = e?.response?.data?.detail;
    if (e?.response?.status === 403 && detail && typeof detail === 'object' && detail.code === 'supplier_not_active') {
      setBlockedStatus(detail.status);
      setBlockedDetail(detail);
      return detail;
    }
    return null;
  };

  const loginWithPassword = useCallback(async (mobile, password) => {
    setLoading(true);
    try {
      const r = await axios.post(`${API}/supplier/auth/password-login`, { mobile, password });
      _handleLoginResponse(r.data);
      return { ok: true, supplier: r.data.supplier };
    } catch (e) {
      const blocked = _handleBlockedResponse(e);
      if (blocked) return { ok: false, blocked };
      const detail = e?.response?.data?.detail;
      throw new Error(typeof detail === 'string' ? detail : 'Login failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const requestOtp = useCallback(async (mobile) => {
    const r = await axios.post(`${API}/supplier/auth/request-otp`, { mobile });
    return r.data;
  }, []);

  const verifyOtp = useCallback(async (mobile, otp) => {
    setLoading(true);
    try {
      const r = await axios.post(`${API}/supplier/auth/verify-otp`, { mobile, otp });
      _handleLoginResponse(r.data);
      return { ok: true, supplier: r.data.supplier };
    } catch (e) {
      const blocked = _handleBlockedResponse(e);
      if (blocked) return { ok: false, blocked };
      const detail = e?.response?.data?.detail;
      throw new Error(typeof detail === 'string' ? detail : 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async (formData) => {
    const r = await axios.post(`${API}/supplier/signup`, formData);
    return r.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setSupplier(null);
    setBlockedStatus(null);
    setBlockedDetail(null);
  }, []);

  return (
    <SupplierAuthContext.Provider
      value={{
        supplier,
        token,
        loading,
        blockedStatus,
        blockedDetail,
        loginWithPassword,
        requestOtp,
        verifyOtp,
        signup,
        logout,
        refresh,
        authHeaders,
      }}
    >
      {children}
    </SupplierAuthContext.Provider>
  );
};

export const useSupplierAuth = () => useContext(SupplierAuthContext);
