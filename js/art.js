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

  /* ---------- soldado vivo ---------- */
  function drawSoldier(x, s, ts, time) {
    const ap = s.ap, u = ts * 0.4 * ap.build, g = s.gait;
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
    const sway = Math.sin(s.phase) * 0.07 * u * g, rec = s.recoil * 0.3 * u;
    x.translate(0, sway);
    if (ap.pack) { x.fillStyle = shade(s.color, -0.5); x.beginPath(); x.roundRect(-1.05 * u, -0.6 * u, 0.62 * u, 1.2 * u, 0.2 * u); x.fill(); }
    const act = s.act, reach = act && (act.type === 'open' || act.type === 'close');
    const e = reach ? Math.sin(Math.min(1, act.t / act.dur) * Math.PI) : 0;       // 0 -> 1 -> 0

    // brazo izquierdo (apoyo del arma) y derecho (agarre / abre puertas)
    const lw = 0.52 * u;
    x.lineCap = 'round'; x.lineJoin = 'round';
    const arm = (sx, sy, ex, ey, hx, hy) => {
      x.strokeStyle = shade(s.color, -0.12); x.lineWidth = lw; x.beginPath(); x.moveTo(sx, sy); x.lineTo(ex, ey); x.lineTo(hx, hy); x.stroke();
      x.fillStyle = ap.skin; x.beginPath(); x.arc(hx, hy, 0.24 * u, 0, 6.2832); x.fill();
    };
    // arma
    const gx0 = (reach ? 0.15 : 0.6) * u - rec, gx1 = (reach ? 1.05 : 2.05) * u - rec;
    x.fillStyle = '#1a1e28'; x.beginPath(); x.roundRect(gx0, -0.17 * u, gx1 - gx0, 0.34 * u, 0.1 * u); x.fill();
    x.fillStyle = s.triple > 0 ? '#fb923c' : '#6b7280'; x.fillRect(gx1 - 0.35 * u, -0.17 * u, 0.35 * u, 0.34 * u);
    if (s.triple > 0 && !reach) { x.fillStyle = '#fb923c'; x.fillRect(gx1 - 0.5 * u, -0.5 * u, 0.4 * u, 0.18 * u); x.fillRect(gx1 - 0.5 * u, 0.32 * u, 0.4 * u, 0.18 * u); }
    if (!reach) {
      arm(0, -0.9 * u, 0.9 * u - rec, -0.95 * u, 1.55 * u - rec, -0.1 * u);
      arm(0, 0.9 * u, 0.6 * u - rec, 1.0 * u, 0.85 * u - rec, 0.32 * u);
    } else {
      arm(0, -0.9 * u, 0.5 * u, -0.7 * u, 0.7 * u, -0.1 * u);                         // sostiene el arma pegada al cuerpo
      arm(0, 0.9 * u, (0.9 + 0.6 * e) * u, (0.9 - 0.4 * e) * u, (0.9 + 1.25 * e) * u, 0.05 * u); // estira la mano a la puerta
    }
    // torso
    x.fillStyle = s.color; x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = Math.max(1.2, u * 0.14);
    ell(x, 0, 0, 0.62 * u, 1.02 * u); x.fill(); x.stroke();
    x.fillStyle = shade(s.color, -0.22); ell(x, -0.1 * u, 0, 0.3 * u, 0.7 * u); x.fill();
    x.fillStyle = shade(s.color, 0.3); ell(x, 0.2 * u, -0.35 * u, 0.18 * u, 0.28 * u); x.fill();
    if (s.team >= 0) { x.fillStyle = s.teamColor; x.beginPath(); x.roundRect(-0.2 * u, -1.28 * u, 0.6 * u, 0.34 * u, 0.1 * u); x.fill(); x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 1; x.stroke(); }
    // fogonazo
    if (s.recoil > 0.55) {
      x.fillStyle = '#ffe58a'; x.beginPath(); const fx = 2.15 * u - rec;
      x.moveTo(fx, 0); x.lineTo(fx + 0.5 * u, -0.28 * u); x.lineTo(fx + 0.95 * u, 0); x.lineTo(fx + 0.5 * u, 0.28 * u); x.closePath(); x.fill();
    }
    x.restore();

    // cabeza (puede mirar a un costado)
    x.save(); x.rotate(s.look); x.translate(0.08 * u + Math.cos(s.phase * 2) * 0.03 * u * g, 0); head(x, ap, u); x.restore();

    if (s.shield > 0) {
      x.strokeStyle = `rgba(56,189,248,${0.6 + Math.sin(time * 8) * 0.3})`; x.lineWidth = Math.max(2, u * 0.25);
      x.beginPath(); x.arc(0, 0, u * 1.75, 0, 6.2832); x.stroke(); x.fillStyle = 'rgba(56,189,248,.12)'; x.fill();
    }
    if (s.flash > 0) { x.fillStyle = `rgba(255,255,255,${Math.min(0.85, s.flash * 5)})`; ell(x, 0, 0, u * 1.1, u * 1.1); x.fill(); }
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

  return { makeLooks, drawSoldier, drawCorpse, drawDoor, head };
})();
