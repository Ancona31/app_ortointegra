'use client'

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import Portal from '@/components/ui/Portal'

/* ═══ EL MENÚ «MÁS» (`ext` e `iv`) — B4 del rediseño ════════════════════════
 *
 * Tarjeta centrada en el ÁREA DE CONTENIDO (sin el riel ni la franja), con el
 * velo desenfocado detrás (CALMA §26, §28). La abren «···» del riel y la
 * píldora «Más» del encabezado de `iv`. Lo que lleva dentro lo decide
 * `Sidebar.tsx` y llega como `children`: esto sólo es la capa.
 *
 * ⚠️ NO ES `ui/CapaMenu.tsx`, Y NO POR OLVIDO (integración B1–B4). CapaMenu
 * sólo pinta una lista de opciones-botón; «Más» lleva la tarjeta ámbar de
 * pendientes, la fila «Consultorio activo» que despliega su lista dentro, ENLACES
 * de verdad (Administración, Mi perfil, Ayuda; el Aviso de Privacidad en pestaña
 * nueva con `noopener`) y «Cerrar sesión» girando mientras se audita. Pasarlo
 * exigiría ampliar la API de CapaMenu, y eso no se hace sin un plan. Por eso el
 * mismo dibujo (velo, tarjeta, salida) vive aquí a mano.
 *
 * ⚠️ SÓLO SE MONTA ABIERTA (y mientras sale). Cerrada no deja nodos: así sus
 * textos —«Cerrar sesión», el aviso de pendientes— no aparecen dos veces en el
 * documento junto a los de la barra.
 *
 * Movimiento: entra del centro (escala .96 → 1 + fundido) y sale por el mismo
 * camino, más rápido; sólo `transform` y `opacity`. Con movimiento reducido,
 * fundido corto (`globals.css`). La salida termina en `animationend`.
 */

interface Props {
  abierto: boolean
  alCerrar: () => void
  titulo: string
  children: ReactNode
}

/** Esc cierra y, al cerrar, el foco vuelve a quien abrió. (Entrar en la
 *  tarjeta lo hace su `ref`: va en un portal que se monta un render después.) */
function useEscapeYRetorno(abierto: boolean, alCerrar: () => void) {
  /* El cierre va por `ref` para que el efecto dependa SÓLO de `abierto`: si
     dependiera de una función que cambia en cada render, su limpieza correría
     en cada render y devolvería el foco a quien abrió con el menú abierto. */
  const cerrar = useRef(alCerrar)
  useEffect(() => { cerrar.current = alCerrar })
  useEffect(() => {
    if (!abierto) return
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar.current() }
    document.addEventListener('keydown', tecla)
    return () => { document.removeEventListener('keydown', tecla); previo?.focus() }
  }, [abierto])
}

export default function MenuMas({ abierto, alCerrar, titulo, children }: Props) {
  const idTitulo = useId()
  /* Estable a propósito: un `ref` en línea se volvería a llamar en cada render
     y robaría el foco a lo que se esté pulsando dentro. */
  const enfocar = useCallback((n: HTMLDivElement | null) => { n?.focus() }, [])
  /* Montada = abierta o saliendo. Se ajusta DURANTE el render (patrón de React
     para derivar estado de una prop), no en un efecto. */
  const [montada, setMontada] = useState(abierto)
  if (abierto && !montada) setMontada(true)
  useEscapeYRetorno(abierto, alCerrar)
  if (!montada) return null
  const fase = abierto ? 'entra' : 'sale'
  return (
    <Portal>
      <div className="nav-capa" data-fase={fase}
        onAnimationEnd={e => { if (!abierto && e.target === e.currentTarget) setMontada(false) }}>
        <div className="nav-capa-velo" onClick={alCerrar} aria-hidden="true" />
        <div ref={enfocar} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={idTitulo}
          className="nav-capa-tarjeta">
          <h2 id={idTitulo} className="nav-capa-titulo">{titulo}</h2>
          {children}
        </div>
      </div>
    </Portal>
  )
}
