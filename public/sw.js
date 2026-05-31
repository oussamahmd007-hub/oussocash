// sw.js — Service Worker خفيف لتفعيل تثبيت التطبيق (PWA)
// لا يتعارض مع OneSignalSDKWorker.js (مساران مختلفان)
const CACHE = 'oussocash-v3';
const SHELL = ['/', '/index.html', '/styles.css', '/app.js', '/texts.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
  )));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // لا نتدخل في طلبات الـ API أبداً (تبقى حيّة)
  if (url.pathname.startsWith('/api/')) return;
  if (e.request.method !== 'GET') return;
  // network-first للصفحات، cache fallback عند انقطاع الشبكة
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy).catch(() => {}));
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('/index.html')))
  );
});
