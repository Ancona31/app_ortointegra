'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { useAuditAccess } from '@/hooks/useAudit'
import { useLaboratoriosNormalizados } from '@/hooks/useLaboratoriosNormalizados'
import { Paciente, Consulta, Documento } from '@/types'
import Portal from '@/components/ui/Portal'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'

import ModalVisorDocumento from '@/components/expediente/ModalVisorDocumento'
import TarjetaPaciente from '@/components/expediente/TarjetaPaciente' // TODO Fase 7: eliminar import de TarjetaPaciente no usado
import HeroExpediente from '@/components/expediente/HeroExpediente'
import TabResumen from '@/components/expediente/TabResumen'
import TabConsultas from '@/components/expediente/TabConsultas'
import TabLaboratorios from '@/components/expediente/TabLaboratorios'
import TabGraficas from '@/components/expediente/TabGraficas'
import TabDocumentos from '@/components/expediente/TabDocumentos'
import ExportarExpedienteButton from '@/components/expediente/ExportarExpedienteButton' // TODO Fase 7: eliminar import de ExportarExpedienteButton no usado en page.tsx
import ExpedienteCardsGrid, { type ProximaCita } from '@/components/expediente/ExpedienteCardsGrid'
import AccesosRapidos from '@/components/expediente/AccesosRapidos'
import ModalConsultas from '@/components/expediente/ModalConsultas'
import ModalDocumentos from '@/components/expediente/ModalDocumentos'

type Tab = 'resumen' | 'consultas' | 'laboratorios' | 'graficas' | 'documentos'

/** Límite de registros por query */
const QUERY_LIMIT = 50

function ExpedientePacienteContent() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isDoctor } = useProfile()
  useAuditAccess('pacientes', id) // NOM-024: registrar acceso al expediente

  // ── Estados UI ──
  const [allAddendums, setAllAddendums] = useState<{ id: string; consulta_id: string; contenido: string; medico_nombre: string; created_at: string }[]>([])
  const [tab, setTab] = useState<Tab>('resumen')
  const [eliminandoLab, setEliminandoLab] = useState<string | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null)
  const [graficasAbiertas, setGraficasAbiertas] = useState<Record<string, boolean>>({})
  const [busquedaParam, setBusquedaParam] = useState('')
  const [docSeleccionado, setDocSeleccionado] = useState<Documento | null>(null)
  const [mostrarModalConsultas, setMostrarModalConsultas] = useState(false)
  const [mostrarModalDocumentos, setMostrarModalDocumentos] = useState(false)
  const [mostrarEliminarPaciente, setMostrarEliminarPaciente] = useState(false)
  const [eliminandoPaciente, setEliminandoPaciente] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState('')

  // ── Data fetching: direct Supabase queries ──
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loadingPaciente, setLoadingPaciente] = useState(true)
  const [proximaCita, setProximaCita] = useState<ProximaCita | null>(null)

  const { labs, todosLosParams, refetch: fetchLabs } = useLaboratoriosNormalizados(id)

  // Refetch helpers for child actions (delete doc, delete lab)
  const fetchDocumentos = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('documentos')
      .select('*')
      .eq('paciente_id', id)
      .order('created_at', { ascending: false })
      .limit(QUERY_LIMIT)
    setDocumentos((data ?? []) as Documento[])
  }, [id])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    // Paciente
    supabase.from('pacientes').select('*').eq('id', id).single()
      .then((res: { data: Paciente | null; error: unknown }) => {
        if (cancelled) return
        if (!res.error && res.data) setPaciente(res.data)
        setLoadingPaciente(false)
      })

    // Consultas
    supabase
      .from('consultas')
      .select('*')
      .eq('paciente_id', id)
      .order('fecha', { ascending: false })
      .limit(QUERY_LIMIT)
      .then((res: { data: Consulta[] | null }) => {
        if (!cancelled) setConsultas((res.data ?? []) as Consulta[])
      })

    // Documentos
    supabase
      .from('documentos')
      .select('*')
      .eq('paciente_id', id)
      .order('created_at', { ascending: false })
      .limit(QUERY_LIMIT)
      .then((res: { data: Documento[] | null }) => {
        if (!cancelled) setDocumentos((res.data ?? []) as Documento[])
      })

    // Próxima cita del paciente (solo scheduled/confirmed futuras)
    supabase
      .from('appointments')
      .select('id, start_time, end_time, title, status')
      .eq('paciente_id', id)
      .in('status', ['scheduled', 'confirmed'])
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(1)
      .then((res: { data: ProximaCita[] | null }) => {
        if (!cancelled) setProximaCita(res.data?.[0] ?? null)
      })

    return () => { cancelled = true }
  }, [id])

  // ── Efecto de query string para seleccionar tab inicial ──
  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'laboratorios') setTab('laboratorios')
    else if (t === 'graficas') setTab('graficas')
    else if (t === 'documentos') setTab('documentos')
  }, [searchParams])

  // ── Fetch de addendums (dependiente de consultas) ──
  useEffect(() => {
    if (!consultas || consultas.length === 0) {
      setAllAddendums([])
      return
    }

    const ids = consultas.map(c => c.id)
    let cancelled = false
    const supabase = createClient()

    supabase.from('addendums')
      .select('id, consulta_id, contenido, medico_nombre, created_at')
      .in('consulta_id', ids)
      .order('created_at', { ascending: true })
      .then((res: { data: { id: string; consulta_id: string; contenido: string; medico_nombre: string; created_at: string }[] | null }) => {
        if (cancelled) return
        setAllAddendums(res.data || [])
      })

    return () => {
      cancelled = true
    }
  }, [consultas])

  async function eliminarDocumento(docId: string) {
    const res = await fetch(`/api/documentos/${docId}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchDocumentos()
    }
  }

  async function eliminarLab(labId: string) {
    setEliminandoLab(labId)
    const res = await fetch(`/api/laboratorios/${labId}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchLabs()
    }
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

  // ── Loading / not-found guards ─────────────────────────────
  if (loadingPaciente) {
    return <div className="text-center py-12 text-slate-400">Cargando expediente...</div>
  }
  if (!paciente) {
    return <div className="text-center py-12 text-slate-400">Paciente no encontrado</div>
  }

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

      {/* ── Modal lista de consultas ── */}
      <ModalConsultas
        open={mostrarModalConsultas}
        onClose={() => setMostrarModalConsultas(false)}
        consultas={consultas}
        pacienteId={id}
      />

      {/* ── Modal lista de documentos ── */}
      <ModalDocumentos
        open={mostrarModalDocumentos}
        onClose={() => setMostrarModalDocumentos(false)}
        documentos={documentos}
        pacienteId={id}
        onVerDocumento={(doc) => {
          setMostrarModalDocumentos(false)
          setDocSeleccionado(doc)
        }}
        onEliminarDocumento={eliminarDocumento}
      />

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

      {/* Tarjeta del paciente */}
      <HeroExpediente
        paciente={paciente}
        consultas={consultas}
        labs={labs}
        documentos={documentos}
        addendums={allAddendums}
        isDoctor={isDoctor}
        onEditar={() => router.push(`/expediente/${id}/editar`)}
      />

      {/* Grid de cards — Fase 4 */}
      <ExpedienteCardsGrid
        paciente={paciente}
        consultas={consultas}
        proximaCita={proximaCita}
        isDoctor={isDoctor}
      />

      {/* Acciones rápidas — solo médico */}
      {isDoctor && (
        <>
          <AccesosRapidos
            pacienteId={id}
            onAbrirConsultas={() => setMostrarModalConsultas(true)}
            onAbrirDocumentos={() => setMostrarModalDocumentos(true)}
          />

          {/* Eliminar (Exportar ahora vive dentro del Hero) */}
          <div className="flex justify-end">
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
          <TabConsultas
            id={id}
            consultas={consultas}
            isDoctor={isDoctor}
            hayMas={false}
            cargandoMas={false}
            onCargarMas={() => {}}
          />
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
            hayMas={false}
            cargandoMas={false}
            onCargarMas={() => {}}
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
            hayMas={false}
            cargandoMas={false}
            onCargarMas={() => {}}
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
