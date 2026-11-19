import { test, expect, type Page } from '@playwright/test'
import { CORREO, SESION, enContextoNuevo, interruptorAgenda, pestanaConfig, sinPendientesAgenda, soloEscritorio, sqlLocal } from './ayudas'

/**
 * Tanda J, agente J5 — la configuración de la agenda de las maquetas
 * (`docs/spec/Main.dc.html` y `Configuracion.dc.html`; puntos 13 a 17 de Angel):
 *   · 13 el funnel de primera vez: tres preguntas que se guardan al
 *        continuar, el cierre con el enlace `/reservar/{código}`, «Cambiar»
 *        desde el resumen, «Terminar después» y la vuelta al mismo paso, y
 *        «Empezar de nuevo» → funnel;
 *   · 14 las cinco pestañas, que se guardan solas con «Guardado» (y el error,
 *        visible, con el valor de antes), sin carreras;
 *   · 15 el horario de la clínica: sólo quien administra, también en el servidor;
 *   · 16 «Agrega más consultorios en tu perfil»;
 *   · 17 nada se pierde: huso y duración por consultorio, el recordatorio que no
 *        es de las cuatro opciones, «Empezar de nuevo» = «Restablecer» (palabra,
 *        sólo administrador) y la dirección `/reservar/{código}`.
 * Y con la v2 apagada, todo como hoy (404 y el engrane de siempre).
 *
 * Cada prueba deja la clínica A como estaba (`foto`/`devolver`, como postgres):
 * lo creado se BORRA (la FK RESTRICT de `tipos_cita` y `reserva_enlaces`
 * impediría volver a sembrar) y lo cambiado vuelve a su valor.
 */
soloEscritorio()
test.use({ storageState: SESION.adminA })

const RUTA = '/agenda/configuracion'
const CL = `(select id from public.clinicas where nombre = 'Clínica Semilla A')`
const CONSULTORIO_INVITADA = 'Rehabilitación (ficticio)'

/** Lo que estas pruebas tocan, para devolverlo (como postgres). */
function foto(): string {
  return sqlLocal(`select json_build_object(
    'desde', now(),
    'tipos', (select coalesce(json_agg(json_build_object('id', id, 'a', activo, 'd', duracion_min)), '[]') from public.tipos_cita where clinica_id = ${CL}),
    'enlaces', (select coalesce(json_agg(id), '[]') from public.reserva_enlaces where clinica_id = ${CL} and revocado_en is null),
    'cons', (select coalesce(json_agg(json_build_object('id', id, 'h', horario, 'p', horario_propio, 'r', horario_revisado_en, 'tz', timezone)), '[]')
               from public.consultorios where clinica_id = ${CL}),
    'clinica', (select horario_consulta from public.clinicas where id = ${CL}),
    'aj', (select row_to_json(j) from (select recordatorio_horas, anticipacion_min_horas, horizonte_dias, vigencia_enlace_unico_dias,
             recordatorio_encendido, correo_reserva_clinica from public.agenda_ajustes where clinica_id = ${CL}) j))::text`)
}

function devolver(f: string): void {
  sqlLocal(`begin; set local session_replication_role = replica;
    delete from public.reserva_enlaces where clinica_id = ${CL} and created_at >= (:'f'::jsonb ->> 'desde')::timestamptz;
    delete from public.tipos_cita where clinica_id = ${CL} and created_at >= (:'f'::jsonb ->> 'desde')::timestamptz;
    update public.reserva_enlaces set revocado_en = null, revocado_por = null
      where id in (select jsonb_array_elements_text(:'f'::jsonb -> 'enlaces')::uuid);
    update public.tipos_cita t set activo = (x.v ->> 'a')::boolean, duracion_min = (x.v ->> 'd')::int
      from (select jsonb_array_elements(:'f'::jsonb -> 'tipos') v) x where t.id = (x.v ->> 'id')::uuid;
    update public.consultorios k set horario = x.v -> 'h', horario_propio = (x.v ->> 'p')::boolean,
        horario_revisado_en = (x.v ->> 'r')::timestamptz, timezone = x.v ->> 'tz'
      from (select jsonb_array_elements(:'f'::jsonb -> 'cons') v) x where k.id = (x.v ->> 'id')::uuid;
    update public.clinicas set horario_consulta = :'f'::jsonb -> 'clinica' where id = ${CL};
    update public.agenda_ajustes a set recordatorio_horas = (j ->> 'recordatorio_horas')::int,
        anticipacion_min_horas = (j ->> 'anticipacion_min_horas')::int, horizonte_dias = (j ->> 'horizonte_dias')::int,
        vigencia_enlace_unico_dias = (j ->> 'vigencia_enlace_unico_dias')::int,
        recordatorio_encendido = (j ->> 'recordatorio_encendido')::boolean, correo_reserva_clinica = (j ->> 'correo_reserva_clinica')::boolean
      from (select :'f'::jsonb -> 'aj' j) x where a.clinica_id = ${CL};
    commit;`, { f })
}

/* Sin pendientes, abre en pestañas. Lo que crea lo borra `devolver` (todo lo de la clínica desde `desde`). */
const sinPendientes = (correo: string): void => { sinPendientesAgenda(correo) }
const adminSinPendientes = () => sinPendientes(CORREO.adminA)

/** Punto de partida conocido para el funnel: «Empezar de nuevo» por su ruta (todo lo que toca lo devuelve `devolver`). */
async function empezarDeNuevo(page: Page): Promise<void> {
  expect((await page.request.post('/api/agenda/restablecer', { data: { confirmacion: 'RESTABLECER' } })).status()).toBe(200)
}

const ajuste = (columna: string) => sqlLocal(`select ${columna} from public.agenda_ajustes where clinica_id = ${CL}`)
const aviso = (page: Page) => page.locator('[data-aviso-config]')

let instantanea = ''
// Primero el interruptor: crea la fila de `agenda_ajustes` si la semilla no la trae, y la foto la necesita.
test.beforeEach(() => { interruptorAgenda('A', true); instantanea = foto() })
/* Integración J: en el teléfono `soloEscritorio()` salta la prueba antes de la foto; sin foto no hay nada que
   devolver (antes, `devolver('')` reventaba en cada prueba del proyecto telefono). */
test.afterEach(() => {
  if (instantanea) devolver(instantanea)
  instantanea = ''
  interruptorAgenda('A', false)
})

/* ── 13 · el funnel ─────────────────────────────────────────────────── */

test('13 · primera vez: tres pasos que se guardan al continuar, el cierre con /reservar/{código} y «Cambiar» desde el resumen', async ({ page }) => {
  await empezarDeNuevo(page)
  await page.goto(RUTA)
  // K3 (punto 12): para quien administra, el primer paso es el horario de la clínica, «Paso 1 de 4».
  await expect(page.getByRole('heading', { name: 'Horario de la clínica' })).toBeVisible()
  await expect(page.getByText('Paso 1 de 4 · menos de 2 minutos')).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('heading', { name: '¿Cuándo das consulta?' })).toBeVisible()
  await expect(page.getByText('Paso 2 de 4 · menos de 2 minutos')).toBeVisible()
  // Hospital Norte: «Otro horario», sin sábado.
  const norte = page.getByRole('group', { name: 'Hospital Norte (ficticio)' })
  await norte.getByRole('button', { name: /Otro horario/ }).click()
  await norte.getByRole('switch', { name: 'Sábado' }).click()
  await norte.getByRole('switch', { name: 'Domingo' }).click()
  await expect(norte.getByRole('group', { name: 'Domingo' }).getByLabel('Entras')).toHaveValue('08:00') // copia el día prendido anterior (viernes)
  await norte.getByRole('switch', { name: 'Domingo' }).click()
  await page.getByRole('button', { name: 'Continuar' }).click()

  await expect(page.getByRole('heading', { name: '¿Cuánto dura tu consulta?' })).toBeVisible()
  expect(sqlLocal(`select horario_propio || '|' || (horario -> 'sabado' ->> 'activo') || '|' || (horario_revisado_en is not null)
    from public.consultorios where nombre = 'Hospital Norte (ficticio)'`)).toBe('true|false|true')
  expect(sqlLocal(`select horario_propio || '|' || (horario_revisado_en is not null) from public.consultorios where nombre = 'Consultorio Centro (ficticio)'`))
    .toBe('false|true')
  await page.getByRole('button', { name: '45 min' }).click()
  await expect(page.getByText(/te caben 13 consultas de 45 minutos/)).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()

  await expect(page.getByRole('heading', { name: '¿Mandamos avisos por correo?' })).toBeVisible()
  expect(sqlLocal(`select duracion_min from public.tipos_cita t join auth.users u on u.id = t.medico_id
    where u.email = :'c' and t.principal and t.activo and t.consultorio_id is null`, { c: CORREO.adminA })).toBe('45')
  await page.getByRole('switch', { name: 'Recordarle su cita al paciente' }).click()
  await expect.poll(() => ajuste('recordatorio_encendido')).toBe('t')
  await page.getByRole('button', { name: 'Terminar', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Tu agenda ya está lista' })).toBeVisible()
  await expect(page.locator('[data-enlace-fijo]')).toHaveText(/^http:\/\/localhost:\d+\/reservar\/[A-Za-z0-9_-]{8,}$/)
  expect(sqlLocal(`select count(*) from public.reserva_enlaces e join auth.users u on u.id = e.medico_id
    where u.email = :'c' and e.clase = 'fijo' and e.revocado_en is null`, { c: CORREO.adminA })).toBe('1')
  await expect(page.getByText('45 minutos')).toBeVisible()
  await expect(page.getByText('Recordatorio al paciente 1 día antes')).toBeVisible()
  await expect(page.getByText('Hospital Norte (ficticio): Lun a vie 8:00 – 18:00')).toBeVisible()

  await page.getByRole('button', { name: 'Cambiar: Cuánto dura tu consulta' }).click()
  await expect(page.getByRole('button', { name: '45 min' })).toHaveAttribute('aria-pressed', 'true')
})

test('13 · «Terminar después» guarda el paso en que estás y, al volver, abre en el mismo', async ({ page }) => {
  await empezarDeNuevo(page)
  await page.goto(RUTA)
  await page.getByRole('button', { name: 'Continuar' }).click() // K3: el horario de la clínica
  await expect(page.getByRole('heading', { name: '¿Cuándo das consulta?' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('heading', { name: '¿Cuánto dura tu consulta?' })).toBeVisible()
  await page.getByRole('button', { name: '20 min' }).click()
  await page.getByRole('button', { name: 'Terminar después' }).click()
  await page.waitForURL('**/agenda')
  expect(sqlLocal(`select duracion_min from public.tipos_cita t join auth.users u on u.id = t.medico_id
    where u.email = :'c' and t.principal and t.activo and t.consultorio_id is null`, { c: CORREO.adminA })).toBe('20')
  await page.goto(RUTA)
  await expect(page.getByRole('heading', { name: '¿Cuánto dura tu consulta?' })).toBeVisible()
  await expect(page.getByRole('button', { name: '20 min' })).toHaveAttribute('aria-pressed', 'true')
})

test('13 y 17 · «Empezar de nuevo» es «Restablecer»: palabra escrita, sólo el administrador, y vuelve al funnel', async ({ page, browser }) => {
  adminSinPendientes()
  await page.goto(RUTA)
  await pestanaConfig(page, 'Más opciones')
  await page.getByRole('button', { name: /Empezar de nuevo/ }).click()
  const dialogo = page.getByRole('alertdialog', { name: '¿Restablecer la configuración de la agenda?' })
  await expect(dialogo.getByRole('button', { name: 'Restablecer', exact: true })).toBeDisabled()
  await dialogo.getByLabel(/Para confirmar, escribe/).fill('RESTABLECER')
  await dialogo.getByRole('button', { name: 'Restablecer', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Horario de la clínica' })).toBeVisible() // K3: el primer paso de quien administra
  expect(sqlLocal(`select count(*) from public.tipos_cita where clinica_id = ${CL} and activo`)).toBe('0')

  sinPendientes(CORREO.medicoA) // la invitada, con las pestañas (en el funnel tampoco hay «Empezar de nuevo»)
  for (const sesion of [SESION.medicoA, SESION.secretariaA]) {
    await enContextoNuevo(browser, sesion, async (p) => {
      await p.goto(RUTA)
      await pestanaConfig(p, 'Más opciones')
      await expect(p.getByRole('button', { name: /Empezar de nuevo/ })).toHaveCount(0)
      expect((await p.request.post('/api/agenda/restablecer', { data: { confirmacion: 'RESTABLECER' } })).status()).toBe(403)
    })
  }
})

test('13 · a quien no le falta nada, y a la secretaria, les salen las pestañas', async ({ page, browser }) => {
  adminSinPendientes()
  await page.goto(RUTA)
  await expect(page.getByRole('tablist', { name: 'Secciones de la configuración' }).getByRole('tab'))
    .toHaveText(['Tu enlace', 'Cuándo das consulta', 'Tu consulta', 'Avisos', 'Más opciones'])
  await enContextoNuevo(browser, SESION.secretariaA, async (p) => {
    await p.goto(RUTA)
    await expect(p.getByRole('tablist', { name: 'Secciones de la configuración' })).toBeVisible()
    await expect(p.getByRole('heading', { name: '¿Cuándo das consulta?' })).toHaveCount(0)
  })
})

/* ── 14 · las pestañas se guardan solas ─────────────────────────────── */

test('14 · pestañas de la APG: flechas, Inicio y Fin; «Esta computadora» no existe', async ({ page }) => {
  adminSinPendientes()
  await page.goto(RUTA)
  await page.getByRole('tab', { name: 'Tu enlace' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Cuándo das consulta' })).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('End')
  await expect(page.getByRole('tab', { name: 'Más opciones' })).toBeFocused()
  await expect(page.getByText('Esta computadora')).toHaveCount(0)
  await expect(page.getByText('Este dispositivo')).toHaveCount(0)
})

test('14 · Avisos: interruptor y plazos se guardan solos con «Guardado»; si el servidor falla, sale el error y vuelve el valor', async ({ page }) => {
  adminSinPendientes()
  await page.goto(RUTA)
  await pestanaConfig(page, 'Avisos')
  await page.getByRole('switch', { name: 'Avisarme cuando alguien aparte cita' }).click()
  await expect(aviso(page)).toHaveText('Guardado')
  expect(ajuste('correo_reserva_clinica')).toBe('t')

  const dias = page.getByLabel('Pueden ver horarios de los próximos')
  await dias.fill('90')
  await dias.blur()
  await expect(aviso(page)).toHaveText('Guardado')
  expect(ajuste('horizonte_dias')).toBe('90')

  await page.route('**/api/me/ajustes-agenda', r => (r.request().method() === 'PUT'
    ? r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Falla de prueba' }) }) : r.continue()))
  await dias.fill('120')
  await dias.blur()
  // Un 500 no enseña su cuerpo: el motivo de siempre.
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudieron guardar los ajustes' })).toBeVisible()
  await expect(dias).toHaveValue('90')
  expect(ajuste('horizonte_dias')).toBe('90')

  // Un valor fuera de rango no se manda.
  await page.unroute('**/api/me/ajustes-agenda')
  await dias.fill('400')
  await dias.blur()
  await expect(page.getByRole('alert').filter({ hasText: 'Hasta cuándo se puede reservar: de 1 a 365' })).toBeVisible()
  expect(ajuste('horizonte_dias')).toBe('90')
})

test('14 · sin carreras: un solo guardado en vuelo y gana lo último', async ({ page }) => {
  adminSinPendientes()
  await page.goto(RUTA)
  await pestanaConfig(page, 'Avisos')
  let enVuelo = 0
  let maximo = 0
  await page.route('**/api/me/ajustes-agenda', async r => {
    if (r.request().method() !== 'PUT') return r.continue()
    enVuelo += 1
    maximo = Math.max(maximo, enVuelo)
    await new Promise(res => setTimeout(res, 600))
    await r.continue()
    enVuelo -= 1
  })
  const dias = page.getByLabel('Pueden ver horarios de los próximos')
  for (const v of ['70', '80', '95']) { await dias.fill(v); await dias.blur() }
  await expect.poll(() => ajuste('horizonte_dias')).toBe('95')
  await expect(aviso(page)).toHaveText('Guardado')
  expect(maximo).toBe(1)
})

test('14 · Tu consulta: la duración se guarda al pulsar; un tipo se agrega y se quita', async ({ page }) => {
  adminSinPendientes()
  await page.goto(RUTA)
  await pestanaConfig(page, 'Tu consulta')
  await page.getByRole('button', { name: '20 min' }).click()
  await expect(aviso(page)).toHaveText('Guardado')
  await expect(page.getByText('Tu consulta dura 20 minutos.')).toBeVisible()
  await page.getByRole('button', { name: 'Agregar tipo de cita' }).click()
  await page.getByLabel('Nombre').fill('Primera vez J5')
  await page.getByLabel('Duración (min)').fill('45')
  await page.getByRole('button', { name: 'Agregar', exact: true }).click()
  const fila = page.getByRole('group', { name: 'Primera vez J5' })
  await expect(fila).toContainText('45 minutos')
  await fila.getByRole('button', { name: 'Quitar Primera vez J5' }).click()
  await page.getByText(/^Quitados \(\d+\)$/).click()
  await expect(page.getByRole('group', { name: 'Primera vez J5' }).getByRole('button', { name: 'Reactivar Primera vez J5' })).toBeVisible()
  expect(sqlLocal(`select activo from public.tipos_cita where nombre = 'Primera vez J5'`)).toBe('f')
})

/* K3 (punto 14): apagar ya no pide confirmación ni revoca: PAUSA, y prender devuelve el MISMO enlace
   (detalle en agenda-k3-configuracion, «14 · …»). Aquí, que el interruptor ida y vuelta deja un solo fijo vigente. */
test('14 y 17 · Tu enlace: apagarlo lo pausa sin preguntar; prenderlo lo devuelve en /reservar/{código}; el de una vez se crea y se apaga', async ({ page }) => {
  adminSinPendientes()
  await page.goto(RUTA)
  const interruptor = page.getByRole('switch', { name: /Prendido: tus pacientes pueden apartar con él/ })
  await interruptor.click()
  await expect(page.getByRole('switch', { name: /Apagado: nadie puede apartar con él/ })).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('switch', { name: /Apagado/ }).click()
  await expect(page.locator('[data-enlace-fijo]')).toHaveText(/\/reservar\/[A-Za-z0-9_-]{8,}$/)
  expect(sqlLocal(`select count(*) from public.reserva_enlaces e join auth.users u on u.id = e.medico_id
    where u.email = :'c' and e.clase = 'fijo' and e.revocado_en is null and e.pausado_en is null`, { c: CORREO.adminA })).toBe('1')

  await page.getByRole('button', { name: 'Crear uno' }).click()
  await page.getByLabel('¿Para quién es? (solo lo ves tú)').fill('Paciente de prueba J5')
  await page.getByRole('button', { name: 'Crear enlace de una vez' }).click()
  await expect(page.locator('[data-enlace-una-vez]')).toHaveText(/\/reservar\/[A-Za-z0-9_-]{8,}$/)
  const fila = page.getByRole('group', { name: 'Paciente de prueba J5' })
  await expect(fila).toContainText('Sin usar · deja de servir el')
  await fila.getByRole('button', { name: 'Apagar el enlace de Paciente de prueba J5' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Aceptar' }).click()
  await expect(fila).toHaveCount(0)
})

/* ── revisión independiente: los fallos que encontró, cada uno con su prueba ── */

/* MUTACIÓN: dar por guardado sólo el ÚLTIMO resultado del bucle de `enviar` (estadoAvisos.ts) → rojo (vuelve a 60). */
test('14 · si el primer guardado entra y el siguiente falla, el campo vuelve al que entró, no al de antes', async ({ page }) => {
  adminSinPendientes()
  await page.goto(RUTA)
  await pestanaConfig(page, 'Avisos')
  let n = 0
  await page.route('**/api/me/ajustes-agenda', async r => {
    if (r.request().method() !== 'PUT') return r.continue()
    n += 1
    if (n === 1) { await new Promise(res => setTimeout(res, 800)); return r.continue() }
    return r.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
  })
  const dias = page.getByLabel('Pueden ver horarios de los próximos')
  await dias.fill('70'); await dias.blur()
  await dias.fill('80'); await dias.blur()
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudieron guardar los ajustes' })).toBeVisible()
  await expect(dias).toHaveValue('70')
  expect(ajuste('horizonte_dias')).toBe('70')
})

/* MUTACIÓN: `abierto = pedido` (sin mirar `invalido`) en `PlazosPlegados` → rojo (se pliega y no dice nada). */
test('13 · un plazo inválido en el paso 3 no se pliega: se ve por qué «Terminar» no deja seguir', async ({ page }) => {
  await empezarDeNuevo(page)
  await page.goto(RUTA)
  await page.getByRole('button', { name: 'Continuar' }).click() // K3: el horario de la clínica
  await expect(page.getByRole('heading', { name: '¿Cuándo das consulta?' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('heading', { name: '¿Cuánto dura tu consulta?' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('heading', { name: '¿Mandamos avisos por correo?' })).toBeVisible()
  await page.getByRole('button', { name: 'Cambiar', exact: true }).click()
  await page.getByLabel('Pueden ver horarios de los próximos').fill('')
  await page.getByRole('button', { name: 'Listo' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Hasta cuándo se puede reservar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Terminar', exact: true })).toBeDisabled()
})

/* MUTACIÓN: quitar el `if (lista === 'error') return …` de `enlaceFijo` (PrimeraVez.tsx) → rojo (emite, y regeneraría el que hay). */
test('13 · si al cerrar no se puede leer la lista de enlaces, no se emite ninguno (no se mata el que ya se compartió)', async ({ page }) => {
  await empezarDeNuevo(page)
  await page.goto(RUTA)
  await page.getByRole('button', { name: 'Continuar' }).click() // K3: el horario de la clínica
  await expect(page.getByRole('heading', { name: '¿Cuándo das consulta?' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('heading', { name: '¿Cuánto dura tu consulta?' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('heading', { name: '¿Mandamos avisos por correo?' })).toBeVisible()
  let emitidos = 0
  await page.route('**/api/agenda/enlaces', r => {
    if (r.request().method() === 'POST') { emitidos += 1; return r.continue() }
    return r.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
  })
  await page.getByRole('button', { name: 'Terminar', exact: true }).click()
  await expect(page.getByText('No se pudo leer tu enlace. Recarga la página.')).toBeVisible()
  expect(emitidos).toBe(0)
})

/* MUTACIÓN: quitar el candado `enCurso` de `useNavegacion` (PrimeraVez.tsx) → rojo (dos duraciones principales: el
   índice único hace fallar la segunda y sale un error, o se crean dos POST). */
test('13 · un doble clic en «Continuar» guarda la duración una sola vez', async ({ page }) => {
  await empezarDeNuevo(page)
  await page.goto(RUTA)
  await page.getByRole('button', { name: 'Continuar' }).click() // K3: el horario de la clínica
  await expect(page.getByRole('heading', { name: '¿Cuándo das consulta?' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('heading', { name: '¿Cuánto dura tu consulta?' })).toBeVisible()
  let altas = 0
  await page.route('**/api/agenda/tipos-cita', async r => {
    if (r.request().method() === 'POST') { altas += 1; await new Promise(res => setTimeout(res, 400)) }
    return r.continue()
  })
  /* Dos clics en la misma tarea, antes de que React repinte el botón deshabilitado: un `dblclick()` de
     Playwright no lo consigue (React aplica el `disabled` entre un clic y otro) y no probaría el candado. */
  await page.getByRole('button', { name: 'Continuar' }).evaluate((b: HTMLElement) => { b.click(); b.click() })
  await expect(page.getByRole('heading', { name: '¿Mandamos avisos por correo?' })).toBeVisible()
  expect(altas).toBe(1)
})

/* MUTACIÓN: volver a esconder «Crear uno» mientras `creando` (PestanaEnlace.tsx) → rojo (no hay «Crear otro»). */
test('14 · tras crear un enlace de una vez se puede crear otro sin recargar', async ({ page }) => {
  adminSinPendientes()
  await page.goto(RUTA)
  await page.getByRole('button', { name: 'Crear uno' }).click()
  await page.getByLabel('¿Para quién es? (solo lo ves tú)').fill('Primero J5')
  await page.getByRole('button', { name: 'Crear enlace de una vez' }).click()
  await expect(page.locator('[data-enlace-una-vez]')).toBeVisible()
  await page.getByRole('button', { name: 'Crear otro' }).click()
  await expect(page.getByLabel('¿Para quién es? (solo lo ves tú)')).toHaveValue('')
  await page.getByLabel('¿Para quién es? (solo lo ves tú)').fill('Segundo J5')
  await page.getByRole('button', { name: 'Crear enlace de una vez' }).click()
  await expect(page.getByRole('group', { name: 'Segundo J5' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Primero J5' })).toBeVisible()
})

/* ── 15 · el horario de la clínica ──────────────────────────────────── */

test('15 · el administrador cambia el horario de la clínica (base y audit_log); la invitada y la secretaria no ven «Cambiar horario de la clínica» y su PUT da 403', async ({ page, browser }) => {
  adminSinPendientes()
  const desde = sqlLocal('select now()')
  await page.goto(RUTA)
  await pestanaConfig(page, 'Cuándo das consulta')
  // K3 (punto 11): la tarjeta va arriba y su botón es «Cambiar horario» («… de la clínica» para el lector).
  await page.getByRole('button', { name: 'Cambiar horario de la clínica' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Horario de la clínica' })
  await dialogo.getByRole('switch', { name: 'Sábado' }).click()
  await dialogo.getByRole('button', { name: 'Guardar horario' }).click()
  await expect(dialogo).toHaveCount(0)
  await expect(aviso(page)).toHaveText('Guardado')
  await expect(page.locator('[data-horario-clinica]')).toContainText('Lun a vie · 8:00 – 18:00')
  await expect(page.locator('[data-horario-clinica]')).not.toContainText('Sáb')
  expect(sqlLocal(`select horario_consulta -> 'sabado' ->> 'activo' from public.clinicas where id = ${CL}`)).toBe('false')
  expect(sqlLocal(`select count(*) from public.audit_log where accion = 'horario_clinica_editado' and created_at >= :'d'::timestamptz
    and user_id = (select id::text from auth.users where email = :'c')`, { d: desde, c: CORREO.adminA })).toBe('1')

  const horario = JSON.parse(sqlLocal(`select horario_consulta::text from public.clinicas where id = ${CL}`)) as Record<string, unknown>
  for (const sesion of [SESION.medicoA, SESION.secretariaA]) {
    await enContextoNuevo(browser, sesion, async (p) => {
      expect((await p.request.put('/api/me/horario', { data: { horario } })).status()).toBe(403)
    })
  }
  await enContextoNuevo(browser, SESION.secretariaA, async (p) => {
    await p.goto(RUTA)
    await pestanaConfig(p, 'Cuándo dan consulta')
    // Tanda M (punto 15): a la secretaria, al inicio de la pestaña, no en la tarjeta.
    await expect(p.locator('#config-panel-horario [data-solo-admin]')).toHaveText('Solo el médico administrador puede cambiar estas opciones.')
    await expect(p.getByRole('button', { name: 'Cambiar horario de la clínica' })).toHaveCount(0)
  })
})

/* ── 16 y 17 ─────────────────────────────────────────────────────────── */

test('16 · bajo los consultorios, «Agrega más consultorios en tu perfil» con «perfil» como enlace', async ({ page }) => {
  adminSinPendientes()
  await page.goto(RUTA)
  await pestanaConfig(page, 'Cuándo das consulta')
  await expect(page.getByText('Agrega más consultorios en tu perfil.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'perfil', exact: true })).toHaveAttribute('href', '/perfil')
})

test('17 · cambiar el horario de un consultorio no toca su huso ni su duración propia', async ({ browser }) => {
  sqlLocal(`update public.consultorios set timezone = 'America/Tijuana' where nombre = :'n'`, { n: CONSULTORIO_INVITADA })
  sinPendientes(CORREO.medicoA)
  sqlLocal(`insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min, principal, consultorio_id)
      select ${CL}, k.medico_id, 'Consulta', 50, true, k.id from public.consultorios k where k.nombre = :'n'`, { n: CONSULTORIO_INVITADA })
  await enContextoNuevo(browser, SESION.medicoA, async (p) => {
    await p.goto(RUTA)
    await pestanaConfig(p, 'Cuándo das consulta')
    await p.getByRole('button', { name: `Cambiar horario de ${CONSULTORIO_INVITADA}` }).click()
    const dialogo = p.getByRole('dialog', { name: `Horario en ${CONSULTORIO_INVITADA}` })
    await dialogo.getByRole('button', { name: 'Otro horario' }).click()
    await dialogo.getByRole('switch', { name: 'Martes' }).click()
    await dialogo.getByRole('button', { name: 'Guardar horario' }).click()
    await expect(dialogo).toHaveCount(0)
    await expect(p.locator('[data-aviso-config]')).toHaveText('Guardado')
  })
  expect(sqlLocal(`select timezone || '|' || horario_propio from public.consultorios where nombre = :'n'`, { n: CONSULTORIO_INVITADA }))
    .toBe('America/Tijuana|true')
  expect(sqlLocal(`select t.duracion_min || '|' || t.activo from public.tipos_cita t join public.consultorios k on k.id = t.consultorio_id
    where k.nombre = :'n'`, { n: CONSULTORIO_INVITADA })).toBe('50|true')
})

test('17 · un recordatorio de 6 horas (no es de las cuatro opciones) se enseña y no se pisa al guardar otro ajuste', async ({ page }) => {
  adminSinPendientes()
  sqlLocal(`update public.agenda_ajustes set recordatorio_horas = 6, recordatorio_encendido = true where clinica_id = ${CL}`)
  await page.goto(RUTA)
  await pestanaConfig(page, 'Avisos')
  const selector = page.getByRole('combobox')
  await expect(selector).toHaveValue('6')
  await expect(selector.locator('option')).toHaveText(['2 horas', '6 horas', '12 horas', '1 día (24 horas)', '2 días (48 horas)'])
  const horas = page.getByLabel('No pueden apartar si faltan menos de')
  await horas.fill('3')
  await horas.blur()
  await expect(aviso(page)).toHaveText('Guardado')
  expect(ajuste(`recordatorio_horas || '|' || anticipacion_min_horas`)).toBe('6|3')
})

/* ── la v2 apagada ──────────────────────────────────────────────────── */

test('v2 apagada: ni funnel ni pestañas (la ruta no existe) y sus rutas nuevas no cambian nada', async ({ page }) => {
  interruptorAgenda('A', false)
  await page.goto(RUTA)
  await expect(page.getByText('This page could not be found')).toBeVisible()
  await expect(page.getByRole('heading', { name: '¿Cuándo das consulta?' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Configuración de la agenda' })).toHaveCount(0)
  // «Empezar de nuevo» tampoco: la función responde «apagado».
  expect((await page.request.post('/api/agenda/restablecer', { data: { confirmacion: 'RESTABLECER' } })).status()).not.toBe(200)
  // El engrane de siempre (modal de horario) lo comprueba `agenda-configuracion.e2e.ts`, «apagado».
})
