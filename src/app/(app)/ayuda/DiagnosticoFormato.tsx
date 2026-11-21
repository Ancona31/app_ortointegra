'use client'

/* TEMPORAL — se retira en B15.
   Línea de diagnóstico del formato de pantalla para comprobar en el iPhone Duo
   real lo que la sonda (`src/lib/formatoPantalla.ts`) no pudo verificar: que
   `screen.width/height` dan el tamaño total y cuánto valen los insets. Sólo
   medidas del aparato, ningún dato del usuario. Se calcula tras montar (en el
   servidor no existe) y se rehace con el evento de la sonda. */

import { useEffect, useState, type ReactElement } from 'react'
import { EVENTO_FORMATO, leerBordeSistema, leerFormato } from '@/lib/formatoPantalla'

function medirInsets(): string {
  const s = document.createElement('div')
  s.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;'
    + 'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)'
  document.body.appendChild(s)
  const c = getComputedStyle(s)
  const v = [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft].map(p => Math.round(parseFloat(p) || 0))
  s.remove()
  return `t${v[0]} r${v[1]} b${v[2]} l${v[3]}`
}

function linea(): string {
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  return [
    `formato ${leerFormato()}`,
    `borde ${leerBordeSistema()}`,
    `ventana ${window.innerWidth}×${window.innerHeight}`,
    `screen ${window.screen.width}×${window.screen.height}`,
    `insets ${medirInsets()}`,
    `dpr ${window.devicePixelRatio}`,
    `standalone ${standalone ? 'sí' : 'no'}`,
  ].join(' · ')
}

export default function DiagnosticoFormato(): ReactElement | null {
  const [texto, setTexto] = useState<string | null>(null)

  useEffect(() => {
    const actualizar = (): void => {
      try { setTexto(linea()) } catch { setTexto(null) }
    }
    actualizar()
    window.addEventListener(EVENTO_FORMATO, actualizar)
    window.addEventListener('resize', actualizar)
    return () => {
      window.removeEventListener(EVENTO_FORMATO, actualizar)
      window.removeEventListener('resize', actualizar)
    }
  }, [])

  if (!texto) return null
  return <p data-diagnostico-formato className="mt-6 text-center text-[11px] text-slate-400 break-words">{texto}</p>
}
