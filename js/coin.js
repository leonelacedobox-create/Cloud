/* La Moneda: lanzamiento 3D, apuestas, series y "se va temprano". */
'use strict';

(() => {
  const { state, $, $$, el, rnd, rint, shuffle, pname, sfx, vibrate, bindSeg, save } = App;
  const C = state.coin;

  const NAME = { milei: 'Javier Milei', cristina: 'Cristina Kirchner' };
  const IMG = { milei: 'assets/coin-milei.png', cristina: 'assets/coin-cristina.png' };

  const stage = $('#coinStage');
  const coinWrap = $('#coinWrap');
  const coin = $('#coin');
  const shadow = $('#coinShadow');
  const resultBox = $('#coinResult');
  const btnToss = $('#btnToss');
  const hint = $('#stageHint');

  let series = { milei: 0, cristina: 0, done: false, n: 0 };
  let busy = false;
  let rot = 0;             // ángulo actual de la moneda (grados). 0 = cara Milei, 180 = Cristina
  let running = false;     // loop de animación activo
  let idleT0 = performance.now();

  /* ---------- canto estriado de la moneda ---------- */
  (function buildEdge() {
    const edge = $('#coinEdge');
    const N = 64;
    const w = Math.tan(Math.PI / N) * 1.04;      // ancho relativo al diámetro (+4% de solape)
    for (let i = 0; i < N; i++) {
      const a = (i / N) * 360;
      const s = (0.38 - 0.38 * Math.cos((a - 40) * Math.PI / 180)) * 0.6; // sombra según el ángulo
      const seg = document.createElement('i');
      seg.style.cssText = `--w:calc(var(--cs) * ${w.toFixed(4)});--s:${s.toFixed(2)};` +
        `transform:rotateZ(${a}deg) translateY(calc(var(--cs) * -0.5)) rotateX(90deg)`;
      edge.appendChild(seg);
    }
  })();

  /* ---------- render de la moneda ---------- */
  function setCoin(h, rotX, tilt, scale) {
    coinWrap.style.transform = `translate3d(0,${(-h).toFixed(1)}px,0) scale(${scale.toFixed(3)})`;
    coin.style.transform = `rotateY(${tilt.toFixed(1)}deg) rotateX(${rotX.toFixed(2)}deg)`;
    const g = 50 + 70 * Math.sin(rotX * Math.PI / 180) + tilt * 2;
    coin.style.setProperty('--g', g.toFixed(1));
    const k = 1 / (1 + h / 260);
    shadow.style.transform = `scale(${k.toFixed(3)})`;
    shadow.style.opacity = (0.35 + 0.65 * k).toFixed(2);
  }

  function idleFrame(now) {
    const t = (now - idleT0) / 1000;
    setCoin(Math.sin(t * 1.6) * 4 + 4, rot + Math.sin(t * 1.1) * 4, Math.sin(t * 0.9) * 7, 1);
  }

  function loop(now) {
    if (!running) return;
    if (!busy) idleFrame(now);
    requestAnimationFrame(loop);
  }
  function startLoop() { if (!running) { running = true; requestAnimationFrame(loop); } }
  function stopLoop() { running = false; }

  const easeOut = (u) => 1 - Math.pow(1 - u, 2);

  /** Anima el lanzamiento y termina mostrando la cara `result`. */
  function animateToss(result) {
    return new Promise((resolve) => {
      const st = C.style || 'clasica';                           // estilo de tirada: clásica, alta, trompo o loca
      const H = coinWrap.offsetWidth * (st === 'alta' ? 1.4 : st === 'trompo' ? 0.45 : 0.85);   // altura máxima del salto (relativa al tamaño)
      const air = st === 'alta' ? 1900 + rint(400) : st === 'trompo' ? 1000 + rint(250) : 1250 + rint(350);   // ms en el aire
      const spins = st === 'trompo' ? 12 + rint(5) : st === 'alta' ? 7 + rint(4) : 5 + rint(4);               // vueltas completas
      let lastHalf = -1, lastTick = 0;
      const wantBack = result === 'cristina';
      const isBack = Math.round(((rot % 360) + 360) % 360 / 180) % 2 === 1;
      const rot0 = rot;
      const rotEnd = rot0 + 360 * spins + (wantBack !== isBack ? 180 : 0);
      const tiltAmp = st === 'loca' ? 28 + rnd() * 14 : 10 + rnd() * 8;
      const tiltPhase = rnd() * 6;
      const b1 = 300, b2 = 190, wob = 520;
      const total = air + b1 + b2 + wob;
      const start = performance.now();
      let hit1 = false, hit2 = false, landed = false;

      sfx.whoosh();
      vibrate(15);

      function frame(now) {
        const t = now - start;
        let h = 0, r = rotEnd, tilt = 0, sc = 1;
        if (t < air) {
          const u = t / air;
          h = 4 * H * u * (1 - u);
          r = rot0 + (rotEnd - rot0) * (u < 0.5 ? easeOut(u * 2) * 0.5 : 0.5 + (u - 0.5)); // gira rápido al inicio
          tilt = tiltAmp * Math.sin(u * Math.PI * 2.4 + tiltPhase) * (1 - u * 0.6);
          sc = 1 + 0.14 * (h / H) + (st === 'loca' ? 0.12 * Math.sin(u * 17) : 0);
          const half = Math.floor(r / 180);                      // un "tic" cada vez que pasa una cara
          if (half !== lastHalf) { lastHalf = half; if (now - lastTick > 55) { lastTick = now; sfx.tick(half % 2); } }
        } else {
          const tt = t - air;
          if (!landed) { landed = true; sfx.coinRing(1); vibrate([30, 40, 15]); }
          if (tt < b1) {                                          // primer rebote
            const u = tt / b1; h = 4 * 0.11 * H * u * (1 - u);
            r = rotEnd + 16 * Math.sin(u * Math.PI) * (wantBack ? -1 : 1);
          } else if (tt < b1 + b2) {                              // segundo rebote
            if (!hit1) { hit1 = true; sfx.clink(); }
            const u = (tt - b1) / b2; h = 4 * 0.035 * H * u * (1 - u);
            r = rotEnd - 7 * Math.sin(u * Math.PI) * (wantBack ? -1 : 1);
          } else {                                                // se asienta
            if (!hit2) { hit2 = true; sfx.coinRing(0.3); }
            const u = (tt - b1 - b2) / wob;
            r = rotEnd + 3.5 * Math.sin(u * Math.PI * 5) * Math.exp(-u * 4);
          }
          tilt = 0;
        }
        setCoin(h, r, tilt, sc);
        if (t < total) requestAnimationFrame(frame);
        else { rot = rotEnd % 720; setCoin(0, rot, 0, 1); resolve(); }
      }
      requestAnimationFrame(frame);
    });
  }

  /* ---------- confeti ---------- */
  const PAL = { milei: ['#7dd3fc', '#ffffff', '#f5c518', '#38bdf8'], cristina: ['#a78bfa', '#ffffff', '#f5c518', '#c084fc'] };
  let confCv = null, confRun = false, bits = [];
  function burst(result) {
    const big = series.done || (C.mode === 'temprano' && C.best === 1);
    if (!confCv) {
      confCv = el('canvas', { class: 'confetti' }); document.body.append(confCv);
    }
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = window.innerWidth, H = window.innerHeight;
    confCv.width = W * dpr; confCv.height = H * dpr; confCv.style.width = W + 'px'; confCv.style.height = H + 'px';
    const r = coinWrap.getBoundingClientRect(), cx = r.left + r.width / 2, cy = Math.min(H * 0.7, Math.max(H * 0.28, r.top + r.height / 2));   // si la moneda quedó fuera de la pantalla, sale de la zona visible
    const n = (big ? 170 : 60) * (state.ui.motion === false ? 0.3 : 1), pal = PAL[result];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * (big ? 2.6 : 1.7), v = (big ? 9 : 6) + rnd() * (big ? 9 : 6);
      bits.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rnd() * 6, vr: (rnd() - 0.5) * 0.4, w: 5 + rnd() * 6, h: 3 + rnd() * 4, c: pal[rint(pal.length)], life: 1 });
    }
    sfx.pop(); if (big) setTimeout(() => sfx.fanfare(), 150);
    if (!confRun) { confRun = true; requestAnimationFrame(confFrame); }
  }
  function confFrame() {
    const x = confCv.getContext('2d'), dpr = confCv.width / parseFloat(confCv.style.width);
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, confCv.width, confCv.height);
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.x += b.vx; b.y += b.vy; b.vy += 0.32; b.vx *= 0.985; b.rot += b.vr; b.life -= 0.0085;
      if (b.life <= 0 || b.y > window.innerHeight + 20) { bits.splice(i, 1); continue; }
      x.save(); x.translate(b.x, b.y); x.rotate(b.rot); x.globalAlpha = Math.min(1, b.life * 2.2); x.fillStyle = b.c; x.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * (0.4 + 0.6 * Math.abs(Math.sin(b.rot * 2)))); x.restore();
    }
    if (bits.length) requestAnimationFrame(confFrame); else { confRun = false; x.clearRect(0, 0, confCv.width, confCv.height); }
  }

  /* ---------- lógica de la tirada ---------- */
  const need = () => Math.ceil(C.best / 2 + (C.best % 2 === 0 ? 0.5 : 0));
  function newSeries() { series = { milei: 0, cristina: 0, done: false, n: 0 }; }

  function ensureAssigned() {
    const ps = state.players;
    const m = ps.filter((p) => p.pick === 'milei').length;
    const c = ps.filter((p) => p.pick === 'cristina').length;
    let a = m, b = c;
    ps.filter((p) => !p.pick).forEach((p) => {
      p.pick = a < b || (a === b && rnd() < 0.5) ? 'milei' : 'cristina';
      if (p.pick === 'milei') a++; else b++;
    });
  }

  function randomPick() {
    const order = shuffle(state.players);
    const first = rnd() < 0.5 ? 'milei' : 'cristina';
    order.forEach((p, i) => { p.pick = i % 2 === 0 ? first : (first === 'milei' ? 'cristina' : 'milei'); });
    renderRoster(); save();
  }

  async function toss() {
    if (busy) return;
    App.ctx();
    if (series.done) { newSeries(); }
    if (C.mode === 'temprano') { ensureAssigned(); renderRoster(); }
    $$('#coinRoster .prow').forEach((r) => r.classList.remove('won', 'lost'));
    busy = true; btnToss.disabled = true; hint.style.visibility = 'hidden';
    resultBox.innerHTML = '';
    const result = rnd() < 0.5 ? 'milei' : 'cristina';
    await animateToss(result);
    record(result);
    busy = false; btnToss.disabled = false; hint.style.visibility = 'visible';
    idleT0 = performance.now();
  }

  function record(result) {
    C.totals[result] = (C.totals[result] || 0) + 1;
    C.history.push(result);
    if (C.history.length > 40) C.history.shift();
    series[result]++; series.n++;
    if (series[result] >= need()) series.done = true;
    showResult(result);
    burst(result);
    renderStats(); renderSeries(); updateButton();
    save();
  }

  /* ---------- resultado en pantalla ---------- */
  function showResult(result) {
    const winner = result;
    const best = C.best;
    resultBox.innerHTML = '';
    resultBox.append(
      el('div', { class: 'big-name' }, el('img', { src: IMG[result], alt: '' }), `¡${NAME[result].toUpperCase()}!`),
    );
    if (best > 1) {
      const serieWinner = series.milei > series.cristina ? 'milei' : 'cristina';
      resultBox.append(el('div', { class: 'sub' },
        series.done
          ? `🏆 Ganó la serie ${NAME[serieWinner]} (${series.milei}–${series.cristina})`
          : `Serie ${series.milei}–${series.cristina} · el primero en llegar a ${need()} gana`));
    }
    if (best > 1 && !series.done) return;
    const w = best > 1 ? (series.milei > series.cristina ? 'milei' : 'cristina') : winner;

    const ps = state.players;
    if (C.mode === 'apuesta') {
      const win = [], lose = [], none = [];
      ps.forEach((p, i) => (p.pick === w ? win : p.pick ? lose : none).push({ p, i }));
      win.forEach(({ p }) => { p.hits = (p.hits || 0) + 1; });
      const g = el('div', { class: 'groups' });
      if (win.length) g.append(group('✅ Acertaron', win, 'win'));
      if (lose.length) g.append(group('❌ Fallaron', lose, 'lose'));
      if (none.length) g.append(group('Sin apuesta', none, ''));
      resultBox.append(g);
      markRows(win, lose);
      renderRoster();
      markRows(win, lose);
    } else if (C.mode === 'temprano') {
      const side = (p) => p.pick === w;
      const leave = ps.map((p, i) => ({ p, i })).filter(({ p }) => (C.leaver === 'winner') === side(p));
      const stay = ps.map((p, i) => ({ p, i })).filter(({ p }) => (C.leaver === 'winner') !== side(p));
      const g = el('div', { class: 'groups' });
      g.append(group('🏃 Se van temprano', leave, 'win'));
      if (stay.length) g.append(group('💼 Se quedan', stay, 'lose'));
      resultBox.append(g);
      markRows(leave, stay);
    }
    save();
  }

  function group(title, list, cls) {
    return el('div', { class: 'grp ' + cls }, el('b', {}, title), list.map(({ p, i }) => pname(p, i)).join(', ') || '—');
  }
  function markRows(win, lose) {
    const rows = $$('#coinRoster .prow');
    win.forEach(({ i }) => rows[i] && rows[i].classList.add('won'));
    lose.forEach(({ i }) => rows[i] && rows[i].classList.add('lost'));
  }

  /* ---------- UI: roster, serie, estadísticas ---------- */
  function renderRoster() {
    const card = $('#coinRosterCard');
    card.hidden = C.mode === 'libre';
    if (C.mode === 'libre') return;
    const temprano = C.mode === 'temprano';
    $('#rosterTitle').textContent = temprano ? '¿Quién se va temprano?' : 'Apuestas';
    $('#rosterHint').textContent = temprano
      ? 'Cada uno queda de un lado de la moneda. Tocá la carita para cambiar de lado o repartí al azar.'
      : 'Tocá la carita de la moneda por la que apostás. Los que aciertan suman puntos 🏆.';
    $('#optLeaver').hidden = !temprano;
    const box = $('#coinRoster');
    box.innerHTML = '';
    state.players.forEach((p, i) => {
      const row = el('div', { class: 'prow' },
        el('input', {
          class: 'name', type: 'text', maxlength: 16, placeholder: `Jugador ${i + 1}`, value: p.name || '',
          'aria-label': `Nombre del jugador ${i + 1}`,
          onchange: (e) => { p.name = e.target.value; save(); }, oninput: (e) => { p.name = e.target.value; save(); },
        }),
        el('span', { class: 'hits', title: 'Aciertos' }, !temprano && p.hits ? `🏆${p.hits}` : ''),
        pickBtn(p, 'milei'), pickBtn(p, 'cristina'),
        el('button', { class: 'rm', 'aria-label': 'Quitar', onclick: () => removePlayer(i) }, '✕'),
      );
      box.append(row);
    });
    $('#btnAddCoinPlayer').disabled = state.players.length >= App.MAX_PLAYERS;
  }
  function pickBtn(p, side) {
    return el('button', {
      class: 'pick ' + (side === 'milei' ? 'm' : 'c') + (p.pick === side ? ' on' : ''),
      'aria-label': NAME[side], title: NAME[side],
      onclick: (e) => {
        p.pick = p.pick === side ? null : side;
        const row = e.target.closest('.prow');
        $$('.pick', row).forEach((b) => b.classList.remove('on'));
        if (p.pick) e.target.classList.add('on');
        save();
      },
    });
  }
  function removePlayer(i) {
    if (state.players.length <= 2) return;
    state.players.splice(i, 1); renderRoster(); save();
  }

  function renderSeries() {
    const box = $('#seriesBox');
    box.hidden = C.best === 1;
    if (C.best === 1) return;
    box.innerHTML = '';
    ['milei', 'cristina'].forEach((s) => {
      const lead = series[s] > series[s === 'milei' ? 'cristina' : 'milei'];
      box.append(el('div', { class: 'pill' + (lead ? ' lead' : '') }, el('img', { src: IMG[s], alt: NAME[s] }), el('span', {}, series[s])));
    });
  }

  function renderStats() {
    const t = C.totals, total = (t.milei || 0) + (t.cristina || 0);
    const box = $('#coinStats');
    box.innerHTML = '';
    ['milei', 'cristina'].forEach((s) => {
      const pct = total ? Math.round(((t[s] || 0) / total) * 100) : 0;
      box.append(el('div', { class: 'bar' }, el('img', { src: IMG[s], alt: '' }),
        el('div', { class: 'track' }, el('div', { class: 'fill', style: `width:${pct}%` })),
        el('span', {}, `${t[s] || 0} (${pct}%)`)));
    });
    const hist = $('#coinHistory');
    hist.innerHTML = '';
    C.history.slice().reverse().forEach((s) => hist.append(el('img', { src: IMG[s], alt: NAME[s] })));
    if (!total) box.append(el('div', { class: 'hint' }, 'Todavía no se tiró ninguna moneda.'));
  }

  function updateButton() {
    let txt = '🪙 TIRAR MONEDA';
    if (C.best > 1) txt = series.done ? '🔁 NUEVA SERIE' : series.n ? '🪙 SEGUIR LA SERIE' : '🪙 TIRAR MONEDA';
    btnToss.textContent = txt;
  }

  /* ---------- eventos ---------- */
  stage.addEventListener('click', toss);
  stage.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toss(); } });
  btnToss.addEventListener('click', toss);

  const refreshMode = bindSeg('segMode', () => C.mode, (v) => {
    C.mode = v; newSeries();
    if (v === 'temprano') randomPick();
    resultBox.innerHTML = '';
    renderRoster(); renderSeries(); updateButton();
  });
  bindSeg('segStyle', () => C.style || 'clasica', (v) => { C.style = v; });
  bindSeg('segBest', () => C.best, (v) => { C.best = +v; newSeries(); resultBox.innerHTML = ''; renderSeries(); updateButton(); });
  bindSeg('segLeaver', () => C.leaver, (v) => { C.leaver = v; });

  $('#btnRandomPick').addEventListener('click', randomPick);
  $('#btnClearPick').addEventListener('click', () => { state.players.forEach((p) => { p.pick = null; }); renderRoster(); save(); });
  $('#btnAddCoinPlayer').addEventListener('click', () => {
    if (state.players.length >= App.MAX_PLAYERS) return;
    state.players.push(App.newPlayer(state.players.length)); renderRoster(); save();
  });
  $('#btnResetStats').addEventListener('click', () => {
    if (!confirm('¿Borrar estadísticas y aciertos?')) return;
    C.totals = { milei: 0, cristina: 0 }; C.history = []; state.players.forEach((p) => { p.hits = 0; });
    renderStats(); renderRoster(); save();
  });

  App.register('coin', {
    enter() {
      renderRoster(); renderSeries(); renderStats(); updateButton(); refreshMode();
      idleT0 = performance.now(); startLoop();
    },
    leave() { stopLoop(); },
  });

  // estado inicial de la moneda
  setCoin(0, 0, 0, 1);
})();
