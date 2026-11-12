/**
 * vistaConfirmacion.ts — lo que la página pública de confirmación enseña
 * (agenda E3). Puro: sin base, sin red; lo usan la página y sus pruebas.
 *
 * ⚠️ TEXTOS PENDIENTES DE REVISIÓN (lista B 12 de plan_E): todo texto de cara
 * al paciente de este archivo está «PENDIENTE DE REVISIÓN» por Angel antes de
 * encender la v2 en producción. No citan leyes ni artículos.
 *
 * ⚠️ NADA CLÍNICO: fecha, hora, médico, consultorio, dirección y teléfono. Ni
 * el título de la cita, ni el tipo, ni notas, ni la especialidad, ni el nombre
 * del paciente (lista A 16).
 */
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { fechaHoraEnZona } from '@/lib/reserva/correosReserva'
import type { ContextoConfirmacion } from '@/lib/confirmacion/enlaceConfirmacion'

/** La zona de la que NO se escribe la etiqueta (la de la clínica, como en el resto de la app). */
const ZONA_SIN_ETIQUETA = 'America/Mexico_City'

/** Los `?r=` que la página entiende. Cualquier otro valor se ignora. */
export const RESULTADOS_PAGINA = [
  'confirmada', 'cancelada', 'ya_confirmada', 'ya_cancelada', 'fuera_de_plazo', 'cerrada', 'pasada', 'limite',
] as const
export type ResultadoPagina = (typeof RESULTADOS_PAGINA)[number]

/** El `?r=` si es uno de la lista; si no (o viene repetido), null. */
export function leerResultado(valor: string | string[] | undefined): ResultadoPagina | null {
  if (typeof valor !== 'string') return null
  return RESULTADOS_PAGINA.find(r => r === valor) ?? null
}

/** ¿Es la pantalla de «¿Seguro?» (`?paso=cancelar`)? Un GET que no escribe. */
export function esPasoCancelar(valor: string | string[] | undefined): boolean {
  return valor === 'cancelar'
}

/** «Comunícate al 999…» o, sin teléfono, «comunícate con el consultorio». PENDIENTE DE REVISIÓN. */
export function comunicate(telefono: string | null): string {
  return telefono ? `comunícate al ${telefono}` : 'comunícate con el consultorio'
}

/** El aviso que deja un POST. PENDIENTE DE REVISIÓN. */
export function mensajeDeResultado(r: ResultadoPagina, telefono: string | null): string {
  switch (r) {
    case 'confirmada': return 'Gracias. Tu asistencia quedó confirmada.'
    case 'cancelada': return 'Tu cita quedó cancelada y el horario se liberó.'
    case 'ya_confirmada': return 'Tu asistencia ya estaba confirmada.'
    case 'ya_cancelada': return 'Esta cita ya estaba cancelada.'
    case 'fuera_de_plazo': return `Ya no es posible cancelar desde el enlace; ${comunicate(telefono)}.`
    case 'cerrada': return 'Esta cita ya no admite cambios desde el enlace.'
    case 'pasada': return 'Esta cita ya pasó.'
    case 'limite': return 'Demasiados intentos. Espera un rato y vuelve a probar.'
  }
}

/** El estado vigente de la cita, en una frase. PENDIENTE DE REVISIÓN. */
export function textoDeEstado(ctx: ContextoConfirmacion): string {
  switch (ctx.estado) {
    case 'agendada': return 'Tu cita está agendada.'
    case 'confirmada': return 'Tu asistencia está confirmada.'
    case 'cancelada': return 'Esta cita está cancelada.'
    case 'cerrada': return 'Esta cita ya no admite cambios desde el enlace.'
    case 'pasada': return 'Esta cita ya pasó.'
  }
}

/** «(hora de Tijuana)» si la zona no es la de la clínica; si no, ''. */
export function etiquetaDeZona(zona: string | null): string {
  if (!zona || zona === ZONA_SIN_ETIQUETA) return ''
  try {
    const parte = new Intl.DateTimeFormat('es-MX', { timeZone: zona, timeZoneName: 'long' })
      .formatToParts(new Date()).find(p => p.type === 'timeZoneName')
    return parte ? `(${parte.value})` : ''
  } catch {
    return ''
  }
}

/** Lo que se pinta de la cita, ya compuesto. Sin ids ni clínica. */
export interface CitaPintada {
  cuando: string
  zona: string
  medico: string
  consultorio: string | null
  direccion: string | null
  telefono: string | null
}

export function citaPintada(ctx: ContextoConfirmacion): CitaPintada {
  const zona = ctx.zona ?? ZONA_SIN_ETIQUETA
  return {
    cuando: fechaHoraEnZona(ctx.inicio, zona),
    zona: etiquetaDeZona(ctx.zona),
    medico: ctx.medico ? componerNombreMedicoCompleto(ctx.medico) : '',
    consultorio: ctx.consultorio.nombre,
    direccion: ctx.consultorio.direccion,
    telefono: ctx.consultorio.telefono,
  }
}
