/**
 * scripts/local/avisos-realtime-rls.mjs — ¿Realtime entrega los avisos SÓLO a quien la RLS deja leerlos?
 * (Avisos globales, M1: avisos_clinica entra en la publicación supabase_realtime.)
 *
 * ⚠️ SOLO LOCAL: aborta si NEXT_PUBLIC_SUPABASE_URL no apunta a 127.0.0.1 o localhost. Necesita el
 * stack local, la semilla (scripts/agenda-semilla.ts) y M1 aplicada. No toca nada fuera de la base local.
 *
 *   node --env-file=.env.local scripts/local/avisos-realtime-rls.mjs
 *
 * Abre una sesión por usuario de la semilla, cada una suscrita a los cambios de avisos_clinica, y
 * escribe como postgres (docker exec): un aviso de toda la clínica sobre una cita del administrador
 * de A y un aviso DIRIGIDO a la médica invitada de A. Imprime quién recibió cada uno y sale con 1
 * si alguien recibió lo que la RLS no le deja leer. Borra lo que sembró.
 */
import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL_SB)) throw new Error('CANDADO: la URL de Supabase no es local. No se toca nada.')

const USUARIOS = ['admin.b', 'secretaria.a', 'medico.a', 'admin.a']
const sql = (texto) => execFileSync('docker', ['exec', '-i', 'supabase_db_app_ortointegra', 'psql', '-U', 'postgres', '-qAt', '-v', 'ON_ERROR_STOP=1'], { input: texto, encoding: 'utf8' }).trim()
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

const recibidos = Object.fromEntries(USUARIOS.map((u) => [u, new Set()]))
const clientes = []
for (const u of USUARIOS) {
  const c = createClient(URL_SB, ANON, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email: `${u}@semilla.spinus.test`, password: 'Semilla-Agenda-2026' })
  if (error) throw new Error(`sin sesión de ${u}: ${error.message}`)
  await new Promise((listo, mal) => {
    c.channel(`avisos-prueba-${u}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avisos_clinica' }, (p) => recibidos[u].add(p.new?.tipo ?? p.eventType))
      .subscribe((estado) => { if (estado === 'SUBSCRIBED') listo(); else if (estado !== 'CLOSED') mal(new Error(`${u}: ${estado}`)) })
  })
  clientes.push(c)
}
await espera(1500)

const CL = `(select id from public.clinicas where nombre = 'Clínica Semilla A')`
const ids = sql(`
  with adm as (select id from auth.users where email = 'admin.a@semilla.spinus.test'),
       inv as (select id from auth.users where email = 'medico.a@semilla.spinus.test'),
       c as (select a.id from public.appointments a, adm where a.clinica_id = ${CL} and a.medico_id = adm.id and a.paciente_id is not null limit 1),
       uno as (insert into public.avisos_clinica (clinica_id, tipo, cita_id) select ${CL}, 'cancelacion_paciente', c.id from c returning id),
       dos as (insert into public.avisos_clinica (clinica_id, tipo, medico_id, destinatario_id, actor_id, datos)
               select ${CL}, 'personal_bloqueo', inv.id, inv.id, adm.id, '{}'::jsonb from inv, adm returning id)
  select string_agg(id::text, ',') from (select id from uno union all select id from dos) x;`)
await espera(4000)
sql(`delete from public.avisos_clinica where id in (${ids.split(',').map((i) => `'${i}'`).join(',')});`)
await espera(1500)

const ESPERADO = {
  'admin.a': ['cancelacion_paciente'],                 // ve la cita; el dirigido no es suyo (y además él es el actor)
  'medico.a': ['personal_bloqueo'],                    // sólo el dirigido a ella; la cita del administrador no la ve
  'secretaria.a': ['cancelacion_paciente'],            // ve la cita; el dirigido, no
  'admin.b': [],                                       // otra clínica: nada
}
let mal = false
for (const u of USUARIOS) {
  const altas = [...recibidos[u]].filter((t) => t !== 'DELETE').sort()
  const ok = JSON.stringify(altas) === JSON.stringify(ESPERADO[u])
  if (!ok) mal = true
  console.log(`${ok ? 'OK     ' : 'REVISAR'} ${u.padEnd(13)} recibió [${altas.join(', ')}]  esperado [${ESPERADO[u].join(', ')}]  · DELETE recibido: ${recibidos[u].has('DELETE')}`)
}
await Promise.all(clientes.map((c) => c.removeAllChannels()))
process.exit(mal ? 1 : 0)
