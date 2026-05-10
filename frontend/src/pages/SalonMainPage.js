import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import CustomerBookingStatus from '@/components/CustomerBookingStatus';
import CustomerOtpVerification from '@/components/CustomerOtpVerification';
import {
  Scissors, Calendar, User, MapPin, Star, Clock,
  ArrowLeft, Users, CheckCircle, AlertCircle, ChevronRight, X, Wallet, History,
  ChevronDown, Quote, Phone
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

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABEL = { sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat' };

export default function SalonMainPage() {
  const { salonId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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

  // New: data for scrollable home
  const [branches, setBranches] = useState([]);
  const [services, setServices] = useState([]);
  const [allBarbers, setAllBarbers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

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
        const branchList = Array.isArray(bRes.data) ? bRes.data : [];
        setBranches(branchList);
        let chosen = branchList.find(b => b.id === branchIdFromUrl);
        if (!chosen) chosen = branchList.find(b => b.is_main_branch) || branchList[0] || null;
        if (chosen) {
          setBranch(chosen);
          setBranchId(chosen.id);
        }
      } catch (e) {
        console.error('Failed to load branches', e);
      }

      // Fetch services, barbers, reviews in parallel for the scrollable home
      Promise.allSettled([
        axios.get(`${API}/salons/${salonId}/services/enabled`),
        axios.get(`${API}/salons/${salonId}/barbers`),
        axios.get(`${API}/salons/${salonId}/ratings?limit=10`),
      ]).then(([sv, br, rv]) => {
        if (sv.status === 'fulfilled') {
          const list = Array.isArray(sv.value.data) ? sv.value.data : (sv.value.data?.services || []);
          setServices(list);
        }
        if (br.status === 'fulfilled') {
          setAllBarbers(Array.isArray(br.value.data) ? br.value.data : []);
        }
        if (rv.status === 'fulfilled') {
          const rvs = rv.value.data?.reviews || [];
          setReviews(rvs.filter(r => r.review && r.review.trim().length > 0));
          setReviewsTotal(rv.value.data?.total_reviews || 0);
        }
      });
    } catch (error) {
      console.error('Error fetching salon:', error);
      toast.error('Failed to load salon information');
      navigate('/salons');
    } finally {
      setLoading(false);
    }
  };

  // Branch switch — updates URL (?branch=...) so deep links remain shareable
  const handleSwitchBranch = (newBranch) => {
    if (!newBranch || newBranch.id === branchId) {
      setShowBranchDropdown(false);
      return;
    }
    setBranch(newBranch);
    setBranchId(newBranch.id);
    setShowBranchDropdown(false);
    const next = new URLSearchParams(searchParams);
    next.set('branch', newBranch.id);
    setSearchParams(next, { replace: true });
    // refresh live status & wallet for the new branch
    setTimeout(() => {
      fetchLiveStatus();
      fetchWalletBalance();
    }, 100);
  };

  // Compute today's open/close window from operational_hours
  const todayHours = useMemo(() => {
    if (!salon?.operational_hours) return null;
    const today = DAYS[new Date().getDay()];
    const day = salon.operational_hours[today];
    if (!day || day.is_holiday) return { closed: true };
    return { open: day.opening_time || '09:00', close: day.closing_time || '20:00', closed: false };
  }, [salon]);

  const isOpen = useMemo(() => {
    if (salon?.manual_toggle?.is_overridden) return salon.manual_toggle.is_open;
    if (!todayHours || todayHours.closed) return false;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const [oh, om] = (todayHours.open || '09:00').split(':').map(Number);
    const [ch, cm] = (todayHours.close || '20:00').split(':').map(Number);
    return cur >= oh * 60 + om && cur <= ch * 60 + cm;
  }, [salon, todayHours]);

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

      {/* OTP Verification Banner */}
      <CustomerOtpVerification showAs="banner" />

      {/* === HERO GALLERY (luzo-inspired: 1 large + 2 thumbs) === */}
      {(() => {
        const photos = (salon.photo_gallery && salon.photo_gallery.length)
          ? salon.photo_gallery.slice(0, 5)
          : (salon.logo_url ? [salon.logo_url] : []);
        const main = photos[0];
        const thumbs = photos.slice(1, 3);
        if (!main) return null;
        return (
          <section className="rise-in" data-testid="salon-hero-gallery">
            <div className="grid grid-cols-3 gap-2 h-56 sm:h-72">
              <div className={`${thumbs.length > 0 ? 'col-span-2' : 'col-span-3'} relative rounded-2xl overflow-hidden bg-muted`}>
                <img src={main} alt={salon.salon_name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                {salon.photo_gallery?.length > 0 && (
                  <button
                    onClick={() => setActiveTab('gallery')}
                    className="absolute bottom-3 right-3 glass-warm text-foreground text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 hover:bg-card transition-colors"
                    data-testid="hero-view-photos-btn"
                  >
                    <span>View all photos</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
              {thumbs.length > 0 && (
                <div className="col-span-1 grid grid-rows-2 gap-2 h-full">
                  {thumbs.map((src, i) => (
                    <div key={i} className="relative rounded-2xl overflow-hidden bg-muted">
                      <img src={src} alt={`${salon.salon_name} ${i + 2}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* === SALON IDENTITY (name + status + offers) === */}
      <section className="space-y-3" data-testid="salon-identity">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <span className="eyebrow-brass">{salon.gender_tag || 'Unisex'}</span>
            <h1 className="font-fraunces text-3xl sm:text-4xl font-medium leading-[1.05] mt-1">
              {salon.salon_name}
              {branch && !branch.is_main_branch && (
                <span className="block text-lg font-normal text-brass serif-italic mt-1">· {branch.branch_name}</span>
              )}
            </h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-widest uppercase ${isOpen ? 'pill-open' : 'pill-closed'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-sage animate-pulse' : 'bg-current'}`} />
                {isOpen ? 'Open Now' : 'Closed Now'}
              </span>
              {todayHours && !todayHours.closed && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-brass/70" strokeWidth={1.6} />
                  {todayHours.open} – {todayHours.close}
                </span>
              )}
              {salon.rating > 0 && salon.total_reviews > 0 && (
                <span className="flex items-center gap-1 pill-brass px-2 py-0.5 rounded-full text-[11px] font-semibold">
                  <Star className="w-3 h-3 fill-current" />
                  {salon.rating} <span className="opacity-70">· {salon.total_reviews} reviews</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {salon.description && (
          <p className="text-muted-foreground leading-relaxed max-w-3xl">
            {salon.description}
          </p>
        )}
      </section>

      {/* === SERVICES === */}
      <section className="space-y-4" data-testid="salon-services-section">
        <header className="flex items-end justify-between">
          <div>
            <span className="eyebrow-brass">Curated</span>
            <h2 className="font-fraunces text-2xl font-medium mt-1 leading-none">Services</h2>
          </div>
          <button
            onClick={() => setActiveTab('services')}
            className="text-sm text-brass hover:underline inline-flex items-center gap-1"
            data-testid="services-view-all-btn"
          >
            View all <ChevronRight className="w-4 h-4" />
          </button>
        </header>

        {services.length === 0 ? (
          <div className="lux-card rounded-2xl p-8 text-center text-muted-foreground text-sm">
            No services listed yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {services.slice(0, 8).map((sv) => (
              <button
                key={sv.id}
                onClick={() => navigate(`/book/${salonId}${branchId ? `?branch=${branchId}` : ''}`)}
                className="group lux-card rounded-2xl overflow-hidden bg-card text-left flex flex-col"
                data-testid={`service-tile-${sv.id}`}
              >
                <div className="aspect-square bg-muted relative overflow-hidden">
                  {sv.image_url ? (
                    <img src={sv.image_url} alt={sv.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brass-soft to-card">
                      <Scissors className="w-7 h-7 text-brass" strokeWidth={1.4} />
                    </div>
                  )}
                </div>
                <div className="p-3 flex-1">
                  <p className="font-medium text-sm text-foreground line-clamp-2 leading-snug">{sv.name}</p>
                  {sv.price != null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-semibold text-brass">₹{sv.price}</span>
                      {sv.duration && <span> · {sv.duration} min</span>}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* === STYLISTS (chips) === */}
      <section className="space-y-4" data-testid="salon-stylists-section">
        <header className="flex items-end justify-between">
          <div>
            <span className="eyebrow-brass">In the chair</span>
            <h2 className="font-fraunces text-2xl font-medium mt-1 leading-none">Our Stylists</h2>
          </div>
          <button
            onClick={() => setActiveTab('barbers')}
            className="text-sm text-brass hover:underline inline-flex items-center gap-1"
            data-testid="stylists-view-all-btn"
          >
            View all <ChevronRight className="w-4 h-4" />
          </button>
        </header>

        {allBarbers.length === 0 ? (
          <div className="lux-card rounded-2xl p-8 text-center text-muted-foreground text-sm">
            No stylists listed yet.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {allBarbers.map((b) => (
              <button
                key={b.id}
                onClick={() => navigate(`/salon/${salonId}/barber/${b.id}`)}
                className="group inline-flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full bg-card border border-border hover:border-brass/60 transition-colors"
                data-testid={`stylist-chip-${b.id}`}
              >
                <span className="w-7 h-7 rounded-full overflow-hidden ring-1 ring-border flex-shrink-0 bg-muted flex items-center justify-center">
                  {b.image_url || b.photo_url ? (
                    <img src={b.image_url || b.photo_url} alt={b.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-brass" strokeWidth={1.6} />
                  )}
                </span>
                <span className="text-sm font-medium text-foreground">{b.name}</span>
                {b.rating > 0 && (
                  <span className="text-[11px] text-brass inline-flex items-center gap-0.5">
                    <Star className="w-2.5 h-2.5 fill-current" />
                    {b.rating}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* === ABOUT === */}
      <section className="space-y-4" data-testid="salon-about-section">
        <header>
          <span className="eyebrow-brass">House notes</span>
          <h2 className="font-fraunces text-2xl font-medium mt-1 leading-none">About</h2>
        </header>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Address card */}
          <div className="lux-card rounded-2xl p-5 bg-card">
            <div className="eyebrow mb-3">Address</div>
            <p className="text-foreground leading-relaxed">
              {(branch && branch.address) || salon.address}
            </p>
            {salon.phone && (
              <a
                href={`tel:${salon.phone}`}
                className="mt-4 inline-flex items-center gap-2 text-sm text-brass hover:underline"
              >
                <Phone className="w-3.5 h-3.5" strokeWidth={1.6} /> {salon.phone}
              </a>
            )}
            {salon.latitude && salon.longitude && (
              <a
                href={`https://www.google.com/maps?q=${salon.latitude},${salon.longitude}`}
                target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-sm text-brass hover:underline ml-4"
              >
                <MapPin className="w-3.5 h-3.5" strokeWidth={1.6} /> Get Directions
              </a>
            )}
          </div>

          {/* Hours */}
          <div className="lux-card rounded-2xl p-5 bg-card">
            <div className="eyebrow mb-3">Operational Hours</div>
            <ul className="space-y-1.5 text-sm">
              {DAYS.map((d) => {
                const day = salon.operational_hours?.[d];
                const isToday = DAYS[new Date().getDay()] === d;
                return (
                  <li key={d} className={`flex items-center justify-between ${isToday ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    <span className={isToday ? 'text-brass' : ''}>
                      {DAY_LABEL[d]}
                      {isToday && <span className="serif-italic ml-1.5 text-[10px] uppercase tracking-widest">today</span>}
                    </span>
                    <span>
                      {!day || day.is_holiday
                        ? <span className="opacity-60">Closed</span>
                        : `${day.opening_time || '09:00'} – ${day.closing_time || '20:00'}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* === REVIEWS (auto-scrolling marquee) === */}
      <section className="space-y-4" data-testid="salon-reviews-section">
        <header className="flex items-end justify-between">
          <div>
            <span className="eyebrow-brass">In their words</span>
            <h2 className="font-fraunces text-2xl font-medium mt-1 leading-none">
              Reviews
              {reviewsTotal > 0 && (
                <span className="text-base font-normal text-muted-foreground ml-2">· {reviewsTotal}</span>
              )}
            </h2>
          </div>
          {reviewsTotal > 0 && (
            <button
              onClick={() => navigate(`/salon/${salonId}/ratings`)}
              className="text-sm text-brass hover:underline inline-flex items-center gap-1"
              data-testid="reviews-view-all-btn"
            >
              View all <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </header>

        {reviews.length === 0 ? (
          <div className="lux-card rounded-2xl p-8 text-center text-muted-foreground text-sm">
            No reviews yet — be the first to share your experience.
          </div>
        ) : (
          <div className="overflow-hidden relative" data-testid="reviews-marquee">
            <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
            <button
              onClick={() => navigate(`/salon/${salonId}/ratings`)}
              className="block w-full text-left"
              aria-label="View all reviews"
            >
              <div className="marquee-track py-2">
                {[...reviews, ...reviews].map((r, i) => (
                  <div
                    key={`${r.id || r._id || i}-${i}`}
                    className="lux-card rounded-2xl bg-card p-5 w-[300px] sm:w-[360px] flex-shrink-0"
                  >
                    <Quote className="w-5 h-5 text-brass/60" strokeWidth={1.4} />
                    <div className="flex items-center gap-1 mt-2">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`w-3.5 h-3.5 ${s <= (r.rating || 0) ? 'text-brass fill-current' : 'text-muted-foreground/30'}`} />
                      ))}
                    </div>
                    <p className="text-sm text-foreground mt-3 leading-relaxed line-clamp-4">
                      "{r.review}"
                    </p>
                    <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">
                        {r.customer_name || 'Anonymous'}
                      </span>
                      {r.created_at && (
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </button>
          </div>
        )}
      </section>
    </div>
  );

  return (
    <div className="min-h-screen bg-background bg-grain">
      {/* === STICKY TOP STRIP — Branch dropdown + actions === */}
      <div className="bg-card/80 glass-warm border-b border-border/60 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5 flex items-center gap-2 ml-12 mr-12 sm:ml-14 sm:mr-14">
          {/* Back button */}
          <button
            onClick={() => {
              if (activeTab !== 'dashboard') {
                setActiveTab('dashboard');
                const next = new URLSearchParams(searchParams);
                next.delete('tab');
                setSearchParams(next, { replace: true });
              } else {
                navigate('/salons');
              }
            }}
            className="p-2 rounded-full hover:bg-muted transition-colors flex-shrink-0"
            data-testid="salon-back-btn"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" strokeWidth={1.7} />
          </button>

          {/* Branch dropdown — primary identity on top bar */}
          <div className="relative flex-1 min-w-0">
            <button
              onClick={() => setShowBranchDropdown(v => !v)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-muted transition-colors text-left"
              data-testid="branch-dropdown-btn"
              disabled={branches.length <= 1}
            >
              {salon.logo_url ? (
                <img src={salon.logo_url} alt={salon.salon_name} className="w-8 h-8 rounded-full object-cover ring-1 ring-brass/40 flex-shrink-0" />
              ) : (
                <span className="w-8 h-8 rounded-full bg-brass-soft border border-brass/30 flex items-center justify-center flex-shrink-0">
                  <Scissors className="w-3.5 h-3.5 text-brass" strokeWidth={1.6} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-fraunces text-[15px] font-medium text-foreground leading-tight truncate">
                  {salon.salon_name}
                </span>
                <span className="block text-[11px] text-muted-foreground truncate">
                  {branch?.branch_name || 'Main Branch'}{branches.length > 1 && <span className="text-brass"> · change ↓</span>}
                </span>
              </span>
              {branches.length > 1 && (
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${showBranchDropdown ? 'rotate-180' : ''}`} strokeWidth={1.6} />
              )}
            </button>
            <AnimatePresence>
              {showBranchDropdown && branches.length > 1 && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-2 w-[300px] max-w-[90vw] lux-card rounded-2xl bg-popover p-2 z-50"
                  data-testid="branch-dropdown-menu"
                >
                  <div className="eyebrow px-3 pt-2 pb-1">Branches</div>
                  <div className="max-h-72 overflow-y-auto">
                    {branches.map(b => (
                      <button
                        key={b.id}
                        onClick={() => handleSwitchBranch(b)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-start gap-2 ${
                          b.id === branchId ? 'bg-brass-soft' : 'hover:bg-muted'
                        }`}
                        data-testid={`branch-option-${b.id}`}
                      >
                        <MapPin className={`w-3.5 h-3.5 mt-1 flex-shrink-0 ${b.id === branchId ? 'text-brass' : 'text-muted-foreground'}`} strokeWidth={1.6} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-foreground truncate">
                            {b.branch_name}{b.is_main_branch && <span className="text-brass text-[10px] uppercase tracking-widest ml-1.5">main</span>}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">{b.address}</div>
                        </div>
                        {b.id === branchId && <CheckCircle className="w-4 h-4 text-brass flex-shrink-0 mt-0.5" strokeWidth={2} />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action buttons — tight, icon+label on lg, icon-only on small */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => navigate(`/book/${salonId}${branchId ? `?branch=${branchId}` : ''}`)}
              className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full bg-brass text-espresso hover:bg-brass-hover transition-colors font-semibold text-sm"
              data-testid="strip-book-btn"
              aria-label="Book appointment"
            >
              <Calendar className="w-4 h-4" strokeWidth={1.8} />
              <span className="hidden sm:inline">Book</span>
            </button>
            <button
              onClick={() => setShowLiveQueue(true)}
              className="inline-flex items-center justify-center gap-1.5 h-9 w-9 sm:w-auto sm:px-3 rounded-full border border-border bg-card hover:border-brass/60 transition-colors text-foreground"
              data-testid="strip-queue-btn"
              aria-label="Live queue"
              title="Live queue"
            >
              <Clock className="w-4 h-4 text-brass" strokeWidth={1.7} />
              <span className="hidden md:inline text-sm">Queue</span>
            </button>
            <button
              onClick={() => navigate(`/salon/${salonId}/wallet`)}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-full border border-border bg-card hover:border-brass/60 transition-colors text-foreground text-sm"
              data-testid="strip-wallet-btn"
              aria-label="Wallet"
              title="My wallet"
            >
              <Wallet className="w-4 h-4 text-brass" strokeWidth={1.7} />
              <span className="font-bebas text-base leading-none">₹{walletBalance.toFixed(0)}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6">
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
