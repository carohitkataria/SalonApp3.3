import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Crown, ShoppingBag, FileText, CreditCard, Banknote, Smartphone, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SalonShopTab({ salonId }) {
  const { user } = useAuth();
  const [membershipPlans, setMembershipPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showTCModal, setShowTCModal] = useState(false);
  const [selectedTC, setSelectedTC] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (salonId) {
      fetchMembershipPlans();
    }
  }, [salonId]);

  const fetchMembershipPlans = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/membership-plans`);
      setMembershipPlans(response.data.plans || []);
    } catch (error) {
      console.error('Error fetching membership plans:', error);
    }
  };

  const handlePurchaseMembership = async () => {
    if (!user) {
      toast.error('Please login to purchase membership');
      return;
    }

    if (!selectedPlan) {
      toast.error('Please select a membership plan');
      return;
    }

    setLoading(true);
    try {
      // Use customer-facing endpoint (no auth required)
      const phone = user.phone.replace('+91', '');
      await axios.post(
        `${API}/salons/${salonId}/customers/${phone}/buy-membership`,
        {
          customer_phone: phone,
          customer_name: user.name,
          membership_plan_id: selectedPlan.id,
          payment_mode: paymentMode,
          paid_amount: selectedPlan.amount
        }
      );

      toast.success('Membership purchased successfully! Check your wallet.');
      setShowPurchaseModal(false);
      setSelectedPlan(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to purchase membership');
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
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gold/20 rounded-full mb-4">
          <ShoppingBag className="w-8 h-8 text-gold" />
        </div>
        <h2 className="text-3xl font-bold mb-2">Shop</h2>
        <p className="text-muted-foreground">
          Exclusive membership plans with amazing benefits
        </p>
      </div>

      {/* Membership Plans */}
      {membershipPlans.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Crown className="w-5 h-5 text-gold" />
            <h3 className="text-xl font-semibold">Membership Plans</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {membershipPlans.map(plan => (
              <motion.div
                key={plan.id}
                whileHover={{ scale: 1.02 }}
                className="relative bg-gradient-to-br from-gold/10 to-gold/5 border-2 border-gold/30 rounded-2xl p-6 hover:shadow-xl transition-all"
              >
                {/* Crown Icon */}
                <div className="absolute top-4 right-4">
                  <Crown className="w-8 h-8 text-gold/40" />
                </div>

                <div className="mb-6">
                  <h4 className="text-2xl font-bold mb-1">{plan.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Valid for {plan.validity_months} month{plan.validity_months > 1 ? 's' : ''}
                  </p>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Pay</span>
                    <span className="text-2xl font-bold">₹{plan.amount}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gold/20">
                    <span className="text-muted-foreground">Get Wallet Credit</span>
                    <span className="text-3xl font-bold text-gold">₹{plan.credit}</span>
                  </div>
                  {plan.credit > plan.amount && (
                    <div className="flex justify-between items-center text-green-600">
                      <span className="text-sm">Extra Value</span>
                      <span className="font-semibold">
                        +{((plan.credit - plan.amount) / plan.amount * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {plan.terms_conditions && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setSelectedTC(plan.terms_conditions);
                        setShowTCModal(true);
                      }}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View Terms & Conditions
                    </Button>
                  )}
                  
                  <Button
                    onClick={() => {
                      setSelectedPlan(plan);
                      setShowPurchaseModal(true);
                    }}
                    className="w-full bg-gold text-black hover:bg-gold/90"
                  >
                    Purchase Now
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Coming Soon Section */}
      <div className="mt-12 text-center py-12 bg-muted rounded-lg">
        <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">More Products Coming Soon</h3>
        <p className="text-muted-foreground">
          Gift cards, premium products, and exclusive packages
        </p>
      </div>

      {/* Purchase Modal */}
      <Dialog open={showPurchaseModal} onOpenChange={setShowPurchaseModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-gold" />
              Purchase {selectedPlan?.name} Membership
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Summary */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>Membership</span>
                <span className="font-semibold">{selectedPlan?.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Validity</span>
                <span className="font-semibold">{selectedPlan?.validity_months} month(s)</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Amount to Pay</span>
                <span className="text-gold">₹{selectedPlan?.amount}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Wallet Credit</span>
                <span className="font-bold">₹{selectedPlan?.credit}</span>
              </div>
            </div>

            {/* Payment Mode */}
            <div>
              <label className="text-sm font-medium mb-3 block">Select Payment Mode</label>
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
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowPurchaseModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePurchaseMembership}
                disabled={loading}
                className="flex-1 bg-gold text-black hover:bg-gold/90"
              >
                {loading ? 'Processing...' : 'Confirm Purchase'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* T&C Modal */}
      <Dialog open={showTCModal} onOpenChange={setShowTCModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Terms & Conditions
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm whitespace-pre-wrap">{selectedTC}</p>
          </div>
          <Button onClick={() => setShowTCModal(false)} className="w-full">
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
