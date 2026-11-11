import { test, type Page, type Request } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { SESION, DIA_LABORABLE_LIBRE } from './ayudas'

/**
 * MEDICIÓN A1-bis (diagnóstico): registro de red de una sesión de uso normal de
 * ~2 minutos y latencia de las rutas que se repiten. Ver `medir-a1bis.medicion.ts`.
 */

const ETIQUETA = process.env.MEDICION_ETIQUETA || 'a1bis'
function psql(sql: string): string {
  return execFileSync('docker', ['exec', '-i', 'supabase_db_app_ortointegra', 'psql', '-U', 'postgres', '-tAq', '-c', sql], { encoding: 'utf8' }).trim()
}

interface Pet { t: number; paso: string; metodo: string; ruta: string }

test.use({ storageState: SESION.adminA, viewport: { width: 1440, height: 900 } })

function escuchar(page: Page, red: Pet[], paso: { v: string }): void {
  const t0 = Date.now()
  page.on('request', (r: Request) => {
    const u = new URL(r.url())
    if (u.pathname.startsWith('/_next/static') || r.resourceType() === 'websocket' || u.pathname.includes('/realtime/')) return
    const ruta = u.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id') + (u.searchParams.has('_rsc') ? '?_rsc' : '')
    red.push({ t: Date.now() - t0, paso: paso.v, metodo: r.method(), ruta })
  })
}

test('A1-bis: sesión de uso normal (~2 min)', async ({ page }) => {
  test.setTimeout(300_000)
  const red: Pet[] = []
  const paso = { v: 'abrir' }
  escuchar(page, red, paso)
  const inicio = Date.now()
  const marcar = async (v: string, espera = 1500) => { await page.waitForTimeout(espera); paso.v = v }

  await page.goto('/agenda')
  await page.locator('.fc-event').first().waitFor({ timeout: 15000 })
  await marcar('semana +1')
  await page.locator('.fc-next-button').click()
  await marcar('semana +2')
  await page.locator('.fc-next-button').click()
  await marcar('semana +1 (vuelta)')
  await page.locator('.fc-prev-button').click()
  await marcar('hoy')
  await page.locator('.fc-today-button').click()
  await marcar('vista Día')
  await page.getByRole('tab', { name: 'Día' }).click()
  await marcar('vista Mes')
  await page.getByRole('tab', { name: 'Mes' }).click()
  await marcar('vista Semana')
  await page.getByRole('tab', { name: 'Semana' }).click()
  await marcar('abrir cita existente')
  await page.locator('.fc-timegrid-event').filter({ hasText: 'Paciente' }).first().click({ force: true, timeout: 5000 })
  await page.getByRole('dialog').first().waitFor()
  await marcar('cerrar cita')
  await page.keyboard.press('Escape')
  await marcar('crear evento')
  await page.locator('[data-onboard="nueva-cita"]').click()
  await page.getByRole('tab', { name: 'Evento' }).click()
  await page.getByPlaceholder('Cirugía Sr. Pérez, Junta de personal, Bloqueo…').fill(`Sesión A1bis ${Date.now().toString(36)}`)
  await page.locator('input[type="date"]').first().fill(DIA_LABORABLE_LIBRE)
  await page.locator('input[type="time"]').first().fill('13:10')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await marcar('ir a /dashboard', 3000)
  await page.locator('a[href="/dashboard"]:visible').first().click()
  await page.waitForURL('**/dashboard')
  await marcar('dashboard: 3 × visibilitychange', 3000)
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await page.waitForTimeout(1000)
  }
  await marcar('volver a /agenda')
  await page.locator('a[href="/agenda"]:visible').first().click()
  await page.waitForURL('**/agenda')
  await page.locator('.fc-event').first().waitFor({ timeout: 15000 })
  await marcar('agenda: visibilitychange')
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await marcar('reposo hasta 2 min')
  const resto = 120_000 - (Date.now() - inicio)
  if (resto > 0) await page.waitForTimeout(resto)

  // Latencia de rutas repetidas (en serie, sesión de admin.a)
  const adminId = psql(`select id from auth.users where email='admin.a@semilla.spinus.test'`)
  const citaId = psql(`select id from appointments where medico_id='${adminId}' and paciente_id is not null order by start_time desc limit 1`)
  const lunes = new Date(`${DIA_LABORABLE_LIBRE}T00:00:00-06:00`)
  lunes.setUTCDate(lunes.getUTCDate() - 3)
  const fin = new Date(+lunes + 7 * 864e5)
  const lat: Record<string, number[]> = {}
  const medirRuta = async (nombre: string, url: string) => {
    for (let i = 0; i < 15; i++) {
      const t0 = Date.now()
      const r = await page.request.get(url)
      await r.body()
      ;(lat[nombre] ??= []).push(Date.now() - t0)
    }
  }
  await medirRuta('GET /api/appointments/:id', `/api/appointments/${citaId}`)
  await medirRuta('GET /api/appointments (semana, médico)', `/api/appointments?from=${lunes.toISOString()}&to=${fin.toISOString()}&medico_id=${adminId}`)
  await medirRuta('GET /api/google/events (semana)', `/api/google/events?from=${lunes.toISOString()}&to=${fin.toISOString()}&medico_id=${adminId}`)
  const mediana = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
  const latencias = Object.fromEntries(Object.entries(lat).map(([k, v]) => [k, { mediana: mediana(v.slice(2)), min: Math.min(...v), max: Math.max(...v) }]))

  const porPaso: Record<string, Record<string, number>> = {}
  for (const p of red) { (porPaso[p.paso] ??= {})[`${p.metodo} ${p.ruta}`] = ((porPaso[p.paso] ??= {})[`${p.metodo} ${p.ruta}`] ?? 0) + 1 }
  const total: Record<string, number> = {}
  for (const p of red) if (!p.ruta.startsWith('/api/appointments?') ) total[`${p.metodo} ${p.ruta}`] = (total[`${p.metodo} ${p.ruta}`] ?? 0) + 1
  const salida = { porPaso, total, latencias }
  console.log(JSON.stringify(salida, null, 1))
  const dir = path.resolve('e2e/resultados'); mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, `medir-a1bis-sesion-${ETIQUETA}.json`), JSON.stringify(salida, null, 2))
})
