/**
 * Las clases de la configuración de la agenda (`/agenda/configuracion`): el asistente de primera vez y las cinco
 * pestañas. B13 · AG9/AG10 (rediseño): con los TOKENS Y LAS PRIMITIVAS DEL KIT (`sistema.css`: `--sup`, `--tinta2`,
 * `--enlace`, `--accion`, `--tonal`, `.k-b`, `.k-campo`, `.k-t-pantalla`…), con su oscuro, y el patrón aprobado de
 * Mi perfil (maquetas `ag-config` y `ag-pv`): grupos con rótulo de color e icono FUERA de una superficie, datos como
 * filas de lista, acciones como texto azul. Ningún `--ag-*`: la página vive fuera de `.agenda-raiz`.
 *
 * ⚠️ LA LETRA VA EN LA ESCALA DEL KIT (sustituye a la de la página de reserva de la tanda L): los tamaños de
 * `sistema.css`, papel por papel:
 *   · título de la página (h1)             26 · 32 en `ih`/`iv`/`esc` · 800   (`.k-t-pantalla`)
 *   · frase de la pestaña o del paso       15 · 14 en `esc`
 *   · rótulo de un grupo                   13 · 700 · mayúsculas · `--enlace`
 *   · título de fila o de bloque           15 · 600                         (`.k-fila-n`)
 *   · dato secundario, ayuda, pie          13                               (`.k-fila-s`, `.k-campo-ayuda`)
 *   · etiqueta de un campo                 13 · 600                         (`.k-etiqueta`)
 *   · insignia                             12 · 600                         (`.k-etq`)
 *   · campo                                16 · 15 en `ih`/`esc`            (`.k-campo`)
 *   · botón                                15 · 14 en `ih`/`esc`            (`.k-b`)
 *
 * ⚠️ DOS ESCALAS DE TOQUE, POR FORMATO Y NO POR ANCHO (CALMA §2, `--k-toque`): la TÁCTIL (`ext`, `tel` e `iv`, el
 * Duo abierto en vertical: 44 px) y la de COMPUTADORA (`ih` y `esc`: 36 px, campos de 40). Antes la de computadora
 * salía desde 640 px (`sm:`) y en el Duo abierto TODOS los controles medían menos de 44. Va como variantes `ih:` y
 * `esc:` (siempre las dos) junto a la de teléfono; ningún tamaño con `sm:`/`md:`. `configuracionEscala.test.ts`
 * vigila las dos escalas.
 *
 * Nombre distinto de `clasesConfig.ts` (la de la pantalla vieja, que no se toca).
 */

/** Rellenos laterales de una fila: 16 en el teléfono, 20 en ancho (la sangría de los separadores de `.agc-lista`). */
const LADOS = 'px-[16px] ih:px-[20px] iv:px-[20px] esc:px-[20px]'

/** Una superficie suelta: la de cada pregunta del asistente, sin borde ni sombra (CALMA §3). */
export const TARJETA = 'flex flex-col rounded-[16px] bg-sup p-[16px] ih:rounded-[18px] iv:rounded-[18px] esc:rounded-[20px] ih:p-[20px] iv:p-[20px] esc:p-[20px]'

/** Una superficie cuyas filas ponen su propio relleno vertical (el editor de días, las opciones del asistente). */
export const SUPERFICIE = 'flex flex-col rounded-[16px] bg-sup px-[16px] ih:rounded-[18px] iv:rounded-[18px] esc:rounded-[20px] ih:px-[20px] iv:px-[20px] esc:px-[20px]'

/** La cabecera de un paso del asistente o de la página: h1 y su frase. */
export const CABECERA_PASO = 'flex flex-col gap-[6px] pt-[6px]'

/** Un paso del asistente: cabecera y grupos. */
export const SECCION_PASO = 'flex flex-col gap-[24px] ih:gap-[28px] iv:gap-[28px] esc:gap-[28px]'

/** Una superficie que es una LISTA: filas con separador con sangría (`.agc-lista`, `globals.css`). */
export const LISTA = 'agc-lista'

/** La pestaña: sus grupos, uno bajo otro. */
export const PANEL = 'flex flex-col gap-[24px] ih:gap-[28px] iv:gap-[28px] esc:gap-[28px]'

/** Un grupo: rótulo, superficie y pie. */
export const BLOQUE = 'flex min-w-0 flex-col gap-[8px]'

/** El rótulo de un grupo, FUERA de la superficie: icono de 16 y texto 13/700 en mayúsculas, `--enlace`. */
export const ROTULO = `m-0 flex min-h-[24px] min-w-0 items-center gap-[6px] ${LADOS} text-[13px] font-bold uppercase leading-[18px] tracking-[.4px] text-enlace`

/** La línea de ayuda bajo una superficie. */
export const PIE = `m-0 ${LADOS} text-[13px] leading-[18px] text-tinta2`

/** Una fila de dato o de control dentro de la lista. */
export const FILA = `flex min-h-[48px] items-center justify-between gap-[12px] ${LADOS} py-[12px]`

/** Una fila de lista con acciones de texto a la derecha (tipos de cita, enlaces de una vez, contactos). */
export const FILA_GRIS = 'flex min-h-[60px] flex-wrap items-center justify-between gap-x-[8px] gap-y-[2px] py-[8px] pl-[16px] pr-[8px] ih:pl-[20px] iv:pl-[20px] esc:pl-[20px] ih:pr-[12px] iv:pr-[12px] esc:pr-[12px]'

/** Una fila entera que es la acción («Cambiar horario», «Crear uno»): texto azul y, si navega, «›». */
export const FILA_ACCION = `flex min-h-[48px] w-full cursor-pointer items-center gap-[10px] border-0 bg-transparent ${LADOS} text-left text-[15px] font-semibold leading-[20px] text-enlace disabled:cursor-default disabled:text-tinta2 ih:min-h-[44px] esc:min-h-[44px] ih:text-[14px] esc:text-[14px]`

/** El h1 de la página y de cada paso del asistente (`.k-t-pantalla`: 26/800, 32 en ancho). */
export const TITULO_PASO = 'm-0 k-t-pantalla'
export const SUB_PASO = 'm-0 text-[15px] leading-[22px] text-tinta2 esc:text-[14px] esc:leading-[20px]'
/** El h2 de cada pestaña: lo dice ya la pestaña elegida; queda para el lector de pantalla y la estructura. */
export const TITULO_PANEL = 'sr-only'
/** La frase de cada pestaña, arriba y sin superficie. */
export const SUB_PANEL = 'm-0 text-[15px] leading-[21px] text-tinta2 esc:text-[14px] esc:leading-[20px]'
export const TITULO_BLOQUE = 'text-[15px] font-semibold leading-[20px] text-tinta'
export const AYUDA = 'text-[13px] leading-[18px] text-tinta2'
export const ETIQUETA = 'flex flex-wrap items-center gap-[8px] text-[15px] leading-[20px] text-tinta esc:text-[14px]'
export const ERROR = 'm-0 text-[14px] font-semibold leading-[20px] text-mal-tinta'

/** El ÚNICO botón relleno de la pantalla (`.k-b-prim`): 44 en táctil, 36 en `ih`/`esc`. */
export const BOTON_AZUL = 'k-b k-b-prim h-[44px] ih:h-[36px] esc:h-[36px] disabled:opacity-45'

/** El secundario, quieto (`--sup2`): «Cancelar», «Atrás». */
export const BOTON_BLANCO = 'k-b k-b-quieto h-[44px] ih:h-[36px] esc:h-[36px]'

/** El tonal («Mandar por WhatsApp», «Emitir enlace de un solo uso»). Auditoría B13 · 6: deshabilitado, en
    «quieto» gris y opaco (el 45 % del kit dejaba su nombre en 2,8:1, 2,3:1 en oscuro; así se lee). */
export const BOTON_CHICO = 'k-b k-b-tonal h-[44px] ih:h-[36px] esc:h-[36px] disabled:bg-sup2 disabled:text-tinta2 disabled:opacity-100'

/** Botón de texto azul («Copiar», «Editar», «Guardar» de una fila). */
export const BOTON_TEXTO = 'k-b k-b-texto h-[44px] px-[8px] ih:h-[36px] esc:h-[36px] disabled:text-tinta2'

/** Botón de texto rojo («Apagar», «Quitar», «Revocar»). */
export const BOTON_TEXTO_ROJO = `${BOTON_TEXTO} text-mal-tinta`

/** Campo de texto, número u hora (`.k-campo`: relleno `--sup2`, sin borde; 16 de letra en táctil, sin zoom). */
export const CAMPO_NUEVO = 'k-campo'

/** Un selector: el campo con su flecha. */
export const SELECTOR = 'k-campo agc-select'

/** La dirección del enlace, en letra de máquina y sin caja dentro de la caja. */
export const DIRECCION = 'm-0 break-all font-mono text-[15px] leading-[22px] text-tinta esc:text-[14px] esc:leading-[20px]'

/** La caja ámbar de los avisos de página («Ningún enlace abre todavía…»). */
export const CAJA_AVISO = 'm-0 flex items-start gap-[8px] rounded-[12px] bg-aviso-fondo p-[12px] text-[13px] leading-[18px] text-aviso-tinta'

/** Una opción elegible (rejilla de duraciones): elegida, tonal con anillo de `--accion`. */
export function opcion(elegida: boolean): string {
  return `relative flex h-[44px] cursor-pointer items-center justify-center rounded-[12px] border-0 text-[15px] font-semibold tabular-nums ih:h-[40px] esc:h-[36px] esc:text-[14px] disabled:cursor-not-allowed disabled:opacity-45 ${elegida
    ? 'bg-tonal text-tonal-tinta shadow-[inset_0_0_0_2px_var(--accion)]'
    : 'bg-sup2 text-tinta'}`
}

/**
 * Lo que ve quien NO es el médico administrador en lo que no puede cambiar (`data-solo-admin`). Tanda L,
 * punto 16, con el texto unificado de la tanda M (punto 15 de Angel), el mismo en la página y en el funnel.
 * Dónde va (punto 15; la ruta lo niega: 403/404):
 *   · la secretaria: al inicio de «Cuándo dan consulta», «Tipos de cita» y «Avisos», y en «Más opciones»
 *     sobre «Empezar de nuevo» y no arriba del todo, porque ahí SÍ desbloquea personas;
 *   · el médico invitado, en lo que no es suyo: la tarjeta del horario de la clínica, los tipos de cita de
 *     los demás, «Avisos» y «Empezar de nuevo»; en el funnel, pasos 1 y 3.
 * Una vez por sitio: si va al inicio de la pestaña, no se repite dentro.
 */
export const SOLO_ADMIN = 'Solo el médico administrador puede cambiar estas opciones.'
/* Integración M (decisión de Angel): a la secretaria, en dos pestañas el aviso dice quién cambia de verdad
   (el horario de cada consultorio lo cambia su dueño; los tipos de un médico, ese médico o el administrador). */
export const SOLO_ADMIN_HORARIO = 'Cada médico cambia el horario de sus consultorios.'
export const SOLO_ADMIN_TIPOS = 'Cada médico cambia sus tipos de cita.'

/** El aviso de `SOLO_ADMIN`: nota informativa TONAL con la letra en seminegrita, para que se vea (punto 15; maqueta
    `ag-config` `.ac-nota`). Dentro de una lista lleva además su margen (`AVISO_EN_LISTA`). */
export const AVISO_SOLO_ADMIN = 'm-0 rounded-[12px] bg-tonal px-[12px] py-[10px] text-[13px] font-semibold leading-[18px] text-tonal-tinta'
export const AVISO_EN_LISTA = 'agc-sin-linea mx-[16px] my-[12px] ih:mx-[20px] iv:mx-[20px] esc:mx-[20px]'
