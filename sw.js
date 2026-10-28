// Service worker: appka funguje offline.
// PRAVIDLO: každá změna, která jde do vydání, zvýší CACHE_VERSION.
// Každý nový soubor appky patří do ASSETS (hlídá to tests/sw.test.mjs).

const CACHE_VERSION = 'v3';
const CACHE_PREFIX = 'mala-nasobilka-';
const CACHE = CACHE_PREFIX + CACHE_VERSION;

const ASSETS = [
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/main.js',
  'js/facts.js',
  'js/storage.js',
  'js/learning.js',
  'js/distractors.js',
  'js/round.js',
  'js/progress.js',
  'js/sound.js',
  'js/ui/dom.js',
  'js/ui/home.js',
  'js/ui/game.js',
  'js/ui/summary.js',
  'js/ui/parents.js',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('index.html', { cacheName: CACHE }).then((cached) => cached || fetch(request))
    );
    return;
  }

  event.respondWith(
    caches
      .match(request, { cacheName: CACHE, ignoreSearch: true })
      .then((cached) => cached || fetch(request))
  );
});
