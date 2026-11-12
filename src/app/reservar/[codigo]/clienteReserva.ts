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
    ya_reagendada: 'Esa cita ya se reagendó.',
  }
  return textos[error] ?? 'No se pudo completar. Intenta de nuevo.'
}

/** «lunes 16 de noviembre» de una fecha de pared. */
export function etiquetaDia(fecha: string): string {
  return new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${fecha}T12:00:00Z`))
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
