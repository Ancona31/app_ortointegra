'use client'

import Link from 'next/link'
import { MoreHorizontal, Plus } from 'lucide-react'
import type { ElementType, MouseEvent } from 'react'

/* ═══ EL RIEL DEL DUO CERRADO (`ext`) — B4 del rediseño ═════════════════════
 *
 * Una columna navy pegada al lado de la franja del sistema: las secciones como
 * iconos, «···» (Más) y, abajo, la acción «+» del rol. Es PRESENTACIONAL: no
 * lee sesión, ruta ni permisos. Todo llega por props desde `Sidebar.tsx`, que
 * es quien decide qué entradas hay, cuál está activa y qué hace cada una.
 *
 * ⚠️ SE PINTA SIEMPRE Y LO ESCONDE CSS (`.nav-riel` en `globals.css`), y no es
 * descuido: el formato no existe en el servidor, así que decidir el marcado por
 * él rompería la hidratación (PLAN §2.5). Sólo `[data-formato="ext"]` lo enseña.
 * Un `display: none` lo saca también del árbol de accesibilidad.
 *
 * ⚠️ NUNCA 84 NI 34 FIJOS: el ancho suma `var(--ir)` y el relleno `var(--it)` /
 * `var(--ib)`, que son los `env(safe-area-inset-*)` de `sistema.css`.
 */

/** Una sección de la navegación. La comparten el riel, el encabezado y la barra. */
export interface EntradaNav {
  clave: string
  etiqueta: string
  href: string
  Icono: ElementType
  activa: boolean
  /** Sin precarga (ver la nota de `sinPrefetch` en `Sidebar.tsx`). */
  sinPrefetch?: boolean
  /** Para lo que se intercepta antes de navegar (bloqueo por plan). */
  alPulsar?: (e: MouseEvent<HTMLAnchorElement>) => void
}

/** La acción «+» del riel: «Nueva consulta» del médico, «Agendar cita» de la secretaria. */
export interface AccionRiel {
  etiqueta: string
  alPulsar: () => void
}

interface Props {
  entradas: EntradaNav[]
  masActivo: boolean
  masAbierto: boolean
  /** Datos de perfil pendientes; > 0 pinta el distintivo ámbar sobre «···». */
  pendientes: number
  alAbrirMas: () => void
  accion: AccionRiel | null
}

/** «Más», o «Más, 3 datos pendientes» cuando hay distintivo: el número no puede vivir sólo en el dibujo. */
export function nombreBotonMas(pendientes: number): string {
  if (pendientes <= 0) return 'Más'
  return `Más, ${pendientes} dato${pendientes > 1 ? 's' : ''} pendiente${pendientes > 1 ? 's' : ''}`
}

export default function RielNavegacion({ entradas, masActivo, masAbierto, pendientes, alAbrirMas, accion }: Props) {
  return (
    <nav className="nav-riel" aria-label="Navegación principal">
      <ul className="nav-riel-lista">
        {entradas.map(e => (
          <li key={e.clave}>
            <Link href={e.href} prefetch={e.sinPrefetch ? false : undefined} onClick={e.alPulsar}
              aria-label={e.etiqueta} aria-current={e.activa ? 'page' : undefined}
              data-activa={e.activa ? 'true' : undefined} className="nav-riel-boton k-pulsable">
              <e.Icono size={22} strokeWidth={1.8} aria-hidden="true" />
            </Link>
          </li>
        ))}
        <li>
          <button type="button" onClick={alAbrirMas} aria-label={nombreBotonMas(pendientes)}
            aria-haspopup="dialog" aria-expanded={masAbierto}
            data-activa={masActivo ? 'true' : undefined} className="nav-riel-boton k-pulsable">
            <MoreHorizontal size={22} strokeWidth={1.8} aria-hidden="true" />
            {pendientes > 0 && <span className="nav-distintivo" aria-hidden="true">{pendientes}</span>}
          </button>
        </li>
      </ul>
      {accion && (
        <button type="button" onClick={accion.alPulsar} aria-label={accion.etiqueta} className="nav-riel-accion k-pulsable">
          <Plus size={24} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
    </nav>
  )
}
