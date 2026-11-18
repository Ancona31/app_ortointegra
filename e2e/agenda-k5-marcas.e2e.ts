import { test, expect, type Page } from '@playwright/test'
import { CORREO, SESION, diaDeLaSemana, interruptorAgenda, sqlLocal, tituloUnico } from './ayudas'
import { abrirAgendaApagada, abrirAgendaV2 } from './interaccionesAyudas'
import { crearCitaPorLigar, aparcarEnlacesVigentes, devolverEnlaces, limpiarReservasE2e, marcaE2e } from './reservaAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * Tanda K, sección E, puntos 17–20 de Angel: las marcas de procedencia de la agenda v2.
 *   · 17: el expediente tachado sustituye a «Por ligar» y «Por asignar» (un solo icono);
 *   · 18: el eslabón, permanente en lo reservado por enlace (también ya ligado);
 *   · 19: la «G» a color, como estaba;
 *   · 20: la leyenda de la v2 suma las tres marcas.
 * Con la v2 apagada, la píldora de siempre y ningún icono nuevo.
 *
 * MUTACIONES (comprobadas en rojo, una por prueba):
 *   · `MemoizedEventContent`: `{sinAvisoFlotante ? <MarcasCita…/> : …}` → siempre la píldora → «Semana»;
 *   · `MonthChip`: lo mismo con `.ag-mes-badge` → «Mes»;
 *   · `marcasDeCita` con `enlace: Boolean(apt.reserva_canal) && !apt.paciente_id` → «ligada»;
 *   · `LeyendaEstados` sin el bloque del eslabón (`data-leyenda-enlace` renombrado) → «leyenda»;
 *   · `ProximasCitas` sin el `<span data-marca-enlace>` → «Próximas citas».
 */
test.use({ storageState: SESION.adminA })

const TZ = 'America/Merida'
const JUEVES = diaDeLaSemana(4, 3)
/* En el Mes el jueves se llena con la semilla («+N más»): las del Mes van al domingo, vacío. */
const DOMINGO = diaDeLaSemana(4, 6)
let desde = ''
let aparcados: string[] = []
test.beforeAll(() => { aparcados = aparcarEnlacesVigentes(); desde = marcaE2e() })
test.afterAll(() => {
  try { limpiarReservasE2e(desde); borrarGoogle() } finally { devolverEnlaces(aparcados); interruptorAgenda('A', false) }
})

function porAsignar(titulo: string, inicio: string): void {
  sqlLocal(`
    insert into public.appointments (clinica_id, title, start_time, end_time, all_day, status, google_event_id,
                                     gcal_sync_status, origen, medico_id, consultorio_timezone, google_asignacion)
    select c.id, :'titulo', :'inicio'::timestamptz, :'inicio'::timestamptz + interval '30 min', false, 'scheduled',
           'falso-k5m-e2e-' || gen_random_uuid(), 'synced', 'google', u.id, :'tz', 'por_asignar'
      from public.clinicas c, auth.users u where c.nombre = 'Clínica Semilla A' and u.email = :'correo'`,
  { titulo, inicio, tz: TZ, correo: CORREO.adminA })
}
function borrarGoogle(): void {
  sqlLocal(`begin; set local session_replication_role = replica;
    delete from public.avisos_clinica where cita_id in (select id from public.appointments where google_event_id like 'falso-k5m-e2e-%');
    delete from public.audit_log where registro_id in (select id from public.appointments where google_event_id like 'falso-k5m-e2e-%');
    delete from public.appointments where google_event_id like 'falso-k5m-e2e-%'; commit;`)
}
function ligar(citaId: string, apellidos: string): void {
  sqlLocal(`update public.appointments a set paciente_id = p.id, title = p.nombre || ' ' || p.apellidos
              from public.pacientes p where a.id = :'id' and p.apellidos = :'ap' and p.clinica_id = a.clinica_id`, { id: citaId, ap: apellidos })
}
async function aLaSemana(page: Page, semanas: number): Promise<void> {
  const siguiente = page.locator('.fc-next-button, [aria-label="Periodo siguiente"]').first()
  for (let i = 0; i < semanas; i++) await siguiente.click()
}
const caja = (page: Page, texto: string) => page.locator('.fc-event', { hasText: texto }).first()

test.describe('rejilla', () => {
  test.beforeEach(({}, info) => { test.skip(info.project.name !== 'escritorio', 'rejilla de Semana y Mes: escritorio') })

  test('Semana: expediente tachado y eslabón en la por ligar, expediente tachado en la por asignar; apagada, la píldora', async ({ page }) => {
    const reserva = tituloUnico('K5M Reserva')
    const google = tituloUnico('K5M Google')
    crearCitaPorLigar({ correo: CORREO.adminA, inicio: fechaHoraLocalAInstante(JUEVES, '09:00', TZ), minutos: 30, nombre: reserva, canal: 'unico', historial: 2 })
    porAsignar(google, fechaHoraLocalAInstante(JUEVES, '11:00', TZ))
    interruptorAgenda('A', true)
    await abrirAgendaV2(page)
    await aLaSemana(page, 4)
    await expect(caja(page, reserva).locator('.ag-icono-sin-exp')).toBeVisible()
    await expect(caja(page, reserva).locator('.ag-icono-enlace')).toBeVisible()
    await expect(caja(page, reserva).locator('[role="group"]'))
      .toHaveAttribute('aria-label', /· Sin expediente\. Al reservar traía 2 cancelaciones o inasistencias\. · Agendada por enlace$/)
    await expect(caja(page, google).locator('.ag-icono-sin-exp')).toBeVisible()
    await expect(caja(page, google).locator('.ag-icono-enlace')).toHaveCount(0)
    /* 19 · la «G» de la fila nacida en Google, a color (sus cuatro tintas). */
    await expect(caja(page, google).locator('.ag-g-origen path[fill="#4285F4"]')).toHaveCount(1)
    await expect(page.locator('.fc-event .ag-tarjeta-marca')).toHaveCount(0)

    interruptorAgenda('A', false)
    await abrirAgendaApagada(page)
    await aLaSemana(page, 4)
    await expect(caja(page, reserva).locator('.ag-tarjeta-marca')).toHaveText('Por ligar · 2')
    await expect(caja(page, google).locator('.ag-tarjeta-marca')).toHaveText('Por asignar')
    await expect(page.locator('.fc-event .ag-icono-sin-exp, .fc-event .ag-icono-enlace')).toHaveCount(0)
  })

  test('ligada: el eslabón se queda (Semana y Mes) y el expediente tachado se va', async ({ page }) => {
    const reserva = tituloUnico('K5M Ligada')
    const { citaId } = crearCitaPorLigar({ correo: CORREO.adminA, inicio: fechaHoraLocalAInstante(DOMINGO, '13:00', TZ), minutos: 30, nombre: reserva, canal: 'unico' })
    ligar(citaId, 'Prueba 07')
    interruptorAgenda('A', true)
    await abrirAgendaV2(page)
    await aLaSemana(page, 4)
    const ligada = page.locator(`.fc-event:has([data-cita-id="${citaId}"])`)
    await expect(ligada).toContainText('Prueba 07')
    await expect(ligada.locator('.ag-icono-enlace')).toBeVisible()
    await expect(ligada.locator('.ag-icono-sin-exp')).toHaveCount(0)
    await page.getByRole('tab', { name: 'Mes' }).click()
    const enMes = page.locator(`.fc-daygrid-event:has([data-cita-id="${citaId}"])`)
    await expect(enMes.locator('.ag-icono-enlace')).toBeVisible()
    await expect(enMes.locator('.ag-mes-badge')).toHaveCount(0)
  })

  test('Mes: el expediente tachado sustituye a la píldora', async ({ page }) => {
    const reserva = tituloUnico('K5M Mes')
    const { citaId } = crearCitaPorLigar({ correo: CORREO.adminA, inicio: fechaHoraLocalAInstante(DOMINGO, '15:00', TZ), minutos: 30, nombre: reserva, canal: 'unico' })
    interruptorAgenda('A', true)
    await abrirAgendaV2(page)
    await aLaSemana(page, 4)
    await page.getByRole('tab', { name: 'Mes' }).click()
    const enMes = page.locator(`.fc-daygrid-event:has([data-cita-id="${citaId}"])`)
    await expect(enMes.locator('.ag-icono-sin-exp')).toBeVisible()
    await expect(enMes.locator('.ag-mes-badge')).toHaveCount(0)
  })

  test('leyenda de la v2: la «G» a color, el eslabón y el expediente tachado, con sus textos', async ({ page }) => {
    interruptorAgenda('A', true)
    await abrirAgendaV2(page)
    await page.getByRole('button', { name: 'Opciones de la agenda' }).click()
    await page.getByRole('menuitem', { name: 'Leyenda de estados' }).click()
    const l = page.getByRole('dialog', { name: 'Leyenda de estados' })
    await expect(l.locator('[data-leyenda-google]')).toHaveText('Se agendó en Google')
    await expect(l.locator('[data-leyenda-google] path[fill="#4285F4"]')).toHaveCount(1)
    await expect(l.locator('[data-leyenda-enlace]')).toHaveText('Se agendó por enlace')
    await expect(l.locator('[data-leyenda-enlace] .ag-icono-enlace')).toBeVisible()
    await expect(l.locator('[data-leyenda-sin-expediente]')).toHaveText('Sin expediente')
    await expect(l.locator('[data-leyenda-sin-expediente] .ag-icono-sin-exp')).toBeVisible()
  })
})

test('Próximas citas: la ligada por enlace conserva el eslabón con su texto y no lleva el expediente tachado', async ({ page }) => {
  const pronto = (m: number): string => new Date(Math.ceil((Date.now() + m * 60_000) / 60_000) * 60_000).toISOString()
  const { citaId } = crearCitaPorLigar({ correo: CORREO.adminA, inicio: pronto(6), minutos: 20, nombre: tituloUnico('K5M Hoy'), canal: 'unico' })
  ligar(citaId, 'Prueba 06')
  interruptorAgenda('A', true)
  await page.goto('/dashboard')
  const s = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Próximas citas' }) })
  const fila = s.getByText('Prueba 06', { exact: false }).first().locator('xpath=ancestor::div[contains(@class, "border-t")][1]')
  await expect(fila).toBeVisible({ timeout: 30_000 })
  await expect(fila.getByText('Por enlace', { exact: true })).toBeVisible()
  await expect(fila.locator('[data-marca-enlace] .ag-icono-enlace')).toBeVisible()
  await expect(fila.getByRole('img', { name: 'Sin expediente' })).toHaveCount(0)
})

/* Revisión de K5: en las listas (aquí la del día del teléfono) las marcas las enseña la hoja de
   estilos sólo con la v2. MUTACIÓN: borrar `.agenda-raiz[data-agenda-v2="encendida"] .ag-marcas-v2`
   → rojo con la v2; borrar `.ag-marcas-v2 { display: none; }` → rojo apagada. */
test('teléfono: la lista del día enseña el eslabón y el expediente tachado sólo con la v2', async ({ page }) => {
  test.skip(test.info().project.name !== 'telefono', 'la lista del día es la vista del teléfono')
  const pronto = (m: number): string => new Date(Math.ceil((Date.now() + m * 60_000) / 60_000) * 60_000).toISOString()
  const nombre = tituloUnico('K5M Lista')
  crearCitaPorLigar({ correo: CORREO.adminA, inicio: pronto(8), minutos: 20, nombre, canal: 'unico' })
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  const fila = page.locator('.fc-list-event', { hasText: nombre }).first()
  await expect(fila.getByRole('img', { name: 'Sin expediente' })).toBeVisible()
  await expect(fila.getByRole('img', { name: 'Agendada por enlace' })).toBeVisible()
  interruptorAgenda('A', false)
  await abrirAgendaApagada(page)
  await expect(page.locator('.fc-list-event', { hasText: nombre }).first().locator('.ag-marcas')).toBeHidden()
})
