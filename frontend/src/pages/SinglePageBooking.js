import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Scissors, Calendar, User, CheckCircle, Star, Clock, ArrowLeft, Home, Zap, Check, ChevronDown, ChevronRight, Search, Package, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import CustomerWalletCard from '@/components/CustomerWalletCard';
import WalletDisplay from '@/components/WalletDisplay';

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
const ServiceCard = ({ service, selected, onToggle, price }) => (
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
        <p className="text-base font-bold text-gold">₹{price}</p>
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
          <p className="font-bold text-foreground text-sm truncate">{barber.name}</p>
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
  const { user, isUserLoggedIn } = useAuth();
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source') || 'online';
  const forSelf = searchParams.get('for') === 'self';
  const whenParam = searchParams.get('when');
  const preselectedBarber = searchParams.get('barber');
  const preselectedServices = searchParams.get('services');

  const [salon, setSalon] = useState(null);
  const [barbers, setBarbers] = useState([]);
  const [salonServices, setSalonServices] = useState([]);
  const [packages, setPackages] = useState([]); // New: salon packages
  const [selectedPackage, setSelectedPackage] = useState(null); // New: selected package
  const [customerMembership, setCustomerMembership] = useState(null);
  const [showMembershipShop, setShowMembershipShop] = useState(false);
  const [membershipPlans, setMembershipPlans] = useState([]); // New: customer wallet
  const [useWallet, setUseWallet] = useState(false); // New: use wallet checkbox
  const [barberServices, setBarberServices] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [liveStatus, setLiveStatus] = useState(null);
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
    const interval = setInterval(fetchLiveStatus, 30000);
    return () => clearInterval(interval);
  }, [isUserLoggedIn, salonId]);

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
      const [salonRes, barbersRes, servicesRes] = await Promise.all([
        axios.get(`${API}/salons/${salonId}`),
        axios.get(`${API}/salons/${salonId}/barbers?available_only=true`),
        axios.get(`${API}/salons/${salonId}/services/enabled`)
      ]);
      setSalon(salonRes.data);
      setBarbers(barbersRes.data);
      setSalonServices(servicesRes.data);
    } catch (error) {
      console.error('Error fetching salon data:', error);
      toast.error('Failed to load salon information');
    }
  };

  const fetchShifts = async () => {
    try {
      const response = await axios.get(`${API}/shifts`);
      setShifts(response.data.shifts);
    } catch (error) {
      console.error('Error fetching shifts:', error);
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
          const customerResponse = await axios.get(`${API}/salons/${salonId}/customers/${user.phone}/packages`);
          customerPackages = customerResponse.data.customer_packages || [];
        } catch (error) {
          console.log('No customer packages found');
        }
      }
      
      // Combine both package types
      const allPackages = [
        ...(publicResponse.data.packages || []),
        ...customerPackages
      ];
      
      setPackages(allPackages);
    } catch (error) {
      console.error('Error fetching packages:', error);
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
      const serviceIds = pkg.services?.map(s => s.id) || [];
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
    e.preventDefault();

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
      if (otherPersonPhone.length < 10) {
        toast.error('Please enter a valid 10-digit phone number');
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
        customer_gender: bookingForSelf ? (user.gender || 'Men') : otherPersonGender
      };

      const response = await axios.post(`${API}/bookings`, bookingData);
      setBookedToken(response.data);
      toast.success('Booking confirmed!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  // Success Screen
  if (bookedToken) {
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
  
  // Filter and group services
  const filteredServices = services.filter(s => 
    s.service_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const groupedServices = filteredServices.reduce((acc, service) => {
    const category = service.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {});

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

      {/* Customer Wallet Card */}
      <div className="max-w-2xl mx-auto p-4 pt-6">
        {user && customerMembership && (
          <CustomerWalletCard membership={customerMembership} />
        )}
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-4 space-y-5">
        
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
            <div className="flex gap-2 flex-wrap">
              {shifts.map(shift => {
                const isAvailable = getShiftAvailability(shift.id);
                return (
                  <SelectChip
                    key={shift.id}
                    selected={formData.shift === shift.id}
                    onClick={() => setFormData(prev => ({ ...prev, shift: shift.id }))}
                    icon={Clock}
                    disabled={!isAvailable}
                  >
                    {shift.name}
                  </SelectChip>
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

        {/* Section 2.5: Packages */}
        {packages.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Package className="w-4 h-4" />
                Packages
              </p>
              {selectedPackage && (
                <span className="text-xs bg-gold/20 text-gold px-2 py-1 rounded-full">
                  Package Selected
                </span>
              )}
            </div>
            
            <div className="space-y-2">
              {packages.map(pkg => (
                <motion.div
                  key={pkg.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handlePackageSelect(pkg)}
                  className={`relative p-4 rounded-xl cursor-pointer transition-all border-2 ${
                    selectedPackage?.id === pkg.id
                      ? 'bg-gold/10 border-gold shadow-md'
                      : 'bg-card border-border hover:border-gold/40'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="font-bold text-foreground">{pkg.package_name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {pkg.services?.length || 0} services • {pkg.gender_tag || 'Unisex'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-gold">₹{pkg.package_price}</p>
                      {pkg.original_price && pkg.original_price > pkg.package_price && (
                        <p className="text-xs line-through text-muted-foreground">₹{pkg.original_price}</p>
                      )}
                    </div>
                  </div>
                  
                  {pkg.description && (
                    <p className="text-sm text-muted-foreground mb-2">{pkg.description}</p>
                  )}
                  
                  {/* Package Services */}
                  {pkg.services && pkg.services.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Includes:</p>
                      <div className="flex flex-wrap gap-1">
                        {pkg.services.map((service, idx) => (
                          <span key={idx} className="text-xs bg-muted px-2 py-1 rounded">
                            {service.service_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
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
              ))}
            </div>
            
            <p className="text-xs text-muted-foreground text-center">
              Select a package or choose individual services below
            </p>
          </div>
        )}

        {/* Section 3: Services with Filters and Categories */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Services</p>
            {formData.selectedServices.length > 0 && (
              <span className="text-xs bg-gold/20 text-gold px-2 py-1 rounded-full">
                {formData.selectedServices.length} selected
              </span>
            )}
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10"
            />
          </div>

          {/* Categorized Services */}
          <div className="space-y-2">
            {Object.keys(groupedServices).length > 0 ? (
              Object.entries(groupedServices).map(([category, categoryServices]) => (
                <CategorySection
                  key={category}
                  category={category}
                  services={categoryServices}
                  selectedServices={formData.selectedServices}
                  onToggle={handleServiceToggle}
                  priceGetter={getServicePrice}
                  isOpen={openCategories[category] || false}
                  onToggleOpen={() => setOpenCategories(prev => ({ ...prev, [category]: !prev[category] }))}
                />
              ))
            ) : (
              <div className="text-center py-8 bg-card border border-border rounded-xl">
                <Scissors className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">
                  {searchQuery ? 'No services match your search' : 'No services available'}
                </p>
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-30">
        <div className="max-w-2xl mx-auto">
          {formData.selectedServices.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground text-sm">{formData.selectedServices.length} service(s)</span>
              <span className="text-2xl font-bold text-gold">₹{totalAmount}</span>
            </div>
          )}
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || formData.selectedServices.length === 0 || !formData.shift}
            className="w-full bg-gold text-black hover:bg-gold/90 py-5 text-base font-bold rounded-xl disabled:opacity-50"
          >
            {loading ? 'Booking...' : 'Confirm Booking'}
          </Button>
        </div>
      </div>
    </div>
  );
}
