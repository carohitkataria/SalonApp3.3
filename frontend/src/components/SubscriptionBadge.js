import React, { useState } from 'react';
import { Crown, Check, AlertTriangle, ChevronRight, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSubscription } from '@/contexts/SubscriptionContext';
import SubscriptionPanel from '@/components/SubscriptionPanel';

/**
 * Compact subscription status badge meant to live inside the Salon Settings page.
 * - Shows current plan (Free / Pro Active / Expired) at a glance.
 * - Has an inline "Subscribe Now" / "Renew" button.
 * - Clicking the card opens the detailed Subscription Panel in a dialog.
 */
export default function SubscriptionBadge({ salonId }) {
  const { status, plan, loading, openPaywall, isPremium } = useSubscription();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const expired = status?.status === 'expired';
  const planName = plan?.plan_name || 'SalonHub Pro';
  const price = plan?.price ?? 499;
  const cycle = plan?.billing_cycle === 'yearly' ? 'year' : 'month';

  let badgeText = 'Free Plan';
  let badgeClasses = 'bg-amber-500/15 text-amber-500 border-amber-500/30';
  let icon = <Crown className="w-4 h-4" />;
  let descriptor = 'Limited to 1 staff and main branch only.';

  if (isPremium) {
    badgeText = `${planName} · Active`;
    badgeClasses = 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
    icon = <Check className="w-4 h-4" />;
    if (status?.expiry_date) {
      const exp = new Date(status.expiry_date).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
      descriptor = `Renews on ${exp}${typeof status.days_remaining === 'number' ? ` · ${status.days_remaining} day${status.days_remaining === 1 ? '' : 's'} left` : ''}`;
    }
  } else if (expired) {
    badgeText = 'Expired';
    badgeClasses = 'bg-rose-500/15 text-rose-500 border-rose-500/30';
    icon = <AlertTriangle className="w-4 h-4" />;
    descriptor = 'Premium features are paused. Renew to unlock again — your data is safe.';
  }

  const handleAction = (e) => {
    e.stopPropagation();
    openPaywall();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setDetailsOpen(true)}
        className="w-full text-left bg-card border border-border rounded-xl p-5 hover:border-gold transition-colors flex items-center gap-4 group"
        data-testid="subscription-badge"
      >
        <div className={`w-12 h-12 rounded-full border flex items-center justify-center shrink-0 ${badgeClasses}`}>
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded-full border ${badgeClasses}`}>
              {badgeText}
            </span>
            {!isPremium && (
              <span className="text-xs text-muted-foreground">
                · ₹{Number(price).toLocaleString('en-IN')}/{cycle}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {descriptor}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isPremium && (
            <button
              type="button"
              onClick={handleAction}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-md transition-all"
              data-testid="subscription-badge-cta"
            >
              {expired ? 'Re-subscribe' : 'Subscribe'}
            </button>
          )}
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-gold transition-colors" />
        </div>
      </button>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-2 border-b border-border sticky top-0 bg-background z-10">
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-400" />
              Subscription Details
            </DialogTitle>
          </DialogHeader>
          <div className="p-6">
            <SubscriptionPanel salonId={salonId} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
