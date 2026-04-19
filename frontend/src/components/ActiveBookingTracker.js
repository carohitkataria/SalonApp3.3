import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Store, Clock, Users, Scissors, MapPin, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ActiveBookingTracker({ userPhone, userName }) {
  const navigate = useNavigate();
  const [activeBookings, setActiveBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userPhone) {
      fetchActiveBookings();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPhone]);

  const fetchActiveBookings = async () => {
    try {
      console.log('[ActiveBookingTracker] Fetching bookings for phone:', userPhone);
      const response = await axios.get(`${API}/customers/${userPhone}/active-bookings`);
      console.log('[ActiveBookingTracker] Response:', response.data);
      setActiveBookings(response.data.active_bookings || []);
    } catch (error) {
      console.error('[ActiveBookingTracker] Error fetching active bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const calculateWaitTime = (token) => {
    // Prefer backend-computed wait (75% rule); fall back to 15m/token
    if (typeof token.estimated_wait_minutes === 'number') {
      return Math.max(0, token.estimated_wait_minutes);
    }
    const tokensAhead = token.people_before ?? token.queue_position ?? 0;
    return Math.max(tokensAhead * 15, 5);
  };

  const formatWait = (m) => {
    if (m === 0) return 'Next!';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return mm ? `${h}h ${mm}m` : `${h}h`;
  };

  console.log('[ActiveBookingTracker] Render state:', { loading, activeBookings: activeBookings.length, userPhone });

  if (loading) {
    console.log('[ActiveBookingTracker] Still loading...');
    return null;
  }
  
  if (activeBookings.length === 0) {
    console.log('[ActiveBookingTracker] No active bookings, hiding component');
    return null;
  }

  console.log('[ActiveBookingTracker] Rendering with', activeBookings.length, 'booking(s)');

  return (
    <div className="w-full bg-gradient-to-br from-amber-600 via-yellow-600 to-amber-700 p-6 rounded-b-3xl shadow-2xl" data-testid="active-booking-tracker">
      <div className="max-w-7xl mx-auto">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h2 className="text-white text-2xl font-bold">
            {getGreeting()},
          </h2>
          <h1 className="text-white text-4xl font-extrabold flex items-center gap-2">
            {userName || 'Guest'} ✨
          </h1>
        </motion.div>

        {/* Active Bookings */}
        <div className="space-y-4">
          {activeBookings.map((booking, idx) => (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20"
            >
              {/* Salon Info Header */}
              {booking.salon_details && (
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      <span className="text-green-300 text-xs font-semibold">Salon is Open Now</span>
                    </div>
                    <h3 className="text-white text-xl font-bold">
                      {booking.salon_details.salon_name}
                    </h3>
                    <p className="text-white/70 text-sm flex items-center gap-1 mt-1">
                      <MapPin size={14} />
                      {booking.salon_details.address}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="bg-white/20 text-white px-3 py-1 rounded-full text-sm font-bold border border-white/30">
                      {booking.people_before ?? booking.queue_position ?? 0} ahead of you
                    </div>
                    <div className="bg-white/20 text-white px-3 py-1 rounded-full text-xs font-semibold mt-2 border border-white/30">
                      ~{formatWait(calculateWaitTime(booking))} Wait
                    </div>
                  </div>
                </div>
              )}

              {/* Booking Details Card */}
              <div className="bg-white rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-amber-500/10 p-2 rounded-lg">
                      <Scissors className="text-amber-600" size={20} />
                    </div>
                    <span className="text-amber-600 font-semibold">Active Booking</span>
                  </div>
                  <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-bold">
                    Total Token {booking.token_number}
                  </div>
                </div>

                {booking.queue_status_message && (
                  <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold">
                    {booking.queue_status_message}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-600 text-xs mb-1">
                      <Users size={14} />
                      <span>Barber</span>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {booking.barber_name}
                    </p>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-600 text-xs mb-1">
                      <Scissors size={14} />
                      <span>Services</span>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">
                      {booking.selected_services?.length || 0} service(s)
                    </p>
                  </div>

                  <div className="bg-amber-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-600 text-xs mb-1">
                      <Users size={14} />
                      <span>Your Position</span>
                    </div>
                    <p className="font-bold text-amber-600 text-sm">
                      #{booking.barber_position ?? ((booking.people_before ?? 0) + 1)}
                      <span className="ml-1 font-normal text-amber-600/70">
                        ({booking.people_before ?? 0} before you)
                      </span>
                    </p>
                  </div>

                  <div className="bg-amber-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-600 text-xs mb-1">
                      <Clock size={14} />
                      <span>Estimated Wait</span>
                    </div>
                    <p className="font-bold text-amber-600 text-sm">
                      {formatWait(calculateWaitTime(booking))}
                    </p>
                  </div>
                </div>

                {/* View Salon Button */}
                <Button
                  onClick={() => navigate(`/salon/${booking.salon_id}`)}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
                  data-testid="view-salon-btn"
                >
                  <Store size={20} />
                  View Salon
                  <ChevronRight size={20} />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
