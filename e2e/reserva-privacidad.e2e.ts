/**
 * reserva-privacidad.e2e.ts — privacidad 2026-12 (documentos 2 y 3 y punto 5).
 *
 *   · en «Tus datos» el aviso simplificado NO va desplegado (decisión de Angel):
 *     va la casilla nueva, y sus palabras «aviso de privacidad» lo abren en una
 *     capa, con clic y por teclado, sin perder lo escrito;
 *   · su última línea enlaza a `/reservar/{código}/privacidad`, que pinta el
 *     aviso integral del consultorio sin marcadores y siempre en claro;
 *   · esa página es tan pública como la reserva y da el MISMO 404 con un
 *     código inventado o con el aviso sin aprobar;
 *   · un consultorio sin dirección o sin teléfono cierra el enlace: 404 en la
 *     página, en el aviso y en la API.
 *
 * Requiere la base local sembrada y `next start` en :3001. No crea citas.
 */
import { test, expect } from '@playwright/test'
import { sqlLocal } from './ayudas'
import {
  api, aprobarAviso, cerrarEscenario, emitirEnlace, ipAlAzar, prepararEscenario, primerTurnoDeLaSemanaSiguiente, type Escenario,
} from './reservaPublicaAyudas'

test.describe.configure({ mode: 'serial' })
test.use({ extraHTTPHeaders: { 'x-forwarded-for': ipAlAzar() } })

let e: Escenario
let codigo = ''

test.beforeAll(() => {
  e = prepararEscenario()
  codigo = emitirEnlace(e, 'unico').codigo
})
test.afterAll(() => {
  aprobarAviso(true)
  sqlLocal(`delete from public.tipos_cita where id = :'t'`, { t: e.tipoId })
  cerrarEscenario()
})

/** El consultorio principal del médico del escenario (el que rellena los avisos). */
function principal(): { id: string; nombre: string; direccion: string; telefono: string } {
  const [id = '', nombre = '', direccion = '', telefono = ''] = sqlLocal(`
    select id, nombre, direccion, telefono from public.consultorios
     where medico_id = :'m' and activo order by es_default desc, nombre limit 1`, { m: e.medicoId }).split('|')
  return { id, nombre, direccion, telefono }
}

test('«Tus datos»: la casilla nueva abre el aviso en una capa, con clic y por teclado, y sigue siendo obligatoria', async ({ page }) => {
  const c = principal()
  await page.goto(`/reservar/${codigo}`)
  // Con otros archivos corridos antes puede haber más de un tipo: se elige el del escenario.
  const tipo = page.locator(`input[name="tipo"][value="${e.tipoId}"]`)
  if (await tipo.count()) await tipo.check()
  await page.getByRole('button', { name: 'Elegir día y hora' }).click()
  await primerTurnoDeLaSemanaSiguiente(page)
  await page.getByRole('button', { name: 'Continuar' }).click()

  // Lo escrito antes de abrir el aviso tiene que seguir ahí al cerrarlo.
  await page.getByLabel('Nombre completo').fill('Persona De Prueba')

  // El aviso NO va desplegado: sólo la casilla, con su texto exacto, desmarcada y obligatoria.
  const aviso = page.locator('[data-aviso-reserva]')
  const capa = page.getByRole('dialog', { name: 'Aviso de privacidad' })
  await expect(aviso).toBeHidden()
  await expect(page.locator('details')).toHaveCount(0)
  await expect(page.locator('.rp-acepto')).toHaveText(
    'Leí el aviso de privacidad y acepto que se traten mis datos para reservar mi cita, incluido conservar el historial de mis reservas, cancelaciones e inasistencias.')
  const casilla = page.locator('.rp-acepto input')
  await expect(casilla).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'Reservar cita' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Volver', exact: true })).toBeInViewport()

  // Un clic en «aviso de privacidad» lo abre en la capa, sin marcar la casilla ni salir de la página.
  const abrir = page.getByRole('button', { name: 'aviso de privacidad', exact: true })
  await abrir.click()
  await expect(capa).toBeVisible()
  await expect(casilla).not.toBeChecked()
  // Abre por el principio (no desplazada hasta el enlace del final), con el foco en su título.
  await expect(capa.getByRole('heading', { name: 'Aviso de privacidad' })).toBeFocused()
  await expect(capa.getByText('Aviso de privacidad simplificado para reservar')).toBeInViewport()
  // Centrada en la pantalla y entera dentro de ella.
  const caja = await capa.boundingBox()
  const vista = page.viewportSize()
  expect(caja && vista && Math.abs((caja.x + caja.width / 2) - vista.width / 2)).toBeLessThanOrEqual(2)
  expect(caja && vista && caja.y >= 0 && caja.y + caja.height <= vista.height).toBe(true)
  expect(new URL(page.url()).pathname).toBe(`/reservar/${codigo}`)
  await expect(aviso).toContainText('Aviso de privacidad simplificado para reservar una cita en línea')
  await expect(aviso).toContainText('Versión reserva-2026-12-v1')
  await expect(aviso).toContainText(`con domicilio en ${c.direccion} (${c.nombre}), es responsable`)
  await expect(aviso).toContainText(`comunícate con el consultorio al ${c.telefono} o acude a ${c.direccion}.`)
  await expect(aviso).not.toContainText(/\{[A-Z_]+\}|VERIFICAR|PENDIENTE/)
  const enlace = aviso.getByRole('link')
  await expect(enlace).toHaveAttribute('href', `/reservar/${codigo}/privacidad`)
  await expect(enlace).toHaveAttribute('target', '_blank')
  await expect(enlace).toHaveText(new RegExp(`/reservar/${codigo}/privacidad$`))
  // El foco queda dentro de la capa; Escape la cierra y lo devuelve al enlace.
  expect(await capa.evaluate(el => el.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(capa).toBeHidden()
  await expect(abrir).toBeFocused()

  // Por teclado: Enter sobre el enlace la abre; «Cerrar» la cierra.
  await page.keyboard.press('Enter')
  await expect(capa).toBeVisible()
  await capa.getByRole('button', { name: 'Cerrar' }).click()
  await expect(capa).toBeHidden()
  await expect(casilla).not.toBeChecked()
  await expect(page.getByLabel('Nombre completo')).toHaveValue('Persona De Prueba')

  // Sólo marcar la casilla enciende el botón.
  await page.getByLabel('Teléfono (10 dígitos)').fill('9991234567')
  await casilla.check()
  await expect(page.getByRole('button', { name: 'Reservar cita' })).toBeEnabled()
})

test('el aviso integral: público, relleno con el consultorio, sin marcadores y en claro', async ({ browser }) => {
  const c = principal()
  // Contexto limpio: sin sesión ni cookies, como quien llega desde su teléfono.
  const contexto = await browser.newContext({ colorScheme: 'dark' })
  const page = await contexto.newPage()
  try {
    const r = await page.goto(`/reservar/${codigo}/privacidad`)
    expect(r?.status()).toBe(200)
    expect(new URL(page.url()).pathname).toBe(`/reservar/${codigo}/privacidad`)
    const aviso = page.locator('[data-aviso-integral]')
    await expect(aviso.getByRole('heading', { level: 1 })).toHaveText('Aviso de privacidad integral del consultorio')
    await expect(aviso.getByRole('heading', { level: 2 })).toHaveCount(15)
    await expect(aviso).toContainText('Versión consultorio-2026-12-v1 · Última actualización: 24 de noviembre de 2026')
    await expect(aviso).toContainText(`con domicilio en ${c.direccion} (${c.nombre}), es responsable del tratamiento`)
    await expect(aviso).toContainText(`Medios. Por escrito en ${c.direccion} o, para orientación, al teléfono ${c.telefono}.`)
    await expect(aviso).toContainText('Secretaría Anticorrupción y Buen Gobierno (www.gob.mx/buengobierno)')
    await expect(aviso).not.toContainText(/\{[A-Z_]+\}|CORREO_PRIVACIDAD|\[FECHA|\*\*|\\|®/)
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(238, 241, 245)')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  } finally {
    await contexto.close()
  }
})

test('el aviso integral da el mismo 404 que la reserva: código inventado o aviso sin aprobar', async ({ page }) => {
  expect((await page.goto('/reservar/AAAAAAAAAAAAAAAAAAAAAA/privacidad'))?.status()).toBe(404)
  aprobarAviso(false)
  try {
    expect((await page.goto(`/reservar/${codigo}/privacidad`))?.status()).toBe(404)
    expect((await page.goto(`/reservar/${codigo}`))?.status()).toBe(404)
  } finally {
    aprobarAviso(true)
  }
  expect((await page.goto(`/reservar/${codigo}/privacidad`))?.status()).toBe(200)
})

for (const falta of ['direccion', 'telefono'] as const) {
  test(`un consultorio sin ${falta} cierra el enlace: 404 en la página, en el aviso y en la API`, async ({ page }) => {
    const c = principal()
    const ctx = await api()
    /* `postgres` en la base LOCAL; se devuelve en el finally. La dirección es
       NOT NULL en la base: el hueco posible es dejarla en blanco. El teléfono
       sí admite NULL (y el médico de la semilla no tiene uno propio). */
    sqlLocal(`update public.consultorios set ${falta} = ${falta === 'direccion' ? "' '" : 'null'} where id = :'id'`, { id: c.id })
    try {
      expect((await page.goto(`/reservar/${codigo}`))?.status()).toBe(404)
      expect((await page.goto(`/reservar/${codigo}/privacidad`))?.status()).toBe(404)
      expect((await ctx.get(`/api/reservar/${codigo}/turnos?consultorio=${e.consultorioId}&tipo=${e.tipoId}&desde=2026-12-01`)).status()).toBe(404)
    } finally {
      sqlLocal(`update public.consultorios set ${falta} = :'v' where id = :'id'`, { id: c.id, v: c[falta] })
      await ctx.dispose()
    }
    expect((await page.goto(`/reservar/${codigo}`))?.status()).toBe(200)
  })
}
