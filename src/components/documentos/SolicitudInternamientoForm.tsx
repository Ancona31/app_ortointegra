'use client'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'

import { useState, useCallback } from 'react'
import { Printer, Loader2, Plus, Trash2 } from 'lucide-react'
import { flushSync } from 'react-dom'
import { generarPdf } from '@/lib/mobileShare'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'

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
  const { medicoInfo } = useMedicoInfo()
  const [paciente, setPaciente] = useState(pacienteInicial)
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [fechaIngreso, setFechaIngreso] = useState('')
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial)
  const [diagnosticosSecundarios, setDiagnosticosSecundarios] = useState<string[]>([''])
  const [tipoInternamiento, setTipoInternamiento] = useState('')
  const [procedimiento, setProcedimiento] = useState('')
  const [diasEstimados, setDiasEstimados] = useState('')
  const [asa, setAsa] = useState('')
  const [lugar, setLugar] = useState('')
  const [urgente, setUrgente] = useState(false)
  const [requerimientos, setRequerimientos] = useState<string[]>([])
  const [requerimientosExtra, setRequerimientosExtra] = useState('')
  const [justificacion, setJustificacion] = useState('')
  const [instruccionesPaciente, setInstruccionesPaciente] = useState(
`• Presentarse en Admisión Hospitalaria con: identificación oficial vigente, esta hoja de internamiento, estudios recientes (laboratorios, radiografías, resonancias) y Valoración preoperatoria (Muy Importante).
• Ayuno estricto de 8 horas antes del procedimiento. La cena deberá de ser ligera.
• No traer objetos de valor, joyas ni alhajas.
• Venir acompañado de un familiar mayor de edad responsable.
• Si toma medicamentos antihipertensivos o de la tiroides, NO los suspenda sin consultarnos antes.
• Traer ropa cómoda y artículos de aseo personal para su estancia.`
  )
  const [indicacionesPiso, setIndicacionesPiso] = useState('')
  const [imprimiendo, setImprimiendo] = useState(false)

  const toggleRequerimiento = useCallback((r: string) => {
    setRequerimientos(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  }, [])

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
          paciente, fecha, fechaIngreso, lugar, diagnostico,
          diagnosticosSecundarios: diagnosticosSecundarios.filter(Boolean),
          tipoInternamiento, procedimiento, diasEstimados,
          asa, urgente, requerimientos, requerimientosExtra, justificacion,
          instruccionesPaciente, indicacionesPiso,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      })

      const medicoData = medicoInfo ? { nombre: medicoInfo.nombre, especialidad: medicoInfo.especialidad, cedula_profesional: medicoInfo.cedula_profesional, cedula_especialidad: medicoInfo.cedula_especialidad, color_primario: medicoInfo.color_primario, color_secundario: medicoInfo.color_secundario, direccion_consultorio: medicoInfo.direccion_consultorio, telefono_consultorio: medicoInfo.telefono_consultorio, firma_url: medicoInfo.firma_url ?? null } : null
      const logoUrl = medicoInfo?.logo_url?.startsWith('https://') ? medicoInfo.logo_url : undefined
      const fechaFormat = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })
      const fechaIngresoFormat = fechaIngreso ? format(new Date(fechaIngreso + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es }) : undefined

      await generarPdf({
        tipo: 'solicitud_internamiento',
        medico: medicoData,
        data: {
          paciente, fecha: fechaFormat, fechaIngreso: fechaIngresoFormat, lugar,
          diagnostico, diagnosticosSecundarios: diagnosticosSecundarios.filter(Boolean),
          tipoInternamiento, procedimiento, diasEstimados, asa, urgente,
          requerimientos: [...requerimientos, ...(requerimientosExtra ? [requerimientosExtra] : [])].filter(Boolean),
          justificacion, instruccionesPaciente, indicacionesPiso,
        },
        logoUrl,
        filename: 'solicitud-internamiento.pdf',
      })
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
        <div className="mt-4">
          <label className="text-xs font-medium text-slate-500 block mb-1">
            Hospital / Lugar de internamiento <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={lugar}
            onChange={e => setLugar(e.target.value)}
            placeholder="Ej: Hospital General de México, Hospital Ángeles Lomas..."
            className={inputCls}
          />
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

      {/* Instrucciones para el paciente */}
      <div className="bg-amber-50 rounded-xl border border-amber-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📋</span>
          <div>
            <h2 className="font-semibold text-amber-800 text-sm">Instrucciones para el paciente</h2>
            <p className="text-xs text-amber-600">Trámite de ingreso — aparece en el documento impreso</p>
          </div>
        </div>
        <textarea value={instruccionesPaciente} onChange={e => setInstruccionesPaciente(e.target.value)}
          rows={7} className="w-full px-3 py-2 border border-amber-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 bg-white" />
      </div>

      {/* Indicaciones de ingreso a piso */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🏥</span>
          <div>
            <h2 className="font-semibold text-[#1a3a5c] text-sm">Indicaciones de ingreso a piso</h2>
            <p className="text-xs text-blue-500">Para personal de enfermería y médico residente</p>
          </div>
        </div>
        <textarea value={indicacionesPiso} onChange={e => setIndicacionesPiso(e.target.value)}
          placeholder={`Ej:\n1. Dieta: Ayuno\n2. Soluciones: SSN 0.9% 1000 ml a 60 ml/hr\n3. Medicamentos: Ketorolaco 30mg IV c/8hrs, Omeprazol 40mg IV c/24hrs\n4. Monitoreo: Signos vitales c/4hrs\n5. Laboratorios de ingreso: BH, QS, TP, TTP, Grupo y Rh\n6. Posición: Semi-Fowler\n7. Actividad: Reposo relativo en cama`}
          rows={8} className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8] bg-white" />
      </div>

      <button
        onClick={imprimir}
        disabled={!paciente || !diagnostico || !lugar || imprimiendo}
        className="doc-print-btn w-full flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50"
      >
        {imprimiendo
          ? <><Loader2 size={18} className="animate-spin" /> Generando PDF...</>
          : <><Printer size={18} /> Imprimir Solicitud de Internamiento</>}
      </button>
    </div>
  )
}
