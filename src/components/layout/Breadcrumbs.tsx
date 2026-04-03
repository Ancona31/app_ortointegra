'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'

const LABELS: Record<string, string> = {
  expediente:       'Expediente',
  'nueva-nota':     'Nueva Nota',
  documentos:       'Documentos',
  laboratorios:     'Laboratorios',
  editar:           'Editar Paciente',
  'nuevo':          'Nuevo Paciente',
  suplementacion:   'Suplementación',
  perfil:           'Mi Perfil',
  admin:            'Admin',
  usuarios:         'Usuarios',
  'super-admin':    'Super Admin',
  clinicas:         'Clínicas',
  metricas:         'Métricas',
  pacientes:        'Pacientes',
}

// Segmentos que son UUIDs (no mostrar como label)
function esUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

export default function Breadcrumbs({ pacienteNombre }: { pacienteNombre?: string }) {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  // No mostrar breadcrumbs en rutas de nivel 1
  if (segments.length <= 1) return null

  const crumbs: { label: string; href: string }[] = [{ label: 'Inicio', href: '/dashboard' }]

  segments.forEach((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/')
    if (esUUID(seg)) {
      crumbs.push({ label: pacienteNombre || 'Paciente', href })
    } else if (LABELS[seg]) {
      crumbs.push({ label: LABELS[seg], href })
    }
  })

  if (crumbs.length <= 1) return null

  return (
    <nav className="flex items-center gap-1 flex-wrap">
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex items-center gap-1">
          {i === 0 && <Home size={10} className="text-[#86868b]" />}
          {i < crumbs.length - 1 ? (
            <Link href={c.href} className="text-[11px] text-[#86868b] hover:text-[#1e5fa8] transition-colors font-medium">{c.label}</Link>
          ) : (
            <span className="text-[11px] text-[#3d3d3f] font-semibold">{c.label}</span>
          )}
          {i < crumbs.length - 1 && <ChevronRight size={10} className="text-slate-300" />}
        </span>
      ))}
    </nav>
  )
}
