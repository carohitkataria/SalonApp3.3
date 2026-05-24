import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Crown, Loader2, Sparkles, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSubscription } from '@/contexts/SubscriptionContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const getAuthHeaders = () => {
  const salonUserAuth = localStorage.getItem('salon_user_auth');
  if (salonUserAuth) {
    try {
      const authData = JSON.parse(salonUserAuth);
      return { Authorization: `Bearer ${authData.token}` };
    } catch (e) { /* fall through */ }
  }
  const legacyToken = localStorage.getItem('salon_admin_token');
  return legacyToken ? { Authorization: `Bearer ${legacyToken}` } : {};
};

const fmtMoney = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function SubscriptionPaywallModal() {
  const { paywallOpen, paywallReason, closePaywall, plan, salonId, status } = useSubscription();
  const [processing, setProcessing] = useState(false);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Fetch per-branch quote whenever the paywall opens
  useEffect(() => {
    let cancelled = false;
    if (paywallOpen && salonId) {
      setQuoteLoading(true);
      axios
        .get(`${API}/salons/${salonId}/subscription/quote`)
        .then((r) => { if (!cancelled) setQuote(r.data); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setQuoteLoading(false); });
    } else {
      setQuote(null);
    }
    return () => { cancelled = true; };
  }, [paywallOpen, salonId]);

  if (!paywallOpen) return null;

  // Phase 2 (Part C) — show per-branch breakdown
  const pricePerBranch = Number(
    quote?.price_per_branch ?? status?.price_per_branch ?? plan?.price_per_branch ?? plan?.price ?? 499
  );
  const billableBranchCount = Number(
    quote?.billable_branch_count ?? status?.active_branch_count ?? 1
  );
  const baseAmount = Number(quote?.base_amount ?? pricePerBranch * billableBranchCount);
  const totalAmount = Number(quote?.total_amount ?? baseAmount);
  const discountAmount = Number(quote?.discount_amount ?? 0);

  const planName = plan?.plan_name ?? paywallReason?.plan_name ?? 'SalonHub Pro';
  const billingCycle = plan?.billing_cycle ?? 'monthly';
  const features = plan?.features?.length
    ? plan.features
    : [
        'Unlimited Staff',
        'Multiple Branches',
        'Branch Management',
        'Staff Transfers',
        'Attendance System',
      ];

  const handleSubscribe = async () => {
    if (!salonId) {
      toast.error('Salon context missing');
      return;
    }
    setProcessing(true);
    try {
      const orderRes = await axios.post(
        `${API}/salons/${salonId}/subscription/create-order`,
        { plan_id: plan?.id },
        { headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } }
      );

      const { payment_session_id, order_id, cashfree_env } = orderRes.data;
      if (!payment_session_id) {
        toast.error('Could not initiate payment. Please try again.');
        setProcessing(false);
        return;
      }

      // Persist a marker so the callback page can verify
      localStorage.setItem(
        'salonhub_pending_subscription',
        JSON.stringify({ order_id, salon_id: salonId, ts: Date.now() })
      );

      // eslint-disable-next-line no-undef
      if (typeof Cashfree === 'undefined') {
        toast.error('Payment SDK not loaded. Please refresh and retry.');
        setProcessing(false);
        return;
      }

      // eslint-disable-next-line no-undef
      const cashfree = Cashfree({
        mode: (cashfree_env || 'TEST').toLowerCase() === 'prod' ? 'production' : 'sandbox',
      });

      cashfree.checkout({
        paymentSessionId: payment_session_id,
        redirectTarget: '_self',
        returnUrl: `${window.location.origin}/subscription/callback?order_id=${encodeURIComponent(order_id)}`,
      });
      // After redirectTarget=_self, browser navigates away.
    } catch (err) {
      console.error('Subscribe error', err);
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : (detail?.message || err.message || 'Failed to start payment');
      toast.error(msg);
      setProcessing(false);
    }
  };

  return (
    <Dialog open={paywallOpen} onOpenChange={(open) => { if (!open && !processing) closePaywall(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden border border-amber-500/40 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black">
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-6 h-6 text-amber-400" />
            <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold">{planName}</span>
          </div>
          <DialogTitle className="text-2xl font-bold text-white leading-tight">
            Upgrade to SalonHub Pro
          </DialogTitle>
          {paywallReason?.message && (
            <p className="text-sm text-zinc-400 mt-2">{paywallReason.message}</p>
          )}
        </DialogHeader>

        <div className="px-6 pb-6">
          <ul className="space-y-2 mb-5 mt-3">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-zinc-200">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {/* Per-branch breakdown */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-5">
            <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2">
              <Building2 className="w-3.5 h-3.5" />
              {quoteLoading ? (
                'Calculating…'
              ) : (
                <>
                  {fmtMoney(pricePerBranch)}/month/branch &nbsp;×&nbsp; {billableBranchCount} branch
                  {billableBranchCount === 1 ? '' : 'es'}
                </>
              )}
            </div>

            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                <span>Subtotal</span>
                <span className="line-through">{fmtMoney(baseAmount)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-xs text-emerald-400 mb-1">
                <span>Discount</span>
                <span>− {fmtMoney(discountAmount)}</span>
              </div>
            )}

            <div className="flex items-baseline justify-between">
              <span className="text-zinc-300 text-sm">Total</span>
              <div className="text-right">
                <div className="text-3xl font-bold text-white">
                  {fmtMoney(totalAmount)}
                  <span className="text-sm font-normal text-zinc-400 ml-1">
                    /{billingCycle === 'yearly' ? 'year' : 'month'}
                  </span>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-amber-400 mt-1 flex items-center justify-end gap-1">
                  <Sparkles className="w-3 h-3" /> Cancel anytime
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleSubscribe}
              disabled={processing || quoteLoading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-6 text-base"
            >
              {processing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Redirecting to payment…
                </span>
              ) : (
                'Subscribe Now'
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={closePaywall}
              disabled={processing}
              className="w-full text-zinc-400 hover:text-white"
            >
              Maybe Later
            </Button>
          </div>

          <p className="text-[11px] text-zinc-500 text-center mt-4">
            Secure payments powered by Cashfree · UPI / Cards / Net Banking
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
