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

  /* ⚠️ LAS TRES COLUMNAS NO SON PARA ESTE LAYOUT: SON PARA
     `getSubscriptionState`, QUE LAS RECIBE ABAJO. Aquí sólo se mira `role`.
     Van juntas en este `select` porque pedirlas cuesta LO MISMO que pedir una
     —es la misma fila, el mismo viaje— mientras que dejar que la función las
     pida por su cuenta cuesta un viaje entero MÁS un `auth.getUser()`, que
     siempre sale a la red.
     La lista tiene que coincidir con `PerfilParaSuscripcion` en
     `lib/subscription.ts`; si quitas una de aquí, el estado de suscripción se
     calcula con un campo `undefined` y NO falla en compilación. */
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, clinica_id, es_admin_de_clinica')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'super_admin') {
    redirect('/super-admin/dashboard')
  }

  // Fase 8.2: estado de suscripción server-side. Single source of truth
  // para SuscripcionBanner + intercepts de UI + layouts-guard hijos.
  /* ⚠️ EL PERFIL VIAJA COMO PARÁMETRO PARA QUE NO SE VUELVA A CONSULTAR. Sin
     él, esta llamada repetía el `auth.getUser()` de arriba y el `profiles` de
     aquí mismo: dos viajes por cada render de cada página de `(app)`, uno de
     ellos al servidor de Auth. El razonamiento largo está en la cabecera de
     `getSubscriptionState`.
     ⚠️ `?? undefined` Y NO `profile!`: si la consulta de arriba falló, `profile`
     es null y lo correcto es NO pasar nada, para que la función resuelva por su
     cuenta y caiga en su FAIL_OPEN documentado. Es un camino de error raro
     donde se paga un viaje de más; a cambio, nunca se le entrega un perfil
     vacío como si fuera bueno. */
  const subscriptionState = await getSubscriptionState(supabase, profile ?? undefined)

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
              {/* ⚠️ EL ENVOLTORIO ES DEL PASO 10 Y NO ES DECORATIVO. Este
                  banner es el PRIMER elemento del documento, así que desde que
                  el viewport es `viewport-fit=cover` sus primeros ~50 px caen
                  bajo la barra de estado —y bajo la franja navy que los tapa—,
                  o sea que se perdería media frase y parte del botón de
                  reactivar. El relleno lo baja hasta debajo del reloj.
                  ⚠️ `empty:hidden` NO SOBRA: el banner devuelve `null` cuando la
                  suscripción está al día, que es el caso normal. Sin esto, el
                  envoltorio seguiría midiendo el área segura y metería esa
                  altura en blanco arriba de las veinte páginas — el hueco
                  duplicado clásico. Vacío, desaparece.
                  ⚠️ SE HACE AQUÍ Y NO EN `SuscripcionBanner.tsx` porque ese
                  componente lo comparte `(launcher)/inicio`, que tiene otro
                  cromo; esto es la corrección del layout de `(app)`. */}
              <div className="empty:hidden pt-[env(safe-area-inset-top,0px)]">
                <SuscripcionBanner desktopSidebarOffset />
              </div>
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
                      reaparece un segundo scroll. El razonamiento largo está allí.

                      ⚠️ Y ESO ES LO QUE SE ACABA DE HACER EN EL PASO 10: al sumar
                      aquí las áreas seguras (ver la nota pegada al `div`), el
                      `h-[calc(100dvh-88px)]` de la agenda ha pasado a restar
                      TAMBIÉN los dos `env()`. Los dos lados siguen casando en las
                      dos ramas. */}
                  {/* ⚠️ EL RELLENO VERTICAL LLEVA EL ÁREA SEGURA SUMADA
                      (bloque 6 · paso 10). Los números de diseño son los de
                      siempre —64/24 en móvil, 32/32 en `lg`— y el `env()` se
                      SUMA, no los sustituye: en escritorio y en una pestaña de
                      navegador vale 0 y esto es carácter por carácter el
                      `pt-16 pb-6 lg:pt-8 lg:pb-8` de antes.
                      Hace falta porque con `viewport-fit=cover` estos 64 px ya
                      no se miden desde debajo del reloj sino desde el borde
                      FÍSICO de la pantalla, y una muesca de iPhone se come
                      hasta 59 de ellos: al contenido le quedaban 5.
                      ⚠️ EL HORIZONTAL NO LO LLEVA, Y ES DELIBERADO. Los insets
                      laterales sólo valen algo en apaisado, y el manifiesto fija
                      `orientation: portrait-primary`. Si algún día se permite
                      girar, aquí van `env(safe-area-inset-left/right)`. */}
                  <div className="min-h-full pt-[calc(4rem+env(safe-area-inset-top,0px))] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] lg:pt-[calc(2rem+env(safe-area-inset-top,0px))] lg:px-8 lg:pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
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
