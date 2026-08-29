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
          {/* ⚠️ EL ENVOLTORIO ES DEL ÁREA SEGURA, y es el mismo que ya lleva
              este banner en `(app)/layout.tsx:76`. Aquí no lo tenía: el banner
              es el PRIMER elemento del documento en el launcher, así que con
              `viewport-fit=cover` sus primeros ~50 px caían bajo la barra de
              estado y bajo la franja navy que los tapa — se perdía media frase
              y parte del botón de reactivar.
              ⚠️ `empty:hidden` NO SOBRA: el banner devuelve `null` cuando la
              suscripción está al día, que es el caso normal. Sin esto, el
              envoltorio seguiría midiendo el área segura y metería esa altura
              en blanco encima de /inicio.
              ⚠️ SIN `desktopSidebarOffset`, a diferencia de `(app)`: aquí no
              hay barra lateral que esquivar. Se copia el envoltorio, no la
              prop. */}
          <div className="empty:hidden pt-[env(safe-area-inset-top,0px)]">
            <SuscripcionBanner />
          </div>
          {children}
        </SubscriptionGateProvider>
      </ThemeProvider>
    </ToastProvider>
  )
}
