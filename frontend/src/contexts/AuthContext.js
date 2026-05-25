import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper: turn any FastAPI error body into a safe string. FastAPI may return
// detail as a string OR a structured object (e.g. { code, message, reason }).
// Returning an object to a consumer that drops it into JSX/toast.error()
// crashes React with "Objects are not valid as a React child".
const extractErrorMessage = (error, fallback) => {
  const raw = error?.response?.data?.detail ?? error?.response?.data;
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    return raw.message || raw.detail || raw.error || fallback;
  }
  return error?.message || fallback;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [salonUser, setSalonUser] = useState(null); // New: multi-user salon auth
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refreshAuth = () => {
      // User
      const storedUser = localStorage.getItem('salon_user');
      setUser(storedUser ? JSON.parse(storedUser) : null);

      // Legacy admin token
      const adminToken = localStorage.getItem('salon_admin_token');
      setAdmin(adminToken ? { token: adminToken } : null);

      // Multi-user salon auth
      const storedSalonUser = localStorage.getItem('salon_user_auth');
      setSalonUser(storedSalonUser ? JSON.parse(storedSalonUser) : null);
    };
    refreshAuth();
    setLoading(false);

    // Listen for in-app auth-change events (login/logout from any component)
    // and cross-tab `storage` events. This keeps `salonUser` / `admin` in sync
    // with localStorage, preventing stale dashboard state when an admin logs in
    // right after a staff logout (or vice versa) on the same browser.
    const handler = () => refreshAuth();
    window.addEventListener('salon-auth-changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('salon-auth-changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const loginUser = async (name, phone, gender = null) => {
    try {
      // Auto-append +91 if not present
      let formattedPhone = phone;
      if (!phone.startsWith('+91')) {
        formattedPhone = `+91${phone}`;
      }

      const response = await axios.post(`${API}/user/login`, {
        name,
        phone: formattedPhone,
        gender
      });

      const userData = response.data;
      setUser(userData);
      localStorage.setItem('salon_user', JSON.stringify(userData));
      return { success: true, user: userData };
    } catch (error) {
      return { success: false, error: extractErrorMessage(error, 'Login failed') };
    }
  };

  const loginAdmin = async (username, password) => {
    try {
      const response = await axios.post(`${API}/auth/admin/login`, {
        username,
        password
      });

      const token = response.data.access_token;
      setAdmin({ token });
      localStorage.setItem('salon_admin_token', token);
      return { success: true };
    } catch (error) {
      return { success: false, error: extractErrorMessage(error, 'Invalid credentials') };
    }
  };

  const loginSalonUser = async (identifier, password) => {
    try {
      const response = await axios.post(`${API}/salon/users/login`, {
        identifier,
        password
      });

      const authData = {
        token: response.data.access_token,
        salonId: response.data.salon_id,
        userId: response.data.user_id,
        role: response.data.role,
        permissions: response.data.permissions,
        assignedBranchIds: response.data.assigned_branch_ids || []
      };
      
      setSalonUser(authData);
      localStorage.setItem('salon_user_auth', JSON.stringify(authData));
      return { success: true, data: authData };
    } catch (error) {
      return { success: false, error: extractErrorMessage(error, 'Login failed') };
    }
  };

  const logoutUser = () => {
    setUser(null);
    localStorage.removeItem('salon_user');
  };

  const updateUserOtpStatus = (isVerified, verifiedAt = null) => {
    if (user) {
      const updatedUser = {
        ...user,
        is_otp_verified: isVerified,
        otp_verified_at: verifiedAt
      };
      setUser(updatedUser);
      localStorage.setItem('salon_user', JSON.stringify(updatedUser));
    }
  };

  const logoutAdmin = () => {
    setAdmin(null);
    localStorage.removeItem('salon_admin_token');
  };

  const logoutSalonUser = () => {
    setSalonUser(null);
    localStorage.removeItem('salon_user_auth');
  };

  const getAdminHeaders = () => {
    if (admin?.token) {
      return { Authorization: `Bearer ${admin.token}` };
    }
    return {};
  };

  const getSalonUserHeaders = () => {
    if (salonUser?.token) {
      return { Authorization: `Bearer ${salonUser.token}` };
    }
    return {};
  };

  const isAdmin = () => {
    return salonUser?.role === 'admin';
  };

  const isStaff = () => {
    return salonUser?.role === 'staff';
  };

  const isBranchManager = () => {
    return salonUser?.role === 'branch_manager';
  };

  const getAssignedBranchIds = () => {
    return salonUser?.assignedBranchIds || [];
  };

  const hasPermission = (permission) => {
    if (salonUser?.role === 'admin') return true;
    return salonUser?.permissions?.[permission] || false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        admin,
        salonUser,
        loading,
        loginUser,
        loginAdmin,
        loginSalonUser,
        logoutUser,
        logoutAdmin,
        logoutSalonUser,
        updateUserOtpStatus,
        getAdminHeaders,
        getSalonUserHeaders,
        isAdmin,
        isStaff,
        isBranchManager,
        getAssignedBranchIds,
        hasPermission,
        isUserLoggedIn: !!user,
        isUserOtpVerified: !!user?.is_otp_verified,
        isAdminLoggedIn: !!admin,
        isSalonUserLoggedIn: !!salonUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
