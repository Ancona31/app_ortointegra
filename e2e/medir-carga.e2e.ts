import { test, type Browser, type Page } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { SESION } from './ayudas'

/**
 * Línea base de carga de la agenda (A0). Se repite igual en A1 para comparar
 * contra esto (`mejora_agendaV2.md` §5, «Presupuesto de rendimiento»).
 *
 * Corre SÓLO con:  npx playwright test --config=playwright.medicion.config.ts
 * (proyecto `medicion`, aparte — ver la nota de ese archivo). Como admin.a,
 * en escritorio, contra el servidor de PRODUCCIÓN ya levantado en :3001.
 *
 * Limitación declarada (punto 6 del encargo): el servidor local llega a la
 * Supabase local SIN latencia de red real (todo en Docker, en la misma
 * máquina) — el "con red limitada" sólo añade la latencia NAVEGADOR↔SERVIDOR,
 * no la de SERVIDOR↔BASE. En producción esa segunda pata sí pesa.
 *
 * Etiqueta: `MEDICION_ETIQUETA=A0 npx playwright test --config=...` escribe
 * `e2e/resultados/linea-base-A0.json`; sin la variable, usa «A0» por defecto
 * (la línea base de este encargo). A1 debe pasar su propia etiqueta para no
 * pisar este archivo.
 */

const REPETICIONES = 5
const CONTENEDOR_AUTH = 'supabase_auth_app_ortointegra'
const ETIQUETA = process.env.MEDICION_ETIQUETA || 'A0'

/* Eventos sembrados que sólo existen en la semana siguiente/anterior a la
   actual (`scripts/agenda-semilla.ts`, `eventosA`: `dia(1,4)` y `dia(-1,1)`)
   — la señal real de que la semana cambió, en vez de un `waitForTimeout` a
   ciegas tras el cambio de título (GRAVE de la revisión). */
const EVENTO_SEMANA_SIGUIENTE = 'Sesión docente'
const EVENTO_SEMANA_ANTERIOR = 'Bloqueo de agenda'

type Categoria = 'documento' | 'api' | 'rest' | 'auth' | 'rsc' | 'websocket' | 'otro'

interface PeticionCapturada {
  url: string
  pathname: string
  method: string
  resourceType: string
  categoria: Categoria
}

interface Serie { mediana: number; min: number; max: number; muestras: number[] }

function serie(valores: number[]): Serie {
  const xs = [...valores].sort((a, b) => a - b)
  const mitad = Math.floor(xs.length / 2)
  const mediana = xs.length % 2 ? xs[mitad] : (xs[mitad - 1] + xs[mitad]) / 2
  return { mediana, min: xs[0], max: xs[xs.length - 1], muestras: valores }
}

function categoriaDe(urlStr: string, resourceType: string): Categoria {
  let u: URL
  try { u = new URL(urlStr) } catch { return 'otro' }
  if (resourceType === 'websocket' || u.protocol === 'ws:' || u.protocol === 'wss:') return 'websocket'
  if (u.searchParams.has('_rsc')) return 'rsc'
  if (u.pathname.startsWith('/api/')) return 'api'
  if (u.pathname.includes('/rest/v1/')) return 'rest'
  if (u.pathname.includes('/auth/v1/')) return 'auth'
  if (resourceType === 'document') return 'documento'
  return 'otro'
}

/** Agrupa una tanda de peticiones por categoría y por ruta exacta (para ver las repetidas). */
function agrupar(peticiones: PeticionCapturada[]): {
  porCategoria: Record<string, number>
  porRuta: { ruta: string; metodo: string; veces: number }[]
  repetidas: { ruta: string; metodo: string; veces: number }[]
} {
  const porCategoria: Record<string, number> = {}
  const mapaRutas = new Map<string, { ruta: string; metodo: string; veces: number }>()
  for (const p of peticiones) {
    porCategoria[p.categoria] = (porCategoria[p.categoria] ?? 0) + 1
    const clave = `${p.method} ${p.pathname}`
    const actual = mapaRutas.get(clave)
    if (actual) actual.veces += 1
    else mapaRutas.set(clave, { ruta: p.pathname, metodo: p.method, veces: 1 })
  }
  const porRuta = [...mapaRutas.values()].sort((a, b) => b.veces - a.veces)
  return { porCategoria, porRuta, repetidas: porRuta.filter(r => r.veces > 1) }
}

const MARGEN_LOG_MS = 800

/**
 * Cuenta `GET /user` en el log de Auth entre dos instantes (ventana de la
 * apertura). TOTAL — servidor y navegador juntos; MEDIA de la revisión: "el
 * log de Docker incluye también las del navegador". No se puede separar
 * mirando sólo el log del contenedor (no dice quién llamó); la parte del
 * navegador se resta aparte, desde las peticiones que la propia página
 * capturó (`contarAuthUserNavegador`).
 */
function contarAuthUserTotal(desde: number, hasta: number): number {
  const desdeISO = new Date(desde).toISOString()
  const hastaISO = new Date(hasta + MARGEN_LOG_MS).toISOString() // margen: el log tarda un poco en escribirse
  // ⚠️ `docker logs` escribe el log del CONTENEDOR en su STDERR, no en su
  // STDOUT (comprobado: `execFileSync` devolvía siempre cadena vacía aunque
  // la terminal mostrara líneas). `spawnSync` lee los dos.
  const r = spawnSync('docker', ['logs', '--since', desdeISO, '--until', hastaISO, CONTENEDOR_AUTH], { encoding: 'utf8' })
  if (r.status !== 0) return -1
  const salida = (r.stdout ?? '') + (r.stderr ?? '')
  return (salida.match(/"path":"\/user"/g) ?? []).length
}

/** La parte del total de arriba que es del NAVEGADOR (`useProfile`, `getUser()` cliente): peticiones a `/auth/v1/user` que la propia página disparó. */
function contarAuthUserNavegador(peticiones: PeticionCapturada[]): number {
  return peticiones.filter(p => p.pathname.includes('/auth/v1/user')).length
}

function instrumentar(page: Page): {
  peticiones: PeticionCapturada[]
  tAppointments: { t: number | null }
  t0: number
  apiEnVuelo: () => number
} {
  const peticiones: PeticionCapturada[] = []
  const tAppointments = { t: null as number | null }
  const t0 = Date.now()
  let enVuelo = 0
  const esApi = (urlStr: string): boolean => {
    try { return new URL(urlStr).pathname.startsWith('/api/') } catch { return false }
  }
  page.on('request', req => {
    let pathname = req.url()
    try { pathname = new URL(req.url()).pathname } catch { /* deja la url completa */ }
    peticiones.push({
      url: req.url(),
      pathname,
      method: req.method(),
      resourceType: req.resourceType(),
      categoria: categoriaDe(req.url(), req.resourceType()),
    })
    if (esApi(req.url())) enVuelo++
  })
  page.on('requestfinished', req => { if (esApi(req.url())) enVuelo-- })
  page.on('requestfailed', req => { if (esApi(req.url())) enVuelo-- })
  page.on('response', res => {
    if (tAppointments.t === null && res.url().includes('/api/appointments')) {
      tAppointments.t = Date.now() - t0
    }
  })
  return { peticiones, tAppointments, t0, apiEnVuelo: () => enVuelo }
}

/**
 * Sondeo corto hasta que no quede ninguna petición `/api/*` en vuelo (o se
 * agote el tope). No hay otro evento al que colgarse —"ya no queda nada
 * pendiente" no lo dispara nadie—, así que se consulta el contador cada 25
 * ms; no es un `waitForTimeout` a ciegas porque la condición de salida es
 * real y se revisa en cada vuelta.
 */
async function esperarApiAsentada(apiEnVuelo: () => number, topeMs = 5000): Promise<void> {
  const limite = Date.now() + topeMs
  while (apiEnVuelo() > 0 && Date.now() < limite) {
    await new Promise(resolve => setTimeout(resolve, 25))
  }
}

async function medirAperturaFria(browser: Browser, limitarRed: boolean) {
  const context = await browser.newContext({ storageState: SESION.adminA })
  const page = await context.newPage()
  if (limitarRed) {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 60,
      downloadThroughput: (10 * 1024 * 1024) / 8,
      uploadThroughput: (10 * 1024 * 1024) / 8,
    })
  }
  const { peticiones, tAppointments, t0, apiEnVuelo } = instrumentar(page)
  const desdeReal = Date.now()
  // GRAVE de medición: la ventana del conteo de Auth NO se cierra al primer
  // `.fc-event` visible —puede pintarse antes de que `/api/google/events`
  // termine, ya que son dos `eventSources` independientes— sino cuando
  // `appointments`, `google` Y cualquier otro `/api/*` de la apertura hayan
  // resuelto.
  const esperaAppointments = page.waitForResponse(
    r => r.url().includes('/api/appointments') && r.request().method() === 'GET', { timeout: 20000 },
  ).catch(() => null)
  const esperaGoogle = page.waitForResponse(r => r.url().includes('/api/google/events'), { timeout: 20000 }).catch(() => null)
  await page.goto('/agenda')
  await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 20000 })
  const ms = Date.now() - t0
  await Promise.all([esperaAppointments, esperaGoogle])
  await esperarApiAsentada(apiEnVuelo)
  const hastaReal = Date.now()
  const authUserTotal = limitarRed ? -1 : contarAuthUserTotal(desdeReal, hastaReal) // sólo se cuenta en la corrida sin límite: no hace falta dos veces
  const authUserNavegador = contarAuthUserNavegador(peticiones)
  await context.close()
  return { ms, msAppointments: tAppointments.t ?? -1, peticiones, authUserTotal, authUserNavegador }
}

/* El reloj de un clic arranca con la página QUIETA: sin animaciones en curso y
   sin `/api/*` en vuelo. Si no, `click()` espera a que el botón deje de
   moverse (la entrada de la vista, la transición de página) y esa espera
   entra en la medida: en A1.2 sumaba ~250 ms a un cambio de semana que en
   realidad tardaba ~60, y daba un número PEOR justo cuando la agenda pintaba
   antes. */
async function esperarQuieta(page: Page): Promise<void> {
  await page.waitForFunction(
    // Las de iteración infinita (indicadores, pulsos) no terminan nunca y no
    // mueven el botón: no cuentan.
    () => document.getAnimations().every(a =>
      a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
    undefined,
    { timeout: 10000 },
  )
  await page.waitForLoadState('networkidle')
}

async function medirCambioDeSemana(browser: Browser, direccion: 'next' | 'prev') {
  const context = await browser.newContext({ storageState: SESION.adminA })
  const page = await context.newPage()
  await page.goto('/agenda')
  await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 20000 })
  await esperarQuieta(page)
  const { peticiones, t0 } = instrumentar(page)
  await page.locator(direccion === 'next' ? '.fc-next-button' : '.fc-prev-button').click()
  // GRAVE de medición: se espera un EVENTO CONOCIDO de la semana destino, no
  // el cambio de título + un respiro fijo — el título puede cambiar antes de
  // que FullCalendar termine de pintar la traída nueva.
  const eventoDestino = direccion === 'next' ? EVENTO_SEMANA_SIGUIENTE : EVENTO_SEMANA_ANTERIOR
  await page.locator('.fc-event', { hasText: eventoDestino }).first().waitFor({ state: 'visible', timeout: 15000 })
  const ms = Date.now() - t0
  await context.close()
  return { ms, peticiones }
}

/* A1.5a: volver a una semana YA VISTA. Actual → siguiente → actual, y se mide
   el segundo paso a la siguiente, que la caché de rangos de citas ya tiene.
   `bloqueantes` = `GET /api/appointments` del clic: la única petición que
   retiene la rejilla (Google contesta al instante desde A1.3). */
async function medirVueltaASemanaVista(browser: Browser) {
  const context = await browser.newContext({ storageState: SESION.adminA })
  const page = await context.newPage()
  await page.goto('/agenda')
  await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 20000 })
  await page.locator('.fc-next-button').click()
  await page.locator('.fc-event', { hasText: EVENTO_SEMANA_SIGUIENTE }).first().waitFor({ state: 'visible', timeout: 15000 })
  await page.locator('.fc-prev-button').click()
  await page.locator('.fc-event', { hasText: EVENTO_SEMANA_SIGUIENTE }).first().waitFor({ state: 'hidden', timeout: 15000 })
  await esperarQuieta(page)
  const { peticiones, t0 } = instrumentar(page)
  await page.locator('.fc-next-button').click()
  await page.locator('.fc-event', { hasText: EVENTO_SEMANA_SIGUIENTE }).first().waitFor({ state: 'visible', timeout: 15000 })
  const ms = Date.now() - t0
  await context.close()
  return { ms, peticiones, bloqueantes: bloqueantesDe(peticiones) }
}

/** `GET /api/appointments` de una tanda: lo que retiene la rejilla. */
function bloqueantesDe(peticiones: PeticionCapturada[]): number {
  return peticiones.filter(p => p.pathname === '/api/appointments' && p.method === 'GET').length
}

/** El próximo `GET /api/appointments?...` que responda (el `?` es a
 *  propósito: sin él también atrapa el `GET /api/appointments/[id]` de
 *  `traerCita`, que es otra ruta). LANZA si no llega a tiempo — un «no
 *  llegó» es un fallo real de la medición (la precarga no salió) y no debe
 *  colarse como un `-1` silencioso en la serie; tira la prueba entera, igual
 *  que el fallo de `contarAuthUserTotal` más abajo. */
function esperarProximoGetCitas(page: Page) {
  return page.waitForResponse(
    r => r.url().includes('/api/appointments?') && r.request().method() === 'GET', { timeout: 10000 },
  )
}

/* A1.5b: salto W+1 → W+2 TRAS la precarga en ocioso. `irASemana` pinta W+1
   con una petición real; la precarga que sigue trae, en serie, W (ya
   cacheada, no pide) y W+2 (sí pide) — se espera esa segunda respuesta ANTES
   de medir, o el salto mediría la petición que la precarga viene a evitar.
   `urlDeW2` guarda esa url EXACTA: `bloqueantes` cuenta cuántas veces se
   repite, no cualquier `/api/appointments` de la ventana medida.
   ⚠️ NO VALE CONTAR CUALQUIER GET AHÍ: pintar W+2 dispara, a su vez, SU
   PROPIA precarga (W+1, ya cacheada, y W+3, que sí pide red) — y ese GET de
   W+3 puede alcanzar a salir dentro de la misma ventana, antes de que el
   evento llegue al DOM. Es tráfico correcto de la semana SIGUIENTE, no lo
   que esto mide: si se contara cualquier GET, `bloqueantes` saldría en 1
   aunque la precarga hubiera hecho exactamente su trabajo. */
async function medirSaltoTrasPrecarga(browser: Browser) {
  const context = await browser.newContext({ storageState: SESION.adminA })
  const page = await context.newPage()
  await page.goto('/agenda')
  await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 20000 })

  // W+1 ya viene de la semilla del servidor (A1.4c: cubre W-1, W y W+1 de
  // hoy) — no pide red por sí sola. El PRIMER `GET /api/appointments?...`
  // que sale tras pintarla es, por tanto, la precarga de SU vecina, W+2.
  await page.locator('.fc-next-button').click()
  await page.locator('.fc-event', { hasText: EVENTO_SEMANA_SIGUIENTE }).first().waitFor({ state: 'visible', timeout: 15000 })
  const respuestaW2 = await esperarProximoGetCitas(page)
  const urlDeW2 = respuestaW2.url()
  await esperarQuieta(page)

  const { peticiones, t0 } = instrumentar(page)
  await page.locator('.fc-next-button').click()
  await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 15000 })
  const ms = Date.now() - t0
  await context.close()
  const bloqueantes = peticiones.filter(p => p.url === urlDeW2).length
  return { ms, peticiones, bloqueantes }
}

async function medirVueltaInterna(browser: Browser) {
  const context = await browser.newContext({ storageState: SESION.adminA })
  const page = await context.newPage()
  // GRAVE de medición: la "vuelta" se mide agenda → dashboard → AGENDA, en el
  // MISMO contexto/página — no dashboard → agenda la primera vez (eso es una
  // apertura fría de agenda, no una vuelta).
  await page.goto('/agenda')
  await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 20000 })
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await page.getByRole('link', { name: 'Agenda', exact: true }).waitFor({ state: 'visible', timeout: 15000 })
  await esperarQuieta(page)
  const { peticiones, t0 } = instrumentar(page)
  await page.getByRole('link', { name: 'Agenda', exact: true }).click()
  await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 20000 })
  const ms = Date.now() - t0
  await context.close()
  return { ms, peticiones, bloqueantes: bloqueantesDe(peticiones) }
}

/**
 * Suma de los `.js` TRANSFERIDOS por /agenda. No sale de la cabecera
 * `content-length` —Next sirve los chunks con `Content-Encoding: gzip` y sin
 * ella, comprobado contra el servidor real— sino de `encodedDataLength` de
 * `Network.loadingFinished` (CDP), que es el byte a byte que de verdad bajó
 * por la red, comprimido.
 */
async function pesoJs(browser: Browser): Promise<{ totalBytes: number; mayor: { url: string; bytes: number } }> {
  const context = await browser.newContext({ storageState: SESION.adminA })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  const urlPorId = new Map<string, string>()
  const bytesPorUrl = new Map<string, number>()
  cdp.on('Network.responseReceived', e => {
    if (e.type === 'Script') urlPorId.set(e.requestId, e.response.url)
  })
  cdp.on('Network.loadingFinished', e => {
    const url = urlPorId.get(e.requestId)
    if (url) bytesPorUrl.set(url, e.encodedDataLength)
  })
  await page.goto('/agenda')
  await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 20000 })
  await context.close()
  let totalBytes = 0
  let mayor = { url: '', bytes: 0 }
  for (const [url, bytes] of bytesPorUrl) {
    totalBytes += bytes
    if (bytes > mayor.bytes) mayor = { url, bytes }
  }
  return { totalBytes, mayor }
}

test('línea base de carga de la agenda', async ({ browser }) => {
  test.setTimeout(20 * 60 * 1000)

  // Sin resembrar aquí: `globalSetup` (`e2e/global-setup.ts`, referenciado
  // desde `playwright.medicion.config.ts`) YA resembró y abrió sesión justo
  // antes de que este archivo arrancara — es la semilla recién puesta que
  // pide el encargo. Resembrar otra vez AQUÍ borraría y recrearía los
  // usuarios de nuevo, invalidando el `storageState` que acaba de guardar
  // (misma causa raíz que la nota de `agenda-citas.e2e.ts`): la primera
  // versión de este archivo lo hacía y cada apertura caía en /login.

  // 1 + 3 + 6 — apertura en frío, sin límite de red, con conteo de Auth.
  const aperturas: Awaited<ReturnType<typeof medirAperturaFria>>[] = []
  for (let i = 0; i < REPETICIONES; i++) aperturas.push(await medirAperturaFria(browser, false))

  // GRAVE de medición: un -1 (fallo de lectura del log de Docker) no entra en
  // silencio en la mediana — falla la medición entera, porque esa muestra no
  // mide nada.
  const fallosDeLog = aperturas.filter(a => a.authUserTotal < 0).length
  if (fallosDeLog > 0) {
    throw new Error(
      `contarAuthUserTotal falló en ${fallosDeLog} de ${aperturas.length} aperturas (docker logs no respondió 0) — ` +
      'la medición de Auth no es válida. Revisa que el contenedor supabase_auth_app_ortointegra esté arriba.',
    )
  }

  // 6 — la misma apertura, con red limitada (~60 ms, 10 Mbps).
  const aperturasLimitadas: Awaited<ReturnType<typeof medirAperturaFria>>[] = []
  for (let i = 0; i < REPETICIONES; i++) aperturasLimitadas.push(await medirAperturaFria(browser, true))

  // 4 — semana siguiente y anterior.
  const semanaSiguiente: Awaited<ReturnType<typeof medirCambioDeSemana>>[] = []
  for (let i = 0; i < REPETICIONES; i++) semanaSiguiente.push(await medirCambioDeSemana(browser, 'next'))
  const semanaAnterior: Awaited<ReturnType<typeof medirCambioDeSemana>>[] = []
  for (let i = 0; i < REPETICIONES; i++) semanaAnterior.push(await medirCambioDeSemana(browser, 'prev'))

  // 5 — volver a la agenda desde /dashboard por navegación interna.
  const vuelta: Awaited<ReturnType<typeof medirVueltaInterna>>[] = []
  for (let i = 0; i < REPETICIONES; i++) vuelta.push(await medirVueltaInterna(browser))

  // 8 — volver a una semana ya vista (A1.5a).
  const semanaVista: Awaited<ReturnType<typeof medirVueltaASemanaVista>>[] = []
  for (let i = 0; i < REPETICIONES; i++) semanaVista.push(await medirVueltaASemanaVista(browser))

  // 9 — A1.5b: salto W+1 → W+2 tras la precarga en ocioso.
  const saltoTrasPrecarga: Awaited<ReturnType<typeof medirSaltoTrasPrecarga>>[] = []
  for (let i = 0; i < REPETICIONES; i++) saltoTrasPrecarga.push(await medirSaltoTrasPrecarga(browser))

  // 7 — peso de JS (una sola medida; no depende de repetir).
  const peso = await pesoJs(browser)

  const ultimaApertura = agrupar(aperturas[aperturas.length - 1].peticiones)
  const ultimaSiguiente = agrupar(semanaSiguiente[semanaSiguiente.length - 1].peticiones)
  const ultimaAnterior = agrupar(semanaAnterior[semanaAnterior.length - 1].peticiones)
  const ultimaVuelta = agrupar(vuelta[vuelta.length - 1].peticiones)

  const resultado = {
    etiqueta: ETIQUETA,
    generadoEn: new Date().toISOString(),
    nota: 'El servidor local llega a la Supabase local sin latencia de red (todo en Docker, misma máquina); "red limitada" sólo añade la latencia navegador↔servidor.',
    aperturaFria: {
      msHastaPrimerEvento: serie(aperturas.map(a => a.ms)),
      msHastaRespuestaAppointments: serie(aperturas.map(a => a.msAppointments)),
      peticiones: ultimaApertura,
      // MEDIA de la revisión: servidor y navegador por separado. El log de
      // Docker (`validacionesAuthUser_total`) incluye LAS DOS cosas —no hay
      // forma de distinguir quién llamó mirando sólo el log—, así que
      // "servidor" sale de restarle al total lo que la propia página disparó
      // (`validacionesAuthUser_navegador`, de `useProfile`/`getUser()` cliente).
      validacionesAuthUser_total: serie(aperturas.map(a => a.authUserTotal)),
      validacionesAuthUser_navegador: serie(aperturas.map(a => a.authUserNavegador)),
      validacionesAuthUser_servidor: serie(aperturas.map(a => a.authUserTotal - a.authUserNavegador)),
      metodoDeConteoAuth:
        `docker logs --since <inicio navegación> --until <appointments y google resueltos, y sin /api/* en vuelo, +${MARGEN_LOG_MS}ms> ` +
        'supabase_auth_app_ortointegra, contando líneas con "path":"/user" (GET /user de GoTrue) para el TOTAL. ' +
        'La parte del navegador se resta de las peticiones que la propia página capturó a "/auth/v1/user" ' +
        '(también visibles, agregadas, en "peticiones.porCategoria.auth").',
    },
    aperturaFriaRedLimitada: {
      descripcion: '~60 ms de latencia añadida y 10 Mbps, vía CDP Network.emulateNetworkConditions.',
      msHastaPrimerEvento: serie(aperturasLimitadas.map(a => a.ms)),
      msHastaRespuestaAppointments: serie(aperturasLimitadas.map(a => a.msAppointments)),
    },
    semanaSiguiente: {
      msHastaCitasNuevas: serie(semanaSiguiente.map(a => a.ms)),
      peticiones: ultimaSiguiente,
    },
    semanaAnterior: {
      msHastaCitasNuevas: serie(semanaAnterior.map(a => a.ms)),
      peticiones: ultimaAnterior,
    },
    volverDesdeDashboard: {
      msHastaCitasVisibles: serie(vuelta.map(a => a.ms)),
      bloqueantes: serie(vuelta.map(a => a.bloqueantes)),
      peticiones: ultimaVuelta,
    },
    volverASemanaVista: {
      msHastaCitasVisibles: serie(semanaVista.map(a => a.ms)),
      bloqueantes: serie(semanaVista.map(a => a.bloqueantes)),
      peticiones: agrupar(semanaVista[semanaVista.length - 1].peticiones),
    },
    saltoTrasPrecarga: {
      descripcion: 'A1.5b: W+1 → W+2 después de que la precarga en ocioso ya trajo W+2 sola.',
      msHastaCitasVisibles: serie(saltoTrasPrecarga.map(a => a.ms)),
      bloqueantes: serie(saltoTrasPrecarga.map(a => a.bloqueantes)),
      peticiones: agrupar(saltoTrasPrecarga[saltoTrasPrecarga.length - 1].peticiones),
    },
    pesoJs: {
      totalBytesTransferidos: peso.totalBytes,
      masGrande: peso.mayor,
    },
  }

  const dirResultados = path.resolve(process.cwd(), 'e2e/resultados')
  mkdirSync(dirResultados, { recursive: true })
  writeFileSync(path.join(dirResultados, `linea-base-${ETIQUETA}.json`), JSON.stringify(resultado, null, 2))

  console.log(JSON.stringify(resultado, null, 2))
})
