import { test, expect, type Locator, type Page } from '@playwright/test'
import { CORREO, SESION, diaDeLaSemana, interruptorAgenda, sqlLocal, tituloUnico } from './ayudas'
import { abrirAgendaV2, tarjetaLectura } from './interaccionesAyudas'
import { crearCitaPorLigar, aparcarEnlacesVigentes, devolverEnlaces, limpiarReservasE2e, marcaE2e } from './reservaAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * Tanda K, sección E, punto 21 de Angel: la burbuja de `docs/spec/Burbuja.dc.html`, en lo que
 * sólo se ve con navegador (lo que va en cada sitio y sus textos están en `burbujaCita.test.tsx`;
 * el orden de la barra, la rejilla pareja, Confirmar y la cancelada, en `agenda-g3-tarjeta`).
 *   · procedencia: la «G» a color en la de Google; el eslabón, permanente, en la ligada por
 *     enlace; el expediente tachado con su aviso en la que no tiene expediente;
 *   · los tres puntos: desde la tanda M (punto 4) abren el formulario completo, sin menú; lo prueba
 *     `agenda-m1-burbuja` (también «No asistió» de la agendada, ahora en el formulario).
 * Semana +6 (nadie más la usa).
 *
 * MUTACIONES (comprobadas en rojo, una por prueba):
 *   · `Procedencia` con `enlace = Boolean(cita.reserva_canal) && !cita.paciente_id` → «procedencia»;
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
    /* Tanda M: la auditoría ya no se borra (reglas de la tanda M); sus filas se quedan. */
    sqlLocal(`begin; set local session_replication_role = replica;
      delete from public.appointments where google_event_id like 'falso-k5b-e2e-%'
         or id = any (string_to_array(:'ids', ',')::uuid[]); commit;`, { ids: creadas.join(',') || '00000000-0000-0000-0000-000000000000' })
  } finally { devolverEnlaces(aparcados); interruptorAgenda('A', false) }
})

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
  await expect(t.locator('.ag-burbuja-origen').first()).toHaveText('Agendada desde Google Calendar')
  await expect(t.locator('.ag-burbuja-origen rect[fill="#4285F4"]')).toHaveCount(1)
  const sinExp = t.getByRole('button', { name: 'Sin expediente: este paciente aún no tiene expediente' })
  await sinExp.hover()
  await expect(t.getByRole('tooltip')).toHaveText('Aún no tiene expediente')
  await expect(t.locator('[data-burbuja-enlace]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(t).toHaveCount(0)

  t = await abrir(page, 'Prueba 05')
  await expect(t.locator('[data-burbuja-enlace]')).toHaveText('Reservó por enlace')
  await expect(t.locator('[data-burbuja-enlace] .ag-icono-enlace')).toBeVisible()
  await expect(t.getByRole('button', { name: /^Sin expediente/ })).toHaveCount(0)
})
