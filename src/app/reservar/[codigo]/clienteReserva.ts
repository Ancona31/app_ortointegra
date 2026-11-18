/**
 * clienteReserva.ts — tipos y llamadas del navegador de la página pública de
 * reserva (agenda D5). Sin estado y sin localStorage: lo que la persona
 * escribe vive en la memoria de la pestaña y nada más.
 */

export interface ConsultorioPagina { id: string; nombre: string; direccion: string | null; telefono: string | null; zona: string }
export interface TipoPagina { id: string; nombre: string; duracionMin: number }
export interface TurnoPagina { inicio: string; fin: string }
export interface DiaPagina { fecha: string; turnos: TurnoPagina[] }

/** Respuesta de la API ya leída: estado HTTP y cuerpo JSON (o vacío). */
export interface RespuestaApi { status: number; cuerpo: Record<string, unknown> }

export async function pedir(url: string, metodo: 'GET' | 'POST', cuerpo?: unknown): Promise<RespuestaApi> {
  try {
    const r = await fetch(url, {
      method: metodo,
      headers: cuerpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      cache: 'no-store',
    })
    const datos: unknown = await r.json().catch(() => ({}))
    return { status: r.status, cuerpo: typeof datos === 'object' && datos !== null ? { ...datos } : {} }
  } catch {
    return { status: 0, cuerpo: {} }
  }
}

/** Los días que devolvió /turnos, validados por forma sin `as`. */
export function leerDias(cuerpo: Record<string, unknown>): DiaPagina[] {
  const dias = cuerpo.dias
  if (!Array.isArray(dias)) return []
  return dias.flatMap((d: unknown): DiaPagina[] => {
    if (typeof d !== 'object' || d === null || !('fecha' in d) || !('turnos' in d)) return []
    const { fecha, turnos } = d
    if (typeof fecha !== 'string' || !Array.isArray(turnos)) return []
    const lista = turnos.flatMap((t: unknown): TurnoPagina[] =>
      typeof t === 'object' && t !== null && 'inicio' in t && 'fin' in t && typeof t.inicio === 'string' && typeof t.fin === 'string'
        ? [{ inicio: t.inicio, fin: t.fin }] : [])
    return [{ fecha, turnos: lista }]
  })
}

/** Texto para la persona según el error de la API. */
export function mensajeDeError(r: RespuestaApi): string {
  const error = typeof r.cuerpo.error === 'string' ? r.cuerpo.error : ''
  const mensaje = typeof r.cuerpo.mensaje === 'string' ? r.cuerpo.mensaje : null
  if (mensaje) return mensaje
  const textos: Record<string, string> = {
    turno_ocupado: 'Ese horario se acaba de ocupar. Elige otro.',
    turno_invalido: 'Ese horario ya no está disponible. Elige otro.',
    fuera_de_ventana: 'Ese horario ya no está disponible. Elige otro.',
    correo_sin_verificar: 'Primero verifica tu correo con el código.',
    codigo_incorrecto: 'El código no es correcto.',
    codigo_caducado: 'El código venció. Pide otro.',
    codigo_agotado: 'Demasiados intentos con ese código. Pide otro.',
    sin_codigo: 'Pide un código primero.',
    demasiados_intentos: 'Demasiados intentos. Espera un rato y vuelve a probar.',
    telefono_invalido: 'Escribe un teléfono de 10 dígitos.',
    correo_invalido: 'Revisa tu correo electrónico.',
    correo_no_enviado: 'No pudimos enviar el correo. Intenta más tarde.',
    enlace_usado: 'Este enlace ya se usó.',
    enlace_caducado: 'Este enlace venció.',
    enlace_no_disponible: 'Este enlace ya no está disponible.',
    ya_reagendada: 'Esa cita ya se reagendó.',
  }
  return textos[error] ?? 'No se pudo completar. Intenta de nuevo.'
}

/**
 * Sólo la primera letra en mayúscula. Antes la página usaba la clase CSS
 * `capitalize`, que sube TODAS las palabras: «Viernes, 13 De Noviembre»
 * (tanda G1, punto 1). La preposición va en minúscula.
 */
export function mayusculaInicial(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('es-MX') + texto.slice(1)
}

function formatoDia(fecha: string, opciones: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es-MX', { ...opciones, timeZone: 'UTC' }).format(new Date(`${fecha}T12:00:00Z`))
}

/** «Viernes, 13 de noviembre» de una fecha de pared (sólo la primera letra en mayúscula). */
export function etiquetaDia(fecha: string): string {
  return mayusculaInicial(formatoDia(fecha, { weekday: 'long', day: 'numeric', month: 'long' }))
}

/** «Vie» y «13» para la tira de fechas. */
export function partesDia(fecha: string): { semana: string; numero: string } {
  return { semana: mayusculaInicial(formatoDia(fecha, { weekday: 'short' }).replace('.', '')), numero: formatoDia(fecha, { day: 'numeric' }) }
}

/** «14 – 20 de noviembre», o «28 de noviembre – 4 de diciembre» si cruza de mes. */
export function rangoSemana(dias: readonly DiaPagina[]): string {
  const primero = dias[0]?.fecha
  const ultimo = dias[dias.length - 1]?.fecha
  if (!primero || !ultimo) return ''
  const fin = formatoDia(ultimo, { day: 'numeric', month: 'long' })
  const mismoMes = primero.slice(0, 7) === ultimo.slice(0, 7)
  return `${mismoMes ? formatoDia(primero, { day: 'numeric' }) : formatoDia(primero, { day: 'numeric', month: 'long' })} – ${fin}`
}

/**
 * Los turnos de un día en «Mañana» (antes de las 12:00 en la zona del
 * consultorio) y «Tarde» (de las 12:00 en adelante), en el orden recibido.
 */
export function agruparTurnos(turnos: readonly TurnoPagina[], zona: string): { manana: TurnoPagina[]; tarde: TurnoPagina[] } {
  const hora = new Intl.DateTimeFormat('es-MX', { hour: 'numeric', hourCycle: 'h23', timeZone: zona })
  const manana: TurnoPagina[] = []
  const tarde: TurnoPagina[] = []
  for (const t of turnos) (Number(hora.format(new Date(t.inicio))) < 12 ? manana : tarde).push(t)
  return { manana, tarde }
}

/** El primer día con algún turno, o null si la semana está vacía. */
export function primerDiaConTurnos(dias: readonly DiaPagina[]): string | null {
  return dias.find(d => d.turnos.length > 0)?.fecha ?? null
}

/** «10:30» de un instante en la zona del consultorio. */
export function horaEnZona(instante: string, zona: string): string {
  return new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zona }).format(new Date(instante))
}

/** Suma días a una fecha de pared `YYYY-MM-DD`. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** El día de pared (`YYYY-MM-DD`) de un instante en la zona del consultorio. */
export function fechaEnZona(instante: string | Date, zona: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instante))
}

/** Hoy en la zona del consultorio. */
export function hoyEn(zona: string): string {
  return fechaEnZona(new Date(), zona)
}
