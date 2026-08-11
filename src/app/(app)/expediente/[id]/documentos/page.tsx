'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuditAccess } from '@/hooks/useAudit'
import { Paciente } from '@/types'
import { calcularEdad } from '@/lib/patientUtils'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import SelectorTipoDocumento, { TIPOS_DOCUMENTO, type TipoDocumento } from '@/components/documentos/SelectorTipoDocumento'

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

function DocumentosPacienteContent() {
  const { id } = useParams<{ id: string }>()
  useAuditAccess('documentos', id)
  const searchParams = useSearchParams()
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  // Arranca en null y no en 'receta': sin tipo elegido se ven las ocho
  // tarjetas. Quien llegue con ?tipo= sigue aterrizando en su formulario.
  const [tab, setTab] = useState<TipoDocumento | null>(null)
  // Los ocho reportan predicado: los siete del sistema de plantillas
  // —Receta, Laboratorio, Imagen, Suplementación, Escrito, Internamiento,
  // Consentimiento— más Honorarios.
  const [formVacio, setFormVacio] = useState(true)
  // El panel de plantillas sustituye al formulario y oculta el selector de tipo.
  const [panelPlantillas, setPanelPlantillas] = useState(false)

  useEffect(() => {
    const t = searchParams.get('tipo') as TipoDocumento | null
    if (t && TIPOS_DOCUMENTO.some(x => x.key === t)) setTab(t)
  }, [searchParams])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('pacientes').select('id, nombre, apellidos, fecha_nacimiento, sexo, numero_expediente').eq('id', id).single().then((res: { data: Paciente | null }) => setPaciente(res.data))
  }, [id])

  const nombreCompleto = paciente ? `${paciente.nombre} ${paciente.apellidos}` : ''
  const diagnosticoInicial = searchParams.get('dx') || ''
  // Ya redactada («45 años»), que es como la escribe el médico en el
  // consentimiento. La ficha ya se consulta con `fecha_nacimiento`.
  const edadInicial = paciente?.fecha_nacimiento
    ? calcularEdad(paciente.fecha_nacimiento).textoElegante
    : ''

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
              {paciente.fecha_nacimiento ? ` · ${calcularEdad(paciente.fecha_nacimiento).textoElegante}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Selector de tipo + formulario. Montaje 2 de la guía 04: el cromo
          encima del selector es la cabecera «Documentos» + paciente. */}
      <div className="sp-doc-host">
        <SelectorTipoDocumento
          value={tab}
          onChange={t => { setFormVacio(true); setPanelPlantillas(false); setTab(t) }}
          conDatos={!formVacio}
          oculto={panelPlantillas}
        >
          {tab === 'receta' && <RecetaForm pacienteInicial={nombreCompleto} diagnosticoInicial={diagnosticoInicial} pacienteId={id} onVacioChange={setFormVacio} onPanelPlantillasChange={setPanelPlantillas} />}
          {tab === 'lab' && <SolicitudLabForm pacienteInicial={nombreCompleto} diagnosticoInicial={diagnosticoInicial} pacienteId={id} onVacioChange={setFormVacio} onPanelPlantillasChange={setPanelPlantillas} />}
          {tab === 'imagen' && <SolicitudImagenForm pacienteInicial={nombreCompleto} diagnosticoInicial={diagnosticoInicial} pacienteId={id} onVacioChange={setFormVacio} onPanelPlantillasChange={setPanelPlantillas} />}
          {tab === 'suplementacion' && <PlanSuplementacionForm pacienteInicial={nombreCompleto} diagnosticoInicial={diagnosticoInicial} pacienteId={id} onVacioChange={setFormVacio} onPanelPlantillasChange={setPanelPlantillas} />}
          {tab === 'internamiento' && <SolicitudInternamientoForm pacienteInicial={nombreCompleto} diagnosticoInicial={diagnosticoInicial} pacienteId={id} onVacioChange={setFormVacio} onPanelPlantillasChange={setPanelPlantillas} />}
          {tab === 'escrito' && <EscritoMedicoForm pacienteInicial={nombreCompleto} pacienteId={id} onVacioChange={setFormVacio} onPanelPlantillasChange={setPanelPlantillas} />}
          {tab === 'consentimiento' && <ConsentimientoInformadoForm pacienteInicial={nombreCompleto} diagnosticoInicial={diagnosticoInicial} edadInicial={edadInicial} pacienteId={id} onVacioChange={setFormVacio} onPanelPlantillasChange={setPanelPlantillas} />}
          {tab === 'honorarios' && <NotaHonorariosForm pacienteInicial={nombreCompleto} pacienteId={id} onVacioChange={setFormVacio} onPanelPlantillasChange={setPanelPlantillas} />}
        </SelectorTipoDocumento>
      </div>
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
