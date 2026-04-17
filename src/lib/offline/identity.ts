/**
 * Identity helper para el módulo Offline-Mode.
 *
 * Lee la identidad del médico desde spinus_session_meta en localStorage.
 * Este key lo escribe el AuthProvider de (app) cuando hay sesión activa.
 *
 * AISLADO: cero imports de Supabase, AuthContext o hooks de React.
 * Solo lectura directa de localStorage.
 */

import type { OfflineIdentity } from './types'

const SESSION_META_KEY = 'spinus_session_meta'

/**
 * Obtiene la identidad del médico desde localStorage.
 * Retorna null si nunca hizo login en este browser.
 */
export function getOfflineIdentity(): OfflineIdentity | null {
  try {
    const raw = localStorage.getItem(SESSION_META_KEY)
    if (!raw) return null
    const meta = JSON.parse(raw) as { userId?: string | null; email?: string | null }
    if (!meta.userId) return null
    return { userId: meta.userId, email: meta.email ?? '' }
  } catch {
    return null
  }
}

/**
 * Verifica si hay identidad disponible sin exponer datos.
 */
export function hasOfflineIdentity(): boolean {
  return getOfflineIdentity() !== null
}
