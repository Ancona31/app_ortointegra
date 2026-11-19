import { test, expect, type Locator, type Page } from '@playwright/test'
import { CORREO, SESION, interruptorAgenda, pestanaConfig, sinPendientesAgenda } from './ayudas'

/**
 * Tanda M, agente M2 — la configuración de la agenda (punto 2 de Angel):
 *   · 2  en computadora, «títulos de sección 16 px, texto 13–14 px, botones 13 px de letra y 40 px de alto, y
 *        los rellenos reducidos en proporción. En el teléfono, como está.» (el detalle, en `estilosConfig.ts`);
 * Corre en los dos proyectos (teléfono y escritorio). Lo que crea lo deshace (`sinPendientesAgenda`).
 */

const RUTA = '/agenda/configuracion'

const limpiezas: (() => void)[] = []
test.beforeEach(() => { interruptorAgenda('A', true) })
test.afterEach(() => { for (const l of limpiezas.splice(0)) l() })
test.afterAll(() => { interruptorAgenda('A', false) })

const panel = (page: Page, clave: string): Locator => page.locator(`#config-panel-${clave}`)

/* ── 2 · la escala de computadora ───────────────────────────────────────── */

interface Medidas { h1: number; h2: number; ayuda: number; pestana: [number, number]; agenda: number; boton: [number, number] }

async function medidas(page: Page): Promise<Medidas> {
  await pestanaConfig(page, 'Cuándo das consulta')
  const p = panel(page, 'horario')
  const caja = async (l: Locator): Promise<[number, number]> => l.evaluate(el =>
    [el.getBoundingClientRect().height, parseFloat(getComputedStyle(el).fontSize)] as [number, number])
  const letra = async (l: Locator): Promise<number> => (await caja(l))[1]
  return {
    h1: await letra(page.locator('main h1')),
    h2: await letra(p.locator('h2')),
    ayuda: await letra(page.locator('[data-horario-clinica] span').filter({ hasText: 'Lo usan los consultorios' })),
    pestana: await caja(page.locator('#config-tab-horario')),
    agenda: (await caja(page.locator('main a[href="/agenda"]').first()))[0],
    boton: await caja(p.getByRole('button', { name: 'Cambiar horario de la clínica' })),
  }
}

test.describe('2 · el administrador', () => {
  test.use({ storageState: SESION.adminA })

  test('2 · en computadora 16 / 13–14 / 13 px y 40 de alto; en el teléfono, como estaba', async ({ page }, info) => {
    limpiezas.push(sinPendientesAgenda(CORREO.adminA))
    await page.goto(RUTA)
    const m = await medidas(page)
    const compu = info.project.name === 'escritorio'
    expect(m.h1).toBe(18)
    expect(m.h2).toBe(16)
    expect(m.ayuda).toBe(compu ? 13 : 13.5)
    expect(m.pestana).toEqual(compu ? [40, 13] : [52, 15])
    expect(m.agenda).toBe(compu ? 40 : 44)
    expect(m.boton).toEqual(compu ? [40, 13] : [44, 15])
    // El interruptor: el mismo dibujo (52 × 30) y su área de toque, 40 en computadora (5 px fuera) y 46 en el teléfono (8).
    await pestanaConfig(page, 'Avisos')
    const sw = panel(page, 'avisos').getByRole('switch').first()
    const toque = await sw.evaluate(el => {
      el.scrollIntoView({ block: 'center' })
      const v = el.getBoundingClientRect()
      const x = v.left + v.width / 2
      const llega = (d: number) => [v.top - d, v.bottom + d].every(yy => document.elementFromPoint(x, yy)?.closest('[role="switch"]') === el)
      return { alto: v.height, ancho: v.width, d4: llega(4), d6: llega(6), d7: llega(7), d9: llega(9) }
    })
    expect([toque.ancho, toque.alto]).toEqual([52, 30])
    expect(toque).toMatchObject(compu ? { d4: true, d6: false } : { d7: true, d9: false })
  })
})
