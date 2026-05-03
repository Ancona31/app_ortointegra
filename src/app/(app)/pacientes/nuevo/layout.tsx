import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSubscriptionState } from '@/lib/subscription'

// Capa 2 Fase 8.2: bloqueo server-side de la ruta de creación de
// paciente. Defense in depth sobre el gate del endpoint /api/pacientes
// (Fase 8.1) y la RLS pacientes_block_post_cancellation.
export default async function NuevoPacienteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const state = await getSubscriptionState(supabase)
  if (state.isBlocked) redirect('/billing')
  return <>{children}</>
}
