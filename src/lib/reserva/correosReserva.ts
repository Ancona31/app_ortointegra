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
  /** El enlace de confirmación de la cita (agenda E5), o null/ausente si no se pudo emitir. */
  urlConfirmacion?: string | null
}

/** Sólo `http(s)://` y sin espacios ni comillas: lo único que entra al `href`. */
function urlSegura(url: string | null | undefined): string | null {
  return url && /^https?:\/\/[^\s"'<>]+$/.test(url) ? url : null
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
 * clínica y sin datos clínicos. Con el enlace de confirmación de la cita (E5,
 * lista A 1), el último renglón invita a confirmar o cancelar por él; sin
 * enlace, queda el «comunícate con el consultorio» de D8.
 * ⚠️ TEXTO PENDIENTE DE REVISIÓN (lista B 12 de plan_E). Determinista: nada
 * de «ahora» en el cuerpo (E4 lo manda con llave de idempotencia).
 */
export function correoComprobante(d: DatosComprobante): CorreoListo {
  const cuando = fechaHoraEnZona(d.inicio, d.zona)
  const lugar = d.direccion ? `${d.consultorio}, ${d.direccion}` : d.consultorio
  const url = urlSegura(d.urlConfirmacion)
  const renglones = [
    `Tu cita quedó agendada para el ${cuando}.`,
    `Con: ${d.medico}.`,
    `En: ${lugar}.`,
    ...(d.telefono ? [`Teléfono del consultorio: ${d.telefono}.`] : []),
  ]
  const cierre = url
    ? 'Para confirmar tu asistencia o avisar que no podrás ir, usa este enlace:'
    : 'Para cambiar o cancelar, comunícate con el consultorio.'
  return {
    asunto: `Tu cita con ${d.medico}`,
    texto: [...renglones, cierre, ...(url ? [url] : [])].join('\n'),
    html: envolver([
      ...renglones.map(escapeHtml), escapeHtml(cierre),
      ...(url ? [`<a href="${escapeHtml(url)}">Confirmar o cancelar mi cita</a>`] : []),
    ]),
  }
}
