/**
 * privacidad-publica.e2e.ts — privacidad 2026-12 (documentos 1 y 4 y registro).
 *
 *   · `/privacidad` es pública y pinta el aviso 3.0 de Spinus para sus usuarios;
 *   · `/privacy` es pública y redirige a `/privacidad` (una sola ruta);
 *   · `/terms` lleva la sección 23, numerada, con su tabla;
 *   · el registro no manda nada sin la casilla de aceptación, que enlaza a los
 *     dos documentos, y el servidor rechaza un alta sin ella.
 *
 * Sin sesión: contexto limpio. No crea ninguna cuenta (el alta buena no se
 * prueba aquí: mandaría correo por Resend, AG-DT-16).
 */
import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test('/privacidad: pública, versión 3.0, trece secciones, sin la marca registrada ni el INAI', async ({ page }) => {
  expect((await page.goto('/privacidad'))?.status()).toBe(200)
  expect(new URL(page.url()).pathname).toBe('/privacidad')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Aviso de privacidad integral de Spinus para sus usuarios')
  const aviso = page.locator('[data-aviso-spinus]')
  await expect(aviso.getByRole('heading', { level: 2 })).toHaveCount(13)
  await expect(page.getByText('Versión 3.0')).toBeVisible()
  await expect(aviso).toContainText('Secretaría Anticorrupción y Buen Gobierno (www.gob.mx/buengobierno)')
  await expect(aviso).toContainText('Este aviso no regula los datos de los pacientes')
  await expect(aviso).not.toContainText(/INAI|®|\*\*|\[FECHA|\{FECHA\}/)
})

test('/privacy: pública y redirige a /privacidad', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page).toHaveURL(/\/privacidad$/)
  await expect(page.locator('[data-aviso-spinus]')).toBeVisible()
})

test('/terms: la sección 23 con sus apartados y la tabla de subencargados; sin Anthropic', async ({ page }) => {
  expect((await page.goto('/terms'))?.status()).toBe(200)
  const seccion = page.locator('#encargo')
  await expect(seccion.getByRole('heading', { level: 2 })).toHaveText('23.Tratamiento de datos personales por cuenta del Usuario')
  await expect(seccion.getByRole('heading', { level: 3 })).toHaveCount(14)
  await expect(seccion.getByRole('columnheader')).toHaveText(['Proveedor', 'Servicio', 'Ubicación del tratamiento'])
  await expect(seccion.getByRole('row')).toHaveCount(6)
  await expect(seccion).not.toContainText(/\[N\]|\*\*|\|/)
  await expect(page.locator('main')).not.toContainText(/Anthropic|Claude|Meta Platforms/)
  await expect(page.getByText(/Versión: v3\.0/)).toBeVisible()
})

test('registro: sin la casilla no sale ninguna petición; con ella sí viaja `acepta_legal`', async ({ page }) => {
  const altas: unknown[] = []
  await page.route('**/api/auth/registro', async r => {
    altas.push(r.request().postDataJSON())
    await r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'cortado por la prueba' }) })
  })
  await page.goto('/register')
  const casilla = page.getByRole('checkbox')
  await expect(casilla).not.toBeChecked()
  const etiqueta = page.locator('label', { has: casilla })
  await expect(etiqueta).toHaveText('Leí y acepto el Aviso de privacidad y los Términos y Condiciones.')
  await expect(etiqueta.getByRole('link', { name: 'Aviso de privacidad' })).toHaveAttribute('href', '/privacidad')
  await expect(etiqueta.getByRole('link', { name: 'Términos y Condiciones' })).toHaveAttribute('href', '/terms')

  await page.getByPlaceholder('correo@ejemplo.com').fill('nadie@privacidad.test')
  await page.getByPlaceholder('Mínimo 8 caracteres').fill('una-contrasena-larga-1')
  await page.getByRole('button', { name: 'Crear cuenta gratuita' }).click()
  expect(altas).toHaveLength(0) // el navegador no deja enviar el formulario sin la casilla

  await casilla.check()
  await page.getByRole('button', { name: 'Crear cuenta gratuita' }).click()
  await expect(page.getByText('cortado por la prueba')).toBeVisible()
  expect(altas).toEqual([expect.objectContaining({ email: 'nadie@privacidad.test', acepta_legal: true })])
})

test('registro: el servidor rechaza un alta sin la aceptación, también hecha a mano', async ({ request }) => {
  for (const acepta of [undefined, false, 'true']) {
    const r = await request.post('/api/auth/registro', {
      data: { email: 'nadie@privacidad.test', password: 'una-contrasena-larga-1', ...(acepta === undefined ? {} : { acepta_legal: acepta }) },
      headers: { 'x-forwarded-for': '203.0.113.77' },
    })
    expect(r.status()).toBe(400)
    expect((await r.json()).error).toBe('Debes aceptar el Aviso de privacidad y los Términos y Condiciones para crear tu cuenta.')
  }
})
