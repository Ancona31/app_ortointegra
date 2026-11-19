import { test, expect, type Locator, type Page } from '@playwright/test'
import { CORREO, SESION, interruptorAgenda, pestanaConfig, sinPendientesAgenda, sqlLocal } from './ayudas'

/**
 * Tanda M, agente M2 — la configuración de la agenda (puntos 2 y 15 de Angel):
 *   · 2  en computadora, «títulos de sección 16 px, texto 13–14 px, botones 13 px de letra y 40 px de alto, y
 *        los rellenos reducidos en proporción. En el teléfono, como está.» (el detalle, en `estilosConfig.ts`);
 *   · 15 la secretaria no cambia nada en «Cuándo dan consulta», «Tipos de cita», «Avisos» y «Más opciones»: al
 *        inicio de cada una, un aviso visible «Solo el médico administrador puede cambiar estas opciones.»; el
 *        médico invitado, sobre lo que no es suyo. En «Más opciones» la secretaria SÍ desbloquea personas: su
 *        aviso va sobre «Empezar de nuevo», no arriba de la pestaña. Los permisos no cambian: lo que cada aviso
 *        dice que no se puede, la ruta lo niega (y lo que sí se puede, la ruta lo deja).
 * Corre en los dos proyectos (teléfono y escritorio). Lo que crea lo deshace (`sinPendientesAgenda`).
 */

const RUTA = '/agenda/configuracion'
const AVISO = 'Solo el médico administrador puede cambiar estas opciones.'

const limpiezas: (() => void)[] = []
test.beforeEach(() => { interruptorAgenda('A', true) })
test.afterEach(() => { for (const l of limpiezas.splice(0)) l() })
test.afterAll(() => { interruptorAgenda('A', false) })

const panel = (page: Page, clave: string): Locator => page.locator(`#config-panel-${clave}`)

/** El aviso es el segundo hijo del panel: va justo debajo del título de la pestaña, antes que todo lo demás. */
async function avisoAlInicio(page: Page, clave: string): Promise<void> {
  const aviso = panel(page, clave).locator('[data-solo-admin]')
  await expect(aviso).toHaveCount(1)
  await expect(aviso).toBeVisible()
  await expect(aviso).toHaveText(AVISO)
  expect(await aviso.evaluate(el => [...(el.parentElement?.children ?? [])].indexOf(el)), `${clave}: el aviso al inicio`).toBe(1)
}

/** Visible: una caja con fondo propio y letra en seminegrita, no una línea de ayuda gris. */
async function seVe(aviso: Locator): Promise<void> {
  const cs = await aviso.evaluate(el => { const s = getComputedStyle(el); return { fondo: s.backgroundColor, peso: s.fontWeight } })
  expect(cs.fondo).not.toBe('rgba(0, 0, 0, 0)')
  expect(Number(cs.peso)).toBeGreaterThanOrEqual(600)
}

test.describe('15 · la secretaria', () => {
  test.use({ storageState: SESION.secretariaA })

  test('15 · el aviso al inicio de «Cuándo dan consulta», «Tipos de cita» y «Avisos», y sobre «Empezar de nuevo»', async ({ page }) => {
    await page.goto(RUTA)
    await pestanaConfig(page, 'Enlaces')
    await expect(panel(page, 'enlace').locator('[data-solo-admin]')).toHaveCount(0)
    for (const [nombre, clave] of [['Cuándo dan consulta', 'horario'], ['Tipos de cita', 'consulta'], ['Avisos', 'avisos']] as const) {
      await pestanaConfig(page, nombre)
      await avisoAlInicio(page, clave)
      await seVe(panel(page, clave).locator('[data-solo-admin]'))
    }
    // Una vez por pestaña: la tarjeta del horario de la clínica ya no lo repite.
    await expect(page.locator('[data-horario-clinica] [data-solo-admin]')).toHaveCount(0)
    await pestanaConfig(page, 'Más opciones')
    const empezar = panel(page, 'mas').locator('[data-empezar-sin-permiso]')
    await expect(empezar.locator('[data-solo-admin]')).toHaveText(AVISO)
    await expect(empezar).toContainText('Empezar de nuevo')
    await expect(panel(page, 'mas').getByRole('button', { name: /Empezar de nuevo/ })).toHaveCount(0)
    await expect(panel(page, 'mas').locator('[data-solo-admin]')).toHaveCount(1)
    // Lo que sí gestiona va antes y sin aviso encima.
    await expect(panel(page, 'mas')).toContainText('Personas bloqueadas')
    await expect(page.locator('[data-solo-admin]')).toHaveCount(4)
  })
})

test.describe('15 · el médico invitado', () => {
  test.use({ storageState: SESION.medicoA })

  test('15 · el aviso sobre lo que no es suyo: el horario de la clínica, los tipos de los demás, «Avisos» y «Empezar de nuevo»', async ({ page }) => {
    limpiezas.push(sinPendientesAgenda(CORREO.medicoA))
    // Un tipo de toda la clínica: la invitada lo ve y no lo cambia (los de otro médico, la RLS ni se los enseña).
    const tipo = sqlLocal(`insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min, principal)
      select id, null, 'M2 curación', 20, false from public.clinicas where nombre = 'Clínica Semilla A' returning id`)
    limpiezas.push(() => sqlLocal(`begin; set local session_replication_role = replica;
      delete from public.tipos_cita where id = :'t'; commit;`, { t: tipo }))
    await page.goto(RUTA)
    await pestanaConfig(page, 'Cuándo das consulta')
    await expect(page.locator('[data-horario-clinica] [data-solo-admin]')).toHaveText(AVISO)
    await expect(panel(page, 'horario').locator('[data-solo-admin]')).toHaveCount(1)
    await seVe(page.locator('[data-horario-clinica] [data-solo-admin]'))

    await pestanaConfig(page, 'Tu consulta')
    const aviso = panel(page, 'consulta').locator('[data-solo-admin]')
    await expect(aviso).toHaveCount(1)
    await expect(aviso).toHaveText(AVISO)
    // Sus tipos (y «Agregar tipo de cita») arriba del aviso; los de los demás, debajo y sin botones.
    const y = async (l: Locator): Promise<number> => (await l.boundingBox())?.y ?? NaN
    const ajeno = panel(page, 'consulta').getByRole('group', { name: 'M2 curación' })
    await expect(ajeno).toBeVisible()
    await expect(ajeno).toContainText('Toda la clínica')
    expect(await y(aviso)).toBeLessThan(await y(ajeno))
    await expect(ajeno.getByRole('button')).toHaveCount(0)
    expect(await y(panel(page, 'consulta').getByRole('button', { name: 'Agregar tipo de cita' }))).toBeLessThan(await y(aviso))
    // Lo que dice el aviso lo dice la ruta: el tipo de toda la clínica no es suyo (404, la RLS no se lo deja tocar).
    expect((await page.request.patch(`/api/agenda/tipos-cita/${tipo}`, { data: { duracion_min: 25 } })).status()).toBe(404)

    await pestanaConfig(page, 'Avisos')
    await avisoAlInicio(page, 'avisos')
    await pestanaConfig(page, 'Más opciones')
    await expect(panel(page, 'mas').locator('[data-empezar-sin-permiso] [data-solo-admin]')).toHaveText(AVISO)
    await expect(page.locator('[data-solo-admin]')).toHaveCount(4)
  })
})

test.describe('15 · los permisos que dice cada aviso', () => {
  test.use({ storageState: SESION.secretariaA })

  test('15 · la secretaria sí lista y gestiona los contactos bloqueados (por eso su aviso de «Más opciones» no va arriba)', async ({ page }, info) => {
    test.skip(info.project.name !== 'escritorio', 'las rutas no dependen del tamaño')
    // Lo que los avisos dicen que no puede (horario, consultorios, tipos, avisos, restablecer) lo prueba
    // `agenda-l3-configuracion` 17 («permisos»): 403/404. Aquí, lo que sí puede.
    expect((await page.request.get('/api/agenda/reservas/contactos')).status()).toBe(200)
  })
})

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
