import { test, expect, type Page } from '@playwright/test'
import {
  CORREO, SESION, DIA_LABORABLE_LIBRE, enContextoNuevo, interruptorAgenda, irAAgenda, modalCita, soloEscritorio, sqlLocal,
} from './ayudas'
import { editarDesdeTarjeta } from './interaccionesAyudas'
import { clicEnTarjeta, crearCitaPorLigar, limpiarReservasE2e, type CitaPorLigar } from './reservaAyudas'
import { fechaHoraLocalAInstante } from '../src/lib/dates'

/**
 * D7 · Ligar al iniciar la consulta. En una cita POR LIGAR, «Iniciar consulta»
 * no abre la nota: primero pide ligarla a un paciente.
 *
 *   · paciente nuevo con `QuickPatientModal`: sin el consentimiento no deja
 *     crear; al crear, la cita queda con `paciente_id`, se llega a
 *     `/expediente/<id>/nueva-nota?cita=<id>`, los datos de contacto de la
 *     reserva siguen en la cita (lista A, punto 9) y queda `cita_ligada` en la
 *     auditoría, sin datos personales;
 *   · paciente existente, con el buscador;
 *   · la secretaria (que no inicia consultas) no ve el botón.
 *
 * ⚠️ NO SE GUARDA LA NOTA: una nota clínica no se puede borrar y dejaría la
 * siguiente siembra sin poder limpiar la clínica (`exigirSinExpediente`). Que
 * la nota guardada pase la cita a `attended` lo hace `POST /api/consultas`
 * comparando `paciente_id`, que es justo lo que esto deja puesto.
 * El paciente creado se queda: lo borra la siembra siguiente.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

const TZ = 'America/Merida'

test.afterEach(() => {
  limpiarReservasE2e()
  interruptorAgenda('A', false)
})

function cita(nombre: string): CitaPorLigar {
  return crearCitaPorLigar({
    correo: CORREO.adminA, inicio: fechaHoraLocalAInstante(DIA_LABORABLE_LIBRE, '17:00', TZ), minutos: 30,
    nombre, canal: 'unico',
  })
}

async function abrirCita(page: Page, nombre: string): Promise<void> {
  await irAAgenda(page)
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-agenda-v2', 'encendida')
  /* F3: con v2 las interacciones van en un chunk diferido; un clic antes de que llegue abriría el modal directo. */
  await expect(page.locator('.agenda-raiz')).toHaveAttribute('data-interacciones-v2', 'listas')
  await clicEnTarjeta(page.locator('.fc-event', { hasText: nombre }))
  await editarDesdeTarjeta(page)
  await expect(modalCita(page, 'Editar cita')).toBeVisible()
}

function filaCita(id: string): string {
  return sqlLocal(`select coalesce(paciente_id::text, '-') || '|' || reserva_canal || '|' || reserva_nombre || '|'
                          || coalesce(reserva_telefono, '-') || '|' || coalesce(reserva_correo, '-')
                     from public.appointments where id = :'id'`, { id })
}

test('paciente nuevo: exige el consentimiento, liga la cita y abre la nota', async ({ page }) => {
  interruptorAgenda('A', true)
  const sufijo = Date.now().toString(36)
  const nombre = `Ligada E2e${sufijo}`
  const c = cita(nombre)
  await abrirCita(page, nombre)

  await page.getByRole('button', { name: 'Iniciar consulta' }).click()
  await expect(page.getByRole('region', { name: 'Ligar a un paciente' })).toBeVisible()
  await page.getByRole('button', { name: 'Registrar paciente nuevo' }).click()
  const alta = page.getByRole('heading', { name: 'Registrar paciente' })
  await expect(alta).toBeVisible()
  await expect(page.locator('input[type="email"]')).toHaveValue('persona.e2e@ejemplo.test')

  await page.getByRole('button', { name: 'Crear y continuar' }).click()
  await expect(page.getByText('Debes marcar el consentimiento del aviso de privacidad.')).toBeVisible()
  expect(filaCita(c.citaId).startsWith('-|')).toBe(true)

  await page.getByRole('checkbox').check()
  const put = page.waitForResponse(r => r.url().includes(`/api/appointments/${c.citaId}`) && r.request().method() === 'PUT')
  await page.getByRole('button', { name: 'Crear y continuar' }).click()
  expect((await put).ok()).toBeTruthy()
  await page.waitForURL(new RegExp(`/expediente/[0-9a-f-]+/nueva-nota\\?cita=${c.citaId}$`))

  const [paciente, canal, reservaNombre, tel, correo] = filaCita(c.citaId).split('|')
  expect(paciente).toMatch(/^[0-9a-f-]{36}$/)
  expect(page.url()).toContain(`/expediente/${paciente}/`)
  expect([canal, reservaNombre, tel, correo]).toEqual(['unico', nombre, '5512345678', 'persona.e2e@ejemplo.test'])
  const auditoria = sqlLocal(`select descripcion from public.audit_log where accion = 'cita_ligada' and registro_id = :'id'`, { id: c.citaId })
  expect(auditoria).toContain('"campos"')
  expect(auditoria).not.toContain(nombre)
  expect(auditoria).not.toContain(paciente)
})

test('paciente existente: se elige en el buscador y se liga', async ({ page }) => {
  interruptorAgenda('A', true)
  const c = cita(`Existente E2e${Date.now().toString(36)}`)
  const paciente07 = sqlLocal(`select pa.id from public.pacientes pa join public.clinicas cl on cl.id = pa.clinica_id
                                where cl.nombre = 'Clínica Semilla A' and pa.apellidos = 'Prueba 07'`)
  await abrirCita(page, 'Existente E2e')
  await page.getByRole('button', { name: 'Iniciar consulta' }).click()
  await page.getByRole('textbox', { name: 'Buscar paciente existente' }).fill('Prueba 07')
  const put = page.waitForResponse(r => r.url().includes(`/api/appointments/${c.citaId}`) && r.request().method() === 'PUT')
  await page.getByRole('region', { name: 'Ligar a un paciente' }).getByRole('button', { name: /Prueba 07/ }).click()
  expect((await put).ok()).toBeTruthy()
  await page.waitForURL(`**/expediente/${paciente07}/nueva-nota?cita=${c.citaId}`)
  expect(filaCita(c.citaId).split('|')[0]).toBe(paciente07)
})

test('ligar a un paciente de otra clínica da 400 y la cita sigue por ligar', async ({ page }) => {
  interruptorAgenda('A', true)
  const c = cita(`Ajena E2e${Date.now().toString(36)}`)
  const ajeno = sqlLocal(`select pa.id from public.pacientes pa join public.clinicas cl on cl.id = pa.clinica_id
                           where cl.nombre = 'Clínica Semilla B' limit 1`)
  const res = await page.request.put(`/api/appointments/${c.citaId}`, { data: { paciente_id: ajeno, title: 'X' } })
  expect(res.status()).toBe(400)
  expect(filaCita(c.citaId).startsWith('-|')).toBe(true)
})

test('la secretaria no ve «Iniciar consulta» en una cita por ligar', async ({ browser }) => {
  interruptorAgenda('A', true)
  const nombre = `Secretaria E2e${Date.now().toString(36)}`
  cita(nombre)
  await enContextoNuevo(browser, SESION.secretariaA, async (page) => {
    await abrirCita(page, nombre)
    await expect(page.getByRole('button', { name: 'Iniciar consulta' })).toHaveCount(0)
    await expect(page.getByText('Reservó por enlace')).toBeVisible()
  })
})
