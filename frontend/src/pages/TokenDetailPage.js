import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  ArrowLeft, Calendar, Clock, User, Scissors, MapPin, 
  CheckCircle, AlertCircle, XCircle, Phone, CreditCard
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function TokenDetailPage() {
  const { tokenId } = useParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const [salon, setSalon] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTokenDetails();
  }, [tokenId]);

  const fetchTokenDetails = async () => {
    try {
      const response = await axios.get(`${API}/tokens/${tokenId}`);
      setToken(response.data);
      
      // Fetch salon details
      if (response.data.salon_id) {
        const salonRes = await axios.get(`${API}/salons/${response.data.salon_id}`);
        setSalon(salonRes.data);
      }
    } catch (error) {
      console.error('Error fetching token:', error);
      toast.error('Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'waiting':
        return { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'In Queue' };
      case 'called':
        return { icon: AlertCircle, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Your Turn!' };
      case 'in_progress':
        return { icon: Scissors, color: 'text-green-500', bg: 'bg-green-500/10', label: 'In Progress' };
      case 'completed':
        return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Completed' };
      case 'cancelled':
        return { icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-500/10', label: 'Cancelled' };
      case 'skipped':
        return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Skipped' };
      case 'future':
        return { icon: Calendar, color: 'text-purple-500', bg: 'bg-purple-500/10', label: 'Scheduled' };
      default:
        return { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted', label: status };
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    
    try {
      await axios.post(`${API}/tokens/${tokenId}/cancel`);
      toast.success('Booking cancelled');
      fetchTokenDetails();
    } catch (error) {
      toast.error('Failed to cancel booking');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground mb-4">Booking not found</p>
          <Button onClick={() => navigate('/history')}>View All Bookings</Button>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(token.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center p-4 gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-foreground">Booking Details</h1>
            <p className="text-xs text-muted-foreground">Token #{token.token_number}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Token Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl border border-border overflow-hidden"
        >
          {/* Status Banner */}
          <div className={`${statusConfig.bg} p-6 text-center`}>
            <StatusIcon className={`w-12 h-12 ${statusConfig.color} mx-auto mb-3`} />
            <p className="text-6xl font-bebas text-foreground mb-2">#{token.token_number}</p>
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${statusConfig.bg} border border-current/20`}>
              <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
              <span className={`font-bold ${statusConfig.color}`}>{statusConfig.label}</span>
            </span>
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            {/* Salon Info */}
            {salon && (
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                {salon.logo_url ? (
                  <img src={salon.logo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center">
                    <Scissors className="w-6 h-6 text-gold" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-bold text-foreground">{salon.salon_name}</p>
                  <p className="text-xs text-muted-foreground flex items-center">
                    <MapPin className="w-3 h-3 mr-1" />
                    {salon.address}
                  </p>
                </div>
              </div>
            )}

            {/* Booking Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background rounded-xl p-4 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs">Date</span>
                </div>
                <p className="font-bold text-foreground">{token.date}</p>
              </div>

              <div className="bg-background rounded-xl p-4 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs">Shift</span>
                </div>
                <p className="font-bold text-foreground">{token.shift || token.time_slot}</p>
              </div>

              <div className="bg-background rounded-xl p-4 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <User className="w-4 h-4" />
                  <span className="text-xs">Barber</span>
                </div>
                <p className="font-bold text-foreground">{token.barber_name}</p>
              </div>

              <div className="bg-background rounded-xl p-4 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <CreditCard className="w-4 h-4" />
                  <span className="text-xs">Amount</span>
                </div>
                <p className="font-bold text-gold">₹{token.total_amount}</p>
              </div>
            </div>

            {/* Customer Info */}
            <div className="bg-background rounded-xl p-4 border border-border">
              <p className="text-xs text-muted-foreground mb-2">Booked For</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">{token.customer_name}</p>
                    <p className="text-xs text-muted-foreground flex items-center">
                      <Phone className="w-3 h-3 mr-1" />
                      {token.phone}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Services */}
            {token.selected_services && token.selected_services.length > 0 && (
              <div className="bg-background rounded-xl p-4 border border-border">
                <p className="text-xs text-muted-foreground mb-2">Services</p>
                <div className="flex flex-wrap gap-2">
                  {token.selected_services.map((serviceId, idx) => (
                    <span key={idx} className="px-3 py-1 bg-gold/10 text-gold rounded-full text-sm">
                      Service {idx + 1}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Status */}
            <div className="flex items-center justify-between p-4 bg-background rounded-xl border border-border">
              <span className="text-muted-foreground">Payment Status</span>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                token.payment_status === 'paid' 
                  ? 'bg-green-500/10 text-green-500' 
                  : 'bg-yellow-500/10 text-yellow-500'
              }`}>
                {token.payment_status === 'paid' ? 'Paid' : 'Pending'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        {['waiting', 'future'].includes(token.status) && (
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-red-500/50 text-red-500 hover:bg-red-500/10"
              onClick={handleCancel}
            >
              Cancel Booking
            </Button>
            <Button
              className="flex-1 bg-gold text-black hover:bg-gold/90"
              onClick={() => navigate(`/salon/${token.salon_id}`)}
            >
              View Salon
            </Button>
          </div>
        )}

        {token.status === 'completed' && (
          <Button
            className="w-full bg-gold text-black hover:bg-gold/90"
            onClick={() => navigate(`/book/${token.salon_id}`)}
          >
            Book Again
          </Button>
        )}
      </div>
    </div>
  );
}
