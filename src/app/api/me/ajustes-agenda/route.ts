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
 * Auditoría: el disparador `audit_agenda_ajustes` (`log_tabla_change`) deja
 * una fila `UPDATE` en `audit_log` por cada guardado, con quien lo hizo
 * (`auth.uid()`). No se añade un `logAudit` aparte: sería una segunda fila
 * del mismo hecho.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canManageClinica } from '@/lib/permissions'
import { AjustesAgendaSchema, COLUMNAS_AJUSTES, agendaV2Encendida } from '@/lib/agenda/ajustesAgenda'
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
  if (error.code === '23514') return NextResponse.json({ error: 'Algún ajuste está fuera de rango' }, { status: 400 })
  if (error.code === '42501') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  logger.error('agenda', `ajustes de la agenda sin guardar: ${error.code ?? ''} ${error.message ?? ''}`)
  return NextResponse.json({ error: 'No se pudieron guardar los ajustes' }, { status: 500 })
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const profile = await perfilDeSesion(supabase)
    if (!profile) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (!profile.clinica_id || !canManageClinica(profile)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
    if (!(await agendaV2Encendida(supabase, profile.clinica_id))) {
      return NextResponse.json({ error: 'no_disponible' }, { status: 404 })
    }
    const parsed = AjustesAgendaSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
    }

    const { data, error } = await supabase.from('agenda_ajustes')
      .update(parsed.data)
      .eq('clinica_id', profile.clinica_id)
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
