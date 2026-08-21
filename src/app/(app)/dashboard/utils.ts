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
 * Las CINCO llamadas llevan huso: las dos que producen la hora y las TRES
 * del bucket Hoy/Mañana. Dárselo sólo a la hora dejaría el día en Centro y
 * produciría "Mañana · 23:00" para una cita que en Sonora es de hoy.
 *
 * ⚠️  Llama a `tzDispositivo()`: sólo desde componentes de cliente.
 */
export function formatCitaHora(start_time: string): string {
  const tz = tzDispositivo()
  const diaCita = renderEnTZ(start_time, 'yyyy-MM-dd', tz)
  const hora = renderEnTZ(start_time, 'HH:mm', tz)
  if (diaCita === hoyEnTZ(tz)) return `Hoy · ${hora}`
  if (diaCita === desplazarFecha(hoyEnTZ(tz), { dias: 1 })) return `Mañana · ${hora}`
  return renderEnTZ(start_time, "EEE d MMM · HH:mm", tz)
}
