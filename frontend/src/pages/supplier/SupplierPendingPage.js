/**
 * Phase 8 — Supplier Pending/Status Screen.
 * Shows when supplier login is blocked due to status != active.
 * Reads blockedStatus + blockedDetail from SupplierAuthContext.
 */
import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Clock, XCircle, AlertOctagon, LogOut, ArrowRight } from 'lucide-react';
import { useSupplierAuth } from '@/contexts/SupplierAuthContext';
import { Button } from '@/components/ui/button';

const STATUS_CONFIG = {
  pending_approval: {
    icon: Clock,
    title: 'Your application is under review',
    desc: 'Our team is reviewing your supplier details. This usually takes 1–2 business days. You\'ll receive a WhatsApp message once your account is approved.',
    tone: 'amber',
  },
  rejected: {
    icon: XCircle,
    title: 'Application not approved',
    desc: 'Unfortunately we could not approve your supplier application. Please review the reason below, update your details if needed, and reach out to support.',
    tone: 'rose',
  },
  suspended: {
    icon: AlertOctagon,
    title: 'Account suspended',
    desc: 'Your supplier account has been temporarily suspended. Please contact support for assistance.',
    tone: 'rose',
  },
};

const toneClasses = {
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/40', text: 'text-amber-300', iconBg: 'bg-amber-500/15' },
  rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/40', text: 'text-rose-300', iconBg: 'bg-rose-500/15' },
};

export default function SupplierPendingPage() {
  const navigate = useNavigate();
  const { blockedStatus, blockedDetail, logout, supplier } = useSupplierAuth();

  const status = blockedStatus || 'pending_approval';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending_approval;
  const Icon = config.icon;
  const tone = toneClasses[config.tone];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className={`rounded-2xl border ${tone.border} ${tone.bg} p-8`}>
          <div className={`w-16 h-16 rounded-2xl ${tone.iconBg} flex items-center justify-center mx-auto mb-5`}>
            <Icon className={`w-8 h-8 ${tone.text}`} />
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-3">{config.title}</h1>
          <p className="text-sm text-zinc-300 text-center leading-relaxed">{config.desc}</p>

          {blockedDetail?.rejection_reason && (
            <div className="mt-6 rounded-lg border border-zinc-700 bg-zinc-950/50 p-4">
              <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Reason</div>
              <div className="text-sm text-zinc-100">{blockedDetail.rejection_reason}</div>
            </div>
          )}

          {supplier?.business_name && (
            <div className="mt-6 text-center text-xs text-zinc-500">
              Account: <span className="font-mono text-zinc-300">{supplier.business_name}</span>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-2">
            <Button onClick={handleLogout} variant="outline" className="w-full">
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
            <Link to="/" className="text-xs text-zinc-500 hover:text-zinc-300 text-center pt-2">
              ← Back to home
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-zinc-500">
          Need help? Contact <a href="mailto:support@salonhub.in" className="text-amber-400 hover:text-amber-300">support@salonhub.in</a>
          <ArrowRight className="inline w-3 h-3 ml-1" />
        </div>
      </div>
    </div>
  );
}
