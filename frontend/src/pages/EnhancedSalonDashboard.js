import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '@/contexts/WebSocketContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import ThemeToggle from '@/components/ThemeToggle';
import BarberManagement from '@/components/BarberManagement';
import OfferingsModule from '@/components/OfferingsModule';
import MyProfile from '@/components/MyProfile';
import { 
  Scissors, LogOut, ChevronRight, SkipForward, RotateCcw, XCircle,
  Clock, User, Phone, Bell, MapPin, Settings, CheckCircle, Calendar,
  Users, ArrowLeft, FileText, Download, Plus
} from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function EnhancedSalonDashboard() {
  const navigate = useNavigate();
  const { subscribe, unsubscribe } = useWebSocket();
  
  const [activeTab, setActiveTab] = useState('queue');
  const [salonId, setSalonId] = useState(null);
  const [salon, setSalon] = useState(null);
  const [barbers, setBarbers] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [selectedBarber, setSelectedBarber] = useState('all');
  const [filter, setFilter] = useState('all');
  const [date] = useState(new Date().toISOString().split('T')[0]);
  
  // Add Services Dialog State
  const [addServicesDialog, setAddServicesDialog] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
  const [allServices, setAllServices] = useState([]);
  const [selectedNewServices, setSelectedNewServices] = useState([]);

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
    setSelectedNewServices([]);
    setServiceSearchQuery('');
    await fetchAllServices();
    setAddServicesDialog(true);
  };

  const handleAddServices = async () => {
    if (selectedNewServices.length === 0) {
      toast.error('Please select at least one service');
      return;
    }

    try {
      const response = await axios.put(
        `${API}/tokens/${selectedToken.id}/add-services`,
        { service_ids: selectedNewServices },
        { headers: getAuthHeaders() }
      );
      
      toast.success('Services added successfully');
      setAddServicesDialog(false);
      fetchTokens(salonId);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add services');
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
    localStorage.removeItem('salon_id');
    navigate('/salon/login');
  };

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Scissors className="w-8 h-8 text-gold" />
            <div>
              <h1 className="text-xl font-playfair font-bold text-foreground">Salon Dashboard</h1>
              <p className="text-xs text-muted-foreground">{salon?.salon_name || 'Loading...'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <ThemeToggle />
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto flex overflow-x-auto">
          {[
            { id: 'queue', label: 'Token Queue', icon: Calendar },
            { id: 'barbers', label: 'Barbers', icon: Users },
            { id: 'services', label: 'Offerings', icon: Scissors },
            { id: 'salon', label: 'My Profile', icon: MapPin }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`tab-${tab.id}`}
                className={`flex items-center space-x-2 px-6 py-4 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-gold text-gold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-bold text-sm uppercase tracking-wider">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

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
              {tokens.map((token) => (
                <motion.div
                  key={token.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`bg-card border p-4 rounded-lg ${getStatusColor(token.status)}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="text-3xl font-bebas text-gold w-12">
                        {token.token_number > 0 ? token.token_number.toString().padStart(2, '0') : 'TBA'}
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
                          {token.barber_name} • {token.time_slot} • ₹{token.total_amount}
                        </p>
                        <p className="text-muted-foreground text-xs flex items-center space-x-1 mt-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(token.date).toLocaleDateString('en-IN')} at {token.created_at ? new Date(token.created_at).toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'}) : token.time_slot}</span>
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

        {activeTab === 'barbers' && salonId && (
          <BarberManagement salonId={salonId} getAuthHeaders={getAuthHeaders} />
        )}

        {activeTab === 'services' && (
          <OfferingsModule 
            salonId={salonId} 
            token={localStorage.getItem('salon_admin_token')}
          />
        )}

        {activeTab === 'salon' && (
          <MyProfile 
            salon={salon}
            onUpdate={(updatedSalon) => setSalon(updatedSalon)}
            getAuthHeaders={getAuthHeaders}
          />
        )}
      </div>

      {/* Add Services Dialog */}
      <Dialog open={addServicesDialog} onOpenChange={setAddServicesDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Services to Booking</DialogTitle>
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
              onClick={handleAddServices}
              className="bg-gold text-black hover:bg-gold/90"
              disabled={selectedNewServices.length === 0}
            >
              Add {selectedNewServices.length} Service{selectedNewServices.length !== 1 ? 's' : ''}
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
            <p className="text-sm text-muted-foreground">Select services to add:</p>
            {allServices
              .filter(service => 
                service.service_name.toLowerCase().includes(serviceSearchQuery.toLowerCase()) ||
                service.category?.toLowerCase().includes(serviceSearchQuery.toLowerCase())
              )
              .map(service => {
              const alreadySelected = selectedToken?.selected_services?.includes(service.id);
              return (
                <div 
                  key={service.id}
                  className={`flex items-center space-x-3 p-3 border rounded-lg ${
                    alreadySelected ? 'opacity-50 bg-muted' : 'hover:border-gold cursor-pointer'
                  }`}
                  onClick={() => !alreadySelected && toggleServiceSelection(service.id)}
                >
                  <Checkbox
                    checked={selectedNewServices.includes(service.id)}
                    disabled={alreadySelected}
                    onCheckedChange={() => toggleServiceSelection(service.id)}
                  />
                  <div className="flex-1">
                    <p className="font-semibold">{service.service_name}</p>
                    <p className="text-xs text-muted-foreground">{service.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gold">₹{service.base_price}</p>
                  </div>
                  {alreadySelected && (
                    <span className="text-xs text-muted-foreground">(Already added)</span>
                  )}
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
  );
}
