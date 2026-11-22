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

  // ya instalada: ocultar el consejo
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) $('#installHint').hidden = true;

  // modo sin conexión (solo si se sirve por http/https)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
