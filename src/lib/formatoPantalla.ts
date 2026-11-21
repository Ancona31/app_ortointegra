/* ═══ EL FORMATO DE PANTALLA (B1 del rediseño, PLAN §2.5) ═════════════════════
 *
 * Cinco formatos, decididos por el ancho de la ventana y por si el sistema
 * tapa un borde lateral (la franja del iPhone Duo):
 *
 *   ext  borde lateral y ancho < 700          Duo cerrado
 *   ih   borde lateral y 700 ≤ ancho < 1024   Duo abierto en horizontal
 *   tel  sin borde lateral y ancho < 600      teléfono en vertical
 *   iv   sin borde lateral y 600 ≤ ancho < 1024  Duo abierto en vertical
 *   esc  ancho ≥ 1024                          computadora
 *
 * ⚠️ «BORDE LATERAL» NO ES SÓLO UN INSET (corrección tras probar en el Duo
 * real, 2026-11-21). Con la franja del sistema a un LADO, iOS la deja FUERA
 * del viewport de la página —también en la app instalada con
 * `viewport-fit=cover`—, así que `env(safe-area-inset-right/left)` valen 0 y
 * la página mide la pantalla menos la franja (Duo cerrado ~382 de 466; abierto
 * en horizontal ~867 de 951). Por eso hay franja lateral si hay un inset
 * lateral > 0 O si se DEDUCE de `window.screen`: `screen.width − innerWidth`
 * o `screen.height − innerWidth` cae en [60, 120]
 * (iOS no gira `screen.width/height`, por eso se prueban los dos). Deducida y
 * sin inset no se sabe el lado: el borde vale `derecha` (el Duo la pone ahí).
 * La deducción sólo se hace por debajo de 1024 y con la pantalla
 * declarada en vertical (`screen.width < screen.height`, como la da iOS): así
 * una computadora (pantalla apaisada) con la ventana estrecha no la activa.
 * ⚠️ ASUMIENDO QUE `screen.width/height` del Duo dan el tamaño TOTAL (466×678
 * cerrado, 669×951 abierto). NO VERIFICADO en el aparato: lo dirá la línea de
 * diagnóstico de `/ayuda` (TEMPORAL, se retira en B15).
 *
 * QUIÉN LO ESCRIBE: la sonda `SCRIPT_SONDA_FORMATO`, que `ScriptTema.tsx` corre
 * ANTES DEL PRIMER PINTADO y que deja en <html> `data-formato` y
 * `data-borde-sistema`. Lo recalcula al girar, al redimensionar (abrir o cerrar
 * el Duo) y al volver a la página, y avisa con el evento `spinus:formato`.
 *
 * ⚠️ LA SONDA ES UNA CADENA, NO UNA FUNCIÓN IMPORTADA: va en línea dentro de un
 * <script> sin `async` para correr antes de pintar. Por eso los cortes son
 * constantes que se interpolan en la cadena y la clasificación está DOS veces
 * (`clasificarFormato` y la sonda). Van juntas; `formatoPantalla.test.ts`
 * ejecuta la sonda contra la tabla de `clasificarFormato` para que no diverjan.
 *
 * ⚠️ HIDRATACIÓN. Ningún componente decide su marcado por el formato en el
 * primer render: en el servidor no existe y vale «desconocido». El formato se
 * aplica con CSS (`ext:`, `tel:`… en `sistema.css`); si un componente lo
 * necesita en JS, lo lee con `leerFormato()` DESPUÉS de montar.
 */

export const FORMATOS = ['ext', 'tel', 'ih', 'iv', 'esc'] as const
export type Formato = (typeof FORMATOS)[number]
export type FormatoLeido = Formato | 'desconocido'

export const BORDES_SISTEMA = ['derecha', 'izquierda', 'arriba', 'ninguno'] as const
export type BordeSistema = (typeof BORDES_SISTEMA)[number]

/** Desde aquí, computadora (el mismo corte de 1024 que usa la app). */
export const ANCHO_ESC = 1024
/** Con franja lateral: por debajo, Duo cerrado; por encima, Duo abierto. */
export const ANCHO_EXT_MAX = 700
/** Sin franja lateral: por debajo, teléfono; por encima, tableta vertical. */
export const ANCHO_TEL_MAX = 600

export const EVENTO_FORMATO = 'spinus:formato'

export interface Insets { top: number; right: number; bottom: number; left: number }

export interface DetalleFormato { formato: Formato; borde: BordeSistema }

/** Lo que mide la pantalla entera (`window.screen`), si se sabe. */
export interface Pantalla { width: number; height: number }

/** Lo que puede medir una franja lateral que iOS deja fuera del viewport. */
export const FRANJA_MIN = 60
export const FRANJA_MAX = 120

/** ¿Falta en el viewport una franja lateral, aunque no haya inset? (cabecera) */
export function franjaLateralDeducida(ancho: number, p?: Pantalla): boolean {
  if (!p || ancho >= ANCHO_ESC || !(p.width < p.height)) return false
  const cae = (d: number): boolean => d >= FRANJA_MIN && d <= FRANJA_MAX
  return cae(p.width - ancho) || cae(p.height - ancho)
}

/** Qué borde tapa el sistema. Un lateral manda sobre el de arriba; uno
 *  deducido, sin inset, se da por la derecha. */
export function bordeDeInsets(i: Insets, ancho?: number, p?: Pantalla): BordeSistema {
  if (i.right > 0) return 'derecha'
  if (i.left > 0) return 'izquierda'
  if (ancho !== undefined && franjaLateralDeducida(ancho, p)) return 'derecha'
  if (i.top > 0) return 'arriba'
  return 'ninguno'
}

/** La tabla de la cabecera, como función pura. */
export function clasificarFormato(ancho: number, i: Insets, p?: Pantalla): Formato {
  if (ancho >= ANCHO_ESC) return 'esc'
  const lateral = i.right > 0 || i.left > 0 || franjaLateralDeducida(ancho, p)
  if (lateral) return ancho < ANCHO_EXT_MAX ? 'ext' : 'ih'
  return ancho < ANCHO_TEL_MAX ? 'tel' : 'iv'
}

function esFormato(v: string | undefined): v is Formato {
  return FORMATOS.some(f => f === v)
}

function esBorde(v: string | undefined): v is BordeSistema {
  return BORDES_SISTEMA.some(b => b === v)
}

/** El formato que dejó la sonda. En el servidor, o sin sonda, «desconocido». */
export function leerFormato(): FormatoLeido {
  if (typeof document === 'undefined') return 'desconocido'
  const v = document.documentElement.dataset.formato
  return esFormato(v) ? v : 'desconocido'
}

/** El borde que tapa el sistema, según la sonda. Sin sonda, «ninguno». */
export function leerBordeSistema(): BordeSistema {
  if (typeof document === 'undefined') return 'ninguno'
  const v = document.documentElement.dataset.bordeSistema
  return esBorde(v) ? v : 'ninguno'
}

/** Avisa cada vez que la sonda cambia el formato o el borde. Devuelve cómo dejar de escuchar. */
export function alCambiarFormato(cb: (d: DetalleFormato) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const oyente = (): void => {
    const formato = leerFormato()
    if (formato !== 'desconocido') cb({ formato, borde: leerBordeSistema() })
  }
  window.addEventListener(EVENTO_FORMATO, oyente)
  return () => window.removeEventListener(EVENTO_FORMATO, oyente)
}

/* LA SONDA, en línea. Mide los cuatro `env(safe-area-inset-*)` con un div fijo
 * e invisible, deduce la franja lateral de `window.screen` (cabecera), clasifica igual que `clasificarFormato` y escribe los dos
 * atributos sólo si cambian (y entonces emite el evento).
 * ⚠️ RELEE EN `pageshow` Y EN EL PRIMER `requestAnimationFrame`: en el arranque
 * de la app instalada de iOS los insets pueden valer 0 en el primer instante
 * (PLAN §6.3). Y el `try` no sobra: si algo lanza, la app arranca sin formato,
 * que equivale a la de antes del rediseño. */
export const SCRIPT_SONDA_FORMATO = `try{(function(){var d=document.documentElement;
function m(){var s=document.createElement('div');
s.style.cssText='position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
(document.body||d).appendChild(s);var c=getComputedStyle(s);
var t=parseFloat(c.paddingTop)||0,r=parseFloat(c.paddingRight)||0,l=parseFloat(c.paddingLeft)||0;
s.parentNode.removeChild(s);var w=window.innerWidth;
var p=window.screen,x=false;if(p&&w<${ANCHO_ESC}&&p.width<p.height){var a=p.width-w,h=p.height-w;
x=(a>=${FRANJA_MIN}&&a<=${FRANJA_MAX})||(h>=${FRANJA_MIN}&&h<=${FRANJA_MAX});}
var b=r>0?'derecha':l>0?'izquierda':x?'derecha':t>0?'arriba':'ninguno';
var f=w>=${ANCHO_ESC}?'esc':(r>0||l>0||x)?(w<${ANCHO_EXT_MAX}?'ext':'ih'):(w<${ANCHO_TEL_MAX}?'tel':'iv');
if(d.getAttribute('data-formato')!==f||d.getAttribute('data-borde-sistema')!==b){
d.setAttribute('data-formato',f);d.setAttribute('data-borde-sistema',b);
try{window.dispatchEvent(new CustomEvent('${EVENTO_FORMATO}',{detail:{formato:f,borde:b}}))}catch(e){}}}
m();window.addEventListener('resize',m);window.addEventListener('orientationchange',m);
window.addEventListener('pageshow',m);if(window.requestAnimationFrame)requestAnimationFrame(m);
})()}catch(e){}`
