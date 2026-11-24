#!/usr/bin/env node
/* Miles de partidas por mapa y modo (0.9.7): juega todas las combinaciones de mapa × modo muchas veces y
   arma un reporte con duración, partidas que no terminan, muerte súbita, empates, trabas y ventajas
   (qué equipo gana más, si el lugar de salida importa). Guarda tools/reports/mass.md.

   Uso:  node tools/mass.js [--runs 20] [--only bomb,ctf]
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { createPool } = require('./simpool');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const RUNS = +arg('runs', 20), ONLY = arg('only', '') ? arg('only', '').split(',') : null;
const MAPS = ['maze', 'rooms', 'arena', 'base', 'oficina', 'carcel', 'deposito', 'estacion', 'super', 'estacionamiento', 'fabrica', 'oficina_noche', 'complejo'];
const MODES = [
  { key: 'classic', n: 8, name: 'Clásico (8)' },
  { key: 'classic', n: 8, teams: true, roles: true, downed: true, name: 'Equipos con roles y derribados (8)' },
  { key: 'tdm', n: 8, name: 'Duelo por equipos (8)' },
  { key: 'ctf', n: 8, name: 'Bandera (8)' },
  { key: 'koth', n: 6, name: 'Colina (6)' },
  { key: 'bomb', n: 8, roles: true, name: 'Bomba (8)' },
  { key: 'waves', n: 4, name: 'Oleadas (4)' },
  { key: 'loot', n: 6, name: 'Botín (6)' },
  { key: 'knives', n: 6, name: 'Solo cuchillos (6)' },
];
const OUT = path.join(__dirname, 'reports');
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)] || 0; };
const p90 = (a) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length * 0.9)] || 0; };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const cfgs = [];
  let seed = 300000;
  for (const md of MODES.filter((m) => !ONLY || ONLY.includes(m.key))) for (const map of MAPS) for (let r = 0; r < RUNS; r++) {
    cfgs.push({ mode: md.key, n: md.n, teams: !!md.teams, roles: !!md.roles, downed: !!md.downed, map, seed: String(seed++), _name: md.name });
  }
  const pool = await createPool();
  const t0 = Date.now();
  const res = await pool.run(cfgs, null, (d, n) => { if (d % 50 === 0 || d === n) process.stderr.write(`\r${d}/${n} partidas · ${((Date.now() - t0) / 60000).toFixed(1)} min   `); });
  await pool.close();
  process.stderr.write('\n');
  // agrupar
  const by = {};
  res.forEach((r, k) => { const c = cfgs[k]; const key = c._name + '|' + c.map; (by[key] = by[key] || { c, rs: [] }).rs.push(r); });
  let md = `# Miles de partidas por mapa y modo (${new Date().toISOString().slice(0, 10)})\n\n${res.length} partidas (${RUNS} por cada combinación de mapa y modo). Tiempos en segundos de partida.\n\n`;
  const alerts = [];
  for (const m of MODES.filter((q) => !ONLY || ONLY.includes(q.key))) {
    md += `## ${m.name}\n\n| Mapa | mediana | 90% | no terminó | m. súbita | empates | trabas | gana equipo 0 | finales |\n|---|---|---|---|---|---|---|---|---|\n`;
    for (const map of MAPS) {
      const g = by[m.name + '|' + map]; if (!g) continue;
      const rs = g.rs, ts = rs.map((r) => r.t), to = rs.filter((r) => r.timeout).length, ot = rs.filter((r) => r.overtime).length, dr = rs.filter((r) => r.draw).length;
      const st = rs.reduce((a, r) => a + r.stuck, 0) / rs.length;
      const tw = rs.filter((r) => r.winTeam >= 0), t0w = tw.length ? Math.round(tw.filter((r) => r.winTeam === 0).length / tw.length * 100) + '%' : '-';
      const fins = {}; rs.forEach((r) => { const k = (r.title || (r.draw ? 'empate' : 'ganó uno')).slice(0, 34); fins[k] = (fins[k] || 0) + 1; });
      const finStr = Object.entries(fins).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ×${v}`).join(' · ');
      md += `| ${map} | ${Math.round(med(ts))} | ${Math.round(p90(ts))} | ${to} | ${ot} | ${dr} | ${st.toFixed(1)} | ${t0w} | ${finStr} |\n`;
      if (to > rs.length * 0.1) alerts.push(`${m.name} en ${map}: ${to} de ${rs.length} no terminaron`);
      if (st > 1.5) alerts.push(`${m.name} en ${map}: muchas trabas (${st.toFixed(1)} por partida)`);
      if (tw.length >= 10 && Math.abs(tw.filter((r) => r.winTeam === 0).length / tw.length - 0.5) > 0.22) alerts.push(`${m.name} en ${map}: un equipo gana mucho más (equipo 0: ${t0w})`);
      if (m.key !== 'koth' && m.key !== 'ctf' && m.key !== 'waves' && dr > rs.length * 0.25) alerts.push(`${m.name} en ${map}: muchos empates (${dr})`);
    }
    md += '\n';
  }
  // derribados y levantadas
  const dw = res.filter((r, k) => cfgs[k].downed);
  if (dw.length) {
    const downs = dw.reduce((a, r) => a + r.soldiers.reduce((b, s) => b + s.downs, 0), 0), revs = dw.reduce((a, r) => a + r.soldiers.reduce((b, s) => b + s.revives, 0), 0);
    md += `## Derribados\n\nEn ${dw.length} partidas con derribados: ${downs} derribados y ${revs} levantados (${downs ? Math.round(revs / downs * 100) : 0}%).\n\n`;
  }
  md += `## Alertas\n\n${alerts.length ? alerts.map((a) => '- ⚠️ ' + a).join('\n') : 'Ninguna.'}\n\nTiempo total: ${((Date.now() - t0) / 60000).toFixed(1)} minutos.\n`;
  fs.writeFileSync(path.join(OUT, 'mass.md'), md);
  console.log(md);
})();
