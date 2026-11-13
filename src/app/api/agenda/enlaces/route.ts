/**
 * /api/agenda/enlaces — los enlaces de reserva de la clínica (bloque D; la
 * parte de D1 que quedó pendiente). GET lista los VIGENTES; POST crea o
 * regenera el fijo de un médico, o emite uno de un solo uso.
 *
 * Puertas comunes en `entradaGestion()`: sesión (401), clínica (403) e
 * interruptor de la agenda v2 (404). Permisos (lista A, punto 16): cada médico
 * lo suyo; administrador y secretaria, lo de todos. La RLS de
 * `reserva_enlaces` dice lo mismo y es la barrera real para leer y revocar.
 *
 * ⚠️ EL ALTA VA CON EL CLIENTE DE SERVICIO (corrección de seguridad 7a,
 * migración `20261117122000`): la base sólo deja insertar enlaces a
 * `service_role`, porque el hash del código lo tiene que calcular el servidor
 * con `RESERVA_SECRETO` y la base no puede comprobarlo. Una sola llamada, a
 * `reserva_enlace_emitir`, con `p_clinica_id` = la clínica de la sesión y
 * `p_actor` = quien la pide; la función repite la regla de las policies.
 *
 * ⚠️ EL CÓDIGO NO ESTÁ EN LA BASE: se deriva del id con `RESERVA_SECRETO`
 * (`codigoDeEnlace`). La lista NO lo lleva; se pide uno a uno a
 * `GET /api/agenda/enlaces/[id]` mientras el enlace esté vigente. El alta sí lo
 * devuelve, para enseñarlo en el momento. Sin secreto, 503 y nada se escribe:
 * un enlace cuyo código no se puede derivar no sirve para nada.
 *
 * La auditoría la da el disparador `audit_reserva_enlaces` (log_tabla_change).
 */
import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { entradaGestion } from '@/lib/reserva/gestionServidor'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  COLUMNAS_ENLACE, CrearEnlaceSchema, gestionaTodos, puedeGestionarDelMedico, respuestaErrorEnlace,
} from '@/lib/reserva/gestionReserva'
import { codigoDeEnlace, hashDeCodigo, secretoDisponible } from '@/lib/reserva/secretos'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const SIN_SECRETO = { error: 'sin_secreto', mensaje: 'La reserva por enlace no está configurada en este servidor' }

/**
 * GET — los enlaces vigentes que quien llama puede gestionar: el fijo de cada
 * médico y los de un solo uso sin usar ni caducar. Sin códigos. Los usados,
 * caducados y revocados se quedan en la base (no se borran nunca) pero no se
 * listan: ya no sirven y no hay nada que hacer con ellos.
 */
export async function GET(): Promise<NextResponse> {
  const e = await entradaGestion()
  if (!e.ok) return e.respuesta
  try {
    let q = e.supabase.from('reserva_enlaces').select(COLUMNAS_ENLACE)
      .eq('clinica_id', e.clinicaId)
      .is('revocado_en', null)
      .or(`clase.eq.fijo,and(usado_en.is.null,caduca_en.gt."${new Date().toISOString()}")`)
      .order('created_at', { ascending: false })
      .limit(200)
    if (!gestionaTodos(e.perfil)) q = q.eq('medico_id', e.perfil.id)
    const { data, error } = await q
    if (error) {
      logger.error('agenda', `enlaces de reserva sin leer: ${error.code ?? ''}`)
      return NextResponse.json({ error: 'No se pudieron leer los enlaces' }, { status: 500 })
    }
    return NextResponse.json({ enlaces: data ?? [], secreto: secretoDisponible() })
  } catch (err: unknown) {
    logger.error('agenda', `GET enlaces: ${err instanceof Error ? err.message : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/** POST — `{clase:'fijo', medico_id}` crea o regenera; `{clase:'unico', medico_id, etiqueta?}` emite. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const e = await entradaGestion()
  if (!e.ok) return e.respuesta
  try {
    const parsed = CrearEnlaceSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
    }
    const cuerpo = parsed.data
    if (!puedeGestionarDelMedico(e.perfil, cuerpo.medico_id)) {
      return NextResponse.json({ error: 'sin_permisos', mensaje: 'Sólo puedes gestionar tus propios enlaces' }, { status: 403 })
    }
    if (!secretoDisponible()) return NextResponse.json(SIN_SECRETO, { status: 503 })
    const id = randomUUID()
    const codigo = codigoDeEnlace(id)
    if (!codigo) return NextResponse.json(SIN_SECRETO, { status: 503 })
    const codigoHash = hashDeCodigo(codigo)

    // Fijo: revoca el vigente y emite otro en una transacción. Único: emite.
    const { error } = await createAdminClient().rpc('reserva_enlace_emitir', {
      p_clinica_id: e.clinicaId, p_actor: e.perfil.id, p_id: id, p_medico_id: cuerpo.medico_id,
      p_clase: cuerpo.clase, p_codigo_hash: codigoHash,
      p_etiqueta: cuerpo.clase === 'unico' ? (cuerpo.etiqueta ?? null) : null,
    })
    if (error) {
      const r = respuestaErrorEnlace(error)
      if (r.status === 500) logger.error('agenda', `enlace de reserva sin emitir: ${error.code ?? ''}`)
      return NextResponse.json(r.body, { status: r.status })
    }
    const { data: enlace, error: errLectura } = await e.supabase.from('reserva_enlaces').select(COLUMNAS_ENLACE)
      .eq('id', id).eq('clinica_id', e.clinicaId).maybeSingle()
    if (errLectura || !enlace) {
      logger.error('agenda', `enlace emitido sin releer: ${errLectura?.code ?? 'sin fila'}`)
      return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
    return NextResponse.json({ enlace, codigo }, { status: 201 })
  } catch (err: unknown) {
    logger.error('agenda', `POST enlaces: ${err instanceof Error ? err.message : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
