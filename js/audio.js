/* Música y voz (0.9). La música se arma en el momento con osciladores (no hay archivos):
   un colchón suave cuando está tranquilo y bombo, bajo, platillos y melodía a medida que sube la tensión.
   La voz usa la síntesis de voz del celular (si la tiene) para los insultos y el relator. */
'use strict';

(() => {
  const { state } = App;
  const B = state.battle;

  /* ================= música ================= */
  const BPM = 112, S16 = 60 / BPM / 4;                       // duración de una semicorchea
  const ROOTS = [57, 53, 48, 55];                             // La menor · Fa · Do · Sol (MIDI)
  const CHORD = { 57: [0, 3, 7], 53: [0, 4, 7], 48: [0, 4, 7], 55: [0, 4, 7] };
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let gain = null, timer = 0, next = 0, step = 0, cur = 0, target = 0, on = false;

  const vol = () => (B.music === false ? 0 : ((B.volMusic == null ? 60 : B.volMusic) / 100) * App.audio.master * 0.55);
  function osc(a, type, f, t, dur, v, filt) {
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + Math.min(0.02, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o.connect(g);
    if (filt) { const f2 = a.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = filt; node = g.connect(f2); node.connect(gain); } else g.connect(gain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  let nbuf = null;
  function hiss(a, t, dur, v, freq, type = 'highpass') {
    if (!nbuf) { nbuf = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = nbuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(gain); s.start(t); s.stop(t + dur + 0.02);
  }
  function kick(a, t, v) {
    const o = a.createOscillator(), g = a.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(gain); o.start(t); o.stop(t + 0.3);
  }
  /** Una semicorchea: qué suena depende de la tensión (0 tranquilo … 1 a todo). */
  function play(a, t, i) {
    const bar = Math.floor(i / 16) % 4, k = i % 16, root = ROOTS[bar], ch = CHORD[root], I = cur;
    if (k === 0) ch.forEach((n) => osc(a, 'triangle', hz(root + n), t, S16 * 16 * 0.98, 0.022 * (0.6 + I * 0.4), 1400));           // colchón
    if (I > 0.22 && (k === 0 || k === 8 || (I > 0.7 && (k === 4 || k === 12)))) kick(a, t, 0.22);
    if (I > 0.4 && (k % 2 === 0 || I > 0.82)) hiss(a, t, 0.04, k % 4 === 2 ? 0.05 : 0.03, 7000);
    if (I > 0.5 && [0, 3, 6, 8, 11, 14].includes(k)) osc(a, 'sawtooth', hz(root - 12 + (k === 11 ? 7 : 0)), t, S16 * 1.6, 0.05, 520);
    if (I > 0.62 && (k === 4 || k === 12)) { hiss(a, t, 0.14, 0.09, 1600, 'bandpass'); osc(a, 'triangle', 190, t, 0.08, 0.05); }
    if (I > 0.84 && k % 2 === 1) osc(a, 'square', hz(root + 12 + ch[(k >> 1) % 3]), t, S16 * 0.9, 0.018, 2600);                  // melodía nerviosa
  }
  function tick() {
    const a = App.audio.ctx(); if (!a || !gain) return;
    cur += (target - cur) * 0.08;
    gain.gain.setTargetAtTime(vol(), a.currentTime, 0.3);
    while (next < a.currentTime + 0.15) { play(a, next, step++); next += S16; }
  }
  const Music = {
    start() {
      if (on || B.music === false) return;
      const a = App.audio.ctx(); if (!a) return;
      gain = a.createGain(); gain.gain.value = 0.0001; gain.connect(a.destination);
      gain.gain.setTargetAtTime(vol(), a.currentTime, 0.8);
      next = a.currentTime + 0.1; step = 0; cur = 0.15; target = 0.2; on = true;
      timer = setInterval(tick, 40);
    },
    stop(fade = 0.6) {
      if (!on) return; on = false; clearInterval(timer);
      const a = App.audio.ctx(), g = gain; gain = null;
      if (a && g) { g.gain.setTargetAtTime(0.0001, a.currentTime, fade / 3); setTimeout(() => { try { g.disconnect(); } catch (e) { /* ya está */ } }, fade * 1000 + 300); }
    },
    set(x) { target = Math.max(0, Math.min(1, x)); },
    get on() { return on; }, get level() { return cur; },
  };

  /* ================= voz ================= */
  let voices = [], lastT = 0;
  const synth = window.speechSynthesis;
  const loadVoices = () => { try { voices = synth.getVoices().filter((v) => /^es/i.test(v.lang)); } catch (e) { voices = []; } };
  if (synth) { loadVoices(); try { synth.onvoiceschanged = loadVoices; } catch (e) { /* nada */ } }
  const Voice = {
    get ok() { return !!synth && typeof SpeechSynthesisUtterance !== 'undefined'; },
    /** Dice una frase. `prio` (relator) corta lo que se esté diciendo; lo demás espera su turno o se descarta. */
    say(text, { pitch = 1, rate = 1.08, prio = false } = {}) {
      if (!B.voice || !this.ok || !state.sound || !text) return false;
      const now = performance.now();
      if (!prio && (synth.speaking || now - lastT < 2500)) return false;
      if (prio && synth.speaking) synth.cancel();
      try {
        const u = new SpeechSynthesisUtterance(text.replace(/[^\p{L}\p{N}\s¡!¿?.,:]/gu, ''));
        u.lang = 'es-AR'; if (voices.length) u.voice = voices.find((v) => /AR|419|US|MX/i.test(v.lang)) || voices[0];
        u.pitch = Math.max(0.1, Math.min(2, pitch)); u.rate = rate;
        u.volume = Math.min(1, App.audio.master);
        synth.speak(u); lastT = now; return true;
      } catch (e) { return false; }
    },
    stop() { try { if (synth) synth.cancel(); } catch (e) { /* nada */ } },
  };

  /* ================= lluvia de fondo (0.9.5) ================= */
  let rainSrc = null, rainGain = null;
  const Rain = {
    start(heavy) {
      if (rainSrc) return; const a = App.audio.ctx(); if (!a) return;
      const len = a.sampleRate * 2, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
      let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = last * 0.6 + w * 0.4; d[i] = last + (Math.random() < 0.0009 ? (Math.random() - 0.5) * 3 : 0); }   // gotas sueltas
      rainSrc = a.createBufferSource(); rainSrc.buffer = buf; rainSrc.loop = true;
      const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = heavy ? 1400 : 2400; f.Q.value = 0.4;
      rainGain = a.createGain(); rainGain.gain.value = 0.0001;
      rainSrc.connect(f).connect(rainGain).connect(a.destination); rainSrc.start();
      rainGain.gain.setTargetAtTime((heavy ? 0.07 : 0.045) * (App.audio.master / 100), a.currentTime, 1.2);
    },
    stop() {
      if (!rainSrc) return; const a = App.audio.ctx(), s = rainSrc, g = rainGain; rainSrc = rainGain = null;
      if (a && g) g.gain.setTargetAtTime(0.0001, a.currentTime, 0.3);
      setTimeout(() => { try { s.stop(); s.disconnect(); } catch (e) { /* ya está */ } }, 1200);
    },
  };
  App.Music = Music; App.Voice = Voice; App.Rain = Rain;
})();
