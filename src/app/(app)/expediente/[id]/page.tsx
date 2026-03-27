'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { Paciente, Consulta, Laboratorio } from '@/types'
import { parseISO, format } from 'date-fns'
import {
  ArrowLeft, Stethoscope, FlaskConical, FileText,
} from 'lucide-react'
import Link from 'next/link'

import ModalVisorDocumento from '@/components/expediente/ModalVisorDocumento'
import TarjetaPaciente from '@/components/expediente/TarjetaPaciente'
import TabResumen from '@/components/expediente/TabResumen'
import TabConsultas from '@/components/expediente/TabConsultas'
import TabLaboratorios from '@/components/expediente/TabLaboratorios'
import TabGraficas, { normalizarKey, ParamGrafica } from '@/components/expediente/TabGraficas'
import TabDocumentos from '@/components/expediente/TabDocumentos'

type Tab = 'resumen' | 'consultas' | 'laboratorios' | 'graficas' | 'documentos'

function ExpedientePacienteContent() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
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
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* ── Modal visor de documento ── */}
      {docSeleccionado && (
        <ModalVisorDocumento doc={docSeleccionado} onClose={() => setDocSeleccionado(null)} />
      )}

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
