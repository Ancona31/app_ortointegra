'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  Users, FileText, FlaskConical, ClipboardList,
  Stethoscope, Pill, Menu, X, Home, LogOut
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard',      label: 'Inicio',           icon: Home },
  { href: '/pacientes',      label: 'Pacientes',        icon: Users },
  { href: '/expediente',     label: 'Expediente',       icon: Stethoscope },
  { href: '/laboratorios',   label: 'Laboratorios',     icon: FlaskConical },
  { href: '/suplementacion', label: 'Suplementación',   icon: Pill },
  { href: '/documentos',     label: 'Documentos',       icon: FileText },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-[#1a3a5c] text-white p-2 rounded-lg shadow-lg"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay mobile */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-30"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-[#1a3a5c] text-white z-40 flex flex-col
        transition-transform duration-300 shadow-2xl
        ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo y nombre doctor */}
        <div className="flex flex-col items-center gap-3 px-6 py-6 border-b border-white/10">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center overflow-hidden shadow-lg">
            <img
              src="/logo.png"
              alt="Logo Dr. Ancona"
              className="w-18 h-18 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          </div>
          <div className="text-center">
            <p className="font-semibold text-sm leading-tight">Dr. Angel M. Ancona Pérez</p>
            <p className="text-xs text-blue-300 mt-1 leading-tight">Cirugía de Columna · Traumatología</p>
          </div>
        </div>

        {/* Navegación */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                  transition-all duration-150
                  ${active
                    ? 'bg-[#1e5fa8] text-white shadow-md'
                    : 'text-blue-200 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-white/10 space-y-3">
          <p className="text-xs text-blue-400 text-center">Céd. Prof. 12085805</p>
          <p className="text-xs text-blue-400 text-center">CMOT 26/5567/25</p>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-blue-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  )
}
