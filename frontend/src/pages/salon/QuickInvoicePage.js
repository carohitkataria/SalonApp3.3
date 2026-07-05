import React from 'react';
import { useNavigate } from 'react-router-dom';
import SalonBookingForm from './SalonBookingForm';

export default function QuickInvoicePage() {
  const navigate = useNavigate();
  return (
    <SalonBookingForm
      mode="invoice"
      pageTitle="Quick Invoice"
      pageSubtitle="Bill the customer directly — no queue entry needed"
      submitLabel="Generate Invoice"
      headerAccent="invoice"
      onSubmitted={() => navigate('/salon/dashboard')}
    />
  );
}
