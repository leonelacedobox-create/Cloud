/* El cerebro de los soldados (0.2): percepción, decisiones, tácticas, ánimo y errores humanos.
   Se carga después de battle.js y le agrega los métodos de decisión a la partida. */
'use strict';

(() => {
  const { rnd, rint, sfx } = App;
  const { Game, WEAPONS, KNIFE, HPL, FOV, ammoOf, angDiff, clamp, clamp01, fitRange, doorClosed, magOf, MED } = App.battle;
  const FUSE = { frag: 2.4, smoke: 1.1, flash: 1.7 };
  const { PERS, IQ, pickLine } = Personas;
  const G = Game.prototype;
  const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const bearing = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

  /* ================= datos propios de cada soldado ================= */
  G.initBrain = function (s) {
    const P = s.P, b = P.base, tac = IQ[s.iq].tac;
    const j = (v) => clamp01(v * (0.55 + 0.45 * tac) + (rnd() - 0.5) * 0.3);
    Object.assign(s.sk, {
      cover: j(b.cover), flank: j(b.flank), stalk: j(b.stalk), scav: j(b.scav), coord: j(b.coord), nade: j(b.nade == null ? 0.4 : b.nade),
      flee: clamp01(b.flee * (0.7 + 0.3 * tac) + (rnd() - 0.5) * 0.2),
    });
    s.mood = { fear: 0, fury: 0, conf: 0.5 };
    Object.assign(s, {
      reactT: 0, hurtT: 99, hurtBy: -1, lastHurt: -99, cover: null, coverCd: 0, nest: null, fightAt: null, rushT: 0,
      dodgeT: 0, dodgeCd: 0, dodgeDir: [0, 0], freezeT: 0, flankUntil: 0, nVis: 0, fleeT: -99, headScan: 0,
      doorWaited: -1, reloadDelay: null, unstickT: 0, doSpot: 0,
      stunT: 0, flashlight: false, nadeCd: 0, dropAt: null, dropGo: null, dropAmbush: false, aimPt: null, aimT: 0, healFail: 0,
      gren: { frag: 0, smoke: 0, flash: 0 }, armor: { vest: 0, helm: 0 }, meds: [], pack: false,
    });
    s.stuck = { x: s.x, y: s.y, t: 0, n: 0 };
    s.stats = { shots: 0, rounds: 0, hits: 0, dmgDealt: 0, dmgTaken: 0, killsBy: {}, longKill: 0, hidden: 0, fled: 0, talk: 0, dist: 0, doors: 0, pickups: 0, reloads: 0, stuck: 0, knifeKills: 0, shared: 0, thrown: 0, absorbed: 0, healed: 0 };
  };

  /* ================= puntería y errores humanos ================= */
  /** Multiplicador de dispersión: personalidad × inteligencia × estado de ánimo. */
  G.aimMul = function (s) {
    const m = s.mood;
    let a = s.P.accMul * IQ[s.iq].aim * (1 + m.fear * 0.7) * (1 + m.fury * 0.25) * (1 - (m.conf - 0.5) * 0.2);
    if (s.freezeT > 0) a *= 2;
    return a;
  };

  /* ================= percepción ================= */
  /** Marca como "ya revisado" lo que ve dentro de su cono de visión (sirve para buscar sin repetir). */
  G.markSeen = function (s) {
    const W = this.W, H = this.H, R = 8, tx = Math.floor(s.x), ty = Math.floor(s.y), now = this.time;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (((dx + dy) & 1) && Math.abs(dx) + Math.abs(dy) > 3) continue;       // muestrea la mitad: alcanza y es más barato
      const d = Math.hypot(dx, dy); if (d > R) continue;
      const nx = tx + dx, ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || this.g[ny * W + nx]) continue;
      if (d > 2.2 && Math.abs(angDiff(s.look, Math.atan2(dy, dx))) > FOV / 2) continue;
      if (d <= 1.5 || this.los(s.x, s.y, nx + 0.5, ny + 0.5)) s.explored[ny * W + nx] = now;
    }
  };

  /** Qué tan prioritario es un enemigo visible (a quién le disparo primero). */
  G.threat = function (s, e, d) {
    let sc = 10 - d * 0.35;
    if (s.hurtBy === e.id && this.time - s.lastHurt < 4) sc += 4;          // el que me está disparando
    if (e.target === s) sc += 2.5;                                           // el que me apunta
    const wd = WEAPONS[e.wtype]; sc += (wd ? wd.tier : 1) * 0.5;             // el arma más peligrosa
    sc += (1 - e.hp / e.maxHp) * 2.5 * s.P.finisher;                         // el herido: se lo puede terminar
    if (s.target === e) sc += 1.8;                                           // no cambiar de blanco a cada rato
    return sc;
  };

  G.sense = function (s) {
    if (s.stunT > 0) { s.target = null; s.td = 0; s.nVis = 0; return; }           // aturdido: no ve nada
    let tgt = null, best = -1e9, nVis = 0, td = 1e9;
    const sight = this.sightOf(s);
    for (const e of this.enemiesOf(s)) {
      const dx = e.x - s.x, dy = e.y - s.y, d = Math.hypot(dx, dy);
      if (d > sight) continue;
      if (d > 2.2 && Math.abs(angDiff(s.look, Math.atan2(dy, dx))) > FOV / 2) continue;   // fuera del campo de visión
      if (!this.los(s.x, s.y, e.x, e.y)) continue;
      if (!this.visibleLit(s, e, d)) continue;                                           // a oscuras solo se ve de cerca o con linterna
      // velocidad estimada del enemigo (para predecir hacia dónde va)
      const old = s.know[e.id];
      let vx = 0, vy = 0;
      if (old && old.exact && this.time - old.t > 0.02 && this.time - old.t < 0.8) {
        const dt = this.time - old.t;
        vx = ((e.x - old.x) / dt) * 0.5 + (old.vx || 0) * 0.5; vy = ((e.y - old.y) / dt) * 0.5 + (old.vy || 0) * 0.5;
      }
      s.know[e.id] = { id: e.id, x: e.x, y: e.y, t: this.time, exact: true, kind: 'seen', vx, vy };
      nVis++;
      const sc = this.threat(s, e, d);
      if (sc > best) { best = sc; tgt = e; td = d; }
    }
    if (tgt && !s.target) {                       // lo acaba de ver: tarda un poco en reaccionar (según la inteligencia)
      s.icon = { ch: '!', t: 1.0 };
      s.reactT = IQ[s.iq].react * (0.7 + rnd() * 0.6) * (1 - 0.4 * s.mood.fury);
    }
    s.target = tgt; s.td = td; s.nVis = nVis;
    // aviso por radio a los compañeros cercanos
    if (tgt && s.team >= 0 && s.radioCd <= 0) {
      s.radioCd = 0.7;
      for (const m of this.soldiers) {
        if (m.alive && m !== s && m.team === s.team && Math.hypot(m.x - s.x, m.y - s.y) < 12) {
          const o = m.know[tgt.id];
          if (!o || o.t < this.time - 1) m.know[tgt.id] = { id: tgt.id, x: tgt.x, y: tgt.y, t: this.time - 0.3, exact: false, kind: 'radio', vx: 0, vy: 0 };
        }
      }
    }
  };

  G.bestKnowledge = function (s) {
    let best = null;
    for (const id in s.know) { const k = s.know[id]; if (!best || k.t > best.t) best = k; }
    return best;
  };

  /** Distancia preferida de combate: depende del arma, la personalidad y el ánimo. */
  G.prefRange = function (s) {
    if (s.cur === 'knife') return [0, 0.9];
    const def = this.defOf(s), late = this.time > 130 ? 0.55 : 1;
    const mood = (1 - s.mood.fury * 0.3) * (1 + s.mood.fear * 0.4);
    return [def.pref[0] * s.P.distMul * late * mood, def.pref[1] * s.P.distMul * late * mood];
  };

  /* ================= armas ================= */
  G.chooseWeapon = function (s) {
    const has = (w) => w && ammoOf(w) > 0;
    const d = s.target ? s.td : null;
    const sc = {};
    for (const key of ['pistol', 'primary']) {
      const w = key === 'pistol' ? s.inv.pistol : s.inv.primary;
      if (!has(w)) { sc[key] = -1; continue; }
      const def = WEAPONS[w.type], load = w.mag > 0 ? 1 : 0.55;
      sc[key] = d == null ? def.tier * load + (key === 'primary' ? 2 : 0) : def.tier * fitRange(def, d) * load;
    }
    sc.knife = 0.1;
    if (d != null) {
      if (d < 1.5) sc.knife = 2.0;
      else if (s.P.base.stalk > 0.7 && s.target.target !== s && d < 8) sc.knife = 3.6;   // el asesino prefiere acercarse con cuchillo
    }
    let best = 'knife', bs = -9;
    for (const k of ['primary', 'pistol', 'knife']) if (sc[k] > bs) { bs = sc[k]; best = k; }
    const cs = sc[s.cur] == null ? -1 : sc[s.cur];
    if (best !== s.cur && (cs < 0 || bs > cs * 1.3 + 0.3)) this.switchTo(s, best);
  };

  G.manageWeapon = function (s, dt) {
    const iq = IQ[s.iq];
    if (s.reloadT > 0) { s.reloadT -= dt; if (s.reloadT <= 0) { s.reloadT = 0; this.finishReload(s); } }
    if (s.swapT > 0) s.swapT -= dt;
    if (s.meleeT > 0) s.meleeT -= dt;
    s.bloom = Math.max(0, s.bloom - dt * 1.2);
    const pr = s.inv.primary;
    if (pr && ammoOf(pr) <= 0) { s.inv.primary = null; if (s.cur === 'primary') { s.cur = 'pistol'; s.reloadT = 0; this.chooseWeapon(s); } }
    s.wT -= dt;
    if (s.wT <= 0) { s.wT = 0.25; this.chooseWeapon(s); }
    s.wtype = s.cur === 'knife' ? 'knife' : (this.weaponOf(s) || s.inv.pistol).type;
    // recarga
    const w = this.weaponOf(s);
    if (w && s.reloadT <= 0 && s.swapT <= 0 && w.res > 0) {
      if (w.mag <= 0) {                               // sin balas: los novatos tardan en acordarse
        if (s.reloadDelay == null) s.reloadDelay = rnd() < iq.forget ? 0.4 + rnd() * 0.9 : 0;
        s.reloadDelay -= dt;
        if (s.reloadDelay <= 0) { s.reloadDelay = null; this.startReload(s); }
      } else {
        s.reloadDelay = null;
        const calm = !s.target || s.td > 12;           // con un enemigo cerca no recarga de a poco
        if (calm && (w.mag < magOf(w) * 0.5 || (s.mode === 'cover' && w.mag < magOf(w) * 0.85))) this.startReload(s);
      }
    } else s.reloadDelay = null;
  };

  /* ================= movimiento ================= */
  G.tryMove = function (s, dx, dy) {
    let moved = false;
    if (!this.blocked(s.x + dx, s.y, s.r)) { s.x += dx; moved = true; }
    if (!this.blocked(s.x, s.y + dy, s.r)) { s.y += dy; moved = true; }
    return moved;
  };

  /** Sigue la ruta; abre puertas con la mano y se asoma a las esquinas. Devuelve [vx, vy] o null. */
  G.followPath = function (s, allowPeek) {
    const W = this.W, p = s.path;
    while (p.length > 1) {
      const cx = (p[1] % W) + 0.5, cy = ((p[1] / W) | 0) + 0.5;
      if (Math.hypot(cx - s.x, cy - s.y) < 0.18) p.shift(); else break;
    }
    const wi = p.length > 1 ? p[1] : p[0];
    if (wi === undefined) return null;
    const wx = (wi % W) + 0.5, wy = ((wi / W) | 0) + 0.5, d = Math.hypot(wx - s.x, wy - s.y);

    if (this.doorGrid[wi]) {                                   // puerta cerrada adelante: la abre con la mano
      const dr = this.doors.get(wi);
      if (doorClosed(dr) && d < 1.1) { s.act = { type: 'open', t: 0, dur: 0.6, idx: wi, ang: Math.atan2(wy - s.y, wx - s.x) }; return null; }
    }
    if (allowPeek && p.length >= 3 && s.peekFor !== p[1] && d < 1.5 && d > 0.55) {   // ¿hay una esquina? asomarse
      const a = p[0], b = p[1], c = p[2];
      const d1x = Math.sign((b % W) - (a % W)), d1y = Math.sign(((b / W) | 0) - ((a / W) | 0));
      const d2x = Math.sign((c % W) - (b % W)), d2y = Math.sign(((c / W) | 0) - ((b / W) | 0));
      if (d1x !== d2x || d1y !== d2y) {
        s.peekFor = b;
        if (rnd() < s.sk.peek * (0.5 + 0.5 * IQ[s.iq].tac)) {
          s.act = { type: 'peek', t: 0, dur: 0.75 + rnd() * 0.5, face: Math.atan2(d2y, d2x), px: wx - d1x * 0.42, py: wy - d1y * 0.42 };
          return null;
        }
      }
    }
    return d > 0.05 ? [(wx - s.x) / d, (wy - s.y) / d] : null;
  };

  /** Si una bala enemiga está por pasar cerca, devuelve hacia dónde moverse para esquivarla. */
  G.incomingBullet = function (s) {
    let best = null, bt = 9;
    for (const b of this.bullets) {
      if (b.owner === s || (s.team >= 0 && b.owner.team === s.team)) continue;
      const rx = s.x - b.x, ry = s.y - b.y, sp2 = b.vx * b.vx + b.vy * b.vy;
      const t = (rx * b.vx + ry * b.vy) / sp2;
      if (t < 0 || t > 0.4) continue;
      const cx = b.x + b.vx * t - s.x, cy = b.y + b.vy * t - s.y;
      if (Math.hypot(cx, cy) < 0.7 && t < bt) {
        bt = t;
        const sp = Math.sqrt(sp2), nx = -b.vy / sp, ny = b.vx / sp, side = Math.sign(rx * nx + ry * ny) || (rnd() < 0.5 ? 1 : -1);
        best = [nx * side, ny * side];
      }
    }
    return best;
  };

  /** ¿Hay un compañero en la línea de fuego? (solo importa con fuego amigo) */
  G.clearShot = function (s, t) {
    if (!this.cfg.friendly || s.team < 0) return true;
    const dx = t.x - s.x, dy = t.y - s.y, L2 = dx * dx + dy * dy || 1;
    for (const m of this.soldiers) {
      if (!m.alive || m === s || m.team !== s.team) continue;
      const u = ((m.x - s.x) * dx + (m.y - s.y) * dy) / L2;
      if (u < 0 || u > 1) continue;
      if (Math.hypot(s.x + dx * u - m.x, s.y + dy * u - m.y) < 0.6) return false;
    }
    return true;
  };

  /* ================= cobertura ================= */
  /** Busca un casillero cercano desde donde el enemigo no me ve (y puedo asomarme a disparar). */
  G.findCover = function (s, tx, ty, maxD = 9) {
    const W = this.W, sx = Math.floor(s.x), sy = Math.floor(s.y);
    const n = this.bfs(sx, sy, null, maxD, true);
    const myD = Math.hypot(s.x - tx, s.y - ty);
    let best = -1, bs = 1e9;
    for (let k = 1; k < n; k++) {
      const i = this.queue[k]; if (this.doorGrid[i]) continue;
      const cx = (i % W) + 0.5, cy = ((i / W) | 0) + 0.5;
      const dT = Math.hypot(cx - tx, cy - ty);
      if (dT < 3 || this.losShot(tx, ty, cx, cy)) continue;                // sigue expuesto a las balas
      let sc = this.dist[i] + (dT < myD ? 2.5 : 0) - (dT > 6 ? 0 : 1.5);
      if (this.findPeek(i, tx, ty) < 0) sc += 3;                          // sin lugar para asomarse
      if (this.barrelsNear(cx, cy, 2.4).length) sc += 6;                  // junto a un barril explosivo: mala idea
      if (sc < bs) { bs = sc; best = i; }
    }
    return best;
  };
  G.findPeek = function (hide, tx, ty) {
    const W = this.W, hx = hide % W, hy = (hide / W) | 0;
    if (this.losShot(hx + 0.5, hy + 0.5, tx, ty)) return hide;              // detrás de un cajón: dispara por encima sin moverse
    let best = -1, bd = 9;
    for (const [dx, dy] of D8) {
      const nx = hx + dx, ny = hy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= this.H || this.g[ny * W + nx] || this.doorGrid[ny * W + nx]) continue;
      if (dx && dy && (this.g[hy * W + nx] || this.g[ny * W + hx])) continue;
      if (!this.losShot(nx + 0.5, ny + 0.5, tx, ty)) continue;
      const d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = ny * W + nx; }
    }
    return best;
  };
  G.wantCover = function (s) {
    if (s.cover || this.time < s.coverCd || s.cur === 'knife') return false;
    const e = s.target, w = this.weaponOf(s);
    if (!w || !e) return false;
    const tac = IQ[s.iq].tac;
    let p = 0;
    if (w.mag <= 0 && w.res > 0) p = 1.2;                                  // sin balas: esconderse a recargar
    else if (s.reloadT > 0 && s.td < 14) p = 0.9;
    if (this.time - s.lastHurt < 1.5) p = Math.max(p, 0.5 + s.mood.fear * 0.5);
    if (e.wtype === 'sniper' && s.td > 8 && s.cur !== 'sniper') p = Math.max(p, 0.7);   // no quedarse en la mira de un sniper
    if (s.hp < s.maxHp * 0.5) p = Math.max(p, 0.35);
    p *= s.sk.cover * (0.5 + 0.5 * tac) * 1.2;
    if (s.td < 2.2) p *= 0.3;                                              // demasiado cerca: mejor pelear
    return rnd() < p;
  };
  G.beginCover = function (s, e) {
    const hide = this.findCover(s, e.x, e.y);
    if (hide < 0) { s.coverCd = this.time + 3; return false; }
    const W = this.W;
    s.cover = { phase: 'go', hide, peek: this.findPeek(hide, e.x, e.y), t: 0, tx: e.x, ty: e.y, id: e.id, peeks: 0, maxPeeks: 2 + rint(3), hideDur: 1, peekDur: 1 };
    s.path = this.bfs(Math.floor(s.x), Math.floor(s.y), (i) => i === hide) || [];
    s.mode = 'cover'; s.coverCd = this.time + 5;
    return true;
  };

  /** Cada fase de la cobertura: ir al escondite, esperar (recargar) y asomarse a disparar. */
  G.steerCover = function (s, dt, r) {
    const c = s.cover, W = this.W;
    c.t += dt;
    const ek = s.know[c.id];
    if (ek && ek.exact) { c.tx = ek.x; c.ty = ek.y; }
    const enemy = this.soldiers[c.id];
    if (!enemy || !enemy.alive || this.time - (ek ? ek.t : -99) > 12 || c.t > 30) { s.cover = null; s.thinkT = 0; return; }
    const hx = (c.hide % W) + 0.5, hy = ((c.hide / W) | 0) + 0.5;
    r.sneak = true;
    if (c.phase === 'go') {
      const v = this.followPath(s, false);
      if (v) { r.vx = v[0]; r.vy = v[1]; r.desired = Math.atan2(v[1], v[0]); r.sneak = false; r.speedMul = 1.1; }
      if (Math.hypot(hx - s.x, hy - s.y) < 0.3 || (!v && c.t > 0.5)) { c.phase = 'hide'; c.t = 0; c.hideDur = 0.8 + rnd() * 1.4; }
      else if (c.t > 7) { s.cover = null; s.thinkT = 0; }
    } else if (c.phase === 'hide') {
      r.desired = Math.atan2(c.ty - s.y, c.tx - s.x); r.scanning = true;
      const w = this.weaponOf(s), def = w ? WEAPONS[w.type] : null;
      if (w && w.res > 0 && w.mag < magOf(w) * 0.85 && s.reloadT <= 0 && s.swapT <= 0) this.startReload(s);
      if (!s.act && s.reloadT <= 0 && this.wantHeal(s)) this.startHeal(s);
      if (s.target && s.td < 4.5) { s.cover = null; s.thinkT = 0; return; }       // me encontraron: a pelear
      if (c.t >= c.hideDur && s.reloadT <= 0) {
        if (c.peek >= 0 && c.peeks < c.maxPeeks && !(w && w.mag <= 0 && w.res <= 0)) { c.phase = 'peek'; c.t = 0; c.peekDur = 0.9 + rnd() * 1.1; }
        else { s.cover = null; s.thinkT = 0; }
      }
    } else {                                                                      // asomarse
      const px = (c.peek % W) + 0.5, py = ((c.peek / W) | 0) + 0.5, dx = px - s.x, dy = py - s.y, d = Math.hypot(dx, dy);
      if (d > 0.08) { r.vx = dx / d; r.vy = dy / d; r.speedMul = 0.8; }
      r.desired = s.target ? bearing(s, s.target) : Math.atan2(c.ty - s.y, c.tx - s.x); r.sneak = false;
      if (c.t > c.peekDur || (s.hurtT < 0.2 && c.t > 0.25)) { c.phase = 'hide'; c.t = 0; c.peeks++; c.hideDur = 0.7 + rnd() * 1.3; }
    }
  };

  /* ================= huida y recuperación ================= */
  G.wantFlee = function (s) {
    const P = s.P, m = s.mood, hpF = s.hp / s.maxHp, e = s.target;
    if (P.base.flee <= 0 || !e) return false;
    let sc = (1 - hpF) * 2.2 + m.fear * 1.8 - m.fury * 1.6;
    if (s.nVis >= 2 && hpF < 0.75) sc += 0.9;                              // dos contra uno, y herido
    const arm = ammoOf(s.inv.pistol) + ammoOf(s.inv.primary);
    if (s.cur === 'knife' && e.wtype !== 'knife') sc += 1.0;               // cuchillo contra pistola
    else if (arm < 8) sc += 0.5;
    sc *= s.sk.flee * (0.7 + 0.3 * IQ[s.iq].tac);
    const limit = s.mode === 'flee' ? 0.9 : 1.25;                          // una vez que huye, no se arrepiente enseguida
    return sc > limit;
  };
  G.bestHeal = function (s) {
    let best = null, bg = 0.3;
    for (const it of s.seenItems.values()) {
      if (it.gone || it.kind !== 'power' || (it.type !== 'heal' && it.type !== 'shield')) continue;
      const g = this.evalItem(s, it);
      if (g > bg) { bg = g; best = it; }
    }
    return best;
  };
  G.fleePath = function (s, e) {
    const W = this.W, tx = Math.floor(s.x), ty = Math.floor(s.y);
    const heal = this.bestHeal(s);
    if (heal) {                                                            // si conoce un botiquín o escudo cerca, va por ahí
      const goal = Math.floor(heal.y) * W + Math.floor(heal.x);
      const p = this.bfs(tx, ty, (i) => i === goal, 16);
      if (p && p.length < 15) return p;
    }
    const enemies = this.enemiesOf(s);
    const n = this.bfs(tx, ty, null, 13, true);
    let bestI = -1, bs = -1e9;
    for (let k = 1; k < n; k++) {                                          // lejos y fuera de la línea de visión
      const i = this.queue[k], x = (i % W) + 0.5, y = ((i / W) | 0) + 0.5;
      let md = 1e9; enemies.forEach((o) => { md = Math.min(md, Math.hypot(o.x - x, o.y - y)); });
      const sc = md + (this.los(x, y, e.x, e.y) ? 0 : 7) - this.dist[i] * 0.15;
      if (sc > bs) { bs = sc; bestI = i; }
    }
    return bestI >= 0 ? this.pathTo(bestI) : null;
  };

  /* ================= granadas ================= */
  /** Decide si tira una granada y de qué tipo; busca el mejor tiro simulando la trayectoria (rebota en las paredes). */
  G.tryGrenade = function (s) {
    const g = s.gren;
    if (!g || g.frag + g.smoke + g.flash <= 0 || this.time < s.nadeCd) return false;
    const iq = IQ[s.iq], now = this.time, e = s.target, k = e ? null : this.bestKnowledge(s);
    if (rnd() > clamp01(s.sk.nade * (0.5 + 0.5 * iq.tac)) * 0.6 + 0.05) { s.nadeCd = now + 1.5; return false; }   // no siempre las usa
    let tgt = null, type = null;
    if (e) {
      if (g.frag > 0 && !this.losShot(s.x, s.y, e.x, e.y) && s.td > 4 && s.td < 12) { tgt = e; type = 'frag'; }               // detrás de un cajón: no se le puede disparar
      else if (g.frag > 0 && s.td > 4.5 && s.td < 12 && this.enemiesOf(s).filter((o) => Math.hypot(o.x - e.x, o.y - e.y) < 3.2).length >= 2) { tgt = e; type = 'frag'; }   // varios juntos
      else if (g.smoke > 0 && s.td > 5 && (s.hp < s.maxHp * 0.55 || e.wtype === 'sniper')) {                                   // cruzar a descubierto: se tapa con humo
        tgt = { x: s.x + (e.x - s.x) * 0.35, y: s.y + (e.y - s.y) * 0.35 }; type = 'smoke';
      }
    } else if (k && now - k.t < 6 && k.kind !== 'step') {
      const dist = Math.hypot(k.x - s.x, k.y - s.y);
      if (dist >= 4.5 && dist <= 11 && !this.los(s.x, s.y, k.x, k.y)) {                                                       // sin línea de vista: doblando la esquina
        type = g.frag > 0 && g.flash > 0 ? (rnd() < 0.5 ? 'flash' : 'frag') : g.frag > 0 ? 'frag' : g.flash > 0 ? 'flash' : null;
        tgt = k;
      }
    }
    if (!type || !tgt) { s.nadeCd = now + 1.2; return false; }
    const base = Math.atan2(tgt.y - s.y, tgt.x - s.x), mates = s.team >= 0 ? this.soldiers.filter((m) => m.alive && m !== s && m.team === s.team) : [];
    let best = null, bd = 1e9;
    for (const da of [0, 0.12, -0.12, 0.25, -0.25, 0.4, -0.4, 0.6, -0.6, 0.9, -0.9, 1.3, -1.3, 1.8, -1.8, 2.4, -2.4, 3.1]) {
      for (const sp of [5.5, 8, 11, 13]) {
        const a = base + da, p = this.simGrenade(s.x, s.y, a, sp, FUSE[type]);
        const me = Math.hypot(p.x - s.x, p.y - s.y);
        if (type === 'frag' && me < 4.2) continue;                                                                          // no explotarse a sí mismo
        if (type === 'flash' && me < 3.5) continue;
        if (mates.some((m) => Math.hypot(m.x - p.x, m.y - p.y) < 3.4)) continue;                                           // ni a un compañero
        const d = Math.hypot(p.x - tgt.x, p.y - tgt.y);
        if (d < bd) { bd = d; best = { a, sp }; }
      }
    }
    if (!best || bd > (type === 'smoke' ? 1.8 : 2.3)) { s.nadeCd = now + 1.5; return false; }
    s.act = { type: 'throw', t: 0, dur: 0.5, gtype: type, ang: best.a, speed: best.sp, released: false };
    s.nadeCd = now + 4 + rnd() * 3; s.path = []; s.mode = 'throw';
    return true;
  };
  /** Si un barril está junto al enemigo (y lejos de mí), le dispara al barril. */
  G.barrelTarget = function (s) {
    const e = s.target;
    if (!e || s.cur === 'knife') return null;
    for (const b of this.barrelsNear(e.x, e.y, 2.3)) {
      const dm = Math.hypot(b.x - s.x, b.y - s.y);
      if (dm < 3.8 || dm > this.defOf(s).range || !this.losShot(s.x, s.y, b.x, b.y)) continue;
      if (s.team >= 0 && this.soldiers.some((m) => m.alive && m.team === s.team && Math.hypot(m.x - b.x, m.y - b.y) < 3)) continue;
      if (IQ[s.iq].tac < 0.7 && rnd() < 0.5) continue;
      return b;
    }
    return null;
  };

  /* ================= curarse ================= */
  G.wantHeal = function (s) {
    if (!s.meds.length || s.act || s.target || s.healFail > 4 || s.stunT > 0) return false;
    if (s.maxHp - s.hp < 30 || s.hurtT < 2.5) return false;
    const k = this.bestKnowledge(s);
    return !(k && this.time - k.t < 2);                                    // hay peligro cerca: primero lo resuelve
  };
  G.startHeal = function (s) {
    const miss = s.maxHp - s.hp;
    const pick = s.meds.find((t) => MED[t].amt <= miss * 1.15) || s.meds[s.meds.length - 1];
    s.act = { type: 'heal', t: 0, dur: MED[pick].dur, size: pick }; s.mode = 'heal'; s.path = [];
  };

  /* ================= acecho, flanqueo y francotiradores ================= */
  G.wantStalk = function (s, e) {
    return s.sk.stalk > 0.4 && e.target !== s && s.td < 11 && s.td > 1.6 && this.time - s.lastHurt > 3 && !s.cover;
  };
  G.stalkPath = function (s, e) {                                          // por detrás del enemigo
    const bx = e.x - Math.cos(e.angle) * 1.1, by = e.y - Math.sin(e.angle) * 1.1;
    const goal = this.floorIdxNear(bx, by);
    return this.bfs(Math.floor(s.x), Math.floor(s.y), (i) => i === goal, 30);
  };
  G.flankPath = function (s, e) {                                          // por un costado, no de frente
    const W = this.W, tx = Math.floor(s.x), ty = Math.floor(s.y);
    const base = Math.atan2(s.y - e.y, s.x - e.x);
    const n = this.bfs(tx, ty, null, 32, true), stamp = this.stamp;
    let best = -1, bs = -1e9;
    for (let k = 0; k < 14; k++) {
      const a = base + (rnd() < 0.5 ? 1 : -1) * (1.0 + rnd() * 1.1), r = 4.5 + rnd() * 3;
      const idx = this.floorIdxNear(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r);
      if (this.seen[idx] !== stamp) continue;
      const sc = -this.dist[idx] * 0.15 + (this.los((idx % W) + 0.5, ((idx / W) | 0) + 0.5, e.x, e.y) ? 2 : 0);
      if (sc > bs) { bs = sc; best = idx; }
    }
    return best >= 0 && this.dist[best] > 3 ? this.pathTo(best) : null;
  };
  G.hasSniper = function (s) { return !!(s.inv.primary && s.inv.primary.type === 'sniper' && ammoOf(s.inv.primary) > 0); };
  G.computeLines = function () {
    if (this.lineLen) return;
    const W = this.W, H = this.H, g = this.g;
    this.lineLen = new Uint8Array(W * H); this.lineDir = new Uint8Array(W * H);
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x; if (g[i] || this.doorGrid[i]) continue;
      let bl = 0, bd = 0;
      dirs.forEach(([dx, dy], d) => {
        let n = 0, cx = x + dx, cy = y + dy;
        while (n < 40 && cx > 0 && cy > 0 && cx < W - 1 && cy < H - 1 && !g[cy * W + cx]) { n++; cx += dx; cy += dy; }
        if (n > bl) { bl = n; bd = d; }
      });
      this.lineLen[i] = bl; this.lineDir[i] = bd;
    }
  };
  /** Un "nido": casillero con un pasillo largo para disparar de lejos. */
  G.pickNest = function (s) {
    this.computeLines();
    const W = this.W, old = s.nest ? s.nest.idx : -1;
    let best = null, bs = -1e9;
    for (let k = 0; k < 50; k++) {
      const i = this.floor[rint(this.floor.length)], len = this.lineLen[i];
      if (len < 8) continue;
      const x = (i % W) + 0.5, y = ((i / W) | 0) + 0.5, d = Math.hypot(x - s.x, y - s.y);
      if (old >= 0 && Math.hypot(x - ((old % W) + 0.5), y - (((old / W) | 0) + 0.5)) < 7) continue;
      if (this.outsideZone(x, y, 2)) continue;
      const sc = len * 0.9 - d * 0.12 + rnd() * 3;
      if (sc > bs) { bs = sc; best = i; }
    }
    if (best == null) return null;
    const face = [0, Math.PI / 2, Math.PI, -Math.PI / 2][this.lineDir[best]];
    return { idx: best, face, until: this.time + 22 + rnd() * 30, relocate: null };
  };

  /* ================= el pensamiento principal ================= */
  G.think = function (s) {
    const W = this.W, tx = Math.floor(s.x), ty = Math.floor(s.y), now = this.time;
    const enemies = this.enemiesOf(s);
    if (!enemies.length && !(this.M && this.M.key === 'waves')) return;             // en oleadas, entre una y otra siguen juntando cosas
    const P = s.P, sk = s.sk, tac = IQ[s.iq].tac, hpF = s.hp / s.maxHp;
    if (s.unstickT > 0 && s.path.length > 1 && !s.target) return;          // destrabándose: sigue su ruta
    if (s.dropAt && now >= s.dropAt.until) { s.dropAt = null; s.dropGo = null; }
    this.markSeen(s);
    for (const it of this.items) {                                         // objetos que ve o que tiene cerca
      const d = Math.hypot(it.x - s.x, it.y - s.y);
      if (d < 3 || (d < 11 && this.los(s.x, s.y, it.x, it.y))) s.seenItems.set(it.id, it);
    }
    const prevMode = s.mode;
    let path = null;
    if (s.act && s.act.type === 'hold') {                                   // está esperando (emboscada, escuchando, cuidando un lugar)
      if (!(this.zone && this.outsideZone(s.x, s.y, 1.2)) && !s.target && !s.carry) return;   // sigue esperando sin cambiar de plan
      s.act = null;                                                          // la zona o un enemigo a la vista: deja de esperar
    }

    // 1) zona roja
    if (this.zone && this.outsideZone(s.x, s.y, 1.2)) {
      s.cover = null; s.mode = 'zone';
      path = this.bfs(tx, ty, (i) => !this.outsideZone((i % W) + 0.5, ((i / W) | 0) + 0.5, 1.6));
    }
    // 1b) lleva la bandera o la bomba: corre al objetivo aunque haya enemigos a la vista
    if (!path && s.carry && this.M && this.M.goal) {
      const gl = this.M.goal(this, s);
      if (gl && Math.hypot(gl.x - s.x, gl.y - s.y) > gl.r) {
        const dest = this.floorIdxNear(gl.x, gl.y);
        path = this.bfs(tx, ty, (i) => i === dest);
        if (path) { s.cover = null; s.mode = 'carry'; }
      } else if (gl && gl.hold) { s.act = { type: 'hold', t: 0, dur: 1, face: s.angle }; s.mode = 'hold'; s.path = []; return; }
    }
    if (!path && s.cover) return;                                          // en cobertura: lo maneja steerCover

    // 2) enemigo a la vista
    if (!path && s.target) {
      const e = s.target, td = s.td;
      if (this.wantFlee(s)) {                                              // huir
        path = this.fleePath(s, e);
        if (path) { s.mode = 'flee'; s.fleeT = now; s.closeIdx = s.closeIdx; }
      }
      if (!path && this.wantCover(s) && this.beginCover(s, e)) return;     // cubrirse
      if (!path && this.wantStalk(s, e)) {                                 // acercarse por la espalda
        path = this.stalkPath(s, e);
        if (path) s.mode = 'stalk';
      }
      const [, pmax] = this.prefRange(s);
      if (!path && td > pmax * 0.9 && td > 5.5 && now > s.flankUntil && rnd() < sk.flank * (0.4 + 0.6 * tac)) {   // flanquear
        path = this.flankPath(s, e);
        if (path) { s.mode = 'flank'; s.flankUntil = now + 9; }
      }
      if (!path) {
        const goal = Math.floor(e.y) * W + Math.floor(e.x);
        path = this.bfs(tx, ty, (i) => i === goal); s.mode = 'attack';
      }
    }

    // 3) sin enemigo a la vista
    let k = null;
    if (!path && !s.target) k = this.bestKnowledge(s);
    // 3-0) curarse con un botiquín cuando no hay peligro cerca
    if (!path && !s.target && this.wantHeal(s)) { this.startHeal(s); return; }
    // 3-m) objetivo del modo de juego (bandera, colina, bomba, oleadas, botín)
    if (!path && !s.target && this.M && this.M.goal && s.rushT <= 0) {
      const gl = this.M.goal(this, s);
      if (gl) {
        const gd = Math.hypot(gl.x - s.x, gl.y - s.y);
        if (gd <= gl.r) {
          if (gl.hold) { s.act = { type: 'hold', t: 0, dur: 1.2 + rnd() * 1.6, face: gl.face != null ? gl.face : s.angle + (rnd() - 0.5) * 2.4 }; s.mode = 'hold'; s.path = []; return; }
        } else {
          const dest = this.floorIdxNear(gl.x, gl.y);
          path = this.bfs(tx, ty, (i) => i === dest);
          if (path) s.mode = 'obj';
        }
      }
    }
    // 3a) recuperarse después de huir: se queda escondido (o busca vida)
    if (!path && !s.target && now - s.fleeT < 14 && hpF < 0.6 && sk.flee > 0.3 && s.rushT <= 0 && !this.bestHeal(s)) {
      s.act = { type: 'hold', t: 0, dur: 3 + rnd() * 4, face: k ? Math.atan2(k.y - s.y, k.x - s.x) : rnd() * 6.28 };
      s.mode = 'recover'; s.path = []; return;
    }
    // 3b) botín que le conviene
    if (!path && !s.target) {
      let bestIt = null, bsc = 0.2;
      for (const it of s.seenItems.values()) {
        if (it.gone) { s.seenItems.delete(it.id); continue; }
        if (Math.hypot(it.x - s.x, it.y - s.y) < 0.7) { s.seenItems.delete(it.id); continue; }   // ya está encima y no lo pudo agarrar: no insistir
        const gain = this.evalItem(s, it);
        if (gain < 0.2) continue;
        const sc = gain * 3 - Math.hypot(it.x - s.x, it.y - s.y) * 0.12;
        if (sc > bsc && (!k || now - k.t > 4 || gain > 0.8)) { bsc = sc; bestIt = it; }
      }
      if (bestIt) {
        const goal = Math.floor(bestIt.y) * W + Math.floor(bestIt.x);
        const p2 = this.bfs(tx, ty, (i) => i === goal, 26);
        if (p2) { path = p2; s.mode = 'loot'; }
      }
    }
    // 3b2) cargamento que se oyó caer: algunos corren a buscarlo y otros lo emboscan
    if (!path && !s.target && s.dropAt && now < s.dropAt.until && s.rushT <= 0) {
      if (s.dropGo == null) {
        s.dropGo = rnd() < clamp01((0.3 + sk.scav * 0.4 + (P.loud ? 0.25 : 0) - (P.sneak && sk.scav < 0.6 ? 0.15 : 0)) * (0.5 + 0.5 * tac) + 0.15);
        s.dropAmbush = !s.dropGo && P.sneak && rnd() < 0.6;
      }
      const d = Math.hypot(s.dropAt.x - s.x, s.dropAt.y - s.y);
      if (s.dropGo) {
        if (d < 2.2) { s.dropAt = null; s.dropGo = null; }
        else { const dest = this.floorIdxNear(s.dropAt.x, s.dropAt.y); path = this.bfs(tx, ty, (i) => i === dest); if (path) s.mode = 'drop'; }
      } else if (s.dropAmbush) {
        if (d > 11) { const t = (d - 9) / d, dest = this.floorIdxNear(s.x + (s.dropAt.x - s.x) * t, s.y + (s.dropAt.y - s.y) * t); path = this.bfs(tx, ty, (i) => i === dest); if (path) s.mode = 'drop'; }
        else if (d > 4) { s.act = { type: 'hold', t: 0, dur: 5 + rnd() * 5, face: Math.atan2(s.dropAt.y - s.y, s.dropAt.x - s.x) }; s.mode = 'drop'; s.path = []; return; }
      }
    }
    // 3c) oportunista: se acerca a donde se oye una pelea y espera
    if (!path && !s.target && sk.scav > 0.4 && s.fightAt && now - s.fightAt.t < 14 && s.rushT <= 0) {
      const f = s.fightAt, d = Math.hypot(f.x - s.x, f.y - s.y);
      if (d > 11) {
        const t = (d - 9) / d, dest = this.floorIdxNear(s.x + (f.x - s.x) * t, s.y + (f.y - s.y) * t);
        path = this.bfs(tx, ty, (i) => i === dest); s.mode = 'scav';
      } else if (d > 4) {
        s.act = { type: 'hold', t: 0, dur: 3 + rnd() * 4, face: Math.atan2(f.y - s.y, f.x - s.x) };
        s.mode = 'scav'; s.path = []; return;
      }
    }
    // 3d) francotirador con sniper: se instala en un pasillo largo
    if (!path && !s.target && this.hasSniper(s) && (!k || now - k.t > 6)) {
      if (s.nest && (now > s.nest.until || (s.nest.relocate && now > s.nest.relocate))) s.nest = null;
      if (!s.nest) s.nest = this.pickNest(s);
      if (s.nest) {
        const nx = (s.nest.idx % W) + 0.5, ny = ((s.nest.idx / W) | 0) + 0.5;
        if (Math.hypot(nx - s.x, ny - s.y) > 0.6) { path = this.bfs(tx, ty, (i) => i === s.nest.idx); s.mode = 'nest'; }
        else { s.act = { type: 'hold', t: 0, dur: 4 + rnd() * 5, face: s.nest.face }; s.mode = 'nest'; s.path = []; return; }
      }
    }
    // 3e) seguir lo último que oyó o vio
    if (!path && k) {
      const age = now - k.t, dist = Math.hypot(k.x - s.x, k.y - s.y);
      if (dist < 1.4 && !s.target) { delete s.know[k.id]; s.headScan = 1.2; s.thinkT = 0.15; return; }   // llegó y no hay nadie
      if (s.huntStamp !== k.t) {
        s.huntStamp = k.t;
        // emboscada: se queda quieto, callado, escuchando
        if (s.rushT <= 0 && (!k.exact || age > 2) && dist > 3 && dist < 13 && rnd() < sk.ambush * (0.4 + 0.6 * tac) * 0.9) {
          s.act = { type: 'hold', t: 0, dur: 2.5 + rnd() * 5, face: Math.atan2(k.y - s.y, k.x - s.x) };
          s.mode = 'hold'; return;
        }
        // disparar a ciegas a través de una puerta cerrada
        const w = this.weaponOf(s);
        if (w && w.mag > 0 && age < 7 && dist < 9 && s.burstCd <= 0 && rnd() < sk.blind * 0.7) {
          const di = this.doorOnLine(s.x, s.y, k.x, k.y, 9);
          if (di >= 0) {
            s.burstCd = 7 + rnd() * 6;
            s.act = { type: 'burst', t: 0, shots: 2 + rint(3), next: 0.1, face: Math.atan2(k.y - s.y, k.x - s.x) };
            s.mode = 'burst'; return;
          }
        }
      }
      // adelantarse: si se estaba moviendo, apunta a donde va a estar
      let px = k.x, py = k.y;
      const sp = Math.hypot(k.vx || 0, k.vy || 0);
      if (sp > 0.5 && age < 4 && tac >= 0.8) { const dtp = Math.min(age + 1.4, 3.5); px += k.vx * dtp; py += k.vy * dtp; }
      const dest = this.floorIdxNear(px, py);
      path = this.bfs(tx, ty, (i) => i === dest); s.mode = 'hunt';
      if (path && path.length <= 1 && !s.target) { delete s.know[k.id]; s.headScan = 1.2; s.thinkT = 0.15; path = null; s.mode = 'search'; }   // no se puede llegar más cerca: ahí no hay nadie
      // esperar antes de una puerta cerrada (en vez de abrirla de golpe)
      const di = path ? path.findIndex((i) => this.doorGrid[i] && doorClosed(this.doors.get(i))) : -1;
      if (di > 0 && di <= 4 && age < 10 && s.doorWaited !== path[di] && rnd() < sk.door * 0.6 * tac) {
        s.doorWaited = path[di];
        const dr = this.doors.get(path[di]);
        s.act = { type: 'hold', t: 0, dur: 2 + rnd() * 2.5, face: Math.atan2(dr.ty + 0.5 - s.y, dr.tx + 0.5 - s.x) };
        s.mode = 'doorwait'; s.path = path; return;
      }
    }
    // 3f) equipos: no quedarse lejos de los compañeros
    if (!path && s.team >= 0 && sk.coord > 0.35) {
      let near = null, nd = 1e9;
      for (const m of this.soldiers) { if (m.alive && m !== s && m.team === s.team) { const d = Math.hypot(m.x - s.x, m.y - s.y); if (d < nd) { nd = d; near = m; } } }
      if (near && nd > 9) {
        const dest = this.floorIdxNear(near.x, near.y);
        path = this.bfs(tx, ty, (i) => i === dest, 40);
        if (path) s.mode = 'regroup';
      }
    }
    // 4) explorar: ir a donde hace más que no mira
    if (!path) {
      s.mode = 'search';
      if (prevMode === 'search' && s.path.length > 2) return;              // sigue con su ruta
      let bestI = -1, bs = -1e9;
      for (let n = 0; n < 24; n++) {
        const i = this.floor[rint(this.floor.length)], x = (i % W) + 0.5, y = ((i / W) | 0) + 0.5, d = Math.hypot(x - s.x, y - s.y);
        if (d < 5) continue;
        let sc = Math.min(120, now - s.explored[i]) - d * 0.15 + rnd() * 4;
        const wallsAround = (this.g[i - 1] ? 1 : 0) + (this.g[i + 1] ? 1 : 0) + (this.g[i - W] ? 1 : 0) + (this.g[i + W] ? 1 : 0);
        if (wallsAround >= 3) sc += 2;                                      // callejones sin salida: ahí puede haber alguien
        if (sc > bs) { bs = sc; bestI = i; }
      }
      if (bestI >= 0) path = this.bfs(tx, ty, (i) => i === bestI);
    }
    s.path = path || [];
  };

  /* ================= control manual (0.7) ================= */
  /** Movimiento con el joystick: apunta solo al enemigo que ve, abre las puertas al empujarlas. */
  G.steerManual = function (s, dt) {
    if (s.act || s.stunT > 0) return this.steer(s, dt);
    const c = this.ctl || (this.ctl = { mx: 0, my: 0, fire: false, sneak: false });
    const r = { vx: 0, vy: 0, desired: s.angle, speedMul: 1, sneak: false, scanning: false };
    const m = Math.hypot(c.mx, c.my);
    if (m > 0.12) {
      const k = Math.min(1, m);
      r.vx = c.mx / m * k; r.vy = c.my / m * k;
      r.speedMul = c.sneak ? 0.55 : k > 0.85 ? 1.12 : 0.55 + 0.5 * k;
      r.sneak = !!c.sneak; r.desired = Math.atan2(c.my, c.mx);
      const ix = Math.floor(s.x + r.vx * 0.8 / Math.max(1, k)), iy = Math.floor(s.y + r.vy * 0.8 / Math.max(1, k)), idx = iy * this.W + ix;
      if (this.doorGrid[idx] && doorClosed(this.doors.get(idx))) this.toggleDoor(idx, true, s);
    }
    if (s.target) r.desired = Math.atan2(s.target.y - s.y, s.target.x - s.x);
    return r;
  };
  /** Botones de la pantalla: recargar, cambiar de arma, tirar granada, curarse. */
  G.manualAction = function (kind) {
    const s = this.soldiers.find((q) => q.manual && q.alive);
    if (!s || s.act || this.phase !== 'run') return false;
    if (kind === 'reload') return this.startReload(s);
    if (kind === 'swap') {
      const order = ['pistol'].concat(s.inv.primary && ammoOf(s.inv.primary) > 0 ? ['primary'] : [], ['knife']);
      this.switchTo(s, order[(order.indexOf(s.cur) + 1) % order.length]); return true;
    }
    if (kind === 'heal') { if (!s.meds.length || s.hp >= s.maxHp) return false; this.startHeal(s); return true; }
    if (kind === 'nade') {
      const g = s.gren, type = s.target ? (g.frag > 0 ? 'frag' : g.flash > 0 ? 'flash' : g.smoke > 0 ? 'smoke' : null) : (g.smoke > 0 ? 'smoke' : g.flash > 0 ? 'flash' : g.frag > 0 ? 'frag' : null);
      if (!type) return false;
      const ang = s.target ? Math.atan2(s.target.y - s.y, s.target.x - s.x) : s.angle, d = s.target ? s.td : 8;
      s.act = { type: 'throw', t: 0, dur: 0.5, gtype: type, ang, speed: clamp(d * 1.25, 5, 13), released: false };
      s.path = []; return true;
    }
    return false;
  };

  /* ================= qué hace cada soldado en cada instante ================= */
  /** Calcula hacia dónde moverse, hacia dónde mirar y cómo (sigilo, velocidad). */
  G.steer = function (s, dt) {
    const P = s.P;
    const r = { vx: 0, vy: 0, desired: s.angle, speedMul: 1, sneak: P.sneak, scanning: false };
    if (s.stunT > 0) {                                                       // aturdido: tambalea sin ver nada
      r.vx = Math.sin(this.time * 5 + s.id) * 0.8; r.vy = Math.cos(this.time * 4 + s.id) * 0.8; r.speedMul = 0.5;
      r.scanning = true; r.sneak = false; r.desired = s.angle + Math.sin(this.time * 9) * 0.5; s.act = null; return r;
    }
    for (const gr of this.grenades) {                                        // granada a punto de explotar: salir corriendo
      if (gr.type !== 'frag' || gr.fuse - gr.t > 2.0) continue;
      const gx = s.x - gr.x, gy = s.y - gr.y, gd = Math.hypot(gx, gy);
      if (gd > 4.4) continue;
      if (!gr.aware) gr.aware = {};
      if (gr.aware[s.id] === undefined) gr.aware[s.id] = rnd() < 0.55 + IQ[s.iq].dodge * 0.45;
      if (!gr.aware[s.id]) continue;
      s.act = null; s.cover = null; s.icon = { ch: '💣', t: 0.6 };
      r.vx = gx / (gd || 1); r.vy = gy / (gd || 1); r.desired = Math.atan2(r.vy, r.vx); r.speedMul = 1.3; r.sneak = false;
      return r;
    }
    let act = s.act;
    if (act && act.type === 'heal') {                                        // usar un botiquín: quieto y en silencio
      act.t += dt; r.sneak = true; r.scanning = true;
      if (s.hurtT < 0.2 && act.t > 0.15) { s.act = null; s.healFail++; return r; }     // lo lastimaron: se interrumpe (el botiquín no se gasta)
      if (act.t >= act.dur) {
        const k = s.meds.indexOf(act.size);
        if (k >= 0) { s.meds.splice(k, 1); const before = s.hp; s.hp = Math.min(s.maxHp, s.hp + MED[act.size].amt); s.stats.healed += s.hp - before; }
        s.act = null; s.icon = { ch: '✚', t: 1 }; s.mood.fear = Math.max(0, s.mood.fear - 0.2);
      }
      return r;
    }
    if (act && s.target && (act.type === 'peek' || act.type === 'hold')) { s.act = act = null; }
    if (act && (act.type === 'open' || act.type === 'close') && s.target && s.td < 3) { s.act = act = null; }

    if (s.cover) { this.steerCover(s, dt, r); if (s.cover) return r; }

    if (act) {
      act.t += dt;
      if (act.type === 'open' || act.type === 'close') {
        r.desired = act.ang;
        if (!act.done && act.t >= act.dur * 0.5) {
          act.done = true;
          if (act.type === 'open') {
            this.toggleDoor(act.idx, true, s); s.stats.doors++;
            s.closeIdx = rnd() < (s.mode === 'flee' ? 0.95 : s.sk.door * 0.7) ? act.idx : null;   // al huir, cierra la puerta para cortar la persecución
          } else this.toggleDoor(act.idx, false, s);
        }
        if (act.t >= act.dur) s.act = null;
      } else if (act.type === 'hold') {
        r.desired = act.face; r.sneak = true; r.scanning = true;
        if (act.t >= act.dur) s.act = null;
      } else if (act.type === 'burst') {
        r.desired = act.face;
        if (Math.abs(angDiff(s.angle, r.desired)) < 0.12 && s.cd <= 0) {
          act.next -= dt;
          if (act.next <= 0 && act.shots > 0) { if (this.fire(s, 0.14)) act.shots--; else act.shots = 0; act.next = 0.22; }
        }
        if (act.shots <= 0 || act.t > 3) s.act = null;
      } else if (act.type === 'peek') {
        r.desired = act.face; r.sneak = true; r.scanning = true;
        const dx = act.px - s.x, dy = act.py - s.y, d = Math.hypot(dx, dy);
        if (d > 0.07) { r.vx = dx / d; r.vy = dy / d; r.speedMul = 0.55; }
        if (act.t >= act.dur) s.act = null;
      } else if (act.type === 'throw') {
        r.desired = act.ang;
        if (!act.released && act.t >= act.dur * 0.6 && Math.abs(angDiff(s.angle, act.ang)) < 0.5) {
          act.released = true; this.throwGrenade(s, act.gtype, act.ang, act.speed);
          if (act.gtype === 'flash') s.rushT = 4;                          // tira la aturdidora y entra enseguida
        }
        if (act.t >= act.dur) s.act = null;
      }
      return r;
    }

    // ----- comportamiento normal -----
    const [pmin, pmax] = this.prefRange(s), tgt = s.target, td = s.td;
    if (s.closeIdx != null && !tgt) {                                      // cerrar la puerta que abrió, para tapar la vista
      const dr = this.doors.get(s.closeIdx), dd = dr ? Math.hypot(dr.tx + 0.5 - s.x, dr.ty + 0.5 - s.y) : 0;
      if (!dr || !dr.open) s.closeIdx = null;
      else if (dd > 1.0 && dd < 2.3 && !s.path.includes(s.closeIdx)) {
        s.act = { type: 'close', t: 0, dur: 0.6, idx: s.closeIdx, ang: Math.atan2(dr.ty + 0.5 - s.y, dr.tx + 0.5 - s.x) };
        s.closeIdx = null; r.desired = s.act.ang; return r;
      }
    }
    const pathMode = s.mode === 'zone' || s.mode === 'flee' || s.mode === 'stalk' || s.mode === 'flank' || s.mode === 'carry';
    if (tgt && !pathMode) {
      const dx = tgt.x - s.x, dy = tgt.y - s.y;
      r.desired = s.aimPt ? Math.atan2(s.aimPt.y - s.y, s.aimPt.x - s.x) : Math.atan2(dy, dx); r.sneak = false;
      if (IQ[s.iq].tac >= 0.6) {                                           // no pararse junto a un barril si hay un enemigo mirando
        const nb = this.barrelsNear(s.x, s.y, 2.0);
        if (nb.length) { const bx = s.x - nb[0].x, by = s.y - nb[0].y, bd = Math.hypot(bx, by) || 1; r.vx += (bx / bd) * 0.9; r.vy += (by / bd) * 0.9; }
      }
      if (td < pmin) { r.vx = -dx / td; r.vy = -dy / td; }                  // retroceder
      else if (td <= pmax) {                                                 // mantener y moverse de costado
        if (s.cur !== 'knife') {
          s.strafeT -= dt;
          if (s.strafeT <= 0) {
            s.strafeT = 0.6 + rnd() * 0.9; s.strafeDir = rnd() < 0.5 ? 1 : -1;
            s.doStrafe = rnd() < (P.sneak ? (s.pers === 'francotirador' ? 0.1 : 0.8) : 0.65);
          }
          if (s.doStrafe) { r.vx = (-dy / td) * s.strafeDir * 0.7; r.vy = (dx / td) * s.strafeDir * 0.7; }
        }
      } else { const v = this.followPath(s, false); if (v) { r.vx = v[0]; r.vy = v[1]; } }
    } else {
      const v = this.followPath(s, !tgt && s.mode !== 'zone' && s.mode !== 'flee');
      if (v) { r.vx = v[0]; r.vy = v[1]; r.desired = Math.atan2(v[1], v[0]); }
      if ((s.mode === 'flee' || s.mode === 'stalk' || s.mode === 'flank' || s.mode === 'carry') && tgt) r.desired = bearing(s, tgt);
      if (!tgt) r.scanning = true;
      if (s.mode === 'stalk') r.sneak = true;
      else if (!P.sneak || s.mode === 'zone' || s.mode === 'flee' || s.mode === 'loot' || s.mode === 'flank' || s.mode === 'carry' || s.mode === 'obj') r.sneak = false;
      if ((s.mode === 'hunt' || s.mode === 'loot' || s.mode === 'obj' || s.mode === 'carry') && !P.sneak) r.speedMul = P.run * (s.rushT > 0 ? 1.1 : 1);
      if (s.mode === 'flee') r.speedMul = 1.08;
    }
    return r;
  };

  G.updateSoldier = function (s, dt) {
    s.recoil = Math.max(0, s.recoil - dt * 5); s.flash = Math.max(0, s.flash - dt);
    if (s.bubble) { s.bubble.t -= dt; if (s.bubble.t <= 0) s.bubble = null; }
    if (s.icon) { s.icon.t -= dt; if (s.icon.t <= 0) s.icon = null; }
    if (!s.alive) return;
    if (this.phase !== 'run') { s.gait *= 0.85; return; }
    s.cd -= dt; s.burstCd -= dt; s.talkCd -= dt; s.radioCd -= dt; s.hurtT += dt; s.dodgeCd -= dt; s.dodgeT -= dt;
    s.freezeT -= dt; s.reactT -= dt; s.rushT = Math.max(0, s.rushT - dt); s.unstickT = Math.max(0, s.unstickT - dt);
    s.shieldT = Math.max(0, s.shieldT - dt); if (s.shieldT <= 0) s.shieldHp = 0;
    s.speedT = Math.max(0, s.speedT - dt); s.stunT = Math.max(0, s.stunT - dt);
    const P = s.P, iq = IQ[s.iq], m = s.mood, st = s.stats;

    this.sense(s);
    this.manageWeapon(s, dt);
    for (const id in s.know) if (this.time - s.know[id].t > 30) delete s.know[id];

    // ánimo: el miedo y la furia suben con lo que pasa y bajan solos
    m.fear = Math.max(0, m.fear - dt * (s.target ? 0.05 : 0.12));
    m.fury = Math.max(0, m.fury - dt * 0.04);
    m.conf += (0.5 - m.conf) * Math.min(1, dt * 0.1);
    if (P.rage > 0.6) m.fury = Math.max(m.fury, (1 - s.hp / s.maxHp) * 0.95);   // el berserker se enfurece al perder vida
    if (!s.icon) {
      if (m.fear > 0.7 && rnd() < dt * 0.4) s.icon = { ch: '😨', t: 1 };
      else if (m.fury > 0.75 && rnd() < dt * 0.4) s.icon = { ch: '😡', t: 1 };
    }
    if (m.fear > 0.75 && s.freezeT <= 0 && rnd() < dt * 0.25 * (1 - P.bravery)) s.freezeT = 0.4 + rnd() * 0.5;   // se paraliza

    s.thinkT -= dt;
    if (s.thinkT <= 0) { s.thinkT = (0.3 + rnd() * 0.2) * iq.think; if (!s.manual && !s.passive) this.think(s); }
    if (s.manual) s.reactT = 0;

    // zona: daño fuera del área segura
    if (this.zone && this.outsideZone(s.x, s.y)) {
      s.zoneT += dt;
      if (s.zoneT >= 1) { s.zoneT = 0; this.damage(s, null, 14, true); if (!s.alive) return; }
    } else s.zoneT = 0;
    if (this.overtime) {                                                       // muerte súbita: nadie puede esconderse para siempre
      s.otT = (s.otT || 0) + dt;
      if (s.otT >= 1) { s.otT = 0; this.damage(s, null, 5 + (this.time - this.overtimeAt) * 0.25, true); if (!s.alive) return; }
    }

    this.chatter(s);

    // linterna: los ruidosos la prenden a oscuras (y se delatan); los silenciosos no
    s.lT = (s.lT || 0) - dt;
    if (s.lT <= 0) { s.lT = 0.5; s.flashlight = !this.isLit(s.x, s.y) && !P.sneak; }
    // ¿le conviene dispararle a un barril que está junto al enemigo?
    s.aimT = (s.aimT || 0) - dt;
    if (s.aimT <= 0) { s.aimT = 0.3; s.aimPt = s.target ? this.barrelTarget(s) : null; }

    // ----- qué quiere hacer -----
    const frozen = s.freezeT > 0 && !s.manual;
    if (!s.manual && !s.passive && !s.act && !frozen && s.stunT <= 0 && (!s.cover || s.cover.phase !== 'go')) {
      s.gT = (s.gT || 0) - dt;
      if (s.gT <= 0) { s.gT = 0.4; if (!this.tryGrenade(s) && !s.act && this.wantHeal(s)) this.startHeal(s); }
    }
    const r = frozen ? { vx: 0, vy: 0, desired: s.angle, speedMul: 1, sneak: false, scanning: false } : s.manual ? this.steerManual(s, dt) : this.steer(s, dt);
    let { vx, vy, desired, speedMul, scanning } = r;
    const hidden = s.cover || s.mode === 'hold' || s.mode === 'scav' || s.mode === 'nest' || s.mode === 'recover' || s.mode === 'doorwait';
    if (hidden && s.act && s.act.type === 'hold') st.hidden += dt;
    if (s.cover && s.cover.phase === 'hide') st.hidden += dt;
    if (s.mode === 'flee') st.fled += dt;

    // esquivar balas que vienen (los más inteligentes lo hacen mejor)
    if (!frozen && !s.manual && s.dodgeCd <= 0) {
      s.dodgeCd = 0.12;
      const inc = this.incomingBullet(s);
      if (inc && rnd() < iq.dodge) { s.dodgeT = 0.3; s.dodgeDir = inc; s.dodgeCd = 0.7; }
    }
    if (s.dodgeT > 0 && !frozen) { vx = vx * 0.25 + s.dodgeDir[0] * 1.2; vy = vy * 0.25 + s.dodgeDir[1] * 1.2; }

    s.sneak = r.sneak && !s.target;
    if (s.sneak && !s.act) speedMul *= 0.62;

    // ----- movimiento -----
    let dm = 0;
    if (vx || vy) {
      const sp = P.speed * this.defOf(s).move * (1 + m.fury * 0.15) * (s.speedT > 0 ? 1.6 : 1) * speedMul * dt;
      const ox = s.x, oy = s.y;
      const moved = this.tryMove(s, vx * sp, vy * sp);
      dm = Math.hypot(s.x - ox, s.y - oy); st.dist += dm;
      if (!moved) { s.strafeDir *= -1; s.strafeT = 0.2; }
      if (dm > 0) s.moveAng += angDiff(s.moveAng, Math.atan2(vy, vx)) * Math.min(1, dt * 14);
    }
    s.gait += ((dm > 0 ? Math.min(1, dm / dt / (P.speed * 0.8)) : 0) - s.gait) * Math.min(1, dt * 10);
    s.phase += dm * 3.2;
    const stepN = Math.floor(s.phase / Math.PI);
    if (stepN !== s.lastStep) {                                              // pasos: suenan según cómo camina
      s.lastStep = stepN;
      if (s.gait > 0.75 && !s.sneak && this.speed <= 2 && this.quality !== 'ahorro' && !this.cfg.noRec && this.camDist(s) < 14 && (this.floorT ? this.floorT[Math.floor(s.y) * this.W + Math.floor(s.x)] !== 1 : true)) {
        const ba = s.moveAng + Math.PI;                                       // polvito al correr
        this.parts.push({ x: s.x + Math.cos(ba) * 0.2, y: s.y + Math.sin(ba) * 0.2, vx: Math.cos(ba) * 0.4 + (rnd() - 0.5) * 0.3, vy: Math.sin(ba) * 0.4 + (rnd() - 0.5) * 0.3, life: 0.45, max: 0.9, color: '#9b9387', size: 0.09 + rnd() * 0.05 });
      }
      if (this.speed === 1 && !this.dead && this.time - (this._stepT || 0) > 0.09 && this.camDist(s) < 7) {         // se oyen los pasos cerca de la cámara
        this._stepT = this.time;
        sfx.step(this.floorT ? this.floorT[Math.floor(s.y) * this.W + Math.floor(s.x)] || 0 : 0, (s.sneak ? 0.35 : 1) * (1 - this.camDist(s) / 8), this.camPan(s.x));
      }
      this.emitSound(s.x, s.y, (s.sneak ? 1.8 : (s.mode === 'hunt' || s.mode === 'attack') && !P.sneak ? 6.5 : 4.2) * this.stepMul(s.x, s.y), 'step', s);   // la alfombra amortigua, el metal y la grava hacen ruido
    }
    this.checkStuck(s, dt, vx || vy);

    // ----- cuerpo y cabeza -----
    const diff = angDiff(s.angle, desired), turn = 9 * dt * (frozen ? 0.2 : 1);
    s.angle += Math.abs(diff) < turn ? diff : Math.sign(diff) * turn;
    const off = scanning || s.headScan > 0 ? Math.sin(this.time * 1.5 + s.id * 1.7) * (0.55 + 0.4 * s.sk.listen) : 0;
    if (s.headScan > 0) s.headScan -= dt;
    s.headOff += (off - s.headOff) * Math.min(1, dt * 6);
    s.look += angDiff(s.look, s.angle + s.headOff) * Math.min(1, dt * 10);

    // ----- atacar -----
    const ctl = s.manual ? (this.ctl || {}) : null;
    if (s.manual && ctl.fire && !s.target && !s.act && s.stunT <= 0 && s.cd <= 0 && s.reloadT <= 0 && s.swapT <= 0 && s.cur !== 'knife') this.fire(s, 0);   // dispara hacia adelante
    if (s.target && !s.act && !frozen && s.stunT <= 0 && s.cd <= 0 && s.reloadT <= 0 && s.swapT <= 0 && s.reactT <= 0 && !s.passive && (!s.manual || ctl.fire)) {
      const aim = s.aimPt || s.target, b = Math.atan2(aim.y - s.y, aim.x - s.x), ad = Math.hypot(aim.x - s.x, aim.y - s.y);
      if (s.cur === 'knife') { if (s.td <= KNIFE.range + 0.2 && Math.abs(angDiff(s.angle, b)) < 0.6) this.melee(s, s.target); }
      else if (ad <= this.defOf(s).range && Math.abs(angDiff(s.angle, b)) < 0.14) {
        if (this.clearShot(s, aim)) this.fire(s, 0); else s.strafeT = 0;   // con fuego amigo: no dispara si hay un compañero en medio
      }
    }
  };

  /** Detector de trabas: si un soldado no avanza sin motivo, se le da un destino al azar. */
  G.checkStuck = function (s, dt, wantsMove) {
    if (s.manual) return;
    const k = s.stuck;
    k.t += dt;
    if (k.t < 1) return;
    k.t = 0;
    if (Math.hypot(s.x - k.x, s.y - k.y) > 0.35) { k.n = 0; k.x = s.x; k.y = s.y; return; }
    const waiting = s.act || s.reloadT > 0 || s.cover || s.target || s.mode === 'nest' || s.mode === 'recover' || s.mode === 'scav' || s.mode === 'hold' || s.mode === 'doorwait' || s.freezeT > 0;
    if (waiting) { k.n = 0; return; }
    if (++k.n < 9) return;
    k.n = 0; k.x = s.x; k.y = s.y;
    s.stats.stuck++; this.stuckEvents++;
    s.cover = null; s.act = null; s.nest = null; s.path = [];
    const W = this.W;
    for (let n = 0; n < 14; n++) {
      const i = this.floor[rint(this.floor.length)];
      if (Math.hypot((i % W) + 0.5 - s.x, ((i / W) | 0) + 0.5 - s.y) < 6) continue;
      const p = this.bfs(Math.floor(s.x), Math.floor(s.y), (j) => j === i);
      if (p) { s.path = p; s.mode = 'unstick'; s.unstickT = 6; break; }
    }
  };

  /* ================= charla ================= */
  G.chatter = function (s) {
    if (this.cfg.talk === false || s.talkCd > 0) return;
    const P = s.P, e = s.target;
    if (P.loud) {
      if (s.mood.fury > 0.7 && P.rage > 0.6 && rnd() < 0.6) { this.say(s, pickLine('rage')); s.talkCd = 5 + rnd() * 4; return; }
      if (e) {
        const line = rnd() < 0.35 ? pickLine('seenWeapon', e.name, e.wtype) : '';
        this.say(s, line || pickLine('seen', e.name)); s.talkCd = 4 + rnd() * 5;
      } else if (s.mode === 'hunt' && rnd() < 0.5) {
        const k = this.bestKnowledge(s), who = k ? this.soldiers[k.id] : null;
        this.say(s, pickLine('hunt', who ? who.name : 'cobarde')); s.talkCd = 6 + rnd() * 6;
      } else s.talkCd = 2;
    } else if (P.scream && s.mood.fear > 0.55 && e) {                        // el cobarde grita de miedo (y se delata)
      this.say(s, pickLine('scare')); s.talkCd = 4 + rnd() * 4;
    } else s.talkCd = 3;
  };

  /* ================= avisos del motor ================= */
  G.onShot = function (s, w) {
    if (w.type === 'sniper' && s.nest) s.nest.relocate = this.time + 1.5 + rnd() * 2.5;   // dispara y cambia de lugar
  };
  G.heard = function (s, src, kind, x, y) {
    if (kind === 'shot' && s.sk.scav > 0.4 && !s.target) s.fightAt = { x, y, t: this.time };   // el oportunista anota dónde hay pelea
  };
  G.onDamaged = function (s, by, dealt, zone) {
    s.hurtT = 0; s.lastHurt = this.time; if (by) s.hurtBy = by.id;
    const P = s.P, m = s.mood;
    m.fear = clamp01(m.fear + (dealt / (HPL * 1.1)) * (1 - P.bravery * 0.6));
    m.fury = clamp01(m.fury + P.rage * (dealt / HPL) * 0.9);
    m.conf = clamp01(m.conf - 0.08);
    s.stats.dmgTaken += dealt;
    if (by && by !== s && by.stats && !(by.team >= 0 && by.team === s.team)) by.stats.dmgDealt += dealt;
    s.thinkT = Math.min(s.thinkT, 0.1);
    if (this.cfg.talk !== false && s.hp > 0 && s.talkCd < 2.5 && by) {
      if (P.loud && rnd() < 0.5) { this.say(s, pickLine('hurt')); s.talkCd = 5; }
      else if (P.scream && rnd() < 0.7) { this.say(s, pickLine('scare')); s.talkCd = 4; }
    }
  };
  G.onKilled = function (s, by, zone) {
    if (by && by !== s && by.stats && !(by.team >= 0 && by.team === s.team)) {
      const w = by.wtype || 'pistol';
      by.stats.killsBy[w] = (by.stats.killsBy[w] || 0) + 1;
      if (w === 'knife') by.stats.knifeKills++;
      by.stats.longKill = Math.max(by.stats.longKill, Math.hypot(by.x - s.x, by.y - s.y));
      by.mood.conf = clamp01(by.mood.conf + 0.25); by.mood.fear = Math.max(0, by.mood.fear - 0.25); by.mood.fury = clamp01(by.mood.fury + 0.1);
      if (by.alive && by.P.loud) this.say(by, pickLine('kill', s.name));
    }
    for (const o of this.soldiers) {
      if (!o.alive || o === by || o === s) continue;
      const d = Math.hypot(o.x - s.x, o.y - s.y);
      if (d > 22) continue;
      if (o.sk.scav > 0.4 && o.fightAt && this.time - o.fightAt.t < 14) {    // el oportunista entra a robar el botín y la baja
        o.fightAt = null; o.rushT = 9; o.thinkT = 0; o.act = null;
        if (by && by.alive) o.know[by.id] = { id: by.id, x: by.x, y: by.y, t: this.time, exact: false, kind: 'kill', vx: 0, vy: 0 };
        for (const it of this.items) if (Math.hypot(it.x - s.x, it.y - s.y) < 3) o.seenItems.set(it.id, it);
      } else if (o.team >= 0 && o.team === s.team) {                          // ver caer a un compañero asusta o enfurece
        o.mood.fear = clamp01(o.mood.fear + 0.25 * (1 - o.P.bravery * 0.6)); o.mood.fury = clamp01(o.mood.fury + 0.25 * o.P.rage);
      }
    }
  };

  /* ================= equipos ================= */
  /** Cada tanto, los compañeros que están juntos se pasan munición. */
  G.teamTick = function (dt) {
    if (!this.cfg.teamMode) return;
    this._tt = (this._tt || 0) - dt;
    if (this._tt > 0) return;
    this._tt = 1.2;
    for (const a of this.soldiers) {
      if (!a.alive) continue;
      for (const b of this.soldiers) {
        if (!b.alive || b === a || b.team !== a.team || Math.hypot(a.x - b.x, a.y - b.y) > 2.2) continue;
        const pa = a.inv.primary, pb = b.inv.primary;
        if (pa && pb && pa.type === pb.type) {
          const def = WEAPONS[pa.type], ta = ammoOf(pa), tb = ammoOf(pb);
          if (ta > tb * 1.8 && ta > def.mag * 2 && tb < def.mag * 2) {
            const give = Math.min(Math.floor(pa.res * 0.35), def.mag);
            if (give > 3) { pa.res -= give; pb.res += give; a.stats.shared += give; }
          }
        }
        const qa = a.inv.pistol, qb = b.inv.pistol;
        if (qa.res > qb.res * 2 + 10 && qb.res < 10) { qa.res -= 8; qb.res += 8; a.stats.shared += 8; }
      }
    }
  };
})();
