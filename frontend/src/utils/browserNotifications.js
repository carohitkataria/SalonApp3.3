// Browser in-app notifications with sound
// Uses the Notification API and Web Audio API for a small beep sound

let _audioCtx = null;

function getAudioCtx() {
  if (_audioCtx) return _audioCtx;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    _audioCtx = new Ctx();
    return _audioCtx;
  } catch (e) {
    return null;
  }
}

// Play a short two-tone "ding" beep
export function playNotificationSound() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch((err) => {
        console.warn('Failed to resume audio context:', err);
      });
    }
    const now = ctx.currentTime;

    // Tone 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.26);

    // Tone 2 (slightly higher, right after)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1175, now + 0.18);
    gain2.gain.setValueAtTime(0.0001, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.22, now + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.56);
  } catch (e) {
    console.warn('Audio notification sound failed:', e);
  }
}

// Service Worker registration so notifications also fire when tab is backgrounded.
// Stored as a module-level promise so we don't register twice.
let _swRegistrationPromise = null;
const SW_PATH = '/notification-sw.js';

export function registerNotificationServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve(null);
  if (_swRegistrationPromise) return _swRegistrationPromise;
  _swRegistrationPromise = navigator.serviceWorker.register(SW_PATH).catch((e) => {
    console.warn('[Notify] Service worker registration failed:', e);
    _swRegistrationPromise = null;
    return null;
  });
  return _swRegistrationPromise;
}

// Request permission only when called (used as opt-in trigger from a button)
export function optInForPushNotifications() {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return Promise.resolve('unsupported');
    }
    // Register service worker so SW-based notifications work in backgrounded tabs
    registerNotificationServiceWorker();
    if (Notification.permission === 'granted') return Promise.resolve('granted');
    if (Notification.permission === 'denied') return Promise.resolve('denied');
    return Notification.requestPermission().then((p) => p).catch(() => 'denied');
  } catch (e) {
    return Promise.resolve('unsupported');
  }
}

// Request permission if not decided yet
export function requestNotificationPermission() {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    // Register the SW eagerly when permission is already granted so backgrounded
    // tab notifications work end-to-end.
    if (Notification.permission === 'granted') {
      registerNotificationServiceWorker();
    }
    if (Notification.permission === 'default') {
      Notification.requestPermission().then((p) => {
        if (p === 'granted') registerNotificationServiceWorker();
      }).catch((err) => {
        console.warn('Notification permission request failed:', err);
      });
    }
    return Notification.permission;
  } catch (e) {
    return 'unsupported';
  }
}

// Show via Service Worker if registered (works when tab backgrounded);
// otherwise fall back to direct Notification.
async function showViaServiceWorker(title, body, options = {}) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const reg = await registerNotificationServiceWorker();
    if (!reg) return false;
    if (reg.active) {
      reg.active.postMessage({
        type: 'show-notification',
        title,
        body: body || '',
        tag: options.tag,
        url: options.url || '/',
        requireInteraction: !!options.requireInteraction,
      });
      return true;
    }
    // SW exists but not active yet — call showNotification directly on registration
    if (reg.showNotification) {
      await reg.showNotification(title, {
        body: body || '',
        tag: options.tag,
        icon: options.icon || '/favicon.ico',
        badge: options.badge || '/favicon.ico',
        data: { url: options.url || '/' },
      });
      return true;
    }
  } catch (e) {
    // fall through to direct Notification
  }
  return false;
}

// Show a browser notification with sound
export function showBrowserNotification(title, body, options = {}) {
  try {
    // Play sound regardless (works even if notifications are blocked, when tab visible)
    playNotificationSound();

    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') {
      return;
    }

    // Prefer Service Worker so it fires even when tab is backgrounded.
    showViaServiceWorker(title, body, options).then((shown) => {
      if (shown) return;
      // Fallback: direct Notification
      try {
        const n = new Notification(title, {
          body: body || '',
          icon: options.icon || '/favicon.ico',
          badge: options.badge || '/favicon.ico',
          tag: options.tag,
          renotify: !!options.tag,
          silent: false,
          ...options,
        });
        setTimeout(() => { 
          try { n.close(); } 
          catch (e) { console.warn('Failed to auto-close notification:', e); }
        }, 8000);
        if (options.onClick) {
          n.onclick = options.onClick;
        } else {
          n.onclick = () => {
            try { window.focus(); n.close(); } 
            catch (e) { console.warn('Failed to focus window or close notification:', e); }
          };
        }
      } catch (e) { 
        console.error('Failed to show notification:', e);
      }
    });
  } catch (e) {
    console.error('Error in showBrowserNotification:', e);
  }
}

// Seen notification ID storage (per user/salon)
export function getSeenIds(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    return new Set();
  }
}

export function setSeenIds(storageKey, ids) {
  try {
    // Keep only the latest 200 IDs to avoid bloat
    const arr = Array.from(ids).slice(-200);
    localStorage.setItem(storageKey, JSON.stringify(arr));
  } catch (e) {
    console.error('Failed to save seen notification IDs:', e);
  }
}

// Check if notifications are supported
export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPermissionStatus() {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}
