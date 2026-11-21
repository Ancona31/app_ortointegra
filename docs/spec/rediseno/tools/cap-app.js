/* eslint-disable @typescript-eslint/no-require-imports -- script de desarrollo en CommonJS, fuera de src/ */
// cap-app.js — capturas de rutas REALES de la app en los cinco formatos del rediseño, claro y oscuro.
//
// Herramienta de desarrollo del rediseño (docs/spec/rediseno/). No es código de la app y no toca la base:
// sólo inicia sesión con el usuario de la semilla local y visita páginas.
//
// Requisitos: `next start -p 3001` en marcha sobre un build fresco, Supabase LOCAL con
// `scripts/agenda-semilla.ts` y, para la agenda v2, su interruptor encendido (GUIA_PRUEBAS_AGENDA_V2.md, P8).
//
// Uso (desde la raíz del repo):
//   node docs/spec/rediseno/tools/cap-app.js <carpeta-salida>
//        [--base http://localhost:3001] [--formatos ext,tel,ih,iv,esc] [--temas claro,oscuro]
//        [--solo dashboard,agenda-mes] [--usuario admin.a@semilla.spinus.test]
//        [--pid <uuid paciente>] [--cid <uuid consulta>] [--sin-franjas]
//
// Las franjas del sistema se emulan con CDP `Emulation.setSafeAreaInsetsOverride`, así que
// `env(safe-area-inset-*)` devuelve en la página lo mismo que en el dispositivo. Salvo con --sin-franjas,
// la captura pinta encima la franja con un rayado rojo para ver qué queda debajo.
// El oscuro es el de la app: `localStorage.theme = 'dark'` antes del primer pintado (ScriptTema.tsx),
// no `prefers-color-scheme`.
// Salida: <carpeta>/<ruta>@<formato>-<tema>.png y <carpeta>/indice.json (url final, errores de consola).
const { chromium } = require('@playwright/test')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFileSync } = require('child_process')

const CONTRASENA = 'Semilla-Agenda-2026' // ficticia y local (scripts/agenda-semilla.ts)

/** Los cinco formatos de kit/IMPLEMENTACION.md. `toque`: área mínima de toque que exige chk-app.js. */
const FORMATOS = {
  ext: { w: 466, h: 678, top: 0, right: 84, bottom: 34, left: 0, tactil: true, toque: 44 },
  tel: { w: 393, h: 852, top: 59, right: 0, bottom: 34, left: 0, tactil: true, toque: 44 },
  ih: { w: 951, h: 669, top: 0, right: 84, bottom: 34, left: 0, tactil: true, toque: 36 },
  iv: { w: 669, h: 951, top: 82, right: 0, bottom: 0, left: 0, tactil: true, toque: 44 },
  esc: { w: 1280, h: 800, top: 0, right: 0, bottom: 0, left: 0, tactil: false, toque: 36 },
}

/** Rutas en alcance. {PID}/{CID}: paciente y consulta de la semilla. `vista`: pestaña de la agenda. */
const RUTAS = [
  { n: 'dashboard', ruta: '/dashboard' },
  { n: 'expediente-lista', ruta: '/expediente' },
  { n: 'exp-resumen', ruta: '/expediente/{PID}' },
  { n: 'exp-consultas', ruta: '/expediente/{PID}?tab=consultas' },
  { n: 'exp-documentos', ruta: '/expediente/{PID}?tab=documentos' },
  { n: 'exp-mediciones', ruta: '/expediente/{PID}?tab=mediciones' },
  { n: 'exp-laboratorios', ruta: '/expediente/{PID}/laboratorios' },
  { n: 'exp-estado', ruta: '/expediente/{PID}/estado' },
  { n: 'paciente-nuevo', ruta: '/pacientes/nuevo' },
  { n: 'paciente-editar', ruta: '/expediente/{PID}/editar' },
  { n: 'nueva-nota', ruta: '/expediente/{PID}/nueva-nota' },
  { n: 'nota-consulta', ruta: '/expediente/{PID}/consulta/{CID}', requiere: 'CID' },
  { n: 'documentos', ruta: '/documentos' },
  { n: 'exp-docs-entrada', ruta: '/expediente/{PID}/documentos' },
  { n: 'documento-receta', ruta: '/expediente/{PID}/documentos?tipo=receta' },
  { n: 'perfil', ruta: '/perfil' },
  { n: 'admin-usuarios', ruta: '/admin/usuarios' },
  { n: 'billing', ruta: '/billing' },
  { n: 'estadisticas', ruta: '/estadisticas' },
  { n: 'ayuda', ruta: '/ayuda' },
  { n: 'suplementacion', ruta: '/suplementacion' },
  { n: 'agenda-dia', ruta: '/agenda', vista: 'Día' },
  { n: 'agenda-semana', ruta: '/agenda', vista: 'Semana' },
  { n: 'agenda-mes', ruta: '/agenda', vista: 'Mes' },
  { n: 'agenda-config', ruta: '/agenda/configuracion' },
]

function leerArgs(argv) {
  const a = argv.slice(2)
  const get = (f, d) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : d }
  const lista = (f, d) => get(f, d).split(',').filter(Boolean)
  return {
    salida: a[0] && !a[0].startsWith('--') ? a[0] : null,
    base: get('--base', 'http://localhost:3001'),
    formatos: lista('--formatos', Object.keys(FORMATOS).join(',')),
    temas: lista('--temas', 'claro,oscuro'),
    solo: get('--solo') ? lista('--solo') : null,
    usuario: get('--usuario', 'admin.a@semilla.spinus.test'),
    pid: get('--pid'), cid: get('--cid'),
    franjas: !a.includes('--sin-franjas'),
  }
}

/** psql en la base LOCAL de la semilla (el mismo contenedor que usan e2e/ayudas.ts y la semilla). */
function sqlLocal(sql) {
  return execFileSync('docker', ['exec', '-i', 'supabase_db_app_ortointegra', 'psql', '-U', 'postgres', '-X', '-tAq', '-c', sql],
    { encoding: 'utf8' }).trim()
}

/** Paciente de la Clínica Semilla A (el que más consultas tenga) y su consulta más reciente, si la hay. */
function resolverIds(opt) {
  if (opt.pid) return { PID: opt.pid, CID: opt.cid || null }
  const fila = sqlLocal(`select p.id || '|' || coalesce((select c.id::text from public.consultas c where c.paciente_id = p.id
      order by c.created_at desc limit 1), '') from public.pacientes p join public.clinicas cl on cl.id = p.clinica_id
    where cl.nombre = 'Clínica Semilla A' and p.activo is not false
    order by (select count(*) from public.consultas c where c.paciente_id = p.id) desc, p.created_at limit 1`)
  const [PID, CID] = fila.split('|')
  if (!PID) throw new Error('No hay pacientes de la Clínica Semilla A: corre scripts/agenda-semilla.ts')
  return { PID, CID: opt.cid || CID || null }
}

/** Inicia sesión por la UI de /login (como e2e/ayudas.ts) y devuelve la ruta del storageState. */
async function iniciarSesion(browser, base, usuario) {
  const ctx = await browser.newContext({ baseURL: base, locale: 'es-MX', timezoneId: 'America/Merida' })
  const page = await ctx.newPage()
  await page.goto('/login')
  await page.getByLabel('Correo electrónico', { exact: true }).fill(usuario)
  await page.getByLabel('Contraseña', { exact: true }).fill(CONTRASENA)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 })
  const archivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cap-app-')), 'sesion.json')
  await ctx.storageState({ path: archivo })
  await ctx.close()
  return archivo
}

/** Contexto con el formato, el tema y las franjas emuladas. Recoge los errores de consola en `errores`. */
async function nuevaPagina(browser, { base, sesion, formato, tema }) {
  const f = FORMATOS[formato]
  const ctx = await browser.newContext({
    baseURL: base, storageState: sesion, viewport: { width: f.w, height: f.h }, deviceScaleFactor: 2,
    isMobile: f.tactil, hasTouch: f.tactil, locale: 'es-MX', timezoneId: 'America/Merida',
  })
  await ctx.addInitScript((oscuro) => {
    try { if (oscuro) localStorage.setItem('theme', 'dark'); else localStorage.setItem('theme', 'light') } catch { /* privado */ }
  }, tema === 'oscuro')
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: f.top, right: f.right, bottom: f.bottom, left: f.left } })
  const errores = []
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 200)) })
  page.on('pageerror', (e) => errores.push('pageerror: ' + String(e.message).slice(0, 200)))
  return { ctx, page, errores, f }
}

/** Pulsa la pestaña/botón de vista de la agenda con ese nombre exacto, el primero visible. */
async function elegirVista(page, nombre) {
  for (const rol of ['tab', 'radio', 'button', 'menuitemradio']) {
    const loc = page.getByRole(rol, { name: nombre, exact: true })
    const n = await loc.count()
    for (let i = 0; i < n; i++) {
      if (await loc.nth(i).isVisible()) { await loc.nth(i).click(); await page.waitForTimeout(1000); return true }
    }
  }
  return false
}

/** Navega a la ruta, espera a que se asiente y, si la ruta lo pide, cambia de vista. */
async function irA(page, ruta, ids) {
  const url = ruta.ruta.replace('{PID}', ids.PID).replace('{CID}', ids.CID || '')
  await page.goto(url, { waitUntil: 'load', timeout: 60000 })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1200)
  const nota = []
  if (ruta.vista && !(await elegirVista(page, ruta.vista))) nota.push(`sin control de vista «${ruta.vista}»`)
  return { url, final: new URL(page.url()).pathname + new URL(page.url()).search, nota }
}

/** Rayado rojo sobre las franjas, para ver en la captura qué queda debajo. */
async function pintarFranjas(page, f) {
  await page.evaluate((f) => {
    const raya = 'background:repeating-linear-gradient(45deg,rgba(220,38,38,.30) 0 6px,rgba(220,38,38,.10) 6px 12px);'
    const caja = (css) => { const d = document.createElement('div'); d.dataset.franjaCap = ''; d.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;' + raya + css; document.body.appendChild(d) }
    if (f.right) caja(`top:0;right:0;width:${f.right}px;height:100%;`)
    if (f.left) caja(`top:0;left:0;width:${f.left}px;height:100%;`)
    if (f.top) caja(`top:0;left:0;width:100%;height:${f.top}px;`)
    if (f.bottom) caja(`left:0;bottom:0;width:100%;height:${f.bottom}px;`)
  }, f)
}

function rutasElegidas(opt, ids) {
  return RUTAS.filter((r) => (!opt.solo || opt.solo.includes(r.n)) && (r.requiere !== 'CID' || ids.CID))
}

async function capturarFormato(browser, opt, ids, sesion, formato, tema, indice) {
  const { ctx, page, errores, f } = await nuevaPagina(browser, { base: opt.base, sesion, formato, tema })
  for (const ruta of rutasElegidas(opt, ids)) {
    const clave = `${ruta.n}@${formato}-${tema}`
    errores.length = 0
    try {
      const r = await irA(page, ruta, ids)
      if (opt.franjas) await pintarFranjas(page, f)
      await page.screenshot({ path: path.join(opt.salida, clave + '.png') })
      indice[clave] = { ...r, errores: [...errores] }
      console.log(clave, r.final, errores.length ? `errores=${errores.length}` : '', r.nota.join('; '))
    } catch (e) {
      indice[clave] = { fallo: String(e.message).slice(0, 200) }
      console.log('FALLO', clave, String(e.message).slice(0, 120))
    }
  }
  await ctx.close()
}

async function main() {
  const opt = leerArgs(process.argv)
  if (!opt.salida) { console.error('Uso: node cap-app.js <carpeta-salida> [opciones] (ver cabecera)'); process.exit(2) }
  fs.mkdirSync(opt.salida, { recursive: true })
  const ids = resolverIds(opt)
  if (!ids.CID) console.log('AVISO: el paciente no tiene consultas; se omite «nota-consulta» (pasa --cid).')
  const browser = await chromium.launch()
  const sesion = await iniciarSesion(browser, opt.base, opt.usuario)
  const indice = { ids, base: opt.base, fecha: new Date().toISOString() }
  for (const formato of opt.formatos) for (const tema of opt.temas) await capturarFormato(browser, opt, ids, sesion, formato, tema, indice)
  await browser.close()
  fs.writeFileSync(path.join(opt.salida, 'indice.json'), JSON.stringify(indice, null, 1))
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1) })

module.exports = { FORMATOS, RUTAS, leerArgs, resolverIds, iniciarSesion, nuevaPagina, irA, rutasElegidas }
