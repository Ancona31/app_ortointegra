import { hoyEnTZ, desplazarFecha, renderEnTZ, tzDispositivo } from '@/lib/dates'

/**
 * Hora de una cita para el dashboard: "Hoy · 09:00", "Mañana · 14:30",
 * "mié 3 sep · 09:00".
 *
 * Se pinta en el huso del DISPOSITIVO de quien mira — ver LA REGLA en la
 * cabecera de `@/lib/dates`. Antes omitía el huso en las cinco llamadas y
 * heredaba el default `TZ_CLINICA`, así que en Sonora una cita de las 09:00
 * salía como 10:00. Es lo que reportó la beta tester.
 *
 * TODAS las llamadas llevan huso: las que producen la hora y las del bucket
 * Hoy/Mañana. Dárselo sólo a la hora dejaría el día en Centro y produciría
 * "Mañana · 23:00" para una cita que en Sonora es de hoy.
 *
 * ⚠️  Llama a `tzDispositivo()`: sólo desde componentes de cliente.
 */
export function partesCitaHora(start_time: string): { dia: string; hora: string } {
  const tz = tzDispositivo()
  const diaCita = renderEnTZ(start_time, 'yyyy-MM-dd', tz)
  const hora = renderEnTZ(start_time, 'HH:mm', tz)
  if (diaCita === hoyEnTZ(tz)) return { dia: 'Hoy', hora }
  if (diaCita === desplazarFecha(hoyEnTZ(tz), { dias: 1 })) return { dia: 'Mañana', hora }
  return { dia: renderEnTZ(start_time, 'EEE d MMM', tz), hora }
}

/**
 * La fecha de la cita para la COLUMNA ESTRECHA del renglón de próximas citas:
 * "Hoy", o la numérica compacta "20/09/26" para cualquier otro día.
 *
 * ⚠️ EXISTE PORQUE EL DÍA EN PALABRA NO CABE, y está medido: la columna mide
 * 52 px y «MAÑANA» pide 49-58 según la fuente de sistema, así que salía
 * «MAÑA…» casi siempre. La numérica pide 43-54 sin el espaciado de letra, que
 * es lo que la mete dentro. Sólo la consume la variante móvil de ese renglón;
 * en escritorio se sigue pintando `partesCitaHora`.
 *
 * ⚠️ NO LA UNIFIQUES CON `partesCitaHora` NI LA CONVIERTAS EN UN FORMATO SUYO.
 * La salida de aquélla está fijada carácter por carácter por
 * `lib/tests/husoCitas.test.ts` y la consume `formatCitaHora`, que alimenta
 * otras dos pantallas. Son dos rótulos con dos anchos disponibles distintos.
 *
 * ⚠️ Y NO TIENE BUCKET DE «MAÑANA», que no es un olvido: el spec pide fecha
 * numérica para todo lo que no sea hoy, mañana incluido.
 *
 * Devuelve `numerica` además del texto para que el renglón no tenga que
 * adivinarlo comparando con la cadena «Hoy». Lo usa para dos cosas que sólo
 * valen en un caso y no en el otro: el espaciado de letra, que es la convención
 * de los rótulos en mayúsculas y no de las cifras, y `tabular-nums`.
 *
 * El huso es el del DISPOSITIVO, igual que arriba — ver LA REGLA en la
 * cabecera de `@/lib/dates`. Es la misma corrección de Sonora: darle el huso a
 * la fecha y no al bucket de hoy produciría "20/09/26" para una cita que en
 * Sonora es de hoy.
 *
 * ⚠️  Llama a `tzDispositivo()`: sólo desde componentes de cliente.
 */
export function fechaCitaCompacta(start_time: string): { texto: string; numerica: boolean } {
  const tz = tzDispositivo()
  if (renderEnTZ(start_time, 'yyyy-MM-dd', tz) === hoyEnTZ(tz)) return { texto: 'Hoy', numerica: false }
  return { texto: renderEnTZ(start_time, 'dd/MM/yy', tz), numerica: true }
}

/**
 * La misma hora, en una sola cadena: "Hoy · 09:00".
 *
 * ⚠️ SE COMPONE DE `partesCitaHora` Y NO AL REVÉS, y no es indiferente: el
 * renglón de próximas citas necesita el día y la hora POR SEPARADO —van en dos
 * líneas—, y el panel de la secretaria los quiere juntos. Con una sola
 * implementación del huso detrás, la corrección de Sonora no se puede perder en
 * uno de los dos sitios. La salida es carácter por carácter la de antes; los
 * tests de `lib/tests/husoCitas.test.ts` la fijan.
 */
export function formatCitaHora(start_time: string): string {
  const { dia, hora } = partesCitaHora(start_time)
  return `${dia} · ${hora}`
}
