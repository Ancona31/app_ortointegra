import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ToastProvider } from '@/components/ui/Toast'
import CommandPalette from '@/components/CommandPalette'
import PageTransition from '@/components/layout/PageTransition'
import SessionGuard from '@/components/SessionGuard'
import OfflineAlert from '@/components/ui/OfflineAlert'
import SuscripcionBanner from '@/components/billing/SuscripcionBanner'
import { SubscriptionGateProvider } from '@/components/billing/SubscriptionGateProvider'
import { getSubscriptionState } from '@/lib/subscription'
import { AuthProvider } from '@/lib/auth-context'
import { ConsultorioActivoProvider } from '@/contexts/ConsultorioActivoContext'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
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

  if (profile?.role === 'super_admin') {
    redirect('/super-admin/dashboard')
  }

  // Fase 8.2: estado de suscripción server-side. Single source of truth
  // para SuscripcionBanner + intercepts de UI + layouts-guard hijos.
  const subscriptionState = await getSubscriptionState(supabase)

  return (
    <AuthProvider>
      <ToastProvider>
        <ThemeProvider>
          <SubscriptionGateProvider initialState={subscriptionState}>
            <ConsultorioActivoProvider>
              <OfflineAlert />
              <SuscripcionBanner desktopSidebarOffset />
              <div className="flex h-screen overflow-hidden">
                <Sidebar />
                <main className="flex-1 lg:ml-60 overflow-y-auto">
                  <div className="min-h-full pt-16 px-4 pb-6 lg:pt-8 lg:px-8 lg:pb-8">
                    <ErrorBoundary>
                      <PageTransition>
                        {children}
                      </PageTransition>
                    </ErrorBoundary>
                  </div>
                </main>
              </div>
              <CommandPalette />
              <SessionGuard />
            </ConsultorioActivoProvider>
          </SubscriptionGateProvider>
        </ThemeProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
