'use client'

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import type { SubscriptionState } from '@/lib/subscription'
import BloqueoFeatureModal from './BloqueoFeatureModal'

type SubscriptionGateContextValue = {
  state: SubscriptionState
  openBloqueoModal: () => void
  closeModal: () => void
  isOpen: boolean
}

const SubscriptionGateContext =
  createContext<SubscriptionGateContextValue | null>(null)

/**
 * SubscriptionGateProvider — fuente única de verdad para la UX de bloqueo
 * Fase 8.2. NO hace fetch propio: recibe `initialState` calculado en el
 * server-side por `getSubscriptionState` desde el layout. Esto elimina
 * waterfalls cliente-servidor y garantiza que el banner y los intercepts
 * usen exactamente los mismos datos.
 *
 * Renderiza el BloqueoFeatureModal una sola vez como hijo del Provider.
 * Cualquier consumer puede invocar `openBloqueoModal()` para mostrarlo.
 */
export function SubscriptionGateProvider({
  initialState,
  children,
}: {
  initialState: SubscriptionState
  children: ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)

  const openBloqueoModal = useCallback(() => setIsOpen(true), [])
  const closeModal = useCallback(() => setIsOpen(false), [])

  const value: SubscriptionGateContextValue = {
    state: initialState,
    openBloqueoModal,
    closeModal,
    isOpen,
  }

  return (
    <SubscriptionGateContext.Provider value={value}>
      {children}
      <BloqueoFeatureModal
        isOpen={isOpen}
        onClose={closeModal}
        role={initialState.role}
        esAdminDeClinica={initialState.esAdminDeClinica}
      />
    </SubscriptionGateContext.Provider>
  )
}

export function useSubscriptionGate(): SubscriptionGateContextValue {
  const ctx = useContext(SubscriptionGateContext)
  if (!ctx) {
    throw new Error(
      'useSubscriptionGate debe usarse dentro de <SubscriptionGateProvider>',
    )
  }
  return ctx
}

type ClickHandler = (e: MouseEvent<HTMLElement>) => void

/**
 * useInterceptIfBlocked — devuelve un wrapper de onClick que, si la
 * suscripción está bloqueada, llama `e.preventDefault()` y abre el modal
 * en vez de ejecutar el handler original. Si NO está bloqueada, ejecuta
 * el handler original (o deja proceder el comportamiento default del
 * elemento — útil para `<Link>` sin onClick).
 *
 * Uso:
 *   const intercept = useInterceptIfBlocked()
 *   <button onClick={intercept(() => setOpen(true))} />
 *   <Link onClick={intercept()} href="/documentos" />
 */
export function useInterceptIfBlocked() {
  const { state, openBloqueoModal } = useSubscriptionGate()
  return useCallback(
    (originalHandler?: ClickHandler): ClickHandler => {
      return (e) => {
        if (state.isBlocked) {
          e.preventDefault()
          openBloqueoModal()
          return
        }
        originalHandler?.(e)
      }
    },
    [state.isBlocked, openBloqueoModal],
  )
}
