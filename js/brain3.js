/* IA de la 0.9.8: juega como un jugador de verdad al moverse por el mapa.
   - Apunta antes a las esquinas: mientras camina, mira a donde podría aparecer alguien (la esquina que va a
     doblar, la puerta que va a cruzar, el último lugar donde sabe que había un rival). Si el rival aparece
     justo ahí, reacciona mucho más rápido.
   - Revisa los costados al entrar a un cuarto (como hace un jugador al cruzar una puerta).
   - (Salir de la puerta en pleno tiroteo se probó y empeoraba los duelos: quedó apagado.)
   Cada soldado tiene s.ai2 (true por defecto); con cfg.oldAI = [ids] algunos juegan con la IA anterior,
   así se puede comparar una contra la otra en el banco de pruebas. Se carga después de world3.js. */
'use strict';

(() => {
  const E = App.battle, G = E.Game.prototype;
  const { angDiff } = E;
  const rnd = Math.random;
  const isNew = (g, s) => !s.manual && s.ai2 !== false;
  const on = (g, k) => !(g.cfg.ai2Off && g.cfg.ai2Off.includes(k));   // apagar una mejora para medirla (pruebas)

  // quién juega con la IA vieja (solo para comparar en las pruebas)
  const spawnOld = G.spawn;
  G.spawn = function () {
    const r = spawnOld.call(this);
    const old = new Set(this.cfg.oldAI || []);
    for (const s of this.soldiers) s.ai2 = !old.has(s.id);
    return r;
  };

  /** ¿A dónde conviene apuntar mientras camina? (o null si no hay nada que vigilar) */
  G.preAimPoint = function (s) {
    const W = this.W, p = s.path; if (!p || p.length < 3) return null;
    const n = Math.min(p.length, 9);
    for (let k = 1; k < n; k++) {
      const i = p[k], x = (i % W) + 0.5, y = ((i / W) | 0) + 0.5;
      if (this.doorGrid[i] && k <= 4) {                                        // una puerta adelante: apunta a lo que hay del otro lado
        const j = p[Math.min(p.length - 1, k + 1)]; return { x: (j % W) + 0.5, y: ((j / W) | 0) + 0.5, why: 'door' };
      }
      if (!this.los(s.x, s.y, x, y)) {                                          // la ruta dobla: apunta al borde de la esquina
        const j = p[k - 1], cx = (j % W) + 0.5, cy = ((j / W) | 0) + 0.5;
        if (Math.hypot(cx - s.x, cy - s.y) < 1.2) return null;
        return { x: (cx + x) / 2, y: (cy + y) / 2, why: 'corner' };
      }
    }
    const k = this.bestKnowledge && this.bestKnowledge(s);                     // si sabe más o menos dónde está alguien, vigila hacia ahí
    if (k && this.time - k.t < 6 && Math.hypot(k.x - s.x, k.y - s.y) < 16) return { x: k.x, y: k.y, why: 'know' };
    return null;
  };

  const steerOld = G.steer;
  G.steer = function (s, dt) {
    const r = steerOld.call(this, s, dt);
    if (!isNew(this, s) || s.act || s.downed || s.vault) return r;
    const W = this.W, ci = Math.floor(s.y) * W + Math.floor(s.x);
    // 1) en una puerta con un rival a la vista: salir de la puerta hacia un costado tapado
    if (false && on(this, 'door') && s.target && this.doorGrid[ci] && !s.carry && !(r.vx || r.vy) && !(s.squadGoal || s.breach)) {   // solo si se quedó parado en la puerta
      let best = null, bs = -1e9;
      for (const d of [1, -1, W, -W]) {
        const j = ci + d; if (this.g[j] || this.doorGrid[j]) continue;
        const x = (j % W) + 0.5, y = ((j / W) | 0) + 0.5;
        const sc = (this.losShot(s.target.x, s.target.y, x, y) ? 0 : 3) + Math.hypot(x - s.target.x, y - s.target.y) * 0.2;
        if (sc > bs) { bs = sc; best = { x, y }; }
      }
      if (best) { const dx = best.x - s.x, dy = best.y - s.y, d = Math.hypot(dx, dy) || 1; r.vx = dx / d; r.vy = dy / d; s.stats.doorExit = (s.stats.doorExit || 0) + dt; }
      return r;
    }
    // 1b) frenar para disparar: moverse arruina la puntería, así que se planta justo antes de cada disparo (y después sigue esquivando)
    if (on(this, 'stop') && s.target && (r.vx || r.vy) && s.cur !== 'knife' && s.mode !== 'flee' && s.mode !== 'zone' && !s.carry) {
      const w = this.weaponOf(s), def = w && E.WEAPONS[w.type];
      if (def && w.mag > 0 && s.reloadT <= 0 && s.target.target !== s && s.td > 3.5 && s.td < def.range * 0.95 && s.cd < 0.12 + (def.auto ? 0.1 : 0)) {   // solo si el rival no lo está apuntando a él
        r.vx *= 0.18; r.vy *= 0.18; s.stats.stopShot = (s.stats.stopShot || 0) + dt;
      }
    }
    if (s.target) return r;
    // 2) cruzando una puerta: revisar los costados del cuarto
    if (on(this, 'clear') && this.doorGrid[ci] && (r.vx || r.vy)) {
      if (!(s.clearT > 0) && !(s.lastClear > this.time - 3)) { s.clearT = 0.75; s.lastClear = this.time; s.clearBase = Math.atan2(r.vy, r.vx); s.clearSide = rnd() < 0.5 ? 1 : -1; s.stats.cleared = (s.stats.cleared || 0) + 1; }
    }
    if (s.clearT > 0) {
      s.clearT -= dt;
      const k = 1 - s.clearT / 0.75;                                             // un costado, el otro y al frente
      r.desired = s.clearBase + (k < 0.33 ? s.clearSide * 0.8 : k < 0.66 ? -s.clearSide * 0.8 : 0); r.scanning = false;
      return r;
    }
    // 3) caminando: apuntar a la esquina, la puerta o donde sabe que hay alguien
    if ((s.preT = (s.preT || 0) - dt) <= 0) { s.preT = 0.18; s.pre = this.preAimPoint(s); }
    // 4) sostener el ángulo: oyó a alguien cerca que todavía no ve → se planta apuntando por donde va a salir
    const patient = { cauteloso: 3, francotirador: 3.2, tactico: 2.4, oportunista: 2.2, cobarde: 2.6, asesino: 1.2, agresivo: 0.5, berserker: 0.3 }[s.pers] || 1.5;
    if (s.holdAng) {
      s.holdAng.t -= dt;
      if (s.holdAng.t <= 0 || this.time - s.holdAng.k.t > 4) { s.holdAng = null; s.holdCd = this.time + 4; }
      else { r.vx = 0; r.vy = 0; r.desired = s.holdAng.a; r.scanning = false; s.stats.holdAng = (s.holdAng.dt || 0) + dt; return r; }
    } else if (on(this, 'hold') && patient > 0.6 && s.pre && s.pre.why !== 'door' && this.time > (s.holdCd || 0) && !s.carry && s.mode !== 'zone' && s.mode !== 'obj' && s.mode !== 'flee') {
      const k = this.bestKnowledge && this.bestKnowledge(s);
      if (k && this.time - k.t < 2 && Math.hypot(k.x - s.x, k.y - s.y) < 10 && !this.los(s.x, s.y, k.x, k.y)) {
        s.holdAng = { a: Math.atan2(s.pre.y - s.y, s.pre.x - s.x), t: patient * (0.7 + rnd() * 0.6), k };
        s.stats.holds = (s.stats.holds || 0) + 1;
        r.vx = 0; r.vy = 0; r.desired = s.holdAng.a; r.scanning = false; return r;
      }
    }
    if (on(this, 'pre') && s.pre && (r.vx || r.vy)) {
      const a = Math.atan2(s.pre.y - s.y, s.pre.x - s.x), mv = Math.atan2(r.vy, r.vx);
      if (Math.abs(angDiff(mv, a)) < 1.9) { r.desired = a; r.scanning = false; s.stats.preAim = (s.stats.preAim || 0) + dt; }
    }
    return r;
  };

  /* ----- a quién dispararle: al que se puede bajar rápido y sin riesgo ----- */
  const threatOld = G.threat;
  G.threat = function (s, e, d) {
    let sc = threatOld.call(this, s, e, d);
    if (!isNew(this, s) || e.downed || !on(this, 'threat')) return sc;
    if (e.reloadT > 0) sc += 3;                                                  // está recargando: es el momento
    if (e.target && e.target !== s) sc += 2;                                     // está peleando con otro: no me ve venir
    sc += (1 - e.hp / e.maxHp) * 3;                                              // herido: se termina rápido
    if (!this.losShot(s.x, s.y, e.x, e.y)) sc -= 3.5;                            // detrás de un cajón o un mueble: las balas no le llegan
    return sc;
  };

  /* ----- si el rival aparece donde ya estaba apuntando, reacciona mucho más rápido ----- */
  const senseOld = G.sense;
  G.sense = function (s) {
    const had = s.target;
    const r = senseOld.call(this, s);
    if (!had && s.target && isNew(this, s) && on(this, 'pre')) {
      const a = Math.atan2(s.target.y - s.y, s.target.x - s.x);
      const off = Math.abs(angDiff(s.angle, a));
      if (off < 0.45) {                                                          // ya lo tenía en la mira: reacciona antes y el arma ya está casi en su lugar
        s.reactT *= 0.45; s.stats.preHit = (s.stats.preHit || 0) + 1;
        s.aimFor = s.target.id; s.aimErr = (rnd() - 0.5) * (0.08 + off * 0.5);
      }
    }
    return r;
  };
})();
