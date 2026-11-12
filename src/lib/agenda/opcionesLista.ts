/**
 * src/lib/agenda/opcionesLista.ts
 *
 * Qué opción queda activa con cada tecla, para los tres controles con foco
 * itinerante o `aria-activedescendant` de las capas del bloque F: la lista de
 * pacientes de `BurbujaAlta`, la del `BuscadorCitas` (los dos son `listbox`
 * con `aria-activedescendant`) y la barra de acciones de `TarjetaLectura`
 * (`role="toolbar"` con flechas). Tres usos reales; la lógica es la misma y
 * diverge en cuanto se copia.
 *
 * Pura: índice y tecla dentro, índice fuera. `-1` = ninguna activa.
 */

export type EjeLista = 'vertical' | 'horizontal'

/**
 * El índice activo tras una tecla, o `null` si la tecla no mueve nada (y el
 * componente no debe hacer `preventDefault`). Las flechas dan la vuelta, como
 * en los ejemplos de APG; Inicio y Fin van a los extremos.
 */
export function indiceTrasTecla(actual: number, total: number, key: string, eje: EjeLista): number | null {
  if (total <= 0) return null
  const siguiente = eje === 'vertical' ? 'ArrowDown' : 'ArrowRight'
  const anterior = eje === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
  if (key === siguiente) return actual < 0 ? 0 : (actual + 1) % total
  if (key === anterior) return actual < 0 ? total - 1 : (actual - 1 + total) % total
  if (key === 'Home') return 0
  if (key === 'End') return total - 1
  return null
}

/** El `id` de una opción, para `aria-activedescendant` y para el propio nodo. */
export function idDeOpcion(prefijo: string, indice: number): string {
  return `${prefijo}-opcion-${indice}`
}
