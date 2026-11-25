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
  /* «Marcar todos» deja una marca de agua por usuario (M1): se quita, o escondería a las pruebas
     siguientes los avisos sembrados con hora vieja. Sólo la de la clínica A. */
  sqlLocal(`delete from public.avisos_vistos_hasta where clinica_id = ${CL};`)
})
test.afterAll(() => { interruptorAgenda('A', false) })

test('fuera de la agenda: la campana cuenta los avisos, la lista los nombra y revisar los quita', async ({ page }) => {
  const a = sembrarAviso('cancelacion_paciente', 0)
  await page.goto('/dashboard')
  /* En la batería completa la clínica A llega aquí con 50 avisos o más de las pruebas anteriores y la campana
     dice «50 o más» (su tope): las dos formas son la cuenta. Lo que se prueba es el aviso sembrado, abajo. */
  await expect(campana(page)).toHaveAttribute('aria-label', /^Avisos \(\d+( o más)? sin revisar\)$/)
  await campana(page).click()
  const fila = page.locator(`[data-panel-avisos-global] [data-aviso="${a.id}"]`)
  await expect(fila).toContainText(`${a.nombre} canceló su cita`)
  await expect(fila).toHaveAttribute('href', /^\/agenda\?cita=/)
  await page.locator('[data-panel-avisos-global] [data-revisar-todos]').click()
  await expect(page.locator('[data-panel-avisos-global] [data-avisos-vacio]')).toBeVisible()
  // M1: «revisado» es POR USUARIO. «Marcar todos» deja MI marca de agua (una fila, no una por aviso),
  // que cubre el aviso; el aviso no se cierra para los demás.
  await expect.poll(() => sqlLocal(`select count(*) || '|' || bool_and(h.hasta >= a.creado_en) || '|' || bool_and(a.revisado_en is null)
    from public.avisos_vistos_hasta h, public.avisos_clinica a
   where a.id = :'id' and h.usuario_id = (select id from auth.users where email = 'admin.a@semilla.spinus.test')`, { id: a.id })).toBe('1|true|true')
})

/* MUTACIONES (comprobadas en rojo): `leerAvisosClinica` sin preguntar por `avisos_mas_antiguos`;
   «Marcar todos» marcando uno a uno lo que se ve (la nota no se iría nunca). */
test('un aviso sin ver de hace más de 60 días no sale en la lista: la campana LO DICE y «Marcar todos» lo resuelve', async ({ page }) => {
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
  await expect(panel.locator('[data-avisos-mas-antiguos]')).toHaveText(
    'Hay más avisos sin revisar de los que se muestran aquí. «Marcar todos como revisados» también los incluye.')
  // El gesto lo resuelve TODO, también lo que la lista no enseñaba: se va la nota, se va el «+».
  await panel.locator('[data-revisar-todos]').click()
  await expect(panel.locator('[data-avisos-vacio]')).toBeVisible()
  await expect(panel.locator('[data-avisos-mas-antiguos]')).toHaveCount(0)
  await expect(campana(page)).toHaveAttribute('aria-label', 'Avisos')
  // Y sigue así tras releer (la base lo apuntó), sin borrar ni cerrar el viejo: sigue en la tabla.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await page.waitForTimeout(1500)
  await expect(campana(page)).toHaveAttribute('aria-label', 'Avisos')
  expect(sqlLocal(`select (revisado_en is null)::text from public.avisos_clinica where id = :'id'`, { id: viejo.id })).toBe('true')
})

/* Con la lista VACÍA y algo sin ver fuera de ella: no dice «No hay avisos», dice cómo resolverlo. */
test('lista vacía con un aviso sin ver fuera de ella: la nota y el botón, no «No hay avisos»', async ({ page }) => {
  /* La lista tiene que estar VACÍA: lo que la clínica A ya tuviera pendiente para adminA se marca
     visto uno a uno (sólo esas marcas, por hora, y se quitan al final). Así el caso es determinista. */
  const marca = sqlLocal(`select clock_timestamp()::text`)
  const yo = `(select id from auth.users where email = 'admin.a@semilla.spinus.test')`
  sqlLocal(`insert into public.avisos_vistos (aviso_id, usuario_id, clinica_id)
    select a.id, ${yo}, a.clinica_id from public.avisos_clinica a where a.clinica_id = ${CL}
    on conflict (aviso_id, usuario_id) do update set visto_en = clock_timestamp()`)
  try {
    const viejo = sembrarAviso('cancelacion_paciente', 4)
    sqlLocal(`update public.avisos_clinica set creado_en = now() - interval '61 days' where id = :'id'`, { id: viejo.id })
    await page.goto('/dashboard')
    await expect(campana(page)).toHaveAttribute('aria-label', 'Avisos (hay avisos sin revisar)')
    await campana(page).click()
    const panel = page.locator('[data-panel-avisos-global]')
    await expect(panel.locator('[data-aviso]')).toHaveCount(0)
    await expect(panel.locator('[data-avisos-mas-antiguos]')).toBeVisible()
    await expect(panel.locator('[data-avisos-vacio]')).toHaveCount(0)
    await panel.locator('[data-revisar-todos]').click()
    await expect(panel.locator('[data-avisos-vacio]')).toBeVisible()
    await expect(campana(page)).toHaveAttribute('aria-label', 'Avisos')
  } finally {
    sqlLocal(`delete from public.avisos_vistos where usuario_id = ${yo} and visto_en >= :'m'::timestamptz`, { m: marca })
  }
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
