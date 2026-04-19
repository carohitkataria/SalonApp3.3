import { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, Users, Scissors, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CustomerBookingStatus({ salonId, userPhone }) {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (salonId && userPhone) {
      fetchBookingStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonId, userPhone]);

  const fetchBookingStatus = async () => {
    try {
      // Get active bookings
      const response = await axios.get(`${API}/customers/${userPhone}/active-bookings`);
      const bookings = response.data.active_bookings || [];
      
      // Filter for current salon
      const salonBooking = bookings.find(b => b.salon_id === salonId);
      setBooking(salonBooking || null);
    } catch (error) {
      console.error('Error fetching booking status:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateWaitTime = () => {
    if (!booking) return 0;
    
    // If no one ahead, wait time is 0
    if (!booking.queue_position || booking.queue_position === 0) {
      return 0;
    }
    
    // Calculate based on average service time
    // Assuming each service takes ~5 minutes on average
    // Get the number of services in bookings ahead
    const avgServiceTime = 5; // minutes per service
    const servicesAhead = booking.queue_position; // This represents bookings ahead
    
    // Rough estimate: each booking has ~2 services on average
    return Math.max(servicesAhead * avgServiceTime * 2, 5);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  if (!booking) {
    return null; // No active booking at this salon
  }

  const waitTime = calculateWaitTime();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-2xl border-2 border-amber-300 dark:border-amber-700 p-6 mb-6 shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center">
            <Scissors className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-amber-600 dark:text-amber-400 font-semibold">Active Booking</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              You are #{booking.token_number} in queue
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-5xl font-extrabold text-amber-500 dark:text-amber-400">
            #{booking.token_number}
          </div>
        </div>
      </div>

      {/* Token Details */}
      <div className="mb-4 pb-4 border-b border-amber-200 dark:border-amber-800">
        <p className="text-gray-700 dark:text-gray-300">
          <span className="font-semibold">Token:</span> #{booking.token_number} • {booking.shift || 'N/A'}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Service */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
            <Scissors className="w-4 h-4" />
            <span className="text-xs font-medium">Service</span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {booking.selected_services?.length || 0} service(s)
          </p>
        </div>

        {/* Barber */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">Barber</span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white truncate">
            {booking.barber_name}
          </p>
        </div>

        {/* Wait Time */}
        <div className="bg-amber-100 dark:bg-amber-900/30 rounded-xl p-4 border border-amber-300 dark:border-amber-700">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Wait Time</span>
          </div>
          <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
            {waitTime === 0 ? 'Next!' : `~${waitTime} min wait`}
          </p>
        </div>

        {/* Queue Position */}
        <div className="bg-amber-100 dark:bg-amber-900/30 rounded-xl p-4 border border-amber-300 dark:border-amber-700">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">Queue Position</span>
          </div>
          <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
            {booking.queue_position || 0} ahead of you
          </p>
        </div>
      </div>
    </motion.div>
  );
}
