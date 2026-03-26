import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Calendar, Clock, Scissors, ChevronRight, CheckCircle, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isUserLoggedIn } = useAuth();
  const source = searchParams.get('source') || 'online';
  
  // For QR walk-in, auto-fill with current date/time
  const isQRWalkin = source === 'qr_walkin';
  const getCurrentTime = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = Math.floor(now.getMinutes() / 20) * 20; // Round to nearest 20min slot
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  const [step, setStep] = useState(1);
  const [barbers, setBarbers] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [bookedToken, setBookedToken] = useState(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0], // Always current date
    timeSlot: isQRWalkin ? getCurrentTime() : '', // Auto-fill time for QR
    barberId: '',
    barberName: '',
    source: source
  });

  useEffect(() => {
    if (!isUserLoggedIn) {
      navigate('/user/login');
      return;
    }
    fetchBarbers();
  }, [isUserLoggedIn]);

  useEffect(() => {
    if (formData.date) {
      fetchTimeSlots(formData.date);
    }
  }, [formData.date]);

  const fetchBarbers = async () => {
    try {
      const response = await axios.get(`${API}/barbers`);
      setBarbers(response.data);
    } catch (error) {
      console.error('Error fetching barbers:', error);
      toast.error('Failed to load barbers');
    }
  };

  const fetchTimeSlots = async (date) => {
    try {
      const response = await axios.get(`${API}/time-slots/${date}`);
      setTimeSlots(response.data.slots);
    } catch (error) {
      console.error('Error fetching time slots:', error);
      toast.error('Failed to load time slots');
    }
  };

  const handleBarberSelect = (barber) => {
    setFormData({ ...formData, barberId: barber.id, barberName: barber.name });
    setStep(4);
  };

  const handleSubmit = async () => {
    try {
      const response = await axios.post(`${API}/tokens`, {
        customer_name: user.name,
        phone: user.phone,
        date: formData.date,
        time_slot: formData.timeSlot,
        barber_id: formData.barberId,
        barber_name: formData.barberName,
        source: formData.source,
        user_id: user.id
      });

      setBookedToken(response.data);
      setStep(5);
      toast.success('Token booked successfully!');
    } catch (error) {
      console.error('Error booking token:', error);
      toast.error(error.response?.data?.detail || 'Failed to book token');
    }
  };

  const getBadgeColor = (category) => {
    switch (category) {
      case 'master':
        return 'bg-gold/20 text-gold border-gold/30';
      case 'star':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-zinc-700/20 text-zinc-400 border-zinc-700/30';
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <Calendar className="w-16 h-16 text-gold mx-auto mb-4" />
              <h2 className="text-3xl font-playfair font-bold text-white mb-2">Select Date</h2>
              <p className="text-zinc-400">Choose your preferred day</p>
            </div>

            <div className="space-y-4">
              <input
                type="date"
                data-testid="date-input"
                value={formData.date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-charcoal border border-white/20 px-4 py-4 text-white text-lg focus:border-gold focus:ring-0 focus:outline-none transition-colors"
              />
            </div>

            <Button
              data-testid="next-to-time"
              onClick={() => setStep(2)}
              disabled={!formData.date}
              className="w-full bg-white text-black hover:bg-gray-200 uppercase tracking-widest font-bold py-6 text-lg"
            >
              Next <ChevronRight className="ml-2" />
            </Button>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <Clock className="w-16 h-16 text-gold mx-auto mb-4" />
              <h2 className="text-3xl font-playfair font-bold text-white mb-2">Select Time</h2>
              <p className="text-zinc-400">Choose your slot (20 min)</p>
            </div>

            {timeSlots.length === 0 ? (
              <p className="text-center text-zinc-400">Salon is closed on this day</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                {timeSlots.map((slot) => (
                  <button
                    key={slot}
                    data-testid={`time-slot-${slot}`}
                    onClick={() => {
                      setFormData({ ...formData, timeSlot: slot });
                      setStep(3);
                    }}
                    className="bg-charcoal border border-white/10 hover:border-gold py-4 text-white hover:bg-white/5 transition-all"
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}

            <Button
              data-testid="back-to-date"
              onClick={() => setStep(1)}
              variant="outline"
              className="w-full border-white/20 text-white hover:bg-white/10"
            >
              <ArrowLeft className="mr-2" /> Back
            </Button>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <Scissors className="w-16 h-16 text-gold mx-auto mb-4" />
              <h2 className="text-3xl font-playfair font-bold text-white mb-2">Choose Barber</h2>
              <p className="text-zinc-400">Select your preferred stylist</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {barbers.map((barber) => (
                <button
                  key={barber.id}
                  data-testid={`barber-${barber.name.toLowerCase().replace(' ', '-')}`}
                  onClick={() => handleBarberSelect(barber)}
                  className="bg-charcoal border border-white/10 hover:border-gold p-6 text-left transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{barber.name}</h3>
                      <p className="text-zinc-400 text-sm">{barber.experience} years experience</p>
                      <p className="text-zinc-500 text-xs">{barber.mobile}</p>
                    </div>
                    <div className={`px-3 py-1 border text-xs uppercase tracking-wider ${getBadgeColor(barber.category)}`}>
                      {barber.category === 'master' ? '👑 Master' : barber.category === 'star' ? '⭐ Star' : 'Normal'}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <Button
              data-testid="back-to-time"
              onClick={() => setStep(2)}
              variant="outline"
              className="w-full border-white/20 text-white hover:bg-white/10"
            >
              <ArrowLeft className="mr-2" /> Back
            </Button>
          </motion.div>
        );

      case 4:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <CheckCircle className="w-16 h-16 text-gold mx-auto mb-4" />
              <h2 className="text-3xl font-playfair font-bold text-white mb-2">Confirm Booking</h2>
              <p className="text-zinc-400">Review your details</p>
            </div>

            <div className="glassmorphism rounded-xl p-6 space-y-4">
              <h3 className="text-gold uppercase tracking-widest text-sm font-bold mb-4">Booking Summary</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Name:</span>
                  <span className="text-white font-bold">{user.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Phone:</span>
                  <span className="text-white font-bold">{user.phone}</span>
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex justify-between">
                  <span className="text-zinc-400">Date:</span>
                  <span className="text-white font-bold">{formData.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Time:</span>
                  <span className="text-white font-bold">{formData.timeSlot}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Barber:</span>
                  <span className="text-white font-bold">{formData.barberName}</span>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <Button
                data-testid="back-to-barber"
                onClick={() => setStep(3)}
                variant="outline"
                className="flex-1 border-white/20 text-white hover:bg-white/10"
              >
                <ArrowLeft className="mr-2" /> Back
              </Button>
              <Button
                data-testid="confirm-booking"
                onClick={handleSubmit}
                className="flex-1 bg-gold text-black hover:bg-gold-hover uppercase tracking-widest font-bold"
              >
                Confirm Booking
              </Button>
            </div>
          </motion.div>
        );

      case 5:
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <CheckCircle className="w-24 h-24 text-gold mx-auto mb-4" />
            <h2 className="text-4xl font-playfair font-bold text-white mb-2">Booking Confirmed!</h2>
            
            <div className="glassmorphism rounded-xl p-8 token-glow">
              <p className="text-zinc-400 uppercase tracking-widest text-sm mb-2">Your Token Number</p>
              <div className="text-8xl font-bebas text-gold mb-4">
                {bookedToken?.token_number.toString().padStart(2, '0')}
              </div>
              <div className="h-px w-32 mx-auto bg-gold/30 mb-4" />
              <p className="text-white text-lg mb-2">{user.name}</p>
              <p className="text-zinc-400">{formData.date} • {formData.timeSlot}</p>
              <p className="text-zinc-400">Barber: {formData.barberName}</p>
            </div>

            <p className="text-zinc-400 text-sm max-w-md mx-auto">
              Your booking is confirmed! Check the live dashboard to track your token.
            </p>

            <div className="flex space-x-4">
              <Button
                data-testid="go-home"
                onClick={() => navigate('/')}
                className="flex-1 bg-white text-black hover:bg-gray-200 uppercase tracking-widest font-bold"
              >
                Go Home
              </Button>
              <Button
                data-testid="view-history"
                onClick={() => navigate('/history')}
                variant="outline"
                className="flex-1 border-white/20 text-white hover:bg-white/10 uppercase tracking-widest font-bold"
              >
                View History
              </Button>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  if (!isUserLoggedIn || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-obsidian relative overflow-hidden">
      <div className="grain-overlay" />
      
      <div className="relative z-10 container max-w-2xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <Scissors className="w-12 h-12 text-gold mx-auto mb-4" />
          <h1 className="text-4xl font-playfair font-bold text-white mb-2">Book Your Token</h1>
          {source === 'qr_walkin' && (
            <div className="mt-4">
              <p className="text-gold uppercase tracking-wide text-sm font-bold">Quick Walk-in Booking</p>
              <p className="text-zinc-500 text-xs mt-1">Date & time auto-filled for instant booking</p>
            </div>
          )}
        </div>

        {/* Progress */}
        {step < 5 && (
          <div className="flex justify-center space-x-2 mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1 w-16 rounded-full transition-all ${
                  s <= step ? 'bg-gold' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        )}

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>
      </div>
    </div>
  );
}
