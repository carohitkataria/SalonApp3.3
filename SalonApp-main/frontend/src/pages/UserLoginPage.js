import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Scissors, User } from 'lucide-react';
import { motion } from 'framer-motion';

export default function UserLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginUser } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  // Get the redirect path from state or default to home
  const from = location.state?.from || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (phone.length < 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    const result = await loginUser(name, phone);
    setLoading(false);

    if (result.success) {
      toast.success('Welcome to The Looks!');
      navigate(from, { replace: true });
    } else {
      toast.error(result.error);
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
          <h1 className="text-4xl font-playfair font-bold text-white mb-2">Welcome</h1>
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
            <Label htmlFor="name" className="text-white text-sm mb-2 block">Full Name</Label>
            <Input
              id="name"
              data-testid="user-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              required
              className="bg-transparent border-b border-white/20 rounded-none px-0 py-3 text-white focus:border-gold focus:ring-0 placeholder:text-white/30"
            />
          </div>

          <div>
            <Label htmlFor="phone" className="text-white text-sm mb-2 block">Mobile Number</Label>
            <div className="flex items-center">
              <span className="text-white mr-2">+91</span>
              <Input
                id="phone"
                data-testid="user-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                required
                className="flex-1 bg-transparent border-b border-white/20 rounded-none px-0 py-3 text-white focus:border-gold focus:ring-0 placeholder:text-white/30"
              />
            </div>
          </div>

          <Button
            type="submit"
            data-testid="user-login-button"
            disabled={loading}
            className="w-full bg-gold text-black hover:bg-gold-hover uppercase tracking-widest font-bold py-6"
          >
            <User className="mr-2 w-4 h-4" />
            {loading ? 'Logging in...' : 'Continue'}
          </Button>
        </motion.form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-6"
        >
          <button
            onClick={() => navigate('/admin/login')}
            className="text-zinc-400 hover:text-gold transition-colors text-sm"
          >
            Salon Login
          </button>
        </motion.div>
      </div>
    </div>
  );
}