import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { AccionTonal, ENTRADA_ESTADO } from '@/components/ui/EstadoVacio'

/**
 * Estado de error del catálogo de capas (rediseño B3; CALMA §25, maqueta
 * `capas-b/vista-3-error`). Sustituye a las copias de «mensaje + Reintentar»
 * que cada pantalla dibuja a su manera; las pantallas la adoptan en su bloque.
 *
 * Dos niveles:
 *  - `pagina` (por omisión): sustituye al contenido de la página; la navegación
 *    queda viva. Centrado y SIN tarjeta: icono 24 en círculo `--mal-*` de 48,
 *    título 17/700, una línea 14 `--tinta2`, «Reintentar» TONAL y, debajo, lo
 *    que venga en `children` (p. ej. el «Volver al inicio» de `ErrorBoundary`).
 *  - `tarjeta`: dentro de una tarjeta (lista que no cargó). Mismo dibujo que la
 *    sección vacía, con el icono en `--mal-tinta`: una línea y «Reintentar».
 *
 * `role="alert"` en los dos. NO mueve el foco: «Reintentar» se alcanza con Tab.
 * ⚠️ NO ES PARA EL ERROR AL GUARDAR: ése es una línea junto a la barra del pie
 * del formulario, y su botón principal es el reintento (CALMA, vista 3).
 *
 * El texto del botón es «Reintentar» salvo que la pantalla traiga otro hoy.
 */
interface EstadoErrorProps {
  /** La línea que explica qué falló (en `tarjeta`, la única). */
  mensaje: string
  /** Título de la variante `pagina`. */
  titulo?: string
  alReintentar?: () => void
  etiquetaReintentar?: string
  variante?: 'pagina' | 'tarjeta'
  /** Salidas adicionales bajo el botón (sólo `pagina`). */
  children?: ReactNode
  className?: string
}

export default function EstadoError({
  mensaje, titulo, alReintentar, etiquetaReintentar = 'Reintentar',
  variante = 'pagina', children, className = '',
}: EstadoErrorProps) {
  const accion = alReintentar ? { etiqueta: etiquetaReintentar, alPulsar: alReintentar } : null
  if (variante === 'tarjeta') {
    return (
      <div role="alert" className={`flex flex-col items-center px-2 py-5 text-center ${ENTRADA_ESTADO} ${className}`}>
        <AlertCircle size={20} aria-hidden="true" className="text-mal-tinta" />
        <p className="mt-2 max-w-[38ch] text-[14px] leading-5 text-tinta2">{mensaje}</p>
        {accion && <AccionTonal accion={accion} className="mt-2" />}
      </div>
    )
  }
  return (
    <div role="alert" className={`flex flex-col items-center px-2 py-6 text-center ${ENTRADA_ESTADO} ${className}`}>
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-mal-fondo text-mal-tinta">
        <AlertCircle size={24} aria-hidden="true" />
      </span>
      {titulo && <h2 className="text-[17px] leading-[22px] font-bold text-tinta">{titulo}</h2>}
      <p className="mt-1 max-w-[38ch] text-[14px] leading-5 text-tinta2">{mensaje}</p>
      {accion && <AccionTonal accion={accion} className="mt-3" />}
      {children}
    </div>
  )
}
