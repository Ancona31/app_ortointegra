import { test, expect, request, type Locator, type Page, type WebSocketRoute } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { irAAgenda, soloEscritorio, SESION, diaDeLaSemana, tituloUnico, toastConTexto, arrastrarEventoPorMinutos } from './ayudas'

/**
 * EL CANDADO DEL ARRASTRE (`gestoEnCursoRef` en `useFuentesAgenda.ts`) con una
 * traída que se CRUZA con el gesto, que es lo único que lo pone a prueba: un
 * arrastre sin nada que llegue a mitad no duplica nunca, con candado o sin él.
 *
 * Por qué el cruce se fuerza así y no de otra manera:
 *
 *  · CITAS EN VUELO AL EMPEZAR NO SE PUEDE: con una traída de citas en curso
 *    la rejilla lleva `ag-cargando` (`pointer-events: none`, globals.css), así
 *    que el gesto ni empieza. La traída que SÍ puede estar en vuelo con la
 *    rejilla viva es la de Google, que contesta provisional al instante y trae
 *    en segundo plano (A1.3). Se retiene con `page.route` y se suelta a mitad
 *    del arrastre: su aviso (`refrescarGoogle`) SE APLAZA hasta soltar.
 *
 *  · El `refetch()` de las CITAS a mitad de gesto lo disparan la reconexión del
 *    canal, el foco tras 2 min, el filtro y «Reintentar». El que se puede
 *    provocar sin tocar el reloj ni la UI a mitad del gesto es la RECONEXIÓN:
 *    se corta el websocket de Realtime con `page.routeWebSocket` y el propio
 *    cliente se reengancha. Ése SE DESCARTA (no se aplaza: ver la nota del
 *    candado), y lo que se comprueba es que no sale ningún GET y que la cita
 *    no se duplica al soltar.
 *
 * Las dos pruebas se validan solas: si el gesto no hubiera empezado, el
 * candado no estaría puesto y la traída cruzaría — la prueba fallaría, no
 * pasaría en vacío. Y las dos acaban con el PUT del soltar.
 *
 * Datos propios en el VIERNES de la semana visible, a horas que no usa ningún
 * otro archivo, y creados con la agenda YA abierta (la cita aparece por
 * Realtime): así su eco de alta no puede caer a mitad del arrastre.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

const VIERNES = diaDeLaSemana(0, 4)

/** `psql` en la base local, el mismo contenedor que `scripts/agenda-semilla.ts`. */
function sqlLocal(sql: string): string {
  return execFileSync('docker', ['exec', '-i', 'supabase_db_app_ortointegra', 'psql', '-U', 'postgres', '-tAq', '-c', sql],
    { encoding: 'utf8' }).trim()
}

/** Un evento de admin.a creado por la SECRETARIA (escritura ajena), sin paciente. */
async function crearEventoAjeno(titulo: string, desde: string, hasta: string): Promise<void> {
  const adminId = sqlLocal(`select id from auth.users where email='admin.a@semilla.spinus.test'`)
  const consultorioId = sqlLocal(`select id from consultorios where medico_id='${adminId}' and activo order by es_default desc limit 1`)
  const sec = await request.newContext({ baseURL: 'http://localhost:3001', storageState: SESION.secretariaA })
  try {
    const res = await sec.post('/api/appointments', {
      data: {
        title: titulo, all_day: false, medico_id: adminId, consultorio_id: consultorioId, client_id: randomUUID(),
        // Con la zona de la clínica escrita: `new Date('…T09:30:00')` usaría
        // la del proceso de Node, que no es fija entre archivos.
        start_time: new Date(`${VIERNES}T${desde}:00-06:00`).toISOString(),
        end_time: new Date(`${VIERNES}T${hasta}:00-06:00`).toISOString(),
      },
    })
    expect(res.ok()).toBeTruthy()
  } finally {
    await sec.dispose()
  }
}

/** Las tarjetas de la rejilla con ese título, sin el espejo del arrastre. */
function tarjetas(page: Page, titulo: string): Locator {
  return page.locator('.fc-timegrid-event:not(.fc-event-mirror)', { hasText: titulo })
}

/**
 * La primera mitad de `arrastrarEventoPorMinutos` (ayudas.ts): coloca el
 * evento con hueco por debajo dentro del scroller, aprieta y lo lleva
 * `minutos` hacia abajo, SIN soltar. Ver allí por qué se mide contra el
 * scroller y no contra la ventana.
 */
async function empezarArrastre(page: Page, evento: Locator, minutos: number): Promise<void> {
  const el = await evento.elementHandle()
  if (!el) throw new Error('empezarArrastre: el evento no está en el DOM')
  const porMinuto = await page.evaluate((nodo) => {
    const scroller = document.querySelector('.fc-scroller-liquid-absolute')
    const fila = document.querySelector('td.fc-timegrid-slot-lane')
    if (!scroller || !fila) return null
    const caja = scroller.getBoundingClientRect()
    const rect = (nodo as HTMLElement).getBoundingClientRect()
    scroller.scrollTop = Math.max(0, scroller.scrollTop + (rect.top - (caja.top + 70)))
    return fila.getBoundingClientRect().height / 30
  }, el)
  if (!porMinuto) throw new Error('empezarArrastre: sin rejilla de tiempo')
  const caja = await evento.boundingBox()
  if (!caja) throw new Error('empezarArrastre: coordenadas del evento no disponibles')
  const x = caja.x + caja.width / 2
  const y = caja.y + caja.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 4, { steps: 3 })
  await page.mouse.move(x, y + minutos * porMinuto, { steps: 15 })
}

test('Google en vuelo a mitad del arrastre: su repintado se aplaza hasta soltar y la cita no se duplica', async ({ page }) => {
  let soltarGoogle: () => void = () => {}
  const compuerta = new Promise<void>(resolve => { soltarGoogle = resolve })
  let entregadas = 0
  await page.route('**/api/google/events**', async route => {
    await compuerta
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        estado: 'conectado',
        events: [{
          id: 'e2e-candado-google',
          summary: 'Google a mitad de gesto E2E',
          start: { dateTime: `${VIERNES}T08:00:00-06:00` },
          end: { dateTime: `${VIERNES}T08:20:00-06:00` },
        }],
      }),
    })
    entregadas += 1
  })
  await irAAgenda(page)

  const titulo = tituloUnico('Candado Google E2E')
  await crearEventoAjeno(titulo, '09:30', '10:00')
  await expect(tarjetas(page, titulo)).toHaveCount(1, { timeout: 10000 })
  const deGoogle = page.locator('.fc-event', { hasText: 'Google a mitad de gesto E2E' })

  const put = page.waitForResponse(r => /\/api\/appointments\/[0-9a-f-]+$/.test(r.url()) && r.request().method() === 'PUT')
  await empezarArrastre(page, tarjetas(page, titulo), 30)
  soltarGoogle()
  await expect.poll(() => entregadas, { timeout: 5000 }).toBeGreaterThan(0)
  // La respuesta ya está en la caché de Google; lo que la pintaría es
  // `refrescarGoogle`, y con el gesto en curso tiene que esperar.
  await page.waitForTimeout(1000)
  await expect(deGoogle).toHaveCount(0)

  await page.mouse.up()
  expect((await put).ok()).toBeTruthy()
  await expect(toastConTexto(page, 'Se movió en la agenda')).toBeVisible({ timeout: 10000 })
  // Al soltar sale el aplazado (`alTerminarGesto`), servido de la caché.
  await expect(deGoogle.first()).toBeVisible({ timeout: 5000 })
  await expect(tarjetas(page, titulo).locator('.ag-tarjeta-hora-rango')).toHaveText('10:00 - 10:30')
  await page.waitForTimeout(1000)
  await expect(tarjetas(page, titulo)).toHaveCount(1)
})

test('reconexión del canal a mitad del arrastre: el refetch de citas se descarta y la cita no se duplica', async ({ page }) => {
  /* Paso de frames a mano en los dos sentidos: así se ven los `phx_join` del
     canal (cuántas veces se unió) y el eco del PUT, y se puede cortar el
     socket cuando toque. */
  const sockets: { pagina: WebSocketRoute; servidor: WebSocketRoute }[] = []
  let unionesOk = 0
  const joinsPendientes = new Set<string>()
  const ecos: string[] = []
  const texto = (m: string | Buffer): string => (typeof m === 'string' ? m : m.toString('utf8'))
  /* El `ref` del mensaje de Phoenix: `[join_ref, ref, topic, event, payload]`
     con el serializador 2.0.0 (el de realtime-js por defecto), `{ ref }` con
     el 1.0.0. */
  const refDe = (t: string): unknown => {
    const m = JSON.parse(t) as unknown
    return Array.isArray(m) ? m[1] : (m as { ref?: unknown }).ref
  }
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, ws => {
    const servidor = ws.connectToServer()
    ws.onMessage(m => {
      const t = texto(m)
      if (t.includes('"phx_join"') && t.includes('appointments-realtime')) {
        const ref = refDe(t)
        if (typeof ref === 'string') joinsPendientes.add(ref)
      }
      servidor.send(m)
    })
    servidor.onMessage(m => {
      const t = texto(m)
      if (t.includes('"phx_reply"') && t.includes('"ok"')) {
        const ref = refDe(t)
        if (typeof ref === 'string' && joinsPendientes.delete(ref)) unionesOk += 1
      }
      ecos.push(t)
      ws.send(m)
    })
    sockets.push({ pagina: ws, servidor })
  })
  let getsCitas = 0
  page.on('request', r => { if (r.url().includes('/api/appointments?') && r.method() === 'GET') getsCitas += 1 })

  await irAAgenda(page)
  await expect.poll(() => unionesOk, { timeout: 10000 }).toBe(1)
  const titulo = tituloUnico('Candado reconexion E2E')
  await crearEventoAjeno(titulo, '11:00', '11:30')
  await expect(tarjetas(page, titulo)).toHaveCount(1, { timeout: 10000 })

  const put = page.waitForResponse(r => /\/api\/appointments\/[0-9a-f-]+$/.test(r.url()) && r.request().method() === 'PUT')
  await empezarArrastre(page, tarjetas(page, titulo), 30)
  const getsAntes = getsCitas
  // Corte del socket: el cliente se reengancha solo (1 s de espera en
  // realtime-js) y, al volver SUBSCRIBED, el canal llama a `refetch(true)`.
  const ultimo = sockets[sockets.length - 1]
  await ultimo.pagina.close()
  await ultimo.servidor.close()
  await expect.poll(() => unionesOk, { timeout: 15000 }).toBe(2)
  // Margen para que una traída que SÍ hubiera salido vuelva y se aplique.
  await page.waitForTimeout(1500)
  const getsDuranteElGesto = getsCitas - getsAntes

  await page.mouse.up()
  const resPut = await put
  expect(resPut.ok()).toBeTruthy()
  const clientId = (resPut.request().postDataJSON() as { client_id?: string }).client_id
  if (!clientId) throw new Error('el PUT del soltar no llevó client_id')
  await expect.poll(() => ecos.some(e => e.includes(clientId)), { timeout: 10000 }).toBe(true)

  await expect(tarjetas(page, titulo)).toHaveCount(1)
  await expect(tarjetas(page, titulo).locator('.ag-tarjeta-hora-rango')).toHaveText('11:30 - 12:00')
  // El refetch de la reconexión cayó con el gesto en curso: se descartó.
  expect(getsDuranteElGesto).toBe(0)
})

/* ══════════════════════════════════════════════════════════════════════════
   LA TERCERA VÍA (B2, E5-DT-8): la traída que entra DESPUÉS de soltar.
   ══════════════════════════════════════════════════════════════════════════
   El candado cubre el gesto y se suelta en `eventDragStop`. Pero hay dos
   caminos que deshacen el movimiento MÁS TARDE, con la traída ya libre:
   «Cancelar» en el aviso de fuera de horario y el PUT que falla. Si entre el
   soltar y ese deshacer entra un `refetch()` (aquí, la reconexión del canal),
   la cita vuelve a parsearse con un `defId` nuevo; `arg.revert()` mergea la
   copia de antes del gesto con el `defId` viejo, no sustituye a nadie y
   AÑADE una segunda tarjeta.

   Las dos pruebas se validan solas: antes de deshacer comprueban que la
   traída SÍ se aplicó (la tarjeta ya enseña la hora de la base), así que no
   pueden pasar en vacío con una traída que no llegó. */

/** El websocket de Realtime con un corte a mano: cuántas uniones del canal de
 *  citas contestó el servidor, y cortar el último socket para que el cliente
 *  se reenganche (y, al volver SUBSCRIBED, llame a `refetch(true)`). */
async function canalCortable(page: Page): Promise<{ uniones: () => number; cortar: () => Promise<void> }> {
  const sockets: { pagina: WebSocketRoute; servidor: WebSocketRoute }[] = []
  const pendientes = new Set<string>()
  let uniones = 0
  const texto = (m: string | Buffer): string => (typeof m === 'string' ? m : m.toString('utf8'))
  const refDe = (t: string): unknown => {
    const m = JSON.parse(t) as unknown
    return Array.isArray(m) ? m[1] : (m as { ref?: unknown }).ref
  }
  await page.routeWebSocket(/\/realtime\/v1\/websocket/, ws => {
    const servidor = ws.connectToServer()
    ws.onMessage(m => {
      const t = texto(m)
      const ref = t.includes('"phx_join"') && t.includes('appointments-realtime') ? refDe(t) : null
      if (typeof ref === 'string') pendientes.add(ref)
      servidor.send(m)
    })
    servidor.onMessage(m => {
      const t = texto(m)
      const ref = t.includes('"phx_reply"') && t.includes('"ok"') ? refDe(t) : null
      if (typeof ref === 'string' && pendientes.delete(ref)) uniones += 1
      ws.send(m)
    })
    sockets.push({ pagina: ws, servidor })
  })
  return {
    uniones: () => uniones,
    cortar: async () => {
      const ultimo = sockets[sockets.length - 1]
      await ultimo.pagina.close()
      await ultimo.servidor.close()
    },
  }
}

/** Corta el canal y espera a que la reconexión haya TRAÍDO las citas. */
async function reconectarYTraer(page: Page, canal: Awaited<ReturnType<typeof canalCortable>>): Promise<void> {
  const antes = canal.uniones()
  const traida = page.waitForResponse(r => r.url().includes('/api/appointments?') && r.request().method() === 'GET',
    { timeout: 15000 })
  await canal.cortar()
  await expect.poll(canal.uniones, { timeout: 15000 }).toBe(antes + 1)
  expect((await traida).ok()).toBeTruthy()
}

test('Cancelar el aviso de fuera de horario tras una traída: la cita vuelve a su hora y no se duplica', async ({ page }) => {
  const canal = await canalCortable(page)
  await irAAgenda(page)
  await expect.poll(canal.uniones, { timeout: 10000 }).toBe(1)
  const titulo = tituloUnico('Tercera via aviso E2E')
  // La clínica A cierra a las 18:00 (semilla): +60 la deja en 18:00-18:30.
  await crearEventoAjeno(titulo, '17:00', '17:30')
  await expect(tarjetas(page, titulo)).toHaveCount(1, { timeout: 10000 })

  await arrastrarEventoPorMinutos(page, tarjetas(page, titulo), 60)
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toContainText('Vas a moverlo a las')
  await expect(tarjetas(page, titulo).locator('.ag-tarjeta-hora-rango')).toHaveText('18:00 - 18:30')

  await reconectarYTraer(page, canal)
  // La traída se aplicó: pinta lo de la base, que nunca se movió.
  await expect(tarjetas(page, titulo).locator('.ag-tarjeta-hora-rango')).toHaveText('17:00 - 17:30')

  await dialogo.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialogo).toBeHidden()
  await page.waitForTimeout(500)
  await expect(tarjetas(page, titulo)).toHaveCount(1)
  await expect(tarjetas(page, titulo).locator('.ag-tarjeta-hora-rango')).toHaveText('17:00 - 17:30')
})

test('PUT fallido con una traída en medio: la cita vuelve a su hora y no se duplica', async ({ page }) => {
  let soltarPut: () => void = () => {}
  const compuerta = new Promise<void>(resolve => { soltarPut = resolve })
  let putsRetenidos = 0
  await page.route(/\/api\/appointments\/[0-9a-f-]+$/, async route => {
    if (route.request().method() !== 'PUT') return route.fallback()
    putsRetenidos += 1
    await compuerta
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Fallo simulado E2E' }) })
  })
  const canal = await canalCortable(page)
  await irAAgenda(page)
  await expect.poll(canal.uniones, { timeout: 10000 }).toBe(1)
  const titulo = tituloUnico('Tercera via PUT E2E')
  await crearEventoAjeno(titulo, '15:00', '15:30')
  await expect(tarjetas(page, titulo)).toHaveCount(1, { timeout: 10000 })

  await arrastrarEventoPorMinutos(page, tarjetas(page, titulo), 30)
  await expect.poll(() => putsRetenidos, { timeout: 5000 }).toBe(1)
  await expect(tarjetas(page, titulo).locator('.ag-tarjeta-hora-rango')).toHaveText('15:30 - 16:00')

  await reconectarYTraer(page, canal)
  // La traída se aplicó con el PUT todavía en vuelo: la base sigue a las 15:00.
  await expect(tarjetas(page, titulo).locator('.ag-tarjeta-hora-rango')).toHaveText('15:00 - 15:30')

  soltarPut()
  await expect(toastConTexto(page, 'Fallo simulado E2E')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(500)
  await expect(tarjetas(page, titulo)).toHaveCount(1)
  await expect(tarjetas(page, titulo).locator('.ag-tarjeta-hora-rango')).toHaveText('15:00 - 15:30')
})
