/* Service worker: deja la app disponible sin conexión.
   Subí el número de versión cuando cambies archivos para que los celulares actualicen. */
const VERSION = 'v6';
const CACHE = 'moneda-batalla-' + VERSION;
const FILES = [
  './', 'index.html', 'css/style.css',
  'js/common.js', 'js/audio.js', 'js/coin.js', 'js/art.js', 'js/personas.js', 'js/maps.js', 'js/battle.js', 'js/modes.js', 'js/props.js', 'js/replay.js', 'js/narrator.js', 'js/hist.js', 'js/tourney.js', 'js/ai.js', 'js/main.js',
  'manifest.webmanifest',
  'assets/coin-milei.png', 'assets/coin-cristina.png',
  'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Primero la red (así siempre ves la última versión); si no hay conexión, el caché.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(e.request)),
  );
});
