import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Scissors, Calendar, Clock, User, CheckCircle, XCircle, AlertCircle, Star, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from '@/components/ThemeToggle';
import RatingModal from '@/components/RatingModal';
import CustomerOtpVerification from '@/components/CustomerOtpVerification';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import SalonHubLogo from '@/components/SalonHubLogo';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function HistoryPage() {
  const navigate = useNavigate();
  const { user, isUserLoggedIn, isUserOtpVerified } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ratedTokens, setRatedTokens] = useState(new Set());
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    if (!isUserLoggedIn) {
      navigate('/user/login');
      return;
    }

    if (user && isUserOtpVerified) {
      fetchHistory();
    }
  }, [user, isUserLoggedIn, isUserOtpVerified]);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API}/user/${user.id}/history`);
      setHistory(response.data);
      
      const rated = new Set();
      for (const booking of response.data) {
        if (booking.status === 'completed') {
          try {
            const canRateRes = await axios.get(`${API}/tokens/${booking.id}/can-rate`);
            if (canRateRes.data.already_rated) {
              rated.add(booking.id);
            }
          } catch (e) {}
        }
      }
      setRatedTokens(rated);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRateBooking = (booking) => {
    setSelectedBooking(booking);
    setShowRatingModal(true);
  };

  const handleRatingSubmitted = () => {
    setRatedTokens(prev => new Set([...prev, selectedBooking.id]));
    setShowRatingModal(false);
    setSelectedBooking(null);
  };

  const handleCancelBooking = async (bookingId) => {
    setCancellingId(bookingId);
    try {
      await axios.post(`${API}/tokens/${bookingId}/customer-cancel`);
      toast.success('Booking cancelled successfully');
      fetchHistory();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel booking');
    } finally {
      setCancellingId(null);
      setShowCancelModal(false);
      setSelectedBooking(null);
    }
  };

  const handleModifyBooking = (booking) => {
    // Navigate to booking page with existing data
    navigate(`/book/${booking.salon_id}?modify=${booking.id}`);
  };

  const canModifyOrCancel = (booking) => {
    return ['waiting', 'future'].includes(booking.status);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'waiting':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'called':
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      case 'in_progress':
        return <Scissors className="w-5 h-5 text-green-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'skipped':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-gray-500" />;
      case 'future':
        return <Calendar className="w-5 h-5 text-purple-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'waiting':
        return 'border-yellow-500/30 bg-yellow-500/5';
      case 'called':
        return 'border-blue-500/30 bg-blue-500/5';
      case 'in_progress':
        return 'border-green-500/30 bg-green-500/5';
      case 'completed':
        return 'border-green-500/30 bg-green-500/5';
      case 'skipped':
        return 'border-red-500/30 bg-red-500/5';
      case 'cancelled':
        return 'border-gray-500/30 bg-gray-500/5';
      case 'future':
        return 'border-purple-500/30 bg-purple-500/5';
      default:
        return 'border-border';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'waiting':
        return 'In Queue';
      case 'called':
        return 'Your Turn!';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'skipped':
        return 'Skipped';
      case 'cancelled':
        return 'Cancelled';
      case 'future':
        return 'Scheduled';
      default:
        return status;
    }
  };

  if (!isUserLoggedIn || !user) {
    return null;
  }

  // Require OTP verification for history access
  if (!isUserOtpVerified) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border p-4 sticky top-0 bg-background z-10">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => navigate('/salons')}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <div>
                  <h1 className="text-xl font-playfair font-bold text-foreground">My Bookings</h1>
                  <p className="text-xs text-muted-foreground">View & manage your appointments</p>
                </div>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
        <div className="max-w-md mx-auto p-4 pt-8">
          <CustomerOtpVerification showAs="card" onVerified={fetchHistory} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border p-4 sticky top-0 bg-background z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate('/salons')}
                className="p-2 rounded-full hover:bg-muted transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-foreground" />
              </button>
              <div>
                <h1 className="text-xl font-playfair font-bold text-foreground">My Bookings</h1>
                <p className="text-xs text-muted-foreground">View & manage your appointments</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <Scissors className="w-12 h-12 text-gold animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : history.length > 0 ? (
          <div className="space-y-3">
            {history.map((booking, index) => (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`bg-card border-2 rounded-xl overflow-hidden ${getStatusColor(booking.status)}`}
              >
                {/* Header with Token and Status - Clickable */}
                <div 
                  className="flex items-center justify-between p-4 border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => navigate(`/token/${booking.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-3xl font-bebas text-gold">
                      #{booking.token_number || 'TBA'}
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-sm">{booking.salon_name || 'Salon'}</p>
                      <p className="text-xs text-muted-foreground flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {booking.date} • {booking.shift || booking.time_slot}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-background/50">
                    {getStatusIcon(booking.status)}
                    <span className="text-xs font-bold text-foreground uppercase">
                      {getStatusLabel(booking.status)}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Barber</p>
                      <p className="font-bold text-foreground">{booking.barber_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Services</p>
                      <p className="font-bold text-foreground">{booking.selected_services?.length || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Amount</p>
                      <p className="font-bold text-gold">₹{booking.total_amount}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-border/50">
                    {/* Modify/Cancel for active bookings */}
                    {canModifyOrCancel(booking) && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleModifyBooking(booking)}
                          className="flex-1 border-gold/50 text-gold hover:bg-gold/10"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Modify
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setShowCancelModal(true);
                          }}
                          disabled={cancellingId === booking.id}
                          className="flex-1 border-red-500/50 text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          {cancellingId === booking.id ? 'Cancelling...' : 'Cancel'}
                        </Button>
                      </>
                    )}

                    {/* Rating for completed bookings */}
                    {booking.status === 'completed' && (
                      ratedTokens.has(booking.id) ? (
                        <div className="flex items-center text-green-500 text-sm w-full justify-center">
                          <Star className="w-4 h-4 fill-green-500 mr-2" />
                          Rated
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleRateBooking(booking)}
                          variant="outline"
                          size="sm"
                          className="w-full border-gold text-gold hover:bg-gold/10"
                        >
                          <Star className="w-4 h-4 mr-1" />
                          Rate Experience
                        </Button>
                      )
                    )}

                    {/* View salon for past bookings */}
                    {['completed', 'cancelled', 'skipped'].includes(booking.status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/salon/${booking.salon_id}`)}
                        className="flex-1"
                      >
                        View Salon
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-card border border-border rounded-xl">
            <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-foreground font-medium">No bookings yet</p>
            <p className="text-muted-foreground text-sm mt-1">Your appointments will appear here</p>
            <Button 
              onClick={() => navigate('/salons')} 
              className="mt-4 bg-gold text-black hover:bg-gold/90"
            >
              Find a Salon
            </Button>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelModal && selectedBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => {
              setShowCancelModal(false);
              setSelectedBooking(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-2xl p-6 max-w-sm w-full"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">Cancel Booking?</h3>
                <p className="text-muted-foreground text-sm">
                  Are you sure you want to cancel your appointment for {selectedBooking.date}?
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowCancelModal(false);
                    setSelectedBooking(null);
                  }}
                >
                  Keep It
                </Button>
                <Button
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  onClick={() => handleCancelBooking(selectedBooking.id)}
                  disabled={cancellingId === selectedBooking.id}
                >
                  {cancellingId === selectedBooking.id ? 'Cancelling...' : 'Yes, Cancel'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rating Modal */}
      {selectedBooking && !showCancelModal && (
        <RatingModal
          token={selectedBooking}
          isOpen={showRatingModal}
          onClose={() => {
            setShowRatingModal(false);
            setSelectedBooking(null);
          }}
          onRatingSubmitted={handleRatingSubmitted}
        />
      )}
    </div>
  );
}
