'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileText, Pill, FlaskConical, ScanLine, ClipboardList, Search, User, X, BedDouble, PenLine, Loader2, ChevronRight, UserPlus, ShieldCheck, Receipt } from 'lucide-react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import QuickPatientModal from '@/components/ui/QuickPatientModal'

const FormLoader = () => (
  <div className="flex items-center justify-center py-16 text-[#86868b]">
    <Loader2 size={18} className="animate-spin mr-2" />
    <span className="text-sm">Cargando formulario...</span>
  </div>
)

const RecetaForm              = dynamic(() => import('@/components/documentos/RecetaForm'),              { ssr: false, loading: FormLoader })
const SolicitudLabForm        = dynamic(() => import('@/components/documentos/SolicitudLabForm'),        { ssr: false, loading: FormLoader })
const SolicitudImagenForm     = dynamic(() => import('@/components/documentos/SolicitudImagenForm'),     { ssr: false, loading: FormLoader })
const PlanSuplementacionForm  = dynamic(() => import('@/components/documentos/PlanSuplementacionForm'),  { ssr: false, loading: FormLoader })
const SolicitudInternamientoForm = dynamic(() => import('@/components/documentos/SolicitudInternamientoForm'), { ssr: false, loading: FormLoader })
const EscritoMedicoForm       = dynamic(() => import('@/components/documentos/EscritoMedicoForm'),       { ssr: false, loading: FormLoader })
const ConsentimientoForm      = dynamic(() => import('@/components/documentos/ConsentimientoInformadoForm'), { ssr: false, loading: FormLoader })
const NotaHonorariosForm      = dynamic(() => import('@/components/documentos/NotaHonorariosForm'),      { ssr: false, loading: FormLoader })

const TIPOS = [
  { key: 'receta',        label: 'Receta Médica',       sublabel: 'Prescripción farmacológica', icon: Pill,           bg: 'bg-blue-50',    icon_color: 'text-[#1e5fa8]' },
  { key: 'lab',          label: 'Laboratorio',           sublabel: 'Solicitud de estudios',      icon: FlaskConical,   bg: 'bg-emerald-50', icon_color: 'text-emerald-600' },
  { key: 'imagen',       label: 'Imagen',                sublabel: 'Rx, RM, TAC, US',            icon: ScanLine,       bg: 'bg-violet-50',  icon_color: 'text-violet-600' },
  { key: 'suplementacion',label: 'Suplementación',       sublabel: 'Plan nutricional',           icon: ClipboardList,  bg: 'bg-amber-50',   icon_color: 'text-amber-600' },
  { key: 'internamiento',label: 'Internamiento',         sublabel: 'Solicitud hospitalaria',     icon: BedDouble,      bg: 'bg-rose-50',    icon_color: 'text-rose-600' },
  { key: 'escrito',      label: 'Escrito Médico',        sublabel: 'Carta o informe libre',      icon: PenLine,        bg: 'bg-teal-50',    icon_color: 'text-teal-600' },
  { key: 'consentimiento', label: 'Consentimiento',     sublabel: 'Consentimiento informado',   icon: ShieldCheck,    bg: 'bg-indigo-50',  icon_color: 'text-indigo-600' },
  { key: 'honorarios',  label: 'Honorarios',            sublabel: 'Cotización o nota de cobro',  icon: Receipt,        bg: 'bg-slate-50',   icon_color: 'text-slate-600' },
] as const

type TipoDoc = typeof TIPOS[number]['key']
type Paciente = { id: string; nombre: string; apellidos: string }

function DocumentosContent() {
  const searchParams = useSearchParams()
  const [tipo, setTipo] = useState<TipoDoc | null>(null)
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<Paciente | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Paciente[]>([])
  const [buscando, setBuscando] = useState(false)
  const [showQuickPatient, setShowQuickPatient] = useState(false)

  useEffect(() => {
    const t = searchParams.get('tipo') as TipoDoc | null
    if (t && TIPOS.some(x => x.key === t)) setTipo(t)
  }, [searchParams])

  useEffect(() => {
    if (busqueda.trim().length < 2) { setResultados([]); return }
    const timeout = setTimeout(async () => {
      setBuscando(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('pacientes')
        .select('id, nombre, apellidos')
        .or(`nombre.ilike.%${busqueda}%,apellidos.ilike.%${busqueda}%`)
        .limit(8)
      setResultados(data ?? [])
      setBuscando(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [busqueda])

  function seleccionar(p: Paciente) {
    setPacienteSeleccionado(p)
    setBusqueda('')
    setResultados([])
  }

  function limpiarPaciente() {
    setPacienteSeleccionado(null)
    setTipo(null)
  }

  const sinResultados = busqueda.length >= 2 && !buscando && resultados.length === 0

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-slide-up">

      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1">Clínica</p>
        <h1 className="text-[22px] font-bold tracking-tight text-[#1d1d1f]">Documentos</h1>
        <p className="text-sm text-[#86868b] mt-0.5">Genera e imprime documentos con tu membrete oficial</p>
      </div>

      {/* Paso 1 — Seleccionar paciente */}
      {!pacienteSeleccionado ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 max-w-lg">
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1">Paso 1</p>
          <h2 className="text-base font-semibold text-[#1d1d1f] mb-1">Selecciona el paciente</h2>
          <p className="text-xs text-[#86868b] mb-4">El documento se guardará en su expediente automáticamente.</p>

          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o apellido..."
              className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:border-[#1e5fa8]/50 focus:bg-white transition-all"
              autoFocus
            />
          </div>

          {resultados.length > 0 && (
            <div className="mt-2 bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
              {resultados.map(p => (
                <button
                  key={p.id}
                  onClick={() => seleccionar(p)}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between border-b border-slate-100 last:border-0 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <User size={13} className="text-[#1e5fa8]" />
                    </div>
                    <span className="text-sm font-medium text-[#1d1d1f]">{p.nombre} {p.apellidos}</span>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-[#86868b]" />
                </button>
              ))}
            </div>
          )}

          {buscando && (
            <p className="text-xs text-[#86868b] mt-2 text-center flex items-center justify-center gap-1.5">
              <Loader2 size={11} className="animate-spin" /> Buscando...
            </p>
          )}

          {sinResultados && (
            <div className="mt-2 border border-slate-200/80 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowQuickPatient(true)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <UserPlus size={13} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1d1d1f]">Registrar "{busqueda}"</p>
                    <p className="text-[10px] text-emerald-500">Crear nuevo paciente y continuar</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-[#86868b]" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Paciente seleccionado */}
          <div className="flex items-center justify-between bg-white border border-slate-200/80 rounded-2xl px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1e5fa8] flex items-center justify-center flex-shrink-0">
                <User size={15} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1d1d1f]">
                  {pacienteSeleccionado.nombre} {pacienteSeleccionado.apellidos}
                </p>
                <p className="text-[11px] text-[#86868b]">Paciente seleccionado</p>
              </div>
            </div>
            <button
              onClick={limpiarPaciente}
              className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-[#86868b] hover:text-[#3d3d3f] transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Paso 2 — Selector de tipo */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-0.5">Paso 2</p>
              <h2 className="text-sm font-semibold text-[#1d1d1f]">Tipo de documento</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-100">
              {TIPOS.map(({ key, label, sublabel, icon: Icon, bg, icon_color }) => (
                <button
                  key={key}
                  onClick={() => setTipo(key)}
                  className={`flex items-center gap-3 px-4 py-4 text-left hover:bg-slate-50/80 transition-colors ${tipo === key ? 'bg-slate-50' : ''}`}
                >
                  <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={17} className={icon_color} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold leading-tight ${tipo === key ? 'text-[#1e5fa8]' : 'text-[#1d1d1f]'}`}>{label}</p>
                    <p className="text-[10px] text-[#86868b] mt-0.5 leading-tight">{sublabel}</p>
                  </div>
                  {tipo === key && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-[#1e5fa8] flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Formulario */}
          {tipo === 'receta' && (
            <RecetaForm
              pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`}
              pacienteId={pacienteSeleccionado.id}
            />
          )}
          {tipo === 'lab' && <SolicitudLabForm pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`} pacienteId={pacienteSeleccionado.id} />}
          {tipo === 'imagen' && <SolicitudImagenForm pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`} pacienteId={pacienteSeleccionado.id} />}
          {tipo === 'suplementacion' && <PlanSuplementacionForm pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`} pacienteId={pacienteSeleccionado.id} />}
          {tipo === 'internamiento' && (
            <SolicitudInternamientoForm
              pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`}
              pacienteId={pacienteSeleccionado.id}
            />
          )}
          {tipo === 'escrito' && (
            <EscritoMedicoForm
              pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`}
              pacienteId={pacienteSeleccionado.id}
            />
          )}
          {tipo === 'consentimiento' && (
            <ConsentimientoForm
              pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`}
              pacienteId={pacienteSeleccionado.id}
            />
          )}
          {tipo === 'honorarios' && (
            <NotaHonorariosForm
              pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`}
              pacienteId={pacienteSeleccionado.id}
            />
          )}
          {!tipo && (
            <div className="py-12 text-center text-[#86868b]">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <FileText size={20} className="text-slate-300" />
              </div>
              <p className="text-sm">Selecciona el tipo de documento</p>
            </div>
          )}
        </>
      )}

      {/* Modal registro rápido — mismo que en Agenda */}
      {showQuickPatient && (
        <QuickPatientModal
          nombreInicial={busqueda}
          onCreated={p => {
            seleccionar(p)
            setShowQuickPatient(false)
          }}
          onClose={() => setShowQuickPatient(false)}
        />
      )}

    </div>
  )
}

export default function DocumentosPage() {
  return (
    <Suspense>
      <DocumentosContent />
    </Suspense>
  )
}
