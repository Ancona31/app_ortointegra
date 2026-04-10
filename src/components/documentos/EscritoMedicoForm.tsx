'use client'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'

import { useRef, useState } from 'react'
import { Printer, Loader2, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignJustify, Minus } from 'lucide-react'
import { flushSync } from 'react-dom'
import { generarPdf } from '@/lib/mobileShare'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import DOMPurify from 'dompurify'

interface Props {
  pacienteInicial?: string
  pacienteId?: string
}

// Sanitización con DOMPurify en lugar de regex — cubre SVG scripts,
// iframes, event handlers y todos los vectores de XSS conocidos
function sanitizeEditorHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'h2', 'h3', 'div', 'span', 'hr', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['style', 'class'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'link'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus'],
  })
}

const TAMANOS = [
  { label: 'Normal',  tag: 'p'  },
  { label: 'Grande',  tag: 'h3' },
  { label: 'Título',  tag: 'h2' },
]

export default function EscritoMedicoForm({ pacienteInicial = '', pacienteId }: Props) {
  const { medicoInfo } = useMedicoInfo()
  const [paciente, setPaciente]       = useState(pacienteInicial)
  const [fecha, setFecha]             = useState(new Date().toISOString().split('T')[0])
  const [asunto, setAsunto]           = useState('')
  const [isEmpty, setIsEmpty]         = useState(true)
  const [imprimiendo, setImprimiendo] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

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

      const medicoData = medicoInfo ? { nombre: medicoInfo.nombre, especialidad: medicoInfo.especialidad, cedula_profesional: medicoInfo.cedula_profesional, cedula_especialidad: medicoInfo.cedula_especialidad, color_primario: medicoInfo.color_primario, color_secundario: medicoInfo.color_secundario, direccion_consultorio: medicoInfo.direccion_consultorio, telefono_consultorio: medicoInfo.telefono_consultorio, firma_url: medicoInfo.firma_url ?? null } : null
      const logoUrl = medicoInfo?.logo_url?.startsWith('https://') ? medicoInfo.logo_url : undefined
      const fechaFmt = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })

      await generarPdf({
        tipo: 'escrito_medico',
        medico: medicoData,
        data: { paciente, fecha: fechaFmt, asunto, cuerpo: contenido },
        logoUrl,
        filename: 'escrito-medico.pdf',
      })
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
        className="doc-print-btn w-full flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50"
      >
        {imprimiendo
          ? <><Loader2 size={18} className="animate-spin" /> Generando PDF...</>
          : <><Printer size={18} /> Imprimir Escrito Médico</>
        }
      </button>
    </div>
  )
}
