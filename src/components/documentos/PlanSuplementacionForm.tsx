'use client'

import { useState, useEffect } from 'react'

type MedicoInfo = {
  nombre: string
  especialidad: string
  cedula_profesional: string
  cedula_especialidad: string
  logo_url: string | null
}
import { Printer } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'

const SUPLEMENTOS_DISPONIBLES = [
  { nombre: 'Vitamina D3 (Dosis de Carga)', dosis_default: '5,000 UI/día' },
  { nombre: 'Vitamina K2 MK-7', dosis_default: '100 mcg/día' },
  { nombre: 'Omega-3 EPA/DHA', dosis_default: '2-3 g/día con alimentos' },
  { nombre: 'Colágeno Hidrolizado + Vitamina C', dosis_default: '10-15 g + 500 mg en ayunas' },
  { nombre: 'Creatina Monohidratada', dosis_default: '5 g/día' },
  { nombre: 'Magnesio Glicinato / ZMA', dosis_default: '300-400 mg/día' },
  { nombre: 'Ashwagandha KSM-66', dosis_default: '300-600 mg/día' },
  { nombre: 'HMB (Beta-hidroxi-beta-metilbutirato)', dosis_default: '3 g/día (3 tomas)' },
]

type SupSelec = { nombre: string; dosis: string; justificacion: string }

interface Props {
  pacienteInicial?: string
  diagnosticoInicial?: string
  pacienteId?: string
}

export default function PlanSuplementacionForm({ pacienteInicial = '', diagnosticoInicial = '', pacienteId }: Props) {
  const [medicoInfo, setMedicoInfo] = useState<MedicoInfo | null>(null)
  const [paciente, setPaciente] = useState(pacienteInicial)

  useEffect(() => {
    fetch('/api/me/perfil-medico').then(r => r.json()).then(({ medico }) => setMedicoInfo(medico))
  }, [])
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial)
  const [seleccionados, setSeleccionados] = useState<SupSelec[]>([])
  const [notas, setNotas] = useState('')
  const [seguimiento, setSeguimiento] = useState('')

  function toggleSup(nombre: string, dosis_default: string) {
    if (seleccionados.find(s => s.nombre === nombre)) {
      setSeleccionados(seleccionados.filter(s => s.nombre !== nombre))
    } else {
      setSeleccionados([...seleccionados, { nombre, dosis: dosis_default, justificacion: '' }])
    }
  }

  function updateSup(nombre: string, field: keyof SupSelec, val: string) {
    setSeleccionados(seleccionados.map(s => s.nombre === nombre ? { ...s, [field]: val } : s))
  }

  function imprimir() {
    if (pacienteId) {
      const supabase = createClient()
      supabase.from('documentos').insert({
        paciente_id: pacienteId,
        tipo: 'suplementacion',
        contenido: { paciente, diagnostico, seleccionados, notas, seguimiento, fecha },
      }).then(() => {})
    }

    const ventana = window.open('', '_blank', 'width=800,height=600')
    if (!ventana) return
    const fechaFormat = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })
    const lista = seleccionados.map((s, i) => `
      <div class="sup">
        <p class="sup-nombre">${i + 1}. ${s.nombre}</p>
        <p class="sup-dosis">📋 Dosis: ${s.dosis}</p>
        ${s.justificacion ? `<p class="sup-just">Justificación: ${s.justificacion}</p>` : ''}
      </div>`).join('')
    const doctorNombre = medicoInfo?.nombre || 'Médico'
    const doctorEspecialidad = medicoInfo?.especialidad || ''
    const cedulas = [
      medicoInfo?.cedula_profesional ? `Céd. Prof. ${medicoInfo.cedula_profesional}` : '',
      medicoInfo?.cedula_especialidad ? `Céd. Esp. ${medicoInfo.cedula_especialidad}` : '',
    ].filter(Boolean).join(' · ')
    const logoUrl = medicoInfo?.logo_url || `${window.location.origin}/logo.png`

    ventana.document.write(`
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Plan de Suplementación</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: letter; margin: 15mm 20mm; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #1a1a1a; }
  .header { display:flex; align-items:center; gap:20px; padding-bottom:14px; border-bottom:3px solid #1a3a5c; margin-bottom:16px; }
  .logo { width:80px; height:80px; object-fit:contain; }
  .doctor-name { font-size:16pt; font-weight:bold; color:#1a3a5c; }
  .especialidad { font-size:10pt; color:#1e5fa8; margin:2px 0 4px; }
  .credenciales { font-size:9pt; color:#555; }
  .titulo-doc { text-align:center; font-size:14pt; font-weight:bold; color:#1a3a5c; text-transform:uppercase; margin:16px 0 14px; border:2px solid #1a3a5c; padding:6px; }
  .dato-row { display:flex; gap:6px; margin-bottom:8px; }
  .dato-label { font-weight:bold; min-width:100px; color:#1a3a5c; }
  .dato-valor { border-bottom:1px solid #aaa; flex:1; }
  .seccion { font-size:11pt; font-weight:bold; color:#1a3a5c; border-bottom:1px solid #1a3a5c; padding-bottom:3px; margin:16px 0 10px; }
  .sup { margin-bottom:14px; padding:10px; border-left:4px solid #1e5fa8; background:#f8f9fa; }
  .sup-nombre { font-weight:bold; font-size:11pt; color:#1a3a5c; }
  .sup-dosis { font-size:10pt; color:#1e5fa8; margin-top:3px; font-weight:bold; }
  .sup-just { font-size:9.5pt; color:#555; margin-top:2px; font-style:italic; }
  .nota { font-size:10pt; color:#333; margin-top:6px; line-height:1.6; white-space:pre-line; }
  .footer { margin-top:50px; display:flex; justify-content:flex-end; }
  .firma { text-align:center; border-top:1px solid #333; padding-top:6px; min-width:200px; font-size:9pt; color:#555; }
</style></head><body>
  <div class="header">
    <img class="logo" src="${logoUrl}" onerror="this.style.display='none'" />
    <div>
      <div class="doctor-name">${doctorNombre}</div>
      ${doctorEspecialidad ? `<div class="especialidad">${doctorEspecialidad}</div>` : ''}
      ${cedulas ? `<div class="credenciales">${cedulas}</div>` : ''}
    </div>
  </div>
  <div class="titulo-doc">Plan de Suplementación Osteomuscular</div>
  <div class="dato-row"><span class="dato-label">Fecha:</span><span class="dato-valor">${fechaFormat}</span></div>
  <div class="dato-row"><span class="dato-label">Paciente:</span><span class="dato-valor">${paciente}</span></div>
  <div class="dato-row"><span class="dato-label">Diagnóstico:</span><span class="dato-valor">${diagnostico}</span></div>
  <div class="seccion">Suplementos indicados:</div>
  ${lista}
  ${notas ? `<div class="seccion">Notas adicionales</div><p class="nota">${notas}</p>` : ''}
  ${seguimiento ? `<p style="margin-top:12px;font-size:10pt;"><strong>Control:</strong> ${seguimiento}</p>` : ''}
  <div class="footer"><div class="firma"><p>${doctorNombre}</p>${medicoInfo?.cedula_profesional ? `<p>Céd. Prof. ${medicoInfo.cedula_profesional}</p>` : ''}</div></div>
</body></html>`)
    ventana.document.close()
    ventana.focus()
    setTimeout(() => ventana.print(), 500)
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-4">Datos del paciente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><label className="text-xs font-medium text-slate-500 block mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" /></div>
          <div><label className="text-xs font-medium text-slate-500 block mb-1">Paciente <span className="text-red-400">*</span></label>
            <input type="text" value={paciente} onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" /></div>
          <div><label className="text-xs font-medium text-slate-500 block mb-1">Diagnóstico</label>
            <input type="text" value={diagnostico} onChange={e => setDiagnostico(e.target.value)} placeholder="Diagnóstico principal" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" /></div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-3">Seleccionar suplementos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SUPLEMENTOS_DISPONIBLES.map(s => {
            const sel = seleccionados.find(x => x.nombre === s.nombre)
            return (
              <button key={s.nombre} onClick={() => toggleSup(s.nombre, s.dosis_default)}
                className={`text-left px-4 py-3 rounded-lg border-2 text-sm transition-all ${sel ? 'border-[#1e5fa8] bg-blue-50 text-[#1a3a5c]' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                <span className="font-medium">{sel ? '✓ ' : ''}{s.nombre}</span>
                <span className="block text-xs text-slate-400 mt-0.5">{s.dosis_default}</span>
              </button>
            )
          })}
        </div>
      </div>

      {seleccionados.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700 text-sm">Personalizar dosis y justificación</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {seleccionados.map(s => (
              <div key={s.nombre} className="p-4 space-y-2">
                <p className="font-medium text-slate-700 text-sm">{s.nombre}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div><label className="text-xs text-slate-400">Dosis</label>
                    <input type="text" value={s.dosis} onChange={e => updateSup(s.nombre, 'dosis', e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" /></div>
                  <div><label className="text-xs text-slate-400">Justificación (opcional)</label>
                    <input type="text" value={s.justificacion} onChange={e => updateSup(s.nombre, 'justificacion', e.target.value)} placeholder="Ej: Vitamina D 18 ng/mL"
                      className="w-full mt-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="text-sm font-semibold text-slate-700 block mb-2">Notas adicionales</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Indicaciones generales..." rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" /></div>
        <div><label className="text-sm font-semibold text-slate-700 block mb-2">Cita de control</label>
          <input type="text" value={seguimiento} onChange={e => setSeguimiento(e.target.value)} placeholder="Ej: En 3 meses con nuevos laboratorios"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" /></div>
      </div>

      <button onClick={imprimir} disabled={!paciente || seleccionados.length === 0}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50">
        <Printer size={18} /> Imprimir Plan de Suplementación
      </button>
    </div>
  )
}
