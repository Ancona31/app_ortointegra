'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { Paciente, Consulta, Laboratorio } from '@/types'
import { parseISO, format } from 'date-fns'
import Portal from '@/components/ui/Portal'
import {
  ArrowLeft, Stethoscope, FlaskConical, FileText, Trash2, AlertTriangle, Loader2,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
  const [documentos, setDocumentos] = useState<any[]>([])
  const [docSeleccionado, setDocSeleccionado] = useState<any>(null)
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
            <div className="grid grid-cols-3 divide-x divide-slate-100 sm:divide-x">
              {[
                {
                  href: `/expediente/${id}/nueva-nota`,
                  label: 'Nueva nota',
                  sublabel: 'Consulta médica',
                  icon: Stethoscope,
                  color: 'text-[#1e5fa8]',
                  bg: 'bg-blue-50',
                },
                {
                  href: `/expediente/${id}/laboratorios/nuevo`,
                  label: 'Laboratorio',
                  sublabel: 'Resultados de lab',
                  icon: FlaskConical,
                  color: 'text-emerald-600',
                  bg: 'bg-emerald-50',
                },
                {
                  href: `/expediente/${id}/documentos`,
                  label: 'Documento',
                  sublabel: 'Receta / Solicitud',
                  icon: FileText,
                  color: 'text-sky-600',
                  bg: 'bg-sky-50',
                },
              ].map(({ href, label, sublabel, icon: Icon, color, bg }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex flex-col items-center gap-2 sm:gap-2.5 px-2 sm:px-4 py-4 sm:py-5 hover:bg-slate-50/80 transition-colors duration-150 text-center"
                >
                  <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center transition-transform duration-150 group-hover:scale-105`}>
                    <Icon size={18} className={color} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1d1d1f] leading-tight">{label}</p>
                    <p className="text-[10px] text-[#86868b] mt-0.5 leading-tight">{sublabel}</p>
                  </div>
                </Link>
              ))}
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
