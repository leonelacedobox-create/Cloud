#!/usr/bin/env node
/* Banco de pruebas de la IA: simula cientos de partidas sin dibujar nada y genera un reporte.
 *
 *   node tools/bench.js            (8 partidas por configuración, ~1 minuto)
 *   node tools/bench.js --runs 30  (más partidas, más preciso)
 *   node tools/bench.js --json     (además guarda bench-report.json)
 *
 * Requiere Playwright (npm i playwright) o el que ya trae el entorno. Abre index.html directo del disco.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? +args[i + 1] : true); };
const RUNS = flag('runs', 8);
const WRITE_JSON = args.includes('--json');
const ROOT = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'index.html'));

  const report = await page.evaluate((RUNS) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:0;top:0;width:372px;height:662px';
    const cv = document.createElement('canvas'); wrap.appendChild(cv); document.body.appendChild(wrap);
    const NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const PERS = Object.keys(Personas.PERS);

    /** Juega una partida completa y devuelve lo que pasó. */
    function play(c) {
      const players = NAMES.slice(0, c.n).map((n, i) => ({
        name: n, color: '#ff0000', team: c.teams ? i % 2 : 0,
        pers: c.pers ? c.pers[i % c.pers.length] : 'auto', iq: c.iq ? c.iq[i % c.iq.length] : 1,
      }));
      const cfg = { players, teamMode: !!c.teams, lives: c.lives || 3, map: c.map, size: c.size || 'm', powerups: true, zone: c.zone !== false, varied: true, loot: c.loot !== false, friendly: !!c.friendly, talk: true, seed: c.seed };
      const g = new App.battle.Game(cv, cfg, { onKill() {}, onPickup() {}, onEnd() {}, onFrame() {} });
      g.phase = 'run'; g.paused = false;
      const modeEntries = {}, actEntries = {}, lastMode = g.soldiers.map(() => ''), seenActs = new WeakSet();
      const t0 = performance.now();
      while (g.phase === 'run' && g.time < 700) {
        g.step(1 / 60);
        g.soldiers.forEach((s, i) => {
          if (!s.alive) return;
          if (s.mode !== lastMode[i]) { lastMode[i] = s.mode; modeEntries[s.mode] = (modeEntries[s.mode] || 0) + 1; }
          if (s.act && !seenActs.has(s.act)) { seenActs.add(s.act); actEntries[s.act.type] = (actEntries[s.act.type] || 0) + 1; }
        });
      }
      // por si terminó en empate o por tiempo
      const winners = g.winners || [];
      const out = {
        t: g.time, timeout: g.phase === 'run', draw: g.phase !== 'run' && winners.length === 0,
        winners: winners.map((s) => ({ pers: s.pers, iq: s.iq, team: s.team })),
        soldiers: g.soldiers.map((s) => ({ pers: s.pers, iq: s.iq, alive: s.alive, deathT: s.alive ? g.time : s.deathT, kills: s.kills, dmg: s.stats.dmgDealt, shots: s.stats.shots, hits: s.stats.hits, rounds: s.stats.rounds, hidden: s.stats.hidden, fled: s.stats.fled, talk: s.stats.talk, stuck: s.stats.stuck, killsBy: s.stats.killsBy, shared: s.stats.shared, long: s.stats.longKill })),
        stuck: g.stuckEvents, modeEntries, actEntries, ms: performance.now() - t0, seed: g.seed,
      };
      g.destroy();
      return out;
    }
    const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

    /* ---- 1) configuraciones típicas ---- */
    const CONFIGS = [
      { name: 'Laberinto, zona, 10', map: 'maze', n: 10 },
      { name: 'Laberinto, sin zona, 10', map: 'maze', n: 10, zone: false },
      { name: 'Habitaciones, zona, 10', map: 'rooms', n: 10 },
      { name: 'Arena, zona, 10', map: 'arena', n: 10 },
      { name: 'Habitaciones, equipos, 10', map: 'rooms', n: 10, teams: true },
      { name: 'Laberinto, 4 soldados', map: 'maze', n: 4 },
      { name: 'Laberinto, 2 soldados', map: 'maze', n: 2 },
      { name: 'Grande, 10', map: 'maze', n: 10, size: 'l' },
      { name: 'Chico, 10', map: 'maze', n: 10, size: 's' },
      { name: '1 vida, 10', map: 'maze', n: 10, lives: 1 },
      { name: 'Sin armas del piso, 10', map: 'maze', n: 10, loot: false },
      { name: 'Fuego amigo, equipos', map: 'rooms', n: 10, teams: true, friendly: true },
    ];
    const rows = CONFIGS.map((c) => {
      const res = []; for (let r = 0; r < RUNS; r++) res.push(play(c));
      const sum = (f) => res.reduce((a, x) => a + f(x), 0) / res.length;
      const modes = {}, acts = {}, kb = {};
      res.forEach((x) => {
        for (const k in x.modeEntries) modes[k] = (modes[k] || 0) + x.modeEntries[k] / res.length;
        for (const k in x.actEntries) acts[k] = (acts[k] || 0) + x.actEntries[k] / res.length;
        x.soldiers.forEach((s) => { for (const w in s.killsBy) kb[w] = (kb[w] || 0) + s.killsBy[w] / res.length; });
      });
      const ts = res.map((x) => x.t);
      return { name: c.name, med: med(ts), min: Math.min(...ts), max: Math.max(...ts), timeouts: res.filter((x) => x.timeout).length, draws: res.filter((x) => x.draw).length,
        stuck: sum((x) => x.stuck), cpu: sum((x) => x.ms), modes, acts, kb, shots: sum((x) => x.soldiers.reduce((a, s) => a + s.shots, 0)),
        acc: res.reduce((a, x) => a + x.soldiers.reduce((b, s) => b + s.hits, 0), 0) / Math.max(1, res.reduce((a, x) => a + x.soldiers.reduce((b, s) => b + s.rounds, 0), 0)) };
    });

    /* ---- 2) balance por personalidad (1 de cada una + 2 al azar) ---- */
    const balRuns = Math.max(RUNS * 4, 24);
    const bal = {}; PERS.forEach((p) => { bal[p] = { n: 0, wins: 0, life: 0, kills: 0, hidden: 0, fled: 0, talk: 0, dmg: 0 }; });
    for (let r = 0; r < balRuns; r++) {
      const order = PERS.slice().sort(() => Math.random() - 0.5);
      const res = play({ map: ['maze', 'rooms', 'arena'][r % 3], n: 10, pers: order.concat(order.slice(0, 2)), zone: true });
      res.soldiers.forEach((s) => { const b = bal[s.pers]; b.n++; b.life += s.deathT; b.kills += s.kills; b.hidden += s.hidden; b.fled += s.fled; b.talk += s.talk; b.dmg += s.dmg; });
      res.winners.forEach((w) => { bal[w.pers].wins++; });
    }

    /* ---- 3) balance por inteligencia (novato, normal, veterano, maestro) ---- */
    const iqb = [0, 1, 2, 3].map(() => ({ n: 0, wins: 0, life: 0, kills: 0 }));
    for (let r = 0; r < balRuns; r++) {
      const res = play({ map: ['maze', 'rooms', 'arena'][r % 3], n: 8, iq: [0, 1, 2, 3], pers: [PERS[r % PERS.length]], zone: true });
      res.soldiers.forEach((s) => { const b = iqb[s.iq]; b.n++; b.life += s.deathT; b.kills += s.kills; });
      res.winners.forEach((w) => { iqb[w.iq].wins++; });
    }

    /* ---- 4) la semilla repite el mapa ---- */
    const a = new App.battle.Game(cv, { players: [{ name: 'A', color: '#f00', team: 0 }, { name: 'B', color: '#0f0', team: 0 }], teamMode: false, lives: 3, map: 'maze', size: 'm', seed: '4242' }, { onKill() {}, onPickup() {}, onEnd() {}, onFrame() {} });
    const b = new App.battle.Game(cv, { players: [{ name: 'A', color: '#f00', team: 0 }, { name: 'B', color: '#0f0', team: 0 }], teamMode: false, lives: 3, map: 'maze', size: 'm', seed: '4242' }, { onKill() {}, onPickup() {}, onEnd() {}, onFrame() {} });
    const sameMap = a.g.length === b.g.length && a.g.every((v, i) => v === b.g[i]) && a.items.length === b.items.length && a.items.every((it, i) => it.type === b.items[i].type && Math.abs(it.x - b.items[i].x) < 1e-9);
    a.destroy(); b.destroy();

    return { rows, bal, iqb, sameMap, balRuns };
  }, RUNS);

  /* ----- reporte ----- */
  const L = [];
  const f1 = (v) => (typeof v === 'number' ? v.toFixed(1) : v);
  L.push('# Reporte del banco de pruebas', '', `Partidas por configuración: ${RUNS} · semilla repetible: ${report.sameMap ? '✅ sí' : '❌ NO'}`, '');
  L.push('## Duración y salud de las partidas', '', '| Configuración | mediana | mín–máx | tiempo agotado | empates | trabas | CPU/partida | puntería |', '|---|---|---|---|---|---|---|---|');
  report.rows.forEach((r) => L.push(`| ${r.name} | ${Math.round(r.med)}s | ${Math.round(r.min)}–${Math.round(r.max)}s | ${r.timeouts} | ${r.draws} | ${f1(r.stuck)} | ${Math.round(r.cpu)}ms | ${Math.round(r.acc * 100)}% |`));
  L.push('', '## Tácticas usadas (veces por partida, promedio de todas las configuraciones)', '');
  const tot = { modes: {}, acts: {}, kb: {} };
  report.rows.forEach((r) => { for (const k in r.modes) tot.modes[k] = (tot.modes[k] || 0) + r.modes[k] / report.rows.length; for (const k in r.acts) tot.acts[k] = (tot.acts[k] || 0) + r.acts[k] / report.rows.length; for (const k in r.kb) tot.kb[k] = (tot.kb[k] || 0) + r.kb[k] / report.rows.length; });
  L.push('Modos: ' + Object.entries(tot.modes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${f1(v)}`).join(' · '));
  L.push('', 'Acciones: ' + Object.entries(tot.acts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${f1(v)}`).join(' · '));
  L.push('', 'Bajas por arma: ' + Object.entries(tot.kb).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${f1(v)}`).join(' · '));
  L.push('', `## Balance por personalidad (${report.balRuns} partidas de 10, todas con el mismo peso)`, '', '| Personalidad | victorias | % | vida media | bajas | escondido | huyendo | frases |', '|---|---|---|---|---|---|---|---|');
  Object.entries(report.bal).forEach(([k, b]) => L.push(`| ${k} | ${b.wins} | ${Math.round(b.wins / Math.max(1, report.balRuns) * 100)}% | ${Math.round(b.life / b.n)}s | ${f1(b.kills / b.n)} | ${Math.round(b.hidden / b.n)}s | ${Math.round(b.fled / b.n)}s | ${f1(b.talk / b.n)} |`));
  L.push('', `## Balance por inteligencia (${report.balRuns} partidas de 8: 2 de cada nivel)`, '', '| Nivel | victorias | vida media | bajas |', '|---|---|---|---|');
  ['Novato', 'Normal', 'Veterano', 'Maestro'].forEach((n, i) => { const b = report.iqb[i]; L.push(`| ${n} | ${b.wins} | ${Math.round(b.life / b.n)}s | ${f1(b.kills / b.n)} |`); });

  // alertas
  const alerts = [];
  report.rows.forEach((r) => { if (r.timeouts) alerts.push(`⚠️ "${r.name}": ${r.timeouts} partidas no terminaron.`); if (r.stuck > 3) alerts.push(`⚠️ "${r.name}": ${f1(r.stuck)} trabas por partida.`); if (r.draws > RUNS * 0.2) alerts.push(`⚠️ "${r.name}": muchos empates (${r.draws}).`); });
  Object.entries(report.bal).forEach(([k, b]) => { const p = b.wins / Math.max(1, report.balRuns); if (p > 0.3) alerts.push(`⚠️ "${k}" gana demasiado (${Math.round(p * 100)}%).`); if (p < 0.03) alerts.push(`⚠️ "${k}" casi nunca gana (${Math.round(p * 100)}%).`); });
  if (!report.sameMap) alerts.push('❌ La semilla no repite el mapa.');
  if (errors.length) alerts.push('❌ Errores de JavaScript: ' + errors.join(' | '));
  L.push('', '## Alertas', '', alerts.length ? alerts.join('\n') : '✅ Sin alertas.');
  console.log(L.join('\n'));
  if (WRITE_JSON) fs.writeFileSync(path.join(ROOT, 'bench-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
