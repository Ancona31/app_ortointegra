import { test, expect, type Page } from '@playwright/test'
import { enContextoNuevo, irAAgenda, toastConTexto, SESION } from './ayudas'

/**
 * Configuración sembrada desde `(app)/layout.tsx` (A1.6): la carga dura no
 * pide `GET /api/me/config`, la semilla es BYTE A BYTE lo que esa ruta le da al
 * mismo usuario (ni un campo de más en el documento), y guardar el horario
 * desde el modal de la agenda sigue repintando la rejilla aunque la caché de
 * SWR esté vacía (la semilla es `fallback`, no caché).
 */
const CONFIG = '/api/me/config'

function contarConfig(page: Page): () => number {
  let n = 0
  page.on('request', r => { if (r.method() === 'GET' && new URL(r.url()).pathname === CONFIG) n++ })
  return () => n
}

/**
 * La semilla tal como viajó en el documento: el objeto bajo
 * `"fallback":{"/api/me/config":` del payload RSC (los
 * `self.__next_f.push([1,"…"])` del HTML), recortado por llaves. Se devuelve el
 * TEXTO para que la comparación sea de bytes.
 */
function semillaDelDocumento(html: string): string | null {
  const flujo = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)]
    .map(m => String(JSON.parse(m[1])))
    .join('')
  const marca = `"fallback":{"${CONFIG}":`
  const i = flujo.indexOf(marca)
  if (i < 0) return null
  let nivel = 0, enCadena = false, escape = false
  for (let j = i + marca.length; j < flujo.length; j++) {
    const c = flujo[j]
    if (enCadena) {
      if (escape) escape = false
      else if (c === '\\') escape = true
      else if (c === '"') enCadena = false
      continue
    }
    if (c === '"') enCadena = true
    else if (c === '{') nivel++
    else if (c === '}' && --nivel === 0) return flujo.slice(i + marca.length, j + 1)
  }
  return null
}

for (const [quien, sesion] of [['admin', SESION.adminA], ['médico invitado', SESION.medicoA], ['secretaria', SESION.secretariaA]] as const) {
  test.describe(`A1.6 — ${quien}`, () => {
    test.use({ storageState: sesion })

    test('abrir la agenda no pide /api/me/config y la semilla es la respuesta de la ruta', async ({ page }) => {
      const pedidas = contarConfig(page)
      const documento = await page.goto('/agenda')
      await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 15000 })
      /* La revalidación al montar de SWR sale en el `rAF` siguiente al montaje
         (`swr/dist/index/index.mjs`, `rAF(softRevalidate)`); `networkidle` —sin
         peticiones durante 500 ms, tras Google incluido— la habría visto. */
      await page.waitForLoadState('networkidle')
      expect(pedidas()).toBe(0)

      const semilla = semillaDelDocumento(await documento?.text() ?? '')
      const ruta = await page.request.get(CONFIG)
      expect(ruta.status()).toBe(200)
      expect(semilla).not.toBeNull()
      expect(JSON.stringify(JSON.parse(semilla ?? 'null'))).toBe(await ruta.text())
    })
  })
}

test.describe('A1.6 — horario desde el modal (admin)', () => {
  test.use({ storageState: SESION.adminA })
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'escritorio', 'el botón del toolbar es de escritorio')
  })

  /* Lunes de la semilla: 08:00–18:00. Llevar el cierre a las 23:00 estira la
     rejilla más allá del suelo de 21:00 (`VENTANA_AMPLIA`), así que la fila de
     las 22:30 sólo existe si el horario nuevo llegó al calendario. */
  const FILA_TARDIA = 'td.fc-timegrid-slot-lane[data-time="22:30:00"]'

  test('guardar el horario se refleja en la rejilla y persiste', async ({ page, browser }) => {
    const original: unknown = (await (await page.request.get(CONFIG)).json()).horario
    try {
      const pedidas = contarConfig(page)
      await irAAgenda(page)
      await expect(page.locator(FILA_TARDIA)).toHaveCount(0)

      await page.getByRole('button', { name: 'Configurar horario de consulta' }).click()
      const dialogo = page.getByRole('dialog', { name: 'Horario de consulta' })
      await dialogo.locator('input[type="time"]').nth(1).fill('23:00')
      const guardado = page.waitForResponse(r => r.url().includes('/api/me/horario') && r.request().method() === 'PUT')
      await dialogo.getByRole('button', { name: 'Guardar horario' }).click()
      expect((await guardado).ok()).toBe(true)
      await expect(toastConTexto(page, 'Horario actualizado')).toBeVisible()
      await expect(dialogo).toBeHidden()
      await expect(page.locator(FILA_TARDIA)).toHaveCount(1)
      expect(pedidas()).toBe(0)

      await enContextoNuevo(browser, SESION.adminA, async (p) => {
        await irAAgenda(p)
        await expect(p.locator(FILA_TARDIA)).toHaveCount(1)
      })
    } finally {
      const r = await page.request.put('/api/me/horario', { data: { horario: original } })
      expect(r.ok()).toBe(true)
    }
    await enContextoNuevo(browser, SESION.adminA, async (p) => {
      await irAAgenda(p)
      await expect(p.locator(FILA_TARDIA)).toHaveCount(0)
    })
  })
})
