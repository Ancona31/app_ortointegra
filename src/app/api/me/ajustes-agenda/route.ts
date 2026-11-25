/**
 * PUT /api/me/ajustes-agenda — los cuatro ajustes de la agenda de la clínica
 * (`mejora_agendaV2.md` §2, «Ajustes editables por clínica»; plan del bloque
 * B, paso B4). Detrás del interruptor de la agenda v2: apagado —o sin la tabla
 * `agenda_ajustes`— responde 404 sin tocar nada.
 *
 * ⚠️⚠️ NUNCA ESCRIBE `agenda_v2_encendida` NI `candado_*`. Dos barreras, y las
 * dos hacen falta: `AjustesAgendaSchema` es `strictObject` (una clave de más =
 * 400 antes de llegar a la base) y el disparador `trg_agenda_ajustes_proteger`
 * rechaza con 42501 a quien no sea `postgres`/`supabase_admin`. No conviertas
 * esto en una función `SECURITY DEFINER`: correría como su dueño, `postgres`, y
 * el disparador la dejaría pasar (aviso de la auditoría de B1).
 *
 * ⚠️ CLIENTE DE SESIÓN, NUNCA `createAdminClient()`. La RLS de
 * `agenda_ajustes` deja escribir sólo al administrador de SU clínica; el
 * `eq('clinica_id')` es explícito aunque la RLS ya filtre.
 *
 * Sólo UPDATE, nunca INSERT: con el interruptor encendido la fila existe (es
 * donde vive el interruptor), así que una clínica sin fila ya respondió 404.
 *
 * PATCH (tanda H, punto 9): SÓLO el interruptor del recordatorio automático
 * por correo, `{ recordatorio_encendido: boolean }`. Mismas puertas y misma
 * RLS que el PUT (lo cambia quien cambia los plazos). Sin la migración
 * `20261120120000` la columna no existe: 503 sin tocar nada.
 * I5 (punto 20): o, con la misma forma, SÓLO el del correo a la clínica por
 * cada reserva, `{ correo_reserva_clinica: boolean }` (migración
 * `20261121150000`; sin ella, 503). Una clave por petición.
 *
 * Auditoría: el disparador `audit_agenda_ajustes` (`log_tabla_change`) deja
 * una fila `UPDATE` en `audit_log` por cada guardado, con quien lo hizo
 * (`auth.uid()`). No se añade un `logAudit` aparte: sería una segunda fila
 * del mismo hecho.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canManageClinica } from '@/lib/permissions'
import {
  AjustesAgendaSchema, COLUMNAS_AJUSTES, CorreoReservaClinicaSchema, RecordatorioEncendidoSchema, agendaV2Encendida,
} from '@/lib/agenda/ajustesAgenda'
import { logger } from '@/lib/logger'

type ClienteSesion = Awaited<ReturnType<typeof createClient>>

async function perfilDeSesion(supabase: ClienteSesion) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select('clinica_id, role, es_admin_de_clinica')
    .eq('id', user.id)
    .single()
  return data ? { ...data, userId: user.id } : null
}

/** Traduce el error de Postgres al guardar. Nunca devuelve el mensaje crudo. */
function respuestaError(error: { code?: string; message?: string }): NextResponse {
  /* 42703 (Postgres) o PGRST204 (PostgREST): la columna del recordatorio aún no existe en esta base. */
  if (error.code === '42703' || error.code === 'PGRST204') return NextResponse.json({ error: 'no_disponible' }, { status: 503 })
  if (error.code === '23514') return NextResponse.json({ error: 'Algún ajuste está fuera de rango' }, { status: 400 })
  if (error.code === '42501') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  logger.error('agenda', `ajustes de la agenda sin guardar: ${error.code ?? ''} ${error.message ?? ''}`)
  return NextResponse.json({ error: 'No se pudieron guardar los ajustes' }, { status: 500 })
}

/** Las puertas de las dos escrituras: sesión, administrador de la clínica e interruptor de la v2. */
async function puertas(): Promise<{ ok: true; supabase: ClienteSesion; clinicaId: string } | { ok: false; respuesta: NextResponse }> {
  const supabase = await createClient()
  const profile = await perfilDeSesion(supabase)
  if (!profile) return { ok: false, respuesta: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  if (!profile.clinica_id || !canManageClinica(profile)) {
    return { ok: false, respuesta: NextResponse.json({ error: 'Sin permisos' }, { status: 403 }) }
  }
  if (!(await agendaV2Encendida(supabase, profile.clinica_id))) {
    return { ok: false, respuesta: NextResponse.json({ error: 'no_disponible' }, { status: 404 }) }
  }
  return { ok: true, supabase, clinicaId: profile.clinica_id }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const p = await puertas()
    if (!p.ok) return p.respuesta
    const parsed = AjustesAgendaSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
    }

    const { data, error } = await p.supabase.from('agenda_ajustes')
      .update(parsed.data)
      .eq('clinica_id', p.clinicaId)
      .select(COLUMNAS_AJUSTES)
      .maybeSingle()
    if (error) return respuestaError(error)
    if (!data) return NextResponse.json({ error: 'no_disponible' }, { status: 404 })
    return NextResponse.json({ ajustes: data })
  } catch (err: unknown) {
    logger.error('agenda', `PUT ajustes de la agenda: ${err instanceof Error ? err.message : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/** I5 · El interruptor del correo a la clínica: el mismo UPDATE de una columna que el del recordatorio. */
async function guardarCorreoClinica(supabase: ClienteSesion, clinicaId: string, valor: boolean): Promise<NextResponse> {
  const { data, error } = await supabase.from('agenda_ajustes')
    .update({ correo_reserva_clinica: valor })
    .eq('clinica_id', clinicaId)
    .select('correo_reserva_clinica')
    .maybeSingle()
  if (error) return respuestaError(error)
  if (!data) return NextResponse.json({ error: 'no_disponible' }, { status: 404 })
  return NextResponse.json({ correo_reserva_clinica: data.correo_reserva_clinica === true })
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const p = await puertas()
    if (!p.ok) return p.respuesta
    const cuerpo: unknown = await req.json().catch(() => null)
    const correo = CorreoReservaClinicaSchema.safeParse(cuerpo)
    if (correo.success) return await guardarCorreoClinica(p.supabase, p.clinicaId, correo.data.correo_reserva_clinica)
    const parsed = RecordatorioEncendidoSchema.safeParse(cuerpo)
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    const { data, error } = await p.supabase.from('agenda_ajustes')
      .update(parsed.data)
      .eq('clinica_id', p.clinicaId)
      .select('recordatorio_encendido')
      .maybeSingle()
    if (error) return respuestaError(error)
    if (!data) return NextResponse.json({ error: 'no_disponible' }, { status: 404 })
    return NextResponse.json({ recordatorio_encendido: data.recordatorio_encendido === true })
  } catch (err: unknown) {
    logger.error('agenda', `PATCH recordatorio de la agenda: ${err instanceof Error ? err.message : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
