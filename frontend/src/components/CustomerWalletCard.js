import React from 'react';
import { Crown, Wallet, Calendar, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CustomerWalletCard({ membership }) {
  if (!membership || !membership.has_membership) {
    return null;
  }

  const daysUntilExpiry = Math.ceil(
    (new Date(membership.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)
  );

  const isExpiringSoon = daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  const isExpired = daysUntilExpiry <= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl p-6 mb-6 ${
        isExpired 
          ? 'bg-gradient-to-br from-gray-500/10 to-gray-600/10 border-2 border-gray-500/30'
          : 'bg-gradient-to-br from-gold/10 via-gold/5 to-amber-500/10 border-2 border-gold/30'
      }`}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 opacity-10">
        <Sparkles className="w-32 h-32 text-gold" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full ${
              isExpired ? 'bg-gray-500/20' : 'bg-gold/20'
            }`}>
              <Crown className={`w-6 h-6 ${isExpired ? 'text-gray-500' : 'text-gold'}`} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                {membership.membership_name} Member
              </h3>
              <p className={`text-sm flex items-center gap-1 ${
                isExpired 
                  ? 'text-red-500 font-semibold'
                  : isExpiringSoon 
                  ? 'text-orange-500 font-semibold'
                  : 'text-muted-foreground'
              }`}>
                <Calendar className="w-3 h-3" />
                {isExpired 
                  ? 'Expired'
                  : `Expires: ${new Date(membership.expiry_date).toLocaleDateString()}`
                }
              </p>
            </div>
          </div>

          {/* Wallet Balance */}
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-end gap-1">
              <Wallet className="w-3 h-3" />
              Wallet Balance
            </p>
            <p className={`text-3xl font-bold ${
              isExpired ? 'text-gray-500' : 'text-gold'
            }`}>
              ₹{membership.wallet_balance || 0}
            </p>
          </div>
        </div>

        {/* Status Messages */}
        {isExpiringSoon && !isExpired && (
          <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
            <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
              ⚠️ Your membership expires in {daysUntilExpiry} days. Renew now to keep enjoying benefits!
            </p>
          </div>
        )}

        {isExpired && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">
              ❌ Your membership has expired. Renew to continue using your wallet balance.
            </p>
          </div>
        )}

        {!isExpired && membership.wallet_balance > 0 && (
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
              ✨ You can use your wallet balance for bookings!
            </p>
          </div>
        )}

        {/* Additional Info */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/50">
          <div>
            <p className="text-xs text-muted-foreground">Purchased</p>
            <p className="text-sm font-semibold">
              {new Date(membership.purchased_at).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payment Mode</p>
            <p className="text-sm font-semibold capitalize">
              {membership.payment_mode || 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
