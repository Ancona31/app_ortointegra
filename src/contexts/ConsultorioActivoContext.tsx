'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react'
import { Consultorio } from '@/types'
import { useConsultorios } from '@/hooks/useConsultorios'

const STORAGE_KEY = 'consultorio_activo_id'

type ConsultorioActivoContextType = {
  consultorioActivo: Consultorio | null
  cambiarActivo: (consultorio: Consultorio) => void
  isLoading: boolean
}

const ConsultorioActivoContext = createContext<ConsultorioActivoContextType | null>(null)

/**
 * Provider del "consultorio activo del cliente".
 *
 * Mantiene en sessionStorage solo el ID del consultorio activo. La hidratación
 * y la reconciliación viven aquí:
 * - Si sessionStorage tiene un ID que coincide con un consultorio activo del
 *   hook → ese es el activo.
 * - Si el ID no coincide (archivado, otro usuario logueado, etc.) o no hay ID
 *   en sessionStorage → cae a consultorioDefault.
 * - Si no hay consultorios (0 activos) → consultorioActivo = null.
 *
 * sessionStorage solo en useEffect (evita hydration mismatch en SSR).
 * Accesos a sessionStorage envueltos en try/catch (patrón defensivo del repo,
 * ver auth-context.tsx:180-182): previene crash en Safari modo privado y
 * QuotaExceededError.
 */
export function ConsultorioActivoProvider({ children }: { children: ReactNode }) {
  const { consultorios, consultorioDefault, isLoading } = useConsultorios()
  const [activoId, setActivoId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      setActivoId(stored)
    } catch {
      /* silent: storage no disponible o bloqueado */
    }
    setHydrated(true)
  }, [])

  const consultorioActivo = (() => {
    if (!hydrated || isLoading) return null
    if (activoId) {
      const match = consultorios.find(c => c.id === activoId)
      if (match) return match
    }
    return consultorioDefault
  })()

  const cambiarActivo = useCallback((consultorio: Consultorio) => {
    setActivoId(consultorio.id)
    try {
      sessionStorage.setItem(STORAGE_KEY, consultorio.id)
    } catch {
      /* silent: storage lleno o bloqueado; estado en memoria persiste */
    }
  }, [])

  const value = useMemo(
    () => ({
      consultorioActivo,
      cambiarActivo,
      isLoading: isLoading || !hydrated,
    }),
    [consultorioActivo, cambiarActivo, isLoading, hydrated],
  )

  return (
    <ConsultorioActivoContext.Provider value={value}>
      {children}
    </ConsultorioActivoContext.Provider>
  )
}

export function useConsultorioActivo() {
  const ctx = useContext(ConsultorioActivoContext)
  if (!ctx) {
    throw new Error('useConsultorioActivo debe usarse dentro de ConsultorioActivoProvider')
  }
  return ctx
}
