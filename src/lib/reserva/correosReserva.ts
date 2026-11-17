/**
 * correosReserva.ts — las plantillas de los correos de la reserva por enlace
 * (agenda D5 y D8). Puro: devuelve asunto, texto y HTML; quien llama los manda
 * por `src/lib/correo/transporte.ts`.
 *
 * ⚠️ TODO VALOR VA ESCAPADO (`escapeHtml`): el nombre lo escribe quien
 * reserva. ⚠️ NADA CLÍNICO: ni el tipo de cita (lista A, 10: puede revelar el
 * padecimiento), ni notas, ni motivo. El nombre de la clínica tampoco (lista
 * A, 24): va el médico, el consultorio, su dirección y su teléfono.
 *
 * Tanda G1: el HTML y el texto los arma `plantillaCita.ts` (marca, jerarquía,
 * botones grandes, sin depender de imágenes). Las firmas, los asuntos y las
 * frases del texto plano NO cambiaron (las leen las e2e y quien llama); el
 * texto plano sólo gana delante «Spinus» y el título.
 */
import { fechaDeCorreo, htmlCorreoCita, textoCorreoCita, urlSegura, type PartesCorreo } from '@/lib/correo/plantillaCita'

/** `remitente`: el NOMBRE con que sale (el del médico, tanda I punto 21); la dirección no cambia (`transporte.ts`). */
export interface CorreoListo { asunto: string; texto: string; html: string; remitente: string }

/**
 * El código de 6 dígitos para verificar el correo antes de reservar. Tanda I,
 * punto 21: a nombre del médico, con el consultorio elegido debajo si se sabe.
 */
export function correoCodigo(medico: string, codigo: string, opciones: { consultorio?: string | null } = {}): CorreoListo {
  const partes: PartesCorreo = {
    marca: { medico, consultorio: opciones.consultorio ?? null },
    preencabezado: `Tu código es ${codigo}. Vence en 10 minutos.`,
    titulo: 'Tu código para reservar',
    parrafos: [`Escríbelo en la página de reserva de ${medico}.`],
    codigo,
    pie: ['Vence en 10 minutos.', 'Si no lo pediste, ignora este correo.'],
  }
  return {
    asunto: `Tu código para reservar: ${codigo}`,
    texto: textoCorreoCita(partes, [`Tu código para reservar con ${medico} es ${codigo}. Vence en 10 minutos.`, 'Si no lo pediste, ignora este correo.']),
    html: htmlCorreoCita(partes),
    remitente: medico,
  }
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
  const partes: PartesCorreo = {
    marca: { medico: d.medico, consultorio: d.consultorio },
    preencabezado: `Tu cita con ${d.medico}: ${cuando}.`,
    titulo: 'Cita agendada',
    fecha: fechaDeCorreo(d.inicio, d.zona),
    datos: [
      { etiqueta: 'Médico', valor: d.medico }, { etiqueta: 'Consultorio', valor: d.consultorio },
      { etiqueta: 'Dirección', valor: d.direccion }, { etiqueta: 'Teléfono', valor: d.telefono },
    ],
    invitacion: cierre,
    botones: url ? [{ texto: 'Confirmar o cancelar mi cita', url }] : [],
  }
  return {
    asunto: `Tu cita con ${d.medico}`,
    texto: textoCorreoCita(partes, [renglones.join('\n'), [cierre, ...(url ? [url] : [])].join('\n')]),
    html: htmlCorreoCita(partes),
    remitente: d.medico,
  }
}
