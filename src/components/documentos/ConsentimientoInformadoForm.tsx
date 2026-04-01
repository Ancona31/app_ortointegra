'use client'

import { useRef, useState } from 'react'
import { Printer, Loader2, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignJustify, Minus, FileText, ChevronDown } from 'lucide-react'
import { flushSync } from 'react-dom'
import { imprimirOCompartir } from '@/lib/mobileShare'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'

interface Props {
  pacienteInicial?: string
  pacienteId?: string
  diagnosticoInicial?: string
}

function sanitizeEditorHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
    .replace(/src\s*=\s*["']javascript:[^"']*["']/gi, 'src="#"')
}

const TAMANOS = [
  { label: 'Normal', tag: 'p' },
  { label: 'Grande', tag: 'h3' },
  { label: 'Título', tag: 'h2' },
]

const PLANTILLAS: { label: string; procedimiento: string; cuerpo: string }[] = [
  {
    label: 'En blanco',
    procedimiento: '',
    cuerpo: '',
  },
  {
    label: 'Cirugía de columna (discectomía / fusión)',
    procedimiento: 'Cirugía de columna vertebral',
    cuerpo: `<p>Por medio del presente documento, yo <strong>[NOMBRE DEL PACIENTE]</strong>, con plena capacidad legal y habiendo recibido información suficiente, clara y comprensible por parte del médico tratante, manifiesto mi consentimiento libre y voluntario para someterme al procedimiento quirúrgico denominado <strong>[NOMBRE DEL PROCEDIMIENTO]</strong>.</p>

<h3>Descripción del procedimiento</h3>
<p>El procedimiento consiste en la intervención quirúrgica de la columna vertebral con el objetivo de descomprimir estructuras nerviosas, estabilizar segmentos vertebrales o ambos, según sea el caso clínico. El médico me ha explicado detalladamente en qué consiste la cirugía, el abordaje quirúrgico previsto y las técnicas que se emplearán.</p>

<h3>Beneficios esperados</h3>
<p>Mejoría del dolor, recuperación de la función neurológica, estabilización de la columna y mejora en la calidad de vida. El médico me ha informado que los resultados no pueden garantizarse en su totalidad y dependen de múltiples factores individuales.</p>

<h3>Riesgos y complicaciones</h3>
<p>He sido informado de los riesgos inherentes a este tipo de procedimiento, que incluyen pero no se limitan a: sangrado, infección de herida quirúrgica, trombosis venosa profunda, lesión neurológica transitoria o permanente, fístula de líquido cefalorraquídeo, pseudoartrosis, falla de implantes, y en casos excepcionales, complicaciones graves o muerte. Asimismo, se me han explicado los riesgos anestésicos correspondientes.</p>

<h3>Alternativas terapéuticas</h3>
<p>El médico me ha informado sobre las alternativas de tratamiento disponibles, incluyendo manejo conservador (fisioterapia, medicamentos, bloqueos), y me ha explicado las razones por las cuales se recomienda el procedimiento quirúrgico en mi caso específico.</p>

<h3>Declaración de consentimiento</h3>
<p>He tenido la oportunidad de formular todas mis preguntas, las cuales han sido respondidas de manera satisfactoria. He comprendido la información proporcionada y acepto voluntariamente someterme al procedimiento descrito. Entiendo que puedo revocar este consentimiento en cualquier momento antes del inicio del procedimiento.</p>`,
  },
  {
    label: 'Infiltración / Bloqueo',
    procedimiento: 'Infiltración / Bloqueo terapéutico',
    cuerpo: `<p>Por medio del presente documento, yo <strong>[NOMBRE DEL PACIENTE]</strong>, manifiesto mi consentimiento informado para someterme al procedimiento de <strong>infiltración / bloqueo terapéutico</strong> indicado por mi médico tratante.</p>

<h3>Descripción del procedimiento</h3>
<p>El procedimiento consiste en la aplicación de medicamento (corticoesteroide, anestésico local u otro agente terapéutico) mediante inyección dirigida a la zona afectada (articulación, espacio epidural, tejido blando u otro sitio anatómico). El médico me ha explicado el sitio de aplicación, la técnica a utilizar y los medicamentos a emplear.</p>

<h3>Beneficios esperados</h3>
<p>Reducción del dolor, disminución de la inflamación local y mejoría funcional. El médico me ha informado que los efectos pueden ser temporales y que pueden requerirse procedimientos adicionales.</p>

<h3>Riesgos y complicaciones</h3>
<p>He sido informado sobre los posibles riesgos, que incluyen: dolor transitorio en el sitio de inyección, sangrado local, infección, reacción alérgica a los medicamentos, elevación transitoria de glucosa en sangre (en pacientes diabéticos), daño a estructuras nerviosas o vasculares adyacentes, y en casos excepcionales, complicaciones sistémicas.</p>

<h3>Declaración de consentimiento</h3>
<p>He comprendido la información proporcionada, he resuelto mis dudas con el médico y acepto voluntariamente someterme al procedimiento descrito.</p>`,
  },
  {
    label: 'Procedimiento diagnóstico (EMG / artroscopia diagnóstica)',
    procedimiento: 'Procedimiento diagnóstico',
    cuerpo: `<p>Por medio del presente documento, yo <strong>[NOMBRE DEL PACIENTE]</strong>, otorgo mi consentimiento informado para la realización del procedimiento diagnóstico indicado por mi médico tratante.</p>

<h3>Descripción del procedimiento</h3>
<p>El procedimiento diagnóstico tiene como finalidad evaluar el estado de las estructuras anatómicas involucradas en mi padecimiento a través de exploración directa o registro de actividad eléctrica muscular / nerviosa. El médico me ha explicado en qué consiste el procedimiento y cómo se llevará a cabo.</p>

<h3>Beneficios esperados</h3>
<p>Obtención de información diagnóstica precisa que permita orientar el tratamiento más adecuado para mi condición clínica.</p>

<h3>Riesgos y complicaciones</h3>
<p>He sido informado sobre los posibles riesgos del procedimiento, que incluyen: molestia o dolor durante el procedimiento, sangrado mínimo en los sitios de exploración, infección, y en casos excepcionales, lesión de estructuras adyacentes.</p>

<h3>Declaración de consentimiento</h3>
<p>He comprendido la información proporcionada y acepto voluntariamente la realización del procedimiento diagnóstico descrito.</p>`,
  },
  {
    label: 'Cirugía de cadera o rodilla',
    procedimiento: 'Cirugía de cadera / rodilla',
    cuerpo: `<p>Por medio del presente documento, yo <strong>[NOMBRE DEL PACIENTE]</strong>, manifiesto mi consentimiento informado para someterme al procedimiento quirúrgico de <strong>[ESPECIFICAR: reemplazo total de cadera / rodilla, artroscopía, osteotomía, u otro]</strong>.</p>

<h3>Descripción del procedimiento</h3>
<p>El procedimiento consiste en la intervención quirúrgica de la articulación indicada con el objetivo de restaurar la función, aliviar el dolor y mejorar la calidad de vida. El médico me ha explicado detalladamente el tipo de cirugía, el abordaje previsto, los materiales de implante a utilizar (cuando aplica) y el proceso de recuperación esperado.</p>

<h3>Beneficios esperados</h3>
<p>Mejoría significativa del dolor, restauración de la movilidad articular y mejora en las actividades de la vida diaria. Se me ha informado que la recuperación funcional completa puede tomar entre 3 y 12 meses dependiendo del procedimiento y de las condiciones individuales del paciente.</p>

<h3>Riesgos y complicaciones</h3>
<p>He sido informado sobre los riesgos inherentes al procedimiento, que incluyen: sangrado, infección superficial o profunda, trombosis venosa profunda y tromboembolismo pulmonar, luxación del implante, falla o desgaste prematuro del implante, lesión neurovascular, dismetría de extremidades, rigidez articular, y en casos excepcionales, complicaciones graves o muerte.</p>

<h3>Alternativas terapéuticas</h3>
<p>Se me ha informado sobre las alternativas de tratamiento disponibles y las razones clínicas por las que se recomienda el abordaje quirúrgico en mi caso.</p>

<h3>Declaración de consentimiento</h3>
<p>He comprendido la información proporcionada, he formulado y resuelto mis preguntas, y acepto voluntariamente someterme al procedimiento descrito.</p>`,
  },
  {
    label: 'Manejo con opioides / medicamentos controlados',
    procedimiento: 'Tratamiento con medicamentos controlados',
    cuerpo: `<p>Por medio del presente documento, yo <strong>[NOMBRE DEL PACIENTE]</strong>, manifiesto mi consentimiento informado para recibir tratamiento con medicamentos analgésicos del grupo de los opioides u otras sustancias controladas indicadas por mi médico tratante para el manejo de dolor crónico.</p>

<h3>Descripción del tratamiento</h3>
<p>El tratamiento consiste en la prescripción y administración de medicamentos controlados con el objetivo de manejar adecuadamente el dolor crónico de origen músculo-esquelético / neuropático / post-quirúrgico. El médico me ha explicado los medicamentos a utilizar, la dosis, la vía de administración y la duración estimada del tratamiento.</p>

<h3>Compromisos del paciente</h3>
<p>Me comprometo a: tomar los medicamentos exclusivamente según la prescripción médica, no compartir ni vender los medicamentos, informar a mi médico sobre cualquier efecto secundario, no conducir vehículos ni operar maquinaria pesada bajo el efecto de los medicamentos, y acudir puntualmente a mis citas de seguimiento.</p>

<h3>Riesgos y efectos secundarios</h3>
<p>He sido informado sobre los posibles riesgos, que incluyen: somnolencia, mareo, estreñimiento, náuseas, tolerancia, dependencia física, depresión respiratoria (en sobredosis), y riesgo de trastorno por uso de sustancias. Entiendo que el uso inadecuado de estos medicamentos puede tener consecuencias legales.</p>

<h3>Declaración de consentimiento</h3>
<p>He comprendido la información proporcionada y acepto voluntariamente el tratamiento bajo las condiciones descritas.</p>`,
  },
]

export default function ConsentimientoInformadoForm({ pacienteInicial = '', pacienteId, diagnosticoInicial = '' }: Props) {
  const { medicoInfo } = useMedicoInfo()
  const [paciente, setPaciente]           = useState(pacienteInicial)
  const [fecha, setFecha]                 = useState(new Date().toISOString().split('T')[0])
  const [procedimiento, setProcedimiento] = useState(diagnosticoInicial)
  const [tutor, setTutor]                 = useState('')
  const [isEmpty, setIsEmpty]             = useState(true)
  const [imprimiendo, setImprimiendo]     = useState(false)
  const [plantillaOpen, setPlantillaOpen] = useState(false)
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

  function cargarPlantilla(plantilla: typeof PLANTILLAS[number]) {
    if (plantilla.procedimiento) setProcedimiento(plantilla.procedimiento)
    if (editorRef.current) {
      editorRef.current.innerHTML = plantilla.cuerpo
      setIsEmpty(!plantilla.cuerpo.trim())
    }
    setPlantillaOpen(false)
    editorRef.current?.focus()
  }

  async function imprimir() {
    const contenido = sanitizeEditorHtml(editorRef.current?.innerHTML ?? '')
    if (!contenido.trim()) return

    flushSync(() => setImprimiendo(true))
    try {
      const supabase = createClient()
      await supabase.from('documentos').insert({
        ...(pacienteId ? { paciente_id: pacienteId } : {}),
        tipo: 'consentimiento_informado',
        contenido: {
          paciente,
          fecha,
          procedimiento,
          tutor,
          cuerpo: contenido,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      })

      const cp      = medicoInfo?.color_primario       || '#1a3a5c'
      const cs      = medicoInfo?.color_secundario      || '#1e5fa8'
      const nombre  = medicoInfo?.nombre                || 'Médico'
      const esp     = medicoInfo?.especialidad          || ''
      const cedProf = medicoInfo?.cedula_profesional    || ''
      const cedEsp  = medicoInfo?.cedula_especialidad   || ''
      const dir     = medicoInfo?.direccion_consultorio || ''
      const tel     = medicoInfo?.telefono_consultorio  || ''
      const logoUrl = medicoInfo?.logo_url?.startsWith('https://')
        ? medicoInfo.logo_url
        : `${window.location.origin}/logo.png`

      const fechaFmt = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })

      const _html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Consentimiento Informado</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Georgia&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: letter; margin: 0; }
  body { font-family: 'Roboto', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; position: relative; }
  .watermark { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-25deg); width:300px; height:300px; object-fit:contain; opacity:0.04; pointer-events:none; z-index:0; }
  .barra-top { background:linear-gradient(135deg, ${cp} 0%, ${cs} 100%); height:12px; }
  .contenido { padding:10mm 18mm 8mm; position:relative; z-index:1; }
  .header { display:flex; align-items:center; gap:16px; padding-bottom:10px; margin-bottom:12px; border-bottom:2px solid ${cp}; }
  .logo-wrap { width:64px; height:64px; border-radius:50%; border:3px solid ${cs}; overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:#f8fafc; }
  .logo { width:100%; height:100%; object-fit:contain; }
  .doctor-name { font-size:13pt; font-weight:bold; color:${cp}; line-height:1.2; }
  .especialidad { font-size:8.5pt; color:${cs}; margin:2px 0; font-style:italic; }
  .credenciales { font-size:7.5pt; color:#555; }
  .contacto { font-size:7pt; color:#888; margin-top:2px; }
  .titulo-doc { text-align:center; margin:14px 0 12px; }
  .titulo-doc h1 { font-size:14pt; font-weight:800; color:${cp}; text-transform:uppercase; letter-spacing:2px; }
  .titulo-doc .subtitulo { font-size:8.5pt; color:#666; margin-top:3px; letter-spacing:0.5px; }
  .datos-paciente { border:1.5px solid ${cp}; border-radius:6px; padding:10px 14px; margin-bottom:14px; background:#f8fafc; }
  .datos-paciente table { width:100%; border-collapse:collapse; }
  .datos-paciente td { padding:3px 8px 3px 0; font-size:9pt; }
  .datos-paciente .lbl { font-weight:700; color:${cp}; font-size:8pt; text-transform:uppercase; white-space:nowrap; width:130px; }
  .datos-paciente .val { border-bottom:1px solid #d1d5db; padding-bottom:1px; }
  .cuerpo { font-family:Georgia, 'Times New Roman', serif; font-size:9.5pt; line-height:1.7; color:#1a1a1a; margin-bottom:16px; text-align:justify; }
  .cuerpo h2 { font-family:'Roboto',Arial,sans-serif; font-size:11pt; font-weight:700; color:${cp}; margin:12px 0 4px; text-align:left; }
  .cuerpo h3 { font-family:'Roboto',Arial,sans-serif; font-size:10pt; font-weight:700; color:${cp}; margin:10px 0 4px; text-align:left; }
  .cuerpo p { margin-bottom:5px; }
  .cuerpo p:empty::after { content:'\\00a0'; }
  .cuerpo hr { border:none; border-top:1px solid #d1d5db; margin:12px 0; }
  .firmas { margin-top:28px; display:grid; grid-template-columns:1fr 1fr; gap:24px; }
  .firma-box { text-align:center; }
  .firma-linea { border-top:1.5px solid ${cp}; margin-bottom:6px; padding-top:6px; }
  .firma-nombre { font-weight:700; font-size:9pt; color:${cp}; }
  .firma-rol { font-size:7.5pt; color:#666; margin-top:2px; }
  .firma-ced { font-size:7.5pt; color:#888; }
  .aviso-legal { margin-top:14px; padding:8px 12px; background:#f8fafc; border-left:3px solid ${cp}; font-size:7pt; color:#666; line-height:1.5; }
  .barra-bottom { background:linear-gradient(135deg, ${cp} 0%, ${cs} 100%); height:8px; margin-top:12px; }
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

  <div class="titulo-doc">
    <h1>Carta de Consentimiento Informado</h1>
    ${procedimiento ? `<div class="subtitulo">${procedimiento}</div>` : ''}
  </div>

  <div class="datos-paciente">
    <table>
      <tr>
        <td class="lbl">Paciente</td>
        <td class="val">${paciente || '___________________________________'}</td>
        <td class="lbl" style="padding-left:16px;">Fecha</td>
        <td class="val">${fechaFmt}</td>
      </tr>
      ${tutor ? `<tr>
        <td class="lbl">Tutor / Representante</td>
        <td class="val" colspan="3">${tutor}</td>
      </tr>` : ''}
    </table>
  </div>

  <div class="cuerpo">${contenido}</div>

  <div class="firmas">
    <div class="firma-box">
      <div style="height:40px;"></div>
      <div class="firma-linea">
        <div class="firma-nombre">${paciente || 'Paciente'}</div>
        <div class="firma-rol">Paciente${tutor ? ' / Tutor Legal' : ''}</div>
        ${tutor ? `<div class="firma-ced">${tutor}</div>` : ''}
      </div>
    </div>
    <div class="firma-box">
      <div style="height:40px;"></div>
      <div class="firma-linea">
        <div class="firma-nombre">${nombre}</div>
        <div class="firma-rol">Médico Tratante</div>
        ${cedProf ? `<div class="firma-ced">Céd. Prof. ${cedProf}</div>` : ''}
        ${cedEsp  ? `<div class="firma-ced">Céd. Esp. ${cedEsp}</div>` : ''}
      </div>
    </div>
  </div>

  <div class="aviso-legal">
    Este documento ha sido firmado de manera libre y voluntaria. El paciente declara haber recibido información suficiente sobre el procedimiento, sus riesgos, beneficios y alternativas, conforme a lo establecido en la NOM-004-SSA3-2012 relativa al expediente clínico y a la Ley General de Salud vigente.
  </div>

</div>
<div class="barra-bottom"></div>
</body></html>`

      await imprimirOCompartir(_html, 'consentimiento-informado.pdf')
    } finally {
      setImprimiendo(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]'
  const tbBtn = 'p-1.5 rounded text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors'

  return (
    <div className="space-y-5">

      {/* Selector de plantilla */}
      <div className="relative">
        <button
          onClick={() => setPlantillaOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm transition-colors"
        >
          <span className="flex items-center gap-2">
            <FileText size={16} className="text-[#1e5fa8]" />
            Cargar plantilla predefinida (opcional)
          </span>
          <ChevronDown size={15} className={`text-slate-400 transition-transform ${plantillaOpen ? 'rotate-180' : ''}`} />
        </button>
        {plantillaOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
            {PLANTILLAS.map((p, i) => (
              <button
                key={i}
                onClick={() => cargarPlantilla(p)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Datos del documento */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-4">Datos del consentimiento</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Paciente</label>
            <input type="text" value={paciente} onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Procedimiento / Diagnóstico</label>
            <input type="text" value={procedimiento} onChange={e => setProcedimiento(e.target.value)} placeholder="Ej: Cirugía de columna lumbar, Infiltración..." className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Tutor legal <span className="text-slate-300 font-normal">(si aplica)</span></label>
            <input type="text" value={tutor} onChange={e => setTutor(e.target.value)} placeholder="Nombre del tutor o representante legal" className={inputCls} />
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Barra de herramientas */}
        <div className="flex items-center gap-0.5 px-3 py-2 border-b border-slate-100 bg-slate-50 flex-wrap gap-y-1">
          <select
            onChange={e => setTamano(e.target.value)}
            defaultValue="p"
            className="text-xs border border-slate-200 rounded px-2 py-1 mr-1 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-[#1e5fa8]/30"
          >
            {TAMANOS.map(t => <option key={t.tag} value={t.tag}>{t.label}</option>)}
          </select>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <button onMouseDown={e => { e.preventDefault(); exec('bold') }}      title="Negrita"     className={tbBtn}><Bold      size={14} /></button>
          <button onMouseDown={e => { e.preventDefault(); exec('italic') }}    title="Itálica"     className={tbBtn}><Italic    size={14} /></button>
          <button onMouseDown={e => { e.preventDefault(); exec('underline') }} title="Subrayado"   className={tbBtn}><Underline size={14} /></button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <button onMouseDown={e => { e.preventDefault(); exec('justifyLeft')   }} title="Izquierda"   className={tbBtn}><AlignLeft    size={14} /></button>
          <button onMouseDown={e => { e.preventDefault(); exec('justifyCenter') }} title="Centrado"    className={tbBtn}><AlignCenter  size={14} /></button>
          <button onMouseDown={e => { e.preventDefault(); exec('justifyFull')   }} title="Justificado" className={tbBtn}><AlignJustify size={14} /></button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <button onMouseDown={e => { e.preventDefault(); exec('insertHorizontalRule') }} title="Separador" className={tbBtn}><Minus size={14} /></button>
        </div>

        {/* Área de escritura */}
        <div className="relative">
          {isEmpty && (
            <p className="absolute top-5 left-5 text-sm text-slate-300 pointer-events-none select-none">
              Redacta o selecciona una plantilla para comenzar...
            </p>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={onEditorInput}
            className="min-h-[420px] p-5 text-sm leading-relaxed focus:outline-none"
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
          : <><Printer size={18} /> Generar Consentimiento Informado</>
        }
      </button>
    </div>
  )
}
