/* El mundo vivo (0.5): cajones, barriles, ventanas, pisos, luces y oscuridad, granadas, humo,
   explosiones y eventos del mapa (apagón, niebla, alarma, suministros).
   Se carga después de battle.js y le agrega métodos a la partida. */
'use strict';

(() => {
  const { rnd, rint, sfx } = App;
  const E = App.battle;
  const { Game, WEAPONS, FOV, angDiff, clamp, doorClosed } = E;
  const G = Game.prototype;

  const FLOOR_STEP = [1, 0.45, 1.7, 1.35];            // multiplicador del ruido de pasos: normal, alfombra, metal, grava
  const FUSE = { frag: 2.4, smoke: 1.1, flash: 1.7 };

  /* ================= armado del mundo ================= */
  G.initWorld = function (m) {
    const N = this.W * this.H, W = this.W;
    this.wl = Uint8Array.from(this.g);                                    // paredes de verdad (lo que frena vista, balas y sonido)
    this.pr = new Uint8Array(N);                                          // 1 cajón · 2 barril · 3 ventana
    this.prHp = new Float32Array(N);
    this.glass = new Uint8Array(N);                                       // 1 vidrio entero · 2 roto
    this.floorT = m.floorT || new Uint8Array(N);
    this.dark = m.dark || new Uint8Array(N);
    this.labels = m.labels || [];
    for (const w of m.windows || []) {                                    // ventana: se ve y se dispara a través, pero no se pasa
      const i = w.y * W + w.x;
      if (this.wl[i]) { this.wl[i] = 0; this.pr[i] = 3; this.glass[i] = 1; }
    }
    for (const p of m.props || []) {
      const i = p.y * W + p.x;
      if (this.g[i] || this.doorGrid[i] || this.pr[i]) continue;
      this.pr[i] = p.k === 'barrel' ? 2 : 1; this.prHp[i] = p.k === 'barrel' ? 55 : 110; this.g[i] = 1;
    }
    this.grenades = []; this.smokes = []; this.booms = []; this.scorch = []; this.supplies = []; this.flashes = [];
    this.event = null; this.fogMul = 1; this.darkAll = false; this.eventText = ''; this.alarmT = 0;
    this.nextEventAt = 45 + this.srnd() * 25;
    this.stats = { exploded: 0, crates: 0, glass: 0, thrown: 0, events: 0, drops: 0 };
  };

  /* ================= vista, balas y sonido ================= */
  G.isOpaque = function (x, y) {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return true;
    const i = y * this.W + x;
    if (this.wl[i]) return true;
    return this.doorGrid[i] === 1 && doorClosed(this.doors.get(i));
  };
  G.inSmoke = function (px, py) {
    for (const s of this.smokes) if (s.type === 'smoke' && Math.hypot(px - s.x, py - s.y) < s.r) return true;
    return false;
  };
  /** ¿Se ve de un punto a otro? Frenan las paredes, las puertas cerradas y el humo (los cajones no). */
  G.los = function (x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy), n = Math.ceil(d / 0.2), sm = this.smokes.length > 0;
    for (let i = 1; i < n; i++) {
      const t = i / n, px = x0 + dx * t, py = y0 + dy * t;
      if (this.isOpaque(Math.floor(px), Math.floor(py)) || (sm && this.inSmoke(px, py))) return false;
    }
    return true;
  };
  /** ¿Puede llegar una bala? Los cajones frenan balas salvo las del que está pegado al cajón (disparar por encima). */
  G.losShot = function (x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy), n = Math.ceil(d / 0.2);
    for (let i = 1; i < n; i++) {
      const t = i / n, idx = Math.floor(y0 + dy * t) * this.W + Math.floor(x0 + dx * t);
      if (this.wl[idx] || (this.pr[idx] === 1 && d * t > 1.35)) return false;
    }
    return true;
  };
  /** Cuántas paredes (y puertas cerradas, a medias) hay entre dos puntos: apaga el sonido. */
  G.wallsBetween = function (x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.hypot(dx, dy) / 0.4);
    let c = 0, last = -1;
    for (let i = 1; i < n; i++) {
      const tx = Math.floor(x0 + dx * (i / n)), ty = Math.floor(y0 + dy * (i / n)), idx = ty * this.W + tx;
      if (idx === last) continue; last = idx;
      if (this.isWall(tx, ty)) c += 1;
      else if (this.pr[idx] === 3) c += this.glass[idx] === 1 ? 0.35 : 0;                  // el vidrio tapa un poco el sonido
      else if (this.doorGrid[idx] && doorClosed(this.doors.get(idx))) c += 0.5;
    }
    return c;
  };

  /** Una bala pasa por un casillero: ¿se detiene? Rompe vidrios, daña cajones y barriles. */
  G.bulletTile = function (b, bx, by) {
    if (bx < 0 || by < 0 || bx >= this.W || by >= this.H) return true;
    const i = by * this.W + bx;
    if (this.wl[i]) {
      const hx = b.x - b.vx * 0.016, hy = b.y - b.vy * 0.016;
      this.spark(hx, hy, '#ffe08a', 2);
      if (!this.cfg.noRec) { this.addDecal('hole', b.x, b.y); for (let k = 0; k < 3; k++) this.parts.push({ x: hx, y: hy, vx: -b.vx * 0.05 + (rnd() - 0.5) * 1.5, vy: -b.vy * 0.05 + (rnd() - 0.5) * 1.5, life: 0.5, max: 0.8, color: '#a8a29e', size: 0.07 + rnd() * 0.05 }); }   // polvo de la pared
      return true;
    }
    const p = this.pr[i];
    if (!p) return false;
    if (p === 3) { if (this.glass[i] === 1) this.breakGlass(i, b.owner); return false; }
    if (p === 1) {
      if ((b.d || 0) <= 1.35) return false;                                                // tirador pegado al cajón: dispara por encima
      this.damageProp(i, b.dmg * 0.6, b.owner); this.spark(b.x, b.y, '#d4a373', 5); this.addDecal('hole', b.x, b.y); return true;     // astillas
    }
    this.damageProp(i, b.dmg, b.owner);                                                     // barril
    return true;
  };
  G.breakGlass = function (i, by) {
    this.glass[i] = 2; this.stats.glass++;
    const x = (i % this.W) + 0.5, y = ((i / this.W) | 0) + 0.5;
    for (let k = 0; k < 9; k++) { const a = rnd() * 6.283, v = 1 + rnd() * 3; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + rnd() * 0.4, max: 0.8, color: '#cdeaff', size: 0.05 + rnd() * 0.05 }); }
    if (this.speed <= 2) sfx.glass(this.camPan(x), this.camVol(x, y));
    this.emitSound(x, y, 9, 'door', by && by.alive ? by : null);                           // el estruendo delata el tiroteo
  };
  G.damageProp = function (i, dmg, by) {
    if (!this.pr[i]) return;
    this.prHp[i] -= dmg;
    if (this.prHp[i] > 0) return;
    const x = (i % this.W) + 0.5, y = ((i / this.W) | 0) + 0.5, kind = this.pr[i];
    this.pr[i] = 0; this.g[i] = 0;                                                          // ya no estorba: el camino se libera
    if (kind === 2) { this.booms.push({ x, y, owner: by, t: 0.1, R: 2.5, dmg: 75, kind: 'barrel' }); this.stats.exploded++; }
    else {
      this.stats.crates++;
      for (let k = 0; k < 8; k++) { const a = rnd() * 6.283, v = 1 + rnd() * 2.5; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + rnd() * 0.4, max: 0.9, color: '#b98048', size: 0.07 + rnd() * 0.07 }); }
      this.emitSound(x, y, 6, 'door', by && by.alive ? by : null);
    }
  };
  /** Todo lo que está cerca de un barril (para la IA: no pararse al lado, o dispararle). */
  G.barrelsNear = function (x, y, r) {
    const out = [], W = this.W;
    for (let ty = Math.max(0, Math.floor(y - r)); ty <= Math.min(this.H - 1, Math.floor(y + r)); ty++)
      for (let tx = Math.max(0, Math.floor(x - r)); tx <= Math.min(W - 1, Math.floor(x + r)); tx++)
        if (this.pr[ty * W + tx] === 2 && Math.hypot(tx + 0.5 - x, ty + 0.5 - y) <= r) out.push({ i: ty * W + tx, x: tx + 0.5, y: ty + 0.5 });
    return out;
  };
  G.stepMul = function (x, y) { return FLOOR_STEP[this.floorT[Math.floor(y) * this.W + Math.floor(x)] || 0]; };

  /* ================= explosiones ================= */
  G.explode = function (x, y, R, dmg, owner, kind) {
    this.scorch.push({ x, y, r: R * 0.55, t: 0 });
    this.flashes.push({ x, y, t: 0, big: true });
    for (let i = 0; i < 26; i++) { const a = rnd() * 6.283, v = 2 + rnd() * 6; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + rnd() * 0.6, max: 1, color: i % 3 ? '#ffb347' : '#6b7280', size: 0.1 + rnd() * 0.15 }); }
    this.parts.push({ x, y, vx: 0, vy: 0, life: 0.5, max: 0.5, color: '#ffd9a0', size: 1, ring: true });
    this.emitSound(x, y, 20, 'boom', owner && owner.alive ? owner : null);
    if (this.speed <= 2) sfx.boom(this.camPan(x), this.camVol(x, y));
    if (this.cfg.camShake !== false) this.shake = Math.max(this.shake || 0, 0.5);
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d > R) continue;
      if (d > 0.7 && !this.losShot(x, y, s.x, s.y)) continue;                              // una pared o un cajón lo protege
      s._boom = { x, y, t: this.time };
      this.damage(s, owner || null, dmg * Math.max(0.2, 1 - d / R), false);
      if (s.alive && kind === 'frag') s.stunT = Math.max(s.stunT, 0.8);
    }
    const W = this.W;
    for (let ty = Math.max(1, Math.floor(y - R)); ty <= Math.min(this.H - 2, Math.floor(y + R)); ty++)
      for (let tx = Math.max(1, Math.floor(x - R)); tx <= Math.min(W - 2, Math.floor(x + R)); tx++) {
        const i = ty * W + tx, d = Math.hypot(tx + 0.5 - x, ty + 0.5 - y);
        if (d > R || !this.pr[i]) continue;
        if (this.pr[i] === 3) { if (this.glass[i] === 1) this.breakGlass(i, owner); } else this.damageProp(i, dmg * 1.2 * (1 - d / R) + 20, owner);
      }
  };

  /* ================= granadas ================= */
  /** Un paso de la física de la granada: avanza, frena con el piso y rebota contra paredes, puertas, cajones y barriles. */
  G.gStep = function (p, dt) {
    const f = Math.exp(-1.5 * dt); p.vx *= f; p.vy *= f;
    let nx = p.x + p.vx * dt;
    if (this.isSolid(Math.floor(nx), Math.floor(p.y))) { p.vx = -p.vx * 0.55; nx = p.x; }
    p.x = nx;
    let ny = p.y + p.vy * dt;
    if (this.isSolid(Math.floor(p.x), Math.floor(ny))) { p.vy = -p.vy * 0.55; ny = p.y; }
    p.y = ny;
  };
  /** Dónde terminaría una granada lanzada así (sirve para tirarla "doblando la esquina"). */
  G.simGrenade = function (sx, sy, ang, speed, fuse) {
    const p = { x: sx + Math.cos(ang) * 0.5, y: sy + Math.sin(ang) * 0.5, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed };
    if (this.isSolid(Math.floor(p.x), Math.floor(p.y))) { p.x = sx; p.y = sy; }
    for (let t = 0; t < fuse; t += 1 / 30) this.gStep(p, 1 / 30);
    return p;
  };
  G.throwGrenade = function (s, type, ang, speed) {
    if (!s.gren || s.gren[type] <= 0) return false;
    s.gren[type]--;
    const sx = s.x + Math.cos(ang) * 0.5, sy = s.y + Math.sin(ang) * 0.5;
    const ok = !this.isSolid(Math.floor(sx), Math.floor(sy));
    this.grenades.push({ type, x: ok ? sx : s.x, y: ok ? sy : s.y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, t: 0, fuse: FUSE[type], owner: s, spin: 0 });
    s.stats.thrown = (s.stats.thrown || 0) + 1; this.stats.thrown++;
    this.emitSound(s.x, s.y, 4, 'step', s);
    return true;
  };
  G.flashBang = function (x, y, owner) {
    this.flashes.push({ x, y, t: 0 });
    this.emitSound(x, y, 14, 'boom', owner && owner.alive ? owner : null);
    if (this.speed <= 2) sfx.boom(this.camPan(x), this.camVol(x, y));
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d > 9 || (d > 0.8 && !this.los(x, y, s.x, s.y))) continue;
      const facing = Math.abs(angDiff(s.look, Math.atan2(y - s.y, x - s.x))) < 1.5 ? 1 : 0.4;   // mirando hacia la luz: peor
      s.stunT = Math.max(s.stunT, (0.9 + 3.2 * (1 - d / 9)) * facing);
      s.icon = { ch: '💫', t: 1.4 };
      s.act = null; s.cover = null; s.target = null;
    }
  };
  G.stepGrenades = function (dt) {
    for (let i = this.grenades.length - 1; i >= 0; i--) {
      const g = this.grenades[i];
      this.gStep(g, dt); g.t += dt; g.spin += dt * 9;
      if (g.t < g.fuse) continue;
      this.grenades.splice(i, 1);
      if (g.type === 'frag') this.explode(g.x, g.y, 3.3, 95, g.owner, 'frag');
      else if (g.type === 'flash') this.flashBang(g.x, g.y, g.owner);
      else { this.smokes.push({ x: g.x, y: g.y, type: 'smoke', t: 0, life: 15, r: 0.9 }); this.emitSound(g.x, g.y, 5, 'boom', null); }
    }
  };

  /* ================= eventos del mapa ================= */
  const EVENT_NAMES = { blackout: '⚡ Apagón', fog: '🌫️ Niebla', alarm: '🚨 ¡Alarma!', supply: '📦 Suministros' };
  G.announce = function (text) { if (this.hooks.onEvent) this.hooks.onEvent(text); };
  G.startRandomEvent = function () {
    const options = ['alarm', 'supply', 'supply'];
    if (!this.event) options.push('blackout', 'fog');
    const type = options[rint(options.length)];
    this.stats.events++;
    this.nextEventAt = this.time + 42 + rnd() * 30;
    if (type === 'blackout') { this.event = { type, until: this.time + 28 + rnd() * 12 }; this.darkAll = true; this.announce('⚡ ¡Apagón! Se ve solo con linterna y de cerca.'); }
    else if (type === 'fog') { this.event = { type, until: this.time + 35 + rnd() * 15 }; this.fogMul = 0.55; this.announce('🌫️ Llegó la niebla: se ve menos lejos.'); }
    else if (type === 'alarm') this.triggerAlarm();
    else this.callSupply();
  };
  G.endEvent = function () {
    if (!this.event) return;
    if (this.event.type === 'blackout') { this.darkAll = false; this.announce('💡 Volvió la luz.'); }
    if (this.event.type === 'fog') { this.fogMul = 1; this.announce('☀️ Se despejó la niebla.'); }
    this.event = null;
  };
  /** La alarma suena en todo el mapa: todos se enteran (más o menos) de dónde están los demás. */
  G.triggerAlarm = function () {
    this.alarmT = 5; this.announce('🚨 ¡ALARMA! Todos saben (más o menos) dónde están los demás.');
    this.rings.push({ x: this.center[0] + 0.5, y: this.center[1] + 0.5, r: 5, t: 0, kind: 'shout' });
    if (this.speed <= 2) sfx.alarm();
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      for (const e of this.enemiesOf(s)) {
        const a = rnd() * 6.283, m = 1 + rnd() * 3;
        s.know[e.id] = { id: e.id, x: e.x + Math.cos(a) * m, y: e.y + Math.sin(a) * m, t: this.time, exact: false, kind: 'alarm', vx: 0, vy: 0 };
      }
      s.alertT = this.time; s.thinkT = Math.min(s.thinkT, 0.2); s.icon = { ch: '🚨', t: 1.5 };
    }
  };
  G.callSupply = function () {
    let best = null, bd = -1;
    for (let k = 0; k < 24; k++) {
      const i = this.floor[rint(this.floor.length)], x = (i % this.W) + 0.5, y = ((i / this.W) | 0) + 0.5;
      let md = 1e9; for (const s of this.soldiers) if (s.alive) md = Math.min(md, Math.hypot(s.x - x, s.y - y));
      if (md > bd) { bd = md; best = [x, y]; }
    }
    if (!best) return;
    const sup = { x: best[0], y: best[1], tLand: this.time + 8, landed: false };
    this.supplies.push(sup); this.stats.drops++;
    this.announce('📦 Cae un cargamento: se escucha el avión. ¡Corran a buscarlo!');
    if (this.speed <= 2) sfx.alarm();
    for (const s of this.soldiers) {                                         // los que lo oyen anotan el lugar (aprox.)
      if (!s.alive) continue;
      const d = Math.hypot(s.x - sup.x, s.y - sup.y), eff = d * (1 + 0.4 * this.wallsBetween(sup.x, sup.y, s.x, s.y));
      if (eff > 45 * (s.sk.listen || 1)) continue;
      const a = rnd() * 6.283, m = 1 + rnd() * 3;
      s.dropAt = { x: sup.x + Math.cos(a) * m, y: sup.y + Math.sin(a) * m, t: this.time, until: sup.tLand + 40 };
      s.icon = { ch: '📦', t: 1.5 }; s.thinkT = Math.min(s.thinkT, 0.3);
    }
  };
  G.landSupply = function (sup) {
    sup.landed = true;
    this.smokes.push({ x: sup.x, y: sup.y, type: 'flare', t: 0, life: 30, r: 1.2 });
    const pool = ['rifle', 'sniper', 'hmg', 'lmg', 'ashotgun'];
    const place = (kind, type, extra) => {
      const a = rnd() * 6.283, m = 0.3 + rnd() * 0.7;
      let x = sup.x + Math.cos(a) * m, y = sup.y + Math.sin(a) * m;
      if (this.isSolid(Math.floor(x), Math.floor(y))) { x = sup.x; y = sup.y; }
      return this.addItem(kind, type, x, y, extra && extra.mag || 0, extra && extra.res || 0, extra && extra.att);
    };
    const wt = pool[rint(pool.length)], d = WEAPONS[wt];
    place('weapon', wt, { mag: d.mag, res: d.res, att: { sup: rnd() < 0.5, scope: rnd() < 0.5, ext: rnd() < 0.3 } });
    place('armor', 'vest'); place('armor', 'helm'); place('med', 'large');
    place('gren', 'frag'); place('gren', rnd() < 0.5 ? 'smoke' : 'flash'); place('pack', 'pack');
    this.announce('📦 ¡Aterrizó el cargamento!');
    this.emitSound(sup.x, sup.y, 16, 'boom', null);
  };

  G.stepWorld = function (dt) {
    this.stepGrenades(dt);
    for (let i = this.booms.length - 1; i >= 0; i--) {                         // explosiones en cadena (con una pequeña demora)
      const b = this.booms[i]; b.t -= dt;
      if (b.t <= 0) { this.booms.splice(i, 1); this.explode(b.x, b.y, b.R, b.dmg, b.owner, b.kind); }
    }
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i]; s.t += dt;
      if (s.type === 'smoke') s.r = Math.min(2.7, 0.9 + s.t * 2.2) * (s.t > s.life - 3 ? Math.max(0.2, (s.life - s.t) / 3) : 1);
      if (s.t >= s.life) this.smokes.splice(i, 1);
    }
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < 0.6);
    for (const c of this.scorch) c.t += dt;
    this.scorch = this.scorch.filter((c) => c.t < 40);
    this.alarmT = Math.max(0, this.alarmT - dt);
    this.overtimeAt = this.M && this.M.noOvertime ? 1e9 : this.cfg.zone ? this.zoneDelay + this.zoneTime + 45 : 420;
    this.overtime = this.time > this.overtimeAt;
    this.shake = Math.max(0, (this.shake || 0) - dt * 2.2);
    if (this.phase !== 'run') return;
    if (this.cfg.events !== false) {
      if (this.event && this.time >= this.event.until) this.endEvent();
      if (this.time >= this.nextEventAt) this.startRandomEvent();
      for (const sup of this.supplies) if (!sup.landed && this.time >= sup.tLand) this.landSupply(sup);
      this.supplies = this.supplies.filter((s) => !s.landed || this.time < s.tLand + 40);
    }
    const bits = [];
    if (this.event) bits.push(`${EVENT_NAMES[this.event.type]} ${Math.ceil(this.event.until - this.time)}s`);
    const pend = this.supplies.find((s) => !s.landed);
    if (pend) bits.push(`📦 en ${Math.ceil(pend.tLand - this.time)}s`);
    if (this.alarmT > 0) bits.push('🚨 Alarma');
    if (this.overtime) bits.push('☠️ Muerte súbita');
    this.eventText = bits.join(' · ');
  };

  /* ================= luces y oscuridad ================= */
  G.isLit = function (x, y) { return !this.darkAll && !this.dark[Math.floor(y) * this.W + Math.floor(x)]; };
  /** ¿Puede `a` ver a `e` con la luz que hay? A oscuras solo de muy cerca, o si hay una linterna de por medio. */
  G.visibleLit = function (a, e, d) {
    if (this.isLit(e.x, e.y) || d <= 2.8 || e.flashlight) return true;
    return !!a.flashlight && d <= 9 && Math.abs(angDiff(a.look, Math.atan2(e.y - a.y, e.x - a.x))) < 0.55;
  };
  G.hasDarkness = function () { return this.darkAll || this.darkAny; };

  /** Capa oscura sobre el mapa con huecos de luz donde hay linternas. */
  G.drawDarkness = function (x, left, top) {
    const ts = this.ts, dpr = this.dpr, cw = this.cw, ch = this.ch, W = this.W, H = this.H;
    if (!this.dk || this.dk.width !== this.cv.width || this.dk.height !== this.cv.height) {
      this.dk = document.createElement('canvas'); this.dk.width = this.cv.width; this.dk.height = this.cv.height; this.dkCtx = this.dk.getContext('2d');
    }
    const f = this.dkCtx;
    f.setTransform(dpr, 0, 0, dpr, 0, 0); f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, cw, ch);
    f.fillStyle = 'rgba(2,4,14,0.8)';
    if (this.darkAll) f.fillRect(0, 0, cw, ch);
    else {
      const x0 = Math.max(0, Math.floor(left)), y0 = Math.max(0, Math.floor(top)), x1 = Math.min(W - 1, Math.ceil(left + cw / ts)), y1 = Math.min(H - 1, Math.ceil(top + ch / ts));
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.dark[ty * W + tx]) f.fillRect((tx - left) * ts, (ty - top) * ts, ts + 0.6, ts + 0.6);
    }
    f.globalCompositeOperation = 'destination-out';
    for (const s of this.soldiers) {
      if (!s.alive || !s.flashlight) continue;
      const cx = (s.x - left) * ts, cy = (s.y - top) * ts;
      const g = f.createRadialGradient(cx, cy, 0, cx, cy, 9 * ts);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = g; f.beginPath(); f.moveTo(cx, cy);
      const N = 36;
      for (let i = 0; i <= N; i++) {                                           // el cono se corta con las paredes
        const a = s.look - 0.55 + (i / N) * 1.1;
        let d = 0.4; while (d < 9 && !this.isOpaque(Math.floor(s.x + Math.cos(a) * d), Math.floor(s.y + Math.sin(a) * d))) d += 0.2;
        f.lineTo(cx + Math.cos(a) * Math.min(d, 9) * ts, cy + Math.sin(a) * Math.min(d, 9) * ts);
      }
      f.closePath(); f.fill();
      f.fillStyle = 'rgba(0,0,0,0.9)'; f.beginPath(); f.arc(cx, cy, 1.5 * ts, 0, 6.283); f.fill();      // halo alrededor de quien la lleva
    }
    for (const sm of this.smokes) if (sm.type === 'flare') { const cx = (sm.x - left) * ts, cy = (sm.y - top) * ts; f.fillStyle = 'rgba(0,0,0,0.6)'; f.beginPath(); f.arc(cx, cy, 3 * ts, 0, 6.283); f.fill(); }
    f.globalCompositeOperation = 'source-over';
    x.drawImage(this.dk, 0, 0, cw, ch);
  };

  /* ================= dibujo ================= */
  /** Lo que no cambia (se dibuja una sola vez en el mapa estático): pisos, vidrios y carteles. */
  G.drawStaticExtras = function (x, ts) {
    const W = this.W, H = this.H;
    for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
      const i = y * W + xx, px = xx * ts, py = y * ts;
      if (this.wl[i]) continue;
      const ft = this.floorT[i];
      if (ft === 1) { x.fillStyle = 'rgba(150,90,190,.17)'; x.fillRect(px, py, ts + 0.5, ts + 0.5); }
      else if (ft === 2) {
        x.fillStyle = 'rgba(190,200,220,.09)'; x.fillRect(px, py, ts + 0.5, ts + 0.5);
        x.strokeStyle = 'rgba(220,230,250,.16)'; x.lineWidth = 1; x.beginPath(); x.moveTo(px + ts * 0.15, py + ts * 0.15); x.lineTo(px + ts * 0.85, py + ts * 0.85); x.moveTo(px + ts * 0.85, py + ts * 0.15); x.lineTo(px + ts * 0.15, py + ts * 0.85); x.stroke();
      } else if (ft === 3) {
        x.fillStyle = 'rgba(160,130,80,.14)'; x.fillRect(px, py, ts + 0.5, ts + 0.5);
        x.fillStyle = 'rgba(210,180,120,.22)'; for (let k = 0; k < 3; k++) x.fillRect(px + ((i * 7 + k * 11) % 10) / 10 * ts, py + ((i * 13 + k * 5) % 10) / 10 * ts, Math.max(1, ts * 0.07), Math.max(1, ts * 0.07));
      }
      if (this.pr[i] === 3) {                                                  // vidrio (o barrotes)
        x.fillStyle = 'rgba(130,200,255,.32)'; x.fillRect(px, py, ts + 0.5, ts + 0.5);
        x.strokeStyle = '#7f95c8'; x.lineWidth = Math.max(1.5, ts * 0.09); x.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
        x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = Math.max(1, ts * 0.05); x.beginPath(); x.moveTo(px + ts * 0.2, py + ts * 0.8); x.lineTo(px + ts * 0.5, py + ts * 0.2); x.stroke();
      }
    }
    // carteles de los cuartos
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `800 ${Math.max(8, ts * 0.42)}px system-ui, sans-serif`;
    for (const l of this.labels) { x.fillStyle = 'rgba(255,255,255,.18)'; x.fillText(l.text, l.x * ts, l.y * ts); }
  };

  const woodGrad = (x, ts) => { const g = x.createLinearGradient(0, 0, ts, ts); g.addColorStop(0, '#c08a4a'); g.addColorStop(1, '#8a5a2b'); return g; };
  /** Cajones, barriles, vidrios rotos, manchas de explosión, granadas, humo y cargamentos. */
  G.drawWorld = function (x, ts, left, top, vw, vh) {
    const W = this.W;
    for (const c of this.scorch) {                                             // manchas negras de las explosiones
      x.fillStyle = `rgba(10,8,6,${Math.max(0, 0.5 - c.t / 80)})`; x.beginPath(); x.arc(c.x * ts, c.y * ts, c.r * ts, 0, 6.283); x.fill();
    }
    const x0 = Math.max(0, Math.floor(left)), y0 = Math.max(0, Math.floor(top)), x1 = Math.min(W - 1, Math.ceil(left + vw)), y1 = Math.min(this.H - 1, Math.ceil(top + vh));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const i = ty * W + tx, p = this.pr[i];
      if (!p) continue;
      const px = tx * ts, py = ty * ts;
      if (p === 3) {
        if (this.glass[i] === 2) { x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(px + 2, py + 2); x.lineTo(px + ts * 0.5, py + ts * 0.45); x.lineTo(px + ts - 2, py + 3); x.moveTo(px + ts * 0.5, py + ts * 0.45); x.lineTo(px + ts * 0.4, py + ts - 2); x.stroke(); x.fillStyle = 'rgba(20,30,50,.35)'; x.fillRect(px + 2, py + 2, ts - 4, ts - 4); }
        continue;
      }
      const hp = this.prHp[i];
      x.save(); x.translate(px + ts / 2, py + ts / 2);
      if (p === 1) {                                                          // cajón de madera
        const s = ts * 0.86;
        x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(-s / 2 + 2, -s / 2 + 3, s, s);
        x.fillStyle = woodGrad(x, s); x.fillRect(-s / 2, -s / 2, s, s);
        x.strokeStyle = '#5a3a1a'; x.lineWidth = Math.max(1.5, ts * 0.07); x.strokeRect(-s / 2, -s / 2, s, s);
        x.beginPath(); x.moveTo(-s / 2, -s / 2); x.lineTo(s / 2, s / 2); x.moveTo(s / 2, -s / 2); x.lineTo(-s / 2, s / 2); x.stroke();
        if (hp < 70) { x.strokeStyle = 'rgba(0,0,0,.55)'; x.beginPath(); x.moveTo(-s * 0.3, -s * 0.4); x.lineTo(0, 0); x.lineTo(s * 0.35, s * 0.1); x.stroke(); }
      } else {                                                                // barril rojo explosivo
        const r = ts * 0.4;
        x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.arc(2, 3, r, 0, 6.283); x.fill();
        const g = x.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r); g.addColorStop(0, '#ff6b5a'); g.addColorStop(1, '#a3201a');
        x.fillStyle = g; x.beginPath(); x.arc(0, 0, r, 0, 6.283); x.fill();
        x.strokeStyle = '#4a0f0b'; x.lineWidth = Math.max(1.5, ts * 0.07); x.stroke();
        x.fillStyle = '#ffd84a'; x.beginPath(); x.arc(0, 0, r * 0.5, 0, 6.283); x.fill();
        x.fillStyle = '#4a0f0b'; x.font = `900 ${r * 0.9}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('!', 0, 1);
      }
      x.restore();
    }
    for (const sup of this.supplies) {                                         // cargamento: sombra y paracaídas mientras cae
      const px = sup.x * ts, py = sup.y * ts;
      if (!sup.landed) {
        const k = Math.max(0, (sup.tLand - this.time) / 8);
        x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(px, py, ts * (1.2 - k * 0.5), ts * (0.8 - k * 0.3), 0, 0, 6.283); x.fill();
        const oy = -k * ts * 14;
        x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(px, py + oy - ts * 0.9, ts * 1.1, Math.PI, 0); x.fill();
        x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 1; x.beginPath(); x.moveTo(px - ts, py + oy - ts * 0.9); x.lineTo(px, py + oy); x.lineTo(px + ts, py + oy - ts * 0.9); x.stroke();
        x.fillStyle = '#5b7a3a'; x.fillRect(px - ts * 0.4, py + oy - ts * 0.4, ts * 0.8, ts * 0.8);
        x.strokeStyle = '#d33'; x.lineWidth = 2; x.strokeRect(px - ts * 0.9, py - ts * 0.9, ts * 1.8, ts * 1.8);
      }
    }
    for (const g of this.grenades) {                                           // granadas en el aire
      const col = g.type === 'frag' ? '#3f6212' : g.type === 'smoke' ? '#9ca3af' : '#fde047';
      x.save(); x.translate(g.x * ts, g.y * ts); x.rotate(g.spin);
      x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.arc(2, 3, ts * 0.22, 0, 6.283); x.fill();
      x.fillStyle = col; x.beginPath(); x.arc(0, 0, Math.max(3, ts * 0.22), 0, 6.283); x.fill();
      x.strokeStyle = '#111'; x.lineWidth = 1.5; x.stroke();
      if (g.type === 'frag' && g.fuse - g.t < 0.8 && Math.floor(g.t * 12) % 2) { x.fillStyle = '#ff3b30'; x.beginPath(); x.arc(0, 0, ts * 0.12, 0, 6.283); x.fill(); }
      x.restore();
    }
  };
  /** Humo y destellos por encima de los soldados. */
  G.drawSmoke = function (x, ts) {
    for (const s of this.smokes) {
      if (s.type === 'smoke') {
        for (let k = 0; k < 7; k++) {
          const a = k * 0.9 + s.t * 0.15, rr = s.r * ts * (0.35 + (k % 3) * 0.2);
          const cx = s.x * ts + Math.cos(a) * s.r * ts * 0.4, cy = s.y * ts + Math.sin(a) * s.r * ts * 0.4;
          const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
          g.addColorStop(0, 'rgba(225,228,235,.78)'); g.addColorStop(1, 'rgba(180,185,195,0)');
          x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rr, 0, 6.283); x.fill();
        }
      } else {                                                                 // bengala roja: marca dónde cayó el cargamento
        const cx = s.x * ts, cy = s.y * ts, pulse = 1 + Math.sin(s.t * 6) * 0.1;
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, ts * 2.6 * pulse);
        g.addColorStop(0, 'rgba(255,70,50,.55)'); g.addColorStop(1, 'rgba(255,70,50,0)');
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, ts * 2.6 * pulse, 0, 6.283); x.fill();
      }
    }
    for (const f of this.flashes) {
      const k = f.t / (f.big ? 0.35 : 0.5);
      if (k >= 1) continue;
      x.fillStyle = f.big ? `rgba(255,200,120,${0.5 * (1 - k)})` : `rgba(255,255,255,${0.85 * (1 - k)})`;
      x.beginPath(); x.arc(f.x * ts, f.y * ts, ts * (f.big ? 3.6 : 7) * (0.4 + k * 0.6), 0, 6.283); x.fill();
    }
  };
})();
