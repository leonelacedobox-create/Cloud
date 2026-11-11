'use strict';

/* ---------- Datos ---------- */

const KEY = 'misHoras.v1';
const MIN = 60000;
const FORGOT_AFTER_MS = 16 * 60 * MIN; // turno abierto demasiado tiempo: seguro se olvidó de marcar

let state = load();
let viewWeek = weekStart(new Date());
let editingId = null;

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.shifts)) return normalize(s);
  } catch (e) { /* datos ilegibles: se empieza de cero */ }
  return { rate: 0, shifts: [] };
}

function normalize(s) {
  const shifts = s.shifts
    .filter(x => x && Number.isFinite(x.in) && (x.out == null || Number.isFinite(x.out)))
    .map(x => ({
      id: String(x.id || newId()),
      in: x.in,
      out: x.out == null ? null : x.out,
      rate: Number(x.rate) || 0,
    }));
  return { rate: Number(s.rate) || 0, shifts };
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    toast('No se pudo guardar en el celular.');
  }
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- Fechas ---------- */

function nowMin() { return Math.floor(Date.now() / MIN) * MIN; }

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Lunes 00:00 de la semana de esa fecha
function weekStart(d) {
  const x = startOfDay(d);
  return addDays(x, -((x.getDay() + 6) % 7));
}

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function pad(n) { return String(n).padStart(2, '0'); }
function fmtTime(ms) { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function fmtDate(d) { return d.getDate() + ' ' + MONTHS[d.getMonth()]; }
function fmtDur(mins) { return Math.floor(mins / 60) + ' h ' + pad(mins % 60) + ' min'; }

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

function toLocalInput(ms) {
  const d = new Date(ms);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function fromLocalInput(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

/* ---------- Cálculos ---------- */

function openShift() { return state.shifts.find(s => s.out == null); }

function shiftMinutes(s) {
  const end = s.out == null ? nowMin() : s.out;
  return Math.max(0, Math.round((end - s.in) / MIN));
}

// Un turno pertenece al día (y a la semana) en que empezó, aunque termine después de medianoche.
function shiftsOfWeek(ws) {
  const a = ws.getTime(), b = addDays(ws, 7).getTime();
  return state.shifts.filter(s => s.in >= a && s.in < b).sort((x, y) => x.in - y.in);
}

/* ---------- Acciones ---------- */

function clockIn() {
  const open = openShift();
  if (open) {
    return feedback('Ya tenés una entrada abierta desde las ' + fmtTime(open.in) + '.', false);
  }
  const before = JSON.stringify(state.shifts);
  const t = nowMin();
  state.shifts.push({ id: newId(), in: t, out: null, rate: state.rate });
  commit();
  feedback('Entrada registrada a las ' + fmtTime(t), true, before);
}

function clockOut() {
  const open = openShift();
  if (!open) {
    return feedback('No hay una entrada abierta. Primero marcá “Entré”.', false);
  }
  const before = JSON.stringify(state.shifts);
  const t = Math.max(nowMin(), open.in);
  open.out = t;
  commit();
  feedback('Salida registrada a las ' + fmtTime(t) + '. Trabajaste ' + fmtDur(shiftMinutes(open)) + '.', true, before);
}

function commit() {
  save();
  viewWeek = weekStart(new Date());
  render();
}

function feedback(msg, ok, undoSnapshot) {
  toast(msg, undoSnapshot);
  if (navigator.vibrate) navigator.vibrate(ok ? 60 : [40, 60, 40]);
  speak(msg);
}

function speak(msg) {
  if (!voiceUsed || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(msg.replace(/[“”]/g, ''));
    u.lang = 'es-AR';
    speechSynthesis.speak(u);
  } catch (e) { /* sin voz de respuesta */ }
}

/* ---------- Voz ---------- */

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const IN_WORDS = /\b(entre|entro|entra|entrada|entrando|entrar|llegue|llego|empece|empiezo|arranque|arranco)\b/;
const OUT_WORDS = /\b(sali|salgo|sale|salida|saliendo|salir|sally|me fui|me voy|termine|termino)\b/;
let rec = null;
let voiceUsed = false;

function interpret(text) {
  const t = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const isIn = IN_WORDS.test(t), isOut = OUT_WORDS.test(t);
  if (isIn && !isOut) return 'in';
  if (isOut && !isIn) return 'out';
  return null;
}

function setListening(on) {
  $('btnMic').classList.toggle('listening', on);
  $('micHint').innerHTML = on
    ? 'Escuchando… decí <b>“entré”</b> o <b>“salí”</b>'
    : 'Tocá y decí <b>“entré”</b> o <b>“salí”</b>';
}

function toggleVoice() {
  if (rec) { rec.abort(); return; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  rec = new SR();
  rec.lang = 'es-AR';
  rec.interimResults = false;
  rec.maxAlternatives = 5;
  let handled = false;

  rec.onresult = e => {
    handled = true;
    voiceUsed = true;
    const alts = Array.from(e.results[0]).map(a => a.transcript);
    let action = null;
    for (const a of alts) { action = interpret(a); if (action) break; }
    if (action === 'in') clockIn();
    else if (action === 'out') clockOut();
    else feedback('No entendí “' + alts[0].trim() + '”. Decí “entré” o “salí”.', false);
  };
  rec.onerror = e => {
    handled = true;
    const msgs = {
      'not-allowed': 'Permití el uso del micrófono para usar la voz.',
      'service-not-allowed': 'Permití el uso del micrófono para usar la voz.',
      'no-speech': 'No escuché nada. Probá de nuevo.',
      'network': 'La voz necesita internet. Usá los botones.',
      'audio-capture': 'No encontré el micrófono.',
    };
    if (e.error !== 'aborted') toast(msgs[e.error] || 'No pude usar la voz. Usá los botones.');
  };
  rec.onend = () => {
    rec = null;
    setListening(false);
    if (!handled) toast('No escuché nada. Probá de nuevo.');
  };

  try {
    rec.start();
    setListening(true);
  } catch (e) {
    rec = null;
    toast('No pude usar la voz. Usá los botones.');
  }
}

/* ---------- Pantalla ---------- */

function $(id) { return document.getElementById(id); }

function render() {
  renderStatus();
  renderWeek();
}

function renderStatus() {
  const el = $('status');
  const open = openShift();
  el.classList.remove('working', 'warn');
  el.onclick = null;
  if (!open) {
    $('statusTitle').textContent = 'Fuera del trabajo';
    const last = state.shifts.filter(s => s.out != null).sort((a, b) => b.out - a.out)[0];
    $('statusSub').textContent = last
      ? 'Última salida: ' + DAY_NAMES[(new Date(last.out).getDay() + 6) % 7].toLowerCase() + ' ' + fmtTime(last.out)
      : 'Todavía no registraste ningún turno';
    return;
  }
  if (Date.now() - open.in > FORGOT_AFTER_MS) {
    el.classList.add('warn');
    $('statusTitle').textContent = '¿Te olvidaste de marcar la salida?';
    $('statusSub').textContent = 'Entrada abierta desde el ' + fmtDate(new Date(open.in)) + ' a las ' +
      fmtTime(open.in) + '. Tocá acá para corregirla.';
    el.onclick = () => openShiftDialog(open.id);
    return;
  }
  el.classList.add('working');
  $('statusTitle').textContent = 'Trabajando desde las ' + fmtTime(open.in);
  $('statusSub').textContent = 'Llevás ' + fmtDur(shiftMinutes(open));
}

function renderWeek() {
  const ws = viewWeek;
  const thisWeek = weekStart(new Date());
  const isCurrent = ws.getTime() === thisWeek.getTime();
  const today = startOfDay(new Date()).getTime();
  const shifts = shiftsOfWeek(ws);

  $('weekLabel').textContent = (isCurrent ? 'Esta semana · ' : '') + fmtDate(ws) + ' al ' + fmtDate(addDays(ws, 6));
  $('goToday').hidden = isCurrent;
  $('nextWeek').disabled = isCurrent;

  const list = $('days');
  list.textContent = '';
  let totalMin = 0, totalPay = 0, hasOpen = false, noRate = false;

  for (let i = 0; i < 7; i++) {
    const day = addDays(ws, i);
    const a = day.getTime(), b = addDays(day, 1).getTime();
    const dayShifts = shifts.filter(s => s.in >= a && s.in < b);

    const li = document.createElement('li');
    li.className = 'day' + (a === today ? ' today' : '');

    const name = document.createElement('div');
    name.className = 'day-name';
    name.textContent = DAY_NAMES[i];
    const small = document.createElement('small');
    small.textContent = fmtDate(day);
    name.appendChild(small);

    const box = document.createElement('div');
    box.className = 'shifts';
    let dayMin = 0;

    for (const s of dayShifts) {
      const mins = shiftMinutes(s);
      dayMin += mins;
      totalPay += mins * s.rate / 60;
      if (s.out == null) hasOpen = true;
      if (!s.rate) noRate = true;

      const btn = document.createElement('button');
      btn.className = 'shift' + (s.out == null ? ' open' : '');
      const span = document.createElement('span');
      span.textContent = fmtTime(s.in) + ' → ' + (s.out == null ? 'ahora' : fmtTime(s.out));
      const dur = document.createElement('span');
      dur.className = 'dur';
      dur.textContent = fmtDur(mins);
      btn.append(span, dur);
      btn.setAttribute('aria-label', 'Editar turno de las ' + fmtTime(s.in));
      btn.onclick = () => openShiftDialog(s.id);
      box.appendChild(btn);
    }
    if (!dayShifts.length) {
      const empty = document.createElement('span');
      empty.className = 'day-empty';
      empty.textContent = '—';
      box.appendChild(empty);
    }

    if (dayShifts.length > 1) {
      const tot = document.createElement('div');
      tot.className = 'day-total';
      tot.textContent = 'Total del día: ' + fmtDur(dayMin);
      box.appendChild(tot);
    }

    totalMin += dayMin;
    li.append(name, box);
    list.appendChild(li);
  }

  $('weekHours').textContent = fmtDur(totalMin);

  const payday = addDays(ws, 7);
  $('payLabel').textContent = payday.getTime() > today
    ? 'El lunes ' + fmtDate(payday) + ' cobrás'
    : 'El lunes ' + fmtDate(payday) + ' cobraste';
  $('payAmount').textContent = money.format(Math.round(totalPay));

  let note;
  if (!state.rate && !shifts.length) note = 'Poné cuánto cobrás por hora en Ajustes (arriba a la derecha).';
  else if (noRate) note = 'Hay turnos sin precio por hora. Cargalo en Ajustes.';
  else if (hasOpen) note = 'Incluye el turno en curso, contado hasta ahora.';
  else {
    const rates = [...new Set(shifts.map(s => s.rate))];
    const r = rates.length === 1 ? rates[0] : (shifts.length ? null : state.rate);
    note = r != null ? fmtDur(totalMin) + ' × ' + money.format(r) + ' la hora' : 'Semana con más de un precio por hora.';
  }
  $('payNote').textContent = note;
}

/* ---------- Aviso con deshacer ---------- */

let toastTimer = null;

function toast(msg, undoSnapshot) {
  $('toastMsg').textContent = msg;
  const undo = $('toastUndo');
  undo.hidden = !undoSnapshot;
  undo.onclick = () => {
    state.shifts = JSON.parse(undoSnapshot);
    save();
    render();
    toast('Listo, lo deshice.');
  };
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, undoSnapshot ? 8000 : 4500);
}

/* ---------- Editar / agregar turno ---------- */

function openShiftDialog(id) {
  editingId = id || null;
  const s = id ? state.shifts.find(x => x.id === id) : null;
  $('dlgShiftTitle').textContent = s ? 'Editar turno' : 'Agregar turno';
  $('btnDelete').hidden = !s;
  $('shiftError').hidden = true;
  if (s) {
    $('fIn').value = toLocalInput(s.in);
    $('fOut').value = s.out == null ? '' : toLocalInput(s.out);
  } else {
    // Por defecto, un día de la semana que se está mirando
    const isCurrent = viewWeek.getTime() === weekStart(new Date()).getTime();
    const base = isCurrent ? new Date() : new Date(viewWeek);
    base.setHours(18, 0, 0, 0);
    $('fIn').value = toLocalInput(base.getTime());
    $('fOut').value = '';
  }
  $('dlgShift').showModal();
}

function saveShiftDialog(e) {
  e.preventDefault();
  const tIn = fromLocalInput($('fIn').value);
  const tOut = fromLocalInput($('fOut').value);
  const err = msg => { $('shiftError').textContent = msg; $('shiftError').hidden = false; };

  if (tIn == null) return err('Poné la fecha y hora de entrada.');
  if (tIn > Date.now()) return err('La entrada no puede ser en el futuro.');
  if (tOut != null && tOut <= tIn) return err('La salida tiene que ser después de la entrada. Si saliste pasada la medianoche, poné la fecha del día siguiente.');
  if (tOut != null && tOut - tIn > 24 * 60 * MIN) return err('El turno dura más de 24 horas. Revisá las fechas.');
  if (tOut != null && tOut > Date.now()) return err('La salida no puede ser en el futuro.');
  if (tOut == null) {
    const other = openShift();
    if (other && other.id !== editingId) return err('Ya hay otro turno sin salida. Poné la hora de salida.');
  }

  const existing = editingId && state.shifts.find(x => x.id === editingId);
  if (existing) {
    existing.in = tIn;
    existing.out = tOut;
  } else {
    state.shifts.push({ id: newId(), in: tIn, out: tOut, rate: rateForWeek(weekStart(new Date(tIn))) });
  }
  save();
  viewWeek = weekStart(new Date(tIn));
  $('dlgShift').close();
  render();
  toast('Turno guardado.');
}

// Un turno cargado a mano toma el precio que ya usa esa semana; si no hay, el actual.
function rateForWeek(ws) {
  const s = shiftsOfWeek(ws).find(x => x.rate);
  return s ? s.rate : state.rate;
}

function deleteShift() {
  if (!editingId) return;
  const before = JSON.stringify(state.shifts);
  state.shifts = state.shifts.filter(x => x.id !== editingId);
  save();
  $('dlgShift').close();
  render();
  toast('Turno borrado.', before);
}

/* ---------- Ajustes ---------- */

function openSettings() {
  $('fRate').value = state.rate || '';
  $('dlgSettings').showModal();
}

function saveSettings(e) {
  e.preventDefault();
  const r = Number(String($('fRate').value).replace(',', '.'));
  if (!Number.isFinite(r) || r < 0) return;
  state.rate = r;
  // Se aplica a la semana actual (todavía no cobrada) y a los turnos que no tenían precio.
  const a = weekStart(new Date()).getTime();
  for (const s of state.shifts) if (s.in >= a || !s.rate) s.rate = r;
  save();
  $('dlgSettings').close();
  render();
  toast('Precio por hora: ' + money.format(r));
}

function exportData() {
  const d = new Date();
  const name = 'mis-horas-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '.json';
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Copia guardada en Descargas: ' + name);
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const s = JSON.parse(reader.result);
      if (!s || !Array.isArray(s.shifts)) throw new Error('formato');
      const next = normalize(s);
      if (!confirm('Se van a reemplazar los datos actuales por los de la copia (' + next.shifts.length + ' turnos). ¿Seguimos?')) return;
      state = next;
      save();
      $('dlgSettings').close();
      viewWeek = weekStart(new Date());
      render();
      toast('Copia restaurada.');
    } catch (e) {
      toast('Ese archivo no es una copia válida.');
    }
  };
  reader.readAsText(file);
}

/* ---------- Inicio ---------- */

$('btnIn').onclick = clockIn;
$('btnOut').onclick = clockOut;
$('prevWeek').onclick = () => { viewWeek = addDays(viewWeek, -7); renderWeek(); };
$('nextWeek').onclick = () => { viewWeek = addDays(viewWeek, 7); renderWeek(); };
$('goToday').onclick = () => { viewWeek = weekStart(new Date()); renderWeek(); };
$('btnAdd').onclick = () => openShiftDialog(null);
$('formShift').onsubmit = saveShiftDialog;
$('btnDelete').onclick = deleteShift;
$('btnCancelShift').onclick = () => $('dlgShift').close();
$('btnSettings').onclick = openSettings;
$('formSettings').onsubmit = saveSettings;
$('btnCancelSettings').onclick = () => $('dlgSettings').close();
$('btnExport').onclick = exportData;
$('btnImport').onclick = () => $('fileImport').click();
$('fileImport').onchange = e => { importData(e.target.files[0]); e.target.value = ''; };

if (SR) {
  $('btnMic').onclick = toggleVoice;
} else {
  $('btnMic').hidden = true;
  $('micHint').textContent = 'Este navegador no reconoce la voz. Usá los botones.';
}

render();
setInterval(render, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
