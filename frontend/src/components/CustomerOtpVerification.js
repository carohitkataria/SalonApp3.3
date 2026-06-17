import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Shield, Send, CheckCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Customer OTP verification banner / card.
 *
 * • If the customer is already logged in (user.phone exists) → behaves like the
 *   old component and just verifies their OTP status.
 * • If the customer is a guest (no user yet) → asks for the phone number,
 *   sends an OTP and logs them in via AuthContext.customerVerifyOtp.
 */
export default function CustomerOtpVerification({ onVerified, showAs = 'banner' }) {
  const {
    user,
    updateUserOtpStatus,
    isUserOtpVerified,
    customerSendOtp,
    customerVerifyOtp,
  } = useAuth();
  const [step, setStep] = useState('prompt'); // prompt → otp → verified
  const [phoneInput, setPhoneInput] = useState('');
  const [activePhone, setActivePhone] = useState(''); // 10-digit phone we sent the OTP to
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (isUserOtpVerified) setStep('verified');
  }, [isUserOtpVerified]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const sanitisePhone = (raw) => (raw || '').replace(/\D/g, '').replace(/^91/, '').slice(0, 10);

  const handleSendOtp = async () => {
    // Resolve which phone to send the OTP to: prefer the logged-in user, else the input.
    const fromUser = user?.phone ? user.phone.replace('+91', '') : '';
    const fromInput = sanitisePhone(phoneInput);
    const target = fromUser || fromInput;

    if (!target || target.length !== 10) {
      toast.error('Enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    try {
      const res = await customerSendOtp(target, 'login');
      if (!res.success) {
        toast.error(res.error || 'Failed to send OTP');
        return;
      }
      setActivePhone(target);
      setStep('otp');
      setCountdown(60);
      toast.success(res.note || 'OTP sent to your mobile');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter the 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      const res = await customerVerifyOtp(activePhone, otp, 'login');
      if (!res.success) {
        toast.error(res.error || 'Invalid OTP');
        return;
      }
      // For an already-logged-in user, keep the legacy behaviour of just
      // bumping the otp_verified_at timestamp.
      if (user?.phone && res.user?.otp_verified_at) {
        updateUserOtpStatus(true, res.user.otp_verified_at);
      }
      setStep('verified');
      toast.success('Phone verified successfully!');
      if (onVerified) onVerified();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    await handleSendOtp();
  };

  if (isUserOtpVerified || step === 'verified') return null;

  const isGuest = !user?.phone;
  const displayPhone = activePhone || (user?.phone || '').replace('+91', '');

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
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gold/20 rounded-lg flex-shrink-0">
                  <Shield className="w-5 h-5 text-gold" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground text-sm">
                    {isGuest ? 'Login to book & track bookings' : 'Verify Your Phone'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isGuest
                      ? 'Enter your mobile, we’ll send a one-time code.'
                      : 'Authenticate via OTP to access Wallet, History & Profile'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                {isGuest && (
                  <div className="flex items-stretch flex-1 rounded-lg overflow-hidden border border-border bg-background">
                    <span className="px-3 py-2 text-sm bg-muted text-muted-foreground select-none">+91</span>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(sanitisePhone(e.target.value))}
                      placeholder="10-digit mobile"
                      className="flex-1 border-0 h-10 rounded-none focus-visible:ring-0"
                      data-testid="otp-phone-input"
                    />
                  </div>
                )}
                <Button
                  onClick={handleSendOtp}
                  disabled={loading || (isGuest && phoneInput.length !== 10)}
                  className="bg-gold text-black hover:bg-gold/90 text-sm whitespace-nowrap h-10"
                  data-testid="otp-send-btn"
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
                  <p className="text-xs text-muted-foreground">OTP sent to +91 {displayPhone}</p>
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
                  data-testid="otp-code-input"
                />
                <Button
                  onClick={handleVerifyOtp}
                  disabled={loading || otp.length !== 6}
                  className="bg-gold text-black hover:bg-gold/90"
                  data-testid="otp-verify-btn"
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
                  className={countdown > 0 ? 'text-muted-foreground' : 'text-gold hover:underline'}
                >
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                </button>
                <button
                  onClick={() => setStep('prompt')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Change number
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Card style (used in Wallet / History / Profile modals) ──────────────
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gold/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-gold" />
        </div>
        <h3 className="text-xl font-bold text-foreground">
          {isGuest ? 'Login with OTP' : 'Verify Your Phone'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {isGuest ? 'Enter your mobile to receive a one-time code' : 'OTP verification is required to access this feature'}
        </p>
      </div>

      {step === 'prompt' && (
        <div className="space-y-4">
          {isGuest ? (
            <div className="flex items-stretch rounded-lg overflow-hidden border border-border bg-background">
              <span className="px-3 py-2 text-sm bg-muted text-muted-foreground select-none">+91</span>
              <Input
                type="tel"
                inputMode="numeric"
                value={phoneInput}
                onChange={(e) => setPhoneInput(sanitisePhone(e.target.value))}
                placeholder="10-digit mobile"
                className="flex-1 border-0 h-11 rounded-none focus-visible:ring-0"
                data-testid="otp-phone-input-card"
              />
            </div>
          ) : (
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Phone Number</p>
              <p className="text-lg font-semibold text-foreground">{user?.phone}</p>
            </div>
          )}
          <Button
            onClick={handleSendOtp}
            disabled={loading || (isGuest && phoneInput.length !== 10)}
            className="w-full bg-gold text-black hover:bg-gold/90"
            data-testid="otp-send-btn-card"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending OTP...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send OTP
              </>
            )}
          </Button>
        </div>
      )}

      {step === 'otp' && (
        <div className="space-y-4">
          <p className="text-center text-xs text-muted-foreground">OTP sent to +91 {displayPhone}</p>
          <Input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Enter 6-digit OTP"
            className="text-center text-2xl tracking-widest h-14"
            maxLength={6}
            data-testid="otp-code-input-card"
          />
          <Button
            onClick={handleVerifyOtp}
            disabled={loading || otp.length !== 6}
            className="w-full bg-gold text-black hover:bg-gold/90"
            data-testid="otp-verify-btn-card"
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
          <div className="flex justify-between text-sm">
            <button
              onClick={handleResendOtp}
              disabled={countdown > 0}
              className={countdown > 0 ? 'text-muted-foreground' : 'text-gold hover:underline'}
            >
              {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
            </button>
            <button
              onClick={() => setStep('prompt')}
              className="text-muted-foreground hover:text-foreground"
            >
              Change number
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
