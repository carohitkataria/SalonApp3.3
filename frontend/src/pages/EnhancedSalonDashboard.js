import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import ThemeToggle from '@/components/ThemeToggle';
import BarberManagement from '@/components/BarberManagement';
import CustomerMaster from '@/components/CustomerMaster';
import OfferingsModule from '@/components/OfferingsModule';
import MyProfile from '@/components/MyProfile';
import Analytics from '@/components/Analytics';
import { getSession, clearSession } from '@/utils/sessionManager';
import { 
  Scissors, LogOut, ChevronRight, SkipForward, RotateCcw, XCircle,
  Clock, User, Phone, Bell, MapPin, Settings, CheckCircle, Calendar,
  Users, ArrowLeft, FileText, Download, Plus, X, TrendingUp, Menu,
  Shield, DollarSign, Database, Pin, PinOff, Edit, CreditCard, Banknote, Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function EnhancedSalonDashboard() {
  const navigate = useNavigate();
  const { subscribe, unsubscribe } = useWebSocket();
  const { salonUser, isAdmin, hasPermission } = useAuth();
  
  const [activeTab, setActiveTab] = useState('queue');
  const [salonId, setSalonId] = useState(null);
  const [salon, setSalon] = useState(null);
  const [barbers, setBarbers] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [selectedBarber, setSelectedBarber] = useState('all');
  const [filter, setFilter] = useState('all');
  const [date] = useState(new Date().toISOString().split('T')[0]);
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
  const [modifyTab, setModifyTab] = useState('services'); // 'services' | 'barber' | 'payment'
  const [selectedNewBarber, setSelectedNewBarber] = useState(null);
  const [confirmPaymentMode, setConfirmPaymentMode] = useState('cash');
  
  // Payment Confirmation Dialog (for Complete action)
  const [showPaymentConfirmDialog, setShowPaymentConfirmDialog] = useState(false);
  const [pendingCompleteTokenId, setPendingCompleteTokenId] = useState(null);
  const [completePaymentMode, setCompletePaymentMode] = useState('cash');
  
  // Notifications
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  
  // Manual Booking Dialog State
  const [showManualBookingDialog, setShowManualBookingDialog] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [bookingMode, setBookingMode] = useState('existing'); // 'existing' or 'adhoc'
  const [manualBookingForm, setManualBookingForm] = useState({
    customer_name: '',
    phone: '',
    gender: 'Men',
    barber_id: 'any',
    selected_services: [],
    payment_mode: 'cash'
  });

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

    // WebSocket subscriptions
    const handleUpdate = () => {
      if (storedSalonId) {
        fetchTokens(storedSalonId);
      }
    };

    subscribe('token_created', handleUpdate);
    subscribe('token_updated', handleUpdate);
    subscribe('token_called', handleUpdate);
    subscribe('token_completed', handleUpdate);
    subscribe('token_skipped', handleUpdate);
    subscribe('token_recalled', handleUpdate);

    return () => {
      unsubscribe('token_created', handleUpdate);
      unsubscribe('token_updated', handleUpdate);
      unsubscribe('token_called', handleUpdate);
      unsubscribe('token_completed', handleUpdate);
      unsubscribe('token_skipped', handleUpdate);
      unsubscribe('token_recalled', handleUpdate);
    };
  }, [filter, selectedBarber]);

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
      const response = await axios.get(`${API}/salons/${id}/barbers`);
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
        if (filter !== 'all') {
          url += `&status=${filter}`;
        }
      } else {
        url = `${API}/salons/${id}/barbers/${selectedBarber}/queue?date=${date}`;
        if (filter !== 'all') {
          url += `&status=${filter}`;
        }
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

  const handleCallToken = async (tokenId) => {
    try {
      await axios.post(`${API}/tokens/${tokenId}/call`, {}, { headers: getAuthHeaders() });
      toast.success('Token called');
    } catch (error) {
      toast.error('Failed to call token');
    }
  };

  const handleSkipToken = async (tokenId) => {
    if (!window.confirm('Skip this token? This action is final and cannot be undone.')) return;
    
    try {
      await axios.post(`${API}/tokens/${tokenId}/skip`, {}, { headers: getAuthHeaders() });
      toast.success('Token skipped');
    } catch (error) {
      toast.error('Failed to skip token');
    }
  };

  const handleRecallToken = async (tokenId) => {
    try {
      await axios.post(`${API}/tokens/${tokenId}/recall`, {}, { headers: getAuthHeaders() });
      toast.success('Token recalled');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to recall token');
    }
  };

  const handleCompleteToken = async (tokenId) => {
    // Find the token to check payment status
    const token = tokens.find(t => t.id === tokenId);
    if (token && !token.payment_confirmed) {
      // Show payment confirmation dialog first
      setPendingCompleteTokenId(tokenId);
      setCompletePaymentMode(token.payment_mode || 'cash');
      setShowPaymentConfirmDialog(true);
      return;
    }
    
    if (!window.confirm('Mark this customer as completed? Invoice will be generated.')) return;
    
    try {
      await axios.post(`${API}/tokens/${tokenId}/complete`, {}, { headers: getAuthHeaders() });
      toast.success('Token marked as completed');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete token');
    }
  };

  const handleConfirmPaymentAndComplete = async () => {
    if (!pendingCompleteTokenId) return;
    
    try {
      // First confirm payment
      await axios.post(
        `${API}/tokens/${pendingCompleteTokenId}/confirm-payment`,
        { payment_mode: completePaymentMode },
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

  const fetchNotificationCount = async (sid) => {
    try {
      const response = await axios.get(`${API}/notifications/salon/${sid}/unread-count`);
      setUnreadNotifCount(response.data.unread_count || 0);
    } catch (error) {
      console.error('Error fetching notification count:', error);
    }
  };

  const handleCancelToken = async (tokenId) => {
    if (!window.confirm('Cancel this token?')) return;
    
    try {
      await axios.post(`${API}/tokens/${tokenId}/cancel`, {}, { headers: getAuthHeaders() });
      toast.success('Token cancelled');
    } catch (error) {
      toast.error('Failed to cancel token');
    }
  };

  const handleSendNotification = async (tokenId) => {
    try {
      await axios.post(`${API}/tokens/${tokenId}/notify`, {}, { headers: getAuthHeaders() });
      toast.success('Notification sent (mock)');
    } catch (error) {
      toast.error('Failed to send notification');
    }
  };

  const fetchAllServices = async () => {
    try {
      const response = await axios.get(`${API}/services`);
      setAllServices(response.data);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Failed to load services');
    }
  };

  const handleOpenAddServices = async (token) => {
    setSelectedToken(token);
    setSelectedNewServices(token.selected_services || []); // Pre-select existing services
    setSelectedNewBarber(token.barber_id);
    setConfirmPaymentMode(token.payment_mode || 'cash');
    setModifyTab('services');
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
    setSelectedNewServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
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
          payment_mode: manualBookingForm.payment_mode
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
    clearSession();  // Clear all session data using session manager
    navigate('/salon/login');
    toast.success('Logged out successfully');
  };

  // Check if user is admin (supports both new multi-user and legacy login)
  const checkIsAdmin = () => {
    // If using multi-user auth
    if (salonUser) {
      return salonUser.role === 'admin';
    }
    // If using legacy salon login, treat as admin
    const legacyToken = localStorage.getItem('salon_admin_token');
    return !!legacyToken;
  };

  const checkHasPermission = (permission) => {
    // Legacy login has all permissions
    const legacyToken = localStorage.getItem('salon_admin_token');
    if (legacyToken && !salonUser) return true;
    
    // Multi-user auth
    if (salonUser?.role === 'admin') return true;
    return salonUser?.permissions?.[permission] || false;
  };

  // Define menu items with role-based visibility
  const menuItems = [
    { id: 'queue', label: 'Token Queue', icon: Calendar, show: true },
    { id: 'staff', label: 'Staff Management', icon: Users, show: checkIsAdmin() }, // Admin only
    { id: 'services', label: 'Services & Offerings', icon: Scissors, show: true },
    { id: 'financials', label: 'Financials', icon: DollarSign, show: checkIsAdmin() },
    { id: 'customer-master', label: 'Customer Master', icon: Database, show: true },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp, show: checkIsAdmin() || checkHasPermission('can_access_analytics') },
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
              
              <div className="hidden sm:block p-3 bg-gradient-to-br from-gold/20 to-gold/5 rounded-xl border border-gold/30 flex-shrink-0">
                <Scissors className="w-8 h-8 text-gold" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg md:text-2xl font-playfair font-bold text-foreground truncate">Salon Dashboard</h1>
                <p className="text-xs md:text-sm text-gold truncate">{salon?.salon_name || 'Loading...'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0">
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
                        onClick={() => {
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
        {activeTab === 'queue' && (
          <div className="space-y-6">
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
            <div className="flex flex-col md:flex-row gap-2 md:gap-3">
              <Button
                onClick={() => handleCallNext(selectedBarber === 'all' ? null : selectedBarber)}
                className="bg-gold text-black hover:bg-gold/90 px-4 md:px-8 py-3 text-sm md:text-lg flex-1"
                disabled={!tokens.some(t => t.status === 'waiting')}
              >
                <ChevronRight className="mr-1 md:mr-2 w-4 md:w-5 h-4 md:h-5" /> 
                Call Next {selectedBarber !== 'all' && `(${barbers.find(b => b.id === selectedBarber)?.name})`}
              </Button>
              <Button
                onClick={handleOpenManualBooking}
                variant="outline"
                className="border-gold text-gold hover:bg-gold/10 px-4 md:px-6 py-3 text-sm md:text-lg"
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
                        {token.payment_confirmed && <span className="text-green-500 ml-1">• ✓ Paid</span>}
                        {!token.payment_confirmed && token.status !== 'completed' && <span className="text-yellow-500 ml-1">• Payment Pending</span>}
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
                        <Button 
                          size="sm" 
                          onClick={() => handleRecallToken(token.id)} 
                          className="bg-blue-600 hover:bg-blue-700 h-8 text-xs px-2.5"
                          title="Recall this customer"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Recall
                        </Button>
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
          <BarberManagement salonId={salonId} getAuthHeaders={getAuthHeaders} />
        )}

        {activeTab === 'customer-master' && (
          <CustomerMaster salonId={salonId} getAuthHeaders={getAuthHeaders} />
        )}

        {activeTab === 'financials' && (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <DollarSign className="w-16 h-16 text-gold mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-2">Financials</h3>
            <p className="text-muted-foreground">
              Financial reports, revenue tracking, and expense management coming soon.
            </p>
          </div>
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
            token={localStorage.getItem('salon_admin_token')}
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
                <Label className="mb-2 block font-semibold">Add Photos</Label>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={async (e) => {
                    const files = Array.from(e.target.files);
                    if (files.length === 0) return;
                    
                    const newPhotos = [];
                    for (const file of files) {
                      if (file.size > 2 * 1024 * 1024) {
                        toast.error(`${file.name} is too large (max 2MB)`);
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
                        toast.success(`${newPhotos.length} photo(s) added!`);
                      } catch (error) {
                        toast.error('Failed to upload photos');
                      }
                    }
                  }}
                  className="mb-2"
                />
                <p className="text-xs text-muted-foreground">Upload multiple photos (max 2MB each)</p>
              </div>

              {/* Gallery Grid */}
              {salon?.photo_gallery && salon.photo_gallery.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {salon.photo_gallery.map((url, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative group aspect-square rounded-lg overflow-hidden border border-gold/20 shadow-lg hover:shadow-2xl transition-all"
                    >
                      <img 
                        src={url} 
                        alt={`Gallery ${index + 1}`} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
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
                            toast.success('Photo removed');
                          } catch (error) {
                            toast.error('Failed to remove photo');
                          }
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-2 left-2 right-2 text-white text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                        Photo {index + 1}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-background/50 rounded-lg border border-dashed border-gold/30">
                  <FileText className="w-16 h-16 text-gold/50 mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">No photos yet</p>
                  <p className="text-sm text-muted-foreground">Upload photos to showcase your salon!</p>
                </div>
              )}

              {/* Sample Salon Images */}
              {(!salon?.photo_gallery || salon.photo_gallery.length === 0) && (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Inspiration Gallery</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      'https://images.pexels.com/photos/3993293/pexels-photo-3993293.jpeg?auto=compress&cs=tinysrgb&w=400',
                      'https://images.pexels.com/photos/853427/pexels-photo-853427.jpeg?auto=compress&cs=tinysrgb&w=400',
                      'https://images.pexels.com/photos/9146943/pexels-photo-9146943.jpeg?auto=compress&cs=tinysrgb&w=400',
                      'https://images.pexels.com/photos/3998403/pexels-photo-3998403.jpeg?auto=compress&cs=tinysrgb&w=400',
                      'https://images.unsplash.com/photo-1600948836101-f9ffda59d250?w=400&q=80',
                      'https://images.pexels.com/photos/3993295/pexels-photo-3993295.jpeg?auto=compress&cs=tinysrgb&w=400'
                    ].map((url, i) => (
                      <div key={i} className="aspect-square rounded-lg overflow-hidden opacity-50 hover:opacity-100 transition-opacity">
                        <img src={url} alt={`Sample ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-4">Sample professional salon photos for inspiration</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <Analytics 
            salonId={salonId}
            getAuthHeaders={getAuthHeaders}
          />
        )}

        {activeTab === 'salon' && (
          <MyProfile 
            salon={salon}
            onUpdate={(updatedSalon) => setSalon(updatedSalon)}
            getAuthHeaders={getAuthHeaders}
            onDeleteSalon={handleLogout}
          />
        )}

        {activeTab === 'notifications' && salonId && (
          <SalonNotificationsPanel salonId={salonId} onCountUpdate={(count) => setUnreadNotifCount(count)} />
        )}
      </div>

      {/* Modify Booking Dialog */}
      <Dialog open={addServicesDialog} onOpenChange={setAddServicesDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modify Booking</DialogTitle>
          </DialogHeader>
          
          {selectedToken && (
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <p className="text-sm"><strong>Customer:</strong> {selectedToken.customer_name}</p>
              <p className="text-sm"><strong>Token:</strong> {selectedToken.token_number}</p>
              <p className="text-sm"><strong>Barber:</strong> {selectedToken.barber_name}</p>
              <p className="text-sm"><strong>Amount:</strong> ₹{selectedToken.total_amount}</p>
              <p className="text-sm"><strong>Payment:</strong> {selectedToken.payment_mode || 'N/A'} {selectedToken.payment_confirmed ? '✓ Confirmed' : '⏳ Pending'}</p>
            </div>
          )}

          {/* Tab Selector */}
          <div className="flex gap-1 mb-4 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setModifyTab('services')}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                modifyTab === 'services' ? 'bg-gold text-black shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Services
            </button>
            <button
              onClick={() => setModifyTab('barber')}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                modifyTab === 'barber' ? 'bg-gold text-black shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Change Barber
            </button>
            <button
              onClick={() => setModifyTab('payment')}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                modifyTab === 'payment' ? 'bg-gold text-black shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Confirm Payment
            </button>
          </div>

          {/* Services Tab */}
          {modifyTab === 'services' && (
            <>
              <div className="flex justify-between items-center space-x-2 mb-4 pb-4 border-b">
                <Button variant="outline" onClick={() => setAddServicesDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateServices}
                  className="bg-gold text-black hover:bg-gold/90"
                  disabled={selectedNewServices.length === 0}
                >
                  Update Services ({selectedNewServices.length} selected)
                </Button>
              </div>

              <div className="mb-4">
                <Input
                  type="text"
                  placeholder="Search services..."
                  value={serviceSearchQuery}
                  onChange={(e) => setServiceSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  <strong>Select/Deselect services:</strong> Check to add, Uncheck to remove
                </p>
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
                      className="flex items-center space-x-3 p-3 border rounded-lg hover:border-gold cursor-pointer transition-all"
                      onClick={() => toggleServiceSelection(service.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleServiceSelection(service.id)}
                      />
                      <div className="flex-1">
                        <p className="font-semibold">{service.service_name}</p>
                        <p className="text-xs text-muted-foreground">{service.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gold">₹{service.base_price}</p>
                      </div>
                    </div>
                  );
                })}
                {allServices.filter(service => 
                  service.service_name.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
                  service.category?.toLowerCase().includes(serviceSearchQuery.toLowerCase())
                ).length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No services found</p>
                )}
              </div>
            </>
          )}

          {/* Change Barber Tab */}
          {modifyTab === 'barber' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select a new barber. The total amount will be recalculated based on the new barber's pricing.
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedNewBarber('any')}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    selectedNewBarber === 'any' ? 'border-gold bg-gold/10' : 'border-border hover:border-gold/50'
                  }`}
                >
                  <p className="font-semibold">Any Available</p>
                  <p className="text-xs text-muted-foreground">Assign to next available barber</p>
                </button>
                {barbers.map(barber => (
                  <button
                    key={barber.id}
                    onClick={() => setSelectedNewBarber(barber.id)}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      selectedNewBarber === barber.id ? 'border-gold bg-gold/10' : 'border-border hover:border-gold/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{barber.name}</p>
                        <p className="text-xs text-muted-foreground">{barber.specialization || 'General'}</p>
                      </div>
                      {barber.rating && (
                        <span className="text-sm text-gold">★ {barber.rating}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={handleChangeBarber}
                  className="flex-1 bg-gold text-black hover:bg-gold/90"
                  disabled={!selectedNewBarber || selectedNewBarber === selectedToken?.barber_id}
                >
                  Change Barber
                </Button>
                <Button variant="outline" onClick={() => setAddServicesDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Confirm Payment Tab */}
          {modifyTab === 'payment' && (
            <div className="space-y-4">
              {selectedToken?.payment_confirmed ? (
                <div className="p-6 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-green-600">Payment Already Confirmed</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Mode: {selectedToken.payment_mode?.toUpperCase()} • Amount: ₹{selectedToken.total_amount}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Confirm payment received from the customer. You can change the payment mode if needed.
                  </p>
                  <div>
                    <Label className="mb-3 block font-semibold">Payment Mode</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { value: 'cash', label: 'Cash', icon: Banknote },
                        { value: 'upi', label: 'UPI', icon: Smartphone },
                        { value: 'card', label: 'Card', icon: CreditCard },
                        { value: 'pay_later', label: 'Pay Later', icon: Clock }
                      ].map(mode => {
                        const Icon = mode.icon;
                        return (
                          <button
                            key={mode.value}
                            onClick={() => setConfirmPaymentMode(mode.value)}
                            className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                              confirmPaymentMode === mode.value
                                ? 'border-gold bg-gold/10'
                                : 'border-border hover:border-gold/50'
                            }`}
                          >
                            <Icon className={`w-6 h-6 ${confirmPaymentMode === mode.value ? 'text-gold' : ''}`} />
                            <span className="text-xs font-medium">{mode.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span>Amount:</span>
                      <span className="font-bold text-gold">₹{selectedToken?.total_amount}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span>Mode:</span>
                      <span className="font-semibold capitalize">{confirmPaymentMode}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      onClick={handleConfirmPaymentOnly}
                      className="flex-1 bg-green-600 text-white hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirm Payment
                    </Button>
                    <Button variant="outline" onClick={() => setAddServicesDialog(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Confirmation Dialog (when clicking Complete) */}
      <Dialog open={showPaymentConfirmDialog} onOpenChange={setShowPaymentConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gold" />
              Confirm Payment to Complete
            </DialogTitle>
          </DialogHeader>
          
          <p className="text-sm text-muted-foreground">
            Payment must be confirmed before marking the service as complete. Please confirm the payment mode and proceed.
          </p>
          
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-3 block font-semibold">Payment Mode</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'cash', label: 'Cash', icon: Banknote },
                  { value: 'upi', label: 'UPI', icon: Smartphone },
                  { value: 'card', label: 'Card', icon: CreditCard },
                  { value: 'pay_later', label: 'Pay Later', icon: Clock }
                ].map(mode => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.value}
                      onClick={() => setCompletePaymentMode(mode.value)}
                      className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                        completePaymentMode === mode.value
                          ? 'border-gold bg-gold/10'
                          : 'border-border hover:border-gold/50'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${completePaymentMode === mode.value ? 'text-gold' : ''}`} />
                      <span className="text-xs font-medium">{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="flex gap-2 pt-4 border-t">
              <Button
                onClick={handleConfirmPaymentAndComplete}
                className="flex-1 bg-green-600 text-white hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Confirm & Complete
              </Button>
              <Button variant="outline" onClick={() => setShowPaymentConfirmDialog(false)}>
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
              <div className="max-h-48 overflow-y-auto border rounded-lg mt-2">
                {customers.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">
                    No customers found. Switch to "Add New Customer" mode.
                  </p>
                ) : (
                  customers.map((customer) => (
                    <div
                      key={customer.phone || customer.name}
                      onClick={() => handleCustomerSelection(customer)}
                      className={`p-3 cursor-pointer hover:bg-muted border-b transition-colors ${
                        manualBookingForm.customer_name === customer.name ? 'bg-gold/20 border-gold' : ''
                      }`}
                    >
                      <p className="font-semibold">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">{customer.phone}</p>
                      {customer.gender && (
                        <span className="text-xs px-2 py-0.5 bg-muted rounded mt-1 inline-block">
                          {customer.gender}
                        </span>
                      )}
                    </div>
                  ))
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
            <div className="max-h-64 overflow-y-auto border rounded-lg mt-2">
              {allServices.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">Loading services...</p>
              ) : (
                allServices.map((service) => {
                  const isSelected = manualBookingForm.selected_services.includes(service.id);
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
                          <p className="font-semibold text-sm">{service.service_name}</p>
                          <p className="text-xs text-muted-foreground">{service.category}</p>
                        </div>
                      </div>
                      <p className="font-bold text-gold">₹{service.base_price}</p>
                    </div>
                  );
                })
              )}
            </div>
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
  );
}


// Salon Notifications Panel Component
function SalonNotificationsPanel({ salonId, onCountUpdate }) {
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

  const getTypeIcon = (type) => {
    switch (type) {
      case 'payment_confirmed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'membership_pending': return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'membership_confirmed': return <CheckCircle className="w-5 h-5 text-green-500" />;
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
              onClick={() => !notif.is_read && markAsRead(notif.id)}
              className={`p-4 rounded-lg border transition-all cursor-pointer ${
                notif.is_read
                  ? 'bg-muted/30 border-border'
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
