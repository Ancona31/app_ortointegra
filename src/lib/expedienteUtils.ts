/**
 * expedienteUtils.ts — etiquetas de fecha para las tarjetas del expediente.
 *
 * Todo lo de aquí se pinta en el huso del DISPOSITIVO de quien mira: ver LA
 * REGLA en la cabecera de `@/lib/dates`. Es el mismo criterio que ya usa la
 * agenda, y tiene que serlo, porque la tarjeta "PRÓXIMA CITA" y la agenda
 * muestran LA MISMA cita: si divergieran, la misma cita diría 10:00 en el
 * expediente y 09:00 en la agenda.
 *
 * ⚠️  Estas funciones llaman a `tzDispositivo()`. Sólo desde componentes de
 * cliente — el porqué está en el docstring de `tzDispositivo`.
 */

import { differenceInDays } from 'date-fns'
import type { Consulta } from '@/types'
import { hoyEnTZ, fechaSoloSegura, renderEnTZ, tzDispositivo } from '@/lib/dates'

/**
 * Etiqueta relativa de la última consulta: "Hoy", "Ayer", "Hace 3 días"...
 *
 * `consultas.fecha` es `timestamptz` (`baseline/02_tables.sql:185`), o sea un
 * instante, así que hay que normalizarlo al día del dispositivo ANTES de
 * pasarlo por `fechaSoloSegura`.
 *
 * Antes no se normalizaba, y eso mezclaba DOS husos en la misma comparación:
 * `hoyEnTZ()` daba el día en Centro, mientras `fechaSoloSegura` cortaba la
 * cadena ISO en la T y se quedaba con el día en UTC. En Sonora una consulta
 * de las 17:00 ya estaba en el día UTC siguiente y la etiqueta se iba a
 * "Ayer" con la consulta de hoy.
 */
export function ultimaConsultaLabel(consultas: Consulta[]): string {
  if (!consultas.length) return 'Sin consultas'

  const ordenadas = [...consultas].sort((a, b) => b.fecha.localeCompare(a.fecha))
  const ultima = ordenadas[0]

  const tz = tzDispositivo()
  const diff = differenceInDays(
    fechaSoloSegura(hoyEnTZ(tz)),
    fechaSoloSegura(renderEnTZ(ultima.fecha, 'yyyy-MM-dd', tz)),
  )

  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff < 7) return `Hace ${diff} días`
  if (diff < 30) return `Hace ${Math.floor(diff / 7)} semanas`
  if (diff < 365) return `Hace ${Math.floor(diff / 30)} meses`
  return `Hace ${Math.floor(diff / 365)} años`
}

/**
 * Fecha formateada de la última consulta: "8 de abril 2026". Null si no hay
 * consultas. Huso del DISPOSITIVO, el mismo que `ultimaConsultaLabel`: las dos
 * pintan la MISMA consulta en la tarjeta de `ExpedienteCardsGrid` (título y
 * subtítulo), así que no pueden leer husos distintos.
 *
 * Antes era `format(parseISO(fecha), ...)`, que ACIERTA en cliente porque
 * date-fns hereda el huso del runtime. Pero acertaba por accidente, sin
 * decirlo: el mismo pecado que `TZ_CLINICA` al revés, código que no parece
 * consciente del huso y lo es. El resultado no cambia; ahora está dicho.
 */
export function ultimaConsultaFecha(consultas: Consulta[]): string | null {
  if (!consultas.length) return null
  const ordenadas = [...consultas].sort((a, b) => b.fecha.localeCompare(a.fecha))
  return renderEnTZ(ordenadas[0].fecha, "d 'de' MMMM yyyy", tzDispositivo())
}

/**
 * Etiqueta relativa futura de una CITA: "Hoy", "Mañana", "En 3 días",
 * "Vencida". Huso del DISPOSITIVO.
 *
 * Antes omitía el huso y heredaba el default `TZ_CLINICA`, así que decidía
 * Hoy/Mañana en hora del Centro mientras `formatFechaCompleta` —el subtítulo
 * de la MISMA tarjeta— usaba el huso del runtime. La tarjeta era incoherente
 * consigo misma.
 */
export function formatFechaRelativaFutura(fecha: string): string {
  if (!fecha) return 'Sin fecha'
  const tz = tzDispositivo()
  const diff = differenceInDays(
    fechaSoloSegura(renderEnTZ(fecha, 'yyyy-MM-dd', tz)),
    fechaSoloSegura(hoyEnTZ(tz)),
  )
  if (diff < 0) return 'Vencida'
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff < 7) return `En ${diff} días`
  if (diff < 30) return `En ${Math.floor(diff / 7)} semanas`
  return `En ${Math.floor(diff / 30)} meses`
}

/**
 * Fecha + hora completa de una CITA: "25 de abril · 10:30". Huso del
 * DISPOSITIVO, el mismo que `formatFechaRelativaFutura`: las dos pintan la
 * misma cita en la tarjeta de `ExpedienteCardsGrid` (título y subtítulo).
 *
 * Antes era `format(parseISO(fecha), ...)`, que ACIERTA en cliente porque
 * date-fns hereda el huso del runtime. Pero acertaba por accidente, sin
 * decirlo: el mismo pecado que `TZ_CLINICA` al revés, código que no parece
 * consciente del huso y lo es. El resultado no cambia; ahora está dicho.
 */
export function formatFechaCompleta(fecha: string): string {
  return renderEnTZ(fecha, "d 'de' MMMM · HH:mm", tzDispositivo())
}
