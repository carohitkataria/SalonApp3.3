import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Bell, CheckCircle, Clock, ArrowLeft, CreditCard } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CustomerNotificationsPage() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const phone = user?.phone || '';

  useEffect(() => {
    if (phone) {
      fetchNotifications();
    }
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
      case 'membership_confirmed': return <CheckCircle className="w-5 h-5 text-green-500" />;
      default: return <Bell className="w-5 h-5 text-blue-500" />;
    }
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
                onClick={() => !notif.is_read && markAsRead(notif.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
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
