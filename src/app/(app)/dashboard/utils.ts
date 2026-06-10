import { hoyEnTZ, desplazarFecha, renderEnTZ } from '@/lib/dates'

export function formatCitaHora(start_time: string) {
  const diaCita = renderEnTZ(start_time, 'yyyy-MM-dd')
  const hora = renderEnTZ(start_time, 'HH:mm')
  if (diaCita === hoyEnTZ()) return `Hoy · ${hora}`
  if (diaCita === desplazarFecha(hoyEnTZ(), { dias: 1 })) return `Mañana · ${hora}`
  return renderEnTZ(start_time, "EEE d MMM · HH:mm")
}
