import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSubscriptionState } from '@/lib/subscription'

// Capa 2 Fase 8.2: bloqueo server-side de la ruta de creación de
// consulta. Crítico porque esta ruta dispara generación con Gemini IA.
// Si la suscripción está cancelada y la clínica excede el plan free,
// redirige a /billing antes de renderizar el page client (que ya hubiera
// cargado formularios y disparado IA al guardar).
export default async function NuevaNotaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const state = await getSubscriptionState(supabase)
  if (state.isBlocked) redirect('/billing')
  return <>{children}</>
}
