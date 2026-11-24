import { test, expect, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { DIA_FUTURO_FIJO, SESION, interruptorAgenda, soloEscritorio, sqlLocal, tituloUnico, toastConTexto } from './ayudas'
import { abrirAgendaV2, tarjetaLectura } from './interaccionesAyudas'
import { ipAlAzar } from './reservaPublicaAyudas' // además carga .env.local (RESERVA_SECRETO)
import { codigoDeConfirmacion, hashDeCodigo } from '../src/lib/reserva/secretos'
import { ANOTACION_A_PROPOSITO } from './guardaAsistencia'

/**
 * L5 · la campana de la agenda v2 (puntos 13 y 14 de Angel), con el
 * interruptor encendido en la Clínica Semilla A:
 *   13. el paciente confirma su cita desde su enlace (el POST de verdad de
 *       `/api/confirmar/<código>`) → con la agenda abierta, un emergente SIN
 *       nombre y, en «Avisos», «[Nombre] confirmó su cita del [día] a las
 *       [hora]» que lleva a su cita. Un segundo POST y una recarga no crean
 *       otro; la confirmación del personal (el PUT de la tarjeta) no crea
 *       ninguno. La regla de la base, en `l5_aviso_confirmacion.sql`;
 *   14. la burbuja sigue al aviso nuevo sin recargar (la cita sale de «Por
 *       confirmar», el aviso entra en «Avisos») y dice el total (el número con
 *       datos inventados —1, 3, «9+», nada— va en la prueba 19 de H4).
 *
 * MUTACIONES que lo ponen en rojo (comprobadas): sin el disparador de la
 * migración (no hay aviso); `confirmacion_paciente` fuera de `TIPOS_AVISO`
 * (la ruta lo salta) o de `EMERGENTES` (no hay emergente); `cambioPuedeAvisar`
 * sin la rama de «confirmada» (el aviso no llega sin recargar).
 */
test.describe.configure({ mode: 'serial' })
soloEscritorio()
test.use({ storageState: SESION.adminA })

const TZ = 'America/Merida'
const CL = `(select id from public.clinicas where nombre = 'Clínica Semilla A')`
/** El de `src/lib/avisos/avisosServidor.ts` (no se importa: arrastraría el logger y el cliente). */
const TOPE_AVISOS = 50
const citas: string[] = []
const pacientes: string[] = []

test.beforeAll(() => { interruptorAgenda('A', true) })

/* AG-DT-256 · lo que crea cada prueba se borra al terminar ESA prueba: la de 13 y 14 necesita una cita de
   MAÑANA (entra en «Por confirmar»), que de lunes a viernes es de la semana visible; la guarda la perdona
   (anotación) porque al acabar la prueba ya no está. */
test.afterEach(() => {
  if (citas.length === 0) return
  sqlLocal(`
    begin;
    set local session_replication_role = replica;
    create temp table _c on commit drop as select unnest(string_to_array(:'citas', ','))::uuid as id;
    delete from public.cita_confirmaciones where appointment_id in (select id from _c);
    delete from public.avisos_clinica where cita_id in (select id from _c);
    delete from public.appointments where id in (select id from _c);
    delete from public.pacientes where id = any(string_to_array(:'pacientes', ',')::uuid[]);
    commit;`, { citas: citas.join(','), pacientes: pacientes.join(',') })
  citas.length = 0
  pacientes.length = 0
})
test.afterAll(() => { interruptorAgenda('A', false) }) // quien lo enciende, lo apaga (global-setup)

/** Una cita de MAÑANA (o de `fecha`) en Centro con su paciente y su enlace de confirmación (copia de la de I5). */
function citaDeManana(hora: string, nombre: string, fecha = ''): { cita: string; codigo: string } {
  const enlace = randomUUID()
  const codigo = codigoDeConfirmacion(enlace)
  if (!codigo) throw new Error('Falta RESERVA_SECRETO en .env.local')
  const salida = sqlLocal(`
    with p as (insert into public.pacientes (clinica_id, nombre, apellidos, telefono, email)
               values (${CL}, :'nombre', 'L5', '9990000156', 'l5.e2e@semilla.spinus.test') returning id),
         co as (select id, medico_id, nombre, timezone from public.consultorios
                 where clinica_id = ${CL} and nombre = 'Consultorio Centro (ficticio)'),
         d as (select (coalesce(nullif(:'fecha', '')::date, (now() at time zone :'tz')::date + 1) + :'hora'::time) at time zone :'tz' as t),
         a as (insert into public.appointments (clinica_id, paciente_id, medico_id, consultorio_id, title, start_time, end_time,
                                                status, all_day, consultorio_nombre, consultorio_timezone, origen)
               select ${CL}, (select id from p), co.medico_id, co.id, :'nombre' || ' L5', d.t, d.t + interval '30 min',
                      'scheduled', false, co.nombre, co.timezone, 'spinus' from co, d returning id, paciente_id)
    insert into public.cita_confirmaciones (id, clinica_id, appointment_id, codigo_hash, paciente_id)
    select :'enlace', ${CL}, a.id, :'hash', a.paciente_id from a
    returning appointment_id || '|' || paciente_id;`, { nombre, tz: TZ, hora, enlace, hash: hashDeCodigo(codigo), fecha })
  const [cita = '', paciente = ''] = salida.split('|')
  citas.push(cita)
  pacientes.push(paciente)
  return { cita, codigo }
}

/** Confirma como el paciente: el POST del formulario de su enlace, sin sesión. */
async function confirmarComoPaciente(ctx: APIRequestContext, base: string, codigo: string): Promise<void> {
  const r = await ctx.post(`/api/confirmar/${codigo}`, { form: { accion: 'confirmar' }, headers: { origin: base }, maxRedirects: 0 })
  expect(r.status()).toBe(303)
}

function avisosDe(cita: string): string {
  return sqlLocal(`select tipo || ':' || count(*) from public.avisos_clinica where cita_id = :'c' group by tipo order by tipo`, { c: cita })
}

/** «del jueves, 19 de noviembre a las 07:20», como lo escribe el aviso (zona del consultorio). */
function delDia(hora: string): string {
  const manana = new Date(`${new Date().toLocaleDateString('en-CA', { timeZone: TZ })}T12:00:00Z`)
  manana.setUTCDate(manana.getUTCDate() + 1)
  const dia = new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(manana)
  return `del ${dia} a las ${hora}`
}

const campana = (page: Page): Locator => page.locator('[data-campana]').first()
const panel = (page: Page): Locator => page.getByRole('dialog', { name: 'Por confirmar y avisos' })
const avisoEn = (page: Page, cita: string): Locator => page.locator(`[data-aviso-tipo="confirmacion_paciente"][data-aviso-cita="${cita}"]`)

async function abrirAvisos(page: Page): Promise<void> {
  await campana(page).click()
  await expect(panel(page)).toBeVisible()
  await panel(page).getByRole('tab', { name: /^Avisos/ }).click()
}

/** Lo que la campana dice que hay en cada pestaña, leído de su nombre accesible. */
async function cuentas(page: Page): Promise<{ n: number; m: number }> {
  const etiqueta = (await campana(page).getAttribute('aria-label')) ?? ''
  const [, n = '-1', m = '-1'] = /^Por confirmar \((\d+)\) y avisos \((\d+)\)/.exec(etiqueta) ?? []
  return { n: Number(n), m: Number(m) }
}
const etiquetaDe = ({ n, m }: { n: number; m: number }): string =>
  `Por confirmar (${n}) y avisos (${m})${n + m > 0 ? `: ${n + m} ${n + m === 1 ? 'pendiente' : 'pendientes'}` : ''}`

test('13 y 14: el paciente confirma por su enlace → emergente y aviso con su nombre, la burbuja lo sigue; uno solo', { annotation: { type: ANOTACION_A_PROPOSITO, description: 'cita de mañana; la borra el afterEach' } }, async ({ page, playwright, baseURL }) => {
  const base = baseURL ?? ''
  const nombre = tituloUnico('Paciente L5 Confirma')
  const { cita, codigo } = citaDeManana('07:20', nombre)
  await abrirAgendaV2(page)
  await expect(campana(page)).toHaveAttribute('aria-label', /^Por confirmar \(\d+\) y avisos \(\d+\)/)
  // La cita es de mañana y está agendada: entra en «Por confirmar».
  await expect.poll(async () => (await cuentas(page)).n).toBeGreaterThan(0)
  const antes = await cuentas(page)

  const ctx = await playwright.request.newContext({ baseURL: base, extraHTTPHeaders: { 'x-forwarded-for': ipAlAzar() } })
  try {
    await confirmarComoPaciente(ctx, base, codigo)
    // El emergente, con el nombre (decisión de Angel, 2026-11-24), el día y la hora del consultorio.
    const emergente = toastConTexto(page, `${nombre} L5 confirmó su cita ${delDia('07:20')}.`)
    await expect(emergente).toBeVisible({ timeout: 15000 })
    // La burbuja, sin recargar: la cita sale de «Por confirmar» y su aviso entra en «Avisos»
    // (el total no cambia; el desglose, sí), y la burbuja dice ese total.
    // «Avisos» lista como mucho TOPE_AVISOS (50, los más nuevos): en una base con muchos, el nuevo
    // entra y el más viejo sale, y la cuenta se queda en 50.
    const despues = { n: antes.n - 1, m: Math.min(antes.m + 1, TOPE_AVISOS) }
    await expect(campana(page)).toHaveAttribute('aria-label', etiquetaDe(despues), { timeout: 10000 })
    await expect(campana(page).locator('[data-punto-rojo]')).toHaveText(despues.n + despues.m > 9 ? '9+' : String(despues.n + despues.m))
    await abrirAvisos(page)
    await expect(avisoEn(page, cita)).toHaveText(new RegExp(`${nombre} L5 confirmó su cita ${delDia('07:20')}`))
    await expect(page.locator(`[data-fila-por-confirmar="${cita}"]`)).toHaveCount(0)
    await page.keyboard.press('Escape')

    // Un segundo POST (el paciente vuelve a pulsar) no crea otro aviso, ni sube la cuenta.
    await confirmarComoPaciente(ctx, base, codigo)
    await page.waitForTimeout(1500)
    expect(avisosDe(cita)).toBe('confirmacion_paciente:1')
    await expect(campana(page)).toHaveAttribute('aria-label', etiquetaDe(despues))
  } finally {
    await ctx.dispose()
  }

  // Recargar: el aviso sigue (sin revisar), una sola vez.
  await abrirAgendaV2(page)
  await abrirAvisos(page)
  await expect(avisoEn(page, cita)).toHaveCount(1)
  expect(avisosDe(cita)).toBe('confirmacion_paciente:1')

  // Pulsarlo lleva a su cita (la tarjeta) y lo da por revisado.
  await avisoEn(page, cita).click()
  await expect(panel(page)).toHaveCount(0)
  await expect(tarjetaLectura(page)).toBeVisible({ timeout: 10000 })
  await expect.poll(() => sqlLocal(`select bool_and(revisado_en is not null)::text from public.avisos_clinica where cita_id = :'c'`, { c: cita })).toBe('true')
})

test('13: la confirmación marcada por el personal no genera aviso', async ({ page }) => {
  // AG-DT-256: no hace falta que sea de mañana (no mira «Por confirmar»): a la semana siguiente.
  const { cita } = citaDeManana('07:35', tituloUnico('Paciente L5 Personal'), DIA_FUTURO_FIJO)
  await abrirAgendaV2(page)
  const r = await page.request.put(`/api/appointments/${cita}`, { data: { status: 'confirmed', client_id: randomUUID() } })
  expect(r.ok()).toBe(true)
  await page.waitForTimeout(1500)
  expect(sqlLocal(`select status from public.appointments where id = :'c'`, { c: cita })).toBe('confirmed')
  expect(avisosDe(cita)).toBe('')
  await expect(toastConTexto(page, 'confirmó su cita')).toHaveCount(0)
})
