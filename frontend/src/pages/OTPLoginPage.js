import { useState } from 'react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Scissors, Lock, Smartphone, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function OTPLoginPage() {
  const navigate = useNavigate();
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' or 'otp'
  const [step, setStep] = useState(1); // For OTP: 1: phone, 2: OTP
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentOtp, setSentOtp] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(false);

  // Countdown timer for resend
  React.useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && step === 2) {
      setCanResend(true);
    }
  }, [countdown, step]);

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    
    if (!phone) {
      toast.error('Please enter your Mobile Number or Login ID');
      return;
    }

    if (!password) {
      toast.error('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/salon/users/login`, {
        identifier: phone,  // Can be mobile number or login_id
        password
      });

      // Store auth data
      const authData = {
        token: response.data.access_token,
        salonId: response.data.salon_id,
        userId: response.data.user_id,
        role: response.data.role,
        permissions: response.data.permissions
      };
      
      localStorage.setItem('salon_user_auth', JSON.stringify(authData));
      localStorage.setItem('salon_id', response.data.salon_id);
      
      toast.success('Login successful!');
      navigate('/salon/dashboard');
    } catch (error) {
      // Fallback to legacy salon login if multi-user login fails
      if (error.response?.status === 404) {
        try {
          // Try legacy salon password login
          const legacyResponse = await axios.post(`${API}/salon/password-login`, {
            phone,
            password
          });
          
          localStorage.setItem('salon_admin_token', legacyResponse.data.access_token);
          localStorage.setItem('salon_id', legacyResponse.data.salon_id);
          
          toast.success('Login successful!');
          navigate('/salon/dashboard');
          return;
        } catch (legacyError) {
          // Ignore and show original error
        }
      }
      
      if (error.response?.status === 400 && error.response?.data?.detail?.includes('Password not set')) {
        toast.error('Password not set for this salon. Please use OTP login.');
      } else {
        toast.error(error.response?.data?.detail || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    
    if (phone.length < 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/salon/send-otp`, { phone });
      
      // Check if OTP is in response (testing/mock mode)
      if (response.data.otp) {
        setSentOtp(response.data.otp);
        toast.success(`OTP: ${response.data.otp} (${response.data.note || 'Check WhatsApp'})`, {
          duration: 10000
        });
      } else {
        toast.success(response.data.note || 'OTP sent to your WhatsApp! Please check your messages.');
      }
      
      setStep(2);
      setCountdown(30);
      setCanResend(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/salon/send-otp`, { phone });
      
      if (response.data.otp) {
        setSentOtp(response.data.otp);
        toast.success(`OTP: ${response.data.otp} (${response.data.note || 'Check WhatsApp'})`, {
          duration: 10000
        });
      } else {
        toast.success(response.data.note || 'OTP resent to your WhatsApp!');
      }
      
      setCountdown(30);
      setCanResend(false);
      setOtp('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/salon/verify-otp`, {
        phone,
        otp
      });

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-gold/5 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-gold/20 to-gold/10 p-8 text-center border-b border-border">
            <Scissors className="w-16 h-16 text-gold mx-auto mb-4" />
            <h1 className="text-2xl font-playfair font-bold text-foreground mb-2">Salon Admin Login</h1>
            <p className="text-sm text-muted-foreground">Access your salon dashboard</p>
          </div>

          {/* Login Method Tabs */}
          <div className="grid grid-cols-2 gap-0 border-b border-border">
            <button
              onClick={() => {
                setLoginMethod('password');
                setStep(1);
                setOtp('');
              }}
              className={`py-4 px-6 text-sm font-semibold transition-all ${
                loginMethod === 'password'
                  ? 'bg-gold text-black border-b-2 border-gold'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <Lock className="w-4 h-4 inline mr-2" />
              Password Login
            </button>
            <button
              onClick={() => {
                setLoginMethod('otp');
                setStep(1);
                setPassword('');
              }}
              className={`py-4 px-6 text-sm font-semibold transition-all ${
                loginMethod === 'otp'
                  ? 'bg-gold text-black border-b-2 border-gold'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <Smartphone className="w-4 h-4 inline mr-2" />
              OTP Login
            </button>
          </div>

          <div className="p-8">
            {loginMethod === 'password' ? (
              /* Password Login Form */
              <form onSubmit={handlePasswordLogin} className="space-y-6">
                <div>
                  <Label htmlFor="phone" className="mb-2 block">Mobile Number/ID</Label>
                  <div className="flex items-center">
                    <Input
                      id="phone"
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Mobile number or Login ID"
                      required
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter your mobile number or login ID
                  </p>
                </div>

                <div>
                  <Label htmlFor="password" className="mb-2 block">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-gold text-black hover:bg-gold/90 h-12"
                  disabled={loading}
                >
                  {loading ? 'Logging in...' : 'Login with Password'}
                </Button>

                <p className="text-xs text-center text-muted-foreground mt-4">
                  Don't have a password? Use OTP login above
                </p>
              </form>
            ) : (
              /* OTP Login Form */
              <>
                {step === 1 ? (
                  <form onSubmit={handleSendOTP} className="space-y-6">
                    <div>
                      <Label htmlFor="phone_otp" className="mb-2 block">Mobile Number</Label>
                      <div className="flex items-center">
                        <span className="text-foreground mr-2">+91</span>
                        <Input
                          id="phone_otp"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="10-digit mobile number"
                          required
                          className="flex-1"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        OTP will be sent to your WhatsApp
                      </p>
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full bg-gold text-black hover:bg-gold/90 h-12"
                      disabled={loading}
                    >
                      {loading ? 'Sending OTP...' : 'Send OTP'}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOTP} className="space-y-6">
                    <div>
                      <Label htmlFor="otp" className="mb-2 block">Enter OTP</Label>
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
                        OTP sent to +91{phone} via WhatsApp
                      </p>
                      {sentOtp && (
                        <div className="mt-3 p-3 bg-gold/10 border border-gold/30 rounded-lg">
                          <p className="text-xs text-muted-foreground text-center mb-1">
                            For Testing (Twilio Not Configured)
                          </p>
                          <p className="text-center text-lg font-bold text-gold tracking-wider">
                            {sentOtp}
                          </p>
                        </div>
                      )}
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full bg-gold text-black hover:bg-gold/90 h-12"
                      disabled={loading}
                    >
                      {loading ? 'Verifying...' : 'Verify OTP'}
                    </Button>

                    <div className="flex items-center justify-between text-sm">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-gold hover:underline"
                      >
                        Change Number
                      </button>
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={!canResend || loading}
                        className={`${
                          canResend ? 'text-gold hover:underline' : 'text-muted-foreground cursor-not-allowed'
                        }`}
                      >
                        {canResend ? 'Resend OTP' : `Resend in ${countdown}s`}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{' '}
          <button
            onClick={() => navigate('/salon/signup')}
            className="text-gold hover:underline font-semibold"
          >
            Register your salon
          </button>
        </p>

        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={() => toast.info('Please contact support to reset your password')}
            className="text-sm text-muted-foreground hover:text-gold transition-colors"
          >
            Forgot Password?
          </button>
          <span className="text-border">|</span>
          <button
            onClick={() => navigate('/user/login')}
            className="text-sm text-muted-foreground hover:text-gold transition-colors"
          >
            Login as Customer
          </button>
        </div>
      </motion.div>
    </div>
  );
}
