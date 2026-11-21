/* Agenda · Herramientas de la barra. Guion común; CFG = {v, ficha, tira, citas, titDia, titulos}. Solo actúa dentro de .ah.ah-vN.marco.
   Capas: las de la base (.ag0-capa) con su resorte de maqueta en CSS (linear(), interrumpible porque una transición CSS
   arranca del valor presente). En iPhone la hoja se arrastra: 1:1 con el dedo, rubber-band arriba, proyección de inercia
   (deceleración .998) para decidir si cierra; al soltar, resorte. En la app: el mismo modelo con un resorte de librería. */
var V = String(CFG.v), T0 = 7;
var marcos = [].slice.call(document.querySelectorAll('.ah.ah-v' + V + '.marco'));
if (!marcos.length) return;
var raiz = document.documentElement;
var RESORTE = 'linear(0,.009,.035,.075,.124,.181,.243,.305,.367,.427,.484,.537,.587,.632,.674,.711,.745,.776,.803,.828,.849,.868,.885,.9,.913,.925,.935,.944,.951,.958,.964,.969,.974,.977,.981,.984,.986,.988,.99,.992,.993,.994,.995,.996,.997,.998,1)';
function osc() { if (raiz.classList.contains('oscuro')) return true; if (raiz.classList.contains('claro')) return false; if (raiz.dataset.theme) return raiz.dataset.theme === 'dark'; return matchMedia('(prefers-color-scheme: dark)').matches; }
function tema() { var o = osc(); marcos.forEach(function (m) { m.classList.toggle('ag0-osc', o); }); }
function zoomDe(m) { var r = m.getBoundingClientRect(); return r.width / m.offsetWidth || 1; }
function RM(m) { return m.classList.contains('ah-rm') || matchMedia('(prefers-reduced-motion: reduce)').matches; }
function $(m, s) { return m.querySelector(s); }
function $$(m, s) { return [].slice.call(m.querySelectorAll(s)); }
function hm(x) { var h = Math.floor(x), mm = Math.round((x - h) * 60); return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }

/* ---- Título del periodo: la última palabra y su flecha van juntas (.ag0-nw), como en la base ---- */
function ponTit(m, t) {
  var tt = $(m, '.ag0-tit-t'); if (!tt) return;
  var nw = tt.querySelector('.ag0-nw'), svg = nw && nw.querySelector('svg'), p = t.split(' '), ult = p.pop();
  tt.textContent = p.join(' ') + ' ';
  var s = document.createElement('span'); s.className = 'ag0-nw'; s.textContent = ult; if (svg) s.appendChild(svg); tt.appendChild(s);
  var b = tt.closest('.ag0-tit'); if (b) b.setAttribute('aria-label', 'Ir a una fecha: ' + t);
}

/* ---- Desplazamiento inicial de la rejilla ---- */
function ponScroll(m) {
  $$(m, '.ag0-cal[data-scroll]').forEach(function (cal) {
    var c = cal.querySelector('.ag0-cuerpo'); if (!c) return;
    var fija = function () { if (c.clientHeight > 0 && !c.dataset.listo) { var h = parseFloat(getComputedStyle(cal).getPropertyValue('--cal-h')) || 80; c.scrollTop = (parseFloat(cal.dataset.scroll) - T0) * h; c.dataset.listo = '1'; } };
    new ResizeObserver(fija).observe(c); fija();
  });
}

/* ---- Capas ---- */
function capaAbierta(m) { return m.querySelector('.ag0-capa.ag0-on'); }
function cierra(m, sinFoco) {
  if (m._afCierra) m._afCierra();
  if (typeof huecoAh === 'function') huecoAh(m, null);
  $$(m, '.ag0-capa.ag0-on').forEach(function (c) {
    var cj = c.querySelector('.ag0-cj'); cj.style.transition = ''; cj.style.transform = ''; cj.style.opacity = '';
    c.classList.remove('ag0-on'); c.setAttribute('aria-hidden', 'true');
    if (c._btn) { c._btn.setAttribute('aria-expanded', 'false'); if (!sinFoco) try { c._btn.focus({ preventScroll: true }); } catch (e) {} c._btn = null; }
  });
  $$(m, '.ag0-b[aria-expanded="true"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
}
function ancla(m, capa, btn) {
  var cj = capa.querySelector('.ag0-cj'); if (!cj || !cj.classList.contains('ag0-anc') || !btn) return;
  var z = zoomDe(m), mr = m.getBoundingClientRect(), b = btn.getBoundingClientRect();
  var x0 = (b.left - mr.left) / z, x1 = (b.right - mr.left) / z, y1 = (b.bottom - mr.top) / z;
  var w = cj.offsetWidth || 288, izq = cj.classList.contains('ag0-anc-i');
  var left = izq ? x0 : x1 - w; left = Math.max(12, Math.min(left, m.offsetWidth - w - 12));
  cj.style.left = left + 'px'; cj.style.top = (y1 + 6) + 'px';
  cj.style.maxHeight = (m.offsetHeight - y1 - 18) + 'px';
  cj.style.transformOrigin = (izq ? '16px' : (w - 16) + 'px') + ' 0';
}
function abre(m, key, btn) {
  var capa = m.querySelector('[data-capa="' + key + '"]'); if (!capa) return false;
  var previo = capaAbierta(m), btnPrevio = previo && previo._btn;
  cierra(m, true);
  if (!btn && btnPrevio) btn = btnPrevio; /* abrir desde un menú: el foco vuelve al botón del menú (como hoy, el engrane) */
  capa.classList.add('ag0-on'); capa.setAttribute('aria-hidden', 'false');
  if (btn) { if (!btn.closest('.ag0-capa')) btn.setAttribute('aria-expanded', 'true'); capa._btn = btn.closest('.ag0-capa') ? btnPrevio : btn; ancla(m, capa, capa._btn || btn); }
  var f = capa.querySelector('.ag0-cj [data-foco]') || capa.querySelector('.ag0-cj input') || capa.querySelector('.ag0-cj [aria-selected="true"][role="tab"]') || capa.querySelector('.ag0-cj [role="switch"]') || capa.querySelector('.ag0-cj [aria-current="date"]') || capa.querySelector('.ag0-cj [role^="menuitem"]') || capa.querySelector('.ag0-cj button');
  if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
  return true;
}
function burbuja(m, id, btn) {
  var t = m.querySelector('template[data-bu="' + id + '"]'), capa = m.querySelector('[data-capa="burbuja"]');
  if (!t || !capa) return;
  var h = capa.querySelector('.ag0-bu-h'); h.innerHTML = ''; h.appendChild(t.content.cloneNode(true));
  abre(m, 'burbuja', null);
  var b = btn || m.querySelector('.ah-dv[style*="flex"] .ag0-b[data-cita="' + id + '"]') || m.querySelector('.ag0-b[data-cita="' + id + '"]');
  if (b) { b.setAttribute('aria-expanded', 'true'); capa._btn = b; }
}
function toast(m, texto, tono) {
  var t = m.querySelector('.ah-toast'); if (!t) return;
  t.querySelector('span').textContent = texto;
  var i = t.querySelector('i'); i.className = tono || ''; i.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  t.classList.add('ah-on'); clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove('ah-on'); }, 3200);
}

/* ---- Hoja arrastrable (solo iPhone) ---- */
function rubber(o, d) { var c = .55; return o * d * c / (d + c * Math.abs(o)); }
function arrastre(m) {
  if (m.dataset.vp !== 'tel') return;
  var d = null;
  m.addEventListener('pointerdown', function (e) {
    var cj = e.target.closest('.ag0-capa.ag0-on .ag0-cj'); if (!cj || e.button > 0) return;
    if (!e.target.closest('.ag0-asa,.ag0-cjc,.ah-tabs') || e.target.closest('input,.ag0-x')) return;
    d = { cj: cj, id: e.pointerId, y0: e.clientY, act: false, h: [[e.timeStamp, e.clientY]] };
  });
  m.addEventListener('pointermove', function (e) {
    if (!d || e.pointerId !== d.id) return; var z = zoomDe(m), dy = (e.clientY - d.y0) / z;
    if (!d.act) { if (Math.abs(dy) < 10) return; d.act = true; d.y0 = e.clientY; dy = 0; d.cj.style.transition = 'none'; try { d.cj.setPointerCapture(e.pointerId); } catch (_) {} }
    var y = dy < 0 ? -rubber(-dy, 80) : dy;
    if (RM(m)) d.cj.style.opacity = String(Math.max(0, 1 - y / d.cj.offsetHeight)); else d.cj.style.transform = 'translateY(' + y.toFixed(1) + 'px)';
    d.y = y; d.h.push([e.timeStamp, e.clientY]); if (d.h.length > 6) d.h.shift(); e.preventDefault();
  });
  function suelta(e) {
    if (!d || e.pointerId !== d.id) return; var dd = d; d = null; if (!dd.act) return;
    var z = zoomDe(m), a = dd.h[0], b = dd.h[dd.h.length - 1], vy = (b[1] - a[1]) / z / Math.max(.016, (b[0] - a[0]) / 1000);
    if (e.timeStamp - b[0] > 90) vy = 0;
    var proy = (dd.y || 0) + vy / 1000 * .998 / (1 - .998), H = dd.cj.offsetHeight;
    if (proy > H * .5) {
      dd.cj.style.transition = RM(m) ? 'opacity 150ms ease' : 'transform 220ms cubic-bezier(.3,0,.8,.15)';
      if (RM(m)) dd.cj.style.opacity = '0'; else dd.cj.style.transform = 'translateY(' + H + 'px)';
      setTimeout(function () { cierra(m); }, 230);
    } else {
      dd.cj.style.transition = 'transform ' + (Math.abs(vy) > 300 ? 420 : 520) + 'ms ' + RESORTE + ',opacity 200ms ease';
      dd.cj.style.transform = ''; dd.cj.style.opacity = '';
    }
    m._sinClic = true; setTimeout(function () { m._sinClic = false; }, 0);
  }
  m.addEventListener('pointerup', suelta); m.addEventListener('pointercancel', suelta);
}

/* ---- Buscar citas de un paciente ---- */
function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
function paso(m, p) { var b = $(m, '.ah-bus'); if (!b) return; b.dataset.paso = p; var i = b.querySelector('input'); i.setAttribute('aria-expanded', String(p === 'res' || p === 'citas')); limpiaSel(m); }
function limpiaSel(m) { $$(m, '.ah-fr[aria-selected="true"]').forEach(function (x) { x.setAttribute('aria-selected', 'false'); }); var i = $(m, '.ah-bus input'); if (i) i.removeAttribute('aria-activedescendant'); }
function busca(m, q) {
  var b = $(m, '.ah-bus'); if (!b) return; var i = b.querySelector('input'); i.value = q;
  var k = norm(q); if (!k) { paso(m, 'vacio'); return; }
  var n = 0, pri = null;
  $$(m, '.ah-res[data-de="q"] .ah-fr').forEach(function (r) { var ok = norm(r.dataset.nom || '').indexOf(k) >= 0; r.hidden = !ok; r.classList.remove('ah-pri'); if (ok) { n++; if (!pri) pri = r; } });
  if (pri) pri.classList.add('ah-pri');
  paso(m, n ? 'res' : 'sinres');
}
function elegirPaciente(m, nn) {
  var b = $(m, '.ah-bus'); $$(m, '.ah-res[data-de]').forEach(function (x) { x.classList.toggle('ah-res-on', x.dataset.de === nn); });
  b.querySelector('.ah-volver span').textContent = 'Paciente Prueba ' + nn;
  paso(m, m.querySelector('.ah-res[data-de="' + nn + '"]') ? 'citas' : 'sincitas');
}
function salta(m, id) {
  var c = CFG.citas[id]; if (!c) return;
  cierra(m, true);
  var dvs = $$(m, '.ah-dv');
  if (dvs.length) dvs.forEach(function (x) { x.style.display = String(x.dataset.dv) === String(c.d) ? 'flex' : 'none'; });
  var tt = $(m, '.ag0-tit-t'), k = (m.dataset.vp === 'ext' || m.dataset.vp === 'tel') ? 'tel' : 'ancho';
  ponTit(m, CFG.titDia[c.d][k]);
  var cal = dvs.length ? m.querySelector('.ah-dv[data-dv="' + c.d + '"] .ag0-cal') : m.querySelector('.ag0-cal'), cu = cal && cal.querySelector('.ag0-cuerpo');
  if (cu) { var h = parseFloat(getComputedStyle(cal).getPropertyValue('--cal-h')) || 80; cu.dataset.listo = '1'; cu.scrollTo({ top: Math.max(0, (c.a - T0 - .6) * h), behavior: RM(m) ? 'auto' : 'smooth' }); }
  setTimeout(function () { burbuja(m, id); }, RM(m) ? 60 : 420);
}

/* ---- Campana ---- */
function pestana(m, k) {
  $$(m, '.ah-tab').forEach(function (t) { var on = t.dataset.tab === k; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
  $$(m, '.ah-pan').forEach(function (p) { p.hidden = p.dataset.pan !== k; });
}
function cuentaCampana(m) {
  var n = $$(m, '.ah-pcf:not([hidden])').length, a = $$(m, '.ah-avi').filter(function (x) { return !x.hidden && getComputedStyle(x).display !== 'none'; }).length;
  var sn = $(m, '[data-n="pc"]'), sa = $(m, '[data-n="av"]'); if (sn) sn.textContent = n; if (sa) sa.textContent = a;
  var vpc = $(m, '[data-vac="pc"]'), vav = $(m, '[data-vac="av"]'), ley = $(m, '[data-ley]'), pie = $(m, '.ah-pie');
  if (vpc) vpc.hidden = n > 0; if (ley) ley.style.display = n ? '' : 'none'; if (vav) vav.hidden = a > 0; if (pie) pie.hidden = a === 0;
  var t = n + a, bt = $(m, '[data-campana]');
  if (bt) { var c = bt.querySelector('.ag0-cnt'); if (c) { c.textContent = t > 9 ? '9+' : String(t); c.style.display = t ? '' : 'none'; }
    bt.setAttribute('aria-label', 'Por confirmar (' + n + ') y avisos (' + a + ')' + (t ? ': ' + t + ' ' + (t === 1 ? 'pendiente' : 'pendientes') : '')); }
}
function resetCampana(m) {
  m.classList.remove('ah-avtodos');
  $$(m, '.ah-pcf').forEach(function (f) { f.hidden = false; f.classList.remove('ah-sinm'); var e = f.querySelector('.ah-pce'); e.hidden = true; e.textContent = ''; f._wa = f._co = '';
    $$(f, '.ah-ib').forEach(function (b) { b.disabled = false; }); });
  $$(m, '.ah-avi').forEach(function (x) { x.hidden = false; });
  pestana(m, 'pc'); cuentaCampana(m);
}
function estadoFila(f) { var e = f.querySelector('.ah-pce'), p = [f._wa, f._co].filter(Boolean); e.textContent = p.join(' · '); e.hidden = !p.length; }

/* ---- Tarjeta al pasar el ratón (computadora) ---- */
function tlp(m, b) {
  var t = $(m, '.ah-tlp'); if (!t) return;
  var tpl = m.querySelector('template[data-bu="' + b.dataset.cita + '"]'); if (!tpl) return;
  t.innerHTML = ''; t.appendChild(tpl.content.cloneNode(true));
  $$(t, '.ag0-x[data-cierra]').forEach(function (x) { x.removeAttribute('data-cierra'); x.dataset.tlpx = '1'; });
  var z = zoomDe(m), mr = m.getBoundingClientRect(), r = b.getBoundingClientRect();
  var x = (r.left - mr.left) / z + Math.min(r.width / z, 360) * .5, y = (r.top - mr.top) / z;
  var w = 360, h = t.offsetHeight || 380; x = Math.min(x, m.offsetWidth - w - 16); y = Math.max(16, Math.min(y, m.offsetHeight - h - 16));
  t.style.left = x + 'px'; t.style.top = y + 'px'; t.classList.add('ah-on'); t._b = b;
}
function tlpFuera(m) { var t = $(m, '.ah-tlp'); if (t) { t.classList.remove('ah-on'); t._b = null; } }

/* ---- Interacción por marco ---- */
function liga(m) {
  arrastre(m);
  /* El marco recorta (overflow:hidden): un foco dentro de una capa que aún entra no debe desplazarlo */
  m.addEventListener('scroll', function () { if (m.scrollTop || m.scrollLeft) { m.scrollTop = 0; m.scrollLeft = 0; } });
  m.addEventListener('click', function (e) {
    if (m._sinClic) { e.preventDefault(); e.stopPropagation(); return; }
    var t = e.target.closest('button,a,[data-cierra]'); if (!t || !m.contains(t)) return;
    if (t.closest('.af-capa,.af-toast,.af-velo')) return;
    if (t.tagName === 'A') e.preventDefault();
    if (t.dataset.tlpx) { tlpFuera(m); return; }
    if (t.matches('[data-cierra]')) { cierra(m); return; }
    if (t.dataset.abre) {
      var k = t.dataset.abre, cur = capaAbierta(m);
      if (cur && cur.dataset.capa === k && !t.closest('.ag0-capa')) { cierra(m); return; }
      if (k === 'buscar') { busca(m, ''); }
      if (k === 'campana') { resetCampana(m); }
      abre(m, k, t); return;
    }
    if (t.dataset.sub !== undefined) { var s = t.nextElementSibling; var on = !s.classList.contains('ag0-on'); s.classList.toggle('ag0-on', on); t.setAttribute('aria-expanded', String(on)); return; }
    if (t.dataset.sw) { t.setAttribute('aria-checked', String(t.getAttribute('aria-checked') !== 'true'));
      if (t.dataset.densidad) m.classList.toggle('ag0-densa-m', t.getAttribute('aria-checked') === 'true');
      if (t.classList.contains('ah-atsw')) m.classList.toggle('ah-atoff', t.getAttribute('aria-checked') !== 'true');
      return; }
    if (t.dataset.med) { eligeMedico(m, t.dataset.med); if (t.classList.contains('ah-lbo')) cierra(m); return; }
    if (t.getAttribute('role') === 'menuitemradio') { [].forEach.call(t.parentNode.children, function (x) { x.setAttribute('aria-checked', String(x === t)); }); return; }
    if (t.classList.contains('ah-hds')) { var on2 = t.getAttribute('aria-checked') !== 'true'; t.setAttribute('aria-checked', String(on2)); t.closest('.ah-hd').classList.toggle('ah-off', !on2); return; }
    if (t.dataset.guardar) { guarda(m, t); return; }
    if (t.dataset.plegar) { plegar(m); return; }
    if (t.dataset.limpia) { busca(m, ''); $(m, '.ah-bus input').focus(); return; }
    if (t.dataset.volver) { busca(m, $(m, '.ah-bus input').value); $(m, '.ah-bus input').focus(); return; }
    if (t.dataset.pac) { elegirPaciente(m, t.dataset.pac); $(m, '.ah-bus input').focus(); return; }
    if (t.dataset.salta) { salta(m, t.dataset.salta); return; }
    if (t.dataset.tab) { pestana(m, t.dataset.tab); return; }
    if (t.dataset.wa) { var f = t.closest('.ah-pcf'); f._wa = 'WhatsApp abierto ' + hm(17 + 10 / 60); estadoFila(f); return; }
    if (t.dataset.co) { var f2 = t.closest('.ah-pcf'); f2._co = 'Correo enviado ' + hm(17 + 10 / 60); t.disabled = true; estadoFila(f2); return; }
    if (t.dataset.marcar) { t.closest('.ah-pcf').hidden = true; cuentaCampana(m); return; }
    if (t.dataset.noes) { t.closest('.ah-avi').hidden = true; cuentaCampana(m); return; }
    if (t.dataset.todos) { $$(m, '.ah-avi').forEach(function (x) { x.hidden = true; }); cuentaCampana(m); return; }
    if (t.dataset.citaAv) { var li = t.closest('.ah-avi'); li.hidden = true; cuentaCampana(m); var id = t.dataset.citaAv; cierra(m, true); setTimeout(function () { burbuja(m, id); }, 60); return; }
    if (t.closest('.ag0-capa[data-capa="fecha"]') && t.closest('.ag0-mm-g')) { eligeFecha(m, t); return; }
    if (t.matches('.ag0-b,.ag0-tc') && t.dataset.cita && !t.closest('.ag0-capa')) { tlpFuera(m); burbuja(m, t.dataset.cita, t); return; }
    if (t.getAttribute('role') === 'tab' && t.closest('.ag0-seg')) { ponVista(m, t.dataset.vista); return; }
  });
  m.addEventListener('input', function (e) { if (e.target.closest('.ah-bus')) busca(m, e.target.value); });
  m.addEventListener('keydown', function (e) {
    var bus = e.target.closest && e.target.closest('.ah-bus');
    if (bus && e.target.tagName === 'INPUT') {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (e.target.value || bus.dataset.paso === 'citas' || bus.dataset.paso === 'sincitas') busca(m, ''); else cierra(m); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        var vis = $$(m, '.ah-bus[data-paso="res"] .ah-res[data-de="q"] .ah-fr:not([hidden]), .ah-bus[data-paso="citas"] .ah-res-on .ah-fr');
        if (!vis.length) return; e.preventDefault();
        var i = vis.findIndex(function (x) { return x.getAttribute('aria-selected') === 'true'; });
        if (e.key === 'Enter') { if (i >= 0) vis[i].click(); return; }
        i = e.key === 'ArrowDown' ? (i + 1) % vis.length : (i - 1 + vis.length) % vis.length;
        vis.forEach(function (x, j) { x.setAttribute('aria-selected', String(j === i)); });
        vis[i].scrollIntoView({ block: 'nearest' }); return;
      }
    }
    if (e.key === 'Escape') { tlpFuera(m); cierra(m); return; }
    var tl = e.target.closest && e.target.closest('[role="tablist"]');
    if (tl && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { var tabs = $$(tl, '[role="tab"]'), j = tabs.indexOf(e.target); var nx = tabs[(j + 1) % tabs.length]; if (nx.dataset.tab) { pestana(m, nx.dataset.tab); nx.focus(); e.preventDefault(); } }
    var menu = e.target.closest && e.target.closest('[role="menu"]');
    if (menu && /^(ArrowDown|ArrowUp|Home|End)$/.test(e.key)) {
      var its = $$(menu, '[role^="menuitem"]').filter(function (x) { return x.offsetParent !== null; }), k2 = its.indexOf(e.target);
      var to = e.key === 'Home' ? 0 : e.key === 'End' ? its.length - 1 : e.key === 'ArrowDown' ? (k2 + 1) % its.length : (k2 - 1 + its.length) % its.length;
      its[to].focus(); e.preventDefault();
    }
  });
  /* Tarjeta al pasar el ratón: solo con puntero fino y «Pop-up de eventos» encendido */
  if (m.dataset.vp === 'esc' && $(m, '.ah-tlp')) {
    var timer = 0;
    m.addEventListener('pointerover', function (e) {
      if (e.pointerType !== 'mouse') return;
      var b = e.target.closest('.ag0-b'), t = $(m, '.ah-tlp');
      if (e.target.closest('.ah-tlp')) { clearTimeout(timer); return; }
      if (!b) { clearTimeout(timer); timer = setTimeout(function () { tlpFuera(m); }, 220); return; }
      var pop = $(m, '[data-capa="menu"] [role="menuitemcheckbox"]:not([data-compactar]):not([data-densidad])');
      if (capaAbierta(m) || (pop && pop.getAttribute('aria-checked') !== 'true') || (t._b === b && t.classList.contains('ah-on'))) return;
      clearTimeout(timer); timer = setTimeout(function () { tlp(m, b); }, 400);
    });
  }
}
function eligeMedico(m, k) {
  m.classList.toggle('ag0-sinmed', k === 'todos');
  $$(m, '[data-med]').forEach(function (x) { if (x.getAttribute('role') === 'option') x.setAttribute('aria-selected', String(x.dataset.med === k)); else x.setAttribute('aria-checked', String(x.dataset.med === k)); });
  var b = $(m, '.ag0-med'); if (b) b.setAttribute('aria-label', 'Filtrar por médico: ' + (k === 'todos' ? 'Todos los médicos' : k === 'is' ? 'Dra. Invitada Semilla' : 'Dr. Admin Semilla'));
  if (k === 'is') { var mn = $$(m, '.ag0-med .ag0-mn'); if (mn.length) { mn[0].textContent = 'IS'; mn[1].textContent = 'Dra. Invitada Semilla'; } }
  else if (k === 'as') { var mn2 = $$(m, '.ag0-med .ag0-mn'); if (mn2.length) { mn2[0].textContent = 'AS'; mn2[1].textContent = 'Dr. Admin Semilla'; } }
  var sm = $(m, '.ah-medn'); if (sm) sm.textContent = k === 'is' ? 'Dra. Invitada Semilla' : 'Dr. Admin Semilla';
}
function ponVista(m, v) {
  $$(m, '.ag0-seg [role="tab"]').forEach(function (x) { x.setAttribute('aria-selected', String(x.dataset.vista === v)); });
  m.classList.toggle('ah-mes', v === 'mes'); m.classList.toggle('ah-semana', v === 'semana');
  var tt = $(m, '.ag0-tit-t'), k = (m.dataset.vp === 'ext' || m.dataset.vp === 'tel') ? 'tel' : 'ancho'; if (CFG.titulos) ponTit(m, CFG.titulos[v][k]);
}
function eligeFecha(m, b) {
  var n = parseInt(b.textContent, 10); if (b.classList.contains('ag0-fuera-m') || !n) return;
  $$(m, '[data-capa="fecha"] .ag0-mm-g button').forEach(function (x) { x.removeAttribute('aria-selected'); });
  b.setAttribute('aria-selected', 'true');
  var d = new Date(2026, 10, n), dl = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][d.getDay()];
  var tt = $(m, '.ag0-tit-t'), tel = m.dataset.vp === 'ext' || m.dataset.vp === 'tel';
  setTimeout(function () { cierra(m); ponTit(m, tel ? dl.slice(0, 3) + ', ' + n + ' de noviembre' : dl + ', ' + n + ' de noviembre de 2026'); }, 120);
}
function guarda(m, b) {
  if (b.disabled) return; b.disabled = true; b.textContent = 'Guardando...';
  setTimeout(function () { b.disabled = false; b.textContent = 'Guardar horario'; if (m._soloGuardando) return; cierra(m); toast(m, 'Horario actualizado'); }, 900);
}
function envuelveTexto(a) {
  [].slice.call(a.childNodes).forEach(function (n) {
    if (n.nodeType !== 3 || !n.textContent.trim()) return;
    var sp = document.createElement('span'); sp.className = 'ah-lt'; sp.textContent = n.textContent;
    n.parentNode.insertBefore(sp, n); n.textContent = '';
  });
}
function plegar(m) {
  if (m.dataset.vp !== 'esc') return;
  var on = !m.classList.contains('ah-plegada'), b = $(m, '[data-plegar]');
  var cambia = function () {
    m.classList.toggle('ah-plegada', on);
    b.setAttribute('aria-expanded', String(!on));
    var plg = b.querySelector('.ah-plg'), des = b.querySelector('.ah-desp');
    if (!des.innerHTML) des.innerHTML = plg.innerHTML.replace('M15.5 10l-2 2 2 2', 'M13.5 10l2 2-2 2').replace('Plegar menú', 'Desplegar menú');
    plg.style.display = on ? 'none' : 'contents'; des.style.display = on ? 'contents' : 'none';
    $$(m, '.ag0-lat .ag0-li').forEach(function (a) { envuelveTexto(a); if (on) { a.dataset.al = a.dataset.al || a.textContent.trim(); a.setAttribute('aria-label', a.dataset.al); } else if (a.dataset.al && !a.dataset.pleg0) a.removeAttribute('aria-label'); });
    b.setAttribute('aria-label', on ? 'Desplegar menú' : 'Plegar menú');
    $$(m, '.ag0-cuerpo').forEach(function (c) { c.dataset.listo = ''; }); ponScroll(m);
  };
  if (RM(m)) { cambia(); return; }
  m.classList.add('ah-pleg-anim'); requestAnimationFrame(function () { cambia(); requestAnimationFrame(function () { m.classList.remove('ah-pleg-anim'); }); });
}

/* ---- Tira de maqueta (fuera del marco) y ficha ---- */
function visibles() { return marcos.filter(function (m) { return m.style.display !== 'none'; }); }
function acciona(a, b) {
  var todos = marcos;
  if (a === 'cerrar') { todos.forEach(function (m) { cierra(m, true); tlpFuera(m); }); return; }
  if (a.indexOf('clase:') === 0) { var k = a.slice(6), on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); todos.forEach(function (m) {
      m.classList.toggle(k, on);
      var g = m.querySelector('[data-guardar]'); if (g) g.disabled = m.classList.contains('ah-hor-err') || m.classList.contains('ah-hor-car');
      if (!on) return;
      /* Estados de una capa: se ven con la capa abierta */
      if (k === 'ah-cargando' || k === 'ah-avsin') { if (!capaAbierta(m)) { resetCampana(m); abre(m, 'campana', m.querySelector('[data-campana]')); } if (k === 'ah-avsin') pestana(m, 'av'); }
      if (k.indexOf('ah-hor-') === 0 && !capaAbierta(m)) abre(m, 'horario', null);
      if (k === 'ag0-sinhor' && m.querySelector('[data-capa="huecos"]') && !capaAbierta(m)) abre(m, 'huecos', null);
    }); return; }
  todos.forEach(function (m) {
    var vp = m.dataset.vp;
    if (a.indexOf('abre:') === 0) {
      var k = a.slice(5), btn = m.querySelector('.ag0-barra [data-abre="' + k + '"]') || m.querySelector('.ag0-barra [data-abre="menu"]');
      if (k === 'buscar') busca(m, ''); if (k === 'campana') resetCampana(m);
      if ((k === 'huecos' || k === 'atajos' || k === 'leyenda') && !m.querySelector('.ag0-barra [data-abre="' + k + '"]')) { abre(m, 'menu', m.querySelector('.ag0-barra [data-abre="menu"]')); }
      if (!m.querySelector('[data-capa="' + k + '"]')) { cierra(m, true); return; }
      abre(m, k, k === 'horario' || k === 'huecos' || k === 'atajos' ? null : btn);
      if ((k === 'leyenda' || k === 'atajos' || k === 'huecos') && m.querySelector('[data-capa="' + k + '"]')._btn == null) { var eng = m.querySelector('.ag0-barra [data-abre="menu"]'); var c = m.querySelector('[data-capa="' + k + '"]'); c._btn = eng; ancla(m, c, eng); }
      return;
    }
    if (a.indexOf('q:') === 0) { if (!(capaAbierta(m) || {}).dataset || capaAbierta(m).dataset.capa !== 'buscar') abre(m, 'buscar', m.querySelector('.ag0-barra [data-abre="buscar"]') || m.querySelector('.ag0-barra [data-abre="menu"]')); busca(m, a.slice(2)); return; }
    if (a.indexOf('pac:') === 0) { acciona('q:prueba ' + a.slice(4), b); setTimeout(function () { elegirPaciente(m, a.slice(4)); }, 0); return; }
    if (a.indexOf('salta:') === 0) { salta(m, a.slice(6)); return; }
    if (a === 'tab:av') { if (!capaAbierta(m)) { resetCampana(m); abre(m, 'campana', m.querySelector('[data-campana]')); } pestana(m, 'av'); return; }
    if (a === 'avtodos') { resetCampana(m); abre(m, 'campana', m.querySelector('[data-campana]')); m.classList.add('ah-avtodos'); pestana(m, 'av'); cuentaCampana(m); return; }
    if (a === 'enviado') { resetCampana(m); abre(m, 'campana', m.querySelector('[data-campana]')); var f = m.querySelector('.ah-pcf'); f._wa = 'WhatsApp abierto 17:10'; f._co = 'Correo enviado 17:10'; f.querySelector('[data-co]').disabled = true; estadoFila(f); return; }
    if (a === 'sinmedios') { resetCampana(m); abre(m, 'campana', m.querySelector('[data-campana]')); m.querySelectorAll('.ah-pcf')[1].classList.add('ah-sinm'); return; }
    if (a === 'vacio') { resetCampana(m); $$(m, '.ah-pcf').forEach(function (x) { x.hidden = true; }); $$(m, '.ah-avi').forEach(function (x) { x.hidden = true; }); cuentaCampana(m); abre(m, 'campana', m.querySelector('[data-campana]')); return; }
    if (a === 'toast') { cierra(m, true); var t = m.querySelector('.ah-toast i'); toast(m, 'Nueva reserva por enlace para el jueves, 19 de noviembre a las 14:00.'); return; }
    if (a === 'sub') { abre(m, 'menu', m.querySelector('.ag0-barra [data-abre="menu"]')); var s = m.querySelector('[data-capa="menu"] [data-sub="med"]'); if (s && s.getAttribute('aria-expanded') !== 'true') s.click(); return; }
    if (a.indexOf('vista:') === 0) { ponVista(m, a.slice(6)); return; }
    if (a === 'tlp') { if (vp !== 'esc') return; cierra(m, true); var bb = m.querySelector('.ag0-b[data-cita="j10"]'); if (bb) tlp(m, bb); return; }
    if (a === 'atoff') { if (vp !== 'esc') return; abre(m, 'atajos', null); var sw = m.querySelector('.ah-atsw'); sw.setAttribute('aria-checked', 'false'); return; }
    if (a === 'guardando') { abre(m, 'horario', null); m._soloGuardando = true; var g = m.querySelector('[data-guardar]'); g.disabled = false; guarda(m, g); g.textContent = 'Guardando...'; g.disabled = true; clearTimeout(m._gt); m._gt = setTimeout(function () { m._soloGuardando = false; }, 2000); return; }
    if (a === 'plegar') { if (vp !== 'esc') return; cierra(m, true); plegar(m); return; }
  });
  if (a.indexOf('vista:') === 0) [].forEach.call(b.parentNode.querySelectorAll('[data-a^="vista:"]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
  if (a === 'plegar') b.setAttribute('aria-pressed', String(marcos.some(function (m) { return m.classList.contains('ah-plegada'); })));
}
var tira = document.createElement('div'); tira.className = 'ah-tira'; tira.setAttribute('role', 'group'); tira.setAttribute('aria-label', 'Controles de la maqueta');
(CFG.tira || []).forEach(function (x) {
  if (x === '|') { var s = document.createElement('span'); s.className = 'ah-tsep'; s.setAttribute('aria-hidden', 'true'); tira.appendChild(s); return; }
  var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Maqueta: ' + x[0]; b.dataset.a = x[1]; if (x[2] !== undefined) b.setAttribute('aria-pressed', String(x[2])); tira.appendChild(b);
});
tira.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) acciona(b.dataset.a, b); });
var op = marcos[0].closest('.op');
var ficha = document.createElement('section'); ficha.className = 'ah-ficha'; ficha.setAttribute('aria-label', 'Especificación'); ficha.setAttribute('lang', 'es'); ficha.innerHTML = CFG.ficha;
if (op) { op.querySelector('header').appendChild(tira); op.appendChild(ficha); }
else { marcos[0].parentNode.insertBefore(tira, marcos[0]); marcos[marcos.length - 1].parentNode.appendChild(ficha); }

marcos.forEach(function (m) { integra(m); liga(m); ponScroll(m); if (m.querySelector('[data-capa="campana"]')) cuentaCampana(m); });
tema();
new MutationObserver(tema).observe(raiz, { attributes: true, attributeFilter: ['class', 'data-theme'] });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', tema);
