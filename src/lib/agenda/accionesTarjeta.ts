/**
 * src/lib/agenda/accionesTarjeta.ts
 *
 * Lo puro de la tarjeta de lectura (bloque F, F3.2, detrás del interruptor):
 * qué acciones ofrece cada cita y qué se lee en ella. El componente es
 * `TarjetaLectura.tsx`; este archivo NO se llama `tarjetaLectura.ts` a
 * propósito, porque dos nombres que sólo se distinguen por la mayúscula no
 * compilan en macOS ni en Windows (CLAUDE.md, «Estilo de código»).
 *
 * Reglas (diseño F §3.2 y decisión 20; G3, punto 17 de la tanda de diseño,
 * con el ajuste de Angel «las acciones dependen del estado de la cita»):
 *   · «Editar» ya no es un botón en una CITA: hacía lo mismo que «Reagendar».
 *     El formulario completo se abre con el engrane «Configuración de la
 *     cita» de la cabecera (en TODAS las tarjetas).
 *   · Cita con paciente, por estado:
 *       – Agendada: «Iniciar consulta» (si el llamador dice que se puede: las
 *         mismas condiciones que el modal), «Confirmar», «Reagendar», el aviso
 *         por WhatsApp y, aparte, «Cancelar cita».
 *       – Confirmada: igual, sin «Confirmar» (el aviso pasa a recordatorio).
 *       – Atendida: SÓLO «Ver expediente» (la atención concluyó): ni iniciar,
 *         ni reagendar, ni avisos, ni cancelar.
 *       – Cancelada o No asistió: SÓLO «Reagendar cita» (decisión de Angel:
 *         abre el alta de una cita NUEVA con el mismo paciente, médico y
 *         consultorio; la original se queda como estaba, con su estado, su
 *         auditoría y lo que cuenta para el candado).
 *       – Cancelada, además (tanda I, punto 12): «Reasignar», la burbuja de
 *         alta en ESE horario, sin paciente, para dar el hueco a otro. Con
 *         cualquiera de las dos, al guardar, el servidor cierra la cancelada
 *         (`cerrada_en`, `sustituida_por`): deja de pintarse, no se borra.
 *   · Cita por ligar y evento sin paciente: conservan lo que tenían, en su
 *     orden (incluido «Editar»), con el engrane. Una por ligar CANCELADA ofrece
 *     además «Eliminar cita» (la cierra, como la cancelada con paciente). Tanda J: la principal de una
 *     por ligar es «Ligar e iniciar consulta» (`ligar`), la ventana pequeña. I3: un evento de Google «por
 *     asignar» es una por ligar con «¿No es una cita?» al final. Evento: «Editar», T3
 *     «Convertir en cita» si nació en Google (§2, AG-DT-29), y «Eliminar»
 *     aparte (eliminar SÓLO aquí: una cita con paciente se cancela — P2).
 *   · Los bloques de Google no abren nada (los filtra `abrirCita` antes).
 * El SERVIDOR rechaza lo que no corresponde al estado aunque se llame a mano
 * (`vetoPorEstado` de `estadoCita.ts`, en `PUT /api/appointments/[id]`; el WhatsApp y el correo,
 * con `motivoSinWhatsApp`/`motivoSinCorreo`): ocultar el botón no basta.
 */
import type { Appointment, Status } from '@/lib/agenda/tiposAgenda'
import { esEventoGenerico, esPorAsignar, esPorLigar } from '@/lib/agenda/tarjetasAgenda'
import { horaEnTZ } from '@/lib/agenda/fechasAgenda'
import { regionDeTimezone } from '@/lib/consultorios/zonas-mexico'

export type AccionTarjeta =
  | 'iniciar-consulta' | 'ver-expediente' | 'confirmar' | 'reagendar' | 'reagendar-cita' | 'reasignar' | 'cancelar' | 'editar' | 'convertir' | 'eliminar'
  | 'no-es-cita' | 'ligar' | 'no-asistio' | 'eliminar-cita'

/* Tanda K, punto 21 · Los textos de la burbuja nueva (`docs/spec/Burbuja.dc.html`): «Ver la
   consulta», «Darle otra cita», «Reasignar el horario», «Ligar expediente e iniciar» y «No es
   una cita», sin signos (las demás puertas de «¿No es una cita?» —el formulario, Próximas
   citas, la campana— no son la burbuja y conservan su pregunta). */
export const ETIQUETA_ACCION: Record<AccionTarjeta, string> = {
  'iniciar-consulta': 'Iniciar consulta',
  'ver-expediente': 'Ver la consulta',
  confirmar: 'Marcar como confirmada',
  reagendar: 'Reagendar',
  'reagendar-cita': 'Darle otra cita',
  reasignar: 'Reasignar el horario',
  cancelar: 'Cancelar cita',
  editar: 'Editar',
  convertir: 'Convertir en cita',
  eliminar: 'Eliminar evento',
  /* B13 · AG7 (CALMA §28, textos unificados): «¿No es una cita?» con signos en todas partes, y el
     ligado como en el dashboard. Antes, «No es una cita» y «Ligar expediente e iniciar». */
  'no-es-cita': '¿No es una cita?',
  ligar: 'Ligar paciente e iniciar consulta',
  'no-asistio': 'No asistió',
  /* Tanda L, punto 9 · la de una CANCELADA: la quita de la agenda sin borrarla (queda cerrada). */
  'eliminar-cita': 'Eliminar cita',
}

/** G3 · Una pieza de la rejilla de acciones: una acción o el aviso por WhatsApp (su propio componente). */
export type PiezaTarjeta = AccionTarjeta | 'whatsapp'

/**
 * G3 · Cómo se pinta la tarjeta: la acción PRINCIPAL a todo el ancho, las
 * SECUNDARIAS en dos columnas iguales (si quedan impares, la última ocupa la
 * fila entera: nada suelto) y la de PELIGRO aparte, al final.
 */
export interface DisposicionTarjeta {
  principal: AccionTarjeta | null
  secundarias: PiezaTarjeta[]
  peligro: AccionTarjeta | null
}

/** Lo que la tarjeta sabe además de la cita. */
export interface OpcionesDisposicion {
  /** `false` mientras no haya con qué confirmar (`cambiarEstadoCita`). */
  conConfirmar?: boolean
  /** El aviso por WhatsApp aplica (`motivoSinWhatsApp`, la regla del servidor). */
  conWhatsApp?: boolean
  /** Quien mira puede abrir el expediente (médico) y la cita tiene paciente. */
  puedeVerExpediente?: boolean
  /**
   * Tanda J, punto 10 · La tarjeta se abrió desde un aviso que pide esta
   * acción («Desde Google no se pueden mover…» → «Reagendar»): si la cita la
   * tiene, pasa a principal (a todo el ancho y con el foco, lo de siempre).
   */
  destacar?: 'reagendar'
}

const VIVAS: readonly Status[] = ['scheduled', 'confirmed']

/** Lo que mira la tarjeta de la fila. */
export type CitaTarjeta = Pick<Appointment, 'status' | 'paciente_id' | 'reserva_canal'>
  & Partial<Pick<Appointment, 'origen' | 'all_day' | 'medico_id' | 'google_asignacion'>>

/**
 * T3 · ¿Se puede convertir en cita? Un evento sin paciente NACIDO EN GOOGLE
 * (lo que pide §2), con hora (una cita siempre la lleva: el servidor rechaza
 * todo el día con paciente), con médico (la cita es suya y el consultorio sale
 * de él) y vivo (agendado o confirmado).
 */
export function esConvertible(cita: CitaTarjeta): boolean {
  return esEventoGenerico(cita) && cita.origen === 'google' && cita.all_day !== true
    && Boolean(cita.medico_id) && VIVAS.includes(cita.status)
}

/** Evento sin paciente y cita por ligar: lo que ya tenían, en su orden (G3: con el engrane además). */
function disposicionSinCambios(cita: CitaTarjeta, puedeIniciar: boolean, o: OpcionesDisposicion): DisposicionTarjeta {
  if (esEventoGenerico(cita)) {
    return { principal: null, secundarias: esConvertible(cita) ? ['editar', 'convertir'] : ['editar'], peligro: 'eliminar' }
  }
  const viva = VIVAS.includes(cita.status)
  const secundarias: PiezaTarjeta[] = []
  if (o.conConfirmar !== false && cita.status === 'scheduled') secundarias.push('confirmar')
  if (viva) secundarias.push('reagendar')
  secundarias.push('editar')
  if (o.conWhatsApp) secundarias.push('whatsapp')
  /* I3 (punto 10) · Un evento de Google por asignar: «¿No es una cita?» lo
     deja como evento sin paciente, en el momento y sin preguntar. */
  if (esPorAsignar(cita)) secundarias.push('no-es-cita')
  /* Tanda J (punto 7) · En una por ligar la principal es «Ligar e iniciar
     consulta»: abre la ventana pequeña de ligar (`VentanaLigarCita`), no el
     formulario completo. */
  /* Una por ligar CANCELADA (reservó por enlace, o un evento de Google por asignar) sale de la agenda
     como la cancelada con paciente: «Eliminar cita» la CIERRA (`POST …/quitar`), no la borra. Sin esto
     se quedaba sin ninguna salida. La no asistida y la atendida, como antes: nada. */
  const peligro: AccionTarjeta | null = viva ? 'cancelar' : cita.status === 'cancelled' ? 'eliminar-cita' : null
  return { principal: puedeIniciar ? 'ligar' : null, secundarias, peligro }
}

/**
 * G3 · Las acciones de la tarjeta, por estado (ver la cabecera). Sólo se
 * devuelven las que aplican a ESA cita.
 */
export function disposicionDeTarjeta(cita: CitaTarjeta, puedeIniciar: boolean, o: OpcionesDisposicion = {}): DisposicionTarjeta {
  return conDestacada(disposicionPorEstado(cita, puedeIniciar, o), o.destacar)
}

/**
 * Tanda J, punto 10 · La acción pedida pasa de secundaria a principal; la
 * principal que hubiera encabeza las secundarias. Sin ella en la tarjeta (ya
 * empezó, se canceló…), nada cambia.
 */
function conDestacada(d: DisposicionTarjeta, destacar: OpcionesDisposicion['destacar']): DisposicionTarjeta {
  if (!destacar || !d.secundarias.includes(destacar)) return d
  const resto = d.secundarias.filter(p => p !== destacar)
  return { ...d, principal: destacar, secundarias: d.principal ? [d.principal, ...resto] : resto }
}

function disposicionPorEstado(cita: CitaTarjeta, puedeIniciar: boolean, o: OpcionesDisposicion): DisposicionTarjeta {
  if (esEventoGenerico(cita) || esPorLigar(cita)) return disposicionSinCambios(cita, puedeIniciar, o)
  if (cita.status === 'attended') return { principal: o.puedeVerExpediente ? 'ver-expediente' : null, secundarias: [], peligro: null }
  /* Tanda L, punto 9 · la cancelada suma «Eliminar cita», aparte, como peligro. */
  if (cita.status === 'cancelled') return { principal: 'reagendar-cita', secundarias: ['reasignar'], peligro: 'eliminar-cita' }
  if (cita.status === 'no_show') return { principal: 'reagendar-cita', secundarias: [], peligro: null }
  const secundarias: PiezaTarjeta[] = []
  if (o.conConfirmar !== false && cita.status === 'scheduled') secundarias.push('confirmar')
  secundarias.push('reagendar')
  if (o.conWhatsApp) secundarias.push('whatsapp')
  return { principal: puedeIniciar ? 'iniciar-consulta' : null, secundarias, peligro: 'cancelar' }
}

/**
 * Tanda K, punto 21 · La burbuja de la maqueta (`docs/spec/Burbuja.dc.html`), DERIVADA de
 * `disposicionDeTarjeta`, que sigue siendo la única regla de qué acción tiene cada cita (y la
 * que el servidor refleja). Sólo reparte las piezas en los sitios de la maqueta:
 *   · `principal`: el botón ancho; `ayuda`, la línea de debajo;
 *   · `rejilla`: los botones con icono. Agendada: «Confirmar» (abre sus opciones), «Reagendar»,
 *     «Editar»; confirmada: «Reagendar», «Editar», «No asistió»; cancelada: «Reasignar el
 *     horario» (de Angel: secundario de «Darle otra cita»); evento: «Editar», «Convertir»;
 *   · `confirmar`: lo que abre «Confirmar», cada una si aplica (como hoy);
 *   · `pie`: «No es una cita» (sólo por asignar, como hoy) y «Cancelar cita» / «Eliminar evento».
 * Los tres puntos no salen de aquí: abren siempre el formulario completo (tanda M, punto 4), que es
 * donde quedan «No asistió» de la agendada, los recordatorios de la confirmada, el tipo y el resto.
 * Desde un aviso (J4, `destacar`), la principal que había encabeza la rejilla, como antes.
 */
export type CeldaBurbuja = AccionTarjeta | 'menu-confirmar'

export interface DisposicionBurbuja {
  principal: AccionTarjeta | null
  ayuda: string | null
  rejilla: CeldaBurbuja[]
  confirmar: { whatsapp: boolean; correo: boolean; marcar: boolean }
  pie: AccionTarjeta[]
}

/** La línea de ayuda bajo el botón ancho (textos de la maqueta). */
function ayudaDeBurbuja(cita: CitaTarjeta, principal: AccionTarjeta | null): string | null {
  if (principal === 'ligar') return 'Primero buscas su expediente o le creas uno.'
  if (esEventoGenerico(cita)) return null
  if (cita.status === 'cancelled') return 'Esta cita se canceló. Su horario quedó libre.'
  if (cita.status === 'no_show') return 'El paciente no llegó a esta cita.'
  return null
}

function rejillaDeBurbuja(cita: CitaTarjeta, d: DisposicionTarjeta, o: OpcionesBurbuja, hayConfirmar: boolean): CeldaBurbuja[] {
  const tiene = (p: PiezaTarjeta): boolean => d.secundarias.includes(p)
  if (esEventoGenerico(cita)) return d.secundarias.filter((p): p is AccionTarjeta => p !== 'whatsapp')
  /* B13 · AG5 (maqueta `ag-burbuja`, decisión del dueño) · TODAS las burbujas llevan la fila
     «Editar» —la misma puerta que el lápiz de la cabecera (`alAccion('editar')`)—, también la
     cancelada, la atendida y la no asistida, donde antes sólo se llegaba por la cabecera. No es
     una acción nueva para el servidor: abre el formulario de siempre. */
  if (cita.status === 'cancelled') return [...(tiene('reasignar') ? ['reasignar' as const] : []), 'editar']
  if (!VIVAS.includes(cita.status)) return ['editar']
  /* J4 · la principal desplazada por `destacar` va primero, como antes. */
  const subida = d.secundarias.filter((p): p is AccionTarjeta => p === 'iniciar-consulta' || p === 'ligar')
  const reagendar: CeldaBurbuja[] = tiene('reagendar') ? ['reagendar'] : []
  if (cita.status === 'scheduled') return [...subida, ...(hayConfirmar ? ['menu-confirmar' as const] : []), ...reagendar, 'editar']
  /* «No asistió» no está en `disposicionDeTarjeta`: no es una acción nueva para el servidor, es
     el mismo PUT parcial de estado que «Confirmar» (`cambiarEstadoCita`), y por eso pide lo mismo
     que él (`conConfirmar`). El servidor lo admite en una viva sin nota (`vetoPorEstado`). */
  return [...subida, ...reagendar, 'editar', ...(o.conConfirmar !== false ? ['no-asistio' as const] : [])]
}

/** Lo que la burbuja sabe además de lo de la tarjeta: si el correo aplica (`motivoSinCorreo`). */
export interface OpcionesBurbuja extends OpcionesDisposicion { conCorreo?: boolean }

export function burbujaDeTarjeta(cita: CitaTarjeta, puedeIniciar: boolean, o: OpcionesBurbuja = {}): DisposicionBurbuja {
  const d = disposicionDeTarjeta(cita, puedeIniciar, o)
  const evento = esEventoGenerico(cita)
  const viva = VIVAS.includes(cita.status)
  const confirmar = {
    whatsapp: d.secundarias.includes('whatsapp') && cita.status === 'scheduled',
    correo: Boolean(o.conCorreo) && viva && cita.status === 'scheduled' && !evento,
    marcar: d.secundarias.includes('confirmar'),
  }
  const hayConfirmar = confirmar.whatsapp || confirmar.correo || confirmar.marcar
  const rejilla = rejillaDeBurbuja(cita, d, o, hayConfirmar)
  return {
    principal: d.principal,
    ayuda: ayudaDeBurbuja(cita, d.principal),
    rejilla,
    confirmar: hayConfirmar ? confirmar : { whatsapp: false, correo: false, marcar: false },
    pie: [...(d.secundarias.includes('no-es-cita') ? ['no-es-cita' as const] : []), ...(d.peligro ? [d.peligro] : [])],
  }
}

/** Tanda K, punto 21 · El día de la burbuja, en la zona de quien mira: «Miércoles 18 de noviembre». */
export function diaLargoDeTarjeta(cita: Pick<Appointment, 'start_time'>, zonaVisor: string): string {
  try {
    const t = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: zonaVisor })
      .format(new Date(cita.start_time)).replace(',', '')
    return `${t.charAt(0).toUpperCase()}${t.slice(1)}`
  } catch {
    return ''
  }
}

/** Tanda K, punto 21 · Las iniciales del médico (sin «Dr.»/«Dra.»): «Dr. Admin Semilla Uno» → «AS». */
export function inicialesDeMedico(nombre: string): string {
  const palabras = nombre.split(/\s+/).filter(p => p && !p.endsWith('.'))
  return palabras.slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('')
}

/**
 * Las acciones de la cita en el orden en que se recorren (principal,
 * secundarias, peligro), sin el aviso por WhatsApp. `conConfirmar: false` la
 * quita aunque la cita esté agendada: el enchufe la apaga mientras
 * `guardadoCitas` no exponga `cambiarEstadoCita` (`contratosV2.ts`).
 */
export function accionesDeTarjeta(cita: CitaTarjeta, puedeIniciarConsulta: boolean, conConfirmar = true, puedeVerExpediente = false): AccionTarjeta[] {
  const d = disposicionDeTarjeta(cita, puedeIniciarConsulta, { conConfirmar, puedeVerExpediente })
  const secundarias = d.secundarias.filter((p): p is AccionTarjeta => p !== 'whatsapp')
  return [...(d.principal ? [d.principal] : []), ...secundarias, ...(d.peligro ? [d.peligro] : [])]
}

/** Quién mira, para decidir «Iniciar consulta». */
export interface QuienMira { esMedico: boolean; perfilId: string | null; consultorioExiste: boolean }

/**
 * ¿Sale «Iniciar consulta»? LAS MISMAS CONDICIONES QUE EL MODAL
 * (`showIniciarConsulta` y, en una por ligar, `showLigarYConsultar` de D7):
 * quien mira es médico, la cita es SUYA, su consultorio está en su lista, y hay
 * paciente o es una por ligar. Un evento sin paciente, nunca. Si el modal
 * cambia sus condiciones, éstas cambian con él.
 */
export function puedeIniciarConsulta(
  cita: Pick<Appointment, 'pacientes' | 'paciente_id' | 'reserva_canal' | 'medico_id' | 'google_asignacion'>, quien: QuienMira,
): boolean {
  if (!quien.esMedico || !quien.perfilId || cita.medico_id !== quien.perfilId || !quien.consultorioExiste) return false
  return Boolean(cita.pacientes) || esPorLigar(cita)
}

/** ¿Pide confirmación antes de hacerse? Cancelar y eliminar, sí (decisión 20). Tanda L, punto 2
    (AG-DT-192): «No asistió» también, con el mismo aviso que «Cancelar cita»; y punto 9, «Eliminar cita». */
export function pideConfirmacion(accion: AccionTarjeta): boolean {
  return accion === 'cancelar' || accion === 'eliminar' || accion === 'no-asistio' || accion === 'eliminar-cita'
}

/** El mensaje del aviso de las acciones que preguntan (`pideConfirmacion`). */
export function textoDeConfirmacion(
  accion: AccionTarjeta, cita: Pick<Appointment, 'title' | 'pacientes' | 'reserva_nombre' | 'paciente_id' | 'reserva_canal'>,
): string {
  if (accion === 'eliminar') return `¿Eliminar el evento «${cita.title}»? No se puede deshacer.`
  if (accion === 'eliminar-cita') return `¿Eliminar la cita cancelada de ${nombreDeTarjeta(cita)}? Sale de la agenda y no se puede deshacer; queda guardada en el historial.`
  if (accion === 'no-asistio') return `¿Marcar que ${nombreDeTarjeta(cita)} no asistió? La cita se queda en la agenda como «No asistió».`
  return `¿Cancelar la cita de ${nombreDeTarjeta(cita)}? El horario queda libre y la cita se queda en la agenda como cancelada.`
}

/** El nombre que se lee arriba: el paciente, quien reservó o el título del evento. */
export function nombreDeTarjeta(cita: Pick<Appointment, 'title' | 'pacientes' | 'reserva_nombre' | 'paciente_id' | 'reserva_canal'>): string {
  if (cita.pacientes) return `${cita.pacientes.nombre} ${cita.pacientes.apellidos}`.trim()
  if (esPorLigar(cita) && cita.reserva_nombre) return cita.reserva_nombre
  return cita.title
}

/** El teléfono de contacto: el de la ficha o el que dejó quien reservó. */
export function telefonoDeTarjeta(cita: Pick<Appointment, 'pacientes' | 'reserva_telefono'>): string | null {
  return cita.pacientes?.telefono ?? cita.reserva_telefono ?? null
}

/**
 * G3 (punto 17) · La fecha y la hora juntas, como dato principal de la
 * tarjeta, en la zona de quien mira: «Lun 14 nov · 08:00 – 09:00», y la
 * duración aparte («60 min»). La etiqueta del consultorio en otra zona sigue
 * siendo `horarioDeTarjeta(…).enConsultorio`.
 */
export function cuandoDeTarjeta(
  cita: Pick<Appointment, 'start_time' | 'end_time'>, zonaVisor: string,
): { fechaHora: string; duracion: string | null } {
  let dia = ''
  try {
    const partes = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: zonaVisor })
      .formatToParts(new Date(cita.start_time))
    const parte = (t: string): string => (partes.find(p => p.type === t)?.value ?? '').replace('.', '')
    const semana = parte('weekday')
    dia = `${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${parte('day')} ${parte('month')}`
  } catch {
    dia = ''
  }
  const tramo = `${horaEnTZ(cita.start_time, zonaVisor)} – ${horaEnTZ(cita.end_time, zonaVisor)}`
  const min = Math.round((new Date(cita.end_time).getTime() - new Date(cita.start_time).getTime()) / 60000)
  return { fechaHora: dia ? `${dia} · ${tramo}` : tramo, duracion: min > 0 ? `${min} min` : null }
}

/**
 * El tramo en la hora de quien mira y, si el consultorio está en otra zona y
 * la hora de pared difiere, la del consultorio aparte. Mismo criterio que el
 * aviso de la tarjeta de la rejilla (`renderEventContent`, F3-6e): se comparan
 * HORAS resultantes, no nombres IANA, porque las zonas mexicanas de UTC-6 son
 * distintas en IANA y dan la misma hora.
 */
export function horarioDeTarjeta(
  cita: Pick<Appointment, 'start_time' | 'end_time' | 'consultorio_timezone'>,
  zonaVisor: string,
): { tramo: string; enConsultorio: string | null } {
  const tramo = `${horaEnTZ(cita.start_time, zonaVisor)}–${horaEnTZ(cita.end_time, zonaVisor)}`
  const zona = cita.consultorio_timezone
  if (!zona) return { tramo, enConsultorio: null }
  const inicio = horaEnTZ(cita.start_time, zona)
  if (!inicio || inicio === horaEnTZ(cita.start_time, zonaVisor)) return { tramo, enConsultorio: null }
  return { tramo, enConsultorio: `${inicio}–${horaEnTZ(cita.end_time, zona)} hora ${regionDeTimezone(zona)}` }
}
