// INSANE service worker (C07, C08).
// The page registers /sw.js?b=<BUILD_ID>, so each build gets its own worker and its own cache,
// "insane-<BUILD_ID>". Install precaches the shell (index.html, manifest, icons, the world map).
// Pages are served cache-first from that cache, so a cold start with no signal still opens INSANE and
// a running session never swaps builds under itself. A new build waits until the page asks it to take
// over (the "New version ready" bar posts {type:'skip'}), then old caches are deleted.
// /api/* and everything else go to the network untouched.
const BUILD = new URL(self.location.href).searchParams.get('b') || 'dev';
const CACHE = 'insane-' + BUILD;
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/data/world.json'];
const ASSET = /^\/(manifest\.webmanifest|icon\.svg|icon-[\w-]+\.png|apple-touch-icon\.png|data\/world\.json)$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => fetch(u, { cache: 'reload', credentials: 'same-origin' })
    .then(r => { if (!r.ok && u === '/') throw new Error('shell ' + r.status); return r.ok ? c.put(u, r) : null; })))));
  // No skipWaiting: the first worker activates on its own; later ones wait for the page's go-ahead.
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('insane-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'skip') self.skipWaiting();
  if (e.data && e.data.type === 'build' && e.ports[0]) e.ports[0].postMessage(BUILD);
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html')) {
    e.respondWith(caches.open(CACHE).then(c => c.match('/')).then(hit => hit || fetch(req).catch(() => caches.match('/'))));
    return;
  }
  if (ASSET.test(url.pathname)) e.respondWith(caches.open(CACHE).then(c => c.match(url.pathname).then(hit => hit || fetch(req).then(r => { if (r.ok) c.put(url.pathname, r.clone()); return r; }))));
});

// Pushes arrive without a payload; ask the server what the latest note was and show it.
self.addEventListener('push', e => {
  e.waitUntil(fetch('/api/notes/latest', { credentials: 'include' }).then(r => r.json()).catch(() => ({ title: 'INSANE', body: 'Something new.' }))
    .then(n => self.registration.showNotification(n.title || 'INSANE', { body: n.body || '', tag: n.tag || 'insane', icon: '/icon-192.png', badge: '/icon-192.png' })));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(ws => ws.length ? ws[0].focus() : self.clients.openWindow('/')));
});
