// chk-botones.js — comprobador de desbordamiento de botones/controles en las maquetas ensambladas.
// Uso:
//   node chk-botones.js <pagina.html> [--vp ext,tel,ih,iv,esc] [--out DIR] [--json FILE] [--sin-estados] [--sin-recortes] [--ops 0,3]
//        [--espera 700] [--holgura 6]   (--holgura N añade el aviso «g»: botón cuyo contenido queda a menos de N px del borde)
// Mide cada <section class="op"> en el marco visible del dispositivo, en el estado inicial y tras pulsar cada
// botón de maqueta (los de fuera del .marco). Para reiniciar recarga la página; por velocidad pulsa el k-ésimo
// botón de TODAS las secciones a la vez y luego confirma cada hallazgo propio de un estado en una recarga aislada
// (solo esa sección), para descartar contaminación entre secciones.
// No toca ningún archivo fuente: todo ocurre en el navegador sin cabeza.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- medición (se ejecuta en la página)
function MEDIR(args) {
  const soloOps = args && args.ops;
  const CHIP = /(^|-)(chip|vchip|rolchip|pil|pill|etq|tag|sello|seg-e)(-(q|ok|s|on|act))?$/;
  const SEL = 'button,a[role=button],[role=button],[role=tab],[role=menuitem],[role=menuitemradio],[role=menuitemcheckbox],[role=radio]:not(input),[role=switch]:not(input)';
  const esChip = (e) => typeof e.className === 'string' && e.className.split(/\s+/).some((c) => CHIP.test(c));
  const esSegLabel = (e) => e.tagName === 'LABEL' && e.querySelector('input[type=radio]') && e.closest('[class*=seg],[role=radiogroup],.sg');
  const CAL = /^(ag0-b|ag0-tc|ag0-bq|am-ch|am-d)$/; // bloques y celdas de calendario: truncado por diseño
  const esCal = (e) => typeof e.className === 'string' && e.className.split(/\s+/).some((c) => CAL.test(c));
  const esControl = (e) => e.matches(SEL) || esChip(e) || esSegLabel(e);
  const R = (r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height });
  const inter = (a, b) => ({ l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) });
  const area = (a) => Math.max(0, a.r - a.l) * Math.max(0, a.b - a.t);
  const out = [];
  let idn = (window.__chkN = (window.__chkN || 0));
  document.querySelectorAll('[data-chk]').forEach((e) => e.removeAttribute('data-chk'));
  const ops = [...document.querySelectorAll('section.op')];
  ops.forEach((op, oi) => {
    if (soloOps && !soloOps.includes(oi)) return;
    const marco = [...op.querySelectorAll('.marco')].find((m) => m.getBoundingClientRect().width > 0);
    if (!marco) return;
    const titulo = (op.querySelector(':scope>header h2') || {}).textContent || op.dataset.op || ('#' + oi);
    const cand = [...marco.querySelectorAll('*')].filter((e) => !e.closest('.frj') && esControl(e));
    const ctrls = [];
    for (const e of cand) {
      const r = R(e.getBoundingClientRect());
      if (r.w < 4 || r.h < 4) continue;
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'contents') continue;
      // opacidad acumulada y recorte por ancestros
      let op_ = 1, clip = R(marco.getBoundingClientRect()), clipDuro = null, enScroll = false, x = e;
      while (x && x !== marco) {
        const c = getComputedStyle(x);
        op_ *= parseFloat(c.opacity);
        if (x !== e && (c.overflowX !== 'visible' || c.overflowY !== 'visible')) {
          const rr = R(x.getBoundingClientRect());
          clip = inter(clip, rr);
          if (/auto|scroll/.test(c.overflowX + c.overflowY)) enScroll = true;
          else clipDuro = clipDuro ? inter(clipDuro, rr) : { ...rr };
        }
        x = x.parentElement;
      }
      if (op_ < 0.05) continue;
      const vis = area(inter(r, clip)) / (r.w * r.h);
      if (vis < 0.5) continue; // desplazado fuera de su contenedor
      ctrls.push({ e, r, cs, clip, clipDuro: enScroll ? null : clipDuro, vis });
    }
    const setC = new Set(ctrls.map((c) => c.e));
    for (const c of ctrls) {
      const { e, r, cs } = c;
      const texto = (e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
      const fallos = [];
      const bl = parseFloat(cs.borderLeftWidth), br = parseFloat(cs.borderRightWidth), bt = parseFloat(cs.borderTopWidth), bb = parseFloat(cs.borderBottomWidth);
      const inn = { l: r.l + bl, t: r.t + bt, r: r.r - br, b: r.b - bb };
      const anidado = (n) => { let x = n.nodeType === 1 ? n : n.parentElement; while (x && x !== e) { if (setC.has(x) || esControl(x)) return true; x = x.parentElement; } return false; };
      // (a) scroll, neutralizando pseudoelementos y descendientes absolutos (áreas de toque ampliadas, insignias)
      const tocados = [];
      const absPseudo = ['::before', '::after'].some((p) => /absolute|fixed/.test(getComputedStyle(e, p).position) && getComputedStyle(e, p).content !== 'none');
      if (absPseudo) { e.setAttribute('data-chk-np', ''); }
      e.querySelectorAll('*').forEach((d) => { if (/absolute|fixed/.test(getComputedStyle(d).position)) { tocados.push([d, d.style.display]); d.style.setProperty('display', 'none', 'important'); } });
      let sw = e.scrollWidth, cw = e.clientWidth, sh = e.scrollHeight, ch = e.clientHeight;
      tocados.forEach(([d, v]) => { d.style.display = v; });
      if (absPseudo) e.removeAttribute('data-chk-np');
      const inline = cs.display === 'inline';
      // rects de hijos (texto por Range, iconos por caja)
      const piezas = [];
      const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
      let n; const rng = document.createRange();
      while ((n = tw.nextNode())) {
        if (anidado(n)) continue;
        if (n.nodeType === 3) {
          if (!n.textContent.trim()) continue;
          const pe = n.parentElement; const pcs = getComputedStyle(pe);
          if (pcs.visibility === 'hidden' || pe.closest('[aria-hidden=true]') && pe.closest('.sr-only,.vh')) continue;
          rng.selectNodeContents(n);
          // recorte por ancestros intermedios con overflow distinto de visible
          let cl = null, y = pe;
          while (y && y !== e) { const yc = getComputedStyle(y); if (yc.overflowX !== 'visible' || yc.overflowY !== 'visible') { const yr = R(y.getBoundingClientRect()); cl = cl ? inter(cl, yr) : yr; } y = y.parentElement; }
          let blq = pe; while (blq !== e && getComputedStyle(blq).display === 'inline') blq = blq.parentElement;
          for (const q of rng.getClientRects()) { if (q.width < 0.5) continue; let qq = R(q); if (cl) qq = inter(qq, cl); if (qq.r - qq.l <= 0) continue; piezas.push({ k: 'texto', ...qq, t0: q.top, b0: q.bottom, blq }); }
        } else if (n !== e) {
          const tag = n.tagName.toLowerCase();
          if (n.closest('svg') && tag !== 'svg') continue;
          const ncs = getComputedStyle(n);
          if (ncs.display === 'none' || ncs.visibility === 'hidden') continue;
          if (/absolute|fixed/.test(ncs.position)) continue;
          if (tag === 'svg' || tag === 'img' || tag === 'i' || (n.children.length === 0 && !n.textContent.trim() && (ncs.backgroundImage !== 'none' || ncs.backgroundColor !== 'rgba(0, 0, 0, 0)'))) {
            let q = R(n.getBoundingClientRect());
            let y = n.parentElement; while (y && y !== e) { const yc = getComputedStyle(y); if (yc.overflowX !== 'visible' || yc.overflowY !== 'visible') q = inter(q, R(y.getBoundingClientRect())); y = y.parentElement; }
            q.w = q.r - q.l; q.h = q.b - q.t;
            if (q.w > 0.5 && q.h > 0.5) piezas.push({ k: tag === 'svg' || tag === 'img' || tag === 'i' ? 'icono' : 'pieza', ...q });
          }
        }
      }
      // líneas del rótulo
      // se cuentan por bloque de texto (título y subtítulo de una fila de menú son bloques distintos)
      const bloques = new Map();
      for (const p of piezas) if (p.k === 'texto') { const k = p.blq; if (!bloques.has(k)) bloques.set(k, []); bloques.get(k).push(p); }
      let lineas = 0;
      for (const tx of [...bloques.values()].slice(0, 1)) {
        tx.sort((a, b) => a.t0 - b.t0); let nl = 0, lb = -1e9;
        for (const p of tx) { if (p.t0 >= lb - 2) { nl++; lb = p.b0; } else lb = Math.max(lb, p.b0); }
        lineas = Math.max(lineas, nl);
      }
      // (b) hijos fuera del borde interior
      let fuera = null, fx = { l: 0, r: 0, t: 0, b: 0 };
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') {
        for (const p of piezas) {
          const d = { l: inn.l - p.l, r: p.r - inn.r, t: inn.t - p.t, b: p.b - inn.b };
          if (d.l > 1 || d.r > 1 || d.t > 1 || d.b > 1) {
            fx = { l: Math.max(fx.l, d.l), r: Math.max(fx.r, d.r), t: Math.max(fx.t, d.t), b: Math.max(fx.b, d.b) };
            fuera = fuera ? { l: Math.min(fuera.l, p.l), t: Math.min(fuera.t, p.t), r: Math.max(fuera.r, p.r), b: Math.max(fuera.b, p.b), k: fuera.k.includes(p.k) ? fuera.k : fuera.k + '+' + p.k } : { l: p.l, t: p.t, r: p.r, b: p.b, k: p.k };
          }
        }
      }
      const contenido = piezas.length ? piezas.reduce((a, p) => ({ l: Math.min(a.l, p.l), r: Math.max(a.r, p.r), t: Math.min(a.t, p.t), b: Math.max(a.b, p.b) }), { l: 1e9, r: -1e9, t: 1e9, b: -1e9 }) : null;
      const necesW = contenido ? Math.round(contenido.r - contenido.l + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + bl + br) : 0;
      if (fuera) fallos.push({ tipo: 'b', det: 'sobresale ' + fuera.k + ' ' + ['l', 'r', 't', 'b'].filter((s) => fx[s] > 1).map((s) => s + Math.round(fx[s])).join(' ') });
      if (!inline && (sw > cw + 1 || sh > ch + 1)) {
        const det = (sw > cw + 1 ? 'scrollW ' + sw + '>' + cw : '') + (sh > ch + 1 ? ' scrollH ' + sh + '>' + ch : '');
        fallos.push({ tipo: 'a', det: det.trim(), recortado: cs.overflowX !== 'visible' || cs.overflowY !== 'visible' });
      }
      // (d) elipsis / line-clamp
      for (const d of [e, ...e.querySelectorAll('*')]) {
        if (d !== e && anidado(d)) continue;
        const dc = d === e ? cs : getComputedStyle(d);
        if (dc.textOverflow === 'ellipsis' && dc.overflowX !== 'visible' && d.scrollWidth > d.clientWidth + 1 && d.clientWidth > 0) { fallos.push({ tipo: 'd', det: 'elipsis ' + d.scrollWidth + '>' + d.clientWidth }); break; }
        if (dc.webkitLineClamp && dc.webkitLineClamp !== 'none' && d.scrollHeight > d.clientHeight + 1) { fallos.push({ tipo: 'd', det: 'line-clamp ' + d.scrollHeight + '>' + d.clientHeight }); break; }
      }
      // (e) líneas
      let pie = false;
      const dlg = e.closest('[role=dialog],[role=alertdialog],[class*=modal],[class*=alerta],[class*=hoja],[class*=sheet],[class*=dialog]');
      const par = e.parentElement;
      if (dlg && dlg !== marco && marco.contains(dlg)) {
        const hermanos = [...par.children].filter((h) => h !== e && setC.has(h) && h.matches('button,[role=button]'));
        if (hermanos.length || /(^|-)(pie|foot|mp|acc|acciones|bots|botones|fin)$/.test(par.className)) pie = true;
      }
      if (texto && (lineas >= 3 || (lineas === 2 && pie && !e.matches('[role=menuitem],[role=menuitemradio],[role=menuitemcheckbox],[role=radio],[role=tab]')))) fallos.push({ tipo: 'e', det: lineas + ' líneas' + (pie ? ' (pie de modal/alerta)' : '') });
      // (g) aviso opcional: holgura lateral escasa (el contenido cabe, pero se come el relleno). Solo con args.holgura.
      if (args && args.holgura && contenido && !fuera && texto && !esChip(e) && e.matches('button,[role=button],a[role=button]') && parseFloat(cs.paddingLeft) >= 8
        && (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || parseFloat(cs.borderLeftWidth) > 0 || cs.boxShadow !== 'none')) { // solo botones con caja visible
        const hol = Math.min(contenido.l - inn.l, inn.r - contenido.r);
        if (hol < args.holgura) fallos.push({ tipo: 'g', det: 'holgura ' + Math.round(hol) + 'px (relleno ' + parseFloat(cs.paddingLeft) + ')' });
      }
      // (f) recortado por un contenedor sin desplazamiento
      if (c.clipDuro && e.matches('button,[role=button],a[role=button]')) {
        const d = Math.max(c.clipDuro.l - r.l, r.r - c.clipDuro.r, c.clipDuro.t - r.t, r.b - c.clipDuro.b);
        if (d > 1) fallos.push({ tipo: 'f', det: 'recortado por contenedor ' + Math.round(d) + 'px' });
      }
      c.fuera = fuera; c.texto = texto; c.lineas = lineas; c.pie = pie; c.fallos = fallos; c.necesW = necesW; c.dlg = !!dlg;
    }
    // (c) solape con hermanos/primos, y contenido que invade al vecino
    for (let i = 0; i < ctrls.length; i++) for (let j = i + 1; j < ctrls.length; j++) {
      const A = ctrls[i], B = ctrls[j];
      if (A.e.contains(B.e) || B.e.contains(A.e)) continue;
      const pa = A.e.parentElement, pb = B.e.parentElement;
      if (!(pa === pb || (pa.parentElement && pa.parentElement === pb.parentElement))) continue;
      const I = inter(A.r, B.r);
      const pegajoso = (x) => { for (let i = 0; x && i < 4; i++, x = x.parentElement) if (getComputedStyle(x).position === 'sticky') return true; return false; };
      if (I.r - I.l > 2 && I.b - I.t > 2 && !(pegajoso(A.e) && pegajoso(B.e))) { A.fallos.push({ tipo: 'c', det: 'se solapa con «' + B.texto.slice(0, 40) + '» ' + Math.round(I.r - I.l) + 'x' + Math.round(I.b - I.t) }); B.fallos.push({ tipo: 'c', det: 'se solapa con «' + A.texto.slice(0, 40) + '» ' + Math.round(I.r - I.l) + 'x' + Math.round(I.b - I.t) }); }
      for (const [X, Y] of [[A, B], [B, A]]) if (X.fuera) { const J = inter(X.fuera, Y.r); if (J.r - J.l > 0.5 && J.b - J.t > 0.5) X.fallos.push({ tipo: 'c', det: 'su contenido invade «' + Y.texto.slice(0, 40) + '» ' + Math.round(J.r - J.l) + 'px' }); }
    }
    for (const c of ctrls) {
      if (!c.fallos.length) continue;
      const id = 'k' + (++idn); c.e.setAttribute('data-chk', id);
      out.push({ id, oi, sec: titulo.trim(), texto: c.texto.slice(0, 80), tag: c.e.tagName.toLowerCase() + (c.e.getAttribute('role') ? '[' + c.e.getAttribute('role') + ']' : ''),
        cls: (typeof c.e.className === 'string' ? c.e.className : '').trim().slice(0, 60), padre: (typeof c.e.parentElement.className === 'string' ? c.e.parentElement.className : '').trim().slice(0, 40),
        w: Math.round(c.r.w), h: Math.round(c.r.h), necesW: c.necesW, lineas: c.lineas, pie: c.pie, dlg: c.dlg, marcoW: Math.round(marco.getBoundingClientRect().width),
        padreW: Math.round(c.e.parentElement.getBoundingClientRect().width), cal: esCal(c.e), fallos: c.fallos });
    }
  });
  window.__chkN = idn;
  return out;
}

// ---------------------------------------------------------------- conducción
const CAB = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
const ESTILO_CHK = '[data-chk-np]::before,[data-chk-np]::after{display:none!important}';
async function cargar(page, html, vp) {
  await page.setContent(CAB + html, { waitUntil: 'load', timeout: 120000 });
  await page.addStyleTag({ content: ESTILO_CHK });
  await page.evaluate(() => document.documentElement.classList.add('claro'));
  await page.click(`#g-vp button[data-v="${vp}"]`);
  await page.waitForTimeout(250);
}
// botones de estado: los de fuera del marco dentro de cada sección
async function estados(page) {
  return page.evaluate(() => [...document.querySelectorAll('section.op')].map((op) =>
    [...op.querySelectorAll('button')].filter((b) => !b.closest('.marco') && !b.closest('.ctl')).map((b) => (b.innerText || '').replace(/\s+/g, ' ').trim())));
}
async function pulsar(page, pares) { // pares: [[oi,k]]
  return page.evaluate((pares) => {
    const ops = [...document.querySelectorAll('section.op')]; const hechos = [];
    for (const [oi, k] of pares) {
      const bs = [...ops[oi].querySelectorAll('button')].filter((b) => !b.closest('.marco') && !b.closest('.ctl'));
      const b = bs[k]; if (!b || b.getBoundingClientRect().width === 0) continue;
      b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); b.click(); hechos.push([oi, k]);
    }
    return hechos;
  }, pares);
}
async function recortar(page, id, archivo) {
  const caja = await page.evaluate((id) => {
    const e = document.querySelector(`[data-chk="${id}"]`); if (!e) return null;
    const r0 = e.getBoundingClientRect(); window.scrollTo(0, window.scrollY + r0.top - 300);
    const r = e.getBoundingClientRect(); let pe = e.parentElement; while (pe.parentElement && pe.getBoundingClientRect().width < 220 && !pe.classList.contains('marco')) pe = pe.parentElement; const p = pe.getBoundingClientRect();
    const u = { l: Math.min(r.left, p.width < 700 ? p.left : r.left - 60), t: Math.min(r.top, p.height < 200 ? p.top : r.top - 20), r: Math.max(r.right, p.width < 700 ? p.right : r.right + 60), b: Math.max(r.bottom, p.height < 200 ? p.bottom : r.bottom + 20) };
    const o = document.createElement('div'); o.id = 'chk-ov';
    o.style.cssText = `position:fixed;left:${r.left - 3}px;top:${r.top - 3}px;width:${r.width + 6}px;height:${r.height + 6}px;outline:2px dashed #ff0080;pointer-events:none;z-index:2147483647`;
    document.body.appendChild(o);
    return { x: Math.max(0, u.l - 16), y: Math.max(0, u.t - 16), w: Math.min(innerWidth, u.r + 16) - Math.max(0, u.l - 16), h: Math.min(innerHeight, u.b + 16) - Math.max(0, u.t - 16) };
  }, id);
  if (!caja) return false;
  await page.screenshot({ path: archivo, clip: { x: caja.x, y: caja.y, width: Math.max(10, caja.w), height: Math.max(10, caja.h) } });
  await page.evaluate(() => { const o = document.getElementById('chk-ov'); if (o) o.remove(); });
  return true;
}
const clave = (f, vp) => [f.oi, vp, f.texto, f.fallos.map((x) => x.tipo).sort().join(''), Math.round(f.w / 3)].join('|');

async function revisarPagina(browser, archivo, opt) {
  const html = fs.readFileSync(archivo, 'utf8');
  const nombre = path.basename(path.dirname(archivo));
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  let page = null, usos = 0;
  // página nueva cada pocas recargas: setContent repetido de 9 MB agota la memoria del renderizador
  const fresca = async () => { if (page) await page.close().catch(() => {}); page = await ctx.newPage(); page.on('pageerror', () => {}); usos = 0; };
  const cargarP = async (vp) => {
    for (let i = 0; i < 3; i++) {
      try { if (!page || ++usos > 6 || page.isClosed()) await fresca(); await cargar(page, html, vp); return; }
      catch (err) { process.stderr.write('reintento tras: ' + String(err.message).slice(0, 60) + '\n'); usos = 99; }
    }
    throw new Error('no se pudo cargar ' + archivo);
  };
  const hall = new Map(); let nEst = 0;
  for (const vp of opt.vps) {
    await cargarP(vp);
    const est = await estados(page);
    const opsSel = opt.ops || est.map((_, i) => i);
    const reg = async (lista, estado, recargar) => {
      for (const f of lista) {
        if (!opsSel.includes(f.oi)) continue;
        const k = clave(f, vp);
        if (!hall.has(k)) {
          const h = { pagina: nombre, vp, estados: [], ...f, recorte: null };
          hall.set(k, h);
          if (opt.recortes) { const fn = `${nombre}-${vp}-${String(hall.size).padStart(3, '0')}.png`; if (await recortar(page, f.id, path.join(opt.out, fn))) h.recorte = fn; }
        }
        const h = hall.get(k); if (!h.estados.includes(estado)) h.estados.push(estado);
      }
    };
    await page.waitForTimeout(400);
    await reg(await page.evaluate(MEDIR, { ops: opsSel, holgura: opt.holgura }), 'inicial'); nEst++;
    if (!opt.estados) continue;
    const maxK = Math.max(0, ...opsSel.map((i) => est[i].length));
    for (let k = 0; k < maxK; k++) {
      await cargarP(vp);
      const hechos = await pulsar(page, opsSel.filter((i) => est[i][k] !== undefined).map((i) => [i, k]));
      if (!hechos.length) continue;
      await page.waitForTimeout(opt.espera);
      const med = await page.evaluate(MEDIR, { ops: hechos.map((h) => h[0]), holgura: opt.holgura });
      nEst += hechos.length;
      // confirmación aislada de los hallazgos nuevos (propios del estado)
      const nuevosOps = new Set();
      for (const f of med) { const kk = clave(f, vp); if (!hall.has(kk) || !hall.get(kk).estados.includes('inicial')) nuevosOps.add(f.oi); }
      const conf = [];
      for (const f of med) { const kk = clave(f, vp); if (hall.has(kk) && hall.get(kk).estados.includes('inicial')) conf.push(f); }
      for (const oi of nuevosOps) {
        await cargarP(vp); await pulsar(page, [[oi, k]]); await page.waitForTimeout(opt.espera);
        const solo = await page.evaluate(MEDIR, { ops: [oi], holgura: opt.holgura });
        for (const f of solo) { const lab = `«${est[oi][k]}»`; await reg([f], lab); }
      }
      for (const f of conf) await reg([f], `«${est[f.oi][k]}»`);
      if (opt.log) process.stderr.write(`${nombre} ${vp} k=${k + 1}/${maxK} hallazgos=${hall.size}\n`);
    }
  }
  await ctx.close();
  return { pagina: nombre, estadosMedidos: nEst, hallazgos: [...hall.values()] };
}

if (require.main === module) {
  (async () => {
    const a = process.argv.slice(2); const get = (f, d) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : d; };
    const archivos = a.filter((x, i) => x.endsWith('.html') && a[i - 1] !== '--json');
    const opt = { vps: get('--vp', 'ext,tel,ih,iv,esc').split(','), out: get('--out', '.'), estados: !a.includes('--sin-estados'), recortes: !a.includes('--sin-recortes'),
      espera: +get('--espera', '700'), log: !a.includes('--silencio'), holgura: get('--holgura') ? +get('--holgura') : 0, ops: get('--ops') ? get('--ops').split(',').map(Number) : null };
    fs.mkdirSync(opt.out, { recursive: true });
    const browser = await chromium.launch();
    const res = [];
    for (const f of archivos) { const r = await revisarPagina(browser, f, opt); res.push(r); console.log(r.pagina, 'estados', r.estadosMedidos, 'hallazgos', r.hallazgos.length); }
    await browser.close();
    const j = get('--json'); if (j) fs.writeFileSync(j, JSON.stringify(res, null, 1));
    else for (const r of res) for (const h of r.hallazgos) console.log([h.pagina, h.vp, h.sec, '«' + h.texto + '»', h.fallos.map((x) => x.tipo + ':' + x.det).join('; '), 'w' + h.w + ' nec' + h.necesW, h.estados.slice(0, 4).join(',')].join(' | '));
  })();
}
module.exports = { MEDIR, revisarPagina };
