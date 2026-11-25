import { test, expect, type Locator, type Page } from '@playwright/test'
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

/* ── La franja del Duo real toma el color de lo fijo que toca su borde ──────
   iOS rellena la franja lateral (fuera del viewport) con el color de lo
   `position: fixed` que toca ese borde; si no hay nada, el fondo de la página.
   Con cualquier capa abierta, lo único fijo en el borde derecho debe seguir
   siendo el cromo navy (riel en `ext`, barra en `ih`), y el cromo no se pulsa. */

interface FijoAlBorde { clase: string; der: number }

/** Lo `position: fixed` visible, fuera del cromo, cuyo borde derecho llega al del viewport. */
async function fijosAlBorde(page: Page): Promise<FijoAlBorde[]> {
  return page.evaluate(() => {
    const cromo = document.querySelectorAll('.nav-riel, aside#barra-lateral')
    return [...document.querySelectorAll('body *')].flatMap(e => {
      const cs = getComputedStyle(e)
      if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') return []
      if ([...cromo].some(c => c === e || c.contains(e))) return []
      const r = e.getBoundingClientRect()
      if (r.width < 1 || r.height < 1 || r.right < innerWidth - 0.5) return []
      return [{ clase: `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 60)}`, der: r.right }]
    })
  })
}

/** ¿El cromo recibe el clic en su centro? (con una capa abierta, no debe). */
async function cromoPulsable(page: Page, formato: 'ext' | 'ih'): Promise<boolean> {
  return page.evaluate(sel => {
    const c = document.querySelector(sel)
    if (!c) return false
    const r = c.getBoundingClientRect()
    const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return !!e && c.contains(e)
  }, formato === 'ext' ? '.nav-riel' : 'aside#barra-lateral')
}

async function sinFijosAlBorde(page: Page, formato: 'ext' | 'ih', capa: string): Promise<void> {
  expect(await fijosAlBorde(page), `${capa}: nada fijo en el borde derecho salvo el cromo`).toEqual([])
  expect(await cromoPulsable(page, formato), `${capa}: el cromo no se pulsa por detrás`).toBe(false)
}

/** En `ext`, la tarjeta mide 310 (sin la escala de entrada: `offsetWidth`) y va centrada entre el borde izquierdo y el riel. */
async function enteraYCentrada(page: Page, tarjeta: Locator, capa: string): Promise<void> {
  const m = await tarjeta.evaluate(e => {
    const riel = document.querySelector('.nav-riel')!.getBoundingClientRect()
    let x = 0
    for (let n: HTMLElement | null = e as HTMLElement; n; n = n.offsetParent as HTMLElement | null) x += n.offsetLeft
    return { ancho: (e as HTMLElement).offsetWidth, izq: x, hueco: riel.left - x - (e as HTMLElement).offsetWidth }
  })
  expect(m.ancho, `${capa}: cabe entera (310)`).toBe(310)
  expect(Math.abs(m.izq - m.hueco), `${capa}: centrada entre el borde y el riel`).toBeLessThanOrEqual(1)
}

test('con «Más», alerta, ⌘K y consulta rápida abiertos, sólo el cromo toca el borde derecho', async ({ page }, info) => {
  const f = franjasDe(info.project.name)!
  await abrir(page, '/dashboard', info.project.name)
  expect(await fijosAlBorde(page), 'sin capas').toEqual([])
  expect(await cromoPulsable(page, f.formato), 'sin capas, el cromo se pulsa').toBe(true)

  /* «Más» (sólo el riel lo tiene) y, desde él, la alerta de cambio de consultorio. */
  if (f.formato === 'ext') {
    await page.locator('.nav-riel').getByRole('button', { name: /^Más/ }).click()
    const mas = page.getByRole('dialog', { name: 'Más' })
    await expect(mas).toBeVisible()
    await sinFijosAlBorde(page, f.formato, '«Más»')
    await enteraYCentrada(page, mas, '«Más»')
    /* La semilla da dos consultorios al administrador: el selector está. */
    const fila = mas.getByRole('button', { name: /^Consultorio activo/ })
    {
      await fila.click()
      await mas.locator('.nav-consultorio-opcion').filter({ hasNot: page.locator('svg') }).first().click()
      const alerta = page.getByRole('dialog', { name: 'Cambiar consultorio activo' })
      await expect(alerta).toBeVisible()
      await sinFijosAlBorde(page, f.formato, 'alerta sobre «Más»')
      await enteraYCentrada(page, alerta, 'alerta')
      await alerta.getByRole('button', { name: 'Cancelar' }).click()
      await expect(alerta).toHaveCount(0)
    }
    await page.keyboard.press('Escape')
    await expect(mas).toHaveCount(0)
  } else {
    const boton = page.locator('aside#barra-lateral').getByRole('button', { name: /^Consultorio activo/ })
    {
      await boton.click()
      await page.locator('aside#barra-lateral .nav-consultorio-opcion').filter({ hasNot: page.locator('svg') }).first().click()
      const alerta = page.getByRole('dialog', { name: 'Cambiar consultorio activo' })
      await expect(alerta).toBeVisible()
      await sinFijosAlBorde(page, f.formato, 'alerta de consultorio')
      await alerta.getByRole('button', { name: 'Cancelar' }).click()
      await expect(alerta).toHaveCount(0)
    }
  }

  const paleta = page.getByRole('dialog', { name: 'Buscar paciente o folio' })
  await expect(async () => {
    if (!(await paleta.isVisible())) await page.keyboard.press('Control+k')
    await expect(paleta).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 10000 })
  await sinFijosAlBorde(page, f.formato, '⌘K')
  await page.keyboard.press('Escape')
  await expect(paleta).toHaveCount(0)

  await page.getByRole('button', { name: 'Nueva consulta' }).locator('visible=true').first().click()
  const consulta = page.locator('.k-capa[data-modo="arriba"]')
  await expect(consulta).toBeVisible()
  await sinFijosAlBorde(page, f.formato, 'consulta rápida')
  await page.keyboard.press('Escape')
  await expect(consulta).toHaveCount(0)
  expect(await cromoPulsable(page, f.formato), 'cerrado todo, el cromo vuelve a pulsarse').toBe(true)
})
