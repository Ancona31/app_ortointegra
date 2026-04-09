/**
 * GET /api/super-admin/dashboard/clinicas/[id]
 *
 * Detalle completo de una clínica con sus usuarios, métricas y serie temporal.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import {
  type ClinicaDetalle,
  type ClinicaResumen,
  type EstadoClinica,
  type EstadoPago,
  type Rol,
  type SeriePunto,
  type TipoCuenta,
  type UsuarioClinica,
} from '@/lib/super-admin/types'

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
}

interface ProfileRowDb {
  id: string
  clinica_id: string | null
  role: string | null
  nombre: string | null
}

interface PacienteRowDb {
  id: string
  clinica_id: string | null
}

interface ConsultaRowDb {
  id: string
  paciente_id: string
  created_at: string
}

function isRol(value: string | null): Rol {
  if (value === 'super_admin' || value === 'admin' || value === 'medico' || value === 'secretaria') {
    return value
  }
  return 'medico'
}

function clasificarTipo(raw: string | null): TipoCuenta {
  return raw === 'independiente' ? 'independiente' : 'clinica'
}

function clasificarPago(row: ClinicaRowDb): EstadoPago {
  if (row.max_pacientes === null) return 'vip'
  if (!row.stripe_subscription_id) return 'gratuito'
  if (!row.plan || row.plan === 'free') return 'gratuito'
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

function monthsAgoIso(n: number): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1)).toISOString()
}

function agruparPorMes(rows: ReadonlyArray<{ created_at: string }>, mesesAtras: number): SeriePunto[] {
  const buckets = new Map<string, number>()
  for (let i = mesesAtras - 1; i >= 0; i--) {
    const now = new Date()
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
    buckets.set(key, 0)
  }
  for (const r of rows) {
    const d = new Date(r.created_at)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return Array.from(buckets.entries()).map(([fecha, valor]) => ({ fecha, valor }))
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  void req
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

  const { id } = await context.params
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  await logAudit({
    userId: auth.user.id,
    accion: 'sa_ver_dashboard',
    descripcion: `clinica:${id}`,
  })

  try {
    const admin = createAdminClient()

    const clinicaRes = await admin
      .from('clinicas')
      .select(
        'id, nombre, nombre_display, logo_url, tipo, plan, max_medicos, max_secretarias, max_pacientes, suspendida, suscripcion_estado, stripe_subscription_id',
      )
      .eq('id', id)
      .maybeSingle()

    if (clinicaRes.error) throw new Error(clinicaRes.error.message)
    if (!clinicaRes.data) {
      return NextResponse.json({ error: 'Clínica no encontrada' }, { status: 404 })
    }
    const clinicaRow = clinicaRes.data as ClinicaRowDb

    const [profilesRes, pacientesRes, authRes, documentosCount, iaCount] = await Promise.all([
      admin
        .from('profiles')
        .select('id, clinica_id, role, nombre')
        .eq('clinica_id', id),
      admin.from('pacientes').select('id, clinica_id').eq('clinica_id', id),
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin
        .from('documentos')
        .select('id, paciente_id', { count: 'exact', head: false })
        .limit(0),
      admin
        .from('rate_limits')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 30 * MS_DAY).toISOString()),
    ])

    if (profilesRes.error) throw new Error(profilesRes.error.message)
    if (pacientesRes.error) throw new Error(pacientesRes.error.message)
    if (authRes.error) throw new Error(authRes.error.message)
    void documentosCount
    void iaCount

    const profiles: ProfileRowDb[] = (profilesRes.data ?? []).map((p) => ({
      id: String(p.id),
      clinica_id: p.clinica_id === null ? null : String(p.clinica_id),
      role: p.role === null ? null : String(p.role),
      nombre: p.nombre === null ? null : String(p.nombre),
    }))
    const pacientes: PacienteRowDb[] = (pacientesRes.data ?? []).map((p) => ({
      id: String(p.id),
      clinica_id: p.clinica_id === null ? null : String(p.clinica_id),
    }))

    // Auth users → email + last_sign_in mapeados a profiles de esta clínica
    const profileIds = new Set(profiles.map((p) => p.id))
    const authByProfileId = new Map<
      string,
      { email: string | null; last_sign_in_at: string | null }
    >()
    for (const u of authRes.data.users) {
      if (!profileIds.has(u.id)) continue
      authByProfileId.set(u.id, {
        email: u.email ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
      })
    }

    // Consultas + documentos + IA scoped a la clínica
    const pacienteIds = pacientes.map((p) => p.id)
    let consultasRows: ConsultaRowDb[] = []
    let countDocumentos = 0
    if (pacienteIds.length > 0) {
      const [consultasRes, documentosRes] = await Promise.all([
        admin
          .from('consultas')
          .select('id, paciente_id, created_at')
          .in('paciente_id', pacienteIds)
          .gte('created_at', monthsAgoIso(11)),
        admin
          .from('documentos')
          .select('*', { count: 'exact', head: true })
          .in('paciente_id', pacienteIds),
      ])
      if (consultasRes.error) throw new Error(consultasRes.error.message)
      if (documentosRes.error) throw new Error(documentosRes.error.message)
      consultasRows = (consultasRes.data ?? []).map((c) => ({
        id: String(c.id),
        paciente_id: String(c.paciente_id),
        created_at: String(c.created_at),
      }))
      countDocumentos = documentosRes.count ?? 0
    }

    // IA calls de los usuarios de esta clínica
    let countIa = 0
    if (profileIds.size > 0) {
      const iaRes = await admin
        .from('rate_limits')
        .select('*', { count: 'exact', head: true })
        .in('user_id', Array.from(profileIds))
      if (iaRes.error) throw new Error(iaRes.error.message)
      countIa = iaRes.count ?? 0
    }

    // Último acceso
    let ultimoAccesoIso: string | null = null
    let countMedicos = 0
    let countSecretarias = 0
    const usuarios: UsuarioClinica[] = []
    for (const p of profiles) {
      const auth = authByProfileId.get(p.id)
      if (p.role === 'medico' || p.role === 'admin') countMedicos++
      if (p.role === 'secretaria') countSecretarias++
      if (auth?.last_sign_in_at) {
        if (!ultimoAccesoIso || auth.last_sign_in_at > ultimoAccesoIso) {
          ultimoAccesoIso = auth.last_sign_in_at
        }
      }
      usuarios.push({
        id: p.id,
        email: auth?.email ?? '',
        nombre: p.nombre ?? '',
        rol: isRol(p.role),
        ultimoLoginIso: auth?.last_sign_in_at ?? null,
      })
    }

    const resumen: ClinicaResumen = {
      id: clinicaRow.id,
      nombre: clinicaRow.nombre,
      nombreDisplay: clinicaRow.nombre_display,
      logoUrl: clinicaRow.logo_url,
      tipo: clasificarTipo(clinicaRow.tipo),
      plan: clinicaRow.plan,
      estadoPago: clasificarPago(clinicaRow),
      esVip: clinicaRow.max_pacientes === null,
      maxMedicos: clinicaRow.max_medicos ?? 0,
      countMedicos,
      maxSecretarias: clinicaRow.max_secretarias ?? 0,
      countSecretarias,
      countPacientes: pacientes.length,
      countConsultas: consultasRows.length,
      ultimoAccesoIso,
      estado: clasificarEstado(clinicaRow.suspendida === true, ultimoAccesoIso),
      suspendida: clinicaRow.suspendida === true,
    }

    const detalle: ClinicaDetalle = {
      resumen,
      usuarios,
      metricas: {
        pacientes: pacientes.length,
        consultas: consultasRows.length,
        documentos: countDocumentos,
        iaCalls: countIa,
      },
      serieConsultasPorMes: agruparPorMes(consultasRows, 12),
    }

    return NextResponse.json(detalle)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
