/* Service worker của SAM: nhận thông báo đẩy (Web Push) và mở đúng màn hình khi bấm vào thông báo (mục 5.9 đề tài).
   Không lưu đệm trang (luôn lấy bản mới từ máy chủ). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

const ICON = new URL('icons/icon-192.png', self.registration.scope).href;
const BADGE = new URL('icons/badge-96.png', self.registration.scope).href;

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'SAM – Quản lý tài sản';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'Có thông báo mới trên SAM.',
      icon: ICON,
      badge: BADGE,
      tag: data.tag || 'sam',
      renotify: true,
      data: { url: data.url || './' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of wins) {
        if (c.url.startsWith(self.registration.scope)) {
          await c.focus();
          c.postMessage({ type: 'sam-navigate', url: target });
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
