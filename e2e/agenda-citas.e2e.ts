import { test, expect } from '@playwright/test'
import {
  irAAgenda, modalCita, soloEscritorio, SESION, DIA_LABORABLE_FIJO, tituloUnico,
  eventoConTexto, toastConTexto, enContextoNuevo, observarEcosRealtime,
} from './ayudas'

/**
 * Sin `resembrar()` a propósito: resembrar borra y recrea los usuarios, y
 * eso invalida el `storageState` que `global-setup.ts` ya guardó (ver la nota
 * larga en `ayudas.ts`, función `iniciarSesionUI`). La independencia entre
 * pruebas de este archivo viene de que cada una CREA su propio dato y sólo
 * toca ESE — nunca una fila de la semilla que otro archivo pueda necesitar.
 *
 * Sólo escritorio: `[data-onboard="nueva-cita"]` es el botón del toolbar de
 * escritorio; en `telefono` el alta pasa por la barra inferior, cubierta en
 * `agenda-movil.e2e.ts`.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

/** La fila de una respuesta ok de `POST`/`PUT`/`DELETE` sobre `/api/appointments`. */
function esPeticionAppointments(url: string, metodo: string) {
  return (resp: { url(): string; request(): { method(): string } }) =>
    resp.url().includes(url) && resp.request().method() === metodo
}

test('alta de cita con paciente: no duplica el eco propio y persiste en contexto nuevo', async ({ page, browser }) => {
  // GRAVE §5: hay que poder distinguir ESTA tarjeta de cualquier otra cita de
  // «Paciente Prueba 05» que la semilla ya haya puesto esta semana (el hueco
  // principal de la semilla cae siempre a las 10:00; 10:05 no coincide con
  // ningún hueco de `HUECOS_ADMIN`/`HUECOS_INV` de `agenda-semilla.ts`).
  const HORA = '10:05'
  const esperarEco = observarEcosRealtime(page)
  await irAAgenda(page)

  const propiasAntes = await page.locator('.fc-event', { hasText: 'Paciente Prueba 05' }).filter({ hasText: HORA }).count()
  expect(propiasAntes).toBe(0)

  await page.locator('[data-onboard="nueva-cita"]').click()
  const modal = modalCita(page, 'Nueva cita')
  await expect(modal).toBeVisible()

  await page.getByPlaceholder('Buscar paciente por nombre o apellido...').fill('Prueba 05')
  const resultado = page.getByRole('button', { name: /Paciente Prueba 05/ })
  await expect(resultado).toBeVisible({ timeout: 5000 })
  await resultado.click()

  // GRAVE §1: la fecha se escribe también — el modal precarga HOY, que un
  // sábado o domingo cae fuera de horario (ver `diaDeLaSemana` en ayudas.ts).
  await page.locator('input[type="date"]').first().fill(DIA_LABORABLE_FIJO)
  await page.locator('input[type="time"]').first().fill(HORA)

  // GRAVE §4: el toast es optimista (sale en `handleSave` antes del `fetch`,
  // `page.tsx` ~7460 vs ~7505) — lo que hay que esperar es la RESPUESTA real.
  const respuesta = page.waitForResponse(esPeticionAppointments('/api/appointments', 'POST'))
  await page.getByRole('button', { name: 'Guardar' }).click()
  const res = await respuesta
  expect(res.ok()).toBeTruthy()
  const clientId = (res.request().postDataJSON() as { client_id?: string }).client_id
  if (!clientId) throw new Error('la petición de alta no llevó client_id')

  await expect(toastConTexto(page, 'Se agendó correctamente')).toBeVisible({ timeout: 10000 })
  await expect(modal).toBeHidden()

  const propiaNueva = page.locator('.fc-event', { hasText: 'Paciente Prueba 05' }).filter({ hasText: HORA })
  await expect(propiaNueva).toHaveCount(1)

  // El eco de Realtime de la propia escritura: `aplicarCambioRealtime` lo
  // reconoce por `client_id` y no debe duplicar la tarjeta ya pintada por la
  // actualización optimista.
  await esperarEco(clientId)
  await expect(propiaNueva).toHaveCount(1)

  // GRAVE §3: la persistencia se comprueba en un CONTEXTO NUEVO, no con
  // `page.reload()` (mismo proceso de cliente).
  await enContextoNuevo(browser, SESION.adminA, async (pagina) => {
    await irAAgenda(pagina)
    await expect(pagina.locator('.fc-event', { hasText: 'Paciente Prueba 05' }).filter({ hasText: HORA })).toHaveCount(1)
  })
})

test('alta de evento genérico sin paciente: título, color e icono elegidos persisten en contexto nuevo', async ({ page, browser }) => {
  await irAAgenda(page)
  await page.locator('[data-onboard="nueva-cita"]').click()
  // Sin filtrar por nombre: el título del diálogo cambia de «Nueva cita» a
  // «Nuevo evento» en el mismo clic (§12.18, el conmutador remonta el modal),
  // y una referencia con el nombre viejo deja de encontrar nada después.
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toBeVisible()

  await page.getByRole('tab', { name: 'Evento' }).click()
  await expect(dialogo).toHaveAccessibleName('Nuevo evento')

  const titulo = tituloUnico('Evento de prueba E2E')
  await page.getByPlaceholder('Cirugía Sr. Pérez, Junta de personal, Bloqueo…').fill(titulo)
  // Icono y color CONCRETOS (no "el primero de la lista" sin mirar cuál es):
  // así se puede comprobar después que la tarjeta lleva ESE icono y ESE color,
  // y no sólo "alguno". Selector por `aria-label`, no por la estructura del
  // DOM alrededor del `<label>` (MEDIA «Selectores frágiles»).
  await page.getByRole('button', { name: 'Cirugía', exact: true }).click()
  await page.getByRole('button', { name: 'Índigo', exact: true }).click()
  await page.locator('input[type="date"]').first().fill(DIA_LABORABLE_FIJO)
  await page.locator('input[type="time"]').first().fill('10:10')

  const respuesta = page.waitForResponse(esPeticionAppointments('/api/appointments', 'POST'))
  await page.getByRole('button', { name: 'Guardar' }).click()
  const res = await respuesta
  expect(res.ok()).toBeTruthy()
  await expect(toastConTexto(page, 'Se agendó correctamente')).toBeVisible({ timeout: 10000 })

  const tarjeta = eventoConTexto(page, titulo)
  await expect(tarjeta).toHaveClass(/ag-ev-evento/)
  await expect(tarjeta).toHaveClass(/ag-ev-color--indigo/)
  await expect(tarjeta.locator('.ag-tarjeta-icono span')).toHaveAttribute('style', /cirugia\.svg/)

  await enContextoNuevo(browser, SESION.adminA, async (pagina) => {
    await irAAgenda(pagina)
    const tarjetaNueva = eventoConTexto(pagina, titulo)
    await expect(tarjetaNueva).toHaveClass(/ag-ev-color--indigo/)
    await expect(tarjetaNueva.locator('.ag-tarjeta-icono span')).toHaveAttribute('style', /cirugia\.svg/)
  })
})

test('edición: cambiar estado a Confirmada y que se mantenga en contexto nuevo', async ({ page, browser }) => {
  await irAAgenda(page)
  // Crea su propia CITA en vez de tocar una fila de la semilla: así ninguna
  // otra prueba puede verse afectada por este cambio de estado. Tiene que ser
  // cita y no evento genérico: un evento sólo admite «Agendada»/«Cancelada»
  // (ESTADOS_EVENTO), «Confirmada» no es una opción para él.
  await page.locator('[data-onboard="nueva-cita"]').click()
  await page.getByPlaceholder('Buscar paciente por nombre o apellido...').fill('Prueba 12')
  await page.getByRole('button', { name: /Paciente Prueba 12/ }).click()
  await page.locator('input[type="date"]').first().fill(DIA_LABORABLE_FIJO)
  // 15:20 y no 10:00: a esa hora la semilla ya tiene citas casi cualquier día
  // de la semana, y la tarjeta nueva queda tan angosta que el "harness" de la
  // vecina le tapa el punto donde Playwright hace clic.
  await page.locator('input[type="time"]').first().fill('15:20')

  const respAlta = page.waitForResponse(esPeticionAppointments('/api/appointments', 'POST'))
  await page.getByRole('button', { name: 'Guardar' }).click()
  const resAlta = await respAlta
  expect(resAlta.ok()).toBeTruthy()
  await expect(toastConTexto(page, 'Se agendó correctamente')).toBeVisible({ timeout: 10000 })

  const tarjetaCreada = page.locator('.fc-event', { hasText: 'Paciente Prueba 12' }).filter({ hasText: '15:20' })
  await tarjetaCreada.click()
  const modal = modalCita(page, 'Editar cita')
  await expect(modal).toBeVisible()
  await page.getByRole('button', { name: 'Confirmada' }).click()

  const respEdicion = page.waitForResponse(esPeticionAppointments('/api/appointments/', 'PUT'))
  await page.getByRole('button', { name: 'Guardar' }).click()
  const resEdicion = await respEdicion
  expect(resEdicion.ok()).toBeTruthy()
  await expect(toastConTexto(page, 'Cambios guardados')).toBeVisible({ timeout: 10000 })

  const tarjeta = page.locator('.fc-event', { hasText: 'Paciente Prueba 12' }).filter({ hasText: '15:20' })
  await expect(tarjeta).toHaveClass(/ag-ev-status--confirmed/)

  await enContextoNuevo(browser, SESION.adminA, async (pagina) => {
    await irAAgenda(pagina)
    await expect(
      pagina.locator('.fc-event', { hasText: 'Paciente Prueba 12' }).filter({ hasText: '15:20' }),
    ).toHaveClass(/ag-ev-status--confirmed/)
  })
})

test('borrado de un evento: desaparece y no vuelve en contexto nuevo', async ({ page, browser }) => {
  await irAAgenda(page)
  await page.locator('[data-onboard="nueva-cita"]').click()
  await page.getByRole('tab', { name: 'Evento' }).click()
  const titulo = tituloUnico('Evento para borrar E2E')
  await page.getByPlaceholder('Cirugía Sr. Pérez, Junta de personal, Bloqueo…').fill(titulo)
  await page.locator('input[type="date"]').first().fill(DIA_LABORABLE_FIJO)
  await page.locator('input[type="time"]').first().fill('15:50')

  const respAlta = page.waitForResponse(esPeticionAppointments('/api/appointments', 'POST'))
  await page.getByRole('button', { name: 'Guardar' }).click()
  const resAlta = await respAlta
  expect(resAlta.ok()).toBeTruthy()
  await expect(toastConTexto(page, 'Se agendó correctamente')).toBeVisible({ timeout: 10000 })

  await eventoConTexto(page, titulo).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  const respBorrado = page.waitForResponse(esPeticionAppointments('/api/appointments/', 'DELETE'))
  await page.getByRole('button', { name: 'Eliminar evento' }).click()
  const resBorrado = await respBorrado
  expect(resBorrado.ok()).toBeTruthy()
  await expect(toastConTexto(page, 'Se eliminó de la agenda')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.fc-event', { hasText: titulo })).toHaveCount(0)

  await enContextoNuevo(browser, SESION.adminA, async (pagina) => {
    await irAAgenda(pagina)
    await expect(pagina.locator('.fc-event', { hasText: titulo })).toHaveCount(0)
  })
})
