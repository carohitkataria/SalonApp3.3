import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, KeyRound, MessageSquare, User as UserIcon } from 'lucide-react';

const GENDER_OPTIONS = ['Men', 'Women', 'Other'];

/**
 * CustomerAuthModal
 * - Login tab with Password + OTP sub-tabs
 * - Signup tab (phone + name + gender + OTP)
 * - Calls `onSuccess(user)` once a session is established
 */
export default function CustomerAuthModal({ open, onClose, onSuccess, defaultTab = 'login' }) {
  const {
    customerSendOtp,
    customerVerifyOtp,
    customerLoginPassword,
    updateCustomerProfile,
  } = useAuth();

  const [tab, setTab] = useState(defaultTab); // 'login' | 'signup'
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' | 'otp'

  // Shared form state
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [name, setName] = useState('');
  const [gender, setGender] = useState('Men');
  const [loading, setLoading] = useState(false);

  const formattedPhone = () => {
    const digits = (phone || '').replace(/\D/g, '').replace(/^91/, '');
    return digits.length === 10 ? `+91${digits}` : '';
  };

  const resetState = () => {
    setPhone('');
    setPassword('');
    setOtp('');
    setOtpSent(false);
    setName('');
    setGender('Men');
    setLoading(false);
    setLoginMethod('password');
    setTab(defaultTab);
  };

  const handleClose = () => {
    resetState();
    onClose?.();
  };

  const handleSuccess = (user) => {
    try { localStorage.setItem('customer_phone', formattedPhone()); } catch (_e) { /* ignore */ }
    onSuccess?.(user);
    resetState();
  };

  // ── Login: Password ──────────────────────────────────────────────────────
  const handlePasswordLogin = async () => {
    const fp = formattedPhone();
    if (!fp) { toast.error('Please enter a valid 10-digit mobile number'); return; }
    if (!password) { toast.error('Please enter your password'); return; }
    setLoading(true);
    const result = await customerLoginPassword(fp, password);
    setLoading(false);
    if (result.success) {
      toast.success('Welcome back!');
      handleSuccess(result.user);
    } else {
      toast.error(result.error || 'Invalid phone or password');
    }
  };

  // ── Login / Signup: OTP ──────────────────────────────────────────────────
  const handleSendOtp = async () => {
    const fp = formattedPhone();
    if (!fp) { toast.error('Please enter a valid 10-digit mobile number'); return; }
    if (tab === 'signup') {
      if (!name.trim()) { toast.error('Please enter your name'); return; }
      if (!gender) { toast.error('Please select your gender'); return; }
    }
    setLoading(true);
    const result = await customerSendOtp(fp, 'login');
    setLoading(false);
    if (result.success) {
      setOtpSent(true);
      toast.success(result.note || 'OTP sent to your WhatsApp');
    } else {
      toast.error(result.error || 'Failed to send OTP');
    }
  };

  const handleVerifyOtp = async () => {
    const fp = formattedPhone();
    if (!otp || otp.length < 4) { toast.error('Please enter the OTP'); return; }
    setLoading(true);
    const result = await customerVerifyOtp(fp, otp, 'login');
    if (!result.success) {
      setLoading(false);
      toast.error(result.error || 'Invalid OTP');
      return;
    }
    // For signup, update profile with name & gender
    if (tab === 'signup') {
      await updateCustomerProfile(fp, { name: name.trim(), gender });
    }
    setLoading(false);
    toast.success(tab === 'signup' ? 'Account created!' : 'Login successful!');
    handleSuccess(result.user);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md" data-testid="customer-auth-modal">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            {tab === 'login' ? 'Welcome back' : 'Create your account'}
          </DialogTitle>
          <DialogDescription>
            {tab === 'login'
              ? 'Login to access your bookings, wallet & member benefits.'
              : 'Sign up to unlock booking history and rewards.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => { setTab(v); setOtp(''); setOtpSent(false); }}>
          <TabsList className="grid w-full grid-cols-2" data-testid="auth-mode-tabs">
            <TabsTrigger value="login" data-testid="auth-tab-login">Login</TabsTrigger>
            <TabsTrigger value="signup" data-testid="auth-tab-signup">Sign Up</TabsTrigger>
          </TabsList>

          {/* ── LOGIN ─────────────────────────────────────────────── */}
          <TabsContent value="login" className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Mobile Number</label>
              <div className="flex gap-2">
                <span className="inline-flex items-center px-3 h-10 rounded-lg border border-border bg-muted text-sm text-muted-foreground">+91</span>
                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder="10-digit mobile"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="h-10 flex-1"
                  data-testid="auth-phone-input"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={loginMethod === 'password' ? 'default' : 'outline'}
                onClick={() => { setLoginMethod('password'); setOtpSent(false); setOtp(''); }}
                className="flex-1"
                data-testid="login-method-password-btn"
              >
                <KeyRound className="w-4 h-4 mr-1.5" /> Password
              </Button>
              <Button
                type="button"
                variant={loginMethod === 'otp' ? 'default' : 'outline'}
                onClick={() => { setLoginMethod('otp'); setPassword(''); }}
                className="flex-1"
                data-testid="login-method-otp-btn"
              >
                <MessageSquare className="w-4 h-4 mr-1.5" /> OTP
              </Button>
            </div>

            {loginMethod === 'password' ? (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Password</label>
                  <Input
                    type="password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10"
                    data-testid="auth-password-input"
                  />
                </div>
                <Button
                  onClick={handlePasswordLogin}
                  disabled={loading}
                  className="w-full"
                  data-testid="auth-password-login-btn"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Login
                </Button>
                <button
                  type="button"
                  onClick={() => { setLoginMethod('otp'); setPassword(''); }}
                  className="w-full text-xs text-gold hover:underline"
                  data-testid="auth-forgot-password-link"
                >
                  Forgot password? Login with OTP instead
                </button>
              </>
            ) : (
              <>
                {!otpSent ? (
                  <Button
                    onClick={handleSendOtp}
                    disabled={loading}
                    className="w-full"
                    data-testid="auth-send-otp-btn"
                  >
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Send OTP via WhatsApp
                  </Button>
                ) : (
                  <>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Enter OTP</label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="6-digit code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        className="h-10 tracking-widest text-center font-bold"
                        data-testid="auth-otp-input"
                      />
                    </div>
                    <Button
                      onClick={handleVerifyOtp}
                      disabled={loading}
                      className="w-full"
                      data-testid="auth-verify-otp-btn"
                    >
                      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Verify & Login
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setOtpSent(false); setOtp(''); }}
                      className="w-full text-xs text-muted-foreground hover:text-foreground"
                      data-testid="auth-resend-otp-link"
                    >
                      Change number / Resend OTP
                    </button>
                  </>
                )}
              </>
            )}
          </TabsContent>

          {/* ── SIGN UP ───────────────────────────────────────────── */}
          <TabsContent value="signup" className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Full Name</label>
              <Input
                type="text"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10"
                data-testid="signup-name-input"
                disabled={otpSent}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Mobile Number</label>
              <div className="flex gap-2">
                <span className="inline-flex items-center px-3 h-10 rounded-lg border border-border bg-muted text-sm text-muted-foreground">+91</span>
                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder="10-digit mobile"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="h-10 flex-1"
                  data-testid="signup-phone-input"
                  disabled={otpSent}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Gender</label>
              <div className="flex gap-2">
                {GENDER_OPTIONS.map((g) => (
                  <Button
                    key={g}
                    type="button"
                    variant={gender === g ? 'default' : 'outline'}
                    onClick={() => setGender(g)}
                    className="flex-1"
                    disabled={otpSent}
                    data-testid={`signup-gender-${g.toLowerCase()}`}
                  >
                    {g}
                  </Button>
                ))}
              </div>
            </div>

            {!otpSent ? (
              <Button
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full"
                data-testid="signup-send-otp-btn"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserIcon className="w-4 h-4 mr-2" />}
                Send OTP via WhatsApp
              </Button>
            ) : (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Enter OTP</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    className="h-10 tracking-widest text-center font-bold"
                    data-testid="signup-otp-input"
                  />
                </div>
                <Button
                  onClick={handleVerifyOtp}
                  disabled={loading}
                  className="w-full"
                  data-testid="signup-verify-otp-btn"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Create Account
                </Button>
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtp(''); }}
                  className="w-full text-xs text-muted-foreground hover:text-foreground"
                  data-testid="signup-resend-otp-link"
                >
                  Edit details / Resend OTP
                </button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
