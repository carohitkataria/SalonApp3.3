import { useState, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DisplayPage() {
  const [currentToken, setCurrentToken] = useState(null);
  const [nextTokens, setNextTokens] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [date] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchDisplayData();
    const interval = setInterval(fetchDisplayData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [date]);

  const fetchDisplayData = async () => {
    try {
      const [currentRes, nextRes, analyticsRes] = await Promise.all([
        axios.get(`${API}/tokens/current?date=${date}`),
        axios.get(`${API}/tokens/next/${date}?limit=3`),
        axios.get(`${API}/analytics/${date}`)
      ]);

      setCurrentToken(currentRes.data);
      setNextTokens(nextRes.data);
      setAnalytics(analyticsRes.data);
    } catch (error) {
      console.error('Error fetching display data:', error);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian relative overflow-hidden">
      <div className="grain-overlay" />
      
      <div className="relative z-10 h-screen flex flex-col p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-playfair font-bold text-white mb-2">The Looks Unisex Salon</h1>
          <p className="text-zinc-400 uppercase tracking-widest">Token Queue</p>
        </div>

        {/* Main Display */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Current Token - Left 60% */}
          <div className="lg:col-span-3 flex items-center justify-center">
            <motion.div
              key={currentToken?.token_number}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <p className="text-3xl text-zinc-400 uppercase tracking-widest mb-4">Now Serving</p>
              {currentToken ? (
                <>
                  <div 
                    data-testid="current-token-number"
                    className="text-[15vw] font-bebas text-gold leading-none mb-6 pulse-glow"
                  >
                    {currentToken.token_number.toString().padStart(2, '0')}
                  </div>
                  <p className="text-2xl text-white font-bold mb-2">{currentToken.customer_name}</p>
                  <p className="text-xl text-zinc-400">Barber: {currentToken.barber_name}</p>
                </>
              ) : (
                <div className="text-[15vw] font-bebas text-zinc-700 leading-none">--</div>
              )}
            </motion.div>
          </div>

          {/* Next Tokens & Stats - Right 40% */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats */}
            <div className="bg-charcoal border border-white/10 p-6">
              <h3 className="text-gold uppercase tracking-widest text-sm font-bold mb-4">Today's Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-3xl font-bebas text-white">{analytics?.max_token || 0}</p>
                  <p className="text-zinc-400 text-sm uppercase">Total Tokens</p>
                </div>
                <div>
                  <p className="text-3xl font-bebas text-white">{analytics?.waiting || 0}</p>
                  <p className="text-zinc-400 text-sm uppercase">Waiting</p>
                </div>
              </div>
            </div>

            {/* Next in Queue */}
            <div className="bg-charcoal border border-white/10 p-6">
              <h3 className="text-gold uppercase tracking-widest text-sm font-bold mb-4 flex items-center">
                <ArrowRight className="w-4 h-4 mr-2" />
                Next in Queue
              </h3>
              <div className="space-y-3">
                {nextTokens.length > 0 ? (
                  nextTokens.map((token, index) => (
                    <motion.div
                      key={token.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      data-testid={`next-token-${index}`}
                      className="flex items-center justify-between bg-obsidian/50 p-4 border border-white/5"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="text-4xl font-bebas text-gold">
                          {token.token_number.toString().padStart(2, '0')}
                        </div>
                        <div>
                          <p className="text-white font-bold">{token.customer_name}</p>
                          <p className="text-zinc-500 text-sm">{token.time_slot}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <p className="text-zinc-500 text-center py-4">No tokens in queue</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}