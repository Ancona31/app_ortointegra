/**
 * src/lib/agenda/semanasVecinas.ts
 *
 * Las dos semanas VECINAS de un rango ya encajado a semana natural por
 * `rangoQuePedir` (lunes a lunes, `firstDay: 1`, 7 días exactos). Las usa la
 * precarga de `AgendaCliente.tsx` (A1.5b): tras pintar una vista de 7 días
 * (`timeGridWeek`/`listWeek`), trae en ocioso la semana anterior y la
 * siguiente de la que se está mirando, con la MISMA clave que pediría
 * FullCalendar si el usuario navegara hasta ahí.
 *
 * ⚠️ NO vuelve a encajar el rango de entrada: si no es ya una semana natural
 * exacta, el resultado tampoco lo será. Se llama siempre sobre la salida de
 * `rangoQuePedir`, o sobre `vista.currentStart`/`currentEnd` de
 * `timeGridWeek`/`listWeek`, que YA son esa semana natural (no recortada por
 * `hiddenDays`, a diferencia de `activeStart`/`activeEnd` — ver la cabecera
 * de `rangoQuePedir`).
 *
 * Aritmética de CALENDARIO (`setDate()` vía el constructor de tres campos),
 * no de milisegundos — mismo motivo que `rangoQuePedir`: en el cambio de
 * horario de verano una semana no dura siempre 7×24 horas exactas, y restar
 * `7 * 86_400_000` ms puede caer un paso antes o después del lunes que toca.
 */

/** La semana justo ANTERIOR a `rango`: termina donde `rango` empieza. */
export function semanaAnterior(rango: { startStr: string; endStr: string }): { startStr: string; endStr: string } {
  const d = new Date(rango.startStr)
  const anterior = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7)
  return { startStr: anterior.toISOString(), endStr: rango.startStr }
}

/** La semana justo SIGUIENTE a `rango`: empieza donde `rango` termina. */
export function semanaSiguiente(rango: { startStr: string; endStr: string }): { startStr: string; endStr: string } {
  const d = new Date(rango.endStr)
  const siguiente = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7)
  return { startStr: rango.endStr, endStr: siguiente.toISOString() }
}
