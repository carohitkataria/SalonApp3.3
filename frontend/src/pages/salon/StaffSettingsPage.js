/**
 * Module 3 — Staff Settings page (standalone /salon/staff/settings).
 *
 * Thin wrapper around <StaffSettingsContent /> with page chrome (header,
 * back button, hamburger menu).  The actual tabs / forms live inside the
 * reusable content component so the same UI also renders inline inside
 * Salon Settings → Staff tab.
 */
import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import SalonHamburgerMenu from '@/components/salon/SalonHamburgerMenu';
import StaffSettingsContent from '@/components/staff/StaffSettingsContent';

export default function StaffSettingsPage() {
  const navigate = useNavigate();

  const { salonId, authHeaders } = useMemo(() => {
    let sid = null;
    let token = localStorage.getItem('salon_admin_token') || localStorage.getItem('access_token');
    const raw = localStorage.getItem('salon_user_auth');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        sid = parsed.salon_id || parsed.salonId || parsed.user?.salon_id;
        if (!token) token = parsed.token;
      } catch { /* noop */ }
    }
    if (!sid) sid = localStorage.getItem('salon_id');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    return { salonId: sid, authHeaders: headers };
  }, []);

  useEffect(() => {
    if (!salonId) {
      toast.error('Please log in as salon admin');
      navigate('/admin/login');
    }
  }, [salonId, navigate]);

  if (!salonId) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <SalonHamburgerMenu activeId="staff-settings" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/dashboard?tab=salon')}
            data-testid="staff-settings-back-btn"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Salon Settings
          </Button>
          <div className="flex-1">
            <div className="text-sm font-bold">Staff Settings</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/80">
              Incentives · Leave · Attendance · Holidays
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <StaffSettingsContent
          salonId={salonId}
          authHeaders={authHeaders}
          isAdmin={true}
          useUrlTab={true}
          defaultTab="incentives"
        />
      </main>
    </div>
  );
}
