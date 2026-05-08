import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Clock, Save, ToggleLeft, ToggleRight, Calendar, Loader2 } from 'lucide-react';
import { getSession } from '@/utils/sessionManager';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const dayLabels = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday'
};

export default function OperationalHoursModule({ salonId }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [operationalHours, setOperationalHours] = useState({});
  const [manualToggle, setManualToggle] = useState({ is_overridden: false, is_open: true });
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetchOperationalHours();
  }, [salonId]);

  const fetchOperationalHours = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/operational-hours`);
      setOperationalHours(response.data.operational_hours || getDefaultHours());
      setManualToggle(response.data.manual_toggle || { is_overridden: false, is_open: true });
    } catch (error) {
      console.error('Error fetching operational hours:', error);
      setOperationalHours(getDefaultHours());
    } finally {
      setLoading(false);
    }
  };

  const getDefaultHours = () => {
    const defaultDay = {
      is_holiday: false,
      opening_time: '09:00',
      closing_time: '20:00',
      lunch_start: null,
      lunch_end: null
    };
    const hours = {};
    daysOfWeek.forEach(day => {
      hours[day] = { ...defaultDay };
    });
    return hours;
  };

  const handleDayChange = (day, field, value) => {
    setOperationalHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const session = getSession();
      await axios.put(
        `${API}/salons/${salonId}/operational-hours`,
        operationalHours,
        {
          headers: { Authorization: `Bearer ${session.token}` }
        }
      );
      toast.success('Operational hours updated successfully');
    } catch (error) {
      console.error('Error saving operational hours:', error);
      toast.error('Failed to update operational hours');
    } finally {
      setSaving(false);
    }
  };

  const handleManualToggle = async (action) => {
    // action: 'open' | 'close_full' | 'close_online'
    setToggling(true);
    try {
      const session = getSession();
      let payload;
      if (action === 'open') {
        payload = { is_overridden: false, is_open: true, closed_mode: null };
      } else if (action === 'close_full') {
        payload = { is_overridden: true, is_open: false, closed_mode: 'full' };
      } else if (action === 'close_online') {
        payload = { is_overridden: true, is_open: false, closed_mode: 'online_only' };
      }
      const response = await axios.put(
        `${API}/salons/${salonId}/manual-toggle`,
        payload,
        {
          headers: { Authorization: `Bearer ${session.token}` }
        }
      );
      setManualToggle(response.data.manual_toggle);
      if (action === 'open') {
        toast.success('Salon is now Open');
      } else if (action === 'close_full') {
        toast.success('Salon fully closed (online + offline)');
      } else {
        toast.success('Closed for online bookings only');
      }
    } catch (error) {
      console.error('Error toggling salon:', error);
      toast.error('Failed to update salon status');
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Manual Toggle Section */}
      <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-green-50 dark:from-gray-800 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1 flex items-center gap-2">
            <Calendar size={20} />
            Manual Open / Close Control
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {manualToggle.is_overridden ? (
              manualToggle.is_open ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Manually <strong>Open</strong> — override active
                </span>
              ) : (manualToggle.closed_mode === 'online_only') ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <strong>Closed Online</strong> — Walk-in & QR bookings still allowed
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <strong>Fully Closed</strong> — Online & Offline bookings paused
                </span>
              )
            ) : 'Following automatic schedule'}
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => handleManualToggle('open')}
              disabled={toggling || (!manualToggle.is_overridden && manualToggle.is_open)}
              className={`${
                manualToggle.is_open && !manualToggle.is_overridden
                  ? 'bg-green-600 ring-2 ring-green-300'
                  : 'bg-green-500 hover:bg-green-600'
              } text-white font-semibold px-4 py-2 rounded-lg shadow`}
              title="Salon is open and accepting all bookings"
            >
              {toggling ? <Loader2 className="animate-spin mr-2" size={18} /> : <ToggleRight className="mr-2" size={18} />}
              Open Salon
            </Button>

            <Button
              onClick={() => handleManualToggle('close_online')}
              disabled={toggling || (manualToggle.is_overridden && manualToggle.closed_mode === 'online_only')}
              className={`${
                manualToggle.is_overridden && manualToggle.closed_mode === 'online_only'
                  ? 'bg-amber-600 ring-2 ring-amber-300'
                  : 'bg-amber-500 hover:bg-amber-600'
              } text-white font-semibold px-4 py-2 rounded-lg shadow`}
              title="Stop online bookings — walk-ins / QR / salon-side bookings still work"
            >
              {toggling ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
              Close Online Only
            </Button>

            <Button
              onClick={() => handleManualToggle('close_full')}
              disabled={toggling || (manualToggle.is_overridden && manualToggle.closed_mode === 'full')}
              className={`${
                manualToggle.is_overridden && manualToggle.closed_mode === 'full'
                  ? 'bg-red-700 ring-2 ring-red-300'
                  : 'bg-red-500 hover:bg-red-600'
              } text-white font-semibold px-4 py-2 rounded-lg shadow`}
              title="Salon is fully closed — no bookings via any channel"
            >
              {toggling ? <Loader2 className="animate-spin mr-2" size={18} /> : <ToggleLeft className="mr-2" size={18} />}
              Close Salon (Online &amp; Offline)
            </Button>
          </div>
        </div>
      </div>

      {/* Operational Hours Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Clock size={20} />
            Weekly Operational Hours
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Set day-wise timings, lunch breaks, and holidays. Bookings are blocked only on holidays.
          </p>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {daysOfWeek.map((day) => (
            <div key={day} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Day Label & Holiday Checkbox */}
                <div className="flex items-center gap-4 lg:w-48">
                  <Label className="text-base font-semibold text-gray-800 dark:text-white min-w-[100px]">
                    {dayLabels[day]}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={operationalHours[day]?.is_holiday || false}
                      onCheckedChange={(checked) => handleDayChange(day, 'is_holiday', checked)}
                      id={`${day}-holiday`}
                    />
                    <Label htmlFor={`${day}-holiday`} className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                      Holiday
                    </Label>
                  </div>
                </div>

                {/* Time Fields */}
                {!operationalHours[day]?.is_holiday && (
                  <div className="flex flex-wrap gap-4 flex-1">
                    {/* Opening Time */}
                    <div className="flex-1 min-w-[120px]">
                      <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1">Opening</Label>
                      <Input
                        type="time"
                        value={operationalHours[day]?.opening_time || '09:00'}
                        onChange={(e) => handleDayChange(day, 'opening_time', e.target.value)}
                        className="w-full"
                      />
                    </div>

                    {/* Closing Time */}
                    <div className="flex-1 min-w-[120px]">
                      <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1">Closing</Label>
                      <Input
                        type="time"
                        value={operationalHours[day]?.closing_time || '20:00'}
                        onChange={(e) => handleDayChange(day, 'closing_time', e.target.value)}
                        className="w-full"
                      />
                    </div>

                    {/* Lunch Start */}
                    <div className="flex-1 min-w-[120px]">
                      <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1">Lunch Start</Label>
                      <Input
                        type="time"
                        value={operationalHours[day]?.lunch_start || ''}
                        onChange={(e) => handleDayChange(day, 'lunch_start', e.target.value || null)}
                        className="w-full"
                        placeholder="Optional"
                      />
                    </div>

                    {/* Lunch End */}
                    <div className="flex-1 min-w-[120px]">
                      <Label className="text-xs text-gray-600 dark:text-gray-400 mb-1">Lunch End</Label>
                      <Input
                        type="time"
                        value={operationalHours[day]?.lunch_end || ''}
                        onChange={(e) => handleDayChange(day, 'lunch_end', e.target.value || null)}
                        className="w-full"
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                )}

                {operationalHours[day]?.is_holiday && (
                  <div className="flex-1 text-sm text-red-600 dark:text-red-400 font-medium">
                    🚫 Closed - Holiday
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Save Button */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-2 rounded-lg shadow-md"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin mr-2" size={16} />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2" size={16} />
                Save Operational Hours
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
