/**
 * GET /api/super-admin/dashboard/legal
 *
 * §7 — Legal / ARCO:
 * - Solicitudes ARCO pendientes y recientes (tabla solicitudes_arco)
 * - Consentimientos informados firmados vs total de pacientes, por clínica
 * - Total de pacientes anonimizados (nombre LIKE 'PACIENTE-ANONIMIZADO%')
 *
 * La tabla solicitudes_arco se crea vía supabase_migration_solicitudes_arco.sql.
 * Si aún no existe, devuelve [] para esa sección y lo indica en el header X-Arco-Missing.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import type {
  ConsentimientoClinica,
  EstadoArco,
  LegalResponse,
  SolicitudArco,
  TipoArco,
} from '@/lib/super-admin/types'

interface ArcoRowDb {
  id: string
  clinica_id: string
  tipo: string
  estado: string
  descripcion: string | null
  fecha_solicitud: string
  fecha_limite: string | null
  fecha_resolucion: string | null
}

interface ClinicaRow {
  id: string
  nombre: string
}

interface DocumentoRow {
  paciente_id: string
  tipo: string
}

interface PacienteRow {
  id: string
  clinica_id: string | null
  nombre: string | null
}

function parseTipoArco(s: string): TipoArco {
  if (s === 'acceso' || s === 'rectificacion' || s === 'cancelacion' || s === 'oposicion') return s
  return 'acceso'
}

function parseEstadoArco(s: string): EstadoArco {
  if (s === 'pendiente' || s === 'en_proceso' || s === 'completada' || s === 'rechazada') return s
  return 'pendiente'
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  void req
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

  await logAudit({
    userId: auth.user.id,
    accion: 'sa_ver_legal',
    descripcion: 'panel legal / ARCO',
  })

  try {
    const admin = createAdminClient()

    // ── 1. Solicitudes ARCO ────────────────────────────────────────────
    let solicitudesArco: SolicitudArco[] = []
    let arcoMissing = false

    const arcoRes = await admin
      .from('solicitudes_arco')
      .select(
        'id, clinica_id, tipo, estado, descripcion, fecha_solicitud, fecha_limite, fecha_resolucion',
      )
      .order('fecha_solicitud', { ascending: false })
      .limit(100)

    if (arcoRes.error) {
      // La tabla aún no existe — migracion pendiente
      if (arcoRes.error.message.includes('does not exist') || arcoRes.error.code === '42P01') {
        arcoMissing = true
      } else {
        throw new Error(arcoRes.error.message)
      }
    }

    // ── 2. Nombres de clínicas en paralelo con el resto de queries ─────
    const [clinicasRes, pacientesRes] = await Promise.all([
      admin.from('clinicas').select('id, nombre'),
      admin.from('pacientes').select('id, clinica_id, nombre'),
    ])
    if (clinicasRes.error) throw new Error(clinicasRes.error.message)
    if (pacientesRes.error) throw new Error(pacientesRes.error.message)

    const clinicasAll = (clinicasRes.data ?? []) as ClinicaRow[]
    const clinicaNombrePorId = new Map<string, string>(clinicasAll.map((c) => [c.id, c.nombre]))

    const pacientesAll = (pacientesRes.data ?? []) as PacienteRow[]

    // ── 3. Documentos consentimiento_informado ─────────────────────────
    const pacienteIds = pacientesAll.map((p) => p.id)
    let documentosConConsentimiento: DocumentoRow[] = []
    if (pacienteIds.length > 0) {
      // Supabase has a 1000-item in() limit — chunk if needed
      const CHUNK = 900
      for (let i = 0; i < pacienteIds.length; i += CHUNK) {
        const chunk = pacienteIds.slice(i, i + CHUNK)
        const docRes = await admin
          .from('documentos')
          .select('paciente_id, tipo')
          .in('paciente_id', chunk)
          .eq('tipo', 'consentimiento_informado')
          // Un borrador NO es un consentimiento: es un formulario a medias, sin
          // folio y sin firma de nadie. Contarlo haría que este panel informara
          // como consentido a un paciente que no ha consentido nada — de los
          // tres consumidores del estado, este es el que más daño hace.
          .neq('estado', 'borrador')
        if (docRes.error) throw new Error(docRes.error.message)
        documentosConConsentimiento.push(...((docRes.data ?? []) as DocumentoRow[]))
      }
    }

    const pacientesConConsentimiento = new Set(
      documentosConConsentimiento.map((d) => d.paciente_id),
    )

    // ── 4. Agrupación por clínica ─────────────────────────────────────
    const totalPorClinica = new Map<string, number>()
    const conConsentimientoPorClinica = new Map<string, number>()
    let totalAnonimizados = 0

    for (const p of pacientesAll) {
      if (!p.clinica_id) continue
      totalPorClinica.set(p.clinica_id, (totalPorClinica.get(p.clinica_id) ?? 0) + 1)
      if (pacientesConConsentimiento.has(p.id)) {
        conConsentimientoPorClinica.set(
          p.clinica_id,
          (conConsentimientoPorClinica.get(p.clinica_id) ?? 0) + 1,
        )
      }
      if (p.nombre?.startsWith('PACIENTE-ANONIMIZADO')) {
        totalAnonimizados++
      }
    }

    const consentimientos: ConsentimientoClinica[] = clinicasAll
      .map((c): ConsentimientoClinica => {
        const total = totalPorClinica.get(c.id) ?? 0
        const con = conConsentimientoPorClinica.get(c.id) ?? 0
        return {
          clinicaId: c.id,
          clinicaNombre: c.nombre,
          totalPacientes: total,
          conConsentimiento: con,
          pct: total === 0 ? 0 : Math.round((con / total) * 1000) / 10,
        }
      })
      .filter((c) => c.totalPacientes > 0)
      .sort((a, b) => a.pct - b.pct) // Las más bajas arriba (más en riesgo)

    // ── 5. Mapear solicitudes ARCO ────────────────────────────────────
    if (!arcoMissing && arcoRes.data) {
      solicitudesArco = (arcoRes.data as ArcoRowDb[]).map((r) => ({
        id: r.id,
        clinicaId: r.clinica_id,
        clinicaNombre: clinicaNombrePorId.get(r.clinica_id) ?? null,
        tipo: parseTipoArco(r.tipo),
        estado: parseEstadoArco(r.estado),
        descripcion: r.descripcion,
        fechaSolicitudIso: r.fecha_solicitud,
        fechaLimiteIso: r.fecha_limite,
        fechaResolucionIso: r.fecha_resolucion,
      }))
    }

    const body: LegalResponse = { solicitudesArco, consentimientos, totalAnonimizados }
    const response = NextResponse.json(body)
    if (arcoMissing) {
      response.headers.set('X-Arco-Missing', '1')
    }
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
