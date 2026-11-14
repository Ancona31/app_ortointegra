/**
 * whatsappCita.ts — el enlace de WhatsApp MANUAL de una cita (agenda E7).
 * Puro. §2: «solo manual, sin API: botón que abre WhatsApp con el mensaje y el
 * enlace ya escritos; la persona pulsa enviar». Nada se automatiza.
 *
 * FORMATO DEL NÚMERO, verificado en la documentación oficial de WhatsApp el
 * 2026-11-12:
 *   · https://faq.whatsapp.com/5913398998672934 — «Usa https://wa.me/<number>
 *     (<number> es un número de teléfono completo en formato internacional).
 *     No incluyas ceros, paréntesis ni guiones»; el mensaje va en `?text=`
 *     codificado («https://wa.me/1XXXXXXXXXX?text=I'm%20interested…»).
 *   · https://faq.whatsapp.com/1294841057948784 — «Los números de teléfono de
 *     México (código de país "52") deben incluir un "1" después del "+52",
 *     incluso si son de Nextel».
 *   Por tanto: `https://wa.me/521` + 10 dígitos + `?text=` (plan_E lista A 14).
 *   Se sigue la documentación aunque se lea que `52` sin el `1` también llega.
 *
 * ⚠️ TEXTO PENDIENTE DE REVISIÓN (legal y de tono). SIN el nombre del paciente
 * y sin nada clínico (ni título, ni notas, ni tipo, ni especialidad): fecha,
 * hora, médico, consultorio y el enlace de confirmación.
 * ⚠️ El teléfono y el texto viajan a Meta en la URL que abre el navegador del
 * personal (plan_E lista B 1); §2 lo aprueba como envío manual.
 */
import { normalizarTelefonoMx } from '@/lib/reserva/contacto'

/** `521` + los 10 dígitos de un número de México, o null si no se puede normalizar. */
export function numeroWaMe(telefono: string | null | undefined): string | null {
  if (!telefono) return null
  const diez = normalizarTelefonoMx(telefono)
  return diez ? `521${diez}` : null
}

/* ── T1 · ¿Se le puede mandar el WhatsApp a esta cita? ─────────────────────
   LA MISMA REGLA en el servidor (`POST /api/agenda/whatsapp` y la lista de
   mañana, por `citaAdmiteWhatsApp`) y en el cliente, que con ella decide si
   PINTA el botón (modal, tarjeta de lectura y burbuja tras agendar). Antes el
   cliente miraba sólo el estado y el servidor contestaba «no_aplica» a una cita
   pasada o de todo el día, que el personal leía como un error sin motivo. */

/** Por qué no, en una palabra (también viaja en el 409 de la ruta como `motivo`). */
export type MotivoSinWhatsApp =
  | 'sin_paciente' | 'cancelada' | 'atendida' | 'no_asistio' | 'otro_estado' | 'todo_el_dia' | 'pasada'
  | 'sin_telefono' | 'telefono_invalido'

/** Lo que la regla mira de la cita; `reserva_canal` falta (undefined) en una base sin D1. */
export interface CitaParaWhatsApp {
  paciente_id: string | null
  reserva_canal?: string | null
  status: string
  all_day: boolean | null
  start_time: string
}

/** El motivo por la CITA (paciente, estado, todo el día, hora), sin mirar el teléfono. `ahora` en ms. */
export function motivoCitaSinWhatsApp(c: CitaParaWhatsApp, ahora: number): MotivoSinWhatsApp | null {
  if (c.paciente_id === null && !c.reserva_canal) return 'sin_paciente'
  if (c.status === 'cancelled') return 'cancelada'
  if (c.status === 'attended') return 'atendida'
  if (c.status === 'no_show') return 'no_asistio'
  if (c.status !== 'scheduled' && c.status !== 'confirmed') return 'otro_estado'
  if (c.all_day === true) return 'todo_el_dia'
  if (!(new Date(c.start_time).getTime() > ahora)) return 'pasada'
  return null
}

/** El teléfono al que va: el de la ficha y, si no, el de la reserva (vacío cuenta como ninguno). */
export function telefonoParaWhatsApp(dePaciente: string | null | undefined, deReserva: string | null | undefined): string | null {
  return dePaciente?.trim() || deReserva?.trim() || null
}

/** El motivo completo: el de la cita y, si la cita vale, el del teléfono. `null` = se puede. */
export function motivoSinWhatsApp(c: CitaParaWhatsApp, telefono: string | null, ahora: number): MotivoSinWhatsApp | null {
  const porCita = motivoCitaSinWhatsApp(c, ahora)
  if (porCita) return porCita
  if (!telefono) return 'sin_telefono'
  return numeroWaMe(telefono) ? null : 'telefono_invalido'
}

/** El motivo, dicho en llano para quien pulsó el botón. */
export const TEXTO_SIN_WHATSAPP: Readonly<Record<MotivoSinWhatsApp, string>> = {
  sin_paciente: 'Es un evento sin paciente: no hay a quién escribir.',
  cancelada: 'La cita está cancelada.',
  atendida: 'La cita ya se atendió.',
  no_asistio: 'La cita está marcada como «no asistió».',
  otro_estado: 'La cita ya no está agendada ni confirmada.',
  todo_el_dia: 'Es un evento de todo el día, sin hora que avisar.',
  pasada: 'La cita ya pasó.',
  sin_telefono: 'La cita no tiene teléfono.',
  telefono_invalido: 'El teléfono no es un número de México de 10 dígitos.',
}

export interface DatosMensaje {
  /** «martes 12 de noviembre», ya en la zona del consultorio. */
  fecha: string
  /** «10:00», ya en la zona del consultorio. */
  hora: string
  /** «Dr. Nombre Apellidos», o ''. */
  medico: string
  /** Nombre del consultorio, o ''. */
  consultorio: string
  /** `https://…/confirmar/<código>`. */
  url: string
  /** La cita ya está confirmada: el enlace sólo sirve para avisar que no asistirá. */
  confirmada: boolean
}

/** El texto del mensaje. Sin nombre del paciente ni nada clínico. */
export function textoWhatsApp(d: DatosMensaje): string {
  const de = d.medico.trim() ? `Le escribimos del consultorio de ${d.medico.trim()}.` : 'Le escribimos de su consultorio.'
  const en = d.consultorio.trim() ? ` en ${d.consultorio.trim()}` : ''
  const accion = d.confirmada ? 'Si no podrá asistir, avísenos aquí' : 'Para confirmar o avisar que no podrá asistir'
  return `Hola. ${de} Su cita es el ${d.fecha} a las ${d.hora}${en}. ${accion}: ${d.url}`
}

/** `https://wa.me/<número>?text=<texto codificado>`, o null si el teléfono no tiene formato válido. */
export function enlaceWaMe(telefono: string | null | undefined, texto: string): string | null {
  const numero = numeroWaMe(telefono)
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(texto)}` : null
}

/** Una fila de «citas de mañana por confirmar» (`GET /api/agenda/por-confirmar`). Sin teléfono. */
export interface FilaPorConfirmar {
  id: string
  inicio: string
  zona: string
  titulo: string
  tiene_telefono: boolean
  whatsapp_reminder_sent_at: string | null
}
