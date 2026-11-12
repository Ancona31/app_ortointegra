import { test, expect } from '@playwright/test'
import { irAAgenda, soloEscritorio, SESION } from './ayudas'

/**
 * Lectura pura (ningún cambio de datos): usa el `storageState` de
 * `global-setup.ts` sin resembrar, y comparte la siembra inicial con el resto
 * de archivos de sólo-lectura.
 *
 * Sólo escritorio: `.fc-prev-button`/`.fc-next-button`/`.fc-today-button` y
 * el botón «Compactar» del toolbar no existen en `telefono` (los sustituye
 * `BandaMovil`, con sus propios textos — «Periodo anterior/siguiente»); y en
 * escritorio Semana/Día son `timeGrid`, nunca `listWeek`/`listDay`. El
 * equivalente móvil de vistas y compactar está en `agenda-movil.e2e.ts`.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

test('abre y pinta citas en Semana por defecto', async ({ page }) => {
  await irAAgenda(page)
  await expect(page.getByRole('tab', { name: 'Semana' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.fc-event').first()).toBeVisible()
})

test('conmutador Mes, Semana y Día', async ({ page }) => {
  await irAAgenda(page)
  await page.getByRole('tab', { name: 'Mes' }).click()
  await expect(page.locator('.fc-dayGridMonth-view')).toBeVisible()

  await page.getByRole('tab', { name: 'Día' }).click()
  await expect(page.locator('.fc-timeGridDay-view')).toBeVisible()

  await page.getByRole('tab', { name: 'Semana' }).click()
  await expect(page.locator('.fc-timeGridWeek-view')).toBeVisible()
})

test('‹ › y «Hoy» traen las citas de la semana que toca, no sólo cambian el título', async ({ page }) => {
  // GRAVE §7: la versión anterior sólo miraba `.fc-toolbar-title` — cambiaba
  // de texto aunque, por ejemplo, el rango pedido al servidor no cambiara de
  // verdad. Aquí se comprueba el CONTENIDO: eventos sembrados que sólo
  // existen en la semana siguiente/anterior (`scripts/agenda-semilla.ts`,
  // `eventosA`) y que NO existen en la semana que se deja atrás.
  await irAAgenda(page)
  const titulo = page.locator('.fc-toolbar-title')
  const inicial = await titulo.textContent()

  // Esta semana: «Cirugía programada» (dia(0,2), miércoles de esta semana).
  await expect(page.locator('.fc-event', { hasText: 'Cirugía programada' })).toBeVisible()

  await page.locator('.fc-next-button').click()
  await expect(titulo).not.toHaveText(inicial ?? '')
  // Semana siguiente: «Sesión docente» (dia(1,4), viernes de la semana que viene).
  await expect(page.locator('.fc-event', { hasText: 'Sesión docente' })).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.fc-event', { hasText: 'Cirugía programada' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Hoy' }).click()
  await expect(titulo).toHaveText(inicial ?? '')
  await expect(page.locator('.fc-event', { hasText: 'Cirugía programada' })).toBeVisible({ timeout: 15000 })

  await page.locator('.fc-prev-button').click()
  await expect(titulo).not.toHaveText(inicial ?? '')
  // Semana anterior: «Bloqueo de agenda» (dia(-1,1), martes de la semana pasada).
  await expect(page.locator('.fc-event', { hasText: 'Bloqueo de agenda' })).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.fc-event', { hasText: 'Cirugía programada' })).toHaveCount(0)
})

test('modal de horario: abre y cierra sin guardar', async ({ page }) => {
  await irAAgenda(page)
  await page.getByRole('button', { name: 'Configurar horario de consulta' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Horario de consulta' })
  await expect(dialogo).toBeVisible()
  // La X de cerrar no lleva nombre accesible (mapa §6: "X sin aria-label");
  // Escape es el cierre que SÍ tienen los tres diálogos de la agenda
  // (`useDialogoModal`), y el que puede localizarse sin ambigüedad.
  await page.keyboard.press('Escape')
  await expect(dialogo).toBeHidden()
})

/* F1.5 · La semilla tiene el domingo cerrado, así que «Compactar» abre ENCENDIDO
   (decisión 13); la prueba arranca de ahí y recorre el ciclo entero. */
test('botón Compactar alterna aria-pressed y aparece la banda compacta', async ({ page }) => {
  await irAAgenda(page)
  const boton = page.getByRole('button', { name: /Compactar la rejilla al horario de la clínica/ })
  await expect(boton).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.ag-banda-compacta')).toBeVisible()
  await boton.click()
  await expect(boton).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('.ag-banda-compacta')).toHaveCount(0)
  await boton.click()
  await expect(boton).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.ag-banda-compacta')).toBeVisible()
})

test('refresco automático al volver de segundo plano: nada antes de 2 minutos, refetch al pasarlos', async ({ page }) => {
  // MEDIA «Más»: el umbral vive en `UMBRAL_REFETCH_FOCO_MS` (page.tsx, 120000
  // ms) y el efecto que lo aplica escucha `visibilitychange`/`focus`
  // (page.tsx ~6988). No hay tab real que "poner en segundo plano" desde
  // Playwright: se simula sobreescribiendo `document.visibilityState` (un
  // valor normalmente de sólo lectura, pero redefinible para esto) y
  // disparando el evento a mano — es la misma señal que el navegador
  // dispararía, no un atajo que se salte el código bajo prueba.
  await irAAgenda(page)
  await page.clock.install({ time: Date.now() })

  async function simularVueltaAlFrente(): Promise<void> {
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
  }

  // Antes de 2 minutos: NO debe pedir de nuevo. En milisegundos y no
  // `'mm:ss'`: el parser de Playwright exige dos dígitos en los segundos
  // (`'01:50'`), y un número no deja ambigüedad ninguna.
  await page.clock.fastForward(110_000)
  let pidioDeMas = false
  const verPeticion = (r: { url(): string; method(): string }): void => {
    if (r.url().includes('/api/appointments') && r.method() === 'GET') pidioDeMas = true
  }
  page.on('request', verPeticion)
  await simularVueltaAlFrente()
  // No hay otra señal para "no ocurrió nada": se le da un respiro corto a
  // cualquier petición que pudiera salir y se comprueba que no salió.
  await page.waitForTimeout(500)
  expect(pidioDeMas).toBe(false)
  page.off('request', verPeticion)

  // Al pasar de los 2 minutos en total: SÍ debe refrescar.
  const esperaRefetch = page.waitForRequest(r => r.url().includes('/api/appointments') && r.method() === 'GET', { timeout: 5000 })
  await page.clock.fastForward(15_000)
  await simularVueltaAlFrente()
  await esperaRefetch
})
