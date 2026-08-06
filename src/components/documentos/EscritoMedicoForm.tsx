'use client'
import { generateDocFileName } from '@/lib/patientUtils'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'

import { useState } from 'react'
import {
  Printer, Loader2, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Minus, RemoveFormatting,
} from 'lucide-react'
import { flushSync } from 'react-dom'
import { generarPdf } from '@/lib/mobileShare'
import { useToast } from '@/components/ui/Toast'
import ModalDocumentoGenerado from '@/components/documentos/ModalDocumentoGenerado'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { hoyEnTZ } from '@/lib/dates'
import DOMPurify from 'dompurify'
import { decodificarNbsp } from '@/lib/textUtils'

import { useEditor, EditorContent } from '@tiptap/react'
import { generateHTML } from '@tiptap/core'
import { editorExtensions } from '@/lib/documentos/editorExtensions'

// Sanitización con DOMPurify — cubre SVG scripts, iframes, event handlers
// y todos los vectores de XSS conocidos.
function sanitizeEditorHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'h2', 'h3', 'div', 'span', 'hr', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['style', 'class'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'link'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus'],
  })
}

// Aplana el HTML producido por TipTap para que el parser regex actual
// de EscritoMedicoPdf.tsx (Phase 3 lo reemplaza) no pierda información:
//   <h1> → <h2>     (parser legacy solo conoce h2/h3)
//   <ul><li>x</li>… → <p>• x</p>…
//   <ol><li>x</li>… → <p>1. x</p>…
// Listas anidadas no soportadas — se aplanan al primer nivel.
// Las alineaciones quedan como style="text-align:…" e igual son
// ignoradas por el parser legacy (mismo comportamiento que pre-refactor).
// TEMPORAL — se elimina junto al campo `cuerpo` en Phase 5.
function postProcesarParaParserLegacy(html: string): string {
  let out = html
  out = out.replace(/<h1(\s[^>]*)?>/gi, '<h2$1>').replace(/<\/h1>/gi, '</h2>')
  out = out.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, inner: string) => {
    const items = (inner.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [])
      .map(li => li
        .replace(/<\/?li(?:\s[^>]*)?>/gi, '')
        .replace(/<\/?p(?:\s[^>]*)?>/gi, '')
        .trim()
      )
    return items.map(t => `<p>• ${t}</p>`).join('')
  })
  out = out.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, inner: string) => {
    const items = (inner.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [])
      .map(li => li
        .replace(/<\/?li(?:\s[^>]*)?>/gi, '')
        .replace(/<\/?p(?:\s[^>]*)?>/gi, '')
        .trim()
      )
    return items.map((t, i) => `<p>${i + 1}. ${t}</p>`).join('')
  })
  return out
}

interface Props {
  pacienteInicial?: string
  pacienteId?: string
  offlineMode?: boolean
  onOfflineSave?: () => void
}

const TAMANOS = [
  { label: 'Normal',           value: 'p'  },
  { label: 'Título principal', value: 'h1' },
  { label: 'Título',           value: 'h2' },
  { label: 'Subtítulo',        value: 'h3' },
] as const

export default function EscritoMedicoForm({ pacienteInicial = '', pacienteId, offlineMode, onOfflineSave }: Props) {
  const { medicoInfo: onlineMedicoInfo, isLoading: cargandoPerfil } = useMedicoInfo()
  const { consultorioActivo } = useConsultorioActivo()

  // En offline mode, leer perfil del médico de localStorage (pre-fetched
  // con assets en Base64).
  const offlineProfile = offlineMode ? (() => {
    try {
      const raw = localStorage.getItem('spinus_doctor_profile')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  })() : null

  const medicoInfo = offlineMode && offlineProfile ? {
    ...onlineMedicoInfo,
    nombre: offlineProfile.nombre,
    especialidad: offlineProfile.especialidad,
    cedula_profesional: offlineProfile.cedula_profesional,
    cedula_especialidad: offlineProfile.cedula_especialidad,
    universidad: offlineProfile.universidad,
    direccion_consultorio: offlineProfile.direccion_consultorio,
    telefono_consultorio: offlineProfile.telefono_consultorio,
    color_primario: offlineProfile.color_primario,
    color_secundario: offlineProfile.color_secundario,
    logo_url: offlineProfile.logo_base64,
    firma_url: offlineProfile.firma_base64,
    clinica_nombre: offlineProfile.clinica_nombre,
  } : onlineMedicoInfo

  // Imprimir antes de que resuelva el perfil produce un PDF con el encabezado
  // vacío: sin nombre, sin cédulas, sin domicilio. Solo bloquea mientras carga;
  // si resuelve sin datos el botón se habilita igual.
  const perfilPendiente = cargandoPerfil && !medicoInfo

  const toast = useToast()
  const [paciente, setPaciente]       = useState(pacienteInicial)
  const [fecha, setFecha]             = useState(hoyEnTZ())
  const [asunto, setAsunto]           = useState('')
  const [imprimiendo, setImprimiendo] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [docGenerado, setDocGenerado] = useState<{ blob: Blob; guardado: boolean } | null>(null)

  const editor = useEditor({
    extensions: editorExtensions,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'min-h-[380px] p-5 text-sm leading-relaxed focus:outline-none escrito-editor-prose',
      },
    },
  })

  const isEmpty = editor?.isEmpty ?? true

  function setBlockType(value: string) {
    if (!editor) return
    if (value === 'p')       editor.chain().focus().setParagraph().run()
    else if (value === 'h1') editor.chain().focus().setHeading({ level: 1 }).run()
    else if (value === 'h2') editor.chain().focus().setHeading({ level: 2 }).run()
    else if (value === 'h3') editor.chain().focus().setHeading({ level: 3 }).run()
  }

  function currentBlockValue(): string {
    if (!editor) return 'p'
    if (editor.isActive('heading', { level: 1 })) return 'h1'
    if (editor.isActive('heading', { level: 2 })) return 'h2'
    if (editor.isActive('heading', { level: 3 })) return 'h3'
    return 'p'
  }

  async function imprimir() {
    if (!editor || editor.isEmpty) return

    const docJson      = editor.getJSON()
    const htmlBruto    = generateHTML(docJson, editorExtensions)
    const htmlAplanado = postProcesarParaParserLegacy(htmlBruto)
    const cuerpoSanitizado = decodificarNbsp(sanitizeEditorHtml(htmlAplanado))
    if (!cuerpoSanitizado.trim()) return

    const asuntoLimpio = decodificarNbsp(asunto)

    flushSync(() => { setErrorGuardado(''); setImprimiendo(true) })
    toast.info('Generando escrito médico...')

    const clientId = crypto.randomUUID()
    const docContenido = {
      paciente,
      fecha,
      asunto: asuntoLimpio,
      doc: { schema: 'tiptap-doc-v1' as const, content: docJson },
      cuerpo: cuerpoSanitizado,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }

    let pdfGenerated = false
    // El blob y el desenlace de la persistencia se leen en el finally para
    // montar el modal posterior a la generación. Ver ModalDocumentoGenerado.
    let pdfBlob: Blob | null = null
    let guardado = false

    try {
      const medicoData = medicoInfo ? {
        nombre: medicoInfo.nombre,
        titulo: medicoInfo.titulo ?? null,
        nombres: medicoInfo.nombres ?? null,
        apellido_paterno: medicoInfo.apellido_paterno ?? null,
        apellido_materno: medicoInfo.apellido_materno ?? null,
        especialidad: medicoInfo.especialidad,
        cedula_profesional: medicoInfo.cedula_profesional,
        cedula_especialidad: medicoInfo.cedula_especialidad,
        color_primario: medicoInfo.color_primario,
        color_secundario: medicoInfo.color_secundario,
        direccion_consultorio: medicoInfo.direccion_consultorio,
        telefono_consultorio: medicoInfo.telefono_consultorio,
        firma_url: medicoInfo.firma_url ?? null,
      } : null

      const logoUrl = medicoInfo?.logo_url?.startsWith('https://') ? medicoInfo.logo_url : undefined
      const fechaFmt = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })

      const consultorioData = consultorioActivo ? {
        nombre: consultorioActivo.nombre,
        direccion: consultorioActivo.direccion,
        telefono: consultorioActivo.telefono,
      } : undefined

      const { blob, storagePath } = await generarPdf({
        tipo: 'escrito_medico',
        pacienteId,
        medico: medicoData,
        data: { paciente, fecha: fechaFmt, asunto: asuntoLimpio, cuerpo: cuerpoSanitizado, doc: { schema: 'tiptap-doc-v1' as const, content: docJson } },
        logoUrl,
        filename: generateDocFileName(paciente, 'Escrito_Medico'),
        consultorio: consultorioData,
        // El búnker offline queda intacto: sigue entregando el PDF él mismo y
        // no monta el modal — onOfflineSave desmonta el formulario al guardar.
        entregar: !!offlineMode,
      })

      pdfGenerated = true
      pdfBlob = blob

      if (offlineMode) {
        const { addDocument } = await import('@/lib/offline/db')
        const { getOfflineIdentity } = await import('@/lib/offline/identity')
        await addDocument({
          id: crypto.randomUUID(),
          temp_patient_id: pacienteId ?? 'unknown',
          tipo: 'escrito_medico',
          contenido: docContenido,
          created_at: new Date().toISOString(),
          medico_id: getOfflineIdentity()?.userId ?? 'anonymous',
          _syncStatus: 'pending',
        })
        toast.success('Escrito medico guardado en bunker offline')
        onOfflineSave?.()
      } else {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No autenticado')

        const insertPayload: Record<string, unknown> = {
          tipo: 'escrito_medico',
          contenido: docContenido,
          client_id: clientId,
          pdf_url: storagePath,
          subido_por: user.id,
        }
        if (pacienteId) insertPayload.paciente_id = pacienteId

        const { error } = await supabase.from('documentos').insert(insertPayload)
        if (error) throw error

        // Sin storagePath la fila se inserta igual pero sin PDF en Storage:
        // mobileShare captura el error de subida y no lo relanza. El documento
        // no queda recuperable desde la lista y el modal tiene que decirlo.
        guardado = storagePath !== null
        toast.success('Escrito guardado')
      }
    } catch (err) {
      if (!pdfGenerated) {
        toast.error('No se pudo generar el PDF. Intenta de nuevo.')
        setErrorGuardado('No se pudo generar el PDF. Intenta de nuevo.')
      } else {
        toast.error('Escrito generado pero no se pudo guardar. Revisa errores de sincronización.')
        setErrorGuardado('Error al guardar el escrito.')
      }
      // eslint-disable-next-line no-console
      console.error('[EscritoMedicoForm] imprimir falló:', err)
    } finally {
      setImprimiendo(false)
      // También cuando la persistencia falló: el PDF existe y con el paciente
      // enfrente lo urgente es poder imprimirlo.
      if (pdfBlob && !offlineMode) setDocGenerado({ blob: pdfBlob, guardado })
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]'
  const tbBtn = 'p-1.5 rounded text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors'
  const tbBtnActive = 'p-1.5 rounded bg-slate-200 text-slate-800'
  const btnCls = (active: boolean) => active ? tbBtnActive : tbBtn

  return (
    <div className="space-y-5">

      {/* Estilo del placeholder + restauración de estilos default tras
          preflight de Tailwind 4 (que resetea ul/ol/h1-h6).
          Scopeado a .escrito-editor-prose — no afecta resto de la app. */}
      <style>{`
        .escrito-editor-prose p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: rgb(203 213 225);
          pointer-events: none;
          height: 0;
        }
        .escrito-editor-prose ul {
          list-style-type: disc;
          padding-left: 1.5em;
        }
        .escrito-editor-prose ol {
          list-style-type: decimal;
          padding-left: 1.5em;
        }
        .escrito-editor-prose h1 {
          font-size: 1.5em;
          font-weight: 700;
          line-height: 1.3;
          margin: 0.6em 0 0.3em;
        }
        .escrito-editor-prose h2 {
          font-size: 1.25em;
          font-weight: 700;
          line-height: 1.3;
          margin: 0.5em 0 0.3em;
        }
        .escrito-editor-prose h3 {
          font-size: 1.1em;
          font-weight: 700;
          line-height: 1.3;
          margin: 0.4em 0 0.2em;
        }
        .escrito-editor-prose hr {
          border: 0;
          border-top: 1px solid rgb(203 213 225);
          margin: 0.75em 0;
        }
      `}</style>

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

          <select
            onChange={e => setBlockType(e.target.value)}
            value={currentBlockValue()}
            className="text-xs border border-slate-200 rounded px-2 py-1 mr-1 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-[#1e5fa8]/30"
          >
            {TAMANOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          <button onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleBold().run() }}      title="Negrita (Ctrl+B)"   className={btnCls(!!editor?.isActive('bold'))}><Bold      size={14} /></button>
          <button onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleItalic().run() }}    title="Itálica (Ctrl+I)"   className={btnCls(!!editor?.isActive('italic'))}><Italic    size={14} /></button>
          <button onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleUnderline().run() }} title="Subrayado (Ctrl+U)" className={btnCls(!!editor?.isActive('underline'))}><Underline size={14} /></button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          <button onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleBulletList().run() }}  title="Lista con viñetas" className={btnCls(!!editor?.isActive('bulletList'))}><List         size={14} /></button>
          <button onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleOrderedList().run() }} title="Lista numerada"    className={btnCls(!!editor?.isActive('orderedList'))}><ListOrdered size={14} /></button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          <button onMouseDown={e => { e.preventDefault(); editor?.chain().focus().setTextAlign('left').run() }}    title="Izquierda"   className={btnCls(!!editor?.isActive({ textAlign: 'left' }))}><AlignLeft    size={14} /></button>
          <button onMouseDown={e => { e.preventDefault(); editor?.chain().focus().setTextAlign('center').run() }}  title="Centrado"    className={btnCls(!!editor?.isActive({ textAlign: 'center' }))}><AlignCenter  size={14} /></button>
          <button onMouseDown={e => { e.preventDefault(); editor?.chain().focus().setTextAlign('right').run() }}   title="Derecha"     className={btnCls(!!editor?.isActive({ textAlign: 'right' }))}><AlignRight   size={14} /></button>
          <button onMouseDown={e => { e.preventDefault(); editor?.chain().focus().setTextAlign('justify').run() }} title="Justificado" className={btnCls(!!editor?.isActive({ textAlign: 'justify' }))}><AlignJustify size={14} /></button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          <button onMouseDown={e => { e.preventDefault(); editor?.chain().focus().setHorizontalRule().run() }}                  title="Línea separadora" className={tbBtn}><Minus            size={14} /></button>
          <button onMouseDown={e => { e.preventDefault(); editor?.chain().focus().clearNodes().unsetAllMarks().run() }}         title="Limpiar formato"  className={tbBtn}><RemoveFormatting size={14} /></button>
        </div>

        {/* Área de escritura */}
        <EditorContent
          editor={editor}
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '10.5pt' }}
        />
      </div>

      {errorGuardado && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {errorGuardado}
        </div>
      )}

      <button
        onClick={imprimir}
        disabled={isEmpty || imprimiendo || perfilPendiente}
        className="doc-print-btn w-full flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50"
      >
        {imprimiendo
          ? <><Loader2 size={18} className="animate-spin" /> Generando PDF...</>
          : <><Printer size={18} /> Imprimir Escrito Médico</>
        }
      </button>

      <ModalDocumentoGenerado
        open={docGenerado !== null}
        onClose={() => setDocGenerado(null)}
        blob={docGenerado?.blob ?? null}
        titulo="Escrito médico"
        guardadoEnExpediente={docGenerado?.guardado ?? false}
      />
    </div>
  )
}
