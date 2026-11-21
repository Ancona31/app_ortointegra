/* ===== Agenda · Semana (.as). Corre DESPUÉS del guion de las piezas base, en la misma función: usa abre, cierra,
   burbuja, hueco, ponScroll, zoomDe, tira y marcos. Solo actúa dentro de los .as.marco de esta vista. ===== */
var AS = CFG.as || {};
var RESORTE = 'linear(0,.009,.035,.075,.124,.181,.243,.305,.367,.427,.484,.537,.587,.632,.674,.711,.745,.776,.803,.828,.849,.868,.885,.9,.913,.925,.935,.944,.951,.958,.964,.969,.974,.977,.981,.984,.986,.988,.99,.992,.993,.994,.995,.996,.997,.998,1)';
function rm() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
function h2(x) { var t = Math.round(x * 60), h = Math.floor(t / 60), mm = t % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }
function ancho(m) { var v = m.dataset.vp; return v === 'ih' || v === 'iv' || v === 'esc'; }
function tactil(m) { return m.dataset.vp !== 'esc'; }
function desliza(m) { var v = m.dataset.vp; return v === 'ext' || v === 'tel' || v === 'iv'; } /* hoy: listas del teléfono (y el Duo vertical, que hoy recibe la lista) */

/* ---- Tira: estados por clase (x:clase+clase) y gestos (g:…) ---- */
function pulsa(a, on) { [].forEach.call(tira.querySelectorAll('[data-a="' + a + '"]'), function (b) { b.setAttribute('aria-pressed', String(on)); }); }
function clases(a, on) {
  a.slice(2).split('+').forEach(function (k) { marcos.forEach(function (m) { m.classList.toggle(k, on); }); }); pulsa(a, on);
  /* al cambiar de estado la lista y la rejilla vuelven a su desplazamiento inicial (hoy a la vista) */
  marcos.forEach(function (m) { [].forEach.call(m.querySelectorAll('.ag0-sl[data-listo],.ag0-cuerpo[data-listo]'), function (x) { x.removeAttribute('data-listo'); }); ponScroll(m); });
}
tira.addEventListener('click', function (e) {
  var b = e.target.closest('button'); if (!b || !b.dataset.a) return; var a = b.dataset.a;
  if (a.indexOf('x:') === 0) { clases(a, b.getAttribute('aria-pressed') !== 'true'); return; }
  if (a === 'g:mas' && !AS.gestos) { marcos.forEach(function (m) { var x = m.querySelector('.as-m-norm .as-mas'); if (x && visible(m) !== null) abre(m, 'mas', x); }); return; }
  if (a.indexOf('g:') === 0) { marcos.forEach(function (m) { G.estado(m, a.slice(2)); }); return; }
  if (a.indexOf('abu:') === 0) { marcos.forEach(function (m) { abu(m, a.slice(4)); }); return; }
  if (a.indexOf('r:') === 0) { marcos.forEach(function (m) { remoto(m, a.slice(2)); }); return; }
  if (a === 'cerrar' && V === 'as1') marcos.forEach(function (m) { if (m._rem && m._remHecho) restauraRem(m); });
  if (a === 'cerrar' && AS.gestos) marcos.forEach(function (m) { G.reinicia(m); });
});

/* ---- Alerta: título, texto y botones con verbo (patrón de ag-burbuja / ag-form) ---- */
function pregunta(capa, q) {
  capa.querySelector('.as-al-h').textContent = q.h; capa.querySelector('.as-al-t').textContent = q.t;
  var si = capa.querySelector('.as-al-si'), no = capa.querySelector('.as-al-no');
  si.textContent = q.v || 'Aceptar'; no.textContent = q.no || 'Cancelar'; si.classList.toggle('as-al-mal', !!q.mal); capa.querySelector('.as-al-i').classList.toggle('as-al-imal', !!q.mal);
}
/* ---- Toast (aviso emergente arriba) ---- */
function brinda(m, txt, mal, fijo) {
  var t = m.querySelector('.as-toast'); if (!t) return;
  t.classList.toggle('as-toast-mal', mal === true); t.classList.toggle('as-toast-maq', mal === 'maq'); t.querySelector('.as-t-txt').textContent = txt;
  t.classList.remove('as-on'); void t.offsetWidth; t.classList.add('as-on');
  clearTimeout(t._t); if (!fijo) t._t = setTimeout(function () { t.classList.remove('as-on'); }, 2600);
}
function apagaToast(m) { var t = m.querySelector('.as-toast'); if (t) { clearTimeout(t._t); t.classList.remove('as-on'); } }

/* ---- Tiempo real: otra persona cambió una cita (useTiempoRealAgenda.ts + marcasMovimiento.ts de hoy) ----
   nueva → entra con el anillo (.ag0-remoto); movida → se desliza (FLIP); cancelada → cambia de color de golpe;
   eliminada → se funde (.ag0-saliendo) y se quita. */
function guardaRem(m) { m._rem = [].map.call(m.querySelectorAll('.as-sem'), function (c) { return [c, c.innerHTML]; }); }
function restauraRem(m) {
  (m._rem || []).forEach(function (x) { x[0].innerHTML = x[1]; }); m._remHecho = false;
  [].forEach.call(m.querySelectorAll('[data-listo]'), function (x) { x.removeAttribute('data-listo'); }); ponScroll(m);
}
function remoto(m, k) {
  if (!m._rem) return; restauraRem(m); m._remHecho = true;
  var g0 = m.querySelector('.as-m-norm .ag0-cuerpo'), l = m.querySelector('.as-sem .ag0-sl');
  var vie = function () {
    if (g0) { g0.dataset.listo = '1'; g0.scrollTop = 1.4 * (parseFloat(getComputedStyle(g0).getPropertyValue('--cal-h')) || 80); }
    if (l) { var d = l.querySelector('[data-ld="4"]'); l.dataset.listo = '1'; if (d) l.scrollTop = d.offsetTop - l.offsetTop; }
  };
  vie(); requestAnimationFrame(vie);
  var R = AS.remoto, els = function (id) { return [].slice.call(m.querySelectorAll('.as-m-norm [data-cita="' + id + '"], .as-sem [data-cita="' + id + '"]')); };
  requestAnimationFrame(function () { requestAnimationFrame(function () {
    if (k === 'nueva') els('r1').forEach(function (e) { e.classList.remove('as-rnueva'); e.classList.add('ag0-remoto'); });
    if (k === 'cancelada') els('v3').forEach(function (e) {
      var lab = e.getAttribute('aria-label') || ''; e.setAttribute('aria-label', lab.replace('Confirmada', 'Cancelada'));
      if (e.classList.contains('ag0-b')) { e.classList.replace('ag0-b--conf', 'ag0-b--canc'); var i = e.querySelector('.ag0-b-ico'); if (i) i.innerHTML = R.ico; var c = e.querySelector('.ag0-b-chip'); if (c) c.innerHTML = R.chip; }
      else { e.classList.replace('ag0-b--conf', 'ag0-b--canc'); e.classList.add('ag0-lf--canc'); var st = e.querySelector('.ag0-est'); if (st) st.outerHTML = R.est; }
    });
    if (k === 'eliminada') els('v2').forEach(function (e) { e.classList.add('ag0-saliendo'); setTimeout(function () { e.remove(); }, rm() ? 0 : 140); });
    if (k === 'movida') els('v4').forEach(function (e) {
      if (e.classList.contains('ag0-b')) {
        var z = zoomDe(m), r0 = e.getBoundingClientRect();
        e.style.top = 'calc(var(--cal-h) * 3.5 + 1px)';
        e.setAttribute('aria-label', (e.getAttribute('aria-label') || '').replace('12:00 a 13:00', '10:30 a 11:30'));
        var h = e.querySelector('.ag0-b-hora'); if (h) h.textContent = '10:30 – 11:30'; var hi = e.querySelector('.ag0-b-hi'); if (hi) hi.textContent = '10:30';
        var r1 = e.getBoundingClientRect();
        if (!rm()) e.animate([{ transform: 'translateY(' + (r0.top - r1.top) / z + 'px)' }, { transform: 'none' }], { duration: 520, easing: RESORTE });
      } else {
        e.querySelector('.ag0-lh').innerHTML = '10:30<small>11:30</small>'; var prev = m.querySelector('.as-sem [data-cita="v3"]');
        if (prev) prev.parentNode.insertBefore(e, prev.nextSibling);
      }
    });
  }); });
}
marcos.forEach(function (m) { if (V === 'as1') guardaRem(m); });

/* Abre la burbuja real (guion de ag-burbuja) de una cita: su bloque visible o, en la lista, su botón sustituto */
function abu(m, id) {
  var b = [].filter.call(m.querySelectorAll('.as-sem .ag0-b[data-cita="' + id + '"], .as-dia .ag0-b[data-cita="' + id + '"]'), function (x) { return x.offsetParent !== null; })[0] || m.querySelector('.as-px [data-cita="' + id + '"]');
  if (b) b.click();
}
/* ---- Acciones dentro del marco que no son de la pieza base ---- */
marcos.forEach(function (m) {
  m.addEventListener('click', function (e) { if (m._sinClick) { m._sinClick = false; e.stopPropagation(); e.preventDefault(); } }, true);
  m.addEventListener('click', function (e) {
    var t = e.target.closest('button,a,[data-al]'); if (!t || !m.contains(t)) return;
    var k = t.dataset.as;
    if (k === 'completa') { clases('x:as-compacta', false); return; }
    if (k === 'vertodos') { clases('x:as-todos+ag0-sinmed', true); return; }
    if (k === 'reintentar') { clases('x:ag0-ave', false); clases('x:as-recarga', true); setTimeout(function () { clases('x:as-recarga', false); }, 1400); return; }
    var r = t.closest('.ag0-lf[data-cita]'); if (r) { abu(m, r.dataset.cita); return; }
    /* Tira de fechas: la cabecera de día es pegajosa y su offsetTop es el de donde está pegada; se mide por la fila que la sigue */
    if (t.classList.contains('ag0-td')) {
      var l = m.querySelector('.ag0-sl'), d = l && l.querySelector('[data-ld="' + t.dataset.d + '"]'), sig = d && d.nextElementSibling;
      if (sig) l.scrollTo({ top: sig.offsetTop - l.offsetTop - d.offsetHeight, behavior: rm() ? 'auto' : 'smooth' }); return;
    }
  });
});

/* ======================================================= GESTOS (vista 3) ======================================================= */
var G = { estado: function () {}, reinicia: function () {} };
if (AS.gestos) G = (function () {
  var HOR = AS.horario, DIA = AS.dia, PLU = AS.plural, NOM = AS.nom, NOMC = AS.nomc;
  var MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MESC = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var TXT_BQ = 'Este horario está bloqueado. Quita el bloqueo para agendar aquí.';
  var TXT_EL = 'El consultorio, el día y la hora de una cita reservada por enlace sólo se cambian con «Reagendar», que avisa al paciente.';
  var est = new WeakMap();
  function S(m) { var s = est.get(m); if (!s) { s = { html: m.querySelector('.as-sem').innerHTML, k: 0, vista: 'semana' }; est.set(m, s); } return s; }
  function sem(m) { return m.querySelector('.as-sem'); }
  function cols(m) { return [].slice.call(sem(m).querySelectorAll('.ag0-lienzo .ag0-col')); }
  function col(m, d) { return sem(m).querySelector('.ag0-lienzo .ag0-col[data-dia="' + d + '"]'); }
  function calH(el) { return parseFloat(getComputedStyle(el).getPropertyValue('--cal-h')) || 80; }
  function az(el) { var x = (el.getAttribute('aria-label') || '').match(/(\d\d):(\d\d) a (\d\d):(\d\d)/); return x ? [+x[1] + x[2] / 60, +x[3] + x[4] / 60] : [0, 0]; }
  function nombre(el) { return (el.getAttribute('aria-label') || '').split(',')[0]; }
  function durCls(b, h) {
    var mm = Math.round(h * 60); ['ag0-d15', 'ag0-d30', 'ag0-d45', 'ag0-d60', 'ag0-d90'].forEach(function (c) { b.classList.remove(c); });
    b.classList.add(mm <= 22 ? 'ag0-d15' : mm <= 37 ? 'ag0-d30' : mm <= 52 ? 'ag0-d45' : mm <= 82 ? 'ag0-d60' : 'ag0-d90');
  }
  function ponPos(b, a, z) {
    b.style.top = 'calc(var(--cal-h) * ' + (a - T0) + ' + 1px)'; b.style.height = 'calc(var(--cal-h) * ' + (z - a) + ' - 2px)';
    durCls(b, z - a); b._a = a; b._z = z;
    var t = b.querySelector('.ag0-b-hora'); if (t) t.textContent = h2(a) + ' – ' + h2(z);
    var i = b.querySelector('.ag0-b-hi'); if (i) i.textContent = h2(a);
    b.setAttribute('aria-label', (b.getAttribute('aria-label') || '').replace(/\d\d:\d\d a \d\d:\d\d/, h2(a) + ' a ' + h2(z)));
  }
  function aCuerpo(m, hora) { var c = sem(m).querySelector('.ag0-cuerpo'); if (c) c.scrollTop = (hora - T0) * calH(c); }
  function halo(b, fijo) { var s = document.createElement('span'); s.className = 'as-halo'; b.appendChild(s); if (fijo || rm()) return; s.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, delay: 250, easing: 'ease-out', fill: 'forwards' }).onfinish = function () { s.remove(); }; }

  /* ---- Reglas de hoy al soltar (guardadoCitas.ts): veto por enlace, veto por bloqueo, aviso de horario y aviso de empalme ---- */
  function revisa(m, b, d, a, z, modo) {
    if (modo === 'mover' && /Reservó por enlace/.test(b.getAttribute('aria-label')) && !b.classList.contains('ag0-b--pasado')) return { veto: TXT_EL };
    var c = col(m, d);
    var bqs = [].slice.call(c.querySelectorAll('.ag0-bq'));
    for (var i = 0; i < bqs.length; i++) { var r = az(bqs[i]); if (r[0] < z && r[1] > a) return { veto: TXT_BQ }; }
    var avisos = [], hor = HOR[d], enc = modo === 'mover' ? 'Vas a moverlo a las' : 'Empezaría a las', verbo = modo === 'mover' ? 'Mover' : 'Guardar';
    var ok = function (t) { avisos.push({ h: '¿Es correcto?', t: t, v: verbo }); };
    if (!hor) ok(enc + ' ' + h2(a) + ' del ' + DIA[d] + ', y este consultorio no atiende ' + PLU[d] + '.');
    else if (a < hor[0] || a >= hor[1]) ok(enc + ' ' + h2(a) + ', y este consultorio atiende de ' + h2(hor[0]) + ' a ' + h2(hor[1]) + '.');
    else if (z > hor[1]) ok('Terminaría a las ' + h2(z) + ', y este consultorio atiende de ' + h2(hor[0]) + ' a ' + h2(hor[1]) + '.');
    var emp = [];
    [].forEach.call(c.querySelectorAll('.ag0-b'), function (o) {
      if (o === b || o._orig === b || b._orig === o || o.classList.contains('ag0-b--fant') || o.classList.contains('as-ido') || o.classList.contains('as-st') || o.classList.contains('as-rnueva')) return;
      if (o.classList.contains('ag0-b--canc') || o.classList.contains('ag0-b--noas') || o.classList.contains('ag0-b--ev') || o.classList.contains('ag0-b--evn')) return;
      if (/Agendada desde Google Calendar/.test(o.getAttribute('aria-label'))) return;
      var r = az(o); if (r[0] < z && r[1] > a) emp.push('«' + nombre(o) + '» (' + h2(r[0]) + '–' + h2(r[1]) + ')');
    });
    if (emp.length) avisos.push({ h: '¿Guardar de todos modos?', t: (emp.length === 1 ? 'Se empalma con ' : 'Se empalma con estas citas del mismo médico: ') + emp.slice(0, 3).join(', ') + (emp.length > 3 ? ' y ' + (emp.length - 3) + ' más' : '') + '.', v: verbo });
    return { avisos: avisos };
  }
  /* Avisos en cola (ConfirmModal): «Aceptar» pasa al siguiente; «Cancelar», el velo o Escape devuelven la cita a su sitio */
  function avisa(m, msgs, si, no) {
    var capa = m.querySelector('[data-capa="aviso"]'), i = 0;
    function sigue() { if (i >= msgs.length) { capa._pend = false; cierra(m); si(); return; } pregunta(capa, msgs[i++]); capa._pend = true; abre(m, 'aviso', null); }
    capa._si = sigue; capa._no = function () { capa._pend = false; cierra(m); no(); };
    sigue();
  }
  /* FLIP de vuelta: la cita regresa deslizándose a su franja (F2.6 de hoy) */
  function vuelve(m, cl, b) {
    var z = zoomDe(m), r1 = cl.getBoundingClientRect(), r0 = b.getBoundingClientRect();
    cl.classList.remove('ag0-b--arr');
    var fin = function () { cl.remove(); b.classList.remove('ag0-b--fant'); };
    if (rm()) { fin(); return; }
    cl.animate([{ transform: 'none' }, { transform: 'translate(' + (r0.left - r1.left) / z + 'px,' + (r0.top - r1.top) / z + 'px)' }], { duration: 420, easing: RESORTE, fill: 'forwards' }).onfinish = fin;
  }
  function confirmaMover(m, cl, b, fijo) { b.classList.remove('ag0-b--fant'); b.classList.add('as-ido'); cl.classList.remove('ag0-b--arr'); halo(cl, fijo); brinda(m, 'Se movió en la agenda', false, fijo); }
  function confirmaEstirar(m, b, fijo) { b.classList.remove('ag0-b--est'); if (b._fant) { b._fant.remove(); b._fant = null; } halo(b, fijo); brinda(m, 'Se movió en la agenda', false, fijo); }
  function deshazEstirar(m, b) { if (b._fant) { b._fant.remove(); b._fant = null; } b.classList.remove('ag0-b--est'); ponPos(b, b._a0, b._z0); }

  /* ---- Piezas de cada gesto (las usan el puntero y los estados de la tira) ---- */
  function clonaPara(m, b) {
    var cl = b.cloneNode(true); cl.classList.remove('ag0-b--sel', 'ag0-b--puls'); cl.removeAttribute('aria-expanded'); cl._orig = b;
    b.classList.add('ag0-b--fant'); b.parentNode.appendChild(cl); return cl;
  }
  function estira(m, b) {
    var r = az(b); b._a0 = r[0]; b._z0 = r[1];
    var f = b.cloneNode(true); f.classList.add('ag0-b--fant'); f.removeAttribute('data-cita'); f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1; b.parentNode.insertBefore(f, b); b._fant = f;
    b.classList.add('ag0-b--est');
  }

  /* ---- Navegar de semana (‹ ›, Hoy y deslizar) ---- */
  function fechas(k) { return [new Date(2026, 10, 16 + 7 * k), new Date(2026, 10, 22 + 7 * k)]; }
  function titulo(m, k) {
    var f = fechas(k), a = f[0], b = f[1], tel = m.dataset.vp === 'ext' || m.dataset.vp === 'tel', mismo = a.getMonth() === b.getMonth();
    if (tel) return mismo ? a.getDate() + ' – ' + b.getDate() + ' de ' + MES[b.getMonth()] : a.getDate() + ' de ' + MES[a.getMonth()] + ' – ' + b.getDate() + ' de ' + MES[b.getMonth()];
    return mismo ? a.getDate() + ' – ' + b.getDate() + ' ' + MESC[b.getMonth()] + ' ' + b.getFullYear() : a.getDate() + ' ' + MESC[a.getMonth()] + ' – ' + b.getDate() + ' ' + MESC[b.getMonth()] + ' ' + b.getFullYear();
  }
  function titDia(m, k, d) {
    var f = new Date(2026, 10, 16 + 7 * k + d), tel = m.dataset.vp === 'ext' || m.dataset.vp === 'tel';
    return tel ? NOMC[d] + ', ' + f.getDate() + ' de ' + MES[f.getMonth()] : NOM[d] + ', ' + f.getDate() + ' de ' + MES[f.getMonth()] + ' de ' + f.getFullYear();
  }
  function numeros(root, k, sel) {
    [].forEach.call(root.querySelectorAll(sel), function (x, i) {
      var f = new Date(2026, 10, 16 + 7 * k + (x.dataset.d !== undefined ? +x.dataset.d : i)); var b = x.querySelector('b'); if (b) b.textContent = f.getDate();
      var hoy = k === 0 && f.getDate() === 19; if (hoy) x.setAttribute('aria-current', 'date'); else x.removeAttribute('aria-current');
    });
  }
  function entra(el, dx) {
    if (rm()) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' }); return; }
    el.animate([{ opacity: 0, transform: 'translateX(' + dx + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: RESORTE });
  }
  function semana(m, k, anim, dir) {
    var s = S(m); s.k = k; m.classList.toggle('as-otra', k !== 0); remapea(sem(m), k); if (s.vista === 'dia') remapea(m.querySelector('.as-dia'), k);
    numeros(sem(m), k, '.ag0-dias .ag0-dia'); numeros(sem(m), k, '.ag0-td');
    [].forEach.call(sem(m).querySelectorAll('.ag0-ld'), function (h) { var d = +h.dataset.ld, f = new Date(2026, 10, 16 + 7 * k + d), b = h.querySelector('.as-ldb'); if (b) b.firstChild.textContent = NOM[d] + ' ' + f.getDate() + (k === 0 && d === 3 ? ' · hoy' : ''); });
    if (s.vista === 'semana') m.querySelector('.ag0-tit-t').textContent = titulo(m, k);
    if (anim) entra(sem(m), (dir || 0) * 28);
  }
  /* ---- Semana ↔ Día (toque en el número de día; segmentado) ---- */
  function muestra(m, v, anim, d) {
    var s = S(m), se = sem(m), di = m.querySelector('.as-dia');
    s.vista = v;
    [].forEach.call(m.querySelectorAll('.ag0-barra .ag0-seg [role="tab"]'), function (t) { t.setAttribute('aria-selected', String(t.dataset.vista === v)); });
    var sale = v === 'dia' ? se : di, llega = v === 'dia' ? di : se;
    if (v === 'dia') {
      var tp = m.querySelector('template[data-as-dia="' + d + '"]') || m.querySelector('template[data-as-dia]');
      di.innerHTML = ''; di.appendChild(tp.content.cloneNode(true)); remapea(di, s.k);
      [].forEach.call(di.querySelectorAll('.ag0-dias .ag0-dia'), function (x) { x.dataset.d = d; }); numeros(di, s.k, '.ag0-dias .ag0-dia');
      m.querySelector('.ag0-tit-t').textContent = titDia(m, s.k, d);
    } else m.querySelector('.ag0-tit-t').textContent = titulo(m, s.k);
    var cambia = function () { sale.style.display = 'none'; llega.style.display = 'flex'; if (v === 'semana') di.innerHTML = ''; ponScroll(m); };
    if (!anim || rm()) { cambia(); if (anim) llega.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 }); return; }
    sale.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(' + (v === 'dia' ? .985 : 1.015) + ')' }], { duration: 140, easing: 'ease-in' }).onfinish = function () {
      cambia(); llega.animate([{ opacity: 0, transform: 'scale(' + (v === 'dia' ? 1.02 : .98) + ')' }, { opacity: 1, transform: 'none' }], { duration: 460, easing: RESORTE });
    };
  }

  /* ---- Otras semanas: la misma semilla, con el estado que le toca (futuras: agendadas/confirmadas; pasadas: atendidas) ---- */
  function ponEstado(el, e, pas) {
    ['ag', 'conf', 'aten', 'canc', 'noas'].forEach(function (x) { el.classList.remove('ag0-b--' + x); }); el.classList.add('ag0-b--' + e);
    el.classList.toggle('ag0-b--pasado', !!pas); el.classList.remove('ag0-b--curso');
    var E = AS.est[e];
    if (el.classList.contains('ag0-lf')) { el.classList.toggle('ag0-lf--canc', e === 'canc'); var c = el.querySelector('.ag0-est'); if (c) c.outerHTML = E.circ; }
    else { var i = el.querySelector('.ag0-b-ico:not(.ag0-b-evi)'); if (i) i.innerHTML = E.ico; var ch = el.querySelector('.ag0-b-chip'); if (ch) ch.innerHTML = E.chip; }
    el.setAttribute('aria-label', (el.getAttribute('aria-label') || '').replace(/Agendada|Confirmada|Atendida|Cancelada|No asistió/, E.t));
  }
  function remapea(root, k) {
    if (!root) return;
    [].forEach.call(root.querySelectorAll('.ag0-b[data-cita], .ag0-lf[data-cita]'), function (el) {
      if (el.classList.contains('ag0-b--ev') || el.classList.contains('ag0-b--evn') || el.classList.contains('ag0-b--fant')) return;
      if (el.classList.contains('ag0-lf') && !el.querySelector('.ag0-est')) return;
      if (el.dataset.e0 === undefined) { el.dataset.e0 = (el.className.match(/ag0-b--(ag|conf|aten|canc|noas)\b/) || [])[1] || ''; el.dataset.p0 = el.classList.contains('ag0-b--pasado') ? '1' : ''; el.dataset.c0 = el.classList.contains('ag0-b--curso') ? '1' : ''; }
      var e0 = el.dataset.e0; if (!e0) return;
      if (k === 0) { ponEstado(el, e0, el.dataset.p0); if (el.dataset.c0) el.classList.add('ag0-b--curso'); return; }
      ponEstado(el, e0 === 'canc' ? 'canc' : k > 0 ? (e0 === 'aten' || e0 === 'noas' ? 'ag' : e0) : (e0 === 'noas' ? 'noas' : 'aten'), k < 0);
    });
  }
  /* ---- Burbuja de alta (ag-burbuja) en el hueco tocado o arrastrado; fuera de horario, antes su pregunta ---- */
  function altaEn(m, col, hu) {
    if (!col || !hu || !hu.classList.contains('ag0-on') || !ancho(m)) return;
    var r = (hu.querySelector('span').textContent || '').match(/(\d\d):(\d\d) – (\d\d):(\d\d)/); if (!r) return;
    var d = +col.dataset.dia, a = +r[1] + r[2] / 60, z = +r[3] + r[4] / 60, hor = HOR[d];
    var abreAlta = function () { altaPinta(m, 'alta', d, a, z); abre(m, 'alta', null); };
    if (!hor || a < hor[0] || a >= hor[1]) {
      var t = !hor ? 'Vas a agendar a las ' + h2(a) + ' del ' + DIA[d] + ', y este consultorio no atiende ' + PLU[d] + '.' : 'Vas a agendar a las ' + h2(a) + ', y este consultorio atiende de ' + h2(hor[0]) + ' a ' + h2(hor[1]) + '.';
      avisa(m, [{ h: '¿Es correcto?', t: t, v: 'Agendar' }], abreAlta, function () { hueco(m, null); }); return;
    }
    abreAlta();
  }
  function altaPinta(m, k, d, a, z) {
    var h = m.querySelector('.as-alta-h'), t = m.querySelector('template[data-al-t="' + k + '"]'); if (!h || !t) return;
    h.innerHTML = ''; h.appendChild(t.content.cloneNode(true)); m._alta = [d, a, z];
    var f = new Date(2026, 10, 16 + 7 * S(m).k + d), tit = h.querySelector('h2');
    if (tit) tit.textContent = 'Nueva cita · ' + NOMC[d].toLowerCase() + ' ' + f.getDate() + ', ' + h2(a) + '–' + h2(z);
    var ins = h.querySelectorAll('input'); [].forEach.call(ins, function (x) { if (/^\d\d:\d\d$/.test(x.value)) x.value = x === ins[ins.length - 1] || x.value === '19:30' ? h2(z) : h2(a); });
  }

  /* ---- Reinicio y estados fijos de la tira ---- */
  function reinicia(m) {
    var s = S(m); cierra(m); apagaToast(m); hueco(m, null);
    var se = sem(m); se.innerHTML = s.html; se.style.transform = ''; se.getAnimations && se.getAnimations().forEach(function (a) { a.cancel(); });
    [].forEach.call(se.querySelectorAll('[data-listo]'), function (x) { x.removeAttribute('data-listo'); });
    s.k = 0; m.classList.remove('as-otra'); muestra(m, 'semana', false); semana(m, 0, false); ponScroll(m); if (m._rem) guardaRem(m);
  }
  function estado(m, k) {
    reinicia(m);
    var arr = /^arr|^est|^hue|^mas/.test(k);
    if (arr && !ancho(m)) return;
    if (/^des/.test(k) && !desliza(m)) return;
    if (k === 'arr-antes' || k === 'arr-durante' || k === 'arr-aviso' || k === 'arr-despues') {
      aCuerpo(m, 12.75); if (k === 'arr-antes') return;
      var b = sem(m).querySelector('.ag0-b[data-cita="v5"]'), cl = clonaPara(m, b);
      col(m, 5).appendChild(cl); ponPos(cl, 13.5, 14.5);
      if (k === 'arr-durante') { cl.classList.add('ag0-b--arr'); return; }
      var r = revisa(m, cl, 5, 13.5, 14.5, 'mover');
      if (k === 'arr-aviso') { avisa(m, r.avisos, function () { confirmaMover(m, cl, b); }, function () { vuelve(m, cl, b); }); return; }
      confirmaMover(m, cl, b, true); return;
    }
    if (/^est/.test(k)) {
      aCuerpo(m, 16); var e = sem(m).querySelector('.ag0-b[data-cita="j11"]'); estira(m, e); ponPos(e, 17.5, 18.5);
      if (k === 'est-durante') return;
      e.classList.remove('ag0-b--est');
      var r2 = revisa(m, e, 3, 17.5, 18.5, 'estirar');
      if (k === 'est-aviso') { avisa(m, r2.avisos, function () { confirmaEstirar(m, e); }, function () { deshazEstirar(m, e); }); return; }
      confirmaEstirar(m, e, true); return;
    }
    if (/^hue/.test(k)) {
      aCuerpo(m, 11.5); var c = col(m, 1), g = c.querySelector('.ag0-hueco');
      g.style.top = 'calc(var(--cal-h) * ' + (13 - T0) + ' + 1px)'; g.style.height = 'calc(var(--cal-h) * ' + (k === 'hue-durante' ? 1.5 : 1) + ' - 2px)';
      g.querySelector('span').textContent = '13:00 – ' + (k === 'hue-durante' ? '14:30' : '14:00'); g.classList.add('ag0-on'); g.classList.toggle('as-vivo', k === 'hue-durante'); return;
    }
    if (k === 'mas') { abre(m, 'mas', sem(m).querySelector('.as-mas')); return; }
    if (k === 'des-durante') { sem(m).style.transform = 'translateX(-64px)'; return; }
    if (k === 'des-despues') { semana(m, 1, false); return; }
    if (k === 'dia-durante') { var h = sem(m).querySelector('.ag0-dias .ag0-dia[aria-current="date"], .as-ldb[data-d="3"]'); if (h) h.classList.add('as-puls'); return; }
    if (k === 'dia-despues') { muestra(m, 'dia', false, 3); return; }
  }

  /* ---- Puntero: arrastrar, estirar, crear en hueco y deslizar ---- */
  function horaEn(m, c, y) { var r = c.getBoundingClientRect(); return T0 + ((y - r.top) / zoomDe(m)) / calH(c); }
  function colEn(m, x) { var cs = cols(m); for (var i = 0; i < cs.length; i++) { var r = cs[i].getBoundingClientRect(); if (x >= r.left && x < r.right) return cs[i]; } return x < cs[0].getBoundingClientRect().left ? cs[0] : cs[cs.length - 1]; }
  function levanta(m, g) {
    g.activo = true; try { m.setPointerCapture(g.id); } catch (e) {}
    var r = az(g.b); g.a0 = r[0]; g.z0 = r[1];
    if (g.tipo === 'mover') { g.cl = clonaPara(m, g.b); g.cl.classList.add('ag0-b--arr'); g.off = horaEn(m, g.b.parentNode, g.y0) - r[0]; g.d = +g.b.parentNode.dataset.dia; }
    else { estira(m, g.b); g.d = +g.b.parentNode.dataset.dia; }
  }
  function mueve(m, g, e) {
    if (g.tipo === 'mover') {
      var c = colEn(m, e.clientX), dur = g.z0 - g.a0, a = Math.round((horaEn(m, c, e.clientY) - g.off) * 4) / 4;
      a = Math.max(T0, Math.min(AS.t1 - dur, a)); if (g.cl.parentNode !== c) c.appendChild(g.cl); g.d = +c.dataset.dia; ponPos(g.cl, a, a + dur); return;
    }
    if (g.tipo === 'estirar') { var z = Math.round(horaEn(m, g.b.parentNode, e.clientY) * 4) / 4; z = Math.max(g.a0 + .25, Math.min(AS.t1, z)); ponPos(g.b, g.a0, z); return; }
    if (g.tipo === 'crear') {
      var hh = horaEn(m, g.col, e.clientY), a2 = Math.floor(Math.min(g.h0, hh) * 2) / 2, z2 = Math.max(a2 + .5, Math.ceil(Math.max(g.h0, hh) * 2) / 2), hu = g.col.querySelector('.ag0-hueco');
      hu.style.top = 'calc(var(--cal-h) * ' + (a2 - T0) + ' + 1px)'; hu.style.height = 'calc(var(--cal-h) * ' + (z2 - a2) + ' - 2px)'; hu.querySelector('span').textContent = h2(a2) + ' – ' + h2(z2); hu.classList.add('ag0-on', 'as-vivo'); return;
    }
    if (g.tipo === 'desl') {
      var dx = (e.clientX - g.x0) / g.z; g.v = (e.clientX - g.xu) / Math.max(1, e.timeStamp - g.tu); g.xu = e.clientX; g.tu = e.timeStamp;
      sem(m).style.transform = 'translateX(' + dx * .6 + 'px)'; g.dx = dx;
    }
  }
  function suelta(m, g) {
    if (g.tipo === 'mover') {
      var cl = g.cl, b = g.b, a = cl._a, z = cl._z, d = g.d; cl.classList.remove('ag0-b--arr');
      if (d === +b.parentNode.dataset.dia && Math.abs(a - g.a0) < .01) { vuelve(m, cl, b); return; }
      var r = revisa(m, cl, d, a, z, 'mover');
      if (r.veto) { brinda(m, r.veto, true); vuelve(m, cl, b); return; }
      if (!r.avisos.length) { confirmaMover(m, cl, b); return; }
      avisa(m, r.avisos, function () { confirmaMover(m, cl, b); }, function () { vuelve(m, cl, b); }); return;
    }
    if (g.tipo === 'estirar') {
      var e2 = g.b; e2.classList.remove('ag0-b--est'); if (Math.abs(e2._z - g.z0) < .01) { deshazEstirar(m, e2); return; }
      var r2 = revisa(m, e2, g.d, e2._a, e2._z, 'estirar');
      if (r2.veto) { brinda(m, r2.veto, true); deshazEstirar(m, e2); return; }
      if (!r2.avisos.length) { confirmaEstirar(m, e2); return; }
      avisa(m, r2.avisos, function () { confirmaEstirar(m, e2); }, function () { deshazEstirar(m, e2); }); return;
    }
    if (g.tipo === 'crear') { var hu = g.col.querySelector('.ag0-hueco'); if (hu) hu.classList.remove('as-vivo'); altaEn(m, g.col, hu); return; }
    if (g.tipo === 'desl') {
      var se = sem(m), dx = g.dx || 0, pasa = Math.abs(dx) >= 64 || Math.abs(g.v || 0) >= .4, dir = dx < 0 ? 1 : -1;
      if (!pasa) { var x = dx * .6; se.style.transform = ''; if (!rm()) se.animate([{ transform: 'translateX(' + x + 'px)' }, { transform: 'none' }], { duration: 420, easing: RESORTE }); return; }
      var x0 = dx * .6, fuera = -dir * 160;
      var cambia = function () { se.style.transform = ''; semana(m, S(m).k + dir, true, dir); };
      if (rm()) { cambia(); return; }
      se.animate([{ transform: 'translateX(' + x0 + 'px)', opacity: 1 }, { transform: 'translateX(' + fuera + 'px)', opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' }).onfinish = function (ev) { ev.target.cancel(); cambia(); };
    }
  }
  marcos.forEach(function (m) {
    S(m);
    m.addEventListener('pointerdown', function (e) {
      if (e.button > 0 || m.querySelector('.ag0-capa.ag0-on')) return;
      var se = sem(m); if (!se || se.style.display === 'none' || !se.contains(e.target) || m.classList.contains('as-otra') && !desliza(m)) return;
      var g = { x0: e.clientX, y0: e.clientY, xu: e.clientX, tu: e.timeStamp, z: zoomDe(m), id: e.pointerId };
      var b = e.target.closest('.ag0-b');
      if (b && ancho(m) && se.querySelector('.ag0-lienzo') && se.querySelector('.ag0-lienzo').contains(b) && !b.classList.contains('ag0-b--fant')) {
        var r = b.getBoundingClientRect(); g.b = b; g.tipo = ((r.bottom - e.clientY) / g.z <= 10 && !b.classList.contains('ag0-d15')) ? 'estirar' : 'mover';
        if (tactil(m)) g.timer = setTimeout(function () { if (m._g === g && !g.eje) levanta(m, g); }, 450); /* en táctiles se levanta con toque sostenido */
      } else if (e.target.classList.contains('ag0-col') && ancho(m) && !m.classList.contains('ab')) { g.tipo = 'crear'; g.col = e.target; g.h0 = horaEn(m, e.target, e.clientY); }
      m._g = g;
    });
    m.addEventListener('pointermove', function (e) {
      var g = m._g; if (!g || e.pointerId !== g.id) return;
      if (g.activo) { mueve(m, g, e); return; }
      var dx = (e.clientX - g.x0) / g.z, dy = (e.clientY - g.y0) / g.z;
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.eje = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; clearTimeout(g.timer);
      if (g.b && !tactil(m)) { levanta(m, g); mueve(m, g, e); return; }
      if (g.eje === 'x' && desliza(m) && !g.b || g.eje === 'x' && desliza(m) && g.b && !g.activo) { hueco(m, null); g.tipo = 'desl'; g.activo = true; try { m.setPointerCapture(g.id); } catch (er) {} mueve(m, g, e); return; }
      if (g.tipo === 'crear') { g.activo = true; try { m.setPointerCapture(g.id); } catch (er) {} mueve(m, g, e); return; }
      m._g = null;
    });
    var fin = function (e) {
      var g = m._g; if (!g || e.pointerId !== g.id) return; clearTimeout(g.timer); m._g = null;
      if (!g.activo) { if (g.tipo === 'crear') { var hu0 = g.col.querySelector('.ag0-hueco'); setTimeout(function () { altaEn(m, g.col, hu0); }, 0); } return; }
      if (g.tipo !== 'crear') { m._sinClick = true; setTimeout(function () { m._sinClick = false; }, 80); }
      suelta(m, g);
    };
    m.addEventListener('pointerup', fin); m.addEventListener('pointercancel', fin);
    /* Clic: número de día → Día; segmentado; ‹ Hoy ›; respuesta del aviso; «+N más» lo abre la pieza base (data-abre) */
    m.addEventListener('click', function (e) {
      var al = e.target.closest('[data-al]');
      if (al && m.contains(al)) { var capa = m.querySelector('[data-capa="aviso"]'); if (al.dataset.al === 'si') capa._si(); else capa._no(); return; }
      var t = e.target.closest('button'); if (!t || !m.contains(t)) return;
      var s = S(m);
      if (t.classList.contains('ag0-dia') && sem(m).contains(t)) { var ds = [].slice.call(t.parentNode.querySelectorAll('.ag0-dia')); muestra(m, 'dia', true, ds.indexOf(t)); return; }
      if (t.classList.contains('as-ldb')) { muestra(m, 'dia', true, +t.dataset.d); return; }
      if (t.getAttribute('role') === 'tab' && t.closest('.ag0-barra')) { if (t.dataset.vista === 'semana' && s.vista === 'dia') muestra(m, 'semana', true); else muestra(m, s.vista, false); return; }
      var lab = t.getAttribute('aria-label') || '';
      if (lab === 'Periodo siguiente' || lab === 'Periodo anterior') { if (s.vista !== 'semana') muestra(m, 'semana', false); var dir = lab === 'Periodo siguiente' ? 1 : -1; semana(m, s.k + dir, true, dir); return; }
      if (t.classList.contains('ag0-hoy')) { if (s.vista !== 'semana') muestra(m, 'semana', false); semana(m, 0, true, 0); return; }
    });
    m.addEventListener('keydown', function (e) { var capa = m.querySelector('[data-capa="aviso"]'); if (e.key === 'Escape' && capa && capa._pend) capa._no(); });
  });

  /* ======== Caminos que la capa de integración de la base no cubre en la Semana ========
     (burbuja, alta, alertas → guion de ag-burbuja; formulario, herramientas, cromo, saltos de vista → tmp-integra.js de la base) */
  marcos.forEach(function (m) {
    m.addEventListener('click', function (e) {
      var t = e.target.closest('button,a'); if (!t || !m.contains(t)) return;
      var lab = t.getAttribute('aria-label') || '';
      /* Opciones de la agenda (ag-herr): actúan sobre esta rejilla */
      if (t.dataset.compactar) { setTimeout(function () { clases('x:as-compacta', t.getAttribute('aria-checked') === 'true'); m.classList.remove('ag0-avc'); }, 0); return; }
      if (t.dataset.densidad) { setTimeout(function () { clases('x:ag0-densa-m', t.getAttribute('aria-checked') === 'true'); }, 0); return; }
      if (t.dataset.med) { var todos = t.dataset.med === 'todos'; setTimeout(function () { clases('x:as-todos+ag0-sinmed', todos); if (t.closest('.ag0-capa')) cierra(m); }, 0); return; }
      /* bloqueo de todo el día → la edición del bloqueo (la misma que la franja de la rejilla) */
      if (t.classList.contains('ag0-tc') && t.dataset.bloqueo) { var bq = m.querySelector('.ag0-bq[data-bloqueo]'); if (bq) bq.click(); return; }
      /* Ir a una fecha → el Día elegido, en su semana */
      if (t.closest('[data-capa="fecha"]') && t.closest('.ag0-mm-g')) {
        var n = +t.textContent, mes = /octubre/.test(lab) ? -1 : /diciembre/.test(lab) ? 1 : 0, dd = Math.round((new Date(2026, 10 + mes, n) - new Date(2026, 10, 16)) / 864e5);
        var k = Math.floor(dd / 7), d = dd - 7 * k; setTimeout(function () { semana(m, k, true, k > S(m).k ? 1 : -1); muestra(m, 'dia', true, d); }, 0); return;
      }
    });
  });
  return { estado: estado, reinicia: reinicia };
})();

(function () { var t = (op || document).querySelector('.af-tira'); if (t) t.style.display = 'none'; })();
