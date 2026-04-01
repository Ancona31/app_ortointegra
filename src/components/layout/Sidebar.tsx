'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  FileText, Stethoscope, Pill, Menu, X, Home, LogOut, UserPlus, Users, Building2, UserCircle, BarChart2, TrendingUp,
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useProfile, clearProfileCache } from '@/hooks/useProfile'
import { useClinica } from '@/hooks/useClinica'
import { mutate } from 'swr'

const navDoctor = [
  { href: '/dashboard',        label: 'Inicio',         icon: Home },
  { href: '/expediente',       label: 'Expediente',     icon: Stethoscope },
  { href: '/suplementacion',   label: 'Suplementación', icon: Pill },
  { href: '/documentos',       label: 'Documentos',     icon: FileText },
  { href: '/estadisticas',     label: 'Estadísticas',   icon: TrendingUp },
  { href: '/perfil',           label: 'Mi perfil',      icon: UserCircle },
]

const navAdmin = [
  ...navDoctor,
  { href: '/admin/usuarios',   label: 'Usuarios',       icon: Users },
]

const navSuperAdmin = [
  ...navAdmin,
  { href: '/super-admin/clinicas',  label: 'Clínicas',  icon: Building2 },
  { href: '/super-admin/metricas',  label: 'Métricas',  icon: BarChart2 },
]

const navSecretaria = [
  { href: '/dashboard',        label: 'Inicio',         icon: Home },
  { href: '/pacientes/nuevo',  label: 'Nuevo paciente', icon: UserPlus },
  { href: '/expediente',       label: 'Pacientes',      icon: Stethoscope },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { profile } = useProfile()
  const { colorPrimario, colorSecundario, nombreDisplay, subtitulo, logoUrl } = useClinica()

  const navItems = profile?.role === 'secretaria'
    ? navSecretaria
    : profile?.role === 'super_admin'
      ? navSuperAdmin
      : profile?.role === 'admin'
        ? navAdmin
        : navDoctor

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    clearProfileCache()
    await mutate('/api/me/clinica', null, { revalidate: false })
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-4 left-4 z-50 text-white p-2 rounded-lg shadow-lg"
        style={{ backgroundColor: colorPrimario }}
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
      <aside
        style={{ backgroundColor: colorPrimario }}
        className={`
          fixed top-0 left-0 h-full w-64 text-white z-40 flex flex-col
          transition-transform duration-300 shadow-2xl
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo y nombre */}
        <div className="flex flex-col items-center gap-3 px-6 py-6 border-b border-white/10">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center overflow-hidden shadow-lg">
            {logoUrl && logoUrl.startsWith('https://') ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <img
                src="/logo.png"
                alt="Logo"
                className="w-18 h-18 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
          </div>
          <div className="text-center">
            <p className="font-semibold text-sm leading-tight">
              {nombreDisplay ?? profile?.nombre ?? ''}
            </p>
            <p className="text-xs text-blue-300 mt-1 leading-tight">
              {profile?.role === 'secretaria'
                ? 'Asistente Médico/a'
                : subtitulo ?? profile?.especialidad ?? ''}
            </p>
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
                style={active ? { backgroundColor: colorSecundario } : undefined}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                  transition-all duration-150
                  ${active
                    ? 'text-white shadow-md'
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
          {profile?.cedula_profesional && (
            <p className="text-xs text-blue-400 text-center">Céd. Prof. {profile.cedula_profesional}</p>
          )}
          {profile?.cedula_especialidad && (
            <p className="text-xs text-blue-400 text-center">{profile.cedula_especialidad}</p>
          )}
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
