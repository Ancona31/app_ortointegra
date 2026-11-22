'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import ModalShell from '@/components/ui/ModalShell'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Paciente, Diagnostico, MedicamentoConsulta, SignosVitales, MedicoInfo } from '@/types'
import type { MedicamentoIA, BloqueIA, NotaIAResponse } from '@/lib/notaIA/schema'
import { calcularEdad, generateDocFileName } from '@/lib/patientUtils'
import { buildNotaRenderData } from '@/lib/notaRenderData'
import {
  ChevronLeft, Save, Loader2, RotateCcw, Printer, Eye, Pencil,
  Pill, Check, PenLine, X, FileText,
  Mic, Sparkles, AlertTriangle, Lock, FolderOpen, CloudCheck, User,
} from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { generarPdf } from '@/lib/mobileShare'
import { secureStorage } from '@/lib/secureStorage'
import { vaciarCacheCitas } from '@/lib/agenda/cacheRangosCitas'
import { useAuditAccess } from '@/hooks/useAudit'
import DiagnosticosEditor from '@/components/documentos/DiagnosticosEditor'
import dynamic from 'next/dynamic'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import SignosVitalesCard, { type SignosVitalesForm } from '@/components/expediente/SignosVitalesCard'
import { fueraDeLimitesDuros, type SignoVitalKey } from '@/lib/signosVitalesRangos'
import SelectorTipoDocumento, { tipoDocumento, type TipoDocumento } from '@/components/documentos/SelectorTipoDocumento'

function FormCargando() {
  return (
    <div className="flex items-center justify-center py-12 text-tinta2">
      <Loader2 size={20} className="animate-spin mr-2" />
      <span className="text-sm">Cargando formulario...</span>
    </div>
  )
}

function FormErrorFallback() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-tinta2">
      <p className="text-sm font-medium">No se pudo cargar el formulario</p>
      <p className="text-xs">Verifica tu conexion e intenta de nuevo</p>
    </div>
  )
}

function safeDynamic<T extends Record<string, unknown>>(loader: () => Promise<{ default: React.ComponentType<T> }>) {
  return dynamic<T>(
    () => loader().catch(() => ({
      default: (() => <FormErrorFallback />) as unknown as React.ComponentType<T>,
    })),
    { ssr: false, loading: () => <FormCargando /> },
  )
}

const RecetaFormDynamic       = safeDynamic(() => import('@/components/documentos/RecetaForm'))
const SolicitudLabFormDynamic = safeDynamic(() => import('@/components/documentos/SolicitudLabForm'))
const SolicitudImagenFormDynamic = safeDynamic(() => import('@/components/documentos/SolicitudImagenForm'))
const PlanSupFormDynamic      = safeDynamic(() => import('@/components/documentos/PlanSuplementacionForm'))
const InternamientoFormDynamic = safeDynamic(() => import('@/components/documentos/SolicitudInternamientoForm'))
const EscritoFormDynamic      = safeDynamic(() => import('@/components/documentos/EscritoMedicoForm'))
const ConsentimientoFormDynamic = safeDynamic(() => import('@/components/documentos/ConsentimientoInformadoForm'))
const HonorariosFormDynamic   = safeDynamic(() => import('@/components/documentos/NotaHonorariosForm'))

type MedicamentoConVia = {
  nombre_comercial: string; presentacion: string; dosis: string
  principio_activo: string; indicacion: string; via_administracion: string
}

const MED_VACIA: MedicamentoConsulta = { nombre: '', dosis: '', frecuencia: '', duracion: '' }

// Máquina de estados del modal del funnel de nota (paso 1.1).
type EstadoModal = 'generando' | 'entrevista' | 'revision' | 'contexto' | 'confirmacion' | 'exito' | null

// Header del ModalShell por estado. 'confirmacion' (paso 1.4) y 'exito' (paso 1.5)
// usan header vacío: su superficie es un bloque centrado en el cuerpo (ícono +
// título), fieles a M6/M7. El resto conserva header con ícono Spinus.
// La geometría sustituye a maxWidth (paso 3.2.B): ancho y anclaje son un solo
// eje en la spec, no dos. 'entrevista' cae en el default y es un estado alto
// ('work'), como revisión y contexto: los tres se anclan a top:60px para que
// el header no salte entre transiciones.
function metaDelModal(e: EstadoModal): { title: string; subtitle: string; geometry: 'work' | 'decide' | 'done' | 'wait' } {
  switch (e) {
    case 'revision':     return { title: 'Tu nota está lista',              subtitle: 'Revísala antes de guardar',       geometry: 'work'   }
    case 'contexto':     return { title: 'Ajusta el contexto',              subtitle: 'La nota se generará de nuevo',    geometry: 'work'   }
    case 'generando':    return { title: 'Spinus está redactando tu nota',  subtitle: 'Unos segundos…',                  geometry: 'wait'   }
    case 'confirmacion': return { title: '¿Guardar esta nota?',             subtitle: '',                                geometry: 'decide' }
    case 'exito':        return { title: '',                                subtitle: '',                                geometry: 'done'   }
    default:             return { title: 'Spinus necesita más información', subtitle: 'Responde para completar la nota', geometry: 'work'   }
  }
}

// Entrada de cada estado del modal (ajuste de la nota): opacidad y un
// desplazamiento corto con el resorte del kit (`.sp-nota-entra`, tokens §12),
// sólo opacidad con movimiento reducido. Sustituye a los deslizamientos
// laterales y al «pop» de la medalla, que eran del catálogo viejo.

// Lista de pasos del Estado 0 (paso 3.2.C1, evoluciona los mensajes rotativos
// de 3.1). Componente aislado: su re-render no toca el modal. Al aparecer
// errorModal la rama de 'generando' cambia y este hijo se desmonta → el
// interval se limpia solo (la progresión se detiene).
// Los pasos NO corresponden a eventos reales: es progresión temporizada, la
// misma honestidad que los mensajes que sustituye, mejor presentada. El índice
// CLAMPEA en el último paso — ciclar des-completaría pasos ya marcados como
// hechos; sostener la señal de "sigue trabajando" es tarea de los .sp-dots.
const PASOS_GENERANDO = [
  'Leyendo tu dictado',
  'Estructurando la nota',
  'Redactando la exploración',
]
function PasosGenerando() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI(prev => Math.min(prev + 1, PASOS_GENERANDO.length - 1)), 2000)
    return () => clearInterval(id)
  }, [])
  // Avance por pasos: nunca llega al final (el último paso espera a la IA).
  const avance = (i + 1) / (PASOS_GENERANDO.length + 1)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="nn-marca-viva inline-flex size-11 flex-none items-center justify-center rounded-[14px] bg-tonal text-enlace" aria-hidden="true">
          <Sparkles size={22} strokeWidth={2.1} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-[18px] text-enlace">Paso {i + 1} de {PASOS_GENERANDO.length}</p>
          <div className="nn-avance mt-1.5" aria-hidden="true">
            <span style={{ transform: `scaleX(${avance})` }} />
          </div>
        </div>
      </div>
      <ol className="sp-steps" role="status">
        {PASOS_GENERANDO.map((texto, idx) => (
          <li key={texto} className={`sp-step ${idx < i ? 'sp-step--done' : idx === i ? 'sp-step--active' : 'sp-step--pending'}`}>
            <span className="sp-step__i" aria-hidden="true">
              {idx < i ? <Check /> : idx === i ? <span className="sp-spinner" /> : <span className="sp-step__dot" />}
            </span>
            {texto}
          </li>
        ))}
      </ol>
    </div>
  )
}

// Vista previa de la nota (maqueta `final-nota`, vista 13): el encabezado de
// sección que escriben la IA y la vía manual («**[SUBJETIVO]:**») se pinta
// como rótulo en su propia línea —«SUBJETIVO» en el color de enlace—, como en
// la nota sellada (`CuerpoNota`). Cualquier otra negrita queda como negrita.
// Sólo presentación: el texto que se guarda no cambia.
function NegritaNota({ children }: { children?: React.ReactNode }) {
  const texto = typeof children === 'string' ? children : Array.isArray(children) && children.every(c => typeof c === 'string') ? children.join('') : null
  const m = texto?.trim().match(/^\[([^\]]+)\]:?$/)
  if (!m) return <strong>{children}</strong>
  return (
    <span className="mb-1.5 mt-5 flex items-center gap-2 text-[13px] font-bold uppercase leading-[18px] tracking-[.5px] text-enlace">
      <span aria-hidden="true" className="h-3.5 w-[3px] flex-none rounded-full bg-accion" />
      {m[1]}
    </span>
  )
}

// Contexto del paciente (ajuste 2): edad, sexo e IMC como datos —rótulo
// pequeño encima, valor en tinta— en lugar de una línea corrida.
function DatosContexto({ paciente }: { paciente: Paciente }) {
  const datos = [
    paciente.fecha_nacimiento ? ['Edad', calcularEdad(paciente.fecha_nacimiento).textoElegante] : null,
    paciente.sexo ? ['Sexo', paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Femenino' : paciente.sexo] : null,
    paciente.peso_kg && paciente.talla_cm ? ['IMC', (paciente.peso_kg / Math.pow(paciente.talla_cm / 100, 2)).toFixed(1)] : null,
  ].filter((d): d is string[] => d !== null)
  if (datos.length === 0) return null
  return (
    <dl className="mt-3 grid grid-cols-3 gap-2">
      {datos.map(([r, v]) => (
        <div key={r} className="min-w-0 rounded-[var(--r-control)] bg-fondo px-3 py-2">
          <dt className="text-[12px] font-semibold leading-4 text-tinta2">{r}</dt>
          <dd className="k-num mt-0.5 truncate text-[15px] font-semibold leading-5 text-tinta">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

// «Último diagnóstico»: un renglón por diagnóstico (la lista viene de la
// consulta, no de partir el texto); más de cuatro se pliegan en un <details>.
const DX_VISIBLES = 4
function ListaUltimoDx({ lista }: { lista: string[] }) {
  const fila = (t: string, i: number) => (
    <li key={i} className="flex items-start gap-2 py-1 text-[14px] leading-5 text-tinta">
      <span aria-hidden="true" className="mt-[7px] size-1.5 flex-none rounded-full bg-enlace" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{t}</span>
    </li>
  )
  const resto = lista.slice(DX_VISIBLES)
  return (
    <>
      <ul>{lista.slice(0, DX_VISIBLES).map(fila)}</ul>
      {resto.length > 0 && (
        <details className="group">
          <summary className="k-b k-b-texto -ml-1 cursor-pointer list-none text-[14px] [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Ver {resto.length} más</span>
            <span className="hidden group-open:inline">Ver menos</span>
          </summary>
          <ul>{resto.map((t, i) => fila(t, i + DX_VISIBLES))}</ul>
        </details>
      )}
    </>
  )
}

const EMPTY_FORM: {
  motivo_consulta: string
  exploracion_fisica: string
  diagnosticos: Diagnostico[]
  analisis: string
  pronostico: string
  plan_tratamiento: string
  gabinete_laboratorios: string
  proxima_cita: string
} = {
  motivo_consulta: '', exploracion_fisica: '', diagnosticos: [], analisis: '',
  pronostico: '', plan_tratamiento: '', gabinete_laboratorios: '', proxima_cita: '',
}

function formatDiagnosticosInline(dxs: Diagnostico[]): string {
  return dxs
    .filter(d => d.descripcion?.trim())
    .map(d => d.codigo_cie10 ? `${d.codigo_cie10} · ${d.descripcion}` : d.descripcion)
    .join(' + ')
}

// Fase 3: convierte los strings del form de vitales a números; omite vacíos.
// Objeto vacío → undefined (la key NO se envía al payload; consulta sin vitales).
function construirSignosVitalesPayload(sv: SignosVitalesForm): SignosVitales | undefined {
  const out: SignosVitales = {}
  const campos: (keyof SignosVitalesForm)[] = ['ta_sistolica', 'ta_diastolica', 'fc', 'fr', 'temp', 'spo2']
  for (const c of campos) {
    const raw = sv[c]?.trim()
    if (!raw) continue
    const n = Number(raw)
    if (Number.isFinite(n)) out[c] = n
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export default function NuevaNotaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  /* La cita de la que salió esta consulta, si salió de alguna (plan §12.13).
     La ponen los tres botones de «Iniciar consulta» como `?cita=<uuid>`; viaja
     al servidor en el cuerpo del POST, se guarda en `consultas.appointment_id`
     y es lo que permite marcar la cita como atendida.

     SE LEE DE `window.location` Y NO CON `useSearchParams`, que obligaría a
     envolver la página en un `Suspense` sólo por esto. Es seguro: el
     componente es de cliente y la lectura va dentro de un efecto.

     RECARGAR LA PÁGINA NO LO PIERDE —el parámetro sigue en la URL—, así que no
     hace falta guardarlo en el borrador cifrado. Y no se debe: el borrador está
     indexado por paciente, no por cita, y uno viejo podría acabar marcando una
     cita distinta del mismo paciente.

     Si no viene, no pasa nada: se guarda la nota y no se marca ninguna cita,
     que es lo correcto para un paciente que llegó sin agendar. */
  const [citaOrigen, setCitaOrigen] = useState<string | null>(null)
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('cita')
    if (v) setCitaOrigen(v)
  }, [])
  const { consultorioActivo } = useConsultorioActivo()
  useAuditAccess('consultas', id) // NOM-024: registrar acceso a nota médica
  const [medicoInfo, setMedicoInfo] = useState<MedicoInfo | null>(null)
  const [paciente, setPaciente]     = useState<Paciente | null>(null)

  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [medicamentos, setMedicamentos] = useState<MedicamentoConsulta[]>([{ ...MED_VACIA }])
  const [signosVitales, setSignosVitales] = useState<SignosVitalesForm>({})
  const [erroresVitales, setErroresVitales] = useState<Set<SignoVitalKey>>(new Set())
  const [modoNota, setModoNota]         = useState<'ia' | 'manual'>('ia')
  const [notaGenerada, setNotaGenerada] = useState('')
  const [bloquesEntrevista, setBloquesEntrevista]     = useState<BloqueIA[]>([])
  const [historialEntrevista, setHistorialEntrevista] = useState<{ rol: 'user' | 'model'; texto: string }[]>([])
  const [respuestasEntrevista, setRespuestasEntrevista] = useState<Record<string, string>>({})
  const [bloqueActual, setBloqueActual] = useState(0)
  // Máquina de estados del modal del funnel de nota.
  const [estadoModal, setEstadoModal] = useState<EstadoModal>(null)
  // Errores de IA mostrados DENTRO del modal (nunca en la página tras el backdrop).
  const [errorModal, setErrorModal]     = useState<string | null>(null)
  const [modoEdicion, setModoEdicion]   = useState(false)
  // R12: la nota se editó a mano → regenerar/actualizar avisa antes de pisarla.
  const [notaEditada, setNotaEditada]   = useState<boolean>(false)
  // Confirmaciones inline (swap de botones): pisar la nota dentro del modal,
  // descartarla desde el ancla de la página.
  const [confirmarPisado, setConfirmarPisado]         = useState<boolean>(false)
  const [confirmarDescarte, setConfirmarDescarte]     = useState<boolean>(false)
  // Colapso del dictado dentro del ancla (mismo patrón que pronosticoExpandido).
  const [dictadoExpandido, setDictadoExpandido]       = useState<boolean>(false)
  const [generando, setGenerando]       = useState(false)
  const [guardando, setGuardando]       = useState(false)
  const [imprimiendo, setImprimiendo]   = useState(false)
  const [notaPdfBlob, setNotaPdfBlob]   = useState<Blob | null>(null)
  const [error, setError]               = useState('')
  const [notaSaved, setNotaSaved]       = useState(false)
  // Tipo de documento desplegado bajo «Concluir consulta». Muere el envoltorio
  // de setDocInline: slideDir/slideKey/prevDocRef solo alimentaban la animación
  // horizontal del overlay, que se retira en este paso.
  const [docInline, setDocInline]       = useState<TipoDocumento | null>(null)
  // Paso 5.1: el formulario montado reporta si tiene algo escrito. Lo emiten
  // los ocho —los siete del sistema de plantillas (Receta, Laboratorio, Imagen,
  // Suplementación, Escrito, Internamiento, Consentimiento) más Honorarios—.
  const [formVacio, setFormVacio]       = useState(true)
  // El panel de plantillas sustituye al formulario y oculta el selector de tipo.
  const [panelPlantillas, setPanelPlantillas] = useState(false)
  // Aviso de §6.2: se avisa, NO se bloquea.
  const [confirmarConcluir, setConfirmarConcluir] = useState(false)
  const [ultimoGuardado, setUltimoGuardado] = useState<Date | null>(null)
  const [borradorRestaurado, setBorradorRestaurado] = useState(false)
  const [ultimaConsulta, setUltimaConsulta] = useState<{ diagnosticos: string; dxLista: string[]; medicamentos: MedicamentoConsulta[] | null } | null>(null)

  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const formRef = useRef(form)
  useEffect(() => { formRef.current = form }, [form])
  const notaGeneradaRef = useRef(notaGenerada)
  useEffect(() => { notaGeneradaRef.current = notaGenerada }, [notaGenerada])
  // Se enciende al primer clic en el selector IA/manual. El toggle limpia
  // notaGenerada, así que notaGeneradaRef NO detecta esa interacción: sin este
  // ref, un borrador que resuelve tarde pisaría la vía que el médico acaba de
  // elegir (y con ella nota_origen).
  const modoTocadoRef = useRef(false)


  // ── Carga datos + borrador ────────────────────────────────────
  const draftKey = `nota-draft-${id}`

  useEffect(() => {
    fetch('/api/me/perfil-medico').then(r => r.json()).then(({ medico }) => setMedicoInfo(medico)).catch(() => {})
    const supabase = createClient()
    supabase.from('pacientes').select('*').eq('id', id).single()
      .then((res: { data: Paciente | null }) => {
        if (res.data) setPaciente(res.data)
      })
      .catch(() => {
        // Sin red — mirror ya cargó los datos arriba, nada que hacer
      })
    // Cargar borrador (cifrado en secureStorage).
    // Tipo laxo del draft para tolerar formato viejo (diagnosticos: string + complementoDx).
    type DraftForm = Partial<Omit<typeof EMPTY_FORM, 'diagnosticos'>> & {
      diagnosticos?: string | Diagnostico[]
      complementoDx?: string
    }
    type DraftPayload = {
      form?: DraftForm; medicamentos?: typeof medicamentos; signosVitales?: SignosVitalesForm
      complementoDx?: string; notaGenerada?: string; modoNota?: 'ia' | 'manual'
    }
    secureStorage.get<DraftPayload>(`nota-draft-${id}`).then(parsed => {
      if (!parsed?.form) return
      // Guard anti-race: si la promesa resolvió DESPUÉS de que el usuario
      // empezó a teclear en cualquiera de los 8 campos, ya tiene una nota viva
      // en esta sesión, o ya eligió vía en el selector, descartar el borrador
      // para no sobrescribir entrada clínica viva.
      const current = formRef.current
      const vacio = Object.values(current).every(v => Array.isArray(v) ? v.length === 0 : !v)
      if (!vacio || notaGeneradaRef.current || modoTocadoRef.current) return
      // Migración inline: drafts viejos guardaban diagnosticos como string y
      // complementoDx como campo aparte. Convertir a Diagnostico[].
      const raw = parsed.form
      const migrated: Partial<typeof EMPTY_FORM> = {}
      for (const [k, v] of Object.entries(raw)) {
        if (k === 'diagnosticos' || k === 'complementoDx') continue
        // @ts-expect-error — copia campo a campo, los tipos no-array son string
        migrated[k] = v
      }
      const rawDx = raw.diagnosticos
      const rawComp = (raw.complementoDx ?? parsed.complementoDx ?? '').trim()
      if (typeof rawDx === 'string') {
        const dxTrim = rawDx.trim()
        migrated.diagnosticos = dxTrim
          ? [{ descripcion: rawComp ? `${dxTrim} (${rawComp})` : dxTrim }]
          : []
      } else if (Array.isArray(rawDx)) {
        migrated.diagnosticos = rawDx
      } else {
        migrated.diagnosticos = []
      }
      // Spread sobre EMPTY_FORM por si un borrador viejo tiene campos faltantes
      // tras un cambio de schema (evita undefined en inputs controlados).
      setForm({ ...EMPTY_FORM, ...migrated })
      if (parsed.medicamentos?.length) setMedicamentos(parsed.medicamentos)
      if (parsed.signosVitales) setSignosVitales(parsed.signosVitales)
      // Duck-typing: los drafts v1 no traen estos campos → no-op.
      if (typeof parsed.notaGenerada === 'string' && parsed.notaGenerada) setNotaGenerada(parsed.notaGenerada)
      if (parsed.modoNota === 'ia' || parsed.modoNota === 'manual') setModoNota(parsed.modoNota)
      setBorradorRestaurado(true)
    }).catch(() => {})
    // Cargar última consulta para contexto
    const supabase2 = createClient()
    supabase2.from('consultas')
      .select('diagnosticos, medicamentos')
      .eq('paciente_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((res: { data: { diagnosticos: { descripcion?: string }[] | null; medicamentos: { nombre: string; dosis: string; frecuencia: string; duracion: string }[] | null } | null }) => {
        const data = res.data
        if (!data) return
        // La lista se conserva además del texto unido: la tarjeta de contexto
        // pinta un renglón por diagnóstico sin partir el texto por comas.
        const dxLista = Array.isArray(data.diagnosticos)
          ? (data.diagnosticos as { descripcion?: string }[]).map(d => d.descripcion?.trim() ?? '').filter(Boolean)
          : []
        const dx = dxLista.join(', ')
        setUltimaConsulta({ diagnosticos: dx, dxLista, medicamentos: data.medicamentos || null })
      }).catch(() => {})
  }, [id])

  // ── Autosave en localStorage ──────────────────────────────────
  useEffect(() => {
    if (notaSaved) return // no guardar borrador si la nota ya fue guardada en DB
    if (autosaveRef.current) clearTimeout(autosaveRef.current)
    autosaveRef.current = setTimeout(() => {
      const tieneDatos = form.motivo_consulta || form.diagnosticos.length > 0 || form.exploracion_fisica || notaGenerada.trim()
      if (!tieneDatos) return
      secureStorage.set(draftKey, { form, medicamentos, signosVitales, notaGenerada, modoNota }).then(() => {
        setUltimoGuardado(new Date())
      })
    }, 1500)
    return () => { if (autosaveRef.current) clearTimeout(autosaveRef.current) }
  }, [form, medicamentos, signosVitales, notaGenerada, modoNota, notaSaved, draftKey])

  // Entrevista: al recibir un set nuevo de preguntas (o limpiarlas), volver al
  // primer bloque. Mantiene la lógica del sub-paso A intacta.
  useEffect(() => { setBloqueActual(0) }, [bloquesEntrevista])

  // ── Helpers de medicamentos ───────────────────────────────────
  function removeMed(i: number) {
    if (medicamentos.length === 1) { setMedicamentos([{ ...MED_VACIA }]); return }
    setMedicamentos(prev => prev.filter((_, idx) => idx !== i))
  }

  function update(field: string, val: string) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  // ── Helpers de IA (compartidos por generarNota y responderEntrevista) ──
  function construirPaciente() {
    const edad = paciente?.fecha_nacimiento
      ? calcularEdad(paciente.fecha_nacimiento).anios : null
    return {
      edad, sexo: paciente?.sexo, peso: paciente?.peso_kg, talla: paciente?.talla_cm,
      antecedentes: [
        paciente?.ant_patologicos, paciente?.ant_quirurgicos,
        paciente?.medicamentos_actuales ? `Medicamentos: ${paciente.medicamentos_actuales}` : null,
        paciente?.alergias ? `Alergias: ${paciente.alergias}` : null,
      ].filter(Boolean).join('. '),
    }
  }

  // R16: mapea el fallo a un mensaje accionable. El status HTTP manda (la API
  // responde siempre {error} en español, así que el heurístico de mensaje no
  // distinguía 401/429/502 y todos caían al genérico). El heurístico queda solo
  // como respaldo del 500, cuyo mensaje viene crudo del SDK de Gemini.
  function mapearErrorIA(e: unknown, status: number | null): string {
    if (status === 401) return 'Tu sesión expiró. Recarga la página e inicia sesión de nuevo.'
    if (status === 429) return 'Alcanzaste el límite de notas con IA por hoy. Intenta más tarde.'
    if (status === 400) return 'La petición no es válida. Revisa el caso e intenta de nuevo.'
    if (status === 502) return 'El servicio de IA falló al generar la nota. Intenta de nuevo.'
    if (status === null) return 'Sin conexión. Verifica tu internet e intenta de nuevo.'
    const msg = (e instanceof Error ? e.message : '').toLowerCase()
    if (msg.includes('timeout') || msg.includes('deadline'))
      return 'La IA tardó demasiado en responder. Intenta de nuevo en unos segundos.'
    return 'No se pudo generar la nota. Intenta de nuevo o escríbela manualmente.'
  }

  // Cablea la nota final ('completa') al form y limpia el estado de entrevista.
  function aplicarNotaCompleta(data: NotaIAResponse) {
    const narrativa = data.nota?.narrativa
    if (typeof narrativa !== 'string' || !narrativa.trim()) {
      throw new Error('La IA no devolvió una nota válida. Intenta de nuevo.')
    }
    setNotaGenerada(narrativa)
    const dx = data.nota?.estructurado?.diagnosticos
    if (Array.isArray(dx) && dx.length > 0) {
      setForm(prev => ({ ...prev, diagnosticos: dx }))
    }
    // REEMPLAZAR siempre al generar (regenerar = nueva versión). Guard lista
    // vacía: conservar [{...MED_VACIA}] para el invariante ≥1 fila de removeMed.
    const medsIA = data.nota?.estructurado?.medicamentos
    setMedicamentos(
      Array.isArray(medsIA) && medsIA.length > 0
        ? medsIA.map((m: MedicamentoIA) => ({ nombre: m.nombre ?? '', dosis: '', frecuencia: '', duracion: '' }))
        : [{ ...MED_VACIA }]
    )
    setBloquesEntrevista([])
    setHistorialEntrevista([])
    setRespuestasEntrevista({})
    // R12: la nota nueva reemplaza a la anterior, así que la edición sucia muere
    // con ella y la revisión arranca siempre en preview.
    setModoEdicion(false)
    setNotaEditada(false)
    // ÚLTIMA línea a propósito: si la narrativa era inválida, el throw de arriba
    // cortó antes y el modal sigue abierto mostrando el error del catch.
    // Muere T1: ya no hay panel inline; el modal muta al estado de revisión.
    setEstadoModal('revision')
  }

  // ── Generar nota con Gemini (turno 1) ─────────────────────────
  async function generarNota() {
    if (!validarParaAbrir()) return
    setGenerando(true); setError('')
    setErrorModal(null); setEstadoModal('generando')
    let httpStatus: number | null = null
    try {
      const res = await fetch('/api/nota-medica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente: construirPaciente(),
          mensaje: form.motivo_consulta,
          historial: [],
        }),
      })
      httpStatus = res.status
      const rawText = await res.text()
      const data = JSON.parse(rawText) as NotaIAResponse & { error?: string }
      if (data.error) throw new Error(data.error)
      if (data.status === 'faltan_datos') {
        // Entrevista turno 1: guardar preguntas e iniciar el historial crudo.
        const bloques = Array.isArray(data.bloques) ? data.bloques : []
        // B1: sin bloques no hay entrevista que mostrar. Antes el modal no abría
        // (open dependía de bloquesEntrevista.length) y el fallo era silencioso;
        // ahora nos quedamos en 'generando' para ofrecer Reintentar.
        if (bloques.length === 0) {
          setErrorModal('La IA no devolvió preguntas válidas. Intenta de nuevo.')
          return
        }
        // Δ2: NO se vacía notaGenerada. Regenerar puede derivar en entrevista; si
        // el médico la cancela, el ancla debe devolverle la nota anterior intacta
        // (§7: cerrar nunca destruye). El único consumidor que dependía del vaciado
        // era el panel inline, que muere en este mismo paso.
        setBloquesEntrevista(bloques)
        setHistorialEntrevista([
          { rol: 'user', texto: form.motivo_consulta },
          { rol: 'model', texto: rawText },
        ])
        setRespuestasEntrevista({})
        setEstadoModal('entrevista')
      } else {
        aplicarNotaCompleta(data)
      }
    } catch (e: unknown) {
      setErrorModal(mapearErrorIA(e, httpStatus))
    } finally {
      setGenerando(false)
    }
  }

  // ── Responder entrevista (turno 2+) ───────────────────────────
  async function responderEntrevista() {
    // Concatena "pregunta: respuesta" en orden de bloques/preguntas; omite sin responder.
    const partes: string[] = []
    for (const bloque of bloquesEntrevista) {
      for (const preg of bloque.preguntas) {
        const resp = respuestasEntrevista[preg.id]?.trim()
        if (resp) partes.push(`${preg.pregunta}: ${resp}`)
      }
    }
    // B2: este guard salta con el modal ABIERTO; en página quedaba tras el backdrop.
    if (partes.length === 0) { setErrorModal('Responde al menos una pregunta antes de enviar.'); return }
    const mensaje = partes.join('\n')
    setGenerando(true); setError('')
    setErrorModal(null)
    let httpStatus: number | null = null
    try {
      const res = await fetch('/api/nota-medica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente: construirPaciente(),   // re-enviar (Opción B): conserva demográficos
          mensaje,
          historial: historialEntrevista,
        }),
      })
      httpStatus = res.status
      const rawText = await res.text()
      const data = JSON.parse(rawText) as NotaIAResponse & { error?: string }
      if (data.error) throw new Error(data.error)
      if (data.status === 'faltan_datos') {
        // La IA pide más: acumular el turno y mostrar las nuevas preguntas.
        const bloques = Array.isArray(data.bloques) ? data.bloques : []
        // B1: conservar la entrevista en curso y ofrecer Enviar como reintento.
        if (bloques.length === 0) {
          setErrorModal('La IA no devolvió preguntas válidas. Intenta de nuevo.')
          return
        }
        // Δ2: ver generarNota — la nota previa sobrevive a un turno de entrevista.
        setHistorialEntrevista(prev => [
          ...prev,
          { rol: 'user', texto: mensaje },
          { rol: 'model', texto: rawText },
        ])
        setBloquesEntrevista(bloques)
        setRespuestasEntrevista({})
      } else {
        aplicarNotaCompleta(data)
      }
    } catch (e: unknown) {
      setErrorModal(mapearErrorIA(e, httpStatus))
    } finally {
      setGenerando(false)
    }
  }

  // Aborta toda la entrevista y cierra el modal. Conserva form.motivo_consulta
  // (el médico vuelve al textarea para editar/regenerar). No-op mientras envía.
  function cancelarEntrevista() {
    if (generando) return
    setBloquesEntrevista([])
    setHistorialEntrevista([])
    setRespuestasEntrevista({})
    setBloqueActual(0)
    setEstadoModal(null)
    setErrorModal(null)
    setConfirmarPisado(false)
  }

  // onClose despachador del ModalShell (X / backdrop / Escape). El guard de
  // guardando va PRIMERO: durante el POST el modal es inerte. En 'confirmacion'
  // X/backdrop/Escape RETROCEDEN a revisión (blueprint §5.1), nunca cierran. El
  // resto delega en cancelarEntrevista() — el cierre a ancla que hacía todo estado
  // hasta 1.3, con sus resets íntegros y el guard de generando incluido.
  function cerrarModalPorEstado() {
    if (guardando) return
    if (estadoModal === 'confirmacion') { setEstadoModal('revision'); return }
    // Éxito: nota ya sellada, nada que proteger — cierre limpio a post-guardado.
    if (estadoModal === 'exito') { setEstadoModal(null); return }
    cancelarEntrevista()
  }

  // ── Previsualizar nota en modo manual ─────────────────────────
  function previewNotaManual() {
    if (!validarManualParaAbrir()) return
    setError('')
    const dxBlock = dxValidos.length === 0
      ? 'Diagnóstico pendiente.'
      : dxValidos.length === 1
        ? (dxValidos[0].codigo_cie10
            ? `${dxValidos[0].codigo_cie10} - ${dxValidos[0].descripcion.trim()}`
            : dxValidos[0].descripcion.trim())
        : dxValidos
            .map((d, i) => `${i + 1}. ${d.codigo_cie10 ? `${d.codigo_cie10} - ` : ''}${d.descripcion.trim()}`)
            .join('\n')

    const partes = [
      `**[SUBJETIVO]:**\n${form.motivo_consulta}`,
      `**[OBJETIVO]:**\n${form.exploracion_fisica || 'Sin exploración física registrada.'}`,
      `**[AUXILIARES DIAGNÓSTICOS]:**\n${form.gabinete_laboratorios || 'Estudios de gabinete y laboratorio pendientes.'}`,
      `**[DIAGNÓSTICO]:**\n${dxBlock}`,
      `**[ANÁLISIS]:**\n${form.analisis || 'Análisis clínico pendiente.'}`,
      `**[PLAN]:**\n${form.plan_tratamiento || 'Plan de tratamiento pendiente.'}`,
    ]
    setNotaGenerada(partes.join('\n\n'))
    // R12: "Actualizar" pisa la nota igual que regenerar → resetea la edición sucia.
    setModoEdicion(false)
    setNotaEditada(false)
    setEstadoModal('revision')
  }

  // Fase 3: si hay AL MENOS un signo vital capturado, fc es obligatoria (>0)
  // y todos los capturados deben caer dentro de los límites fisiológicos duros.
  // El semáforo clínico (vigilar/fuera) NUNCA bloquea; esto sí.
  // Compartida por intentarGuardar y validarParaAbrir. Los mensajes van a la
  // página (setError): ambos llamadores corren con el modal cerrado.
  function validarVitalesDuros(): boolean {
    const svValidar = construirSignosVitalesPayload(signosVitales)
    // R14: sin vitales capturados también hay que limpiar. Antes esta rama no
    // hacía nada y los tiles quedaban en rojo tras vaciar los campos.
    if (!svValidar) { setErroresVitales(new Set()); return true }
    const nuevosErrores = new Set<SignoVitalKey>()
    const fcMissing = !(typeof svValidar.fc === 'number' && svValidar.fc > 0)
    if (fcMissing) nuevosErrores.add('fc')
    for (const key of ['ta_sistolica', 'ta_diastolica', 'fc', 'fr', 'temp', 'spo2'] as SignoVitalKey[]) {
      const val = svValidar[key]
      if (typeof val === 'number' && fueraDeLimitesDuros(key, val)) nuevosErrores.add(key)
    }
    if (nuevosErrores.size > 0) {
      setErroresVitales(nuevosErrores)
      setError(fcMissing
        ? 'Signos vitales: la frecuencia cardíaca (FC) es obligatoria y mayor que 0 si capturas algún signo vital.'
        : 'Signos vitales: hay valores fuera del rango fisiológico posible. Corrígelos para guardar.')
      return false
    }
    setErroresVitales(new Set())
    return true
  }

  // Puerta de entrada al modal del funnel: si falla, los errores se pintan en
  // la página (banner + tiles) y el modal NO llega a abrirse.
  function validarParaAbrir(): boolean {
    if (!form.motivo_consulta.trim()) { setError('Describe el caso antes de generar.'); return false }
    return validarVitalesDuros()
  }

  // Puerta de entrada de la vía manual. NOM-004-SSA3: aquí el médico captura a
  // mano, así que los 4 obligatorios se exigen ANTES de abrir la revisión (en IA
  // viven dentro de la narrativa). intentarGuardar delega en esta misma función,
  // de modo que la validación de entrada y la de salida no pueden divergir.
  function validarManualParaAbrir(): boolean {
    const faltantes: string[] = []
    if (!form.motivo_consulta.trim()) faltantes.push('Motivo de consulta')
    if (!form.exploracion_fisica.trim()) faltantes.push('Exploración física')
    if (form.diagnosticos.length === 0 || !form.diagnosticos.some(d => d.descripcion?.trim())) {
      faltantes.push('Diagnóstico')
    }
    if (!form.plan_tratamiento.trim()) faltantes.push('Plan de tratamiento')
    if (faltantes.length > 0) {
      setError(`Campos obligatorios: ${faltantes.join(', ')}`)
      return false
    }
    return validarVitalesDuros()
  }

  // R8: única vía de apertura de la revisión (ancla + botón sticky de documentos).
  // En manual NO reconstruye la nota: eso pisaría las ediciones a mano (R12). La
  // reconstrucción es explícita, vía "Actualizar" dentro del modal.
  function abrirRevision(): void {
    const ok = modoNota === 'manual' ? validarManualParaAbrir() : validarParaAbrir()
    if (!ok) return
    setError('')
    setEstadoModal('revision')
  }

  // Δ6/R12: regenerar (IA) o actualizar (manual) pisa la nota. Con edición sucia
  // el botón muta primero a confirmación inline; esta función es el "sí".
  function ejecutarPisado(): void {
    setConfirmarPisado(false)
    if (modoNota === 'ia') setEstadoModal('contexto')
    else previewNotaManual()
  }

  // ── Validar y mostrar confirmación antes de guardar ───────────
  function intentarGuardar() {
    if (modoNota === 'manual') {
      // NOM-004-SSA3: los 4 obligatorios + vitales duros viven en el helper, que
      // es el mismo que valida la apertura de la revisión.
      if (!validarManualParaAbrir()) return
    } else {
      // Modo IA: exploración física y plan van DENTRO de la narrativa; el dx puede
      // no venir como bloqueo. Solo validamos lo mínimo: el caso y que haya nota.
      if (!form.motivo_consulta.trim()) { setError('Describe el caso antes de guardar.'); return }
      if (!notaGenerada.trim()) { setError('Genera la nota antes de guardar.'); return }
      if (!validarVitalesDuros()) return
    }
    // Confirmación universal (blueprint §5.1): SIEMPRE muta al estado de
    // confirmación. Murió el flag spinus_skip_confirm_nota y su checkbox.
    setEstadoModal('confirmacion')
  }

  // ── Guardar nota ──────────────────────────────────────────────
  async function guardar() {
    setGuardando(true)

    const medsConDatos = medicamentos.filter(m => m.nombre.trim())
    const svPayload = construirSignosVitalesPayload(signosVitales)

    const payload = {
      paciente_id: id,
      consultorio_id: consultorioActivo?.id,
      // De qué cita salió, si salió de alguna. El servidor la valida y la marca
      // como atendida; que falte o no cuadre nunca impide guardar la nota.
      ...(citaOrigen ? { appointment_id: citaOrigen } : {}),
      motivo_consulta: form.motivo_consulta,
      exploracion_fisica: form.exploracion_fisica,
      diagnosticos: form.diagnosticos
        .filter(d => d.descripcion?.trim())
        .map(d => ({
          ...(d.codigo_cie10 ? { codigo_cie10: d.codigo_cie10 } : {}),
          descripcion: d.descripcion.trim(),
        })),
      plan_tratamiento: form.plan_tratamiento,
      notas_evolucion: notaFinal,
      proxima_cita: form.proxima_cita || null,
      medicamentos: medsConDatos.length ? medsConDatos : null,
      nota_origen: modoNota,
      ...(svPayload ? { signos_vitales: svPayload } : {}),
    }

    try {
      const res = await fetch('/api/consultas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Error desconocido' }))

        // Error DENTRO del modal (estado 'confirmacion'): el banner de página
        // quedaría tras el backdrop. Reintento natural con [Guardar nota].
        setErrorModal(data.message || data.error || 'No se pudo guardar la nota.')
        setGuardando(false)
        return
      }

      /* El servidor acaba de pasar la cita a «Atendida» y la agenda, desmontada,
         la tiene en su caché como estaba: sin esto, al volver la pintaría aún
         «Agendada» (I1, punto 4). Su canal de tiempo real sigue vivo un rato y
         traería el cambio, pero es una escritura de ESTA pestaña: no se espera
         al eco para invalidar. Como `ligarCita.ts`. */
      if (citaOrigen) vaciarCacheCitas()
      secureStorage.remove(draftKey)
      setNotaSaved(true)
      setEstadoModal('exito')
      setErrorModal(null)
      setDocInline(null)
    } catch {
      setErrorModal("Error de conexion. Verifica tu internet e intenta de nuevo.")
    }

    setGuardando(false)
  }

  // ── Imprimir nota (pipeline react-pdf, patrón B′) ─────────────
  /**
   * El botón "Imprimir nota" del Estado Éxito no abre el PDF: se convierte en
   * el enlace que lo abre.
   *
   * `generarPdf` lo abría él mismo al terminar, después del refresco del perfil
   * médico, el fetch del logo, los imports dinámicos y el render. Para entonces
   * la activación transitoria del gesto ya estaba consumida y Safari bloqueaba
   * la apertura — en silencio en iOS y en la PWA. En una nota duele más que en
   * un documento: la impresión no se persiste (el generarPdf de abajo va sin
   * pacienteId a propósito), así que si no se abre no queda en ninguna lista
   * donde ir a buscarla.
   *
   * Con el href ya resuelto, entre el toque y la navegación no hay asincronía.
   * Mismo criterio que ModalDocumentoGenerado, duplicado a propósito.
   *
   * La nota queda sellada al llegar al Éxito (autosave cortado por notaSaved),
   * así que el PDF no se invalida mientras el modal siga abierto y el enlace no
   * necesita descartarse.
   */
  const notaPdfUrl = useMemo(
    () => (notaPdfBlob ? URL.createObjectURL(notaPdfBlob) : null),
    [notaPdfBlob],
  )

  useEffect(() => {
    if (!notaPdfUrl) return
    return () => {
      // 60s de gracia: si el médico ya lo abrió, el visor tiene su copia
      // interna y revocar es seguro.
      setTimeout(() => URL.revokeObjectURL(notaPdfUrl), 60000)
    }
  }, [notaPdfUrl])

  // Lo consume el botón "Imprimir nota" del Estado Éxito. Conservar el handler
  // evita reponer las 8 fuentes de estado que lee (R11).
  async function imprimir() {
    if (!paciente) return
    setErrorModal(null)
    setImprimiendo(true)
    try {
      // Refresco best-effort: la firma es un signed URL con TTL 1h que pudo
      // expirar si la página lleva rato abierta. Fallo (offline/error) → cae al
      // medicoInfo del estado. La rama 'formulario' exige médico vivo no-null.
      let medicoVivo: MedicoInfo | null = medicoInfo
      try {
        const { medico } = await fetch('/api/me/perfil-medico').then(r => r.json())
        if (medico) medicoVivo = medico
      } catch { /* sin red: conservar medicoInfo del estado */ }
      if (!medicoVivo) { setErrorModal('No se pudo cargar el perfil médico.'); return }

      const notaRenderData = buildNotaRenderData({
        origen: 'formulario',
        paciente,
        medicoVivo,
        consultorio: consultorioActivo,
        fecha: new Date().toISOString(),
        notasEvolucion: notaFinal,
        diagnosticos: form.diagnosticos.filter(d => d.descripcion?.trim()),
        motivoConsulta: form.motivo_consulta,
        signosVitales: construirSignosVitalesPayload(signosVitales) ?? null,
        proximaCita: form.proxima_cita || null,
        notaOrigen: modoNota,
      })

      // Sin pacienteId: imprimir NO persiste en Storage (solo entrega el PDF).
      const { blob } = await generarPdf({
        tipo: 'nota_evolucion',
        medico: null,
        data: { ...notaRenderData },
        logoUrl: notaRenderData.medico.logoUrl,
        filename: generateDocFileName(notaRenderData.paciente.nombreCompleto, 'Nota-Evolucion'),
        entregar: false,
      })

      setNotaPdfBlob(blob)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[NuevaNota] imprimir falló:', err)
      setErrorModal('No se pudo generar el PDF. Intenta de nuevo.')
    } finally {
      setImprimiendo(false)
    }
  }

  // ── Medicamentos → formato RecetaForm ─────────────────────────
  // Paso 1.5: precarga solo-nombre. La posología se captura en la receta (su
  // destino real, D4). Mueren la "dosis fantasma" y la concatenación frec · dur.
  const medicamentosParaReceta: MedicamentoConVia[] = medicamentos
    .filter(m => m.nombre.trim())
    .map(m => ({
      nombre_comercial: m.nombre,
      via_administracion: 'Oral',
      presentacion: '',
      principio_activo: '',
      indicacion: '',
      dosis: '',
    }))

  const nombrePaciente = paciente ? `${paciente.nombre} ${paciente.apellidos}` : ''
  // Ya redactada («45 años»), que es como la escribe el médico en el
  // consentimiento. `construirPaciente` usa la misma fuente en años enteros.
  const edadInicial = paciente?.fecha_nacimiento
    ? calcularEdad(paciente.fecha_nacimiento).textoElegante
    : ''

  // Entrevista: bloque en curso + validación de completitud (navegación del modal).
  const bloqueEnCurso = bloquesEntrevista[bloqueActual]
  const esUltimoBloque = bloqueActual === bloquesEntrevista.length - 1
  const faltanEnBloque = bloqueEnCurso
    ? bloqueEnCurso.preguntas.filter(p => !(respuestasEntrevista[p.id] ?? '').trim()).length
    : 0
  const bloqueCompleto = !!bloqueEnCurso && faltanEnBloque === 0

  // Error de generación y panel de resultado: se renderizan en distinta posición
  // según el modo. En IA van pegados bajo el botón generar; en manual van al fondo.
  const bloqueError = error ? (
    <p role="alert" className="sp-nota-entra flex items-start gap-1.5 text-[14px] font-semibold leading-5 text-[var(--mal-tinta)]">
      <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 flex-none" />
      <span>{error}</span>
    </p>
  ) : null

  // Ancla de la Card Captura: hay nota, el modal está cerrado y aún no se guardó.
  // Sustituye al CTA propio de cada vía (montaje con ?? más abajo).
  // TERNARIO CON null A PROPÓSITO: con `&&` el valor falso sería `false`, que NO es
  // nullish, así que el `??` del montaje no dispararía y la card quedaría sin CTA.
  const anclaNota = (notaGenerada && estadoModal === null && !notaSaved) ? (
    /* La banda verde muere: el título vive dentro del padding uniforme de la
       card. El verde del texto se pierde por regla del sistema (.sp-title-card
       es tinta); la señal de "listo" queda en el ✓ y en el borde/sombra de
       --anchor. */
    <div className="k-tarjeta space-y-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ok-fondo text-ok-tinta" aria-hidden="true"><Check size={20} strokeWidth={2.6} /></span>
        <h2 className="k-t-tarjeta flex-1">Nota lista</h2>
        {modoNota === 'ia' ? (
          <span className="k-etq k-etq-tonal">
            <Sparkles />
            Nota IA
          </span>
        ) : (
          <span className="k-etq k-etq-tonal">
            <PenLine />
            Nota manual
          </span>
        )}
      </div>
      {/* Dictado colapsado, solo lectura */}
      <button type="button" onClick={() => setDictadoExpandido(v => !v)} className="group w-full text-left">
        <p className="k-t-rotulo mb-1">
          {modoNota === 'ia' ? 'Tu dictado' : 'Motivo de consulta'}
        </p>
        <p lang="es" className={`whitespace-pre-wrap text-[15px] leading-[22px] text-tinta2 [hyphens:auto] ${dictadoExpandido ? '' : 'line-clamp-3'}`}>
          {form.motivo_consulta}
        </p>
        <span className="mt-1 inline-block text-[14px] font-semibold text-[var(--enlace)] group-hover:underline">
          {dictadoExpandido ? 'Ocultar' : 'Ver completo'}
        </span>
      </button>

      {confirmarDescarte ? (
        <div role="alert" className="sp-nota-entra flex flex-col items-start gap-2 rounded-[var(--r-control)] bg-[var(--aviso-fondo)] p-3 text-[14px] leading-5 text-[var(--aviso-tinta)]">
          <p>
            Descartarás la nota generada. Tu dictado y los datos capturados se conservan.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setNotaGenerada('')
                setNotaEditada(false)
                setModoEdicion(false)
                setConfirmarDescarte(false)
              }}
              className="k-b k-b-capa k-b-mal">
              Sí, empezar de nuevo
            </button>
            <button onClick={() => setConfirmarDescarte(false)} className="k-b k-b-capa k-b-quieto">
              Conservar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1 esc:flex-row-reverse esc:items-center esc:justify-start esc:gap-4">
          <button onClick={abrirRevision} className="k-b k-b-prim h-12 w-full text-[17px] esc:h-10 esc:w-auto esc:text-[15px]">
            Revisar y guardar
          </button>
          <button onClick={() => setConfirmarDescarte(true)} className="k-b k-b-texto self-center">
            <RotateCcw size={16} aria-hidden="true" /> Empezar de nuevo
          </button>
        </div>
      )}
    </div>
  ) : null

  // ── Render ────────────────────────────────────────────────────
  // Aviso suave (no bloquea): la nota se guardará sin signos vitales.
  const sinVitalesCapturados = construirSignosVitalesPayload(signosVitales) === undefined
  // Preview REAL del estado de revisión: réplica exacta de notaFinal de guardar()
  // y de notasEvolucion de imprimir(). Lo que se ve es lo que se sella.
  const notaFinal = notaGenerada
    + (form.pronostico.trim() ? `\n\n**[PRONÓSTICO]:**\n${form.pronostico.trim()}` : '')
  // Diagnósticos en lectura dentro de la revisión (R7): el estructurado es el que
  // alimenta payload, receta y los 7 formularios de documentos. Optional chaining
  // por consistencia con el resto del archivo: un dx malformado no debe reventar
  // el render dentro del modal.
  const dxValidos = form.diagnosticos.filter(d => d.descripcion?.trim())
  const meta = metaDelModal(estadoModal)
  return (
    <div className="max-w-7xl mx-auto">

      {/* Modal del funnel de nota — máquina de estados (Paso 1.1). Vive al
          nivel raíz: ya no lo desmonta el toggle IA/manual.
          Paso 3.2.C1: el Sparkles del header va sin size ni clase de color
          (.sp-icobox fija 22px y el color de tinta) y ya no se pasa iconBg
          — bajo spinusGeometry esa prop es inerte. */}
      <ModalShell
        open={estadoModal !== null}
        onClose={cerrarModalPorEstado}
        fullscreenMobile
        spinusGeometry={meta.geometry}
        hideClose={(generando && !errorModal) || estadoModal === 'confirmacion'}
        title={meta.title}
        subtitle={meta.subtitle}
        /* Sin icono en la cabecera: las capas del catálogo titulan con texto. La
           confirmación es la ALERTA del catálogo (capas-a, vista 1): candado en
           círculo, título, mensaje y «Revisar» | «Guardar nota» parejos. */
        variante={estadoModal === 'confirmacion' ? 'alerta' : undefined}
        icon={estadoModal === 'confirmacion' ? <Lock /> : undefined}
        headerRight={estadoModal === 'revision' ? (
          /* max-md:hidden: con el título a 19px y el badge a 12px, en 375px el
             título truncaría. El indicador es redundante en móvil. */
          modoNota === 'ia' ? (
            <span className="k-etq k-etq-tonal max-md:hidden">
              <Sparkles />
              Nota IA
            </span>
          ) : (
            <span className="k-etq k-etq-tonal max-md:hidden">
              <PenLine />
              Nota manual
            </span>
          )
        ) : undefined}
        footer={estadoModal === 'entrevista' ? (
          <div className="flex items-center gap-2 px-6 py-4 ext:px-4">
            {/* max-md:hidden: con las métricas de .sp-btn los 3 botones suman
                397px en el último bloque contra 343px útiles. La X del header
                ejecuta cancelarEntrevista() — el mismo handler — así que en
                móvil no se pierde la salida. */}
            <button onClick={cancelarEntrevista} disabled={generando}
              className="k-b k-b-capa k-b-texto max-md:hidden">
              Cancelar
            </button>
            <div className="flex-1" />
            <button onClick={() => setBloqueActual(i => i - 1)} disabled={bloqueActual === 0 || generando}
              className="k-b k-b-capa k-b-quieto">
              Anterior
            </button>
            {esUltimoBloque ? (
              <button onClick={responderEntrevista} disabled={!bloqueCompleto || generando}
                className="k-b k-b-capa k-b-prim disabled:bg-sup2 disabled:text-tinta2 disabled:opacity-100">
                {generando ? <><Loader2 size={17} className="animate-spin" aria-hidden="true" /> Enviando...</> : 'Enviar respuestas'}
              </button>
            ) : (
              <button onClick={() => setBloqueActual(i => i + 1)} disabled={!bloqueCompleto}
                className="k-b k-b-capa k-b-prim disabled:bg-sup2 disabled:text-tinta2 disabled:opacity-100">
                Siguiente
              </button>
            )}
          </div>
        ) : estadoModal === 'revision' ? (
          <div className="flex items-center gap-2 px-6 py-4 ext:px-4">
            <button onClick={cancelarEntrevista} className="k-b k-b-capa k-b-texto">
              Cerrar
            </button>
            <div className="flex-1" />
            {/* Confirmación universal (1.4): el modal NO se cierra; intentarGuardar
                muta a 'confirmacion'. Murió T2 (el apilado Portal-sobre-modal). */}
            <button
              onClick={() => { setErrorModal(null); intentarGuardar() }}
              disabled={guardando || !consultorioActivo}
              className="k-b k-b-capa k-b-prim">
              {guardando ? <><Loader2 size={17} className="animate-spin" aria-hidden="true" /> Guardando...</> : 'Guardar nota'}
            </button>
          </div>
        ) : estadoModal === 'contexto' ? (
          <div className="flex items-center gap-2 px-6 py-4 ext:px-4">
            <button onClick={() => { setEstadoModal('revision'); setErrorModal(null) }}
              className="k-b k-b-capa k-b-texto">
              Cancelar
            </button>
            <div className="flex-1" />
            <button onClick={generarNota} disabled={!form.motivo_consulta.trim()}
              className="k-b k-b-capa k-b-prim">
              Regenerar nota
            </button>
          </div>
        ) : estadoModal === 'confirmacion' ? (
          /* «Revisar» (CALMA §15) y «Guardar nota» como dos botones parejos de
             la alerta: secundario a la izquierda, principal a la derecha. */
          <>
            <button onClick={() => setEstadoModal('revision')} disabled={guardando}
              className="k-b k-b-capa k-b-quieto">
              Revisar
            </button>
            <button onClick={guardar} disabled={guardando} data-principal className="k-b k-b-capa k-b-prim">
              {guardando ? <><Loader2 size={17} className="animate-spin" aria-hidden="true" /> Guardando...</> : 'Guardar nota'}
            </button>
          </>
        ) : estadoModal === 'exito' ? (
          <div className="space-y-2 px-6 pb-6 pt-1 ext:px-4">
            {/* Primario único: la recompensa es la receta (blueprint §5.2). */}
            <button
              onClick={() => { setEstadoModal(null); setDocInline('receta') }}
              className="k-b k-b-capa k-b-prim w-full">
              <Pill size={18} aria-hidden="true" /> Generar receta
              {medicamentosParaReceta.length > 0 && (
                <span className="font-normal opacity-80">
                  · {medicamentosParaReceta.length} medicamento{medicamentosParaReceta.length === 1 ? '' : 's'}
                </span>
              )}
            </button>
            {/* Secundarios parejos en rejilla 2×2 (una columna en teléfono). */}
            <div className="sp-grid-actions">
              <button
                onClick={() => { setEstadoModal(null); setTimeout(() => document.querySelector('[data-onboard="panel-documentos"]')?.scrollIntoView({ behavior: 'smooth' }), 0) }}
                className="k-b k-b-capa k-b-quieto">
                <FileText size={18} aria-hidden="true" /> Otros documentos
              </button>
              {notaPdfUrl ? (
                <a href={notaPdfUrl} target="_blank" rel="noopener"
                  className="k-b k-b-capa k-b-quieto">
                  <Eye size={18} aria-hidden="true" /> Abrir PDF
                </a>
              ) : (
                <button onClick={imprimir} disabled={imprimiendo}
                  className="k-b k-b-capa k-b-quieto">
                  {imprimiendo ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Imprimiendo...</> : <><Printer size={18} aria-hidden="true" /> Imprimir nota</>}
                </button>
              )}
              <Link href={`/expediente/${id}`} className="k-b k-b-capa k-b-quieto">
                <FolderOpen size={18} aria-hidden="true" /> Ver expediente
              </Link>
              <button onClick={() => setEstadoModal(null)} className="k-b k-b-capa k-b-texto">
                Cerrar
              </button>
            </div>
          </div>
        ) : undefined}
      >
        {/* Wrapper de remount por estado (paso 3.1): key fuerza el re-montaje del
            contenido en cada transición; el ModalShell (backdrop) nunca se
            desmonta. overflow-x-hidden contiene el slide horizontal de ±60px. */}
        <div key={estadoModal} className="sp-nota-entra overflow-x-hidden">
        {estadoModal === 'generando' && (errorModal ? (
          /* Error de la IA con la alerta del catálogo (capas-a, vista 1): icono
             en círculo, mensaje justificado y dos botones parejos. */
          <div role="alert" className="k-al">
            <span className="k-al-i k-al-i-destruir" aria-hidden="true"><AlertTriangle /></span>
            <p lang="es" className="k-al-t">{errorModal}</p>
            <div className="k-al-b">
              <button onClick={cancelarEntrevista} className="k-b k-b-capa k-b-quieto">
                Cerrar
              </button>
              <button onClick={generarNota} className="k-b k-b-capa k-b-prim">
                Reintentar
              </button>
            </div>
          </div>
        ) : (
          /* Espera quieta (CALMA): sólo la lista de pasos, sin anillo grande ni
             puntos que laten; el aro del paso en curso basta como señal. */
          <div className="px-6 pb-6 pt-2">
            <PasosGenerando />
          </div>
        ))}
        {estadoModal === 'entrevista' && (
          <>
          <div className="space-y-5 px-6 pb-5 pt-1 ext:px-4">
            {/* Progreso: «Bloque n de m» y un segmento por bloque (`.nn-segs`). */}
            <div className="space-y-2">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-[18px]">
                <span className="font-semibold text-enlace">Bloque {bloqueActual + 1} de {bloquesEntrevista.length}</span>
                {!bloqueCompleto && faltanEnBloque > 0 && (
                  <span className="k-etq k-etq-aviso">Faltan {faltanEnBloque} por responder</span>
                )}
              </p>
              <div className="nn-segs" aria-hidden="true">
                {bloquesEntrevista.map((_, i) => (
                  <span key={i} data-hecho={i <= bloqueActual ? '' : undefined} />
                ))}
              </div>
            </div>

            {/* Preguntas del bloque actual: cada una en su bloque, las opciones
                como chips (la elegida, tonal con palomita) y el campo libre
                debajo, como vía secundaria. */}
            {bloqueEnCurso && (
              <div className="space-y-3">
                <h3 className="k-t-tarjeta">{bloqueEnCurso.titulo}</h3>
                {bloqueEnCurso.preguntas.map((preg, n) => {
                  const respondida = !!(respuestasEntrevista[preg.id] ?? '').trim()
                  return (
                  <div key={preg.id} className="space-y-3 rounded-[var(--r-control)] bg-fondo p-4 ext:p-3">
                    <p className="flex items-start gap-2.5 text-[16px] font-semibold leading-[22px] text-tinta">
                      <span aria-hidden="true" className={`k-num mt-px inline-flex size-[22px] flex-none items-center justify-center rounded-full text-[12px] font-bold ${respondida ? 'bg-ok-fondo text-ok-tinta' : 'bg-tonal text-tonal-tinta'}`}>
                        {respondida ? <Check size={13} strokeWidth={3} /> : n + 1}
                      </span>
                      <span className="min-w-0 flex-1">{preg.pregunta}</span>
                    </p>
                    {preg.opciones.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {preg.opciones.map(op => {
                          const elegida = respuestasEntrevista[preg.id] === op
                          return (
                            <button key={op} type="button" aria-pressed={elegida}
                              onClick={() => setRespuestasEntrevista(prev => ({ ...prev, [preg.id]: op }))}
                              className="nn-opcion">
                              {elegida && <Check aria-hidden="true" />}
                              {op}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    <input type="text"
                      value={respuestasEntrevista[preg.id] ?? ''}
                      onChange={e => setRespuestasEntrevista(prev => ({ ...prev, [preg.id]: e.target.value }))}
                      placeholder="Escribe tu respuesta..."
                      aria-label={preg.pregunta}
                      className="k-campo h-11 bg-sup text-[16px] ih:h-10 ih:text-[15px] esc:h-10 esc:text-[15px]" />
                  </div>
                  )
                })}
              </div>
            )}
          </div>
            {errorModal && (
              <p role="alert" className="mx-6 mb-5 text-[14px] font-semibold leading-5 text-[var(--mal-tinta)]">
                {errorModal}
              </p>
            )}
          </>
        )}
        {estadoModal === 'revision' && (
          <div className="space-y-5 px-6 pb-6 pt-1 ext:px-4">
            {/* Cambios sin guardar — encima del cuerpo, no junto al botón: la
                advertencia es sobre el estado de la nota, no sobre la acción.
                Se calla mientras el swap de confirmación (R12) está abierto,
                que ya dice lo mismo y con más precisión. */}
            {notaEditada && !confirmarPisado && (
              <p className="flex items-center gap-1.5 text-[14px] font-semibold leading-5 text-[var(--aviso-tinta)]">
                <AlertTriangle size={16} aria-hidden="true" className="flex-none" />
                Tienes cambios sin guardar. Regenerar con IA los perderá.
              </p>
            )}
            {/* ── La nota ── */}
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="min-w-[14rem] flex-1 text-[13px] leading-[18px] text-tinta2">
                  {modoEdicion ? 'Editando texto' : 'Vista previa — haz clic en Editar para modificar'}
                </p>
                <div className="flex flex-none items-center gap-3">
                  <button onClick={() => setModoEdicion(!modoEdicion)}
                    className="k-b k-b-texto">
                    {modoEdicion ? <><Eye size={15} /> Vista previa</> : <><Pencil size={15} /> Editar</>}
                  </button>
                  <button
                    onClick={() => { if (notaEditada) { setConfirmarPisado(true); return } ejecutarPisado() }}
                    disabled={generando || !form.motivo_consulta.trim()}
                    className="k-b k-b-texto">
                    <RotateCcw size={15} /> {modoNota === 'ia' ? 'Regenerar' : 'Actualizar'}
                  </button>
                </div>
              </div>

              {/* R12: la confirmación solo advierte; nada se pisa hasta confirmar */}
              {confirmarPisado && (
                <div role="alert" className="mb-3 flex flex-col items-start gap-2 rounded-[var(--r-control)] bg-[var(--aviso-fondo)] p-3 text-[14px] leading-5 text-[var(--aviso-tinta)]">
                  <p className="font-semibold">Perderás tus cambios — ¿Continuar?</p>
                  <div className="flex gap-2">
                    {/* C0 no expone botón de advertencia; el color va inline
                        sobre tokens warn, mismo patrón que el icobox de peligro. */}
                    <button onClick={ejecutarPisado}
                      className="k-b k-b-capa k-b-prim">
                      {modoNota === 'ia' ? 'Sí, regenerar' : 'Sí, actualizar'}
                    </button>
                    <button onClick={() => setConfirmarPisado(false)} className="k-b k-b-capa k-b-quieto">
                      Conservar
                    </button>
                  </div>
                </div>
              )}

              {modoEdicion ? (
                /* .sp-editzone gana a .sp-textarea (va después, misma
                   especificidad) en borde, radio, fondo, padding y halo;
                   sobreviven width/box-sizing/resize. font-mono es deliberado. */
                <textarea
                  value={notaGenerada}
                  onChange={e => { setNotaGenerada(e.target.value); setNotaEditada(true) }}
                  rows={16}
                  className="sp-textarea sp-editzone w-full" />
              ) : (
                <div lang="es" className="prose prose-sm max-w-none prose-headings:text-[13px] prose-headings:font-bold prose-headings:uppercase prose-headings:tracking-[.4px] prose-headings:text-enlace prose-headings:mt-5 prose-headings:mb-1 prose-strong:text-tinta prose-strong:font-semibold prose-p:text-tinta prose-p:my-1 prose-p:text-[16px] prose-p:leading-[26px] prose-p:[hyphens:auto] [&>:first-child]:mt-0 [&>p:first-child>span:first-child]:mt-0 prose-p:[text-align:justify] prose-ul:my-1 prose-li:my-0.5 prose-li:text-tinta">
                  <ReactMarkdown components={{ strong: NegritaNota }}>{notaFinal}</ReactMarkdown>
                </div>
              )}
            </div>

            {/* ── Medicamentos detectados (solo IA) ── */}
            {modoNota === 'ia' && medicamentos.some(m => m.nombre.trim()) && (
              <div className="border-t border-[var(--linea)] pt-4">
                <p className="mb-2 text-[14px] leading-5 text-tinta2">
                  Detecté estos medicamentos (precargarán tu receta):
                </p>
                <div className="flex flex-wrap gap-2">
                  {/* Índice del array REAL: puede haber filas vacías intercaladas
                      (la IA puede devolver un nombre nulo). */}
                  {medicamentos.map((m, i) => m.nombre.trim() ? (
                    /* cursor-auto: el chip NO es clicable, solo su ✕ lo es. */
                    <span key={i} className="sp-chip sp-chip--removable cursor-auto">
                      {m.nombre.trim()}
                      {/* .sp-chip__remove YA resuelve los 44px táctiles con
                          margen negativo + content-box: nada de after:-inset-2,
                          acumularlos daría 60px y solaparía chips vecinos. */}
                      <button type="button" onClick={() => removeMed(i)}
                        aria-label={`Quitar ${m.nombre.trim()}`}
                        className="sp-chip__remove">
                        <X />
                      </button>
                    </span>
                  ) : null)}
                </div>
              </div>
            )}

            {/* ── Diagnósticos (lectura, ambos modos) ── */}
            <div className="border-t border-[var(--linea)] pt-4">
              <h3 className="k-t-rotulo mb-2">Diagnósticos</h3>
              {dxValidos.length > 0 ? (
                <ul className="space-y-2">
                  {dxValidos.map((d, i) => (
                    <li key={i} className="flex items-start gap-3 rounded-[var(--r-control)] bg-fondo px-3.5 py-3 text-[16px] font-semibold leading-[22px] text-tinta">
                      <span className="min-w-0 flex-1">{d.descripcion.trim()}</span>
                      {d.codigo_cie10 && <span className="k-etq k-etq-tonal k-num">{d.codigo_cie10}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                /* N1: solo alcanzable en IA (manual valida ≥1 dx antes de abrir). Se MUESTRA
                   en vez de ocultarse: la invisibilidad del dx fue justo R7. */
                <p className="text-[14px] font-semibold leading-5 text-[var(--aviso-tinta)]">
                  Sin diagnóstico estructurado — la nota se guardará sin código CIE-10.
                </p>
              )}
              {modoNota === 'ia' && (
                <p className="mt-2 text-[13px] leading-[18px] text-tinta2">
                  ¿Algo incorrecto? Regenera la nota con más contexto.
                </p>
              )}
            </div>

            {/* ── Seguimiento ── */}
            <div className="border-t border-[var(--linea)] pt-4">
              <h3 className="k-t-rotulo mb-2">Seguimiento</h3>
              {modoEdicion ? (
                <div className="space-y-3">
                  <div>
                    {/* Convención M8: la opcionalidad se señala por AUSENCIA de
                        asterisco, no con el sufijo "(opcional)". */}
                    <label htmlFor="nn-pronostico" className="k-etiqueta mb-1">Pronóstico</label>
                    <input id="nn-pronostico" type="text" value={form.pronostico} onChange={e => update('pronostico', e.target.value)}
                      placeholder="Ej: Favorable a mediano plazo con tratamiento conservador..."
                      className="k-campo" />
                  </div>
                  <div>
                    <label htmlFor="nn-proxima" className="k-etiqueta mb-1">Próxima cita</label>
                    <input id="nn-proxima" type="text" value={form.proxima_cita} onChange={e => update('proxima_cita', e.target.value)}
                      placeholder="Ej: En 4 semanas, 15 de abril 2026..."
                      className="k-campo" />
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="text-[14px] leading-5 text-tinta">
                      <span className="text-tinta2">Pronóstico: </span>
                      <span className="break-words">{form.pronostico.trim() || '—'}</span>
                    </p>
                    <p className="text-[14px] leading-5 text-tinta">
                      <span className="text-tinta2">Próxima cita: </span>
                      <span className="break-words">{form.proxima_cita.trim() || '—'}</span>
                    </p>
                  </div>
                  <button onClick={() => setModoEdicion(true)}
                    className="k-b k-b-texto flex-none">
                    <Pencil size={15} /> Editar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {estadoModal === 'contexto' && (
          <div className="space-y-3 px-6 pb-6 pt-1 ext:px-4">
            <p className="text-[14px] leading-5 text-tinta2">
              Corrige o amplía el contexto; la nota se generará de nuevo.
            </p>
            {/* resize-y se cae: .sp-textarea ya trae resize: vertical. */}
            <textarea
              value={form.motivo_consulta}
              onChange={e => update('motivo_consulta', e.target.value)}
              rows={10}
              aria-label="Contexto de la nota"
              lang="es"
              className="k-campo text-[16px] leading-6 [hyphens:auto] [text-align:justify]" />
            <p className="text-[13px] leading-[18px] text-tinta2">
              Tu nota actual se conserva hasta que la nueva esté lista.
            </p>
          </div>
        )}
        {estadoModal === 'confirmacion' && (
          <div className="space-y-2">
            <p>
              Una vez guardada, <strong>no podrá modificarse</strong> por motivos de seguridad y cumplimiento normativo.
              Si necesitas hacer correcciones después, podrás agregar una nota aclaratoria (addendum).
            </p>
            {sinVitalesCapturados && (
              <p className="flex items-center justify-center gap-1.5 font-semibold text-[var(--aviso-tinta)] [text-align-last:auto]">
                <AlertTriangle size={16} aria-hidden="true" className="flex-none" />
                No capturaste signos vitales en esta nota.
              </p>
            )}
            {errorModal && (
              <p role="alert" className="font-semibold text-[var(--mal-tinta)]">
                {errorModal}
              </p>
            )}
          </div>
        )}
        {estadoModal === 'exito' && (
          /* «Nota guardada» con la pieza de la alerta del catálogo: palomita en
             círculo tonal que entra con el resorte (`.sp-nota-entra`), sin la
             medalla que estallaba ni el trazo dibujado. */
          <div className="k-al pt-2">
            <span className="k-al-i !bg-ok-fondo !text-ok-tinta" aria-hidden="true"><Check strokeWidth={2.6} /></span>
            <h3 className="k-al-tit">Nota guardada</h3>
            <p className="k-al-t">Quedó sellada en el expediente.</p>
            {errorModal && (
              <p role="alert" className="k-al-t font-semibold text-[var(--mal-tinta)]">
                {errorModal}
              </p>
            )}
          </div>
        )}
        </div>
      </ModalShell>

      {/* ── Cabecera (rediseño B8, maqueta `final-nota`) ──────────────────
          Regreso «‹ <paciente>» (CALMA §23.8) en lugar de las migas de pan
          (era el único uso de `Breadcrumbs`); título «Nueva nota» (§20);
          debajo, edad, «Atendiendo en» y la alergia como etiqueta (§3). */}
      <header lang="es" className="mb-5">
        <Link href={`/expediente/${id}`} className="k-b k-b-texto -ml-1 h-[var(--k-toque)] max-w-full text-[13px]">
          <ChevronLeft size={16} aria-hidden="true" />
          <span className="truncate">{paciente ? `${paciente.nombre} ${paciente.apellidos}` : 'Expediente'}</span>
        </Link>
        <h1 className="k-t-pantalla mt-1">Nueva nota</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="k-t-sec">
            {paciente?.fecha_nacimiento ? `${calcularEdad(paciente.fecha_nacimiento).textoElegante} · ` : ''}
            {consultorioActivo
              ? <>Atendiendo en: <span className="font-semibold text-tinta">{consultorioActivo.nombre_corto || consultorioActivo.nombre}</span></>
              : null}
          </p>
          {paciente?.alergias?.trim() && (
            <span className="k-etq k-etq-mal h-auto min-h-6 max-w-full whitespace-normal py-0.5">
              <AlertTriangle aria-hidden="true" />
              Alergias: {paciente.alergias.trim()}
            </span>
          )}
        </div>
      </header>

      {/* ── Grid de dos columnas · una sola columna en Cierre ──
          Con la nota guardada (blueprint §5.3) la página deja de ser de captura:
          la rejilla colapsa y los documentos pasan a protagonista a ancho completo.
          Ese ancho completo es ahora el del selector y el del formulario, que
          viven DENTRO de este contenedor: el overlay portalado murió en 5.1 y
          con él el panel de 720px que estrechaba los formularios en iPad. */}
      <div className={notaSaved
        ? 'space-y-[var(--sp-gap-block)]'
        : 'lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start space-y-5 lg:space-y-0'}>

        {/* ════════════════════════════════
            COLUMNA IZQUIERDA (3/5) — solo en Captura
            En Cierre desaparece entera: la Card Captura ya estaba apagada, el
            ancla no puede existir (su condición incluye !notaSaved) y el bloque
            de error es inalcanzable (abrirRevision hace setError('') y es la
            ÚNICA vía de apertura de la revisión, R8). Lo único vivo era la card
            de vitales y el banner de borrador, que no tiene sentido sobre una
            nota ya sellada.
        ════════════════════════════════ */}
        {/* --sp-gap-block (18px). NO existe en la escala de Tailwind (20px/24px):
            la arbitraria es intencional, no "corregir" a space-y-5. */}
        {!notaSaved && (
        <div className="lg:col-span-3 space-y-[var(--sp-gap-block)]">

          {/* Banner borrador restaurado */}
          {borradorRestaurado && (
            <div role="status" className="sp-nota-entra flex items-center gap-2 rounded-[var(--r-control)] bg-[var(--aviso-fondo)] py-1 pl-3 pr-1 text-[14px] leading-5 text-[var(--aviso-tinta)]">
              <RotateCcw size={16} aria-hidden="true" className="flex-none" />
              <p className="flex-1">Borrador restaurado — continúa donde lo dejaste</p>
              <button
                onClick={() => {
                  setForm({ ...EMPTY_FORM })
                  setMedicamentos([{ ...MED_VACIA }])
                  setSignosVitales({})
                  setErroresVitales(new Set())
                  // modoNota NO se resetea: es elección de vía, no contenido del borrador.
                  setNotaGenerada('')
                  secureStorage.remove(draftKey)
                  setBorradorRestaurado(false)
                }}
                className="k-b k-b-texto"
              >
                Descartar
              </button>
            </div>
          )}

          {/* Tarjeta de captura (maqueta `final-nota`, vistas 1 y 37): arriba la
              fila plegada de signos vitales, en ambos modos; debajo, el dictado
              sin caja (IA) o los campos SOAP (manual); al pie, «Borrador
              guardado». El título y la ayuda siguen para el lector de pantalla:
              la maqueta los quita de la vista, no de la página. */}
          {/* Ajuste 2: los signos vitales, en su propia tarjeta encima, como
              banda de cinco celdas; la tarjeta de captura recupera su título y
              su ayuda a la vista. */}
          <div className="k-tarjeta">
            <SignosVitalesCard
              value={signosVitales}
              onChange={setSignosVitales}
              errores={erroresVitales}
            />
          </div>
          <div className="k-tarjeta">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-10 flex-none items-center justify-center rounded-[12px] bg-tonal text-enlace" aria-hidden="true">
                {modoNota === 'ia' ? <Sparkles size={20} strokeWidth={2.1} /> : <PenLine size={20} strokeWidth={2.1} />}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="k-t-tarjeta">Cuéntame la consulta</h2>
                {modoNota === 'ia' ? (
                  <p id="nn-ayuda-dictado" className="k-t-sec mt-0.5 text-[14px] leading-5">
                    Describe el caso y Spinus redactará la nota médica. Escribe en lenguaje natural. No necesitas separar por secciones — Spinus lo hace por ti.
                  </p>
                ) : (
                  <p className="k-t-sec mt-0.5 text-[14px] leading-5">Redacta la nota clínica directamente — sin IA</p>
                )}
              </div>
            </div>

            {modoNota === 'ia' ? (
              /* ── Modo IA: input único — el médico redacta el caso completo ──
                 El campo va en un pozo `--fondo` con el micrófono dentro. 17/26
                 justificado con guiones, como se leerá la nota. */
              <div className="relative mt-4 rounded-[var(--r-control)] bg-fondo px-4 pb-[68px] pt-3.5 focus-within:outline focus-within:outline-2 focus-within:outline-enlace">
                <label htmlFor="nn-dictado" className="sr-only">
                  Descripción del caso (obligatorio)
                </label>
                <textarea
                  id="nn-dictado"
                  lang="es"
                  aria-describedby="nn-ayuda-dictado"
                  value={form.motivo_consulta}
                  onChange={e => update('motivo_consulta', e.target.value)}
                  disabled={generando}
                  placeholder="Ej.: Paciente con dolor lumbar de 2 semanas tras cargar peso, sin irradiación, Lasègue negativo, fuerza y reflejos normales. Indico naproxeno 500 mg cada 12 h por 7 días, ejercicios de McKenzie, cita en 2 semanas."
                  rows={6}
                  className="k-campo-sin-caja block min-h-[180px] w-full resize-none border-0 bg-transparent p-0 text-[17px] leading-[26px] text-tinta outline-none [hyphens:auto] [text-align:justify] placeholder:text-tinta3 placeholder:opacity-80 focus-visible:outline-none disabled:text-tinta2 esc:min-h-[150px]"
                />
                {/* Dictado por voz: aún no existe; el botón lo anuncia. Redondo y
                    a la vista, en tonal (no en relleno de acción: sigue
                    deshabilitado y no debe parecer que graba). */}
                <button
                  type="button"
                  disabled
                  title="Dictado por voz — próximamente"
                  aria-label="Dictado por voz — próximamente"
                  className="absolute bottom-3 right-3 inline-flex size-12 cursor-not-allowed items-center justify-center rounded-full bg-tonal text-enlace ring-4 ring-sup"
                >
                  <Mic size={22} strokeWidth={2.1} aria-hidden="true" />
                </button>
              </div>
            ) : (
              /* ── Modo manual: rejilla SOAP (C4) ──
                 Los 6 campos dejan de ser hermanos apilados y pasan a la
                 rejilla del sistema (.sp-grid-2, M8). El padding lo da
                 .sp-card--hero desde C3: aquí NO va p-5.
                 Orden de fuente idéntico al previo — la tabulación no cambia.
                 min-w-0 en cada celda: sin él, el min-width:auto del grid item
                 lo fija el ancho intrínseco del textarea (~200px, cols=20 por
                 defecto) y la rejilla desborda por debajo de ~1150px de
                 viewport, donde la columna 3/5 deja ~180px por celda. */
              <div className="space-y-4 pt-4">

                {/* Fila 1 — los dos pilares NOM: qué refiere y qué se halló */}
                <div className="sp-grid-2 sp-grid-2--soap">
                  {/* flex-col + flex-1: si una etiqueta envuelve a 2 líneas y su
                      pareja no, el textarea absorbe la diferencia y la fila
                      queda a ras. Los min-h siguen siendo el piso. */}
                  <div className="min-w-0 flex flex-col">
                    <label className="k-etiqueta mb-1">
                      Motivo de consulta / Subjetivo <span aria-hidden="true" className="text-[var(--mal-tinta)]">*</span>
                    </label>
                    {/* 78px: spec de la rejilla, sin equivalente en C0. Gana al
                        min-height:88px de .sp-textarea porque las utilidades de
                        Tailwind (@layer utilities) van después de las .sp-*
                        (@layer components). Los rows= se caen: manda el min-h. */}
                    <textarea value={form.motivo_consulta} onChange={e => update('motivo_consulta', e.target.value)}
                      placeholder="Ej: Paciente refiere cuadro de 3 días de evolución con dolor en región lumbar derecha irradiado a miembro inferior..."
                      className="k-campo min-h-[104px] flex-1 [hyphens:auto]" lang="es" />
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <label className="k-etiqueta mb-1">
                      Exploración física / Objetivo <span aria-hidden="true" className="text-[var(--mal-tinta)]">*</span>
                    </label>
                    <textarea value={form.exploracion_fisica} onChange={e => update('exploracion_fisica', e.target.value)}
                      placeholder="Ej: TA 120/80 mmHg, FC 72 lpm, FR 16 rpm, T° 36.5°C. Paciente consciente, orientado, cooperador. Abdomen blando, no doloroso a la palpación..."
                      className="k-campo min-h-[104px] flex-1 [hyphens:auto]" lang="es" />
                  </div>
                </div>

                {/* Banda full-width — opcional y a menudo vacío: no merece
                    media rejilla, y así no descuadra la simetría de la fila 1.
                    Sin flex: no tiene pareja con la que alinearse. */}
                <div>
                  <label className="k-etiqueta mb-1">
                    Auxiliares diagnósticos
                  </label>
                  {/* Sin "(opcional)": la ausencia del asterisco lo señala (C2) */}
                  <textarea value={form.gabinete_laboratorios} onChange={e => update('gabinete_laboratorios', e.target.value)}
                    placeholder="Ej: BH con leucocitosis leve. Rx de tórax sin infiltrados. RMN columna lumbar: hernia discal L4-L5..."
                    className="k-campo min-h-[96px] [hyphens:auto]" lang="es" />
                </div>

                {/* Banda full-width — lista que crece: rompe a ancho completo.
                    DiagnosticosEditor conserva su layout y su combobox (fuera
                    del alcance de C4); no necesita nada del contenedor. */}
                <div>
                  <label className="k-etiqueta mb-1">
                    Diagnóstico(s) CIE-10 <span aria-hidden="true" className="text-[var(--mal-tinta)]">*</span>
                  </label>
                  <DiagnosticosEditor
                    value={form.diagnosticos}
                    onChange={dx => setForm(prev => ({ ...prev, diagnosticos: dx }))}
                  />
                </div>

                {/* Fila 2 — el cierre del razonamiento: por qué y qué se hace */}
                <div className="sp-grid-2 sp-grid-2--soap">
                  <div className="min-w-0 flex flex-col">
                    <label className="k-etiqueta mb-1">
                      Análisis clínico
                    </label>
                    {/* 66px: spec de la rejilla, sin equivalente en C0 */}
                    <textarea value={form.analisis} onChange={e => update('analisis', e.target.value)}
                      placeholder="Razonamiento clínico: correlación clínico-radiológica, evolución, consideraciones..."
                      className="k-campo min-h-[96px] flex-1 [hyphens:auto]" lang="es" />
                  </div>
                  <div className="min-w-0 flex flex-col">
                    <label className="k-etiqueta mb-1">
                      Plan de tratamiento <span aria-hidden="true" className="text-[var(--mal-tinta)]">*</span>
                    </label>
                    <textarea value={form.plan_tratamiento} onChange={e => update('plan_tratamiento', e.target.value)}
                      placeholder="Ej: Reposo relativo. Fisioterapia 2 veces por semana por 6 semanas. Restricción de cargas. Control en 4 semanas. Signos de alarma: déficit neurológico progresivo..."
                      className="k-campo min-h-[96px] flex-1 [hyphens:auto]" lang="es" />
                  </div>
                </div>

              </div>
            )}
            {ultimoGuardado && !notaSaved && (
              <p role="status" className="sp-nota-entra mt-3 flex items-center gap-1.5 text-[13px] leading-[18px] text-tinta2">
                <CloudCheck size={15} aria-hidden="true" className="flex-none text-ok-tinta" />
                Borrador guardado
              </p>
            )}
          </div>

          {/* ── Modo IA: error + botón generar + resultado, todo bajo el textarea ── */}
          {modoNota === 'ia' && (
            <>
              {bloqueError}
              {/* Región CTA conmutable (paso 3.1): fade suave al mutar entre el
                  CTA de generación y el ancla "Nota lista". */}
              <div key={notaGenerada ? 'ancla' : 'cta'} className="sp-nota-entra">
              {anclaNota ?? (
                /* Principal a todo el ancho en teléfono, con «Prefiero
                   escribirla yo» debajo; en esc, los dos a la derecha (el
                   principal al final), como la maqueta. */
                <div className="flex flex-col items-stretch gap-1 esc:flex-row-reverse esc:items-center esc:justify-start esc:gap-4">
                  <button onClick={generarNota} disabled={generando || !form.motivo_consulta.trim()}
                    className="k-b k-b-prim h-12 w-full text-[17px] disabled:bg-sup2 disabled:text-tinta2 disabled:opacity-100 esc:h-11 esc:w-auto esc:px-5 esc:text-[15px]">
                    {generando
                      ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Redactando nota médica...</>
                      : <><Sparkles size={18} strokeWidth={2.2} aria-hidden="true" /> Generar con Spinus</>
                    }
                  </button>
                  <button type="button"
                    onClick={() => { cancelarEntrevista(); setMedicamentos([{ ...MED_VACIA }]); modoTocadoRef.current = true; setModoNota('manual'); setNotaGenerada(''); setError('') }}
                    className="k-b k-b-texto self-center">
                    Prefiero escribirla yo
                  </button>
                </div>
              )}
              </div>
            </>
          )}

          {/* ── Modo manual: error + botón previsualizar + resultado, al fondo (como hoy) ── */}
          {modoNota === 'manual' && (
            <>
              {bloqueError}
              {/* Región CTA conmutable (paso 3.1): fade suave al mutar entre el
                  CTA de previsualización y el ancla "Nota lista". */}
              <div key={notaGenerada ? 'ancla' : 'cta'} className="sp-nota-entra">
              {anclaNota ?? (
                <div className="flex flex-col items-stretch gap-1 esc:flex-row-reverse esc:items-center esc:justify-start esc:gap-4">
                  <button onClick={previewNotaManual} disabled={!form.motivo_consulta.trim()}
                    className="k-b k-b-prim h-12 w-full text-[17px] disabled:bg-sup2 disabled:text-tinta2 disabled:opacity-100 esc:h-11 esc:w-auto esc:px-5 esc:text-[15px]">
                    <Eye size={18} aria-hidden="true" /> Previsualizar nota
                  </button>
                  <button type="button"
                    onClick={() => { cancelarEntrevista(); setForm(f => ({ ...f, exploracion_fisica: '', analisis: '', gabinete_laboratorios: '', plan_tratamiento: '' })); modoTocadoRef.current = true; setModoNota('ia'); setNotaGenerada(''); setError('') }}
                    className="k-b k-b-texto self-center">
                    Usar IA
                  </button>
                </div>
              )}
              </div>
            </>
          )}
        </div>
        )}

        {/* ════════════════════════════════
            COLUMNA DERECHA (2/5) en Captura · bloque de Documentos en Cierre
        ════════════════════════════════ */}
        <div className={notaSaved ? '' : 'lg:col-span-2 lg:sticky lg:top-6 space-y-4'}>

          {/* ── Panel contextual del paciente ──
              No sobrevive al Cierre (decisión §5.3): existe para informar
              mientras se redacta, y los formularios de documentos se prellenan
              solos desde form.diagnosticos y medicamentosParaReceta. */}
          {/* «La nota aparecerá aquí» (CALMA §30.7, aprobado): sólo en esc y
              mientras no hay nota; los rótulos son los apartados de la nota. */}
          {!notaSaved && !notaGenerada && (
            /* Ajuste 2: tarjeta de vista previa con estructura — los seis
               apartados como rótulos de acento con líneas fantasma (esqueleto
               QUIETO, sin animación) para que se entienda qué va a salir. */
            <div aria-hidden="true" className="k-tarjeta hidden esc:block">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-tonal text-enlace">
                  <FileText size={16} strokeWidth={2.1} />
                </span>
                <p className="text-[15px] font-semibold leading-5 text-tinta">La nota aparecerá aquí</p>
              </div>
              <ul className="mt-4 space-y-3.5">
                {['Subjetivo', 'Objetivo', 'Auxiliares diagnósticos', 'Diagnóstico', 'Análisis', 'Plan'].map((t, n) => (
                  <li key={t}>
                    <p className="flex items-center gap-2 text-[12px] font-bold uppercase leading-4 tracking-[.5px] text-enlace">
                      <span className="h-3 w-[3px] flex-none rounded-full bg-accion opacity-60" />
                      {t}
                    </p>
                    <span className="mt-2 block h-2 rounded-full bg-sup2" style={{ width: `${[92, 84, 70, 64, 88, 78][n]}%` }} />
                    {n !== 2 && n !== 3 && <span className="mt-1.5 block h-2 rounded-full bg-sup2" style={{ width: `${[58, 46, 0, 0, 52, 40][n]}%` }} />}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!notaSaved && paciente && (
            /* Contexto del paciente con el kit: tarjeta sin borde ni sombra,
               rótulo en mayúsculas (uno por tarjeta) y pares con línea fina.
               La alergia, como etiqueta roja suave (CALMA §3), no un bloque. */
            <section aria-labelledby="titulo-contexto" className="k-tarjeta">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-tonal text-enlace" aria-hidden="true">
                  <User size={16} strokeWidth={2.1} />
                </span>
                <h2 id="titulo-contexto" className="k-t-rotulo">Contexto del paciente</h2>
              </div>
              <DatosContexto paciente={paciente} />

              {paciente.alergias && (
                <span className="k-etq k-etq-mal mt-3 h-auto min-h-6 max-w-full whitespace-normal py-0.5">
                  <AlertTriangle aria-hidden="true" />
                  Alergias: {paciente.alergias}
                </span>
              )}

              {(ultimaConsulta?.diagnosticos || (ultimaConsulta?.medicamentos?.length ?? 0) > 0) && (
                <dl className="mt-3 space-y-3 border-t border-linea pt-3">
                  {ultimaConsulta?.diagnosticos && (
                    <div>
                      <dt className="k-t-rotulo">Último diagnóstico</dt>
                      <dd className="mt-1.5"><ListaUltimoDx lista={ultimaConsulta.dxLista} /></dd>
                    </div>
                  )}
                  {ultimaConsulta?.medicamentos && ultimaConsulta.medicamentos.length > 0 && (
                    <div>
                      <dt className="k-t-rotulo">Último tratamiento</dt>
                      {ultimaConsulta.medicamentos.slice(0, 4).map((m, i) => (
                        <dd key={i} className="mt-1.5 flex items-baseline gap-2 text-[14px] leading-5 text-tinta">
                          <Pill size={13} aria-hidden="true" className="flex-none translate-y-0.5 text-tinta3" />
                          <span className="min-w-0"><span className="font-semibold">{m.nombre}</span> {m.dosis && <span className="text-tinta2">{m.dosis}</span>}</span>
                        </dd>
                      ))}
                    </div>
                  )}
                </dl>
              )}

              {!paciente.alergias && !ultimaConsulta?.diagnosticos && (
                <p className="k-t-sec mt-3 rounded-[var(--r-control)] bg-fondo py-3 text-center">Primera consulta del paciente</p>
              )}
            </section>
          )}

          {/* ── Panel de documentos ──
              En Cierre queda como encabezado: las tarjetas de tipo bajaron al
              otro lado de «Concluir consulta» (montaje 1 de la guía 04, cuyo
              cromo encima del selector es «Card de nota guardada + botón
              Concluir consulta»).
              En Captura conserva su chrome actual intacto — migrarlo cambiaría
              el estado de captura, que no es objetivo de C5. */}
          <div
            /* data-onboard="panel-documentos" SE CONSERVA y sube desde la
               rejilla retirada a esta card: es el único ancla con consumidor
               vivo — el querySelector de «Otros documentos» del Estado Éxito
               depende de él, y el selector queda justo debajo. */
            data-onboard={notaSaved ? 'panel-documentos' : undefined}
            className="k-tarjeta">

            {notaSaved ? (
              /* Encabezado del Cierre: ABSORBE el banner verde en vez de
                 duplicar el mensaje. .sp-title-card y no .sp-title-page (ya lo
                 usa el H1 de la página) ni .sp-title-state (identidad del
                 Estado 4 del modal, que el médico acaba de ver).
                 Palomita en círculo verde suave, como «Nota guardada» del modal. */
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--ok-fondo)] text-[var(--ok-tinta)] [&_svg]:h-5 [&_svg]:w-5" aria-hidden="true">
                  <Check />
                </span>
                <div>
                  <h2 className="k-t-tarjeta">Nota guardada</h2>
                  <p className="mt-0.5 text-[13px] leading-[18px] text-tinta2">Genera los documentos de esta consulta</p>
                </div>
              </div>
            ) : (
              <h2 className="k-t-rotulo">Documentos del paciente</h2>
            )}

            {!notaSaved ? (
              /* Estado: esperando que se guarde la nota */
              <div className="flex flex-col items-center gap-3 px-2 py-5 text-center">
                <FileText size={20} aria-hidden="true" className="text-tinta3" />
                <p className="max-w-[38ch] text-[14px] leading-5 text-tinta2">
                  {notaGenerada
                    ? 'Guarda la nota para poder generar documentos desde aquí'
                    : 'Completa y genera la nota para activar este panel'}
                </p>
                {/* R8: una sola vía de guardado — este botón abre la revisión */}
                {notaGenerada && (
                  <button onClick={abrirRevision} disabled={guardando || !consultorioActivo}
                    className="k-b k-b-tonal">
                    {guardando ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : <><Save size={16} aria-hidden="true" /> Revisar y guardar</>}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* ════════════════════════════════
            CIERRE — salida del funnel
            Los vitales no se re-emiten: sobre una nota sellada la card seguiría
            editable y sus ediciones no persisten (autosave cortado por
            notaSaved) — ilusión de integridad en un registro inmutable. El
            Cierre tiene un solo propósito: documentar y concluir.
        ════════════════════════════════ */}
        {notaSaved && (
          <>
            {/* Primario único de la pantalla, en flujo y no sticky: el Cierre es
                corto y una barra fija taparía el selector de tipo. <Link> y no
                router.push: .sp-btn ya se usa sobre Link en el Estado Éxito, y
                conserva prefetch y clic-central. Sin --reward: esa sombra es
                del CTA de receta del Estado 4.
                El onClick solo INTERCEPTA (§6.2: se avisa, no se bloquea); con
                el formulario vacío deja pasar la navegación del Link intacta.
                El clic central dispara auxclick, no click, así que abre en
                pestaña nueva sin pasar por el aviso: es un gesto explícito de
                "no me lleves de aquí" y no hay nada que advertir. */}
            <Link href={`/expediente/${id}`}
              onClick={e => {
                if (formVacio || !docInline) return
                e.preventDefault()
                setConfirmarConcluir(true)
              }}
              className="sp-btn sp-btn--primary sp-btn--primary-block">
              <Check size={18} />
              Concluir consulta
            </Link>

            {/* Selector de tipo + formulario, en la misma pantalla y a anchura
                completa. Murió el modal flotante: con el contexto del paciente
                y de la consulta ya en pantalla no había nada que pasarle. */}
            <div className="sp-doc-host">
              <SelectorTipoDocumento
                value={docInline}
                onChange={t => { setFormVacio(true); setPanelPlantillas(false); setDocInline(t) }}
                conDatos={!formVacio}
                oculto={panelPlantillas}
              >
                {/* ⚠️ DESELECCIONAR EL TIPO DESMONTA EL FORMULARIO, Y ESO NO ES UN
                    EFECTO SECUNDARIO: ES LA GARANTÍA. Es lo único que impide editar un
                    documento ya emitido —entre emitir y desmontar el modal tapa el
                    formulario y atrapa el foco—, así que cuando vuelve a existir es
                    uno nuevo y vacío. Los formularios tuvieron una segunda red por
                    dentro (una huella del contenido al emitir) y se retiró por
                    inalcanzable; si esto deja de desmontar, hay que reponerla. */}
                {docInline === 'receta' && (
                  <RecetaFormDynamic pacienteInicial={nombrePaciente} diagnosticoInicial={formatDiagnosticosInline(form.diagnosticos)} pacienteId={id} medicamentosIniciales={medicamentosParaReceta} onVacioChange={setFormVacio} onCerrarTrasEmitir={() => setDocInline(null)} onPanelPlantillasChange={setPanelPlantillas} />
                )}
                {docInline === 'lab' && (
                  <SolicitudLabFormDynamic pacienteInicial={nombrePaciente} diagnosticoInicial={formatDiagnosticosInline(form.diagnosticos)} pacienteId={id} onVacioChange={setFormVacio} onCerrarTrasEmitir={() => setDocInline(null)} onPanelPlantillasChange={setPanelPlantillas} />
                )}
                {docInline === 'imagen' && (
                  <SolicitudImagenFormDynamic pacienteInicial={nombrePaciente} diagnosticoInicial={formatDiagnosticosInline(form.diagnosticos)} pacienteId={id} onVacioChange={setFormVacio} onCerrarTrasEmitir={() => setDocInline(null)} onPanelPlantillasChange={setPanelPlantillas} />
                )}
                {docInline === 'suplementacion' && (
                  <PlanSupFormDynamic pacienteInicial={nombrePaciente} diagnosticoInicial={formatDiagnosticosInline(form.diagnosticos)} pacienteId={id} onVacioChange={setFormVacio} onCerrarTrasEmitir={() => setDocInline(null)} onPanelPlantillasChange={setPanelPlantillas} />
                )}
                {docInline === 'internamiento' && (
                  <InternamientoFormDynamic pacienteInicial={nombrePaciente} diagnosticoInicial={formatDiagnosticosInline(form.diagnosticos)} pacienteId={id} onVacioChange={setFormVacio} onCerrarTrasEmitir={() => setDocInline(null)} onPanelPlantillasChange={setPanelPlantillas} />
                )}
                {docInline === 'escrito' && (
                  <EscritoFormDynamic pacienteInicial={nombrePaciente} pacienteId={id} onVacioChange={setFormVacio} onCerrarTrasEmitir={() => setDocInline(null)} onPanelPlantillasChange={setPanelPlantillas} />
                )}
                {docInline === 'consentimiento' && (
                  <ConsentimientoFormDynamic pacienteInicial={nombrePaciente} diagnosticoInicial={formatDiagnosticosInline(form.diagnosticos)} edadInicial={edadInicial} pacienteId={id} onVacioChange={setFormVacio} onCerrarTrasEmitir={() => setDocInline(null)} onPanelPlantillasChange={setPanelPlantillas} />
                )}
                {docInline === 'honorarios' && (
                  <HonorariosFormDynamic pacienteInicial={nombrePaciente} pacienteId={id} onVacioChange={setFormVacio} onCerrarTrasEmitir={() => setDocInline(null)} onPanelPlantillasChange={setPanelPlantillas} />
                )}
              </SelectorTipoDocumento>
            </div>
          </>
        )}

      </div>

      {/* Aviso al concluir con un formulario a medio llenar (§6.2). Nombra el
          documento pendiente, nunca «tienes cambios sin guardar». */}
      <ModalShell
        open={confirmarConcluir}
        onClose={() => setConfirmarConcluir(false)}
        spinusGeometry="decide"
        title="¿Concluir la consulta?"
        footer={
          <div className="flex items-center gap-2 px-6 py-4 ext:px-4">
            <button onClick={() => setConfirmarConcluir(false)} className="sp-btn sp-btn--ghost">
              Seguir llenando
            </button>
            <div className="flex-1" />
            <button onClick={() => router.push(`/expediente/${id}`)} className="sp-btn sp-btn--primary">
              Concluir de todos modos
            </button>
          </div>
        }
      >
        <div className="p-4 md:p-6">
          <p className="sp-body">
            Tienes {tipoDocumento(docInline)?.pendiente ?? 'un documento empezado'} y sin imprimir.
            Si concluyes ahora, no se emite. Puedes concluir de todos modos: no todo lo que
            se empieza se entrega.
          </p>
        </div>
      </ModalShell>

    </div>
  )
}
