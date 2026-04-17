/**
 * Tipos del módulo Offline-Mode (Búnker Sidecar).
 * AISLADO: cero imports de Supabase, AuthContext o componentes de (app).
 */

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
  tipo: 'receta' | 'nota_medica' | 'solicitud_lab' | 'solicitud_imagen'
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

export interface SyncResult {
  patients: { total: number; synced: number; errors: number }
  documents: { total: number; synced: number; errors: number }
}
