/**
 * GET /api/super-admin/dashboard/clinicas
 *
 * Lista paginada de clínicas con conteos, último acceso y estado.
 * Filtros server-side: q, tipo, plan, estado.
 * Cursor-based pagination.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import {
  type ClinicaResumen,
  type ClinicasListResponse,
  type EstadoClinica,
  type EstadoPago,
  type TipoCuenta,
} from '@/lib/super-admin/types'

const PAGE_SIZE = 50
const MS_DAY = 86_400_000

interface ClinicaRowDb {
  id: string
  nombre: string
  nombre_display: string | null
  logo_url: string | null
  tipo: string | null
  plan: string | null
  max_medicos: number | null
  max_secretarias: number | null
  max_pacientes: number | null
  suspendida: boolean | null
  suscripcion_estado: string | null
  stripe_subscription_id: string | null
  created_at: string
}

interface ProfileRowDb {
  id: string
  clinica_id: string | null
  role: string | null
}

interface PacienteRowDb {
  id: string
  clinica_id: string | null
}

interface ConsultaRowDb {
  id: string
  paciente_id: string
}

function parseTipoFiltro(value: string | null): TipoCuenta | 'todos' {
  if (value === 'clinica' || value === 'independiente') return value
  return 'todos'
}

function parsePlanFiltro(value: string | null): EstadoPago | 'todos' {
  const allowed: ReadonlyArray<EstadoPago> = [
    'gratuito',
    'trial',
    'pagando',
    'vip',
    'pago_fallido',
    'cancelado',
  ]
  if (value !== null && (allowed as ReadonlyArray<string>).includes(value)) {
    return value as EstadoPago
  }
  return 'todos'
}

function parseEstadoFiltro(value: string | null): EstadoClinica | 'todos' {
  if (value === 'activa' || value === 'suspendida' || value === 'inactiva') return value
  return 'todos'
}

function clasificarTipo(raw: string | null): TipoCuenta {
  return raw === 'independiente' ? 'independiente' : 'clinica'
}

function clasificarPago(row: ClinicaRowDb): EstadoPago {
  // VIP siempre gana
  if (row.max_pacientes === null) return 'vip'
  // Sin suscripción real de Stripe = gratuito (default seguro)
  if (!row.stripe_subscription_id) return 'gratuito'
  // Plan explícitamente 'free' = gratuito aunque haya un id viejo
  if (!row.plan || row.plan === 'free') return 'gratuito'
  // Estado real de la suscripción
  const estado = row.suscripcion_estado
  if (estado === 'trial') return 'trial'
  if (estado === 'activo') return 'pagando'
  if (estado === 'vencido') return 'pago_fallido'
  if (estado === 'cancelado') return 'cancelado'
  return 'gratuito'
}

function clasificarEstado(suspendida: boolean, ultimoAccesoIso: string | null): EstadoClinica {
  if (suspendida) return 'suspendida'
  if (!ultimoAccesoIso) return 'inactiva'
  const dias = (Date.now() - new Date(ultimoAccesoIso).getTime()) / MS_DAY
  if (dias > 30) return 'inactiva'
  return 'activa'
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

  await logAudit({
    userId: auth.user.id,
    accion: 'sa_ver_dashboard',
    descripcion: 'clinicas',
  })

  try {
    const url = new URL(req.url)
    const q = url.searchParams.get('q')?.trim() ?? ''
    const tipoFiltro = parseTipoFiltro(url.searchParams.get('tipo'))
    const planFiltro = parsePlanFiltro(url.searchParams.get('plan'))
    const estadoFiltro = parseEstadoFiltro(url.searchParams.get('estado'))
    const cursor = url.searchParams.get('cursor')

    const admin = createAdminClient()

    // Base query con filtros server-side de DB
    let clinicasQuery = admin
      .from('clinicas')
      .select(
        'id, nombre, nombre_display, logo_url, tipo, plan, max_medicos, max_secretarias, max_pacientes, suspendida, suscripcion_estado, stripe_subscription_id, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE + 1)

    if (q) {
      clinicasQuery = clinicasQuery.ilike('nombre', `%${q}%`)
    }
    if (tipoFiltro !== 'todos') {
      clinicasQuery = clinicasQuery.eq('tipo', tipoFiltro)
    }
    if (cursor) {
      clinicasQuery = clinicasQuery.lt('created_at', cursor)
    }

    const clinicasRes = await clinicasQuery
    if (clinicasRes.error) throw new Error(clinicasRes.error.message)

    const rawRows = (clinicasRes.data ?? []) as ClinicaRowDb[]
    const hasMore = rawRows.length > PAGE_SIZE
    const pageRows = hasMore ? rawRows.slice(0, PAGE_SIZE) : rawRows
    if (pageRows.length === 0) {
      return NextResponse.json({ items: [], nextCursor: null })
    }

    const clinicaIds = pageRows.map((r) => r.id)

    // Profiles, pacientes, auth users en paralelo
    const [profilesRes, pacientesRes, authRes] = await Promise.all([
      admin.from('profiles').select('id, clinica_id, role').in('clinica_id', clinicaIds),
      admin.from('pacientes').select('id, clinica_id').in('clinica_id', clinicaIds),
      admin.auth.admin.listUsers({ perPage: 1000 }),
    ])
    if (profilesRes.error) throw new Error(profilesRes.error.message)
    if (pacientesRes.error) throw new Error(pacientesRes.error.message)
    if (authRes.error) throw new Error(authRes.error.message)

    const profiles: ProfileRowDb[] = (profilesRes.data ?? []).map((p) => ({
      id: String(p.id),
      clinica_id: p.clinica_id === null ? null : String(p.clinica_id),
      role: p.role === null ? null : String(p.role),
    }))
    const pacientes: PacienteRowDb[] = (pacientesRes.data ?? []).map((p) => ({
      id: String(p.id),
      clinica_id: p.clinica_id === null ? null : String(p.clinica_id),
    }))

    // Consultas: necesitamos contar por clínica → fetch via paciente_ids
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

    // Mapas de agregación
    const medicosByClinica = new Map<string, number>()
    const secretariasByClinica = new Map<string, number>()
    const profileToClinica = new Map<string, string>()
    const lastSignByClinica = new Map<string, string>()

    for (const p of profiles) {
      if (!p.clinica_id) continue
      profileToClinica.set(p.id, p.clinica_id)
      if (p.role === 'medico' || p.role === 'admin') {
        medicosByClinica.set(p.clinica_id, (medicosByClinica.get(p.clinica_id) ?? 0) + 1)
      }
      if (p.role === 'secretaria') {
        secretariasByClinica.set(
          p.clinica_id,
          (secretariasByClinica.get(p.clinica_id) ?? 0) + 1,
        )
      }
    }

    for (const u of authRes.data.users) {
      const clinicaId = profileToClinica.get(u.id)
      if (!clinicaId) continue
      if (!u.last_sign_in_at) continue
      const prev = lastSignByClinica.get(clinicaId)
      if (!prev || u.last_sign_in_at > prev) {
        lastSignByClinica.set(clinicaId, u.last_sign_in_at)
      }
    }

    const pacientesByClinica = new Map<string, number>()
    for (const p of pacientes) {
      if (!p.clinica_id) continue
      pacientesByClinica.set(p.clinica_id, (pacientesByClinica.get(p.clinica_id) ?? 0) + 1)
    }

    // Map paciente_id → clinica_id, luego consultas → clinica
    const pacienteToClinica = new Map<string, string>()
    for (const p of pacientes) {
      if (p.clinica_id) pacienteToClinica.set(p.id, p.clinica_id)
    }
    const consultasByClinica = new Map<string, number>()
    for (const c of consultasRows) {
      const cli = pacienteToClinica.get(c.paciente_id)
      if (!cli) continue
      consultasByClinica.set(cli, (consultasByClinica.get(cli) ?? 0) + 1)
    }

    // Construir items
    const itemsBuilt: ClinicaResumen[] = pageRows.map((row) => {
      const ultimoAccesoIso = lastSignByClinica.get(row.id) ?? null
      const tipo = clasificarTipo(row.tipo)
      const estadoPago = clasificarPago(row)
      const estado = clasificarEstado(row.suspendida === true, ultimoAccesoIso)
      return {
        id: row.id,
        nombre: row.nombre,
        nombreDisplay: row.nombre_display,
        logoUrl: row.logo_url,
        tipo,
        plan: row.plan,
        estadoPago,
        esVip: row.max_pacientes === null,
        maxMedicos: row.max_medicos ?? 0,
        countMedicos: medicosByClinica.get(row.id) ?? 0,
        maxSecretarias: row.max_secretarias ?? 0,
        countSecretarias: secretariasByClinica.get(row.id) ?? 0,
        countPacientes: pacientesByClinica.get(row.id) ?? 0,
        countConsultas: consultasByClinica.get(row.id) ?? 0,
        ultimoAccesoIso,
        estado,
        suspendida: row.suspendida === true,
      }
    })

    // Filtros derivados (plan y estado) en JS — la DB no los conoce
    const filtered: ClinicaResumen[] = itemsBuilt.filter((it) => {
      if (planFiltro !== 'todos' && it.estadoPago !== planFiltro) return false
      if (estadoFiltro !== 'todos' && it.estado !== estadoFiltro) return false
      return true
    })

    const nextCursor: string | null =
      hasMore && pageRows.length > 0 ? pageRows[pageRows.length - 1].created_at : null

    const body: ClinicasListResponse = { items: filtered, nextCursor }
    return NextResponse.json(body)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
