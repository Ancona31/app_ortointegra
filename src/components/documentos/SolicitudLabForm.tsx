'use client'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { buildPdfHeader, buildPdfHeaderCss, buildPdfFirma, getPdfColors, getLogoUrl } from '@/lib/pdf/header'

import { useState } from 'react'

import { Plus, Trash2, Printer, Loader2 } from 'lucide-react'
import { flushSync } from 'react-dom'
import { imprimirOCompartir } from '@/lib/mobileShare'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import AutocompleteEstudio from '@/components/AutocompleteEstudio'
import { createClient } from '@/lib/supabase/client'

const ESTUDIOS_PRESET = [
  'Biometría Hemática',
  'Glucosa',
  'Urea',
  'Creatinina',
  'Examen General de Orina',
  'TP',
  'TPT',
  'Perfil Tiroideo Completo',
  'Urocultivo',
  'Cultivo de Secreción',
]

interface Props {
  pacienteInicial?: string
  diagnosticoInicial?: string
  pacienteId?: string
}

export default function SolicitudLabForm({ pacienteInicial = '', diagnosticoInicial = '', pacienteId }: Props) {
  const { medicoInfo } = useMedicoInfo()
  const [paciente, setPaciente] = useState(pacienteInicial)
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial)
  const [estudios, setEstudios] = useState<string[]>([''])
  const [notas, setNotas] = useState('')
  const [imprimiendo, setImprimiendo] = useState(false)

  function addEstudio() { setEstudios([...estudios, '']) }
  function removeEstudio(i: number) { setEstudios(estudios.filter((_, idx) => idx !== i)) }
  function updateEstudio(i: number, val: string) { setEstudios(estudios.map((e, idx) => idx === i ? val : e)) }
  function togglePreset(e: string) {
    if (estudios.includes(e)) setEstudios(estudios.filter(s => s !== e))
    else setEstudios([...estudios.filter(s => s !== ''), e])
  }

  async function imprimir() {
    flushSync(() => setImprimiendo(true))
    try {
    if (pacienteId) {
      const supabase = createClient()
      supabase.from('documentos').insert({
        paciente_id: pacienteId,
        tipo: 'lab',
        contenido: { paciente, diagnostico, estudios: estudios.filter(Boolean), notas, fecha },
      }).then(({ error }) => { if (error) console.error('Error guardando documento:', error) })
    }

    const fechaFormat = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })
    const listaEstudios = estudios.filter(Boolean).map(e => `<li>${e}</li>`).join('')
    const { cp, cs } = getPdfColors(medicoInfo)
    const logoUrl = getLogoUrl(medicoInfo, window.location.origin)

    const _html = `
<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Solicitud Lab</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: letter; margin: 15mm 20mm; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #1a1a1a; }
  ${buildPdfHeaderCss(cp, cs)}
  .titulo-doc { text-align:center; font-size:14pt; font-weight:bold; color:${cp}; text-transform:uppercase; margin:16px 0 14px; border:2px solid ${cp}; padding:6px; }
  .dato-row { display:flex; gap:6px; margin-bottom:8px; }
  .dato-label { font-weight:bold; min-width:100px; color:${cp}; }
  .dato-valor { border-bottom:1px solid #aaa; flex:1; padding-bottom:1px; }
  .seccion { font-size:11pt; font-weight:bold; color:${cp}; border-bottom:1px solid ${cp}; padding-bottom:3px; margin:16px 0 10px; }
  ul { list-style:none; columns:2; gap:20px; }
  li { padding:4px 0; padding-left:16px; position:relative; font-size:10.5pt; }
  li::before { content:"✓"; position:absolute; left:0; color:${cs}; font-weight:bold; }
</style></head><body>
  ${buildPdfHeader(medicoInfo, logoUrl, cp, cs)}
  <div class="titulo-doc">Solicitud de Estudios de Laboratorio</div>
  <div class="dato-row"><span class="dato-label">Fecha:</span><span class="dato-valor">${fechaFormat}</span></div>
  <div class="dato-row"><span class="dato-label">Paciente:</span><span class="dato-valor">${paciente}</span></div>
  <div class="dato-row"><span class="dato-label">Diagnóstico:</span><span class="dato-valor">${diagnostico}</span></div>
  <div class="seccion">Se solicita:</div>
  <ul>${listaEstudios}</ul>
  ${notas ? `<div class="seccion">Indicaciones</div><p style="font-size:10pt;color:#333">${notas}</p>` : ''}
  ${buildPdfFirma(medicoInfo, cp)}
</body></html>`
    await imprimirOCompartir(_html, 'solicitud-laboratorio.pdf')
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
      </div>

      {/* Preset rápido */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-3">Estudios frecuentes</h2>
        <div className="flex flex-wrap gap-2">
          {ESTUDIOS_PRESET.map(e => (
            <button key={e} onClick={() => togglePreset(e)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${estudios.includes(e) ? 'bg-[#1e5fa8] text-white border-[#1e5fa8]' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-[#1e5fa8]'}`}>
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Lista manual */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 rounded-t-xl flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 text-sm">Estudios solicitados</h2>
          <button onClick={addEstudio} className="flex items-center gap-1 text-xs text-[#1e5fa8] hover:text-[#1a3a5c] font-medium"><Plus size={14} /> Agregar</button>
        </div>
        <div className="p-4 space-y-2">
          {estudios.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-slate-400 text-sm w-5">{i + 1}.</span>
              <AutocompleteEstudio
                value={e}
                onChange={val => updateEstudio(i, val)}
                index={i}
              />
              {estudios.length > 1 && <button onClick={() => removeEstudio(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <label className="text-sm font-semibold text-slate-700 block mb-2">Indicaciones / Notas</label>
        <textarea value={notas} onChange={e => setNotas(e.target.value)} placeholder="Indicaciones especiales, ayuno requerido..." rows={2}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
      </div>

      <button onClick={imprimir} disabled={!paciente || estudios.filter(Boolean).length === 0 || imprimiendo}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50">
        {imprimiendo ? <><Loader2 size={18} className="animate-spin" /> Generando PDF...</> : <><Printer size={18} /> Imprimir Solicitud</>}
      </button>
    </div>
  )
}
