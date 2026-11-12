import { test, expect, request } from '@playwright/test'
import { randomInt } from 'node:crypto'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { interruptorAgenda, sqlLocal, soloEscritorio } from './ayudas'
import { contarCorreos, esperarCorreo } from './mailpit'

/**
 * Recordatorio por correo (agenda E4, plan_E.md E10 caso 1). La tarea
 * programada se dispara a mano con el `CRON_SECRET` del servidor local; el
 * correo se lee de Mailpit (EMAIL_TRANSPORT=captura), nunca sale.
 *
 * Requiere en .env.local: EMAIL_TRANSPORT=captura, RESERVA_SECRETO y un
 * CRON_SECRET SÓLO DE PRUEBA (sin él, el archivo se salta: la ruta daría 401).
 * La semilla: la clínica A con su administrador y algún paciente.
 *
 * ESCRITA, NO CORRIDA en E4 (otro agente usa el servidor local a la vez).
 */
config({ path: resolve(process.cwd(), '.env.local'), quiet: true })

const BASE_URL = 'http://localhost:3001'
const CRON = process.env.CRON_SECRET ?? ''
const ASUNTO = 'Recordatorio: tu cita del'

test.describe.configure({ mode: 'serial' })
soloEscritorio()
test.skip(CRON === '', 'Falta CRON_SECRET (sólo de prueba) en .env.local')

interface Fixture { clinicaId: string; medicoId: string; pacienteId: string; correo: string }
let f: Fixture
const citas: string[] = []

/** Un correo único por corrida para el paciente de la prueba, y lo restablece al terminar. */
function prepararPaciente(): Fixture {
  const correo = `recordatorio-${Date.now().toString(36)}${randomInt(0, 1e6).toString(36)}@e4.test`
  const fila = sqlLocal(`
    with c as (select id from public.clinicas where nombre = 'Clínica Semilla A'),
         m as (select p.id from public.profiles p where p.clinica_id = (select id from c) and p.es_admin_de_clinica limit 1),
         p as (select id from public.pacientes where clinica_id = (select id from c) and activo order by created_at limit 1)
    select (select id from c), (select id from m), (select id from p);`)
  const [clinicaId = '', medicoId = '', pacienteId = ''] = fila.split('|')
  sqlLocal(`update public.pacientes set email = :'correo' where id = :'id';`, { correo, id: pacienteId })
  sqlLocal(`update public.agenda_ajustes set recordatorio_horas = 24 where clinica_id = :'c';`, { c: clinicaId })
  return { clinicaId, medicoId, pacienteId, correo }
}

/** Una cita a ahora + `horas`, como postgres (lo que se prueba es la tarea, no el alta). */
function cita(horas: number, extra: { paciente?: string | null; status?: string } = {}): string {
  const id = sqlLocal(`
    insert into public.appointments (clinica_id, paciente_id, medico_id, title, start_time, end_time, status, all_day,
                                     consultorio_timezone, consultorio_nombre, consultorio_direccion, consultorio_telefono, notes)
    values (:'c', nullif(:'p', ''), :'m', 'TITULO CLINICO SECRETO',
            date_trunc('minute', now()) + make_interval(hours => :'h'::int),
            date_trunc('minute', now()) + make_interval(hours => :'h'::int, mins => 30),
            :'s', false, 'America/Mexico_City', 'Consultorio E4', 'Calle E4 1', '5550000004', 'NOTA CLINICA SECRETA')
    returning id;`, {
    c: f.clinicaId, m: f.medicoId, p: extra.paciente === null ? '' : (extra.paciente ?? f.pacienteId), h: String(horas),
    s: extra.status ?? 'scheduled',
  })
  citas.push(id)
  return id
}

async function dispararTarea(): Promise<number> {
  const ctx = await request.newContext({ baseURL: BASE_URL })
  const r = await ctx.get('/api/cron/recordatorios', { headers: { authorization: `Bearer ${CRON}` } })
  const status = r.status()
  expect(await r.json()).toEqual({ ok: true })
  await ctx.dispose()
  return status
}

test.beforeAll(() => {
  interruptorAgenda('A', true)
  f = prepararPaciente()
})
test.afterAll(() => {
  // Las filas de E1 y E4 tienen FK RESTRICT a la cita y el rol de servicio no puede borrarlas.
  if (citas.length) {
    sqlLocal(`
      delete from public.cita_correos where appointment_id = any (string_to_array(:'ids', ',')::uuid[]);
      delete from public.cita_confirmaciones where appointment_id = any (string_to_array(:'ids', ',')::uuid[]);
      delete from public.appointments where id = any (string_to_array(:'ids', ',')::uuid[]);`, { ids: citas.join(',') })
  }
  interruptorAgenda('A', false)
})

test('la ruta sin secreto da 401 sin cuerpo', async () => {
  const ctx = await request.newContext({ baseURL: BASE_URL })
  const r = await ctx.get('/api/cron/recordatorios')
  expect(r.status()).toBe(401)
  expect(await r.text()).toBe('')
  await ctx.dispose()
})

test('una cita a +5 h con paciente con correo: UN correo con el enlace y sin nada clínico; repetir no manda otro', async () => {
  const id = cita(5)
  const previos = await contarCorreos(f.correo, ASUNTO)
  expect(await dispararTarea()).toBe(200)
  const correo = await esperarCorreo(f.correo, ASUNTO, previos)
  expect(correo.texto).toMatch(/\/confirmar\/[A-Za-z0-9_-]{22}/)
  expect(correo.texto).toContain('Consultorio E4')
  for (const prohibido of ['TITULO CLINICO', 'NOTA CLINICA', 'Consulta:']) {
    expect(correo.texto).not.toContain(prohibido)
    expect(correo.html).not.toContain(prohibido)
  }
  expect(sqlLocal(`select estado from public.cita_correos where appointment_id = :'id';`, { id })).toBe('enviado')
  await dispararTarea()
  await new Promise(r => setTimeout(r, 1500))
  expect(await contarCorreos(f.correo, ASUNTO)).toBe(previos + 1)
})

test('evento sin paciente, cancelada o fuera de la ventana: ningún correo (todo el día: lo cubre e4_correos_cita.sql)', async () => {
  cita(6, { paciente: null })
  cita(6, { status: 'cancelled' })
  cita(30)
  const previos = await contarCorreos(f.correo, ASUNTO)
  await dispararTarea()
  await new Promise(r => setTimeout(r, 1500))
  expect(await contarCorreos(f.correo, ASUNTO)).toBe(previos)
})

test('con el interruptor apagado no sale nada', async () => {
  interruptorAgenda('A', false)
  const id = cita(7)
  const previos = await contarCorreos(f.correo, ASUNTO)
  await dispararTarea()
  await new Promise(r => setTimeout(r, 1500))
  expect(await contarCorreos(f.correo, ASUNTO)).toBe(previos)
  expect(sqlLocal(`select count(*) from public.cita_correos where appointment_id = :'id';`, { id })).toBe('0')
  interruptorAgenda('A', true)
})
