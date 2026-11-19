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
 * EXCEPCIÓN (tanda L, punto 15 de Angel): el correo de CONFIRMACIÓN
 * (`correoConfirmacion`) saluda por el nombre («Hola, Ana:»), SÓLO el nombre
 * y sólo en el cuerpo (nunca en el asunto). El recordatorio y el aviso de
 * cambio siguen sin él.
 *
 * ⚠️ DETERMINISTA: la misma entrada da exactamente el mismo correo, sin «ahora»
 * en ninguna parte. Resend exige el MISMO cuerpo con la misma Idempotency-Key
 * (un reintento con otro cuerpo da 409), así que nada de aquí puede depender
 * del reloj.
 *
 * Todo valor interpolado en el HTML va escapado: el consultorio y su dirección
 * los escribe la clínica (lo hace `plantillaCita.ts`).
 *
 * Tanda G1: el HTML y el texto los arma `plantillaCita.ts`, el mismo armado de
 * todos los correos de cita. El asunto y las frases del texto plano NO
 * cambiaron. «No podré asistir» lleva a `?paso=cancelar`, que sólo PINTA el
 * «¿Seguro?» (un GET que no escribe, como el resto de la página).
 */
import { fechaDeCorreo, htmlCorreoCita, textoCorreoCita, type BotonCorreo } from '@/lib/correo/plantillaCita'
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

/** `remitente`: el NOMBRE con que sale (el del médico, tanda I punto 21; '' = «Spinus»). La dirección no cambia. */
export interface CorreoRecordatorio { asunto: string; texto: string; html: string; remitente: string }

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

/** Los botones: «Confirmo» y «No podré asistir»; con la cita ya confirmada, sólo el segundo. */
function botonesRecordatorio(url: string, confirmada: boolean): BotonCorreo[] {
  const cancelar = `${url}?paso=cancelar`
  return confirmada
    ? [{ texto: 'Avisar que no podré asistir', url: cancelar }]
    // K2 (punto 8): `?paso=confirmar` hace que la página confirme al cargar (con JS; el GET no escribe).
    : [{ texto: 'Confirmo mi asistencia', url: `${url}?paso=confirmar` }, { texto: 'No podré asistir', url: cancelar, secundario: true }]
}

/**
 * Las palabras propias de CADA correo: el asunto y el título. El resto del
 * cuerpo (fecha, datos, botones, plazo) es el mismo y no dice «recordatorio»:
 * la confirmación puede salir días antes y no debe decirlo (integración G1/G3).
 */
interface PalabrasCorreo { asunto: (fecha: string) => string; titulo: string }

const PALABRAS_RECORDATORIO: PalabrasCorreo = {
  asunto: fecha => `Recordatorio: tu cita del ${fecha}`,
  titulo: 'Recordatorio de tu cita',
}

/** El recordatorio N horas antes. Lanza sólo si `inicio` no es una fecha. */
export function correoRecordatorio(d: DatosRecordatorio): CorreoRecordatorio {
  return correoDeCita(d, PALABRAS_RECORDATORIO)
}

/**
 * Tanda L (punto 15): «Hola, Ana:» con el nombre tal como lo tenemos (espacios y saltos juntados), o
 * nada sin nombre. Lo escapa la plantilla. Más de 120 caracteres (el tope del nombre de la reserva) no es
 * un nombre: sin saludo.
 */
export function saludoDe(nombre: string | null | undefined): string | undefined {
  const limpio = nombre?.replace(/\s+/g, ' ').trim() ?? ''
  return limpio && limpio.length <= 120 ? `Hola, ${limpio}:` : undefined
}

/** El cuerpo común del recordatorio y de la confirmación, con sus palabras (y el saludo, sólo la confirmación). */
function correoDeCita(d: DatosRecordatorio, palabras: PalabrasCorreo, saludo?: string): CorreoRecordatorio {
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

  const asunto = palabras.asunto(fecha)
  const texto = [
    `Tienes una cita ${cuando}${conQuien} en ${donde}.`,
    `${llamada}: ${d.url}`,
    plazo,
    cierre,
  ]
  const partes = {
    // Tanda I, punto 21: a nombre del médico, con el consultorio debajo.
    marca: { medico, consultorio: d.consultorio.nombre },
    preencabezado: `Tienes una cita ${cuando}.`,
    titulo: palabras.titulo,
    saludo,
    fecha: { ...fechaDeCorreo(d.inicio, zona), zona: region ? `Zona horaria: ${region}` : null },
    datos: [
      { etiqueta: 'Médico', valor: medico }, { etiqueta: 'Consultorio', valor: d.consultorio.nombre },
      { etiqueta: 'Dirección', valor: direccion }, { etiqueta: 'Teléfono', valor: telefono },
    ],
    botones: botonesRecordatorio(d.url, d.confirmada),
    pie: [plazo, cierre],
  }
  return { asunto, texto: textoCorreoCita(partes, texto), html: htmlCorreoCita(partes), remitente: medico }
}

/**
 * G3 (punto 14) · El correo de CONFIRMACIÓN que manda el personal desde la
 * agenda, con o sin Google. Es el MISMO cuerpo que el recordatorio (fecha,
 * hora con su zona, médico, consultorio con su dirección y teléfono, y el
 * enlace de confirmar o avisar que no asistirá; nada clínico), armado con
 * `plantillaCita.ts` (G1), con su propio asunto y su propio título: puede salir
 * días antes, así que no dice «Recordatorio». Determinista, como el
 * recordatorio (misma Idempotency-Key, mismo cuerpo).
 * ⚠️ TEXTO PENDIENTE DE REVISIÓN, como el del recordatorio.
 * Tanda L (punto 15): con `nombre` (el de pila del paciente ligado o el que
 * tecleó al reservar), «Hola, <nombre>:» bajo el título; sin él, como antes.
 */
export function correoConfirmacion(d: DatosRecordatorio, nombre: string | null = null): CorreoRecordatorio {
  return correoDeCita(d, d.confirmada
    ? { asunto: fecha => `Tu cita del ${fecha}`, titulo: 'Tu cita' }
    : { asunto: fecha => `Confirma tu cita del ${fecha}`, titulo: 'Confirma tu cita' }, saludoDe(nombre))
}

/**
 * Tanda I, punto 9 · El AVISO DE CAMBIO que sale cuando la clínica reagenda
 * una cita reservada por enlace (`POST /api/appointments/[id]/reagendar`): el
 * mismo cuerpo que la confirmación (fecha y hora NUEVAS, médico, consultorio
 * con su dirección y teléfono, y el enlace de confirmar o avisar que no
 * asistirá), con sus palabras: dice que la cita cambió. Determinista.
 * ⚠️ TEXTO PENDIENTE DE REVISIÓN, como el de la confirmación.
 */
export function correoCambio(d: DatosRecordatorio): CorreoRecordatorio {
  return correoDeCita(d, { asunto: fecha => `Cambio en tu cita: ahora es el ${fecha}`, titulo: 'Tu cita cambió' })
}
