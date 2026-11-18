/**
 * POST /api/agenda/bloqueos — K1 (tanda K, sección A) · crea un bloqueo de
 * horario: un periodo, de horas o de días completos, de un médico, con un
 * motivo opcional. NO es una cita ni un evento (no es `appointments`).
 *
 * Detrás de la agenda v2 (404 apagada o sin la tabla). Cliente de SESIÓN: la
 * RLS de `agenda_bloqueos` decide (quien hoy puede agendar para ese médico,
 * con las puertas de suscripción); el permiso de aquí es la misma regla, para
 * contestar 403. `clinica_id` sale del perfil, nunca del cuerpo. La auditoría
 * la da el disparador `audit_agenda_bloqueos`.
 *
 * Punto 5: no toca las citas que ya hubiera; responde cuántas hay (`citas`).
 * Punto 6: el evento «Ocupado» de Google se manda en `after()`.
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canManageClinica } from '@/lib/permissions'
import { agendaV2Encendida } from '@/lib/agenda/ajustesAgenda'
import { resolverConexionClinica } from '@/lib/gcalConexion'
import { empujarBloqueo, type BloqueoParaGoogle } from '@/lib/agenda/bloqueosGoogle'
import {
  COLUMNAS_BLOQUEO_RUTA, CrearBloqueoSchema, citasEnPeriodo, columnasDePuntas, perfilBloqueo, puedeBloquear, respuestaErrorBloqueo,
} from '@/lib/agenda/bloqueosServidor'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const perfil = await perfilBloqueo(supabase)
    if (!perfil) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const parsed = CrearBloqueoSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    const clinicaId = perfil.clinica_id
    if (!clinicaId || !puedeBloquear(perfil, parsed.data.medico_id)) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    if (!(await agendaV2Encendida(supabase, clinicaId))) return NextResponse.json({ error: 'no_disponible' }, { status: 404 })
    const columnas = columnasDePuntas(parsed.data)
    const { data, error } = await supabase.from('agenda_bloqueos')
      .insert({ clinica_id: clinicaId, medico_id: parsed.data.medico_id, ...columnas })
      .select(COLUMNAS_BLOQUEO_RUTA).single<BloqueoParaGoogle & { medico_id: string }>()
    if (error || !data) {
      const r = respuestaErrorBloqueo(error ?? {})
      if (r.status === 500) logger.error('agenda', `bloqueo sin crear: ${error?.code ?? 'sin fila'}`)
      return NextResponse.json({ error: r.error }, { status: r.status })
    }
    const citas = await citasEnPeriodo(supabase, clinicaId, data.medico_id, data.inicio, data.fin)
    const conexion = await resolverConexionClinica(supabase, clinicaId)
    if (conexion) {
      const ctx = { conexion, admin: createAdminClient(), puedeReparar: canManageClinica(perfil), actorId: perfil.userId }
      after(() => empujarBloqueo(data, ctx))
    }
    return NextResponse.json({ bloqueo: data, citas }, { status: 201 })
  } catch (err: unknown) {
    logger.error('agenda', `POST bloqueo: ${err instanceof Error ? err.message : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
