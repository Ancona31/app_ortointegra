/**
 * src/lib/agenda/atajosAgenda.ts
 *
 * Los atajos de teclado de la agenda (bloque F, F3.5, detrás del interruptor).
 * Puro: la tabla de teclas, la guarda de cuándo NO actúan y la preferencia de
 * apagarlos. El oyente vive en `useAtajosAgenda`, junto a la ruta.
 *
 * ⚠️ SE COMPARA `e.key`, NUNCA `e.code`. `key` es el carácter que produce la
 * tecla con la distribución del usuario: en un teclado español `/` sale con
 * Mayús+7 y `?` con Mayús+'; con `code` habría que adivinar dónde está cada
 * signo. Por lo mismo, Mayús NO cuenta como modificador: sin ella no se puede
 * teclear `?` ni `/` en ese teclado.
 *
 * ⚠️ NO ACTÚAN (`accionDeTecla` devuelve `null`):
 *   · con Ctrl, Alt o Meta (AltGr en Windows llega como Ctrl+Alt): esos gestos
 *     son del navegador o del sistema;
 *   · durante una composición (`isComposing`: acentos muertos, IME);
 *   · con el foco en un campo editable —`input`, `select`, `textarea` o
 *     `contenteditable`—: escribir «juan» en el buscador no puede saltar de
 *     semana con la `j`;
 *   · con cualquier capa abierta (modal, burbuja, tarjeta, ayuda): sus teclas
 *     son suyas.
 *
 * WCAG 2.1.4 (atajos de un solo carácter): se pueden APAGAR desde la ayuda, y
 * la preferencia se guarda en el navegador. No es un dato de paciente.
 */

export type AccionAtajo =
  | 'hoy' | 'siguiente' | 'anterior'
  | 'vista-dia' | 'vista-semana' | 'vista-mes'
  | 'agendar' | 'buscar' | 'ayuda'

export interface Atajo { teclas: readonly string[]; accion: AccionAtajo; descripcion: string }

/** La tabla. El orden es el de la ayuda. */
export const ATAJOS: readonly Atajo[] = [
  { teclas: ['t'], accion: 'hoy', descripcion: 'Ir a hoy' },
  { teclas: ['j', 'n'], accion: 'siguiente', descripcion: 'Periodo siguiente' },
  { teclas: ['k', 'p'], accion: 'anterior', descripcion: 'Periodo anterior' },
  { teclas: ['d'], accion: 'vista-dia', descripcion: 'Vista Día' },
  { teclas: ['s'], accion: 'vista-semana', descripcion: 'Vista Semana' },
  { teclas: ['m'], accion: 'vista-mes', descripcion: 'Vista Mes' },
  { teclas: ['c'], accion: 'agendar', descripcion: 'Agendar' },
  { teclas: ['/'], accion: 'buscar', descripcion: 'Buscar citas de un paciente' },
  { teclas: ['?'], accion: 'ayuda', descripcion: 'Ver estos atajos' },
]

const POR_TECLA: ReadonlyMap<string, AccionAtajo> = new Map(
  ATAJOS.flatMap(a => a.teclas.map(t => [t, a.accion] as [string, AccionAtajo])),
)

/** Lo que se lee de un `KeyboardEvent`; el real lo cumple. */
export interface TeclaPulsada {
  key: string
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
  isComposing: boolean
  target: EventTarget | null
}

const ETIQUETAS_EDITABLES = new Set(['INPUT', 'SELECT', 'TEXTAREA'])

/**
 * ¿El objetivo de la tecla es un sitio donde se escribe? Pregunta por las
 * propiedades con `in` y no con `instanceof HTMLElement`, para poder probarla
 * sin DOM y para que valga también con un elemento de otro documento (iframe).
 */
export function esObjetivoEditable(objetivo: EventTarget | null): boolean {
  if (objetivo === null || typeof objetivo !== 'object') return false
  if ('isContentEditable' in objetivo && objetivo.isContentEditable === true) return true
  if (!('tagName' in objetivo)) return false
  const etiqueta = objetivo.tagName
  return typeof etiqueta === 'string' && ETIQUETAS_EDITABLES.has(etiqueta.toUpperCase())
}

/** La acción de una tecla, o `null` si no toca hacer nada. */
export function accionDeTecla(e: TeclaPulsada, capaAbierta: boolean): AccionAtajo | null {
  if (capaAbierta || e.isComposing) return null
  if (e.ctrlKey || e.altKey || e.metaKey) return null
  if (esObjetivoEditable(e.target)) return null
  return POR_TECLA.get(e.key) ?? null
}

/** Para `aria-keyshortcuts` del botón que hace lo mismo («J N»). */
export function teclasDeAccion(accion: AccionAtajo): string {
  const a = ATAJOS.find(x => x.accion === accion)
  return a ? a.teclas.map(t => t.toUpperCase()).join(' ') : ''
}

/* ── La preferencia «Usar atajos de una tecla» ────────────────────────── */

export const CLAVE_ATAJOS = 'spinus.agenda.atajos'

/** Lo mínimo de `Storage`; `localStorage` lo cumple. */
export interface AlmacenPreferencia {
  getItem(clave: string): string | null
  setItem(clave: string, valor: string): void
}

/** Encendidos por omisión (decisión 23). Sin almacén o si falla, también. */
export function leerAtajosEncendidos(almacen: AlmacenPreferencia | null): boolean {
  try { return almacen?.getItem(CLAVE_ATAJOS) !== 'no' } catch { return true }
}

/** Guarda la preferencia. Un almacén bloqueado (modo privado) no rompe nada. */
export function guardarAtajosEncendidos(almacen: AlmacenPreferencia | null, encendidos: boolean): void {
  try { almacen?.setItem(CLAVE_ATAJOS, encendidos ? 'si' : 'no') } catch { /* sin almacén: vale para esta visita */ }
}
