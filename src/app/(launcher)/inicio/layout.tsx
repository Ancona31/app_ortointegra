import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Sub-fase control de acceso secretaria: el launcher /inicio es solo para
// médicos. La secretaria entra directo a /dashboard. Este guard también cubre
// el post-login: si el login envía a la secretaria a /inicio, la reenvía a
// /dashboard sin flicker, sin tocar login/page.tsx.
export default async function InicioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'secretaria') redirect('/dashboard')

  return <>{children}</>
}
