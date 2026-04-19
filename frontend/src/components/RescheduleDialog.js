import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, X, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function RescheduleDialog({ token, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [fetchingSlots, setFetchingSlots] = useState(false);

  useEffect(() => {
    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchAvailableSlots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const fetchAvailableSlots = async () => {
    setFetchingSlots(true);
    try {
      // Get barber availability for the selected date
      const response = await axios.get(
        `${API}/salons/${token.salon_id}/barbers/${token.barber_id}/availability?date=${selectedDate}`
      );
      setAvailableSlots(response.data.available_shifts || ['Morning', 'Noon', 'Evening']);
    } catch (error) {
      console.error('Error fetching slots:', error);
      // Default shifts if API fails
      setAvailableSlots(['Morning', 'Noon', 'Evening']);
    } finally {
      setFetchingSlots(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedDate || !selectedShift) {
      toast.error('Please select date and shift');
      return;
    }

    setLoading(true);
    try {
      // Cancel current booking
      await axios.post(`${API}/tokens/${token.id}/customer-cancel`);

      // Create new booking with same details
      const newBookingData = {
        salon_id: token.salon_id,
        date: selectedDate,
        shift: selectedShift,
        barber_id: token.barber_id,
        selected_services: token.selected_services,
        phone: token.phone,
        customer_name: token.customer_name,
        booking_for_self: token.booking_for_self || true,
        payment_mode: 'pay_later',
        source: 'online'
      };

      const response = await axios.post(`${API}/salons/${token.salon_id}/salon-booking`, newBookingData);

      toast.success('Booking rescheduled successfully!');
      onSuccess(response.data);
      onClose();
    } catch (error) {
      console.error('Error rescheduling:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to reschedule booking. Please try booking again manually.';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30); // Allow booking up to 30 days ahead
    return maxDate.toISOString().split('T')[0];
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Reschedule Booking</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Token #{token.token_number} • {token.barber_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Warning */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800 dark:text-yellow-200">
            Your current booking will be cancelled and a new token will be assigned for the selected date and time.
          </div>
        </div>

        {/* Date Selection */}
        <div className="mb-6">
          <Label className="flex items-center gap-2 mb-2 text-gray-700 dark:text-gray-300">
            <Calendar className="w-4 h-4" />
            Select New Date
          </Label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={getMinDate()}
            max={getMaxDate()}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Shift Selection */}
        <div className="mb-6">
          <Label className="flex items-center gap-2 mb-2 text-gray-700 dark:text-gray-300">
            <Clock className="w-4 h-4" />
            Select Time Shift
          </Label>
          {fetchingSlots ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {availableSlots.map((shift) => (
                <button
                  key={shift}
                  onClick={() => setSelectedShift(shift)}
                  className={`px-4 py-3 rounded-lg border-2 font-semibold text-sm transition-all ${
                    selectedShift === shift
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {shift}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-gray-300 dark:border-gray-600"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReschedule}
            disabled={!selectedDate || !selectedShift || loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Rescheduling...
              </>
            ) : (
              'Confirm Reschedule'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
