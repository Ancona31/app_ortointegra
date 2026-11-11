import { test, expect, request, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import {
  irAAgenda, soloEscritorio, SESION, diaDeLaSemana, tituloUnico, toastConTexto,
  observarEcosRealtime, selectFiltroMedico, ventanasVecinasDeLaSemilla, esUnaDeEstasVentanas,
} from './ayudas'

/**
 * Caché de rangos de citas (A1.5a, `src/lib/agenda/cacheRangosCitas.ts`).
 * Volver a lo ya visto no pregunta; cualquier escritura propia o evento de
 * tiempo real lo vacía, así que después de un cambio SÍ pregunta.
 *
 * También la precarga de semanas vecinas (A1.5b): tras pintar Semana o
 * Día-lista, W-1 y W+1 de la vista que se está mirando llegan solas, en
 * ocioso.
 *
 * Señales de semana, de la semilla (`scripts/agenda-semilla.ts`): «Cirugía
 * programada» sólo existe en la actual, «Sesión docente» sólo en la
 * siguiente y «Videollamada con proveedor» (`invitadoA`, `dia(2,2)`) sólo
 * dos semanas adelante — por ser de la médica invitada, las pruebas que la
 * usan necesitan el filtro «Todos los médicos» (ver `agenda-arrastre.e2e.ts`).
 * Sólo escritorio: usa `.fc-next-button`/`.fc-prev-button`.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

const EVENTO_ACTUAL = 'Cirugía programada'
const EVENTO_SIGUIENTE = 'Sesión docente'
const EVENTO_DOS_SEMANAS = 'Videollamada con proveedor'

const esGetCitas = (r: { url(): string; method(): string }): boolean =>
  r.url().includes('/api/appointments?') && r.method() === 'GET'

/** Lo mismo que `esGetCitas`, sobre una RESPUESTA en vez de una petición. */
const esRespuestaCitas = (r: { url(): string; request(): { method(): string } }): boolean =>
  r.url().includes('/api/appointments?') && r.request().method() === 'GET'

/** Cuenta los `GET /api/appointments` desde ahora; `parar()` deja de contar. */
function contarGetCitas(page: Page): { veces: () => number; parar: () => void } {
  let n = 0
  const ver = (r: { url(): string; method(): string }): void => { if (esGetCitas(r)) n++ }
  page.on('request', ver)
  return { veces: () => n, parar: () => page.off('request', ver) }
}

async function irASemana(page: Page, boton: 'next' | 'prev', senal: string): Promise<void> {
  await page.locator(boton === 'next' ? '.fc-next-button' : '.fc-prev-button').click()
  await expect(page.locator('.fc-event', { hasText: senal }).first()).toBeVisible({ timeout: 10000 })
}

/** El médico y el consultorio por defecto del modal de alta de admin.a. */
async function idsPorDefecto(page: Page): Promise<{ medicoId: string; consultorioId: string }> {
  await page.locator('[data-onboard="nueva-cita"]').click()
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toBeVisible()
  await page.getByRole('tab', { name: 'Evento' }).click()
  const medicoId = await dialogo.locator('select').nth(0).inputValue()
  const consultorioId = await dialogo.locator('select').nth(1).inputValue()
  if (!medicoId || !consultorioId) throw new Error('no se pudo leer medico_id/consultorio_id por defecto del modal')
  await page.keyboard.press('Escape')
  await expect(dialogo).toBeHidden()
  return { medicoId, consultorioId }
}

test('volver a una semana ya vista no pide /api/appointments y las citas están', async ({ page }) => {
  await irAAgenda(page)
  await expect(page.locator('.fc-event', { hasText: EVENTO_ACTUAL }).first()).toBeVisible()
  await irASemana(page, 'next', EVENTO_SIGUIENTE)

  const peticiones = contarGetCitas(page)
  await irASemana(page, 'prev', EVENTO_ACTUAL)
  // «No ocurrió nada» no tiene evento: un respiro corto para lo que pudiera salir.
  await page.waitForTimeout(500)
  peticiones.parar()
  expect(peticiones.veces()).toBe(0)
})

test('una cita propia vacía la caché: al volver a su semana se pregunta y la cita sigue', async ({ page }) => {
  await irAAgenda(page)
  await page.locator('[data-onboard="nueva-cita"]').click()
  await page.getByRole('tab', { name: 'Evento' }).click()
  const titulo = tituloUnico('Evento caché de rangos E2E')
  await page.getByPlaceholder('Cirugía Sr. Pérez, Junta de personal, Bloqueo…').fill(titulo)
  // El LUNES y no `DIA_LABORABLE_LIBRE`: el jueves ya lo reparten otros
  // archivos, y una tarjeta más a esa hora tapaba el clic de
  // `agenda-tiempo-real.e2e.ts` (ver la nota de `DIA_LABORABLE_LIBRE`).
  await page.locator('input[type="date"]').first().fill(diaDeLaSemana(0, 0))
  await page.locator('input[type="time"]').first().fill('16:00')
  const respAlta = page.waitForResponse(r => r.url().includes('/api/appointments') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Guardar' }).click()
  expect((await respAlta).ok()).toBeTruthy()
  await expect(toastConTexto(page, 'Se agendó correctamente')).toBeVisible({ timeout: 10000 })

  await irASemana(page, 'next', EVENTO_SIGUIENTE)
  const vuelta = page.waitForRequest(esGetCitas, { timeout: 5000 })
  await irASemana(page, 'prev', EVENTO_ACTUAL)
  // Primero la cita: con una caché que no invalida, la semana sale de lo
  // guardado ANTES del alta y la cita desaparece. Después, que sí se preguntó.
  await expect(page.locator('.fc-event', { hasText: titulo })).toHaveCount(1)
  await vuelta
})

test('una cita ajena en otra semana vacía la caché por tiempo real: al ir a esa semana aparece', async ({ page }) => {
  const esperarEco = observarEcosRealtime(page)
  await irAAgenda(page)
  const { medicoId, consultorioId } = await idsPorDefecto(page)
  // La semana siguiente queda guardada en la caché, y se vuelve a la actual.
  await irASemana(page, 'next', EVENTO_SIGUIENTE)
  await irASemana(page, 'prev', EVENTO_ACTUAL)

  const titulo = tituloUnico('Evento ajeno caché de rangos E2E')
  const dia = diaDeLaSemana(1, 3)
  const clientId = randomUUID()
  const comoSecretaria = await request.newContext({ baseURL: 'http://localhost:3001', storageState: SESION.secretariaA })
  const res = await comoSecretaria.post('/api/appointments', {
    data: {
      title: titulo,
      start_time: new Date(`${dia}T16:40:00`).toISOString(),
      end_time: new Date(`${dia}T17:00:00`).toISOString(),
      all_day: false,
      medico_id: medicoId,
      consultorio_id: consultorioId,
      client_id: clientId,
    },
  })
  expect(res.ok()).toBeTruthy()
  await comoSecretaria.dispose()
  // El evento de tiempo real tiene que haber llegado ANTES de navegar: es lo
  // que vacía la caché, y lo que esta prueba quiere ver.
  await esperarEco(clientId)

  await irASemana(page, 'next', EVENTO_SIGUIENTE)
  await expect(page.locator('.fc-event', { hasText: titulo })).toBeVisible({ timeout: 10000 })
})

test('agenda → dashboard → agenda pinta sin petición bloqueante', async ({ page }) => {
  await irAAgenda(page)
  await expect(page.locator('.fc-event', { hasText: EVENTO_ACTUAL }).first()).toBeVisible()
  await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await page.waitForURL('**/dashboard')
  await page.waitForLoadState('networkidle')

  const peticiones = contarGetCitas(page)
  await page.getByRole('link', { name: 'Agenda', exact: true }).click()
  await expect(page.locator('.fc-event', { hasText: EVENTO_ACTUAL }).first()).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(500)
  peticiones.parar()
  expect(peticiones.veces()).toBe(0)
})

/* ── A1.5b · precarga de semanas vecinas ──────────────────────────────── */

test('precarga en ocioso: tras pintar W+1 llega W+2 sola, y pasar ahí no pide ni se demora', async ({ page }) => {
  await irAAgenda(page)
  // «Videollamada con proveedor» es de la médica invitada: hace falta
  // «Todos los médicos» para verla, igual que en `agenda-arrastre.e2e.ts`.
  await selectFiltroMedico(page).selectOption({ label: 'Todos los médicos' })
  await expect(page.locator('.fc-event', { hasText: EVENTO_ACTUAL }).first()).toBeVisible()

  await irASemana(page, 'next', EVENTO_SIGUIENTE) // W+1: petición real; W ya estaba cacheada

  /* Tras pintar W+1 la precarga trae, EN SERIE, W (ya cacheada — no pide) y
     W+2 (sí pide). Se espera esa respuesta antes de medir el salto siguiente,
     o se estaría esperando la MISMA petición que esto viene a demostrar que
     ya no hace falta. */
  const respuestaPrecarga = await page.waitForResponse(esRespuestaCitas, { timeout: 5000 })
  expect(respuestaPrecarga.ok()).toBeTruthy()
  /* ⚠️ NO BASTA CON QUE SEA «LA PRIMERA RESPUESTA QUE LLEGÓ»: tiene que ser
     justo la de W+2 —calculada aparte, no leída de la propia respuesta—, o
     esta prueba validaría cualquier petición que hubiera salido primero,
     viniera o no de la precarga que dice probar. */
  const rangoW2 = [ventanasVecinasDeLaSemilla()[1]] // W-2, W+2 — el segundo es W+2
  expect(esUnaDeEstasVentanas(respuestaPrecarga.url(), rangoW2)).toBe(true)
  await page.waitForTimeout(100) // el `guardarCitas` que sigue al `.json()` de la respuesta

  /* ⚠️ NO SE CUENTA «CUALQUIER» PETICIÓN DESPUÉS DE ÉSTA: pintar W+2 dispara
     su PROPIA precarga (la de SUS vecinas, W+1 y W+3), y W+3 sí pide red —
     eso es lo correcto, no lo que esta prueba vigila. Lo que tiene que
     quedar en cero es que NADIE vuelva a pedir el MISMO rango de W+2 que ya
     trajo la precarga: ésa es «pasar a W+2 no pide». */
  const pedidas: string[] = []
  const verPedidas = (r: { url(): string; method(): string }): void => { if (esGetCitas(r)) pedidas.push(r.url()) }
  page.on('request', verPedidas)
  await page.locator('.fc-next-button').click()
  await expect(page.locator('.fc-event', { hasText: EVENTO_DOS_SEMANAS }).first()).toBeVisible({ timeout: 3000 })
  await page.waitForTimeout(300)
  page.off('request', verPedidas)
  expect(pedidas.filter(u => esUnaDeEstasVentanas(u, rangoW2))).toEqual([])
})

/* ⚠️ GRAVE de la revisión independiente — reproducido y corregido: el mapa
 * de citas en vuelo (`citasEnVueloRef`) es independiente de
 * `cacheRangosCitas` y `vaciarCacheCitas()` no lo toca. Sin la generación en
 * cada entrada, una promesa que salió ANTES de un vaciado podía devolverse a
 * quien pide DESPUÉS: datos de antes de la cita que acaba de llegar por
 * tiempo real, servidos como si fueran los de ahora, hasta el refresco de
 * foco (2 min). Corregido en `traerCitasDeduplicado`/`TraidaEnVuelo`
 * (AgendaCliente.tsx): sólo se reutiliza la promesa en vuelo si su
 * generación coincide con la VIGENTE.
 */
test('precarga en vuelo durante un vaciado: no debe entregar datos de antes del vaciado', async ({ page }) => {
  const esperarEco = observarEcosRealtime(page)
  /* Retiene la RESPUESTA (no la petición) de toda GET de citas unos segundos:
     ⚠️ `route.fetch()` ANTES de la demora es la parte que importa. Si en vez
     de eso se demorara con `route.continue()` —retener el ENVÍO—, la consulta
     de la precarga llegaría al servidor DESPUÉS del POST de la secretaria, y
     el cuerpo que trajera ya incluiría la cita nueva: no reproduciría nada,
     la promesa en vuelo sería "vieja" sólo de nombre. Disparando la petición
     real DE INMEDIATO y demorando sólo la ENTREGA de lo que ya contestó el
     servidor, la respuesta que queda en vuelo es de verdad de ANTES del
     vaciado. Mount y la primera navegación a W+1 vienen de la semilla del
     servidor (A1.4c, sin red), así que lo único que esta ruta llega a
     retener es la precarga. */
  await page.route('**/api/appointments?**', async route => {
    const respuesta = await route.fetch()
    await new Promise(resolve => setTimeout(resolve, 4000))
    await route.fulfill({ response: respuesta })
  })

  await irAAgenda(page)
  const { medicoId, consultorioId } = await idsPorDefecto(page)
  await expect(page.locator('.fc-event', { hasText: EVENTO_ACTUAL }).first()).toBeVisible()

  await irASemana(page, 'next', EVENTO_SIGUIENTE) // W+1: dispara, en ocioso, la precarga de W+2 (retenida por la ruta)

  // Mientras esa precarga sigue en vuelo, una cita AJENA llega por tiempo
  // real en la MISMA semana que se está precargando y vacía la caché.
  const titulo = tituloUnico('Evento precarga en vuelo E2E')
  const dia = diaDeLaSemana(2, 2)
  const clientId = randomUUID()
  const comoSecretaria = await request.newContext({ baseURL: 'http://localhost:3001', storageState: SESION.secretariaA })
  const res = await comoSecretaria.post('/api/appointments', {
    data: {
      title: titulo,
      start_time: new Date(`${dia}T15:00:00`).toISOString(),
      end_time: new Date(`${dia}T15:20:00`).toISOString(),
      all_day: false,
      medico_id: medicoId,
      consultorio_id: consultorioId,
      client_id: clientId,
    },
  })
  expect(res.ok()).toBeTruthy()
  await comoSecretaria.dispose()
  await esperarEco(clientId) // confirma que el vaciado ya ocurrió

  // A W+2: si se reutilizara la promesa en vuelo de ANTES del vaciado, la
  // cita nunca llegaría — ni siquiera esperando más.
  await page.locator('.fc-next-button').click()
  await expect(page.locator('.fc-event', { hasText: titulo })).toBeVisible({ timeout: 10000 })
})

test('en vista Mes no se programa ninguna precarga', async ({ page }) => {
  await irAAgenda(page)
  await page.getByRole('tab', { name: 'Mes' }).click()
  await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible()
  await page.waitForLoadState('networkidle')

  const peticiones = contarGetCitas(page)
  // Tiempo ocioso de sobra: si Mes precargara, ya habría pedido.
  await page.waitForTimeout(3000)
  peticiones.parar()
  expect(peticiones.veces()).toBe(0)
})

test('una cita ajena por tiempo real no dispara una segunda precarga', async ({ page }) => {
  const esperarEco = observarEcosRealtime(page)
  await irAAgenda(page)
  const { medicoId, consultorioId } = await idsPorDefecto(page)

  const peticiones = contarGetCitas(page)
  await irASemana(page, 'next', EVENTO_SIGUIENTE) // la real de W+1 + la de la precarga de W+2
  await page.waitForResponse(esRespuestaCitas, { timeout: 5000 }).catch(() => null)
  await page.waitForTimeout(300)
  const trasLaPrecarga = peticiones.veces()

  const titulo = tituloUnico('Evento tiempo real precarga E2E')
  const dia = diaDeLaSemana(1, 2)
  const clientId = randomUUID()
  const comoSecretaria = await request.newContext({ baseURL: 'http://localhost:3001', storageState: SESION.secretariaA })
  const res = await comoSecretaria.post('/api/appointments', {
    data: {
      title: titulo,
      start_time: new Date(`${dia}T15:00:00`).toISOString(),
      end_time: new Date(`${dia}T15:20:00`).toISOString(),
      all_day: false,
      medico_id: medicoId,
      consultorio_id: consultorioId,
      client_id: clientId,
    },
  })
  expect(res.ok()).toBeTruthy()
  await comoSecretaria.dispose()
  await esperarEco(clientId)

  // Tiempo ocioso de sobra para una segunda precarga, si la hubiera.
  await page.waitForTimeout(2000)
  peticiones.parar()
  expect(peticiones.veces()).toBe(trasLaPrecarga)
})
