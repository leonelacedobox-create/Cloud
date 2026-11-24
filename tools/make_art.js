#!/usr/bin/env node
/* Convierte modelos 3D libres en dibujos vistos desde arriba para el juego (0.9.8).
 *
 * Fuentes (ver CREDITOS.md):
 *   - Poly Haven (CC0): modelos glTF de muebles, cajones, barriles, estanterías, máquinas, plantas…
 *   - Kenney Car Kit (CC0, bajado de OpenGameArt): autos.
 *   - Poly Haven (CC0): texturas de pisos y paredes (fotos reales).
 *   - Ultimate Gun Pack de Quaternius (CC0, bajado de OpenGameArt): armas, dibujadas de perfil.
 *
 * Cada modelo se carga en un navegador sin ventana con three.js, se lo apoya en el piso con un sol desde
 * arriba a la izquierda (la sombra cae siempre hacia abajo a la derecha, igual que en el juego) y se le
 * saca una "foto" ortográfica desde arriba, en dos orientaciones (horizontal y vertical) para que la sombra
 * quede bien en las dos. Sale un WebP liviano por dibujo y js/artdata.js con los tamaños.
 *
 * Uso: node tools/make_art.js <carpeta-servida> <url-base>
 *   La carpeta servida (por http) tiene: render/render.html (copia de tools/art/render.html, + three@0.160 en node_modules), models/<id>/*.gltf,
 *   carkit/x/Models/GLB format/*.glb y tex/*.jpg.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const [DL, BASE] = process.argv.slice(2);
const OUT = path.join(ROOT, 'assets', 'art'), TEX = path.join(ROOT, 'assets', 'tex');
const PXM = 72;                                  // píxeles por metro (1 casillero del juego = 1 metro)

// clave: [origen, largo mayor en metros, ¿se rota? , altura de cobertura: 'low' (se dispara por encima) | 'high' (tapa) | 'deco' (no estorba)]
const PH = (id) => `models/${id}`;
const CAR = (id) => `carkit/x/Models/GLB format/${id}.glb`;
const ITEMS = {
  desk: [PH('metal_office_desk'), 1.9, true, 'low'], schooldesk: [PH('SchoolDesk_01'), 1.0, true, 'low'],
  chair: [PH('modern_arm_chair_01'), 0.75, true, 'deco'], sofa: [PH('Sofa_01'), 2.0, true, 'low'], sofa2: [PH('sofa_02'), 2.0, true, 'low'],
  plant: [PH('potted_plant_01'), 0.85, false, 'deco'], plant2: [PH('potted_plant_02'), 0.7, false, 'deco'],
  coffeetable: [PH('CoffeeTable_01'), 1.2, true, 'low'], wetsign: [PH('WetFloorSign_01'), 0.5, false, 'deco'], coffeecart: [PH('CoffeeCart_01'), 1.4, true, 'low'],
  cabinet: [PH('drawer_cabinet'), 0.9, true, 'low'], bookshelf: [PH('wooden_bookshelf_worn'), 1.9, true, 'high'], shelf: [PH('Shelf_01'), 1.9, true, 'high'],
  steel1: [PH('steel_frame_shelves_01'), 1.9, true, 'high'], steel2: [PH('steel_frame_shelves_02'), 1.9, true, 'high'], steel3: [PH('steel_frame_shelves_03'), 1.9, true, 'high'],
  display: [PH('wooden_display_shelves_01'), 1.9, true, 'high'], register: [PH('CashRegister_01'), 0.55, true, 'deco'],
  box: [PH('cardboard_box_01'), 0.6, false, 'deco'], trash: [PH('metal_trash_can'), 0.6, false, 'deco'],
  crate: [PH('wooden_crate_01'), 0.92, false, 'low'], crate2: [PH('wooden_crate_02'), 0.92, false, 'low'],
  barrel: [PH('Barrel_01'), 0.78, false, 'low'], barrel2: [PH('Barrel_02'), 0.78, false, 'low'], barrel3: [PH('barrel_03'), 0.78, false, 'low'],
  ammo: [PH('ammo_box'), 0.6, true, 'deco'], toolchest: [PH('metal_tool_chest'), 0.95, true, 'low'], container: [PH('industrial_pastic_container'), 1.0, true, 'low'], jerrycan: [PH('metal_jerrycan'), 0.45, false, 'deco'],
  covered_car: [PH('covered_car'), 4.3, true, 'low'], barrier: [PH('concrete_road_barrier'), 1.9, true, 'low'], hydrant: [PH('fire_hydrant'), 0.45, false, 'deco'],
  aircon: [PH('exterior_aircon_unit'), 0.95, true, 'low'], utilbox: [PH('utility_box_01'), 0.8, true, 'low'], tyre: [PH('old_tyre'), 0.7, false, 'deco'],
  bench: [PH('modular_street_seating'), 1.9, true, 'low'], picnic: [PH('wooden_picnic_table'), 1.9, true, 'low'], monobloc: [PH('plastic_monobloc_chair_01'), 0.55, true, 'deco'],
  drillpress: [PH('drill_press_01'), 0.9, true, 'low'], cart: [PH('industrial_storage_cart'), 1.0, true, 'low'], handtruck: [PH('hand_truck'), 0.7, true, 'deco'],
  compressor: [PH('old_military_compressor'), 1.5, true, 'low'], generator: [PH('portable_generator'), 0.9, true, 'low'],
  diningtable: [PH('dining_table'), 1.9, true, 'low'], table: [PH('WoodenTable_01'), 1.4, true, 'low'], roundtable: [PH('round_wooden_table_01'), 1.0, false, 'low'], stool: [PH('metal_stool_01'), 0.4, false, 'deco'],
  bed: [PH('old_bed_frame'), 1.9, true, 'low'], boulder: [PH('boulder_01'), 1.4, false, 'low'],
  sedan: [CAR('sedan'), 4.3, true, 'low'], suv: [CAR('suv'), 4.5, true, 'low'], taxi: [CAR('taxi'), 4.3, true, 'low'], police: [CAR('police'), 4.4, true, 'low'],
  van: [CAR('delivery'), 5.0, true, 'low'], hatch: [CAR('hatchback-sports'), 4.0, true, 'low'], sport: [CAR('sedan-sports'), 4.3, true, 'low'], ambulance: [CAR('ambulance'), 5.2, true, 'low'],
  cone: [CAR('cone'), 0.4, false, 'deco'],
};
// armas (Ultimate Gun Pack de Quaternius, CC0, bajado de OpenGameArt): de perfil, con su largo real en metros
const QG = (id) => `guns/x/Ultimate Gun Pack - July 2019/OBJ/${id}`;
const GUNS = { pistol: [QG('Pistol_1'), 0.21], revolver: [QG('Revolver_1'), 0.27], smg: [QG('SubmachineGun_2'), 0.5], rifle: [QG('AssaultRifle_1'), 0.88],
  lmg: [QG('AssaultRifle2_2'), 0.95], hmg: [QG('Bullpup_1'), 1.05], sniper: [QG('SniperRifle_1'), 1.2], shotgun: [QG('Shotgun_1'), 1.05], ashotgun: [QG('Shotgun_ShortStock'), 0.82] };
// texturas: clave -> archivo de Poly Haven (foto real del material)
const TEXTURES = { wood: 'laminate_floor', parquet: 'herringbone_parquet', planks: 'wood_floor', tiles: 'floor_tiles_06', greytiles: 'grey_tiles', carpet: 'dirty_carpet',
  concrete: 'concrete_floor_02', concrete2: 'concrete_floor_worn_001', asphalt: 'asphalt_02', metal: 'metal_plate', gravel: 'gravel_floor', antiskid: 'anti_skid_tiles', rubber: 'rubber_tiles',
  plaster: 'plastered_wall', brick: 'brick_wall_02', block: 'concrete_block_wall', paint: 'painted_plaster_wall' };

(async () => {
  fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(TEX, { recursive: true });
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('error de página', e.message));
  await p.goto(`${BASE}/render/render.html`); await p.waitForFunction(() => window.ready, null, { timeout: 30000 });
  const meta = {};
  for (const [key, [src, len, rot, kind]] of Object.entries(ITEMS)) {
    let file = src;
    if (!src.endsWith('.glb')) { const f = fs.readdirSync(path.join(DL, src)).find((x) => x.endsWith('.gltf')); file = `${src}/${f}`; }
    const outs = {};
    for (const r of rot ? [0, 1] : [0]) {
      const res = await p.evaluate(async ([u, len, r, pxm]) => window.renderModel(u, { pxm, rotY: r * Math.PI / 2, targetLen: len }), [`${BASE}/${file}`, len, r, PXM]);
      const png = path.join(OUT, `${key}${r ? '_v' : ''}.png`);
      fs.writeFileSync(png, Buffer.from(res.png.split(',')[1], 'base64'));
      outs[r ? 'v' : 'h'] = { w: +res.w.toFixed(3), d: +res.d.toFixed(3), sx: +res.sx.toFixed(3), sz: +res.sz.toFixed(3), h: +res.h.toFixed(3) };
    }
    meta[key] = { kind, ...outs };
    process.stdout.write(`${key} `);
  }
  const gunMeta = {};
  for (const [key, [src, len]] of Object.entries(GUNS)) {
    const u = (f) => `${BASE}/${src.split('/').map(encodeURIComponent).join('/')}.${f}`;
    const res = await p.evaluate(async ([o, m, len]) => window.renderSide(o, m, { pxm: 300, targetLen: len }), [u('obj'), u('mtl'), len]);
    fs.writeFileSync(path.join(OUT, `gun_${key}.png`), Buffer.from(res.png.split(',')[1], 'base64'));
    gunMeta[key] = { w: +res.w.toFixed(3), h: +res.h.toFixed(3), len: +res.len.toFixed(3) };
    process.stdout.write(`gun_${key} `);
  }
  await b.close();
  // PNG -> WebP (con transparencia) y texturas a 256 px
  execFileSync('python3', ['-I', '-c', `
import os, sys
from PIL import Image
out, tex, dl = sys.argv[1], sys.argv[2], sys.argv[3]
for f in os.listdir(out):
    if f.endswith('.png'):
        im = Image.open(os.path.join(out, f)).convert('RGBA')
        bb = im.getbbox()
        im.save(os.path.join(out, f[:-4] + '.webp'), 'WEBP', quality=82, method=6)
        os.remove(os.path.join(out, f))
import json
T = json.loads(sys.argv[4])
for k, src in T.items():
    im = Image.open(os.path.join(dl, 'tex', src + '.jpg')).convert('RGB').resize((256, 256), Image.LANCZOS)
    im.save(os.path.join(tex, k + '.webp'), 'WEBP', quality=80, method=6)
`, OUT, TEX, DL, JSON.stringify(TEXTURES)]);
  const js = `/* Generado por tools/make_art.js (0.9.8): tamaños (en metros = casilleros) de los dibujos de assets/art.
   h = horizontal, v = girado 90°; w/d = tamaño de la imagen (con sombra), sx/sz = tamaño del objeto. */
'use strict';
App.ARTMETA = ${JSON.stringify(meta)};
App.TEXLIST = ${JSON.stringify(Object.keys(TEXTURES))};
App.GUNMETA = ${JSON.stringify(gunMeta)};
`;
  fs.writeFileSync(path.join(ROOT, 'js', 'artdata.js'), js);
  let tot = 0; for (const d of [OUT, TEX]) for (const f of fs.readdirSync(d)) tot += fs.statSync(path.join(d, f)).size;
  console.log(`\nlisto: ${Object.keys(ITEMS).length} objetos, ${Object.keys(TEXTURES).length} texturas, ${(tot / 1024).toFixed(0)} KB`);
})();
