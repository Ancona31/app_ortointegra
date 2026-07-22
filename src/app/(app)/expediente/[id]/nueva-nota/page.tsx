'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Portal from '@/components/ui/Portal'
import ModalShell from '@/components/ui/ModalShell'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Paciente, Diagnostico, MedicamentoConsulta, SignosVitales } from '@/types'
import type { MedicamentoIA, BloqueIA, NotaIAResponse } from '@/lib/notaIA/schema'
import { calcularEdad } from '@/lib/patientUtils'
import { flushSync } from 'react-dom'
import {
  ArrowLeft, Save, Loader2, RotateCcw, Printer, Eye, Pencil,
  Pill, FlaskConical, ScanLine, ClipboardList, CheckCircle2,
  BedDouble, PenLine, ShieldCheck, Receipt, Plus, Trash2, X, FileText,
  ChevronLeft, ChevronRight, ChevronDown, Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import { imprimirOCompartir } from '@/lib/mobileShare'
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

type MedicoInfo = {
  nombre: string; especialidad: string; cedula_profesional: string
  cedula_especialidad: string; logo_url: string | null
  color_primario: string; color_secundario: string
  direccion_consultorio: string; telefono_consultorio: string
}

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
  const [medCache, setMedCache]         = useState<string[]>([])
  const [showSuggest, setShowSuggest]   = useState<number | null>(null)

  const [modoNota, setModoNota]         = useState<'ia' | 'manual'>('ia')
  const [notaGenerada, setNotaGenerada] = useState('')
  const [bloquesEntrevista, setBloquesEntrevista]     = useState<BloqueIA[]>([])
  const [historialEntrevista, setHistorialEntrevista] = useState<{ rol: 'user' | 'model'; texto: string }[]>([])
  const [respuestasEntrevista, setRespuestasEntrevista] = useState<Record<string, string>>({})
  const [bloqueActual, setBloqueActual] = useState(0)
  const [modoEdicion, setModoEdicion]   = useState(false)
  const [pronosticoExpandido, setPronosticoExpandido] = useState(false)
  const [generando, setGenerando]       = useState(false)
  const [guardando, setGuardando]       = useState(false)
  const [imprimiendo, setImprimiendo]   = useState(false)
  const [error, setError]               = useState('')
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
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

  const suggestRef  = useRef<HTMLDivElement>(null)
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const formRef = useRef(form)
  useEffect(() => { formRef.current = form }, [form])


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
    // Cargar medicamentos frecuentes y borrador (cifrados en secureStorage)
    secureStorage.get<{ nombre: string; count: number }[]>('med-frecuentes').then(data => {
      if (data) setMedCache(data.sort((a, b) => b.count - a.count).map(d => d.nombre))
    }).catch(() => {})
    // Tipo laxo del draft para tolerar formato viejo (diagnosticos: string + complementoDx).
    type DraftForm = Partial<Omit<typeof EMPTY_FORM, 'diagnosticos'>> & {
      diagnosticos?: string | Diagnostico[]
      complementoDx?: string
    }
    type DraftPayload = { form?: DraftForm; medicamentos?: typeof medicamentos; signosVitales?: SignosVitalesForm; complementoDx?: string }
    secureStorage.get<DraftPayload>(`nota-draft-${id}`).then(parsed => {
      if (!parsed?.form) return
      // Guard anti-race: si la promesa resolvió DESPUÉS de que el usuario
      // empezó a teclear en cualquiera de los 8 campos, descartar el borrador
      // para no sobrescribir entrada clínica viva.
      const current = formRef.current
      const vacio = Object.values(current).every(v => Array.isArray(v) ? v.length === 0 : !v)
      if (!vacio) return
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
      const tieneDatos = form.motivo_consulta || form.diagnosticos.length > 0 || form.exploracion_fisica
      if (!tieneDatos) return
      secureStorage.set(draftKey, { form, medicamentos, signosVitales }).then(() => {
        setUltimoGuardado(new Date())
      })
    }, 1500)
    return () => { if (autosaveRef.current) clearTimeout(autosaveRef.current) }
  }, [form, medicamentos, signosVitales, notaSaved])

  // Cerrar autocomplete al hacer clic fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setShowSuggest(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Entrevista: al recibir un set nuevo de preguntas (o limpiarlas), volver al
  // primer bloque. Mantiene la lógica del sub-paso A intacta.
  useEffect(() => { setBloqueActual(0) }, [bloquesEntrevista])

  // ── Helpers de medicamentos ───────────────────────────────────
  function getSuggestions(query: string): string[] {
    if (!query.trim()) return medCache.slice(0, 6)
    return medCache.filter(n => n.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
  }

  async function saveMedCache(meds: MedicamentoConsulta[]) {
    try {
      const nombres = meds.filter(m => m.nombre.trim()).map(m => m.nombre.trim())
      if (!nombres.length) return
      const existing = await secureStorage.get<{ nombre: string; count: number }[]>('med-frecuentes')
      const data = existing ?? []
      nombres.forEach(nombre => {
        const idx = data.findIndex(d => d.nombre.toLowerCase() === nombre.toLowerCase())
        if (idx >= 0) data[idx].count++
        else data.push({ nombre, count: 1 })
      })
      await secureStorage.set('med-frecuentes', data)
      setMedCache(data.sort((a, b) => b.count - a.count).map(d => d.nombre))
    } catch {}
  }

  function updateMed(i: number, field: keyof MedicamentoConsulta, val: string) {
    setMedicamentos(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m))
  }

  function addMed() {
    setMedicamentos(prev => [...prev, { ...MED_VACIA }])
  }

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

  function mapearErrorIA(e: unknown) {
    const msg = (e instanceof Error ? e.message : '').toLowerCase()
    if (msg.includes('timeout') || msg.includes('deadline'))
      setError('La IA tardó demasiado en responder. Intenta de nuevo en unos segundos.')
    else if (msg.includes('rate') || msg.includes('quota') || msg.includes('429'))
      setError('Se alcanzó el límite de uso de la IA. Espera un minuto e intenta de nuevo.')
    else if (msg.includes('network') || msg.includes('fetch'))
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
    else
      setError('No se pudo generar la nota. Intenta de nuevo o escríbela manualmente.')
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
  }

  // ── Generar nota con Gemini (turno 1) ─────────────────────────
  async function generarNota() {
    if (!form.motivo_consulta.trim()) { setError('Describe el caso antes de generar la nota'); return }
    setGenerando(true); setError('')
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
      const rawText = await res.text()
      const data = JSON.parse(rawText) as NotaIAResponse & { error?: string }
      if (data.error) throw new Error(data.error)
      if (data.status === 'faltan_datos') {
        // Entrevista turno 1: guardar preguntas e iniciar el historial crudo.
        setNotaGenerada('')
        setBloquesEntrevista(Array.isArray(data.bloques) ? data.bloques : [])
        setHistorialEntrevista([
          { rol: 'user', texto: form.motivo_consulta },
          { rol: 'model', texto: rawText },
        ])
        setRespuestasEntrevista({})
      } else {
        aplicarNotaCompleta(data)
      }
    } catch (e: unknown) {
      mapearErrorIA(e)
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
    if (partes.length === 0) { setError('Responde al menos una pregunta antes de enviar.'); return }
    const mensaje = partes.join('\n')
    setGenerando(true); setError('')
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
      const rawText = await res.text()
      const data = JSON.parse(rawText) as NotaIAResponse & { error?: string }
      if (data.error) throw new Error(data.error)
      if (data.status === 'faltan_datos') {
        // La IA pide más: acumular el turno y mostrar las nuevas preguntas.
        setNotaGenerada('')
        setHistorialEntrevista(prev => [
          ...prev,
          { rol: 'user', texto: mensaje },
          { rol: 'model', texto: rawText },
        ])
        setBloquesEntrevista(Array.isArray(data.bloques) ? data.bloques : [])
        setRespuestasEntrevista({})
      } else {
        aplicarNotaCompleta(data)
      }
    } catch (e: unknown) {
      mapearErrorIA(e)
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
  }

  // ── Previsualizar nota en modo manual ─────────────────────────
  function previewNotaManual() {
    if (!form.motivo_consulta) { setError('Ingresa al menos el motivo de consulta'); return }
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
  }

  // ── Validar y mostrar confirmación antes de guardar ───────────
  function intentarGuardar() {
    if (modoNota === 'manual') {
      // NOM-004-SSA3: en modo manual el médico captura a mano → 4 obligatorios
      const faltantes: string[] = []
      if (!form.motivo_consulta.trim()) faltantes.push('Motivo de consulta')
      if (!form.exploracion_fisica.trim()) faltantes.push('Exploración física')
      if (form.diagnosticos.length === 0 || !form.diagnosticos.some(d => d.descripcion?.trim())) {
        faltantes.push('Diagnóstico')
      }
      if (!form.plan_tratamiento.trim()) faltantes.push('Plan de tratamiento')
      if (faltantes.length > 0) {
        setError(`Campos obligatorios: ${faltantes.join(', ')}`)
        return
      }
    } else {
      // Modo IA: exploración física y plan van DENTRO de la narrativa; el dx puede
      // no venir como bloqueo. Solo validamos lo mínimo: el caso y que haya nota.
      if (!form.motivo_consulta.trim()) { setError('Describe el caso antes de guardar.'); return }
      if (!notaGenerada.trim()) { setError('Genera la nota antes de guardar.'); return }
    }
    // Fase 3: si hay AL MENOS un signo vital capturado, fc es obligatoria (>0)
    // y todos los capturados deben caer dentro de los límites fisiológicos duros.
    // El semáforo clínico (vigilar/fuera) NUNCA bloquea; esto sí.
    const svValidar = construirSignosVitalesPayload(signosVitales)
    if (svValidar) {
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
        return
      }
      setErroresVitales(new Set())
    }
    // Si el médico marcó "No mostrar de nuevo", guardar directo
    const skipModal = localStorage.getItem('spinus_skip_confirm_nota') === '1'
    if (skipModal) {
      guardar()
    } else {
      setMostrarConfirmacion(true)
    }
  }

  // ── Guardar nota ──────────────────────────────────────────────
  async function guardar() {
    setMostrarConfirmacion(false)
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

        setError(data.message || data.error || 'No se pudo guardar la nota.')
        setGuardando(false)
        return
      }

      saveMedCache(medsConDatos)
      secureStorage.remove(draftKey)
      setNotaSaved(true)
      setDocInline(null)
    } catch {
      setError("Error de conexion. Verifica tu internet e intenta de nuevo.")
    }

    setGuardando(false)
  }

  // ── Imprimir nota ─────────────────────────────────────────────
  async function imprimir() {
    if (!paciente) return
    flushSync(() => setImprimiendo(true))
    try {
      const ahora = new Date()
      const edad = paciente.fecha_nacimiento
        ? calcularEdad(paciente.fecha_nacimiento).anios : null
      const fechaHora = ahora.toLocaleString('es-MX', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
      })
      const cp = medicoInfo?.color_primario || '#1a3a5c'
      const cs = medicoInfo?.color_secundario || '#1e5fa8'
      const doctorNombre = medicoInfo?.nombre || 'Médico'
      const cedProf  = medicoInfo?.cedula_profesional || ''
      const cedEsp   = medicoInfo?.cedula_especialidad || ''
      const direccion = medicoInfo?.direccion_consultorio || ''
      const telefono  = medicoInfo?.telefono_consultorio || ''
      // Logo: usar URL directa si es https (el browser sí puede cargarla en window.open)
      // Fallback: logo genérico local
      const logoUrl   = medicoInfo?.logo_url && medicoInfo.logo_url.startsWith('https://')
        ? medicoInfo.logo_url : '/logo.png'

      const notaParaImprimir = notaGenerada
        + (form.pronostico.trim() ? `\n\n**[PRONÓSTICO]:**\n${form.pronostico.trim()}` : '')

      function notaToHtml(texto: string): string {
        const lines = texto.split('\n')
        let html = ''
        const sectionRe = /^\*{1,2}\[([^\]]+)\]:?\*{0,2}\s*(.*)?$/
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) { html += '<div style="height:5px"></div>'; continue }
          const hasBracket = /\[[^\]]+\]/.test(trimmed)
          const secMatch = hasBracket ? trimmed.match(sectionRe) : null
          if (secMatch) {
            html += `<div class="seccion-header"><div class="seccion-linea"></div><div class="seccion-titulo">${secMatch[1]}</div><div class="seccion-linea"></div></div>`
            if (secMatch[2]?.trim()) {
              const contenido = secMatch[2].trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              html += `<p>${contenido}</p>`
            }
            continue
          }
          const contenido = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          html += `<p>${contenido}</p>`
        }
        return html
      }

      const notaHtml = notaToHtml(notaParaImprimir)

      const _html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Nota Médica — ${paciente.nombre} ${paciente.apellidos}</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: letter; margin: 0; }
  body { font-family: 'Roboto', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; position: relative; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-25deg); width: 320px; height: 320px; object-fit: contain; opacity: 0.05; pointer-events: none; z-index: 0; }
  .barra-top { background: linear-gradient(135deg, ${cp} 0%, ${cs} 100%); height: 12px; width: 100%; }
  .contenido { padding: 12mm 18mm 10mm; position: relative; z-index: 1; }
  .header { display: flex; align-items: center; gap: 18px; padding-bottom: 12px; margin-bottom: 12px; border-bottom: 2px solid ${cp}; }
  .logo-wrap { width: 72px; height: 72px; border-radius: 50%; border: 3px solid ${cs}; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #f8fafc; }
  .logo { width: 100%; height: 100%; object-fit: contain; }
  .header-info { flex: 1; }
  .doctor-name { font-size: 14pt; font-weight: bold; color: ${cp}; line-height: 1.2; }
  .especialidad { font-size: 9pt; color: ${cs}; margin: 3px 0; font-style: italic; }
  .credenciales { font-size: 8pt; color: #666; }
  .contacto { font-size: 7.5pt; color: #888; margin-top: 3px; }
  .titulo-sub { font-size: 7.5pt; color: #aaa; text-align: right; }
  .datos-box { background: linear-gradient(135deg, ${cp}08, ${cs}08); border-left: 4px solid ${cs}; border-radius: 0 6px 6px 0; padding: 9px 14px; margin-bottom: 14px; }
  .datos-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px 20px; }
  .dato { display: flex; gap: 6px; align-items: baseline; font-size: 9pt; }
  .dato-label { font-weight: bold; color: ${cp}; white-space: nowrap; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.3px; }
  .dato-valor { flex: 1; border-bottom: 1px solid #d1d5db; padding-bottom: 1px; }
  .seccion-header { display: flex; align-items: center; gap: 8px; margin: 13px 0 6px; }
  .seccion-linea { flex: 1; height: 1px; background: linear-gradient(to right, ${cp}, transparent); }
  .seccion-titulo { font-size: 7.5pt; font-weight: bold; color: ${cp}; text-transform: uppercase; letter-spacing: 1.5px; background: ${cp}12; padding: 3px 10px; border-radius: 20px; white-space: nowrap; }
  .titulo-nota { background: linear-gradient(135deg, ${cp} 0%, ${cs} 100%); color: #fff; text-align: center; font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; padding: 8px 0; border-radius: 4px; margin-bottom: 14px; }
  .nota-content { font-size: 9.5pt; line-height: 1.6; color: #2d2d2d; text-align: justify; }
  .nota-content p { margin-bottom: 3px; }
  .nota-content strong { font-weight: 600; color: #111; }
  .fecha-box { margin-top: 12px; background: ${cs}10; border-left: 3px solid ${cs}; border-radius: 0 4px 4px 0; padding: 6px 12px; font-size: 9pt; }
  /* Firma */
  .footer-area { margin-top: 60px; display: flex; justify-content: flex-end; }
  .firma { text-align: center; min-width: 240px; }
  .firma-space { height: 60px; }
  .firma-linea { border-top: 1.5px solid ${cp}; }
  .firma-nombre { font-weight: bold; font-size: 9.5pt; color: ${cp}; margin-top: 6px; }
  .firma-ced { font-size: 8pt; color: #666; margin-top: 2px; }
  .barra-bottom { background: linear-gradient(135deg, ${cp} 0%, ${cs} 100%); height: 8px; width: 100%; margin-top: 16px; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  <img class="watermark" src="${logoUrl}" onerror="this.style.display='none'" />
  <div class="barra-top"></div>
  <div class="contenido">
    <div class="header">
      <div class="logo-wrap"><img class="logo" src="${logoUrl}" onerror="this.style.display='none'" /></div>
      <div class="header-info">
        <div class="doctor-name">${doctorNombre}</div>
        ${medicoInfo?.especialidad ? `<div class="especialidad">${medicoInfo.especialidad}</div>` : ''}
        <div class="credenciales">${cedProf ? `Cédula Prof.: ${cedProf}` : ''}${cedProf && cedEsp ? ' &nbsp;·&nbsp; ' : ''}${cedEsp ? `Cédula Esp.: ${cedEsp}` : ''}</div>
        ${direccion || telefono ? `<div class="contacto">${[direccion, telefono ? `Tel: ${telefono}` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>` : ''}
      </div>
      <div class="titulo-sub">${fechaHora}</div>
    </div>
    <div class="datos-box">
      <div class="datos-grid">
        <div class="dato"><span class="dato-label">Paciente</span><span class="dato-valor">${paciente.nombre} ${paciente.apellidos}</span></div>
        <div class="dato"><span class="dato-label">Edad</span><span class="dato-valor">${edad !== null ? edad + ' años' : '—'}</span></div>
        <div class="dato"><span class="dato-label">Sexo</span><span class="dato-valor">${paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Femenino' : '—'}</span></div>
        ${paciente.peso_kg ? `<div class="dato"><span class="dato-label">Peso</span><span class="dato-valor">${paciente.peso_kg} kg</span></div>` : ''}
        ${paciente.talla_cm ? `<div class="dato"><span class="dato-label">Talla</span><span class="dato-valor">${paciente.talla_cm} cm</span></div>` : ''}
      </div>
    </div>
    <div class="titulo-nota">Nota de Evolución Médica</div>
    <div class="nota-content">${notaHtml}</div>
    ${form.proxima_cita ? `<div class="fecha-box"><strong>Próxima cita:</strong> ${form.proxima_cita}</div>` : ''}
    <div class="footer-area">
      <div class="firma">
        <div class="firma-space"></div>
        <div class="firma-linea"></div>
        <div class="firma-nombre">${doctorNombre}</div>
        ${cedProf ? `<div class="firma-ced">Céd. Prof. ${cedProf}</div>` : ''}
        ${cedEsp ? `<div class="firma-ced">Céd. Esp. ${cedEsp}</div>` : ''}
      </div>
    </div>
  </div>
  <div class="barra-bottom"></div>
</body>
</html>`

      await imprimirOCompartir(_html, 'nota-medica.pdf')
    } finally {
      setImprimiendo(false)
    }
  }

  // ── Medicamentos → formato RecetaForm ─────────────────────────
  const medicamentosParaReceta: MedicamentoConVia[] = medicamentos
    .filter(m => m.nombre.trim())
    .map(m => ({
      nombre_comercial: m.nombre,
      presentacion: '',
      dosis: m.dosis,
      principio_activo: '',
      indicacion: [m.frecuencia, m.duracion].filter(Boolean).join(' · '),
      via_administracion: 'Oral',
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

  const panelResultado = notaGenerada ? (
    <>
      {/* Nota generada / previsualizada */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-700 text-sm">Nota médica</h2>
              {modoNota === 'ia' ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#1e5fa8]/10 text-[#1e5fa8] border border-[#1e5fa8]/20">
                  <Sparkles size={9} />
                  Nota IA
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                  <PenLine size={9} />
                  Nota manual
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {modoEdicion ? 'Editando texto' : 'Vista previa — haz clic en Editar para modificar'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setModoEdicion(!modoEdicion)}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${modoEdicion ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300'}`}>
              {modoEdicion ? <><Eye size={12} /> Vista previa</> : <><Pencil size={12} /> Editar</>}
            </button>
            <button
              onClick={modoNota === 'ia' ? generarNota : previewNotaManual}
              disabled={generando || !form.motivo_consulta.trim()}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 px-2 py-1 disabled:opacity-40">
              <RotateCcw size={12} /> {modoNota === 'ia' ? 'Regenerar' : 'Actualizar'}
            </button>
          </div>
        </div>
        <div className="p-5">
          {modoEdicion ? (
            <textarea value={notaGenerada} onChange={e => setNotaGenerada(e.target.value)} rows={22}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 resize-y" />
          ) : (
            <div className="prose prose-sm max-w-none prose-headings:text-[#1a3a5c] prose-headings:font-bold prose-headings:text-sm prose-headings:mt-4 prose-headings:mb-1 prose-strong:text-[#1a3a5c] prose-strong:font-semibold prose-p:text-slate-700 prose-p:leading-relaxed prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-li:text-slate-700">
              <ReactMarkdown>{notaGenerada}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      {/* Acciones imprimir / guardar */}
      <div className="flex gap-3 pb-6">
        <button onClick={imprimir} disabled={imprimiendo}
          className="flex items-center gap-2 px-5 py-2.5 border-2 border-[#1a3a5c] text-[#1a3a5c] rounded-lg text-sm font-medium hover:bg-[#1a3a5c] hover:text-white transition-colors disabled:opacity-50">
          {imprimiendo ? <><Loader2 size={16} className="animate-spin" /> Generando...</> : <><Printer size={16} /> Imprimir</>}
        </button>
        <button onClick={intentarGuardar} disabled={guardando || !consultorioActivo}
          className="flex-1 flex items-center justify-center gap-2 bg-[#1e5fa8] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-60">
          {guardando ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : <><Save size={16} /> Guardar en expediente</>}
        </button>
      </div>
    </>
  ) : null

  // ── Render ────────────────────────────────────────────────────
  // Aviso suave (no bloquea): la nota se guardará sin signos vitales.
  const sinVitalesCapturados = construirSignosVitalesPayload(signosVitales) === undefined
  return (
    <div className="max-w-7xl mx-auto">

      {/* Modal de confirmación antes de guardar — inmutabilidad NOM-004 */}
      {mostrarConfirmacion && (
        <Portal>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
              <div className="px-6 pt-6 pb-4 text-center">
                <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-red-50" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
                  <Save size={24} className="text-red-500" />
                </div>
                <h2 className="text-lg font-bold text-[#1d1d1f]">
                  <span className="inline-block" style={{ animation: 'alertGlow 2s ease-in-out infinite' }}>
                    ¿Guardar esta nota?
                  </span>
                </h2>
                <p className="text-sm text-[#3d3d3f] mt-3 leading-relaxed">
                  Una vez guardada, <span className="font-bold text-red-600">no podrá modificarse</span> por motivos de seguridad y cumplimiento normativo.
                  Si necesitas hacer correcciones después, podrás agregar una nota aclaratoria (addendum).
                </p>
                {sinVitalesCapturados && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 text-left">
                    ⚠ No capturaste signos vitales en esta nota.
                  </p>
                )}
                <label className="flex items-center justify-center gap-2 mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    onChange={e => {
                      if (e.target.checked) localStorage.setItem('spinus_skip_confirm_nota', '1')
                      else localStorage.removeItem('spinus_skip_confirm_nota')
                    }}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-[#1e5fa8]"
                  />
                  <span className="text-xs text-slate-400">No mostrar de nuevo</span>
                </label>
              </div>
              <div className="border-t border-slate-100 grid grid-cols-2">
                <button
                  onClick={() => setMostrarConfirmacion(false)}
                  className="px-4 py-3.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors border-r border-slate-100"
                >
                  Revisar nota
                </button>
                <button
                  onClick={guardar}
                  disabled={!consultorioActivo}
                  className="px-4 py-3.5 text-sm font-bold text-[#1e5fa8] hover:bg-blue-50 transition-colors disabled:opacity-40"
                >
                  Guardar nota
                </button>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes alertGlow {
              0%, 100% { color: #1d1d1f; }
              50% { color: #dc2626; }
            }
          `}</style>
        </Portal>
      )}

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

          {/* Selector de modo */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-1.5 flex gap-1">
            <button
              type="button"
onClick={() => { setModoNota('ia'); setNotaGenerada(''); setError('') }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
modoNota === 'ia'
                    ? 'bg-[#1e5fa8]/10 text-[#1e5fa8] border border-[#1e5fa8]/30 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Sparkles size={14} className="flex-shrink-0" />
              Crear nota con IA
            </button>
            <button
              type="button"
              onClick={() => { setModoNota('manual'); setNotaGenerada(''); setError('') }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                modoNota === 'manual'
                  ? 'bg-slate-100 text-[#1a3a5c] border border-slate-300 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <PenLine size={14} className="flex-shrink-0" />
              Crear nota manual
            </button>
          </div>

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
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-700 text-sm">Datos de la consulta</h2>
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
                <textarea
                  value={form.motivo_consulta}
                  onChange={e => update('motivo_consulta', e.target.value)}
                  placeholder="Describe el caso con tus palabras: motivo de consulta, hallazgos de la exploración, estudios, impresión diagnóstica y plan. Spinus estructurará la nota a partir de lo que escribas."
                  rows={10}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
                />
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

          {/* ── Modo IA: error + botón generar + resultado, todo bajo el textarea ── */}
          {modoNota === 'ia' && (
            <>
              {bloqueError}
              <button onClick={generarNota} disabled={generando || !form.motivo_consulta.trim()}
                className="w-full py-3 bg-[#1e5fa8] text-white rounded-xl font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {generando
                  ? <><Loader2 size={18} className="animate-spin" /> Redactando nota médica...</>
                  : <><Sparkles size={18} /> Generar con Spinus</>
                }
              </button>
              <ModalShell
                open={bloquesEntrevista.length > 0}
                onClose={cancelarEntrevista}
                title="Spinus necesita más información"
                subtitle="Responde para completar la nota"
                icon={<Sparkles size={15} className="text-[#1e5fa8]" />}
                iconBg="bg-[#1e5fa8]/10"
                footer={
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
                }
              >
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
              </ModalShell>
              {panelResultado}
            </>
          )}

          {/* Terapéutica empleada */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <h2 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                <Pill size={14} className="text-blue-500" />
                Terapéutica empleada
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Se imprime en la nota y pre-carga la receta</p>
            </div>
            <div className="p-4 space-y-2" ref={suggestRef}>
              <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-1 mb-1">
                <span className="col-span-4 text-xs font-medium text-slate-400 uppercase tracking-wide">Medicamento</span>
                <span className="col-span-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Dosis</span>
                <span className="col-span-2 text-xs font-medium text-slate-400 uppercase tracking-wide">Frecuencia</span>
                <span className="col-span-2 text-xs font-medium text-slate-400 uppercase tracking-wide">Duración</span>
                <span className="col-span-1" />
              </div>
              {medicamentos.map((med, i) => {
                const suggestions = getSuggestions(med.nombre)
                const mostrarSuggest = showSuggest === i && suggestions.length > 0
                return (
                  <div key={i} className="grid grid-cols-2 sm:grid-cols-12 gap-2 relative">
                    <div className="col-span-2 sm:col-span-4 relative">
                      <input type="text" value={med.nombre}
                        onChange={e => updateMed(i, 'nombre', e.target.value)}
                        onFocus={() => setShowSuggest(i)}
                        placeholder="Ej: Ketorolaco"
                        className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
                      {mostrarSuggest && (
                        <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 overflow-hidden">
                          {suggestions.map(s => (
                            <button key={s} type="button"
                              onMouseDown={() => { updateMed(i, 'nombre', s); setShowSuggest(null) }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input type="text" value={med.dosis} onChange={e => updateMed(i, 'dosis', e.target.value)}
                      placeholder="Dosis" className="col-span-1 sm:col-span-3 px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
                    <input type="text" value={med.frecuencia} onChange={e => updateMed(i, 'frecuencia', e.target.value)}
                      placeholder="Frecuencia" className="col-span-1 sm:col-span-2 px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
                    <input type="text" value={med.duracion} onChange={e => updateMed(i, 'duracion', e.target.value)}
                      placeholder="Duración" className="col-span-1 sm:col-span-2 px-2.5 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
                    <button type="button" onClick={() => removeMed(i)}
                      className="col-span-1 sm:col-span-1 flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )
              })}
              {medicamentos.every(m => !m.nombre.trim()) && (
                <p className="text-xs text-slate-400 text-center py-2">Sin medicamentos — usa el botón “Agregar” o comienza a escribir</p>
              )}
              <div className="pt-1">
                <button type="button" onClick={addMed}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#1e5fa8] hover:text-[#1a3a5c] transition-colors">
                  <Plus size={14} /> Agregar medicamento
                </button>
              </div>
            </div>
          </div>

          {/* Pronóstico y próxima cita — colapsable, colapsado por defecto */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setPronosticoExpandido(e => !e)}
              className={`w-full flex items-center justify-between px-5 py-3 bg-slate-50 text-left hover:bg-slate-100 transition-colors ${pronosticoExpandido ? 'border-b border-slate-100' : ''}`}
            >
              <h2 className="font-semibold text-slate-700 text-sm">
                Pronóstico y seguimiento <span className="text-slate-400 font-normal">(opcional)</span>
              </h2>
              <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${pronosticoExpandido ? 'rotate-180' : ''}`} />
            </button>
            {pronosticoExpandido && (
              <div className="p-5 space-y-4">
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
            )}
          </div>

          {/* ── Modo manual: error + botón previsualizar + resultado, al fondo (como hoy) ── */}
          {modoNota === 'manual' && (
            <>
              {bloqueError}
              <button onClick={previewNotaManual} disabled={!form.motivo_consulta}
                className="w-full py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#142d4a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                <PenLine size={18} />
                Previsualizar nota
              </button>
              {panelResultado}
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
                {notaGenerada && (
                  <button onClick={intentarGuardar} disabled={guardando || !consultorioActivo}
                    className="mt-1 flex items-center gap-2 px-4 py-2 bg-[#1e5fa8] text-white rounded-lg text-xs font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-60">
                    {guardando ? <><Loader2 size={13} className="animate-spin" /> Guardando...</> : <><Save size={13} /> Guardar nota</>}
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
