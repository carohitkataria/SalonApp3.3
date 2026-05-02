/* SalonHub Notification Service Worker
 *
 * Lightweight SW that lets the page show OS-level notifications
 * even when the tab is backgrounded / minimised. Avoids any external
 * push provider (no FCM / VAPID needed).
 *
 * The page sends notifications via:
 *   navigator.serviceWorker.controller.postMessage({
 *     type: 'show-notification',
 *     title, body, tag, url
 *   })
 *
 * On notification click, the SW focuses the existing tab (or opens one).
 */

self.addEventListener('install', (event) => {
  // Activate immediately so the very first registration can post messages.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all uncontrolled clients (existing pages) right away.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'show-notification') {
    const title = data.title || 'SalonHub';
    const body = data.body || '';
    const tag = data.tag || 'salonhub';
    const url = data.url || '/';
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        tag,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        requireInteraction: !!data.requireInteraction,
        data: { url },
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      // Try focusing an existing window
      for (const client of clientsArr) {
        try {
          if ('focus' in client) {
            client.focus();
            // Navigate the focused client to the target URL
            if ('navigate' in client && targetUrl) {
              try { client.navigate(targetUrl); } catch (e) { /* ignore */ }
            }
            return;
          }
        } catch (e) { /* ignore */ }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
