/**
 * correosReserva.ts — las plantillas de los correos de la reserva por enlace
 * (agenda D5 y D8). Puro: devuelve asunto, texto y HTML; quien llama los manda
 * por `src/lib/correo/transporte.ts`.
 *
 * ⚠️ TODO VALOR VA ESCAPADO (`escapeHtml`): el nombre lo escribe quien
 * reserva. ⚠️ NADA CLÍNICO: ni el tipo de cita (lista A, 10: puede revelar el
 * padecimiento), ni notas, ni motivo. El nombre de la clínica tampoco (lista
 * A, 24): va el médico, el consultorio, su dirección y su teléfono.
 */
import { escapeHtml } from '@/lib/htmlEscape'

export interface CorreoListo { asunto: string; texto: string; html: string }

function envolver(parrafos: string[]): string {
  const cuerpo = parrafos.map(p => `<p style="margin:0 0 12px">${p}</p>`).join('')
  return `<!doctype html><html lang="es"><body style="font-family:Arial,Helvetica,sans-serif;color:#1a2b3c;line-height:1.5">${cuerpo}</body></html>`
}

/** El código de 6 dígitos para verificar el correo antes de reservar. */
export function correoCodigo(medico: string, codigo: string): CorreoListo {
  const asunto = `Tu código para reservar: ${codigo}`
  const texto = `Tu código para reservar con ${medico} es ${codigo}. Vence en 10 minutos.\n\nSi no lo pediste, ignora este correo.`
  const html = envolver([
    `Tu código para reservar con ${escapeHtml(medico)} es <strong style="font-size:20px;letter-spacing:2px">${escapeHtml(codigo)}</strong>.`,
    'Vence en 10 minutos.',
    'Si no lo pediste, ignora este correo.',
  ])
  return { asunto, texto, html }
}

export interface DatosComprobante {
  medico: string
  consultorio: string
  direccion: string | null
  telefono: string | null
  /** Instante de inicio (ISO) y la zona IANA del consultorio. */
  inicio: string
  zona: string
}

/** «lunes 16 de noviembre de 2026, 10:30» en la zona del consultorio. */
export function fechaHoraEnZona(inicio: string, zona: string): string {
  const fecha = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: zona })
    .format(new Date(inicio))
  const hora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zona })
    .format(new Date(inicio))
  return `${fecha}, ${hora} h`
}

/**
 * El comprobante (D8): fecha y hora en la zona del consultorio, médico,
 * consultorio, dirección y teléfono. SIN tipo de cita (lista A, 10), sin la
 * clínica y sin datos clínicos. El enlace para confirmar o cancelar lo añade
 * el bloque E; hasta entonces, «comunícate con el consultorio».
 */
export function correoComprobante(d: DatosComprobante): CorreoListo {
  const cuando = fechaHoraEnZona(d.inicio, d.zona)
  const lugar = d.direccion ? `${d.consultorio}, ${d.direccion}` : d.consultorio
  const renglones = [
    `Tu cita quedó agendada para el ${cuando}.`,
    `Con: ${d.medico}.`,
    `En: ${lugar}.`,
    ...(d.telefono ? [`Teléfono del consultorio: ${d.telefono}.`] : []),
    'Para cambiar o cancelar, comunícate con el consultorio.',
  ]
  return {
    asunto: `Tu cita con ${d.medico}`,
    texto: renglones.join('\n'),
    html: envolver(renglones.map(escapeHtml)),
  }
}
