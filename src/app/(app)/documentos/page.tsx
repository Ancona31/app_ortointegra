'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, User, X, Loader2, ChevronRight, UserPlus } from 'lucide-react'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import QuickPatientModal from '@/components/ui/QuickPatientModal'
import SelectorTipoDocumento, { TIPOS_DOCUMENTO, type TipoDocumento } from '@/components/documentos/SelectorTipoDocumento'

const FormLoader = () => (
  <div className="flex items-center justify-center py-16 text-[#86868b]">
    <Loader2 size={18} className="animate-spin mr-2" />
    <span className="text-sm">Cargando formulario...</span>
  </div>
)

const FormError = () => (
  <div className="flex flex-col items-center justify-center py-16 text-[#86868b] gap-2">
    <p className="text-sm font-medium">No se pudo cargar el formulario</p>
    <p className="text-xs">Verifica tu conexion e intenta de nuevo</p>
  </div>
)

function safeDynamic<T extends Record<string, unknown>>(loader: () => Promise<{ default: React.ComponentType<T> }>) {
  return dynamic<T>(
    () => loader().catch(() => ({
      default: (() => FormError()) as unknown as React.ComponentType<T>,
    })),
    { ssr: false, loading: FormLoader },
  )
}

const RecetaForm              = safeDynamic(() => import('@/components/documentos/RecetaForm'))
const SolicitudLabForm        = safeDynamic(() => import('@/components/documentos/SolicitudLabForm'))
const SolicitudImagenForm     = safeDynamic(() => import('@/components/documentos/SolicitudImagenForm'))
const PlanSuplementacionForm  = safeDynamic(() => import('@/components/documentos/PlanSuplementacionForm'))
const SolicitudInternamientoForm = safeDynamic(() => import('@/components/documentos/SolicitudInternamientoForm'))
const EscritoMedicoForm       = safeDynamic(() => import('@/components/documentos/EscritoMedicoForm'))
const ConsentimientoForm      = safeDynamic(() => import('@/components/documentos/ConsentimientoInformadoForm'))
const NotaHonorariosForm      = safeDynamic(() => import('@/components/documentos/NotaHonorariosForm'))

type Paciente = { id: string; nombre: string; apellidos: string }

function DocumentosContent() {
  const searchParams = useSearchParams()
  const [tipo, setTipo] = useState<TipoDocumento | null>(null)
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<Paciente | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<Paciente[]>([])
  const [buscando, setBuscando] = useState(false)
  const [showQuickPatient, setShowQuickPatient] = useState(false)
  // Reportan los seis con predicado: los cinco del sistema de plantillas
  // —Receta, Laboratorio, Imagen, Suplementación, Escrito— más Honorarios.
  // Consentimiento e Internamiento aún no, y quedan en `true`: no avisan.
  const [formVacio, setFormVacio] = useState(true)
  // El panel de plantillas sustituye al formulario y oculta el selector de tipo.
  const [panelPlantillas, setPanelPlantillas] = useState(false)

  useEffect(() => {
    const t = searchParams.get('tipo') as TipoDocumento | null
    if (t && TIPOS_DOCUMENTO.some(x => x.key === t)) setTipo(t)
  }, [searchParams])

  useEffect(() => {
    if (busqueda.trim().length < 2) { setResultados([]); return }
    const timeout = setTimeout(async () => {
      setBuscando(true)

      const supabase = createClient()
      const busquedaNorm = busqueda.trim().replace(/\s+/g, ' ')
      const { data, error } = await supabase
        .from('pacientes')
        .select('id, nombre, apellidos')
        .neq('activo', false)
        .or(`nombre.ilike.%${busquedaNorm}%,apellidos.ilike.%${busquedaNorm}%`)
        .limit(8)

      if (!error) {
        setResultados(data ?? [])
      }
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

          {/* Paso 2 — Selector de tipo + formulario.
              Las tarjetas del sistema sustituyen a la rejilla con sublabels:
              los sublabels se caen porque la etiqueta completa ya nombra el
              documento, y con ellos se caen los cuatro colores que divergían
              de los ocho tokens (teal en escrito, amber-600 en suplementación,
              slate en honorarios). */}
          <div className="sp-doc-host">
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">Paso 2 · Tipo de documento</p>
            <SelectorTipoDocumento
              value={tipo}
              onChange={t => { setFormVacio(true); setPanelPlantillas(false); setTipo(t) }}
              conDatos={!formVacio}
              oculto={panelPlantillas}
            >
              {tipo === 'receta' && (
                <RecetaForm
                  pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`}
                  pacienteId={pacienteSeleccionado.id}
                  onVacioChange={setFormVacio}
                  onPanelPlantillasChange={setPanelPlantillas}
                />
              )}
              {tipo === 'lab' && <SolicitudLabForm pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`} pacienteId={pacienteSeleccionado.id} onVacioChange={setFormVacio} onPanelPlantillasChange={setPanelPlantillas} />}
              {tipo === 'imagen' && <SolicitudImagenForm pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`} pacienteId={pacienteSeleccionado.id} onVacioChange={setFormVacio} onPanelPlantillasChange={setPanelPlantillas} />}
              {tipo === 'suplementacion' && <PlanSuplementacionForm pacienteInicial={`${pacienteSeleccionado.nombre} ${pacienteSeleccionado.apellidos}`} pacienteId={pacienteSeleccionado.id} onVacioChange={setFormVacio} onPanelPlantillasChange={setPanelPlantillas} />}
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
                  onVacioChange={setFormVacio}
                  onPanelPlantillasChange={setPanelPlantillas}
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
                  onVacioChange={setFormVacio}
                />
              )}
            </SelectorTipoDocumento>
          </div>
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
