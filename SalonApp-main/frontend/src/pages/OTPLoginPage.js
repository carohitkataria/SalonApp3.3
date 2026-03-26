import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Scissors, Lock, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function OTPLoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: phone, 2: OTP
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentOtp, setSentOtp] = useState('');

  const handleSendOTP = async (e) => {
    e.preventDefault();
    
    if (phone.length < 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/salon/send-otp`, { phone });
      setSentOtp(response.data.otp); // Remove in production
      toast.success('OTP sent successfully!');
      toast.info(`OTP: ${response.data.otp}`, { duration: 10000 }); // Mock - remove in production
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      toast.error('Please enter 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/salon/verify-otp`, { phone, otp });
      
      // Store salon token and ID
      localStorage.setItem('salon_admin_token', response.data.access_token);
      localStorage.setItem('salon_id', response.data.salon_id);
      
      toast.success('Login successful!');
      navigate('/salon/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <Scissors className="w-16 h-16 text-gold mx-auto mb-4" />
          <h1 className="text-4xl font-playfair font-bold text-foreground mb-2">Salon Login</h1>
          <p className="text-muted-foreground">OTP Verification</p>
        </motion.div>

        {step === 1 ? (
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onSubmit={handleSendOTP}
            className="bg-card border border-border rounded-lg p-8 space-y-6"
          >
            <div>
              <Label htmlFor="phone" className="text-card-foreground mb-2 block">
                <Smartphone className="inline w-4 h-4 mr-2" />
                Mobile Number
              </Label>
              <div className="flex items-center">
                <span className="text-foreground mr-2">+91</span>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  required
                  className="flex-1"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gold text-black hover:bg-gold/90 py-6"
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </Button>

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => navigate('/user/login')}
                className="text-sm text-muted-foreground hover:text-gold transition-colors block w-full"
              >
                Login as Customer instead
              </button>
              <button
                type="button"
                onClick={() => navigate('/salon/signup', { state: { phone } })}
                className="text-sm text-gold hover:text-gold/80 transition-colors font-medium block w-full"
                data-testid="register-salon-btn"
              >
                New Salon? Register here
              </button>
            </div>
          </motion.form>
        ) : (
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleVerifyOTP}
            className="bg-card border border-border rounded-lg p-8 space-y-6"
          >
            <div>
              <Label htmlFor="otp" className="text-card-foreground mb-2 block">
                <Lock className="inline w-4 h-4 mr-2" />
                Enter OTP
              </Label>
              <Input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit OTP"
                required
                className="text-center text-2xl tracking-widest"
                maxLength={6}
              />
              <p className="text-sm text-muted-foreground mt-2 text-center">
                OTP sent to +91{phone}
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gold text-black hover:bg-gold/90 py-6"
            >
              {loading ? 'Verifying...' : 'Verify & Login'}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm text-muted-foreground hover:text-gold transition-colors"
              >
                Change phone number
              </button>
            </div>
          </motion.form>
        )}
      </div>
    </div>
  );
}