import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  Scissors, Calendar, User, MapPin, Star, Clock, 
  ArrowLeft, Users, TrendingUp, CheckCircle, AlertCircle, XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SalonMainPage() {
  const { salonId } = useParams();
  const navigate = useNavigate();
  const { isUserLoggedIn, user } = useAuth();
  
  const [salon, setSalon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveStatus, setLiveStatus] = useState(null);
  const [userBookings, setUserBookings] = useState([]);

  useEffect(() => {
    if (!isUserLoggedIn) {
      navigate('/user/login', { state: { from: `/salon/${salonId}` } });
      return;
    }
    fetchSalonData();
    fetchLiveStatus();
    fetchUserBookings();
    
    const interval = setInterval(() => {
      fetchLiveStatus();
      fetchUserBookings();
    }, 30000);
    return () => clearInterval(interval);
  }, [isUserLoggedIn, salonId]);

  const fetchSalonData = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}`);
      setSalon(response.data);
    } catch (error) {
      console.error('Error fetching salon:', error);
      toast.error('Failed to load salon information');
      navigate('/salons');
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveStatus = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/live-status`);
      setLiveStatus(response.data);
    } catch (error) {
      console.error('Error fetching live status:', error);
    }
  };

  const fetchUserBookings = async () => {
    if (!user?.id) return;
    try {
      const response = await axios.get(`${API}/user/${user.id}/history`);
      // Filter for active bookings at this salon
      const activeStatuses = ['waiting', 'called', 'in_progress'];
      const todayBookings = response.data.filter(b => 
        b.salon_id === salonId && activeStatuses.includes(b.status)
      );
      setUserBookings(todayBookings);
    } catch (error) {
      console.error('Error fetching user bookings:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'waiting':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'called':
        return <AlertCircle className="w-5 h-5 text-blue-500 animate-pulse" />;
      case 'in_progress':
        return <Scissors className="w-5 h-5 text-green-500 animate-spin" />;
      default:
        return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
  };

  const getStatusMessage = (booking) => {
    switch (booking.status) {
      case 'waiting':
        return `You are #${booking.token_number} in queue`;
      case 'called':
        return `Your turn! Please proceed to ${booking.barber_name}`;
      case 'in_progress':
        return `In progress with ${booking.barber_name}`;
      default:
        return 'Booking active';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Scissors className="w-16 h-16 text-gold animate-spin mx-auto mb-4" />
          <p className="text-foreground">Loading salon...</p>
        </div>
      </div>
    );
  }

  if (!salon) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground">Salon not found</p>
          <Button onClick={() => navigate('/salons')} className="mt-4">
            Back to Salons
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Compact Header */}
      <div className="bg-card border-b border-border sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center p-3 gap-3">
          <button 
            onClick={() => navigate('/salons')}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          
          <div className="flex items-center gap-2 flex-1">
            {salon.logo_url ? (
              <img 
                src={salon.logo_url} 
                alt={salon.salon_name}
                className="w-10 h-10 rounded-full object-cover border-2 border-gold"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
                <Scissors className="w-5 h-5 text-gold" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-playfair font-bold text-foreground truncate">
                {salon.salon_name}
              </h1>
              <div className="flex items-center text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="truncate">{salon.address}</span>
              </div>
            </div>
          </div>

          <Button 
            onClick={() => navigate(`/book/${salonId}`)}
            className="bg-gold text-black hover:bg-gold/90"
            size="sm"
          >
            <Calendar className="w-4 h-4 mr-1" />
            Book
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        
        {/* Active Booking Status - Shows instead of Welcome Banner */}
        {userBookings.length > 0 ? (
          <div className="space-y-3">
            {userBookings.map((booking) => (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl border-2 ${
                  booking.status === 'called' 
                    ? 'bg-blue-500/10 border-blue-500 animate-pulse' 
                    : booking.status === 'in_progress'
                    ? 'bg-green-500/10 border-green-500'
                    : 'bg-gold/10 border-gold/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(booking.status)}
                    <div>
                      <p className="font-bold text-foreground">{getStatusMessage(booking)}</p>
                      <p className="text-sm text-muted-foreground">
                        Token: #{booking.token_number} • {booking.shift}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bebas text-gold">#{booking.token_number}</p>
                  </div>
                </div>
                {booking.status === 'waiting' && liveStatus?.overall?.current_token && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-sm text-muted-foreground">
                      Currently serving: <span className="font-bold text-foreground">#{liveStatus.overall.current_token}</span>
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          /* Welcome Banner - Only when no active booking */
          <div className="bg-gradient-to-r from-gold/20 to-gold/5 rounded-2xl p-6 border border-gold/30">
            <h2 className="text-2xl font-playfair font-bold text-foreground mb-2">
              Welcome to {salon.salon_name}
            </h2>
            <p className="text-muted-foreground mb-4">
              {salon.description || 'Your trusted destination for premium grooming services.'}
            </p>
            <Button 
              onClick={() => navigate(`/book/${salonId}`)}
              className="bg-gold text-black hover:bg-gold/90"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Book Your Appointment
            </Button>
          </div>
        )}

        {/* Live Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Queue</p>
                <p className="text-2xl font-bold text-foreground">
                  {liveStatus?.overall?.waiting_count || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Serving</p>
                <p className="text-2xl font-bold text-foreground">
                  {liveStatus?.overall?.current_token || '-'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gold/10 rounded-lg">
                <Star className="w-5 h-5 text-gold" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rating</p>
                <p className="text-2xl font-bold text-foreground">
                  {salon.rating || '4.5'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Barbers</p>
                <p className="text-2xl font-bold text-foreground">
                  {liveStatus?.barbers?.length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Active Barbers */}
        {liveStatus?.barbers && liveStatus.barbers.length > 0 && (
          <div className="bg-card rounded-xl p-5 border border-border">
            <h3 className="text-lg font-bold text-foreground mb-4">Active Barbers</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {liveStatus.barbers.map((barber) => (
                <div 
                  key={barber.barber_id}
                  className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border"
                >
                  <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{barber.barber_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {barber.waiting_count} waiting • {barber.total_tokens_today || 0} served
                    </p>
                  </div>
                  {barber.current_token && (
                    <div className="px-2 py-1 bg-green-500/10 rounded text-green-500 text-sm font-bold">
                      #{barber.current_token}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate(`/book/${salonId}`)}
            className="p-4 bg-card rounded-xl border border-border hover:border-gold transition-colors text-left"
          >
            <Calendar className="w-6 h-6 text-gold mb-2" />
            <p className="font-medium text-foreground">Book Appointment</p>
            <p className="text-xs text-muted-foreground">Schedule your visit</p>
          </button>
          
          <button
            onClick={() => navigate('/history')}
            className="p-4 bg-card rounded-xl border border-border hover:border-gold transition-colors text-left"
          >
            <Clock className="w-6 h-6 text-gold mb-2" />
            <p className="font-medium text-foreground">My Bookings</p>
            <p className="text-xs text-muted-foreground">View & manage</p>
          </button>
        </div>
      </div>
    </div>
  );
}
