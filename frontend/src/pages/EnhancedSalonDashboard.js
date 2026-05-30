import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '@/contexts/BranchContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import ThemeToggle from '@/components/ThemeToggle';
import BarberManagement from '@/components/BarberManagement';
import BranchManagement from '@/components/BranchManagement';
import BranchSelector from '@/components/BranchSelector';
import CustomerMaster from '@/components/CustomerMaster';
import OfferingsModule from '@/components/OfferingsModule';
import FinancialsModule from '@/components/FinancialsModule';
import MyProfile from '@/components/MyProfile';
import SalonNotificationSettings from '@/components/SalonNotificationSettings';
import OperationalHoursModule from '@/components/OperationalHoursModule';
import Analytics from '@/components/Analytics';
import EmployeeRewardPlan from '@/components/EmployeeRewardPlan';
import SubscriptionPaywallModal from '@/components/SubscriptionPaywallModal';
import SubscriptionBadge from '@/components/SubscriptionBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { getSession, clearSession } from '@/utils/sessionManager';
import {
  requestNotificationPermission,
  showBrowserNotification,
  getSeenIds,
  setSeenIds,
} from '@/utils/browserNotifications';
import {
  Scissors, LogOut, ChevronRight, SkipForward, RotateCcw, XCircle,
  Clock, User, Phone, Bell, MapPin, Settings, CheckCircle, Calendar,
  Users, ArrowLeft, FileText, Download, Plus, X, TrendingUp, Menu,
  Shield, DollarSign, Database, Pin, PinOff, Edit, CreditCard, Banknote, Smartphone,
  LayoutDashboard, Activity, Zap, Wallet, Search, Building2, ShoppingBag, Boxes
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function EnhancedSalonDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { subscribe, unsubscribe } = useWebSocket();
  const { salonUser, isAdmin, hasPermission, isBranchManager } = useAuth();
  const { selectedBranchId } = useBranch();
  
  const [activeTab, setActiveTab] = useState(() => {
    // URL param takes precedence, then localStorage, then 'home'
    const urlTab = new URLSearchParams(window.location.search).get('tab');
    const storedTab = localStorage.getItem('salon_active_tab') || 'home';
    const requestedTab = urlTab || storedTab;
    
    // SECURITY: Check if requested tab is allowed for this user
    const isAdmin = (() => {
      let storedSalonUser = null;
      try {
        const raw = localStorage.getItem('salon_user_auth');
        if (raw) storedSalonUser = JSON.parse(raw);
      } catch (e) { storedSalonUser = null; }
      if (storedSalonUser) return storedSalonUser?.role === 'admin';
      return !!localStorage.getItem('salon_admin_token');
    })();

    const isBM = (() => {
      try {
        const raw = localStorage.getItem('salon_user_auth');
        if (raw) return JSON.parse(raw)?.role === 'branch_manager';
      } catch (e) {}
      return false;
    })();
    
    const hasPermission = (permission) => {
      let storedSalonUser = null;
      try {
        const raw = localStorage.getItem('salon_user_auth');
        if (raw) storedSalonUser = JSON.parse(raw);
      } catch (e) { storedSalonUser = null; }
      if (storedSalonUser?.role === 'admin') return true;
      return !!storedSalonUser?.permissions?.[permission];
    };
    
    // Check restricted tabs
    const restrictedTabs = {
      'staff': isAdmin || isBM,
      'financials': isAdmin || isBM || hasPermission('can_access_financials'),
      'analytics': isAdmin || isBM || hasPermission('can_access_analytics'),
      'salon': isAdmin || hasPermission('can_edit_salon'),
      'branches': isAdmin || isBM
    };
    
    const allowed = restrictedTabs[requestedTab] ?? true;
    return allowed ? requestedTab : 'home';
  });

  // React to URL param changes so notification clicks jump to the right tab
  // SECURITY: Also validate against permissions
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) {
      // Build allowed tabs based on current permissions
      const isAdmin = (() => {
        let storedSalonUser = null;
        try {
          const raw = localStorage.getItem('salon_user_auth');
          if (raw) storedSalonUser = JSON.parse(raw);
        } catch (e) { storedSalonUser = null; }
        if (storedSalonUser) return storedSalonUser?.role === 'admin';
        return !!localStorage.getItem('salon_admin_token');
      })();
      
      const hasPermission = (permission) => {
        let storedSalonUser = null;
        try {
          const raw = localStorage.getItem('salon_user_auth');
          if (raw) storedSalonUser = JSON.parse(raw);
        } catch (e) { storedSalonUser = null; }
        if (storedSalonUser?.role === 'admin') return true;
        return !!storedSalonUser?.permissions?.[permission];
      };
      
      // Check if tab is allowed for this user
      const isBM = (() => {
        try {
          const raw = localStorage.getItem('salon_user_auth');
          if (raw) return JSON.parse(raw)?.role === 'branch_manager';
        } catch (e) {}
        return false;
      })();
      const restrictedTabs = {
        'staff': isAdmin || isBM,
        'financials': isAdmin || isBM || hasPermission('can_access_financials'),
        'analytics': isAdmin || isBM || hasPermission('can_access_analytics'),
        'salon': isAdmin || hasPermission('can_edit_salon'),
        'branches': isAdmin || isBM
      };
      
      const allowed = restrictedTabs[tab] ?? true;
      if (allowed) {
        setActiveTab(tab);
      } else {
        // Redirect to home if not allowed
        setActiveTab('home');
        try { localStorage.setItem('salon_active_tab', 'home'); } catch (e) {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [salonId, setSalonId] = useState(null);
  const [salon, setSalon] = useState(null);
  const [barbers, setBarbers] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [selectedBarber, setSelectedBarber] = useState('all');
  const [filter, setFilter] = useState('all');
  // Today/Tomorrow date state — used for queue + home dashboard
  const getISTDateOffset = (daysOffset = 0) => {
    const now = new Date();
    const istMs = now.getTime() + now.getTimezoneOffset() * 60000 + 5.5 * 3600000;
    const ist = new Date(istMs + daysOffset * 86400000);
    return ist.toISOString().split('T')[0];
  };
  const [dateMode, setDateMode] = useState('today'); // 'today' | 'tomorrow'
  const date = dateMode === 'today' ? getISTDateOffset(0) : getISTDateOffset(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPinned, setMenuPinned] = useState(() => {
    return localStorage.getItem('menu_pinned') === 'true';
  });
  
  // Add Services Dialog State
  const [addServicesDialog, setAddServicesDialog] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
  const [allServices, setAllServices] = useState([]);
  const [selectedNewServices, setSelectedNewServices] = useState([]);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [modifyTab, setModifyTab] = useState('services'); // kept for compatibility
  const [selectedNewBarber, setSelectedNewBarber] = useState(null);
  const [confirmPaymentMode, setConfirmPaymentMode] = useState('cash');
  const [finalAmount, setFinalAmount] = useState(0);
  
  // Payment Confirmation Dialog (for Complete action)
  const [showPaymentConfirmDialog, setShowPaymentConfirmDialog] = useState(false);
  const [pendingCompleteTokenId, setPendingCompleteTokenId] = useState(null);
  const [completePaymentMode, setCompletePaymentMode] = useState('cash');
  // Wallet + partial-payment state for the "Complete" dialog
  const [walletInfo, setWalletInfo] = useState(null); // { wallet_balance, membership_name, tier, color, has_membership }
  const [completeWalletAmount, setCompleteWalletAmount] = useState(0);
  const [completeCashAmount, setCompleteCashAmount] = useState(0);
  const [completeUpiAmount, setCompleteUpiAmount] = useState(0);
  const [completeTokenTotal, setCompleteTokenTotal] = useState(0);
  
  // Notifications
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Home dashboard
  const [dailySales, setDailySales] = useState(0);
  const [homeBarberFilter, setHomeBarberFilter] = useState('all');
  
  // Manual Booking Dialog State
  const [showManualBookingDialog, setShowManualBookingDialog] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [bookingMode, setBookingMode] = useState('existing'); // 'existing' or 'adhoc'
  const [manualBookingForm, setManualBookingForm] = useState({
    customer_name: '',
    phone: '',
    gender: 'Men',
    barber_id: 'any',
    selected_services: [],
    payment_mode: 'cash'
  });
  const [manualSelectedCategory, setManualSelectedCategory] = useState('All');

  useEffect(() => {
    const storedSalonId = localStorage.getItem('salon_id');
    const legacyToken = localStorage.getItem('salon_admin_token');
    const salonUserAuth = localStorage.getItem('salon_user_auth');
    
    // Check for either legacy token or new multi-user auth
    if (!storedSalonId || (!legacyToken && !salonUserAuth)) {
      navigate('/salon/login');
      return;
    }

    setSalonId(storedSalonId);
    fetchSalonData(storedSalonId);
    fetchBarbers(storedSalonId);
    fetchTokens(storedSalonId);
    fetchNotificationCount(storedSalonId);
    fetchDailySales(storedSalonId);

    // WebSocket subscriptions
    const handleUpdate = () => {
      if (storedSalonId) {
        fetchTokens(storedSalonId);
        fetchDailySales(storedSalonId);
      }
    };

    subscribe('token_created', handleUpdate);
    subscribe('new_token', handleUpdate);
    subscribe('token_updated', handleUpdate);
    subscribe('token_called', handleUpdate);
    subscribe('token_completed', handleUpdate);
    subscribe('token_skipped', handleUpdate);
    subscribe('token_recalled', handleUpdate);
    subscribe('token_cancelled', handleUpdate);
    subscribe('token_status_changed', handleUpdate);

    return () => {
      unsubscribe('token_created', handleUpdate);
      unsubscribe('new_token', handleUpdate);
      unsubscribe('token_updated', handleUpdate);
      unsubscribe('token_called', handleUpdate);
      unsubscribe('token_completed', handleUpdate);
      unsubscribe('token_skipped', handleUpdate);
      unsubscribe('token_recalled', handleUpdate);
      unsubscribe('token_cancelled', handleUpdate);
      unsubscribe('token_status_changed', handleUpdate);
    };
  }, [filter, selectedBarber]);

  // Polling fallback: every 20s re-fetch tokens + daily sales so the dashboard
  // stays in sync even if a websocket event is missed (network blip, mobile lock, etc.)
  useEffect(() => {
    const storedSalonId = localStorage.getItem('salon_id');
    if (!storedSalonId) return;
    const tick = () => {
      // Only refresh while the tab is visible — saves resources / mobile battery.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      fetchTokens(storedSalonId);
      fetchDailySales(storedSalonId);
    };
    const id = setInterval(tick, 20000);
    // Also refresh immediately when the tab becomes visible again.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchTokens(storedSalonId);
        fetchDailySales(storedSalonId);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, selectedBarber, dateMode]);

  // Re-fetch tokens when date mode (today/tomorrow) toggles
  useEffect(() => {
    if (salonId) {
      fetchTokens(salonId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateMode, salonId]);

  // Re-fetch dashboard data when the user switches the active branch.
  useEffect(() => {
    if (!salonId) return;
    fetchTokens(salonId);
    fetchBarbers(salonId);
    fetchDailySales(salonId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);

  // SECURITY: Reset active tab to 'home' if it's not in the menuItems list
  // (e.g., a staff user with a stale `salon_active_tab=financials` from a previous
  // admin session must not silently land on a forbidden tab).
  useEffect(() => {
    const allowedIds = menuItems.map(m => m.id);
    if (activeTab && !allowedIds.includes(activeTab)) {
      setActiveTab('home');
      try { localStorage.setItem('salon_active_tab', 'home'); } catch (e) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonUser, salonId]);

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('salon_active_tab', activeTab);
  }, [activeTab]);

  // Browser notifications: detect new unread notifications and show native popup + sound
  useEffect(() => {
    if (!salonId) return;
    requestNotificationPermission();
    const storageKey = `seen_notif_salon_${salonId}`;
    let initialised = false;

    const pollNotifs = async () => {
      try {
        const res = await axios.get(`${API}/notifications/salon/${salonId}`);
        const notifs = Array.isArray(res.data) ? res.data : (res.data?.notifications || []);
        const seen = getSeenIds(storageKey);
        if (!initialised) {
          notifs.forEach(n => { if (n.id) seen.add(n.id); });
          setSeenIds(storageKey, seen);
          initialised = true;
          return;
        }
        const sorted = [...notifs].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        sorted.forEach(n => {
          if (!n.id || seen.has(n.id)) return;
          seen.add(n.id);
          if (n.is_read === false || n.read === false || n.is_read === undefined) {
            showBrowserNotification(
              n.title || 'New Salon Notification',
              n.message || n.body || '',
              { tag: `salon-${n.id}` }
            );
          }
        });
        setSeenIds(storageKey, seen);
      } catch (e) { /* silent */ }
    };
    pollNotifs();
    const interval = setInterval(pollNotifs, 30000);
    return () => clearInterval(interval);
  }, [salonId]);

  const getAuthHeaders = () => {
    // Try new multi-user auth first, fall back to legacy
    const salonUserAuth = localStorage.getItem('salon_user_auth');
    if (salonUserAuth) {
      try {
        const authData = JSON.parse(salonUserAuth);
        return { Authorization: `Bearer ${authData.token}` };
      } catch (e) {
        // Fall through to legacy token
      }
    }
    
    const legacyToken = localStorage.getItem('salon_admin_token');
    return { Authorization: `Bearer ${legacyToken}` };
  };

  const fetchSalonData = async (id) => {
    try {
      const response = await axios.get(`${API}/salons/${id}`);
      setSalon(response.data);
    } catch (error) {
      console.error('Error fetching salon:', error);
    }
  };

  const fetchBarbers = async (id) => {
    try {
      const params = new URLSearchParams();
      if (selectedBranchId) params.set('branch_id', selectedBranchId);
      const url = `${API}/salons/${id}/barbers${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await axios.get(url);
      setBarbers(response.data);
    } catch (error) {
      console.error('Error fetching barbers:', error);
    }
  };

  const fetchTokens = async (id) => {
    try {
      let url;
      if (selectedBarber === 'all') {
        url = `${API}/salons/${id}/queue?date=${date}`;
      } else {
        url = `${API}/salons/${id}/barbers/${selectedBarber}/queue?date=${date}`;
      }
      if (filter !== 'all') {
        url += `&status=${filter}`;
      }
      if (selectedBranchId) {
        url += `&branch_id=${selectedBranchId}`;
      }
      
      const response = await axios.get(url);
      setTokens(response.data);
    } catch (error) {
      console.error('Error fetching tokens:', error);
    }
  };

  const handleCallNext = async (barberId) => {
    try {
      if (!barberId) {
        // Call next for any barber (first waiting token in queue)
        const waitingTokens = tokens.filter(t => t.status === 'waiting').sort((a, b) => a.token_number - b.token_number);
        if (waitingTokens.length === 0) {
          toast.error('No waiting customers in queue');
          return;
        }
        const nextToken = waitingTokens[0];
        barberId = nextToken.barber_id;
      }
      
      await axios.post(
        `${API}/salons/${salonId}/barbers/${barberId}/call-next`,
        {},
        { headers: getAuthHeaders() }
      );
      toast.success('Next token called');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to call next token');
    }
  };

  // Optimistic helper: mutate the local tokens list immediately so the card moves
  // to the next category before the websocket / re-fetch lands.
  const setTokenStatusLocally = (tokenId, newStatus, extra = {}) => {
    setTokens(prev =>
      Array.isArray(prev)
        ? prev.map(t => (t.id === tokenId ? { ...t, status: newStatus, ...extra } : t))
        : prev
    );
  };

  const handleCallToken = async (tokenId) => {
    // Optimistic: move to "called" immediately
    setTokenStatusLocally(tokenId, 'called');
    try {
      await axios.post(`${API}/tokens/${tokenId}/call`, {}, { headers: getAuthHeaders() });
      toast.success('Token called');
    } catch (error) {
      toast.error('Failed to call token');
      fetchTokens(salonId); // re-sync from server on failure
    }
  };

  const handleSkipToken = async (tokenId) => {
    if (!window.confirm('Skip this token? This action is final and cannot be undone.')) return;
    
    setTokenStatusLocally(tokenId, 'skipped');
    try {
      await axios.post(`${API}/tokens/${tokenId}/skip`, {}, { headers: getAuthHeaders() });
      toast.success('Token skipped');
    } catch (error) {
      toast.error('Failed to skip token');
      fetchTokens(salonId);
    }
  };

  const handleRecallToken = async (tokenId) => {
    setTokenStatusLocally(tokenId, 'waiting');
    try {
      await axios.post(`${API}/tokens/${tokenId}/recall`, {}, { headers: getAuthHeaders() });
      toast.success('Token recalled');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to recall token');
      fetchTokens(salonId);
    }
  };

  const handleCompleteToken = async (tokenId) => {
    // Find the token to check payment status
    const token = tokens.find(t => t.id === tokenId);
    if (token && !token.payment_confirmed) {
      // Pre-fetch wallet balance so we can show it + enable partial wallet
      const totalAmt = Number(token.total_amount) || 0;
      setPendingCompleteTokenId(tokenId);
      setCompletePaymentMode(token.payment_mode || 'cash');
      setCompleteTokenTotal(totalAmt);
      setCompleteWalletAmount(0);
      setCompleteCashAmount(totalAmt);
      setCompleteUpiAmount(0);
      setWalletInfo(null);
      try {
        const phoneQ = (token.phone || '').replace(/^\+91/, '');
        if (phoneQ && token.salon_id) {
          const res = await axios.get(`${API}/salons/${token.salon_id}/customers/${phoneQ}/wallet`);
          setWalletInfo(res.data || null);
        }
      } catch (err) {
        // Non-fatal — dialog still opens with wallet balance = 0
        console.warn('Failed to fetch wallet:', err);
      }
      setShowPaymentConfirmDialog(true);
      return;
    }
    
    if (!window.confirm('Mark this customer as completed? Invoice will be generated.')) return;
    
    setTokenStatusLocally(tokenId, 'completed');
    try {
      await axios.post(`${API}/tokens/${tokenId}/complete`, {}, { headers: getAuthHeaders() });
      toast.success('Token marked as completed');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete token');
      fetchTokens(salonId);
    }
  };

  // Helpers for the partial-payment dialog
  const applyWalletSelection = (mode) => {
    const bal = Number(walletInfo?.wallet_balance) || 0;
    const total = completeTokenTotal;
    if (mode === 'wallet_full') {
      if (bal >= total) {
        setCompleteWalletAmount(total);
        setCompleteCashAmount(0);
        setCompleteUpiAmount(0);
        setCompletePaymentMode('wallet');
      } else {
        // Partial: use all wallet, rest in cash
        setCompleteWalletAmount(bal);
        setCompleteCashAmount(Math.max(0, total - bal));
        setCompleteUpiAmount(0);
        setCompletePaymentMode('split');
      }
    } else if (mode === 'wallet_partial') {
      const useWallet = Math.min(bal, total);
      setCompleteWalletAmount(useWallet);
      setCompleteCashAmount(Math.max(0, total - useWallet));
      setCompleteUpiAmount(0);
      setCompletePaymentMode(useWallet > 0 ? 'split' : 'cash');
    } else if (mode === 'cash') {
      setCompleteWalletAmount(0);
      setCompleteCashAmount(total);
      setCompleteUpiAmount(0);
      setCompletePaymentMode('cash');
    } else if (mode === 'upi') {
      setCompleteWalletAmount(0);
      setCompleteCashAmount(0);
      setCompleteUpiAmount(total);
      setCompletePaymentMode('upi');
    }
  };

  const handleConfirmPaymentAndComplete = async () => {
    if (!pendingCompleteTokenId) return;
    
    const total = completeTokenTotal;
    const w = Number(completeWalletAmount) || 0;
    const c = Number(completeCashAmount) || 0;
    const u = Number(completeUpiAmount) || 0;
    const sum = w + c + u;

    if (Math.abs(sum - total) > 1) {
      toast.error(`Totals mismatch: entered ₹${sum.toFixed(0)}, expected ₹${total.toFixed(0)}`);
      return;
    }
    const walletBal = Number(walletInfo?.wallet_balance) || 0;
    if (w > walletBal + 0.001) {
      toast.error(`Wallet amount ₹${w.toFixed(0)} exceeds available balance ₹${walletBal.toFixed(0)}`);
      return;
    }

    try {
      await axios.post(
        `${API}/tokens/${pendingCompleteTokenId}/confirm-payment`,
        {
          payment_mode: completePaymentMode,
          wallet_amount: w,
          cash_amount: c,
          upi_amount: u,
        },
        { headers: getAuthHeaders() }
      );
      
      // Then complete the token
      await axios.post(`${API}/tokens/${pendingCompleteTokenId}/complete`, {}, { headers: getAuthHeaders() });
      toast.success('Payment confirmed and token marked as completed');
      setShowPaymentConfirmDialog(false);
      setPendingCompleteTokenId(null);
      fetchTokens(salonId);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete token');
    }
  };

  const handleConfirmPaymentOnly = async () => {
    if (!selectedToken) return;
    
    try {
      await axios.post(
        `${API}/tokens/${selectedToken.id}/confirm-payment`,
        { payment_mode: confirmPaymentMode },
        { headers: getAuthHeaders() }
      );
      toast.success('Payment confirmed successfully');
      setAddServicesDialog(false);
      fetchTokens(salonId);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to confirm payment');
    }
  };

  const handleChangeBarber = async () => {
    if (!selectedToken || !selectedNewBarber) return;
    
    try {
      const response = await axios.put(
        `${API}/tokens/${selectedToken.id}/change-barber`,
        { barber_id: selectedNewBarber },
        { headers: getAuthHeaders() }
      );
      toast.success(response.data.message || 'Barber changed successfully');
      setAddServicesDialog(false);
      fetchTokens(salonId);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change barber');
    }
  };

  // Unified save handler for the modify dialog
  const handleSaveAllModifications = async () => {
    if (!selectedToken) return;
    let anyChange = false;

    try {
      // 1. Check if services changed
      const originalServices = selectedToken.selected_services || [];
      const servicesChanged = JSON.stringify([...selectedNewServices].sort()) !== JSON.stringify([...originalServices].sort());
      if (servicesChanged && selectedNewServices.length > 0) {
        await axios.put(
          `${API}/tokens/${selectedToken.id}/update-services`,
          { service_ids: selectedNewServices },
          { headers: getAuthHeaders() }
        );
        anyChange = true;
      }

      // 2. Check if barber changed
      if (selectedNewBarber && selectedNewBarber !== selectedToken.barber_id) {
        await axios.put(
          `${API}/tokens/${selectedToken.id}/change-barber`,
          { barber_id: selectedNewBarber },
          { headers: getAuthHeaders() }
        );
        anyChange = true;
      }

      // 3. Update final amount if changed
      if (parseFloat(finalAmount) !== parseFloat(selectedToken.total_amount)) {
        await axios.put(
          `${API}/tokens/${selectedToken.id}/update-amount`,
          { final_amount: parseFloat(finalAmount) },
          { headers: getAuthHeaders() }
        );
        anyChange = true;
      }

      // 4. Handle payment: confirm if needed, or update mode if changed
      if (confirmPaymentMode && confirmPaymentMode !== 'not_confirmed') {
        const needsConfirmation = !selectedToken.payment_confirmed;
        const modeChanged = selectedToken.payment_mode !== confirmPaymentMode;
        
        if (needsConfirmation || modeChanged) {
          await axios.post(
            `${API}/tokens/${selectedToken.id}/confirm-payment`,
            { payment_mode: confirmPaymentMode },
            { headers: getAuthHeaders() }
          );
          anyChange = true;
        }
      }

      if (anyChange) {
        toast.success('Booking updated successfully');
      } else {
        toast.info('No changes detected');
      }

      setAddServicesDialog(false);
      fetchTokens(salonId);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update booking');
    }
  };

  const fetchNotificationCount = async (sid) => {
    try {
      const response = await axios.get(`${API}/notifications/salon/${sid}/unread-count`);
      setUnreadNotifCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Error fetching notification count:', error);
    }
  };

  const fetchDailySales = async (sid) => {
    try {
      const params = new URLSearchParams();
      if (selectedBranchId) params.set('branch_id', selectedBranchId);
      const url = `${API}/salons/${sid}/today-sales${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await axios.get(url, { headers: getAuthHeaders() });
      setDailySales(response.data.today_sales || 0);
    } catch (error) {
      console.error('Error fetching daily sales:', error);
    }
  };

  const handleCancelToken = async (tokenId) => {
    if (!window.confirm('Cancel this token?')) return;
    
    setTokenStatusLocally(tokenId, 'cancelled');
    try {
      await axios.post(`${API}/tokens/${tokenId}/cancel`, {}, { headers: getAuthHeaders() });
      toast.success('Token cancelled');
    } catch (error) {
      toast.error('Failed to cancel token');
      fetchTokens(salonId);
    }
  };

  const handleSendNotification = async (tokenId) => {
    try {
      await axios.post(`${API}/tokens/${tokenId}/notify`, {}, { headers: getAuthHeaders() });
      toast.success('Notification sent to customer');
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to send notification');
    }
  };

  const fetchAllServices = async () => {
    try {
      // Fetch only services enabled for THIS salon (not the global services list).
      // Falls back to the global list if the enabled endpoint fails for any reason.
      let enabled = [];
      try {
        const res = await axios.get(`${API}/salons/${salonId}/services/enabled`);
        enabled = Array.isArray(res.data) ? res.data : [];
      } catch (e) {
        console.warn('Enabled services fetch failed, falling back to /services');
        const fallback = await axios.get(`${API}/services`);
        enabled = fallback.data || [];
      }
      setAllServices(enabled);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to load services');
    }
  };

  const handleOpenAddServices = async (token) => {
    setSelectedToken(token);
    setSelectedNewServices(token.selected_services || []); // Pre-select existing services
    setSelectedNewBarber(token.barber_id);
    setConfirmPaymentMode(token.payment_confirmed ? (token.payment_mode || 'cash') : 'not_confirmed');
    setFinalAmount(token.total_amount || 0);
    setServiceSearchQuery('');
    await fetchAllServices();
    setAddServicesDialog(true);
  };

  const handleUpdateServices = async () => {
    // Check if any change was made
    const originalServices = selectedToken.selected_services || [];
    const hasChanges = JSON.stringify([...selectedNewServices].sort()) !== JSON.stringify([...originalServices].sort());
    
    if (!hasChanges) {
      toast.info('No changes made');
      setAddServicesDialog(false);
      return;
    }

    try {
      const response = await axios.put(
        `${API}/tokens/${selectedToken.id}/update-services`,
        { service_ids: selectedNewServices },
        { headers: getAuthHeaders() }
      );
      
      toast.success('Services updated successfully');
      setAddServicesDialog(false);
      fetchTokens(salonId); // Refresh token list to show updated amount
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update services');
    }
  };

  const toggleServiceSelection = (serviceId) => {
    setSelectedNewServices(prev => {
      const next = prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId];
      // Auto-recalculate final amount from selected services
      const total = allServices
        .filter(s => next.includes(s.id))
        .reduce((sum, s) => sum + (s.base_price || 0), 0);
      setFinalAmount(total);
      return next;
    });
  };

  const fetchCustomers = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/customers`, {
        headers: getAuthHeaders()
      });
      setCustomers(response.data.customers || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleOpenManualBooking = async () => {
    await fetchCustomers();
    await fetchAllServices();
    setBookingMode('existing');
    setCustomerSearchQuery('');
    setSelectedCustomer(null);
    setManualSelectedCategory('All');
    setManualBookingForm({
      customer_name: '',
      phone: '',
      gender: 'Men',
      barber_id: selectedBarber === 'all' ? 'any' : selectedBarber,
      selected_services: [],
      payment_mode: 'cash'
    });
    setShowManualBookingDialog(true);
  };

  const handleManualBooking = async () => {
    if (bookingMode === 'existing' && !manualBookingForm.customer_name) {
      toast.error('Please select a customer');
      return;
    }
    if (bookingMode === 'adhoc' && !manualBookingForm.customer_name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (manualBookingForm.selected_services.length === 0) {
      toast.error('Please select at least one service');
      return;
    }

    try {
      await axios.post(
        `${API}/salons/${salonId}/salon-booking`,
        {
          customer_name: manualBookingForm.customer_name,
          phone: manualBookingForm.phone,
          gender: manualBookingForm.gender,
          barber_id: manualBookingForm.barber_id,
          selected_services: manualBookingForm.selected_services,
          payment_mode: manualBookingForm.payment_mode,
          branch_id: selectedBranchId || undefined
        },
        { headers: getAuthHeaders() }
      );
      toast.success('Booking created successfully');
      setShowManualBookingDialog(false);
      fetchTokens(salonId);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    }
  };

  const handleCustomerSelection = (customer) => {
    setSelectedCustomer(customer);
    setManualBookingForm(prev => ({
      ...prev,
      customer_name: customer.name,
      phone: customer.phone,
      gender: customer.gender || 'Men'
    }));
  };

  const toggleManualServiceSelection = (serviceId) => {
    setManualBookingForm(prev => ({
      ...prev,
      selected_services: prev.selected_services.includes(serviceId)
        ? prev.selected_services.filter(id => id !== serviceId)
        : [...prev.selected_services, serviceId]
    }));
  };

  const handleLogout = () => {
    // SECURITY: Purge ALL salon auth data so the next user (especially staff)
    // can't inherit admin privileges from a stale legacy token in localStorage.
    try {
      localStorage.removeItem('salon_admin_token');
      localStorage.removeItem('salon_user_auth');
      localStorage.removeItem('salon_id');
      localStorage.removeItem('salon_active_tab');
    } catch (e) { /* ignore */ }
    clearSession();  // Clear all session data using session manager
    // Notify AuthContext to flush in-memory state so the next login renders cleanly
    try { window.dispatchEvent(new Event('salon-auth-changed')); } catch (e) {}
    navigate('/salon/login');
    toast.success('Logged out successfully');
  };

  // Check if user is admin. SECURITY: prefer multi-user auth over legacy.
  // If a multi-user auth is present (salon_user_auth), the legacy token MUST be
  // ignored — this prevents stale admin tokens from a previous session from
  // granting elevated access to a freshly logged-in staff user on the same browser.
  const checkIsAdmin = () => {
    // Read from localStorage directly to avoid race conditions with React state
    let storedSalonUser = null;
    try {
      const raw = localStorage.getItem('salon_user_auth');
      if (raw) storedSalonUser = JSON.parse(raw);
    } catch (e) { storedSalonUser = null; }

    if (storedSalonUser || salonUser) {
      const u = storedSalonUser || salonUser;
      return u?.role === 'admin';
    }
    // Only if NO multi-user auth, fall back to legacy salon login (treated as admin)
    const legacyToken = localStorage.getItem('salon_admin_token');
    return !!legacyToken;
  };

  const checkIsBranchManager = () => {
    let storedSalonUser = null;
    try {
      const raw = localStorage.getItem('salon_user_auth');
      if (raw) storedSalonUser = JSON.parse(raw);
    } catch (e) { storedSalonUser = null; }
    const u = storedSalonUser || salonUser;
    return u?.role === 'branch_manager';
  };

  const checkHasPermission = (permission) => {
    // Read multi-user auth from localStorage to be strict
    let storedSalonUser = null;
    try {
      const raw = localStorage.getItem('salon_user_auth');
      if (raw) storedSalonUser = JSON.parse(raw);
    } catch (e) { storedSalonUser = null; }

    const u = storedSalonUser || salonUser;
    if (u) {
      if (u.role === 'admin') return true;
      return !!u.permissions?.[permission];
    }
    // Legacy login (no multi-user auth at all) has all permissions
    const legacyToken = localStorage.getItem('salon_admin_token');
    if (legacyToken) return true;
    return false;
  };

  // Define menu items with role-based visibility
  const menuItems = [
    { id: 'home', label: 'Home', icon: LayoutDashboard, show: true },
    { id: 'queue', label: 'Token Queue', icon: Calendar, show: true },
    { id: 'staff', label: 'Staff Management', icon: Users, show: checkIsAdmin() || checkIsBranchManager() },
    { id: 'services', label: 'Services & Offerings', icon: Scissors, show: true },
    { id: 'financials', label: 'Financials', icon: DollarSign, show: checkIsAdmin() || checkIsBranchManager() || checkHasPermission('can_access_financials') },
    { id: 'customer-master', label: 'Customer Master', icon: Database, show: true },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp, show: checkIsAdmin() || checkIsBranchManager() || checkHasPermission('can_access_analytics') },
    { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag, show: checkIsAdmin(), route: '/salon/marketplace' },
    { id: 'inventory', label: 'Inventory', icon: Boxes, show: checkIsAdmin() || checkIsBranchManager(), route: '/salon/inventory' },
    { id: 'gallery', label: 'Gallery', icon: FileText, show: true },
    { id: 'salon', label: 'Salon Settings', icon: Settings, show: checkIsAdmin() || checkHasPermission('can_edit_salon') }
  ].filter(item => item.show);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'waiting': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'called': return <ChevronRight className="w-4 h-4 text-blue-500" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'skipped': return <SkipForward className="w-4 h-4 text-red-500" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-gray-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'waiting': return 'border-yellow-500/30 bg-yellow-500/5';
      case 'called': return 'border-blue-500/50 bg-blue-500/10';
      case 'completed': return 'border-green-500/30 bg-green-500/5';
      case 'skipped': return 'border-red-500/30 bg-red-500/5';
      case 'cancelled': return 'border-gray-500/30 bg-gray-500/5';
      default: return 'border-border';
    }
  };

  return (
    <SubscriptionProvider salonId={salonId}>
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="fixed inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
          style={{
            backgroundImage: `url('https://images.pexels.com/photos/3993293/pexels-photo-3993293.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940')`
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/90 to-gold/10" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="backdrop-blur-xl bg-background/80 border-b border-gold/20 p-3 md:p-4 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 md:space-x-4 min-w-0">
              {/* Hamburger Menu Button */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 hover:bg-gold/10 rounded-lg transition-colors flex-shrink-0"
              >
                <Menu className="w-6 h-6 text-gold" />
              </button>
              
              <div 
                className="hidden sm:block p-3 bg-gradient-to-br from-gold/20 to-gold/5 rounded-xl border border-gold/30 flex-shrink-0 cursor-pointer hover:bg-gold/30 transition-colors overflow-hidden"
                onClick={() => setActiveTab('home')}
                title="Go to Home"
              >
                {salon?.logo_url ? (
                  <img src={salon.logo_url} alt="Salon Logo" className="w-8 h-8 object-cover rounded" />
                ) : (
                  <Scissors className="w-8 h-8 text-gold" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-lg md:text-2xl font-playfair font-bold text-foreground truncate">Salon Dashboard</h1>
                <p className="text-xs md:text-sm text-gold truncate">{salon?.salon_name || 'Loading...'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0">
              <BranchSelector compact />
              <button
                onClick={() => {
                  setActiveTab('notifications');
                  if (!menuPinned) setMenuOpen(false);
                }}
                className="relative p-2 hover:bg-gold/10 rounded-lg transition-colors"
                title="Notifications"
              >
                <Bell className="w-5 h-5 text-gold" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Hamburger Menu Sidebar */}
        <AnimatePresence>
          {(menuOpen || menuPinned) && (
            <>
              {/* Backdrop - only show if not pinned */}
              {!menuPinned && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setMenuOpen(false)}
                  className="fixed inset-0 bg-black/50 z-40"
                />
              )}
              
              {/* Sidebar */}
              <motion.div
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: 'spring', damping: 20 }}
                className={`fixed left-0 top-0 bottom-0 w-64 md:w-72 bg-card border-r border-border shadow-2xl z-50 overflow-y-auto ${
                  menuPinned ? 'sticky' : ''
                }`}
              >
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Menu</h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const newPinned = !menuPinned;
                          setMenuPinned(newPinned);
                          localStorage.setItem('menu_pinned', newPinned);
                          if (newPinned) setMenuOpen(true);
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          menuPinned 
                            ? 'bg-gold/20 text-gold hover:bg-gold/30' 
                            : 'hover:bg-muted'
                        }`}
                        title={menuPinned ? 'Unpin menu' : 'Pin menu'}
                      >
                        {menuPinned ? <Pin className="w-5 h-5" /> : <PinOff className="w-5 h-5" />}
                      </button>
                      {!menuPinned && (
                        <button
                          onClick={() => setMenuOpen(false)}
                          className="p-2 hover:bg-muted rounded-lg"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {salonUser?.role === 'admin' ? 'Admin Access' : 'Staff Access'}
                  </p>
                </div>

                <div className="p-2">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        data-testid={`nav-${item.id}`}
                        onClick={() => {
                          if (item.route) {
                            // External-route menu items (e.g. Marketplace) — navigate
                            // to a separate page rather than switching tabs.
                            if (!menuPinned) setMenuOpen(false);
                            navigate(item.route);
                            return;
                          }
                          setActiveTab(item.id);
                          if (!menuPinned) setMenuOpen(false);
                        }}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                          activeTab === item.id
                            ? 'bg-gold text-black font-semibold'
                            : 'text-foreground hover:bg-muted'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
                
                {/* Bottom section: Theme toggle and Logout */}
                <div className="border-t border-border p-2 mt-2">
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-muted-foreground">Theme</span>
                    <ThemeToggle />
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-500 hover:bg-red-500/10 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Logout</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="max-w-7xl mx-auto p-4">

        {/* ===== HOME DASHBOARD ===== */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* Welcome Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-2xl font-playfair font-bold text-foreground">{salon?.salon_name || salon?.name || 'Salon'}</h2>
                <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="flex items-center gap-3">
                {/* Today / Tomorrow Toggle */}
                <div className="inline-flex rounded-lg border border-border bg-card p-1">
                  <button
                    onClick={() => setDateMode('today')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      dateMode === 'today' ? 'bg-gold text-black' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setDateMode('tomorrow')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      dateMode === 'tomorrow' ? 'bg-gold text-black' : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    Tomorrow
                  </button>
                </div>
                {/* Manual Toggle Status Badge */}
                {salon?.manual_toggle?.is_overridden && (() => {
                  const mt = salon.manual_toggle;
                  const isOnlineOnly = !mt.is_open && mt.closed_mode === 'online_only';
                  const isFullClosed = !mt.is_open && (mt.closed_mode === 'full' || !mt.closed_mode);
                  const isOpen = mt.is_open;
                  const cls = isOpen
                    ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400'
                    : isOnlineOnly
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400';
                  const dot = isOpen ? 'bg-green-500 animate-pulse' : isOnlineOnly ? 'bg-amber-500' : 'bg-red-500';
                  const label = isOpen
                    ? 'MANUALLY OPEN'
                    : isOnlineOnly
                      ? 'CLOSED ONLINE'
                      : 'MANUALLY CLOSED';
                  return (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${cls}`}>
                      <span className={`w-2 h-2 rounded-full ${dot}`}></span>
                      <span className="text-xs font-bold">{label}</span>
                    </div>
                  );
                })()}
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-green-500 animate-pulse" />
                  <span className="text-xs text-green-500 font-medium">Live</span>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div 
                className="bg-card border border-border rounded-xl p-4 hover:border-gold/30 transition-colors cursor-pointer"
                onClick={() => setActiveTab('queue')}
                title="View Queue"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-blue-500/10"><Calendar className="w-5 h-5 text-blue-500" /></div>
                </div>
                <p className="text-2xl font-bold text-foreground">{tokens.length}</p>
                <p className="text-xs text-muted-foreground">Total Tokens {dateMode === 'today' ? 'Today' : 'Tomorrow'}</p>
              </div>
              <div 
                className="bg-card border border-border rounded-xl p-4 hover:border-gold/30 transition-colors cursor-pointer"
                onClick={() => {
                  setActiveTab('queue');
                  setFilter('waiting');
                }}
                title="View Waiting Tokens"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-yellow-500/10"><Clock className="w-5 h-5 text-yellow-500" /></div>
                </div>
                <p className="text-2xl font-bold text-yellow-500">{tokens.filter(t => t.status === 'waiting' || t.status === 'called').length}</p>
                <p className="text-xs text-muted-foreground">Waiting / In Queue</p>
              </div>
              <div 
                className="bg-card border border-border rounded-xl p-4 hover:border-gold/30 transition-colors cursor-pointer"
                onClick={() => {
                  setActiveTab('queue');
                  setFilter('completed');
                }}
                title="View Completed Tokens"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-green-500/10"><CheckCircle className="w-5 h-5 text-green-500" /></div>
                </div>
                <p className="text-2xl font-bold text-green-500">{tokens.filter(t => t.status === 'completed').length}</p>
                <p className="text-xs text-muted-foreground">Served / Completed</p>
              </div>
              <div 
                className="bg-card border border-border rounded-xl p-4 hover:border-gold/30 transition-colors cursor-pointer"
                onClick={() => setActiveTab('analytics')}
                title="View Analytics"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-gold/10"><DollarSign className="w-5 h-5 text-gold" /></div>
                </div>
                <p className="text-2xl font-bold text-gold">₹{dailySales.toLocaleString('en-IN')}</p>
                <p className="text-xs text-muted-foreground">Today's Sales</p>
              </div>
            </div>

            {/* Upcoming Bookings */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Zap className="w-5 h-5 text-gold" /> Upcoming Queue
                </h3>
                <select
                  value={homeBarberFilter}
                  onChange={(e) => setHomeBarberFilter(e.target.value)}
                  className="h-8 px-3 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-gold/50"
                >
                  <option value="all">All Barbers</option>
                  {barbers.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              {(() => {
                const upcoming = tokens
                  .filter(t => (t.status === 'waiting' || t.status === 'called'))
                  .filter(t => homeBarberFilter === 'all' || t.barber_id === homeBarberFilter)
                  .slice(0, 5);
                return upcoming.length > 0 ? (
                  <div className="space-y-2">
                    {upcoming.map((token, idx) => (
                      <div key={token.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        token.status === 'called' ? 'border-blue-500/50 bg-blue-500/5' : 'border-border hover:border-gold/30'
                      }`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          token.status === 'called' ? 'bg-blue-500 text-white' : 'bg-gold/10 text-gold'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{token.customer_name}</span>
                            <span className="text-xs text-gold font-mono">{token.token_number}</span>
                            {token.status === 'called' && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-500 rounded font-medium">IN SERVICE</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {token.barber_name} • {token.selected_services?.length || 0} services • ₹{token.total_amount}
                          </p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          token.payment_confirmed ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
                        }`}>
                          {token.payment_confirmed ? `✓ ${(token.payment_mode || '').toUpperCase()}` : '⏳ Unpaid'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-500/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No upcoming bookings — queue is clear!</p>
                  </div>
                );
              })()}
              {tokens.filter(t => t.status === 'waiting' || t.status === 'called').length > 5 && (
                <button
                  onClick={() => setActiveTab('queue')}
                  className="w-full mt-3 py-2 text-xs text-gold hover:text-gold/80 font-medium transition-colors"
                >
                  View all {tokens.filter(t => t.status === 'waiting' || t.status === 'called').length} in queue →
                </button>
              )}
            </div>

            {/* Quick Navigation */}
            <div>
              <h3 className="text-lg font-bold mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { id: 'queue', label: 'Token Queue', icon: Calendar, color: 'bg-blue-500/10 text-blue-500', desc: 'Manage live queue', show: true },
                  { id: 'customer-master', label: 'Customers', icon: Database, color: 'bg-purple-500/10 text-purple-500', desc: 'Customer records', show: true },
                  { id: 'services', label: 'Services', icon: Scissors, color: 'bg-emerald-500/10 text-emerald-500', desc: 'Offerings & memberships', show: true },
                  { id: 'staff', label: 'Staff', icon: Users, color: 'bg-orange-500/10 text-orange-500', desc: 'Manage barbers', show: checkIsAdmin() },
                  { id: 'financials', label: 'Financials', icon: DollarSign, color: 'bg-gold/10 text-gold', desc: 'Cash flow & reports', show: checkIsAdmin() || checkHasPermission('can_access_financials') },
                  { id: 'analytics', label: 'Analytics', icon: TrendingUp, color: 'bg-cyan-500/10 text-cyan-500', desc: 'Performance stats', show: checkIsAdmin() || checkHasPermission('can_access_analytics') },
                  { id: 'gallery', label: 'Gallery', icon: FileText, color: 'bg-pink-500/10 text-pink-500', desc: 'Salon portfolio', show: true },
                  { id: 'salon', label: 'Settings', icon: Settings, color: 'bg-gray-500/10 text-gray-400', desc: 'Salon profile', show: checkIsAdmin() || checkHasPermission('can_edit_salon') },
                ].filter(item => item.show).map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id); if (!menuPinned) setMenuOpen(false); }}
                      className="p-4 bg-card border border-border rounded-xl hover:border-gold/40 transition-all text-left group"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${item.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <p className="font-semibold text-sm group-hover:text-gold transition-colors">{item.label}</p>
                      <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="space-y-6">
            {/* Date Toggle: Today / Tomorrow */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="inline-flex rounded-lg border border-border bg-card p-1">
                <button
                  onClick={() => setDateMode('today')}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                    dateMode === 'today' ? 'bg-gold text-black' : 'text-foreground hover:bg-muted'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setDateMode('tomorrow')}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                    dateMode === 'tomorrow' ? 'bg-gold text-black' : 'text-foreground hover:bg-muted'
                  }`}
                >
                  Tomorrow
                </button>
              </div>
              <div className="text-xs text-muted-foreground">
                Viewing bookings for <span className="font-semibold text-foreground">{new Date(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              </div>
            </div>
            {/* Barber Filter */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setSelectedBarber('all')}
                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg whitespace-nowrap text-sm ${
                  selectedBarber === 'all'
                    ? 'bg-gold text-black'
                    : 'bg-card border border-border text-foreground'
                }`}
              >
                All Barbers
              </button>
              {barbers.map(barber => (
                <button
                  key={barber.id}
                  onClick={() => setSelectedBarber(barber.id)}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg whitespace-nowrap text-sm ${
                    selectedBarber === barber.id
                      ? 'bg-gold text-black'
                      : 'bg-card border border-border text-foreground'
                  }`}
                >
                  {barber.name}
                </button>
              ))}
            </div>

            {/* Single Call Next Button Based on Selected Barber */}
            <div className="flex flex-row gap-2">
              <Button
                onClick={() => handleCallNext(selectedBarber === 'all' ? null : selectedBarber)}
                className="bg-gold text-black hover:bg-gold/90 px-3 md:px-8 py-3 text-xs md:text-lg w-[60%] md:flex-1"
                disabled={!tokens.some(t => t.status === 'waiting')}
              >
                <ChevronRight className="mr-1 md:mr-2 w-4 md:w-5 h-4 md:h-5" /> 
                Call Next {selectedBarber !== 'all' && `(${barbers.find(b => b.id === selectedBarber)?.name})`}
              </Button>
              <Button
                onClick={handleOpenManualBooking}
                variant="outline"
                className="border-gold text-gold hover:bg-gold/10 px-3 md:px-6 py-3 text-xs md:text-lg w-[40%] md:flex-none"
              >
                <Plus className="mr-1 md:mr-2 w-4 md:w-5 h-4 md:h-5" />
                <span className="hidden md:inline">Add Booking</span>
                <span className="md:hidden">Add</span>
              </Button>
            </div>

            {/* Status Filters */}
            <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-hide">
              {['all', 'waiting', 'called', 'completed', 'skipped', 'cancelled'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 md:px-4 py-1.5 md:py-2 rounded uppercase text-xs md:text-sm font-bold whitespace-nowrap ${
                    filter === f
                      ? 'bg-gold text-black'
                      : 'bg-card border border-border text-foreground'
                  }`}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Token List */}
            <div className="space-y-3">
              {tokens.map((token, index) => (
                <motion.div
                  key={token.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-card/90 backdrop-blur-sm border-2 ${getStatusColor(token.status)} rounded-xl p-3 md:p-4 hover:shadow-xl transition-all`}
                >
                  {/* Token Info Row */}
                  <div className="flex items-start gap-3">
                    <div className="text-2xl md:text-3xl font-bebas text-gold min-w-[48px] md:min-w-[60px] text-center bg-gold/10 rounded-lg p-1.5 md:p-2 border border-gold/30 flex-shrink-0">
                      {token.token_number || 'TBA'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-bold flex items-center space-x-2 text-sm md:text-base">
                        <User className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{token.customer_name}</span>
                      </p>
                      <p className="text-muted-foreground text-xs flex items-center space-x-2">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        <a href={`tel:${token.phone}`} className="hover:text-gold">
                          {token.phone}
                        </a>
                      </p>
                      <p className="text-muted-foreground text-xs truncate">
                        {token.barber_name} • {token.shift || token.time_slot} • ₹{token.total_amount}
                        {token.payment_confirmed && <span className="text-green-500 ml-1">• ✓ {(token.payment_mode || 'paid').toUpperCase()}</span>}
                        {!token.payment_confirmed && token.status !== 'completed' && <span className="text-yellow-500 ml-1">• ⏳ Unpaid</span>}
                      </p>
                      <p className="text-muted-foreground text-xs flex items-center space-x-1 mt-0.5">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{new Date(token.date).toLocaleDateString('en-IN')} at {token.created_at ? new Date(token.created_at).toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'}) : token.shift || token.time_slot}</span>
                      </p>
                    </div>
                    {/* Status Badge - always visible */}
                    <div className={`flex items-center space-x-1 px-2 md:px-3 py-1 rounded-full flex-shrink-0 ${
                      token.status === 'called' ? 'bg-blue-500/20 border border-blue-500' :
                      token.status === 'completed' ? 'bg-green-500/20 border border-green-500' :
                      token.status === 'skipped' ? 'bg-red-500/20 border border-red-500' :
                      'bg-muted border border-border'
                    }`}>
                      {getStatusIcon(token.status)}
                      <span className="text-xs uppercase font-bold">
                        {token.status === 'called' ? 'Called' : 
                         token.status === 'waiting' ? 'Waiting' :
                         token.status === 'completed' ? 'Done' :
                         token.status === 'skipped' ? 'Skip' : token.status}
                      </span>
                      {token.recall_count > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ({token.recall_count}x)
                        </span>
                      )}
                    </div>
                  </div>
                    
                  {/* Action Buttons - Below info, wrap on mobile */}
                  <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/50">
                      {/* Waiting Status Actions */}
                      {token.status === 'waiting' && (
                        <>
                          <Button 
                            size="sm" 
                            onClick={() => handleCallToken(token.id)} 
                            className="bg-blue-600 hover:bg-blue-700 h-8 text-xs px-2.5"
                            title="Call this customer now"
                          >
                            <ChevronRight className="w-3 h-3 mr-1" />
                            Call
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleOpenAddServices(token)} 
                            className="bg-purple-600 hover:bg-purple-700 h-8 text-xs px-2.5"
                            title="Modify booking"
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Modify
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleSendNotification(token.id)} 
                            className="bg-gray-600 hover:bg-gray-700 h-8 text-xs px-2"
                            title="Send notification"
                          >
                            <Bell className="w-3 h-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleSkipToken(token.id)} 
                            className="bg-orange-600 hover:bg-orange-700 text-white h-8 text-xs px-2"
                            title="Skip this customer"
                          >
                            <SkipForward className="w-3 h-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleCancelToken(token.id)} 
                            variant="outline"
                            className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white h-8 text-xs px-2"
                            title="Cancel token"
                          >
                            <XCircle className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                      
                      {/* Called Status Actions */}
                      {token.status === 'called' && (
                        <>
                          <Button 
                            size="sm" 
                            onClick={() => handleCompleteToken(token.id)} 
                            className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs px-2.5"
                            title="Mark as completed"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Complete
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleOpenAddServices(token)} 
                            className="bg-purple-600 hover:bg-purple-700 text-white h-8 text-xs px-2.5"
                            title="Modify booking"
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Modify
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleRecallToken(token.id)} 
                            className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs px-2.5"
                            title="Re-call customer"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Re-call
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleSkipToken(token.id)} 
                            className="bg-red-600 hover:bg-red-700 text-white h-8 text-xs px-2"
                            title="Skip customer"
                          >
                            <SkipForward className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                      
                      {/* Skipped Status Actions */}
                      {token.status === 'skipped' && (
                        <>
                          <Button 
                            size="sm" 
                            onClick={() => handleRecallToken(token.id)} 
                            className="bg-blue-600 hover:bg-blue-700 h-8 text-xs px-2.5"
                            title="Recall this customer"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Recall
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleCancelToken(token.id)} 
                            className="bg-red-600 hover:bg-red-700 text-white h-8 text-xs px-2.5"
                            title="Cancel this booking"
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Cancel
                          </Button>
                        </>
                      )}
                      
                      {/* Completed Status Actions */}
                      {token.status === 'completed' && token.invoice_id && (
                        <>
                          <Button 
                            size="sm" 
                            onClick={() => window.open(`${API}/invoices/${token.invoice_id}/view`, '_blank')} 
                            className="bg-purple-600 hover:bg-purple-700 text-white h-8 text-xs px-2.5"
                            title="View invoice"
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            Invoice
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = `${API}/invoices/${token.invoice_id}/download`;
                              link.download = `invoice_${token.token_number}.pdf`;
                              link.click();
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white h-8 text-xs px-2.5"
                            title="Download invoice"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Download
                          </Button>
                        </>
                      )}

                      {/* No actions for cancelled/future */}
                      {['cancelled', 'future'].includes(token.status) && (
                        <span className="text-xs text-muted-foreground italic px-1">No actions</span>
                      )}
                  </div>
                </motion.div>
              ))}

              {tokens.length === 0 && (
                <div className="text-center py-12 bg-card border border-border rounded-lg">
                  <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No tokens found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'staff' && salonId && (
          <div className="space-y-6">
            <div className="flex items-center justify-end">
              <button
                onClick={() => navigate('/salon/staff/settings')}
                data-testid="staff-settings-link"
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted transition-colors"
              >
                <Settings className="w-4 h-4" /> Staff Settings
              </button>
            </div>
            <BarberManagement salonId={salonId} getAuthHeaders={getAuthHeaders} />
            <EmployeeRewardPlan
              salonId={salonId}
              getAuthHeaders={getAuthHeaders}
              isAdmin={checkIsAdmin()}
            />
          </div>
        )}

        {activeTab === 'customer-master' && (
          <CustomerMaster salonId={salonId} getAuthHeaders={getAuthHeaders} />
        )}

        {activeTab === 'financials' && salonId && (
          <FinancialsModule salonId={salonId} getAuthHeaders={getAuthHeaders} />
        )}

        {activeTab === 'customer-master' && (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <Database className="w-16 h-16 text-gold mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Customer Master</h3>
            <p className="text-muted-foreground">
              Customer database, history, and preferences management coming soon.
            </p>
          </div>
        )}

        {activeTab === 'services' && (
          <OfferingsModule 
            salonId={salonId} 
            token={(() => {
              // Prefer multi-user token, fall back to legacy admin token
              try {
                const raw = localStorage.getItem('salon_user_auth');
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (parsed?.token) return parsed.token;
                }
              } catch (e) { /* ignore */ }
              return localStorage.getItem('salon_admin_token');
            })()}
          />
        )}

        {activeTab === 'gallery' && (
          <div className="space-y-6">
            <div className="bg-card/50 backdrop-blur-sm border border-gold/20 rounded-2xl p-6 shadow-xl">
              <h2 className="text-2xl font-playfair font-bold text-foreground mb-4 flex items-center">
                <FileText className="w-6 h-6 mr-3 text-gold" />
                Salon Photo Gallery
              </h2>
              <p className="text-muted-foreground mb-6">
                Showcase your salon's ambiance, services, and style. Upload photos to attract more customers.
              </p>

              {/* Upload Section */}
              <div className="mb-6 p-4 bg-background/50 rounded-lg border border-border">
                <Label className="mb-2 block font-semibold">Add Photos &amp; Videos</Label>
                <Input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={async (e) => {
                    const files = Array.from(e.target.files);
                    if (files.length === 0) return;
                    
                    const PHOTO_MAX = 5 * 1024 * 1024;   // 5 MB
                    const VIDEO_MAX = 25 * 1024 * 1024;  // 25 MB
                    
                    const newPhotos = [];
                    for (const file of files) {
                      const isVideo = (file.type || '').startsWith('video/');
                      const limit = isVideo ? VIDEO_MAX : PHOTO_MAX;
                      const limitLabel = isVideo ? '25MB (video)' : '5MB (photo)';
                      if (file.size > limit) {
                        toast.error(`${file.name} is too large (max ${limitLabel})`);
                        continue;
                      }
                      const reader = new FileReader();
                      await new Promise((resolve) => {
                        reader.onloadend = () => {
                          newPhotos.push(reader.result);
                          resolve();
                        };
                        reader.readAsDataURL(file);
                      });
                    }
                    
                    if (newPhotos.length > 0) {
                      const updatedGallery = [...(salon.photo_gallery || []), ...newPhotos];
                      try {
                        await axios.put(
                          `${API}/salons/${salonId}`,
                          { photo_gallery: updatedGallery },
                          { headers: getAuthHeaders() }
                        );
                        setSalon({ ...salon, photo_gallery: updatedGallery });
                        toast.success(`${newPhotos.length} file(s) added!`);
                      } catch (error) {
                        toast.error('Failed to upload media');
                      }
                    }
                    // Reset input so the same file can be re-selected
                    try { e.target.value = ''; } catch (err) { /* ignore */ }
                  }}
                  className="mb-2"
                />
                <p className="text-xs text-muted-foreground">Photos up to 5MB each • Videos up to 25MB each</p>
              </div>

              {/* Social Media Integration (Coming Soon) */}
              <div className="mb-6 p-4 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-amber-500/5 rounded-lg border border-gold/20">
                <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                  <div>
                    <Label className="font-semibold flex items-center gap-2">
                      Connect Social Media
                      <span className="text-[10px] uppercase tracking-wide bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold">
                        Coming Soon
                      </span>
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto-import posts from your Instagram, YouTube and Facebook into your gallery.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { name: 'Instagram', color: 'from-pink-500 to-purple-600', emoji: '\uD83D\uDCF8', hint: 'Pull latest posts &amp; reels' },
                    { name: 'YouTube',   color: 'from-red-500 to-red-700',     emoji: '\u25B6',     hint: 'Embed channel videos' },
                    { name: 'Facebook',  color: 'from-blue-500 to-blue-700',   emoji: '\uD83D\uDC4D', hint: 'Sync page posts' },
                    { name: 'TikTok',    color: 'from-gray-700 to-black',      emoji: '\uD83C\uDFB5', hint: 'Bring TikTok videos' },
                  ].map((sm) => (
                    <button
                      key={sm.name}
                      type="button"
                      disabled
                      title={`${sm.name} integration — Coming Soon`}
                      onClick={() => toast.info(`${sm.name} integration is coming soon!`)}
                      className={`group relative overflow-hidden rounded-xl p-3 text-left bg-gradient-to-br ${sm.color} text-white shadow-md opacity-80 cursor-not-allowed border border-white/10`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{sm.emoji}</span>
                        <span className="font-bold text-sm">{sm.name}</span>
                      </div>
                      <p className="text-[10px] mt-1 opacity-90 leading-tight">{sm.hint}</p>
                      <span className="absolute top-1 right-1 text-[8px] uppercase font-bold bg-black/40 px-1.5 py-0.5 rounded">
                        Soon
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Gallery Grid */}
              {salon?.photo_gallery && salon.photo_gallery.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {salon.photo_gallery.map((url, index) => {
                    const isVideo = typeof url === 'string' && (url.startsWith('data:video') || /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url));
                    return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative group aspect-square rounded-lg overflow-hidden border border-gold/20 shadow-lg hover:shadow-2xl transition-all bg-black"
                    >
                      {isVideo ? (
                        <video
                          src={url}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          controls
                          preload="metadata"
                        />
                      ) : (
                        <img 
                          src={url} 
                          alt={`Gallery ${index + 1}`} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      <button
                        onClick={async () => {
                          const updatedGallery = salon.photo_gallery.filter((_, i) => i !== index);
                          try {
                            await axios.put(
                              `${API}/salons/${salonId}`,
                              { photo_gallery: updatedGallery },
                              { headers: getAuthHeaders() }
                            );
                            setSalon({ ...salon, photo_gallery: updatedGallery });
                            toast.success('Item removed');
                          } catch (error) {
                            toast.error('Failed to remove item');
                          }
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg z-10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-2 left-2 right-2 text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {isVideo ? `Video ${index + 1}` : `Photo ${index + 1}`}
                      </div>
                    </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 bg-background/50 rounded-lg border border-dashed border-gold/30">
                  <FileText className="w-16 h-16 text-gold/50 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">No photos or videos yet</p>
                  <p className="text-sm text-muted-foreground">Upload media to showcase your salon!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <Analytics 
            salonId={salonId}
            getAuthHeaders={getAuthHeaders}
            isAdmin={checkIsAdmin()}
          />
        )}

        {activeTab === 'salon' && (
          <div className="space-y-4">
            {checkIsAdmin() && salonId && (
              <SubscriptionBadge salonId={salonId} />
            )}
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="w-full grid grid-cols-2 sm:grid-cols-5 h-auto bg-muted/40 p-1 rounded-xl">
                <TabsTrigger value="profile" className="flex items-center gap-2 data-[state=active]:bg-gold data-[state=active]:text-black py-2.5">
                  <User className="w-4 h-4" />
                  <span className="text-xs sm:text-sm font-semibold">Profile</span>
                </TabsTrigger>
                <TabsTrigger value="operations" className="flex items-center gap-2 data-[state=active]:bg-gold data-[state=active]:text-black py-2.5">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs sm:text-sm font-semibold">Operations</span>
                </TabsTrigger>
                {(checkIsAdmin() || checkIsBranchManager()) && (
                  <TabsTrigger value="branch" className="flex items-center gap-2 data-[state=active]:bg-gold data-[state=active]:text-black py-2.5">
                    <Building2 className="w-4 h-4" />
                    <span className="text-xs sm:text-sm font-semibold">Branch</span>
                  </TabsTrigger>
                )}
                <TabsTrigger value="notifications-cfg" className="flex items-center gap-2 data-[state=active]:bg-gold data-[state=active]:text-black py-2.5">
                  <Bell className="w-4 h-4" />
                  <span className="text-xs sm:text-sm font-semibold">Notification</span>
                </TabsTrigger>
                <TabsTrigger value="staff-settings-link" className="flex items-center gap-2 data-[state=active]:bg-gold data-[state=active]:text-black py-2.5" data-testid="settings-tab-staff-settings">
                  <Users className="w-4 h-4" />
                  <span className="text-xs sm:text-sm font-semibold">Staff</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="mt-4">
                <MyProfile
                  salon={salon}
                  onUpdate={(updatedSalon) => setSalon(updatedSalon)}
                  getAuthHeaders={getAuthHeaders}
                  onDeleteSalon={handleLogout}
                />
              </TabsContent>

              <TabsContent value="operations" className="mt-4">
                <OperationalHoursModule salonId={salonId} />
              </TabsContent>

              {(checkIsAdmin() || checkIsBranchManager()) && (
                <TabsContent value="branch" className="mt-4">
                  <BranchManagement salonId={salonId} />
                </TabsContent>
              )}

              <TabsContent value="notifications-cfg" className="mt-4">
                <SalonNotificationSettings
                  salonId={salonId}
                  getAuthHeaders={getAuthHeaders}
                />
              </TabsContent>

              <TabsContent value="staff-settings-link" className="mt-4">
                <div className="bg-card border border-border rounded-lg p-6 max-w-2xl">
                  <h3 className="text-lg font-semibold mb-1">Staff Settings</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Incentives, leave configuration, and attendance rules.
                  </p>
                  <Button onClick={() => navigate('/salon/staff/settings')} data-testid="settings-link-to-staff">
                    Open Staff Settings →
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {activeTab === 'branches' && salonId && checkIsAdmin() && (
          <BranchManagement salonId={salonId} />
        )}

        {activeTab === 'notifications' && salonId && (
          <SalonNotificationsPanel
            salonId={salonId}
            onCountUpdate={(count) => setUnreadNotifCount(count)}
            onNavigate={(tabId) => {
              setActiveTab(tabId);
              localStorage.setItem('salon_active_tab', tabId);
              setSearchParams({ tab: tabId });
            }}
          />
        )}
      </div>

      {/* Modify Booking Dialog */}
      <Dialog open={addServicesDialog} onOpenChange={setAddServicesDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg">Modify Booking</DialogTitle>
          </DialogHeader>
          
          {selectedToken && (
            <>
              {/* Compact Info Row */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg text-sm flex-shrink-0">
                <span className="font-bold text-gold">{selectedToken.token_number}</span>
                <span className="text-foreground font-semibold">{selectedToken.customer_name}</span>
                <span className="text-muted-foreground">•</span>
                <span className={selectedToken.payment_confirmed ? 'text-green-500 font-medium' : 'text-yellow-500 font-medium'}>
                  {selectedToken.payment_confirmed ? '✓ Paid' : '⏳ Unpaid'}
                </span>
              </div>

              {/* Horizontal Controls Row: Services label | Barber dropdown | Payment dropdown */}
              <div className="flex items-center gap-3 mt-2 flex-shrink-0">
                <div className="flex-shrink-0 text-sm font-semibold text-gold border border-gold/30 bg-gold/5 px-3 py-2 rounded-lg">
                  Services
                </div>
                
                {/* Barber Dropdown */}
                <select
                  value={selectedNewBarber || ''}
                  onChange={(e) => setSelectedNewBarber(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
                >
                  <option value="any">Any Available</option>
                  {barbers.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>

                {/* Payment Dropdown */}
                <select
                  value={confirmPaymentMode}
                  onChange={(e) => setConfirmPaymentMode(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
                >
                  <option value="not_confirmed">Not Confirmed</option>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="wallet">Wallet</option>
                  <option value="card">Card</option>
                </select>
              </div>

              {/* Service Search */}
              <div className="mt-2 flex-shrink-0">
                <Input
                  type="text"
                  placeholder="Search services..."
                  value={serviceSearchQuery}
                  onChange={(e) => setServiceSearchQuery(e.target.value)}
                  className="w-full h-9 text-sm"
                />
              </div>

              {/* Service List — only this part scrolls */}
              <div className="mt-2 space-y-1.5 overflow-y-auto flex-1 min-h-0 pr-1">
                {allServices
                  .filter(service => 
                    service.service_name.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
                    service.category?.toLowerCase().includes(serviceSearchQuery.toLowerCase())
                  )
                  .map(service => {
                    const isSelected = selectedNewServices.includes(service.id);
                    return (
                      <div 
                        key={service.id}
                        className={`flex items-center gap-3 px-3 py-2 border rounded-lg cursor-pointer transition-all text-sm ${
                          isSelected ? 'border-gold bg-gold/5' : 'border-border hover:border-gold/40'
                        }`}
                        onClick={() => toggleServiceSelection(service.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleServiceSelection(service.id)}
                        />
                        <span className="flex-1 font-medium">{service.service_name}</span>
                        <span className="text-xs text-muted-foreground">{service.category}</span>
                        <span className="font-bold text-gold">₹{service.base_price}</span>
                      </div>
                    );
                  })}
                {allServices.filter(service => 
                  service.service_name.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
                  service.category?.toLowerCase().includes(serviceSearchQuery.toLowerCase())
                ).length === 0 && (
                  <p className="text-center text-muted-foreground py-6 text-sm">No services found</p>
                )}
              </div>

              {/* Final Amount + Actions — always visible at bottom */}
              <div className="flex-shrink-0 pt-3 mt-2 border-t border-border bg-background">
                <div className="flex items-center gap-3">
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    Svc: <span className="font-semibold text-foreground">₹{allServices.filter(s => selectedNewServices.includes(s.id)).reduce((sum, s) => sum + (s.base_price || 0), 0)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-xs font-semibold whitespace-nowrap">Final ₹</Label>
                    <Input
                      type="number"
                      value={finalAmount}
                      onChange={(e) => setFinalAmount(e.target.value)}
                      className="w-24 h-8 text-sm font-bold text-gold"
                      min={0}
                    />
                  </div>
                  <Button
                    onClick={handleSaveAllModifications}
                    className="flex-1 bg-gold text-black hover:bg-gold/90 h-8 text-sm"
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    Save Changes
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Confirmation Dialog (when clicking Complete) */}
      <Dialog open={showPaymentConfirmDialog} onOpenChange={setShowPaymentConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CreditCard className="w-5 h-5 text-gold" />
              Confirm Payment to Complete
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {/* Total + Wallet Summary */}
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Bill total</span>
                <span className="text-lg font-bold">₹{completeTokenTotal.toFixed(0)}</span>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5" />
                  Wallet balance
                  {walletInfo?.membership_name && (
                    <span className="ml-1 text-xs px-1.5 py-0.5 rounded"
                      style={{
                        color: walletInfo.color || '#a855f7',
                        backgroundColor: (walletInfo.color || '#a855f7') + '1A',
                      }}>
                      {walletInfo.tier || 'Member'}
                    </span>
                  )}
                </span>
                <span className={`text-base font-bold ${(walletInfo?.wallet_balance || 0) >= completeTokenTotal ? 'text-green-600' : 'text-amber-600'}`}>
                  ₹{Number(walletInfo?.wallet_balance || 0).toFixed(0)}
                </span>
              </div>
              {(walletInfo?.wallet_balance || 0) > 0 && (walletInfo?.wallet_balance || 0) < completeTokenTotal && (
                <p className="text-xs text-amber-600 mt-1.5">
                  Insufficient for full wallet payment — remainder will be split into cash/UPI.
                </p>
              )}
              {!walletInfo?.has_membership && (
                <p className="text-xs text-muted-foreground mt-1.5">Customer has no active wallet.</p>
              )}
            </div>

            {/* Quick modes */}
            <div>
              <Label className="mb-2 block text-sm font-semibold">Quick select</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className={`h-9 text-xs ${completePaymentMode === 'cash' ? 'bg-gold/20 border-gold' : ''}`}
                  onClick={() => applyWalletSelection('cash')}
                >
                  <Banknote className="w-3.5 h-3.5 mr-1" />Cash
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={`h-9 text-xs ${completePaymentMode === 'upi' ? 'bg-gold/20 border-gold' : ''}`}
                  onClick={() => applyWalletSelection('upi')}
                >
                  <Smartphone className="w-3.5 h-3.5 mr-1" />UPI
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!walletInfo?.has_membership || (walletInfo?.wallet_balance || 0) <= 0}
                  className={`h-9 text-xs ${completeWalletAmount === completeTokenTotal ? 'bg-gold/20 border-gold' : ''}`}
                  onClick={() => applyWalletSelection('wallet_full')}
                >
                  <Wallet className="w-3.5 h-3.5 mr-1" />
                  {(walletInfo?.wallet_balance || 0) >= completeTokenTotal ? 'Full Wallet' : 'Wallet (partial)'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!walletInfo?.has_membership || (walletInfo?.wallet_balance || 0) <= 0}
                  className={`h-9 text-xs ${completePaymentMode === 'split' ? 'bg-gold/20 border-gold' : ''}`}
                  onClick={() => applyWalletSelection('wallet_partial')}
                >
                  Split Wallet + Cash
                </Button>
              </div>
            </div>

            {/* Manual split inputs */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[11px] text-muted-foreground">Wallet (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={completeWalletAmount}
                  max={walletInfo?.wallet_balance || 0}
                  disabled={!walletInfo?.has_membership || (walletInfo?.wallet_balance || 0) <= 0}
                  onChange={(e) => setCompleteWalletAmount(Number(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Cash (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={completeCashAmount}
                  onChange={(e) => setCompleteCashAmount(Number(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">UPI (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={completeUpiAmount}
                  onChange={(e) => setCompleteUpiAmount(Number(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Sum validation */}
            {(() => {
              const sum = Number(completeWalletAmount) + Number(completeCashAmount) + Number(completeUpiAmount);
              const diff = sum - completeTokenTotal;
              if (Math.abs(diff) < 1) {
                return (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Total matches ₹{completeTokenTotal.toFixed(0)}
                  </p>
                );
              }
              return (
                <p className="text-xs text-red-500">
                  {diff > 0 ? `Over by ₹${diff.toFixed(0)}` : `Short by ₹${Math.abs(diff).toFixed(0)}`}
                </p>
              );
            })()}

            <div className="flex gap-2 pt-3 border-t">
              <Button
                onClick={handleConfirmPaymentAndComplete}
                className="flex-1 bg-green-600 text-white hover:bg-green-700 h-9 text-sm"
              >
                <CheckCircle className="w-4 h-4 mr-1.5" />
                Confirm & Complete
              </Button>
              <Button variant="outline" onClick={() => setShowPaymentConfirmDialog(false)} className="h-9 text-sm">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Booking Dialog */}
      <Dialog open={showManualBookingDialog} onOpenChange={setShowManualBookingDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Manual Booking</DialogTitle>
          </DialogHeader>

          {/* Mode Selection */}
          <div className="flex gap-2 mb-4">
            <Button
              onClick={() => setBookingMode('existing')}
              className={bookingMode === 'existing' ? 'bg-gold text-black' : 'bg-muted'}
              variant={bookingMode === 'existing' ? 'default' : 'outline'}
            >
              Select Existing Customer
            </Button>
            <Button
              onClick={() => setBookingMode('adhoc')}
              className={bookingMode === 'adhoc' ? 'bg-gold text-black' : 'bg-muted'}
              variant={bookingMode === 'adhoc' ? 'default' : 'outline'}
            >
              Add New Customer
            </Button>
          </div>

          {/* Customer Selection (Existing Mode) */}
          {bookingMode === 'existing' && (
            <div className="mb-4">
              <Label>Select Customer</Label>
              {/* Search box */}
              <div className="relative mt-2 mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or mobile number..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Wallet balance chip for selected customer */}
              {selectedCustomer && (
                <div className="mb-2 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gold/15 text-gold border border-gold/30">
                    <Wallet className="w-3.5 h-3.5" />
                    Wallet: ₹{Number(selectedCustomer.wallet_balance || 0).toFixed(0)}
                  </span>
                  {selectedCustomer.membership_name && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground">
                      {selectedCustomer.membership_name}
                    </span>
                  )}
                </div>
              )}

              <div className="max-h-48 overflow-y-auto border rounded-lg">
                {customers.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">
                    No customers found. Switch to "Add New Customer" mode.
                  </p>
                ) : (
                  (() => {
                    const q = customerSearchQuery.trim().toLowerCase();
                    const filtered = q
                      ? customers.filter(c =>
                          (c.name || '').toLowerCase().includes(q) ||
                          (c.phone || '').toLowerCase().includes(q)
                        )
                      : customers;
                    if (filtered.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground p-4 text-center">
                          No customers match "{customerSearchQuery}".
                        </p>
                      );
                    }
                    return filtered.map((customer) => (
                      <div
                        key={customer.phone || customer.name}
                        onClick={() => handleCustomerSelection(customer)}
                        className={`p-3 cursor-pointer hover:bg-muted border-b transition-colors ${
                          manualBookingForm.customer_name === customer.name && manualBookingForm.phone === customer.phone
                            ? 'bg-gold/20 border-gold'
                            : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate">{customer.name}</p>
                            <p className="text-xs text-muted-foreground">{customer.phone || 'No phone'}</p>
                            {customer.gender && (
                              <span className="text-xs px-2 py-0.5 bg-muted rounded mt-1 inline-block">
                                {customer.gender}
                              </span>
                            )}
                          </div>
                          {(customer.wallet_balance ?? 0) > 0 && (
                            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gold/10 text-gold border border-gold/30">
                              <Wallet className="w-3 h-3" />
                              ₹{Number(customer.wallet_balance).toFixed(0)}
                            </span>
                          )}
                        </div>
                      </div>
                    ));
                  })()
                )}
              </div>
            </div>
          )}

          {/* Customer Details (Ad-hoc Mode) */}
          {bookingMode === 'adhoc' && (
            <div className="space-y-3 mb-4">
              <div>
                <Label htmlFor="adhoc-name">Customer Name *</Label>
                <Input
                  id="adhoc-name"
                  value={manualBookingForm.customer_name}
                  onChange={(e) => setManualBookingForm(prev => ({ ...prev, customer_name: e.target.value }))}
                  placeholder="Enter customer name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="adhoc-phone">Mobile Number (Optional)</Label>
                <Input
                  id="adhoc-phone"
                  value={manualBookingForm.phone}
                  onChange={(e) => setManualBookingForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="e.g., +919876543210"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Gender</Label>
                <div className="flex gap-2 mt-2">
                  {['Men', 'Women', 'Kids'].map((gender) => (
                    <button
                      key={gender}
                      onClick={() => setManualBookingForm(prev => ({ ...prev, gender }))}
                      className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${
                        manualBookingForm.gender === gender
                          ? 'bg-gold text-black border-gold font-semibold'
                          : 'bg-card border-border hover:bg-muted'
                      }`}
                    >
                      {gender}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Barber Selection */}
          <div className="mb-4">
            <Label>Select Barber</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                onClick={() => setManualBookingForm(prev => ({ ...prev, barber_id: 'any' }))}
                className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                  manualBookingForm.barber_id === 'any'
                    ? 'bg-gold text-black border-gold font-semibold'
                    : 'bg-card border-border hover:bg-muted'
                }`}
              >
                Any Available
              </button>
              {barbers.map((barber) => (
                <button
                  key={barber.id}
                  onClick={() => setManualBookingForm(prev => ({ ...prev, barber_id: barber.id }))}
                  className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                    manualBookingForm.barber_id === barber.id
                      ? 'bg-gold text-black border-gold font-semibold'
                      : 'bg-card border-border hover:bg-muted'
                  }`}
                >
                  {barber.name}
                </button>
              ))}
            </div>
          </div>

          {/* Service Selection */}
          <div className="mb-4">
            <Label>Select Services *</Label>
            {allServices.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">Loading services...</p>
            ) : (
              <>
                {/* Category Filter Chips */}
                {(() => {
                  const allCategories = ['All', ...Array.from(new Set(allServices.map(s => s.category || 'General')))];
                  return (
                    <div className="flex gap-2 overflow-x-auto py-2 mt-2 -mx-1 px-1 scrollbar-thin">
                      {allCategories.map(cat => {
                        const isActive = manualSelectedCategory === cat;
                        const count = cat === 'All'
                          ? allServices.length
                          : allServices.filter(s => (s.category || 'General') === cat).length;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setManualSelectedCategory(cat)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full border-2 text-xs font-medium transition-all whitespace-nowrap ${
                              isActive
                                ? 'bg-gold text-black border-gold shadow-md'
                                : 'bg-background text-foreground border-border hover:border-gold/50'
                            }`}
                          >
                            {cat} <span className={`ml-1 ${isActive ? 'text-black/60' : 'text-muted-foreground'}`}>({count})</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                <div className="max-h-64 overflow-y-auto border rounded-lg mt-2">
                  {(() => {
                    const filtered = manualSelectedCategory === 'All'
                      ? allServices
                      : allServices.filter(s => (s.category || 'General') === manualSelectedCategory);
                    if (filtered.length === 0) {
                      return <p className="text-sm text-muted-foreground p-4 text-center">No services in this category</p>;
                    }
                    return filtered.map((service) => {
                      const isSelected = manualBookingForm.selected_services.includes(service.id);
                      const price = service.base_price ?? service.price ?? 0;
                      const isOnwards = service.price_type === 'onwards';
                      return (
                        <div
                          key={service.id}
                          onClick={() => toggleManualServiceSelection(service.id)}
                          className={`p-3 cursor-pointer hover:bg-muted border-b transition-colors flex items-center justify-between ${
                            isSelected ? 'bg-gold/20 border-gold' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox checked={isSelected} />
                            <div>
                              <p className="font-semibold text-sm">{service.service_name || service.name}</p>
                              <p className="text-xs text-muted-foreground">{service.category || 'General'}</p>
                            </div>
                          </div>
                          <p className="font-bold text-gold whitespace-nowrap">
                            {isOnwards ? '₹' + price + '+' : '₹' + price}
                          </p>
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            )}
          </div>

          {/* Payment Mode */}
          <div className="mb-4">
            <Label>Payment Mode</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {['cash', 'upi', 'card', 'pay_later'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setManualBookingForm(prev => ({ ...prev, payment_mode: mode }))}
                  className={`px-3 py-2 rounded-lg border text-sm transition-colors capitalize ${
                    manualBookingForm.payment_mode === mode
                      ? 'bg-gold text-black border-gold font-semibold'
                      : 'bg-card border-border hover:bg-muted'
                  }`}
                >
                  {mode === 'pay_later' ? 'Pay Later at Salon' : mode.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={handleManualBooking}
              className="flex-1 bg-gold text-black hover:bg-gold/90"
              disabled={!manualBookingForm.customer_name || manualBookingForm.selected_services.length === 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Booking
            </Button>
            <Button
              onClick={() => setShowManualBookingDialog(false)}
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
    <SubscriptionPaywallModal />
    </SubscriptionProvider>
  );
}


// Salon Notifications Panel Component
function SalonNotificationsPanel({ salonId, onCountUpdate, onNavigate }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, [salonId]);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/notifications/salon/${salonId}`);
      setNotifications(response.data.notifications || []);
      const unread = (response.data.notifications || []).filter(n => !n.is_read).length;
      if (onCountUpdate) onCountUpdate(unread);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notifId) => {
    try {
      await axios.put(`${BACKEND_URL}/api/notifications/${notifId}/read`);
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllRead = async () => {
    try {
      await axios.put(`${BACKEND_URL}/api/notifications/salon/${salonId}/read-all`);
      fetchNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Determine which tab to navigate to based on notification type
  const getTargetTab = (type) => {
    switch (type) {
      case 'new_booking':
      case 'booking_cancelled':
      case 'booking_completed':
      case 'booking_rescheduled':
      case 'token_called':
        return 'home'; // queue / dashboard with active bookings
      case 'membership_pending':
      case 'membership_purchase':
      case 'membership_confirmed':
        return 'services'; // memberships live under services/offerings
      case 'review_added':
        return 'analytics'; // reviews/analytics tab
      default:
        return null;
    }
  };

  const handleNotifClick = (notif) => {
    if (!notif.is_read) markAsRead(notif.id);
    const target = getTargetTab(notif.type);
    if (target && onNavigate) onNavigate(target);
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'payment_confirmed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'membership_pending': return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'membership_confirmed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'new_booking': return <Calendar className="w-5 h-5 text-blue-500" />;
      case 'booking_cancelled': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'booking_completed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'review_added': return <TrendingUp className="w-5 h-5 text-gold" />;
      default: return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-gold/20 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-playfair font-bold text-foreground flex items-center gap-3">
          <Bell className="w-6 h-6 text-gold" />
          Notifications
        </h2>
        {notifications.some(n => !n.is_read) && (
          <Button variant="outline" size="sm" onClick={markAllRead} className="text-xs">
            Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
          <p className="text-muted-foreground">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotifClick(notif)}
              className={`p-4 rounded-lg border transition-all cursor-pointer ${
                notif.is_read
                  ? 'bg-muted/30 border-border hover:bg-muted/50'
                  : 'bg-gold/5 border-gold/30 hover:bg-gold/10'
              }`}
            >
              <div className="flex items-start gap-3">
                {getTypeIcon(notif.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className={`text-sm font-semibold ${notif.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {notif.title}
                    </h4>
                    {!notif.is_read && (
                      <span className="w-2 h-2 bg-gold rounded-full flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{notif.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {new Date(notif.created_at).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
