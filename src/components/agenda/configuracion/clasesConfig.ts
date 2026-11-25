/**
 * Las clases compartidas de la configuración de la agenda (tanda T2, punto
 * 12): un alto y un relleno por papel, en la retícula `--ag-*` del bloque F,
 * para que los botones y campos de las ocho secciones midan lo mismo. Antes
 * cada archivo tenía su `BOTON` con alturas distintas (32, 36 y 38 px).
 *
 * Nombre distinto de cualquier componente de la carpeta (regla de mayúsculas
 * de `CLAUDE.md`).
 */
/*
 * Tanda H, punto 7 de Angel: «Los botones tienen que verse como botones en
 * reposo, también en modo claro: borde y fondo visibles, no sólo al pasar el
 * ratón». Los tres llevan borde y fondo propios SIEMPRE, con los tokens
 * `--ag-control-*` (borde ≥ 3:1 contra la tarjeta en claro y en oscuro). El
 * hover sólo oscurece un poco el fondo. Un enlace dentro de una frase («Mi
 * perfil») sigue siendo un enlace subrayado, no un botón.
 */
export const BOTON_PRIMARIO =
  'inline-flex h-9 items-center justify-center gap-[var(--ag-1-5)] rounded-[var(--ag-r-btn)] border border-[var(--ag-control-primario-border)] px-[var(--ag-3-5)] text-sm font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a4f8c] disabled:opacity-50'

export const BOTON_SECUNDARIO =
  'inline-flex h-9 items-center justify-center gap-[var(--ag-1-5)] rounded-[var(--ag-r-btn)] border border-[var(--ag-control-border)] bg-[var(--ag-control-bg)] px-[var(--ag-3)] text-sm font-medium text-[var(--ag-text)] hover:bg-[var(--ag-control-bg-hover)] disabled:opacity-50'

/** Acción de una fila de lista («Editar», «Revocar»): más baja, pero también con borde y fondo. */
export const BOTON_FILA =
  'inline-flex h-8 items-center justify-center rounded-[var(--ag-r-btn-sm)] border border-[var(--ag-control-border)] bg-[var(--ag-control-bg)] px-[var(--ag-2-5)] text-sm text-[var(--ag-text)] hover:bg-[var(--ag-control-bg-hover)] disabled:opacity-50'

/** La acción que no tiene vuelta atrás (restablecer la configuración). */
export const BOTON_PELIGRO =
  'inline-flex h-9 items-center justify-center gap-[var(--ag-1-5)] rounded-[var(--ag-r-btn)] border border-[var(--ag-status-cancelled-text)] bg-[var(--ag-control-bg)] px-[var(--ag-3)] text-sm font-semibold text-[var(--ag-status-cancelled-text)] hover:bg-[var(--ag-control-bg-hover)] disabled:opacity-50'

export const CAMPO =
  'h-9 rounded-[var(--ag-r-btn-sm)] border border-[var(--ag-border-card)] bg-[var(--ag-surface)] px-[var(--ag-2-5)] text-sm text-[var(--ag-text)] disabled:opacity-60'

/** Un estado vacío o de carga dentro de una sección. */
export const TEXTO_SUAVE = 'text-sm text-[var(--ag-muted)]'

/** La caja de aviso: lo que no va a funcionar así y qué falta. */
export const CAJA_AVISO =
  'rounded-[var(--ag-r-btn)] border border-[var(--ag-aviso-border)] bg-[var(--ag-aviso-bg)] px-[var(--ag-3)] py-[var(--ag-2-5)] text-sm text-[var(--ag-aviso-text)]'
