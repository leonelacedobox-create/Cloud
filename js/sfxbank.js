/* Banco de sonidos reales (0.9.6). Carga los sonidos grabados de assets/sfx (o los que vienen adentro del
   archivo único) y los toca con paneo, filtro por distancia, variación de tono y eco según el lugar.
   Si un sonido todavía no cargó (o el celular no puede decodificarlo) se usa el sintetizado de antes.
   Fuentes y licencias en CREDITOS.md. Se carga después de audio.js. */
'use strict';

App.Bank = (() => {
  const { sfx, state } = App;
  const KEYS = ['g_pistol', 'g_pistol_far', 'g_shotgun', 'g_shotgun_far', 'g_heavy', 'g_heavy_far', 'g_auto', 'g_auto_far',
    'pump', 'mag_out', 'mag_in', 'shell', 'swap', 'swing', 'stab', 'punch', 'hit_flesh', 'hit_hard', 'hit_metal', 'tink', 'land', 'step',
    'boom', 'boom_far', 'boom_big', 'pain', 'death', 'death2', 'oof', 'pick_item', 'pick_gun', 'power', 'switch', 'radio', 'revive', 'coin', 'ui'];
  const buf = {};
  const playing = {}, stats = {};                          // stats: cuántas veces sonó cada uno (para las pruebas)                                      // cuántas copias de cada sonido suenan a la vez
  let started = false, bus = null, comp = null, conv = null, wet = null, roomWet = 0.12;
  const src = (k) => (window.SFX_INLINE && window.SFX_INLINE[k]) || `assets/sfx/${k}.mp3`;
  const rate = (r, j = 0.05) => r * (1 + (Math.random() - 0.5) * 2 * j);

  /** Respuesta de un cuarto armada con ruido que se apaga (sin archivos): sirve para el eco. */
  function impulse(a, secs, decay) {
    const n = Math.floor(a.sampleRate * secs), b = a.createBuffer(2, n, a.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  function setup(a) {
    comp = a.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    comp.connect(a.destination);
    bus = a.createGain(); bus.connect(comp);
    conv = a.createConvolver(); conv.buffer = impulse(a, 1.4, 3.2);
    wet = a.createGain(); wet.gain.value = roomWet; conv.connect(wet).connect(comp);
  }
  /** Empieza a cargar (se llama con el primer toque, cuando el celular ya deja usar el audio). */
  function load() {
    const a = App.audio.ctx(); if (!a || started) return; started = true;
    setup(a);
    for (const k of KEYS) {
      fetch(src(k)).then((r) => r.arrayBuffer()).then((ab) => new Promise((ok, no) => a.decodeAudioData(ab, ok, no)))
        .then((b) => { buf[k] = b; }).catch(() => { /* queda el sintetizado */ });
    }
  }
  const has = (k) => !!buf[k];
  const ready = () => KEYS.filter(has).length;

  /** Toca un sonido. Devuelve false si no está cargado (para usar el sintetizado). */
  function play(k, { vol = 1, pan = 0, r = 1, lp = 0, hp = 0, delay = 0, rev = 0.3, max = 6, offset = 0 } = {}) {
    const a = App.audio.ctx(); if (!a || !buf[k] || !bus) return false;
    stats[k] = (stats[k] || 0) + 1;
    if ((playing[k] || 0) >= max) return true;                  // ya suenan muchas copias: no se nota una más
    const v = vol * App.audio.master; if (v < 0.004) return true;
    const t = a.currentTime + delay;
    const s = a.createBufferSource(); s.buffer = buf[k]; s.playbackRate.value = r;
    let node = s;
    if (lp) { const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    if (hp) { const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
    const g = a.createGain(); g.gain.value = v; node.connect(g); node = g;
    if (pan && a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); node.connect(p); node = p; }
    node.connect(bus);
    if (rev > 0 && conv) { const sg = a.createGain(); sg.gain.value = rev; node.connect(sg).connect(conv); }
    playing[k] = (playing[k] || 0) + 1;
    s.onended = () => { playing[k]--; };
    s.start(t, offset); return true;
  }
  /** Cuánto eco hay según el lugar donde está la cámara (pasillos y cuartos chicos suenan más). */
  function setRoom(w) {
    roomWet = Math.max(0, Math.min(0.6, w));
    const a = App.audio.ctx(); if (a && wet) wet.gain.setTargetAtTime(roomWet, a.currentTime, 0.4);
  }

  /* ================= los sonidos del juego, ahora grabados ================= */
  const GUN = { pistol: ['g_pistol', 1], revolver: ['g_pistol', 0.78], smg: ['g_auto', 1.22], rifle: ['g_heavy', 1.3], lmg: ['g_auto', 0.88], hmg: ['g_auto', 0.72],
    shotgun: ['g_shotgun', 1], ashotgun: ['g_shotgun', 1.14], sniper: ['g_heavy', 0.86] };
  const shotSynth = sfx.shot, hitSynth = sfx.hit, boomSynth = sfx.boom, stepSynth = sfx.step, pickSynth = sfx.pickup, ringSynth = sfx.coinRing;
  const shotV = () => (App.audio.shots == null ? 1 : App.audio.shots);

  sfx.shot = function (kind, dist = 0, pan = 0, sup = false) {
    const g = GUN[kind];
    if (!g || !has(g[0])) return shotSynth(kind, dist + (sup || kind === 'crossbow' ? 16 : 0), pan);
    const m = shotV() * (dist < 8 ? 1 : Math.max(0.1, 1 - (dist - 8) / 30));
    if (sup) { play(g[0], { vol: 0.22 * m, pan, r: rate(g[1] * 1.5), lp: 1300, rev: 0.1 }); return; }
    const near = Math.max(0, Math.min(1, 1 - (dist - 9) / 8)), big = kind === 'sniper' || kind === 'shotgun' || kind === 'hmg' ? 1.15 : 1;
    const auto = kind === 'smg' || kind === 'lmg' || kind === 'hmg';
    if (near > 0.02) play(g[0], { vol: 0.55 * m * near * big, pan, r: rate(g[1]), rev: 0.25, max: auto ? 4 : 6 });
    if (near < 0.98 && has(g[0] + '_far')) play(g[0] + '_far', { vol: 0.5 * m * (1 - near) * big, pan, r: rate(g[1]), rev: 0.5, max: 4 });
  };
  sfx.hit = function (pan = 0, v = 1) { if (!play('hit_flesh', { vol: 0.5 * v, pan, r: rate(1, 0.12), rev: 0.15 })) hitSynth(pan, v); };
  /** Bala que pega en algo: pared, metal, madera o vidrio. */
  sfx.impact = function (mat, pan = 0, v = 1) {
    if (v < 0.05) return;
    if (mat === 'glass') return sfx.glass(pan, v);
    if (mat === 'metal') { if (!play('hit_metal', { vol: 0.22 * v, pan, r: rate(1.2, 0.15), rev: 0.2, max: 3 })) App.audio.tone(1900, 0.08, { type: 'triangle', vol: 0.03 * v, pan }); return; }
    play('hit_hard', { vol: (mat === 'wood' ? 0.3 : 0.2) * v, pan, r: rate(mat === 'wood' ? 0.8 : 1.25, 0.12), hp: mat === 'wood' ? 0 : 500, rev: 0.2, max: 3 });
  };
  sfx.boom = function (pan = 0, v = 1, big = false) {
    if (!has('boom')) return boomSynth(pan, v);
    if (big && has('boom_big')) play('boom_big', { vol: 0.75 * v, pan, rev: 0.6, max: 2 });
    if (v > 0.35) play('boom', { vol: 0.8 * v, pan, r: rate(0.95), rev: 0.5, max: 3 });
    else play('boom_far', { vol: 1.6 * v, pan, r: rate(0.95), rev: 0.7, max: 3 });
    App.audio.tone(55, 0.6, { type: 'sine', vol: 0.18 * v, slide: -25, pan });            // el golpe grave que se siente en el pecho
  };
  // pasos: el grabado con un toque distinto por piso (0 normal, 1 alfombra, 2 metal, 3 grava, 4 cinta, 5 agua)
  sfx.step = function (floor = 0, v = 1, pan = 0) {
    if (v <= 0.02) return;
    if (!has('step') || floor === 5) return stepSynth(floor === 5 ? 3 : floor, v, pan);
    if (floor === 1) play('step', { vol: 0.07 * v, pan, r: rate(0.75), lp: 700, rev: 0, max: 4 });
    else if (floor === 2 || floor === 4) { play('step', { vol: 0.16 * v, pan, r: rate(1.35), rev: 0.25, max: 4 }); play('tink', { vol: 0.04 * v, pan, r: rate(0.7, 0.1), rev: 0.2, max: 2 }); }
    else if (floor === 3) { play('step', { vol: 0.13 * v, pan, r: rate(0.7), rev: 0.05, max: 4 }); stepSynth(3, v * 0.6, pan); }
    else play('step', { vol: 0.13 * v, pan, r: rate(1, 0.1), rev: 0.15, max: 4 });
  };
  sfx.pickup = function (kind) {
    const k = kind === 'gun' ? 'pick_gun' : kind === 'power' ? 'power' : 'pick_item';
    if (!play(k, { vol: kind === 'gun' ? 0.32 : 0.28, rev: 0.05, max: 2 })) pickSynth();
  };
  sfx.coinRing = function (vol = 1, delay = 0) {
    ringSynth(vol * 0.7, delay);
    play('coin', { vol: 0.32 * vol, r: rate(1, 0.04), delay, rev: 0.15, max: 3 });
  };
  /* ----- nuevos de la 0.9.6 ----- */
  /** Recarga en partes: 'out' (saca el cargador), 'in' (lo mete), 'shell' (un cartucho), 'pump' (corredera/bomba). */
  sfx.reload = function (stage, pan = 0, v = 1, delay = 0) {
    if (v < 0.04) return;
    const k = { out: 'mag_out', in: 'mag_in', shell: 'shell', pump: 'pump' }[stage]; if (!k) return;
    if (!play(k, { vol: 0.3 * v, pan, r: rate(stage === 'pump' ? 1.05 : 1.15, 0.06), rev: 0.15, max: 3, delay })) App.audio.noise(0.06, { vol: 0.05 * v, freq: 2500, q: 2, pan, delay });
  };
  /** Casquillo que cae: suena según el piso (en la alfombra casi nada). */
  sfx.casing = function (floor = 0, pan = 0, v = 1) {
    if (v < 0.05 || floor === 1 || floor === 5) return;
    const t = 0.12 + Math.random() * 0.25, r = floor === 2 || floor === 4 ? 1.5 : floor === 3 ? 0.9 : 1.25;
    if (!play('tink', { vol: (floor === 3 ? 0.04 : 0.08) * v, pan, r: rate(r, 0.15), delay: t, lp: floor === 3 ? 2500 : 0, rev: 0.15, max: 3 }))
      App.audio.tone(3200 + Math.random() * 1500, 0.05, { type: 'triangle', vol: 0.02 * v, delay: t, pan });
  };
  /** Quejido y muerte: cada soldado tiene su tono de voz (pitch). */
  sfx.pain = function (pitch = 1, pan = 0, v = 1) { if (v > 0.05) play(Math.random() < 0.3 ? 'oof' : 'pain', { vol: 0.32 * v, pan, r: rate(pitch, 0.04), rev: 0.2, max: 2 }); };
  sfx.death = function (pitch = 1, pan = 0, v = 1) { if (v > 0.05) play(Math.random() < 0.5 ? 'death' : 'death2', { vol: 0.38 * v, pan, r: rate(pitch, 0.03), rev: 0.35, max: 2 }); };
  sfx.swing = function (pan = 0, v = 1) { if (v > 0.05) play('swing', { vol: 0.3 * v, pan, r: rate(1.2, 0.1), rev: 0.1, max: 3 }); };
  sfx.stab = function (pan = 0, v = 1) { if (v > 0.05) play('stab', { vol: 0.35 * v, pan, r: rate(1.1, 0.1), rev: 0.1, max: 3 }); };
  sfx.swap = function (pan = 0, v = 1) { if (v > 0.05) play('swap', { vol: 0.22 * v, pan, r: rate(1, 0.08), rev: 0.1, max: 2 }); };
  sfx.land = function (pan = 0, v = 1) { if (v > 0.05) play('land', { vol: 0.3 * v, pan, r: rate(0.9, 0.1), rev: 0.15, max: 3 }); };
  sfx.radio = function () { play('radio', { vol: 0.07, r: rate(1.1, 0.06), hp: 600, rev: 0, max: 1 }); };
  sfx.revive = function (pan = 0, v = 1) { if (v > 0.05) play('revive', { vol: 0.3 * v, pan, rev: 0.1, max: 1 }); };
  sfx.click = function () { if (!play('ui', { vol: 0.25, rev: 0, max: 2 })) sfx.tick(); };
  sfx.switchOn = function (pan = 0, v = 1) { play('switch', { vol: 0.3 * v, pan, rev: 0.3, max: 1 }); };
  /** Puerta: madera que cruje y el pestillo; cerrar suena más seco. */
  sfx.door = function (open, pan = 0, v = 1) {
    if (v < 0.05) return;
    if (open) { App.audio.tone(170 + Math.random() * 60, 0.35, { type: 'sawtooth', vol: 0.012 * v, slide: 90, pan }); play('hit_hard', { vol: 0.12 * v, pan, r: rate(0.7), lp: 1800, rev: 0.2, max: 2 }); }
    else play('hit_hard', { vol: 0.3 * v, pan, r: rate(0.6), lp: 1500, rev: 0.3, max: 2 });
  };
  /** Granada que rebota. */
  sfx.bounce = function (pan = 0, v = 1) { if (v > 0.05) play('tink', { vol: 0.1 * v, pan, r: rate(0.55, 0.1), lp: 2000, rev: 0.2, max: 3 }); };

  // la primera vez que se toca la pantalla (el celular recién ahí deja usar el audio) se cargan los sonidos
  const kick = () => { if (state.sound !== false) { load(); if (App.Music && App.Music.preload) App.Music.preload(); } };
  ['pointerdown', 'keydown', 'touchend'].forEach((ev) => window.addEventListener(ev, kick, { passive: true }));

  return { load, play, has, ready, setRoom, KEYS, stats, get room() { return roomWet; } };
})();
