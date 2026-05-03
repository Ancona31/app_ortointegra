import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSubscriptionState } from '@/lib/subscription'

// Capa 2 Fase 8.2: bloqueo server-side del visor DICOM. Es feature
// premium completa: aunque procesa archivos localmente sin endpoint,
// el acceso a la herramienta debe estar restringido a suscripciones
// activas. No hay Capa 3 (endpoint gate) aplicable porque DICOM no
// persiste nada en servidor.
export default async function DicomLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const state = await getSubscriptionState(supabase)
  if (state.isBlocked) redirect('/billing')
  return <>{children}</>
}
