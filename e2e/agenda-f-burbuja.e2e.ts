import { test, expect, type Page } from '@playwright/test'
import { SESION, diaDeLaSemana, interruptorAgenda, modalCita, soloEscritorio, sqlLocal } from './ayudas'
import {
  abrirAgendaApagada, abrirAgendaV2, arrastrarFranjas, bloquearSuscripcionA, burbuja, clicEnFranja, contarPeticiones,
  elegirPaciente,
} from './interaccionesAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * F3.1 · La burbuja de creación rápida y el arrastre con la duración arrastrada
 * (bloque F, detrás del interruptor `agendaV2`).
 *
 * APAGADO (el estado del `globalSetup`): un clic en un hueco abre el modal
 * «Nueva cita» como hoy, y la raíz nunca dice que haya interacciones.
 * ENCENDIDO: el clic abre la burbuja (foco en el paciente, Escape cierra),
 * Guardar manda el mismo POST que el modal, «Más opciones» abre el modal,
 * arrastrar 14:00–15:30 propone 14:00–15:30, un hueco del panel propone la
 * duración por omisión, el empalme (B7) pregunta antes de guardar, el bloqueo
 * de suscripción va antes que la burbuja y el aviso de fuera de horario
 * también.
 *
 * MUTACIONES que deben poner esto en rojo (ver `altaCitasV2.test.ts`, que las
 * fija también sin navegador):
 *   · quitar `agendaV2 &&` en `abrirAlta` → «apagado» ve la burbuja;
 *   · quitar la regla de más de una franja (`duracionDeSeleccion`) → el
 *     arrastre propone 60 min;
 *   · quitar `seleccionDesdeHueco` en `abrirHueco` → el hueco propone su largo;
 *   · quitar el `confirmar` del empalme en `guardarAltaRapida` → el POST sale
 *     sin preguntar.
 *
 * Todo en la SEMANA +2 (sin semilla de prueba de otros archivos encima) y en
 * huecos que la semilla deja libres al médico administrador (14:00–16:00 de
 * martes a viernes; el lunes la junta de servicio ocupa 14:00–15:00).
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

test.afterEach(() => { interruptorAgenda('A', false) })

const TZ = 'America/Merida'
const LUNES = diaDeLaSemana(2, 0)
const MARTES = diaDeLaSemana(2, 1)
const MIERCOLES = diaDeLaSemana(2, 2)
const JUEVES = diaDeLaSemana(2, 3)
const SABADO = diaDeLaSemana(2, 5)

/** Dos semanas adelante, con la vista Semana de escritorio. */
async function aLaSemanaMasDos(page: Page): Promise<void> {
  await page.locator('.fc-next-button').click()
  await page.locator('.fc-next-button').click()
  await expect(page.locator(`.fc-timegrid-col[data-date="${MARTES}"]`)).toBeVisible()
}

function idsAdminA(apellidos: string): { medico: string; consultorio: string; paciente: string } {
  const [medico, consultorio, paciente] = sqlLocal(`
    select p.id, co.id, pa.id
      from auth.users u
      join public.profiles p on p.id = u.id
      join public.consultorios co on co.medico_id = p.id and co.nombre = 'Hospital Norte (ficticio)'
      join public.pacientes pa on pa.clinica_id = p.clinica_id and pa.apellidos = :'ap'
     where u.email = 'admin.a@semilla.spinus.test'`, { ap: apellidos }).split('|')
  if (!paciente) throw new Error('idsAdminA: no se encontraron los datos de la semilla')
  return { medico, consultorio, paciente }
}

test('apagado: un clic en un hueco abre el modal «Nueva cita» como hoy; no hay burbuja', async ({ page }) => {
  await abrirAgendaApagada(page)
  await aLaSemanaMasDos(page)
  await clicEnFranja(page, MARTES, '15:00')
  await expect(page.getByRole('dialog', { name: 'Nueva cita', exact: true })).toBeVisible()
  await expect(burbuja(page)).toHaveCount(0)
  await expect(page.locator('.agenda-raiz')).not.toHaveAttribute('data-interacciones-v2', /.*/)
})

test('encendido: el clic abre la burbuja con el foco en el paciente; Escape la cierra y suelta el tramo', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await aLaSemanaMasDos(page)
  await clicEnFranja(page, MIERCOLES, '15:30')
  const b = burbuja(page)
  await expect(b).toBeVisible()
  await expect(b).toHaveAttribute('aria-modal', 'true')
  await expect(b).toHaveAccessibleName(/^Nueva cita · .* 15:30–16:30$/)
  await expect(b.getByRole('combobox')).toBeFocused()
  await expect(modalCita(page, 'Editar cita')).toHaveCount(0)
  await expect(page.locator('.fc-event-mirror, .fc-highlight')).not.toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(b).toHaveCount(0)
  await expect(page.locator('.fc-event-mirror, .fc-highlight')).toHaveCount(0)
})

test('encendido: Guardar manda el POST del modal (paciente, puntas, estado, médico, consultorio) y pinta la cita', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await aLaSemanaMasDos(page)
  await clicEnFranja(page, MARTES, '14:30')
  const b = burbuja(page)
  await elegirPaciente(b, 'Prueba 11')
  const post = page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/api/appointments'))
  await b.getByRole('button', { name: 'Guardar', exact: true }).click()
  const cuerpo = (await post).postDataJSON() as Record<string, unknown>
  expect(cuerpo).toMatchObject({
    title: 'Paciente Prueba 11', all_day: false, status: 'scheduled',
    start_time: fechaHoraLocalAInstante(MARTES, '14:30', TZ), end_time: fechaHoraLocalAInstante(MARTES, '15:30', TZ),
  })
  expect(typeof cuerpo.paciente_id).toBe('string')
  expect(typeof cuerpo.medico_id).toBe('string')
  expect(typeof cuerpo.consultorio_id).toBe('string')
  expect(cuerpo).not.toHaveProperty('tipo_cita_id')
  /* T1 (punto 13): la burbuja ya no se cierra al guardar; enseña «Cita
     agendada» y se cierra con «Listo». */
  await expect(b.getByText('Cita agendada', { exact: true })).toBeVisible()
  await b.getByRole('button', { name: 'Listo', exact: true }).click()
  await expect(b).toHaveCount(0)
  await expect(page.locator(`.fc-timegrid-col[data-date="${MARTES}"] .fc-timegrid-event`, { hasText: 'Prueba 11' })).toHaveCount(1)
})

test('encendido: «Más opciones» abre el modal con el paciente ya puesto y la burbuja se va', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await aLaSemanaMasDos(page)
  await clicEnFranja(page, MIERCOLES, '14:30')
  const b = burbuja(page)
  await elegirPaciente(b, 'Prueba 12')
  await b.getByRole('button', { name: 'Más opciones' }).click()
  const modal = page.getByRole('dialog', { name: 'Nueva cita', exact: true })
  await expect(modal).toBeVisible()
  await expect(b).toHaveCount(0)
  await expect(modal.getByText('Paciente Prueba 12')).toBeVisible()
  await expect(modal.locator('input[type="time"]').first()).toHaveValue('14:30')
})

test('encendido: arrastrar 14:00–15:30 propone 14:00–15:30 (la duración arrastrada)', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await aLaSemanaMasDos(page)
  await arrastrarFranjas(page, JUEVES, '14:00', '15:00')
  const b = burbuja(page)
  await expect(b).toHaveAccessibleName(/14:00–15:30$/)
  await expect(b.getByLabel('Fin')).toHaveValue('15:30')
})

test('encendido: un hueco del panel de Día propone la duración por omisión, no el largo del hueco', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await aLaSemanaMasDos(page)
  await page.locator(`.fc-col-header-cell[data-date="${JUEVES}"] a`).first().click()
  const hueco = page.locator('.ag-hueco').first()
  await expect(hueco).toBeVisible()
  await hueco.click()
  const b = burbuja(page)
  await expect(b).toBeVisible()
  const inicio = await b.getByLabel('Inicio').inputValue()
  const fin = await b.getByLabel('Fin').inputValue()
  const minutos = (h: string): number => Number(h.slice(0, 2)) * 60 + Number(h.slice(3))
  expect(minutos(fin) - minutos(inicio)).toBe(60)
})

test('encendido: B7 el empalme se pregunta ANTES del POST; Cancelar deja la burbuja y Aceptar manda empalmes_aceptados', async ({ page }) => {
  interruptorAgenda('A', true)
  const ids = idsAdminA('Prueba 13')
  const res = await page.request.post('/api/appointments', { data: {
    title: 'Paciente Prueba 13', start_time: fechaHoraLocalAInstante(LUNES, '15:30', TZ), end_time: fechaHoraLocalAInstante(LUNES, '16:00', TZ),
    medico_id: ids.medico, consultorio_id: ids.consultorio, paciente_id: ids.paciente, notes: null, status: 'scheduled',
  } })
  expect(res.ok(), await res.text()).toBeTruthy()
  const { appointment } = await res.json() as { appointment: { id: string } }

  await abrirAgendaV2(page)
  await aLaSemanaMasDos(page)
  const posts = contarPeticiones(page, 'POST')
  await clicEnFranja(page, LUNES, '15:00')
  const b = burbuja(page)
  await elegirPaciente(b, 'Prueba 14')
  await b.getByRole('button', { name: 'Guardar', exact: true }).click()
  const aviso = page.getByRole('dialog', { name: /«Paciente Prueba 13»/ })
  await expect(aviso).toBeVisible()
  await aviso.getByRole('button', { name: 'Cancelar' }).click()
  await expect(b).toBeVisible()
  expect(posts.cuantas()).toBe(0)

  await b.getByRole('button', { name: 'Guardar', exact: true }).click()
  const post = page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/api/appointments'))
  await page.getByRole('dialog', { name: /«Paciente Prueba 13»/ }).getByRole('button', { name: 'Aceptar' }).click()
  expect(((await post).postDataJSON() as { empalmes_aceptados?: string[] }).empalmes_aceptados).toContain(appointment.id)
})

test('encendido: con la suscripción bloqueada sale el aviso de bloqueo y no la burbuja', async ({ page }) => {
  interruptorAgenda('A', true)
  const restaurar = bloquearSuscripcionA()
  try {
    await abrirAgendaV2(page)
    await aLaSemanaMasDos(page)
    await clicEnFranja(page, MARTES, '15:30')
    await expect(page.getByRole('dialog', { name: 'Función no disponible' })).toBeVisible()
    await expect(burbuja(page)).toHaveCount(0)
  } finally {
    restaurar()
  }
})

test('encendido: fuera de horario, primero el aviso; aceptarlo abre la burbuja', async ({ page }) => {
  interruptorAgenda('A', true)
  await abrirAgendaV2(page)
  await aLaSemanaMasDos(page)
  await clicEnFranja(page, SABADO, '13:30')
  const aviso = page.getByRole('dialog', { name: /13:30/ })
  await expect(aviso).toBeVisible()
  await expect(burbuja(page)).toHaveCount(0)
  await aviso.getByRole('button', { name: 'Aceptar' }).click()
  await expect(burbuja(page)).toBeVisible()
})
