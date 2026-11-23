/* Historial y logros (0.7): guarda cómo le va a cada compañero a lo largo de las partidas
   y le da medallas graciosas. Todo queda en este celular. */
'use strict';

(() => {
  const { state, save, el, $ } = App;
  if (!state.hist) state.hist = { players: {}, log: [] };
  const H = state.hist;

  /* m = lo que hizo en esta partida · c = su carrera (ya sumada esta partida) */
  const ACH = [
    { id: 'first', emoji: '🥇', name: 'Primera victoria', desc: 'Ganar una partida.', test: (m, c) => c.wins >= 1 },
    { id: 'streak3', emoji: '🔥', name: 'En racha', desc: 'Ganar 3 seguidas.', test: (m, c) => c.streak >= 3 },
    { id: 'vet10', emoji: '🎖️', name: 'Veterano', desc: 'Jugar 10 partidas.', test: (m, c) => c.games >= 10 },
    { id: 'vet30', emoji: '🏅', name: 'Curtido', desc: 'Jugar 30 partidas.', test: (m, c) => c.games >= 30 },
    { id: 'kill25', emoji: '💀', name: 'Asesino serial', desc: '25 bajas en total.', test: (m, c) => c.kills >= 25 },
    { id: 'kill100', emoji: '👑', name: 'Leyenda', desc: '100 bajas en total.', test: (m, c) => c.kills >= 100 },
    { id: 'sniper', emoji: '🔭', name: 'Ojo de lince', desc: 'Una baja a 16 casilleros o más.', test: (m) => m.longKill >= 16 },
    { id: 'eagle', emoji: '🎯', name: 'Ojo de águila', desc: 'Más de 60% de puntería (con 20 balas o más).', test: (m) => m.rounds >= 20 && m.hits / m.rounds >= 0.6 },
    { id: 'knives', emoji: '🔪', name: 'Carnicero', desc: '3 bajas a puñaladas en una partida.', test: (m) => m.knifeKills >= 3 },
    { id: 'ghost', emoji: '👻', name: 'Intocable', desc: 'Ganar sin que te lastimen.', test: (m) => m.won && m.dmgTaken <= 0.5 && m.players > 2 },
    { id: 'nade', emoji: '💣', name: 'Granadero', desc: 'Tirar 5 granadas en una partida.', test: (m) => m.thrown >= 5 },
    { id: 'tank', emoji: '🦺', name: 'Tanque', desc: 'Frenar 150 de daño con el chaleco.', test: (m) => m.absorbed >= 150 },
    { id: 'medic', emoji: '🩹', name: 'Enfermero', desc: 'Recuperar 150 de vida con botiquines.', test: (m) => m.healed >= 150 },
    { id: 'chicken', emoji: '🐔', name: 'Gallina', desc: 'Pasar 40 s escondido o huyendo.', test: (m) => m.hidden + m.fled >= 40 },
    { id: 'loud', emoji: '🗣️', name: 'Bocón', desc: 'Gritar 15 insultos en una partida.', test: (m) => m.talk >= 15 },
    { id: 'flag', emoji: '🚩', name: 'Ladrón de banderas', desc: 'Capturar 2 banderas en una partida.', test: (m) => m.mode === 'ctf' && m.score >= 2 },
    { id: 'hill', emoji: '👑', name: 'Rey de la colina', desc: 'Ganar en el modo Colina.', test: (m) => m.mode === 'koth' && m.won },
    { id: 'gold', emoji: '🪙', name: 'Cazafortunas', desc: 'Ganar la carrera de botín.', test: (m) => m.mode === 'loot' && m.won },
    { id: 'defuse', emoji: '✂️', name: 'Desactivador', desc: 'Desactivar la bomba o plantarla.', test: (m) => m.mode === 'bomb' && m.score >= 1 },
    { id: 'waves', emoji: '🌊', name: 'Sobreviviente', desc: 'Pasar las 5 oleadas.', test: (m) => m.mode === 'waves' && m.won },
    { id: 'champ', emoji: '🏆', name: 'Campeón del torneo', desc: 'Ganar un torneo.', test: (m, c) => c.tourns >= 1 },
  ];

  const blank = () => ({ games: 0, wins: 0, kills: 0, deaths: 0, dmg: 0, rounds: 0, hits: 0, streak: 0, best: 0, tourns: 0, secs: 0, ach: {}, last: 0, modes: {} });
  const career = (name) => H.players[name] || (H.players[name] = blank());

  /** Suma una partida terminada. Devuelve los logros nuevos: [{ name, items: [ACH] }]. */
  function record(res) {
    const out = [], players = res.ranking;
    for (const s of players) {
      const won = res.winners.includes(s), c = career(s.name), st = s.stats;
      c.games++; if (won) { c.wins++; c.streak++; c.best = Math.max(c.best, c.streak); } else c.streak = 0;
      c.kills += s.kills; c.deaths += s.deaths || (s.alive ? 0 : 1); c.dmg += Math.round(st.dmgDealt); c.rounds += st.rounds; c.hits += st.hits; c.secs += Math.round(res.time); c.last = Date.now();
      c.modes[res.mode] = (c.modes[res.mode] || 0) + 1;
      const m = { won, mode: res.mode, players: players.length, kills: s.kills, dmgTaken: st.dmgTaken || 0, rounds: st.rounds, hits: st.hits, longKill: st.longKill, knifeKills: st.knifeKills, thrown: st.thrown,
        absorbed: st.absorbed || 0, healed: st.healed || 0, hidden: st.hidden, fled: st.fled, talk: st.talk, score: s.score || 0 };
      const got = ACH.filter((a) => !c.ach[a.id] && a.test(m, c));
      got.forEach((a) => { c.ach[a.id] = Date.now(); });
      if (got.length) out.push({ name: s.name, items: got });
    }
    H.log.unshift({ t: Date.now(), mode: res.mode, secs: Math.round(res.time), winners: res.winners.map((s) => s.name), players: players.map((s) => s.name) });
    if (H.log.length > 80) H.log.length = 80;
    save();
    return out;
  }
  /** El campeón de un torneo suma su logro. */
  function recordTourney(name) {
    const c = career(name); c.tourns++;
    const got = ACH.filter((a) => !c.ach[a.id] && a.test({}, c));
    got.forEach((a) => { c.ach[a.id] = Date.now(); });
    save();
    return got;
  }

  /* ---------- pantalla ---------- */
  let sel = null;
  function open(names) {
    let box = $('#histModal');
    if (!box) { box = el('div', { id: 'histModal', class: 'modal', hidden: true }); document.body.append(box); }
    const all = new Set(Object.keys(H.players)); (names || []).forEach((n) => all.add(n));
    const list = [...all];
    if (!sel || !all.has(sel)) {
      const pool = (names || []).filter((n) => H.players[n]).sort((a, b) => H.players[b].games - H.players[a].games);
      sel = pool[0] || (names && names[0]) || list[0] || null;
    }
    box.innerHTML = '';
    const head = el('div', { class: 'card-head' }, el('b', {}, '🏅 Logros e historial'), el('span', { class: 'spacer' }),
      el('button', { class: 'btn small', onclick: () => { box.hidden = true; } }, '✕ Cerrar'));
    const inner = el('div', { class: 'modal-box' }, head);
    if (!list.length) inner.append(el('p', { class: 'hint' }, 'Todavía no hay partidas guardadas. ¡Jugá una y volvé!'));
    else {
      const chips = el('div', { class: 'hchips' }, list.map((n) => el('button', { class: 'btn small' + (n === sel ? ' primary' : ''), onclick: () => { sel = n; open(names); } }, n)));
      inner.append(chips);
      const c = H.players[sel] || blank();
      const acc = c.rounds ? Math.round(c.hits / c.rounds * 100) : 0, kd = c.deaths ? (c.kills / c.deaths).toFixed(2) : String(c.kills);
      const stat = (k, v) => el('div', { class: 'hstat' }, el('b', {}, String(v)), el('span', {}, k));
      inner.append(el('div', { class: 'hgrid' }, stat('Partidas', c.games), stat('Victorias', c.wins), stat('% victorias', c.games ? Math.round(c.wins / c.games * 100) + '%' : '–'),
        stat('Bajas', c.kills), stat('Bajas / caídas', kd), stat('Puntería', acc + '%'), stat('Mejor racha', c.best), stat('Torneos', c.tourns), stat('Daño total', c.dmg)));
      const got = ACH.filter((a) => c.ach[a.id]).length;
      inner.append(el('div', { class: 'sect-title' }, `Medallas ${got}/${ACH.length}`));
      inner.append(el('div', { class: 'achs' }, ACH.map((a) => el('div', { class: 'ach' + (c.ach[a.id] ? ' on' : '') }, el('span', { class: 'ae' }, c.ach[a.id] ? a.emoji : '🔒'), el('b', {}, a.name), el('small', {}, a.desc)))));
      const mine = H.log.filter((g) => g.players.includes(sel)).slice(0, 8);
      if (mine.length) {
        inner.append(el('div', { class: 'sect-title' }, 'Últimas partidas'));
        inner.append(el('div', { class: 'rank-list' }, mine.map((g) => el('div', {}, el('span', {}, new Date(g.t).toLocaleDateString()), el('span', {}, g.winners.includes(sel) ? '🏆 ganó' : '✖ perdió'),
          el('span', { class: 'k' }, `${(App.Modes.defs[g.mode] || {}).emoji || ''} ${Math.floor(g.secs / 60)}m${g.secs % 60}s`)))));
      }
    }
    inner.append(el('div', { class: 'row-actions' }, el('button', { class: 'btn small ghost', onclick: () => { if (confirm('¿Borrar todo el historial y las medallas?')) { H.players = {}; H.log = []; sel = null; save(); open(names); } } }, 'Borrar historial')));
    box.append(inner);
    box.hidden = false;
  }
  App.Hist = { ACH, record, recordTourney, open, career };
})();
