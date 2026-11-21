/* eslint-disable @typescript-eslint/no-require-imports -- script de desarrollo en CommonJS, fuera de src/ */
// chk-app.js — mediciones de interfaz sobre páginas REALES de la app, en los cinco formatos del rediseño.
//
// Adapta la medición de `chk-botones.js` (maquetas) a la app: el «marco» es la ventana, no un `.marco`
// de maqueta, y añade los criterios de los formatos con franja. Por cada control visible en la ventana:
//   (a) contenido que desborda el control (scrollWidth/Height), (b) icono o texto que sobresale del borde,
//   (c) solape con un control hermano o primo, (d) rótulo cortado con elipsis o line-clamp,
//   (e) rótulo de 3+ líneas (2+ en el pie de un diálogo), (f) recortado por un contenedor sin scroll,
//   (h) control bajo una franja del sistema (insets del formato), (i) área de toque menor que la mínima
//       del formato (44 en ext/tel/iv, 36 en ih/esc; no cuenta enlaces en línea dentro de un párrafo),
// y para la página: (j) texto visible de menos de 12 px y (k) errores de consola.
// Sólo mide lo que está en la ventana al cargar (sin desplazar). No toca la base: sólo navega.
//
// Uso (desde la raíz del repo; mismos requisitos y opciones que cap-app.js):
//   node docs/spec/rediseno/tools/chk-app.js [--json salida.json] [--formatos ext,tel] [--temas claro] [--solo dashboard]
const { chromium } = require('@playwright/test')
const fs = require('fs')
const { FORMATOS, leerArgs, resolverIds, iniciarSesion, nuevaPagina, irA, rutasElegidas } = require('./cap-app.js')

// ------------------------------------------------ funciones que corren DENTRO de la página
// Se serializan con `String(fn)` y se evalúan juntas: no pueden usar nada de Node.
function R(r) { return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height } }
function inter(a, b) { return { l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) } }
function area(a) { return Math.max(0, a.r - a.l) * Math.max(0, a.b - a.t) }

const SEL_CONTROL = 'button,a[href],[role=button],[role=tab],[role=menuitem],[role=menuitemradio],[role=menuitemcheckbox],'
  + '[role=radio]:not(input),[role=switch]:not(input),[role=link],input:not([type=hidden]),select,textarea,summary'

function esControl(e) { return e.matches(SEL_CONTROL) }

/** Calendario (FullCalendar): eventos y celdas se truncan por diseño; se miden pero no cuentan (d). */
function esCalendario(e) { return !!e.closest('.fc-event,.fc-daygrid-day,.fc-col-header-cell,.fc-timegrid-slot') }

/** Visibilidad real en la ventana: opacidad acumulada y recorte de los ancestros con overflow. */
function medirVisible(e, marco) {
  const r = R(e.getBoundingClientRect())
  if (r.w < 4 || r.h < 4) return null
  const cs = getComputedStyle(e)
  if (cs.visibility === 'hidden' || cs.display === 'contents') return null
  let op = 1, clip = marco, clipDuro = null, enScroll = false
  for (let x = e; x && x !== document.body; x = x.parentElement) {
    const c = getComputedStyle(x)
    op *= parseFloat(c.opacity)
    if (x !== e && (c.overflowX !== 'visible' || c.overflowY !== 'visible')) {
      const rr = R(x.getBoundingClientRect())
      clip = inter(clip, rr)
      if (/auto|scroll/.test(c.overflowX + c.overflowY)) enScroll = true
      else clipDuro = clipDuro ? inter(clipDuro, rr) : { ...rr }
    }
  }
  if (op < 0.05) return null
  const vis = area(inter(r, clip)) / (r.w * r.h)
  if (vis < 0.5) return null
  return { e, r, cs, clip, clipDuro: enScroll ? null : clipDuro, vis }
}

function anidado(n, e, setC) {
  for (let x = n.nodeType === 1 ? n : n.parentElement; x && x !== e; x = x.parentElement) if (setC.has(x) || esControl(x)) return true
  return false
}

/** Recorte de los ancestros intermedios (entre `n` y el control `e`) con overflow distinto de visible. */
function recorteIntermedio(n, e) {
  let cl = null
  for (let y = n; y && y !== e; y = y.parentElement) {
    const yc = getComputedStyle(y)
    if (yc.overflowX !== 'visible' || yc.overflowY !== 'visible') { const yr = R(y.getBoundingClientRect()); cl = cl ? inter(cl, yr) : yr }
  }
  return cl
}

function piezasTexto(n, e, rng) {
  const pe = n.parentElement
  if (!n.textContent.trim() || getComputedStyle(pe).visibility === 'hidden') return []
  rng.selectNodeContents(n)
  const cl = recorteIntermedio(pe, e)
  let blq = pe
  while (blq !== e && getComputedStyle(blq).display === 'inline') blq = blq.parentElement
  const out = []
  for (const q of rng.getClientRects()) {
    if (q.width < 0.5) continue
    const qq = cl ? inter(R(q), cl) : R(q)
    if (qq.r - qq.l > 0) out.push({ k: 'texto', ...qq, t0: q.top, b0: q.bottom, blq })
  }
  return out
}

function piezaElemento(n, e) {
  const tag = n.tagName.toLowerCase()
  if (n.closest('svg') && tag !== 'svg') return null
  const ncs = getComputedStyle(n)
  if (ncs.display === 'none' || ncs.visibility === 'hidden' || /absolute|fixed/.test(ncs.position)) return null
  const icono = tag === 'svg' || tag === 'img' || tag === 'i'
  const mancha = n.children.length === 0 && !n.textContent.trim() && (ncs.backgroundImage !== 'none' || ncs.backgroundColor !== 'rgba(0, 0, 0, 0)')
  if (!icono && !mancha) return null
  const cl = recorteIntermedio(n.parentElement, e)
  const q = cl ? inter(R(n.getBoundingClientRect()), cl) : R(n.getBoundingClientRect())
  q.w = q.r - q.l; q.h = q.b - q.t
  return q.w > 0.5 && q.h > 0.5 ? { k: icono ? 'icono' : 'pieza', ...q } : null
}

function piezasDe(e, setC) {
  const piezas = [], rng = document.createRange()
  const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null)
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (anidado(n, e, setC)) continue
    if (n.nodeType === 3) piezas.push(...piezasTexto(n, e, rng))
    else { const p = piezaElemento(n, e); if (p) piezas.push(p) }
  }
  return piezas
}

/** (a) desborde, sin contar descendientes absolutos (insignias, áreas de toque ampliadas). */
function desborde(e, cs) {
  if (cs.display === 'inline' || /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)) return null
  const tocados = []
  e.querySelectorAll('*').forEach((d) => { if (/absolute|fixed/.test(getComputedStyle(d).position)) { tocados.push([d, d.style.display]); d.style.setProperty('display', 'none', 'important') } })
  const sw = e.scrollWidth, cw = e.clientWidth, sh = e.scrollHeight, ch = e.clientHeight
  tocados.forEach(([d, v]) => { d.style.display = v })
  if (sw <= cw + 1 && sh <= ch + 1) return null
  return { tipo: 'a', det: ((sw > cw + 1 ? `scrollW ${sw}>${cw}` : '') + (sh > ch + 1 ? ` scrollH ${sh}>${ch}` : '')).trim() }
}

/** (b) piezas fuera del borde interior. Devuelve la caja que sobresale, o null. */
function sobresale(piezas, cs, r) {
  if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') return null
  const inn = { l: r.l + parseFloat(cs.borderLeftWidth), t: r.t + parseFloat(cs.borderTopWidth), r: r.r - parseFloat(cs.borderRightWidth), b: r.b - parseFloat(cs.borderBottomWidth) }
  let fuera = null
  const fx = { l: 0, r: 0, t: 0, b: 0 }
  for (const p of piezas) {
    const d = { l: inn.l - p.l, r: p.r - inn.r, t: inn.t - p.t, b: p.b - inn.b }
    if (d.l <= 1 && d.r <= 1 && d.t <= 1 && d.b <= 1) continue
    for (const s of ['l', 'r', 't', 'b']) fx[s] = Math.max(fx[s], d[s])
    fuera = fuera ? { l: Math.min(fuera.l, p.l), t: Math.min(fuera.t, p.t), r: Math.max(fuera.r, p.r), b: Math.max(fuera.b, p.b), k: fuera.k.includes(p.k) ? fuera.k : fuera.k + '+' + p.k } : { ...p }
  }
  if (!fuera) return null
  fuera.det = 'sobresale ' + fuera.k + ' ' + ['l', 'r', 't', 'b'].filter((s) => fx[s] > 1).map((s) => s + Math.round(fx[s])).join(' ')
  return fuera
}

function lineasDe(piezas) {
  const primero = piezas.find((p) => p.k === 'texto')
  if (!primero) return 0
  const tx = piezas.filter((p) => p.k === 'texto' && p.blq === primero.blq).sort((a, b) => a.t0 - b.t0)
  let nl = 0, lb = -1e9
  for (const p of tx) { if (p.t0 >= lb - 2) { nl++; lb = p.b0 } else lb = Math.max(lb, p.b0) }
  return nl
}

/** (d) elipsis o line-clamp en el control o en un descendiente que no sea otro control. */
function cortado(e, cs, setC) {
  for (const d of [e, ...e.querySelectorAll('*')]) {
    if (d !== e && anidado(d, e, setC)) continue
    const dc = d === e ? cs : getComputedStyle(d)
    if (dc.textOverflow === 'ellipsis' && dc.overflowX !== 'visible' && d.scrollWidth > d.clientWidth + 1 && d.clientWidth > 0) return { tipo: 'd', det: `elipsis ${d.scrollWidth}>${d.clientWidth}` }
    if (dc.webkitLineClamp && dc.webkitLineClamp !== 'none' && d.scrollHeight > d.clientHeight + 1) return { tipo: 'd', det: `line-clamp ${d.scrollHeight}>${d.clientHeight}` }
  }
  return null
}

/** ¿El control está en el pie de un diálogo, junto a otros botones? */
function enPieDeDialogo(e, setC) {
  const dlg = e.closest('[role=dialog],[role=alertdialog]')
  if (!dlg || !e.parentElement) return false
  return [...e.parentElement.children].some((h) => h !== e && setC.has(h) && h.matches('button,[role=button]'))
}

/** (h) intersección con las franjas del formato; (i) área de toque bajo el mínimo. */
function criteriosFormato(c, f) {
  const out = [], { r, cs, e } = c, vw = innerWidth, vh = innerHeight
  const zonas = [f.right && { l: vw - f.right, t: 0, r: vw, b: vh, n: 'derecha' }, f.left && { l: 0, t: 0, r: f.left, b: vh, n: 'izquierda' },
    f.top && { l: 0, t: 0, r: vw, b: f.top, n: 'arriba' }, f.bottom && { l: 0, t: vh - f.bottom, r: vw, b: vh, n: 'abajo' }].filter(Boolean)
  for (const z of zonas) { const I = inter(r, z); if (I.r - I.l > 1 && I.b - I.t > 1) out.push({ tipo: 'h', det: `bajo la franja ${z.n} ${Math.round(I.r - I.l)}x${Math.round(I.b - I.t)}` }) }
  const enLinea = cs.display === 'inline' && e.tagName === 'A' && e.closest('p,li,label,dd,td')
  if (!enLinea && (r.w < f.toque || r.h < f.toque)) out.push({ tipo: 'i', det: `toque ${Math.round(r.w)}x${Math.round(r.h)} < ${f.toque}` })
  return out
}

function fallosDe(c, setC, f) {
  const { e, r, cs } = c
  const texto = (e.innerText || e.getAttribute('aria-label') || e.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim()
  const piezas = /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) ? [] : piezasDe(e, setC)
  const fallos = [], fuera = sobresale(piezas, cs, r)
  if (fuera) fallos.push({ tipo: 'b', det: fuera.det })
  const a = desborde(e, cs); if (a) fallos.push(a)
  const d = esCalendario(e) ? null : cortado(e, cs, setC); if (d) fallos.push(d)
  const lineas = lineasDe(piezas), pie = enPieDeDialogo(e, setC)
  if (texto && !esCalendario(e) && (lineas >= 3 || (lineas === 2 && pie))) fallos.push({ tipo: 'e', det: lineas + ' líneas' + (pie ? ' (pie de diálogo)' : '') })
  if (c.clipDuro && e.matches('button,[role=button],a')) {
    const k = c.clipDuro, dd = Math.max(k.l - r.l, r.r - k.r, k.t - r.t, r.b - k.b)
    if (dd > 1) fallos.push({ tipo: 'f', det: `recortado por contenedor ${Math.round(dd)}px` })
  }
  fallos.push(...criteriosFormato(c, f))
  Object.assign(c, { texto, fuera, fallos })
}

/** (c) solape entre controles hermanos o primos, y contenido que invade al vecino. */
function solapes(ctrls) {
  const pegajoso = (x) => { for (let i = 0; x && i < 4; i++, x = x.parentElement) if (getComputedStyle(x).position === 'sticky') return true; return false }
  for (let i = 0; i < ctrls.length; i++) for (let j = i + 1; j < ctrls.length; j++) {
    const A = ctrls[i], B = ctrls[j]
    if (A.e.contains(B.e) || B.e.contains(A.e)) continue
    const pa = A.e.parentElement, pb = B.e.parentElement
    if (!(pa === pb || (pa.parentElement && pa.parentElement === pb.parentElement))) continue
    const I = inter(A.r, B.r)
    if (I.r - I.l > 2 && I.b - I.t > 2 && !(pegajoso(A.e) && pegajoso(B.e))) {
      const det = (o) => `se solapa con «${o.texto.slice(0, 40)}» ${Math.round(I.r - I.l)}x${Math.round(I.b - I.t)}`
      A.fallos.push({ tipo: 'c', det: det(B) }); B.fallos.push({ tipo: 'c', det: det(A) })
    }
    for (const [X, Y] of [[A, B], [B, A]]) if (X.fuera) { const J = inter(X.fuera, Y.r); if (J.r - J.l > 0.5 && J.b - J.t > 0.5) X.fallos.push({ tipo: 'c', det: `su contenido invade «${Y.texto.slice(0, 40)}»` }) }
  }
}

/** (j) texto visible en la ventana con letra de menos de 12 px. */
function textoPequeno() {
  const vis = (p) => { const r = p.getBoundingClientRect(), cs = getComputedStyle(p); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && cs.visibility !== 'hidden' && +cs.opacity > 0.05 }
  const vistos = new Set(), muestras = []
  let total = 0, pequenos = 0
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  while (w.nextNode()) {
    const p = w.currentNode.parentElement
    if (!p || vistos.has(p) || !w.currentNode.textContent.trim() || p.closest('[data-franja-cap],script,style,noscript')) continue
    vistos.add(p)
    if (!vis(p)) continue
    total++
    const px = parseFloat(getComputedStyle(p).fontSize)
    if (px < 12) { pequenos++; if (muestras.length < 12) muestras.push(`${px}px «${w.currentNode.textContent.trim().slice(0, 30)}»`) }
  }
  return { total, pequenos, muestras }
}

function descripcion(c) {
  const cls = typeof c.e.className === 'string' ? c.e.className.trim().slice(0, 60) : ''
  return { texto: c.texto.slice(0, 80), tag: c.e.tagName.toLowerCase() + (c.e.getAttribute('role') ? `[${c.e.getAttribute('role')}]` : ''), cls,
    w: Math.round(c.r.w), h: Math.round(c.r.h), x: Math.round(c.r.l), y: Math.round(c.r.t), fallos: c.fallos }
}

function medirTodo(f) {
  const marco = { l: 0, t: 0, r: innerWidth, b: innerHeight }
  const ctrls = [...document.querySelectorAll(SEL_CONTROL)].filter((e) => !e.closest('[data-franja-cap]')).map((e) => medirVisible(e, marco)).filter(Boolean)
  const setC = new Set(ctrls.map((c) => c.e))
  for (const c of ctrls) fallosDe(c, setC, f)
  solapes(ctrls)
  return { controles: ctrls.length, hallazgos: ctrls.filter((c) => c.fallos.length).map(descripcion), texto: textoPequeno(),
    desbordePagina: document.documentElement.scrollWidth > innerWidth + 1 }
}

const EN_PAGINA = [R, inter, area, esControl, esCalendario, medirVisible, anidado, recorteIntermedio, piezasTexto, piezaElemento, piezasDe,
  desborde, sobresale, lineasDe, cortado, enPieDeDialogo, criteriosFormato, fallosDe, solapes, textoPequeno, descripcion, medirTodo]

// ------------------------------------------------ conducción (Node)
/** Mide la página ya cargada en el formato `f` (un valor de FORMATOS). */
async function medirPagina(page, f) {
  const src = `const SEL_CONTROL = ${JSON.stringify(SEL_CONTROL)};\n${EN_PAGINA.map(String).join('\n')}\nreturn medirTodo(${JSON.stringify(f)})`
  return page.evaluate(`(() => { ${src} })()`)
}

function resumen(clave, m, errores) {
  const cuenta = {}
  for (const h of m.hallazgos) for (const x of h.fallos) cuenta[x.tipo] = (cuenta[x.tipo] || 0) + 1
  const tipos = Object.entries(cuenta).map(([k, v]) => `${k}:${v}`).join(' ') || 'sin hallazgos de controles'
  return `${clave} controles=${m.controles} ${tipos} | texto<12: ${m.texto.pequenos}/${m.texto.total} | consola: ${errores.length}${m.desbordePagina ? ' | DESBORDE HORIZONTAL DE PÁGINA' : ''}`
}

async function revisarFormato(browser, opt, ids, sesion, formato, tema, res) {
  const { ctx, page, errores } = await nuevaPagina(browser, { base: opt.base, sesion, formato, tema })
  for (const ruta of rutasElegidas(opt, ids)) {
    const clave = `${ruta.n}@${formato}-${tema}`
    errores.length = 0
    try {
      const r = await irA(page, ruta, ids)
      const m = await medirPagina(page, FORMATOS[formato])
      res[clave] = { ...r, ...m, errores: [...errores] }
      console.log(resumen(clave, m, errores))
    } catch (e) { res[clave] = { fallo: String(e.message).slice(0, 200) }; console.log('FALLO', clave, String(e.message).slice(0, 120)) }
  }
  await ctx.close()
}

async function main() {
  const a = process.argv
  const opt = leerArgs([a[0], a[1], '-', ...a.slice(2)])
  const iJson = a.indexOf('--json'), json = iJson >= 0 ? a[iJson + 1] : null
  const ids = resolverIds(opt)
  const browser = await chromium.launch()
  const sesion = await iniciarSesion(browser, opt.base, opt.usuario)
  const res = { ids, base: opt.base, fecha: new Date().toISOString() }
  for (const formato of opt.formatos) for (const tema of opt.temas) await revisarFormato(browser, opt, ids, sesion, formato, tema, res)
  await browser.close()
  if (json) fs.writeFileSync(json, JSON.stringify(res, null, 1))
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1) })

module.exports = { medirPagina }
