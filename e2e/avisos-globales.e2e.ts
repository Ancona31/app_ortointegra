import { test, expect, type Locator, type Page } from '@playwright/test'
import { SESION, interruptorAgenda, sqlLocal, toastConTexto } from './ayudas'

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
  if (propios.length) sqlLocal(`delete from public.avisos_clinica where id in (${propios.map((id) => `'${id}'`).join(',')});`)
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
  await expect.poll(() => sqlLocal(`select revisado_en is not null from public.avisos_clinica where id = :'id'`, { id: a.id })).toBe('t')
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
