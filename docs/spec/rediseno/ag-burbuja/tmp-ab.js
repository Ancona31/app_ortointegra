/* Agenda fase 2 · burbuja de cita y de alta. Guion común; CFG = {v, ficha, tira, estados, dias, horario, alta?, hover?}.
   Solo actúa sobre .ab.ab-vN.marco. Resortes de maqueta en CSS (linear()); en la app, resortes interrumpibles de Motion. */
var marcos = [].slice.call(document.querySelectorAll('.ab.ab-v' + CFG.v + '.marco'));
if (!marcos.length) return;
var raiz = document.documentElement, T0 = 7, E = CFG.estados || {};
var RM = matchMedia('(prefers-reduced-motion: reduce)');
function osc() { if (raiz.classList.contains('oscuro')) return true; if (raiz.classList.contains('claro')) return false; if (raiz.dataset.theme) return raiz.dataset.theme === 'dark'; return matchMedia('(prefers-color-scheme: dark)').matches; }
function tema() { var o = osc(); marcos.forEach(function (m) { m.classList.toggle('ag0-osc', o); }); }
function zoomDe(m) { var r = m.getBoundingClientRect(); return r.width / m.offsetWidth || 1; }
function rel(m, el) { var z = zoomDe(m), mr = m.getBoundingClientRect(), r = el.getBoundingClientRect(); return { l: (r.left - mr.left) / z, t: (r.top - mr.top) / z, r: (r.right - mr.left) / z, b: (r.bottom - mr.top) / z }; }
function vp(m) { return m.dataset.vp; }
function tactilTel(m) { return vp(m) === 'ext' || vp(m) === 'tel'; }
function hm(x) { var h = Math.floor(x + 1e-6), mm = Math.round((x - h) * 60); if (mm === 60) { h++; mm = 0; } return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }

/* ---- Desplazamiento inicial de la rejilla ---- */
function ponScroll(m) {
  [].forEach.call(m.querySelectorAll('.ag0-cal[data-scroll]'), function (cal) {
    var c = cal.querySelector('.ag0-cuerpo'); if (!c) return;
    var fija = function () { if (c.clientHeight > 0 && !c.dataset.listo) { var h = parseFloat(getComputedStyle(cal).getPropertyValue('--cal-h')) || 80; c.scrollTop = (parseFloat(cal.dataset.scroll) - T0) * h; c.dataset.listo = '1'; } };
    new ResizeObserver(fija).observe(c); fija();
  });
}

/* ---- Capas ---- */
function capa(m, k) { return m.querySelector('.ag0-capa[data-capa="' + k + '"]'); }
function abiertas(m) { return [].filter.call(m.querySelectorAll('.ag0-capa'), function (c) { return c.classList.contains('ag0-on'); }); }
function velos(m) { var on = abiertas(m); on.forEach(function (c, i) { c.classList.toggle('ab-sv', i < on.length - 1); }); }
function desmarca(m) { [].forEach.call(m.querySelectorAll('.ag0-b[aria-expanded="true"],.ag0-tc[aria-expanded="true"]'), function (b) { b.setAttribute('aria-expanded', 'false'); }); }
function cierraCapa(m, c) {
  c.classList.remove('ag0-on', 'ab-paso'); c.setAttribute('aria-hidden', 'true');
  var cj = c.querySelector('.ag0-cj'); if (cj) { cj.classList.remove('ab-arr'); cj.style.transform = ''; }
  if (c._btn) { c._btn.setAttribute('aria-expanded', 'false'); try { c._btn.focus({ preventScroll: true }); } catch (e) {} c._btn = null; }
  if (c.dataset.capa === 'bu' || c.dataset.capa === 'alta') desmarca(m);
  if (c.dataset.capa === 'alta') hueco(m, null);
  velos(m);
}
function cierra(m) { abiertas(m).forEach(function (c) { cierraCapa(m, c); }); hueco(m, null); desmarca(m); }
function ancla(m, k) {
  if (k === 'hueco') return m.querySelector('.ag0-hueco.ag0-on');
  return m.querySelector('[data-cita="' + k + '"]') || m.querySelector('[data-bloqueo="' + k + '"]');
}
/* Asegura que el ancla se vea dentro de su rejilla antes de colgar la capa de ella */
function aLaVista(m, el) {
  var c = el.closest('.ag0-cuerpo'); if (!c) return;
  var z = zoomDe(m), cr = c.getBoundingClientRect(), r = el.getBoundingClientRect();
  if (r.top < cr.top + 8 || r.bottom > cr.bottom - 8) c.scrollTop += (r.top - cr.top) / z - 48;
}
/* posicionCapa.ts: a la derecha del ancla si cabe; si no, a la izquierda; si no, debajo o encima; ajustada a la ventana con 8 px */
function colgar(m, cj, el) {
  var X0 = 248, X1 = 1280, H = 800, S = 8, w = cj.offsetWidth, h = Math.min(cj.scrollHeight + 2, H - 16);
  if (!el) { cj.style.left = (X0 + (X1 - X0 - w) / 2) + 'px'; cj.style.top = ((H - h) / 2) + 'px'; cj.style.transformOrigin = 'center'; return; }
  aLaVista(m, el);
  var a = rel(m, el), x, y, ox, oy;
  if (a.r + S + w <= X1 - S) { x = a.r + S; ox = 0; }
  else if (a.l - S - w >= X0 + S) { x = a.l - S - w; ox = w; }
  else { x = Math.min(Math.max(a.l, X0 + S), X1 - S - w); ox = null; }
  if (ox === null) { y = a.b + S + h <= H - S ? a.b + S : Math.max(S, a.t - S - h); }
  else y = Math.min(Math.max(a.t - 24, S), H - S - h);
  oy = Math.min(Math.max((a.t + a.b) / 2 - y, 0), h);
  cj.style.left = x + 'px'; cj.style.top = y + 'px';
  cj.style.transformOrigin = (ox === null ? (Math.min(Math.max((a.l + a.r) / 2 - x, 0), w)) + 'px ' + (y > a.t ? '0px' : h + 'px') : ox + 'px ' + oy + 'px');
}
function abreT(m, key, paso) {
  var t = m.querySelector('template[data-t="' + key + '"]'); if (!t) return null;
  var c = capa(m, t.dataset.capa); if (!c) return null;
  var cj = c.querySelector('.ag0-cj'), h = cj.querySelector('.ab-h'), ya = c.classList.contains('ag0-on');
  h.innerHTML = ''; h.appendChild(t.content.cloneNode(true)); h.scrollTop = 0;
  cj.className = cj.dataset.base + ' ' + (t.dataset.cls || '');
  if (t.dataset.titulo) cj.setAttribute('aria-label', t.dataset.titulo);
  c.parentNode.appendChild(c); /* la última abierta queda encima */
  m.appendChild(m.querySelector('.ab-tsz'));
  c.classList.toggle('ab-paso', !!paso);
  if (vp(m) === 'esc' && cj.classList.contains('ag0-anc')) colgar(m, cj, t.dataset.ancla ? ancla(m, t.dataset.ancla) : null);
  if (!ya) { c.classList.add('ag0-on'); c.setAttribute('aria-hidden', 'false'); }
  var el = t.dataset.ancla && ancla(m, t.dataset.ancla);
  if (el && el.matches('.ag0-b,.ag0-tc')) { el.setAttribute('aria-expanded', paso ? 'false' : 'true'); }
  if (!paso) { var f = cj.querySelector('.ag0-bp, .ab-in, .ag0-op, .ab-al .ab-b, .ab-mb .ab-b, button'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} }
  velos(m);
  return c;
}

/* ---- Hueco: fantasma de la cita nueva (solo Duo abierto y computadora) ---- */
function hueco(m, col, a, f) {
  [].forEach.call(m.querySelectorAll('.ag0-hueco.ag0-on'), function (x) { if (!col || x !== col.querySelector('.ag0-hueco')) x.classList.remove('ag0-on'); });
  if (!col) return null;
  var g = col.querySelector('.ag0-hueco'); if (!g) return null;
  g.style.top = 'calc(var(--cal-h) * ' + (a - T0) + ' + 1px)'; g.style.height = 'calc(var(--cal-h) * ' + (f - a) + ' - 2px)';
  g.querySelector('span').textContent = hm(a) + ' – ' + hm(f);
  if (!g.classList.contains('ag0-on')) { void g.offsetWidth; g.classList.add('ag0-on'); }
  return g;
}
function colDe(m, d) { return m.querySelector('.ag0-col[data-dia="' + d + '"]'); }
function tituloAlta(m, d, a, f) {
  var h2 = m.querySelector('.ag0-capa[data-capa="alta"] [data-tit]'); if (!h2) return;
  h2.textContent = 'Nueva cita · ' + CFG.dias[d] + ', ' + hm(a) + '–' + hm(f);
  var i = m.querySelector('.ag0-capa[data-capa="alta"] [data-ini]'), j = m.querySelector('.ag0-capa[data-capa="alta"] [data-fin]');
  if (i) i.value = hm(a); if (j) j.value = hm(f);
}
function fueraDeHorario(d, a) { var h = CFG.horario[d]; return !h || a < h[0] || a >= h[1]; }

/* ---- Avisos breves ---- */
var ICO = { ok: '<path d="m5 12.5 4.5 4.5L19 7.5"/>', ton: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', mal: '<path d="M6 6l12 12M18 6 6 18"/>' };
function svg(d, s) { return '<svg aria-hidden="true" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>'; }
function aviso(m, tipo, texto) {
  var z = m.querySelector('.ab-tsz'); if (!z) return;
  var t = document.createElement('div'); t.className = 'ab-ts ab-ts-' + tipo; t.setAttribute('role', tipo === 'mal' ? 'alert' : 'status');
  t.innerHTML = '<span class="ab-ts-i">' + svg(ICO[tipo], 16) + '</span><p></p><button type="button" class="ag0-p" aria-label="Cerrar aviso">' + svg('<path d="M6 6l12 12M18 6 6 18"/>', 16) + '</button>';
  t.querySelector('p').textContent = texto;
  z.insertBefore(t, z.firstChild);
  var vivos = [].filter.call(z.children, function (x) { return !x._fuera; });
  while (vivos.length > 2) quita(vivos.pop());
  requestAnimationFrame(function () { requestAnimationFrame(function () { t.classList.add('ab-on'); }); });
  var resta = tipo === 'mal' ? 8000 : 4000, ini = Date.now(), tm = null;
  var arranca = function () { ini = Date.now(); tm = setTimeout(function () { quita(t); }, Math.max(resta, 1000)); };
  var para = function () { clearTimeout(tm); resta -= Date.now() - ini; };
  t.addEventListener('pointerenter', para); t.addEventListener('pointerleave', arranca);
  t.querySelector('button').addEventListener('click', function () { quita(t); });
  arranca();
}
function quita(t) { if (!t || !t.parentNode || t._fuera) return; t._fuera = true; t.classList.remove('ab-on'); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, RM.matches ? 200 : 260); }

/* ---- Salto a la pieza real en la misma página: su sección, su estado abierto y un realce ---- */
var SAL = CFG.saltos || {};
function saltoDe(key, tels) { return (tels && SAL[key + '@tel']) || SAL[key] || null; }
function salta(dest) {
  var op = [].find.call(document.querySelectorAll('.op'), function (o) { return dest[0].some(function (s) { return o.dataset.op === s || o.dataset.op.slice(-s.length - 1) === '-' + s; }); });
  if (!op) return false;
  var bts = [].slice.call(op.querySelectorAll('header button'));
  var por = function (t) { return bts.filter(function (b) { return b.textContent === 'Maqueta: ' + t; })[0]; };
  marcos.forEach(cierra);
  var c = por('Cerrar'); if (c) c.click();
  var b = por(dest[1]); if (b) b.click();
  op.scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth', block: 'start' });
  var e = op.querySelector('.esc'); if (e) { e.style.transition = 'box-shadow 300ms ease-out'; e.style.boxShadow = '0 0 0 4px var(--enlace),0 20px 50px rgba(20,33,61,.25)'; setTimeout(function () { e.style.boxShadow = ''; }, 1800); }
  return true;
}

/* ---- Estados (los usa la tira y los botones de dentro) ---- */
function ir(m, key, opts) {
  opts = opts || {};
  var sd = saltoDe(key, tactilTel(m));
  if (sd && salta(sd)) return;
  if (key === 'cerrar') { cierra(m); [].forEach.call(m.querySelectorAll('.ab-ts'), function (t) { t.remove(); }); return; }
  var e = E[key];
  if (!e && key.indexOf('b:') === 0) e = { t: [key] };
  if (!e) e = { t: [key] };
  var tels = tactilTel(m);
  var lista = tels ? (e.telx || e.t) : (e.ancho || e.t);
  if (e.soloAncho && tels) lista = ['fs'];
  if (e.menu) { abreMenu(m); return; }
  if (e.cerrar !== false) cierra(m);
  if (e.hueco && !tels && vp(m) !== 'ext') {
    var hh = e.hueco === true ? [3, 19, 19.5] : e.hueco;
    hueco(m, colDe(m, hh[0]) || m.querySelector('.ag0-col'), hh[1], hh[2]);
  }
  var paso = (e.paso || opts.paso) && vp(m) === 'esc';
  (lista || []).forEach(function (k) { abreT(m, k, paso); });
  ((tels && e.toastTel) || e.toast || []).forEach(function (x) { aviso(m, x[0], x[1]); });
}

/* ---- Menú «Opciones de la agenda» (vista 4): anclado al botón en computadora, como la base ---- */
function abreMenu(m) {
  cierra(m);
  var c = capa(m, 'menu'); if (!c) return;
  var btn = m.querySelector('[data-abre="menu"]');
  c.parentNode.appendChild(c);
  c.classList.add('ag0-on'); c.setAttribute('aria-hidden', 'false');
  if (btn) { btn.setAttribute('aria-expanded', 'true'); c._btn = btn; }
  var cj = c.querySelector('.ag0-cj');
  if (btn && cj.classList.contains('ag0-anc')) { var a = rel(m, btn), w = cj.offsetWidth || 288; cj.style.left = (a.r - w) + 'px'; cj.style.top = (a.b + 6) + 'px'; }
  var p = c.querySelector('[data-popup]'); if (p) { p.setAttribute('aria-checked', String(m._popup !== false)); try { p.focus({ preventScroll: true }); } catch (e) {} }
  velos(m);
}

/* ---- Hoja arrastrable (solo iPhone): 1:1, inercia proyectada, rubber-band hacia arriba ---- */
function arrastre(m) {
  if (vp(m) !== 'tel') return;
  m.addEventListener('pointerdown', function (e) {
    var cj = e.target.closest('.ag0-cj'); if (!cj || cj.classList.contains('ab-cjal') || cj.classList.contains('ab-fscj')) return;
    if (e.target.closest('button,input,select,textarea,a,label,[role="option"]')) return;
    var sc = cj.querySelector('.ab-mb') || cj.querySelector('.ab-h'); if (sc && sc.scrollTop > 0 && !e.target.closest('.ag0-asa,.ag0-bu-c,.ab-mc,.ag0-cjc')) return;
    var z = zoomDe(m), y0 = e.clientY, dy = 0, pts = [[Date.now(), 0]], h = cj.offsetHeight, movido = false;
    var mueve = function (ev) {
      var d = (ev.clientY - y0) / z;
      if (!movido && Math.abs(d) < 6) return;
      movido = true; cj.classList.add('ab-arr');
      dy = d >= 0 ? d : -((-d) * h * .55) / (h + .55 * (-d));
      cj.style.transform = 'translateY(' + dy + 'px)';
      pts.push([Date.now(), dy]); if (pts.length > 5) pts.shift();
    };
    var suelta = function () {
      document.removeEventListener('pointermove', mueve); document.removeEventListener('pointerup', suelta); document.removeEventListener('pointercancel', suelta);
      if (!movido) return;
      var p0 = pts[0], p1 = pts[pts.length - 1], v = (p1[1] - p0[1]) / Math.max(1, p1[0] - p0[0]) * 1000;
      var proy = dy + (v / 1000) * .998 / (1 - .998);
      cj.classList.remove('ab-arr');
      if (proy > h / 2 || v > 600) { var c = cj.closest('.ag0-capa'); cj.style.transform = ''; cierraCapa(m, c); }
      else cj.style.transform = '';
    };
    document.addEventListener('pointermove', mueve); document.addEventListener('pointerup', suelta); document.addEventListener('pointercancel', suelta);
  });
}

/* ---- Tarjeta al pasar el ratón (vista 4, solo computadora) ---- */
function alPasar(m) {
  if (!CFG.hover || vp(m) !== 'esc') return;
  var tAbrir = null, tCerrar = null, sobre = null, abierta = null, enTarjeta = false, desarmada = null;
  var c = capa(m, 'bu');
  var cerrarYa = function () { if (abierta && c.classList.contains('ab-paso')) { cierraCapa(m, c); } abierta = null; };
  var programaCierre = function () { clearTimeout(tCerrar); tCerrar = setTimeout(function () { if (!abierta || enTarjeta || sobre === abierta) return; cerrarYa(); }, 300); };
  m.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var b = e.target.closest('.ag0-b[data-cita]'), id = b && !b.closest('.ag0-capa') ? b.dataset.cita : null;
    if (id !== desarmada) desarmada = null;
    if (id !== sobre) { sobre = id; if (abierta && id !== abierta) programaCierre(); }
    clearTimeout(tAbrir);
    if (!id || e.buttons || id === desarmada || m._popup === false || id === abierta) return;
    if (abiertas(m).some(function (x) { return !x.classList.contains('ab-paso'); })) return;
    tAbrir = setTimeout(function () { if (sobre !== id || !m.querySelector('template[data-t="b:' + id + '"]')) return; abierta = id; ir(m, 'b:' + id, { paso: true }); }, 500);
  });
  m.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse') return;
    var b = e.target.closest('.ag0-b[data-cita]'); if (b) desarmada = b.dataset.cita;
  }, true);
  var cj = c.querySelector('.ag0-cj');
  cj.addEventListener('pointerenter', function () { enTarjeta = true; clearTimeout(tCerrar); });
  cj.addEventListener('pointerleave', function () { enTarjeta = false; if (c.classList.contains('ab-paso')) programaCierre(); });
  cj.addEventListener('pointerdown', function (e) { if (c.classList.contains('ab-paso') && !e.target.closest('button,a,input')) fija(); });
  var fija = function () { c.classList.remove('ab-paso'); var el = abierta && ancla(m, abierta); if (el) el.setAttribute('aria-expanded', 'true'); abierta = null; };
  m._fija = function (id) { if (c.classList.contains('ab-paso') && abierta === id) { fija(); return true; } return false; };
}

/* El mensaje de resultado de un envío, bajo lo desplegado («Abierto en WhatsApp 17:12»), en la burbuja abierta */
function mensaje(t, texto) {
  var g = t.closest('.ag0-sub, .ab-acl'); if (!g) return;
  var cont = g.classList.contains('ab-acl') ? g : g.parentNode;
  [].forEach.call(cont.querySelectorAll('.ab-msg'), function (x) { if (x.textContent.split(' ')[0] === texto.split(' ')[0]) x.remove(); });
  var p = document.createElement('p'); p.className = 'ab-msg' + (g.classList.contains('ab-acl') ? ' ab-msg-a' : ''); p.textContent = texto;
  if (g.classList.contains('ab-acl')) g.appendChild(p); else g.parentNode.insertBefore(p, g.nextSibling);
}

/* ---- Interacción por marco ---- */
function liga(m) {
  m.addEventListener('click', function (e) {
    var t = e.target.closest('button,a,[data-ir]'); if (!t || !m.contains(t)) return;
    if (t.tagName === 'A') e.preventDefault();
    if (t.matches('[data-cierra]')) { var c = t.closest('.ag0-capa'); if (c) cierraCapa(m, c); else cierra(m); return; }
    if (t.dataset.sub !== undefined) { var s = t.nextElementSibling; var on = !s.classList.contains('ag0-on'); s.classList.toggle('ag0-on', on); t.setAttribute('aria-expanded', String(on)); return; }
    if (t.dataset.sw) { var v = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', String(v)); if (t.dataset.popup) m._popup = v; return; }
    if (t.getAttribute('role') === 'menuitemradio') { [].forEach.call(t.parentNode.children, function (x) { x.setAttribute('aria-checked', String(x === t)); }); return; }
    if (t.dataset.abre === 'menu' && capa(m, 'menu')) { abreMenu(m); return; }
    if (t.dataset.accion === 'agendar') { ir(m, E.agendar ? 'agendar' : (tactilTel(m) ? 'fs' : 'd-form')); return; }
    if (t.dataset.ir === 'm-wa' || t.dataset.ir === 'm-correo') { mensaje(t, t.dataset.ir === 'm-wa' ? 'Abierto en WhatsApp 17:12' : 'Enviado por correo 17:12'); return; }
    if (t.dataset.ir) { ir(m, t.dataset.ir); return; }
    if (t.matches('.ag0-b[data-cita],.ag0-tc[data-cita]') && !t.closest('.ag0-capa')) {
      if (m._fija && m._fija(t.dataset.cita)) return;
      ir(m, 'b:' + t.dataset.cita); return;
    }
    if (t.matches('.ag0-bq[data-bloqueo]')) { ir(m, 'b:' + t.dataset.bloqueo); return; }
  });
  /* Hueco: tocar o arrastrar en una columna vacía (solo Duo abierto y computadora, solo en la vista de alta) */
  if (CFG.alta && !tactilTel(m)) {
    m.addEventListener('pointerdown', function (e) {
      var col = e.target.classList && (e.target.classList.contains('ag0-col') ? e.target : (e.target.classList.contains('ag0-fuera') ? e.target.parentNode : null));
      if (!col || !col.querySelector('.ag0-hueco') || e.button > 0) return;
      e.preventDefault();
      var z = zoomDe(m), r = col.getBoundingClientRect(), hcal = parseFloat(getComputedStyle(col).getPropertyValue('--cal-h')) || 80;
      var d = +col.dataset.dia, a = Math.floor((T0 + ((e.clientY - r.top) / z) / hcal) * 2) / 2, f = a + .5;
      cierra(m); hueco(m, col, a, f);
      /* CALMA §29.13: en táctil (Duo abierto) el arrastre solo cuenta tras mantener pulsado 1 s (longPressDelay de hoy) */
      var listo = vp(m) === 'esc', tLargo = listo ? null : setTimeout(function () { listo = true; }, 1000);
      var mueve = function (ev) { if (!listo) return; var x = Math.floor((T0 + ((ev.clientY - r.top) / z) / hcal) * 2) / 2 + .5; if (x > a && x !== f) { f = x; hueco(m, col, a, f); } };
      var suelta = function () {
        clearTimeout(tLargo); document.removeEventListener('pointermove', mueve); document.removeEventListener('pointerup', suelta);
        if (fueraDeHorario(d, a)) {
          abreT(m, CFG.horario[d] ? 'al-fuera' : 'al-domingo');
          var s = m.querySelector('.ag0-capa[data-capa="alerta"] [data-hh]'); if (s) s.textContent = hm(a);
          m._pend = [d, a, f];
        } else { abreT(m, 'alta'); tituloAlta(m, d, a, f); }
      };
      document.addEventListener('pointermove', mueve); document.addEventListener('pointerup', suelta);
    });
  }
  m.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var sub = m.querySelector('.ag0-capa.ag0-on .ag0-sub.ag0-on');
    if (sub) { sub.classList.remove('ag0-on'); var bt = sub.previousElementSibling; bt.setAttribute('aria-expanded', 'false'); bt.focus(); return; }
    var on = abiertas(m); if (on.length) cierraCapa(m, on[on.length - 1]);
  });
  arrastre(m); alPasar(m);
}
/* Tras «Aceptar» en «fuera de horario», la burbuja con la hora pulsada */
var irBase = ir;
ir = function (m, key, opts) {
  if ((key === 'alta-fuera' || key === 'alta-dom') && m._pend) { var p = m._pend; m._pend = null; cierraCapa(m, capa(m, 'alerta')); abreT(m, 'alta'); tituloAlta(m, p[0], p[1], p[2]); return; }
  irBase(m, key, opts);
  var e = E[key];
  if (e && Array.isArray(e.hueco) && !tactilTel(m)) tituloAlta(m, e.hueco[0], e.hueco[1], e.hueco[2]);
};

/* ---- Tira de maqueta (fuera del marco) y ficha ---- */
function acciona(a, b) {
  var vis = marcos.filter(function (m) { return m.style.display !== 'none'; })[0] || marcos[0];
  var sd = saltoDe(a, tactilTel(vis)); if (sd && salta(sd)) return;
  if (a === 'tog:popup') { var on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); marcos.forEach(function (m) { m._popup = !on; var p = m.querySelector('[data-popup]'); if (p) p.setAttribute('aria-checked', String(!on)); }); return; }
  marcos.forEach(function (m) { ir(m, a); });
}
var tira = document.createElement('div'); tira.className = 'ab-tira'; tira.setAttribute('role', 'group'); tira.setAttribute('aria-label', 'Controles de la maqueta');
(CFG.tira || []).forEach(function (x) {
  if (x === '|') { var s = document.createElement('span'); s.className = 'ab-tsep'; s.setAttribute('aria-hidden', 'true'); tira.appendChild(s); return; }
  var bt = document.createElement('button'); bt.type = 'button'; bt.textContent = 'Maqueta: ' + x[0]; bt.dataset.a = x[1];
  if (x[1].indexOf('tog:') === 0) bt.setAttribute('aria-pressed', 'false');
  tira.appendChild(bt);
});
tira.addEventListener('click', function (e) { var bt = e.target.closest('button'); if (bt) acciona(bt.dataset.a, bt); });
var op = marcos[0].closest('.op'), ficha = null;
if (CFG.ficha) { ficha = document.createElement('section'); ficha.className = 'ab-ficha'; ficha.setAttribute('aria-label', 'Especificación'); ficha.setAttribute('lang', 'es'); ficha.innerHTML = CFG.ficha; }
if (op) { op.querySelector('header').appendChild(tira); if (ficha) op.appendChild(ficha); }
else { marcos[0].parentNode.insertBefore(tira, marcos[0]); if (ficha) marcos[marcos.length - 1].parentNode.appendChild(ficha); }

marcos.forEach(function (m) { liga(m); ponScroll(m); });
tema();
new MutationObserver(tema).observe(raiz, { attributes: true, attributeFilter: ['class', 'data-theme'] });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', tema);
