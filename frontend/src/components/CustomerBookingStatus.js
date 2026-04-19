import { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, Users, Scissors, Loader2, CircleUser, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CustomerBookingStatus({ salonId, userPhone }) {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (salonId && userPhone) {
      fetchBookingStatus();
      // Auto-refresh every 20 seconds to keep queue position live
      const interval = setInterval(fetchBookingStatus, 20000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonId, userPhone]);

  const fetchBookingStatus = async () => {
    try {
      const response = await axios.get(`${API}/customers/${userPhone}/active-bookings`);
      const bookings = response.data.active_bookings || [];
      const salonBooking = bookings.find(b => b.salon_id === salonId);
      setBooking(salonBooking || null);
    } catch (error) {
      console.error('Error fetching booking status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin text-gold" size={32} />
      </div>
    );
  }

  if (!booking) return null;

  const peopleBefore = booking.people_before ?? booking.queue_position ?? 0;
  const barberPosition = booking.barber_position ?? (peopleBefore + 1);
  const waitMinutes = booking.estimated_wait_minutes ?? 0;
  const statusMessage = booking.queue_status_message || '';
  const serving = booking.currently_serving;

  const formatWait = (mins) => {
    if (!mins || mins <= 0) return 'Next!';
    if (mins < 60) return `${mins} mins`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-2xl border-2 border-amber-300 dark:border-amber-700 p-6 mb-6 shadow-lg"
    >
      {/* Header: Total Token + Status */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
            <Scissors className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-amber-600 dark:text-amber-400 font-semibold">Your Booking</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              Total Token: <span className="text-amber-600 dark:text-amber-400">{booking.token_number}</span>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              Barber: <span className="font-semibold text-gray-900 dark:text-white">{booking.barber_name}</span>
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">Position</p>
          <div className="text-4xl font-extrabold text-amber-500 dark:text-amber-400 leading-none">
            #{barberPosition}
          </div>
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className="mb-4 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            {statusMessage}
          </p>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">People Before You</span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {peopleBefore}
          </p>
        </div>

        <div className="bg-amber-100 dark:bg-amber-900/30 rounded-xl p-3 border border-amber-300 dark:border-amber-700">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Estimated Wait</span>
          </div>
          <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
            {formatWait(waitMinutes)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
            <Scissors className="w-4 h-4" />
            <span className="text-xs font-medium">Services</span>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {booking.selected_services?.length || 0}
          </p>
        </div>
      </div>

      {/* Live Chair Status */}
      {serving && serving.token_number && (
        <div className="p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 mb-1">
            <CircleUser className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Currently Serving</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                Token {serving.token_number}
                {serving.services?.length > 0 && (
                  <span className="font-normal text-gray-600 dark:text-gray-400"> • {serving.services.join(', ')}</span>
                )}
              </p>
            </div>
            {typeof booking.approx_finish_minutes === 'number' && booking.approx_finish_minutes >= 0 && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Finish in</p>
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  {formatWait(booking.approx_finish_minutes)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
