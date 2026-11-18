import { test, expect, type Page } from '@playwright/test'
import { diaDeLaSemana, interruptorAgenda, selectFiltroMedico, soloEscritorio, sqlLocal, SESION } from './ayudas'

/**
 * Tanda K, punto 16 de Angel · el gris de fuera de horario sale de CADA
 * consultorio, en su huso, y no del horario de la clínica. Dispositivo en
 * Mérida (UTC−6); Sonora (America/Hermosillo) es UTC−7 todo el año, así que las
 * 08:00 de Hermosillo son las 09:00 de Mérida.
 *
 * admin.a recibe dos consultorios con horario PROPIO y distinto:
 *   · «Sonora (e2e K4)», Hermosillo, 08:00–12:00 → blanco 09:00–13:00 en Mérida;
 *   · «Mérida (e2e K4)», Mérida, 10:00–14:00 → blanco 10:00–14:00.
 * Se mira el gris REAL de FullCalendar (`.fc-non-business`) de un martes:
 *   1. con Sonora activa; al cambiar el consultorio activo por el menú lateral
 *      (sin recargar), el de Mérida;
 *   2. un consultorio SIN horario propio en Hermosillo («Norte heredado (e2e
 *      K4)», su columna `horario` toda cerrada a propósito) hereda el de la
 *      clínica en SU huso: 08:00–18:00 → 09:00–19:00;
 *   3. «Todos los médicos»: de la apertura más temprana al cierre más tardío de
 *      todos los consultorios de la clínica, cada uno convertido.
 *
 * Lo que crea (tres consultorios) se borra al terminar como `postgres`; el
 * interruptor vuelve a como estaba (como la e2e de G4).
 */
soloEscritorio()
test.describe.configure({ mode: 'serial' })
test.use({ storageState: SESION.adminA, timezoneId: 'America/Merida' })

const CL = `(select id from public.clinicas where nombre = 'Clínica Semilla A')`
const DIA = diaDeLaSemana(1, 1) // martes de la semana que viene
const horario = (inicio: string, fin: string): string => JSON.stringify(Object.fromEntries(
  ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map(d => [d, { activo: true, inicio, fin }])))

const ids = { sonora: '', merida: '', heredado: '' }
let v2Antes = ''

function crearConsultorio(nombre: string, corto: string, tz: string, h: string, propio = true): string {
  return sqlLocal(`
    insert into public.consultorios (clinica_id, medico_id, nombre, nombre_corto, direccion, timezone, horario, horario_propio)
    select ${CL}, p.id, :'n', :'c', 'Calle 1', :'tz', :'h'::jsonb, :'p'::boolean
      from public.profiles p join auth.users u on u.id = p.id where u.email = 'admin.a@semilla.spinus.test'
    returning id;`, { n: nombre, c: corto, tz, h, p: String(propio) })
}
const CERRADO = JSON.stringify(Object.fromEntries(
  ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map(d => [d, { activo: false, inicio: '09:00', fin: '10:00' }])))

test.beforeAll(() => {
  v2Antes = sqlLocal(`select coalesce((select agenda_v2_encendida::text from public.agenda_ajustes where clinica_id = ${CL}), 'sin')`)
  interruptorAgenda('A', true)
  ids.sonora = crearConsultorio('Sonora (e2e K4)', 'Sonora K4', 'America/Hermosillo', horario('08:00', '12:00'))
  ids.merida = crearConsultorio('Mérida (e2e K4)', 'Mérida K4', 'America/Merida', horario('10:00', '14:00'))
  ids.heredado = crearConsultorio('Norte heredado (e2e K4)', 'Heredado K4', 'America/Hermosillo', CERRADO, false)
})

test.afterAll(() => {
  const creados = `{${Object.values(ids).filter(Boolean).join(',')}}`
  try {
    sqlLocal(`
      begin;
      set local session_replication_role = replica;
      delete from public.audit_log where registro_id = any (:'c'::uuid[]);
      delete from public.consultorios where id = any (:'c'::uuid[]);
      commit;`, { c: creados })
  } finally {
    if (v2Antes === 'sin') sqlLocal(`delete from public.agenda_ajustes where clinica_id = ${CL}`)
    else if (v2Antes) interruptorAgenda('A', v2Antes === 'true')
  }
})

async function abrirConActivo(page: Page, consultorioId: string): Promise<void> {
  await page.addInitScript(id => { try { sessionStorage.setItem('consultorio_activo_id', id) } catch { /* privado */ } }, consultorioId)
  await page.goto('/agenda')
  await expect(page.locator('[data-agenda-v2="encendida"]')).toBeAttached({ timeout: 15000 })
  for (let i = 0; i < 3 && !(await page.locator(`.fc-timegrid-col[data-date="${DIA}"]`).count()); i++) {
    await page.locator('.fc-next-button').click()
  }
  await expect(page.locator(`.fc-timegrid-col[data-date="${DIA}"]`)).toBeVisible()
}

/** Los tramos blancos (no grises) de la columna `fecha`, dentro de lo que pinta la rejilla (copia de la e2e de G4). */
async function blancos(page: Page, fecha: string): Promise<string[]> {
  return page.evaluate((f) => {
    const lanes = Array.from(document.querySelectorAll<HTMLElement>('td.fc-timegrid-slot-lane[data-time]'))
    const y0 = lanes[0].getBoundingClientRect().top
    const [h0, m0] = (lanes[0].dataset.time ?? '00:00').split(':').map(Number)
    const pxMin = lanes[0].getBoundingClientRect().height / 30
    const yFin = lanes[lanes.length - 1].getBoundingClientRect().bottom
    const reloj = (y: number) => {
      const min = Math.round((h0 * 60 + m0 + (y - y0) / pxMin) / 15) * 15
      return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
    }
    const grises = Array.from(document.querySelectorAll<HTMLElement>(`.fc-timegrid-col[data-date="${f}"] .fc-non-business`))
      .map(e => e.getBoundingClientRect()).sort((a, b) => a.top - b.top)
    const salida: string[] = []
    let y = y0
    for (const g of grises) {
      if (g.top - y > 2) salida.push(`${reloj(y)}-${reloj(g.top)}`)
      y = Math.max(y, g.bottom)
    }
    if (yFin - y > 2) salida.push(`${reloj(y)}-${reloj(yFin)}`)
    return salida
  }, fecha)
}

/** Cambia el consultorio activo por el menú lateral, como el médico (con la confirmación). */
async function cambiarActivo(page: Page, corto: string): Promise<void> {
  await page.getByRole('button', { name: /Consultorio activo/ }).click()
  await page.getByRole('button', { name: corto, exact: true }).click()
  await page.getByRole('button', { name: 'Sí, cambiar' }).click()
}

test('Sonora 08:00–12:00 se ve 09:00–13:00 desde Mérida, y al cambiar el activo el gris es el del otro', async ({ page }) => {
  await abrirConActivo(page, ids.sonora)
  await expect.poll(() => blancos(page, DIA)).toEqual(['09:00-13:00'])
  await cambiarActivo(page, 'Mérida K4')
  await expect.poll(() => blancos(page, DIA)).toEqual(['10:00-14:00'])
  await cambiarActivo(page, 'Sonora K4')
  await expect.poll(() => blancos(page, DIA)).toEqual(['09:00-13:00'])
})

test('un consultorio sin horario propio en Hermosillo hereda el de la clínica en su huso', async ({ page }) => {
  const clinica = sqlLocal(`select horario_consulta->'martes'->>'inicio' || '|' || (horario_consulta->'martes'->>'fin')
    from public.clinicas where id = ${CL}`)
  expect(clinica).toBe('08:00|18:00')
  await abrirConActivo(page, ids.heredado)
  await expect.poll(() => blancos(page, DIA)).toEqual(['09:00-19:00'])
})

test('«Todos los médicos»: de la apertura más temprana al cierre más tardío de todos, cada uno en su huso', async ({ page }) => {
  await abrirConActivo(page, ids.sonora)
  await selectFiltroMedico(page).selectOption({ label: 'Todos los médicos' })
  /* Los de la semilla (Mérida) 08:00–18:00, «Norte heredado» (Hermosillo) 09:00–19:00 y los otros dos dentro de
     esos: blanco 08:00–19:00. Sin convertir el huso, 08:00–18:00. */
  const zonas = sqlLocal(`select string_agg(distinct timezone, ',') from public.consultorios
    where clinica_id = ${CL} and activo and id not in (:'s'::uuid, :'m'::uuid, :'h'::uuid)`,
  { s: ids.sonora, m: ids.merida, h: ids.heredado })
  expect(zonas).toBe('America/Merida')
  await expect.poll(() => blancos(page, DIA)).toEqual(['08:00-19:00'])
})
