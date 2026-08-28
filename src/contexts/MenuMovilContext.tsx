'use client'

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'

type MenuMovilContextType = {
  /** ¿Está desplegado el menú lateral en móvil? */
  abierto: boolean
  abrir: () => void
  cerrar: () => void
  alternar: () => void
}

const MenuMovilContext = createContext<MenuMovilContextType | null>(null)

/**
 * El estado ABIERTO/CERRADO del menú lateral en móvil, y nada más.
 *
 * ⚠️ ESTE ESTADO VIVÍA DENTRO DE `Sidebar.tsx` Y SALIÓ EN EL BLOQUE 6. El motivo
 * es concreto: la agenda móvil sustituye el encabezado blanco por una banda azul
 * propia, y el hamburguesa pasa a estar DENTRO de esa banda —o sea, en un
 * componente que es HERMANO del `Sidebar`, no su hijo—. Con el estado local no
 * había forma de que un hermano lo tocara: la única alternativa sin contexto era
 * dejar el botón flotante del `Sidebar` encima de la banda, que es lo que el
 * rediseño viene a quitar.
 *
 * ⚠️ NO LE AÑADAS NADA MÁS. Es deliberadamente un booleano con sus tres verbos y
 * no «el contexto del layout»: en cuanto entre aquí una segunda cosa —la ruta
 * activa, el ancho, el tema— cualquier consumidor se re-renderiza cuando cambia
 * algo que no mira. Si hace falta otro estado compartido, otro contexto.
 *
 * ⚠️ EL VALOR VA MEMOIZADO Y LOS TRES VERBOS TAMBIÉN. Sin `useMemo` el objeto
 * sería nuevo en cada render del provider y re-renderizaría a TODOS los
 * consumidores; y el provider cuelga del layout de `(app)`, o sea de todas las
 * páginas autenticadas. Los `useCallback` van con deps vacías porque la forma
 * funcional de `setState` no necesita leer el valor anterior.
 */
export function MenuMovilProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  const abrir = useCallback(() => setAbierto(true), [])
  const cerrar = useCallback(() => setAbierto(false), [])
  const alternar = useCallback(() => setAbierto(v => !v), [])
  const valor = useMemo(
    () => ({ abierto, abrir, cerrar, alternar }),
    [abierto, abrir, cerrar, alternar],
  )
  return <MenuMovilContext.Provider value={valor}>{children}</MenuMovilContext.Provider>
}

/* Fallback silencioso sin Provider, con el mismo criterio que
   `ConsultorioActivoContext`: el grupo de rutas `(offline)` no monta el layout
   de `(app)` y por tanto tampoco este provider. Un `throw` defensivo ahí
   tumbaría una pantalla que no tiene menú lateral que abrir.
   `abierto: false` es el valor honesto: sin provider no hay menú. */
const FALLBACK_CTX: MenuMovilContextType = {
  abierto: false,
  abrir: () => {},
  cerrar: () => {},
  alternar: () => {},
}

export function useMenuMovil(): MenuMovilContextType {
  return useContext(MenuMovilContext) ?? FALLBACK_CTX
}
