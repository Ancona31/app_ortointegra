/**
 * Sync-Bridge — Motor de reconciliación offline → Supabase.
 *
 * Flujo en 3 fases:
 *   1. Detectar matches: busca pacientes existentes con mismo nombre+fecha
 *   2. Resolver matches: el médico confirma cada match o crea nuevo
 *   3. Sincronizar documentos: resuelve temp_id → real_id y sube
 *
 * Este es el ÚNICO archivo del módulo offline que importa Supabase.
 */

import { createClient } from '@/lib/supabase/client'
import { toTitleCase } from '@/lib/patientUtils'
import {
  getPendingPatients, getPendingDocuments,
  updatePatientStatus, updateDocumentStatus,
  getAllPatients,
} from './db'
import type { SyncResult, PendingMatch } from './types'

/**
 * Fase 1: Detectar matches sin crear nada.
 * Retorna los pacientes que tienen coincidencia en Supabase
 * para que el médico confirme antes de vincular.
 */
export async function detectMatches(medicoId?: string): Promise<{
  matches: PendingMatch[]
  newPatients: string[]
}> {
  const supabase = createClient()
  const pendingPatients = await getPendingPatients(medicoId)
  const matches: PendingMatch[] = []
  const newPatients: string[] = []

  for (const patient of pendingPatients) {
    const nombreNorm = toTitleCase(patient.nombre)
    const apellidosNorm = toTitleCase(patient.apellidos)

    const { data: existing } = await supabase
      .from('pacientes')
      .select('id, numero_expediente')
      .ilike('nombre', nombreNorm)
      .ilike('apellidos', apellidosNorm)
      .eq('fecha_nacimiento', patient.fecha_nacimiento)
      .neq('activo', false)
      .limit(1)

    if (existing && existing.length > 0) {
      matches.push({
        tempId: patient.id,
        tempNombre: nombreNorm,
        tempApellidos: apellidosNorm,
        tempFechaNac: patient.fecha_nacimiento,
        existingId: existing[0].id,
        existingNumeroExpediente: existing[0].numero_expediente ?? null,
      })
    } else {
      newPatients.push(patient.id)
    }
  }

  return { matches, newPatients }
}

/**
 * Fase 2+3: Sincronizar con decisiones del médico ya tomadas.
 *
 * @param decisions — mapeo tempId → 'link' (vincular al existente) o 'create' (crear nuevo)
 */
export async function syncOfflineVault(
  medicoId?: string,
  decisions?: Map<string, 'link' | 'create'>,
): Promise<SyncResult> {
  const supabase = createClient()
  const result: SyncResult = {
    patients: { total: 0, synced: 0, errors: 0, matched: 0 },
    documents: { total: 0, synced: 0, errors: 0 },
    pendingMatches: [],
  }

  // ── Sincronizar pacientes ──
  const pendingPatients = await getPendingPatients(medicoId)
  result.patients.total = pendingPatients.length

  const idMap = new Map<string, string>()

  for (const patient of pendingPatients) {
    try {
      const nombreNorm = toTitleCase(patient.nombre)
      const apellidosNorm = toTitleCase(patient.apellidos)

      // Buscar duplicado
      const { data: existing } = await supabase
        .from('pacientes')
        .select('id, numero_expediente')
        .ilike('nombre', nombreNorm)
        .ilike('apellidos', apellidosNorm)
        .eq('fecha_nacimiento', patient.fecha_nacimiento)
        .neq('activo', false)
        .limit(1)

      if (existing && existing.length > 0) {
        const decision = decisions?.get(patient.id)

        if (!decision) {
          // Sin decisión → agregar a pendingMatches para que la UI pregunte
          result.pendingMatches.push({
            tempId: patient.id,
            tempNombre: nombreNorm,
            tempApellidos: apellidosNorm,
            tempFechaNac: patient.fecha_nacimiento,
            existingId: existing[0].id,
            existingNumeroExpediente: existing[0].numero_expediente ?? null,
          })
          continue
        }

        if (decision === 'link') {
          // Vincular al existente
          idMap.set(patient.id, existing[0].id)
          await updatePatientStatus(patient.id, 'synced', { _realId: existing[0].id })
          result.patients.synced++
          result.patients.matched++
          continue
        }

        // decision === 'create' → caer al flujo de creación abajo
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
          forceCreate: true,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown' }))
        throw new Error((err as { error?: string, message?: string }).message ?? (err as { error?: string }).error ?? `HTTP ${res.status}`)
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

  // Si hay matches pendientes, no sincronizar documentos de esos pacientes
  if (result.pendingMatches.length > 0) {
    return result
  }

  // Poblar idMap con pacientes ya synced de ejecuciones anteriores
  // (sus _realId se guardaron en IndexedDB al sincronizarse)
  const allPatients = await getAllPatients(medicoId)
  for (const p of allPatients) {
    if (p._syncStatus === 'synced' && p._realId && !idMap.has(p.id)) {
      idMap.set(p.id, p._realId)
    }
  }

  // ── Sincronizar documentos ──
  const pendingDocs = await getPendingDocuments(medicoId)
  result.documents.total = pendingDocs.length

  for (const doc of pendingDocs) {
    try {
      const realPatientId = idMap.get(doc.temp_patient_id)
      if (!realPatientId) {
        throw new Error('Paciente no sincronizado aún')
      }

      const contenido = doc.contenido as Record<string, unknown>

      if (doc.tipo === 'nota_medica') {
        const res = await fetch('/api/consultas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paciente_id: realPatientId,
            motivo_consulta: contenido.motivo_consulta ?? null,
            exploracion_fisica: contenido.exploracion_fisica ?? null,
            diagnosticos: contenido.diagnosticos
              ? [{ descripcion: contenido.diagnosticos as string }]
              : [],
            plan_tratamiento: contenido.plan_tratamiento ?? null,
            notas_evolucion: contenido.texto ?? null,
            proxima_cita: null,
            medicamentos: null,
            nota_origen: 'manual',
          }),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unknown' }))
          throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
        }
      } else {
        // 5.G Paso 1: bailout si el documento offline carece de identidad real
        // (medico_id = 'anonymous' fallback de getOfflineIdentity). No se puede
        // cumplir cadena de custodia (D-5.G-4) sin un UUID real; marcar 'error'
        // y saltar para que no se reintente en silencio.
        if (doc.medico_id === 'anonymous') {
          // eslint-disable-next-line no-console
          console.warn('[sync] Documento offline sin identidad real (anonymous):', doc.id)
          await updateDocumentStatus(doc.id, 'error', {
            _syncError: 'Documento sin identidad real (anonymous)',
          })
          result.documents.errors++
          continue
        }

        const { error } = await supabase.from('documentos').insert({
          tipo: doc.tipo,
          contenido,
          paciente_id: realPatientId,
          client_id: doc.id,
          subido_por: doc.medico_id,
        })

        if (error) throw new Error(error.message)
      }

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
