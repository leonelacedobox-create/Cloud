/* Ambiente por mapa y música grabada (0.9.6).
   - Ambiente: cada mapa tiene su fondo sonoro armado en el momento (aire acondicionado y teléfonos en la
     oficina, goteras y ecos en la cárcel, viento y chapas en el depósito, radio en la base, trenes en la
     estación, heladeras y lector de códigos en el súper, máquinas en la fábrica…). De noche, grillos.
   - Música: además de la sintetizada, "Battle Theme A" de cynicmusic (CC0). La intensidad sigue a la
     tensión de la partida sin cortes: con poca tensión suena apagada y más baja, en el tiroteo se abre entera.
   Se carga después de sfxbank.js. */
'use strict';

(() => {
  const { state } = App;
  const B = state.battle;
  const Bank = App.Bank;
  const rnd = Math.random;

  /* ================= música grabada ================= */
  let tBuf = null, tLoading = false, tSrc = null, tGain = null, tFilt = null, tOn = false, tTarget = 0.2, tCur = 0.2, tTimer = 0;
  const musicVol = () => (B.music === false ? 0 : ((B.volMusic == null ? 60 : B.volMusic) / 100) * App.audio.master * 0.5);
  function loadTrack(cb) {
    if (tBuf) return cb && cb();
    const a = App.audio.ctx(); if (!a || tLoading) return; tLoading = true;
    const src = (window.SFX_INLINE && window.SFX_INLINE.music_battle) || 'assets/sfx/music_battle.mp3';
    fetch(src).then((r) => r.arrayBuffer()).then((ab) => new Promise((ok, no) => a.decodeAudioData(ab, ok, no)))
      .then((b) => { tBuf = b; tLoading = false; if (cb) cb(); }).catch(() => { tLoading = false; });
  }
  const Track = {
    start() {
      if (tOn || B.music === false) return;
      const a = App.audio.ctx(); if (!a) return;
      tOn = true;
      loadTrack(() => {
        if (!tOn || tSrc) return;
        tSrc = a.createBufferSource(); tSrc.buffer = tBuf; tSrc.loop = true;
        tFilt = a.createBiquadFilter(); tFilt.type = 'lowpass'; tFilt.frequency.value = 900; tFilt.Q.value = 0.5;
        tGain = a.createGain(); tGain.gain.value = 0.0001;
        tSrc.connect(tFilt).connect(tGain).connect(a.destination);
        tSrc.start(0, rnd() * Math.max(1, tBuf.duration - 20));                // arranca en un lugar distinto cada partida
        tTimer = setInterval(() => {
          if (!tGain) return;
          tCur += (tTarget - tCur) * 0.06;
          const t = a.currentTime;
          tFilt.frequency.setTargetAtTime(500 + Math.pow(tCur, 1.4) * 15000, t, 0.4);
          tGain.gain.setTargetAtTime(musicVol() * (0.45 + 0.55 * tCur), t, 0.4);
        }, 120);
      });
    },
    stop(fade = 0.6) {
      tOn = false; clearInterval(tTimer);
      const a = App.audio.ctx(), s = tSrc, g = tGain; tSrc = tGain = tFilt = null;
      if (a && g) g.gain.setTargetAtTime(0.0001, a.currentTime, fade / 3);
      setTimeout(() => { try { if (s) s.stop(); } catch (e) { /* ya está */ } }, fade * 1000 + 300);
    },
    set(x) { tTarget = Math.max(0, Math.min(1, x)); },
    get on() { return tOn; }, get level() { return tCur; },
  };
  // App.Music elige entre la sintetizada y la grabada según el ajuste
  const Synth = App.Music;
  const cur = () => (B.musicStyle === 'tema' ? Track : Synth);
  App.Music = {
    start() { cur().start(); },
    stop(f) { Synth.stop(f); Track.stop(f); },
    set(x) { Synth.set(x); Track.set(x); },
    get on() { return Synth.on || Track.on; }, get level() { return cur().level; },
    preload() { if (B.musicStyle === 'tema') loadTrack(); },
  };

  /* ================= ambiente por mapa ================= */
  let aGain = null, aTimer = 0, aNodes = [], prof = null, nextEv = 0, night = false;
  const ambVol = () => (B.amb === false ? 0 : App.audio.master * 0.5);
  function noiseLoop(a, secs = 2) {
    const b = a.createBuffer(1, a.sampleRate * secs, a.sampleRate), d = b.getChannelData(0);
    let l = 0; for (let i = 0; i < d.length; i++) { l = l * 0.97 + (rnd() * 2 - 1) * 0.03; d[i] = l * 6; }      // ruido "marrón": grave y suave
    const s = a.createBufferSource(); s.buffer = b; s.loop = true; return s;
  }
  /** Un fondo continuo: ruido filtrado (con vaivén lento opcional, como el viento) o un zumbido. */
  function bed(a, { type = 'noise', f = 300, q = 0.7, v = 0.05, lfo = 0, hz = 60 } = {}) {
    const g = a.createGain(); g.gain.value = v; g.connect(aGain);
    let src;
    if (type === 'noise') { src = noiseLoop(a); const fl = a.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q; src.connect(fl).connect(g);
      if (lfo) { const o = a.createOscillator(), og = a.createGain(); o.frequency.value = lfo; og.gain.value = f * 0.6; o.connect(og).connect(fl.frequency); o.start(); aNodes.push(o); } }
    else { src = a.createOscillator(); src.type = 'sine'; src.frequency.value = hz; const o2 = a.createOscillator(); o2.frequency.value = hz * 2; const g2 = a.createGain(); g2.gain.value = 0.35; o2.connect(g2).connect(g); o2.start(); aNodes.push(o2); src.connect(g); }
    src.start(); aNodes.push(src, g);
  }
  const T = (f, dur, o) => App.audio.tone(f, dur, Object.assign({ vol: 0.02 }, o, { vol: (o && o.vol != null ? o.vol : 0.02) * ambVol() / Math.max(0.01, App.audio.master) }));
  const N = (dur, o) => App.audio.noise(dur, Object.assign({}, o, { vol: (o.vol || 0.05) * ambVol() / Math.max(0.01, App.audio.master) }));
  const P = (k, o) => Bank.play(k, Object.assign({ rev: 0.8 }, o, { vol: (o.vol || 0.1) * (B.amb === false ? 0 : 0.5) }));
  const side = () => (rnd() - 0.5) * 1.6;
  // sonidos sueltos de cada lugar (cada uno elige uno de vez en cuando)
  const EV = {
    phone() { for (let r = 0; r < 2; r++) for (let k = 0; k < 8; k++) { T(440, 0.05, { vol: 0.012, delay: r * 0.9 + k * 0.05, pan: 0.5 }); T(480, 0.05, { vol: 0.012, delay: r * 0.9 + k * 0.05 + 0.025, pan: 0.5 }); } },
    printer() { for (let k = 0; k < 6; k++) N(0.12, { vol: 0.03, freq: 1800, q: 3, delay: k * 0.16, pan: -0.4 }); },
    drip() { const p = side(); T(1400 + rnd() * 900, 0.08, { type: 'sine', vol: 0.03, slide: -500, pan: p }); P('tink', { vol: 0.05, r: 0.5 + rnd() * 0.3, pan: p, lp: 1500 }); },
    clank() { P('hit_metal', { vol: 0.12, r: 0.45 + rnd() * 0.2, pan: side(), lp: 1200, rev: 1 }); },
    door() { P('hit_hard', { vol: 0.12, r: 0.5, pan: side(), lp: 900, rev: 1 }); },
    radio() { P('radio', { vol: 0.12, r: 0.8 + rnd() * 0.3, pan: side(), hp: 700, lp: 3000 }); },
    horn() { const p = side(); [311, 392, 466].forEach((f) => T(f, 1.4, { type: 'sawtooth', vol: 0.006, pan: p })); },
    train() { N(5, { vol: 0.06, freq: 220, q: 0.6, type: 'lowpass', sweepTo: 90, pan: side() }); },
    beep() { T(2900, 0.09, { type: 'square', vol: 0.006, pan: side() }); },
    car() { const p = side(); N(2.6, { vol: 0.05, freq: 160, q: 0.8, sweepTo: 600, pan: p }); },
    siren() { for (let k = 0; k < 4; k++) T(700, 0.5, { type: 'triangle', vol: 0.004, slide: 250, delay: k * 0.55 }); },
    press() { P('hit_hard', { vol: 0.18, r: 0.42, lp: 700, rev: 0.9 }); N(0.4, { vol: 0.03, freq: 900, q: 1, delay: 0.1 }); },
    bird() { const p = side(); for (let k = 0; k < 3; k++) T(3200 + rnd() * 800, 0.06, { vol: 0.004, slide: 600, delay: k * 0.09, pan: p }); },
    cricket() { const p = side(); for (let k = 0; k < 6; k++) T(4400, 0.03, { type: 'square', vol: 0.0025, delay: k * 0.07, pan: p }); },
    thunderFar() { N(2.5, { vol: 0.05, freq: 120, q: 0.6, type: 'lowpass', sweepTo: 50 }); },
  };
  // cada mapa: fondos continuos y qué sonidos sueltos tiene
  const PROF = {
    oficina: { beds: [{ f: 260, v: 0.03 }, { type: 'hum', hz: 120, v: 0.004 }], ev: ['phone', 'printer', 'beep'], every: 9 },
    oficina_noche: { beds: [{ f: 260, v: 0.02 }, { type: 'hum', hz: 120, v: 0.003 }], ev: ['phone', 'door'], every: 14 },
    carcel: { beds: [{ f: 180, v: 0.03, lfo: 0.05 }], ev: ['drip', 'drip', 'clank', 'door'], every: 4 },
    deposito: { beds: [{ f: 420, q: 0.5, v: 0.05, lfo: 0.08 }], ev: ['clank', 'clank', 'door'], every: 7 },
    base: { beds: [{ f: 500, q: 0.5, v: 0.045, lfo: 0.06 }], ev: ['radio', 'radio', 'clank'], every: 8 },
    estacion: { beds: [{ f: 160, v: 0.035 }], ev: ['horn', 'train', 'beep'], every: 12 },
    super: { beds: [{ type: 'hum', hz: 100, v: 0.006 }, { f: 300, v: 0.02 }], ev: ['beep', 'beep', 'beep', 'door'], every: 4 },
    estacionamiento: { beds: [{ f: 200, v: 0.035, lfo: 0.04 }], ev: ['car', 'car', 'door'], every: 9 },
    fabrica: { beds: [{ type: 'hum', hz: 90, v: 0.008 }, { f: 700, q: 1.5, v: 0.025 }], ev: ['press', 'press', 'clank'], every: 3.2 },
    complejo: { beds: [{ f: 240, v: 0.04, lfo: 0.03 }], ev: ['car', 'siren', 'bird', 'radio'], every: 10 },
    arena: { beds: [{ f: 600, q: 0.4, v: 0.04, lfo: 0.07 }], ev: ['bird'], every: 8 },
    _: { beds: [{ f: 350, q: 0.5, v: 0.03, lfo: 0.05 }], ev: ['clank', 'door', 'bird'], every: 14 },
  };
  const Amb = {
    start(map, opts = {}) {
      this.stop(0.01);
      if (B.amb === false || !state.sound) return;
      const a = App.audio.ctx(); if (!a) return;
      prof = PROF[map] || PROF._; night = !!opts.night;
      aGain = a.createGain(); aGain.gain.value = 0.0001; aGain.connect(a.destination);
      aGain.gain.setTargetAtTime(ambVol(), a.currentTime, 1.5);
      for (const b of prof.beds) bed(a, b);
      nextEv = a.currentTime + 2 + rnd() * prof.every;
      aTimer = setInterval(() => {
        const a2 = App.audio.ctx(); if (!a2 || !aGain) return;
        if (a2.currentTime >= nextEv) {
          nextEv = a2.currentTime + prof.every * (0.5 + rnd());
          const list = night ? prof.ev.concat(['cricket', 'cricket']) : prof.ev;
          const k = list[Math.floor(rnd() * list.length)]; if (EV[k]) EV[k]();
        }
      }, 500);
    },
    stop(fade = 0.8) {
      clearInterval(aTimer);
      const a = App.audio.ctx(), g = aGain, nodes = aNodes; aGain = null; aNodes = [];
      if (a && g) g.gain.setTargetAtTime(0.0001, a.currentTime, fade / 3);
      setTimeout(() => { for (const n of nodes) { try { if (n.stop) n.stop(); n.disconnect(); } catch (e) { /* ya está */ } } }, fade * 1000 + 400);
    },
    /** Durante la partida: más o menos alto según la tensión (en el tiroteo el ambiente se corre) */
    duck(x) { const a = App.audio.ctx(); if (a && aGain) aGain.gain.setTargetAtTime(ambVol() * (1 - Math.min(0.6, x * 0.6)), a.currentTime, 0.5); },
    PROF,
  };
  App.Amb = Amb;
})();
