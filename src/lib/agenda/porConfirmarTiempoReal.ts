/**
 * src/lib/agenda/porConfirmarTiempoReal.ts
 *
 * H4 (punto 18 de Angel) · Qué le hace a la lista «Por confirmar» un cambio de
 * `appointments` llegado por el canal ÚNICO de tiempo real de la agenda
 * (`useTiempoRealAgenda`). Puro: sin React, sin Supabase.
 *
 * LA MISMA REGLA QUE LA RUTA (`GET /api/agenda/por-confirmar`): agendada, con
 * paciente o por ligar, con hora, futura (`motivoCitaSinWhatsApp`) y de MAÑANA
 * en la zona de su consultorio (`esDeManana`). Con ella:
 *   · una fila listada que deja de cumplirla (confirmada a mano o por el
 *     paciente, cancelada, movida a otro día, borrada) SALE en el acto, sin
 *     pedir nada; si se canceló, además se recarga (puede ser el paciente, y
 *     entonces entra en «Canceladas por el paciente»);
 *   · una cita que la cumple y no está listada (nueva, reagendada para mañana,
 *     reabierta) o una listada que cambió de hora → se recarga la lista: el
 *     cambio no trae el nombre ni los medios (los joins no viajan por Realtime).
 *   · cualquier otra cosa no hace nada: en reposo, ninguna petición.
 *
 * ⚠️ El payload de Realtime puede llegar PARCIAL (columnas TOAST sin tocar no
 * viajan, ver `useTiempoRealAgenda`); las que mira esta regla (estado, horas,
 * paciente, canal, zona) no son TOAST.
 */
import { esDeManana, motivoCitaSinWhatsApp, type CitaParaWhatsApp } from './whatsappCita'

/** Lo que la regla mira de una fila de `appointments` llegada por el canal. */
export interface FilaCambioCita extends CitaParaWhatsApp {
  id: string
  consultorio_timezone?: string | null
  /** I5 · `'google'` en lo importado de Google (el payload trae la fila entera). */
  origen?: string | null
  /** Integración I · la marca de I3 (`'por_asignar'` la pone sólo el sondeo de Google). */
  google_asignacion?: string | null
}

/**
 * Un cambio del canal, ya reducido: un borrado sólo trae el id. `pintado`
 * (tanda L) es el estado que la agenda tenía pintado de esa cita ANTES del
 * cambio, si la tenía pintada (el payload no trae el estado anterior).
 */
export type CambioCita =
  | { tipo: 'DELETE'; id: string }
  | { tipo: 'INSERT' | 'UPDATE'; fila: FilaCambioCita; pintado?: string }

export type EfectoPorConfirmar = 'nada' | 'quitar' | 'recargar' | 'quitar_y_recargar'

/** ¿Saldría en la lista de mañana? La regla de la ruta, sobre la fila del canal. */
export function entraEnPorConfirmar(f: FilaCambioCita, ahora: number): boolean {
  return f.status === 'scheduled' && motivoCitaSinWhatsApp(f, ahora) === null
    && esDeManana(f.start_time, f.consultorio_timezone, ahora)
}

/**
 * `listadas`: id → inicio (ISO) de las filas que la lista enseña ahora.
 * `ahora` en ms.
 */
export function efectoEnPorConfirmar(listadas: ReadonlyMap<string, string>, c: CambioCita, ahora: number): EfectoPorConfirmar {
  if (c.tipo === 'DELETE') return listadas.has(c.id) ? 'quitar' : 'nada'
  const inicioListado = listadas.get(c.fila.id)
  const entra = entraEnPorConfirmar(c.fila, ahora)
  if (inicioListado === undefined) return entra ? 'recargar' : 'nada'
  if (!entra) return c.fila.status === 'cancelled' ? 'quitar_y_recargar' : 'quitar'
  return Date.parse(inicioListado) === Date.parse(c.fila.start_time) ? 'nada' : 'recargar'
}

/**
 * I5 (punto 19) · ¿Pudo este cambio dejar un aviso de la clínica? Los avisos
 * los escribe la BASE en la misma transacción que la cita (disparadores de
 * `20261121150000`), así que cuando el cambio llega por el canal el aviso ya
 * está: basta con recargar una vez (coalescida) la lista de la campana.
 *   · INSERT de una reserva por enlace (también la cita nueva de un reagendado)
 *     o de un evento de Google «por asignar» (integración I: la marca de I3,
 *     la misma que decide el aviso en la base, no una copia del criterio);
 *   · UPDATE a cancelada de una cita con paciente o por ligar (puede ser el
 *     paciente por su enlace; si fue el personal, la recarga no trae nada).
 *   · Tanda L (punto 13) · UPDATE a confirmada de una cita con paciente o por
 *     ligar que ANTES no lo estaba (puede ser el paciente por su enlace; si fue
 *     el personal, la recarga no trae nada). «Antes» se sabe si la cita estaba
 *     en la lista de mañana (`listada`, sólo salen agendadas) o pintada con
 *     otro estado (`pintado`). Sin eso no se recarga: una cita ya confirmada
 *     recibe UPDATE en cada sincronización con Google, y recargar por cada uno
 *     sería una petición por eco. «Confirmar» del personal pinta antes de
 *     mandar (optimista), así que su eco llega con `pintado` ya confirmado.
 *     Lo que cuesta: la confirmación de una cita que no está pintada ni es de
 *     mañana (otra semana) no recarga; su aviso llega con la siguiente traída
 *     (abrir la campana, el sondeo, volver a la pestaña). Y el personal que
 *     confirma desde OTRA sesión una cita pintada agendada cuesta una traída
 *     que no trae nada (no se distingue del paciente sin el aviso).
 * Un empalme con Google que mueve una cita de Spinus no se distingue aquí: lo
 * trae el sondeo de la agenda (`recargaPanel`) o la siguiente recarga.
 */
export function cambioPuedeAvisar(c: CambioCita, listada = false): boolean {
  if (c.tipo === 'DELETE') return false
  const f = c.fila
  if (c.tipo === 'INSERT') return !!f.reserva_canal || f.google_asignacion === 'por_asignar'
  const deLaClinica = f.paciente_id !== null || !!f.reserva_canal
  if (f.status === 'cancelled') return deLaClinica
  return f.status === 'confirmed' && deLaClinica && (listada || (c.pintado !== undefined && c.pintado !== 'confirmed'))
}
