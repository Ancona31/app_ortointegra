/**
 * POST /api/appointments/[id]/reagendar — «Reagendar» de la CLÍNICA para una
 * cita reservada por enlace (tanda I, punto 9 de Angel).
 *
 * En una cita por enlace que aún no empieza, consultorio, día y hora son lo
 * que el paciente eligió: el formulario y el arrastre no los cambian (PUT,
 * `vetoPorEleccion`; la base, `cita_proteger_eleccion`). Ésta es la única vía:
 *   1. sesión, clínica e interruptor (`entradaGestion`: 401/403/404);
 *   2. `confirmado: true` en el cuerpo (la pantalla lo pide explícitamente);
 *   3. la cita con la SESIÓN (RLS de `appointments`; 404 si no la ve) y por
 *      enlace (409 `no_aplica`);
 *   4. orden y tope de duración de una cita (400) y empalmes (B7: 409 con la
 *      lista; se aceptan y se reenvía, como en el PUT);
 *   5. `cita_reagendar_clinica` (service_role, `eleccionServidor.ts`): repite
 *      la regla de `appointments_update` con el actor, bloquea la cita, exige
 *      el mismo médico y la versión que vio la pantalla, escribe y audita;
 *   6. el AVISO al paciente: el correo de cambio (datos nuevos y su enlace de
 *      confirmar o cancelar, `enviarConfirmacionCita(…, { cambio: true })`)
 *      si la cita tiene correo; si no, la respuesta lo dice (`sin_correo`) y
 *      la pantalla ofrece el WhatsApp manual;
 *   7. Google, después de responder: el evento con la hora nueva
 *      (`reflejarEnGoogle`, sin avisar a los invitados).
 * El médico NUNCA cambia aquí: si lo atenderá otro, se cancela y se reserva.
 */
import { after, NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { entradaGestion, type ClienteSesion } from '@/lib/reserva/gestionServidor'
import { comprobarTopeDuracion } from '@/lib/agenda/topeDuracion'
import { comprobarEmpalmes } from '@/lib/agenda/empalmesServidor'
import { caeEnBloqueo, CUERPO_HORARIO_BLOQUEADO } from '@/lib/agenda/bloqueoTotalServidor'
import { reagendarCita, type ResultadoReagendar } from '@/lib/agenda/eleccionServidor'
import { correoParaConfirmacion } from '@/lib/agenda/whatsappCita'
import { enviarConfirmacionCita } from '@/lib/confirmacion/confirmacionCita'
import { reflejarEnGoogle } from '@/lib/confirmacion/googleConfirmacion'
import { registrarAvisoDelServidor } from '@/lib/avisos/avisoDelServidor'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const SIN_CACHE = { 'Cache-Control': 'no-store' } as const
const CuerpoSchema = z.strictObject({
  consultorio_id: z.guid(),
  start_time: z.iso.datetime({ offset: true }),
  end_time: z.iso.datetime({ offset: true }),
  /** El `updated_at` que vio la pantalla (409 `modificada` si otro escribió antes). */
  updated_at: z.string().min(1).max(64).nullable().optional(),
  /** B7: los empalmes que la persona ya vio y aceptó (los valida `comprobarEmpalmes`). */
  empalmes_aceptados: z.array(z.string()).max(50).optional(),
  /** La confirmación explícita de la pantalla. Sin ella no se reagenda. */
  confirmado: z.literal(true),
})

const CitaSchema = z.object({
  id: z.string(),
  medico_id: z.string().nullable(),
  status: z.string(),
  paciente_id: z.string().nullable(),
  reserva_canal: z.string().nullable(),
  reserva_correo: z.string().nullable(),
  google_event_id: z.string().nullable(),
  gcal_etag: z.string().nullable(),
  /* Integración M: el nombre del saludo del aviso de cambio. Opcionales, como en `/api/agenda/correo`. */
  reserva_nombre: z.string().nullable().optional(),
  pacientes: z.object({ email: z.string().nullable(), nombre: z.string().nullable().optional() }).nullable(),
})
type CitaReagendar = z.infer<typeof CitaSchema>

function json(cuerpo: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(cuerpo, { status, headers: SIN_CACHE })
}

/** La cita con la RLS de quien pide. null si no existe o no la deja ver; lanza si la lectura falla. */
async function leerCita(supabase: ClienteSesion, clinicaId: string, citaId: string): Promise<CitaReagendar | null> {
  const { data, error } = await supabase.from('appointments')
    .select('id, medico_id, status, paciente_id, reserva_canal, reserva_correo, reserva_nombre, google_event_id, gcal_etag, pacientes(email, nombre)')
    .eq('id', citaId).eq('clinica_id', clinicaId).maybeSingle()
  if (error) throw new Error(`cita para reagendar sin leer: ${error.code ?? ''}`)
  if (!data) return null
  const p = CitaSchema.safeParse(data)
  if (!p.success) throw new Error('cita para reagendar: forma inesperada')
  return p.data
}

const MENSAJES: Readonly<Record<Exclude<ResultadoReagendar, 'ok'>, { status: number; message: string }>> = {
  sin_cambio: { status: 409, message: 'No cambiaste el consultorio, el día ni la hora.' },
  apagado: { status: 404, message: 'La agenda v2 no está encendida.' },
  sin_permiso: { status: 403, message: 'No puedes reagendar esta cita.' },
  no_aplica: { status: 409, message: 'Esta cita no se reservó por enlace: edítala desde el formulario.' },
  estado_no_admite: { status: 409, message: 'Sólo se reagenda una cita agendada o confirmada.' },
  pasada: { status: 409, message: 'La cita ya empezó: corrígela desde el formulario.' },
  modificada: { status: 409, message: 'Esta cita cambió mientras la tenías abierta. Ciérrala y vuelve a abrirla.' },
  hora_pasada: { status: 400, message: 'La hora nueva ya pasó.' },
  consultorio_invalido: { status: 400, message: 'Ese consultorio no es del médico de la cita o no está activo.' },
}

/** El aviso al paciente: correo si tiene; si no, `sin_correo` (la pantalla ofrece WhatsApp). Nunca lanza. */
async function avisarAlPaciente(clinicaId: string, cita: CitaReagendar, perfilId: string): Promise<'enviado' | 'sin_correo' | 'no_enviado'> {
  if (!correoParaConfirmacion(cita.pacientes?.email, cita.reserva_correo)) return 'sin_correo'
  // Integración M: el saludo con la misma regla que `/api/agenda/correo` (el paciente ligado y, si no, la reserva).
  const nombre = cita.pacientes?.nombre?.trim() || cita.reserva_nombre?.trim() || null
  const r = await enviarConfirmacionCita(clinicaId, cita.id, perfilId, { cambio: true, nombre })
  if (r.tipo !== 'enviado') return 'no_enviado'
  await logAudit({ userId: perfilId, accion: 'enviar_confirmacion_cita', tabla: 'appointments', registroId: cita.id,
    descripcion: 'Aviso de cambio de la cita por correo (reagendar)' })
  return 'enviado'
}

/** Lo que el cuerpo pide, ya validado contra la regla de una cita (400) y los empalmes (409). null = sigue. */
async function vetoDelCuerpo(supabase: ClienteSesion, clinicaId: string, cita: CitaReagendar, b: z.infer<typeof CuerpoSchema>): Promise<NextResponse | null> {
  if (!cita.reserva_canal) return json({ error: 'no_aplica', message: MENSAJES.no_aplica.message }, 409)
  if (!(new Date(b.end_time) > new Date(b.start_time))) {
    return json({ error: 'rango_invalido', message: 'El fin de la cita tiene que ir después del inicio.' }, 400)
  }
  const tope = comprobarTopeDuracion(b.start_time, b.end_time, true)
  if (tope) return json({ ...tope }, 400)
  if (!cita.medico_id) return json({ error: 'no_aplica', message: MENSAJES.no_aplica.message }, 409)
  // L1 (punto 6): tampoco con «Reagendar». Antes del empalme; la base lo repite.
  if (await caeEnBloqueo(supabase, { clinicaId, medicoId: cita.medico_id, inicio: b.start_time, fin: b.end_time })) {
    return json({ ...CUERPO_HORARIO_BLOQUEADO }, 409)
  }
  const empalme = await comprobarEmpalmes(supabase,
    { clinicaId, medicoId: cita.medico_id, inicio: b.start_time, fin: b.end_time, excluirId: cita.id }, b.empalmes_aceptados ?? [])
  return empalme.ok ? null : json(empalme.cuerpo, empalme.status)
}

export async function POST(req: NextRequest, ctx: RouteContext<'/api/appointments/[id]/reagendar'>): Promise<NextResponse> {
  const e = await entradaGestion()
  if (!e.ok) return e.respuesta
  const { id } = await ctx.params
  const p = CuerpoSchema.safeParse(await req.json().catch(() => null))
  if (!p.success || !z.guid().safeParse(id).success) return json({ error: 'cuerpo_invalido' }, 400)
  try {
    const cita = await leerCita(e.supabase, e.clinicaId, id)
    if (!cita) return json({ error: 'Cita no encontrada' }, 404)
    const veto = await vetoDelCuerpo(e.supabase, e.clinicaId, cita, p.data)
    if (veto) return veto
    const r = await reagendarCita({ clinicaId: e.clinicaId, actorId: e.perfil.id, citaId: id, consultorioId: p.data.consultorio_id,
      inicio: p.data.start_time, fin: p.data.end_time, esperado: p.data.updated_at ?? null })
    if (r.tipo === 'ausente') return json({ error: 'no_disponible' }, 503)
    if (r.tipo === 'bloqueado') return json({ ...CUERPO_HORARIO_BLOQUEADO }, 409)
    if (r.tipo === 'error') return json({ error: 'Error interno' }, 500)
    if (r.resultado !== 'ok') return json({ error: r.resultado, message: MENSAJES[r.resultado].message }, MENSAJES[r.resultado].status)
    const eventId = cita.google_event_id
    if (eventId) after(() => reflejarEnGoogle({ clinicaId: e.clinicaId, citaId: id, eventId, etag: cita.gcal_etag }, e.perfil.id))
    /* Avisos globales: el personal movió la cita de OTRO médico. La RPC escribe con `service_role`, sin
       `auth.uid()`, y el disparador no sabe quién fue: lo dice el servidor. Dirigido sólo a ese médico. */
    if (cita.medico_id && cita.medico_id !== e.perfil.id) {
      after(() => registrarAvisoDelServidor({ tipo: 'personal_movio', clinicaId: e.clinicaId, citaId: id, actorId: e.perfil.id }))
    }
    return json({ updated_at: r.updatedAt, correo: await avisarAlPaciente(e.clinicaId, cita, e.perfil.id) })
  } catch (err: unknown) {
    logger.error('agenda', `POST reagendar: ${err instanceof Error ? err.name : 'error'}`)
    return json({ error: 'Error interno' }, 500)
  }
}
