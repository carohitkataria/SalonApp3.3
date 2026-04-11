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
import StaffAccessManagement from '@/components/StaffAccessManagement';
import OfferingsModule from '@/components/OfferingsModule';
import MyProfile from '@/components/MyProfile';
import Analytics from '@/components/Analytics';
import { 
  Scissors, LogOut, ChevronRight, SkipForward, RotateCcw, XCircle,
  Clock, User, Phone, Bell, MapPin, Settings, CheckCircle, Calendar,
  Users, ArrowLeft, FileText, Download, Plus, X, TrendingUp, Menu,
  Shield, DollarSign, Database
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
  
  // Add Services Dialog State
  const [addServicesDialog, setAddServicesDialog] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
  const [allServices, setAllServices] = useState([]);
  const [selectedNewServices, setSelectedNewServices] = useState([]);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');

  useEffect(() => {
    const storedSalonId = localStorage.getItem('salon_id');
    const token = localStorage.getItem('salon_admin_token');
    
    if (!storedSalonId || !token) {
      navigate('/salon/login');
      return;
    }

    setSalonId(storedSalonId);
    fetchSalonData(storedSalonId);
    fetchBarbers(storedSalonId);
    fetchTokens(storedSalonId);

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
    const token = localStorage.getItem('salon_admin_token');
    return { Authorization: `Bearer ${token}` };
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
    if (!window.confirm('Mark this customer as completed? Invoice will be generated.')) return;
    
    try {
      await axios.post(`${API}/tokens/${tokenId}/complete`, {}, { headers: getAuthHeaders() });
      toast.success('Token marked as completed');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete token');
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

  const handleLogout = () => {
    localStorage.removeItem('salon_admin_token');
    localStorage.removeItem('salon_user_auth');
    localStorage.removeItem('salon_id');
    navigate('/salon/login');
  };

  // Define menu items with role-based visibility
  const menuItems = [
    { id: 'queue', label: 'Token Queue', icon: Calendar, show: true },
    { id: 'staff', label: 'Staff Management', icon: Users, show: true },
    { id: 'staff-access', label: 'Manage Staff Access', icon: Shield, show: isAdmin() },
    { id: 'services', label: 'Services & Offerings', icon: Scissors, show: true },
    { id: 'financials', label: 'Financials', icon: DollarSign, show: isAdmin() },
    { id: 'customer-master', label: 'Customer Master', icon: Database, show: true },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp, show: isAdmin() || hasPermission('can_access_analytics') },
    { id: 'gallery', label: 'Gallery', icon: FileText, show: true },
    { id: 'salon', label: 'Salon Settings', icon: Settings, show: isAdmin() || hasPermission('can_edit_salon') }
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
        <div className="backdrop-blur-xl bg-background/80 border-b border-gold/20 p-4 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Hamburger Menu Button */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 hover:bg-gold/10 rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6 text-gold" />
              </button>
              
              <div className="p-3 bg-gradient-to-br from-gold/20 to-gold/5 rounded-xl border border-gold/30">
                <Scissors className="w-8 h-8 text-gold" />
              </div>
              <div>
                <h1 className="text-2xl font-playfair font-bold text-foreground">Salon Dashboard</h1>
                <p className="text-sm text-gold">{salon?.salon_name || 'Loading...'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <ThemeToggle />
              <Button 
                onClick={handleLogout} 
                variant="outline" 
                size="sm"
                className="border-gold/30 hover:bg-gold/10"
              >
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </Button>
            </div>
          </div>
        </div>

        {/* Hamburger Menu Sidebar */}
        <AnimatePresence>
          {menuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 bg-black/50 z-40"
              />
              
              {/* Sidebar */}
              <motion.div
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: 'spring', damping: 20 }}
                className="fixed left-0 top-0 bottom-0 w-72 bg-card border-r border-border shadow-2xl z-50 overflow-y-auto"
              >
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Menu</h2>
                    <button
                      onClick={() => setMenuOpen(false)}
                      className="p-2 hover:bg-muted rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
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
                          setMenuOpen(false);
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
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="max-w-7xl mx-auto p-4">
        {activeTab === 'queue' && (
          <div className="space-y-6">
            {/* Barber Filter */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedBarber('all')}
                className={`px-4 py-2 rounded-lg whitespace-nowrap ${
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
                  className={`px-4 py-2 rounded-lg whitespace-nowrap ${
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
            <div className="flex justify-center">
              <Button
                onClick={() => handleCallNext(selectedBarber === 'all' ? null : selectedBarber)}
                className="bg-gold text-black hover:bg-gold/90 px-8 py-3 text-lg"
                disabled={!tokens.some(t => t.status === 'waiting')}
              >
                <ChevronRight className="mr-2 w-5 h-5" /> 
                Call Next Customer {selectedBarber !== 'all' && `(${barbers.find(b => b.id === selectedBarber)?.name})`}
              </Button>
            </div>

            {/* Status Filters */}
            <div className="flex space-x-2">
              {['all', 'waiting', 'called', 'completed', 'skipped', 'cancelled'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded uppercase text-sm font-bold ${
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
                  className={`bg-card/90 backdrop-blur-sm border-2 ${getStatusColor(token.status)} rounded-xl p-4 hover:shadow-xl transition-all`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="text-3xl font-bebas text-gold min-w-[60px] text-center bg-gold/10 rounded-lg p-2 border border-gold/30">
                        {token.token_number || 'TBA'}
                      </div>
                      <div className="flex-1">
                        <p className="text-foreground font-bold flex items-center space-x-2">
                          <User className="w-3 h-3" />
                          <span>{token.customer_name}</span>
                        </p>
                        <p className="text-muted-foreground text-xs flex items-center space-x-2">
                          <Phone className="w-3 h-3" />
                          <a href={`tel:${token.phone}`} className="hover:text-gold">
                            {token.phone}
                          </a>
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {token.barber_name} • {token.shift || token.time_slot} • ₹{token.total_amount}
                        </p>
                        <p className="text-muted-foreground text-xs flex items-center space-x-1 mt-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(token.date).toLocaleDateString('en-IN')} at {token.created_at ? new Date(token.created_at).toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'}) : token.shift || token.time_slot}</span>
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className={`flex items-center space-x-1 px-3 py-1 rounded-full ${
                        token.status === 'called' ? 'bg-blue-500/20 border border-blue-500' :
                        token.status === 'completed' ? 'bg-green-500/20 border border-green-500' :
                        token.status === 'skipped' ? 'bg-red-500/20 border border-red-500' :
                        'bg-muted border border-border'
                      }`}>
                        {getStatusIcon(token.status)}
                        <span className="text-xs uppercase font-bold">
                          {token.status === 'called' ? 'Called' : 
                           token.status === 'waiting' ? 'Waiting' :
                           token.status === 'completed' ? 'Completed' :
                           token.status === 'skipped' ? 'Skipped' : token.status}
                        </span>
                        {token.recall_count > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({token.recall_count}x)
                          </span>
                        )}
                      </div>
                      
                      {/* Waiting Status Actions */}
                      {token.status === 'waiting' && (
                        <>
                          <Button 
                            size="sm" 
                            onClick={() => handleCallToken(token.id)} 
                            className="bg-blue-600 hover:bg-blue-700"
                            title="Call this customer now"
                          >
                            <ChevronRight className="w-3 h-3 mr-1" />
                            Call
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleOpenAddServices(token)} 
                            className="bg-purple-600 hover:bg-purple-700"
                            title="Add more services"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Services
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleSendNotification(token.id)} 
                            className="bg-gray-600 hover:bg-gray-700"
                            title="Send notification"
                          >
                            <Bell className="w-3 h-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleSkipToken(token.id)} 
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                            title="Skip this customer"
                          >
                            <SkipForward className="w-3 h-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleCancelToken(token.id)} 
                            variant="outline"
                            className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                            title="Cancel token"
                          >
                            <XCircle className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                      
                      {/* Called Status Actions - MAIN CONTROLS */}
                      {token.status === 'called' && (
                        <div className="flex items-center space-x-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleCompleteToken(token.id)} 
                            className="bg-green-600 hover:bg-green-700 text-white"
                            title="Mark as completed"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Complete
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleOpenAddServices(token)} 
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                            title="Add more services"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Services
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleRecallToken(token.id)} 
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            title="Re-call customer"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Re-call
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleSkipToken(token.id)} 
                            className="bg-red-600 hover:bg-red-700 text-white"
                            title="Skip customer"
                          >
                            <SkipForward className="w-3 h-3 mr-1" />
                            Skip
                          </Button>
                        </div>
                      )}
                      
                      {/* Skipped Status Actions */}
                      {token.status === 'skipped' && (
                        <Button 
                          size="sm" 
                          onClick={() => handleRecallToken(token.id)} 
                          className="bg-blue-600 hover:bg-blue-700"
                          title="Recall this customer"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Recall
                        </Button>
                      )}
                      
                      {/* Completed Status Actions - View Invoice */}
                      {token.status === 'completed' && token.invoice_id && (
                        <div className="flex items-center space-x-2">
                          <Button 
                            size="sm" 
                            onClick={() => window.open(`${API}/invoices/${token.invoice_id}/view`, '_blank')} 
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                            title="View invoice"
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            View Invoice
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = `${API}/invoices/${token.invoice_id}/download`;
                              link.download = `invoice_${token.token_number}.pdf`;
                              link.click();
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            title="Download invoice"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      )}
                    </div>
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

        {activeTab === 'staff-access' && salonId && (
          <StaffAccessManagement />
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
      </div>

      {/* Manage Services Dialog */}
      <Dialog open={addServicesDialog} onOpenChange={setAddServicesDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Services</DialogTitle>
          </DialogHeader>
          
          {selectedToken && (
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <p className="text-sm"><strong>Customer:</strong> {selectedToken.customer_name}</p>
              <p className="text-sm"><strong>Token:</strong> {selectedToken.token_number}</p>
              <p className="text-sm"><strong>Current Amount:</strong> ₹{selectedToken.total_amount}</p>
            </div>
          )}

          {/* Action Buttons at Top */}
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

          {/* Search Bar */}
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
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
