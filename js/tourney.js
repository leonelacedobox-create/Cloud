/* Torneo (0.7): cuadro de eliminación directa para decidir "quién se va temprano".
   Cada cruce es un duelo 1 contra 1 que se puede mirar en vivo o simular al instante.
   Incluye apuestas al campeón y la moneda de desempate (Milei contra Cristina). */
'use strict';

(() => {
  const { state, save, el, $, pname, sfx, shuffle } = App;
  const B = state.battle;
  const E = App.battle;

  const lines = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 8);
  const T = () => state.tourn;
  let live = false;                                              // hay un duelo del torneo en pantalla

  /* ---------- el cuadro ---------- */
  function build(parts) {
    const n = parts.length, size = Math.max(2, 1 << Math.ceil(Math.log2(n)));
    const order = shuffle(parts.map((_, i) => i));
    const first = [];
    for (let i = 0; i < size / 2; i++) first.push({ a: order[i], b: size - 1 - i < n ? order[size - 1 - i] : null, w: null });
    const rounds = [first];
    for (let m = size / 4; m >= 1; m /= 2) rounds.push(Array.from({ length: m }, () => ({ a: null, b: null, w: null })));
    return rounds;
  }
  function advance(t) {                                          // pasa a los que tienen "bye" y acomoda a los ganadores
    let changed = true;
    while (changed) {
      changed = false;
      t.rounds.forEach((round, r) => round.forEach((m, i) => {
        if (r === 0 && m.w == null && m.a != null && m.b == null) { m.w = m.a; m.how = 'bye'; changed = true; }
        if (m.w != null && r + 1 < t.rounds.length) {
          const nx = t.rounds[r + 1][i >> 1], key = i % 2 === 0 ? 'a' : 'b';
          if (nx[key] !== m.w) { nx[key] = m.w; changed = true; }
        }
      }));
    }
    const last = t.rounds[t.rounds.length - 1][0];
    if (last.w != null && t.champion == null) { t.champion = last.w; settle(t); }
  }
  const roundName = (t, r) => { const left = t.rounds[r].length; return left === 1 ? '🏆 Final' : left === 2 ? 'Semifinales' : left === 4 ? 'Cuartos de final' : left === 8 ? 'Octavos de final' : `Ronda ${r + 1}`; };
  const person = (t, i) => (i == null ? null : t.parts[i]);

  /** Apuestas al campeón y logro del ganador. */
  function settle(t) {
    const champ = person(t, t.champion), res = [];
    for (const [pid, bet] of Object.entries(t.bets || {})) {
      const bettor = t.parts.find((p) => String(p.id) === pid), target = t.parts[bet];
      if (!bettor || !target) continue;
      const ok = bet === t.champion;
      const rp = state.players.find((p) => String(p.id) === pid); if (rp) rp.hits = (rp.hits || 0) + (ok ? 1 : 0);
      (B.betLog = B.betLog || []).push({ t: Date.now(), name: bettor.name, ok });
      res.push({ name: bettor.name, on: target.name, ok });
    }
    t.betRes = res;
    t.unlocked = App.Hist ? App.Hist.recordTourney(champ.name) : [];
    save();
  }

  /* ---------- un duelo ---------- */
  const duelCfg = (t, a, b) => ({
    mode: 'classic', teamMode: false, lives: 3, map: t.map || 'arena', size: 's', powerups: true, zone: true, varied: true, loot: true, gear: true, props: true, events: false,
    talk: B.talk !== false, laser: false, friendly: false, slowmo: true, seed: null,
    players: [a, b].map((p) => ({ id: p.id, name: p.name, color: p.color, team: 0, pers: p.pers || 'auto', iq: p.iq == null ? 1 : p.iq, role: 'none', hat: p.hat, photo: p.photo, phrases: lines(p.phrases) })),
  });
  const winnerOf = (t, m, res) => {                              // devuelve el índice del ganador, o null si hubo empate
    const w = res.winners && res.winners.length === 1 ? res.winners[0] : null;
    if (!w) return null;
    const pid = w.pid;
    return [m.a, m.b].find((i) => t.parts[i].id === pid);
  };
  function setResult(t, ri, mi, res, how) {
    const m = t.rounds[ri][mi], w = winnerOf(t, m, res);
    m.secs = Math.round(res.time || 0);
    if (w == null) { m.tie = true; m.how = how; } else { m.w = w; m.tie = false; m.how = how; }
    advance(t); save();
  }

  /** Simula el duelo sin dibujar, en pedacitos para que la pantalla no se congele. */
  function simulate(cfg) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;left:0;top:0;width:360px;height:640px;visibility:hidden;pointer-events:none';
      const cv = document.createElement('canvas'); wrap.append(cv); document.body.append(wrap);
      let result = null;
      const g = new E.Game(cv, Object.assign({}, cfg, { noRec: true, slowmo: false }), { onKill() {}, onPickup() {}, onEnd(r) { result = r; }, onFrame() {}, onEvent() {} });
      g.phase = 'run';
      const tick = () => {
        const t0 = performance.now();
        while (!result && g.time < 400 && performance.now() - t0 < 25) g.step(1 / 60);
        if (result || g.time >= 400) { const r = result || g.result(); if (!result) r.winners = []; g.destroy(); wrap.remove(); resolve(r); }
        else setTimeout(tick, 0);
      };
      tick();
    });
  }

  /* ---------- la moneda de desempate ---------- */
  /** Muestra la moneda girando. `groups` es una lista de bandos (listas de soldados): se juegan de a dos hasta que queda uno. */
  async function coinBreak(groups) {
    let pool = groups.slice();
    while (pool.length > 1) {
      const a = pool.shift(), b = pool.shift(), win = await flip(a, b);
      pool.push(win === 0 ? a : b);
    }
    return pool[0];
  }
  const label = (g) => g.map((s) => s.name).join(', ');
  function flip(a, b) {
    return new Promise((resolve) => {
      const win = Math.random() < 0.5 ? 0 : 1;
      const m = el('div', { class: 'modal', id: 'coinModal' });
      const coin = el('div', { class: 'tcoin' }, el('div', { class: 'tf f' }), el('div', { class: 'tf b' }));
      const msg = el('h2', { class: 'win-title' }, '🪙 Moneda al aire…');
      const btn = el('button', { class: 'btn primary', hidden: true }, 'Seguir');
      m.append(el('div', { class: 'modal-box center' },
        el('p', { class: 'win-sub' }, `Cara de Milei: ${label(a)}`), el('p', { class: 'win-sub' }, `Cara de Cristina: ${label(b)}`),
        el('div', { class: 'tcoin-stage' }, coin), msg, btn));
      document.body.append(m);
      sfx.whoosh && sfx.whoosh();
      const turns = 8 + (win === 0 ? 0 : 1);                      // par = Milei, impar = Cristina
      requestAnimationFrame(() => requestAnimationFrame(() => { coin.style.transform = `translateY(-30px) rotateY(${turns * 180}deg)`; setTimeout(() => { coin.style.transform = `translateY(0) rotateY(${turns * 180}deg)`; }, 1500); }));
      const iv = setInterval(() => sfx.coinRing && Math.random() < 0.4 && sfx.coinRing(), 260);
      setTimeout(() => {
        clearInterval(iv);
        msg.textContent = `🏆 ¡${win === 0 ? 'Milei' : 'Cristina'}! Gana ${label(win === 0 ? a : b)}`;
        sfx.fanfare && sfx.fanfare(); btn.hidden = false;
      }, 2200);
      btn.onclick = () => { m.remove(); resolve(win); };
    });
  }

  /* ---------- pantalla ---------- */
  let modal = null;
  const avatar = (p) => (p.photo ? el('img', { class: 'ava', src: p.photo, alt: '', style: `border-color:${p.color}` }) : el('span', { class: 'dot', style: `background:${p.color}` }));
  const who = (t, i, w) => {
    const p = person(t, i);
    return el('div', { class: 'tm-p' + (w != null && w === i ? ' win' : w != null ? ' lose' : '') }, p ? [avatar(p), el('span', {}, p.name)] : el('span', { class: 'muted' }, '…'));
  };
  let busy = false;
  function render() {
    const t = T(); if (!modal) return;
    modal.innerHTML = '';
    const box = el('div', { class: 'modal-box' });
    box.append(el('div', { class: 'card-head' }, el('b', {}, `🏟️ Torneo · ${t.parts.length} jugadores`), el('span', { class: 'spacer' }),
      el('button', { class: 'btn small', onclick: close }, '✕ Cerrar')));
    if (t.champion != null) {
      const c = person(t, t.champion);
      box.append(el('div', { class: 'champ' }, el('div', { class: 'big' }, '🏆'), el('h2', { class: 'win-title' }, `¡${c.name} es el campeón!`), el('p', { class: 'win-sub' }, `🚪 ${c.name} se va temprano hoy`)));
      if (t.betRes && t.betRes.length) box.append(el('div', { class: 'awards' }, t.betRes.map((b) => el('div', {}, `${b.ok ? '✅' : '❌'} `, el('b', {}, b.name), ` apostó a ${b.on}${b.ok ? ' (+1)' : ''}`))));
      if (t.unlocked && t.unlocked.length) box.append(el('div', { class: 'awards' }, el('div', {}, `🏅 ${c.name}: ${t.unlocked.map((a) => a.emoji + ' ' + a.name).join(', ')}`)));
    } else {
      const started = t.rounds.some((r) => r.some((m) => m.w != null && m.how !== 'bye'));
      if (!started) {                                            // apuestas al campeón (hasta que arranque el primer duelo)
        box.append(el('div', { class: 'sect-title' }, '🎯 Apuestas al campeón'));
        box.append(el('div', { class: 'tbets' }, t.parts.map((p) => el('label', { class: 'sel' }, `${p.name} apuesta a`,
          el('select', { onchange: (e) => { t.bets = t.bets || {}; if (e.target.value === '') delete t.bets[p.id]; else t.bets[p.id] = +e.target.value; save(); } },
            el('option', { value: '' }, 'Nadie'), t.parts.map((q, j) => el('option', Object.assign({ value: j }, t.bets && t.bets[p.id] === j ? { selected: true } : {}), q.name)))))));
        box.append(el('div', { class: 'seg small', id: 'tMap' }, [['arena', 'Arena'], ['rooms', 'Habitaciones'], ['maze', 'Laberinto']].map(([k, v]) => el('button', { class: (t.map || 'arena') === k ? 'on' : '', onclick: () => { t.map = k; save(); render(); } }, v))));
      }
    }
    t.rounds.forEach((round, ri) => {
      box.append(el('div', { class: 'sect-title' }, roundName(t, ri)));
      round.forEach((m, mi) => {
        const ready = m.a != null && m.b != null && m.w == null;
        const row = el('div', { class: 'tm' + (ready ? ' ready' : '') }, who(t, m.a, m.w), el('span', { class: 'vs' }, m.how === 'bye' ? 'pasa' : 'vs'), m.how === 'bye' ? el('div', { class: 'tm-p muted' }, '—') : who(t, m.b, m.w));
        if (m.w != null && m.how !== 'bye') row.append(el('small', { class: 'how' }, `${m.how === 'sim' ? '⚡' : m.how === 'coin' ? '🪙' : '🎮'}${m.secs ? ' ' + m.secs + 's' : ''}`));
        if (ready && t.champion == null) {
          const acts = el('div', { class: 'tm-acts' });
          if (m.tie) acts.append(el('button', { class: 'btn small primary', onclick: () => coinTie(ri, mi) }, '🪙 Empate: desempatar con la moneda'));
          else {
            acts.append(el('button', { class: 'btn small primary', onclick: () => playLive(ri, mi) }, '▶ Mirar el duelo'));
            acts.append(el('button', { class: 'btn small', onclick: () => simOne(ri, mi) }, '⚡ Simular'));
          }
          row.append(acts);
        }
        box.append(row);
      });
    });
    const foot = el('div', { class: 'res-btns' });
    if (t.champion == null) foot.append(el('button', { class: 'btn primary wide', disabled: busy, onclick: simAll }, busy ? '⏳ Simulando…' : '⚡ Simular todo el torneo'));
    foot.append(el('button', { class: 'btn', onclick: () => { if (confirm('¿Cancelar el torneo?')) { state.tourn = null; save(); close(); } } }, '🗑 Terminar'));
    box.append(foot);
    modal.append(box);
  }
  function close() { if (modal) modal.hidden = true; }
  function open() {
    if (!T()) return;
    if (!modal) { modal = el('div', { id: 'tournModal', class: 'modal', hidden: true }); document.body.append(modal); }
    live = false;
    render(); modal.hidden = false;
  }
  const mk = (p, i) => ({ id: p.id, name: pname(p, i), color: p.color, pers: p.pers || 'auto', iq: p.iq == null ? 1 : p.iq, hat: p.hat || 'none', photo: p.photo || null, phrases: p.phrases || '' });
  function start() {
    if (T() && !confirm('Ya hay un torneo armado. ¿Empezar uno nuevo?')) { open(); return; }
    const parts = state.players.map(mk);
    if (parts.length < 2) return;
    const t = { parts, rounds: build(parts), champion: null, bets: {}, map: 'arena', t: Date.now() };
    state.tourn = t; advance(t); save(); open();
  }
  async function simOne(ri, mi) {
    const t = T(), m = t.rounds[ri][mi]; if (busy) return;
    busy = true; render();
    const res = await simulate(duelCfg(t, person(t, m.a), person(t, m.b)));
    busy = false;
    setResult(t, ri, mi, res, 'sim'); render();
  }
  async function simAll() {
    const t = T(); if (busy) return; busy = true; render();
    for (let guard = 0; guard < 40 && t.champion == null; guard++) {
      let did = false;
      for (let ri = 0; ri < t.rounds.length && t.champion == null; ri++) for (let mi = 0; mi < t.rounds[ri].length; mi++) {
        const m = t.rounds[ri][mi];
        if (m.a == null || m.b == null || m.w != null) continue;
        did = true;
        if (m.tie) { const w = await flipPair(t, m); m.w = w; m.how = 'coin'; m.tie = false; advance(t); save(); continue; }
        const res = await simulate(duelCfg(t, person(t, m.a), person(t, m.b)));
        setResult(t, ri, mi, res, 'sim');
        if (t.rounds[ri][mi].tie) { const w = await flipPair(t, t.rounds[ri][mi]); const mm = t.rounds[ri][mi]; mm.w = w; mm.how = 'coin'; mm.tie = false; advance(t); save(); }
        render();
      }
      if (!did) break;
    }
    busy = false; render();
  }
  const soldierLike = (p) => [{ name: p.name }];
  async function flipPair(t, m) {                                // elige al azar en pantalla: devuelve el índice ganador
    const a = person(t, m.a), b = person(t, m.b);
    const win = await flip(soldierLike(a), soldierLike(b));
    return win === 0 ? m.a : m.b;
  }
  async function coinTie(ri, mi) {
    const t = T(), m = t.rounds[ri][mi];
    m.w = await flipPair(t, m); m.how = 'coin'; m.tie = false; advance(t); save(); render();
  }
  function playLive(ri, mi) {
    const t = T(), m = t.rounds[ri][mi];
    close(); live = true;
    E.setMatchHook((res) => { setResult(t, ri, mi, res, 'game'); });
    E.startGame(duelCfg(t, person(t, m.a), person(t, m.b)));
  }

  App.Tourney = { start, open, coinBreak, get live() { return live; }, get active() { return !!T(); } };

  const btn = $('#btnTourney');
  if (btn) btn.addEventListener('click', () => { if (T() && T().champion == null) open(); else start(); });
  const resume = $('#btnTourneyOpen');
  if (resume) resume.addEventListener('click', () => open());
})();
