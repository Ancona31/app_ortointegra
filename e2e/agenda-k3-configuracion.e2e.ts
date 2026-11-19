import { test, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { CORREO, SESION, enContextoNuevo, interruptorAgenda, pestanaConfig, sinPendientesAgenda, soloEscritorio, sqlLocal } from './ayudas'
import { api, emitirEnlace, personaNueva, prepararEscenario, reservar, turnosLibres, type Escenario } from './reservaPublicaAyudas'
import { codigoDeEnlace } from '../src/lib/reserva/secretos'

/**
 * Tanda K, agente K3 — la configuración de la agenda (puntos 11 a 14 de Angel):
 *   · 11 el horario de la clínica en su tarjeta, al INICIO de «Cuándo das consulta», con sus días y
 *        horas; «Cambiar horario» sólo para el médico administrador (y el PUT da 403 a los demás).
 *   · 12 el horario de la clínica, con su huso, es el PRIMER paso del funnel sólo para el médico
 *        administrador («Paso 1 de 4»); los demás empiezan en sus consultorios («Paso 1 de 3»).
 *        «Atrás», «Terminar después» y «Cambiar» desde el resumen cuentan con él; el PUT valida
 *        rol (403), huso (400), filtra por clínica y deja `audit_log`; el huso de los consultorios no cambia.
 *   · 14 apagar «Tu enlace» lo PAUSA: la página, los turnos y la reserva responden igual que con un
 *        enlace que no existe; al prenderlo vuelve la MISMA dirección; sólo «Cambiar por uno nuevo» revoca.
 *   · 13 en el teléfono las cinco pestañas son iconos con su nombre accesible, sin desplazamiento
 *        lateral a 390 ni a 320 px, y el nombre de la elegida va de título debajo; en computadora, texto.
 *
 * Cada prueba deja la clínica A como estaba (`foto`/`devolver`, como postgres; copia de las de
 * `agenda-j5-configuracion`, que viven dentro de ese archivo).
 */
test.use({ storageState: SESION.adminA })

const RUTA = '/agenda/configuracion'
const CL = `(select id from public.clinicas where nombre = 'Clínica Semilla A')`

/** Lo que estas pruebas tocan, para devolverlo (como postgres). Copia de la de J5 con el huso de la clínica y la pausa. */
function foto(): string {
  return sqlLocal(`select json_build_object(
    'desde', now(),
    'tipos', (select coalesce(json_agg(json_build_object('id', id, 'a', activo, 'd', duracion_min)), '[]') from public.tipos_cita where clinica_id = ${CL}),
    'enlaces', (select coalesce(json_agg(json_build_object('id', id, 'p', pausado_en)), '[]') from public.reserva_enlaces where clinica_id = ${CL} and revocado_en is null),
    'cons', (select coalesce(json_agg(json_build_object('id', id, 'h', horario, 'p', horario_propio, 'r', horario_revisado_en, 'tz', timezone)), '[]')
               from public.consultorios where clinica_id = ${CL}),
    'clinica', (select horario_consulta from public.clinicas where id = ${CL}),
    'tz', (select timezone from public.clinicas where id = ${CL}),
    'aj', (select row_to_json(j) from (select recordatorio_horas, anticipacion_min_horas, horizonte_dias, vigencia_enlace_unico_dias,
             recordatorio_encendido, correo_reserva_clinica from public.agenda_ajustes where clinica_id = ${CL}) j))::text`)
}

function devolver(f: string): void {
  sqlLocal(`begin; set local session_replication_role = replica;
    delete from public.reserva_enlaces where clinica_id = ${CL} and created_at >= (:'f'::jsonb ->> 'desde')::timestamptz;
    delete from public.tipos_cita where clinica_id = ${CL} and created_at >= (:'f'::jsonb ->> 'desde')::timestamptz;
    update public.reserva_enlaces e set revocado_en = null, revocado_por = null, pausado_en = (x.v ->> 'p')::timestamptz
      from (select jsonb_array_elements(:'f'::jsonb -> 'enlaces') v) x where e.id = (x.v ->> 'id')::uuid;
    update public.tipos_cita t set activo = (x.v ->> 'a')::boolean, duracion_min = (x.v ->> 'd')::int
      from (select jsonb_array_elements(:'f'::jsonb -> 'tipos') v) x where t.id = (x.v ->> 'id')::uuid;
    update public.consultorios k set horario = x.v -> 'h', horario_propio = (x.v ->> 'p')::boolean,
        horario_revisado_en = (x.v ->> 'r')::timestamptz, timezone = x.v ->> 'tz'
      from (select jsonb_array_elements(:'f'::jsonb -> 'cons') v) x where k.id = (x.v ->> 'id')::uuid;
    update public.clinicas set horario_consulta = :'f'::jsonb -> 'clinica', timezone = :'f'::jsonb ->> 'tz' where id = ${CL};
    update public.agenda_ajustes a set recordatorio_horas = (j ->> 'recordatorio_horas')::int,
        anticipacion_min_horas = (j ->> 'anticipacion_min_horas')::int, horizonte_dias = (j ->> 'horizonte_dias')::int,
        vigencia_enlace_unico_dias = (j ->> 'vigencia_enlace_unico_dias')::int,
        recordatorio_encendido = (j ->> 'recordatorio_encendido')::boolean, correo_reserva_clinica = (j ->> 'correo_reserva_clinica')::boolean
      from (select :'f'::jsonb -> 'aj' j) x where a.clinica_id = ${CL};
    commit;`, { f })
}

/** Punto de partida conocido para el funnel: «Empezar de nuevo» por su ruta (lo que toca lo devuelve `devolver`). */
async function empezarDeNuevo(page: Page): Promise<void> {
  expect((await page.request.post('/api/agenda/restablecer', { data: { confirmacion: 'RESTABLECER' } })).status()).toBe(200)
}

let instantanea = ''
const limpiezas: (() => void)[] = []
test.beforeEach(() => { interruptorAgenda('A', true); instantanea = foto() })
test.afterEach(() => {
  for (const l of limpiezas.splice(0)) l()
  if (instantanea) devolver(instantanea)
  instantanea = ''
  interruptorAgenda('A', false)
})

/** Las tarjetas del panel «Cuándo das consulta» (la de la clínica y una por consultorio), en el orden del documento. */
const tarjetasDelPanel = (page: Page) => page.locator('#config-panel-horario [role="group"]')

/* ── 11 · la tarjeta del horario de la clínica ─────────────────────────── */

test.describe('escritorio', () => {
soloEscritorio()

test('11 · el horario de la clínica va primero, con sus días; sólo el administrador ve «Cambiar horario» y lo guarda; los demás lo ven sin botón y su PUT da 403', async ({ page, browser }) => {
  limpiezas.push(sinPendientesAgenda(CORREO.adminA), sinPendientesAgenda(CORREO.medicoA))
  await page.goto(RUTA)
  await pestanaConfig(page, 'Cuándo das consulta')
  const tarjeta = page.getByRole('group', { name: 'Horario de la clínica' })
  await expect(tarjetasDelPanel(page).first()).toHaveAccessibleName('Horario de la clínica')
  await expect(tarjeta).toContainText('Lun a vie · 8:00 – 18:00')
  await expect(tarjeta).toContainText('Sáb · 8:00 – 13:00')
  await tarjeta.getByRole('button', { name: 'Cambiar horario de la clínica' }).click()
  const dialogo = page.getByRole('dialog', { name: 'Horario de la clínica' })
  await dialogo.getByRole('switch', { name: 'Sábado' }).click()
  await dialogo.getByRole('button', { name: 'Guardar horario' }).click()
  await expect(dialogo).toHaveCount(0)
  await expect(tarjeta).not.toContainText('Sáb')
  expect(sqlLocal(`select horario_consulta -> 'sabado' ->> 'activo' from public.clinicas where id = ${CL}`)).toBe('false')

  const horario = JSON.parse(sqlLocal(`select horario_consulta::text from public.clinicas where id = ${CL}`)) as Record<string, unknown>
  for (const [sesion, pestana] of [[SESION.medicoA, 'Cuándo das consulta'], [SESION.secretariaA, 'Cuándo dan consulta']] as const) {
    await enContextoNuevo(browser, sesion, async (p) => {
      expect((await p.request.put('/api/me/horario', { data: { horario } })).status()).toBe(403)
      await p.goto(RUTA)
      await pestanaConfig(p, pestana)
      const suya = p.getByRole('group', { name: 'Horario de la clínica' })
      await expect(tarjetasDelPanel(p).first()).toHaveAccessibleName('Horario de la clínica')
      await expect(suya).toContainText('Lun a vie · 8:00 – 18:00')
      // Tanda M (punto 15): a la invitada en la tarjeta; a la secretaria, al inicio de la pestaña. Una vez.
      await expect(p.locator('#config-panel-horario [data-solo-admin]')).toHaveText('Solo el médico administrador puede cambiar estas opciones.')
      await expect(suya.getByRole('button')).toHaveCount(0)
    })
  }
})

/* ── 12 · el paso de la clínica en el funnel ─────────────────────────── */

const TEXTO_CLINICA = 'Este horario se usará de fábrica en todos los consultorios que se creen. También puedes cambiar el horario y la ubicación de cada consultorio.'
const husoDe = () => sqlLocal(`select coalesce(timezone, '<null>') from public.clinicas where id = ${CL}`)
const husosConsultorios = () => sqlLocal(`select string_agg(timezone, ',' order by id) from public.consultorios where clinica_id = ${CL}`)

test('12 · admin: «Paso 1 de 4» es el horario de la clínica con su huso; se guarda al continuar (base y audit_log) sin tocar el huso de los consultorios; «Atrás», «Terminar después» y «Cambiar» vuelven a él', async ({ page }) => {
  await empezarDeNuevo(page)
  const husosAntes = husosConsultorios()
  const desde = sqlLocal('select now()')
  await page.goto(RUTA)
  await expect(page.getByRole('heading', { name: 'Horario de la clínica' })).toBeVisible()
  await expect(page.getByText('Paso 1 de 4 · menos de 2 minutos')).toBeVisible()
  await expect(page.getByText(TEXTO_CLINICA)).toBeVisible()
  await page.getByRole('switch', { name: 'Sábado' }).click()
  await page.getByLabel('Huso horario de la clínica').selectOption('America/Cancun')
  await page.getByRole('button', { name: 'Continuar' }).click()

  await expect(page.getByRole('heading', { name: '¿Cuándo das consulta?' })).toBeVisible()
  await expect(page.getByText('Paso 2 de 4 · menos de 2 minutos')).toBeVisible()
  expect(sqlLocal(`select horario_consulta -> 'sabado' ->> 'activo' from public.clinicas where id = ${CL}`)).toBe('false')
  expect(husoDe()).toBe('America/Cancun')
  expect(husosConsultorios()).toBe(husosAntes)
  expect(sqlLocal(`select count(*) from public.audit_log where accion = 'horario_clinica_editado' and created_at >= :'d'::timestamptz
    and registro_id = (select id from public.clinicas where nombre = 'Clínica Semilla A') and descripcion = 'horario y huso horario'`, { d: desde })).toBe('1')
  // «Igual que la clínica» ya dice el horario nuevo (sin sábado).
  await expect(page.getByRole('group', { name: 'Hospital Norte (ficticio)' }).getByText('Lun a vie 8:00 – 18:00', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Atrás' }).click()
  await expect(page.getByText('Paso 1 de 4 · menos de 2 minutos')).toBeVisible()
  await expect(page.getByLabel('Huso horario de la clínica')).toHaveValue('America/Cancun')
  await page.getByRole('button', { name: 'Terminar después' }).click()
  await page.waitForURL('**/agenda')
  await page.goto(RUTA)
  await expect(page.getByRole('heading', { name: 'Horario de la clínica' })).toBeVisible()

  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByText('Paso 2 de 4 · menos de 2 minutos')).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('heading', { name: '¿Cuánto dura tu consulta?' })).toBeVisible()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.getByRole('heading', { name: '¿Mandamos avisos por correo?' })).toBeVisible()
  await expect(page.getByText('Paso 4 de 4 · menos de 2 minutos')).toBeVisible()
  await page.getByRole('button', { name: 'Terminar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tu agenda ya está lista' })).toBeVisible()
  await expect(page.getByText(/Huso horario: Quintana Roo/)).toBeVisible()
  await page.getByRole('button', { name: 'Cambiar: Horario de la clínica' }).click()
  await expect(page.getByRole('heading', { name: 'Horario de la clínica' })).toBeVisible()
  await expect(page.getByText('Paso 1 de 4 · menos de 2 minutos')).toBeVisible()
})

test('12 · la médica invitada empieza en sus consultorios, «Paso 1 de 3», sin el paso de la clínica; su PUT da 403 y un huso inventado da 400', async ({ page, browser }) => {
  expect((await page.request.put('/api/me/horario', {
    data: { horario: JSON.parse(sqlLocal(`select horario_consulta::text from public.clinicas where id = ${CL}`)) as Record<string, unknown>, timezone: 'Marte/Olympus' },
  })).status()).toBe(400)
  expect(husoDe()).not.toBe('Marte/Olympus')
  await enContextoNuevo(browser, SESION.medicoA, async (p) => {
    const horario = JSON.parse(sqlLocal(`select horario_consulta::text from public.clinicas where id = ${CL}`)) as Record<string, unknown>
    expect((await p.request.put('/api/me/horario', { data: { horario, timezone: 'America/Tijuana' } })).status()).toBe(403)
    await p.goto(RUTA)
    await expect(p.getByRole('heading', { name: '¿Cuándo das consulta?' })).toBeVisible()
    await expect(p.getByText('Paso 1 de 3 · menos de 2 minutos')).toBeVisible()
    await expect(p.getByRole('heading', { name: 'Horario de la clínica' })).toHaveCount(0)
    await expect(p.getByRole('button', { name: 'Atrás' })).toHaveCount(0)
  })
  await enContextoNuevo(browser, SESION.secretariaA, async (p) => {
    const horario = JSON.parse(sqlLocal(`select horario_consulta::text from public.clinicas where id = ${CL}`)) as Record<string, unknown>
    expect((await p.request.put('/api/me/horario', { data: { horario, timezone: 'America/Tijuana' } })).status()).toBe(403)
  })
  expect(husoDe()).not.toBe('America/Tijuana')
})

/* ── 14 · «Tu enlace» se pausa, no se revoca ─────────────────────────── */

/** Lo que ve alguien de fuera con un código: la página, los turnos y la reserva (status y cuerpo). */
async function deFuera(esc: Escenario, codigo: string, inicio: string): Promise<string> {
  const ctx = await api()
  try {
    const pagina = (await ctx.get(`/reservar/${codigo}`)).status()
    const t = await ctx.get(`/api/reservar/${codigo}/turnos?consultorio=${esc.consultorioId}&tipo=${esc.tipoId}&desde=${inicio.slice(0, 10)}`)
    const r = await reservar(esc, codigo, { inicio, persona: personaNueva(), soloTecleado: true })
    return JSON.stringify({ pagina, turnos: [t.status(), await t.json().catch(() => null)], reserva: [r.status, r.cuerpo] })
  } finally {
    await ctx.dispose()
  }
}

test('14 · apagar «Tu enlace» lo pausa sin preguntar: fuera responde como un enlace que no existe; al prenderlo, la misma dirección; «Cambiar por uno nuevo» sí lo revoca', async ({ page }) => {
  const esc = prepararEscenario()
  const { id, codigo } = emitirEnlace(esc, 'fijo')
  limpiezas.push(sinPendientesAgenda(CORREO.adminA, { conEnlace: false }))
  const inicio = (await turnosLibres(esc, codigo))[0]?.inicio ?? ''
  expect(inicio).not.toBe('')
  const inexistente = codigoDeEnlace(randomUUID()) ?? ''
  const fila = () => sqlLocal(`select (pausado_en is not null) || '|' || (revocado_en is not null) from public.reserva_enlaces where id = :'id'`, { id })
  const desde = sqlLocal('select now()')

  await page.goto(RUTA)
  await pestanaConfig(page, 'Tu enlace')
  const panel = page.getByRole('tabpanel', { name: 'Tu enlace' })
  await expect(panel.locator('[data-enlace-fijo]')).toHaveText(new RegExp(`/reservar/${codigo}$`))
  await panel.getByRole('switch', { name: /^Prendido/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(panel.getByRole('switch', { name: /^Apagado/ })).toHaveAttribute('aria-checked', 'false')
  await expect(panel.locator('[data-enlace-fijo]')).toHaveCount(0)
  await expect(panel.locator('[data-enlace-pausado]')).toBeVisible()
  expect(fila()).toBe('true|false')
  expect(sqlLocal(`select count(*) > 0 from public.audit_log where tabla = 'reserva_enlaces' and registro_id = :'id' and accion = 'UPDATE'
    and created_at >= :'d'::timestamptz`, { id, d: desde })).toBe('t')

  // Fuera, pausado = no existe: la misma página (404), los mismos turnos y la misma reserva rechazada; nada dice «pausado».
  const pausado = await deFuera(esc, codigo, inicio)
  expect(pausado).toBe(await deFuera(esc, inexistente, inicio))
  expect(JSON.parse(pausado).pagina).toBe(404)
  expect(pausado).not.toMatch(/pausad|apagad/i)

  await panel.getByRole('switch', { name: /^Apagado/ }).click()
  await expect(panel.locator('[data-enlace-fijo]')).toHaveText(new RegExp(`/reservar/${codigo}$`))
  expect(fila()).toBe('false|false')
  const ctx = await api()
  expect((await ctx.get(`/reservar/${codigo}`)).status()).toBe(200)
  await ctx.dispose()

  await panel.getByRole('button', { name: 'Cambiar por uno nuevo' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Aceptar' }).click()
  await expect(panel.locator('[data-enlace-fijo]')).not.toHaveText(new RegExp(`/reservar/${codigo}$`))
  expect(fila()).toBe('false|true')
})

test('14 · pausar y reanudar: sólo el fijo, sin fecha del navegador, y la médica invitada no alcanza el de otro', async ({ page, browser }) => {
  const esc = prepararEscenario()
  const { id } = emitirEnlace(esc, 'fijo')
  const unico = emitirEnlace(esc, 'unico')
  expect((await page.request.patch(`/api/agenda/enlaces/${unico.id}`, { data: { accion: 'pausar' } })).status()).toBe(404)
  expect((await page.request.patch(`/api/agenda/enlaces/${id}`, { data: { accion: 'pausar', pausado_en: '2099-01-01' } })).status()).toBe(400)
  await enContextoNuevo(browser, SESION.medicoA, async (p) => {
    expect((await p.request.patch(`/api/agenda/enlaces/${id}`, { data: { accion: 'pausar' } })).status()).toBe(404)
  })
  expect(sqlLocal(`select (pausado_en is null)::text from public.reserva_enlaces where id = :'id'`, { id })).toBe('true')
  const r = await page.request.patch(`/api/agenda/enlaces/${id}`, { data: { accion: 'pausar' } })
  expect(r.status()).toBe(200)
  expect(((await r.json()) as { enlace: { pausado_en: string | null } }).enlace.pausado_en).not.toBeNull()
  const lista = (await (await page.request.get('/api/agenda/enlaces')).json()) as { enlaces: { id: string; pausado_en: string | null }[] }
  expect(lista.enlaces.find(e => e.id === id)?.pausado_en).not.toBeNull()
  expect((await page.request.patch(`/api/agenda/enlaces/${id}`, { data: { accion: 'reanudar' } })).status()).toBe(200)
  expect(sqlLocal(`select (pausado_en is null)::text from public.reserva_enlaces where id = :'id'`, { id })).toBe('true')
})

/* ── 13 · las pestañas en computadora: texto, sin título aparte ──────── */

test('13 · en computadora las pestañas llevan su texto y no hay título debajo', async ({ page }) => {
  limpiezas.push(sinPendientesAgenda(CORREO.adminA))
  await page.goto(RUTA)
  const lista = page.getByRole('tablist', { name: 'Secciones de la configuración' })
  await expect(lista.getByRole('tab', { name: 'Cuándo das consulta' })).toHaveText('Cuándo das consulta')
  await expect(page.locator('[data-titulo-pestana]')).toBeHidden()
})
})

/* ── 13 · las pestañas en el teléfono ───────────────────────────────── */

const NOMBRES = ['Tu enlace', 'Cuándo das consulta', 'Tu consulta', 'Avisos', 'Más opciones']

test.describe('teléfono', () => {
  test.beforeEach(({}, testInfo) => { test.skip(testInfo.project.name !== 'telefono', 'específica del teléfono') })

  for (const ancho of [390, 320]) {
    test(`13 · a ${ancho} px las cinco pestañas son iconos con nombre, caben sin desplazamiento y el título dice la elegida`, async ({ page }) => {
      limpiezas.push(sinPendientesAgenda(CORREO.adminA))
      await page.setViewportSize({ width: ancho, height: 800 })
      await page.goto(RUTA)
      const lista = page.getByRole('tablist', { name: 'Secciones de la configuración' })
      const pestanas = lista.getByRole('tab')
      await expect(pestanas).toHaveCount(5)
      for (const [i, nombre] of NOMBRES.entries()) {
        await expect(pestanas.nth(i)).toHaveAccessibleName(nombre)
        await expect(pestanas.nth(i).locator('svg')).toBeVisible()
        await expect(pestanas.nth(i)).not.toContainText(nombre, { useInnerText: true })
      }
      expect(await lista.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
      const titulo = page.locator('[data-titulo-pestana]')
      await expect(titulo).toHaveText('Tu enlace')
      // Teclado intacto: la flecha pasa a la siguiente, con el foco, y el título la sigue.
      await pestanas.nth(0).focus()
      await page.keyboard.press('ArrowRight')
      await expect(pestanas.nth(1)).toBeFocused()
      await expect(pestanas.nth(1)).toHaveAttribute('aria-selected', 'true')
      await expect(titulo).toHaveText('Cuándo das consulta')
      await pestanas.nth(3).click()
      await expect(titulo).toHaveText('Avisos')
      await expect(page.locator('#config-panel-avisos')).toBeVisible()
    })
  }
})
