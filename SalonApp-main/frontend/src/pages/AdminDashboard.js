import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/contexts/WebSocketContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  Scissors, LogOut, ChevronRight, SkipForward, RotateCcw, CheckCircle, XCircle, 
  Clock, User, Phone, Bell, QrCode, MapPin, Edit, Trash2, Plus, Users
} from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { admin, isAdminLoggedIn, logoutAdmin, getAdminHeaders } = useAuth();
  const { subscribe, unsubscribe } = useWebSocket();
  
  const [activeTab, setActiveTab] = useState('tokens'); // tokens, barbers, salon, qr
  const [tokens, setTokens] = useState([]);
  const [currentTokens, setCurrentTokens] = useState([]);
  const [filter, setFilter] = useState('all');
  const [date] = useState(new Date().toISOString().split('T')[0]);
  
  // Barber Management
  const [barbers, setBarbers] = useState([]);
  const [editingBarber, setEditingBarber] = useState(null);
  const [barberForm, setBarberForm] = useState({ name: '', experience: 0, category: 'normal', mobile: '' });
  
  // Salon Location
  const [salonLocation, setSalonLocation] = useState(null);
  const [locationForm, setLocationForm] = useState({ salon_name: '', address: '', latitude: 0, longitude: 0 });
  
  // QR Code
  const [qrCode, setQrCode] = useState(null);

  useEffect(() => {
    if (!isAdminLoggedIn) {
      navigate('/admin/login');
      return;
    }
    
    fetchTokens();
    fetchCurrentTokens();
    fetchBarbers();
    fetchSalonLocation();

    // WebSocket subscriptions
    const handleUpdate = () => {
      fetchTokens();
      fetchCurrentTokens();
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
  }, [isAdminLoggedIn, filter]);

  const fetchTokens = async () => {
    try {
      const query = filter === 'all' ? `date=${date}` : `date=${date}&status=${filter}`;
      const response = await axios.get(`${API}/tokens?${query}`);
      setTokens(response.data);
    } catch (error) {
      console.error('Error fetching tokens:', error);
    }
  };

  const fetchCurrentTokens = async () => {
    try {
      const response = await axios.get(`${API}/tokens/current/${date}`);
      setCurrentTokens(response.data);
    } catch (error) {
      console.error('Error fetching current tokens:', error);
    }
  };

  const fetchBarbers = async () => {
    try {
      const response = await axios.get(`${API}/barbers`);
      setBarbers(response.data);
    } catch (error) {
      console.error('Error fetching barbers:', error);
    }
  };

  const fetchSalonLocation = async () => {
    try {
      const response = await axios.get(`${API}/salon/location`);
      setSalonLocation(response.data);
      setLocationForm(response.data);
    } catch (error) {
      console.error('Error fetching salon location:', error);
    }
  };

  const fetchQRCode = async () => {
    try {
      const response = await axios.get(`${API}/qr-code`, { headers: getAdminHeaders() });
      setQrCode(response.data);
    } catch (error) {
      console.error('Error fetching QR code:', error);
      toast.error('Failed to generate QR code');
    }
  };

  // Token Management
  const handleCallNext = async () => {
    try {
      await axios.post(`${API}/staff/next-token/${date}`, {}, { headers: getAdminHeaders() });
      toast.success('Next token called');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to call next token');
    }
  };

  const handleSkipToken = async (tokenId) => {
    try {
      await axios.post(`${API}/staff/skip-token/${tokenId}`, {}, { headers: getAdminHeaders() });
      toast.success('Token skipped (final)');
    } catch (error) {
      toast.error('Failed to skip token');
    }
  };

  const handleRecallToken = async (tokenId) => {
    try {
      await axios.post(`${API}/staff/recall-token/${tokenId}`, {}, { headers: getAdminHeaders() });
      toast.success('Token recalled');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to recall token');
    }
  };

  const handleCompleteToken = async (tokenId) => {
    try {
      await axios.post(`${API}/staff/complete-token/${tokenId}`, {}, { headers: getAdminHeaders() });
      toast.success('Token completed');
    } catch (error) {
      toast.error('Failed to complete token');
    }
  };

  const handleCallCustomer = (phone) => {
    toast.info(`Mock: Calling ${phone}`, { description: 'Click-to-call feature' });
  };

  const handleSendNotification = (tokenNumber) => {
    toast.success(`Mock: Notification sent to Token #${tokenNumber}`, { 
      description: 'WhatsApp/SMS notification triggered' 
    });
  };

  // Barber Management
  const handleSaveBarber = async () => {
    try {
      if (editingBarber) {
        await axios.put(`${API}/barbers/${editingBarber.id}`, barberForm, { headers: getAdminHeaders() });
        toast.success('Barber updated');
      } else {
        await axios.post(`${API}/barbers`, barberForm, { headers: getAdminHeaders() });
        toast.success('Barber added');
      }
      setBarberForm({ name: '', experience: 0, category: 'normal', mobile: '' });
      setEditingBarber(null);
      fetchBarbers();
    } catch (error) {
      toast.error('Failed to save barber');
    }
  };

  const handleDeleteBarber = async (barberId) => {
    if (!window.confirm('Are you sure you want to delete this barber?')) return;
    try {
      await axios.delete(`${API}/barbers/${barberId}`, { headers: getAdminHeaders() });
      toast.success('Barber deleted');
      fetchBarbers();
    } catch (error) {
      toast.error('Failed to delete barber');
    }
  };

  // Salon Location
  const handleSaveLocation = async () => {
    try {
      await axios.put(`${API}/salon/location`, locationForm, { headers: getAdminHeaders() });
      toast.success('Salon location updated');
      fetchSalonLocation();
    } catch (error) {
      toast.error('Failed to update location');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'waiting': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'in_progress': return <ChevronRight className="w-4 h-4 text-blue-500" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'skipped': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'waiting': return 'border-yellow-500/30 bg-yellow-500/5';
      case 'in_progress': return 'border-blue-500/30 bg-blue-500/5';
      case 'completed': return 'border-green-500/30 bg-green-500/5';
      case 'skipped': return 'border-red-500/30 bg-red-500/5';
      default: return 'border-white/10';
    }
  };

  const renderTokensTab = () => (
    <div className="space-y-6">
      {/* Current Tokens */}
      {currentTokens.length > 0 && (
        <div className="glassmorphism rounded-xl p-6">
          <h3 className="text-gold uppercase tracking-widest text-sm font-bold mb-4">Currently Serving ({currentTokens.length}/4)</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {currentTokens.map((token) => (
              <div key={token.id} className="bg-obsidian/50 p-4 border border-gold/30">
                <div className="text-4xl font-bebas text-gold mb-2">
                  {token.token_number.toString().padStart(2, '0')}
                </div>
                <p className="text-white font-bold text-sm">{token.customer_name}</p>
                <p className="text-zinc-400 text-xs">{token.barber_name}</p>
                <Button
                  size="sm"
                  onClick={() => handleCompleteToken(token.id)}
                  className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="w-3 h-3 mr-1" /> Complete
                </Button>
              </div>
            ))}
          </div>
          <Button
            data-testid="call-next-button"
            onClick={handleCallNext}
            disabled={currentTokens.length >= 4}
            className="w-full bg-gold text-black hover:bg-gold-hover uppercase tracking-widest font-bold"
          >
            <ChevronRight className="mr-2" /> Call Next Token
          </Button>
        </div>
      )}

      {currentTokens.length === 0 && (
        <div className="glassmorphism rounded-xl p-6 text-center">
          <p className="text-zinc-400 mb-4">No tokens currently being served</p>
          <Button
            data-testid="call-first-token"
            onClick={handleCallNext}
            className="bg-gold text-black hover:bg-gold-hover uppercase tracking-widest font-bold"
          >
            <ChevronRight className="mr-2" /> Call First Token
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex space-x-2">
        {['all', 'waiting', 'completed'].map((f) => (
          <button
            key={f}
            data-testid={`filter-${f}`}
            onClick={() => setFilter(f)}
            className={`px-6 py-2 uppercase tracking-widest text-sm font-bold transition-all ${
              filter === f ? 'bg-gold text-black' : 'bg-charcoal text-white border border-white/10 hover:border-white/30'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Token List */}
      <div className="space-y-3">
        {tokens.map((token) => (
          <motion.div
            key={token.id}
            data-testid={`token-row-${token.token_number}`}
            className={`bg-charcoal border p-4 ${getStatusColor(token.status)}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-3xl font-bebas text-gold w-12">
                  {token.token_number.toString().padStart(2, '0')}
                </div>
                <div>
                  <p className="text-white font-bold flex items-center space-x-2">
                    <User className="w-3 h-3" />
                    <span>{token.customer_name}</span>
                  </p>
                  <p className="text-zinc-400 text-xs flex items-center space-x-2">
                    <Phone className="w-3 h-3" />
                    <a href={`tel:${token.phone}`} onClick={() => handleCallCustomer(token.phone)} className="hover:text-gold">
                      {token.phone}
                    </a>
                  </p>
                  <p className="text-zinc-500 text-xs">{token.barber_name} • {token.time_slot}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 px-2 py-1 bg-white/5 border border-white/10">
                  {getStatusIcon(token.status)}
                  <span className="text-white text-xs uppercase">{token.status.replace('_', ' ')}</span>
                </div>
                
                {token.status === 'waiting' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleSendNotification(token.token_number)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Bell className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSkipToken(token.id)}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <SkipForward className="w-3 h-3" />
                    </Button>
                  </>
                )}
                
                {token.status === 'completed' && (
                  <Button
                    size="sm"
                    onClick={() => handleRecallToken(token.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        ))}

        {tokens.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500">No tokens found</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderBarbersTab = () => (
    <div className="space-y-6">
      {/* Add/Edit Barber Form */}
      <div className="glassmorphism rounded-xl p-6">
        <h3 className="text-gold uppercase tracking-widest text-sm font-bold mb-4">
          {editingBarber ? 'Edit Barber' : 'Add New Barber'}
        </h3>
        <div className="space-y-4">
          <div>
            <Label className="text-white text-sm">Name</Label>
            <Input
              value={barberForm.name}
              onChange={(e) => setBarberForm({...barberForm, name: e.target.value})}
              className="bg-charcoal border-white/20 text-white"
              placeholder="Barber name"
            />
          </div>
          <div>
            <Label className="text-white text-sm">Experience (years)</Label>
            <Input
              type="number"
              value={barberForm.experience}
              onChange={(e) => setBarberForm({...barberForm, experience: parseInt(e.target.value) || 0})}
              className="bg-charcoal border-white/20 text-white"
            />
          </div>
          <div>
            <Label className="text-white text-sm">Category</Label>
            <select
              value={barberForm.category}
              onChange={(e) => setBarberForm({...barberForm, category: e.target.value})}
              className="w-full bg-charcoal border border-white/20 text-white p-2"
            >
              <option value="normal">Normal</option>
              <option value="star">⭐ Star</option>
              <option value="master">👑 Master</option>
            </select>
          </div>
          <div>
            <Label className="text-white text-sm">Mobile (+91XXXXXXXXXX)</Label>
            <Input
              value={barberForm.mobile}
              onChange={(e) => setBarberForm({...barberForm, mobile: e.target.value})}
              className="bg-charcoal border-white/20 text-white"
              placeholder="+919876543210"
            />
          </div>
          <div className="flex space-x-2">
            <Button onClick={handleSaveBarber} className="flex-1 bg-gold text-black hover:bg-gold-hover">
              <Plus className="w-4 h-4 mr-2" /> {editingBarber ? 'Update' : 'Add'} Barber
            </Button>
            {editingBarber && (
              <Button onClick={() => { setEditingBarber(null); setBarberForm({ name: '', experience: 0, category: 'normal', mobile: '' }); }} variant="outline" className="border-white/20 text-white">
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Barber List */}
      <div className="space-y-3">
        {barbers.map((barber) => (
          <div key={barber.id} className="bg-charcoal border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-bold">{barber.name}</h4>
                <p className="text-zinc-400 text-sm">{barber.experience} years • {barber.category}</p>
                <p className="text-zinc-500 text-xs">{barber.mobile}</p>
              </div>
              <div className="flex space-x-2">
                <Button size="sm" onClick={() => { setEditingBarber(barber); setBarberForm(barber); }} className="bg-blue-600 hover:bg-blue-700">
                  <Edit className="w-3 h-3" />
                </Button>
                <Button size="sm" onClick={() => handleDeleteBarber(barber.id)} className="bg-red-600 hover:bg-red-700">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSalonTab = () => (
    <div className="space-y-6">
      <div className="glassmorphism rounded-xl p-6">
        <h3 className="text-gold uppercase tracking-widest text-sm font-bold mb-4 flex items-center">
          <MapPin className="w-4 h-4 mr-2" /> Salon Location
        </h3>
        <div className="space-y-4">
          <div>
            <Label className="text-white text-sm">Salon Name</Label>
            <Input
              value={locationForm.salon_name}
              onChange={(e) => setLocationForm({...locationForm, salon_name: e.target.value})}
              className="bg-charcoal border-white/20 text-white"
            />
          </div>
          <div>
            <Label className="text-white text-sm">Address</Label>
            <Input
              value={locationForm.address}
              onChange={(e) => setLocationForm({...locationForm, address: e.target.value})}
              className="bg-charcoal border-white/20 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-white text-sm">Latitude</Label>
              <Input
                type="number"
                step="0.0001"
                value={locationForm.latitude}
                onChange={(e) => setLocationForm({...locationForm, latitude: parseFloat(e.target.value) || 0})}
                className="bg-charcoal border-white/20 text-white"
              />
            </div>
            <div>
              <Label className="text-white text-sm">Longitude</Label>
              <Input
                type="number"
                step="0.0001"
                value={locationForm.longitude}
                onChange={(e) => setLocationForm({...locationForm, longitude: parseFloat(e.target.value) || 0})}
                className="bg-charcoal border-white/20 text-white"
              />
            </div>
          </div>
          <Button onClick={handleSaveLocation} className="w-full bg-gold text-black hover:bg-gold-hover">
            Update Location
          </Button>
        </div>
      </div>
    </div>
  );

  const renderQRTab = () => (
    <div className="space-y-6">
      <div className="glassmorphism rounded-xl p-6">
        <h3 className="text-gold uppercase tracking-widest text-sm font-bold mb-4 flex items-center">
          <QrCode className="w-4 h-4 mr-2" /> Walk-in QR Code
        </h3>
        <p className="text-zinc-400 text-sm mb-4">Generate QR code for instant walk-in bookings. Auto-fills current date and time.</p>
        
        {!qrCode ? (
          <Button onClick={fetchQRCode} className="w-full bg-gold text-black hover:bg-gold-hover">
            Generate QR Code
          </Button>
        ) : (
          <div>
            <div className="bg-white p-8 rounded-xl mb-4">
              <img src={qrCode.qr_code} alt="Walk-in QR Code" className="w-full" />
            </div>
            <p className="text-zinc-400 text-xs mb-4 break-all">{qrCode.booking_url}</p>
            <div className="flex space-x-2">
              <Button onClick={() => window.print()} className="flex-1 bg-white text-black hover:bg-gray-200">
                Print QR Code
              </Button>
              <Button onClick={fetchQRCode} variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10">
                Regenerate
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (!isAdminLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-obsidian">
      <div className="grain-overlay" />
      
      <div className="relative z-10">
        {/* Header */}
        <div className="bg-charcoal border-b border-white/10 px-4 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Scissors className="w-8 h-8 text-gold" />
              <div>
                <h1 className="text-xl font-playfair font-bold text-white">Salon Dashboard</h1>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">The Looks Unisex Salon</p>
              </div>
            </div>
            <Button onClick={logoutAdmin} variant="outline" className="border-white/20 text-white hover:bg-white/10">
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-charcoal border-b border-white/10">
          <div className="max-w-7xl mx-auto flex overflow-x-auto">
            {[
              { id: 'tokens', label: 'Token Queue', icon: Users },
              { id: 'barbers', label: 'Barbers', icon: Scissors },
              { id: 'salon', label: 'Salon Info', icon: MapPin },
              { id: 'qr', label: 'QR Code', icon: QrCode }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-6 py-4 border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-gold text-gold'
                      : 'border-transparent text-zinc-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-bold text-sm uppercase tracking-wider">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 py-6">
          {activeTab === 'tokens' && renderTokensTab()}
          {activeTab === 'barbers' && renderBarbersTab()}
          {activeTab === 'salon' && renderSalonTab()}
          {activeTab === 'qr' && renderQRTab()}
        </div>
      </div>
    </div>
  );
}