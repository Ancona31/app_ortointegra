/**
 * GET /api/super-admin/dashboard/resumen
 *
 * Devuelve todas las métricas de la sección 1 (Resumen ejecutivo) del dashboard
 * de super_admin. Calcula KPIs actuales y comparativos vs hace 30 días, series
 * temporales (12 meses / 30 días), distribución de planes y MRR real desde
 * Stripe.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import stripe from '@/lib/stripe'
import {
  calcularVariacion,
  type DistribucionItem,
  type KpiVariacion,
  type ResumenEjecutivo,
  type SeriePunto,
} from '@/lib/super-admin/types'

// ──────────────────────────────────────────────────────────────────
// Helpers de fecha
// ──────────────────────────────────────────────────────────────────

const MS_DAY = 86_400_000

function isoNDaysAgo(n: number): string {
  return new Date(Date.now() - n * MS_DAY).toISOString()
}

function isoStartOfDay(d: Date): string {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x.toISOString()
}

function isoStartOfMonth(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toISOString()
}

function monthsAgo(n: number): { year: number; month: number; iso: string } {
  const now = new Date()
  const month = now.getUTCMonth() - n
  const d = new Date(Date.UTC(now.getUTCFullYear(), month, 1))
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    iso: d.toISOString(),
  }
}

// ──────────────────────────────────────────────────────────────────
// COUNT helpers tipados
// ──────────────────────────────────────────────────────────────────

interface CountOptions {
  table: string
  filterColumn?: string
  filterValue?: string | number | null
  beforeIso?: string
  afterIso?: string
  isNullColumn?: string
  isNotNullColumn?: string
}

async function countRows(opts: CountOptions): Promise<number> {
  const admin = createAdminClient()
  let query = admin.from(opts.table).select('*', { count: 'exact', head: true })
  if (opts.filterColumn !== undefined && opts.filterValue !== undefined && opts.filterValue !== null) {
    query = query.eq(opts.filterColumn, opts.filterValue)
  }
  if (opts.beforeIso) query = query.lt('created_at', opts.beforeIso)
  if (opts.afterIso) query = query.gte('created_at', opts.afterIso)
  if (opts.isNullColumn) query = query.is(opts.isNullColumn, null)
  if (opts.isNotNullColumn) query = query.not(opts.isNotNullColumn, 'is', null)
  const { count, error } = await query
  if (error) throw new Error(`Count failed on ${opts.table}: ${error.message}`)
  return count ?? 0
}

// ──────────────────────────────────────────────────────────────────
// Series temporales — agrupación en JS sobre datos mínimos
// ──────────────────────────────────────────────────────────────────

interface FechaRow {
  created_at: string
}

function agruparPorMes(rows: ReadonlyArray<FechaRow>, mesesAtras: number): SeriePunto[] {
  const buckets = new Map<string, number>()
  for (let i = mesesAtras - 1; i >= 0; i--) {
    const m = monthsAgo(i)
    const key = `${m.year}-${String(m.month + 1).padStart(2, '0')}`
    buckets.set(key, 0)
  }
  for (const row of rows) {
    const d = new Date(row.created_at)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }
  }
  return Array.from(buckets.entries()).map(([fecha, valor]) => ({
    fecha: `${fecha}-01`,
    valor,
  }))
}

function agruparPorDia(rows: ReadonlyArray<FechaRow>, diasAtras: number): SeriePunto[] {
  const buckets = new Map<string, number>()
  const hoy = new Date()
  for (let i = diasAtras - 1; i >= 0; i--) {
    const d = new Date(hoy.getTime() - i * MS_DAY)
    const key = isoStartOfDay(d).slice(0, 10)
    buckets.set(key, 0)
  }
  for (const row of rows) {
    const key = row.created_at.slice(0, 10)
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }
  }
  return Array.from(buckets.entries()).map(([fecha, valor]) => ({ fecha, valor }))
}

// ──────────────────────────────────────────────────────────────────
// Tipos auxiliares de filas mínimas
// ──────────────────────────────────────────────────────────────────

interface ClinicaPlanRow {
  id: string
  plan: string | null
  max_pacientes: number | null
  suscripcion_estado: string | null
  stripe_subscription_id: string | null
}

interface DocumentoTipoRow {
  tipo: string
}

interface RateLimitFechaRow {
  created_at: string
}

// ──────────────────────────────────────────────────────────────────
// Stripe — MRR e ingresos por mes
// ──────────────────────────────────────────────────────────────────

interface StripeMetrics {
  mrr: number
  serieIngresosPorMes: SeriePunto[]
}

async function calcularMrr(): Promise<number> {
  let mrr = 0
  let starting_after: string | undefined
  // Pagina las suscripciones activas
  for (let i = 0; i < 20; i++) {
    const list = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
      starting_after,
      expand: ['data.items.data.price'],
    })
    for (const sub of list.data) {
      for (const item of sub.items.data) {
        const price = item.price
        const unit = price.unit_amount ?? 0
        const qty = item.quantity ?? 1
        const interval = price.recurring?.interval ?? 'month'
        const intervalCount = price.recurring?.interval_count ?? 1
        let monthly = (unit * qty) / 100
        if (interval === 'year') monthly = monthly / 12
        if (interval === 'week') monthly = monthly * (52 / 12)
        if (interval === 'day') monthly = monthly * 30
        if (intervalCount > 1) monthly = monthly / intervalCount
        mrr += monthly
      }
    }
    if (!list.has_more) break
    const last = list.data[list.data.length - 1]
    if (!last) break
    starting_after = last.id
  }
  return Math.round(mrr * 100) / 100
}

async function ingresosPorMes(meses: number): Promise<SeriePunto[]> {
  const buckets = new Map<string, number>()
  for (let i = meses - 1; i >= 0; i--) {
    const m = monthsAgo(i)
    const key = `${m.year}-${String(m.month + 1).padStart(2, '0')}-01`
    buckets.set(key, 0)
  }
  const desdeMes = monthsAgo(meses - 1)
  const desdeUnix = Math.floor(new Date(desdeMes.iso).getTime() / 1000)
  let starting_after: string | undefined
  for (let i = 0; i < 30; i++) {
    const list = await stripe.invoices.list({
      status: 'paid',
      limit: 100,
      starting_after,
      created: { gte: desdeUnix },
    })
    for (const inv of list.data) {
      const created = inv.created
      if (!created) continue
      const d = new Date(created * 1000)
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
      if (buckets.has(key)) {
        const monto = (inv.amount_paid ?? 0) / 100
        buckets.set(key, (buckets.get(key) ?? 0) + monto)
      }
    }
    if (!list.has_more) break
    const last = list.data[list.data.length - 1]
    if (!last) break
    starting_after = last.id
  }
  return Array.from(buckets.entries()).map(([fecha, valor]) => ({
    fecha,
    valor: Math.round(valor * 100) / 100,
  }))
}

async function obtenerMetricasStripe(): Promise<StripeMetrics> {
  try {
    const [mrr, serie] = await Promise.all([calcularMrr(), ingresosPorMes(12)])
    return { mrr, serieIngresosPorMes: serie }
  } catch {
    // Si Stripe falla, devolvemos ceros — el dashboard sigue cargando
    const empty = monthsAgo(11)
    void empty
    const serie: SeriePunto[] = []
    for (let i = 11; i >= 0; i--) {
      const m = monthsAgo(i)
      serie.push({
        fecha: `${m.year}-${String(m.month + 1).padStart(2, '0')}-01`,
        valor: 0,
      })
    }
    return { mrr: 0, serieIngresosPorMes: serie }
  }
}

// ──────────────────────────────────────────────────────────────────
// Distribución de planes y documentos
// ──────────────────────────────────────────────────────────────────

const COLOR_PLAN: Record<'gratuito' | 'pagando' | 'vip', string> = {
  gratuito: '#64748b',
  pagando: '#1e5fa8',
  vip: '#a855f7',
}

const COLOR_DOC: Record<string, string> = {
  receta: '#1e5fa8',
  solicitud_lab: '#06b6d4',
  solicitud_imagen: '#a855f7',
  informe_clinico: '#10b981',
  plan_suplementacion: '#f59e0b',
  consentimiento_informado: '#f43f5e',
  nota_evolucion: '#ef4444',
  nota_honorarios: '#84cc16',
  escrito_medico: '#fbbf24',
  solicitud_internamiento: '#fb923c',
}

function distribucionPlanes(rows: ReadonlyArray<ClinicaPlanRow>): DistribucionItem[] {
  let gratuito = 0
  let pagando = 0
  let vip = 0
  for (const r of rows) {
    if (r.max_pacientes === null) {
      vip++
      continue
    }
    if (!r.stripe_subscription_id) {
      gratuito++
      continue
    }
    if (!r.plan || r.plan === 'free') {
      gratuito++
      continue
    }
    if (r.suscripcion_estado === 'activo' || r.suscripcion_estado === 'trial') {
      pagando++
      continue
    }
    gratuito++
  }
  return [
    { etiqueta: 'Gratuito', valor: gratuito, color: COLOR_PLAN.gratuito },
    { etiqueta: 'Pagando', valor: pagando, color: COLOR_PLAN.pagando },
    { etiqueta: 'VIP', valor: vip, color: COLOR_PLAN.vip },
  ]
}

function distribucionDocumentos(rows: ReadonlyArray<DocumentoTipoRow>): DistribucionItem[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    counts.set(r.tipo, (counts.get(r.tipo) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([etiqueta, valor]) => ({
      etiqueta,
      valor,
      color: COLOR_DOC[etiqueta] ?? '#94a3b8',
    }))
    .sort((a, b) => b.valor - a.valor)
}

// ──────────────────────────────────────────────────────────────────
// Médicos activos: role='medico' con last_sign_in_at en últimos 30 días
// ──────────────────────────────────────────────────────────────────

async function contarMedicosActivos(diasAtras: number): Promise<number> {
  const admin = createAdminClient()
  const desdeIso = isoNDaysAgo(diasAtras)
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'medico')
  if (error) throw new Error(error.message)
  const ids = (profiles ?? []).map((p) => p.id as string)
  if (ids.length === 0) return 0
  const { data: authData, error: authErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (authErr) throw new Error(authErr.message)
  const idSet = new Set(ids)
  let activos = 0
  for (const u of authData.users) {
    if (!idSet.has(u.id)) continue
    if (!u.last_sign_in_at) continue
    if (new Date(u.last_sign_in_at).toISOString() >= desdeIso) activos++
  }
  return activos
}

// ──────────────────────────────────────────────────────────────────
// Handler principal
// ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  void req
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

  await logAudit({
    userId: auth.user.id,
    accion: 'sa_ver_dashboard',
    descripcion: 'resumen',
  })

  try {
    const ahoraIso = new Date().toISOString()
    const hace30Iso = isoNDaysAgo(30)
    const hace60Iso = isoNDaysAgo(60)
    const hoyIso = isoStartOfDay(new Date())
    const ayerIso = isoStartOfDay(new Date(Date.now() - MS_DAY))
    const inicioMes12Iso = monthsAgo(11).iso
    const admin = createAdminClient()

    // KPIs (count-only, head:true)
    const [
      totalClinicasActual,
      totalClinicasAnterior,
      totalMedicosActivosActual,
      totalMedicosActivosAnterior,
      totalPacientesActual,
      totalPacientesAnterior,
      totalConsultasActual,
      totalConsultasAnterior,
      consultasHoyActual,
      consultasHoyAnterior,
    ] = await Promise.all([
      countRows({ table: 'clinicas', beforeIso: ahoraIso }),
      countRows({ table: 'clinicas', beforeIso: hace30Iso }),
      contarMedicosActivos(30),
      contarMedicosActivos(60),
      countRows({ table: 'pacientes', beforeIso: ahoraIso }),
      countRows({ table: 'pacientes', beforeIso: hace30Iso }),
      countRows({ table: 'consultas', beforeIso: ahoraIso }),
      countRows({ table: 'consultas', beforeIso: hace30Iso }),
      countRows({ table: 'consultas', afterIso: hoyIso }),
      countRows({ table: 'consultas', afterIso: ayerIso, beforeIso: hoyIso }),
    ])

    // Series temporales (fetch mínimo + agrupación JS)
    const [
      clinicasFechas,
      consultasFechas,
      iaFechas,
      clinicasPlanRows,
      documentosTipoRows,
      stripeMetrics,
    ] = await Promise.all([
      admin.from('clinicas').select('created_at').gte('created_at', inicioMes12Iso),
      admin.from('consultas').select('created_at').gte('created_at', isoNDaysAgo(30)),
      admin.from('rate_limits').select('created_at').gte('created_at', isoNDaysAgo(30)),
      admin.from('clinicas').select('id, plan, max_pacientes, suscripcion_estado, stripe_subscription_id'),
      admin.from('documentos').select('tipo').gte('created_at', isoNDaysAgo(90)),
      obtenerMetricasStripe(),
    ])

    if (clinicasFechas.error) throw new Error(clinicasFechas.error.message)
    if (consultasFechas.error) throw new Error(consultasFechas.error.message)
    if (iaFechas.error) throw new Error(iaFechas.error.message)
    if (clinicasPlanRows.error) throw new Error(clinicasPlanRows.error.message)
    if (documentosTipoRows.error) throw new Error(documentosTipoRows.error.message)

    const clinicasRows: FechaRow[] = (clinicasFechas.data ?? []).map((r) => ({
      created_at: String(r.created_at),
    }))
    const consultasRows: FechaRow[] = (consultasFechas.data ?? []).map((r) => ({
      created_at: String(r.created_at),
    }))
    const iaRows: RateLimitFechaRow[] = (iaFechas.data ?? []).map((r) => ({
      created_at: String(r.created_at),
    }))
    const planRows: ClinicaPlanRow[] = (clinicasPlanRows.data ?? []).map((r) => ({
      id: String(r.id),
      plan: r.plan === null || r.plan === undefined ? null : String(r.plan),
      max_pacientes:
        r.max_pacientes === null || r.max_pacientes === undefined ? null : Number(r.max_pacientes),
      suscripcion_estado:
        r.suscripcion_estado === null || r.suscripcion_estado === undefined
          ? null
          : String(r.suscripcion_estado),
      stripe_subscription_id:
        r.stripe_subscription_id === null || r.stripe_subscription_id === undefined
          ? null
          : String(r.stripe_subscription_id),
    }))
    const docRows: DocumentoTipoRow[] = (documentosTipoRows.data ?? []).map((r) => ({
      tipo: String(r.tipo),
    }))

    const mrrActual: KpiVariacion = {
      valor: stripeMetrics.mrr,
      variacionPct: null,
      direccion: 'flat',
    }

    const resumen: ResumenEjecutivo = {
      totalClinicas: calcularVariacion(totalClinicasActual, totalClinicasAnterior),
      totalMedicosActivos: calcularVariacion(
        totalMedicosActivosActual,
        totalMedicosActivosAnterior,
      ),
      totalPacientes: calcularVariacion(totalPacientesActual, totalPacientesAnterior),
      totalConsultas: calcularVariacion(totalConsultasActual, totalConsultasAnterior),
      mrr: mrrActual,
      consultasHoy: calcularVariacion(consultasHoyActual, consultasHoyAnterior),
      serieClinicasPorMes: agruparPorMes(clinicasRows, 12),
      serieConsultasPorDia: agruparPorDia(consultasRows, 30),
      serieIngresosPorMes: stripeMetrics.serieIngresosPorMes,
      documentosPorTipo: distribucionDocumentos(docRows),
      distribucionPlanes: distribucionPlanes(planRows),
      serieIaPorDia: agruparPorDia(iaRows, 30),
    }

    return NextResponse.json(resumen)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
