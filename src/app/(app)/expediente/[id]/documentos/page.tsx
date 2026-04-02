'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Paciente } from '@/types'
import { differenceInYears, parseISO } from 'date-fns'
import { ArrowLeft, Pill, FlaskConical, ScanLine, ClipboardList, BedDouble, PenLine, ShieldCheck, Receipt, Loader2 } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const FormLoader = () => (
  <div className="flex items-center justify-center py-16 text-slate-400">
    <Loader2 size={20} className="animate-spin mr-2" />
    <span className="text-sm">Cargando formulario...</span>
  </div>
)

const RecetaForm = dynamic(() => import('@/components/documentos/RecetaForm'), { ssr: false, loading: FormLoader })
const SolicitudLabForm = dynamic(() => import('@/components/documentos/SolicitudLabForm'), { ssr: false, loading: FormLoader })
const SolicitudImagenForm = dynamic(() => import('@/components/documentos/SolicitudImagenForm'), { ssr: false, loading: FormLoader })
const PlanSuplementacionForm = dynamic(() => import('@/components/documentos/PlanSuplementacionForm'), { ssr: false, loading: FormLoader })
const SolicitudInternamientoForm = dynamic(() => import('@/components/documentos/SolicitudInternamientoForm'), { ssr: false, loading: FormLoader })
const EscritoMedicoForm = dynamic(() => import('@/components/documentos/EscritoMedicoForm'), { ssr: false, loading: FormLoader })
const ConsentimientoInformadoForm = dynamic(() => import('@/components/documentos/ConsentimientoInformadoForm'), { ssr: false, loading: FormLoader })
const NotaHonorariosForm = dynamic(() => import('@/components/documentos/NotaHonorariosForm'), { ssr: false, loading: FormLoader })

const TABS = [
  { key: 'receta', label: 'Receta', icon: Pill, color: 'text-blue-700 border-blue-500 bg-blue-50', inactive: 'text-slate-500 hover:text-blue-600 hover:bg-blue-50' },
  { key: 'lab', label: 'Laboratorio', icon: FlaskConical, color: 'text-emerald-700 border-emerald-500 bg-emerald-50', inactive: 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50' },
  { key: 'imagen', label: 'Imagen', icon: ScanLine, color: 'text-violet-700 border-violet-500 bg-violet-50', inactive: 'text-slate-500 hover:text-violet-600 hover:bg-violet-50' },
  { key: 'suplementacion', label: 'Suplementación', icon: ClipboardList, color: 'text-amber-700 border-amber-500 bg-amber-50', inactive: 'text-slate-500 hover:text-amber-600 hover:bg-amber-50' },
  { key: 'internamiento', label: 'Internamiento', icon: BedDouble, color: 'text-rose-700 border-rose-500 bg-rose-50', inactive: 'text-slate-500 hover:text-rose-600 hover:bg-rose-50' },
  { key: 'escrito', label: 'Escrito Médico', icon: PenLine, color: 'text-teal-700 border-teal-500 bg-teal-50', inactive: 'text-slate-500 hover:text-teal-600 hover:bg-teal-50' },
  { key: 'consentimiento', label: 'Consentimiento', icon: ShieldCheck, color: 'text-indigo-700 border-indigo-500 bg-indigo-50', inactive: 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50' },
  { key: 'honorarios', label: 'Honorarios / Cotización', icon: Receipt, color: 'text-orange-700 border-orange-500 bg-orange-50', inactive: 'text-slate-500 hover:text-orange-600 hover:bg-orange-50' },
] as const

type TabKey = typeof TABS[number]['key']

function DocumentosPacienteContent() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [tab, setTab] = useState<TabKey>('receta')

  useEffect(() => {
    const t = searchParams.get('tipo') as TabKey | null
    if (t && TABS.some(x => x.key === t)) setTab(t)
  }, [searchParams])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('pacientes').select('id, nombre, apellidos, fecha_nacimiento, sexo, numero_expediente').eq('id', id).single().then(({ data }) => setPaciente(data as any))
  }, [id])

  const nombreCompleto = paciente ? `${paciente.nombre} ${paciente.apellidos}` : ''
  const diagnosticoInicial = searchParams.get('dx') || ''

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/expediente/${id}`} className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a5c]">Documentos</h1>
          {paciente && (
            <p className="text-slate-500 text-sm mt-0.5">
              {paciente.nombre} {paciente.apellidos}
              {paciente.fecha_nacimiento ? ` · ${differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento))} años` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(({ key, label, icon: Icon, color, inactive }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
              tab === key ? color + ' border-current' : 'border-slate-200 bg-white ' + inactive
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Formulario activo */}
      {tab === 'receta' && <RecetaForm pacienteInicial={nombreCompleto} diagnosticoInicial={diagnosticoInicial} pacienteId={id} />}
      {tab === 'lab' && <SolicitudLabForm pacienteInicial={nombreCompleto} diagnosticoInicial={diagnosticoInicial} pacienteId={id} />}
      {tab === 'imagen' && <SolicitudImagenForm pacienteInicial={nombreCompleto} diagnosticoInicial={diagnosticoInicial} pacienteId={id} />}
      {tab === 'suplementacion' && <PlanSuplementacionForm pacienteInicial={nombreCompleto} diagnosticoInicial={diagnosticoInicial} pacienteId={id} />}
      {tab === 'internamiento' && <SolicitudInternamientoForm pacienteInicial={nombreCompleto} diagnosticoInicial={diagnosticoInicial} pacienteId={id} />}
      {tab === 'escrito' && <EscritoMedicoForm pacienteInicial={nombreCompleto} pacienteId={id} />}
      {tab === 'consentimiento' && <ConsentimientoInformadoForm pacienteInicial={nombreCompleto} diagnosticoInicial={diagnosticoInicial} pacienteId={id} />}
      {tab === 'honorarios' && <NotaHonorariosForm pacienteInicial={nombreCompleto} pacienteId={id} />}
    </div>
  )
}

export default function DocumentosPacientePage() {
  return (
    <Suspense>
      <DocumentosPacienteContent />
    </Suspense>
  )
}
