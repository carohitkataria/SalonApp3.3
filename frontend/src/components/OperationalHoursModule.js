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
    <div className="p-3 sm:p-4 max-w-5xl mx-auto">
      {/* Manual Toggle Section — compact 3-state segmented control */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 dark:from-gray-800 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Calendar size={16} />
              Salon Status
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {manualToggle.is_overridden ? (
                manualToggle.is_open ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Manually <strong>Open</strong>
                  </span>
                ) : (manualToggle.closed_mode === 'online_only') ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <strong>Closed Online</strong> · Walk-in &amp; QR allowed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <strong>Fully Closed</strong> · No bookings
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Auto schedule
                </span>
              )}
            </p>
          </div>

          {/* 3-state segmented slider */}
          <div className="relative inline-flex items-stretch w-full sm:w-auto rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 overflow-hidden text-xs font-semibold shadow-sm">
            {(() => {
              const current = !manualToggle.is_overridden
                ? 'open'
                : manualToggle.is_open
                  ? 'open'
                  : manualToggle.closed_mode === 'online_only'
                    ? 'online'
                    : 'full';
              const segments = [
                { id: 'open',   label: 'Open',          action: 'open',         active: 'bg-green-500 text-white',  hover: 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-700 dark:text-green-400' },
                { id: 'online', label: 'Online Closed', action: 'close_online', active: 'bg-amber-500 text-white',  hover: 'hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-700 dark:text-amber-400' },
                { id: 'full',   label: 'Closed',        action: 'close_full',   active: 'bg-red-600 text-white',    hover: 'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-700 dark:text-red-400' },
              ];
              return segments.map((seg, idx) => {
                const isActive = current === seg.id;
                return (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => !isActive && handleManualToggle(seg.action)}
                    disabled={toggling || isActive}
                    title={
                      seg.id === 'open' ? 'Salon is open and accepting all bookings' :
                      seg.id === 'online' ? 'Stop online bookings — walk-ins / QR / salon-side bookings still work' :
                      'Salon is fully closed — no bookings via any channel'
                    }
                    className={`flex-1 sm:flex-none px-3 py-2 transition-all duration-200 ${
                      isActive
                        ? `${seg.active} cursor-default`
                        : `${seg.hover} cursor-pointer`
                    } ${idx > 0 ? 'border-l border-gray-300 dark:border-gray-600' : ''}`}
                  >
                    {toggling && !isActive ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin inline" />
                    ) : (
                      seg.label
                    )}
                  </button>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* Operational Hours Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <Clock size={16} />
            Weekly Operational Hours
          </h3>
          <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
            Day-wise timings, lunch breaks &amp; holidays. Bookings blocked only on holidays.
          </p>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {daysOfWeek.map((day) => (
            <div key={day} className="px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3">
                {/* Day Label & Holiday Checkbox */}
                <div className="flex items-center gap-3 lg:w-44">
                  <Label className="text-sm font-semibold text-gray-800 dark:text-white min-w-[84px]">
                    {dayLabels[day]}
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      checked={operationalHours[day]?.is_holiday || false}
                      onCheckedChange={(checked) => handleDayChange(day, 'is_holiday', checked)}
                      id={`${day}-holiday`}
                      className="h-4 w-4"
                    />
                    <Label htmlFor={`${day}-holiday`} className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                      Holiday
                    </Label>
                  </div>
                </div>

                {/* Time Fields */}
                {!operationalHours[day]?.is_holiday && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
                    {/* Opening Time */}
                    <div>
                      <Label className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5 block">Opening</Label>
                      <Input
                        type="time"
                        value={operationalHours[day]?.opening_time || '09:00'}
                        onChange={(e) => handleDayChange(day, 'opening_time', e.target.value)}
                        className="w-full h-8 text-xs"
                      />
                    </div>

                    {/* Closing Time */}
                    <div>
                      <Label className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5 block">Closing</Label>
                      <Input
                        type="time"
                        value={operationalHours[day]?.closing_time || '20:00'}
                        onChange={(e) => handleDayChange(day, 'closing_time', e.target.value)}
                        className="w-full h-8 text-xs"
                      />
                    </div>

                    {/* Lunch Start */}
                    <div>
                      <Label className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5 block">Lunch Start</Label>
                      <Input
                        type="time"
                        value={operationalHours[day]?.lunch_start || ''}
                        onChange={(e) => handleDayChange(day, 'lunch_start', e.target.value || null)}
                        className="w-full h-8 text-xs"
                        placeholder="Optional"
                      />
                    </div>

                    {/* Lunch End */}
                    <div>
                      <Label className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5 block">Lunch End</Label>
                      <Input
                        type="time"
                        value={operationalHours[day]?.lunch_end || ''}
                        onChange={(e) => handleDayChange(day, 'lunch_end', e.target.value || null)}
                        className="w-full h-8 text-xs"
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
        <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 rounded-lg shadow-sm"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin mr-2" size={14} />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2" size={14} />
                Save Operational Hours
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
