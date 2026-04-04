import { format, parseISO, isToday, isTomorrow } from 'date-fns'
import { es } from 'date-fns/locale'

export function formatCitaHora(start_time: string) {
  const date = parseISO(start_time)
  const hora = format(date, 'HH:mm')
  if (isToday(date))    return `Hoy · ${hora}`
  if (isTomorrow(date)) return `Mañana · ${hora}`
  return format(date, "EEE d MMM · HH:mm", { locale: es })
}
