import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Scissors, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { loginAdmin } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await loginAdmin(username, password);
    setLoading(false);

    if (result.success) {
      toast.success('Salon login successful');
      navigate('/admin/dashboard');
    } else {
      // Defensive: result.error can be a string or an object (FastAPI sometimes
      // returns structured detail like {code, message, reason}). Always coerce
      // to a string so sonner never gets an object as a React child.
      const errMsg = typeof result.error === 'string'
        ? result.error
        : (result.error && typeof result.error === 'object'
            ? (result.error.message || result.error.detail || result.error.error || 'Invalid credentials')
            : 'Invalid credentials');
      toast.error(errMsg);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian relative overflow-hidden flex items-center justify-center">
      <div className="grain-overlay" />
      
      <div className="relative z-10 w-full max-w-md px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <Scissors className="w-16 h-16 text-gold mx-auto mb-4" />
          <h1 className="text-4xl font-playfair font-bold text-white mb-2">Salon Login</h1>
          <p className="text-zinc-400 uppercase tracking-wide text-sm">The Looks Unisex Salon</p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onSubmit={handleSubmit}
          className="glassmorphism rounded-xl p-8 space-y-6"
        >
          <div>
            <Label htmlFor="username" className="text-white text-sm mb-2 block">Username</Label>
            <Input
              id="username"
              data-testid="admin-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              className="bg-transparent border-b border-white/20 rounded-none px-0 py-3 text-white focus:border-gold focus:ring-0 placeholder:text-white/30"
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-white text-sm mb-2 block">Password</Label>
            <Input
              id="password"
              data-testid="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              className="bg-transparent border-b border-white/20 rounded-none px-0 py-3 text-white focus:border-gold focus:ring-0 placeholder:text-white/30"
            />
          </div>

          <Button
            type="submit"
            data-testid="admin-login-button"
            disabled={loading}
            className="w-full bg-gold text-black hover:bg-gold-hover uppercase tracking-widest font-bold py-6"
          >
            <Lock className="mr-2 w-4 h-4" />
            {loading ? 'Logging in...' : 'Login to Salon Panel'}
          </Button>
        </motion.form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-6"
        >
          <button
            onClick={() => navigate('/user/login')}
            className="text-zinc-400 hover:text-gold transition-colors text-sm"
          >
            Login as Customer instead
          </button>
        </motion.div>
      </div>
    </div>
  );
}