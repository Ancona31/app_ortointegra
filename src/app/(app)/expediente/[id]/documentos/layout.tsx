import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSubscriptionState } from '@/lib/subscription'

// Capa 2 Fase 8.2 (hotfix): segunda superficie de creación de documentos.
// Espejo de /documentos pero con paciente pre-cargado vía [id]. Renderiza
// los mismos 8 formularios y por tanto debe estar igualmente protegida
// que /documentos. Si la suscripción está cancelada y la clínica excede
// el plan free, redirige a /billing antes de cargar formularios y
// disparar generación de PDFs.
export default async function ExpedienteDocumentosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const state = await getSubscriptionState(supabase)
  if (state.isBlocked) redirect('/billing')
  return <>{children}</>
}
