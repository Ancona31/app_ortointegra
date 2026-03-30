'use client'
import { MedicoInfo } from '@/types'

import { useRef, useState, useEffect } from 'react'
import { Printer, Loader2, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignJustify, Minus } from 'lucide-react'
import { flushSync } from 'react-dom'
import { imprimirOCompartir } from '@/lib/mobileShare'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'

interface Props {
  pacienteInicial?: string
  pacienteId?: string
}

function sanitizeEditorHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
    .replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src="#"')
}

const TAMANOS = [
  { label: 'Normal',  tag: 'p'  },
  { label: 'Grande',  tag: 'h3' },
  { label: 'Título',  tag: 'h2' },
]

export default function EscritoMedicoForm({ pacienteInicial = '', pacienteId }: Props) {
  const [medicoInfo, setMedicoInfo]   = useState<MedicoInfo | null>(null)
  const [paciente, setPaciente]       = useState(pacienteInicial)
  const [fecha, setFecha]             = useState(new Date().toISOString().split('T')[0])
  const [asunto, setAsunto]           = useState('')
  const [isEmpty, setIsEmpty]         = useState(true)
  const [imprimiendo, setImprimiendo] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/me/perfil-medico').then(r => r.json()).then(({ medico }) => setMedicoInfo(medico))
  }, [])

  function exec(cmd: string, value?: string) {
    document.execCommand(cmd, false, value ?? undefined)
    editorRef.current?.focus()
  }

  function setTamano(tag: string) {
    document.execCommand('formatBlock', false, tag)
    editorRef.current?.focus()
  }

  function onEditorInput() {
    const text = editorRef.current?.innerText?.trim() ?? ''
    setIsEmpty(text === '')
  }

  async function imprimir() {
    const contenido = sanitizeEditorHtml(editorRef.current?.innerHTML ?? '')
    if (!contenido.trim()) return

    flushSync(() => setImprimiendo(true))
    try {
      const supabase = createClient()
      await supabase.from('documentos').insert({
        ...(pacienteId ? { paciente_id: pacienteId } : {}),
        tipo: 'escrito_medico',
        contenido: {
          paciente, fecha, asunto,
          cuerpo: contenido,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      })

      const cp       = medicoInfo?.color_primario       || '#1a3a5c'
      const cs       = medicoInfo?.color_secundario      || '#1e5fa8'
      const nombre   = medicoInfo?.nombre                || 'Médico'
      const esp      = medicoInfo?.especialidad          || ''
      const cedProf  = medicoInfo?.cedula_profesional    || ''
      const cedEsp   = medicoInfo?.cedula_especialidad   || ''
      const dir      = medicoInfo?.direccion_consultorio || ''
      const tel      = medicoInfo?.telefono_consultorio  || ''
      const logoUrl  = medicoInfo?.logo_url?.startsWith('https://')
        ? medicoInfo.logo_url
        : `${window.location.origin}/logo.png`

      const fechaFmt = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })

      const _html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Escrito Médico</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Georgia&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: letter; margin: 0; }
  body { font-family: 'Roboto', Arial, sans-serif; font-size: 10.5pt; color: #1a1a1a; position: relative; }
  .watermark { position: fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-25deg); width:320px; height:320px; object-fit:contain; opacity:0.05; pointer-events:none; z-index:0; }
  .barra-top { background: linear-gradient(135deg, ${cp} 0%, ${cs} 100%); height: 12px; }
  .contenido { padding: 12mm 18mm 10mm; position: relative; z-index: 1; }
  .header { display:flex; align-items:center; gap:18px; padding-bottom:12px; margin-bottom:14px; border-bottom:2px solid ${cp}; }
  .logo-wrap { width:70px; height:70px; border-radius:50%; border:3px solid ${cs}; overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:#f8fafc; }
  .logo { width:100%; height:100%; object-fit:contain; }
  .doctor-name { font-size:14pt; font-weight:bold; color:${cp}; line-height:1.2; }
  .especialidad { font-size:9pt; color:${cs}; margin:3px 0; font-style:italic; }
  .credenciales { font-size:8pt; color:#666; }
  .contacto { font-size:7.5pt; color:#888; margin-top:3px; }
  .meta { display:flex; gap:24px; flex-wrap:wrap; margin-bottom:16px; font-size:9pt; }
  .meta-item { display:flex; gap:6px; align-items:baseline; }
  .meta-label { font-weight:bold; color:${cp}; font-size:8pt; text-transform:uppercase; white-space:nowrap; }
  .meta-valor { border-bottom:1px solid #d1d5db; padding-bottom:1px; min-width:140px; }
  .asunto-banner { background:linear-gradient(135deg, ${cp} 0%, ${cs} 100%); color:#fff; font-size:10pt; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; padding:7px 14px; border-radius:4px; margin-bottom:20px; }
  .cuerpo { font-family: Georgia, 'Times New Roman', serif; font-size:10.5pt; line-height:1.75; color:#1a1a1a; }
  .cuerpo h2 { font-family:'Roboto',Arial,sans-serif; font-size:13pt; font-weight:700; color:${cp}; margin:14px 0 6px; }
  .cuerpo h3 { font-family:'Roboto',Arial,sans-serif; font-size:11pt; font-weight:700; color:${cp}; margin:10px 0 5px; }
  .cuerpo p { margin-bottom:5px; }
  .cuerpo p:empty::after { content:'\\00a0'; }
  .cuerpo hr { border:none; border-top:1px solid #d1d5db; margin:14px 0; }
  .footer-area { margin-top:40px; display:flex; justify-content:flex-end; }
  .firma { text-align:center; min-width:210px; border-top:1.5px solid ${cp}; padding-top:8px; }
  .firma-nombre { font-weight:bold; font-size:9.5pt; color:${cp}; }
  .firma-ced { font-size:8pt; color:#666; margin-top:2px; }
  .barra-bottom { background:linear-gradient(135deg, ${cp} 0%, ${cs} 100%); height:8px; margin-top:16px; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>
<img class="watermark" src="${logoUrl}" onerror="this.style.display='none'" />
<div class="barra-top"></div>
<div class="contenido">

  <div class="header">
    <div class="logo-wrap"><img class="logo" src="${logoUrl}" onerror="this.style.display='none'" /></div>
    <div>
      <div class="doctor-name">${nombre}</div>
      ${esp     ? `<div class="especialidad">${esp}</div>` : ''}
      <div class="credenciales">
        ${cedProf ? `Cédula Prof.: ${cedProf}` : ''}
        ${cedProf && cedEsp ? ' &nbsp;·&nbsp; ' : ''}
        ${cedEsp  ? `Cédula Esp.: ${cedEsp}` : ''}
      </div>
      ${dir || tel ? `<div class="contacto">${[dir, tel ? `Tel: ${tel}` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ')}</div>` : ''}
    </div>
  </div>

  <div class="meta">
    <div class="meta-item"><span class="meta-label">Fecha</span><span class="meta-valor">${fechaFmt}</span></div>
    ${paciente ? `<div class="meta-item"><span class="meta-label">Paciente</span><span class="meta-valor">${paciente}</span></div>` : ''}
  </div>

  ${asunto ? `<div class="asunto-banner">${asunto}</div>` : ''}

  <div class="cuerpo">${contenido}</div>

  <div class="footer-area">
    <div class="firma">
      <div class="firma-nombre">${nombre}</div>
      ${cedProf ? `<div class="firma-ced">Céd. Prof. ${cedProf}</div>` : ''}
      ${cedEsp  ? `<div class="firma-ced">Céd. Esp. ${cedEsp}</div>`  : ''}
    </div>
  </div>

</div>
<div class="barra-bottom"></div>
</body></html>`

      await imprimirOCompartir(_html, 'escrito-medico.pdf')
    } finally {
      setImprimiendo(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]'
  const tbBtn = 'p-1.5 rounded text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors'

  return (
    <div className="space-y-5">

      {/* Datos del documento */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-4">Datos del documento</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Paciente (opcional)</label>
            <input type="text" value={paciente} onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Asunto / Tipo de documento</label>
            <input type="text" value={asunto} onChange={e => setAsunto(e.target.value)} placeholder="Ej: Certificado Médico, Constancia de Salud..." className={inputCls} />
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Barra de herramientas */}
        <div className="flex items-center gap-0.5 px-3 py-2 border-b border-slate-100 bg-slate-50 flex-wrap gap-y-1">

          {/* Tamaño de texto */}
          <select
            onChange={e => setTamano(e.target.value)}
            defaultValue="p"
            className="text-xs border border-slate-200 rounded px-2 py-1 mr-1 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-[#1e5fa8]/30"
          >
            {TAMANOS.map(t => <option key={t.tag} value={t.tag}>{t.label}</option>)}
          </select>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          {/* Formato */}
          <button onMouseDown={e => { e.preventDefault(); exec('bold') }}      title="Negrita (Ctrl+B)"    className={tbBtn}><Bold      size={14} /></button>
          <button onMouseDown={e => { e.preventDefault(); exec('italic') }}    title="Itálica (Ctrl+I)"    className={tbBtn}><Italic    size={14} /></button>
          <button onMouseDown={e => { e.preventDefault(); exec('underline') }} title="Subrayado (Ctrl+U)"  className={tbBtn}><Underline size={14} /></button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          {/* Alineación */}
          <button onMouseDown={e => { e.preventDefault(); exec('justifyLeft')  }} title="Izquierda"  className={tbBtn}><AlignLeft    size={14} /></button>
          <button onMouseDown={e => { e.preventDefault(); exec('justifyCenter')}} title="Centrado"   className={tbBtn}><AlignCenter  size={14} /></button>
          <button onMouseDown={e => { e.preventDefault(); exec('justifyFull')  }} title="Justificado" className={tbBtn}><AlignJustify size={14} /></button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          {/* Separador */}
          <button onMouseDown={e => { e.preventDefault(); exec('insertHorizontalRule') }} title="Línea separadora" className={tbBtn}><Minus size={14} /></button>
        </div>

        {/* Área de escritura */}
        <div className="relative">
          {isEmpty && (
            <p className="absolute top-5 left-5 text-sm text-slate-300 pointer-events-none select-none">
              Redacta aquí el contenido del documento...
            </p>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={onEditorInput}
            className="min-h-[380px] p-5 text-sm leading-relaxed focus:outline-none"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '10.5pt' }}
          />
        </div>
      </div>

      <button
        onClick={imprimir}
        disabled={isEmpty || imprimiendo}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50"
      >
        {imprimiendo
          ? <><Loader2 size={18} className="animate-spin" /> Generando PDF...</>
          : <><Printer size={18} /> Imprimir Escrito Médico</>
        }
      </button>
    </div>
  )
}
