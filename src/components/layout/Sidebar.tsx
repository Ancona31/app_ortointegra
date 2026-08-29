'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Home, Stethoscope, Pill, FileText, FlaskConical, ScanLine,
  ClipboardList, BedDouble, PenLine, ShieldCheck, Receipt,
  CalendarDays, BarChart2, Users, CreditCard, UserCircle,
  HelpCircle, ChevronRight, Menu, X, LogOut, Moon, Sun,
  TrendingUp, UserPlus,
  Calculator,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useMenuMovil } from '@/contexts/MenuMovilContext'
import { useRouter } from 'next/navigation'
import { useProfile, clearProfileCache } from '@/hooks/useProfile'
import ConsultorioActivoSelector from '@/components/sidebar/ConsultorioActivoSelector'
import { canManageClinica } from '@/lib/permissions'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { useClinica } from '@/hooks/useClinica'
import { CLAVE_CONFIG } from '@/lib/configApp'
import { useTheme } from '@/components/layout/ThemeProvider'
import { useAuth } from '@/lib/auth-context'
import { useSubscriptionGate } from '@/components/billing/SubscriptionGateProvider'
import { mutate } from 'swr'

// Fase 8.2: hrefs que abren features de pago. Si la suscripción está
// bloqueada, el click muestra el BloqueoFeatureModal en vez de navegar.
// Cubre los 8 documentos del navDoctor y "Nuevo paciente" del navSecretaria.
const BLOCKED_LINK_PREFIXES = ['/documentos?tipo=']
const BLOCKED_EXACT = new Set(['/pacientes/nuevo'])

function isBlockedHref(href: string): boolean {
  if (BLOCKED_EXACT.has(href)) return true
  return BLOCKED_LINK_PREFIXES.some((p) => href.startsWith(p))
}

/* ─── Tipos ───────────────────────────────────────────────── */

type NavLeaf = {
  kind: 'leaf'
  href: string
  label: string
  icon: React.ElementType
  badge?: string
  disabled?: boolean
}

type NavGroup = {
  kind: 'group'
  key: string
  label: string
  icon: React.ElementType
  matchPaths?: string[]   // rutas que activan el grupo aunque no sean hijas directas
  children: NavLeaf[]
}

type NavSection = NavLeaf | NavGroup | { kind: 'divider' }

/* ─── Estructura de navegación ────────────────────────────── */

const DOCS_CHILDREN: NavLeaf[] = [
  { kind: 'leaf', href: '/documentos?tipo=receta',        label: 'Receta médica',          icon: Pill },
  { kind: 'leaf', href: '/documentos?tipo=lab',           label: 'Solicitud de laboratorio', icon: FlaskConical },
  { kind: 'leaf', href: '/documentos?tipo=imagen',        label: 'Solicitud de imagenología', icon: ScanLine },
  { kind: 'leaf', href: '/documentos?tipo=suplementacion',label: 'Plan de suplementación', icon: ClipboardList },
  { kind: 'leaf', href: '/documentos?tipo=internamiento', label: 'Internamiento',           icon: BedDouble },
  { kind: 'leaf', href: '/documentos?tipo=escrito',       label: 'Escrito médico',          icon: PenLine },
  { kind: 'leaf', href: '/documentos?tipo=consentimiento',label: 'Consentimiento',          icon: ShieldCheck },
  { kind: 'leaf', href: '/documentos?tipo=honorarios',    label: 'Honorarios / Cotización', icon: Receipt },
]

function navDoctor(isAdmin: boolean): NavSection[] {
  const adminChildren: NavLeaf[] = [
    { kind: 'leaf', href: '/estadisticas',   label: 'Estadísticas',        icon: TrendingUp },
    ...(isAdmin ? [
      { kind: 'leaf' as const, href: '/admin/usuarios', label: 'Usuarios de la clínica', icon: Users },
      { kind: 'leaf' as const, href: '/billing',        label: 'Facturación',             icon: CreditCard },
    ] : []),
  ]

  return [
    { kind: 'leaf', href: '/dashboard', label: 'Dashboard', icon: Home },
    {
      kind: 'group', key: 'pacientes', label: 'Pacientes', icon: Stethoscope,
      matchPaths: ['/expediente', '/suplementacion'],
      children: [
        { kind: 'leaf', href: '/expediente',    label: 'Expediente',      icon: Stethoscope },
        { kind: 'leaf', href: '/suplementacion', label: 'Suplementación', icon: Pill },
      ],
    },
    { kind: 'leaf', href: '/agenda', label: 'Agenda', icon: CalendarDays },
    { kind: 'leaf', href: '/calculadoras-clinicas', label: 'Calculadoras', icon: Calculator },
    {
      kind: 'group', key: 'documentos', label: 'Documentos', icon: FileText,
      matchPaths: ['/documentos'],
      children: DOCS_CHILDREN,
    },
    {
      kind: 'group', key: 'administracion', label: 'Administración', icon: BarChart2,
      matchPaths: ['/estadisticas', '/admin', '/billing'],
      children: adminChildren,
    },
    { kind: 'divider' },
    { kind: 'leaf', href: '/perfil',  label: 'Mi perfil', icon: UserCircle },
    { kind: 'leaf', href: '/ayuda',   label: 'Ayuda',     icon: HelpCircle },
  ]
}

function navSecretaria(): NavSection[] {
  return [
    { kind: 'leaf', href: '/dashboard', label: 'Dashboard', icon: Home },
    {
      kind: 'group', key: 'pacientes', label: 'Pacientes', icon: Stethoscope,
      matchPaths: ['/expediente'],
      children: [
        { kind: 'leaf', href: '/expediente',      label: 'Expediente',         icon: Stethoscope },
        { kind: 'leaf', href: '/pacientes/nuevo', label: 'Nuevo paciente',     icon: UserPlus },
      ],
    },
    { kind: 'leaf', href: '/agenda', label: 'Agenda', icon: CalendarDays },
  ]
}

/* ─── Helpers ─────────────────────────────────────────────── */

function leafIsActive(href: string, pathname: string) {
  const base = href.split('?')[0]
  if (base === '/inicio') return pathname === '/inicio'
  return pathname === base || pathname.startsWith(base + '/')
}

function groupHasActiveChild(group: NavGroup, pathname: string) {
  if (group.matchPaths?.some(p => pathname.startsWith(p))) return true
  return group.children.some(c => leafIsActive(c.href, pathname))
}



/* ─── Componente ──────────────────────────────────────────── */

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  /* ⚠️ EL ABIERTO/CERRADO DEL MENÚ MÓVIL YA NO VIVE AQUÍ, y el cambio es del
     bloque 6. Aquí estuvo como `useState` local, que bastaba mientras el único
     botón que lo tocaba era el de este mismo componente. Dejó de bastar cuando
     la agenda móvil metió su hamburguesa DENTRO de su banda azul: ese botón está
     en un componente HERMANO de éste y no podía alcanzar un estado local.
     El comportamiento no cambia en ninguna página: el botón flotante de abajo
     sigue existiendo igual y sigue siendo quien lo abre en las otras veinte. Lo
     único que cambia es DÓNDE se guarda el booleano. Ver `MenuMovilContext`. */
  const { abierto: mobileOpen, alternar: alternarMenu, cerrar: cerrarMenu } = useMenuMovil()
  const [expanded, setExpanded]     = useState<Set<string>>(new Set())
  const { profile }  = useProfile()
  const { nombreDisplay, subtitulo, logoUrl } = useClinica()
  const { dark, toggle } = useTheme()
  const { signOut } = useAuth()
  const { state: subState, openBloqueoModal } = useSubscriptionGate()

  const isAdmin = canManageClinica(profile)

  const sections: NavSection[] =
    profile?.role === 'secretaria'
      ? navSecretaria()
      : navDoctor(isAdmin)

  /* Auto-expandir grupos con hijo activo */
  useEffect(() => {
    const toOpen = new Set<string>()
    sections.forEach(s => {
      if (s.kind === 'group' && groupHasActiveChild(s, pathname)) {
        toOpen.add(s.key)
      }
    })
    setExpanded(toOpen)
  }, [pathname])

  function toggleGroup(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  /* ⚠ LA CACHÉ DE CONFIGURACIÓN SE VACÍA AL DESMONTARSE ESTE SIDEBAR, NO DENTRO
     DE `handleLogout`, Y NO ES UN CAPRICHO DE ESTILO.

     `CLAVE_CONFIG` no es solo la clave de `useClinica`: desde que los cuatro
     endpoints se consolidaron en /api/me/config es TAMBIÉN la de
     `useConsultorios`. Vaciarla dentro del handler la vaciaba mientras el árbol
     de (app) seguía montado —`router.push` no desmonta nada de forma síncrona—,
     y `PrimerConsultorioModal` cuelga de `ConsultorioActivoProvider`
     ((app)/layout.tsx:54), o sea que estaba en pantalla justo en ese instante.
     `internalMutate` de SWR fija `data` y limpia `error`, pero NUNCA toca
     `isLoading`: el hook quedaba en `consultorios: []` con `isLoading: false`
     —un «no tienes ninguno» falso y estable, no un destello— y el modal de
     configuración salía en CADA cierre de sesión, sin salida por Escape.

     El desmontaje ES la señal de que la navegación ya sacó al usuario del árbol:
     cuando esta limpieza corre, el modal ya no existe. El ref evita que un
     desmontaje ajeno al logout (StrictMode en desarrollo, por ejemplo) borre la
     caché de una sesión viva. */
  const cerrandoSesionRef = useRef(false)

  useEffect(() => {
    return () => {
      if (cerrandoSesionRef.current) {
        mutate(CLAVE_CONFIG, null, { revalidate: false })
      }
    }
  }, [])

  async function handleLogout() {
    // NOM-024: registrar logout antes de cerrar sesión
    fetch('/api/auth/audit-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    }).catch(() => {})
    // signOut() del AuthContext es la ÚNICA fuente de limpieza:
    // stopMirrorEngine → clearMirror → cookies sb-* → sessionStorage → SDK signOut
    await signOut()
    clearProfileCache()
    // Marca para el cleanup de arriba; la caché del agregado —clínica,
    // consultorios, horario y médicos de la sesión que cierra— se vacía cuando
    // este componente se desmonte, no ahora.
    cerrandoSesionRef.current = true
    router.push('/login')
    router.refresh()
  }

  function close() { cerrarMenu() }

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <>
      {/* Mobile toggle.

          ⚠️ SE ESCONDE EN LA AGENDA, Y SÓLO AHÍ. Esa página sustituye el
          encabezado móvil por una banda azul con su propio hamburguesa dentro
          (bloque 6), así que este botón flotante quedaría duplicado y encima
          por delante de la banda. En las otras veinte páginas no cambia nada.
          El estado es el mismo en los dos sitios —vive en `MenuMovilContext`—,
          o sea que el de la banda abre este mismo menú.

          ⚠️⚠️ QUIEN LO ESCONDE ES CSS, NO ESTE COMPONENTE, Y EL CRITERIO SE
          INVIRTIÓ A SABIENDAS. La regla es `body:has(.ag-banda-movil)
          .menu-flotante` y vive en `globals.css`, pegada a la banda.

          AQUÍ ESTUVO ESCRITO LO CONTRARIO, y conviene saber por qué dejó de
          valer antes de reponerlo. Decía: «se decide por `pathname` y no por
          CSS; la alternativa se descartó porque `:has()` degrada a "la regla no
          casa", y aquí eso significa DOS hamburguesas encima de la banda, que es
          peor que el defecto que viene a evitar».

          El razonamiento comparaba mal los dos lados porque no se sabía cuál era
          el defecto que se evitaba. Con `pathname`, el botón se esconde en el
          PRIMER render, mientras que la banda no aparece hasta que corre el
          efecto que descubre el ancho (`isMobile` arranca en `false` en
          `agenda/page.tsx`). En esa ventana no hay hamburguesa NINGUNO: ni éste
          ni el de la banda. Y no es sólo un parpadeo — si un efecto de
          `AgendaPage` anterior a ése lanza, React ABORTA el resto de la lista de
          efectos de ese fiber (`commitHookEffectListMount` en
          `react-dom-client`: el `try` envuelve el bucle entero y el `catch` está
          fuera), así que el de `isMobile` no corre nunca. La página cae al
          `ErrorBoundary`, que en `(app)/layout.tsx` sólo envuelve a `{children}`
          y deja vivo a este `Sidebar` — con el botón escondido y `pathname`
          todavía en `/agenda`. Teléfono sin ninguna vía al menú, y sin
          navegación en la tarjeta de error. Callejón sin salida, no fealdad.

          Así que la comparación real no es «una hamburguesa contra dos», es
          «dos contra CERO»:
            · `:has()` no soportado o la banda ausente → la regla no casa → este
              botón SE QUEDA. Dos hamburguesas un instante en el peor caso, y el
              menú siempre alcanzable.
            · `pathname` → el botón se va aunque no haya banda que lo sustituya.
          El fallo de CSS degrada hacia el lado seguro y el de JS hacia el
          peligroso. Por eso se cambió.

          Y la condición ya no es un ESPEJO de la banda: es la banda. La regla
          pregunta por el nodo real en el DOM, así que no puede desincronizarse de
          él como sí podía una copia de la ruta o una bandera en un contexto.

          `:has()` lo soporta Chrome 105+, y esta misma hoja ya lo usa para el
          relleno de esta página (`main > div:has(.agenda-fc)`).

          SI VUELVES A PONER `pathname` AQUÍ, relee esto: reintroduce el cero. */}
      {/* ⚠️ EL `top` LLEVA EL ÁREA SEGURA SUMADA (bloque 6 · paso 10). Con
          `viewport-fit=cover` los 16 px de `top-4` se miden desde el borde
          FÍSICO, y una muesca de iPhone mide entre 47 y 59: este botón nacía
          DEBAJO DEL RELOJ, medio tapado y con la mitad de su área táctil comida
          por el sistema. Es el único acceso al menú en las veinte páginas que no
          son la agenda, así que no es un detalle estético.
          El 16 de diseño no se toca: se suma. En escritorio y en una pestaña
          normal el `env()` vale 0 y esto es exactamente el `top-4` de siempre.
          ⚠️ TIENE QUE QUEDAR POR ENCIMA DE LA FRANJA NAVY de `globals.css`
          (`body::before`, z-index 45) y por eso conserva su `z-50`. Si alguien
          sube la franja por encima de 50, este botón desaparece. */}
      <button
        onClick={alternarMenu}
        /* `menu-flotante` NO PINTA NADA: es el asidero de la regla de arriba. Su
           única razón de ser es que el selector no cuelgue de las utilidades de
           Tailwind, que cambian con cualquier retoque visual. No la quites al
           reordenar clases. */
        className="menu-flotante lg:hidden fixed top-[calc(1rem+env(safe-area-inset-top,0px))] left-4 z-50 text-white p-2 rounded-lg shadow-lg"
        style={{ background: 'var(--cp)' }}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-30" onClick={close} />
      )}

      {/* Sidebar */}
      {/* ⚠️ EL RELLENO VERTICAL ES DEL PASO 10. El `inset-y-0` llega a los dos
          bordes físicos desde que el viewport es `viewport-fit=cover`, así que
          sin esto el logo y el nombre del médico se meten bajo la barra de
          estado y, abajo, «Cerrar sesión» y el aviso de privacidad quedan bajo
          la barra de gestos — con el dedo compitiendo con el gesto de volver al
          inicio, que es la peor mezcla posible para un botón de salir.
          ⚠️ VA COMO RELLENO Y NO COMO `inset`, a propósito: el navy tiene que
          seguir llegando a los cuatro bordes —un menú que se queda corto arriba
          enseña una franja del fondo de la página y se lee como un panel mal
          puesto—. El relleno encoge el CONTENIDO y deja el fondo entero.
          ⚠️ ES EL MISMO NAVY QUE LA FRANJA de `globals.css`, así que en la app
          instalada el menú y la barra de estado son una sola superficie.
          ⚠️ SE APAGA EN `lg`: en escritorio no hay áreas seguras que valgan y
          los `env()` ya devuelven 0, pero dejarlo explícito evita que un futuro
          navegador de escritorio con insets meta relleno donde no toca. */}
      <aside
        style={{
          background: 'hsl(from var(--cp, #1a3a5c) h s 20%)',
        }}
        className={`
          fixed inset-y-0 left-0 w-64 text-white z-40 flex flex-col
          pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] lg:pt-0 lg:pb-0
          transition-transform duration-300
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo + nombre */}
        <div className="flex flex-col items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center overflow-hidden shadow-lg flex-shrink-0">
            {/* 112 = 2× los 56 px del círculo, para pantallas de alta densidad.
                Las dos ramas pasan por next/image: el host de Supabase Storage
                está declarado en `remotePatterns` de next.config.ts. */}
            {logoUrl?.startsWith('https://') ? (
              <Image src={logoUrl} alt="Logo" width={112} height={112}
                className="w-full h-full object-contain" />
            ) : (
              <Image src="/logo.png" alt="Logo" width={112} height={112} priority
                className="w-full h-full object-contain"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            )}
          </div>
          <div className="text-center">
            <p className="font-semibold text-sm leading-tight">
              {nombreDisplay ?? (componerNombreMedicoCompleto(profile ?? {}) || '')}
            </p>
            <p className="text-[11px] opacity-40 mt-0.5 leading-tight">
              {profile?.role === 'secretaria'
                ? 'Asistente Médico/a'
                : subtitulo ?? profile?.especialidad ?? ''}
            </p>
          </div>
        </div>

        <ConsultorioActivoSelector />

        {/* Navegación */}
        <nav className="flex-1 px-2.5 py-3 overflow-y-auto space-y-0.5">
          {sections.map((section, idx) => {

            /* Divider */
            if (section.kind === 'divider') {
              return <div key={`divider-${idx}`} className="my-2 border-t border-white/10" />
            }

            /* Leaf */
            if (section.kind === 'leaf') {
              const active = leafIsActive(section.href, pathname)
              if (section.disabled) {
                return (
                  <div key={section.href}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] opacity-35 cursor-not-allowed select-none">
                    <section.icon size={16} />
                    <span className="flex-1">{section.label}</span>
                    {section.badge && (
                      <span className="ml-auto text-[9px] font-semibold bg-white/15 px-1.5 py-0.5 rounded-full leading-none">
                        {section.badge}
                      </span>
                    )}
                  </div>
                )
              }
              return (
                <Link key={section.href} href={section.href} onClick={close}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                    active ? 'bg-white text-[var(--cp)] shadow-sm' : 'text-white/55 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <section.icon size={16} className={active ? 'opacity-100' : 'opacity-70'} />
                  <span className="flex-1">{section.label}</span>
                </Link>
              )
            }

            /* Group */
            if (section.kind === 'group') {
              const isOpen    = expanded.has(section.key)
              const hasActive = groupHasActiveChild(section, pathname)

              return (
                <div key={section.key}>
                  {/* Header del grupo */}
                  <button
onClick={() => toggleGroup(section.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
hasActive && !isOpen
                          ? 'text-white bg-white/10'
                          : isOpen
                            ? 'text-white/80'
                            : 'text-white/55 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <section.icon size={16} className={hasActive ? 'opacity-100' : 'opacity-70'} />
                    <span className="flex-1 text-left">{section.label}</span>
{<ChevronRight size={13} className={`opacity-50 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                    }
                  </button>

                  {/* Sub-items */}
{isOpen && (
                    <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 space-y-0.5">
                      {section.children.map(child => {
                        const childActive = leafIsActive(child.href, pathname)
                        const childBlocked = subState.isBlocked && isBlockedHref(child.href)
                        return (
                          <Link key={child.href} href={child.href}
                            onClick={(e) => {
                              close()
                              if (childBlocked) {
                                e.preventDefault()
                                openBloqueoModal()
                              }
                            }}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all duration-150 ${
                              childActive ? 'bg-white text-[var(--cp)] shadow-sm' : 'text-white/50 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <child.icon size={13} className={childActive ? 'opacity-100' : 'opacity-60'} />
                            {child.label}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            return null
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-white/10 space-y-0.5">
          <button onClick={toggle}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-150">
            {dark ? <Sun size={14} /> : <Moon size={14} />}
            {dark ? 'Modo claro' : 'Modo oscuro'}
          </button>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-150">
            <LogOut size={14} />
            Cerrar sesión
          </button>
          <Link href="/privacidad" target="_blank"
            className="block text-center text-[10px] text-white/40 hover:text-white/70 transition-colors pt-2">
            Aviso de Privacidad
          </Link>
        </div>
      </aside>
    </>
  )
}
