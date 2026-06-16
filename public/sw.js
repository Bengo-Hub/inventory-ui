/* eslint-disable no-restricted-globals */
// Uniform Codevertex offline-shell service worker (committed, runtime-caching, bundler-agnostic).
// next-pwa is disabled (disable:true) so no build overwrites this file. Registered by the shared
// OfflineBar (registerServiceWorker). network-first navigations (cached page offline), cache-first
// static, network-only API.
const VERSION = 'cv-offline-sw-v1';
const DOC_CACHE = `${VERSION}-documents`;
const ASSET_CACHE = `${VERSION}-assets`;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
function isAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/images/') ||
    /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|gif|webp|ico)$/.test(url.pathname);
}
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.status === 200 && fresh.type === 'basic') { (await caches.open(DOC_CACHE)).put(request, fresh.clone()); }
        return fresh;
      } catch {
        const cache = await caches.open(DOC_CACHE);
        const exact = await cache.match(request, { ignoreSearch: true });
        if (exact) return exact;
        const any = (await cache.keys())[0];
        if (any) return cache.match(any);
        return new Response('<!doctype html><meta charset="utf-8"><title>Offline</title><body style="font-family:system-ui;padding:2rem">Offline — reopen when your connection returns.</body>', { headers: { 'Content-Type': 'text/html' }, status: 200 });
      }
    })());
    return;
  }
  if (isAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try { const fresh = await fetch(request); if (fresh && fresh.status === 200) cache.put(request, fresh.clone()); return fresh; }
      catch { return cached || Response.error(); }
    })());
  }
});
