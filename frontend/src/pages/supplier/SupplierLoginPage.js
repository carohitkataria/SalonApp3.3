/**
 * Phase 8 — Supplier Login page.
 * Tabs: Password login (default) + OTP login.
 * On blocked status (pending/rejected/suspended), routes to /supplier/pending.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Package, Loader2, Smartphone, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useSupplierAuth } from '@/contexts/SupplierAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function SupplierLoginPage() {
  const navigate = useNavigate();
  const { supplier, token, blockedStatus, loginWithPassword, requestOtp, verifyOtp } = useSupplierAuth();
  const [mode, setMode] = useState('password');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpHint, setOtpHint] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (supplier && token && !blockedStatus) navigate('/supplier/dashboard', { replace: true });
    if (blockedStatus) navigate('/supplier/pending', { replace: true });
  }, [supplier, token, blockedStatus, navigate]);

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (!mobile || !password) { toast.error('Enter mobile and password'); return; }
    setBusy(true);
    try {
      const res = await loginWithPassword(mobile, password);
      if (!res.ok && res.blocked) {
        toast.error(res.blocked.message || 'Account not active');
        navigate('/supplier/pending');
        return;
      }
      toast.success('Welcome back!');
      navigate('/supplier/dashboard');
    } catch (e) {
      toast.error(e.message || 'Login failed');
    } finally { setBusy(false); }
  };

  const handleRequestOtp = async () => {
    if (!mobile) { toast.error('Enter mobile'); return; }
    setBusy(true);
    try {
      const r = await requestOtp(mobile);
      setOtpSent(true);
      if (r.otp) setOtpHint(`Dev OTP: ${r.otp}`);
      toast.success(r.message || 'OTP sent');
    } catch (e) {
      toast.error('Failed to send OTP');
    } finally { setBusy(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) { toast.error('Enter OTP'); return; }
    setBusy(true);
    try {
      const res = await verifyOtp(mobile, otp);
      if (!res.ok && res.blocked) {
        toast.error(res.blocked.message || 'Account not active');
        navigate('/supplier/pending');
        return;
      }
      toast.success('Welcome!');
      navigate('/supplier/dashboard');
    } catch (e) {
      toast.error(e.message || 'OTP verification failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/40 flex items-center justify-center mx-auto mb-3">
            <Package className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Supplier Login</h1>
          <p className="text-sm text-muted-foreground/80 mt-1">Sell salon products on SalonHub Marketplace</p>
        </div>

        <div className="bg-card/60 border border-border rounded-2xl p-6">
          <div className="flex border border-border rounded-lg overflow-hidden mb-5 text-xs font-bold">
            <button
              onClick={() => setMode('password')}
              data-testid="supplier-login-tab-password"
              className={`flex-1 py-2.5 transition-colors flex items-center justify-center gap-1.5 ${
                mode === 'password' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:text-foreground'
              }`}
            ><KeyRound className="w-3.5 h-3.5" /> PASSWORD</button>
            <button
              onClick={() => setMode('otp')}
              data-testid="supplier-login-tab-otp"
              className={`flex-1 py-2.5 transition-colors flex items-center justify-center gap-1.5 ${
                mode === 'otp' ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground hover:text-foreground'
              }`}
            ><Smartphone className="w-3.5 h-3.5" /> OTP</button>
          </div>

          {mode === 'password' ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4" data-testid="supplier-login-password-form">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Mobile</label>
                <Input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="10-digit mobile" data-testid="supplier-login-mobile-input" className="mt-1 bg-background border-border text-foreground" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Password</label>
                <div className="relative">
                  <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" data-testid="supplier-login-password-input" className="mt-1 bg-background border-border text-foreground pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 p-1 text-muted-foreground/80 hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={busy} data-testid="supplier-login-submit-btn" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Sign in
              </Button>
            </form>
          ) : (
            <form onSubmit={otpSent ? handleVerifyOtp : (e) => { e.preventDefault(); handleRequestOtp(); }} className="space-y-4" data-testid="supplier-login-otp-form">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Mobile</label>
                <Input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="10-digit mobile" disabled={otpSent} data-testid="supplier-otp-mobile-input" className="mt-1 bg-background border-border text-foreground" />
              </div>
              {otpSent && (
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">6-digit OTP</label>
                  <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" maxLength={6} data-testid="supplier-otp-input" className="mt-1 bg-background border-border text-foreground text-center text-xl tracking-[0.5em]" />
                  {otpHint && <div className="text-[10px] text-primary mt-1" data-testid="supplier-otp-hint">{otpHint}</div>}
                </div>
              )}
              <Button type="submit" disabled={busy} data-testid="supplier-otp-submit-btn" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {otpSent ? 'Verify OTP' : 'Send OTP'}
              </Button>
              {otpSent && (
                <button type="button" onClick={() => { setOtpSent(false); setOtp(''); setOtpHint(''); }} className="w-full text-xs text-muted-foreground/80 hover:text-foreground">
                  Change mobile
                </button>
              )}
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-border text-center text-sm">
            <span className="text-muted-foreground/80">New supplier? </span>
            <Link to="/supplier/signup" data-testid="supplier-login-signup-link" className="text-primary hover:text-primary font-semibold">Sign up here</Link>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-xs text-muted-foreground/60 hover:text-muted-foreground">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}
