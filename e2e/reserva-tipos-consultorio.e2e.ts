import { test, expect, type Page } from '@playwright/test'
import { interruptorAgenda, sqlLocal } from './ayudas'
import { emitirEnlace, ipAlAzar, prepararEscenario, type Escenario } from './reservaPublicaAyudas'

/**
 * Punto 5 de Angel (integración de la tanda G1–G4, 2026-11-14): la página de
 * reserva enseña SÓLO los tipos de cita que valen en el consultorio elegido
 * (`tiposDelConsultorio`, la misma regla que /turnos y el POST); con uno solo
 * no hay selector, y al cambiar de consultorio la elección de tipo se
 * reinicia si el tipo elegido no vale en el nuevo.
 *
 * Escenario: el Dr. Admin con sus dos consultorios de la semilla (Centro y
 * Hospital Norte). Su duración general, «Consulta» 30 min, y otra «Consulta»
 * de 45 min SÓLO en Hospital Norte (G2). Antes del arreglo la página pasaba la
 * lista plana: las dos «Consulta» salían juntas y elegir la de 30 en el Norte
 * daba 400 en /turnos.
 *
 * Los tipos activos de la clínica que le valen al Dr. Admin se apagan durante
 * el archivo y se devuelven al final como estaban (y los creados se borran).
 */
test.describe.configure({ mode: 'serial' })
test.use({ extraHTTPHeaders: { 'x-forwarded-for': ipAlAzar() } })

let e: Escenario
let norte = ''
let general = ''
let enNorte = ''
let extra = ''
let apagados: string[] = []
let interruptorAntes = false

test.beforeAll(() => {
  interruptorAntes = sqlLocal(`select coalesce((select a.agenda_v2_encendida from public.agenda_ajustes a join public.clinicas c on c.id = a.clinica_id
                                where c.nombre = 'Clínica Semilla A'), false)::text`) === 'true'
  e = prepararEscenario()
  norte = sqlLocal(`select id from public.consultorios where medico_id = :'m' and activo and id <> :'c' order by nombre limit 1`,
    { m: e.medicoId, c: e.consultorioId })
  expect(norte, 'el Dr. Admin de la semilla tiene un segundo consultorio').not.toBe('')
  apagados = sqlLocal(`update public.tipos_cita set activo = false
                        where clinica_id = :'c' and activo and (medico_id is null or medico_id = :'m') returning id`,
  { c: e.clinicaId, m: e.medicoId }).split('\n').filter(Boolean)
  general = sqlLocal(`insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min, activo, principal)
                      values (:'c', :'m', 'Consulta', 30, true, true) returning id`, { c: e.clinicaId, m: e.medicoId })
  enNorte = sqlLocal(`insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min, activo, principal, consultorio_id)
                      values (:'c', :'m', 'Consulta', 45, true, true, :'k') returning id`, { c: e.clinicaId, m: e.medicoId, k: norte })
})

test.afterAll(() => {
  sqlLocal(`delete from public.tipos_cita where id = any(string_to_array(:'ids', ',')::uuid[])`,
    { ids: [general, enNorte, extra, e.tipoId].filter(Boolean).join(',') })
  if (apagados.length) {
    sqlLocal(`update public.tipos_cita set activo = true where id = any(string_to_array(:'ids', ',')::uuid[])`, { ids: apagados.join(',') })
  }
  interruptorAgenda('A', interruptorAntes)
})

const consultorio = (page: Page, id: string) => page.locator(`input[name="consultorio"][value="${id}"]`)
const selectorTipo = (page: Page) => page.getByRole('group', { name: 'Tipo de cita' })

/** Pulsa «Elegir día y hora» y devuelve el tipo con el que se pidió /turnos. */
async function tipoPedido(page: Page): Promise<string | null> {
  const peticion = page.waitForRequest(r => r.url().includes('/turnos?'))
  await page.getByRole('button', { name: 'Elegir día y hora' }).click()
  return new URL((await peticion).url()).searchParams.get('tipo')
}

test('con una «Consulta» por consultorio no hay selector, nunca salen las dos y /turnos lleva la de ese consultorio', async ({ page }) => {
  const { codigo } = emitirEnlace(e, 'unico')
  await page.goto(`/reservar/${codigo}`)
  await consultorio(page, e.consultorioId).check()
  await expect(selectorTipo(page)).toHaveCount(0)
  await expect(page.locator('input[name="tipo"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Elegir día y hora' })).toBeEnabled()
  expect(await tipoPedido(page)).toBe(general)

  await page.getByRole('button', { name: 'Volver', exact: true }).click()
  await consultorio(page, norte).check()
  await expect(selectorTipo(page)).toHaveCount(0)
  // El tipo se reinició al del Norte: con la lista plana seguiría el de 30 min (y /turnos daría 400).
  expect(await tipoPedido(page)).toBe(enNorte)
  await expect(page.locator('button[data-inicio]').first()).toBeVisible()
})

test('con un tipo de más, el selector enseña sólo los del consultorio y reinicia la elección que no vale', async ({ page }) => {
  extra = sqlLocal(`insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min, activo)
                    values (:'c', :'m', 'Primera vez', 60, true) returning id`, { c: e.clinicaId, m: e.medicoId })
  const { codigo } = emitirEnlace(e, 'unico')
  await page.goto(`/reservar/${codigo}`)
  await consultorio(page, e.consultorioId).check()
  const opciones = selectorTipo(page).locator('label')
  await expect(opciones).toHaveCount(2)
  await expect(opciones.filter({ hasText: 'Consulta' })).toHaveCount(1)
  await expect(opciones.filter({ hasText: 'Consulta' })).toContainText('30 min')
  await page.locator(`input[name="tipo"][value="${general}"]`).check()

  // Al Norte: la «Consulta» de 30 no vale allí, así que no queda ninguna elegida.
  await consultorio(page, norte).check()
  await expect(opciones).toHaveCount(2)
  await expect(opciones.filter({ hasText: 'Consulta' })).toContainText('45 min')
  await expect(page.locator(`input[name="tipo"][value="${general}"]`)).toHaveCount(0)
  await expect(page.locator('input[name="tipo"]:checked')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Elegir día y hora' })).toBeDisabled()

  // «Primera vez» vale en los dos: elegida en el Norte, sigue elegida al volver al Centro.
  await page.locator(`input[name="tipo"][value="${extra}"]`).check()
  await consultorio(page, e.consultorioId).check()
  await expect(page.locator(`input[name="tipo"][value="${extra}"]`)).toBeChecked()
  expect(await tipoPedido(page)).toBe(extra)
})
