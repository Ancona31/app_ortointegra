'use client'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'

import { useState } from 'react'

import { Printer, Loader2 } from 'lucide-react'
import { flushSync } from 'react-dom'
import { imprimirOCompartir } from '@/lib/mobileShare'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'

const TIPOS_ESTUDIO = ['Radiografía', 'Resonancia Magnética (RMN)', 'Tomografía (TAC)', 'Ultrasonido', 'Densitometría Ósea', 'Gammagrafía', 'Mielograma', 'Electromiografía (EMG)']
const REGIONES = ['Columna Cervical', 'Columna Torácica', 'Columna Lumbar', 'Columna Lumbosacra', 'Columna Total', 'Hombro Der.', 'Hombro Izq.', 'Codo Der.', 'Codo Izq.', 'Muñeca Der.', 'Muñeca Izq.', 'Cadera Der.', 'Cadera Izq.', 'Rodilla Der.', 'Rodilla Izq.', 'Tobillo Der.', 'Tobillo Izq.', 'Pie Der.', 'Pie Izq.', 'Pelvis', 'Tórax']

type Estudio = { tipo: string; region: string; proyecciones?: string; indicacion?: string }

interface Props {
  pacienteInicial?: string
  diagnosticoInicial?: string
  pacienteId?: string
}

export default function SolicitudImagenForm({ pacienteInicial = '', diagnosticoInicial = '', pacienteId }: Props) {
  const { medicoInfo } = useMedicoInfo()
  const [paciente, setPaciente] = useState(pacienteInicial)
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial)
  const [estudios, setEstudios] = useState<Estudio[]>([{ tipo: '', region: '', proyecciones: '', indicacion: '' }])
  const [urgente, setUrgente] = useState(false)
  const [imprimiendo, setImprimiendo] = useState(false)

  function addEstudio() { setEstudios([...estudios, { tipo: '', region: '', proyecciones: '', indicacion: '' }]) }
  function updateEstudio(i: number, field: keyof Estudio, val: string) {
    setEstudios(estudios.map((e, idx) => idx === i ? { ...e, [field]: val } : e))
  }

  async function imprimir() {
    flushSync(() => setImprimiendo(true))
    try {
    if (pacienteId) {
      const supabase = createClient()
      supabase.from('documentos').insert({
        paciente_id: pacienteId,
        tipo: 'imagen',
        contenido: { paciente, diagnostico, estudios: estudios.filter(e => e.tipo && e.region), urgente, fecha },
      }).then(({ error }) => { if (error) console.error('Error guardando documento:', error) })
    }

    const fechaFormat = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })
    const listaEstudios = estudios.filter(e => e.tipo && e.region).map(e => `
      <div class="estudio">
        <p class="est-nombre">${e.tipo} de ${e.region}${e.proyecciones ? ` (${e.proyecciones})` : ''}</p>
        ${e.indicacion ? `<p class="est-indicacion">${e.indicacion}</p>` : ''}
      </div>`).join('')
    const doctorNombre = medicoInfo?.nombre || 'Médico'
    const doctorEspecialidad = medicoInfo?.especialidad || ''
    const cedulas = [
      medicoInfo?.cedula_profesional ? `Céd. Prof. ${medicoInfo.cedula_profesional}` : '',
      medicoInfo?.cedula_especialidad ? `Céd. Esp. ${medicoInfo.cedula_especialidad}` : '',
    ].filter(Boolean).join(' · ')
    const logoUrl = medicoInfo?.logo_url || `${window.location.origin}/logo.png`

    const _html = `
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Solicitud Imagen</title>
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
  .urgente-badge { background:#dc2626; color:white; text-align:center; padding:4px; font-weight:bold; margin-bottom:10px; }
  .dato-row { display:flex; gap:6px; margin-bottom:8px; }
  .dato-label { font-weight:bold; min-width:100px; color:#1a3a5c; }
  .dato-valor { border-bottom:1px solid #aaa; flex:1; }
  .seccion { font-size:11pt; font-weight:bold; color:#1a3a5c; border-bottom:1px solid #1a3a5c; padding-bottom:3px; margin:16px 0 10px; }
  .estudio { margin-bottom:12px; padding:8px; border-left:3px solid #1e5fa8; background:#f8f9fa; }
  .est-nombre { font-weight:bold; }
  .est-indicacion { font-size:10pt; color:#555; margin-top:2px; }
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
  <div class="titulo-doc">Solicitud de Estudios de Imagen</div>
  ${urgente ? '<div class="urgente-badge">⚠ URGENTE</div>' : ''}
  <div class="dato-row"><span class="dato-label">Fecha:</span><span class="dato-valor">${fechaFormat}</span></div>
  <div class="dato-row"><span class="dato-label">Paciente:</span><span class="dato-valor">${paciente}</span></div>
  <div class="dato-row"><span class="dato-label">Diagnóstico:</span><span class="dato-valor">${diagnostico}</span></div>
  <div class="seccion">Estudios solicitados:</div>
  ${listaEstudios}
  <div class="footer"><div class="firma"><p>${doctorNombre}</p>${medicoInfo?.cedula_profesional ? `<p>Céd. Prof. ${medicoInfo.cedula_profesional}</p>` : ''}</div></div>
</body></html>`
    await imprimirOCompartir(_html, 'solicitud-imagenologia.pdf')
    } finally { setImprimiendo(false) }
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
            <input type="text" value={diagnostico} onChange={e => setDiagnostico(e.target.value)} placeholder="Dx de envío" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" /></div>
        </div>
        <label className="flex items-center gap-2 mt-4 text-sm text-red-600 cursor-pointer font-medium">
          <input type="checkbox" checked={urgente} onChange={e => setUrgente(e.target.checked)} className="w-4 h-4 accent-red-600" />
          Marcar como URGENTE
        </label>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 text-sm">Estudios de imagen</h2>
          <button onClick={addEstudio} className="text-xs text-[#1e5fa8] hover:text-[#1a3a5c] font-medium">+ Agregar</button>
        </div>
        <div className="divide-y divide-slate-100">
          {estudios.map((e, i) => (
            <div key={i} className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500 block mb-1">Tipo de estudio</label>
                <select value={e.tipo} onChange={ev => updateEstudio(i, 'tipo', ev.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30">
                  <option value="">Seleccionar...</option>
                  {TIPOS_ESTUDIO.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500 block mb-1">Región anatómica</label>
                <select value={e.region} onChange={ev => updateEstudio(i, 'region', ev.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30">
                  <option value="">Seleccionar...</option>
                  {REGIONES.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Proyecciones</label>
                <input type="text" value={e.proyecciones || ''} onChange={ev => updateEstudio(i, 'proyecciones', ev.target.value)} placeholder="AP, Lateral, etc."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
              </div>
              <div className="sm:col-span-3">
                <label className="text-xs text-slate-500 block mb-1">Indicación clínica específica</label>
                <input type="text" value={e.indicacion || ''} onChange={ev => updateEstudio(i, 'indicacion', ev.target.value)} placeholder="Ej: Descartar fractura vertebral"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={imprimir} disabled={!paciente || estudios.filter(e => e.tipo && e.region).length === 0 || imprimiendo}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50">
        {imprimiendo ? <><Loader2 size={18} className="animate-spin" /> Generando PDF...</> : <><Printer size={18} /> Imprimir Solicitud</>}
      </button>
    </div>
  )
}
