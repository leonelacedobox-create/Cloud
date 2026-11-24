/* Escuadras (0.9.4): juego en equipo. Cada equipo tiene un líder que elige un plan (buscar, atacar,
   defender) y reparte tareas: uno cubre mientras el otro avanza, entran juntos a un cuarto con aturdidora,
   arman fuego cruzado, levantan a los derribados, el médico cura, el ingeniero pone minas y el explorador marca.
   En modo manual, los bots de tu equipo obedecen órdenes. Se carga después de brain2.js. */
'use strict';

(() => {
  const { rnd, rint, TEAMS } = App;
  const E = App.battle;
  const { WEAPONS, ammoOf, angDiff, clamp, doorClosed, HPL } = E;
  const { IQ } = Personas;
  const G = E.Game.prototype;
  const PLAN = { search: '🔎 buscar', attack: '⚔️ atacar', defend: '🛡️ defender', follow: '👣 seguirte', hold: '📍 cubrir', regroup: '🫂 agruparse' };
  const CALL = {
    reload: ['¡Recargando!', '¡Cubrime, recargo!', '¡Cambio cargador!'],
    nade: ['¡Granada!', '¡Va granada!', '¡Cuidado, granada!'],
    cover: ['¡Me cubro!', '¡A cubierto!'],
    contact: ['¡Contacto!', '¡Enemigo a la vista!', '¡Ahí está!'],
    down: ['¡Me dieron!', '¡Estoy en el piso!', '¡Ayuda!'],
    revive: ['¡Te levanto!', '¡Aguantá!', '¡Arriba!'],
    attack: ['¡Al ataque!', '¡Vamos, vamos!', '¡Avancen!'],
    defend: ['¡Defendemos acá!', '¡Todos a cubierto!', '¡Esperen que vengan!'],
    breach: ['¡Entro yo!', '¡Abro y aturdo!', '¡Preparados!'],
    heal: ['¡Te curo!', '¡Quieto que te curo!'],
  };

  /* ================= avisos (sin sonido: van por "radio") ================= */
  G.callout = function (s, kind) {
    if (this.cfg.talk === false || this.cfg.noRec || s.team < 0 || s.bot) return;
    if (this.time < (s.callCd || 0)) return;
    if (!this.soldiers.some((m) => m.alive && m !== s && m.team === s.team && Math.hypot(m.x - s.x, m.y - s.y) < 14)) return;
    const a = CALL[kind]; if (!a) return;
    s.callCd = this.time + 3.5; s.bubble = { text: a[rint(a.length)], t: 1.5, radio: true };
  };
  const beginCoverOld = G.beginCover;
  G.beginCover = function (s, e) { const ok = beginCoverOld.call(this, s, e); if (ok) this.callout(s, 'cover'); return ok; };
  const startReloadOld = G.startReload;
  G.startReload = function (s) { const ok = startReloadOld.call(this, s); if (ok && s.target) this.callout(s, 'reload'); return ok; };

  /* ================= escuadras ================= */
  const mates = (g, s) => g.soldiers.filter((m) => m.alive && m !== s && m.team === s.team && !m.downed);
  G.squadOf = function (s) { return s.team >= 0 && this.squads ? this.squads[s.team] : null; };
  /** Cada 1,2 s: líder, enemigos conocidos por todo el equipo y plan. */
  G.squadTick = function (dt) {
    if (!this.cfg.teamMode) return;
    this._sq = (this._sq || 0) - dt;
    if (this._sq > 0) return;
    this._sq = 1.2;
    const now = this.time, squads = this.squads || (this.squads = {});
    const teams = new Set(this.soldiers.filter((s) => s.alive && s.team >= 0).map((s) => s.team));
    for (const t of teams) {
      const mem = this.soldiers.filter((s) => s.alive && s.team === t && !s.downed);
      const sq = squads[t] || (squads[t] = { team: t, plan: 'search', planT: 0, marks: {}, order: null, fm: 0, breach: null });
      sq.members = mem;
      if (mem.length < 2 && !(sq.order && now < sq.order.until)) { sq.plan = 'solo'; sq.leader = mem[0] || null; continue; }
      // líder: el más táctico (y el que manejás vos manda siempre)
      sq.leader = mem.find((s) => s.manual) || mem.slice().sort((a, b) => (b.sk.coord * 2 + IQ[b.iq].tac + (b.pers === 'tactico' ? 2 : 0)) - (a.sk.coord * 2 + IQ[a.iq].tac + (a.pers === 'tactico' ? 2 : 0)))[0];
      // marcas compartidas: lo que sabe cada uno, fresco
      const marks = {};
      for (const s of mem) for (const id in s.know) { const k = s.know[id], o = this.soldiers[id]; if (o && (o.downed || !o.alive)) continue; if (now - k.t < 8 && (!marks[id] || k.t > marks[id].t)) marks[id] = k; }
      sq.marks = marks;
      const cx = mem.reduce((a, s) => a + s.x, 0) / mem.length, cy = mem.reduce((a, s) => a + s.y, 0) / mem.length;
      sq.cx = cx; sq.cy = cy;
      let tgt = null, td = 1e9; for (const id in marks) { const k = marks[id], d = Math.hypot(k.x - cx, k.y - cy); if (d < td) { td = d; tgt = k; } }
      sq.tgt = tgt;
      if (sq.order && now < sq.order.until) { sq.plan = sq.order.kind; continue; }
      sq.order = null;
      const prev = sq.plan;
      if (!tgt) sq.plan = 'search';
      else {
        const mine = mem.reduce((a, s) => a + s.hp / HPL, 0), theirs = Object.keys(marks).length * 2.2;
        const bold = sq.leader.P.loud || sq.leader.P.rage > 0.6 || sq.leader.pers === 'tactico';
        sq.plan = mine >= theirs * (bold ? 0.9 : 1.3) ? 'attack' : 'defend';
      }
      if (sq.plan !== prev) { sq.planT = now; sq.ambush = null; if (sq.plan === 'attack') this.callout(sq.leader, 'attack'); if (sq.plan === 'defend') this.callout(sq.leader, 'defend'); }
      if (now - sq.fm > 3.2) { sq.fm = now; sq.flip = !sq.flip; }                 // fuego y movimiento: se turnan cada ~3 s
      this.squadBreach(sq);
    }
  };
  G.planText = function () {
    if (!this.squads) return '';
    const out = [];
    for (const t in this.squads) {
      const sq = this.squads[t]; if (!sq.leader || sq.plan === 'solo') continue;
      out.push(`${TEAMS[t].sym || '●'}${TEAMS[t].name}: ★${sq.leader.name.slice(0, 10)} ${PLAN[sq.plan] || sq.plan}`);
    }
    return out.join('\n');
  };

  /* ================= qué le toca a cada uno ================= */
  /** Devuelve {x, y, r, hold, face, suppress} o null (sigue con su propio criterio). */
  G.squadGoal = function (s) {
    const sq = this.squadOf(s); if (!sq || !sq.members || s.downed) return null;
    const now = this.time, W = this.W;
    // 1) levantar a un compañero derribado (el más cercano; el médico primero)
    const downed = this.soldiers.filter((m) => m.alive && m.downed && m.team === s.team);
    if (downed.length) {
      let best = null, bd = 1e9; for (const d of downed) { const dd = Math.hypot(d.x - s.x, d.y - s.y) - (s.role === 'medico' ? 6 : 0); if (dd < bd) { bd = dd; best = d; } }
      // ayudan los que no están en un tiroteo cerca del caído (0.9.7: antes cualquiera con un rival a la vista quedaba afuera)
      const helpers = sq.members.filter((m) => !m.manual && (!m.target || m === s || Math.hypot(m.target.x - best.x, m.target.y - best.y) > 9)).sort((a, b) => (Math.hypot(a.x - best.x, a.y - best.y) - (a.role === 'medico' ? 6 : 0)) - (Math.hypot(b.x - best.x, b.y - best.y) - (b.role === 'medico' ? 6 : 0)));
      if (helpers[0] === s && bd < 22) return { x: best.x, y: best.y, r: 0.85, hold: true, revive: best.id, face: Math.atan2(best.y - s.y, best.x - s.x) };
      if (helpers[1] === s && bd < 22) return { x: best.x, y: best.y, r: 3, hold: true, face: sq.tgt ? Math.atan2(sq.tgt.y - s.y, sq.tgt.x - s.x) : s.angle };   // otro lo cubre
    }
    // 2) el médico cura a un herido
    if (s.role === 'medico' && now > (s.healOtherCd || 0)) {
      const hurt = sq.members.filter((m) => m !== s && m.hp < m.maxHp * 0.6 && Math.hypot(m.x - s.x, m.y - s.y) < 9).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (hurt) return { x: hurt.x, y: hurt.y, r: 0.95, hold: true, healMate: hurt.id, face: Math.atan2(hurt.y - s.y, hurt.x - s.x) };
    }
    // 3) órdenes del que maneja (modo manual)
    const lead = sq.leader;
    if (sq.order && now < sq.order.until) {
      const o = sq.order;
      if (o.kind === 'follow' && lead && lead !== s) return { x: lead.x, y: lead.y, r: 2.4, hold: true, face: lead.angle };
      if (o.kind === 'hold') return { x: o.x, y: o.y, r: 2, hold: true, face: o.face };
      if (o.kind === 'regroup' && lead && lead !== s) return { x: lead.x, y: lead.y, r: 1.6, hold: true, face: lead.angle + Math.PI };
      if (o.kind === 'attack' && sq.tgt) return { x: sq.tgt.x, y: sq.tgt.y, r: 2, hold: false };
    }
    if (s === lead || sq.plan === 'solo') return null;
    // 4) entrar a un cuarto en equipo
    const br = sq.breach;
    if (br && sq.members.includes(s) && br.who.includes(s.id)) {
      const d = this.doors.get(br.door);
      if (!d) { sq.breach = null; return null; }
      if (br.phase === 'stack') { const st = br.stack[br.who.indexOf(s.id) % br.stack.length]; return { x: (st % W) + 0.5, y: ((st / W) | 0) + 0.5, r: 0.6, hold: true, face: Math.atan2(d.ty + 0.5 - s.y, d.tx + 0.5 - s.x) }; }
      if (br.phase === 'go' && sq.tgt) return { x: sq.tgt.x, y: sq.tgt.y, r: 1.5, hold: false };
    }
    // 5) planes
    if (sq.plan === 'search') {
      if (Math.hypot(lead.x - s.x, lead.y - s.y) > 6.5) return { x: lead.x, y: lead.y, r: 3, hold: false };   // no alejarse del grupo
      return null;
    }
    if (sq.plan === 'attack' && sq.tgt) {
      const t = sq.tgt, idx = sq.members.indexOf(s), cover = ((idx + (sq.flip ? 1 : 0)) % 2) === 1;
      if (cover && s.cur !== 'knife') {                                       // cubre: se queda y "aprieta" hacia el rival
        return { x: s.x, y: s.y, r: 9, hold: true, face: Math.atan2(t.y - s.y, t.x - s.x), suppress: this.los(s.x, s.y, t.x, t.y) };
      }
      const d = Math.hypot(t.x - s.x, t.y - s.y), k = Math.min(1, 4 / Math.max(1, d));          // avanza un tramo hacia el rival
      return { x: s.x + (t.x - s.x) * k, y: s.y + (t.y - s.y) * k, r: 1.2, hold: false };
    }
    if (sq.plan === 'defend' && sq.tgt) {
      if (!sq.ambush || now - sq.ambush.t > 12) sq.ambush = this.planAmbush(sq);
      const spot = sq.ambush && sq.ambush.spots[sq.members.indexOf(s) % sq.ambush.spots.length];
      if (spot != null) { const px = sq.ambush.p[0], py = sq.ambush.p[1]; return { x: (spot % W) + 0.5, y: ((spot / W) | 0) + 0.5, r: 0.8, hold: true, face: Math.atan2(py - (((spot / W) | 0) + 0.5), px - ((spot % W) + 0.5)) }; }
    }
    return null;
  };
  /** Fuego cruzado: un punto por donde va a pasar el rival y lugares a distintos ángulos que lo miran. */
  G.planAmbush = function (sq) {
    const W = this.W, t = sq.tgt; if (!t || !this.tac) return null;
    const dx = t.x - sq.cx, dy = t.y - sq.cy, dl = Math.hypot(dx, dy) || 1;
    const px = sq.cx + dx / dl * Math.min(5, dl * 0.5), py = sq.cy + dy / dl * Math.min(5, dl * 0.5);   // entre nosotros y ellos
    const n = this.bfs(Math.floor(sq.cx), Math.floor(sq.cy), null, 9, true);
    const cand = [];
    for (let q = 1; q < n; q++) {
      const i = this.queue[q]; if (this.doorGrid[i]) continue;
      const x = (i % W) + 0.5, y = ((i / W) | 0) + 0.5, d = Math.hypot(x - px, y - py);
      if (d < 3 || d > 7 || !this.los(x, y, px, py)) continue;
      cand.push({ i, a: Math.atan2(y - py, x - px), sc: this.protFrom(i, px, py) * 3 - Math.abs(d - 5) });
    }
    cand.sort((a, b) => b.sc - a.sc);
    const spots = [];
    for (const c of cand) { if (spots.every((o) => Math.abs(angDiff(o.a, c.a)) > 0.9)) spots.push(c); if (spots.length >= sq.members.length) break; }   // ángulos separados: fuego cruzado
    return { p: [px, py], spots: spots.map((c) => c.i), t: this.time };
  };
  /** Entrada a un cuarto: si el camino hacia el rival pasa por una puerta cerrada cerca, se juntan a los costados. */
  G.squadBreach = function (sq) {
    const now = this.time;
    if (sq.breach) {
      const br = sq.breach, d = this.doors.get(br.door), W = this.W;
      br.t += 1.2;
      if (!d || br.t > 14) { sq.breach = null; return; }
      if (br.phase === 'stack') {
        const ready = br.who.filter((id) => { const m = this.soldiers[id]; return m.alive && br.stack.some((st) => Math.hypot((st % W) + 0.5 - m.x, ((st / W) | 0) + 0.5 - m.y) < 0.9); }).length;
        if (ready >= Math.min(2, br.who.length) || br.t > 5) {
          br.phase = 'flash';
          const op = this.soldiers[br.who[0]];
          this.callout(op, 'breach');
          if (d && doorClosed(d)) this.toggleDoor(br.door, true, op);
          const a = Math.atan2(d.ty + 0.5 - op.y, d.tx + 0.5 - op.x);
          if (op.gren && op.gren.flash > 0 && !op.act) op.act = { type: 'throw', t: 0, dur: 0.5, gtype: 'flash', ang: a, speed: 7, released: false };
          else if (op.gren && op.gren.frag > 0 && !op.act) op.act = { type: 'throw', t: 0, dur: 0.5, gtype: 'frag', ang: a, speed: 8, released: false };
        }
      } else if (br.phase === 'flash' && br.t > 1.2) { br.phase = 'go'; br.who.forEach((id) => { const m = this.soldiers[id]; m.rushT = Math.max(m.rushT, 3); }); }
      else if (br.phase === 'go' && br.t > 8) sq.breach = null;
      return;
    }
    if (sq.plan !== 'attack' || !sq.tgt || !sq.leader || sq.members.length < 2 || now < (sq.breachCd || 0)) return;
    const L = sq.leader, W = this.W, path = this.bfs(Math.floor(L.x), Math.floor(L.y), (i) => i === Math.floor(sq.tgt.y) * W + Math.floor(sq.tgt.x), 30);
    if (!path) return;
    const di = path.findIndex((i, k) => k <= 7 && this.doorGrid[i] && doorClosed(this.doors.get(i)));
    if (di < 1) return;
    const door = path[di], before = path[di - 1], bx = before % W, by = (before / W) | 0, dd = this.doors.get(door);
    const lat = dd.along === 'v' ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];      // a los costados del casillero de entrada
    const stack = [before]; lat.forEach(([lx, ly]) => { const j = (by + ly) * W + bx + lx; if (!this.g[j] && !this.doorGrid[j]) stack.push(j); });
    const who = sq.members.filter((m) => !m.manual && Math.hypot(m.x - (bx + 0.5), m.y - (by + 0.5)) < 9).sort((a, b) => (b.role === 'asalto') - (a.role === 'asalto') || (b.gren.flash - a.gren.flash)).slice(0, 3).map((m) => m.id);
    if (who.length < 2) return;
    sq.breach = { door, stack, who, phase: 'stack', t: 0 }; sq.breachCd = now + 20;
  };

  /* ================= derribados y reanimación ================= */
  /** En vez de morir, queda en el piso (si hay compañeros que lo puedan levantar). */
  G.tryDown = function (s, by, zone) {
    if (!this.cfg.downed || !this.cfg.teamMode || s.team < 0 || s.downed || zone || (this.M && this.M.respawn) || s.bot) return false;
    if (s.downCount >= 1) return false;                                        // una sola vez por partida
    if (!this.soldiers.some((m) => m.alive && m !== s && m.team === s.team && !m.downed)) return false;
    s.downed = { t: 0, bleed: 34, by, imm: this.time + 1.2 };
    for (const o of this.soldiers) if (o.target === s) { o.target = null; o.burstLeft = 0; } s.downCount = (s.downCount || 0) + 1;
    s.hp = 1; s.act = null; s.cover = null; s.target = null; s.path = []; s.mode = 'downed';
    this.callout(s, 'down'); s.callCd = 0;
    this.addDanger(s.x, s.y, 2, 1);
    return true;
  };
  G.updateDowned = function (s, dt) {
    const d = s.downed; d.t += dt;
    s.gait *= 0.9; s.stunT = 0;
    if (d.t >= d.bleed) { s.downed = null; this.kill(s, d.by || null, false); return true; }   // se desangró
    // se arrastra despacio hacia el compañero más cercano
    const m = mates(this, s).sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[0];
    if (m && Math.hypot(m.x - s.x, m.y - s.y) > 1.2) {
      const a = Math.atan2(m.y - s.y, m.x - s.x), sp = 0.35 * dt;
      this.tryMove(s, Math.cos(a) * sp, Math.sin(a) * sp); s.moveAng = a; s.angle += angDiff(s.angle, a) * Math.min(1, dt * 3); s.phase += sp * 6;
    }
    return true;
  };
  G.finishRevive = function (s, id) {
    const m = this.soldiers[id]; if (!m || !m.alive || !m.downed) return;
    if (Math.hypot(m.x - s.x, m.y - s.y) > 1.4) return;
    m.downed = null; m.hp = Math.max(m.hp, HPL * (s.role === 'medico' ? 0.7 : 0.45)); m.mode = 'search'; m.spawnT = 1.2;
    s.stats.revives = (s.stats.revives || 0) + 1; this.callout(s, 'revive');
    if (this.narrate) this.narrate('say', { text: `¡${s.name} levantó a ${m.name}!` });
  };
  G.finishHealMate = function (s, id) {
    const m = this.soldiers[id]; if (!m || !m.alive || Math.hypot(m.x - s.x, m.y - s.y) > 1.5) return;
    const amt = s.meds.length ? 55 : 30; if (s.meds.length) s.meds.pop();
    m.hp = Math.min(m.maxHp, m.hp + amt); s.healOtherCd = this.time + 12; s.stats.healedMates = (s.stats.healedMates || 0) + amt;
    this.callout(s, 'heal');
  };

  /* ================= roles nuevos: explorador e ingeniero ================= */
  G.roleTick = function (s, dt) {
    if (s.role === 'explorador' && s.target && s.team >= 0) {                   // marca al enemigo para todo el equipo
      const e = s.target; e.markedT = this.time + 4; e.markTeam = s.team;
      for (const m of this.soldiers) if (m.alive && m !== s && m.team === s.team) m.know[e.id] = { id: e.id, x: e.x, y: e.y, t: this.time, exact: true, kind: 'mark', vx: 0, vy: 0 };
    }
    if (s.role === 'ingeniero' && (s.mines || 0) > 0 && !s.target && !s.act && this.tac) {   // pone una mina en un pasillo o puerta cerca
      const W = this.W, i = Math.floor(s.y) * W + Math.floor(s.x);
      if (this.tac.choke[i] && !this.doorGrid[i] && !(this.minesList || []).some((q) => Math.hypot(q.x - s.x, q.y - s.y) < 4) && rnd() < dt * 0.6) {
        s.mines--; (this.minesList || (this.minesList = [])).push({ x: s.x, y: s.y, team: s.team, owner: s, armT: this.time + 1.5 });
        s.act = { type: 'hold', t: 0, dur: 0.8, face: s.angle }; s.anim && (s.anim.pickT = 0.35);
      }
    }
  };
  G.stepMines = function () {
    const L = this.minesList; if (!L || !L.length) return;
    for (let i = L.length - 1; i >= 0; i--) {
      const mn = L[i]; if (this.time < mn.armT) continue;
      const hit = this.soldiers.find((s) => s.alive && (s.team < 0 || s.team !== mn.team) && Math.hypot(s.x - mn.x, s.y - mn.y) < 0.6);
      if (hit) { L.splice(i, 1); this.explode(mn.x, mn.y, 2.6, 95, mn.owner && mn.owner.alive ? mn.owner : null, 'mine'); }
    }
  };
  G.drawSquadWorld = function (x, ts) {
    for (const mn of this.minesList || []) {
      x.fillStyle = '#374151'; x.beginPath(); x.arc(mn.x * ts, mn.y * ts, ts * 0.18, 0, 6.283); x.fill();
      x.strokeStyle = '#111827'; x.lineWidth = 1; x.stroke();
      x.fillStyle = Math.floor(this.time * 2) % 2 ? '#ef4444' : '#7f1d1d'; x.beginPath(); x.arc(mn.x * ts, mn.y * ts, ts * 0.05, 0, 6.283); x.fill();
    }
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      if (s.markedT > this.time) {                                              // marcado por un explorador
        x.strokeStyle = '#f87171'; x.lineWidth = 2; const r = ts * (0.75 + 0.08 * Math.sin(this.time * 8));
        x.beginPath(); x.moveTo(s.x * ts, s.y * ts - r - 6); x.lineTo(s.x * ts - 5, s.y * ts - r - 13); x.lineTo(s.x * ts + 5, s.y * ts - r - 13); x.closePath(); x.stroke();
      }
      if (s.downed) {                                                            // derribado: cuánto le queda
        const k = 1 - s.downed.t / s.downed.bleed;
        x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 4; x.beginPath(); x.arc(s.x * ts, s.y * ts, ts * 0.7, 0, 6.283); x.stroke();
        x.strokeStyle = '#ef4444'; x.beginPath(); x.arc(s.x * ts, s.y * ts, ts * 0.7, -Math.PI / 2, -Math.PI / 2 + 6.283 * k); x.stroke();
        x.font = `${ts * 0.5}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🩸', s.x * ts + ts * 0.7, s.y * ts - ts * 0.6);
      }
    }
    if (this.cfg.debugAI && this.squads) for (const t in this.squads) { const a = this.squads[t].ambush; if (a) { x.strokeStyle = 'rgba(250,204,21,.6)'; x.setLineDash([4, 4]); x.beginPath(); x.arc(a.p[0] * ts, a.p[1] * ts, ts * 0.6, 0, 6.283); x.stroke(); x.setLineDash([]); } }
  };

  /* ================= órdenes del jugador (modo manual) ================= */
  G.squadOrder = function (kind) {
    const s = this.soldiers.find((q) => q.manual && q.alive); if (!s || s.team < 0) return false;
    this.squadTick(1e9);
    const sq = this.squadOf(s); if (!sq) return false;
    sq.order = { kind, until: this.time + 30, x: s.x, y: s.y, face: s.angle };
    sq.plan = kind; sq.leader = s;
    s.bubble = { text: { follow: '¡Síganme!', hold: '¡Cubran acá!', attack: '¡Ataquen!', regroup: '¡Agrúpense!' }[kind], t: 1.6, radio: true };
    for (const m of sq.members || []) if (m !== s) { m.thinkT = 0; m.act = null; m.cover = null; }
    return true;
  };
  App.Squad = { PLAN };
})();
