/* Batalla en el laberinto: soldados automáticos, mapas aleatorios, equipos, power-ups y zona. */
'use strict';

(() => {
  const { state, $, $$, el, rnd, rint, shuffle, pname, sfx, vibrate, bindSeg, save, PALETTE, TEAMS } = App;
  const B = state.battle;
  const STEP = 1 / 60;

  /* ================= configuración ================= */
  const PERS = {
    agresivo:      { emoji: '🔥', label: 'agresivo',      speed: 3.0, cd: 0.95, bspeed: 8,  spread: 0.30, pmin: 1.8, pmax: 3.6, strafe: 0.7, range: 9 },
    cauteloso:     { emoji: '🛡️', label: 'cauteloso',     speed: 2.8, cd: 1.15, bspeed: 8,  spread: 0.20, pmin: 4.5, pmax: 7.5, strafe: 0.9, range: 10 },
    francotirador: { emoji: '🎯', label: 'francotirador', speed: 2.4, cd: 2.00, bspeed: 13, spread: 0.05, pmin: 4.0, pmax: 14,  strafe: 0.0, range: 18 },
  };
  const SIZES = { s: 7, m: 9, l: 11 };   // celdas en el lado corto de la pantalla; el lado largo se calcula
  const ZONE_DELAY = 22, ZONE_TIME = 75;                  // segundos de juego
  const PU_TYPES = ['shield', 'shield', 'shield', 'triple', 'triple', 'triple', 'speed', 'speed', 'speed', 'heal', 'heal'];
  const PU_COLOR = { shield: '#38bdf8', triple: '#fb923c', speed: '#facc15', heal: '#f472b6' };
  const PU_NAME = { shield: 'escudo', triple: 'triple disparo', speed: 'velocidad', heal: 'vida extra' };

  /* ================= generación de mapas ================= */
  function genMap(type, cols, rows) {
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
        if ((v || h) && rnd() < 0.24) g[at(x, y)] = 0;
      }
      // salas abiertas de 3x3
      if (cols >= 4 && rows >= 4) {
        const n = Math.max(1, Math.round((cols * rows) / 16));
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
  const lighten = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.round(v + (255 - v) * k);
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  };
  const darken = (hex, k) => {
    const n = parseInt(hex.slice(1), 16);
    const c = (v) => Math.round(v * (1 - k));
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  };

  /* ================= la partida ================= */
  class Game {
    constructor(canvas, cfg, hooks) {
      this.cv = canvas; this.ctx = canvas.getContext('2d');
      this.cfg = cfg; this.hooks = hooks;
      this.phase = 'countdown'; this.cdT = 3.4; this.lastBeep = 4;
      this.paused = false; this.speed = B.speed || 1;
      this.time = 0; this.acc = 0; this.last = 0; this.raf = 0;
      this.bullets = []; this.parts = []; this.pus = []; this.corpses = [];
      this.puTimer = 5; this.endT = 0; this.deaths = 0;
      this.winners = [];
      this.zone = null;

      // el mapa se adapta a la forma de la pantalla para no dejar huecos vacíos
      const wrap = canvas.parentElement;
      const base = SIZES[cfg.size] || SIZES.m;
      const portrait = wrap.clientHeight >= wrap.clientWidth;
      const ratio = portrait ? wrap.clientHeight / Math.max(1, wrap.clientWidth) : wrap.clientWidth / Math.max(1, wrap.clientHeight);
      const long = Math.max(base, Math.min(Math.round(base * ratio), Math.round(base * 2.1)));
      const cols = portrait ? base : long, rows = portrait ? long : base;
      const m = genMap(cfg.map, cols, rows);
      this.W = m.W; this.H = m.H; this.g = m.g; this.center = m.center;
      // buffers para búsqueda de caminos
      const N = this.W * this.H;
      this.seen = new Uint32Array(N); this.stamp = 0; this.prev = new Int32Array(N); this.dist = new Int32Array(N); this.queue = new Int32Array(N);
      this.floor = [];
      for (let i = 0; i < N; i++) if (!this.g[i]) this.floor.push(i);
      this.spawn();
      this.resize = this.resize.bind(this);
      this.frame = this.frame.bind(this);
      this.resize();
      window.addEventListener('resize', this.resize);
    }

    destroy() { cancelAnimationFrame(this.raf); window.removeEventListener('resize', this.resize); this.dead = true; }

    isWall(x, y) { return x < 0 || y < 0 || x >= this.W || y >= this.H || this.g[y * this.W + x] === 1; }
    blocked(x, y, r) {
      const x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.floor(y - r), y1 = Math.floor(y + r);
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) if (this.isWall(xx, yy)) return true;
      return false;
    }
    los(x0, y0, x1, y1) {
      const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy), n = Math.ceil(d / 0.2);
      for (let i = 1; i < n; i++) { const t = i / n; if (this.isWall(Math.floor(x0 + dx * t), Math.floor(y0 + dy * t))) return false; }
      return true;
    }

    /* ---------- soldados ---------- */
    spawn() {
      const cfg = this.cfg, W = this.W;
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
        players.forEach((p) => {
          const a = anchors.find((x) => x[0] === p.team)[1];
          const free = flo.filter((f) => !places.some((q) => Math.hypot(q[0] - f[0], q[1] - f[1]) < 1.4));
          free.sort((u, v) => Math.hypot(u[0] - a[0], u[1] - a[1]) - Math.hypot(v[0] - a[0], v[1] - a[1]));
          places.push(free[0] || a);
        });
      } else {
        const chosen = [flo[rint(flo.length)]];
        while (chosen.length < players.length) chosen.push(pickFar(chosen, flo));
        places = shuffle(chosen);
      }
      const names = Object.keys(PERS);
      this.soldiers = players.map((p, i) => {
        const pers = cfg.varied ? names[[0, 0, 0, 0, 1, 1, 1, 2, 2][rint(9)]] : 'agresivo';
        const P = PERS[pers];
        return {
          id: i, name: p.name, color: p.color, team: cfg.teamMode ? p.team : -1,
          x: places[i][0], y: places[i][1], r: 0.3, angle: rnd() * 6.28, aim: 0,
          hp: cfg.lives, maxHp: cfg.lives, alive: true, deathT: 0, kills: 0,
          pers, P, cd: 0.6 + rnd() * 0.8, path: [], thinkT: rnd() * 0.3, mode: 'attack',
          shield: 0, triple: 0, speedT: 0, flash: 0, strafeDir: rnd() < 0.5 ? 1 : -1, strafeT: 0,
          zoneT: 0, stuckT: 0, lx: 0, ly: 0, target: null,
        };
      });
      this.soldiers.forEach((s) => { s.lx = s.x; s.ly = s.y; });
    }

    enemiesOf(s) { return this.soldiers.filter((o) => o.alive && o !== s && (s.team < 0 || o.team !== s.team)); }

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

    outsideZone(x, y, m = 0) {
      const z = this.zone; if (!z) return false;
      return x < z.x0 + m || x > z.x1 - m || y < z.y0 + m || y > z.y1 - m;
    }

    /* ---------- cerebro ---------- */
    think(s) {
      const W = this.W, tx = Math.floor(s.x), ty = Math.floor(s.y);
      const enemies = this.enemiesOf(s);
      if (!enemies.length) return;
      const P = s.P;
      let path = null; s.mode = 'attack';

      if (this.zone && this.outsideZone(s.x, s.y, 1.2)) {
        s.mode = 'zone';
        path = this.bfs(tx, ty, (i) => !this.outsideZone((i % W) + 0.5, ((i / W) | 0) + 0.5, 1.6));
      }
      const near = s.target && Math.hypot(s.target.x - s.x, s.target.y - s.y) < 4.5;
      if (!path && this.pus.length && !near) {
        const marks = new Set(this.pus.map((p) => p.ty * W + p.tx));
        const p2 = this.bfs(tx, ty, (i) => marks.has(i), s.pers === 'cauteloso' ? 12 : 8);
        if (p2) { path = p2; s.mode = 'powerup'; }
      }
      const lowHp = s.maxHp > 1 && s.hp <= 1;
      const closeThreat = s.target && Math.hypot(s.target.x - s.x, s.target.y - s.y) < 2.8;
      if (!path && ((s.pers === 'cauteloso' && lowHp && this.time < 60) || (s.pers === 'francotirador' && closeThreat))) {
        // huir: ir al punto alcanzable más lejos de los enemigos
        const n = this.bfs(tx, ty, null, 11, true);
        let bestI = -1, bs = -1;
        for (let k = 0; k < n; k++) {
          const i = this.queue[k], x = (i % W) + 0.5, y = ((i / W) | 0) + 0.5;
          let md = 1e9; enemies.forEach((e) => { md = Math.min(md, Math.hypot(e.x - x, e.y - y)); });
          const sc = md - this.dist[i] * 0.15;
          if (sc > bs) { bs = sc; bestI = i; }
        }
        if (bestI >= 0) { path = this.pathTo(bestI); s.mode = 'flee'; }
      }
      if (!path) {
        const marks = new Set(enemies.map((e) => Math.floor(e.y) * W + Math.floor(e.x)));
        path = this.bfs(tx, ty, (i) => marks.has(i));
        s.mode = 'attack';
      }
      s.path = path || [];
    }

    tryMove(s, dx, dy) {
      let moved = false;
      if (!this.blocked(s.x + dx, s.y, s.r)) { s.x += dx; moved = true; }
      if (!this.blocked(s.x, s.y + dy, s.r)) { s.y += dy; moved = true; }
      return moved;
    }

    updateSoldier(s, dt) {
      if (!s.alive) return;
      if (this.phase !== 'run') { s.flash = Math.max(0, s.flash - dt); return; }
      s.cd -= dt; s.flash = Math.max(0, s.flash - dt);
      s.shield = Math.max(0, s.shield - dt); s.triple = Math.max(0, s.triple - dt); s.speedT = Math.max(0, s.speedT - dt);
      const P = s.P;

      // objetivo visible más cercano
      let tgt = null, td = 1e9;
      for (const e of this.enemiesOf(s)) {
        const d = Math.hypot(e.x - s.x, e.y - s.y);
        if (d < td && d <= P.range && this.los(s.x, s.y, e.x, e.y)) { td = d; tgt = e; }
      }
      s.target = tgt;

      s.thinkT -= dt;
      if (s.thinkT <= 0) { s.thinkT = 0.3 + rnd() * 0.2; this.think(s); }

      // zona: daño fuera del área segura
      if (this.zone && this.outsideZone(s.x, s.y)) {
        s.zoneT += dt;
        if (s.zoneT >= 1) { s.zoneT = 0; this.damage(s, null, true); if (!s.alive) return; }
      } else s.zoneT = 0;

      // agresividad creciente con el tiempo (evita que se queden esperando)
      const k = this.time > 40 ? 0.55 : 1;
      const pmin = P.pmin * k, pmax = P.pmax * k;
      const speed = P.speed * (s.speedT > 0 ? 1.6 : 1);
      let vx = 0, vy = 0, desired = s.angle;

      if (tgt && s.mode !== 'zone' && s.mode !== 'flee') {
        const dx = tgt.x - s.x, dy = tgt.y - s.y;
        desired = Math.atan2(dy, dx);
        if (td < pmin) { vx = -dx / td; vy = -dy / td; }                    // retroceder
        else if (td <= pmax) {                                               // mantener y moverse de costado
          s.strafeT -= dt;
          if (s.strafeT <= 0) { s.strafeT = 0.6 + rnd() * 0.9; s.strafeDir = rnd() < 0.5 ? 1 : -1; s.doStrafe = rnd() < P.strafe; }
          if (s.doStrafe) { vx = (-dy / td) * s.strafeDir * 0.7; vy = (dx / td) * s.strafeDir * 0.7; }
        } else this.followPath(s, (v) => { vx = v[0]; vy = v[1]; });
      } else {
        this.followPath(s, (v) => { vx = v[0]; vy = v[1]; });
        if (vx || vy) desired = Math.atan2(vy, vx);
        else if (tgt) desired = Math.atan2(tgt.y - s.y, tgt.x - s.x);
      }
      if (s.mode === 'flee' && tgt) desired = Math.atan2(tgt.y - s.y, tgt.x - s.x);

      if (vx || vy) {
        const moved = this.tryMove(s, vx * speed * dt, vy * speed * dt);
        if (!moved) { s.strafeDir *= -1; s.strafeT = 0.2; }
      }
      // si no avanza por un rato, repensar camino
      s.stuckT += dt;
      if (s.stuckT > 0.6) {
        if (Math.hypot(s.x - s.lx, s.y - s.ly) < 0.12 && (vx || vy)) s.thinkT = 0;
        s.lx = s.x; s.ly = s.y; s.stuckT = 0;
      }

      // girar y disparar
      const diff = angDiff(s.angle, desired);
      const turn = 9 * dt;
      s.angle += Math.abs(diff) < turn ? diff : Math.sign(diff) * turn;
      if (tgt && s.cd <= 0 && Math.abs(angDiff(s.angle, Math.atan2(tgt.y - s.y, tgt.x - s.x))) < 0.14) this.fire(s);
    }

    followPath(s, out) {
      const W = this.W, p = s.path;
      while (p.length > 1) {
        const cx = (p[1] % W) + 0.5, cy = ((p[1] / W) | 0) + 0.5;
        if (Math.hypot(cx - s.x, cy - s.y) < 0.18) p.shift(); else break;
      }
      const wi = p.length > 1 ? p[1] : p[0];
      if (wi === undefined) return;
      const wx = (wi % W) + 0.5, wy = ((wi / W) | 0) + 0.5, d = Math.hypot(wx - s.x, wy - s.y);
      if (d > 0.05) out([(wx - s.x) / d, (wy - s.y) / d]);
    }

    fire(s) {
      const P = s.P;
      s.cd = P.cd * (0.85 + rnd() * 0.3);
      const base = s.angle + (rnd() - 0.5) * 2 * P.spread;
      const angles = s.triple > 0 ? [base - 0.2, base, base + 0.2] : [base];
      for (const a of angles) {
        this.bullets.push({
          x: s.x + Math.cos(a) * 0.5, y: s.y + Math.sin(a) * 0.5,
          vx: Math.cos(a) * P.bspeed, vy: Math.sin(a) * P.bspeed,
          owner: s, color: s.color, life: P.range / P.bspeed + 0.2,
        });
      }
      if (this.audible()) sfx.shot();
    }
    audible() { return this.speed <= 2 && (this._lastSfx = (this._lastSfx || 0) + 1) % 2 === 0 || this.speed === 1; }

    damage(s, by, zone) {
      if (!s.alive || this.phase === 'ending' && !zone) return;
      if (!zone && s.shield > 0) { s.shield = 0; this.spark(s.x, s.y, '#38bdf8', 8); if (this.speed <= 2) sfx.pickup(); return; }
      s.hp -= 1; s.flash = 0.18;
      this.spark(s.x, s.y, s.color, 6);
      if (this.speed <= 2) sfx.hit();
      if (s.hp <= 0) this.kill(s, by, zone);
    }
    kill(s, by, zone) {
      s.alive = false; s.hp = 0; s.deathT = this.time; s.deathOrder = this.deaths++;
      this.corpses.push({ x: s.x, y: s.y, color: s.color });
      for (let i = 0; i < 34; i++) {
        const a = rnd() * 6.283, v = 1.5 + rnd() * 5;
        this.parts.push({ x: s.x, y: s.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + rnd() * 0.7, max: 1.2, color: i % 3 === 0 ? '#ffb347' : s.color, size: 0.08 + rnd() * 0.12 });
      }
      this.parts.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: 0.45, max: 0.45, color: '#fff', size: 0.9, ring: true });
      sfx.boom(); vibrate(40);
      if (by && by !== s) by.kills++;
      this.hooks.onKill(s, by, zone);
    }
    spark(x, y, color, n) {
      for (let i = 0; i < n; i++) {
        const a = rnd() * 6.283, v = 1 + rnd() * 3;
        this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.2 + rnd() * 0.25, max: 0.45, color, size: 0.05 + rnd() * 0.05 });
      }
    }

    /* ---------- power-ups ---------- */
    spawnPowerup() {
      if (this.pus.length >= 3 || !this.floor.length) return;
      for (let tries = 0; tries < 20; tries++) {
        const i = this.floor[rint(this.floor.length)], tx = i % this.W, ty = (i / this.W) | 0;
        if (this.pus.some((p) => p.tx === tx && p.ty === ty)) continue;
        this.pus.push({ type: PU_TYPES[rint(PU_TYPES.length)], tx, ty, t: 0 });
        return;
      }
    }
    collectPowerups() {
      for (const s of this.soldiers) {
        if (!s.alive) continue;
        for (let k = this.pus.length - 1; k >= 0; k--) {
          const p = this.pus[k];
          if (Math.hypot(p.tx + 0.5 - s.x, p.ty + 0.5 - s.y) < 0.55) {
            this.pus.splice(k, 1);
            if (p.type === 'shield') s.shield = 12;
            else if (p.type === 'triple') s.triple = 12;
            else if (p.type === 'speed') s.speedT = 9;
            else s.hp = Math.min(s.maxHp + 1, s.hp + 1);
            this.spark(s.x, s.y, PU_COLOR[p.type], 12);
            if (this.speed <= 2) sfx.pickup();
            this.hooks.onPickup(s, p.type);
          }
        }
      }
    }

    /* ---------- simulación ---------- */
    step(dt) {
      this.time += dt;
      // zona
      if (this.cfg.zone) {
        const t = Math.min(1, Math.max(0, (this.time - ZONE_DELAY) / ZONE_TIME));
        const [cx, cy] = this.center, W = this.W, H = this.H;
        const e = t * t * (3 - 2 * t);
        this.zone = t > 0 ? { x0: e * (cx - 1.5), y0: e * (cy - 1.5), x1: W - e * (W - cx - 2.5), y1: H - e * (H - cy - 2.5) } : null;
      }
      // power-ups
      if (this.cfg.powerups) {
        this.puTimer -= dt;
        if (this.puTimer <= 0) { this.puTimer = 6 + rnd() * 5; this.spawnPowerup(); }
        this.pus.forEach((p) => { p.t += dt; });
        if (this.phase === 'run') this.collectPowerups();
      }
      for (const s of this.soldiers) this.updateSoldier(s, dt);

      // balas
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        let gone = b.life <= 0;
        if (!gone && this.isWall(Math.floor(b.x), Math.floor(b.y))) { gone = true; this.spark(b.x - b.vx * dt, b.y - b.vy * dt, '#ffe08a', 3); }
        if (!gone) {
          for (const s of this.soldiers) {
            if (!s.alive || s === b.owner || (b.owner.team >= 0 && s.team === b.owner.team)) continue;
            if (Math.hypot(s.x - b.x, s.y - b.y) < s.r + 0.1) { gone = true; this.damage(s, b.owner, false); break; }
          }
        }
        if (gone) this.bullets.splice(i, 1);
      }
      // partículas
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.life -= dt;
        if (p.life <= 0) this.parts.splice(i, 1);
      }

      // ¿terminó?
      if (this.phase === 'run') {
        const alive = this.soldiers.filter((s) => s.alive);
        const groups = new Set(alive.map((s) => (s.team < 0 ? 'p' + s.id : 't' + s.team)));
        if (groups.size <= 1) {
          this.phase = 'ending'; this.endT = 0; this.bullets.length = 0;
          this.winners = alive;
        }
      } else if (this.phase === 'ending') {
        this.endT += dt;
        if (this.endT > 1.7) { this.phase = 'done'; this.hooks.onEnd(this.result()); }
      }
    }

    result() {
      const order = this.soldiers.slice().sort((a, b) => {
        if (a.alive !== b.alive) return a.alive ? -1 : 1;
        if (a.alive) return b.kills - a.kills;
        return (b.deathT - a.deathT) || (b.kills - a.kills);
      });
      return { ranking: order, winners: this.winners, teamMode: this.cfg.teamMode, time: this.time };
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
          this.acc += dt * this.speed;
          let n = 0;
          while (this.acc >= STEP && n < 30) { this.step(STEP); this.acc -= STEP; n++; if (this.phase === 'done') break; }
          if (n >= 30) this.acc = 0;
        }
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
      this.ts = Math.floor(Math.min(cw / this.W, ch / this.H) * 100) / 100;
      this.ox = (cw - this.ts * this.W) / 2; this.oy = (ch - this.ts * this.H) / 2;
      this.buildStatic();
    }

    buildStatic() {
      const ts = this.ts, dpr = this.dpr, W = this.W, H = this.H, g = this.g;
      const c = document.createElement('canvas');
      c.width = Math.ceil(W * ts * dpr); c.height = Math.ceil(H * ts * dpr);
      const x = c.getContext('2d'); x.scale(dpr, dpr);
      for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
        const wall = g[y * W + xx];
        const px = xx * ts, py = y * ts;
        if (!wall) {
          x.fillStyle = (xx + y) % 2 ? '#1b2339' : '#1f2840';
          x.fillRect(px, py, ts + 0.5, ts + 0.5);
          if (y > 0 && g[(y - 1) * W + xx]) { // sombra bajo la pared
            const gr = x.createLinearGradient(0, py, 0, py + ts * 0.45);
            gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
            x.fillStyle = gr; x.fillRect(px, py, ts + 0.5, ts * 0.45);
          }
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
      this.static = c;
    }

    draw() {
      if (!this.static) return;
      const x = this.ctx, ts = this.ts, dpr = this.dpr;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.fillStyle = '#0a0e1a'; x.fillRect(0, 0, this.cw, this.ch);
      x.save(); x.translate(this.ox, this.oy);
      x.drawImage(this.static, 0, 0, this.W * ts, this.H * ts);

      // restos de los caídos
      for (const c of this.corpses) {
        x.strokeStyle = c.color; x.globalAlpha = 0.35; x.lineWidth = Math.max(2, ts * 0.12);
        const r = ts * 0.2; x.beginPath(); x.moveTo(c.x * ts - r, c.y * ts - r); x.lineTo(c.x * ts + r, c.y * ts + r);
        x.moveTo(c.x * ts + r, c.y * ts - r); x.lineTo(c.x * ts - r, c.y * ts + r); x.stroke(); x.globalAlpha = 1;
      }
      // power-ups
      for (const p of this.pus) this.drawPowerup(x, p);
      // zona
      if (this.zone) this.drawZone(x);
      // soldados vivos (los más abajo se dibujan después)
      const alive = this.soldiers.filter((s) => s.alive).sort((a, b) => a.y - b.y);
      for (const s of alive) this.drawSoldier(x, s);
      // balas
      for (const b of this.bullets) {
        const sp = Math.hypot(b.vx, b.vy), tx = b.vx / sp, ty = b.vy / sp, len = 0.55;
        x.strokeStyle = lighten(b.color, 0.5); x.globalAlpha = 0.5; x.lineWidth = Math.max(2, ts * 0.12); x.lineCap = 'round';
        x.beginPath(); x.moveTo((b.x - tx * len) * ts, (b.y - ty * len) * ts); x.lineTo(b.x * ts, b.y * ts); x.stroke();
        x.globalAlpha = 1; x.fillStyle = '#fff'; x.beginPath(); x.arc(b.x * ts, b.y * ts, Math.max(1.8, ts * 0.09), 0, 6.283); x.fill();
      }
      // partículas
      for (const p of this.parts) {
        const a = Math.max(0, p.life / p.max);
        x.globalAlpha = a;
        if (p.ring) { x.strokeStyle = p.color; x.lineWidth = 3; x.beginPath(); x.arc(p.x * ts, p.y * ts, ts * (1.4 - a * 1.2) , 0, 6.283); x.stroke(); }
        else { x.fillStyle = p.color; x.beginPath(); x.arc(p.x * ts, p.y * ts, Math.max(1, p.size * ts), 0, 6.283); x.fill(); }
      }
      x.globalAlpha = 1;
      // nombres encima de todo
      for (const s of alive) this.drawLabel(x, s);
      x.restore();

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
      const ts = this.ts, cx = (p.tx + 0.5) * ts, cy = (p.ty + 0.5) * ts, col = PU_COLOR[p.type];
      const pulse = 1 + Math.sin(p.t * 5) * 0.08, r = ts * 0.34 * pulse;
      x.save(); x.translate(cx, cy);
      x.fillStyle = col; x.globalAlpha = 0.22; x.beginPath(); x.arc(0, 0, r * 1.5, 0, 6.283); x.fill(); x.globalAlpha = 1;
      x.fillStyle = '#0d1220'; x.strokeStyle = col; x.lineWidth = Math.max(2, ts * 0.09);
      x.beginPath(); x.arc(0, 0, r, 0, 6.283); x.fill(); x.stroke();
      x.fillStyle = col; x.strokeStyle = col; x.lineWidth = Math.max(1.5, ts * 0.07); x.lineJoin = 'round';
      const u = r * 0.55;
      if (p.type === 'shield') {
        x.beginPath(); x.moveTo(0, -u); x.lineTo(u, -u * 0.55); x.lineTo(u * 0.8, u * 0.4); x.lineTo(0, u); x.lineTo(-u * 0.8, u * 0.4); x.lineTo(-u, -u * 0.55); x.closePath(); x.fill();
      } else if (p.type === 'triple') {
        [-0.5, 0, 0.5].forEach((a) => { x.beginPath(); x.moveTo(-u * 0.3, u * 0.7); x.lineTo(Math.sin(a) * u * 1.2, -Math.cos(a) * u * 0.9); x.stroke(); });
      } else if (p.type === 'speed') {
        x.beginPath(); x.moveTo(u * 0.25, -u); x.lineTo(-u * 0.6, u * 0.15); x.lineTo(0, u * 0.15); x.lineTo(-u * 0.25, u); x.lineTo(u * 0.6, -u * 0.15); x.lineTo(0, -u * 0.15); x.closePath(); x.fill();
      } else {
        x.beginPath(); x.moveTo(0, u * 0.9); x.bezierCurveTo(-u * 1.4, -u * 0.1, -u * 0.5, -u * 1.1, 0, -u * 0.3); x.bezierCurveTo(u * 0.5, -u * 1.1, u * 1.4, -u * 0.1, 0, u * 0.9); x.fill();
      }
      x.restore();
    }

    drawSoldier(x, s) {
      const ts = this.ts, r = s.r * ts * 1.15, cx = s.x * ts, cy = s.y * ts;
      x.save(); x.translate(cx, cy);
      // sombra
      x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(r * 0.15, r * 0.35, r * 1.05, r * 0.85, 0, 0, 6.283); x.fill();
      // aura de velocidad / triple
      if (s.speedT > 0) { x.strokeStyle = 'rgba(250,204,21,.7)'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, r * 1.35, 0, 6.283); x.setLineDash([4, 5]); x.stroke(); x.setLineDash([]); }
      x.rotate(s.angle);
      // arma
      x.fillStyle = '#1b1f2b'; x.fillRect(r * 0.35, -r * 0.2, r * 1.35, r * 0.4);
      x.fillStyle = s.triple > 0 ? '#fb923c' : '#6b7280'; x.fillRect(r * 1.35, -r * 0.2, r * 0.35, r * 0.4);
      if (s.triple > 0) { x.fillRect(r * 1.2, -r * 0.5, r * 0.3, r * 0.22); x.fillRect(r * 1.2, r * 0.28, r * 0.3, r * 0.22); }
      x.rotate(-s.angle);
      // cuerpo
      x.fillStyle = s.color; x.strokeStyle = 'rgba(0,0,0,.65)'; x.lineWidth = Math.max(2, ts * 0.09);
      x.beginPath(); x.arc(0, 0, r, 0, 6.283); x.fill(); x.stroke();
      if (s.team >= 0) { x.strokeStyle = TEAMS[s.team].color; x.lineWidth = Math.max(2.5, ts * 0.13); x.beginPath(); x.arc(0, 0, r + 1.5, 0, 6.283); x.stroke(); }
      // casco
      x.fillStyle = darken(s.color, 0.28); x.beginPath(); x.arc(0, 0, r * 0.58, 0, 6.283); x.fill();
      x.fillStyle = lighten(s.color, 0.55); x.beginPath(); x.arc(-r * 0.15, -r * 0.18, r * 0.2, 0, 6.283); x.fill();
      // escudo
      if (s.shield > 0) {
        x.strokeStyle = `rgba(56,189,248,${0.6 + Math.sin(this.time * 8) * 0.3})`; x.lineWidth = Math.max(2, ts * 0.1);
        x.beginPath(); x.arc(0, 0, r * 1.5, 0, 6.283); x.stroke();
        x.fillStyle = 'rgba(56,189,248,.12)'; x.fill();
      }
      if (s.flash > 0) { x.fillStyle = `rgba(255,255,255,${Math.min(0.9, s.flash * 5)})`; x.beginPath(); x.arc(0, 0, r, 0, 6.283); x.fill(); }
      x.restore();
    }

    drawLabel(x, s) {
      const ts = this.ts, cx = s.x * ts, top = s.y * ts - s.r * ts * 1.15 - 4;
      // vidas
      const pw = Math.max(4, ts * 0.2), gap = 1.5, total = s.maxHp + (s.hp > s.maxHp ? 1 : 0);
      const wTot = total * pw + (total - 1) * gap;
      for (let i = 0; i < total; i++) {
        x.fillStyle = i < s.hp ? '#ff4d6a' : 'rgba(255,255,255,.25)';
        x.fillRect(cx - wTot / 2 + i * (pw + gap), top - 3, pw, 3);
      }
      const fs = Math.max(9, Math.min(14, ts * 0.52));
      x.font = `800 ${fs}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'bottom';
      x.lineWidth = 3.2; x.strokeStyle = 'rgba(0,0,0,.85)'; x.lineJoin = 'round';
      x.strokeText(s.name, cx, top - 5); x.fillStyle = '#fff'; x.fillText(s.name, cx, top - 5);
    }
  }
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];

  /* ================= interfaz ================= */
  let game = null;
  let wakeLock = null;
  const hud = $('#hudPlayers');
  const feed = $('#feed');
  const zoneInfo = $('#zoneInfo');
  let chips = [];

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
        const b = el('button', {
          class: 'team-btn', style: `background:${TEAMS[t].color}`, 'aria-label': 'Cambiar de equipo',
          onclick: () => { p.team = ((p.team || 0) + 1) % B.teamCount; save(); renderRoster(); },
        }, TEAMS[t].name.slice(0, 3));
        row.append(b);
      }
      row.append(el('button', { class: 'rm', 'aria-label': 'Quitar', onclick: () => { if (state.players.length > 2) { state.players.splice(i, 1); save(); renderRoster(); } } }, '✕'));
      box.append(row);
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
  function renderWins() {
    const box = $('#winTable');
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
    const tm = B.teamMode === 'teams';
    const players = state.players.map((p, i) => ({ name: pname(p, i), color: p.color, team: Math.min(p.team || 0, B.teamCount - 1) }));
    return { players, teamMode: tm, lives: +B.lives, map: B.map, size: B.size, powerups: B.powerups, zone: B.zone, varied: B.varied };
  }

  async function startGame() {
    const cfg = buildConfig();
    if (cfg.teamMode && new Set(cfg.players.map((p) => p.team)).size < 2) {
      alert('Para jugar por equipos tiene que haber soldados en al menos 2 equipos distintos.'); return;
    }
    App.ctx();
    document.body.classList.add('in-game');
    $('#battleSetup').hidden = true; $('#battleGame').hidden = false;
    $('#resultOverlay').hidden = true; $('#pauseOverlay').hidden = true;
    feed.innerHTML = ''; zoneInfo.textContent = '';
    if (game) game.destroy();
    game = new Game($('#battleCanvas'), cfg, { onKill, onPickup, onEnd, onFrame });
    App.game = game;
    buildHud(game);
    game.start();
    try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { wakeLock = null; }
    announce(game);
  }

  function announce(g) {
    if (!g.cfg.varied) return;
    const txt = g.soldiers.map((s) => `${PERS[s.pers].emoji} ${s.name}`).join('  ·  ');
    addFeed(txt, 5000);
  }

  function leaveGame(toSetup = true) {
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
      const hp = el('span', { class: 'hp' });
      const chip = el('div', { class: 'chip', style: s.team >= 0 ? `border-color:${TEAMS[s.team].color}` : '', title: `${s.name} (${PERS[s.pers].label})` },
        el('span', { class: 'dot', style: `background:${s.color}` }),
        el('span', { class: 'nm' }, (g.cfg.varied ? PERS[s.pers].emoji + ' ' : '') + s.name), hp);
      hud.append(chip);
      return { chip, hp, last: -1, alive: true };
    });
  }

  function addFeed(text, ms = 3800) {
    const d = el('div', {}, text);
    feed.append(d);
    while (feed.children.length > 3) feed.firstChild.remove();
    setTimeout(() => d.remove(), Math.min(ms, 3200));
  }
  function onKill(s, by, zone) {
    if (zone || !by) addFeed(`🔥 ${s.name} cayó fuera de la zona`);
    else addFeed(`💥 ${by.name} eliminó a ${s.name}`);
  }
  function onPickup(s, type) { addFeed(`✨ ${s.name} agarró ${PU_NAME[type]}`, 2500); }

  function onFrame(g) {
    g.soldiers.forEach((s, i) => {
      const c = chips[i]; if (!c) return;
      const key = s.alive ? s.hp : -1;
      if (c.last !== key) {
        c.last = key; c.hp.textContent = s.alive ? '♥'.repeat(Math.max(0, s.hp)) : '✖';
        c.chip.classList.toggle('dead', !s.alive);
      }
    });
    if (g.cfg.zone && g.phase === 'run') {
      const left = Math.ceil(ZONE_DELAY - g.time);
      zoneInfo.textContent = left > 0 ? `⚠️ Zona en ${left}s` : g.time < ZONE_DELAY + ZONE_TIME ? '🔴 Zona achicándose' : '🔴 Zona final';
    } else if (g.phase !== 'run') zoneInfo.textContent = '';
  }

  function onEnd(res) {
    sfx.fanfare(); vibrate([60, 60, 120]);
    const win = res.winners;
    const names = win.map((s) => s.name);
    if (names.length) { B.wins.push({ t: Date.now(), names }); if (B.wins.length > 1000) B.wins.shift(); save(); }
    showResult(res);
  }

  function showResult(res) {
    const ov = $('#resultOverlay');
    const win = res.winners, tm = res.teamMode;
    const rk = res.ranking;
    let title, sub;
    if (!win.length) { title = '🤝 ¡Empate!'; sub = 'Nadie quedó en pie.'; }
    else if (tm) { title = `🏆 ¡Gana el equipo ${TEAMS[win[0].team].name}!`; sub = win.map((s) => s.name).join(', '); }
    else { title = `🏆 ¡Gana ${win[0].name}!`; sub = `${win[0].kills} eliminaciones · ${Math.round(res.time)}s de batalla`; }

    const podium = el('div', { class: 'podium' });
    [rk[1], rk[0], rk[2]].forEach((s, k) => {
      if (!s) return;
      const place = [2, 1, 3][k];
      podium.append(el('div', { class: 'slot' },
        el('div', { class: 'sdot', style: `background:${s.color}` }),
        el('div', { class: 'who' }, s.name),
        el('div', { class: 'block', style: `height:${[70, 100, 52][k]}px;background:${['#c0c7d6', '#f0c04a', '#cd8b4f'][k]}` }, place)));
    });

    const list = el('div', { class: 'rank-list' });
    rk.forEach((s, i) => list.append(el('div', {},
      el('span', {}, `${i + 1}.`), el('span', { class: 'dot', style: `background:${s.color}` }), el('span', {}, s.name),
      el('span', { class: 'k' }, `${s.kills} 💥${s.alive ? ' · ganó' : ''}`))));

    ov.innerHTML = '';
    ov.append(el('div', { class: 'overlay-box' },
      el('h2', { class: 'win-title' }, title), el('p', { class: 'win-sub' }, sub), podium, list,
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
  document.addEventListener('visibilitychange', () => { if (document.hidden && game && game.phase === 'run') setPause(true); });

  bindSeg('segSpeed', () => B.speed, (v) => { B.speed = +v; if (game) game.speed = +v; });
  bindSeg('segTeamMode', () => B.teamMode, (v) => { B.teamMode = v; renderRoster(); });
  bindSeg('segTeamCount', () => B.teamCount, (v) => { B.teamCount = +v; renderRoster(); });
  bindSeg('segLives', () => B.lives, (v) => { B.lives = +v; });
  bindSeg('segMap', () => B.map, (v) => { B.map = v; });
  bindSeg('segSize', () => B.size, (v) => { B.size = v; });
  bindSeg('segWinRange', () => B.winRange, (v) => { B.winRange = v; renderWins(); });

  [['optPowerups', 'powerups'], ['optZone', 'zone'], ['optVaried', 'varied']].forEach(([id, key]) => {
    const input = $('#' + id); input.checked = !!B[key];
    input.addEventListener('change', () => { B[key] = input.checked; save(); });
  });

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
  $('#btnResetWins').addEventListener('click', () => { if (confirm('¿Borrar la tabla de victorias?')) { B.wins = []; save(); renderWins(); } });

  App.register('battle', {
    enter() { renderRoster(); renderWins(); },
    leave() { if (game) leaveGame(false); },
  });
  App.battle = { genMap, Game, PERS };
})();
