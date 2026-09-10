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

const FormError = () => (
  <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
    <p className="text-sm font-medium">No se pudo cargar el formulario</p>
    <p className="text-xs">Verifica tu conexion e intenta de nuevo</p>
  </div>
)

/**
 * `dynamic` con la red caída rechaza la promesa del import, y un `lazy` que
 * rechaza NO lo recoge el `loading:` — sube al boundary más cercano y se lleva
 * la pantalla entera, cabecera del paciente incluida. El `.catch` la convierte
 * en un módulo válido que pinta el error DENTRO del panel, así que el resto de
 * la página sigue viva y se puede cambiar de tipo.
 *
 * ⚠️ TERCERA COPIA DELIBERADA de este helper: las otras dos están en
 * `(app)/documentos/page.tsx:26` y `expediente/[id]/nueva-nota/page.tsx:47`.
 * No se factoriza mientras la primera de las tres tenga fecha de retirada.
 */
function safeDynamic<T extends Record<string, unknown>>(loader: () => Promise<{ default: React.ComponentType<T> }>) {
  return dynamic<T>(
    () => loader().catch(() => ({
      default: (() => FormError()) as unknown as React.ComponentType<T>,
    })),
    { ssr: false, loading: FormLoader },
  )
}

const RecetaForm = safeDynamic(() => import('@/components/documentos/RecetaForm'))
const SolicitudLabForm = safeDynamic(() => import('@/components/documentos/SolicitudLabForm'))
const SolicitudImagenForm = safeDynamic(() => import('@/components/documentos/SolicitudImagenForm'))
const PlanSuplementacionForm = safeDynamic(() => import('@/components/documentos/PlanSuplementacionForm'))
const SolicitudInternamientoForm = safeDynamic(() => import('@/components/documentos/SolicitudInternamientoForm'))
const EscritoMedicoForm = safeDynamic(() => import('@/components/documentos/EscritoMedicoForm'))
const ConsentimientoInformadoForm = safeDynamic(() => import('@/components/documentos/ConsentimientoInformadoForm'))
const NotaHonorariosForm = safeDynamic(() => import('@/components/documentos/NotaHonorariosForm'))

/** El `?tipo=` de la URL, o null si falta o no nombra a ninguno de los ocho. */
function tipoDeUrl(valor: string | null): TipoDocumento | null {
  return TIPOS_DOCUMENTO.some(x => x.key === valor) ? (valor as TipoDocumento) : null
}

function DocumentosPacienteContent() {
  const { id } = useParams<{ id: string }>()
  useAuditAccess('documentos', id)
  const searchParams = useSearchParams()
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  /* Arranca en el tipo de la url, o en null —y entonces se ven las ocho
     tarjetas—. Quien llega con `?tipo=` aterriza directo en su formulario.

     ⚠️ EL `?tipo=` SE LEE EN EL RENDER Y NO EN UN `useEffect`, Y NO ES ESTILO.
     `SelectorTipoDocumento` decide si nace plegado con `useState(value === null)`,
     o sea EN SU MONTAJE. Un efecto corre DESPUÉS del primer pintado, así que
     entrar por `?tipo=receta` pintaba un fotograma con las OCHO TARJETAS
     abiertas y las plegaba justo después: quien llegaba desde el menú veía la
     pregunta que acababa de contestar. Es el mismo defecto que la nota de
     `SelectorTipoDocumento.tsx:128` evita dentro del componente, reintroducido
     desde fuera. Con la lectura en render, `value` ya vale en el montaje.

     El par valor/valor-previo es el patrón de React para reaccionar al cambio
     de una entrada durante el render, y hace falta porque `PageTransition`
     lleva `key={pathname}`: navegar de `?tipo=receta` a `?tipo=lab` NO
     remonta esta página, sólo cambia la query. Sin esto, el segundo enlace del
     menú no haría nada. */
  const tipoUrl = tipoDeUrl(searchParams.get('tipo'))
  const [tab, setTab] = useState<TipoDocumento | null>(tipoUrl)
  const [tipoUrlPrevio, setTipoUrlPrevio] = useState(tipoUrl)
  if (tipoUrlPrevio !== tipoUrl) {
    setTipoUrlPrevio(tipoUrl)
    /* Sólo cuando la url NOMBRA un tipo: al volver a `/documentos` sin query no
       se descarta el formulario que el médico ya tiene abierto. */
    if (tipoUrl) setTab(tipoUrl)
  }
  // Los ocho reportan predicado: los siete del sistema de plantillas
  // —Receta, Laboratorio, Imagen, Suplementación, Escrito, Internamiento,
  // Consentimiento— más Honorarios.
  const [formVacio, setFormVacio] = useState(true)
  // El panel de plantillas sustituye al formulario y oculta el selector de tipo.
  const [panelPlantillas, setPanelPlantillas] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('pacientes').select('id, nombre, apellidos, fecha_nacimiento, sexo, numero_expediente').eq('id', id).single().then((res: { data: Paciente | null }) => setPaciente(res.data))
  }, [id])

  const nombreCompleto = paciente ? `${paciente.nombre} ${paciente.apellidos}` : ''
  const diagnosticoInicial = searchParams.get('dx') || ''
  // Borrador que se retoma desde la lista de documentos. Solo lo consume el
  // consentimiento: es el único formato con estado (guía 05 §9).
  const borradorId = searchParams.get('borrador') || undefined
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
          {tab === 'consentimiento' && <ConsentimientoInformadoForm pacienteInicial={nombreCompleto} diagnosticoInicial={diagnosticoInicial} edadInicial={edadInicial} pacienteId={id} borradorId={borradorId} onVacioChange={setFormVacio} onPanelPlantillasChange={setPanelPlantillas} />}
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
