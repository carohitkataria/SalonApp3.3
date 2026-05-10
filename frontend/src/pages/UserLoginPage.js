import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { User, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import SalonHubLogo from '@/components/SalonHubLogo';
import ThemePicker from '@/components/ThemePicker';

export default function UserLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginUser } = useAuth();
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
      toast.success('Welcome to SalonHub.');
      navigate(from, { replace: true });
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-background bg-grain hero-wash relative overflow-hidden flex items-center justify-center px-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-brass/[0.06] rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-bronze/[0.05] rounded-full blur-3xl" />
      </div>

      <ThemePicker className="fixed top-4 right-4 z-20" />

      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="flex justify-center mb-6">
            <SalonHubLogo size={64} showText={false} />
          </div>

          <span className="eyebrow-brass">A warm welcome</span>
          <h1 className="font-fraunces text-4xl sm:text-5xl mt-3 font-light leading-[1.05]">
            Step into <span className="serif-italic font-medium brass-text">Salonhub</span>
          </h1>
          <p className="text-muted-foreground mt-3 text-sm">
            Tell us a little about you — we'll save your chair.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="lux-card rounded-2xl p-8 bg-card"
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="eyebrow">Full name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.6} />
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name, please"
                  required
                  data-testid="login-name-input"
                  className="pl-10 h-12 bg-background border-border focus-visible:ring-brass focus-visible:border-brass rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="eyebrow">Mobile number</label>
              <div className="flex gap-2">
                <div className="h-12 px-4 inline-flex items-center bg-muted rounded-xl border border-border text-foreground font-medium text-sm">
                  +91
                </div>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="98XXXXXXXX"
                  required
                  data-testid="login-phone-input"
                  className="flex-1 h-12 bg-background border-border focus-visible:ring-brass focus-visible:border-brass rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="eyebrow">I am</label>
              <div className="grid grid-cols-2 gap-2">
                {['Men', 'Women'].map((g) => (
                  <motion.button
                    key={g}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setGender(g)}
                    data-testid={`login-gender-${g.toLowerCase()}-btn`}
                    className={`h-11 rounded-xl font-medium text-sm transition-all ${
                      gender === g
                        ? 'bg-brass text-espresso shadow-brass'
                        : 'bg-transparent text-foreground border border-border hover:border-brass/50'
                    }`}
                  >
                    {g}
                  </motion.button>
                ))}
              </div>
            </div>

            <motion.div whileTap={{ scale: 0.99 }} className="pt-2">
              <Button
                type="submit"
                disabled={loading}
                data-testid="login-submit-btn"
                className="w-full h-12 bg-brass text-espresso hover:bg-brass-hover font-semibold rounded-xl shadow-brass"
              >
                {loading ? 'Settling you in...' : (
                  <span className="inline-flex items-center">
                    Continue
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </span>
                )}
              </Button>
            </motion.div>
          </form>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center"
        >
          <button
            onClick={() => navigate('/salon/login')}
            data-testid="login-salon-owner-link"
            className="text-xs uppercase tracking-[0.18em] text-muted-foreground hover:text-brass transition-colors"
          >
            Salon owner? <span className="text-brass">Open your portal →</span>
          </button>
        </motion.div>
      </div>
    </div>
  );
}
