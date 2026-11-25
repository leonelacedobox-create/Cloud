/* Juego en red por el mismo Wi-Fi (1.1), sin internet ni servidores.
   Cómo se conectan: el anfitrión muestra un QR con los datos de su conexión; el invitado lo escanea con la
   cámara (o le saca una foto, o pega el código) y muestra su propio QR de respuesta, que escanea el anfitrión.
   Listo: los dos celulares quedan conectados directo por el Wi-Fi (WebRTC, sin servidores intermedios).
   Qué se juega: el anfitrión corre la partida; cada invitado maneja su soldado desde su celular (joystick y
   botones) y ve en vivo su propia cámara, que el anfitrión le dibuja y le manda como video. La moneda también
   se comparte: cuando alguien la tira, todos ven la misma tirada.
   Librerías: qrcode-generator (MIT) para dibujar el QR y jsQR (Apache 2.0) para leerlo (js/vendor). */
'use strict';

(() => {
  const { el, $, state, save, toast, vibrate } = App;
  const MAX_GUESTS = 5;
  const PREFIX = 'MB1';
  const RTC = { iceServers: [], bundlePolicy: 'max-bundle' };       // sin servidores: solo la red local

  /* =========================== código del QR =========================== */
  const b64u = {
    enc(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    dec(str) { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; },
  };
  async function pipe(bytes, Stream) { const s = new Blob([bytes]).stream().pipeThrough(new Stream('deflate-raw')); return new Uint8Array(await new Response(s).arrayBuffer()); }
  /** Saca de la descripción de la conexión lo que no hace falta, para que el QR sea chico y fácil de leer. */
  function slim(sdp) {
    return sdp.split(/\r?\n/).filter((l) => l && !/^a=(extmap-allow-mixed|msid-semantic|ice-options)/.test(l) && !(/^a=candidate:/.test(l) && / tcp /i.test(l)))
      .map((l) => (/^a=candidate:/.test(l) ? l.replace(/ generation \d+| network-id \d+| network-cost \d+| ufrag \S+/g, '') : l)).join('\r\n') + '\r\n';
  }
  /* Formato corto: solo lo que hace falta de la descripción (usuario y clave de la conexión, huella de seguridad y
     direcciones en el Wi-Fi); el resto se rearma igual del otro lado. Así el QR queda chico y la cámara lo lee al toque. */
  const hex2b = (h) => new Uint8Array(h.split(':').map((x) => parseInt(x, 16)));
  const b2hex = (b) => Array.from(b, (x) => x.toString(16).toUpperCase().padStart(2, '0')).join(':');
  const SETUP = { actpass: 'x', active: 'a', passive: 'p' }, SETUP_R = { x: 'actpass', a: 'active', p: 'passive' };
  function compact(sdp, name) {
    const get = (re) => { const m = sdp.match(re); return m ? m[1].trim() : null; };
    const u = get(/a=ice-ufrag:(\S+)/), pw = get(/a=ice-pwd:(\S+)/), fp = get(/a=fingerprint:sha-256 ([0-9A-Fa-f:]+)/), st = get(/a=setup:(\w+)/), mid = get(/a=mid:(\S+)/) || '0';
    const port = get(/a=sctp-port:(\d+)/) || '5000', mms = get(/a=max-message-size:(\d+)/) || '262144';
    const cands = [...sdp.matchAll(/a=candidate:\S+ 1 udp (\d+) (\S+) (\d+) typ (\w+)/gi)].map((m) => `${m[2]},${m[3]},${m[1]}${m[4] === 'host' ? '' : ',' + m[4]}`);
    if (!u || !pw || !fp || !SETUP[st] || !cands.length || /[|;,]/.test(u + pw) || !/^m=application /m.test(sdp) || (sdp.match(/^m=/gm) || []).length !== 1) return null;
    return [u, pw, b64u.enc(hex2b(fp)), SETUP[st], cands.join(';'), mid === '0' ? '' : mid, port === '5000' ? '' : port, mms === '262144' ? '' : mms, encodeURIComponent(name || '')].join('|');
  }
  function expand(txt) {
    const [u, pw, fp, st, cs, mid0, port0, mms0, name] = txt.split('|');
    const mid = mid0 || '0';
    const cands = cs.split(';').map((c, i) => { const [a, p, pr, ty] = c.split(','); return `a=candidate:${i + 1} 1 udp ${pr} ${a} ${p} typ ${ty || 'host'}`; });
    const sdp = ['v=0', `o=- ${Date.now()}${Math.floor(Math.random() * 1e6)} 2 IN IP4 127.0.0.1`, 's=-', 't=0 0', `a=group:BUNDLE ${mid}`, 'a=msid-semantic: WMS',
      'm=application 9 UDP/DTLS/SCTP webrtc-datachannel', 'c=IN IP4 0.0.0.0', ...cands, `a=ice-ufrag:${u}`, `a=ice-pwd:${pw}`, `a=fingerprint:sha-256 ${b2hex(b64u.dec(fp))}`,
      `a=setup:${SETUP_R[st] || 'actpass'}`, `a=mid:${mid}`, `a=sctp-port:${port0 || 5000}`, `a=max-message-size:${mms0 || 262144}`].join('\r\n') + '\r\n';
    return { sdp, name: decodeURIComponent(name || '') };
  }
  /** kind: 'O' (oferta del anfitrión) o 'A' (respuesta del invitado). */
  async function encode(kind, sdp, extra) {
    const c = compact(sdp, extra && extra.n);
    if (c) return PREFIX + kind + 'c' + c;
    const txt = JSON.stringify({ s: slim(sdp), ...(extra || {}) });
    const raw = new TextEncoder().encode(txt);
    if (typeof CompressionStream === 'function') { try { return PREFIX + kind + 'z' + b64u.enc(await pipe(raw, CompressionStream)); } catch (e) { /* sin compresión */ } }
    return PREFIX + kind + 'p' + b64u.enc(raw);
  }
  async function decode(code) {
    code = String(code || '').trim().replace(/\s+/g, '');
    if (!code.startsWith(PREFIX) || code.length < 8) throw new Error('Ese código no es de Moneda y Batalla.');
    const kind = code[3], mode = code[4];
    if (mode === 'c') { const e = expand(code.slice(5)); return { kind, sdp: e.sdp, name: e.name, room: '' }; }
    let bytes = b64u.dec(code.slice(5));
    if (mode === 'z') {
      if (typeof DecompressionStream !== 'function') throw new Error('Este navegador es muy viejo para leer el código.');
      bytes = await pipe(bytes, DecompressionStream);
    }
    const o = JSON.parse(new TextDecoder().decode(bytes));
    return { kind, sdp: o.s, name: o.n || '', room: o.r || '' };
  }

  /* =========================== dibujar y leer QR =========================== */
  function drawQR(canvas, text, px = 280) {
    const q = window.qrcode(0, 'L'); q.addData(text, 'Byte'); q.make();
    const n = q.getModuleCount(), quiet = 4, cell = Math.max(2, Math.floor(px / (n + quiet * 2)));
    canvas.width = canvas.height = cell * (n + quiet * 2);
    const x = canvas.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, canvas.width, canvas.height); x.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
    return canvas;
  }
  let detector = null;
  try { if ('BarcodeDetector' in window) detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { detector = null; }
  /** Busca un QR en una imagen/video/canvas. Devuelve el texto o null. */
  async function readQR(src, w, h) {
    if (detector) { try { const r = await detector.detect(src); if (r && r.length) return r[0].rawValue; } catch (e) { /* probamos con jsQR */ } }
    if (!window.jsQR || !w || !h) return null;
    const k = Math.min(1, 900 / Math.max(w, h)), cw = Math.round(w * k), ch = Math.round(h * k);
    const c = readQR.cv || (readQR.cv = document.createElement('canvas')); c.width = cw; c.height = ch;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0, cw, ch);
    const r = window.jsQR(x.getImageData(0, 0, cw, ch).data, cw, ch, { inversionAttempts: 'dontInvert' });
    return r ? r.data : null;
  }
  /** Ventana para leer un QR: cámara en vivo, foto de la galería o pegar el código a mano. */
  function scanner(title, onCode) {
    let stream = null, alive = true, busy = false;
    const video = el('video', { class: 'net-video-scan', playsinline: '', muted: '', autoplay: '' }); video.muted = true;
    const msg = el('p', { class: 'hint center' }, 'Apuntá la cámara al QR del otro celular.');
    const file = el('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
    const text = el('textarea', { class: 'net-code', rows: 3, placeholder: 'O pegá acá el código (empieza con MB1)' });
    const close = () => { alive = false; if (stream) stream.getTracks().forEach((t) => t.stop()); m.remove(); };
    const got = async (code) => {
      if (busy || !alive) return; busy = true;
      try { const d = await decode(code); close(); onCode(d, code); } catch (e) { msg.textContent = '⚠️ ' + e.message; busy = false; }
    };
    const m = el('div', { class: 'modal net-modal' }, el('div', { class: 'modal-box' },
      el('div', { class: 'card-head' }, el('b', {}, title), el('span', { class: 'spacer' }), el('button', { class: 'btn small', onclick: close }, '✕')),
      el('div', { class: 'net-scan-wrap' }, video, el('div', { class: 'net-scan-frame' })), msg,
      el('div', { class: 'row-actions' },
        el('button', { class: 'btn small', onclick: () => file.click() }, '🖼️ Usar una foto del QR'),
        el('button', { class: 'btn small', onclick: () => got(text.value) }, '⌨️ Usar el código pegado')),
      text, file));
    file.addEventListener('change', async () => {
      const f = file.files && file.files[0]; if (!f) return;
      msg.textContent = 'Leyendo la foto…';
      try {
        const bmp = await createImageBitmap(f);
        const code = await readQR(bmp, bmp.width, bmp.height);
        if (code) got(code); else msg.textContent = '⚠️ No encontré un QR en esa foto. Probá de más cerca y derecho.';
      } catch (e) { msg.textContent = '⚠️ No pude abrir esa foto.'; }
      file.value = '';
    });
    document.body.append(m);
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        video.srcObject = stream; await video.play().catch(() => {});
        const loop = async () => {
          if (!alive) return;
          if (video.readyState >= 2 && !busy) { const code = await readQR(video, video.videoWidth, video.videoHeight); if (code) { vibrate(40); got(code); } }
          setTimeout(loop, 180);
        };
        loop();
      } catch (e) { msg.textContent = '📷 No hay cámara o no diste permiso: usá una foto del QR o pegá el código.'; video.hidden = true; }
    })();
    return { close, got };
  }

  /* =========================== conexión =========================== */
  const waitIce = (pc) => new Promise((res) => {
    if (pc.iceGatheringState === 'complete') return res();
    const t = setTimeout(res, 4000);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
  });
  const send = (dc, o) => { if (dc && dc.readyState === 'open') { try { dc.send(JSON.stringify(o)); } catch (e) { /* se cortó */ } } };
  const myName = () => { const p = state.players[0]; return (N.name || (p && p.name) || 'Jugador').slice(0, 18); };

  const N = {
    role: null,                // null | 'host' | 'guest'
    name: '',
    guests: [],                // anfitrión: [{ id, name, color, pc, dc, status, view, sid }]
    host: null,                // invitado: { pc, dc, name }
    nextId: 1,
  };

  /* ----- anfitrión ----- */
  async function hostInvite() {
    if (N.role === 'guest') return toast('Ya estás conectado como invitado.');
    if (N.guests.filter((g) => g.status !== 'off').length >= MAX_GUESTS) return toast(`Máximo ${MAX_GUESTS} invitados.`);
    N.role = 'host';
    // el permiso de cámara hace que el navegador use la dirección real del Wi-Fi (conecta mejor) y sirve para leer la respuesta
    if (!N.camAsked) { N.camAsked = true; try { const st = await navigator.mediaDevices.getUserMedia({ video: true }); st.getTracks().forEach((t) => t.stop()); } catch (e) { /* sin cámara: igual se puede */ } }
    const g = { id: N.nextId++, name: 'Invitado', color: '#22d3ee', status: 'wait', pc: new RTCPeerConnection(RTC), dc: null, w: 390, h: 760 };
    g.dc = g.pc.createDataChannel('mb', { ordered: true });
    wireHostDC(g);
    g.pc.addEventListener('connectionstatechange', () => {
      const s = g.pc.connectionState;
      if (s === 'failed' || s === 'closed' || s === 'disconnected') dropGuest(g, s === 'disconnected' ? 'se desconectó' : 'se cortó');
    });
    N.guests.push(g);
    await g.pc.setLocalDescription(await g.pc.createOffer());
    await waitIce(g.pc);
    g.offer = await encode('O', g.pc.localDescription.sdp, { n: myName() });
    paint();
    showInvite(g);
    return g;
  }
  function showInvite(g) {
    const cv = el('canvas', { class: 'net-qr' }); drawQR(cv, g.offer);
    const box = el('div', { class: 'modal net-modal' }, el('div', { class: 'modal-box' },
      el('div', { class: 'card-head' }, el('b', {}, `📡 Sumar invitado`), el('span', { class: 'spacer' }), el('button', { class: 'btn small', onclick: () => { box.remove(); if (g.status === 'wait') dropGuest(g, null); } }, '✕')),
      el('p', {}, el('b', {}, '1. '), 'En el otro celular: ', el('b', {}, 'Jugar en red → Unirme'), ', y escaneá este QR.'), cv,
      el('details', {}, el('summary', {}, 'Sin cámara: copiar el código'), el('textarea', { class: 'net-code', rows: 3, readonly: '' }, g.offer),
        el('button', { class: 'btn small', onclick: () => copy(g.offer) }, '📋 Copiar')),
      el('p', {}, el('b', {}, '2. '), 'Después escaneá el QR de respuesta que le aparece al otro.'),
      el('button', { class: 'btn primary', onclick: () => { scanner('📷 Respuesta del invitado', (d) => { if (d.kind !== 'A') return toast('Ese es un QR de sala, no de respuesta.'); box.remove(); hostAccept(g, d); }); } }, '📷 Escanear la respuesta')));
    g.inviteBox = box;
    document.body.append(box);
  }
  async function hostAccept(g, d) {
    if (d.name) g.name = d.name;
    g.status = 'conn'; paint();
    try { await g.pc.setRemoteDescription({ type: 'answer', sdp: d.sdp }); } catch (e) { toast('⚠️ Esa respuesta no sirve: generá otra invitación.'); dropGuest(g, null); return; }
    setTimeout(() => { if (g.status === 'conn') { toast(`⚠️ No se pudo conectar con ${g.name}. ¿Están en el mismo Wi-Fi?`); dropGuest(g, null); } }, 15000);
  }
  function wireHostDC(g) {
    g.dc.onopen = async () => {
      g.status = 'on'; paint();
      toast(`✅ ${g.name} se conectó`); vibrate(60);
      // el video de su cámara: un lienzo que el anfitrión dibuja solo para él
      g.view = makeView(g.w, g.h);
      g.stream = g.view.cv.captureStream(0);
      g.track = g.stream.getVideoTracks()[0];
      try { g.track.contentHint = 'detail'; } catch (e) { /* nada */ }     // que se lean bien los nombres y los soldados
      g.sender = g.pc.addTrack(g.track, g.stream);
      try { const p = g.sender.getParameters(); p.encodings = p.encodings && p.encodings.length ? p.encodings : [{}]; p.encodings[0].maxBitrate = 2500000; p.encodings[0].maxFramerate = 30; p.degradationPreference = 'maintain-resolution'; await g.sender.setParameters(p); } catch (e) { /* valores por defecto */ }
      await renegotiate(g);
      sendRoom();
      if (game() && game().phase !== 'done') startGuestBattle(g);
    };
    g.dc.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (err) { return; } onGuestMsg(g, m); };
    g.dc.onclose = () => dropGuest(g, 'salió');
  }
  async function renegotiate(g) {
    g.negBusy = true;
    try { await g.pc.setLocalDescription(await g.pc.createOffer()); send(g.dc, { t: 'sdp', sdp: g.pc.localDescription.sdp }); } catch (e) { g.negBusy = false; }
  }
  function dropGuest(g, why) {
    if (g.status === 'off') return;
    const was = g.status === 'on';
    g.status = 'off';
    try { g.dc && g.dc.close(); } catch (e) { /* nada */ }
    try { g.pc.close(); } catch (e) { /* nada */ }
    if (g.inviteBox) g.inviteBox.remove();
    N.guests = N.guests.filter((q) => q !== g);
    const gm = game();
    if (gm && g.sid != null) { const s = gm.soldiers[g.sid]; if (s && s.net === g.id) { s.net = null; s.manual = false; s.netCtl = null; } }   // su soldado sigue solo
    if (was && why) toast(`📴 ${g.name} ${why}${gm && gm.phase !== 'done' ? ': su soldado sigue solo' : ''}`);
    if (!N.guests.length && N.role === 'host') N.role = null;
    sendRoom(); paint();
  }
  function onGuestMsg(g, m) {
    const gm = game();
    if (m.t === 'hello') {
      g.name = String(m.name || 'Invitado').slice(0, 18); g.color = /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : g.color;
      if (m.w && m.h) resizeView(g, m.w, m.h);
      sendRoom(); paint();
    } else if (m.t === 'size') { if (m.w && m.h) resizeView(g, m.w, m.h); }
    else if (m.t === 'sdpA') { g.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp }).catch(() => {}).finally(() => { g.negBusy = false; }); }
    else if (m.t === 'in') {
      const s = mySoldier(g); if (!s) return;
      const c = s.netCtl;
      c.mx = clampN(m.mx); c.my = clampN(m.my); c.fire = !!m.fire; c.sneak = !!m.sneak;
      if (m.mouse && isFinite(m.mouse.x) && isFinite(m.mouse.y)) { c.mouse = { x: +m.mouse.x, y: +m.mouse.y }; c.mouseT = performance.now(); }
      else if (m.mouse === null) c.mouse = null;
    } else if (m.t === 'act') {
      const s = mySoldier(g); if (!s || !gm || gm.paused) return;
      if (['reload', 'swap', 'nade', 'heal'].includes(m.k)) gm.manualAction(m.k, s);
      else if (m.k === 'tool') gm.manualTool(s);
      else if (['follow', 'hold', 'attack', 'regroup'].includes(m.k) && gm.squadOrder) gm.squadOrder(m.k, s);
    } else if (m.t === 'coinReq') {
      const gm2 = game();
      if (gm2 && !gm2.dead && gm2.phase !== 'done' && App.current === 'battle') { send(g.dc, { t: 'toast', text: `🪙 ${myName()} está en plena batalla: probá después` }); return; }
      if (App.Coin && !App.Coin.busy) { if (App.current !== 'coin') App.go('coin'); App.Coin.toss(); }
    } else if (m.t === 'bye') dropGuest(g, 'salió');
  }
  const clampN = (v) => (isFinite(v) ? Math.max(-1, Math.min(1, +v)) : 0);
  function sendRoom() {
    const list = [myName() + ' (anfitrión)'].concat(N.guests.filter((g) => g.status === 'on').map((g) => g.name));
    for (const g of N.guests) send(g.dc, { t: 'room', host: myName(), list });
  }
  const live = () => N.guests.filter((g) => g.status === 'on');
  function broadcast(o) { for (const g of live()) send(g.dc, o); }

  /* ----- invitado ----- */
  async function guestJoin(d) {
    if (N.role === 'host') return toast('Sos el anfitrión: cerrá la sala para unirte a otra.');
    if (d.kind !== 'O') return toast('Ese es un QR de respuesta: escaneá el QR de la sala del anfitrión.');
    guestLeave(true);
    N.role = 'guest';
    const pc = new RTCPeerConnection(RTC);
    const H = N.host = { pc, dc: null, name: d.name || 'Anfitrión', status: 'conn', list: [] };
    pc.ondatachannel = (e) => {
      H.dc = e.channel;
      H.dc.onopen = () => { H.status = 'on'; paint(); closeAnswer(); toast(`✅ Conectado a la sala de ${H.name}`); vibrate(60); send(H.dc, { t: 'hello', name: myName(), color: (state.players[0] || {}).color, w: innerWidth, h: innerHeight }); };
      H.dc.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch (err) { return; } onHostMsg(m); };
      H.dc.onclose = () => guestLost();
    };
    pc.ontrack = (e) => { H.stream = e.streams[0] || new MediaStream([e.track]); const v = $('#netVideo'); if (v) { v.srcObject = H.stream; v.play().catch(() => {}); } };
    pc.addEventListener('connectionstatechange', () => { if (['failed', 'closed'].includes(pc.connectionState)) guestLost(); });
    try { await pc.setRemoteDescription({ type: 'offer', sdp: d.sdp }); } catch (e) { toast('⚠️ Ese QR no sirve: pedile al anfitrión que genere otro.'); guestLeave(true); return; }
    await pc.setLocalDescription(await pc.createAnswer());
    await waitIce(pc);
    H.answer = await encode('A', pc.localDescription.sdp, { n: myName() });
    paint(); showAnswer(H.answer);
    setTimeout(() => { if (N.host === H && H.status === 'conn') { closeAnswer(); toast('⚠️ No se pudo conectar. ¿Están en el mismo Wi-Fi? Probá de nuevo.'); guestLeave(true); } }, 120000);
  }
  let answerBox = null;
  function showAnswer(code) {
    closeAnswer();
    const cv = el('canvas', { class: 'net-qr' }); drawQR(cv, code);
    answerBox = el('div', { class: 'modal net-modal' }, el('div', { class: 'modal-box' },
      el('div', { class: 'card-head' }, el('b', {}, '🙋 Tu respuesta'), el('span', { class: 'spacer' }), el('button', { class: 'btn small', onclick: () => { closeAnswer(); guestLeave(true); } }, '✕')),
      el('p', {}, 'Mostrale este QR al anfitrión para que lo escanee (botón ', el('b', {}, '“Escanear la respuesta”'), ').'), cv,
      el('details', {}, el('summary', {}, 'Sin cámara: copiar el código'), el('textarea', { class: 'net-code', rows: 3, readonly: '' }, code),
        el('button', { class: 'btn small', onclick: () => copy(code) }, '📋 Copiar')),
      el('p', { class: 'hint center' }, '⏳ Esperando que el anfitrión lo escanee…')));
    document.body.append(answerBox);
  }
  function closeAnswer() { if (answerBox) { answerBox.remove(); answerBox = null; } }
  function guestLost() {
    const H = N.host; if (!H || H.status === 'off') return;
    const was = H.status === 'on';
    guestLeave(false);
    if (was) toast('📴 Se cortó la conexión con el anfitrión');
  }
  function guestLeave(silent) {
    const H = N.host;
    if (H) { if (!silent) H.status = 'off'; try { send(H.dc, { t: 'bye' }); H.dc && H.dc.close(); } catch (e) { /* nada */ } try { H.pc.close(); } catch (e) { /* nada */ } }
    H && (H.status = 'off');
    N.host = null; if (N.role === 'guest') N.role = null;
    closeAnswer();
    if (App.current === 'netplay') App.go('net');
    paint();
  }
  function onHostMsg(m) {
    const H = N.host; if (!H) return;
    if (m.t === 'sdp') {
      (async () => {
        try { await H.pc.setRemoteDescription({ type: 'offer', sdp: m.sdp }); await H.pc.setLocalDescription(await H.pc.createAnswer()); send(H.dc, { t: 'sdpA', sdp: H.pc.localDescription.sdp }); } catch (e) { /* nada */ }
      })();
    } else if (m.t === 'room') { H.name = m.host || H.name; H.list = m.list || []; paint(); }
    else if (m.t === 'battle') { Play.start(m); }
    else if (m.t === 'hud') Play.hud(m);
    else if (m.t === 'feed') Play.feed(m.text);
    else if (m.t === 'end') Play.end(m);
    else if (m.t === 'quit') Play.quit();
    else if (m.t === 'coin') {
      if (App.current === 'netplay') return;
      if (App.current !== 'coin') App.go('coin');
      const go = () => { if (App.Coin.busy) setTimeout(go, 200); else App.Coin.toss(m.r); };
      go();
    } else if (m.t === 'toast') toast(m.text);
  }

  /* =========================== el anfitrión dibuja la cámara de cada invitado =========================== */
  const game = () => App.game || null;
  function makeView(w, h) {
    const v = { cv: document.createElement('canvas'), dpr: 1, camX: 0, camY: 0, hurtT: 0, hurtK: 0.5, killcam: null, last: 0 };
    v.ctx = v.cv.getContext('2d');
    sizeView(v, w, h);
    return v;
  }
  function sizeView(v, w, h) {
    // a lo sumo ~960 px del lado largo: el video sale fluido sin cargar demasiado al celular del anfitrión
    w = Math.max(200, Math.min(2000, +w || 390)); h = Math.max(200, Math.min(2000, +h || 760));
    const k = Math.min(1, 960 / Math.max(w, h));
    v.cw = Math.round(w * k); v.ch = Math.round(h * k);
    v.cv.width = v.cw; v.cv.height = v.ch;
    v.dk = v.dkCtx = v.fog = v.fogCtx = null;
  }
  function resizeView(g, w, h) { g.w = w; g.h = h; if (g.view) sizeView(g.view, w, h); }
  const SWAP = ['ctx', 'cv', 'cw', 'ch', 'dpr', 'camX', 'camY', 'followId', 'pov', 'dk', 'dkCtx', 'fog', 'fogCtx', 'hurtT', 'hurtK', 'padOn', 'shake', 'killcam', 'focus', 'focusUntil'];
  const OWN = ['dk', 'dkCtx', 'fog', 'fogCtx', 'focus', 'focusUntil'];        // cada cámara guarda los suyos
  function renderView(gm, g, dt) {
    const v = g.view, s = g.sid >= 0 ? gm.soldiers[g.sid] : null;
    if (!v || !gm.static) return;
    const keep = {}; for (const k of SWAP) keep[k] = gm[k];
    v.hurtT = Math.max(0, v.hurtT - dt);
    gm.ctx = v.ctx; gm.cv = v.cv; gm.cw = v.cw; gm.ch = v.ch; gm.dpr = v.dpr; for (const k of OWN) gm[k] = v[k];
    gm.followId = g.sid >= 0 ? g.sid : null; gm.pov = false; gm.hurtT = v.hurtT; gm.hurtK = v.hurtK; gm.padOn = true; gm.shake = 0; gm.killcam = v.killcam;
    try {
      // cámara: sigue a su soldado (o al que lo eliminó, unos segundos)
      const f = gm.focusSoldier() || s;
      const ts = gm.ts, vw = v.cw / ts, vh = v.ch / ts, W = gm.W, H = gm.H;
      if (f) { const k = v.last ? 1 - Math.exp(-dt * 4) : 1; v.camX += (f.x - v.camX) * k; v.camY += (f.y - v.camY) * k; }
      v.camX = vw >= W ? W / 2 : Math.max(vw / 2, Math.min(W - vw / 2, v.camX));
      v.camY = vh >= H ? H / 2 : Math.max(vh / 2, Math.min(H - vh / 2, v.camY));
      gm.camX = v.camX; gm.camY = v.camY;
      gm._netDraw = true;
      gm.draw();
    } catch (e) { /* un cuadro perdido no corta la partida */ }
    gm._netDraw = false;
    for (const k of OWN) v[k] = gm[k];
    for (const k of SWAP) gm[k] = keep[k];
    v.last = performance.now();
    if (g.track && g.track.requestFrame) g.track.requestFrame();
  }
  const G = App.battle.Game.prototype;
  const drawOld = G.draw;
  G.draw = function () {
    drawOld.call(this);
    if (this._netDraw || N.role !== 'host' || this !== game() || this.cfg.noRec) return;
    const now = performance.now(), fps = this.quality === 'ahorro' ? 15 : 24;
    if (now - (this._netT || 0) < 1000 / fps - 2) return;
    const dt = Math.min(0.2, (now - (this._netT || now)) / 1000); this._netT = now;
    for (const g of live()) if (g.sid != null && g.view) renderView(this, g, dt);
    if (now - (this._netHud || 0) > 100) { this._netHud = now; for (const g of live()) if (g.sid != null) sendHud(this, g); }
  };
  // los soldados de los invitados usan los controles de cada uno, no los de la pantalla del anfitrión
  const updOld = G.updateSoldier;
  G.updateSoldier = function (s, dt) {
    if (s.net && !s.netCtl) s.netCtl = { mx: 0, my: 0, fire: false, sneak: false };
    if (!s.netCtl) return updOld.call(this, s, dt);
    const c = this.ctl; this.ctl = s.netCtl;
    try { return updOld.call(this, s, dt); } finally { this.ctl = c; }
  };
  const dmgOld = G.damage;
  G.damage = function (s, by, dmg, zone) {
    const hp0 = s.hp;
    dmgOld.call(this, s, by, dmg, zone);
    if (s.net && s.hp < hp0) { const g = guestOf(s); if (g && g.view) { g.view.hurtT = 0.45; g.view.hurtK = Math.min(1, (hp0 - s.hp) / 40 + 0.3); } if (g) (g.ev = g.ev || []).push('hurt'); }
    if (by && by.net && by !== s && s.hp < hp0) { const g = guestOf(by); if (g) (g.ev = g.ev || []).push('hit'); }
  };
  const killOld = G.kill;
  G.kill = function (s, by, zone) {
    killOld.call(this, s, by, zone);
    if (s.net) { const g = guestOf(s); if (g) { (g.ev = g.ev || []).push('dead'); if (g.view && by && by !== s && by.alive) g.view.killcam = { id: by.id, victim: s.name, until: this.time + 3.2 }; } }
    if (by && by.net && by !== s) { const g = guestOf(by); if (g) (g.ev = g.ev || []).push('kill'); }
  };
  /** Sonidos que oye cada invitado: lo que pasa cerca de su cámara, con la distancia y el lado (izquierda/derecha). */
  function hear(gm, x, y, make) {
    if (N.role !== 'host' || gm !== game()) return;
    for (const g of live()) {
      if (!g.view || !g.inBattle) continue;
      const d = Math.hypot(x - g.view.camX, y - g.view.camY); if (d > 32) continue;
      const ev = g.ev || (g.ev = []); if (ev.length < 40) ev.push(make(Math.round(d * 10) / 10, Math.max(-1, Math.min(1, (x - g.view.camX) / 12))));
    }
  }
  const fireOld = G.fire;
  G.fire = function (s, extra) {
    const w = this.weaponOf(s), ok = fireOld.call(this, s, extra);
    if (ok && w && N.role === 'host') hear(this, s.x, s.y, (d, pan) => ['shot', w.type, d, +pan.toFixed(2), !!w.sup]);
    return ok;
  };
  const explodeOld = G.explode;
  G.explode = function (x, y, R, dmg, owner, kind) {
    const r = explodeOld.call(this, x, y, R, dmg, owner, kind);
    if (N.role === 'host') hear(this, x, y, (d, pan) => ['boom', d, +pan.toFixed(2)]);
    return r;
  };
  const reloadOld = G.startReload;
  G.startReload = function (s) {
    const ok = reloadOld.call(this, s);
    if (ok && s.net) { const g = guestOf(s); if (g) (g.ev = g.ev || []).push('reload'); }
    return ok;
  };
  const guestOf = (s) => N.guests.find((g) => g.id === s.net && g.status === 'on');
  const mySoldier = (g) => { const gm = game(); if (!gm || gm.phase === 'done' || g.sid == null) return null; const s = gm.soldiers[g.sid]; return s && s.net === g.id && s.netCtl ? s : null; };

  function sendHud(gm, g) {
    const cam = g.view ? { l: g.view.camX - g.view.cw / (2 * gm.ts), t: g.view.camY - g.view.ch / (2 * gm.ts), ts: gm.ts } : null;
    if (g.sid < 0) {          // espectador
      const alive = gm.soldiers.filter((q) => q.alive && !q.bot).length;
      send(g.dc, { t: 'hud', spec: true, alive: false, hp: 0, max: 1, lives: 0, kills: 0, w: '', gear: '', foes: alive, paused: !!gm.paused, phase: gm.phase, cd: gm.phase === 'countdown' ? Math.ceil(gm.cdT) : 0, cam, ev: g.ev && g.ev.length ? g.ev.splice(0) : undefined });
      return;
    }
    const s = gm.soldiers[g.sid]; if (!s) return;
    const { weaponLine, gearLine } = App.battle;
    const left = (g.view ? g.view.camX : gm.camX) - (g.view ? g.view.cw : gm.cw) / (2 * gm.ts), top = (g.view ? g.view.camY : gm.camY) - (g.view ? g.view.ch : gm.ch) / (2 * gm.ts);
    const mates = s.team >= 0 ? gm.soldiers.some((q) => q.alive && q !== s && q.team === s.team && !q.bot) : false;
    const foes = gm.soldiers.filter((q) => q.alive && !q.bot && (s.team < 0 || q.team !== s.team) && q !== s).length;
    send(g.dc, { t: 'hud', alive: s.alive, down: !!s.downed, hp: Math.max(0, Math.round(s.hp)), max: Math.round(s.maxHp), lives: s.lives, w: weaponLine(s), gear: gearLine(s), kills: s.kills,
      paused: !!gm.paused, phase: gm.phase, cd: gm.phase === 'countdown' ? Math.ceil(gm.cdT) : 0, mates, foes, time: Math.round(gm.time), cam: cam || { l: left, t: top, ts: gm.ts },
      ev: g.ev && g.ev.length ? g.ev.splice(0) : undefined });
  }
  /** Cuando el anfitrión arma la partida: a cada invitado conectado le toca un soldado de la lista. */
  function decorate(players) {
    if (N.role !== 'host' || !live().length) return {};
    assign(players, true);
    return { net: true };
  }
  /** A quién maneja cada invitado: el que eligió el anfitrión, o uno con su mismo nombre, o los últimos de la lista. */
  function assign(players, apply) {
    const taken = new Set(), out = [];
    for (const g of live()) {
      let k = g.pick != null && players[g.pick] && !taken.has(g.pick) && !players[g.pick].manual ? g.pick : -1;
      if (k < 0) k = players.findIndex((p, i) => !taken.has(i) && !p.manual && p.name.toLowerCase() === g.name.toLowerCase());
      if (k < 0) for (let i = players.length - 1; i >= 0; i--) if (!taken.has(i) && !players[i].manual) { k = i; break; }   // los últimos de la lista
      if (k < 0) { out.push([g, -1]); if (apply) g.sid = null; continue; }
      taken.add(k); out.push([g, k]);
      if (!apply) continue;
      players[k].net = g.id; g.slot = k;
      if (g.pick == null && !players.some((p) => p.name === g.name)) players[k].name = g.name;   // le tocó uno cualquiera: lleva el nombre del invitado
    }
    return out;
  }
  /** Cartelito en el armado de la batalla del anfitrión: quién maneja a quién. */
  function paintBattleInfo() {
    let box = $('#netBattleInfo');
    const setup = $('#battleSetup'); if (!setup) return;
    if (!box) { box = el('div', { class: 'card net-battle-info', id: 'netBattleInfo', hidden: true }); setup.prepend(box); }
    const on = N.role === 'host' && live().length > 0;
    box.hidden = !on; if (!on) return;
    const pl = state.players.map((p, i) => ({ name: App.pname(p, i), manual: !!p.manual }));
    const key = JSON.stringify(assign(pl, false).map(([g, k]) => [g.name, k, g.pick])) + pl.map((p) => p.name).join();
    if (box.dataset.k === key) return; box.dataset.k = key;
    box.innerHTML = '';
    box.append(el('b', {}, `📶 En red: ${live().length} invitado${live().length > 1 ? 's' : ''}`),
      el('div', { class: 'net-list' }, assign(pl, false).map(([g, k]) => el('div', { class: 'net-row' }, el('span', { class: 'dot', style: `background:${g.color}` }), el('b', {}, g.name),
        el('span', {}, k < 0 ? '👀 mira (no quedan soldados libres)' : `maneja a ${g.pick == null && !pl.some((p) => p.name === g.name) ? `${pl[k].name} (va a llevar su nombre)` : pl[k].name}`)))),
      el('p', { class: 'hint' }, 'Se elige en ', el('a', { href: '#', onclick: (e) => { e.preventDefault(); App.go('net'); } }, 'Jugar en red'), '. Cada invitado ve su propia cámara en su celular.'));
  }
  function startGuestBattle(g) {
    const gm = game(); if (!gm) return;
    const s = gm.soldiers.find((q) => q.net === g.id);
    g.ev = []; g.inBattle = true;
    if (g.view) { g.view.camX = s ? s.x : gm.W / 2; g.view.camY = s ? s.y : gm.H / 2; g.view.last = 0; g.view.killcam = null; g.view.focus = null; g.view.focusUntil = 0; }
    if (!s) { g.sid = -1; send(g.dc, { t: 'battle', spec: true, name: '👀 Espectador', color: '#cbd5e1', mode: gm.cfg.mode, map: gm.cfg.map, host: myName() }); return; }   // no le tocó soldado: mira la acción
    g.sid = s.id; s.netCtl = { mx: 0, my: 0, fire: false, sneak: false };
    send(g.dc, { t: 'battle', name: s.name, color: s.color, team: s.team, mode: gm.cfg.mode, map: gm.cfg.map, host: myName() });
  }
  // detecta partidas nuevas y avisa (inicio, muertes, final)
  let seenGame = null;
  setInterval(() => {
    const gm = game();
    if (N.role !== 'host') { seenGame = gm; return; }
    if (gm && gm !== seenGame) {
      seenGame = gm;
      if (gm.cfg.noRec) { for (const g of live()) { g.sid = null; g.inBattle = false; } return; }
      for (const g of live()) startGuestBattle(g);
      const h = gm.hooks, ev = h.onEvent, kl = h.onKill, en = h.onEnd;
      h.onEvent = (t) => { broadcast({ t: 'feed', text: String(t) }); return ev(t); };
      h.onKill = (s, by, zone) => { const r = kl(s, by, zone); broadcast({ t: 'feed', text: by && by !== s ? `${by.name} ✖ ${s.name}` : `✖ ${s.name}` }); return r; };
      h.onEnd = (res) => {
        const r = en(res);
        const rank = (res.ranking || []).slice(0, 10).map((s, i) => `${i + 1}. ${s.name}${s.net ? ' 📶' : ''} · ${s.kills} bajas`);
        const names = (res.winners || []).map((s) => s.name);
        for (const g of live()) {
          const me = g.sid != null ? gm.soldiers[g.sid] : null, won = me && (res.winners || []).includes(me);
          g.inBattle = false;
          send(g.dc, { t: 'end', title: res.title || (names.length ? `🏆 ${names.join(', ')}` : 'Empate'), won: !!won, mine: me ? { kills: me.kills, dmg: Math.round(me.stats.dmgDealt || 0) } : null, rank });
          g.sid = null;
        }
        return r;
      };
    }
    if (seenGame && seenGame.dead && seenGame._netQuit !== true) { seenGame._netQuit = true; if (seenGame.phase !== 'done') broadcast({ t: 'quit' }); for (const g of live()) { g.sid = null; g.inBattle = false; } }
  }, 250);

  /* =========================== pantalla del invitado durante la batalla =========================== */
  const Play = {
    on: false, hudData: null, ctl: { mx: 0, my: 0, fire: false, sneak: false }, lastSent: 0,
    start(m) {
      this.on = true; this.info = m;
      App.go('netplay');
      $('#netEnd').hidden = true;
      $('#netWho').textContent = `${m.name}`; $('#netWho').style.color = m.color || '';
      $('#netFeed').innerHTML = '';
      const v = $('#netVideo'); if (N.host && N.host.stream && v.srcObject !== N.host.stream) { v.srcObject = N.host.stream; } v.play().catch(() => {});
      document.body.classList.add('in-game');
      try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { this.wake = w; }).catch(() => {}); } catch (e) { /* nada */ }
      this.ctl = { mx: 0, my: 0, fire: false, sneak: false }; this.push(true);
      if (App.Music) App.Music.stop(0.5);
    },
    hud(m) {
      this.hudData = m;
      const hp = $('#netHp'); hp.style.width = `${Math.round(100 * m.hp / Math.max(1, m.max))}%`; hp.classList.toggle('low', m.hp < m.max * 0.35);
      $('#netHpTxt').textContent = m.spec ? '👀 Mirando la partida (no te tocó soldado)' : !m.alive ? (m.lives > 0 ? '💀 Esperando reaparecer…' : '💀 Eliminado: mirá cómo sigue') : m.down ? '🆘 Derribado: esperá a que te levanten' : `${m.hp} ❤`;
      $('#netGun').textContent = m.w || ''; $('#netGear').textContent = m.gear || '';
      $('#netKills').textContent = m.spec ? '' : `☠ ${m.kills}`; $('#netFoes').textContent = m.spec ? `👥 ${m.foes} en pie` : `🎯 ${m.foes} rivales`;
      $('#netOrders').hidden = !m.mates;
      $('#netCd').hidden = !(m.phase === 'countdown' && m.cd > 0); $('#netCd').textContent = m.cd;
      $('#netPaused').hidden = !m.paused;
      $('#netPad').classList.toggle('dead', !m.alive); $('#netPad').hidden = !!m.spec;
      for (const e of m.ev || []) {
        if (Array.isArray(e)) { sound(e); continue; }
        if (e === 'reload') { try { App.sfx.reload('out', 0, 0.8); App.sfx.reload('in', 0, 0.8, 0.5); } catch (err) { /* sin sonido */ } }
        else if (e === 'hurt') { vibrate(35); flash('hurt'); try { App.sfx.hit(0, 0.6); } catch (err) { /* sin sonido */ } }
        else if (e === 'hit') { try { App.sfx.tick(); } catch (err) { /* sin sonido */ } }
        else if (e === 'kill') { vibrate([30, 40, 60]); flash('kill'); }
        else if (e === 'dead') { vibrate([120, 60, 200]); }
      }
    },
    feed(text) {
      const f = $('#netFeed'); const d = el('div', {}, text); f.append(d);
      while (f.children.length > 3) f.firstChild.remove();
      setTimeout(() => d.remove(), 3500);
    },
    end(m) {
      this.ctl = { mx: 0, my: 0, fire: false, sneak: false };
      const box = $('#netEnd'); box.innerHTML = ''; box.hidden = false;
      box.append(el('div', { class: 'overlay-box' },
        el('h2', {}, m.won ? '🏆 ¡Ganaste!' : m.title || 'Terminó'),
        m.won ? el('p', { class: 'win-sub' }, m.title || '') : '',
        m.mine ? el('p', {}, `Tus bajas: ${m.mine.kills} · daño hecho: ${m.mine.dmg}`) : '',
        el('div', { class: 'net-rank' }, (m.rank || []).map((r) => el('div', {}, r))),
        el('p', { class: 'hint' }, `Esperá a que ${N.host ? N.host.name : 'el anfitrión'} arme la próxima.`),
        el('button', { class: 'btn', onclick: () => { box.hidden = true; App.go('net'); } }, '↩ Volver a la sala')));
      if (m.won) { try { App.sfx.fanfare(); } catch (e) { /* sin sonido */ } vibrate([60, 60, 120]); }
    },
    quit() { this.on = false; toast('🚪 El anfitrión cerró la partida'); if (App.current === 'netplay') App.go('net'); },
    /** Manda los controles al anfitrión: cada vez que cambian y, si no, cada tanto (por si se perdió alguno). */
    push(force) {
      const H = N.host; if (!H || H.status !== 'on') return;
      const c = this.ctl, now = performance.now(), key = `${c.mx.toFixed(2)},${c.my.toFixed(2)},${c.fire},${c.sneak},${c.mouse ? c.mouse.x.toFixed(1) + ':' + c.mouse.y.toFixed(1) : ''}`;
      if (!force && key === this.lastKey && now - this.lastSent < 250) return;
      if (!force && now - this.lastSent < 30 && key !== this.lastKey && Math.abs(c.mx) + Math.abs(c.my) > 0 && c.fire === this.lastFire) return;   // no más de ~30 por segundo
      this.lastKey = key; this.lastSent = now; this.lastFire = c.fire;
      send(H.dc, { t: 'in', mx: +c.mx.toFixed(3), my: +c.my.toFixed(3), fire: c.fire, sneak: c.sneak, mouse: c.mouse || null });
    },
    act(k) { if (N.host) send(N.host.dc, { t: 'act', k }); vibrate(15); },
  };
  function sound(e) {
    if (!App.state.sound) return;
    try {
      if (e[0] === 'shot') App.sfx.shot(e[1], e[2], e[3], e[4]);
      else if (e[0] === 'boom') { App.sfx.boom(e[2], Math.max(0.15, 1 - e[1] / 30), e[1] < 6); if (e[1] < 8) vibrate(40); }
    } catch (err) { /* sin sonido */ }
  }
  function flash(kind) { const f = $('#netFlash'); if (!f) return; f.className = 'net-flash ' + kind; void f.offsetWidth; f.classList.add('go'); }
  setInterval(() => { if (Play.on && App.current === 'netplay') Play.push(false); }, 120);
  setInterval(() => { if (App.current === 'battle') paintBattleInfo(); }, 700);

  function wirePlay() {
    const joy = $('#netJoy'), knob = $('#netKnob'), fire = $('#netFire');
    const cap = (e2, e) => { try { e2.setPointerCapture(e.pointerId); } catch (err) { /* nada */ } };
    let on = false;
    const mv = (e) => {
      const r = joy.getBoundingClientRect(), R = r.width / 2;
      let dx = (e.clientX - (r.left + R)) / R, dy = (e.clientY - (r.top + R)) / R;
      const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
      Play.ctl.mx = dx; Play.ctl.my = dy; knob.style.transform = `translate(${dx * R * 0.7}px, ${dy * R * 0.7}px)`; Play.push(false);
    };
    joy.addEventListener('pointerdown', (e) => { cap(joy, e); on = true; mv(e); e.preventDefault(); });
    joy.addEventListener('pointermove', (e) => { if (on) mv(e); });
    const end = () => { on = false; Play.ctl.mx = Play.ctl.my = 0; knob.style.transform = ''; Play.push(true); };
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
    fire.addEventListener('pointerdown', (e) => { cap(fire, e); Play.ctl.fire = true; fire.classList.add('hold'); Play.push(true); e.preventDefault(); });
    const fEnd = () => { Play.ctl.fire = false; fire.classList.remove('hold'); Play.push(true); };
    fire.addEventListener('pointerup', fEnd); fire.addEventListener('pointercancel', fEnd);
    [['netReload', 'reload'], ['netSwap', 'swap'], ['netNade', 'nade'], ['netHeal', 'heal'], ['netTool', 'tool'],
      ['netOrdFollow', 'follow'], ['netOrdHold', 'hold'], ['netOrdAttack', 'attack'], ['netOrdRegroup', 'regroup']].forEach(([id, k]) => $('#' + id).addEventListener('click', () => Play.act(k)));
    $('#netLeave').addEventListener('click', () => { if (confirm('¿Salir de la sala? Tu soldado sigue solo.')) guestLeave(false); });
    // teclado y mouse (invitado en una PC)
    const keys = new Set(), MOVE = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'], ACT = { r: 'reload', q: 'swap', g: 'nade', h: 'heal', e: 'tool' };
    const kc = () => {
      const c = Play.ctl;
      c.mx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      c.my = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
      c.fire = keys.has(' ') || keys.has('f') || !!Play.mouseFire; c.sneak = keys.has('shift'); Play.push(true);
    };
    window.addEventListener('keydown', (e) => {
      if (App.current !== 'netplay' || /INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) return;
      const k = e.key.toLowerCase();
      if (ACT[k] && !e.repeat) { Play.act(ACT[k]); return; }
      if (MOVE.concat([' ', 'f', 'shift']).includes(k)) { keys.add(k); kc(); e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => { if (keys.delete(e.key.toLowerCase())) kc(); });
    const vid = $('#netVideo');
    const toWorld = (e) => {
      const h = Play.hudData; if (!h || !h.cam || !vid.videoWidth) return null;
      const r = vid.getBoundingClientRect(), k = Math.min(r.width / vid.videoWidth, r.height / vid.videoHeight);
      const ox = r.left + (r.width - vid.videoWidth * k) / 2, oy = r.top + (r.height - vid.videoHeight * k) / 2;
      return { x: h.cam.l + (e.clientX - ox) / k / h.cam.ts, y: h.cam.t + (e.clientY - oy) / k / h.cam.ts };
    };
    vid.addEventListener('mousemove', (e) => { const p = toWorld(e); if (p) { Play.ctl.mouse = p; Play.push(false); } });
    vid.addEventListener('mousedown', (e) => { const p = toWorld(e); if (p) Play.ctl.mouse = p; if (e.button === 0) { Play.mouseFire = true; Play.ctl.fire = true; Play.push(true); } else if (e.button === 2) Play.act('nade'); e.preventDefault(); });
    window.addEventListener('mouseup', (e) => { if (e.button === 0 && Play.mouseFire) { Play.mouseFire = false; kc(); } });
    vid.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', () => { if (N.role === 'guest' && N.host) send(N.host.dc, { t: 'size', w: innerWidth, h: innerHeight }); });
  }

  /* =========================== pantalla de la sala =========================== */
  function copy(t) { try { navigator.clipboard.writeText(t).then(() => toast('📋 Copiado'), () => toast('No se pudo copiar')); } catch (e) { toast('No se pudo copiar'); } }
  function paint() {
    const box = $('#netBody'); if (!box) return;
    box.innerHTML = '';
    const nameRow = el('div', { class: 'net-name' }, el('span', {}, 'Tu nombre en la sala:'),
      el('input', { type: 'text', maxlength: 18, value: myName(), oninput: (e) => { N.name = e.target.value.trim(); state.ui.netName = N.name; save(); } }));
    if (!N.role) {
      box.append(nameRow,
        el('button', { class: 'menu-card', onclick: () => hostInvite() }, el('span', { class: 'menu-ico' }, '📡'),
          el('span', {}, el('b', {}, 'Crear sala'), el('small', {}, 'Sos el anfitrión: tu celular corre la partida y los demás se suman escaneando tu QR.'))),
        el('button', { class: 'menu-card', onclick: () => scanner('📷 QR de la sala', (d) => guestJoin(d)) }, el('span', { class: 'menu-ico' }, '🙋'),
          el('span', {}, el('b', {}, 'Unirme a una sala'), el('small', {}, 'Escaneá el QR que te muestra el anfitrión y manejá tu soldado desde tu celular.'))),
        el('div', { class: 'card' }, el('b', {}, '¿Cómo funciona?'),
          el('ol', { class: 'net-steps' },
            el('li', {}, 'Todos conectados al ', el('b', {}, 'mismo Wi-Fi'), ' (no hace falta internet; también sirve el punto de acceso de un celular).'),
            el('li', {}, 'El anfitrión toca ', el('b', {}, 'Crear sala'), ' y muestra su QR. El otro toca ', el('b', {}, 'Unirme'), ' y lo escanea.'),
            el('li', {}, 'Al invitado le aparece un QR de respuesta: lo escanea el anfitrión. ¡Listo, conectados!'),
            el('li', {}, 'El anfitrión arma la batalla como siempre: a cada invitado le toca un soldado y lo maneja desde su celular. La moneda también se comparte.')),
          el('p', { class: 'hint' }, 'Hasta 5 invitados. La partida la corre el celular del anfitrión: conviene que sea el más rápido y que esté enchufado.')));
      return;
    }
    if (N.role === 'host') {
      const list = N.guests;
      box.append(el('div', { class: 'card' },
        el('div', { class: 'card-head' }, el('b', {}, `📡 Tu sala · ${live().length}/${MAX_GUESTS} invitados`), el('span', { class: 'spacer' }),
          el('button', { class: 'btn small', onclick: () => { if (confirm('¿Cerrar la sala? Se desconectan todos.')) { broadcast({ t: 'quit' }); N.guests.slice().forEach((g) => dropGuest(g, null)); N.role = null; paint(); } } }, 'Cerrar sala')),
        list.length ? el('div', { class: 'net-list' }, list.map((g) => el('div', { class: 'net-row' },
          el('span', { class: 'dot', style: `background:${g.color}` }), el('b', {}, g.name),
          el('span', { class: 'net-st ' + g.status }, g.status === 'on' ? 'conectado' : g.status === 'conn' ? 'conectando…' : 'esperando su respuesta'),
          g.status === 'wait' ? el('button', { class: 'btn small', onclick: () => showInvite(g) }, 'Ver QR') : '',
          g.status === 'on' ? slotPicker(g) : ''))) : el('p', { class: 'hint' }, 'Todavía no hay invitados.'),
        el('button', { class: 'btn primary', onclick: () => hostInvite() }, '➕ Sumar invitado (mostrar QR)')),
      el('div', { class: 'card' }, el('b', {}, '¿Y ahora?'),
        el('p', {}, 'Andá a ', el('b', {}, 'La Batalla'), ' y armala como siempre: los invitados manejan los soldados que elegiste acá (si no elegiste, les tocan los últimos de la lista). En ', el('b', {}, 'La Moneda'), ', la tirada la ven todos.'),
        el('div', { class: 'row-actions' }, el('button', { class: 'btn', onclick: () => App.go('battle') }, '🔫 Ir a La Batalla'), el('button', { class: 'btn', onclick: () => App.go('coin') }, '🪙 Ir a La Moneda'))));
      box.append(nameRow);
      return;
    }
    const H = N.host;
    box.append(el('div', { class: 'card' },
      el('div', { class: 'card-head' }, el('b', {}, H && H.status === 'on' ? `✅ En la sala de ${H.name}` : '⏳ Conectando…'), el('span', { class: 'spacer' }),
        el('button', { class: 'btn small', onclick: () => guestLeave(false) }, 'Salir')),
      H && H.list && H.list.length ? el('div', { class: 'net-list' }, H.list.map((n) => el('div', { class: 'net-row' }, '👤 ', n))) : '',
      H && H.status === 'on' ? el('p', { class: 'hint' }, `Esperá a que ${H.name} arme la batalla: cuando empiece, esta pantalla cambia sola y manejás tu soldado. Si tira la moneda, la vas a ver acá. También podés tirarla vos desde La Moneda.`) : '',
      H && H.status === 'conn' && H.answer ? el('button', { class: 'btn', onclick: () => showAnswer(H.answer) }, 'Ver mi QR de respuesta') : '',
      el('div', { class: 'row-actions' }, el('button', { class: 'btn', onclick: () => App.go('coin') }, '🪙 Ir a La Moneda'))), nameRow);
  }
  function slotPicker(g) {
    const ps = state.players;
    const sel = el('select', { class: 'net-slot', onchange: (e) => { g.pick = e.target.value === '' ? null : +e.target.value; } },
      el('option', { value: '' }, 'Soldado: automático'),
      ps.map((p, i) => el('option', Object.assign({ value: i }, g.pick === i ? { selected: '' } : {}), `Maneja a ${App.pname(p, i)}`)));
    return sel;
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (state.ui && state.ui.netName) N.name = String(state.ui.netName).slice(0, 18);
    App.register('net', { enter: paint });
    App.register('netplay', { leave() { Play.on = false; document.body.classList.remove('in-game'); if (Play.wake) { Play.wake.release().catch(() => {}); Play.wake = null; } } });
    wirePlay();
    window.addEventListener('beforeunload', () => { if (N.role === 'guest' && N.host) send(N.host.dc, { t: 'bye' }); if (N.role === 'host') broadcast({ t: 'quit' }); });
  });

  App.Net = {
    get role() { return N.role; }, N, decorate, encode, decode, drawQR, readQR, hostInvite, guestJoin, hostAccept, scanner, guestLeave,
    coinCast(r) { if (N.role === 'host') broadcast({ t: 'coin', r }); },
    coinRequest() { if (N.host && N.host.status === 'on') { send(N.host.dc, { t: 'coinReq' }); toast(`🪙 Le pedí a ${N.host.name} que tire la moneda…`); } else toast('Sin conexión con el anfitrión'); },
    get playing() { return Play.on; },
  };
})();
