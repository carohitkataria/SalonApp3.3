import React from 'react';
import { useNavigate } from 'react-router-dom';
import SalonBookingForm from './SalonBookingForm';

export default function NewBookingPage() {
  const navigate = useNavigate();
  return (
    <SalonBookingForm
      mode="booking"
      pageTitle="New Booking"
      pageSubtitle="Create a booking and add the customer to the queue"
      submitLabel="Create Booking"
      headerAccent="gold"
      onSubmitted={() => navigate('/salon/dashboard?tab=queue')}
    />
  );
}
