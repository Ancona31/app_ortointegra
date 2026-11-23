import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { soloEscritorio, sqlLocal } from './ayudas'
import { marcaE2e, limpiarReservasE2e } from './reservaAyudas'
import { baseUrlPublica, cerrarEscenario, emitirEnlace, ipAlAzar, personaNueva, prepararEscenario, primerTurnoDeLaSemanaSiguiente, type Escenario } from './reservaPublicaAyudas'

/**
 * Tanda M (punto 8 de Angel): «Salir» en «Tu cita quedó agendada». Cierra la pestaña; si el navegador no
 * la deja cerrar (una pestaña que no abrió un script y tiene historial, como la que llega desde un
 * correo), el botón se sustituye por «Ya puedes cerrar esta pestaña». Antes de cerrar borra lo guardado
 * de esa reserva en `sessionStorage`. Con el enlace de un solo uso (sin código), contra el `baseURL`.
 *
 * MUTACIONES (en rojo, con el servidor reconstruido): sin `window.close()` → «abierta con window.open»;
 * sin el texto de respaldo (sin `setSigueAbierta`) → «abierta directamente»; `alSalir` vacío →
 * «abierta directamente» (queda la clave en `sessionStorage`).
 */
test.describe.configure({ mode: 'serial' })
soloEscritorio()

let e: Escenario
let desde = ''
test.beforeAll(() => { desde = marcaE2e(); e = prepararEscenario() })
test.afterAll(() => { limpiarReservasE2e(desde); sqlLocal(`delete from public.tipos_cita where id = :'t'`, { t: e.tipoId }); cerrarEscenario() })

async function contexto(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': ipAlAzar() }, locale: 'es-MX', timezoneId: 'America/Merida', baseURL: baseUrlPublica() })
}

/** De «Lugar» a «Tu cita quedó agendada» con el único (sin correo ni código). */
async function reservarHastaListo(p: Page): Promise<void> {
  const persona = personaNueva()
  await p.locator(`input[name="consultorio"][value="${e.consultorioId}"]`).check()
  const tipo = p.locator(`input[name="tipo"][value="${e.tipoId}"]`)
  if (await tipo.count()) await tipo.check()
  await p.getByRole('button', { name: 'Elegir día y hora' }).click()
  // AG-DT-256: la reserva es por ligar; en la semana siguiente, nunca en la de hoy.
  await primerTurnoDeLaSemanaSiguiente(p)
  await p.getByRole('button', { name: 'Continuar' }).click()
  await p.getByLabel('Nombre completo').fill(persona.nombre)
  await p.getByLabel('Teléfono (10 dígitos)').fill(persona.telefono)
  await p.getByRole('checkbox').check()
  await p.getByRole('button', { name: 'Reservar cita' }).click()
  await expect(p.getByRole('heading', { name: 'Tu cita quedó agendada' })).toBeVisible()
}

test('abierta con window.open: «Salir» cierra la pestaña', async ({ browser }) => {
  const ctx = await contexto(browser)
  const origen = await ctx.newPage()
  await origen.goto('/login')
  const unico = emitirEnlace(e, 'unico').codigo
  const [p] = await Promise.all([ctx.waitForEvent('page'), origen.evaluate(u => { window.open(u) }, `/reservar/${unico}`)])
  await reservarHastaListo(p)
  const cerrada = p.waitForEvent('close', { timeout: 5000 })
  await p.getByRole('button', { name: 'Salir', exact: true }).click()
  await cerrada
  expect(p.isClosed()).toBe(true)
  await ctx.close()
})

test('abierta directamente: el botón se sustituye por el texto y sessionStorage queda vacío', async ({ browser }) => {
  const ctx = await contexto(browser)
  const p = await ctx.newPage()
  const unico = emitirEnlace(e, 'unico').codigo
  // Una página antes en el historial, como la redirección de un webmail: el navegador no deja cerrarla por script.
  await p.goto('/login')
  await p.goto(`/reservar/${unico}`)
  await reservarHastaListo(p)
  // Lo guardado de la reserva (al llegar a «Listo» ya se borra solo: aquí se pone a propósito para ver que «Salir» lo quita).
  await p.evaluate(c => { sessionStorage.setItem(`spinus.reserva.${c}`, '{"guardadoEn":0}') }, unico)
  await p.getByRole('button', { name: 'Salir', exact: true }).click()
  const texto = p.getByText('Ya puedes cerrar esta pestaña', { exact: true })
  await expect(texto).toBeVisible()
  await expect(texto).toBeFocused()
  await expect(p.getByRole('button', { name: 'Salir', exact: true })).toHaveCount(0)
  expect(p.isClosed()).toBe(false)
  expect(await p.evaluate(() => sessionStorage.length)).toBe(0)
  await ctx.close()
})
