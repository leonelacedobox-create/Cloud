#!/usr/bin/env node
/* Prueba varias "escaleras" de inteligencia completas (reflejos, puntería, esquive, rapidez para pensar) y
   mide cuánto gana cada nivel. Se queda con la que deja la escalera más clara sin volver a nadie invencible.
   Uso: node tools/iqgrid.js [--games 300] */
'use strict';
const fs = require('fs');
const path = require('path');
const { createPool } = require('./simpool');

const GAMES = +(process.argv[process.argv.indexOf('--games') + 1] || 300) || 300;
const PERS = ['agresivo', 'cauteloso', 'francotirador', 'asesino', 'tactico', 'oportunista', 'berserker', 'cobarde'];
const MAPS = ['maze', 'rooms', 'arena', 'base', 'oficina', 'carcel', 'deposito', 'estacion', 'super', 'fabrica', 'complejo', 'estacionamiento'];
const L = (o) => Object.fromEntries(o.react.map((_, i) => [i, Object.fromEntries(Object.keys(o).map((k) => [k, o[k][i]]))]));
const CANDS = {
  actual: null,
  'A reflejos': L({ react: [0.55, 0.32, 0.24, 0.18, 0.12], aim: [1.3, 1.0, 0.92, 0.85, 0.72] }),
  'B completa': L({ react: [0.55, 0.32, 0.24, 0.18, 0.12], aim: [1.35, 1.0, 0.9, 0.82, 0.7], dodge: [0.08, 0.4, 0.55, 0.72, 0.92], think: [1.7, 1.0, 0.88, 0.78, 0.66] }),
  'C fuerte': L({ react: [0.6, 0.34, 0.24, 0.16, 0.1], aim: [1.45, 1.05, 0.9, 0.78, 0.66], dodge: [0.05, 0.38, 0.56, 0.75, 0.95], think: [1.8, 1.05, 0.88, 0.76, 0.62], tac: [0.5, 0.85, 0.95, 1, 1] }),
};
const OUT = path.join(__dirname, 'reports');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const cfgs = [];
  for (let k = 0; k < GAMES; k++) {
    const iqs = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4].sort(() => Math.random() - 0.5);
    cfgs.push({ map: MAPS[k % MAPS.length], seed: String(700000 + k), players: iqs.map((q, i) => ({ pers: PERS[(i + k) % 8], iq: q })) });
  }
  const pool = await createPool();
  let md = `# Escaleras de inteligencia (${GAMES} partidas de 10 por candidata, 2 soldados de cada nivel, mismas partidas para todas)\n\n| Candidata | Novato | Normal | Veterano | Maestro | Leyenda |\n|---|---|---|---|---|---|\n`;
  const out = {};
  for (const [name, p] of Object.entries(CANDS)) {
    const res = await pool.run(cfgs, p);
    const w = [0, 0, 0, 0, 0], pt = [0, 0, 0, 0, 0], n = [0, 0, 0, 0, 0];
    for (const r of res) for (const s of r.soldiers) { n[s.iq]++; pt[s.iq] += (10 - s.place) / 9; if (s.win) w[s.iq]++; }
    out[name] = { win: w.map((v) => v / GAMES), pts: pt.map((v, i) => v / n[i]), params: p };
    md += `| ${name} | ${w.map((v, i) => `${Math.round(v / GAMES * 100)}% · ${Math.round(pt[i] / n[i] * 100)}`).join(' | ')} |\n`;
    console.log(name, out[name].win.map((v) => Math.round(v * 100) + '%').join(' '), '| pts', out[name].pts.map((v) => Math.round(v * 100)).join(' '));
  }
  await pool.close();
  md += '\nCada celda: cuántas partidas ganó ese nivel (sobre el total; el azar puro daría 20%) · puntos medios (100 = siempre primero, 0 = siempre último).\n';
  fs.writeFileSync(path.join(OUT, 'iqgrid.md'), md);
  fs.writeFileSync(path.join(OUT, 'iqgrid.json'), JSON.stringify(out, null, 1));
})();
