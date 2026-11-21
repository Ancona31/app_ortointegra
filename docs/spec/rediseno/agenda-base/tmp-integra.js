/* Integración (kit/INTEGRACION.md): caminos de la vista Día y de 3 días a sus piezas reales. Corre dentro del IIFE de la base
   (usa marcos, abre, cierra). El guion de ag-burbuja (en su propio IIFE) lleva la burbuja, la de alta, las alertas y los avisos;
   el de ag-ligado (pegado arriba) lleva la ventana de ligar. Aquí: formulario (ag-form), herramientas (ag-herr) y navegación (cromo). */
var AFMAP = { 'd-editar': ['form', 'editar'], 'd-editar-conf': ['form', 'conf'], 'd-editar-ev': ['form', 'evedit'], 'd-reagendar': ['form', 'editar'],
  'd-reagendar-enl': ['form', 'reserva'], 'd-otra': ['form', 'lleno'], 'd-form': ['form', 'lleno'], 'd-form-editar': ['form', 'editar'], 'd-convertir': ['conv', null],
  'd-bloqueo': ['bq', 'bqedit'], 'd-bloqueo-alta': ['bq', 'bq'], 'fs': ['form', 'crear'], 'agendar': ['form', 'crear'], 'registro@tel': ['reg', null] };
/* El lápiz y «Editar» abren el formulario de esa cita: la variante sale del bloque (estado, evento, por ligar) */
var VAR_CITA = { j7: 'evedit', j8: 'reserva', j13: 'google', v2: 'reserva', l4: 'evedit', td1: 'evedit', j11: 'conf', j12: 'conf', v3: 'conf', v4: 'conf', s2: 'conf' };
marcos.forEach(function (m) {
  if (!m.classList.contains('ab')) return;
  var CR = 'cr4', ultima = null;
  var crCapa = m.querySelector('.' + CR + '-capa');
  function afCierra() { [].forEach.call(m.querySelectorAll('.af-capa.af-on'), function (c) { c.classList.remove('af-on'); c.setAttribute('aria-hidden', 'true'); }); m.classList.remove('af-vel'); }
  function afAbre(k, v) {
    afCierra(); cierra(m);
    var c = m.querySelector('.af-capa[data-capa="' + k + '"]'); if (!c) return;
    if (v) [].forEach.call(c.querySelectorAll('.af-var'), function (x) { x.hidden = x.dataset.m !== v; });
    c.classList.add('af-on'); c.setAttribute('aria-hidden', 'false'); m.classList.add('af-vel');
    var f = c.querySelector('.af-cj'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
  }
  m._afCierra = afCierra;
  function afVar(k) { var c = m.querySelector('.af-capa[data-capa="' + k + '"]'); var v = c && [].find.call(c.querySelectorAll('.af-var'), function (x) { return !x.hidden; }); return v ? v.dataset.m : ''; }
  function afVariante(k, v) { var c = m.querySelector('.af-capa[data-capa="' + k + '"]'); if (c && c.querySelector('.af-var[data-m="' + v + '"]')) [].forEach.call(c.querySelectorAll('.af-var'), function (x) { x.hidden = x.dataset.m !== v; }); }
  /* Lo que se pulsa dentro del formulario copiado de ag-form: lo mismo que hace su guion (selector de tipo, píldoras, interruptores, paciente, guardar) */
  function afDentro(t) {
    if (t.disabled || t.getAttribute('aria-disabled') === 'true') return;
    if (t.matches('[data-cierra]')) { afCierra(); return; }
    if (t.dataset.tipo) { if (t.dataset.tipo === 'bloqueo') afAbre('bq', 'bq'); else afVariante('form', t.dataset.tipo === 'evento' ? 'evento' : 'crear'); return; }
    if (t.classList.contains('af-sw')) { var on = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', String(on)); if (t.getAttribute('aria-label') === 'Todo el día') afVariante('form', on ? 'todo' : 'evento'); if (t.getAttribute('aria-label') === 'Días completos') afVariante('bq', on ? 'bqdias' : 'bq'); return; }
    if (t.getAttribute('role') === 'radio') { [].forEach.call(t.parentNode.children, function (x) { x.setAttribute('aria-checked', String(x === t)); }); return; }
    if (t.dataset.uno) { [].forEach.call(t.parentNode.children, function (x) { x.setAttribute('aria-pressed', String(x === t && x.getAttribute('aria-pressed') !== 'true')); }); return; }
    if (t.dataset.elige === 'pac') { afVariante('form', 'lleno'); return; }
    if (t.dataset.quita === 'pac') { if (afVar('form') === 'lleno') afVariante('form', 'crear'); return; }
    if (t.dataset.abre === 'reg') { afAbre('reg', null); return; }
    if (t.classList.contains('af-pil')) { var o2 = !t.classList.contains('af-pil-on'); [].forEach.call(m.querySelectorAll('.af-pil.af-pil-on'), function (x) { x.classList.remove('af-pil-on'); }); t.classList.toggle('af-pil-on', o2); return; }
    if (t.classList.contains('af-guardar')) { var crear = /crear|lleno|evento|todo/.test(afVar('form')); afCierra(); toast(m, crear ? 'Se agendó correctamente' : 'Cambios guardados'); return; }
    if (t.classList.contains('af-guardabq')) { afCierra(); toast(m, 'Horario bloqueado'); return; }
    if (t.dataset.quitabq) { afCierra(); toast(m, 'Bloqueo quitado'); return; }
    if (t.dataset.ligar) { afCierra(); var b0 = m.querySelector('.ag0-b[data-cita="' + (afVar('form') === 'google' ? 'j13' : 'j8') + '"]'); return; }
    if (t.dataset.noescita) { afCierra(); return; }
    if (t.closest('.af-pie,.af-al-b')) { afCierra(); return; }
  }
  m.addEventListener('input', function (e) {
    var i = e.target; if (!i.closest || !i.closest('.af-capa')) return;
    if (i.classList.contains('af-in-bus')) { var g = i.closest('.af-gr'); if (g) g.classList.toggle('af-bsq', i.value.trim().length >= 2); [].forEach.call(m.querySelectorAll('.af-eco'), function (x) { x.textContent = i.value.trim(); }); }
  });
  function crPon(l) { if (!crCapa) return; crCapa.dataset.k = l.join(' '); var on = l.length > 0; crCapa.classList.toggle(CR + '-on', on); crCapa.setAttribute('aria-hidden', String(!on)); }
  function crK() { return ((crCapa && crCapa.dataset.k) || '').split(' ').filter(Boolean); }
  /* El buscador y la campana de ag-herr: lo mínimo de su comportamiento (filtrar, ver sus citas, pestañas) */
  function norm(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function busPaso(p) { var b = m.querySelector('.ah-bus'); if (b) b.dataset.paso = p; }
  function busca(q) {
    var k = norm(q), n = 0; if (!k) { busPaso('vacio'); return; }
    [].forEach.call(m.querySelectorAll('.ah-res[data-de="q"] .ah-fr'), function (r) { var ok = norm(r.dataset.nom || '').indexOf(k) >= 0; r.hidden = !ok; if (ok) n++; });
    busPaso(n ? 'res' : 'sinres');
  }
  var inp = m.querySelector('.ah-bus input'); if (inp) inp.addEventListener('input', function () { busca(inp.value); });
  m.addEventListener('click', function (e) {
    if (e.target.classList && e.target.classList.contains('af-velo')) { afCierra(); return; }
    if (crCapa && e.target.classList && e.target.classList.contains(CR + '-velo')) { var l0 = crK(); l0.pop(); crPon(l0); return; }
    var t = e.target.closest('button,a'); if (!t || !m.contains(t)) return;
    /* Dentro del formulario copiado: cerrar, y el pie (Guardar, Cancelar…) cierra como al guardar */
    if (t.closest('.af-capa')) { afDentro(t); return; }
    /* Navegación (cromo): cajón, «Más», selector de consultorio y su confirmación */
    if (t.dataset.cromo) { e.preventDefault(); cierra(m); crPon(t.dataset.cromo === 'lista' && (m.dataset.vp === 'tel' || m.dataset.vp === 'iv') ? ['cajon', 'lista'] : [t.dataset.cromo]); return; }
    if (t.closest('.' + CR + '-capa')) {
      e.preventDefault();
      if (t.classList.contains(CR + '-abre-ls') || t.classList.contains(CR + '-cons-b')) { var l1 = crK().filter(function (x) { return x !== 'mas'; }); if (m.dataset.vp === 'ext') l1 = []; l1.push('lista'); crPon(l1); return; }
      if (t.classList.contains(CR + '-co')) {
        if (t.getAttribute('aria-checked') === 'true') { crPon(crK().filter(function (x) { return x !== 'lista'; })); return; }
        var n = m.querySelector('.' + CR + '-al-n'); if (n) n.textContent = t.dataset.c; m._crPend = t.dataset.c; var l2 = crK(); l2.push('alerta'); crPon(l2); return;
      }
      if (t.classList.contains(CR + '-al-no')) { crPon(crK().filter(function (x) { return x !== 'alerta'; })); return; }
      if (t.classList.contains(CR + '-al-si')) {
        var c = m._crPend; [].forEach.call(m.querySelectorAll('.' + CR + '-co'), function (b) { b.setAttribute('aria-checked', String(b.dataset.c === c)); });
        [].forEach.call(m.querySelectorAll('.ag0-cons-t b,.' + CR + '-cons-t b.' + CR + '-m,.' + CR + '-cons-n,.' + CR + '-mo-v'), function (x) { x.textContent = c; });
        crPon([]); var tt = m.querySelector('.' + CR + '-tst-t'); if (tt) { tt.textContent = 'Consultorio activo: ' + c; m.classList.add(CR + '-toast'); clearTimeout(m._crT); m._crT = setTimeout(function () { m.classList.remove(CR + '-toast'); }, 4000); }
        return;
      }
      if (t.classList.contains(CR + '-tst-x')) { m.classList.remove(CR + '-toast'); return; }
      if (t.classList.contains(CR + '-cierra') || t.tagName === 'A') { crPon([]); return; }
      if (t.classList.contains(CR + '-ap-cab')) { var pl = !m.classList.contains(CR + '-pleg'); m.classList.toggle(CR + '-pleg', pl); t.setAttribute('aria-expanded', String(!pl)); return; }
      return;
    }
    /* Formulario: «Agendar», «Bloquear horario», el bloqueo de la rejilla y los destinos de la burbuja */
    var k = t.dataset.ir || null;
    if (t.dataset.accion === 'agendar') k = 'agendar';
    if (t.dataset.bloquear) k = 'd-bloqueo-alta';
    if (t.matches('.ag0-bq[data-bloqueo]')) k = 'd-bloqueo';
    if (k === 'registro' && (m.dataset.vp === 'ext' || m.dataset.vp === 'tel')) k = 'registro@tel';
    if (k && AFMAP[k]) {
      var d = AFMAP[k], v = d[1];
      if ((k === 'd-editar' || k === 'd-reagendar') && ultima && VAR_CITA[ultima]) v = VAR_CITA[ultima];
      setTimeout(function () { afAbre(d[0], v); }, 0); return;
    }
    if (t.dataset.config || t.closest('.ag0-aviso.ag0-av-g') || t.closest('.ag0-ap')) { e.preventDefault(); cierra(m); return; } /* salen de la agenda */
    if (t.dataset.compactar) { setTimeout(function () { m.classList.toggle('ag0-avc', t.getAttribute('aria-checked') === 'true'); }, 0); return; }
    if (t.closest('.ag0-av-e')) { m.classList.remove('ag0-ave'); return; }
    if (t.closest('.ag0-av-c')) { m.classList.remove('ag0-avc'); var cp = m.querySelector('[data-compactar]'); if (cp) cp.setAttribute('aria-checked', 'false'); return; }
    /* Mes · Semana · 3 días · Día: la vista elegida está en esta misma página (Calendario): desplazamiento y realce */
    if (t.getAttribute('role') === 'tab' && t.closest('.ag0-seg')) {
      var pat = { mes: /(^|-)mes$/, semana: /semana/, tres: /tres-dias/, dia: /(^|-)dia$/ }[t.dataset.vista], yo = m.closest('.op');
      var dest = pat && [].find.call(document.querySelectorAll('.op'), function (o) { return o !== yo && pat.test(o.dataset.op); });
      if (dest) { var es = dest.querySelector('.esc'); dest.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        if (es) { es.style.transition = 'box-shadow 300ms ease-out'; es.style.boxShadow = '0 0 0 4px var(--enlace),0 20px 50px rgba(20,33,61,.25)'; setTimeout(function () { es.style.boxShadow = ''; }, 1800); } }
      return;
    }
    /* Buscador */
    if (t.dataset.limpia) { if (inp) { inp.value = ''; inp.focus(); } busPaso('vacio'); return; }
    if (t.dataset.pac) { [].forEach.call(m.querySelectorAll('.ah-res[data-de]'), function (x) { x.classList.toggle('ah-res-on', x.dataset.de === t.dataset.pac); }); busPaso(m.querySelector('.ah-res[data-de="' + t.dataset.pac + '"]') ? 'citas' : 'sincitas'); return; }
    if (t.dataset.volver) { busca(inp ? inp.value : ''); return; }
    if (t.dataset.salta || t.dataset.citaAv) { var id = t.dataset.salta || t.dataset.citaAv; cierra(m); var bl = m.querySelector('.ag0-b[data-cita="' + id + '"]'); if (bl) setTimeout(function () { bl.click(); }, 0); return; }
    /* Campana */
    if (t.dataset.tab) { [].forEach.call(t.parentNode.querySelectorAll('[data-tab]'), function (x) { x.setAttribute('aria-selected', String(x === t)); }); [].forEach.call(m.querySelectorAll('.ah-pan'), function (p) { p.hidden = p.dataset.pan !== t.dataset.tab; }); return; }
    if (t.dataset.todos) { var lst = m.querySelector('.ah-avl'); if (lst) lst.hidden = true; var va = m.querySelector('[data-vac="av"]'); if (va) va.hidden = false; return; }
    /* Mini mes (Ir a una fecha y panel del Día): elegir un día lleva a ese día */
    if (t.closest('.ag0-mm-g')) { [].forEach.call(t.parentNode.querySelectorAll('button'), function (x) { x.setAttribute('aria-selected', String(x === t)); }); if (t.closest('.ag0-capa')) cierra(m); return; }
    if (t.closest('.ag0-mm-c') && t.closest('.ag0-pd')) { return; }
  }, true);
  /* Las alertas copiadas traen un nombre de ejemplo: se escribe el de la cita que se está tocando */
  m.addEventListener('click', function (e) {
    var t = e.target.closest('[data-ir^="al-"]'); if (!t || !ultima) return;
    var b = m.querySelector('[data-cita="' + ultima + '"]'); if (!b) return;
    var nom = (b.getAttribute('aria-label') || '').split(',')[0];
    setTimeout(function () {
      var c = m.querySelector('.ag0-capa.ag0-on[data-capa="alerta"]'); if (!c) return;
      [].forEach.call(c.querySelectorAll('h2,p'), function (x) { x.textContent = x.textContent.replace(/Paciente Prueba \d\d/g, nom).replace(/«[^»]+»/, '«' + nom + '»'); });
    }, 30);
  });
  /* recuerda la cita de la burbuja abierta (para que el lápiz abra su variante del formulario) */
  m.addEventListener('click', function (e) { var b = e.target.closest('.ag0-b[data-cita],.ag0-tc[data-cita]'); if (b) ultima = b.dataset.cita; });
  m.addEventListener('keydown', function (e) { if (e.key === 'Escape') { if (m.querySelector('.af-capa.af-on')) afCierra(); else if (crK().length) { var l = crK(); l.pop(); crPon(l); } } });
});
