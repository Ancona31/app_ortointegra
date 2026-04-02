import { NextRequest, NextResponse } from 'next/server'
import stripe from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPlanByPriceId, PLAN_LIMITS, type PlanKey } from '@/lib/plans'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

async function actualizarClinica(
  admin: ReturnType<typeof createAdminClient>,
  clinicaId: string,
  plan: PlanKey,
  subscriptionId: string,
  priceId: string,
  estado: 'activo' | 'vencido' | 'cancelado',
  billingAnchor?: number | null,
) {
  const limits = PLAN_LIMITS[plan]
  await admin.from('clinicas').update({
    plan,
    suscripcion_estado: estado,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: priceId,
    max_medicos: limits.max_medicos,
    max_secretarias: limits.max_secretarias,
    max_pacientes: limits.max_pacientes,
    // billing_cycle_anchor es el anclaje del ciclo (en Stripe v21 no existe current_period_end)
    suscripcion_ends_at: billingAnchor ? new Date(billingAnchor * 1000).toISOString() : null,
  }).eq('id', clinicaId)
}

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  // Stripe v21: invoice.parent.subscription_details.subscription
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
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

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

      await actualizarClinica(
        admin, clinicaId, planKey,
        subscription.id, priceId,
        'activo',
        subscription.billing_cycle_anchor,
      )
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

      await actualizarClinica(
        admin, clinicaId, planKey,
        subscription.id, priceId,
        estado,
        subscription.billing_cycle_anchor,
      )
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const clinicaId = subscription.metadata?.clinica_id
      if (!clinicaId) break

      await admin.from('clinicas').update({
        plan: 'free',
        suscripcion_estado: 'cancelado',
        stripe_subscription_id: null,
        stripe_price_id: null,
        max_medicos: 1,
        max_secretarias: 0,
        max_pacientes: 15,
        suscripcion_ends_at: new Date(subscription.billing_cycle_anchor * 1000).toISOString(),
      }).eq('id', clinicaId)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = getSubscriptionIdFromInvoice(invoice)
      if (!subscriptionId) break

      const { data: clinica } = await admin
        .from('clinicas')
        .select('id')
        .eq('stripe_subscription_id', subscriptionId)
        .single()

      if (clinica) {
        await admin.from('clinicas')
          .update({ suscripcion_estado: 'vencido' })
          .eq('id', clinica.id)
      }
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = getSubscriptionIdFromInvoice(invoice)
      if (!subscriptionId) break

      const { data: clinica } = await admin
        .from('clinicas')
        .select('id')
        .eq('stripe_subscription_id', subscriptionId)
        .single()

      if (clinica) {
        await admin.from('clinicas')
          .update({ suscripcion_estado: 'activo' })
          .eq('id', clinica.id)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
