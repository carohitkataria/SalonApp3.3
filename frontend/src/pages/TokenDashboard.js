import React from 'react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/contexts/WebSocketContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Clock, Scissors, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function TokenDashboard() {
  const { salonId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const branchId = searchParams.get('branch') || '';
  const { user, isUserLoggedIn } = useAuth();
  const { socket } = useWebSocket();
  
  const [salon, setSalon] = useState(null);
  const [tokenStatus, setTokenStatus] = useState(null);
  const [selectedShift, setSelectedShift] = useState('Morning');
  const [loading, setLoading] = useState(true);
  const [shiftList, setShiftList] = useState([]); // dynamic shifts from salon operational hours
  // Today / Tomorrow toggle — reliable IST via Intl API
  const getISTDateOffset = (daysOffset = 0) => {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
    const today = fmt.format(new Date());
    if (daysOffset === 0) return today;
    const [y, m, d] = today.split('-').map(Number);
    const shifted = new Date(Date.UTC(y, m - 1, d + daysOffset));
    return fmt.format(shifted);
  };
  const [dateMode, setDateMode] = useState('today');
  const date = dateMode === 'today' ? getISTDateOffset(0) : getISTDateOffset(1);

  const shifts = ['Morning', 'Noon', 'Evening'];

  useEffect(() => {
    if (!isUserLoggedIn) {
      navigate('/user/login');
      return;
    }

    fetchSalonData();
    fetchTokenStatus();

    // Set current shift based on time
    const currentHour = new Date().getHours();
    if (currentHour >= 7 && currentHour < 11) {
      setSelectedShift('Morning');
    } else if (currentHour >= 11 && currentHour < 16) {
      setSelectedShift('Noon');
    } else {
      setSelectedShift('Evening');
    }
  }, [isUserLoggedIn, salonId]);

  useEffect(() => {
    if (selectedShift) {
      fetchTokenStatus();
    }
  }, [selectedShift, dateMode]);

  // Fetch salon-specific shift windows for the selected date
  useEffect(() => {
    const fetchShiftWindows = async () => {
      try {
        const res = await axios.get(`${API}/salons/${salonId}/shift-windows`, {
          params: { date }
        });
        setShiftList(res.data.shifts || []);
      } catch (e) {
        console.error('Error fetching shift windows:', e);
      }
    };
    if (salonId) fetchShiftWindows();
  }, [salonId, dateMode]);

  useEffect(() => {
    if (socket) {
      socket.on('token_called', handleTokenUpdate);
      socket.on('token_completed', handleTokenUpdate);
      socket.on('token_created', handleTokenUpdate);

      return () => {
        socket.off('token_called', handleTokenUpdate);
        socket.off('token_completed', handleTokenUpdate);
        socket.off('token_created', handleTokenUpdate);
      };
    }
  }, [socket]);

  const handleTokenUpdate = () => {
    fetchTokenStatus();
  };

  const fetchSalonData = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}`);
      setSalon(response.data);
    } catch (error) {
      console.error('Error fetching salon:', error);
      toast.error('Failed to load salon data');
    }
  };

  const fetchTokenStatus = async () => {
    try {
      setLoading(true);
      const branchSuffix = branchId ? `&branch_id=${branchId}` : '';
      const response = await axios.get(`${API}/salons/${salonId}/token-status?shift=${selectedShift}&date=${date}${branchSuffix}`);
      setTokenStatus(response.data);
    } catch (error) {
      console.error('Error fetching token status:', error);
      toast.error('Failed to load token status');
    } finally {
      setLoading(false);
    }
  };

  const getShiftTime = (shift) => {
    // Prefer dynamic shift windows from salon operational hours
    const dyn = shiftList.find(s => s.id === shift);
    if (dyn && dyn.time) return dyn.time;
    const times = {
      'Morning': '7 AM - 11 AM',
      'Noon': '11 AM - 4 PM',
      'Evening': '4 PM - 9 PM'
    };
    return times[shift] || '';
  };

  const getQueueStatusColor = (status) => {
    switch (status) {
      case 'available':
        return 'text-green-500';
      case 'busy':
        return 'text-yellow-500';
      case 'offline':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getQueueStatusIcon = (status) => {
    switch (status) {
      case 'available':
        return '🟢';
      case 'busy':
        return '🟡';
      case 'offline':
        return '🔴';
      default:
        return '⚪';
    }
  };

  if (loading && !tokenStatus) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Scissors className="w-16 h-16 text-gold animate-spin mx-auto mb-4" />
          <p className="text-foreground">Loading token status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/book/${salonId}${branchId ? `?branch=${branchId}` : ''}`)}
              className="border-gold text-gold hover:bg-gold hover:text-black"
            >
              Book Now
            </Button>
          </div>

          <div className="text-center mb-4">
            <h1 className="text-2xl font-playfair font-bold text-foreground">Live Queue Status</h1>
            {salon && <p className="text-sm text-muted-foreground">{salon.salon_name}</p>}
          </div>

          {/* Today / Tomorrow Toggle */}
          <div className="flex justify-center mb-3">
            <div className="inline-flex rounded-lg border border-border bg-background p-1">
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
          </div>

          {/* Shift Selector */}
          <div className="flex gap-2">
            {shifts.map(shift => (
              <button
                key={shift}
                onClick={() => setSelectedShift(shift)}
                className={`flex-1 py-2 px-4 rounded-lg border transition-all ${
                  selectedShift === shift
                    ? 'bg-gold text-black border-gold'
                    : 'bg-background text-foreground border-border hover:border-gold'
                }`}
              >
                <div className="text-sm font-bold">{shift}</div>
                <div className="text-xs">{getShiftTime(shift)}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Overall Salon Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-gold/20 to-gold/5 border-2 border-gold rounded-xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground flex items-center">
              <Users className="w-6 h-6 mr-2 text-gold" />
              Overall Salon Queue
            </h2>
            <div className="text-sm text-muted-foreground">
              {selectedShift} Shift
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card/50 backdrop-blur rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">Current Token</p>
              <div className="text-4xl font-bebas text-gold">
                {tokenStatus?.overall?.current_token || '--'}
              </div>
            </div>
            <div className="bg-card/50 backdrop-blur rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">Waiting Tokens</p>
              <div className="text-4xl font-bebas text-foreground">
                {tokenStatus?.overall?.waiting_count || 0}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Per-Barber Status */}
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center">
            <Scissors className="w-6 h-6 mr-2 text-gold" />
            Barber-wise Status
          </h2>

          <div className="space-y-3">
            {tokenStatus?.barbers?.map((barber, index) => (
              <motion.div
                key={barber.barber_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-card border border-border rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground">{barber.barber_name}</h3>
                      <span className={`text-xs ${getQueueStatusColor(barber.queue_status)}`}>
                        {getQueueStatusIcon(barber.queue_status)}
                      </span>
                    </div>
                    <div className="flex gap-3 mt-1">
                      {barber.category && (
                        <span className="text-xs text-muted-foreground">
                          {barber.category}
                        </span>
                      )}
                      {barber.specialization && (
                        <span className="text-xs text-gold">
                          • {barber.specialization}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Current</p>
                    <div className="text-2xl font-bebas text-gold">
                      {barber.current_token || '--'}
                    </div>
                  </div>
                  <div className="bg-background/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Waiting</p>
                    <div className="text-2xl font-bebas text-foreground">
                      {barber.waiting_count}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {(!tokenStatus?.barbers || tokenStatus.barbers.length === 0) && (
            <div className="text-center py-12">
              <Scissors className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
              <p className="text-muted-foreground">No barbers available at the moment</p>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-gold mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground mb-1">Live Updates</p>
              <p className="text-xs text-muted-foreground">
                This dashboard updates in real-time as tokens are called and completed. 
                Average service time is 15-20 minutes per customer.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <Button
          onClick={() => navigate(`/book/${salonId}`)}
          className="w-full bg-gold text-black hover:bg-gold/90 py-6 text-lg"
        >
          Book Your Appointment
        </Button>
      </div>
    </div>
  );
}
