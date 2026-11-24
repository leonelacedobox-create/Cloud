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
    if (ap.hat && ap.hat !== 'none') hat(x, ap.hat, R);
  }

  /** Gorros divertidos (0.7), vistos desde arriba. */
  function hat(x, kind, R) {
    x.save(); x.lineJoin = 'round';
    if (kind === 'cowboy') {
      x.fillStyle = '#8a5a2b'; ell(x, 0, 0, R * 1.55, R * 1.35); x.fill(); x.strokeStyle = '#4a2f12'; x.lineWidth = R * 0.1; x.stroke();
      x.fillStyle = '#a8703c'; x.beginPath(); x.arc(0, 0, R * 0.72, 0, 6.2832); x.fill(); x.strokeStyle = '#3a2410'; x.lineWidth = R * 0.18; x.beginPath(); x.arc(0, 0, R * 0.72, 0, 6.2832); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.18)'; ell(x, -R * 0.2, -R * 0.2, R * 0.3, R * 0.18, -0.6); x.fill();
    } else if (kind === 'crown') {
      x.fillStyle = '#f5c518'; x.strokeStyle = '#8a6a05'; x.lineWidth = R * 0.1;
      x.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, r = i % 2 ? R * 0.78 : R * 1.12; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); x.stroke();
      x.fillStyle = '#e11d48'; for (let i = 0; i < 5; i++) { const a = i * Math.PI * 0.4; x.beginPath(); x.arc(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95, R * 0.1, 0, 6.2832); x.fill(); }
      x.fillStyle = '#fde68a'; x.beginPath(); x.arc(0, 0, R * 0.42, 0, 6.2832); x.fill();
    } else if (kind === 'party') {
      x.fillStyle = '#ec4899'; x.beginPath(); x.arc(0, 0, R * 0.9, 0, 6.2832); x.fill();
      x.strokeStyle = '#facc15'; x.lineWidth = R * 0.16; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; x.beginPath(); x.moveTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2); x.lineTo(Math.cos(a) * R * 0.85, Math.sin(a) * R * 0.85); x.stroke(); }
      x.fillStyle = '#fff'; x.beginPath(); x.arc(0, 0, R * 0.22, 0, 6.2832); x.fill();
    } else if (kind === 'tophat') {
      x.fillStyle = '#111827'; x.beginPath(); x.arc(0, 0, R * 1.2, 0, 6.2832); x.fill();
      x.fillStyle = '#1f2937'; x.beginPath(); x.arc(0, 0, R * 0.78, 0, 6.2832); x.fill();
      x.strokeStyle = '#dc2626'; x.lineWidth = R * 0.14; x.beginPath(); x.arc(0, 0, R * 0.78, 0, 6.2832); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.arc(-R * 0.2, -R * 0.2, R * 0.25, 0, 6.2832); x.fill();
    } else if (kind === 'beret') {
      x.fillStyle = '#b91c1c'; ell(x, -R * 0.08, R * 0.1, R * 1.15, R * 1.0, 0.25); x.fill(); x.strokeStyle = '#7f1d1d'; x.lineWidth = R * 0.08; x.stroke();
      x.fillStyle = '#7f1d1d'; x.beginPath(); x.arc(0, 0, R * 0.12, 0, 6.2832); x.fill();
    } else if (kind === 'santa') {
      x.fillStyle = '#dc2626'; x.beginPath(); x.arc(-R * 0.05, 0, R * 1.05, 0, 6.2832); x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = R * 0.3; x.beginPath(); x.arc(-R * 0.05, 0, R * 0.92, 0.9, 5.4); x.stroke();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(-R * 0.85, 0, R * 0.26, 0, 6.2832); x.fill();
    }
    x.restore();
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
    smg:      { len: 1.6, fore: 1.0 },
    rifle:    { len: 2.7, fore: 1.6 },
    revolver: { len: 1.4, fore: 0.8 },
    crossbow: { len: 1.9, fore: 1.1 },
  };
  // Degradados que dan volumen (brillo en el centro, borde oscuro): se usan en todas las piezas
  const MET = [[0, '#0a0c11'], [0.3, '#3d4554'], [0.52, '#a3acbb'], [0.74, '#434b5a'], [1, '#0a0c11']];
  const POLY = [[0, '#0b0d12'], [0.45, '#343a47'], [0.6, '#444b5a'], [1, '#0b0d12']];
  const WOOD = [[0, '#2f1a0b'], [0.35, '#9c5f2a'], [0.55, '#bf7b3b'], [0.8, '#8a5223'], [1, '#2f1a0b']];
  const GOLD = [[0, '#6e4f10'], [0.5, '#f6d869'], [1, '#6e4f10']];
  const OLIVE = [[0, '#1c260f'], [0.5, '#56772f'], [1, '#1c260f']];
  const GLASS = [[0, '#04060a'], [0.4, '#2d3646'], [0.6, '#566277'], [1, '#04060a']];
  const STEELB = [[0, '#6b7280'], [0.5, '#f3f4f6'], [1, '#6b7280']];

  function gun(x, type, u, glow) {
    // 0.9.9: si está el dibujo del arma de verdad (de perfil, a partir de un modelo 3D), se usa ese
    const A3 = App.Art3, gm = App.GUNMETA && App.GUNMETA[type];
    if (A3 && gm && GUNS[type]) {
      const im = A3.imgs['gun_' + type];
      if (A3.ok(im)) {
        const L = (GUNS[type].len + 0.3) * u, sc = L / gm.len, W = gm.w * sc, H = gm.h * sc;
        x.drawImage(im, -0.3 * u - 0.02 * sc, -H * 0.3, W, H);
        return;
      }
    }
    const lw = Math.max(0.6, u * 0.05);
    const G = (cy, w, stops) => { const g = x.createLinearGradient(0, (cy - w / 2) * u, 0, (cy + w / 2) * u); for (const [o, c] of stops) g.addColorStop(o, c); return g; };
    const box = (a, b, cy, w, stops, rad = 0.06) => {
      x.fillStyle = G(cy, w, stops); x.beginPath(); x.roundRect(a * u, (cy - w / 2) * u, (b - a) * u, w * u, rad * u); x.fill();
      x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = lw; x.stroke();
    };
    const dot = (px, py, r, c) => { x.fillStyle = c; x.beginPath(); x.arc(px * u, py * u, Math.max(0.5, r * u), 0, 6.2832); x.fill(); };
    const line = (a, b, c, d, col, w = 0.04) => { x.strokeStyle = col; x.lineWidth = Math.max(0.6, w * u); x.lineCap = 'round'; x.beginPath(); x.moveTo(a * u, b * u); x.lineTo(c * u, d * u); x.stroke(); };
    const dark = 'rgba(0,0,0,.6)', hi = 'rgba(255,255,255,.45)';

    switch (type) {
      case 'pistol':
        box(-0.05, 0.5, 0, 0.36, POLY, 0.1);                         // empuñadura y armazón
        box(0.12, 1.05, 0, 0.29, MET, 0.1);                          // corredera
        for (let i = 0; i < 4; i++) line(0.16 + i * 0.07, -0.11, 0.16 + i * 0.07, 0.11, dark, 0.03);   // estrías
        line(0.5, 0.05, 0.75, 0.05, dark, 0.05);                     // ventana de expulsión
        line(0.14, -0.1, 1.0, -0.1, hi, 0.025);                      // brillo
        dot(1.04, 0, 0.05, '#000'); box(0.95, 1.0, 0, 0.09, STEELB, 0.02);   // boca y mira
        break;
      case 'smg':
        box(-0.15, 0.4, 0, 0.3, POLY, 0.1); box(0.35, 1.15, 0, 0.34, POLY, 0.08);
        for (let i = 0; i < 4; i++) line(0.5 + i * 0.1, -0.13, 0.5 + i * 0.1, 0.13, dark, 0.03);
        box(0.6, 0.9, 0.3, 0.22, MET, 0.04); box(1.1, 1.6, 0, 0.11, MET, 0.03); box(1.5, 1.62, 0, 0.19, MET, 0.02);
        line(0.4, -0.15, 1.1, -0.15, hi, 0.025);
        break;
      case 'rifle':
        box(-0.3, 0.55, 0, 0.34, POLY, 0.1);                         // culata
        box(0.5, 1.5, 0, 0.34, POLY, 0.06);                          // cuerpo
        box(0.85, 1.15, 0.27, 0.24, MET, 0.04);                      // cargador curvo
        box(0.9, 1.35, -0.02, 0.18, GLASS, 0.06); dot(1.34, -0.02, 0.07, '#7dd3fc');   // mira
        box(1.5, 2.25, 0, 0.26, [[0, '#2b2f3a'], [0.5, '#5b6270'], [1, '#2b2f3a']], 0.05);   // guardamanos
        box(2.25, 2.72, 0, 0.1, MET, 0.03); box(2.62, 2.74, 0, 0.18, MET, 0.02);
        line(0.55, -0.15, 1.45, -0.15, hi, 0.025);
        break;
      case 'revolver':
        box(-0.05, 0.5, 0, 0.3, WOOD, 0.12);                         // empuñadura de madera
        box(0.4, 0.95, 0, 0.3, MET, 0.05);                           // armazón
        x.fillStyle = G(0, 0.42, MET); x.beginPath(); x.arc(0.62 * u, 0, 0.23 * u, 0, 6.2832); x.fill(); x.strokeStyle = dark; x.lineWidth = lw; x.stroke();   // tambor
        for (let i = 0; i < 6; i++) { const a = i * 1.047; dot(0.62 + Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.03, '#05070b'); }
        box(0.9, 1.4, 0, 0.14, MET, 0.04); dot(1.38, 0, 0.04, '#e5e7eb');
        break;
      case 'crossbow':
        box(-0.2, 0.9, 0, 0.26, WOOD, 0.1);                          // culata
        box(0.8, 1.95, 0, 0.12, MET, 0.03);                          // riel
        box(1.55, 1.68, 0, 1.4, [[0, '#1f2937'], [0.5, '#4b5563'], [1, '#1f2937']], 0.05);   // brazos del arco
        line(1.62, -0.68, 1.0, 0, '#e5e7eb', 0.03); line(1.62, 0.68, 1.0, 0, '#e5e7eb', 0.03);   // cuerda
        line(1.0, 0, 1.9, 0, '#cbd5e1', 0.045);                      // flecha apoyada
        break;
      case 'knife': {
        box(0, 0.36, 0, 0.25, [[0, '#120b04'], [0.5, '#6a4521'], [1, '#120b04']], 0.1);   // mango
        dot(0.1, 0, 0.035, '#d1d5db'); dot(0.26, 0, 0.035, '#d1d5db');
        box(0.34, 0.42, 0, 0.5, MET, 0.03);                          // guarda
        x.fillStyle = G(0, 0.28, STEELB); x.beginPath();             // hoja
        x.moveTo(0.42 * u, -0.14 * u); x.lineTo(0.98 * u, -0.11 * u); x.lineTo(1.16 * u, 0.03 * u); x.lineTo(0.42 * u, 0.14 * u); x.closePath(); x.fill();
        x.strokeStyle = dark; x.lineWidth = lw; x.stroke();
        line(0.48, -0.02, 0.98, -0.01, 'rgba(0,0,0,.35)', 0.035);   // canal
        line(0.44, 0.13, 1.12, 0.035, '#fff', 0.03);                 // filo
        break;
      }
      case 'sniper':
        box(-0.35, 0.95, 0, 0.42, WOOD, 0.14);                       // culata de madera
        box(-0.35, -0.24, 0, 0.44, [[0, '#050505'], [1, '#262626']], 0.05);   // pad
        line(-0.1, -0.14, 0.7, -0.14, 'rgba(255,220,170,.35)', 0.03);
        box(0.85, 1.6, 0, 0.3, MET, 0.05);                           // caja del cerrojo
        line(1.12, 0.14, 1.22, 0.42, '#b6bfcc', 0.06); dot(1.23, 0.45, 0.075, '#dbe3ee');   // manija del cerrojo
        box(1.55, 2.95, 0, 0.14, MET, 0.04);                         // cañón
        for (let i = 0; i < 4; i++) line(1.75 + i * 0.2, -0.05, 1.75 + i * 0.2, 0.05, dark, 0.03);
        box(2.8, 3.04, 0, 0.26, MET, 0.04); line(2.88, -0.12, 2.88, 0.12, dark, 0.03); line(2.97, -0.12, 2.97, 0.12, dark, 0.03);   // freno de boca
        box(0.78, 1.74, -0.01, 0.25, GLASS, 0.12);                   // mira telescópica
        box(1.6, 1.86, -0.01, 0.36, GLASS, 0.12); dot(1.84, -0.01, 0.1, '#7dd3fc'); dot(1.81, -0.04, 0.035, '#fff');   // lente
        box(0.7, 0.82, -0.01, 0.3, GLASS, 0.06);
        box(0.95, 1.03, -0.01, 0.34, MET, 0.02); box(1.45, 1.53, -0.01, 0.34, MET, 0.02);   // anillos
        break;
      case 'lmg':
        box(-0.25, 0.5, 0, 0.36, POLY, 0.1);                         // culata
        box(0.45, 1.1, 0, 0.44, POLY, 0.06);                         // caja
        line(0.62, -0.19, 0.62, 0.19, dark, 0.04); line(0.95, -0.19, 0.95, 0.19, dark, 0.04);
        box(0.6, 1.0, 0.34, 0.34, OLIVE, 0.05);                      // caja de munición
        line(0.65, 0.34, 0.95, 0.34, '#facc15', 0.05);
        box(1.0, 1.78, 0, 0.27, MET, 0.05);                          // funda del cañón
        for (let i = 0; i < 5; i++) { dot(1.1 + i * 0.14, -0.06, 0.03, '#05070b'); dot(1.1 + i * 0.14, 0.06, 0.03, '#05070b'); }
        box(1.76, 2.1, 0, 0.1, MET, 0.03); box(2.0, 2.12, 0, 0.19, MET, 0.03);
        line(1.38, 0.12, 1.8, 0.2, '#9aa3b2', 0.04); line(1.38, -0.12, 1.8, -0.2, '#9aa3b2', 0.04);   // bípode plegado
        line(0.5, -0.2, 1.05, -0.2, hi, 0.025);
        break;
      case 'shotgun':
        box(-0.25, 0.72, 0, 0.42, WOOD, 0.14);                       // culata
        line(-0.2, -0.15, 0.6, -0.15, 'rgba(255,220,170,.35)', 0.03);
        box(0.65, 1.25, 0, 0.34, MET, 0.05); box(0.78, 1.0, 0, 0.1, [[0, '#000'], [1, '#222']], 0.03);   // caja y ventana
        box(1.2, 2.2, 0, 0.15, MET, 0.04);                           // cañón
        box(1.2, 2.0, 0.2, 0.1, MET, 0.04);                          // tubo cargador
        box(1.3, 1.85, 0.07, 0.4, WOOD, 0.12);                       // corredera de madera
        for (let i = 0; i < 4; i++) line(1.42 + i * 0.1, -0.1, 1.42 + i * 0.1, 0.24, 'rgba(0,0,0,.45)', 0.03);
        dot(2.17, 0, 0.04, '#fde68a');
        break;
      case 'ashotgun':
        box(-0.25, 0.55, 0, 0.36, POLY, 0.1);
        box(0.5, 1.5, 0, 0.42, POLY, 0.08);                          // cuerpo
        for (let i = 0; i < 5; i++) line(1.0 + i * 0.09, -0.16, 1.0 + i * 0.09, 0.16, dark, 0.03);   // ventilación
        x.fillStyle = '#1a1f29'; x.beginPath(); x.arc(0.95 * u, 0.32 * u, 0.36 * u, 0, 6.2832); x.fill();   // tambor
        x.strokeStyle = '#7b8494'; x.lineWidth = lw * 1.5; x.stroke();
        x.fillStyle = '#323a49'; x.beginPath(); x.arc(0.95 * u, 0.32 * u, 0.22 * u, 0, 6.2832); x.fill();
        for (let i = 0; i < 6; i++) { const a = i * 1.0472; dot(0.95 + Math.cos(a) * 0.14, 0.32 + Math.sin(a) * 0.14, 0.04, '#0b0d12'); }
        box(1.45, 2.1, 0, 0.19, MET, 0.04); line(1.5, -0.02, 2.05, -0.02, '#e5e7eb', 0.03);
        box(2.0, 2.13, 0, 0.26, MET, 0.03);
        break;
      case 'hmg':
        box(-0.25, 0.5, 0, 0.44, POLY, 0.1);                         // culata
        box(0.42, 1.3, 0, 0.56, [[0, '#07080c'], [0.5, '#3a4150'], [1, '#07080c']], 0.06);   // caja
        line(0.6, -0.22, 0.6, 0.22, dark, 0.04); line(1.1, -0.22, 1.1, 0.22, dark, 0.04); line(0.5, -0.25, 1.25, -0.25, hi, 0.03);
        box(0.55, 1.15, 0.54, 0.46, OLIVE, 0.05); line(0.62, 0.45, 1.08, 0.45, '#cbd5c0', 0.04);   // caja de munición
        for (let k = 0; k < 6; k++) { x.save(); x.translate((0.7 + k * 0.1) * u, (0.3 - k * 0.04) * u); x.rotate(-0.5); box(-0.09, 0.09, 0, 0.14, GOLD, 0.03); x.restore(); }   // cinta de balas
        box(1.25, 2.05, 0, 0.36, MET, 0.06);                         // funda perforada
        for (let i = 0; i < 6; i++) { dot(1.36 + i * 0.12, -0.08, 0.035, '#05070b'); dot(1.36 + i * 0.12, 0.08, 0.035, '#05070b'); }
        box(2.0, 2.42, 0, 0.14, MET, 0.03); box(2.3, 2.46, 0, 0.26, MET, 0.03);
        box(0.85, 1.2, -0.38, 0.09, MET, 0.03);                      // manija de transporte
        line(1.7, 0.18, 2.05, 0.46, '#9aa3b2', 0.05); line(1.7, -0.18, 2.05, -0.46, '#9aa3b2', 0.05);   // bípode
        break;
      default: break;
    }
    if (glow) { x.strokeStyle = glow; x.lineWidth = Math.max(1, u * 0.1); x.globalAlpha = 0.9; x.beginPath(); x.roundRect(-0.4 * u, -0.62 * u, (GUNS[type].len + 0.6) * u, 1.24 * u, 0.25 * u); x.stroke(); x.globalAlpha = 1; }
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
    const act = s.act, reach = act && (act.type === 'open' || act.type === 'close' || act.type === 'throw');
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
      if (act.type === 'throw') { x.fillStyle = act.gtype === 'frag' ? '#3f6212' : act.gtype === 'smoke' ? '#9ca3af' : '#fde047'; x.beginPath(); x.arc((0.9 + 1.25 * e) * u + 0.2 * u, 0.05 * u, 0.26 * u, 0, 6.2832); x.fill(); x.strokeStyle = '#111'; x.lineWidth = 1; x.stroke(); }
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
    if (s.armor && s.armor.vest > 0) {                                         // chaleco antibalas
      x.fillStyle = 'rgba(58,70,96,.72)'; ell(x, 0.02 * u, 0, 0.5 * u, 0.86 * u); x.fill(); x.strokeStyle = 'rgba(10,14,24,.7)'; x.lineWidth = Math.max(1, u * 0.07); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.14)'; ell(x, 0.15 * u, -0.25 * u, 0.15 * u, 0.3 * u); x.fill();
    }
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
    x.save(); x.rotate(s.look); x.translate(0.08 * u + Math.cos(s.phase * 2) * 0.03 * u * g, 0); head(x, ap, u);
    if (s.armor && s.armor.helm > 0) {                                         // casco
      x.fillStyle = 'rgba(88,98,118,.92)'; x.beginPath(); x.arc(-0.03 * u, 0, 0.68 * u, 0, 6.2832); x.fill(); x.strokeStyle = 'rgba(10,14,24,.7)'; x.lineWidth = Math.max(1, u * 0.07); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.3)'; ell(x, -0.1 * u, -0.2 * u, 0.22 * u, 0.14 * u); x.fill();
    }
    x.restore();

    if (s.shieldHp > 0) {
      x.strokeStyle = `rgba(56,189,248,${0.55 + Math.sin(time * 8) * 0.3})`; x.lineWidth = Math.max(2, u * 0.25);
      x.beginPath(); x.arc(0, 0, u * 1.75, 0, 6.2832); x.stroke(); x.fillStyle = 'rgba(56,189,248,.12)'; x.fill();
    }
    if (s.flash > 0) { x.fillStyle = `rgba(255,255,255,${Math.min(0.85, s.flash * 5)})`; ell(x, 0, 0, u * 1.1, u * 1.1); x.fill(); }
    x.restore();
  }

  /* ---------- cosas en el piso ---------- */
  const RARITY = { pistol: '#9ca3af', shotgun: '#fb923c', ashotgun: '#f97316', lmg: '#facc15', sniper: '#38bdf8', hmg: '#f43f5e', smg: '#fbbf24', rifle: '#a78bfa', revolver: '#cbd5e1', crossbow: '#34d399' };
  const G2 = (x, u) => { const g = x.createLinearGradient(0, -0.3 * u, 0, 0.3 * u); g.addColorStop(0, '#0b0d12'); g.addColorStop(0.5, '#6b7280'); g.addColorStop(1, '#0b0d12'); return g; };
  /** Los objetos del piso se dibujan una sola vez en una imagen chiquita y después se copian (mucho más liviano). */
  function drawItemCached(x, it, ts, time) {
    const m = x.getTransform(), k = Math.max(0.5, Math.min(2, Math.round(Math.hypot(m.a, m.b) * 2) / 2)), half = ts * 0.9;
    let c = it._spr;
    const ready = !!(App.Art3 && App.Art3.ready());
    if (!c || c.ts !== ts || c.k !== k || c.ready !== ready) {
      const cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil(half * 2 * k);
      const g = cv.getContext('2d'); g.scale(k, k);
      drawItem(g, Object.assign({}, it, { x: half / ts, y: half / ts }), ts, -it.id / 4);
      c = it._spr = { ts, k, cv, ready };
    }
    const p = 1 + Math.sin(time * 4 + it.id) * 0.035;
    x.save(); x.translate(it.x * ts, it.y * ts); x.scale(p, p); x.drawImage(c.cv, -half, -half, half * 2, half * 2); x.restore();
  }
  function drawItem(x, it, ts, time) {
    const u = ts * 0.4, cx = it.x * ts, cy = it.y * ts, pulse = 1 + Math.sin(time * 4 + it.id) * 0.06;
    x.save(); x.translate(cx, cy);
    if (it.kind === 'weapon') {
      const col = RARITY[it.type] || '#fff', len = GUNS[it.type].len;
      x.fillStyle = col; x.globalAlpha = 0.18; x.beginPath(); x.arc(0, 0, u * 1.7 * pulse, 0, 6.2832); x.fill(); x.globalAlpha = 1;
      x.fillStyle = 'rgba(0,0,0,.35)'; ell(x, 0.1 * u, 0.25 * u, len * u * 0.6, 0.45 * u); x.fill();
      x.rotate(it.ang); x.translate(-len * u * 0.45, 0);
      gun(x, it.type, u * 0.95, col);
      if (it.att) { let k = 0; for (const [key, c] of [['sup', '#9ca3af'], ['scope', '#38bdf8'], ['ext', '#facc15']]) if (it.att[key]) { x.fillStyle = c; x.beginPath(); x.arc((len * 0.5 + k * 0.32) * u, 0.62 * u, 0.13 * u, 0, 6.2832); x.fill(); k++; } }
    } else if (it.kind === 'ammo') {
      x.fillStyle = '#4ade80'; x.globalAlpha = 0.18; x.beginPath(); x.arc(0, 0, u * 1.3 * pulse, 0, 6.2832); x.fill(); x.globalAlpha = 1;
      x.rotate(it.ang * 0.3);
      x.fillStyle = '#3f6212'; x.beginPath(); x.roundRect(-0.8 * u, -0.55 * u, 1.6 * u, 1.1 * u, 0.15 * u); x.fill();
      x.strokeStyle = '#a3e635'; x.lineWidth = Math.max(1, u * 0.1); x.stroke();
      x.fillStyle = '#facc15';
      for (let i = -2; i <= 2; i++) { x.beginPath(); x.roundRect((i * 0.28 - 0.08) * u, -0.3 * u, 0.16 * u, 0.6 * u, 0.06 * u); x.fill(); }
    } else if (it.kind === 'gren') {
      const col = it.type === 'frag' ? '#4d7c0f' : it.type === 'smoke' ? '#9ca3af' : '#fde047';
      x.fillStyle = col; x.globalAlpha = 0.2; x.beginPath(); x.arc(0, 0, u * 1.2 * pulse, 0, 6.2832); x.fill(); x.globalAlpha = 1;
      x.fillStyle = 'rgba(0,0,0,.3)'; ell(x, 0.1 * u, 0.2 * u, 0.55 * u, 0.5 * u); x.fill();
      x.fillStyle = col; x.beginPath(); x.arc(0, 0, 0.5 * u, 0, 6.2832); x.fill(); x.strokeStyle = '#111'; x.lineWidth = Math.max(1, u * 0.09); x.stroke();
      if (it.type === 'frag') { x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 1; for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(-0.4 * u, k * 0.2 * u); x.lineTo(0.4 * u, k * 0.2 * u); x.stroke(); } }
      x.fillStyle = '#d4d4d8'; x.beginPath(); x.arc(0.1 * u, -0.5 * u, 0.12 * u, 0, 6.2832); x.fill();
    } else if (it.kind === 'med') {
      const sz = it.type === 'large' ? 1.0 : it.type === 'med' ? 0.8 : 0.62;
      x.fillStyle = '#f472b6'; x.globalAlpha = 0.0; x.globalAlpha = 1;
      x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.roundRect((-0.7 * sz + 0.1) * u, (-0.55 * sz + 0.15) * u, 1.4 * sz * u, 1.1 * sz * u, 0.15 * u); x.fill();
      x.fillStyle = '#f8fafc'; x.beginPath(); x.roundRect(-0.7 * sz * u, -0.55 * sz * u, 1.4 * sz * u, 1.1 * sz * u, 0.15 * u); x.fill(); x.strokeStyle = '#94a3b8'; x.lineWidth = Math.max(1, u * 0.07); x.stroke();
      x.fillStyle = '#dc2626'; x.fillRect(-0.4 * sz * u, -0.12 * sz * u, 0.8 * sz * u, 0.24 * sz * u); x.fillRect(-0.12 * sz * u, -0.4 * sz * u, 0.24 * sz * u, 0.8 * sz * u);
    } else if (it.kind === 'armor') {
      x.fillStyle = 'rgba(0,0,0,.3)'; ell(x, 0.1 * u, 0.2 * u, 0.7 * u, 0.6 * u); x.fill();
      if (it.type === 'vest') {
        x.fillStyle = '#475569'; x.beginPath(); x.roundRect(-0.55 * u, -0.6 * u, 1.1 * u, 1.2 * u, 0.25 * u); x.fill(); x.strokeStyle = '#0f172a'; x.lineWidth = Math.max(1, u * 0.09); x.stroke();
        x.fillStyle = '#cbd5e1'; x.fillRect(-0.5 * u, -0.1 * u, 1.0 * u, 0.12 * u); x.fillStyle = '#1e293b'; x.fillRect(-0.3 * u, -0.5 * u, 0.6 * u, 0.15 * u);
      } else {
        x.fillStyle = '#64748b'; x.beginPath(); x.arc(0, 0, 0.55 * u, Math.PI, 0); x.lineTo(0.62 * u, 0.2 * u); x.lineTo(-0.62 * u, 0.2 * u); x.closePath(); x.fill(); x.strokeStyle = '#0f172a'; x.lineWidth = Math.max(1, u * 0.09); x.stroke();
        x.fillStyle = 'rgba(255,255,255,.3)'; ell(x, -0.2 * u, -0.25 * u, 0.2 * u, 0.1 * u); x.fill();
      }
    } else if (it.kind === 'pack') {
      x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.roundRect(-0.5 * u + 2, -0.6 * u + 3, 1.0 * u, 1.2 * u, 0.3 * u); x.fill();
      x.fillStyle = '#4d5d2a'; x.beginPath(); x.roundRect(-0.55 * u, -0.65 * u, 1.1 * u, 1.3 * u, 0.3 * u); x.fill(); x.strokeStyle = '#1f2a12'; x.lineWidth = Math.max(1, u * 0.09); x.stroke();
      x.fillStyle = '#3a461f'; x.fillRect(-0.4 * u, -0.1 * u, 0.8 * u, 0.5 * u); x.fillStyle = '#d4d4d8'; x.fillRect(-0.08 * u, -0.3 * u, 0.16 * u, 0.2 * u);
    } else if (it.kind === 'attach') {
      x.fillStyle = '#a3e635'; x.globalAlpha = 0.15; x.beginPath(); x.arc(0, 0, u * 1.1 * pulse, 0, 6.2832); x.fill(); x.globalAlpha = 1;
      if (it.type === 'sup') { x.fillStyle = G2(x, u); x.beginPath(); x.roundRect(-0.7 * u, -0.22 * u, 1.4 * u, 0.44 * u, 0.2 * u); x.fill(); x.strokeStyle = '#0b0d12'; x.lineWidth = 1.2; x.stroke(); x.fillStyle = '#05070b'; for (let k = -2; k <= 2; k++) { x.beginPath(); x.arc(k * 0.24 * u, 0, 0.05 * u, 0, 6.2832); x.fill(); } }
      else if (it.type === 'scope') { x.fillStyle = '#1f2937'; x.beginPath(); x.roundRect(-0.7 * u, -0.2 * u, 1.4 * u, 0.4 * u, 0.15 * u); x.fill(); x.strokeStyle = '#0b0d12'; x.lineWidth = 1.2; x.stroke(); x.fillStyle = '#7dd3fc'; x.beginPath(); x.arc(0.55 * u, 0, 0.18 * u, 0, 6.2832); x.fill(); x.fillStyle = '#e5e7eb'; x.fillRect(-0.3 * u, -0.28 * u, 0.1 * u, 0.56 * u); x.fillRect(0.1 * u, -0.28 * u, 0.1 * u, 0.56 * u); }
      else { x.fillStyle = '#374151'; x.beginPath(); x.roundRect(-0.3 * u, -0.7 * u, 0.6 * u, 1.4 * u, 0.1 * u); x.fill(); x.strokeStyle = '#0b0d12'; x.lineWidth = 1.2; x.stroke(); x.fillStyle = '#facc15'; for (let k = -2; k <= 2; k++) { x.beginPath(); x.roundRect(-0.2 * u, k * 0.24 * u - 0.07 * u, 0.4 * u, 0.12 * u, 0.04 * u); x.fill(); } }
    }
    x.restore();
  }

  /* ---------- caído ---------- */
  /** Cuerpo caído. Con `time` se anima la caída (empujado por el tiro) y crece un charco. */
  function drawCorpse(x, c, ts, time) {
    const u = ts * 0.4 * c.ap.build;
    const age = c.t0 != null && time != null ? time - c.t0 : 99, k = Math.min(1, age / 0.45), ease = 1 - (1 - k) * (1 - k);
    const push = (1 - ease) * 0.55, px = (c.x - (c.kx || 0) * push) * ts, py = (c.y - (c.ky || 0) * push) * ts;
    if (c.t0 != null) {                                        // charco que se agranda de a poco
      const r = Math.min(1, age / 3.5) * u * 1.5;
      if (r > 1) { x.fillStyle = 'rgba(110,10,18,.42)'; ell(x, c.x * ts - Math.cos(c.ang) * u * 0.2, c.y * ts - Math.sin(c.ang) * u * 0.2, r * 1.15, r * 0.85, c.ang); x.fill(); }
    }
    x.save(); x.translate(px, py); x.rotate(c.ang - (1 - ease) * 1.1); x.globalAlpha = 0.55 + (1 - ease) * 0.45;
    if (k < 1) x.scale(1 + (1 - ease) * 0.12, 1 + (1 - ease) * 0.12);
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

  return { makeLooks, drawSoldier, drawCorpse, drawDoor, drawItem: drawItemCached, drawItemRaw: drawItem, head, GUNS, RARITY, _: { ell, shade, gun, head } };
})();
