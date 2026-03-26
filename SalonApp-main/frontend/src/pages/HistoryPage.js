import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Scissors, Calendar, Clock, User, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import ThemeToggle from '@/components/ThemeToggle';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function HistoryPage() {
  const navigate = useNavigate();
  const { user, isUserLoggedIn } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isUserLoggedIn) {
      navigate('/user/login');
      return;
    }

    if (user) {
      fetchHistory();
    }
  }, [user, isUserLoggedIn]);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API}/user/${user.id}/history`);
      setHistory(response.data);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'waiting':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'in_progress':
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'skipped':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-gray-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'waiting':
        return 'border-yellow-500/30 bg-yellow-500/5';
      case 'in_progress':
        return 'border-blue-500/30 bg-blue-500/5';
      case 'completed':
        return 'border-green-500/30 bg-green-500/5';
      case 'skipped':
        return 'border-red-500/30 bg-red-500/5';
      case 'cancelled':
        return 'border-gray-500/30 bg-gray-500/5';
      default:
        return 'border-border';
    }
  };

  if (!isUserLoggedIn || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Calendar className="w-8 h-8 text-gold" />
              <div>
                <h1 className="text-2xl font-playfair font-bold text-foreground">Booking History</h1>
                <p className="text-xs text-muted-foreground">All your past visits</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <Scissors className="w-16 h-16 text-gold animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading history...</p>
          </div>
        ) : history.length > 0 ? (
          <div className="space-y-4">
            {history.map((booking, index) => (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`bg-card border p-6 rounded-lg ${getStatusColor(booking.status)}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="text-4xl font-bebas text-gold">
                      {booking.token_number > 0 ? booking.token_number.toString().padStart(2, '0') : 'TBA'}
                    </div>
                    <div>
                      <p className="text-foreground font-bold">Token #{booking.token_number}</p>
                      <p className="text-muted-foreground text-sm flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {booking.date} - {booking.time_slot}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(booking.status)}
                    <span className="text-xs uppercase font-bold text-foreground">
                      {booking.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Barber</p>
                    <p className="text-foreground font-bold">{booking.barber_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Amount</p>
                    <p className="text-foreground font-bold">Rs. {booking.total_amount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Services</p>
                    <p className="text-foreground font-bold">{booking.selected_services.length} services</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payment</p>
                    <p className={`font-bold ${
                      booking.payment_status === 'paid' ? 'text-green-500' : 'text-yellow-500'
                    }`}>
                      {booking.payment_status}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-card border border-border rounded-lg">
            <Scissors className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No booking history</p>
            <p className="text-muted-foreground text-sm mt-2">Your bookings will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}