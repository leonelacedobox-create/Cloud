/* Sonidos de las acciones y efectos de presentación (0.9.6). Engancha los sonidos grabados del banco
   (js/sfxbank.js) a lo que pasa en la partida: recargas por partes, casquillos según el piso, cada arma
   de cerca y de lejos, impactos por material, puertas, cuchillo, dolor y muerte con la voz de cada uno,
   rebotes de granadas, radio, saltos y levantadas. Se carga después de world2.js. */
'use strict';

(() => {
  const { sfx, vibrate } = App;
  const E = App.battle;
  const G = E.Game.prototype;
  const { WEAPONS } = E;
  const rnd = Math.random;

  /** ¿Vale la pena sonar? (velocidad normal, cerca de la cámara y no en una simulación) */
  G.near = function (x, y, r = 16) { return !this.cfg.noRec && this.speed <= 2 && Math.hypot(x - this.camX, y - this.camY) < r; };
  G.floorAt = function (x, y) { return this.floorT ? this.floorT[Math.floor(y) * this.W + Math.floor(x)] || 0 : 0; };
  const voiceOf = (s) => s.voice || (s.voice = 0.84 + ((s.id * 37 + 11) % 36) / 100);   // cada uno con su tono de voz

  /* ----- disparo: arma de cerca/lejos, casquillo según el piso, bomba de la escopeta y cerrojo del sniper ----- */
  const fireOld = G.fire;
  G.fire = function (s, extra) {
    const w = this.weaponOf(s);
    const ok = fireOld.call(this, s, extra);
    if (ok && w && this.near(s.x, s.y, 12)) {
      const pan = this.camPan(s.x), v = this.camVol(s.x, s.y);
      if (w.type !== 'crossbow') sfx.casing(this.floorAt(s.x, s.y), pan, v);
      if (w.type === 'shotgun' || w.type === 'sniper') sfx.reload('pump', pan, v * 0.8, w.type === 'sniper' ? 0.45 : 0.3);
    }
    return ok;
  };
  /* ----- recargas por partes (los tiempos van con la duración de la recarga de cada arma) ----- */
  const reloadOld = G.startReload;
  G.startReload = function (s) {
    const ok = reloadOld.call(this, s);
    if (ok && this.near(s.x, s.y, 12)) {
      const w = this.weaponOf(s), pan = this.camPan(s.x), v = this.camVol(s.x, s.y), T = s.reloadTot / Math.max(1, this.speed);
      if (w.type === 'shotgun' || w.type === 'revolver' || w.type === 'crossbow') {
        const n = Math.min(6, Math.max(1, (WEAPONS[w.type].mag || 6) - w.mag));
        if (w.type === 'revolver') sfx.reload('out', pan, v * 0.7);
        for (let k = 0; k < n; k++) sfx.reload('shell', pan, v, (k + 1) * T / (n + 1.5));
        if (w.type === 'shotgun') sfx.reload('pump', pan, v, T * 0.95);
        if (w.type === 'revolver') sfx.reload('in', pan, v * 0.7, T * 0.92);
      } else {
        sfx.reload('out', pan, v);
        sfx.reload('in', pan, v, T * 0.62);
        sfx.reload('pump', pan, v * 0.55, T * 0.9);                            // corredera / palanca de carga
      }
    }
    return ok;
  };
  const swapOld = G.switchTo;
  G.switchTo = function (s, which) {
    const was = s.cur; swapOld.call(this, s, which);
    if (was !== s.cur && this.near(s.x, s.y, 10)) sfx.swap(this.camPan(s.x), this.camVol(s.x, s.y));
  };
  /* ----- cuchillo: el movimiento y el golpe ----- */
  const meleeOld = G.melee;
  G.melee = function (s, tgt) {
    if (this.near(s.x, s.y, 12)) { const pan = this.camPan(s.x), v = this.camVol(s.x, s.y); sfx.swing(pan, v); sfx.stab(pan, v * 0.9); }
    return meleeOld.call(this, s, tgt);
  };
  /* ----- impactos de bala según lo que tocan ----- */
  const bulletOld = G.bulletTile;
  G.bulletTile = function (b, bx, by) {
    let mat = null;
    if (bx >= 0 && by >= 0 && bx < this.W && by < this.H && this.near(b.x, b.y, 13)) {
      const i = by * this.W + bx, p = this.pr[i];
      if (this.wl[i]) mat = 'hard';
      else if (this.doorGrid[i] && E.doorClosed(this.doors.get(i))) mat = 'wood';
      else if (p === 1) mat = (b.d || 0) > 1.35 ? (this.prKind && this.prKind.get(i) === 'shield' ? 'metal' : 'wood') : null;
      else if (p === 2) mat = 'metal';
    }
    const stop = bulletOld.call(this, b, bx, by);
    if (stop && mat && rnd() < 0.7) sfx.impact(mat, this.camPan(b.x), this.camVol(b.x, b.y) * 0.8);
    return stop;
  };
  /* ----- granadas que rebotan ----- */
  const gStepOld = G.gStep;
  G.gStep = function (p, dt) {
    const vx = p.vx, vy = p.vy;
    const r = gStepOld.call(this, p, dt);
    if (((vx > 0) !== (p.vx > 0) || (vy > 0) !== (p.vy > 0)) && Math.hypot(vx, vy) > 1.4 && p.type && this.near(p.x, p.y, 13)) sfx.bounce(this.camPan(p.x), this.camVol(p.x, p.y));
    return r;
  };
  /* ----- puertas ----- */
  const doorOld = G.toggleDoor;
  G.toggleDoor = function (idx, open, by) {
    const ok = doorOld.call(this, idx, open, by);
    if (ok) { const d = this.doors.get(idx); if (d && this.near(d.tx, d.ty, 13)) sfx.door(open, this.camPan(d.tx + 0.5), this.camVol(d.tx, d.ty) * (by && by.sneak ? 0.5 : 1)); }
    return ok;
  };
  /* ----- eco según el lugar donde está la cámara: pasillos y cuartos chicos retumban más que un patio ----- */
  const w2Old = G.stepWorld2;
  G.stepWorld2 = function (dt) {
    w2Old.call(this, dt);
    if (this.cfg.noRec || !App.Bank || (this.roomT = (this.roomT || 0) - dt) > 0) return;
    this.roomT = 0.5;
    const cx = Math.floor(this.camX), cy = Math.floor(this.camY), W = this.W, H = this.H;
    let walls = 0, n = 0;
    for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) { n++; if (x < 0 || y < 0 || x >= W || y >= H || this.wl[y * W + x]) walls++; }
    const enc = walls / n, metal = this.floorAt(this.camX, this.camY) === 2 ? 0.06 : 0;
    App.Bank.setRoom(0.05 + enc * 0.55 + metal + (this.weather === 'fog' ? 0.04 : 0));
  };

  /* ----- dolor y muerte ----- */
  const damageOld = G.damage;
  G.damage = function (s, by, dmg, zone) {
    const hp0 = s.hp, alive0 = s.alive;
    damageOld.call(this, s, by, dmg, zone);
    if (alive0 && s.alive && s.hp < hp0 - 6 && this.time > (s.painT || 0) && this.near(s.x, s.y, 14)) {
      s.painT = this.time + 1.2 + rnd();
      if (rnd() < 0.7) sfx.pain(voiceOf(s), this.camPan(s.x), this.camVol(s.x, s.y));
    }
  };
  const killOld = G.kill;
  G.kill = function (s, by, zone) {
    const loud = this.near(s.x, s.y, 20);
    const boom = sfx.boom; if (loud) sfx.boom = () => {};                   // la "explosión" de antes al morir se cambia por la voz y la caída
    try { killOld.call(this, s, by, zone); } finally { sfx.boom = boom; }
    if (loud) {
      const pan = this.camPan(s.x), v = this.camVol(s.x, s.y);
      sfx.death(voiceOf(s), pan, v); sfx.land(pan, v * 0.9);
      if (this.camDist(s) < 10) vibrate(30);
    }
  };
  /* ----- objetos ----- */
  const pickOld = G.applyPickup;
  G.applyPickup = function (s, it) {
    const p = sfx.pickup; let kind = it.kind;
    sfx.pickup = () => { if (this.near(s.x, s.y, 12)) p(kind === 'weapon' ? 'gun' : kind); };
    try { return pickOld.call(this, s, it); } finally { sfx.pickup = p; }
  };
  /* ----- escuadras: radio, levantadas y saltos ----- */
  const callOld = G.callout;
  G.callout = function (s, kind) {
    const before = s.callCd;
    callOld.call(this, s, kind);
    if (s.callCd !== before && this.near(s.x, s.y, 14)) sfx.radio();
  };
  const revOld = G.finishRevive;
  G.finishRevive = function (s, id) {
    const m = this.soldiers[id], was = m && m.downed;
    revOld.call(this, s, id);
    if (was && m && !m.downed && this.near(m.x, m.y, 14)) sfx.revive(this.camPan(m.x), this.camVol(m.x, m.y));
  };
  const vaultOld = G.stepVault;
  G.stepVault = function (s, dt) {
    const had = !!s.vault;
    const r = vaultOld.call(this, s, dt);
    if (had && !s.vault && this.near(s.x, s.y, 12)) sfx.land(this.camPan(s.x), this.camVol(s.x, s.y) * 0.8);
    return r;
  };
})();

/* ================= efectos visuales y cámara de cine (0.9.6) ================= */
(() => {
  const E = App.battle, G = E.Game.prototype, TAU = Math.PI * 2;
  const { el } = App;
  const rnd = Math.random;
  const calm = () => document.body.classList.contains('calm');            // "menos movimiento" en accesibilidad

  // nubecitas de humo ya dibujadas (se pintan una vez y se reusan: es mucho más liviano)
  let PUFF = null;
  function puff() {
    if (PUFF) return PUFF;
    const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d');
    for (let k = 0; k < 14; k++) {
      const px = 48 + (rnd() - 0.5) * 34, py = 48 + (rnd() - 0.5) * 34, r = 14 + rnd() * 20;
      const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(235,237,242,.32)'); g.addColorStop(1, 'rgba(200,204,212,0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, TAU); x.fill();
    }
    return (PUFF = c);
  }

  /* ----- humo de verdad, onda expansiva y luz de los disparos ----- */
  const smokeOld = G.drawSmoke;
  G.drawSmoke = function (x, ts) {
    const real = this.quality !== 'ahorro';
    if (real) {                                                              // granadas de humo con nubes que giran y se mueven con el tiempo
      const P = puff();
      for (const s of this.smokes) {
        if (s.type !== 'smoke') continue;
        const fade = s.t > s.life - 3 ? Math.max(0, (s.life - s.t) / 3) : Math.min(1, s.t * 2);
        for (let k = 0; k < 11; k++) {
          const a = k * 2.399 + s.t * (k % 2 ? 0.12 : -0.09), d = s.r * (0.15 + (k % 4) * 0.2), rr = s.r * ts * (0.75 + (k % 3) * 0.25);
          const cx = (s.x + Math.cos(a) * d + Math.sin(s.t * 0.3 + k) * 0.15) * ts, cy = (s.y + Math.sin(a) * d) * ts;
          x.globalAlpha = 0.85 * fade; x.save(); x.translate(cx, cy); x.rotate(a + s.t * 0.1); x.drawImage(P, -rr, -rr, rr * 2, rr * 2); x.restore();
        }
      }
      x.globalAlpha = 1;
      const keep = this.smokes; this.smokes = keep.filter((q) => q.type !== 'smoke');
      try { smokeOld.call(this, x, ts); } finally { this.smokes = keep; }
    } else smokeOld.call(this, x, ts);
    // ondas expansivas de las explosiones
    if (this.waves) for (const w of this.waves) {
      const k = w.t / 0.55; if (k >= 1) continue;
      const r = w.R * ts * (0.3 + k * 1.5);
      x.strokeStyle = `rgba(255,236,200,${0.55 * (1 - k)})`; x.lineWidth = Math.max(2, ts * 0.35 * (1 - k));
      x.beginPath(); x.arc(w.x * ts, w.y * ts, r, 0, TAU); x.stroke();
      x.strokeStyle = `rgba(255,255,255,${0.25 * (1 - k)})`; x.lineWidth = Math.max(1, ts * 0.1);
      x.beginPath(); x.arc(w.x * ts, w.y * ts, r * 0.82, 0, TAU); x.stroke();
    }
    // los disparos iluminan alrededor (también de día, más suave)
    if (real) {
      x.globalCompositeOperation = 'lighter';
      for (const s of this.soldiers) {
        if (!s.alive || this.time - (s.lastShot || -9) > 0.06) continue;
        const w = this.weaponOf(s); if (!w || w.sup || w.type === 'crossbow') continue;
        const cx = (s.x + Math.cos(s.angle) * 0.9) * ts, cy = (s.y + Math.sin(s.angle) * 0.9) * ts, R = ts * (w.type === 'shotgun' || w.type === 'sniper' || w.type === 'hmg' ? 3 : 2.2);
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, `rgba(255,190,90,${this.darkAll ? 0.45 : 0.22})`); g.addColorStop(1, 'rgba(255,150,40,0)');
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.fill();
      }
      for (const w of this.waves || []) { const k = w.t / 0.3; if (k >= 1) continue; const R = w.R * ts * 2.2, g = x.createRadialGradient(w.x * ts, w.y * ts, 0, w.x * ts, w.y * ts, R); g.addColorStop(0, `rgba(255,200,120,${0.5 * (1 - k)})`); g.addColorStop(1, 'rgba(255,120,40,0)'); x.fillStyle = g; x.beginPath(); x.arc(w.x * ts, w.y * ts, R, 0, TAU); x.fill(); }
      x.globalCompositeOperation = 'source-over';
    }
  };
  const explodeOld = G.explode;
  G.explode = function (x, y, R, dmg, owner, kind) {
    const r = explodeOld.call(this, x, y, R, dmg, owner, kind);
    if (!this.cfg.noRec) {
      (this.waves || (this.waves = [])).push({ x, y, R, t: 0 });
      if (!calm() && this.cfg.camShake !== false) this.shake = Math.max(this.shake || 0, Math.min(1, 0.35 + 6 / (4 + Math.hypot(x - this.camX, y - this.camY))));
    }
    return r;
  };
  const w2 = G.stepWorld2;
  G.stepWorld2 = function (dt) {
    w2.call(this, dt);
    if (this.waves) { for (const w of this.waves) w.t += dt; this.waves = this.waves.filter((w) => w.t < 0.6); }
    if (this.hurtT > 0) this.hurtT -= dt;
  };

  /* ----- golpe de cámara al recibir daño (el soldado que seguís o manejás) ----- */
  const dmgOld = G.damage;
  G.damage = function (s, by, dmg, zone) {
    const hp0 = s.hp;
    dmgOld.call(this, s, by, dmg, zone);
    if (s.hp < hp0 && !this.cfg.noRec && (s.id === this.followId || s.manual)) {
      this.hurtT = 0.45; this.hurtK = Math.min(1, (hp0 - s.hp) / 40 + 0.3);
      if (!calm() && this.cfg.camShake !== false) this.shake = Math.max(this.shake || 0, 0.25 * this.hurtK);
    }
  };

  /* ----- cámara de la muerte: si cae el que seguís, la cámara va al que lo eliminó ----- */
  const killOld = G.kill;
  G.kill = function (s, by, zone) {
    const followed = s.id === this.followId || s.manual;
    killOld.call(this, s, by, zone);
    if (followed && by && by !== s && by.alive && !this.cfg.noRec && this.phase === 'run') {
      this.killcam = { id: by.id, victim: s.name, until: this.time + 3.2 };
      this.focus = by; this.focusUntil = this.time + 3.2;
    }
  };
  const focusOld = G.focusSoldier;
  G.focusSoldier = function () {
    const kc = this.killcam;
    if (kc && this.time < kc.until) { const k = this.soldiers[kc.id]; if (k && k.alive) return k; }
    return focusOld.call(this);
  };

  /* ----- lo que va encima de todo: viñeta roja al recibir daño y cartel de la cámara de la muerte ----- */
  const drawOld = G.draw;
  G.draw = function () {
    drawOld.call(this);
    if (!this.static) return;
    const x = this.ctx, cw = this.cw, ch = this.ch;
    x.save(); x.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.hurtT > 0) {
      const a = Math.min(1, this.hurtT / 0.45) * 0.5 * (this.hurtK || 0.5);
      const g = x.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
      g.addColorStop(0, 'rgba(220,20,20,0)'); g.addColorStop(1, `rgba(220,20,20,${a})`);
      x.fillStyle = g; x.fillRect(0, 0, cw, ch);
    }
    const kc = this.killcam;
    if (kc && this.time < kc.until) {
      const k = this.soldiers[kc.id];
      if (k && k.alive) {
        const t = kc.until - this.time, al = Math.min(1, t, 3.2 - t + 0.2);
        x.globalAlpha = al;
        const bh = Math.round(30 * App.textK()), by = ch - bh - (this.padOn ? 150 : 0);
        x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, 0, cw, 14); x.fillRect(0, by, cw, bh);   // franjas de cine
        x.fillStyle = '#fff'; x.font = `700 ${Math.round(13 * App.textK())}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(`🎥 Cámara de ${k.name}, que eliminó a ${kc.victim}`, cw / 2, by + bh / 2);
        x.globalAlpha = 1;
      }
    }
    x.restore();
  };

  /* ----- presentación de los soldados al empezar (cartas durante la cuenta regresiva) ----- */
  App.FX = {
    introCards(game, wrap) {
      if (!game || !wrap || game.cfg.noRec || game.soldiers.length > 12) return;
      const old = wrap.querySelector('.intro-cards'); if (old) old.remove();
      const { PERS, IQ } = Personas, ROLES = App.Modes ? App.Modes.ROLES : {};
      const box = el('div', { class: 'intro-cards' + (calm() ? ' calm' : ''), onclick: () => box.remove() });
      const list = game.soldiers.filter((s) => !s.bot);
      const team = list.some((s) => s.team >= 0);
      list.sort((a, b) => (a.team - b.team));
      list.forEach((s, i) => {
        const P = PERS[s.pers] || {}, Q = IQ[s.iq] || {}, R = ROLES[s.role];
        const card = el('div', { class: 'icard', style: `--c:${s.color};animation-delay:${(i * 0.09).toFixed(2)}s` },
          s.photo ? el('img', { class: 'ava', src: s.photo, alt: '' }) : el('div', { class: 'ava dot', style: `background:${s.color}` }, (s.name || '?').slice(0, 1).toUpperCase()),
          el('div', { class: 'nm' }, s.name),
          el('div', { class: 'tg' }, `${P.emoji || ''} ${P.label || ''}`),
          el('div', { class: 'tg' }, `${Q.emoji || ''} ${Q.label || ''}${R && s.role !== 'none' ? ' · ' + R.emoji + ' ' + R.label : ''}`));
        box.append(card);
        if (team && list[i + 1] && list[i + 1].team !== s.team) box.append(el('div', { class: 'vs' }, 'VS'));
      });
      wrap.append(box);
      const t0 = performance.now();
      const tick = () => { if (!box.isConnected) return; if (game.dead || game.phase !== 'countdown' || performance.now() - t0 > 6000) { box.classList.add('out'); setTimeout(() => box.remove(), 400); return; } requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    },
  };
})();
