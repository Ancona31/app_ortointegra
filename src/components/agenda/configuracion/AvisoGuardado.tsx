'use client'

/**
 * El aviso «Guardado» de la configuración (tanda J, J5, punto 14; maqueta
 * `Configuracion.dc.html`): una píldora oscura abajo al centro, con su
 * palomita, que dura 1,8 s. SÓLO sale cuando el servidor contestó bien.
 *
 * Si el servidor dice que no, la misma píldora sale en rojo con el motivo
 * (`role="alert"`) y dura más: el encargo pide un error visible, y la maqueta
 * no dibuja ninguno. Junto a cada control que falla queda además su valor
 * anterior (cada pestaña lo devuelve).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'

export type EstadoAviso = { tipo: 'ok'; n: number } | { tipo: 'error'; texto: string; n: number } | null

/** El resultado de una escritura → el aviso. `n` vuelve a arrancar el reloj aunque el texto sea el mismo. */
export function useAvisoGuardado(): { aviso: EstadoAviso; avisar: (r: { ok: true } | { ok: false; motivo: string }) => void } {
  const [aviso, setAviso] = useState<EstadoAviso>(null)
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (reloj.current) clearTimeout(reloj.current) }, [])
  const avisar = useCallback((r: { ok: true } | { ok: false; motivo: string }) => {
    if (reloj.current) clearTimeout(reloj.current)
    setAviso(a => (r.ok ? { tipo: 'ok', n: (a?.n ?? 0) + 1 } : { tipo: 'error', texto: r.motivo, n: (a?.n ?? 0) + 1 }))
    reloj.current = setTimeout(() => setAviso(null), r.ok ? 1800 : 6000)
  }, [])
  return { aviso, avisar }
}

export default function AvisoGuardado({ aviso }: { aviso: EstadoAviso }) {
  /* La región «status» está SIEMPRE montada y sólo cambia su contenido: un lector de pantalla no anuncia una
     región viva que aparece ya llena. El error va con `role="alert"`, que sí se anuncia al aparecer. */
  const error = aviso?.tipo === 'error'
  return (
    <div role="status" aria-live="polite">
      {aviso && (
        <div role={error ? 'alert' : undefined} key={aviso.n} data-aviso-config={aviso.tipo}
          className={`fixed bottom-[28px] left-1/2 z-[70] inline-flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-[8px] rounded-full px-[20px] sm:px-[16px] py-[12px] text-[14px] font-semibold shadow-[var(--ag-shadow-pop)] ${error
            ? 'bg-[var(--ag-status-cancelled-text)] text-white' : 'bg-[var(--ag-ink)] text-[var(--ag-surface)]'}`}>
          {!error && <Check size={18} strokeWidth={2.5} aria-hidden="true" />}
          {aviso.tipo === 'error' ? aviso.texto : 'Guardado'}
        </div>
      )}
    </div>
  )
}
