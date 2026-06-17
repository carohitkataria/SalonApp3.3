import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Bell, MessageCircle, Save } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SALON_FIELDS = [
  { key: 'new_booking', label: 'New booking received' },
  { key: 'booking_change', label: 'Booking changes (rescheduled, cancelled)' },
  { key: 'membership_purchase', label: 'Membership purchased by customer' },
  { key: 'review_added', label: 'Review added by customer' },
];

// WhatsApp toggles per event — controlled by the salon (Item 8).
const WHATSAPP_FIELDS = [
  { key: 'whatsapp_booking_confirmation', label: 'Booking confirmation' },
  { key: 'whatsapp_booking_completed', label: 'Booking completed' },
  { key: 'whatsapp_booking_cancelled', label: 'Booking cancelled' },
  { key: 'whatsapp_booking_rescheduled', label: 'Booking rescheduled' },
  { key: 'whatsapp_your_turn_now', label: 'Your turn now (customer must come)' },
  { key: 'whatsapp_token_approaching', label: 'Token approaching (1 or 2 away)' },
  { key: 'whatsapp_salon_calling', label: 'Salon calling (manual notify)' },
];

const ALL_KEYS = [
  ...SALON_FIELDS.map((f) => f.key),
  'whatsapp_enabled',
  ...WHATSAPP_FIELDS.map((f) => f.key),
];

export default function SalonNotificationSettings({ salonId, getAuthHeaders }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (salonId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salonId]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/salons/${salonId}/notification-settings`);
      setSettings(res.data);
    } catch (e) {
      toast.error('Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {};
      ALL_KEYS.forEach((k) => { payload[k] = !!settings[k]; });
      await axios.put(
        `${API}/salons/${salonId}/notification-settings`,
        payload,
        { headers: getAuthHeaders ? getAuthHeaders() : {} }
      );
      toast.success('Notification preferences saved');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">Loading...</CardContent>
      </Card>
    );
  }

  const whatsappMasterOn = !!settings.whatsapp_enabled;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-4 h-4 text-gold" />
            In-app Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Control which in-app notifications you receive at the salon dashboard.
          </p>
          {SALON_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-3 py-1">
              <Label htmlFor={`salon-notif-${f.key}`} className="text-sm text-foreground flex-1 cursor-pointer">{f.label}</Label>
              <Switch
                id={`salon-notif-${f.key}`}
                data-testid={`salon-notif-toggle-${f.key}`}
                checked={!!settings[f.key]}
                onCheckedChange={() => toggle(f.key)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card data-testid="salon-whatsapp-settings-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="w-4 h-4 text-gold" />
            WhatsApp Notifications to Customers
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Each customer receives one of these messages on WhatsApp using a Twilio-approved
            template. Turn an event off to stop your salon from sending it.
          </p>

          <div className="flex items-center justify-between gap-3 py-2 border-b border-border/60">
            <Label htmlFor="salon-notif-whatsapp_enabled" className="text-sm font-semibold text-foreground flex-1 cursor-pointer">
              Master switch — Send WhatsApp messages from this salon
            </Label>
            <Switch
              id="salon-notif-whatsapp_enabled"
              data-testid="salon-notif-toggle-whatsapp_enabled"
              checked={whatsappMasterOn}
              onCheckedChange={() => toggle('whatsapp_enabled')}
            />
          </div>

          {WHATSAPP_FIELDS.map((f) => (
            <div
              key={f.key}
              className={`flex items-center justify-between gap-3 py-1 ${whatsappMasterOn ? '' : 'opacity-50 pointer-events-none'}`}
            >
              <Label htmlFor={`salon-notif-${f.key}`} className="text-sm text-foreground flex-1 cursor-pointer">
                {f.label}
              </Label>
              <Switch
                id={`salon-notif-${f.key}`}
                data-testid={`salon-notif-toggle-${f.key}`}
                checked={!!settings[f.key]}
                onCheckedChange={() => toggle(f.key)}
                disabled={!whatsappMasterOn}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button
        className="w-full bg-gold text-black hover:bg-gold/90"
        onClick={handleSave}
        disabled={saving}
        data-testid="salon-notif-save-btn"
      >
        <Save className="w-4 h-4 mr-2" />
        {saving ? 'Saving...' : 'Save Preferences'}
      </Button>
    </div>
  );
}
