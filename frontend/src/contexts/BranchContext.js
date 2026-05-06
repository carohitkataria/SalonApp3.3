import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const BranchContext = createContext();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STORAGE_KEY = 'salon_selected_branch_id';

export const BranchProvider = ({ children }) => {
  const { salonUser, getSalonUserHeaders } = useAuth();

  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchIdState] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || '';
  });
  const [loading, setLoading] = useState(false);

  const setSelectedBranchId = useCallback((id) => {
    setSelectedBranchIdState(id || '');
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
    // Notify the rest of the app so dashboards can refetch with the new branch.
    try { window.dispatchEvent(new CustomEvent('branch-changed', { detail: { branchId: id } })); } catch (e) {}
  }, []);

  const refreshBranches = useCallback(async (salonId) => {
    if (!salonId) return [];
    setLoading(true);
    try {
      const res = await axios.get(`${API}/salons/${salonId}/branches`, {
        headers: getSalonUserHeaders(),
      });
      const list = Array.isArray(res.data) ? res.data : [];
      setBranches(list);
      // Auto-select main branch if nothing selected (or current selection no longer exists)
      const currentExists = list.some((b) => b.id === selectedBranchId);
      if (!selectedBranchId || !currentExists) {
        const main = list.find((b) => b.is_main_branch) || list[0];
        if (main) setSelectedBranchId(main.id);
      }
      return list;
    } catch (e) {
      console.error('[Branch] failed to load branches:', e?.response?.data || e?.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [getSalonUserHeaders, selectedBranchId, setSelectedBranchId]);

  // Auto-load when a salon user logs in
  useEffect(() => {
    if (salonUser?.salonId) {
      refreshBranches(salonUser.salonId);
    } else {
      setBranches([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonUser?.salonId]);

  const selectedBranch = branches.find((b) => b.id === selectedBranchId) || null;

  // Helper to inject branch_id into params/url
  const withBranchParam = (params = {}) => {
    if (selectedBranchId) return { ...params, branch_id: selectedBranchId };
    return params;
  };

  return (
    <BranchContext.Provider
      value={{
        branches,
        selectedBranchId,
        selectedBranch,
        loading,
        setSelectedBranchId,
        refreshBranches,
        withBranchParam,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const ctx = useContext(BranchContext);
  if (!ctx) {
    // Allow non-provider usage (e.g. customer pages) — return safe defaults.
    return {
      branches: [],
      selectedBranchId: '',
      selectedBranch: null,
      loading: false,
      setSelectedBranchId: () => {},
      refreshBranches: async () => [],
      withBranchParam: (p = {}) => p,
    };
  }
  return ctx;
};
