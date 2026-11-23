/* Editor visual de mapas (0.9.5): se pinta con el dedo sobre una grilla y se guarda en el mismo formato de texto
   que el mapa propio (así se puede copiar, pegar y compartir). Herramientas: pincel, rectángulo, relleno y mover;
   deshacer, partir de un mapa del juego, noche, revisar y hasta 6 mapas guardados. */
'use strict';

App.Editor = (() => {
  const { state, $, el, save, toast } = App;
  const B = state.battle;

  // cada "pintura": el carácter que escribe en el texto, cómo se ve y su nombre
  const PAL = [
    { ch: '#', ic: '🧱', name: 'Pared' },
    { ch: '.', ic: '⬜', name: 'Piso' },
    { ch: 'D', ic: '🚪', name: 'Puerta (entre dos paredes)' },
    { ch: 'W', ic: '🪟', name: 'Ventana (va en la pared)' },
    { ch: 'C', ic: '📦', name: 'Cajón' },
    { ch: 'B', ic: '🛢️', name: 'Barril explosivo' },
    { ch: 'T', ic: '🪑', name: 'Mesa (se da vuelta)' },
    { ch: 'L', ic: '💡', name: 'Lámpara' },
    { ch: '>', ic: '➡️', name: 'Cinta transportadora (tocá otra vez para girarla)', conv: true },
    { ch: 'c', ic: '🟥', name: 'Alfombra (silenciosa)' },
    { ch: 'm', ic: '⬛', name: 'Metal (ruidoso)' },
    { ch: 'g', ic: '🟫', name: 'Grava' },
    { ch: 'o', ic: '🌑', name: 'Zona oscura' },
  ];
  const CONV = ['>', 'v', '<', '^'];
  const MODES = [{ k: 'brush', ic: '✏️', name: 'Pincel' }, { k: 'rect', ic: '▭', name: 'Rectángulo' }, { k: 'fill', ic: '🪣', name: 'Relleno' }, { k: 'pan', ic: '✋', name: 'Mover' }];
  const FLOORC = { '.': '#2a3350', c: '#5b2d3a', m: '#3d4a5e', g: '#4a4236', o: '#161b2b' };
  const MAX_SLOTS = 6;

  let modal = null, cv = null, ctx = null, grid = [], W = 25, H = 37, cell = 14, night = false;
  let paintCh = '#', convK = 0, mode = 'brush', undo = [], drag = null, preview = null;

  /* ---------- texto <-> grilla ---------- */
  function fromText(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').filter((l) => l.length);
    night = lines.some((l) => l.includes('N'));
    H = Math.max(9, Math.min(61, lines.length || 37)); W = Math.max(9, Math.min(61, Math.max(...lines.map((l) => l.length), 9)));
    grid = [];
    for (let y = 0; y < H; y++) { const row = []; for (let x = 0; x < W; x++) { let ch = (lines[y] || '')[x] || '#'; if (ch === 'N') ch = '.'; row.push(ch); } grid.push(row); }
    border();
  }
  function toText() {
    const rows = grid.map((r) => r.slice());
    if (night) { outer: for (const f of ['.', 'c', 'm', 'g', 'o']) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (rows[y][x] === f) { rows[y][x] = 'N'; break outer; } }
    return rows.map((r) => r.join('')).join('\n');
  }
  function border() { for (let x = 0; x < W; x++) { grid[0][x] = '#'; grid[H - 1][x] = '#'; } for (let y = 0; y < H; y++) { grid[y][0] = '#'; grid[y][W - 1] = '#'; } }
  /** Un mapa del juego (objeto) pasado a texto, para editarlo. */
  function fromMap(m) {
    W = m.W; H = m.H; grid = [];
    const at = (x, y) => y * W + x, FL = ['.', 'c', 'm', 'g', '.', '.'];
    for (let y = 0; y < H; y++) { const row = []; for (let x = 0; x < W; x++) { const i = at(x, y); row.push(m.g[i] ? '#' : (m.dark[i] ? 'o' : FL[m.floorT[i]] || '.')); } grid.push(row); }
    for (const w of m.windows || []) grid[w.y][w.x] = 'W';
    for (const d of m.doors || []) grid[d.y][d.x] = 'D';
    for (const p of m.props || []) if (!m.g[at(p.x, p.y)]) grid[p.y][p.x] = p.k === 'barrel' ? 'B' : 'C';
    for (const t of m.tables || []) grid[t.y][t.x] = 'T';
    for (const l of m.lamps || []) grid[l.y][l.x] = 'L';
    for (const c of m.conv || []) grid[c.y][c.x] = ' >v<^'[[0, 1, 3, 2, 4][c.d]] || '>';
    night = !!m.night; border();
  }

  /* ---------- dibujo ---------- */
  function draw() {
    if (!ctx) return;
    const c = cell;
    ctx.fillStyle = '#0b0f1c'; ctx.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) drawCell(x, y, grid[y][x]);
    if (preview) for (const [x, y] of preview) { ctx.globalAlpha = 0.6; drawCell(x, y, curCh()); ctx.globalAlpha = 1; }
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x <= W; x++) { ctx.moveTo(x * c + 0.5, 0); ctx.lineTo(x * c + 0.5, H * c); }
    for (let y = 0; y <= H; y++) { ctx.moveTo(0, y * c + 0.5); ctx.lineTo(W * c, y * c + 0.5); }
    ctx.stroke();
    if (night) { ctx.fillStyle = 'rgba(10,14,40,.35)'; ctx.fillRect(0, 0, W * c, H * c); }
  }
  function drawCell(x, y, ch) {
    const c = cell, px = x * c, py = y * c;
    if (ch === '#') { ctx.fillStyle = '#5b6680'; ctx.fillRect(px, py, c, c); ctx.fillStyle = '#7c87a3'; ctx.fillRect(px, py, c, c * 0.25); return; }
    ctx.fillStyle = FLOORC[ch] || FLOORC['.']; ctx.fillRect(px, py, c, c);
    const cx = px + c / 2, cy = py + c / 2;
    if (ch === 'W') { ctx.fillStyle = '#5b6680'; ctx.fillRect(px, py, c, c); ctx.fillStyle = '#7dd3fc'; ctx.fillRect(px + c * 0.15, py + c * 0.3, c * 0.7, c * 0.4); }
    else if (ch === 'D') { ctx.fillStyle = '#c0843f'; ctx.fillRect(px + c * 0.1, py + c * 0.35, c * 0.8, c * 0.3); }
    else if (ch === 'C') { ctx.fillStyle = '#a16207'; ctx.fillRect(px + c * 0.12, py + c * 0.12, c * 0.76, c * 0.76); ctx.strokeStyle = '#713f12'; ctx.lineWidth = Math.max(1, c * 0.08); ctx.strokeRect(px + c * 0.12, py + c * 0.12, c * 0.76, c * 0.76); }
    else if (ch === 'B') { ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(cx, cy, c * 0.36, 0, 7); ctx.fill(); }
    else if (ch === 'T') { ctx.fillStyle = '#8b5a2b'; ctx.fillRect(px + c * 0.08, py + c * 0.25, c * 0.84, c * 0.5); }
    else if (ch === 'L') { ctx.fillStyle = 'rgba(253,224,71,.35)'; ctx.beginPath(); ctx.arc(cx, cy, c * 0.5, 0, 7); ctx.fill(); ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(cx, cy, c * 0.2, 0, 7); ctx.fill(); }
    else if ('><v^'.includes(ch)) {
      ctx.fillStyle = '#1f2937'; ctx.fillRect(px, py, c, c);
      const a = { '>': 0, v: Math.PI / 2, '<': Math.PI, '^': -Math.PI / 2 }[ch];
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.moveTo(c * 0.3, 0); ctx.lineTo(-c * 0.2, -c * 0.25); ctx.lineTo(-c * 0.2, c * 0.25); ctx.fill(); ctx.restore();
    }
  }
  const curCh = () => (PAL.find((p) => p.ch === paintCh) || {}).conv ? CONV[convK] : paintCh;

  /* ---------- pintar ---------- */
  function cellAt(e) {
    const r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / (r.width / W)), y = Math.floor((e.clientY - r.top) / (r.height / H));
    return x >= 0 && y >= 0 && x < W && y < H ? [x, y] : null;
  }
  const inner = (x, y) => x > 0 && y > 0 && x < W - 1 && y < H - 1;
  function put(x, y, ch) { if (inner(x, y)) grid[y][x] = ch; }
  function pushUndo() { undo.push(grid.map((r) => r.slice())); if (undo.length > 40) undo.shift(); }
  function rectCells(a, b) { const out = []; for (let y = Math.min(a[1], b[1]); y <= Math.max(a[1], b[1]); y++) for (let x = Math.min(a[0], b[0]); x <= Math.max(a[0], b[0]); x++) out.push([x, y]); return out; }
  function line(a, b) { const out = [], n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1); for (let k = 0; k <= n; k++) out.push([Math.round(a[0] + (b[0] - a[0]) * k / n), Math.round(a[1] + (b[1] - a[1]) * k / n)]); return out; }
  function fill(x, y, ch) {
    const from = grid[y][x]; if (from === ch || !inner(x, y)) return;
    const st = [[x, y]], seen = new Set();
    while (st.length && seen.size < 4000) { const [cx, cy] = st.pop(), k = cy * W + cx; if (seen.has(k) || !inner(cx, cy) || grid[cy][cx] !== from) continue; seen.add(k); grid[cy][cx] = ch; st.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]); }
  }
  function down(e) {
    if (mode === 'pan') return;
    const c = cellAt(e); if (!c) return;
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    pushUndo();
    if (mode === 'fill') { fill(c[0], c[1], curCh()); draw(); check(); return; }
    drag = { start: c, last: c };
    if (mode === 'brush') { put(c[0], c[1], curCh()); draw(); }
    else { preview = rectCells(c, c); draw(); }
  }
  function move(e) {
    if (!drag) return; const c = cellAt(e); if (!c) return; e.preventDefault();
    if (mode === 'brush') { for (const [x, y] of line(drag.last, c)) put(x, y, curCh()); drag.last = c; draw(); }
    else { preview = rectCells(drag.start, c).filter(([x, y]) => inner(x, y)); draw(); }
  }
  function up() {
    if (!drag) return;
    if (mode === 'rect' && preview) for (const [x, y] of preview) put(x, y, curCh());
    drag = null; preview = null; draw(); check();
  }

  /* ---------- revisar ---------- */
  function check() {
    const msg = modal.querySelector('#edMsg'), m = Maps.parse(toText());
    if (m.error) { msg.className = 'hint maperr'; msg.textContent = '❌ ' + m.error; return false; }
    let placed = 0; for (const r of grid) for (const ch of r) if (ch === 'D') placed++;
    const bad = placed - m.doors.length;
    msg.className = 'hint mapok';
    msg.textContent = `✅ ${W}×${H} · ${m.doors.length} puertas · ${m.props.length} cajones/barriles · ${(m.tables || []).length} mesas · ${(m.lamps || []).length} lámparas${night ? ' · 🌙 de noche' : ''}` + (bad > 0 ? ` · ⚠️ ${bad} puerta(s) mal puesta(s): van entre dos paredes` : '');
    return true;
  }

  /* ---------- armado del panel ---------- */
  function layout() {
    const box = modal.querySelector('.ed-wrap'), avail = Math.max(240, box.clientWidth - 4);
    const z = +(modal.dataset.zoom || 1);
    cell = Math.max(6, Math.floor(avail / W * z));
    cv.width = W * cell; cv.height = H * cell; cv.style.width = W * cell + 'px'; cv.style.height = H * cell + 'px';
    draw();
  }
  function paintPal() {
    modal.querySelectorAll('.ed-pal button').forEach((b) => b.classList.toggle('on', b.dataset.ch === paintCh));
    const p = PAL.find((q) => q.ch === paintCh);
    if (p && p.conv) modal.querySelector(`.ed-pal button[data-ch="${p.ch}"]`).textContent = { '>': '➡️', v: '⬇️', '<': '⬅️', '^': '⬆️' }[CONV[convK]];
    modal.querySelector('#edName').textContent = p ? p.name : '';
    modal.querySelectorAll('.ed-modes button').forEach((b) => b.classList.toggle('on', b.dataset.k === mode));
    cv.style.touchAction = mode === 'pan' ? 'auto' : 'none';
  }
  function slots() { if (!Array.isArray(B.myMaps)) B.myMaps = []; return B.myMaps; }
  function paintSlots() {
    const sel = modal.querySelector('#edSlots'); sel.innerHTML = '';
    sel.append(el('option', { value: '' }, '📂 Mis mapas…'));
    slots().forEach((s, i) => sel.append(el('option', { value: String(i) }, s.name)));
  }
  function build() {
    modal = el('div', { class: 'modal', id: 'editorModal' });
    modal.innerHTML = `
      <div class="modal-box ed-box">
        <div class="card-head"><b>🖌️ Editor de mapas</b><span class="spacer"></span><button class="btn small ghost" id="edClose" aria-label="Cerrar">✖</button></div>
        <div class="ed-modes"></div>
        <div class="ed-pal"></div>
        <p class="hint" id="edName"></p>
        <div class="ed-wrap"><canvas id="edCanvas"></canvas></div>
        <p class="hint" id="edMsg"></p>
        <div class="row-actions">
          <button class="btn small" id="edUndo">↩️ Deshacer</button>
          <button class="btn small" id="edZoom">🔍 Zoom</button>
          <button class="btn small" id="edNight">🌙 Noche</button>
          <button class="btn small ghost" id="edClear">🧽 Vaciar</button>
        </div>
        <div class="row-actions">
          <select id="edFrom" class="sel"><option value="">🗺️ Partir de un mapa…</option></select>
          <select id="edSize" class="sel"><option value="">📐 Tamaño…</option><option value="19x27">Chico 19×27</option><option value="25x37">Medio 25×37</option><option value="31x45">Grande 31×45</option><option value="37x25">Apaisado 37×25</option><option value="45x31">Apaisado grande 45×31</option></select>
        </div>
        <div class="row-actions">
          <select id="edSlots" class="sel"></select>
          <button class="btn small" id="edSaveAs">💾 Guardar como…</button>
          <button class="btn small ghost" id="edDel">🗑️</button>
        </div>
        <div class="row-actions">
          <button class="btn small" id="edCopy">📋 Copiar texto</button>
          <button class="btn primary" id="edUse">✅ Usar este mapa</button>
        </div>
      </div>`;
    document.body.append(modal);
    cv = modal.querySelector('#edCanvas'); ctx = cv.getContext('2d');
    const pal = modal.querySelector('.ed-pal');
    for (const p of PAL) pal.append(el('button', { 'data-ch': p.ch, title: p.name, 'aria-label': p.name, onclick: () => { if (paintCh === p.ch && p.conv) convK = (convK + 1) % 4; paintCh = p.ch; paintPal(); } }, p.ic));
    const md = modal.querySelector('.ed-modes');
    for (const m of MODES) md.append(el('button', { 'data-k': m.k, title: m.name, onclick: () => { mode = m.k; paintPal(); } }, `${m.ic} ${m.name}`));
    const from = modal.querySelector('#edFrom');
    for (const t of Maps.TYPES) if (!['maze', 'rooms', 'arena', 'custom'].includes(t.key)) from.append(el('option', { value: t.key }, t.label));
    from.addEventListener('change', () => {
      if (!from.value) return; pushUndo();
      let s = 1 + Math.floor(Math.random() * 1e6); const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      try { fromMap(Maps.themed(from.value, 12, 18, rng)); } catch (e) { toast('No se pudo cargar ese mapa'); }
      from.value = ''; layout(); check();
    });
    modal.querySelector('#edSize').addEventListener('change', (e) => {
      const v = e.target.value; if (!v) return; pushUndo();
      const [nw, nh] = v.split('x').map(Number), old = grid;
      W = nw; H = nh; grid = [];
      for (let y = 0; y < H; y++) { const r = []; for (let x = 0; x < W; x++) r.push((old[y] && old[y][x]) || '.'); grid.push(r); }
      border(); e.target.value = ''; layout(); check();
    });
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    modal.querySelector('#edClose').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    modal.querySelector('#edUndo').addEventListener('click', () => { const g = undo.pop(); if (g) { grid = g; H = g.length; W = g[0].length; layout(); check(); } });
    modal.querySelector('#edZoom').addEventListener('click', () => { const z = +(modal.dataset.zoom || 1); modal.dataset.zoom = String(z >= 2 ? 1 : z + 0.5); if (z >= 2) mode = mode === 'pan' ? 'brush' : mode; else if (z === 1) toast('Con zoom, usá ✋ Mover para recorrer el mapa'); layout(); paintPal(); });
    modal.querySelector('#edNight').addEventListener('click', () => { night = !night; draw(); check(); });
    modal.querySelector('#edClear').addEventListener('click', () => { pushUndo(); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) grid[y][x] = '.'; border(); draw(); check(); });
    modal.querySelector('#edSlots').addEventListener('change', (e) => { const s = slots()[+e.target.value]; if (s) { pushUndo(); fromText(s.text); layout(); check(); } });
    modal.querySelector('#edSaveAs').addEventListener('click', () => {
      if (!check()) { toast('Arreglá el mapa antes de guardarlo'); return; }
      const name = (prompt('Nombre del mapa:', 'Mi mapa ' + (slots().length + 1)) || '').trim().slice(0, 30); if (!name) return;
      const list = slots(), ix = list.findIndex((s) => s.name === name);
      if (ix >= 0) list[ix].text = toText(); else { if (list.length >= MAX_SLOTS) list.shift(); list.push({ name, text: toText() }); }
      save(); paintSlots(); toast('💾 Guardado: ' + name);
    });
    modal.querySelector('#edDel').addEventListener('click', () => {
      const sel = modal.querySelector('#edSlots'), i = sel.value === '' ? -1 : +sel.value; if (i < 0) { toast('Elegí primero un mapa de la lista'); return; }
      if (!confirm('¿Borrar «' + slots()[i].name + '»?')) return; slots().splice(i, 1); save(); paintSlots();
    });
    modal.querySelector('#edCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(toText()); toast('📋 Copiado: pegalo en un mensaje para compartirlo'); } catch (e) { toast('No se pudo copiar'); } });
    modal.querySelector('#edUse').addEventListener('click', () => {
      if (!check()) { toast('Todavía no sirve: mirá el mensaje en rojo'); return; }
      B.customMap = toText(); B.map = 'custom'; save();
      const ta = $('#customMap'); if (ta) ta.value = B.customMap;
      if (App.onEditorUse) App.onEditorUse();
      close(); toast('✅ Mapa listo: tocá ¡A PELEAR!');
    });
    window.addEventListener('resize', () => { if (modal && !modal.hidden) layout(); });
  }
  function open() {
    if (!modal) build();
    fromText(B.customMap || Maps.SAMPLE); undo = [];
    modal.hidden = false; modal.dataset.zoom = '1'; paintSlots(); paintPal();
    requestAnimationFrame(() => { layout(); check(); });
  }
  function close() { if (modal) modal.hidden = true; }

  return { open, close, fromText, toText, get grid() { return grid; }, PAL };
})();
