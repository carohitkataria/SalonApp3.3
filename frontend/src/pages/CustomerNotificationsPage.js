import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Bell, CheckCircle, Clock, ArrowLeft, CreditCard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CustomerNotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Read phone from AuthContext (primary) or legacy localStorage keys (fallback)
  const phone = user?.phone
    || (() => {
      try {
        const stored = JSON.parse(localStorage.getItem('salon_user') || '{}');
        return stored?.phone || '';
      } catch { return ''; }
    })();

  useEffect(() => {
    if (phone) {
      fetchNotifications();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  const fetchNotifications = async () => {
    try {
      const cleanPhone = phone.replace('+91', '');
      const response = await axios.get(`${API}/notifications/customer/${cleanPhone}`);
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notifId) => {
    try {
      await axios.put(`${API}/notifications/${notifId}/read`);
      fetchNotifications();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllRead = async () => {
    try {
      const cleanPhone = phone.replace('+91', '');
      await axios.put(`${API}/notifications/customer/${cleanPhone}/read-all`);
      fetchNotifications();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'payment_confirmed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'membership_pending': return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'membership_confirmed':
      case 'membership_added':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'booking_cancelled': return <CheckCircle className="w-5 h-5 text-red-500" />;
      case 'booking_completed':
      case 'turn_now':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default: return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  const handleNotifClick = (notif) => {
    if (!notif.is_read) markAsRead(notif.id);

    const type = notif.type;
    const relatedId = notif.related_id;
    const salonId = notif.salon_id;

    // Route to target screen
    if (type === 'custom_package' && salonId) {
      navigate(`/salon/${salonId}?tab=shop`);
      return;
    }
    if ((type === 'membership_added' || type === 'payment_confirmed' || type === 'membership_confirmed') && salonId) {
      navigate(`/salon/${salonId}/wallet`);
      return;
    }
    if (
      ['booking_confirmation', 'booking_cancelled', 'booking_completed',
       'turn_now', 'turn_3_away', 'turn_2_away', 'turn_1_away'].includes(type)
    ) {
      if (relatedId) {
        navigate(`/token/${relatedId}`);
      } else {
        navigate('/history');
      }
      return;
    }
    // Default fallback → history
    navigate('/history');
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Bell className="w-5 h-5 text-gold" />
              Notifications
            </h1>
          </div>
          {notifications.some(n => !n.is_read) && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="text-xs">
              Mark all read
            </Button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading notifications...</p>
          </div>
        ) : !phone ? (
          <div className="text-center py-16">
            <Bell className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
            <p className="text-lg font-semibold text-muted-foreground">Please log in</p>
            <p className="text-sm text-muted-foreground mt-1">Log in to view your notifications</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
            <p className="text-lg font-semibold text-muted-foreground">No notifications yet</p>
            <p className="text-sm text-muted-foreground mt-1">You'll see updates about your bookings and memberships here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotifClick(notif)}
                className={`p-4 rounded-xl border transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${
                  notif.is_read
                    ? 'bg-card border-border'
                    : 'bg-gold/5 border-gold/30 shadow-md hover:bg-gold/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  {getTypeIcon(notif.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-sm font-semibold ${notif.is_read ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {notif.title}
                      </h4>
                      {!notif.is_read && (
                        <span className="w-2.5 h-2.5 bg-gold rounded-full flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{notif.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {new Date(notif.created_at).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
