#!/usr/bin/env node
/* IA nueva contra IA vieja (0.9.8): juega partidas donde la mitad de los soldados usa la IA nueva y la otra mitad
   la anterior (mismos mapas, mismas personalidades, cambiando de lado para que no influya el lugar de salida) y
   cuenta quién gana. Guarda tools/reports/ab.md.  Uso: node tools/abtest.js [--games 400] */
'use strict';
// --vs 098: compara contra la IA de la 0.9.8 (por defecto, contra la de la 0.9.7)
const VS098 = process.argv.includes('--vs') && process.argv[process.argv.indexOf('--vs') + 1] === '098';
const OLDKEY = VS098 ? 'oldAI3' : 'oldAI';
const fs = require('fs');
const path = require('path');
const { createPool } = require('./simpool');

const GAMES = +(process.argv[process.argv.indexOf('--games') + 1] || 400) || 400;
const ONLYTEAM = process.argv.includes('--team');                       // solo partidas por equipos
const OFF = process.argv.includes('--off') ? process.argv[process.argv.indexOf('--off') + 1].split(',') : null;   // mejoras apagadas (para medirlas)
const PERS = ['agresivo', 'cauteloso', 'francotirador', 'asesino', 'tactico', 'oportunista', 'berserker', 'cobarde'];
const MAPS = ['maze', 'rooms', 'oficina', 'carcel', 'deposito', 'estacion', 'super', 'fabrica', 'complejo', 'estacionamiento', 'base', 'arena'];

(async () => {
  const cfgs = [];
  for (let k = 0; k < GAMES; k++) {
    const team = ONLYTEAM || k % 2 === 0, flip = (k >> 1) % 2 === 1, map = MAPS[k % MAPS.length], seed = String(900000 + k);
    if (team) {                                                                 // 4 contra 4: un equipo con la IA nueva, el otro con la vieja
      const players = Array.from({ length: 8 }, (_, i) => ({ team: i % 2, pers: PERS[(i >> 1) + (k % 2) * 4 & 7], role: ['asalto', 'medico', 'tirador', 'tanque'][i >> 1] }));
      const oldTeam = flip ? 0 : 1, oldAI = players.map((p, i) => (p.team === oldTeam ? i : -1)).filter((i) => i >= 0);
      cfgs.push({ kind: 'team', teams: true, map, seed, players, [OLDKEY]: oldAI, newTeam: 1 - oldTeam, downed: true, ai3Off: OFF });
    } else {                                                                     // todos contra todos: cada personalidad dos veces, una de cada IA
      const players = PERS.map((p) => ({ pers: p })), oldAI = players.map((_, i) => i).filter((i) => (i % 2 === 0) !== flip);
      cfgs.push({ kind: 'ffa', map, seed, players, [OLDKEY]: oldAI });
    }
  }
  const pool = await createPool();
  const res = await pool.run(cfgs, null, (d, n) => { if (d % 40 === 0 || d === n) process.stderr.write(`\r${d}/${n}`); });
  await pool.close();
  process.stderr.write('\n');
  let tW = 0, tN = 0, fNew = 0, fOld = 0, fWinNew = 0, fN = 0, pre = 0;
  res.forEach((r, k) => {
    const c = cfgs[k];
    if (c.kind === 'team') { if (r.winTeam >= 0) { tN++; if (r.winTeam === c.newTeam) tW++; } }
    else {
      fN++;
      for (const s of r.soldiers) { const p = (r.soldiers.length - s.place) / (r.soldiers.length - 1); if (s.ai2) { fNew += p; pre += s.pre; } else fOld += p; if (s.win && s.ai2) fWinNew++; }
    }
  });
  const half = fN * 4;
  const md = `# IA nueva contra ${VS098 ? 'la de la 0.9.8' : 'la de la 0.9.7'} (${new Date().toISOString().slice(0, 10)})\n\n${res.length} partidas en ${MAPS.length} mapas.\n\n` +
    `- **Equipos 4 contra 4** (un equipo con cada IA, cambiando de lado): la IA nueva ganó **${Math.round(tW / Math.max(1, tN) * 100)}%** de ${tN} partidas.\n` +
    `- **Todos contra todos** (8 soldados, cada personalidad una vez; la mitad con cada IA): la IA nueva ganó **${Math.round(fWinNew / Math.max(1, fN) * 100)}%** de las partidas (parejo sería 50%), con puntos medios ${Math.round(fNew / half * 100)} contra ${Math.round(fOld / half * 100)} de la vieja.\n` +
    `- Veces que un soldado con la IA nueva ya tenía al rival en la mira cuando apareció: ${(pre / Math.max(1, fN)).toFixed(1)} por partida.\n`;
  fs.mkdirSync(path.join(__dirname, 'reports'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'reports', VS098 ? 'ab099.md' : 'ab.md'), md);
  console.log(md);
})();
