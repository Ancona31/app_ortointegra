import { redirect } from 'next/navigation'
import { SWRConfig } from 'swr'
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
import { MenuMovilProvider } from '@/contexts/MenuMovilContext'

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
    /* Configuracion SWR de toda (app). Antes no habia ninguna, asi que regian
       los defaults y cada hook redefinia lo suyo a mano.
       - keepPreviousData: al cambiar de clave se conserva lo anterior mientras
         llega lo nuevo, en vez de parpadear a undefined.
       - focusThrottleInterval: el default son 5 s, que en la practica revalida
         en cada alt-tab. Cinco minutos corta el grueso de esas peticiones.
       ⚠ `revalidateOnFocus` se queda ENCENDIDO a proposito. Es una aplicacion
       clinica: un dato rancio despues de cambiar de pestana es peor que una
       peticion de mas. El throttle da el beneficio sin ese riesgo. */
    <SWRConfig value={{ keepPreviousData: true, focusThrottleInterval: 300_000 }}>
    <AuthProvider>
      <ToastProvider>
        <ThemeProvider>
          <SubscriptionGateProvider initialState={subscriptionState}>
            <ConsultorioActivoProvider>
            {/* El abierto/cerrado del menú lateral en móvil. Va AQUÍ y no dentro
                del `Sidebar` porque tiene que alcanzar también a sus HERMANOS:
                la agenda móvil pone su hamburguesa dentro de su propia banda.
                Ver la nota del contexto. */}
            <MenuMovilProvider>
              <OfflineAlert />
              <SuscripcionBanner desktopSidebarOffset />
              <div className="flex h-screen overflow-hidden">
                <Sidebar />
                <main className="flex-1 lg:ml-64 overflow-y-auto">
                  {/* ⚠️ EL PADDING VERTICAL DE ESTE DIV ESTÁ REPLICADO A MANO EN LA
                      AGENDA. `src/app/(app)/agenda/page.tsx` acota la altura de su
                      raíz con `h-[calc(100dvh-88px)] lg:h-[calc(100dvh-64px)]` para
                      partir la vista en zona fija + rejilla con scroll, y esos dos
                      números son exactamente pt-16+pb-6 (88px) y lg:pt-8+lg:pb-8
                      (64px) de aquí.

                      ⚠️⚠️ Y LA AGENDA SE SALTA ESTE PADDING DE `lg` EN ADELANTE.
                      `globals.css`, en la regla `main > div:has(.agenda-fc)` que
                      está junto a `.agenda-fc`, lo baja a 16 px SÓLO en esa página:
                      su hijo es la tarjeta del calendario, que ya trae marco
                      propio, y esos 64 px le costaban 1,4 horas de rejilla en un
                      portátil. Las otras 20 páginas del layout NO se tocan y siguen
                      con los 64 de aquí.
                      Si cambias el padding de abajo, esa regla y el `lg:` de la
                      agenda son el respaldo mutuo: mira las dos notas antes.
                      No pudo resolverse con `h-full` porque este div es
                      `min-h-full`, y un `min-height` no da altura definida al
                      porcentaje de un hijo — tocar eso cambiaría el layout de toda
                      la app, así que la agenda paga la duplicación.
                      SI CAMBIAS ESTE PADDING, ACTUALIZA ESOS DOS NÚMEROS: la agenda
                      no falla de forma visible, sólo se desajusta en silencio y le
                      reaparece un segundo scroll. El razonamiento largo está allí. */}
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
            </MenuMovilProvider>
            </ConsultorioActivoProvider>
          </SubscriptionGateProvider>
        </ThemeProvider>
      </ToastProvider>
    </AuthProvider>
    </SWRConfig>
  )
}
