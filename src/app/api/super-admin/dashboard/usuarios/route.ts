/**
 * GET /api/super-admin/dashboard/usuarios
 *
 * Lista global de usuarios con conteos de consultas y badge de retención.
 * Filtros: q (nombre/email), rol, retencion. Cursor-based pagination.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import {
  calcularRetencion,
  type RetencionBadge,
  type Rol,
  type UsuarioGlobal,
  type UsuariosListResponse,
} from '@/lib/super-admin/types'

const PAGE_SIZE = 50

interface ProfileRowDb {
  id: string
  clinica_id: string | null
  role: string | null
  titulo: string | null
  nombres: string | null
  apellido_paterno: string | null
  apellido_materno: string | null
}

interface ClinicaRowDb {
  id: string
  nombre: string
}

interface ConsultaRowDb {
  id: string
  paciente_id: string
}

interface PacienteOwnerRowDb {
  id: string
  medico_id: string | null
}

function isRol(value: string | null): Rol {
  if (value === 'super_admin' || value === 'medico' || value === 'secretaria') {
    return value
  }
  return 'medico'
}

function parseRolFiltro(value: string | null): Rol | 'todos' {
  if (value === 'super_admin' || value === 'medico' || value === 'secretaria') {
    return value
  }
  return 'todos'
}

function parseRetencionFiltro(value: string | null): RetencionBadge | 'todos' {
  if (
    value === 'activo_7d' ||
    value === 'tibio_14d' ||
    value === 'frio_30d' ||
    value === 'inactivo'
  ) {
    return value
  }
  return 'todos'
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

  await logAudit({
    userId: auth.user.id,
    accion: 'sa_ver_dashboard',
    descripcion: 'usuarios',
  })

  try {
    const url = new URL(req.url)
    const q = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
    const rolFiltro = parseRolFiltro(url.searchParams.get('rol'))
    const retencionFiltro = parseRetencionFiltro(url.searchParams.get('retencion'))
    const cursor = url.searchParams.get('cursor')

    const admin = createAdminClient()

    let profilesQuery = admin
      .from('profiles')
      .select('id, clinica_id, role, titulo, nombres, apellido_paterno, apellido_materno')
      .order('id', { ascending: true })
      .limit(PAGE_SIZE + 1)

    if (rolFiltro !== 'todos') profilesQuery = profilesQuery.eq('role', rolFiltro)
    if (cursor) profilesQuery = profilesQuery.gt('id', cursor)

    const profilesRes = await profilesQuery
    if (profilesRes.error) throw new Error(profilesRes.error.message)

    const rawProfiles = (profilesRes.data ?? []) as ProfileRowDb[]
    const hasMore = rawProfiles.length > PAGE_SIZE
    const pageProfiles = hasMore ? rawProfiles.slice(0, PAGE_SIZE) : rawProfiles
    if (pageProfiles.length === 0) {
      return NextResponse.json({ items: [], nextCursor: null })
    }

    const clinicaIds = Array.from(
      new Set(pageProfiles.map((p) => p.clinica_id).filter((id): id is string => id !== null)),
    )
    const profileIds = pageProfiles.map((p) => p.id)

    const [clinicasRes, authRes, pacientesRes] = await Promise.all([
      clinicaIds.length > 0
        ? admin.from('clinicas').select('id, nombre').in('id', clinicaIds)
        : Promise.resolve({ data: [], error: null }),
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin.from('pacientes').select('id, medico_id').in('medico_id', profileIds),
    ])
    if (clinicasRes.error) throw new Error(clinicasRes.error.message)
    if (authRes.error) throw new Error(authRes.error.message)
    if (pacientesRes.error) throw new Error(pacientesRes.error.message)

    const clinicas: ClinicaRowDb[] = ((clinicasRes.data ?? []) as Array<{
      id: string
      nombre: string
    }>).map((c) => ({ id: c.id, nombre: c.nombre }))
    const clinicaNombrePorId = new Map<string, string>(clinicas.map((c) => [c.id, c.nombre]))

    const pacientes: PacienteOwnerRowDb[] = (pacientesRes.data ?? []).map((p) => ({
      id: String(p.id),
      medico_id: p.medico_id === null ? null : String(p.medico_id),
    }))

    // Consultas asociadas a estos pacientes (= consultas de estos médicos)
    const pacienteIds = pacientes.map((p) => p.id)
    let consultasRows: ConsultaRowDb[] = []
    if (pacienteIds.length > 0) {
      const consultasRes = await admin
        .from('consultas')
        .select('id, paciente_id')
        .in('paciente_id', pacienteIds)
      if (consultasRes.error) throw new Error(consultasRes.error.message)
      consultasRows = (consultasRes.data ?? []).map((c) => ({
        id: String(c.id),
        paciente_id: String(c.paciente_id),
      }))
    }

    const pacienteToMedico = new Map<string, string>()
    for (const p of pacientes) {
      if (p.medico_id) pacienteToMedico.set(p.id, p.medico_id)
    }
    const consultasPorMedico = new Map<string, number>()
    for (const c of consultasRows) {
      const medico = pacienteToMedico.get(c.paciente_id)
      if (!medico) continue
      consultasPorMedico.set(medico, (consultasPorMedico.get(medico) ?? 0) + 1)
    }

    const authByProfileId = new Map<
      string,
      { email: string; last_sign_in_at: string | null }
    >()
    for (const u of authRes.data.users) {
      authByProfileId.set(u.id, {
        email: u.email ?? '',
        last_sign_in_at: u.last_sign_in_at ?? null,
      })
    }

    const items: UsuarioGlobal[] = pageProfiles.map((p) => {
      const a = authByProfileId.get(p.id)
      const ultimoLoginIso = a?.last_sign_in_at ?? null
      return {
        id: p.id,
        nombre: componerNombreMedicoCompleto({
          titulo: p.titulo, nombres: p.nombres,
          apellido_paterno: p.apellido_paterno, apellido_materno: p.apellido_materno,
        }),
        email: a?.email ?? '',
        rol: isRol(p.role),
        clinicaId: p.clinica_id,
        clinicaNombre: p.clinica_id ? clinicaNombrePorId.get(p.clinica_id) ?? null : null,
        ultimoLoginIso,
        consultasGeneradas: consultasPorMedico.get(p.id) ?? 0,
        retencion: calcularRetencion(ultimoLoginIso),
      }
    })

    const filtered = items.filter((it) => {
      if (retencionFiltro !== 'todos' && it.retencion !== retencionFiltro) return false
      if (q) {
        const ql = q
        if (!it.nombre.toLowerCase().includes(ql) && !it.email.toLowerCase().includes(ql)) {
          return false
        }
      }
      return true
    })

    const nextCursor: string | null =
      hasMore && pageProfiles.length > 0 ? pageProfiles[pageProfiles.length - 1].id : null

    const body: UsuariosListResponse = { items: filtered, nextCursor }
    return NextResponse.json(body)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
