'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home, Stethoscope, Pill, FileText, FlaskConical, ScanLine,
  ClipboardList, BedDouble, PenLine, ShieldCheck, Receipt,
  CalendarDays, BarChart2, Users, CreditCard, UserCircle,
  HelpCircle, ChevronRight, Menu, X, LogOut, Moon, Sun,
  TrendingUp, UserPlus, WifiOff,
  Calculator,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useProfile, clearProfileCache } from '@/hooks/useProfile'
import { useClinica } from '@/hooks/useClinica'
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
  { kind: 'leaf', href: '/documentos?tipo=imagen',        label: 'Solicitud de imagen',    icon: ScanLine },
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
    { kind: 'leaf', href: '/inicio', label: 'Inicio', icon: Home },
    {
      kind: 'group', key: 'pacientes', label: 'Pacientes', icon: Stethoscope,
      matchPaths: ['/expediente', '/suplementacion', '/pacientes'],
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
    { kind: 'leaf', href: '/offline-setup', label: 'Modo Offline', icon: WifiOff },
  ]
}

function navSecretaria(): NavSection[] {
  return [
    { kind: 'leaf', href: '/inicio', label: 'Inicio',  icon: Home },
    {
      kind: 'group', key: 'pacientes', label: 'Pacientes', icon: Stethoscope,
      matchPaths: ['/expediente', '/pacientes'],
      children: [
        { kind: 'leaf', href: '/pacientes/nuevo', label: 'Nuevo paciente', icon: UserPlus },
        { kind: 'leaf', href: '/expediente',      label: 'Expediente',     icon: Stethoscope },
      ],
    },
    { kind: 'leaf', href: '/agenda', label: 'Agenda', icon: CalendarDays },
    { kind: 'divider' },
    { kind: 'leaf', href: '/perfil', label: 'Mi perfil', icon: UserCircle },
    { kind: 'leaf', href: '/offline-setup', label: 'Modo Offline', icon: WifiOff },
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expanded, setExpanded]     = useState<Set<string>>(new Set())
  const { profile }  = useProfile()
  const { nombreDisplay, subtitulo, logoUrl } = useClinica()
  const { dark, toggle } = useTheme()
  const { signOut } = useAuth()
  const { state: subState, openBloqueoModal } = useSubscriptionGate()

  // Badge offline: verde si ya configuró, gris si no
  const [bunkerReady, setBunkerReady] = useState(false)
  useEffect(() => {
    try { setBunkerReady(!!localStorage.getItem('spinus_session_meta') && !!localStorage.getItem('spinus_doctor_profile')) }
    catch { /* silent */ }
  }, [])

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

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
    await mutate('/api/me/clinica', null, { revalidate: false })
    router.push('/login')
    router.refresh()
  }

  function close() { setMobileOpen(false) }

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 text-white p-2 rounded-lg shadow-lg"
        style={{ background: 'var(--cp)' }}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-30" onClick={close} />
      )}

      {/* Sidebar */}
      <aside
        style={{
          background: 'linear-gradient(180deg, var(--cp) 0%, color-mix(in srgb, var(--cp) 50%, var(--cs)) 30%, var(--cs) 60%, color-mix(in srgb, var(--cs) 40%, white) 100%)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
        }}
        className={`
          fixed top-4 left-4 bottom-4 w-60 text-white z-40 flex flex-col rounded-3xl
          transition-transform duration-300
          ${mobileOpen ? 'translate-x-0' : '-translate-x-[calc(100%+1rem)] lg:translate-x-0'}
        `}
      >
        {/* Logo + nombre */}
        <div className="flex flex-col items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center overflow-hidden shadow-lg flex-shrink-0">
            {logoUrl?.startsWith('https://') ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            )}
          </div>
          <div className="text-center">
            <p className="font-semibold text-sm leading-tight">
              {nombreDisplay ?? profile?.nombre ?? ''}
            </p>
            <p className="text-[11px] opacity-40 mt-0.5 leading-tight">
              {profile?.role === 'secretaria'
                ? 'Asistente Médico/a'
                : subtitulo ?? profile?.especialidad ?? ''}
            </p>
          </div>
        </div>

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
                  {section.href === '/offline-setup' && (
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${bunkerReady ? 'bg-emerald-400' : 'bg-white/25'}`}
                      title={bunkerReady ? 'Búnker activo' : 'Requiere configuración'} />
                  )}
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
            className="block text-center text-[10px] text-white/20 hover:text-white/40 transition-colors pt-2">
            Aviso de Privacidad
          </Link>
        </div>
      </aside>
    </>
  )
}
