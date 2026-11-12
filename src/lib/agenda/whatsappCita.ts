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
