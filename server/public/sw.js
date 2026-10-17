// Pushes arrive without a payload; ask the server what the latest note was and show it.
self.addEventListener('push', e => {
  e.waitUntil(fetch('/api/notes/latest', { credentials: 'include' }).then(r => r.json()).catch(() => ({ title: 'INSANE', body: 'Something new.' }))
    .then(n => self.registration.showNotification(n.title || 'INSANE', { body: n.body || '', tag: n.tag || 'insane', icon: '/icon.svg', badge: '/icon.svg' })));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(ws => ws.length ? ws[0].focus() : self.clients.openWindow('/')));
});
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
