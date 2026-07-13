import { NextRequest, NextResponse } from 'next/server'
import stripe from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanByPriceId, PLAN_LIMITS, type PlanKey } from '@/lib/plans'
import { logger } from '@/lib/logger'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

const PLANES_CLINICA: PlanKey[] = ['basica', 'pro', 'premium']

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
  const { error: errPrincipal } = await admin.from('clinicas').update({
    plan,
    suscripcion_estado: estado,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: priceId,
    max_medicos: limits.max_medicos,
    max_secretarias: limits.max_secretarias,
    max_pacientes: limits.max_pacientes,
    suscripcion_ends_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  }).eq('id', clinicaId)

  if (errPrincipal) {
    logger.error('STRIPE-WEBHOOK', `Fallo UPDATE clinica ${clinicaId} estado=${estado}`)
    return { error: errPrincipal }
  }

  // Planes de clínica: convertir cuenta a tipo='clinica'
  // El dueño ya es admin de clínica por defecto desde el registro (es_admin_de_clinica=true)
  if (PLANES_CLINICA.includes(plan)) {
    const { error: errTipo } = await admin.from('clinicas').update({ tipo: 'clinica' }).eq('id', clinicaId)
    if (errTipo) {
      logger.error('STRIPE-WEBHOOK', `Fallo UPDATE tipo=clinica ${clinicaId}`)
      return { error: errTipo }
    }
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
      const planKey   = session.metadata?.plan as PlanKey | undefined
      if (!clinicaId || !planKey) break

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
      const priceId = subscription.items.data[0]?.price.id ?? ''

      const { error } = await actualizarClinica(
        admin, clinicaId, planKey,
        subscription.id, priceId,
        'activo',
        subscription.items.data[0]?.current_period_end,
      )
      if (error) {
        return NextResponse.json({ error: 'db_error' }, { status: 500 })
      }
      logger.info('STRIPE-WEBHOOK', `checkout.completed aplicado clinica=${clinicaId} estado=activo`)
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const clinicaId = subscription.metadata?.clinica_id
      if (!clinicaId) break

      const priceId = subscription.items.data[0]?.price.id ?? ''
      const planKey = getPlanByPriceId(priceId) ?? 'individual'

      let estado: 'activo' | 'vencido' | 'cancelado' = 'activo'
      if (subscription.status === 'past_due' || subscription.status === 'unpaid') estado = 'vencido'
      if (subscription.status === 'canceled') estado = 'cancelado'

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
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = getSubscriptionIdFromInvoice(invoice)
      if (!subscriptionId) break

      const { data: clinica, error: errSelect } = await admin
        .from('clinicas')
        .select('id')
        .eq('stripe_subscription_id', subscriptionId)
        .maybeSingle()

      if (errSelect) {
        logger.error('STRIPE-WEBHOOK', `Fallo SELECT payment_failed sub=${subscriptionId}`)
        return NextResponse.json({ error: 'db_error' }, { status: 500 })
      }

      if (clinica) {
        const { error: errUpdate } = await admin.from('clinicas')
          .update({ suscripcion_estado: 'vencido' })
          .eq('id', clinica.id)
        if (errUpdate) {
          logger.error('STRIPE-WEBHOOK', `Fallo UPDATE payment_failed clinica=${clinica.id}`)
          return NextResponse.json({ error: 'db_error' }, { status: 500 })
        }
        logger.info('STRIPE-WEBHOOK', `invoice.payment_failed aplicado clinica=${clinica.id} estado=vencido`)
      }
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = getSubscriptionIdFromInvoice(invoice)
      if (!subscriptionId) break

      const { data: clinica, error: errSelect } = await admin
        .from('clinicas')
        .select('id')
        .eq('stripe_subscription_id', subscriptionId)
        .maybeSingle()

      if (errSelect) {
        logger.error('STRIPE-WEBHOOK', `Fallo SELECT payment_succeeded sub=${subscriptionId}`)
        return NextResponse.json({ error: 'db_error' }, { status: 500 })
      }

      if (clinica) {
        const { error: errUpdate } = await admin.from('clinicas')
          .update({ suscripcion_estado: 'activo' })
          .eq('id', clinica.id)
        if (errUpdate) {
          logger.error('STRIPE-WEBHOOK', `Fallo UPDATE payment_succeeded clinica=${clinica.id}`)
          return NextResponse.json({ error: 'db_error' }, { status: 500 })
        }
        logger.info('STRIPE-WEBHOOK', `invoice.payment_succeeded aplicado clinica=${clinica.id} estado=activo`)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
