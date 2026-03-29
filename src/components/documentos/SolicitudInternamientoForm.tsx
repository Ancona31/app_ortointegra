'use client'

import { useState, useEffect } from 'react'
import { Printer, Loader2, Plus, Trash2 } from 'lucide-react'
import { flushSync } from 'react-dom'
import { imprimirOCompartir } from '@/lib/mobileShare'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'

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

interface Props {
  pacienteInicial?: string
  diagnosticoInicial?: string
  pacienteId?: string
}

const TIPOS_INTERNAMIENTO = [
  'Cirugía electiva',
  'Cirugía de urgencia',
  'Procedimiento diagnóstico',
  'Tratamiento médico',
  'Rehabilitación',
]

const ASA = ['I', 'II', 'III', 'IV', 'V', 'E (Emergencia)']

const REQUERIMIENTOS = [
  'Sangre y hemoderivados',
  'Unidad de Cuidados Intensivos (UCI)',
  'Material de osteosíntesis',
  'Implante especial',
  'Ayuno preoperatorio',
  'Profilaxis antibiótica',
  'Tromboprofilaxis',
]

export default function SolicitudInternamientoForm({ pacienteInicial = '', diagnosticoInicial = '', pacienteId }: Props) {
  const [medicoInfo, setMedicoInfo] = useState<MedicoInfo | null>(null)
  const [paciente, setPaciente] = useState(pacienteInicial)
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [fechaIngreso, setFechaIngreso] = useState('')
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial)
  const [diagnosticosSecundarios, setDiagnosticosSecundarios] = useState<string[]>([''])
  const [tipoInternamiento, setTipoInternamiento] = useState('')
  const [procedimiento, setProcedimiento] = useState('')
  const [diasEstimados, setDiasEstimados] = useState('')
  const [asa, setAsa] = useState('')
  const [urgente, setUrgente] = useState(false)
  const [requerimientos, setRequerimientos] = useState<string[]>([])
  const [requerimientosExtra, setRequerimientosExtra] = useState('')
  const [justificacion, setJustificacion] = useState('')
  const [imprimiendo, setImprimiendo] = useState(false)

  useEffect(() => {
    fetch('/api/me/perfil-medico').then(r => r.json()).then(({ medico }) => setMedicoInfo(medico))
  }, [])

  function toggleRequerimiento(r: string) {
    setRequerimientos(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  }

  function addDx() { setDiagnosticosSecundarios(prev => [...prev, '']) }
  function updateDx(i: number, val: string) {
    setDiagnosticosSecundarios(prev => prev.map((d, idx) => idx === i ? val : d))
  }
  function removeDx(i: number) {
    setDiagnosticosSecundarios(prev => prev.filter((_, idx) => idx !== i))
  }

  async function imprimir() {
    flushSync(() => setImprimiendo(true))
    try {
      const supabase = createClient()
      await supabase.from('documentos').insert({
        ...(pacienteId ? { paciente_id: pacienteId } : {}),
        tipo: 'solicitud_internamiento',
        contenido: {
          paciente, fecha, fechaIngreso, diagnostico,
          diagnosticosSecundarios: diagnosticosSecundarios.filter(Boolean),
          tipoInternamiento, procedimiento, diasEstimados,
          asa, urgente, requerimientos, requerimientosExtra, justificacion,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
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

      const fechaFormat = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })
      const fechaIngresoFormat = fechaIngreso
        ? format(new Date(fechaIngreso + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })
        : '—'

      const dxSecList = diagnosticosSecundarios.filter(Boolean)
      const reqList = [...requerimientos, ...(requerimientosExtra ? [requerimientosExtra] : [])].filter(Boolean)

      const _html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Solicitud de Internamiento — ${paciente}</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: letter; margin: 0; }
  body { font-family: 'Roboto', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; position: relative; }

  .watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-25deg);
    width: 320px; height: 320px; object-fit: contain; opacity: 0.05;
    pointer-events: none; z-index: 0;
  }
  .barra-top { background: linear-gradient(135deg, ${cp} 0%, ${cs} 100%); height: 12px; }
  .contenido { padding: 12mm 18mm 10mm; position: relative; z-index: 1; }

  .header { display: flex; align-items: center; gap: 18px; padding-bottom: 12px; margin-bottom: 12px; border-bottom: 2px solid ${cp}; }
  .logo-wrap { width: 70px; height: 70px; border-radius: 50%; border: 3px solid ${cs}; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #f8fafc; }
  .logo { width: 100%; height: 100%; object-fit: contain; }
  .header-info { flex: 1; }
  .doctor-name { font-size: 14pt; font-weight: bold; color: ${cp}; line-height: 1.2; }
  .especialidad { font-size: 9pt; color: ${cs}; margin: 3px 0; font-style: italic; }
  .credenciales { font-size: 8pt; color: #666; }
  .contacto { font-size: 7.5pt; color: #888; margin-top: 3px; }

  .titulo-banner {
    background: linear-gradient(135deg, ${cp} 0%, ${cs} 100%);
    color: #fff; text-align: center; font-size: 11pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 2px;
    padding: 8px 0; border-radius: 4px; margin-bottom: 14px;
  }
  ${urgente ? `.urgente { background: #dc2626; color: #fff; text-align: center; font-size: 9pt; font-weight: 700; padding: 5px; border-radius: 4px; margin-bottom: 10px; letter-spacing: 1px; }` : ''}

  .datos-box { background: linear-gradient(135deg, ${cp}08, ${cs}08); border-left: 4px solid ${cs}; border-radius: 0 6px 6px 0; padding: 9px 14px; margin-bottom: 14px; }
  .datos-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px 20px; }
  .dato { display: flex; gap: 6px; align-items: baseline; font-size: 9pt; }
  .dato-label { font-weight: bold; color: ${cp}; white-space: nowrap; font-size: 8pt; text-transform: uppercase; }
  .dato-valor { flex: 1; border-bottom: 1px solid #d1d5db; padding-bottom: 1px; }

  .seccion-header { display: flex; align-items: center; gap: 8px; margin: 12px 0 7px; }
  .seccion-linea { flex: 1; height: 1px; background: linear-gradient(to right, ${cp}, transparent); }
  .seccion-titulo { font-size: 7.5pt; font-weight: bold; color: ${cp}; text-transform: uppercase; letter-spacing: 1.5px; background: ${cp}12; padding: 3px 10px; border-radius: 20px; white-space: nowrap; }

  .campo { font-size: 9.5pt; line-height: 1.5; color: #2d2d2d; text-align: justify; }
  .campo-row { display: flex; gap: 8px; margin-bottom: 5px; font-size: 9pt; }
  .campo-label { font-weight: bold; color: ${cp}; min-width: 140px; font-size: 8.5pt; }
  .campo-valor { flex: 1; border-bottom: 1px solid #d1d5db; padding-bottom: 1px; }

  .dx-principal { font-weight: 700; color: #111; font-size: 10pt; }
  .dx-secundario { font-size: 9pt; color: #555; margin-top: 2px; }
  .dx-bullet { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${cs}; margin-right: 6px; vertical-align: middle; }

  .req-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
  .req-badge { background: ${cp}12; color: ${cp}; font-size: 8pt; font-weight: 600; padding: 3px 10px; border-radius: 20px; border: 1px solid ${cp}30; }

  .justificacion { font-size: 9.5pt; line-height: 1.6; color: #2d2d2d; text-align: justify; white-space: pre-line; }

  .footer-area { margin-top: 24px; display: flex; justify-content: flex-end; }
  .firma { text-align: center; min-width: 210px; border-top: 1.5px solid ${cp}; padding-top: 8px; }
  .firma-nombre { font-weight: bold; font-size: 9.5pt; color: ${cp}; }
  .firma-ced { font-size: 8pt; color: #666; margin-top: 2px; }

  .barra-bottom { background: linear-gradient(135deg, ${cp} 0%, ${cs} 100%); height: 8px; margin-top: 16px; }

  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
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
  </div>

  <div class="titulo-banner">Solicitud de Internamiento Hospitalario</div>
  ${urgente ? '<div class="urgente">⚠ URGENTE — REQUIERE ATENCIÓN INMEDIATA</div>' : ''}

  <div class="datos-box">
    <div class="datos-grid">
      <div class="dato"><span class="dato-label">Fecha</span><span class="dato-valor">${fechaFormat}</span></div>
      <div class="dato"><span class="dato-label">Paciente</span><span class="dato-valor">${paciente}</span></div>
      <div class="dato"><span class="dato-label">Fecha de ingreso</span><span class="dato-valor">${fechaIngresoFormat}</span></div>
      ${tipoInternamiento ? `<div class="dato"><span class="dato-label">Tipo</span><span class="dato-valor">${tipoInternamiento}</span></div>` : ''}
      ${diasEstimados ? `<div class="dato"><span class="dato-label">Días estimados</span><span class="dato-valor">${diasEstimados}</span></div>` : ''}
      ${asa ? `<div class="dato"><span class="dato-label">Clasificación ASA</span><span class="dato-valor">${asa}</span></div>` : ''}
    </div>
  </div>

  <div class="seccion-header"><div class="seccion-linea"></div><div class="seccion-titulo">Diagnósticos</div><div class="seccion-linea"></div></div>
  <p class="dx-principal">${diagnostico || '—'}</p>
  ${dxSecList.length > 0 ? dxSecList.map(d => `<p class="dx-secundario"><span class="dx-bullet"></span>${d}</p>`).join('') : ''}

  ${procedimiento ? `
  <div class="seccion-header"><div class="seccion-linea"></div><div class="seccion-titulo">Procedimiento / Cirugía</div><div class="seccion-linea"></div></div>
  <p class="campo">${procedimiento}</p>
  ` : ''}

  ${reqList.length > 0 ? `
  <div class="seccion-header"><div class="seccion-linea"></div><div class="seccion-titulo">Requerimientos especiales</div><div class="seccion-linea"></div></div>
  <div class="req-grid">${reqList.map(r => `<span class="req-badge">${r}</span>`).join('')}</div>
  ` : ''}

  ${justificacion ? `
  <div class="seccion-header"><div class="seccion-linea"></div><div class="seccion-titulo">Justificación clínica</div><div class="seccion-linea"></div></div>
  <p class="justificacion">${justificacion}</p>
  ` : ''}

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

      await imprimirOCompartir(_html, 'solicitud-internamiento.pdf')
    } finally {
      setImprimiendo(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]'

  return (
    <div className="space-y-5">

      {/* Datos generales */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-4">Datos generales</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Fecha de solicitud</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Paciente <span className="text-red-400">*</span></label>
            <input type="text" value={paciente} onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Fecha propuesta de ingreso</label>
            <input type="date" value={fechaIngreso} onChange={e => setFechaIngreso(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Tipo de internamiento</label>
            <select value={tipoInternamiento} onChange={e => setTipoInternamiento(e.target.value)} className={inputCls}>
              <option value="">Seleccionar...</option>
              {TIPOS_INTERNAMIENTO.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Días estimados de hospitalización</label>
            <input type="text" value={diasEstimados} onChange={e => setDiasEstimados(e.target.value)} placeholder="Ej: 3-5 días" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Clasificación ASA</label>
            <select value={asa} onChange={e => setAsa(e.target.value)} className={inputCls}>
              <option value="">Seleccionar...</option>
              {ASA.map(a => <option key={a} value={`ASA ${a}`}>ASA {a}</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 mt-4 text-sm text-red-600 cursor-pointer font-medium select-none">
          <input type="checkbox" checked={urgente} onChange={e => setUrgente(e.target.checked)} className="w-4 h-4 accent-red-600" />
          Marcar como URGENTE
        </label>
      </div>

      {/* Diagnósticos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700 text-sm">Diagnósticos</h2>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Diagnóstico principal <span className="text-red-400">*</span></label>
            <input type="text" value={diagnostico} onChange={e => setDiagnostico(e.target.value)} placeholder="Diagnóstico principal de ingreso" className={inputCls} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500">Diagnósticos secundarios</label>
              <button onClick={addDx} className="text-xs text-[#1e5fa8] hover:text-[#1a3a5c] font-medium flex items-center gap-1">
                <Plus size={12} /> Agregar
              </button>
            </div>
            <div className="space-y-2">
              {diagnosticosSecundarios.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" value={d} onChange={e => updateDx(i, e.target.value)} placeholder={`Secundario ${i + 1}`} className={inputCls} />
                  {diagnosticosSecundarios.length > 1 && (
                    <button onClick={() => removeDx(i)} className="text-slate-300 hover:text-red-400 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Procedimiento */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <label className="text-xs font-medium text-slate-500 block mb-1">Procedimiento / Cirugía solicitada</label>
        <textarea value={procedimiento} onChange={e => setProcedimiento(e.target.value)}
          placeholder="Ej: Artrodesis posterolateral L4-L5 con tornillos pediculares e injerto óseo autólogo..."
          rows={2} className={`${inputCls} resize-none`} />
      </div>

      {/* Requerimientos especiales */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-3">Requerimientos especiales</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {REQUERIMIENTOS.map(r => (
            <button key={r} onClick={() => toggleRequerimiento(r)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                requerimientos.includes(r)
                  ? 'bg-[#1e5fa8] text-white border-[#1e5fa8]'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-[#1e5fa8] hover:text-[#1e5fa8]'
              }`}>
              {r}
            </button>
          ))}
        </div>
        <input type="text" value={requerimientosExtra} onChange={e => setRequerimientosExtra(e.target.value)}
          placeholder="Otro requerimiento..." className={inputCls} />
      </div>

      {/* Justificación clínica */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <label className="text-xs font-medium text-slate-500 block mb-1">Justificación clínica</label>
        <textarea value={justificacion} onChange={e => setJustificacion(e.target.value)}
          placeholder="Descripción clínica que justifica el internamiento: evolución del padecimiento, hallazgos, fracaso de tratamiento conservador..."
          rows={4} className={`${inputCls} resize-y`} />
      </div>

      <button
        onClick={imprimir}
        disabled={!paciente || !diagnostico || imprimiendo}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50"
      >
        {imprimiendo
          ? <><Loader2 size={18} className="animate-spin" /> Generando PDF...</>
          : <><Printer size={18} /> Imprimir Solicitud de Internamiento</>}
      </button>
    </div>
  )
}
