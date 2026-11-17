import { test, expect, type Page } from '@playwright/test'
import { interruptorAgenda, selectFiltroMedico, soloEscritorio, sqlLocal, SESION } from './ayudas'

/**
 * Puntos 10-13 de Angel · la agenda v2 se dibuja con los CONSULTORIOS, no con
 * el horario de la clínica. Semilla A con tres horarios propios distintos:
 *
 *   Centro (admin.a)          lunes a viernes 08:00–12:00
 *   Hosp Norte (admin.a)      lunes a viernes 15:00–19:00
 *   Rehabilitación (medico.a) lunes a viernes 10:00–14:00, sábado 09:00–13:00
 *
 * (la clínica dice 08:00–18:00 y sábado 08:00–13:00: si algo leyera todavía
 * el de la clínica, se vería). Se comprueba el gris (`.fc-non-business`), la
 * ventana y las columnas con «Compactar», el panel de huecos y la hora a la
 * que abre la vista, con «Todos», un médico y el consultorio activo.
 *
 * Deja la base como la encontró: horarios de los consultorios e interruptor.
 */
soloEscritorio()
test.describe.configure({ mode: 'serial' })
test.use({ storageState: SESION.adminA, timezoneId: 'America/Merida' })

const CL = `(select id from public.clinicas where nombre = 'Clínica Semilla A')`
const lv = (inicio: string, fin: string, sabado = '{"activo":false,"inicio":"09:00","fin":"14:00"}') => JSON.stringify(Object.fromEntries(
  ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].map(d => [d, { activo: true, inicio, fin }])
    .concat([['sabado', JSON.parse(sabado)], ['domingo', { activo: false, inicio: '09:00', fin: '14:00' }]])))

let antes = ''
let v2Antes = ''
let norteId = ''

test.beforeAll(() => {
  antes = sqlLocal(`select json_agg(json_build_object('id', id, 'h', horario, 'p', horario_propio)) from public.consultorios where clinica_id = ${CL}`)
  v2Antes = sqlLocal(`select coalesce((select agenda_v2_encendida::text from public.agenda_ajustes where clinica_id = ${CL}), 'sin')`)
  sqlLocal(`
    update public.consultorios set horario_propio = true, horario = :'c'::jsonb where clinica_id = ${CL} and nombre_corto = 'Centro';
    update public.consultorios set horario_propio = true, horario = :'n'::jsonb where clinica_id = ${CL} and nombre_corto = 'Hosp Norte';
    update public.consultorios set horario_propio = true, horario = :'r'::jsonb where clinica_id = ${CL} and nombre_corto = 'Rehab';`,
  { c: lv('08:00', '12:00'), n: lv('15:00', '19:00'), r: lv('10:00', '14:00', '{"activo":true,"inicio":"09:00","fin":"13:00"}') })
  norteId = sqlLocal(`select id from public.consultorios where clinica_id = ${CL} and nombre_corto = 'Hosp Norte'`)
  interruptorAgenda('A', true)
})

test.afterAll(() => {
  sqlLocal(`update public.consultorios k set horario = (x->>'h')::jsonb, horario_propio = (x->>'p')::boolean
              from json_array_elements(:'a'::json) x where k.id = (x->>'id')::uuid`, { a: antes })
  if (v2Antes === 'sin') sqlLocal(`delete from public.agenda_ajustes where clinica_id = ${CL}`)
  else sqlLocal(`update public.agenda_ajustes set agenda_v2_encendida = ${v2Antes} where clinica_id = ${CL}`)
})

/** Abre la agenda con la v2 ya leída (y, si se pide, un consultorio activo en la sesión del navegador). */
async function abrir(page: Page, consultorioActivo?: string): Promise<void> {
  if (consultorioActivo) {
    await page.addInitScript(id => { try { sessionStorage.setItem('consultorio_activo_id', id) } catch { /* privado */ } }, consultorioActivo)
  }
  await page.goto('/agenda')
  await expect(page.locator('[data-agenda-v2="encendida"]')).toBeAttached({ timeout: 15000 })
  await page.locator('.fc-timegrid-col[data-date]').first().waitFor()
}

/** Los tramos GRISES (`.fc-non-business`) de la columna del primer lunes visible, en «HH:MM-HH:MM». */
async function grisDelLunes(page: Page): Promise<string[]> {
  await page.waitForTimeout(300)
  return page.evaluate(() => {
    const lanes = Array.from(document.querySelectorAll<HTMLElement>('td.fc-timegrid-slot-lane[data-time]'))
    const y0 = lanes[0].getBoundingClientRect().top
    const [h0, m0] = (lanes[0].dataset.time ?? '00:00').split(':').map(Number)
    const pxMin = lanes[0].getBoundingClientRect().height / 30
    const col = Array.from(document.querySelectorAll<HTMLElement>('.fc-timegrid-col[data-date]'))
      .find(c => new Date(`${c.dataset.date}T12:00:00`).getDay() === 1)
    if (!col) return ['sin lunes']
    const reloj = (y: number) => {
      const min = Math.round((h0 * 60 + m0 + (y - y0) / pxMin) / 15) * 15
      return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
    }
    return Array.from(col.querySelectorAll<HTMLElement>('.fc-non-business'))
      .map(e => e.getBoundingClientRect())
      .sort((a, b) => a.top - b.top)
      .map(r => `${reloj(r.top)}-${reloj(r.bottom)}`)
  })
}

/** La primera y la última fila de la rejilla, y los días de la semana que se ven (0 = domingo). */
async function rejilla(page: Page): Promise<{ desde: string; hasta: string; dias: number[] }> {
  return page.evaluate(() => {
    const lanes = Array.from(document.querySelectorAll<HTMLElement>('td.fc-timegrid-slot-lane[data-time]'))
    const dias = Array.from(document.querySelectorAll<HTMLElement>('.fc-timegrid-col[data-date]'))
      .map(c => new Date(`${c.dataset.date}T12:00:00`).getDay())
    return { desde: lanes[0].dataset.time ?? '', hasta: lanes[lanes.length - 1].dataset.time ?? '', dias }
  })
}

/** Avanza hasta una semana sin citas (la semilla siembra unas cinco por delante): «Compactar» enseña sólo el horario. */
async function semanaVacia(page: Page): Promise<void> {
  for (let i = 0; i < 12; i++) {
    const antesFecha = await page.locator('.fc-timegrid-col[data-date]').first().getAttribute('data-date')
    await page.locator('.fc-next-button').click()
    await expect(page.locator('.fc-timegrid-col[data-date]').first()).not.toHaveAttribute('data-date', antesFecha ?? '')
    await page.waitForTimeout(400)
    if (i >= 4 && (await page.locator('.fc-event').count()) === 0) return
  }
  await expect(page.locator('.fc-event')).toHaveCount(0)
}

/* Con la v2 el rótulo dice «de los consultorios» (integración G1–G4): la
   rejilla ya no se compacta al horario de la clínica. Apagada, `agenda-vistas`
   sigue buscando el de la clínica. */
async function compactar(page: Page): Promise<void> {
  // I5 (punto 15): «Compactar» es una casilla del menú del engrane (no lo cierra).
  await page.getByRole('button', { name: 'Opciones de la agenda' }).click()
  const opcion = page.getByRole('menuitemcheckbox', { name: 'Compactar la rejilla al horario de los consultorios', exact: true })
  await opcion.click()
  await expect(opcion).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('Escape')
}

test('«Todos los médicos»: el gris es el de los tres consultorios, y «Compactar» va de la apertura más temprana al cierre más tardío', async ({ page }) => {
  await abrir(page)
  await selectFiltroMedico(page).selectOption({ label: 'Todos los médicos' })
  await semanaVacia(page)
  await expect.poll(() => grisDelLunes(page)).toEqual(['07:00-08:00', '14:00-15:00', '19:00-21:00'])
  await compactar(page)
  await expect.poll(() => rejilla(page)).toEqual({ desde: '08:00:00', hasta: '18:30:00', dias: [1, 2, 3, 4, 5, 6] })
})

test('un médico concreto (la invitada): su consultorio, también el sábado; el domingo se pliega', async ({ page }) => {
  await abrir(page)
  const invitada = sqlLocal(`select p.id from public.profiles p join auth.users u on u.id = p.id where u.email = 'medico.a@semilla.spinus.test'`)
  await selectFiltroMedico(page).selectOption(invitada)
  await semanaVacia(page)
  await expect.poll(() => grisDelLunes(page)).toEqual(['07:00-10:00', '14:00-21:00'])
  await compactar(page)
  // El sábado abre a las 09:00: la ventana va de la apertura más temprana de la semana.
  await expect.poll(() => rejilla(page)).toEqual({ desde: '09:00:00', hasta: '13:30:00', dias: [1, 2, 3, 4, 5, 6] })
})

test('el consultorio activo del menú lateral: el gris, los huecos y la hora a la que abre la vista son los suyos', async ({ page }) => {
  await abrir(page, norteId)
  // La vista abre en la apertura del consultorio (15:00): la fila de las 15:00
  // arriba del todo, o el scroller al fondo si la rejilla no da para tanto.
  await expect.poll(() => page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>('.fc-timegrid-body')?.closest<HTMLElement>('.fc-scroller')
    const lane = document.querySelector<HTMLElement>('td.fc-timegrid-slot-lane[data-time="15:00:00"]')
    if (!scroller || !lane) return 999
    const objetivo = Math.min(lane.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop,
      scroller.scrollHeight - scroller.clientHeight)
    return Math.abs(scroller.scrollTop - objetivo)
  })).toBeLessThanOrEqual(2)
  await semanaVacia(page)
  // admin.a abre filtrado a sí mismo; su consultorio activo es Hosp Norte (15:00–19:00).
  await expect.poll(() => grisDelLunes(page)).toEqual(['07:00-15:00', '19:00-21:00'])
  await page.getByRole('tab', { name: 'Día' }).click()
  // Un lunes sin citas: un solo hueco, la jornada entera del consultorio.
  for (let i = 0; i < 7; i++) {
    const fecha = await page.locator('.fc-timegrid-col[data-date]').first().getAttribute('data-date')
    if (fecha && new Date(`${fecha}T12:00:00`).getDay() === 1) break
    await page.locator('.fc-next-button').click()
  }
  const huecos = page.locator('section[aria-label="Huecos disponibles"] .ag-hueco')
  await expect(huecos).toHaveCount(1)
  await expect(huecos.first()).toContainText('15:00 – 19:00')
})
