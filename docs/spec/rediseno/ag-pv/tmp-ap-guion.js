/* Asistente de primera vez · guion de maqueta. CFG = {v, paso, ficha, tira}. Solo actúa sobre .ap.ap-vN.marco.
   Movimiento: resortes escritos con linear() (amortiguación 1, respuesta ~.35 s) y WAAPI; toda transición parte del valor
   que hay EN PANTALLA, así que se puede invertir a medio camino (pulsar «Atrás» mientras entra el paso siguiente). En la app:
   Motion `type:'spring', bounce:0` (entrada .45 s, salida .22 s). Solo transform y opacity. */
var V = CFG.v;
var marcos = [].slice.call(document.querySelectorAll('.ap.ap-v' + V + '.marco'));
if (!marcos.length) return;
var raiz = document.documentElement;
var RM = matchMedia('(prefers-reduced-motion: reduce)');
var RESORTE = 'linear(0,.009,.035,.075,.124,.181,.243,.305,.367,.427,.484,.537,.587,.632,.674,.711,.745,.776,.803,.828,.849,.868,.885,.9,.913,.925,.935,.944,.951,.958,.964,.969,.974,.977,.981,.984,.986,.988,.99,.992,.993,.994,.995,.996,.997,.998,1)';
var SALIDA = 'cubic-bezier(.4,0,1,1)';
function osc() { if (raiz.classList.contains('oscuro')) return true; if (raiz.classList.contains('claro')) return false; if (raiz.dataset.theme) return raiz.dataset.theme === 'dark'; return matchMedia('(prefers-color-scheme: dark)').matches; }
function tema() { var o = osc(); marcos.forEach(function (m) { m.classList.toggle('ag0-osc', o); }); }
function q(m, s) { return m.querySelector(s); }
function qa(m, s) { return [].slice.call(m.querySelectorAll(s)); }
function zoomDe(m) { var r = m.getBoundingClientRect(); return r.width / m.offsetWidth || 1; }

/* ---------- validez (pasoValido de PrimeraVez.tsx) ---------- */
function editorBien(ed) {
  var on = qa(ed, '.ap-dia[data-on="1"]'); ed.classList.toggle('ap-cero', on.length === 0);
  return on.length > 0 && !on.some(function (d) { return d.classList.contains('ap-mal'); });
}
function valido(m, p) {
  var main = q(m, '.ap-main');
  if (p === 0) return editorBien(q(m, '.ap-paso[data-paso="0"] .ap-dias'));
  if (p === 1) { qa(m, '.ap-paso[data-paso="1"] .ap-dias').forEach(editorBien); return qa(m, '.ap-g-cons').every(function (g) { return !g.classList.contains('ap-otro') || editorBien(q(g, '.ap-dias')); }); }
  if (p === 2) { var g = q(m, '.ap-g-dur'); if (!g.classList.contains('ap-otra-on')) return true; return (+q(g, '.ap-otra .ap-num').value || 0) >= 5; }
  if (p === 3) return !q(m, '.ap-g-av').classList.contains('ap-plinv');
  return true;
}

/* ---------- avance y pie ---------- */
function pinta(m) {
  var main = q(m, '.ap-main'), p = +main.dataset.paso, noadm = main.classList.contains('ap-noadm');
  var n = noadm ? p : p + 1, de = noadm ? 3 : 4;
  q(m, '.ap-av-n').textContent = 'Paso ' + n + ' de ' + de;
  qa(m, '.ap-av-l li').forEach(function (li) { var i = +li.dataset.i; li.classList.toggle('ap-hecho', i < p); if (i === p) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
  main.classList.toggle('ap-primero', p === (noadm ? 1 : 0));
  var sig = q(m, '[data-ap="sig"]'), g = main.classList.contains('ap-guardando');
  sig.firstChild.textContent = g ? 'Guardando…' : p === 3 ? 'Terminar' : 'Continuar';
  sig.setAttribute('aria-disabled', String(g || !valido(m, p)));
  var dsp = q(m, '[data-ap="despues"]'); dsp.setAttribute('aria-disabled', String(g));
  var msg = ['No se pudo guardar el horario de la clínica', 'Hosp Norte: No se pudo guardar el horario', 'Ya hay un tipo de cita activo con ese nombre', '', ''][p];
  q(m, '.ap-gerr span').textContent = msg;
  if (!msg) main.classList.remove('ap-gerr-on');
}

/* ---------- transición entre pasos: resorte, dirección coherente y VUELTA ARRIBA ---------- */
function vivo(el) { var cs = getComputedStyle(el); return { t: cs.transform === 'none' ? '' : cs.transform, o: cs.opacity }; }
function corta(el) { var v = vivo(el); if (el._a) { el._a.forEach(function (a) { a.cancel(); }); el._a = null; } return v; }
function irA(m, n) {
  var main = q(m, '.ap-main'), de = +main.dataset.paso;
  if (n === de) return;
  var dir = n > de ? 1 : -1, desp = q(m, '.ap-desp'), s = desp.scrollTop;
  var sale = q(m, '.ap-paso[data-paso="' + de + '"]'), entra = q(m, '.ap-paso[data-paso="' + n + '"]');
  var vS = corta(sale), vE = entra.hidden ? null : corta(entra);
  main.dataset.paso = n; main.classList.remove('ap-gerr-on', 'ap-guardando');
  entra.hidden = false; entra.inert = false; sale.inert = true;
  /* El defecto de hoy (PrimeraVez.tsx:239): window.scrollTo no mueve el contenedor que de verdad se desplaza. Aquí se
     vuelve arriba EL CONTENEDOR del contenido, y el paso que sale se queda donde estaba (translateY −s) mientras se va. */
  desp.scrollTop = 0; main.classList.remove('ap-scrolled');
  pinta(m);
  var rm = RM.matches, dx = 28;
  var a1 = sale.animate(rm ? [{ opacity: vS.o }, { opacity: 0 }]
    : [{ transform: 'translateY(' + (-s) + 'px) ' + vS.t, opacity: vS.o }, { transform: 'translate(' + (-dir * dx) + 'px,' + (-s) + 'px)', opacity: 0 }],
  { duration: rm ? 160 : 200, easing: SALIDA, fill: 'forwards' });
  sale._a = [a1];
  a1.onfinish = function () { if (main.dataset.paso !== sale.dataset.paso) { sale.hidden = true; } a1.cancel(); sale._a = null; };
  var desde = vE ? { transform: vE.t || 'none', opacity: vE.o } : { transform: 'translateX(' + (dir * 36) + 'px)', opacity: 0 };
  var a2 = entra.animate(rm ? [{ opacity: vE ? vE.o : 0 }, { opacity: 1 }] : [desde, { transform: 'none', opacity: 1 }], { duration: rm ? 200 : 520, easing: rm ? 'ease-out' : RESORTE });
  entra._a = [a2]; a2.onfinish = function () { entra._a = null; };
  var h = q(entra, 'h1'); if (h && m.style.display !== 'none') try { h.focus({ preventScroll: true }); } catch (e) {}
}

/* ---------- pantallas: agenda ⇄ asistente (empuje desde la derecha; vuelve por el mismo camino) ---------- */
function pantalla(m, a, alListo) {
  var pant = q(m, '.ap-pant'), de = pant.dataset.ver; if (de === a) { if (alListo) alListo(); return; }
  var entra = q(m, a === 'funnel' ? '.ap-scr-fn' : '.ap-scr-ag'), sale = q(m, a === 'funnel' ? '.ap-scr-ag' : '.ap-scr-fn');
  if (!entra || !sale) return;
  var vS = corta(sale), vE = entra.hidden ? null : corta(entra), rm = RM.matches, ade = a === 'funnel';
  pant.dataset.ver = a; entra.hidden = false; entra.inert = false; sale.inert = true;
  entra.style.zIndex = ade ? 2 : 1; sale.style.zIndex = ade ? 1 : 2;
  var a1, a2;
  if (rm) {
    a1 = sale.animate([{ opacity: vS.o }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
    a2 = entra.animate([{ opacity: vE ? vE.o : 0 }, { opacity: 1 }], { duration: 200 });
  } else if (ade) {
    a1 = sale.animate([{ transform: vS.t || 'none', opacity: vS.o }, { transform: 'translateX(-30%)', opacity: .6 }], { duration: 520, easing: RESORTE, fill: 'forwards' });
    a2 = entra.animate([vE ? { transform: vE.t || 'none', opacity: vE.o } : { transform: 'translateX(100%)', opacity: 1 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: RESORTE });
  } else {
    a1 = sale.animate([{ transform: vS.t || 'none', opacity: vS.o }, { transform: 'translateX(100%)', opacity: 1 }], { duration: 300, easing: SALIDA, fill: 'forwards' });
    a2 = entra.animate([vE ? { transform: vE.t || 'none', opacity: vE.o } : { transform: 'translateX(-30%)', opacity: .6 }, { transform: 'none', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  sale._a = [a1]; entra._a = [a2];
  a1.onfinish = function () { if (pant.dataset.ver !== a) return; sale.hidden = true; a1.cancel(); sale._a = null; };
  a2.onfinish = function () { entra._a = null; if (alListo) alListo(); };
  ponScroll(m);
}
function abreEn(m, paso) {
  var main = q(m, '.ap-main');
  qa(m, '.ap-paso').forEach(function (s) { corta(s); s.hidden = +s.dataset.paso !== paso; s.inert = false; s.style.transform = ''; s.style.opacity = ''; });
  main.dataset.paso = paso; main.classList.remove('ap-gerr-on', 'ap-guardando'); q(m, '.ap-desp').scrollTop = 0; pinta(m);
}
function salir(m) { cierraCapa(m); pantalla(m, 'agenda'); }
function entrar(m, paso) {
  cierraCapa(m);
  var p = paso !== undefined ? paso : (m._guardado !== null && m._guardado !== undefined ? m._guardado : (m._max || 0));
  if (q(m, '.ap-main').classList.contains('ap-noadm') && p === 0) p = 1;
  if (q(m, '.ap-pant').dataset.ver !== 'funnel') abreEn(m, p);
  pantalla(m, 'funnel');
}
function despues(m) {
  var main = q(m, '.ap-main'), p = +main.dataset.paso;
  if (main.classList.contains('ap-guardando') || p === 4) return;
  var ok = valido(m, p);
  if (!ok) { m._guardado = p; salir(m); return; }   /* inválido: no guarda, pero apunta el paso */
  main.classList.add('ap-guardando'); pinta(m);
  setTimeout(function () {
    main.classList.remove('ap-guardando');
    if (m.classList.contains('ap-x-gerr') && p < 3) { main.classList.add('ap-gerr-on'); pinta(m); return; }
    m._guardado = p; pinta(m); salir(m);
  }, 450);
}
function continuar(m) {
  var main = q(m, '.ap-main'), p = +main.dataset.paso, sig = q(m, '[data-ap="sig"]');
  if (sig.getAttribute('aria-disabled') === 'true') return;
  if (p === 3) { m._guardado = null; irA(m, 4); enlace(m); return; }
  main.classList.add('ap-guardando'); pinta(m);
  setTimeout(function () {
    main.classList.remove('ap-guardando');
    if (m.classList.contains('ap-x-gerr')) { main.classList.add('ap-gerr-on'); pinta(m); return; }
    m._max = Math.max(m._max || 0, p + 1); irA(m, p + 1);
  }, 320);
}
function enlace(m) {
  var main = q(m, '.ap-main'); if (m.classList.contains('ap-x-fijo')) return;
  main.classList.add('ap-carga'); clearTimeout(m._te);
  m._te = setTimeout(function () { if (!m.classList.contains('ap-x-carga')) main.classList.remove('ap-carga'); }, 700);
}

/* ---------- capas base (menú «Opciones de la agenda») ---------- */
function cierraCapa(m) {
  qa(m, '.ag0-capa.ag0-on').forEach(function (c) { c.classList.remove('ag0-on'); c.setAttribute('aria-hidden', 'true'); if (c._btn) { c._btn.setAttribute('aria-expanded', 'false'); c._btn = null; } });
}
function abreCapa(m, key, btn) {
  var capa = q(m, '[data-capa="' + key + '"]'); if (!capa) return;
  cierraCapa(m); capa.classList.add('ag0-on'); capa.setAttribute('aria-hidden', 'false');
  var cj = q(capa, '.ag0-cj');
  if (btn) { btn.setAttribute('aria-expanded', 'true'); capa._btn = btn;
    if (cj.classList.contains('ag0-anc')) { var z = zoomDe(m), mr = m.getBoundingClientRect(), b = btn.getBoundingClientRect(), w = cj.offsetWidth || 288;
      cj.style.left = ((b.right - mr.left) / z - w) + 'px'; cj.style.top = ((b.bottom - mr.top) / z + 6) + 'px'; } }
}
function ponScroll(m) {
  qa(m, '.ag0-cal[data-scroll]').forEach(function (cal) {
    var c = q(cal, '.ag0-cuerpo'); if (!c) return;
    var fija = function () { if (c.clientHeight > 0 && !c.dataset.listo) { var h = parseFloat(getComputedStyle(cal).getPropertyValue('--cal-h')) || 80; c.scrollTop = (parseFloat(cal.dataset.scroll) - 7) * h; c.dataset.listo = '1'; } };
    new ResizeObserver(fija).observe(c); fija();
  });
}

/* ---------- aviso breve (catálogo capas-b): entra desde arriba con resorte, sale por el mismo camino ---------- */
function toast(m, on) {
  var t = q(m, '.ap-toast'); clearTimeout(t._r);
  var v = t.hidden ? null : corta(t), rm = RM.matches;
  if (on) {
    t.hidden = false;
    t._a = [t.animate(rm ? [{ opacity: v ? v.o : 0 }, { opacity: 1 }] : [v ? { transform: v.t || 'none', opacity: v.o } : { transform: 'translateY(-60%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: rm ? 200 : 480, easing: rm ? 'ease-out' : RESORTE })];
    t._r = setTimeout(function () { toast(m, false); }, 8000);
  } else if (!t.hidden) {
    var a = t.animate(rm ? [{ opacity: v.o }, { opacity: 0 }] : [{ transform: v.t || 'none', opacity: v.o }, { transform: 'translateY(-60%)', opacity: 0 }], { duration: 220, easing: SALIDA, fill: 'forwards' });
    t._a = [a]; a.onfinish = function () { t.hidden = true; a.cancel(); t._a = null; };
  }
}

/* ---------- cálculos de lo que se ve ---------- */
function cabe(m) {
  var g = q(m, '.ap-g-dur'), otra = g.classList.contains('ap-otra-on');
  var min = otra ? (+q(g, '.ap-otra .ap-num').value || 0) : +q(g, '.ap-op[aria-pressed="true"]').dataset.min;
  var n = min >= 5 ? Math.floor(600 / min) : 0;
  g.classList.toggle('ap-sincabe', !(n > 0));
  if (n > 0) { q(g, '.ap-cuantas').textContent = n + ' consultas'; q(g, '.ap-mins').textContent = min; q(m, '.ap-rs-min').textContent = min; }
}
function avisosRes(m) {
  var main = q(m, '.ap-main'), rec = q(m, '[data-ap="rec"]').getAttribute('aria-checked') === 'true', cli = q(m, '[data-ap="cli"]').getAttribute('aria-checked') === 'true';
  main.classList.toggle('ap-recoff', !rec);
  var sel = q(m, '.ap-f-mandar select'), corto = { '2 horas': '2 horas', '12 horas': '12 horas', '1 día (24 horas)': '1 día', '2 días (48 horas)': '2 días' }[sel.value] || '1 día';
  q(m, '.ap-rs-av').textContent = (rec ? 'Recordatorio al paciente ' + corto + ' antes' : 'Sin recordatorio al paciente') + (cli ? ' · te avisamos de cada cita nueva' : '');
}
function plazos(m, abrir) {
  var g = q(m, '.ap-g-av'), b = q(g, '[data-ap="plazos"]'), inv = g.classList.contains('ap-plinv');
  var on = abrir === undefined ? !g.classList.contains('ap-pla-on') : abrir;
  if (!on && inv) on = true;               /* con un plazo inválido no se pliega (BloquesAvisos.tsx:226) */
  g.classList.toggle('ap-pla-on', on); b.setAttribute('aria-expanded', String(on)); b.textContent = on ? 'Listo' : 'Cambiar';
}
function validaPlazo(m) {
  var g = q(m, '.ap-g-av'), v = q(g, '.ap-in-hz').value, n = +v;
  var mal = v.trim() === '' || !(n >= 1 && n <= 365) || Math.floor(n) !== n;
  g.classList.toggle('ap-plinv', mal); if (!mal) q(g, '.ap-v-hz').textContent = n;
  if (mal) plazos(m, true); pinta(m);
}


/* ---------- la agenda de fondo: cada control lleva a su pieza real ---------- */
/* Misma página publicada (Herramientas y configuración): buscar, campana, ir a una fecha, leyenda, atajos y médico
   están en sus vistas; se desplaza hasta ellas, se realzan y se abre su estado. */
function irOp(suf, acc) {
  var o = [].slice.call(document.querySelectorAll('.op[data-op]')).filter(function (x) { return x.dataset.op.slice(-suf.length) === suf; })[0];
  if (!o) return false;
  marcos.forEach(cierraCapa);
  o.scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth', block: 'start' });
  var e = o.querySelector('.esc');
  if (e && e.animate) e.animate([{ boxShadow: '0 0 0 0 rgba(47,90,168,0)' }, { boxShadow: '0 0 0 6px rgba(47,90,168,.55)' }, { boxShadow: '0 0 0 0 rgba(47,90,168,0)' }], { duration: 1600, delay: RM.matches ? 0 : 300 });
  var b = o.querySelector('header button[data-a="' + acc + '"]');
  if (b) setTimeout(function () { b.click(); }, RM.matches ? 0 : 500);
  return true;
}
function destino(t) {
  var al = t.getAttribute('aria-label') || '', tx = (t.textContent || '').trim();
  if (t.classList.contains('ag0-tit')) return ['-fecha-leyenda-atajos', 'abre:fecha'];
  if (/^Buscar citas/.test(al) || tx === 'Buscar citas de un paciente') return ['-buscar', 'abre:buscar'];
  if (/^Por confirmar/.test(al)) return ['-campana', 'abre:campana'];
  if (t.classList.contains('ag0-med')) return ['-opciones', 'abre:medico'];
  if (tx === 'Leyenda de estados') return ['-fecha-leyenda-atajos', 'abre:leyenda'];
  if (/^Atajos de teclado/.test(tx)) return ['-fecha-leyenda-atajos', 'abre:atajos'];
  return null;
}
var PER = {
  semana: { ancho: ['9 – 15 nov 2026', '16 – 22 nov 2026', '23 – 29 nov 2026'], tel: ['9 – 15 de noviembre', '16 – 22 de noviembre', '23 – 29 de noviembre'] },
  dia: { ancho: ['Miércoles, 18 de noviembre de 2026', 'Jueves, 19 de noviembre de 2026', 'Viernes, 20 de noviembre de 2026'], tel: ['Mié, 18 de noviembre', 'Jue, 19 de noviembre', 'Vie, 20 de noviembre'] },
  tres: { ancho: ['16 – 18 nov 2026', '19 – 21 nov 2026', '22 – 24 nov 2026'], tel: ['16 – 18 de noviembre', '19 – 21 de noviembre', '22 – 24 de noviembre'] },
  mes: { ancho: ['Octubre de 2026', 'Noviembre de 2026', 'Diciembre de 2026'], tel: ['Octubre de 2026', 'Noviembre de 2026', 'Diciembre de 2026'] } };
function ponTitulo(m, texto) {
  var tt = q(m, '.ap-agenda .ag0-tit-t'); if (!tt) return;
  var sv = tt.querySelector('svg'), w = texto.split(' '), nw = document.createElement('span'); nw.className = 'ag0-nw'; nw.textContent = w.pop(); if (sv) nw.appendChild(sv);
  tt.textContent = w.join(' ') + ' '; tt.appendChild(nw); q(m, '.ap-agenda .ag0-tit').setAttribute('aria-label', 'Ir a una fecha: ' + texto);
}
function periodo(m, d) {
  var k = (m.dataset.vp === 'ext' || m.dataset.vp === 'tel') ? 'tel' : 'ancho', sel = q(m, '.ap-agenda .ag0-seg [aria-selected="true"]'), v = sel ? sel.dataset.vista : 'dia';
  m._per = d === 0 ? 1 : Math.max(0, Math.min(2, (m._per === undefined ? 1 : m._per) + d));
  ponTitulo(m, PER[v][k][m._per]);
}
/* ---------- toques dentro del marco ---------- */
function liga(m) {
  var main = q(m, '.ap-main'), desp = q(m, '.ap-desp');
  desp.addEventListener('scroll', function () { main.classList.toggle('ap-scrolled', desp.scrollTop > 2); }, { passive: true });
  m.addEventListener('click', function (e) {
    var t = e.target.closest('button,a'); if (!t || !m.contains(t)) return;
    if (t.tagName === 'A') e.preventDefault();
    if (t.getAttribute('aria-disabled') === 'true' || t.disabled) return;
    var a = t.dataset.ap;
    if (t.matches('[data-cierra]')) { cierraCapa(m); return; }
    if (t.classList.contains('ag0-ap-cab')) { var pl = !m.classList.contains('ag0-pleg'); m.classList.toggle('ag0-pleg', pl); t.setAttribute('aria-expanded', String(!pl)); return; }
    var de = destino(t); if (de && irOp(de[0], de[1])) return;
    if (t.getAttribute('role') === 'tab' && t.closest('.ag0-seg') && CFG.titulos) {
      [].forEach.call(t.parentNode.children, function (x) { x.setAttribute('aria-selected', String(x === t)); });
      m._per = 1; ponTitulo(m, CFG.titulos[t.dataset.vista][(m.dataset.vp === 'ext' || m.dataset.vp === 'tel') ? 'tel' : 'ancho']); return;
    }
    if (/^Periodo anterior/.test(t.getAttribute('aria-label') || '')) { periodo(m, -1); return; }
    if (/^Periodo siguiente/.test(t.getAttribute('aria-label') || '')) { periodo(m, 1); return; }
    if (t.classList.contains('ag0-hoy')) { periodo(m, 0); return; }
    if (t.dataset.abre === 'menu') { abreCapa(m, 'menu', t); return; }
    if (t.classList.contains('ag0-op') && /Configuración de la agenda/.test(t.textContent)) { entrar(m); return; }
    if (t.dataset.sub !== undefined) { var s = t.nextElementSibling, on = !s.classList.contains('ag0-on'); s.classList.toggle('ag0-on', on); t.setAttribute('aria-expanded', String(on)); return; }
    if (t.dataset.sw) { t.setAttribute('aria-checked', String(t.getAttribute('aria-checked') !== 'true')); return; }
    if (t.getAttribute('role') === 'menuitemradio') { [].forEach.call(t.parentNode.children, function (x) { x.setAttribute('aria-checked', String(x === t)); }); return; }
    if (t.getAttribute('role') === 'switch') {
      var on2 = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', String(on2));
      if (a === 'dia') { var d = t.closest('.ap-dia'); d.dataset.on = on2 ? '1' : '0'; if (!on2) d.classList.remove('ap-mal'); }
      if (a === 'rec' || a === 'cli') avisosRes(m);
      pinta(m); return;
    }
    if (t.getAttribute('role') === 'radio') {
      var g = t.closest('.ap-g-cons'); qa(g, '.ap-rad').forEach(function (r) { r.setAttribute('aria-checked', String(r === t)); });
      g.classList.toggle('ap-otro', t.dataset.modo === 'propio'); pinta(m); return;
    }
    if (t.classList.contains('ap-op')) {
      var gd = t.closest('.ap-g-dur'); qa(gd, '.ap-op').forEach(function (o) { o.setAttribute('aria-pressed', String(o === t)); });
      gd.classList.toggle('ap-otra-on', t.dataset.min === 'otra'); cabe(m); pinta(m); return;
    }
    if (a === 'plazos') { if (g = q(m, '.ap-g-av'), g.classList.contains('ap-pla-on')) validaPlazo(m); plazos(m); return; }
    if (a === 'config') { entrar(m); return; }
    if (a === 'sig') { continuar(m); return; }
    if (a === 'atras') { var p = +main.dataset.paso; irA(m, p - 1); return; }
    if (t.dataset.ir !== undefined) { irA(m, +t.dataset.ir); return; }
    if (a === 'agenda') { if (+main.dataset.paso === 4) { m._max = 0; m._guardado = null; } salir(m); return; }
    if (a === 'despues') { despues(m); return; }
    if (a === 'copiar') { t.lastChild.textContent = 'Copiado'; return; }
    if (a === 'copiar1') { t.lastChild.textContent = 'Copiado'; t.setAttribute('aria-label', 'Copiar el enlace de una vez: copiado'); return; }
    if (a === 'crear') { t.lastChild.textContent = 'Creando…'; t.setAttribute('aria-disabled', 'true'); setTimeout(function () { main.classList.add('ap-unaok'); t.lastChild.textContent = 'Crear enlace de una vez'; t.removeAttribute('aria-disabled'); }, 600); return; }
    if (t.classList.contains('ap-toast-x')) { toast(m, false); return; }
  });
  m.addEventListener('input', function (e) {
    if (e.target.closest('.ap-otra')) { cabe(m); pinta(m); }
    if (e.target.classList.contains('ap-in-hz')) validaPlazo(m);
  });
  m.addEventListener('change', function (e) { if (e.target.closest('.ap-f-mandar')) avisosRes(m); });
  m.addEventListener('keydown', function (e) { if (e.key === 'Escape') cierraCapa(m); });
}

/* ---------- estados de maqueta (tira, fuera del marco) ---------- */
function estado(m, k, on) {
  var main = q(m, '.ap-main');
  if (k === 'reves') { var d = q(m, '.ap-paso[data-paso="0"] .ap-dia[data-dia="martes"]'); d.dataset.on = '1'; q(d, '[role="switch"]').setAttribute('aria-checked', 'true'); d.classList.toggle('ap-mal', on); q(d, '.ap-hfin').textContent = on ? '07:00' : '18:00'; }
  if (k === 'ninguno') qa(m, '.ap-paso[data-paso="0"] .ap-dia').forEach(function (d) { var v = on ? false : d.dataset.dia !== 'domingo'; d.dataset.on = v ? '1' : '0'; q(d, '[role="switch"]').setAttribute('aria-checked', String(v)); d.classList.remove('ap-mal'); });
  if (k === 'guardando') main.classList.toggle('ap-guardando', on);
  if (k === 'gerr') { m.classList.toggle('ap-x-gerr', on); main.classList.toggle('ap-gerr-on', on); }
  if (k === 'propio' || k === 'propio0') {
    var g = q(m, '.ap-g-cons[data-cons="norte"]'); g.classList.toggle('ap-otro', on);
    qa(g, '.ap-rad').forEach(function (r) { r.setAttribute('aria-checked', String((r.dataset.modo === 'propio') === on)); });
    qa(g, '.ap-dia').forEach(function (d) { var v = on && k === 'propio0' ? false : d.dataset.dia !== 'domingo'; d.dataset.on = v ? '1' : '0'; q(d, '[role="switch"]').setAttribute('aria-checked', String(v)); });
  }
  if (k === 'noadm') {
    main.classList.toggle('ap-noadm', on);
    qa(m, '.ap-paso[data-paso="3"] .ap-sw').forEach(function (s) { s.disabled = on || main.classList.contains('ap-nd-on'); });
    q(m, '[data-ap="plazos"]').hidden = on;
    if (on && +main.dataset.paso === 0) abreEn(m, 1);
  }
  if (k === 'otra' || k === 'otra0') {
    var gd = q(m, '.ap-g-dur'); qa(gd, '.ap-op').forEach(function (o) { o.setAttribute('aria-pressed', String(on ? o.dataset.min === 'otra' : o.dataset.min === '30')); });
    gd.classList.toggle('ap-otra-on', on); q(gd, '.ap-otra .ap-num').value = on && k === 'otra0' ? '' : '25'; cabe(m);
  }
  if (k === 'plazos') plazos(m, on);
  if (k === 'plinv') { q(m, '.ap-in-hz').value = on ? '400' : '60'; validaPlazo(m); if (!on) plazos(m, false); }
  if (k === 'recoff') { q(m, '[data-ap="rec"]').setAttribute('aria-checked', String(!on)); avisosRes(m); }
  if (k === 'nd') {
    main.classList.toggle('ap-nd-on', on);
    ['rec', 'cli'].forEach(function (x) { var s = q(m, '[data-ap="' + x + '"]'); s.setAttribute('aria-checked', String(!on)); s.disabled = on || main.classList.contains('ap-noadm'); });
    avisosRes(m);
  }
  if (k === 'carga' || k === 'err1' || k === 'err2') {
    ['carga', 'err1', 'err2'].forEach(function (x) { main.classList.toggle('ap-' + x, on && x === k); m.classList.toggle('ap-x-' + x, on && x === k); });
    m.classList.toggle('ap-x-fijo', on);
  }
  if (k === 'nota') main.classList.toggle('ap-nota-on', on);
  if (k === 'creando') { var b = q(m, '[data-ap="crear"]'); b.lastChild.textContent = on ? 'Creando…' : 'Crear enlace de una vez'; if (on) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled'); }
  if (k === 'unaok') main.classList.toggle('ap-unaok', on);
  if (k === 'copiado') q(m, '[data-ap="copiar"]').lastChild.textContent = on ? 'Copiado' : 'Copiar enlace';
  pinta(m);
}
function acciona(a, b) {
  if (a.indexOf('e:') === 0) {
    var k = a.slice(2), on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on));
    marcos.forEach(function (m) { if (q(m, '.ap-pant').dataset.ver !== 'funnel') entrar(m, CFG.paso); estado(m, k, on); });
    return;
  }
  marcos.forEach(function (m) {
    if (a === 'cerrar') { cierraCapa(m); toast(m, false); }
    if (a === 'menu') { if (q(m, '.ap-pant').dataset.ver !== 'agenda') { pantalla(m, 'agenda'); } abreCapa(m, 'menu', q(m, '.ap-agenda [data-abre="menu"]')); }
    if (a === 'entrar') entrar(m, m._guardado !== null && m._guardado !== undefined ? m._guardado : 0);
    if (a === 'salir') salir(m);
    if (a === 'despues') { if (q(m, '.ap-pant').dataset.ver !== 'funnel') entrar(m, CFG.paso); despues(m); }
    if (a === 'reentra') { if (CFG.v === '0' && (m._guardado === null || m._guardado === undefined)) m._guardado = 1; entrar(m); }
    if (a === 'denuevo') { m._guardado = null; m._max = 0; if (q(m, '.ap-pant').dataset.ver === 'funnel') { abreEn(m, 0); } else entrar(m, 0); }
    if (a === 'copiar') { var c = q(m, '[data-ap="copiar"]'); c.lastChild.textContent = 'Copiado'; }
    if (a === 'toast') toast(m, true);
    if (a === 'abajo') { var d = q(m, '.ap-desp'); d.scrollTo({ top: d.scrollHeight, behavior: RM.matches ? 'auto' : 'smooth' }); }
  });
}

/* ---------- tira de maqueta (fuera del marco) y ficha ---------- */
var tira = document.createElement('div'); tira.className = 'ap-tira'; tira.setAttribute('role', 'group'); tira.setAttribute('aria-label', 'Controles de la maqueta');
(CFG.tira || []).forEach(function (x) {
  if (x === '|') { var s = document.createElement('span'); s.className = 'ap-tsep'; s.setAttribute('aria-hidden', 'true'); tira.appendChild(s); return; }
  var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Maqueta: ' + x[0]; b.dataset.a = x[1]; if (x[2] !== undefined) b.setAttribute('aria-pressed', String(x[2])); tira.appendChild(b);
});
tira.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) acciona(b.dataset.a, b); });
var op = marcos[0].closest('.op'), ficha = null;
if (CFG.ficha) { ficha = document.createElement('section'); ficha.className = 'ap-ficha'; ficha.setAttribute('aria-label', 'Especificación'); ficha.setAttribute('lang', 'es'); ficha.innerHTML = CFG.ficha; }
if (op) { op.querySelector('header').appendChild(tira); if (ficha) op.appendChild(ficha); }
else { marcos[0].parentNode.insertBefore(tira, marcos[0]); if (ficha) marcos[marcos.length - 1].parentNode.appendChild(ficha); }

marcos.forEach(function (m) { m._guardado = null; m._max = CFG.paso; liga(m); ponScroll(m); cabe(m); avisosRes(m); pinta(m); });
tema();
new MutationObserver(tema).observe(raiz, { attributes: true, attributeFilter: ['class', 'data-theme'] });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', tema);
