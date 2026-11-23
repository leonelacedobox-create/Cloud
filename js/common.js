/* Código compartido: estado guardado, sonido, utilidades y lista de jugadores. */
'use strict';

const App = (() => {
  const KEY = 'monedaybatalla.v1';
  const MAX_PLAYERS = 10;
  const PALETTE = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#84cc16', '#e5e7eb'];
  const TEAMS = [
    { name: 'Rojo', color: '#ef4444' },
    { name: 'Azul', color: '#3b82f6' },
    { name: 'Verde', color: '#22c55e' },
    { name: 'Amarillo', color: '#eab308' },
  ];

  /* ---------- estado ---------- */
  let nextId = 1;
  const defaults = () => ({
    sound: true,
    theme: 'auto',
    ui: { text: 'normal', cb: false, vib: true, left: false, motion: !matchMedia('(prefers-reduced-motion: reduce)').matches, quality: 'auto', fps: false, tutorialSeen: false },
    players: Array.from({ length: 4 }, (_, i) => newPlayer(i)),
    coin: { mode: 'libre', style: 'clasica', best: 1, leaver: 'winner', totals: { milei: 0, cristina: 0 }, history: [] },
    battle: {
      teamMode: 'ffa', teamCount: 2, lives: 3, map: 'maze', size: 'm',
      powerups: true, zone: true, varied: true, loot: true, speed: 1,
      talk: true, laser: false, friendly: false, volMaster: 100, volShots: 100, customLines: '',
      gear: true, props: true, events: true, customMap: '', mode: 'classic',
      wins: [], winRange: 'week',
    },
  });

  function newPlayer(i) {
    return { id: nextId++, name: '', color: PALETTE[i % PALETTE.length], team: i % 2, pick: null, hits: 0, pers: 'auto', iq: 1 };
  }

  /* ---------- datos guardados: versión, migración y limpieza ---------- */
  const SAVE_V = 4;                                         // 0.9.1
  const ONE = (v, list, d) => (list.includes(v) ? v : d);
  const NUM = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  const STR = (v, max, d = '') => (typeof v === 'string' ? v.slice(0, max) : d);
  const COLOR = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d);
  const PERS_K = ['auto', 'agresivo', 'cauteloso', 'francotirador', 'asesino', 'tactico', 'oportunista', 'berserker', 'cobarde'];
  const MAPS_K = ['maze', 'rooms', 'arena', 'base', 'oficina', 'carcel', 'deposito', 'custom'];
  const MODES_K = ['classic', 'tdm', 'ctf', 'koth', 'bomb', 'waves', 'loot', 'knives'];
  /** Revisa todo lo guardado (de cualquier versión vieja) y arregla lo que esté roto o falte. */
  function migrate(s, d) {
    const out = d;
    out.sound = s.sound !== false; out.theme = ONE(s.theme, ['auto', 'light', 'dark'], 'auto');
    out.ui = Object.assign(d.ui, s.ui && typeof s.ui === 'object' ? s.ui : {});
    out.ui.text = ONE(out.ui.text, ['normal', 'grande', 'enorme'], 'normal'); out.ui.quality = ONE(out.ui.quality, ['auto', 'alta', 'ahorro'], 'auto');
    const c = Object.assign(d.coin, s.coin && typeof s.coin === 'object' ? s.coin : {});
    c.mode = ONE(c.mode, ['libre', 'apuesta', 'temprano'], 'libre'); c.style = ONE(c.style, ['clasica', 'alta', 'trompo', 'loca'], 'clasica');
    c.best = ONE(+c.best, [1, 3, 5, 7], 1); c.leaver = ONE(c.leaver, ['winner', 'loser'], 'winner');
    c.totals = { milei: NUM(c.totals && c.totals.milei, 0, 1e9, 0), cristina: NUM(c.totals && c.totals.cristina, 0, 1e9, 0) };
    c.history = Array.isArray(c.history) ? c.history.filter((h) => h === 'milei' || h === 'cristina').slice(-40) : [];
    out.coin = c;
    const b = Object.assign(d.battle, s.battle && typeof s.battle === 'object' ? s.battle : {});
    b.teamMode = ONE(b.teamMode, ['ffa', 'teams'], 'ffa'); b.teamCount = ONE(+b.teamCount, [2, 3, 4], 2); b.lives = ONE(+b.lives, [1, 2, 3], 3);
    b.map = ONE(b.map, MAPS_K, 'maze'); b.size = ONE(b.size, ['s', 'm', 'l'], 'm'); b.mode = ONE(b.mode, MODES_K, 'classic'); b.speed = ONE(+b.speed, [1, 2, 4], 1);
    b.winRange = ONE(b.winRange, ['week', 'all'], 'week');
    ['volMaster', 'volShots', 'volMusic'].forEach((k) => { if (b[k] != null) b[k] = NUM(+b[k], 0, 100, 100); });
    b.customLines = STR(b.customLines, 400); b.customMap = STR(b.customMap, 6000);
    b.wins = Array.isArray(b.wins) ? b.wins.filter((w) => w && typeof w.t === 'number' && Array.isArray(w.names)).map((w) => ({ t: w.t, names: w.names.filter((n) => typeof n === 'string').slice(0, 10) })).slice(-1000) : [];
    b.betLog = Array.isArray(b.betLog) ? b.betLog.filter((x) => x && typeof x.t === 'number' && typeof x.name === 'string').slice(-500) : [];
    out.battle = b;
    out.hist = s.hist && s.hist.players && typeof s.hist.players === 'object' ? { players: s.hist.players, log: Array.isArray(s.hist.log) ? s.hist.log.slice(0, 80) : [] } : null;
    out.tourn = s.tourn && Array.isArray(s.tourn.parts) && Array.isArray(s.tourn.rounds) && s.tourn.rounds.every(Array.isArray) ? s.tourn : null;
    if (Array.isArray(s.players) && s.players.filter((p) => p && typeof p === 'object').length >= 2) {
      const used = new Set();
      out.players = s.players.filter((p) => p && typeof p === 'object').slice(0, MAX_PLAYERS).map((p, i) => {
        const q = newPlayer(i);
        let id = typeof p.id === 'number' && p.id > 0 && !used.has(p.id) ? p.id : 0;
        if (!id) { id = 1; while (used.has(id)) id++; }
        used.add(id);
        return Object.assign(q, {
          id, name: STR(p.name, 14), color: COLOR(p.color, q.color), team: NUM(+p.team, 0, 3, i % 2) | 0, pick: ONE(p.pick, ['milei', 'cristina'], null),
          hits: NUM(+p.hits, 0, 1e6, 0) | 0, pers: ONE(p.pers, PERS_K, 'auto'), iq: NUM(+p.iq, 0, 3, 1) | 0,
          role: ONE(p.role, ['none', 'asalto', 'medico', 'tirador', 'tanque'], 'none'), hat: typeof p.hat === 'string' ? p.hat : 'none',
          photo: typeof p.photo === 'string' && p.photo.startsWith('data:image/') && p.photo.length < 80000 ? p.photo : null,
          phrases: STR(p.phrases, 300), manual: !!p.manual, bet: typeof p.bet === 'number' ? p.bet : null,
        });
      });
      const ids = new Set(out.players.map((p) => p.id));
      out.players.forEach((p) => { if (p.bet != null && !ids.has(p.bet)) p.bet = null; });
      if (out.players.filter((p) => p.manual).length > 1) out.players.forEach((p, i) => { p.manual = p.manual && i === out.players.findIndex((q) => q.manual); });
    }
    nextId = Math.max(nextId, ...out.players.map((p) => p.id + 1));
    out.v = SAVE_V;
    return out;
  }
  let loadProblem = null;
  function load() {
    const d = defaults();
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { loadProblem = 'storage'; return d; }
    if (!raw) { d.v = SAVE_V; return d; }
    try { return migrate(JSON.parse(raw), d); } catch (e) {
      loadProblem = 'roto';                                  // datos rotos: se guarda una copia por las dudas y se arranca de cero
      try { localStorage.setItem(KEY + '.roto', raw); } catch (e2) { /* sin lugar */ }
      const d2 = defaults(); d2.v = SAVE_V; return d2;
    }
  }

  const state = load();
  let saveTimer = 0, saveWarned = false;
  /** Aviso chiquito abajo de la pantalla. */
  function toast(text, ms = 5000) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = text; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms);
  }
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); saveWarned = false; } catch (e) {
        if (!saveWarned) { saveWarned = true; toast(/quota/i.test(e.name + e.message) ? '⚠️ No hay más lugar para guardar en este celular. Probá sacar algunas fotos de los soldados o borrar el historial.' : '⚠️ No se pudo guardar (¿navegación privada?). Lo que hagas ahora se pierde al cerrar.'); }
      }
    }, 120);
  }

  /* ---------- utilidades ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  function el(tag, props = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') e.className = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const kid of kids.flat()) e.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    return e;
  }

  // Aleatorio criptográfico (0 <= r < 1)
  function rnd() {
    if (window.crypto && crypto.getRandomValues) {
      const a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return a[0] / 4294967296;
    }
    return Math.random();
  }
  const rint = (n) => Math.floor(rnd() * n);
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = rint(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const pname = (p, i) => (p.name && p.name.trim()) || `Jugador ${i + 1}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Conecta un control segmentado (.seg) con un valor. */
  function bindSeg(id, get, set) {
    const root = document.getElementById(id);
    const refresh = () => $$('button', root).forEach((b) => b.classList.toggle('on', String(get()) === b.dataset.v));
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      set(b.dataset.v);
      refresh();
      save();
    });
    refresh();
    return refresh;
  }

  /* ---------- sonido (sintetizado, sin archivos) ---------- */
  let ac = null;
  let masterVol = 1, shotVol = 1;                         // volumen general y de disparos (0..1)
  function setVol(master, shots) { if (master != null) masterVol = master; if (shots != null) shotVol = shots; }
  function ctx() {
    if (!state.sound) return null;
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      return ac;
    } catch (e) { return null; }
  }
  function noiseBuf(a, dur) {
    const b = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  /** Salida con paneo estéreo (-1 izquierda, 1 derecha): los sonidos se ubican según la cámara. */
  function out(a, pan) {
    if (!pan || !a.createStereoPanner) return a.destination;
    const p = a.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(a.destination); return p;
  }
  function tone(freq, dur, { type = 'sine', vol = 0.15, slide = 0, delay = 0, pan = 0 } = {}) {
    const a = ctx(); if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(Math.max(0.0002, vol * masterVol), t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out(a, pan)); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, { vol = 0.2, freq = 1200, q = 1, type = 'bandpass', sweepTo = 0, delay = 0, pan = 0 } = {}) {
    const a = ctx(); if (!a) return;
    const t = a.currentTime + delay;
    const s = a.createBufferSource(); s.buffer = noiseBuf(a, dur);
    const f = a.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = a.createGain(); g.gain.setValueAtTime(Math.max(0.0002, vol * masterVol), t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out(a, pan)); s.start(t); s.stop(t + dur + 0.02);
  }
  const sfx = {
    // el campanilleo metálico de una moneda al caer
    coinRing(vol = 1, delay = 0) {
      [2410, 3320, 4380, 5830].forEach((f, i) => tone(f * (1 + (Math.random() - .5) * .01), 0.9 - i * 0.15, { vol: 0.09 * vol / (1 + i * .5), delay }));
      noise(0.05, { vol: 0.12 * vol, freq: 6000, q: 0.7, type: 'highpass', delay });
    },
    whoosh() { noise(0.45, { vol: 0.16, freq: 400, q: 0.8, sweepTo: 2400 }); },
    clink() { sfx.coinRing(0.35); },
    tick(k = 0) { tone(1500 + k * 260, 0.035, { type: 'square', vol: 0.035 }); },
    pop() { tone(300, 0.08, { type: 'triangle', vol: 0.08 }); tone(620, 0.06, { type: 'triangle', vol: 0.06, delay: 0.04 }); },
    // cada arma suena distinto; si está lejos de la cámara suena más bajo y más sordo
    shot(kind, dist = 0, pan = 0) {
      const far = dist > 12, m = shotVol * (dist < 8 ? 1 : Math.max(0.12, 1 - (dist - 8) / 26));
      if (m <= 0.01) return;
      const lp = far ? { type: 'lowpass' } : {};
      switch (kind) {
        case 'sniper': noise(0.35, { vol: 0.2 * m, freq: far ? 900 : 3200, q: 0.6, sweepTo: 300, pan, ...lp }); tone(140, 0.3, { type: 'sawtooth', vol: 0.09 * m, slide: -90, pan }); break;
        case 'shotgun': case 'ashotgun': noise(0.22, { vol: 0.2 * m, freq: 1200, q: 0.5, type: 'lowpass', sweepTo: 150, pan }); tone(110, 0.18, { type: 'square', vol: 0.07 * m, slide: -60, pan }); break;
        case 'lmg': case 'hmg': noise(0.06, { vol: 0.09 * m, freq: far ? 700 : 1800, q: 0.8, sweepTo: 400, pan, ...lp }); tone(kind === 'hmg' ? 140 : 220, 0.06, { type: 'square', vol: 0.05 * m, slide: -80, pan }); break;
        default: noise(0.09, { vol: 0.07 * m, freq: far ? 800 : 2200, q: 0.9, sweepTo: 500, pan, ...lp }); tone(520, 0.08, { type: 'square', vol: 0.03 * m, slide: -300, pan });
      }
    },
    glass(pan = 0, v = 1) { [3800, 5200, 6400].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.05 * v, delay: i * 0.03, pan })); noise(0.18, { vol: 0.1 * v, freq: 5000, q: 0.7, type: 'highpass', pan }); },
    // pasos: suenan distinto según el piso (0 normal, 1 alfombra, 2 metal, 3 grava)
    step(floor = 0, v = 1, pan = 0) {
      v *= 0.8;
      if (floor === 1) noise(0.05, { vol: 0.012 * v, freq: 220, q: 0.7, type: 'lowpass', pan });
      else if (floor === 2) { tone(760 + Math.random() * 160, 0.06, { type: 'triangle', vol: 0.03 * v, pan }); noise(0.04, { vol: 0.03 * v, freq: 3000, q: 1, pan }); }
      else if (floor === 3) noise(0.09, { vol: 0.05 * v, freq: 2300 + Math.random() * 800, q: 0.5, pan });
      else noise(0.05, { vol: 0.035 * v, freq: 360, q: 0.9, type: 'lowpass', pan });
    },
    alarm() { for (let i = 0; i < 4; i++) { tone(660, 0.22, { type: 'square', vol: 0.05, delay: i * 0.44 }); tone(880, 0.22, { type: 'square', vol: 0.05, delay: i * 0.44 + 0.22 }); } },
    hit(pan = 0, v = 1) { noise(0.12, { vol: 0.14 * v, freq: 900, q: 1.2, pan }); tone(180, 0.12, { type: 'sawtooth', vol: 0.06 * v, slide: -90, pan }); },
    boom(pan = 0, v = 1) { noise(0.55, { vol: 0.3 * v, freq: 700, q: 0.7, type: 'lowpass', sweepTo: 80, pan }); tone(90, 0.5, { type: 'sine', vol: 0.2 * v, slide: -60, pan }); },
    pickup() { tone(660, 0.1, { type: 'triangle', vol: 0.1 }); tone(990, 0.16, { type: 'triangle', vol: 0.1, delay: 0.08 }); },
    beep(high) { tone(high ? 880 : 440, high ? 0.35 : 0.15, { type: 'square', vol: 0.07 }); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.12, delay: i * 0.14 })); tone(1047, 0.7, { type: 'triangle', vol: 0.12, delay: 0.6 }); },
  };
  function vibrate(p) { try { if (state.ui.vib !== false && navigator.vibrate) navigator.vibrate(p); } catch (e) { /* nada */ } }

  /* ---------- accesibilidad (0.9) ---------- */
  // paleta segura para daltonismo (Okabe-Ito) y símbolos distintos por equipo
  const TEAM_BASE = TEAMS.map((t) => t.color), TEAM_CB = ['#D55E00', '#0072B2', '#009E73', '#F0E442'], TEAM_SYM = ['●', '▲', '■', '◆'];
  function applyA11y() {
    const u = state.ui, b = document.body;
    b.classList.toggle('txt-l', u.text === 'grande'); b.classList.toggle('txt-xl', u.text === 'enorme');
    b.classList.toggle('lefty', !!u.left); b.classList.toggle('calm', !u.motion); b.classList.toggle('cb', !!u.cb);
    TEAMS.forEach((t, i) => { t.color = u.cb ? TEAM_CB[i] : TEAM_BASE[i]; t.sym = u.cb ? TEAM_SYM[i] : ''; });
  }
  const textK = () => (state.ui.text === 'enorme' ? 1.4 : state.ui.text === 'grande' ? 1.2 : 1);

  /* ---------- pantallas ---------- */
  const screens = {};
  const titles = { menu: 'Moneda y Batalla', coin: 'La Moneda', battle: 'Batalla' };
  let current = 'menu';
  function register(name, hooks) { screens[name] = hooks || {}; }
  function go(name) {
    if (screens[current] && screens[current].leave) screens[current].leave();
    current = name;
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
    $('#btnBack').hidden = name === 'menu';
    $('#topTitle').textContent = titles[name] || '';
    window.scrollTo(0, 0);
    if (screens[name] && screens[name].enter) screens[name].enter();
  }

  const HATS = { none: 'Sin gorro', cowboy: '🤠 Sombrero vaquero', crown: '👑 Corona', party: '🎉 Gorro de fiesta', tophat: '🎩 Galera', beret: '🎨 Boina', santa: '🎅 Gorro de Papá Noel' };
  const audio = { tone, noise, ctx, get master() { return masterVol; } };
  return { toast, get loadProblem() { return loadProblem; }, SAVE_V, applyA11y, textK, audio, HATS, state, save, $, $$, el, rnd, rint, shuffle, pname, esc, bindSeg, sfx, vibrate, go, register, newPlayer, ctx, setVol,
    PALETTE, TEAMS, MAX_PLAYERS, get current() { return current; } };
})();
