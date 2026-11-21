/* ---- Agenda · Ligado y Google (prefijo .al). Corre dentro del IIFE de la base: usa marcos, todos, abre, cierra, burbuja, tira, CFG. ---- */
var RM = matchMedia('(prefers-reduced-motion: reduce)');
function capaDe(m, k) { return m.querySelector('.ag0-capa[data-capa="' + k + '"]'); }
function tieneX(c, t) { return (' ' + (c.getAttribute('data-x') || '') + ' ').indexOf(' ' + t + ' ') >= 0; }
function ponPaso(m, paso, x, atras) {
  var c = capaDe(m, 'ligar'); if (!c) return;
  if (paso.indexOf('datos-') === 0) c.dataset.orig = paso.slice(6);
  c.dataset.paso = paso; c.setAttribute('data-x', x || '');
  [].forEach.call(c.querySelectorAll('.al-paso'), function (p) {
    var on = p.dataset.p === paso;
    if (on && !p.classList.contains('al-on')) { p.classList.remove('al-atras'); void p.offsetWidth; p.classList.add('al-on'); p.classList.toggle('al-atras', !!atras); var cu = p.querySelector('.al-cu'); if (cu) cu.scrollTop = 0; }
    else if (!on) p.classList.remove('al-on', 'al-atras');
  });
  var inp = c.querySelector('.al-bus .al-in'); if (inp && paso === 'buscar' && !tieneX(c, 'ligando')) inp.value = tieneX(c, 'res') ? inp.dataset.v2 : inp.dataset.v1;
  if (!c.classList.contains('ag0-on')) abre(m, 'ligar', null);
}
function ponX(m, k, x) { var c = capaDe(m, k); if (c) c.setAttribute('data-x', x); }
function destino(m, k) { cierra(m); var d = m.querySelector('.al-dest'); if (d) { d.dataset.d = k || 'nota'; [].forEach.call(d.querySelectorAll('nav [aria-label="Expediente"],nav .ag0-li,nav .ag0-pv'), function (x) { if (/Expediente/.test(x.getAttribute('aria-label') || x.textContent)) { if (d.dataset.d === 'perfil') x.removeAttribute('aria-current'); else x.setAttribute('aria-current', 'page'); } }); d.classList.add('al-on'); d.setAttribute('aria-hidden', 'false'); } }
function limpia(m) {
  var d = m.querySelector('.al-dest'); if (d) { d.classList.remove('al-on'); d.setAttribute('aria-hidden', 'true'); }
  var t = m.querySelector('.al-toast'); if (t) t.classList.remove('al-on');
}
var temporizadores = [];
function luego(ms, f) { temporizadores.push(setTimeout(f, ms)); }
function para() { temporizadores.forEach(clearTimeout); temporizadores = []; }
function toast(m, txt) {
  var t = m.querySelector('.al-toast'); if (!t) return;
  t.querySelector('.al-toast-t').textContent = txt; t.classList.remove('al-on'); void t.offsetWidth; t.classList.add('al-on');
}
function origen(m) { var c = capaDe(m, 'ligar'); return (c && c.dataset.orig) || 'r'; }
function alBuscar(m) {
  var g = origen(m) === 'g' ? ' goo' : '';
  ponPaso(m, 'buscar', 'bus' + g);
  luego(650, function () { ponPaso(m, 'buscar', 'sin' + g); });
}

/* ---- Lo que se pulsa dentro del marco (además de lo que ya hace la base) ---- */
marcos.forEach(function (m) {
  m.addEventListener('click', function (e) {
    var t = e.target.closest('[data-al]'); if (!t || !m.contains(t)) return;
    var a = t.dataset.al; e.preventDefault(); para();
    var g = origen(m) === 'g' ? ' goo' : '';
    if (a === 'ligar-r' || a === 'ligar-g') { cierra(m); ponPaso(m, 'datos-' + a.slice(6), ''); return; }
    if (a === 'buscar') { var c = capaDe(m, 'ligar'); if (c && c.dataset.paso === 'registro') { ponPaso(m, 'buscar', 'sin' + g, true); return; } alBuscar(m); return; }
    if (a === 'datos') { ponPaso(m, 'datos-' + origen(m), '', true); return; }
    if (a === 'registro') { var d = capaDe(m, 'dup'); if (d && d.classList.contains('ag0-on')) { d.classList.remove('ag0-on'); d.setAttribute('aria-hidden', 'true'); } ponPaso(m, 'registro', ''); return; }
    if (a === 'crear') { ponPaso(m, 'registro', 'registrando'); luego(900, function () { destino(m); }); return; }
    if (a === 'elegir') {
      var dp = capaDe(m, 'dup'); if (dp && dp.classList.contains('ag0-on')) { cierra(m); destino(m); return; }
      ponPaso(m, 'buscar', 'res ligando' + g); luego(900, function () { destino(m); }); return;
    }
    if (a === 'noes') { cierra(m); luego(RM.matches ? 0 : 260, function () { m.classList.add('al-hecho'); }); return; }
    if (a === 'noes-v') {
      var cl = capaDe(m, 'ligar'), x = cl.getAttribute('data-x') || '';
      cl.setAttribute('data-x', (x + ' noenv').trim());
      luego(600, function () { cierra(m); m.classList.add('al-hecho'); });
      return;
    }
    if (a === 'f-bloq' || a === 'f-desb') {
      var f = capaDe(m, 'form'), base = (f.getAttribute('data-x') || '').replace(/\b(bq|ocup|ferr)\b/g, '').trim();
      f.setAttribute('data-x', (base + ' ocup').trim());
      luego(600, function () { f.setAttribute('data-x', (base + (a === 'f-bloq' ? ' bq' : '')).trim()); });
      return;
    }
  });
  var inp = m.querySelector('.al-bus .al-in');
  if (inp) inp.addEventListener('input', function () {
    para(); var c = capaDe(m, 'ligar'), g = origen(m) === 'g' ? ' goo' : '';
    if (inp.value.trim().length < 2) { c.setAttribute('data-x', g.trim()); return; }
    c.setAttribute('data-x', 'bus' + g); luego(300 + 350, function () { c.setAttribute('data-x', 'res' + g); });
  });
  var vol = m.querySelector('.al-dest .al-volver');
  if (vol) vol.addEventListener('click', function (e) { e.preventDefault(); limpia(m); });
});

/* ---- Tira de maqueta: acciones propias «al:…» (la base ya hace bu:, modo:, clase:, cerrar) ---- */
tira.addEventListener('click', function (e) {
  var bt = e.target.closest('button'); if (!bt) return;
  var a = bt.dataset.a || ''; para();
  if (a === 'cerrar') { todos.forEach(function (m) { limpia(m); m.classList.remove('al-hecho'); }); return; }
  if (a.indexOf('modo:') === 0) { var md = a.slice(5); todos.forEach(function (m) { [].forEach.call(m.querySelectorAll('.ag0-seg [role="tab"]'), function (x) { x.setAttribute('aria-selected', String(x.dataset.vista === md)); }); }); return; }
  if (a.indexOf('al:') !== 0) return;
  var p = a.split(':');
  todos.forEach(function (m) {
    limpia(m);
    if (p[1] === 'p') { cierra(m); ponPaso(m, p[2], (p[3] || '').replace(/\+/g, ' ')); return; }
    if (p[1] === 'capa') { cierra(m); var c = capaDe(m, p[2]); if (!c) return; if (p[3]) c.dataset.f = p[3]; c.setAttribute('data-x', (p[4] || '').replace(/\+/g, ' ')); abre(m, p[2], null); return; }
    if (p[1] === 'dest') { destino(m); return; }
    if (p[1] === 'toast') { cierra(m); toast(m, p.slice(2).join(':')); return; }
    if (p[1] === 'bu') { cierra(m); m.classList.toggle('al-hecho', p[2] === 'ev13'); burbuja(m, p[2]); return; }
    if (p[1] === 'hecho') { cierra(m); m.classList.toggle('al-hecho', p[2] === '1'); return; }
  });
});

/* ===================== Integración: cada control lleva a su pieza real =====================
   · Piezas de la página «Cita» (burbuja, preguntas, alta, formulario, reagendar, evento y bloqueo): se baja a esa sección de la MISMA página,
     se realza y se abre el estado correspondiente pulsando su control de maqueta (INTEGRACION.md §3).
   · Piezas de Herramientas (campana, buscar, opciones, fecha, leyenda, atajos, médico): copiadas dentro del marco (ag-herr). */
function irA(suf, etq) {
  var ops = [].slice.call(document.querySelectorAll('section.op')).filter(function (o) { var d = o.dataset.op || ''; return d.slice(-suf.length) === suf; });
  var op = ops[0]; if (!op) return false;
  var bs = [].slice.call(op.querySelectorAll(':scope>header button'));
  if (etq) {
    var b = bs.filter(function (x) { return x.textContent.trim() === 'Maqueta: ' + etq; })[0] || bs.filter(function (x) { return x.textContent.indexOf(etq) >= 0; })[0];
    if (b) { if (b.getAttribute('aria-pressed') === 'true') b.click(); b.click(); }
  }
  op.scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth', block: 'start' });
  clearTimeout(op._alr); op.classList.remove('al-realce'); void op.offsetWidth; op.classList.add('al-realce');
  op._alr = setTimeout(function () { op.classList.remove('al-realce'); }, 1800);
  return true;
}
function irDe(m, s) { var p = s.split('|'); cierra(m); irA(p[0], p[1]); }
function abreDe(m, id, btn) {
  if (m.querySelector('template[data-bu="' + id + '"]')) { burbuja(m, id, btn); return; }
  var d = (CFG.mapa || {})[id]; if (d) { cierra(m); irA(d[0], d[1]); }
}
function marcaHecho(m) { cierra(m); luego(RM.matches ? 0 : 260, function () { m.classList.add('al-hecho'); }); }
function nrm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
function busPaso(m, p) { var b = m.querySelector('.ah-bus'); if (b) { b.dataset.paso = p; var i = b.querySelector('input'); if (i) i.setAttribute('aria-expanded', String(p === 'res' || p === 'citas')); } }
function busca(m, q) {
  var b = m.querySelector('.ah-bus'); if (!b) return; var k = nrm(q); if (!k) { busPaso(m, 'vacio'); return; }
  var n = 0; [].forEach.call(b.querySelectorAll('.ah-res[data-de="q"] .ah-fr'), function (r) { var ok = nrm(r.dataset.nom || '').indexOf(k) >= 0; r.hidden = !ok; if (ok) n++; });
  busPaso(m, n ? 'res' : 'sinres');
}
marcos.forEach(function (m) {
  m.addEventListener('click', function (e) {
    if (m._sinClic) return;
    var t = e.target.closest('button,a,.ag0-col'); if (!t || !m.contains(t)) return;
    var x;
    if ((x = t.closest('[data-ir]'))) { e.preventDefault(); para(); irDe(m, x.dataset.ir); return; }
    if (t.classList.contains('ag0-dia') && t.closest('[data-modo="semana"]')) {
      [].forEach.call(m.querySelectorAll('[data-modo]'), function (s) { var on = s.dataset.modo === 'dia'; s.style.display = on ? 'flex' : 'none'; s.classList.toggle('ag0-modo-on', on); });
      [].forEach.call(m.querySelectorAll('.ag0-seg [role="tab"]'), function (x) { x.setAttribute('aria-selected', String(x.dataset.vista === 'dia')); }); return;
    }
    if (t.dataset.al === 'dest-exp') { para(); destino(m, 'exp'); return; }
    if (t.dataset.al === 'dest-perfil') { e.preventDefault(); para(); destino(m, 'perfil'); return; }
    if (t.dataset.al === 'reint') { t.setAttribute('aria-busy', 'true'); t.disabled = true; luego(700, function () { t.disabled = false; t.removeAttribute('aria-busy'); }); return; }
    if (t.dataset.al === 'vercita') { para(); cierra(m); burbuja(m, 'j8n'); return; }
    if (t.dataset.accion === 'agendar') { e.preventDefault(); cierra(m); irA('form-cita', 'Nueva cita'); return; }
    if (t.dataset.bloquear) { e.preventDefault(); cierra(m); irA('form-evento-bloqueo', 'Bloquear horario'); return; }
    if (t.classList.contains('ag0-bq')) { cierra(m); irA('form-evento-bloqueo', 'Bloqueo de horario (editar)'); return; }
    if (t.classList.contains('ag0-tc') && !t.classList.contains('al-tcg')) { cierra(m); irA('burbuja-burbuja', t.classList.contains('ag0-tc--bq') ? 'bloqueo' : 'todo el día'); return; }
    if ((t.classList.contains('ag0-b') || t.classList.contains('ag0-lf')) && t.dataset.cita) {
      if (!m.querySelector('template[data-bu="' + t.dataset.cita + '"]')) abreDe(m, t.dataset.cita, t);
      else if (t.classList.contains('ag0-lf')) burbuja(m, t.dataset.cita, t);
      return;
    }
    if (t.classList.contains('ag0-col') && t.querySelector('.ag0-hueco')) { luego(RM.matches ? 0 : 350, function () { irA('burbuja-alta', 'tocar un hueco (19:00)'); }); return; }
    /* --- campana (pieza de Herramientas) --- */
    if (t.dataset.tab) {
      var cp = t.closest('.ag0-capa'); [].forEach.call(cp.querySelectorAll('.ah-tab'), function (b) { var on = b === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
      [].forEach.call(cp.querySelectorAll('[data-pan]'), function (p) { p.hidden = p.dataset.pan !== t.dataset.tab; }); return;
    }
    if (t.dataset.citaAv) {
      var li = t.closest('li'), id = t.dataset.citaAv; cierra(m);
      if (li) li.classList.add('ah-rev');
      if (id === 'j8') ponPaso(m, 'datos-r', ''); else if (id === 'j13') ponPaso(m, 'datos-g', ''); else abreDe(m, id);
      return;
    }
    if (t.dataset.noes) { var l2 = t.closest('li'); if (l2) l2.remove(); marcaHecho(m); return; }
    if (t.dataset.wa || t.dataset.co) {
      var f = t.closest('li'), pe = f && f.querySelector('.ah-pce'); if (!pe) return;
      var prev = pe.hidden ? [] : pe.textContent.split(' · ');
      prev.push(t.dataset.wa ? 'WhatsApp abierto 17:10' : 'Correo enviado 17:10'); pe.textContent = prev.join(' · '); pe.hidden = false;
      if (t.dataset.co) t.disabled = true; return;
    }
    if (t.dataset.marcar) { var fm = t.closest('li'); if (fm) fm.remove(); return; }
    if (t.dataset.todos) {
      var cp2 = t.closest('.ag0-capa'); [].forEach.call(cp2.querySelectorAll('.ah-avl>li'), function (x) { x.remove(); });
      var vv = cp2.querySelector('[data-vac="av"]'); if (vv) vv.hidden = false; t.closest('.ah-pie').hidden = true; return;
    }
    /* --- buscar (pieza de Herramientas) --- */
    if (t.dataset.pac) {
      var bb = m.querySelector('.ah-bus'); [].forEach.call(bb.querySelectorAll('.ah-res[data-de]'), function (r) { r.classList.toggle('ah-res-on', r.dataset.de === t.dataset.pac); });
      bb.querySelector('.ah-volver span').textContent = 'Paciente Prueba ' + t.dataset.pac;
      busPaso(m, bb.querySelector('.ah-res[data-de="' + t.dataset.pac + '"]') ? 'citas' : 'sincitas'); return;
    }
    if (t.dataset.volver) { busca(m, m.querySelector('.ah-bus input').value); return; }
    if (t.dataset.limpia) { var ii = m.querySelector('.ah-bus input'); ii.value = ''; busPaso(m, 'vacio'); ii.focus(); return; }
    if (t.dataset.salta) { cierra(m); abreDe(m, t.dataset.salta); return; }
    /* --- médico (computadora) e «Ir a una fecha» --- */
    if (t.classList.contains('ah-lbo')) { [].forEach.call(t.parentNode.children, function (o) { o.setAttribute('aria-selected', String(o === t)); }); cierra(m); return; }
    if (t.closest('[data-capa="fecha"] .ag0-mm-g')) { cierra(m); return; }
  });
  var qi = m.querySelector('.ah-bus input'); if (qi) qi.addEventListener('input', function () { busca(m, qi.value); });
});
tira.addEventListener('click', function (e) {
  var bt = e.target.closest('button'); if (!bt) return; var a = bt.dataset.a || '';
  if (a.indexOf('al:ir:') === 0) { var p = a.split(':'); todos.forEach(cierra); irA(p[2], p.slice(3).join(':')); }
  if (a === 'al:campana') todos.forEach(function (m) { abre(m, 'campana', m.querySelector('[data-campana]')); var tb = m.querySelector('[data-capa="campana"] [data-tab="av"]'); if (tb) tb.click(); });
});
