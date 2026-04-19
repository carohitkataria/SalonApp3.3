import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Eye, Clock, Users, Scissors, MapPin, ChevronRight } from 'lucide-react';
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
    }
  }, [userPhone]);

  const fetchActiveBookings = async () => {
    try {
      const response = await axios.get(`${API}/customers/${userPhone}/active-bookings`);
      setActiveBookings(response.data.active_bookings || []);
    } catch (error) {
      console.error('Error fetching active bookings:', error);
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
    // Rough estimate: 15 mins per token ahead
    const tokensAhead = token.queue_position || 0;
    return Math.max(tokensAhead * 15, 5);
  };

  const getServiceNames = async (serviceIds) => {
    try {
      const services = await Promise.all(
        serviceIds.map(async (id) => {
          const res = await axios.get(`${API}/services/${id}`);
          return res.data.service_name;
        })
      );
      return services.join(', ');
    } catch {
      return 'Services';
    }
  };

  if (loading) return null;
  if (activeBookings.length === 0) return null;

  return (
    <div className="w-full bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 p-6 rounded-b-3xl shadow-2xl">
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
                    <div className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full text-sm font-bold border border-yellow-400/30">
                      {booking.queue_position || 0} In Queue
                    </div>
                    <div className="bg-red-500/20 text-red-300 px-3 py-1 rounded-full text-xs font-semibold mt-2 border border-red-400/30">
                      ~{calculateWaitTime(booking)}m Wait
                    </div>
                  </div>
                </div>
              )}

              {/* Booking Details Card */}
              <div className="bg-white rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-pink-500/10 p-2 rounded-lg">
                      <Scissors className="text-pink-600" size={20} />
                    </div>
                    <span className="text-pink-600 font-semibold">Active Booking</span>
                  </div>
                  <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-bold">
                    Token #{booking.token_number}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-600 text-xs mb-1">
                      <Scissors size={14} />
                      <span>Service</span>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">
                      {booking.selected_services?.length || 0} service(s)
                    </p>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-gray-600 text-xs mb-1">
                      <Users size={14} />
                      <span>Barber</span>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {booking.barber_name}
                    </p>
                  </div>

                  <div className="bg-pink-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-pink-600 text-xs mb-1">
                      <Clock size={14} />
                      <span>Wait Time</span>
                    </div>
                    <p className="font-bold text-pink-600 text-sm">
                      ~{calculateWaitTime(booking)} min wait
                    </p>
                  </div>

                  <div className="bg-purple-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-purple-600 text-xs mb-1">
                      <Users size={14} />
                      <span>Queue Position</span>
                    </div>
                    <p className="font-bold text-purple-600 text-sm">
                      {booking.queue_position || 0} ahead of you
                    </p>
                  </div>
                </div>

                {/* Track Button */}
                <Button
                  onClick={() => navigate(`/token/${booking.id}`)}
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <Eye size={20} />
                  Track My Token
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
