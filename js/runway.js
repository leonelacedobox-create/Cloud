/* Pasarela de animaciones (0.9.2): una pantalla oculta para ver cada animación por separado y en cámara lenta.
   Se abre tocando 5 veces el número de versión en el menú, o entrando con #pasarela al final de la dirección. */
'use strict';

(() => {
  const { el, $ } = App;
  const G = App.battle.Game.prototype;
  const PI = Math.PI, TAU = PI * 2;
  const N = 8;                                                    // cuarto de 8 × 8 casilleros
  const env = {
    W: N, H: N, time: 0, quality: 'alta', cfg: {}, corpses: [], decals: [],
    isSolid: (x, y) => x <= 0 || y <= 0 || x >= N - 1 || y >= N - 1,
    weaponOf: (s) => (s.wtype && s.wtype !== 'knife' ? { type: s.wtype, sup: false } : null),
  };
  ['rigUpdate', 'addDecal', 'makeRagdoll', 'stepCorpses', 'drawDecals'].forEach((k) => { env[k] = G[k]; });

  const WEAP = ['pistol', 'smg', 'rifle', 'lmg', 'hmg', 'sniper', 'shotgun', 'ashotgun', 'revolver', 'crossbow'];
  const NAME = { pistol: 'pistola', smg: 'subfusil', rifle: 'rifle', lmg: 'ametralladora ligera', hmg: 'ametralladora pesada', sniper: 'sniper', shotgun: 'escopeta', ashotgun: 'escopeta automática', revolver: 'revólver', crossbow: 'ballesta' };
  const RELOAD = { pistol: 1.4, smg: 1.8, rifle: 2.2, lmg: 2.1, hmg: 4.2, sniper: 2.8, shotgun: 2.6, ashotgun: 3.0, revolver: 2.4, crossbow: 1.6 };
  // cada animación: [nombre, función que mueve al muñeco en el tiempo t]
  const moveCircle = (s, t, sp, gait) => { const r = 1.7, a = t * sp / r; const nx = N / 2 + Math.cos(a) * r, ny = N / 2 + Math.sin(a) * r; s.phase += Math.hypot(nx - s.x, ny - s.y) * 3.2; s.x = nx; s.y = ny; s.moveAng = s.angle = s.look = a + PI / 2; s.gait = gait; };
  const ANIMS = [
    ['Caminar', (s, t) => moveCircle(s, t, 1.6, 0.7)],
    ['Correr', (s, t) => moveCircle(s, t, 3.4, 1)],
    ['Sigilo (agachado)', (s, t) => { s.sneak = true; moveCircle(s, t, 1.1, 0.55); }],
    ['Asomarse por una esquina', (s, t) => { const W = N; s.cover = { phase: t % 2.4 < 1.2 ? 'peek' : 'hide', hide: 4 * W + 4, peek: 4 * W + 5 }; s.angle = s.look = -PI / 2; }],
    ...WEAP.map((w) => [`Recargar ${NAME[w]}`, (s, t) => { s.wtype = w; s.reloadTot = RELOAD[w]; const c = RELOAD[w] + 0.6; s.reloadT = Math.max(0, RELOAD[w] - (t % c)); }]),
    ['Cambiar de arma', (s, t) => { const k = Math.floor(t / 1.2) % 3; s.wtype = ['pistol', 'rifle', 'knife'][k]; s.swapT = Math.max(0, 0.45 - (t % 1.2)); }],
    ...WEAP.map((w) => [`Disparar ${NAME[w]}`, (s, t) => { s.wtype = w; const cd = { smg: 0.07, lmg: 0.11, hmg: 0.09, rifle: 0.14, ashotgun: 0.38 }[w] || 0.7; s.recoil = Math.max(0, 1 - (t % cd) / Math.min(0.12, cd)); }]),
    ['Cuchillo: estocada', (s, t) => knife(s, t, 'stab')],
    ['Cuchillo: corte', (s, t) => knife(s, t, 'slash')],
    ['Cuchillo: por la espalda', (s, t) => knife(s, t, 'back')],
    ['Granada por arriba', (s, t) => { const d = 0.5, c = t % 1.3; s.act = c < d ? { type: 'throw', t: c, dur: d, gtype: 'frag', speed: 11, released: c > 0.3 } : null; }],
    ['Granada rodando', (s, t) => { const d = 0.5, c = t % 1.3; s.act = c < d ? { type: 'throw', t: c, dur: d, gtype: 'smoke', speed: 6, released: c > 0.3 } : null; }],
    ['Abrir una puerta', (s, t) => { const c = t % 1.2; s.act = c < 0.45 ? { type: 'open', t: c, dur: 0.45 } : null; }],
    ['Curarse', (s, t) => { s.act = { type: 'heal', t: t % 2.8, dur: 2.8 }; }],
    ['Juntar algo del piso', (s, t) => { if (t % 1.2 < 0.02) s.anim.pickT = 0.35; }],
    ['Recibir un tiro', (s, t) => { if (t % 0.9 < 0.02) { s.anim.hitT = 0.28; s.anim.hitAng = Math.random() * TAU; s.anim.hitK = 1; } }],
    ['Aturdido', (s) => { s.stunT = 1; }],
    ['Saltar un cajón', (s, t) => { const c = t % 1.4; s.vault = c < 0.45 ? { t: c, dur: 0.45 } : null; s.x = N / 2 + (c < 0.45 ? c / 0.45 : 1) * 1.6 - 0.8; }],
    ['Muerte por bala', (s, t, st) => death(st, t, 'rifle')],
    ['Muerte por escopetazo', (s, t, st) => death(st, t, 'shotgun')],
    ['Muerte por explosión', (s, t, st) => death(st, t, 'boom')],
    ['Muerte a cuchillo', (s, t, st) => death(st, t, 'knife')],
  ];
  function knife(s, t, kind) {
    s.wtype = 'knife'; const c = t % 0.9;
    if (c < 0.02) { s.meleeT = 0.25; }
    else s.meleeT = Math.max(0, 0.25 - c);
    s.anim.swingN = kind === 'slash' ? 1 : 0;
    if (kind === 'back') s.target = { look: s.angle, x: s.x + Math.cos(s.angle) * 1.2, y: s.y + Math.sin(s.angle) * 1.2 };
    else s.target = null;
  }
  function death(st, t, kind) {
    const c = t % 3;
    if (c < 0.02 && !st.dead) {
      const s = st.s; st.dead = true;
      s._lastHit = { ang: -PI / 2 + (Math.random() - 0.5) * 0.6, k: 1, kind };
      env.corpses = [{ x: s.x, y: s.y, color: s.color, ap: s.ap, ang: 0, t0: env.time, rag: env.makeRagdoll(s) }];
    }
    if (c > 2.9) { st.dead = false; env.corpses = []; }
  }

  let box = null, cv = null, cur = 0, slow = 1, raf = 0, T = 0, last = 0, st = null;
  const freshSoldier = () => {
    const ap = Art.makeLooks(1)[0];
    return { x: N / 2, y: N / 2 + 0.5, ap, color: '#3b82f6', angle: -PI / 2, look: -PI / 2, moveAng: -PI / 2, phase: 0, gait: 0, recoil: 0, flash: 0, act: null, shieldHp: 0, speedT: 0, team: -1,
      wtype: 'rifle', reloadT: 0, reloadTot: 2, meleeT: 0, swapT: 0, stunT: 0, dodgeT: 0, armor: { vest: 0, helm: 0 }, lastStep: 0, sneak: false, cover: null, target: null };
  };
  function pick(i) { cur = i; T = 0; env.corpses = []; env.decals = []; st = { s: freshSoldier(), dead: false }; env.rigUpdate(st.s, 0); $$('#rwList button').forEach((b, k) => b.classList.toggle('primary', k === i)); }
  const $$ = (q) => Array.from(document.querySelectorAll(q));
  function frame(now) {
    if (!box || box.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000) * slow; last = now; T += dt; env.time += dt;
    const s = st.s;
    s.stunT = 0; s.act = null; s.sneak = false; s.cover = null; s.recoil *= 0.85;
    ANIMS[cur][1](s, T, st);
    if (!st.dead) env.rigUpdate(s, dt);
    env.stepCorpses(dt);
    const x = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1), size = cv.clientWidth, ts = size / N;
    if (cv.width !== Math.round(size * dpr)) { cv.width = cv.height = Math.round(size * dpr); cv.style.height = size + 'px'; }
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = '#1b2233'; x.fillRect(0, 0, size, size);
    for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) {
      if (env.isSolid(xx, yy)) { x.fillStyle = '#4b5f8a'; x.fillRect(xx * ts, yy * ts, ts, ts); }
      else { x.fillStyle = (xx + yy) % 2 ? '#262f45' : '#2b3550'; x.fillRect(xx * ts, yy * ts, ts, ts); }
    }
    if (cur === ANIMS.findIndex((a) => a[0] === 'Saltar un cajón')) { x.fillStyle = '#a0703c'; x.fillRect(4 * ts + ts * 0.07, 4 * ts + ts * 0.07, ts * 0.86, ts * 0.86); }
    env.drawDecals(x, ts, 0, 0, N, N);
    for (const c of env.corpses) Art.drawCorpse(x, c, ts, env.time);
    if (!st.dead) Art.drawSoldier(x, s, ts, env.time);
    raf = requestAnimationFrame(frame);
  }
  function open() {
    if (!box) {
      box = el('div', { class: 'modal', id: 'runway' });
      cv = el('canvas', { class: 'rw-canvas' });
      const list = el('div', { id: 'rwList', class: 'rw-list' }, ANIMS.map(([n], i) => el('button', { class: 'btn small', onclick: () => pick(i) }, n)));
      box.append(el('div', { class: 'modal-box' },
        el('div', { class: 'card-head' }, el('b', {}, '🎬 Pasarela de animaciones'), el('span', { class: 'spacer' }),
          el('button', { class: 'btn small', id: 'rwSlow', onclick: (e) => { slow = slow === 1 ? 0.25 : 1; e.target.textContent = slow === 1 ? '🐌 ×0.25' : '▶ ×1'; } }, '🐌 ×0.25'),
          el('button', { class: 'btn small', onclick: () => { box.hidden = true; cancelAnimationFrame(raf); } }, '✕')),
        cv, list));
      document.body.append(box);
    }
    box.hidden = false; pick(cur); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  App.Runway = { open, ANIMS };
  let taps = 0, tapT = 0;
  const ver = document.querySelector('#screen-menu .hint.center');
  if (ver) ver.addEventListener('click', () => { const n = performance.now(); taps = n - tapT < 600 ? taps + 1 : 1; tapT = n; if (taps >= 5) { taps = 0; open(); } });
  if (location.hash === '#pasarela') setTimeout(open, 300);
})();
