import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  Trophy, Star, TrendingUp, DollarSign, Loader2, ChevronLeft, ChevronRight,
  Target, Award, Check, AlertCircle, Clock
} from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function StaffRewardsTab({ salonId, barberId, barberName }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(false);
  const [incentivePayout, setIncentivePayout] = useState(null);
  const [rewardPlans, setRewardPlans] = useState([]);
  const [metrics, setMetrics] = useState(null);

  const token = localStorage.getItem('salon_admin_token') || 
    JSON.parse(localStorage.getItem('salon_user_auth') || '{}')?.token;

  const [year, month] = currentMonth.split('-').map(Number);
  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  useEffect(() => {
    if (salonId && barberId) {
      fetchIncentiveData();
      fetchRewardPlans();
    }
  }, [currentMonth, salonId, barberId]);

  const fetchIncentiveData = async () => {
    setLoading(true);
    try {
      // Get incentive payout for this barber and month
      const response = await axios.get(
        `${API}/salons/${salonId}/reward-plans/incentive-payouts?barber_id=${barberId}&month=${currentMonth}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const payout = response.data.find(p => p.barber_id === barberId && p.month === currentMonth);
      setIncentivePayout(payout);
      
      // Get metrics
      if (payout) {
        setMetrics({
          total_revenue: payout.total_revenue,
          total_services: payout.total_services,
          average_rating: payout.average_rating,
          incentive_earned: payout.incentive_earned,
          qualifying_plans: payout.qualifying_plans || []
        });
      }
    } catch (error) {
      console.error('Error fetching incentive data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRewardPlans = async () => {
    try {
      const response = await axios.get(
        `${API}/salons/${salonId}/reward-plans`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRewardPlans(response.data || []);
    } catch (error) {
      console.error('Error fetching reward plans:', error);
    }
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'Paid':
        return 'bg-green-500/10 text-green-600 border-green-500/30';
      case 'Approved':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case 'Hold':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header with Month Navigator */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-gold" />
            Employee Rewards - {barberName}
          </h3>
        </div>

        {/* Month Navigator */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h4 className="font-semibold text-lg">{monthName}</h4>
          <Button variant="ghost" size="sm" onClick={() => navigateMonth(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gold" />
            <p className="text-muted-foreground mt-2">Loading reward data...</p>
          </div>
        ) : (
          <>
            {/* Performance Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-gold" />
                  <span className="text-xs text-muted-foreground">Revenue</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  ₹{metrics?.total_revenue?.toLocaleString() || 0}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Services</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {metrics?.total_services || 0}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs text-muted-foreground">Avg Rating</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {metrics?.average_rating?.toFixed(1) || '-'}
                </p>
              </div>
              <div className="bg-gold/10 rounded-lg p-4 border border-gold/30">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-gold" />
                  <span className="text-xs text-gold">Incentive Earned</span>
                </div>
                <p className="text-2xl font-bold text-gold">
                  ₹{metrics?.incentive_earned?.toLocaleString() || 0}
                </p>
              </div>
            </div>

            {/* Incentive Payout Status */}
            {incentivePayout ? (
              <div className={`p-4 rounded-lg border ${getStatusColor(incentivePayout.status)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Incentive Status: {incentivePayout.status}</p>
                    <p className="text-sm mt-1">
                      {incentivePayout.status === 'Pending' && 'Awaiting approval from admin'}
                      {incentivePayout.status === 'Approved' && 'Approved and ready for payment'}
                      {incentivePayout.status === 'Paid' && `Paid on ${new Date(incentivePayout.paid_at).toLocaleDateString()}`}
                      {incentivePayout.status === 'Hold' && 'Payment is on hold'}
                    </p>
                  </div>
                  {incentivePayout.status === 'Paid' && (
                    <Check className="w-6 h-6 text-green-600" />
                  )}
                  {incentivePayout.status === 'Hold' && (
                    <AlertCircle className="w-6 h-6 text-yellow-600" />
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-border bg-muted/30 text-center">
                <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-muted-foreground">No incentive data for this month yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Incentives are calculated based on completed bookings
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Active Reward Plans */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-gold" />
          Active Reward Plans
        </h3>

        {rewardPlans.length > 0 ? (
          <div className="space-y-3">
            {rewardPlans.filter(p => p.is_active).map(plan => (
              <div key={plan.id} className="p-4 border border-border rounded-lg hover:border-gold/30 transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold text-foreground">{plan.name}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Type: {plan.metric_type} | Reward: {plan.reward_type === 'percentage' ? `${plan.reward_value}%` : `₹${plan.reward_value}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Threshold: ₹{plan.threshold?.toLocaleString() || 0} | Period: {plan.period}
                    </p>
                  </div>
                  {metrics?.qualifying_plans?.includes(plan.id) && (
                    <span className="px-2 py-1 bg-green-500/10 text-green-600 rounded-full text-xs font-semibold">
                      ✓ Qualified
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>No reward plans configured</p>
            <p className="text-xs mt-1">Ask admin to set up employee reward plans</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
