import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import stripe from '@/lib/stripe'
import { PLANS, type PlanKey, type BillingInterval } from '@/lib/plans'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { plan: planKey, interval = 'monthly' } = await req.json() as { plan: PlanKey; interval: BillingInterval }

  const plan = PLANS[planKey]
  if (!plan || planKey === 'free') {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  const priceId = plan.priceId[interval]
  if (!priceId) {
    return NextResponse.json({ error: `Price ID no configurado para ${planKey}/${interval}` }, { status: 400 })
  }

  // Obtener perfil y clínica del usuario
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('clinica_id, role, nombre')
    .eq('id', user.id)
    .single()

  if (!profile?.clinica_id || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Solo el administrador puede gestionar la suscripción' }, { status: 403 })
  }

  const { data: clinica } = await admin
    .from('clinicas')
    .select('id, nombre, stripe_customer_id')
    .eq('id', profile.clinica_id)
    .single()

  if (!clinica) return NextResponse.json({ error: 'Clínica no encontrada' }, { status: 404 })

  // Crear o reutilizar el customer en Stripe
  let customerId = clinica.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: clinica.nombre ?? profile.nombre ?? undefined,
      metadata: { clinica_id: clinica.id, user_id: user.id },
    })
    customerId = customer.id
    await admin.from('clinicas').update({ stripe_customer_id: customerId }).eq('id', clinica.id)
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/billing?success=true&plan=${planKey}`,
    cancel_url: `${baseUrl}/pricing`,
    metadata: { clinica_id: clinica.id, plan: planKey, interval },
    subscription_data: {
      metadata: { clinica_id: clinica.id, plan: planKey },
    },
    allow_promotion_codes: true,
    locale: 'es',
  })

  return NextResponse.json({ url: session.url })
}
