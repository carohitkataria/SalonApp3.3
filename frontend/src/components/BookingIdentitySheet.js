/**
 * Post-Confirm Booking Identity Sheet — single-step "phone number gate".
 *
 * Slides up after "Confirm Booking" for unauthenticated customers. Shows:
 *   - 10-digit mobile input (single, prominent)
 *   - Full name + gender (Men / Women / Other)
 *   - TWO CTAs: "Send OTP" (verify) or "Continue as Guest" (skip OTP)
 *
 * "Continue as Guest" is the standard wording used by BookMyShow, Amazon,
 * IRCTC and other big Indian apps — booking proceeds instantly, is_guest=true.
 */
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, X, ShieldCheck, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function BookingIdentitySheet({
  open,
  onClose,
  totalAmount = 0,
  guestName,
  setGuestName,
  guestPhone,
  setGuestPhone,
  guestGender,
  setGuestGender,
  onChooseLogin,
  onConfirmGuest,
  loading = false,
}) {
  // Lock background scroll while open.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  const nameValid = (guestName || '').trim().length >= 2;
  const phoneValid = (guestPhone || '').length === 10;
  const genderValid = !!guestGender;
  const formValid = nameValid && phoneValid && genderValid;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="fixed left-0 right-0 bottom-0 z-[80] bg-background rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
            data-testid="booking-identity-sheet"
          >
            {/* Grabber */}
            <div className="flex justify-center pt-3">
              <div className="w-12 h-1.5 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="px-5 pt-4 pb-2 flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-foreground">Confirm your booking</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Total <span className="font-semibold text-gold">₹{totalAmount}</span> — enter your details to finish.
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-2 rounded-full hover:bg-muted -mt-1 -mr-1"
                data-testid="identity-sheet-close"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Body — single-step form */}
            <div className="px-5 pb-6 pt-3 space-y-4">
              {/* Mobile — most prominent */}
              <div>
                <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Mobile number</label>
                <div className="flex gap-2 mt-1.5">
                  <span className="inline-flex items-center px-3 h-12 rounded-lg border border-border bg-muted text-sm font-semibold">+91</span>
                  <Input
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile"
                    inputMode="numeric"
                    className="h-12 flex-1 text-lg"
                    data-testid="identity-phone-input"
                    autoFocus
                  />
                </div>
                {!!(guestPhone || '').length && !phoneValid && (
                  <p className="text-[11px] text-red-500 mt-1">Please enter a 10-digit mobile number.</p>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Full name</label>
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Your name"
                  className="h-11 mt-1.5"
                  data-testid="identity-name-input"
                />
              </div>

              {/* Gender */}
              <div>
                <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Gender</label>
                <div className="flex gap-2 flex-wrap mt-1.5">
                  {['Men', 'Women', 'Other'].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGuestGender(g)}
                      className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all ${
                        guestGender === g
                          ? 'bg-gold text-black border-gold'
                          : 'bg-background text-foreground border-border hover:border-gold/50'
                      }`}
                      data-testid={`identity-gender-${g.toLowerCase()}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* CTAs */}
              <div className="pt-2 space-y-2">
                <Button
                  type="button"
                  onClick={onChooseLogin}
                  disabled={!phoneValid || loading}
                  className="w-full bg-gold text-black hover:bg-gold/90 py-5 text-base font-bold rounded-xl disabled:opacity-50"
                  data-testid="identity-send-otp-btn"
                >
                  <ShieldCheck className="w-5 h-5 mr-2" />
                  Send OTP
                </Button>
                <Button
                  type="button"
                  onClick={onConfirmGuest}
                  disabled={!formValid || loading}
                  variant="outline"
                  className="w-full py-5 text-base font-semibold rounded-xl border-2 disabled:opacity-50"
                  data-testid="identity-guest-btn"
                >
                  <UserRound className="w-5 h-5 mr-2" />
                  {loading ? 'Booking…' : 'Continue as Guest'}
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground text-center pt-1">
                <Smartphone className="w-3 h-3 inline mr-1" />
                Verifying with OTP unlocks your booking history, wallet &amp; member benefits.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
