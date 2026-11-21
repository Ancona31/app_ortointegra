/* Agenda · Formulario. Guion común; CFG = {v, ficha, tira, abre, ...}. Solo actúa sobre .af.af-vN.marco */
var V = CFG.v, T0 = 7;
var marcos = [].slice.call(document.querySelectorAll('.af.af-v' + V + '.marco'));
if (!marcos.length) return;
var raiz = document.documentElement;
var reducido = matchMedia('(prefers-reduced-motion: reduce)');
function osc() { if (raiz.classList.contains('oscuro')) return true; if (raiz.classList.contains('claro')) return false; if (raiz.dataset.theme) return raiz.dataset.theme === 'dark'; return matchMedia('(prefers-color-scheme: dark)').matches; }
function tema() { var o = osc(); marcos.forEach(function (m) { m.classList.toggle('ag0-osc', o); }); }
function zoomDe(m) { var r = m.getBoundingClientRect(); return r.width / m.offsetWidth || 1; }
function q(m, s) { return m.querySelector(s); }
function qa(m, s) { return [].slice.call(m.querySelectorAll(s)); }

/* ---- Rejilla de fondo: desplazamiento inicial ---- */
function ponScroll(m) {
  qa(m, '.ag0-cal[data-scroll]').forEach(function (cal) {
    var c = cal.querySelector('.ag0-cuerpo'); if (!c) return;
    var fija = function () { if (c.clientHeight > 0 && !c.dataset.listo) { var h = parseFloat(getComputedStyle(cal).getPropertyValue('--cal-h')) || 80; c.scrollTop = (parseFloat(cal.dataset.scroll) - T0) * h; c.dataset.listo = '1'; } };
    new ResizeObserver(fija).observe(c); fija();
  });
}

/* ---- Capas: un solo velo por marco. Entrada/salida por transición CSS (interrumpible a medio camino:
   la transición arranca desde el valor presente). En la app: resorte con WAAPI, amortiguación 1, respuesta .35 s. ---- */
function abiertas(m) { return qa(m, '.af-capa.af-on'); }
function variante(capa, mm) {
  if (!mm) return;
  var hay = false;
  [].forEach.call(capa.querySelectorAll('.af-var'), function (v) { var on = v.dataset.m === mm; v.hidden = !on; if (on) hay = true; });
  if (hay) { var cu = capa.querySelector('.af-var:not([hidden]) .af-cu'); if (cu) cu.scrollTop = 0; }
}
function abre(m, key, mm, encima) {
  var capa = q(m, '[data-capa="' + key + '"]'); if (!capa) return;
  var cj = capa.querySelector('.af-cj');
  abiertas(m).forEach(function (c) {
    if (c === capa) return;
    var o = c.querySelector('.af-cj');
    if (o.classList.contains('af-atras')) return;
    if (encima === 'tras') o.classList.add('af-tras');
    else if (encima === 'atras') o.classList.add('af-atras');
    else cierraCapa(c);
  });
  variante(capa, mm);
  cj.classList.remove('af-tras', 'af-atras'); cj.style.transform = '';
  capa.classList.add('af-on'); capa.setAttribute('aria-hidden', 'false');
  m.classList.add('af-vel');
  try { cj.focus({ preventScroll: true }); } catch (e) {}
}
function cierraCapa(c) { c.classList.remove('af-on'); c.setAttribute('aria-hidden', 'true'); var o = c.querySelector('.af-cj'); o.classList.remove('af-tras', 'af-atras'); o.style.transform = ''; }
function cierraArriba(m) {
  var on = abiertas(m); if (!on.length) return;
  var arriba = on.filter(function (c) { var o = c.querySelector('.af-cj'); return !o.classList.contains('af-tras') && !o.classList.contains('af-atras'); })[0] || on[on.length - 1];
  cierraCapa(arriba);
  var resto = abiertas(m);
  var sig = resto.filter(function (c) { return c.querySelector('.af-cj').classList.contains('af-tras'); });
  if (sig.length) sig.forEach(function (c) { c.querySelector('.af-cj').classList.remove('af-tras'); });
  else resto.forEach(function (c) { c.querySelector('.af-cj').classList.remove('af-tras', 'af-atras'); });
  if (!resto.length) m.classList.remove('af-vel');
}
function cierraTodo(m) { abiertas(m).forEach(cierraCapa); m.classList.remove('af-vel'); }
function varActual(m, key) { var v = q(m, '[data-capa="' + key + '"] .af-var:not([hidden])'); return v ? v.dataset.m : ''; }

/* ---- Aviso emergente (arriba, centrado en el contenido) ---- */
var TONO = { ok: ['af-i-ok', '<path d="m5 12.5 4.5 4.5L19 7.5"/>'], mal: ['af-i-mal', '<path d="M12 7v6M12 16.5h.01"/>'], info: ['af-i-ton', '<path d="M12 11v5M12 8h.01"/>'] };
function toast(m, tono, txt) {
  var t = q(m, '.af-toast'); if (!t) return;
  var k = TONO[tono] || TONO.ok, i = t.querySelector('.af-ti');
  i.className = 'af-ti ' + k[0]; i.innerHTML = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + k[1] + '</svg>';
  t.querySelector('.af-tt').textContent = txt;
  t.classList.remove('af-on'); void t.offsetWidth; t.classList.add('af-on');
  clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('af-on'); }, 4200);
}

/* ---- Hoja de iPhone: arrastrar hacia abajo para cerrar (proyección de inercia), rubber-band hacia arriba ---- */
function arrastre(m) {
  if (m.dataset.vp !== 'tel') return;
  m.addEventListener('pointerdown', function (e) {
    var h = e.target.closest('.af-cab,.af-asa'); if (!h || e.target.closest('button')) return;
    var cj = h.closest('.af-cj'); if (!cj || cj.classList.contains('af-al')) return;
    var z = zoomDe(m), y0 = e.clientY, ult = [{ y: 0, t: performance.now() }], dy = 0;
    cj.classList.add('af-arr'); h.setPointerCapture(e.pointerId);
    var mueve = function (ev) {
      var d = (ev.clientY - y0) / z;
      dy = d < 0 ? -Math.pow(-d, .7) : d; /* resistencia arriba */
      cj.style.transform = 'translateY(' + dy + 'px)';
      ult.push({ y: d, t: performance.now() }); if (ult.length > 5) ult.shift();
    };
    var suelta = function () {
      h.removeEventListener('pointermove', mueve); h.removeEventListener('pointerup', suelta); h.removeEventListener('pointercancel', suelta);
      var a = ult[0], b = ult[ult.length - 1], vel = (b.y - a.y) / Math.max(16, b.t - a.t); /* px/ms */
      var proy = dy + vel * 220; /* proyección de inercia */
      cj.classList.remove('af-arr'); cj.style.transform = '';
      if (proy > cj.offsetHeight * .35) cierraArriba(m);
    };
    h.addEventListener('pointermove', mueve); h.addEventListener('pointerup', suelta); h.addEventListener('pointercancel', suelta);
  });
}

/* ---- Estados con temporizador (Guardando…, Preparando…, Reagendando…) ---- */
function luego(fn, ms) { setTimeout(fn, ms); }
function marca(m, cls, on) { m.classList.toggle(cls, on); }

function liga(m) {
  m.addEventListener('click', function (e) {
    var t = e.target.closest('button,a,.af-velo'); if (!t || !m.contains(t)) return;
    if (t.tagName === 'A') e.preventDefault();
    if (t.disabled) return;
    if (t.matches('[data-toastx]')) { t.closest('.af-toast').classList.remove('af-on'); return; }
    if (t.matches('[data-cierra]')) { cierraArriba(m); return; }
    /* selector «Qué vas a crear» */
    if (t.dataset.tipo) {
      if (t.dataset.tipo === 'bloqueo') { if (q(m, '[data-capa="bq"]')) abre(m, 'bq', 'bq'); return; }
      var dest = t.dataset.tipo === 'evento' ? 'evento' : 'crear';
      if (q(m, '[data-capa="form"] .af-var[data-m="' + dest + '"]')) variante(q(m, '[data-capa="form"]'), dest);
      return;
    }
    if (t.classList.contains('af-sw')) {
      var on = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', String(on));
      var lab = t.getAttribute('aria-label'), cf = q(m, '[data-capa="form"]'), cb = q(m, '[data-capa="bq"]');
      if (lab === 'Todo el día' && cf) luego(function () { variante(cf, on ? 'todo' : 'evento'); }, 180);
      if (lab === 'Días completos' && cb) luego(function () { variante(cb, on ? 'bqdias' : 'bq'); }, 180);
      return;
    }
    if (t.getAttribute('role') === 'radio') { [].forEach.call(t.parentNode.children, function (x) { x.setAttribute('aria-checked', String(x === t)); }); return; }
    if (t.dataset.uno) { [].forEach.call(t.parentNode.children, function (x) { x.setAttribute('aria-pressed', String(x === t && x.getAttribute('aria-pressed') !== 'true')); }); return; }
    if (t.dataset.elige === 'pac') { variante(q(m, '[data-capa="form"]'), 'lleno'); return; }
    if (t.dataset.quita === 'pac') {
      var vm = varActual(m, 'form');
      if (vm === 'lleno') { variante(q(m, '[data-capa="form"]'), 'crear'); return; }
      abre(m, 'al', 'qp-canc', 'tras'); return;
    }
    if (t.dataset.abre === 'reg') { abre(m, 'reg', 'reg', 'atras'); return; }
    if (t.dataset.abre === 'inv') { if (m.classList.contains('af-k-sinev')) return; abre(m, 'inv', 'inv', 'atras'); return; }
    if (t.classList.contains('af-guardar')) {
      var crear = /crear|lleno|evento|todo/.test(varActual(m, 'form'));
      marca(m, 'af-k-guard', true);
      luego(function () { marca(m, 'af-k-guard', false); cierraTodo(m); toast(m, 'ok', crear ? 'Se agendó correctamente' : 'Cambios guardados');
        if (crear && q(m, '[data-capa="inv"]') && varActual(m, 'form') !== 'evento') { iv(m, 'af-iv-esp'); luego(function () { abre(m, 'inv', 'inv'); }, 500); luego(function () { iv(m, ''); }, 2600); } }, 1100);
      return;
    }
    if (t.classList.contains('af-guardabq')) { marca(m, 'af-k-bqg', true); luego(function () { marca(m, 'af-k-bqg', false); cierraTodo(m); toast(m, 'ok', 'Horario bloqueado'); }, 1000); return; }
    if (t.dataset.quitabq === '1') { marca(m, 'af-k-bqq', true); return; }
    if (t.dataset.quitabq === '2') { cierraTodo(m); marca(m, 'af-k-bqq', false); toast(m, 'ok', 'Bloqueo quitado'); return; }
    if (t.dataset.reagendar) { rg(m, 'af-rg-datos'); return; }
    if (t.dataset.rg) {
      var r = t.dataset.rg;
      if (r === 'volver') rg(m, ''); else if (r === 'revisar') rg(m, 'af-rg-conf'); else if (r === 'corregir') rg(m, 'af-rg-datos');
      else if (r === 'si') { rg(m, 'af-rg-env'); luego(function () { rg(m, 'af-rg-hecho'); }, 1100); }
      else if (r === 'cerrar') { cierraTodo(m); luego(function () { rg(m, ''); }, 300); }
      return;
    }
    /* píldora de fecha u hora: en la app abre el selector nativo; aquí queda marcada como activa */
    if (t.classList.contains('af-pil')) { var on2 = !t.classList.contains('af-pil-on'); qa(m, '.af-pil.af-pil-on').forEach(function (x) { x.classList.remove('af-pil-on'); }); t.classList.toggle('af-pil-on', on2); return; }
    /* ¿Asistió el paciente?: la respuesta cambia el estado y la fila sale de la lista; sin filas, se cierra */
    if (t.closest('.af-as-b')) { var li = t.closest('.af-as'); li.hidden = true; if (!qa(m, '.af-as:not([hidden])').length) { cierraTodo(m); luego(function () { qa(m, '.af-as').forEach(function (x) { x.hidden = false; }); }, 400); } return; }
    /* WhatsApp tras reagendar sin correo */
    if (t.classList.contains('af-r-wa')) { var s = t.querySelector('span'); if (!s.querySelector('small')) { var sm = document.createElement('small'); sm.textContent = 'Abierto en WhatsApp 17:12'; s.appendChild(sm); } return; }
    if (t.dataset.ligar) { irALigar(m, t.dataset.ligar); return; }
    if (t.dataset.al) { abre(m, 'al', t.dataset.al, 'tras'); return; }
    if (t.dataset.noescita) { cierraTodo(m); return; }
    if (t.dataset.bloquea) { m.classList.toggle('af-k-hist'); return; }
    if (t.classList.contains('af-wa') || t.classList.contains('af-co')) { marca(m, 'af-k-avok', false); marca(m, 'af-k-averr', false); marca(m, 'af-k-avcur', true); luego(function () { marca(m, 'af-k-avcur', false); marca(m, 'af-k-avok', true); }, 1000); return; }
    if (t.dataset.inv) { var p = t.dataset.inv; if (p === 'otra') { marca(m, 'af-ivx-otra', true); var i = q(m, '.af-iv-in'); if (i) try { i.focus(); } catch (er) {} } else if (p === 'enviar') iv(m, m.classList.contains('af-ivx-otra') ? 'af-iv-conf' : 'af-iv-ok'); else if (p === 'corregir') iv(m, ''); else if (p === 'si') iv(m, 'af-iv-ok2'); else if (p === 'ficha') { marca(m, 'af-ivx-guardado', true); } else if (p === 'nogracias') marca(m, 'af-ivx-nofi', true); return; }
    if (t.dataset.cv) { if (t.dataset.cv === 'pac') marca(m, 'af-cv-listo', true), marca(m, 'af-cv-lista', false); return; }
    if (t.classList.contains('af-velo')) { cierraArriba(m); return; }
  });
  /* buscador de paciente: al escribir, la lista aparece dentro del grupo */
  m.addEventListener('input', function (e) {
    var i = e.target; if (!i.classList.contains('af-in-bus')) { if (i.classList.contains('af-cv-in')) marca(m, 'af-cv-lista', i.value.trim().length >= 2); return; }
    var g = i.closest('.af-gr'); g.classList.toggle('af-bsq', i.value.trim().length >= 2);
    [].forEach.call(m.querySelectorAll('.af-eco'), function (x) { x.textContent = i.value.trim(); });
  });
  m.addEventListener('keydown', function (e) { if (e.key === 'Escape') cierraArriba(m); });
  arrastre(m);
}
/* «Iniciar consulta» de una cita por ligar: hoy abre el panel de ligar (PanelLigarCita). La pieza real es «Agenda · Ligar paciente»
   (misma página publicada, Cita): se cierra el formulario, se lleva la vista a esa sección, se realza y se abre su paso de datos. */
function irALigar(m, tipo) {
  var sec = [].slice.call(document.querySelectorAll('.op')).filter(function (o) { var h = o.querySelector('header h2'); return h && h.textContent.trim() === 'Agenda · Ligar paciente'; })[0];
  if (!sec) return;
  cierraTodo(m);
  var txt = tipo === 'google' ? '1 · datos (Google por asignar)' : '1 · datos (reserva)';
  var bt = [].slice.call(sec.querySelectorAll('header button')).filter(function (x) { return x.textContent.indexOf(txt) >= 0; })[0];
  var esc = sec.querySelector('.esc');
  sec.scrollIntoView({ behavior: reducido.matches ? 'auto' : 'smooth', block: 'start' });
  if (esc) { esc.style.transition = 'box-shadow 300ms ease-out'; esc.style.boxShadow = '0 0 0 4px var(--enlace),0 20px 50px rgba(20,33,61,.25)'; setTimeout(function () { esc.style.boxShadow = ''; }, 1800); }
  if (bt) setTimeout(function () { bt.click(); }, reducido.matches ? 0 : 350);
}
function rg(m, cls) {
  ['af-rg-datos', 'af-rg-error', 'af-rg-conf', 'af-rg-env', 'af-rg-emp', 'af-rg-hecho', 'af-rg-hechosin'].forEach(function (k) { m.classList.toggle(k, k === cls); });
  /* el paso nuevo del panel queda a la vista dentro del cuerpo desplazable */
  var g = q(m, '.af-rg'); if (!cls || !g) return;
  requestAnimationFrame(function () { var cu = g.closest('.af-cu'); if (!cu) return; var z = zoomDe(m), a = cu.getBoundingClientRect(), r = g.getBoundingClientRect();
    var d = (r.bottom - a.bottom) / z + 16; if (d > 0) cu.scrollTop += Math.min(d, (r.top - a.top) / z - 8); });
}
function iv(m, cls) { ['af-iv-esp', 'af-iv-sin', 'af-iv-conf', 'af-iv-ok', 'af-iv-ok2'].forEach(function (k) { m.classList.toggle(k, k === cls); }); if (!cls) { m.classList.remove('af-ivx-otra', 'af-ivx-guardado', 'af-ivx-nofi'); } }

/* ---- Tira de maqueta (fuera del marco) ---- */
function acciona(a, bt) {
  var p = a.split(':');
  if (p[0] === 'cerrar') { marcos.forEach(cierraTodo); return; }
  if (p[0] === 'abre') { marcos.forEach(function (m) { abre(m, p[1], p[2], p[3]); }); return; }
  if (p[0] === 'clase') {
    var on = bt.getAttribute('aria-pressed') !== 'true'; bt.setAttribute('aria-pressed', String(on));
    marcos.forEach(function (m) { m.classList.toggle(p[1], on); if (p[1] === 'af-cv-lista') { var ci = q(m, '.af-cv-in'); if (ci) ci.value = on ? 'Paciente Prueba 2' : ''; } if (p[1] === 'af-k-bsq') { qa(m, '.af-pgc').forEach(function (g) { g.classList.toggle('af-bsq', on); var i = g.querySelector('.af-in-bus'); if (i) i.value = on ? 'Paciente Prueba 2' : ''; }); qa(m, '.af-eco').forEach(function (x) { x.textContent = 'Paciente Prueba 2'; }); } });
    return;
  }
  if (p[0] === 'rg') { marcos.forEach(function (m) { rg(m, p[1]); abre(m, 'form', 'rg'); }); return; }
  if (p[0] === 'iv') { marcos.forEach(function (m) { iv(m, p[1]); if (p[2]) m.classList.add(p[2]); abre(m, 'inv', 'inv', p[3] ? 'atras' : ''); }); return; }
  if (p[0] === 'al') { marcos.forEach(function (m) { if (p[2]) abre(m, 'form', p[2]); abre(m, 'al', p[1], p[2] ? 'tras' : ''); }); return; }
  if (p[0] === 'dup') { marcos.forEach(function (m) { abre(m, 'form', 'lleno'); abre(m, 'reg', 'reg', 'atras'); abre(m, 'al', 'dup', 'tras'); }); return; }
  if (p[0] === 'toast') { marcos.forEach(function (m) { toast(m, p[1], p.slice(2).join(':')); }); return; }
}
var tira = document.createElement('div'); tira.className = 'af-tira'; tira.setAttribute('role', 'group'); tira.setAttribute('aria-label', 'Controles de la maqueta');
(CFG.tira || []).forEach(function (x) {
  if (x === '|') { var s = document.createElement('span'); s.className = 'af-tsep'; s.setAttribute('aria-hidden', 'true'); tira.appendChild(s); return; }
  if (typeof x === 'string') { var r = document.createElement('span'); r.className = 'af-trot'; r.textContent = x; tira.appendChild(r); return; }
  var bt = document.createElement('button'); bt.type = 'button'; bt.textContent = 'Maqueta: ' + x[0]; bt.dataset.a = x[1]; if (x[2] !== undefined) bt.setAttribute('aria-pressed', String(x[2])); tira.appendChild(bt);
});
tira.addEventListener('click', function (e) { var bt = e.target.closest('button'); if (bt) acciona(bt.dataset.a, bt); });
var op = marcos[0].closest('.op');
var ficha = null;
if (CFG.ficha) { ficha = document.createElement('section'); ficha.className = 'af-ficha'; ficha.setAttribute('aria-label', 'Especificación'); ficha.setAttribute('lang', 'es'); ficha.innerHTML = CFG.ficha; }
if (op) { op.querySelector('header').appendChild(tira); if (ficha) op.appendChild(ficha); }
else { marcos[0].parentNode.insertBefore(tira, marcos[0]); if (ficha) marcos[marcos.length - 1].parentNode.appendChild(ficha); }

marcos.forEach(function (m) { liga(m); ponScroll(m); if (CFG.abre) { var a = CFG.abre.split(':'); abre(m, a[0], a[1]); } });
tema();
new MutationObserver(tema).observe(raiz, { attributes: true, attributeFilter: ['class', 'data-theme'] });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', tema);
