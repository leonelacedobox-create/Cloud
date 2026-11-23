/* Cuerpos de verdad (0.9.2): esqueleto 2D visto desde arriba, animaciones por acción y por arma,
   reacciones al daño y muertes con física (muñeco de trapo liviano).
   Reemplaza Art.drawSoldier y Art.drawCorpse. Las armas y las cabezas se dibujan una vez y se copian (caché). */
'use strict';

(() => {
  const { rnd } = App;
  const { ell, shade, gun, head } = Art._;
  const GUNS = Art.GUNS;
  const E = App.battle;
  const { angDiff, clamp } = E;
  const G = E.Game.prototype;
  const PI = Math.PI, TAU = PI * 2;
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (k) => k * k * (3 - 2 * k);
  const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);      // avance de p dentro del tramo [a, b]
  /** Escala real del lienzo (aunque esté girado), redondeada para no llenar la caché. */
  const scaleOf = (x) => { const m = x.getTransform(); return Math.max(0.5, Math.min(2, Math.round(Math.hypot(m.a, m.b) * 2) / 2)); };

  /* ================= estado de animación de cada soldado ================= */
  const DEF = { speed: 0, crouch: 0, lean: 0, hitT: 0, hitAng: 0, hitK: 0, swing: 'stab', swingT: 0, pickT: 0, pack: 0, sup: false, vault: 0 };
  function st(s) {
    return s.anim || (s.anim = { speed: 0, lx: s.x, ly: s.y, crouch: 0, lean: 0, hitT: 0, hitAng: 0, hitK: 0, swing: 'stab', swingT: 0, swingN: 0, lastMelee: 0, pickT: 0, turn: 0, prevAng: s.angle, pack: 0, sup: false, blood: 0, lastStep: s.lastStep, vault: 0 });
  }
  /** Se llama en cada paso de la simulación (solo cuando se dibuja: en el banco de pruebas no). */
  G.rigUpdate = function (s, dt) {
    const A = st(s);
    if (dt <= 0) return;
    const v = Math.hypot(s.x - A.lx, s.y - A.ly) / dt; A.lx = s.x; A.ly = s.y;
    A.speed += (Math.min(v, 6) - A.speed) * Math.min(1, dt * 8);
    const c = s.cover;
    const crouchT = A.pickT > 0 ? 1 : c && c.phase === 'hide' ? 1 : s.act && s.act.type === 'heal' ? 0.75 : s.sneak ? 0.7 : 0;
    A.crouch += (crouchT - A.crouch) * Math.min(1, dt * 8);
    let leanT = 0;                                                         // asomarse: el cuerpo se inclina hacia la esquina
    if (c && c.phase === 'peek' && c.peek >= 0) {
      const W = this.W, hx = (c.hide % W) + 0.5, hy = ((c.hide / W) | 0) + 0.5, px = (c.peek % W) + 0.5, py = ((c.peek / W) | 0) + 0.5;
      const cr = Math.cos(s.angle) * (py - hy) - Math.sin(s.angle) * (px - hx);
      leanT = Math.abs(cr) > 0.05 ? Math.sign(cr) : 0;
    }
    A.lean += (leanT - A.lean) * Math.min(1, dt * 7);
    const turn = angDiff(A.prevAng, s.angle) / dt; A.prevAng = s.angle;
    A.turn += (turn - A.turn) * Math.min(1, dt * 6); A.pack = clamp(-A.turn * 0.05, -0.45, 0.45);
    A.hitT = Math.max(0, A.hitT - dt); A.pickT = Math.max(0, A.pickT - dt); A.swingT = Math.max(0, A.swingT - dt);
    if (s.meleeT > A.lastMelee + 0.05) {                                    // empezó un golpe de cuchillo: ¿cuál?
      const t = s.target, behind = t && Math.abs(angDiff(t.look, Math.atan2(s.y - t.y, s.x - t.x))) > 2.1;
      A.swing = behind ? 'back' : (A.swingN++ % 2 ? 'slash' : 'stab'); A.swingT = 0.3;
    }
    A.lastMelee = s.meleeT;
    const w = this.weaponOf(s); A.sup = !!(w && (w.sup || w.type === 'crossbow'));
    A.vault = s.vault ? Math.min(1, s.vault.t / s.vault.dur) : 0;
    // pisadas: después de pisar un charco deja marcas rojas unos pasos
    if (s.lastStep !== A.lastStep) {
      A.lastStep = s.lastStep;
      if (!A.blood) for (const k of this.corpses) if (k.t0 != null && this.time - k.t0 > 0.8 && Math.hypot(k.x - s.x, k.y - s.y) < 0.8) { A.blood = 6; break; }
      if (A.blood > 0) { A.blood--; const side = A.blood % 2 ? 1 : -1, pa = s.moveAng + PI / 2; this.addDecal('foot', s.x + Math.cos(pa) * 0.12 * side, s.y + Math.sin(pa) * 0.12 * side, s.moveAng, A.blood / 6); }
    }
  };
  /** Golpe recibido: dirección y fuerza (para el sacudón y para cómo cae si muere). */
  G.rigHit = function (s, by, dmg, zone) {
    let ang = rnd() * TAU, kind = zone ? 'zone' : 'hit';
    if (by && by !== s) { ang = Math.atan2(s.y - by.y, s.x - by.x); kind = by.cur === 'knife' ? 'knife' : by.wtype; }
    else if (s._boom && this.time - s._boom.t < 0.1) { ang = Math.atan2(s.y - s._boom.y, s.x - s._boom.x); kind = 'boom'; }
    const k = clamp(dmg / 35, 0.3, 1.5) * (kind === 'boom' ? 1.6 : kind === 'shotgun' || kind === 'ashotgun' ? 1.3 : 1);
    s._lastHit = { ang, k, kind };
    if (this.cfg.noRec) return;
    const A = st(s); A.hitT = 0.28; A.hitAng = ang; A.hitK = k;
    if (!zone && this.quality !== 'ahorro') this.addDecal('splat', s.x + Math.cos(ang) * 0.35, s.y + Math.sin(ang) * 0.35, ang, Math.min(1, k));
  };

  /* ================= marcas en el piso y las paredes ================= */
  G.addDecal = function (kind, x, y, ang = 0, k = 1) {
    if (this.cfg.noRec) return;
    const d = this.decals || (this.decals = []);
    d.push({ kind, x, y, ang, k, t0: this.time });
    if (d.length > 260) d.splice(0, d.length - 260);
  };
  G.drawDecals = function (x, ts, left, top, right, bottom) {
    if (!this.decals) return;
    for (const d of this.decals) {
      if (d.x < left - 1 || d.x > right + 1 || d.y < top - 1 || d.y > bottom + 1) continue;
      const age = this.time - d.t0, px = d.x * ts, py = d.y * ts;
      if (d.kind === 'hole') {
        x.fillStyle = 'rgba(15,15,20,.85)'; x.beginPath(); x.arc(px, py, Math.max(1.2, ts * 0.045), 0, TAU); x.fill();
        x.strokeStyle = 'rgba(200,200,210,.35)'; x.lineWidth = 1; x.stroke();
      } else if (d.kind === 'foot') {
        const a = Math.max(0, 0.55 * d.k * (1 - age / 40)); if (a <= 0) continue;
        x.save(); x.translate(px, py); x.rotate(d.ang); x.fillStyle = `rgba(120,12,20,${a})`; ell(x, 0, 0, ts * 0.11, ts * 0.06); x.fill(); x.restore();
      } else if (d.kind === 'mud') {
        const a = Math.max(0, 0.4 * (1 - age / 30)); if (a <= 0) continue;
        x.save(); x.translate(px, py); x.rotate(d.ang); x.fillStyle = `rgba(92,64,38,${a})`; ell(x, 0, 0, ts * 0.1, ts * 0.055); x.fill(); x.restore();
      } else if (d.kind === 'splat') {
        const a = Math.max(0, 0.5 * (1 - age / 60)); if (a <= 0) continue;
        x.save(); x.translate(px, py); x.rotate(d.ang); x.fillStyle = `rgba(130,10,20,${a})`;
        ell(x, 0, 0, ts * 0.16 * d.k + 1, ts * 0.08 * d.k + 1); x.fill();
        x.beginPath(); x.arc(ts * 0.22 * d.k, ts * 0.05, ts * 0.04, 0, TAU); x.arc(ts * 0.3 * d.k, -ts * 0.06, ts * 0.03, 0, TAU); x.fill();
        x.restore();
      }
    }
  };

  /* ================= cachés (armas y cabezas) ================= */
  function gunSprite(type, u, k) {
    const key = type + '|' + Math.round(u * 10) + '|' + k;
    let c = gunSprite.cache.get(key);
    if (c) return c;
    const len = (GUNS[type] || GUNS.pistol).len, ox = 0.9 * u, oy = 0.8 * u, w = (len + 1.7) * u, h = 1.6 * u;
    const cv = document.createElement('canvas'); cv.width = Math.ceil(w * k); cv.height = Math.ceil(h * k);
    const g = cv.getContext('2d'); g.scale(k, k); g.translate(ox, oy); gun(g, type, u, null);
    c = { cv, ox, oy, w, h }; gunSprite.cache.set(key, c);
    if (gunSprite.cache.size > 200) gunSprite.cache.delete(gunSprite.cache.keys().next().value);
    return c;
  }
  gunSprite.cache = new Map();
  function drawGun(x, type, u) {
    const k = scaleOf(x), c = gunSprite(type, u, k);
    x.drawImage(c.cv, -c.ox, -c.oy, c.w, c.h);
  }
  function headSprite(ap, u, k, helm) {
    const key = Math.round(u * 10) + '|' + k + '|' + (helm ? 1 : 0) + '|' + (ap.hat || '');
    if (ap._hc && ap._hc.key === key) return ap._hc;
    const R = 1.25 * u, cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil(R * 2 * k);
    const g = cv.getContext('2d'); g.scale(k, k); g.translate(R, R);
    head(g, ap, u);
    if (helm) {
      g.fillStyle = 'rgba(88,98,118,.92)'; g.beginPath(); g.arc(-0.03 * u, 0, 0.68 * u, 0, TAU); g.fill(); g.strokeStyle = 'rgba(10,14,24,.7)'; g.lineWidth = Math.max(1, u * 0.07); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.3)'; ell(g, -0.1 * u, -0.2 * u, 0.22 * u, 0.14 * u); g.fill();
    }
    return (ap._hc = { key, cv, R });
  }

  /* ================= brazos con cinemática inversa ================= */
  function ik(sx, sy, hx, hy, a, b, bend) {
    let dx = hx - sx, dy = hy - sy, d = Math.hypot(dx, dy) || 0.001;
    const max = a + b - 0.01;
    if (d > max) { hx = sx + dx / d * max; hy = sy + dy / d * max; dx = hx - sx; dy = hy - sy; d = max; }
    const ca = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), an = Math.atan2(dy, dx) + bend * Math.acos(ca);
    return [sx + Math.cos(an) * a, sy + Math.sin(an) * a, hx, hy];
  }
  function arm(x, s, u, sx, sy, hx, hy, bend) {
    const [ex, ey, fx, fy] = ik(sx, sy, hx, hy, 0.82 * u, 0.84 * u, bend);
    x.strokeStyle = shade(s.color, -0.14); x.lineWidth = 0.5 * u; x.beginPath(); x.moveTo(sx, sy); x.lineTo(ex, ey); x.stroke();
    x.strokeStyle = shade(s.color, -0.04); x.lineWidth = 0.44 * u; x.beginPath(); x.moveTo(ex, ey); x.lineTo(fx, fy); x.stroke();
    x.fillStyle = s.ap.skin; x.beginPath(); x.arc(fx, fy, 0.24 * u, 0, TAU); x.fill();
    return [fx, fy];
  }

  /* ================= poses: dónde va el arma y dónde cada mano ================= */
  const RELOAD_KIND = { pistol: 'mag', smg: 'mag', rifle: 'mag', lmg: 'mag', hmg: 'mag', sniper: 'bolt', shotgun: 'shell', ashotgun: 'shell', revolver: 'revolver', crossbow: 'crossbow' };
  function pose(s, A, u, time) {
    const wt = s.wtype || 'pistol', Gd = GUNS[wt] || GUNS.pistol, act = s.act;
    const rec = (s.recoil || 0) * (wt === 'sniper' ? 0.5 : 0.3) * u;
    const P = { gx: 0.55 * u - rec, gy: 0.05 * u, rot: 0, gun: wt !== 'knife', R: null, L: null, item: null, knife: null };
    const gp = (lx, ly) => [P.gx + lx * Math.cos(P.rot) - ly * Math.sin(P.rot), P.gy + lx * Math.sin(P.rot) + ly * Math.cos(P.rot)];
    const handsOnGun = () => { P.R = gp(0.07 * u, 0.25 * u); P.L = gp((Gd.fore - 0.35) * u, wt === 'pistol' ? -0.1 * u : -0.15 * u); };
    const belt = [-0.15 * u, -0.8 * u];
    // correr sin enemigo a la vista: arma baja y cruzada
    if (A.speed > 2.7 && !s.target && !(s.reloadT > 0) && wt !== 'knife') { P.gx = 0.35 * u; P.gy = 0.35 * u; P.rot = 0.55; }
    if (act && (act.type === 'open' || act.type === 'close')) {               // abre la puerta con la mano, el arma en la otra
      const e = Math.sin(Math.min(1, act.t / act.dur) * PI);
      P.gx = 0.15 * u - rec; P.gy = 0.1 * u; P.rot = 0.15; P.L = gp(0.1 * u, -0.1 * u);
      P.R = [(0.9 + 1.25 * e) * u, (0.9 - 0.85 * e) * u];
      return P;
    }
    if (act && act.type === 'throw') {                                         // granada: por arriba (lejos) o rodando (cerca)
      const e = Math.min(1, act.t / act.dur), over = (act.speed || 8) >= 9;
      P.gx = 0.1 * u; P.gy = -0.3 * u; P.rot = -0.35; P.L = gp(0.1 * u, 0.05 * u);
      if (over) P.R = e < 0.45 ? [lerp(0.3, -0.7, ease(e / 0.45)) * u, lerp(0.9, 1.05, e / 0.45) * u] : [lerp(-0.7, 1.7, ease((e - 0.45) / 0.55)) * u, lerp(1.05, 0.35, (e - 0.45) / 0.55) * u];
      else P.R = e < 0.4 ? [lerp(0.4, -0.35, e / 0.4) * u, 1.1 * u] : [lerp(-0.35, 1.4, ease((e - 0.4) / 0.6)) * u, lerp(1.1, 0.75, (e - 0.4) / 0.6) * u];
      if (!act.released && e < 0.62) P.item = { kind: 'gren', x: P.R[0] + 0.15 * u, y: P.R[1], g: act.gtype };
      return P;
    }
    if (act && act.type === 'heal') {                                          // botiquín con las dos manos
      P.gx = 0.0; P.gy = 0.75 * u; P.rot = 1.45; P.gun = wt !== 'knife';
      const b = Math.sin(time * 9) * 0.06 * u;
      P.R = [0.62 * u + b, 0.2 * u]; P.L = [0.62 * u - b, -0.2 * u]; P.item = { kind: 'med', x: 0.8 * u, y: 0 };
      return P;
    }
    if (s.stunT > 0) {                                                         // aturdido: se tapa la cara
      P.gx = 0.25 * u; P.gy = 0.65 * u; P.rot = 1.2;
      const w = Math.sin(time * 7) * 0.1 * u;
      P.R = [0.7 * u + w, 0.3 * u]; P.L = [0.7 * u - w, -0.3 * u];
      return P;
    }
    if (A.pickT > 0) {                                                         // se agacha a juntar algo
      const e = Math.sin((1 - A.pickT / 0.35) * PI);
      P.gx = 0.15 * u; P.gy = -0.25 * u; P.rot = -0.25; P.L = gp(0.1 * u, 0.05 * u);
      P.R = [lerp(0.6, 1.4, e) * u, lerp(0.6, 0.55, e) * u];
      return P;
    }
    if (wt === 'knife') {                                                      // cuchillo: estocada, corte o puñalada por la espalda
      P.gun = false;
      const p = A.swingT > 0 ? 1 - A.swingT / 0.3 : -1;
      let hx = 0.95 * u, hy = 0.35 * u, ka = -0.05;
      if (p >= 0) {
        const f = Math.sin(p * PI);
        if (A.swing === 'stab') { hx = lerp(0.8, 2.0, f) * u; hy = lerp(0.4, 0.12, f) * u; ka = -0.05; }
        else if (A.swing === 'slash') { const an = lerp(1.25, -1.15, ease(p)); hx = 0.1 * u + Math.cos(an) * 1.55 * u; hy = 0.55 * u + Math.sin(an) * 1.35 * u; ka = an - PI / 2 + 0.4; }
        else { const an = lerp(2.2, -0.2, ease(p)); hx = 0.2 * u + Math.cos(an) * 1.6 * u; hy = 0.3 * u + Math.sin(an) * 1.2 * u; ka = an - PI / 2; }
      }
      P.R = [hx, hy]; P.L = [0.55 * u, -0.8 * u]; P.knife = { x: hx, y: hy, a: ka, p, swing: A.swing };
      return P;
    }
    if (s.swapT > 0) {                                                         // cambio de arma: la nueva sube desde la funda
      const k = ease(clamp(1 - s.swapT / 0.45, 0, 1));
      P.gx = lerp(-0.05 * u, P.gx, k); P.gy = lerp(0.75 * u, P.gy, k); P.rot = lerp(1.6, P.rot, k);
      handsOnGun(); return P;
    }
    if (s.reloadT > 0) {                                                       // recargas coreografiadas por arma
      const rp = clamp(1 - s.reloadT / Math.max(0.01, s.reloadTot), 0, 1), kind = RELOAD_KIND[wt] || 'mag';
      P.gx = 0.3 * u; P.gy = 0.4 * u; P.rot = 0.5;
      P.R = gp(0.07 * u, 0.25 * u);
      const well = gp(0.35 * u, 0.2 * u), port = gp(0.45 * u, 0.15 * u), fore = gp((Gd.fore - 0.35) * u, -0.15 * u);
      const path = (pts, t) => { const n = pts.length - 1, i = Math.min(n - 1, Math.floor(t * n)), f = ease(t * n - i); return [lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)]; };
      if (kind === 'mag' || (kind === 'bolt' && rp < 0.6)) {
        const q = kind === 'bolt' ? rp / 0.6 : rp;
        P.L = q < 0.2 ? path([fore, well], q / 0.2) : q < 0.45 ? path([well, belt], seg(q, 0.2, 0.45)) : q < 0.75 ? path([belt, well], seg(q, 0.45, 0.75)) : q < 0.88 ? [well[0], well[1] - Math.sin(seg(q, 0.75, 0.88) * PI) * 0.12 * u] : path([well, gp(0.05 * u, -0.25 * u), fore], seg(q, 0.88, 1));
        if (q > 0.45 && q < 0.8) P.item = { kind: 'mag', x: P.L[0], y: P.L[1] + 0.1 * u, a: P.rot };
        if (wt === 'pistol' && q > 0.9) P.gx -= Math.sin(seg(q, 0.9, 1) * PI) * 0.15 * u;     // tira de la corredera
      } else if (kind === 'bolt') {
        const q = seg(rp, 0.6, 1), bolt = gp(0.2 * u, -0.28 * u);
        P.L = [bolt[0] - Math.sin(q * PI * 2) * 0.35 * u, bolt[1]];
      } else if (kind === 'shell') {                                           // cartucho por cartucho
        P.rot = 0.35; P.R = gp(0.07 * u, 0.25 * u);
        const n = 4, q = rp < 0.88 ? (rp / 0.88) * n : n, i = Math.floor(q), f = q - i;
        if (rp < 0.88) { P.L = path([belt, port, belt], f); if (f < 0.5) P.item = { kind: 'shell', x: P.L[0], y: P.L[1] }; }
        else { const ff = gp((Gd.fore - 0.35) * u, -0.15 * u); P.L = [ff[0] - Math.sin(seg(rp, 0.88, 1) * PI) * 0.4 * u, ff[1]]; }
      } else if (kind === 'revolver') {
        P.gx = 0.45 * u; P.gy = 0.15 * u; P.rot = rp < 0.85 ? 0.95 : lerp(0.95, 0, seg(rp, 0.85, 1));
        const cyl = gp(0.35 * u, 0); P.R = gp(0.07 * u, 0.2 * u);
        P.L = rp < 0.35 ? path([cyl, belt], rp / 0.35) : rp < 0.75 ? path([belt, cyl], seg(rp, 0.35, 0.75)) : cyl;
        if (rp > 0.35 && rp < 0.78) P.item = { kind: 'loader', x: P.L[0], y: P.L[1] };
      } else {                                                                  // ballesta: tensar la cuerda y poner la flecha
        P.gx = 0.45 * u; P.gy = 0.45 * u; P.rot = 1.05;
        const front = gp(Gd.len * 0.85 * u, 0), back = gp(0.35 * u, 0), rail = gp(0.9 * u, -0.1 * u);
        P.L = rp < 0.15 ? path([fore, front], rp / 0.15) : rp < 0.65 ? path([front, back], seg(rp, 0.15, 0.65)) : rp < 0.82 ? path([back, belt], seg(rp, 0.65, 0.82)) : path([belt, rail], seg(rp, 0.82, 1));
        if (rp > 0.82) P.item = { kind: 'bolt', x: P.L[0], y: P.L[1], a: P.rot };
      }
      return P;
    }
    handsOnGun();
    return P;
  }

  /* ================= fogonazos por arma ================= */
  function muzzle(x, wt, mx, my, rot, u, time, sup) {
    x.save(); x.translate(mx, my); x.rotate(rot);
    if (sup) { x.fillStyle = 'rgba(200,200,205,.5)'; x.beginPath(); x.arc(0.3 * u, 0, 0.22 * u, 0, TAU); x.fill(); x.restore(); return; }
    const spin = Math.sin(time * 97) * 0.4;
    const flame = (len, wid, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, -wid * 0.3); x.quadraticCurveTo(len * 0.4, -wid, len, 0); x.quadraticCurveTo(len * 0.4, wid, 0, wid * 0.3); x.closePath(); x.fill(); };
    if (wt === 'shotgun' || wt === 'ashotgun') {
      flame(1.5 * u, 0.75 * u, 'rgba(255,150,40,.85)'); flame(0.9 * u, 0.4 * u, 'rgba(255,240,170,.95)');
      x.fillStyle = '#ffe9a0'; for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.18 + spin * 0.2; x.beginPath(); x.arc(Math.cos(a) * 1.6 * u, Math.sin(a) * 1.6 * u, 0.05 * u, 0, TAU); x.fill(); }
    } else if (wt === 'sniper') {
      flame(1.9 * u, 0.3 * u, 'rgba(255,170,60,.85)'); flame(1.0 * u, 0.16 * u, 'rgba(255,250,210,.95)');
    } else if (wt === 'pistol' || wt === 'revolver') {
      x.fillStyle = 'rgba(255,190,70,.9)'; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * PI / 4 + spin, r = (i % 2 ? 0.18 : 0.5) * u; x.lineTo(0.35 * u + Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill();
      x.fillStyle = '#fff6cf'; x.beginPath(); x.arc(0.35 * u, 0, 0.14 * u, 0, TAU); x.fill();
    } else {                                                                    // automáticas: tres puntas
      flame(1.1 * u, 0.35 * u, 'rgba(255,170,50,.9)');
      x.save(); x.rotate(1.1 + spin * 0.3); flame(0.55 * u, 0.18 * u, 'rgba(255,190,80,.8)'); x.restore();
      x.save(); x.rotate(-1.1 - spin * 0.3); flame(0.55 * u, 0.18 * u, 'rgba(255,190,80,.8)'); x.restore();
      flame(0.6 * u, 0.18 * u, 'rgba(255,250,215,.95)');
    }
    x.restore();
  }
  function heldItem(x, it, u) {
    x.save(); x.translate(it.x, it.y); x.rotate(it.a || 0);
    if (it.kind === 'mag') { x.fillStyle = '#2b2f37'; x.fillRect(-0.12 * u, -0.22 * u, 0.24 * u, 0.44 * u); x.fillStyle = '#c9a227'; x.fillRect(-0.08 * u, -0.22 * u, 0.16 * u, 0.06 * u); }
    else if (it.kind === 'shell') { x.fillStyle = '#c0392b'; x.fillRect(-0.16 * u, -0.07 * u, 0.32 * u, 0.14 * u); x.fillStyle = '#d4a83a'; x.fillRect(0.08 * u, -0.07 * u, 0.08 * u, 0.14 * u); }
    else if (it.kind === 'loader') { x.strokeStyle = '#9ca3af'; x.lineWidth = 0.08 * u; x.beginPath(); x.arc(0, 0, 0.2 * u, 0, TAU); x.stroke(); x.fillStyle = '#d4a83a'; for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(Math.cos(i * PI / 3) * 0.2 * u, Math.sin(i * PI / 3) * 0.2 * u, 0.06 * u, 0, TAU); x.fill(); } }
    else if (it.kind === 'bolt') { x.strokeStyle = '#d1d5db'; x.lineWidth = 0.07 * u; x.beginPath(); x.moveTo(-0.4 * u, 0); x.lineTo(0.4 * u, 0); x.stroke(); x.fillStyle = '#ef4444'; x.beginPath(); x.moveTo(-0.45 * u, 0); x.lineTo(-0.3 * u, -0.1 * u); x.lineTo(-0.3 * u, 0.1 * u); x.fill(); }
    else if (it.kind === 'gren') { x.fillStyle = it.g === 'frag' ? '#3f6212' : it.g === 'smoke' ? '#9ca3af' : '#fde047'; x.beginPath(); x.arc(0, 0, 0.26 * u, 0, TAU); x.fill(); x.strokeStyle = '#111'; x.lineWidth = 1; x.stroke(); }
    else if (it.kind === 'med') { x.fillStyle = '#f8fafc'; x.fillRect(-0.3 * u, -0.25 * u, 0.6 * u, 0.5 * u); x.fillStyle = '#dc2626'; x.fillRect(-0.18 * u, -0.06 * u, 0.36 * u, 0.12 * u); x.fillRect(-0.06 * u, -0.18 * u, 0.12 * u, 0.36 * u); }
    x.restore();
  }

  /* ================= el soldado ================= */
  function drawSoldier(x, s, ts, time) {
    if (s.downed) {                                                              // derribado: tirado en el piso, se arrastra
      Art._drawCorpseOld(x, { x: s.x, y: s.y, color: s.color, ap: s.ap, ang: s.moveAng + Math.sin(time * 3) * 0.08 }, ts);
      if (s.team >= 0) { x.strokeStyle = s.teamColor; x.lineWidth = 2; x.beginPath(); x.arc(s.x * ts, s.y * ts, ts * 0.55, 0, TAU); x.stroke(); }
      return;
    }
    const A = s.anim || DEF, ap = s.ap, u = ts * 0.4 * ap.build, g = s.gait || 0, wt = s.wtype || 'pistol';
    const cr = A.crouch, vault = A.vault > 0 ? Math.sin(A.vault * PI) : 0;
    x.save(); x.translate(s.x * ts, s.y * ts);
    const hk = A.hitT > 0 ? A.hitT / 0.28 : 0;                                // sacudón por el impacto
    if (hk) { const p = hk * hk * A.hitK * 0.38 * u; x.translate(Math.cos(A.hitAng) * p, Math.sin(A.hitAng) * p); }
    if (s.team >= 0) { x.strokeStyle = s.teamColor; x.globalAlpha = 0.75; x.lineWidth = Math.max(2, u * 0.22); x.beginPath(); x.arc(0, 0, u * 1.55, 0, TAU); x.stroke(); x.globalAlpha = 1; }
    x.fillStyle = 'rgba(0,0,0,.34)'; ell(x, u * 0.12 + vault * u * 0.6, u * 0.28 + vault * u * 0.6, u * (1.2 - cr * 0.15), u * (0.95 - cr * 0.1)); x.fill();
    if (s.speedT > 0) { x.strokeStyle = 'rgba(250,204,21,.75)'; x.lineWidth = 2; x.setLineDash([4, 5]); x.beginPath(); x.arc(0, 0, u * 1.8, 0, TAU); x.stroke(); x.setLineDash([]); }
    const sc = (1 - cr * 0.08) * (1 + vault * 0.18); x.scale(sc, sc);

    // ---- piernas y cadera (siguen hacia dónde camina) ----
    const run = clamp(A.speed / 3, 0, 1.3), stride = (0.5 + 0.5 * Math.min(1, run)) * (1 - cr * 0.45);
    x.save(); x.rotate(s.moveAng); x.lineCap = 'round';
    for (const k of [-1, 1]) {
      const ph = Math.sin(s.phase + (k > 0 ? 0 : PI)), lift = Math.max(0, Math.cos(s.phase + (k > 0 ? 0 : PI)));
      const fx = ph * 0.95 * u * g * stride + cr * 0.35 * u, fy = k * (0.34 + cr * 0.14) * u, hxp = -0.05 * u, hyp = k * 0.3 * u;
      const kx = (hxp + fx) / 2 + cr * 0.35 * u, ky = (hyp + fy) / 2 + k * (0.1 + cr * 0.18) * u;
      x.strokeStyle = shade(ap.pants, -0.06); x.lineWidth = 0.62 * u; x.beginPath(); x.moveTo(hxp, hyp); x.lineTo(kx, ky); x.stroke();
      x.strokeStyle = ap.pants; x.lineWidth = 0.52 * u; x.beginPath(); x.moveTo(kx, ky); x.lineTo(fx, fy); x.stroke();
      const bs = 1 - lift * 0.18 * g * run;
      x.fillStyle = '#14161c'; ell(x, fx + 0.2 * u, fy, 0.5 * u * bs, 0.3 * u * bs); x.fill();
    }
    x.fillStyle = shade(ap.pants, -0.15); ell(x, 0, 0, 0.42 * u, 0.62 * u); x.fill();
    x.restore();

    // ---- torso, brazos y arma (hacia dónde apunta) ----
    const P = pose(s, A, u, time);
    x.save(); x.rotate(s.angle + (hk ? Math.sin(hk * PI) * 0.25 * A.hitK * (Math.sin(A.hitAng - s.angle) > 0 ? -1 : 1) : 0));
    x.translate(cr * 0.12 * u, A.lean * 0.4 * u + Math.sin(s.phase) * 0.07 * u * g);
    if (s.stunT > 0) x.rotate(Math.sin(time * 9) * 0.12);
    if (s.dodgeT > 0) x.rotate(Math.sin(time * 20) * 0.08);
    if (ap.pack) { x.fillStyle = shade(s.color, -0.5); x.beginPath(); x.roundRect(-1.05 * u, (-0.6 + A.pack) * u, 0.62 * u, 1.2 * u, 0.2 * u); x.fill(); }
    x.lineCap = 'round'; x.lineJoin = 'round';
    const SR = [0.05 * u, 0.82 * u], SL = [0.05 * u, -0.82 * u];
    if (P.gun) { x.save(); x.translate(P.gx, P.gy); x.rotate(P.rot); drawGun(x, wt, u); x.restore(); }
    if (P.L) arm(x, s, u, SL[0], SL[1], P.L[0], P.L[1], -1);
    if (P.R) arm(x, s, u, SR[0], SR[1], P.R[0], P.R[1], 1);
    if (P.knife) {                                                              // cuchillo en la mano y estela del golpe
      x.save(); x.translate(P.knife.x, P.knife.y); x.rotate(P.knife.a); drawGun(x, 'knife', u); x.restore();
      if (P.knife.p >= 0) {
        x.strokeStyle = P.knife.swing === 'back' ? 'rgba(255,90,90,.75)' : 'rgba(255,255,255,.75)'; x.lineWidth = Math.max(1.5, u * 0.14);
        x.beginPath();
        if (P.knife.swing === 'stab') { x.moveTo(0.8 * u, 0.35 * u); x.lineTo(P.knife.x + 0.6 * u, P.knife.y); }
        else x.arc(P.knife.swing === 'slash' ? 0.1 * u : 0.2 * u, P.knife.swing === 'slash' ? 0.55 * u : 0.3 * u, 1.55 * u, Math.atan2(P.knife.y - 0.5 * u, P.knife.x), P.knife.swing === 'slash' ? 1.25 : 2.2);
        x.stroke();
      }
    }
    if (P.item) heldItem(x, P.item, u);
    // torso encima de los brazos
    x.fillStyle = s.color; x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = Math.max(1.2, u * 0.14);
    ell(x, 0, 0, 0.62 * u, 1.02 * u); x.fill(); x.stroke();
    x.fillStyle = shade(s.color, -0.22); ell(x, -0.1 * u, 0, 0.3 * u, 0.7 * u); x.fill();
    x.fillStyle = shade(s.color, 0.3); ell(x, 0.2 * u, -0.35 * u, 0.18 * u, 0.28 * u); x.fill();
    x.fillStyle = shade(s.color, -0.3); x.beginPath(); x.arc(SR[0], SR[1] * 0.92, 0.26 * u, 0, TAU); x.arc(SL[0], SL[1] * 0.92, 0.26 * u, 0, TAU); x.fill();   // hombros
    if (s.armor && s.armor.vest > 0) {
      x.fillStyle = 'rgba(58,70,96,.72)'; ell(x, 0.02 * u, 0, 0.5 * u, 0.86 * u); x.fill(); x.strokeStyle = 'rgba(10,14,24,.7)'; x.lineWidth = Math.max(1, u * 0.07); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.14)'; ell(x, 0.15 * u, -0.25 * u, 0.15 * u, 0.3 * u); x.fill();
    }
    if (s.team >= 0) { x.fillStyle = s.teamColor; x.beginPath(); x.roundRect(-0.2 * u, -1.28 * u, 0.6 * u, 0.34 * u, 0.1 * u); x.fill(); x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 1; x.stroke(); }
    if (s.recoil > 0.55 && P.gun && !(s.reloadT > 0) && !(s.act)) {
      const len = (GUNS[wt] || GUNS.pistol).len * u, mx = P.gx + Math.cos(P.rot) * len, my = P.gy + Math.sin(P.rot) * len;
      muzzle(x, wt, mx, my, P.rot, u, time, A.sup);
    }
    x.restore();

    // ---- cabeza (mira hacia donde escucha) ----
    const la = A.lean * 0.4 * u, pa = s.angle + PI / 2;
    x.save(); x.translate(Math.cos(pa) * la, Math.sin(pa) * la); x.rotate(s.look); x.translate(0.08 * u + Math.cos(s.phase * 2) * 0.03 * u * g + cr * 0.1 * u, 0);
    const kk = scaleOf(x), hs = headSprite(ap, u, kk, s.armor && s.armor.helm > 0);
    if (ap.style === 'long' || ap.style === 'pony') { x.fillStyle = ap.hair; ell(x, -0.75 * u, -A.pack * 0.6 * u, 0.32 * u, 0.24 * u); x.fill(); }   // pelo que se balancea
    x.drawImage(hs.cv, -hs.R, -hs.R, hs.R * 2, hs.R * 2);
    x.restore();
    if (s.stunT > 0) {                                                          // estrellitas de aturdido
      x.fillStyle = '#fde047';
      for (let i = 0; i < 3; i++) { const a = time * 5 + i * TAU / 3, sx = Math.cos(a) * 0.85 * u, sy = Math.sin(a) * 0.5 * u - 0.6 * u; x.beginPath(); for (let k = 0; k < 10; k++) { const r = (k % 2 ? 0.08 : 0.2) * u, b = k * PI / 5; x.lineTo(sx + Math.cos(b) * r, sy + Math.sin(b) * r); } x.fill(); }
    }
    if (s.shieldHp > 0) {
      x.strokeStyle = `rgba(56,189,248,${0.55 + Math.sin(time * 8) * 0.3})`; x.lineWidth = Math.max(2, u * 0.25);
      x.beginPath(); x.arc(0, 0, u * 1.75, 0, TAU); x.stroke(); x.fillStyle = 'rgba(56,189,248,.12)'; x.fill();
    }
    if (s.flash > 0) { x.fillStyle = `rgba(255,255,255,${Math.min(0.85, s.flash * 5)})`; ell(x, 0, 0, u * 1.1, u * 1.1); x.fill(); }
    x.restore();
  }

  /* ================= muertes con física: muñeco de trapo ================= */
  const POWER = { knife: 1.2, zone: 0.4, boom: 7.5, shotgun: 4.2, ashotgun: 3.6, sniper: 4.6, hmg: 3.2, revolver: 3.2, crossbow: 3.4 };
  /** Arma el muñeco con la pose del soldado y lo empuja según el último golpe. */
  G.makeRagdoll = function (s) {
    const h = s._lastHit || { ang: s.angle + PI, k: 0.6, kind: 'hit' };
    const b = 0.4 * s.ap.build, a = s.angle, dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
    const at = (f, l) => ({ x: s.x + dx * f * b + px * l * b, y: s.y + dy * f * b + py * l * b });
    const pts = [at(-0.25, 0), at(0.35, 0), at(0.9, 0), at(0.7, -1.0), at(0.7, 1.0), at(-1.0, -0.4), at(-1.0, 0.4)];   // cadera, pecho, cabeza, manos, pies
    const pw = (POWER[h.kind] || 2.4) * (0.6 + 0.4 * h.k), vx = Math.cos(h.ang) * pw, vy = Math.sin(h.ang) * pw, spin = (rnd() - 0.5) * pw * 1.2;
    pts.forEach((p, i) => {
      const lever = i === 2 ? 1.4 : i === 3 || i === 4 ? 1.2 : i === 1 ? 1.1 : 0.8;                      // la parte de arriba sale más despedida
      const sx = -(p.y - s.y) * spin, sy = (p.x - s.x) * spin;
      p.px = p.x - (vx * lever + sx) / 60; p.py = p.y - (vy * lever + sy) / 60;
    });
    const C = [[0, 1, 0.6], [1, 2, 0.55], [1, 3, 1.15], [1, 4, 1.15], [0, 5, 1.05], [0, 6, 1.05], [0, 2, 1.15], [3, 4, 0.9, 1], [5, 6, 0.55, 1]].map(([i, j, l, soft]) => [i, j, l * b, !!soft]);
    return { pts, C, t: 0, done: false };
  };
  G.stepCorpses = function (dt) {
    for (const c of this.corpses) {
      const r = c.rag; if (!r || r.done) continue;
      r.t += dt;
      const fr = Math.exp(-dt * (r.t < 0.25 ? 1.5 : 7));                          // vuela un instante y después se arrastra y frena
      for (const p of r.pts) {
        const vx = (p.x - p.px) * fr, vy = (p.y - p.py) * fr; p.px = p.x; p.py = p.y;
        const nx = p.x + vx, ny = p.y + vy;
        if (this.isSolid(Math.floor(nx), Math.floor(p.y))) p.px = p.x + vx * 0.4; else p.x = nx;      // choca con la pared y rebota un poco
        if (this.isSolid(Math.floor(p.x), Math.floor(ny))) p.py = p.y + vy * 0.4; else p.y = ny;
      }
      for (let it = 0; it < 4; it++) for (const [i, j, l, soft] of r.C) {
        const a = r.pts[i], b = r.pts[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.0001;
        if (soft && d > l * 0.6 && d < l * 1.4) continue;                       // brazos y piernas sueltos dentro de un rango
        const f = (d - l) / d * 0.5; a.x += dx * f; a.y += dy * f; b.x -= dx * f; b.y -= dy * f;
      }
      for (const p of r.pts) if (this.isSolid(Math.floor(p.x), Math.floor(p.y))) { p.x = p.px; p.y = p.py; }
      c.x = r.pts[1].x; c.y = r.pts[1].y;
      if (r.t > 1.8) r.done = true;
    }
  };
  function drawCorpse(x, c, ts, time) {
    const r = c.rag;
    if (!r) return Art._drawCorpseOld(x, c, ts, time);
    const u = ts * 0.4 * c.ap.build, P = r.pts.map((p) => [p.x * ts, p.y * ts]);
    const age = c.t0 != null && time != null ? time - c.t0 : 99;
    const pool = Math.min(1, Math.max(0, age - 0.6) / 3.5) * u * 1.6;          // charco
    if (pool > 1) { x.fillStyle = 'rgba(110,10,18,.42)'; ell(x, (P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2, pool * 1.15, pool * 0.85, Math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0])); x.fill(); }
    x.save(); x.globalAlpha = r.done ? 0.62 : 0.62 + 0.38 * (1 - r.t / 1.8); x.lineCap = 'round';
    x.strokeStyle = c.ap.pants; x.lineWidth = 0.58 * u;
    for (const f of [5, 6]) { x.beginPath(); x.moveTo(P[0][0], P[0][1]); x.lineTo(P[f][0], P[f][1]); x.stroke(); x.fillStyle = '#14161c'; x.beginPath(); x.arc(P[f][0], P[f][1], 0.24 * u, 0, TAU); x.fill(); }
    x.strokeStyle = shade(c.color, -0.15); x.lineWidth = 0.46 * u;
    for (const h of [3, 4]) { x.beginPath(); x.moveTo(P[1][0], P[1][1]); x.lineTo(P[h][0], P[h][1]); x.stroke(); x.fillStyle = c.ap.skin; x.beginPath(); x.arc(P[h][0], P[h][1], 0.22 * u, 0, TAU); x.fill(); }
    const ba = Math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0]), bl = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]);
    x.fillStyle = c.color; ell(x, (P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2, bl / 2 + 0.55 * u, 0.62 * u, ba); x.fill();
    x.translate(P[2][0], P[2][1]); x.rotate(Math.atan2(P[2][1] - P[1][1], P[2][0] - P[1][0])); head(x, c.ap, u);
    x.restore();
  }

  Art._drawCorpseOld = Art.drawCorpse;
  Art.drawSoldier = drawSoldier;
  Art.drawCorpse = drawCorpse;
  App.Rig = { pose, drawSoldier, drawCorpse, RELOAD_KIND };
})();
