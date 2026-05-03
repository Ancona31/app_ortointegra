import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/components/launcher/ThemeContext'
import { createClient } from '@/lib/supabase/server'
import { getSubscriptionState } from '@/lib/subscription'
import { SubscriptionGateProvider } from '@/components/billing/SubscriptionGateProvider'
import SuscripcionBanner from '@/components/billing/SuscripcionBanner'

// Fase 8.2: el launcher (/inicio) tiene su propio layout, separado del
// (app)/layout.tsx. Necesita su propio Provider para que las cards de
// "Consulta rapida" / "Documento rapido" puedan interceptar clicks vía
// useSubscriptionGate, y para que el banner aparezca también aquí
// (antes de Fase 8.2 NO se mostraba porque vivía solo en (app)).
export default async function LauncherLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const subscriptionState = await getSubscriptionState(supabase)

  return (
    <ToastProvider>
      <ThemeProvider>
        <SubscriptionGateProvider initialState={subscriptionState}>
          <SuscripcionBanner />
          {children}
        </SubscriptionGateProvider>
      </ThemeProvider>
    </ToastProvider>
  )
}
