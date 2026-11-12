/**
 * src/lib/gcalSincronizacionDecidir.ts
 *
 * Qué hacer con CADA evento que llega del calendario Spinus de Google en la
 * sincronización de vuelta (bloque C de `mejora_agendaV2.md`). Código PURO:
 * sin red, sin base, sin reloj propio (la hora entra por `ctx.ahora`). Quien
 * ejecuta la decisión es `gcalSincronizacion.ts`, por las RPC de
 * `gcalSincronizacionBase.ts`; la base vuelve a imponer las mismas reglas
 * (`20261113130000_agenda_c2_gcal_aplicar.sql`) aunque aquí hubiera un error.
 *
 * ── LAS REGLAS QUE MANDAN (mejora_agendaV2.md §6-bis, decisiones de Angel) ──
 * · C-a: los eventos RECURRENTES no se importan ni se aplican; siguen en solo
 *   lectura como hoy.
 * · C-d: el título de una cita CON paciente no se acepta desde Google; Spinus
 *   lo restablece (marca `restablecer`). Sin paciente, el título sí vuelve.
 * · C-e: sólo `scheduled` y `confirmed` aceptan cambios. Si en Google se mueve,
 *   edita o borra el evento de una cita `attended`, `no_show` o `cancelled`,
 *   se rechaza, se audita y se marca para volver a escribir en Google el
 *   estado de Spinus. La reescritura NO es de aquí (la hace C5): aquí sólo se
 *   decide y se marca. Restaurar en Google un evento borrado no reactiva nada.
 * · S1: las observaciones escritas en Spinus no viajan a Google. Única
 *   excepción: una fila nacida en Google (`origen='google'`) y SIN paciente
 *   conserva su descripción en los dos sentidos. Ligada a un paciente, deja de
 *   importarse.
 * · Conflicto: gana el último cambio (`event.updated` contra `updated_at`).
 *
 * ⚠️ El título que se compara es el que Spinus MANDA a Google, compuesto con
 * `eventoParaGoogle` (el mismo punto único que usan las rutas), no el de la
 * fila: así el prefijo «CANCELADA — » y el «Cita médica: <nombre>» de una cita
 * con paciente no se leen como ediciones hechas en Google.
 */
import type { calendar_v3 } from 'googleapis'
import { formatInTimeZone } from 'date-fns-tz'
import { eventoParaGoogle } from '@/lib/appointments'
import { fechaHoraLocalAInstante, TZ_CLINICA } from '@/lib/dates'
import { comprobarTopeDuracion } from '@/lib/agenda/topeDuracion'

export type EventoGoogle = calendar_v3.Schema$Event

/** La cita tal como la devuelve `gcal_citas_por_evento` (C2), ya validada. */
export interface FilaEspejo {
  id: string
  googleEventId: string | null
  gcalCalendarId: string | null
  gcalEtag: string | null
  gcalSyncStatus: 'synced' | 'pending' | 'failed' | 'unbound'
  origen: 'spinus' | 'google'
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'no_show' | 'attended'
  inicio: string
  fin: string
  todoElDia: boolean
  zona: string | null
  updatedAt: string | null
  conPaciente: boolean
  /** Sólo en filas sin paciente. */
  tituloSinPaciente: string | null
  /** Sólo en filas `origen='google'` sin paciente (S1). */
  notasDeGoogle: string | null
  /** Sólo en filas con paciente: para componer el título que se manda. */
  paciente: { nombre: string; apellidos: string } | null
}

export interface ContextoDecision {
  /** El calendario de la conexión activa de la clínica. */
  calendarId: string
  /** `timeMin` de la sincronización completa; lo que termina antes no se importa. */
  ventanaDesde: string | null
  /** `timeZone` que devuelve `events.list` para el calendario. */
  zonaCalendario: string | null
  /** Dueño de la conexión: el médico de lo que se importa (C-c). */
  medicoId: string
  /** Milisegundos «ahora», para el borrado sin `updated`. */
  ahora: number
}

export interface Puntas { inicio: string; fin: string; todoElDia: boolean }

/** Lo que sí se acepta de Google. Ausente = no tocar. */
export interface CambiosAceptados {
  puntas?: Puntas
  titulo?: string
  /** `null` = vaciar. Sólo filas de Google sin paciente (S1). */
  notas?: string | null
  cancelar?: boolean
}

/** Nombres de campo para la auditoría. NUNCA valores. */
export type CampoCambio = 'hora' | 'titulo' | 'notas' | 'borrado'

export type MotivoIgnorar =
  | 'sin_id' | 'recurrente' | 'recurrente_ligado' | 'tipo_especial' | 'otro_calendario' | 'marca_ajena'
  | 'eco_etag' | 'cancelado_sin_fila' | 'cancelado_sin_vinculo' | 'marca_sin_fila' | 'fuera_de_ventana'
  | 'sin_puntas' | 'sin_etag' | 'excede_tope'

export interface DatosImportar {
  googleEventId: string
  etag: string
  actualizado: string | null
  titulo: string | null
  puntas: Puntas
  zona: string
  notas: string | null
  medicoId: string
}

export type Decision =
  | { tipo: 'ignorar'; motivo: MotivoIgnorar }
  | { tipo: 'importar'; datos: DatosImportar }
  | {
      tipo: 'aplicar'
      citaId: string
      esperadoUpdatedAt: string | null
      etag: string | null
      actualizado: string | null
      vincular: string | null
      desvincular: boolean
      cambios: CambiosAceptados
      campos: CampoCambio[]
      conflicto: 'gana_google' | null
      /** Lo que Google cambió y NO se acepta: C5 vuelve a escribir el de Spinus. */
      restablecer: CampoCambio[]
    }
  | {
      tipo: 'rechazar'
      citaId: string
      motivo: 'estado_cerrado' | 'gana_spinus'
      campos: CampoCambio[]
      /** Siempre: C5 vuelve a escribir en Google el estado de Spinus. */
      restablecer: true
    }

const TOPE_TITULO = 500
const TOPE_NOTAS = 5000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FECHA = /^\d{4}-\d{2}-\d{2}$/
const ACTIVAS: ReadonlySet<FilaEspejo['status']> = new Set(['scheduled', 'confirmed'])

/** El id de la cita que Spinus guardó en `extendedProperties.private` (C5), si es un uuid. */
export function marcaSpinus(evento: EventoGoogle): string | null {
  const marca = evento.extendedProperties?.private?.spinus_cita
  return typeof marca === 'string' && UUID.test(marca) ? marca.toLowerCase() : null
}

/** ¿La zona existe para `Intl`? Una inválida cae a la de respaldo. */
function zonaValida(zona: string | null | undefined): string | null {
  if (!zona) return null
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zona })
    return zona
  } catch {
    return null
  }
}

/**
 * Las dos puntas de un evento de Google como instantes ISO. `date` (todo el
 * día) se ancla a la medianoche de `zona`; `fin` es exclusivo en los dos
 * lados, como en Spinus. `null` si faltan, se mezclan o no se leen.
 */
export function puntasDesdeGoogle(evento: EventoGoogle, zona: string): Puntas | null {
  const { start, end } = evento
  if (start?.dateTime && end?.dateTime) {
    const ini = Date.parse(start.dateTime)
    const fin = Date.parse(end.dateTime)
    if (Number.isNaN(ini) || Number.isNaN(fin) || fin <= ini) return null
    return { inicio: new Date(ini).toISOString(), fin: new Date(fin).toISOString(), todoElDia: false }
  }
  if (start?.date && end?.date && !start.dateTime && !end.dateTime && FECHA.test(start.date) && FECHA.test(end.date)) {
    try {
      const inicio = fechaHoraLocalAInstante(start.date, '00:00', zona)
      const fin = fechaHoraLocalAInstante(end.date, '00:00', zona)
      return Date.parse(fin) > Date.parse(inicio) ? { inicio, fin, todoElDia: true } : null
    } catch {
      return null
    }
  }
  return null
}

/**
 * La descripción de Google como texto plano: Google la guarda a veces en HTML.
 * Quita etiquetas, convierte saltos, decodifica seis entidades (`&amp;` al
 * final, para no decodificar dos veces) y corta a 5000.
 */
export function textoPlano(descripcion: string | null | undefined): string {
  if (!descripcion) return ''
  return descripcion
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, TOPE_NOTAS)
}

/** El `summary` que Spinus manda hoy a Google para esta fila, o null si no se sabe componer. */
export function resumenEsperado(fila: FilaEspejo): string | null {
  const zona = fila.zona ?? TZ_CLINICA
  if (fila.conPaciente) {
    return fila.paciente ? eventoParaGoogle(fila.paciente, null, '', null, zona, fila.status).summary.trim() : null
  }
  return fila.tituloSinPaciente === null
    ? null
    : eventoParaGoogle(null, null, fila.tituloSinPaciente, null, zona, fila.status).summary.trim()
}

/** ¿El cambio de Google es posterior al último de Spinus? Sin `updated`, cuenta como ahora. */
function googleMasReciente(actualizado: string | null | undefined, filaUpdatedAt: string | null, ahora: number): boolean {
  const g = actualizado ? Date.parse(actualizado) : ahora
  const f = filaUpdatedAt ? Date.parse(filaUpdatedAt) : Number.NEGATIVE_INFINITY
  return (Number.isNaN(g) ? ahora : g) > (Number.isNaN(f) ? Number.NEGATIVE_INFINITY : f)
}

/**
 * ¿Las puntas de Google son las de la fila? Por INSTANTE. Tolera el caso
 * heredado de AG-DT-5: una fila de todo el día cuyo evento se escribió antes
 * del 2026-08-27 con `dateTime` de medianoche a medianoche.
 */
function mismaHora(p: Puntas, fila: FilaEspejo): boolean {
  const iguales = Date.parse(p.inicio) === Date.parse(fila.inicio) && Date.parse(p.fin) === Date.parse(fila.fin)
  return iguales && (p.todoElDia === fila.todoElDia || (fila.todoElDia && !p.todoElDia))
}

interface Comparacion { cambios: CambiosAceptados; campos: CampoCambio[]; rechazados: CampoCambio[] }

/** ¿El instante es una medianoche en `zona`? */
function esMedianoche(iso: string, zona: string): boolean {
  return formatInTimeZone(new Date(iso), zona, 'HH:mm:ss.SSS') === '00:00:00.000'
}

/**
 * AG-DT-5 heredado, también al MOVER: una fila de todo el día cuyo evento se
 * escribió con `dateTime` de medianoche a medianoche sigue siendo de todo el
 * día aunque en Google la arrastren a otro día. Sin esto dejaría de serlo.
 */
function heredadoTodoElDia(p: Puntas, fila: FilaEspejo): Puntas {
  if (!fila.todoElDia || p.todoElDia || !fila.zona) return p
  return esMedianoche(p.inicio, fila.zona) && esMedianoche(p.fin, fila.zona) ? { ...p, todoElDia: true } : p
}

/** La hora: aceptada, rechazada (C-d, tope, sin zona) o igual. */
function compararHora(evento: EventoGoogle, fila: FilaEspejo, ctx: ContextoDecision, c: Comparacion): void {
  const leidas = puntasDesdeGoogle(evento, fila.zona ?? zonaValida(ctx.zonaCalendario) ?? TZ_CLINICA)
  const p = leidas ? heredadoTodoElDia(leidas, fila) : null
  if (!p || mismaHora(p, fila)) return
  const rechazada =
    // Una cita con paciente no pasa a todo el día. Hoy el tope de 10 h ya lo
    // impide (un día dura 23 h o más), pero la regla es otra y va escrita.
    (p.todoElDia && fila.conPaciente)
    || (p.todoElDia && !fila.zona)                         // sin zona, la medianoche no cumple la CHECK
    || comprobarTopeDuracion(p.inicio, p.fin, fila.conPaciente) !== null
  if (rechazada) {
    c.rechazados.push('hora')
  } else {
    c.cambios.puntas = p
    c.campos.push('hora')
  }
}

/** Título (C-d) y notas (S1). */
function compararTextos(evento: EventoGoogle, fila: FilaEspejo, c: Comparacion): void {
  const esperado = resumenEsperado(fila)
  const titulo = (evento.summary ?? '').trim()
  if (esperado !== null && titulo !== esperado) {
    if (fila.conPaciente || titulo === '') {
      c.rechazados.push('titulo')
    } else {
      c.cambios.titulo = titulo.slice(0, TOPE_TITULO)
      c.campos.push('titulo')
    }
  }
  if (fila.origen === 'google' && !fila.conPaciente) {
    const notas = textoPlano(evento.description)
    if (notas !== (fila.notasDeGoogle ?? '').trim()) {
      c.cambios.notas = notas === '' ? null : notas
      c.campos.push('notas')
    }
  }
}

/** Un evento sin fila en Spinus: importarlo (C-b, C-c) o dejarlo en solo lectura. */
function decidirSinFila(evento: EventoGoogle, id: string, ctx: ContextoDecision): Decision {
  if (evento.status === 'cancelled') return { tipo: 'ignorar', motivo: 'cancelado_sin_fila' }
  // Lleva la marca de una cita de Spinus que ya no existe (o no es de esta
  // clínica): no se resucita como evento.
  if (marcaSpinus(evento)) return { tipo: 'ignorar', motivo: 'marca_sin_fila' }
  const zona = zonaValida(evento.start?.timeZone) ?? zonaValida(ctx.zonaCalendario) ?? TZ_CLINICA
  const puntas = puntasDesdeGoogle(evento, zona)
  if (!puntas) return { tipo: 'ignorar', motivo: 'sin_puntas' }
  if (!evento.etag) return { tipo: 'ignorar', motivo: 'sin_etag' }
  if (ctx.ventanaDesde && Date.parse(puntas.fin) <= Date.parse(ctx.ventanaDesde)) {
    return { tipo: 'ignorar', motivo: 'fuera_de_ventana' }
  }
  if (comprobarTopeDuracion(puntas.inicio, puntas.fin, false) !== null) return { tipo: 'ignorar', motivo: 'excede_tope' }
  const titulo = (evento.summary ?? '').trim().slice(0, TOPE_TITULO)
  const notas = textoPlano(evento.description)
  return {
    tipo: 'importar',
    datos: {
      googleEventId: id, etag: evento.etag, actualizado: evento.updated ?? null, titulo: titulo || null,
      puntas, zona, notas: notas || null, medicoId: ctx.medicoId,
    },
  }
}

/** Borrado en Google de un evento ligado. */
function decidirBorrado(evento: EventoGoogle, fila: FilaEspejo, ctx: ContextoDecision, vincular: string | null): Decision {
  if (vincular) return { tipo: 'ignorar', motivo: 'cancelado_sin_vinculo' }
  if (!ACTIVAS.has(fila.status)) {
    return { tipo: 'rechazar', citaId: fila.id, motivo: 'estado_cerrado', campos: ['borrado'], restablecer: true }
  }
  if (!googleMasReciente(evento.updated, fila.updatedAt, ctx.ahora)) {
    return { tipo: 'rechazar', citaId: fila.id, motivo: 'gana_spinus', campos: ['borrado'], restablecer: true }
  }
  return {
    tipo: 'aplicar', citaId: fila.id, esperadoUpdatedAt: fila.updatedAt, etag: null,
    actualizado: evento.updated ?? new Date(ctx.ahora).toISOString(), vincular: null, desvincular: true,
    cambios: { cancelar: true }, campos: ['borrado'], conflicto: conflictoDe(fila), restablecer: [],
  }
}

function conflictoDe(fila: FilaEspejo): 'gana_google' | null {
  return fila.gcalSyncStatus === 'pending' || fila.gcalSyncStatus === 'failed' ? 'gana_google' : null
}

/** Un evento ligado a una fila (por `google_event_id` o por la marca de Spinus). */
function decidirConFila(evento: EventoGoogle, id: string, fila: FilaEspejo, ctx: ContextoDecision): Decision {
  if (fila.gcalCalendarId && fila.gcalCalendarId !== ctx.calendarId) return { tipo: 'ignorar', motivo: 'otro_calendario' }
  if (fila.googleEventId && fila.googleEventId !== id) return { tipo: 'ignorar', motivo: 'marca_ajena' }
  const vincular = fila.googleEventId ? null : id
  if (!vincular && evento.etag && evento.etag === fila.gcalEtag) return { tipo: 'ignorar', motivo: 'eco_etag' }
  if (evento.status === 'cancelled') return decidirBorrado(evento, fila, ctx, vincular)
  if (!evento.etag) return { tipo: 'ignorar', motivo: 'sin_etag' }

  const c: Comparacion = { cambios: {}, campos: [], rechazados: [] }
  compararHora(evento, fila, ctx, c)
  compararTextos(evento, fila, c)
  const todos = [...c.campos, ...c.rechazados]
  if (!ACTIVAS.has(fila.status) && todos.length > 0) {
    return { tipo: 'rechazar', citaId: fila.id, motivo: 'estado_cerrado', campos: todos, restablecer: true }
  }
  if (c.campos.length > 0 && !googleMasReciente(evento.updated, fila.updatedAt, ctx.ahora)) {
    return { tipo: 'rechazar', citaId: fila.id, motivo: 'gana_spinus', campos: todos, restablecer: true }
  }
  return {
    tipo: 'aplicar', citaId: fila.id, esperadoUpdatedAt: fila.updatedAt, etag: evento.etag,
    actualizado: evento.updated ?? null, vincular, desvincular: false, cambios: c.cambios, campos: c.campos,
    conflicto: c.campos.length > 0 ? conflictoDe(fila) : null, restablecer: c.rechazados,
  }
}

/**
 * La decisión para UN evento. `fila` es la cita ligada a ese evento (por
 * `google_event_id`) o, si no hay, la de su marca `spinus_cita`; `null` si
 * ninguna.
 */
export function decidirEvento(evento: EventoGoogle, fila: FilaEspejo | null, ctx: ContextoDecision): Decision {
  const id = evento.id
  if (!id) return { tipo: 'ignorar', motivo: 'sin_id' }
  // C-a: las series y sus ocurrencias siguen en solo lectura.
  if ((evento.recurrence?.length ?? 0) > 0 || evento.recurringEventId) {
    return { tipo: 'ignorar', motivo: fila ? 'recurrente_ligado' : 'recurrente' }
  }
  // Fuera de oficina, foco, ubicación, cumpleaños…: no son citas.
  if (evento.eventType && evento.eventType !== 'default') return { tipo: 'ignorar', motivo: 'tipo_especial' }
  return fila ? decidirConFila(evento, id, fila, ctx) : decidirSinFila(evento, id, ctx)
}
