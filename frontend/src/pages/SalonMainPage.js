import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import CustomerBookingStatus from '@/components/CustomerBookingStatus';
import { 
  Scissors, Calendar, User, MapPin, Star, Clock, 
  ArrowLeft, Users, CheckCircle, AlertCircle, ChevronRight, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Import tab components
import SalonServicesTab from './salon-tabs/SalonServicesTab';
import SalonBarbersTab from './salon-tabs/SalonBarbersTab';
import SalonShopTab from './salon-tabs/SalonShopTab';
import SalonGalleryTab from './salon-tabs/SalonGalleryTab';
import SalonProfileTab from './salon-tabs/SalonProfileTab';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SalonMainPage() {
  const { salonId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isUserLoggedIn, user } = useAuth();
  
  const [salon, setSalon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveStatus, setLiveStatus] = useState(null);
  const [userBookings, setUserBookings] = useState([]);
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'dashboard');
  const [showLiveQueue, setShowLiveQueue] = useState(false);

  // Keep activeTab synced with ?tab= URL param
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) setActiveTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  // Listen for tab change events from hamburger menu
  useEffect(() => {
    const handleTabChange = (event) => {
      const tabId = event.detail;
      if (tabId) {
        setActiveTab(tabId);
      }
    };

    window.addEventListener('setTab', handleTabChange);
    return () => window.removeEventListener('setTab', handleTabChange);
  }, []);

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
      const activeStatuses = ['waiting', 'called', 'in_progress', 'in_service'];
      const todayBookings = response.data.filter(b =>
        b.salon_id === salonId && activeStatuses.includes(b.status)
      );
      // Enrich each active booking with live queue status (barber-wise position,
      // people before, estimated wait, currently serving for THIS barber).
      const enriched = await Promise.all(todayBookings.map(async (b) => {
        try {
          const r = await axios.get(`${API}/tokens/${b.id}/queue-status`);
          return { ...b, queue: r.data };
        } catch (e) {
          return b;
        }
      }));
      setUserBookings(enriched);
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
    const q = booking.queue;
    if (q?.status_message) return q.status_message;
    switch (booking.status) {
      case 'waiting': {
        const before = q?.people_before ?? 0;
        if (before === 0) return "You're next!";
        return `${before} customer${before === 1 ? '' : 's'} before you`;
      }
      case 'called':
        return `Your turn! Please proceed to ${booking.barber_name}`;
      case 'in_progress':
      case 'in_service':
        return `In progress with ${booking.barber_name}`;
      default:
        return 'Booking active';
    }
  };

  const formatWait = (mins) => {
    if (mins == null) return null;
    if (mins <= 0) return 'Next!';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
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

  // Render tab content based on activeTab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'services':
        return <SalonServicesTab salonId={salonId} />;
      case 'barbers':
        return <SalonBarbersTab salonId={salonId} />;
      case 'shop':
        return <SalonShopTab salonId={salonId} />;
      case 'gallery':
        return <SalonGalleryTab salon={salon} />;
      case 'profile':
        return <SalonProfileTab salon={salon} />;
      default:
        return renderDashboard();
    }
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Active Booking Status — barber-specific live queue */}
      {userBookings.length > 0 && (
        <div className="space-y-3">
          {userBookings.map((booking) => {
            const q = booking.queue || {};
            const peopleBefore = q.people_before ?? 0;
            const position = q.position ?? (peopleBefore + 1);
            const waitMin = q.estimated_wait_minutes;
            const serving = q.currently_serving;
            return (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl border-2 ${
                  booking.status === 'called' || booking.status === 'in_progress' || booking.status === 'in_service'
                    ? 'bg-green-500/10 border-green-500'
                    : 'bg-gold/10 border-gold/50'
                }`}
              >
                {/* Header: status + total token */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(booking.status)}
                    <div>
                      <p className="font-bold text-foreground">{getStatusMessage(booking)}</p>
                      <p className="text-sm text-muted-foreground">
                        Barber: <span className="font-semibold text-foreground">{booking.barber_name}</span>
                        {' '}• {booking.shift}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total token</p>
                    <p className="text-2xl font-bebas text-gold leading-none">{booking.token_number}</p>
                  </div>
                </div>

                {/* Key metrics — position / people before / wait */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="bg-background/70 rounded-lg p-2 border border-border/50 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground">Your position</p>
                    <p className="text-xl font-bold text-gold">#{position}</p>
                  </div>
                  <div className="bg-background/70 rounded-lg p-2 border border-border/50 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground">Before you</p>
                    <p className="text-xl font-bold text-foreground">{peopleBefore}</p>
                  </div>
                  <div className="bg-background/70 rounded-lg p-2 border border-border/50 text-center">
                    <p className="text-[10px] uppercase text-muted-foreground">Est. wait</p>
                    <p className="text-xl font-bold text-foreground">
                      {formatWait(waitMin) ?? '—'}
                    </p>
                  </div>
                </div>

                {/* Currently serving for THIS barber (not salon-wide) */}
                {serving && serving.token_number && (
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      <span className="uppercase tracking-wider text-[10px] block">
                        Currently with {booking.barber_name}
                      </span>
                      <span className="font-bold text-foreground">Token {serving.token_number}</span>
                      {Array.isArray(serving.services) && serving.services.length > 0 && (
                        <span className="text-xs"> • {serving.services.join(', ')}</span>
                      )}
                    </p>
                    {q.approx_finish_minutes != null && (
                      <div className="text-right">
                        <p className="text-[10px] uppercase text-muted-foreground">Finish in</p>
                        <p className="text-sm font-bold text-foreground">{formatWait(q.approx_finish_minutes)}</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Welcome Banner - Only when no active booking */}
      {userBookings.length === 0 && (
        <div className="bg-gradient-to-r from-gold/20 to-gold/5 rounded-2xl p-6 border border-gold/30">
          <h2 className="text-2xl font-playfair font-bold text-foreground mb-2">
            Welcome to {salon.salon_name}
          </h2>
          <p className="text-muted-foreground mb-4">
            {salon.description || 'Your trusted destination for premium grooming services.'}
          </p>
        </div>
      )}

      {/* Quick Actions - Three Cards like the image */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => navigate(`/book/${salonId}`)}
          className="p-4 bg-card rounded-xl border border-border hover:border-gold transition-colors text-left"
        >
          <Calendar className="w-8 h-8 text-gold mb-3" />
          <p className="font-bold text-foreground">Book Appointment</p>
          <p className="text-xs text-muted-foreground">Schedule your visit</p>
        </button>
        
        <button
          onClick={() => setShowLiveQueue(true)}
          className="p-4 bg-card rounded-xl border border-border hover:border-gold transition-colors text-left"
        >
          <Clock className="w-8 h-8 text-gold mb-3" />
          <p className="font-bold text-foreground">Live Queue</p>
          <p className="text-xs text-muted-foreground">Check wait times</p>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className="p-4 bg-card rounded-xl border border-border hover:border-gold transition-colors text-left"
        >
          <Scissors className="w-8 h-8 text-gold mb-3" />
          <p className="font-bold text-foreground">Our Services</p>
          <p className="text-xs text-muted-foreground">Browse all services</p>
        </button>
      </div>

      {/* Live Status Summary Cards */}
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

        <div className="bg-card rounded-xl p-4 border border-border cursor-pointer hover:border-gold/50 transition-colors"
          onClick={() => navigate(`/salon/${salonId}/ratings`)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gold/10 rounded-lg">
              <Star className="w-5 h-5 text-gold" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rating</p>
              <p className="text-2xl font-bold text-foreground">
                {(salon.rating && salon.total_reviews > 0) ? salon.rating : '-'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl p-4 border border-border cursor-pointer hover:border-gold/50 transition-colors"
          onClick={() => setActiveTab('barbers')}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <User className="w-5 h-5 text-purple-500" />
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
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Compact Header */}
      <div className="bg-card border-b border-border sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center p-3 gap-3">
          <button 
            onClick={() => {
              if (activeTab !== 'dashboard') {
                setActiveTab('dashboard');
              } else {
                navigate('/salons');
              }
            }}
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

      <div className="max-w-4xl mx-auto p-4">
        {renderTabContent()}
      </div>

      {/* Live Queue Modal */}
      <AnimatePresence>
        {showLiveQueue && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setShowLiveQueue(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Live Queue</h2>
                  <p className="text-sm text-muted-foreground">Real-time wait times</p>
                </div>
                <button
                  onClick={() => setShowLiveQueue(false)}
                  className="p-2 rounded-full hover:bg-muted"
                >
                  <X className="w-5 h-5 text-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {/* Overall Status */}
                <div className="bg-gradient-to-r from-gold/20 to-gold/5 rounded-xl p-4 mb-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-3xl font-bebas text-gold">
                        {liveStatus?.overall?.waiting_count || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">In Queue</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bebas text-foreground">
                        #{liveStatus?.overall?.current_token || '-'}
                      </p>
                      <p className="text-xs text-muted-foreground">Now Serving</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bebas text-green-500">
                        {liveStatus?.overall?.completed_today || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                  </div>
                </div>

                {/* Barber-wise Queue */}
                <h3 className="font-bold text-foreground mb-3">Barber Queue Status</h3>
                <div className="space-y-3">
                  {liveStatus?.barbers && liveStatus.barbers.length > 0 ? (
                    liveStatus.barbers.map((barber) => (
                      <div
                        key={barber.barber_id}
                        className="bg-background rounded-xl p-4 border border-border"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
                              <User className="w-5 h-5 text-gold" />
                            </div>
                            <div>
                              <p className="font-bold text-foreground">{barber.barber_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {barber.status === 'busy' ? 'Currently Busy' : 'Available'}
                              </p>
                            </div>
                          </div>
                          {barber.current_token && (
                            <div className="px-3 py-1 bg-green-500/10 rounded-full">
                              <span className="text-green-500 font-bold">Serving #{barber.current_token}</span>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div className="bg-muted/50 rounded-lg p-2">
                            <p className="text-lg font-bold text-foreground">{barber.waiting_count}</p>
                            <p className="text-xs text-muted-foreground">Waiting</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-2">
                            <p className="text-lg font-bold text-foreground">{barber.total_tokens_today || 0}</p>
                            <p className="text-xs text-muted-foreground">Served Today</p>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-2">
                            <p className="text-lg font-bold text-foreground">
                              {barber.waiting_count > 0 ? `~${barber.waiting_count * 20}min` : 'Now'}
                            </p>
                            <p className="text-xs text-muted-foreground">Est. Wait</p>
                          </div>
                        </div>

                        {/* Waiting Queue List */}
                        {barber.waiting_tokens && barber.waiting_tokens.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-xs text-muted-foreground mb-2">Queue:</p>
                            <div className="flex flex-wrap gap-2">
                              {barber.waiting_tokens.slice(0, 10).map((token, idx) => (
                                <span
                                  key={token}
                                  className={`px-2 py-1 rounded text-xs font-bold ${
                                    idx === 0 
                                      ? 'bg-gold/20 text-gold' 
                                      : 'bg-muted text-foreground'
                                  }`}
                                >
                                  #{token}
                                </span>
                              ))}
                              {barber.waiting_tokens.length > 10 && (
                                <span className="text-xs text-muted-foreground">
                                  +{barber.waiting_tokens.length - 10} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground">No active barbers at the moment</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
