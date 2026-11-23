/* Modos de juego (0.7): duelo por equipos, capturar la bandera, rey de la colina, bomba,
   oleadas contra bots, carrera de botín y solo cuchillos. Más reaparición, bases y roles.
   Se carga después de battle.js y le agrega métodos a la partida. */
'use strict';

(() => {
  const { rnd, rint, sfx, TEAMS } = App;
  const E = App.battle;
  const { Game, WEAPONS, HPL, clamp } = E;
  const G = Game.prototype;

  /* ---------- utilidades ---------- */
  const grp = (s) => (s.team >= 0 ? 't' + s.team : 'p' + s.id);
  const players = (g) => g.soldiers.filter((s) => !s.bot);
  const alivePl = (g) => g.soldiers.filter((s) => s.alive && !s.bot);
  const cellXY = (g, i) => [(i % g.W) + 0.5, ((i / g.W) | 0) + 0.5];
  const say = (g, t, nar) => { if (g.hooks.onEvent) g.hooks.onEvent(t); if (nar && g.narrate) g.narrate('say', { text: t.replace(/^\S+\s/, '') }); };
  const fmt = (t) => `${Math.floor(Math.max(0, t) / 60)}:${String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0')}`;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const pop = (g, x, y, text, color) => g.pops.push({ x, y, text, color: color || '#fff', t: 0 });
  const tag = (o) => (o.team >= 0 ? TEAMS[o.team].name : o.name);

  /** Los "bandos" de la partida: cada equipo, o cada jugador si es todos contra todos. */
  function groupsOf(g) {
    const map = new Map();
    for (const s of players(g)) {
      const k = grp(s);
      if (!map.has(k)) map.set(k, { key: k, team: s.team, name: s.team >= 0 ? TEAMS[s.team].name : s.name, color: s.team >= 0 ? TEAMS[s.team].color : s.color, members: [] });
      map.get(k).members.push(s);
    }
    return [...map.values()];
  }
  const groupOf = (g, key) => groupsOf(g).find((o) => o.key === key);
  const flag = (g, team) => (g.mst.flags || []).find((f) => f.team === team);

  /** Un "final" con ganadores (todos los del bando) y un título. */
  function endWith(g, key, title, sub) {
    const o = groupOf(g, key);
    return { winners: o ? o.members : [], title: title || `🏆 ¡Gana ${o ? (o.team >= 0 ? 'el equipo ' : '') + o.name : '?'}!`, sub };
  }
  const clock = (g) => (g.time >= g.mst.limit ? '⏱ ¡PRÓRROGA!' : '⏱ ' + fmt(g.mst.limit - g.time));
  /** Gana quien más puntos tenga; si empatan hay 90 s de prórroga (el que desempate gana) y después, empate (se puede tirar la moneda). */
  function leaderEnd(g, score, unit) {
    const gs = groupsOf(g).map((o) => [o, score(o)]).sort((a, b) => b[1] - a[1]);
    if (!gs.length) return { winners: [], title: '🤝 ¡Empate!' };
    if (gs.length > 1 && gs[0][1] === gs[1][1] && g.time < g.mst.limit + 90) return null;
    if (gs.length > 1 && gs[0][1] === gs[1][1]) return { winners: [], title: '🤝 ¡Empate!', sub: `${gs[0][1]} ${unit} cada uno · se acabó el tiempo`, tied: gs.filter((q) => q[1] === gs[0][1]).map((q) => q[0].members) };
    return endWith(g, gs[0][0].key, null, `${gs[0][1]} ${unit} · se acabó el tiempo`);
  }
  const scoreLine = (g, score) => {
    const gs = groupsOf(g).map((o) => [o, score(o)]).sort((x, y) => y[1] - x[1]), top = gs.slice(0, 4);
    return top.map(([o, v]) => `${tag(o).slice(0, 8)} ${v}`).join('  ·  ') + (gs.length > 4 ? '  · …' : '');
  };
  const scoreRows = (g, score, unit) => groupsOf(g).map((o) => ({ name: (o.team >= 0 ? 'Equipo ' : '') + o.name, color: o.color, value: `${score(o)} ${unit}` }));

  /** Base de cada equipo: el promedio de dónde arrancaron sus soldados. */
  function computeBases(g) {
    const bases = {};
    for (const o of groupsOf(g)) {
      let ax = 0, ay = 0;
      o.members.forEach((s) => { ax += s.base[0]; ay += s.base[1]; });
      bases[o.key] = cellXY(g, g.floorIdxNear(ax / o.members.length, ay / o.members.length));
    }
    g.mst.bases = bases;
  }
  /** Un lugar libre al azar que esté lejos de los enemigos (y cerca de la propia base, si hay). */
  function respawnPlace(g, s) {
    const foes = g.soldiers.filter((o) => o.alive && o !== s && (s.team < 0 || o.team !== s.team));
    const b = s.team >= 0 && g.mst.bases ? g.mst.bases[grp(s)] : null;
    let best = null, bs = -1e9;
    for (let n = 0; n < 40; n++) {
      const [x, y] = cellXY(g, g.floor[rint(g.floor.length)]);
      let md = 99; for (const o of foes) md = Math.min(md, Math.hypot(o.x - x, o.y - y));
      let sc = rnd() * 2 + Math.min(md, 14);
      if (b) sc -= Math.hypot(b[0] - x, b[1] - y) * 1.2;
      if (g.soldiers.some((o) => o.alive && Math.hypot(o.x - x, o.y - y) < 1.3)) sc -= 50;
      if (sc > bs) { bs = sc; best = [x, y]; }
    }
    return best || s.base;
  }
  /** Punto libre, alejado de todos los de la lista `from` (para bandera, sitio, bots...). */
  function farFrom(g, from, tries = 50) {
    let best = null, bs = -1;
    for (let n = 0; n < tries; n++) {
      const [x, y] = cellXY(g, g.floor[rint(g.floor.length)]);
      let md = 99; for (const o of from) md = Math.min(md, Math.hypot(o.x - x, o.y - y));
      md += rnd() * 1.5;
      if (md > bs) { bs = md; best = [x, y]; }
    }
    return best;
  }

  /* ---------- roles (equipos avanzados) ---------- */
  const ROLES = {
    none: { label: 'Sin rol', emoji: '⚪', desc: 'Empieza solo con pistola y cuchillo.' },
    asalto: { label: 'Asalto', emoji: '💣', desc: 'Arranca con una granada y una aturdidora.' },
    medico: { label: 'Médico', emoji: '🩹', desc: 'Arranca con 3 botiquines.' },
    tirador: { label: 'Tirador', emoji: '🎯', desc: 'Arranca con un rifle con mira.' },
    tanque: { label: 'Tanque', emoji: '🛡️', desc: 'Arranca con chaleco y casco completos.' },
  };
  G.applyRole = function (s) {
    const r = s.role;
    if (r === 'asalto') { s.gren.frag = 1; s.gren.flash = 1; }
    else if (r === 'medico') { s.meds = ['med', 'med', 'small']; }
    else if (r === 'tirador') { s.inv.primary = { type: 'rifle', mag: WEAPONS.rifle.mag, res: 30, scope: true }; s.cur = 'primary'; s.wtype = 'rifle'; }
    else if (r === 'tanque') { s.armor = { vest: 100, helm: 60 }; }
    if (this.M && this.M.loadout) this.M.loadout(this, s);
  };

  /* ---------- reaparición ---------- */
  G.respawnSoldier = function (s) {
    const [x, y] = respawnPlace(this, s);
    const st = s.stats; this.initBrain(s); s.stats = st;
    Object.assign(s, { x, y, lx: x, ly: y, alive: true, hp: s.maxHp, respawnAt: 0, spawnT: 3, cur: 'pistol', wtype: 'pistol', reloadT: 0, burstLeft: 0, swapT: 0, act: null, target: null, path: [],
      mode: 'search', carry: null, bubble: null, icon: null, know: {}, seenItems: new Map(), angle: rnd() * 6.283, flash: 0, bloom: 0 });
    s.look = s.angle; s.moveAng = s.angle;
    s.inv = { pistol: { type: 'pistol', mag: WEAPONS.pistol.mag, res: WEAPONS.pistol.res }, primary: null };
    this.applyRole(s);
    if (this.corpses.length > 24) this.corpses.shift();
    this.parts.push({ x, y, vx: 0, vy: 0, life: 0.6, max: 0.6, color: s.color, size: 1, ring: true });
  };

  G.initMode = function () {
    this.pops = [];
    const M = this.M;
    if (M && M.init) M.init(this);
    this.soldiers.forEach((s) => this.applyRole(s));
  };
  G.modeStep = function (dt) {
    const M = this.M;
    for (const s of this.soldiers) {
      if (s.spawnT > 0) s.spawnT = Math.max(0, s.spawnT - dt);
      if (!s.alive && s.respawnAt > 0 && this.time >= s.respawnAt) this.respawnSoldier(s);
    }
    for (let i = this.pops.length - 1; i >= 0; i--) { this.pops[i].t += dt; if (this.pops[i].t > 1.4) this.pops.splice(i, 1); }
    if (M && M.step) M.step(this, dt);
  };
  /** La IA le pide al modo hacia dónde ir: devuelve {x, y, r, hold} o null. */
  G.modeGoal = function (s) { return this.M && this.M.goal ? this.M.goal(this, s) : null; };
  G.modeText = function () { return this.M && this.M.text && this.phase === 'run' ? this.M.text(this) : ''; };

  /* ---------- dibujo común: carteles flotantes y protección de reaparición ---------- */
  G.drawModeUnder = function (x, ts) {
    if (this.M && this.M.bases !== false && this.mst.bases && this.M.respawn) {            // bases de cada equipo
      for (const k in this.mst.bases) {
        const o = groupOf(this, k), b = this.mst.bases[k]; if (!o || o.team < 0) continue;
        x.strokeStyle = o.color; x.globalAlpha = 0.5; x.lineWidth = 2; x.setLineDash([ts * 0.25, ts * 0.2]);
        x.beginPath(); x.arc(b[0] * ts, b[1] * ts, ts * 1.6, 0, 6.283); x.stroke(); x.setLineDash([]);
        x.fillStyle = o.color; x.globalAlpha = 0.1; x.fill(); x.globalAlpha = 1;
      }
    }
    if (this.M && this.M.drawUnder) this.M.drawUnder(this, x, ts);
  };
  G.drawModeOver = function (x, ts) {
    for (const s of this.soldiers) {
      if (!s.alive || !(s.spawnT > 0)) continue;
      x.strokeStyle = '#7dd3fc'; x.globalAlpha = 0.5 + Math.sin(this.time * 14) * 0.25; x.lineWidth = Math.max(2, ts * 0.08);
      x.beginPath(); x.arc(s.x * ts, s.y * ts, ts * 0.55, 0, 6.283); x.stroke(); x.globalAlpha = 1;
    }
    if (this.M && this.M.drawOver) this.M.drawOver(this, x, ts);
    for (const p of this.pops) {
      const k = p.t / 1.4;
      x.globalAlpha = 1 - k * k; x.font = `900 ${Math.max(12, ts * 0.55)}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,.8)'; x.strokeText(p.text, p.x * ts, (p.y - 0.8 - k * 1.2) * ts);
      x.fillStyle = p.color; x.fillText(p.text, p.x * ts, (p.y - 0.8 - k * 1.2) * ts); x.globalAlpha = 1;
    }
  };
  function drawFlag(x, ts, px, py, color, t, big) {
    x.save(); x.translate(px * ts, py * ts);
    const k = big ? 1 : 0.8;
    x.strokeStyle = '#e5e7eb'; x.lineWidth = Math.max(2, ts * 0.08); x.lineCap = 'round';
    x.beginPath(); x.moveTo(0, ts * 0.35 * k); x.lineTo(0, -ts * 0.75 * k); x.stroke();
    const w = Math.sin(t * 6) * ts * 0.06;
    x.fillStyle = color; x.beginPath(); x.moveTo(0, -ts * 0.75 * k); x.quadraticCurveTo(ts * 0.3 * k, -ts * 0.8 * k + w, ts * 0.62 * k, -ts * 0.58 * k + w); x.lineTo(0, -ts * 0.36 * k); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 1; x.stroke();
    x.restore();
  }

  /* ================= definiciones ================= */
  const defs = {};
  const LIST = [];
  const add = (d) => { defs[d.key] = d; LIST.push(d); };

  add({ key: 'classic', emoji: '🏁', label: 'Clásico', team: 'free', respawn: 0,
    desc: 'El último en pie gana. Todos contra todos o por equipos, como siempre.' });

  /* ----- duelo: cada baja suma; los caídos reaparecen en su base ----- */
  add({ key: 'tdm', emoji: '⚔️', label: 'Duelo', team: 'free', respawn: 4, noOvertime: true,
    desc: 'Cada baja suma un punto y los caídos reaparecen a los 4 segundos. Gana el primero en llegar a la meta o quien vaya arriba cuando se acabe el tiempo (4 min).',
    pre(cfg) { cfg.zone = false; },
    init(g) { g.mst.target = clamp(players(g).length * 4 + 4, 12, 32); g.mst.limit = 240; computeBases(g); },
    onKill(g, s, by) { if (by && by !== s && !(by.team >= 0 && by.team === s.team) && !by.bot) { by.score++; pop(g, by.x, by.y, '+1', '#fde047'); } },
    check(g) {
      const sc = (o) => o.members.reduce((a, s) => a + s.score, 0);
      for (const o of groupsOf(g)) if (sc(o) >= g.mst.target) return endWith(g, o.key, null, `Llegó a ${sc(o)} bajas`);
      return g.time >= g.mst.limit ? leaderEnd(g, sc, 'bajas') : null;
    },
    text(g) { const sc = (o) => o.members.reduce((a, s) => a + s.score, 0); return `⚔️ Meta ${g.mst.target} bajas · ${clock(g)}\n${scoreLine(g, sc)}`; },
    scores(g) { return scoreRows(g, (o) => o.members.reduce((a, s) => a + s.score, 0), 'bajas'); },
    rank: (s) => s.score * 10 - s.deaths,
  });

  /* ----- capturar la bandera ----- */
  add({ key: 'ctf', emoji: '🚩', label: 'Bandera', team: 'two', respawn: 5, noOvertime: true,
    desc: 'Dos equipos. Robá la bandera enemiga y llevala a tu base (con la tuya en su lugar). Primero a 3 capturas o más capturas a los 5 minutos. Reaparecen en su base.',
    pre(cfg) { cfg.zone = false; },
    init(g) {
      g.mst.limit = 300; g.mst.target = 3; computeBases(g);
      g.mst.flags = groupsOf(g).filter((o) => o.team >= 0).slice(0, 2).map((o) => { const b = g.mst.bases[o.key]; return { team: o.team, home: b.slice(), x: b[0], y: b[1], carrier: null, atHome: true, dropT: 0 }; });
      g.mst.caps = {}; g.mst.flags.forEach((f) => { g.mst.caps[f.team] = 0; });
    },
    step(g, dt) {
      const fl = g.mst.flags;
      for (const f of fl) {
        if (f.carrier) { if (!f.carrier.alive) this.drop(g, f.carrier); else { f.x = f.carrier.x; f.y = f.carrier.y; } }
        else if (!f.atHome) { f.dropT += dt; if (f.dropT >= 20) { f.atHome = true; f.x = f.home[0]; f.y = f.home[1]; say(g, `🚩 La bandera ${TEAMS[f.team].name.toLowerCase()} volvió a su base`); } }
        if (f.carrier) continue;
        for (const s of g.soldiers) {
          if (!s.alive || s.bot || dist(s, f) > 0.9) continue;
          if (s.team !== f.team && !s.carry) { f.carrier = s; s.carry = f; f.atHome = false; pop(g, s.x, s.y, '🚩', '#fff'); say(g, `🚩 ${s.name} se llevó la bandera ${TEAMS[f.team].name.toLowerCase()}`); sfx.pickup(); break; }
          if (s.team === f.team && !f.atHome) { f.atHome = true; f.x = f.home[0]; f.y = f.home[1]; pop(g, s.x, s.y, '↩', '#fff'); say(g, `🛡️ ${s.name} recuperó la bandera`); sfx.pickup(); break; }
        }
      }
      for (const s of g.soldiers) {
        if (!s.alive || !s.carry) continue;
        const own = flag(g, s.team);
        if (own && own.atHome && dist(s, { x: own.home[0], y: own.home[1] }) < 1.4) {
          const f = s.carry; f.carrier = null; f.atHome = true; f.x = f.home[0]; f.y = f.home[1]; s.carry = null;
          g.mst.caps[s.team]++; s.score++; pop(g, s.x, s.y, '+1 🚩', '#fde047'); say(g, `🏁 ¡${s.name} capturó! ${TEAMS[0].name} ${g.mst.caps[0] || 0} – ${g.mst.caps[1] || 0} ${TEAMS[1].name}`, true); sfx.fanfare();
        }
      }
    },
    drop(g, s) {
      const f = s.carry; if (!f) return;
      f.carrier = null; f.x = s.x; f.y = s.y; f.atHome = false; f.dropT = 0; s.carry = null;
      say(g, `💥 ${s.name} soltó la bandera`);
    },
    onKill(g, s) { this.drop(g, s); },
    check(g) {
      const c = g.mst.caps;
      for (const f of g.mst.flags) if ((c[f.team] || 0) >= g.mst.target) return endWith(g, 't' + f.team, null, `${c[f.team]} capturas`);
      if (g.time < g.mst.limit) return null;
      const [a, b] = g.mst.flags;
      if ((c[a.team] || 0) === (c[b.team] || 0) && g.time < g.mst.limit + 90) return null;      // prórroga: gana la próxima captura
      if ((c[a.team] || 0) === (c[b.team] || 0)) return { winners: [], title: '🤝 ¡Empate!', sub: `${c[a.team] || 0} capturas cada uno`, tied: [groupOf(g, 't' + a.team).members, groupOf(g, 't' + b.team).members] };
      return endWith(g, 't' + ((c[a.team] || 0) > (c[b.team] || 0) ? a.team : b.team), null, `${Math.max(c[a.team] || 0, c[b.team] || 0)} capturas · se acabó el tiempo`);
    },
    goal(g, s) {
      if (s.team < 0) return null;
      const own = flag(g, s.team), enemy = g.mst.flags.find((f) => f.team !== s.team);
      if (!own || !enemy) return null;
      if (s.carry) return { x: own.home[0], y: own.home[1], r: 0.9, hold: false };
      const mates = players(g).filter((m) => m.team === s.team).sort((a, b) => a.id - b.id), idx = mates.indexOf(s);
      const defender = mates.length > 1 && idx % 2 === 1;
      if (!own.atHome) {                                       // nos robaron la bandera (o está tirada)
        if (!defender && enemy.atHome && !own.carrier) return { x: own.x, y: own.y, r: 0.8, hold: false };
        return { x: own.x, y: own.y, r: 0.8, hold: false };
      }
      if (defender) return { x: own.home[0], y: own.home[1], r: 4.2, hold: true };
      if (enemy.carrier && enemy.carrier.team === s.team) return { x: enemy.carrier.x, y: enemy.carrier.y, r: 3, hold: true };      // escoltar al compañero
      return { x: enemy.x, y: enemy.y, r: 0.8, hold: false };
    },
    text(g) { const c = g.mst.caps; return `🚩 ${TEAMS[0].name} ${c[0] || 0} – ${c[1] || 0} ${TEAMS[1].name} · a ${g.mst.target} · ${clock(g)}`; },
    scores(g) { return g.mst.flags.map((f) => ({ name: `Equipo ${TEAMS[f.team].name}`, color: TEAMS[f.team].color, value: `${g.mst.caps[f.team] || 0} capturas` })); },
    rank: (s) => s.score * 100 + s.kills * 10 - s.deaths,
    tension: (g) => (g.mst.flags.some((f) => f.carrier) ? 0.18 : 0),
    drawUnder(g, x, ts) {
      for (const f of g.mst.flags) {
        const col = TEAMS[f.team].color;
        x.strokeStyle = col; x.lineWidth = 2; x.globalAlpha = 0.7; x.beginPath(); x.arc(f.home[0] * ts, f.home[1] * ts, ts * 0.8, 0, 6.283); x.stroke(); x.globalAlpha = 1;
        if (!f.carrier) drawFlag(x, ts, f.x, f.y, col, g.time + f.team, true);
      }
    },
    drawOver(g, x, ts) { for (const f of g.mst.flags) if (f.carrier) drawFlag(x, ts, f.x + 0.1, f.y - 0.55, TEAMS[f.team].color, g.time, false); },
  });

  /* ----- rey de la colina ----- */
  const hillPick = (g, old) => {
    let best = null, bs = -1;
    for (let n = 0; n < 40; n++) {
      const [x, y] = cellXY(g, g.floor[rint(g.floor.length)]);
      let sc = rnd() * 3 - Math.hypot(x - g.center[0], y - g.center[1]) * 0.25;
      if (old) sc += Math.min(10, Math.hypot(x - old.x, y - old.y)) * 0.6;
      if (sc > bs || !best) { bs = sc; best = [x, y]; }
    }
    return { x: best[0], y: best[1], r: 2.3 };
  };
  const hillScore = (g) => (o) => g.mst.pts[o.key] || 0;
  add({ key: 'koth', emoji: '👑', label: 'Colina', team: 'free', respawn: 5, noOvertime: true,
    desc: 'Hay una zona marcada en el mapa: cada segundo que la tenés vos solo (o tu equipo) sumás un punto. Si hay enemigos adentro, nadie suma. La colina cambia de lugar cada rato. Gana el primero en llegar a la meta.',
    pre(cfg) { cfg.zone = false; },
    init(g) {
      g.mst.pts = {}; g.mst.target = clamp(30 + players(g).length * 3, 36, 60); g.mst.limit = 300; g.mst.tick = 0; g.mst.moveAt = 70;
      g.mst.hill = hillPick(g, null); g.mst.hill.x = g.center[0]; g.mst.hill.y = g.center[1];
      const ci = g.floorIdxNear(g.center[0], g.center[1]); [g.mst.hill.x, g.mst.hill.y] = cellXY(g, ci);
      computeBases(g);
    },
    step(g, dt) {
      const m = g.mst, h = m.hill;
      if (g.time > m.moveAt) { m.hill = hillPick(g, h); m.moveAt = g.time + 70; say(g, '📍 ¡La colina cambió de lugar!', true); }
      m.tick += dt;
      if (m.tick < 1) return;
      m.tick -= 1;
      const inside = alivePl(g).filter((s) => Math.hypot(s.x - m.hill.x, s.y - m.hill.y) < m.hill.r);
      const keys = new Set(inside.map(grp));
      m.holder = keys.size === 1 ? [...keys][0] : null;
      m.contested = keys.size > 1;
      if (m.holder) { m.pts[m.holder] = (m.pts[m.holder] || 0) + 1; inside.forEach((s) => { s.score++; }); }
    },
    check(g) {
      const sc = hillScore(g);
      for (const o of groupsOf(g)) if (sc(o) >= g.mst.target) return endWith(g, o.key, null, `${sc(o)} segundos en la colina`);
      return g.time >= g.mst.limit ? leaderEnd(g, sc, 'puntos') : null;
    },
    goal(g, s) { const h = g.mst.hill; return { x: h.x, y: h.y, r: h.r * 0.75, hold: true }; },
    text(g) { const m = g.mst; return `👑 Meta ${m.target} · ${m.contested ? '⚔️ en disputa' : m.holder ? '🔒 la tiene ' + tag(groupOf(g, m.holder) || {}) : 'libre'} · ${clock(g)}\n${scoreLine(g, hillScore(g))}`; },
    scores(g) { return scoreRows(g, hillScore(g), 'pts'); },
    rank: (s) => s.score + s.kills * 3,
    tension: (g) => (g.mst.contested ? 0.15 : 0),
    drawUnder(g, x, ts) {
      const h = g.mst.hill, col = g.mst.contested ? '#f87171' : g.mst.holder ? (groupOf(g, g.mst.holder) || {}).color || '#fde047' : '#fde047';
      const pulse = 1 + Math.sin(g.time * 4) * 0.03;
      x.fillStyle = col; x.globalAlpha = 0.16; x.beginPath(); x.arc(h.x * ts, h.y * ts, h.r * ts * pulse, 0, 6.283); x.fill();
      x.globalAlpha = 0.85; x.strokeStyle = col; x.lineWidth = Math.max(2, ts * 0.1); x.setLineDash([ts * 0.35, ts * 0.25]); x.lineDashOffset = -g.time * ts * 0.5;
      x.beginPath(); x.arc(h.x * ts, h.y * ts, h.r * ts * pulse, 0, 6.283); x.stroke(); x.setLineDash([]); x.globalAlpha = 1;
      x.font = `900 ${ts * 0.9}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.globalAlpha = 0.55; x.fillStyle = '#fff'; x.fillText('👑', h.x * ts, h.y * ts); x.globalAlpha = 1;
    },
  });

  /* ----- bomba ----- */
  add({ key: 'bomb', emoji: '💣', label: 'Bomba', team: 'two', respawn: 0, noOvertime: true,
    desc: 'El equipo Rojo ataca: lleva la bomba al sitio marcado y la planta (4 s). El Azul defiende: si la bomba está plantada hay que desactivarla (6 s) antes de que explote (35 s). Sin reapariciones.',
    pre(cfg) { cfg.zone = false; },
    init(g) {
      const gs = groupsOf(g), att = gs.find((o) => o.team === 0), def = gs.find((o) => o.team === 1);
      g.mst.att = att; g.mst.def = def; g.mst.limit = 210;
      const ab = att ? att.members[0].base : g.center, db = def ? def.members[0].base : g.center;
      let best = null, bs = 1e9;
      for (let n = 0; n < 70; n++) {
        const [x, y] = cellXY(g, g.floor[rint(g.floor.length)]);
        const da = Math.hypot(x - ab[0], y - ab[1]), dd = Math.hypot(x - db[0], y - db[1]);
        if (da < 9 || dd < 4) continue;
        const sc = Math.abs(da / (da + dd) - 0.66) * 20 + rnd() * 2;      // más cerca de los defensores, pero a una caminata de los atacantes
        if (sc < bs) { bs = sc; best = [x, y]; }
      }
      best = best || cellXY(g, g.floorIdxNear(g.center[0], g.center[1]));
      g.mst.site = { x: best[0], y: best[1], r: 1.6 };
      g.mst.bomb = { carrier: att ? att.members[Math.floor(rnd() * att.members.length)] : null, x: 0, y: 0, planted: false, plantT: 0, timer: 0, defT: 0, boom: false, defused: false, last: 0 };
      if (g.mst.bomb.carrier) g.mst.bomb.carrier.carry = g.mst.bomb;
    },
    step(g, dt) {
      const m = g.mst, b = m.bomb, site = m.site;
      if (b.boom || b.defused) return;
      if (!b.planted) {
        if (b.carrier && !b.carrier.alive) this.drop(g, b.carrier);
        if (!b.carrier) {
          for (const s of alivePl(g)) if (s.team === 0 && dist(s, b) < 0.9) { b.carrier = s; s.carry = b; pop(g, s.x, s.y, '💣', '#fff'); say(g, `💣 ${s.name} recogió la bomba`); sfx.pickup(); break; }
        } else {
          b.x = b.carrier.x; b.y = b.carrier.y;
          if (Math.hypot(b.carrier.x - site.x, b.carrier.y - site.y) < site.r) {
            b.plantT += dt;
            if (b.plantT >= 4) { b.planted = true; b.timer = 35; b.x = site.x; b.y = site.y; b.carrier.carry = null; b.carrier.score++; pop(g, site.x, site.y, '💣 ¡PLANTADA!', '#f87171'); say(g, '💣 ¡Bomba plantada! 35 segundos', true); sfx.alarm(); b.carrier = null; }
          } else b.plantT = Math.max(0, b.plantT - dt * 2);
        }
      } else {
        b.timer -= dt;
        const sec = Math.ceil(b.timer);
        if (sec !== b.last && sec > 0) { b.last = sec; sfx.beep(sec <= 5); }
        const dfs = alivePl(g).filter((s) => s.team === 1 && Math.hypot(s.x - site.x, s.y - site.y) < site.r);
        if (dfs.length) { b.defT += dt; if (b.defT >= 6) { b.defused = true; dfs.forEach((s) => { s.score++; }); pop(g, site.x, site.y, '✂️ ¡DESACTIVADA!', '#7dd3fc'); say(g, '✂️ ¡Bomba desactivada!', true); sfx.fanfare(); } }
        else b.defT = Math.max(0, b.defT - dt * 0.5);
        if (b.timer <= 0 && !b.defused) { b.boom = true; g.explode(site.x, site.y, 5.5, 140, null, 'bomb'); say(g, '💥 ¡La bomba explotó!', true); }
      }
    },
    drop(g, s) { const b = g.mst.bomb; if (b.carrier !== s) return; b.carrier = null; b.x = s.x; b.y = s.y; s.carry = null; say(g, `💥 ${s.name} soltó la bomba`); },
    onKill(g, s) { this.drop(g, s); },
    check(g) {
      const m = g.mst, b = m.bomb, att = alivePl(g).filter((s) => s.team === 0), def = alivePl(g).filter((s) => s.team === 1);
      if (b.defused) return endWith(g, 't1', '🛡️ ¡Ganan los defensores!', 'Desactivaron la bomba');
      if (b.boom) return endWith(g, 't0', '💥 ¡Ganan los atacantes!', 'La bomba explotó');
      if (!def.length) return endWith(g, 't0', '💥 ¡Ganan los atacantes!', 'Eliminaron a los defensores');
      if (!att.length && !b.planted) return endWith(g, 't1', '🛡️ ¡Ganan los defensores!', 'Eliminaron a los atacantes');
      if (!b.planted && g.time >= m.limit) return endWith(g, 't1', '🛡️ ¡Ganan los defensores!', 'No pudieron plantar a tiempo');
      return null;
    },
    goal(g, s) {
      const m = g.mst, b = m.bomb, site = m.site;
      if (s.team === 0) {
        if (b.planted) return { x: site.x, y: site.y, r: 2.2, hold: true };                 // cuidar la bomba hasta que explote
        if (s.carry) return { x: site.x, y: site.y, r: 0.9, hold: true };
        if (!b.carrier) return { x: b.x, y: b.y, r: 0.7, hold: false };                   // recoger la bomba tirada
        return { x: site.x, y: site.y, r: 4.5, hold: true };                              // escoltar
      }
      if (s.team === 1) {
        if (b.planted) {
          const dfs = alivePl(g).filter((q) => q.team === 1).sort((p, q) => Math.hypot(p.x - site.x, p.y - site.y) - Math.hypot(q.x - site.x, q.y - site.y));
          return dfs.indexOf(s) < 2 ? { x: site.x, y: site.y, r: 0.9, hold: true } : { x: site.x, y: site.y, r: 4, hold: true };
        }
        const mates = players(g).filter((q) => q.team === 1), i = mates.indexOf(s);
        if (i % 3 === 2) return null;                                                      // uno de cada tres patrulla
        return { x: site.x, y: site.y, r: 5 + (i % 2) * 2, hold: true };
      }
      return null;
    },
    text(g) {
      const b = g.mst.bomb;
      if (b.planted && !b.defused && !b.boom) return `💣 EXPLOTA EN ${Math.max(0, Math.ceil(b.timer))}s${b.defT > 0 ? ' · ✂️ desactivando ' + Math.round(b.defT / 6 * 100) + '%' : ''}`;
      return `💣 ${b.carrier ? 'La lleva ' + b.carrier.name : 'bomba en el piso'}${b.plantT > 0 ? ' · plantando ' + Math.round(b.plantT / 4 * 100) + '%' : ''} · ${clock(g)}`;
    },
    scores() { return null; },
    tension: (g) => (g.mst.bomb.planted && !g.mst.bomb.defused ? 0.35 + (g.mst.bomb.timer < 10 ? 0.3 : 0) : g.mst.bomb.plantT > 0 ? 0.2 : 0),
    drawUnder(g, x, ts) {
      const m = g.mst, s = m.site, b = m.bomb, pulse = 1 + Math.sin(g.time * 5) * 0.05;
      const col = b.planted ? '#ef4444' : '#fbbf24';
      x.fillStyle = col; x.globalAlpha = 0.14 + (b.planted ? 0.1 * Math.abs(Math.sin(g.time * 6)) : 0); x.beginPath(); x.arc(s.x * ts, s.y * ts, s.r * ts * pulse, 0, 6.283); x.fill();
      x.globalAlpha = 0.9; x.strokeStyle = col; x.lineWidth = Math.max(2, ts * 0.09); x.setLineDash([ts * 0.3, ts * 0.2]); x.lineDashOffset = g.time * ts * 0.4;
      x.beginPath(); x.arc(s.x * ts, s.y * ts, s.r * ts * pulse, 0, 6.283); x.stroke(); x.setLineDash([]); x.globalAlpha = 1;
      x.font = `900 ${ts * 0.8}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText('A', s.x * ts, s.y * ts + (b.planted ? ts * 0.9 : 0));
      if (b.planted && !b.defused && !b.boom) {
        x.fillStyle = '#111'; x.fillRect(s.x * ts - ts * 0.35, s.y * ts - ts * 0.22, ts * 0.7, ts * 0.44); x.strokeStyle = '#ef4444'; x.lineWidth = 2; x.strokeRect(s.x * ts - ts * 0.35, s.y * ts - ts * 0.22, ts * 0.7, ts * 0.44);
        x.fillStyle = Math.floor(g.time * 4) % 2 ? '#ef4444' : '#7f1d1d'; x.beginPath(); x.arc(s.x * ts, s.y * ts, ts * 0.09, 0, 6.283); x.fill();
        x.fillStyle = '#fff'; x.font = `900 ${ts * 0.4}px system-ui, sans-serif`; x.fillText(String(Math.max(0, Math.ceil(b.timer))), s.x * ts, s.y * ts - ts * 0.55);
        if (b.defT > 0) { x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(s.x * ts - ts, s.y * ts + ts * 0.5, ts * 2, 5); x.fillStyle = '#7dd3fc'; x.fillRect(s.x * ts - ts, s.y * ts + ts * 0.5, ts * 2 * (b.defT / 6), 5); }
      } else if (!b.planted && !b.carrier) {
        x.fillStyle = '#111'; x.fillRect(b.x * ts - ts * 0.25, b.y * ts - ts * 0.16, ts * 0.5, ts * 0.32); x.strokeStyle = '#fbbf24'; x.lineWidth = 2; x.strokeRect(b.x * ts - ts * 0.25, b.y * ts - ts * 0.16, ts * 0.5, ts * 0.32);
      }
      if (b.plantT > 0 && !b.planted) { x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(s.x * ts - ts, s.y * ts + ts * 0.5, ts * 2, 5); x.fillStyle = '#fbbf24'; x.fillRect(s.x * ts - ts, s.y * ts + ts * 0.5, ts * 2 * (b.plantT / 4), 5); }
    },
    drawOver(g, x, ts) { const b = g.mst.bomb; if (b.carrier && b.carrier.alive) { x.font = `${ts * 0.6}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('💣', b.carrier.x * ts + ts * 0.35, b.carrier.y * ts - ts * 0.6); } },
  });

  /* ----- oleadas contra bots ----- */
  const spawnWave = (g) => {
    const m = g.mst, pl = alivePl(g);
    m.wave++; m.state = 'fight';
    const n = clamp(Math.round((1.5 + m.wave * 0.8) * (0.6 + pl.length * 0.15)), 2, 10), boss = m.wave === m.total;
    const used = [];
    for (let k = 0; k < n; k++) {
      let pos = null, bs = -1;
      for (let t = 0; t < 40; t++) {
        const [x, y] = cellXY(g, g.floor[rint(g.floor.length)]);
        let md = 99; for (const p of pl) md = Math.min(md, Math.hypot(p.x - x, p.y - y));
        for (const u of used) md = Math.min(md, Math.hypot(u[0] - x, u[1] - y) + 3);
        if (md > bs) { bs = md; pos = [x, y]; }
      }
      used.push(pos);
      const isBoss = boss && k === 0;
      const iq = isBoss ? 3 : m.wave <= 3 ? 0 : m.wave === 4 ? (k % 2 ? 0 : 1) : (k % 2 ? 0 : 1);
      const lives = isBoss ? 2 : 1;
      m.botSeq = (m.botSeq || 0) + 1;
      const s = g.makeSoldier({ name: isBoss ? 'JEFE' : 'Bot ' + m.botSeq, color: isBoss ? '#7f1d1d' : '#9ca3af', team: 1, pers: 'auto', iq, lives, bot: true }, g.soldiers.length, pos, g.looks[players(g).length + (k % 14)]);
      const wp = isBoss ? 'lmg' : m.wave >= 4 && k % 3 === 1 ? 'rifle' : m.wave >= 3 && k % 3 === 0 ? 'shotgun' : m.wave >= 2 && k % 3 === 2 ? 'smg' : null;
      if (wp) { s.inv.primary = { type: wp, mag: WEAPONS[wp].mag, res: Math.round(WEAPONS[wp].res * 0.6) }; s.cur = 'primary'; s.wtype = wp; }
      if (isBoss) s.armor = { vest: 100, helm: 40 }; else if (m.wave >= 4 && k % 3 === 0) s.armor = { vest: 40, helm: 0 };
      s.spawnT = 1.5;
      const tgt = pl[Math.floor(rnd() * pl.length)];
      if (tgt) s.know[tgt.id] = { id: tgt.id, x: tgt.x, y: tgt.y, t: g.time, exact: false, kind: 'hit' };
      g.soldiers.push(s);
    }
    say(g, boss ? `👹 ¡OLEADA FINAL! ${n} enemigos y un jefe` : `🌊 Oleada ${m.wave}/${m.total}: ${n} enemigos`, true);
    sfx.alarm();
  };
  add({ key: 'waves', emoji: '🌊', label: 'Oleadas', team: 'coop', respawn: 0, noOvertime: true,
    desc: 'Todos juntos contra bots que llegan en 5 oleadas (la última con jefe). Entre oleada y oleada se curan, recargan y reviven los caídos. Si caen todos, se pierde.',
    pre(cfg) { cfg.teamMode = true; cfg.players.forEach((p) => { p.team = 0; }); cfg.zone = false; cfg.friendly = false; },
    init(g) { g.mst.wave = 0; g.mst.state = 'prep'; g.mst.t = 6; g.mst.total = 5; computeBases(g); },
    step(g, dt) {
      const m = g.mst;
      if (m.state === 'prep') { m.t -= dt; if (m.t <= 0) spawnWave(g); return; }
      if (m.state !== 'fight') return;
      const bots = g.soldiers.filter((s) => s.bot && s.alive);
      m.left = bots.length;
      if (bots.length) return;
      if (m.wave >= m.total) { m.state = 'won'; return; }
      m.state = 'prep'; m.t = 9; say(g, `✅ Oleada ${m.wave} superada · se curan y reviven los caídos`);
      for (const s of players(g)) {
        if (!s.alive) { g.respawnSoldier(s); continue; }
        s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.7);
        const pi = s.inv.pistol; if (pi) { pi.mag = WEAPONS.pistol.mag; pi.res = WEAPONS.pistol.res; }
        const pr = s.inv.primary; if (pr) { pr.mag = E.magOf(pr); pr.res = Math.max(pr.res, WEAPONS[pr.type].res); }
      }
    },
    check(g) {
      const m = g.mst;
      if (m.state === 'won') return { winners: players(g), title: '🏆 ¡Sobrevivieron a las 5 oleadas!', sub: `Eliminaron ${g.soldiers.filter((s) => s.bot).length} bots` };
      if (m.state === 'fight' && !alivePl(g).length) return { winners: [], title: `💀 Cayeron en la oleada ${m.wave}/${m.total}`, sub: 'No quedó nadie en pie' };
      return null;
    },
    goal(g, s) {                                                                           // los bots van a buscar a los jugadores
      if (!s.bot) return null;
      const pl = alivePl(g); if (!pl.length) return null;
      let t = null, td = 1e9; for (const p of pl) { const d = dist(p, s) + ((p.id * 7 + s.id * 3) % 5); if (d < td) { td = d; t = p; } }
      return t ? { x: t.x, y: t.y, r: 3, hold: false } : null;
    },
    text(g) { const m = g.mst; return m.state === 'prep' ? `🌊 Oleada ${m.wave + 1}/${m.total} en ${Math.max(0, Math.ceil(m.t))}s` : `🌊 Oleada ${m.wave}/${m.total} · quedan ${m.left == null ? '?' : m.left}`; },
    scores(g) { return players(g).map((s) => ({ name: s.name, color: s.color, value: `${s.kills} bots` })); },
    rank: (s) => s.kills * 10 - s.deaths,
    tension: (g) => (g.mst.state === 'fight' ? 0.12 + (g.mst.wave === g.mst.total ? 0.2 : 0) : -0.1),
  });

  /* ----- carrera de botín ----- */
  const goldOf = (o) => o.members.reduce((a, s) => a + (s.gold || 0), 0);
  const addGold = (g, x, y, v = 1) => g.mst.gold.push({ id: ++g.mst.gid, x, y, v, t: 0 });
  add({ key: 'loot', emoji: '🪙', label: 'Botín', team: 'free', respawn: 5, noOvertime: true,
    desc: 'Aparecen lingotes de oro por el mapa. Gana el primero en juntar la meta (o el que más tenga a los 4 minutos). Si te eliminan, soltás la mitad del oro que llevabas… y reaparecés.',
    pre(cfg) { cfg.zone = false; },
    init(g) {
      g.mst.gold = []; g.mst.gid = 0; g.mst.spawnT = 4; g.mst.limit = 240; g.mst.target = clamp(7 + players(g).length, 9, 16);
      players(g).forEach((s) => { s.gold = 0; });
      computeBases(g);
      const sp = players(g).map((s) => ({ x: s.base[0], y: s.base[1] }));
      for (let k = 0; k < 6; k++) { const p = farFrom(g, sp.concat(g.mst.gold), 30); addGold(g, p[0], p[1]); }
    },
    step(g, dt) {
      const m = g.mst;
      for (const b of m.gold) b.t += dt;
      m.spawnT -= dt;
      if (m.spawnT <= 0) { m.spawnT = 4.5; if (m.gold.length < 8) { const p = farFrom(g, alivePl(g).concat(m.gold), 20); addGold(g, p[0], p[1]); } }
      for (const s of alivePl(g)) {
        for (let i = m.gold.length - 1; i >= 0; i--) {
          const b = m.gold[i];
          if (Math.hypot(s.x - b.x, s.y - b.y) < 0.75) { s.gold += b.v; s.score += b.v; m.gold.splice(i, 1); pop(g, s.x, s.y, '+' + b.v + ' 🪙', '#fde047'); sfx.pickup(); }
        }
      }
    },
    onKill(g, s) {
      const lose = Math.min(s.gold, Math.max(1, Math.ceil(s.gold / 2)));
      if (!s.gold) return;
      s.gold -= lose;
      for (let k = 0; k < lose; k++) { const a = rnd() * 6.283, d = 0.3 + rnd() * 0.8; let x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d; if (g.isSolid(Math.floor(x), Math.floor(y))) { x = s.x; y = s.y; } addGold(g, x, y); }
    },
    check(g) {
      for (const o of groupsOf(g)) if (goldOf(o) >= g.mst.target) return endWith(g, o.key, null, `Juntó ${goldOf(o)} lingotes`);
      return g.time >= g.mst.limit ? leaderEnd(g, goldOf, 'lingotes') : null;
    },
    goal(g, s) {
      const gl = g.mst.gold; if (!gl.length) return null;
      let best = null, bd = 1e9;
      for (const b of gl) { const d = Math.hypot(b.x - s.x, b.y - s.y) + ((b.id * 5 + s.id * 11) % 7) * 0.7; if (d < bd) { bd = d; best = b; } }
      return best ? { x: best.x, y: best.y, r: 0.6, hold: false } : null;
    },
    text(g) { return `🪙 Meta ${g.mst.target} · ${clock(g)}\n${scoreLine(g, goldOf)}`; },
    scores(g) { return scoreRows(g, goldOf, 'lingotes'); },
    rank: (s) => (s.gold || 0) * 10 + s.kills,
    drawUnder(g, x, ts) {
      for (const b of g.mst.gold) {
        const bob = Math.sin(g.time * 3 + b.id) * ts * 0.04, w = ts * 0.5, h = ts * 0.28;
        x.save(); x.translate(b.x * ts, b.y * ts + bob);
        x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(2, h * 0.9, w * 0.6, h * 0.35, 0, 0, 6.283); x.fill();
        const gr = x.createLinearGradient(0, -h, 0, h); gr.addColorStop(0, '#fff3a0'); gr.addColorStop(0.5, '#f5c518'); gr.addColorStop(1, '#b8860b');
        x.fillStyle = gr; x.beginPath(); x.moveTo(-w * 0.5, h * 0.5); x.lineTo(-w * 0.35, -h * 0.5); x.lineTo(w * 0.35, -h * 0.5); x.lineTo(w * 0.5, h * 0.5); x.closePath(); x.fill();
        x.strokeStyle = '#7a5a06'; x.lineWidth = 1.5; x.stroke();
        x.fillStyle = 'rgba(255,255,255,.8)'; x.fillRect(-w * 0.22, -h * 0.35, w * 0.2, h * 0.18);
        if (Math.floor(g.time * 2 + b.id) % 4 === 0) { x.fillStyle = '#fff'; x.font = `${ts * 0.35}px sans-serif`; x.textAlign = 'center'; x.fillText('✦', w * 0.4, -h * 0.7); }
        x.restore();
      }
    },
    drawOver(g, x, ts) { for (const s of g.soldiers) if (s.alive && s.gold > 0) { x.font = `800 ${Math.max(9, ts * 0.38)}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fde047'; x.strokeStyle = 'rgba(0,0,0,.8)'; x.lineWidth = 3; const t = '🪙' + s.gold; x.strokeText(t, s.x * ts, s.y * ts + ts * 0.62); x.fillText(t, s.x * ts, s.y * ts + ts * 0.62); } },
  });

  /* ----- solo cuchillos ----- */
  add({ key: 'knives', emoji: '🔪', label: 'Cuchillos', team: 'free', respawn: 0,
    desc: 'Nada de armas ni botín: solo cuchillos. Hay que acercarse, esquivar y puñalar. El último en pie gana (la zona roja ayuda a que se encuentren).',
    pre(cfg) { cfg.loot = false; cfg.gear = false; cfg.powerups = false; cfg.events = false; },
    loadout(g, s) { s.inv.pistol = { type: 'pistol', mag: 0, res: 0 }; s.inv.primary = null; s.cur = 'knife'; s.wtype = 'knife'; },
  });

  /* ----- API pública ----- */
  App.Modes = { defs, LIST, ROLES };
  E.initModeUI();
})();
