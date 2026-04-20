'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronRight, Search } from 'lucide-react'
import { CALCULADORAS_REGISTRY } from '@/lib/calculadoras/registry'
import { getEspecialidad } from '@/lib/calculadoras/categorias'
import EspecialidadDropdown, { type EspecialidadFilter } from '@/components/calculadoras/EspecialidadDropdown'

function HubInner() {
  const params = useSearchParams()
  const pacienteId = params.get('paciente')
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<EspecialidadFilter>('todas')

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return CALCULADORAS_REGISTRY.filter(c => {
      if (filtro !== 'todas' && c.especialidad !== filtro) return false
      if (!q) return true
      return c.nombre.toLowerCase().includes(q) || c.descripcion.toLowerCase().includes(q)
    })
  }, [busqueda, filtro])

  function buildHref(slug: string) {
    return pacienteId
      ? `/calculadoras-clinicas/${slug}?paciente=${pacienteId}`
      : `/calculadoras-clinicas/${slug}`
  }

  return (
    <main className="px-6 py-8 max-w-6xl mx-auto" style={{ animation: 'pageEnter 0.24s cubic-bezier(0.32, 0.72, 0, 1) both' }}>
      <header className="mb-8">
        <p className="text-[11px] font-semibold uppercase text-slate-500 mb-2" style={{ letterSpacing: '0.08em' }}>
          Herramientas clínicas
        </p>
        <h1 className="text-slate-900 font-bold leading-tight" style={{ fontSize: '36px', letterSpacing: '-1px' }}>
          Calculadoras clínicas
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Fórmulas validadas por especialidad. {pacienteId && 'Los resultados se podrán guardar en el expediente.'}
        </p>
      </header>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="search"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar calculadora…"
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 outline-none transition-all duration-200"
            style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--cp)'
              e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--cp) 18%, transparent)'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = ''
              e.currentTarget.style.boxShadow = ''
            }}
          />
        </div>
        <EspecialidadDropdown value={filtro} onChange={setFiltro} />
      </div>

      {filtradas.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <p className="text-sm text-slate-500">Sin calculadoras que coincidan con tu búsqueda.</p>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          {filtradas.map(c => {
            const esp = getEspecialidad(c.especialidad)
            const Icon = esp.icon
            return (
              <Link
                key={c.slug}
                href={buildHref(c.slug)}
                className="group flex items-start gap-3 bg-white border border-slate-200 rounded-2xl p-4 transition-all duration-200 hover:border-slate-300"
                style={{
                  transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'
                }}
              >
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${esp.color}14`, color: esp.color }}
                >
                  <Icon size={18} strokeWidth={2} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold uppercase text-slate-400 mb-0.5" style={{ letterSpacing: '0.06em' }}>
                    {esp.nombre}
                  </p>
                  <p className="text-sm font-semibold text-slate-900 leading-tight">{c.nombre}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{c.descripcion}</p>
                </div>
                <ChevronRight
                  size={16}
                  className="text-slate-300 mt-1 flex-shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-500"
                  style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
                />
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}

export default function CalculadorasHubPage() {
  return (
    <Suspense fallback={<div className="px-6 py-8" />}>
      <HubInner />
    </Suspense>
  )
}
