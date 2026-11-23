/* Mundo vivo y herramientas (0.9.5): paredes finas y puertas que se rompen, herramientas (carga explosiva,
   minas, trampas, sensor, escudo portátil, binoculares), mesas que se dan vuelta, luz y sombras de noche,
   lámparas que se rompen, clima (lluvia, barro, tormenta), cintas transportadoras y eventos nuevos
   (generador en el apagón, inundación, helicóptero, alarma de humo). Se carga después de squad.js. */
'use strict';

(() => {
  const { rnd, rint, sfx } = App;
  const E = App.battle;
  const { angDiff, clamp, doorClosed, WEAPONS } = E;
  const G = E.Game.prototype;
  const TAU = Math.PI * 2;
  const TOOLS = { charge: '🧨 carga explosiva', mine: '💥 mina', trap: '🪤 trampa con alarma', sensor: '📡 sensor de movimiento', shield: '🛡️ escudo portátil', binoc: '🔭 binoculares' };
  const CONV = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];            // cintas: 1 este · 2 oeste · 3 sur · 4 norte

  /* ================= armado ================= */
  const initOld = G.initWorld;
  G.initWorld = function (m) {
    initOld.call(this, m);
    const W = this.W, H = this.H, N = W * H, g = this.g;
    this.wallHp = new Float32Array(N); this.holed = new Uint8Array(N);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {         // paredes finas: con piso de los dos lados
      const i = y * W + x; if (!this.wl[i]) continue;
      const h = !g[i - 1] && !g[i + 1], v = !g[i - W] && !g[i + W];
      if (h || v) this.wallHp[i] = 140;
    }
    this.doorHp = new Map(); for (const k of this.doors.keys()) this.doorHp.set(k, 90);
    this.prKind = new Map();
    this.tables = new Map(); for (const t of m.tables || []) { const i = t.y * W + t.x; if (!g[i] && !this.doorGrid[i]) this.tables.set(i, { x: t.x, y: t.y, flipped: false }); }
    this.conv = new Uint8Array(N); for (const c of m.conv || []) this.conv[c.y * W + c.x] = c.d;
    this.lamps = (m.lamps || []).map((l) => ({ x: l.x + 0.5, y: l.y + 0.5, r: 5, on: true }));
    this.charges = []; this.traps = []; this.sensors = []; this.lights = [];
    this.weather = null; this.lightT = 0; this.nextBolt = 0; this.soundMul = 1;
    this.night = !!(this.cfg.night || m.night);
    if (this.night && !this.lamps.length) this.placeLamps();
    if (this.night) this.darkAll = true;
    this.computeLit();
    const w = this.cfg.weather === 'auto' ? ['none', 'none', 'rain', 'storm', 'fog'][Math.floor(this.srnd() * 5)] : (this.cfg.weather || 'none');
    if (w !== 'none') this.setWeather(w);
  };
  G.placeLamps = function () {
    const W = this.W, fl = this.floor || []; if (!this.floor) for (let i = 0; i < W * this.H; i++) if (!this.g[i] && !this.doorGrid[i]) fl.push(i);
    const n = Math.max(3, Math.round(fl.length / 105)), pts = [];
    for (let k = 0; k < n; k++) {
      let best = null, bd = -1;
      for (let t = 0; t < 30; t++) { const i = fl[Math.floor(this.srnd() * fl.length)], x = (i % W) + 0.5, y = ((i / W) | 0) + 0.5; let md = 99; for (const p of pts) md = Math.min(md, Math.hypot(p.x - x, p.y - y)); if (md > bd) { bd = md; best = { x, y }; } }
      if (best) pts.push(best);
    }
    this.lamps = pts.map((p) => ({ x: p.x, y: p.y, r: 5, on: true }));
  };
  /** Qué casilleros ilumina cada lámpara (con sombras: las paredes cortan la luz). */
  G.computeLit = function () {
    const W = this.W, H = this.H;
    this.litGrid = new Uint8Array(W * H);
    for (const l of this.lamps) {
      l.poly = null; if (!l.on) continue;
      for (let y = Math.max(0, Math.floor(l.y - l.r)); y <= Math.min(H - 1, Math.floor(l.y + l.r)); y++) for (let x = Math.max(0, Math.floor(l.x - l.r)); x <= Math.min(W - 1, Math.floor(l.x + l.r)); x++)
        if (Math.hypot(x + 0.5 - l.x, y + 0.5 - l.y) <= l.r && this.los(l.x, l.y, x + 0.5, y + 0.5)) this.litGrid[y * W + x] = 1;
      const pts = [];
      for (let k = 0; k < 48; k++) { const a = k / 48 * TAU; let d = 0.3; while (d < l.r && !this.isOpaque(Math.floor(l.x + Math.cos(a) * d), Math.floor(l.y + Math.sin(a) * d))) d += 0.2; pts.push([Math.cos(a) * Math.min(d, l.r), Math.sin(a) * Math.min(d, l.r)]); }
      l.poly = pts;
    }
  };
  /** ¿Hay luz acá? (de día, lámparas, fogonazos, relámpagos, el foco del helicóptero) */
  G.isLit = function (x, y) {
    const i = Math.floor(y) * this.W + Math.floor(x);
    if (this.lightT > 0) return true;
    if (this.heli && Math.hypot(x - this.heli.x, y - this.heli.y) < this.heli.r) return true;
    for (const l of this.lights) if (Math.hypot(x - l.x, y - l.y) < l.r) return true;
    if (this.litGrid && this.litGrid[i]) return true;
    return !this.darkAll && !this.dark[i];
  };

  /* ================= paredes y puertas que se rompen ================= */
  G.damageWall = function (i, dmg, by) {
    if (!this.wallHp || this.wallHp[i] <= 0) return;
    this.wallHp[i] -= dmg;
    const W = this.W, x = (i % W) + 0.5, y = ((i / W) | 0) + 0.5;
    if (this.wallHp[i] <= 60 && !this.holed[i]) {                              // agujereada: se ve y se dispara a través, pero no se pasa
      this.holed[i] = 1; this.wl[i] = 0; this.worldChanged(x, y, by, true);
      for (let k = 0; k < 6; k++) { const a = rnd() * TAU, v = 1 + rnd() * 2; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5, max: 0.8, color: '#8b93a7', size: 0.06 + rnd() * 0.06 }); }
    }
    if (this.wallHp[i] <= 0) {                                                   // destruida: queda un hueco con escombros
      this.wallHp[i] = 0; this.holed[i] = 0; this.wl[i] = 0; this.g[i] = 0; this.floorT[i] = 3; this.floor.push(i);
      for (let k = 0; k < 14; k++) { const a = rnd() * TAU, v = 1 + rnd() * 4; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6 + rnd() * 0.6, max: 1.2, color: k % 2 ? '#8b93a7' : '#5b6378', size: 0.08 + rnd() * 0.1 }); }
      this.worldChanged(x, y, by);
    }
  };
  G.breakDoor = function (i, by) {
    const d = this.doors.get(i); if (!d) return;
    this.doors.delete(i); this.doorGrid[i] = 0;
    for (let k = 0; k < 10; k++) { const a = rnd() * TAU, v = 1 + rnd() * 3; this.parts.push({ x: d.tx + 0.5, y: d.ty + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6, max: 1, color: '#b98048', size: 0.07 + rnd() * 0.08 }); }
    this.emitSound(d.tx + 0.5, d.ty + 0.5, 10, 'door', by && by.alive ? by : null);
    this.worldChanged(d.tx + 0.5, d.ty + 0.5, by);
  };
  G.damageDoor = function (i, dmg, by) {
    if (!this.doorHp || !this.doors.has(i)) return;
    const hp = (this.doorHp.get(i) || 90) - dmg; this.doorHp.set(i, hp);
    if (hp <= 0) this.breakDoor(i, by);
  };
  /** Cambió el mapa: se redibuja, se recalculan luces y el mapa táctico. */
  G.worldChanged = function (x, y, by, small) {
    this.emitSound(x, y, small ? 5 : 12, small ? 'door' : 'boom', by && by.alive ? by : null);
    if (this.static) { this.buildStatic(); this.buildMini(); }
    this.computeLit();
    if (this.tac) { this.lineLen = null; this.buildTactics(); }
    if (!this.cfg.noRec && this.speed <= 2) { if (small) App.audio.noise(0.25, { vol: 0.1 * this.camVol(x, y), freq: 500, q: 0.7, type: 'lowpass', pan: this.camPan(x) }); else sfx.boom(this.camPan(x), this.camVol(x, y) * 0.5); }
  };
  // las balas también castigan paredes finas y puertas; las explosiones mucho más
  const bulletOld = G.bulletTile;
  G.bulletTile = function (b, bx, by) {
    if (bx >= 0 && by >= 0 && bx < this.W && by < this.H) {
      const i = by * this.W + bx;
      if (this.wl[i] && this.wallHp[i] > 0) this.damageWall(i, b.dmg * 0.18, b.owner);
      if (this.doorGrid[i] && !b.doorHit) { b.doorHit = true; this.damageDoor(i, b.dmg * 0.3, b.owner); }
      for (const l of this.lamps) if (l.on && Math.hypot(b.x - l.x, b.y - l.y) < 0.28) { l.on = false; this.computeLit(); if (!this.cfg.noRec && this.speed <= 2) sfx.glass(this.camPan(l.x), this.camVol(l.x, l.y)); }   // le pegó a la lámpara
    }
    return bulletOld.call(this, b, bx, by);
  };
  const explodeOld = G.explode;
  G.explode = function (x, y, R, dmg, owner, kind) {
    explodeOld.call(this, x, y, R, dmg, owner, kind);
    const W = this.W;
    for (let ty = Math.max(1, Math.floor(y - R)); ty <= Math.min(this.H - 2, Math.floor(y + R)); ty++) for (let tx = Math.max(1, Math.floor(x - R)); tx <= Math.min(W - 2, Math.floor(x + R)); tx++) {
      const i = ty * W + tx, d = Math.hypot(tx + 0.5 - x, ty + 0.5 - y); if (d > R) continue;
      const f = 1 - d / R;
      if (this.wallHp[i] > 0) this.damageWall(i, (kind === 'charge' ? 260 : dmg * 1.4) * f + 25, owner);
      if (this.doorGrid[i]) this.damageDoor(i, dmg * 1.5 * f + 30, owner);
      for (const l of this.lamps) if (l.on && Math.hypot(l.x - tx - 0.5, l.y - ty - 0.5) < 0.6) { l.on = false; this.computeLit(); }
    }
    this.lights.push({ x, y, r: R * 1.6, t: 0.35 });
  };

  /* ================= herramientas ================= */
  G.toolsOf = function (s) { return s.tools || (s.tools = { charge: 0, mine: 0, trap: 0, sensor: 0, shield: 0, binoc: 0 }); };
  G.toolValue = function (s, type) { const t = this.toolsOf(s); if (type === 'binoc') return t.binoc ? 0 : 0.45; return t[type] >= 2 ? 0 : 0.4 + (s.role === 'ingeniero' ? 0.3 : 0); };
  G.takeTool = function (s, it) { const t = this.toolsOf(s); if (it.type === 'binoc') t.binoc = 1; else t[it.type]++; it.gone = true; return TOOLS[it.type]; };
  /** ¿Hay una pared fina o una puerta cerrada entre el soldado y lo que sabe del rival, pegada a él? */
  G.breachSpot = function (s, k) {
    const dx = k.x - s.x, dy = k.y - s.y, d = Math.hypot(dx, dy); if (d < 1.5 || d > 12) return -1;
    for (let t = 0.5; t <= 2.2; t += 0.25) {
      const x = Math.floor(s.x + dx / d * t), y = Math.floor(s.y + dy / d * t), i = y * this.W + x;
      if (this.wallHp[i] > 0 && this.wl[i]) return i;
      if (this.doorGrid[i] && doorClosed(this.doors.get(i))) return i;
      if (this.g[i]) return -1;
    }
    return -1;
  };
  /** La IA decide si usa una herramienta (se llama cada medio segundo). */
  G.toolTick = function (s) {
    const t = s.tools; if (!t || s.act || s.manual || s.downed) return;
    const now = this.time, W = this.W, i = Math.floor(s.y) * W + Math.floor(s.x);
    const k = this.bestKnowledge(s);
    if (t.charge > 0 && !s.target && k && now - k.t < 7) {                    // carga explosiva: abre una pared o una puerta y entra por sorpresa
      const spot = this.breachSpot(s, k);
      if (spot >= 0) { s.act = { type: 'hold', t: 0, dur: 1.1, face: Math.atan2(k.y - s.y, k.x - s.x), useTool: 'charge', spot }; s.mode = 'hold'; return; }
    }
    if (!s.target && this.tac && this.tac.choke[i] && !this.doorGrid[i]) {
      const near = (L, r) => L.some((q) => Math.hypot(q.x - s.x, q.y - s.y) < r);
      if (t.trap > 0 && !near(this.traps, 5) && rnd() < 0.35) { s.act = { type: 'hold', t: 0, dur: 0.8, face: s.angle, useTool: 'trap' }; return; }
      if (t.mine > 0 && !near(this.minesList || [], 4) && rnd() < 0.3) { s.act = { type: 'hold', t: 0, dur: 0.8, face: s.angle, useTool: 'mine' }; return; }
    }
    if (t.sensor > 0 && !s.target && (s.mode === 'hold' || s.mode === 'nest' || s.mode === 'squad') && !this.sensors.some((q) => Math.hypot(q.x - s.x, q.y - s.y) < 8)) { s.act = { type: 'hold', t: 0, dur: 0.7, face: s.angle, useTool: 'sensor' }; return; }
  };
  /** Termina de usar una herramienta (cuando acaba la espera). */
  G.finishTool = function (s, act) {
    const t = this.toolsOf(s), kind = act.useTool, W = this.W;
    if (!(t[kind] > 0)) return;
    t[kind]--;
    if (s.anim) s.anim.pickT = 0.35;
    if (kind === 'charge') {
      const i = act.spot, x = (i % W) + 0.5, y = ((i / W) | 0) + 0.5;
      this.charges.push({ x: x + (s.x - x) * 0.35, y: y + (s.y - y) * 0.35, t: this.time + 2.6, owner: s });
      const ang = Math.atan2(s.y - y, s.x - x), back = this.floorIdxNear(s.x + Math.cos(ang) * 3.5, s.y + Math.sin(ang) * 3.5);
      const p = this.bfs(Math.floor(s.x), Math.floor(s.y), (j) => j === back, 12); if (p) { s.path = p; s.mode = 'flee'; s.fleeT = this.time - 10; }   // se aleja antes de que explote
      if (s.team >= 0) s.bubble = { text: '¡Carga puesta!', t: 1.4, radio: true };
    } else if (kind === 'trap') this.traps.push({ x: s.x, y: s.y, team: s.team, owner: s, ang: s.angle + Math.PI / 2 });
    else if (kind === 'mine') (this.minesList || (this.minesList = [])).push({ x: s.x, y: s.y, team: s.team, owner: s, armT: this.time + 1.5 });
    else if (kind === 'sensor') this.sensors.push({ x: s.x, y: s.y, team: s.team, owner: s, until: this.time + 45, ping: 0 });
    else if (kind === 'shield') this.deployShield(s, act.ang != null ? act.ang : s.angle);
  };
  /** Escudo portátil: una placa de metal en el casillero de adelante (frena balas como un cajón, aguanta más). */
  G.deployShield = function (s, ang) {
    const W = this.W, x = Math.floor(s.x + Math.cos(ang) * 1), y = Math.floor(s.y + Math.sin(ang) * 1), i = y * W + x;
    if (this.g[i] || this.doorGrid[i] || this.soldiers.some((o) => o.alive && Math.floor(o.x) === x && Math.floor(o.y) === y)) { this.toolsOf(s).shield++; return false; }
    this.pr[i] = 1; this.g[i] = 1; this.prHp[i] = 260; this.prKind.set(i, 'shield');
    this.emitSound(s.x, s.y, 5, 'door', s);
    if (this.tac) { this.lineLen = null; this.buildTactics(); }
    return true;
  };
  // sin cobertura cerca: da vuelta una mesa o planta el escudo
  const coverOld = G.beginCover;
  G.beginCover = function (s, e) {
    if (this.tables && this.tables.size && rnd() < 0.6) { const f = this.flipNearTable(s, e); if (f === true) { s.mode = 'hold'; s.path = []; return true; } if (f === 'go') return true; }   // una mesa a mano: la da vuelta y se tira atrás
    if (coverOld.call(this, s, e)) return true;
    const f = this.flipNearTable(s, e); if (f === true) { s.mode = 'hold'; s.path = []; return true; } if (f === 'go') return true;
    const t = s.tools;
    if (t && t.shield > 0 && !s.act) { s.act = { type: 'hold', t: 0, dur: 0.6, face: Math.atan2(e.y - s.y, e.x - s.x), useTool: 'shield', ang: Math.atan2(e.y - s.y, e.x - s.x) }; s.mode = 'hold'; s.path = []; return true; }
    return false;
  };
  /* ----- mesas que se dan vuelta ----- */
  G.flipNearTable = function (s, e) {
    if (!this.tables || !this.tables.size || s.act) return false;
    const W = this.W, toE = Math.atan2(e.y - s.y, e.x - s.x);
    for (const [i, tb] of this.tables) {
      if (tb.flipped) continue;
      const x = tb.x + 0.5, y = tb.y + 0.5, d = Math.hypot(x - s.x, y - s.y);
      if (d > 2.2 || d < 0.5 || Math.abs(angDiff(Math.atan2(y - s.y, x - s.x), toE)) > 1.2) continue;
      if (this.soldiers.some((o) => o.alive && Math.floor(o.x) === tb.x && Math.floor(o.y) === tb.y)) continue;
      s.act = { type: 'hold', t: 0, dur: 0.55, face: Math.atan2(y - s.y, x - s.x), flipTable: i };
      return true;
    }
    for (const [i, tb] of this.tables) {                                       // una mesa un poco más lejos: va a ponerse detrás y la da vuelta
      if (tb.flipped) continue;
      const x = tb.x + 0.5, y = tb.y + 0.5, d = Math.hypot(x - s.x, y - s.y);
      if (d <= 2.2 || d > 5.5 || Math.abs(angDiff(Math.atan2(y - s.y, x - s.x), toE)) > 1.3) continue;
      const bx = Math.floor(x - Math.cos(toE) * 1.2), by = Math.floor(y - Math.sin(toE) * 1.2), bi = by * W + bx;
      if (this.g[bi] || bi === i) continue;
      const p = this.bfs(Math.floor(s.x), Math.floor(s.y), (j) => j === bi, 10); if (!p) continue;
      s.path = p; s.mode = 'flank'; s.flankUntil = this.time + 3; s.act = null;
      return 'go';
    }
    return false;
  };
  G.finishFlip = function (s, i) {
    const tb = this.tables.get(i); if (!tb || tb.flipped) return;
    if (this.soldiers.some((o) => o.alive && Math.floor(o.x) === tb.x && Math.floor(o.y) === tb.y)) return;
    tb.flipped = true; tb.ang = Math.atan2(tb.y + 0.5 - s.y, tb.x + 0.5 - s.x);
    this.pr[i] = 1; this.g[i] = 1; this.prHp[i] = 120; this.prKind.set(i, 'table');
    this.emitSound(tb.x + 0.5, tb.y + 0.5, 7, 'door', s);
    if (this.tac) { this.lineLen = null; this.buildTactics(); }
  };

  /* ================= paso del mundo nuevo ================= */
  G.stepWorld2 = function (dt) {
    const now = this.time;
    this.lightT = Math.max(0, this.lightT - dt);
    for (let i = this.lights.length - 1; i >= 0; i--) { this.lights[i].t -= dt; if (this.lights[i].t <= 0) this.lights.splice(i, 1); }
    for (let i = this.charges.length - 1; i >= 0; i--) {                       // cargas: explotan a tiempo
      const c = this.charges[i]; if (now < c.t) continue;
      this.charges.splice(i, 1); this.explode(c.x, c.y, 2.3, 85, c.owner && c.owner.alive ? c.owner : null, 'charge');
    }
    for (let i = this.traps.length - 1; i >= 0; i--) {                         // trampa con alarma: avisa al equipo dónde pasó alguien
      const tp = this.traps[i];
      const who = this.soldiers.find((o) => o.alive && !o.downed && (tp.team < 0 ? o !== tp.owner : o.team !== tp.team) && Math.hypot(o.x - tp.x, o.y - tp.y) < 0.55);
      if (!who) continue;
      this.traps.splice(i, 1);
      this.announce(`🪤 ¡${who.name} pisó una trampa!`);
      this.emitSound(tp.x, tp.y, 14, 'shout', null);
      for (const m of this.soldiers) if (m.alive && (tp.team < 0 ? m === tp.owner : m.team === tp.team)) { m.know[who.id] = { id: who.id, x: who.x, y: who.y, t: now, exact: true, kind: 'trap', vx: 0, vy: 0 }; m.thinkT = Math.min(m.thinkT, 0.1); }
      who.stunT = Math.max(who.stunT, 0.6);
      if (!this.cfg.noRec && this.speed <= 2) sfx.alarm();
    }
    for (let i = this.sensors.length - 1; i >= 0; i--) {                       // sensor: revela a los que se mueven cerca
      const sn = this.sensors[i]; if (now > sn.until) { this.sensors.splice(i, 1); continue; }
      sn.ping -= dt; if (sn.ping > 0) continue; sn.ping = 1;
      for (const o of this.soldiers) {
        if (!o.alive || (sn.team < 0 ? o === sn.owner : o.team === sn.team) || Math.hypot(o.x - sn.x, o.y - sn.y) > 5.5 || o.gait < 0.2) continue;
        for (const m of this.soldiers) if (m.alive && (sn.team < 0 ? m === sn.owner : m.team === sn.team)) m.know[o.id] = { id: o.id, x: o.x, y: o.y, t: now, exact: true, kind: 'sensor', vx: 0, vy: 0 };
        o.sensedT = now + 1;
      }
    }
    if (this.weather && (this.weather === 'storm') && now > this.nextBolt) {     // relámpago: ilumina todo un instante y truena
      this.nextBolt = now + 9 + rnd() * 14; this.lightT = 0.28; this.boltT = now;
      setTimeout(() => { if (!this.dead && !this.cfg.noRec && this.speed <= 2) App.audio.noise(1.6, { vol: 0.28, freq: 160, q: 0.6, type: 'lowpass', sweepTo: 50 }); }, 700 + rnd() * 900);
    }
    if (this.heli) {                                                            // helicóptero: un foco que barre el mapa y delata a quien ilumina
      const h = this.heli; h.t += dt; h.x += h.vx * dt; h.y += h.vy * dt;
      if (h.x < 2 || h.x > this.W - 2) h.vx *= -1; if (h.y < 2 || h.y > this.H - 2) h.vy *= -1;
      h.ping -= dt;
      if (h.ping <= 0) { h.ping = 0.5; for (const o of this.soldiers) if (o.alive && Math.hypot(o.x - h.x, o.y - h.y) < h.r) for (const m of this.enemiesOf(o)) m.know[o.id] = { id: o.id, x: o.x, y: o.y, t: now, exact: false, kind: 'heli', vx: 0, vy: 0 }; }
      if (now > h.until) { this.heli = null; this.announce('🚁 El helicóptero se fue.'); }
    }
    if (this.flood && now > this.flood.until) {                                 // se seca la inundación
      for (const [i, ft] of this.flood.prev) this.floorT[i] = ft;
      this.flood = null; this.announce('🌊 El agua bajó.'); if (this.static) this.buildStatic();
    }
    const smokesNow = this.smokes.filter((q) => q.type === 'smoke').length;     // alarma de humo: suena fuerte y tapa los demás ruidos
    if (smokesNow >= 2 && !(this.smokeAlarmT > now) && !(this.smokeAlarmCd > now)) { this.smokeAlarmT = now + 8; this.smokeAlarmCd = now + 40; this.announce('🔔 ¡Saltó la alarma de humo! No se oye nada.'); if (!this.cfg.noRec && this.speed <= 2) sfx.alarm(); }
    this.soundMul = (this.weather === 'rain' || this.weather === 'storm' ? 0.78 : 1) * (this.smokeAlarmT > now ? 0.6 : 1);
    if (this.generator && this.event && this.event.type === 'blackout') {       // el generador: alguien lo prende y vuelve la luz
      const gn = this.generator;
      const at = this.soldiers.find((o) => o.alive && !o.downed && Math.hypot(o.x - gn.x, o.y - gn.y) < 0.9);
      gn.prog = at ? gn.prog + dt : Math.max(0, gn.prog - dt * 0.5);
      if (gn.prog >= 2.5) { this.announce(`🔌 ¡${at ? at.name : 'Alguien'} prendió el generador!`); this.generator = null; this.endEvent(); }
    }
  };
  // cintas transportadoras y agua: empujan y frenan
  G.floorEffects = function (s, dt) {
    const i = Math.floor(s.y) * this.W + Math.floor(s.x), c = this.conv[i];
    if (c) this.tryMove(s, CONV[c][0] * 1.1 * dt, CONV[c][1] * 1.1 * dt);
    return this.floorT[i] === 5 ? 0.55 : 1;                                     // en el agua se camina más lento
  };
  const emitOld = G.emitSound;
  G.emitSound = function (x, y, r, kind, src) { return emitOld.call(this, x, y, r * (this.soundMul || 1), kind, src); };
  G.setWeather = function (w) {
    this.weather = w;
    if (w === 'fog') this.fogMul = 0.5;
    if (w === 'storm') this.nextBolt = 6 + rnd() * 8;
  };

  /* ================= eventos nuevos ================= */
  const startOld = G.startRandomEvent;
  G.startRandomEvent = function () {
    const r = rnd();
    if (!this.event && r < 0.16) return this.startFlood();
    if (!this.heli && r < 0.3) return this.startHeli();
    startOld.call(this);
    if (this.event && this.event.type === 'blackout' && !this.generator) {       // en el apagón aparece un generador para volver a prender la luz
      let best = null, bd = -1;
      for (let k = 0; k < 20; k++) { const i = this.floor[rint(this.floor.length)], x = (i % this.W) + 0.5, y = ((i / this.W) | 0) + 0.5; let md = 99; for (const s of this.soldiers) if (s.alive) md = Math.min(md, Math.hypot(s.x - x, s.y - y)); if (md > bd) { bd = md; best = { x, y }; } }
      if (best) { this.generator = Object.assign(best, { prog: 0 }); this.announce('🔌 Hay un generador: si alguien lo prende vuelve la luz.'); }
    }
  };
  const endOld = G.endEvent;
  G.endEvent = function () { const wasBlack = this.event && this.event.type === 'blackout'; endOld.call(this); if (wasBlack) { this.generator = null; if (this.night) this.darkAll = true; } };
  G.startFlood = function () {
    const W = this.W, start = this.floor[rint(this.floor.length)], n = this.bfs(start % W, (start / W) | 0, null, 7, true);
    const prev = new Map(); for (let q = 0; q < Math.min(n, 90); q++) { const i = this.queue[q]; prev.set(i, this.floorT[i]); this.floorT[i] = 5; }
    this.flood = { prev, until: this.time + 40 }; this.stats.events++; this.nextEventAt = this.time + 42 + rnd() * 30;
    this.announce('🌊 ¡Se inundó un sector! En el agua se camina lento y se hace ruido.');
    if (this.static) this.buildStatic();
  };
  G.startHeli = function () {
    this.heli = { x: 2, y: 2 + rnd() * (this.H - 4), vx: 2.2, vy: (rnd() - 0.5) * 1.6, r: 3.2, t: 0, until: this.time + 26, ping: 0 };
    this.stats.events++; this.nextEventAt = this.time + 42 + rnd() * 30;
    this.announce('🚁 ¡Un helicóptero con un foco! Al que ilumina lo ven todos.');
  };

  /* ================= dibujo ================= */
  G.drawWorld2 = function (x, ts, left, top, right, bottom) {
    const W = this.W, now = this.time;
    const inV = (px, py) => px > left - 2 && px < right + 2 && py > top - 2 && py < bottom + 2;
    for (let ty = Math.max(0, Math.floor(top)); ty < Math.min(this.H, Math.ceil(bottom)); ty++) for (let tx = Math.max(0, Math.floor(left)); tx < Math.min(W, Math.ceil(right)); tx++) {
      const i = ty * W + tx, px = tx * ts, py = ty * ts;
      if (this.holed[i]) {                                                      // pared agujereada
        x.fillStyle = '#3c4a6b'; x.fillRect(px, py, ts, ts);
        x.fillStyle = '#141a2a'; x.beginPath(); x.arc(px + ts * 0.35, py + ts * 0.45, ts * 0.22, 0, TAU); x.arc(px + ts * 0.68, py + ts * 0.6, ts * 0.16, 0, TAU); x.fill();
      }
      const c = this.conv[i];
      if (c) {                                                                  // cinta transportadora con flechas que avanzan
        x.fillStyle = '#2a2f3a'; x.fillRect(px, py, ts, ts);
        x.save(); x.translate(px + ts / 2, py + ts / 2); x.rotate(Math.atan2(CONV[c][1], CONV[c][0]));
        const off = ((now * 1.1) % 1) * ts;
        x.strokeStyle = '#facc15'; x.lineWidth = Math.max(1.5, ts * 0.07);
        for (let k = -1; k <= 1; k++) { const ax = -ts / 2 + off + k * ts / 2; if (ax < -ts / 2 || ax > ts / 2) continue; x.beginPath(); x.moveTo(ax - ts * 0.12, -ts * 0.15); x.lineTo(ax, 0); x.lineTo(ax - ts * 0.12, ts * 0.15); x.stroke(); }
        x.restore();
      }
      if (this.floorT[i] === 5) { x.fillStyle = `rgba(56,140,220,${0.35 + Math.sin(now * 2 + tx + ty) * 0.06})`; x.fillRect(px, py, ts, ts); }
    }
    for (const [i, tb] of this.tables) {                                         // mesas: de pie o dadas vuelta (cobertura)
      if (!inV(tb.x, tb.y)) continue;
      x.save(); x.translate(tb.x * ts + ts / 2, tb.y * ts + ts / 2);
      if (!tb.flipped) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(-ts * 0.42 + 2, -ts * 0.32 + 3, ts * 0.84, ts * 0.64); x.fillStyle = '#9a6b3c'; x.fillRect(-ts * 0.42, -ts * 0.32, ts * 0.84, ts * 0.64); x.strokeStyle = '#5a3a1a'; x.lineWidth = 1.5; x.strokeRect(-ts * 0.42, -ts * 0.32, ts * 0.84, ts * 0.64); }
      else if (this.pr[i]) { x.rotate(tb.ang + Math.PI / 2); x.fillStyle = '#7b5230'; x.fillRect(-ts * 0.45, -ts * 0.14, ts * 0.9, ts * 0.28); x.fillStyle = '#5a3a1a'; for (const k of [-0.36, 0.36]) { x.fillRect(ts * k - 2, ts * 0.14, 4, ts * 0.3); } }
      x.restore();
    }
    for (const [i, k] of this.prKind) {                                           // escudos portátiles
      if (k !== 'shield' || !this.pr[i]) continue;
      const tx = i % W, ty = (i / W) | 0; if (!inV(tx, ty)) continue;
      const g = x.createLinearGradient(tx * ts, ty * ts, tx * ts + ts, ty * ts + ts); g.addColorStop(0, '#9ca3af'); g.addColorStop(0.5, '#e5e7eb'); g.addColorStop(1, '#4b5563');
      x.fillStyle = g; x.beginPath(); x.roundRect(tx * ts + ts * 0.1, ty * ts + ts * 0.1, ts * 0.8, ts * 0.8, ts * 0.15); x.fill(); x.strokeStyle = '#1f2937'; x.lineWidth = 2; x.stroke();
      x.fillStyle = '#38bdf8'; x.fillRect(tx * ts + ts * 0.3, ty * ts + ts * 0.42, ts * 0.4, ts * 0.12);
    }
    for (const l of this.lamps) {                                                // lámparas
      if (!inV(l.x, l.y)) continue;
      x.fillStyle = l.on ? '#fde68a' : '#4b5563'; x.beginPath(); x.arc(l.x * ts, l.y * ts, ts * 0.16, 0, TAU); x.fill(); x.strokeStyle = '#111'; x.lineWidth = 1; x.stroke();
    }
    for (const c of this.charges) {                                               // cargas explosivas con su luz que titila
      x.fillStyle = '#7f1d1d'; x.fillRect(c.x * ts - ts * 0.18, c.y * ts - ts * 0.12, ts * 0.36, ts * 0.24);
      x.fillStyle = Math.floor(now * 6) % 2 ? '#ef4444' : '#fecaca'; x.beginPath(); x.arc(c.x * ts, c.y * ts, ts * 0.06, 0, TAU); x.fill();
    }
    for (const tp of this.traps) {                                                // trampas: un alambre finito
      x.strokeStyle = 'rgba(220,220,220,.55)'; x.lineWidth = 1; x.beginPath(); x.moveTo((tp.x - Math.cos(tp.ang) * 0.5) * ts, (tp.y - Math.sin(tp.ang) * 0.5) * ts); x.lineTo((tp.x + Math.cos(tp.ang) * 0.5) * ts, (tp.y + Math.sin(tp.ang) * 0.5) * ts); x.stroke();
    }
    for (const sn of this.sensors) {                                              // sensores con su pulso
      x.fillStyle = '#0ea5e9'; x.beginPath(); x.arc(sn.x * ts, sn.y * ts, ts * 0.13, 0, TAU); x.fill();
      const k = 1 - sn.ping; x.strokeStyle = `rgba(14,165,233,${0.4 * (1 - k)})`; x.lineWidth = 1.5; x.beginPath(); x.arc(sn.x * ts, sn.y * ts, ts * 5.5 * k, 0, TAU); x.stroke();
    }
    if (this.generator) {                                                         // generador del apagón
      const gn = this.generator; x.font = `${ts * 0.8}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🔌', gn.x * ts, gn.y * ts);
      if (gn.prog > 0) { x.fillStyle = '#111'; x.fillRect(gn.x * ts - ts * 0.6, gn.y * ts + ts * 0.5, ts * 1.2, 5); x.fillStyle = '#facc15'; x.fillRect(gn.x * ts - ts * 0.6, gn.y * ts + ts * 0.5, ts * 1.2 * gn.prog / 2.5, 5); }
    }
  };
  /** Encima de todo: foco del helicóptero, lluvia y relámpagos. */
  G.drawWeather = function (x, left, top) {
    const ts = this.ts, cw = this.cw, ch = this.ch, now = this.time;
    if (this.heli) {
      const h = this.heli, cx = (h.x - left) * ts, cy = (h.y - top) * ts, g = x.createRadialGradient(cx, cy, 0, cx, cy, h.r * ts);
      g.addColorStop(0, 'rgba(255,255,220,.38)'); g.addColorStop(1, 'rgba(255,255,220,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, h.r * ts, 0, TAU); x.fill();
      x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(cx + ts * 2.5, cy + ts * 2.2, ts * 1.2, ts * 0.5, 0.3, 0, TAU); x.fill();
    }
    if (this.weather === 'rain' || this.weather === 'storm') {
      x.fillStyle = 'rgba(20,30,50,.18)'; x.fillRect(0, 0, cw, ch);
      x.strokeStyle = 'rgba(180,200,230,.35)'; x.lineWidth = 1;
      x.beginPath();
      const n = this.quality === 'ahorro' ? 40 : 90;
      for (let k = 0; k < n; k++) { const sx = ((k * 97.3 + now * 60 * (1 + (k % 3) * 0.2)) % (cw + 40)) - 20, sy = ((k * 53.7 + now * 520 * (1 + (k % 4) * 0.1)) % (ch + 40)) - 20; x.moveTo(sx, sy); x.lineTo(sx - 4, sy + 12); }
      x.stroke();
    }
    if (this.lightT > 0) { x.fillStyle = `rgba(230,235,255,${this.lightT * 1.6})`; x.fillRect(0, 0, cw, ch); }
  };
  /** Huecos de luz extra en la capa oscura: lámparas con sus sombras, fogonazos, explosiones, foco. */
  G.lightHoles = function (f, left, top) {
    const ts = this.ts;
    for (const l of this.lamps) {
      if (!l.on || !l.poly) continue;
      const cx = (l.x - left) * ts, cy = (l.y - top) * ts, g = f.createRadialGradient(cx, cy, 0, cx, cy, l.r * ts);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.65, 'rgba(0,0,0,.8)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = g; f.beginPath(); l.poly.forEach(([px, py], k) => { if (k) f.lineTo(cx + px * ts, cy + py * ts); else f.moveTo(cx + px * ts, cy + py * ts); }); f.closePath(); f.fill();
    }
    for (const l of this.lights) { const cx = (l.x - left) * ts, cy = (l.y - top) * ts; f.fillStyle = 'rgba(0,0,0,.85)'; f.beginPath(); f.arc(cx, cy, l.r * ts, 0, TAU); f.fill(); }
    if (this.heli) { const cx = (this.heli.x - left) * ts, cy = (this.heli.y - top) * ts; f.fillStyle = 'rgba(0,0,0,1)'; f.beginPath(); f.arc(cx, cy, this.heli.r * ts, 0, TAU); f.fill(); }
  };

  /* ================= herramienta tirada en el piso ================= */
  const TOOL_IC = { charge: '🧨', mine: '💥', trap: '🪤', sensor: '📡', shield: '🛡️', binoc: '🔭' };
  G.drawToolItem = function (x, it, ts) {
    const px = it.x * ts, py = it.y * ts, bob = Math.sin(this.time * 3 + it.x) * ts * 0.05;
    x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(px, py + ts * 0.28, ts * 0.3, ts * 0.1, 0, 0, TAU); x.fill();
    x.fillStyle = 'rgba(255,200,60,.22)'; x.beginPath(); x.arc(px, py + bob, ts * 0.42, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(255,210,80,.8)'; x.lineWidth = Math.max(1, ts * 0.05); x.stroke();
    x.font = `${ts * 0.55}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(TOOL_IC[it.type] || '🧰', px, py + bob);
  };

  /* ================= modo manual: usar una herramienta ================= */
  G.manualTool = function () {
    const s = this.soldiers.find((q) => q.manual && q.alive); if (!s || s.act) return false;
    const t = this.toolsOf(s), W = this.W;
    if (t.charge > 0) { for (let d = 0.6; d <= 1.6; d += 0.25) { const i = Math.floor(s.y + Math.sin(s.angle) * d) * W + Math.floor(s.x + Math.cos(s.angle) * d); if ((this.wallHp[i] > 0 && this.wl[i]) || (this.doorGrid[i] && doorClosed(this.doors.get(i)))) { s.act = { type: 'hold', t: 0, dur: 0.9, face: s.angle, useTool: 'charge', spot: i }; return true; } } }
    for (const k of ['shield', 'trap', 'mine', 'sensor']) if (t[k] > 0) { s.act = { type: 'hold', t: 0, dur: 0.6, face: s.angle, useTool: k, ang: s.angle }; return true; }
    return false;
  };
  App.World = { TOOLS };
})();
