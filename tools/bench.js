#!/usr/bin/env node
/* Banco de pruebas de la IA: simula cientos de partidas sin dibujar nada y genera un reporte.
 *
 *   node tools/bench.js            (8 partidas por configuración, ~2 minutos)
 *   node tools/bench.js --runs 16  (más partidas, más preciso)
 *   node tools/bench.js --json     (además guarda bench-report.json)
 *   node tools/bench.js --balance --runs 30   (solo el balance entre personalidades e inteligencias, con muestra grande)
 *
 * Requiere Playwright (npm i playwright) o el que ya trae el entorno. Abre index.html directo del disco.
 * Corre por tandas chicas para no gastar memoria.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? +args[i + 1] : true); };
const RUNS = flag('runs', 8);
const WRITE_JSON = args.includes('--json');
const ONLY_BALANCE = args.includes('--balance');
const ROOT = path.resolve(__dirname, '..');

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
  { name: 'Base militar, 10', map: 'base', n: 10 },
  { name: 'Oficina, 10', map: 'oficina', n: 10 },
  { name: 'Cárcel, 10', map: 'carcel', n: 10 },
  { name: 'Depósito, 10', map: 'deposito', n: 10 },
  { name: 'Mapa propio (ejemplo), 6', map: 'custom', n: 6 },
  { name: 'Sin equipo extra, 10', map: 'rooms', n: 10, gear: false },
  { name: 'Sin eventos ni props, 10', map: 'rooms', n: 10, props: false, events: false },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'index.html'));

  // Funciones de simulación dentro de la página (se definen una vez).
  await page.evaluate(() => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:0;top:0;width:372px;height:662px';
    const cv = document.createElement('canvas'); wrap.appendChild(cv); document.body.appendChild(wrap);
    const NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    const PERS = Object.keys(Personas.PERS);
    const noop = { onKill() {}, onPickup() {}, onEnd() {}, onFrame() {}, onEvent() {} };

    window.__play = function (c) {
      const players = NAMES.slice(0, c.n).map((n, i) => ({
        name: n, color: '#ff0000', team: c.teams ? i % 2 : 0,
        pers: c.pers ? c.pers[i % c.pers.length] : 'auto', iq: c.iq ? c.iq[i % c.iq.length] : 1,
      }));
      const cfg = { players, teamMode: !!c.teams, lives: c.lives || 3, map: c.map, size: c.size || 'm', powerups: true, zone: c.zone !== false, varied: true, loot: c.loot !== false, gear: c.gear !== false, props: c.props !== false, events: c.events !== false, friendly: !!c.friendly, talk: true, seed: c.seed, customMap: Maps.SAMPLE };
      const g = new App.battle.Game(cv, cfg, noop);
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
      const winners = g.winners || [];
      const sum = (f) => g.soldiers.reduce((a, s) => a + f(s), 0);
      const out = {
        t: g.time, timeout: g.phase === 'run', draw: g.phase !== 'run' && winners.length === 0,
        winners: winners.map((s) => ({ pers: s.pers, iq: s.iq })),
        soldiers: g.soldiers.map((s) => ({ pers: s.pers, iq: s.iq, deathT: s.alive ? g.time : s.deathT, kills: s.kills, dmg: s.stats.dmgDealt, shots: s.stats.shots, hits: s.stats.hits, rounds: s.stats.rounds, hidden: s.stats.hidden, fled: s.stats.fled, talk: s.stats.talk, killsBy: s.stats.killsBy })),
        stuck: g.stuckEvents, modeEntries, actEntries, ms: performance.now() - t0, overtime: !!g.overtime,
        world: Object.assign({}, g.stats, { thrown: sum((s) => s.stats.thrown), healed: sum((s) => s.stats.healed), absorbed: sum((s) => s.stats.absorbed) }),
      };
      g.destroy(); g.static = null; g.mini = null;
      return out;
    };
    window.__perm = () => PERS;
    window.__sameSeed = function () {
      const mk = () => new App.battle.Game(cv, { players: [{ name: 'A', color: '#f00', team: 0 }, { name: 'B', color: '#0f0', team: 0 }], teamMode: false, lives: 3, map: 'oficina', size: 'm', seed: '4242', gear: true, props: true }, noop);
      const a = mk(), b = mk();
      const same = a.g.length === b.g.length && a.g.every((v, i) => v === b.g[i]) && a.items.length === b.items.length && a.items.every((it, i) => it.type === b.items[i].type && Math.abs(it.x - b.items[i].x) < 1e-9);
      a.destroy(); b.destroy();
      return same;
    };
  });

  const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  const run = (c) => page.evaluate((c) => window.__play(c), c);

  /* ---- 1) configuraciones típicas ---- */
  const rows = [];
  for (const c of ONLY_BALANCE ? [] : CONFIGS) {
    process.stderr.write(`· ${c.name}\r`);
    const res = []; for (let r = 0; r < RUNS; r++) res.push(await run(c));
    const sum = (f) => res.reduce((a, x) => a + f(x), 0) / res.length;
    const modes = {}, acts = {}, kb = {}, world = {};
    res.forEach((x) => {
      for (const k in x.modeEntries) modes[k] = (modes[k] || 0) + x.modeEntries[k] / res.length;
      for (const k in x.actEntries) acts[k] = (acts[k] || 0) + x.actEntries[k] / res.length;
      for (const k in x.world) world[k] = (world[k] || 0) + x.world[k] / res.length;
      x.soldiers.forEach((s) => { for (const w in s.killsBy) kb[w] = (kb[w] || 0) + s.killsBy[w] / res.length; });
    });
    const ts = res.map((x) => x.t);
    rows.push({ name: c.name, med: med(ts), min: Math.min(...ts), max: Math.max(...ts), timeouts: res.filter((x) => x.timeout).length, draws: res.filter((x) => x.draw).length, overtime: res.filter((x) => x.overtime).length,
      stuck: sum((x) => x.stuck), cpu: sum((x) => x.ms), modes, acts, kb, world,
      acc: res.reduce((a, x) => a + x.soldiers.reduce((b, s) => b + s.hits, 0), 0) / Math.max(1, res.reduce((a, x) => a + x.soldiers.reduce((b, s) => b + s.rounds, 0), 0)) });
  }

  /* ---- 2) balance por personalidad ---- */
  const PERS = await page.evaluate(() => window.__perm());
  const balRuns = Math.max(RUNS * 4, 24);
  const bal = {}; PERS.forEach((p) => { bal[p] = { n: 0, wins: 0, life: 0, kills: 0, hidden: 0, fled: 0, talk: 0, dmg: 0 }; });
  for (let r = 0; r < balRuns; r++) {
    process.stderr.write(`· balance personalidades ${r + 1}/${balRuns}\r`);
    const order = PERS.slice().sort(() => Math.random() - 0.5);
    const res = await run({ map: ['maze', 'rooms', 'arena', 'base', 'oficina', 'carcel', 'deposito'][r % 7], n: 10, pers: order.concat(order.slice(0, 2)) });
    res.soldiers.forEach((s) => { const b = bal[s.pers]; b.n++; b.life += s.deathT; b.kills += s.kills; b.hidden += s.hidden; b.fled += s.fled; b.talk += s.talk; b.dmg += s.dmg; });
    res.winners.forEach((w) => { bal[w.pers].wins++; });
  }

  /* ---- 3) balance por inteligencia ---- */
  const iqb = [0, 1, 2, 3].map(() => ({ n: 0, wins: 0, life: 0, kills: 0 }));
  for (let r = 0; r < balRuns; r++) {
    process.stderr.write(`· balance inteligencia ${r + 1}/${balRuns}\r`);
    const res = await run({ map: ['maze', 'rooms', 'arena', 'oficina'][r % 4], n: 8, iq: [0, 1, 2, 3], pers: [PERS[r % PERS.length]] });
    res.soldiers.forEach((s) => { const b = iqb[s.iq]; b.n++; b.life += s.deathT; b.kills += s.kills; });
    res.winners.forEach((w) => { iqb[w.iq].wins++; });
  }
  const sameMap = await page.evaluate(() => window.__sameSeed());

  /* ----- reporte ----- */
  const L = [];
  const f1 = (v) => (typeof v === 'number' ? v.toFixed(1) : v);
  L.push('# Reporte del banco de pruebas', '', `Partidas por configuración: ${RUNS} · semilla repetible: ${sameMap ? '✅ sí' : '❌ NO'}`, '');
  L.push('## Duración y salud de las partidas', '', '| Configuración | mediana | mín–máx | tiempo agotado | muerte súbita | trabas | CPU/partida | puntería |', '|---|---|---|---|---|---|---|---|');
  rows.forEach((r) => L.push(`| ${r.name} | ${Math.round(r.med)}s | ${Math.round(r.min)}–${Math.round(r.max)}s | ${r.timeouts} | ${r.overtime} | ${f1(r.stuck)} | ${Math.round(r.cpu)}ms | ${Math.round(r.acc * 100)}% |`));
  L.push('', '## Mundo y equipo (por partida)', '', '| Configuración | granadas | barriles | cajones rotos | vidrios | eventos | cargamentos | vida curada | daño frenado |', '|---|---|---|---|---|---|---|---|---|');
  rows.forEach((r) => L.push(`| ${r.name} | ${f1(r.world.thrown || 0)} | ${f1(r.world.exploded || 0)} | ${f1(r.world.crates || 0)} | ${f1(r.world.glass || 0)} | ${f1(r.world.events || 0)} | ${f1(r.world.drops || 0)} | ${Math.round(r.world.healed || 0)} | ${Math.round(r.world.absorbed || 0)} |`));
  L.push('', '## Tácticas usadas (veces por partida, promedio de todas las configuraciones)', '');
  const tot = { modes: {}, acts: {}, kb: {} };
  rows.forEach((r) => { for (const k in r.modes) tot.modes[k] = (tot.modes[k] || 0) + r.modes[k] / rows.length; for (const k in r.acts) tot.acts[k] = (tot.acts[k] || 0) + r.acts[k] / rows.length; for (const k in r.kb) tot.kb[k] = (tot.kb[k] || 0) + r.kb[k] / rows.length; });
  L.push('Modos: ' + Object.entries(tot.modes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${f1(v)}`).join(' · '));
  L.push('', 'Acciones: ' + Object.entries(tot.acts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${f1(v)}`).join(' · '));
  L.push('', 'Bajas por arma: ' + Object.entries(tot.kb).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${f1(v)}`).join(' · '));
  L.push('', `## Balance por personalidad (${balRuns} partidas de 10, todas con el mismo peso)`, '', '| Personalidad | victorias | % | vida media | bajas | escondido | huyendo | frases |', '|---|---|---|---|---|---|---|---|');
  Object.entries(bal).forEach(([k, b]) => L.push(`| ${k} | ${b.wins} | ${Math.round(b.wins / Math.max(1, balRuns) * 100)}% | ${Math.round(b.life / b.n)}s | ${f1(b.kills / b.n)} | ${Math.round(b.hidden / b.n)}s | ${Math.round(b.fled / b.n)}s | ${f1(b.talk / b.n)} |`));
  L.push('', `## Balance por inteligencia (${balRuns} partidas de 8: 2 de cada nivel)`, '', '| Nivel | victorias | vida media | bajas |', '|---|---|---|---|');
  ['Novato', 'Normal', 'Veterano', 'Maestro'].forEach((n, i) => { const b = iqb[i]; L.push(`| ${n} | ${b.wins} | ${Math.round(b.life / b.n)}s | ${f1(b.kills / b.n)} |`); });

  const alerts = [];
  rows.forEach((r) => { if (r.timeouts) alerts.push(`⚠️ "${r.name}": ${r.timeouts} partidas no terminaron.`); if (r.stuck > 3) alerts.push(`⚠️ "${r.name}": ${f1(r.stuck)} trabas por partida.`); if (r.draws > RUNS * 0.2) alerts.push(`⚠️ "${r.name}": muchos empates (${r.draws}).`); if (r.overtime > RUNS * 0.5) alerts.push(`⚠️ "${r.name}": la muerte súbita se activa seguido (${r.overtime}/${RUNS}).`); });
  Object.entries(bal).forEach(([k, b]) => { const p = b.wins / Math.max(1, balRuns); if (p > 0.3) alerts.push(`⚠️ "${k}" gana demasiado (${Math.round(p * 100)}%).`); if (p < 0.03) alerts.push(`⚠️ "${k}" casi nunca gana (${Math.round(p * 100)}%).`); });
  if (!sameMap) alerts.push('❌ La semilla no repite el mapa.');
  if (errors.length) alerts.push('❌ Errores de JavaScript: ' + errors.join(' | '));
  L.push('', '## Alertas', '', alerts.length ? alerts.join('\n') : '✅ Sin alertas.');
  console.log(L.join('\n'));
  if (WRITE_JSON) fs.writeFileSync(path.join(ROOT, 'bench-report.json'), JSON.stringify({ rows, bal, iqb, sameMap }, null, 2));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
