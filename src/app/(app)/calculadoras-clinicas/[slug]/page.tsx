'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { ChevronRight, UserCircle2 } from 'lucide-react'
import { getCalculadoraBySlug } from '@/lib/calculadoras/registry'
import { getEspecialidad } from '@/lib/calculadoras/categorias'
import { useCalculadoraContextual } from '@/hooks/useCalculadoraContextual'
import CalculadoraHero from '@/components/calculadoras/CalculadoraHero'
import CalculadoraForm from '@/components/calculadoras/CalculadoraForm'
import ResultadoCard from '@/components/calculadoras/ResultadoCard'
import GuardarExpedienteBtn from '@/components/calculadoras/GuardarExpedienteBtn'
import type { ResultadoInterpretacion } from '@/lib/calculadoras/types'

function DetalleInner() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const slug = params?.slug ?? ''
  const pacienteId = searchParams.get('paciente')

  const calculadora = getCalculadoraBySlug(slug)
  const { paciente, loading } = useCalculadoraContextual(pacienteId)

  const [resultado, setResultado] = useState<ResultadoInterpretacion | null>(null)
  const [inputsCalculados, setInputsCalculados] = useState<Record<string, unknown> | null>(null)

  const valoresIniciales = useMemo(() => {
    if (!calculadora || !paciente || !calculadora.autocompletar) return undefined
    const out: Record<string, string | number | boolean> = {}
    for (const [key, fn] of Object.entries(calculadora.autocompletar)) {
      const v = fn?.(paciente)
      if (v !== undefined && v !== null) out[key] = v as string | number | boolean
    }
    return out
  }, [calculadora, paciente])

  const camposAutocompletados = useMemo(() => {
    if (!valoresIniciales) return new Set<string>()
    return new Set(Object.keys(valoresIniciales))
  }, [valoresIniciales])

  if (!calculadora) {
    return (
      <main className="px-6 py-8 max-w-3xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <p className="text-base font-semibold text-slate-900 mb-2">Calculadora no encontrada</p>
          <p className="text-sm text-slate-500 mb-6">El identificador "{slug}" no corresponde a ninguna calculadora registrada.</p>
          <Link
            href="/calculadoras-clinicas"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'var(--cp)' }}
          >
            Volver al catálogo
          </Link>
        </div>
      </main>
    )
  }

  const esp = getEspecialidad(calculadora.especialidad)
  const modoContextual = !!pacienteId && !!paciente

  return (
    <main className="px-6 py-8 max-w-3xl mx-auto" style={{ animation: 'pageEnter 0.24s cubic-bezier(0.32, 0.72, 0, 1) both' }}>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 mb-6 flex-wrap">
        <Link href="/calculadoras-clinicas" className="hover:text-slate-900 transition-colors">
          Calculadoras clínicas
        </Link>
        <ChevronRight size={12} className="text-slate-300" />
        <span style={{ color: esp.color }} className="font-medium">{esp.nombre}</span>
        <ChevronRight size={12} className="text-slate-300" />
        <span className="text-slate-900 font-medium truncate">{calculadora.nombre}</span>
      </nav>

      {pacienteId && (
        <div
          className="flex items-center gap-3 px-4 py-3 mb-6 bg-blue-50 border border-blue-200 rounded-2xl"
          style={{ animation: 'slideUp 0.32s cubic-bezier(0.32, 0.72, 0, 1) both' }}
        >
          <UserCircle2 size={20} className="text-blue-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase text-blue-600" style={{ letterSpacing: '0.06em' }}>
              Modo contextual
            </p>
            <p className="text-sm font-medium text-blue-900 truncate">
              {loading
                ? 'Cargando paciente…'
                : paciente
                  ? `Calculando para: ${paciente.nombre} ${paciente.apellidos}`
                  : 'No se encontró el paciente especificado.'}
            </p>
          </div>
        </div>
      )}

      <CalculadoraHero calculadora={calculadora} />

      <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
        {pacienteId && loading ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Cargando datos del paciente…
          </div>
        ) : (
          <CalculadoraForm
            calculadora={calculadora}
            valoresIniciales={valoresIniciales}
            camposAutocompletados={camposAutocompletados}
            onCalcular={(r, i) => { setResultado(r); setInputsCalculados(i) }}
          />
        )}
      </section>

      {resultado && (
        <div className="space-y-4">
          <ResultadoCard resultado={resultado} calculadora={calculadora} />
          {modoContextual && pacienteId && inputsCalculados && (
            <GuardarExpedienteBtn
              pacienteId={pacienteId}
              calculadora={calculadora}
              inputs={inputsCalculados}
              resultado={resultado}
            />
          )}
        </div>
      )}
    </main>
  )
}

export default function CalculadoraDetallePage() {
  return (
    <Suspense fallback={<div className="px-6 py-8" />}>
      <DetalleInner />
    </Suspense>
  )
}
