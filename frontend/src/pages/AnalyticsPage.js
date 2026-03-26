import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar, Users, Clock, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [date] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [analyticsRes, tokensRes] = await Promise.all([
        axios.get(`${API}/analytics/${date}`),
        axios.get(`${API}/tokens?date=${date}`)
      ]);
      
      setAnalytics(analyticsRes.data);
      setTokens(tokensRes.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const getHourlyDistribution = () => {
    const hours = {};
    tokens.forEach(token => {
      const hour = token.time_slot.split(':')[0];
      hours[hour] = (hours[hour] || 0) + 1;
    });
    
    return Object.entries(hours)
      .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  };

  const stats = [
    {
      icon: Users,
      label: "Total Tokens",
      value: analytics?.total_tokens || 0,
      color: "text-blue-500"
    },
    {
      icon: Clock,
      label: "Waiting",
      value: analytics?.waiting || 0,
      color: "text-yellow-500"
    },
    {
      icon: CheckCircle,
      label: "Completed",
      value: analytics?.completed || 0,
      color: "text-green-500"
    },
    {
      icon: XCircle,
      label: "Skipped",
      value: analytics?.skipped || 0,
      color: "text-red-500"
    },
    {
      icon: TrendingUp,
      label: "In Progress",
      value: analytics?.in_progress || 0,
      color: "text-gold"
    }
  ];

  return (
    <div className="min-h-screen bg-obsidian relative overflow-hidden">
      <div className="grain-overlay" />
      
      <div className="relative z-10 container max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-playfair font-bold text-white mb-2">Analytics Dashboard</h1>
          <p className="text-zinc-400 uppercase tracking-wide text-sm flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            {date}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                data-testid={`stat-${stat.label.toLowerCase().replace(' ', '-')}`}
                className="bg-charcoal border border-white/10 p-6 hover:border-white/20 transition-all"
              >
                <Icon className={`w-8 h-8 ${stat.color} mb-4`} />
                <p className="text-4xl font-bebas text-white mb-1">{stat.value}</p>
                <p className="text-zinc-400 text-sm uppercase tracking-wide">{stat.label}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Hourly Distribution Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-charcoal border border-white/10 p-8"
        >
          <h2 className="text-2xl font-playfair font-bold text-white mb-6">Hourly Distribution</h2>
          
          {getHourlyDistribution().length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getHourlyDistribution()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="hour" stroke="#a1a1aa" />
                <YAxis stroke="#a1a1aa" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '0',
                    color: '#fafafa'
                  }}
                />
                <Bar dataKey="count" fill="#D4AF37" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-zinc-500">
              No data available for today
            </div>
          )}
        </motion.div>

        {/* Barber Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-charcoal border border-white/10 p-8 mt-8"
        >
          <h2 className="text-2xl font-playfair font-bold text-white mb-6">Barber Performance</h2>
          
          <div className="space-y-4">
            {Object.entries(
              tokens.reduce((acc, token) => {
                acc[token.barber_name] = (acc[token.barber_name] || 0) + 1;
                return acc;
              }, {})
            ).map(([barber, count]) => (
              <div key={barber} className="flex items-center justify-between">
                <span className="text-white font-bold">{barber}</span>
                <div className="flex items-center space-x-4">
                  <div className="w-64 bg-white/10 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold"
                      style={{ width: `${(count / tokens.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-gold font-bebas text-2xl w-12 text-right">{count}</span>
                </div>
              </div>
            ))}

            {tokens.length === 0 && (
              <div className="text-center py-8 text-zinc-500">
                No bookings yet
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}