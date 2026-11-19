/**
 * Las clases de la configuración nueva de la agenda (tanda J, J5): el funnel
 * de primera vez y las cinco pestañas, con los COLORES de la app. Ningún
 * hexadecimal de la maqueta: todo sale de `--ag-*`.
 *
 * ⚠️ TRAMPA DE NOMBRES (`CLAUDE.md`): el azul de los botones y de lo elegido es
 * `--ag-brand-secondary` (= `--cs`, #1e5fa8), NO `--ag-brand-primary` (= `--cp`,
 * el navy). Para TEXTO azul, `--ag-brand-legible`, que en oscuro se aclara.
 *
 * ⚠️ LA LETRA VA EN LA ESCALA DE LA PÁGINA DE RESERVA (tanda L, punto 12 de Angel,
 * que corrige el «copia los tamaños de las maquetas» de J5): los tamaños y pesos
 * son los de `src/components/agendaPublica/agendaPublica.css`, papel por papel:
 *   · título de la página (h1)        18 px, 20 desde 640 px · 700  (`.rp-titulo`)
 *   · título de un panel o tarjeta    16 px · 700                    (`.rp-medico__nombre`)
 *   · título de bloque, nombre        15 px · 600                    (`.rp-op__txt b`)
 *   · texto                           14 px · 400                    (`.rp-sub`, `.rp-nota`)
 *   · ayuda, línea secundaria         13,5 px                        (`.rp-op__txt span`)
 *   · insignia                        13 px · 600                    (`.rp-op__dur`)
 *   · etiqueta de un campo            13,5 px · 600                  (`.rp-campo`)
 *   · etapas del avance               11 px · 600                    (`.rp-pasos li`)
 *   · campo                           16 px (el teléfono no hace zoom)
 *   · botón principal y secundario    16 px · 700                    (`.rp-btn`)
 *   · botón chico, pestaña, opción    15 px · 600                    (`.rp-hora`)
 *   · botón de texto, enlace          14 px · 600                    (`.rp-enlace`)
 * No hay tokens de tamaño de letra en la app: van en píxeles, como en la reserva.
 *
 * ⚠️ EN COMPUTADORA (desde `sm`, 640 px) LA ESCALA ES OTRA (tanda M, punto 2 de Angel: «títulos de
 * sección 16 px, texto 13–14 px, botones 13 px de letra y 40 px de alto, y los rellenos reducidos en
 * proporción»). Va como variante `sm:` junto a la de teléfono, que no cambia:
 *   · título de la página (h1)        18 px · 700 (el de teléfono; antes 20 desde 640 px)
 *   · título de un panel o tarjeta    16 px · 700 (igual)
 *   · título de bloque, nombre        14 px · 600
 *   · texto                           14 px (igual)
 *   · ayuda, línea secundaria, etiqueta  13 px
 *   · botones (todos), pestaña, opción, enlace «Agenda»   13 px de letra y 40 px de alto
 *   · campo                           40 px de alto, 16 px de letra (un iPad cuenta como computadora y
 *                                     haría zoom con menos de 16)
 *   · rellenos y separaciones de 14 px o más: × 5/6 (48 → 40, la proporción de los botones), al par
 *     más cercano: 28 → 24, 24 → 20, 22 → 18, 20 → 16, 18 → 16, 16 → 14, 14 → 12; los de 12 o menos, igual
 *   · el interruptor, el mismo dibujo con 40 px de toque (46 en el teléfono)
 * `configuracionEscala.test.ts` vigila las dos escalas.
 * `configuracionEscala.test.ts` exige que todo tamaño de letra de la configuración
 * esté en la escala de esa hoja. Las áreas de toque, de 44 px como mínimo.
 *
 * Nombre distinto de `clasesConfig.ts` (la de la pantalla vieja, que no se toca).
 */

/** Tarjeta blanca: la de cada pregunta del funnel (14 px, 24 de relleno). */
export const TARJETA = 'flex flex-col rounded-[14px] border border-[var(--ag-border-card)] bg-[var(--ag-surface)] p-[24px] sm:p-[20px]'

/** El panel de cada pestaña (16 px, 28 de relleno; 20 en el teléfono para que quepa). */
export const PANEL = 'flex flex-col gap-[18px] sm:gap-[16px] rounded-[16px] border border-[var(--ag-border-card)] bg-[var(--ag-surface)] p-[20px] sm:p-[24px]'

/** Separador entre bloques de un panel. */
export const BLOQUE = 'flex flex-col gap-[12px] border-t border-[var(--ag-hairline)] pt-[18px] sm:pt-[16px]'

/** El h1 de la página y de cada paso del funnel (`.rp-titulo`). */
export const TITULO_PASO = 'm-0 text-[18px] font-bold leading-[1.3] text-[var(--ag-ink)]'
export const SUB_PASO = 'm-0 text-[14px] leading-[1.5] text-[var(--ag-ink-600)]'
export const TITULO_PANEL = 'm-0 text-[16px] font-bold text-[var(--ag-ink)]'
export const SUB_PANEL = 'm-0 text-[14px] leading-[1.5] text-[var(--ag-ink-600)]'
export const TITULO_BLOQUE = 'text-[15px] sm:text-[14px] font-semibold text-[var(--ag-ink)]'
export const AYUDA = 'text-[13.5px] sm:text-[13px] leading-[1.5] text-[var(--ag-ink-600)]'
export const ETIQUETA = 'flex flex-wrap items-center gap-[10px] text-[14px] text-[var(--ag-text)]'
export const ERROR = 'm-0 text-[14px] font-semibold text-[var(--ag-status-cancelled-text)]'

/** Botón azul lleno (48 px de alto; 16 px · 700, `.rp-btn`). El borde `--ag-brand-legible` no se ve en claro (es el mismo azul) y
    en oscuro es lo que lo separa de la superficie: el relleno crudo queda a 2,24:1 de `--ag-surface`. */
export const BOTON_AZUL =
  'inline-flex min-h-[48px] sm:min-h-[40px] cursor-pointer items-center justify-center gap-[8px] rounded-[10px] border border-[var(--ag-brand-legible)] bg-[var(--ag-brand-secondary)] px-[22px] sm:px-[18px] text-[16px] sm:text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60'

/* Los botones con borde usan `--ag-control-border` y no el gris claro de la maqueta: es el token de la
   app para un botón en REPOSO (tanda H, punto 7: borde ≥ 3:1). Sección F: colores con los tokens de la app. */

/** Botón blanco con borde (48 px). */
export const BOTON_BLANCO =
  'inline-flex min-h-[48px] sm:min-h-[40px] cursor-pointer items-center justify-center gap-[8px] rounded-[10px] border border-[var(--ag-control-border)] bg-[var(--ag-surface)] px-[22px] sm:px-[18px] text-[16px] sm:text-[13px] font-bold text-[var(--ag-ink)] hover:bg-[var(--ag-control-bg-hover)] disabled:cursor-not-allowed disabled:opacity-60'

/** Botón blanco pequeño (44 px, 15 px de letra): «Cambiar», «Crear uno», «Cambiar horario». */
export const BOTON_CHICO =
  'inline-flex min-h-[44px] sm:min-h-[40px] flex-none cursor-pointer items-center justify-center rounded-[10px] border border-[var(--ag-control-border)] bg-[var(--ag-surface)] px-[18px] sm:px-[16px] text-[15px] sm:text-[13px] font-semibold text-[var(--ag-ink)] hover:bg-[var(--ag-control-bg-hover)] disabled:cursor-not-allowed disabled:opacity-60'

/** Botón de texto azul («Cambiar» del resumen, «Copiar», «Agregar tipo de cita»). */
export const BOTON_TEXTO =
  'inline-flex min-h-[44px] sm:min-h-[40px] cursor-pointer items-center gap-[6px] border-0 bg-transparent px-[8px] text-[14px] sm:text-[13px] font-semibold text-[var(--ag-brand-legible)] disabled:cursor-not-allowed disabled:opacity-60'

/** Botón de texto rojo («Apagar», «Quitar»). */
export const BOTON_TEXTO_ROJO =
  'inline-flex min-h-[44px] sm:min-h-[40px] cursor-pointer items-center border-0 bg-transparent px-[8px] text-[14px] sm:text-[13px] font-semibold text-[var(--ag-status-cancelled-text)] disabled:cursor-not-allowed disabled:opacity-60'

/** Campo de texto, número, hora o selector (44 px, 16 px · 400 de letra: el teléfono no hace zoom; `font-normal` porque
    hereda el peso de su etiqueta, que es seminegrita como `.rp-campo`). */
export const CAMPO_NUEVO =
  'min-h-[44px] sm:min-h-[40px] rounded-[8px] border border-[var(--ag-input-border)] bg-[var(--ag-input-bg)] px-[10px] py-[8px] sm:py-[6px] text-[16px] font-normal text-[var(--ag-ink)] focus:border-[var(--ag-input-focus-border)] focus:outline-none focus:ring-2 focus:ring-[var(--ag-input-focus-ring)] disabled:opacity-60'

/** La dirección del enlace, en letra de máquina. */
export const DIRECCION =
  'break-all rounded-[10px] border border-[var(--ag-border-card)] bg-[var(--ag-surface-sunken)] px-[16px] sm:px-[14px] py-[14px] sm:py-[12px] font-mono text-[15px] sm:text-[14px] text-[var(--ag-ink)]'

/** Fila gris de una lista dentro de un panel (enlaces de una vez, tipos de cita). */
export const FILA_GRIS =
  'flex flex-wrap items-center justify-between gap-[12px] rounded-[10px] bg-[var(--ag-surface-sunken)] px-[16px] sm:px-[14px] py-[12px]'

/** Una opción elegible (rejilla de duraciones): elegida, azul claro con borde azul. */
export function opcion(elegida: boolean): string {
  return `min-h-[56px] sm:min-h-[40px] cursor-pointer rounded-[12px] border-2 text-[15px] sm:text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${elegida
    ? 'border-[var(--ag-brand-secondary)] bg-[var(--ag-primary-bg-faint)] text-[var(--ag-brand-legible)]'
    : 'border-[var(--ag-control-border)] bg-[var(--ag-surface)] text-[var(--ag-ink)]'}`
}

/**
 * Tanda L, punto 16 de Angel: lo que ve quien NO administra la clínica en lo que no puede cambiar, una
 * vez por bloque (`data-solo-admin`). Sólo donde la ruta deja cambiar al administrador y a nadie más
 * (`canManageClinica`): el horario de la clínica y los avisos. No en los tipos de cita (cada médico
 * cambia los suyos) ni en el horario de un consultorio (sólo su dueño, tampoco el administrador).
 */
export const SOLO_ADMIN = 'Solo el administrador de la clínica puede cambiar estas opciones.'
