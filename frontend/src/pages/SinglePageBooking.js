import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import GenderBadge from '@/components/GenderBadge';
import { Scissors, Calendar, User, CheckCircle, Star, Clock, ArrowLeft, Home, Zap, Check, ChevronDown, ChevronRight, Search, Package, Crown, History, Wallet, Banknote, Smartphone, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import CustomerWalletCard from '@/components/CustomerWalletCard';
import WalletDisplay from '@/components/WalletDisplay';
import CustomerOtpVerification from '@/components/CustomerOtpVerification';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper functions for IST time
const getISTDate = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + istOffset);
};

const getTodayIST = () => getISTDate().toISOString().split('T')[0];

const getTomorrowIST = () => {
  const ist = getISTDate();
  ist.setDate(ist.getDate() + 1);
  return ist.toISOString().split('T')[0];
};

const getCurrentHourIST = () => getISTDate().getHours();

// Chip Component for selections
const SelectChip = ({ selected, onClick, children, icon: Icon, disabled = false }) => (
  <motion.button
    type="button"
    whileHover={disabled ? {} : { scale: 1.02 }}
    whileTap={disabled ? {} : { scale: 0.98 }}
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    className={`relative px-4 py-2.5 rounded-full border-2 transition-all flex items-center gap-2 text-sm font-medium ${
      disabled
        ? 'bg-muted/50 text-muted-foreground/50 border-border/50 cursor-not-allowed opacity-50'
        : selected
        ? 'bg-gold text-black border-gold shadow-lg shadow-gold/20'
        : 'bg-background text-foreground border-border hover:border-gold/50'
    }`}
  >
    {Icon && <Icon className="w-4 h-4" />}
    {children}
    {selected && !disabled && (
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
      >
        <Check className="w-3 h-3 text-white" />
      </motion.span>
    )}
  </motion.button>
);

// Service Card Component
const ServiceCard = ({ service, selected, onToggle, price }) => {
  const isOnwards = service.price_type === 'onwards';
  return (
  <motion.div
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.99 }}
    onClick={onToggle}
    className={`relative p-3 rounded-xl cursor-pointer transition-all border-2 ${
      selected
        ? 'bg-gold/10 border-gold shadow-md'
        : 'bg-card border-border hover:border-gold/40'
    }`}
  >
    <div className="flex justify-between items-center">
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-foreground text-sm truncate">{service.service_name}</h4>
        {service.default_duration && (
          <p className="text-xs text-muted-foreground flex items-center mt-0.5">
            <Clock className="w-3 h-3 mr-1" /> {service.default_duration} mins
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <p className="text-base font-bold text-gold leading-tight">₹{price}</p>
          {isOnwards && (
            <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide leading-tight">Onwards</p>
          )}
        </div>
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-5 h-5 bg-gold rounded-full flex items-center justify-center"
          >
            <Check className="w-3 h-3 text-black" />
          </motion.div>
        )}
      </div>
    </div>
  </motion.div>
  );
};

// Barber Selection Component
const BarberChip = ({ barber, selected, onSelect, liveStatus, slotAvailability }) => {
  const status = liveStatus?.barbers?.find(b => b.barber_id === barber.id);
  const waitingCount = status?.waiting_count || 0;
  
  // Get slot availability for this barber
  const barberSlot = slotAvailability?.barbers?.find(b => b.barber_id === barber.id);
  const isFull = barberSlot?.is_full || false;
  const slotsLeft = barberSlot?.available ?? 10;
  
  return (
    <motion.button
      type="button"
      whileHover={isFull ? {} : { scale: 1.02 }}
      whileTap={isFull ? {} : { scale: 0.98 }}
      onClick={isFull ? undefined : () => onSelect(barber.id)}
      disabled={isFull}
      className={`relative p-3 rounded-xl border-2 transition-all text-left ${
        isFull
          ? 'bg-muted/30 border-border/50 opacity-60 cursor-not-allowed'
          : selected
          ? 'bg-gold/10 border-gold shadow-md'
          : 'bg-card border-border hover:border-gold/40'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0 border-2 border-gold/30">
          {barber.photo_url ? (
            <img src={barber.photo_url} alt={barber.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gold/20 to-gold/40">
              <User className="w-5 h-5 text-gold" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground text-sm truncate flex items-center gap-1">
            {barber.name}
            {barber.gender_specialization && (
              <GenderBadge gender={barber.gender_specialization} size="xs" />
            )}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            <span className="text-xs text-muted-foreground">{barber.rating || '4.5'}</span>
            {isFull ? (
              <span className="text-xs text-red-500 font-medium">• Full</span>
            ) : (
              <span className="text-xs text-muted-foreground">• {slotsLeft} slots</span>
            )}
          </div>
        </div>
      </div>
      {selected && !isFull && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 w-5 h-5 bg-gold rounded-full flex items-center justify-center"
        >
          <Check className="w-3 h-3 text-black" />
        </motion.div>
      )}
      {isFull && (
        <div className="absolute top-2 right-2 px-2 py-0.5 bg-red-500/20 text-red-500 text-xs rounded-full font-medium">
          Booked
        </div>
      )}
    </motion.button>
  );
};

// Collapsible Category Component
const CategorySection = ({ category, services, selectedServices, onToggle, priceGetter, isOpen, onToggleOpen }) => (
  <div className="border border-border rounded-xl overflow-hidden">
    <button
      type="button"
      onClick={onToggleOpen}
      className="w-full flex items-center justify-between p-3 bg-card hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Scissors className="w-4 h-4 text-gold" />
        <span className="font-bold text-foreground">{category}</span>
        <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded-full">
          {services.length}
        </span>
      </div>
      {isOpen ? (
        <ChevronDown className="w-5 h-5 text-muted-foreground" />
      ) : (
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      )}
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="p-3 pt-0 space-y-2">
            {services.map(service => (
              <ServiceCard
                key={service.id}
                service={service}
                selected={selectedServices.includes(service.id)}
                onToggle={() => onToggle(service.id)}
                price={priceGetter(service)}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export default function SinglePageBooking() {
  const { salonId } = useParams();
  const navigate = useNavigate();
  const { user, isUserLoggedIn, isUserOtpVerified } = useAuth();
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source') || 'online';
  const forSelf = searchParams.get('for') === 'self';
  const whenParam = searchParams.get('when');
  const preselectedBarber = searchParams.get('barber');
  const preselectedServices = searchParams.get('services');

  const [salon, setSalon] = useState(null);
  const [barbers, setBarbers] = useState([]);
  const [salonServices, setSalonServices] = useState([]);
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [customerMembership, setCustomerMembership] = useState(null);
  const [showMembershipShop, setShowMembershipShop] = useState(false);
  const [membershipPlans, setMembershipPlans] = useState([]);
  const [activeTab, setActiveTab] = useState('services');
  const [serviceTab, setServiceTab] = useState('services'); // favorites / services / packages
  const [selectedCategory, setSelectedCategory] = useState('favorites'); // Category filter
  const [categories, setCategories] = useState([]); // Categories with thumbnails
  const [customerBookings, setCustomerBookings] = useState([]);
  const [recentServices, setRecentServices] = useState([]);
  const [availablePackages, setAvailablePackages] = useState({ public: [], customer: [] });
  const [useWallet, setUseWallet] = useState(false);
  const [paymentMode, setPaymentMode] = useState(''); // cash/upi/wallet/pay_later
  const [couponCode, setCouponCode] = useState('');
  const [upiAppOpened, setUpiAppOpened] = useState(false);
  const [barberServices, setBarberServices] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [liveStatus, setLiveStatus] = useState(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [bookedToken, setBookedToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [slotAvailability, setSlotAvailability] = useState(null);
  
  // Form state
  const [bookingForSelf, setBookingForSelf] = useState(forSelf || true);
  const [otherPersonName, setOtherPersonName] = useState('');
  const [otherPersonPhone, setOtherPersonPhone] = useState('');
  const [otherPersonGender, setOtherPersonGender] = useState('');
  const [fastestAvailable, setFastestAvailable] = useState(!preselectedBarber);
  const [searchQuery, setSearchQuery] = useState('');
  const [openCategories, setOpenCategories] = useState({});

  const [formData, setFormData] = useState({
    date: whenParam === 'today' ? getTodayIST() : getTodayIST(),
    shift: '',
    barberId: preselectedBarber || 'any',
    selectedServices: preselectedServices ? preselectedServices.split(',') : [],
    bookingType: whenParam === 'today' ? 'instant' : 'instant'
  });

  const [totalAmount, setTotalAmount] = useState(0);

  // Fetch data on mount
  useEffect(() => {
    if (!isUserLoggedIn) {
      navigate('/user/login', { state: { from: `/book/${salonId}` } });
      return;
    }
    fetchSalonData();
    fetchShifts();
    fetchLiveStatus();
    fetchRecentServices();
    fetchCustomerMembership();
    fetchPackages();
    fetchCustomerBookings();
    const interval = setInterval(fetchLiveStatus, 30000);
    return () => clearInterval(interval);
  }, [isUserLoggedIn, salonId]);

  // Refetch shift windows when selected date changes (operational-hour driven)
  useEffect(() => {
    if (salonId && formData.date) {
      fetchShifts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.date, salonId]);

  // Fetch barber services when barber changes
  useEffect(() => {
    if (formData.barberId !== 'any' && !fastestAvailable) {
      fetchBarberServices(formData.barberId);
    } else {
      setBarberServices(salonServices);
    }
    setFormData(prev => ({ ...prev, selectedServices: [] }));
  }, [formData.barberId, salonServices, fastestAvailable]);

  // Calculate total when services change
  useEffect(() => {
    calculateTotal();
  }, [formData.selectedServices, barberServices, salonServices]);

  // Initialize open categories
  useEffect(() => {
    const services = (fastestAvailable || formData.barberId === 'any') ? salonServices : barberServices;
    const categories = [...new Set(services.map(s => s.category || 'General'))];
    const initial = {};
    categories.forEach((cat, idx) => {
      initial[cat] = idx === 0; // Open first category by default
    });
    setOpenCategories(initial);
  }, [salonServices, barberServices, fastestAvailable, formData.barberId]);

  const fetchSalonData = async () => {
    try {
      const [salonRes, barbersRes, servicesRes, categoriesRes] = await Promise.all([
        axios.get(`${API}/salons/${salonId}`),
        axios.get(`${API}/salons/${salonId}/barbers?available_only=true`),
        axios.get(`${API}/salons/${salonId}/services/enabled`),
        axios.get(`${API}/services/categories`)
      ]);
      setSalon(salonRes.data);
      setBarbers(barbersRes.data);
      setSalonServices(servicesRes.data);
      
      // Set categories with default thumbnails
      const defaultThumbnails = {
        "Favorites": "https://images.pexels.com/photos/7755651/pexels-photo-7755651.jpeg?w=200&h=200&fit=crop",
        "General": "https://images.pexels.com/photos/7781850/pexels-photo-7781850.jpeg?w=200&h=200&fit=crop",
        "Packages": "https://images.pexels.com/photos/3065171/pexels-photo-3065171.jpeg?w=200&h=200&fit=crop",
        "Facial": "https://images.pexels.com/photos/3985325/pexels-photo-3985325.jpeg?w=200&h=200&fit=crop",
        "Hair Color": "https://images.pexels.com/photos/3993146/pexels-photo-3993146.jpeg?w=200&h=200&fit=crop",
        "Massage & Spa": "https://images.pexels.com/photos/3757952/pexels-photo-3757952.jpeg?w=200&h=200&fit=crop",
        "Men's Grooming": "https://images.pexels.com/photos/9992819/pexels-photo-9992819.jpeg?w=200&h=200&fit=crop",
        "Manicure & Pedicure": "https://images.pexels.com/photos/3997379/pexels-photo-3997379.jpeg?w=200&h=200&fit=crop"
      };
      
      // Build category list: Favorites first, then General, then Packages, then others
      const rawCategories = categoriesRes.data.categories || [];
      const orderedCategories = [
        { name: "Favorites", thumbnail_url: defaultThumbnails["Favorites"] }
      ];
      
      // Add General first if exists
      const general = rawCategories.find(c => c.name === "General");
      if (general) orderedCategories.push(general);
      
      // Add Packages
      orderedCategories.push({ name: "Packages", thumbnail_url: defaultThumbnails["Packages"] });
      
      // Add remaining categories (excluding General and any duplicates)
      rawCategories.forEach(cat => {
        if (cat.name !== "General" && !orderedCategories.find(c => c.name === cat.name)) {
          orderedCategories.push(cat);
        }
      });
      
      setCategories(orderedCategories);
    } catch (error) {
      console.error('Error fetching salon data:', error);
      toast.error('Failed to load salon information');
    }
  };

  const fetchShifts = async () => {
    try {
      // Prefer salon-specific shift windows derived from operational hours
      const dateForShifts = formData.date || getTodayIST();
      const response = await axios.get(`${API}/salons/${salonId}/shift-windows`, {
        params: { date: dateForShifts }
      });
      setShifts(response.data.shifts || []);
    } catch (error) {
      console.error('Error fetching shift windows, falling back to defaults:', error);
      try {
        const fallback = await axios.get(`${API}/shifts`);
        setShifts(fallback.data.shifts);
      } catch (e) {
        console.error('Fallback /shifts also failed:', e);
      }
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

  const fetchSlotAvailability = async (date, shift) => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/slot-availability`, {
        params: { date, shift }
      });
      setSlotAvailability(response.data);
    } catch (error) {
      console.error('Error fetching slot availability:', error);
    }
  };

  // Fetch slot availability when date or shift changes
  useEffect(() => {
    if (formData.date && formData.shift) {
      fetchSlotAvailability(formData.date, formData.shift);
    }
  }, [formData.date, formData.shift]);

  const fetchBarberServices = async (barberId) => {
    try {
      const response = await axios.get(`${API}/barbers/${barberId}/services`);
      setBarberServices(response.data.filter(s => s.is_available));
    } catch (error) {
      setBarberServices([]);
    }
  };

  const fetchPackages = async () => {
    try {
      const gender = user?.gender || 'all';
      
      // Fetch public salon packages
      const publicResponse = await axios.get(`${API}/salons/${salonId}/packages/with-services`, {
        params: { gender }
      });
      
      // Fetch customer-specific packages if user is logged in
      let customerPackages = [];
      if (user && user.phone) {
        try {
          const phone = user.phone.replace('+91', '');
          const customerResponse = await axios.get(`${API}/salons/${salonId}/customers/${phone}/packages`);
          customerPackages = (customerResponse.data.customer_packages || []).map(p => ({
            ...p,
            is_custom: true  // Mark as custom for display
          }));
        } catch (error) {
          console.log('No customer packages found');
        }
      }
      
      setAvailablePackages({
        public: publicResponse.data.packages || [],
        customer: customerPackages
      });
      // Customer packages first, then public
      setPackages([...customerPackages, ...(publicResponse.data.packages || [])]);
    } catch (error) {
      console.error('Error fetching packages:', error);
    }
  };

  const fetchCustomerBookings = async () => {
    if (!user || !user.phone) return;

    try {
      const phone = user.phone.replace('+91', '');
      const response = await axios.get(`${API}/salons/${salonId}/customers/${phone}/bookings`);
      setCustomerBookings(response.data.bookings || []);
    } catch (error) {
      console.log('No booking history found');
    }
  };

  const fetchRecentServices = async () => {
    if (!user || !user.phone) return;
    try {
      const phone = user.phone.replace('+91', '');
      const response = await axios.get(`${API}/salons/${salonId}/customers/${phone}/recent-services`);
      setRecentServices(response.data.recent_services || []);
      // If there are recent services, default to 'recent' tab, otherwise 'services'
      if ((response.data.recent_services || []).length > 0) {
        setServiceTab('recent');
      } else {
        setServiceTab('services');
      }
    } catch (error) {
      console.log('No recent services found');
      setServiceTab('services');
    }
  };

  const fetchMembershipPlans = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/membership-plans`);
      setMembershipPlans(response.data.plans || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  const fetchCustomerMembership = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/customer-membership/${user.phone}`);
      if (response.data.has_membership) {
        setCustomerMembership(response.data);
      }
    } catch (error) {
      console.error('Error fetching membership:', error);
    }
  };

  const handlePackageSelect = (pkg) => {
    if (selectedPackage?.id === pkg.id) {
      // Deselect package
      setSelectedPackage(null);
      setFormData(prev => ({ ...prev, selectedServices: [] }));
    } else {
      // Select package and auto-select all its services
      setSelectedPackage(pkg);
      // CustomerPackage uses service_id, SalonPackage uses id
      const serviceIds = pkg.services?.map(s => s.id || s.service_id) || [];
      setFormData(prev => ({ ...prev, selectedServices: serviceIds }));
      toast.success(`Package "${pkg.package_name}" selected`);
    }
  };

  // Get available shifts for a date
  const getShiftAvailability = (shiftId) => {
    const currentHour = getCurrentHourIST();
    const isToday = formData.date === getTodayIST();
    
    if (!isToday) return true;

    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return false;
    
    const timeParts = shift.time.split(' - ');
    if (timeParts.length !== 2) return true;
    
    const endTimeStr = timeParts[1].trim();
    const endMatch = endTimeStr.match(/(\d+)\s*(AM|PM)/i);
    if (!endMatch) return true;
    
    let endHour = parseInt(endMatch[1]);
    const period = endMatch[2].toUpperCase();
    
    if (period === 'PM' && endHour !== 12) endHour += 12;
    else if (period === 'AM' && endHour === 12) endHour = 0;
    
    return currentHour < endHour;
  };

  const calculateTotal = () => {
    if (formData.selectedServices.length === 0) {
      setTotalAmount(0);
      return;
    }
    let total = 0;
    const serviceList = (fastestAvailable || formData.barberId === 'any') ? salonServices : barberServices;
    formData.selectedServices.forEach(serviceId => {
      const service = serviceList.find(s => s.id === serviceId);
      if (service) {
        total += (fastestAvailable || formData.barberId === 'any') 
          ? service.base_price 
          : (service.barber_price || service.base_price);
      }
    });
    setTotalAmount(total);
  };

  const handleServiceToggle = (serviceId) => {
    setFormData(prev => ({
      ...prev,
      selectedServices: prev.selectedServices.includes(serviceId)
        ? prev.selectedServices.filter(id => id !== serviceId)
        : [...prev.selectedServices, serviceId]
    }));
  };

  const handleBarberSelect = (barberId) => {
    setFastestAvailable(false);
    setFormData(prev => ({ ...prev, barberId }));
  };

  // Check if any selected service has price_type='onwards' → force Pay at Salon
  const hasOnwardsSelected = (() => {
    if (formData.selectedServices.length === 0) return false;
    const serviceList = (fastestAvailable || formData.barberId === 'any') ? salonServices : barberServices;
    return formData.selectedServices.some(sid => {
      const svc = serviceList.find(s => s.id === sid);
      return svc && svc.price_type === 'onwards';
    });
  })();

  // Auto-switch to pay_later when an onwards service is selected and another mode was active
  useEffect(() => {
    if (hasOnwardsSelected && paymentMode && paymentMode !== 'pay_later') {
      setPaymentMode('pay_later');
      setUpiAppOpened(false);
      toast.info("'Pay at Salon' is the only option because you selected a service with price 'Onwards'.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasOnwardsSelected]);

  const handleFastestAvailable = () => {
    setFastestAvailable(true);
    setFormData(prev => ({ ...prev, barberId: 'any' }));
  };

  const getServicePrice = (service) => {
    return (fastestAvailable || formData.barberId === 'any') 
      ? service.base_price 
      : (service.barber_price || service.base_price);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!formData.shift) {
      toast.error('Please select a time slot');
      return;
    }

    if (formData.selectedServices.length === 0) {
      toast.error('Please select at least one service');
      return;
    }

    if (!paymentMode) {
      toast.error('Please select a payment mode');
      return;
    }

    // Wallet balance check
    if (paymentMode === 'wallet') {
      const walletBalance = customerMembership?.wallet_balance || 0;
      if (walletBalance < totalAmount) {
        toast.error(`Insufficient wallet balance. Available: ₹${walletBalance}, Required: ₹${totalAmount}`);
        return;
      }
    }

    setLoading(true);

    try {
      const bookingData = {
        salon_id: salonId,
        user_id: user.id,
        customer_name: bookingForSelf ? user.name : otherPersonName,
        phone: bookingForSelf ? user.phone : otherPersonPhone,
        date: formData.date,
        shift: formData.shift,
        barber_id: fastestAvailable ? 'any' : formData.barberId,
        selected_services: formData.selectedServices,
        source: source,
        booking_type: formData.bookingType,
        booking_for_self: bookingForSelf,
        customer_gender: bookingForSelf ? (user.gender || 'Men') : otherPersonGender,
        payment_mode: paymentMode
      };

      const response = await axios.post(`${API}/bookings`, bookingData);
      setBookedToken(response.data);
      setBookingStep('success');
      
      // Refresh membership data if wallet was used
      if (paymentMode === 'wallet') {
        fetchCustomerMembership();
      }
      
      toast.success('Booking confirmed!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  // Add bookingStep state
  const [bookingStep, setBookingStep] = useState('services'); // 'services' | 'payment' | 'success'

  // UPI intent handler
  const handleUpiIntent = () => {
    if (!salon?.upi_id) {
      toast.error('Salon UPI ID not configured');
      return;
    }
    const upiUrl = `upi://pay?pa=${salon.upi_id}&pn=${encodeURIComponent(salon.salon_name)}&am=${totalAmount}&cu=INR&tn=Booking_${salonId.slice(0,8)}`;
    window.location.href = upiUrl;
    // Mark that UPI app was opened
    setUpiAppOpened(true);
  };

  // Handle UPI confirmation by customer
  const handleUpiConfirm = async () => {
    setLoading(true);
    try {
      // First create the booking
      const bookingData = {
        salon_id: salonId,
        user_id: user.id,
        customer_name: bookingForSelf ? user.name : otherPersonName,
        phone: bookingForSelf ? user.phone : otherPersonPhone,
        date: formData.date,
        shift: formData.shift,
        barber_id: fastestAvailable ? 'any' : formData.barberId,
        selected_services: formData.selectedServices,
        source: source,
        booking_type: formData.bookingType,
        booking_for_self: bookingForSelf,
        customer_gender: bookingForSelf ? (user.gender || 'Men') : otherPersonGender,
        payment_mode: 'upi'
      };

      const response = await axios.post(`${API}/bookings`, bookingData);
      
      // Confirm UPI payment on the token
      await axios.post(`${API}/payments/customer-confirm-upi`, {
        token_id: response.data.id,
        upi_reference: 'Customer confirmed'
      });

      setBookedToken(response.data);
      setBookingStep('success');
      toast.success('Booking confirmed with UPI payment!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  // Proceed to payment step
  const goToPayment = () => {
    if (!formData.shift) {
      toast.error('Please select a time slot');
      return;
    }
    if (formData.selectedServices.length === 0) {
      toast.error('Please select at least one service');
      return;
    }
    if (!bookingForSelf) {
      if (!otherPersonName || !otherPersonPhone) {
        toast.error('Please enter name and phone for the person');
        return;
      }
      if (!otherPersonGender) {
        toast.error('Please select gender for the person');
        return;
      }
    }
    setBookingStep('payment');
  };

  // Success Screen
  if (bookingStep === 'success' && bookedToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
            >
              <CheckCircle className="w-20 h-20 text-gold mx-auto mb-4" />
            </motion.div>
            <h2 className="text-3xl font-playfair font-bold text-foreground">You're All Set!</h2>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
            <div className="text-center mb-6">
              <p className="text-muted-foreground text-sm mb-1">Your Token</p>
              <div className="text-6xl font-bebas text-gold">{bookedToken.token_number}</div>
            </div>
            
            <div className="space-y-3 text-sm border-t border-border pt-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-bold text-foreground">{formData.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shift</span>
                <span className="font-bold text-foreground">{bookedToken.shift}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Barber</span>
                <span className="font-bold text-foreground">{bookedToken.barber_name}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-3">
                <span className="text-muted-foreground">Payment</span>
                <span className="font-bold text-foreground capitalize">{paymentMode || 'Pending'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="text-xl font-bold text-gold">₹{bookedToken.total_amount}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button onClick={() => navigate(`/salon/${salonId}`)} className="flex-1 bg-gold text-black hover:bg-gold/90">
              Back to Salon
            </Button>
            <Button onClick={() => navigate('/history')} variant="outline" className="flex-1">
              My Bookings
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const services = (fastestAvailable || formData.barberId === 'any') ? salonServices : barberServices;
  
  // Gender filter: show services matching customer gender + Unisex
  const customerGender = user?.gender || '';
  const genderFilteredServices = services.filter(s => {
    const tag = (s.gender_tag || 'Unisex').toLowerCase();
    if (tag === 'unisex') return true;
    if (!customerGender) return true; // Show all if gender not set
    return tag.toLowerCase() === customerGender.toLowerCase();
  });

  // Filter and group services
  const filteredServices = genderFilteredServices.filter(s => 
    s.service_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const groupedServices = filteredServices.reduce((acc, service) => {
    const category = service.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {});

  // ========== PAYMENT STEP ==========
  if (bookingStep === 'payment') {
    const walletBalance = customerMembership?.wallet_balance || 0;
    const hasWallet = !!customerMembership && walletBalance > 0;
    const walletSufficient = hasWallet && walletBalance >= totalAmount;

    return (
      <div className="min-h-screen bg-background pb-32">
        {/* Header */}
        <div className="bg-card border-b border-border sticky top-0 z-20">
          <div className="max-w-2xl mx-auto flex items-center p-3 gap-3">
            <button onClick={() => { setBookingStep('services'); setPaymentMode(''); setUpiAppOpened(false); }} className="p-2 rounded-full hover:bg-muted">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex-1">
              <span className="font-bold text-foreground">Select Payment</span>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-4 space-y-5">
          {/* Order Summary */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Order Summary</h3>
            <div className="space-y-2">
              {formData.selectedServices.map(sid => {
                const svc = [...salonServices, ...barberServices].find(s => s.id === sid);
                return svc ? (
                  <div key={sid} className="flex justify-between text-sm">
                    <span className="text-foreground">{svc.service_name}</span>
                    <span className="font-medium text-foreground">₹{getServicePrice(svc)}</span>
                  </div>
                ) : null;
              })}
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-bold text-foreground">Total</span>
                <span className="text-xl font-bold text-gold">₹{totalAmount}</span>
              </div>
            </div>
          </div>

          {/* Coupon Code */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-gold text-gold hover:bg-gold/10"
                onClick={() => {
                  if (couponCode) toast.info('Coupon feature coming soon!');
                  else toast.error('Please enter a coupon code');
                }}
              >
                Apply
              </Button>
            </div>
          </div>

          {/* Payment Options */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Choose Payment Method</h3>
            {hasOnwardsSelected && (
              <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
                One or more selected services are priced as <strong>"Onwards"</strong>. Final price will be decided at the salon, so only <strong>Pay at Salon</strong> is available.
              </div>
            )}
            <div className="space-y-3">
              {/* Cash */}
              {!hasOnwardsSelected && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => { setPaymentMode('cash'); setUpiAppOpened(false); }}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
                  paymentMode === 'cash' ? 'bg-gold/10 border-gold shadow-md' : 'bg-card border-border hover:border-gold/40'
                }`}
              >
                <div className="p-3 bg-green-500/10 rounded-full">
                  <Banknote className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground">Cash</p>
                  <p className="text-xs text-muted-foreground">Pay at the salon</p>
                </div>
                {paymentMode === 'cash' && (
                  <div className="w-6 h-6 bg-gold rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-black" />
                  </div>
                )}
              </motion.button>
              )}

              {/* UPI */}
              {!hasOnwardsSelected && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => { setPaymentMode('upi'); setUpiAppOpened(false); }}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
                  paymentMode === 'upi' ? 'bg-gold/10 border-gold shadow-md' : 'bg-card border-border hover:border-gold/40'
                }`}
              >
                <div className="p-3 bg-blue-500/10 rounded-full">
                  <Smartphone className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground">UPI</p>
                  <p className="text-xs text-muted-foreground">Pay via UPI app (GPay, PhonePe, etc.)</p>
                </div>
                {paymentMode === 'upi' && (
                  <div className="w-6 h-6 bg-gold rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-black" />
                  </div>
                )}
              </motion.button>
              )}

              {/* Wallet */}
              {!hasOnwardsSelected && (
              <motion.button
                type="button"
                whileHover={hasWallet ? { scale: 1.01 } : {}}
                whileTap={hasWallet ? { scale: 0.99 } : {}}
                onClick={() => {
                  if (!hasWallet) return;
                  if (!walletSufficient) {
                    toast.error(`Insufficient balance. Available: ₹${walletBalance}, Required: ₹${totalAmount}`);
                    return;
                  }
                  // Require OTP verification for wallet payment
                  if (!isUserOtpVerified) {
                    setShowOtpModal(true);
                    return;
                  }
                  setPaymentMode('wallet');
                  setUpiAppOpened(false);
                }}
                disabled={!hasWallet}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
                  !hasWallet
                    ? 'bg-muted/30 border-border/50 opacity-50 cursor-not-allowed'
                    : paymentMode === 'wallet'
                    ? 'bg-gold/10 border-gold shadow-md'
                    : !walletSufficient
                    ? 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/30'
                    : 'bg-card border-border hover:border-gold/40'
                }`}
              >
                <div className="p-3 bg-gold/10 rounded-full">
                  <Wallet className="w-6 h-6 text-gold" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground">Wallet</p>
                  {hasWallet ? (
                    <>
                      <p className={`text-xs ${walletSufficient ? 'text-green-600' : 'text-red-500'}`}>
                        Balance: ₹{walletBalance} {!walletSufficient && '(Insufficient)'}
                      </p>
                      {!isUserOtpVerified && walletSufficient && (
                        <p className="text-xs text-amber-500 flex items-center gap-1 mt-0.5">
                          <Shield className="w-3 h-3" /> OTP required
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">No active wallet</p>
                  )}
                </div>
                {paymentMode === 'wallet' && (
                  <div className="w-6 h-6 bg-gold rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-black" />
                  </div>
                )}
              </motion.button>
              )}

              {/* Pay later at Salon */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => { setPaymentMode('pay_later'); setUpiAppOpened(false); }}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
                  paymentMode === 'pay_later' ? 'bg-gold/10 border-gold shadow-md' : 'bg-card border-border hover:border-gold/40'
                }`}
              >
                <div className="p-3 bg-purple-500/10 rounded-full">
                  <Clock className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground">Pay later at Salon</p>
                  <p className="text-xs text-muted-foreground">Pay after your service is done</p>
                </div>
                {paymentMode === 'pay_later' && (
                  <div className="w-6 h-6 bg-gold rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-black" />
                  </div>
                )}
              </motion.button>
            </div>
          </div>

          {/* Wallet Deduction Summary */}
          {paymentMode === 'wallet' && walletSufficient && (
            <div className="p-4 bg-gold/10 border border-gold/30 rounded-xl">
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground">Wallet Balance</span>
                <span className="font-bold text-gold">₹{walletBalance}</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-sm text-foreground">Booking Amount</span>
                <span className="font-bold text-red-500">- ₹{totalAmount}</span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gold/20">
                <span className="text-sm font-medium text-foreground">Balance After</span>
                <span className="font-bold text-gold">₹{walletBalance - totalAmount}</span>
              </div>
            </div>
          )}

          {/* UPI Info */}
          {paymentMode === 'upi' && salon?.upi_id && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <p className="text-xs text-muted-foreground">UPI ID: <span className="font-mono font-bold text-foreground">{salon.upi_id}</span></p>
              {upiAppOpened && (
                <p className="text-xs text-green-600 mt-2 font-medium">
                  ✓ UPI app opened. After completing payment, tap the confirm button below.
                </p>
              )}
            </div>
          )}
          {paymentMode === 'upi' && !salon?.upi_id && (
            <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl">
              <p className="text-xs text-red-500">Salon UPI ID not configured. Please choose another payment method.</p>
            </div>
          )}
        </div>

        {/* Sticky Footer - Single Button that changes based on UPI state */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-30">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground text-sm">{formData.selectedServices.length} service(s)</span>
              <span className="text-2xl font-bold text-gold">₹{totalAmount}</span>
            </div>
            {paymentMode === 'upi' ? (
              !upiAppOpened ? (
                <Button
                  type="button"
                  onClick={handleUpiIntent}
                  disabled={!salon?.upi_id}
                  className="w-full bg-blue-600 text-white hover:bg-blue-700 py-5 text-base font-bold rounded-xl disabled:opacity-50"
                >
                  <Smartphone className="w-5 h-5 mr-2" />
                  Open UPI App to Pay ₹{totalAmount}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleUpiConfirm}
                  disabled={loading}
                  className="w-full bg-green-600 text-white hover:bg-green-700 py-5 text-base font-bold rounded-xl disabled:opacity-50"
                >
                  {loading ? 'Confirming...' : (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      I've Paid — Confirm Booking
                    </>
                  )}
                </Button>
              )
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !paymentMode || (paymentMode === 'wallet' && !walletSufficient)}
                className="w-full bg-gold text-black hover:bg-gold/90 py-5 text-base font-bold rounded-xl disabled:opacity-50"
              >
                {loading ? 'Booking...' : paymentMode === 'wallet' ? `Pay ₹${totalAmount} from Wallet` : 'Confirm Booking'}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ========== SERVICES STEP (Main booking form) ==========
  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Compact Header */}
      <div className="bg-card border-b border-border sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center p-3 gap-3">
          <button onClick={() => navigate(`/salon/${salonId}`)} className="p-2 rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            {salon?.logo_url ? (
              <img src={salon.logo_url} alt="" className="w-8 h-8 rounded-full object-cover border border-gold" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
                <Scissors className="w-4 h-4 text-gold" />
              </div>
            )}
            <span className="font-bold text-foreground truncate">{salon?.salon_name}</span>
          </div>
          <button onClick={() => navigate(`/salon/${salonId}`)} className="p-2 rounded-full hover:bg-muted">
            <Home className="w-5 h-5 text-gold" />
          </button>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); goToPayment(); }} className="max-w-2xl mx-auto p-4 space-y-5">
        
        {/* Section 1: Who & When */}
        <div className="space-y-4">
          {/* Booking For */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Booking for</p>
            <div className="flex gap-2 flex-wrap">
              <SelectChip selected={bookingForSelf} onClick={() => setBookingForSelf(true)} icon={User}>
                Myself
              </SelectChip>
              <SelectChip selected={!bookingForSelf} onClick={() => setBookingForSelf(false)} icon={User}>
                Someone Else
              </SelectChip>
            </div>
          </div>

          {/* Someone Else Details */}
          <AnimatePresence>
            {!bookingForSelf && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <input
                    type="text"
                    value={otherPersonName}
                    onChange={(e) => setOtherPersonName(e.target.value)}
                    placeholder="Their name"
                    className="w-full p-3 bg-background border border-border rounded-lg text-foreground text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">+91</span>
                    <input
                      type="tel"
                      value={otherPersonPhone}
                      onChange={(e) => setOtherPersonPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Mobile number"
                      className="flex-1 p-3 bg-background border border-border rounded-lg text-foreground text-sm"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Gender</p>
                    <div className="flex gap-2">
                      {['Men', 'Women'].map(g => (
                        <SelectChip key={g} selected={otherPersonGender === g} onClick={() => setOtherPersonGender(g)}>
                          {g}
                        </SelectChip>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Date Chips */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">When</p>
            <div className="flex gap-2 flex-wrap">
              <SelectChip 
                selected={formData.date === getTodayIST()} 
                onClick={() => setFormData(prev => ({ ...prev, date: getTodayIST(), shift: '', bookingType: 'instant' }))}
                icon={Calendar}
              >
                Today
              </SelectChip>
              <SelectChip 
                selected={formData.date === getTomorrowIST()} 
                onClick={() => setFormData(prev => ({ ...prev, date: getTomorrowIST(), shift: '', bookingType: 'future' }))}
                icon={Calendar}
              >
                Tomorrow
              </SelectChip>
            </div>
          </div>

          {/* Time Slot Chips - Always visible, greyed if unavailable */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Time Slot</p>
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              {shifts.map(shift => {
                const isAvailable = getShiftAvailability(shift.id) && (shift.is_available !== false);
                const isSelected = formData.shift === shift.id;
                return (
                  <button
                    key={shift.id}
                    type="button"
                    onClick={() => isAvailable && setFormData(prev => ({ ...prev, shift: shift.id }))}
                    disabled={!isAvailable}
                    className={`relative flex flex-col items-center justify-center px-3 py-2 rounded-xl border-2 transition-all ${
                      !isAvailable
                        ? 'bg-muted/50 text-muted-foreground/50 border-border/50 cursor-not-allowed opacity-50'
                        : isSelected
                        ? 'bg-gold text-black border-gold shadow-lg shadow-gold/20'
                        : 'bg-background text-foreground border-border hover:border-gold/50 active:scale-[0.98]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold leading-tight">
                      <Clock className="w-3.5 h-3.5" />
                      {shift.name}
                    </span>
                    {shift.time && (
                      <span className={`text-[10px] mt-0.5 leading-none ${
                        isSelected ? 'text-black/75' : 'text-muted-foreground'
                      }`}>
                        {shift.time}
                      </span>
                    )}
                    {isSelected && isAvailable && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {formData.date === getTodayIST() && !shifts.some(s => getShiftAvailability(s.id)) && (
              <p className="text-xs text-orange-500 mt-2">All slots passed for today. Select tomorrow.</p>
            )}
          </div>
        </div>

        {/* Section 2: Barber Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Barber</p>
            <button
              type="button"
              onClick={handleFastestAvailable}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                fastestAvailable 
                  ? 'bg-gold/20 text-gold border border-gold' 
                  : 'bg-muted text-muted-foreground border border-transparent hover:border-gold/30'
              }`}
            >
              <Zap className="w-4 h-4" />
              Fastest Available
              {fastestAvailable && <span className="w-2 h-2 bg-gold rounded-full animate-pulse"></span>}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {barbers.map(barber => (
              <BarberChip
                key={barber.id}
                barber={barber}
                selected={!fastestAvailable && formData.barberId === barber.id}
                onSelect={handleBarberSelect}
                liveStatus={liveStatus}
                slotAvailability={slotAvailability}
              />
            ))}
          </div>
          
          {/* Show if all slots are full */}
          {slotAvailability?.all_slots_full && formData.shift && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-sm text-red-500 font-medium text-center">
                All slots are booked for this time. Please select a different time slot.
              </p>
            </div>
          )}
        </div>

        {/* Section 3: Services with Horizontal Category Filter */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold text-foreground">Select Services</p>
            {formData.selectedServices.length > 0 && (
              <span className="text-xs bg-gold/20 text-gold px-2 py-1 rounded-full">
                {formData.selectedServices.length} selected
              </span>
            )}
          </div>
          
          {/* Horizontal Scrollable Category Filter with Thumbnails */}
          <div className="relative">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {categories.map((cat, idx) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`flex-shrink-0 flex flex-col items-center gap-1 min-w-[80px] transition-all ${
                    selectedCategory === cat.name ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className={`w-16 h-16 rounded-full overflow-hidden border-2 transition-all ${
                    selectedCategory === cat.name 
                      ? 'border-gold shadow-lg shadow-gold/20 bg-blue-100' 
                      : 'border-border/50'
                  }`}>
                    <img 
                      src={cat.thumbnail_url} 
                      alt={cat.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1634449571010-02389ed0f9b0?w=200&h=200&fit=crop';
                      }}
                    />
                  </div>
                  <span className={`text-xs font-medium text-center leading-tight max-w-[80px] ${
                    selectedCategory === cat.name ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {cat.name}
                  </span>
                  {selectedCategory === cat.name && (
                    <div className="w-8 h-0.5 bg-gold rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Category Title with Search and Filter */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">{selectedCategory}</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="p-2 rounded-full border border-border hover:border-gold/50 transition-colors"
                onClick={() => document.getElementById('serviceSearch')?.focus()}
              >
                <Search className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Search Input (hidden by default, shown when search icon clicked) */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="serviceSearch"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10"
            />
          </div>

          {/* Services List for Selected Category */}
          <div className="space-y-2">
            {(() => {
              let displayServices = [];
              
              if (selectedCategory === 'Favorites') {
                // Show favorite/recent services
                const filteredRecent = recentServices.filter(s => {
                  const tag = (s.gender_tag || 'Unisex').toLowerCase();
                  if (tag === 'unisex') return true;
                  if (!customerGender) return true;
                  return tag.toLowerCase() === customerGender.toLowerCase();
                });
                displayServices = filteredRecent;
                
                if (displayServices.length === 0) {
                  return (
                    <div className="text-center py-8 bg-card border border-border rounded-xl">
                      <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No favorites yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Your frequently used services will appear here</p>
                    </div>
                  );
                }
              } else if (selectedCategory === 'Packages') {
                // Show packages
                return packages.length > 0 ? (
                  <>
                    {selectedPackage && (
                      <div className="text-xs bg-gold/20 text-gold px-3 py-1.5 rounded-lg text-center font-medium">
                        Package Selected: {selectedPackage.package_name}
                      </div>
                    )}
                    {packages.map(pkg => {
                      const pkgPrice = pkg.total_price || pkg.total_discounted || pkg.package_price || 0;
                      const pkgOriginalPrice = pkg.total_original || pkg.original_price || null;
                      const isCustom = pkg.is_custom;
                      
                      return (
                        <motion.div
                          key={pkg.id}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => handlePackageSelect(pkg)}
                          className={`relative p-4 rounded-xl cursor-pointer transition-all border-2 ${
                            selectedPackage?.id === pkg.id
                              ? 'bg-gold/10 border-gold shadow-md'
                              : isCustom
                              ? 'bg-gradient-to-br from-gold/5 to-gold/10 border-gold/40 hover:border-gold'
                              : 'bg-card border-border hover:border-gold/40'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Package className="w-4 h-4 text-gold" />
                                <h4 className="font-bold text-foreground">{pkg.package_name}</h4>
                                {isCustom && (
                                  <span className="text-[10px] bg-gold text-black px-1.5 py-0.5 rounded-full font-bold">
                                    FOR YOU
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {pkg.description || pkg.services?.map(s => s.service_name || s.name).join(', ')}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gold">₹{pkgPrice}</p>
                              {pkgOriginalPrice && pkgOriginalPrice > pkgPrice && (
                                <p className="text-xs text-muted-foreground line-through">₹{pkgOriginalPrice}</p>
                              )}
                            </div>
                          </div>
                          {selectedPackage?.id === pkg.id && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute top-3 right-3 w-6 h-6 bg-gold rounded-full flex items-center justify-center"
                            >
                              <Check className="w-4 h-4 text-black" />
                            </motion.div>
                          )}
                        </motion.div>
                      );
                    })}
                  </>
                ) : (
                  <div className="text-center py-8 bg-card border border-border rounded-xl">
                    <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">No packages available</p>
                  </div>
                );
              } else {
                // Show services for selected category
                displayServices = filteredServices.filter(s => s.category === selectedCategory);
                
                // Apply search filter
                if (searchQuery) {
                  displayServices = displayServices.filter(s => 
                    s.service_name.toLowerCase().includes(searchQuery.toLowerCase())
                  );
                }
                
                if (displayServices.length === 0) {
                  return (
                    <div className="text-center py-8 bg-card border border-border rounded-xl">
                      <Scissors className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">
                        {searchQuery ? 'No services match your search' : 'No services in this category'}
                      </p>
                    </div>
                  );
                }
              }
              
              // Render service cards
              return displayServices.map(service => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  selected={formData.selectedServices.includes(service.id)}
                  onToggle={() => handleServiceToggle(service.id)}
                  price={getServicePrice(service)}
                />
              ));
            })()}
          </div>
        </div>

        {/* Section 4: Payment Mode - REMOVED, moved to separate step */}
      </form>

      {/* Sticky Footer - Proceed to Payment */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-30">
        <div className="max-w-2xl mx-auto">
          {formData.selectedServices.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground text-sm">{formData.selectedServices.length} service(s)</span>
              <span className="text-2xl font-bold text-gold">₹{totalAmount}</span>
            </div>
          )}
          <Button
            type="button"
            onClick={goToPayment}
            disabled={formData.selectedServices.length === 0 || !formData.shift}
            className="w-full bg-gold text-black hover:bg-gold/90 py-5 text-base font-bold rounded-xl disabled:opacity-50"
          >
            Proceed to Payment
          </Button>
        </div>
      </div>

      {/* OTP Verification Modal for Wallet Payment */}
      <AnimatePresence>
        {showOtpModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowOtpModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md"
            >
              <CustomerOtpVerification 
                showAs="card" 
                onVerified={() => {
                  setShowOtpModal(false);
                  setPaymentMode('wallet');
                  setUpiAppOpened(false);
                  toast.success('Phone verified! Wallet payment enabled.');
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
