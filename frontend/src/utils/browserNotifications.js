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
      ctx.resume().catch(() => {});
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
    // ignore
  }
}

// Request permission if not decided yet
export function requestNotificationPermission() {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    return Notification.permission;
  } catch (e) {
    return 'unsupported';
  }
}

// Show a browser notification with sound
export function showBrowserNotification(title, body, options = {}) {
  try {
    // Play sound regardless (works even if notifications are blocked)
    playNotificationSound();

    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') {
      // Try once more to ask
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      return;
    }
    const n = new Notification(title, {
      body: body || '',
      icon: options.icon || '/favicon.ico',
      badge: options.badge || '/favicon.ico',
      tag: options.tag,
      renotify: !!options.tag,
      silent: false,
      ...options,
    });
    // Auto close after 8s
    setTimeout(() => {
      try { n.close(); } catch (e) {}
    }, 8000);
    if (options.onClick) {
      n.onclick = options.onClick;
    } else {
      n.onclick = () => {
        try {
          window.focus();
          n.close();
        } catch (e) {}
      };
    }
  } catch (e) {
    // ignore
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
  } catch (e) {}
}

// Check if notifications are supported
export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getPermissionStatus() {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}
