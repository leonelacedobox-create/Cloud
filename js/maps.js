/* Mapas (0.5): temáticos (base, oficina, cárcel, depósito), mapa propio por texto y decoración
   (cajones, barriles, ventanas, pisos y zonas oscuras) para los mapas clásicos.

   Un mapa es: { W, H, g (1 = pared), center, doors:[{x,y,along}], props:[{x,y,k}], windows:[{x,y}],
                 floorT (0 normal, 1 alfombra, 2 metal, 3 grava), dark (1 = oscuro), labels:[{x,y,text}] } */
'use strict';

const Maps = (() => {
  const TYPES = [
    { key: 'maze', label: 'Laberinto', desc: 'Pasillos angostos con vueltas y salas abiertas.' },
    { key: 'rooms', label: 'Habitaciones', desc: 'Cuartos con puertas, ventanas y cajones.' },
    { key: 'arena', label: 'Arena', desc: 'Espacio abierto con cobertura baja y barriles.' },
    { key: 'base', label: 'Base militar', desc: 'Barracas con puertas, patio de grava con sacos de arena y búnkeres oscuros.' },
    { key: 'oficina', label: 'Oficina', desc: 'Escritorios, vidrios entre oficinas, alfombra (silenciosa), cocina y sala de reuniones.' },
    { key: 'carcel', label: 'Cárcel', desc: 'Celdas con barrotes, patio, torre de vigilancia y celdas de castigo oscuras.' },
    { key: 'deposito', label: 'Depósito', desc: 'Estantes largos formando pasillos, muelle de metal ruidoso, barriles y una oficina.' },
    { key: 'complejo', label: 'Complejo', desc: 'Para equipos: edificios con varias entradas, calles con cobertura y dos sitios (A y B) para la bomba.' },
    { key: 'custom', label: '✏️ Propio', desc: 'Un mapa dibujado por vos con texto.' },
  ];
  const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  const tools = (rng) => ({
    rnd: rng,
    rint: (n) => Math.floor(rng() * n),
    shuffle: (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  });

  function blank(W, H) {
    return { W, H, g: new Uint8Array(W * H).fill(1), props: [], windows: [], doors: [], labels: [], floorT: new Uint8Array(W * H), dark: new Uint8Array(W * H), center: [W >> 1, H >> 1] };
  }
  const at = (m, x, y) => y * m.W + x;
  function carve(m, x0, y0, x1, y1, floorT = 0) {
    for (let y = Math.max(0, y0); y <= Math.min(m.H - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(m.W - 1, x1); x++) { m.g[at(m, x, y)] = 0; m.floorT[at(m, x, y)] = floorT; }
  }
  function wall(m, x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.g[at(m, x, y)] = 1; }
  function paint(m, x0, y0, x1, y1, floorT) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!m.g[at(m, x, y)]) m.floorT[at(m, x, y)] = floorT; }
  function darken(m, x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!m.g[at(m, x, y)]) m.dark[at(m, x, y)] = 1; }
  const crate = (m, x, y) => { if (x > 0 && y > 0 && x < m.W - 1 && y < m.H - 1 && !m.g[at(m, x, y)]) m.props.push({ x, y, k: 'crate' }); };
  const barrel = (m, x, y) => { if (x > 0 && y > 0 && x < m.W - 1 && y < m.H - 1 && !m.g[at(m, x, y)]) m.props.push({ x, y, k: 'barrel' }); };
  const addDoor = (m, x, y, along) => { m.g[at(m, x, y)] = 0; m.doors.push({ x, y, along }); };
  const addWindow = (m, x, y) => { m.windows.push({ x, y }); };

  /** Gira un mapa generado "en vertical" para usarlo en pantallas horizontales. */
  function transpose(m) {
    const W = m.H, H = m.W, o = blank(W, H);
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const i = at(m, x, y), j = x * W + y;
      o.g[j] = m.g[i]; o.floorT[j] = m.floorT[i]; o.dark[j] = m.dark[i];
    }
    o.props = m.props.map((p) => ({ x: p.y, y: p.x, k: p.k }));
    o.windows = m.windows.map((p) => ({ x: p.y, y: p.x }));
    o.doors = m.doors.map((d) => ({ x: d.y, y: d.x, along: d.along === 'h' ? 'v' : 'h' }));
    o.labels = m.labels.map((l) => ({ x: l.y, y: l.x, text: l.text }));
    o.center = [m.center[1], m.center[0]];
    return o;
  }

  /** Quita props hasta que todo el piso siga conectado (los cajones no pueden encerrar a nadie). */
  function ensureConnected(m) {
    const W = m.W, H = m.H;
    const blocked = () => { const b = Uint8Array.from(m.g); m.props.forEach((p) => { b[at(m, p.x, p.y)] = 1; }); return b; };
    for (let guard = 0; guard < 60; guard++) {
      const b = blocked();
      let sx = -1, sy = -1, best = 1e9;
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (!b[at(m, x, y)]) { const d = (x - m.center[0]) ** 2 + (y - m.center[1]) ** 2; if (d < best) { best = d; sx = x; sy = y; } }
      if (sx < 0) return;
      const seen = new Uint8Array(W * H), q = [at(m, sx, sy)]; seen[q[0]] = 1;
      for (let i = 0; i < q.length; i++) {
        const cx = q[i] % W, cy = (q[i] / W) | 0;
        D4.forEach(([dx, dy]) => { const k = at(m, cx + dx, cy + dy); if (!b[k] && !seen[k]) { seen[k] = 1; q.push(k); } });
      }
      const lost = [];
      for (let i = 0; i < b.length; i++) if (!b[i] && !seen[i]) lost.push(i);
      if (!lost.length) return;
      // si queda piso aislado: se retira el prop más cercano a esa zona
      const lx = lost[0] % W, ly = (lost[0] / W) | 0;
      let bi = -1, bd = 1e9;
      m.props.forEach((p, i) => { const d = Math.abs(p.x - lx) + Math.abs(p.y - ly); if (d < bd) { bd = d; bi = i; } });
      if (bi < 0) { lost.forEach((i) => { m.g[i] = 1; }); return; }
      m.props.splice(bi, 1);
    }
  }

  /** Reparte cajones y barriles en lugares abiertos (nunca en pasillos ni pegados a una puerta). */
  function scatter(m, T, nCrates, nBarrels, minFree = 7) {
    const W = m.W, H = m.H, taken = new Set(m.props.map((p) => at(m, p.x, p.y)));
    const doorNear = (x, y) => m.doors.some((d) => Math.abs(d.x - x) <= 2 && Math.abs(d.y - y) <= 2);
    const spots = [];
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      if (m.g[at(m, x, y)] || taken.has(at(m, x, y)) || doorNear(x, y)) continue;
      let free = 0; D8.forEach(([dx, dy]) => { if (!m.g[at(m, x + dx, y + dy)]) free++; });
      if (free >= minFree) spots.push([x, y]);
    }
    T.shuffle(spots);
    let c = 0, b = 0;
    for (const [x, y] of spots) {
      if (taken.has(at(m, x, y))) continue;
      if (b < nBarrels && T.rnd() < 0.35) { barrel(m, x, y); taken.add(at(m, x, y)); b++; if (b >= nBarrels && c >= nCrates) break; continue; }
      if (c < nCrates) {
        crate(m, x, y); taken.add(at(m, x, y)); c++;
        const [dx, dy] = D4[T.rint(4)];                                   // a veces forma un grupito de 2
        if (c < nCrates && T.rnd() < 0.55 && !m.g[at(m, x + dx, y + dy)] && !taken.has(at(m, x + dx, y + dy))) { crate(m, x + dx, y + dy); taken.add(at(m, x + dx, y + dy)); c++; }
      }
      if (b >= nBarrels && c >= nCrates) break;
    }
  }

  /** Ventanas en paredes finas que separan dos pasillos o cuartos. */
  function pickWindows(m, T, p, cap = 99) {
    const W = m.W, H = m.H, out = [];
    const used = new Set(m.windows.map((w) => at(m, w.x, w.y)));
    const cands = [];
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      if (!m.g[at(m, x, y)] || used.has(at(m, x, y))) continue;
      const fl = (dx, dy) => !m.g[at(m, x + dx, y + dy)];
      if ((fl(-1, 0) && fl(1, 0) && !fl(0, -1) && !fl(0, 1)) || (fl(0, -1) && fl(0, 1) && !fl(-1, 0) && !fl(1, 0))) {
        if (m.doors.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1)) continue;
        cands.push([x, y]);
      }
    }
    for (const [x, y] of T.shuffle(cands)) {
      if (out.length >= cap) break;
      if (T.rnd() > p) continue;
      if (out.some((w) => Math.abs(w.x - x) + Math.abs(w.y - y) < 2) || m.windows.some((w) => Math.abs(w.x - x) + Math.abs(w.y - y) < 2)) continue;
      out.push({ x, y });
    }
    m.windows.push(...out);
  }

  /* ---------- habitaciones (recursivo) con registro de cuartos y puertas ---------- */
  function divide(m, T, x0, y0, x1, y1, depth, leaves, minSize = 7) {
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if ((w < minSize && h < minSize) || (depth > 0 && T.rnd() < 0.08)) { leaves.push([x0, y0, x1, y1]); return; }
    let horiz = h > w ? true : w > h ? false : T.rnd() < 0.5;
    if (horiz && h < minSize) horiz = false; else if (!horiz && w < minSize) horiz = true;
    if (horiz) {
      const opts = []; for (let y = y0 + 2; y <= y1 - 2; y++) if (y % 2 === 0) opts.push(y);
      if (!opts.length) { leaves.push([x0, y0, x1, y1]); return; }
      const wy = opts[T.rint(opts.length)];
      wall(m, x0, wy, x1, wy);
      const odd = []; for (let x = x0; x <= x1; x++) if (x % 2 === 1) odd.push(x);
      T.shuffle(odd).slice(0, w >= 9 ? 2 : 1).forEach((x) => addDoor(m, x, wy, 'v'));
      divide(m, T, x0, y0, x1, wy - 1, depth + 1, leaves, minSize); divide(m, T, x0, wy + 1, x1, y1, depth + 1, leaves, minSize);
    } else {
      const opts = []; for (let x = x0 + 2; x <= x1 - 2; x++) if (x % 2 === 0) opts.push(x);
      if (!opts.length) { leaves.push([x0, y0, x1, y1]); return; }
      const wx = opts[T.rint(opts.length)];
      wall(m, wx, y0, wx, y1);
      const odd = []; for (let y = y0; y <= y1; y++) if (y % 2 === 1) odd.push(y);
      T.shuffle(odd).slice(0, h >= 9 ? 2 : 1).forEach((y) => addDoor(m, wx, y, 'h'));
      divide(m, T, x0, y0, wx - 1, y1, depth + 1, leaves, minSize); divide(m, T, wx + 1, y0, x1, y1, depth + 1, leaves, minSize);
    }
  }

  /* ================= BASE MILITAR ================= */
  function base(W, H, T) {
    const m = blank(W, H);
    carve(m, 1, 1, W - 2, H - 2);
    const leaves = []; divide(m, T, 1, 1, W - 2, H - 2, 0, leaves, 7);
    const cx = W >> 1, cy = H >> 1, hw = Math.max(5, Math.floor(W * 0.3)), hh = Math.max(4, Math.floor(H * 0.13));
    const x0 = cx - hw, x1 = cx + hw, y0 = cy - hh, y1 = cy + hh;
    carve(m, x0, y0, x1, y1, 3);                                              // patio de grava (ruidoso)
    m.doors = m.doors.filter((d) => !(d.x >= x0 - 1 && d.x <= x1 + 1 && d.y >= y0 - 1 && d.y <= y1 + 1));
    // sacos de arena: filas de 3 cajones; barriles en las esquinas del patio
    const bags = [[x0 + 3, y0 + 2, 'h'], [x1 - 5, y0 + 2, 'h'], [x0 + 3, y1 - 2, 'h'], [x1 - 5, y1 - 2, 'h'], [cx - 1, cy - 1, 'h'], [cx - 1, cy + 1, 'h']];
    bags.forEach(([x, y]) => { for (let k = 0; k < 3; k++) crate(m, x + k, y); });
    [[x0 + 1, y0 + 1], [x1 - 1, y0 + 1], [x0 + 1, y1 - 1], [x1 - 1, y1 - 1]].forEach(([x, y]) => barrel(m, x, y));
    // búnkeres oscuros con piso de metal
    const out = leaves.filter((l) => l[3] < y0 - 1 || l[1] > y1 + 1 || l[2] < x0 - 1 || l[0] > x1 + 1).filter((l) => (l[2] - l[0] + 1) >= 3 && (l[3] - l[1] + 1) >= 3);
    T.shuffle(out).slice(0, 2).forEach((l) => { darken(m, l[0], l[1], l[2], l[3]); paint(m, l[0], l[1], l[2], l[3], 2); m.labels.push({ x: (l[0] + l[2]) / 2 + 0.5, y: (l[1] + l[3]) / 2 + 0.5, text: 'Búnker' }); });
    m.labels.push({ x: cx + 0.5, y: cy + 0.5, text: 'Patio' });
    m.center = [cx, cy];
    pickWindows(m, T, 0.1, 8);
    return m;
  }

  /* ================= COMPLEJO (0.9.4): pensado para equipos, con sitios A y B ================= */
  function complex(W0, H0, T) {
    const land = W0 > H0, W = land ? H0 : W0, H = land ? W0 : H0;
    const m = blank(W, H);
    carve(m, 1, 1, W - 2, H - 2, 3);                                          // calles de grava
    const cols = 2, rows = 3, gx = 3, gy = 3;
    const bw = Math.max(5, Math.floor((W - 2 - gx * (cols + 1)) / cols)), bh = Math.max(4, Math.floor((H - 2 - gy * (rows + 1)) / rows));
    const sites = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x0 = 1 + gx + c * (bw + gx), y0 = 1 + gy + r * (bh + gy), x1 = Math.min(W - 3, x0 + bw - 1), y1 = Math.min(H - 3, y0 + bh - 1);
      if (x1 - x0 < 4 || y1 - y0 < 3) continue;
      wall(m, x0, y0, x1, y0); wall(m, x0, y1, x1, y1); wall(m, x0, y0, x0, y1); wall(m, x1, y0, x1, y1);
      carve(m, x0 + 1, y0 + 1, x1 - 1, y1 - 1, r === 1 ? 2 : 0);               // los del medio con piso de metal
      const mx = (x0 + x1) >> 1, my = (y0 + y1) >> 1;
      const sides = T.shuffle([[mx, y0, 'v'], [mx, y1, 'v'], [x0, my, 'h'], [x1, my, 'h']]).slice(0, r === 1 ? 3 : 2 + T.rint(2));   // 2 a 4 entradas
      sides.forEach(([x, y, a]) => addDoor(m, x, y, a));
      for (let x = x0 + 2; x < x1 - 1; x += 3) if (x !== mx && T.rnd() < 0.5) addWindow(m, x, T.rnd() < 0.5 ? y0 : y1);
      crate(m, x0 + 1, y0 + 1); crate(m, x1 - 1, y1 - 1);
      if (r === 1) { sites.push([mx + 0.5, my + 0.5]); m.labels.push({ x: mx + 0.5, y: y0 + 1.2, text: c === 0 ? 'Sitio A' : 'Sitio B' }); crate(m, mx - 1, my); crate(m, mx + 1, my); }
      else m.labels.push({ x: mx + 0.5, y: my + 0.5, text: ['Taller', 'Garaje', 'Almacén', 'Oficinas'][(r * 2 + c) % 4] });
    }
    scatter(m, T, Math.round(W * H / 90), Math.round(W * H / 400), 6);         // cobertura en las calles
    m.center = [W >> 1, H >> 1];
    m.sites = sites;
    if (!land) return m;
    const o = transpose(m); o.sites = sites.map(([x, y]) => [y, x]); return o;
  }

  /* ================= OFICINA (se genera en vertical y se gira si hace falta) ================= */
  function office(W0, H0, T) {
    const land = W0 > H0, W = land ? H0 : W0, H = land ? W0 : H0;
    const m = blank(W, H), cx = W >> 1;
    const topH = Math.max(7, Math.round(H * 0.2)), botY = H - 1 - Math.max(6, Math.round(H * 0.17));
    carve(m, 1, 1, W - 2, topH, 1);                                           // espacio abierto con escritorios
    carve(m, cx - 1, topH + 1, cx + 1, H - 2, 0);                             // pasillo central
    // oficinas a los costados, separadas del pasillo por un tabique de vidrio
    const rooms = []; let y = topH + 2;
    while (y + 3 <= botY - 2) { const h = 4 + T.rint(2); const y1 = Math.min(y + h - 1, botY - 2); if (y1 - y < 3) break; rooms.push([y, y1]); y = y1 + 2; }
    const names = T.shuffle(['Gerencia', 'Sistemas', 'Fotocopiadora', 'RRHH', 'Contaduría', 'Compras', 'Legales']);
    rooms.forEach(([ya, yb], i) => {
      const ym = (ya + yb) >> 1;
      carve(m, 1, ya, cx - 3, yb, 1); carve(m, cx + 3, ya, W - 2, yb, 1);
      addDoor(m, cx - 2, ym, 'h'); addDoor(m, cx + 2, ym, 'h');
      for (let yy = ya; yy <= yb; yy++) if (yy !== ym && (yy - ya) % 2 === 0) { addWindow(m, cx - 2, yy); addWindow(m, cx + 2, yy); }
      crate(m, 2, ya + 1); crate(m, 3, ya + 1); crate(m, W - 3, yb - 1); crate(m, W - 4, yb - 1);   // escritorios
      m.labels.push({ x: (cx - 3 + 1) / 2 + 0.5, y: ym + 0.5, text: names[(i * 2) % names.length] });
      m.labels.push({ x: (cx + 3 + W - 2) / 2 + 0.5, y: ym + 0.5, text: names[(i * 2 + 1) % names.length] });
    });
    // sala de reuniones (izquierda) y cocina (derecha) al fondo
    carve(m, 1, botY, cx - 3, H - 2, 1); carve(m, cx + 3, botY, W - 2, H - 2, 0);
    const bm = (botY + H - 2) >> 1;
    addDoor(m, cx - 2, bm, 'h'); addDoor(m, cx + 2, bm, 'h');
    for (let yy = botY; yy <= H - 2; yy++) if (yy !== bm && (yy - botY) % 2 === 0) { addWindow(m, cx - 2, yy); addWindow(m, cx + 2, yy); }
    for (let xx = 3; xx <= Math.max(3, cx - 5); xx++) { crate(m, xx, bm - 1); crate(m, xx, bm + 1); }    // mesa larga
    crate(m, W - 3, botY + 1); crate(m, W - 3, botY + 2); crate(m, W - 5, H - 3);                         // mesada de la cocina
    m.labels.push({ x: (cx - 3 + 1) / 2 + 0.5, y: bm + 0.5, text: 'Reuniones' }, { x: (cx + 3 + W - 2) / 2 + 0.5, y: bm + 0.5, text: '☕ Cocina' });
    // espacio abierto: filas de escritorios dobles
    for (let yy = 3; yy <= topH - 2; yy += 4) for (let xx = 2; xx <= W - 5; xx += 5) {
      if (Math.abs(xx + 1 - cx) <= 2 && yy >= topH - 3) continue;
      crate(m, xx, yy); crate(m, xx + 1, yy);
    }
    m.labels.push({ x: W / 2, y: 1.8, text: 'Open Space' });
    m.center = [cx, (topH + botY) >> 1];
    return land ? transpose(m) : m;
  }

  /* ================= CÁRCEL ================= */
  function prison(W0, H0, T) {
    const land = W0 > H0, W = land ? H0 : W0, H = land ? W0 : H0;
    const m = blank(W, H), cx = W >> 1, cy = H >> 1;
    carve(m, 1, 1, W - 2, H - 2, 3);                                          // todo el patio de grava
    // bloques de celdas arriba y abajo
    const band = (yIn0, yIn1, yFront, wallRows) => {
      wall(m, 1, wallRows[0], W - 2, wallRows[1]);
      let i = 0;
      for (let x0 = 2; x0 + 2 <= W - 3; x0 += 4, i++) {
        carve(m, x0, yIn0, x0 + 2, yIn1, 0);
        addDoor(m, x0 + 1, yFront, 'v'); addWindow(m, x0, yFront); addWindow(m, x0 + 2, yFront);
        if (i === 0 || x0 + 6 > W - 3) darken(m, x0, yIn0, x0 + 2, yIn1);                  // celdas de castigo: oscuras
      }
    };
    band(1, 4, 5, [1, 5]);
    band(H - 5, H - 2, H - 6, [H - 6, H - 2]);
    // la fila de pared se rehace: el patio queda entre las dos fachadas
    // torre de vigilancia en el centro (con puerta y ventanas)
    wall(m, cx - 2, cy - 2, cx + 2, cy + 2); carve(m, cx - 1, cy - 1, cx + 1, cy + 1, 0);
    addDoor(m, cx, cy + 2, 'v'); addWindow(m, cx - 2, cy); addWindow(m, cx + 2, cy); addWindow(m, cx, cy - 2);
    crate(m, cx, cy);
    // el patio
    for (let k = 0; k < 4; k++) { crate(m, 3 + k, cy - 5); crate(m, W - 4 - k, cy + 5); }
    barrel(m, 3, cy + 4); barrel(m, W - 4, cy - 4); barrel(m, cx - 5, cy + 3); barrel(m, cx + 5, cy - 3);
    crate(m, cx - 6, cy); crate(m, cx - 6, cy + 1); crate(m, cx + 6, cy); crate(m, cx + 6, cy - 1);
    m.labels.push({ x: cx + 0.5, y: 8, text: 'Patio' }, { x: cx + 0.5, y: 2.5, text: 'Celdas' }, { x: cx + 0.5, y: H - 3, text: 'Celdas' });
    m.center = [cx, cy + 3];
    return land ? transpose(m) : m;
  }

  /* ================= DEPÓSITO ================= */
  function warehouse(W0, H0, T) {
    const land = W0 > H0, W = land ? H0 : W0, H = land ? W0 : H0;
    const m = blank(W, H), cx = W >> 1;
    carve(m, 1, 1, W - 2, H - 2, 2);                                          // piso de metal: se oye mucho
    // oficina del encargado (arriba a la izquierda) con vidrios
    const ow = Math.min(9, (W >> 1) - 1), oh = 6;
    wall(m, 1, 1, ow + 1, oh + 1); carve(m, 2, 2, ow, oh, 1);
    addDoor(m, 4, oh + 1, 'v'); [6, 7, 8].forEach((x) => { if (x < ow) addWindow(m, x, oh + 1); }); addWindow(m, ow + 1, 4);
    crate(m, 3, 3); crate(m, 4, 3);
    // estantes largos con huecos
    for (let y = oh + 4; y <= H - 11; y += 5) {
      let x = 3;
      while (x < W - 4) {
        const len = 6 + T.rint(6);
        for (let k = 0; k < len && x + k < W - 3; k++) { crate(m, x + k, y); crate(m, x + k, y + 1); }
        x += len + 2 + T.rint(2);
      }
    }
    // muelle de carga abajo
    paint(m, 1, H - 8, W - 2, H - 2, 2);
    crate(m, 3, H - 4); crate(m, 4, H - 4); crate(m, W - 4, H - 4); crate(m, W - 5, H - 4); crate(m, cx, H - 6);
    [[3, H - 8], [W - 4, H - 8], [W - 3, 3], [cx + 2, oh + 3]].forEach(([x, y]) => { barrel(m, x, y); barrel(m, x + 1, y); });
    // fondo a oscuras
    darken(m, Math.floor(W * 0.55), 1, W - 2, Math.floor(H * 0.3));
    m.labels.push({ x: cx + 0.5, y: H - 3, text: 'Muelle' }, { x: 6, y: 4, text: 'Oficina' });
    m.center = [cx, H >> 1];
    return land ? transpose(m) : m;
  }

  function themed(type, cols, rows, rng) {
    const W = cols * 2 + 1, H = rows * 2 + 1, T = tools(rng);
    let m;
    if (type === 'base') m = base(W, H, T);
    else if (type === 'oficina') m = office(W, H, T);
    else if (type === 'carcel') m = prison(W, H, T);
    else if (type === 'complejo') m = complex(W, H, T);
    else m = warehouse(W, H, T);
    // Contorno exterior siempre pared
    for (let x = 0; x < m.W; x++) { m.g[at(m, x, 0)] = 1; m.g[at(m, x, m.H - 1)] = 1; }
    for (let y = 0; y < m.H; y++) { m.g[at(m, 0, y)] = 1; m.g[at(m, m.W - 1, y)] = 1; }
    ensureConnected(m);
    return m;
  }

  /** Cajones, barriles, ventanas y pisos para los mapas clásicos. */
  function decorate(m, type, rng) {
    const T = tools(rng);
    m.props = m.props || []; m.windows = m.windows || []; m.doors = m.doors || []; m.labels = m.labels || [];
    m.floorT = m.floorT || new Uint8Array(m.W * m.H); m.dark = m.dark || new Uint8Array(m.W * m.H);
    const area = m.W * m.H;
    if (type === 'maze') { scatter(m, T, Math.round(area / 150), Math.round(area / 330), 7); }
    else if (type === 'rooms') { scatter(m, T, Math.round(area / 70), Math.round(area / 260), 6); pickWindows(m, T, 0.16, 14); }
    else if (type === 'arena') { scatter(m, T, Math.round(area / 55), Math.round(area / 220), 8); for (let i = 0; i < m.floorT.length; i++) if (!m.g[i]) m.floorT[i] = 3; }
    ensureConnected(m);
    return m;
  }

  /* ================= mapa propio (texto) ================= */
  /** #=pared  .=piso  D=puerta  C=cajón  B=barril  W=ventana  c=alfombra  m=metal  g=grava  o=zona oscura */
  const SAMPLE = [
    '#####################',
    '#...................#',
    '#.####D####.####D####',
    '#.#.....#...#......##',
    '#.#.CC..#.B.#..oo..W#',
    '#.#.....D...D..oo..##',
    '#.###W###...####W####',
    '#...................#',
    '#.gggggg..mmmmmm....#',
    '#.g..C..g.m..B.m....#',
    '#.gggggg..mmmmmm....#',
    '#...................#',
    '#####################',
  ].join('\n');

  function parse(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').filter((l) => l.length);
    if (lines.length < 7) return { error: 'El mapa tiene que tener al menos 7 filas.' };
    const W = Math.max(...lines.map((l) => l.length)), H = lines.length;
    if (W < 9 || W > 61 || H > 61) return { error: 'El tamaño va de 9 a 61 columnas y hasta 61 filas.' };
    const m = blank(W, H);
    const floorMap = { c: 1, m: 2, g: 3 };
    lines.forEach((line, y) => {
      for (let x = 0; x < W; x++) {
        const ch = line[x] || '#';
        const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
        if (ch === '#' || edge) continue;
        m.g[at(m, x, y)] = 0;
        if (floorMap[ch]) m.floorT[at(m, x, y)] = floorMap[ch];
        if (ch === 'o') m.dark[at(m, x, y)] = 1;
        if (ch === 'C') m.props.push({ x, y, k: 'crate' });
        if (ch === 'B') m.props.push({ x, y, k: 'barrel' });
        if (ch === 'W') { m.g[at(m, x, y)] = 1; m.windows.push({ x, y }); }
        if (ch === 'D') m.doors.push({ x, y, along: 'h' });
      }
    });
    // la orientación de cada puerta: si tiene paredes arriba y abajo, el pasillo va de izquierda a derecha
    m.doors = m.doors.filter((d) => {
      const up = m.g[at(m, d.x, d.y - 1)], dn = m.g[at(m, d.x, d.y + 1)], lf = m.g[at(m, d.x - 1, d.y)], rt = m.g[at(m, d.x + 1, d.y)];
      if (up && dn && !lf && !rt) { d.along = 'h'; return true; }
      if (lf && rt && !up && !dn) { d.along = 'v'; return true; }
      return false;                                                        // una puerta mal puesta se vuelve piso
    });
    let floors = 0; for (let i = 0; i < m.g.length; i++) if (!m.g[i]) floors++;
    if (floors < 30) return { error: 'El mapa necesita al menos 30 casilleros de piso.' };
    let best = 1e9; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (!m.g[at(m, x, y)]) { const d = (x - W / 2) ** 2 + (y - H / 2) ** 2; if (d < best) { best = d; m.center = [x, y]; } }
    ensureConnected(m);
    return m;
  }

  return { TYPES, SAMPLE, themed, decorate, parse, ensureConnected };
})();
