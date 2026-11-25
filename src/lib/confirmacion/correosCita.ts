/**
 * correosCita.ts — los correos de la cita que llevan el enlace de confirmar o
 * cancelar: RECORDATORIO (E4), CONFIRMACIÓN (G3) y AVISO DE CAMBIO (I9). Puro:
 * devuelve asunto, texto y HTML; los mandan `recordatorios.ts` y
 * `confirmacionCita.ts` por `src/lib/correo/transporte.ts`.
 *
 * Tanda M (M5, puntos 12 y 13): los tres siguen la maqueta
 * `docs/spec/correo-confirmar-cita.html` (píldora de estado, «Hola…:», fecha
 * grande con «hora de …», los dos botones, la nota del plazo, detalles y el
 * aviso de seguridad), armados por `plantillaCita.ts`. Los asuntos NO
 * cambiaron. Los enlaces tampoco: «Confirmo mi asistencia» → `?paso=confirmar`
 * (K2, confirma al cargar, con JS), «No podré asistir» → `?paso=cancelar` (sólo
 * PINTA el «¿Seguro?»), y el texto plano lleva la URL simple (K2).
 *
 * ⚠️ TEXTO PENDIENTE DE REVISIÓN (legal y de tono, mejora_agendaV2.md §7). No
 * citar artículos ni autoridad aquí.
 *
 * ⚠️ NADA CLÍNICO (§5 E, plan_E lista A 16): ni título de la cita, ni notas, ni
 * tipo de cita, ni especialidad. Sólo fecha, hora (en la zona del consultorio),
 * médico, consultorio, su dirección y su teléfono, y el enlace. El asunto no
 * lleva ni el médico. El nombre del paciente sólo en el saludo de la
 * CONFIRMACIÓN (tanda L, punto 15), del RECORDATORIO y del AVISO DE CAMBIO
 * (integración M, decisión de Angel), y nunca en el asunto. Los tres, con la
 * misma regla (`saludoDe`) y la misma fuente: el nombre del paciente ligado y,
 * si no, el que tecleó al reservar; sin nombre, «Hola:».
 *
 * ⚠️ DETERMINISTA: la misma entrada da exactamente el mismo correo, sin «ahora»
 * en ninguna parte (Resend exige el MISMO cuerpo con la misma Idempotency-Key).
 */
import {
  fechaDeCorreo, htmlCorreoCita, textoCorreoCita, zonaValida, type BloqueCorreo, type BotonCorreo, type CorreoArmado,
} from '@/lib/correo/plantillaCita'

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

/**
 * El plazo para cancelar por el enlace. NO es un ajuste de la clínica: es la
 * regla fija de la base (`cita_confirmacion_responder`, E1: hasta
 * `start_time - interval '1 hour'`). Si algún día se vuelve ajuste, cambia allí
 * y aquí a la vez.
 */
export const PLAZO_CANCELAR = '1 hora'

/** «martes 12 de noviembre» y «10:00», en la zona dada (también lo usa la ruta de WhatsApp). */
export function fechaYHora(inicio: string, zona: string): { fecha: string; hora: string } {
  const instante = new Date(inicio)
  const fecha = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: zona }).format(instante)
  const hora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zona }).format(instante)
  return { fecha, hora }
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

/** Los botones de la maqueta; con la cita ya confirmada, sólo «No podré asistir». */
function botonesCita(url: string, confirmada: boolean): BotonCorreo[] {
  const cancelar: BotonCorreo = { texto: 'No podré asistir', url: `${url}?paso=cancelar`, secundario: true }
  // K2 (punto 8): `?paso=confirmar` hace que la página confirme al cargar (con JS; el GET no escribe).
  return confirmada ? [cancelar] : [{ texto: 'Confirmo mi asistencia', url: `${url}?paso=confirmar` }, cancelar]
}

/** Las palabras propias de CADA correo; el resto del cuerpo es el mismo. */
interface PalabrasCorreo {
  asunto: (fecha: string) => string
  /** El `<title>`. */
  titulo: string
  pildora: { texto: string; hecho?: boolean }
  parrafo: string
  /** La vista previa, con «del viernes 20 de noviembre a las 08:00 h con Dr. X». */
  vista: (cuando: string) => string
}

function bloquesCita(d: DatosRecordatorio, p: PalabrasCorreo, saludo: string, zona: string): BloqueCorreo[] {
  const medico = d.medico.trim()
  const texto = d.confirmada ? 'Avisar que no podré asistir' : 'Confirmar o avisar que no podré asistir'
  return [
    { tipo: 'entrada', pildora: p.pildora, encabezado: saludo, parrafos: [p.parrafo] },
    { tipo: 'fecha', fecha: fechaDeCorreo(d.inicio, zona) },
    {
      tipo: 'botones', botones: botonesCita(d.url, d.confirmada),
      nota: [`Puedes cancelar con este botón hasta ${PLAZO_CANCELAR} antes de tu cita.`],
      llamada: { frase: 'Después, llámanos al', telefono: d.consultorio.telefono },
      enTexto: [`${texto}: ${d.url}`, `Puedes cancelar desde ese enlace hasta ${PLAZO_CANCELAR} antes de tu cita.`],
    },
    { tipo: 'datos', arriba: 28, raya: true, filas: [
      { etiqueta: 'Médico', valor: medico }, { etiqueta: 'Consultorio', valor: d.consultorio.nombre },
      { etiqueta: 'Dirección', valor: d.consultorio.direccion }, { etiqueta: 'Teléfono', valor: d.consultorio.telefono, telefono: true },
    ] },
    { tipo: 'aviso', lineas: ['¿No reconoces esta cita? Ignora este correo; no se hará ningún cambio.'] },
  ]
}

/** El cuerpo común de los tres, con sus palabras y su saludo. Lanza sólo si `inicio` no es una fecha. */
function correoDeCita(d: DatosRecordatorio, p: PalabrasCorreo, saludo = 'Hola:'): CorreoRecordatorio {
  if (Number.isNaN(new Date(d.inicio).getTime())) throw new Error('correoRecordatorio: inicio inválido')
  const zona = zonaValida(d.zona)
  const f = fechaDeCorreo(d.inicio, zona)
  const medico = d.medico.trim()
  const armado: CorreoArmado = {
    // Tanda I, punto 21: a nombre del médico, con el consultorio encima.
    marca: { medico, consultorio: d.consultorio.nombre },
    preencabezado: p.vista(`${f.completa} a las ${f.hora}${medico ? ` con ${medico}` : ''}`),
    titulo: p.titulo,
    bloques: bloquesCita(d, p, saludo, zona),
  }
  return { asunto: p.asunto(fechaYHora(d.inicio, zona).fecha), texto: textoCorreoCita(armado), html: htmlCorreoCita(armado), remitente: medico }
}

const PENDIENTE = { texto: 'Pendiente de confirmar' }
const CONFIRMADA = { texto: 'Cita confirmada', hecho: true }

/** El recordatorio N horas antes. Con `nombre`, «Hola, <nombre>:» (integración M); sin él, «Hola:». */
export function correoRecordatorio(d: DatosRecordatorio, nombre: string | null = null): CorreoRecordatorio {
  return correoDeCita(d, {
    asunto: fecha => `Recordatorio: tu cita del ${fecha}`, titulo: 'Recordatorio de tu cita',
    pildora: d.confirmada ? CONFIRMADA : PENDIENTE,
    parrafo: d.confirmada
      ? 'Te recordamos tu cita próxima; ya está confirmada. Aquí tienes los datos para que la tengas a la mano.'
      : 'Te recordamos tu cita próxima. Por favor confírmanos si vas a asistir; solo toma un clic.',
    vista: cuando => d.confirmada ? `Recordatorio: tu cita del ${cuando}.` : `Confirma tu cita del ${cuando}.`,
  }, saludoDe(nombre))
}

/**
 * G3 (punto 14) · La CONFIRMACIÓN que manda el personal desde la agenda, con o
 * sin Google. Puede salir días antes, así que no dice «Recordatorio». Tanda L
 * (punto 15): con `nombre` (el de pila del paciente ligado o el que tecleó al
 * reservar), «Hola, <nombre>:»; sin él, «Hola:».
 */
export function correoConfirmacion(d: DatosRecordatorio, nombre: string | null = null): CorreoRecordatorio {
  return correoDeCita(d, d.confirmada
    ? {
      asunto: fecha => `Tu cita del ${fecha}`, titulo: 'Tu cita', pildora: CONFIRMADA,
      parrafo: 'Tu cita está confirmada. Aquí tienes los datos para que la tengas a la mano.',
      vista: cuando => `Tu cita del ${cuando}.`,
    }
    : {
      asunto: fecha => `Confirma tu cita del ${fecha}`, titulo: 'Confirma tu cita', pildora: PENDIENTE,
      parrafo: 'Tienes una cita próxima. Por favor confírmanos si vas a asistir; solo toma un clic.',
      vista: cuando => `Confirma tu cita del ${cuando}.`,
    }, saludoDe(nombre))
}

/**
 * Tanda I, punto 9 · El AVISO DE CAMBIO cuando la clínica reagenda una cita
 * reservada por enlace (`POST /api/appointments/[id]/reagendar`): la fecha y
 * la hora NUEVAS, con sus botones. Determinista. Con `nombre`, «Hola, <nombre>:»
 * (integración M); sin él, «Hola:».
 */
export function correoCambio(d: DatosRecordatorio, nombre: string | null = null): CorreoRecordatorio {
  return correoDeCita(d, {
    asunto: fecha => `Cambio en tu cita: ahora es el ${fecha}`, titulo: 'Tu cita cambió',
    pildora: { texto: 'Cita reagendada' },
    parrafo: d.confirmada
      ? 'Tu cita cambió. Esta es la nueva fecha y hora.'
      : 'Tu cita cambió. Esta es la nueva fecha y hora; por favor confírmanos si vas a asistir.',
    vista: cuando => `Tu cita cambió: ahora es el ${cuando}.`,
  }, saludoDe(nombre))
}

/** Lo que necesita el correo de «tu cita fue cancelada» (el «No» a la invitación de Google). */
export type DatosCancelacion = Pick<DatosRecordatorio, 'inicio' | 'zona' | 'medico' | 'consultorio'>

/**
 * Avisos globales (decisión de Angel, 2026-11-24) · El paciente respondió «No» a la invitación de
 * Google con más de una hora de anticipación y la cita se canceló: se le dice POR QUÉ y qué hacer si
 * fue un error. Sin botones: una cancelada no se reabre (regla de G); si quiere otra, agenda de nuevo
 * o llama. Determinista y sin nada clínico, como los demás. Lanza sólo si `inicio` no es una fecha.
 */
export function correoCancelacionPorRsvp(d: DatosCancelacion, nombre: string | null = null): CorreoRecordatorio {
  if (Number.isNaN(new Date(d.inicio).getTime())) throw new Error('correoCancelacionPorRsvp: inicio inválido')
  const zona = zonaValida(d.zona)
  const f = fechaDeCorreo(d.inicio, zona)
  const medico = d.medico.trim()
  const armado: CorreoArmado = {
    marca: { medico, consultorio: d.consultorio.nombre },
    preencabezado: `Tu cita del ${f.completa} a las ${f.hora}${medico ? ` con ${medico}` : ''} fue cancelada.`,
    titulo: 'Tu cita fue cancelada',
    bloques: [
      { tipo: 'entrada', pildora: { texto: 'Cita cancelada' }, encabezado: saludoDe(nombre) ?? 'Hola:',
        parrafos: ['Tu cita fue cancelada porque indicaste que no asistirás.'] },
      { tipo: 'fecha', fecha: f },
      { tipo: 'recuadro', fuerte: '¿Fue un error?', texto: 'Agenda de nuevo cuando quieras.',
        llamada: { frase: 'O llámanos al', telefono: d.consultorio.telefono } },
      { tipo: 'datos', arriba: 28, raya: true, filas: [
        { etiqueta: 'Médico', valor: medico }, { etiqueta: 'Consultorio', valor: d.consultorio.nombre },
        { etiqueta: 'Teléfono', valor: d.consultorio.telefono, telefono: true },
      ] },
    ],
  }
  return { asunto: `Tu cita del ${fechaYHora(d.inicio, zona).fecha} fue cancelada`, texto: textoCorreoCita(armado), html: htmlCorreoCita(armado), remitente: medico }
}
