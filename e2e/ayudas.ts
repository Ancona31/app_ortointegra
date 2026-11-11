import { test, type Browser, type Locator, type Page, type WebSocket } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { desplazarFecha, hoyEnTZ } from '../src/lib/dates'
import { semanasAlrededor } from '../src/lib/agenda/semillaCitas'
import { semanaAnterior, semanaSiguiente } from '../src/lib/agenda/semanasVecinas'

/**
 * Ayudas compartidas por las pruebas E2E de la agenda. No es una abstracción
 * especulativa: cada función de aquí la usan al menos dos archivos de
 * `agenda-*.e2e.ts` (login/navegación, lectura del toast, arrastre sobre la
 * rejilla, fecha laborable fija, persistencia en contexto nuevo). Selectores
 * tomados de `mapa_agenda.md` §6 y comprobados contra el DOM real servido por
 * `next start` en :3001 — no hay `data-testid`.
 */

const TZ = 'America/Merida'

export const SESION = {
  adminA: 'e2e/.auth/admin-a.json',
  medicoA: 'e2e/.auth/medico-a.json',
  secretariaA: 'e2e/.auth/secretaria-a.json',
  adminB: 'e2e/.auth/admin-b.json',
} as const

export const CORREO = {
  adminA: 'admin.a@semilla.spinus.test',
  medicoA: 'medico.a@semilla.spinus.test',
  secretariaA: 'secretaria.a@semilla.spinus.test',
  adminB: 'admin.b@semilla.spinus.test',
} as const

const CONTRASENA_SEMILLA = 'Semilla-Agenda-2026'

/**
 * Entra por la UI de /login. NINGÚN archivo de `agenda-*.e2e.ts` la llama hoy
 * (ninguno llama tampoco a `resembrar()`, de abajo, que es la razón por la
 * que ésta existiría): todos reutilizan el `storageState` que ya deja
 * `global-setup.ts`. Se queda como utilidad lista para el día en que una
 * prueba necesite volver a sembrar a mitad de archivo (lo que invalida ese
 * `storageState`, con los ids de ANTES de resembrar) y tenga que iniciar
 * sesión de nuevo por la UI en su lugar.
 */
export async function iniciarSesionUI(page: Page, correo: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico', { exact: true }).fill(correo)
  await page.getByLabel('Contraseña', { exact: true }).fill(CONTRASENA_SEMILLA)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  await page.waitForURL('**/inicio', { timeout: 20000 })
}

/**
 * Vuelve a sembrar la Supabase local (borra y recrea la clínica A y B de
 * `scripts/agenda-semilla.ts`). NINGÚN archivo la llama hoy: `global-setup.ts`
 * ya resiembra una vez por cada invocación de `npx playwright test`, y cada
 * archivo evita tocar filas de la semilla (crea datos propios, con nombres
 * únicos vía `tituloUnico`) para no necesitar una resiembra intermedia. Se
 * queda como utilidad para la prueba que sí la necesite — ver `iniciarSesionUI`,
 * cuyo storageState invalida.
 */
export function resembrar(): void {
  execFileSync('npx', ['tsx', 'scripts/agenda-semilla.ts'], { stdio: 'inherit', cwd: process.cwd() })
}

/**
 * El lunes de la semana que `/agenda` muestra por defecto al abrir HOY,
 * calculado una sola vez al cargar este módulo — MISMO cálculo que
 * `scripts/agenda-semilla.ts` (su `lunes`/`dia`), para que «miércoles de esta
 * semana» signifique la misma fecha en la prueba y en lo que la semilla
 * sembró. Fijarlo una vez (y no en cada llamada a `diaDeLaSemana`) es lo que
 * mantiene consistente una corrida que cruce la medianoche del domingo: el
 * «hoy» que cuenta es el de cuando Playwright arrancó, no el del reloj en
 * cada instante.
 */
const LUNES_VISIBLE = (() => {
  const hoy = hoyEnTZ(TZ)
  return desplazarFecha(hoy, { dias: -((new Date(`${hoy}T12:00:00Z`).getUTCDay() + 6) % 7) })
})()

/**
 * Una fecha laborable FIJA de la semana visible por defecto, en vez de
 * `new Date()` — la causa de la GRAVE §1 de la revisión: el modal precarga la
 * fecha de HOY, que un sábado o domingo cae fuera del horario de la clínica
 * (`scripts/agenda-semilla.ts`: sábado 08:00–13:00, domingo cerrado) y dispara
 * el aviso de confirmación o, en domingo, ni siquiera deja guardar dentro de
 * horario. `semana` es el mismo desplazamiento que usa la semilla (`dia`):
 * `0` = esta semana, `1` = la siguiente, `-1` = la anterior. `d` es el día
 * dentro de esa semana, `0` = lunes … `6` = domingo.
 */
export function diaDeLaSemana(semana: number, d: number): string {
  return desplazarFecha(LUNES_VISIBLE, { dias: semana * 7 + d })
}

/**
 * Miércoles de la semana visible (`diaDeLaSemana(0, 2)`) — el día laborable
 * fijo que usan las pruebas de alta, dentro de horario en todas las clínicas
 * de la semilla y nunca el de un evento sembrado que ya ocupe exactamente esa
 * fecha completa.
 */
export const DIA_LABORABLE_FIJO = diaDeLaSemana(0, 2)

/**
 * Jueves de la semana visible (`diaDeLaSemana(0, 3)`) — un SEGUNDO día
 * laborable fijo, para las pruebas de alta que no necesitan que sea
 * MIÉRCOLES en concreto (no comprueban nada sembrado ese día) y crean datos
 * propios. El miércoles de la semilla es, a propósito, el día MÁS cargado de
 * la semana (`scripts/agenda-semilla.ts`: «Cirugía programada» 07:00–10:00,
 * «Guardia» de todo el día, y la cita de consulta de las 10:00 con sus
 * extras aleatorios) — cada archivo que necesitaba un día fijo creaba ahí su
 * propia cita, y con varios archivos haciéndolo a la vez (sin resembrar
 * entre ellos) la rejilla de esa hora se volvía tan angosta que el harness
 * de FullCalendar de la tarjeta vecina tapaba el punto de clic de la propia
 * (comprobado: `locator.click` fallaba por "intercepts pointer events").
 * El jueves tiene la misma cita de consulta de las 10:00 y sus extras, pero
 * sin Cirugía ni Guardia — más hueco para repartir entre archivos.
 */
export const DIA_LABORABLE_LIBRE = diaDeLaSemana(0, 3)

/**
 * Un título de alta con sufijo único por corrida (milisegundos desde época,
 * base 36). MENOR de la revisión: sin resembrar entre pruebas, repetir el
 * mismo archivo sin pasar por `global-setup.ts` (p. ej. con `--grep` contra
 * una base ya sembrada) dejaría títulos duplicados de corridas anteriores.
 * Con el sufijo, cada corrida crea los suyos y los de antes no interfieren.
 */
export function tituloUnico(base: string): string {
  return `${base} ${Date.now().toString(36)}`
}

/**
 * Salta el archivo entero fuera del proyecto `escritorio`: para pruebas que
 * dependen de controles que sólo existen en el toolbar de escritorio
 * (`data-onboard="nueva-cita"`, `.fc-prev-button`, el `<select>` de médico del
 * header, el aside de Día) y que en `telefono` los sustituye otra cosa —
 * `BandaMovil`, la barra inferior— ya cubierta por `agenda-movil.e2e.ts`.
 * Se llama una vez al principio del archivo, fuera de cualquier `test()`.
 */
export function soloEscritorio(): void {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'escritorio', 'específica del proyecto escritorio (controles de escritorio)')
  })
}

/** Abre /agenda y espera a que pinte al menos una tarjeta. */
export async function irAAgenda(page: Page): Promise<void> {
  await page.goto('/agenda')
  await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 15000 })
}

/** Un evento (cita o evento genérico) de la rejilla que contenga ese texto. */
export function eventoConTexto(page: Page, texto: string): Locator {
  return page.locator('.fc-event', { hasText: texto }).first()
}

/** El toast (sin `role`, se localiza por su texto) de `src/components/ui/Toast.tsx`. */
export function toastConTexto(page: Page, texto: string): Locator {
  return page.getByText(texto, { exact: false })
}

/** El modal de alta/edición, por su título exacto (ver mapa §6). */
export function modalCita(page: Page, titulo: 'Nueva cita' | 'Editar cita' | 'Nuevo evento' | 'Editar evento'): Locator {
  return page.getByRole('dialog', { name: titulo })
}

/**
 * Píxeles por minuto de la rejilla actual (varía con el alto de ventana:
 * `--ag-slot-h` en globals.css vale 36/42/48 según la altura disponible).
 * Lee el alto de CUALQUIER fila de media hora con `getBoundingClientRect`
 * —geometría pura, sin disparar scroll ni depender de qué esté a la vista—
 * y no `boundingBox()` de Playwright, que si se usa sobre una fila lejana del
 * scroll actual puede arrastrar la página a un sitio que nos interesa dejar
 * quieto.
 */
async function pxPorMinuto(page: Page): Promise<number> {
  const alto = await page.evaluate(() => {
    const el = document.querySelector('td.fc-timegrid-slot-lane')
    return el ? el.getBoundingClientRect().height : null
  })
  if (!alto) throw new Error('pxPorMinuto: no se encontró ninguna fila de media hora en la rejilla')
  return alto / 30
}

/**
 * Arrastra un evento de la rejilla (vista Semana o Día, escritorio)
 * `deltaMinutos` DENTRO DEL MISMO DÍA (mismo eje X, sólo cambia el eje Y).
 *
 * ⚠️ NO SE BUSCA UNA ETIQUETA DE HORA DESTINO EN OTRO PUNTO DE LA PÁGINA:
 * se probó y es FRÁGIL. `.fc-timegrid-slots` es un scroller interno
 * (`.fc-scroller-liquid-absolute`; comprobado en el DOM real — el documento no
 * scrollea, `document.scrollHeight === innerHeight`), y si el origen y una
 * etiqueta lejana no caben los dos a la vez, `scrollIntoViewIfNeeded` del
 * segundo saca al primero de la pantalla sin que la caja ya leída se entere:
 * el arrastre sale desde un punto que ya no es el evento. Moverse una
 * cantidad RELATIVA a la propia caja del evento, ya traída a la vista, evita
 * el problema entero.
 */
export async function arrastrarEventoPorMinutos(page: Page, evento: Locator, deltaMinutos: number): Promise<void> {
  const porMinuto = await pxPorMinuto(page)
  const margen = 70
  // ⚠️ EL DESTINO PUEDE CAER FUERA DE LO VISIBLE, Y ESO ROMPE EL ARRASTRE SIN
  // AVISO: se probó mover el ratón a una `y` fuera de la zona que el propio
  // SCROLLER interno de FullCalendar deja ver (`.fc-scroller-liquid-absolute`;
  // el documento no scrollea, sólo él) y Chrome da por terminado el arrastre a
  // medio camino (el espejo desaparece, sin PUT). El margen se mide contra la
  // caja del SCROLLER, no contra la ventana entera: la ventana incluye el
  // toolbar y la cabecera de días, que están POR ENCIMA de él.
  const eventoHandle = await evento.elementHandle()
  if (!eventoHandle) throw new Error('arrastrarEventoPorMinutos: el evento no está en el DOM')
  await page.evaluate(
    ([el, bajando, margenPx]) => {
      const scroller = document.querySelector('.fc-scroller-liquid-absolute')
      if (!scroller) return
      const cajaScroller = scroller.getBoundingClientRect()
      // Bajando (delta positivo): el evento se deja cerca del TOP del scroller,
      // con hueco por debajo para el arrastre. Subiendo: al revés.
      const destino = bajando
        ? cajaScroller.top + (margenPx as number)
        : cajaScroller.top + cajaScroller.height - (margenPx as number)
      const rect = (el as HTMLElement).getBoundingClientRect()
      const nuevo = scroller.scrollTop + (rect.top - destino)
      scroller.scrollTop = Math.max(0, Math.min(scroller.scrollHeight - scroller.clientHeight, nuevo))
    },
    [eventoHandle, deltaMinutos >= 0, margen] as const,
  )
  const caja = await evento.boundingBox()
  if (!caja) throw new Error('arrastrarEventoPorMinutos: coordenadas del evento no disponibles')
  const x = caja.x + caja.width / 2
  const yOrigen = caja.y + caja.height / 2
  const yDestino = yOrigen + deltaMinutos * porMinuto
  await page.mouse.move(x, yOrigen)
  await page.mouse.down()
  await page.mouse.move(x, yOrigen + Math.sign(deltaMinutos || 1) * 4, { steps: 3 })
  await page.mouse.move(x, yDestino, { steps: 15 })
  await page.mouse.up()
}

/** Redimensiona el FIN de un evento arrastrando su asa `.fc-event-resizer-end`. */
export async function redimensionarFinEvento(page: Page, evento: Locator, deltaMinutos: number): Promise<void> {
  const porMinuto = await pxPorMinuto(page)
  const resizer = evento.locator('.fc-event-resizer-end')
  await evento.scrollIntoViewIfNeeded()
  // El asa sólo tiene caja de layout con el ratón ENCIMA del evento (CSS por
  // defecto de FullCalendar: `.fc-event-resizer { display: none }` salvo
  // `:hover`). Sin este `hover()` previo, `boundingBox()` da `null` siempre.
  await evento.hover()
  const caja = await resizer.boundingBox()
  if (!caja) throw new Error('redimensionarFinEvento: asa no encontrada')
  const x = caja.x + caja.width / 2
  const y = caja.y + caja.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + deltaMinutos * porMinuto, { steps: 12 })
  await page.mouse.up()
}

/**
 * El `<select>` de filtro por médico del toolbar de escritorio, identificado
 * por su opción «Todos los médicos» y no por posición. GRAVE §«Selectores
 * frágiles» de la revisión: `page.locator('select').first()` se rompe el día
 * que otro `<select>` se cuele antes en el DOM (el de médico/consultorio del
 * modal, por ejemplo, cuando el modal queda abierto encima).
 */
export function selectFiltroMedico(page: Page): Locator {
  return page.locator('select:has(option:text("Todos los médicos"))')
}

/**
 * Comprueba algo en un CONTEXTO NUEVO — no en `page` — abriendo `/agenda` con
 * el mismo `storageState` pero sin nada de estado de cliente heredado (caché
 * en memoria, el websocket ya abierto, cualquier ref de React). GRAVE §3 de
 * la revisión: un `page.reload()` sigue siendo el mismo `document`/proceso de
 * cliente, y si algún día se añade caché de rangos en el cliente (uno de los
 * objetivos declarados de A1), un `reload()` podría seguir leyendo de ahí en
 * vez de volver a preguntarle al servidor. Un contexto nuevo no tiene ese
 * problema: lo único que puede contestar es el servidor.
 */
export async function enContextoNuevo<T>(
  browser: Browser,
  storageState: string,
  fn: (page: Page) => Promise<T>,
): Promise<T> {
  const context = await browser.newContext({ storageState })
  const page = await context.newPage()
  try {
    return await fn(page)
  } finally {
    await context.close()
  }
}

/**
 * Devuelve una función que resuelve cuando llega, por el websocket de
 * Realtime, un frame que contiene el `clientId` dado — el eco de una
 * escritura propia (ver `firmarEscritura` en `page.tsx`, que viaja dentro de
 * la fila que Realtime retransmite). GRAVE §5 de la revisión: sin esperar
 * este eco, una prueba de alta no demuestra que el eco propio no duplica la
 * tarjeta — sólo que la actualización OPTIMISTA la pintó una vez, que es un
 * hecho mucho más débil.
 *
 * Hay que llamar a `observarEcosRealtime(page)` ANTES de `page.goto`: el
 * websocket de Realtime se abre al montar la agenda, y Playwright sólo
 * entrega el objeto `WebSocket` una vez, en el evento `'websocket'` de la
 * conexión que se abre — un listener puesto después de narrar no vería nada.
 */
export function observarEcosRealtime(page: Page): (clientId: string, timeoutMs?: number) => Promise<void> {
  const llegados = new Set<string>()
  const esperas = new Map<string, () => void>()
  page.on('websocket', (ws: WebSocket) => {
    ws.on('framereceived', ({ payload }) => {
      const texto = typeof payload === 'string' ? payload : payload.toString('utf8')
      for (const [clientId, resolver] of [...esperas]) {
        if (texto.includes(clientId)) {
          llegados.add(clientId)
          resolver()
          esperas.delete(clientId)
        }
      }
    })
  })
  return (clientId: string, timeoutMs = 10000) => {
    if (llegados.has(clientId)) return Promise.resolve()
    return new Promise<void>((resolve, reject) => {
      const tope = setTimeout(() => {
        esperas.delete(clientId)
        reject(new Error(`observarEcosRealtime: no llegó el eco de Realtime para client_id ${clientId} en ${timeoutMs} ms`))
      }, timeoutMs)
      esperas.set(clientId, () => { clearTimeout(tope); resolve() })
    })
  }
}

/** Un rango `{startStr,endStr}` tal como lo pide `rangoQuePedir`. La usan
 *  `ventanasDeLaSemilla` y las pruebas de precarga de A1.5b, que no quieren
 *  arrastrar `@fullcalendar/core` sólo por su tipo `EventInput`. */
export interface RangoISO { startStr: string; endStr: string }

/**
 * Corre `fn` con `TZ` fijado a la de la clínica, y lo restaura al salir.
 *
 * ⚠️ TODO lo que lea campos LOCALES de `Date` tiene que ir DENTRO de esta
 * misma llamada, no encadenado después: `semanasAlrededor` (ventanas de la
 * semilla) Y `semanaAnterior`/`semanaSiguiente` (sus vecinas) leen esos
 * campos, y si la segunda corre ya con `TZ` restaurado a lo que sea que
 * tenga el proceso de Playwright (no necesariamente la de la clínica), su
 * cálculo sale de otra zona y deja de coincidir con lo que pide el
 * navegador —que sí la lleva fijada (`timezoneId` en `playwright.config.ts`).
 * Ocurrió exactamente así la primera vez que se escribió esto.
 */
function conTzDeLaClinica<T>(fn: () => T): T {
  const TZ_ORIGINAL = process.env.TZ
  process.env.TZ = 'America/Merida'
  try {
    return fn()
  } finally {
    process.env.TZ = TZ_ORIGINAL
  }
}

/**
 * Las tres ventanas W-1/W/W+1 que la semilla del SERVIDOR cubre (A1.4c), en
 * la zona de la clínica — mismo cálculo que hace `AgendaCliente` al pedir
 * (`semanasAlrededor`), no uno nuevo. La usa `agenda-semilla.e2e.ts`, para
 * exigir que esas tres NO pidan red.
 */
export function ventanasDeLaSemilla(): RangoISO[] {
  return conTzDeLaClinica(() => semanasAlrededor(new Date()))
}

/**
 * Las dos vecinas de FUERA del trío sembrado — W-2 y W+2 — que la precarga
 * de semanas vecinas (A1.5b) sí pide al llegar al borde del trío. Las usan
 * `agenda-semilla.e2e.ts` (como lista PERMITIDA, lo único que tolera además
 * de las tres sembradas) y `agenda-cache-rangos.e2e.ts` (para comprobar que
 * la precarga de verdad pidió el rango exacto de W+2, y nada más).
 */
export function ventanasVecinasDeLaSemilla(): [RangoISO, RangoISO] {
  return conTzDeLaClinica(() => {
    const [w1, , w3] = semanasAlrededor(new Date())
    return [semanaAnterior(w1), semanaSiguiente(w3)]
  })
}

/** ¿Esta `url` de `GET /api/appointments` pide alguno de estos rangos? */
export function esUnaDeEstasVentanas(url: string, ventanas: RangoISO[]): boolean {
  return ventanas.some(v => url.includes(`from=${v.startStr}`) && url.includes(`to=${v.endStr}`))
}
