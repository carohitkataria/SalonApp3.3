import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import CustomerBookingStatus from '@/components/CustomerBookingStatus';
import CustomerOtpVerification from '@/components/CustomerOtpVerification';
import { 
  Scissors, Calendar, User, MapPin, Star, Clock, 
  ArrowLeft, Users, CheckCircle, AlertCircle, ChevronRight, X, Wallet, History
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
  
  // Phase 3: branch the customer is currently viewing/booking at.
  // Comes from `?branch=` in the URL (set by the Find-a-salon flow / QR code).
  // Falls back to the salon's main branch on first load.
  const branchIdFromUrl = searchParams.get('branch') || '';
  const [branchId, setBranchId] = useState(branchIdFromUrl);
  const [branch, setBranch] = useState(null);
  const [salon, setSalon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveStatus, setLiveStatus] = useState(null);
  const [userBookings, setUserBookings] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
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
    fetchWalletBalance();
    
    const interval = setInterval(() => {
      fetchLiveStatus();
      fetchUserBookings();
      fetchWalletBalance();
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

      // Resolve the branch:
      //  - if branch_id was in URL, fetch its detail
      //  - else fetch the salon's branches and pick the main one
      try {
        const bRes = await axios.get(`${API}/public/salons/${salonId}/branches`);
        const branches = Array.isArray(bRes.data) ? bRes.data : [];
        let chosen = branches.find(b => b.id === branchIdFromUrl);
        if (!chosen) chosen = branches.find(b => b.is_main_branch) || branches[0] || null;
        if (chosen) {
          setBranch(chosen);
          setBranchId(chosen.id);
        }
      } catch (e) {
        console.error('Failed to load branches', e);
      }
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
      const params = branchId ? `?branch_id=${branchId}` : '';
      const response = await axios.get(`${API}/salons/${salonId}/live-status${params}`);
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

  const fetchWalletBalance = async () => {
    if (!user?.phone) return;
    try {
      const phone = user.phone.replace('+91', '');
      const response = await axios.get(`${API}/salons/${salonId}/customers/${phone}/wallet`);
      setWalletBalance(response.data.wallet_balance || 0);
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'waiting':
        return <Clock className="w-5 h-5 text-brass" strokeWidth={1.6} />;
      case 'called':
        return <AlertCircle className="w-5 h-5 text-brass animate-pulse" strokeWidth={1.6} />;
      case 'in_progress':
        return <Scissors className="w-5 h-5 text-sage animate-spin" strokeWidth={1.6} />;
      default:
        return <CheckCircle className="w-5 h-5 text-sage" strokeWidth={1.6} />;
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
          <Scissors className="w-12 h-12 text-brass animate-spin mx-auto mb-4" strokeWidth={1.4} />
          <p className="eyebrow">Loading salon</p>
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
        return <SalonServicesTab salonId={salonId} branchId={branchId} />;
      case 'barbers':
        return <SalonBarbersTab salonId={salonId} branchId={branchId} />;
      case 'shop':
        return <SalonShopTab salonId={salonId} branchId={branchId} />;
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
                className={`p-5 rounded-2xl border ${
                  booking.status === 'called' || booking.status === 'in_progress' || booking.status === 'in_service'
                    ? 'bg-card border-sage/40 brass-glow-pulse'
                    : 'lux-card bg-card'
                }`}
                data-testid={`active-booking-${booking.id}`}
              >
                {/* Header: status + total token */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(booking.status)}
                    <div>
                      <p className="font-fraunces text-lg text-foreground font-medium leading-tight">{getStatusMessage(booking)}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Stylist: <span className="font-medium text-foreground">{booking.barber_name}</span>
                        {' '}· {booking.shift}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="eyebrow">Token</p>
                    <p className="text-3xl font-bebas brass-text leading-none mt-1">{booking.token_number}</p>
                  </div>
                </div>

                {/* Key metrics — position / people before / wait */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="bg-muted/40 rounded-xl p-3 border border-border/60 text-center">
                    <p className="eyebrow">Your position</p>
                    <p className="text-xl font-bebas text-brass mt-1">#{position}</p>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-3 border border-border/60 text-center">
                    <p className="eyebrow">Before you</p>
                    <p className="text-xl font-bebas text-foreground mt-1">{peopleBefore}</p>
                  </div>
                  <div className="bg-muted/40 rounded-xl p-3 border border-border/60 text-center">
                    <p className="eyebrow">Est. wait</p>
                    <p className="text-xl font-bebas text-foreground mt-1">
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
        <div className="lux-card bg-gradient-to-r from-brass-soft via-card to-card rounded-2xl p-7 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-brass/10 rounded-full blur-3xl pointer-events-none" />
          <span className="eyebrow-brass relative">An invitation</span>
          <h2 className="font-fraunces text-2xl sm:text-3xl mt-2 mb-2 font-medium relative leading-tight">
            Welcome to <span className="serif-italic">{salon.salon_name}</span>
          </h2>
          <p className="text-muted-foreground relative max-w-2xl">
            {salon.description || 'Your trusted destination for premium grooming services.'}
          </p>
        </div>
      )}

      {/* OTP Verification Banner - Show after welcome banner */}
      <CustomerOtpVerification showAs="banner" />

      {/* Quick Actions - Three Cards */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => navigate(`/book/${salonId}${branchId ? `?branch=${branchId}` : ''}`)}
          className="lux-card p-5 bg-card rounded-2xl text-left group"
          data-testid="quick-action-book-btn"
        >
          <Calendar className="w-7 h-7 text-brass mb-3" strokeWidth={1.5} />
          <p className="font-fraunces text-lg text-foreground font-medium leading-tight">Book Appointment</p>
          <p className="text-xs text-muted-foreground mt-1">Schedule your visit</p>
        </button>

        <button
          onClick={() => setShowLiveQueue(true)}
          className="lux-card p-5 bg-card rounded-2xl text-left group"
          data-testid="quick-action-queue-btn"
        >
          <Clock className="w-7 h-7 text-brass mb-3" strokeWidth={1.5} />
          <p className="font-fraunces text-lg text-foreground font-medium leading-tight">Live Queue</p>
          <p className="text-xs text-muted-foreground mt-1">Check wait times</p>
        </button>

        <button
          onClick={() => setActiveTab('services')}
          className="lux-card p-5 bg-card rounded-2xl text-left group"
          data-testid="quick-action-services-btn"
        >
          <Scissors className="w-7 h-7 text-brass mb-3" strokeWidth={1.5} />
          <p className="font-fraunces text-lg text-foreground font-medium leading-tight">Our Services</p>
          <p className="text-xs text-muted-foreground mt-1">Browse all services</p>
        </button>
      </div>

      {/* Live Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div
          className="lux-card bg-card rounded-2xl p-4 cursor-pointer"
          onClick={() => navigate(`/salon/${salonId}/wallet`)}
          data-testid="dashboard-wallet-card"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brass-soft rounded-xl border border-brass/20">
              <Wallet className="w-5 h-5 text-brass" strokeWidth={1.6} />
            </div>
            <div>
              <p className="eyebrow">My Wallet</p>
              <p className="font-fraunces text-2xl text-foreground mt-0.5">
                ₹{walletBalance.toFixed(0)}
              </p>
            </div>
          </div>
        </div>

        <div
          className="lux-card bg-card rounded-2xl p-4 cursor-pointer"
          onClick={() => navigate('/history')}
          data-testid="dashboard-history-card"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-muted rounded-xl border border-border">
              <History className="w-5 h-5 text-foreground/80" strokeWidth={1.6} />
            </div>
            <div>
              <p className="eyebrow">My History</p>
              <p className="font-fraunces text-2xl text-foreground mt-0.5">
                View →
              </p>
            </div>
          </div>
        </div>

        <div
          className="lux-card bg-card rounded-2xl p-4 cursor-pointer"
          onClick={() => navigate(`/salon/${salonId}/ratings`)}
          data-testid="dashboard-rating-card"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brass-soft rounded-xl border border-brass/20">
              <Star className="w-5 h-5 text-brass" strokeWidth={1.6} />
            </div>
            <div>
              <p className="eyebrow">Rating</p>
              <p className="font-fraunces text-2xl text-foreground mt-0.5">
                {(salon.rating && salon.total_reviews > 0) ? salon.rating : '—'}
              </p>
            </div>
          </div>
        </div>

        <div
          className="lux-card bg-card rounded-2xl p-4 cursor-pointer"
          onClick={() => setActiveTab('barbers')}
          data-testid="dashboard-stylists-card"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-muted rounded-xl border border-border">
              <User className="w-5 h-5 text-bronze-light" strokeWidth={1.6} />
            </div>
            <div>
              <p className="eyebrow">Stylists</p>
              <p className="font-fraunces text-2xl text-foreground mt-0.5">
                {liveStatus?.barbers?.length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background bg-grain">
      {/* Compact Header */}
      <div className="bg-card/70 glass-warm border-b border-border/60 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center p-3 gap-3 ml-14 mr-14">
          <button
            onClick={() => {
              if (activeTab !== 'dashboard') {
                setActiveTab('dashboard');
              } else {
                navigate('/salons');
              }
            }}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            data-testid="salon-back-btn"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" strokeWidth={1.6} />
          </button>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            {salon.logo_url ? (
              <img
                src={salon.logo_url}
                alt={salon.salon_name}
                className="w-10 h-10 rounded-full object-cover ring-1 ring-brass/40"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-brass-soft border border-brass/30 flex items-center justify-center">
                <Scissors className="w-4 h-4 text-brass" strokeWidth={1.6} />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-fraunces text-[18px] font-medium text-foreground truncate leading-tight">
                {salon.salon_name}
                {branch && !branch.is_main_branch && (
                  <span className="text-sm font-normal text-brass ml-1.5 serif-italic">· {branch.branch_name}</span>
                )}
              </h1>
              <div className="flex items-center text-[11px] text-muted-foreground mt-0.5">
                <MapPin className="w-3 h-3 mr-1 flex-shrink-0 text-brass/70" strokeWidth={1.5} />
                <span className="truncate" data-testid="customer-branch-address">
                  {(branch && branch.address) || salon.address}
                </span>
              </div>
            </div>
          </div>

          <Button
            onClick={() => navigate(`/book/${salonId}${branchId ? `?branch=${branchId}` : ''}`)}
            className="bg-brass text-espresso hover:bg-brass-hover rounded-full font-semibold"
            size="sm"
            data-testid="salon-header-book-btn"
          >
            <Calendar className="w-4 h-4 mr-1.5" strokeWidth={1.6} />
            Book
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6">
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
              <div className="p-5 border-b border-border/60 flex items-center justify-between">
                <div>
                  <span className="eyebrow-brass">Live</span>
                  <h2 className="font-fraunces text-2xl font-medium text-foreground mt-1 leading-none">Queue</h2>
                </div>
                <button
                  onClick={() => setShowLiveQueue(false)}
                  className="p-2 rounded-full hover:bg-muted"
                  data-testid="live-queue-close-btn"
                >
                  <X className="w-5 h-5 text-foreground" strokeWidth={1.6} />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {/* Overall Status */}
                <div className="bg-gradient-to-r from-brass-soft via-card to-card rounded-2xl p-5 mb-4 border border-brass/20">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-3xl font-bebas text-brass">
                        {liveStatus?.overall?.waiting_count || 0}
                      </p>
                      <p className="eyebrow mt-1">In Queue</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bebas text-foreground">
                        #{liveStatus?.overall?.current_token || '—'}
                      </p>
                      <p className="eyebrow mt-1">Now Serving</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bebas text-sage">
                        {liveStatus?.overall?.completed_today || 0}
                      </p>
                      <p className="eyebrow mt-1">Completed</p>
                    </div>
                  </div>
                </div>

                {/* Stylist-wise Queue */}
                <h3 className="font-fraunces text-base font-medium text-foreground mb-3 mt-2">Stylist queue</h3>
                <div className="space-y-3">
                  {liveStatus?.barbers && liveStatus.barbers.length > 0 ? (
                    liveStatus.barbers.map((barber) => (
                      <div
                        key={barber.barber_id}
                        className="bg-background rounded-xl p-4 border border-border"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-brass-soft border border-brass/30 flex items-center justify-center">
                              <User className="w-4 h-4 text-brass" strokeWidth={1.6} />
                            </div>
                            <div>
                              <p className="font-bold text-foreground">{barber.barber_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {barber.status === 'busy' ? 'Currently Busy' : 'Available'}
                              </p>
                            </div>
                          </div>
                          {barber.current_token && (
                            <div className="px-2.5 py-1 pill-brass rounded-full">
                              <span className="font-semibold text-[11px]">Serving #{barber.current_token}</span>
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
                                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                    idx === 0
                                      ? 'pill-brass'
                                      : 'bg-muted text-foreground border border-border'
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
