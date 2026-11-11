import { test, expect } from '@playwright/test'
import {
  irAAgenda, arrastrarEventoPorMinutos, redimensionarFinEvento, soloEscritorio, SESION,
  selectFiltroMedico, enContextoNuevo, toastConTexto, sqlLocal,
} from './ayudas'

/**
 * Objetivos estables de la semilla (ver `scripts/agenda-semilla.ts:327-334`),
 * uno por prueba para que no se pisen entre sí. Sin `resembrar()` a
 * propósito (ver la nota de `agenda-citas.e2e.ts`): cada objetivo es de la
 * semilla ÚNICA que puso `global-setup.ts`, y ningún otro archivo lo toca.
 * - «Cirugía programada»: miércoles de esta semana, 07:00–10:00 → arrastre.
 * - «Comida»: jueves de esta semana, 13:00–14:00 → arrastre fuera de horario.
 * - «Pendiente administrativo»: viernes de esta semana, 13:30–14:00 →
 *   redimensionado. (NO «Sesión docente»: ésa cae la semana QUE VIENE
 *   —`dia(1,4)`— y la vista por defecto es la semana actual.)
 *
 * Sólo escritorio: arrastrar y redimensionar son gestos de la rejilla de
 * tiempo (`timeGrid`); en `telefono` Semana y Día son listas sin rejilla.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

/** La auditoría de B0 (`log_cita_change`) de una cita de la clínica A de la
 *  semilla, por su título: cuántas `cita_editada` tiene y los `campos` de la
 *  última. Por SQL como `postgres` porque `audit_log` no se lee con la sesión. */
function auditoriaDeCita(titulo: string): { editadas: number; ultimosCampos: string } {
  const id = sqlLocal(`select a.id from public.appointments a join public.clinicas c on c.id = a.clinica_id
                        where c.nombre = 'Clínica Semilla A' and a.title = :'titulo'`, { titulo })
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error(`auditoriaDeCita: esperaba UNA cita «${titulo}», salió «${id}»`)
  const [editadas, ultimosCampos] = sqlLocal(`
    select count(*),
           coalesce((select descripcion::jsonb ->> 'campos' from public.audit_log
                      where tabla = 'appointments' and registro_id = :'id' and accion = 'cita_editada'
                      order by created_at desc limit 1), '')
      from public.audit_log where tabla = 'appointments' and registro_id = :'id' and accion = 'cita_editada'`,
  { id }).split('|')
  return { editadas: Number(editadas), ultimosCampos }
}

test('arrastrar una cita a otra hora del mismo día; el rango exacto persiste en contexto nuevo', async ({ page, browser }) => {
  // B0: el arrastre deja EXACTAMENTE una `cita_editada` (ni cero, ni una más por
  // el after() de Google o por `client_id`, que el WHEN descarta).
  const auditoriaAntes = auditoriaDeCita('Cirugía programada')
  await irAAgenda(page)
  const evento = page.locator('.fc-timegrid-event', { hasText: 'Cirugía programada' })
  await expect(evento.locator('.ag-tarjeta-hora-rango')).toHaveText('07:00 - 10:00')

  // GRAVE §4: esperar la RESPUESTA (no sólo que la petición haya salido) antes
  // de dar por buena la persistencia — el toast es optimista.
  const respuesta = page.waitForResponse(r => r.url().includes('/api/appointments/') && r.request().method() === 'PUT')
  await arrastrarEventoPorMinutos(page, evento, 120)
  const res = await respuesta
  expect(res.ok()).toBeTruthy()
  await expect(toastConTexto(page, 'Se movió en la agenda')).toBeVisible({ timeout: 10000 })

  // MEDIA «Arrastre/redimensionado»: el rango EXACTO resultante, no sólo
  // "cambió". +120 min sobre 07:00–10:00 es 09:00–12:00.
  await expect(evento.locator('.ag-tarjeta-hora-rango')).toHaveText('09:00 - 12:00')

  // GRAVE §3: contexto nuevo, no `page.reload()`.
  await enContextoNuevo(browser, SESION.adminA, async (pagina) => {
    await irAAgenda(pagina)
    await expect(
      pagina.locator('.fc-timegrid-event', { hasText: 'Cirugía programada' }).locator('.ag-tarjeta-hora-rango'),
    ).toHaveText('09:00 - 12:00')
  })

  // Se mira DESPUÉS del contexto nuevo, no al llegar la respuesta del PUT: así
  // también le da tiempo a cualquier escritura del after() a dejar su fila.
  const auditoriaDespues = auditoriaDeCita('Cirugía programada')
  expect(auditoriaDespues.editadas - auditoriaAntes.editadas).toBe(1)
  expect(auditoriaDespues.ultimosCampos).toBe('["end_time", "start_time"]')
})

test('redimensionar el fin de una cita; la nueva duración exacta persiste en contexto nuevo', async ({ page, browser }) => {
  await irAAgenda(page)
  const evento = page.locator('.fc-timegrid-event', { hasText: 'Pendiente administrativo' })
  await evento.scrollIntoViewIfNeeded()
  await expect(evento.locator('.ag-tarjeta-hora-rango')).toHaveText('13:30 - 14:00')

  const respuesta = page.waitForResponse(r => r.url().includes('/api/appointments/') && r.request().method() === 'PUT')
  await redimensionarFinEvento(page, evento, 30)
  const res = await respuesta
  expect(res.ok()).toBeTruthy()
  await expect(toastConTexto(page, 'Se movió en la agenda')).toBeVisible({ timeout: 10000 })

  // +30 min al FIN de 13:30–14:00 es 13:30–14:30.
  await expect(evento.locator('.ag-tarjeta-hora-rango')).toHaveText('13:30 - 14:30')

  await enContextoNuevo(browser, SESION.adminA, async (pagina) => {
    await irAAgenda(pagina)
    await expect(
      pagina.locator('.fc-timegrid-event', { hasText: 'Pendiente administrativo' }).locator('.ag-tarjeta-hora-rango'),
    ).toHaveText('13:30 - 14:30')
  })
})

test('aviso de fuera de horario al arrastrar pasada la hora de cierre, y Cancelar revierte', async ({ page, browser }) => {
  await irAAgenda(page)
  // «Comida» es de la médica invitada, no de admin.a: la agenda abre filtrada
  // al propio médico (ver `mejora_agendaV2.md` §4.3), así que sin esto no
  // aparece aunque exista. Admin ve y edita toda la clínica.
  await selectFiltroMedico(page).selectOption({ label: 'Todos los médicos' })
  await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 15000 })
  const evento = page.locator('.fc-timegrid-event', { hasText: 'Comida' })
  await expect(evento.locator('.ag-tarjeta-hora-rango')).toHaveText('13:00 - 14:00')

  // «Comida» empieza a las 13:00; +300 min la deja en 18:00, justo cuando
  // cierra la clínica A (08:00–18:00 en la semilla).
  await arrastrarEventoPorMinutos(page, evento, 300)

  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toBeVisible()
  await expect(dialogo).toContainText('Vas a moverlo a las')
  await expect(dialogo).toContainText('¿Es correcto?')

  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialogo).toBeHidden()

  await expect(page.locator('.fc-timegrid-event', { hasText: 'Comida' }).locator('.ag-tarjeta-hora-rango')).toHaveText('13:00 - 14:00')

  // Cancelar no llama a ningún endpoint (revierte sólo en el cliente): la
  // comprobación de verdad es que el SERVIDOR nunca vio un cambio. Contexto
  // nuevo, no `page.reload()` (GRAVE §3) — y el filtro de médico es estado de
  // cliente, así que hay que volver a ponerlo en «Todos» para encontrar la
  // cita de la invitada.
  await enContextoNuevo(browser, SESION.adminA, async (pagina) => {
    await irAAgenda(pagina)
    await selectFiltroMedico(pagina).selectOption({ label: 'Todos los médicos' })
    await expect(
      pagina.locator('.fc-timegrid-event', { hasText: 'Comida' }).locator('.ag-tarjeta-hora-rango'),
    ).toHaveText('13:00 - 14:00')
  })
})

test('aviso de fuera de horario al arrastrar pasada la hora de cierre, y Aceptar mueve y persiste', async ({ page, browser }) => {
  // MEDIA «Más»: falta el camino de confirmar (sólo había prueba de Cancelar).
  await irAAgenda(page)
  await selectFiltroMedico(page).selectOption({ label: 'Todos los médicos' })
  await page.locator('.fc-event').first().waitFor({ state: 'visible', timeout: 15000 })
  const evento = page.locator('.fc-timegrid-event', { hasText: 'Comida' })
  await expect(evento.locator('.ag-tarjeta-hora-rango')).toHaveText('13:00 - 14:00')

  await arrastrarEventoPorMinutos(page, evento, 300)
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toBeVisible()
  await expect(dialogo).toContainText('Vas a moverlo a las')

  const respuesta = page.waitForResponse(r => r.url().includes('/api/appointments/') && r.request().method() === 'PUT')
  await page.getByRole('button', { name: 'Aceptar' }).click()
  const res = await respuesta
  expect(res.ok()).toBeTruthy()
  await expect(dialogo).toBeHidden()
  await expect(toastConTexto(page, 'Se movió en la agenda')).toBeVisible({ timeout: 10000 })

  // +300 min sobre 13:00–14:00 es 18:00–19:00.
  await expect(page.locator('.fc-timegrid-event', { hasText: 'Comida' }).locator('.ag-tarjeta-hora-rango')).toHaveText('18:00 - 19:00')

  await enContextoNuevo(browser, SESION.adminA, async (pagina) => {
    await irAAgenda(pagina)
    await selectFiltroMedico(pagina).selectOption({ label: 'Todos los médicos' })
    await expect(
      pagina.locator('.fc-timegrid-event', { hasText: 'Comida' }).locator('.ag-tarjeta-hora-rango'),
    ).toHaveText('18:00 - 19:00')
  })
})
