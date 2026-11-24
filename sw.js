/* Service worker: deja la app disponible sin conexión.
   Subí el número de versión cuando cambies archivos para que los celulares actualicen. */
const VERSION = 'v14';
const CACHE = 'moneda-batalla-' + VERSION;
const FILES = [
  './', 'index.html', 'css/style.css',
  'js/common.js', 'js/icons.js', 'js/audio.js', 'js/sfxbank.js', 'js/ambience.js', 'js/coin.js', 'js/art.js', 'js/personas.js', 'js/maps.js', 'js/battle.js', 'js/modes.js', 'js/props.js', 'js/rig.js', 'js/replay.js', 'js/narrator.js', 'js/hist.js', 'js/tourney.js', 'js/ai.js', 'js/brain2.js', 'js/squad.js', 'js/world2.js', 'js/editor.js', 'js/fx.js', 'js/polish.js', 'js/artdata.js', 'js/world3.js', 'js/help.js', 'js/runway.js', 'js/main.js',
  'manifest.webmanifest',
  'assets/coin-milei.png', 'assets/coin-cristina.png',
  'assets/sfx/boom.mp3', 'assets/sfx/boom_big.mp3', 'assets/sfx/boom_far.mp3', 'assets/sfx/coin.mp3', 'assets/sfx/death.mp3', 'assets/sfx/death2.mp3', 'assets/sfx/g_auto.mp3', 'assets/sfx/g_auto_far.mp3', 'assets/sfx/g_heavy.mp3', 'assets/sfx/g_heavy_far.mp3', 'assets/sfx/g_pistol.mp3', 'assets/sfx/g_pistol_far.mp3', 'assets/sfx/g_shotgun.mp3', 'assets/sfx/g_shotgun_far.mp3', 'assets/sfx/hit_flesh.mp3', 'assets/sfx/hit_hard.mp3', 'assets/sfx/hit_metal.mp3', 'assets/sfx/land.mp3', 'assets/sfx/mag_in.mp3', 'assets/sfx/mag_out.mp3', 'assets/sfx/music_battle.mp3', 'assets/sfx/oof.mp3', 'assets/sfx/pain.mp3', 'assets/sfx/pick_gun.mp3', 'assets/sfx/pick_item.mp3', 'assets/sfx/power.mp3', 'assets/sfx/pump.mp3', 'assets/sfx/punch.mp3', 'assets/sfx/radio.mp3', 'assets/sfx/revive.mp3', 'assets/sfx/shell.mp3', 'assets/sfx/stab.mp3', 'assets/sfx/step.mp3', 'assets/sfx/swap.mp3', 'assets/sfx/swing.mp3', 'assets/sfx/switch.mp3', 'assets/sfx/tink.mp3', 'assets/sfx/ui.mp3',
  'assets/art/aircon.webp', 'assets/art/aircon_v.webp', 'assets/art/ambulance.webp', 'assets/art/ambulance_v.webp', 'assets/art/ammo.webp', 'assets/art/ammo_v.webp', 'assets/art/barrel.webp', 'assets/art/barrel2.webp', 'assets/art/barrel3.webp', 'assets/art/barrier.webp', 'assets/art/barrier_v.webp', 'assets/art/bed.webp', 'assets/art/bed_v.webp', 'assets/art/bench.webp', 'assets/art/bench_v.webp', 'assets/art/bookshelf.webp', 'assets/art/bookshelf_v.webp', 'assets/art/boulder.webp', 'assets/art/box.webp', 'assets/art/cabinet.webp', 'assets/art/cabinet_v.webp', 'assets/art/cart.webp', 'assets/art/cart_v.webp', 'assets/art/chair.webp', 'assets/art/chair_v.webp', 'assets/art/coffeecart.webp', 'assets/art/coffeecart_v.webp', 'assets/art/coffeetable.webp', 'assets/art/coffeetable_v.webp', 'assets/art/compressor.webp', 'assets/art/compressor_v.webp', 'assets/art/cone.webp', 'assets/art/container.webp', 'assets/art/container_v.webp', 'assets/art/covered_car.webp', 'assets/art/covered_car_v.webp', 'assets/art/crate.webp', 'assets/art/crate2.webp', 'assets/art/desk.webp', 'assets/art/desk_v.webp', 'assets/art/diningtable.webp', 'assets/art/diningtable_v.webp', 'assets/art/display.webp', 'assets/art/display_v.webp', 'assets/art/drillpress.webp', 'assets/art/drillpress_v.webp', 'assets/art/generator.webp', 'assets/art/generator_v.webp', 'assets/art/handtruck.webp', 'assets/art/handtruck_v.webp', 'assets/art/hatch.webp', 'assets/art/hatch_v.webp', 'assets/art/hydrant.webp', 'assets/art/jerrycan.webp', 'assets/art/monobloc.webp', 'assets/art/monobloc_v.webp', 'assets/art/picnic.webp', 'assets/art/picnic_v.webp', 'assets/art/plant.webp', 'assets/art/plant2.webp', 'assets/art/police.webp', 'assets/art/police_v.webp', 'assets/art/register.webp', 'assets/art/register_v.webp', 'assets/art/roundtable.webp', 'assets/art/schooldesk.webp', 'assets/art/schooldesk_v.webp', 'assets/art/sedan.webp', 'assets/art/sedan_v.webp', 'assets/art/shelf.webp', 'assets/art/shelf_v.webp', 'assets/art/sofa.webp', 'assets/art/sofa2.webp', 'assets/art/sofa2_v.webp', 'assets/art/sofa_v.webp', 'assets/art/sport.webp', 'assets/art/sport_v.webp', 'assets/art/steel1.webp', 'assets/art/steel1_v.webp', 'assets/art/steel2.webp', 'assets/art/steel2_v.webp', 'assets/art/steel3.webp', 'assets/art/steel3_v.webp', 'assets/art/stool.webp', 'assets/art/suv.webp', 'assets/art/suv_v.webp', 'assets/art/table.webp', 'assets/art/table_v.webp', 'assets/art/taxi.webp', 'assets/art/taxi_v.webp', 'assets/art/toolchest.webp', 'assets/art/toolchest_v.webp', 'assets/art/trash.webp', 'assets/art/tyre.webp', 'assets/art/utilbox.webp', 'assets/art/utilbox_v.webp', 'assets/art/van.webp', 'assets/art/van_v.webp', 'assets/art/wetsign.webp',
  'assets/tex/antiskid.webp', 'assets/tex/asphalt.webp', 'assets/tex/block.webp', 'assets/tex/brick.webp', 'assets/tex/carpet.webp', 'assets/tex/concrete.webp', 'assets/tex/concrete2.webp', 'assets/tex/gravel.webp', 'assets/tex/greytiles.webp', 'assets/tex/metal.webp', 'assets/tex/paint.webp', 'assets/tex/parquet.webp', 'assets/tex/planks.webp', 'assets/tex/plaster.webp', 'assets/tex/rubber.webp', 'assets/tex/tiles.webp', 'assets/tex/wood.webp',
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
