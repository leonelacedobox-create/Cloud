/* Afinado final (0.9.7): cajones que se empujan (el que manejás los empuja caminando contra ellos; la IA los
   usa como cobertura móvil cuando no tiene dónde cubrirse). Se carga después de fx.js. */
'use strict';

(() => {
  const E = App.battle, G = E.Game.prototype;
  const { doorClosed } = E;
  const { sfx } = App;

  /** ¿Se puede empujar el cajón i hacia (dx, dy)? Solo cajones comunes (no escudos ni mesas) y con lugar libre atrás. */
  G.canPush = function (i, dx, dy) {
    if (this.pr[i] !== 1 || (this.prKind && this.prKind.get(i))) return -1;
    const W = this.W, x = (i % W) + dx, y = ((i / W) | 0) + dy;
    if (x < 1 || y < 1 || x >= W - 1 || y >= this.H - 1) return -1;
    const j = y * W + x;
    if (this.g[j] || this.doorGrid[j] || this.pr[j] || (this.tables && this.tables.has(j))) return -1;
    if (this.soldiers.some((o) => o.alive && Math.floor(o.x) === x && Math.floor(o.y) === y)) return -1;
    return j;
  };
  /** Mueve el cajón un casillero (con un deslizamiento que se ve y un ruido de arrastre). */
  G.pushCrate = function (i, dx, dy, by) {
    const j = this.canPush(i, dx, dy); if (j < 0) return false;
    this.pr[j] = 1; this.g[j] = 1; this.prHp[j] = this.prHp[i];
    this.pr[i] = 0; this.g[i] = 0; this.prHp[i] = 0;
    (this.slides || (this.slides = new Map())).set(j, { dx, dy, t: 0 });
    const W = this.W, x = (j % W) + 0.5, y = ((j / W) | 0) + 0.5;
    this.emitSound(x, y, 6, 'door', by && by.alive ? by : null);
    if (this.near && this.near(x, y, 13)) App.audio.noise(0.35, { vol: 0.07 * this.camVol(x, y), freq: 260, q: 0.9, sweepTo: 180, pan: this.camPan(x) });
    this.tacDirty = true;                                                      // el mapa táctico se rehace en un rato
    if (by && by.stats) by.stats.pushes = (by.stats.pushes || 0) + 1;
    return true;
  };

  /* ----- el que manejás: caminando contra un cajón un ratito, lo empuja ----- */
  const moveOld = G.tryMove;
  G.tryMove = function (s, dx, dy) {
    const moved = moveOld.call(this, s, dx, dy);
    if (!s.manual || (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4)) return moved;
    const hor = Math.abs(dx) >= Math.abs(dy), sx = hor ? Math.sign(dx) : 0, sy = hor ? 0 : Math.sign(dy);
    const tx = Math.floor(s.x + sx * (s.r + 0.12)), ty = Math.floor(s.y + sy * (s.r + 0.12)), i = ty * this.W + tx;
    if (this.pr[i] === 1 && this.canPush(i, sx, sy) >= 0) {
      s.pushT = (s.pushT || 0) + 1 / 60;
      if (s.pushT > 0.22) { s.pushT = 0; this.pushCrate(i, sx, sy, s); }
    } else s.pushT = 0;
    return moved;
  };

  /* ----- la IA: sin cobertura cerca, empuja un cajón pegado hacia el rival y queda atrás ----- */
  const coverOld = G.beginCover;
  G.beginCover = function (s, e) {
    if (coverOld.call(this, s, e)) return true;
    if (s.act || s.manual) return false;
    const W = this.W, cx = Math.floor(s.x), cy = Math.floor(s.y);
    const ex = e.x - s.x, ey = e.y - s.y, hor = Math.abs(ex) >= Math.abs(ey), dx = hor ? Math.sign(ex) : 0, dy = hor ? 0 : Math.sign(ey);
    const i = (cy + dy) * W + (cx + dx);
    if (this.pr[i] === 1 && this.canPush(i, dx, dy) >= 0 && Math.hypot(ex, ey) > 4) {
      s.act = { type: 'hold', t: 0, dur: 0.45, face: Math.atan2(ey, ex), pushCrate: { i, dx, dy } };
      s.mode = 'hold'; s.path = [];
      return true;
    }
    return false;
  };
  /** Termina de empujar: el cajón avanza y el soldado ocupa el lugar que dejó (queda cubierto atrás). */
  G.finishPush = function (s, pc) {
    if (!this.pushCrate(pc.i, pc.dx, pc.dy, s)) return;
    const W = this.W, x = (pc.i % W) + 0.5, y = ((pc.i / W) | 0) + 0.5;
    s.path = [Math.floor(s.y) * W + Math.floor(s.x), pc.i];
    s.cover = null; s.coverCd = this.time + 2;
    s.pushTo = { x, y };
  };

  /* ----- el paso de cada cuadro: animación de los cajones y mapa táctico al día ----- */
  const w2 = G.stepWorld2;
  G.stepWorld2 = function (dt) {
    w2.call(this, dt);
    if (this.slides && this.slides.size) for (const [j, sl] of this.slides) { sl.t += dt; if (sl.t > 0.25) this.slides.delete(j); }
    if (this.tacDirty && (this.tacT = (this.tacT || 0) - dt) <= 0) {
      this.tacDirty = false; this.tacT = 1;
      if (this.tac) { this.lineLen = null; this.buildTactics(); }
      if (this.mini && this.buildMini) this.buildMini();
    }
  };
})();

/* ================= rendimiento (0.9.7) ================= */
(() => {
  const E = App.battle, G = E.Game.prototype;
  const { angDiff } = E;
  const TAU = Math.PI * 2;

  /** Oscuridad más liviana: en calidad media/ahorro la capa de sombra se dibuja a media resolución (casi no se nota,
   *  los bordes quedan apenas más suaves) y el cono de cada linterna se recalcula solo si el soldado se movió. */
  G._drawDarknessOld = G.drawDarkness;                                       // (para comparar en las pruebas)
  G.drawDarkness = function (x, left, top) {
    const ts = this.ts, cw = this.cw, ch = this.ch, W = this.W, H = this.H;
    const sc = this.quality === 'alta' ? this.dpr : Math.max(0.5, this.dpr * 0.5);
    const dw = Math.ceil(cw * sc), dh = Math.ceil(ch * sc);
    if (!this.dk || this.dk.width !== dw || this.dk.height !== dh) { this.dk = document.createElement('canvas'); this.dk.width = dw; this.dk.height = dh; this.dkCtx = this.dk.getContext('2d'); }
    const f = this.dkCtx;
    f.setTransform(sc, 0, 0, sc, 0, 0); f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, cw, ch);
    f.fillStyle = 'rgba(2,4,14,0.8)';
    if (this.darkAll) f.fillRect(0, 0, cw, ch);
    else {
      const x0 = Math.max(0, Math.floor(left)), y0 = Math.max(0, Math.floor(top)), x1 = Math.min(W - 1, Math.ceil(left + cw / ts)), y1 = Math.min(H - 1, Math.ceil(top + ch / ts));
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.dark[ty * W + tx]) f.fillRect((tx - left) * ts, (ty - top) * ts, ts + 0.6, ts + 0.6);
    }
    f.globalCompositeOperation = 'destination-out';
    const right = left + cw / ts, bottom = top + ch / ts;
    for (const s of this.soldiers) {
      if (!s.alive || !s.flashlight) continue;
      if (s.x < left - 10 || s.x > right + 10 || s.y < top - 10 || s.y > bottom + 10) continue;     // lejos de la pantalla: no hace falta
      let c = s._cone;
      if (!c || Math.hypot(s.x - c.x, s.y - c.y) > 0.08 || Math.abs(angDiff(s.look, c.look)) > 0.04 || this.time - c.t > 0.4) {
        const pts = [], N = this.quality === 'alta' ? 36 : 22;
        for (let i = 0; i <= N; i++) {
          const a = s.look - 0.55 + (i / N) * 1.1;
          let d = 0.4; while (d < 9 && !this.isOpaque(Math.floor(s.x + Math.cos(a) * d), Math.floor(s.y + Math.sin(a) * d))) d += 0.25;
          pts.push(Math.cos(a) * Math.min(d, 9), Math.sin(a) * Math.min(d, 9));
        }
        c = s._cone = { x: s.x, y: s.y, look: s.look, t: this.time, pts };
      }
      const cx = (s.x - left) * ts, cy = (s.y - top) * ts;
      const g = f.createRadialGradient(cx, cy, 0, cx, cy, 9 * ts);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.7, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = g; f.beginPath(); f.moveTo(cx, cy);
      for (let k = 0; k < c.pts.length; k += 2) f.lineTo(cx + c.pts[k] * ts, cy + c.pts[k + 1] * ts);
      f.closePath(); f.fill();
      f.fillStyle = 'rgba(0,0,0,0.9)'; f.beginPath(); f.arc(cx, cy, 1.5 * ts, 0, TAU); f.fill();      // halo alrededor de quien la lleva
    }
    if (this.lightHoles) this.lightHoles(f, left, top);
    for (const sm of this.smokes) if (sm.type === 'flare') { const cx = (sm.x - left) * ts, cy = (sm.y - top) * ts; f.fillStyle = 'rgba(0,0,0,0.6)'; f.beginPath(); f.arc(cx, cy, 3 * ts, 0, TAU); f.fill(); }
    f.globalCompositeOperation = 'source-over';
    x.drawImage(this.dk, 0, 0, cw, ch);
  };

  /** En celulares lentos (calidad media o ahorro) cada soldado mira a su alrededor 30 veces por segundo en vez de 60:
   *  no cambia cómo juegan y ahorra mucho. El que manejás vos sigue mirando siempre. */
  const senseOld = G.sense;
  G.sense = function (s) {
    if ((this.quality === 'ahorro' || this.quality === 'media') && !s.manual && s.target !== undefined && ((this.senseN = (this.senseN || 0) + 1) + s.id) % 2) return;
    return senseOld.call(this, s);
  };
})();

