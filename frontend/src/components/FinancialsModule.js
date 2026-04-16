import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  DollarSign, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle,
  Plus, Download, Settings, Calendar, ChevronLeft, ChevronRight,
  Banknote, CreditCard, Smartphone, Wallet, Trash2, FileText
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const EXPENSE_CATEGORIES = [
  { value: 'salary', label: 'Salary' },
  { value: 'staff_refreshment', label: 'Staff Refreshment' },
  { value: 'consumables', label: 'Consumables' },
  { value: 'utilities', label: 'Utilities (Electric/Water)' },
  { value: 'rent', label: 'Rent' },
  { value: 'maintenance', label: 'Maintenance & Repairs' },
  { value: 'products', label: 'Products & Supplies' },
  { value: 'marketing', label: 'Marketing & Advertising' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'custom', label: 'Custom / Other' },
];

const CATEGORY_LABELS = {
  booking_payment: 'Booking',
  membership_payment: 'Membership',
  salary: 'Salary',
  staff_refreshment: 'Staff Refreshment',
  consumables: 'Consumables',
  utilities: 'Utilities',
  rent: 'Rent',
  maintenance: 'Maintenance',
  products: 'Products',
  marketing: 'Marketing',
  equipment: 'Equipment',
  custom: 'Custom',
  withdrawal: 'Withdrawal',
  deposit: 'Deposit',
  adjustment: 'Adjustment',
};

const MODE_ICONS = {
  cash: Banknote,
  upi: Smartphone,
  card: CreditCard,
  wallet: Wallet,
};

export default function FinancialsModule({ salonId, getAuthHeaders }) {
  const [activeView, setActiveView] = useState('dashboard'); // dashboard | transactions | settings
  const [period, setPeriod] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Add transaction dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [txnType, setTxnType] = useState('outflow'); // outflow | withdrawal | deposit | adjustment
  const [txnCategory, setTxnCategory] = useState('salary');
  const [txnAmount, setTxnAmount] = useState('');
  const [txnMode, setTxnMode] = useState('cash');
  const [txnNarration, setTxnNarration] = useState('');
  const [txnDate, setTxnDate] = useState(new Date().toISOString().slice(0, 10));

  // Settings
  const [openingBalance, setOpeningBalance] = useState(0);
  const [openingBalanceDate, setOpeningBalanceDate] = useState(new Date().toISOString().slice(0, 10));

  // Transactions filter
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [allTransactions, setAllTransactions] = useState([]);

  useEffect(() => {
    if (salonId) {
      fetchDashboard();
    }
  }, [salonId, period, selectedDate, selectedMonth]);

  useEffect(() => {
    if (salonId && activeView === 'settings') {
      fetchSettings();
    }
  }, [salonId, activeView]);

  useEffect(() => {
    if (salonId && activeView === 'transactions') {
      fetchAllTransactions();
    }
  }, [salonId, activeView, filterStartDate, filterEndDate]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const dateParam = period === 'daily' ? selectedDate : selectedMonth;
      const response = await axios.get(
        `${API}/salons/${salonId}/financials/dashboard?period=${period}&date=${dateParam}`,
        { headers: getAuthHeaders() }
      );
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/financials/settings`, { headers: getAuthHeaders() });
      setOpeningBalance(response.data.opening_balance || 0);
      setOpeningBalanceDate(response.data.opening_balance_date || new Date().toISOString().slice(0, 10));
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchAllTransactions = async () => {
    try {
      let url = `${API}/salons/${salonId}/financials/transactions?limit=500`;
      if (filterStartDate) url += `&start_date=${filterStartDate}`;
      if (filterEndDate) url += `&end_date=${filterEndDate}`;
      const response = await axios.get(url, { headers: getAuthHeaders() });
      setAllTransactions(response.data.transactions || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await axios.put(
        `${API}/salons/${salonId}/financials/settings`,
        { opening_balance: parseFloat(openingBalance), opening_balance_date: openingBalanceDate },
        { headers: getAuthHeaders() }
      );
      toast.success('Opening balance saved');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  const handleAddTransaction = async () => {
    if (!txnAmount || parseFloat(txnAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      let finalType = txnType;
      let finalCategory = txnCategory;
      if (txnType === 'withdrawal') { finalType = 'withdrawal'; finalCategory = 'withdrawal'; }
      if (txnType === 'deposit') { finalType = 'deposit'; finalCategory = 'deposit'; }
      if (txnType === 'adjustment') { finalType = 'adjustment'; finalCategory = 'adjustment'; }

      await axios.post(
        `${API}/salons/${salonId}/financials/transactions`,
        {
          type: finalType,
          category: finalCategory,
          amount: parseFloat(txnAmount),
          payment_mode: txnMode,
          narration: txnNarration,
          date: txnDate
        },
        { headers: getAuthHeaders() }
      );
      toast.success('Transaction recorded');
      setShowAddDialog(false);
      resetTxnForm();
      fetchDashboard();
      if (activeView === 'transactions') fetchAllTransactions();
    } catch (error) {
      toast.error('Failed to record transaction');
    }
  };

  const handleDeleteTransaction = async (txnId) => {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await axios.delete(`${API}/salons/${salonId}/financials/transactions/${txnId}`, { headers: getAuthHeaders() });
      toast.success('Transaction deleted');
      fetchDashboard();
      if (activeView === 'transactions') fetchAllTransactions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleDownloadCSV = () => {
    let url = `${API}/salons/${salonId}/financials/report/csv?`;
    if (filterStartDate) url += `start_date=${filterStartDate}&`;
    if (filterEndDate) url += `end_date=${filterEndDate}&`;
    // Open in new tab to download
    const token = localStorage.getItem('salon_token');
    // Use fetch with auth
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `financials_report.csv`;
        link.click();
      })
      .catch(() => toast.error('Failed to download CSV'));
  };

  const resetTxnForm = () => {
    setTxnAmount('');
    setTxnNarration('');
    setTxnCategory('salary');
    setTxnMode('cash');
    setTxnType('outflow');
    setTxnDate(new Date().toISOString().slice(0, 10));
  };

  const navigateDate = (direction) => {
    if (period === 'daily') {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + direction);
      setSelectedDate(d.toISOString().slice(0, 10));
    } else {
      const d = new Date(selectedMonth + '-01');
      d.setMonth(d.getMonth() + direction);
      setSelectedMonth(d.toISOString().slice(0, 7));
    }
  };

  const formatCurrency = (val) => `₹${(val || 0).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {['dashboard', 'transactions', 'settings'].map(v => (
            <button
              key={v}
              onClick={() => setActiveView(v)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${
                activeView === v ? 'bg-gold text-black shadow' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => { resetTxnForm(); setShowAddDialog(true); }} className="bg-gold text-black hover:bg-gold/90 h-8 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Entry
          </Button>
        </div>
      </div>

      {/* ===== DASHBOARD VIEW ===== */}
      {activeView === 'dashboard' && (
        <div className="space-y-4">
          {/* Period Toggle + Date Nav */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setPeriod('daily')}
                className={`px-3 py-1 rounded text-xs font-medium ${period === 'daily' ? 'bg-gold text-black' : 'text-muted-foreground'}`}
              >
                Daily
              </button>
              <button
                onClick={() => setPeriod('monthly')}
                className={`px-3 py-1 rounded text-xs font-medium ${period === 'monthly' ? 'bg-gold text-black' : 'text-muted-foreground'}`}
              >
                Monthly
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigateDate(-1)} className="p-1 hover:bg-muted rounded"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-sm font-semibold min-w-[120px] text-center">
                {period === 'daily'
                  ? new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : new Date(selectedMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
                }
              </span>
              <button onClick={() => navigateDate(1)} className="p-1 hover:bg-muted rounded"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : dashboardData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard label="Opening" value={formatCurrency(dashboardData.opening_balance)} icon={Wallet} color="text-blue-500" />
                <SummaryCard label="Inflow" value={formatCurrency(dashboardData.total_inflow)} icon={ArrowUpCircle} color="text-green-500" />
                <SummaryCard label="Outflow" value={formatCurrency(dashboardData.total_outflow)} icon={ArrowDownCircle} color="text-red-500" />
                <SummaryCard label="Closing" value={formatCurrency(dashboardData.closing_balance)} icon={DollarSign} color="text-gold" />
              </div>

              {/* Net Cash Flow */}
              <div className={`p-4 rounded-xl border-2 text-center ${
                dashboardData.net >= 0 ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'
              }`}>
                <p className="text-xs text-muted-foreground mb-1">Net Cash Flow</p>
                <p className={`text-2xl font-bold ${dashboardData.net >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {dashboardData.net >= 0 ? '+' : ''}{formatCurrency(dashboardData.net)}
                </p>
              </div>

              {/* Inflow by Mode */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-xl p-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-500" /> Inflow by Mode</h4>
                  <div className="space-y-2">
                    {Object.entries(dashboardData.inflow_by_mode || {}).map(([mode, amount]) => {
                      const Icon = MODE_ICONS[mode] || Banknote;
                      return amount > 0 ? (
                        <div key={mode} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2"><Icon className="w-4 h-4 text-muted-foreground" /><span className="capitalize">{mode}</span></div>
                          <span className="font-semibold text-green-500">{formatCurrency(amount)}</span>
                        </div>
                      ) : null;
                    })}
                    {Object.values(dashboardData.inflow_by_mode || {}).every(v => v === 0) && (
                      <p className="text-xs text-muted-foreground text-center py-2">No inflow</p>
                    )}
                  </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-500" /> Outflow by Category</h4>
                  <div className="space-y-2">
                    {Object.entries(dashboardData.outflow_by_category || {}).map(([cat, amount]) => (
                      <div key={cat} className="flex items-center justify-between text-sm">
                        <span>{CATEGORY_LABELS[cat] || cat}</span>
                        <span className="font-semibold text-red-500">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                    {Object.keys(dashboardData.outflow_by_category || {}).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">No outflow</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Monthly Bar Chart (simple) */}
              {period === 'monthly' && dashboardData.daily_breakdown?.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-4">
                  <h4 className="text-sm font-semibold mb-3">Daily Breakdown</h4>
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {dashboardData.daily_breakdown.map(day => {
                      const maxVal = Math.max(...dashboardData.daily_breakdown.map(d => Math.max(d.inflow, d.outflow)), 1);
                      return (
                        <div key={day.date} className="flex items-center gap-2 text-xs">
                          <span className="w-12 text-muted-foreground">{day.date.slice(8)}</span>
                          <div className="flex-1 flex gap-1 items-center">
                            <div className="h-4 bg-green-500/70 rounded-sm" style={{ width: `${(day.inflow / maxVal) * 100}%`, minWidth: day.inflow > 0 ? '4px' : '0' }} />
                            <span className="text-green-600 w-16 text-right">{day.inflow > 0 ? formatCurrency(day.inflow) : ''}</span>
                          </div>
                          <div className="flex-1 flex gap-1 items-center">
                            <div className="h-4 bg-red-500/70 rounded-sm" style={{ width: `${(day.outflow / maxVal) * 100}%`, minWidth: day.outflow > 0 ? '4px' : '0' }} />
                            <span className="text-red-600 w-16 text-right">{day.outflow > 0 ? formatCurrency(day.outflow) : ''}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent Transactions */}
              <div className="bg-card border border-border rounded-xl p-4">
                <h4 className="text-sm font-semibold mb-3">Transactions ({dashboardData.transactions?.length || 0})</h4>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {(dashboardData.transactions || []).map(txn => (
                    <TransactionRow key={txn.id} txn={txn} onDelete={handleDeleteTransaction} formatCurrency={formatCurrency} />
                  ))}
                  {(!dashboardData.transactions || dashboardData.transactions.length === 0) && (
                    <p className="text-xs text-muted-foreground text-center py-4">No transactions for this period</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No data available</div>
          )}
        </div>
      )}

      {/* ===== TRANSACTIONS VIEW ===== */}
      {activeView === 'transactions' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="h-8 text-sm w-40" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="h-8 text-sm w-40" />
            </div>
            <Button size="sm" variant="outline" onClick={handleDownloadCSV} className="h-8 text-xs">
              <Download className="w-3.5 h-3.5 mr-1" /> CSV
            </Button>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
              {allTransactions.map(txn => (
                <TransactionRow key={txn.id} txn={txn} onDelete={handleDeleteTransaction} formatCurrency={formatCurrency} />
              ))}
              {allTransactions.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">No transactions found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== SETTINGS VIEW ===== */}
      {activeView === 'settings' && (
        <div className="max-w-md mx-auto bg-card border border-border rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2"><Settings className="w-5 h-5 text-gold" /> Financial Settings</h3>
          <div>
            <Label className="text-sm font-semibold">Opening Cash Balance (₹)</Label>
            <Input
              type="number"
              value={openingBalance}
              onChange={e => setOpeningBalance(e.target.value)}
              className="mt-1"
              min={0}
            />
            <p className="text-xs text-muted-foreground mt-1">Set the starting cash balance of your salon</p>
          </div>
          <div>
            <Label className="text-sm font-semibold">As of Date</Label>
            <Input
              type="date"
              value={openingBalanceDate}
              onChange={e => setOpeningBalanceDate(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button onClick={handleSaveSettings} className="w-full bg-gold text-black hover:bg-gold/90">
            Save Settings
          </Button>
        </div>
      )}

      {/* ===== ADD TRANSACTION DIALOG ===== */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Financial Entry</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Type Selection */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-muted rounded-lg">
              {[
                { value: 'outflow', label: 'Expense' },
                { value: 'withdrawal', label: 'Withdraw' },
                { value: 'deposit', label: 'Deposit' },
                { value: 'adjustment', label: 'Adjust' },
              ].map(t => (
                <button
                  key={t.value}
                  onClick={() => setTxnType(t.value)}
                  className={`px-2 py-1.5 rounded text-xs font-medium transition-all ${
                    txnType === t.value ? 'bg-gold text-black shadow' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Category (only for expenses) */}
            {txnType === 'outflow' && (
              <div>
                <Label className="text-sm">Category</Label>
                <select
                  value={txnCategory}
                  onChange={e => setTxnCategory(e.target.value)}
                  className="w-full h-9 px-3 mt-1 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
                >
                  {EXPENSE_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Amount (₹)</Label>
                <Input
                  type="number"
                  value={txnAmount}
                  onChange={e => setTxnAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                  min={0}
                />
              </div>
              <div>
                <Label className="text-sm">Payment Mode</Label>
                <select
                  value={txnMode}
                  onChange={e => setTxnMode(e.target.value)}
                  className="w-full h-9 px-3 mt-1 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-sm">Date</Label>
              <Input type="date" value={txnDate} onChange={e => setTxnDate(e.target.value)} className="mt-1" />
            </div>

            <div>
              <Label className="text-sm">Narration</Label>
              <Input
                type="text"
                value={txnNarration}
                onChange={e => setTxnNarration(e.target.value)}
                placeholder="Brief explanation..."
                className="mt-1"
              />
            </div>

            <Button onClick={handleAddTransaction} className="w-full bg-gold text-black hover:bg-gold/90">
              Record Entry
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-components
function SummaryCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function TransactionRow({ txn, onDelete, formatCurrency }) {
  const isInflow = txn.type === 'inflow' || txn.type === 'deposit';
  const ModeIcon = MODE_ICONS[txn.payment_mode] || Banknote;
  
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors group text-sm">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isInflow ? 'bg-green-500/10' : 'bg-red-500/10'
      }`}>
        {isInflow ? <ArrowUpCircle className="w-4 h-4 text-green-500" /> : <ArrowDownCircle className="w-4 h-4 text-red-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{CATEGORY_LABELS[txn.category] || txn.category}</span>
          <ModeIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        </div>
        {txn.narration && <p className="text-[11px] text-muted-foreground truncate">{txn.narration}</p>}
      </div>
      <span className={`font-bold whitespace-nowrap ${isInflow ? 'text-green-500' : 'text-red-500'}`}>
        {isInflow ? '+' : '-'}{formatCurrency(txn.amount)}
      </span>
      {txn.reference_type === 'manual' && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(txn.id); }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded transition-opacity"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </button>
      )}
    </div>
  );
}
