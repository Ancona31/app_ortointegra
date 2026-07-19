import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSubscriptionState } from '@/lib/subscription'

// Capa 2 Fase 8.2: bloqueo server-side de la ruta /documentos. Cubre
// los 8 formularios (receta, lab, imagen, suplementacion, internamiento,
// escrito, consentimiento, honorarios) que renderizan PDF y consumen
// recursos. La RLS documentos_gates_insert (etapa 5.G, RESTRICTIVE, en
// producción desde 2026-05-30) sigue siendo la barrera real porque el
// frontend hace inserts directos a Supabase sin pasar por endpoint.
export default async function DocumentosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const state = await getSubscriptionState(supabase)
  if (state.isBlocked) redirect('/billing')
  return <>{children}</>
}
