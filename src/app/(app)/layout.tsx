import { redirect, unstable_rethrow } from 'next/navigation'
import { SWRConfig } from 'swr'
import { sesionServidor, type SesionServidor } from '@/lib/supabase/sesionServidor'
import { CLAVE_CONFIG, type ConfigApp } from '@/lib/configApp'
import { leerConfigApp } from '@/lib/configAppServidor'
import { logger } from '@/lib/logger'
import Sidebar from '@/components/layout/Sidebar'
import ScriptTema from '@/components/layout/ScriptTema'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ToastProvider } from '@/components/ui/Toast'
import CommandPalette from '@/components/CommandPalette'
import PageTransition from '@/components/layout/PageTransition'
import SessionGuard from '@/components/SessionGuard'
import GateOnboarding from '@/components/onboarding/GateOnboarding'
import OfflineAlert from '@/components/ui/OfflineAlert'
import SuscripcionBanner from '@/components/billing/SuscripcionBanner'
import { SubscriptionGateProvider } from '@/components/billing/SubscriptionGateProvider'
import { getSubscriptionState } from '@/lib/subscription'
import { AuthProvider } from '@/lib/auth-context'
import { analizarPerfilSesion } from '@/lib/perfil/perfilSesion'
import { ConsultorioActivoProvider } from '@/contexts/ConsultorioActivoContext'
import { MenuMovilProvider } from '@/contexts/MenuMovilContext'
import CampanaGlobal from '@/components/avisos/CampanaGlobal'
import { agendaV2Encendida } from '@/lib/agenda/ajustesAgenda'

/**
 * La configuración de la app sembrada en el documento (A1.6): lo mismo que
 * `GET /api/me/config` le daría a este usuario, leído con la sesión de
 * `sesionServidor()` —cliente de sesión, RLS— y la clínica de su perfil. Así
 * la carga dura no pide la ruta; ver `revalidarConfigAlMontar` en
 * `lib/configApp.ts`.
 * `null` = no siembra y el cliente pide como antes: sin clínica (la ruta
 * respondería 403), perfil ilegible, o una consulta que falló. Sólo relanza
 * los errores internos de Next (`unstable_rethrow.md`).
 */
async function sembrarConfig({ supabase, profile }: SesionServidor): Promise<ConfigApp | null> {
  if (!profile?.clinica_id) return null
  try {
    const lectura = await leerConfigApp(supabase, profile.clinica_id)
    return lectura.ok ? lectura.config : null
  } catch (err: unknown) {
    unstable_rethrow(err)
    logger.warn('layout', `configuración sin sembrar: ${err instanceof Error ? err.message : 'error'}`)
    return null
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  /* ⚠️ A1.4c: el `getUser()` y el `profiles` de este layout salen de
     `sesionServidor()`, que los comparte con la página de la agenda dentro de
     la MISMA petición (`React.cache`). La autoridad y el redirect son los de
     siempre: `getUser()` contra Auth y, si no hay usuario, `/login`. */
  const sesion = await sesionServidor()
  const { supabase, user, profile } = sesion
  if (!user) redirect('/login')

  /* ⚠️ DESDE A1.2 SE PIDEN LOS 12 CAMPOS DE `Profile` (`COLUMNAS_PERFIL_SESION`)
     PORQUE EL PERFIL SE SIEMBRA EN EL CLIENTE: viaja a `AuthProvider` como
     `perfilInicial` y `useProfile` ya no lo pide desde el navegador. Lo de
     abajo sigue valiendo para tres de ellas.
     ⚠️ `role`, `clinica_id` Y `es_admin_de_clinica` NO SON SÓLO PARA ESTE
     LAYOUT: SON PARA `getSubscriptionState`, QUE LAS RECIBE ABAJO.
     Van juntas en este `select` porque pedirlas cuesta LO MISMO que pedir una
     —es la misma fila, el mismo viaje— mientras que dejar que la función las
     pida por su cuenta cuesta un viaje entero MÁS un `auth.getUser()`, que
     siempre sale a la red.
     ⚠️⚠️ RECORTAR ESTE `select` A `'role'` NO ES UNA LIMPIEZA: ES APAGAR EL
     COBRO. `clinica_id` y `es_admin_de_clinica` parecen columnas muertas porque
     aquí no se miran, pero viajan abajo como parámetro y sin `clinica_id` el
     estado de suscripción cae en FAIL_OPEN —`isBlocked: false`— para TODOS los
     usuarios, sin error y sin log. Y TypeScript no lo caza: el cliente no lleva
     el genérico `Database`, así que `data` es `any`.
     Desde la revisión externa hay una guarda que lo intercepta —`perfilCompleto`
     en `lib/subscription.ts`, que ignora un perfil incompleto y consulta— pero
     esa guarda es la RED, no el permiso: si se dispara, se paga una consulta de
     más en cada render. La lista correcta es ésta.

     ⚠️⚠️ Y HAY UNA SEGUNDA RAZÓN PARA QUE SEA IDÉNTICA A LA DEL `select` INTERNO
     DE `getSubscriptionState`: DE ELLA DEPENDE QUE NO SE HAGA UN VIAJE DE MÁS.

     Ojo con quién ejecuta aquel `select`, porque no es la llamada de aquí abajo
     —ésa pasa el perfil y se salta esa rama—. Son los SEIS layouts que todavía
     llaman sin argumento: `documentos`, `pacientes/nuevo`, `dicom`,
     `expediente/[id]/nueva-nota`, `expediente/[id]/documentos` y `(launcher)`.
     Los cinco primeros cuelgan de ESTE layout, así que en sus rutas se ejecutan
     los dos `select` dentro del mismo render.

     Next desduplica los `fetch` idénticos dentro de un mismo render (Request
     Memoization), y la clave es LA URL — que en Supabase lleva el `select`
     dentro. Con las mismas columnas, esos dos comparten un viaje; con listas
     distintas, cada uno paga el suyo. Reordenarlas también cuenta: la URL cambia.

     No hay nada que avise si se rompe. No es error de compilación, no falla
     ningún test, y el síntoma es una consulta de más por render que sólo se ve
     instrumentando el servidor.

     El caso vivo está en `expediente/[id]/layout.tsx:40`, que pide `role` a
     secas: por eso `/expediente/[id]` hace CUATRO viajes a Supabase donde
     `/documentos` hace tres. Medido. Registrado como PERF-DT-1 en
     `DEUDA_TECNICA.md`, junto con por qué no se resolvió estructuralmente.
     Desde A1.4c ese `select` está en `lib/supabase/sesionServidor.ts`. */

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
  /* La semilla de configuración va EN PARALELO con la suscripción: son
     independientes, y encadenadas el layout tardaría la suma. */
  /* Avisos globales (2026-11-24): el interruptor de la agenda v2 decide si se
     monta la campana de toda la app. Una consulta por PK, en paralelo, sin
     viaje a Auth; FALLA CERRADO (`agendaV2Encendida`): sin fila, sin tabla o
     con error, apagada, y la app es la de antes. Sólo corre en carga completa:
     en navegación suave este layout no se vuelve a renderizar. */
  const clinicaId = typeof profile?.clinica_id === 'string' ? profile.clinica_id : null
  const [subscriptionState, configSembrada, avisosGlobales] = await Promise.all([
    getSubscriptionState(supabase, profile ?? undefined),
    sembrarConfig(sesion),
    clinicaId ? agendaV2Encendida(supabase, clinicaId) : Promise.resolve(false),
  ])

  /* `null` = no se siembra y `useProfile` lo pide él, como antes de A1.2. */
  const perfilInicial = analizarPerfilSesion(profile)

  return (
    /* Configuracion SWR de toda (app). Antes no habia ninguna, asi que regian
       los defaults y cada hook redefinia lo suyo a mano.
       - keepPreviousData: al cambiar de clave se conserva lo anterior mientras
         llega lo nuevo, en vez de parpadear a undefined.
       - focusThrottleInterval: el default son 5 s, que en la practica revalida
         en cada alt-tab. Cinco minutos corta el grueso de esas peticiones.
       ⚠ `revalidateOnFocus` se queda ENCENDIDO a proposito. Es una aplicacion
       clinica: un dato rancio despues de cambiar de pestana es peor que una
       peticion de mas. El throttle da el beneficio sin ese riesgo.
       - fallback (A1.6): la configuracion sembrada arriba, bajo SU clave. Sin
         semilla no se pasa y el cliente pide `/api/me/config` como antes. */
    <>
    <ScriptTema />
    <SWRConfig value={{
      keepPreviousData: true,
      focusThrottleInterval: 300_000,
      ...(configSembrada && { fallback: { [CLAVE_CONFIG]: configSembrada } }),
    }}>
    <AuthProvider perfilInicial={perfilInicial}>
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
              {/* ⚠️ EL CONTENEDOR ES DEL REDISEÑO (B4) Y SÓLO CAMBIA SU JSX: el
                  guarda de arriba no se toca. `h-dvh` y no `h-screen`: en iOS el
                  `100vh` mide con la barra del navegador escondida y el pie se
                  iba bajo ella.
                  ⚠️ LA NAVEGACIÓN SE COLOCA POR FORMATO DESDE `globals.css`
                  (zona «B4 · Navegación por dispositivo»), NO AQUÍ: los márgenes
                  de `<main>` (`.app-main`: barra de 248 a la izquierda en `esc`,
                  barra de 216 a la derecha en `ih`, riel en `ext`) y el relleno
                  del contenido (`.app-contenido`: encabezado fundido en `tel` e
                  `iv`, franjas con `var(--it/--ir/--ib/--il)`). Por eso aquí ya
                  no hay `lg:ml-64` ni números de relleno.
                  ⚠️ ESE RELLENO VERTICAL ESTÁ REPLICADO A MANO EN LA AGENDA, y
                  así sigue: `AgendaCliente.tsx` (la altura de `.agenda-raiz`, el
                  respaldo para cuando `:has()` no existe) y la regla
                  `main > div:has(.agenda-fc)` de `globals.css`, que lo anula en
                  esa página. Si cambias los números de `.app-contenido`, cambia
                  los tres sitios en el mismo commit; el razonamiento largo está
                  junto a `.app-contenido`. */}
              <div className="flex h-dvh overflow-hidden">
                <Sidebar />
                <main className="app-main flex-1 min-w-0 overflow-y-auto">
                  <div className="app-contenido min-h-full">
                    {/* El aviso de suscripción, como TARJETA dentro del área de
                        contenido (B4). Antes iba fuera del contenedor, como
                        banda `sticky`, y con la suscripción bloqueada sumaba su
                        alto a un `h-screen`: aparecía un segundo scroll de
                        documento. Aquí ya respeta barra, riel, encabezado y
                        franjas sin desplazamientos propios.
                        ⚠️ `empty:hidden`: con la suscripción al día devuelve
                        `null` y el envoltorio desaparece. */}
                    <div className="app-banner empty:hidden">
                      <SuscripcionBanner tarjeta />
                    </div>
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
              {/* La campana de avisos de toda la app: sólo con la agenda v2
                  encendida. Fuera de `<main>`, como el gate: no se desmonta al
                  navegar. En `/agenda` se calla sola (manda la de la agenda). */}
              {avisosGlobales && <CampanaGlobal />}
              {/* El gate de perfil (Bloque B5). VA AQUÍ, fuera de `<main>` y de
                  `PageTransition`, con los demás elementos de alcance global:
                  así no se desmonta al navegar y no vuelve a pedir nada. Por
                  qué en el layout y no en una comprobación de servidor, en la
                  cabecera del componente. */}
              <GateOnboarding />
            </MenuMovilProvider>
            </ConsultorioActivoProvider>
          </SubscriptionGateProvider>
        </ThemeProvider>
      </ToastProvider>
    </AuthProvider>
    </SWRConfig>
    </>
  )
}
