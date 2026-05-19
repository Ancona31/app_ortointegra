import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import stripe from '@/lib/stripe'
import { canManageClinica } from '@/lib/permissions'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('clinica_id, role, es_admin_de_clinica')
    .eq('id', user.id)
    .single()

  if (!profile?.clinica_id || !canManageClinica(profile)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const { data: clinica } = await admin
    .from('clinicas')
    .select('stripe_customer_id')
    .eq('id', profile.clinica_id)
    .single()

  if (!clinica?.stripe_customer_id) {
    return NextResponse.json({ error: 'No hay suscripción activa' }, { status: 400 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: clinica.stripe_customer_id,
      return_url: `${baseUrl}/billing`,
    })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[Stripe Portal] Error:', error)
    const message = error instanceof Error ? error.message : 'No se pudo abrir el portal'
    return NextResponse.json({ error: 'stripe_portal_error', message }, { status: 500 })
  }
}
