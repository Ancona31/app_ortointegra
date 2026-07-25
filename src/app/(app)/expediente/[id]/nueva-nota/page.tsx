'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import ModalShell from '@/components/ui/ModalShell'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Paciente, Diagnostico, MedicamentoConsulta, SignosVitales, MedicoInfo } from '@/types'
import type { MedicamentoIA, BloqueIA, NotaIAResponse } from '@/lib/notaIA/schema'
import { calcularEdad, generateDocFileName } from '@/lib/patientUtils'
import { buildNotaRenderData } from '@/lib/notaRenderData'
import {
  ArrowLeft, Save, Loader2, RotateCcw, Printer, Eye, Pencil,
  Pill, FlaskConical, ScanLine, ClipboardList, CheckCircle2,
  BedDouble, PenLine, ShieldCheck, Receipt, X, FileText,
  ChevronLeft, ChevronRight, Mic, Sparkles, AlertTriangle,
} from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import { generarPdf } from '@/lib/mobileShare'
import { secureStorage } from '@/lib/secureStorage'
import { useAuditAccess } from '@/hooks/useAudit'
import DiagnosticosEditor from '@/components/documentos/DiagnosticosEditor'
import dynamic from 'next/dynamic'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import SignosVitalesCard, { type SignosVitalesForm } from '@/components/expediente/SignosVitalesCard'
import { fueraDeLimitesDuros, type SignoVitalKey } from '@/lib/signosVitalesRangos'

function FormCargando() {
  return (
    <div className="flex items-center justify-center py-12 text-slate-400">
      <Loader2 size={20} className="animate-spin mr-2" />
      <span className="text-sm">Cargando formulario...</span>
    </div>
  )
}

function FormErrorFallback() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
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

const DOCS = [
  { key: 'receta',         label: 'Receta médica',            icon: Pill,          color: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100' },
  { key: 'lab',            label: 'Solicitud de laboratorio', icon: FlaskConical,  color: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
  { key: 'imagen',         label: 'Solicitud de imagen',      icon: ScanLine,      color: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100' },
  { key: 'suplementacion', label: 'Plan de suplementación',   icon: ClipboardList, color: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' },
  { key: 'internamiento',  label: 'Internamiento',            icon: BedDouble,     color: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100' },
  { key: 'escrito',        label: 'Escrito médico',           icon: PenLine,       color: 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100' },
  { key: 'consentimiento', label: 'Consentimiento',           icon: ShieldCheck,   color: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
  { key: 'honorarios',     label: 'Honorarios / Cotización',   icon: Receipt,       color: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100' },
]

const MED_VACIA: MedicamentoConsulta = { nombre: '', dosis: '', frecuencia: '', duracion: '' }

// Máquina de estados del modal del funnel de nota (paso 1.1).
type EstadoModal = 'generando' | 'entrevista' | 'revision' | 'contexto' | 'confirmacion' | 'exito' | null

// Header del ModalShell por estado. 'confirmacion' (paso 1.4) y 'exito' (paso 1.5)
// usan header vacío: su superficie es un bloque centrado en el cuerpo (ícono +
// título), fieles a M6/M7. El resto conserva header con ícono Spinus.
function metaDelModal(e: EstadoModal): { title: string; subtitle: string; maxWidth: string } {
  switch (e) {
    case 'revision':     return { title: 'Tu nota está lista',              subtitle: 'Revísala antes de guardar',       maxWidth: 'max-w-2xl' }
    case 'contexto':     return { title: 'Ajusta el contexto',              subtitle: 'La nota se generará de nuevo',    maxWidth: 'max-w-2xl' }
    case 'generando':    return { title: 'Spinus está redactando tu nota',  subtitle: 'Unos segundos…',                  maxWidth: 'max-w-lg'  }
    case 'confirmacion': return { title: '',                                subtitle: '',                                maxWidth: 'max-w-md'  }
    case 'exito':        return { title: '',                                subtitle: '',                                maxWidth: 'max-w-md'  }
    default:             return { title: 'Spinus necesita más información', subtitle: 'Responde para completar la nota', maxWidth: 'max-w-lg'  }
  }
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
  // 'confirmacion'|'exito' se implementan en pasos 1.4–1.5
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
  const [error, setError]               = useState('')
  const [notaSaved, setNotaSaved]       = useState(false)
  const [docInline, setDocInlineRaw]    = useState<string | null>(null)
  const [slideDir, setSlideDir]         = useState<'left' | 'right'>('right')
  const [slideKey, setSlideKey]         = useState(0)
  const prevDocRef                      = useRef<string | null>(null)

  const setDocInline = (key: string | null) => {
    if (key && prevDocRef.current && key !== prevDocRef.current) {
      const docs = medicamentosParaReceta.length > 0 ? DOCS : DOCS.filter(d => d.key !== 'receta')
      const prevIdx = docs.findIndex(d => d.key === prevDocRef.current)
      const nextIdx = docs.findIndex(d => d.key === key)
      setSlideDir(nextIdx > prevIdx ? 'right' : 'left')
      setSlideKey(k => k + 1)
    }
    prevDocRef.current = key
    setDocInlineRaw(key)
  }
  const [ultimoGuardado, setUltimoGuardado] = useState<Date | null>(null)
  const [borradorRestaurado, setBorradorRestaurado] = useState(false)
  const [ultimaConsulta, setUltimaConsulta] = useState<{ diagnosticos: string; medicamentos: MedicamentoConsulta[] | null } | null>(null)

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
        const dx = Array.isArray(data.diagnosticos)
          ? (data.diagnosticos as { descripcion?: string }[]).map(d => d.descripcion).filter(Boolean).join(', ')
          : ''
        setUltimaConsulta({ diagnosticos: dx, medicamentos: data.medicamentos || null })
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
  }, [form, medicamentos, signosVitales, notaGenerada, modoNota, notaSaved])

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
    const dxValidos = form.diagnosticos.filter(d => d.descripcion?.trim())
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
    const notaFinal = notaGenerada
      + (form.pronostico.trim() ? `\n\n**[PRONÓSTICO]:**\n${form.pronostico.trim()}` : '')

    const payload = {
      paciente_id: id,
      consultorio_id: consultorioActivo?.id,
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
  // T3: sin llamador hasta 1.5 (Estado Éxito) — no eliminar. El botón pre-guardado
  // murió con el panel inline en 1.2 y el post-guardado nace en 1.5; conservar el
  // handler evita reponer las 8 fuentes de estado que lee (R11). Genera 3 warnings
  // de no-unused-vars (imprimir, imprimiendo, Printer): esperados, no rompen lint.
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

      // Réplica EXACTA de notaFinal de guardar(): el pronóstico se concatena a la
      // narrativa (misma fuente que la consulta guardada → PDF idéntico en B′).
      const notasEvolucion = notaGenerada
        + (form.pronostico.trim() ? `\n\n**[PRONÓSTICO]:**\n${form.pronostico.trim()}` : '')

      const notaRenderData = buildNotaRenderData({
        origen: 'formulario',
        paciente,
        medicoVivo,
        consultorio: consultorioActivo,
        fecha: new Date().toISOString(),
        notasEvolucion,
        diagnosticos: form.diagnosticos.filter(d => d.descripcion?.trim()),
        motivoConsulta: form.motivo_consulta,
        signosVitales: construirSignosVitalesPayload(signosVitales) ?? null,
        proximaCita: form.proxima_cita || null,
        notaOrigen: modoNota,
      })

      // Sin pacienteId: imprimir NO persiste en Storage (solo entrega el PDF).
      await generarPdf({
        tipo: 'nota_evolucion',
        medico: null,
        data: { ...notaRenderData },
        logoUrl: notaRenderData.medico.logoUrl,
        filename: generateDocFileName(notaRenderData.paciente.nombreCompleto, 'Nota-Evolucion'),
      })
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
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
  ) : null

  // Ancla de la Card Captura: hay nota, el modal está cerrado y aún no se guardó.
  // Sustituye al CTA propio de cada vía (montaje con ?? más abajo).
  // TERNARIO CON null A PROPÓSITO: con `&&` el valor falso sería `false`, que NO es
  // nullish, así que el `??` del montaje no dispararía y la card quedaría sin CTA.
  const anclaNota = (notaGenerada && estadoModal === null && !notaSaved) ? (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
        <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
        <h2 className="font-semibold text-emerald-700 text-sm">Nota lista</h2>
        {modoNota === 'ia' ? (
          <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#1e5fa8]/10 text-[#1e5fa8] border border-[#1e5fa8]/20">
            <Sparkles size={9} />
            Nota IA
          </span>
        ) : (
          <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
            <PenLine size={9} />
            Nota manual
          </span>
        )}
      </div>
      <div className="p-5 space-y-4">
        {/* Dictado colapsado, solo lectura */}
        <button type="button" onClick={() => setDictadoExpandido(v => !v)} className="w-full text-left group">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
            {modoNota === 'ia' ? 'Tu dictado' : 'Motivo de consulta'}
          </p>
          <p className={`text-xs text-slate-600 leading-relaxed whitespace-pre-wrap ${dictadoExpandido ? '' : 'line-clamp-3'}`}>
            {form.motivo_consulta}
          </p>
          <span className="text-[11px] text-[#1e5fa8] mt-1 inline-block group-hover:underline">
            {dictadoExpandido ? 'Ocultar' : 'Ver completo'}
          </span>
        </button>

        {confirmarDescarte ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 space-y-2">
            <p className="text-xs text-amber-800 leading-relaxed">
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
                className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
                Sí, empezar de nuevo
              </button>
              <button onClick={() => setConfirmarDescarte(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                Conservar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={abrirRevision}
              className="flex-1 flex items-center justify-center gap-2 bg-[#1e5fa8] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1a3a5c] transition-colors">
              <Eye size={16} /> Revisar y guardar
            </button>
            <button onClick={() => setConfirmarDescarte(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <RotateCcw size={14} /> Empezar de nuevo
            </button>
          </div>
        )}
      </div>
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
          nivel raíz: ya no lo desmonta el toggle IA/manual. */}
      <ModalShell
        open={estadoModal !== null}
        onClose={cerrarModalPorEstado}
        fullscreenMobile
        maxWidth={meta.maxWidth}
        hideClose={(generando && !errorModal) || estadoModal === 'confirmacion'}
        title={meta.title}
        subtitle={meta.subtitle}
        icon={estadoModal === 'confirmacion' || estadoModal === 'exito' ? undefined : <Sparkles size={15} className="text-[#1e5fa8]" />}
        iconBg="bg-[#1e5fa8]/10"
        headerRight={estadoModal === 'revision' ? (
          modoNota === 'ia' ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#1e5fa8]/10 text-[#1e5fa8] border border-[#1e5fa8]/20">
              <Sparkles size={9} />
              Nota IA
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
              <PenLine size={9} />
              Nota manual
            </span>
          )
        ) : undefined}
        footer={estadoModal === 'entrevista' ? (
          <div className="flex items-center gap-2 p-4">
            <button onClick={cancelarEntrevista} disabled={generando}
              className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40">
              Cancelar
            </button>
            <div className="flex-1" />
            <button onClick={() => setBloqueActual(i => i - 1)} disabled={bloqueActual === 0 || generando}
              className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Anterior
            </button>
            {esUltimoBloque ? (
              <button onClick={responderEntrevista} disabled={!bloqueCompleto || generando}
                className="px-5 py-2 text-sm font-semibold bg-[#1e5fa8] text-white rounded-lg hover:bg-[#1a3a5c] transition-colors disabled:opacity-50 flex items-center gap-2">
                {generando ? <><Loader2 size={15} className="animate-spin" /> Enviando...</> : 'Enviar respuestas'}
              </button>
            ) : (
              <button onClick={() => setBloqueActual(i => i + 1)} disabled={!bloqueCompleto}
                className="px-5 py-2 text-sm font-semibold bg-[#1e5fa8] text-white rounded-lg hover:bg-[#1a3a5c] transition-colors disabled:opacity-50">
                Siguiente
              </button>
            )}
          </div>
        ) : estadoModal === 'revision' ? (
          <div className="flex items-center gap-2 p-4">
            <button onClick={cancelarEntrevista}
              className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
              Cerrar
            </button>
            <div className="flex-1" />
            {/* Confirmación universal (1.4): el modal NO se cierra; intentarGuardar
                muta a 'confirmacion'. Murió T2 (el apilado Portal-sobre-modal). */}
            <button
              onClick={() => { setErrorModal(null); intentarGuardar() }}
              disabled={guardando || !consultorioActivo}
              className="px-5 py-2 text-sm font-semibold bg-[#1e5fa8] text-white rounded-lg hover:bg-[#1a3a5c] transition-colors disabled:opacity-50 flex items-center gap-2">
              {guardando ? <><Loader2 size={15} className="animate-spin" /> Guardando...</> : <><Save size={15} /> Guardar nota</>}
            </button>
          </div>
        ) : estadoModal === 'contexto' ? (
          <div className="flex items-center gap-2 p-4">
            <button onClick={() => { setEstadoModal('revision'); setErrorModal(null) }}
              className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
              Cancelar
            </button>
            <div className="flex-1" />
            <button onClick={generarNota} disabled={!form.motivo_consulta.trim()}
              className="px-5 py-2 text-sm font-semibold bg-[#1e5fa8] text-white rounded-lg hover:bg-[#1a3a5c] transition-colors disabled:opacity-50 flex items-center gap-2">
              <Sparkles size={15} /> Regenerar nota
            </button>
          </div>
        ) : estadoModal === 'confirmacion' ? (
          <div className="flex items-center gap-2 p-4">
            <button onClick={() => setEstadoModal('revision')} disabled={guardando}
              className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40">
              Volver a revisar
            </button>
            <div className="flex-1" />
            <button onClick={guardar} disabled={guardando}
              className="px-5 py-2 text-sm font-semibold bg-[#1e5fa8] text-white rounded-lg hover:bg-[#1a3a5c] transition-colors disabled:opacity-50 flex items-center gap-2">
              {guardando ? <><Loader2 size={15} className="animate-spin" /> Guardando...</> : <><Save size={15} /> Guardar nota</>}
            </button>
          </div>
        ) : estadoModal === 'exito' ? (
          <div className="p-4 space-y-2.5">
            {/* Primario único: la recompensa es la receta (blueprint §5.2). */}
            <button
              onClick={() => { setEstadoModal(null); setDocInline('receta') }}
              className="w-full flex items-center justify-center gap-2 bg-[#1e5fa8] text-white px-5 py-3 rounded-lg text-sm font-semibold hover:bg-[#1a3a5c] transition-colors">
              <Pill size={16} /> Generar receta
              {medicamentosParaReceta.length > 0 && (
                <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/20">
                  {medicamentosParaReceta.length} medicamento{medicamentosParaReceta.length === 1 ? '' : 's'}
                </span>
              )}
            </button>
            {/* Secundarios (ghost, wrap). Todos alcanzan el post-guardado sin re-guardar. */}
            <div className="flex flex-wrap items-center justify-center gap-1">
              <button
                onClick={() => { setEstadoModal(null); setTimeout(() => document.querySelector('[data-onboard="panel-documentos"]')?.scrollIntoView({ behavior: 'smooth' }), 0) }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                <FileText size={15} /> Otros documentos
              </button>
              <button onClick={imprimir} disabled={imprimiendo}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-40">
                {imprimiendo ? <><Loader2 size={15} className="animate-spin" /> Imprimiendo...</> : <><Printer size={15} /> Imprimir nota</>}
              </button>
              <Link href={`/expediente/${id}`}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                <Eye size={15} /> Ver expediente
              </Link>
              <button onClick={() => setEstadoModal(null)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={15} /> Cerrar
              </button>
            </div>
          </div>
        ) : undefined}
      >
        {estadoModal === 'generando' && (errorModal ? (
          <div className="px-5 py-12 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle size={22} className="text-red-500" />
            </div>
            <p className="text-sm text-slate-600 leading-relaxed max-w-xs">{errorModal}</p>
            <div className="flex items-center gap-2 mt-1">
              <button onClick={cancelarEntrevista}
                className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                Cerrar
              </button>
              <button onClick={generarNota}
                className="px-5 py-2 text-sm font-semibold bg-[#1e5fa8] text-white rounded-lg hover:bg-[#1a3a5c] transition-colors flex items-center gap-2">
                <RotateCcw size={14} /> Reintentar
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 py-12 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#1e5fa8]/10 flex items-center justify-center">
              <Sparkles size={22} className="text-[#1e5fa8]" />
            </div>
            <Loader2 size={20} className="animate-spin text-[#1e5fa8]" />
            <p className="text-sm text-slate-500">Estructurando tu nota…</p>
          </div>
        ))}
        {estadoModal === 'entrevista' && (
          <>
          <div className="p-5 space-y-4">
            {/* Progreso */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Bloque {bloqueActual + 1} de {bloquesEntrevista.length}
                </p>
                {!bloqueCompleto && faltanEnBloque > 0 && (
                  <p className="text-[11px] text-amber-600">Faltan {faltanEnBloque} por responder</p>
                )}
              </div>
              <div className="flex gap-1">
                {bloquesEntrevista.map((_, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${i <= bloqueActual ? 'bg-[#1e5fa8]' : 'bg-slate-200'}`} />
                ))}
              </div>
            </div>

            {/* Preguntas del bloque actual */}
            {bloqueEnCurso && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-700">{bloqueEnCurso.titulo}</h3>
                {bloqueEnCurso.preguntas.map(preg => {
                  const respondida = !!(respuestasEntrevista[preg.id] ?? '').trim()
                  return (
                    <div key={preg.id} className="space-y-1.5">
                      <p className="text-sm text-slate-700 flex items-start gap-1.5">
                        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${respondida ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <span>{preg.pregunta}</span>
                      </p>
                      {preg.opciones.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pl-3">
                          {preg.opciones.map(op => (
                            <button key={op} type="button"
                              onClick={() => setRespuestasEntrevista(prev => ({ ...prev, [preg.id]: op }))}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${respuestasEntrevista[preg.id] === op ? 'bg-[#1e5fa8] text-white border-[#1e5fa8]' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
                              {op}
                            </button>
                          ))}
                        </div>
                      )}
                      <input type="text"
                        value={respuestasEntrevista[preg.id] ?? ''}
                        onChange={e => setRespuestasEntrevista(prev => ({ ...prev, [preg.id]: e.target.value }))}
                        placeholder="Escribe tu respuesta..."
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
            {errorModal && (
              <div className="mx-5 mb-5 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                {errorModal}
              </div>
            )}
          </>
        )}
        {estadoModal === 'revision' && (
          <div className="p-5 space-y-5">
            {/* ── La nota ── */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs text-slate-400">
                  {modoEdicion ? 'Editando texto' : 'Vista previa — haz clic en Editar para modificar'}
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setModoEdicion(!modoEdicion)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${modoEdicion ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                    {modoEdicion ? <><Eye size={12} /> Vista previa</> : <><Pencil size={12} /> Editar</>}
                  </button>
                  <button
                    onClick={() => { if (notaEditada) { setConfirmarPisado(true); return } ejecutarPisado() }}
                    disabled={generando || !form.motivo_consulta.trim()}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 px-2 py-1 disabled:opacity-40">
                    <RotateCcw size={12} /> {modoNota === 'ia' ? 'Regenerar' : 'Actualizar'}
                  </button>
                </div>
              </div>

              {/* R12: la confirmación solo advierte; nada se pisa hasta confirmar */}
              {confirmarPisado && (
                <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 space-y-2">
                  <p className="text-xs text-amber-800 leading-relaxed">Perderás tus cambios — ¿Continuar?</p>
                  <div className="flex gap-2">
                    <button onClick={ejecutarPisado}
                      className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors">
                      {modoNota === 'ia' ? 'Sí, regenerar' : 'Sí, actualizar'}
                    </button>
                    <button onClick={() => setConfirmarPisado(false)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                      Conservar
                    </button>
                  </div>
                </div>
              )}

              {modoEdicion ? (
                <textarea
                  value={notaGenerada}
                  onChange={e => { setNotaGenerada(e.target.value); setNotaEditada(true) }}
                  rows={16}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 resize-y" />
              ) : (
                <div className="prose prose-sm max-w-none prose-headings:text-[#1a3a5c] prose-headings:font-bold prose-headings:text-sm prose-headings:mt-4 prose-headings:mb-1 prose-strong:text-[#1a3a5c] prose-strong:font-semibold prose-p:text-slate-700 prose-p:leading-relaxed prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-li:text-slate-700">
                  <ReactMarkdown>{notaFinal}</ReactMarkdown>
                </div>
              )}
            </div>

            {/* ── Medicamentos detectados (solo IA) ── */}
            {modoNota === 'ia' && medicamentos.some(m => m.nombre.trim()) && (
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500 mb-2">
                  Detecté estos medicamentos (precargarán tu receta):
                </p>
                <div className="flex flex-wrap gap-2">
                  {/* Índice del array REAL: puede haber filas vacías intercaladas
                      (IA con nombre nulo, o la tabla T4 que sigue viva hasta 2.1). */}
                  {medicamentos.map((m, i) => m.nombre.trim() ? (
                    <span key={i}
                      className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full border border-[#1e5fa8]/20 bg-[#1e5fa8]/5 text-xs text-[#1a3a5c]">
                      {m.nombre.trim()}
                      <button type="button" onClick={() => removeMed(i)}
                        aria-label={`Quitar ${m.nombre.trim()}`}
                        className="relative w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors after:absolute after:-inset-2 after:content-['']">
                        <X size={13} />
                      </button>
                    </span>
                  ) : null)}
                </div>
              </div>
            )}

            {/* ── Diagnósticos (lectura, ambos modos) ── */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Diagnósticos</h3>
              {dxValidos.length > 0 ? (
                <ul className="space-y-1">
                  {dxValidos.map((d, i) => (
                    <li key={i} className="text-sm text-slate-700 leading-relaxed">
                      {d.codigo_cie10 ? (
                        <><span className="font-semibold text-[#1a3a5c]">{d.codigo_cie10}</span> — {d.descripcion.trim()}</>
                      ) : d.descripcion.trim()}
                    </li>
                  ))}
                </ul>
              ) : (
                /* N1: solo alcanzable en IA (manual valida ≥1 dx antes de abrir). Se MUESTRA
                   en vez de ocultarse: la invisibilidad del dx fue justo R7. */
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Sin diagnóstico estructurado — la nota se guardará sin código CIE-10.
                </p>
              )}
              {modoNota === 'ia' && (
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  ¿Algo incorrecto? Regenera la nota con más contexto.
                </p>
              )}
            </div>

            {/* ── Seguimiento ── */}
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Seguimiento</h3>
              {modoEdicion ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Pronóstico <span className="text-slate-400 font-normal">(opcional)</span></label>
                    <input type="text" value={form.pronostico} onChange={e => update('pronostico', e.target.value)}
                      placeholder="Ej: Favorable a mediano plazo con tratamiento conservador..."
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-500 block mb-1">Próxima cita</label>
                    <input type="text" value={form.proxima_cita} onChange={e => update('proxima_cita', e.target.value)}
                      placeholder="Ej: En 4 semanas, 15 de abril 2026..."
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs text-slate-500">
                      <span className="text-slate-400">Pronóstico: </span>
                      <span className="text-slate-600 break-words">{form.pronostico.trim() || '—'}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      <span className="text-slate-400">Próxima cita: </span>
                      <span className="text-slate-600 break-words">{form.proxima_cita.trim() || '—'}</span>
                    </p>
                  </div>
                  <button onClick={() => setModoEdicion(true)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300 transition-colors flex-shrink-0">
                    <Pencil size={12} /> Editar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {estadoModal === 'contexto' && (
          <div className="p-5 space-y-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              Corrige o amplía el contexto; la nota se generará de nuevo.
            </p>
            <textarea
              value={form.motivo_consulta}
              onChange={e => update('motivo_consulta', e.target.value)}
              rows={10}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Tu nota actual se conserva hasta que la nueva esté lista.
            </p>
          </div>
        )}
        {estadoModal === 'confirmacion' && (
          <>
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-red-50" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
                <Save size={24} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-[#1d1d1f]">
                <span className="inline-block" style={{ animation: 'alertGlow 2s ease-in-out infinite' }}>
                  ¿Guardar esta nota?
                </span>
              </h3>
              <p className="text-sm text-[#3d3d3f] mt-3 leading-relaxed">
                Una vez guardada, <span className="font-bold text-red-600">no podrá modificarse</span> por motivos de seguridad y cumplimiento normativo.
                Si necesitas hacer correcciones después, podrás agregar una nota aclaratoria (addendum).
              </p>
              {sinVitalesCapturados && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 text-left">
                  ⚠ No capturaste signos vitales en esta nota.
                </p>
              )}
            </div>
            {errorModal && (
              <div className="mx-5 mb-5 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                {errorModal}
              </div>
            )}
            {/* alertGlow vivía en un <style> dentro del Portal (ya muerto) y NO
                está en globals.css. Se relocaliza aquí para no tocar globals.css
                y que el glow del título siga animando (render byte-idéntico). */}
            <style>{`
              @keyframes alertGlow {
                0%, 100% { color: #1d1d1f; }
                50% { color: #dc2626; }
              }
            `}</style>
          </>
        )}
        {estadoModal === 'exito' && (
          <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={30} className="text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-[#1d1d1f]">Nota guardada</h3>
            <p className="text-sm text-[#3d3d3f] leading-relaxed max-w-xs">
              Quedó sellada en el expediente.
            </p>
            {errorModal && (
              <div className="w-full mt-1 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
                {errorModal}
              </div>
            )}
          </div>
        )}
      </ModalShell>

      {/* Breadcrumbs + Header — ancho completo */}
      <div className="mb-5 space-y-4">
        <Breadcrumbs pacienteNombre={paciente ? `${paciente.nombre} ${paciente.apellidos}` : undefined} />
        <div className="flex items-center gap-3">
          <Link href={`/expediente/${id}`} className="text-slate-400 hover:text-slate-600">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#1a3a5c]">Nueva Nota Médica</h1>
            {paciente && (
              <p className="text-slate-500 text-sm mt-0.5">
                {paciente.nombre} {paciente.apellidos} ·{' '}
                {paciente.fecha_nacimiento ? calcularEdad(paciente.fecha_nacimiento).textoElegante : ''}
              </p>
            )}
            {consultorioActivo && (
              <p className="text-xs text-slate-500 mt-1">
                Atendiendo en: <span className="font-semibold text-[#1e5fa8]">{consultorioActivo.nombre_corto || consultorioActivo.nombre}</span>
              </p>
            )}
          </div>
        </div>

        {/* Marcador para onboarding: consulta completa (nota guardada, sin modal abierto) */}
        {notaSaved && !docInline && <div data-onboard="consulta-completa" className="hidden" />}

        {/* Banner de éxito */}
        {notaSaved && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0" />
            <p className="text-sm font-medium text-emerald-700">Nota guardada en el expediente</p>
            <Link href={`/expediente/${id}`} data-onboard="ver-expediente" className="ml-auto text-xs text-emerald-600 hover:underline whitespace-nowrap">
              Ver expediente →
            </Link>
          </div>
        )}
      </div>

      {/* ── Grid de dos columnas ── */}
      <div className="lg:grid lg:grid-cols-5 lg:gap-6 lg:items-start space-y-5 lg:space-y-0">

        {/* ════════════════════════════════
            COLUMNA IZQUIERDA (3/5)
            Formulario + nota generada
        ════════════════════════════════ */}
        <div className="lg:col-span-3 space-y-5">

          {/* Banner borrador restaurado */}
          {borradorRestaurado && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <RotateCcw size={15} className="text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-700 font-medium flex-1">Borrador restaurado — continúa donde lo dejaste</p>
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
                className="text-xs text-amber-600 hover:text-amber-800 underline"
              >
                Descartar
              </button>
            </div>
          )}

          {/* Signos vitales — visible en ambos modos (IA y manual) */}
          <SignosVitalesCard
            value={signosVitales}
            onChange={setSignosVitales}
            errores={erroresVitales}
          />

          {/* Formulario de la consulta */}
          {!notaSaved && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-700 text-sm">Cuéntame la consulta</h2>
                {modoNota === 'ia' ? (
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    Describe el caso y
                    <span className="text-[#1e5fa8] font-medium">Spinus</span> redactará la nota médica
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <PenLine size={11} className="text-slate-400" />
                    Redacta la nota clínica directamente — sin IA
                  </p>
                )}
              </div>
              {ultimoGuardado && !notaSaved && (
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-600">
                  <CheckCircle2 size={11} />
                  Borrador guardado
                </div>
              )}
            </div>

            {modoNota === 'ia' ? (
              /* ── Modo IA: input único — el médico redacta el caso completo ── */
              <div className="p-5">
                <label className="text-xs font-medium text-slate-500 block mb-1.5">
                  Descripción del caso <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <textarea
                    value={form.motivo_consulta}
                    onChange={e => update('motivo_consulta', e.target.value)}
                    disabled={generando}
                    placeholder="Ej.: Paciente con dolor lumbar de 2 semanas tras cargar peso, sin irradiación, Lasègue negativo, fuerza y reflejos normales. Indico naproxeno 500 mg cada 12 h por 7 días, ejercicios de McKenzie, cita en 2 semanas."
                    rows={10}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
                  />
                  <button
                    type="button"
                    disabled
                    title="Dictado por voz — próximamente"
                    aria-label="Dictado por voz — próximamente"
                    className="absolute bottom-3 right-3 text-slate-300 cursor-not-allowed"
                  >
                    <Mic size={18} />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  Escribe en lenguaje natural. No necesitas separar por secciones — Spinus lo hace por ti.
                </p>
              </div>
            ) : (
              /* ── Modo manual: todos los campos expandidos ── */
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">
                    Motivo de consulta / Subjetivo <span className="text-red-400">*</span>
                  </label>
                  <textarea value={form.motivo_consulta} onChange={e => update('motivo_consulta', e.target.value)}
                    placeholder="Ej: Paciente refiere cuadro de 3 días de evolución con dolor en región lumbar derecha irradiado a miembro inferior..."
                    rows={4}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">
                    Exploración física / Objetivo <span className="text-red-400">*</span>
                  </label>
                  <textarea value={form.exploracion_fisica} onChange={e => update('exploracion_fisica', e.target.value)}
                    placeholder="Ej: TA 120/80 mmHg, FC 72 lpm, FR 16 rpm, T° 36.5°C. Paciente consciente, orientado, cooperador. Abdomen blando, no doloroso a la palpación..."
                    rows={5}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">
                    Auxiliares diagnósticos <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <textarea value={form.gabinete_laboratorios} onChange={e => update('gabinete_laboratorios', e.target.value)}
                    placeholder="Ej: BH con leucocitosis leve. Rx de tórax sin infiltrados. RMN columna lumbar: hernia discal L4-L5..."
                    rows={3}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">
                    Diagnóstico(s) CIE-10 <span className="text-red-400">*</span>
                  </label>
                  <DiagnosticosEditor
                    value={form.diagnosticos}
                    onChange={dx => setForm(prev => ({ ...prev, diagnosticos: dx }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">
                    Análisis clínico <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <textarea value={form.analisis} onChange={e => update('analisis', e.target.value)}
                    placeholder="Razonamiento clínico: correlación clínico-radiológica, evolución, consideraciones..."
                    rows={3}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">
                    Plan de tratamiento <span className="text-red-400">*</span>
                  </label>
                  <textarea value={form.plan_tratamiento} onChange={e => update('plan_tratamiento', e.target.value)}
                    placeholder="Ej: Reposo relativo. Fisioterapia 2 veces por semana por 6 semanas. Restricción de cargas. Control en 4 semanas. Signos de alarma: déficit neurológico progresivo..."
                    rows={4}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
                </div>
              </div>
            )}
          </div>
          )}

          {/* ── Modo IA: error + botón generar + resultado, todo bajo el textarea ── */}
          {modoNota === 'ia' && (
            <>
              {bloqueError}
              {anclaNota ?? (!notaSaved && (
                <>
                  <button onClick={generarNota} disabled={generando || !form.motivo_consulta.trim()}
                    className="w-full py-3 bg-[#1e5fa8] text-white rounded-xl font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {generando
                      ? <><Loader2 size={18} className="animate-spin" /> Redactando nota médica...</>
                      : <><Sparkles size={18} /> Generar con Spinus</>
                    }
                  </button>
                  <button type="button"
                    onClick={() => { cancelarEntrevista(); setMedicamentos([{ ...MED_VACIA }]); modoTocadoRef.current = true; setModoNota('manual'); setNotaGenerada(''); setError('') }}
                    className="block mx-auto mt-2 text-center text-sm text-slate-500 hover:text-[#1e5fa8] transition-colors">
                    Prefiero escribirla yo
                  </button>
                </>
              ))}
            </>
          )}

          {/* ── Modo manual: error + botón previsualizar + resultado, al fondo (como hoy) ── */}
          {modoNota === 'manual' && (
            <>
              {bloqueError}
              {anclaNota ?? (!notaSaved && (
                <>
                  <button onClick={previewNotaManual} disabled={!form.motivo_consulta}
                    className="w-full py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#142d4a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    <PenLine size={18} />
                    Previsualizar nota
                  </button>
                  <button type="button"
                    onClick={() => { cancelarEntrevista(); setForm(f => ({ ...f, exploracion_fisica: '', analisis: '', gabinete_laboratorios: '', plan_tratamiento: '' })); modoTocadoRef.current = true; setModoNota('ia'); setNotaGenerada(''); setError('') }}
                    className="block mx-auto mt-2 text-center text-sm text-slate-500 hover:text-[#1e5fa8] transition-colors">
                    Usar IA
                  </button>
                </>
              ))}
            </>
          )}
        </div>

        {/* ════════════════════════════════
            COLUMNA DERECHA (2/5)
            Panel de documentos — sticky
        ════════════════════════════════ */}
        <div className="lg:col-span-2 lg:sticky lg:top-6 space-y-4">

          {/* ── Panel contextual del paciente ── */}
          {paciente && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contexto del paciente</p>
              </div>
              <div className="p-4 space-y-3">
                {/* Datos básicos */}
                <div className="flex flex-wrap gap-2">
                  {paciente.fecha_nacimiento && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                      {calcularEdad(paciente.fecha_nacimiento).textoElegante}
                    </span>
                  )}
                  {paciente.sexo && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                      {paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Femenino' : paciente.sexo}
                    </span>
                  )}
                  {paciente.peso_kg && paciente.talla_cm && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                      IMC {(paciente.peso_kg / Math.pow(paciente.talla_cm / 100, 2)).toFixed(1)}
                    </span>
                  )}
                </div>

                {/* Alergias */}
                {paciente.alergias && (
                  <div className="rounded-lg px-3 py-2" style={{ backgroundColor: '#EF5350' }}>
                    <p className="text-[10px] font-semibold text-white/80 uppercase tracking-wide mb-0.5">⚠ Alergias</p>
                    <p className="text-xs text-white font-medium">{paciente.alergias}</p>
                  </div>
                )}

                {/* Último diagnóstico */}
                {ultimaConsulta?.diagnosticos && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Último diagnóstico</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{ultimaConsulta.diagnosticos}</p>
                  </div>
                )}

                {/* Último tratamiento */}
                {ultimaConsulta?.medicamentos && ultimaConsulta.medicamentos.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Último tratamiento</p>
                    <div className="space-y-0.5">
                      {ultimaConsulta.medicamentos.slice(0, 4).map((m, i) => (
                        <p key={i} className="text-xs text-slate-600">
                          · {m.nombre} {m.dosis && <span className="text-slate-400">{m.dosis}</span>}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {!paciente.alergias && !ultimaConsulta?.diagnosticos && (
                  <p className="text-xs text-slate-400 text-center py-2">Primera consulta del paciente</p>
                )}
              </div>
            </div>
          )}

          {/* ── Panel de documentos ── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
              <FileText size={14} className="text-slate-400" />
              <h2 className="font-semibold text-slate-700 text-sm">Documentos del paciente</h2>
            </div>

            {!notaSaved ? (
              /* Estado: esperando que se guarde la nota */
              <div className="p-8 flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                  <FileText size={22} className="text-slate-300" />
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {notaGenerada
                    ? 'Guarda la nota para poder generar documentos desde aquí'
                    : 'Completa y genera la nota para activar este panel'}
                </p>
                {/* R8: una sola vía de guardado — este botón abre la revisión */}
                {notaGenerada && (
                  <button onClick={abrirRevision} disabled={guardando || !consultorioActivo}
                    className="mt-1 flex items-center gap-2 px-4 py-2 bg-[#1e5fa8] text-white rounded-lg text-xs font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-60">
                    {guardando ? <><Loader2 size={13} className="animate-spin" /> Guardando...</> : <><Save size={13} /> Revisar y guardar</>}
                  </button>
                )}
              </div>
            ) : (
              /* Estado: nota guardada — panel activo */
              <div className="p-4 space-y-3" data-onboard="panel-documentos">
                {/* Receta destacada si hay medicamentos */}
                {medicamentosParaReceta.length > 0 && (
                  <button onClick={() => setDocInline(docInline === 'receta' ? null : 'receta')}
                    className={`w-full flex items-center gap-2 py-2.5 px-3 rounded-xl border-2 text-sm font-semibold transition-all ${docInline === 'receta' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'}`}>
                    <Pill size={15} />
                    <span className="text-left leading-tight">
                      {docInline === 'receta' ? 'Cerrar receta' : `Receta médica`}
                    </span>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-normal ${docInline === 'receta' ? 'bg-white/20' : 'bg-blue-100 text-blue-600'}`}>
                      {medicamentosParaReceta.length} med.
                    </span>
                  </button>
                )}

                {/* Grid de documentos */}
                <div className="grid grid-cols-2 gap-2">
                  {DOCS.filter(d => !(d.key === 'receta' && medicamentosParaReceta.length > 0)).map(({ key, label, icon: Icon, color }) => (
                    <button key={key}
                      onClick={() => setDocInline(docInline === key ? null : key)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center text-xs font-medium leading-tight ${docInline === key ? color + ' border-current' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}>
                      <Icon size={17} />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Indicador de documento abierto */}
                {docInline && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-[#1e5fa8]/5 border border-[#1e5fa8]/20 rounded-xl text-xs text-[#1e5fa8] font-medium">
                    <FileText size={13} />
                    Editando: {DOCS.find(d => d.key === docInline)?.label}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Modal flotante de documentos (portal a body) ── */}
      {docInline && createPortal((() => {
        const currentDoc = DOCS.find(d => d.key === docInline)
        const CurrentIcon = currentDoc?.icon ?? FileText

        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8">
            {/* Backdrop con blur — cubre toda la pantalla */}
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
              onClick={() => setDocInline(null)}
            />

            {/* Ventana flotante centrada — tamaño fijo */}
            <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.2)] border border-slate-200/60 w-full max-w-3xl flex flex-col animate-[modalEnter_0.22s_cubic-bezier(0.32,0.72,0,1)]" style={{ height: '85vh' }}>
              {/* Header */}
              <div className="border-b border-slate-200/60 flex-shrink-0">
                {/* Row 1: Title + close */}
                <div className="flex items-center justify-between px-4 sm:px-5 pt-3 pb-2 sm:pb-3">
                  <div key={`header-${slideKey}`} className="flex items-center gap-2 sm:gap-2.5 min-w-0" style={slideKey > 0 ? { animation: 'docTitleIn 0.35s cubic-bezier(0.32, 0.72, 0, 1)' } : undefined}>
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${currentDoc?.color.split(' ').slice(1, 3).join(' ') ?? 'bg-slate-50'}`}>
                      <CurrentIcon size={15} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-semibold text-slate-800 truncate">{currentDoc?.label}</h3>
                      <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">{nombrePaciente}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDocInline(null)}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 active:scale-95 transition-all flex-shrink-0 ml-2"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Row 2: Document type icons */}
                <div className="px-4 sm:px-5 pb-2.5 -mt-0.5">
                  <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide" data-onboard="modal-doc-iconos">
                    {DOCS.map(({ key, label, icon: Icon, color }) => {
                      const isActive = key === docInline
                      const colorClasses = color.split(' ')
                      const bgClass = isActive ? colorClasses.slice(1, 3).join(' ') : 'bg-transparent'
                      const textClass = isActive ? colorClasses[3] ?? 'text-slate-700' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                      return (
                        <button
                          key={key}
                          onClick={() => setDocInline(key)}
                          title={label}
                          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all duration-150 flex-shrink-0 ${bgClass} ${textClass} ${isActive ? 'ring-1 ring-current/20 shadow-sm' : ''}`}
                        >
                          <Icon size={14} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Contenido scrolleable — height fijo, slide animation */}
              <div className="doc-modal-scroll flex-1 overflow-y-auto overflow-x-hidden relative">
                <div
                  key={slideKey}
                  className="p-4 sm:p-6 min-h-full"
                  style={slideKey > 0 ? { animation: `${slideDir === 'right' ? 'slideFromRight' : 'slideFromLeft'} 0.3s cubic-bezier(0.32, 0.72, 0, 1)` } : undefined}
                >
                  {docInline === 'receta' && (
                    <RecetaFormDynamic pacienteInicial={nombrePaciente} diagnosticoInicial={formatDiagnosticosInline(form.diagnosticos)} pacienteId={id} medicamentosIniciales={medicamentosParaReceta} />
                  )}
                  {docInline === 'lab' && (
                    <SolicitudLabFormDynamic pacienteInicial={nombrePaciente} diagnosticoInicial={formatDiagnosticosInline(form.diagnosticos)} pacienteId={id} />
                  )}
                  {docInline === 'imagen' && (
                    <SolicitudImagenFormDynamic pacienteInicial={nombrePaciente} diagnosticoInicial={formatDiagnosticosInline(form.diagnosticos)} pacienteId={id} />
                  )}
                  {docInline === 'suplementacion' && (
                    <PlanSupFormDynamic pacienteInicial={nombrePaciente} diagnosticoInicial={formatDiagnosticosInline(form.diagnosticos)} pacienteId={id} />
                  )}
                  {docInline === 'internamiento' && (
                    <InternamientoFormDynamic pacienteInicial={nombrePaciente} diagnosticoInicial={formatDiagnosticosInline(form.diagnosticos)} pacienteId={id} />
                  )}
                  {docInline === 'escrito' && (
                    <EscritoFormDynamic pacienteInicial={nombrePaciente} pacienteId={id} />
                  )}
                  {docInline === 'consentimiento' && (
                    <ConsentimientoFormDynamic pacienteInicial={nombrePaciente} diagnosticoInicial={formatDiagnosticosInline(form.diagnosticos)} pacienteId={id} />
                  )}
                  {docInline === 'honorarios' && (
                    <HonorariosFormDynamic pacienteInicial={nombrePaciente} pacienteId={id} />
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })(), document.body)}
    </div>
  )
}
