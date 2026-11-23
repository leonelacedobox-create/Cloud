/* Batalla en el laberinto: soldados autónomos con vista, oído, puertas, armas y tácticas distintas. */
'use strict';

(() => {
  const { state, $, $$, el, rnd, rint, shuffle, pname, sfx, vibrate, bindSeg, save, PALETTE, TEAMS } = App;
  const B = state.battle;
  const STEP = 1 / 60;
  const HPL = 100;                        // puntos de vida de cada "vida"

  /* ================= armas ================= */
  // dmg: daño por bala (x pellets) · cd: segundos entre disparos · mag/res: cargador y reserva
  // pref: distancia (en casilleros) a la que rinde mejor · tier: qué tan buena es en general
  const WEAPONS = {
    pistol:   { name: 'Pistola', short: 'PIS', dmg: 22, pellets: 1, cd: 0.5, mag: 12, res: 24, reload: 1.4, bspeed: 12, spread: 0.05, range: 9, noise: 11, move: 1.0, auto: false, tier: 2, pref: [2.5, 6.5] },
    sniper:   { name: 'Sniper', short: 'SNI', dmg: 95, pellets: 1, cd: 1.6, mag: 5, res: 10, reload: 2.8, bspeed: 26, spread: 0.008, range: 24, noise: 18, move: 0.9, auto: false, tier: 6, pref: [7, 20], scope: 8 },
    lmg:      { name: 'Ametralladora ligera', short: 'AML', dmg: 11, pellets: 1, cd: 0.11, mag: 30, res: 60, reload: 2.1, bspeed: 15, spread: 0.09, range: 11, noise: 14, move: 0.97, auto: true, tier: 5, pref: [3, 8] },
    shotgun:  { name: 'Escopeta', short: 'ESC', dmg: 9, pellets: 8, cd: 0.95, mag: 6, res: 12, reload: 2.6, bspeed: 12, spread: 0.2, range: 5.5, noise: 15, move: 0.95, auto: false, tier: 4, pref: [1.2, 3.8] },
    ashotgun: { name: 'Escopeta automática', short: 'EAU', dmg: 7, pellets: 6, cd: 0.38, mag: 8, res: 16, reload: 3.0, bspeed: 12, spread: 0.24, range: 5.2, noise: 15, move: 0.93, auto: true, tier: 5, pref: [1.2, 4] },
    hmg:      { name: 'Ametralladora pesada', short: 'AMP', dmg: 15, pellets: 1, cd: 0.09, mag: 80, res: 120, reload: 4.2, bspeed: 15, spread: 0.13, range: 12, noise: 17, move: 0.78, auto: true, tier: 7, pref: [4, 9.5] },
    smg:      { name: 'Subfusil', short: 'SUB', dmg: 8, pellets: 1, cd: 0.07, mag: 32, res: 64, reload: 1.8, bspeed: 14, spread: 0.11, range: 8, noise: 13, move: 1.03, auto: true, tier: 4, pref: [1.8, 5] },
    rifle:    { name: 'Rifle de asalto', short: 'RIF', dmg: 18, pellets: 1, cd: 0.14, mag: 30, res: 60, reload: 2.2, bspeed: 18, spread: 0.06, range: 14, noise: 15, move: 0.96, auto: true, tier: 6, pref: [4, 11] },
    revolver: { name: 'Revólver', short: 'REV', dmg: 55, pellets: 1, cd: 0.75, mag: 6, res: 12, reload: 2.4, bspeed: 16, spread: 0.03, range: 11, noise: 14, move: 1.0, auto: false, tier: 4, pref: [3, 9] },
    crossbow: { name: 'Ballesta silenciosa', short: 'BAL', dmg: 80, pellets: 1, cd: 1.4, mag: 1, res: 8, reload: 1.6, bspeed: 20, spread: 0.02, range: 16, noise: 2.5, move: 1.0, auto: false, tier: 5, pref: [5, 13] },
  };
  const KNIFE = { name: 'Cuchillo', short: 'CUC', dmg: 55, cd: 0.55, range: 1.2, noise: 2.5, move: 1.12, pref: [0, 0.9] };
  const LOOT_WEIGHTS = [['shotgun', 14], ['ashotgun', 8], ['lmg', 12], ['sniper', 10], ['hmg', 5], ['smg', 14], ['rifle', 10], ['revolver', 10], ['crossbow', 7]];
  const MED = { small: { amt: 35, dur: 1.8 }, med: { amt: 65, dur: 2.8 }, large: { amt: 100, dur: 4 } };
  const magOf = (w) => Math.round(WEAPONS[w.type].mag * (w.ext ? 1.5 : 1));                 // el cargador extendido da 50% más
  // máximo de balas que se pueden llevar (con mochila, 50% más)
  const cap = (def, w, s) => (def.mag * (w && w.ext ? 1.5 : 1) + def.res * 2) * (s && s.pack ? 1.5 : 1);

  /* personalidades, niveles de inteligencia y frases: ver js/personas.js */
  const PERS = Personas.PERS, pickLine = Personas.pickLine;
  const SIZES = { s: [9, 13], m: [13, 19], l: [17, 25] };   // celdas (columnas, filas) en pantalla vertical
  const FOV = 2.3;                                          // campo de visión (radianes, ~130°)
  const PU_COLOR = { shield: '#38bdf8', speed: '#facc15', heal: '#f472b6' };
  const PU_NAME = { shield: 'escudo', speed: 'velocidad', heal: 'vida extra' };
  const RING_COLOR = { shot: '#ffd166', shout: '#ff6b6b', door: '#c9955a', boom: '#ff9f43' };

  /* ================= generación de mapas ================= */
  function genMap(type, cols, rows, rng) {
    const rnd = rng || App.rnd;
    const rint = (n) => Math.floor(rnd() * n);
    const shuffle = (arr) => seededShuffle(arr, rnd);
    const W = cols * 2 + 1, H = rows * 2 + 1;
    const g = new Uint8Array(W * H).fill(1);
    const at = (x, y) => y * W + x;
    const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    if (type === 'maze') {
      const seen = new Uint8Array(cols * rows);
      const sx = rint(cols), sy = rint(rows);
      seen[sy * cols + sx] = 1; g[at(sx * 2 + 1, sy * 2 + 1)] = 0;
      const stack = [[sx, sy]];
      while (stack.length) {
        const [cx, cy] = stack[stack.length - 1];
        const nb = D4.map(([dx, dy]) => [cx + dx, cy + dy, dx, dy])
          .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen[ny * cols + nx]);
        if (!nb.length) { stack.pop(); continue; }
        const [nx, ny, dx, dy] = nb[rint(nb.length)];
        seen[ny * cols + nx] = 1;
        g[at(cx * 2 + 1 + dx, cy * 2 + 1 + dy)] = 0;
        g[at(nx * 2 + 1, ny * 2 + 1)] = 0;
        stack.push([nx, ny]);
      }
      // "trenzar": abrir paredes para que haya vueltas y no solo pasillos sin salida
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        if (g[at(x, y)] !== 1) continue;
        const v = x % 2 === 1 && y % 2 === 0 && !g[at(x, y - 1)] && !g[at(x, y + 1)];
        const h = x % 2 === 0 && y % 2 === 1 && !g[at(x - 1, y)] && !g[at(x + 1, y)];
        if ((v || h) && rnd() < 0.22) g[at(x, y)] = 0;
      }
      // salas abiertas de 3x3
      if (cols >= 4 && rows >= 4) {
        const n = Math.max(1, Math.round((cols * rows) / 18));
        for (let k = 0; k < n; k++) {
          const cx = 2 * (1 + rint(cols - 2)) + 1, cy = 2 * (1 + rint(rows - 2)) + 1;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) g[at(cx + dx, cy + dy)] = 0;
        }
      }
    } else if (type === 'rooms') {
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) g[at(x, y)] = 0;
      const divide = (x0, y0, x1, y1, depth) => {
        const w = x1 - x0 + 1, h = y1 - y0 + 1;
        if ((w < 7 && h < 7) || (depth > 0 && rnd() < 0.08)) return;
        let horiz = h > w ? true : w > h ? false : rnd() < 0.5;
        if (horiz && h < 7) horiz = false; else if (!horiz && w < 7) horiz = true;
        if (horiz) {
          const opts = []; for (let y = y0 + 2; y <= y1 - 2; y++) if (y % 2 === 0) opts.push(y);
          const wy = opts[rint(opts.length)];
          for (let x = x0; x <= x1; x++) g[at(x, wy)] = 1;
          const odd = []; for (let x = x0; x <= x1; x++) if (x % 2 === 1) odd.push(x);
          shuffle(odd).slice(0, w >= 9 ? 2 : 1).forEach((x) => { g[at(x, wy)] = 0; });
          divide(x0, y0, x1, wy - 1, depth + 1); divide(x0, wy + 1, x1, y1, depth + 1);
        } else {
          const opts = []; for (let x = x0 + 2; x <= x1 - 2; x++) if (x % 2 === 0) opts.push(x);
          const wx = opts[rint(opts.length)];
          for (let y = y0; y <= y1; y++) g[at(wx, y)] = 1;
          const odd = []; for (let y = y0; y <= y1; y++) if (y % 2 === 1) odd.push(y);
          shuffle(odd).slice(0, h >= 9 ? 2 : 1).forEach((y) => { g[at(wx, y)] = 0; });
          divide(x0, y0, wx - 1, y1, depth + 1); divide(wx + 1, y0, x1, y1, depth + 1);
        }
      };
      divide(1, 1, W - 2, H - 2, 0);
    } else { // arena con columnas y muros de cobertura, simétrica
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) g[at(x, y)] = 0;
      const n = Math.round((W * H) / 38);
      const put = (x, y) => {
        [[x, y], [W - 1 - x, y], [x, H - 1 - y], [W - 1 - x, H - 1 - y]].forEach(([a, b]) => {
          if (a > 1 && b > 1 && a < W - 2 && b < H - 2) g[at(a, b)] = 1;
        });
      };
      for (let i = 0; i < n; i++) {
        const len = 1 + rint(3), horiz = rnd() < 0.5;
        const x = 3 + rint(Math.max(1, (W >> 1) - 4)), y = 3 + rint(Math.max(1, (H >> 1) - 4));
        for (let k = 0; k < len; k++) put(x + (horiz ? k : 0), y + (horiz ? 0 : k));
      }
    }

    // Todo lo que no se pueda alcanzar se convierte en pared
    let sx = W >> 1, sy = H >> 1, best = 1e9;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (!g[at(x, y)]) { const d = (x - W / 2) ** 2 + (y - H / 2) ** 2; if (d < best) { best = d; sx = x; sy = y; } }
    }
    const reach = new Uint8Array(W * H); const q = [at(sx, sy)]; reach[q[0]] = 1;
    for (let i = 0; i < q.length; i++) {
      const cx = q[i] % W, cy = (q[i] / W) | 0;
      D4.forEach(([dx, dy]) => { const nx = cx + dx, ny = cy + dy, k = at(nx, ny); if (!g[k] && !reach[k]) { reach[k] = 1; q.push(k); } });
    }
    for (let i = 0; i < g.length; i++) if (!g[i] && !reach[i]) g[i] = 1;
    return { W, H, g, center: [sx, sy] };
  }

  /* ================= utilidades ================= */
  const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clamp01 = (v) => clamp(v, 0, 1);
  const lighten = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.round(v + (255 - v) * k);
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  };
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
  const doorClosed = (d) => !d.open || d.anim < 0.6;
  const ammoOf = (w) => (w ? w.mag + w.res : 0);
  const fitRange = (def, d) => {        // qué tan bien rinde un arma a la distancia d (0..1)
    const [a, b] = def.pref;
    if (d < a) return Math.max(0.2, 1 - (a - d) * 0.3);
    if (d > b) return Math.max(0.15, 1 - (d - b) * 0.1);
    return 1;
  };

  /* ----- semilla: mismo número = mismo mapa, puertas, botín y punto de partida ----- */
  function hashSeed(str) {
    let h = 2166136261;
    for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seededShuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ================= la partida ================= */
  class Game {
    constructor(canvas, cfg, hooks) {
      this.cv = canvas; this.ctx = canvas.getContext('2d');
      this.cfg = cfg; this.hooks = hooks;
      this.phase = 'countdown'; this.cdT = 3.4; this.lastBeep = 4;
      this.paused = false; this.speed = B.speed || 1;
      this.time = 0; this.acc = 0; this.last = 0; this.raf = 0;
      this.bullets = []; this.parts = []; this.items = []; this.corpses = []; this.rings = [];
      this.itemId = 1; this.lootTimer = 14;
      this.endT = 0; this.deaths = 0; this.winners = []; this.zone = null;
      this.pov = false; this.stuckEvents = 0; this.ctl = { mx: 0, my: 0, fire: false, sneak: false }; this.padOn = false;
      this.camMode = 'auto'; this.followId = null; this.focus = null; this.focusUntil = 0; this.camX = 0; this.camY = 0;

      const wrap = canvas.parentElement;
      const portrait = wrap.clientHeight >= wrap.clientWidth;
      let [cols, rows] = SIZES[cfg.size] || SIZES.m;
      if (!portrait) [cols, rows] = [rows, cols];
      this.seed = String(cfg.seed || (1000 + Math.floor(Math.random() * 9000)));
      this.srnd = mulberry32(hashSeed(this.seed));
      let m;
      if (cfg.map === 'custom') {
        m = Maps.parse(cfg.customMap);
        if (m.error) { cfg.map = 'rooms'; m = genMap('rooms', cols, rows, this.srnd); Maps.decorate(m, 'rooms', this.srnd); }
        else m.fixedDoors = true;
      } else if (cfg.map === 'maze' || cfg.map === 'rooms' || cfg.map === 'arena') {
        m = genMap(cfg.map, cols, rows, this.srnd);
        Maps.decorate(m, cfg.map, this.srnd);
      } else { m = Maps.themed(cfg.map, cols, rows, this.srnd); m.fixedDoors = true; }
      this.M = (App.Modes && App.Modes.defs[cfg.mode]) || (App.Modes && App.Modes.defs.classic) || null;
      this.mst = {};
      if (this.M && this.M.pre) this.M.pre(cfg);
      if (cfg.props === false) { m.props = []; m.windows = []; }
      this.W = m.W; this.H = m.H; this.g = m.g; this.center = m.center;
      const f = clamp(Math.sqrt((this.W * this.H) / (27 * 39)), 0.8, 1.7);
      this.zoneDelay = 55 * f; this.zoneTime = 130 * f;
      const N = this.W * this.H;
      this.seen = new Uint32Array(N); this.stamp = 0; this.prev = new Int32Array(N); this.dist = new Int32Array(N); this.queue = new Int32Array(N);
      this.doorGrid = new Uint8Array(N); this.doors = new Map();
      this.makeDoors(cfg.map, m);
      this.initWorld(m);
      this.darkAny = this.dark.some((v) => v);
      this.floor = [];
      for (let i = 0; i < N; i++) if (!this.g[i] && !this.doorGrid[i]) this.floor.push(i);
      this.spawn();
      this.lootRnd = this.srnd;
      this.initLoot();
      this.lootRnd = null;
      this.initMode();
      this.resize = this.resize.bind(this);
      this.frame = this.frame.bind(this);
      this.resize();
      const f0 = this.soldiers[0]; this.camX = f0.x; this.camY = f0.y; this.clampCam();
      window.addEventListener('resize', this.resize);
    }

    destroy() { this.rec = null; cancelAnimationFrame(this.raf); window.removeEventListener('resize', this.resize); this.dead = true; this.static = null; this.mini = null; this.fog = null; this.dk = null; }

    /* ---------- mundo ---------- */
    /** Pared de verdad (frena vista, balas y sonido). Los cajones, barriles y ventanas no cuentan. */
    isWall(x, y) { return x < 0 || y < 0 || x >= this.W || y >= this.H || this.wl[y * this.W + x] === 1; }
    isSolid(x, y) {
      if (x < 0 || y < 0 || x >= this.W || y >= this.H) return true;
      const i = y * this.W + x;
      if (this.g[i]) return true;
      return this.doorGrid[i] === 1 && doorClosed(this.doors.get(i));
    }
    blocked(x, y, r) {
      const x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.floor(y - r), y1 = Math.floor(y + r);
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) if (this.isSolid(xx, yy)) return true;
      return false;
    }
    los(x0, y0, x1, y1) {
      const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy), n = Math.ceil(d / 0.2);
      for (let i = 1; i < n; i++) { const t = i / n; if (this.isSolid(Math.floor(x0 + dx * t), Math.floor(y0 + dy * t))) return false; }
      return true;
    }
    /** Primera puerta cerrada en línea recta (si no hay paredes antes). Sirve para disparar "a ciegas". */
    doorOnLine(x0, y0, x1, y1, maxD) {
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, d = Math.min(len, maxD), n = Math.ceil(d / 0.25);
      const ux = dx / len, uy = dy / len;
      for (let i = 1; i <= n; i++) {
        const px = x0 + ux * d * (i / n), py = y0 + uy * d * (i / n), tx = Math.floor(px), ty = Math.floor(py);
        if (this.isWall(tx, ty)) return -1;
        const idx = ty * this.W + tx;
        if (this.doorGrid[idx] && doorClosed(this.doors.get(idx))) return idx;
      }
      return -1;
    }
    /** Cuántas paredes (y puertas cerradas, a medias) hay entre dos puntos: apaga el sonido. */
    wallsBetween(x0, y0, x1, y1) {
      const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.hypot(dx, dy) / 0.4);
      let c = 0, last = -1;
      for (let i = 1; i < n; i++) {
        const tx = Math.floor(x0 + dx * (i / n)), ty = Math.floor(y0 + dy * (i / n)), idx = ty * this.W + tx;
        if (idx === last) continue; last = idx;
        if (this.isWall(tx, ty)) c += 1; else if (this.doorGrid[idx] && doorClosed(this.doors.get(idx))) c += 0.5;
      }
      return c;
    }

    makeDoors(type, m) {
      const rnd = this.srnd, shuffle = (a) => seededShuffle(a, this.srnd);
      if (m && m.fixedDoors) {                                  // mapas temáticos o propios: las puertas vienen dibujadas
        for (const d of m.doors || []) {
          const idx = d.y * this.W + d.x, open = rnd() < 0.25;
          if (this.g[idx]) continue;
          this.doorGrid[idx] = 1;
          this.doors.set(idx, { idx, tx: d.x, ty: d.y, along: d.along, open, anim: open ? 1 : 0, flip: rnd() < 0.5 ? 1 : -1 });
        }
        return;
      }
      if (type === 'arena') return;
      const { W, H, g } = this;
      const p = type === 'rooms' ? 0.92 : 0.22;
      const cands = [];
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        if (g[y * W + x]) continue;
        const wl = g[y * W + x - 1], wr = g[y * W + x + 1], wu = g[(y - 1) * W + x], wd = g[(y + 1) * W + x];
        if (wl && wr && !wu && !wd) cands.push({ x, y, along: 'v' });        // pasillo vertical
        else if (wu && wd && !wl && !wr) cands.push({ x, y, along: 'h' });   // pasillo horizontal
      }
      const placed = [];
      for (const c of shuffle(cands)) {
        if (rnd() > p || placed.some((q) => Math.abs(q.x - c.x) + Math.abs(q.y - c.y) < 4)) continue;
        placed.push(c);
        const idx = c.y * W + c.x, open = rnd() < 0.25;
        this.doorGrid[idx] = 1;
        this.doors.set(idx, { idx, tx: c.x, ty: c.y, along: c.along, open, anim: open ? 1 : 0, flip: rnd() < 0.5 ? 1 : -1 });
      }
    }

    toggleDoor(idx, open, by) {
      const d = this.doors.get(idx); if (!d || d.open === open) return false;
      if (!open && this.soldiers.some((s) => s.alive && Math.hypot(s.x - (d.tx + 0.5), s.y - (d.ty + 0.5)) < 0.65)) return false;
      d.open = open;
      this.emitSound(d.tx + 0.5, d.ty + 0.5, by && by.sneak ? 3.5 : 8, 'door', by);
      return true;
    }

    /* ---------- soldados ---------- */
    spawn() {
      const cfg = this.cfg, W = this.W;
      const rnd = this.srnd, rint = (n) => Math.floor(this.srnd() * n), shuffle = (a) => seededShuffle(a, this.srnd);
      const pos = (i) => [(i % W) + 0.5, ((i / W) | 0) + 0.5];
      const flo = this.floor.map(pos);
      const pickFar = (chosen, pool) => {
        let best = null, bd = -1;
        for (const p of pool) {
          let md = 1e9; for (const c of chosen) md = Math.min(md, Math.hypot(p[0] - c[0], p[1] - c[1]));
          md *= 0.85 + rnd() * 0.3;
          if (md > bd) { bd = md; best = p; }
        }
        return best;
      };
      const players = cfg.players;
      let places = [];
      if (cfg.teamMode) {
        const teams = [...new Set(players.map((p) => p.team))];
        const anchors = [];
        teams.forEach((t) => anchors.push([t, pickFar(anchors.map((a) => a[1]), flo.length ? flo : [[1.5, 1.5]]) || flo[0]]));
        if (anchors.length >= 2) { const first = pickFar(anchors.slice(1).map((q) => q[1]), flo); if (first) anchors[0][1] = first; }   // los dos primeros equipos quedan en puntas opuestas (así ninguno tiene ventaja de lugar)
        players.forEach((p) => {
          const a = anchors.find((x) => x[0] === p.team)[1];
          const free = flo.filter((f) => !places.some((q) => Math.hypot(q[0] - f[0], q[1] - f[1]) < 1.6));
          free.sort((u, v) => Math.hypot(u[0] - a[0], u[1] - a[1]) - Math.hypot(v[0] - a[0], v[1] - a[1]));
          places.push(free[0] || a);
        });
      } else {
        const chosen = [flo[rint(flo.length)]];
        while (chosen.length < players.length) chosen.push(pickFar(chosen, flo));
        places = shuffle(chosen);
      }
      this.spawnPoints = places.slice();
      this.looks = Art.makeLooks(players.length + 14);
      this.soldiers = players.map((p, i) => this.makeSoldier(p, i, places[i], this.looks[i]));
    }

    /** Arma un soldado (también sirve para los bots de las oleadas). */
    makeSoldier(p, i, place, look) {
      const cfg = this.cfg, rnd = this.srnd, N = this.W * this.H;
      const jitter = (v) => clamp01(v + (rnd() - 0.5) * 0.55);
      const pers = Personas.choose(p.pers, cfg.varied);
      const P = PERS[pers], pd = WEAPONS.pistol;
      const o = {
        id: i, name: p.name, color: p.color, iq: clamp(p.iq == null ? 1 : p.iq, 0, 3), team: p.team == null || p.team < 0 || !cfg.teamMode ? -1 : p.team, teamColor: cfg.teamMode && p.team >= 0 ? TEAMS[p.team].color : null,
        ap: Object.assign({}, look, { hat: p.hat && p.hat !== 'none' ? p.hat : null }), x: place[0], y: place[1], r: 0.3, angle: rnd() * 6.283, look: 0, moveAng: 0, headOff: 0, phase: rnd() * 6, gait: 0, recoil: 0, lastStep: 0,
        hp: (p.lives || cfg.lives) * HPL, maxHp: (p.lives || cfg.lives) * HPL, alive: true, deathT: 0, kills: 0,
        pers, P, sk: { peek: jitter(P.base.peek), door: jitter(P.base.door), blind: jitter(P.base.blind), listen: 0.75 + jitter(P.base.listen) * 0.5, ambush: jitter(P.base.ambush) },
        // inventario: pistola y cuchillo de fábrica + un espacio para una tercera arma
        inv: { pistol: { type: 'pistol', mag: pd.mag, res: pd.res }, primary: null }, cur: 'pistol', wtype: 'pistol',
        reloadT: 0, reloadTot: 1, swapT: 0, meleeT: 0, bloom: 0, burstLeft: 0, wT: rnd() * 0.3, seenItems: new Map(), dryTold: false,
        cd: 0.8 + rnd() * 1.2, path: [], thinkT: rnd() * 0.3, mode: 'search',
        shieldHp: 0, shieldT: 0, speedT: 0, flash: 0, strafeDir: rnd() < 0.5 ? 1 : -1, strafeT: 0,
        zoneT: 0, stuckT: 0, lx: 0, ly: 0, target: null, td: 0, lastShot: -99, lastNoise: -99,
        know: {}, explored: new Float32Array(N).fill(-60), act: null, closeIdx: null, peekFor: -1, huntStamp: -1,
        talkCd: 2 + rnd() * 4, burstCd: 3 + rnd() * 4, radioCd: 0, alertT: -99, bubble: null, icon: null, sneak: false,
        role: p.role || 'none', manual: !!p.manual, bot: !!p.bot, hat: p.hat || 'none', photo: p.photo || null, phrases: p.phrases && p.phrases.length ? p.phrases : null, pid: p.id, base: place.slice(), spawnT: 0, respawnAt: 0, deaths: 0, score: 0,
      };
      this.initBrain(o);
      if (o.photo) { const im = new Image(); im.src = o.photo; o.photoImg = im; }
      o.lx = o.x; o.ly = o.y; o.look = o.angle; o.moveAng = o.angle;
      return o;
    }

    enemiesOf(s) { return this.soldiers.filter((o) => o.alive && o !== s && (s.team < 0 || o.team !== s.team)); }

    /* ---------- armas del soldado ---------- */
    weaponOf(s) { return s.cur === 'knife' ? null : s.cur === 'pistol' ? s.inv.pistol : s.inv.primary; }
    defOf(s) { const w = this.weaponOf(s); return w ? WEAPONS[w.type] : KNIFE; }
    weaponValue(s, type, total) {
      const def = WEAPONS[type], f = Math.min(1.2, total / (def.mag + def.res * 0.6));
      return def.tier * (0.35 + 0.65 * f) + (s.P.wpref[type] || 0);
    }
    switchTo(s, which) {
      if (s.cur === which) return;
      s.cur = which; s.swapT = which === 'knife' ? 0.3 : 0.45; s.reloadT = 0;
      const w = this.weaponOf(s); s.wtype = w ? w.type : 'knife';
      if (which === 'knife' && s.P.loud && s.bubble == null && !s.dryTold && ammoOf(s.inv.pistol) + ammoOf(s.inv.primary) === 0) {
        s.dryTold = true; this.say(s, pickLine('dry'));
      }
    }
    startReload(s) {
      const w = this.weaponOf(s); if (!w) return false;
      const def = WEAPONS[w.type];
      if (w.res <= 0 || w.mag >= magOf(w)) return false;
      s.reloadT = s.reloadTot = def.reload; s.stats.reloads++;
      this.emitSound(s.x, s.y, 4.5, 'reload', s);
      return true;
    }
    finishReload(s) {
      const w = this.weaponOf(s); if (!w) return;
      const take = Math.min(magOf(w) - w.mag, w.res);
      w.mag += take; w.res -= take;
    }
    fire(s, extra = 0) {
      const w = this.weaponOf(s);
      if (!w || w.mag <= 0 || s.reloadT > 0 || s.swapT > 0) return false;
      const def = WEAPONS[w.type], P = s.P;
      w.mag--; s.recoil = 1; s.lastShot = this.time;
      s.stats.shots++; s.stats.rounds += def.pellets;
      s.cd = def.cd * (0.92 + rnd() * 0.16) * (1 - s.mood.fury * 0.15);
      if (def.auto) {                      // ráfagas: dispara varias veces y hace una pausa
        if (s.burstLeft <= 0) s.burstLeft = P.burst[0] + rint(P.burst[1] + 1);
        if (--s.burstLeft <= 0) s.cd += 0.5 + rnd() * 0.9;
        s.bloom = Math.min(def.spread * 1.3, s.bloom + def.spread * 0.14);
      }
      const move = s.gait > 0.5 ? 1.3 : s.sneak ? 0.8 : 1;
      const spread = def.spread * this.aimMul(s) * move * (w.scope ? 0.8 : 1) + s.bloom + extra;
      const life = def.range / def.bspeed + 0.15;
      for (let i = 0; i < def.pellets; i++) {
        const a = s.angle + (rnd() - 0.5) * 2 * spread * (def.pellets > 1 ? 1.15 : 1);
        const sp = def.bspeed * (def.pellets > 1 ? 0.85 + rnd() * 0.3 : 1);
        this.bullets.push({
          x: s.x + Math.cos(a) * 0.5, y: s.y + Math.sin(a) * 0.5,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          owner: s, color: s.color, life, dmg: def.dmg * (w.sup ? 0.92 : 1), w: w.type, d: 0,
        });
      }
      // humito del caño
      for (let k = 0; k < (w.sup || w.type === 'crossbow' ? 0 : def.pellets > 1 ? 3 : 2); k++) {
        const ca = Math.cos(s.angle), sa = Math.sin(s.angle);
        this.parts.push({ x: s.x + ca * 0.95, y: s.y + sa * 0.95, vx: ca * (0.5 + rnd()) + (rnd() - 0.5) * 0.7, vy: sa * (0.5 + rnd()) + (rnd() - 0.5) * 0.7, life: 0.35 + rnd() * 0.3, max: 0.65, color: '#cfd3dc', size: 0.06 + rnd() * 0.06 });
      }
      if (!def.auto || this.time - s.lastNoise > 0.3) { s.lastNoise = this.time; this.emitSound(s.x, s.y, def.noise * (w.sup ? 0.25 : 1), 'shot', s); }
      if (this.audible()) sfx.shot(w.type, this.camDist(s) + (w.sup || w.type === 'crossbow' ? 16 : 0));
      this.onShot(s, w);
      return true;
    }
    melee(s, tgt) {
      s.cd = KNIFE.cd; s.meleeT = 0.25; s.recoil = 0;
      // por la espalda el golpe es mucho más fuerte
      const behind = Math.abs(angDiff(tgt.look, Math.atan2(s.y - tgt.y, s.x - tgt.x))) > 2.1;
      this.spark(tgt.x, tgt.y, '#ffffff', 4);
      this.emitSound(s.x, s.y, KNIFE.noise, 'step', s);
      if (this.audible()) sfx.hit();
      this.damage(tgt, s, KNIFE.dmg * (behind ? 1.8 : 1), false);
    }
    /** Distancia (en casilleros) entre un soldado y lo que está mirando la cámara: el sonido baja con la distancia. */
    camDist(s) { return Math.hypot(s.x - this.camX, s.y - this.camY); }
    audible() { return this.speed === 1 || (this.speed === 2 && ((this._sfxN = (this._sfxN || 0) + 1) % 2 === 0)); }

    /* ---------- botín en el piso ---------- */
    addItem(kind, type, x, y, mag = 0, res = 0, att = null) {
      const it = { id: this.itemId++, kind, type, x, y, mag, res, att, ang: (this.lootRnd || rnd)() * 6.283, t: 0, gone: false };
      this.items.push(it); return it;
    }
    pickWeaponType() {
      const R = this.lootRnd || rnd;
      let r = R() * LOOT_WEIGHTS.reduce((a, b) => a + b[1], 0);
      for (const [t, w] of LOOT_WEIGHTS) { r -= w; if (r <= 0) return t; }
      return 'lmg';
    }
    spawnLootAt(i, forced) {
      const R = this.lootRnd || rnd, RI = (n) => Math.floor(R() * n);
      const x = (i % this.W) + 0.5, y = ((i / this.W) | 0) + 0.5;
      const roll = R(), gear = this.cfg.gear !== false, wpn = this.cfg.loot !== false;
      const pick = (arr) => arr[RI(arr.length)];
      const weapon = () => {
        const t = this.pickWeaponType(), d = WEAPONS[t];
        const att = { sup: R() < 0.1, scope: R() < 0.12, ext: R() < 0.1 };
        return this.addItem('weapon', t, x, y, d.mag, Math.round(d.res * (0.5 + R() * 0.5)), att);
      };
      if (forced === 'weapon' && wpn) return weapon();
      if (forced === 'ammo') return this.addItem('ammo', 'ammo', x, y);
      if (wpn && roll < 0.34) return weapon();
      if (roll < 0.41) return this.addItem('ammo', 'ammo', x, y);
      if (gear) {
        if (roll < 0.64) return this.addItem('gren', pick(['frag', 'frag', 'smoke', 'flash']), x, y);
        if (roll < 0.74) return this.addItem('med', pick(['small', 'small', 'med', 'med', 'large']), x, y);
        if (roll < 0.82) return this.addItem('armor', pick(['vest', 'vest', 'helm']), x, y);
        if (roll < 0.89) return this.addItem('attach', pick(['sup', 'scope', 'ext']), x, y);
        if (roll < 0.91) return this.addItem('pack', 'pack', x, y);
      }
      if (this.cfg.powerups) return this.addItem('power', pick(['shield', 'speed']), x, y);
      return this.addItem('ammo', 'ammo', x, y);
    }
    initLoot() {
      const n = this.soldiers.length;
      const total = Math.max(6, Math.round(n * 2.4)) + 3, nW = Math.round(total * 0.4);
      const used = this.spawnPoints.slice();
      for (let k = 0; k < total; k++) {
        const RI = (n) => Math.floor(this.lootRnd() * n);
        let best = this.floor[RI(this.floor.length)], bd = -1;
        for (let t = 0; t < 14; t++) {                      // reparte el botín por todo el mapa
          const i = this.floor[RI(this.floor.length)], x = (i % this.W) + 0.5, y = ((i / this.W) | 0) + 0.5;
          let md = 1e9; for (const u of used) md = Math.min(md, Math.hypot(u[0] - x, u[1] - y));
          if (md > bd) { bd = md; best = i; }
        }
        used.push([(best % this.W) + 0.5, ((best / this.W) | 0) + 0.5]);
        this.spawnLootAt(best, k < nW ? 'weapon' : k === nW ? 'ammo' : null);
      }
    }
    spawnMoreLoot() {
      if (this.items.length >= this.soldiers.length * 2.5 + 5) return;
      this.spawnLootAt(this.floor[rint(this.floor.length)], null);
    }
    dropWeapons(s) {
      const drop = (w) => {
        if (!w || ammoOf(w) <= 0) return;
        const a = rnd() * 6.283, m = 0.15 + rnd() * 0.3;
        let x = s.x + Math.cos(a) * m, y = s.y + Math.sin(a) * m;
        if (this.isSolid(Math.floor(x), Math.floor(y))) { x = s.x; y = s.y; }
        this.addItem('weapon', w.type, x, y, w.mag, w.res, { sup: !!w.sup, scope: !!w.scope, ext: !!w.ext });
      };
      drop(s.inv.pistol); drop(s.inv.primary);
      s.inv.pistol = { type: 'pistol', mag: 0, res: 0 }; s.inv.primary = null;
      const spot = () => { const a = rnd() * 6.283, m = 0.2 + rnd() * 0.4; let x = s.x + Math.cos(a) * m, y = s.y + Math.sin(a) * m; if (this.isSolid(Math.floor(x), Math.floor(y))) { x = s.x; y = s.y; } return [x, y]; };
      for (const t of ['frag', 'smoke', 'flash']) for (let k = 0; k < s.gren[t]; k++) { const [x, y] = spot(); this.addItem('gren', t, x, y); }
      s.gren = { frag: 0, smoke: 0, flash: 0 };
      for (const t of s.meds) { const [x, y] = spot(); this.addItem('med', t, x, y); }
      s.meds = [];
      if (s.armor.vest > 30) { const [x, y] = spot(); this.addItem('armor', 'vest', x, y); }
      if (s.armor.helm > 15) { const [x, y] = spot(); this.addItem('armor', 'helm', x, y); }
      s.armor = { vest: 0, helm: 0 };
    }

    /** Cuánto le conviene a este soldado agarrar esto (0 = nada). */
    evalItem(s, it) {
      if (it.kind === 'weapon') {
        const def = WEAPONS[it.type], tot = it.mag + it.res;
        if (it.type === 'pistol') return Math.min(tot, cap(def, s.inv.pistol, s) - ammoOf(s.inv.pistol)) / 24;    // solo sirve por las balas
        const pr = s.inv.primary;
        if (pr && pr.type === it.type) return Math.min(tot, cap(def, pr, s) - ammoOf(pr)) / (def.mag + def.res) * 1.4;
        const attBonus = it.att ? (it.att.sup ? 0.5 : 0) + (it.att.scope ? 0.4 : 0) + (it.att.ext ? 0.3 : 0) : 0;
        const nv = this.weaponValue(s, it.type, tot) + attBonus, cv = pr ? this.weaponValue(s, pr.type, ammoOf(pr)) + (pr.sup ? 0.5 : 0) + (pr.scope ? 0.4 : 0) + (pr.ext ? 0.3 : 0) : 0;
        return nv - cv > 0.6 ? (nv - cv) / 3 : 0;
      }
      if (it.kind === 'gren') {
        const have = s.gren[it.type], lim = s.pack ? 3 : 2;
        if (have >= lim) return 0;
        const base = it.type === 'frag' ? 0.7 : it.type === 'flash' ? 0.5 : 0.45;
        return base * (0.55 + 0.45 * (s.sk.nade == null ? 0.5 : s.sk.nade)) * (1 - 0.35 * have);
      }
      if (it.kind === 'med') {
        if (s.meds.length >= (s.pack ? 3 : 2)) return 0;
        const miss = (s.maxHp - s.hp) / s.maxHp, size = it.type === 'large' ? 1 : it.type === 'med' ? 0.8 : 0.6;
        return (0.3 + miss * 1.4) * size + 0.1;
      }
      if (it.kind === 'armor') return it.type === 'vest' ? (s.armor.vest >= 60 ? 0 : 0.85) : (s.armor.helm >= 30 ? 0 : 0.55);
      if (it.kind === 'pack') return s.pack ? 0 : 0.7;
      if (it.kind === 'attach') {
        const w = s.inv.primary || s.inv.pistol;
        if (!w || w[it.type]) return 0;
        return it.type === 'sup' ? (s.P.sneak ? 0.8 : 0.35) : it.type === 'scope' ? 0.5 : (WEAPONS[w.type].auto ? 0.6 : 0.4);
      }
      if (it.kind === 'ammo') {
        let g = 0;
        for (const w of [s.inv.pistol, s.inv.primary]) {
          if (!w) continue;
          const def = WEAPONS[w.type];
          g += Math.min(Math.ceil(def.mag * 1.5), cap(def, w, s) - ammoOf(w)) / (def.mag + def.res) * 1.2;
        }
        return g;
      }
      if (it.type === 'shield') return s.shieldHp > 0 ? 0 : 0.7;
      if (it.type === 'speed') return s.speedT > 0 ? 0 : 0.35;
      return s.hp >= s.maxHp ? 0 : (s.maxHp - s.hp) / s.maxHp * 1.6 + 0.1;
    }
    applyPickup(s, it) {
      let label = '';
      if (it.kind === 'weapon') {
        const def = WEAPONS[it.type], tot = it.mag + it.res;
        const own = it.type === 'pistol' ? s.inv.pistol : (s.inv.primary && s.inv.primary.type === it.type ? s.inv.primary : null);
        if (own) {                                           // misma arma: se queda con las balas
          const take = Math.min(tot, cap(def, own, s) - ammoOf(own));
          if (take <= 0) return false;
          own.res += take;
          const left = tot - take; it.mag = 0; it.res = left;
          if (left <= 0) it.gone = true;
          label = `balas de ${def.name.toLowerCase()}`;
        } else {                                             // arma nueva: suelta la que tenía
          const old = s.inv.primary;
          if (old && ammoOf(old) > 0) this.addItem('weapon', old.type, s.x + (rnd() - 0.5) * 0.5, s.y + (rnd() - 0.5) * 0.5, old.mag, old.res, { sup: !!old.sup, scope: !!old.scope, ext: !!old.ext });
          s.inv.primary = { type: it.type, mag: it.mag, res: it.res, sup: !!(it.att && it.att.sup), scope: !!(it.att && it.att.scope), ext: !!(it.att && it.att.ext) };
          s.cur = 'primary'; s.swapT = 0.6; s.reloadT = 0; s.wtype = it.type; s.dryTold = false;
          it.gone = true; label = def.name.toLowerCase();
        }
      } else if (it.kind === 'ammo') {
        let any = false;
        for (const w of [s.inv.pistol, s.inv.primary]) {
          if (!w) continue;
          const def = WEAPONS[w.type], add = Math.min(Math.ceil(def.mag * 1.5), cap(def, w, s) - ammoOf(w));
          if (add > 0) { w.res += add; any = true; }
        }
        if (!any) return false;
        it.gone = true; label = 'munición'; s.dryTold = false;
        if (s.cur === 'knife') { s.cur = s.inv.primary && ammoOf(s.inv.primary) > 0 ? 'primary' : 'pistol'; s.swapT = 0.4; }
      } else if (it.kind === 'gren') {
        const lim = s.pack ? 3 : 2;
        if (s.gren[it.type] >= lim) return false;
        s.gren[it.type]++; it.gone = true; label = it.type === 'frag' ? 'granada' : it.type === 'smoke' ? 'granada de humo' : 'granada aturdidora';
      } else if (it.kind === 'med') {
        if (s.meds.length >= (s.pack ? 3 : 2)) return false;
        s.meds.push(it.type); s.meds.sort((a, b) => MED[b].amt - MED[a].amt); it.gone = true; label = it.type === 'large' ? 'botiquín grande' : it.type === 'med' ? 'botiquín mediano' : 'botiquín chico';
      } else if (it.kind === 'armor') {
        if (it.type === 'vest') { if (s.armor.vest >= 60) return false; s.armor.vest = 100; label = 'chaleco'; }
        else { if (s.armor.helm >= 30) return false; s.armor.helm = 50; label = 'casco'; }
        it.gone = true;
      } else if (it.kind === 'pack') {
        if (s.pack) return false;
        s.pack = true; it.gone = true; label = 'mochila';
        for (const w of [s.inv.pistol, s.inv.primary]) if (w) w.res += Math.ceil(WEAPONS[w.type].mag * 0.6);
      } else if (it.kind === 'attach') {
        const w = s.inv.primary || s.inv.pistol;
        if (!w || w[it.type]) return false;
        w[it.type] = true; it.gone = true; label = it.type === 'sup' ? 'silenciador' : it.type === 'scope' ? 'mira' : 'cargador extendido';
      } else {
        if (it.type === 'shield') { s.shieldHp = 70; s.shieldT = 15; } else if (it.type === 'speed') s.speedT = 9;
        else s.hp = Math.min(s.maxHp + HPL * 0.5, s.hp + HPL * 0.6);
        it.gone = true; label = PU_NAME[it.type];
      }
      this.spark(s.x, s.y, it.kind === 'power' ? PU_COLOR[it.type] : '#a3e635', 10);
      this.emitSound(s.x, s.y, 3, 'step', s);
      if (this.speed <= 2) sfx.pickup();
      s.stats.pickups++;
      this.hooks.onPickup(s, label);
      return true;
    }
    collectItems() {
      for (const s of this.soldiers) {
        if (!s.alive) continue;
        for (const it of this.items) {
          if (it.gone || Math.hypot(it.x - s.x, it.y - s.y) > 0.62) continue;
          if (this.evalItem(s, it) >= 0.15) this.applyPickup(s, it);
        }
      }
      for (let i = this.items.length - 1; i >= 0; i--) if (this.items[i].gone) this.items.splice(i, 1);
    }

    /* ---------- sonido ---------- */
    emitSound(x, y, r, kind, src) {
      if (RING_COLOR[kind] && this.rings.length < 14 && !(kind === 'shot' && r <= 5)) this.rings.push({ x, y, r: Math.min(r, 5), t: 0, kind });
      if (!src) return;
      for (const s of this.soldiers) {
        if (!s.alive || s === src || (src.team >= 0 && s.team === src.team)) continue;
        const d = Math.hypot(s.x - x, s.y - y);
        if (d > r * 1.5) continue;
        const eff = d * (1 + 0.55 * this.wallsBetween(x, y, s.x, s.y));
        if (eff > r * s.sk.listen) continue;
        const old = s.know[src.id];
        if (old && old.exact && this.time - old.t < 1) continue;
        const err = (kind === 'step' ? 1.3 : 0.6) + eff * 0.12, a = rnd() * 6.283, m = rnd() * err;
        s.know[src.id] = { id: src.id, x: x + Math.cos(a) * m, y: y + Math.sin(a) * m, t: this.time, exact: false, kind };
        if (!s.target) { s.alertT = this.time; s.thinkT = Math.min(s.thinkT, 0.05); s.icon = { ch: '?', t: 1.2 }; }
        this.heard(s, src, kind, x, y);
      }
    }

    say(s, text, dur = 2.3) {
      if (this.cfg.talk === false || !text) return;
      if (s.phrases && rnd() < 0.55) text = s.phrases[rint(s.phrases.length)].replace(/\{n\}/g, s.target ? s.target.name : 'cobarde');   // frases propias
      s.stats.talk++;
      s.bubble = { text, t: dur };
      this.emitSound(s.x, s.y, 11, 'shout', s);
    }

    /* ---------- caminos (BFS en 8 direcciones) ---------- */
    bfs(sx, sy, goal, maxD = 9999, all = false) {
      const W = this.W, H = this.H, g = this.g, seen = this.seen, prev = this.prev, dist = this.dist, q = this.queue;
      const stamp = ++this.stamp;
      const start = sy * W + sx;
      let qh = 0, qt = 0; q[qt++] = start; seen[start] = stamp; prev[start] = -1; dist[start] = 0;
      while (qh < qt) {
        const cur = q[qh++];
        if (!all && goal(cur)) return this.pathTo(cur);
        if (dist[cur] >= maxD) continue;
        const cx = cur % W, cy = (cur / W) | 0;
        for (let d = 0; d < 8; d++) {
          const dx = DX[d], dy = DY[d], nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          if (g[ni] || seen[ni] === stamp) continue;
          if (dx !== 0 && dy !== 0 && (g[cy * W + nx] || g[ny * W + cx])) continue;
          seen[ni] = stamp; prev[ni] = cur; dist[ni] = dist[cur] + 1; q[qt++] = ni;
        }
      }
      return all ? qt : null;
    }
    pathTo(idx) {
      const out = []; for (let c = idx; c !== -1; c = this.prev[c]) out.push(c);
      return out.reverse();
    }
    floorIdxNear(x, y) {
      const W = this.W, tx = Math.floor(x), ty = Math.floor(y);
      for (let r = 0; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = tx + dx, ny = ty + dy;
        if (nx > 0 && ny > 0 && nx < W - 1 && ny < this.H - 1 && !this.g[ny * W + nx]) return ny * W + nx;
      }
      return this.floor[0];
    }

    outsideZone(x, y, m = 0) {
      const z = this.zone; if (!z) return false;
      return x < z.x0 + m || x > z.x1 - m || y < z.y0 + m || y > z.y1 - m;
    }

    /* ---------- percepción ---------- */
    sightOf(s) { const d = this.defOf(s), w = this.weaponOf(s); return (s.P.sight + (d.scope || 0) + (w && w.scope ? 4 : 0)) * (this.fogMul || 1); }
    damage(s, by, dmg, zone) {
      if (!s.alive || (this.phase === 'ending' && !zone)) return;
      if (!zone && s.spawnT > 0) return;                       // protección al reaparecer
      if (!zone && s.shieldHp > 0) {
        const ab = Math.min(s.shieldHp, dmg); s.shieldHp -= ab; dmg -= ab;
        this.spark(s.x, s.y, '#38bdf8', 4);
        if (dmg <= 0) return;
      }
      if (!zone && s.mood) dmg *= (1 - s.mood.fury * Math.min(1, s.P.rage) * 0.3) * (s.P.tough || 1);
      if (!zone && s.armor && (s.armor.vest > 0 || s.armor.helm > 0)) {           // el chaleco y el casco absorben una parte
        const red = (s.armor.vest > 0 ? 0.4 : 0) + (s.armor.helm > 0 ? 0.2 : 0), ab = dmg * red, vs = s.armor.vest > 0 ? (s.armor.helm > 0 ? 0.67 : 1) : 0;
        s.armor.vest = Math.max(0, s.armor.vest - ab * vs * 1.2); s.armor.helm = Math.max(0, s.armor.helm - ab * (1 - vs) * 1.2);
        s.stats.absorbed = (s.stats.absorbed || 0) + ab; dmg -= ab;
      }   // la furia y el aguante propio reducen el daño
      const dealt = Math.min(dmg, s.hp);
      s.hp -= dmg; s.flash = 0.18;
      this.spark(s.x, s.y, s.color, 5);
      if (this.speed <= 2 && (!by || by.cur !== 'knife')) sfx.hit();
      if (by && by !== s) {      // sabe de dónde le dispararon (más o menos)
        const a = rnd() * 6.283, m = rnd() * 1.6;
        s.know[by.id] = { id: by.id, x: by.x + Math.cos(a) * m, y: by.y + Math.sin(a) * m, t: this.time, exact: false, kind: 'hit' };
        s.thinkT = Math.min(s.thinkT, 0.1);
      }
      this.onDamaged(s, by, dealt, zone);
      if (s.hp <= 0) this.kill(s, by, zone);
    }
    kill(s, by, zone) {
      s.alive = false; s.hp = 0; s.deathT = this.time; s.deathOrder = this.deaths++; s.bubble = null; s.act = null;
      this.corpses.push({ x: s.x, y: s.y, color: s.color, ap: s.ap, ang: s.angle + (rnd() - 0.5) });
      this.dropWeapons(s);                                   // suelta todo lo que le quedaba
      for (let i = 0; i < 30; i++) {
        const a = rnd() * 6.283, v = 1.5 + rnd() * 5;
        this.parts.push({ x: s.x, y: s.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + rnd() * 0.7, max: 1.2, color: i % 3 === 0 ? '#ffb347' : s.color, size: 0.08 + rnd() * 0.12 });
      }
      this.parts.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: 0.45, max: 0.45, color: '#fff', size: 0.9, ring: true });
      sfx.boom(); vibrate(40);
      this.emitSound(s.x, s.y, 12, 'boom', null);
      s.deaths++;
      this.recKill(s, by, zone);
      const foe = by && by !== s && !(by.team >= 0 && by.team === s.team);
      if (foe) by.kills++;
      if (this.M && this.M.respawn && this.phase === 'run') s.respawnAt = this.time + this.M.respawn;
      this.onKilled(s, by, zone);
      if (this.M && this.M.onKill) this.M.onKill(this, s, by, zone);
      this.hooks.onKill(s, by, zone);
    }
    spark(x, y, color, n) {
      for (let i = 0; i < n; i++) {
        const a = rnd() * 6.283, v = 1 + rnd() * 3;
        this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.2 + rnd() * 0.25, max: 0.45, color, size: 0.05 + rnd() * 0.05 });
      }
    }

    /* ---------- simulación ---------- */
    step(dt) {
      this.time += dt;
      if (this.cfg.zone) {
        const t = Math.min(1, Math.max(0, (this.time - this.zoneDelay) / this.zoneTime));
        const [cx, cy] = this.center, W = this.W, H = this.H;
        const e = t * t * (3 - 2 * t);
        this.zone = t > 0 ? { x0: e * (cx - 1.5), y0: e * (cy - 1.5), x1: W - e * (W - cx - 2.5), y1: H - e * (H - cy - 2.5) } : null;
      }
      this.lootTimer -= dt;
      if (this.lootTimer <= 0) { this.lootTimer = 12 + rnd() * 8; this.spawnMoreLoot(); }
      this.items.forEach((it) => { it.t += dt; });
      if (this.phase === 'run') this.collectItems();
      for (const d of this.doors.values()) d.anim = Math.max(0, Math.min(1, d.anim + (d.open ? 1 : -1) * dt * 3.2));
      this.stepWorld(dt);
      this.teamTick(dt);
      for (const s of this.soldiers) this.updateSoldier(s, dt);

      // balas (atraviesan las puertas de madera, no las paredes). Las rápidas se avanzan en tramos cortos.
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        const n = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 0.22)), sd = dt / n;
        let gone = false;
        for (let k = 0; k < n && !gone; k++) {
          b.x += b.vx * sd; b.y += b.vy * sd; b.d = (b.d || 0) + Math.hypot(b.vx, b.vy) * sd;
          const bx = Math.floor(b.x), by = Math.floor(b.y);
          if (this.bulletTile(b, bx, by)) { gone = true; break; }
          if (!b.door && this.doorGrid[by * this.W + bx]) { b.door = true; this.spark(b.x, b.y, '#c9955a', 5); }
          for (const s of this.soldiers) {
            if (!s.alive || s === b.owner || (b.owner.team >= 0 && s.team === b.owner.team && !this.cfg.friendly)) continue;
            if (Math.hypot(s.x - b.x, s.y - b.y) < s.r + 0.1) { gone = true; b.owner.stats.hits++; this.damage(s, b.owner, b.dmg, false); break; }
          }
        }
        b.life -= dt;
        if (gone || b.life <= 0) this.bullets.splice(i, 1);
      }
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.life -= dt;
        if (p.life <= 0) this.parts.splice(i, 1);
      }
      for (let i = this.rings.length - 1; i >= 0; i--) { this.rings[i].t += dt; if (this.rings[i].t > 0.7) this.rings.splice(i, 1); }

      this.recStep(dt);
      // modos de juego (reaparición, objetivos) y ¿terminó?
      if (this.phase === 'run') {
        this.modeStep(dt);
        const end = this.M && this.M.check ? this.M.check(this) : this.defaultCheck();
        if (end) {
          this.phase = 'ending'; this.endT = 0; this.bullets.length = 0; this.winners = end.winners || []; this.endInfo = end; this.recFinish();
          const w = this.winners.find((q) => q.alive) || this.winners[0];
          if (w && w.alive) { this.focus = w; this.focusUntil = this.time + 9; this.followId = null; }
        }
      } else if (this.phase === 'ending') {
        this.endT += dt;
        if (this.endT > (this.cfg.slowmo !== false ? 0.9 : 1.7)) { this.phase = 'done'; this.hooks.onEnd(this.result()); }
      }
    }

    defaultCheck() {
      const alive = this.soldiers.filter((s) => s.alive);
      const groups = new Set(alive.map((s) => (s.team < 0 ? 'p' + s.id : 't' + s.team)));
      return groups.size <= 1 ? { winners: alive } : null;
    }
    result() {
      const pl = this.soldiers.filter((s) => !s.bot);
      const by = this.M && this.M.rank ? this.M.rank : null;
      const order = pl.sort((a, b) => {
        if (by) { const d = by(b, this) - by(a, this); if (d) return d; }
        if (a.alive !== b.alive) return a.alive ? -1 : 1;
        if (a.alive) return b.kills - a.kills;
        return (b.deathT - a.deathT) || (b.kills - a.kills);
      });
      const info = this.endInfo || {};
      return { ranking: order, winners: this.winners, teamMode: this.cfg.teamMode, time: this.time, seed: this.seed, mode: this.cfg.mode || 'classic', title: info.title || null, sub: info.sub || null, scores: this.M && this.M.scores ? this.M.scores(this) : null, replay: this.replayClip ? this.replayClip() : null };
    }

    /* ---------- cámara ---------- */
    setScale() {
      const cw = this.cw, ch = this.ch;
      const fits = this.followTs * this.W <= cw + 0.5 && this.followTs * this.H <= ch + 0.5;
      this.isFull = this.camMode === 'full' || fits;
      this.ts = this.isFull ? this.fitTs : this.followTs;
      if (this.isFull) { this.camX = this.W / 2; this.camY = this.H / 2; }
      this.buildStatic(); this.buildMini();
      this.clampCam();
    }
    clampCam() {
      if (this.isFull) { this.camX = this.W / 2; this.camY = this.H / 2; return; }
      const vw = this.cw / this.ts, vh = this.ch / this.ts;
      this.camX = vw >= this.W ? this.W / 2 : clamp(this.camX, vw / 2, this.W - vw / 2);
      this.camY = vh >= this.H ? this.H / 2 : clamp(this.camY, vh / 2, this.H - vh / 2);
    }
    /** Elige a quién mostrar: al soldado seguido o a donde hay más acción. */
    focusSoldier() {
      if (this.followId != null) { const f = this.soldiers[this.followId]; if (f && f.alive) return f; }
      const alive = this.soldiers.filter((s) => s.alive);
      if (!alive.length) return this.focus;
      if (this.focus && this.focus.alive && this.time < this.focusUntil) return this.focus;
      let best = null, bs = -1;
      for (const s of alive) {
        let sc = (s.target ? 3 : 0) + (this.time - s.lastShot < 1.5 ? 2.5 : 0) + (s.flash > 0 ? 1.5 : 0) + (s.mode === 'attack' ? 1 : 0) + (s.mode === 'hunt' ? 0.5 : 0);
        for (const o of alive) if (o !== s && Math.hypot(o.x - s.x, o.y - s.y) < 8) sc += 0.7;
        sc += rnd() * 0.8;
        if (sc > bs) { bs = sc; best = s; }
      }
      this.focus = best; this.focusUntil = this.time + 2.5;
      return best;
    }
    updateCamera(dt) {
      if (this.isFull) return;
      const f = this.focusSoldier();
      if (f) {
        const k = 1 - Math.exp(-dt * 3);
        this.camX += (f.x - this.camX) * k; this.camY += (f.y - this.camY) * k;
      }
      this.clampCam();
    }

    /* ---------- bucle ---------- */
    start() { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); }
    frame(now) {
      if (this.dead) return;
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.now = now;
      if (!this.paused) {
        if (this.phase === 'countdown') {
          this.cdT -= dt;
          const n = Math.ceil(this.cdT);
          if (n < this.lastBeep && n >= 0) { this.lastBeep = n; if (n > 0 && n <= 3) sfx.beep(false); else if (n === 0) sfx.beep(true); }
          if (this.cdT <= 0) { this.phase = 'run'; this.cdT = 0; }
        } else if (this.phase !== 'done') {
          this.acc += dt * this.speed * (this.phase === 'ending' && this.cfg.slowmo !== false ? 0.35 : 1);
          let n = 0;
          while (this.acc >= STEP && n < 30) { this.step(STEP); this.acc -= STEP; n++; if (this.phase === 'done') break; }
          if (n >= 30) this.acc = 0;
        }
        this.updateCamera(dt);
      }
      this.draw();
      this.hooks.onFrame(this);
      if (this.phase !== 'done') this.raf = requestAnimationFrame(this.frame);
    }

    /* ---------- dibujo ---------- */
    resize() {
      const cv = this.cv, wrap = cv.parentElement;
      const cw = wrap.clientWidth, ch = wrap.clientHeight;
      if (!cw || !ch) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
      this.dpr = dpr; this.cw = cw; this.ch = ch;
      this.fitTs = Math.floor(Math.min(cw / this.W, ch / this.H) * 100) / 100;
      this.followTs = clamp(Math.min(cw, ch) / 13, 20, 40);
      this.setScale();
    }

    buildStatic() {
      const ts = this.ts, dpr = Math.min(2, this.dpr), W = this.W, H = this.H, g = this.wl;
      this.sdpr = dpr;
      const c = document.createElement('canvas');
      c.width = Math.ceil(W * ts * dpr); c.height = Math.ceil(H * ts * dpr);
      const x = c.getContext('2d'); x.scale(dpr, dpr);
      for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
        if (g[y * W + xx]) continue;
        const px = xx * ts, py = y * ts;
        x.fillStyle = (xx + y) % 2 ? '#1b2339' : '#1f2840';
        x.fillRect(px, py, ts + 0.5, ts + 0.5);
        if (y > 0 && g[(y - 1) * W + xx]) { // sombra bajo la pared
          const gr = x.createLinearGradient(0, py, 0, py + ts * 0.45);
          gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          x.fillStyle = gr; x.fillRect(px, py, ts + 0.5, ts * 0.45);
        }
      }
      for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
        if (!g[y * W + xx]) continue;
        const px = xx * ts, py = y * ts;
        x.fillStyle = '#35456f'; x.fillRect(px, py, ts + 0.5, ts + 0.5);
        const open = (dx, dy) => { const nx = xx + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < W && ny < H && !g[ny * W + nx]; };
        const e = Math.max(1.5, ts * 0.1);
        x.fillStyle = '#6e84c0';
        if (open(0, -1)) x.fillRect(px, py, ts, e);
        if (open(-1, 0)) x.fillRect(px, py, e, ts);
        x.fillStyle = '#222c4c';
        if (open(0, 1)) x.fillRect(px, py + ts - e, ts, e);
        if (open(1, 0)) x.fillRect(px + ts - e, py, e, ts);
        x.fillStyle = 'rgba(255,255,255,.04)'; x.fillRect(px + e, py + e, ts - e * 2, ts - e * 2);
      }
      this.drawStaticExtras(x, ts);
      this.static = c;
    }
    buildMini() {
      const k = Math.min(86 / this.W, 120 / this.H), W = this.W, H = this.H;
      const c = document.createElement('canvas'); c.width = Math.ceil(W * k); c.height = Math.ceil(H * k);
      const x = c.getContext('2d');
      x.fillStyle = 'rgba(10,14,26,.85)'; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = '#5b6fa8';
      for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) if (this.wl[y * W + xx]) x.fillRect(xx * k, y * k, k + 0.4, k + 0.4);
      this.mini = c; this.miniK = k;
    }

    draw() {
      if (!this.static) return;
      const x = this.ctx, ts = this.ts, dpr = this.dpr, sd = this.sdpr, W = this.W, H = this.H;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.fillStyle = '#0a0e1a'; x.fillRect(0, 0, this.cw, this.ch);
      const left = this.camX - this.cw / (2 * ts), top = this.camY - this.ch / (2 * ts);
      const right = left + this.cw / ts, bottom = top + this.ch / ts;
      const l = Math.max(0, left), t = Math.max(0, top), r = Math.min(W, right), b = Math.min(H, bottom);
      if (r > l && b > t) x.drawImage(this.static, l * ts * sd, t * ts * sd, (r - l) * ts * sd, (b - t) * ts * sd, (l - left) * ts, (t - top) * ts, (r - l) * ts, (b - t) * ts);
      const povS = this.povSoldier();
      const vis = (o) => !povS || o === povS || (povS.team >= 0 && o.team === povS.team) || this.canSeeFrom(povS, o);
      const shk = this.shake > 0 ? this.shake * 7 : 0;
      x.save(); x.translate(-left * ts + (shk ? (rnd() - 0.5) * shk : 0), -top * ts + (shk ? (rnd() - 0.5) * shk : 0));

      for (const d of this.doors.values()) Art.drawDoor(x, d, ts);
      this.drawWorld(x, ts, left, top, this.cw / ts, this.ch / ts);
      for (const c of this.corpses) Art.drawCorpse(x, c, ts);
      for (const it of this.items) { if (it.kind === 'power') this.drawPowerup(x, it); else Art.drawItem(x, it, ts, this.time); }
      this.drawModeUnder(x, ts);
      if (this.zone) this.drawZone(x);
      // ondas de sonido (disparos, gritos, puertas)
      for (const rg of this.rings) {
        if (povS && Math.hypot(rg.x - povS.x, rg.y - povS.y) > rg.r * 1.6) continue;      // en POV solo se ve lo que se oye
        const k = rg.t / 0.7;
        x.strokeStyle = RING_COLOR[rg.kind]; x.globalAlpha = (1 - k) * 0.4; x.lineWidth = 2;
        x.beginPath(); x.arc(rg.x * ts, rg.y * ts, ts * rg.r * (0.2 + 0.8 * k), 0, 6.2832); x.stroke();
      }
      x.globalAlpha = 1;
      const alive = this.soldiers.filter((s) => s.alive).sort((a, b2) => a.y - b2.y);
      if (this.cfg.laser) this.drawLasers(x, alive.filter(vis));
      for (const s of alive) if (vis(s)) Art.drawSoldier(x, s, ts, this.time);
      for (const bu of this.bullets) {
        if (povS && !this.canSeePoint(povS, bu.x, bu.y)) continue;
        const sp = Math.hypot(bu.vx, bu.vy), tx = bu.vx / sp, ty = bu.vy / sp;
        const len = bu.w === 'sniper' ? 1.4 : bu.w === 'shotgun' || bu.w === 'ashotgun' ? 0.25 : 0.55;
        x.strokeStyle = bu.w === 'sniper' ? '#bae6fd' : bu.w === 'shotgun' || bu.w === 'ashotgun' ? '#fdba74' : lighten(bu.color, 0.5);
        x.globalAlpha = 0.55; x.lineWidth = Math.max(2, ts * (bu.w === 'sniper' ? 0.14 : 0.1)); x.lineCap = 'round';
        x.beginPath(); x.moveTo((bu.x - tx * len) * ts, (bu.y - ty * len) * ts); x.lineTo(bu.x * ts, bu.y * ts); x.stroke();
        x.globalAlpha = 1; x.fillStyle = '#fff'; x.beginPath(); x.arc(bu.x * ts, bu.y * ts, Math.max(1.5, ts * 0.075), 0, 6.283); x.fill();
      }
      for (const p of this.parts) {
        const a = Math.max(0, p.life / p.max);
        x.globalAlpha = a;
        if (p.ring) { x.strokeStyle = p.color; x.lineWidth = 3; x.beginPath(); x.arc(p.x * ts, p.y * ts, ts * (1.4 - a * 1.2), 0, 6.283); x.stroke(); }
        else { x.fillStyle = p.color; x.beginPath(); x.arc(p.x * ts, p.y * ts, Math.max(1, p.size * ts), 0, 6.283); x.fill(); }
      }
      x.globalAlpha = 1;
      this.drawSmoke(x, ts);
      for (const s of alive) if (vis(s)) this.drawLabel(x, s);
      this.drawModeOver(x, ts);
      x.restore();
      if (this.hasDarkness()) this.drawDarkness(x, left, top);
      if (this.fogMul < 1) { x.fillStyle = 'rgba(205,215,230,0.24)'; x.fillRect(0, 0, this.cw, this.ch); }
      if (povS) this.drawFog(x, povS, left, top);

      if (!this.isFull) this.drawMini(x);

      // cuenta regresiva y cartel de arranque
      let txt = '', size = 0, alpha = 1;
      if (this.phase === 'countdown') {
        const n = Math.ceil(this.cdT), frac = this.cdT - Math.floor(this.cdT);
        x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, this.cw, this.ch);
        txt = n > 3 ? '' : String(Math.max(1, n));
        size = Math.min(this.cw, this.ch) * (0.28 + 0.12 * (frac || 1));
      } else if (this.phase === 'run' && this.time < 0.8) {
        txt = '¡YA!'; size = Math.min(this.cw, this.ch) * 0.3; alpha = 1 - this.time / 0.8;
      }
      if (txt) {
        x.globalAlpha = alpha; x.fillStyle = '#ffd24a'; x.strokeStyle = '#000'; x.lineWidth = 6;
        x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `900 ${size}px system-ui, sans-serif`;
        x.strokeText(txt, this.cw / 2, this.ch / 2); x.fillText(txt, this.cw / 2, this.ch / 2); x.globalAlpha = 1;
      }
    }

    /* ---------- vista desde los ojos de un soldado (POV) ---------- */
    povSoldier() {
      if (!this.pov || this.followId == null) return null;
      const s = this.soldiers[this.followId];
      return s && s.alive ? s : null;
    }
    canSeePoint(a, px, py) {
      const dx = px - a.x, dy = py - a.y, d = Math.hypot(dx, dy);
      if (d > this.sightOf(a)) return false;
      if (d > 2.2 && Math.abs(angDiff(a.look, Math.atan2(dy, dx))) > FOV / 2) return false;
      return this.los(a.x, a.y, px, py);
    }
    canSeeFrom(a, b) { return this.canSeePoint(a, b.x, b.y); }
    /** Oscurece todo menos lo que el soldado ve (cono de visión) y recuerda (lo ya recorrido, más tenue). */
    drawFog(x, a, left, top) {
      const ts = this.ts, dpr = this.dpr, cw = this.cw, ch = this.ch, W = this.W, H = this.H;
      if (!this.fog || this.fog.width !== this.cv.width || this.fog.height !== this.cv.height) {
        this.fog = document.createElement('canvas'); this.fog.width = this.cv.width; this.fog.height = this.cv.height; this.fogCtx = this.fog.getContext('2d');
      }
      const f = this.fogCtx;
      f.setTransform(dpr, 0, 0, dpr, 0, 0); f.globalCompositeOperation = 'source-over';
      f.clearRect(0, 0, cw, ch); f.fillStyle = 'rgba(3,5,12,0.94)'; f.fillRect(0, 0, cw, ch);
      f.globalCompositeOperation = 'destination-out';
      f.fillStyle = 'rgba(0,0,0,0.42)';                                   // lo que ya recorrió, tenue
      const x0 = Math.max(0, Math.floor(left)), y0 = Math.max(0, Math.floor(top)), x1 = Math.min(W - 1, Math.ceil(left + cw / ts)), y1 = Math.min(H - 1, Math.ceil(top + ch / ts));
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (a.explored[ty * W + tx] > -50) f.fillRect((tx - left) * ts, (ty - top) * ts, ts + 0.6, ts + 0.6);
      }
      f.fillStyle = '#000'; f.beginPath();                                // lo que ve ahora
      const N = 120, sight = this.sightOf(a);
      for (let i = 0; i <= N; i++) {
        const ang = -Math.PI + (i / N) * Math.PI * 2;
        const R = Math.abs(angDiff(a.look, ang)) <= FOV / 2 ? sight : 2.4;
        let d = 0.3;
        while (d < R && !this.isSolid(Math.floor(a.x + Math.cos(ang) * d), Math.floor(a.y + Math.sin(ang) * d))) d += 0.14;
        const px = (a.x + Math.cos(ang) * Math.min(d, R) - left) * ts, py = (a.y + Math.sin(ang) * Math.min(d, R) - top) * ts;
        if (i === 0) f.moveTo(px, py); else f.lineTo(px, py);
      }
      f.closePath(); f.fill();
      f.globalCompositeOperation = 'source-over';
      x.drawImage(this.fog, 0, 0, cw, ch);
    }
    /** Punto láser opcional: muestra hacia dónde apunta cada soldado y cuánto se le abre la puntería. */
    drawLasers(x, list) {
      const ts = this.ts;
      for (const s of list) {
        if (!s.target || s.cur === 'knife') continue;
        const def = this.defOf(s), ca = Math.cos(s.angle), sa = Math.sin(s.angle);
        let d = 0.5;
        while (d < def.range && !this.isSolid(Math.floor(s.x + ca * d), Math.floor(s.y + sa * d))) d += 0.2;
        const ex = (s.x + ca * d) * ts, ey = (s.y + sa * d) * ts;
        x.strokeStyle = 'rgba(255,60,60,.5)'; x.lineWidth = Math.max(1, ts * 0.05);
        x.beginPath(); x.moveTo((s.x + ca * 0.6) * ts, (s.y + sa * 0.6) * ts); x.lineTo(ex, ey); x.stroke();
        x.fillStyle = 'rgba(255,70,70,.9)'; x.beginPath(); x.arc(ex, ey, Math.max(1.5, ts * 0.09), 0, 6.283); x.fill();
        const sp = def.spread * this.aimMul(s) + s.bloom;                        // la dispersión actual, como un abanico
        x.strokeStyle = 'rgba(255,200,80,.22)';
        for (const sg of [-1, 1]) {
          const a2 = s.angle + sg * sp, len = Math.min(d, 7);
          x.beginPath(); x.moveTo((s.x + ca * 0.6) * ts, (s.y + sa * 0.6) * ts); x.lineTo((s.x + Math.cos(a2) * len) * ts, (s.y + Math.sin(a2) * len) * ts); x.stroke();
        }
      }
    }

    drawMini(x) {
      const k = this.miniK, mw = this.mini.width, mh = this.mini.height, ox = this.cw - mw - 6, oy = this.padOn ? 70 : this.ch - mh - 6;
      x.globalAlpha = 0.9; x.drawImage(this.mini, ox, oy); x.globalAlpha = 1;
      for (const s of this.soldiers) {
        if (!s.alive) continue;
        x.fillStyle = s.color; x.beginPath(); x.arc(ox + s.x * k, oy + s.y * k, Math.max(1.8, k * 0.55), 0, 6.283); x.fill();
        if (this.focus === s || this.followId === s.id) { x.strokeStyle = '#fff'; x.lineWidth = 1; x.stroke(); }
      }
      x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 1;
      x.strokeRect(ox + (this.camX - this.cw / this.ts / 2) * k, oy + (this.camY - this.ch / this.ts / 2) * k, (this.cw / this.ts) * k, (this.ch / this.ts) * k);
    }

    drawZone(x) {
      const z = this.zone, ts = this.ts, W = this.W, H = this.H;
      x.fillStyle = 'rgba(255,40,60,.22)';
      x.fillRect(0, 0, W * ts, z.y0 * ts);
      x.fillRect(0, z.y1 * ts, W * ts, (H - z.y1) * ts);
      x.fillRect(0, z.y0 * ts, z.x0 * ts, (z.y1 - z.y0) * ts);
      x.fillRect(z.x1 * ts, z.y0 * ts, (W - z.x1) * ts, (z.y1 - z.y0) * ts);
      x.strokeStyle = 'rgba(255,80,90,.9)'; x.lineWidth = 2; x.setLineDash([8, 6]); x.lineDashOffset = -(this.time * 30);
      x.strokeRect(z.x0 * ts, z.y0 * ts, (z.x1 - z.x0) * ts, (z.y1 - z.y0) * ts); x.setLineDash([]);
    }

    drawPowerup(x, p) {
      const ts = this.ts, cx = p.x * ts, cy = p.y * ts, col = PU_COLOR[p.type];
      const pulse = 1 + Math.sin(p.t * 5) * 0.08, r = ts * 0.34 * pulse;
      x.save(); x.translate(cx, cy);
      x.fillStyle = col; x.globalAlpha = 0.22; x.beginPath(); x.arc(0, 0, r * 1.5, 0, 6.283); x.fill(); x.globalAlpha = 1;
      x.fillStyle = '#0d1220'; x.strokeStyle = col; x.lineWidth = Math.max(2, ts * 0.09);
      x.beginPath(); x.arc(0, 0, r, 0, 6.283); x.fill(); x.stroke();
      x.fillStyle = col; x.strokeStyle = col; x.lineWidth = Math.max(1.5, ts * 0.07); x.lineJoin = 'round';
      const u = r * 0.55;
      if (p.type === 'shield') {
        x.beginPath(); x.moveTo(0, -u); x.lineTo(u, -u * 0.55); x.lineTo(u * 0.8, u * 0.4); x.lineTo(0, u); x.lineTo(-u * 0.8, u * 0.4); x.lineTo(-u, -u * 0.55); x.closePath(); x.fill();
      } else if (p.type === 'speed') {
        x.beginPath(); x.moveTo(u * 0.25, -u); x.lineTo(-u * 0.6, u * 0.15); x.lineTo(0, u * 0.15); x.lineTo(-u * 0.25, u); x.lineTo(u * 0.6, -u * 0.15); x.lineTo(0, -u * 0.15); x.closePath(); x.fill();
      } else {
        x.beginPath(); x.moveTo(0, u * 0.9); x.bezierCurveTo(-u * 1.4, -u * 0.1, -u * 0.5, -u * 1.1, 0, -u * 0.3); x.bezierCurveTo(u * 0.5, -u * 1.1, u * 1.4, -u * 0.1, 0, u * 0.9); x.fill();
      }
      x.restore();
    }

    drawLabel(x, s) {
      const ts = this.ts, cx = s.x * ts, top = s.y * ts - ts * 0.4 * s.ap.build * 1.95 - 3;
      // una barrita por cada vida; la que se está gastando se va vaciando
      const lives = Math.ceil(s.maxHp / HPL) + (s.hp > s.maxHp ? 1 : 0);
      const pw = Math.max(5, ts * 0.22), gap = 1.5, wTot = lives * pw + (lives - 1) * gap;
      for (let i = 0; i < lives; i++) {
        const px = cx - wTot / 2 + i * (pw + gap), f = clamp01((s.hp - i * HPL) / HPL);
        x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(px, top - 3, pw, 3);
        x.fillStyle = f > 0.35 ? '#ff4d6a' : '#ffb347'; x.fillRect(px, top - 3, pw * f, 3);
      }
      if (s.reloadT > 0) {                                     // barrita amarilla de recarga
        x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(cx - wTot / 2, top - 8, wTot, 3);
        x.fillStyle = '#facc15'; x.fillRect(cx - wTot / 2, top - 8, wTot * (1 - s.reloadT / Math.max(0.01, s.reloadTot)), 3);
      }
      const fs = Math.max(9, Math.min(14, ts * 0.5));
      x.font = `800 ${fs}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'bottom';
      x.lineWidth = 3.2; x.strokeStyle = 'rgba(0,0,0,.85)'; x.lineJoin = 'round';
      const ny = top - (s.reloadT > 0 ? 10 : 5);
      x.strokeText(s.name, cx, ny); x.fillStyle = '#fff'; x.fillText(s.name, cx, ny);
      if (s.photoImg && s.photoImg.complete && s.photoImg.naturalWidth) {                 // foto del compañero, redonda, al lado del nombre
        const tw = x.measureText(s.name).width, r = fs * 0.75, ax = cx - tw / 2 - r - 3, ay = ny - fs * 0.5;
        x.save(); x.beginPath(); x.arc(ax, ay, r, 0, 6.283); x.clip(); x.drawImage(s.photoImg, ax - r, ay - r, r * 2, r * 2); x.restore();
        x.strokeStyle = s.color; x.lineWidth = 2; x.beginPath(); x.arc(ax, ay, r, 0, 6.283); x.stroke();
      }
      let y0 = ny - fs - 2;
      if (s.icon) {                                            // "?" oyó algo, "!" vio a alguien
        x.font = `900 ${fs + 3}px system-ui, sans-serif`;
        x.fillStyle = s.icon.ch === '!' ? '#ff5a5a' : '#ffd24a'; x.strokeText(s.icon.ch, cx, y0); x.fillText(s.icon.ch, cx, y0);
        y0 -= fs + 2;
      }
      if (s.bubble) {                                          // globo de texto (insultos)
        const bf = Math.max(9, Math.min(12, ts * 0.44));
        x.font = `700 ${bf}px system-ui, sans-serif`;
        const tw = x.measureText(s.bubble.text).width, bw = tw + 10, bh = bf + 8;
        const by = y0 - bh;
        x.globalAlpha = Math.min(1, s.bubble.t * 3);
        x.fillStyle = '#fff'; x.beginPath(); x.roundRect(cx - bw / 2, by, bw, bh, 7); x.fill();
        x.beginPath(); x.moveTo(cx - 4, by + bh); x.lineTo(cx, by + bh + 5); x.lineTo(cx + 4, by + bh); x.fill();
        x.fillStyle = '#111'; x.textBaseline = 'middle'; x.fillText(s.bubble.text, cx, by + bh / 2 + 0.5);
        x.globalAlpha = 1;
      }
    }
  }

  /* ================= interfaz ================= */
  const IQ = Personas.IQ;
  const openRows = new Set();                                 // soldados con el panel de detalles abierto
  let game = null;
  let wakeLock = null;
  const hud = $('#hudPlayers');
  const feed = $('#feed');
  const zoneInfo = $('#zoneInfo');
  let chips = [];
  let onMatchEnd = null;                                      // el torneo se engancha acá para recibir el resultado
  B.lives = Math.min(3, +B.lives || 3);                       // máximo 3 vidas

  /** Recorta la foto al centro, la achica a 96×96 y la guarda como texto (queda en este celular). */
  function readPhoto(file, cb) {
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const S = Math.min(im.width, im.height), c = document.createElement('canvas'); c.width = c.height = 96;
        c.getContext('2d').drawImage(im, (im.width - S) / 2, (im.height - S) / 2, S, S, 0, 0, 96, 96);
        cb(c.toDataURL('image/jpeg', 0.82));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  function renderRoster() {
    const box = $('#battleRoster');
    box.innerHTML = '';
    const tm = B.teamMode === 'teams';
    state.players.forEach((p, i) => {
      const row = el('div', { class: 'srow' },
        el('input', { type: 'color', value: p.color, 'aria-label': `Color del soldado ${i + 1}`, oninput: (e) => { p.color = e.target.value; save(); } }),
        el('input', {
          class: 'name', type: 'text', maxlength: 14, placeholder: `Jugador ${i + 1}`, value: p.name || '', 'aria-label': `Nombre del soldado ${i + 1}`,
          oninput: (e) => { p.name = e.target.value; save(); },
        }),
      );
      if (tm) {
        const t = Math.min(p.team || 0, B.teamCount - 1);
        p.team = t;
        row.append(el('button', {
          class: 'team-btn', style: `background:${TEAMS[t].color}`, 'aria-label': 'Cambiar de equipo',
          onclick: () => { p.team = ((p.team || 0) + 1) % B.teamCount; save(); renderRoster(); },
        }, TEAMS[t].name.slice(0, 3)));
      }
      const pe = p.pers && p.pers !== 'auto' && PERS[p.pers] ? PERS[p.pers].emoji : '⚙️';
      row.append(el('button', {
        class: 'gear-btn' + (openRows.has(p.id) ? ' on' : ''), 'aria-label': 'Personalidad e inteligencia', title: 'Personalidad e inteligencia',
        onclick: () => { if (openRows.has(p.id)) openRows.delete(p.id); else openRows.add(p.id); renderRoster(); },
      }, `${pe}${IQ[p.iq == null ? 1 : p.iq].emoji}`));
      row.append(el('button', { class: 'rm', 'aria-label': 'Quitar', onclick: () => { if (state.players.length > 2) { state.players.splice(i, 1); save(); renderRoster(); } } }, '✕'));
      const wrapRow = el('div', { class: 'srowwrap' }, row);
      if (openRows.has(p.id)) {
        const desc = el('p', { class: 'hint' });
        const paintDesc = () => { desc.textContent = (p.pers && p.pers !== 'auto' && PERS[p.pers] ? PERS[p.pers].desc + ' · ' : 'Se sortea al empezar. · ') + 'Inteligencia: ' + IQ[p.iq == null ? 1 : p.iq].label + '.'; };
        const select = el('select', { 'aria-label': 'Personalidad', onchange: (e) => { p.pers = e.target.value; save(); renderRoster(); } },
          el('option', { value: 'auto' }, '🎲 Al azar'),
          Object.entries(PERS).map(([k, v]) => el('option', Object.assign({ value: k }, p.pers === k ? { selected: true } : {}), `${v.emoji} ${v.label}`)));
        const seg = el('div', { class: 'seg small' }, IQ.map((q, qi) => el('button', {
          class: (p.iq == null ? 1 : p.iq) === qi ? 'on' : '', title: q.label, 'aria-label': q.label,
          onclick: () => { p.iq = qi; save(); renderRoster(); },
        }, `${q.emoji} ${q.label}`)));
        paintDesc();
        const hatSel = el('select', { 'aria-label': 'Gorro', onchange: (e) => { p.hat = e.target.value; save(); } },
          Object.entries(App.HATS).map(([k, v]) => el('option', Object.assign({ value: k }, (p.hat || 'none') === k ? { selected: true } : {}), v)));
        const file = el('input', { type: 'file', accept: 'image/*', hidden: true, onchange: (e) => {
          const f = e.target.files && e.target.files[0]; if (!f) return;
          if (!confirm('¿Esta persona está de acuerdo con que uses su foto? Se guarda solo en este celular y no se sube a ningún lado.')) { e.target.value = ''; return; }
          readPhoto(f, (url) => { p.photo = url; save(); renderRoster(); });
        } });
        const photoRow = el('div', {}, el('div', { class: 'sel' }, 'Foto (opcional)'),
          el('div', { class: 'photo-row' },
            p.photo ? el('img', { class: 'ava big', src: p.photo, alt: '' }) : el('span', { class: 'ava big empty' }, '👤'),
            el('button', { class: 'btn small', onclick: () => file.click() }, p.photo ? '📷 Cambiar' : '📷 Poner foto'),
            p.photo ? el('button', { class: 'btn small ghost', onclick: () => { p.photo = null; save(); renderRoster(); } }, 'Quitar') : '', file),
          el('p', { class: 'hint' }, 'Usá la foto solo si esa persona está de acuerdo. Queda guardada en este celular y se ve en las fichas, el podio y sobre el soldado.'));
        const phrasesBox = el('label', { class: 'sel' }, 'Frases propias (una por línea; {n} = nombre del enemigo)',
          el('textarea', { class: 'mono', rows: 3, maxlength: 300, placeholder: 'Ej: ¡Te voy a dejar sin café, {n}!', oninput: (e) => { p.phrases = e.target.value; save(); } }, p.phrases || ''));
        const betSel = el('label', { class: 'sel' }, '🎯 Apuesto a que gana… (los aciertos suman a tu marcador)',
          el('select', { 'aria-label': 'Apuesta', onchange: (e) => { p.bet = e.target.value === '' ? null : +e.target.value; save(); } },
            el('option', { value: '' }, 'Nadie'),
            state.players.map((q, j) => el('option', Object.assign({ value: q.id }, p.bet === q.id ? { selected: true } : {}), pname(q, j)))));
        const roleSel = el('select', { 'aria-label': 'Rol', onchange: (e) => { p.role = e.target.value; save(); renderRoster(); } },
          Object.entries(App.Modes.ROLES).map(([k, v]) => el('option', Object.assign({ value: k }, (p.role || 'none') === k ? { selected: true } : {}), `${v.emoji} ${v.label}`)));
        wrapRow.append(el('div', { class: 'sdet' }, el('label', { class: 'sel' }, 'Personalidad', select), el('div', {}, el('div', { class: 'sel' }, 'Inteligencia'), seg),
          el('label', { class: 'sel' }, 'Rol', roleSel), el('p', { class: 'hint' }, App.Modes.ROLES[p.role || 'none'].desc),
          el('label', { class: 'sel' }, 'Gorro', hatSel), photoRow, phrasesBox, betSel,
          el('label', { class: 'switch' }, el('input', Object.assign({ type: 'checkbox', onchange: (e) => { state.players.forEach((q) => { q.manual = false; }); p.manual = e.target.checked; save(); renderRoster(); } }, p.manual ? { checked: true } : {})), el('span', {}, '🎮 Lo manejo yo con el joystick (los demás siguen solos)')), desc));
      }
      box.append(wrapRow);
    });
    $('#soldierCount').textContent = `${state.players.length}/${App.MAX_PLAYERS}`;
    $('#btnAddSoldier').disabled = state.players.length >= App.MAX_PLAYERS;
    $('#btnRandomTeams').hidden = !tm;
    $('#teamCountBox').hidden = !tm;
  }

  /* ----- tabla de victorias ----- */
  function weekStart() {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  }
  function renderBets() {
    const box = $('#betTable'); if (!box) return;
    const since = B.winRange === 'week' ? weekStart() : 0, tally = new Map();
    (B.betLog || []).filter((b) => b.t >= since).forEach((b) => { const t = tally.get(b.name) || [0, 0]; t[1]++; if (b.ok) t[0]++; tally.set(b.name, t); });
    box.innerHTML = '';
    const rows = [...tally.entries()].sort((a, b) => b[1][0] - a[1][0] || a[1][1] - b[1][1]);
    if (!rows.length) return;
    box.append(el('div', { class: 'sect-title' }, '🎯 Mejores apostadores'));
    rows.forEach(([n, [ok, tot]], i) => box.append(el('div', { class: 'wrow' }, el('span', {}, `${i === 0 ? '🔮 ' : ''}${n}`), el('span', { class: 'n' }, `${ok}/${tot} aciertos`))));
  }
  function renderWins() {
    const box = $('#winTable');
    renderBets();
    const since = B.winRange === 'week' ? weekStart() : 0;
    const tally = new Map();
    B.wins.filter((w) => w.t >= since).forEach((w) => w.names.forEach((n) => tally.set(n, (tally.get(n) || 0) + 1)));
    const rows = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    box.innerHTML = '';
    if (!rows.length) { box.append(el('div', { class: 'empty' }, 'Todavía no hay victorias. ¡A pelear!')); return; }
    rows.forEach(([n, c], i) => {
      const pl = state.players.find((p, k) => pname(p, k) === n);
      box.append(el('div', { class: 'wrow' },
        el('span', { class: 'dot', style: `background:${pl ? pl.color : '#888'}` }),
        el('span', {}, `${i === 0 ? '👑 ' : ''}${n}`),
        el('span', { class: 'n' }, `${c} 🏆`)));
    });
  }

  /* ----- juego ----- */
  function buildConfig() {
    const M = App.Modes.defs[B.mode] || App.Modes.defs.classic;
    const tm = B.teamMode === 'teams' || M.team === 'two' || M.team === 'coop';
    const tc = M.team === 'two' ? 2 : B.teamCount;
    const players = state.players.map((p, i) => ({ name: pname(p, i), color: p.color, team: B.teamMode === 'teams' ? Math.min(p.team || 0, tc - 1) : i % tc, pers: p.pers || 'auto', iq: p.iq == null ? 1 : p.iq, id: p.id, role: p.role || 'none', manual: !!p.manual, hat: p.hat || 'none', photo: p.photo || null,
      phrases: String(p.phrases || '').split('\n').map((t) => t.trim()).filter(Boolean).slice(0, 8) }));
    const seed = ($('#seedInput').value || '').trim();
    return { mode: M.key, players, teamMode: tm, lives: Math.min(3, +B.lives || 3), map: B.map, size: B.size, powerups: B.powerups, zone: B.zone, varied: B.varied, loot: B.loot !== false,
      talk: B.talk !== false, laser: !!B.laser, friendly: !!B.friendly, slowmo: B.slowmo !== false, seed: seed || null,
      gear: B.gear !== false, props: B.props !== false, events: B.events !== false, customMap: B.customMap || Maps.SAMPLE };
  }

  async function startGame(cfgOverride) {
    const cfg = cfgOverride && cfgOverride.players ? cfgOverride : buildConfig();
    if (!cfgOverride && cfg.teamMode && cfg.mode !== 'waves' && new Set(cfg.players.map((p) => p.team)).size < 2) {
      alert('Para jugar por equipos tiene que haber soldados en al menos 2 equipos distintos.'); return;
    }
    if (!cfgOverride && cfg.map === 'custom') { const chk = Maps.parse(cfg.customMap); if (chk.error) { alert('Tu mapa no sirve todavía: ' + chk.error); return; } }
    App.ctx();
    applyAudio();
    Personas.setCustom(B.customLines);
    document.body.classList.add('in-game');
    $('#battleSetup').hidden = true; $('#battleGame').hidden = false;
    $('#resultOverlay').hidden = true; $('#pauseOverlay').hidden = true;
    feed.innerHTML = ''; zoneInfo.textContent = '';
    if (game) game.destroy();
    game = new Game($('#battleCanvas'), cfg, { onKill, onPickup, onEnd, onFrame, onEvent: (t) => addFeed(t, 4500) });
    App.game = game;
    $('#pauseSeed').textContent = `Semilla del mapa: ${game.seed}`;
    document.body.classList.remove('pov-on');
    buildHud(game);
    const mine = game.soldiers.find((q) => q.manual);
    if (mine) { game.followId = mine.id; game.padOn = true; }
    paintCam(); paintPad();
    game.start();
    try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { wakeLock = null; }
    announce(game);
  }

  function announce(g) {
    if (!g.cfg.varied) return;
    addFeed(g.soldiers.map((s) => `${PERS[s.pers].emoji} ${s.name}`).join('  ·  '), 5000);
  }
  function applyAudio() { App.setVol((B.volMaster == null ? 100 : B.volMaster) / 100, (B.volShots == null ? 100 : B.volShots) / 100); }

  function leaveGame(toSetup = true) {
    onMatchEnd = null;
    if (game) { game.destroy(); game = null; App.game = null; }
    try { if (wakeLock) wakeLock.release(); } catch (e) { /* nada */ }
    wakeLock = null;
    document.body.classList.remove('in-game');
    $('#battleGame').hidden = true; $('#battleSetup').hidden = false;
    if (toSetup) { renderWins(); window.scrollTo(0, 0); }
  }

  function buildHud(g) {
    hud.innerHTML = '';
    chips = g.soldiers.map((s) => {
      const hp = el('span', { class: 'hp' }), wp = el('span', { class: 'wp' });
      const chip = el('div', {
        class: 'chip', style: s.team >= 0 ? `border-color:${TEAMS[s.team].color}` : '', title: `${s.name} (${PERS[s.pers].label}, ${IQ[s.iq].label}) · tocá para seguirlo (si cayó: repetición)`,
        onclick: () => {
          if (!game) return;
          if (!s.alive && App.Replay) {                                      // ficha de un caído: repetición de cómo murió
            const clip = game.deathClip(s.id), was = game.paused;
            if (clip && App.Replay.play(game, [clip], 'Cómo murió', () => { game.paused = was; })) { game.paused = true; return; }
          }
          game.followId = game.followId === s.id ? null : s.id; game.camMode = 'auto'; game.setScale(); paintCam();
        },
      }, s.photo ? el('img', { class: 'ava', src: s.photo, alt: '', style: `border-color:${s.color}` }) : el('span', { class: 'dot', style: `background:${s.color}` }),
      el('span', { class: 'nm' }, (g.cfg.varied ? PERS[s.pers].emoji + ' ' : '') + s.name), hp, wp);
      hud.append(chip);
      return { chip, hp, wp, last: '' };
    });
  }

  function paintCam() {
    const b = $('#btnCam'); if (!game) return;
    b.textContent = game.camMode === 'full' ? '🗺️ Todo' : game.followId != null ? '👁️ Sigue' : '🎥 Auto';
    chips.forEach((c, i) => c.chip.classList.toggle('follow', game.followId === i));
    $('#btnPov').classList.toggle('primary', game.pov);
    document.body.classList.toggle('pov-on', !!game.pov);
  }

  function addFeed(text, ms = 3800) {
    const d = el('div', {}, text);
    feed.append(d);
    while (feed.children.length > 3) feed.firstChild.remove();
    setTimeout(() => d.remove(), Math.min(ms, 3200));
  }
  function onKill(s, by, zone) {
    if (zone) addFeed(`🔥 ${s.name} cayó fuera de la zona`);
    else if (!by) addFeed(`💥 ${s.name} murió en una explosión`);
    else addFeed(`💥 ${by.name} eliminó a ${s.name}`);
  }
  function onPickup(s, label) { addFeed(`✨ ${s.name} agarró ${label}`, 2500); }

  /** Equipo que lleva: granadas, chaleco, casco, botiquines, mochila. */
  function gearLine(s) {
    if (!s.alive) return '';
    const g = s.gren.frag + s.gren.smoke + s.gren.flash;
    return `${g ? '💣' + g : ''}${s.armor.vest > 0 ? '🦺' : ''}${s.armor.helm > 0 ? '⛑️' : ''}${s.meds.length ? '🩹' + s.meds.length : ''}${s.pack ? '🎒' : ''}`;
  }
  function weaponLine(s) {
    if (!s.alive) return '';
    if (s.cur === 'knife') return '🔪 cuchillo';
    const w = s.cur === 'pistol' ? s.inv.pistol : s.inv.primary;
    if (!w) return '';
    return `${WEAPONS[w.type].short} ${w.mag}/${w.res}${s.reloadT > 0 ? ' ⟳' : ''}`;
  }

  function onFrame(g) {
    const mine = g.soldiers.find((q) => q.manual && q.alive);
    if (!!mine !== g.padOn) { g.padOn = !!mine; paintPad(); }
    g.soldiers.forEach((s, i) => {
      const c = chips[i]; if (!c) return;
      const gear = gearLine(s), key = `${s.alive ? Math.ceil(s.hp / HPL) : -1}|${weaponLine(s)}|${gear}`;
      if (c.last !== key) {
        c.last = key; c.hp.textContent = s.alive ? '♥'.repeat(Math.max(0, Math.ceil(s.hp / HPL))) : '✖';
        if (s.alive && gear) c.hp.append(el('span', { class: 'gear' }, gear));
        c.wp.textContent = weaponLine(s);
        c.chip.classList.toggle('dead', !s.alive);
      }
    });
    if (g.phase === 'run') {
      const left = Math.ceil(g.zoneDelay - g.time), bits = [];
      if (g.eventText) bits.push(g.eventText);
      const mt = g.modeText(); if (mt) bits.push(mt);
      if (g.cfg.zone) bits.push(left > 0 ? `⚠️ Zona en ${left}s` : g.time < g.zoneDelay + g.zoneTime ? '🔴 Zona achicándose' : '🔴 Zona final');
      zoneInfo.textContent = bits.join('\n');
    } else zoneInfo.textContent = '';
  }

  function onEnd(res) {
    sfx.fanfare(); vibrate([60, 60, 120]);
    const tourn = onMatchEnd; onMatchEnd = null;
    if (tourn) { res.tourn = true; try { tourn(res); } catch (e) { /* el torneo no debe romper el final */ } }
    else {
      const names = res.winners.map((s) => s.name);
      if (names.length) { B.wins.push({ t: Date.now(), names }); if (B.wins.length > 1000) B.wins.shift(); }
      res.bets = settleBets(res);
      save();
    }
    try { res.unlocked = App.Hist ? App.Hist.record(res) : []; } catch (e) { res.unlocked = []; }
    showResult(res);
  }

  /** Apuestas: cada compañero puede apostar a quién gana; los aciertos suman a su marcador. */
  function settleBets(res) {
    if (res.mode === 'waves') return [];
    const out = [];
    state.players.forEach((p, i) => {
      if (p.bet == null) return;
      const target = state.players.find((q) => q.id === p.bet); if (!target) return;
      const ok = res.winners.some((w) => w.pid === p.bet);
      if (!res.winners.length) return;
      p.hits = (p.hits || 0) + (ok ? 1 : 0);
      (B.betLog = B.betLog || []).push({ t: Date.now(), name: pname(p, i), ok });
      if (B.betLog.length > 500) B.betLog.shift();
      out.push({ name: pname(p, i), on: pname(target, state.players.indexOf(target)), ok });
    });
    return out;
  }

  /** Premios graciosos según lo que hizo cada uno durante la partida. */
  function computeAwards(rk) {
    const out = [];
    const best = (fn, min = 0) => {
      let b = null, bv = -1;
      rk.forEach((s) => { const v = fn(s); if (v > bv) { bv = v; b = s; } });
      return bv > min ? [b, bv] : null;
    };
    let r;
    if ((r = best((s) => s.kills * 100 + s.stats.dmgDealt + (s.alive ? 60 : 0)))) out.push(['🏅', 'MVP', r[0], `${r[0].kills} bajas, ${Math.round(r[0].stats.dmgDealt)} de daño`]);
    if ((r = best((s) => s.stats.dmgDealt, 50))) out.push(['💥', 'El que más daño hizo', r[0], `${Math.round(r[1])} puntos`]);
    if ((r = best((s) => s.stats.rounds >= 12 ? (s.stats.hits / s.stats.rounds) * 100 : 0, 15))) out.push(['🎯', 'El más preciso', r[0], `${Math.round(r[1])}% de las balas`]);
    if ((r = best((s) => s.stats.longKill, 8))) out.push(['🔭', 'El disparo más lejano', r[0], `${r[1].toFixed(0)} casilleros`]);
    if ((r = best((s) => s.stats.knifeKills, 0))) out.push(['🔪', 'Rey del cuchillo', r[0], `${r[1]} bajas a puñaladas`]);
    if ((r = best((s) => s.stats.fled + s.stats.hidden * 0.5, 12))) out.push(['🐔', 'El más cobarde', r[0], `${Math.round(r[0].stats.hidden + r[0].stats.fled)}s escondido o huyendo`]);
    if ((r = best((s) => s.stats.talk, 3))) out.push(['🗣️', 'El más bocón', r[0], `${r[1]} insultos`]);
    if ((r = best((s) => s.stats.dist, 20))) out.push(['🏃', 'El que más caminó', r[0], `${Math.round(r[1])} casilleros`]);
    if ((r = best((s) => s.stats.shared, 0))) out.push(['🤝', 'El más generoso', r[0], `${r[1]} balas pasadas`]);
    if ((r = best((s) => s.stats.thrown, 1))) out.push(['💣', 'Rey de las granadas', r[0], `${r[1]} lanzadas`]);
    if ((r = best((s) => s.stats.absorbed, 60))) out.push(['🦺', 'El más blindado', r[0], `${Math.round(r[1])} de daño frenado`]);
    if ((r = best((s) => s.stats.healed, 60))) out.push(['🩹', 'El más curado', r[0], `${Math.round(r[1])} de vida recuperada`]);
    return out.slice(0, 8);
  }

  function showResult(res) {
    const ov = $('#resultOverlay');
    const win = res.winners, tm = res.teamMode;
    const rk = res.ranking;
    const mins = Math.floor(res.time / 60), secs = Math.round(res.time % 60);
    const dur = mins ? `${mins}m ${secs}s` : `${secs}s`;
    let title, sub;
    if (res.title) { title = res.title; sub = res.sub || ''; }
    else if (!win.length) { title = '🤝 ¡Empate!'; sub = 'Nadie quedó en pie.'; }
    else if (tm) { title = `🏆 ¡Gana el equipo ${TEAMS[win[0].team].name}!`; sub = win.map((s) => s.name).join(', '); }
    else { title = `🏆 ¡Gana ${win[0].name}!`; sub = `${win[0].kills} eliminaciones · ${dur} de batalla`; }

    if (res.coinTie) sub = '🪙 Lo definió la moneda';
    const podium = el('div', { class: 'podium' });
    [rk[1], rk[0], rk[2]].forEach((s, k) => {
      if (!s) return;
      podium.append(el('div', { class: 'slot' },
        s.photo ? el('img', { class: 'ava big', src: s.photo, alt: '', style: `border-color:${s.color}` }) : el('div', { class: 'sdot', style: `background:${s.color}` }),
        el('div', { class: 'who' }, s.name),
        el('div', { class: 'block', style: `height:${[70, 100, 52][k]}px;background:${['#c0c7d6', '#f0c04a', '#cd8b4f'][k]}` }, [2, 1, 3][k])));
    });

    const list = el('div', { class: 'rank-list' });
    rk.forEach((s, i) => {
      const acc = s.stats.rounds ? Math.round((s.stats.hits / s.stats.rounds) * 100) : 0;
      list.append(el('div', {},
        el('span', {}, `${i + 1}.`), s.photo ? el('img', { class: 'ava', src: s.photo, alt: '', style: `border-color:${s.color}` }) : el('span', { class: 'dot', style: `background:${s.color}` }),
        el('span', {}, `${PERS[s.pers].emoji}${IQ[s.iq].emoji} ${s.name}`),
        el('span', { class: 'k' }, `${s.kills}💥 · ${Math.round(s.stats.dmgDealt)}❤ · ${acc}%${win.includes(s) ? ' · ganó' : ''}`)));
    });

    const scoreBox = res.scores && res.scores.length ? el('div', { class: 'awards' }, res.scores.map((r) => el('div', {}, el('span', { class: 'dot', style: `background:${r.color}` }), ` ${r.name}: `, el('b', {}, r.value)))) : null;
    const awards = computeAwards(rk);
    const awardBox = el('div', { class: 'awards' }, awards.map(([ico, name, who, detail]) =>
      el('div', {}, `${ico} ${name}: `, el('b', {}, who.name), ` (${detail})`)));

    const seedBtn = el('button', {
      class: 'seed-btn', title: 'Copiar la semilla',
      onclick: (e) => { try { navigator.clipboard.writeText(String(res.seed)); e.target.textContent = '✅ Copiada'; } catch (err) { e.target.textContent = String(res.seed); } },
    }, `🌱 Semilla ${res.seed} · tocá para copiar`);

    const unl = res.unlocked && res.unlocked.length ? el('div', { class: 'awards' }, res.unlocked.map((u) => el('div', {}, '🏅 ', el('b', {}, u.name), ': ' + u.items.map((a) => `${a.emoji} ${a.name}`).join(', ')))) : null;
    const betBox = res.bets && res.bets.length ? el('div', { class: 'awards' }, res.bets.map((b) => el('div', {}, `${b.ok ? '✅' : '❌'} `, el('b', {}, b.name), ` apostó a ${b.on}${b.ok ? ' y acertó (+1)' : ''}`))) : null;
    const tieIdx = !win.length && !res.tourn ? (res.tied && res.tied.length > 1 ? res.tied : (rk.length > 1 ? [[rk[0]], [rk[1]]] : null)) : null;
    const tieBtn = tieIdx && App.Tourney ? el('button', { class: 'btn primary wide', onclick: async () => {
      const w = await App.Tourney.coinBreak(tieIdx);                   // la moneda decide (Milei vs Cristina)
      res.winners = w; res.title = null; res.sub = `🪙 Lo definió la moneda`; res.coinTie = true;
      B.wins.push({ t: Date.now(), names: w.map((s) => s.name) }); res.bets = settleBets(res); save(); showResult(res);
    } }, '🪙 Desempatar con la moneda') : '';
    const rp = res.replay, canRp = rp && rp.last && App.Replay;
    const watch = (clips, title) => { ov.hidden = true; if (!App.Replay.play(game, clips, title, () => { ov.hidden = false; })) ov.hidden = false; };
    const rpBtns = canRp ? el('div', { class: 'res-btns' },
      el('button', { class: 'btn', onclick: () => watch([rp.last], 'Último tiro') }, '🎬 Último tiro'),
      rp.best.length > 1 ? el('button', { class: 'btn', onclick: () => watch(rp.best, 'Mejores momentos') }, '⭐ Mejores momentos') : '') : '';
    ov.innerHTML = '';
    ov.append(el('div', { class: 'overlay-box' },
      el('h2', { class: 'win-title' }, title), el('p', { class: 'win-sub' }, sub), podium,
      scoreBox ? el('div', { class: 'sect-title' }, 'Marcador') : '', scoreBox || '',
      betBox ? el('div', { class: 'sect-title' }, '🎯 Apuestas') : '', betBox || '',
      unl ? el('div', { class: 'sect-title' }, '¡Medallas nuevas!') : '', unl || '',
      tieBtn,
      el('div', { class: 'sect-title' }, 'Premios'), awardBox,
      el('div', { class: 'sect-title' }, 'Posiciones (bajas · daño · puntería)'), list,
      rpBtns,
      seedBtn,
      res.tourn ? el('div', { class: 'res-btns' }, el('button', { class: 'btn primary wide', onclick: () => { leaveGame(true); App.Tourney.open(); } }, '➡️ Volver al torneo')) :
      el('div', { class: 'res-btns' },
        el('button', { class: 'btn primary wide', onclick: () => startGame() }, '🔁 Revancha'),
        el('button', { class: 'btn', onclick: () => leaveGame(true) }, '⚙️ Cambiar'),
        el('button', { class: 'btn', onclick: () => { leaveGame(true); App.go('menu'); } }, 'Menú'))));
    ov.hidden = false;
  }

  /* ----- controles ----- */
  function setPause(p) {
    if (!game || game.phase === 'done') return;
    game.paused = p; $('#pauseOverlay').hidden = !p; $('#btnPause').textContent = p ? '▶' : '⏸';
  }
  $('#btnPause').addEventListener('click', () => setPause(!(game && game.paused)));
  $('#btnResume').addEventListener('click', () => setPause(false));
  const quit = () => { if (game && game.phase !== 'done' && !confirm('¿Salir de la partida?')) return; leaveGame(true); };
  $('#btnQuit').addEventListener('click', () => leaveGame(true));
  $('#btnQuit2').addEventListener('click', quit);
  $('#btnCam').addEventListener('click', () => {
    if (!game) return;
    if (game.camMode === 'full') { game.camMode = 'auto'; game.followId = null; } else if (game.followId != null) game.followId = null; else game.camMode = 'full';
    game.setScale(); paintCam();
  });
  $('#btnPov').addEventListener('click', () => {
    if (!game) return;
    if (game.pov) game.pov = false;
    else {                                                     // ver por los ojos del soldado seguido (o del que muestra la cámara)
      if (game.followId == null) { const f = game.focus && game.focus.alive ? game.focus : game.soldiers.find((q) => q.alive); game.followId = f ? f.id : null; }
      if (game.followId == null) return;
      game.camMode = 'auto'; game.pov = true; game.setScale();
    }
    paintCam();
  });
  /* ----- control manual: joystick, botones y teclado ----- */
  const pad = $('#manualPad'), joy = $('#joy'), knob = $('#joyKnob');
  function paintPad() {
    const mine = game && game.soldiers.some((q) => q.manual && q.alive);
    pad.hidden = !mine;
    $('#btnManual').classList.toggle('primary', !!(game && game.soldiers.some((q) => q.manual)));
    if (!mine && game) { game.ctl.mx = game.ctl.my = 0; game.ctl.fire = false; knob.style.transform = ''; }
  }
  $('#btnManual').addEventListener('click', () => {
    if (!game || game.phase === 'done') return;
    const cur = game.soldiers.find((q) => q.manual);
    game.soldiers.forEach((q) => { q.manual = false; });
    if (!cur) {
      let t = game.followId != null ? game.soldiers[game.followId] : null;
      if (!t || !t.alive || t.bot) t = game.focus && game.focus.alive && !game.focus.bot ? game.focus : game.soldiers.find((q) => q.alive && !q.bot);
      if (t) { t.manual = true; game.followId = t.id; game.camMode = 'auto'; game.pov = false; game.setScale(); }
    }
    game.padOn = game.soldiers.some((q) => q.manual && q.alive);
    paintCam(); paintPad();
  });
  const joyMove = (e) => {
    if (!game) return;
    const r = joy.getBoundingClientRect(), R = r.width / 2;
    let dx = (e.clientX - (r.left + R)) / R, dy = (e.clientY - (r.top + R)) / R;
    const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    game.ctl.mx = dx; game.ctl.my = dy;
    knob.style.transform = `translate(${dx * R * 0.7}px, ${dy * R * 0.7}px)`;
  };
  let joyOn = false;
  const capture = (el2, e) => { try { el2.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ } };
  joy.addEventListener('pointerdown', (e) => { capture(joy, e); joyOn = true; joyMove(e); e.preventDefault(); });
  joy.addEventListener('pointermove', (e) => { if (joyOn) joyMove(e); });
  const joyEnd = () => { joyOn = false; if (game) { game.ctl.mx = 0; game.ctl.my = 0; } knob.style.transform = ''; };
  joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
  const fireBtn = $('#padFire');
  fireBtn.addEventListener('pointerdown', (e) => { capture(fireBtn, e); if (game) game.ctl.fire = true; fireBtn.classList.add('hold'); e.preventDefault(); });
  const fireEnd = () => { if (game) game.ctl.fire = false; fireBtn.classList.remove('hold'); };
  fireBtn.addEventListener('pointerup', fireEnd); fireBtn.addEventListener('pointercancel', fireEnd);
  [['padReload', 'reload'], ['padSwap', 'swap'], ['padNade', 'nade'], ['padHeal', 'heal']].forEach(([id, k]) => $('#' + id).addEventListener('click', () => { if (game) game.manualAction(k); }));
  const keys = new Set();
  const MOVEK = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  const keyCtl = (k) => {
    if (!game) return;
    const c = game.ctl;
    if (MOVEK.includes(k)) {
      c.mx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      c.my = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    } else if (k === ' ' || k === 'f') c.fire = keys.has(' ') || keys.has('f');
    else if (k === 'shift') c.sneak = keys.has('shift');
  };
  const KEYACT = { r: 'reload', q: 'swap', g: 'nade', h: 'heal' };
  window.addEventListener('keydown', (e) => {
    if (!game || !game.soldiers.some((q) => q.manual && q.alive) || /INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
    const k = e.key.toLowerCase();
    if (KEYACT[k]) { game.manualAction(KEYACT[k]); return; }
    if (MOVEK.concat([' ', 'f', 'shift']).includes(k)) { keys.add(k); keyCtl(k); e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); keys.delete(k); keyCtl(k); });

  document.addEventListener('visibilitychange', () => { if (document.hidden && game && game.phase === 'run') setPause(true); });

  bindSeg('segSpeed', () => B.speed, (v) => { B.speed = +v; if (game) game.speed = +v; });
  /** Se llama desde modes.js, cuando ya existe la lista de modos. */
  function initModeUI() {
    const modeSeg = $('#segGameMode');
    App.Modes.LIST.forEach((m) => modeSeg.append(el('button', { 'data-v': m.key, title: m.label }, `${m.emoji} ${m.label}`)));
    const modeDesc = () => {
      const M = App.Modes.defs[B.mode] || App.Modes.defs.classic;
      $('#modeDesc').textContent = M.desc + (M.team === 'two' ? ' (Se arman 2 equipos solos si no los elegiste.)' : M.team === 'coop' ? ' (Todos en el mismo equipo.)' : '');
      $('#segTeamMode').closest('.card').hidden = M.team === 'coop' || M.team === 'two';
      renderRoster();
    };
    bindSeg('segGameMode', () => B.mode || 'classic', (v) => { B.mode = v; modeDesc(); });
    modeDesc();
  }
  bindSeg('segTeamMode', () => B.teamMode, (v) => { B.teamMode = v; renderRoster(); });
  bindSeg('segTeamCount', () => B.teamCount, (v) => { B.teamCount = +v; renderRoster(); });
  bindSeg('segLives', () => B.lives, (v) => { B.lives = +v; });
  const mapDesc = () => {
    const t = Maps.TYPES.find((m) => m.key === B.map);
    $('#mapDesc').textContent = t ? t.desc : '';
    $('#customMapBox').hidden = B.map !== 'custom';
  };
  bindSeg('segMap', () => B.map, (v) => { B.map = v; mapDesc(); });
  const customMap = $('#customMap');
  customMap.value = B.customMap || Maps.SAMPLE;
  customMap.addEventListener('input', () => { B.customMap = customMap.value; save(); });
  $('#btnMapSample').addEventListener('click', () => { customMap.value = Maps.SAMPLE; B.customMap = Maps.SAMPLE; save(); $('#mapCheckMsg').textContent = ''; });
  $('#btnMapCheck').addEventListener('click', () => {
    const m = Maps.parse(customMap.value), box = $('#mapCheckMsg');
    box.className = 'hint ' + (m.error ? 'maperr' : 'mapok');
    box.textContent = m.error ? '❌ ' + m.error : `✅ Mapa válido: ${m.W}×${m.H}, ${m.props.length} cajones/barriles, ${m.doors.length} puertas, ${m.windows.length} ventanas.`;
  });
  mapDesc();
  bindSeg('segSize', () => B.size, (v) => { B.size = v; });
  bindSeg('segWinRange', () => B.winRange, (v) => { B.winRange = v; renderWins(); });

  [['optPowerups', 'powerups'], ['optZone', 'zone'], ['optVaried', 'varied'], ['optLoot', 'loot'], ['optGear', 'gear'], ['optProps', 'props'], ['optEvents', 'events']].forEach(([id, key]) => {
    const input = $('#' + id); input.checked = ['loot', 'gear', 'props', 'events'].includes(key) ? B[key] !== false : !!B[key];
    input.addEventListener('change', () => { B[key] = input.checked; save(); });
  });

  [['optTalk', 'talk', true], ['optLaser', 'laser', false], ['optFriendly', 'friendly', false], ['optSlowmo', 'slowmo', true]].forEach(([id, key, def]) => {
    const input = $('#' + id); input.checked = B[key] == null ? def : !!B[key];
    input.addEventListener('change', () => { B[key] = input.checked; save(); });
  });
  [['volMaster', 100], ['volShots', 100]].forEach(([id, def]) => {
    const input = $('#' + id); input.value = B[id] == null ? def : B[id];
    input.addEventListener('input', () => { B[id] = +input.value; applyAudio(); save(); });
    input.addEventListener('change', () => { App.sfx.shot('pistol'); });         // para escuchar cómo quedó
  });
  const custom = $('#customLines'); custom.value = B.customLines || '';
  custom.addEventListener('input', () => { B.customLines = custom.value; Personas.setCustom(custom.value); save(); });
  Personas.setCustom(B.customLines);
  applyAudio();
  $('#btnSeedRnd').addEventListener('click', () => { $('#seedInput').value = String(1000 + Math.floor(Math.random() * 9000)); });
  $('#seedInput').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); });

  $('#btnAddSoldier').addEventListener('click', () => {
    if (state.players.length >= App.MAX_PLAYERS) return;
    const p = App.newPlayer(state.players.length);
    const used = new Set(state.players.map((q) => q.color));
    p.color = PALETTE.find((c) => !used.has(c)) || p.color;
    state.players.push(p); save(); renderRoster();
  });
  $('#btnRandomTeams').addEventListener('click', () => {
    shuffle(state.players).forEach((p, i) => { p.team = i % B.teamCount; });
    save(); renderRoster();
  });
  $('#btnFight').addEventListener('click', startGame);
  $('#btnHist').addEventListener('click', () => App.Hist.open(state.players.map((p, i) => pname(p, i))));
  $('#btnResetWins').addEventListener('click', () => { if (confirm('¿Borrar la tabla de victorias?')) { B.wins = []; save(); renderWins(); } });

  App.register('battle', {
    enter() { renderRoster(); renderWins(); },
    leave() { if (game) leaveGame(false); },
  });
  App.battle = { startGame, leaveGame, setMatchHook: (cb) => { onMatchEnd = cb; }, buildConfig, initModeUI, genMap, Game, PERS, WEAPONS, KNIFE, HPL, FOV, ammoOf, angDiff, clamp, clamp01, fitRange, doorClosed, cap, magOf, MED };
})();
