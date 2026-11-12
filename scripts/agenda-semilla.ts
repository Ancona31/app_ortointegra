/**
 * Sembrador de datos FICTICIOS para la Supabase LOCAL, para probar y medir la
 * agenda. Instrucciones, usuarios y contenido: `scripts/agenda-semilla.md`.
 *
 *   npx tsx scripts/agenda-semilla.ts                # siembra (borra antes lo sembrado)
 *   npx tsx scripts/agenda-semilla.ts --volumen N    # además N citas extra en la clínica A
 *   npx tsx scripts/agenda-semilla.ts --borrar       # quita todo lo sembrado
 *
 * ⚠️ SOLO LOCAL. Aborta si `NEXT_PUBLIC_SUPABASE_URL` no apunta a 127.0.0.1 o
 * localhost. No llama a Google, Stripe ni Resend aunque sus llaves estén en el
 * mismo `.env.local`: aquí no se importa nada que hable con ellos.
 *
 * SIEMBRA COMO LA APP. Cada paso replica la ruta que lo hace en producción, y
 * los que la app hace con la sesión del usuario (perfil, consultorios,
 * pacientes, citas) se hacen aquí con la sesión de ese usuario, con la anon key
 * y con la RLS y los gates de suscripción y de perfil en medio. La excepción es
 * `--volumen`, que va por SQL directo (sin RLS) porque son decenas de miles.
 *
 * NO BORRA EXPEDIENTE CLÍNICO. Si alguien escribió notas, documentos o
 * mediciones sobre los pacientes sembrados, el borrado se detiene y lo dice: las
 * notas clínicas son inmutables en este proyecto y no es este script quien
 * decide saltarse eso. El `audit_log` tampoco se borra (es inmutable por
 * trigger): cada siembra le deja sus filas.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { randomUUID } from 'crypto'
import { execFileSync } from 'child_process'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { desplazarFecha, fechaHoraLocalAInstante, hoyEnTZ } from '../src/lib/dates'
import { comprobarTopeDuracion } from '../src/lib/agenda/topeDuracion'
import { PLAN_LIMITS } from '../src/lib/plans'
import { PerfilMedicoUpdateSchema } from '../src/lib/perfil/schemas'
import { CrearConsultorioSchema, type CrearConsultorioInput } from '../src/lib/consultorios/schemas'
import type { IconoEvento, ColorEvento } from '../src/lib/appointments'
import type { Horario } from '../src/lib/configApp'

config({ path: resolve(process.cwd(), '.env.local'), quiet: true })

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const CONTENEDOR_DB = 'supabase_db_app_ortointegra'

const DOMINIO = '@semilla.spinus.test'
const CONTRASENA = 'Semilla-Agenda-2026'
const TZ = 'America/Merida'
const NOMBRE_A = 'Clínica Semilla A'
const NOMBRE_B = 'Clínica Semilla B'

type Estado = 'scheduled' | 'confirmed' | 'cancelled' | 'no_show' | 'attended'
type Clave = 'adminA' | 'invitadoA' | 'secretariaA' | 'adminB'
interface Persona { clave: Clave; email: string; role: 'medico' | 'secretaria'; perfil: Record<string, string> }
interface Sesion { id: string; cliente: SupabaseClient; clinicaId: string }
interface Consultorio { id: string; nombre: string; nombre_corto: string; direccion: string; telefono: string | null; timezone: string }
interface Paciente { id: string; nombre: string; apellidos: string }
interface CitaPlan {
  medico: Clave; creador: Clave; consultorio: Consultorio; fecha: string
  hora?: string; minutos?: number; hasta?: string
  paciente: Paciente | null; titulo?: string; icono?: IconoEvento | null; color?: ColorEvento | null
  estado: Estado; notas?: string | null
}

const PERSONAS: Record<Clave, Persona> = {
  adminA: { clave: 'adminA', email: `admin.a${DOMINIO}`, role: 'medico', perfil: { titulo: 'Dr.', nombres: 'Admin', apellido_paterno: 'Semilla', apellido_materno: 'Uno', especialidad: 'Ortopedia y Traumatología', cedula_profesional: '00000001' } },
  invitadoA: { clave: 'invitadoA', email: `medico.a${DOMINIO}`, role: 'medico', perfil: { titulo: 'Dra.', nombres: 'Invitada', apellido_paterno: 'Semilla', apellido_materno: 'Dos', especialidad: 'Medicina de Rehabilitación', cedula_profesional: '00000002' } },
  secretariaA: { clave: 'secretariaA', email: `secretaria.a${DOMINIO}`, role: 'secretaria', perfil: { nombres: 'Secretaria', apellido_paterno: 'Semilla', apellido_materno: 'Tres' } },
  adminB: { clave: 'adminB', email: `admin.b${DOMINIO}`, role: 'medico', perfil: { titulo: 'Dr.', nombres: 'Otro', apellido_paterno: 'Semilla', apellido_materno: 'Cuatro', especialidad: 'Ortopedia y Traumatología', cedula_profesional: '00000004' } },
}

const DIA = (activo: boolean, inicio: string, fin: string) => ({ activo, inicio, fin })
const HORARIO_A: Horario = {
  lunes: DIA(true, '08:00', '18:00'), martes: DIA(true, '08:00', '18:00'), miercoles: DIA(true, '08:00', '18:00'),
  jueves: DIA(true, '08:00', '18:00'), viernes: DIA(true, '08:00', '18:00'), sabado: DIA(true, '08:00', '13:00'),
  domingo: DIA(false, '09:00', '14:00'),
}
function horarioSemana(inicio: string, fin: string, sabado: boolean): Horario {
  const d = DIA(true, inicio, fin)
  return { lunes: d, martes: d, miercoles: d, jueves: d, viernes: d, sabado: DIA(sabado, '08:00', '13:00'), domingo: DIA(false, '09:00', '14:00') }
}

const opcionesAuth = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(URL_SB, SERVICIO, opcionesAuth)
const clienteAnon = (): SupabaseClient => createClient(URL_SB, ANON, opcionesAuth)

interface Respuesta<T> { data: T | null; error: { message: string; code?: string } | null }
function exigir<T>(r: Respuesta<T>, ctx: string): T {
  if (r.error || r.data === null) throw new Error(`${ctx}: ${r.error?.message ?? 'sin datos'}`)
  return r.data
}
function sinError(r: { error: { message: string } | null }, ctx: string): void {
  if (r.error) throw new Error(`${ctx}: ${r.error.message}`)
}

function candado(): void {
  let host = ''
  try { host = new URL(URL_SB).hostname } catch { host = '' }
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(`CANDADO: NEXT_PUBLIC_SUPABASE_URL no es local (host «${host || 'vacío'}»). No se toca nada.`)
  }
  if (!ANON || !SERVICIO) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en .env.local')
}

function leerModo(argv: string[]): { borrarSolo: boolean; volumen: number } {
  if (argv.includes('--borrar')) return { borrarSolo: true, volumen: 0 }
  const i = argv.indexOf('--volumen')
  if (i === -1) return { borrarSolo: false, volumen: 0 }
  const n = Number(argv[i + 1])
  if (!Number.isInteger(n) || n < 1 || n > 500_000) throw new Error('--volumen espera un entero entre 1 y 500000')
  return { borrarSolo: false, volumen: n }
}

/* ── Borrado ─────────────────────────────────────────────────────────── */

async function usuariosSembrados(): Promise<string[]> {
  const ids: string[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listUsers: ${error.message}`)
    for (const u of data.users) if (u.email?.endsWith(DOMINIO)) ids.push(u.id)
    if (data.users.length < 1000) return ids
  }
}

/** Las clínicas de los perfiles sembrados y las que llevan el nombre de la semilla, siempre que NADIE ajeno viva en ellas. */
async function clinicasSembradas(usuarios: string[]): Promise<string[]> {
  const perfiles: { clinica_id: string | null }[] = usuarios.length
    ? exigir(await admin.from('profiles').select('clinica_id').in('id', usuarios), 'perfiles sembrados') : []
  const porNombre: { id: string }[] = exigir(await admin.from('clinicas').select('id').in('nombre', [NOMBRE_A, NOMBRE_B]), 'clínicas por nombre')
  const ids = [...new Set([...perfiles.map(p => p.clinica_id), ...porNombre.map(c => c.id)])].filter((x): x is string => !!x)
  if (!ids.length) return ids
  const miembros: { id: string }[] = exigir(await admin.from('profiles').select('id').in('clinica_id', ids), 'miembros')
  const ajenos = miembros.filter(m => !usuarios.includes(m.id)).length
  if (ajenos) throw new Error(`Las clínicas de la semilla tienen ${ajenos} perfil(es) que no son @semilla. No se borra nada.`)
  return ids
}

async function exigirSinExpediente(pacientes: string[]): Promise<void> {
  if (!pacientes.length) return
  for (const tabla of ['consultas', 'documentos', 'mediciones_analitos', 'calculadora_resultados', 'solicitudes_arco']) {
    const { count, error } = await admin.from(tabla).select('*', { count: 'exact', head: true }).in('paciente_id', pacientes)
    if (error) throw new Error(`conteo de ${tabla}: ${error.message}`)
    if (count) throw new Error(`Hay ${count} fila(s) en ${tabla} sobre pacientes sembrados. No se borra expediente clínico: retíralo a mano o recrea la base local.`)
  }
}

/**
 * La reserva por enlace (bloque D) deja filas que el rol de servicio NO puede
 * borrar (D1-D3 le quitan DELETE a propósito) y que cierran el paso con FKs
 * RESTRICT. Se limpian como `postgres` por SQL, en dos tiempos alrededor del
 * borrado de las citas:
 *   · antes: soltar `reserva_enlaces.usado_cita_id`/`usado_en` (FK a la cita;
 *     el CHECK pide las dos juntas y la protección deja pasar a `postgres`),
 *     y borrar `reserva_verificaciones` (FK al enlace), `reserva_incidencias`
 *     (FK a la cita) y `reserva_contactos` (FK a clínica y médico);
 *   · después: borrar `reserva_enlaces` (las citas que lo apuntaban ya no
 *     están; su FK a médico y clínica es RESTRICT).
 * Cada tabla se mira con `to_regclass`: sin las migraciones de D no hace nada.
 * Los avisos (`reserva_avisos`) no son de ninguna clínica y se quedan.
 * Bloque E, también antes y en este orden: `cita_reagendos` (E6: FK RESTRICT a
 * las dos citas y al enlace de confirmación), `cita_correos` (E4, el registro
 * de envíos) y `cita_confirmaciones` (E1: FK RESTRICT a la cita y a la
 * clínica). Desde E5 cada reserva por enlace deja un enlace de confirmación, y
 * sin esto la siguiente siembra no podría borrar las citas ni las clínicas. Por
 * clínica, así que también se lleva los que dejó huérfanos una limpieza con
 * `session_replication_role = replica`.
 */
function limpiarReserva(clinicas: string[], cuando: 'antes' | 'despues'): void {
  if (!clinicas.every(id => /^[0-9a-f-]{36}$/.test(id))) throw new Error('id inválido para limpiar la reserva')
  const antes = `
    if to_regclass('public.cita_reagendos') is not null then
      delete from public.cita_reagendos where clinica_id = any (v_c);
    end if;
    if to_regclass('public.cita_confirmaciones') is not null then
      delete from public.cita_confirmaciones where clinica_id = any (v_c);
    end if;
    if to_regclass('public.reserva_enlaces') is not null then
      update public.reserva_enlaces set usado_en = null, usado_cita_id = null
       where clinica_id = any (v_c) and usado_cita_id is not null;
    end if;
    if to_regclass('public.reserva_verificaciones') is not null then
      delete from public.reserva_verificaciones where clinica_id = any (v_c);
    end if;
    if to_regclass('public.reserva_incidencias') is not null then
      delete from public.reserva_incidencias where clinica_id = any (v_c);
    end if;
    if to_regclass('public.reserva_contactos') is not null then
      delete from public.reserva_contactos where clinica_id = any (v_c);
    end if;
    if to_regclass('public.cita_correos') is not null then
      delete from public.cita_correos where clinica_id = any (v_c);
    end if;
    -- D11: avisos de empalme (FK RESTRICT a la clínica; sin DELETE para el rol de servicio).
    if to_regclass('public.reserva_empalmes_google') is not null then
      delete from public.reserva_empalmes_google where clinica_id = any (v_c);
    end if;`
  const despues = `
    if to_regclass('public.reserva_enlaces') is not null then
      delete from public.reserva_enlaces where clinica_id = any (v_c);
    end if;`
  const sql = `\\set ON_ERROR_STOP on
select set_config('semilla.clinicas', :'clinicas', false);
do $$
declare v_c uuid[] := string_to_array(current_setting('semilla.clinicas'), ',')::uuid[];
begin${cuando === 'antes' ? antes : despues}
end $$;
`
  execFileSync('docker', ['exec', '-i', CONTENEDOR_DB, 'psql', '-U', 'postgres', '-q', '-o', '/dev/null',
    '-v', `clinicas=${clinicas.join(',')}`], { input: sql, encoding: 'utf8' })
}

async function borrar(): Promise<void> {
  const usuarios = await usuariosSembrados()
  const clinicas = await clinicasSembradas(usuarios)
  const pacientes: { id: string }[] = clinicas.length
    ? exigir(await admin.from('pacientes').select('id').in('clinica_id', clinicas), 'pacientes sembrados') : []
  const pacIds = pacientes.map(p => p.id)
  await exigirSinExpediente(pacIds)
  if (clinicas.length) {
    limpiarReserva(clinicas, 'antes')
    sinError(await admin.from('appointments').delete().in('clinica_id', clinicas), 'borrar citas')
    limpiarReserva(clinicas, 'despues')
    /* B6: los tipos de cita que siembra una prueba (`agenda-tipos-cita`). Sus
       FKs a `clinicas` y `profiles` son RESTRICT; sin esto, uno que se quedara
       tras una prueba fallida rompería la siguiente siembra. Después de las
       citas, que los referencian. La tabla puede no existir sin la migración. */
    const tipos = await admin.from('tipos_cita').delete().in('clinica_id', clinicas)
    if (tipos.error && tipos.error.code !== '42P01' && tipos.error.code !== 'PGRST205') sinError(tipos, 'borrar tipos de cita')
    if (pacIds.length) sinError(await admin.from('paciente_medico').delete().in('paciente_id', pacIds), 'borrar paciente_medico')
    sinError(await admin.from('pacientes').delete().in('clinica_id', clinicas), 'borrar pacientes')
    sinError(await admin.from('consultorios').delete().in('clinica_id', clinicas), 'borrar consultorios')
    /* La FK de `agenda_ajustes` a `clinicas` es RESTRICT (migración B1): una
       prueba que encendió el interruptor deja su fila, y sin esto el borrado de
       la clínica de abajo falla. Con el rol de servicio: el disparador que
       protege el interruptor no mira los DELETE. */
    sinError(await admin.from('agenda_ajustes').delete().in('clinica_id', clinicas), 'borrar ajustes de la agenda')
  }
  for (const id of usuarios) {
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) throw new Error(`borrar usuario: ${error.message}`)
  }
  if (clinicas.length) sinError(await admin.from('clinicas').delete().in('id', clinicas), 'borrar clínicas')
  console.log(`Borrado: ${usuarios.length} usuarios, ${clinicas.length} clínicas, ${pacIds.length} pacientes (y sus citas y consultorios).`)
}

/* ── Altas, en el orden y con la forma de la app ─────────────────────── */

async function iniciarSesion(email: string): Promise<SupabaseClient> {
  const cliente = clienteAnon()
  const { error } = await cliente.auth.signInWithPassword({ email, password: CONTRASENA })
  if (error) throw new Error(`signInWithPassword ${email}: ${error.message}`)
  return cliente
}

/** `PUT /api/me/perfil-medico`, con la sesión del propio usuario. */
async function completarPerfil(s: Sesion, p: Persona): Promise<void> {
  const datos = PerfilMedicoUpdateSchema.parse(p.perfil)
  sinError(await s.cliente.from('profiles').update({ ...datos, nombre_confirmado: true }).eq('id', s.id), `perfil de ${p.email}`)
}

async function auditar(userId: string, accion: string, tabla: string, registroId: string, descripcion: string | null): Promise<void> {
  sinError(await admin.from('audit_log').insert({ user_id: userId, accion, tabla, registro_id: registroId, ip: null, descripcion }), `audit ${accion}`)
}

/** `api/auth/registro` + `POST /api/me/clinica`. El correo se da por confirmado (en la app lo confirma el enlace). */
async function crearDueno(p: Persona, nombreClinica: string): Promise<Sesion> {
  const { data, error } = await admin.auth.admin.createUser({ email: p.email, password: CONTRASENA, email_confirm: true })
  if (error) throw new Error(`createUser ${p.email}: ${error.message}`)
  const id = data.user.id
  sinError(await admin.from('profiles').upsert({ id, role: 'medico', es_admin_de_clinica: true }), 'perfil del dueño')
  const limites = PLAN_LIMITS.free
  const clinica: { id: string } = exigir(await admin.from('clinicas').insert({
    nombre: nombreClinica, tipo: 'independiente', plan: 'free', suscripcion_estado: 'free',
    max_medicos: limites.max_medicos, max_secretarias: limites.max_secretarias, max_pacientes: limites.max_pacientes,
  }).select('id').single(), 'alta de clínica')
  sinError(await admin.from('profiles').update({ clinica_id: clinica.id, es_admin_de_clinica: true }).eq('id', id), 'dueño de clínica')
  const sesion = { id, cliente: await iniciarSesion(p.email), clinicaId: clinica.id }
  await completarPerfil(sesion, p)
  return sesion
}

/** Lo que haría un super_admin desde su panel: VIP (`es_vip_grant`) y topes de equipo. */
async function hacerVip(clinicaId: string): Promise<void> {
  sinError(await admin.from('clinicas').update({ es_vip_grant: true, max_pacientes: null }).eq('id', clinicaId), 'VIP')
  await auditar('semilla-local', 'sa_toggle_vip', 'clinicas', clinicaId, JSON.stringify({ from: false, to: true }))
  const campos = { max_medicos: 3, max_secretarias: 2 }
  sinError(await admin.from('clinicas').update(campos).eq('id', clinicaId), 'topes de equipo')
  await auditar('semilla-local', 'sa_editar_clinica', 'clinicas', clinicaId, JSON.stringify(campos))
}

/** `POST /api/admin/invitar` y luego `POST /api/auth/aceptar-invitacion`. */
async function invitar(p: Persona, dueno: Sesion): Promise<Sesion> {
  const tope: { max_medicos: number | null; max_secretarias: number | null } = exigir(await admin.from('clinicas')
    .select('max_medicos, max_secretarias').eq('id', dueno.clinicaId).single(), 'topes')
  const { count } = await admin.from('profiles').select('*', { count: 'exact', head: true }).eq('clinica_id', dueno.clinicaId).eq('role', p.role)
  const max = p.role === 'medico' ? tope.max_medicos : tope.max_secretarias
  if (max !== null && (count ?? 0) >= max) throw new Error(`Tope de ${p.role} alcanzado en la clínica`)
  const { data, error } = await admin.auth.admin.generateLink({ type: 'invite', email: p.email })
  if (error || !data.user || !data.properties?.hashed_token) throw new Error(`generateLink ${p.email}: ${error?.message ?? 'sin token'}`)
  const id = data.user.id
  sinError(await admin.from('profiles').upsert({ id, role: p.role, nombre_confirmado: false, clinica_id: dueno.clinicaId,
    invitado_por: dueno.id, titulo: p.role === 'medico' ? 'Dr.' : null }), 'perfil del invitado')
  await auditar(dueno.id, 'usuario_invitado', 'profiles', id, `rol: ${p.role}`)
  const canje = clienteAnon()
  sinError(await canje.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'invite' }), 'verifyOtp')
  sinError(await canje.auth.updateUser({ password: CONTRASENA }), 'contraseña del invitado')
  sinError(await canje.auth.signOut({ scope: 'local' }), 'signOut del canje')
  await auditar(id, 'invitacion_aceptada', 'profiles', id, null)
  const sesion = { id, cliente: await iniciarSesion(p.email), clinicaId: dueno.clinicaId }
  await completarPerfil(sesion, p)
  return sesion
}

/** `POST /api/consultorios`, con la sesión del médico. */
async function crearConsultorio(s: Sesion, entrada: CrearConsultorioInput): Promise<Consultorio> {
  const input = CrearConsultorioSchema.parse(entrada)
  return exigir(await s.cliente.from('consultorios').insert({
    clinica_id: s.clinicaId, medico_id: s.id, nombre: input.nombre, nombre_corto: input.nombre_corto ?? input.nombre,
    direccion: input.direccion, telefono: input.telefono ?? null, timezone: input.timezone,
    ...(input.horario ? { horario: input.horario } : {}),
  }).select('id, nombre, nombre_corto, direccion, telefono, timezone').single(), `consultorio ${input.nombre}`)
}

/** `POST /api/pacientes` → `crear_paciente_con_medico_v2`. El RPC escribe el consentimiento (true, now(), versión del aviso). */
async function crearPaciente(s: Sesion, medicoId: string, n: string, i: number): Promise<Paciente> {
  const p_datos = {
    nombre: 'Paciente', apellidos: `Prueba ${n}`, fecha_nacimiento: `${1950 + (i * 3) % 60}-0${1 + i % 9}-1${i % 10}`,
    sexo: i % 2 ? 'F' : 'M', telefono: `99900${String(i).padStart(5, '0')}`, email: `paciente.${n.toLowerCase()}${DOMINIO}`,
  }
  const r: { resultado: string; id: string | null } = exigir(await s.cliente
    .rpc('crear_paciente_con_medico_v2', { p_datos, p_medico_id: medicoId, p_force_create: false }).single(), `paciente ${n}`)
  if (r.resultado !== 'creado' || !r.id) throw new Error(`paciente ${n}: resultado ${r.resultado}`)
  return { id: r.id, nombre: p_datos.nombre, apellidos: p_datos.apellidos }
}

/* ── Plan de citas, relativo a HOY en la zona del consultorio ────────── */

function azar(semilla: number): () => number {
  let a = semilla
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = azar(20261110)

const hoy = hoyEnTZ(TZ)
const lunes = desplazarFecha(hoy, { dias: -((new Date(`${hoy}T12:00:00Z`).getUTCDay() + 6) % 7) })
const dia = (semana: number, d: number): string => desplazarFecha(lunes, { dias: semana * 7 + d })

function estadoPara(fecha: string, hora: string, minutos: number): Estado {
  const fin = new Date(fechaHoraLocalAInstante(fecha, hora, TZ)).getTime() + minutos * 60_000
  const r = rnd()
  if (fin < Date.now()) return r < 0.7 ? 'attended' : r < 0.85 ? 'no_show' : 'cancelled'
  return r < 0.55 ? 'scheduled' : r < 0.9 ? 'confirmed' : 'cancelled'
}

interface Contexto { cons: Record<'centro' | 'norte' | 'rehab' | 'b', Consultorio>; pac: Record<'adminA' | 'invitadoA' | 'adminB', Paciente[]> }
const turno: Record<string, number> = {}
function siguiente(lista: Paciente[], clave: string): Paciente {
  turno[clave] = ((turno[clave] ?? -1) + 1) % lista.length
  return lista[turno[clave]]
}

function cita(ctx: Contexto, medico: 'adminA' | 'invitadoA' | 'adminB', fecha: string, hora: string, minutos: number, cons: Consultorio): CitaPlan {
  const creador: Clave = medico === 'adminB' ? 'adminB' : rnd() < 0.5 ? medico : 'secretariaA'
  return { medico, creador, consultorio: cons, fecha, hora, minutos, paciente: siguiente(ctx.pac[medico], medico),
    estado: estadoPara(fecha, hora, minutos), notas: rnd() < 0.2 ? 'Nota ficticia de la semilla.' : null }
}

function evento(medico: Clave, cons: Consultorio, fecha: string, titulo: string, icono: IconoEvento | null, color: ColorEvento | null, hora?: string, minutos?: number, hasta?: string): CitaPlan {
  return { medico, creador: medico, consultorio: cons, fecha, hora, minutos, hasta, paciente: null, titulo, icono, color, estado: 'scheduled' }
}

const HUECOS_ADMIN: [string, number][] = [['08:00', 30], ['09:00', 30], ['11:30', 20], ['12:00', 60], ['13:00', 15], ['16:00', 60], ['17:00', 30]]
const HUECOS_INV: [string, number][] = [['08:30', 45], ['11:30', 30], ['14:00', 90], ['16:00', 45]]
const algunos = <T,>(xs: T[], n: number): T[] => xs.filter(() => rnd() < n / xs.length)

function citasDeConsultaA(ctx: Contexto): CitaPlan[] {
  const out: CitaPlan[] = []
  for (let w = -4; w <= 4; w++) {
    for (let d = 0; d < 5; d++) {
      const f = dia(w, d)
      out.push(cita(ctx, 'adminA', f, '10:00', 45, ctx.cons.centro))
      for (const [h, m] of algunos(HUECOS_ADMIN, 3)) out.push(cita(ctx, 'adminA', f, h, m, h < '14:00' ? ctx.cons.centro : ctx.cons.norte))
      // 10:00 los martes y jueves siempre: citas simultáneas de los dos médicos.
      if (d === 1 || d === 3 || rnd() < 0.4) out.push(cita(ctx, 'invitadoA', f, '10:00', 60, ctx.cons.rehab))
      for (const [h, m] of algunos(HUECOS_INV, 2)) out.push(cita(ctx, 'invitadoA', f, h, m, ctx.cons.rehab))
    }
    for (const [h, m] of algunos<[string, number]>([['09:00', 30], ['10:00', 30], ['11:00', 60]], 2)) out.push(cita(ctx, 'adminA', dia(w, 5), h, m, ctx.cons.norte))
  }
  out.push(cita(ctx, 'adminA', dia(0, 2), '12:00', 30, ctx.cons.centro)) // doble cita del mismo médico (solape)
  out.push(cita(ctx, 'adminA', dia(0, 1), '19:00', 30, ctx.cons.norte)) // fuera de horario
  out.push(cita(ctx, 'adminA', dia(0, 5), '13:30', 30, ctx.cons.norte)) // sábado después del cierre
  out.push(cita(ctx, 'adminA', dia(-1, 4), '07:00', 30, ctx.cons.centro)) // antes de abrir
  out.push(cita(ctx, 'invitadoA', dia(1, 6), '10:00', 45, ctx.cons.rehab)) // domingo (cerrado)
  return out
}

function eventosA(ctx: Contexto): CitaPlan[] {
  const { centro, norte, rehab } = ctx.cons
  const out: CitaPlan[] = []
  for (let w = -4; w <= 4; w++) out.push(evento('adminA', centro, dia(w, 0), 'Junta de servicio', 'junta', 'indigo', '14:00', 60))
  out.push(evento('adminA', norte, dia(0, 2), 'Cirugía programada', 'cirugia', 'carmin', '07:00', 180))
  out.push(evento('invitadoA', rehab, dia(0, 3), 'Comida', 'comida', 'oliva', '13:00', 60))
  out.push(evento('adminA', centro, dia(1, 4), 'Sesión docente', 'docencia', 'bronce', '12:00', 60))
  out.push(evento('adminA', centro, dia(-1, 1), 'Bloqueo de agenda', 'bloqueo', 'grafito', '11:00', 60))
  out.push(evento('invitadoA', rehab, dia(2, 2), 'Videollamada con proveedor', 'videollamada', 'magenta', '18:00', 60))
  out.push(evento('adminA', centro, dia(0, 4), 'Pendiente administrativo', null, null, '13:30', 30))
  out.push(evento('adminA', norte, dia(0, 2), 'Guardia', 'urgencias', 'carmin', undefined, undefined, dia(0, 2)))
  out.push(evento('invitadoA', rehab, dia(0, 3), 'Congreso de rehabilitación', 'congreso', 'magenta', undefined, undefined, dia(1, 1)))
  out.push(evento('adminA', centro, dia(-2, 0), 'Viaje', 'viaje', 'grafito', undefined, undefined, dia(-2, 2)))
  return out
}

function citasB(ctx: Contexto): CitaPlan[] {
  const out: CitaPlan[] = []
  for (let w = -1; w <= 1; w++) for (let d = 0; d < 5; d++) out.push(cita(ctx, 'adminB', dia(w, d), '10:00', 30, ctx.cons.b))
  out.push(evento('adminB', ctx.cons.b, dia(0, 2), 'Junta clínica B', 'junta', 'oliva', '13:00', 60))
  out.push(evento('adminB', ctx.cons.b, dia(0, 2), 'Día de la clínica B', 'personal', 'indigo', undefined, undefined, dia(0, 2)))
  return out
}

/** La fila EXACTA de `POST /api/appointments`: puntas, instantánea del consultorio, `client_id`, pinta y `gcal_sync_status`. */
function filaDeCita(p: CitaPlan, ses: Record<Clave, Sesion>): Record<string, string | boolean | null> {
  const tz = p.consultorio.timezone
  const todoElDia = p.hasta !== undefined
  const inicio = todoElDia ? fechaHoraLocalAInstante(p.fecha, '00:00', tz) : fechaHoraLocalAInstante(p.fecha, p.hora ?? '', tz)
  const fin = todoElDia
    ? fechaHoraLocalAInstante(desplazarFecha(p.hasta ?? '', { dias: 1 }), '00:00', tz)
    : new Date(new Date(inicio).getTime() + (p.minutos ?? 0) * 60_000).toISOString()
  const tope = comprobarTopeDuracion(inicio, fin, Boolean(p.paciente))
  if (tope) throw new Error(`cita ${p.fecha}: ${tope.message}`)
  return {
    clinica_id: ses[p.creador].clinicaId, created_by: ses[p.creador].id, paciente_id: p.paciente?.id ?? null,
    title: p.paciente ? `${p.paciente.nombre} ${p.paciente.apellidos}` : p.titulo ?? '',
    start_time: inicio, end_time: fin, all_day: todoElDia, notes: p.notas ?? null, status: 'scheduled',
    medico_id: ses[p.medico].id, gcal_sync_status: 'pending', client_id: randomUUID(),
    icono: p.icono ?? null, color: p.color ?? null, consultorio_id: p.consultorio.id,
    consultorio_nombre: p.consultorio.nombre, consultorio_nombre_corto: p.consultorio.nombre_corto,
    consultorio_direccion: p.consultorio.direccion, consultorio_telefono: p.consultorio.telefono, consultorio_timezone: tz,
  }
}

/** Alta con la sesión de quien la crea y, después, el cambio de estado como lo hace el PUT (`status` + `updated_at`). */
async function sembrarCitas(planes: CitaPlan[], ses: Record<Clave, Sesion>, quienActualiza: Clave): Promise<void> {
  const estadoPorClient = new Map<string, Estado>()
  const porCreador = new Map<Clave, Record<string, string | boolean | null>[]>()
  for (const p of planes) {
    const fila = filaDeCita(p, ses)
    estadoPorClient.set(String(fila.client_id), p.estado)
    porCreador.set(p.creador, [...(porCreador.get(p.creador) ?? []), fila])
  }
  const idsPorEstado = new Map<Estado, string[]>()
  for (const [creador, filas] of porCreador) {
    const creadas: { id: string; client_id: string }[] = exigir(await ses[creador].cliente.from('appointments')
      .insert(filas).select('id, client_id'), `citas de ${creador}`)
    for (const c of creadas) {
      const e = estadoPorClient.get(c.client_id) ?? 'scheduled'
      idsPorEstado.set(e, [...(idsPorEstado.get(e) ?? []), c.id])
    }
  }
  for (const [estado, ids] of idsPorEstado) {
    if (estado === 'scheduled') continue
    sinError(await ses[quienActualiza].cliente.from('appointments')
      .update({ status: estado, updated_at: new Date().toISOString() }).in('id', ids), `estado ${estado}`)
  }
}

/* ── Volumen por SQL directo ─────────────────────────────────────────── */

function sqlVolumen(): string {
  return `
\\set ON_ERROR_STOP on
begin;
with medicos as (select array_agg(id order by id) ids from public.profiles where clinica_id = :'clinica' and role = 'medico'),
x as materialized (
  select m.ids[1 + floor(random() * array_length(m.ids, 1))::int] medico_id,
         d + (extract(isodow from d) = 7)::int dia,
         480 + 15 * floor(random() * 40)::int min_inicio,
         (array[15,20,30,45,60,90])[1 + floor(random() * 6)::int] dur,
         random() < 0.15 es_evento, 1 + floor(random() * 6)::int k, random() < 0.5 crea_medico
  from generate_series(1, :n) g, medicos m,
       lateral (select (now() at time zone 'America/Merida')::date - 365 + floor(random() * 731)::int + 0 * g d) dd
)
insert into public.appointments (clinica_id, paciente_id, created_by, title, start_time, end_time, status, gcal_sync_status,
  medico_id, client_id, consultorio_id, consultorio_nombre, consultorio_nombre_corto, consultorio_direccion,
  consultorio_telefono, consultorio_timezone, origen, icono, color, all_day)
select :'clinica', pac.id, case when x.crea_medico then x.medico_id else :'secretaria'::uuid end,
       coalesce(pac.nombre || ' ' || pac.apellidos, (array['Junta de servicio','Cirugía programada','Sesión docente','Bloqueo de agenda','Videollamada','Comida'])[x.k]),
       t.ini, t.ini + make_interval(mins => x.dur),
       case when t.ini + make_interval(mins => x.dur) < now()
            then (array['attended','attended','attended','attended','no_show','cancelled'])[1 + floor(random() * 6)::int]
            else (array['scheduled','scheduled','confirmed','confirmed','cancelled'])[1 + floor(random() * 5)::int] end,
       'pending', x.medico_id, gen_random_uuid()::text, c.id, c.nombre, c.nombre_corto, c.direccion, c.telefono, c.timezone, 'spinus',
       case when pac.id is null then (array['junta','cirugia','docencia','bloqueo','videollamada','comida'])[x.k] end,
       case when pac.id is null then (array['indigo','carmin','bronce','grafito','magenta','oliva'])[x.k] end, false
from x
cross join lateral (select * from public.consultorios c where c.medico_id = x.medico_id and c.activo order by random() limit 1) c
left join lateral (select p.id, p.nombre, p.apellidos from public.paciente_medico pm join public.pacientes p on p.id = pm.paciente_id
                   where pm.medico_id = x.medico_id and not x.es_evento order by random() limit 1) pac on true
cross join lateral (select (x.dia + make_interval(mins => x.min_inicio)) at time zone c.timezone ini) t;
commit;
analyze public.appointments;
`
}

function volumen(n: number, clinicaId: string, secretariaId: string): void {
  const uuid = /^[0-9a-f-]{36}$/
  if (!uuid.test(clinicaId) || !uuid.test(secretariaId)) throw new Error('id inválido para el volumen')
  const salida = execFileSync('docker', ['exec', '-i', CONTENEDOR_DB, 'psql', '-U', 'postgres', '-q',
    '-v', `clinica=${clinicaId}`, '-v', `secretaria=${secretariaId}`, '-v', `n=${n}`], { input: sqlVolumen(), encoding: 'utf8' })
  if (salida.trim()) console.log(salida.trim())
}

/* ── Comprobación final: inicio de sesión, perfil y aislamiento ──────── */

async function comprobar(ses: Record<Clave, Sesion>): Promise<void> {
  for (const clave of ['adminA', 'invitadoA', 'secretariaA', 'adminB'] as const) {
    const s = ses[clave]
    const perfil: { role: string; clinica_id: string; es_admin_de_clinica: boolean } = exigir(await s.cliente.from('profiles')
      .select('role, clinica_id, es_admin_de_clinica').eq('id', s.id).single(), `perfil de ${clave}`)
    const { count } = await s.cliente.from('appointments').select('id', { count: 'exact', head: true })
    const { count: ajenas } = await s.cliente.from('appointments').select('id', { count: 'exact', head: true }).neq('clinica_id', s.clinicaId)
    const ok = perfil.clinica_id === s.clinicaId && perfil.role === PERSONAS[clave].role
    console.log(`  ${PERSONAS[clave].email.padEnd(36)} rol=${perfil.role}${perfil.es_admin_de_clinica ? ' (admin)' : ''} clínica=${ok ? 'OK' : 'MAL'} citas visibles=${count ?? '?'} de otra clínica=${ajenas ?? '?'}`)
    if (!ok || ajenas) throw new Error(`Comprobación fallida para ${clave}`)
  }
}

async function resumen(clinicas: [string, string][]): Promise<void> {
  for (const [nombre, id] of clinicas) {
    const partes: string[] = []
    for (const e of ['scheduled', 'confirmed', 'cancelled', 'no_show', 'attended'] as const) {
      const { count } = await admin.from('appointments').select('id', { count: 'exact', head: true }).eq('clinica_id', id).eq('status', e)
      partes.push(`${e}=${count ?? '?'}`)
    }
    const { count: pac } = await admin.from('pacientes').select('id', { count: 'exact', head: true }).eq('clinica_id', id)
    console.log(`  ${nombre}: pacientes=${pac ?? '?'} citas: ${partes.join(' ')}`)
  }
}

/* ── Orquestación ────────────────────────────────────────────────────── */

async function sembrarEquipo(): Promise<{ ses: Record<Clave, Sesion>; ctx: Contexto }> {
  const adminA = await crearDueno(PERSONAS.adminA, NOMBRE_A)
  await hacerVip(adminA.clinicaId)
  sinError(await admin.from('clinicas').update({ horario_consulta: HORARIO_A }).eq('id', adminA.clinicaId), 'horario A')
  const centro = await crearConsultorio(adminA, { nombre: 'Consultorio Centro (ficticio)', nombre_corto: 'Centro', direccion: 'Calle Ficticia 1, Centro, Mérida', telefono: '9990000001', timezone: TZ, horario: horarioSemana('08:00', '14:00', false) })
  const norte = await crearConsultorio(adminA, { nombre: 'Hospital Norte (ficticio)', nombre_corto: 'Hosp Norte', direccion: 'Avenida Ficticia 2, Norte, Mérida', telefono: '9990000002', timezone: TZ, horario: horarioSemana('15:00', '18:00', true) })
  const invitadoA = await invitar(PERSONAS.invitadoA, adminA)
  const rehab = await crearConsultorio(invitadoA, { nombre: 'Rehabilitación (ficticio)', nombre_corto: 'Rehab', direccion: 'Calle Ficticia 3, Mérida', telefono: null, timezone: TZ, horario: horarioSemana('08:00', '18:00', false) })
  const secretariaA = await invitar(PERSONAS.secretariaA, adminA)
  const adminB = await crearDueno(PERSONAS.adminB, NOMBRE_B)
  const b = await crearConsultorio(adminB, { nombre: 'Consultorio Clínica B (ficticio)', nombre_corto: 'Clínica B', direccion: 'Calle Ficticia 4, Mérida', telefono: null, timezone: TZ })
  const ses = { adminA, invitadoA, secretariaA, adminB }
  const pac: Contexto['pac'] = { adminA: [], invitadoA: [], adminB: [] }
  for (let i = 1; i <= 25; i++) {
    const n = String(i).padStart(2, '0')
    const quien = i <= 15 ? 'adminA' : 'invitadoA'
    pac[quien].push(await crearPaciente(i > 20 ? secretariaA : adminA, ses[quien].id, n, i))
  }
  for (let i = 1; i <= 3; i++) pac.adminB.push(await crearPaciente(adminB, adminB.id, `B${i}`, 30 + i))
  return { ses, ctx: { cons: { centro, norte, rehab, b }, pac } }
}

async function main(): Promise<void> {
  candado()
  const modo = leerModo(process.argv.slice(2))
  const t0 = Date.now()
  await borrar()
  if (modo.borrarSolo) return
  const { ses, ctx } = await sembrarEquipo()
  const t1 = Date.now()
  await sembrarCitas([...citasDeConsultaA(ctx), ...eventosA(ctx)], ses, 'adminA')
  await sembrarCitas(citasB(ctx), ses, 'adminB')
  console.log(`Siembra base: ${((Date.now() - t0) / 1000).toFixed(1)} s (equipo y pacientes ${((t1 - t0) / 1000).toFixed(1)} s). Hoy en ${TZ}: ${hoy}, semana del ${lunes}.`)
  if (modo.volumen) {
    const t2 = Date.now()
    volumen(modo.volumen, ses.adminA.clinicaId, ses.secretariaA.id)
    console.log(`Volumen: ${modo.volumen} citas extra en ${((Date.now() - t2) / 1000).toFixed(1)} s.`)
  }
  console.log('Comprobación con la sesión de cada usuario (anon key + RLS):')
  await comprobar(ses)
  await resumen([[NOMBRE_A, ses.adminA.clinicaId], [NOMBRE_B, ses.adminB.clinicaId]])
  console.log(`\nUsuarios (contraseña ficticia y local para todos: ${CONTRASENA}):`)
  for (const p of Object.values(PERSONAS)) console.log(`  ${p.email}  (${p.clave})`)
  console.log(`Total: ${((Date.now() - t0) / 1000).toFixed(1)} s.`)
}

main().catch((e: unknown) => {
  console.error(`ERROR: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
