/**
 * src/lib/gcalSincronizacionRestablecer.ts
 *
 * La otra mitad de C-d y C-e (mejora_agendaV2.md §6-bis), paso C5: lo que la
 * sincronización de vuelta RECHAZÓ se vuelve a escribir en Google con el estado
 * que tiene Spinus. `sincronizarClinica` (gcalSincronizacion.ts) lo llama por
 * página, con el mismo cliente de Calendar, después de aplicar la página y
 * antes de avanzar el token.
 *
 * ── QUÉ SE ESCRIBE ──────────────────────────────────────────────────────────
 * · El título que Spinus compone (`resumenEsperado`: con paciente,
 *   «Cita médica…»; cancelada, con «CANCELADA — »).
 * · Las dos puntas de la fila.
 * · `status: 'confirmed'`: deshace un borrado hecho en Google. La API lo
 *   documenta: en el calendario del organizador un evento cancelado conserva
 *   sus datos «so that they can be restored (undeleted)»
 *   (developers.google.com/workspace/calendar/api/v3/reference/events, campo
 *   `status`). Sobre un evento vivo no cambia nada.
 * · El color del estado y la marca privada.
 * · NO la descripción: la de una cita con paciente editada en Google ni se
 *   importa ni se restablece (decisión de C0-C4); nunca observaciones (S1).
 *
 * ── CÓMO ────────────────────────────────────────────────────────────────────
 * La fila se RELEE (gcal_citas_por_evento, por id) después de aplicar: así se
 * escribe lo vigente y se tiene el `updated_at` para guardar el `etag` nuevo
 * con comparar-y-cambiar (gcal_aplicar_evento sin cambios: sólo columnas
 * técnicas). El `patch` va con `If-Match` = el `etag` que trajo la página: si
 * alguien volvió a tocar el evento, 412 y se deja; la pasada siguiente lo ve y
 * decide otra vez. `sendUpdates: 'none'`: es devolver el evento a como estaba.
 *
 * Ninguna consulta directa a una tabla: todo por las RPC de `gcalSincronizacionBase.ts`
 * (cerrojoGcalSincronizacion.test.ts).
 */
import type { GCalCliente } from '@/lib/gcal'
import { propiedadesSpinus, puntasParaGoogle } from '@/lib/appointments'
import { renderEnTZ, TZ_CLINICA } from '@/lib/dates'
import { logger } from '@/lib/logger'
import { esPrecondicionFallida } from '@/lib/gcalEscritura'
import { resumenEsperado, type EventoGoogle, type FilaEspejo } from '@/lib/gcalSincronizacionDecidir'
import { aplicarEvento, citasDeEventos } from '@/lib/gcalSincronizacionBase'

/** Lo que la página trajo de un evento rechazado. */
export interface PorRestablecer {
  citaId: string
  eventId: string
  /** El `etag` del evento tal como llegó en la página (para `If-Match`). */
  etag: string | null
}

/** El color de Google por estado. Copia del `STATUS_COLOR` del PUT de citas (`scheduled` no lleva). */
const COLOR_ESTADO: Partial<Record<FilaEspejo['status'], string>> = {
  confirmed: '2', cancelled: '11', no_show: '11', attended: '8',
}

/** El cuerpo del `patch`: el estado de Spinus, sin descripción. */
export function cuerpoRestablecido(fila: FilaEspejo): EventoGoogle {
  const zona = fila.zona ?? TZ_CLINICA
  const puntas = fila.todoElDia
    ? puntasParaGoogle({ todoElDia: true, inicio: renderEnTZ(fila.inicio, 'yyyy-MM-dd', zona), fin: renderEnTZ(fila.fin, 'yyyy-MM-dd', zona), timezone: zona }, { limpiarLaOtraForma: true })
    : puntasParaGoogle({ todoElDia: false, inicio: fila.inicio, fin: fila.fin, timezone: zona }, { limpiarLaOtraForma: true })
  const resumen = resumenEsperado(fila)
  const color = COLOR_ESTADO[fila.status]
  return {
    ...(resumen ? { summary: resumen } : {}),
    ...puntas,
    status: 'confirmed',
    ...(color ? { colorId: color } : {}),
    extendedProperties: propiedadesSpinus(fila.id),
  }
}

/** Uno. `true` = escrito; `false` = no tocaba (412 o sin fila). Lanza el resto. */
async function restablecerUno(
  clinicaId: string, calendar: GCalCliente, calendarId: string, p: PorRestablecer, fila: FilaEspejo,
): Promise<boolean> {
  const eventId = fila.googleEventId ?? p.eventId
  if (fila.googleEventId && fila.googleEventId !== p.eventId) return false
  let etag: string | null
  try {
    const { data } = await calendar.events.patch(
      { calendarId, eventId, sendUpdates: 'none', requestBody: cuerpoRestablecido(fila) },
      p.etag ? { headers: { 'If-Match': p.etag } } : {},
    )
    etag = data.etag ?? null
  } catch (err) {
    if (esPrecondicionFallida(err)) return false
    throw err
  }
  if (etag) {
    await aplicarEvento(clinicaId, calendarId, {
      citaId: fila.id, esperadoUpdatedAt: fila.updatedAt, etag, actualizado: null,
      vincular: fila.googleEventId ? null : eventId, desvincular: false, cambios: {},
    })
  }
  return true
}

/**
 * Restablece en Google las citas de la lista (sin repetidas). Devuelve cuántas
 * se escribieron y cuántas fallaron; un fallo no tumba a las demás. Nunca lanza.
 */
export async function restablecerEnGoogle(
  clinicaId: string, calendar: GCalCliente, calendarId: string, lista: readonly PorRestablecer[],
): Promise<{ escritas: number; errores: number }> {
  const unicas = [...new Map(lista.map((p) => [p.citaId, p])).values()]
  if (unicas.length === 0) return { escritas: 0, errores: 0 }
  let filas: FilaEspejo[]
  try {
    filas = await citasDeEventos(clinicaId, [], unicas.map((p) => p.citaId))
  } catch {
    logger.warn('GCalSync', `restablecer: no se pudieron releer las citas ${JSON.stringify({ clinica: clinicaId })}`)
    return { escritas: 0, errores: unicas.length }
  }
  const porId = new Map(filas.map((f) => [f.id, f]))
  let escritas = 0
  let errores = 0
  for (const p of unicas) {
    const fila = porId.get(p.citaId)
    if (!fila) continue
    try {
      if (await restablecerUno(clinicaId, calendar, calendarId, p, fila)) escritas += 1
    } catch {
      errores += 1
      logger.warn('GCalSync', `restablecer: evento sin escribir ${JSON.stringify({ clinica: clinicaId, evento: p.eventId })}`)
    }
  }
  return { escritas, errores }
}
