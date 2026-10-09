// 字斗西游 service worker: written by build/sw-plugin.ts from build/sw-template.js at build time; edit the template.
// install: precache the whole game. activate: drop older zdxy-* caches, take over open pages.
// fetch (GET, same origin): page loads network first (3 s, then the cached index.html), precached files cache first,
// anything else straight to the network. A new build waits until the page posts {type: 'SKIP_WAITING'}.
const CACHE = __CACHE_NAME__;
const PRECACHE = __PRECACHE__;

/** Every cache the game creates starts with this. */
const PREFIX = 'zdxy-';
/** How long a page load waits for the network before answering with the cached index.html. */
const NAVIGATION_TIMEOUT_MS = 3000;
/** Reason: one entry per URL, so a host's Vary header (Accept, ...) must not make a precached file miss offline. */
const MATCH = { ignoreVary: true };

// Reason: entries are relative to this script, so the game keeps working when it is served from a sub-path.
const PRECACHE_URLS = PRECACHE.map((path) => new URL(path, self.location.href).href);
const PRECACHED = new Set(PRECACHE_URLS);
const INDEX_URL = new URL('index.html', self.location.href).href;

self.addEventListener('install', (event) => {
  // Reason: 'reload' bypasses the HTTP cache, so a stale index.html can never land next to newer assets.
  const requests = PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' }));
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(requests)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// The title screen's 有新版本 banner asks the waiting worker to take over; the page reloads on controllerchange.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') event.respondWith(networkFirst(request));
  else if (PRECACHED.has(request.url)) event.respondWith(cacheFirst(request));
  // Everything else is left to the browser, i.e. the network.
});

/** A page load: the network's answer, unless it fails or is slower than the timeout and index.html is cached. */
async function networkFirst(request) {
  const network = fetch(request);
  try {
    return await Promise.race([network, rejectAfter(NAVIGATION_TIMEOUT_MS)]);
  } catch {
    const cached = await caches.open(CACHE).then((cache) => cache.match(INDEX_URL, MATCH));
    // Reason: with nothing cached, keep waiting for the network; its error (if any) becomes the page's error.
    return cached ? unredirected(cached) : network;
  }
}

/** A precached file: from the cache, or from the network if the browser evicted it. */
async function cacheFirst(request) {
  const cached = await caches.open(CACHE).then((cache) => cache.match(request, MATCH));
  return cached || fetch(request);
}

function rejectAfter(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('network timeout')), ms));
}

/**
 * The response without its redirect flag.
 * Reason: hosts with clean URLs answer /index.html with a redirect to /, and a redirected response may not answer
 * a navigation (the browser shows an error page instead).
 */
function unredirected(response) {
  if (!response.redirected) return response;
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers });
}
