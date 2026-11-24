/* Simulador en paralelo (0.9.7): abre varios navegadores sin ventana (uno por núcleo) con el juego cargado
   y reparte partidas entre ellos. Lo usan tools/tune.js (ajuste por evolución) y tools/mass.js (miles de partidas).
   Las partidas se juegan sin dibujar ni sonar, lo más rápido posible. */
'use strict';
const path = require('path');
const os = require('os');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');

/** Lo que corre adentro de cada página: arma una partida, la juega entera y devuelve el resumen. */
function inPage() {
  App.state.sound = false;                                  // sin sonido: las simulaciones van más rápido
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:0;top:0;width:372px;height:662px';
  const cv = document.createElement('canvas'); wrap.appendChild(cv); document.body.appendChild(wrap);
  const noop = { onKill() {}, onPickup() {}, onEnd() {}, onFrame() {}, onEvent() {} };
  const ROLES = ['asalto', 'medico', 'tirador', 'tanque', 'explorador', 'ingeniero'];
  // valores originales, para poder volver atrás antes de aplicar otros
  const orig = { PERS: JSON.parse(JSON.stringify(Personas.PERS)), IQ: JSON.parse(JSON.stringify(Personas.IQ)) };
  /** Cambia parámetros de balance: { pers: { agresivo: { tough: .9, accMul: 1 } }, iq: { 3: { aim: .85 } } } */
  window.__setParams = function (p) {
    for (const k in Personas.PERS) Object.assign(Personas.PERS[k], { tough: orig.PERS[k].tough, accMul: orig.PERS[k].accMul });
    Personas.IQ.forEach((q, i) => Object.assign(q, orig.IQ[i]));
    if (!p) return;
    for (const k in p.pers || {}) Object.assign(Personas.PERS[k], p.pers[k]);
    for (const i in p.iq || {}) Object.assign(Personas.IQ[i], p.iq[i]);
  };
  window.__game = function (c) {
    const n = c.n || (c.players ? c.players.length : 8);
    const players = Array.from({ length: n }, (_, i) => {
      const q = (c.players && c.players[i]) || {};
      return { name: 'P' + i, color: '#ff0000', team: q.team != null ? q.team : (c.teams ? i % 2 : 0), pers: q.pers || 'auto', iq: q.iq != null ? q.iq : 1, role: q.role || (c.roles ? ROLES[(i >> 1) % 6] : 'none') };
    });
    const M = App.Modes.defs[c.mode || 'classic'], two = M.team === 'two' || M.team === 'coop';
    if (two && !c.teams && !c.players) players.forEach((p, i) => { p.team = i % 2; });
    const cfg = { mode: c.mode || 'classic', noRec: true, players, teamMode: !!c.teams || two, lives: c.lives || 3, map: c.map || 'maze', size: c.size || 'm', powerups: true, zone: c.zone !== false,
      varied: c.varied !== false, loot: c.loot !== false, gear: c.gear !== false, props: c.props !== false, events: c.events !== false, friendly: !!c.friendly, talk: true, seed: c.seed,
      customMap: Maps.SAMPLE, downed: !!c.downed, weather: c.weather || 'none', night: !!c.night, oldAI: c.oldAI || null, ai2Off: c.ai2Off || null, oldAI3: c.oldAI3 || null, ai3Off: c.ai3Off || null };
    const g = new App.battle.Game(cv, cfg, noop);
    g.phase = 'run'; g.paused = false;
    const t0 = performance.now(), lim = c.limit || 700;
    while (g.phase === 'run' && g.time < lim) g.step(1 / 60);
    const winners = g.winners || [];
    // puesto: los ganadores primero; después el que murió más tarde
    const order = g.soldiers.slice().sort((a, b) => (winners.includes(b) - winners.includes(a)) || ((b.alive ? 1e9 : b.deathT) - (a.alive ? 1e9 : a.deathT)));
    const out = {
      t: g.time, timeout: g.phase === 'run', draw: g.phase !== 'run' && winners.length === 0, ms: performance.now() - t0,
      title: g.endInfo && g.endInfo.title ? g.endInfo.title.replace(/[^A-Za-zÁ-úñ0-9 /]/g, '').trim() : '',
      winTeam: winners.length && winners[0].team >= 0 && cfg.teamMode ? winners[0].team : -1,
      stuck: g.stuckEvents || 0, overtime: !!g.overtime,
      soldiers: g.soldiers.filter((s) => !s.bot).map((s) => ({ id: s.id, ai2: s.ai2 !== false && s.ai3 !== false, pre: s.stats.preHit || 0, pers: s.pers, iq: s.iq, team: s.team, role: s.role, win: winners.includes(s), place: order.indexOf(s) + 1, kills: s.kills, dmg: Math.round(s.stats.dmgDealt), life: s.alive ? g.time : s.deathT,
        revives: s.stats.revives || 0, downs: s.downCount || 0, knifeKills: (s.stats.killsBy && s.stats.killsBy.knife) || 0 })),
      mst: JSON.parse(JSON.stringify(g.mst.caps || g.mst.pts || g.mst.score || (g.mst.wave ? { wave: g.mst.wave } : {}))),
    };
    g.destroy(); g.static = null; g.mini = null;
    return out;
  };
}

async function createPool(n = Math.max(1, Math.min(3, os.cpus().length - 1))) {
  const workers = [];
  for (let i = 0; i < n; i++) {
    const browser = await chromium.launch({ args: process.env.SIM_ARGS ? process.env.SIM_ARGS.split(' ') : ['--js-flags=--single-threaded'] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => process.stderr.write(`\n[página ${i}] ${e.message}\n`));
    await page.goto('file://' + path.join(ROOT, 'index.html'));
    await page.evaluate(inPage);
    workers.push({ browser, page, busy: false });
  }
  /** Juega todas las partidas pedidas, repartidas entre los navegadores. `params` cambia el balance antes. */
  async function run(configs, params = null, onDone = null) {
    await Promise.all(workers.map((w) => w.page.evaluate((p) => window.__setParams(p), params)));
    const results = new Array(configs.length); let next = 0, done = 0;
    await Promise.all(workers.map(async (w) => {
      while (next < configs.length) {
        const k = next++;
        results[k] = await w.page.evaluate((c) => window.__game(c), configs[k]);
        done++; if (onDone) onDone(done, configs.length);
      }
    }));
    return results;
  }
  async function close() { await Promise.all(workers.map((w) => w.browser.close())); }
  return { run, close, size: n };
}

module.exports = { createPool };
