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
 * Los escribe la BASE (disparadores de `20261121150000`), nunca el navegador.
 * Nada clínico: nombre de quien reservó (o el título de la cita), fecha y hora.
 */

export const TIPOS_AVISO = [
  'reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente', 'google_por_asignar', 'empalme_google',
] as const
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
}

export interface AvisoClinica {
  id: string
  tipo: TipoAviso
  creado_en: string
  cita: CitaDelAviso
}

/** `disponible: false` = la base no tiene la tabla (producción sin la migración). */
export interface RespuestaAvisos {
  disponible: boolean
  avisos: AvisoClinica[]
}

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

/** Valida un aviso llegado por la red, sin `as`. */
export function esAvisoClinica(x: unknown): x is AvisoClinica {
  if (typeof x !== 'object' || x === null) return false
  const tipo = texto(x, 'tipo')
  return texto(x, 'id') !== null && texto(x, 'creado_en') !== null
    && tipo !== null && (TIPOS_AVISO as readonly string[]).includes(tipo) && esCita(Reflect.get(x, 'cita'))
}

/** Lee `{ avisos, avisos_disponibles }` de una respuesta (la de `/api/avisos` o la de «Por confirmar»). */
export function leerRespuestaAvisos(d: unknown): RespuestaAvisos | null {
  if (typeof d !== 'object' || d === null) return null
  const lista: unknown = Reflect.get(d, 'avisos')
  if (!Array.isArray(lista)) return null
  return { disponible: Reflect.get(d, 'avisos_disponibles') === true, avisos: lista.filter(esAvisoClinica) }
}

/** Quién: el nombre que escribió quien reservó o, si no, el título de la cita. */
function quien(c: CitaDelAviso): string {
  return (c.reserva_nombre?.trim() || c.title.trim() || 'Un paciente')
}

/** La línea principal de la lista (vista del personal: el nombre sí sale, como en «Por confirmar»). */
export function textoAviso(a: AvisoClinica): string {
  const n = quien(a.cita)
  switch (a.tipo) {
    case 'reserva_enlace': return `${n} reservó por enlace`
    case 'cancelacion_paciente': return `${n} canceló su cita`
    case 'reagendado_paciente': return `${n} reagendó su cita`
    case 'google_por_asignar': return `Evento nuevo de Google por asignar: ${a.cita.title.trim() || 'sin título'}`
    case 'empalme_google': return `La reserva de ${n} se empalma con un evento de Google`
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

/** El aviso emergente: SIN nombre (como E8 y D11), sólo qué pasó y cuándo es la cita. */
export function textoEmergente(a: AvisoClinica): string {
  const fecha = enZona(a.cita.start_time, a.cita.zona, { weekday: 'long', day: 'numeric', month: 'long' })
  const hora = enZona(a.cita.start_time, a.cita.zona, { hour: '2-digit', minute: '2-digit', hour12: false })
  const cuando = fecha && hora ? ` para el ${fecha} a las ${hora}` : ''
  switch (a.tipo) {
    case 'reserva_enlace': return `Nueva reserva por enlace${cuando}.`
    case 'cancelacion_paciente': return fecha && hora ? `Un paciente canceló su cita del ${fecha} a las ${hora}.` : 'Un paciente canceló su cita.'
    case 'reagendado_paciente': return `Un paciente reagendó su cita${cuando}.`
    case 'google_por_asignar': return `Evento nuevo de Google por asignar${fecha && hora ? ` el ${fecha} a las ${hora}` : ''}.`
    case 'empalme_google': return 'Una reserva por enlace se empalma con un evento de Google.'
  }
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
    if (vistos.has(a.id)) continue
    vistos.add(a.id)
    if (tipos.includes(a.tipo) && ahora - Date.parse(a.creado_en) <= AVISO_RECIENTE_MS) nuevos.push(a)
  }
  return nuevos
}

/** Desde cualquier página: la cita del aviso en la agenda (`/agenda?cita=<id>`). */
export function enlaceDeAviso(a: AvisoClinica): string {
  return `/agenda?cita=${encodeURIComponent(a.cita.id)}`
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** El id de una cita EXISTENTE en `?cita=` (no `nueva`, que es el alta de siempre); null si no lo es. */
export function citaDelEnlace(busqueda: string): string | null {
  const id = new URLSearchParams(busqueda).get('cita')
  return id && UUID.test(id) ? id : null
}
