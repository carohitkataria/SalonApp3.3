import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Shield, Send, CheckCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CustomerOtpVerification({ onVerified, showAs = 'banner' }) {
  const { user, updateUserOtpStatus, isUserOtpVerified } = useAuth();
  const [step, setStep] = useState('prompt'); // prompt, otp, verified
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (isUserOtpVerified) {
      setStep('verified');
    }
  }, [isUserOtpVerified]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOtp = async () => {
    if (!user?.phone) {
      toast.error('Phone number not found');
      return;
    }

    setLoading(true);
    try {
      const phone = user.phone.replace('+91', '');
      const response = await axios.post(`${API}/customer/send-otp`, { phone });
      
      // If backend reports a failed delivery_status, treat it as an error
      if (response.data?.delivery_status === 'failed') {
        toast.error(response.data?.note || 'WhatsApp delivery failed. Please try again.');
        return;
      }
      
      setStep('otp');
      setCountdown(60);
      
      // SECURITY: Never display OTP in toast/UI even if backend echoes it back
      toast.success(response.data?.note || 'OTP sent to your WhatsApp!');
    } catch (error) {
      console.error('[CUSTOMER SEND OTP] Failed:', error?.response?.status, error?.response?.data || error?.message);
      const detail = error?.response?.data?.detail
        || error?.response?.data?.error
        || error?.message
        || 'Failed to send OTP. Please check your connection and try again.';
      toast.error(typeof detail === 'string' ? detail : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const phone = user.phone.replace('+91', '');
      const response = await axios.post(`${API}/customer/verify-otp`, { phone, otp });
      
      if (response.data.success) {
        const verifiedUser = response.data.user;
        updateUserOtpStatus(true, verifiedUser.otp_verified_at);
        setStep('verified');
        toast.success('Phone verified successfully!');
        if (onVerified) onVerified();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    await handleSendOtp();
  };

  if (isUserOtpVerified || step === 'verified') {
    return null; // Don't show anything if already verified
  }

  if (showAs === 'banner') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-gradient-to-r from-gold/20 to-yellow-500/10 border border-gold/30 rounded-xl p-4 mb-4"
        >
          {step === 'prompt' && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gold/20 rounded-lg">
                  <Shield className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Verify Your Phone</p>
                  <p className="text-xs text-muted-foreground">
                    Authenticate via OTP (WhatsApp) to access Wallet, History & Profile
                  </p>
                </div>
              </div>
              <Button 
                onClick={handleSendOtp}
                disabled={loading}
                className="bg-gold text-black hover:bg-gold/90 text-sm whitespace-nowrap"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-1" />
                    Send OTP
                  </>
                )}
              </Button>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gold/20 rounded-lg">
                  <Shield className="w-5 h-5 text-gold" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">Enter OTP</p>
                  <p className="text-xs text-muted-foreground">
                    OTP sent to {user?.phone} via WhatsApp
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit OTP"
                  className="flex-1 bg-background border-border h-10"
                  maxLength={6}
                />
                <Button 
                  onClick={handleVerifyOtp}
                  disabled={loading || otp.length !== 6}
                  className="bg-gold text-black hover:bg-gold/90"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  <span className="ml-1 hidden sm:inline">Verify</span>
                </Button>
              </div>
              
              <div className="flex justify-between items-center text-xs">
                <button
                  onClick={handleResendOtp}
                  disabled={countdown > 0}
                  className={`${countdown > 0 ? 'text-muted-foreground' : 'text-gold hover:underline'}`}
                >
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                </button>
                <button
                  onClick={() => setStep('prompt')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  // Card style for modals
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gold/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-gold" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Verify Your Phone</h3>
        <p className="text-sm text-muted-foreground mt-1">
          OTP verification is required to access this feature
        </p>
      </div>

      {step === 'prompt' && (
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">Phone Number</p>
            <p className="text-lg font-semibold text-foreground">{user?.phone}</p>
          </div>
          <Button 
            onClick={handleSendOtp}
            disabled={loading}
            className="w-full bg-gold text-black hover:bg-gold/90"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending OTP...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send OTP to WhatsApp
              </>
            )}
          </Button>
        </div>
      )}

      {step === 'otp' && (
        <div className="space-y-4">
          <Input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Enter 6-digit OTP"
            className="text-center text-2xl tracking-widest h-14"
            maxLength={6}
          />
          <Button 
            onClick={handleVerifyOtp}
            disabled={loading || otp.length !== 6}
            className="w-full bg-gold text-black hover:bg-gold/90"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Verify OTP
              </>
            )}
          </Button>
          <div className="flex justify-center">
            <button
              onClick={handleResendOtp}
              disabled={countdown > 0}
              className={`text-sm ${countdown > 0 ? 'text-muted-foreground' : 'text-gold hover:underline'}`}
            >
              {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
