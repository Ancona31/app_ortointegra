'use client'

import { useState, useEffect, useRef } from 'react'
import { WifiOff, Loader2 } from 'lucide-react'

/**
 * OfflineAlert — Modal bloqueante full-screen cuando no hay conexión.
 *
 * Flujo:
 *   1. navigator.onLine pasa a false → debounce 4s
 *   2. Si no reconecta → modal full-screen con blur, NO dismissable
 *   3. Si reconecta → modal desaparece automáticamente
 *
 * AISLADO: no importa AuthContext, Supabase ni hooks complejos.
 *
 * Aspecto del rediseño (B3, maqueta `capas-b/vista-3-error`, «Sin conexión»):
 * la alerta del patrón único (CALMA §13) con su EXCEPCIÓN APROBADA: sin botones,
 * no se puede descartar (Esc no la cierra) y se va sola al volver la red. El
 * velo cubre toda la pantalla; la tarjeta se centra en el ÁREA DE CONTENIDO
 * (nunca bajo la franja ni encima de la navegación). Entra y sale por el mismo
 * camino: velo que funde y tarjeta que escala .96 → 1.
 */

/* Lo que tarda la salida (`--dur-sale`): la alerta sigue montada ese rato. */
const SALIDA_MS = 240

type Fase = 'oculta' | 'visible' | 'saliendo'

/* El ciclo de la alerta: aparece tras 4 s sin red y, al volver, sale animada. */
function useFaseSinConexion(): Fase {
  const [fase, setFase] = useState<Fase>('oculta')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function limpiar() {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    }
    function handleOffline() {
      limpiar()
      // Si la red se va otra vez a media salida, la alerta se quita ya y
      // vuelve a esperar sus 4 s: nunca se queda un velo invisible encima.
      setFase(f => (f === 'saliendo' ? 'oculta' : f))
      timerRef.current = setTimeout(() => setFase('visible'), 4000)
    }
    function handleOnline() {
      limpiar()
      setFase(f => (f === 'visible' ? 'saliendo' : f))
      timerRef.current = setTimeout(() => setFase(f => (f === 'saliendo' ? 'oculta' : f)), SALIDA_MS)
    }

    if (!navigator.onLine) handleOffline()

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      limpiar()
    }
  }, [])

  return fase
}

/* El foco va a la tarjeta al aparecer y vuelve a donde estaba al irse. */
function useFocoDeAlerta(visible: boolean) {
  const tarjeta = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!visible) return
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    tarjeta.current?.focus()
    return () => { previo?.focus() }
  }, [visible])
  return tarjeta
}

export default function OfflineAlert() {
  const fase = useFaseSinConexion()
  const tarjeta = useFocoDeAlerta(fase === 'visible')

  if (fase === 'oculta') return null
  const sale = fase === 'saliendo' ? '' : undefined

  return (
    /* `--z-sin-conexion`: encima de capas y cromo; el aviso breve, aún encima. */
    <div className="fixed inset-0 z-[var(--z-sin-conexion)] data-[sale]:pointer-events-none" data-sale={sale}>
      <div
        data-sale={sale}
        className="absolute inset-0 bg-[var(--velo)] [backdrop-filter:var(--velo-filtro)] [-webkit-backdrop-filter:var(--velo-filtro)] transition-opacity duration-[var(--dur-entra)] ease-[var(--resorte-entra)] starting:opacity-0 data-[sale]:opacity-0 data-[sale]:duration-[var(--dur-sale)]"
      />
      {/* El área de contenido es la de las capas (`--capa-*`, que leen los
          `--cromo-*`): sin números de la navegación aquí. */}
      <div className="absolute flex items-center justify-center top-[var(--capa-arr)] right-[var(--capa-der)] bottom-[var(--capa-abj)] left-[var(--capa-izq)]">
        <div
          ref={tarjeta}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="sin-conexion-titulo"
          aria-describedby="sin-conexion-texto"
          tabIndex={-1}
          data-sale={sale}
          className={[
            'flex w-[320px] max-w-full flex-col items-center rounded-[var(--r-tarjeta-ancha)] bg-sup p-6 text-center shadow-[var(--sombra-capa)] outline-none',
            'ext:w-[310px] ih:w-[340px] iv:w-[340px] esc:w-[340px]',
            'transition-[scale,opacity] duration-[var(--dur-entra)] ease-[var(--resorte-entra)]',
            '[--escala:.96] motion-reduce:[--escala:1]',
            'starting:scale-[var(--escala)] starting:opacity-0',
            'data-[sale]:scale-[var(--escala)] data-[sale]:opacity-0',
            'data-[sale]:duration-[var(--dur-sale)] data-[sale]:ease-[var(--resorte-sale)]',
          ].join(' ')}
        >
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-aviso-fondo text-aviso-tinta">
            <WifiOff size={28} aria-hidden="true" />
          </span>
          <h2 id="sin-conexion-titulo" className="text-[17px] leading-[22px] font-bold text-tinta">Sin conexión</h2>
          <p id="sin-conexion-texto" className="mt-1.5 text-[14px] leading-5 text-tinta2 text-justify hyphens-auto">
            No se detecta conexión o es de mala calidad. Espera a que se estabilice la red.
          </p>
          <div className="mt-3.5 flex items-center justify-center gap-2 text-[13px] leading-[18px] text-tinta2">
            <Loader2 size={14} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            <span>Esperando reconexión...</span>
          </div>
        </div>
      </div>
    </div>
  )
}
