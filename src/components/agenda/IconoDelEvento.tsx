/**
 * src/components/agenda/IconoDelEvento.tsx
 *
 * Movido tal cual desde `AgendaCliente.tsx` (A2.2, movimiento puro), con sus
 * comentarios; sólo cambiaron los `import`/`export` que hacían falta.
 */

import type { IconoEvento } from '@/lib/appointments'

/**
 * El icono de un evento genérico, pintado con `mask-image` sobre un color.
 *
 * POR QUÉ MÁSCARA Y NO `<img>`: los SVG traen `fill="currentColor"`, y dentro
 * de un `<img>` no hay `currentColor` que heredar — saldrían todos negros y no
 * se podrían teñir del color del evento. La máscara usa el canal alfa del
 * archivo y el color lo pone el `background` de este `<span>`, así que un mismo
 * archivo sirve para los seis colores y para los dos temas.
 *
 * Sin `color` explícito hereda `currentColor`, que es como se comportaba el
 * icono de lucide al que sustituye.
 */
export function IconoDelEvento({ nombre, size, color }: { nombre: IconoEvento; size: number | string; color?: string }) {
  const archivo = `url(/icons/${nombre}.svg)`
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block', width: size, height: size, flex: '0 0 auto',
        background: color ?? 'currentColor',
        WebkitMaskImage: archivo, maskImage: archivo,
        WebkitMaskSize: 'contain', maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center', maskPosition: 'center',
      }}
    />
  )
}
