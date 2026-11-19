import { test, expect, type Locator, type Page } from '@playwright/test'
import { CORREO, SESION, diaDeLaSemana, interruptorAgenda, modalCita, sqlLocal, tituloUnico } from './ayudas'
import { abrirAgendaV2, tarjetaLectura } from './interaccionesAyudas'
import { crearCitaPorLigar, aparcarEnlacesVigentes, devolverEnlaces, limpiarReservasE2e, marcaE2e } from './reservaAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * Tanda K, sección E, punto 21 de Angel: la burbuja de `docs/spec/Burbuja.dc.html`, en lo que
 * sólo se ve con navegador (lo que va en cada sitio y sus textos están en `burbujaCita.test.tsx`;
 * el orden de la barra, la rejilla pareja, Confirmar y la cancelada, en `agenda-g3-tarjeta`).
 *   · procedencia: la «G» a color en la de Google; el eslabón, permanente, en la ligada por
 *     enlace; el expediente tachado con su aviso en la que no tiene expediente;
 *   · los tres puntos: Escape los cierra a ellos (no a la burbuja) y devuelve el foco;
 *     «Observaciones» abre el formulario; «No asistió» (agendada) manda PUT no_show.
 * Semana +6 (nadie más la usa).
 *
 * MUTACIONES (comprobadas en rojo, una por prueba):
 *   · `Procedencia` con `enlace = Boolean(cita.reserva_canal) && !cita.paciente_id` → «procedencia»;
 *   · `useDesplegado` sin `botonMas.current?.focus()` → «los tres puntos».
 */
test.use({ storageState: SESION.adminA })

const TZ = 'America/Merida'
const MARTES = diaDeLaSemana(6, 1)
let desde = ''
let aparcados: string[] = []
const creadas: string[] = []

test.beforeAll(() => { aparcados = aparcarEnlacesVigentes(); desde = marcaE2e() })
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'escritorio', 'la burbuja flotante es de escritorio; la hoja la mira agenda-g3-tarjeta')
  interruptorAgenda('A', true)
})
test.afterAll(() => {
  try {
    limpiarReservasE2e(desde)
    sqlLocal(`begin; set local session_replication_role = replica;
      delete from public.appointments where google_event_id like 'falso-k5b-e2e-%'
         or id = any (string_to_array(:'ids', ',')::uuid[]); commit;`, { ids: creadas.join(',') || '00000000-0000-0000-0000-000000000000' })
  } finally { devolverEnlaces(aparcados); interruptorAgenda('A', false) }
})

/** Una agendada de admin.a con paciente y observaciones, por SQL. */
function agendada(hora: string, apellidos: string): string {
  const id = sqlLocal(`
    insert into public.appointments (clinica_id, paciente_id, medico_id, consultorio_id, title, start_time, end_time, status, notes,
           consultorio_nombre, consultorio_timezone, origen, gcal_sync_status)
    select co.clinica_id, pa.id, co.medico_id, co.id, 'Paciente ' || pa.apellidos, :'ini'::timestamptz, :'ini'::timestamptz + interval '30 min',
           'scheduled', 'Observación K5B', co.nombre, :'tz', 'spinus', 'synced'
      from public.consultorios co join public.pacientes pa on pa.clinica_id = co.clinica_id and pa.apellidos = :'ap'
     where co.nombre = 'Consultorio Centro (ficticio)' returning id`, { ini: fechaHoraLocalAInstante(MARTES, hora, TZ), ap: apellidos, tz: TZ })
  creadas.push(id)
  return id
}
function deGoogle(titulo: string, hora: string): void {
  sqlLocal(`
    insert into public.appointments (clinica_id, title, start_time, end_time, all_day, status, google_event_id,
                                     gcal_sync_status, origen, medico_id, consultorio_timezone, google_asignacion)
    select c.id, :'titulo', :'ini'::timestamptz, :'ini'::timestamptz + interval '30 min', false, 'scheduled',
           'falso-k5b-e2e-' || gen_random_uuid(), 'synced', 'google', u.id, :'tz', 'por_asignar'
      from public.clinicas c, auth.users u where c.nombre = 'Clínica Semilla A' and u.email = :'correo'`,
  { titulo, ini: fechaHoraLocalAInstante(MARTES, hora, TZ), tz: TZ, correo: CORREO.adminA })
}
async function aLaSemana(page: Page): Promise<void> {
  await abrirAgendaV2(page)
  for (let i = 0; i < 6; i++) await page.locator('.fc-next-button, [aria-label="Periodo siguiente"]').first().click()
}
async function abrir(page: Page, texto: string): Promise<Locator> {
  const caja = page.locator('.fc-timegrid-event', { hasText: texto }).first()
  await caja.scrollIntoViewIfNeeded()
  await caja.click({ position: { x: 8, y: 8 } })
  const t = tarjetaLectura(page)
  await expect(t).toBeVisible()
  return t
}

test('procedencia: la «G» a color en la de Google, el eslabón en la ligada por enlace y el expediente tachado con su aviso', async ({ page }) => {
  const google = tituloUnico('K5B Google')
  deGoogle(google, '09:00')
  const reserva = tituloUnico('K5B Ligada')
  const { citaId } = crearCitaPorLigar({ correo: CORREO.adminA, inicio: fechaHoraLocalAInstante(MARTES, '11:00', TZ), minutos: 30, nombre: reserva, canal: 'unico' })
  sqlLocal(`update public.appointments a set paciente_id = p.id, title = p.nombre || ' ' || p.apellidos
              from public.pacientes p where a.id = :'id' and p.apellidos = 'Prueba 05' and p.clinica_id = a.clinica_id`, { id: citaId })
  await aLaSemana(page)

  let t = await abrir(page, google)
  await expect(t.locator('.ag-burbuja-origen').first()).toHaveText('Llegó de Google Calendar')
  await expect(t.locator('.ag-burbuja-origen path[fill="#4285F4"]')).toHaveCount(1)
  const sinExp = t.getByRole('button', { name: 'Sin expediente: este paciente aún no tiene expediente' })
  await sinExp.hover()
  await expect(t.getByRole('tooltip')).toHaveText('Aún no tiene expediente')
  await expect(t.locator('[data-burbuja-enlace]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(t).toHaveCount(0)

  t = await abrir(page, 'Prueba 05')
  await expect(t.locator('[data-burbuja-enlace]')).toHaveText('La apartó con tu enlace')
  await expect(t.locator('[data-burbuja-enlace] .ag-icono-enlace')).toBeVisible()
  await expect(t.getByRole('button', { name: /^Sin expediente/ })).toHaveCount(0)
})

test('los tres puntos: Escape los cierra a ellos y devuelve el foco; «Observaciones» abre el formulario; «No asistió» manda PUT no_show', async ({ page }) => {
  const id = agendada('13:00', 'Prueba 04')
  await aLaSemana(page)
  let t = await abrir(page, 'Prueba 04')
  const puntos = t.getByRole('button', { name: 'Más opciones de la cita', exact: true })
  const mas = t.getByRole('group', { name: 'Más opciones de la cita' })
  await puntos.click()
  await expect(puntos).toHaveAttribute('aria-expanded', 'true')
  await expect(mas.getByRole('button', { name: /^Observaciones/ })).toContainText('Observación K5B')
  await mas.getByRole('button', { name: /^Tipo de cita/ }).focus()
  await page.keyboard.press('Escape')
  await expect(mas).toHaveCount(0)
  await expect(t).toBeVisible()
  await expect(puntos).toBeFocused()

  await puntos.click()
  await mas.getByRole('button', { name: /^Observaciones/ }).click()
  const modal = modalCita(page, 'Editar cita')
  await expect(modal).toBeVisible()
  await modal.getByRole('button', { name: 'Cerrar' }).first().click()
  await expect(modal).toHaveCount(0)

  t = await abrir(page, 'Prueba 04')
  await t.getByRole('button', { name: 'Más opciones de la cita', exact: true }).click()
  const put = page.waitForResponse(r => r.url().includes(`/api/appointments/${id}`) && r.request().method() === 'PUT')
  await t.getByRole('group', { name: 'Más opciones de la cita' }).getByRole('button', { name: 'No asistió', exact: true }).click()
  /* Tanda L, punto 2 (AG-DT-192): desde los tres puntos también pregunta antes. */
  await page.getByRole('dialog', { name: '¿Marcar que Paciente Prueba 04 no asistió? La cita se queda en la agenda como «No asistió».' })
    .getByRole('button', { name: 'Aceptar' }).click()
  expect((await put).request().postDataJSON()).toMatchObject({ status: 'no_show' })
  await expect.poll(() => sqlLocal(`select status from public.appointments where id = :'id'`, { id })).toBe('no_show')
})
