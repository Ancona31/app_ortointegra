/**
 * Tipos y utilidades del módulo Offline-Mode (Búnker Sidecar).
 * AISLADO: cero imports de Supabase, AuthContext o componentes de (app).
 */

/**
 * Genera UUID v4. Usa crypto.randomUUID si disponible (Safari 15.4+),
 * fallback con crypto.getRandomValues para iOS < 15.4.
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback: UUID v4 con getRandomValues (Safari 11+)
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 1
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return [
    hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16),
    hex.slice(16, 20), hex.slice(20, 32),
  ].join('-')
}

export type SyncStatus = 'pending' | 'synced' | 'error'

export interface TempPatient {
  id: string
  nombre: string
  apellidos: string
  fecha_nacimiento: string
  sexo: 'M' | 'F' | null
  telefono: string | null
  email: string | null
  created_at: string
  medico_id: string
  _syncStatus: SyncStatus
  _syncError?: string
  _realId?: string
}

export interface TempDocument {
  id: string
  temp_patient_id: string
  tipo: 'receta' | 'nota_medica' | 'solicitud_lab' | 'solicitud_imagen' | 'plan_suplementacion' | 'nota_honorarios' | 'escrito_medico' | 'consentimiento_informado' | 'solicitud_internamiento'
  contenido: Record<string, unknown>
  created_at: string
  medico_id: string
  _syncStatus: SyncStatus
  _syncError?: string
}

export interface OfflineIdentity {
  userId: string
  email: string
}

export interface PendingMatch {
  tempId: string
  tempNombre: string
  tempApellidos: string
  tempFechaNac: string
  existingId: string
  existingNumeroExpediente: string | null
}

export interface SyncResult {
  patients: { total: number; synced: number; errors: number; matched: number }
  documents: { total: number; synced: number; errors: number }
  pendingMatches: PendingMatch[]
}
