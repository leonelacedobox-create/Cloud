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
    players: Array.from({ length: 4 }, (_, i) => newPlayer(i)),
    coin: { mode: 'libre', best: 1, leaver: 'winner', totals: { milei: 0, cristina: 0 }, history: [] },
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

  function load() {
    const d = defaults();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return d;
      const s = JSON.parse(raw);
      const out = Object.assign(d, { sound: s.sound !== false, theme: s.theme || 'auto' });
      out.coin = Object.assign(d.coin, s.coin || {});
      out.battle = Object.assign(d.battle, s.battle || {});
      if (Array.isArray(s.players) && s.players.length >= 2) {
        out.players = s.players.slice(0, MAX_PLAYERS).map((p, i) => Object.assign(newPlayer(i), p, { id: nextId++ }));
      }
      return out;
    } catch (e) { return d; }
  }

  const state = load();
  let saveTimer = 0;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* modo privado */ }
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
  function tone(freq, dur, { type = 'sine', vol = 0.15, slide = 0, delay = 0 } = {}) {
    const a = ctx(); if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(Math.max(0.0002, vol * masterVol), t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, { vol = 0.2, freq = 1200, q = 1, type = 'bandpass', sweepTo = 0, delay = 0 } = {}) {
    const a = ctx(); if (!a) return;
    const t = a.currentTime + delay;
    const s = a.createBufferSource(); s.buffer = noiseBuf(a, dur);
    const f = a.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = a.createGain(); g.gain.setValueAtTime(Math.max(0.0002, vol * masterVol), t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(a.destination); s.start(t); s.stop(t + dur + 0.02);
  }
  const sfx = {
    // el campanilleo metálico de una moneda al caer
    coinRing(vol = 1, delay = 0) {
      [2410, 3320, 4380, 5830].forEach((f, i) => tone(f * (1 + (Math.random() - .5) * .01), 0.9 - i * 0.15, { vol: 0.09 * vol / (1 + i * .5), delay }));
      noise(0.05, { vol: 0.12 * vol, freq: 6000, q: 0.7, type: 'highpass', delay });
    },
    whoosh() { noise(0.45, { vol: 0.16, freq: 400, q: 0.8, sweepTo: 2400 }); },
    clink() { sfx.coinRing(0.35); },
    // cada arma suena distinto; si está lejos de la cámara suena más bajo y más sordo
    shot(kind, dist = 0) {
      const far = dist > 12, m = shotVol * (dist < 8 ? 1 : Math.max(0.12, 1 - (dist - 8) / 26));
      if (m <= 0.01) return;
      const lp = far ? { type: 'lowpass', freq: 900 } : {};
      switch (kind) {
        case 'sniper': noise(0.35, { vol: 0.2 * m, freq: far ? 900 : 3200, q: 0.6, sweepTo: 300, ...(far ? { type: 'lowpass' } : {}) }); tone(140, 0.3, { type: 'sawtooth', vol: 0.09 * m, slide: -90 }); break;
        case 'shotgun': case 'ashotgun': noise(0.22, { vol: 0.2 * m, freq: 1200, q: 0.5, type: 'lowpass', sweepTo: 150 }); tone(110, 0.18, { type: 'square', vol: 0.07 * m, slide: -60 }); break;
        case 'lmg': case 'hmg': noise(0.06, { vol: 0.09 * m, freq: far ? 700 : 1800, q: 0.8, sweepTo: 400, ...(far ? { type: 'lowpass' } : {}) }); tone(kind === 'hmg' ? 140 : 220, 0.06, { type: 'square', vol: 0.05 * m, slide: -80 }); break;
        default: noise(0.09, { vol: 0.07 * m, freq: far ? 800 : 2200, q: 0.9, sweepTo: 500, ...(far ? { type: 'lowpass' } : {}) }); tone(520, 0.08, { type: 'square', vol: 0.03 * m, slide: -300 });
      }
      void lp;
    },
    glass() { [3800, 5200, 6400].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.05, delay: i * 0.03 })); noise(0.18, { vol: 0.1, freq: 5000, q: 0.7, type: 'highpass' }); },
    alarm() { for (let i = 0; i < 4; i++) { tone(660, 0.22, { type: 'square', vol: 0.05, delay: i * 0.44 }); tone(880, 0.22, { type: 'square', vol: 0.05, delay: i * 0.44 + 0.22 }); } },
    hit() { noise(0.12, { vol: 0.14, freq: 900, q: 1.2 }); tone(180, 0.12, { type: 'sawtooth', vol: 0.06, slide: -90 }); },
    boom() { noise(0.55, { vol: 0.3, freq: 700, q: 0.7, type: 'lowpass', sweepTo: 80 }); tone(90, 0.5, { type: 'sine', vol: 0.2, slide: -60 }); },
    pickup() { tone(660, 0.1, { type: 'triangle', vol: 0.1 }); tone(990, 0.16, { type: 'triangle', vol: 0.1, delay: 0.08 }); },
    beep(high) { tone(high ? 880 : 440, high ? 0.35 : 0.15, { type: 'square', vol: 0.07 }); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, { type: 'triangle', vol: 0.12, delay: i * 0.14 })); tone(1047, 0.7, { type: 'triangle', vol: 0.12, delay: 0.6 }); },
  };
  function vibrate(p) { try { if (state.sound && navigator.vibrate) navigator.vibrate(p); } catch (e) { /* nada */ } }

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
  return { HATS, state, save, $, $$, el, rnd, rint, shuffle, pname, esc, bindSeg, sfx, vibrate, go, register, newPlayer, ctx, setVol,
    PALETTE, TEAMS, MAX_PLAYERS, get current() { return current; } };
})();
