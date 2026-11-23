/* Service worker: deja la app disponible sin conexión.
   Subí el número de versión cuando cambies archivos para que los celulares actualicen. */
const VERSION = 'v12';
const CACHE = 'moneda-batalla-' + VERSION;
const FILES = [
  './', 'index.html', 'css/style.css',
  'js/common.js', 'js/icons.js', 'js/audio.js', 'js/sfxbank.js', 'js/ambience.js', 'js/coin.js', 'js/art.js', 'js/personas.js', 'js/maps.js', 'js/battle.js', 'js/modes.js', 'js/props.js', 'js/rig.js', 'js/replay.js', 'js/narrator.js', 'js/hist.js', 'js/tourney.js', 'js/ai.js', 'js/brain2.js', 'js/squad.js', 'js/world2.js', 'js/editor.js', 'js/fx.js', 'js/help.js', 'js/runway.js', 'js/main.js',
  'manifest.webmanifest',
  'assets/coin-milei.png', 'assets/coin-cristina.png',
  'assets/sfx/boom.mp3', 'assets/sfx/boom_big.mp3', 'assets/sfx/boom_far.mp3', 'assets/sfx/coin.mp3', 'assets/sfx/death.mp3', 'assets/sfx/death2.mp3', 'assets/sfx/g_auto.mp3', 'assets/sfx/g_auto_far.mp3', 'assets/sfx/g_heavy.mp3', 'assets/sfx/g_heavy_far.mp3', 'assets/sfx/g_pistol.mp3', 'assets/sfx/g_pistol_far.mp3', 'assets/sfx/g_shotgun.mp3', 'assets/sfx/g_shotgun_far.mp3', 'assets/sfx/hit_flesh.mp3', 'assets/sfx/hit_hard.mp3', 'assets/sfx/hit_metal.mp3', 'assets/sfx/land.mp3', 'assets/sfx/mag_in.mp3', 'assets/sfx/mag_out.mp3', 'assets/sfx/music_battle.mp3', 'assets/sfx/oof.mp3', 'assets/sfx/pain.mp3', 'assets/sfx/pick_gun.mp3', 'assets/sfx/pick_item.mp3', 'assets/sfx/power.mp3', 'assets/sfx/pump.mp3', 'assets/sfx/punch.mp3', 'assets/sfx/radio.mp3', 'assets/sfx/revive.mp3', 'assets/sfx/shell.mp3', 'assets/sfx/stab.mp3', 'assets/sfx/step.mp3', 'assets/sfx/swap.mp3', 'assets/sfx/swing.mp3', 'assets/sfx/switch.mp3', 'assets/sfx/tink.mp3', 'assets/sfx/ui.mp3',
  'assets/fonts/black-ops-one.woff2', 'assets/fonts/cinzel-700.woff2',
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
