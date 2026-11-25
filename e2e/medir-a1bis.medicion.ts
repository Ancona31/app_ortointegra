import { test, expect, request, type Page, type Request } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { SESION, DIA_LABORABLE_LIBRE, arrastrarEventoPorMinutos } from './ayudas'

/**
 * MEDICIÓN A1-bis (diagnóstico). Requiere el build INSTRUMENTADO de
 * `AgendaCliente.tsx` (window.__agMed); con el build normal sólo mide red y DOM.
 * Corre con: npx playwright test --config=e2e/playwright.a1bis.config.ts
 */

const ETIQUETA = process.env.MEDICION_ETIQUETA || 'a1bis'

function psql(sql: string): string {
  return execFileSync('docker', ['exec', '-i', 'supabase_db_app_ortointegra', 'psql', '-U', 'postgres', '-tAq', '-c', sql], { encoding: 'utf8' }).trim()
}

interface Pet { t: number; metodo: string; ruta: string; tipo: string; ms?: number }

function categoria(r: Request): string | null {
  const u = new URL(r.url())
  if (u.pathname.startsWith('/_next/static')) return 'static'
  if (r.resourceType() === 'websocket') return null
  if (u.pathname.includes('/realtime/')) return null
  return 'x'
}

const INIT = () => {
  const w = window as unknown as Record<string, unknown>
  const dom = { added: 0, removed: 0, longN: 0, longMs: 0 }
  w.__agDom = dom
  const cuenta = (n: Node): number => {
    if (n.nodeType !== 1) return 0
    const el = n as Element
    return (el.matches('.fc-event') ? 1 : 0) + el.querySelectorAll('.fc-event').length
  }
  new MutationObserver(ms => {
    for (const m of ms) {
      m.addedNodes.forEach(n => { dom.added += cuenta(n) })
      m.removedNodes.forEach(n => { dom.removed += cuenta(n) })
    }
  }).observe(document, { subtree: true, childList: true })
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) { dom.longN++; dom.longMs += e.duration } })
      .observe({ type: 'longtask', buffered: true })
  } catch { /* sin longtask */ }
}

async function tomar(page: Page, red: Pet[], desde: { i: number }, fase: string, salida: Record<string, unknown>): Promise<void> {
  const datos = await page.evaluate(() => {
    const w = window as unknown as Record<string, Record<string, unknown> & { prev?: unknown }>
    const m = w.__agMed
    const dom = w.__agDom
    const copia = m ? JSON.parse(JSON.stringify({ ...m, prev: undefined })) : null
    const domCopia = { ...dom }
    if (m) Object.assign(m, { r: 0, causas: [], ec: 0, mec: 0, roUpd: 0, modal: 0, prof: [], reset: [], refinados: [], fcRender: [], datesSet: 0, eventsSet: 0, loading: 0 })
    Object.assign(dom, { added: 0, removed: 0, longN: 0, longMs: 0 })
    const md = (window as unknown as { __agModal?: { causas: string[] } }).__agModal
    const modalCausas = md ? [...md.causas] : []
    if (md) md.causas = []
    return { m: copia, dom: domCopia, eventos: document.querySelectorAll('.fc-event').length, modalCausas }
  })
  const pets = red.slice(desde.i)
  desde.i = red.length
  const porRuta: Record<string, number> = {}
  for (const p of pets) if (p.tipo !== 'static') porRuta[`${p.metodo} ${p.ruta}`] = (porRuta[`${p.metodo} ${p.ruta}`] ?? 0) + 1
  const estaticos = pets.filter(p => p.tipo === 'static').length
  const m = datos.m as null | {
    r: number; causas: { k: string[]; ms: number }[]; ec: number; mec: number; roUpd: number; modal: number
    prof: { id: string; fase: string; dur: number }[]; reset: { props: string[]; dur: number }[]
    refinados: { k: string[] }[]; fcRender: { ms: number }[]; datesSet: number; eventsSet: number; loading: number
  }
  const resumen = m ? {
    rendersAgenda: m.r,
    causas: m.causas.map(c => c.k.join(',') || '(ninguno: padre/contexto)'),
    msCuerpoAgenda: +m.causas.reduce((a, c) => a + c.ms, 0).toFixed(1),
    resetOptions: m.reset.length,
    resetPropsCambiadas: tally(m.reset.flatMap(r => r.props)),
    msResetOptions: +m.reset.reduce((a, r) => a + r.dur, 0).toFixed(1),
    refinadosConCambio: m.refinados.length,
    opcionesRefinadas: tally(m.refinados.flatMap(r => r.k)),
    fcRenders: m.fcRender.length,
    msFcRenders: +m.fcRender.reduce((a, r) => a + r.ms, 0).toFixed(1),
    profilerFcCommits: m.prof.length,
    msProfilerFc: +m.prof.reduce((a, p) => a + p.dur, 0).toFixed(1),
    eventContentLlamadas: m.ec,
    memoizedEventContentRenders: m.mec,
    resizeObserverUpdates: m.roUpd,
    appointmentModalRenders: m.modal,
    datesSet: m.datesSet, eventsSet: m.eventsSet, loading: m.loading,
  } : null
  const linea = pets.filter(p => p.tipo !== 'static').map(p => `${p.t}ms ${p.metodo} ${p.ruta}`)
  salida[fase] = { ...resumen, modalCausas: datos.modalCausas, dom: datos.dom, eventosEnDom: datos.eventos, peticiones: porRuta, linea, estaticos }
  console.log(`\n=== ${fase} ===\n` + JSON.stringify(salida[fase], null, 1))
}

function tally(xs: string[]): Record<string, number> {
  const o: Record<string, number> = {}
  for (const x of xs) o[x] = (o[x] ?? 0) + 1
  return o
}

function escuchar(page: Page, red: Pet[]): void {
  const t0 = Date.now()
  page.on('request', r => {
    const tipo = categoria(r)
    if (!tipo) return
    const u = new URL(r.url())
    const ruta = u.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id') + (u.searchParams.has('_rsc') ? '?_rsc' : '')
    red.push({ t: Date.now() - t0, metodo: r.method(), ruta, tipo })
  })
}

test.use({ storageState: SESION.adminA, viewport: { width: 1440, height: 900 } })

test('A1-bis: renders, refinados y peticiones por momento', async ({ page }) => {
  test.setTimeout(240_000)
  const salida: Record<string, unknown> = {}
  const red: Pet[] = []
  const desde = { i: 0 }
  escuchar(page, red)
  await page.addInitScript(INIT)

  const adminId = psql(`select id from auth.users where email='admin.a@semilla.spinus.test'`)
  const clinicaId = psql(`select clinica_id from profiles where id='${adminId}'`)
  const consultorioId = psql(`select id from consultorios where medico_id='${adminId}' and activo order by es_default desc limit 1`)
  const pacienteId = psql(`select id from pacientes where clinica_id='${clinicaId}' and apellidos='Prueba 07' limit 1`)

  // (a) abrir
  await page.goto('/agenda')
  await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 15000 })
  await page.waitForTimeout(4000)
  await tomar(page, red, desde, 'a_abrir', salida)

  // (a2) reposo 5 s: ¿algo se escribe solo?
  await page.waitForTimeout(5000)
  await tomar(page, red, desde, 'a2_reposo_5s', salida)

  // (b) semana siguiente (precargada) y vuelta
  await page.locator('.fc-next-button').click()
  await page.locator('.fc-event', { hasText: 'Sesión docente' }).first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(2500)
  await tomar(page, red, desde, 'b_semana_siguiente', salida)
  await page.locator('.fc-prev-button').click()
  await page.waitForTimeout(2500)
  await tomar(page, red, desde, 'b2_volver_semana', salida)

  // (c1) INSERT ajeno con paciente (secretaria por API)
  const sec = await request.newContext({ baseURL: 'http://localhost:3001', storageState: SESION.secretariaA })
  const titulo = `A1bis ajena ${Date.now().toString(36)}`
  const res = await sec.post('/api/appointments', {
    data: {
      title: titulo, start_time: new Date(`${DIA_LABORABLE_LIBRE}T16:00:00`).toISOString(),
      end_time: new Date(`${DIA_LABORABLE_LIBRE}T16:20:00`).toISOString(), all_day: false,
      medico_id: adminId, consultorio_id: consultorioId, paciente_id: pacienteId, client_id: randomUUID(),
    },
  })
  expect(res.ok()).toBeTruthy()
  const citaAjena = (await res.json()).appointment.id as string
  await page.waitForFunction(() => ((window as unknown as { __agMed?: { eventsSet: number } }).__agMed?.eventsSet ?? 0) > 0, undefined, { timeout: 10000 })
  await page.waitForTimeout(2500)
  await tomar(page, red, desde, 'c1_insert_ajeno_con_paciente', salida)

  // (c2) UPDATE de fondo sobre esa cita (lo que hace el after() de Google: sin tocar client_id)
  psql(`update appointments set gcal_sync_status='failed' where id='${citaAjena}'`)
  await page.waitForTimeout(3000)
  await tomar(page, red, desde, 'c2_update_fondo_ajeno', salida)

  // (c3) UPDATE ajeno por API (edición de la secretaria, mismo paciente)
  const put = await sec.put(`/api/appointments/${citaAjena}`, { data: { title: `${titulo} editada`, client_id: randomUUID() } })
  expect(put.ok()).toBeTruthy()
  await page.waitForTimeout(3000)
  await tomar(page, red, desde, 'c3_update_ajeno_api', salida)

  // (c4) navegar después de tiempo real: la caché de rangos se vació
  await page.locator('.fc-next-button').click()
  await page.locator('.fc-event', { hasText: 'Sesión docente' }).first().waitFor({ timeout: 10000 })
  await page.waitForTimeout(2500)
  await tomar(page, red, desde, 'c4_semana_sig_tras_rt', salida)
  await page.locator('.fc-prev-button').click()
  await page.waitForTimeout(2500)
  await tomar(page, red, desde, 'c4b_volver_tras_rt', salida)

  // (d) guardar una cita propia con paciente; conexión de Google FALSA para que
  // el POST programe el after() (fallará → UPDATE gcal_sync_status='failed')
  psql(`insert into clinica_conexiones_google (clinica_id, user_id, rol, estado, calendar_id) values ('${clinicaId}', '${adminId}', 'clinica', 'activa', 'falso-a1bis')`)
  try {
    await page.locator('[data-onboard="nueva-cita"]').click()
    await page.getByRole('dialog', { name: 'Nueva cita' }).waitFor()
    await page.waitForTimeout(1500)
    await tomar(page, red, desde, 'd0_abrir_modal', salida)
    await page.getByPlaceholder('Buscar paciente por nombre o apellido...').fill('Prueba 05')
    await page.getByRole('button', { name: /Paciente Prueba 05/ }).click()
    await page.locator('input[type="date"]').first().fill(DIA_LABORABLE_LIBRE)
    await page.locator('input[type="time"]').first().fill('12:05')
    await page.waitForTimeout(500)
    await tomar(page, red, desde, 'd1_rellenar_modal', salida)
    const resp = page.waitForResponse(r => r.url().endsWith('/api/appointments') && r.request().method() === 'POST')
    await page.getByRole('button', { name: 'Guardar' }).click()
    const rr = await resp
    const propia = (await rr.json()).appointment.id as string
    await page.waitForTimeout(6000)
    salida.d_estado_fila = psql(`select gcal_sync_status || ' ' || coalesce(google_event_id,'null') from appointments where id='${propia}'`)
    salida.d_modal_invitacion_visible = await page.getByRole('dialog').count()
    await tomar(page, red, desde, 'd_guardar_propia', salida)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(800)
    await tomar(page, red, desde, 'd2_cerrar_invitacion', salida)
  } finally {
    psql(`delete from clinica_conexiones_google where calendar_id='falso-a1bis'`)
  }

  // (e) arrastre +60 min de un evento propio a las 06:00, fuera de la franja
  // que llena el volumen (empieza a las 08:00): con 30k la rejilla está tan
  // apretada que arrastrar una tarjeta sembrada cae sobre otra.
  const tituloArrastre = `A1bis arrastre ${Date.now().toString(36)}`
  const alta = await sec.post('/api/appointments', {
    data: {
      title: tituloArrastre, start_time: new Date(`${DIA_LABORABLE_LIBRE}T06:00:00`).toISOString(),
      end_time: new Date(`${DIA_LABORABLE_LIBRE}T06:30:00`).toISOString(), all_day: false,
      medico_id: adminId, consultorio_id: consultorioId, client_id: randomUUID(),
    },
  })
  expect(alta.ok()).toBeTruthy()
  const evento = page.locator('.fc-timegrid-event', { hasText: tituloArrastre }).first()
  await evento.waitFor({ timeout: 10000 })
  await page.waitForTimeout(1500)
  await tomar(page, red, desde, 'e0_preparar_arrastre', salida)
  const putArr = page.waitForResponse(r => /\/api\/appointments\/[0-9a-f-]+$/.test(r.url()) && r.request().method() === 'PUT', { timeout: 15000 }).catch(() => null)
  await arrastrarEventoPorMinutos(page, evento, 60)
  const confirmar = page.getByRole('button', { name: 'Aceptar' })
  await confirmar.waitFor({ timeout: 2000 }).then(() => confirmar.click()).catch(() => undefined)
  salida.e_put = (await putArr) ? 'sí' : 'no salió PUT'
  await page.waitForTimeout(3000)
  await tomar(page, red, desde, 'e_arrastre', salida)

  // (f) volver al frente sin pasar el umbral
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await page.waitForTimeout(1500)
  await tomar(page, red, desde, 'f_visibilidad', salida)

  await sec.dispose()
  const dir = path.resolve('e2e/resultados')
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, `medir-a1bis-${ETIQUETA}.json`), JSON.stringify(salida, null, 2))
})
