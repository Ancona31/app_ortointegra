'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Paciente } from '@/types'
import { differenceInYears, parseISO } from 'date-fns'
import { flushSync } from 'react-dom'
import { ArrowLeft, Save, Loader2, RotateCcw, Printer, Eye, Pencil, Pill, FlaskConical, ScanLine, ClipboardList, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import ConsultaRapida from '@/components/ConsultaRapida'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import { imprimirOCompartir } from '@/lib/mobileShare'

type MedicoInfo = {
  nombre: string
  especialidad: string
  cedula_profesional: string
  cedula_especialidad: string
  logo_url: string | null
  color_primario: string
  color_secundario: string
  direccion_consultorio: string
  telefono_consultorio: string
}

export default function NuevaNotaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [medicoInfo, setMedicoInfo] = useState<MedicoInfo | null>(null)
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [form, setForm] = useState({
    motivo_consulta: '',
    exploracion_fisica: '',
    diagnosticos: '',
    plan_tratamiento: '',
    gabinete_laboratorios: '',
    proxima_cita: '',
  })
  const [notaGenerada, setNotaGenerada] = useState('')
  const [modoEdicion, setModoEdicion] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [error, setError] = useState('')
  const [modalPost, setModalPost] = useState(false)

  useEffect(() => {
    fetch('/api/me/perfil-medico').then(r => r.json()).then(({ medico }) => setMedicoInfo(medico))
    async function cargar() {
      const supabase = createClient()
      const { data } = await supabase.from('pacientes').select('*').eq('id', id).single()
      setPaciente(data)
    }
    cargar()
  }, [id])

  function update(field: string, val: string) {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  async function generarNota() {
    if (!form.motivo_consulta) { setError('Ingresa al menos el motivo de consulta'); return }
    setGenerando(true)
    setError('')

    const edad = paciente?.fecha_nacimiento
      ? differenceInYears(new Date(), parseISO(paciente.fecha_nacimiento))
      : null

    try {
      const res = await fetch('/api/nota-medica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente: `${paciente?.nombre} ${paciente?.apellidos}`,
          edad,
          sexo: paciente?.sexo,
          peso: paciente?.peso_kg,
          talla: paciente?.talla_cm,
          antecedentes: [
            paciente?.ant_patologicos,
            paciente?.ant_quirurgicos,
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
      setError('Error al generar nota: ' + e.message)
    } finally {
      setGenerando(false)
    }
  }

  async function guardar() {
    if (!notaGenerada && !form.motivo_consulta) { setError('Completa la nota antes de guardar'); return }
    setGuardando(true)
    const supabase = createClient()

    const { error: err } = await supabase.from('consultas').insert({
      paciente_id: id,
      fecha: new Date().toISOString(),
      motivo_consulta: form.motivo_consulta,
      exploracion_fisica: form.exploracion_fisica,
      diagnosticos: form.diagnosticos ? [{ descripcion: form.diagnosticos }] : [],
      plan_tratamiento: form.plan_tratamiento,
      notas_evolucion: notaGenerada,
      proxima_cita: form.proxima_cita || null,
      medico_nombre: medicoInfo?.nombre || null,
      medico_especialidad: medicoInfo?.especialidad || null,
      medico_cedula_profesional: medicoInfo?.cedula_profesional || null,
      medico_cedula_especialidad: medicoInfo?.cedula_especialidad || null,
      medico_logo_url: medicoInfo?.logo_url || null,
    })

    setGuardando(false)
    if (err) setError('Error al guardar: ' + err.message)
    else setModalPost(true)
  }

  async function imprimir() {
    if (!paciente) return
    flushSync(() => setImprimiendo(true))
    try {
      const ahora = new Date()
      const edad = paciente.fecha_nacimiento
        ? differenceInYears(ahora, parseISO(paciente.fecha_nacimiento))
        : null
      const fechaHora = ahora.toLocaleString('es-MX', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
      const cp = medicoInfo?.color_primario || '#1a3a5c'
      const cs = medicoInfo?.color_secundario || '#1e5fa8'
      const doctorNombre = medicoInfo?.nombre || 'Médico'
      const doctorEspecialidad = medicoInfo?.especialidad || ''
      const cedProf = medicoInfo?.cedula_profesional || ''
      const cedEsp = medicoInfo?.cedula_especialidad || ''
      const direccion = medicoInfo?.direccion_consultorio || ''
      const telefono = medicoInfo?.telefono_consultorio || ''
      const logoUrl = medicoInfo?.logo_url && medicoInfo.logo_url.startsWith('https://')
        ? medicoInfo.logo_url
        : `${window.location.origin}/logo.png`

      // Convierte el markdown de Gemini a HTML con secciones estilizadas
      function notaToHtml(texto: string): string {
        const lines = texto.split('\n')
        let html = ''
        const sectionRe = /^\*\*\[([^\]]+)\]:\*\*$/
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) { html += '<div style="height:5px"></div>'; continue }
          const secMatch = trimmed.match(sectionRe)
          if (secMatch) {
            html += `
              <div class="seccion-header">
                <div class="seccion-linea"></div>
                <div class="seccion-titulo">${secMatch[1]}</div>
                <div class="seccion-linea"></div>
              </div>`
            continue
          }
          const contenido = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          html += `<p>${contenido}</p>`
        }
        return html
      }

      const notaHtml = notaToHtml(notaGenerada)

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

  .watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-25deg);
    width: 320px; height: 320px;
    object-fit: contain; opacity: 0.05;
    pointer-events: none; z-index: 0;
  }

  .barra-top {
    background: linear-gradient(135deg, ${cp} 0%, ${cs} 100%);
    height: 12px; width: 100%;
  }

  .contenido { padding: 12mm 18mm 10mm; position: relative; z-index: 1; }

  .header {
    display: flex; align-items: center; gap: 18px;
    padding-bottom: 12px; margin-bottom: 12px;
    border-bottom: 2px solid ${cp};
  }
  .logo-wrap {
    width: 72px; height: 72px; border-radius: 50%;
    border: 3px solid ${cs}; overflow: hidden; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: #f8fafc;
  }
  .logo { width: 100%; height: 100%; object-fit: contain; }
  .header-info { flex: 1; }
  .doctor-name { font-size: 14pt; font-weight: bold; color: ${cp}; line-height: 1.2; }
  .especialidad { font-size: 9pt; color: ${cs}; margin: 3px 0; font-style: italic; }
  .credenciales { font-size: 8pt; color: #666; }
  .contacto { font-size: 7.5pt; color: #888; margin-top: 3px; }
  .titulo-doc {
    text-align: right; min-width: 120px;
  }
  .titulo-texto {
    font-size: 11pt; font-weight: 900; color: ${cp};
    text-transform: uppercase; letter-spacing: 1px; line-height: 1.2;
  }
  .titulo-sub { font-size: 7.5pt; color: #aaa; margin-top: 3px; }

  .datos-box {
    background: linear-gradient(135deg, ${cp}08, ${cs}08);
    border-left: 4px solid ${cs};
    border-radius: 0 6px 6px 0;
    padding: 9px 14px; margin-bottom: 14px;
  }
  .datos-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px 20px; }
  .dato { display: flex; gap: 6px; align-items: baseline; font-size: 9pt; }
  .dato-label { font-weight: bold; color: ${cp}; white-space: nowrap; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.3px; }
  .dato-valor { flex: 1; border-bottom: 1px solid #d1d5db; padding-bottom: 1px; }

  .seccion-header {
    display: flex; align-items: center; gap: 8px;
    margin: 13px 0 6px;
  }
  .seccion-linea { flex: 1; height: 1px; background: linear-gradient(to right, ${cp}, transparent); }
  .seccion-titulo {
    font-size: 7.5pt; font-weight: bold; color: ${cp};
    text-transform: uppercase; letter-spacing: 1.5px;
    background: ${cp}12; padding: 3px 10px; border-radius: 20px;
    white-space: nowrap;
  }

  .nota-content { font-size: 9.5pt; line-height: 1.6; color: #2d2d2d; }
  .nota-content p { margin-bottom: 3px; }
  .nota-content strong { font-weight: 600; color: #111; }

  .fecha-box {
    margin-top: 12px;
    background: ${cs}10;
    border-left: 3px solid ${cs};
    border-radius: 0 4px 4px 0;
    padding: 6px 12px;
    font-size: 9pt;
  }

  .footer-area { margin-top: 28px; display: flex; justify-content: flex-end; }
  .firma {
    text-align: center; min-width: 210px;
    border-top: 1.5px solid ${cp}; padding-top: 8px;
  }
  .firma-nombre { font-weight: bold; font-size: 9.5pt; color: ${cp}; }
  .firma-ced { font-size: 8pt; color: #666; margin-top: 2px; }

  .barra-bottom {
    background: linear-gradient(135deg, ${cp} 0%, ${cs} 100%);
    height: 8px; width: 100%; margin-top: 16px;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

  <img class="watermark" src="${logoUrl}" onerror="this.style.display='none'" />
  <div class="barra-top"></div>

  <div class="contenido">

    <div class="header">
      <div class="logo-wrap">
        <img class="logo" src="${logoUrl}" onerror="this.style.display='none'" />
      </div>
      <div class="header-info">
        <div class="doctor-name">${doctorNombre}</div>
        ${doctorEspecialidad ? `<div class="especialidad">${doctorEspecialidad}</div>` : ''}
        <div class="credenciales">
          ${cedProf ? `Cédula Prof.: ${cedProf}` : ''}
          ${cedProf && cedEsp ? ' &nbsp;·&nbsp; ' : ''}
          ${cedEsp ? `Cédula Esp.: ${cedEsp}` : ''}
        </div>
        ${direccion || telefono ? `<div class="contacto">${[direccion, telefono ? `Tel: ${telefono}` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>` : ''}
      </div>
      <div class="titulo-doc">
        <div class="titulo-texto">Nota<br>Médica</div>
        <div class="titulo-sub">${fechaHora}</div>
      </div>
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

    <div class="nota-content">${notaHtml}</div>

    ${form.proxima_cita ? `<div class="fecha-box"><strong>Fecha:</strong> ${form.proxima_cita}</div>` : ''}

    <div class="footer-area">
      <div class="firma">
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

  const DOCS = [
    { key: 'receta', label: 'Receta médica', icon: Pill, color: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100' },
    { key: 'lab', label: 'Solicitud de laboratorio', icon: FlaskConical, color: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
    { key: 'imagen', label: 'Solicitud de imagen', icon: ScanLine, color: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100' },
    { key: 'suplementacion', label: 'Plan de suplementación', icon: ClipboardList, color: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Breadcrumbs */}
      <Breadcrumbs pacienteNombre={paciente ? `${paciente.nombre} ${paciente.apellidos}` : undefined} />

      {/* Header */}
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

      {/* Datos de la consulta */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700 text-sm">Datos de la consulta</h2>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
            Completa los campos y
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="inline text-[#4285F4]"><path d="M12 2C12 2 13.8 9 19 12C13.8 15 12 22 12 22C12 22 10.2 15 5 12C10.2 9 12 2 12 2Z" fill="#4285F4"/></svg>
            <span className="text-[#4285F4] font-medium">Gemini</span> redactará la nota médica
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Motivo de consulta <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.motivo_consulta}
              onChange={e => update('motivo_consulta', e.target.value)}
              placeholder="Ej: Dolor lumbar crónico, limitación funcional..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Diagnóstico(s)</label>
            <input
              type="text"
              value={form.diagnosticos}
              onChange={e => update('diagnosticos', e.target.value)}
              placeholder="Ej: Hernia discal L4-L5 con radiculopatía derecha, Espondilolistesis L5-S1 grado I..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Exploración física <span className="text-slate-400 font-normal">(opcional — Gemini la complementa)</span>
            </label>
            <textarea
              value={form.exploracion_fisica}
              onChange={e => update('exploracion_fisica', e.target.value)}
              placeholder="Ej: Marcha antiálgica, Lasègue positivo a 45° derecho, hipoestesia en L5..."
              rows={3}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Plan de tratamiento <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={form.plan_tratamiento}
              onChange={e => update('plan_tratamiento', e.target.value)}
              placeholder="Ej: Manejo conservador, fisioterapia, AINES, valorar cirugía..."
              rows={2}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Gabinete y Laboratorios <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={form.gabinete_laboratorios}
              onChange={e => update('gabinete_laboratorios', e.target.value)}
              placeholder="Ej: Rx columna lumbar AP/Lateral — disminución de espacio L4-L5. BH: Hb 13.2, leucocitos 7,800..."
              rows={2}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Fecha</label>
            <input
              type="text"
              value={form.proxima_cita}
              onChange={e => update('proxima_cita', e.target.value)}
              placeholder="Ej: En 4 semanas, 15 de abril 2026..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
            />
          </div>
        </div>
      </div>

      {/* Consulta rápida a Claude */}
      <ConsultaRapida />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Botón generar */}
      <button
        onClick={generarNota}
        disabled={generando || !form.motivo_consulta}
        className="w-full py-3 bg-[#4285F4] text-white rounded-xl font-medium hover:bg-[#3367d6] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
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
                {modoEdicion ? 'Editando texto — cambia lo que necesites' : 'Vista previa — haz clic en Editar para modificar'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setModoEdicion(!modoEdicion)}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${modoEdicion ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-600 hover:border-slate-300'}`}
              >
                {modoEdicion ? <><Eye size={12} /> Vista previa</> : <><Pencil size={12} /> Editar</>}
              </button>
              <button onClick={generarNota} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 px-2 py-1">
                <RotateCcw size={12} /> Regenerar
              </button>
            </div>
          </div>
          <div className="p-5">
            {modoEdicion ? (
              <textarea
                value={notaGenerada}
                onChange={e => setNotaGenerada(e.target.value)}
                rows={22}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 resize-y"
              />
            ) : (
              <div className="prose prose-sm max-w-none
                prose-headings:text-[#1a3a5c] prose-headings:font-bold prose-headings:text-sm prose-headings:mt-4 prose-headings:mb-1
                prose-strong:text-[#1a3a5c] prose-strong:font-semibold
                prose-p:text-slate-700 prose-p:leading-relaxed prose-p:my-1
                prose-ul:my-1 prose-li:my-0.5 prose-li:text-slate-700
              ">
                <ReactMarkdown>
                  {notaGenerada}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal post-guardado */}
      {modalPost && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 size={24} className="text-green-500 flex-shrink-0" />
              <h2 className="font-bold text-[#1a3a5c] text-lg">Nota guardada</h2>
            </div>
            <p className="text-sm text-slate-500 mb-5">¿Deseas generar algún documento adicional para este paciente?</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {DOCS.map(({ key, label, icon: Icon, color }) => (
                <Link
                  key={key}
                  href={`/expediente/${id}/documentos?tipo=${key}&dx=${encodeURIComponent(form.diagnosticos)}`}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center ${color}`}
                >
                  <Icon size={20} />
                  <span className="text-xs font-medium leading-tight">{label}</span>
                </Link>
              ))}
            </div>
            <button
              onClick={() => router.push(`/expediente/${id}`)}
              className="w-full py-2.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Ir al expediente
            </button>
          </div>
        </div>
      )}

      {/* Acciones */}
      {notaGenerada && (
        <div className="flex gap-3 pb-6">
          <button
            onClick={imprimir}
            disabled={imprimiendo}
            className="flex items-center gap-2 px-5 py-2.5 border-2 border-[#1a3a5c] text-[#1a3a5c] rounded-lg text-sm font-medium hover:bg-[#1a3a5c] hover:text-white transition-colors disabled:opacity-50"
          >
            {imprimiendo ? <><Loader2 size={16} className="animate-spin" /> Generando...</> : <><Printer size={16} /> Imprimir</>}
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex-1 flex items-center justify-center gap-2 bg-[#1e5fa8] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-60"
          >
            {guardando
              ? <><Loader2 size={16} className="animate-spin" /> Guardando...</>
              : <><Save size={16} /> Guardar en expediente</>
            }
          </button>
        </div>
      )}
    </div>
  )
}
