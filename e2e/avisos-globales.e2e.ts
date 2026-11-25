import { test, expect, type Locator, type Page } from '@playwright/test'
import { SESION, enContextoNuevo, interruptorAgenda, sqlLocal, toastConTexto } from './ayudas'

/**
 * Avisos globales (2026-11-24, decisión de Angel) · la campana de «Avisos» y su
 * burbuja FUERA de la agenda (`CampanaGlobal`, layout de `(app)`).
 *
 * Los avisos se siembran como `postgres` (en la app sólo los escriben los
 * disparadores) sobre citas FUTURAS de la semilla, y se borran al terminar:
 * sólo los propios (por id). No se crea ni se toca ninguna cita.
 *
 * MUTACIONES (comprobadas en rojo): `CampanaGlobal` sin el corte de `/agenda`
 * (dos campanas y burbuja doble); el layout montándola sin mirar el
 * interruptor (caso «apagada»).
 */
test.use({ storageState: SESION.adminA })

const CL = `(select id from public.clinicas where nombre = 'Clínica Semilla A')`
const propios: string[] = []

/** Un aviso sin revisar sobre la n-ésima cita futura con paciente de la clínica A; devuelve `id|nombre`. */
function sembrarAviso(tipo: string, n: number): { id: string; nombre: string } {
  const fila = sqlLocal(`
    with c as (select id, title from public.appointments
                where clinica_id = ${CL} and paciente_id is not null and status = 'scheduled' and start_time > now() + interval '1 day'
                order by start_time, id offset ${n} limit 1)
    insert into public.avisos_clinica (clinica_id, tipo, cita_id) select ${CL}, :'tipo', c.id from c
    returning id || '|' || (select title from c);`, { tipo })
  const [id, nombre] = fila.split('|')
  propios.push(id)
  return { id, nombre }
}

function campana(page: Page): Locator {
  return page.locator('[data-campana-global]:visible')
}

test.beforeEach(() => { interruptorAgenda('A', true) })
test.afterEach(() => {
  /* Sólo los sembrados aquí. `avisos_clinica` no es `audit_log`: su borrado como postgres es el de la semilla. */
  const ids = propios.map((id) => `'${id}'`).join(',')
  if (propios.length) sqlLocal(`delete from public.avisos_vistos where aviso_id in (${ids}); delete from public.avisos_clinica where id in (${ids});`)
  propios.length = 0
})
test.afterAll(() => { interruptorAgenda('A', false) })

test('fuera de la agenda: la campana cuenta los avisos, la lista los nombra y revisar los quita', async ({ page }) => {
  const a = sembrarAviso('cancelacion_paciente', 0)
  await page.goto('/dashboard')
  await expect(campana(page)).toHaveAttribute('aria-label', /^Avisos \(\d+ sin revisar\)$/)
  await campana(page).click()
  const fila = page.locator(`[data-panel-avisos-global] [data-aviso="${a.id}"]`)
  await expect(fila).toContainText(`${a.nombre} canceló su cita`)
  await expect(fila).toHaveAttribute('href', /^\/agenda\?cita=/)
  await page.locator('[data-panel-avisos-global] [data-revisar-todos]').click()
  await expect(page.locator('[data-panel-avisos-global] [data-avisos-vacio]')).toBeVisible()
  // M1: «revisado» es POR USUARIO. Queda MI marca; el aviso no se cierra para los demás.
  await expect.poll(() => sqlLocal(`select count(*) || '|' || (select revisado_en is null from public.avisos_clinica where id = :'id')
    from public.avisos_vistos where aviso_id = :'id'`, { id: a.id })).toBe('1|true')
})

/* MUTACIÓN (comprobada en rojo): `leerAvisosClinica` sin preguntar por `avisos_mas_antiguos`. */
test('un aviso sin ver de hace más de 60 días ya no sale en la lista, pero la campana LO DICE', async ({ page }) => {
  const viejo = sembrarAviso('cancelacion_paciente', 2)
  sqlLocal(`update public.avisos_clinica set creado_en = now() - interval '61 days' where id = :'id'`, { id: viejo.id })
  const nuevo = sembrarAviso('confirmacion_paciente', 3)
  await page.goto('/dashboard')
  // El contador no se da por exacto («o más») y en el dibujo lleva «+».
  await expect(campana(page)).toHaveAttribute('aria-label', /^Avisos \(\d+ o más sin revisar\)$/)
  await expect(campana(page).locator('[data-avisos-pendientes]')).toHaveText(/\+$/)
  await campana(page).click()
  const panel = page.locator('[data-panel-avisos-global]')
  await expect(panel.locator(`[data-aviso="${nuevo.id}"]`)).toBeVisible()
  await expect(panel.locator(`[data-aviso="${viejo.id}"]`)).toHaveCount(0)
  await expect(panel.locator('[data-avisos-mas-antiguos]')).toHaveText('Hay avisos más antiguos que ya no se muestran aquí.')
  // Revisado lo que se ve, la nota sigue: el viejo no se puede revisar desde aquí y no se oculta en silencio.
  await panel.locator('[data-revisar-todos]').click()
  await expect(panel.locator('[data-avisos-vacio]')).toBeVisible()
  await expect(panel.locator('[data-avisos-mas-antiguos]')).toBeVisible()
  // No se borró ni se cerró: sigue en la tabla.
  expect(sqlLocal(`select (revisado_en is null)::text from public.avisos_clinica where id = :'id'`, { id: viejo.id })).toBe('true')
})

test('la burbuja sale con el nombre cuando llega un aviso con la página abierta, una sola vez', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(campana(page)).toBeVisible()
  const a = sembrarAviso('confirmacion_paciente', 1)
  // Volver a la pestaña relee la lista (lo mismo que hace el sondeo cada 2 min).
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  const burbuja = toastConTexto(page, `${a.nombre} confirmó su cita`)
  await expect(burbuja).toBeVisible({ timeout: 15000 })
  await expect(burbuja).toHaveCount(1)
  // Otra relectura no la repite.
  await expect(burbuja).toHaveCount(0, { timeout: 15000 })
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await page.waitForTimeout(1500)
  await expect(burbuja).toHaveCount(0)
})

test('en /agenda manda la campana de la agenda: la global no se pinta', async ({ page }) => {
  sembrarAviso('reagendado_paciente', 2)
  await page.goto('/agenda')
  await expect(page.locator('[data-campana]:visible')).toBeVisible()
  await expect(page.locator('[data-campana-global]')).toHaveCount(0)
})

test('con la agenda v2 apagada no hay campana global', async ({ page }) => {
  interruptorAgenda('A', false)
  sembrarAviso('reserva_enlace', 3)
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('[data-campana-global]')).toHaveCount(0)
})

test('revisado por usuario: lo que revisa el administrador sigue pendiente para la secretaria; y un hecho nuevo lo reabre', async ({ page, browser }) => {
  const a = sembrarAviso('confirmacion_paciente', 4)
  await page.goto('/dashboard')
  await campana(page).click()
  await page.locator(`[data-panel-avisos-global] [data-aviso="${a.id}"]`).waitFor()
  await page.locator('[data-panel-avisos-global] [data-revisar-todos]').click()
  await expect(page.locator(`[data-panel-avisos-global] [data-aviso="${a.id}"]`)).toHaveCount(0)
  await enContextoNuevo(browser, SESION.secretariaA, async (otra) => {
    await otra.goto('/dashboard')
    await campana(otra).click()
    await expect(otra.locator(`[data-panel-avisos-global] [data-aviso="${a.id}"]`)).toBeVisible()
  })
  // Otro hecho del mismo tipo y cita (lo que hace un escritor de la base): el mismo aviso vuelve para quien ya lo vio.
  await page.reload()
  await campana(page).click()
  await expect(page.locator(`[data-panel-avisos-global] [data-aviso="${a.id}"]`)).toHaveCount(0)
  sqlLocal(`insert into public.avisos_clinica (clinica_id, tipo, cita_id) select clinica_id, tipo, cita_id from public.avisos_clinica where id = :'id'
            on conflict (tipo, cita_id) where revisado_en is null do nothing;`, { id: a.id })
  await page.reload()
  await campana(page).click()
  await expect(page.locator(`[data-panel-avisos-global] [data-aviso="${a.id}"]`)).toBeVisible()
})

test('«Solo mis avisos»: el administrador deja de ver los de la agenda de la médica invitada; la secretaria no tiene el interruptor', async ({ page, browser }) => {
  // Un aviso sobre una cita de la médica invitada y otro sobre una del administrador.
  const fila = sqlLocal(`
    with inv as (select id from auth.users where email = 'medico.a@semilla.spinus.test'),
         adm as (select id from auth.users where email = 'admin.a@semilla.spinus.test'),
         c as (select (select a.id from public.appointments a, inv where a.clinica_id = ${CL} and a.medico_id = inv.id and a.paciente_id is not null
                         and a.status = 'scheduled' and a.start_time > now() + interval '1 day' order by a.start_time limit 1) as de_ella,
                      (select a.id from public.appointments a, adm where a.clinica_id = ${CL} and a.medico_id = adm.id and a.paciente_id is not null
                         and a.status = 'scheduled' and a.start_time > now() + interval '1 day' order by a.start_time offset 6 limit 1) as mia),
         i as (insert into public.avisos_clinica (clinica_id, tipo, cita_id)
               select ${CL}, 'cancelacion_paciente', x from c, lateral (values (c.de_ella), (c.mia)) v(x) returning id, cita_id)
    select (select id from i, c where i.cita_id = c.de_ella) || '|' || (select id from i, c where i.cita_id = c.mia);`)
  const [deElla, mio] = fila.split('|')
  propios.push(deElla, mio)
  await page.goto('/dashboard')
  await campana(page).click()
  const panel = page.locator('[data-panel-avisos-global]')
  await expect(panel.locator(`[data-aviso="${deElla}"]`)).toBeVisible()
  await expect(panel.locator(`[data-aviso="${mio}"]`)).toBeVisible()
  await panel.getByRole('radio', { name: 'Solo mis avisos' }).click()
  await expect(panel.locator(`[data-aviso="${deElla}"]`)).toHaveCount(0)
  await expect(panel.locator(`[data-aviso="${mio}"]`)).toBeVisible()
  // Se recuerda en este navegador, y no marca nada como visto: al volver a «Toda la clínica», sigue ahí.
  await page.reload()
  await campana(page).click()
  await expect(panel.getByRole('radio', { name: 'Solo mis avisos' })).toHaveAttribute('aria-checked', 'true')
  await panel.getByRole('radio', { name: 'Toda la clínica' }).click()
  await expect(panel.locator(`[data-aviso="${deElla}"]`)).toBeVisible()
  await enContextoNuevo(browser, SESION.secretariaA, async (otra) => {
    await otra.goto('/dashboard')
    await campana(otra).click()
    await expect(otra.locator('[data-panel-avisos-global]')).toBeVisible()
    await expect(otra.locator('[data-interruptor-mis-avisos]')).toHaveCount(0)
  })
})
