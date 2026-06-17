/**
 * Item 10 — Post-Confirm Booking Identity Sheet.
 *
 * Polished bottom sheet that slides up AFTER the user taps "Confirm Booking"
 * (instead of the choice sitting inline in the page). Two views:
 *   1) `choice`  — Book as Guest | Login to Book
 *   2) `guest`   — Name + 10-digit mobile + Men/Women/Other selector
 *
 * The parent owns guest state (guestName/guestPhone/guestGender) so the same
 * fields are reused when the parent then POSTs the booking.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, User, ChevronRight, ArrowLeft, ShieldCheck, X } from 'lucide-react';
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
  const [view, setView] = useState('choice'); // 'choice' | 'guest'

  // Reset to choice each time the sheet opens.
  useEffect(() => { if (open) setView('choice'); }, [open]);

  // Lock background scroll while open.
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  const guestValid =
    (guestName || '').trim().length >= 2 &&
    (guestPhone || '').length === 10 &&
    !!guestGender;

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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            data-testid="identity-sheet-backdrop"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 bg-card border-t border-brass/30 rounded-t-3xl z-50 max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
            data-testid="identity-sheet"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <span className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>

            {/* Close icon (only on choice view) */}
            {view === 'choice' && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 p-1.5 rounded-full hover:bg-muted text-muted-foreground"
                data-testid="identity-sheet-close"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <div className="px-5 sm:px-6 pb-6 overflow-y-auto flex-1">
              {view === 'choice' ? (
                <>
                  <div className="text-center mb-6 mt-2">
                    <span className="eyebrow-brass">Final step</span>
                    <h2 className="font-fraunces text-2xl mt-1 font-medium">Almost there</h2>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Choose how you&apos;d like to confirm your booking of{' '}
                      <span className="font-bebas brass-text text-base leading-none">₹{totalAmount}</span>.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => setView('guest')}
                      data-testid="sheet-book-as-guest"
                      className="group w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-background hover:border-brass hover:bg-brass/[0.04] text-left transition-all"
                    >
                      <span className="w-10 h-10 rounded-full bg-brass/15 border border-brass/30 flex items-center justify-center flex-shrink-0">
                        <Smartphone className="w-5 h-5 text-brass" strokeWidth={1.7} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-fraunces text-base font-medium text-foreground">Book as Guest</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">Just mobile, name &amp; gender. No OTP needed.</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-brass" />
                    </button>

                    <button
                      onClick={() => onChooseLogin?.()}
                      data-testid="sheet-login-to-book"
                      className="group w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-background hover:border-brass hover:bg-brass/[0.04] text-left transition-all"
                    >
                      <span className="w-10 h-10 rounded-full bg-brass/15 border border-brass/30 flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-brass" strokeWidth={1.7} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-fraunces text-base font-medium text-foreground">Login to Book</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">Save history, wallet &amp; member benefits.</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-brass" />
                    </button>
                  </div>

                  <p className="mt-5 text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-sage" />
                    Your details are kept private and used only for this booking.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4 mt-2">
                    <button
                      onClick={() => setView('choice')}
                      aria-label="Back"
                      className="p-1.5 -ml-1.5 rounded-full hover:bg-muted text-muted-foreground"
                      data-testid="sheet-back-to-choice"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <span className="eyebrow-brass">Guest checkout</span>
                      <h2 className="font-fraunces text-xl font-medium leading-none mt-0.5">Your details</h2>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    We only need these to hold your slot.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Full name</label>
                      <Input
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Full name"
                        className="h-11 rounded-xl mt-1"
                        data-testid="sheet-guest-name"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Mobile number</label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-muted-foreground font-mono">+91</span>
                        <Input
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="10-digit mobile"
                          inputMode="numeric"
                          className="h-11 rounded-xl flex-1"
                          data-testid="sheet-guest-phone"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Gender</label>
                      <div className="flex gap-2 mt-1">
                        {['Men', 'Women', 'Other'].map((g) => (
                          <button
                            type="button"
                            key={g}
                            onClick={() => setGuestGender(g)}
                            data-testid={`sheet-guest-gender-${g.toLowerCase()}`}
                            className={`flex-1 h-11 rounded-xl border text-sm font-medium transition-all ${
                              guestGender === g
                                ? 'bg-brass text-espresso border-brass shadow-sm'
                                : 'bg-background text-foreground border-border hover:border-brass/50'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Sticky footer with primary CTA (only in guest view) */}
            {view === 'guest' && (
              <div className="border-t border-border bg-card/80 backdrop-blur-md p-4">
                <Button
                  onClick={onConfirmGuest}
                  disabled={!guestValid || loading}
                  className="w-full h-12 bg-brass text-espresso hover:bg-brass-hover rounded-2xl font-semibold text-sm disabled:opacity-50"
                  data-testid="sheet-confirm-guest-btn"
                >
                  {loading ? 'Confirming…' : <>Confirm booking · <span className="font-bebas text-lg leading-none ml-1">₹{totalAmount}</span></>}
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
