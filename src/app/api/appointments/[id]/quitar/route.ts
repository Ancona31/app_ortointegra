/**
 * POST /api/appointments/[id]/quitar — «Eliminar cita» de una cita CANCELADA
 * (tanda L, punto 9 de Angel): la quita de la agenda SIN borrarla. Queda
 * CERRADA (`cerrada_en`) y sin sustituta, como al reasignar (tanda I, punto
 * 12) pero sin cita nueva; en la base y en la auditoría. Sin cuerpo.
 *
 * Puertas, en este orden:
 *   1. `entradaGestion()`: sesión con `getUser()` (401), perfil con clínica
 *      (403) e interruptor de la v2 de ESA clínica (404 apagado o sin tabla).
 *   2. El id con forma de uuid (400).
 *   3. La cita con el cliente de SESIÓN y `clinica_id` explícito: qué cita se
 *      ve lo decide la RLS de `appointments`; 404 si no la ve. Sin la columna
 *      (migración 20261121142000): 503 `no_disponible`.
 *   4. El rol, en el servidor: administrador o secretaria, o el médico de la
 *      cita (`puedeGestionarDelMedico`, la misma regla que «¿No es una cita?»).
 *   5. Sólo una cancelada: ya cerrada, 200 (dos clics desde dos sitios no son
 *      un error); cualquier otro estado, 409 `no_aplica`.
 *
 * El cierre: ⚠️ CLIENTE DE SERVICIO, filtrado por `clinica_id` de la sesión,
 * por el id y por «cancelada y abierta» (como `cerrarSustituida`). Por qué: las
 * columnas del cierre sólo las escribe `service_role` (`cita_proteger_cierre`),
 * para que la sesión no pueda esconder citas por PostgREST. Sin la migración
 * 20261124130000 la base rechaza el cierre sin sustituta (42501/23514): 409
 * `no_aplica`, y la cita se queda como estaba.
 *
 * NO se borra: `cita_proteger_borrado` no se toca. No se deshace desde la app
 * (una cerrada no se reabre, ni con la sesión ni con el servidor); sólo
 * `postgres`, en el editor SQL.
 *
 * Auditoría: `cita_quitada_de_agenda` por `logAudit`, a nombre de quien pulsó
 * (clínica y NOMBRE del campo), y la `cita_editada` del disparador de citas.
 * Todos lo ven quitarse en tiempo real: el eco de Realtime trae `cerrada_en` y
 * `useTiempoRealAgenda` la saca de la rejilla.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { entradaGestion, type ClienteSesion } from '@/lib/reserva/gestionServidor'
import { puedeGestionarDelMedico } from '@/lib/reserva/gestionReserva'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const SIN_CACHE = { 'Cache-Control': 'no-store' } as const

const CitaSchema = z.object({
  medico_id: z.string().nullable(),
  status: z.string(),
  cerrada_en: z.string().nullable(),
})
type CitaCierre = z.infer<typeof CitaSchema>

function json(cuerpo: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(cuerpo, { status, headers: SIN_CACHE })
}

/** La columna aún no existe en esta base (42703 de Postgres o PGRST204/PGRST100 de PostgREST). */
function sinColumna(code: string | undefined): boolean {
  return code === '42703' || code === 'PGRST204' || code === 'PGRST100'
}

type Lectura = { tipo: 'cita'; cita: CitaCierre } | { tipo: 'no_encontrada' } | { tipo: 'sin_columna' }

/** La cita con la RLS de quien llama. Lanza si la lectura falla por otra cosa. */
async function leerCita(supabase: ClienteSesion, clinicaId: string, citaId: string): Promise<Lectura> {
  const { data, error } = await supabase.from('appointments')
    .select('medico_id, status, cerrada_en')
    .eq('id', citaId).eq('clinica_id', clinicaId).maybeSingle()
  if (error) {
    if (sinColumna(error.code)) return { tipo: 'sin_columna' }
    throw new Error(`cita sin leer: ${error.code ?? ''}`)
  }
  if (!data) return { tipo: 'no_encontrada' }
  const p = CitaSchema.safeParse(data)
  if (!p.success) throw new Error('cita: forma inesperada')
  return { tipo: 'cita', cita: p.data }
}

/** El cierre sin sustituta, condicionado a que siga cancelada y abierta. true = cerró ESTA petición. */
async function cerrar(clinicaId: string, citaId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from('appointments')
    .update({ cerrada_en: new Date().toISOString() })
    .eq('id', citaId).eq('clinica_id', clinicaId).eq('status', 'cancelled').is('cerrada_en', null)
    .select('id')
  if (error) {
    // Sin 20261124130000 la base no deja cerrar sin sustituta: no aplica, no es un fallo.
    if (error.code === '42501' || error.code === '23514') return false
    throw new Error(`cita sin quitar: ${error.code ?? ''}`)
  }
  return (data ?? []).length === 1
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const e = await entradaGestion()
  if (!e.ok) return e.respuesta
  const { id } = await ctx.params
  if (!z.guid().safeParse(id).success) return json({ error: 'id_invalido' }, 400)
  try {
    const l = await leerCita(e.supabase, e.clinicaId, id)
    if (l.tipo === 'sin_columna') return json({ error: 'no_disponible' }, 503)
    if (l.tipo === 'no_encontrada') return json({ error: 'Cita no encontrada' }, 404)
    const { cita } = l
    if (!puedeGestionarDelMedico(e.perfil, cita.medico_id)) return json({ error: 'Sin permisos' }, 403)
    if (cita.cerrada_en) return json({ quitada: true })
    if (cita.status !== 'cancelled') return json({ error: 'no_aplica' }, 409)
    if (!(await cerrar(e.clinicaId, id))) {
      /* Otra persona la cerró entre la lectura y el cierre: ya está fuera, como se pedía. */
      const otra = await leerCita(e.supabase, e.clinicaId, id)
      return otra.tipo === 'cita' && otra.cita.cerrada_en ? json({ quitada: true }) : json({ error: 'no_aplica' }, 409)
    }
    await logAudit({
      userId: e.perfil.id, accion: 'cita_quitada_de_agenda', tabla: 'appointments', registroId: id,
      descripcion: JSON.stringify({ clinica: e.clinicaId, campos: ['cerrada_en'] }),
    })
    return json({ quitada: true })
  } catch (err: unknown) {
    logger.error('agenda', `POST quitar: ${err instanceof Error ? err.message : 'error'}`)
    return json({ error: 'Error interno' }, 500)
  }
}
