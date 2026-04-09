/**
 * GET /api/super-admin/dashboard/ingresos
 *
 * Sección 3 — Ingresos:
 * - MRR actual y comparación vs hace 30 días (computada desde Stripe)
 * - Listado de trials, pagos fallidos y suscripciones por vencer en 7 días
 * - Conversión trial → pago en últimos 90 días
 * - Serie de ingresos mensuales (12 meses)
 * - Tabla de transacciones recientes (últimas 50 invoices)
 */

import { NextResponse, type NextRequest } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import stripe from '@/lib/stripe'
import type Stripe from 'stripe'
import {
  calcularDireccion,
  type ClinicaPagoFallido,
  type ClinicaTrial,
  type EstadoTransaccion,
  type IngresosResumen,
  type KpiVariacion,
  type SeriePunto,
  type SuscripcionPorVencer,
  type TransaccionStripe,
} from '@/lib/super-admin/types'

const MS_DAY = 86_400_000

interface ClinicaStripeRow {
  id: string
  nombre: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
}

function monthlyEquivalent(price: Stripe.Price | null, quantity: number): number {
  if (!price) return 0
  const unit = price.unit_amount ?? 0
  const interval = price.recurring?.interval ?? 'month'
  const intervalCount = price.recurring?.interval_count ?? 1
  let monthly = (unit * quantity) / 100
  if (interval === 'year') monthly = monthly / 12
  if (interval === 'week') monthly = monthly * (52 / 12)
  if (interval === 'day') monthly = monthly * 30
  if (intervalCount > 1) monthly = monthly / intervalCount
  return monthly
}

function subMrr(sub: Stripe.Subscription): number {
  let total = 0
  for (const item of sub.items.data) {
    total += monthlyEquivalent(item.price, item.quantity ?? 1)
  }
  return total
}

async function listAllSubscriptions(
  status: Stripe.SubscriptionListParams.Status,
): Promise<Stripe.Subscription[]> {
  const out: Stripe.Subscription[] = []
  let starting_after: string | undefined
  for (let i = 0; i < 20; i++) {
    const list = await stripe.subscriptions.list({
      status,
      limit: 100,
      starting_after,
      expand: ['data.items.data.price'],
    })
    out.push(...list.data)
    if (!list.has_more) break
    const last = list.data[list.data.length - 1]
    if (!last) break
    starting_after = last.id
  }
  return out
}

function mapInvoiceStatus(s: Stripe.Invoice.Status | null): EstadoTransaccion {
  if (s === 'paid' || s === 'open' || s === 'void' || s === 'uncollectible' || s === 'draft') {
    return s
  }
  return 'desconocido'
}

function monthsAgo(n: number): { year: number; month: number; iso: string } {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 1))
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    iso: d.toISOString(),
  }
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

async function listInvoices(limit: number): Promise<Stripe.Invoice[]> {
  const list = await stripe.invoices.list({ limit })
  return list.data
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  void req
  const auth = await requireSuperAdmin()
  if (auth.error) return auth.error

  await logAudit({
    userId: auth.user.id,
    accion: 'sa_ver_dashboard',
    descripcion: 'ingresos',
  })

  try {
    const admin = createAdminClient()

    // Mapa customerId → clinica para resolver nombres
    const clinicasRes = await admin
      .from('clinicas')
      .select('id, nombre, stripe_customer_id, stripe_subscription_id')

    if (clinicasRes.error) throw new Error(clinicasRes.error.message)
    const clinicas: ClinicaStripeRow[] = (clinicasRes.data ?? []).map((c) => ({
      id: String(c.id),
      nombre: String(c.nombre),
      stripe_customer_id:
        c.stripe_customer_id === null || c.stripe_customer_id === undefined
          ? null
          : String(c.stripe_customer_id),
      stripe_subscription_id:
        c.stripe_subscription_id === null || c.stripe_subscription_id === undefined
          ? null
          : String(c.stripe_subscription_id),
    }))
    const clinicaPorCustomer = new Map<string, ClinicaStripeRow>()
    const clinicaPorSubscription = new Map<string, ClinicaStripeRow>()
    for (const c of clinicas) {
      if (c.stripe_customer_id) clinicaPorCustomer.set(c.stripe_customer_id, c)
      if (c.stripe_subscription_id) clinicaPorSubscription.set(c.stripe_subscription_id, c)
    }

    // Stripe en paralelo
    const [activas, trialing, pastDue, serieIngresos, invoices] = await Promise.all([
      listAllSubscriptions('active'),
      listAllSubscriptions('trialing'),
      listAllSubscriptions('past_due'),
      ingresosPorMes(12),
      listInvoices(50),
    ])

    // MRR actual = suma de subscriptions activas
    const mrrActualValor = activas.reduce((acc, s) => acc + subMrr(s), 0)

    // MRR hace 30 días: aproximación = MRR actual menos las activas que se crearon en los últimos 30 días
    // Es una aproximación razonable: refleja el crecimiento neto del último mes,
    // pero no captura churn (cancelaciones del mes que ya no aparecen en 'active').
    const corteUnix = Math.floor((Date.now() - 30 * MS_DAY) / 1000)
    const mrrAnteriorValor = activas
      .filter((s) => s.created < corteUnix)
      .reduce((acc, s) => acc + subMrr(s), 0)

    const mrrRedondeado = Math.round(mrrActualValor * 100) / 100
    const mrrAnteriorRedondeado = Math.round(mrrAnteriorValor * 100) / 100
    const mrrVariacionPct =
      mrrAnteriorRedondeado === 0
        ? mrrRedondeado === 0
          ? 0
          : null
        : ((mrrRedondeado - mrrAnteriorRedondeado) / mrrAnteriorRedondeado) * 100

    const mrrActual: KpiVariacion = {
      valor: mrrRedondeado,
      variacionPct: mrrVariacionPct,
      direccion: calcularDireccion(mrrRedondeado, mrrAnteriorRedondeado),
    }

    // Trials
    const trials: ClinicaTrial[] = trialing.map((s) => {
      const c = clinicaPorSubscription.get(s.id) ?? clinicaPorCustomer.get(String(s.customer))
      const trialEnd = s.trial_end ?? 0
      const diasRestantes = Math.max(0, Math.ceil((trialEnd * 1000 - Date.now()) / MS_DAY))
      return {
        clinicaId: c?.id ?? s.id,
        nombre: c?.nombre ?? '(sin clínica vinculada)',
        diasRestantes,
      }
    })

    // Pagos fallidos
    const pagosFallidos: ClinicaPagoFallido[] = pastDue.map((s) => {
      const c = clinicaPorSubscription.get(s.id) ?? clinicaPorCustomer.get(String(s.customer))
      const dias = Math.max(0, Math.ceil((Date.now() - s.created * 1000) / MS_DAY))
      return {
        clinicaId: c?.id ?? s.id,
        nombre: c?.nombre ?? '(sin clínica vinculada)',
        diasFallido: dias,
      }
    })

    // Suscripciones por vencer en 7 días (canceladas al final del periodo).
    // En la API 2026-03-25 current_period_end vive en cada subscription item.
    const ahoraUnix = Math.floor(Date.now() / 1000)
    const en7dUnix = ahoraUnix + 7 * 86_400
    const finDeSub = (s: Stripe.Subscription): number => {
      let max = 0
      for (const it of s.items.data) {
        const end = it.current_period_end ?? 0
        if (end > max) max = end
      }
      return max
    }
    const porVencer: SuscripcionPorVencer[] = activas
      .filter((s) => {
        if (!s.cancel_at_period_end) return false
        const fin = finDeSub(s)
        return fin > ahoraUnix && fin <= en7dUnix
      })
      .map((s) => {
        const c = clinicaPorSubscription.get(s.id) ?? clinicaPorCustomer.get(String(s.customer))
        const fin = finDeSub(s)
        const dias = Math.max(0, Math.ceil((fin - ahoraUnix) / 86_400))
        return {
          clinicaId: c?.id ?? s.id,
          nombre: c?.nombre ?? '(sin clínica vinculada)',
          diasParaVencer: dias,
          monto: Math.round(subMrr(s) * 100) / 100,
        }
      })

    // Conversión trial → pago: trials creados hace 60-90 días que ahora son active.
    // Usamos createdMin/createdMax para listar subscriptions creadas en esa ventana.
    const ventanaInicioUnix = Math.floor((Date.now() - 90 * MS_DAY) / 1000)
    const ventanaFinUnix = Math.floor((Date.now() - 60 * MS_DAY) / 1000)
    const subsVentana = await stripe.subscriptions.list({
      limit: 100,
      created: { gte: ventanaInicioUnix, lte: ventanaFinUnix },
    })
    let totalTrialsVentana = 0
    let convertidos = 0
    for (const s of subsVentana.data) {
      // Una sub cuenta como trial si tuvo trial_start
      if (s.trial_start) {
        totalTrialsVentana++
        if (s.status === 'active') convertidos++
      }
    }
    const conversionTrialPct: number | null =
      totalTrialsVentana === 0 ? null : Math.round((convertidos / totalTrialsVentana) * 1000) / 10

    // Transacciones recientes
    const transacciones: TransaccionStripe[] = invoices.map((inv) => {
      const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id ?? null
      const cli = customerId ? clinicaPorCustomer.get(customerId) ?? null : null
      const monto = (inv.amount_paid ?? inv.amount_due ?? 0) / 100
      return {
        id: inv.id ?? '',
        fechaIso: new Date((inv.created ?? 0) * 1000).toISOString(),
        monto: Math.round(monto * 100) / 100,
        moneda: (inv.currency ?? 'mxn').toUpperCase(),
        estado: mapInvoiceStatus(inv.status ?? null),
        clinicaId: cli?.id ?? null,
        clinicaNombre: cli?.nombre ?? null,
        customerId,
        hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      }
    })

    const body: IngresosResumen = {
      mrrActual,
      clinicasEnTrial: trials.length,
      conversionTrialPct,
      clinicasPagoFallido: pagosFallidos.length,
      suscripcionesVencen7d: porVencer.length,
      serieIngresosPorMes: serieIngresos,
      trials,
      pagosFallidos,
      porVencer,
      transacciones,
    }
    return NextResponse.json(body)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
