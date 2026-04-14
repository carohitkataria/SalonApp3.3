import React from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import WalletDisplay from '@/components/WalletDisplay';

export default function CustomerWalletPage() {
  const { salonId } = useParams();
  const { user } = useAuth();

  const customerPhone = user?.phone || '';

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <WalletDisplay salonId={salonId} customerPhone={customerPhone} />
    </div>
  );
}
