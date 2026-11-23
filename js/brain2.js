/* Cerebros 2.0 (0.9.3): mapa táctico, mapa de peligro, decisión por puntajes (utilidad), supresión,
   mejor oído (triangular, reconocer el arma, aprovechar la recarga del rival), memoria de escondites,
   puntería más humana y jugadas propias de cada personalidad. Se carga después de ai.js. */
'use strict';

(() => {
  const { rnd } = App;
  const E = App.battle;
  const { WEAPONS, ammoOf, angDiff, clamp, clamp01 } = E;
  const { IQ } = Personas;
  const G = E.Game.prototype;
  const D8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

  /* ================= mapa táctico (se arma una vez por partida) ================= */
  G.buildTactics = function () {
    const W = this.W, H = this.H, N = W * H, g = this.g, pr = this.pr || new Uint8Array(N);
    const prot = new Uint8Array(N), choke = new Uint8Array(N), vault = new Uint8Array(N);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (pr[i] === 1) {                                                    // cajón que se puede saltar: libre a los dos lados
        const h = !g[i - 1] && !g[i + 1], v = !g[i - W] && !g[i + W];
        vault[i] = (h ? 1 : 0) | (v ? 2 : 0);
      }
      if (g[i]) continue;
      let m = 0;
      D8.forEach(([dx, dy], d) => { const j = (y + dy) * W + x + dx; if (g[j] && (this.wl[j] || pr[j] === 1)) m |= 1 << d; });
      prot[i] = m;                                                          // de qué lados lo tapa algo
      const wl = g[i - 1], wr = g[i + 1], wu = g[i - W], wd = g[i + W];
      if ((wl && wr && !wu && !wd) || (wu && wd && !wl && !wr) || this.doorGrid[i]) choke[i] = 1;   // pasillo angosto o puerta
    }
    this.computeLines();
    this.tac = { prot, choke, vault, danger: new Float32Array(N), dT: 0 };
  };
  /** Protección de un casillero contra disparos que vienen desde (tx, ty): 0 nada … 1 tapado. */
  G.protFrom = function (i, tx, ty) {
    if (!this.tac) return 0;
    const W = this.W, x = (i % W) + 0.5, y = ((i / W) | 0) + 0.5, a = Math.atan2(ty - y, tx - x);
    const d = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8, m = this.tac.prot[i];
    return (m >> d & 1) ? 1 : ((m >> ((d + 1) % 8) & 1) || (m >> ((d + 7) % 8) & 1)) ? 0.5 : 0;
  };

  /* ================= mapa de peligro: dónde hubo tiros, muertes y explosiones ================= */
  G.addDanger = function (x, y, amt, R = 2) {
    if (!this.tac) return;
    const W = this.W, H = this.H, d = this.tac.danger, cx = Math.floor(x), cy = Math.floor(y);
    for (let yy = Math.max(0, cy - R); yy <= Math.min(H - 1, cy + R); yy++) for (let xx = Math.max(0, cx - R); xx <= Math.min(W - 1, cx + R); xx++) {
      const k = 1 - Math.hypot(xx - cx, yy - cy) / (R + 1); if (k > 0) d[yy * W + xx] = Math.min(10, d[yy * W + xx] + amt * k);
    }
  };
  G.stepTactics = function (dt) {
    const t = this.tac; if (!t) return;
    t.dT += dt;
    if (t.dT >= 1) { const f = Math.exp(-t.dT * 0.12), d = t.danger; for (let i = 0; i < d.length; i++) if (d[i]) d[i] = d[i] * f < 0.02 ? 0 : d[i] * f; t.dT = 0; }
  };
  G.dangerAt = function (x, y) { return this.tac ? this.tac.danger[Math.floor(y) * this.W + Math.floor(x)] || 0 : 0; };

  /* ================= decisión por puntajes ================= */
  /** Puntaje de cada opción cuando hay un enemigo a la vista. Más alto = más ganas. */
  G.utilities = function (s, e, td) {
    const P = s.P, m = s.mood, iq = IQ[s.iq], tac = iq.tac, hpF = s.hp / s.maxHp, now = this.time;
    const w = this.weaponOf(s), supp = s.supp || 0;
    const U = {};
    const eReload = e.reloadT > 0 && (P.loud || P.rage > 0.6 || P.base.stalk > 0.7 || tac > 0.9);
    // huir: los mismos motivos de siempre, más la supresión y el peligro del lugar
    U.flee = this.wantFlee(s) ? 0.95 + m.fear * 0.3 + supp * 0.2 : 0;
    // cubrirse: sin balas, recargando, bajo fuego, contra un sniper… (y la supresión empuja)
    let cov = 0;
    if (!s.cover && now >= s.coverCd && s.cur !== 'knife' && w) {
      if (w.mag <= 0 && w.res > 0) cov = 1.15;
      else if (s.reloadT > 0 && td < 14) cov = 0.9;
      if (now - s.lastHurt < 1.5) cov = Math.max(cov, 0.45 + m.fear * 0.5);
      if (e.wtype === 'sniper' && td > 8 && s.cur !== 'sniper') cov = Math.max(cov, 0.7);
      if (hpF < 0.5) cov = Math.max(cov, 0.35);
      cov = Math.max(cov, supp * (1 - P.bravery * 0.5));
      if (P.base.peek > 0.85 && w.mag < magOf(w) * 0.3 && w.res > 0) cov += 0.35;          // cauteloso: se esconde a recargar antes de quedarse seco
      cov *= s.sk.cover * (0.5 + 0.5 * tac) * 1.25;
      if (td < 2.2) cov *= 0.3;
      cov *= 0.75 + rnd() * 0.5;
    }
    U.cover = cov;
    // acercarse por la espalda
    U.stalk = this.wantStalk(s, e) ? 0.78 + (e.reloadT > 0 ? 0.2 : 0) : 0;
    // flanquear: si está lejos o el rival no se mueve de su lugar
    const [, pmax] = this.prefRange(s);
    const k = s.know[e.id], still = k && Math.hypot(k.vx || 0, k.vy || 0) < 0.3;
    U.flank = td > pmax * 0.9 && td > 5.5 && now > s.flankUntil ? s.sk.flank * (0.4 + 0.6 * tac) * (0.55 + rnd() * 0.7) + (still ? 0.15 : 0) : 0;
    // pelear de frente: más ganas si el rival recarga, está herido o hay furia; menos bajo fuego
    let att = 0.55 + (1 - e.hp / e.maxHp) * 0.3 * P.finisher + m.fury * 0.3 - supp * 0.35 * (1 - P.bravery);
    if (eReload) att += 0.55;
    if (s.pushId === e.id && now < s.pushT) att += 0.4;
    if (P.rage > 0.9) att += 0.45;                                           // berserker: siempre al frente
    U.attack = att;
    // levantar a un compañero derribado cerca, si el rival no está encima
    if (s.team >= 0 && this.cfg.downed) {
      const d = this.soldiers.find((m) => m.alive && m.downed && m.team === s.team && Math.hypot(m.x - s.x, m.y - s.y) < 7);
      if (d && td > 5) { U.revive = 0.75 + (s.role === 'medico' ? 0.35 : 0) - supp * 0.4 + (e.reloadT > 0 ? 0.2 : 0); s.reviveId = d.id; }
    }
    return U;
  };
  const magOf = (w) => Math.round(WEAPONS[w.type].mag * (w.ext ? 1.5 : 1));

  /* ================= supresión ================= */
  /** Una bala que pasa cerca asusta: baja la puntería y dan ganas de cubrirse. */
  G.suppress = function (s, b) {
    if (s.team >= 0 && b.owner.team === s.team) return;
    s.supp = Math.min(1, (s.supp || 0) + (b.w === 'hmg' || b.w === 'lmg' ? 0.09 : 0.06));
  };

  /* ================= oído ================= */
  const heardOld = G.heard;
  G.heard = function (s, src, kind, x, y) {
    heardOld.call(this, s, src, kind, x, y);
    const k = s.know[src.id];
    if (k && kind === 'shot') k.w = src.wtype;                               // reconoce el arma por el sonido
    if (kind === 'reload' && !s.target) {                                    // ¡está recargando! los atrevidos aprovechan
      const d = Math.hypot(x - s.x, y - s.y), P = s.P;
      if (d < 12 && (P.loud || P.rage > 0.6 || P.base.stalk > 0.7 || IQ[s.iq].tac > 0.9)) {
        s.pushId = src.id; s.pushT = this.time + 2.5; s.rushT = Math.max(s.rushT, 2.2); s.thinkT = Math.min(s.thinkT, 0.05);
        if (P.base.stalk > 0.7 && d < 7) this.switchTo(s, 'knife');          // el asesino: cuchillo mientras el otro recarga
      }
    }
  };
  /** Triangular: si oye varias veces al mismo, la posición estimada se va afinando. */
  G.refineKnow = function (s, old, k) {
    if (!old || old.exact || this.time - old.t > 4) { k.n = 1; return; }
    const n = Math.min(5, (old.n || 1));
    k.x = (old.x * n + k.x) / (n + 1); k.y = (old.y * n + k.y) / (n + 1); k.n = n + 1;
    if (old.w && !k.w) k.w = old.w;
  };

  /* ================= memoria: dónde suele esconderse cada uno ================= */
  G.noteHabits = function (s) {
    if (!s.target) return;
    const e = s.target, k = s.know[e.id]; if (!k) return;
    const hb = s.habits || (s.habits = {});
    const h = hb[e.id];
    if (Math.hypot(k.vx || 0, k.vy || 0) < 0.3) {
      if (h && Math.hypot(h.x - e.x, h.y - e.y) < 1.5) { h.n++; h.t = this.time; } else hb[e.id] = { x: e.x, y: e.y, n: 1, t: this.time };
    }
  };
  /** Bonus para explorar un lugar donde alguien ya se escondió antes. */
  G.habitBonus = function (s, x, y) {
    if (!s.habits) return 0;
    let b = 0;
    for (const id in s.habits) { const h = s.habits[id], o = this.soldiers[id]; if (!o || !o.alive || h.n < 3) continue; const d = Math.hypot(h.x - x, h.y - y); if (d < 3) b += (3 - d) * 6; }
    return b;
  };

  /* ================= puntería ================= */
  /** Hacia dónde apuntar: adelantado según cómo se mueve el rival, con un error que se va corrigiendo. */
  G.aimAt = function (s, tgt) {
    const iq = IQ[s.iq], k = s.know[tgt.id], def = this.defOf(s);
    let ax = tgt.x, ay = tgt.y;
    if (k && def.bspeed && s.cur !== 'knife') {
      const t = Math.hypot(tgt.x - s.x, tgt.y - s.y) / def.bspeed, lead = clamp01(iq.tac - 0.35);
      ax += (k.vx || 0) * t * lead; ay += (k.vy || 0) * t * lead;
    }
    if (s.aimFor !== tgt.id) { s.aimFor = tgt.id; s.aimErr = (rnd() - 0.5) * 0.7 * iq.aim * (1 + (s.supp || 0)); }   // recién lo ve: el arma todavía no "llegó"
    return Math.atan2(ay - s.y, ax - s.x) + (s.aimErr || 0);
  };
  G.aimSettle = function (s, dt) {
    if (!s.aimErr) return;
    const iq = IQ[s.iq], rate = (2.2 + 2.5 * iq.tac) / iq.aim * (1 - (s.supp || 0) * 0.5);
    s.aimErr *= Math.exp(-dt * rate);
    if (Math.abs(s.aimErr) < 0.004) s.aimErr = 0;
  };

  /* ================= saltar cajones (también la IA) ================= */
  /** Avanza un salto en curso. Devuelve true mientras salta. */
  G.stepVault = function (s, dt) {
    const v = s.vault; if (!v) return false;
    v.t += dt; const k = Math.min(1, v.t / v.dur);
    s.x = v.fx + (v.tx - v.fx) * k; s.y = v.fy + (v.ty - v.fy) * k;
    if (k >= 1) { s.vault = null; this.emitSound(s.x, s.y, 4, 'step', s); if (s.path && s.path.length > 2 && s.path[1] === v.over) s.path.splice(0, 2); }
    return true;
  };
  /** Si el próximo paso del camino es un cajón, lo salta. */
  G.tryVaultPath = function (s) {
    if (!this.tac || !s.path || s.path.length < 3) return false;
    const W = this.W, cur = Math.floor(s.y) * W + Math.floor(s.x);
    let i = s.path.indexOf(cur); if (i < 0) i = 0;
    const nx = s.path[i + 1], after = s.path[i + 2];
    if (nx == null || after == null || !this.tac.vault[nx] || !this.pr[nx]) return false;
    const cx = (nx % W) + 0.5, cy = ((nx / W) | 0) + 0.5;
    if (Math.hypot(cx - s.x, cy - s.y) > 1.15) return false;
    const tx = (after % W) + 0.5, ty = ((after / W) | 0) + 0.5;
    if (this.blocked(tx, ty, s.r)) return false;
    s.vault = { t: 0, dur: 0.5, fx: s.x, fy: s.y, tx, ty, over: nx };
    s.path = s.path.slice(i + 2);
    this.emitSound(s.x, s.y, 5, 'step', s);
    return true;
  };

  /* ================= jugadas propias ================= */
  /** Cauteloso y compañía: al emboscar apunta al pasillo o la puerta por donde va a aparecer el rival. */
  G.chokeFacing = function (s, k) {
    const base = Math.atan2(k.y - s.y, k.x - s.x);
    if (!this.tac || s.P.base.peek < 0.7) return base;
    const W = this.W, tx = Math.floor(s.x), ty = Math.floor(s.y);
    let best = null, bd = 1e9;
    for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
      const x = tx + dx, y = ty + dy; if (x < 1 || y < 1 || x >= W - 1 || y >= this.H - 1) continue;
      const i = y * W + x; if (!this.tac.choke[i]) continue;
      const a = Math.atan2(y + 0.5 - s.y, x + 0.5 - s.x), d = Math.hypot(dx, dy);
      if (d < 2 || Math.abs(angDiff(a, base)) > 0.8 || !this.los(s.x, s.y, x + 0.5, y + 0.5)) continue;
      if (d < bd) { bd = d; best = a; }
    }
    return best == null ? base : best;
  };
  /** Cobarde: el rincón más tapado cerca (y lejos de donde está el peligro). */
  G.hideSpot = function (s, k) {
    if (!this.tac) return -1;
    const W = this.W, n = this.bfs(Math.floor(s.x), Math.floor(s.y), null, 9, true);
    let best = -1, bs = -1e9;
    for (let q = 1; q < n; q++) {
      const i = this.queue[q]; if (this.doorGrid[i]) continue;
      let walls = 0, m = this.tac.prot[i]; while (m) { walls += m & 1; m >>= 1; }
      if (walls < 5) continue;
      const x = (i % W) + 0.5, y = ((i / W) | 0) + 0.5;
      const sc = walls * 2 - this.dist[i] * 0.4 + (k ? Math.min(10, Math.hypot(x - k.x, y - k.y)) * 0.6 : 0) - this.dangerAt(x, y) * 2;
      if (sc > bs) { bs = sc; best = i; }
    }
    return best;
  };

  /* ================= nivel Leyenda ================= */
  if (IQ.length === 4) IQ.push({ key: 'leyenda', label: 'Leyenda', emoji: '🦅', react: 0.13, aim: 0.72, tac: 1.0, dodge: 0.92, think: 0.68, forget: 0 });
})();
