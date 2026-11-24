/* Personalidades, niveles de inteligencia y frases de los soldados (datos, sin lógica de juego). */
'use strict';

const Personas = (() => {
  const { rint, rnd } = App;

  /* Cada personalidad define cómo se mueve, cuánto ruido hace y qué tácticas prefiere (0..1).
     bravery: cuánto aguanta el miedo · rage: cuánto se enfurece al recibir daño. */
  const PERS = {
    agresivo: {
      emoji: '🔥', label: 'Agresivo', desc: 'Corre, insulta y delata dónde está.', speed: 3.15, sight: 12, loud: true, sneak: false, run: 1.18, tough: 0.8,
      distMul: 0.75, accMul: 1.0, burst: [8, 8], bravery: 0.8, rage: 0.5, finisher: 0.5,
      wpref: { shotgun: 1.2, ashotgun: 1.4, hmg: 0.8 },
      base: { peek: 0.25, door: 0.25, blind: 0.55, listen: 0.95, ambush: 0.12, cover: 0.25, flee: 0.35, flank: 0.25, stalk: 0, scav: 0.1, coord: 0.4, nade: 0.5 },
    },
    cauteloso: {
      emoji: '🛡️', label: 'Cauteloso', desc: 'Silencioso, se asoma y embosca.', speed: 2.8, sight: 12, loud: false, sneak: true, run: 1,
      tough: 1.06, distMul: 1.3, accMul: 1.0, burst: [3, 3], bravery: 0.35, rage: 0.1, finisher: 0.4,
      wpref: { lmg: 0.8, sniper: 0.8 },
      base: { peek: 0.9, door: 0.75, blind: 0.35, listen: 1.05, ambush: 0.55, cover: 0.8, flee: 0.7, flank: 0.3, stalk: 0.25, scav: 0.3, coord: 0.6, nade: 0.4 },
    },
    francotirador: {
      emoji: '🎯', label: 'Francotirador', desc: 'Se instala en pasillos largos y dispara de lejos.', speed: 2.5, sight: 15, loud: false, sneak: true, run: 1,
      distMul: 1.5, accMul: 0.76, burst: [3, 3], bravery: 0.5, rage: 0.1, finisher: 0.3,
      wpref: { sniper: 2.5, lmg: 0.4 },
      base: { peek: 0.75, door: 0.5, blind: 0.2, listen: 1.05, ambush: 0.9, cover: 0.6, flee: 0.55, flank: 0.1, stalk: 0, scav: 0.35, coord: 0.4, nade: 0.2 },
    },
    asesino: {
      emoji: '🗡️', label: 'Asesino', desc: 'Sigilo y cuchillo: ataca por la espalda.', speed: 3.15, sight: 11, loud: false, sneak: true, run: 1, tough: 0.85,
      distMul: 0.8, accMul: 0.85, burst: [4, 3], bravery: 0.8, rage: 0.2, finisher: 0.8,
      wpref: { shotgun: 0.6 },
      base: { peek: 0.6, door: 0.7, blind: 0.1, listen: 1.25, ambush: 0.55, cover: 0.3, flee: 0.25, flank: 0.9, stalk: 1, scav: 0.2, coord: 0.2, nade: 0.35 },
    },
    tactico: {
      emoji: '🧭', label: 'Táctico', desc: 'Coordina al equipo, flanquea y usa coberturas.', speed: 2.9, sight: 13, loud: false, sneak: true, run: 1,
      distMul: 1.0, accMul: 0.72, burst: [4, 4], bravery: 0.6, rage: 0.15, finisher: 0.5,
      wpref: { lmg: 0.8, ashotgun: 0.4 },
      base: { peek: 0.8, door: 0.6, blind: 0.45, listen: 1.0, ambush: 0.5, cover: 0.9, flee: 0.5, flank: 0.8, stalk: 0.3, scav: 0.3, coord: 1, nade: 1.0 },
    },
    oportunista: {
      emoji: '🦊', label: 'Oportunista', desc: 'Espera a que otros peleen y entra cuando uno cae.', speed: 2.9, sight: 13, loud: false, sneak: true, run: 1,
      distMul: 1.1, accMul: 1.0, burst: [4, 4], bravery: 0.45, rage: 0.2, finisher: 1,
      wpref: {},
      base: { peek: 0.6, door: 0.5, blind: 0.3, listen: 1.3, ambush: 0.8, cover: 0.6, flee: 0.6, flank: 0.4, stalk: 0.3, scav: 1, coord: 0.3, nade: 0.5 },
    },
    berserker: {
      emoji: '😡', label: 'Berserker', desc: 'Cuanto menos vida, más furia. Nunca huye.', speed: 3.3, sight: 11, loud: true, sneak: false, run: 1.18, tough: 0.85,
      distMul: 0.55, accMul: 1.3, burst: [12, 8], bravery: 1, rage: 1, finisher: 0.6,
      wpref: { shotgun: 1.5, ashotgun: 1.8, hmg: 1.2 },
      base: { peek: 0, door: 0.05, blind: 0.7, listen: 0.8, ambush: 0, cover: 0, flee: 0, flank: 0.1, stalk: 0, scav: 0, coord: 0.1, nade: 0.7 },
    },
    cobarde: {
      emoji: '🐔', label: 'Cobarde', desc: 'Huye, se esconde y grita de miedo.', speed: 3.0, sight: 12, loud: false, scream: true, sneak: true, run: 1,
      tough: 1.2, distMul: 1.7, accMul: 1.35, burst: [2, 2], bravery: 0, rage: 0, finisher: 0.2,
      wpref: {},
      base: { peek: 0.8, door: 0.9, blind: 0.5, listen: 1.3, ambush: 0.6, cover: 1, flee: 1.2, flank: 0, stalk: 0, scav: 0.2, coord: 0.5, nade: 0.6 },
    },
  };

  // peso de cada una al sortear personalidades "al azar"
  const WEIGHTS = { agresivo: 3, cauteloso: 3, francotirador: 2, asesino: 2, tactico: 2, oportunista: 2, berserker: 2, cobarde: 1 };

  /* Nivel de inteligencia: tiempo de reacción, puntería, uso de tácticas, esquive y errores. */
  // 0.9.7: escalera elegida con tools/iqgrid.js (cada nivel gana más que el de abajo: 6% · 15% · 21% · 27% · 32% en partidas de 10)
  const IQ = [
    { key: 'novato', label: 'Novato', emoji: '🐣', react: 0.55, aim: 1.35, tac: 0.6, dodge: 0.08, think: 1.7, forget: 0.18 },
    { key: 'normal', label: 'Normal', emoji: '🙂', react: 0.32, aim: 1.0, tac: 0.88, dodge: 0.4, think: 1.0, forget: 0.06 },
    { key: 'veterano', label: 'Veterano', emoji: '🎖️', react: 0.24, aim: 0.9, tac: 0.95, dodge: 0.55, think: 0.88, forget: 0.03 },
    { key: 'maestro', label: 'Maestro', emoji: '🧠', react: 0.18, aim: 0.82, tac: 1.0, dodge: 0.72, think: 0.78, forget: 0.01 },
  ];

  /** Elige la personalidad: la pedida, o una al azar según los pesos. */
  function choose(wanted, varied) {
    if (wanted && wanted !== 'auto' && PERS[wanted]) return wanted;
    if (!varied) return 'agresivo';
    const keys = Object.keys(WEIGHTS);
    let r = rnd() * keys.reduce((a, k) => a + WEIGHTS[k], 0);
    for (const k of keys) { r -= WEIGHTS[k]; if (r <= 0) return k; }
    return 'agresivo';
  }

  /* Frases. Cada situación tiene varias para que no se repitan siempre las mismas. */
  const LINES = {
    seen: (n) => [`¡${n}, sos un pollito!`, `¡Vení, ${n}, no seas gallina!`, `¡Te voy a hacer pelota, ${n}!`, '¡Ahí estás, boludo!', `¡${n}, sos un cobarde!`, '¡Peleá, mocoso!', `¡Sos un pavo, ${n}!`, `¡${n}, te tengo!`],
    seenWeapon: (n, w) => ({
      sniper: [`¡${n}, con esa cañita no me asustás!`, `¡Jugás de lejos, ${n}, cagón!`],
      shotgun: [`¡Con esa escopeta ni me das, ${n}!`],
      ashotgun: [`¡Qué ruidosa tu escopeta, ${n}!`],
      lmg: [`¡Muchas balas y ninguna puntería, ${n}!`],
      hmg: [`¡Esa ametralladora pesa más que vos, ${n}!`],
      pistol: [`¡Con una pistolita, ${n}? ¡Dale!`],
      knife: [`¡${n}, a cuchillo no me ganás!`, `¡Un cuchillito, ${n}! ¡Qué miedo!`],
    }[w] || []),
    hunt: (n) => [`¡Salí de ahí, ${n}!`, '¡Te escucho, gallina!', `¡${n}, te voy a encontrar!`, '¿Dónde te metiste, cobarde?', '¡No te escondás, pollito!'],
    kill: (n) => [`¡Chau, ${n}!`, '¡Uno menos!', '¡Eso te pasa, boludo!', '¡Fácil!', `¡${n}, andá a llorar a la plaza!`],
    hurt: () => ['¡Auch! ¡Cobarde!', '¡Me pegaste, bobo!', '¡Esto no se queda así!', '¡Eso dolió!'],
    miss: () => ['¡Ni me rozó!', '¡Apunta mejor, ciego!'],
    dry: () => ['¡Sin balas! ¡A cuchillazos!', '¡Se acabó la munición! ¡Vení!', '¡Con el cuchillo te alcanza, boludo!'],
    rage: () => ['¡AAAHHH!', '¡Los voy a destrozar!', '¡NO ME VAN A PARAR!', '¡Vengan todos!'],
    scare: () => ['¡No me mates!', '¡Ayuda!', '¡Mamá!', '¡Me rindo! ¡Era broma!', '¡No, no, no!'],
    win: () => ['¡Gané, gané!', '¡Los gané a todos!'],
  };
  // Insultos propios del usuario (uno por línea, con {n} para el nombre del rival)
  let custom = [];
  function setCustom(text) { custom = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 20); }
  const pickLine = (kind, n, w) => {
    if (custom.length && (kind === 'seen' || kind === 'hunt' || kind === 'kill') && rnd() < 0.6) return custom[rint(custom.length)].replace(/\{n\}/g, n || 'cobarde');
    const a = kind === 'seenWeapon' ? LINES.seenWeapon(n, w) : LINES[kind](n);
    return a.length ? a[rint(a.length)] : '';
  };

  return { PERS, IQ, WEIGHTS, LINES, choose, pickLine, setCustom };
})();
