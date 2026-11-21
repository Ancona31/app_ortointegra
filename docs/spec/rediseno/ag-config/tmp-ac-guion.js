/* Agenda · Configuración. Guion común; CFG = {v, op, ficha, tira, est}. Solo actúa sobre .ac.ac-vN.marco */
var V = CFG.v;
var marcos = [].slice.call(document.querySelectorAll('.ac.ac-v' + V + '.marco'));
if (!marcos.length) return;
var raiz = document.documentElement;
var RM = matchMedia('(prefers-reduced-motion: reduce)');
/* Resorte sin rebote (amortiguación 1, respuesta .35 s) escrito con linear(); en la app, resorte de Motion (bounce 0) */
var RESORTE = 'linear(0,.009,.035,.075,.124,.181,.243,.305,.367,.427,.484,.537,.587,.632,.674,.711,.745,.776,.803,.828,.849,.868,.885,.9,.913,.925,.935,.944,.951,.958,.964,.969,.974,.977,.981,.984,.986,.988,.99,.992,.993,.994,.995,.996,.997,.998,1)';
var IC_OK = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
var IC_X = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
function zoomDe(m) { var r = m.getBoundingClientRect(); return r.width / m.offsetWidth || 1; }
function cada(m, sel, f) { [].forEach.call(m.querySelectorAll(sel), f); }

/* ---- Rol y estados de maqueta: data-ver (roles que lo ven), data-si / data-no (estado que lo enseña / lo esconde) ---- */
function aplica(m) {
  var rol = m.dataset.rol, est = (m.dataset.est || '').split(' ').filter(Boolean);
  cada(m, '[data-ver],[data-si],[data-no]', function (el) {
    var ok = true;
    if (el.dataset.ver && el.dataset.ver.split(' ').indexOf(rol) < 0) ok = false;
    if (ok && el.dataset.si) ok = el.dataset.si.split(' ').some(function (k) { return est.indexOf(k) >= 0; });
    if (ok && el.dataset.no) ok = !el.dataset.no.split(' ').some(function (k) { return est.indexOf(k) >= 0; });
    el.hidden = !ok;
  });
  cada(m, '[data-dis]', function (el) { el.disabled = el.dataset.dis.split(' ').some(function (k) { return est.indexOf(k) >= 0 || k === 'rol-' + rol; }); });
}
function ponEst(m, k, on) {
  var est = (m.dataset.est || '').split(' ').filter(Boolean), i = est.indexOf(k);
  if (on && i < 0) est.push(k); if (!on && i >= 0) est.splice(i, 1);
  m.dataset.est = est.join(' '); aplica(m);
}
function tieneEst(m, k) { return (m.dataset.est || '').split(' ').indexOf(k) >= 0; }

/* ---- Aviso breve (pieza del catálogo): arriba en el área de contenido; 4 s éxito, 8 s error; se pausa al tocar; se descarta arrastrando hacia arriba ---- */
function quitaAviso(t, desde) {
  if (t._sale) return; t._sale = 1; clearTimeout(t._reloj);
  var y = desde || 0, h = t.offsetHeight || 48;
  var a = RM.matches ? t.animate([{ opacity: getComputedStyle(t).opacity }, { opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' })
    : t.animate([{ transform: 'translateY(' + y + 'px)', opacity: 1 }, { transform: 'translateY(' + (Math.min(y, 0) - h * .6) + 'px)', opacity: 0 }], { duration: 250, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
  a.onfinish = function () { t.remove(); };
}
function reloj(t, ms) { clearTimeout(t._reloj); t._inicio = Date.now(); t._resta = ms; t._reloj = setTimeout(function () { quitaAviso(t); }, ms); }
function aviso(m, tipo, texto) {
  var c = m.querySelector('.ac-avisos'); if (!c) return;
  var t = document.createElement('div'); t.className = 'ac-t'; t.dataset.t = tipo;
  if (tipo === 'error') t.setAttribute('role', 'alert');
  t.innerHTML = '<span class="ac-ti">' + (tipo === 'error' ? IC_X : IC_OK) + '</span><span class="ac-tx"></span><button type="button" class="ag0-p ac-tc" aria-label="Cerrar aviso">' + IC_X + '</button>';
  t.querySelector('.ac-tx').textContent = texto;
  c.insertBefore(t, c.firstChild);
  var vivos = [].filter.call(c.children, function (x) { return !x._sale; });
  if (vivos.length > 2) quitaAviso(vivos[vivos.length - 1]);
  if (RM.matches) t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
  else t.animate([{ transform: 'translateY(-60%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: RESORTE });
  var dura = tipo === 'error' ? 8000 : 4000; reloj(t, dura);
  var pausa = function () { if (t._sale || t._pausado) return; t._pausado = 1; clearTimeout(t._reloj); t._resta = Math.max(1000, t._resta - (Date.now() - t._inicio)); };
  var sigue = function () { if (t._sale || !t._pausado) return; t._pausado = 0; reloj(t, t._resta); };
  t.addEventListener('pointerenter', pausa); t.addEventListener('pointerleave', sigue);
  t.addEventListener('focusin', pausa); t.addEventListener('focusout', sigue);
  t.querySelector('.ac-tc').addEventListener('click', function () { quitaAviso(t); });
  t.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); quitaAviso(t); } });
  /* Arrastre: 1:1 hacia arriba; hacia abajo, resistencia (rubber-band .55); al soltar, proyección de inercia (d .998) */
  t.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.ac-tc')) return;
    var z = zoomDe(m), y0 = e.clientY, hist = [[e.timeStamp, 0]], dy = 0, h = t.offsetHeight;
    t.setPointerCapture(e.pointerId); pausa();
    var mueve = function (ev) { var d = (ev.clientY - y0) / z; dy = d < 0 ? d : (d * h * .55) / (h + .55 * d); t.style.transform = 'translateY(' + dy + 'px)'; hist.push([ev.timeStamp, dy]); if (hist.length > 5) hist.shift(); };
    var suelta = function () {
      t.removeEventListener('pointermove', mueve); t.removeEventListener('pointerup', suelta); t.removeEventListener('pointercancel', suelta);
      var a = hist[0], b = hist[hist.length - 1], v = b[0] > a[0] ? (b[1] - a[1]) / (b[0] - a[0]) * 1000 : 0;
      var proy = dy + (v / 1000) * .998 / (1 - .998);
      t.style.transform = '';
      if (proy < -h / 2 || v < -600) quitaAviso(t, dy);
      else { if (!RM.matches && dy) t.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: 420, easing: RESORTE }); sigue(); }
    };
    t.addEventListener('pointermove', mueve); t.addEventListener('pointerup', suelta); t.addEventListener('pointercancel', suelta);
  });
}

/* ---- Capas: velo + tarjeta (resorte de maqueta en CSS, piezas base); hoja arrastrable en iPhone ---- */
function cierra(m) {
  cada(m, '.ag0-capa.ag0-on', function (c) {
    c.classList.remove('ag0-on'); c.setAttribute('aria-hidden', 'true');
    var cj = c.querySelector('.ag0-cj'); if (cj) { cj.style.transform = ''; cj.style.transition = ''; }
    if (c._btn) { c._btn.setAttribute('aria-expanded', 'false'); try { c._btn.focus({ preventScroll: true }); } catch (e) {} c._btn = null; }
  });
}
function ancla(m, capa, btn) {
  var cj = capa.querySelector('.ag0-cj'); if (!cj || !cj.classList.contains('ag0-anc') || !btn) return;
  var z = zoomDe(m), mr = m.getBoundingClientRect(), b = btn.getBoundingClientRect();
  var x1 = (b.right - mr.left) / z, y1 = (b.bottom - mr.top) / z, y0 = (b.top - mr.top) / z, w = cj.offsetWidth || 288, h = cj.offsetHeight || 120;
  cj.style.left = Math.max(256, x1 - w) + 'px';
  if (y1 + 6 + h > m.offsetHeight - 12) { cj.style.top = (y0 - 6 - h) + 'px'; cj.style.transformOrigin = 'bottom right'; }
  else { cj.style.top = (y1 + 6) + 'px'; cj.style.transformOrigin = 'top right'; }
}
function abre(m, key, btn) {
  var capa = m.querySelector('[data-capa="' + key + '"]'); if (!capa) return;
  cierra(m); aplica(m);
  capa.classList.add('ag0-on'); capa.setAttribute('aria-hidden', 'false');
  if (btn) { btn.setAttribute('aria-expanded', 'true'); capa._btn = btn; ancla(m, capa, btn); }
  var f = capa.querySelector('.ag0-cj input:not([type=time]),.ag0-cj [aria-pressed="true"],.ag0-cj button'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
  cada(capa, '.ac-ed', function (ed) { valida(m, ed); });
}
function hojaArrastre(m) {
  if (m.dataset.vp !== 'tel') return;
  m.addEventListener('pointerdown', function (e) {
    var asa = e.target.closest('.ag0-asa,.ag0-cjc'); if (!asa || e.target.closest('button')) return;
    var capa = asa.closest('.ag0-capa.ag0-on'); if (!capa || capa.classList.contains('ac-capa-al')) return;
    var cj = capa.querySelector('.ag0-cj'), z = zoomDe(m), y0 = e.clientY, h = cj.offsetHeight, dy = 0, hist = [[e.timeStamp, 0]];
    asa.setPointerCapture(e.pointerId); cj.style.transition = 'none';
    var mueve = function (ev) { var d = (ev.clientY - y0) / z; dy = d > 0 ? d : -(-d * h * .55) / (h + .55 * -d); cj.style.transform = 'translateY(' + dy + 'px)'; hist.push([ev.timeStamp, dy]); if (hist.length > 5) hist.shift(); };
    var suelta = function () {
      asa.removeEventListener('pointermove', mueve); asa.removeEventListener('pointerup', suelta); asa.removeEventListener('pointercancel', suelta);
      var a = hist[0], b = hist[hist.length - 1], v = b[0] > a[0] ? (b[1] - a[1]) / (b[0] - a[0]) * 1000 : 0;
      var proy = dy + (v / 1000) * .998 / (1 - .998);
      if (proy > h / 2 || v > 600) {
        cj.style.transition = 'transform 260ms cubic-bezier(.4,0,1,1)'; cj.style.transform = 'translateY(100%)';
        setTimeout(function () { cierra(m); }, 240);
      } else { cj.style.transition = 'transform 420ms ' + RESORTE; cj.style.transform = ''; setTimeout(function () { cj.style.transition = ''; }, 440); }
    };
    asa.addEventListener('pointermove', mueve); asa.addEventListener('pointerup', suelta); asa.addEventListener('pointercancel', suelta);
  });
}

/* ---- Editor de días: prender un día copia las horas del prendido anterior; validación en vivo ---- */
function valida(m, ed) {
  var filas = [].slice.call(ed.querySelectorAll('.ac-dr')), alguno = false, mal = false;
  filas.forEach(function (f) {
    var on = f.dataset.on === '1', e = f.querySelector('[data-e]'), s = f.querySelector('[data-s]'), er = f.querySelector('.ac-err');
    var rev = on && e.value >= s.value; if (on) alguno = true; if (rev) mal = true; er.hidden = !rev;
  });
  var capa = ed.closest('.ag0-capa'), ning = capa.querySelector('[data-ninguno]'), g = capa.querySelector('[data-guarda]');
  var modo = capa.querySelector('.ac-seg [aria-pressed="true"]'), clinica = modo && modo.dataset.modo === 'clinica';
  if (ning) ning.hidden = clinica || alguno;
  if (g) g.disabled = !clinica && (!alguno || mal);
}
function prende(m, fila) {
  var on = fila.dataset.on !== '1'; fila.dataset.on = on ? '1' : '0';
  fila.querySelector('[role=switch]').setAttribute('aria-checked', String(on));
  if (on) { var p = fila.previousElementSibling; while (p && p.dataset.on !== '1') p = p.previousElementSibling;
    if (p) { fila.querySelector('[data-e]').value = p.querySelector('[data-e]').value; fila.querySelector('[data-s]').value = p.querySelector('[data-s]').value; } }
  valida(m, fila.closest('.ac-ed'));
}

/* ---- Caminos: «‹ Agenda» → la agenda real (Día de agenda-base, copiada en el marco); otras secciones de esta misma página ---- */
function vista(m, k) {
  var cfg = m.querySelector('.ac-app-cfg'), ag = m.querySelector('.ac-app-ag'); if (!cfg || !ag) return;
  cfg.hidden = k !== 'cfg'; ag.hidden = k === 'cfg';
  var nuevo = k === 'cfg' ? cfg : ag;
  if (!RM.matches) nuevo.animate([{ opacity: 0, transform: 'translateX(' + (k === 'cfg' ? 24 : -24) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: RESORTE });
  if (k === 'ag') cada(ag, '.ag0-cal[data-scroll]', function (cal) { var c = cal.querySelector('.ag0-cuerpo'); if (c) c.scrollTop = (parseFloat(cal.dataset.scroll) - 7) * (parseFloat(getComputedStyle(cal).getPropertyValue('--cal-h')) || 80); });
  var f = nuevo.querySelector(k === 'cfg' ? '.ac-volver' : '.ag0-tit'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
}
function irA(claves) {
  var o = null;
  claves.forEach(function (k) { if (!o) o = document.querySelector('.op[data-op="' + k + '"]') || (/^\d/.test(k) ? null : document.querySelector('.op[data-op$="-' + k + '"]')); });
  if (!o) return;
  o.scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth', block: 'start' });
  var e = o.querySelector('.esc') || o; if (!RM.matches) e.animate([{ boxShadow: '0 0 0 0 transparent' }, { boxShadow: '0 0 0 4px var(--accion)' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 1600, delay: 300, easing: 'ease-in-out' });
}

/* ---- Clics dentro del marco ---- */
function liga(m) {
  m.addEventListener('click', function (e) {
    var t = e.target.closest('button,a,[data-cierra]'); if (!t || !m.contains(t)) return;
    if (t.tagName === 'A' && t.getAttribute('href') === '#') e.preventDefault();
    if (t.disabled) return;
    if (t.matches('[data-cierra]')) { cierra(m); return; }
    if (t.classList.contains('ag0-ap-cab')) { var ab0 = t.getAttribute('aria-expanded') !== 'true'; t.setAttribute('aria-expanded', String(ab0)); m.classList.toggle('ag0-pleg', !ab0); return; }
    if (t.dataset.ir) { irA(t.dataset.ir.split(' ')); return; }
    if (t.classList.contains('ac-volver') || (t.closest('.ac-app-cfg') && t.matches('nav a[aria-current="page"],.ag0-pv[aria-current="page"]'))) { vista(m, 'ag'); return; }
    if (t.closest('.ag0-op') && t.textContent.trim() === 'Configuración de la agenda') { cierra(m); vista(m, 'cfg'); return; }
    if (t.dataset.rest !== undefined) { cierra(m); irA(['pv-entrada', '0-entrada']); return; }
    if (t.dataset.abre) { abre(m, t.dataset.abre, t); return; }
    if (t.classList.contains('ac-dsw')) { prende(m, t.closest('.ac-dr')); return; }
    if (t.getAttribute('role') === 'switch') {
      var on = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', String(on));
      var tt = t.querySelector('[data-on]'); if (tt) tt.textContent = on ? tt.dataset.on : tt.dataset.off;
      if (t.dataset.est) ponEst(m, t.dataset.est, !on);
      aviso(m, 'ok', 'Guardado'); return;
    }
    if (t.parentNode.classList && t.parentNode.classList.contains('ac-seg')) {
      [].forEach.call(t.parentNode.children, function (x) { x.setAttribute('aria-pressed', String(x === t)); });
      var seg = t.parentNode;
      if (seg.dataset.modos !== undefined) { var c = seg.closest('.ag0-capa'); c.querySelector('[data-bloque="clinica"]').hidden = t.dataset.modo !== 'clinica'; c.querySelector('[data-bloque="propio"]').hidden = t.dataset.modo === 'clinica'; valida(m, c.querySelector('.ac-ed')); return; }
      if (seg.dataset.otra !== undefined) { var bx = seg.parentNode.querySelector('[data-otra-campo]'); if (bx) bx.hidden = t.dataset.v !== 'otra'; return; }
      if (seg.dataset.guarda !== undefined) { cada(m, '[data-dur]', function (x) { x.textContent = t.dataset.v + ' minutos'; }); ponEst(m, 'sindur', false); aviso(m, 'ok', 'Guardado'); }
      return;
    }
    if (t.dataset.plega !== undefined) {
      var ab = t.getAttribute('aria-expanded') !== 'true'; t.setAttribute('aria-expanded', String(ab));
      var obj = t.dataset.plega ? m.querySelector('[data-plegado="' + t.dataset.plega + '"]') : t.nextElementSibling;
      if (obj) { obj.dataset.ab = ab ? '1' : ''; obj.hidden = !ab; if (ab && !RM.matches) obj.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: RESORTE }); }
      return;
    }
    if (t.dataset.copia !== undefined) { var lbl = t.querySelector('span') || t; lbl.textContent = 'Copiado'; if (t.getAttribute('aria-label')) t.setAttribute('aria-label', t.getAttribute('aria-label').replace(/: copiado$/, '') + ': copiado'); return; }
    if (t.dataset.alterna) { var k = t.dataset.alterna.split(' '); k.forEach(function (x) { if (x.charAt(0) === '-') ponEst(m, x.slice(1), false); else ponEst(m, x, !tieneEst(m, x)); }); return; }
    if (t.dataset.guarda !== undefined) { cierra(m); aviso(m, 'ok', t.dataset.texto || 'Guardado'); if (t.dataset.tras) t.dataset.tras.split(' ').forEach(function (x) { if (x.charAt(0) === '-') ponEst(m, x.slice(1), false); else ponEst(m, x, true); }); return; }
    if (t.dataset.quita !== undefined) { var fila = t.closest('.ac-li'); fila.hidden = true; fila.dataset.quitada = '1'; aviso(m, 'ok', 'Guardado'); return; }
  });
  m.addEventListener('input', function (e) {
    var t = e.target;
    if (t.matches('.ac-ed input')) valida(m, t.closest('.ac-ed'));
    if (t.dataset.palabra !== undefined) { var b = t.closest('.ag0-cj').querySelector('[data-rest]'); b.disabled = t.value !== 'RESTABLECER'; }
    if (t.dataset.plazo !== undefined) {
      clearTimeout(m._plazo);
      var min = +t.min, max = +t.max, v = t.value.trim(), ok = v !== '' && +v >= min && +v <= max && Math.round(+v) === +v;
      var er = m.querySelector('[data-plazo-err]');
      if (!ok) { er.querySelector('span').textContent = v === '' ? t.dataset.nombre + ': escribe un número' : t.dataset.nombre + ': de ' + min + ' a ' + max + ' ' + t.dataset.unidad; er.hidden = false; return; }
      er.hidden = true; m._plazo = setTimeout(function () { aviso(m, 'ok', 'Guardado'); }, 700);
    }
  });
  m.addEventListener('change', function (e) { if (e.target.matches('select[data-guarda-sel]')) aviso(m, 'ok', 'Guardado'); });
  m.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { cierra(m); return; }
    var tab = e.target.closest('[role=tab]'); if (!tab) return;
    var ts = [].slice.call(tab.parentNode.querySelectorAll('[role=tab]')), i = ts.indexOf(tab), n = ts.length, j = -1;
    if (e.key === 'ArrowRight') j = (i + 1) % n; else if (e.key === 'ArrowLeft') j = (i - 1 + n) % n; else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = n - 1;
    if (j >= 0) { e.preventDefault(); ts[j].focus(); }
  });
  hojaArrastre(m);
}

/* ---- Tira de maqueta (fuera del marco) y ficha «Especificación» ---- */
function acciona(a, b) {
  if (a === 'cerrar') { marcos.forEach(cierra); return; }
  if (a.indexOf('rol:') === 0) { [].forEach.call(b.parentNode.querySelectorAll('[data-a^="rol:"]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); }); marcos.forEach(function (m) { cierra(m); m.dataset.rol = a.slice(4); aplica(m); }); return; }
  if (a.indexOf('est:') === 0) { var k = a.slice(4), on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); marcos.forEach(function (m) { ponEst(m, k, on); }); return; }
  if (a.indexOf('capa:') === 0) { var p = a.slice(5).split('|'); marcos.forEach(function (m) { (p[1] ? p[1].split(' ') : []).forEach(function (x) { ponEst(m, x, true); }); var bt = m.querySelector('[data-abre="' + p[0] + '"]:not([hidden])'); abre(m, p[0], bt && bt.offsetParent ? bt : null); }); return; }
  if (a.indexOf('aviso:') === 0) { var q = a.slice(6).split('|'); marcos.forEach(function (m) { if (m.style.display !== 'none') aviso(m, q[0], q[1]); }); return; }
}
var tira = document.createElement('div'); tira.className = 'ac-tira'; tira.setAttribute('role', 'group'); tira.setAttribute('aria-label', 'Controles de la maqueta');
(CFG.tira || []).forEach(function (x) {
  if (x === '|') { var s = document.createElement('span'); s.className = 'ac-tsep'; s.setAttribute('aria-hidden', 'true'); tira.appendChild(s); return; }
  var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Maqueta: ' + x[0]; b.dataset.a = x[1]; if (x[2] !== undefined) b.setAttribute('aria-pressed', String(x[2])); tira.appendChild(b);
});
tira.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) acciona(b.dataset.a, b); });
var op = marcos[0].closest('.op'), ficha = null;
if (CFG.ficha) { ficha = document.createElement('section'); ficha.className = 'ac-ficha'; ficha.setAttribute('aria-label', 'Especificación'); ficha.setAttribute('lang', 'es'); ficha.innerHTML = CFG.ficha; }
if (op) { op.querySelector('header').appendChild(tira); if (ficha) op.appendChild(ficha); }
else { marcos[0].parentNode.insertBefore(tira, marcos[0]); if (ficha) marcos[marcos.length - 1].parentNode.appendChild(ficha); }

marcos.forEach(function (m) { m.dataset.est = (CFG.est || []).join(' '); aplica(m); liga(m);
  cada(m, '.ac-tabs', function (tb) { var s = tb.querySelector('[aria-selected="true"]'); new ResizeObserver(function () { if (tb.clientWidth && s && tb.scrollWidth > tb.clientWidth) tb.scrollLeft = Math.max(0, s.offsetLeft - (tb.clientWidth - s.offsetWidth) / 2); }).observe(tb); });
});

/* Tema: los colores de evento (--cal-ev-*) tienen su variante oscura en .ag0-osc (piezas base) */
function osc() { if (raiz.classList.contains('oscuro')) return true; if (raiz.classList.contains('claro')) return false; if (raiz.dataset.theme) return raiz.dataset.theme === 'dark'; return matchMedia('(prefers-color-scheme: dark)').matches; }
function tema() { var o = osc(); marcos.forEach(function (m) { m.classList.toggle('ag0-osc', o); }); }
tema(); new MutationObserver(tema).observe(raiz, { attributes: true, attributeFilter: ['class', 'data-theme'] });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', tema);
