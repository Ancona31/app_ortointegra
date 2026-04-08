'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { Paciente, Consulta, Laboratorio, Documento } from '@/types'
import { parseISO, format } from 'date-fns'
import Portal from '@/components/ui/Portal'
import {
  ArrowLeft, Stethoscope, FlaskConical, FileText, Trash2, AlertTriangle, Loader2,
  Pill, ScanLine, ClipboardList, BedDouble, PenLine, ShieldCheck, Receipt, X, CalendarDays,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'

import ModalVisorDocumento from '@/components/expediente/ModalVisorDocumento'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import TarjetaPaciente from '@/components/expediente/TarjetaPaciente'
import TabResumen from '@/components/expediente/TabResumen'
import TabConsultas from '@/components/expediente/TabConsultas'
import TabLaboratorios from '@/components/expediente/TabLaboratorios'
import TabGraficas, { normalizarKey, ParamGrafica } from '@/components/expediente/TabGraficas'
import TabDocumentos from '@/components/expediente/TabDocumentos'
import ExportarExpedienteButton from '@/components/expediente/ExportarExpedienteButton'
import dynamic from 'next/dynamic'

function FormCargando() {
  return <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-slate-300" size={24} /></div>
}

const RecetaFormDynamic       = dynamic(() => import('@/components/documentos/RecetaForm'), { ssr: false, loading: () => <FormCargando /> })
const SolicitudLabFormDynamic = dynamic(() => import('@/components/documentos/SolicitudLabForm'), { ssr: false, loading: () => <FormCargando /> })
const SolicitudImagenFormDynamic = dynamic(() => import('@/components/documentos/SolicitudImagenForm'), { ssr: false, loading: () => <FormCargando /> })
const PlanSupFormDynamic      = dynamic(() => import('@/components/documentos/PlanSuplementacionForm'), { ssr: false, loading: () => <FormCargando /> })
const InternamientoFormDynamic = dynamic(() => import('@/components/documentos/SolicitudInternamientoForm'), { ssr: false, loading: () => <FormCargando /> })
const EscritoFormDynamic      = dynamic(() => import('@/components/documentos/EscritoMedicoForm'), { ssr: false, loading: () => <FormCargando /> })
const ConsentimientoFormDynamic = dynamic(() => import('@/components/documentos/ConsentimientoInformadoForm'), { ssr: false, loading: () => <FormCargando /> })
const HonorariosFormDynamic   = dynamic(() => import('@/components/documentos/NotaHonorariosForm'), { ssr: false, loading: () => <FormCargando /> })

const DOCS = [
  { key: 'receta',         label: 'Receta médica',            icon: Pill,          color: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100' },
  { key: 'lab',            label: 'Solicitud de laboratorio', icon: FlaskConical,  color: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  { key: 'imagen',         label: 'Solicitud de imagen',      icon: ScanLine,      color: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100' },
  { key: 'suplementacion', label: 'Plan de suplementación',   icon: ClipboardList, color: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' },
  { key: 'internamiento',  label: 'Internamiento',            icon: BedDouble,     color: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' },
  { key: 'escrito',        label: 'Escrito médico',           icon: PenLine,       color: 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100' },
  { key: 'consentimiento', label: 'Consentimiento',           icon: ShieldCheck,   color: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
  { key: 'honorarios',     label: 'Honorarios / Cotización',   icon: Receipt,       color: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100' },
]

type Tab = 'resumen' | 'consultas' | 'laboratorios' | 'graficas' | 'documentos'

function ExpedientePacienteContent() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isDoctor } = useProfile()
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [labs, setLabs] = useState<Laboratorio[]>([])
  const [tab, setTab] = useState<Tab>('resumen')
  const [loading, setLoading] = useState(true)
  const [eliminandoLab, setEliminandoLab] = useState<string | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null)
  const [graficasAbiertas, setGraficasAbiertas] = useState<Record<string, boolean>>({})
  const [busquedaParam, setBusquedaParam] = useState('')
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [docSeleccionado, setDocSeleccionado] = useState<Documento | null>(null)
  const [docInline, setDocInline] = useState<string | null>(null)
  const [mostrarEliminarPaciente, setMostrarEliminarPaciente] = useState(false)
  const [eliminandoPaciente, setEliminandoPaciente] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState('')

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'laboratorios') setTab('laboratorios')
    else if (t === 'graficas') setTab('graficas')
    else if (t === 'documentos') setTab('documentos')
  }, [searchParams])

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const [{ data: p }, { data: c }, { data: l }, { data: d }] = await Promise.all([
        supabase.from('pacientes').select('*').eq('id', id).single(),
        supabase.from('consultas').select('*').eq('paciente_id', id).order('fecha', { ascending: false }),
        supabase.from('laboratorios').select('*').eq('paciente_id', id).order('fecha_toma', { ascending: false }),
        supabase.from('documentos').select('id, tipo, contenido, created_at').eq('paciente_id', id).order('created_at', { ascending: false }),
      ])
      setPaciente(p)
      setConsultas(c || [])
      setLabs(l || [])
      setDocumentos(d || [])
      setLoading(false)
    }
    cargar()
  }, [id])

  // Recolecta todos los parámetros de todos los labs agrupando nombres equivalentes
  const todosLosParams = useMemo((): ParamGrafica[] => {
    const map = new Map<string, {
      nombres: Map<string, number>
      unidad: string
      rango_ref?: string
      rango_optimo?: string
      puntos: { fechaLabel: string; fechaISO: string; valor: number; estado?: string }[]
    }>()

    const labsOrdenados = [...labs].sort((a, b) => a.fecha_toma.localeCompare(b.fecha_toma))

    labsOrdenados.forEach(lab => {
      ;(lab.resultados || []).forEach(r => {
        const val = typeof r.valor === 'number' ? r.valor : parseFloat(String(r.valor))
        if (isNaN(val)) return

        const nombreOriginal = r.nombre.trim()
        const key = normalizarKey(nombreOriginal)
        if (!key) return

        if (!map.has(key)) {
          map.set(key, {
            nombres: new Map(),
            unidad: r.unidad || '',
            rango_ref: r.rango_ref,
            rango_optimo: r.rango_optimo,
            puntos: [],
          })
        }
        const grupo = map.get(key)!
        grupo.nombres.set(nombreOriginal, (grupo.nombres.get(nombreOriginal) || 0) + 1)
        if (!grupo.rango_ref && r.rango_ref) grupo.rango_ref = r.rango_ref
        if (!grupo.rango_optimo && r.rango_optimo) grupo.rango_optimo = r.rango_optimo
        grupo.puntos.push({
          fechaLabel: format(parseISO(lab.fecha_toma), 'dd/MM/yy'),
          fechaISO: lab.fecha_toma,
          valor: val,
          estado: r.estado,
        })
      })
    })

    return Array.from(map.values())
      .map(g => {
        const nombrePrincipal = Array.from(g.nombres.entries())
          .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0]
        const aliases = Array.from(g.nombres.keys()).filter(n => n !== nombrePrincipal)
        return {
          nombre: nombrePrincipal,
          aliases,
          unidad: g.unidad,
          rango_ref: g.rango_ref,
          rango_optimo: g.rango_optimo,
          puntos: g.puntos,
        }
      })
      .sort((a, b) => {
        if (b.puntos.length !== a.puntos.length) return b.puntos.length - a.puntos.length
        return a.nombre.localeCompare(b.nombre)
      })
  }, [labs])

  async function eliminarDocumento(docId: string) {
    const res = await fetch(`/api/documentos/${docId}`, { method: 'DELETE' })
    if (res.ok) setDocumentos(prev => prev.filter(d => d.id !== docId))
  }

  async function eliminarLab(labId: string) {
    setEliminandoLab(labId)
    const res = await fetch(`/api/laboratorios/${labId}`, { method: 'DELETE' })
    if (res.ok) setLabs(prev => prev.filter(l => l.id !== labId))
    setEliminandoLab(null)
    setConfirmarEliminar(null)
  }

  async function eliminarPaciente() {
    setEliminandoPaciente(true)
    setErrorEliminar('')

    const res = await fetch(`/api/pacientes/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Error desconocido' }))
      setErrorEliminar(data.error || 'No se pudo eliminar el paciente. Intenta de nuevo.')
      setEliminandoPaciente(false)
      return
    }

    router.push('/expediente')
  }

  function toggleGrafica(nombre: string) {
    setGraficasAbiertas(prev => ({ ...prev, [nombre]: !prev[nombre] }))
  }

  if (loading) return <div className="text-center py-12 text-slate-400">Cargando expediente...</div>
  if (!paciente) return <div className="text-center py-12 text-slate-400">Paciente no encontrado</div>

  const paramsFiltrados = todosLosParams.filter(p =>
    !busquedaParam || p.nombre.toLowerCase().includes(busquedaParam.toLowerCase())
  )

  const conTendencia = todosLosParams.filter(p => p.puntos.length > 1).length

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'resumen', label: 'Resumen' },
    { key: 'consultas', label: 'Consultas', count: consultas.length },
    { key: 'laboratorios', label: 'Laboratorios', count: labs.length },
    { key: 'graficas', label: 'Gráficas', count: todosLosParams.length || undefined },
    ...(isDoctor ? [{ key: 'documentos' as Tab, label: 'Documentos', count: documentos.length || undefined }] : []),
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-slide-up">

      {/* ── Modal visor de documento ── */}
      {docSeleccionado && (
        <ModalVisorDocumento doc={docSeleccionado} onClose={() => setDocSeleccionado(null)} pacienteEmail={paciente?.email} />
      )}

      {/* ── Modal eliminar paciente — macOS alert dialog ── */}
      {mostrarEliminarPaciente && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
            {/* Icon + title */}
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#FEF2F2' }}>
                <AlertTriangle size={22} style={{ color: '#EF5350' }} />
              </div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">Eliminar expediente</h2>
              <p className="text-sm text-[#86868b] mt-1">
                {paciente?.nombre} {paciente?.apellidos}
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 mx-4" />

            {/* Body */}
            <div className="px-6 py-4 text-center">
              <p className="text-[13px] text-[#3d3d3f] leading-relaxed">
                Se eliminarán <span className="font-semibold">permanentemente</span> todas las notas, laboratorios, documentos y datos personales del paciente.
              </p>
              <p className="text-[12px] text-[#86868b] mt-2">Esta acción no se puede deshacer.</p>
              {errorEliminar && (
                <p className="text-xs text-red-500 mt-3 bg-red-50 px-3 py-2 rounded-lg">{errorEliminar}</p>
              )}
            </div>

            {/* Buttons — macOS order: destructive on right */}
            <div className="border-t border-slate-100 grid grid-cols-2">
              <button
                onClick={() => { setMostrarEliminarPaciente(false); setErrorEliminar('') }}
                disabled={eliminandoPaciente}
                className="px-4 py-3.5 text-sm font-medium text-[#1e5fa8] hover:bg-slate-50 transition-colors disabled:opacity-40 border-r border-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={eliminarPaciente}
                disabled={eliminandoPaciente}
                className="px-4 py-3.5 text-sm font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                style={{ color: '#EF5350' }}
              >
                {eliminandoPaciente
                  ? <><Loader2 size={14} className="animate-spin" /> Eliminando...</>
                  : 'Eliminar'
                }
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Breadcrumbs */}
      <Breadcrumbs pacienteNombre={paciente ? `${paciente.nombre} ${paciente.apellidos}` : undefined} />

      {/* Header — macOS style */}
      <div className="flex items-center gap-2">
        <Link
          href="/expediente"
          className="flex items-center gap-1 text-[#1e5fa8] hover:text-[#1a3a5c] text-sm font-medium transition-colors"
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
          <span>Pacientes</span>
        </Link>
        <span className="text-slate-300 select-none">/</span>
        <h1 className="text-sm font-semibold text-[#1d1d1f] truncate">Expediente Clínico</h1>
      </div>

      {/* Tarjeta del paciente */}
      <TarjetaPaciente paciente={paciente} id={id} isDoctor={isDoctor} />

      {/* Acciones rápidas — solo médico */}
      {isDoctor && (
        <>
          {/* Quick actions — macOS icon dock style */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-4 divide-x divide-slate-100 sm:divide-x">
              <Link
                href={`/expediente/${id}/nueva-nota`}
                className="group flex flex-col items-center gap-2 sm:gap-2.5 px-2 sm:px-4 py-4 sm:py-5 hover:bg-slate-50/80 transition-colors duration-150 text-center"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center transition-transform duration-150 group-hover:scale-105">
                  <Stethoscope size={18} className="text-[#1e5fa8]" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#1d1d1f] leading-tight">Nueva nota</p>
                  <p className="text-[10px] text-[#86868b] mt-0.5 leading-tight">Consulta médica</p>
                </div>
              </Link>
              <Link
                href={`/expediente/${id}/laboratorios/nuevo`}
                className="group flex flex-col items-center gap-2 sm:gap-2.5 px-2 sm:px-4 py-4 sm:py-5 hover:bg-slate-50/80 transition-colors duration-150 text-center"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center transition-transform duration-150 group-hover:scale-105">
                  <FlaskConical size={18} className="text-emerald-600" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#1d1d1f] leading-tight">Laboratorio</p>
                  <p className="text-[10px] text-[#86868b] mt-0.5 leading-tight">Ingresar valores</p>
                </div>
              </Link>
              <Link
                href="/agenda"
                className="group flex flex-col items-center gap-2 sm:gap-2.5 px-2 sm:px-4 py-4 sm:py-5 hover:bg-slate-50/80 transition-colors duration-150 text-center"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center transition-transform duration-150 group-hover:scale-105">
                  <CalendarDays size={18} className="text-violet-600" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#1d1d1f] leading-tight">Agenda</p>
                  <p className="text-[10px] text-[#86868b] mt-0.5 leading-tight">Ver citas</p>
                </div>
              </Link>
              <button
                onClick={() => setDocInline('receta')}
                className="group flex flex-col items-center gap-2 sm:gap-2.5 px-2 sm:px-4 py-4 sm:py-5 hover:bg-slate-50/80 transition-colors duration-150 text-center"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center transition-transform duration-150 group-hover:scale-105">
                  <FileText size={18} className="text-sky-600" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#1d1d1f] leading-tight">Documento</p>
                  <p className="text-[10px] text-[#86868b] mt-0.5 leading-tight">Receta / Solicitud</p>
                </div>
              </button>
            </div>
          </div>

          {/* Exportar + eliminar */}
          <div className="flex items-center justify-between">
            <ExportarExpedienteButton
              paciente={paciente}
              consultas={consultas}
              labs={labs}
              documentos={documentos}
            />
            <button
              onClick={() => setMostrarEliminarPaciente(true)}
              className="flex items-center gap-1.5 text-[11px] text-[#86868b] hover:text-red-500 transition-colors"
            >
              <Trash2 size={12} /> Eliminar paciente
            </button>
          </div>
        </>
      )}

      {/* Tabs — macOS segmented control */}
      <div className="bg-slate-100 p-1 rounded-xl flex gap-0.5 overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-150 min-w-fit ${
              tab === t.key
                ? 'bg-white shadow-sm text-[#1d1d1f] font-semibold'
                : 'text-[#86868b] hover:text-[#3d3d3f]'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`ml-1 text-[10px] font-semibold ${tab === t.key ? 'text-[#86868b]' : 'text-slate-400'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── CONTENIDO DE TABS — con transición iOS ── */}
      <div key={tab} className="animate-tab-enter">

        {tab === 'resumen' && (
          <TabResumen
            id={id}
            consultas={consultas}
            labs={labs}
            isDoctor={isDoctor}
            onVerConsultas={() => setTab('consultas')}
            onVerLaboratorios={() => setTab('laboratorios')}
          />
        )}

        {tab === 'consultas' && (
          <TabConsultas id={id} consultas={consultas} isDoctor={isDoctor} />
        )}

        {tab === 'laboratorios' && (
          <TabLaboratorios
            id={id}
            labs={labs}
            isDoctor={isDoctor}
            confirmarEliminar={confirmarEliminar}
            eliminandoLab={eliminandoLab}
            onConfirmarEliminar={setConfirmarEliminar}
            onEliminarLab={eliminarLab}
          />
        )}

        {tab === 'graficas' && (
          <TabGraficas
            todosLosParams={todosLosParams}
            paramsFiltrados={paramsFiltrados}
            conTendencia={conTendencia}
            busquedaParam={busquedaParam}
            graficasAbiertas={graficasAbiertas}
            onBusquedaChange={setBusquedaParam}
            onToggleGrafica={toggleGrafica}
          />
        )}

        {tab === 'documentos' && (
          <TabDocumentos
            id={id}
            documentos={documentos}
            onVerDocumento={setDocSeleccionado}
            onEliminarDocumento={eliminarDocumento}
          />
        )}

      </div>

      {/* ── Modal flotante de documentos (portal a body) ── */}
      {docInline && createPortal((() => {
        const currentDoc = DOCS.find(d => d.key === docInline)
        const CurrentIcon = currentDoc?.icon ?? FileText
        const nombrePaciente = paciente ? `${paciente.nombre} ${paciente.apellidos}` : ''

        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
              onClick={() => setDocInline(null)}
            />
            <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] border border-slate-200/60 w-full max-w-3xl flex flex-col animate-[modalEnter_0.22s_cubic-bezier(0.32,0.72,0,1)]" style={{ height: '85vh' }}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/60 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${currentDoc?.color.split(' ').slice(1, 3).join(' ') ?? 'bg-slate-50'}`}>
                    <CurrentIcon size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{currentDoc?.label}</h3>
                    <p className="text-[11px] text-slate-400">{nombrePaciente}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {DOCS.map(({ key, label, icon: Icon, color }) => {
                    const isActive = key === docInline
                    const colorClasses = color.split(' ')
                    const bgClass = isActive ? colorClasses.slice(1, 3).join(' ') : 'bg-transparent'
                    const textClass = isActive ? colorClasses[3] ?? 'text-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                    return (
                      <button
                        key={key}
                        onClick={() => setDocInline(key)}
                        title={label}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all duration-150 ${bgClass} ${textClass} ${isActive ? 'ring-1 ring-current/20 shadow-sm' : ''}`}
                      >
                        <Icon size={15} />
                      </button>
                    )
                  })}
                  <div className="w-px h-5 bg-slate-200 mx-1" />
                  <button
                    onClick={() => setDocInline(null)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="doc-modal-scroll flex-1 overflow-y-auto overflow-x-hidden relative">
                <div className="p-5 sm:p-6 min-h-full">
                  {docInline === 'receta' && (
                    <RecetaFormDynamic pacienteInicial={nombrePaciente} pacienteId={id} />
                  )}
                  {docInline === 'lab' && (
                    <SolicitudLabFormDynamic pacienteInicial={nombrePaciente} pacienteId={id} />
                  )}
                  {docInline === 'imagen' && (
                    <SolicitudImagenFormDynamic pacienteInicial={nombrePaciente} pacienteId={id} />
                  )}
                  {docInline === 'suplementacion' && (
                    <PlanSupFormDynamic pacienteInicial={nombrePaciente} pacienteId={id} />
                  )}
                  {docInline === 'internamiento' && (
                    <InternamientoFormDynamic pacienteInicial={nombrePaciente} pacienteId={id} />
                  )}
                  {docInline === 'escrito' && (
                    <EscritoFormDynamic pacienteInicial={nombrePaciente} pacienteId={id} />
                  )}
                  {docInline === 'consentimiento' && (
                    <ConsentimientoFormDynamic pacienteInicial={nombrePaciente} pacienteId={id} />
                  )}
                  {docInline === 'honorarios' && (
                    <HonorariosFormDynamic pacienteInicial={nombrePaciente} pacienteId={id} />
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })(), document.body)}
    </div>
  )
}

export default function ExpedientePacientePage() {
  return (
    <Suspense>
      <ExpedientePacienteContent />
    </Suspense>
  )
}
