'use client'

import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Check, Info, AlertTriangle, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning'
type ToastItem = { id: number; message: string; type: ToastType; sale: boolean }

type ToastFn = {
  success: (msg: string) => void
  error: (msg: string) => void
  info: (msg: string) => void
  warning: (msg: string) => void
}

const ToastContext = createContext<ToastFn>({ success: () => {}, error: () => {}, info: () => {}, warning: () => {} })

/* Duración de cada aviso. Sólo la advertencia se queda 8 s (PLAN B3); el resto,
   4 s, como siempre. */
const DURACION: Record<ToastType, number> = { success: 4000, info: 4000, error: 4000, warning: 8000 }

/* Lo que tarda la salida (`--dur-sale`). El aviso sigue montado ese rato para
   que se vea salir por donde entró; luego se quita del estado. */
const SALIDA_MS = 240

/* Al reanudar tras una pausa, nunca menos de 1 s: si el puntero se va justo al
   final, el aviso no desaparece en seco. */
const MINIMO_TRAS_PAUSA = 1000

/* ⚠️ LOS COLORES SON LOS SEMÁNTICOS FIJOS DEL KIT, NO LOS DE LA MARCA. Antes eran
   clases de Tailwind a propósito: con `--sp-primary-*` el aviso de «info»
   tomaba el COLOR DE MARCA de la clínica, y en una paleta verde «info» y «éxito»
   salían los dos verdes. Un aviso de sistema no puede depender del color que el
   médico eligió. Por eso «info» NO usa `--tonal` (que deriva de la marca, PLAN
   §2.2) sino el neutro `--sup2`/`--tinta2`. `--ok-*`, `--mal-*` y `--aviso-*`
   tienen su oscuro en `sistema.css`. */
const TINTA_ICONO: Record<ToastType, string> = {
  success: 'bg-ok-fondo text-ok-tinta',
  error:   'bg-mal-fondo text-mal-tinta',
  info:    'bg-sup2 text-tinta2',
  warning: 'bg-aviso-fondo text-aviso-tinta',
}
const ICONO: Record<ToastType, React.ReactNode> = {
  success: <Check         size={16} strokeWidth={2.5} aria-hidden="true" />,
  error:   <X             size={16} strokeWidth={2.5} aria-hidden="true" />,
  info:    <Info          size={16} strokeWidth={2.5} aria-hidden="true" />,
  warning: <AlertTriangle size={16} strokeWidth={2.5} aria-hidden="true" />,
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const add = useCallback((message: string, type: ToastType) => {
    const id = ++counter.current
    setToasts(prev => [...prev, { id, message, type, sale: false }])
  }, [])

  /* Cerrar = marcar la salida y, cuando acaba, quitarlo. Dos cierres seguidos
     (el reloj y la X a la vez) no hacen daño: el segundo no encuentra nada. */
  const cerrar = useCallback((id: number) => {
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, sale: true } : t)))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), SALIDA_MS)
  }, [])

  // Memoizado: sin esto el objeto cambia de identidad en cada toast que entra
  // o sale, y re-renderiza todo el arbol bajo el provider.
  const toast: ToastFn = useMemo(() => ({
    success: (msg: string) => add(msg, 'success'),
    error:   (msg: string) => add(msg, 'error'),
    info:    (msg: string) => add(msg, 'info'),
    warning: (msg: string) => add(msg, 'warning'),
  }), [add])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ZonaAvisos>
        {toasts.map(t => <AvisoBreve key={t.id} aviso={t} onCerrar={cerrar} />)}
      </ZonaAvisos>
    </ToastContext.Provider>
  )
}

/* La zona de los avisos: ARRIBA Y CENTRADA EN EL ÁREA DE CONTENIDO (CALMA §25,
   maqueta `capas-b/vista-1-aviso`), nunca abajo a la derecha ni bajo la
   navegación o una franja del sistema.
   ⚠️ LOS DESPLAZAMIENTOS SON LOS DE LA NAVEGACIÓN DEL REDISEÑO (B4): riel de
   56 en `ext`, barra lateral de 218 en `ih`, encabezado fundido en `tel`
   (it + 64) e `iv` (it + 58) y barra izquierda de 248 en `esc`. Si B4 cambia
   esas medidas, cambian aquí. Con la franja a la izquierda (Duo girado,
   `data-borde-sistema="izquierda"`) el riel y la barra pasan a ese lado, y la
   zona se espeja.
   ⚠️ LAS FRANJAS VAN POR `--it/--ir/--il` (env()), NUNCA CON NÚMEROS FIJOS.
   Sin `data-formato` (páginas sin la sonda) es simplemente arriba y centrado.
   ⚠️ EL z-[9999] SE QUEDA: el aviso tiene que verse encima de cualquier modal,
   y hoy hay capas a 9998 (`CommandPalette`, `ConsultaRapidaModal`). La escala
   `--z-*` aún no las cubre. */
function ZonaAvisos({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-live="polite"
      className={[
        'pointer-events-none fixed z-[9999] flex flex-col items-center gap-2 px-3',
        'top-[calc(var(--it)+12px)] left-[var(--il)] right-[var(--ir)]',
        'ext:right-[calc(56px+var(--ir))]',
        '[[data-borde-sistema=izquierda]_&]:ext:left-[calc(56px+var(--il))] [[data-borde-sistema=izquierda]_&]:ext:right-0',
        'tel:top-[calc(var(--it)+76px)] iv:top-[calc(var(--it)+74px)] iv:px-4',
        'ih:top-[calc(var(--it)+16px)] ih:right-[calc(218px+var(--ir))] ih:px-4',
        '[[data-borde-sistema=izquierda]_&]:ih:left-[calc(218px+var(--il))] [[data-borde-sistema=izquierda]_&]:ih:right-0',
        'esc:top-5 esc:left-[248px] esc:right-0 esc:px-5',
      ].join(' ')}
    >
      {children}
    </div>
  )
}

/* El reloj de un aviso, con pausa: se detiene mientras el puntero está encima o
   el foco está dentro, y al soltar sigue con lo que le quedaba (mínimo 1 s). */
function useRelojAviso(duracion: number, alAcabar: () => void) {
  const restante = useRef(duracion)
  const inicio = useRef(0)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pausas = useRef(0)
  const acabar = useRef(alAcabar)
  useEffect(() => { acabar.current = alAcabar })

  const correr = useCallback(() => {
    inicio.current = Date.now()
    temporizador.current = setTimeout(() => acabar.current(), restante.current)
  }, [])

  useEffect(() => {
    correr()
    return () => { if (temporizador.current) clearTimeout(temporizador.current) }
  }, [correr])

  const pausar = useCallback(() => {
    pausas.current += 1
    if (pausas.current > 1 || !temporizador.current) return
    clearTimeout(temporizador.current)
    temporizador.current = null
    restante.current = Math.max(MINIMO_TRAS_PAUSA, restante.current - (Date.now() - inicio.current))
  }, [])

  const seguir = useCallback(() => {
    pausas.current = Math.max(0, pausas.current - 1)
    if (pausas.current === 0 && !temporizador.current) correr()
  }, [correr])

  return { pausar, seguir }
}

/* Un aviso. Entra desde arriba (−60 % de su alto y opacidad 0) con
   `@starting-style` y sale por el MISMO camino, más rápido. Son transiciones,
   no `@keyframes`: si se cierra a medio entrar, se invierte desde donde está.
   Con movimiento reducido, sólo fundido. Sólo `translate` (transform) y
   `opacity`: en Tailwind 4 `translate-y-*` escribe la propiedad `translate`.
   ⚠️ EL ROL VA EN CADA AVISO: `status` para éxito e información, `alert` para
   error y advertencia. Las e2e localizan el aviso por su TEXTO
   (`toastConTexto` en `e2e/ayudas.ts`): no dupliques el mensaje en otro nodo
   (p. ej. un texto oculto para lectores), o esa búsqueda deja de ser única. */
function AvisoBreve({ aviso, onCerrar }: { aviso: ToastItem; onCerrar: (id: number) => void }) {
  const { id, type, message, sale } = aviso
  const cerrarEste = useCallback(() => onCerrar(id), [onCerrar, id])
  const { pausar, seguir } = useRelojAviso(DURACION[type], cerrarEste)

  return (
    <div
      role={type === 'success' || type === 'info' ? 'status' : 'alert'}
      data-tipo={type}
      data-sale={sale ? '' : undefined}
      onPointerEnter={pausar}
      onPointerLeave={seguir}
      onFocus={pausar}
      onBlur={seguir}
      onKeyDown={e => { if (e.key === 'Escape') cerrarEste() }}
      className={[
        'pointer-events-auto relative flex w-full max-w-[400px] items-start gap-2.5',
        'rounded-[14px] bg-sup py-2.5 pl-2.5 pr-1.5 ih:pr-2 esc:pr-2 shadow-[var(--sombra-capa)]',
        'transition-[translate,opacity] duration-[var(--dur-entra)] ease-[var(--resorte-entra)]',
        /* El recorrido va en una variable para que el movimiento reducido lo
           anule sin pelear con el orden de las variantes. */
        '[--recorrido:-60%] motion-reduce:[--recorrido:0px] motion-reduce:duration-[var(--dur-sale)]',
        'starting:translate-y-[var(--recorrido)] starting:opacity-0',
        'data-[sale]:translate-y-[var(--recorrido)] data-[sale]:opacity-0',
        'data-[sale]:duration-[var(--dur-sale)] data-[sale]:ease-[var(--resorte-sale)]',
      ].join(' ')}
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${TINTA_ICONO[type]}`}>
        {ICONO[type]}
      </span>
      <span className="min-w-0 flex-1 pt-1 text-[14px] leading-5 font-semibold text-tinta [overflow-wrap:anywhere]">
        {message}
      </span>
      <button
        type="button"
        onClick={cerrarEste}
        aria-label="Cerrar aviso"
        className="-my-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-tinta3 hover:bg-sup2 hover:text-tinta focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-enlace ih:-my-1 ih:h-9 ih:w-9 esc:-my-1 esc:h-9 esc:w-9"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
