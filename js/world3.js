/* Mundo de verdad (0.9.8): pisos y paredes con texturas fotográficas (Poly Haven, CC0), sombras de las paredes
   y rincones más oscuros, y muebles y objetos de verdad (modelos 3D de Poly Haven y autos del Car Kit de Kenney,
   CC0, convertidos en dibujos vistos desde arriba con tools/make_art.js). Cada mapa se amuebla según lo que es:
   escritorios y sillas en la oficina, góndolas en el súper, autos en el estacionamiento, estanterías en el depósito…
   Los muebles bajos (escritorios, autos, sillones) frenan balas pero se puede disparar por encima estando pegado;
   los altos (estanterías) tapan todo como una pared. Se carga después de polish.js. */
'use strict';

App.Art3 = (() => {
  const META = App.ARTMETA || {}, imgs = {}, tex = {};
  let pending = 0; const cbs = [];
  const srcOf = (p) => (window.ART_INLINE && window.ART_INLINE[p]) || p;
  function load(p) {
    const im = new Image(); pending++;
    im.onload = im.onerror = () => { if (--pending === 0) { const l = cbs.splice(0); l.forEach((f) => f()); } };
    im.src = srcOf(p); return im;
  }
  for (const k in META) { imgs[k] = load(`assets/art/${k}.webp`); if (META[k].v) imgs[k + '_v'] = load(`assets/art/${k}_v.webp`); }
  for (const k of App.TEXLIST || []) tex[k] = load(`assets/tex/${k}.webp`);
  for (const k in App.GUNMETA || {}) imgs['gun_' + k] = load(`assets/art/gun_${k}.webp`);   // armas (0.9.9)
  const ok = (im) => im && im.complete && im.naturalWidth > 0;
  /** Dibuja un objeto con su centro en (cx, cy) casilleros. La imagen trae la sombra corrida abajo a la derecha. */
  const scaled = new Map();
  /** La imagen ya achicada al tamaño justo de la pantalla (dibujar sin escalar es mucho más rápido en el celular). */
  function sized(key, im, w, h) {
    const k = key + '|' + w + 'x' + h; let c = scaled.get(k); if (c) return c;
    if (scaled.size > 400) scaled.clear();
    c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h);
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, c.width, c.height);
    scaled.set(k, c); return c;
  }
  function draw(x, key, v, cx, cy, ts, alpha = 1, cache = false) {
    const m = META[key]; if (!m) return false;
    const vk = key + (v && m.v ? '_v' : ''), o = (v && m.v) || m.h, im = imgs[vk]; if (!ok(im)) return false;
    const ox = cx - o.w / 2 + o.h * 0.1, oy = cy - o.d / 2 + o.h * 0.08;
    if (alpha < 1) x.globalAlpha = alpha;
    if (cache) {                                                                 // para lo que se dibuja en cada cuadro (cajones, barriles, mesas)
      const sc = x.getTransform ? Math.hypot(x.getTransform().a, x.getTransform().b) : 1;
      x.drawImage(sized(vk, im, Math.round(o.w * ts * sc), Math.round(o.d * ts * sc)), ox * ts, oy * ts, o.w * ts, o.d * ts);
    } else x.drawImage(im, ox * ts, oy * ts, o.w * ts, o.d * ts);
    if (alpha < 1) x.globalAlpha = 1;
    return true;
  }
  /** Cuántos casilleros ocupa (ancho, alto). */
  function foot(key, v) { const m = META[key]; if (!m) return [1, 1]; const o = (v && m.v) || m.h; return [Math.max(1, Math.round(o.sx)), Math.max(1, Math.round(o.sz))]; }
  return { META, imgs, tex, draw, foot, ok, ready: () => pending === 0, onReady(f) { if (pending === 0) f(); else cbs.push(f); } };
})();

(() => {
  const E = App.battle, G = E.Game.prototype;
  const A = App.Art3;
  // materiales de cada mapa: piso, pared y cómo es por fuera
  const THEME = {
    oficina: { floor: 'wood', wall: 'plaster' }, oficina_noche: { floor: 'wood', wall: 'plaster' }, base: { floor: 'concrete', wall: 'block' },
    carcel: { floor: 'concrete2', wall: 'brick' }, deposito: { floor: 'concrete', wall: 'block' }, estacion: { floor: 'greytiles', wall: 'brick' },
    super: { floor: 'greytiles', wall: 'paint', tint: 'rgba(255,250,240,.22)' }, estacionamiento: { floor: 'asphalt', wall: 'block' }, fabrica: { floor: 'concrete2', wall: 'brick' },
    complejo: { floor: 'asphalt', wall: 'brick' }, maze: { floor: 'concrete2', wall: 'block' }, rooms: { floor: 'parquet', wall: 'plaster' },
    arena: { floor: 'asphalt', wall: 'block' }, custom: { floor: 'planks', wall: 'plaster' },
  };
  const FLOORMAT = { 1: 'carpet', 2: 'metal', 3: 'gravel', 4: 'metal', 5: 'concrete' };
  const themeOf = (g) => THEME[g.cfg.map] || THEME.custom;

  /* ================= muebles: dónde van y qué ocupan ================= */
  const initOld = G.initWorld;
  G.initWorld = function (m) {
    initOld.call(this, m);
    this.deco = []; this.furn = new Uint8Array(this.W * this.H);
    if (this.cfg.noDeco) return;
    try {
      for (const f of m.furn || []) {                                            // 1.0: los muebles que pensó el mapa (escritorio con su silla, mesa de reuniones…)
        if (f.over) { const [fw, fd] = A.foot(f.k, f.v); this.deco.push({ k: f.k, v: f.v && !!(A.META[f.k] || {}).v, x: f.x + fw / 2, y: f.y + fd / 2, tiles: [], over: true }); }
        else this.placeDeco(f.k, f.x, f.y, f.v);
      }
      this.furnish();
    } catch (e) { console.warn('muebles', e); }
  };
  /** ¿Se puede poner algo que ocupa (fw × fd) desde (tx, ty)? Piso libre, lejos de puertas y sin cortar caminos. */
  G.fits = function (tx, ty, fw, fd) {
    const W = this.W, H = this.H;
    if (tx < 1 || ty < 1 || tx + fw > W - 1 || ty + fd > H - 1) return false;
    for (let y = ty - 1; y <= ty + fd; y++) for (let x = tx - 1; x <= tx + fw; x++) {
      const i = y * W + x, inside = x >= tx && x < tx + fw && y >= ty && y < ty + fd;
      if (this.doorGrid[i]) return false;                                         // nada pegado a una puerta
      if (inside && (this.g[i] || this.pr[i] || this.furn[i] || (this.tables && this.tables.has(i)) || (this.conv && this.conv[i]) || this.dark[i])) return false;
    }
    return true;
  };
  /** Cuántos casilleros de piso se pueden recorrer (para no dejar zonas encerradas). */
  G.reachableCount = function () {
    const W = this.W, N = W * this.H, seen = new Uint8Array(N); let start = -1, total = 0;
    for (let i = 0; i < N; i++) if (!this.g[i]) { total++; if (start < 0) start = i; }
    if (start < 0) return [0, 0];
    const q = [start]; seen[start] = 1; let n = 0;
    while (q.length) { const i = q.pop(); n++; for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < N && !seen[j] && !this.g[j]) { seen[j] = 1; q.push(j); } }
    return [n, total];
  };
  /** Pone un objeto (si entra y no encierra a nadie). Devuelve true si quedó. */
  G.placeDeco = function (key, tx, ty, v) {
    const meta = A.META[key]; if (!meta) return false;
    v = !!(v && meta.v);
    const [fw, fd] = A.foot(key, v);
    if (!this.fits(tx, ty, fw, fd)) return false;
    const W = this.W, kind = meta.kind, tiles = [];
    for (let y = ty; y < ty + fd; y++) for (let x = tx; x < tx + fw; x++) tiles.push(y * W + x);
    if (kind !== 'deco') {
      for (const i of tiles) { this.g[i] = 1; if (kind === 'high') { this.wl[i] = 1; } else { this.pr[i] = 1; this.prHp[i] = 1e9; this.prKind.set(i, 'furn'); } }
      const [n, total] = this.reachableCount();
      if (n < total) {                                                         // encierra algo: se saca
        for (const i of tiles) { this.g[i] = 0; this.wl[i] = 0; this.pr[i] = 0; this.prHp[i] = 0; this.prKind.delete(i); }
        return false;
      }
      for (const i of tiles) { this.furn[i] = kind === 'high' ? 2 : 1; if (this.wallHp) this.wallHp[i] = 0; }
    } else for (const i of tiles) this.furn[i] = 3;
    this.deco.push({ k: key, v, x: tx + fw / 2, y: ty + fd / 2, tiles });
    return true;
  };
  /** Algunas ideas de cómo poner cosas: contra una pared, en el medio de un lugar abierto, en grupo. */
  G.wallSpots = function () {
    const W = this.W, H = this.H, out = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x; if (this.g[i]) continue;
      const up = this.wl[i - W], dn = this.wl[i + W], lf = this.wl[i - 1], rt = this.wl[i + 1];
      if (up || dn || lf || rt) out.push({ x, y, along: up || dn ? 'h' : 'v', side: up ? 'up' : dn ? 'down' : lf ? 'left' : 'right' });
    }
    return out;
  };
  G.openSpots = function (r = 1) {
    const W = this.W, H = this.H, out = [];
    for (let y = 1 + r; y < H - 1 - r; y++) for (let x = 1 + r; x < W - 1 - r; x++) {
      let ok = true; for (let dy = -r; dy <= r && ok; dy++) for (let dx = -r; dx <= r && ok; dx++) if (this.g[(y + dy) * W + x + dx] || this.doorGrid[(y + dy) * W + x + dx]) ok = false;
      if (ok) out.push({ x, y });
    }
    return out;
  };
  const pick = (rng, a) => a[Math.floor(rng() * a.length)];
  /** Amuebla el mapa según lo que es. */
  G.furnish = function () {
    const rng = this.srnd, map = this.cfg.map, area = this.W * this.H, k = area / 1050;
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const alongWall = (keys, n) => {                                           // contra las paredes, orientado a lo largo
      const spots = shuffle(this.wallSpots()); let c = 0;
      for (const s of spots) { if (c >= n) break; const key = pick(rng, keys), v = s.along === 'v'; const [fw, fd] = A.foot(key, v);
        const tx = s.side === 'right' ? s.x - fw + 1 : s.x, ty = s.side === 'down' ? s.y - fd + 1 : s.y;
        if (this.placeDeco(key, tx, ty, v)) c++; }
      return c;
    };
    const inOpen = (keys, n, r = 1) => {                                        // en lugares abiertos
      const spots = shuffle(this.openSpots(r)); let c = 0;
      for (const s of spots) { if (c >= n) break; const key = pick(rng, keys), v = rng() < 0.5; const [fw, fd] = A.foot(key, v);
        if (this.placeDeco(key, s.x - (fw >> 1), s.y - (fd >> 1), v)) c++; }
      return c;
    };
    const desks = (n) => {                                                      // escritorio con su silla
      const spots = shuffle(this.openSpots(1)); let c = 0;
      for (const s of spots) { if (c >= n) break; if (this.placeDeco('desk', s.x - 1, s.y, false)) { this.placeDeco(rng() < 0.7 ? 'chair' : 'monobloc', s.x, s.y + 1, false); c++; } }
    };
    const cars = (n, keys) => inOpen(keys, n, 2);
    const shelvesFromWalls = (keys) => {                                       // las paredes sueltas (góndolas, estantes) pasan a ser estanterías de verdad
      const W = this.W, H = this.H, done = new Uint8Array(W * H);
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x; if (!this.wl[i] || done[i] || !this.wallHp || !(this.wallHp[i] > 0)) continue;
        const vert = this.wl[i + W] && this.wallHp[i + W] > 0 && !this.g[i - 1] && !this.g[i + 1];
        const hor = this.wl[i + 1] && this.wallHp[i + 1] > 0 && !this.g[i - W] && !this.g[i + W];
        if (!vert && !hor) continue;
        const j = vert ? i + W : i + 1; done[i] = done[j] = 1;
        for (const t of [i, j]) { this.furn[t] = 2; this.wallHp[t] = 0; }
        this.deco.push({ k: pick(rng, keys), v: !!vert, x: x + (vert ? 0.5 : 1), y: y + (vert ? 1 : 0.5), tiles: [i, j], shelf: true });
      }
      // los pedacitos sueltos al final de una góndola: un mueble chico en vez de un cuadrado de pared
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x; if (!this.wl[i] || done[i] || !this.wallHp || !(this.wallHp[i] > 0)) continue;
        if (![i - 1, i + 1, i - W, i + W].some((j) => this.furn[j] === 2) && [i - 1, i + 1, i - W, i + W].some((j) => this.wl[j])) continue;   // pegado a una góndola, o una columna suelta
        done[i] = 1; this.furn[i] = 2; this.wallHp[i] = 0;
        this.deco.push({ k: 'cabinet', v: !!(this.furn[i - W] === 2 || this.furn[i + W] === 2), x: x + 0.5, y: y + 0.5, tiles: [i], shelf: true });
      }
    };
    switch (map) {
      case 'oficina': case 'oficina_noche':
        alongWall(['plant', 'plant2', 'trash', 'cabinet'], Math.round(6 * k));                   // el resto ya lo pone el mapa (escritorios, sala de reuniones, cocina)
        inOpen(['sofa', 'wetsign'], Math.round(2 * k), 1); break;
      case 'super':
        shelvesFromWalls(['display', 'steel3', 'steel2']); alongWall(['box', 'box', 'trash', 'plant', 'wetsign', 'cart'], Math.round(12 * k));
        inOpen(['cart', 'box', 'wetsign'], Math.round(5 * k), 1); break;
      case 'deposito':
        shelvesFromWalls(['steel1', 'steel2', 'steel3']); alongWall(['container', 'box', 'toolchest', 'handtruck', 'cart', 'jerrycan'], Math.round(14 * k));
        inOpen(['container', 'box', 'handtruck'], Math.round(4 * k), 1); break;
      case 'estacionamiento':
        cars(Math.round(9 * k), ['sedan', 'suv', 'taxi', 'hatch', 'sport', 'van', 'covered_car', 'police']);
        alongWall(['cone', 'barrier', 'trash', 'tyre', 'utilbox'], Math.round(10 * k)); inOpen(['cone', 'barrier'], Math.round(4 * k), 1); break;
      case 'complejo':
        cars(Math.round(5 * k), ['sedan', 'taxi', 'police', 'van', 'suv', 'ambulance']); alongWall(['bench', 'hydrant', 'trash', 'plant', 'aircon', 'barrier'], Math.round(14 * k));
        inOpen(['barrier', 'cone', 'picnic'], Math.round(4 * k), 1); break;
      case 'base':
        alongWall(['container', 'ammo', 'jerrycan', 'generator', 'toolchest', 'aircon'], Math.round(14 * k)); cars(Math.round(2 * k), ['covered_car', 'police']);
        inOpen(['barrier', 'container', 'compressor'], Math.round(4 * k), 1); break;
      case 'carcel':
        alongWall(['bed', 'bed', 'trash', 'toolchest', 'bench'], Math.round(14 * k)); inOpen(['diningtable', 'table', 'roundtable'], Math.round(4 * k), 1); break;
      case 'estacion':
        alongWall(['bench', 'bench', 'trash', 'plant', 'plant2', 'utilbox'], Math.round(14 * k)); inOpen(['bench', 'wetsign', 'box'], Math.round(3 * k), 1); break;
      case 'fabrica':
        alongWall(['drillpress', 'compressor', 'toolchest', 'cart', 'generator', 'container', 'jerrycan'], Math.round(14 * k)); inOpen(['cart', 'handtruck', 'container'], Math.round(4 * k), 1); break;
      case 'rooms':
        alongWall(['bookshelf', 'cabinet', 'plant', 'sofa', 'plant2', 'trash'], Math.round(12 * k)); inOpen(['table', 'roundtable', 'diningtable', 'coffeetable'], Math.round(5 * k), 1); break;
      case 'maze':
        alongWall(['box', 'trash', 'tyre', 'jerrycan', 'cone', 'utilbox'], Math.round(12 * k)); break;
      case 'arena':
        inOpen(['barrier', 'barrier', 'boulder', 'covered_car', 'tyre', 'container'], Math.round(7 * k), 1); alongWall(['tyre', 'cone', 'trash'], Math.round(6 * k)); break;
      default: break;                                                            // los mapas propios quedan como los dibujó cada uno
    }
  };

  /* ================= el mapa fijo con texturas ================= */
  const staticOld = G.buildStatic;
  G.buildStatic = function () {
    if (!A.ready() || this.cfg.plainArt) {                                      // todavía cargando: el dibujo de antes, y después se rehace
      staticOld.call(this);
      if (!A.ready() && !this._artWait) { this._artWait = true; A.onReady(() => { if (!this.dead && this.static) { this.buildStatic(); this.buildMini(); } }); }
      return;
    }
    const ts = this.ts, dpr = Math.min(2, this.dpr), W = this.W, H = this.H, wl = this.wl, th = themeOf(this);
    this.sdpr = dpr;
    const c = document.createElement('canvas');
    c.width = Math.ceil(W * ts * dpr); c.height = Math.ceil(H * ts * dpr);
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    const pat = (key, tiles) => {
      const im = A.tex[key]; if (!A.ok(im)) return '#2a3350';
      const p = x.createPattern(im, 'repeat');
      if (p && p.setTransform && typeof DOMMatrix !== 'undefined') p.setTransform(new DOMMatrix().scale(tiles * ts / im.naturalWidth));
      return p;
    };
    const isWallDraw = (i) => wl[i] && this.furn[i] !== 2;                    // las estanterías no se pintan como pared
    // 1) pisos: un trazo por material
    const groups = {};
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const i = y * W + xx; if (isWallDraw(i)) continue;
      const mat = FLOORMAT[this.floorT[i]] || th.floor;
      (groups[mat] || (groups[mat] = [])).push(xx, y);
    }
    for (const mat in groups) {
      x.fillStyle = pat(mat, mat === 'carpet' ? 1.5 : mat === 'tiles' || mat === 'greytiles' ? 1.4 : 2.5);
      x.beginPath(); const a = groups[mat]; for (let k = 0; k < a.length; k += 2) x.rect(a[k] * ts, a[k + 1] * ts, ts + 0.6, ts + 0.6); x.fill();
      if (mat === 'carpet') { x.fillStyle = 'rgba(70,95,150,.32)'; x.fill(); x.fillStyle = 'rgba(255,255,255,.06)'; x.fill(); }   // alfombra de oficina, gris azulada
    }
    x.fillStyle = th.tint || 'rgba(8,10,20,.1)'; x.fillRect(0, 0, W * ts, H * ts);         // un poco más oscuro, para que resalten los soldados
    // 2) rincones y sombra de las paredes (el sol viene de arriba a la izquierda)
    const shade = (px, py, w, h, x0, y0, x1, y1, a) => { const gr = x.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(px, py, w, h); };
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const i = y * W + xx; if (isWallDraw(i)) continue;
      const px = xx * ts, py = y * ts, s = ts * 0.42;
      if (y > 0 && isWallDraw(i - W)) shade(px, py, ts, s, 0, py, 0, py + s, 0.5);
      if (xx > 0 && isWallDraw(i - 1)) shade(px, py, s, ts, px, 0, px + s, 0, 0.45);
      if (y < H - 1 && isWallDraw(i + W)) shade(px, py + ts - s * 0.5, ts, s * 0.5, 0, py + ts, 0, py + ts - s * 0.5, 0.22);
      if (xx < W - 1 && isWallDraw(i + 1)) shade(px + ts - s * 0.5, py, s * 0.5, ts, px + ts, 0, px + ts - s * 0.5, 0, 0.2);
    }
    // 3) muebles y objetos (quedan en el dibujo fijo: no cuestan nada por cuadro)
    for (const d of this.deco) A.draw(x, d.k, d.v, d.x, d.y, ts);
    // 4) paredes: textura, borde iluminado arriba/izquierda y sombreado abajo/derecha
    x.fillStyle = pat(th.wall, 1.6); x.beginPath();
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) if (isWallDraw(y * W + xx)) x.rect(xx * ts, y * ts, ts + 0.6, ts + 0.6);
    x.fill();
    x.fillStyle = 'rgba(20,24,40,.25)'; x.fill();
    const e = Math.max(1.5, ts * 0.09);
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const i = y * W + xx; if (!isWallDraw(i)) continue;
      const px = xx * ts, py = y * ts;
      const open = (dx, dy) => { const nx = xx + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < W && ny < H && !isWallDraw(ny * W + nx); };
      x.fillStyle = 'rgba(255,255,255,.22)';
      if (open(0, -1)) x.fillRect(px, py, ts, e);
      if (open(-1, 0)) x.fillRect(px, py, e, ts);
      x.fillStyle = 'rgba(0,0,0,.42)';
      if (open(0, 1)) x.fillRect(px, py + ts - e, ts, e);
      if (open(1, 0)) x.fillRect(px + ts - e, py, e, ts);
    }
    // 5) vidrios/barrotes y carteles de los cuartos (como antes)
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const i = y * W + xx; if (this.pr[i] !== 3) continue;
      const px = xx * ts, py = y * ts;
      x.fillStyle = 'rgba(150,210,255,.35)'; x.fillRect(px, py, ts + 0.5, ts + 0.5);
      x.strokeStyle = '#8a9bb8'; x.lineWidth = Math.max(1.5, ts * 0.09); x.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
      x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = Math.max(1, ts * 0.05); x.beginPath(); x.moveTo(px + ts * 0.2, py + ts * 0.8); x.lineTo(px + ts * 0.5, py + ts * 0.2); x.stroke();
    }
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `800 ${Math.max(8, ts * 0.42)}px system-ui, sans-serif`;
    for (const l of this.labels) { x.fillStyle = 'rgba(255,255,255,.22)'; x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; x.strokeText(l.text, l.x * ts, l.y * ts); x.fillText(l.text, l.x * ts, l.y * ts); }
    this.static = c;
  };

  /* ================= cajones, barriles y mesas con su dibujo de verdad ================= */
  const VAR = { 1: ['crate', 'crate2'], 2: ['barrel', 'barrel2', 'barrel3'] };
  const drawOld = G.drawWorld;
  G.drawWorld = function (x, ts, left, top, vw, vh) {
    if (!A.ready() || this.cfg.plainArt) return drawOld.call(this, x, ts, left, top, vw, vh);
    // los cajones y barriles comunes se dibujan acá; el resto (vidrios rotos, escudos, quemaduras…) con lo de antes
    const W = this.W, pr = this.pr, saved = [];
    const x0 = Math.max(0, Math.floor(left)), y0 = Math.max(0, Math.floor(top)), x1 = Math.min(W - 1, Math.ceil(left + vw)), y1 = Math.min(this.H - 1, Math.ceil(top + vh));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const i = ty * W + tx, p = pr[i];
      if ((p === 1 || p === 2) && !(this.prKind && this.prKind.get(i))) { saved.push(i, p); pr[i] = 0; }
      else if (p === 1 && this.prKind && this.prKind.get(i) === 'furn') { saved.push(i, p); pr[i] = 0; }   // los muebles ya están en el dibujo fijo
    }
    try { drawOld.call(this, x, ts, left, top, vw, vh); } finally { for (let k = 0; k < saved.length; k += 2) pr[saved[k]] = saved[k + 1]; }
    for (let k = 0; k < saved.length; k += 2) {
      const i = saved[k], p = saved[k + 1]; if (this.prKind && this.prKind.get(i) === 'furn') continue;
      const tx = i % W, ty = (i / W) | 0, v = VAR[p], key = v[(tx * 7 + ty * 13) % v.length];
      const sl = this.slides && this.slides.get(i), sk = sl ? 1 - Math.min(1, sl.t / 0.25) : 0;
      A.draw(x, key, false, tx + 0.5 - (sl ? sl.dx * sk : 0), ty + 0.5 - (sl ? sl.dy * sk : 0), ts, 1, true);
      const hp = this.prHp[i], max = p === 2 ? 55 : 110;
      if (hp < max * 0.6) { x.strokeStyle = 'rgba(30,15,5,.7)'; x.lineWidth = Math.max(1, ts * 0.05); x.beginPath(); x.moveTo((tx + 0.25) * ts, (ty + 0.3) * ts); x.lineTo((tx + 0.5) * ts, (ty + 0.55) * ts); x.lineTo((tx + 0.7) * ts, (ty + 0.45) * ts); x.stroke(); }   // rajado
    }
  };
})();

/* ----- charcos con la lluvia (0.9.9): se van formando y las gotas hacen ondas ----- */
(() => {
  const G = App.battle.Game.prototype, TAU = Math.PI * 2;
  const w2 = G.drawWorld2;
  G.drawWorld2 = function (x, ts, left, top, right, bottom) {
    w2.call(this, x, ts, left, top, right, bottom);
    const wet = this.weather === 'rain' || this.weather === 'storm';
    if (!wet || this.quality === 'ahorro') return;
    if (!this.puddles) {
      const rng = this.srnd, W = this.W, out = [];
      for (let k = 0; k < 400 && out.length < Math.round(this.floor.length / 28); k++) {
        const i = this.floor[Math.floor(rng() * this.floor.length)];
        if (this.furn && this.furn[i]) continue;
        out.push({ x: (i % W) + 0.2 + rng() * 0.6, y: ((i / W) | 0) + 0.2 + rng() * 0.6, rx: 0.35 + rng() * 0.8, ry: 0.25 + rng() * 0.5, a: rng() * Math.PI, seed: rng() * 10 });
      }
      this.puddles = out; this.puddleT = 0;
    }
    this.puddleT = Math.min(1, (this.puddleT || 0) + 0.002);                      // van creciendo con la lluvia
    const grow = this.puddleT, t = this.time;
    for (const p of this.puddles) {
      if (p.x + p.rx < left || p.y + p.rx < top || p.x - p.rx > right || p.y - p.rx > bottom) continue;
      x.save(); x.translate(p.x * ts, p.y * ts); x.rotate(p.a);
      x.fillStyle = `rgba(95,120,150,${0.32 * grow})`; x.beginPath(); x.ellipse(0, 0, p.rx * ts * grow, p.ry * ts * grow, 0, 0, TAU); x.fill();
      x.strokeStyle = `rgba(200,220,240,${0.22 * grow})`; x.lineWidth = Math.max(1, ts * 0.03); x.stroke();
      const ph = (t * 1.3 + p.seed) % 1;                                          // una gota cae y hace una onda
      x.strokeStyle = `rgba(220,235,255,${0.45 * (1 - ph) * grow})`; x.beginPath(); x.ellipse(Math.sin(p.seed) * p.rx * ts * 0.4, 0, ph * ts * 0.35, ph * ts * 0.22, 0, 0, TAU); x.stroke();
      x.restore();
    }
  };
})();
