import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Crown, Wallet, CreditCard, Banknote, Smartphone, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SellMembershipModal({ 
  isOpen, 
  onClose, 
  customer, 
  salonId, 
  getAuthHeaders,
  onSuccess 
}) {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMode, setPaymentMode] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [currentMembership, setCurrentMembership] = useState(null);

  useEffect(() => {
    if (isOpen && salonId) {
      fetchPlans();
      fetchCurrentMembership();
    }
  }, [isOpen, salonId]);

  const fetchPlans = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/membership-plans`);
      setPlans(response.data.plans || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to load membership plans');
    }
  };

  const fetchCurrentMembership = async () => {
    try {
      const response = await axios.get(
        `${API}/salons/${salonId}/customer-membership/${customer.phone}`
      );
      if (response.data.has_membership) {
        setCurrentMembership(response.data);
      }
    } catch (error) {
      console.error('Error fetching membership:', error);
    }
  };

  const handleSell = async () => {
    if (!selectedPlan) {
      toast.error('Please select a membership plan');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API}/salons/${salonId}/sell-membership`,
        {
          customer_phone: customer.phone,
          customer_name: customer.name,
          membership_plan_id: selectedPlan.id,
          payment_mode: paymentMode,
          paid_amount: selectedPlan.amount
        },
        { headers: getAuthHeaders() }
      );

      toast.success(
        currentMembership 
          ? 'Membership renewed successfully!' 
          : 'Membership sold successfully!'
      );
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to sell membership');
    } finally {
      setLoading(false);
    }
  };

  const paymentModes = [
    { value: 'cash', label: 'Cash', icon: Banknote },
    { value: 'card', label: 'Card', icon: CreditCard },
    { value: 'upi', label: 'UPI', icon: Smartphone }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-gold" />
            Sell Membership - {customer?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Membership Info */}
          {currentMembership && (
            <div className="p-4 bg-gold/10 border border-gold/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-gold" />
                <h4 className="font-semibold">Current Membership</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Plan:</span>
                  <p className="font-semibold">{currentMembership.membership_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Wallet Balance:</span>
                  <p className="font-semibold text-gold">₹{currentMembership.wallet_balance}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Expires:</span>
                  <p className="text-sm">{new Date(currentMembership.expiry_date).toLocaleDateString()}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Purchasing will renew membership and add credit to wallet
              </p>
            </div>
          )}

          {/* Select Plan */}
          <div>
            <Label className="mb-3 block">Select Membership Plan *</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {plans.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No membership plans available. Create plans first.
                </div>
              ) : (
                plans.map(plan => (
                  <motion.div
                    key={plan.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedPlan(plan)}
                    className={`relative p-4 rounded-lg cursor-pointer border-2 transition-all ${
                      selectedPlan?.id === plan.id
                        ? 'border-gold bg-gold/10'
                        : 'border-border hover:border-gold/50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold">{plan.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {plan.validity_months} month(s)
                        </p>
                      </div>
                      {selectedPlan?.id === plan.id && (
                        <CheckCircle className="w-5 h-5 text-gold" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Pay:</span>
                        <span className="font-semibold">₹{plan.amount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Get:</span>
                        <span className="font-bold text-gold">₹{plan.credit}</span>
                      </div>
                      {plan.credit > plan.amount && (
                        <p className="text-xs text-green-600 text-right">
                          +{((plan.credit - plan.amount) / plan.amount * 100).toFixed(0)}% value
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Payment Mode */}
          {selectedPlan && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Label className="mb-3 block">Payment Mode *</Label>
              <div className="grid grid-cols-3 gap-3">
                {paymentModes.map(mode => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setPaymentMode(mode.value)}
                      className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                        paymentMode === mode.value
                          ? 'border-gold bg-gold/10'
                          : 'border-border hover:border-gold/50'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${paymentMode === mode.value ? 'text-gold' : ''}`} />
                      <span className="text-sm font-medium">{mode.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Summary */}
          {selectedPlan && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-muted rounded-lg space-y-2"
            >
              <h4 className="font-semibold mb-2">Transaction Summary</h4>
              <div className="flex justify-between text-sm">
                <span>Customer Pays:</span>
                <span className="font-semibold">₹{selectedPlan.amount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Wallet Credit:</span>
                <span className="font-semibold text-gold">₹{selectedPlan.credit}</span>
              </div>
              {currentMembership && (
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span>New Wallet Balance:</span>
                  <span className="font-bold text-gold">
                    ₹{currentMembership.wallet_balance + selectedPlan.credit}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>Payment Mode:</span>
                <span className="font-semibold capitalize">{paymentMode}</span>
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleSell}
              disabled={!selectedPlan || loading}
              className="bg-gold text-black hover:bg-gold/90"
            >
              {loading ? 'Processing...' : currentMembership ? 'Renew Membership' : 'Sell Membership'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
