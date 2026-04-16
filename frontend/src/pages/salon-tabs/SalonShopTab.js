import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Crown, ShoppingBag, FileText, Banknote, Smartphone, CheckCircle, Clock, ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SalonShopTab({ salonId }) {
  const { user } = useAuth();
  const [membershipPlans, setMembershipPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showTCModal, setShowTCModal] = useState(false);
  const [selectedTC, setSelectedTC] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [upiAppOpened, setUpiAppOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [salon, setSalon] = useState(null);
  const [shopStep, setShopStep] = useState('browse'); // browse | payment | success

  useEffect(() => {
    if (salonId) {
      fetchMembershipPlans();
      fetchSalon();
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

  const fetchSalon = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}`);
      setSalon(response.data);
    } catch (error) {
      console.error('Error fetching salon:', error);
    }
  };

  const handleUpiIntent = () => {
    if (!salon?.upi_id) {
      toast.error('Salon UPI ID not configured');
      return;
    }
    const amount = selectedPlan?.amount || 0;
    const upiUrl = `upi://pay?pa=${salon.upi_id}&pn=${encodeURIComponent(salon.salon_name)}&am=${amount}&cu=INR&tn=Membership_${selectedPlan?.name}`;
    window.location.href = upiUrl;
    setUpiAppOpened(true);
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

    if (!paymentMode) {
      toast.error('Please select a payment mode');
      return;
    }

    setLoading(true);
    try {
      const phone = user.phone.replace('+91', '');
      await axios.post(
        `${API}/salons/${salonId}/customers/${phone}/buy-membership`,
        {
          customer_phone: phone,
          customer_name: user.name,
          membership_plan_id: selectedPlan.id,
          payment_mode: paymentMode === 'pay_later' ? 'pay_later' : paymentMode,
          paid_amount: selectedPlan.amount
        }
      );

      // If UPI, confirm payment
      if (paymentMode === 'upi') {
        // Payment already confirmed by customer tapping the confirm button
      }

      toast.success('Membership purchase submitted! Awaiting salon confirmation.');
      setShopStep('success');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to purchase membership');
    } finally {
      setLoading(false);
    }
  };

  // Success screen
  if (shopStep === 'success') {
    return (
      <div className="flex items-center justify-center py-16">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-4"
        >
          <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto">
            <Clock className="w-12 h-12 text-yellow-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Purchase Submitted!</h2>
          <p className="text-muted-foreground">
            Your {selectedPlan?.name} membership purchase is pending confirmation by the salon.<br />
            ₹{selectedPlan?.credit} will be added to your wallet once confirmed.
          </p>
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-600">
            ⏳ Confirmation pending by salon
          </div>
          <Button
            onClick={() => {
              setShopStep('browse');
              setSelectedPlan(null);
              setPaymentMode('');
              setCouponCode('');
              setUpiAppOpened(false);
            }}
            className="bg-gold text-black hover:bg-gold/90"
          >
            Back to Shop
          </Button>
        </motion.div>
      </div>
    );
  }

  // Payment step
  if (shopStep === 'payment' && selectedPlan) {
    const amount = selectedPlan.amount;

    return (
      <div className="space-y-5 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => { setShopStep('browse'); setPaymentMode(''); setUpiAppOpened(false); }} className="p-2 rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <span className="font-bold text-lg text-foreground">Payment</span>
        </div>

        {/* Order Summary */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Order Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-foreground">{selectedPlan.name} Membership</span>
              <span className="font-medium text-foreground">₹{amount}</span>
            </div>
            <div className="flex justify-between text-sm text-green-600">
              <span>Wallet Credit</span>
              <span className="font-bold">₹{selectedPlan.credit}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="font-bold text-foreground">Amount to Pay</span>
              <span className="text-xl font-bold text-gold">₹{amount}</span>
            </div>
          </div>
        </div>

        {/* Coupon Code */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold/50"
            />
            <Button
              type="button"
              variant="outline"
              className="border-gold text-gold hover:bg-gold/10"
              onClick={() => {
                if (couponCode) toast.info('Coupon feature coming soon!');
                else toast.error('Please enter a coupon code');
              }}
            >
              Apply
            </Button>
          </div>
        </div>

        {/* Payment Options - No Wallet for Shop */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Choose Payment Method</h3>
          <div className="space-y-3">
            {/* Cash */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => { setPaymentMode('cash'); setUpiAppOpened(false); }}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
                paymentMode === 'cash' ? 'bg-gold/10 border-gold shadow-md' : 'bg-card border-border hover:border-gold/40'
              }`}
            >
              <div className="p-3 bg-green-500/10 rounded-full">
                <Banknote className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-foreground">Cash</p>
                <p className="text-xs text-muted-foreground">Pay at the salon</p>
              </div>
              {paymentMode === 'cash' && (
                <div className="w-6 h-6 bg-gold rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-black" />
                </div>
              )}
            </motion.button>

            {/* UPI */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => { setPaymentMode('upi'); setUpiAppOpened(false); }}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
                paymentMode === 'upi' ? 'bg-gold/10 border-gold shadow-md' : 'bg-card border-border hover:border-gold/40'
              }`}
            >
              <div className="p-3 bg-blue-500/10 rounded-full">
                <Smartphone className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-foreground">UPI</p>
                <p className="text-xs text-muted-foreground">Pay via UPI app (GPay, PhonePe, etc.)</p>
              </div>
              {paymentMode === 'upi' && (
                <div className="w-6 h-6 bg-gold rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-black" />
                </div>
              )}
            </motion.button>

            {/* Pay later at Salon */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => { setPaymentMode('pay_later'); setUpiAppOpened(false); }}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
                paymentMode === 'pay_later' ? 'bg-gold/10 border-gold shadow-md' : 'bg-card border-border hover:border-gold/40'
              }`}
            >
              <div className="p-3 bg-purple-500/10 rounded-full">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-foreground">Pay later at Salon</p>
                <p className="text-xs text-muted-foreground">Pay when you visit the salon</p>
              </div>
              {paymentMode === 'pay_later' && (
                <div className="w-6 h-6 bg-gold rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-black" />
                </div>
              )}
            </motion.button>
          </div>
        </div>

        {/* UPI Info */}
        {paymentMode === 'upi' && salon?.upi_id && (
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <p className="text-xs text-muted-foreground">UPI ID: <span className="font-mono font-bold text-foreground">{salon.upi_id}</span></p>
            {upiAppOpened && (
              <p className="text-xs text-green-600 mt-2 font-medium">
                ✓ UPI app opened. After completing payment, tap the confirm button below.
              </p>
            )}
          </div>
        )}
        {paymentMode === 'upi' && !salon?.upi_id && (
          <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl">
            <p className="text-xs text-red-500">Salon UPI ID not configured. Please choose another payment method.</p>
          </div>
        )}

        {/* Action Button - Single button that changes for UPI */}
        <div className="pt-2">
          {paymentMode === 'upi' ? (
            !upiAppOpened ? (
              <Button
                type="button"
                onClick={handleUpiIntent}
                disabled={!salon?.upi_id}
                className="w-full bg-blue-600 text-white hover:bg-blue-700 py-5 text-base font-bold rounded-xl disabled:opacity-50"
              >
                <Smartphone className="w-5 h-5 mr-2" />
                Open UPI App to Pay ₹{amount}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handlePurchaseMembership}
                disabled={loading}
                className="w-full bg-green-600 text-white hover:bg-green-700 py-5 text-base font-bold rounded-xl disabled:opacity-50"
              >
                {loading ? 'Processing...' : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    I've Paid — Confirm Purchase
                  </>
                )}
              </Button>
            )
          ) : (
            <Button
              type="button"
              onClick={handlePurchaseMembership}
              disabled={loading || !paymentMode}
              className="w-full bg-gold text-black hover:bg-gold/90 py-5 text-base font-bold rounded-xl disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Confirm Purchase'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Browse step (default)
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
                      setPaymentMode('');
                      setCouponCode('');
                      setUpiAppOpened(false);
                      setShopStep('payment');
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
