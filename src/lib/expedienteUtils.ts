import { differenceInDays, parseISO, format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Consulta } from '@/types'

/** Etiqueta relativa de la última consulta: "Hoy", "Ayer", "Hace 3 días"... */
export function ultimaConsultaLabel(consultas: Consulta[]): string {
  if (!consultas.length) return 'Sin consultas'

  const ordenadas = [...consultas].sort((a, b) => b.fecha.localeCompare(a.fecha))
  const ultima = ordenadas[0]

  const diff = differenceInDays(new Date(), parseISO(ultima.fecha))

  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff < 7) return `Hace ${diff} días`
  if (diff < 30) return `Hace ${Math.floor(diff / 7)} semanas`
  if (diff < 365) return `Hace ${Math.floor(diff / 30)} meses`
  return `Hace ${Math.floor(diff / 365)} años`
}

/** Fecha formateada de la última consulta: "8 de abril 2026". Null si no hay consultas. */
export function ultimaConsultaFecha(consultas: Consulta[]): string | null {
  if (!consultas.length) return null
  const ordenadas = [...consultas].sort((a, b) => b.fecha.localeCompare(a.fecha))
  return format(parseISO(ordenadas[0].fecha), "d 'de' MMMM yyyy", { locale: es })
}

/** Etiqueta relativa futura: "Hoy", "Mañana", "En 3 días", "Vencida". */
export function formatFechaRelativaFutura(fecha: string): string {
  const diff = differenceInDays(parseISO(fecha), new Date())
  if (diff < 0) return 'Vencida'
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff < 7) return `En ${diff} días`
  if (diff < 30) return `En ${Math.floor(diff / 7)} semanas`
  return `En ${Math.floor(diff / 30)} meses`
}

/** Fecha + hora completa: "25 de abril · 10:30". */
export function formatFechaCompleta(fecha: string): string {
  return format(parseISO(fecha), "d 'de' MMMM · HH:mm", { locale: es })
}
