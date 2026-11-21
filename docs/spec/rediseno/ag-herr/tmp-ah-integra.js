/* ===== Integración: cada control lleva a su pieza REAL (kit/INTEGRACION.md) =====
   · Burbuja de cita, burbuja de alta, alertas y registro: plantillas de ag-burbuja (data-t) en sus capas .ag0-capa.
   · Cita por ligar / Google por asignar: burbuja y ventana «Ligar paciente e iniciar consulta» de ag-ligado.
   · Formulario de cita y evento, «Bloquear horario», convertir en cita: capas .af-capa de ag-form con su propio guion (motor af).
   · «Configuración de la agenda»: la sección de Configuración de esta misma página publicada (desplazamiento + realce). */
var LIGAR = { j8: 'r', v2: 'r', j13: 'g' };
var AB_CAPAS = { bu: 1, alta: 1, fs: 1, modal: 1, alerta: 1, ligar: 1 };

function tpl(m, k) { return m.querySelector('template[data-t="' + k + '"]') || marcos[0].querySelector('template[data-t="' + k + '"]'); }
function anclaDe(m, k) {
  if (!k) return null;
  if (k === 'hueco') return m.querySelector('.ag0-hueco.ag0-on');
  return m.querySelector('.ah-dv[style*="flex"] [data-cita="' + k + '"]') || m.querySelector('[data-cita="' + k + '"]');
}
/* posicionCapa.ts (copia de ag-burbuja): a la derecha del ancla si cabe; si no, a la izquierda; si no, debajo o encima */
function colgar(m, cj, el) {
  var X0 = m.classList.contains('ah-plegada') ? 76 : 248, X1 = 1280, H = 800, S = 8, w = cj.offsetWidth, h = Math.min(cj.scrollHeight + 2, H - 16);
  if (!el) { cj.style.left = (X0 + (X1 - X0 - w) / 2) + 'px'; cj.style.top = ((H - h) / 2) + 'px'; cj.style.transformOrigin = 'center'; return; }
  var c = el.closest('.ag0-cuerpo');
  if (c) { var z0 = zoomDe(m), cr = c.getBoundingClientRect(), r0 = el.getBoundingClientRect(); if (r0.top < cr.top + 8 || r0.bottom > cr.bottom - 8) c.scrollTop += (r0.top - cr.top) / z0 - 48; }
  var z = zoomDe(m), mr = m.getBoundingClientRect(), r = el.getBoundingClientRect();
  var a = { l: (r.left - mr.left) / z, t: (r.top - mr.top) / z, r: (r.right - mr.left) / z, b: (r.bottom - mr.top) / z }, x, y, ox;
  if (a.r + S + w <= X1 - S) { x = a.r + S; ox = 0; }
  else if (a.l - S - w >= X0 + S) { x = a.l - S - w; ox = w; }
  else { x = Math.min(Math.max(a.l, X0 + S), X1 - S - w); ox = null; }
  if (ox === null) y = a.b + S + h <= H - S ? a.b + S : Math.max(S, a.t - S - h);
  else y = Math.min(Math.max(a.t - 24, S), H - S - h);
  cj.style.left = x + 'px'; cj.style.top = y + 'px'; cj.style.maxHeight = (H - 16) + 'px';
  cj.style.transformOrigin = ox === null ? 'center top' : ox + 'px ' + Math.min(Math.max((a.t + a.b) / 2 - y, 0), h) + 'px';
}
/* Abre una plantilla de pieza en su capa. encima: no cierra lo que hay debajo (registro sobre el alta) */
function abreT(m, k, encima, ancla) {
  var t = tpl(m, k); if (!t) return false;
  var c = m.querySelector('.ag0-capa[data-capa="' + t.dataset.capa + '"]'); if (!c) return false;
  if (!encima) cierra(m, true);
  if (k.indexOf('b:') === 0) m._bu = k.slice(2);
  var cj = c.querySelector('.ag0-cj'), h = cj.querySelector('.ab-h');
  h.innerHTML = ''; h.appendChild(t.content.cloneNode(true)); h.scrollTop = 0;
  cj.className = cj.dataset.base + ' ' + (t.dataset.cls || '');
  cj.style.left = cj.style.top = cj.style.maxHeight = cj.style.transformOrigin = '';
  if (t.dataset.titulo) cj.setAttribute('aria-label', t.dataset.titulo);
  c.parentNode.appendChild(c);
  var el = ancla || anclaDe(m, t.dataset.ancla);
  if (m.dataset.vp === 'esc' && cj.classList.contains('ag0-anc')) colgar(m, cj, el);
  c.classList.add('ag0-on'); c.setAttribute('aria-hidden', 'false');
  if (el && el.matches('.ag0-b,.ag0-tc')) { el.setAttribute('aria-expanded', 'true'); c._btn = el; }
  var f = cj.querySelector('.ag0-bp, .ab-in, .ag0-op, .ab-al .ab-b, button'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
  return true;
}
function burbuja(m, id, btn) { if (!abreT(m, 'b:' + id, false, btn)) return; }
function cierraUna(m, c) {
  if (c.classList.contains('af-capa')) return;
  var cj = c.querySelector('.ag0-cj'); cj.style.transition = ''; cj.style.transform = ''; cj.style.opacity = '';
  c.classList.remove('ag0-on'); c.setAttribute('aria-hidden', 'true');
  if (c._btn) { c._btn.setAttribute('aria-expanded', 'false'); try { c._btn.focus({ preventScroll: true }); } catch (e) {} c._btn = null; }
  if (!m.querySelector('.ag0-capa.ag0-on')) huecoAh(m, null);
}
/* «Abierto en WhatsApp 17:12» bajo lo desplegado (como ag-burbuja) */
function mensaje(t, texto) {
  var g = t.closest('.ag0-sub, .ab-acl'); if (!g) return;
  var cont = g.classList.contains('ab-acl') ? g : g.parentNode;
  [].forEach.call(cont.querySelectorAll('.ab-msg'), function (x) { if (x.textContent.split(' ')[0] === texto.split(' ')[0]) x.remove(); });
  var p = document.createElement('p'); p.className = 'ab-msg' + (g.classList.contains('ab-acl') ? ' ab-msg-a' : ''); p.textContent = texto;
  if (g.classList.contains('ab-acl')) g.appendChild(p); else g.parentNode.insertBefore(p, g.nextSibling);
}

/* ---- Hueco libre: fantasma y burbuja de alta (Duo abierto y computadora) ---- */
function huecoAh(m, col, a, f) {
  $$(m, '.ag0-hueco.ag0-on').forEach(function (x) { if (!col || x !== col.querySelector('.ag0-hueco')) x.classList.remove('ag0-on'); });
  if (!col) return null;
  var g = col.querySelector('.ag0-hueco'); if (!g) return null;
  g.style.top = 'calc(var(--cal-h) * ' + (a - T0) + ' + 1px)'; g.style.height = 'calc(var(--cal-h) * ' + (f - a) + ' - 2px)';
  g.querySelector('span').textContent = hm(a) + ' – ' + hm(f);
  if (!g.classList.contains('ag0-on')) { void g.offsetWidth; g.classList.add('ag0-on'); }
  return g;
}
function tituloAlta(m, d, a, f) {
  var c = m.querySelector('.ag0-capa[data-capa="alta"]'); if (!c) return;
  var h2 = c.querySelector('[data-tit]'); if (h2) h2.textContent = 'Nueva cita · ' + CFG.dias[d] + ', ' + hm(a) + '–' + hm(f);
  var i = c.querySelector('[data-ini]'), j = c.querySelector('[data-fin]'); if (i) i.value = hm(a); if (j) j.value = hm(f);
}
function fueraDeHorario(d, a) { var h = CFG.horario[d]; return !h || a < h[0] || a >= h[1]; }
function altaEn(m, d, a, f, ancla) {
  if (fueraDeHorario(d, a)) {
    abreT(m, CFG.horario[d] ? 'al-fuera' : 'al-domingo');
    var s = m.querySelector('.ag0-capa[data-capa="alerta"] [data-hh]'); if (s) s.textContent = hm(a);
    m._pend = [d, a, f, ancla]; return;
  }
  abreT(m, 'alta', false, ancla); tituloAlta(m, d, a, f);
}

/* ---- Ventana «Ligar paciente e iniciar consulta» (ag-ligado) ---- */
function pasoLigar(m, p) {
  var c = m.querySelector('.ag0-capa[data-capa="ligar"]'); if (!c) return;
  c.dataset.paso = p;
  $$(c, '.al-paso').forEach(function (x) { x.classList.toggle('al-on', x.dataset.p === p); });
}
function abreLigar(m, tipo) {
  m._ligT = tipo; cierra(m, true);
  if (!abre(m, 'ligar', null)) return;
  pasoLigar(m, 'datos-' + tipo);
}
function irAl(m, k) {
  if (k === 'ligar-r' || k === 'ligar-g') { abreLigar(m, k.slice(-1)); return true; }
  if (k === 'buscar' || k === 'registro') { pasoLigar(m, k); return true; }
  if (k === 'datos') { pasoLigar(m, 'datos-' + (m._ligT || 'r')); return true; }
  /* «Elegir paciente» / «Crear y continuar» llevan a «Nueva nota» (otra pantalla de la app): aquí se cierra la ventana */
  if (k === 'elegir' || k === 'crear' || k === 'noes' || k === 'noes-v') { cierra(m); return true; }
  return false;
}

/* ---- Formulario (motor de ag-form) ---- */
function afA(m, k, v) { cierra(m, true); if (m._afAbre) { m._afAbre(k, v); return true; } return false; }
function agendar(m) {
  if (m.dataset.vp === 'ext' || m.dataset.vp === 'tel') { if (abreT(m, 'fs')) return; }
  afA(m, 'form', 'crear');
}
function irAb(m, k, t) {
  if (k.indexOf('b:') === 0) { abreT(m, k); return true; }
  if (CFG.toasts && CFG.toasts[k]) { cierra(m); toast(m, CFG.toasts[k][1]); return true; }
  if (k === 'm-wa' || k === 'm-correo') { mensaje(t, k === 'm-wa' ? 'Abierto en WhatsApp 17:12' : 'Enviado por correo 17:12'); return true; }
  var form = { 'd-form': 'lleno', 'd-otra': 'lleno', 'd-editar': 'editar', 'd-editar-conf': 'conf', 'd-editar-ev': 'evedit', 'd-reagendar': 'editar', 'd-reagendar-enl': 'reserva', 'd-form-editar': 'editar' };
  if (form[k]) return afA(m, 'form', form[k]);
  if (k === 'd-convertir') return afA(m, 'conv', 'cv');
  if ((k === 'alta-fuera' || k === 'alta-dom') && m._pend) { var p = m._pend; m._pend = null; abreT(m, 'alta', false, p[3]); tituloAlta(m, p[0], p[1], p[2]); return true; }
  if (k === 'acuse' && (m.dataset.vp === 'ext' || m.dataset.vp === 'tel')) { cierra(m); toast(m, 'Se agendó correctamente'); return true; }
  var dentro = t && t.closest('.ag0-capa');
  var encima = /^(registro|al-)/.test(k) && dentro && !/^al-/.test((dentro.querySelector('[role=alertdialog]') ? 'al-' : ''));
  if (tpl(m, k)) { abreT(m, k, !!(encima && k.indexOf('registro') === 0)); return true; }
  return false;
}
/* «Configuración de la agenda»: la sección de Configuración de esta misma página publicada */
function irConfig() {
  var op = [].filter.call(document.querySelectorAll('.op'), function (o) { return /config-horario$|^1-horario$/.test(o.dataset.op || '') && o.querySelector('.ac,.marco'); })[0]
    || [].filter.call(document.querySelectorAll('.op'), function (o) { return /config/.test(o.dataset.op || ''); })[0];
  if (!op) return false;
  marcos.forEach(function (m) { cierra(m, true); });
  op.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  var e = op.querySelector('.esc'); if (e) { e.style.transition = 'box-shadow 300ms ease-out'; e.style.boxShadow = '0 0 0 4px var(--enlace),0 20px 50px rgba(20,33,61,.25)'; setTimeout(function () { e.style.boxShadow = ''; }, 1800); }
  return true;
}
/* ‹ Hoy ›, «Ir a una fecha» y el mini mes del panel: cambian el día a la vista; el mini mes se puede recorrer */
var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function fechaDe(b) {
  if (b.dataset.f) { var p = b.dataset.f.split('-'); return new Date(+p[0], +p[1], +p[2]); }
  var l = (b.getAttribute('aria-label') || '').match(/(\d+) de ([a-zé]+)(?: de (\d+))?/); if (!l || MESES.indexOf(l[2]) < 0) return null;
  return new Date(+(l[3] || 2026), MESES.indexOf(l[2]), +l[1]);
}
function irDia(m, d) {
  if (typeof d === 'number') d = new Date(2026, 10, d);
  m._dd = d;
  var dl = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][d.getDay()];
  var tel = m.dataset.vp === 'ext' || m.dataset.vp === 'tel';
  ponTit(m, tel ? dl.slice(0, 3) + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()] : dl + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear());
  var dvs = $$(m, '.ah-dv'), i = Math.round((d - new Date(2026, 10, 16)) / 864e5);
  if (dvs.length && i >= 0 && i < 7) dvs.forEach(function (x) { x.style.display = +x.dataset.dv === i ? 'flex' : 'none'; });
  $$(m, '.ag0-mm-g button').forEach(function (b) { var f = fechaDe(b); if (f && +f === +d) b.setAttribute('aria-selected', 'true'); else b.removeAttribute('aria-selected'); });
}
function pintaMes(mm, y, mo, m) {
  mm._y = y; mm._mo = mo;
  var tb = mm.querySelector('.ag0-mm-c b'); if (tb) tb.textContent = MESES[mo].charAt(0).toUpperCase() + MESES[mo].slice(1) + ' de ' + y;
  var g = mm.querySelector('.ag0-mm-g');
  [].slice.call(g.querySelectorAll('button')).forEach(function (x) { x.hidden = true; x.className = 'ah-viejo'; });
  [].slice.call(g.querySelectorAll('.ah-viejo')).forEach(function (x) { g.removeChild(x); });
  var off = (new Date(y, mo, 1).getDay() + 6) % 7, d0 = new Date(y, mo, 1 - off), hoy = new Date(2026, 10, 19), sel = m._dd || hoy;
  for (var i = 0; i < 42; i++) {
    var d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + i), bt = document.createElement('button');
    bt.type = 'button'; bt.className = 'ag0-p' + (d.getMonth() !== mo ? ' ag0-fuera-m' : ''); bt.textContent = d.getDate();
    bt.dataset.f = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
    bt.setAttribute('aria-label', d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear());
    if (+d === +hoy) bt.setAttribute('aria-current', 'date');
    if (+d === +sel) bt.setAttribute('aria-selected', 'true');
    g.appendChild(bt);
  }
}
function mesVecino(m, t) {
  var mm = t.closest('.ag0-mm'), f = mm.querySelector('.ag0-mm-g button:not(.ag0-fuera-m)'), d = (f && fechaDe(f)) || new Date(2026, 10, 1);
  var y = mm._y != null ? mm._y : d.getFullYear(), mo = mm._mo != null ? mm._mo : d.getMonth();
  mo += t.getAttribute('aria-label') === 'Mes anterior' ? -1 : 1; if (mo < 0) { mo = 11; y--; } if (mo > 11) { mo = 0; y++; }
  pintaMes(mm, y, mo, m);
}
function ruta(m, t) {
  var c = t.closest('.ag0-capa');
  if (t.matches('[data-cierra]') && c && AB_CAPAS[c.dataset.capa]) { cierraUna(m, c); return true; }
  if (t.dataset.ir) return irAb(m, t.dataset.ir, t);
  if (t.dataset.al) return irAl(m, t.dataset.al);
  if (t.dataset.accion === 'agendar') { agendar(m); return true; }
  if (t.hasAttribute('data-bloquear')) return afA(m, 'bq', 'bq');
  if (t.matches('.ag0-bq[data-bloqueo]')) return afA(m, 'bq', 'bqedit');
  if (t.dataset.config) return irConfig();
  if (t.classList.contains('ag0-turno')) { var h = t.textContent.trim().split(':'), a = +h[0] + h[1] / 60; altaEn(m, 3, a, a + .5, t); return true; }
  if (t.dataset.citaAv && LIGAR[t.dataset.citaAv]) { t.closest('.ah-avi').hidden = true; cuentaCampana(m); abreLigar(m, LIGAR[t.dataset.citaAv]); return true; }
  if (!c && t.matches('[aria-label="Periodo anterior"],[aria-label="Periodo siguiente"],.ag0-hoy')) {
    var d0 = m._dd || new Date(2026, 10, 19);
    irDia(m, t.classList.contains('ag0-hoy') ? new Date(2026, 10, 19) : new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + (t.getAttribute('aria-label') === 'Periodo anterior' ? -1 : 1))); return true;
  }
  if (t.matches('.ag0-mm-c [aria-label="Mes anterior"],.ag0-mm-c [aria-label="Mes siguiente"]')) { mesVecino(m, t); return true; }
  if (t.closest('.ag0-mm-g')) { var fd = fechaDe(t); if (!fd) return false; irDia(m, fd); if (c) setTimeout(function () { cierra(m); }, 120); return true; }
  /* Burbuja de cita por ligar / Google por asignar (ag-ligado): sus filas no llevan data-ir; van a las mismas piezas */
  if (c && c.dataset.capa === 'bu' && LIGAR[m._bu] && !t.dataset.sub && !t.matches('[data-cierra]')) {
    var tx = (t.getAttribute('aria-label') || t.textContent).trim(), fv = LIGAR[m._bu] === 'g' ? 'google' : 'reserva';
    if (/^(Editar|Reagendar|Más opciones de la cita)$/.test(tx)) return afA(m, 'form', fv);
    if (tx === 'Cancelar cita') { abreT(m, 'al-cancelar'); return true; }
    if (/^Enviar por (WhatsApp|correo)$/.test(tx)) { mensaje(t, /WhatsApp/.test(tx) ? 'Abierto en WhatsApp 17:12' : 'Enviado por correo 17:12'); return true; }
    if (tx === 'Marcar como confirmada') { cierra(m); toast(m, CFG.toasts['t-confirmada'][1]); return true; }
  }
  if (t.classList.contains('ag0-ap-cab')) { t.setAttribute('aria-expanded', String(t.getAttribute('aria-expanded') !== 'true')); return true; }
  return false;
}
function integra(m) {
  m.addEventListener('click', function (e) {
    if (m._sinClic) return;
    var t = e.target.closest('button,a,[data-ir],[data-cierra]'); if (!t || !m.contains(t)) return;
    /* Un control de la tarjeta al pasar el ratón la fija como la burbuja de siempre y hace lo suyo (TarjetaLectura: alFijar) */
    var hv = t.closest('.ah-tlp');
    if (hv && !t.dataset.tlpx && hv._b) {
      var i = [].indexOf.call(hv.querySelectorAll('button,[data-ir]'), t), id = hv._b.dataset.cita;
      e.preventDefault(); e.stopPropagation(); tlpFuera(m); abreT(m, 'b:' + id, false, hv._b);
      var gem = m.querySelectorAll('.ag0-capa[data-capa="bu"].ag0-on .ab-h button,.ag0-capa[data-capa="bu"].ag0-on .ab-h [data-ir]')[i];
      if (gem) gem.click(); return;
    }
    if (t.closest('.af-capa,.af-toast,.af-velo,.ah-tlp')) return;
    if (ruta(m, t)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  /* Hueco: tocar una franja libre abre la burbuja de alta (solo Duo abierto y computadora, como hoy) */
  if (m.dataset.vp !== 'ext' && m.dataset.vp !== 'tel') m.addEventListener('pointerdown', function (e) {
    var col = e.target.classList && (e.target.classList.contains('ag0-col') ? e.target : (e.target.classList.contains('ag0-fuera') ? e.target.parentNode : null));
    if (!col || !col.querySelector('.ag0-hueco') || e.button > 0) return;
    var z = zoomDe(m), r = col.getBoundingClientRect(), hc = parseFloat(getComputedStyle(col).getPropertyValue('--cal-h')) || 80;
    var d = +col.dataset.dia, a = Math.floor((T0 + ((e.clientY - r.top) / z) / hc) * 2) / 2;
    cierra(m, true); var g = huecoAh(m, col, a, a + .5);
    altaEn(m, d, a, a + .5, g);
  });
  m._ligar = function (tipo) { abreLigar(m, tipo === 'google' ? 'g' : 'r'); };
}
/* Tarjeta al pasar el ratón: la burbuja real, sin velo y sin robar el foco */
function tlp(m, b) {
  var t = $(m, '.ah-tlp'); if (!t) return;
  var tp = tpl(m, 'b:' + b.dataset.cita); if (!tp) return;
  t.innerHTML = ''; t.appendChild(tp.content.cloneNode(true));
  $$(t, '[data-cierra]').forEach(function (x) { x.removeAttribute('data-cierra'); x.dataset.tlpx = '1'; });
  var z = zoomDe(m), mr = m.getBoundingClientRect(), r = b.getBoundingClientRect();
  var x = (r.left - mr.left) / z + Math.min(r.width / z, 360) * .5, y = (r.top - mr.top) / z;
  var w = 360, h = t.offsetHeight || 380; x = Math.min(x, m.offsetWidth - w - 16); y = Math.max(16, Math.min(y, m.offsetHeight - h - 16));
  t.style.left = x + 'px'; t.style.top = y + 'px'; t.classList.add('ah-on'); t._b = b;
}
