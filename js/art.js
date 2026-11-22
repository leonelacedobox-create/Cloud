/* Arte de la batalla: personas vistas desde arriba (piernas, brazos, cabeza, pelo) y puertas.
   Todo se dibuja con código, así cada soldado conserva el color que le eligió su dueño. */
'use strict';

// roundRect no existe en celulares/navegadores viejos: versión simple de reemplazo
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const k = Math.min(Array.isArray(r) ? r[0] : r, w / 2, h / 2);
    this.moveTo(x + k, y); this.arcTo(x + w, y, x + w, y + h, k); this.arcTo(x + w, y + h, x, y + h, k);
    this.arcTo(x, y + h, x, y, k); this.arcTo(x, y, x + w, y, k); this.closePath();
  };
}

const Art = (() => {
  const { rnd, rint, shuffle } = App;

  const SKINS = ['#f6d3b3', '#e8b98f', '#cf9565', '#a8683b', '#7a4a2b', '#5a3720'];
  const HAIRS = ['#16110b', '#2c1b0e', '#5a3a1c', '#8a5a2b', '#c9a24a', '#b8b8b8', '#7a2412', '#1f2937'];
  const PANTS = ['#27304a', '#3a4030', '#4b3b2a', '#26262e', '#3f4650', '#4a2f3a'];
  const CAPS = ['#e11d48', '#2563eb', '#16a34a', '#f59e0b', '#111827', '#7c3aed'];
  const STYLES = ['short', 'long', 'bald', 'cap', 'beanie', 'afro', 'pony', 'mohawk', 'short', 'cap'];

  /** n aspectos distintos entre sí (peinado y tono de piel sin repetirse mientras se pueda). */
  function makeLooks(n) {
    const styles = shuffle(STYLES), skins = shuffle(SKINS);
    return Array.from({ length: n }, (_, i) => {
      const style = styles[i % styles.length];
      return {
        style, skin: skins[i % skins.length],
        hair: HAIRS[rint(HAIRS.length)], pants: PANTS[rint(PANTS.length)], cap: CAPS[rint(CAPS.length)],
        build: 0.94 + rnd() * 0.14, pack: rnd() < 0.4, beard: style !== 'long' && rnd() < 0.28, shades: rnd() < 0.22,
        mohawk: ['#e11d48', '#22d3ee', '#a3e635'][rint(3)],
      };
    });
  }

  const ell = (x, cx, cy, rx, ry, rot = 0) => { x.beginPath(); x.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, 6.2832); };
  const shade = (hex, k) => { // k>0 aclara, k<0 oscurece
    const n = parseInt(hex.slice(1), 16), f = (v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  };

  /* ---------- cabeza ---------- */
  function head(x, ap, u) {
    const R = 0.6 * u;
    x.fillStyle = ap.skin; ell(x, 0, -R * 0.98, 0.17 * u, 0.2 * u); x.fill(); ell(x, 0, R * 0.98, 0.17 * u, 0.2 * u); x.fill(); // orejas
    x.fillStyle = ap.skin; x.beginPath(); x.arc(0, 0, R, 0, 6.2832); x.fill();
    const face = () => { x.fillStyle = ap.skin; ell(x, R * 0.62, 0, R * 0.42, R * 0.62); x.fill(); };
    switch (ap.style) {
      case 'bald':
        x.fillStyle = 'rgba(255,255,255,.28)'; ell(x, -R * 0.2, -R * 0.25, R * 0.35, R * 0.22, -0.5); x.fill(); break;
      case 'long':
        x.fillStyle = ap.hair; ell(x, -R * 0.95, 0, R * 0.85, R * 0.7); x.fill();
        x.beginPath(); x.arc(-R * 0.08, 0, R * 1.04, 0, 6.2832); x.fill(); face(); break;
      case 'afro':
        x.fillStyle = ap.hair; x.beginPath(); x.arc(-R * 0.1, 0, R * 1.5, 0, 6.2832); x.fill(); face(); break;
      case 'pony':
        x.fillStyle = ap.hair; x.beginPath(); x.arc(-R * 0.08, 0, R * 1.02, 0, 6.2832); x.fill();
        ell(x, -R * 1.35, 0, R * 0.55, R * 0.28); x.fill(); x.fillStyle = '#e11d48'; x.beginPath(); x.arc(-R * 1.02, 0, R * 0.16, 0, 6.2832); x.fill(); face(); break;
      case 'mohawk':
        x.fillStyle = ap.mohawk; ell(x, -R * 0.1, 0, R * 1.05, R * 0.22); x.fill(); break;
      case 'cap': {
        x.fillStyle = ap.cap; x.beginPath(); x.arc(-R * 0.05, 0, R * 1.02, 0, 6.2832); x.fill();
        x.fillStyle = shade(ap.cap, -0.35); x.beginPath(); x.roundRect(R * 0.55, -R * 0.62, R * 0.75, R * 1.24, R * 0.3); x.fill();
        x.fillStyle = shade(ap.cap, 0.3); x.beginPath(); x.arc(-R * 0.05, 0, R * 0.16, 0, 6.2832); x.fill(); break;
      }
      case 'beanie':
        x.fillStyle = ap.cap; x.beginPath(); x.arc(0, 0, R * 1.06, 0, 6.2832); x.fill();
        x.strokeStyle = shade(ap.cap, -0.3); x.lineWidth = R * 0.2; x.beginPath(); x.arc(0, 0, R * 0.8, 0.3, 6.0); x.stroke();
        x.fillStyle = shade(ap.cap, 0.45); x.beginPath(); x.arc(-R * 0.1, 0, R * 0.22, 0, 6.2832); x.fill(); break;
      default: // short
        x.fillStyle = ap.hair; x.beginPath(); x.arc(-R * 0.1, 0, R * 1.0, 0, 6.2832); x.fill(); face();
    }
    if (ap.style !== 'cap' && ap.style !== 'beanie' && ap.style !== 'mohawk' && ap.style !== 'bald' && ap.shades) {
      x.fillStyle = '#0b0d12'; x.fillRect(R * 0.55, -R * 0.5, R * 0.22, R); // lentes oscuros
    }
    if (ap.beard) { x.fillStyle = ap.hair; ell(x, R * 0.7, 0, R * 0.3, R * 0.5); x.fill(); }
  }

  /* ---------- armas (dibujadas apuntando a +x, el origen es la empuñadura) ---------- */
  // len: largo en unidades u, fore: dónde apoya la mano de adelante
  const GUNS = {
    pistol:   { len: 1.05, fore: 0.75 },
    knife:    { len: 1.0, fore: 0 },
    sniper:   { len: 3.0, fore: 1.6 },
    lmg:      { len: 2.1, fore: 1.3 },
    shotgun:  { len: 2.2, fore: 1.35 },
    ashotgun: { len: 2.1, fore: 1.3 },
    hmg:      { len: 2.4, fore: 1.4 },
  };
  const METAL = '#1a1e28', STEEL = '#6b7280', WOOD = '#7a4b22';

  function gun(x, type, u, glow) {
    const r = (a, b, w, h, c, rad = 0.06) => { x.fillStyle = c; x.beginPath(); x.roundRect(a * u, (b - w / 2) * u, (h) * u, w * u, rad * u); x.fill(); };
    switch (type) {
      case 'pistol':  r(-0.1, 0, 0.3, 0.55, METAL); r(0.35, 0, 0.26, 0.7, STEEL); r(0.0, 0.14, 0.2, 0.28, '#2b2f3a'); break;
      case 'sniper':  r(-0.3, 0, 0.36, 0.9, WOOD); r(0.5, 0, 0.24, 1.7, METAL); r(2.1, 0, 0.13, 0.9, STEEL); r(0.9, -0.02, 0.34, 0.6, '#0f172a'); r(1.0, -0.02, 0.2, 0.4, '#38bdf8', 0.1); break;
      case 'lmg':     r(-0.2, 0, 0.36, 0.7, '#2b2f3a'); r(0.4, 0, 0.3, 1.3, METAL); r(1.5, 0, 0.14, 0.6, STEEL); r(0.7, 0.28, 0.26, 0.5, '#4b5563'); break;
      case 'shotgun': r(-0.25, 0, 0.34, 0.8, WOOD); r(0.5, 0, 0.26, 1.7, METAL); r(1.0, 0, 0.4, 0.6, '#9a6430'); break;
      case 'ashotgun': r(-0.25, 0, 0.34, 0.7, '#2b2f3a'); r(0.4, 0, 0.3, 1.5, METAL); x.fillStyle = '#4b5563'; x.beginPath(); x.arc(0.95 * u, 0.3 * u, 0.3 * u, 0, 6.2832); x.fill(); x.fillStyle = '#1f2937'; x.beginPath(); x.arc(0.95 * u, 0.3 * u, 0.15 * u, 0, 6.2832); x.fill(); break;
      case 'hmg':     r(-0.25, 0, 0.5, 0.8, '#2b2f3a'); r(0.5, 0, 0.42, 1.2, METAL); r(1.6, 0, 0.2, 0.9, STEEL); r(0.55, 0.45, 0.36, 0.8, '#3f6212'); r(0.55, 0.45, 0.2, 0.8, '#a3a3a3', 0.1); break;
      case 'knife':   r(0.0, 0, 0.26, 0.3, '#3b2a1a'); x.fillStyle = '#d1d5db'; x.beginPath(); x.moveTo(0.3 * u, -0.14 * u); x.lineTo(1.05 * u, -0.03 * u); x.lineTo(1.12 * u, 0.04 * u); x.lineTo(0.3 * u, 0.14 * u); x.closePath(); x.fill(); break;
      default: break;
    }
    if (glow) { x.strokeStyle = glow; x.lineWidth = Math.max(1, u * 0.1); x.globalAlpha = 0.9; x.beginPath(); x.roundRect(-0.35 * u, -0.45 * u, (GUNS[type].len + 0.5) * u, 0.9 * u, 0.2 * u); x.stroke(); x.globalAlpha = 1; }
  }

  /* ---------- soldado vivo ---------- */
  function drawSoldier(x, s, ts, time) {
    const ap = s.ap, u = ts * 0.4 * ap.build, g = s.gait;
    const wt = s.wtype || 'pistol', G = GUNS[wt] || GUNS.pistol;
    x.save(); x.translate(s.x * ts, s.y * ts);

    // marca del equipo en el piso + sombra
    if (s.team >= 0) { x.strokeStyle = s.teamColor; x.globalAlpha = 0.75; x.lineWidth = Math.max(2, u * 0.22); x.beginPath(); x.arc(0, 0, u * 1.55, 0, 6.2832); x.stroke(); x.globalAlpha = 1; }
    x.fillStyle = 'rgba(0,0,0,.34)'; ell(x, u * 0.12, u * 0.28, u * 1.2, u * 0.95); x.fill();
    if (s.speedT > 0) { x.strokeStyle = 'rgba(250,204,21,.75)'; x.lineWidth = 2; x.setLineDash([4, 5]); x.beginPath(); x.arc(0, 0, u * 1.8, 0, 6.2832); x.stroke(); x.setLineDash([]); }

    // piernas (siguen la dirección en que camina)
    x.save(); x.rotate(s.moveAng); x.lineCap = 'round';
    for (const k of [-1, 1]) {
      const ph = Math.sin(s.phase + (k > 0 ? 0 : Math.PI)), lon = ph * 0.85 * u * g, lat = k * 0.36 * u;
      x.strokeStyle = ap.pants; x.lineWidth = 0.66 * u; x.beginPath(); x.moveTo(0, lat * 0.75); x.lineTo(lon, lat); x.stroke();
      x.fillStyle = '#14161c'; ell(x, lon + 0.2 * u, lat, 0.5 * u, 0.3 * u); x.fill();
    }
    x.restore();

    // torso, brazos y arma (siguen hacia donde apunta)
    x.save(); x.rotate(s.angle);
    const sway = Math.sin(s.phase) * 0.07 * u * g, rec = s.recoil * (wt === 'sniper' ? 0.5 : 0.3) * u;
    x.translate(0, sway);
    if (ap.pack) { x.fillStyle = shade(s.color, -0.5); x.beginPath(); x.roundRect(-1.05 * u, -0.6 * u, 0.62 * u, 1.2 * u, 0.2 * u); x.fill(); }
    const act = s.act, reach = act && (act.type === 'open' || act.type === 'close');
    const e = reach ? Math.sin(Math.min(1, act.t / act.dur) * Math.PI) : 0;       // 0 -> 1 -> 0
    const reloading = s.reloadT > 0 && !reach, rp = reloading ? 1 - s.reloadT / Math.max(0.01, s.reloadTot) : 0;
    const thrust = s.meleeT > 0 ? Math.sin(Math.min(1, (0.25 - s.meleeT) / 0.25) * Math.PI) * 1.15 : 0;

    const lw = 0.52 * u;
    x.lineCap = 'round'; x.lineJoin = 'round';
    const arm = (sx, sy, ex, ey, hx, hy) => {
      x.strokeStyle = shade(s.color, -0.12); x.lineWidth = lw; x.beginPath(); x.moveTo(sx, sy); x.lineTo(ex, ey); x.lineTo(hx, hy); x.stroke();
      x.fillStyle = ap.skin; x.beginPath(); x.arc(hx, hy, 0.24 * u, 0, 6.2832); x.fill();
    };
    const drawGunAt = (px, py, rot) => { x.save(); x.translate(px, py); x.rotate(rot); gun(x, wt, u, null); x.restore(); };

    if (reach) {                                        // abre / cierra una puerta con la mano derecha
      drawGunAt(0.15 * u - rec, 0.1 * u, 0.15);
      arm(0, -0.9 * u, 0.5 * u, -0.7 * u, 0.7 * u, -0.1 * u);
      arm(0, 0.9 * u, (0.9 + 0.6 * e) * u, (0.9 - 0.4 * e) * u, (0.9 + 1.25 * e) * u, 0.05 * u);
    } else if (wt === 'knife') {                        // cuchillo: estocada hacia adelante
      const hx = (0.95 + thrust) * u, hy = 0.3 * u - thrust * 0.15 * u;
      drawGunAt(hx, hy, -0.05);
      arm(0, 0.9 * u, (0.6 + thrust * 0.5) * u, 1.0 * u, hx, hy);
      arm(0, -0.9 * u, 0.3 * u, -1.15 * u, 0.55 * u, -0.8 * u);
    } else if (reloading) {                             // recarga: arma abajo, la otra mano busca el cargador
      drawGunAt(0.2 * u - rec, 0.5 * u, 0.55);
      const lx = (0.35 + 0.35 * Math.sin(rp * 10)) * u, ly = (0.1 + 0.55 * (rp > 0.25 && rp < 0.8 ? 0 : 1)) * u;
      arm(0, 0.9 * u, 0.5 * u, 1.1 * u, 0.55 * u, 0.62 * u);
      arm(0, -0.9 * u, 0.2 * u, -0.5 * u, lx, ly);
      x.fillStyle = '#374151'; x.fillRect(lx - 0.12 * u, ly - 0.2 * u, 0.24 * u, 0.4 * u);
    } else {                                            // apuntando
      drawGunAt(0.55 * u - rec, 0.05 * u, 0);
      arm(0, 0.9 * u, 0.6 * u - rec, 1.0 * u, 0.62 * u - rec, 0.3 * u);
      arm(0, -0.9 * u, 0.9 * u - rec, -0.95 * u, (G.fore + 0.2) * u - rec, wt === 'pistol' ? -0.05 * u : -0.1 * u);
    }
    // torso
    x.fillStyle = s.color; x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = Math.max(1.2, u * 0.14);
    ell(x, 0, 0, 0.62 * u, 1.02 * u); x.fill(); x.stroke();
    x.fillStyle = shade(s.color, -0.22); ell(x, -0.1 * u, 0, 0.3 * u, 0.7 * u); x.fill();
    x.fillStyle = shade(s.color, 0.3); ell(x, 0.2 * u, -0.35 * u, 0.18 * u, 0.28 * u); x.fill();
    if (s.team >= 0) { x.fillStyle = s.teamColor; x.beginPath(); x.roundRect(-0.2 * u, -1.28 * u, 0.6 * u, 0.34 * u, 0.1 * u); x.fill(); x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 1; x.stroke(); }
    // fogonazo
    if (s.recoil > 0.55 && wt !== 'knife' && !reloading && !reach) {
      x.fillStyle = '#ffe58a'; x.beginPath(); const fx = (0.55 + G.len) * u - rec, big = wt === 'shotgun' || wt === 'ashotgun' || wt === 'hmg' ? 1.5 : 1;
      x.moveTo(fx, 0); x.lineTo(fx + 0.5 * u * big, -0.28 * u * big); x.lineTo(fx + 0.95 * u * big, 0); x.lineTo(fx + 0.5 * u * big, 0.28 * u * big); x.closePath(); x.fill();
    }
    // tajo del cuchillo
    if (s.meleeT > 0) {
      x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = Math.max(1.5, u * 0.14); x.beginPath();
      x.arc(0.8 * u, 0.1 * u, 1.35 * u, -0.9, 0.9); x.stroke();
    }
    x.restore();

    // cabeza (puede mirar a un costado)
    x.save(); x.rotate(s.look); x.translate(0.08 * u + Math.cos(s.phase * 2) * 0.03 * u * g, 0); head(x, ap, u); x.restore();

    if (s.shieldHp > 0) {
      x.strokeStyle = `rgba(56,189,248,${0.55 + Math.sin(time * 8) * 0.3})`; x.lineWidth = Math.max(2, u * 0.25);
      x.beginPath(); x.arc(0, 0, u * 1.75, 0, 6.2832); x.stroke(); x.fillStyle = 'rgba(56,189,248,.12)'; x.fill();
    }
    if (s.flash > 0) { x.fillStyle = `rgba(255,255,255,${Math.min(0.85, s.flash * 5)})`; ell(x, 0, 0, u * 1.1, u * 1.1); x.fill(); }
    x.restore();
  }

  /* ---------- cosas en el piso ---------- */
  const RARITY = { pistol: '#9ca3af', shotgun: '#fb923c', ashotgun: '#f97316', lmg: '#facc15', sniper: '#38bdf8', hmg: '#f43f5e' };
  function drawItem(x, it, ts, time) {
    const u = ts * 0.4, cx = it.x * ts, cy = it.y * ts, pulse = 1 + Math.sin(time * 4 + it.id) * 0.06;
    x.save(); x.translate(cx, cy);
    if (it.kind === 'weapon') {
      const col = RARITY[it.type] || '#fff', len = GUNS[it.type].len;
      x.fillStyle = col; x.globalAlpha = 0.18; x.beginPath(); x.arc(0, 0, u * 1.7 * pulse, 0, 6.2832); x.fill(); x.globalAlpha = 1;
      x.fillStyle = 'rgba(0,0,0,.35)'; ell(x, 0.1 * u, 0.25 * u, len * u * 0.6, 0.45 * u); x.fill();
      x.rotate(it.ang); x.translate(-len * u * 0.45, 0);
      gun(x, it.type, u * 0.95, col);
    } else if (it.kind === 'ammo') {
      x.fillStyle = '#4ade80'; x.globalAlpha = 0.18; x.beginPath(); x.arc(0, 0, u * 1.3 * pulse, 0, 6.2832); x.fill(); x.globalAlpha = 1;
      x.rotate(it.ang * 0.3);
      x.fillStyle = '#3f6212'; x.beginPath(); x.roundRect(-0.8 * u, -0.55 * u, 1.6 * u, 1.1 * u, 0.15 * u); x.fill();
      x.strokeStyle = '#a3e635'; x.lineWidth = Math.max(1, u * 0.1); x.stroke();
      x.fillStyle = '#facc15';
      for (let i = -2; i <= 2; i++) { x.beginPath(); x.roundRect((i * 0.28 - 0.08) * u, -0.3 * u, 0.16 * u, 0.6 * u, 0.06 * u); x.fill(); }
    }
    x.restore();
  }

  /* ---------- caído ---------- */
  function drawCorpse(x, c, ts) {
    const u = ts * 0.4 * c.ap.build;
    x.save(); x.translate(c.x * ts, c.y * ts); x.rotate(c.ang); x.globalAlpha = 0.55;
    x.strokeStyle = c.ap.pants; x.lineWidth = 0.62 * u; x.lineCap = 'round';
    x.beginPath(); x.moveTo(-0.3 * u, -0.3 * u); x.lineTo(-1.5 * u, -0.7 * u); x.moveTo(-0.3 * u, 0.3 * u); x.lineTo(-1.45 * u, 0.5 * u); x.stroke();
    x.strokeStyle = shade(c.color, -0.2); x.lineWidth = 0.5 * u;
    x.beginPath(); x.moveTo(0.1 * u, -0.8 * u); x.lineTo(0.9 * u, -1.5 * u); x.moveTo(0.1 * u, 0.8 * u); x.lineTo(0.6 * u, 1.6 * u); x.stroke();
    x.fillStyle = c.color; ell(x, 0, 0, 0.62 * u, 1.0 * u); x.fill();
    x.translate(0.9 * u, 0); head(x, c.ap, u);
    x.restore();
  }

  /* ---------- puertas ---------- */
  function drawDoor(x, d, ts) {
    const cx = (d.tx + 0.5) * ts, cy = (d.ty + 0.5) * ts, t = Math.max(3, ts * 0.26);
    x.save(); x.translate(cx, cy);
    // d.along 'h': el pasillo va de izquierda a derecha, la hoja cerrada es una barra vertical.
    // d.along 'v': el pasillo va de arriba a abajo, se dibuja girado 90°.
    if (d.along === 'v') x.rotate(Math.PI / 2);
    // jambas (marco) en los dos extremos de la hoja
    x.fillStyle = '#2a1d10';
    x.fillRect(-t * 0.8, -ts * 0.5, t * 1.6, t * 0.5); x.fillRect(-t * 0.8, ts * 0.5 - t * 0.5, t * 1.6, t * 0.5);
    // hoja: bisagra arriba; al abrir gira hasta quedar apoyada contra la pared
    x.translate(0, -ts * 0.5);
    x.rotate(-d.anim * (Math.PI / 2) * 0.95 * d.flip);
    const L = ts * 0.98;
    x.fillStyle = '#8a5a2b'; x.fillRect(-t / 2, 0, t, L);
    x.fillStyle = '#a8733a'; x.fillRect(-t / 2, 0, t * 0.4, L);
    x.fillStyle = '#e8c15a'; x.beginPath(); x.arc(t * 0.25, L * 0.62, Math.max(1.2, t * 0.22), 0, 6.2832); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 1; x.strokeRect(-t / 2, 0, t, L);
    x.restore();
  }

  return { makeLooks, drawSoldier, drawCorpse, drawDoor, drawItem, head, GUNS, RARITY };
})();
