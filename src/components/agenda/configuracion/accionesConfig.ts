/**
 * Las escrituras de la configuración nueva de la agenda (tanda J, J5): el
 * funnel de primera vez y las cinco pestañas guardan con ESTAS funciones, que
 * llaman a las rutas de siempre —con sus esquemas Zod, sus roles y su
 * auditoría en el servidor—. Ninguna ruta nueva: aquí sólo se arma la
 * petición y se traduce la respuesta a `{ ok, valor }` / `{ ok: false, motivo }`.
 *
 * Varias son copia de las que viven dentro de los componentes de la
 * configuración vieja (`DuracionConsulta`, `SeccionEnlacesReserva`,
 * `FilaDisponibilidad`, los interruptores), que se quedan como están: la
 * página vieja no se toca (J5, encargo).
 *
 * Nombre distinto de cualquier componente de la carpeta (regla de mayúsculas
 * de `CLAUDE.md`).
 */
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'
import { AjustesAgendaSchema, type AjustesAgenda } from '@/lib/agenda/ajustesAgenda'
import { CrearTipoCitaSchema, EditarTipoCitaSchema } from '@/lib/agenda/tiposCita'
import type { Horario } from '@/lib/configApp'

export type Resultado<T> = { ok: true; valor: T } | { ok: false; motivo: string }

const JSON_CAB = { 'Content-Type': 'application/json' }
const NO_DISPONIBLE = 'Esta opción todavía no está disponible en este servidor'

/** Una petición JSON: el cuerpo leído con `leer`, o el motivo del fallo. */
async function pedir<T>(url: string, init: RequestInit, porDefecto: string, leer: (j: unknown) => T): Promise<Resultado<T>> {
  try {
    const res = await fetch(url, { cache: 'no-store', ...init, headers: JSON_CAB })
    if (res.status === 503) return { ok: false, motivo: NO_DISPONIBLE }
    if (!res.ok) return { ok: false, motivo: await leerMotivoError(res, porDefecto) }
    return { ok: true, valor: leer(await res.json().catch(() => null)) }
  } catch {
    return { ok: false, motivo: porDefecto }
  }
}

const campo = (j: unknown, k: string): unknown => (j && typeof j === 'object' ? Object.entries(j).find(([x]) => x === k)?.[1] : undefined)

/** Los cuatro plazos de la clínica (`PUT /api/me/ajustes-agenda`, sólo quien administra). */
export function guardarAjustes(a: AjustesAgenda): Promise<Resultado<AjustesAgenda>> {
  return pedir('/api/me/ajustes-agenda', { method: 'PUT', body: JSON.stringify(a) }, 'No se pudieron guardar los ajustes', j => {
    const r = AjustesAgendaSchema.safeParse(campo(j, 'ajustes'))
    return r.success ? r.data : a
  })
}

export type Interruptor = 'recordatorio_encendido' | 'correo_reserva_clinica'

/** Uno de los dos interruptores de la clínica (`PATCH /api/me/ajustes-agenda`, una clave por petición). */
export function guardarInterruptor(clave: Interruptor, valor: boolean): Promise<Resultado<boolean>> {
  return pedir('/api/me/ajustes-agenda', { method: 'PATCH', body: JSON.stringify({ [clave]: valor }) }, 'No se pudo guardar el aviso', j => {
    const v = campo(j, clave)
    return typeof v === 'boolean' ? v : valor
  })
}

export type CambiosConsultorio = { horario_propio: boolean; horario?: Horario } | { horario_revisado: true }

/**
 * El horario de un consultorio (`PATCH /api/consultorios/[id]`; sólo su dueño,
 * RLS). Devuelve la marca `horario_revisado_en` que puso el servidor
 * (`undefined` si la base no tiene la columna). NUNCA manda `timezone`.
 */
export function guardarHorarioConsultorio(id: string, cambios: CambiosConsultorio): Promise<Resultado<string | null | undefined>> {
  return pedir(`/api/consultorios/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }, 'No se pudo guardar el horario', j => {
    const c = campo(j, 'consultorio')
    const v = campo(c, 'horario_revisado_en')
    return v === undefined ? undefined : typeof v === 'string' ? v : null
  })
}

/**
 * El horario de la clínica y, si se da, su huso «de fábrica» (`PUT /api/me/horario`: sólo quien
 * administra, validado y auditado en el servidor; K3 punto 12). El huso de cada consultorio no se toca.
 */
export function guardarHorarioClinica(horario: Horario, timezone?: string): Promise<Resultado<null>> {
  return pedir('/api/me/horario', { method: 'PUT', body: JSON.stringify(timezone ? { horario, timezone } : { horario }) },
    'No se pudo guardar el horario de la clínica', () => null)
}

/** La duración de la consulta del médico: crea su tipo principal o cambia el que tiene. Devuelve el id del tipo. */
export function guardarDuracion(o: { medicoId: string; editarId?: string; minutos: number }): Promise<Resultado<string | null>> {
  const r = o.editarId
    ? EditarTipoCitaSchema.safeParse({ duracion_min: o.minutos })
    : CrearTipoCitaSchema.safeParse({ nombre: 'Consulta', duracion_min: o.minutos, medico_id: o.medicoId, principal: true })
  if (!r.success) return Promise.resolve({ ok: false, motivo: r.error.issues[0]?.message ?? 'Duración inválida' })
  const url = o.editarId ? `/api/agenda/tipos-cita/${o.editarId}` : '/api/agenda/tipos-cita'
  return pedir(url, { method: o.editarId ? 'PATCH' : 'POST', body: JSON.stringify(r.data) }, 'No se pudo guardar la duración', j => {
    const id = campo(campo(j, 'tipo'), 'id')
    return typeof id === 'string' ? id : o.editarId ?? null
  })
}

/** Cambiar un tipo de cita: archivarlo («Quitar»), reactivarlo o editar nombre, minutos y color. */
export function editarTipo(id: string, cambios: Record<string, unknown>): Promise<Resultado<null>> {
  const r = EditarTipoCitaSchema.safeParse(cambios)
  if (!r.success) return Promise.resolve({ ok: false, motivo: r.error.issues[0]?.message ?? 'Datos inválidos' })
  return pedir(`/api/agenda/tipos-cita/${id}`, { method: 'PATCH', body: JSON.stringify(r.data) }, 'No se pudo guardar el tipo de cita', () => null)
}

/** Un tipo de cita más («Agregar tipo de cita»), con el mismo esquema que la ruta. */
export function crearTipo(d: { nombre: string; duracion: string; color: string; medicoId: string }): Promise<Resultado<null>> {
  const r = CrearTipoCitaSchema.safeParse({ nombre: d.nombre, duracion_min: Number(d.duracion), color: d.color || null, medico_id: d.medicoId || null })
  if (!r.success) return Promise.resolve({ ok: false, motivo: r.error.issues[0]?.message ?? 'Datos inválidos' })
  return pedir('/api/agenda/tipos-cita', { method: 'POST', body: JSON.stringify(r.data) }, 'No se pudo guardar el tipo de cita', () => null)
}

const conCodigo = (j: unknown): { id: string | null; codigo: string | null } => {
  const codigo = campo(j, 'codigo')
  const id = campo(campo(j, 'enlace'), 'id')
  return { codigo: typeof codigo === 'string' ? codigo : null, id: typeof id === 'string' ? id : null }
}

/**
 * Emite un enlace (`POST /api/agenda/enlaces`): el fijo de un médico (lo regenera si ya tenía) o uno de una vez.
 * El de una vez lleva, si la clínica lo escribió, el correo del paciente (tanda J, punto 3: el comprobante y los
 * avisos de esa cita van sólo ahí; integración J2 ↔ J5).
 */
export function emitirEnlace(
  medicoId: string, clase: 'fijo' | 'unico', etiqueta: string | null = null, correo: string | null = null,
): Promise<Resultado<{ id: string | null; codigo: string | null }>> {
  const cuerpo = clase === 'unico'
    ? { clase, medico_id: medicoId, ...(etiqueta ? { etiqueta } : {}), ...(correo ? { correo } : {}) }
    : { clase, medico_id: medicoId }
  return pedir('/api/agenda/enlaces', { method: 'POST', body: JSON.stringify(cuerpo) }, 'No se pudo crear el enlace', conCodigo)
}

/** Revoca un enlace («Apagar»): deja de funcionar para siempre. */
export function revocarEnlace(id: string): Promise<Resultado<null>> {
  return pedir(`/api/agenda/enlaces/${id}`, { method: 'PATCH', body: JSON.stringify({ accion: 'revocar' }) }, 'No se pudo apagar el enlace', () => null)
}

/**
 * K3 (punto 14): apaga (`pausar`) o prende (`reanudar`) el enlace fijo SIN cambiarle la dirección.
 * Sólo «Cambiar por uno nuevo» (regenerar) o revocar lo dejan sin servir para siempre.
 */
export function pausarEnlace(id: string, pausar: boolean): Promise<Resultado<null>> {
  return pedir(`/api/agenda/enlaces/${id}`, { method: 'PATCH', body: JSON.stringify({ accion: pausar ? 'pausar' : 'reanudar' }) },
    pausar ? 'No se pudo apagar el enlace' : 'No se pudo prender el enlace', () => null)
}

/** El código de un enlace vigente, para enseñar su dirección. */
export async function leerCodigo(id: string): Promise<Resultado<string>> {
  const r = await pedir(`/api/agenda/enlaces/${id}`, { method: 'GET' }, 'No se pudo leer el enlace', j => conCodigo(j).codigo)
  if (!r.ok) return r
  return r.valor ? { ok: true, valor: r.valor } : { ok: false, motivo: 'No se pudo leer el enlace' }
}

/** La dirección pública que se comparte (`/reservar/{código}`; la de la maqueta es de adorno). */
export const urlReserva = (codigo: string): string => `${window.location.origin}/reservar/${codigo}`

/** WhatsApp sin número: el médico elige a quién mandárselo. */
export const urlWhatsApp = (url: string): string => `https://wa.me/?text=${encodeURIComponent(url)}`
