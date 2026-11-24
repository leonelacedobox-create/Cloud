#!/usr/bin/env node
/* Duelos 1 contra 1, IA nueva contra vieja (0.9.8), apagando cada mejora por separado para ver cuánto aporta.
   Uso: node tools/duels.js [--games 400] */
'use strict';
const { createPool } = require('./simpool');
const N = +(process.argv[process.argv.indexOf('--games') + 1] || 400) || 400;
const PERS = ['agresivo', 'cauteloso', 'francotirador', 'asesino', 'tactico', 'oportunista', 'berserker', 'cobarde'];
const MAPS = ['maze', 'rooms', 'oficina', 'carcel', 'deposito', 'estacion', 'super', 'fabrica', 'complejo', 'base'];
const VARIANTS = (process.env.VARIANTS ? JSON.parse(process.env.VARIANTS) : [[], ['pre'], ['hold'], ['stop'], ['threat'], ['clear']]);
(async () => {
  const pool = await createPool();
  for (const off of VARIANTS) {
    const cfgs = [];
    for (let k = 0; k < N; k++) {
      const p = PERS[k % 8], newFirst = k % 2 === 0;
      cfgs.push({ map: MAPS[(k >> 1) % MAPS.length], seed: String(500000 + (k >> 1)), players: [{ pers: p }, { pers: p }], oldAI: [newFirst ? 1 : 0], ai2Off: off, size: 's', lives: 2 });
    }
    const res = await pool.run(cfgs);
    let w = 0, n = 0; res.forEach((r) => { const win = r.soldiers.find((s) => s.win); if (win) { n++; if (win.ai2) w++; } });
    console.log(`${off.length ? 'sin ' + off.join(',') : 'todo prendido'}: la IA nueva gana ${Math.round(w / n * 100)}% de ${n} duelos`);
  }
  await pool.close();
})();
