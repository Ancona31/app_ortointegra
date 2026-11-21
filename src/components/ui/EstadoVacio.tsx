import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

/**
 * Estado vacío del catálogo de capas (rediseño B3; CALMA §25, maqueta
 * `capas-b/vista-2-vacio`). Una sola pieza para «no hay nada todavía» y «la
 * búsqueda no encontró nada»; lo que cambia es el icono, el texto y si lleva
 * acción.
 *
 * Dos niveles:
 *  - `pagina` (por omisión): lista o página vacía. Tarjeta `--sup`, icono 24 en
 *    círculo tonal de 48, título 17/22 (h2), una línea 14/20 y, si hay acción,
 *    botón TONAL.
 *  - `seccion`: dentro de una tarjeta que ya existe. Sin caja propia ni borde
 *    punteado: icono 20 en `--tinta3`, una línea 14 y acción tonal pequeña.
 *
 * ⚠️ LA ACCIÓN ES TONAL A PROPÓSITO: el único botón relleno de la pantalla es el
 * de su cabecera («+ Nuevo paciente», «Nueva consulta»). No la pases a primaria.
 * ⚠️ NO MUEVE EL FOCO. Si la pantalla quiere que se anuncie al buscar, el
 * contenedor de resultados lleva `aria-live="polite"`: eso es de la pantalla.
 *
 * Los textos los pone quien la usa, tal cual existen hoy.
 */
export type AccionEstado =
  | { etiqueta: string; alPulsar: () => void }
  | { etiqueta: string; href: string }

interface EstadoVacioProps {
  icono: LucideIcon
  /** El título (en `seccion`, la única línea). */
  titulo: string
  /** Una línea bajo el título. Sólo en `pagina`. */
  descripcion?: string
  accion?: AccionEstado
  variante?: 'pagina' | 'seccion'
  className?: string
}

/* Entrada de un estado (vacío o error): funde 0→1 subiendo 8 px con el resorte
   de entrada; con movimiento reducido, sólo fundido. Es una transición con
   `@starting-style`, así que un cambio de estado a medio camino parte de lo que
   hay en pantalla. El saliente se retira sin animación (no suma alturas). */
export const ENTRADA_ESTADO = [
  'transition-[translate,opacity] duration-[var(--dur-entra)] ease-[var(--resorte-entra)]',
  '[--recorrido:8px] motion-reduce:[--recorrido:0px]',
  'starting:translate-y-[var(--recorrido)] starting:opacity-0',
].join(' ')

/** El botón (o enlace) tonal de un estado. Lo comparte `EstadoError`. */
export function AccionTonal({ accion, className = '' }: { accion: AccionEstado; className?: string }) {
  const clase = `k-b-tonal ${className}`
  if ('href' in accion) {
    return <Link href={accion.href} className={clase}>{accion.etiqueta}</Link>
  }
  return <button type="button" onClick={accion.alPulsar} className={clase}>{accion.etiqueta}</button>
}

export default function EstadoVacio({
  icono: Icono, titulo, descripcion, accion, variante = 'pagina', className = '',
}: EstadoVacioProps) {
  if (variante === 'seccion') {
    return (
      <div className={`flex flex-col items-center px-2 py-5 text-center ${ENTRADA_ESTADO} ${className}`}>
        <Icono size={20} aria-hidden="true" className="text-tinta3" />
        <p className="mt-2 max-w-[38ch] text-[14px] leading-5 text-tinta2">{titulo}</p>
        {accion && <AccionTonal accion={accion} className="mt-2" />}
      </div>
    )
  }
  return (
    <div className={[
      'flex flex-col items-center bg-sup px-5 py-7 text-center rounded-[var(--r-tarjeta)]',
      'ih:rounded-[18px] ih:px-6 ih:py-10 iv:rounded-[18px] iv:px-6 iv:py-10 esc:rounded-[18px] esc:px-6 esc:py-10',
      ENTRADA_ESTADO, className,
    ].join(' ')}>
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-tonal text-tonal-tinta">
        <Icono size={24} aria-hidden="true" />
      </span>
      <h2 className="text-[17px] leading-[22px] font-bold text-tinta">{titulo}</h2>
      {descripcion && <p className="mt-1 max-w-[38ch] text-[14px] leading-5 text-tinta2">{descripcion}</p>}
      {accion && <AccionTonal accion={accion} className="mt-3" />}
    </div>
  )
}
