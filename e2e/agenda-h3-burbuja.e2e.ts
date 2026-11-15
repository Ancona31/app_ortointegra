import { test, expect, type Locator, type Page } from '@playwright/test'
import { SESION, diaDeLaSemana, interruptorAgenda, soloEscritorio, sqlLocal } from './ayudas'
import { abrirAgendaV2, burbuja, clicEnFranja } from './interaccionesAyudas'

/**
 * H3 · Puntos 11 a 14 de Angel (escritorio, interruptor encendido).
 *
 *   · 11: «Registrar «…»» de la burbuja en verde (`--ag-success-text`), con
 *     contraste AA contra el fondo pintado, en claro y en oscuro.
 *
 * Todo en la SEMANA +3 (como `agenda-t1-burbuja`), miércoles.
 *
 * MUTACIONES (cada una pone en rojo su prueba):
 *   · 11: quitar el `color` de `.ag-opcion--registrar` en `globals.css` (y, para el
 *     fondo de la señalada, quitar su `background`).
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

const MIERCOLES = diaDeLaSemana(3, 2)
const NUEVO = { nombre: 'Zoila', apellidos: 'Burbujah Tres' }

test.afterEach(() => {
  sqlLocal(`
    delete from public.paciente_medico where paciente_id in (select id from public.pacientes where apellidos = :'ap');
    delete from public.pacientes where apellidos = :'ap';`, { ap: NUEVO.apellidos })
  interruptorAgenda('A', false)
})

async function aLaSemanaMasTres(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) await page.locator('.fc-next-button').click()
  await expect(page.locator(`.fc-timegrid-col[data-date="${MIERCOLES}"]`)).toBeVisible()
}

/** La burbuja del miércoles 14:30 con «Registrar «…»» a la vista. */
async function burbujaConRegistrar(page: Page): Promise<{ b: Locator; registrar: Locator }> {
  await abrirAgendaV2(page)
  await aLaSemanaMasTres(page)
  await clicEnFranja(page, MIERCOLES, '14:30')
  const b = burbuja(page)
  await b.getByRole('combobox', { name: 'Paciente' }).fill(`${NUEVO.nombre} ${NUEVO.apellidos}`)
  const registrar = b.getByRole('option', { name: /Registrar «Zoila Burbujah Tres»/ })
  await expect(registrar).toBeVisible()
  return { b, registrar }
}

/**
 * Color y contraste WCAG de cada línea de `el` contra su fondo efectivo
 * (componiendo transparencias hacia arriba). Copia del de `reserva-g1-diseno`,
 * acotada a un elemento.
 */
async function coloresYContraste(el: Locator): Promise<{ color: string; token: string; ratio: number }[]> {
  return el.evaluate((raiz) => {
    const lienzo = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
    if (!lienzo) throw new Error('sin canvas')
    const rgba = (c: string): number[] => {
      lienzo.clearRect(0, 0, 1, 1); lienzo.fillStyle = '#000'; lienzo.fillStyle = c; lienzo.fillRect(0, 0, 1, 1)
      const [r = 0, g = 0, b = 0, a = 0] = lienzo.getImageData(0, 0, 1, 1).data
      return [r, g, b, a / 255]
    }
    const sobre = (arriba: number[], abajo: number[]) => [0, 1, 2].map(i => (arriba[i] ?? 0) * (arriba[3] ?? 1) + (abajo[i] ?? 0) * (1 - (arriba[3] ?? 1)))
    const fondo = (e: Element | null): number[] => {
      if (!e) return [255, 255, 255]
      const c = rgba(getComputedStyle(e).backgroundColor)
      return (c[3] ?? 0) >= 1 ? c.slice(0, 3) : sobre(c, fondo(e.parentElement))
    }
    const lum = (c: number[]) => { const [r = 0, g = 0, b = 0] = c.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
    const token = getComputedStyle(raiz).getPropertyValue('--ag-success-text').trim()
    return Array.from(raiz.querySelectorAll('span')).map((s) => {
      const bg = fondo(s)
      const fg = sobre(rgba(getComputedStyle(s).color), bg)
      const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x)
      return { color: getComputedStyle(s).color, token: `rgb(${rgba(token).slice(0, 3).join(', ')})`, ratio: ((a ?? 0) + 0.05) / ((b ?? 0) + 0.05) }
    })
  })
}

for (const tema of ['claro', 'oscuro'] as const) {
  test(`punto 11: «Registrar «…»» va en el verde de la agenda, con contraste AA (${tema}, en reposo y señalada)`, async ({ page }) => {
    if (tema === 'oscuro') await page.addInitScript(() => { try { localStorage.setItem('theme', 'dark') } catch { /* privado */ } })
    interruptorAgenda('A', true)
    const { b, registrar } = await burbujaConRegistrar(page)
    if (tema === 'oscuro') await expect(page.locator('html')).toHaveClass(/dark/)
    const enReposo = await coloresYContraste(registrar)
    expect(enReposo).toHaveLength(2)
    for (const l of enReposo) {
      expect(l.color).toBe(l.token)
      expect(l.ratio).toBeGreaterThanOrEqual(4.5)
    }
    // Señalada con el teclado (la última opción): fondo verde claro, sigue AA.
    await b.getByRole('combobox', { name: 'Paciente' }).press('ArrowUp')
    await expect(registrar).toHaveAttribute('aria-selected', 'true')
    // El fondo de la señalada es el verde de la agenda (no el azulado genérico de `.ag-opcion`).
    await expect.poll(() => registrar.evaluate((li) => {
      const muestra = document.createElement('i')
      muestra.style.backgroundColor = 'var(--ag-success-bg)'
      li.appendChild(muestra)
      const esperado = getComputedStyle(muestra).backgroundColor
      muestra.remove()
      return getComputedStyle(li).backgroundColor === esperado
    })).toBe(true)
    for (const l of await coloresYContraste(registrar)) expect(l.ratio).toBeGreaterThanOrEqual(4.5)
  })
}
