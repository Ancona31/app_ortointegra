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
 * Tanda M (punto 2): en computadora, `-inset-y-[6px]`, 5 fuera: 40 de alto, el de los botones.
 *
 * B13 · AG9 (rediseño, maquetas `ag-config`/`ag-pv`): colores del kit. Encendido, `--accion`; apagado, la pista
 * del kit (`--tinta3` al 38 % sobre `--sup2`) con un borde `--tinta3` que la deja a ≥ 3:1 del fondo (WCAG
 * 1.4.11, como antes). La escala de computadora va por FORMATO (`ih`/`esc`), no desde 640 px: en el Duo
 * abierto en vertical (`iv`) el área vuelve a ser de 46.
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
      className={`relative flex h-[30px] w-[52px] flex-none cursor-pointer rounded-full border p-[2px] before:absolute before:inset-x-0 before:-inset-y-[9px] before:content-[''] ih:before:-inset-y-[6px] esc:before:-inset-y-[6px] transition-colors duration-[var(--dur-toque)] disabled:cursor-not-allowed disabled:opacity-45 ${encendido
        ? 'justify-end border-accion bg-accion' : 'justify-start border-tinta3 bg-[color-mix(in_srgb,var(--tinta3)_38%,var(--sup2))]'}`}>
      <span aria-hidden="true" className="h-[24px] w-[24px] rounded-full bg-white shadow-[0_1px_3px_rgba(10,18,32,0.28)]" />
    </button>
  )
}
