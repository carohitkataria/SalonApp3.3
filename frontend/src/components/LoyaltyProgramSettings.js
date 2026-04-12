import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Gift, Percent, Calendar, IndianRupee, Save, Plus, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DEFAULT_TIERS = [
  { name: 'Bronze', spend_amount: 5000, period_months: 6, topup_percentage: 5 },
  { name: 'Silver', spend_amount: 10000, period_months: 12, topup_percentage: 10 },
  { name: 'Gold', spend_amount: 20000, period_months: 12, topup_percentage: 15 }
];

export default function LoyaltyProgramSettings({ salonId, getAuthHeaders }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    enabled: false,
    tiers: DEFAULT_TIERS
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
        setSettings({
          enabled: response.data.enabled,
          tiers: response.data.tiers && response.data.tiers.length > 0 ? response.data.tiers : DEFAULT_TIERS
        });
      }
    } catch (error) {
      console.error('Error fetching loyalty settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (settings.enabled && settings.tiers.length === 0) {
      toast.error('Please add at least one loyalty tier');
      return;
    }

    // Validate tiers
    for (const tier of settings.tiers) {
      if (!tier.name || tier.spend_amount <= 0 || tier.period_months <= 0 || tier.topup_percentage <= 0) {
        toast.error('All tier fields must be valid');
        return;
      }
    }

    setSaving(true);
    try {
      await axios.post(
        `${API}/salons/${salonId}/loyalty-program`,
        {
          salon_id: salonId,
          enabled: settings.enabled,
          tiers: settings.tiers
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

  const addTier = () => {
    setSettings({
      ...settings,
      tiers: [...settings.tiers, { name: '', spend_amount: 0, period_months: 6, topup_percentage: 0 }]
    });
  };

  const removeTier = (index) => {
    setSettings({
      ...settings,
      tiers: settings.tiers.filter((_, i) => i !== index)
    });
  };

  const updateTier = (index, field, value) => {
    const newTiers = [...settings.tiers];
    newTiers[index][field] = value;
    setSettings({ ...settings, tiers: newTiers });
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
            <h3 className="text-xl font-bold">Multi-Tier Loyalty Program</h3>
            <p className="text-sm text-muted-foreground">
              Reward customers based on spending thresholds with multiple tiers
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
            Auto-reward customers when they reach tier thresholds
          </p>
        </Label>
      </div>

      {/* Configuration */}
      <AnimatePresence>
        {settings.enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 border-t border-border pt-4"
          >
            {/* Global Period */}
            <div className="max-w-xs">
              <Label htmlFor="period_months" className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gold" />
                Tracking Period (Months)
              </Label>
              <Input
                id="period_months"
                type="number"
                value={settings.period_months}
                onChange={(e) => setSettings({ ...settings, period_months: e.target.value })}
                min="1"
                max="24"
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Time period to track customer spending
              </p>
            </div>

            {/* Tiers */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base">Loyalty Tiers</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addTier}
                  className="text-gold border-gold hover:bg-gold/10"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Tier
                </Button>
              </div>

              <div className="space-y-3">
                {settings.tiers.map((tier, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-muted/50 rounded-lg border border-border"
                  >
                    <div>
                      <Label className="text-xs">Tier Name</Label>
                      <Input
                        value={tier.name}
                        onChange={(e) => updateTier(index, 'name', e.target.value)}
                        placeholder="e.g., Bronze"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Spend Threshold (₹)</Label>
                      <Input
                        type="number"
                        value={tier.spend_amount}
                        onChange={(e) => updateTier(index, 'spend_amount', parseFloat(e.target.value) || 0)}
                        placeholder="5000"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Reward %</Label>
                      <div className="flex items-center mt-1">
                        <Input
                          type="number"
                          value={tier.topup_percentage}
                          onChange={(e) => updateTier(index, 'topup_percentage', parseFloat(e.target.value) || 0)}
                          placeholder="5"
                          className="flex-1"
                        />
                        <Percent className="w-3 h-3 ml-1 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeTier(index)}
                        className="text-red-500 hover:text-red-600 w-full"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>

              {settings.tiers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No tiers added. Click "Add Tier" to create your first tier.
                </p>
              )}
            </div>

            {/* Example */}
            {settings.tiers.length > 0 && (
              <div className="bg-muted/50 p-4 rounded-lg border border-border">
                <p className="text-sm font-semibold mb-2">How it works:</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {settings.tiers
                    .sort((a, b) => a.spend_amount - b.spend_amount)
                    .map((tier, i) => (
                      <li key={i}>
                        <span className="font-semibold text-gold">{tier.name}:</span> Spend ₹
                        {tier.spend_amount} in {settings.period_months} months → Get ₹
                        {((tier.spend_amount * tier.topup_percentage) / 100).toFixed(2)} wallet credit
                      </li>
                    ))}
                </ul>
                <p className="text-xs text-muted-foreground mt-3">
                  💡 Customer qualifies for the highest tier they reach. Rewards apply automatically on booking completion.
                </p>
              </div>
            )}
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
