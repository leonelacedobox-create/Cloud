/* Repeticiones (0.7): cada baja queda grabada unos segundos. Al final se pueden ver el último tiro,
   las mejores jugadas y, durante la partida, cómo murió alguien (tocando su ficha).
   Se graba en "fotos" de 10 por segundo: no se guarda nada pesado. */
'use strict';

(() => {
  const { el, $ } = App;
  const E = App.battle;
  const { Game, angDiff, clamp } = E;
  const G = Game.prototype;
  const DT = 0.1, PRE = 36, POST = 1.5, MAXCLIPS = 24;

  /* ---------- grabación ---------- */
  G.recInit = function () { this.rec = { frames: [], acc: 0, clips: [], pend: [], seq: 0 }; };
  G.recStep = function (dt) {
    if (this.cfg.noRec) return;
    if (!this.rec) this.recInit();
    const r = this.rec;
    r.acc += dt;
    if (r.acc < DT) return;
    r.acc -= DT;
    const fr = { t: this.time, s: [], b: this.bullets.map((b) => [b.x, b.y, b.vx, b.vy, b.w]) };
    for (const s of this.soldiers) {
      if (!s.alive) continue;
      fr.s.push({ id: s.id, x: s.x, y: s.y, angle: s.angle, look: s.look, moveAng: s.moveAng, phase: s.phase, gait: s.gait, recoil: s.recoil, flash: s.flash, wtype: s.wtype,
        reloadT: s.reloadT, reloadTot: s.reloadTot, meleeT: s.meleeT, sh: s.shieldHp, speedT: s.speedT, hp: s.hp, mx: s.maxHp,
        act: s.act ? { type: s.act.type, t: s.act.t, dur: s.act.dur, gtype: s.act.gtype } : null, av: s.armor ? s.armor.vest : 0, ah: s.armor ? s.armor.helm : 0 });
    }
    r.frames.push(fr);
    if (r.frames.length > 140) r.frames.shift();
    for (let i = r.pend.length - 1; i >= 0; i--) {
      const c = r.pend[i]; c.frames.push(fr);
      if (this.time >= c.until) r.pend.splice(i, 1);
    }
  };
  /** Una baja: se guarda la escena con unos segundos de antes y de después. */
  G.recKill = function (s, by, zone) {
    if (this.cfg.noRec) return;
    if (!this.rec) this.recInit();
    const r = this.rec, killer = by && by !== s ? by : null;
    const dist = killer ? Math.hypot(killer.x - s.x, killer.y - s.y) : 0;
    let score = 1, cap = '';
    const kName = killer ? killer.name : '', vName = s.name;
    if (killer) {
      killer.kt = (killer.kt || []).filter((t) => this.time - t < 6); killer.kt.push(this.time);
      if (killer.cur === 'knife') { score += 2; cap = `🔪 ${kName} apuñaló a ${vName}`; }
      else if (dist > 16) { score += 3; cap = `🔭 Tiro larguísimo de ${kName} a ${vName} (${dist.toFixed(0)} casilleros)`; }
      else if (dist > 9) { score += 1.5; cap = `🎯 Buen tiro de ${kName} a ${vName} (${dist.toFixed(0)} casilleros)`; }
      if (killer.kt.length >= 2) { score += 1.5 * killer.kt.length; cap = `⚡ ${kName} liquidó a ${killer.kt.length} en pocos segundos`; }
      if (!cap) cap = `💥 ${kName} eliminó a ${vName}`;
    } else cap = zone ? `🔥 ${vName} cayó fuera de la zona` : `💥 ${vName} murió en una explosión`;
    const clip = { id: ++r.seq, victim: s.id, killer: killer ? killer.id : -1, t: this.time, score, cap, until: this.time + POST, frames: r.frames.slice(-PRE), fx: s.x, fy: s.y };
    r.clips.push(clip); r.pend.push(clip);
    if (r.clips.length > MAXCLIPS) { let k = 0; for (let i = 1; i < r.clips.length - 1; i++) if (r.clips[i].score < r.clips[k].score) k = i; r.clips.splice(k, 1); }
  };
  /** Al terminar: la última baja vale más y las escenas pendientes se cierran. */
  G.recFinish = function () {
    const r = this.rec; if (!r || this.recDone) return;
    this.recDone = true;
    const last = r.clips[r.clips.length - 1];
    if (last) { last.score += 4; last.final = true; last.cap = '🏁 ' + last.cap.replace(/^\S+\s/, ''); }
    r.pend = [];
  };
  G.replayClip = function () {
    this.recFinish();
    const r = this.rec; if (!r) return null;
    const last = r.clips.length ? r.clips[r.clips.length - 1] : null;
    const best = r.clips.slice().sort((a, b) => b.score - a.score).slice(0, 5).sort((a, b) => a.t - b.t);
    return { last, best, all: r.clips };
  };
  G.deathClip = function (id) {
    const r = this.rec; if (!r) return null;
    for (let i = r.clips.length - 1; i >= 0; i--) if (r.clips[i].victim === id) return r.clips[i];
    return null;
  };

  /* ---------- dibujo de una escena grabada ---------- */
  function lerpFrame(a, b, k) {
    if (!b || k <= 0) return a;
    const out = { t: a.t + (b.t - a.t) * k, s: [], b: k < 0.5 ? a.b : b.b };
    for (const sa of a.s) {
      const sb = b.s.find((q) => q.id === sa.id);
      if (!sb) { out.s.push(sa); continue; }
      out.s.push(Object.assign({}, sb, {
        x: sa.x + (sb.x - sa.x) * k, y: sa.y + (sb.y - sa.y) * k,
        angle: sa.angle + angDiff(sa.angle, sb.angle) * k, look: sa.look + angDiff(sa.look, sb.look) * k, moveAng: sa.moveAng + angDiff(sa.moveAng, sb.moveAng) * k,
        phase: sa.phase + (sb.phase - sa.phase) * k, gait: sa.gait + (sb.gait - sa.gait) * k,
      }));
    }
    return out;
  }
  G.drawReplayFrame = function (fr, cx, cy, clip, tNow) {
    const x = this.ctx, ts = this.ts, dpr = this.dpr, sd = this.sdpr, W = this.W, H = this.H;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = '#0a0e1a'; x.fillRect(0, 0, this.cw, this.ch);
    let camX = cx, camY = cy;
    if (this.isFull) { camX = W / 2; camY = H / 2; }
    else {
      const vw = this.cw / ts, vh = this.ch / ts;
      camX = vw >= W ? W / 2 : clamp(camX, vw / 2, W - vw / 2); camY = vh >= H ? H / 2 : clamp(camY, vh / 2, H - vh / 2);
    }
    const left = camX - this.cw / (2 * ts), top = camY - this.ch / (2 * ts), right = left + this.cw / ts, bottom = top + this.ch / ts;
    const l = Math.max(0, left), t = Math.max(0, top), r = Math.min(W, right), b = Math.min(H, bottom);
    if (r > l && b > t) x.drawImage(this.static, l * ts * sd, t * ts * sd, (r - l) * ts * sd, (b - t) * ts * sd, (l - left) * ts, (t - top) * ts, (r - l) * ts, (b - t) * ts);
    x.save(); x.translate(-left * ts, -top * ts);
    for (const d of this.doors.values()) Art.drawDoor(x, d, ts);
    this.drawWorld(x, ts, left, top, this.cw / ts, this.ch / ts);
    const victim = this.soldiers[clip.victim];
    const list = fr.s.slice().sort((a, b2) => a.y - b2.y);
    for (const e of list) {
      const live = this.soldiers[e.id];
      const p = Object.create(live);
      Object.assign(p, e, { shieldHp: e.sh, armor: { vest: e.av, helm: e.ah }, alive: true, anim: null });
      Art.drawSoldier(x, p, ts, fr.t);
    }
    for (const bu of fr.b) {
      const sp = Math.hypot(bu[2], bu[3]) || 1, tx = bu[2] / sp, ty = bu[3] / sp;
      x.strokeStyle = '#ffe9a8'; x.globalAlpha = 0.65; x.lineWidth = Math.max(2, ts * 0.1); x.lineCap = 'round';
      x.beginPath(); x.moveTo((bu[0] - tx * 0.6) * ts, (bu[1] - ty * 0.6) * ts); x.lineTo(bu[0] * ts, bu[1] * ts); x.stroke(); x.globalAlpha = 1;
    }
    for (const e of list) {                                                  // nombres
      const live = this.soldiers[e.id], fs = Math.max(9, Math.min(13, ts * 0.46));
      x.font = `800 ${fs}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'bottom'; x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,.85)';
      const ny = e.y * ts - ts * 0.75; x.strokeText(live.name, e.x * ts, ny); x.fillStyle = e.id === clip.killer ? '#fde047' : '#fff'; x.fillText(live.name, e.x * ts, ny);
    }
    if (tNow > clip.t - 0.05 && victim) {                                    // la baja: marca roja donde cayó
      const k = clamp((tNow - clip.t) / 1.2, 0, 1);
      x.strokeStyle = '#ff4d6a'; x.globalAlpha = 1 - k; x.lineWidth = 3; x.beginPath(); x.arc(clip.fx * ts, clip.fy * ts, ts * (0.5 + k * 1.2), 0, 6.283); x.stroke(); x.globalAlpha = 1;
      Art.drawCorpse(x, { x: clip.fx, y: clip.fy, color: victim.color, ap: victim.ap, ang: 0.6 }, ts);
    }
    x.restore();
  };

  /* ---------- reproductor ---------- */
  let play = null;
  const ui = () => {
    let box = $('#replayBar');
    if (box) return box;
    box = el('div', { id: 'replayBar', class: 'replay-bar', hidden: true },
      el('div', { class: 'replay-cap', id: 'replayCap' }),
      el('div', { class: 'replay-btns' },
        el('button', { class: 'btn small', id: 'rpPlay' }, '⏸'),
        el('button', { class: 'btn small', id: 'rpSlow' }, '🐌 ×0.5'),
        el('button', { class: 'btn small', id: 'rpNext' }, '⏭'),
        el('button', { class: 'btn small primary', id: 'rpClose' }, '✕ Cerrar')));
    $('#canvasWrap').append(box);
    $('#rpPlay').onclick = () => { if (play) { play.paused = !play.paused; $('#rpPlay').textContent = play.paused ? '▶' : '⏸'; } };
    $('#rpSlow').onclick = () => { if (play) { play.speed = play.speed === 1 ? 0.5 : 1; $('#rpSlow').textContent = play.speed === 1 ? '🐌 ×0.5' : '▶ ×1'; } };
    $('#rpNext').onclick = () => { if (play) startClip(play.i + 1); };
    $('#rpClose').onclick = () => stop();
    return box;
  };
  function startClip(i) {
    if (!play) return;
    if (i >= play.clips.length) { stop(); return; }
    play.i = i; const c = play.clips[i];
    play.t = c.frames[0].t; play.end = c.frames[c.frames.length - 1].t + 0.6;
    $('#replayCap').textContent = `${play.title ? play.title + ' · ' : ''}${play.clips.length > 1 ? `${i + 1}/${play.clips.length} · ` : ''}${c.cap}`;
    $('#rpNext').hidden = play.clips.length < 2;
  }
  function stop() {
    if (!play) return;
    cancelAnimationFrame(play.raf);
    const p = play; play = null;
    ui().hidden = true;
    if (p.onClose) p.onClose();
  }
  function loop(now) {
    if (!play) return;
    const g = play.game, dt = Math.min(0.05, (now - play.last) / 1000); play.last = now;
    if (g.dead || !g.static) { stop(); return; }
    if (!play.paused) play.t += dt * play.speed;
    const c = play.clips[play.i], fr = c.frames;
    if (play.t > play.end) { if (play.clips.length > 1) startClip(play.i + 1); else play.t = fr[0].t; }
    else {
      let k = 0; while (k < fr.length - 2 && fr[k + 1].t < play.t) k++;
      const a = fr[k], b = fr[Math.min(fr.length - 1, k + 1)], f = b.t > a.t ? clamp((play.t - a.t) / (b.t - a.t), 0, 1) : 0;
      const cur = lerpFrame(a, f > 0 ? b : null, f);
      // la cámara sigue a los dos protagonistas (matador y víctima)
      const pts = cur.s.filter((q) => q.id === c.killer || q.id === c.victim);
      let tx = c.fx, ty = c.fy;
      if (pts.length) { tx = pts.reduce((s, q) => s + q.x, 0) / pts.length; ty = pts.reduce((s, q) => s + q.y, 0) / pts.length; }
      play.cx += (tx - play.cx) * Math.min(1, dt * 5); play.cy += (ty - play.cy) * Math.min(1, dt * 5);
      g.drawReplayFrame(cur, play.cx, play.cy, c, play.t);
    }
    play.raf = requestAnimationFrame(loop);
  }
  /** Reproduce una lista de escenas sobre el mapa de la partida. */
  function playClips(game, clips, title, onClose) {
    clips = (clips || []).filter((c) => c && c.frames && c.frames.length > 2);
    if (!clips.length || !game || !game.static) return false;
    ui(); stop();
    $('#replayBar').hidden = false; $('#rpPlay').textContent = '⏸'; $('#rpSlow').textContent = '🐌 ×0.5';
    play = { game, clips, title, onClose, i: 0, t: 0, end: 0, speed: 1, paused: false, last: performance.now(), cx: clips[0].fx, cy: clips[0].fy, raf: 0 };
    startClip(0);
    play.raf = requestAnimationFrame(loop);
    return true;
  }
  App.Replay = { play: playClips, stop, get active() { return !!play; } };
})();
