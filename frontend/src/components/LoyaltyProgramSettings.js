import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Gift, Percent, Calendar, IndianRupee, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function LoyaltyProgramSettings({ salonId, getAuthHeaders }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    enabled: false,
    spend_amount: 10000,
    period_months: 6,
    topup_percentage: 10
  });

  useEffect(() => {
    if (salonId) {
      fetchLoyaltySettings();
    }
  }, [salonId]);

  const fetchLoyaltySettings = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/salons/${salonId}/loyalty-program`, {
        headers: getAuthHeaders()
      });
      if (response.data.enabled !== undefined) {
        setSettings(response.data);
      }
    } catch (error) {
      console.error('Error fetching loyalty settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (settings.enabled && (settings.spend_amount <= 0 || settings.period_months <= 0 || settings.topup_percentage <= 0)) {
      toast.error('Please enter valid values for all fields');
      return;
    }

    setSaving(true);
    try {
      await axios.post(
        `${API}/salons/${salonId}/loyalty-program`,
        {
          salon_id: salonId,
          enabled: settings.enabled,
          spend_amount: parseFloat(settings.spend_amount),
          period_months: parseInt(settings.period_months),
          topup_percentage: parseFloat(settings.topup_percentage)
        },
        { headers: getAuthHeaders() }
      );
      toast.success('Loyalty program settings saved successfully!');
    } catch (error) {
      console.error('Error saving loyalty settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gold/20 rounded-full">
            <Gift className="w-6 h-6 text-gold" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Loyalty Program</h3>
            <p className="text-sm text-muted-foreground">
              Auto reward customers who reach spending milestones
            </p>
          </div>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
        <Checkbox
          id="loyalty_enabled"
          checked={settings.enabled}
          onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
          className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
        />
        <Label htmlFor="loyalty_enabled" className="cursor-pointer flex-1">
          <span className="font-semibold">Enable Loyalty Program</span>
          <p className="text-xs text-muted-foreground mt-1">
            Automatically top up customer wallets when they reach spending thresholds
          </p>
        </Label>
      </div>

      {/* Configuration Form */}
      <AnimatePresence>
        {settings.enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 border-t border-border pt-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Spending Threshold */}
              <div>
                <Label htmlFor="spend_amount" className="flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-gold" />
                  Spending Threshold
                </Label>
                <div className="flex items-center mt-2">
                  <span className="text-sm mr-2">₹</span>
                  <Input
                    id="spend_amount"
                    type="number"
                    value={settings.spend_amount}
                    onChange={(e) => setSettings({ ...settings, spend_amount: e.target.value })}
                    placeholder="e.g., 10000"
                    min="1"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum spend to qualify for reward
                </p>
              </div>

              {/* Time Period */}
              <div>
                <Label htmlFor="period_months" className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gold" />
                  Time Period
                </Label>
                <div className="flex items-center mt-2">
                  <Input
                    id="period_months"
                    type="number"
                    value={settings.period_months}
                    onChange={(e) => setSettings({ ...settings, period_months: e.target.value })}
                    placeholder="e.g., 6"
                    min="1"
                    max="24"
                  />
                  <span className="text-sm ml-2">months</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Spending period to track
                </p>
              </div>

              {/* Reward Percentage */}
              <div>
                <Label htmlFor="topup_percentage" className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-gold" />
                  Wallet Top-Up %
                </Label>
                <div className="flex items-center mt-2">
                  <Input
                    id="topup_percentage"
                    type="number"
                    value={settings.topup_percentage}
                    onChange={(e) => setSettings({ ...settings, topup_percentage: e.target.value })}
                    placeholder="e.g., 10"
                    min="1"
                    max="100"
                    step="0.5"
                  />
                  <Percent className="w-4 h-4 ml-2 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Percentage of threshold to reward
                </p>
              </div>

              {/* Calculated Reward Display */}
              <div className="bg-gold/10 border border-gold/30 rounded-lg p-4">
                <p className="text-xs text-muted-foreground mb-1">Reward Amount</p>
                <p className="text-2xl font-bold text-gold">
                  ₹{((settings.spend_amount * settings.topup_percentage) / 100).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Will be added to customer's wallet
                </p>
              </div>
            </div>

            {/* Example Explanation */}
            <div className="bg-muted/50 p-4 rounded-lg border border-border">
              <p className="text-sm font-semibold mb-2">How it works:</p>
              <p className="text-sm text-muted-foreground">
                When a customer spends <span className="font-semibold text-foreground">₹{settings.spend_amount}</span> or more 
                within <span className="font-semibold text-foreground">{settings.period_months} months</span>, their wallet will automatically 
                be topped up with <span className="font-semibold text-gold">₹{((settings.spend_amount * settings.topup_percentage) / 100).toFixed(2)}</span> ({settings.topup_percentage}% of ₹{settings.spend_amount}).
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-border">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gold text-black hover:bg-gold/90"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
