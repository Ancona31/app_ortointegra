'use client'

import { useRef } from 'react'

/**
 * Hook para registrar acceso a datos clínicos (NOM-024-SSA3).
 * Llama al API de auditoría server-side una sola vez por recurso/sesión.
 */
export function useAuditAccess(tabla: string, registroId: string | undefined) {
  const logged = useRef(false)

  if (!logged.current && registroId) {
    logged.current = true
    // fire-and-forget — no bloquea el render
    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabla, registroId }),
    }).catch(() => {})
  }
}
