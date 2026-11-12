/**
 * Ayudas de las e2e de la reserva por enlace, LADO PÚBLICO (agenda D10). Las
 * usan `reserva-enlace.e2e.ts` y `reserva-candado.e2e.ts`. Las del lado
 * interno (D6/D7) viven en feature/agenda-v2-d6 con su propio
 * `reservaAyudas.ts`: nombre distinto a propósito, para que no choquen.
 *
 * ⚠️ SÓLO LOCAL. Preparan la base como `postgres` (`sqlLocal`) lo que en
 * producción hace Angel o el personal: encender el interruptor, aprobar el
 * aviso, emitir enlaces. Lo que se prueba (la página y la API públicas) va
 * siempre por HTTP contra :3001, sin sesión.
 *
 * Los enlaces se emiten por SQL con el código que deriva `codigoDeEnlace`
 * del `RESERVA_SECRETO` de `.env.local` (el mismo que usa el servidor): la
 * API del personal para emitirlos es de D6/D7 (otra rama) y lo que aquí se
 * prueba es la página pública, no la emisión.
 *
 * Cada petición pública sale de un contexto NUEVO con una IP inventada en
 * `x-forwarded-for` (en local se puede falsificar; en Vercel no, ver
 * `limitesReserva.ts`) y sin cookie de dispositivo, para que los límites de
 * una prueba no se coman los de la siguiente ni los de la corrida anterior
 * (`ip_rate_limits` sobrevive a la siembra).
 */
import { request, type APIRequestContext } from '@playwright/test'
import { randomUUID, randomInt } from 'node:crypto'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { sqlLocal, interruptorAgenda } from './ayudas'
import { desplazarFecha, hoyEnTZ } from '../src/lib/dates'
import { codigoDeEnlace, hashDeCodigo } from '../src/lib/reserva/secretos'
import { AVISO_VERSION, hashAviso } from '../src/lib/reserva/avisoReserva'
import { codigoDe, contarCorreos, esperarCorreo } from './mailpit'

config({ path: resolve(process.cwd(), '.env.local'), quiet: true })

const BASE_URL = 'http://localhost:3001'
export const CORREO_ADMIN_A = 'admin.a@semilla.spinus.test'

export interface Escenario {
  clinicaId: string
  medicoId: string
  consultorioId: string
  consultorioTelefono: string | null
  consultorioOtraClinica: string
  tipoId: string
  tipoNombre: string
}

export interface Turno { inicio: string; fin: string }

/** Una IP de documentación (TEST-NET-3) distinta en cada llamada. */
export function ipAlAzar(): string {
  return `203.0.${randomInt(0, 255)}.${randomInt(1, 254)}`
}

/** Un contexto de API nuevo, sin cookies, con su propia IP. */
export async function api(ip: string = ipAlAzar()): Promise<APIRequestContext> {
  return request.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { 'x-forwarded-for': ip } })
}

/** Una persona inventada y única por llamada. */
export function personaNueva(): { nombre: string; telefono: string; correo: string } {
  const sufijo = `${Date.now().toString(36)}${randomInt(0, 1e6).toString(36)}`
  return { nombre: `Reserva E2E ${sufijo}`, telefono: `55${String(randomInt(0, 1e8)).padStart(8, '0')}`, correo: `p-${sufijo}@reserva.test` }
}

/** Interruptor de A encendido, aviso aprobado con el hash del código, tipo de 30 min. */
export function prepararEscenario(): Escenario {
  interruptorAgenda('A', true)
  aprobarAviso(true)
  const tipoNombre = `Tipo E2E ${Date.now().toString(36)}`
  const fila = sqlLocal(`
    with c as (select id from public.clinicas where nombre = 'Clínica Semilla A'),
         m as (select p.id from public.profiles p join auth.users u on u.id = p.id where u.email = :'correo'),
         t as (insert into public.tipos_cita (clinica_id, medico_id, nombre, duracion_min, activo)
               select c.id, null, :'tipo', 30, true from c returning id),
         k as (select id, telefono from public.consultorios where medico_id = (select id from m) and activo
               order by es_default desc, nombre limit 1),
         b as (select co.id from public.consultorios co join public.clinicas cl on cl.id = co.clinica_id
               where cl.nombre = 'Clínica Semilla B' limit 1)
    select (select id from c), (select id from m), (select id from k), coalesce((select telefono from k), ''),
           (select id from b), (select id from t);`, { correo: CORREO_ADMIN_A, tipo: tipoNombre })
  const [clinicaId = '', medicoId = '', consultorioId = '', tel = '', otra = '', tipoId = ''] = fila.split('|')
  return { clinicaId, medicoId, consultorioId, consultorioTelefono: tel || null, consultorioOtraClinica: otra, tipoId, tipoNombre }
}

/** Aprueba (o retira la aprobación de) la versión vigente del aviso, con el hash del código. */
export function aprobarAviso(aprobado: boolean): void {
  sqlLocal(`
    insert into public.reserva_avisos (version, texto_sha256, aprobado, aprobado_en)
    values (:'v', :'sha', :'ap'::boolean, case when :'ap'::boolean then now() end)
    on conflict (version) do update set texto_sha256 = excluded.texto_sha256, aprobado = excluded.aprobado,
                                         aprobado_en = excluded.aprobado_en;`,
  { v: AVISO_VERSION, sha: hashAviso(), ap: String(aprobado) })
}

/** Emite un enlace por SQL y devuelve su código. Un fijo nuevo revoca el anterior (índice único). */
export function emitirEnlace(e: Escenario, clase: 'fijo' | 'unico'): { id: string; codigo: string } {
  const id = randomUUID()
  const codigo = codigoDeEnlace(id)
  if (!codigo) throw new Error('Falta RESERVA_SECRETO en .env.local')
  sqlLocal(`
    update public.reserva_enlaces set revocado_en = now()
     where :'clase' = 'fijo' and medico_id = :'medico' and clase = 'fijo' and revocado_en is null;
    insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash, vigencia_dias, caduca_en)
    values (:'id', :'clinica', :'medico', :'clase', :'hash',
            case when :'clase' = 'unico' then 7 end, case when :'clase' = 'unico' then now() + interval '7 days' end);`,
  { id, clinica: e.clinicaId, medico: e.medicoId, clase, hash: hashDeCodigo(codigo) })
  return { id, codigo }
}

/** Los turnos libres de 7 días desde dentro de una semana (lejos de la anticipación mínima). */
export async function turnosLibres(e: Escenario, codigo: string, desdeDias = 7): Promise<Turno[]> {
  const ctx = await api()
  try {
    const desde = desplazarFecha(hoyEnTZ('America/Merida'), { dias: desdeDias })
    const r = await ctx.get(`/api/reservar/${codigo}/turnos?consultorio=${e.consultorioId}&tipo=${e.tipoId}&desde=${desde}`)
    if (r.status() !== 200) throw new Error(`turnos ${r.status()}`)
    const datos: { dias: { fecha: string; turnos: Turno[] }[] } = await r.json()
    return datos.dias.flatMap(d => d.turnos)
  } finally {
    await ctx.dispose()
  }
}

export interface Envio { inicio: string; persona: { nombre: string; telefono: string; correo: string }; ficha?: string; clientId?: string }

/** POST de la reserva desde un contexto nuevo. */
export async function reservar(e: Escenario, codigo: string, envio: Envio, ctx?: APIRequestContext): Promise<{ status: number; cuerpo: Record<string, unknown> }> {
  const propio = ctx ?? await api()
  try {
    const r = await propio.post(`/api/reservar/${codigo}`, { data: {
      consultorio_id: e.consultorioId, tipo_cita_id: e.tipoId, inicio: envio.inicio, nombre: envio.persona.nombre,
      telefono: envio.persona.telefono, correo: envio.persona.correo, acepta_aviso: true, client_id: envio.clientId ?? randomUUID(),
      ...(envio.ficha ? { ficha: envio.ficha } : {}),
    } })
    return { status: r.status(), cuerpo: await r.json().catch(() => ({})) }
  } finally {
    if (!ctx) await propio.dispose()
  }
}

/** Pide el código, lo lee de MAILPIT y lo verifica. Devuelve la ficha. */
export async function verificarCorreo(codigo: string, correo: string): Promise<string> {
  const ctx = await api()
  try {
    const previos = await contarCorreos(correo, 'Tu código para reservar')
    const pedido = await ctx.post(`/api/reservar/${codigo}/codigo`, { data: { correo } })
    if (pedido.status() !== 200) throw new Error(`codigo ${pedido.status()}`)
    const mensaje = await esperarCorreo(correo, 'Tu código para reservar', previos)
    const r = await ctx.post(`/api/reservar/${codigo}/verificar`, { data: { correo, codigo: codigoDe(mensaje.texto) } })
    const cuerpo: { ficha?: string } = await r.json()
    if (r.status() !== 200 || !cuerpo.ficha) throw new Error(`verificar ${r.status()}`)
    return cuerpo.ficha
  } finally {
    await ctx.dispose()
  }
}

/** Las citas (id, estado) de ese médico que empiezan en ese instante. */
export function citasEnTurno(e: Escenario, inicio: string): string[] {
  const salida = sqlLocal(`select id || ':' || status from public.appointments
                            where medico_id = :'medico' and start_time = :'inicio'::timestamptz order by created_at;`,
  { medico: e.medicoId, inicio })
  return salida === '' ? [] : salida.split('\n')
}

/** La cita reservada por ese correo (la más reciente). */
export function citaDe(correo: string): { id: string; status: string; pacienteNulo: boolean; canal: string; title: string } | null {
  const fila = sqlLocal(`select id, status, (paciente_id is null)::text, reserva_canal, title from public.appointments
                          where reserva_correo = :'correo' order by created_at desc limit 1;`, { correo })
  if (fila === '') return null
  const [id = '', status = '', nulo = '', canal = '', title = ''] = fila.split('|')
  return { id, status, pacienteNulo: nulo === 'true', canal, title }
}

/** Cancela como lo haría el personal (cambio de estado; el disparador de D2 cuenta la incidencia). */
export function cancelarCita(id: string): void {
  sqlLocal(`update public.appointments set status = 'cancelled' where id = :'id';`, { id })
}

/** Lo que hace «Desbloquear» (reserva_contacto_marcar), como postgres: perdona las dos claves de esa cita. */
export function desbloquearDesdeCita(citaId: string): void {
  sqlLocal(`
    insert into public.reserva_contactos (clinica_id, medico_id, clave_hmac, clase, perdonado_en)
    select a.clinica_id, a.medico_id, x.clave, x.clase, now()
      from public.appointments a,
           lateral (values (a.reserva_tel_hmac, 'telefono'), (a.reserva_correo_hmac, 'correo')) x(clave, clase)
     where a.id = :'id'
    on conflict (clinica_id, medico_id, clave_hmac) do update set perdonado_en = now();`, { id: citaId })
}

/** Al terminar: apaga el interruptor de A (lo demás lo limpia la siguiente siembra). */
export function cerrarEscenario(): void {
  interruptorAgenda('A', false)
}
