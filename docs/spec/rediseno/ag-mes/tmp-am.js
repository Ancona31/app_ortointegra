/* Agenda · Mes. Guion propio (va DESPUÉS del de la base, que ya monta la tira, las capas genéricas y la ficha).
   Solo actúa en .am.ag0-v{V}.marco. En la app: resortes con WAAPI desde el valor presente; aquí, linear() de CSS. */
var V = CFG.v;
var marcos = [].slice.call(document.querySelectorAll('.am.ag0-v' + V + '.marco'));
if (!marcos.length) return;
var tpl = document.querySelector('template.am-tpl[data-v="' + V + '"]');
var TEL = { ext: 1, tel: 1 };
var RM = matchMedia('(prefers-reduced-motion: reduce)');
function Q(sel) { return tpl ? tpl.content.querySelector(sel) : null; }
function zoomDe(m) { var r = m.getBoundingClientRect(); return r.width / m.offsetWidth || 1; }
function loc(m, x, y) { var r = m.getBoundingClientRect(), z = zoomDe(m); return [(x - r.left) / z, (y - r.top) / z]; }
function caja(m, el) { var r = m.getBoundingClientRect(), z = zoomDe(m), b = el.getBoundingClientRect(); return { l: (b.left - r.left) / z, t: (b.top - r.top) / z, r: (b.right - r.left) / z, b: (b.bottom - r.top) / z }; }

/* ---------- Capas ---------- */
function cierra(m) {
  [].forEach.call(m.querySelectorAll('.ag0-capa.ag0-on'), function (c) { c.classList.remove('ag0-on', 'ab-paso', 'ab-sv'); c.setAttribute('aria-hidden', 'true'); if (c._btn) { c._btn.setAttribute('aria-expanded', 'false'); try { c._btn.focus({ preventScroll: true }); } catch (e) {} c._btn = null; } });
  [].forEach.call(m.querySelectorAll('[aria-expanded="true"].am-ch,[aria-expanded="true"].am-mas'), function (b) { b.setAttribute('aria-expanded', 'false'); });
}
function abre(m, key, btn, foco) {
  var c = m.querySelector('[data-capa="' + key + '"]'); if (!c) return null;
  cierra(m);
  c.classList.add('ag0-on'); c.setAttribute('aria-hidden', 'false');
  if (btn) { btn.setAttribute('aria-expanded', 'true'); c._btn = btn; }
  var f = foco || c.querySelector('.ag0-cj button'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
  return c;
}
/* Ancla un menú de computadora a un rectángulo (sin velo; nace de su origen) y lo mete en el área de contenido */
function anclaA(m, cj, r, lado) {
  var w = cj.offsetWidth || 340, h = cj.offsetHeight || 300, W = m.offsetWidth, Hh = m.offsetHeight, x0 = m.dataset.vp === 'esc' ? 248 : 0;
  var x = lado === 'der' ? r.r + 8 : r.l - 4, y = lado === 'der' ? r.t - 8 : r.t - 4;
  if (lado === 'der' && x + w > W - 12) x = r.l - w - 8;
  x = Math.max(x0 + 12, Math.min(x, W - w - 12)); y = Math.max(12, Math.min(y, Hh - h - 12));
  cj.style.left = x + 'px'; cj.style.top = y + 'px';
  cj.style.transformOrigin = (lado === 'der' ? (x > r.l ? 'left' : 'right') : 'left') + ' top';
}

/* ---------- PIEZAS REALES ----------
   Las capas son las de la integración de la página Calendario (agenda-base, sección INTEGRACIÓN): el guion de ag-burbuja
   (burbuja, alta, alertas, avisos) atiende todo «data-ir»; el de integración atiende formulario, herramientas y navegación;
   el de ag-ligado, la ventana de ligar. Aquí solo se les entrega lo que nace en el Mes. */
function irAB(m, key) {   // dispara un «data-ir» del guion de ag-burbuja (botón oculto, como hace la integración)
  var b = m.querySelector('button[hidden][data-am-ir="' + key + '"]');
  if (!b) { b = document.createElement('button'); b.type = 'button'; b.hidden = true; b.setAttribute('data-am-ir', key); b.dataset.ir = key; m.appendChild(b); }
  b.click();
}
function irAL(m, k) {   // dispara un «data-al» del guion de ag-ligado
  var b = m.querySelector('button[hidden][data-am-al="' + k + '"]');
  if (!b) { b = document.createElement('button'); b.type = 'button'; b.hidden = true; b.setAttribute('data-am-al', k); b.dataset.al = k; m.appendChild(b); }
  b.click();
}
function afAbre(m, key, mm) {   // las capas de ag-form, con las mismas clases que la integración (que las cierra)
  var c = m.querySelector('.af-capa[data-capa="' + key + '"]'); if (!c) return;
  if (m._afCierra) m._afCierra(); cierra(m);
  if (mm) [].forEach.call(c.querySelectorAll('.af-var'), function (v) { v.hidden = v.dataset.m !== mm; });
  c.classList.add('af-on'); c.setAttribute('aria-hidden', 'false'); m.classList.add('af-vel');
  var cj = c.querySelector('.af-cj'); try { cj.focus({ preventScroll: true }); } catch (e) {}
}
/* Salto a otra vista de la MISMA página publicada (Calendario): desplazamiento + realce */
function saltaSeccion(m, patron, rotulo) {
  var yo = marcos[0].closest('.op');
  var op = [].slice.call(document.querySelectorAll('.op')).filter(function (o) { return o !== yo && patron.test(o.dataset.op); })[0];
  if (!op) { nota('en la página Calendario, «' + rotulo + '» lleva a esa vista (aquí está sola la del Mes).'); return; }
  cierra(m);
  op.scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth', block: 'start' });
  var e = op.querySelector('.esc'); if (e) { e.style.transition = 'box-shadow 300ms ease-out'; e.style.boxShadow = '0 0 0 4px var(--enlace),0 20px 50px rgba(20,33,61,.25)'; setTimeout(function () { e.style.boxShadow = ''; }, 1800); }
}
/* Notas de MAQUETA: viven en la tira, FUERA del marco */
var notaEl = null;
function nota(txt) { if (!notaEl) return; notaEl.textContent = 'Maqueta: ' + txt; notaEl.hidden = false; clearTimeout(notaEl._t); notaEl._t = setTimeout(function () { notaEl.hidden = true; }, 6000); }

/* ---------- «+N más»: el día entero en una capa del catálogo ---------- */
function abreMas(m, o, btn) {
  var res = m.classList.contains('am-res'), t = (res && Q('template[data-ml="' + o + 'r"]')) || Q('template[data-ml="' + o + '"]');
  var capa = m.querySelector('[data-capa="mas"]'); if (!t || !capa) return;
  var b = capa.querySelector('.am-mb'); b.innerHTML = ''; b.appendChild(t.content.cloneNode(true));
  if (m.classList.contains('am-vacio')) b.innerHTML = '<p class="ag0-lvac">Sin citas este día</p>';
  var mt = capa.querySelector('.am-mt'); mt.dataset.dia = o; mt.querySelector('span').textContent = t.dataset.t;
  mt.setAttribute('aria-label', 'Ir al ' + t.dataset.t.toLowerCase());
  capa.querySelector('.ag0-cj').setAttribute('aria-label', t.dataset.t);
  abre(m, 'mas', btn || null, mt);
  var cj = capa.querySelector('.ag0-cj');
  if (cj.classList.contains('am-anc')) { var cel = m.querySelector('.am-c[data-o="' + o + '"]'); if (cel) anclaA(m, cj, caja(m, cel), 'sobre'); }
}

/* ---------- Salto al Día y vuelta al Mes ---------- */
function modo(m, k) {
  var dest = m.querySelector('.am-modo[data-modo="' + k + '"]'); if (!dest) return false;
  [].forEach.call(m.querySelectorAll('.am-modo'), function (x) { x.classList.toggle('am-on', x === dest); x.classList.remove('am-entra'); });
  void dest.offsetWidth; dest.classList.add('am-entra');
  [].forEach.call(dest.querySelectorAll('.ag0-cuerpo'), function (c) { c.dataset.listo = ''; });
  var cal = dest.querySelector('.ag0-cal[data-scroll] .ag0-cuerpo');
  if (cal) requestAnimationFrame(function () { var h = parseFloat(getComputedStyle(dest.querySelector('.ag0-cal')).getPropertyValue('--cal-h')) || 80; cal.scrollTop = (12 - 7) * h; });
  return true;
}
function irDia(m, o) {
  cierra(m);
  if (!modo(m, 'd' + o)) { var c0 = m.querySelector('.am-c[data-o="' + o + '"]'); nota('el Día está dibujado para la semana del 16 al 22; en la app, el número abre el Día del ' + (c0 ? c0.getAttribute('aria-label').split(',')[0].split('.')[0].toLowerCase() : 'día') + '.'); }
}
function alMes(m) { cierra(m); modo(m, 'mes'); }

/* ---------- Mes de teléfono: elegir el día del panel ---------- */
function elige(m, o, desplaza) {
  var d = m.querySelector('.am-d[data-o="' + o + '"]'); if (!d) return;
  [].forEach.call(m.querySelectorAll('.am-d'), function (x) { x.setAttribute('aria-selected', String(x === d)); });
  pintaPanel(m, o);
}
function pintaPanel(m, o) {
  var pd = m.querySelector('.am-pd'); if (!pd) return;
  if (o === undefined) { var s = m.querySelector('.am-d[aria-selected="true"]'); if (!s) return; o = s.dataset.o; }
  var t = (m.classList.contains('am-res') && Q('template[data-pd="' + o + 'r"]')) || Q('template[data-pd="' + o + '"]'); if (!t) return;
  pd.innerHTML = ''; pd.appendChild(t.content.cloneNode(true)); pd.scrollTop = 0;
  if (m.classList.contains('am-vacio')) { pd.querySelector('.am-pdn').textContent = 'sin citas'; pd.querySelector('.am-pdl').innerHTML = '<p class="ag0-lvac">Sin citas este día</p>'; }
  if (!RM.matches && pd.animate) pd.querySelector('.am-pdl').animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.32,.72,0,1)' });
}

/* ---------- Hueco: tocar un día vacío en ancho abre el alta sin hora («Nueva cita · vie 27») ---------- */
var DCORTO = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
function hueco(m, cel) {
  [].forEach.call(m.querySelectorAll('.am-fan'), function (x) { x.remove(); });
  if (!cel) [].forEach.call(m.querySelectorAll('.am-c[data-cita="mes"]'), function (x) { x.removeAttribute('data-cita'); });
  [].forEach.call(m.querySelectorAll('.am-c-hue'), function (x) { x.classList.remove('am-c-hue'); });
  if (!cel) return;
  cel.classList.add('am-c-hue');
  var o = +cel.dataset.o, f = new Date(2026, 9, 26 + o);
  var fan = document.createElement('span'); fan.className = 'am-fan'; fan.setAttribute('role', 'img'); fan.setAttribute('aria-label', 'Nueva cita · ' + DCORTO[f.getDay()] + ' ' + f.getDate());
  fan.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg><span>Nueva cita · ' + DCORTO[f.getDay()] + ' ' + f.getDate() + '</span>';
  cel.appendChild(fan);
  var sp = fan.querySelector('span'); if (sp.scrollWidth > sp.clientWidth + 1) fan.classList.add('am-fan-ico');   // no cabe: solo «+»
  requestAnimationFrame(function () { fan.classList.add('am-on'); });
  var tit = 'Nueva cita · ' + DCORTO[f.getDay()] + ' ' + f.getDate();
  [].forEach.call(m.querySelectorAll('.am-c[data-cita="mes"]'), function (x) { x.removeAttribute('data-cita'); });
  cel.setAttribute('data-cita', 'mes');            // el ancla de la plantilla «alta-mes» de ag-burbuja
  irAB(m, 'alta-mes');
  setTimeout(function () { [].forEach.call(m.querySelectorAll('.ag0-capa[data-capa="alta"] [data-tit]'), function (x) { x.textContent = tit; }); }, 0);
}

/* ---------- Aviso emergente (toast de hoy, arriba y centrado en el contenido) ---------- */
function avisa(m, txt) {
  var t = m.querySelector('.am-toast'); if (!t) return;
  if (txt) t.querySelector('span').textContent = txt; else t.querySelector('span').textContent = 'Este horario está bloqueado. Quita el bloqueo para agendar aquí.';
  t.classList.add('am-on'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('am-on'); }, 3200);
}

/* ---------- Arrastrar una cita a otro día (ancho) ---------- */
var ARR = null;
function celdaEn(m, x, y) { var e = document.elementFromPoint(x, y); var c = e && e.closest && e.closest('.am-c'); return c && m.contains(c) ? c : null; }
function levanta(m, ch, x, y) {
  var b = caja(m, ch), p = loc(m, x, y);
  var cl = ch.cloneNode(true); cl.classList.add('am-arr'); cl.removeAttribute('data-cita'); cl.setAttribute('aria-hidden', 'true');
  cl.style.width = (b.r - b.l) + 'px'; cl.style.height = (b.b - b.t) + 'px'; cl.style.left = b.l + 'px'; cl.style.top = b.t + 'px';
  m.appendChild(cl); ch.classList.add('am-fant');
  ARR = { m: m, ch: ch, cl: cl, dx: p[0] - b.l, dy: p[1] - b.t, obj: null, origen: ch.closest('.am-c') };
  if (!RM.matches && cl.animate) cl.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.03)' }], { duration: 180, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'forwards' });
  else cl.style.transform = 'scale(1.03)';
}
function sigue(x, y) {
  if (!ARR) return; var p = loc(ARR.m, x, y);
  ARR.cl.style.left = (p[0] - ARR.dx) + 'px'; ARR.cl.style.top = (p[1] - ARR.dy) + 'px';
  var c = celdaEn(ARR.m, x, y);
  if (c !== ARR.obj) { if (ARR.obj) ARR.obj.classList.remove('am-c-obj'); ARR.obj = c; if (c && c !== ARR.origen) c.classList.add('am-c-obj'); }
}
function suelta(confirmar) {
  if (!ARR) return; var a = ARR; ARR = null;
  if (a.obj) a.obj.classList.remove('am-c-obj');
  var dest = a.obj, ok = dest && dest !== a.origen;
  var fin = function () { a.cl.remove(); a.ch.classList.remove('am-fant'); };
  if (!ok) { vuelve(a, fin); return; }
  var dom = dest.classList.contains('am-c-sin'), bloqueado = !!dest.querySelector('.am-ch-todo.am-ch-bq');
  if (bloqueado) { vuelve(a, fin); avisa(a.m); return; }   // vetadoPorBloqueo → toast.error(TEXTO_HORARIO_BLOQUEADO), vuelve a su sitio
  var lista = dest.querySelector('.am-l:not(.am-v1)') || dest.querySelector('.am-l');
  if (a.m.classList.contains('am-res')) lista = dest.querySelector('.am-l.am-v1') || lista;
  var mas = lista.querySelector('.am-mas');
  var antes = { padre: a.ch.parentNode, sig: a.ch.nextSibling };
  fin(); lista.insertBefore(a.ch, mas || null);
  a.ch.classList.remove('am-llega'); void a.ch.offsetWidth; a.ch.classList.add('am-llega');
  if (dom) {   // avisosHorario.hora → la alerta «¿Es correcto?» de ag-form (variante mov-dia: «Cancelar» / «Mover»)
    var h = (a.ch.querySelector('.am-ch-h') || {}).textContent || '';
    var cap = a.m.querySelector('.af-capa[data-capa="al"]'); if (!cap) return;
    var tx = cap.querySelector('.af-var[data-m="mov-dia"] .af-al-t'); if (tx) tx.textContent = 'Vas a moverlo a las ' + h + ' del domingo, y este consultorio no atiende los domingos.';
    afAbre(a.m, 'al', 'mov-dia');
    a.m._deshaz = function () { antes.padre.insertBefore(a.ch, antes.sig); a.ch.classList.remove('am-llega'); void a.ch.offsetWidth; a.ch.classList.add('am-llega'); };
  }
}
function vuelve(a, fin) {
  var b = caja(a.m, a.ch);
  if (RM.matches || !a.cl.animate) { fin(); return; }
  var x0 = parseFloat(a.cl.style.left), y0 = parseFloat(a.cl.style.top);
  a.cl.animate([{ transform: 'translate(0,0) scale(1.03)' }, { transform: 'translate(' + (b.l - x0) + 'px,' + (b.t - y0) + 'px) scale(1)' }], { duration: 380, easing: 'linear(0,.035,.124,.243,.367,.484,.587,.674,.745,.803,.849,.885,.913,.935,.951,.964,.974,.981,.986,.99,.993,.995,.997,.998,1)', fill: 'forwards' }).onfinish = fin;
}

/* ---------- Interacción por marco ---------- */
function liga(m) {
  var ancho = !TEL[m.dataset.vp], ini = null, trasArrastre = false, tPasar = null;
  m.addEventListener('click', function (e) {
    var t = e.target.closest('button,a,.af-velo'); if (!t || !m.contains(t)) return;
    if (trasArrastre) { trasArrastre = false; e.stopPropagation(); e.preventDefault(); return; }
    /* La alerta de mover de ag-form: «Cancelar» o el velo devuelven la cita (la integración cierra la capa) */
    if (m._deshaz && t.closest('.af-capa[data-capa="al"], .af-velo')) { if (t.classList.contains('af-qui') || t.classList.contains('af-velo')) m._deshaz(); m._deshaz = null; return; }
    if (t.closest('.af-capa') || t.classList.contains('af-velo')) return;
    if (t.dataset.config) { nota('«Configuración de la agenda» abre su pantalla (página Herramientas y configuración).'); return; }
    if (t.dataset.compactar) { var on = t.getAttribute('aria-checked') !== 'true'; m.classList.toggle('am-comp', on); setTimeout(function () { m.classList.remove('ag0-avc'); }, 0); return; }
    if (t.dataset.compOff) { m.classList.remove('am-comp'); return; }
    if (t.dataset.med && t.getAttribute('role') === 'option') { if (t.getAttribute('aria-disabled') !== 'true') { [].forEach.call(m.querySelectorAll('.ah-lbo[data-med]'), function (x) { x.setAttribute('aria-selected', String(x === t)); }); cierra(m); } return; }
    if (t.dataset.plegar) { var pl = !m.classList.contains('ah-plegada'); m.classList.toggle('ah-plegada', pl); t.setAttribute('aria-expanded', String(!pl)); return; }
    /* Campana: lo que la integración no cubre (enviar, marcar, «¿No es una cita?» de un aviso) */
    var fl = t.closest('.ah-pcf');
    if (fl && (t.dataset.wa || t.dataset.co)) { var p = fl.querySelector('.ah-pce'); if (t.dataset.wa) fl._wa = 'WhatsApp abierto 17:10'; else { fl._co = 'Correo enviado 17:10'; t.disabled = true; } if (p) { p.textContent = [fl._wa, fl._co].filter(Boolean).join(' · '); p.hidden = false; } return; }
    if ((t.dataset.marcar && fl) || (t.dataset.noes && t.closest('.ah-avi'))) { (fl || t.closest('.ah-avi')).hidden = true; cuenta(m); return; }
    /* Avisos de la página */
    if (t.dataset.amr === 'reintentar') { m.classList.add('am-carga'); setTimeout(function () { m.classList.remove('am-carga', 'ag0-ave'); }, 900); return; }
    if (t.dataset.amr === 'semana') { saltaSeccion(m, /(^|-)semana$/, 'Ver por semana'); return; }
    if (t.dataset.amr === 'perfil') { nota('«Revisar conexión» lleva a Mi perfil › Google Calendar (página Cuenta).'); return; }
    if (t.closest('.ag0-capa[data-capa="fecha"]') && t.closest('.ag0-mm-g')) { var nn = +t.textContent; if (!/fuera/.test(t.className) && TEL[m.dataset.vp]) elige(m, 6 + nn); return; }
    if (t.closest('.ag0-capa[data-capa="fecha"]') && t.closest('.ag0-mm-c')) { nota('solo está dibujado noviembre: «Mes anterior» y «Mes siguiente» cambian el mes del calendario.'); return; }
    /* El Mes */
    if (t.classList.contains('am-mas')) { abreMas(m, t.dataset.mas, t); return; }
    if (t.classList.contains('am-n') || t.classList.contains('am-mt')) { irDia(m, t.dataset.dia); return; }
    if (t.classList.contains('am-vd')) { irDia(m, t.dataset.verdia); return; }
    if (t.classList.contains('am-d')) { elige(m, t.dataset.o); return; }
    if ((t.closest('.ag0-nav') || /^Periodo (anterior|siguiente)$/.test(t.getAttribute('aria-label') || '') || t.classList.contains('ag0-hoy')) && t.closest('.am-modo[data-modo="mes"]')) { nota('solo está dibujado noviembre: ‹ y › cambian de mes y «Hoy» vuelve a noviembre.'); return; }
    /* Navegación global sin capa propia (secciones, perfil): sale de la agenda; aquí se dice dónde está */
    if (t.closest('.ag0-riel,.ag0-lat,.ag0-enc,.ag0-env') && !t.dataset.cromo && !t.dataset.plegar && !t.dataset.accion && !t.classList.contains('ag0-ap-cab') && !t.closest('.ag0-ap') && t.getAttribute('aria-current') !== 'page') {
      e.preventDefault(); nota('«' + (t.getAttribute('aria-label') || t.textContent || '').trim().replace(/\s+/g, ' ') + '» sale de la agenda a su pantalla.'); return;
    }
  }, true);
  if (m.dataset.vp === 'esc') {   // «Pop-up de eventos»: al pasar el ratón 500 ms (si está encendido)
    m.addEventListener('pointerover', function (e) {
      var ch = e.pointerType === 'mouse' && e.target.closest && e.target.closest('.am-ch[data-bu]'); clearTimeout(tPasar);
      if (!ch || ARR || m.querySelector('.ag0-capa.ag0-on:not(.ab-paso), .af-capa.af-on')) return;
      var on = [].filter.call(m.querySelectorAll('[data-capa="menu"] [role="menuitemcheckbox"]'), function (x) { return /Pop-up/.test(x.textContent); })[0];
      if (on && on.getAttribute('aria-checked') !== 'true') return;
      tPasar = setTimeout(function () { irAB(m, 'b:' + ch.dataset.bu); }, 500);
    });
    m.addEventListener('pointerout', function (e) { if (e.target.closest && e.target.closest('.am-ch')) clearTimeout(tPasar); });
  }
  if (!ancho) return;
  m.addEventListener('pointerdown', function (e) {
    var ch = e.target.closest('.am-ch[data-cita]');
    if (ch && !ch.closest('.ag0-capa')) { ini = { x: e.clientX, y: e.clientY, ch: ch, id: e.pointerId }; return; }
    var cel = e.target.closest('.am-c');
    if (cel && !e.target.closest('button') && m.contains(cel)) hueco(m, cel);
  });
  m.addEventListener('pointermove', function (e) {
    if (!ini || e.pointerId !== ini.id) return;
    if (!ARR && Math.hypot(e.clientX - ini.x, e.clientY - ini.y) > 8) { clearTimeout(tPasar); cierra(m); try { m.setPointerCapture(e.pointerId); } catch (x) {} levanta(m, ini.ch, ini.x, ini.y); }
    if (ARR) { sigue(e.clientX, e.clientY); e.preventDefault(); }
  });
  var acaba = function (e) { if (!ini) return; if (ARR) { trasArrastre = true; sigue(e.clientX, e.clientY); suelta(); setTimeout(function () { trasArrastre = false; }, 400); } ini = null; };
  m.addEventListener('pointerup', acaba); m.addEventListener('pointercancel', function () { if (ARR) { var a = ARR; ARR = null; if (a.obj) a.obj.classList.remove('am-c-obj'); a.cl.remove(); a.ch.classList.remove('am-fant'); } ini = null; });
  m.addEventListener('keydown', function (e) { if (e.key === 'Escape' && m._deshaz && m.querySelector('.af-capa[data-capa="al"].af-on')) { m._deshaz(); m._deshaz = null; } }, true);
}

/* ---------- Tira de maqueta (la crea la base; aquí se atienden las acciones «am:») ---------- */
function primero(m, o) { return m.querySelector('.am-modo[data-modo="mes"] .am-c[data-o="' + o + '"] .am-l:not(.am-v1) .am-ch[data-cita]') || m.querySelector('.am-c[data-o="' + o + '"] .am-ch[data-cita]'); }
function reinicia(m) {
  if (ARR) { ARR.cl.remove(); ARR.ch.classList.remove('am-fant'); if (ARR.obj) ARR.obj.classList.remove('am-c-obj'); ARR = null; }
  [].forEach.call(m.querySelectorAll('.am-arr'), function (x) { x.remove(); });
  [].forEach.call(m.querySelectorAll('.am-fant'), function (x) { x.classList.remove('am-fant'); });
  [].forEach.call(m.querySelectorAll('.am-c-obj'), function (x) { x.classList.remove('am-c-obj'); });
  if (m._deshaz) { m._deshaz(); m._deshaz = null; }
  if (m._afCierra) m._afCierra();
  hueco(m, null); var t = m.querySelector('.am-toast'); if (t) t.classList.remove('am-on');
  if (m.querySelector('.am-modo.am-on') && m.querySelector('.am-modo.am-on').dataset.modo !== 'mes') modo(m, 'mes');
}
function accion(a) {
  marcos.forEach(function (m) {
    var ancho = !TEL[m.dataset.vp], vp = m.dataset.vp;
    if (a === 'cerrar') { reinicia(m); if (!ancho) elige(m, 24); return; }
    var p = a.split(':');
    if (p[1] === 'todos') {
      if (vp === 'esc') { var b = m.querySelector('.am-modo.am-on [data-abre="medico"]'); if (b) b.click(); }
      else { var bm = m.querySelector('.am-modo.am-on [data-abre="menu"]'); if (bm) bm.click(); setTimeout(function () { var s = m.querySelector('[data-capa="menu"] [data-sub="med"]'); if (s && s.getAttribute('aria-expanded') !== 'true') s.click(); }, 30); }
      return;
    }
    if (p[1] === 'sel') { if (!ancho) elige(m, +p[2]); else { var bt = m.querySelector('.am-mas[data-mas="' + p[2] + '"]'); if (bt) abreMas(m, p[2], bt); } return; }
    if (p[1] === 'mas') { reinicia(m); if (ancho) { var bb = [].filter.call(m.querySelectorAll('.am-mas[data-mas="' + p[2] + '"]'), function (x) { return x.offsetParent; })[0]; abreMas(m, p[2], bb); } else elige(m, +p[2]); return; }
    if (p[1] === 'dia') { reinicia(m); if (!ancho) elige(m, +p[2]); irDia(m, p[2]); return; }
    if (p[1] === 'mes') { reinicia(m); return; }
    if (p[1] === 'bu') { irAB(m, 'b:' + p[2]); return; }
    if (!ancho) return;
    if (p[1] === 'hueco') { reinicia(m); hueco(m, m.querySelector('.am-c[data-o="32"]')); return; }
    if (p[1] === 'arr' || p[1] === 'd29' || p[1] === 'd22') {
      reinicia(m); cierra(m);
      var ch = primero(m, 25); if (!ch) return;
      var dest = m.querySelector('.am-c[data-o="' + (p[1] === 'arr' ? 29 : p[1] === 'd29' ? 34 : 27) + '"]');
      var b0 = ch.getBoundingClientRect(), d0 = dest.getBoundingClientRect();
      levanta(m, ch, b0.left + 10, b0.top + 6);
      ARR.obj = dest; if (dest !== ARR.origen) dest.classList.add('am-c-obj');
      var p0 = loc(m, d0.left + d0.width * .5, d0.top + d0.height * .55);
      ARR.cl.style.left = (p0[0] - ARR.dx) + 'px'; ARR.cl.style.top = (p0[1] - ARR.dy) + 'px';
      if (p[1] !== 'arr') suelta();
      return;
    }
    if (p[1] === 'est22') { avisa(m); return; }   // estirar «Curso de actualización» hasta el domingo 22 (bloqueo de todo el día): vetado
    if (p[1] === 'pasar' && vp === 'esc') { var ch2 = primero(m, 25); if (ch2) irAB(m, 'b:' + ch2.dataset.bu); return; }
  });
}
var op = marcos[0].closest('.op');
var tira = (op ? op.querySelector('header') : marcos[0].parentNode).querySelector('.ag0-tira');
if (tira) { notaEl = document.createElement('span'); notaEl.className = 'am-nota'; notaEl.setAttribute('role', 'status'); notaEl.hidden = true; tira.appendChild(notaEl); }
if (tira) tira.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; var a = b.dataset.a; if (a === 'cerrar' || a.indexOf('am:') === 0) accion(a); });

/* Títulos de «todo el día»: si no caben, se recortan POR PALABRAS y llevan «…» al final (nunca a media palabra) */
function recorta(m) {
  if (TEL[m.dataset.vp] || !m.offsetWidth) return;
  [].forEach.call(m.querySelectorAll('.am-ch-todo .am-ch-t'), function (n) {
    var ch = n.parentNode; if (!ch.offsetWidth) return;
    var p = n.dataset.t.split(' '); n.textContent = n.dataset.t;
    var enLinea = getComputedStyle(n).display === 'inline';
    var sobra = function () {   // por cajas (el ::after del área de toque infla scrollHeight del chip)
      if (!enLinea) return n.scrollWidth > n.clientWidth + 1;
      var c = ch.getBoundingClientRect(), r = n.getClientRects(), u = r[r.length - 1]; return !!u && (u.bottom > c.bottom - 1 || u.right > c.right - 2);
    };
    while (sobra() && p.length > 1) { p.pop(); while (p.length > 1 && /^[·\-–]$/.test(p[p.length - 1])) p.pop(); n.textContent = p.join(' ') + '…'; }
  });
}
function cuenta(m) {
  var n = [].filter.call(m.querySelectorAll('.ah-pcf'), function (x) { return !x.hidden; }).length, a = [].filter.call(m.querySelectorAll('.ah-avi'), function (x) { return !x.hidden; }).length;
  var sn = m.querySelector('[data-n="pc"]'), sa = m.querySelector('[data-n="av"]'); if (sn) sn.textContent = n; if (sa) sa.textContent = a;
}
document.addEventListener('click', function (e) {
  var t = e.target.closest && e.target.closest('button,a'); if (!t) return;
  var m = t.closest('.am.marco'); if (!m || marcos.indexOf(m) < 0) return;
  var md = t.closest('.am-modo');
  if (t.getAttribute('aria-disabled') === 'true') { e.stopPropagation(); e.preventDefault(); return; }   // «Todos los médicos» en Mes
  if (t.getAttribute('role') === 'tab' && t.closest('.ag0-seg') && md) {
    var k = t.dataset.vista;
    if (k === 'mes') { e.stopPropagation(); if (md.dataset.modo !== 'mes') alMes(m); return; }   // ya es esta vista
    if (k === 'dia' && md.dataset.modo !== 'mes') { e.stopPropagation(); return; }
    var pat = { semana: /(^|-)semana$/, tres: /tres-dias$/, dia: /(^|-)dia$/ }[k], yo = m.closest('.op');
    var hay = pat && [].some.call(document.querySelectorAll('.op'), function (o) { return o !== yo && pat.test(o.dataset.op); });
    if (!hay) { e.stopPropagation(); nota('en la página Calendario, «' + t.textContent.trim() + '» lleva a esa vista (aquí está sola la del Mes).'); return; }
    setTimeout(function () { [].forEach.call(md.querySelectorAll('.ag0-seg [role="tab"]'), function (x) { x.setAttribute('aria-selected', String(x.dataset.vista === (md.dataset.modo === 'mes' ? 'mes' : 'dia'))); }); }, 0);
    return;
  }
  if (t.dataset.ligar && t.closest('.af-capa')) {   // «Iniciar consulta» de una cita sin paciente: la ventana de ligar (ag-ligado)
    e.stopPropagation(); if (m._afCierra) m._afCierra(); irAL(m, t.dataset.ligar === 'google' ? 'ligar-g' : 'ligar-r'); return;
  }
  if (t.dataset.salta || t.dataset.citaAv) {   // ir a la cita: en el Mes, su burbuja anclada al chip
    e.stopPropagation(); var id = t.dataset.salta || t.dataset.citaAv; if (t.dataset.citaAv) { var li = t.closest('.ah-avi'); if (li) li.hidden = true; cuenta(m); }
    cierra(m); setTimeout(function () { irAB(m, 'b:' + id); }, 0); return;
  }
}, true);
marcos.forEach(function (m) {
  liga(m);
  new ResizeObserver(function () { recorta(m); }).observe(m);
  new MutationObserver(function () { recorta(m); }).observe(m, { attributes: true, attributeFilter: ['class', 'style'] });
  /* La clase de la reserva y la de vacío cambian el panel del día que está a la vista */
  new MutationObserver(function () { pintaPanel(m); }).observe(m, { attributes: true, attributeFilter: ['class'] });
});
