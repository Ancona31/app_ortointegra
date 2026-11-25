/**
 * src/lib/agenda/empalmesCita.ts
 *
 * B7 · Alerta de empalme (plan del bloque B), la parte PURA: qué cuenta como
 * empalme y cómo se dice. La usan el arrastre y el redimensionado
 * (`guardadoCitas.ts`, sobre lo pintado) y el modal de alta y edición
 * (`AppointmentModal.tsx`). La autoridad es el servidor
 * (`empalmesServidor.ts`): lo pintado no ve otras semanas, otros médicos fuera
 * del filtro ni lo que otra persona acaba de crear.
 *
 * ⚠️ LAS REGLAS SON LAS DE P3 (`mejora_agendaV2.md` §6-bis) Y VAN IGUAL EN LOS
 * DOS SITIOS. Si cambias una aquí, cámbiala en `empalmesServidor.ts`:
 *   · del MISMO MÉDICO, no del mismo consultorio;
 *   · cuentan citas y eventos sin paciente; NO las `cancelled` ni las
 *     `no_show` (corrección de Angel del 2026-11-12: igual que no ocupan
 *     hueco, `docs/spec/SPEC_AGENDA.md` §8.4). Vale en los dos sentidos: una
 *     cita en esos estados tampoco avisa al moverla;
 *   · no cuentan los eventos de Google ni los de todo el día;
 *   · solape SEMIABIERTO: 10:00–10:30 y 10:30–11:00 no se empalman.
 * No bloquea nada: sólo decide si hay que preguntar.
 *
 * Sin tipos de FullCalendar: quien llama convierte sus eventos a `TramoCita`.
 */
import { horaDeReloj } from '@/lib/agenda/horarioAgenda'

/** Lo mínimo de una cita para decidir si se empalma con otra. */
export interface TramoCita {
  id: string
  medicoId: string | null
  inicio: Date
  fin: Date
  todoElDia: boolean
  /** `cancelled` o `no_show`: no ocupa el hueco y no cuenta (P3). */
  noOcupa: boolean
  /** Evento leído del calendario de Google (no es una fila de Spinus). */
  deGoogle: boolean
  titulo: string
}

/** Los estados que no cuentan para el empalme (P3). Los usa también el servidor. */
export const ESTADOS_SIN_EMPALME: readonly string[] = ['cancelled', 'no_show']

/** Lo que se le dice al usuario de cada cita con la que se empalma. Es la
 *  misma forma que devuelve el 409 `empalme` del servidor. */
export interface Empalme {
  id: string
  titulo: string
  inicio: string
  fin: string
}

/** Las citas de `otras` con las que `cita` se empalma, según P3. */
export function empalmesDe(cita: TramoCita, otras: readonly TramoCita[]): Empalme[] {
  if (cita.todoElDia || cita.noOcupa || !cita.medicoId) return []
  const desde = cita.inicio.getTime()
  const hasta = cita.fin.getTime()
  if (!(hasta > desde)) return []
  return otras
    .filter(o => o.id !== cita.id
      && o.medicoId === cita.medicoId
      && !o.todoElDia && !o.noOcupa && !o.deGoogle
      && o.inicio.getTime() < hasta && o.fin.getTime() > desde)
    .map(o => ({ id: o.id, titulo: o.titulo, inicio: o.inicio.toISOString(), fin: o.fin.toISOString() }))
}

/** Cuántas se nombran en el aviso; las demás se cuentan. */
const NOMBRADAS = 3

/**
 * El texto del aviso: nombra la cita (o las citas) con la que se empalma y su
 * hora, en el reloj del dispositivo —el mismo con el que se pinta la rejilla y
 * con el que habla el aviso de fuera de horario—. Termina en pregunta porque
 * va en el `ConfirmModal`: «Aceptar» guarda igual.
 */
export function mensajeEmpalme(lista: readonly Empalme[]): string {
  const nombradas = lista.slice(0, NOMBRADAS)
    .map(e => `«${e.titulo || 'Sin título'}» (${horaDeReloj(new Date(e.inicio))}–${horaDeReloj(new Date(e.fin))})`)
  const resto = lista.length - nombradas.length
  const cola = resto > 0 ? ` y ${resto} más` : ''
  const sujeto = lista.length === 1 ? 'Se empalma con' : 'Se empalma con estas citas del mismo médico:'
  return `${sujeto} ${nombradas.join(', ')}${cola}. ¿Guardar de todos modos?`
}

/** Junta dos listas de ids aceptados sin repetir (para reenviar tras un 409). */
export function unirAceptados(a: readonly string[], b: readonly Empalme[]): string[] {
  return [...new Set([...a, ...b.map(e => e.id)])]
}

function esEmpalme(e: unknown): e is Empalme {
  if (typeof e !== 'object' || e === null) return false
  if (!('id' in e) || !('titulo' in e) || !('inicio' in e) || !('fin' in e)) return false
  return typeof e.id === 'string' && typeof e.titulo === 'string'
    && typeof e.inicio === 'string' && typeof e.fin === 'string'
}

/** ¿Es la lista `empalmes` de un 409 del servidor? Comprueba la forma en vez
 *  de creerle a `res.json()`. */
export function esListaDeEmpalmes(valor: unknown): valor is Empalme[] {
  return Array.isArray(valor) && valor.every(esEmpalme)
}

/** Lo que hace falta de un evento pintado en la rejilla. `EventApi` de
 *  FullCalendar lo cumple tal cual; así este módulo no depende de él. */
export interface EventoPintado {
  id: string
  start: Date | null
  end: Date | null
  allDay: boolean
  title: string
  extendedProps: Record<string, unknown>
}

/** Un evento pintado como `TramoCita`, o `null` si no tiene puntas. */
export function tramoDePintado(ev: EventoPintado): TramoCita | null {
  if (!ev.start || !ev.end) return null
  const x = ev.extendedProps
  return {
    id: ev.id,
    medicoId: typeof x.medico_id === 'string' ? x.medico_id : null,
    inicio: ev.start,
    fin: ev.end,
    todoElDia: ev.allDay,
    noOcupa: typeof x.status === 'string' && ESTADOS_SIN_EMPALME.includes(x.status),
    deGoogle: x.isGcalBlock === true,
    titulo: ev.title,
  }
}

/** Los empalmes de `cita` contra lo pintado en la rejilla. */
export function empalmesPintados(cita: TramoCita, pintados: readonly EventoPintado[]): Empalme[] {
  const otras: TramoCita[] = []
  for (const ev of pintados) {
    const t = tramoDePintado(ev)
    if (t) otras.push(t)
  }
  return empalmesDe(cita, otras)
}
