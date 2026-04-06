import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { User, Sun, Moon, Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import SalonHubLogo from '@/components/SalonHubLogo';

export default function UserLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('Men');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from || '/salons';

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    
    if (phone.length < 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    const result = await loginUser(name, phone, gender);
    setLoading(false);

    if (result.success) {
      toast.success('Welcome to SalonHub!');
      navigate(from, { replace: true });
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gold/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gold/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold/5 rounded-full blur-3xl" />
      </div>

      {/* Theme Toggle */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-3 rounded-full bg-card border border-border hover:border-gold transition-all z-20"
      >
        {theme === 'dark' ? (
          <Sun className="w-5 h-5 text-gold" />
        ) : (
          <Moon className="w-5 h-5 text-gold" />
        )}
      </motion.button>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo and Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <motion.div 
            className="flex justify-center mb-6"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <div className="relative">
              <SalonHubLogo size={80} showText={false} />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border-2 border-dashed border-gold/20"
              />
            </div>
          </motion.div>
          
          <h1 className="text-4xl font-playfair font-bold text-foreground mb-2">
            Salon<span className="text-gold">Hub</span>
          </h1>
          <p className="text-muted-foreground flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-gold" />
            Book Your Perfect Style
            <Sparkles className="w-4 h-4 text-gold" />
          </p>
        </motion.div>

        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-black/10"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  required
                  className="pl-11 h-12 bg-background border-border focus:border-gold"
                />
              </div>
            </div>

            {/* Phone Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Mobile Number</label>
              <div className="flex gap-2">
                <div className="h-12 px-4 flex items-center bg-muted rounded-lg border border-border">
                  <span className="text-foreground font-medium">+91</span>
                </div>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit number"
                  required
                  className="flex-1 h-12 bg-background border-border focus:border-gold"
                />
              </div>
            </div>

            {/* Gender Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">I am</label>
              <div className="grid grid-cols-2 gap-3">
                {['Men', 'Women'].map((g) => (
                  <motion.button
                    key={g}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setGender(g)}
                    className={`h-12 rounded-xl font-semibold transition-all ${
                      gender === g
                        ? 'bg-gold text-black shadow-lg shadow-gold/20'
                        : 'bg-muted text-foreground hover:bg-muted/80 border border-border'
                    }`}
                  >
                    {g}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 bg-gold text-black hover:bg-gold/90 font-bold text-base rounded-xl shadow-lg shadow-gold/20"
              >
                {loading ? (
                  'Getting you in...'
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </>
                )}
              </Button>
            </motion.div>
          </form>
        </motion.div>

        {/* Footer Links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 text-center space-y-3"
        >
          <button
            onClick={() => navigate('/salon/login')}
            className="text-muted-foreground hover:text-gold transition-colors text-sm flex items-center justify-center gap-2 mx-auto"
          >
            Are you a salon owner?
            <span className="text-gold font-semibold">Salon Login →</span>
          </button>
        </motion.div>
      </div>
    </div>
  );
}
