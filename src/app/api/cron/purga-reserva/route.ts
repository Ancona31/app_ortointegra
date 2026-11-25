/**
 * GET /api/cron/purga-reserva — la purga diaria de la reserva por enlace
 * (AG-DT-274; migración M4, `20261204120000_reserva_purga_y_tope.sql`).
 * La llama Vercel Cron una vez al día (`vercel.json`). Decisión de Angel: plazo
 * de 30 días, aplicado por una tarea automática.
 *
 * Qué hace: llama a `reserva_purgar` (sólo `service_role`), que en UNA
 * transacción borra los códigos de verificación y los intentos de los límites
 * con más de 30 días y vacía el correo de los enlaces de un solo uso que
 * dejaron de servir hace más de 30 días, y deja una fila en `audit_log`
 * (`reserva_purga`) con sólo números. El plazo vive en la base: desde aquí no
 * se puede purgar nada reciente. Se repite mientras la base diga que quedan
 * y haya presupuesto; lo que no quepa, lo sigue la pasada de mañana.
 *
 * Las mismas reglas que las otras dos tareas (S2 de `mejora_agendaV2.md`):
 * · PÚBLICA en el middleware con entrada EXACTA (`===`), nunca en la lista de
 *   prefijos. La autenticación es `CRON_SECRET`, comparado en tiempo constante.
 * · La respuesta NO LLEVA NINGÚN DATO: `{ ok: true }`, 401 o 500 sin cuerpo.
 *   Los conteos van al registro y a `audit_log`, nunca a la respuesta.
 * · Cada pasada es una transacción de la base: un corte de la función entre
 *   dos pasadas no deja ningún lote a medias.
 *
 * ⚠️ `createAdminClient()` sin filtro por `clinica_id`, A PROPÓSITO y sólo aquí:
 * la purga es de toda la base por definición (códigos caducados e intentos
 * viejos de todas las clínicas) y no lee ni devuelve ninguna fila: sólo llama a
 * una función que devuelve cuatro números.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { autorizada } from '@/lib/cronAutorizacion'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

// Vercel lo pide para que cada invocación ejecute la función (Cron Jobs, «Troubleshooting»).
export const dynamic = 'force-dynamic'
// Segundos. Muy por debajo de la frecuencia (un día). El presupuesto de abajo
// deja 35 s de margen para la última pasada (cada una está acotada en la base).
export const maxDuration = 60

/** Presupuesto de la ejecución, en ms: pasado, no se empieza otra pasada. */
const PRESUPUESTO_MS = 25_000
/** Tope de pasadas por ejecución, haya o no presupuesto. */
const MAX_PASADAS = 40
/** Filas de cada cosa por pasada (el máximo que acepta `reserva_purgar`). */
const LOTE = 5000

const SIN_CACHE = { 'Cache-Control': 'no-store' } as const

const PasadaSchema = z.object({
  r_verificaciones: z.number().int().nonnegative(),
  r_limites: z.number().int().nonnegative(),
  r_correos: z.number().int().nonnegative(),
  r_quedan: z.boolean(),
})
type Pasada = z.infer<typeof PasadaSchema>

/** Una pasada. Lanza si la base falla o contesta otra cosa. */
async function purgar(): Promise<Pasada> {
  const { data, error } = await createAdminClient().rpc('reserva_purgar', { p_lote: LOTE }).single()
  if (error) throw new Error(error.code ?? 'error')
  return PasadaSchema.parse(data)
}

export async function GET(request: NextRequest): Promise<Response> {
  if (!autorizada(request.headers.get('authorization'))) {
    return new Response(null, { status: 401, headers: SIN_CACHE })
  }
  const inicio = Date.now()
  const total = { verificaciones: 0, limites: 0, correos: 0 }
  try {
    for (let pasadas = 1; ; pasadas += 1) {
      const p = await purgar()
      total.verificaciones += p.r_verificaciones
      total.limites += p.r_limites
      total.correos += p.r_correos
      if (!p.r_quedan) break
      if (pasadas >= MAX_PASADAS || Date.now() - inicio > PRESUPUESTO_MS) {
        logger.warn('PurgaReserva', 'quedó purga pendiente para la siguiente ejecución')
        break
      }
    }
    // Sólo conteos agregados, en el log y nunca en la respuesta (S2).
    logger.info('PurgaReserva', `códigos ${total.verificaciones}, intentos ${total.limites}, correos de enlaces ${total.correos}`)
    return NextResponse.json({ ok: true }, { headers: SIN_CACHE })
  } catch (err: unknown) {
    // Texto fijo y, como mucho, el código: el mensaje de Postgres no sale de aquí.
    logger.error('PurgaReserva', `ejecución fallida (${err instanceof Error ? err.message.slice(0, 20) : 'error'})`)
    return new Response(null, { status: 500, headers: SIN_CACHE })
  }
}
