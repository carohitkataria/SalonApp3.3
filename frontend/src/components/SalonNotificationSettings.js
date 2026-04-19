import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Bell, Save } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SALON_FIELDS = [
  { key: 'new_booking', label: 'New booking received' },
  { key: 'booking_change', label: 'Booking changes (rescheduled, cancelled)' },
  { key: 'membership_purchase', label: 'Membership purchased by customer' },
  { key: 'review_added', label: 'Review added by customer' },
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
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {};
      SALON_FIELDS.forEach(f => { payload[f.key] = !!settings[f.key]; });
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="w-4 h-4 text-gold" />
          Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Control which in-app notifications you receive at the salon dashboard.
        </p>
        {SALON_FIELDS.map(f => (
          <div key={f.key} className="flex items-center justify-between gap-3 py-1">
            <Label htmlFor={`salon-notif-${f.key}`} className="text-sm text-foreground flex-1 cursor-pointer">{f.label}</Label>
            <Switch
              id={`salon-notif-${f.key}`}
              checked={!!settings[f.key]}
              onCheckedChange={() => toggle(f.key)}
            />
          </div>
        ))}
        <Button
          className="w-full mt-4 bg-gold text-black hover:bg-gold/90"
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </CardContent>
    </Card>
  );
}
