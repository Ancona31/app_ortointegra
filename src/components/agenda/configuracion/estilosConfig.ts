/**
 * Las clases de la configuración nueva de la agenda (tanda J, J5): el funnel
 * de primera vez y las cinco pestañas, con los TAMAÑOS de las maquetas
 * (`docs/spec/Main.dc.html`, `Configuracion.dc.html`) y los COLORES de la app.
 * Ningún hexadecimal de la maqueta: todo sale de `--ag-*`.
 *
 * ⚠️ TRAMPA DE NOMBRES (`CLAUDE.md`): el azul de los botones y de lo elegido es
 * `--ag-brand-secondary` (= `--cs`, #1e5fa8), NO `--ag-brand-primary` (= `--cp`,
 * el navy). Para TEXTO azul, `--ag-brand-legible`, que en oscuro se aclara.
 *
 * Nombre distinto de `clasesConfig.ts` (la de la pantalla vieja, que no se toca).
 */

/** Tarjeta blanca: la de cada pregunta del funnel (14 px, 24 de relleno). */
export const TARJETA = 'flex flex-col rounded-[14px] border border-[var(--ag-border-card)] bg-[var(--ag-surface)] p-[24px]'

/** El panel de cada pestaña (16 px, 28 de relleno; 20 en el teléfono para que quepa). */
export const PANEL = 'flex flex-col gap-[18px] rounded-[16px] border border-[var(--ag-border-card)] bg-[var(--ag-surface)] p-[20px] sm:p-[28px]'

/** Separador entre bloques de un panel. */
export const BLOQUE = 'flex flex-col gap-[12px] border-t border-[var(--ag-hairline)] pt-[18px]'

export const TITULO_PASO = 'm-0 text-[30px] font-bold leading-[1.2] text-[var(--ag-ink)]'
export const SUB_PASO = 'm-0 text-[17px] leading-[1.5] text-[var(--ag-ink-600)]'
export const TITULO_PANEL = 'm-0 text-[22px] font-bold text-[var(--ag-ink)]'
export const SUB_PANEL = 'm-0 text-[16px] leading-[1.5] text-[var(--ag-ink-600)]'
export const TITULO_BLOQUE = 'text-[17px] font-bold text-[var(--ag-ink)]'
export const AYUDA = 'text-[15px] leading-[1.5] text-[var(--ag-ink-600)]'
export const ETIQUETA = 'flex flex-wrap items-center gap-[10px] text-[16px] text-[var(--ag-text)]'
export const ERROR = 'm-0 text-[15px] font-semibold text-[var(--ag-status-cancelled-text)]'

/** Botón azul lleno (48 px de alto). El borde `--ag-brand-legible` no se ve en claro (es el mismo azul) y
    en oscuro es lo que lo separa de la superficie: el relleno crudo queda a 2,24:1 de `--ag-surface`. */
export const BOTON_AZUL =
  'inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-[8px] rounded-[10px] border border-[var(--ag-brand-legible)] bg-[var(--ag-brand-secondary)] px-[22px] text-[16px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60'

/* Los botones con borde usan `--ag-control-border` y no el gris claro de la maqueta: es el token de la
   app para un botón en REPOSO (tanda H, punto 7: borde ≥ 3:1). Sección F: colores con los tokens de la app. */

/** Botón blanco con borde (48 px). */
export const BOTON_BLANCO =
  'inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-[8px] rounded-[10px] border border-[var(--ag-control-border)] bg-[var(--ag-surface)] px-[22px] text-[16px] font-semibold text-[var(--ag-ink)] hover:bg-[var(--ag-control-bg-hover)] disabled:cursor-not-allowed disabled:opacity-60'

/** Botón blanco pequeño (44 px, 15 px de letra): «Cambiar», «Crear uno», «Cambiar horario». */
export const BOTON_CHICO =
  'inline-flex min-h-[44px] flex-none cursor-pointer items-center justify-center rounded-[10px] border border-[var(--ag-control-border)] bg-[var(--ag-surface)] px-[18px] text-[15px] font-semibold text-[var(--ag-ink)] hover:bg-[var(--ag-control-bg-hover)] disabled:cursor-not-allowed disabled:opacity-60'

/** Botón de texto azul («Cambiar» del resumen, «Copiar», «Agregar tipo de cita»). */
export const BOTON_TEXTO =
  'inline-flex min-h-[44px] cursor-pointer items-center gap-[6px] border-0 bg-transparent px-[8px] text-[15px] font-semibold text-[var(--ag-brand-legible)] disabled:cursor-not-allowed disabled:opacity-60'

/** Botón de texto rojo («Apagar», «Quitar»). */
export const BOTON_TEXTO_ROJO =
  'inline-flex min-h-[44px] cursor-pointer items-center border-0 bg-transparent px-[8px] text-[15px] font-semibold text-[var(--ag-status-cancelled-text)] disabled:cursor-not-allowed disabled:opacity-60'

/** Campo de texto, número, hora o selector (44 px, 16 px de letra: el teléfono no hace zoom). */
export const CAMPO_NUEVO =
  'min-h-[44px] rounded-[8px] border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] px-[10px] py-[8px] text-[16px] text-[var(--ag-ink)] focus:border-[var(--ag-input-focus-border)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] disabled:opacity-60'

/** La dirección del enlace, en letra de máquina. */
export const DIRECCION =
  'break-all rounded-[10px] border border-[var(--ag-border-card)] bg-[var(--ag-surface-sunken)] px-[16px] py-[14px] font-mono text-[17px] text-[var(--ag-ink)]'

/** Fila gris de una lista dentro de un panel (enlaces de una vez, tipos de cita). */
export const FILA_GRIS =
  'flex flex-wrap items-center justify-between gap-[12px] rounded-[10px] bg-[var(--ag-surface-sunken)] px-[16px] py-[12px]'

/** Una opción elegible (rejilla de duraciones): elegida, azul claro con borde azul. */
export function opcion(elegida: boolean): string {
  return `min-h-[56px] cursor-pointer rounded-[12px] border-2 text-[17px] font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${elegida
    ? 'border-[var(--ag-brand-secondary)] bg-[var(--ag-primary-bg-faint)] text-[var(--ag-brand-legible)]'
    : 'border-[var(--ag-control-border)] bg-[var(--ag-surface)] text-[var(--ag-ink)]'}`
}
