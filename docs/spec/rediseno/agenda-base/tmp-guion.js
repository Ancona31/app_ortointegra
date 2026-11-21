/* Agenda · piezas base. Guion común; CFG = {v, ficha, tira, ...}. Solo actúa sobre .ag0.ag0-vN.marco (y sus gemelos de la vista 5). */
var V = CFG.v, T0 = 7;
var marcos = [].slice.call(document.querySelectorAll('.ag0.ag0-v' + V + '.marco'));
if (!marcos.length) return;
var todos = marcos.slice();
var raiz = document.documentElement;
function osc() { if (raiz.classList.contains('oscuro')) return true; if (raiz.classList.contains('claro')) return false; if (raiz.dataset.theme) return raiz.dataset.theme === 'dark'; return matchMedia('(prefers-color-scheme: dark)').matches; }
function tema() { var o = osc(); todos.forEach(function (m) { m.classList.toggle('ag0-osc', o); }); if (V === '6') todos.forEach(mideContraste); }
function zoomDe(m) { var r = m.getBoundingClientRect(); return r.width / m.offsetWidth || 1; }
function visible(m) { return m.style.display !== 'none' && m.offsetParent !== null; }

/* ---- Desplazamiento inicial de la rejilla (cuando el marco se hace visible) ---- */
function ponLista(m) {
  [].forEach.call(m.querySelectorAll('.ag0-sl'), function (l) {
    var fija = function () { if (l.clientHeight > 0 && !l.dataset.listo) { var s = m.querySelector('.ag0-td[aria-selected="true"]'), d = s && l.querySelector('[data-ld="' + s.dataset.d + '"]'); if (d) l.scrollTop = d.offsetTop - l.offsetTop; l.dataset.listo = '1'; } };
    new ResizeObserver(fija).observe(l); fija();
  });
}
function ponScroll(m) {
  ponLista(m);
  [].forEach.call(m.querySelectorAll('.ag0-cal[data-scroll]'), function (cal) {
    var c = cal.querySelector('.ag0-cuerpo'); if (!c) return;
    var fija = function () { if (c.clientHeight > 0 && !c.dataset.listo) { var h = parseFloat(getComputedStyle(cal).getPropertyValue('--cal-h')) || 80; c.scrollTop = (parseFloat(cal.dataset.scroll) - T0) * h; c.dataset.listo = '1'; } };
    new ResizeObserver(fija).observe(c); fija();
  });
}

/* ---- Capas (resorte de maqueta en CSS; en la app, resorte interrumpible con WAAPI) ---- */
function cierra(m) {
  [].forEach.call(m.querySelectorAll('.ag0-capa.ag0-on'), function (c) { c.classList.remove('ag0-on'); c.setAttribute('aria-hidden', 'true'); if (c._btn) { c._btn.setAttribute('aria-expanded', 'false'); try { c._btn.focus({ preventScroll: true }); } catch (e) {} c._btn = null; } });
  [].forEach.call(m.querySelectorAll('.ag0-b[aria-expanded="true"]'), function (b) { b.setAttribute('aria-expanded', 'false'); });
}
function ancla(m, capa, btn) {
  var cj = capa.querySelector('.ag0-cj'); if (!cj || !cj.classList.contains('ag0-anc') || !btn) return;
  var z = zoomDe(m), mr = m.getBoundingClientRect(), b = btn.getBoundingClientRect();
  var x0 = (b.left - mr.left) / z, x1 = (b.right - mr.left) / z, y1 = (b.bottom - mr.top) / z;
  var w = cj.offsetWidth || 288;
  cj.style.left = (cj.classList.contains('ag0-anc-i') ? x0 : x1 - w) + 'px';
  cj.style.top = (y1 + 6) + 'px';
}
function abre(m, key, btn) {
  var capa = m.querySelector('[data-capa="' + key + '"]'); if (!capa) return;
  cierra(m);
  capa.classList.add('ag0-on'); capa.setAttribute('aria-hidden', 'false');
  if (btn) { btn.setAttribute('aria-expanded', 'true'); capa._btn = btn; ancla(m, capa, btn); }
  var f = capa.querySelector('.ag0-cj button'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
}
function burbuja(m, id, btn) {
  var t = m.querySelector('template[data-bu="' + id + '"]'), capa = m.querySelector('[data-capa="burbuja"]');
  if (!t || !capa) return;
  var h = capa.querySelector('.ag0-bu-h'); h.innerHTML = ''; h.appendChild(t.content.cloneNode(true));
  abre(m, 'burbuja', null);
  var b = btn || m.querySelector('.ag0-b[data-cita="' + id + '"]');
  if (b) { b.setAttribute('aria-expanded', 'true'); capa._btn = b; }
}

/* ---- Hueco libre: fantasma de la cita nueva en la franja de 30 min pulsada ---- */
function hueco(m, col, hora) {
  [].forEach.call(m.querySelectorAll('.ag0-hueco.ag0-on'), function (x) { x.classList.remove('ag0-on'); });
  if (!col) return;
  var g = col.querySelector('.ag0-hueco'); if (!g) return;
  var a = Math.floor(hora * 2) / 2, f = a + .5;
  var hm = function (x) { var h = Math.floor(x), mm = Math.round((x - h) * 60); return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; };
  g.style.top = 'calc(var(--cal-h) * ' + (a - T0) + ' + 1px)'; g.style.height = 'calc(var(--cal-h) * .5 - 2px)';
  g.querySelector('span').textContent = hm(a) + ' – ' + hm(f);
  requestAnimationFrame(function () { g.classList.add('ag0-on'); });
}

/* ---- Contraste medido (vista de color) ---- */
function parse(c) {
  var m = c.match(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)/);
  if (m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] === undefined ? 1 : +m[4]];
  m = c.match(/rgba?\(([\d.]+),? ([\d.]+),? ([\d.]+)(?:,? \/? ?([\d.]+))?\)/);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  return [0, 0, 0, 1];
}
function lum(c) { var f = function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); }
function sobre(a, b) { var k = a[3]; return [a[0] * k + b[0] * (1 - k), a[1] * k + b[1] * (1 - k), a[2] * k + b[2] * (1 - k), 1]; }
function lee(el, v) { var p = document.createElement('span'); p.style.color = 'var(' + v + ')'; el.appendChild(p); var c = parse(getComputedStyle(p).color); p.remove(); return c; }
function mideContraste(m) {
  [].forEach.call(m.querySelectorAll('.ag0-cr'), function (o) {
    var sup = lee(o, '--sup'), bg = sobre(lee(o, o.dataset.bg), sup), fg = sobre(lee(o, o.dataset.fg), bg);
    var a = lum(fg), b = lum(bg), r = (Math.max(a, b) + .05) / (Math.min(a, b) + .05), min = parseFloat(o.dataset.min || '4.5');
    o.textContent = r.toFixed(1) + ':1 ' + (r >= min ? 'cumple' : 'no cumple');
    o.classList.toggle('ag0-cr-mal', r < min); o.title = '';
  });
}

/* ---- Interacción por marco ---- */
function liga(m) {
  m.addEventListener('click', function (e) {
    var t = e.target.closest('button,a'); if (!t || !m.contains(t)) return;
    if (t.tagName === 'A') e.preventDefault();
    var INT = m.classList.contains('ab');
    if (INT && (t.dataset.sub !== undefined || t.dataset.sw || t.getAttribute('role') === 'menuitemradio' || t.dataset.abre === 'menu' || t.dataset.ir || t.classList.contains('ag0-b'))) return;
    if (t.classList.contains('ag0-ap-cab')) { var pl = !(m.classList.contains('ag0-pleg') || m.hasAttribute('data-pleg')); m.removeAttribute('data-pleg'); m.classList.toggle('ag0-pleg', pl); t.setAttribute('aria-expanded', String(!pl)); return; }
    if (t.matches('[data-cierra]')) { cierra(m); return; }
    if (t.dataset.abre) { abre(m, t.dataset.abre, t); return; }
    if (t.dataset.sub !== undefined) { var s = t.nextElementSibling; var on = !s.classList.contains('ag0-on'); s.classList.toggle('ag0-on', on); t.setAttribute('aria-expanded', String(on)); return; }
    if (t.dataset.sw) { t.setAttribute('aria-checked', String(t.getAttribute('aria-checked') !== 'true')); return; }
    if (t.getAttribute('role') === 'menuitemradio') { [].forEach.call(t.parentNode.children, function (x) { x.setAttribute('aria-checked', String(x === t)); }); return; }
    if (t.classList.contains('ag0-b') && t.dataset.cita && m.querySelector('[data-capa="burbuja"]')) { burbuja(m, t.dataset.cita, t); return; }
    if (t.getAttribute('role') === 'tab' && t.closest('.ag0-seg')) {
      [].forEach.call(t.parentNode.children, function (x) { x.setAttribute('aria-selected', String(x === t)); });
      if (CFG.titulos) { var tt = m.querySelector('.ag0-tit-t'); var k = (m.dataset.vp === 'ext' || m.dataset.vp === 'tel') ? 'tel' : 'ancho'; if (tt) { var sv = tt.querySelector('svg'), w = CFG.titulos[t.dataset.vista][k].split(' '), nw = document.createElement('span'); nw.className = 'ag0-nw'; nw.textContent = w.pop(); if (sv) nw.appendChild(sv); tt.textContent = w.join(' ') + ' '; tt.appendChild(nw); } }
      return;
    }
    if (t.classList.contains('ag0-td')) {
      [].forEach.call(t.parentNode.children, function (x) { x.setAttribute('aria-selected', String(x === t)); });
      var l = m.querySelector('.ag0-sl'), d = l && l.querySelector('[data-ld="' + t.dataset.d + '"]');
      if (d) l.scrollTo({ top: d.offsetTop - l.offsetTop, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      return;
    }
  });
  /* Tocar el velo cierra; tocar fuera de un menú sin velo lo cierra (y lo tocado hace lo suyo) */
  m.addEventListener('click', function (e) { if (e.target.classList && e.target.classList.contains('ag0-velo')) cierra(m); });
  m.addEventListener('pointerdown', function (e) {
    [].forEach.call(m.querySelectorAll('.ag0-capa.ag0-sinvelo.ag0-on'), function (c) {
      if (c.contains(e.target) || (c._btn && c._btn.contains(e.target))) return;
      c.classList.remove('ag0-on'); c.setAttribute('aria-hidden', 'true'); if (c._btn) { c._btn.setAttribute('aria-expanded', 'false'); c._btn = null; }
    });
  }, true);
  m.addEventListener('pointerdown', function (e) {
    if (m.classList.contains('ab')) return;
    var col = e.target.classList && e.target.classList.contains('ag0-col') ? e.target : null;
    if (!col || !col.querySelector('.ag0-hueco')) return;
    var z = zoomDe(m), r = col.getBoundingClientRect(), h = parseFloat(getComputedStyle(col).getPropertyValue('--cal-h')) || 80;
    hueco(m, col, T0 + ((e.clientY - r.top) / z) / h);
  });
  m.addEventListener('keydown', function (e) { if (e.key === 'Escape') cierra(m); });
}

/* ---- Tira de maqueta (fuera del marco) y ficha «Especificación» ---- */
function acciona(a, b) {
  var vis = todos.filter(visible);
  var dest = todos;
  var pulsa = function (m, sel) { var x = m.querySelector(sel); if (x) x.click(); };
  if (todos[0].classList.contains('ab')) {
    if (a === 'cerrar') { todos.forEach(function (m) { pulsa(m, '[data-ir="cerrar"]'); if (m._afCierra) m._afCierra(); hueco(m, null); }); return; }
    if (a.indexOf('bu:') === 0) { todos.forEach(function (m) { pulsa(m, '.ag0-b[data-cita="' + a.slice(3) + '"]'); }); return; }
    if (a === 'menu') { todos.forEach(function (m) { pulsa(m, '.ag0-barra [data-abre="menu"]'); }); return; }
    if (a === 'hueco') { todos.forEach(function (m) { pulsa(m, '[data-ir="tira-hueco"]'); }); return; }
  }
  if (a === 'cerrar') { todos.forEach(cierra); todos.forEach(function (m) { hueco(m, null); }); return; }
  if (a.indexOf('bu:') === 0) { dest.forEach(function (m) { burbuja(m, a.slice(3)); }); return; }
  if (a === 'menu' || a === 'fecha') { dest.forEach(function (m) { var btn = m.querySelector('[data-abre="' + a + '"]'); abre(m, a, btn); }); return; }
  if (a === 'hueco') { dest.forEach(function (m) { var col = m.querySelector('.ag0-col[data-dia="' + (CFG.huecoDia || 3) + '"]'); [].forEach.call(m.querySelectorAll('.ag0-modo-on .ag0-col[data-dia="' + (CFG.huecoDia || 3) + '"]'), function (c) { col = c; }); hueco(m, col, CFG.huecoHora || 15.6); }); return; }
  if (a.indexOf('clase:') === 0) { var k = a.slice(6), on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); todos.forEach(function (m) { m.classList.toggle(k, on); [].forEach.call(m.querySelectorAll('.ag0-cuerpo'), function (c) { c.dataset.listo = ''; }); ponScroll(m); }); return; }
  if (a.indexOf('modo:') === 0) {
    var md = a.slice(5); [].forEach.call(b.parentNode.querySelectorAll('[data-a^="modo:"]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    todos.forEach(function (m) { [].forEach.call(m.querySelectorAll('[data-modo]'), function (s) { var on = s.dataset.modo === md; s.style.display = on ? 'flex' : 'none'; s.classList.toggle('ag0-modo-on', on); }); ponScroll(m); });
    return;
  }
}
var tira = document.createElement('div'); tira.className = 'ag0-tira'; tira.setAttribute('role', 'group'); tira.setAttribute('aria-label', 'Controles de la maqueta');
(CFG.tira || []).forEach(function (x) {
  if (x === '|') { var s = document.createElement('span'); s.className = 'ag0-tsep'; s.setAttribute('aria-hidden', 'true'); tira.appendChild(s); return; }
  var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Maqueta: ' + x[0]; b.dataset.a = x[1]; if (x[2] !== undefined) b.setAttribute('aria-pressed', String(x[2])); tira.appendChild(b);
});
tira.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) acciona(b.dataset.a, b); });
var op = marcos[0].closest('.op');
var ficha = null;
if (CFG.ficha) { ficha = document.createElement('section'); ficha.className = 'ag0-ficha'; ficha.setAttribute('aria-label', 'Especificación'); ficha.setAttribute('lang', 'es'); ficha.innerHTML = CFG.ficha; }
if (op) { op.querySelector('header').appendChild(tira); if (ficha) op.appendChild(ficha); }
else { marcos[0].parentNode.insertBefore(tira, marcos[0]); if (ficha) marcos[marcos.length - 1].parentNode.appendChild(ficha); }

/* ---- Vista 5: la otra versión de la Semana en teléfono, al lado del marco ---- */
if (CFG.gemelo && op) {
  var esc = op.querySelector('.esc'), lado = document.createElement('div'); lado.className = 'ag0-lado';
  esc.parentNode.insertBefore(lado, esc); lado.appendChild(esc);
  var gem = {};
  marcos.forEach(function (m) {
    var tp = m.querySelector('template.ag0-tplB'); if (!tp) return;
    var g = document.createElement('div'); g.className = 'ag0-gem'; g.style.display = 'none';
    var p = document.createElement('p'); p.textContent = tp.dataset.rotulo; g.appendChild(p);
    var mm = tp.content.firstElementChild.cloneNode(true); g.appendChild(mm); lado.appendChild(g);
    gem[m.dataset.vp] = g; todos.push(mm); liga(mm); ponScroll(mm);
  });
  var rot = document.createElement('p'); rot.className = 'ag0-rotA'; rot.style.cssText = 'margin:0 0 8px;font:600 13px/18px var(--fuente);color:var(--tinta2)';
  var cuadra = function () {
    var vp = (marcos.filter(function (m) { return m.style.display !== 'none'; })[0] || {}).dataset; vp = vp && vp.vp;
    Object.keys(gem).forEach(function (k) { gem[k].style.display = k === vp ? '' : 'none'; });
    var mv = marcos.filter(function (m) { return m.style.display !== 'none'; })[0];
    if (gem[vp] && mv) { var w = Math.round(mv.getBoundingClientRect().width) * 2 + 28; if (op.style.width !== w + 'px') op.style.width = w + 'px'; lado.style.width = w + 'px'; }
    else lado.style.width = '';
  };
  new MutationObserver(cuadra).observe(op, { attributes: true, attributeFilter: ['style'] });
  marcos.forEach(function (m) { new MutationObserver(cuadra).observe(m, { attributes: true, attributeFilter: ['style'] }); });
  cuadra();
}

marcos.forEach(function (m) { liga(m); ponScroll(m); });
tema();
new MutationObserver(tema).observe(raiz, { attributes: true, attributeFilter: ['class', 'data-theme'] });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', tema);
