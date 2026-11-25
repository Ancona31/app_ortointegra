/**
 * src/lib/avisos/avisosClinica.ts — «Avisos» de la clínica (tanda I, punto 19
 * de Angel): lo que pasó en la agenda sin que nadie de la clínica lo hiciera.
 * Puro (sin React ni Supabase): lo usan el servidor (`avisosServidor.ts`), el
 * gancho (`useAvisosClinica`) y la lista (`ListaAvisos`).
 *
 * ⚠️ PIEZA PENSADA PARA MOVERSE A TODA LA APP (abstracción autorizada por
 * Angel): nada de aquí sabe de FullCalendar ni de la agenda. La agenda la
 * monta dentro de su campana; otra página puede montar `ListaAvisos` con
 * `useAvisosClinica` y, sin manejador propio, cada aviso es un enlace a
 * `/agenda?cita=<id>` (`enlaceDeAviso`), que abre la cita en la agenda.
 *
 * Los escribe la BASE (disparadores de F4 y de M1, y la RPC `aviso_clinica_registrar`), nunca el
 * navegador. Nada clínico: nombre de quien reservó (o el título de la cita), fecha y hora, y quién
 * lo hizo en los del personal.
 */

/** Los avisos que cuelgan de una cita. Los 7 primeros son de F4; el resto, de «avisos globales» (M1). */
export const TIPOS_CON_CITA = [
  'reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente', 'google_por_asignar', 'empalme_google',
  /* Tanda J, punto 10: alguien movió en Google una reservada por enlace (la base lo rechazó y
     Spinus la devolvió). */
  'google_movimiento_rechazado',
  /* Tanda L, punto 13: el paciente confirmó su cita (por su enlace o, desde M1, con «Sí» en Google). */
  'confirmacion_paciente',
  /* Avisos globales (M1, `20261202120000`). */
  'google_movio_cita', 'google_cancelo_cita', 'correo_fallido', 'paciente_no_asistira',
  /* Lo que el personal hace en la agenda de un médico: dirigidos SÓLO a ese médico. */
  'personal_agendo', 'personal_movio', 'personal_cancelo',
] as const
/** Los avisos SIN cita (M1): `cita` es null y lo que cuentan va en `datos`. */
export const TIPOS_SIN_CITA = [
  'reserva_frenada', 'google_desconectado', 'google_sin_sincronizar', 'personal_bloqueo', 'personal_desbloqueo',
] as const
/* ⚠️ La misma lista que `avisos_clinica_tipo_check` (M1). Un tipo nuevo va en la base ANTES que aquí. */
export const TIPOS_AVISO = [...TIPOS_CON_CITA, ...TIPOS_SIN_CITA] as const
export type TipoConCita = typeof TIPOS_CON_CITA[number]
export type TipoSinCita = typeof TIPOS_SIN_CITA[number]
export type TipoAviso = typeof TIPOS_AVISO[number]

/** La cita del aviso, con la forma que `irACita` del buscador ya acepta (`CitaEncontrada`). */
export interface CitaDelAviso {
  id: string
  title: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'no_show' | 'attended'
  medico_id: string | null
  paciente_id: string | null
  reserva_nombre: string | null
  /** Zona del consultorio de la cita; null = la del dispositivo. */
  zona: string | null
  /** Integración I · para `esPorAsignar` (I3): «¿No es una cita?» en el aviso. Ausentes sin la columna. */
  reserva_canal?: string | null
  google_asignacion?: string | null
}

/**
 * Lo que cuenta un aviso sin cita. ⚠️ Nada clínico ni de contacto: contadores, horas y, SÓLO en
 * `reserva_frenada`, el nombre que tecleó quien intentó reservar (decisión de Angel; puede no ser real).
 */
export interface DatosAviso {
  nombre?: string
  intentos?: number
  inicio?: string
  fin?: string
  todo_el_dia?: boolean
  zona?: string | null
}

interface AvisoComun {
  id: string
  creado_en: string
  /** El nombre de quien lo hizo (avisos del personal); null si no aplica o no se pudo leer. */
  actor?: string | null
  /** Va dirigido sólo a quien lo está leyendo (lo del personal en SU agenda). */
  dirigido?: boolean
}
export interface AvisoDeCita extends AvisoComun {
  tipo: TipoConCita
  cita: CitaDelAviso
}
export interface AvisoSinCita extends AvisoComun {
  tipo: TipoSinCita
  cita: null
  /** El dueño de la agenda del aviso; null = de toda la clínica (Google). */
  medico_id: string | null
  datos: DatosAviso
}
export type AvisoClinica = AvisoDeCita | AvisoSinCita

/** `disponible: false` = la base no tiene la tabla (producción sin la migración). */
export interface RespuestaAvisos {
  disponible: boolean
  avisos: AvisoClinica[]
  /**
   * Hay avisos SIN VER que la lista no trae: más de los que caben en la respuesta, o fuera de la
   * lectura acotada de la base (más de 500 recientes, o de hace 60 a 120 días: `avisos_mas_antiguos`,
   * M1). Sólo cuando hay algo que la persona puede resolver: «Marcar todos como revisados» lo cubre
   * todo. La campana lo DICE (`TEXTO_MAS_ANTIGUOS`) y su contador pone «+».
   */
  mas_antiguos?: boolean
}

/** Lo que dice la campana cuando hay avisos sin ver fuera de lo que muestra, y cómo resolverlo. */
export const TEXTO_MAS_ANTIGUOS = 'Hay más avisos sin revisar de los que se muestran aquí. «Marcar todos como revisados» también los incluye.'

/** Un aviso «recién llegado» para el aviso emergente (el mismo criterio de E8 y D11: 2 min). */
export const AVISO_RECIENTE_MS = 120_000

const ESTADOS = new Set(['scheduled', 'confirmed', 'cancelled', 'no_show', 'attended'])

function texto(o: object, k: string): string | null {
  const v: unknown = Reflect.get(o, k)
  return typeof v === 'string' ? v : null
}

function esCita(x: unknown): x is CitaDelAviso {
  if (typeof x !== 'object' || x === null) return false
  const estado = texto(x, 'status')
  return texto(x, 'id') !== null && texto(x, 'start_time') !== null && texto(x, 'end_time') !== null
    && estado !== null && ESTADOS.has(estado) && typeof Reflect.get(x, 'title') === 'string'
}

function incluye<T extends string>(lista: readonly T[], v: string | null): v is T {
  return v !== null && (lista as readonly string[]).includes(v)
}

/** Valida un aviso llegado por la red, sin `as`. */
export function esAvisoClinica(x: unknown): x is AvisoClinica {
  if (typeof x !== 'object' || x === null) return false
  if (texto(x, 'id') === null || texto(x, 'creado_en') === null) return false
  const tipo = texto(x, 'tipo')
  const cita: unknown = Reflect.get(x, 'cita')
  if (incluye(TIPOS_CON_CITA, tipo)) return esCita(cita)
  const datos: unknown = Reflect.get(x, 'datos')
  return incluye(TIPOS_SIN_CITA, tipo) && cita === null && typeof datos === 'object' && datos !== null
}

/** Lee `{ avisos, avisos_disponibles }` de una respuesta (la de `/api/avisos` o la de «Por confirmar»). */
export function leerRespuestaAvisos(d: unknown): RespuestaAvisos | null {
  if (typeof d !== 'object' || d === null) return null
  const lista: unknown = Reflect.get(d, 'avisos')
  if (!Array.isArray(lista)) return null
  return {
    disponible: Reflect.get(d, 'avisos_disponibles') === true, avisos: lista.filter(esAvisoClinica),
    ...(Reflect.get(d, 'avisos_mas_antiguos') === true ? { mas_antiguos: true } : {}),
  }
}

const MOVIMIENTO_RECHAZADO = 'Desde Google no se pueden mover las citas reservadas por enlace. Para cambiarla, usa Reagendar: se le avisará al paciente.'

/**
 * Tanda J, punto 10 · La acción que la tarjeta pone de principal al abrir la
 * cita desde el aviso («Reagendar» en el de Google); los demás, ninguna.
 */
export function destacarDeAviso(a: { tipo: TipoAviso }): 'reagendar' | undefined {
  return a.tipo === 'google_movimiento_rechazado' ? 'reagendar' : undefined
}

/** Quién: el nombre que escribió quien reservó o, si no, el título de la cita. */
function quien(c: CitaDelAviso): string {
  return (c.reserva_nombre?.trim() || c.title.trim() || 'Un paciente')
}

/**
 * Tanda L, punto 13 · Quién confirmó: el paciente ligado (con paciente, el
 * título de la cita es su nombre: lo pone el alta y lo pone ligar) o, si sigue
 * por ligar, el nombre que tecleó al reservar.
 */
function quienConfirmo(c: CitaDelAviso): string {
  const ligado = c.paciente_id ? c.title.trim() : ''
  return ligado || c.reserva_nombre?.trim() || c.title.trim() || 'Un paciente'
}

/** «del jueves, 17 de diciembre a las 10:45», en la zona del consultorio de la cita; '' si no se puede. */
function delDiaALaHora(c: CitaDelAviso): string {
  const fecha = enZona(c.start_time, c.zona, { weekday: 'long', day: 'numeric', month: 'long' })
  const hora = enZona(c.start_time, c.zona, { hour: '2-digit', minute: '2-digit', hour12: false })
  return fecha && hora ? ` del ${fecha} a las ${hora}` : ''
}

/** Quien lo hizo (avisos del personal). */
function quienLoHizo(a: AvisoClinica): string {
  return a.actor?.trim() || 'Alguien de la clínica'
}

/** «el jueves, 17 de diciembre de 09:00 a 12:00» (o sin horas, todo el día), en la zona del bloqueo. */
function rangoDeBloqueo(d: DatosAviso): string {
  if (!d.inicio) return ''
  const zona = d.zona ?? null
  const dia = enZona(d.inicio, zona, { weekday: 'long', day: 'numeric', month: 'long' })
  if (!dia) return ''
  if (d.todo_el_dia || !d.fin) return ` el ${dia}`
  const hora = (iso: string): string => enZona(iso, zona, { hour: '2-digit', minute: '2-digit', hour12: false })
  return ` el ${dia} de ${hora(d.inicio)} a ${hora(d.fin)}`
}

function textoSinCita(a: AvisoSinCita): string {
  switch (a.tipo) {
    case 'reserva_frenada': {
      const veces = (a.datos.intentos ?? 1) > 1 ? ` (${a.datos.intentos} intentos)` : ''
      return `${a.datos.nombre?.trim() || 'Alguien'} intentó reservar por enlace y no pudo${veces}`
    }
    case 'google_desconectado': return 'Google Calendar se desconectó. Vuelve a conectarlo en la configuración de la agenda'
    case 'google_sin_sincronizar': return 'La agenda lleva varios intentos sin sincronizar con Google Calendar'
    case 'personal_bloqueo': return `${quienLoHizo(a)} bloqueó tu agenda${rangoDeBloqueo(a.datos)}`
    case 'personal_desbloqueo': return `${quienLoHizo(a)} quitó un bloqueo de tu agenda${rangoDeBloqueo(a.datos).replace(/^ el /, ' del ')}`
  }
}

/** «al jueves, 17 de diciembre a las 10:45» para lo que se movió. */
function alDiaALaHora(c: CitaDelAviso): string {
  return delDiaALaHora(c).replace(/^ del /, ' al ')
}

/** La línea principal de la lista (vista del personal: el nombre sí sale, como en «Por confirmar»). */
export function textoAviso(a: AvisoClinica): string {
  if (a.cita === null) return textoSinCita(a)
  const n = quien(a.cita)
  const paciente = quienConfirmo(a.cita)
  switch (a.tipo) {
    case 'reserva_enlace': return `${n} reservó por enlace`
    case 'cancelacion_paciente': return `${n} canceló su cita`
    case 'reagendado_paciente': return `${n} reagendó su cita`
    case 'google_por_asignar': return `Evento nuevo de Google por asignar: ${a.cita.title.trim() || 'sin título'}`
    case 'empalme_google': return `La reserva de ${n} se empalma con un evento de Google`
    /* El texto literal de Angel (tanda J, punto 10); la cita va en la línea de debajo. */
    case 'google_movimiento_rechazado': return MOVIMIENTO_RECHAZADO
    /* El texto de Angel: «[Nombre] confirmó su cita del [día] a las [hora]». */
    case 'confirmacion_paciente': return `${paciente} confirmó su cita${delDiaALaHora(a.cita)}`
    case 'google_movio_cita': return `La cita de ${paciente} se movió desde Google${alDiaALaHora(a.cita)}`
    case 'google_cancelo_cita': return `La cita de ${paciente}${delDiaALaHora(a.cita)} se canceló porque se borró en Google`
    case 'correo_fallido': return `No se pudo enviar el correo a ${paciente} por su cita${delDiaALaHora(a.cita)}`
    /* El «No» de Google en la última hora: no se cancela sola, decide el personal. */
    case 'paciente_no_asistira': return `${paciente} indicó que no asistirá a su cita${delDiaALaHora(a.cita)}`
    case 'personal_agendo': return `${quienLoHizo(a)} agendó a ${paciente} en tu agenda${delDiaALaHora(a.cita).replace(/^ del /, ' para el ')}`
    case 'personal_movio': return `${quienLoHizo(a)} movió la cita de ${paciente}${alDiaALaHora(a.cita)}`
    case 'personal_cancelo': return `${quienLoHizo(a)} canceló la cita de ${paciente}${delDiaALaHora(a.cita)}`
  }
}

function enZona(iso: string, zona: string | null, opciones: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat('es-MX', { ...opciones, ...(zona ? { timeZone: zona } : {}) }).format(new Date(iso))
  } catch {
    return ''
  }
}

/** «Jue 17 dic · 10:45»: la fecha y hora de la cita, en la zona de su consultorio. */
export function cuandoDeLaCita(c: CitaDelAviso): string {
  const dia = enZona(c.start_time, c.zona, { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')
  const hora = enZona(c.start_time, c.zona, { hour: '2-digit', minute: '2-digit', hour12: false })
  return [dia.charAt(0).toLocaleUpperCase('es-MX') + dia.slice(1), hora].filter(Boolean).join(' · ')
}

/** «hace 5 min», «hace 2 h», «hace 3 días». `ahora` en ms. */
export function haceCuanto(creadoEn: string, ahora: number): string {
  const min = Math.max(0, Math.floor((ahora - Date.parse(creadoEn)) / 60_000))
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`
}

/**
 * El aviso emergente (la burbuja que sale y se quita sola). CON el nombre, por
 * decisión de Angel (bloque «avisos globales», 2026-11-24; hasta entonces iba
 * sin él, como E8 y D11): dice lo mismo que la campana (`textoAviso`, mismas
 * reglas de quién) más el día y la hora de la cita en la zona de su consultorio.
 * ⚠️ Nada clínico: ni tipo de cita, ni motivo, ni observaciones, ni contacto.
 */
export function textoEmergente(a: AvisoClinica): string {
  if (a.cita === null) return `${textoSinCita(a)}.`
  const fecha = enZona(a.cita.start_time, a.cita.zona, { weekday: 'long', day: 'numeric', month: 'long' })
  const hora = enZona(a.cita.start_time, a.cita.zona, { hour: '2-digit', minute: '2-digit', hour12: false })
  const cuando = fecha && hora ? ` para el ${fecha} a las ${hora}` : ''
  const n = quien(a.cita)
  switch (a.tipo) {
    case 'reserva_enlace': return `${n} reservó por enlace${cuando}.`
    case 'cancelacion_paciente': return `${n} canceló su cita${delDiaALaHora(a.cita)}.`
    case 'reagendado_paciente': return `${n} reagendó su cita${cuando}.`
    case 'google_por_asignar': return `Evento nuevo de Google por asignar${fecha && hora ? ` el ${fecha} a las ${hora}` : ''}.`
    case 'empalme_google': return `La reserva de ${n} se empalma con un evento de Google.`
    case 'google_movimiento_rechazado': return MOVIMIENTO_RECHAZADO
    /* Los demás ya llevan el día y la hora en su línea de la campana: la burbuja dice lo mismo. */
    default: return `${textoAviso(a)}.`
  }
}

/**
 * ¿Es «mío»? Para el interruptor «Solo mis avisos» del médico administrador: los de citas cuyo
 * médico es él, los dirigidos a él y los de toda la clínica sin médico (Google), que le tocan
 * como administrador. Los de las agendas de otros médicos, no.
 */
export function esAvisoMio(a: AvisoClinica, usuarioId: string): boolean {
  if (a.dirigido) return true
  if (a.cita !== null) return a.cita.medico_id === usuarioId
  return a.medico_id === null || a.medico_id === usuarioId
}

/**
 * Los avisos que piden aviso emergente: recientes (≤ 2 min), de un tipo
 * pedido y no avisados todavía en esta pestaña. Marca los devueltos en `vistos`.
 */
export function avisosParaEmergente(
  avisos: readonly AvisoClinica[], vistos: Set<string>, ahora: number, tipos: readonly TipoAviso[],
): AvisoClinica[] {
  const nuevos: AvisoClinica[] = []
  for (const a of avisos) {
    /* Con su hora: un aviso REABIERTO (mismo id, `creado_en` nuevo) vuelve a avisar. */
    const llave = `${a.id}@${a.creado_en}`
    if (vistos.has(llave)) continue
    vistos.add(llave)
    if (tipos.includes(a.tipo) && ahora - Date.parse(a.creado_en) <= AVISO_RECIENTE_MS) nuevos.push(a)
  }
  return nuevos
}

/**
 * Desde cualquier página: la cita del aviso en la agenda (`/agenda?cita=<id>`). Los de Google sin
 * cita llevan a la configuración de la agenda (donde se reconecta); los demás sin cita, a la agenda.
 */
export function enlaceDeAviso(a: AvisoClinica): string {
  if (a.cita !== null) return `/agenda?cita=${encodeURIComponent(a.cita.id)}`
  return a.tipo === 'google_desconectado' || a.tipo === 'google_sin_sincronizar' ? '/agenda/configuracion' : '/agenda'
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** El id de una cita EXISTENTE en `?cita=` (no `nueva`, que es el alta de siempre); null si no lo es. */
export function citaDelEnlace(busqueda: string): string | null {
  const id = new URLSearchParams(busqueda).get('cita')
  return id && UUID.test(id) ? id : null
}

/** Dónde se guarda «Solo mis avisos»: por navegador, como «Pop-up de eventos». Sin datos de nadie. */
export const CLAVE_SOLO_MIOS = 'spinus.avisos.solo-mios'
