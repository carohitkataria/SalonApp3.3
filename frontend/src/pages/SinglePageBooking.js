import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Scissors, Calendar, Clock, User, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SinglePageBooking() {
  const { salonId } = useParams();
  const navigate = useNavigate();
  const { user, isUserLoggedIn } = useAuth();
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source') || 'online';

  const [salon, setSalon] = useState(null);
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [barberServices, setBarberServices] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [bookedToken, setBookedToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bookingForSelf, setBookingForSelf] = useState(true);
  const [otherPersonName, setOtherPersonName] = useState('');
  const [otherPersonPhone, setOtherPersonPhone] = useState('');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
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
  }, [isUserLoggedIn, salonId]);

  useEffect(() => {
    if (formData.barberId !== 'any') {
      fetchBarberServices(formData.barberId);
    } else {
      setBarberServices(services);
    }
    // Clear selected services when barber changes
    setFormData(prev => ({ ...prev, selectedServices: [] }));
  }, [formData.barberId, services]);

  useEffect(() => {
    calculateTotal();
  }, [formData.selectedServices, barberServices]);

  const fetchSalonData = async () => {
    try {
      const [salonRes, barbersRes, servicesRes] = await Promise.all([
        axios.get(`${API}/salons/${salonId}`),
        axios.get(`${API}/salons/${salonId}/barbers?available_only=true`), // Only fetch barbers not on leave
        axios.get(`${API}/services`)
      ]);

      setSalon(salonRes.data);
      setBarbers(barbersRes.data);
      setServices(servicesRes.data);
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

  const fetchBarberServices = async (barberId) => {
    try {
      const response = await axios.get(`${API}/barbers/${barberId}/services`);
      // Filter to show only services that are available for this barber
      const availableServices = response.data.filter(s => s.is_available);
      setBarberServices(availableServices);
    } catch (error) {
      console.error('Error fetching barber services:', error);
      setBarberServices([]);
    }
  };

  const calculateTotal = async () => {
    if (formData.selectedServices.length === 0) {
      setTotalAmount(0);
      return;
    }

    let total = 0;

    if (formData.barberId === 'any') {
      // Calculate using base prices for "Any Available" barber
      formData.selectedServices.forEach(serviceId => {
        const service = services.find(s => s.id === serviceId);
        if (service) {
          total += service.base_price;
        }
      });
    } else {
      // Calculate using barber-specific prices
      formData.selectedServices.forEach(serviceId => {
        const service = barberServices.find(s => s.id === serviceId);
        if (service) {
          total += service.barber_price;
        }
      });
    }

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

  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const formatDateLabel = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return date.toLocaleDateString('en-GB', options).replace(/\//g, '-');
  };

  const getBadgeColor = (category) => {
    switch (category) {
      case 'master': return 'bg-gold/20 text-gold border-gold/30';
      case 'star': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
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
      <div className="max-w-4xl mx-auto p-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Scissors className="w-12 h-12 text-gold mx-auto mb-4" />
          <h1 className="text-3xl font-playfair font-bold text-foreground mb-2">Book Your Appointment</h1>
          {salon && <p className="text-muted-foreground">{salon.salon_name}</p>}
        </div>

        {/* Quick Access Links */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/salon/${salonId}/queue`)}
            className="border-gold text-gold hover:bg-gold/10"
          >
            <Clock className="w-4 h-4 mr-2" />
            Live Queue
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/salon/${salonId}/services`)}
            className="border-gold text-gold hover:bg-gold/10"
          >
            <Scissors className="w-4 h-4 mr-2" />
            Browse Services
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Date & Time Selection */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-bold text-card-foreground mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-gold" />
              Date & Time
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Select Date</Label>
                <select
                  value={formData.date}
                  onChange={(e) => {
                    const selectedDate = e.target.value;
                    const today = new Date().toISOString().split('T')[0];
                    setFormData(prev => ({ 
                      ...prev, 
                      date: selectedDate,
                      bookingType: selectedDate === today ? 'instant' : 'future' 
                    }));
                  }}
                  className="w-full p-3 bg-background border border-border rounded-md text-foreground"
                >
                  <option value={new Date().toISOString().split('T')[0]}>
                    Today ({formatDateLabel(new Date().toISOString().split('T')[0])})
                  </option>
                  <option value={getTomorrowDate()}>
                    Tomorrow ({formatDateLabel(getTomorrowDate())})
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
                  {shifts.map(shift => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name} ({shift.time})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Booking For */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-bold text-card-foreground mb-4 flex items-center">
              <User className="w-5 h-5 mr-2 text-gold" />
              Booking For
            </h3>

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
              <div className="space-y-4 pt-4 border-t border-border">
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

          {/* Barber Selection */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-bold text-card-foreground mb-4 flex items-center">
              <User className="w-5 h-5 mr-2 text-gold" />
              Select Barber
            </h3>

            <div className="grid grid-cols-1 gap-3">
              <label className="flex items-center p-4 bg-background border-2 border-border rounded-lg cursor-pointer hover:border-gold transition-colors">
                <input
                  type="radio"
                  name="barber"
                  value="any"
                  checked={formData.barberId === 'any'}
                  onChange={(e) => setFormData({ ...formData, barberId: e.target.value })}
                  className="mr-3"
                />
                <div className="flex-1">
                  <p className="font-bold text-foreground">Any Available Barber</p>
                  <p className="text-sm text-muted-foreground">First available barber will serve you</p>
                </div>
              </label>

              {barbers.map(barber => (
                <label
                  key={barber.id}
                  className="flex items-center p-4 bg-background border-2 border-border rounded-lg cursor-pointer hover:border-gold transition-colors"
                >
                  <input
                    type="radio"
                    name="barber"
                    value={barber.id}
                    checked={formData.barberId === barber.id}
                    onChange={(e) => setFormData({ ...formData, barberId: e.target.value })}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-foreground">{barber.name}</p>
                      <span className={`px-2 py-1 text-xs border rounded ${getBadgeColor(barber.category)}`}>
                        {barber.category === 'master' ? '👑 Master' : barber.category === 'star' ? '⭐ Star' : barber.category}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{barber.experience} years experience</p>
                    {barber.specialization && (
                      <p className="text-xs text-gold mt-1">Speciality: {barber.specialization}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Service Selection */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-bold text-card-foreground mb-4 flex items-center">
              <Scissors className="w-5 h-5 mr-2 text-gold" />
              Select Services
            </h3>

            {formData.barberId === 'any' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {services.map(service => (
                  <label
                    key={service.id}
                    className="flex items-start p-4 bg-background border-2 border-border rounded-lg cursor-pointer hover:border-gold transition-colors"
                  >
                    <Checkbox
                      checked={formData.selectedServices.includes(service.id)}
                      onCheckedChange={() => handleServiceToggle(service.id)}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <p className="font-bold text-foreground">{service.service_name}</p>
                      <p className="text-xs text-muted-foreground mb-1">{service.description}</p>
                      <p className="text-sm text-gold font-bold">Rs. {service.base_price}</p>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {barberServices.length > 0 ? (
                  barberServices.map(service => (
                    <label
                      key={service.id}
                      className="flex items-start p-4 bg-background border-2 border-border rounded-lg cursor-pointer hover:border-gold transition-colors"
                    >
                      <Checkbox
                        checked={formData.selectedServices.includes(service.id)}
                        onCheckedChange={() => handleServiceToggle(service.id)}
                        className="mt-1 mr-3"
                      />
                      <div className="flex-1">
                        <p className="font-bold text-foreground">{service.service_name}</p>
                        <p className="text-xs text-muted-foreground mb-1">{service.description}</p>
                        <p className="text-sm text-gold font-bold">Rs. {service.barber_price}</p>
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
