'use client'

import { useState } from 'react'
import { Printer, Loader2, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react'
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

const SECCIONES_DEFAULT = {
  preoperatorio: `Después de haberle realizado historia clínica y estudios diagnósticos pertinentes (análisis de laboratorio, estudios de imagen u otros según el caso), se ha establecido el diagnóstico descrito y, habiendo agotado otras alternativas de tratamiento, se le recomienda someterse al procedimiento indicado. Se le indicará el tiempo necesario de ayuno previo y las indicaciones preoperatorias correspondientes.`,

  beneficios: `El fin primordial del procedimiento es corregir la condición diagnosticada, proteger las estructuras anatómicas involucradas, mantener o restaurar la función y evitar la progresión de la enfermedad, la cual podría producir lesiones más serias o dolor incapacitante. Los resultados esperados incluyen mejoría del dolor, recuperación funcional y mejora en la calidad de vida, aunque estos no pueden garantizarse en su totalidad, ya que dependen de múltiples factores individuales.`,

  anestesia: `La intervención puede precisar anestesia, cuyo tipo y modalidad serán valorados en forma individual de acuerdo con las características del paciente y del procedimiento. El médico anestesiólogo le informará cuál es la alternativa más adecuada para su caso y resolverá cualquier duda al respecto.`,

  descripcion: `Describir aquí el procedimiento quirúrgico: vía de abordaje, técnica a utilizar, estructuras involucradas, materiales o implantes a emplear (si aplica), y cualquier aspecto relevante específico de esta cirugía. Si durante el procedimiento fuera necesario modificar la técnica inicialmente planeada, el equipo médico tomará la decisión más conveniente para preservar la salud del paciente.`,

  riesgosComunes: `Cualquier procedimiento quirúrgico conlleva riesgos comunes independientemente de la técnica empleada, que incluyen pero no se limitan a: sangrado transoperatorio o postoperatorio, infección superficial o profunda de la herida quirúrgica, reacciones adversas a la anestesia o medicamentos, trombosis venosa profunda, tromboembolismo pulmonar, cicatrización anómala (cicatriz hipertrófica o queloide), dehiscencia de herida, y en casos excepcionales, complicaciones graves que podrían requerir tratamientos complementarios médicos o quirúrgicos e incluso, en un mínimo porcentaje de casos, ser causa de muerte.\n\nCuando sea médicamente necesario, el paciente autoriza la transfusión de sangre y/o hemoderivados en la cantidad y frecuencia requeridas, habiendo sido informado de que las transfusiones no siempre producen el resultado deseado y que existe la posibilidad de resultados no favorables.`,

  riesgosEspecificos: `Describir aquí los riesgos específicos propios de este procedimiento: complicaciones neurológicas, vasculares, de implantes, u otras que correspondan a la cirugía en cuestión, indicando frecuencia aproximada cuando sea posible (ej. "en alrededor del 1% de los casos").\n\nSi surgiera alguna situación imprevista durante la intervención que precisara la realización de un procedimiento distinto al informado, se consultará con el familiar autorizado. Únicamente cuando las eventualidades acontecidas pongan en riesgo la vida del paciente, se autoriza al equipo quirúrgico para adoptar la decisión más conveniente conforme a la normatividad vigente.`,

  alternativas: `Como alternativa al procedimiento propuesto, el paciente puede optar por tratamiento conservador que incluye manejo analgésico y antiinflamatorio, reposo relativo, rehabilitación física, uso de ortesis o inmovilización y otras medidas paliativas. Dicho tratamiento posiblemente mejore los síntomas sin resolver la causa de fondo, pudiendo requerir manejo definitivo en el futuro.`,
}

type SeccionKey = keyof typeof SECCIONES_DEFAULT

const LABELS: Record<SeccionKey, { num: string; titulo: string; hint: string }> = {
  preoperatorio:      { num: '1', titulo: 'Preoperatorio',                hint: 'Describe los estudios realizados, el diagnóstico y el procedimiento recomendado.' },
  beneficios:         { num: '2', titulo: 'Beneficios esperados',          hint: 'Explica los objetivos y resultados esperados del procedimiento.' },
  anestesia:          { num: '3', titulo: 'Anestesia',                     hint: 'Indica el tipo de anestesia prevista y quién informará al paciente.' },
  descripcion:        { num: '4', titulo: 'Descripción del procedimiento', hint: 'Detalla la técnica quirúrgica, vía de abordaje e implantes a utilizar.' },
  riesgosComunes:     { num: '5', titulo: 'Riesgos comunes',               hint: 'Riesgos inherentes a cualquier procedimiento quirúrgico.' },
  riesgosEspecificos: { num: '6', titulo: 'Riesgos específicos',           hint: 'Riesgos propios de esta cirugía en particular.' },
  alternativas:       { num: '7', titulo: 'Alternativas de tratamiento',   hint: 'Opciones disponibles en lugar del procedimiento propuesto.' },
}

function SeccionCard({
  seccionKey, value, onChange,
}: { seccionKey: SeccionKey; value: string; onChange: (v: string) => void }) {
  const [abierta, setAbierta] = useState(true)
  const { num, titulo, hint } = LABELS[seccionKey]

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierta(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="w-6 h-6 rounded-full bg-[#1e5fa8] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
          {num}
        </span>
        <span className="font-semibold text-slate-700 text-sm flex-1">{titulo}</span>
        {abierta ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
      </button>

      {abierta && (
        <div className="px-5 pb-4">
          <p className="text-xs text-slate-400 mb-2">{hint}</p>
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={5}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8] resize-y"
          />
        </div>
      )}
    </div>
  )
}

export default function ConsentimientoInformadoForm({ pacienteInicial = '', pacienteId, diagnosticoInicial = '' }: Props) {
  const { medicoInfo } = useMedicoInfo()

  // Campos de identificación
  const [paciente, setPaciente]               = useState(pacienteInicial)
  const [fecha, setFecha]                     = useState(new Date().toISOString().split('T')[0])
  const [expediente, setExpediente]           = useState('')
  const [edad, setEdad]                       = useState('')
  const [idPaciente, setIdPaciente]           = useState('')
  const [procedimiento, setProcedimiento]     = useState(diagnosticoInicial)
  const [diagnostico, setDiagnostico]         = useState('')
  const [familiar, setFamiliar]               = useState('')
  const [idFamiliar, setIdFamiliar]           = useState('')
  const [representante, setRepresentante]     = useState('')
  const [idRepresentante, setIdRepresentante] = useState('')
  const [anestesiologo, setAnestesiologo]     = useState('')
  const [testigo1, setTestigo1]               = useState('')
  const [testigo2, setTestigo2]               = useState('')
  const [autorizaTransfusion, setAutorizaTransfusion] = useState<'si' | 'no' | null>(null)
  const [autorizaFotos, setAutorizaFotos]     = useState(false)

  // Secciones editables
  const [secciones, setSecciones] = useState({ ...SECCIONES_DEFAULT })

  const [imprimiendo, setImprimiendo] = useState(false)

  function updateSeccion(key: SeccionKey, val: string) {
    setSecciones(s => ({ ...s, [key]: val }))
  }

  function nl2p(text: string): string {
    return text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .map(l => `<p style="margin-bottom:6px;">${l}</p>`)
      .join('')
  }

  async function imprimir() {
    flushSync(() => setImprimiendo(true))
    try {
      const supabase = createClient()
      await supabase.from('documentos').insert({
        ...(pacienteId ? { paciente_id: pacienteId } : {}),
        tipo: 'consentimiento_informado',
        contenido: {
          paciente, fecha, expediente, edad, idPaciente, procedimiento, diagnostico,
          familiar, idFamiliar, representante, idRepresentante, anestesiologo,
          testigo1, testigo2, autorizaTransfusion, autorizaFotos,
          secciones,
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

      const firmaBox = (label: string, nombre2: string = '', sublabel: string = '', idLabel: string = '', idVal: string = '') => `
        <div class="firma-box">
          <div class="firma-espacio"></div>
          <div class="firma-linea">
            <div class="firma-nombre">${nombre2 || '___________________________________'}</div>
            <div class="firma-rol">${label}</div>
            ${sublabel ? `<div class="firma-ced">${sublabel}</div>` : ''}
          </div>
          ${idLabel ? `<div class="firma-id"><span class="firma-id-lbl">${idLabel}:</span> ${idVal || '___________________________'}</div>` : ''}
        </div>`

      const _html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Consentimiento Informado</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Georgia&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: letter; margin: 0; }
  body { font-family:'Roboto',Arial,sans-serif; font-size:9.5pt; color:#1a1a1a; }
  .watermark { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-25deg); width:280px; height:280px; object-fit:contain; opacity:0.04; pointer-events:none; z-index:0; }
  .barra-top { background:linear-gradient(135deg,${cp},${cs}); height:10px; }
  .contenido { padding:8mm 16mm 6mm; position:relative; z-index:1; }
  .header { display:flex; align-items:center; gap:14px; padding-bottom:8px; margin-bottom:10px; border-bottom:2px solid ${cp}; }
  .logo-wrap { width:58px; height:58px; border-radius:50%; border:2.5px solid ${cs}; overflow:hidden; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:#f8fafc; }
  .logo { width:100%; height:100%; object-fit:contain; }
  .doctor-name { font-size:12pt; font-weight:700; color:${cp}; }
  .especialidad { font-size:8pt; color:${cs}; margin:2px 0; font-style:italic; }
  .credenciales { font-size:7.5pt; color:#555; }
  .contacto { font-size:7pt; color:#888; margin-top:2px; }
  .titulo-doc { text-align:center; margin:10px 0 8px; border:2px solid ${cp}; border-radius:4px; padding:7px; background:#f8fafc; }
  .titulo-doc h1 { font-size:12pt; font-weight:800; color:${cp}; text-transform:uppercase; letter-spacing:1.5px; }
  ${procedimiento ? `.titulo-doc .subtitulo { font-size:8.5pt; color:#555; margin-top:3px; }` : ''}
  .datos-grid { display:grid; grid-template-columns:1fr 1fr; gap:0; border:1.5px solid #d1d5db; border-radius:4px; overflow:hidden; margin-bottom:10px; font-size:8.5pt; }
  .dato-row { display:contents; }
  .dato-cell { padding:4px 8px; border-bottom:1px solid #e5e7eb; }
  .dato-cell:nth-child(odd) { border-right:1px solid #e5e7eb; }
  .dato-lbl { font-weight:700; color:${cp}; font-size:7.5pt; text-transform:uppercase; }
  .dato-val { color:#1e293b; border-bottom:1px solid #9ca3af; min-width:80px; display:inline-block; }
  .intro { font-size:8.5pt; line-height:1.55; color:#1a1a1a; margin-bottom:10px; text-align:justify; padding:8px 10px; background:#f8fafc; border-left:3px solid ${cp}; border-radius:0 4px 4px 0; }
  .seccion { margin-bottom:8px; }
  .sec-header { display:flex; align-items:center; gap:7px; margin-bottom:4px; }
  .sec-num { width:18px; height:18px; border-radius:50%; background:${cp}; color:#fff; font-size:8pt; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .sec-titulo { font-size:9pt; font-weight:700; color:${cp}; text-transform:uppercase; letter-spacing:0.5px; }
  .sec-cuerpo { font-family:Georgia,'Times New Roman',serif; font-size:9pt; line-height:1.6; color:#1a1a1a; text-align:justify; padding-left:25px; }
  .sec-cuerpo p { margin-bottom:5px; }
  .consentimiento-titulo { text-align:center; font-size:11pt; font-weight:800; color:${cp}; text-transform:uppercase; letter-spacing:1px; margin:14px 0 8px; border-top:2px solid ${cp}; padding-top:10px; }
  .consentimiento-body { font-size:8.5pt; line-height:1.6; color:#1a1a1a; text-align:justify; margin-bottom:10px; }
  .consentimiento-body p { margin-bottom:6px; }
  .firmas-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px 20px; margin-top:16px; }
  .firma-box { }
  .firma-espacio { height:32px; }
  .firma-linea { border-top:1.5px solid ${cp}; padding-top:4px; }
  .firma-nombre { font-weight:700; font-size:8.5pt; color:${cp}; }
  .firma-rol { font-size:7.5pt; color:#555; margin-top:1px; }
  .firma-ced { font-size:7pt; color:#888; }
  .firma-id { font-size:7pt; color:#666; margin-top:3px; padding:2px 0; border-top:1px dotted #d1d5db; }
  .firma-id-lbl { font-weight:700; color:#555; }
  .page-break { page-break-before:always; }
  .denegacion-titulo { text-align:center; font-size:12pt; font-weight:800; color:${cp}; text-transform:uppercase; letter-spacing:1px; margin:16px 0 10px; border:2px solid ${cp}; padding:8px; border-radius:4px; background:#f8fafc; }
  .denegacion-body { font-size:9pt; line-height:1.65; color:#1a1a1a; text-align:justify; margin-bottom:14px; padding:10px; border:1.5px solid #d1d5db; border-radius:4px; }
  .barra-bottom { background:linear-gradient(135deg,${cp},${cs}); height:7px; margin-top:10px; }
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
    <h1>Consentimiento Médico Informado</h1>
    ${procedimiento ? `<div class="subtitulo">${procedimiento}</div>` : ''}
  </div>

  <div class="intro">
    De acuerdo a la Norma Oficial Mexicana del expediente clínico NOM-004-SSA3-2012, se deberá autorizar y firmar el presente Consentimiento Médico Informado. Por medio de este documento, usted, su representante legal o familiar, recibirá información médica clara y comprensible acerca del procedimiento al que será sometido, sus beneficios, riesgos y alternativas disponibles. Se le ha <strong>INFORMADO Y ACLARADO</strong> todas sus dudas y preguntas con respecto al procedimiento.<br><br>
    <em>He leído este documento y lo suscribo de manera libre y voluntaria.</em>
  </div>

  <div class="datos-grid">
    <div class="dato-cell"><span class="dato-lbl">Lugar y Fecha: </span><span class="dato-val">${fechaFmt}</span></div>
    <div class="dato-cell"><span class="dato-lbl">No. Expediente: </span><span class="dato-val">${expediente || ''}</span></div>
    <div class="dato-cell"><span class="dato-lbl">Nombre del Paciente: </span><span class="dato-val">${paciente || ''}</span></div>
    <div class="dato-cell"><span class="dato-lbl">Edad: </span><span class="dato-val">${edad || ''}</span></div>
    <div class="dato-cell" style="grid-column:span 2"><span class="dato-lbl">Identificado con: </span><span class="dato-val">${idPaciente || ''}</span></div>
    <div class="dato-cell"><span class="dato-lbl">Familiar Responsable: </span><span class="dato-val">${familiar || ''}</span></div>
    <div class="dato-cell"><span class="dato-lbl">Identificado con: </span><span class="dato-val">${idFamiliar || ''}</span></div>
    ${representante ? `<div class="dato-cell" style="grid-column:span 2"><span class="dato-lbl">Representante Legal: </span><span class="dato-val">${representante}</span></div>
    <div class="dato-cell" style="grid-column:span 2"><span class="dato-lbl">Identificado con: </span><span class="dato-val">${idRepresentante}</span></div>` : ''}
    ${diagnostico ? `<div class="dato-cell" style="grid-column:span 2"><span class="dato-lbl">Diagnóstico: </span><span class="dato-val">${diagnostico}</span></div>` : ''}
  </div>

  ${(Object.keys(secciones) as SeccionKey[]).map(key => `
  <div class="seccion">
    <div class="sec-header">
      <div class="sec-num">${LABELS[key].num}</div>
      <div class="sec-titulo">${LABELS[key].titulo}</div>
    </div>
    <div class="sec-cuerpo">${nl2p(secciones[key])}</div>
  </div>`).join('')}

  <div class="consentimiento-titulo">Consentimiento</div>

  <div class="consentimiento-body">
    <p>Yo: <strong>${paciente || '___________________________________'}</strong>, en pleno uso de mis facultades mentales y en estado de máximo alerta, por medio del presente acepto y autorizo al <strong>${nombre}</strong>${cedProf ? ` con Cédula Profesional No. ${cedProf}` : ''}${cedEsp ? ` y Cédula de Especialidad No. ${cedEsp}` : ''} para que sea realizado el procedimiento de <strong>${procedimiento || '___________________________________'}</strong>.</p>
    ${anestesiologo ? `<p>El paciente acepta que el médico anestesiólogo sea: <strong>${anestesiologo}</strong>, quien decidirá la mejor alternativa de anestesia para el caso.</p>` : ''}
    <p>Comprendo que, a pesar de las medidas de higiene y seguridad establecidas, el acto quirúrgico y la estancia en la institución son factores de riesgo para infecciones intrahospitalarias, que son poco comunes pero posibles.</p>
    <p>Así mismo, entiendo plenamente que la <strong>MEDICINA NO ES UNA CIENCIA EXACTA</strong>, por tanto el resultado no asegura una certeza de eficacia al 100%, así como tampoco de curación.</p>
    <p>Estoy consciente de que los riesgos y reacciones adversas descritos pueden presentarse en cualquier momento, antes, durante y después del procedimiento, y autorizo al personal médico para contrarrestarlos.</p>
    ${autorizaTransfusion !== null ? `<p>Autorizo la transfusión de sangre y/o hemoderivados: <strong>${autorizaTransfusion === 'si' ? 'SÍ' : 'NO'}</strong>.</p>` : ''}
    ${autorizaFotos ? `<p>Autorizo expresamente que las fotografías tomadas antes y después del procedimiento sean utilizadas para fines educativos y formación académica, de conformidad al artículo 87 de la Ley Federal de Derechos de Autor.</p>` : ''}
  </div>

  <div class="firmas-grid">
    ${firmaBox('Nombre y Firma del Paciente', paciente, '', 'Identificado con', idPaciente)}
    ${firmaBox('Nombre y Firma del Médico Tratante', nombre, cedProf ? `Céd. Prof. ${cedProf}` : '')}
    ${firmaBox('Nombre y Firma del Familiar / Representante', familiar || representante, '', 'Identificado con', idFamiliar || idRepresentante)}
    ${firmaBox('Nombre y Firma del Médico')}
    ${firmaBox('Nombre y Firma del Testigo', testigo1, '', 'Identificado con', '')}
    ${firmaBox('Nombre y Firma del Testigo', testigo2, '', 'Identificado con', '')}
  </div>

</div>
<div class="barra-bottom"></div>

<!-- DENEGACIÓN O REVOCACIÓN -->
<div class="page-break"></div>
<div class="barra-top"></div>
<div class="contenido">

  <div class="header">
    <div class="logo-wrap"><img class="logo" src="${logoUrl}" onerror="this.style.display='none'" /></div>
    <div>
      <div class="doctor-name">${nombre}</div>
      ${esp ? `<div class="especialidad">${esp}</div>` : ''}
      <div class="credenciales">
        ${cedProf ? `Cédula Prof.: ${cedProf}` : ''}
        ${cedProf && cedEsp ? ' &nbsp;·&nbsp; ' : ''}
        ${cedEsp ? `Cédula Esp.: ${cedEsp}` : ''}
      </div>
    </div>
  </div>

  <div class="denegacion-titulo">Denegación o Revocación del Consentimiento</div>

  <div class="denegacion-body">
    <p>Yo: <strong>${paciente || '___________________________________'}</strong>, después de ser informado de la naturaleza y riesgos del procedimiento propuesto, manifiesto de forma libre y consciente mi <strong>DENEGACIÓN / REVOCACIÓN</strong> (táchese lo que no proceda) para su realización, haciéndome responsable de las consecuencias que puedan derivarse de esta decisión.</p>
  </div>

  <div class="firmas-grid">
    ${firmaBox('Nombre y Firma del Paciente', paciente, '', 'Identificado con', idPaciente)}
    ${firmaBox('Nombre y Firma del Médico Tratante', nombre, cedProf ? `Céd. Prof. ${cedProf}` : '')}
    ${firmaBox('Nombre y Firma del Familiar', familiar || representante, '', 'Identificado con', idFamiliar || idRepresentante)}
    ${firmaBox('Nombre y Firma del Médico Responsable')}
    ${firmaBox('Nombre y Firma del Testigo', testigo1, '', 'Identificado con', '')}
    ${firmaBox('Nombre y Firma del Testigo', testigo2, '', 'Identificado con', '')}
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

  return (
    <div className="space-y-4">

      {/* Datos de identificación */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={15} className="text-[#1e5fa8]" />
          <h2 className="font-semibold text-slate-700 text-sm">Datos de identificación</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Paciente</label>
            <input type="text" value={paciente} onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">No. Expediente</label>
            <input type="text" value={expediente} onChange={e => setExpediente(e.target.value)} placeholder="Ej: 2024-001" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Edad del paciente</label>
            <input type="text" value={edad} onChange={e => setEdad(e.target.value)} placeholder="Ej: 45 años" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Identificado con</label>
            <input type="text" value={idPaciente} onChange={e => setIdPaciente(e.target.value)} placeholder="Ej: INE 123456789" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Procedimiento</label>
            <input type="text" value={procedimiento} onChange={e => setProcedimiento(e.target.value)} placeholder="Ej: Artrodesis cervical anterior" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Diagnóstico</label>
            <input type="text" value={diagnostico} onChange={e => setDiagnostico(e.target.value)} placeholder="Diagnóstico principal" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Familiar responsable</label>
            <input type="text" value={familiar} onChange={e => setFamiliar(e.target.value)} placeholder="Nombre completo" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Identificación del familiar</label>
            <input type="text" value={idFamiliar} onChange={e => setIdFamiliar(e.target.value)} placeholder="Ej: INE 987654321" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Representante legal <span className="text-slate-300">(si aplica)</span></label>
            <input type="text" value={representante} onChange={e => setRepresentante(e.target.value)} placeholder="Nombre completo" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Identificación del representante</label>
            <input type="text" value={idRepresentante} onChange={e => setIdRepresentante(e.target.value)} placeholder="Tipo y número de ID" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Médico anestesiólogo <span className="text-slate-300">(si aplica)</span></label>
            <input type="text" value={anestesiologo} onChange={e => setAnestesiologo(e.target.value)} placeholder="Nombre del anestesiólogo" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Testigo 1</label>
            <input type="text" value={testigo1} onChange={e => setTestigo1(e.target.value)} placeholder="Nombre del testigo" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Testigo 2</label>
            <input type="text" value={testigo2} onChange={e => setTestigo2(e.target.value)} placeholder="Nombre del testigo" className={inputCls} />
          </div>
        </div>

        {/* Autorizaciones */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-2">Autoriza transfusión de sangre</label>
            <div className="flex gap-3">
              {(['si', 'no'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAutorizaTransfusion(v)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    autorizaTransfusion === v
                      ? v === 'si' ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {v === 'si' ? 'Sí' : 'No'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-3 pt-1">
            <input
              type="checkbox"
              id="autorizaFotos"
              checked={autorizaFotos}
              onChange={e => setAutorizaFotos(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#1e5fa8]"
            />
            <label htmlFor="autorizaFotos" className="text-xs text-slate-600 leading-relaxed cursor-pointer">
              Autoriza uso de fotografías para fines educativos y publicación académica
            </label>
          </div>
        </div>
      </div>

      {/* Secciones clínicas */}
      {(Object.keys(secciones) as SeccionKey[]).map(key => (
        <SeccionCard
          key={key}
          seccionKey={key}
          value={secciones[key]}
          onChange={v => updateSeccion(key, v)}
        />
      ))}

      <button
        onClick={imprimir}
        disabled={imprimiendo}
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
