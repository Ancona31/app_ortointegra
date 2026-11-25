/**
 * avisoEmpalmeReserva.ts — «avisa a la clínica» cuando una sincronización con
 * Google importa o mueve algo que se empalma con una cita reservada por
 * enlace (decisión de Angel, §6-bis «Bloque D — sincronización con Google
 * antes de reservar», punto 4). Puro.
 *
 * Mismo canal que el aviso de cancelación de E8: la sección del panel «Por
 * confirmar» (`GET /api/agenda/por-confirmar`) y un aviso emergente sin
 * nombre cuando el panel se recarga y trae uno recién detectado. Los pares
 * los escribe la sincronización (`reserva_empalmes_registrar`, una vez por
 * par); aquí sólo se decide cuáles siguen VIGENTES: si el personal ya movió o
 * canceló una de las dos citas, el aviso sale solo.
 */

/** Ventana de lectura de los pares detectados. */
export const VENTANA_EMPALMES_MS = 30 * 86_400_000
/** Antigüedad máxima del par para el aviso emergente. */
export const AVISO_EMPALME_MS = 120_000

/** Una fila de «Reservas por enlace empalmadas con Google». */
export interface FilaEmpalme {
  /** La cita reservada por enlace. */
  id: string
  inicio: string
  zona: string
  titulo: string
  detectado_en: string
}

export interface ParEmpalme { cita_reserva_id: string; cita_otra_id: string; detectado_en: string }

export interface CitaDelPar {
  id: string
  title: string | null
  start_time: string
  end_time: string
  consultorio_timezone: string | null
  status: string
  all_day: boolean
  medico_id: string | null
}

const ZONA_POR_OMISION = 'America/Mexico_City'

function reservaActiva(c: CitaDelPar, ahora: number): boolean {
  return (c.status === 'scheduled' || c.status === 'confirmed') && !c.all_day && Date.parse(c.end_time) > ahora
}

function otraOcupa(c: CitaDelPar): boolean {
  return c.status !== 'cancelled' && c.status !== 'no_show' && !c.all_day
}

function seEmpalman(a: CitaDelPar, b: CitaDelPar): boolean {
  return a.medico_id === b.medico_id && Date.parse(a.start_time) < Date.parse(b.end_time) && Date.parse(b.start_time) < Date.parse(a.end_time)
}

/**
 * Los pares cuyo empalme sigue en pie con las citas de hoy (las dos visibles
 * para la sesión), una fila por reserva, la detección más reciente.
 */
export function empalmesVigentes(pares: readonly ParEmpalme[], citas: readonly CitaDelPar[], ahora: number): FilaEmpalme[] {
  const porId = new Map(citas.map((c) => [c.id, c]))
  const porReserva = new Map<string, FilaEmpalme>()
  for (const p of pares) {
    const r = porId.get(p.cita_reserva_id)
    const o = porId.get(p.cita_otra_id)
    if (!r || !o || !reservaActiva(r, ahora) || !otraOcupa(o) || !seEmpalman(r, o)) continue
    const previa = porReserva.get(r.id)
    if (previa && Date.parse(previa.detectado_en) >= Date.parse(p.detectado_en)) continue
    porReserva.set(r.id, {
      id: r.id, inicio: r.start_time, zona: r.consultorio_timezone || ZONA_POR_OMISION, titulo: r.title ?? '', detectado_en: p.detectado_en,
    })
  }
  return [...porReserva.values()].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))
}

export function esEmpalmeReciente(detectadoEn: string, ahora: number): boolean {
  const t = Date.parse(detectadoEn)
  return Number.isFinite(t) && ahora - t >= -5_000 && ahora - t < AVISO_EMPALME_MS
}

/** «Un evento de Google se empalma con una cita reservada por enlace el martes 17 de noviembre a las 10:00.» Sin nombre. */
export function textoAvisoEmpalme(inicio: string, zona: string): string {
  try {
    const d = new Date(inicio)
    const fecha = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: zona }).format(d)
    const hora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zona }).format(d)
    return `Un evento de Google se empalma con una cita reservada por enlace el ${fecha} a las ${hora}.`
  } catch {
    return 'Un evento de Google se empalma con una cita reservada por enlace.'
  }
}
