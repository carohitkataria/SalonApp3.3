import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Calendar, ChevronLeft, ChevronRight, Check, X, Clock, DollarSign, 
  Loader2, AlertCircle, CheckCircle, Banknote, CreditCard, Building
} from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STATUS_COLORS = {
  present: 'bg-green-500 text-white',
  half_day: 'bg-yellow-500 text-black',
  absent: 'bg-red-500 text-white',
  holiday: 'bg-purple-500 text-white',
  future: 'bg-muted text-muted-foreground'
};

const STATUS_LABELS = {
  present: 'P',
  half_day: 'H',
  absent: 'A',
  holiday: '🎉'
};

export default function StaffAttendanceTab({ salonId, barberId, barberName, compensation }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [attendance, setAttendance] = useState([]);
  const [salary, setSalary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNote, setPaymentNote] = useState('');

  const token = localStorage.getItem('salon_admin_token') || 
    JSON.parse(localStorage.getItem('salon_user_auth') || '{}')?.token;

  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  useEffect(() => {
    fetchAttendanceData();
    fetchSalaryData();
  }, [currentMonth, salonId, barberId]);

  const fetchAttendanceData = async () => {
    if (!salonId || !barberId) return;
    setLoading(true);
    try {
      const response = await axios.get(
        `${API}/salons/${salonId}/attendance/${currentMonth}?barber_id=${barberId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const barberData = response.data.barbers?.find(b => b.barber_id === barberId);
      setAttendance(barberData?.attendance || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalaryData = async () => {
    if (!salonId || !barberId) return;
    try {
      const response = await axios.get(
        `${API}/salons/${salonId}/salary/${currentMonth}?barber_id=${barberId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const salaryRecord = response.data.salary_records?.find(s => s.barber_id === barberId);
      setSalary(salaryRecord);
    } catch (error) {
      console.error('Error fetching salary:', error);
    }
  };

  const handleCalculateAttendance = async () => {
    // Calculate for all days up to today in the current month
    const endDay = currentMonth === todayStr.slice(0, 7) ? today.getDate() : daysInMonth;
    
    setLoading(true);
    try {
      for (let day = 1; day <= endDay; day++) {
        const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
        await axios.post(
          `${API}/salons/${salonId}/attendance/calculate/${dateStr}`,
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
    // Cycle through statuses: present -> half_day -> absent -> holiday -> present
    const statusCycle = ['present', 'half_day', 'absent', 'holiday'];
    const currentIndex = statusCycle.indexOf(currentStatus || 'absent');
    const newStatus = statusCycle[(currentIndex + 1) % statusCycle.length];
    
    try {
      await axios.put(
        `${API}/salons/${salonId}/attendance/${barberId}/${dateStr}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Marked as ${newStatus.replace('_', ' ')}`);
      fetchAttendanceData();
      fetchSalaryData();
    } catch (error) {
      toast.error('Failed to update attendance');
    }
  };

  const handlePaySalary = async () => {
    try {
      await axios.post(
        `${API}/salons/${salonId}/salary/${barberId}/${currentMonth}/pay`,
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
      {/* Attendance Calendar */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gold" />
            Attendance - {barberName}
          </h3>
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
            const status = record?.status || (isFuture ? 'future' : null);
            
            return (
              <button
                key={item.key}
                type="button"
                disabled={isFuture}
                onClick={() => !isFuture && handleOverrideAttendance(dateStr, status)}
                className={`h-10 rounded text-xs font-bold transition-all ${
                  isFuture
                    ? 'bg-muted/30 text-muted-foreground cursor-not-allowed'
                    : status
                    ? STATUS_COLORS[status]
                    : 'bg-muted/50 hover:bg-muted cursor-pointer'
                } ${record?.auto_calculated === false ? 'ring-2 ring-gold' : ''}`}
                title={isFuture ? 'Future date' : `Click to change (${status || 'not marked'})`}
              >
                <div className="flex flex-col items-center">
                  <span className={isFuture ? '' : 'text-[10px] opacity-70'}>{day}</span>
                  {status && !isFuture && (
                    <span className="text-[10px]">{STATUS_LABELS[status]}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          💡 Click on any date to change status. Gold ring = manually overridden.
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
