/* Acerca de (1.0): versión, qué es, créditos y licencias, y el botón para instalarlo como app
   (cuando el navegador lo permite: hace falta abrirlo desde una dirección web, no como archivo suelto). */
'use strict';

(() => {
  const { el, $ } = App;
  let deferred = null;                                                         // el pedido de instalación que guarda el navegador
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; paintInstall(); });
  window.addEventListener('appinstalled', () => { deferred = null; paintInstall(); App.toast('✅ Instalado: ya lo tenés como app'); });

  function paintInstall() {
    const b = $('#btnInstall'); if (!b) return;
    const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    b.hidden = !deferred || standalone;
    const hint = $('#installHint');
    if (hint) hint.textContent = standalone ? '✅ Lo estás usando como app.' : location.protocol === 'file:'
      ? 'Tip: abierto como archivo funciona igual (sin internet). Para instalarlo como app hay que abrirlo desde su link.'
      : 'Tip: en el menú del navegador elegí “Agregar a pantalla de inicio” (o el botón Instalar) y queda como una app.';
  }

  const LIC = [
    ['🎮 El juego', 'Código propio. Hecho para jugar entre compañeros.'],
    ['🔊 Sonidos', 'Freedoom (licencia BSD de 3 cláusulas) y Kenney (CC0).'],
    ['🎼 Música', '“Battle Theme A”, de cynicmusic (CC0).'],
    ['🪑 Muebles, objetos y texturas', 'Poly Haven (CC0).'],
    ['🚗 Autos', 'Kenney, Car Kit (CC0).'],
    ['🔫 Armas', 'Quaternius, Ultimate Gun Pack (CC0).'],
    ['🔤 Tipografías', 'Black Ops One y Cinzel (SIL Open Font License).'],
    ['🖼️ Íconos', 'game-icons.net: Lorc, Delapouite y otros (CC BY 3.0).'],
    ['🪙 Moneda', 'Las fotos de las caras las cargó el dueño del juego.'],
  ];
  function open() {
    let m = $('#aboutModal');
    if (!m) {
      m = el('div', { id: 'aboutModal', class: 'modal', hidden: true, onclick: (e) => { if (e.target === m) m.hidden = true; } });
      const ver = (App.VERSION || '') ;
      m.append(el('div', { class: 'modal-box about' },
        el('div', { class: 'card-head' }, el('b', {}, 'ℹ️ Acerca de'), el('span', { class: 'spacer' }), el('button', { class: 'btn small', onclick: () => { m.hidden = true; } }, '✕ Cerrar')),
        el('h2', { class: 'about-title' }, 'Moneda y Batalla'),
        el('p', { class: 'hint center' }, `Versión ${ver} · “${App.VERSION_NAME || ''}”`),
        el('p', {}, 'Tirá la moneda para decidir cualquier cosa, y armá batallas de hasta 10 soldados que pelean solos (o manejás vos), con mapas que parecen lugares de verdad, armas reales, clima, noche y una IA que mira las esquinas y cobra las bajas de sus compañeros.'),
        el('div', { class: 'about-lic' }, LIC.map(([a, b]) => el('div', {}, el('b', {}, a), el('span', {}, b)))),
        el('p', { class: 'hint' }, 'El detalle de cada archivo y su licencia está en CREDITOS.md. Todo el material de terceros es libre (CC0, BSD, OFL o CC BY).'),
        el('button', { class: 'btn primary', id: 'btnInstall', hidden: true, onclick: async () => { if (!deferred) return; deferred.prompt(); try { await deferred.userChoice; } catch (e) { /* nada */ } deferred = null; paintInstall(); } }, '📲 Instalar como app'),
      ));
      document.body.append(m);
    }
    m.hidden = false; paintInstall();
  }
  document.addEventListener('DOMContentLoaded', () => {
    const b = $('#btnAbout'); if (b) b.addEventListener('click', open);
    paintInstall();
  });
  App.About = { open };
})();
