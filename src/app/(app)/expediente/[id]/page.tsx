'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { useAuditAccess } from '@/hooks/useAudit'
import { Paciente, Consulta, Documento } from '@/types'
import Portal from '@/components/ui/Portal'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'

import CabeceraPaciente from '@/components/expediente/CabeceraPaciente'
import PestanasExpediente, {
  esPestanaValida, PESTANA_POR_DEFECTO, type ClavePestana,
} from '@/components/expediente/PestanasExpediente'
import LineaTiempoClinica from '@/components/expediente/LineaTiempoClinica'
import PanelConsultas from '@/components/expediente/PanelConsultas'
import FichaClinica, { type ProximaCita } from '@/components/expediente/FichaClinica'
import PanelLaboratorios from '@/components/labs/PanelLaboratorios'
import ModalConsultas from '@/components/expediente/ModalConsultas'
import ModalDocumentos from '@/components/expediente/ModalDocumentos'

// Diferido A PROPÓSITO. NO lo vuelvas a importar estáticamente: arrastra TipTap,
// ProseMirror y DOMPurify a la carga inicial del expediente, para un modal que
// arranca cerrado (`docSeleccionado` empieza en `null`) y que solo se abre al
// hacer clic en un documento. `ssr: false` es válido aquí porque esta página es
// un Client Component.
const ModalVisorDocumento = dynamic(
  () => import('@/components/expediente/ModalVisorDocumento'),
  { ssr: false }
)

/** Límite de registros por query */
const QUERY_LIMIT = 50

/** Lo que enseña una pestaña cuyo contenido llega en un bloque posterior. */
function PendienteDeBloque({ nombre }: { nombre: string }) {
  return (
    <div className="flex flex-col items-center gap-[var(--sp-2-5)] rounded-[14px] border border-dashed border-[color:var(--sp-line-card)] px-[var(--sp-pad-row-x)] py-[var(--sp-10)]">
      <p className="text-center text-[length:var(--sp-fs-body-sm)] text-[var(--sp-ink-500)]">
        {nombre} se muda a esta pestaña en el bloque siguiente.
      </p>
      <p className="text-center text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-350)]">
        Mientras tanto se abre como hasta ahora, sin cambios.
      </p>
    </div>
  )
}

function ExpedientePacienteContent() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { isDoctor } = useProfile()
  useAuditAccess('pacientes', id) // NOM-024: registrar acceso al expediente

  // ── Estados UI ──
  const [docSeleccionado, setDocSeleccionado] = useState<Documento | null>(null)
  const [mostrarModalConsultas, setMostrarModalConsultas] = useState(false)
  const [mostrarModalDocumentos, setMostrarModalDocumentos] = useState(false)
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

  const cambiarPestana = useCallback((clave: ClavePestana, consultaId?: string) => {
    const url = new URL(window.location.href)
    if (clave === PESTANA_POR_DEFECTO) url.searchParams.delete('tab')
    else url.searchParams.set('tab', clave)
    /* ⚠️ `consulta` SOLO SIGNIFICA ALGO EN LA PESTAÑA CONSULTAS, así que al
       irse a cualquier otra se limpia. Si no, un enlace copiado desde
       Documentos arrastraría el id de una nota que allí no abre nada. */
    if (consultaId) url.searchParams.set('consulta', consultaId)
    else if (clave !== 'consultas') url.searchParams.delete('consulta')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [])

  /** Cambiar de nota DENTRO de la pestaña, sin tocar la pestaña. */
  const fijarConsulta = useCallback((consultaId: string) => {
    const url = new URL(window.location.href)
    url.searchParams.set('consulta', consultaId)
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

  // Refetch helper for child actions (delete doc)
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

  async function eliminarDocumento(docId: string) {
    const res = await fetch(`/api/documentos/${docId}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchDocumentos()
    }
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

  // ── Loading / not-found guards ─────────────────────────────
  if (loadingPaciente) {
    return <div className="text-center py-12 text-slate-400">Cargando expediente...</div>
  }
  if (!paciente) {
    return <div className="text-center py-12 text-slate-400">Paciente no encontrado</div>
  }

  return (
    <div className="max-w-[960px] mx-auto animate-slide-up">

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

      {/* ── Modal lista de documentos ──
          Montado SOLO cuando está abierto. Cerrado no pintaba nada, pero sus
          hooks sí corrían: useMedicoInfo dispara /api/me/perfil-medico y, en
          su onSuccess, un PBKDF2 de secureStorage más syncDoctorProfile con
          dos descargas de imágenes y una escritura síncrona a localStorage.
          Todo eso para un modal que la mayoría de las visitas no abre.
          La apertura se ve igual: ModalShell ya devolvía null cerrado y sus
          animaciones (animate-fade-in / animate-modal-enter) arrancan con el
          montaje, que ahora ocurre en el mismo render en que open pasa a true.
          No hay animación de salida que se pierda al desmontar. */}
      {mostrarModalDocumentos && (
        <ModalDocumentos
          open
          onClose={() => setMostrarModalDocumentos(false)}
          documentos={documentos}
          pacienteId={id}
          onVerDocumento={(doc) => {
            setMostrarModalDocumentos(false)
            setDocSeleccionado(doc)
          }}
          onEliminarDocumento={eliminarDocumento}
        />
      )}

      {/* ── Modal eliminar paciente — macOS alert dialog ── */}
      {mostrarEliminarPaciente && (
        <Portal>
        {/* ⚠️ EL RELLENO DE ABAJO LLEVA LA BARRA DE GESTOS SUMADA (bloque 6 ·
            paso 10), Y AQUÍ NO ES COSMÉTICO. Por debajo de `sm` este diálogo va
            anclado al borde inferior (`items-end`), y desde que el viewport es
            `viewport-fit=cover` esos 16 px de `p-4` se miden contra el borde
            FÍSICO de la pantalla. La barra de gestos mide ~34: la fila de
            botones quedaba a medias debajo de ella. Y esa fila es «Cancelar» y
            «Eliminar» —borrado permanente de un expediente— repartidos al 50 %,
            o sea que el dedo que falla acierta en el otro.
            ⚠️ SÓLO POR DEBAJO DE `sm`. De ahí para arriba el diálogo se centra
            (`sm:items-center`) y no toca ningún borde; sumarle relleno inferior
            lo descentraría hacia arriba media área segura.
            ⚠️ EL 16 DE DISEÑO NO SE TOCA: se suma. Donde el sistema no se
            superpone, `env()` vale 0 y esto es el `p-4` de siempre. */}
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 max-sm:pb-[calc(1rem+env(safe-area-inset-bottom,0px))] bg-black/40 backdrop-blur-sm animate-fade-in">
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

      {/* ── Región 1 · Cabecera del paciente, persistente en las cuatro
             pestañas ────────────────────────────────────────────────────── */}
      <CabeceraPaciente
        paciente={paciente}
        isDoctor={isDoctor}
        onEditar={() => router.push(`/expediente/${id}/editar`)}
        onNuevoDocumento={() => router.push(`/expediente/${id}/documentos`)}
      />

      {/* ── Región 2 · Barra de pestañas ─────────────────────────────────── */}
      <PestanasExpediente activa={pestana} conteos={conteos} onCambiar={cambiarPestana} />

      {/* ── Cuerpo de la pestaña activa ───────────────────────────────────
          ⚠️ EL CONTENIDO ES EL DE HOY, MUDADO DE SITIO. Este bloque construye
          el chasis; el rediseño de cada pestaña llega después. Por eso el
          Resumen conserva la parrilla de tarjetas y las dos de «Estado», y
          Consultas y Documentos anuncian lo que falta en vez de fingirlo. */}
      <div className="mt-[var(--sp-gap-band)]">
        {pestana === 'resumen' && (
          /* ⚠️ LOS TRES HIJOS SON DOS COMPONENTES. `FichaClinica` entra al grid
             como `display: contents` por debajo de `lg`, así que aporta DOS
             hijos —diagnóstico+alergias y el resto— y la línea de tiempo se
             cuela entre ellos con `order`, que es el orden móvil del §3.2. En
             `lg` la ficha vuelve a ser una card entera y las dos columnas se
             colocan a mano (`col-start`), sin depender del orden del código.
             `items-start` es lo que impide que una columna estire su altura
             para igualar a la otra. */
          <div className="grid grid-cols-1 gap-[var(--sp-gap-band)] lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
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
            <div className="order-2 min-w-0 lg:order-none lg:col-start-1 lg:row-start-1">
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
        {pestana === 'documentos' && <PendienteDeBloque nombre="Documentos" />}
        {pestana === 'mediciones' && <PanelLaboratorios paciente={paciente} />}
      </div>

      {/* Eliminar paciente. Fuera de las pestañas: es una acción sobre el
          expediente entero, no sobre ninguna de sus secciones. */}
      {isDoctor && (
        <div className="mt-[var(--sp-gap-band)] flex justify-end">
          <button
            type="button"
            onClick={() => setMostrarEliminarPaciente(true)}
            className="flex items-center gap-[var(--sp-1-5)] text-[length:var(--sp-fs-legal)] text-[var(--sp-ink-350)] transition-colors hover:text-[var(--sp-danger)]"
          >
            <Trash2 size={12} /> Eliminar paciente
          </button>
        </div>
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
