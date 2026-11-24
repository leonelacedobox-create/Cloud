/* IA de la 0.9.9: aprende de los rivales y juega en equipo de verdad.
   - Memoria de cada rival: anota por dónde le aparece cada uno; cuando no hay esquina ni puerta que vigilar,
     apunta hacia donde suele venir ese rival.
   - Intercambio de bajas: si cae un compañero cerca, los demás saben exactamente dónde está el que lo bajó,
     lo vigilan y van a cobrársela.
   - (Se probaron el fuego concentrado y adaptarse al marcador: en miles de partidas restaban, así que quedaron apagados.)
   Cada soldado tiene s.ai3 (true por defecto); con cfg.oldAI3 = [ids] algunos juegan con la IA de la 0.9.8,
   para medir la diferencia. Se carga después de brain3.js. */
'use strict';

(() => {
  const E = App.battle, G = E.Game.prototype;
  const { angDiff } = E;
  const isNew = (g, s) => !s.manual && s.ai3 !== false && s.ai2 !== false;
  // 'focus' (fuego concentrado) y 'score' (adaptarse al marcador) se midieron y restaban en equipos: quedaron apagados
  const DISABLED = ['focus', 'score'];
  const on = (g, k) => !DISABLED.includes(k) && !(g.cfg.ai3Off && g.cfg.ai3Off.includes(k));

  const spawnOld = G.spawn;
  G.spawn = function () {
    const r = spawnOld.call(this);
    const old = new Set(this.cfg.oldAI3 || []);
    for (const s of this.soldiers) s.ai3 = !old.has(s.id);
    return r;
  };

  /* ----- memoria de cada rival: por dónde aparece ----- */
  const senseOld = G.sense;
  G.sense = function (s) {
    const had = s.target;
    const r = senseOld.call(this, s);
    if (!had && s.target && isNew(this, s) && on(this, 'learn')) {
      const L = s.learn || (s.learn = {}), e = s.target;
      const a = Math.atan2(e.y - s.y, e.x - s.x), sec = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
      const m = L[e.id] || (L[e.id] = { sec: new Array(8).fill(0), n: 0 });
      m.sec[sec]++; m.n++;
    }
    return r;
  };
  const preOld = G.preAimPoint;
  G.preAimPoint = function (s) {
    const p = preOld.call(this, s);
    if (p || !isNew(this, s) || !on(this, 'learn') || !s.learn) return p;
    // nada que vigilar en el camino: mira hacia donde suelen aparecerle los rivales vivos
    const tot = new Array(8).fill(0);
    for (const id in s.learn) { const o = this.soldiers[id]; if (o && o.alive) s.learn[id].sec.forEach((v, i) => { tot[i] += v; }); }
    let best = -1, bv = 1; tot.forEach((v, i) => { if (v > bv) { bv = v; best = i; } });
    if (best < 0) return null;
    const a = best * Math.PI / 4;
    return { x: s.x + Math.cos(a) * 4, y: s.y + Math.sin(a) * 4, why: 'learn' };
  };

  /* ----- intercambio de bajas: el que bajó a un compañero queda marcado para los de al lado ----- */
  const killOld = G.kill;
  G.kill = function (s, by, zone) {
    killOld.call(this, s, by, zone);
    if (!by || by === s || !by.alive || s.team < 0 || by.team === s.team || !on(this, 'trade')) return;
    for (const m of this.soldiers) {
      if (!m.alive || m.team !== s.team || m === s || !isNew(this, m) || m.downed) continue;
      if (Math.hypot(m.x - s.x, m.y - s.y) > 15) continue;
      m.know[by.id] = { id: by.id, x: by.x, y: by.y, t: this.time, exact: true, kind: 'trade', vx: 0, vy: 0 };
      m.tradeId = by.id; m.tradeUntil = this.time + 4;
      m.thinkT = Math.min(m.thinkT, 0.1);
      m.stats.trades = (m.stats.trades || 0) + 1;
    }
  };

  /* ----- a quién tirarle: fuego concentrado y cobrar la baja ----- */
  const threatOld = G.threat;
  G.threat = function (s, e, d) {
    let sc = threatOld.call(this, s, e, d);
    if (!isNew(this, s) || e.downed) return sc;
    if (on(this, 'focus') && s.team >= 0) {
      let allies = 0; for (const m of this.soldiers) if (m.alive && m !== s && m.team === s.team && m.target === e) allies++;
      sc += Math.min(2, allies) * 1.3;                                           // le tiran los compañeros: cae más rápido
    }
    if (on(this, 'trade') && s.tradeId === e.id && this.time < (s.tradeUntil || 0)) sc += 2.5;
    return sc;
  };

  /* ----- se adapta al marcador ----- */
  const utilOld = G.utilities;
  G.utilities = function (s, e, td) {
    const U = utilOld.call(this, s, e, td);
    if (!isNew(this, s) || !on(this, 'score')) return U;
    let mine = 0, theirs = 0;
    if (s.team >= 0) for (const o of this.soldiers) { if (!o.alive || o.downed || o.bot) continue; if (o.team === s.team) mine++; else theirs++; }
    if (s.team >= 0 && mine && theirs) {
      const adv = mine - theirs;
      if (adv <= -1) { U.cover = (U.cover || 0) + 0.25; if (U.attack != null) U.attack -= 0.15; }     // en desventaja: más tapado, que vengan ellos
      else if (adv >= 2) { if (U.attack != null) U.attack += 0.25; U.flank = (U.flank || 0) + 0.15; }  // con ventaja: apretar
    }
    if (on(this, 'trade') && s.tradeId === e.id && this.time < (s.tradeUntil || 0) && U.attack != null) U.attack += 0.2;
    return U;
  };
})();
