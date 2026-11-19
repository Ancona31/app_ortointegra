'use client'

/**
 * El interruptor de las maquetas de la configuración (tanda J, J5): 52 × 30,
 * bola de 24, azul encendido y gris apagado. El gris es `--ag-control-border`
 * y no `--ag-muted2`: la pista apagada es el límite del control y tiene que
 * quedar a ≥ 3:1 del fondo (WCAG 1.4.11; `--ag-muted2` da 2,46:1 en claro).
 * Encendido, el azul de relleno no llega en oscuro (2,4:1 sobre el hundido):
 * lo separa el borde `--ag-control-primario-border`, el de los interruptores
 * viejos. Borde de 1 + relleno de 2 = los 3 px de la maqueta alrededor de la bola. `role="switch"` con
 * `aria-checked`; el nombre lo da `etiquetadoPor` (el id del texto que lo
 * explica) o `etiqueta`.
 *
 * Tanda L (punto 12): el dibujo mide 30 de alto, pero el área de toque llega a 46 con un `::before`
 * invisible 8 px por encima y por debajo (el clic en él es clic en el botón). Sin cambio a la vista.
 * (El `inset` cuenta desde dentro del borde de 1 px: `-inset-y-[9px]` sale 8 fuera.)
 * Tanda M (punto 2): en computadora (`sm`), `-inset-y-[6px]`, 5 fuera: 40 de alto, el de los botones.
 */
interface Props {
  encendido: boolean
  alCambiar: () => void
  etiquetadoPor?: string
  etiqueta?: string
  deshabilitado?: boolean
}

export default function Interruptor({ encendido, alCambiar, etiquetadoPor, etiqueta, deshabilitado }: Props) {
  return (
    <button type="button" role="switch" aria-checked={encendido} aria-labelledby={etiquetadoPor} aria-label={etiquetadoPor ? undefined : etiqueta}
      onClick={alCambiar} disabled={deshabilitado}
      className={`relative flex h-[30px] w-[52px] flex-none cursor-pointer rounded-full border p-[2px] before:absolute before:inset-x-0 before:-inset-y-[9px] before:content-[''] sm:before:-inset-y-[6px] transition-colors duration-[var(--ag-dur-micro)] disabled:cursor-not-allowed disabled:opacity-50 ${encendido
        ? 'justify-end border-[var(--ag-control-primario-border)] bg-[var(--ag-brand-secondary)]' : 'justify-start border-[var(--ag-control-border)] bg-[var(--ag-control-border)]'}`}>
      <span aria-hidden="true" className="h-[24px] w-[24px] rounded-full bg-white shadow-[0_1px_2px_rgba(15,23,42,0.25)]" />
    </button>
  )
}
