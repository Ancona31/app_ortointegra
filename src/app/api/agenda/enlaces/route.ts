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
import { entradaGestion, type EntradaGestion } from '@/lib/reserva/gestionServidor'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  COLUMNAS_ENLACE, CrearEnlaceSchema, gestionaTodos, puedeGestionarDelMedico, respuestaErrorEnlace,
} from '@/lib/reserva/gestionReserva'
import { codigoDeEnlace, hashDeCodigo, hmacContacto, secretoDisponible } from '@/lib/reserva/secretos'
import { normalizarCorreo } from '@/lib/reserva/contacto'
import type { z } from 'zod'
import { avisoPublicable } from '@/lib/reserva/avisoReserva'
import { preparacionDe } from '@/lib/reserva/preparacionServidor'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const SIN_SECRETO = { error: 'sin_secreto', mensaje: 'La reserva por enlace no está configurada en este servidor' }

type Gestion = Extract<EntradaGestion, { ok: true }>

/**
 * Los vigentes: el fijo y el único sin usar ni caducar y, con la migración de
 * j2 (tanda J, punto 3), sin agotar. `conAgotado: false` es el filtro de antes:
 * sin esa migración no existe `agotado_en` y ningún único está agotado.
 */
function consultaVigentes(e: Gestion, conAgotado: boolean) {
  const vivo = `usado_en.is.null,${conAgotado ? 'agotado_en.is.null,' : ''}caduca_en.gt."${new Date().toISOString()}"`
  const q = e.supabase.from('reserva_enlaces').select(COLUMNAS_ENLACE)
    .eq('clinica_id', e.clinicaId)
    .is('revocado_en', null)
    .or(`clase.eq.fijo,and(${vivo})`)
    .order('created_at', { ascending: false })
    .limit(200)
  return gestionaTodos(e.perfil) ? q : q.eq('medico_id', e.perfil.id)
}

/**
 * GET — los enlaces vigentes que quien llama puede gestionar: el fijo de cada
 * médico y los de un solo uso sin usar ni caducar. Sin códigos. Los usados,
 * caducados y revocados se quedan en la base (no se borran nunca) pero no se
 * listan: ya no sirven y no hay nada que hacer con ellos.
 *
 * Tanda T2 (punto 8): además, `aviso` (¿el aviso de la reserva es
 * publicable?; si no, no abre ningún enlace) y `preparacion`: por médico del
 * alcance, por qué su enlace no abriría (`preparacionServidor.ts`, con la
 * misma regla que la página pública). `preparacion: null` si no se pudo
 * calcular: la lista sale igual.
 */
export async function GET(): Promise<NextResponse> {
  const e = await entradaGestion()
  if (!e.ok) return e.respuesta
  try {
    const primera = await consultaVigentes(e, true)
    // Integración J (tolerancia): sin la migración de j2 la columna no existe (42703); se lee como antes.
    const { data, error } = primera.error?.code === '42703' ? await consultaVigentes(e, false) : primera
    if (error) {
      logger.error('agenda', `enlaces de reserva sin leer: ${error.code ?? ''}`)
      return NextResponse.json({ error: 'No se pudieron leer los enlaces' }, { status: 500 })
    }
    const enlaces = data ?? []
    const secreto = secretoDisponible()
    const aviso = avisoPublicable()
    const preparacion = await preparacionDe(e.supabase, e.clinicaId, e.perfil, enlaces, secreto && aviso)
    return NextResponse.json({ enlaces, secreto, aviso, preparacion })
  } catch (err: unknown) {
    logger.error('agenda', `GET enlaces: ${err instanceof Error ? err.message : 'error'}`)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * Tanda J, punto 3: el correo opcional del único, recortado, con su seudónimo
 * (el MISMO HMAC que el fijo calcula al verificar). `null` = sin correo.
 */
function correoDelUnico(cuerpo: z.output<typeof CrearEnlaceSchema>): { correo: string; hmac: string } | null | 'invalido' {
  if (cuerpo.clase !== 'unico' || !cuerpo.correo) return null
  const llave = normalizarCorreo(cuerpo.correo)
  const hmac = llave ? hmacContacto('correo', llave) : null
  return hmac ? { correo: cuerpo.correo.trim(), hmac } : 'invalido'
}

/**
 * Emite con `reserva_enlace_emitir` de 9 argumentos (j2). Integración J
 * (tolerancia): sin la migración de j2 esa firma no existe (PGRST202); SIN
 * correo, la de 7 argumentos es la misma emisión y se usa ésa. CON correo, no:
 * un único cuyo correo no se guardara no mandaría el comprobante a nadie.
 */
async function emitirEnBase(args: Record<string, string | null>, correo: { correo: string; hmac: string } | null) {
  const admin = createAdminClient()
  const r = await admin.rpc('reserva_enlace_emitir', { ...args, p_correo: correo?.correo ?? null, p_correo_hmac: correo?.hmac ?? null })
  if (r.error?.code !== 'PGRST202' || correo) return r
  logger.warn('agenda', 'reserva_enlace_emitir de 9 argumentos ausente: se emite con la de 7 (falta la migración de j2)')
  return admin.rpc('reserva_enlace_emitir', args)
}

/** POST — `{clase:'fijo', medico_id}` crea o regenera; `{clase:'unico', medico_id, etiqueta?, correo?}` emite. */
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
    const correo = correoDelUnico(cuerpo)
    if (correo === 'invalido') return NextResponse.json({ error: 'Revisa el correo del paciente' }, { status: 400 })

    // Fijo: revoca el vigente y emite otro en una transacción. Único: emite.
    const { error } = await emitirEnBase({
      p_clinica_id: e.clinicaId, p_actor: e.perfil.id, p_id: id, p_medico_id: cuerpo.medico_id,
      p_clase: cuerpo.clase, p_codigo_hash: codigoHash,
      p_etiqueta: cuerpo.clase === 'unico' ? (cuerpo.etiqueta ?? null) : null,
    }, correo)
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
