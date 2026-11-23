/* Arranque: navegación, tema, sonido, pantalla completa y modo instalable. */
'use strict';

(() => {
  const { state, $, $$, save, go } = App;

  // navegación
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  $('#btnBack').addEventListener('click', () => go('menu'));

  // sonido
  const snd = $('#btnSound');
  const paintSound = () => { snd.textContent = state.sound ? '🔊' : '🔇'; };
  snd.addEventListener('click', () => { state.sound = !state.sound; paintSound(); save(); if (state.sound) App.sfx.clink(); });
  paintSound();

  // tema claro / oscuro
  const root = document.documentElement, themeBtn = $('#btnTheme'), meta = document.querySelector('meta[name="theme-color"]');
  const effective = () => state.theme === 'auto'
    ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : state.theme;
  const paintTheme = () => {
    root.dataset.theme = state.theme;
    const t = effective();
    themeBtn.textContent = t === 'light' ? '☀️' : '🌙';
    meta.setAttribute('content', t === 'light' ? '#f3f0e6' : '#0d1220');
  };
  themeBtn.addEventListener('click', () => { state.theme = effective() === 'light' ? 'dark' : 'light'; paintTheme(); save(); });
  paintTheme();

  // pantalla completa
  const full = $('#btnFull');
  if (!document.documentElement.requestFullscreen && !document.documentElement.webkitRequestFullscreen) full.hidden = true;
  full.addEventListener('click', () => {
    const d = document, r = d.documentElement;
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else {
      const p = (r.requestFullscreen || r.webkitRequestFullscreen).call(r);
      if (p && p.catch) p.catch(() => {});
    }
  });

  // accesibilidad, calidad y batería
  const U = state.ui;
  App.bindSeg('segText', () => U.text, (v) => { U.text = v; App.applyA11y(); });
  App.bindSeg('segQuality', () => U.quality, (v) => { U.quality = v; });
  [['uiCb', 'cb'], ['uiVib', 'vib'], ['uiLeft', 'left'], ['uiMotion', 'motion'], ['uiFps', 'fps']].forEach(([id, k]) => {
    const i = $('#' + id); i.checked = !!U[k];
    i.addEventListener('change', () => { U[k] = i.checked; App.applyA11y(); save(); if (k === 'vib' && i.checked) App.vibrate(30); });
  });
  App.applyA11y();

  if (App.loadProblem === 'roto') setTimeout(() => App.toast('⚠️ Los datos guardados estaban dañados: se empezó de cero (quedó una copia por las dudas).', 7000), 600);

  // errores: aviso amigable y detalle para copiar y mandar
  const VERSION = '0.9.6';
  const errs = [];
  App.debugInfo = () => {
    const st = App.state, g = App.game;
    return [`Moneda y Batalla ${VERSION} · guardado v${st.v}`, `Navegador: ${navigator.userAgent}`, `Pantalla: ${innerWidth}×${innerHeight} @${devicePixelRatio} · ${matchMedia('(display-mode: standalone)').matches ? 'instalada' : 'navegador'}`,
      `Jugadores: ${st.players.length} · mapa ${st.battle.map} · modo ${st.battle.mode} · calidad ${st.ui.quality}${g ? ' (ahora ' + g.quality + ', ' + Math.round(g.fps || 0) + ' fps)' : ''}`,
      g ? `Partida: ${g.W}×${g.H} semilla ${g.seed} t=${Math.round(g.time)}s fase ${g.phase}` : 'Sin partida en curso',
      ...errs.slice(-5)].join('\n');
  };
  const copyInfo = () => { const t = App.debugInfo(); try { navigator.clipboard.writeText(t).then(() => App.toast('📋 Copiado. Pegalo en el chat y mandámelo.'), () => prompt('Copiá este texto:', t)); } catch (e) { prompt('Copiá este texto:', t); } };
  App.copyInfo = copyInfo;
  const onErr = (msg, stack) => {
    errs.push(`Error: ${msg}${stack ? ' @ ' + String(stack).split('\n').slice(0, 3).join(' | ') : ''}`);
    if (errs.length > 20) errs.shift();
    App.toast('😵 Algo falló. Tocá acá para copiar el detalle y mandámelo.', 8000);
    const t = document.getElementById('toast'); if (t) t.onclick = copyInfo;
  };
  window.addEventListener('error', (e) => onErr(e.message, e.error && e.error.stack));
  window.addEventListener('unhandledrejection', (e) => onErr(String((e.reason && e.reason.message) || e.reason), e.reason && e.reason.stack));

  // ya instalada: ocultar el consejo
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) $('#installHint').hidden = true;

  // modo sin conexión (solo si se sirve por http/https)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
