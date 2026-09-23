const CACHE = 'helen-rpg-v0.1-3';
// index.html contains the exact app CSS and JavaScript. Source files are not
// runtime dependencies and must not prevent installation if hosted separately.
const FILES = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('helen-rpg-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const isAsset = FILES.some(path => new URL(path, self.registration.scope).href === event.request.url);
  if (!isAsset && event.request.mode !== 'navigate') return;
  const cachePromise = caches.open(CACHE);
  // Start from the local app immediately. Refresh in the background for the
  // next launch, without making a slow or unavailable network block the UI.
  const refresh = fetch(event.request).then(async response => {
    if (response.ok && !response.redirected && isAsset) {
      const isHTML = event.request.mode === 'navigate';
      const validHTML = !isHTML || (response.headers.get('content-type')?.includes('text/html') && (await response.clone().text()).includes('id="app-bundle"'));
      if (validHTML) await (await cachePromise).put(event.request, response.clone());
    }
    return response;
  }).catch(() => null);
  event.waitUntil(refresh.then(() => {}));
  event.respondWith((async () => {
    const cache = await cachePromise;
    const cached = await cache.match(event.request) || (event.request.mode === 'navigate' ? await cache.match(new URL('./index.html', self.registration.scope)) : undefined);
    return cached || await refresh || Response.error();
  })());
});
