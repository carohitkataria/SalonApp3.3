/**
 * Platform Admin login (HIDDEN).
 *
 * Bookmark URL: `<your-domain>/platform/login`. Not linked from anywhere.
 *
 * Flow:
 *  1. Enter mobile → POST /api/platform/auth/request-otp
 *  2. Enter OTP → POST /api/platform/auth/verify-otp → access_token
 *  3. Persist token in localStorage as `platform_admin_auth`
 *  4. Redirect to /platform (placeholder for the dashboard built in Phase 5/6)
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Shield, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PlatformLoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('mobile'); // mobile | otp
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState(null);

  const sendOtp = async () => {
    const cleaned = mobile.replace(/\D/g, '');
    if (cleaned.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    setHint(null);
    try {
      const r = await axios.post(`${API}/platform/auth/request-otp`, {
        mobile: cleaned,
      });
      // If WhatsApp isn't configured (dev), the API returns the OTP in payload.
      if (r.data?.otp) {
        setHint(`Dev OTP: ${r.data.otp}`);
      }
      toast.success('OTP sent to WhatsApp');
      setStep('otp');
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if ((otp || '').length < 4) {
      toast.error('Please enter the OTP from WhatsApp');
      return;
    }
    setLoading(true);
    try {
      const r = await axios.post(`${API}/platform/auth/verify-otp`, {
        mobile: mobile.replace(/\D/g, ''),
        otp: otp.trim(),
      });
      const payload = r.data || {};
      if (!payload.access_token) {
        throw new Error('No access token returned');
      }
      localStorage.setItem(
        'platform_admin_auth',
        JSON.stringify({
          token: payload.access_token,
          admin: payload.admin,
          ts: Date.now(),
        })
      );
      toast.success(`Welcome, ${payload.admin?.name || 'Platform Admin'}`);
      navigate('/platform', { replace: true });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-4">
            <Shield className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Platform Admin</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Restricted access · SalonHub control plane
          </p>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 backdrop-blur">
          {step === 'mobile' ? (
            <>
              <label className="text-xs uppercase tracking-widest text-zinc-400 font-medium">
                Mobile number
              </label>
              <Input
                placeholder="10-digit mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="mt-2 bg-zinc-950 border-zinc-800 text-white"
                maxLength={13}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && !loading) sendOtp(); }}
              />
              <Button
                onClick={sendOtp}
                disabled={loading}
                className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>Send OTP <ArrowRight className="w-4 h-4 ml-1" /></>
                )}
              </Button>
            </>
          ) : (
            <>
              <p className="text-xs text-zinc-400 mb-3">
                We sent a 6-digit code to <span className="text-white font-medium">+91 {mobile}</span>.
              </p>
              <label className="text-xs uppercase tracking-widest text-zinc-400 font-medium">
                OTP
              </label>
              <Input
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="mt-2 bg-zinc-950 border-zinc-800 text-white tracking-widest text-center"
                maxLength={6}
                inputMode="numeric"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && !loading) verifyOtp(); }}
              />
              {hint && (
                <p className="mt-2 text-[11px] text-amber-400/80 font-mono text-center">{hint}</p>
              )}
              <Button
                onClick={verifyOtp}
                disabled={loading}
                className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify & Sign in'}
              </Button>
              <button
                onClick={() => { setStep('mobile'); setOtp(''); setHint(null); }}
                disabled={loading}
                className="w-full mt-2 text-xs text-zinc-500 hover:text-white"
              >
                Change number
              </button>
            </>
          )}
        </div>

        <p className="text-[11px] text-center text-zinc-600 mt-6">
          Unauthorized access is prohibited.
        </p>
      </div>
    </div>
  );
}
