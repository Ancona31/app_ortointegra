import { NextRequest, NextResponse } from 'next/server'
import stripe from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanByPriceId, PLAN_LIMITS, type PlanKey } from '@/lib/plans'
import { logger } from '@/lib/logger'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

const PLANES_CLINICA: PlanKey[] = ['basica', 'pro', 'premium']

// Mapea subscription.status de Stripe a nuestro suscripcion_estado.
// Devuelve null para status NO productivos (no se debe escribir estado ni sub_id).
function mapStatusToEstado(status: Stripe.Subscription.Status): 'activo' | 'vencido' | 'cancelado' | null {
  switch (status) {
    case 'active':
      return 'activo'
    case 'past_due':
      return 'activo'      // gracia: el corte llega vía unpaid/canceled tras dunning
    case 'unpaid':
      return 'vencido'
    case 'canceled':
      return 'cancelado'
    default:
      // incomplete, incomplete_expired, paused, trialing → no productivo
      return null
  }
}

// Resuelve el PlanKey de una suscripción: metadata.plan validado primero,
// luego getPlanByPriceId. Devuelve null si ninguna fuente da un plan válido de pago.
function resolvePlanKey(subscription: Stripe.Subscription, priceId: string): PlanKey | null {
  const metaPlan = subscription.metadata?.plan
  if (metaPlan && metaPlan in PLAN_LIMITS && metaPlan !== 'free') {
    return metaPlan as PlanKey
  }
  const derived = getPlanByPriceId(priceId)
  if (derived && derived !== 'free') {
    return derived
  }
  return null
}

async function actualizarClinica(
  admin: ReturnType<typeof createAdminClient>,
  clinicaId: string,
  plan: PlanKey,
  subscriptionId: string,
  priceId: string,
  estado: 'activo' | 'vencido' | 'cancelado',
  periodEnd?: number | null,
): Promise<{ error: unknown }> {
  const limits = PLAN_LIMITS[plan]
  const esClinica = PLANES_CLINICA.includes(plan)

  const { error } = await admin.from('clinicas').update({
    plan,
    suscripcion_estado: estado,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: priceId,
    max_medicos: limits.max_medicos,
    max_secretarias: limits.max_secretarias,
    max_pacientes: limits.max_pacientes,
    suscripcion_ends_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    // Planes de clínica: convertir cuenta a tipo='clinica' en el mismo UPDATE.
    // El dueño ya es admin de clínica por defecto desde el registro (es_admin_de_clinica=true)
    ...(esClinica ? { tipo: 'clinica' as const } : {}),
  }).eq('id', clinicaId)

  if (error) {
    logger.error('STRIPE-WEBHOOK', `Fallo UPDATE clinica ${clinicaId} estado=${estado}`)
    return { error }
  }

  return { error: null }
}

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const subDetails = invoice.parent?.subscription_details
  if (!subDetails) return null
  const sub = subDetails.subscription
  if (!sub) return null
  return typeof sub === 'string' ? sub : sub.id
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Webhook secret no configurado' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    logger.warn('STRIPE-WEBHOOK', 'Firma invalida rechazada')
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  logger.info('STRIPE-WEBHOOK', `Evento recibido tipo=${event.type} id=${event.id}`)

  const admin = createAdminClient()

  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription') break

      const clinicaId = session.metadata?.clinica_id
      if (!clinicaId) break

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
      const priceId = subscription.items.data[0]?.price.id ?? ''

      const estado = mapStatusToEstado(subscription.status)
      if (estado === null) {
        // Status no productivo (ej. incomplete por SCA/3DS pendiente): no escribir nada.
        // customer.subscription.updated aplicará el estado cuando el pago se confirme.
        logger.info('STRIPE-WEBHOOK', `checkout.completed no-productivo clinica=${clinicaId} status=${subscription.status} (no-write)`)
        break
      }

      const planKey = resolvePlanKey(subscription, priceId)
      if (!planKey) {
        logger.error('STRIPE-WEBHOOK', `checkout.completed plan irresoluble clinica=${clinicaId} priceId=${priceId}`)
        return NextResponse.json({ error: 'plan_irresoluble' }, { status: 500 })
      }

      const { error } = await actualizarClinica(
        admin, clinicaId, planKey,
        subscription.id, priceId,
        estado,
        subscription.items.data[0]?.current_period_end,
      )
      if (error) {
        return NextResponse.json({ error: 'db_error' }, { status: 500 })
      }
      logger.info('STRIPE-WEBHOOK', `checkout.completed aplicado clinica=${clinicaId} status=${subscription.status} estado=${estado}`)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const clinicaId = subscription.metadata?.clinica_id
      if (!clinicaId) break

      const estado = mapStatusToEstado(subscription.status)
      if (estado === null) {
        // Status no productivo: no escribir estado ni stripe_subscription_id (protege el latch).
        logger.info('STRIPE-WEBHOOK', `subscription.updated no-productivo clinica=${clinicaId} status=${subscription.status} (no-write)`)
        break
      }

      const priceId = subscription.items.data[0]?.price.id ?? ''
      const planKey = resolvePlanKey(subscription, priceId)
      if (!planKey) {
        logger.error('STRIPE-WEBHOOK', `subscription.updated plan irresoluble clinica=${clinicaId} priceId=${priceId}`)
        return NextResponse.json({ error: 'plan_irresoluble' }, { status: 500 })
      }

      const { error } = await actualizarClinica(
        admin, clinicaId, planKey,
        subscription.id, priceId,
        estado,
        subscription.items.data[0]?.current_period_end,
      )
      if (error) {
        return NextResponse.json({ error: 'db_error' }, { status: 500 })
      }
      logger.info('STRIPE-WEBHOOK', `subscription.updated aplicado clinica=${clinicaId} status=${subscription.status} estado=${estado}`)
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const clinicaId = subscription.metadata?.clinica_id
      if (!clinicaId) break

      const { data: row, error: errSelect } = await admin
        .from('clinicas')
        .select('es_vip_grant')
        .eq('id', clinicaId)
        .maybeSingle()

      if (errSelect) {
        logger.error('STRIPE-WEBHOOK', `Fallo SELECT es_vip_grant ${clinicaId}`)
        return NextResponse.json({ error: 'db_error' }, { status: 500 })
      }

      const esVip = row?.es_vip_grant === true

      const camposBase = {
        plan: 'free' as const,
        suscripcion_estado: 'cancelado' as const,
        stripe_subscription_id: null,
        stripe_price_id: null,
        suscripcion_ends_at: subscription.items.data[0]?.current_period_end
          ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
          : null,
      }

      const camposLimites = esVip
        ? {}
        : {
            max_medicos: PLAN_LIMITS.free.max_medicos,
            max_secretarias: PLAN_LIMITS.free.max_secretarias,
            max_pacientes: PLAN_LIMITS.free.max_pacientes,
          }

      const { error: errUpdate } = await admin
        .from('clinicas')
        .update({ ...camposBase, ...camposLimites })
        .eq('id', clinicaId)

      if (errUpdate) {
        logger.error('STRIPE-WEBHOOK', `Fallo UPDATE deleted ${clinicaId}`)
        return NextResponse.json({ error: 'db_error' }, { status: 500 })
      }
      logger.info('STRIPE-WEBHOOK', `subscription.deleted aplicado clinica=${clinicaId} vip=${esVip}`)
      break
    }

    case 'invoice.payment_failed': {
      // Fase 3: invoice.* NO escribe suscripcion_estado. Solo registra.
      // El estado lo proyecta exclusivamente customer.subscription.* (unpaid/canceled tras dunning).
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = getSubscriptionIdFromInvoice(invoice)
      logger.info('STRIPE-WEBHOOK', `invoice.payment_failed registrado sub=${subscriptionId ?? 'null'} (no-write)`)
      break
    }

    case 'invoice.payment_succeeded': {
      // Fase 3: invoice.* NO escribe suscripcion_estado. Solo registra.
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = getSubscriptionIdFromInvoice(invoice)
      logger.info('STRIPE-WEBHOOK', `invoice.payment_succeeded registrado sub=${subscriptionId ?? 'null'} (no-write)`)
      break
    }
  }

  return NextResponse.json({ received: true })
}
