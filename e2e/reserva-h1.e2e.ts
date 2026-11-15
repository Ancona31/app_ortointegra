import { test, expect, type Page } from '@playwright/test'
import { interruptorAgenda, sqlLocal } from './ayudas'
import { esperarCorreo } from './mailpit'
import { marcaE2e, limpiarReservasE2e } from './reservaAyudas'
import { emitirEnlace, ipAlAzar, personaNueva, prepararEscenario, reservar, turnosLibres, type Escenario } from './reservaPublicaAyudas'

/**
 * Tanda H1 (2026-11-15): cuatro puntos de Angel sobre /reservar, /confirmar y
 * los correos, en TELÉFONO y en ESCRITORIO.
 *
 *   · Punto 2 · siempre en claro: ni el oscuro del sistema (`colorScheme:
 *     'dark'`) ni el guardado en la app (`html.dark`, que se queda puesta al
 *     llegar desde la app sin recargar) oscurecen estas páginas.
 *
 * Las pruebas de los correos (sin oscuro, `color-scheme: light`) son de Vitest
 * (`plantillaCita.test.ts`). La seguridad, los límites, los turnos y la RPC no
 * cambian; los prueban reserva-enlace, reserva-seg1 y confirmacion-enlace.
 */
test.describe.configure({ mode: 'serial' })
test.use({ extraHTTPHeaders: { 'x-forwarded-for': ipAlAzar() } })

let e: Escenario
let desde = ''
let interruptorAntes = false
let confirmacion = ''

test.beforeAll(() => {
  interruptorAntes = sqlLocal(`select coalesce((select a.agenda_v2_encendida from public.agenda_ajustes a join public.clinicas c on c.id = a.clinica_id
                                where c.nombre = 'Clínica Semilla A'), false)::text`) === 'true'
  desde = marcaE2e()
  e = prepararEscenario()
})
test.afterAll(() => {
  limpiarReservasE2e(desde)
  sqlLocal(`delete from public.tipos_cita where id = :'t'`, { t: e.tipoId })
  interruptorAgenda('A', interruptorAntes)
})

/* ── Punto 2 · siempre en claro ───────────────────────────────────────────── */

/** Los colores que de verdad se pintan, y lo que el documento declara. */
async function pintado(page: Page): Promise<{ fondo: string; tarjeta: string; tinta: string; esquema: string; meta: string | null }> {
  return page.evaluate(() => {
    const tarjeta = document.querySelector('.rp-tarjeta')
    const titulo = document.querySelector('.rp-titulo, .rp-fecha')
    return {
      fondo: getComputedStyle(document.body).backgroundColor,
      tarjeta: tarjeta ? getComputedStyle(tarjeta).backgroundColor : '',
      tinta: titulo ? getComputedStyle(titulo).color : '',
      esquema: getComputedStyle(document.documentElement).colorScheme,
      meta: document.querySelector('meta[name="color-scheme"]')?.getAttribute('content') ?? null,
    }
  })
}

/** Lo que pinta el claro de fábrica: fondo #eef1f5, tarjeta blanca, tinta #15243e. */
const CLARO = { fondo: 'rgb(238, 241, 245)', tarjeta: 'rgb(255, 255, 255)', tinta: 'rgb(21, 36, 62)', esquema: 'light', meta: 'light' }

/** Un código de /confirmar de una cita reservada por el enlace único (el del comprobante). */
async function codigoDeConfirmacion(): Promise<string> {
  if (confirmacion) return confirmacion
  const { codigo } = emitirEnlace(e, 'unico')
  const [turno] = await turnosLibres(e, codigo, 14)
  const persona = personaNueva()
  expect((await reservar(e, codigo, { inicio: turno?.inicio ?? '', persona })).status).toBe(201)
  const c = await esperarCorreo(persona.correo, 'Tu cita con')
  confirmacion = /\/confirmar\/([A-Za-z0-9_-]{22})/.exec(c.texto)?.[1] ?? ''
  expect(confirmacion).not.toBe('')
  return confirmacion
}

for (const origen of ['el sistema en oscuro', 'el oscuro guardado en la app (html.dark)'] as const) {
  test(`punto 2: /reservar y /confirmar se ven en claro con ${origen}`, async ({ page }) => {
    const app = origen.includes('html.dark')
    await page.emulateMedia({ colorScheme: app ? 'light' : 'dark' })
    const ponerOscuroDeLaApp = async () => { if (app) await page.evaluate(() => document.documentElement.classList.add('dark')) }

    await page.goto(`/reservar/${emitirEnlace(e, 'unico').codigo}`)
    await expect(page.getByRole('button', { name: 'Elegir día y hora' })).toBeVisible()
    await ponerOscuroDeLaApp()
    expect(await pintado(page)).toEqual(CLARO)

    await page.goto(`/confirmar/${await codigoDeConfirmacion()}`)
    await expect(page.getByRole('heading', { name: 'Tu cita' })).toBeVisible()
    await ponerOscuroDeLaApp()
    expect(await pintado(page)).toEqual(CLARO)
  })
}
