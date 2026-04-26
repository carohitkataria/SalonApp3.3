import React from 'react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Scissors, Download, Calendar, Award, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import IncentiveDashboard from './IncentiveDashboard';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COLORS = ['#D4AF37', '#FFD700', '#B8860B', '#DAA520', '#F0E68C'];

export default function Analytics({ salonId, getAuthHeaders, isAdmin = true }) {
  const [section, setSection] = useState('performance');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const [dayWiseSales, setDayWiseSales] = useState([]);
  const [barberWiseSales, setBarberWiseSales] = useState([]);
  const [serviceWiseSales, setServiceWiseSales] = useState([]);
  const [genderDistribution, setGenderDistribution] = useState([]);
  const [detailedReport, setDetailedReport] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (salonId) {
      fetchAnalytics();
    }
  }, [salonId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [dayWise, barberWise, serviceWise, gender, detailed] = await Promise.all([
        axios.get(`${API}/analytics/day-wise-sales?salon_id=${salonId}&start_date=${dateRange.start}&end_date=${dateRange.end}`, { headers: getAuthHeaders() }),
        axios.get(`${API}/analytics/barber-wise-sales?salon_id=${salonId}&start_date=${dateRange.start}&end_date=${dateRange.end}`, { headers: getAuthHeaders() }),
        axios.get(`${API}/analytics/service-wise-sales?salon_id=${salonId}&start_date=${dateRange.start}&end_date=${dateRange.end}`, { headers: getAuthHeaders() }),
        axios.get(`${API}/analytics/gender-distribution?salon_id=${salonId}&start_date=${dateRange.start}&end_date=${dateRange.end}`, { headers: getAuthHeaders() }),
        axios.get(`${API}/analytics/detailed-report?salon_id=${salonId}&start_date=${dateRange.start}&end_date=${dateRange.end}`, { headers: getAuthHeaders() })
      ]);

      setDayWiseSales(dayWise.data.data || []);
      setBarberWiseSales(barberWise.data.data || []);
      setServiceWiseSales(serviceWise.data.data || []);
      setGenderDistribution(gender.data.data || []);
      setDetailedReport(detailed.data.data || []);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (detailedReport.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = [
      'Date', 'Token Number', 'Customer Name', 'Phone', 'Barber Name',
      'Services', 'Amount', 'Status', 'Shift', 'Call Time', 'Complete Time',
      'Time Taken', 'Payment Status'
    ];

    const csvContent = [
      headers.join(','),
      ...detailedReport.map(row => [
        row.date,
        row.token_number,
        row.customer_name,
        row.phone,
        row.barber_name,
        `"${row.services}"`,
        row.amount,
        row.status,
        row.shift,
        row.call_time,
        row.complete_time,
        row.time_taken,
        row.payment_status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `salon_report_${dateRange.start}_to_${dateRange.end}.csv`;
    link.click();
    toast.success('Report exported successfully!');
  };

  const exportToPDF = () => {
    toast.info('PDF export coming soon! Use CSV for now.');
  };

  const totalSales = dayWiseSales.reduce((sum, day) => sum + day.total_sales, 0);
  const totalBookings = dayWiseSales.reduce((sum, day) => sum + day.total_bookings, 0);

  return (
    <div className="space-y-6">
      {/* Sub-section tabs */}
      <div className="flex gap-2 border-b border-gold/20 pb-3">
        <button
          onClick={() => setSection('performance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            section === 'performance'
              ? 'bg-gold/15 text-gold border border-gold/40'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          data-testid="analytics-tab-performance"
        >
          <BarChart3 className="w-4 h-4" /> Performance
        </button>
        <button
          onClick={() => setSection('incentives')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
            section === 'incentives'
              ? 'bg-gold/15 text-gold border border-gold/40'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          data-testid="analytics-tab-incentives"
        >
          <Award className="w-4 h-4" /> Incentives
        </button>
      </div>

      {section === 'incentives' ? (
        <IncentiveDashboard
          salonId={salonId}
          getAuthHeaders={getAuthHeaders}
          isAdmin={isAdmin}
        />
      ) : (
        <PerformanceSection
          dateRange={dateRange}
          setDateRange={setDateRange}
          dayWiseSales={dayWiseSales}
          barberWiseSales={barberWiseSales}
          serviceWiseSales={serviceWiseSales}
          genderDistribution={genderDistribution}
          detailedReport={detailedReport}
          loading={loading}
          fetchAnalytics={fetchAnalytics}
          exportToCSV={exportToCSV}
          exportToPDF={exportToPDF}
          totalSales={totalSales}
          totalBookings={totalBookings}
        />
      )}
    </div>
  );
}

function PerformanceSection({
  dateRange, setDateRange, dayWiseSales, barberWiseSales, serviceWiseSales,
  genderDistribution, detailedReport, loading, fetchAnalytics, exportToCSV,
  exportToPDF, totalSales, totalBookings
}) {
  return (
    <div className="space-y-6">
      <div className="bg-card/50 backdrop-blur-sm border border-gold/20 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-playfair font-bold text-foreground flex items-center">
              <TrendingUp className="w-6 h-6 mr-3 text-gold" />
              Analytics Dashboard
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Track your salon's performance</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button onClick={exportToCSV} variant="outline" size="sm" className="border-gold/30">
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </Button>
            <Button onClick={exportToPDF} variant="outline" size="sm" className="border-gold/30">
              <Download className="w-4 h-4 mr-2" /> Export PDF
            </Button>
          </div>
        </div>

        {/* Date Range Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <Label className="mb-2 block">Start Date</Label>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
          </div>
          <div>
            <Label className="mb-2 block">End Date</Label>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </div>
          <Button onClick={fetchAnalytics} className="bg-gold text-black hover:bg-gold/90" disabled={loading}>
            <Calendar className="w-4 h-4 mr-2" />
            {loading ? 'Loading...' : 'Apply Filter'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Sales</p>
              <p className="text-3xl font-bold text-gold mt-1">₹{totalSales.toLocaleString()}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-gold/50" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/30 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Bookings</p>
              <p className="text-3xl font-bold text-blue-500 mt-1">{totalBookings}</p>
            </div>
            <Scissors className="w-12 h-12 text-blue-500/50" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30 rounded-xl p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg. Per Booking</p>
              <p className="text-3xl font-bold text-green-500 mt-1">
                ₹{totalBookings > 0 ? Math.round(totalSales / totalBookings) : 0}
              </p>
            </div>
            <Users className="w-12 h-12 text-green-500/50" />
          </div>
        </motion.div>
      </div>

      {/* Charts Row 1: Day-wise Sales */}
      <div className="bg-card/50 backdrop-blur-sm border border-gold/20 rounded-2xl p-6 shadow-xl">
        <h3 className="text-lg font-bold text-foreground mb-4">Day-wise Sales</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dayWiseSales}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="date" stroke="#888" />
            <YAxis stroke="#888" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #D4AF37' }}
              labelStyle={{ color: '#D4AF37' }}
            />
            <Legend />
            <Bar dataKey="total_sales" fill="#D4AF37" name="Sales (₹)" />
            <Bar dataKey="total_bookings" fill="#4CAF50" name="Bookings" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Charts Row 2: Barber-wise + Gender Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Barber-wise Sales */}
        <div className="bg-card/50 backdrop-blur-sm border border-gold/20 rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-bold text-foreground mb-4">Barber-wise Sales</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barberWiseSales} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis type="number" stroke="#888" />
              <YAxis dataKey="barber_name" type="category" stroke="#888" width={100} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #D4AF37' }}
                labelStyle={{ color: '#D4AF37' }}
              />
              <Bar dataKey="total_sales" fill="#D4AF37" name="Sales (₹)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Gender Distribution */}
        <div className="bg-card/50 backdrop-blur-sm border border-gold/20 rounded-2xl p-6 shadow-xl">
          <h3 className="text-lg font-bold text-foreground mb-4">Customer Gender Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={genderDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {genderDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Services */}
      <div className="bg-card/50 backdrop-blur-sm border border-gold/20 rounded-2xl p-6 shadow-xl">
        <h3 className="text-lg font-bold text-foreground mb-4">Top 10 Services</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={serviceWiseSales}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="service_name" stroke="#888" angle={-45} textAnchor="end" height={100} />
            <YAxis stroke="#888" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #D4AF37' }}
              labelStyle={{ color: '#D4AF37' }}
            />
            <Bar dataKey="count" fill="#D4AF37" name="Times Booked" />
            <Bar dataKey="revenue" fill="#4CAF50" name="Revenue (₹)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Data Table */}
      <div className="bg-card/50 backdrop-blur-sm border border-gold/20 rounded-2xl p-6 shadow-xl">
        <h3 className="text-lg font-bold text-foreground mb-4">Detailed Report</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gold/10 border-b border-gold/30">
              <tr>
                <th className="text-left p-3 text-foreground">Date</th>
                <th className="text-left p-3 text-foreground">Token</th>
                <th className="text-left p-3 text-foreground">Customer</th>
                <th className="text-left p-3 text-foreground">Phone</th>
                <th className="text-left p-3 text-foreground">Barber</th>
                <th className="text-left p-3 text-foreground">Services</th>
                <th className="text-left p-3 text-foreground">Amount</th>
                <th className="text-left p-3 text-foreground">Status</th>
                <th className="text-left p-3 text-foreground">Time Taken</th>
              </tr>
            </thead>
            <tbody>
              {detailedReport.map((row, idx) => (
                <tr key={idx} className="border-b border-border hover:bg-gold/5">
                  <td className="p-3 text-muted-foreground">{row.date}</td>
                  <td className="p-3 text-gold font-bold">{row.token_number}</td>
                  <td className="p-3 text-foreground">{row.customer_name}</td>
                  <td className="p-3 text-muted-foreground">{row.phone}</td>
                  <td className="p-3 text-foreground">{row.barber_name}</td>
                  <td className="p-3 text-muted-foreground">{row.services}</td>
                  <td className="p-3 text-gold font-bold">₹{row.amount}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      row.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                      row.status === 'skipped' ? 'bg-orange-500/20 text-orange-500' :
                      'bg-red-500/20 text-red-500'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{row.time_taken || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {detailedReport.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No data available for selected date range
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
