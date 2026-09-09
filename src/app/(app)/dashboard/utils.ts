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
