/**
 * GET /api/cron/google-sync — la tarea programada de la sincronización de
 * vuelta con Google (bloque C, paso C7 de `mejora_agendaV2.md`).
 *
 * La llama Vercel Cron cada 10 min (`vercel.json`, decisión C-g: plan Pro). NO
 * está activa: hace falta que Angel defina `CRON_SECRET` en Production y
 * despliegue. Sin la variable, todo responde 401.
 *
 * ── S2 (decisión de Angel, §6-bis), punto por punto ─────────────────────────
 * · PÚBLICA en el middleware (entrada EXACTA, no prefijo), porque Vercel no
 *   manda cookie y no sigue redirecciones: sin esa entrada recibiría un 302 a
 *   /login y fallaría en silencio. La autenticación es `CRON_SECRET`, aquí.
 * · El secreto se compara en TIEMPO CONSTANTE (`autorizada()`, extraída a
 *   `src/lib/cronAutorizacion.ts` en E4 para compartirla con
 *   `/api/cron/recordatorios`; plan_E lista A 19).
 * · La respuesta NO LLEVA NINGÚN DATO: `{ ok: true }`, 401 o 500 sin cuerpo.
 *   Ni conteos, ni ids, ni errores. Lo que pasó queda en `gcal_sync_estado`
 *   (`ultimo_error`, códigos fijos) y en la auditoría.
 * · Esta ruta no consulta la base por sí misma ni crea clientes de servicio.
 *   Su única lectura entre clínicas es `listarConexionesParaSincronizar` (sin
 *   secretos). Todo lo demás lo hace `sincronizarClinica`, por RPC con
 *   `p_clinica_id`, y el `clinicaId` sale del listado, nunca de la petición.
 * · Interruptor y acceso (S3): el listado sólo trae clínicas con la agenda v2
 *   encendida; la puerta de acceso la evalúa `sincronizarClinica` con
 *   `gcal_sync_clinica_habilitada` tras tomar el candado (`sin_acceso`).
 * · Candado e idempotencia: los de C1. Vercel puede lanzar dos instancias a la
 *   vez o repetir una ejecución; el candado con testigo (`gcal_sync_tomar`)
 *   deja a la segunda sin nada que hacer, y `MIN_INTERVALO_SEG` evita que
 *   repita una clínica que la primera acaba de terminar.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { autorizada } from '@/lib/cronAutorizacion'
import { listarConexionesParaSincronizar } from '@/lib/gcalConexion'
import { sincronizarClinica, type EstadoSincronizacion } from '@/lib/gcalSincronizacion'
import { logger } from '@/lib/logger'

// Vercel lo pide para que cada invocación ejecute la función y no sirva una
// respuesta en caché (documentación de Cron Jobs, «Troubleshooting»).
export const dynamic = 'force-dynamic'
// Segundos. El presupuesto de abajo deja 15 s de margen para la última página.
export const maxDuration = 60

/** Presupuesto total de la ejecución, en ms. */
const PRESUPUESTO_TOTAL_MS = 45_000
/** Tope por clínica, para que una sincronización completa no acapare la ejecución. */
const TOPE_POR_CLINICA_MS = 15_000
/** Por debajo de esto no se empieza otra clínica: tomaría el candado para soltarlo. */
const MINIMO_PARA_EMPEZAR_MS = 5_000
/** El máximo que acepta `gcal_sync_clinicas_pendientes`; el presupuesto corta antes. */
const LIMITE_LISTADO = 100
/** Caducidad del candado: más que `maxDuration`, por si la función muere a media página. */
const LEASE_SEG = 90
/** Igual que el sondeo al abrir la agenda: una ejecución repetida no rehace lo recién hecho. */
const MIN_INTERVALO_SEG = 60

const SIN_CACHE = { 'Cache-Control': 'no-store' } as const

/** Recorre las clínicas en serie dentro del presupuesto. Devuelve los estados, sólo para el log. */
async function recorrerClinicas(inicio: number): Promise<EstadoSincronizacion[]> {
  const estados: EstadoSincronizacion[] = []
  const conexiones = await listarConexionesParaSincronizar(LIMITE_LISTADO)
  for (const conexion of conexiones) {
    const restante = PRESUPUESTO_TOTAL_MS - (Date.now() - inicio)
    if (restante < MINIMO_PARA_EMPEZAR_MS) break
    // `sincronizarClinica` no lanza por contrato; el catch es por si eso cambia.
    const r = await sincronizarClinica(conexion, {
      actorId: 'cron',
      presupuestoMs: Math.min(restante, TOPE_POR_CLINICA_MS),
      leaseSeg: LEASE_SEG,
      minIntervaloSeg: MIN_INTERVALO_SEG,
    }).catch(() => null)
    estados.push(r?.estado ?? 'error')
  }
  return estados
}

export async function GET(request: NextRequest): Promise<Response> {
  if (!autorizada(request.headers.get('authorization'))) {
    return new Response(null, { status: 401, headers: SIN_CACHE })
  }
  try {
    const estados = await recorrerClinicas(Date.now())
    const fallidas = estados.filter((e) => e === 'error').length
    // Sólo conteos agregados, en el log y nunca en la respuesta (S2).
    if (fallidas > 0) logger.warn('GCalCron', `pasadas con error: ${fallidas} de ${estados.length}`)
    return NextResponse.json({ ok: true }, { headers: SIN_CACHE })
  } catch {
    // Lo único que puede lanzar hoy es el listado (las pasadas no lanzan y
    // llevan su propio catch). Texto fijo: el mensaje de Postgres no sale de aquí.
    logger.error('GCalCron', 'ejecución fallida (listado de conexiones u otro fallo inesperado)')
    return new Response(null, { status: 500, headers: SIN_CACHE })
  }
}
