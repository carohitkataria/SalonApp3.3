import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Scissors, Calendar, User, CheckCircle, Star, Clock, ArrowLeft, Home, Zap, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
const SelectChip = ({ selected, onClick, children, icon: Icon, premium = false }) => (
  <motion.button
    type="button"
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`relative px-4 py-2.5 rounded-full border-2 transition-all flex items-center gap-2 text-sm font-medium ${
      selected
        ? 'bg-gold text-black border-gold shadow-lg shadow-gold/20'
        : 'bg-background text-foreground border-border hover:border-gold/50'
    } ${premium ? 'ring-1 ring-gold/30' : ''}`}
  >
    {Icon && <Icon className="w-4 h-4" />}
    {children}
    {selected && (
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
    className={`relative p-4 rounded-xl cursor-pointer transition-all border-2 ${
      selected
        ? 'bg-gold/10 border-gold shadow-md'
        : 'bg-card border-border hover:border-gold/40'
    }`}
  >
    <div className="flex justify-between items-start">
      <div className="flex-1">
        <h4 className="font-bold text-foreground">{service.service_name}</h4>
        {service.default_duration && (
          <p className="text-xs text-muted-foreground flex items-center mt-1">
            <Clock className="w-3 h-3 mr-1" /> {service.default_duration} mins
          </p>
        )}
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-gold">₹{price}</p>
      </div>
    </div>
    {selected && (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="absolute top-2 right-2 w-6 h-6 bg-gold rounded-full flex items-center justify-center"
      >
        <Check className="w-4 h-4 text-black" />
      </motion.div>
    )}
  </motion.div>
);

// Barber Selection Component
const BarberChip = ({ barber, selected, onSelect, liveStatus }) => {
  const status = liveStatus?.barbers?.find(b => b.barber_id === barber.id);
  const waitingCount = status?.waiting_count || 0;
  
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(barber.id)}
      className={`relative p-3 rounded-xl border-2 transition-all text-left ${
        selected
          ? 'bg-gold/10 border-gold shadow-md'
          : 'bg-card border-border hover:border-gold/40'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0 border-2 border-gold/30">
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
            <span className="text-xs text-muted-foreground">• {waitingCount} waiting</span>
          </div>
        </div>
      </div>
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 w-5 h-5 bg-gold rounded-full flex items-center justify-center"
        >
          <Check className="w-3 h-3 text-black" />
        </motion.div>
      )}
    </motion.button>
  );
};

export default function SinglePageBooking() {
  const { salonId } = useParams();
  const navigate = useNavigate();
  const { user, isUserLoggedIn } = useAuth();
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source') || 'online';

  const [salon, setSalon] = useState(null);
  const [barbers, setBarbers] = useState([]);
  const [salonServices, setSalonServices] = useState([]);
  const [barberServices, setBarberServices] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [liveStatus, setLiveStatus] = useState(null);
  const [bookedToken, setBookedToken] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [bookingForSelf, setBookingForSelf] = useState(true);
  const [otherPersonName, setOtherPersonName] = useState('');
  const [otherPersonPhone, setOtherPersonPhone] = useState('');
  const [otherPersonGender, setOtherPersonGender] = useState('');
  const [fastestAvailable, setFastestAvailable] = useState(true);

  const [formData, setFormData] = useState({
    date: getTodayIST(),
    shift: '',
    barberId: 'any',
    selectedServices: [],
    bookingType: 'instant'
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

  const fetchBarberServices = async (barberId) => {
    try {
      const response = await axios.get(`${API}/barbers/${barberId}/services`);
      setBarberServices(response.data.filter(s => s.is_available));
    } catch (error) {
      setBarberServices([]);
    }
  };

  // Filter shifts based on current time
  const availableShifts = useMemo(() => {
    const currentHour = getCurrentHourIST();
    const isToday = formData.date === getTodayIST();
    
    if (!isToday) return shifts;

    return shifts.filter(shift => {
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
    });
  }, [shifts, formData.date]);

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

  return (
    <div className="min-h-screen bg-background">
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

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-4 space-y-6">
        
        {/* Section 1: Who & When */}
        <div className="space-y-4">
          {/* Booking For - Chips */}
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
                    className="w-full p-3 bg-background border border-border rounded-lg text-foreground"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">+91</span>
                    <input
                      type="tel"
                      value={otherPersonPhone}
                      onChange={(e) => setOtherPersonPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Mobile number"
                      className="flex-1 p-3 bg-background border border-border rounded-lg text-foreground"
                    />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Gender</p>
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

          {/* Shift Chips */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Time Slot</p>
            {availableShifts.length > 0 ? (
              <div className="flex gap-2 flex-wrap">
                {availableShifts.map(shift => (
                  <SelectChip
                    key={shift.id}
                    selected={formData.shift === shift.id}
                    onClick={() => setFormData(prev => ({ ...prev, shift: shift.id }))}
                    icon={Clock}
                  >
                    {shift.name}
                  </SelectChip>
                ))}
              </div>
            ) : (
              <p className="text-sm text-orange-500 bg-orange-500/10 p-3 rounded-lg">
                No slots available for today. Try tomorrow!
              </p>
            )}
          </div>
        </div>

        {/* Section 2: Barber Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Choose Barber</p>
            {/* Fastest Available Toggle */}
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
              {fastestAvailable && (
                <span className="w-2 h-2 bg-gold rounded-full animate-pulse"></span>
              )}
            </button>
          </div>

          {/* Barber Grid */}
          <div className="grid grid-cols-2 gap-3">
            {barbers.map(barber => (
              <BarberChip
                key={barber.id}
                barber={barber}
                selected={!fastestAvailable && formData.barberId === barber.id}
                onSelect={handleBarberSelect}
                liveStatus={liveStatus}
              />
            ))}
          </div>
        </div>

        {/* Section 3: Services */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Select Services</p>
          <div className="grid gap-3">
            {services.length > 0 ? (
              services.map(service => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  selected={formData.selectedServices.includes(service.id)}
                  onToggle={() => handleServiceToggle(service.id)}
                  price={(fastestAvailable || formData.barberId === 'any') 
                    ? service.base_price 
                    : (service.barber_price || service.base_price)}
                />
              ))
            ) : (
              <p className="text-center text-muted-foreground py-6">Loading services...</p>
            )}
          </div>
        </div>

        {/* Sticky Footer with Total & Book Button */}
        <div className="sticky bottom-0 left-0 right-0 bg-background border-t border-border -mx-4 px-4 py-4 mt-6">
          <div className="max-w-2xl mx-auto">
            {formData.selectedServices.length > 0 && (
              <div className="flex items-center justify-between mb-3">
                <span className="text-muted-foreground">{formData.selectedServices.length} service(s)</span>
                <span className="text-2xl font-bold text-gold">₹{totalAmount}</span>
              </div>
            )}
            <Button
              type="submit"
              disabled={loading || formData.selectedServices.length === 0 || !formData.shift}
              className="w-full bg-gold text-black hover:bg-gold/90 py-5 text-base font-bold rounded-xl disabled:opacity-50"
            >
              {loading ? 'Booking...' : 'Confirm Booking'}
            </Button>
            {(fastestAvailable || formData.barberId === 'any') && formData.selectedServices.length > 0 && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                * Price may vary based on assigned barber
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
