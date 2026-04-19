import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Bell, MessageCircle, User, Phone, Save } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const IN_APP_FIELDS = [
  { key: 'payment_confirmation', label: 'Payment confirmation by salon' },
  { key: 'turn_approaching', label: "When you're 3, 2 or 1 token away" },
  { key: 'booking_status_change', label: 'Booking status changes (called, completed, cancelled)' },
  { key: 'manual_notify', label: 'Manual notification from the salon' },
  { key: 'membership_added', label: 'Membership added by salon' },
  { key: 'custom_package', label: 'Custom package created for you' },
];

const WHATSAPP_FIELDS = [
  { key: 'whatsapp_booking_confirmation', label: 'Booking confirmation' },
  { key: 'whatsapp_payment_confirmation', label: 'Payment confirmation' },
  { key: 'whatsapp_turn_approaching', label: "When you're 3, 2 or 1 token away" },
  { key: 'whatsapp_booking_status_change', label: 'Booking status changes' },
  { key: 'whatsapp_booking_cancelled', label: 'Booking cancelled' },
  { key: 'whatsapp_booking_rescheduled', label: 'Booking rescheduled' },
  { key: 'whatsapp_manual_notify', label: 'Manual notification from the salon' },
  { key: 'whatsapp_membership_added', label: 'Membership added by salon' },
];

export default function CustomerProfilePage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const phone = user?.phone || localStorage.getItem('userPhone');
  const userName = user?.name || localStorage.getItem('userName') || 'Customer';

  useEffect(() => {
    if (!phone) {
      setLoading(false);
      return;
    }
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const cleanPhone = phone.replace('+91', '');
      const res = await axios.get(`${API}/customers/${cleanPhone}/notification-settings`);
      setSettings(res.data);
    } catch (e) {
      toast.error('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!phone) return;
    try {
      setSaving(true);
      const cleanPhone = phone.replace('+91', '');
      const payload = {};
      [...IN_APP_FIELDS, ...WHATSAPP_FIELDS].forEach(f => {
        payload[f.key] = !!settings[f.key];
      });
      await axios.put(`${API}/customers/${cleanPhone}/notification-settings`, payload);
      toast.success('Preferences saved');
    } catch (e) {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (!phone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Please log in to view your profile.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-4 pt-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
          <p className="text-sm text-muted-foreground">Manage your account & notification preferences</p>
        </div>

        {/* Profile info */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="w-4 h-4 text-gold" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium text-foreground">{userName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Phone:</span>
              <span className="font-medium text-foreground">{phone}</span>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">Loading preferences...</CardContent>
          </Card>
        ) : settings && (
          <>
            {/* In-app notifications */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bell className="w-4 h-4 text-gold" />
                  In-App Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {IN_APP_FIELDS.map(f => (
                  <div key={f.key} className="flex items-center justify-between gap-3 py-1">
                    <Label htmlFor={f.key} className="text-sm text-foreground flex-1 cursor-pointer">{f.label}</Label>
                    <Switch
                      id={f.key}
                      checked={!!settings[f.key]}
                      onCheckedChange={() => toggle(f.key)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* WhatsApp notifications */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageCircle className="w-4 h-4 text-green-500" />
                  WhatsApp Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {WHATSAPP_FIELDS.map(f => (
                  <div key={f.key} className="flex items-center justify-between gap-3 py-1">
                    <Label htmlFor={f.key} className="text-sm text-foreground flex-1 cursor-pointer">{f.label}</Label>
                    <Switch
                      id={f.key}
                      checked={!!settings[f.key]}
                      onCheckedChange={() => toggle(f.key)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button
              className="w-full bg-gold text-black hover:bg-gold/90"
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
