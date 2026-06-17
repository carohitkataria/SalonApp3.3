/**
 * Platform Admin login (HIDDEN).
 *
 * Bookmark URL: `<your-domain>/platform/login`. Not linked from anywhere.
 *
 * Modes:
 *  - password (default): mobile + password → POST /api/platform/auth/login-password
 *  - setpw: first-time / forgot-password → OTP via SMS → POST /api/platform/auth/set-password
 *
 * Token is persisted in `localStorage` (default, "Keep me logged in" on) or
 * `sessionStorage` (off). PlatformDashboardPage reads both stores.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Shield, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import GoogleLoginButton from '@/components/GoogleLoginButton';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PlatformLoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('password'); // 'password' | 'setpw'
  const [step, setStep] = useState('mobile');   // setpw flow: 'mobile' | 'otp'
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [loading, setLoading] = useState(false);

  const cleanMobile = () => mobile.replace(/\D/g, '');

  const persist = (p) => {
    const blob = JSON.stringify({ token: p.access_token, admin: p.admin, ts: Date.now() });
    (keepLoggedIn ? localStorage : sessionStorage).setItem('platform_admin_auth', blob);
    // Clean up the other store so a session never lingers.
    (keepLoggedIn ? sessionStorage : localStorage).removeItem('platform_admin_auth');
  };

  const loginWithPassword = async () => {
    if (cleanMobile().length < 10) { toast.error('Enter a valid 10-digit mobile number'); return; }
    if (!password) { toast.error('Enter your password'); return; }
    setLoading(true);
    try {
      const r = await axios.post(`${API}/platform/auth/login-password`, {
        mobile: cleanMobile(),
        password,
      });
      if (!r.data?.access_token) throw new Error('No token');
      persist(r.data);
      toast.success(`Welcome, ${r.data.admin?.name || 'Platform Admin'}`);
      navigate('/platform', { replace: true });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Invalid mobile or password');
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    if (cleanMobile().length < 10) { toast.error('Enter a valid 10-digit mobile number'); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/platform/auth/request-otp`, { mobile: cleanMobile() });
      toast.success('OTP sent to your mobile via SMS');
      setStep('otp');
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  };

  const setPasswordWithOtp = async () => {
    if ((otp || '').length < 4) { toast.error('Enter the OTP from your SMS'); return; }
    if ((newPassword || '').length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/platform/auth/set-password`, {
        mobile: cleanMobile(),
        otp: otp.trim(),
        new_password: newPassword,
      });
      toast.success('Password set — you can now log in');
      setMode('password'); setStep('mobile'); setOtp(''); setNewPassword('');
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Could not set password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 mb-4">
            <Shield className="w-7 h-7 text-primary" strokeWidth={1.8} />
          </div>
          <h1 className="font-fraunces text-2xl font-medium text-foreground">Platform Admin</h1>
          <p className="text-xs text-muted-foreground mt-1.5">Restricted access · SalonHub control plane</p>
        </div>

        <div className="lux-card rounded-2xl bg-card border border-border p-5 space-y-4" data-testid="platform-login-card">
          {/* Google sign-in (Item 9) */}
          <GoogleLoginButton audience="platform" />
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Mobile number</label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-mono">+91</span>
              <Input
                type="tel"
                inputMode="numeric"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile"
                className="bg-background border-border text-foreground"
                data-testid="platform-login-mobile-input"
              />
            </div>
          </div>

          {mode === 'password' ? (
            <>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Password</label>
                <div className="relative">
                  <Input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !loading) loginWithPassword(); }}
                    placeholder="Your password"
                    className="bg-background border-border text-foreground pr-10"
                    autoComplete="current-password"
                    data-testid="platform-login-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    data-testid="platform-login-toggle-password"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={keepLoggedIn}
                  onChange={(e) => setKeepLoggedIn(e.target.checked)}
                  className="accent-primary"
                  data-testid="platform-keep-logged-in"
                />
                Keep me logged in on this device
              </label>

              <Button
                onClick={loginWithPassword}
                disabled={loading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="platform-login-submit"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (<>Sign in <ArrowRight className="w-4 h-4 ml-1.5" /></>)}
              </Button>

              <button
                type="button"
                onClick={() => { setMode('setpw'); setStep('mobile'); }}
                className="w-full text-xs text-muted-foreground/80 hover:text-foreground"
                data-testid="platform-login-go-setpw"
              >
                First time / forgot password? Set it via SMS OTP
              </button>
            </>
          ) : step === 'mobile' ? (
            <>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We'll text a 6-digit code to verify you, then you set a password.
              </p>
              <Button
                onClick={sendOtp}
                disabled={loading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="platform-login-send-otp"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send OTP via SMS'}
              </Button>
              <button
                type="button"
                onClick={() => setMode('password')}
                className="w-full text-xs text-muted-foreground/80 hover:text-foreground"
              >
                Back to password login
              </button>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">SMS OTP</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  maxLength={6}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit code"
                  className="bg-background border-border text-foreground tracking-widest text-center"
                  data-testid="platform-setpw-otp-input"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">New password</label>
                <div className="relative">
                  <Input
                    type={showNewPwd ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="bg-background border-border text-foreground pr-10"
                    autoComplete="new-password"
                    data-testid="platform-setpw-new-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPwd((s) => !s)}
                    aria-label={showNewPwd ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button
                onClick={setPasswordWithOtp}
                disabled={loading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="platform-setpw-submit"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Set password & continue'}
              </Button>
              <button
                type="button"
                onClick={() => { setStep('mobile'); setOtp(''); setNewPassword(''); }}
                className="w-full text-xs text-muted-foreground/80 hover:text-foreground"
              >
                Resend OTP
              </button>
            </>
          )}
        </div>

        <p className="text-[10px] text-center text-muted-foreground/70 mt-4">
          Unauthorized access is prohibited.
        </p>
      </div>
    </div>
  );
}
