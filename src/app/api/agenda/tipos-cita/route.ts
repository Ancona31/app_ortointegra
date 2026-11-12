/**
 * /api/agenda/tipos-cita — listar (GET) y crear (POST) tipos de cita.
 * Agenda B6 (decisión P5). Detrás del interruptor de la agenda v2: apagado
 * —o sin la tabla de ajustes— responde 404 sin tocar `tipos_cita`, así que
 * estas rutas no fallan aunque la migración 20261112150000 no esté aplicada.
 *
 * ⚠️ CLIENTE DE SESIÓN, NUNCA `createAdminClient()`. La RLS de `tipos_cita`
 * decide quién ve qué (el invitado no ve los tipos personales de otros
 * médicos) y quién escribe (sólo el administrador de la clínica). El
 * `eq('clinica_id')` es explícito aunque la RLS ya filtre.
 *
 * La auditoría la da el disparador `audit_tipos_cita` (log_tabla_change).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { canManageClinica } from '@/lib/permissions'
import { agendaV2Encendida } from '@/lib/agenda/ajustesAgenda'
import { COLUMNAS_TIPO_CITA, CrearTipoCitaSchema, respuestaErrorTipoCita } from '@/lib/agenda/tiposCita'
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

const ConsultaSchema = z.strictObject({
  incluir_archivados: z.enum(['0', '1']).optional(),
  medico_id: z.guid().optional(),
})

/**
 * GET /api/agenda/tipos-cita[?medico_id=<uuid>][&incluir_archivados=1]
 * Lo que la RLS deja ver de la clínica, ordenado por nombre. Con `medico_id`,
 * sólo los compatibles con ese médico (de clínica o suyos); por omisión, sólo
 * los activos. Cualquier miembro de la clínica (P7: solo lectura para quien no
 * administra).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const profile = await perfilDeSesion(supabase)
    if (!profile?.clinica_id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (!(await agendaV2Encendida(supabase, profile.clinica_id))) {
      return NextResponse.json({ error: 'no_disponible' }, { status: 404 })
    }
    const consulta = ConsultaSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!consulta.success) return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
    const { incluir_archivados, medico_id } = consulta.data

    let q = supabase.from('tipos_cita').select(COLUMNAS_TIPO_CITA)
      .eq('clinica_id', profile.clinica_id).order('nombre')
    if (incluir_archivados !== '1') q = q.eq('activo', true)
    // medico_id ya pasó por z.guid(): sólo hex y guiones, no puede inyectar en el filtro.
    if (medico_id) q = q.or(`medico_id.is.null,medico_id.eq.${medico_id}`)
    const { data, error } = await q
    if (error) {
      logger.error('agenda', `tipos de cita sin leer: ${error.code ?? ''} ${error.message}`)
      return NextResponse.json({ error: 'No se pudieron leer los tipos de cita' }, { status: 500 })
    }
    return NextResponse.json({ tipos: data ?? [] })
  } catch (err: unknown) {
    logger.error('agenda', `GET tipos de cita: ${err instanceof Error ? err.message : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/agenda/tipos-cita — crea un tipo. Sólo el administrador de la
 * clínica (403), con la agenda v2 encendida (404). `clinica_id` sale del
 * perfil, nunca del cuerpo. 409 si el nombre ya está activo en ese ámbito; 400
 * si el médico no es de la clínica (lo comprueba `validar_tipo_cita_medico`).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
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
    const parsed = CrearTipoCitaSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
    }
    const { nombre, duracion_min, color, medico_id } = parsed.data

    const { data, error } = await supabase.from('tipos_cita')
      .insert({ clinica_id: profile.clinica_id, medico_id: medico_id ?? null, nombre, duracion_min, color: color ?? null })
      .select(COLUMNAS_TIPO_CITA)
      .single()
    if (error) {
      const r = respuestaErrorTipoCita(error)
      if (r.status === 500) logger.error('agenda', `tipo de cita sin crear: ${error.code ?? ''} ${error.message}`)
      return NextResponse.json(r.body, { status: r.status })
    }
    return NextResponse.json({ tipo: data }, { status: 201 })
  } catch (err: unknown) {
    logger.error('agenda', `POST tipos de cita: ${err instanceof Error ? err.message : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
