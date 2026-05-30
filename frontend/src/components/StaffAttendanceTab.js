import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Calendar, ChevronLeft, ChevronRight, Check, X, Clock, DollarSign, 
  Loader2, AlertCircle, CheckCircle, Banknote, CreditCard, Building, Plane
} from 'lucide-react';
import { motion } from 'framer-motion';
import LeaveBalanceCard from '@/components/leave/LeaveBalanceCard';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STATUS_COLORS = {
  present: 'bg-green-500 text-white',
  half_day: 'bg-yellow-500 text-black',
  absent: 'bg-red-500 text-white',
  holiday: 'bg-purple-500 text-white',
  on_leave: 'bg-blue-500 text-white',
  future: 'bg-muted text-muted-foreground'
};

const STATUS_LABELS = {
  present: 'P',
  half_day: 'H',
  absent: 'A',
  holiday: '🎉',
  on_leave: 'L'
};

export default function StaffAttendanceTab({ salonId, barberId, barberName, compensation }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [attendance, setAttendance] = useState([]);
  const [salary, setSalary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [leaveMode, setLeaveMode] = useState(false);
  // Barber's employment dates + per-date leave list
  const [leaveInfo, setLeaveInfo] = useState({ doj: null, last_working_date: null, leave_dates: [] });

  const token = localStorage.getItem('salon_admin_token') || 
    JSON.parse(localStorage.getItem('salon_user_auth') || '{}')?.token;

  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const fetchAttendanceData = useCallback(async () => {
    if (!salonId || !barberId) return;
    setLoading(true);
    try {
      const response = await axios.get(
        `${API}/salons/${salonId}/staff-attendance/month/${currentMonth}?barber_id=${barberId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const barberData = response.data.barbers?.find(b => b.barber_id === barberId);
      setAttendance(barberData?.attendance || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  }, [salonId, barberId, currentMonth, token]);

  const fetchSalaryData = useCallback(async () => {
    if (!salonId || !barberId) return;
    try {
      const response = await axios.get(
        `${API}/salons/${salonId}/staff-salary/month/${currentMonth}?barber_id=${barberId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const salaryRecord = response.data.salary_records?.find(s => s.barber_id === barberId);
      setSalary(salaryRecord);
    } catch (error) {
      console.error('Error fetching salary:', error);
    }
  }, [salonId, barberId, currentMonth, token]);

  const fetchLeaveInfo = useCallback(async () => {
    if (!salonId || !barberId) return;
    try {
      const response = await axios.get(
        `${API}/salons/${salonId}/barbers/${barberId}/leave-dates`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setLeaveInfo({
        doj: response.data.doj || null,
        last_working_date: response.data.last_working_date || null,
        leave_dates: response.data.leave_dates || [],
      });
    } catch (error) {
      console.error('Error fetching leave info:', error);
    }
  }, [salonId, barberId, token]);

  useEffect(() => {
    fetchAttendanceData();
    fetchSalaryData();
    fetchLeaveInfo();
  }, [fetchAttendanceData, fetchSalaryData, fetchLeaveInfo]);

  const handleCalculateAttendance = async () => {
    // Calculate for all days up to today in the current month
    const endDay = currentMonth === todayStr.slice(0, 7) ? today.getDate() : daysInMonth;
    
    setLoading(true);
    try {
      for (let day = 1; day <= endDay; day++) {
        const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
        await axios.post(
          `${API}/salons/${salonId}/staff-attendance/calculate/${dateStr}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      toast.success('Attendance calculated based on completed bookings');
      fetchAttendanceData();
      fetchSalaryData();
    } catch (error) {
      toast.error('Failed to calculate attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleOverrideAttendance = async (dateStr, currentStatus) => {
    // Cycle through statuses: present -> half_day -> absent -> holiday -> blank (no status)
    // After "holiday", clicking again clears the entry (DELETE) and the day shows as unset.
    const statusCycle = ['present', 'half_day', 'absent', 'holiday', null];
    let nextStatus;
    if (!currentStatus) {
      nextStatus = 'present'; // Blank → Present (start of cycle)
    } else {
      const idx = statusCycle.indexOf(currentStatus);
      // If currentStatus is unknown, default to "present" so users can recover.
      nextStatus = idx === -1 ? 'present' : statusCycle[(idx + 1) % statusCycle.length];
    }

    try {
      if (nextStatus === null) {
        // Clear the override (the cell becomes blank / no status)
        await axios.delete(
          `${API}/salons/${salonId}/staff-attendance/override/${barberId}/${dateStr}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Attendance cleared');
      } else {
        await axios.put(
          `${API}/salons/${salonId}/staff-attendance/override/${barberId}/${dateStr}`,
          { status: nextStatus },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success(`Marked as ${nextStatus.replace('_', ' ')}`);
      }
      fetchAttendanceData();
      fetchSalaryData();
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to update attendance');
    }
  };

  const handleMarkAllPresent = async () => {
    if (loading || bulkLoading) return;
    if (!window.confirm(`Mark ${barberName || 'this barber'} as PRESENT for every eligible past day in ${monthName}? Days outside the joining/last-working-day window or marked on leave will be skipped.`)) {
      return;
    }
    setBulkLoading(true);
    try {
      // Iterate through all days up to today/end-of-month, calling the endpoint per-barber.
      // The mark-all-present endpoint operates per-date for the WHOLE salon — but here we want only THIS barber.
      // So we use the single override endpoint (with per-day eligibility validated server-side).
      const endDay = currentMonth === todayStr.slice(0, 7) ? today.getDate() : daysInMonth;
      let marked = 0, skipped = 0;
      for (let day = 1; day <= endDay; day++) {
        const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
        // Skip if day is outside joining/last-working-day or is a leave day
        if (leaveInfo.doj && dateStr < leaveInfo.doj) { skipped++; continue; }
        if (leaveInfo.last_working_date && dateStr > leaveInfo.last_working_date) { skipped++; continue; }
        if ((leaveInfo.leave_dates || []).includes(dateStr)) { skipped++; continue; }
        try {
          await axios.put(
            `${API}/salons/${salonId}/staff-attendance/override/${barberId}/${dateStr}`,
            { status: 'present', note: 'Bulk mark all present' },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          marked++;
        } catch (innerErr) {
          skipped++;
        }
      }
      toast.success(`Marked ${marked} day(s) as present${skipped ? ` (skipped ${skipped})` : ''}`);
      fetchAttendanceData();
      fetchSalaryData();
    } catch (error) {
      toast.error('Failed to mark all present');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleToggleLeave = async (dateStr) => {
    if (!dateStr) return;
    const isCurrentlyOnLeave = (leaveInfo.leave_dates || []).includes(dateStr);
    try {
      await axios.put(
        `${API}/salons/${salonId}/barbers/${barberId}/leave-date`,
        { date: dateStr, is_on_leave: !isCurrentlyOnLeave },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isCurrentlyOnLeave ? `Leave removed for ${dateStr}` : `${barberName || 'Barber'} marked on leave for ${dateStr}`);
      // Refresh leave info & attendance so calendar updates.
      fetchLeaveInfo();
      fetchAttendanceData();
      fetchSalaryData();
    } catch (error) {
      const detail = error?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Failed to update leave');
    }
  };

  const handlePaySalary = async () => {
    try {
      await axios.post(
        `${API}/salons/${salonId}/staff-salary/pay/${barberId}/${currentMonth}`,
        { payment_method: paymentMethod, note: paymentNote },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Salary marked as paid and financial transaction created');
      setShowPayDialog(false);
      setPaymentNote('');
      fetchSalaryData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to process payment');
    }
  };

  const getAttendanceForDate = (day) => {
    const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
    return attendance.find(a => a.date === dateStr);
  };

  const navigateMonth = (direction) => {
    const [y, m] = currentMonth.split('-').map(Number);
    let newMonth = m + direction;
    let newYear = y;
    
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    
    setCurrentMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  };

  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const days = [];
    // Empty cells for days before the first of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push({ type: 'empty', key: `empty-${i}` });
    }
    // Actual days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
      const isFuture = dateStr > todayStr;
      const record = getAttendanceForDate(day);
      days.push({
        type: 'day',
        day,
        dateStr,
        isFuture,
        record,
        key: `day-${day}`
      });
    }
    return days;
  }, [currentMonth, daysInMonth, firstDayOfMonth, attendance, todayStr]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Module 2 — Leave balance card */}
      <LeaveBalanceCard
        salonId={salonId}
        barberId={barberId}
        barberName={barberName}
      />

      {/* Attendance Calendar */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gold" />
            Attendance - {barberName}
          </h3>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleMarkAllPresent}
              disabled={loading || bulkLoading}
              variant="outline"
              size="sm"
              title="Bulk mark every eligible day this month as present"
            >
              {bulkLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Mark All Present
            </Button>
            <Button
              onClick={() => setLeaveMode(prev => !prev)}
              variant={leaveMode ? "default" : "outline"}
              size="sm"
              className={leaveMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
              title="When ON, clicking a date toggles ON/OFF leave"
            >
              <Plane className="w-4 h-4 mr-2" />
              {leaveMode ? 'Leave Mode: ON' : 'Leave Mode: OFF'}
            </Button>
            <Button
              onClick={handleCalculateAttendance}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Auto Calculate
            </Button>
          </div>
        </div>

        {/* Employment dates info row */}
        {(leaveInfo.doj || leaveInfo.last_working_date) && (
          <div className="flex flex-wrap gap-3 mb-4 text-xs">
            {leaveInfo.doj && (
              <span className="px-2 py-1 rounded-full bg-muted text-foreground">
                Joined: <strong>{leaveInfo.doj}</strong>
              </span>
            )}
            {leaveInfo.last_working_date && (
              <span className="px-2 py-1 rounded-full bg-red-500/10 text-red-600">
                Last working day: <strong>{leaveInfo.last_working_date}</strong>
              </span>
            )}
          </div>
        )}

        {/* Month Navigator */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h4 className="font-semibold text-lg">{monthName}</h4>
          <Button variant="ghost" size="sm" onClick={() => navigateMonth(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded bg-green-500 flex items-center justify-center text-white font-bold">P</div>
            <span>Present</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded bg-yellow-500 flex items-center justify-center text-black font-bold">H</div>
            <span>Half Day</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded bg-red-500 flex items-center justify-center text-white font-bold">A</div>
            <span>Absent</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded bg-purple-500 flex items-center justify-center text-white">🎉</div>
            <span>Holiday</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center text-white font-bold">L</div>
            <span>On Leave</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
              {day}
            </div>
          ))}
          
          {calendarDays.map((item) => {
            if (item.type === 'empty') {
              return <div key={item.key} className="h-10" />;
            }
            
            const { day, dateStr, isFuture, record } = item;
            const isOnLeaveDate = (leaveInfo.leave_dates || []).includes(dateStr);
            const beforeJoin = !!leaveInfo.doj && dateStr < leaveInfo.doj;
            const afterLast = !!leaveInfo.last_working_date && dateStr > leaveInfo.last_working_date;
            const outOfWindow = beforeJoin || afterLast;

            // Decide visual status: leave overrides record status
            const status = isOnLeaveDate
              ? 'on_leave'
              : (record?.status || (isFuture ? 'future' : null));
            
            // Click semantics:
            //  - If outOfWindow: disabled
            //  - Leave mode ON: toggles leave for ANY date (past/today/future) inside employment window
            //  - Otherwise: only past/today dates → cycle attendance status
            const canClick = !outOfWindow && (leaveMode || !isFuture);
            const handleClick = () => {
              if (!canClick) return;
              if (leaveMode) return handleToggleLeave(dateStr);
              return handleOverrideAttendance(dateStr, status);
            };

            const titleText = outOfWindow
              ? (beforeJoin ? `Before joining (${leaveInfo.doj})` : `After last working day (${leaveInfo.last_working_date})`)
              : leaveMode
                ? (isOnLeaveDate ? `Click to remove leave (${dateStr})` : `Click to mark on leave (${dateStr})`)
                : isFuture
                  ? 'Future date — turn on Leave Mode to set leave for this day'
                  : `Click to change (${status || 'not marked'})`;
            
            return (
              <button
                key={item.key}
                type="button"
                disabled={!canClick}
                onClick={handleClick}
                className={`h-10 rounded text-xs font-bold transition-all ${
                  outOfWindow
                    ? 'bg-muted/20 text-muted-foreground cursor-not-allowed opacity-40'
                    : status
                    ? STATUS_COLORS[status]
                    : (isFuture
                        ? (leaveMode ? 'bg-muted/50 hover:bg-blue-500/30 cursor-pointer' : 'bg-muted/30 text-muted-foreground cursor-not-allowed')
                        : 'bg-muted/50 hover:bg-muted cursor-pointer'
                      )
                } ${record?.auto_calculated === false || isOnLeaveDate ? 'ring-2 ring-gold' : ''} ${leaveMode && !outOfWindow ? 'ring-1 ring-blue-400/40' : ''}`}
                title={titleText}
              >
                <div className="flex flex-col items-center">
                  <span className={isFuture && !leaveMode ? '' : 'text-[10px] opacity-70'}>{day}</span>
                  {status && status !== 'future' && (
                    <span className="text-[10px]">{STATUS_LABELS[status]}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          💡 Click on any past/today date to cycle attendance.
          Toggle <strong>Leave Mode</strong> to mark/unmark leave on any date (incl. future).
          Days outside the employment window are disabled.
        </p>
      </div>

      {/* Salary Summary */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-gold" />
            Salary Summary - {monthName}
          </h3>
          {salary && !salary.is_paid && (
            <Button
              onClick={() => setShowPayDialog(true)}
              className="bg-gold text-black hover:bg-gold/90"
            >
              <Banknote className="w-4 h-4 mr-2" />
              Mark as Paid
            </Button>
          )}
          {salary?.is_paid && (
            <span className="px-3 py-1 bg-green-500/10 text-green-600 rounded-full text-sm font-semibold flex items-center gap-1">
              <Check className="w-4 h-4" /> Paid
            </span>
          )}
        </div>

        {salary ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground">Base Salary</p>
              <p className="text-xl font-bold text-foreground">₹{salary.base_salary}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground">Working Days</p>
              <p className="text-xl font-bold text-foreground">{salary.working_days}</p>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4">
              <p className="text-xs text-green-600">Present Days</p>
              <p className="text-xl font-bold text-green-600">{salary.present_days}</p>
            </div>
            <div className="bg-yellow-500/10 rounded-lg p-4">
              <p className="text-xs text-yellow-600">Half Days</p>
              <p className="text-xl font-bold text-yellow-600">{salary.half_days}</p>
            </div>
            <div className="bg-red-500/10 rounded-lg p-4">
              <p className="text-xs text-red-600">Absent Days</p>
              <p className="text-xl font-bold text-red-600">{salary.absent_days}</p>
            </div>
            <div className="bg-purple-500/10 rounded-lg p-4">
              <p className="text-xs text-purple-600">Holidays</p>
              <p className="text-xl font-bold text-purple-600">{salary.holidays}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground">Calculated Salary</p>
              <p className="text-xl font-bold text-foreground">₹{salary.calculated_salary}</p>
            </div>
            <div className="bg-gold/10 rounded-lg p-4">
              <p className="text-xs text-gold">Incentive</p>
              <p className="text-xl font-bold text-gold">₹{salary.incentive_amount || 0}</p>
            </div>
            <div className="bg-card border-2 border-gold rounded-lg p-4 col-span-2 md:col-span-4">
              <p className="text-sm text-gold font-semibold">Total Payable</p>
              <p className="text-3xl font-bold text-gold">₹{salary.total_payable}</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>No salary data yet. Click "Auto Calculate" to generate attendance.</p>
          </div>
        )}

        {salary?.is_paid && (
          <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-sm text-green-600">
              <Check className="w-4 h-4 inline mr-1" />
              Paid on {new Date(salary.paid_at).toLocaleDateString()} via {salary.payment_method?.toUpperCase()}
            </p>
          </div>
        )}
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Salary as Paid</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Amount to Pay</p>
              <p className="text-2xl font-bold text-gold">₹{salary?.total_payable || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                To: {barberName} | Month: {monthName}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'cash', label: 'Cash', icon: Banknote },
                  { id: 'upi', label: 'UPI', icon: CreditCard },
                  { id: 'bank', label: 'Bank', icon: Building }
                ].map(method => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethod(method.id)}
                    className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                      paymentMethod === method.id
                        ? 'border-gold bg-gold/10'
                        : 'border-border hover:border-gold/40'
                    }`}
                  >
                    <method.icon className={`w-5 h-5 ${paymentMethod === method.id ? 'text-gold' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-medium">{method.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Note (Optional)</Label>
              <Input
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="Add payment note..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>Cancel</Button>
            <Button onClick={handlePaySalary} className="bg-gold text-black hover:bg-gold/90">
              <Check className="w-4 h-4 mr-2" />
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
