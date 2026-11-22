'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { useAuditAccess } from '@/hooks/useAudit'
import { Paciente, Consulta, Documento } from '@/types'
import ModalShell from '@/components/ui/ModalShell'
import { AlertTriangle, Loader2 } from 'lucide-react'

import CabeceraPaciente from '@/components/expediente/CabeceraPaciente'
import PestanasExpediente, {
  esPestanaValida, PESTANA_POR_DEFECTO, type ClavePestana,
} from '@/components/expediente/PestanasExpediente'
import LineaTiempoClinica from '@/components/expediente/LineaTiempoClinica'
import PanelConsultas from '@/components/expediente/PanelConsultas'
import PanelDocumentos from '@/components/expediente/PanelDocumentos'
import FichaClinica, { PlegablesFicha, type ProximaCita } from '@/components/expediente/FichaClinica'
import PanelLaboratorios from '@/components/labs/PanelLaboratorios'
/** Límite de registros por query */
const QUERY_LIMIT = 50

function ExpedientePacienteContent() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { isDoctor } = useProfile()
  useAuditAccess('pacientes', id) // NOM-024: registrar acceso al expediente

  // ── Estados UI ──
  const [mostrarEliminarPaciente, setMostrarEliminarPaciente] = useState(false)
  const [eliminandoPaciente, setEliminandoPaciente] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState('')

  // ── Data fetching: direct Supabase queries ──
  /* ⚠️ LA PESTAÑA ACTIVA SALE DE LA URL Y VUELVE A ELLA, para que sobreviva a
     una recarga y se pueda enlazar. Se lee con `useSearchParams`, y al cambiar
     se reescribe con `history.replaceState` en vez de `router.replace`: éste
     pediría el árbol RSC de la ruta entera cada vez que el médico toca una
     pestaña, y aquí no hay nada que volver a pedir al servidor —el cambio es
     puramente de cliente—. `replaceState` además no añade entrada de
     historial, así que el botón de atrás sigue llevando al listado y no
     recorre las pestañas visitadas.
     Un `?tab=` que no exista cae a Resumen en vez de dejar la pantalla vacía. */
  const searchParams = useSearchParams()
  const tabDeUrl = searchParams.get('tab')
  const pestana: ClavePestana = esPestanaValida(tabDeUrl) ? tabDeUrl : PESTANA_POR_DEFECTO

  /* La nota abierta viaja en la MISMA url que la pestaña, con el mismo
     mecanismo: así «Leer nota» del Resumen es un enlace compartible y sobrevive
     a una recarga. Aquí sólo se lee; validarlo contra las consultas cargadas es
     cosa del panel, que es quien las tiene — un id que no corresponda a ninguna
     cae a la más reciente y no es un error. */
  const consultaDeUrl = searchParams.get('consulta')
  /* Mismo mecanismo para el documento abierto: enlace compartible y superviviente
     a una recarga. El panel valida contra lo cargado; un id que no corresponda
     cae al primero listable. */
  const documentoDeUrl = searchParams.get('documento')

  const cambiarPestana = useCallback((clave: ClavePestana, consultaId?: string) => {
    const url = new URL(window.location.href)
    if (clave === PESTANA_POR_DEFECTO) url.searchParams.delete('tab')
    else url.searchParams.set('tab', clave)
    /* ⚠️ `consulta` SOLO SIGNIFICA ALGO EN LA PESTAÑA CONSULTAS, así que al
       irse a cualquier otra se limpia. Si no, un enlace copiado desde
       Documentos arrastraría el id de una nota que allí no abre nada. */
    if (consultaId) url.searchParams.set('consulta', consultaId)
    else if (clave !== 'consultas') url.searchParams.delete('consulta')
    if (clave !== 'documentos') url.searchParams.delete('documento')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])

  /** Cambiar de nota DENTRO de la pestaña, sin tocar la pestaña. */
  const fijarConsulta = useCallback((consultaId: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('consulta', consultaId)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])

  /** Lo mismo para el documento abierto. */
  const fijarDocumento = useCallback((documentoId: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('documento', documentoId)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])

  /* Los tres conteos reales de la barra. `undefined` mientras no resuelven: la
     insignia no se dibuja, en vez de anunciar un cero que sería una
     afirmación. La cuarta pestaña no lleva conteo — contar analitos DISTINTOS
     no es un `count` barato y ningún índice lo cubre. */
  const [conteos, setConteos] = useState<Partial<Record<ClavePestana, number>>>({})

  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [consultas, setConsultas] = useState<Consulta[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loadingPaciente, setLoadingPaciente] = useState(true)
  const [proximaCita, setProximaCita] = useState<ProximaCita | null>(null)

  /* ⚠️ CONSULTAS Y DOCUMENTOS COMPARTEN UN SOLO ESTADO, y no es pereza: las dos
     columnas del Resumen los leen juntos —la línea de tiempo los funde en una
     cronología y la ficha saca de las consultas el diagnóstico activo—, así que
     media carga no es un estado que ninguna de las dos sepa pintar. Un fallo en
     cualquiera de los dos deja el bloque entero en error, con reintento. */
  const [estadoActividad, setEstadoActividad] = useState<'cargando' | 'listo' | 'error'>('cargando')
  const peticionActividad = useRef(0)

  const cargarActividad = useCallback(async () => {
    const mia = ++peticionActividad.current
    setEstadoActividad('cargando')
    const supabase = createClient()
    try {
      const [c, d] = await Promise.all([
        supabase.from('consultas').select('*').eq('paciente_id', id)
          .order('fecha', { ascending: false }).limit(QUERY_LIMIT),
        supabase.from('documentos').select('*').eq('paciente_id', id)
          .order('created_at', { ascending: false }).limit(QUERY_LIMIT),
      ])
      // Una respuesta de una petición ya sustituida no pisa a la vigente.
      if (mia !== peticionActividad.current) return
      if (c.error || d.error) throw c.error ?? d.error
      setConsultas((c.data ?? []) as Consulta[])
      setDocumentos((d.data ?? []) as Documento[])
      setEstadoActividad('listo')
    } catch {
      if (mia !== peticionActividad.current) return
      setEstadoActividad('error')
    }
  }, [id])

  useEffect(() => { void cargarActividad() }, [cargarActividad])

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

    // Consultas y documentos: los trae `cargarActividad`, que además
    // sostiene el estado de carga/error y el reintento de las dos columnas.

    /* ⚠️ LOS TRES CONTEOS SON REALES, y no `consultas.length`. Las dos listas
       de arriba vienen acotadas a 50, así que su longitud MIENTE en cuanto un
       paciente pasa de ese número — y una insignia de pestaña que dice «50»
       para siempre es peor que ninguna. `head: true` no trae filas: sólo el
       total, y los dos van por índice de `paciente_id`.
       El de mediciones cuenta FILAS, no analitos distintos, y por eso NO
       alimenta ninguna insignia: la cuarta pestaña se quedó sin conteo
       precisamente porque el número que el spec pide —analitos rastreados— es
       un `count(DISTINCT …)` sobre dos columnas que ningún índice cubre. */
    Promise.all([
      supabase.from('consultas').select('id', { count: 'exact', head: true }).eq('paciente_id', id),
      supabase.from('documentos').select('id', { count: 'exact', head: true }).eq('paciente_id', id),
    ])
      .then(([c, d]: { count: number | null }[]) => {
        if (cancelled) return
        setConteos({ consultas: c.count ?? 0, documentos: d.count ?? 0 })
      })
      .catch(() => { /* sin conteo, la insignia no se dibuja */ })

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

  // ── Loading / not-found guards ─────────────────────────────
  if (loadingPaciente) {
    return <p className="k-t-sec py-12 text-center" aria-busy="true">Cargando expediente...</p>
  }
  if (!paciente) {
    return <p className="k-t-sec py-12 text-center">Paciente no encontrado</p>
  }

  const cerrarEliminar = () => { if (!eliminandoPaciente) { setMostrarEliminarPaciente(false); setErrorEliminar('') } }

  return (
    /* ═══ REDISEÑO B7 (maqueta `final-expediente`) ═══════════════════════════
       En `esc`, dos columnas: la FICHA a la izquierda (cabecera del paciente y
       sus plegables de antecedentes y antropometría) y las pestañas a la
       derecha. En el resto, una columna: cabecera, pestañas y contenido.
       Todo con variantes de CSS: ningún marcado depende del formato. */
    <div className="mx-auto w-full max-w-[1120px] esc:grid esc:grid-cols-[280px_minmax(0,1fr)] esc:items-start esc:gap-10">

      {/* ⚠️ EL ÚNICO DIÁLOGO DE LA PÁGINA ES EL DE ELIMINAR PACIENTE: es una
         acción sobre el expediente entero, no sobre una pestaña. Alerta
         destructiva del catálogo (CALMA §13, §15): título «Eliminar paciente»,
         el foco entra en «Cancelar» y el velo no la cierra. */}
      <ModalShell
        open={mostrarEliminarPaciente}
        onClose={cerrarEliminar}
        variante="alerta"
        tono="destruir"
        icon={<AlertTriangle aria-hidden="true" />}
        title="Eliminar paciente"
        footer={
          <>
            <button type="button" autoFocus onClick={cerrarEliminar} disabled={eliminandoPaciente} className="k-b k-b-capa k-b-quieto">
              Cancelar
            </button>
            <button type="button" data-principal onClick={eliminarPaciente} disabled={eliminandoPaciente} className="k-b k-b-capa k-b-mal">
              {eliminandoPaciente
                ? <><Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Eliminando...</>
                : 'Eliminar'}
            </button>
          </>
        }
      >
        <p className="font-semibold text-tinta">{paciente.nombre} {paciente.apellidos}</p>
        <p className="mt-2">
          Se eliminarán <span className="font-semibold">permanentemente</span> todas las notas, laboratorios, documentos y datos personales del paciente.
        </p>
        <p className="mt-2">Esta acción no se puede deshacer.</p>
        {errorEliminar && <p role="alert" className="k-campo-error mt-3">{errorEliminar}</p>}
      </ModalShell>

      {/* ── Ficha: la cabecera del paciente, persistente en las cuatro
             pestañas. En esc es la columna izquierda. ───────────────────── */}
      <aside aria-label="Paciente" className="flex flex-col gap-4">
        <CabeceraPaciente
          paciente={paciente}
          isDoctor={isDoctor}
          onEditar={() => router.push(`/expediente/${id}/editar`)}
          onNuevoDocumento={() => router.push(`/expediente/${id}/documentos`)}
          onEliminar={() => setMostrarEliminarPaciente(true)}
        />
        <PlegablesFicha paciente={paciente} enColumna />
      </aside>

      <div className="mt-5 min-w-0 esc:mt-0">
        {/* ── Barra de pestañas ─────────────────────────────────────────── */}
        <PestanasExpediente activa={pestana} conteos={conteos} onCambiar={cambiarPestana} />

        <div className="mt-5 esc:mt-6">
          {pestana === 'resumen' && (
            /* ⚠️ `FichaClinica` aporta DOS hijos (`display: contents`) y la línea
               de tiempo se cuela entre ellos con `order`: teléfono =
               diagnóstico, actividad, plegables. En ih/iv dos columnas
               (diagnóstico + plegables | actividad) colocadas con `col-start`.
               `items-start` impide que una columna estire a la otra. */
            <div className="grid grid-cols-1 items-start gap-6 ih:grid-cols-2 ih:grid-rows-[auto_1fr] ih:gap-4 iv:grid-cols-2 iv:grid-rows-[auto_1fr] iv:gap-5 esc:gap-7">
              <FichaClinica
                paciente={paciente}
                consultas={consultas}
                totalConsultas={conteos.consultas}
                proximaCita={proximaCita}
                cargandoActividad={estadoActividad === 'cargando'}
                errorActividad={estadoActividad === 'error'}
                onReintentarActividad={() => { void cargarActividad() }}
                onIrAPestana={cambiarPestana}
              />
              <div className="order-2 min-w-0 ih:col-start-2 ih:row-span-2 ih:row-start-1 iv:col-start-2 iv:row-span-2 iv:row-start-1">
                <LineaTiempoClinica
                  pacienteId={id}
                  sexo={paciente.sexo}
                  isDoctor={isDoctor}
                  consultas={consultas}
                  documentos={documentos}
                  cargandoActividad={estadoActividad === 'cargando'}
                  errorActividad={estadoActividad === 'error'}
                  onReintentarActividad={() => { void cargarActividad() }}
                  onIrAPestana={cambiarPestana}
                />
              </div>
            </div>
          )}

          {pestana === 'consultas' && (
            <PanelConsultas
              paciente={paciente}
              consultas={consultas}
              totalConsultas={conteos.consultas}
              cargandoActividad={estadoActividad === 'cargando'}
              errorActividad={estadoActividad === 'error'}
              onReintentarActividad={() => { void cargarActividad() }}
              consultaSolicitadaId={consultaDeUrl}
              onSeleccionarConsulta={fijarConsulta}
            />
          )}
          {pestana === 'documentos' && (
            <PanelDocumentos
              paciente={paciente}
              documentos={documentos}
              totalDocumentos={conteos.documentos}
              cargandoActividad={estadoActividad === 'cargando'}
              errorActividad={estadoActividad === 'error'}
              onReintentarActividad={() => { void cargarActividad() }}
              onRecargarDocumentos={() => { void cargarActividad() }}
              documentoSolicitadoId={documentoDeUrl}
              onSeleccionarDocumento={fijarDocumento}
              onIrAArchivos={() => cambiarPestana('mediciones')}
            />
          )}
          {pestana === 'mediciones' && <PanelLaboratorios paciente={paciente} />}
        </div>
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
