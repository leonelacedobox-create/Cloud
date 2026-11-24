/* Ayuda (0.9): cómo se juega todo, en secciones que se abren de a una. */
'use strict';

(() => {
  const { el, $ } = App;
  const S = [
    ['🪙 La moneda', [
      'Tocá la moneda o el botón para tirarla. Un lado es Milei y el otro Cristina.',
      '<b>Libre:</b> tirar y listo. <b>Apuestas:</b> cada uno elige cara y suma 🏆 si acierta. <b>Se va temprano:</b> reparte a todos de un lado y se va el que gana (o el que pierde).',
      '<b>Series</b> al mejor de 3, 5 o 7 y <b>estilos de tirada</b>: Clásica, Alta, Trompo y Loca.',
    ]],
    ['🔫 La batalla', [
      'Agregá de 2 a 10 soldados con nombre y color. Se mueven y disparan solos: <b>gana el último en pie</b> (o el que cumpla el objetivo del modo).',
      'Tocá la ficha de un soldado arriba para <b>seguirlo con la cámara</b>; si ya cayó, ves la <b>repetición</b> de cómo murió. 🎥 cambia entre automático, siguiendo y todo el mapa; 👁 muestra solo lo que ve ese soldado.',
      'En el ⚙️ de cada soldado elegís personalidad, rol, gorro, foto, frases propias, a quién apostás y si lo manejás vos. Todos tienen la misma inteligencia: lo que cambia es la forma de jugar.',
      'Los soldados <b>no saben dónde están los demás</b>: ven con un cono de visión y oyen pasos, tiros, puertas y gritos. Un “?” es que oyó algo; un “!” que vio a alguien.',
    ]],
    ['🎮 Manejar un soldado', [
      'Activá “Lo manejo yo” en el ⚙️ de un soldado, o tocá 🎮 durante la partida para tomar el control del que estás siguiendo.',
      '<b>Joystick</b> para caminar (empujá hasta el borde para correr) · <b>🔫</b> mantené para disparar (apunta solo al enemigo que ve) · <b>🔄</b> recargar · <b>🔁</b> cambiar de arma · <b>💣</b> granada · <b>🩹</b> botiquín. Las puertas se abren al empujarlas.',
      'Con teclado: W A S D o flechas, espacio para disparar, Shift para caminar en silencio, R, Q, G y H.',
      '<b>En la PC</b> también podés usar el <b>mouse</b>: apuntás con el puntero, <b>clic</b> dispara, <b>clic derecho</b> tira granada y la <b>rueda</b> cambia de arma. Atajos: <b>P</b> pausa, <b>1 2 3</b> velocidad, <b>C</b> cámara, <b>V</b> vista del soldado, <b>M</b> manejar uno.',
      'Caminando contra un <b>cajón</b> un ratito, lo <b>empujás</b> (si atrás hay lugar): sirve para armarte una cobertura. Con <b>🧰</b> usás la herramienta que tengas.',
      'Si cae el soldado que seguís, la cámara muestra unos segundos <b>al que lo eliminó</b>.',
      'Modo zurdo (en el menú) pone el joystick a la derecha.',
    ]],
    ['🏁 Modos de juego', [
      '<b>Clásico:</b> el último en pie. <b>Duelo:</b> cada baja suma y se reaparece. <b>Bandera:</b> robá la bandera enemiga y llevala a tu base. <b>Colina:</b> quedate solo en la zona marcada para sumar. <b>Bomba:</b> el Rojo planta, el Azul desactiva. <b>Oleadas:</b> todos contra 5 oleadas de bots. <b>Botín:</b> juntá lingotes de oro. <b>Cuchillos:</b> sin armas.',
      'Si un modo con tiempo empata hay prórroga, y si sigue el empate se desempata con la moneda.',
    ]],
    ['👥 Equipos', [
      'Cada equipo tiene un <b>líder</b> (★) que elige el plan: buscar, atacar o defender. Se ve arriba a la derecha.',
      'Al <b>atacar</b> se turnan: uno cubre disparando y el otro avanza. Antes de entrar a un cuarto se juntan a los costados de la puerta, uno la abre y tira una aturdidora. Al <b>defender</b> se reparten esquinas para dejar al rival en un fuego cruzado.',
      '<b>Roles</b>: 💣 asalto (entra primero), 🩹 médico (cura y levanta más rápido), 🎯 tirador, 🛡️ tanque (aguanta más), 🔭 explorador (más rápido, marca enemigos para todos) y 🔧 ingeniero (pone minas). Si no elegís, se reparten solos.',
      '<b>Derribados</b>: en vez de morir quedan en el piso arrastrándose unos segundos y un compañero los puede levantar (el médico más rápido).',
      'Si manejás un soldado de un equipo, con 👣 📍 ⚔️ 🫂 les das órdenes a tus compañeros: síganme, cubran acá, ataquen y agrúpense.',
    ]],
    ['🎒 Armas y objetos', [
      'Todos arrancan con pistola y cuchillo y pueden llevar un arma más del piso: sniper, ametralladoras, escopetas, subfusil, rifle, revólver o ballesta. Al morir sueltan todo.',
      'Granadas (fragmentación, humo y aturdidora), chaleco, casco, botiquines, mochila y accesorios (silenciador, mira, cargador extendido). Los barriles rojos explotan.',
    ]],
    ['🌧️ Mundo vivo: mapas, clima y herramientas', [
      'Las <b>paredes finas</b> se agujerean a tiros (se ve y se dispara a través) y se derrumban con explosivos; las <b>puertas</b> se rompen. Las <b>mesas</b> se dan vuelta para cubrirse.',
      '<b>Herramientas</b> del botín: 🧨 carga explosiva para abrir paredes, 💥 mina, 🪤 trampa con alarma, 📡 sensor de movimiento, 🛡️ escudo portátil y 🔭 binoculares. Manejando un soldado se usan con <b>🧰</b> (la carga, mirando a una pared o puerta).',
      'En Ajustes: <b>clima</b> (lluvia con barro, tormenta con relámpagos, niebla o al azar) y <b>🌙 de noche</b>: solo se ve donde hay lámparas, linternas y fogonazos. Las lámparas se rompen a los tiros.',
      'Eventos: en el apagón alguien puede prender el <b>🔌 generador</b>; también hay inundación, helicóptero con reflector y alarma de humo.',
      'En el mapa <b>✏️ Propio</b>, el <b>🖌️ Editor visual</b> deja dibujar con el dedo (pincel, rectángulo y relleno), partir de un mapa del juego y guardar hasta 6 mapas.',
    ]],
    ['🏟️ Torneo, apuestas y logros', [
      'El <b>torneo</b> arma un cuadro de duelos 1 contra 1 con los soldados cargados. Cada cruce se mira o se simula. El campeón… se va temprano.',
      'Las <b>apuestas</b> suman aciertos a cada uno y hay ranking semanal. En 🏅 Logros ves las medallas y el historial de cada jugador.',
    ]],
    ['🔊 Sonido, relator y accesibilidad', [
      'En Ajustes de la batalla: música (el <b>tema de batalla grabado</b> o la sintetizada), <b>ambiente de cada mapa</b>, relator automático, voz (usa la del celular) y volúmenes. Los disparos, pasos y golpes son <b>sonidos reales</b> y retumban más en los pasillos.',
      'En el menú: texto más grande, ayuda para daltonismo (colores seguros y símbolos ● ▲ ■ ◆ por equipo), vibración, modo zurdo, menos animaciones y calidad (Ahorro gasta menos batería).',
    ]],
    ['📜 Créditos', [
      'Sonidos: <b>Freedoom</b> (licencia BSD) y <b>Kenney</b> (CC0). Música: “Battle Theme A” de <b>cynicmusic</b> (CC0).',
      'Muebles, objetos y texturas: <b>Poly Haven</b> (CC0). Autos: <b>Kenney</b> Car Kit (CC0). Armas: <b>Quaternius</b> Ultimate Gun Pack (CC0).',
      'Tipografías: <b>Black Ops One</b> y <b>Cinzel</b> (SIL Open Font License). Íconos: <b>game-icons.net</b> (Lorc, Delapouite y otros, CC BY 3.0).',
      'El detalle de cada archivo y su licencia está en CREDITOS.md, junto al juego.',
    ]],
    ['💡 Consejos', [
      'Las partidas duran entre 1 y 3 minutos; con 4× van más rápido.',
      'La <b>semilla</b> (en la pausa) repite el mismo mapa: sirve para revanchas justas.',
      'Si un compañero quiere ventaja, dale el rol de tanque o una personalidad que le convenga 😉.',
    ]],
  ];
  function open() {
    let m = $('#helpModal');
    if (!m) {
      m = el('div', { id: 'helpModal', class: 'modal', hidden: true });
      const box = el('div', { class: 'modal-box help' },
        el('div', { class: 'card-head' }, el('b', {}, '❓ Ayuda'), el('span', { class: 'spacer' }), el('button', { class: 'btn small', onclick: () => { m.hidden = true; } }, '✕ Cerrar')),
        el('button', { class: 'btn primary', onclick: () => { m.hidden = true; App.battle.startTutorial(); } }, '🎓 Empezar la práctica guiada'),
        el('button', { class: 'btn', onclick: () => App.copyInfo() }, '🐞 ¿Algo anda mal? Copiar la información del celular para mandarla'));
      S.forEach(([t, ps], i) => {
        const d = el('details', Object.assign({}, i === 0 ? { open: true } : {}), el('summary', {}, t));
        ps.forEach((p) => { const q = el('p'); q.innerHTML = p; d.append(q); });
        box.append(d);
      });
      m.append(box); document.body.append(m);
    }
    m.hidden = false;
  }
  App.Help = { open };
  $('#btnHelp').addEventListener('click', open);
})();
