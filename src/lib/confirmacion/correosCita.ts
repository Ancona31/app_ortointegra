/**
 * correosCita.ts — la plantilla del RECORDATORIO de cita (agenda E4). Pura:
 * devuelve asunto, texto y HTML; la manda `recordatorios.ts` por
 * `src/lib/correo/transporte.ts`.
 *
 * ⚠️ TEXTO PENDIENTE DE REVISIÓN (legal y de tono, mejora_agendaV2.md §7: «revisar
 * el texto legal … de los correos»). No citar artículos ni autoridad aquí.
 *
 * ⚠️ NADA CLÍNICO (§5 E, plan_E lista A 16): ni título de la cita, ni notas, ni
 * tipo de cita, ni especialidad, ni el nombre del paciente. Sólo fecha, hora
 * (en la zona del consultorio, con su etiqueta), médico, consultorio, su
 * dirección y su teléfono, y el enlace. El asunto no lleva ni el médico.
 *
 * ⚠️ DETERMINISTA: la misma entrada da exactamente el mismo correo, sin «ahora»
 * en ninguna parte. Resend exige el MISMO cuerpo con la misma Idempotency-Key
 * (un reintento con otro cuerpo da 409), así que nada de aquí puede depender
 * del reloj.
 *
 * Todo valor interpolado en el HTML va escapado: el consultorio y su dirección
 * los escribe la clínica.
 */
import { escapeHtml } from '@/lib/htmlEscape'
import { regionDeTimezone } from '@/lib/consultorios/zonas-mexico'

/** Zona por omisión si la cita no la guardó (la de la clínica, `TZ_CLINICA`). */
const ZONA_POR_OMISION = 'America/Mexico_City'

export interface DatosRecordatorio {
  /** Instante de inicio (ISO). */
  inicio: string
  /** Zona IANA del consultorio, o null. */
  zona: string | null
  /** «Dr. Nombre Apellidos», o '' si no se conoce. */
  medico: string
  consultorio: { nombre: string | null; direccion: string | null; telefono: string | null }
  /** La cita ya está confirmada: el enlace sólo sirve para avisar que no asistirá. */
  confirmada: boolean
  /** `https://…/confirmar/<código>` (E2). */
  url: string
}

export interface CorreoRecordatorio { asunto: string; texto: string; html: string }

function zonaValida(zona: string | null): string {
  if (!zona) return ZONA_POR_OMISION
  try {
    new Intl.DateTimeFormat('es-MX', { timeZone: zona })
    return zona
  } catch {
    return ZONA_POR_OMISION
  }
}

/** «martes 12 de noviembre» y «10:00», en la zona dada. */
export function fechaYHora(inicio: string, zona: string): { fecha: string; hora: string } {
  const instante = new Date(inicio)
  const fecha = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: zona }).format(instante)
  const hora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zona }).format(instante)
  return { fecha, hora }
}

function envolver(parrafos: string[]): string {
  const cuerpo = parrafos.map(p => `<p style="margin:0 0 12px">${p}</p>`).join('')
  return `<!doctype html><html lang="es"><body style="font-family:Arial,Helvetica,sans-serif;color:#1a2b3c;line-height:1.5">${cuerpo}</body></html>`
}

/** El recordatorio N horas antes. Lanza sólo si `inicio` no es una fecha. */
export function correoRecordatorio(d: DatosRecordatorio): CorreoRecordatorio {
  if (Number.isNaN(new Date(d.inicio).getTime())) throw new Error('correoRecordatorio: inicio inválido')
  const zona = zonaValida(d.zona)
  const { fecha, hora } = fechaYHora(d.inicio, zona)
  const region = regionDeTimezone(zona)
  const consultorio = d.consultorio.nombre?.trim() || 'el consultorio'
  const direccion = d.consultorio.direccion?.trim() || null
  const telefono = d.consultorio.telefono?.trim() || null
  const medico = d.medico.trim()

  const cuando = `el ${fecha} a las ${hora}${region ? ` (zona horaria: ${region})` : ''}`
  const conQuien = medico ? ` con ${medico}` : ''
  const donde = direccion ? `${consultorio}, ${direccion}` : consultorio
  const llamada = d.confirmada ? 'Avisar que no podré asistir' : 'Confirmar o avisar que no podré asistir'
  const despues = telefono ? `Después, comunícate al ${telefono}.` : 'Después, comunícate con el consultorio.'
  const plazo = `Puedes avisar que no asistirás desde ese enlace hasta 1 hora antes de tu cita. ${despues}`
  const cierre = 'Si no reconoces esta cita, ignora este correo.'

  const asunto = `Recordatorio: tu cita del ${fecha}`
  const texto = [
    `Tienes una cita ${cuando}${conQuien} en ${donde}.`,
    `${llamada}: ${d.url}`,
    plazo,
    cierre,
  ].join('\n\n')
  const html = envolver([
    `Tienes una cita <strong>${escapeHtml(cuando)}</strong>${escapeHtml(conQuien)} en <strong>${escapeHtml(donde)}</strong>.`,
    `<a href="${escapeHtml(d.url)}" style="color:#1e5fa8;font-weight:bold">${escapeHtml(llamada)}</a>`,
    escapeHtml(plazo),
    escapeHtml(cierre),
  ])
  return { asunto, texto, html }
}
