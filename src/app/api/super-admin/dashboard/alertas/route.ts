/**
 * GET /api/super-admin/dashboard/alertas
 *
 * §6 — Alertas:
 * - Pagos fallidos sin resolver (Stripe past_due)
 * - Clínicas con pacientes pero sin actividad en 30 días (riesgo churn)
 * - Trials próximos a vencer (≤7 días)
 * - Errores recientes del audit_log (accion LIKE 'error_%' o 'acceso_denegado')
 * - Cohortes de retención simples (últimos 3 meses)
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import stripe from '@/lib/stripe'
import type Stripe from 'stripe'
import type { AlertaItem, AlertasResponse, CohorteRetencion, SeveridadAlerta } from '@/lib/super-admin/types'

const MS_DAY = 86_400_000

// ── helpers ───────────────────────────────────────────────────────────

function makeId(prefix: string, suffix: string): string {
  return `${prefix}-${suffix}`
}

function monthLabel(msOffset: number): string {
  const d = new Date(Date.now() + msOffset)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

async function listAllSubscriptions(
  status: Stripe.SubscriptionListParams.Status,
): Promise<Stripe.Subscription[]> {
  const out: Stripe.Subscription[] = []
  let starting_after: string | undefined
  for (let i = 0; i < 10; i++) {
    const list = await stripe.subscriptions.list({
      status,
      limit: 100,
      starting_after,
    })
    out.push(...list.data)
    if (!list.has_more) break
    const last = list.data[list.data.length - 1]
    if (!last) break
    starting_after = last.id
  }
  return out
}

interface ClinicaRow {
  id: string
  nombre: string
}

interface PacienteCountRow {
  clinica_id: string
}

interface AuditErrorRow {
  id: string
  accion: string
  descripcion: string | null
  created_at: string
}

interface ProfileRow {
  id: string
  clinica_id: string | null
}

// ── handler ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  void req
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

  await logAudit({
    userId: auth.user.id,
    accion: 'sa_ver_alertas',
    descripcion: 'panel de alertas',
  })

  try {
    const admin = createAdminClient()
    const alertas: AlertaItem[] = []
    const now = Date.now()

    // ── 1. Stripe: trials por vencer ≤7 días ─────────────────────────
    const clinicasRes = await admin
      .from('clinicas')
      .select('id, nombre, stripe_customer_id, stripe_subscription_id')
    if (clinicasRes.error) throw new Error(clinicasRes.error.message)

    const clinicaPorSubscription = new Map<string, ClinicaRow>()
    const clinicaPorCustomer = new Map<string, ClinicaRow>()
    for (const c of clinicasRes.data ?? []) {
      const row: ClinicaRow = { id: String(c.id), nombre: String(c.nombre) }
      if (c.stripe_subscription_id) clinicaPorSubscription.set(String(c.stripe_subscription_id), row)
      if (c.stripe_customer_id) clinicaPorCustomer.set(String(c.stripe_customer_id), row)
    }

    const [trialing, pastDue] = await Promise.all([
      listAllSubscriptions('trialing'),
      listAllSubscriptions('past_due'),
    ])

    const en7dUnix = Math.floor((now + 7 * MS_DAY) / 1000)
    const ahoraUnix = Math.floor(now / 1000)

    for (const s of trialing) {
      const trialEnd = s.trial_end ?? 0
      if (trialEnd <= ahoraUnix || trialEnd > en7dUnix) continue
      const dias = Math.ceil((trialEnd * 1000 - now) / MS_DAY)
      const cli = clinicaPorSubscription.get(s.id) ?? clinicaPorCustomer.get(String(s.customer))
      alertas.push({
        id: makeId('trial', s.id),
        severidad: 'warning' satisfies SeveridadAlerta,
        titulo: 'Trial por vencer',
        descripcion: `Quedan ${dias} día${dias !== 1 ? 's' : ''} de trial.`,
        clinicaId: cli?.id ?? null,
        clinicaNombre: cli?.nombre ?? '(sin vincular)',
        fechaIso: new Date(trialEnd * 1000).toISOString(),
      })
    }

    // ── 2. Stripe: pagos fallidos ─────────────────────────────────────
    for (const s of pastDue) {
      const cli = clinicaPorSubscription.get(s.id) ?? clinicaPorCustomer.get(String(s.customer))
      const dias = Math.ceil((now - s.created * 1000) / MS_DAY)
      alertas.push({
        id: makeId('pastdue', s.id),
        severidad: 'critico' satisfies SeveridadAlerta,
        titulo: 'Pago fallido sin resolver',
        descripcion: `Subscripción en past_due hace ${dias} día${dias !== 1 ? 's' : ''}.`,
        clinicaId: cli?.id ?? null,
        clinicaNombre: cli?.nombre ?? '(sin vincular)',
        fechaIso: new Date(s.created * 1000).toISOString(),
      })
    }

    // ── 3. Clínicas con pacientes pero sin actividad en 30 días ───────
    const hace30d = new Date(now - 30 * MS_DAY).toISOString()

    // Get all clinica_ids that have at least one paciente
    const pacientesRes = await admin.from('pacientes').select('clinica_id')
    if (pacientesRes.error) throw new Error(pacientesRes.error.message)

    const clinicasConPacientes = new Set(
      (pacientesRes.data ?? [])
        .map((p: PacienteCountRow) => p.clinica_id)
        .filter(Boolean),
    )

    // Compute last activity per clinica via auth.users last_sign_in_at
    const profilesRes = await admin.from('profiles').select('id, clinica_id')
    if (profilesRes.error) throw new Error(profilesRes.error.message)

    const authRes = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (authRes.error) throw new Error(authRes.error.message)

    const perfilToClinica = new Map<string, string>()
    for (const p of (profilesRes.data ?? []) as ProfileRow[]) {
      if (p.clinica_id) perfilToClinica.set(p.id, p.clinica_id)
    }

    const lastActivityByClinica = new Map<string, number>()
    for (const u of authRes.data.users) {
      const clinicaId = perfilToClinica.get(u.id)
      if (!clinicaId) continue
      const signIn = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0
      const prev = lastActivityByClinica.get(clinicaId) ?? 0
      if (signIn > prev) lastActivityByClinica.set(clinicaId, signIn)
    }

    const clinicaMap = new Map<string, string>(
      (clinicasRes.data ?? []).map((c) => [String(c.id), String(c.nombre)]),
    )

    for (const clinicaId of clinicasConPacientes) {
      const lastActivity = lastActivityByClinica.get(clinicaId) ?? 0
      if (lastActivity === 0 || lastActivity < new Date(hace30d).getTime()) {
        const dias = lastActivity === 0 ? null : Math.ceil((now - lastActivity) / MS_DAY)
        alertas.push({
          id: makeId('churn', clinicaId),
          severidad: 'warning' satisfies SeveridadAlerta,
          titulo: 'Clínica sin actividad',
          descripcion:
            dias === null
              ? 'Nunca ha iniciado sesión. Riesgo de churn.'
              : `Sin actividad hace ${dias} días. Riesgo de churn.`,
          clinicaId,
          clinicaNombre: clinicaMap.get(clinicaId) ?? clinicaId,
          fechaIso: lastActivity === 0 ? new Date(0).toISOString() : new Date(lastActivity).toISOString(),
        })
      }
    }

    // ── 4. Errores recientes del audit_log ────────────────────────────
    const erroresRes = await admin
      .from('audit_log')
      .select('id, accion, descripcion, created_at')
      .or('accion.like.error_%,accion.eq.acceso_denegado')
      .order('created_at', { ascending: false })
      .limit(20)

    if (!erroresRes.error) {
      for (const e of (erroresRes.data ?? []) as AuditErrorRow[]) {
        alertas.push({
          id: makeId('error', e.id),
          severidad: 'info' satisfies SeveridadAlerta,
          titulo: `Error de sistema: ${e.accion}`,
          descripcion: e.descripcion ?? e.accion,
          clinicaId: null,
          clinicaNombre: null,
          fechaIso: e.created_at,
        })
      }
    }

    // Sort: crítico primero, luego warning, luego info; dentro de cada nivel por fecha desc
    const ORDEN: Record<SeveridadAlerta, number> = { critico: 0, warning: 1, info: 2 }
    alertas.sort((a, b) => {
      const ds = ORDEN[a.severidad] - ORDEN[b.severidad]
      if (ds !== 0) return ds
      return b.fechaIso.localeCompare(a.fechaIso)
    })

    // ── 5. Cohortes de retención (últimos 3 meses) ────────────────────
    // Para cada mes, contamos cuántas clínicas tuvieron actividad en ese mes
    const cohortes: CohorteRetencion[] = []
    const totalClinicas = clinicaMap.size

    for (let m = 2; m >= 0; m--) {
      const inicioMes = new Date(now - m * 30 * MS_DAY - 30 * MS_DAY)
      inicioMes.setUTCDate(1)
      inicioMes.setUTCHours(0, 0, 0, 0)
      const finMes = new Date(inicioMes)
      finMes.setUTCMonth(finMes.getUTCMonth() + 1)

      const mes = monthLabel(-m * 30 * MS_DAY - 15 * MS_DAY)
      let activasEnMes = 0
      for (const [, lastActivity] of lastActivityByClinica) {
        if (lastActivity >= inicioMes.getTime() && lastActivity < finMes.getTime()) {
          activasEnMes++
        }
      }
      cohortes.push({
        mes,
        totalClinicas,
        activas: activasEnMes,
        pct: totalClinicas === 0 ? 0 : Math.round((activasEnMes / totalClinicas) * 1000) / 10,
      })
    }

    const body: AlertasResponse = { alertas, cohortes }
    return NextResponse.json(body)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
