import React, { useEffect, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  optInForPushNotifications,
  registerNotificationServiceWorker,
  showBrowserNotification,
  isNotificationSupported,
  getPermissionStatus,
} from '@/utils/browserNotifications';

const DISMISS_KEY = 'notif_optin_dismissed_v1';

/**
 * NotificationOptInBanner
 *
 * Shows a non-intrusive opt-in banner asking customers to enable browser
 * push notifications, so they get pinged the moment their token is called —
 * even if the tab is backgrounded.
 *
 * - Hidden if browser doesn't support Notifications.
 * - Hidden if permission is already granted (or denied).
 * - User can dismiss; banner won't reappear (per browser).
 */
export default function NotificationOptInBanner() {
  const [permission, setPermission] = useState(() => getPermissionStatus());
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
  });
  const [enabling, setEnabling] = useState(false);

  // Re-register SW if permission was already granted before opt-in flow
  useEffect(() => {
    if (permission === 'granted') {
      registerNotificationServiceWorker();
    }
  }, [permission]);

  if (!isNotificationSupported()) return null;
  if (permission === 'granted') return null;
  if (permission === 'denied') return null;
  if (dismissed) return null;

  const handleEnable = async () => {
    setEnabling(true);
    try {
      const result = await optInForPushNotifications();
      setPermission(result);
      if (result === 'granted') {
        toast.success('Notifications enabled — we\'ll ping you when your turn comes!');
        // Fire a quick sample so the customer sees it works
        showBrowserNotification(
          'Notifications enabled',
          'You\'ll be alerted the moment your token is called.',
          { tag: 'notif-optin-sample' }
        );
      } else if (result === 'denied') {
        toast.error('Notifications blocked. You can enable them from your browser settings.');
      }
    } finally {
      setEnabling(false);
    }
  };

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="max-w-5xl mx-auto pt-16 px-4"
      >
        <div className="mr-12 bg-gradient-to-r from-gold/15 to-yellow-500/10 border border-gold/30 rounded-xl p-3 sm:p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 bg-gold/20 rounded-lg flex-shrink-0">
                <Bell className="w-5 h-5 text-gold" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm">Get pinged when your turn comes</p>
                <p className="text-xs text-muted-foreground">
                  Enable browser notifications to be alerted instantly — even when this tab is in the background.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleEnable}
                disabled={enabling}
                className="inline-flex items-center gap-1 px-3 py-2 bg-gold text-black hover:bg-gold/90 rounded-md text-sm font-medium disabled:opacity-60"
              >
                <Check className="w-4 h-4" />
                {enabling ? 'Enabling…' : 'Enable'}
              </button>
              <button
                onClick={handleDismiss}
                className="p-2 text-muted-foreground hover:text-foreground rounded-md"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
