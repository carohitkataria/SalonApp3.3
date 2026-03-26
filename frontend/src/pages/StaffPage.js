import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChevronRight, SkipForward, RotateCcw, Clock, CheckCircle, XCircle, User } from "lucide-react";
import { motion } from "framer-motion";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function StaffPage() {
  const [tokens, setTokens] = useState([]);
  const [currentToken, setCurrentToken] = useState(null);
  const [date] = useState(new Date().toISOString().split('T')[0]);
  const [filter, setFilter] = useState('all'); // all, waiting, completed

  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, 3000);
    return () => clearInterval(interval);
  }, [filter]);

  const fetchTokens = async () => {
    try {
      const query = filter === 'all' ? `date=${date}` : `date=${date}&status=${filter}`;
      const [tokensRes, currentRes] = await Promise.all([
        axios.get(`${API}/tokens?${query}`),
        axios.get(`${API}/tokens/current?date=${date}`)
      ]);
      
      setTokens(tokensRes.data);
      setCurrentToken(currentRes.data);
    } catch (error) {
      console.error('Error fetching tokens:', error);
    }
  };

  const handleNextToken = async () => {
    try {
      await axios.post(`${API}/staff/next-token/${date}`);
      toast.success('Next token called');
      fetchTokens();
    } catch (error) {
      console.error('Error calling next token:', error);
      toast.error('Failed to call next token');
    }
  };

  const handleSkipToken = async (tokenId) => {
    try {
      await axios.post(`${API}/staff/skip-token/${tokenId}`);
      toast.success('Token skipped');
      fetchTokens();
    } catch (error) {
      console.error('Error skipping token:', error);
      toast.error('Failed to skip token');
    }
  };

  const handleRecallToken = async (tokenId) => {
    try {
      await axios.post(`${API}/staff/recall-token/${tokenId}`);
      toast.success('Token recalled');
      fetchTokens();
    } catch (error) {
      console.error('Error recalling token:', error);
      toast.error('Failed to recall token');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'waiting':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'in_progress':
        return <ChevronRight className="w-4 h-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'skipped':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'waiting':
        return 'border-yellow-500/30 bg-yellow-500/5';
      case 'in_progress':
        return 'border-blue-500/30 bg-blue-500/5';
      case 'completed':
        return 'border-green-500/30 bg-green-500/5';
      case 'skipped':
        return 'border-red-500/30 bg-red-500/5';
      default:
        return 'border-white/10';
    }
  };

  return (
    <div className="min-h-screen bg-obsidian relative overflow-hidden">
      <div className="grain-overlay" />
      
      <div className="relative z-10 container max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-playfair font-bold text-white mb-2">Staff Control Panel</h1>
          <p className="text-zinc-400 uppercase tracking-wide text-sm">Manage Queue • {date}</p>
        </div>

        {/* Current Token Card */}
        {currentToken && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glassmorphism rounded-xl p-8 mb-8"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="text-6xl font-bebas text-gold">
                  {currentToken.token_number.toString().padStart(2, '0')}
                </div>
                <div>
                  <p className="text-2xl font-bold text-white mb-1">{currentToken.customer_name}</p>
                  <p className="text-zinc-400">Phone: {currentToken.phone}</p>
                  <p className="text-zinc-400">Barber: {currentToken.barber_name} • {currentToken.time_slot}</p>
                </div>
              </div>
              <div className="flex space-x-3">
                <Button
                  data-testid="next-token-button"
                  onClick={handleNextToken}
                  className="bg-gold text-black hover:bg-gold-hover uppercase tracking-widest font-bold px-6"
                >
                  <ChevronRight className="mr-2" /> Next
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {!currentToken && (
          <div className="glassmorphism rounded-xl p-8 mb-8 text-center">
            <p className="text-zinc-400 mb-4">No token currently being served</p>
            <Button
              data-testid="call-first-token"
              onClick={handleNextToken}
              className="bg-gold text-black hover:bg-gold-hover uppercase tracking-widest font-bold px-6"
            >
              <ChevronRight className="mr-2" /> Call First Token
            </Button>
          </div>
        )}

        {/* Filters */}
        <div className="flex space-x-2 mb-6">
          {['all', 'waiting', 'completed'].map((f) => (
            <button
              key={f}
              data-testid={`filter-${f}`}
              onClick={() => setFilter(f)}
              className={`px-6 py-2 uppercase tracking-widest text-sm font-bold transition-all ${
                filter === f
                  ? 'bg-gold text-black'
                  : 'bg-charcoal text-white border border-white/10 hover:border-white/30'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Token List */}
        <div className="space-y-3">
          {tokens.map((token, index) => (
            <motion.div
              key={token.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              data-testid={`token-row-${token.token_number}`}
              className={`bg-charcoal border p-6 ${getStatusColor(token.status)} transition-all`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-6">
                  <div className="text-4xl font-bebas text-gold w-16">
                    {token.token_number.toString().padStart(2, '0')}
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white flex items-center space-x-2">
                      <User className="w-4 h-4" />
                      <span>{token.customer_name}</span>
                    </p>
                    <p className="text-zinc-400 text-sm">Phone: {token.phone}</p>
                    <p className="text-zinc-400 text-sm">Barber: {token.barber_name} • {token.time_slot}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 px-3 py-1 bg-white/5 border border-white/10">
                    {getStatusIcon(token.status)}
                    <span className="text-white text-sm uppercase tracking-wide">{token.status.replace('_', ' ')}</span>
                  </div>
                  
                  {token.status === 'waiting' && (
                    <Button
                      data-testid={`skip-token-${token.token_number}`}
                      onClick={() => handleSkipToken(token.id)}
                      variant="outline"
                      size="sm"
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      <SkipForward className="w-4 h-4" />
                    </Button>
                  )}
                  
                  {(token.status === 'completed' || token.status === 'skipped') && (
                    <Button
                      data-testid={`recall-token-${token.token_number}`}
                      onClick={() => handleRecallToken(token.id)}
                      variant="outline"
                      size="sm"
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {tokens.length === 0 && (
            <div className="text-center py-12">
              <p className="text-zinc-500">No tokens found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}