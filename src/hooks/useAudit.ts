'use client'

import { useEffect, useRef } from 'react'

/**
 * Hook para registrar acceso a datos clínicos (NOM-024-SSA3).
 * Llama al API de auditoría server-side una sola vez por recurso/sesión.
 *
 * El `fetch` va DENTRO del efecto a propósito. En el cuerpo del hook se
 * ejecutaba también durante el renderizado en servidor, donde una URL relativa
 * no resuelve y `fetch` lanza `TypeError` — es decir, el acceso no quedaba
 * registrado justo en la mitad de los casos. Un efecto solo corre en cliente.
 *
 * El ref guarda la última clave registrada, no un booleano: así se registra de
 * nuevo si cambia el recurso sin desmontar el componente, y a la vez se evita
 * el doble disparo del doble montaje de StrictMode en desarrollo.
 */
export function useAuditAccess(tabla: string, registroId: string | undefined): void {
  const registrado = useRef<string | null>(null)

  useEffect(() => {
    if (!registroId) return

    const clave = `${tabla}:${registroId}`
    if (registrado.current === clave) return
    registrado.current = clave

    // fire-and-forget — no bloquea el render
    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabla, registroId }),
    }).catch(() => {})
  }, [tabla, registroId])
}
