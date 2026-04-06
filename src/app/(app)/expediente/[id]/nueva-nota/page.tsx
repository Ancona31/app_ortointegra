'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Paciente } from '@/types'
import { differenceInYears, parseISO } from 'date-fns'
import { flushSync } from 'react-dom'
import {
  ArrowLeft, Save, Loader2, RotateCcw, Printer, Eye, Pencil,
  Pill, FlaskConical, ScanLine, ClipboardList, CheckCircle2,
  BedDouble, PenLine, ShieldCheck, Receipt, Plus, Trash2, X, FileText, ChevronDown,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import ConsultaRapida from '@/components/ConsultaRapida'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import { imprimirOCompartir } from '@/lib/mobileShare'
import dynamic from 'next/dynamic'

const RecetaFormDynamic       = dynamic(() => import('@/components/documentos/RecetaForm'), { ssr: false, loading: () => <FormCargando /> })
const SolicitudLabFormDynamic = dynamic(() => import('@/components/documentos/SolicitudLabForm'), { ssr: false, loading: () => <FormCargando /> })
const SolicitudImagenFormDynamic = dynamic(() => import('@/components/documentos/SolicitudImagenForm'), { ssr: false, loading: () => <FormCargando /> })
const PlanSupFormDynamic      = dynamic(() => import('@/components/documentos/PlanSuplementacionForm'), { ssr: false, loading: () => <FormCargando /> })
const InternamientoFormDynamic = dynamic(() => import('@/components/documentos/SolicitudInternamientoForm'), { ssr: false, loading: () => <FormCargando /> })
const EscritoFormDynamic      = dynamic(() => import('@/components/documentos/EscritoMedicoForm'), { ssr: false, loading: () => <FormCargando /> })
const ConsentimientoFormDynamic = dynamic(() => import('@/components/documentos/ConsentimientoInformadoForm'), { ssr: false, loading: () => <FormCargando /> })
const HonorariosFormDynamic   = dynamic(() => import('@/components/documentos/NotaHonorariosForm'), { ssr: false, loading: () => <FormCargando /> })

function FormCargando() {
  return (
    <div className="flex items-center justify-center py-12 text-slate-400">
      <Loader2 size={20} className="animate-spin mr-2" />
      <span className="text-sm">Cargando formulario...</span>
    </div>
  )
}

type MedicoInfo = {
  nombre: string; especialidad: string; cedula_profesional: string
  cedula_especialidad: string; logo_url: string | null
  color_primario: string; color_secundario: string
  direccion_consultorio: string; telefono_consultorio: string
}

type MedRow = { nombre: string; dosis: string; frecuencia: string; duracion: string }
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

const MED_VACIA: MedRow = { nombre: '', dosis: '', frecuencia: '', duracion: '' }

export default function NuevaNotaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [medicoInfo, setMedicoInfo] = useState<MedicoInfo | null>(null)
  const [paciente, setPaciente]     = useState<Paciente | null>(null)

  const [form, setForm] = useState({
    motivo_consulta: '', exploracion_fisica: '', diagnosticos: '',
    pronostico: '', plan_tratamiento: '', gabinete_laboratorios: '', proxima_cita: '',
  })
  const [medicamentos, setMedicamentos] = useState<MedRow[]>([{ ...MED_VACIA }])
  const [medCache, setMedCache]         = useState<string[]>([])
  const [showSuggest, setShowSuggest]   = useState<number | null>(null)

  const [notaGenerada, setNotaGenerada] = useState('')
  const [modoEdicion, setModoEdicion]   = useState(false)
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
  const [ultimaConsulta, setUltimaConsulta] = useState<{ diagnosticos: string; medicamentos: MedRow[] | null } | null>(null)
  const [camposExpandidos, setCamposExpandidos] = useState<Record<string, boolean>>({
    exploracion: false, gabinete: false, plan: false,
  })
  function toggleCampo(k: string) { setCamposExpandidos(p => ({ ...p, [k]: !p[k] })) }

  const suggestRef  = useRef<HTMLDivElement>(null)
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Carga datos + borrador ────────────────────────────────────
  const draftKey = `nota-draft-${id}`

  useEffect(() => {
    fetch('/api/me/perfil-medico').then(r => r.json()).then(({ medico }) => setMedicoInfo(medico))
    const supabase = createClient()
    supabase.from('pacientes').select('*').eq('id', id).single().then(({ data }: { data: any }) => setPaciente(data))
    try {
      const raw = localStorage.getItem('med-frecuentes')
      if (raw) {
        const data = JSON.parse(raw) as { nombre: string; count: number }[]
        setMedCache(data.sort((a, b) => b.count - a.count).map(d => d.nombre))
      }
    } catch {}
    // Restaurar borrador si existe
    try {
      const draft = localStorage.getItem(draftKey)
      if (draft) {
        const parsed = JSON.parse(draft)
        if (parsed.form) { setForm(parsed.form); setBorradorRestaurado(true) }
        if (parsed.medicamentos?.length) setMedicamentos(parsed.medicamentos)
      }
    } catch {}
    // Cargar última consulta para contexto
    const supabase2 = createClient()
    supabase2.from('consultas')
      .select('diagnosticos, medicamentos')
      .eq('paciente_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (!data) return
        const dx = Array.isArray(data.diagnosticos)
          ? (data.diagnosticos as { descripcion?: string }[]).map(d => d.descripcion).filter(Boolean).join(', ')
          : ''
        setUltimaConsulta({ diagnosticos: dx, medicamentos: data.medicamentos || null })
      })
  }, [id])

  // ── Autosave en localStorage ──────────────────────────────────
  useEffect(() => {
    if (notaSaved) return // no guardar borrador si la nota ya fue guardada en DB
    if (autosaveRef.current) clearTimeout(autosaveRef.current)
    autosaveRef.current = setTimeout(() => {
      const tieneDatos = form.motivo_consulta || form.diagnosticos || form.exploracion_fisica
      if (!tieneDatos) return
      try {
        localStorage.setItem(draftKey, JSON.stringify({ form, medicamentos }))
        setUltimoGuardado(new Date())
      } catch {}
    }, 1500)
    return () => { if (autosaveRef.current) clearTimeout(autosaveRef.current) }
  }, [form, medicamentos, notaSaved])

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

  // ── Helpers de medicamentos ───────────────────────────────────
  function getSuggestions(query: string): string[] {
    if (!query.trim()) return medCache.slice(0, 6)
    return medCache.filter(n => n.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
  }

  function saveMedCache(meds: MedRow[]) {
    try {
      const nombres = meds.filter(m => m.nombre.trim()).map(m => m.nombre.trim())
      if (!nombres.length) return
      const raw = localStorage.getItem('med-frecuentes')
      let data: { nombre: string; count: number }[] = []
      try { if (raw) data = JSON.parse(raw) } catch {}
      nombres.forEach(nombre => {
        const idx = data.findIndex(d => d.nombre.toLowerCase() === nombre.toLowerCase())
        if (idx >= 0) data[idx].count++
        else data.push({ nombre, count: 1 })
      })
      localStorage.setItem('med-frecuentes', JSON.stringify(data))
      setMedCache(data.sort((a, b) => b.count - a.count).map(d => d.nombre))
    } catch {}
  }

  function updateMed(i: number, field: keyof MedRow, val: string) {
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

  // ── Generar nota con Gemini ───────────────────────────────────
  async function generarNota() {
    if (!form.motivo_consulta) { setError('Ingresa al menos el motivo de consulta'); return }
    setGenerando(true); setError('')
    const edad = paciente?.fecha_nacimiento
      ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento)) : null
    try {
      const res = await fetch('/api/nota-medica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente: `${paciente?.nombre} ${paciente?.apellidos}`,
          edad, sexo: paciente?.sexo, peso: paciente?.peso_kg, talla: paciente?.talla_cm,
          antecedentes: [
            paciente?.ant_patologicos, paciente?.ant_quirurgicos,
            paciente?.medicamentos_actuales ? `Medicamentos: ${paciente.medicamentos_actuales}` : null,
            paciente?.alergias ? `Alergias: ${paciente.alergias}` : null,
          ].filter(Boolean).join('. '),
          ...form,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setNotaGenerada(data.nota)
    } catch (e: any) {
      const msg = e.message?.toLowerCase() || ''
      if (msg.includes('timeout') || msg.includes('deadline'))
        setError('La IA tardó demasiado en responder. Intenta de nuevo en unos segundos.')
      else if (msg.includes('rate') || msg.includes('quota') || msg.includes('429'))
        setError('Se alcanzó el límite de uso de la IA. Espera un minuto e intenta de nuevo.')
      else if (msg.includes('network') || msg.includes('fetch'))
        setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
      else
        setError('No se pudo generar la nota. Intenta de nuevo o escríbela manualmente.')
    } finally {
      setGenerando(false)
    }
  }

  // ── Guardar nota ──────────────────────────────────────────────
  async function guardar() {
    if (!notaGenerada && !form.motivo_consulta) { setError('Completa la nota antes de guardar'); return }
    setGuardando(true)

    const medsConDatos = medicamentos.filter(m => m.nombre.trim())
    const notaFinal = notaGenerada
      + (form.pronostico.trim() ? `\n\n**[PRONÓSTICO]:**\n${form.pronostico.trim()}` : '')

    const res = await fetch('/api/consultas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paciente_id: id,
        motivo_consulta: form.motivo_consulta,
        exploracion_fisica: form.exploracion_fisica,
        diagnosticos: form.diagnosticos ? [{ descripcion: form.diagnosticos }] : [],
        plan_tratamiento: form.plan_tratamiento,
        notas_evolucion: notaFinal,
        proxima_cita: form.proxima_cita || null,
        medicamentos: medsConDatos.length ? medsConDatos : null,
      }),
    })

    setGuardando(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Error desconocido' }))
      setError(data.error || 'No se pudo guardar la nota. Verifica tu conexión e intenta de nuevo.')
      return
    }
    saveMedCache(medsConDatos)
    try { localStorage.removeItem(draftKey) } catch {}
    setNotaSaved(true)
    setDocInline(null)
  }

  // ── Imprimir nota ─────────────────────────────────────────────
  async function imprimir() {
    if (!paciente) return
    flushSync(() => setImprimiendo(true))
    try {
      const ahora = new Date()
      const edad = paciente.fecha_nacimiento
        ? differenceInYears(ahora, parseISO(paciente.fecha_nacimiento)) : null
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
      const logoUrl   = medicoInfo?.logo_url && medicoInfo.logo_url.startsWith('https://')
        ? medicoInfo.logo_url : `${window.location.origin}/logo.png`

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
      const medsParaPDF = medicamentos.filter(m => m.nombre.trim())

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
  /* Terapéutica empleada */
  .terapeutica { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 6px; }
  .terapeutica th { background: ${cp}15; color: ${cp}; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 10px; text-align: left; border-bottom: 1.5px solid ${cp}40; font-weight: 700; }
  .terapeutica td { padding: 5px 10px; border-bottom: 1px dotted #e2e8f0; color: #2d2d2d; }
  .terapeutica tr:last-child td { border-bottom: none; }
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
    ${medsParaPDF.length > 0 ? `
    <div class="seccion-header"><div class="seccion-linea"></div><div class="seccion-titulo">Terapéutica Empleada</div><div class="seccion-linea"></div></div>
    <table class="terapeutica">
      <thead><tr><th>Medicamento</th><th>Dosis</th><th>Frecuencia</th><th>Duración</th></tr></thead>
      <tbody>
        ${medsParaPDF.map(m => `<tr><td>${m.nombre}</td><td>${m.dosis || '—'}</td><td>${m.frecuencia || '—'}</td><td>${m.duracion || '—'}</td></tr>`).join('')}
      </tbody>
    </table>` : ''}
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

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto">
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
                {paciente.fecha_nacimiento ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento)) + ' años' : ''}
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
                  setForm({ motivo_consulta: '', exploracion_fisica: '', diagnosticos: '', pronostico: '', plan_tratamiento: '', gabinete_laboratorios: '', proxima_cita: '' })
                  setMedicamentos([{ ...MED_VACIA }])
                  try { localStorage.removeItem(draftKey) } catch {}
                  setBorradorRestaurado(false)
                }}
                className="text-xs text-amber-600 hover:text-amber-800 underline"
              >
                Descartar
              </button>
            </div>
          )}

          {/* Formulario de la consulta */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-700 text-sm">Datos de la consulta</h2>
                <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                  Completa los campos y
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="inline text-[#4285F4]"><path d="M12 2C12 2 13.8 9 19 12C13.8 15 12 22 12 22C12 22 10.2 15 5 12C10.2 9 12 2 12 2Z" fill="#4285F4"/></svg>
                  <span className="text-[#4285F4] font-medium">Gemini</span> redactará la nota médica
                </p>
              </div>
              {ultimoGuardado && !notaSaved && (
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-600">
                  <CheckCircle2 size={11} />
                  Borrador guardado
                </div>
              )}
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Motivo de consulta <span className="text-red-400">*</span></label>
                <input type="text" value={form.motivo_consulta} onChange={e => update('motivo_consulta', e.target.value)}
                  placeholder="Ej: Dolor lumbar crónico, limitación funcional..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
              </div>
              {/* Exploración física — expandible */}
              <div>
                <button type="button" onClick={() => toggleCampo('exploracion')}
                  className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors mb-1 w-full text-left">
                  <ChevronDown size={13} className={`transition-transform duration-200 ${camposExpandidos.exploracion ? 'rotate-180' : ''}`} />
                  Exploración física
                  <span className="text-slate-300 font-normal ml-1">Gemini la complementa</span>
                  {form.exploracion_fisica && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#1e5fa8]" />}
                </button>
                {camposExpandidos.exploracion && (
                  <textarea value={form.exploracion_fisica} onChange={e => update('exploracion_fisica', e.target.value)}
                    placeholder="Ej: Marcha antiálgica, Lasègue positivo a 45° derecho..."
                    rows={3} autoFocus
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
                )}
              </div>

              {/* Gabinete — expandible */}
              <div>
                <button type="button" onClick={() => toggleCampo('gabinete')}
                  className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors mb-1 w-full text-left">
                  <ChevronDown size={13} className={`transition-transform duration-200 ${camposExpandidos.gabinete ? 'rotate-180' : ''}`} />
                  Gabinete y Laboratorios
                  {form.gabinete_laboratorios && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#1e5fa8]" />}
                </button>
                {camposExpandidos.gabinete && (
                  <textarea value={form.gabinete_laboratorios} onChange={e => update('gabinete_laboratorios', e.target.value)}
                    placeholder="Ej: Rx columna lumbar AP/Lateral — disminución de espacio L4-L5..."
                    rows={2} autoFocus
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
                )}
              </div>

              {/* Diagnóstico — siempre visible */}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Diagnóstico(s)</label>
                <input type="text" value={form.diagnosticos} onChange={e => update('diagnosticos', e.target.value)}
                  placeholder="Ej: Hernia discal L4-L5 con radiculopatía derecha..."
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
              </div>

              {/* Plan de tratamiento — expandible */}
              <div>
                <button type="button" onClick={() => toggleCampo('plan')}
                  className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors mb-1 w-full text-left">
                  <ChevronDown size={13} className={`transition-transform duration-200 ${camposExpandidos.plan ? 'rotate-180' : ''}`} />
                  Plan de tratamiento
                  {form.plan_tratamiento && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#1e5fa8]" />}
                </button>
                {camposExpandidos.plan && (
                  <textarea value={form.plan_tratamiento} onChange={e => update('plan_tratamiento', e.target.value)}
                    placeholder="Ej: Manejo conservador, fisioterapia, valorar cirugía..."
                    rows={2} autoFocus
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
                )}
              </div>
            </div>
          </div>

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
                <p className="text-xs text-slate-400 text-center py-2">Sin medicamentos — usa el botón "Agregar" o comienza a escribir</p>
              )}
              <div className="pt-1">
                <button type="button" onClick={addMed}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#1e5fa8] hover:text-[#1a3a5c] transition-colors">
                  <Plus size={14} /> Agregar medicamento
                </button>
              </div>
            </div>
          </div>

          {/* Pronóstico y próxima cita */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <h2 className="font-semibold text-slate-700 text-sm">Pronóstico y seguimiento</h2>
            </div>
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
          </div>

          <ConsultaRapida />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}

          {/* Botón generar */}
          <button onClick={generarNota} disabled={generando || !form.motivo_consulta}
            className="w-full py-3 bg-[#4285F4] text-white rounded-xl font-medium hover:bg-[#3367d6] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {generando
              ? <><Loader2 size={18} className="animate-spin" /> Redactando nota médica...</>
              : <><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2C12 2 13.8 9 19 12C13.8 15 12 22 12 22C12 22 10.2 15 5 12C10.2 9 12 2 12 2Z" fill="white"/></svg> Generar con Gemini</>
            }
          </button>

          {/* Nota generada */}
          {notaGenerada && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-slate-700 text-sm">Nota médica generada</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {modoEdicion ? 'Editando texto' : 'Vista previa — haz clic en Editar para modificar'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setModoEdicion(!modoEdicion)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${modoEdicion ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                    {modoEdicion ? <><Eye size={12} /> Vista previa</> : <><Pencil size={12} /> Editar</>}
                  </button>
                  <button onClick={generarNota} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 px-2 py-1">
                    <RotateCcw size={12} /> Regenerar
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
          )}

          {/* Acciones imprimir / guardar */}
          {notaGenerada && (
            <div className="flex gap-3 pb-6">
              <button onClick={imprimir} disabled={imprimiendo}
                className="flex items-center gap-2 px-5 py-2.5 border-2 border-[#1a3a5c] text-[#1a3a5c] rounded-lg text-sm font-medium hover:bg-[#1a3a5c] hover:text-white transition-colors disabled:opacity-50">
                {imprimiendo ? <><Loader2 size={16} className="animate-spin" /> Generando...</> : <><Printer size={16} /> Imprimir</>}
              </button>
              <button onClick={guardar} disabled={guardando}
                className="flex-1 flex items-center justify-center gap-2 bg-[#1e5fa8] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-60">
                {guardando ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : <><Save size={16} /> Guardar en expediente</>}
              </button>
            </div>
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
                      {differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento))} años
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
                  <button onClick={guardar} disabled={guardando}
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
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/60 flex-shrink-0">
                <div key={`header-${slideKey}`} className="flex items-center gap-2.5" style={slideKey > 0 ? { animation: 'docTitleIn 0.35s cubic-bezier(0.32, 0.72, 0, 1)' } : undefined}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${currentDoc?.color.split(' ').slice(1, 3).join(' ') ?? 'bg-slate-50'}`}>
                    <CurrentIcon size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{currentDoc?.label}</h3>
                    <p className="text-[11px] text-slate-400">{nombrePaciente}</p>
                  </div>
                </div>

                {/* Navegación entre documentos — todos los iconos */}
                <div className="flex items-center gap-1" data-onboard="modal-doc-iconos">
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
                        className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all duration-150 ${bgClass} ${textClass} ${isActive ? 'ring-1 ring-current/20 shadow-sm' : ''}`}
                      >
                        <Icon size={15} />
                      </button>
                    )
                  })}
                  <div className="w-px h-5 bg-slate-200 mx-1" />
                  <button
                    onClick={() => setDocInline(null)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 active:scale-95 transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Contenido scrolleable — height fijo, slide animation */}
              <div className="doc-modal-scroll flex-1 overflow-y-auto overflow-x-hidden relative">
                <div
                  key={slideKey}
                  className="p-5 sm:p-6 min-h-full"
                  style={slideKey > 0 ? { animation: `${slideDir === 'right' ? 'slideFromRight' : 'slideFromLeft'} 0.3s cubic-bezier(0.32, 0.72, 0, 1)` } : undefined}
                >
                  {docInline === 'receta' && (
                    <RecetaFormDynamic pacienteInicial={nombrePaciente} diagnosticoInicial={form.diagnosticos} pacienteId={id} medicamentosIniciales={medicamentosParaReceta} />
                  )}
                  {docInline === 'lab' && (
                    <SolicitudLabFormDynamic pacienteInicial={nombrePaciente} diagnosticoInicial={form.diagnosticos} pacienteId={id} />
                  )}
                  {docInline === 'imagen' && (
                    <SolicitudImagenFormDynamic pacienteInicial={nombrePaciente} diagnosticoInicial={form.diagnosticos} pacienteId={id} />
                  )}
                  {docInline === 'suplementacion' && (
                    <PlanSupFormDynamic pacienteInicial={nombrePaciente} diagnosticoInicial={form.diagnosticos} pacienteId={id} />
                  )}
                  {docInline === 'internamiento' && (
                    <InternamientoFormDynamic pacienteInicial={nombrePaciente} diagnosticoInicial={form.diagnosticos} pacienteId={id} />
                  )}
                  {docInline === 'escrito' && (
                    <EscritoFormDynamic pacienteInicial={nombrePaciente} pacienteId={id} />
                  )}
                  {docInline === 'consentimiento' && (
                    <ConsentimientoFormDynamic pacienteInicial={nombrePaciente} diagnosticoInicial={form.diagnosticos} pacienteId={id} />
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
