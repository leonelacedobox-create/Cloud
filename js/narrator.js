/* Relator automático (0.9): comenta lo que pasa como un relator de fútbol, con un cartel grande
   arriba del mapa y (si está activada) la voz del celular. No repite y no tapa todo: una frase cada tanto. */
'use strict';

(() => {
  const { rnd, $, el } = App;
  const G = App.battle.Game.prototype;
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  const LINES = {
    first: ['¡PRIMERA SANGRE! {k} abre el marcador', '¡Arrancó la cosa! {k} pega primero', '¡Y {k} inaugura la fiesta!', '¡Se rompió el cero! {k} se anota', '¡Abrió la lata {k}!', '¡Primer golpe y es de {k}!'],
    double: ['¡DOBLE BAJA de {k}!', '¡Dos al hilo! {k} no perdona', '¡Doblete de {k}, qué momento!', '¡Dos de una! {k} pidió la pelota', '¡Doblete! {k} está en llamas'],
    triple: ['¡TRIPLETE! {k} está imparable', '¡Tres de una! ¡Que alguien pare a {k}!', '¡HAT-TRICK de {k}! ¡No lo puedo creer!', '¡Tres al hilo! ¡{k} se los está comiendo crudos!'],
    spree3: ['{k} ya lleva tres… ¡está encendido!', '¡Racha de {k}! Tres bajas'],
    spree5: ['¡{k} ES UNA MÁQUINA! Cinco bajas', '¡Cinco! {k} juega a otra cosa', '¡Llamen a la policía! {k} ya lleva cinco', '¡Es un show de {k}! ¡Cinco!'],
    long: ['¡Qué tiro de {k}! Desde {d} casilleros', '¡Golazo de media cancha! {k} desde {d}', '¡Francotirador! {k} la clavó a {d} casilleros', '¡Desde la otra punta! {k} a {d} casilleros', '¡Al ángulo! {k} la puso desde {d}'],
    knife: ['¡A cuchillo! {k} lo hizo en silencio', '¡Puñalada de {k}! {v} ni lo vio venir', '¡Por la espalda! {k} no tiene piedad', '¡Cuchillazo! {v} se fue sin saber qué pasó', '¡Mano a mano y a cuchillo! Ganó {k}'],
    underdog: ['¡Sorpresa! {k} le ganó a {v}', '¡Batacazo! {k} bajó al favorito {v}'],
    comeback: ['¡Con un hilo de vida, {k} se la lleva!', '¡Agonizando y todo, {k} gana el duelo!'],
    revenge: ['¡VENGANZA! {k} se cobró la deuda con {v}', '¡Ojo por ojo! {k} le devolvió la gentileza a {v}'],
    duel: ['¡Quedan dos! Mano a mano entre {a} y {b}', '¡Final de película! {a} contra {b}', '¡Se define acá! {a} o {b}', '¡Los últimos dos! {a} y {b}, que gane el mejor', '¡Duelo al sol! {a} contra {b}'],
    zone: ['¡Se cierra la zona! Nadie está a salvo', '¡La zona aprieta! A moverse'],
    overtime: ['¡MUERTE SÚBITA! Esto se tiene que terminar', '¡Muerte súbita! Ya no hay dónde esconderse'],
    end: ['¡Se terminó! {w} se queda con todo', '¡Fin del partido! Ganó {w}', '¡Ahí está! {w} es el último en pie', '¡Campeón! ¡{w} levanta la copa!', '¡Pitazo final! {w} se lleva la gloria'],
    draw: ['¡Empate! Nadie se lleva nada', '¡Tablas! Habrá que tirar la moneda'],
  };
  const PRIO = { end: 9, draw: 9, duel: 7, triple: 7, spree5: 7, say: 6, first: 6, double: 5, revenge: 5, overtime: 5, long: 4, knife: 4, underdog: 4, comeback: 4, spree3: 3, zone: 3 };

  let box = null, hideT = 0;
  function show(text, big) {
    if (!box || !box.isConnected) { box = el('div', { class: 'narrator', 'aria-live': 'polite' }); $('#canvasWrap').append(box); }
    box.textContent = text; box.classList.toggle('big', !!big);
    box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
    clearTimeout(hideT); hideT = setTimeout(() => box && box.classList.remove('show'), big ? 3200 : 2400);
  }

  /** Pide decir algo. Si ya habló hace muy poco, solo pasa lo más importante. */
  G.narrate = function (kind, data = {}) {
    if (this.cfg.noRec || this.cfg.narrator === false || this.dead) return;
    const now = performance.now(), p = PRIO[kind] || 1;
    this._nar = this._nar || { t: 0, p: 0, used: new Set() };
    const n = this._nar;
    if (now - n.t < 2300 && p <= n.p && !data.force) return;
    let line = kind === 'say' ? data.text : pick(LINES[kind] || ['']);
    if (!line) return;
    if (kind !== 'say' && n.used.has(line) && LINES[kind].length > 1) line = pick(LINES[kind].filter((l) => !n.used.has(l))) || line;
    n.used.add(line); n.t = now; n.p = p;
    line = line.replace('{k}', data.k || '').replace('{v}', data.v || '').replace('{d}', data.d || '').replace('{a}', data.a || '').replace('{b}', data.b || '').replace('{w}', data.w || '');
    show('🎙️ ' + line, p >= 7);
    // con más emoción cuanto más importante es la jugada: más rápido y más agudo
    if (App.Voice && this.speed <= 2) App.Voice.say(line, { prio: p >= 5, rate: 1.08 + p * 0.025, pitch: 0.98 + p * 0.03 });
  };

  /** Mira cada baja y decide si vale un comentario. */
  G.narrateKill = function (s, by, zone) {
    if (this.cfg.noRec || this.cfg.narrator === false) return;
    const pl = this.soldiers.filter((q) => !q.bot);
    if (by && by !== s && !(by.team >= 0 && by.team === s.team)) {
      (by.victimIds = by.victimIds || []).push(s.id);
      const recent = (by.kt || []).filter((t) => this.time - t < 6).length, d = Math.hypot(by.x - s.x, by.y - s.y);
      const avenged = (s.victimIds || []).some((id) => id === by.id || (by.team >= 0 && this.soldiers[id] && this.soldiers[id].team === by.team));
      if (this.deaths === 1) this.narrate('first', { k: by.name });
      else if (recent >= 3) this.narrate('triple', { k: by.name });
      else if (recent === 2) this.narrate('double', { k: by.name });
      else if (by.kills === 5) this.narrate('spree5', { k: by.name });
      else if (by.cur === 'knife') this.narrate('knife', { k: by.name, v: s.name });
      else if (d > 14) this.narrate('long', { k: by.name, d: d.toFixed(0) });
      else if (avenged) this.narrate('revenge', { k: by.name, v: s.name });
      else if (by.iq + 1 < s.iq) this.narrate('underdog', { k: by.name, v: s.name });
      else if (by.hp < by.maxHp * 0.2) this.narrate('comeback', { k: by.name });
      else if (by.kills === 3) this.narrate('spree3', { k: by.name });
    }
    if (!(this.M && this.M.respawn) && (!this.M || this.M.key === 'classic' || this.M.key === 'knives')) {
      const alive = pl.filter((q) => q.alive);
      const groups = new Set(alive.map((q) => (q.team < 0 ? 'p' + q.id : 't' + q.team)));
      if (alive.length === 2 && groups.size === 2 && !this._duelTold) { this._duelTold = true; setTimeout(() => this.narrate('duel', { a: alive[0].name, b: alive[1].name }), 900); }
    }
  };
  /** Zona, muerte súbita y final. */
  G.narrateTick = function () {
    if (this.cfg.noRec || this.cfg.narrator === false) return;
    if (this.zone && !this._zoneTold) { this._zoneTold = true; this.narrate('zone'); }
    if (this.overtime && !this._otTold) { this._otTold = true; this.narrate('overtime'); }
  };
  G.narrateEnd = function () {
    if (this.cfg.noRec || this.cfg.narrator === false) return;
    const w = this.winners || [];
    if (this.endInfo && this.endInfo.title && !w.length) { this.narrate('draw'); return; }
    if (!w.length) { this.narrate('draw'); return; }
    const name = w.length > 1 && w[0].team >= 0 ? 'el equipo ' + App.TEAMS[w[0].team].name : w[0].name;
    this.narrate('end', { w: name });
  };
})();
