'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { Paciente, Consulta, Laboratorio } from '@/types'
import { parseISO, format } from 'date-fns'
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

const TabDicom = dynamic(() => import('@/components/dicom/TabDicom'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20 text-slate-400">
      <span className="text-sm">Inicializando visor DICOM...</span>
    </div>
  ),
})

type Tab = 'resumen' | 'consultas' | 'laboratorios' | 'graficas' | 'documentos' | 'dicom'

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

  async function eliminarLab(labId: string) {
    setEliminandoLab(labId)
    const supabase = createClient()
    await supabase.from('laboratorios').delete().eq('id', labId)
    setLabs(prev => prev.filter(l => l.id !== labId))
    setEliminandoLab(null)
    setConfirmarEliminar(null)
  }

  async function eliminarPaciente() {
    setEliminandoPaciente(true)
    setErrorEliminar('')
    const supabase = createClient()

    // Eliminar en orden: hijos primero, luego el paciente
    const pasos = [
      supabase.from('documentos').delete().eq('paciente_id', id),
      supabase.from('laboratorios').delete().eq('paciente_id', id),
      supabase.from('consultas').delete().eq('paciente_id', id),
    ]

    for (const paso of pasos) {
      const { error } = await paso
      if (error) {
        setErrorEliminar('Error al eliminar datos: ' + error.message)
        setEliminandoPaciente(false)
        return
      }
    }

    const { error } = await supabase.from('pacientes').delete().eq('id', id)
    if (error) {
      setErrorEliminar('Error al eliminar paciente: ' + error.message)
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

  const diagnosticos = consultas
    .flatMap(c => c.diagnosticos || [])
    .filter((d, i, arr) => arr.findIndex(x => x.descripcion === d.descripcion) === i)
    .slice(0, 6)

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
    { key: 'dicom' as Tab, label: '🖥️ DICOM' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* ── Modal visor de documento ── */}
      {docSeleccionado && (
        <ModalVisorDocumento doc={docSeleccionado} onClose={() => setDocSeleccionado(null)} />
      )}

      {/* ── Modal eliminar paciente ── */}
      {mostrarEliminarPaciente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800 text-lg">¿Eliminar expediente?</h2>
                <p className="text-sm text-slate-500">
                  {paciente?.nombre} {paciente?.apellidos}
                </p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 space-y-1">
              <p className="font-semibold">Esta acción es irreversible.</p>
              <p>Se eliminarán permanentemente todos los datos del paciente:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-red-600">
                <li>Notas médicas y consultas</li>
                <li>Resultados de laboratorio</li>
                <li>Recetas y solicitudes</li>
                <li>Documentos adjuntos</li>
                <li>Datos personales del paciente</li>
              </ul>
            </div>

            {errorEliminar && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errorEliminar}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setMostrarEliminarPaciente(false); setErrorEliminar('') }}
                disabled={eliminandoPaciente}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={eliminarPaciente}
                disabled={eliminandoPaciente}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {eliminandoPaciente
                  ? <><Loader2 size={15} className="animate-spin" /> Eliminando...</>
                  : <><Trash2 size={15} /> Sí, eliminar definitivamente</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumbs */}
      <Breadcrumbs pacienteNombre={paciente ? `${paciente.nombre} ${paciente.apellidos}` : undefined} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/expediente" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-[#1a3a5c]">Expediente Clínico</h1>
      </div>

      {/* Tarjeta del paciente */}
      <TarjetaPaciente paciente={paciente} id={id} isDoctor={isDoctor} />

      {/* Acciones rápidas — solo médico */}
      {isDoctor && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Link href={`/expediente/${id}/nueva-nota`} className="flex flex-col items-center gap-2 p-4 bg-[#1e5fa8] text-white rounded-xl hover:bg-[#1a3a5c] transition-colors text-center">
              <Stethoscope size={20} />
              <span className="text-xs font-medium">Nueva nota</span>
            </Link>
            <Link href={`/expediente/${id}/laboratorios/nuevo`} className="flex flex-col items-center gap-2 p-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-center">
              <FlaskConical size={20} />
              <span className="text-xs font-medium">Agregar resultados de laboratorio</span>
            </Link>
            <Link href={`/expediente/${id}/documentos`} className="flex flex-col items-center gap-2 p-4 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors text-center">
              <FileText size={20} />
              <span className="text-xs font-medium text-center leading-tight">Nueva receta<br/>y Solicitudes</span>
            </Link>
          </div>
          <div className="flex justify-between">
            <ExportarExpedienteButton
              paciente={paciente}
              consultas={consultas}
              labs={labs}
              documentos={documentos}
            />
            <button
              onClick={() => setMostrarEliminarPaciente(true)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-600 transition-colors py-1"
            >
              <Trash2 size={13} /> Eliminar paciente
            </button>
          </div>
        </>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.key
                ? t.key === 'graficas' ? 'border-violet-600 text-violet-600'
                  : t.key === 'laboratorios' ? 'border-emerald-600 text-emerald-600'
                  : 'border-[#1e5fa8] text-[#1e5fa8]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* ── TAB: RESUMEN ── */}
      {tab === 'resumen' && (
        <TabResumen
          id={id}
          consultas={consultas}
          labs={labs}
          isDoctor={isDoctor}
          diagnosticos={diagnosticos}
          onVerConsultas={() => setTab('consultas')}
          onVerLaboratorios={() => setTab('laboratorios')}
        />
      )}

      {/* ── TAB: CONSULTAS ── */}
      {tab === 'consultas' && (
        <TabConsultas id={id} consultas={consultas} isDoctor={isDoctor} />
      )}

      {/* ── TAB: LABORATORIOS ── */}
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

      {/* ── TAB: GRÁFICAS ── */}
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

      {/* ── TAB: DOCUMENTOS ── */}
      {tab === 'documentos' && (
        <TabDocumentos
          id={id}
          documentos={documentos}
          onVerDocumento={setDocSeleccionado}
        />
      )}

      {tab === 'dicom' && <TabDicom />}
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
