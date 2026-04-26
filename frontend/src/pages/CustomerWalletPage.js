import React from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import WalletDisplay from '@/components/WalletDisplay';
import CustomerOtpVerification from '@/components/CustomerOtpVerification';

export default function CustomerWalletPage() {
  const { salonId } = useParams();
  const { user, isUserOtpVerified } = useAuth();

  const customerPhone = user?.phone || '';

  // Require OTP verification for wallet access
  if (!isUserOtpVerified) {
    return (
      <div className="max-w-md mx-auto p-4 pt-8">
        <CustomerOtpVerification showAs="card" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <WalletDisplay salonId={salonId} customerPhone={customerPhone} />
    </div>
  );
}
