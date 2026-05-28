import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Sub-fase control de acceso secretaria: bloqueo server-side de TODO el árbol
// /expediente para el rol 'secretaria'. La secretaria gestiona agenda y alta de
// pacientes, NO el expediente clínico. Cubre lista + detalle + sub-rutas por
// composición; los layouts subscription-gate de sub-rutas siguen aplicándose.
export default async function ExpedienteLayout({
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
