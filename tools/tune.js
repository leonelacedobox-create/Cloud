#!/usr/bin/env node
/* Ajuste automático del balance por evolución (0.9.7).
 *
 * Qué ajusta: el "aguante" de cada personalidad (cuánto daño recibe, `tough`) y la puntería de cada nivel de
 * inteligencia (`aim`: menos es más preciso). Qué busca:
 *   - que las 8 personalidades ganen parecido (en partidas de 8, una de cada una),
 *   - que la inteligencia sea una escalera pareja: Novato < Normal < Veterano < Maestro < Leyenda.
 * Cómo: en cada generación arma varios candidatos (el mejor hasta ahora corregido según lo que salió mal, más
 * mutaciones al azar), los hace jugar las MISMAS partidas (mismas semillas y mapas, así la comparación es justa)
 * y se queda con el que deja todo más parejo. Al final guarda el reporte y los valores en tools/reports/.
 *
 * Uso:  node tools/tune.js [--gens 14] [--pop 4] [--pg 48] [--ig 30]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { createPool } = require('./simpool');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : +process.argv[i + 1]; };
const GENS = arg('gens', 14), POP = arg('pop', 4), PG = arg('pg', 48), IG = arg('ig', 30);
const PERS = ['agresivo', 'cauteloso', 'francotirador', 'asesino', 'tactico', 'oportunista', 'berserker', 'cobarde'];
const MAPS = ['maze', 'rooms', 'arena', 'base', 'oficina', 'carcel', 'deposito', 'estacion', 'super', 'fabrica', 'complejo', 'estacionamiento'];
const IQ_TARGET = [0.32, 0.44, 0.52, 0.59, 0.66];      // puntos medios buscados (1 = ganó, 0 = salió último)
const OUT = path.join(__dirname, 'reports');

let seedBase = 100000 + Math.floor(Math.random() * 100000);
const pts = (s, n) => (n - s.place) / (n - 1);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

/** Las partidas de una generación (iguales para todos los candidatos). */
function batch() {
  const cfgs = [];
  for (let k = 0; k < PG; k++) {
    const order = PERS.slice().sort(() => Math.random() - 0.5);          // lugar de salida al azar
    cfgs.push({ kind: 'p', map: MAPS[k % MAPS.length], seed: String(seedBase++), players: order.map((p) => ({ pers: p, iq: 1 })) });
  }
  for (let k = 0; k < IG; k++) {
    const iqs = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4].sort(() => Math.random() - 0.5);
    cfgs.push({ kind: 'i', map: MAPS[(k + 3) % MAPS.length], seed: String(seedBase++), players: iqs.map((q, i) => ({ pers: PERS[(i + k) % 8], iq: q })) });
  }
  return cfgs;
}
/** Cómo le fue a un candidato en las partidas. */
function measure(res, cfgs) {
  const pp = {}, pn = {}, ip = [0, 0, 0, 0, 0], inn = [0, 0, 0, 0, 0], pw = {};
  let timeouts = 0;
  res.forEach((r, k) => {
    if (r.timeout) timeouts++;
    const n = r.soldiers.length;
    for (const s of r.soldiers) {
      if (cfgs[k].kind === 'p') { pp[s.pers] = (pp[s.pers] || 0) + pts(s, n); pn[s.pers] = (pn[s.pers] || 0) + 1; if (s.win) pw[s.pers] = (pw[s.pers] || 0) + 1; }
      else { ip[s.iq] += pts(s, n); inn[s.iq]++; }
    }
  });
  const pers = {}; for (const p of PERS) pers[p] = pp[p] / Math.max(1, pn[p]);
  const iq = ip.map((v, i) => v / Math.max(1, inn[i]));
  const mean = PERS.reduce((a, p) => a + pers[p], 0) / PERS.length;
  const persErr = Math.sqrt(PERS.reduce((a, p) => a + (pers[p] - mean) ** 2, 0) / PERS.length);
  const iqErr = Math.sqrt(iq.reduce((a, v, i) => a + (v - IQ_TARGET[i]) ** 2, 0) / iq.length);
  const order = iq.slice(1).reduce((a, v, i) => a + Math.max(0, iq[i] - v + 0.01), 0);   // castiga si un nivel le gana al de arriba
  return { pers, iq, wins: pw, persErr, iqErr, fit: persErr + 0.8 * iqErr + 0.6 * order, timeouts };
}
/** El siguiente candidato: corrige hacia lo parejo y agrega una mutación al azar. */
function child(base, m, sigma, k) {
  const c = { pers: {}, iq: {} };
  const mean = PERS.reduce((a, p) => a + m.pers[p], 0) / PERS.length;
  const gain = [0, 1.0, 1.6, 0.6][k % 4];                                  // distintos "tamaños de paso" entre los candidatos
  for (const p of PERS) c.pers[p] = { tough: +clamp(base.pers[p].tough * Math.exp(gain * (m.pers[p] - mean) * 1.4 + sigma * gauss()), 0.65, 1.4).toFixed(3) };
  const aims = [0, 1, 2, 3, 4].map((i) => clamp(base.iq[i].aim * Math.exp(gain * (m.iq[i] - IQ_TARGET[i]) * 1.1 + sigma * 0.7 * gauss()), 0.55, 1.6));
  aims.sort((a, b) => b - a);                                               // la puntería siempre mejora con el nivel
  aims.forEach((a, i) => { c.iq[i] = { aim: +a.toFixed(3) }; });
  return c;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const pool = await createPool();
  // punto de partida: los valores actuales del juego
  const start = await (async () => {
    const { chromium } = require('playwright');
    const b = await chromium.launch(); const pg = await b.newPage();
    await pg.goto('file://' + path.join(__dirname, '..', 'index.html'));
    const v = await pg.evaluate(() => ({ pers: Object.fromEntries(Object.entries(Personas.PERS).map(([k, p]) => [k, { tough: p.tough || 1 }])), iq: Object.fromEntries(Personas.IQ.map((q, i) => [i, { aim: q.aim }])) }));
    await b.close(); return v;
  })();
  let best = start, bestM = null;
  const log = [];
  const t0 = Date.now();
  for (let gen = 0; gen < GENS; gen++) {
    const cfgs = batch();
    const sigma = 0.08 * (1 - gen / GENS) + 0.015;
    const cands = [best];
    if (bestM) for (let k = 0; k < POP; k++) cands.push(child(best, bestM, k === 0 ? 0 : sigma, k));
    const scored = [];
    for (const c of cands) {
      const res = await pool.run(cfgs, c);
      scored.push({ c, m: measure(res, cfgs) });
    }
    scored.sort((a, b) => a.m.fit - b.m.fit);
    const was = scored.find((x) => x.c === best);
    best = scored[0].c; bestM = scored[0].m;
    const line = `gen ${gen + 1}/${GENS}  candidatos ${cands.length}  mejor ${bestM.fit.toFixed(3)} (pers ${bestM.persErr.toFixed(3)}, iq ${bestM.iqErr.toFixed(3)})  el anterior ${was.m.fit.toFixed(3)}  ${((Date.now() - t0) / 60000).toFixed(1)} min`;
    console.log(line);
    log.push({ gen: gen + 1, fit: bestM.fit, persErr: bestM.persErr, iqErr: bestM.iqErr, prevFit: was.m.fit, pers: bestM.pers, iq: bestM.iq, params: best });
    fs.writeFileSync(path.join(OUT, 'tune-log.json'), JSON.stringify(log, null, 1));
  }
  // confirmación con partidas nuevas: antes (valores originales) contra después (los ajustados)
  const VER = 3;
  const verCfgs = []; for (let k = 0; k < VER; k++) verCfgs.push(...batch());
  const before = measure(await pool.run(verCfgs, start), verCfgs);
  const after = measure(await pool.run(verCfgs, best), verCfgs);
  await pool.close();
  const games = (GENS * (POP + 1) + 2 * VER) * (PG + IG);
  const pct = (v) => (v * 100).toFixed(0);
  let md = `# Ajuste por evolución (${new Date().toISOString().slice(0, 10)})\n\nPartidas jugadas: unas ${games} (${GENS} generaciones de ${POP + 1} candidatos, cada uno con ${PG} partidas de personalidades y ${IG} de inteligencia; más la confirmación final con ${VER * (PG + IG)} partidas nuevas para el antes y otras tantas para el después).\n\n`;
  md += `Puntos medios: 100 = siempre gana, 0 = siempre sale último; parejo sería 50 para todas las personalidades.\n\n## Personalidades\n\n| Personalidad | aguante antes | aguante después | puntos antes | puntos después |\n|---|---|---|---|---|\n`;
  for (const p of PERS) md += `| ${p} | ${start.pers[p].tough} | ${best.pers[p].tough} | ${pct(before.pers[p])} | ${pct(after.pers[p])} |\n`;
  md += `\nDesvío entre personalidades: antes ${pct(before.persErr)} puntos, después ${pct(after.persErr)}.\n\n## Inteligencia\n\n| Nivel | puntería antes | puntería después | buscado | puntos antes | puntos después |\n|---|---|---|---|---|---|\n`;
  ['Novato', 'Normal', 'Veterano', 'Maestro', 'Leyenda'].forEach((n, i) => { md += `| ${n} | ${start.iq[i].aim} | ${best.iq[i].aim} | ${pct(IQ_TARGET[i])} | ${pct(before.iq[i])} | ${pct(after.iq[i])} |\n`; });
  md += `\nPartidas que no terminaron: antes ${before.timeouts}, después ${after.timeouts}.\n`;
  fs.writeFileSync(path.join(OUT, 'tune.md'), md);
  fs.writeFileSync(path.join(OUT, 'tune-best.json'), JSON.stringify(best, null, 1));
  console.log('\n' + md);
})();
