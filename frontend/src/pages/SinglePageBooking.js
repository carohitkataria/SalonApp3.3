import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Scissors, Calendar, User, CheckCircle, Star, Users, Clock, ArrowLeft, Home } from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Helper function to get current time in IST
const getISTDate = () => {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istTime = new Date(utc + istOffset);
  return istTime;
};

// Get today's date in IST as YYYY-MM-DD
const getTodayIST = () => {
  const ist = getISTDate();
  return ist.toISOString().split('T')[0];
};

// Get tomorrow's date in IST as YYYY-MM-DD
const getTomorrowIST = () => {
  const ist = getISTDate();
  ist.setDate(ist.getDate() + 1);
  return ist.toISOString().split('T')[0];
};

// Get current hour in IST (0-23)
const getCurrentHourIST = () => {
  return getISTDate().getHours();
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
  const [bookingForSelf, setBookingForSelf] = useState(true);
  const [otherPersonName, setOtherPersonName] = useState('');
  const [otherPersonPhone, setOtherPersonPhone] = useState('');

  const [formData, setFormData] = useState({
    date: getTodayIST(),
    shift: '',
    barberId: 'any',
    selectedServices: [],
    bookingType: 'instant'
  });

  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    if (!isUserLoggedIn) {
      navigate('/user/login', { state: { from: `/book/${salonId}` } });
      return;
    }

    fetchSalonData();
    fetchShifts();
    fetchLiveStatus();
    
    // Refresh live status every 30 seconds
    const interval = setInterval(fetchLiveStatus, 30000);
    return () => clearInterval(interval);
  }, [isUserLoggedIn, salonId]);

  useEffect(() => {
    if (formData.barberId !== 'any') {
      fetchBarberServices(formData.barberId);
    } else {
      setBarberServices(salonServices);
    }
    // Clear selected services when barber changes
    setFormData(prev => ({ ...prev, selectedServices: [] }));
  }, [formData.barberId, salonServices]);

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
      const availableServices = response.data.filter(s => s.is_available);
      setBarberServices(availableServices);
    } catch (error) {
      console.error('Error fetching barber services:', error);
      setBarberServices([]);
    }
  };

  // Filter shifts based on current time for today
  const availableShifts = useMemo(() => {
    const currentHour = getCurrentHourIST();
    const isToday = formData.date === getTodayIST();
    
    if (!isToday) {
      return shifts; // Show all shifts for future dates
    }

    return shifts.filter(shift => {
      // Parse the end time from the shift time string
      // Format: "7 AM - 11 AM" or "4 PM - 9 PM"
      const timeParts = shift.time.split(' - ');
      if (timeParts.length !== 2) return true;
      
      const endTimeStr = timeParts[1].trim();
      const endMatch = endTimeStr.match(/(\d+)\s*(AM|PM)/i);
      
      if (!endMatch) return true;
      
      let endHour = parseInt(endMatch[1]);
      const period = endMatch[2].toUpperCase();
      
      // Convert to 24-hour format
      if (period === 'PM' && endHour !== 12) {
        endHour += 12;
      } else if (period === 'AM' && endHour === 12) {
        endHour = 0;
      }
      
      // Hide shift if current time has passed the end time
      return currentHour < endHour;
    });
  }, [shifts, formData.date]);

  const calculateTotal = () => {
    if (formData.selectedServices.length === 0) {
      setTotalAmount(0);
      return;
    }

    let total = 0;
    const serviceList = formData.barberId === 'any' ? salonServices : barberServices;

    formData.selectedServices.forEach(serviceId => {
      const service = serviceList.find(s => s.id === serviceId);
      if (service) {
        total += formData.barberId === 'any' ? service.base_price : (service.barber_price || service.base_price);
      }
    });

    setTotalAmount(total);
  };

  const handleServiceToggle = (serviceId) => {
    setFormData(prev => {
      const isSelected = prev.selectedServices.includes(serviceId);
      return {
        ...prev,
        selectedServices: isSelected
          ? prev.selectedServices.filter(id => id !== serviceId)
          : [...prev.selectedServices, serviceId]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.date || !formData.shift) {
      toast.error('Please select date and shift');
      return;
    }

    if (formData.selectedServices.length === 0) {
      toast.error('Please select at least one service');
      return;
    }

    if (!bookingForSelf) {
      if (!otherPersonName || !otherPersonPhone) {
        toast.error('Please enter name and phone for the person you are booking for');
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
        barber_id: formData.barberId,
        selected_services: formData.selectedServices,
        source: source,
        booking_type: formData.bookingType,
        booking_for_self: bookingForSelf
      };

      const response = await axios.post(`${API}/bookings`, bookingData);
      setBookedToken(response.data);
      toast.success('Booking confirmed!');
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const formatDateLabel = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return date.toLocaleDateString('en-GB', options).replace(/\//g, '-');
  };

  // Get barber's live status from liveStatus data
  const getBarberLiveStatus = (barberId) => {
    if (!liveStatus || !liveStatus.barbers) {
      return { currentToken: null, waitingCount: 0, totalTokensToday: 0 };
    }
    const barberStatus = liveStatus.barbers.find(b => b.barber_id === barberId);
    return {
      currentToken: barberStatus?.current_token || null,
      waitingCount: barberStatus?.waiting_count || 0,
      totalTokensToday: barberStatus?.total_tokens_today || 0
    };
  };

  // Barber Card Component
  const BarberCard = ({ barber, isSelected, onSelect }) => {
    const status = getBarberLiveStatus(barber.id);
    
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelect(barber.id)}
        className={`bg-card rounded-xl overflow-hidden shadow-md cursor-pointer transition-all border-2 ${
          isSelected ? 'border-gold ring-2 ring-gold/30' : 'border-border hover:border-gold/50'
        }`}
      >
        {/* Top Section - Profile Info */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Profile Image */}
            <div className="w-16 h-16 rounded-full overflow-hidden bg-muted flex-shrink-0 border-2 border-gold/30">
              {barber.photo_url ? (
                <img 
                  src={barber.photo_url} 
                  alt={barber.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gold/20 to-gold/40">
                  <User className="w-8 h-8 text-gold" />
                </div>
              )}
            </div>
            
            {/* Name and Details */}
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-foreground text-lg truncate">{barber.name}</h4>
              <p className="text-sm text-muted-foreground truncate">
                {barber.specialization || 'General Styling'}
              </p>
              <div className="flex items-center mt-1">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 mr-1" />
                <span className="text-sm font-medium text-foreground">
                  {barber.rating || '4.5'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section - Live Stats */}
        <div className="grid grid-cols-2 border-t border-border">
          {/* Currently Serving */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30">
            <p className="text-xs text-muted-foreground mb-1">Currently Serving</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {status.currentToken ? `#${status.currentToken}` : '-'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {status.waitingCount} waiting
            </p>
          </div>
          
          {/* Total Tokens Today */}
          <div className="p-3 bg-green-50 dark:bg-green-950/30">
            <p className="text-xs text-muted-foreground mb-1">Total Tokens Today</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {status.totalTokensToday || 0}
            </p>
          </div>
        </div>
      </motion.div>
    );
  };

  if (bookedToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <div className="text-center mb-8">
            <CheckCircle className="w-24 h-24 text-gold mx-auto mb-4" />
            <h2 className="text-4xl font-playfair font-bold text-foreground mb-2">Booking Confirmed!</h2>
          </div>

          <div className="bg-card border border-border rounded-lg p-8">
            <p className="text-muted-foreground text-sm mb-2 text-center">Your Token Number</p>
            <div className="text-7xl font-bebas text-gold text-center mb-6">
              {bookedToken.token_number}
            </div>
            
            {bookedToken.token_number.endsWith('000') && (
              <p className="text-sm text-muted-foreground text-center mb-4">
                Token will be assigned at 5:30 AM on {formData.date}
              </p>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span className="text-foreground font-bold">{formData.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shift:</span>
                <span className="text-foreground font-bold">{bookedToken.shift}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Barber:</span>
                <span className="text-foreground font-bold">{bookedToken.barber_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="text-foreground font-bold">Rs. {bookedToken.total_amount}</span>
              </div>
            </div>
          </div>

          <div className="flex space-x-4 mt-6">
            <Button onClick={() => navigate('/')} className="flex-1">
              Go Home
            </Button>
            <Button onClick={() => navigate('/history')} variant="outline" className="flex-1">
              View History
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Back Button */}
      <div className="bg-card border-b border-border sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center p-4 gap-4">
          <button 
            onClick={() => navigate(`/salon/${salonId}`)}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            title="Back to Salon"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          
          <div className="flex items-center gap-3 flex-1">
            {salon?.logo_url ? (
              <img 
                src={salon.logo_url} 
                alt={salon?.salon_name}
                className="w-10 h-10 rounded-full object-cover border-2 border-gold"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
                <Scissors className="w-5 h-5 text-gold" />
              </div>
            )}
            <div>
              <h2 className="font-bold text-foreground">{salon?.salon_name || 'Loading...'}</h2>
              <p className="text-xs text-muted-foreground">Book Appointment</p>
            </div>
          </div>

          <button 
            onClick={() => navigate(`/salon/${salonId}`)}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            title="Salon Homepage"
          >
            <Home className="w-5 h-5 text-gold" />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Scissors className="w-12 h-12 text-gold mx-auto mb-4" />
          <h1 className="text-3xl font-playfair font-bold text-foreground mb-2">Book Your Appointment</h1>
          {salon && <p className="text-muted-foreground">{salon.salon_name}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Date & Time Selection with Booking For */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-bold text-card-foreground mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-gold" />
              Date & Time
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <Label className="mb-2 block">Select Date</Label>
                <select
                  value={formData.date}
                  onChange={(e) => {
                    const selectedDate = e.target.value;
                    const today = getTodayIST();
                    setFormData(prev => ({ 
                      ...prev, 
                      date: selectedDate,
                      shift: '', // Reset shift when date changes
                      bookingType: selectedDate === today ? 'instant' : 'future' 
                    }));
                  }}
                  className="w-full p-3 bg-background border border-border rounded-md text-foreground"
                >
                  <option value={getTodayIST()}>
                    Today ({formatDateLabel(getTodayIST())})
                  </option>
                  <option value={getTomorrowIST()}>
                    Tomorrow ({formatDateLabel(getTomorrowIST())})
                  </option>
                </select>
              </div>

              <div>
                <Label className="mb-2 block">Select Shift</Label>
                <select
                  value={formData.shift}
                  onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                  className="w-full p-3 bg-background border border-border rounded-md text-foreground"
                  required
                >
                  <option value="">Select shift</option>
                  {availableShifts.map(shift => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name} ({shift.time})
                    </option>
                  ))}
                </select>
                {formData.date === getTodayIST() && availableShifts.length === 0 && (
                  <p className="text-xs text-orange-500 mt-1">
                    No shifts available for today. Please select tomorrow.
                  </p>
                )}
              </div>
            </div>

            {/* Booking For Section - Moved here */}
            <div className="pt-4 border-t border-border">
              <h4 className="text-md font-semibold text-card-foreground mb-3 flex items-center">
                <User className="w-4 h-4 mr-2 text-gold" />
                Booking For
              </h4>

              <div className="flex gap-4 mb-4">
                <button
                  type="button"
                  onClick={() => setBookingForSelf(true)}
                  className={`flex-1 py-3 px-4 border-2 rounded-lg transition-all ${
                    bookingForSelf
                      ? 'bg-gold text-black border-gold'
                      : 'bg-background text-foreground border-border hover:border-gold'
                  }`}
                >
                  Myself
                </button>
                <button
                  type="button"
                  onClick={() => setBookingForSelf(false)}
                  className={`flex-1 py-3 px-4 border-2 rounded-lg transition-all ${
                    !bookingForSelf
                      ? 'bg-gold text-black border-gold'
                      : 'bg-background text-foreground border-border hover:border-gold'
                  }`}
                >
                  Someone Else
                </button>
              </div>

              {!bookingForSelf && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                  <div>
                    <Label className="mb-2 block">Person's Name</Label>
                    <input
                      type="text"
                      value={otherPersonName}
                      onChange={(e) => setOtherPersonName(e.target.value)}
                      placeholder="Enter name"
                      className="w-full p-3 bg-background border border-border rounded-md text-foreground"
                      required={!bookingForSelf}
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">Person's Mobile Number</Label>
                    <div className="flex items-center">
                      <span className="text-foreground mr-2">+91</span>
                      <input
                        type="tel"
                        value={otherPersonPhone}
                        onChange={(e) => setOtherPersonPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="10-digit mobile number"
                        className="flex-1 p-3 bg-background border border-border rounded-md text-foreground"
                        required={!bookingForSelf}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Barber Selection with Cards */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-bold text-card-foreground mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-gold" />
              Select Barber
            </h3>

            {/* Any Available Option */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setFormData({ ...formData, barberId: 'any' })}
              className={`mb-4 p-4 bg-background rounded-xl cursor-pointer transition-all border-2 ${
                formData.barberId === 'any' 
                  ? 'border-gold ring-2 ring-gold/30' 
                  : 'border-border hover:border-gold/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold/20 to-gold/40 flex items-center justify-center">
                  <Users className="w-6 h-6 text-gold" />
                </div>
                <div>
                  <p className="font-bold text-foreground">Any Available Barber</p>
                  <p className="text-sm text-muted-foreground">First available barber will serve you</p>
                </div>
              </div>
            </motion.div>

            {/* Barber Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {barbers.map(barber => (
                <BarberCard
                  key={barber.id}
                  barber={barber}
                  isSelected={formData.barberId === barber.id}
                  onSelect={(id) => setFormData({ ...formData, barberId: id })}
                />
              ))}
            </div>

            {barbers.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No barbers available at the moment
              </p>
            )}
          </div>

          {/* Service Selection */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-bold text-card-foreground mb-4 flex items-center">
              <Scissors className="w-5 h-5 mr-2 text-gold" />
              Select Services
            </h3>

            {/* Services Grid */}
            {formData.barberId === 'any' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {salonServices.length > 0 ? (
                  salonServices.map(service => (
                    <label
                      key={service.id}
                      className={`flex items-start p-4 bg-background border-2 rounded-lg cursor-pointer transition-all ${
                        formData.selectedServices.includes(service.id)
                          ? 'border-gold bg-gold/5'
                          : 'border-border hover:border-gold/50'
                      }`}
                    >
                      <Checkbox
                        checked={formData.selectedServices.includes(service.id)}
                        onCheckedChange={() => handleServiceToggle(service.id)}
                        className="mt-1 mr-3"
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-foreground">{service.service_name}</p>
                            {service.category && (
                              <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                                {service.category}
                              </span>
                            )}
                          </div>
                          <p className="text-gold font-bold">₹{service.base_price}</p>
                        </div>
                        {service.description && (
                          <p className="text-xs text-muted-foreground mt-1">{service.description}</p>
                        )}
                        {service.default_duration && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {service.default_duration} mins
                          </p>
                        )}
                      </div>
                    </label>
                  ))
                ) : (
                  <p className="text-muted-foreground col-span-2 text-center py-8">
                    No services available for this salon
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {barberServices.length > 0 ? (
                  barberServices.map(service => (
                    <label
                      key={service.id}
                      className={`flex items-start p-4 bg-background border-2 rounded-lg cursor-pointer transition-all ${
                        formData.selectedServices.includes(service.id)
                          ? 'border-gold bg-gold/5'
                          : 'border-border hover:border-gold/50'
                      }`}
                    >
                      <Checkbox
                        checked={formData.selectedServices.includes(service.id)}
                        onCheckedChange={() => handleServiceToggle(service.id)}
                        className="mt-1 mr-3"
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-foreground">{service.service_name}</p>
                            {service.category && (
                              <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                                {service.category}
                              </span>
                            )}
                          </div>
                          <p className="text-gold font-bold">₹{service.barber_price || service.base_price}</p>
                        </div>
                        {service.description && (
                          <p className="text-xs text-muted-foreground mt-1">{service.description}</p>
                        )}
                        {service.default_duration && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {service.default_duration} mins
                          </p>
                        )}
                      </div>
                    </label>
                  ))
                ) : (
                  <p className="text-muted-foreground col-span-2 text-center py-4">
                    Loading barber services...
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Total Amount */}
          {formData.selectedServices.length > 0 && (
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-6">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-foreground">Total Amount:</span>
                <span className="text-3xl font-bebas text-gold">Rs. {totalAmount}</span>
              </div>
              {formData.barberId === 'any' && (
                <p className="text-xs text-muted-foreground mt-2">
                  * Actual price may vary based on assigned barber
                </p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading || formData.selectedServices.length === 0}
            className="w-full bg-gold text-black hover:bg-gold/90 py-6 text-lg font-bold"
          >
            {loading ? 'Creating Booking...' : 'Confirm Booking'}
          </Button>
        </form>
      </div>
    </div>
  );
}
