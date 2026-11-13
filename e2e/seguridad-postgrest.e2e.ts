import { test, expect } from '@playwright/test'
import { createHash, randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { CORREO, SESION, interruptorAgenda, soloEscritorio, sqlLocal } from './ayudas'
import { crearCitaPorLigar, limpiarReservasE2e } from './reservaAyudas'

/**
 * Correcciones de seguridad en la base (puntos 3, 4 y 7a de Angel), probadas
 * por el camino que cerraban: PostgREST DIRECTO con la sesión de un usuario de
 * la semilla (anon key + JWT de `signInWithPassword`), sin pasar por la API.
 *
 *   · 3: con v2 encendida, ni una cita con paciente ni una por ligar se borran
 *     (42501); la API sigue dando su 409; con v2 apagada se borra como hoy.
 *   · 4: la sesión no escribe columnas `reserva_*` (ni al crear ni al editar),
 *     salvo vaciar teléfono y correo.
 *   · 7a: la sesión no emite un enlace con un hash elegido (ni INSERT ni la
 *     RPC del servidor); la API sí lo emite, con el hash del código que calcula.
 *
 * Las pruebas SQL (`supabase/pruebas-sql/seg_*.sql`) cubren los casos uno por
 * uno; esto comprueba que PostgREST llega a la base con el rol que creemos.
 * Lo que se crea se borra al terminar como `postgres`.
 */
config({ path: resolve(process.cwd(), '.env.local'), quiet: true })
soloEscritorio()
test.use({ storageState: SESION.adminA })

const CONTRASENA_SEMILLA = 'Semilla-Agenda-2026'
const TITULO = 'E2E seg PostgREST'

async function sesionPostgrest(correo: string): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) throw new Error('sesionPostgrest: sólo contra la Supabase local')
  const sb = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', { auth: { persistSession: false } })
  const { error } = await sb.auth.signInWithPassword({ email: correo, password: CONTRASENA_SEMILLA })
  if (error) throw new Error(`signInWithPassword: ${error.message}`)
  return sb
}

const idDe = (correo: string): string => sqlLocal(`select id from auth.users where email = :'c'`, { c: correo })
const clinicaA = (): string => sqlLocal(`select id from public.clinicas where nombre = 'Clínica Semilla A'`)
const existe = (id: string): string => sqlLocal(`select count(*) from public.appointments where id = :'id'`, { id })
const enDias = (d: number): string => new Date(Date.now() + d * 86_400_000).toISOString()

/** Una cita con paciente de admin.a, creada como `postgres`. */
function citaConPaciente(): string {
  const id = randomUUID()
  sqlLocal(`
    insert into public.appointments (id, clinica_id, medico_id, paciente_id, title, start_time, end_time)
    select :'id'::uuid, p.clinica_id, p.id,
           (select pa.id from public.pacientes pa where pa.clinica_id = p.clinica_id order by pa.id limit 1),
           :'t', :'ini'::timestamptz, :'ini'::timestamptz + interval '30 minutes'
      from public.profiles p where p.id = :'m'::uuid;`, { id, t: TITULO, ini: enDias(20), m: idDe(CORREO.adminA) })
  return id
}

test.afterEach(() => {
  sqlLocal(`delete from public.appointments where title = :'t'`, { t: TITULO })
  limpiarReservasE2e()
  interruptorAgenda('A', false)
})

test('punto 3: con v2 encendida PostgREST no borra una cita con paciente ni una por ligar', async ({ page }) => {
  interruptorAgenda('A', true)
  const sb = await sesionPostgrest(CORREO.adminA)
  const conPaciente = citaConPaciente()
  const porLigar = crearCitaPorLigar({ correo: CORREO.adminA, inicio: enDias(21), minutos: 30, nombre: TITULO, canal: 'fijo' })

  for (const id of [conPaciente, porLigar.citaId]) {
    const { error } = await sb.from('appointments').delete().eq('id', id)
    expect(error?.code).toBe('42501')
    expect(existe(id)).toBe('1')
  }
  expect((await page.request.delete(`/api/appointments/${conPaciente}`)).status()).toBe(409)

  interruptorAgenda('A', false)
  const { error } = await sb.from('appointments').delete().eq('id', conPaciente)
  expect(error).toBeNull()
  expect(existe(conPaciente)).toBe('0')
})

test('punto 4: PostgREST no escribe reserva_* y sí vacía teléfono y correo', async () => {
  interruptorAgenda('A', true)
  const sb = await sesionPostgrest(CORREO.adminA)
  const c = crearCitaPorLigar({ correo: CORREO.adminA, inicio: enDias(22), minutos: 30, nombre: TITULO, canal: 'fijo' })

  const cambio = await sb.from('appointments').update({ reserva_nombre: 'Otra persona' }).eq('id', c.citaId)
  expect(cambio.error?.code).toBe('42501')
  const alta = await sb.from('appointments').insert({
    clinica_id: clinicaA(), medico_id: c.medicoId, title: TITULO, start_time: enDias(23), end_time: enDias(23.02),
    reserva_reagendados: 5,
  })
  expect(alta.error?.code).toBe('42501')

  const vaciar = await sb.from('appointments').update({ reserva_telefono: null, reserva_correo: null }).eq('id', c.citaId)
  expect(vaciar.error).toBeNull()
  expect(sqlLocal(`select coalesce(reserva_telefono, '-') || '|' || coalesce(reserva_correo, '-') || '|' || reserva_nombre
                     from public.appointments where id = :'id'`, { id: c.citaId })).toBe(`-|-|${TITULO}`)
})

test('punto 7a: PostgREST no emite un enlace con un hash elegido; la API sí', async ({ page }) => {
  interruptorAgenda('A', true)
  const sb = await sesionPostgrest(CORREO.adminA)
  const medico = idDe(CORREO.adminA)
  const elegido = createHash('sha256').update('codigo-elegido-e2e').digest('hex')

  const directo = await sb.from('reserva_enlaces').insert({
    id: randomUUID(), clinica_id: clinicaA(), medico_id: medico, clase: 'unico', codigo_hash: elegido,
  })
  expect(directo.error?.code).toBe('42501')
  const rpc = await sb.rpc('reserva_enlace_emitir', {
    p_clinica_id: clinicaA(), p_actor: medico, p_id: randomUUID(), p_medico_id: medico,
    p_clase: 'unico', p_codigo_hash: elegido, p_etiqueta: null,
  })
  expect(['42501', 'PGRST202']).toContain(rpc.error?.code)
  expect(sqlLocal(`select count(*) from public.reserva_enlaces where codigo_hash = :'h'`, { h: elegido })).toBe('0')

  const res = await page.request.post('/api/agenda/enlaces', { data: { clase: 'unico', medico_id: medico, etiqueta: 'E2E seg' } })
  expect(res.status()).toBe(201)
  const cuerpo = await res.json() as { enlace: { id: string }; codigo: string }
  const hashDelCodigo = createHash('sha256').update(cuerpo.codigo, 'utf8').digest('hex')
  expect(sqlLocal(`select codigo_hash || '|' || created_by from public.reserva_enlaces where id = :'id'`, { id: cuerpo.enlace.id }))
    .toBe(`${hashDelCodigo}|${medico}`)
})
