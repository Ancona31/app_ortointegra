import { test, expect, type Browser, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { SESION, ventanasVecinasDeLaSemilla, esUnaDeEstasVentanas } from './ayudas'

/**
 * Semilla de la primera pintura (A1.4c): `agenda/page.tsx` siembra desde el
 * servidor W-1, W y W+1, y `AgendaCliente` la guarda en la caché de rangos con
 * las claves que pedirá FullCalendar. Abrir y moverse una semana a cada lado no
 * pide `GET /api/appointments` PARA ESAS TRES SEMANAS.
 *
 * ⚠️ DESDE A1.5b YA NO ES «CERO PETICIONES» A SECAS, Y LA PRUEBA ES UNA LISTA
 * PERMITIDA, NO UN DESCARTE. Moverse hasta el BORDE del trío sembrado (W-1 o
 * W+1) dispara, en ocioso, la precarga de SU propio vecino de fuera —W-2 o
 * W+2—, que la semilla no cubre y que es exactamente el comportamiento nuevo
 * que esa precarga viene a dar (ver `agenda-cache-rangos.e2e.ts`, que la
 * prueba a propósito). Lo único que se tolera es ESO: los `GET` de W-2
 * (`semanaAnterior` de la primera ventana) y W+2 (`semanaSiguiente` de la
 * última). Cualquier otro —una de las TRES sembradas, o cualquier cosa más
 * allá de esos dos vecinos— es un fallo real.
 *
 * Señales de semana, de `scripts/agenda-semilla.ts` (todas de admin.a, que la
 * secretaria también ve): «Bloqueo de agenda» sólo en la anterior, «Cirugía
 * programada» sólo en la actual y «Sesión docente» sólo en la siguiente.
 */
const ANTERIOR = '.fc-prev-button:visible, [aria-label="Periodo anterior"]:visible'
const SIGUIENTE = '.fc-next-button:visible, [aria-label="Periodo siguiente"]:visible'

/** `psql` en la base local, el mismo contenedor que `scripts/agenda-semilla.ts`. */
function sqlLocal(sql: string): string {
  return execFileSync('docker', ['exec', '-i', 'supabase_db_app_ortointegra', 'psql', '-U', 'postgres', '-tAq', '-c', sql],
    { encoding: 'utf8' }).trim()
}

/**
 * Deja la base QUIETA para Realtime antes de abrir: todo lo escrito hasta aquí
 * ya lo consumió el poller, así que no le puede llegar a la página que se abre
 * después.
 *
 * ⚠️ SIN ESTO LA PRUEBA FALLA A RATOS, Y LA APP HACE LO CORRECTO. La prueba de
 * antes (`agenda-secretaria.e2e.ts`) termina con un alta. El poller de Realtime
 * lee la WAL con retraso (0,3–0,5 s en ocioso) y decide a quién entregar cada
 * cambio AL LEERLO, con las suscripciones de ese momento: si la agenda de aquí
 * ya se suscribió, le llega ese INSERT ajeno —anterior a ella y ya incluido en
 * su semilla—, vacía la caché (cualquier evento la vacía, a propósito) y
 * W-1, W y W+1 se piden a la red. Medido: provocando el alta justo antes de
 * abrir falla 7 de 12, cada fallo con su `postgres_changes` y ningún acierto
 * con él; igual sin A1.5b (8 de 12).
 *
 * Por qué así: una vez que el slot de Realtime confirmó una posición de la
 * WAL, lo anterior ya se repartió y no se vuelve a repartir. La página de usar
 * y tirar va primero porque, si nadie escuchó en 10 min, Realtime para el
 * poller y el slot no avanza hasta que alguien se suscribe: sin ella, esa
 * espera no acabaría nunca, y el primero en suscribirse —la página medida—
 * se llevaría lo pendiente.
 */
async function esperarRealtimeAlDia(browser: Browser): Promise<void> {
  const contexto = await browser.newContext({ storageState: SESION.adminA })
  try {
    const page = await contexto.newPage()
    let suscrita = false
    page.on('websocket', ws => ws.on('framereceived', ({ payload }) => {
      if (String(payload).includes('Subscribed to PostgreSQL')) suscrita = true
    }))
    await page.goto('/agenda')
    await expect.poll(() => suscrita, { timeout: 10000 }).toBe(true)
    const lsn = sqlLocal('select pg_current_wal_lsn()')
    await expect.poll(() => sqlLocal(
      `select confirmed_flush_lsn >= '${lsn}' from pg_replication_slots where slot_name = 'supabase_realtime_replication_slot_'`,
    ), { timeout: 10000, intervals: [100] }).toBe('t')
  } finally {
    await contexto.close()
  }
}

async function abrirYRecorrer(page: Page, browser: Browser): Promise<string[]> {
  await esperarRealtimeAlDia(browser)
  const pedidas: string[] = []
  page.on('request', r => { if (r.url().includes('/api/appointments?') && r.method() === 'GET') pedidas.push(r.url()) })
  await page.goto('/agenda')
  await expect(page.locator('.fc-event', { hasText: 'Cirugía programada' }).first()).toBeVisible({ timeout: 15000 })
  await page.locator(ANTERIOR).first().click()
  await expect(page.locator('.fc-event', { hasText: 'Bloqueo de agenda' }).first()).toBeVisible({ timeout: 5000 })
  await page.locator(SIGUIENTE).first().click()
  await page.locator(SIGUIENTE).first().click()
  await expect(page.locator('.fc-event', { hasText: 'Sesión docente' }).first()).toBeVisible({ timeout: 5000 })
  // «No salió nada» no tiene evento: un respiro corto para lo que pudiera salir.
  await page.waitForTimeout(500)
  // Lista PERMITIDA: W-2 y W+2 (ver cabecera), nada más.
  return pedidas.filter(url => !esUnaDeEstasVentanas(url, ventanasVecinasDeLaSemilla()))
}

test.describe('admin (filtro: él mismo)', () => {
  test.use({ storageState: SESION.adminA })
  test('A1.4c: abrir no pide citas; la semana anterior y la siguiente se pintan sin petición', async ({ page, browser }) => {
    expect(await abrirYRecorrer(page, browser)).toEqual([])
  })
})

test.describe('secretaria (filtro: todos)', () => {
  test.use({ storageState: SESION.secretariaA })
  test('A1.4c: abrir no pide citas; la semana anterior y la siguiente se pintan sin petición', async ({ page, browser }) => {
    expect(await abrirYRecorrer(page, browser)).toEqual([])
  })
})
