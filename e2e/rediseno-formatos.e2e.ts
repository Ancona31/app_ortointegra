import { test, expect, type Page } from '@playwright/test'
import { SESION } from './ayudas'

/**
 * Rediseño · B4 · la navegación por formato en el iPhone Duo, con sus franjas
 * del sistema emuladas por CDP (`Emulation.setSafeAreaInsetsOverride`): así
 * `env(safe-area-inset-*)` vale en la página lo mismo que en el dispositivo y
 * la sonda de `ScriptTema.tsx` clasifica el formato como allí.
 *
 * Sólo corre en los proyectos `duo-cerrado` (466×678, franja derecha 84 y
 * abajo 34 → `ext`, riel) y `duo-abierto` (951×669, franja derecha 84 y abajo
 * 34 → `ih`, barra lateral a la derecha), y en sus parejas `-real`: el aparato
 * de verdad deja la franja lateral FUERA del viewport y sin inset (382×678 en
 * una pantalla 466×678; 867×669 en una 669×951), y la sonda la deduce de
 * `window.screen`. Comprueba:
 *   · que se ve la navegación de su formato y no las otras;
 *   · que el riel o la barra van pegados al borde de la franja (o del viewport,
 *     si la franja queda fuera), sin hueco;
 *   · que ningún control interactivo visible cae bajo la franja lateral, ni
 *     ninguno fijo bajo la de abajo (lo que se desplaza sí pasa por debajo);
 *   · en `ih`, que ningún control FIJO cae en la bisagra (x 455–496);
 *   · que «Más» (riel) abre y cierra, y que ⌘K abre la paleta como diálogo.
 */

const FRANJAS = {
  'duo-cerrado': { formato: 'ext', top: 0, right: 84, bottom: 34, left: 0 },
  'duo-abierto': { formato: 'ih', top: 0, right: 84, bottom: 34, left: 0 },
  'duo-cerrado-real': { formato: 'ext', top: 0, right: 0, bottom: 0, left: 0 },
  'duo-abierto-real': { formato: 'ih', top: 0, right: 0, bottom: 0, left: 0 },
} as const

/* Lo que ocupa la navegación sin la franja: `--cromo-riel` y `--cromo-barra-ih`. */
const CROMO = { ext: 60, ih: 216 } as const

type Proyecto = keyof typeof FRANJAS

function franjasDe(nombre: string): (typeof FRANJAS)[Proyecto] | null {
  return nombre in FRANJAS ? FRANJAS[nombre as Proyecto] : null
}

test.use({ storageState: SESION.adminA })

test.beforeEach(({}, info) => {
  test.skip(franjasDe(info.project.name) === null, 'sólo en los proyectos del Duo')
})

async function abrir(page: Page, ruta: string, nombre: string): Promise<void> {
  const f = franjasDe(nombre)
  if (!f) throw new Error(`proyecto sin franjas: ${nombre}`)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setSafeAreaInsetsOverride', {
    insets: { top: f.top, right: f.right, bottom: f.bottom, left: f.left },
  })
  await page.goto(ruta)
  await expect(page.locator('html')).toHaveAttribute('data-formato', f.formato)
  await expect(page.locator('html')).toHaveAttribute('data-borde-sistema', 'derecha')
}

interface Caja { etiqueta: string; l: number; t: number; r: number; b: number; fijo: boolean }

/** Los controles interactivos visibles, con su caja y si cuelgan de algo `position: fixed`. */
async function controles(page: Page): Promise<Caja[]> {
  return page.evaluate(() => {
    const sel = 'a[href], button, input, select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])'
    const fijo = (e: Element): boolean => {
      for (let n: Element | null = e; n; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return true
      return false
    }
    return [...document.querySelectorAll(sel)].flatMap(e => {
      const r = e.getBoundingClientRect()
      const cs = getComputedStyle(e)
      if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || cs.pointerEvents === 'none') return []
      if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return []
      const etiqueta = (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 40)
      return [{ etiqueta, l: r.left, t: r.top, r: r.right, b: r.bottom, fijo: fijo(e) }]
    })
  })
}

const RUTAS = ['/dashboard', '/expediente', '/perfil', '/estadisticas']

for (const ruta of RUTAS) {
  test(`${ruta}: la navegación del formato y nada bajo las franjas`, async ({ page }, info) => {
    await abrir(page, ruta, info.project.name)
    const f = franjasDe(info.project.name)!
    const ancho = page.viewportSize()!.width
    const alto = page.viewportSize()!.height
    if (f.formato === 'ext') {
      await expect(page.locator('.nav-riel')).toBeVisible()
      await expect(page.locator('aside#barra-lateral')).toBeHidden()
    } else {
      await expect(page.locator('aside#barra-lateral')).toBeVisible()
      await expect(page.locator('.nav-riel')).toBeHidden()
    }
    await expect(page.locator('.nav-encabezado')).toBeHidden()
    /* Pegada a la franja (o al borde del viewport, si la franja queda fuera):
       ni hueco ni recorte. El riel llega al borde y se ensancha por debajo de
       la franja (la pinta); la barra de `ih` se para en la franja. */
    const ext = f.formato === 'ext'
    const cajaNav = (await page.locator(ext ? '.nav-riel' : 'aside#barra-lateral').boundingBox())!
    const bordeNav = ext ? ancho : ancho - f.right
    expect(Math.abs(cajaNav.x + cajaNav.width - bordeNav), 'navegación pegada a la franja').toBeLessThanOrEqual(1)
    expect(Math.round(cajaNav.width)).toBe(CROMO[f.formato] + (ext ? f.right : 0))
    const cajas = await controles(page)
    /* La franja lateral no la puede pisar nada; la de abajo, sólo lo fijo: el
       contenido que se desplaza pasa por debajo, como en cualquier app. */
    const bajoFranja = cajas.filter(c => c.r > ancho - f.right + 0.5 || (c.fijo && c.b > alto - f.bottom + 0.5))
    expect(bajoFranja, 'controles bajo la franja').toEqual([])
    if (f.formato === 'ih') {
      const enBisagra = cajas.filter(c => c.fijo && c.r > 455 && c.l < 496)
      expect(enBisagra, 'controles fijos en la bisagra (x 455–496)').toEqual([])
    }
  })
}

test('«Más» del riel abre una tarjeta y se cierra con Esc', async ({ page }, info) => {
  test.skip(franjasDe(info.project.name)?.formato !== 'ext', 'el riel es del Duo cerrado')
  await abrir(page, '/dashboard', info.project.name)
  await page.locator('.nav-riel').getByRole('button', { name: /^Más/ }).click()
  const dialogo = page.getByRole('dialog', { name: 'Más' })
  await expect(dialogo).toBeVisible()
  await expect(dialogo.getByRole('button', { name: /Modo (oscuro|claro)/ })).toBeVisible()
  await expect(dialogo.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
  const caja = await dialogo.boundingBox()
  const f = franjasDe(info.project.name)!
  expect(caja!.x + caja!.width).toBeLessThanOrEqual(page.viewportSize()!.width - f.right - CROMO.ext)
  await page.keyboard.press('Escape')
  await expect(dialogo).toHaveCount(0)
})

test('⌘K abre la paleta como diálogo con nombre, dentro del área de contenido', async ({ page }, info) => {
  await abrir(page, '/dashboard', info.project.name)
  const paleta = page.getByRole('dialog', { name: 'Buscar paciente o folio' })
  /* El atajo lo escucha un efecto de `CommandPalette`: si la tecla llega antes
     de hidratar, se pierde (y la paleta ALTERNA, así que no se pulsa dos veces
     con ella ya abierta). Falló así una de cada dos corridas en la integración. */
  await expect(async () => {
    if (!(await paleta.isVisible())) await page.keyboard.press('Control+k')
    await expect(paleta).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 10000 })
  await expect(paleta).toHaveAttribute('aria-modal', 'true')
  await expect(paleta.getByRole('textbox', { name: 'Buscar paciente por nombre o documento por folio' })).toBeFocused()
  const ancho = page.viewportSize()!.width
  const f = franjasDe(info.project.name)!
  const caja = await paleta.locator('.nav-paleta-tarjeta').boundingBox()
  expect(caja!.x + caja!.width).toBeLessThanOrEqual(ancho - f.right - CROMO[f.formato])
  await page.keyboard.press('Escape')
  await expect(paleta).toHaveCount(0)
})
