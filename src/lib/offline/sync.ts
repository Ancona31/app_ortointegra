/**
 * Sync-Bridge — Motor de reconciliación offline → Supabase.
 *
 * Este es el ÚNICO archivo del módulo offline que importa Supabase.
 * Solo se ejecuta cuando hay red disponible.
 *
 * Flujo:
 * 1. Leer pacientes pending → buscar duplicados → crear o mapear ID
 * 2. Leer documentos pending → resolver temp_patient_id → crear en Supabase
 * 3. Marcar registros como synced o error
 */

import { createClient } from '@/lib/supabase/client'
import { toTitleCase } from '@/lib/patientUtils'
import {
  getPendingPatients, getPendingDocuments,
  updatePatientStatus, updateDocumentStatus,
} from './db'
import type { SyncResult } from './types'

export async function syncOfflineVault(medicoId?: string): Promise<SyncResult> {
  const supabase = createClient()
  const result: SyncResult = {
    patients: { total: 0, synced: 0, errors: 0 },
    documents: { total: 0, synced: 0, errors: 0 },
  }

  // ── Paso 1: Sincronizar pacientes ──
  const pendingPatients = await getPendingPatients(medicoId)
  result.patients.total = pendingPatients.length

  const idMap = new Map<string, string>() // temp_id → real_id

  for (const patient of pendingPatients) {
    try {
      const nombreNorm = toTitleCase(patient.nombre)
      const apellidosNorm = toTitleCase(patient.apellidos)

      // Buscar duplicado por nombre + apellidos + fecha_nacimiento
      const { data: existing } = await supabase
        .from('pacientes')
        .select('id')
        .ilike('nombre', nombreNorm)
        .ilike('apellidos', apellidosNorm)
        .eq('fecha_nacimiento', patient.fecha_nacimiento)
        .neq('activo', false)
        .limit(1)

      if (existing && existing.length > 0) {
        // Paciente ya existe → mapear sin crear duplicado
        idMap.set(patient.id, existing[0].id)
        await updatePatientStatus(patient.id, 'synced', { _realId: existing[0].id })
        result.patients.synced++
        continue
      }

      // Paciente nuevo → crear via API
      const res = await fetch('/api/pacientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombreNorm,
          apellidos: apellidosNorm,
          fecha_nacimiento: patient.fecha_nacimiento,
          sexo: patient.sexo,
          telefono: patient.telefono,
          email: patient.email,
          consentimiento_otorgado: true,
          forceCreate: true, // Skip duplicate warning
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown' }))
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      const data = await res.json() as { id: string }
      idMap.set(patient.id, data.id)
      await updatePatientStatus(patient.id, 'synced', { _realId: data.id })
      result.patients.synced++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      await updatePatientStatus(patient.id, 'error', { _syncError: message })
      result.patients.errors++
    }
  }

  // ── Paso 2: Sincronizar documentos ──
  const pendingDocs = await getPendingDocuments(medicoId)
  result.documents.total = pendingDocs.length

  for (const doc of pendingDocs) {
    try {
      // Resolver temp_patient_id → real_id
      const realPatientId = idMap.get(doc.temp_patient_id)
      if (!realPatientId) {
        throw new Error('Paciente no sincronizado aún')
      }

      const { error } = await supabase.from('documentos').insert({
        tipo: doc.tipo === 'nota_medica' ? 'informe_clinico' : doc.tipo,
        contenido: doc.contenido,
        paciente_id: realPatientId,
        client_id: doc.id, // Idempotencia
      })

      if (error) throw new Error(error.message)

      await updateDocumentStatus(doc.id, 'synced')
      result.documents.synced++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      await updateDocumentStatus(doc.id, 'error', { _syncError: message })
      result.documents.errors++
    }
  }

  return result
}
