import { useState, useEffect } from 'react';
import axios from 'axios';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function LiveDashboard() {
  const [currentTokens, setCurrentTokens] = useState([]);
  const [nextTokens, setNextTokens] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [date] = useState(new Date().toISOString().split('T')[0]);
  const { subscribe, unsubscribe } = useWebSocket();

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to WebSocket events
    const handleUpdate = () => {
      fetchDashboardData();
    };

    subscribe('token_created', handleUpdate);
    subscribe('token_updated', handleUpdate);
    subscribe('token_called', handleUpdate);
    subscribe('token_completed', handleUpdate);
    subscribe('token_skipped', handleUpdate);
    subscribe('token_recalled', handleUpdate);

    return () => {
      unsubscribe('token_created', handleUpdate);
      unsubscribe('token_updated', handleUpdate);
      unsubscribe('token_called', handleUpdate);
      unsubscribe('token_completed', handleUpdate);
      unsubscribe('token_skipped', handleUpdate);
      unsubscribe('token_recalled', handleUpdate);
    };
  }, [date]);

  const fetchDashboardData = async () => {
    try {
      const [currentRes, nextRes, analyticsRes] = await Promise.all([
        axios.get(`${API}/tokens/current/${date}`),
        axios.get(`${API}/tokens/next/${date}?limit=3`),
        axios.get(`${API}/analytics/${date}`)
      ]);

      setCurrentTokens(currentRes.data);
      setNextTokens(nextRes.data);
      setAnalytics(analyticsRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-charcoal border border-white/10 p-4">
          <p className="text-zinc-400 text-xs uppercase tracking-wide mb-1">Total Tokens</p>
          <p className="text-3xl font-bebas text-gold">{analytics?.max_token || 0}</p>
        </div>
        <div className="bg-charcoal border border-white/10 p-4">
          <p className="text-zinc-400 text-xs uppercase tracking-wide mb-1">Waiting</p>
          <p className="text-3xl font-bebas text-white">{analytics?.waiting || 0}</p>
        </div>
      </div>

      {/* Current Tokens */}
      <div className="bg-charcoal border border-white/10 p-6">
        <h3 className="text-gold uppercase tracking-widest text-sm font-bold mb-4">Now Serving</h3>
        {currentTokens.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {currentTokens.map((token) => (
              <motion.div
                key={token.id}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                data-testid={`current-token-${token.token_number}`}
                className="bg-obsidian/50 p-4 border border-gold/30"
              >
                <div className="text-5xl font-bebas text-gold mb-2">
                  {token.token_number.toString().padStart(2, '0')}
                </div>
                <p className="text-white text-sm font-bold">{token.customer_name}</p>
                <p className="text-zinc-500 text-xs">{token.barber_name}</p>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-6xl font-bebas text-zinc-700 mb-2">--</div>
            <p className="text-zinc-500 text-sm">No tokens being served</p>
          </div>
        )}
      </div>

      {/* Next in Queue */}
      <div className="bg-charcoal border border-white/10 p-6">
        <h3 className="text-gold uppercase tracking-widest text-sm font-bold mb-4 flex items-center">
          <ArrowRight className="w-4 h-4 mr-2" />
          Next in Queue
        </h3>
        {nextTokens.length > 0 ? (
          <div className="space-y-3">
            {nextTokens.map((token, index) => (
              <motion.div
                key={token.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                data-testid={`next-token-${index}`}
                className="flex items-center justify-between bg-obsidian/50 p-3 border border-white/5"
              >
                <div className="flex items-center space-x-3">
                  <div className="text-3xl font-bebas text-gold">
                    {token.token_number.toString().padStart(2, '0')}
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold">{token.customer_name}</p>
                    <p className="text-zinc-500 text-xs">{token.time_slot}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500 text-center py-4 text-sm">No tokens in queue</p>
        )}
      </div>
    </div>
  );
}