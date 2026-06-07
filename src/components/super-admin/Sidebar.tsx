'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  DollarSign,
  Activity,
  ScrollText,
  AlertTriangle,
  Scale,
  LogOut,
} from 'lucide-react'
import type { ReactElement } from 'react'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

const NAV: ReadonlyArray<NavItem> = [
  { href: '/super-admin/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { href: '/super-admin/dashboard/clinicas', label: 'Clínicas y usuarios', icon: Building2 },
  { href: '/super-admin/dashboard/ingresos', label: 'Ingresos', icon: DollarSign },
  { href: '/super-admin/dashboard/uso', label: 'Uso de plataforma', icon: Activity },
  { href: '/super-admin/dashboard/audit', label: 'Audit log', icon: ScrollText },
  { href: '/super-admin/dashboard/alertas', label: 'Alertas', icon: AlertTriangle },
  { href: '/super-admin/dashboard/legal', label: 'Legal / ARCO', icon: Scale },
]

export default function SuperAdminSidebar(): ReactElement {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout(): Promise<void> {
    // NOM-024: registrar logout antes de cerrar sesión (no bloqueante)
    try {
      await fetch('/api/auth/audit-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      })
    } catch { /* silent */ }

    try { sessionStorage.removeItem('spinus_active') } catch { /* silent */ }
    try { localStorage.removeItem('spinus_session_meta') } catch { /* silent */ }

    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch { /* silent */ }

    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 bg-slate-900 border-r border-slate-800 sticky top-0 h-screen">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-slate-800">
        <Image
          src="/logo-spinus.png"
          alt="Spinus"
          width={800}
          height={777}
          className="object-contain h-7 w-auto"
          priority
        />
        <div className="flex flex-col leading-none">
          <span className="text-[14px] font-bold text-slate-100">Spinus®</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">
            Centro de control
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === '/super-admin/dashboard'
              ? pathname === '/super-admin/dashboard'
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
              }`}
            >
              {isActive ? (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r bg-[#1e5fa8]" />
              ) : null}
              <Icon size={16} className={isActive ? 'text-[#1e5fa8]' : ''} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-800 space-y-1">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
        >
          <LogOut size={14} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
