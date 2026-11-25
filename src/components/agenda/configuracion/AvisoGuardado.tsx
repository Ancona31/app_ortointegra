'use client'

/**
 * El aviso «Guardado» de la configuración (tanda J, J5, punto 14). SÓLO sale
 * cuando el servidor contestó bien.
 *
 * Si el servidor dice que no, el mismo aviso sale en rojo con el motivo
 * (`role="alert"`) y dura más: el encargo pide un error visible, y la maqueta
 * no dibuja ninguno. Junto a cada control que falla queda además su valor
 * anterior (cada pestaña lo devuelve).
 *
 * B13 · AG9 (rediseño, CALMA §29.11 y maqueta `ag-config`): el aviso breve del catálogo —tarjeta `--sup` con el
 * icono en su círculo (palomita en `--ok-*`, tache en `--mal-*`)— ARRIBA Y CENTRADO EN EL ÁREA DE CONTENIDO, con
 * los bordes de las capas (`--capa-izq`/`--capa-der`, `--capa-aviso-arr`; los mismos de `ui/Toast.tsx`): nunca
 * bajo la navegación ni una franja del sistema, y en `ext`/`ih` sin tocar el borde derecho. «Guardado» dura 4 s,
 * como todo aviso de éxito; el error, 8 s (antes 1,8 y 6).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'

/** Cuánto se queda cada aviso: el éxito 4 s y el error 8 s, los del catálogo (`ui/Toast.tsx`). */
export const DURACION_AVISO_MS = { ok: 4000, error: 8000 } as const

export type EstadoAviso = { tipo: 'ok'; n: number } | { tipo: 'error'; texto: string; n: number } | null

/** El resultado de una escritura → el aviso. `n` vuelve a arrancar el reloj aunque el texto sea el mismo. */
export function useAvisoGuardado(): { aviso: EstadoAviso; avisar: (r: { ok: true } | { ok: false; motivo: string }) => void } {
  const [aviso, setAviso] = useState<EstadoAviso>(null)
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (reloj.current) clearTimeout(reloj.current) }, [])
  const avisar = useCallback((r: { ok: true } | { ok: false; motivo: string }) => {
    if (reloj.current) clearTimeout(reloj.current)
    setAviso(a => (r.ok ? { tipo: 'ok', n: (a?.n ?? 0) + 1 } : { tipo: 'error', texto: r.motivo, n: (a?.n ?? 0) + 1 }))
    reloj.current = setTimeout(() => setAviso(null), r.ok ? DURACION_AVISO_MS.ok : DURACION_AVISO_MS.error)
  }, [])
  return { aviso, avisar }
}

export default function AvisoGuardado({ aviso }: { aviso: EstadoAviso }) {
  /* La región «status» está SIEMPRE montada y sólo cambia su contenido: un lector de pantalla no anuncia una
     región viva que aparece ya llena. El error va con `role="alert"`, que sí se anuncia al aparecer. */
  const error = aviso?.tipo === 'error'
  return (
    <div role="status" aria-live="polite"
      className="pointer-events-none fixed left-[var(--capa-izq)] right-[var(--capa-der)] top-[var(--capa-aviso-arr)] z-[var(--z-aviso)] flex justify-center">
      {aviso && (
        <div role={error ? 'alert' : undefined} key={aviso.n} data-aviso-config={aviso.tipo}
          className="agc-aviso pointer-events-auto flex w-fit max-w-[400px] items-center gap-[10px] rounded-[14px] bg-sup py-[10px] pl-[10px] pr-[16px] shadow-[var(--sombra-capa)]">
          <span aria-hidden="true" className={`flex h-[28px] w-[28px] flex-none items-center justify-center rounded-full ${error ? 'bg-mal-fondo text-mal-tinta' : 'bg-ok-fondo text-ok-tinta'}`}>
            {error ? <X size={16} strokeWidth={2.5} /> : <Check size={16} strokeWidth={2.5} />}
          </span>
          <span className="min-w-0 text-[14px] font-semibold leading-[20px] text-tinta [overflow-wrap:anywhere]">{aviso.tipo === 'error' ? aviso.texto : 'Guardado'}</span>
        </div>
      )}
    </div>
  )
}
