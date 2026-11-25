/**
 * src/lib/agenda/ocioso.ts
 *
 * Tiempo ocioso con respaldo para navegadores sin `requestIdleCallback`
 * (Safari, a la fecha). Lo usan la precarga de semanas vecinas y la
 * precarga de los modales de la agenda (A2.6). Movido tal cual desde
 * `AgendaCliente.tsx` (A2.5.1, movimiento puro), con sus comentarios; sólo
 * cambiaron los `import`/`export` que hacían falta.
 */

/** Tiempo ocioso con respaldo: no todos los navegadores tienen `requestIdleCallback` (Safari, a la fecha). */
export function enOcioso(fn: () => void): number {
  if (typeof window.requestIdleCallback === 'function') return window.requestIdleCallback(fn)
  return window.setTimeout(fn, 1)
}
export function cancelarOcioso(handle: number): void {
  if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(handle)
  else window.clearTimeout(handle)
}
