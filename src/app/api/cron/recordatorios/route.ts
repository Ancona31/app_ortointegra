/**
 * GET /api/cron/recordatorios — la tarea programada del recordatorio por
 * correo N horas antes de la cita (agenda E4, `mejora_agendaV2.md` §5 E;
 * diseño en plan_E.md E4).
 *
 * La llamaría Vercel Cron cada 15 min (`vercel.json`). NO está activa: hace
 * falta que Angel defina `CRON_SECRET` y `EMAIL_TRANSPORT=resend` en
 * Production y despliegue. Sin `CRON_SECRET`, todo responde 401.
 *
 * ── S2 (decisión de Angel, §6-bis), punto por punto ─────────────────────────
 * · PÚBLICA en el middleware con entrada EXACTA (`===`), como C7: Vercel no
 *   manda cookie ni sigue redirecciones. La autenticación es `CRON_SECRET`,
 *   comparado en tiempo constante por `autorizada()` (`src/lib/cronAutorizacion.ts`,
 *   la misma que usa `/api/cron/google-sync`).
 * · La respuesta NO LLEVA NINGÚN DATO: `{ ok: true }`, o 401/500 sin cuerpo.
 *   Lo que pasó queda en `cita_correos` y en la auditoría; al log, conteos.
 * · Esta ruta no crea clientes ni consulta la base: `recorrerRecordatorios`
 *   sólo llama RPC, el listado entre clínicas devuelve ids y cada toma lleva
 *   `p_clinica_id` (el que salió del listado, nunca de la petición).
 *
 * ── CUÁNDO NO HACE NADA (y responde `{ ok: true }`) ─────────────────────────
 * · Transporte apagado (`EMAIL_TRANSPORT` sin `resend`/`captura`) o sin
 *   `RESERVA_SECRETO`: NO se lista ni se toma nada. Si se tomara, el envío
 *   quedaría `fallido`/`omitido` y gastaría intentos que tienen que estar
 *   enteros cuando se encienda (plan_E lista A 6).
 * · Sin las migraciones de E4: el listado no existe y no pasa nada.
 * · Interruptor apagado o clínica sin acceso: lo decide la base.
 */
import { randomUUID } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { autorizada } from '@/lib/cronAutorizacion'
import { modoTransporte } from '@/lib/correo/transporte'
import { secretoDisponible } from '@/lib/reserva/secretos'
import { recorrerRecordatorios } from '@/lib/confirmacion/recordatorios'
import { logger } from '@/lib/logger'

// Vercel lo pide para que cada invocación ejecute la función (Cron Jobs, «Troubleshooting»).
export const dynamic = 'force-dynamic'
// Segundos. El presupuesto de abajo deja 15 s de margen para el último envío.
export const maxDuration = 60

/** Presupuesto de la ejecución, en ms. */
const PRESUPUESTO_MS = 45_000
/** Citas por ejecución (el tope de `cita_correos_pendientes` es 500). */
const LIMITE_LISTADO = 200
/**
 * Pausa entre envíos. ⚠️ POR VERIFICAR contra el límite por segundo de la
 * cuenta de Resend antes de encender (plan_E E4); 600 ms deja menos de 2 por
 * segundo.
 */
const PAUSA_MS = 600

const SIN_CACHE = { 'Cache-Control': 'no-store' } as const

export async function GET(request: NextRequest): Promise<Response> {
  if (!autorizada(request.headers.get('authorization'))) {
    return new Response(null, { status: 401, headers: SIN_CACHE })
  }
  if (modoTransporte(process.env) === 'apagado' || !secretoDisponible()) {
    return NextResponse.json({ ok: true }, { headers: SIN_CACHE })
  }
  try {
    const c = await recorrerRecordatorios({
      testigo: randomUUID(), limite: LIMITE_LISTADO, presupuestoMs: PRESUPUESTO_MS, pausaMs: PAUSA_MS,
    })
    // Sólo conteos agregados, en el log y nunca en la respuesta (S2).
    if (c.fallido + c.omitido + c.error > 0) {
      logger.warn('RecordatoriosCron', `enviados ${c.enviado}, fallidos ${c.fallido}, omitidos ${c.omitido}, errores ${c.error}`)
    }
    return NextResponse.json({ ok: true }, { headers: SIN_CACHE })
  } catch {
    // Texto fijo: el mensaje de Postgres no sale de aquí.
    logger.error('RecordatoriosCron', 'ejecución fallida (listado u otro fallo inesperado)')
    return new Response(null, { status: 500, headers: SIN_CACHE })
  }
}
