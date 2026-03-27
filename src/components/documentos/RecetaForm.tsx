'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Printer } from 'lucide-react'
import { Medicamento } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import ConsultaRapida from '@/components/ConsultaRapida'
import { createClient } from '@/lib/supabase/client'
import AutocompleteMedicamento from '@/components/AutocompleteMedicamento'
import { MedicamentoDB } from '@/data/medicamentos'

type MedicoInfo = {
  nombre: string
  especialidad: string
  cedula_profesional: string
  cedula_especialidad: string
  logo_url: string | null
}

interface Props {
  pacienteInicial?: string
  diagnosticoInicial?: string
  pacienteId?: string
}

export default function RecetaForm({ pacienteInicial = '', diagnosticoInicial = '', pacienteId }: Props) {
  const [medicoInfo, setMedicoInfo] = useState<MedicoInfo | null>(null)
  const [paciente, setPaciente] = useState(pacienteInicial)
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial)

  useEffect(() => {
    fetch('/api/me/perfil-medico').then(r => r.json()).then(({ medico }) => setMedicoInfo(medico))
  }, [])

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([
    { nombre_comercial: '', presentacion: '', dosis: '', principio_activo: '', indicacion: '' }
  ])
  const [sugerenciasDosis, setSugerenciasDosis] = useState<string[]>([''])
  const [recomendaciones, setRecomendaciones] = useState('')

  function addMed() {
    setMedicamentos([...medicamentos, { nombre_comercial: '', presentacion: '', dosis: '', principio_activo: '', indicacion: '' }])
    setSugerenciasDosis(prev => [...prev, ''])
  }

  function removeMed(i: number) {
    setMedicamentos(medicamentos.filter((_, idx) => idx !== i))
    setSugerenciasDosis(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateMed(i: number, field: keyof Medicamento, val: string) {
    setMedicamentos(medicamentos.map((m, idx) => idx === i ? { ...m, [field]: val } : m))
  }

  function autocompletarMed(i: number, med: MedicamentoDB) {
    setMedicamentos(medicamentos.map((m, idx) => idx === i ? {
      ...m,
      nombre_comercial: med.nombre_comercial,
      presentacion: med.presentacion,
      principio_activo: med.principio_activo,
    } : m))
    setSugerenciasDosis(prev => prev.map((s, idx) => idx === i ? med.dosis_sugerida : s))
  }

  function imprimir() {
    if (pacienteId) {
      const supabase = createClient()
      supabase.from('documentos').insert({
        paciente_id: pacienteId,
        tipo: 'receta',
        contenido: { paciente, diagnostico, medicamentos, recomendaciones, fecha },
      }).then(() => {})
    }

    const ventana = window.open('', '_blank', 'width=800,height=600')
    if (!ventana) return
    const fechaFormat = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })

    const meds = medicamentos.filter(m => m.nombre_comercial).map((m, i) => `
      <div class="medicamento">
        <p class="med-nombre">${i + 1}. ${m.nombre_comercial.toUpperCase()}${m.presentacion ? ` ${m.presentacion}` : ''}${m.principio_activo ? ` <span class="principio">(${m.principio_activo})</span>` : ''}</p>
        <p class="med-indicacion">${m.indicacion}</p>
      </div>
    `).join('')

    const doctorNombre = medicoInfo?.nombre || 'Médico'
    const doctorEspecialidad = medicoInfo?.especialidad || ''
    const cedulas = [
      medicoInfo?.cedula_profesional ? `Céd. Prof. ${medicoInfo.cedula_profesional}` : '',
      medicoInfo?.cedula_especialidad ? `Céd. Esp. ${medicoInfo.cedula_especialidad}` : '',
    ].filter(Boolean).join(' · ')
    const logoUrl = medicoInfo?.logo_url || `${window.location.origin}/logo.png`

    ventana.document.write(`
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Receta — ${paciente}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: letter; margin: 15mm 20mm; }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #1a1a1a; }

  .header { display: flex; align-items: center; gap: 20px; padding-bottom: 14px; border-bottom: 3px solid #1a3a5c; margin-bottom: 16px; }
  .logo { width: 80px; height: 80px; object-fit: contain; }
  .header-info { flex: 1; }
  .doctor-name { font-size: 16pt; font-weight: bold; color: #1a3a5c; margin-bottom: 2px; }
  .especialidad { font-size: 10pt; color: #1e5fa8; margin-bottom: 4px; }
  .credenciales { font-size: 9pt; color: #555; }

  .rp { font-size: 28pt; font-weight: bold; color: #1a3a5c; text-align: right; line-height: 1; }

  .datos { margin-bottom: 16px; display: flex; flex-direction: column; gap: 6px; }
  .dato-row { display: flex; gap: 6px; }
  .dato-label { font-weight: bold; min-width: 90px; color: #1a3a5c; font-size: 10pt; }
  .dato-valor { border-bottom: 1px solid #aaa; flex: 1; font-size: 10pt; padding-bottom: 1px; }

  .seccion-titulo { font-size: 11pt; font-weight: bold; color: #1a3a5c; border-bottom: 1px solid #1a3a5c; padding-bottom: 3px; margin-bottom: 10px; margin-top: 16px; }
  .medicamento { margin-bottom: 12px; }
  .med-nombre { font-weight: bold; font-size: 10.5pt; }
  .principio { font-weight: normal; font-style: italic; }
  .med-indicacion { font-size: 10pt; margin-left: 14px; margin-top: 2px; color: #333; }

  .recomendaciones { font-size: 10pt; line-height: 1.7; color: #333; white-space: pre-line; }

  .footer { margin-top: 50px; display: flex; justify-content: flex-end; }
  .firma { text-align: center; border-top: 1px solid #333; padding-top: 6px; min-width: 200px; }
  .firma p { font-size: 9pt; color: #555; }

  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="header">
    <img class="logo" src="${logoUrl}" onerror="this.style.display='none'" />
    <div class="header-info">
      <div class="doctor-name">${doctorNombre}</div>
      ${doctorEspecialidad ? `<div class="especialidad">${doctorEspecialidad}</div>` : ''}
      ${cedulas ? `<div class="credenciales">${cedulas}</div>` : ''}
    </div>
    <div class="rp">℞</div>
  </div>

  <div class="datos">
    <div class="dato-row">
      <span class="dato-label">Fecha:</span>
      <span class="dato-valor">${fechaFormat}</span>
    </div>
    <div class="dato-row">
      <span class="dato-label">Paciente:</span>
      <span class="dato-valor">${paciente}</span>
    </div>
    <div class="dato-row">
      <span class="dato-label">Diagnóstico:</span>
      <span class="dato-valor">${diagnostico}</span>
    </div>
  </div>

  <div class="seccion-titulo">Medicamentos</div>
  ${meds}

  ${recomendaciones ? `<div class="seccion-titulo">Recomendaciones</div><p class="recomendaciones">${recomendaciones}</p>` : ''}

  <div class="footer">
    <div class="firma">
      <p>${doctorNombre}</p>
      ${medicoInfo?.cedula_profesional ? `<p>Céd. Prof. ${medicoInfo.cedula_profesional}</p>` : ''}
    </div>
  </div>
</body>
</html>
    `)
    ventana.document.close()
    ventana.focus()
    setTimeout(() => ventana.print(), 500)
  }

  return (
    <div className="space-y-5">
      {/* Datos básicos */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-4">Datos del paciente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Nombre del paciente <span className="text-red-400">*</span></label>
            <input type="text" value={paciente} onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Diagnóstico</label>
            <input type="text" value={diagnostico} onChange={e => setDiagnostico(e.target.value)} placeholder="Diagnóstico principal"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
          </div>
        </div>
      </div>

      {/* Medicamentos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 text-sm">Medicamentos</h2>
          <button onClick={addMed} className="flex items-center gap-1 text-xs text-[#1e5fa8] hover:text-[#1a3a5c] font-medium">
            <Plus size={14} /> Agregar
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {medicamentos.map((med, i) => (
            <div key={i} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">MEDICAMENTO {i + 1}</span>
                {medicamentos.length > 1 && (
                  <button onClick={() => removeMed(i)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-500 block mb-1">Nombre comercial</label>
                  <AutocompleteMedicamento
                    value={med.nombre_comercial}
                    onChange={val => updateMed(i, 'nombre_comercial', val)}
                    onSelect={m => autocompletarMed(i, m)}
                    placeholder="VOLTAREN"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Presentación</label>
                  <input type="text" value={med.presentacion || ''} onChange={e => updateMed(i, 'presentacion', e.target.value)}
                    placeholder="Tabletas 50 mg" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <label className="text-xs text-slate-500 block mb-1">Principio activo</label>
                  <input type="text" value={med.principio_activo || ''} onChange={e => updateMed(i, 'principio_activo', e.target.value)}
                    placeholder="Diclofenaco sódico" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                </div>
                <div className="col-span-2 sm:col-span-3">
                  <label className="text-xs text-slate-500 block mb-1">Indicaciones de administración</label>
                  <textarea value={med.indicacion} onChange={e => updateMed(i, 'indicacion', e.target.value)}
                    placeholder="Tomar 1 tableta cada 8 hrs con alimentos por 7 días"
                    rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                  {sugerenciasDosis[i] && (
                    <p className="mt-1 text-xs text-slate-400 flex items-start gap-1">
                      <span className="font-medium text-slate-500">Sugerencia:</span> {sugerenciasDosis[i]}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recomendaciones */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <label className="text-sm font-semibold text-slate-700 block mb-3">Recomendaciones / Notas</label>
        <textarea value={recomendaciones} onChange={e => setRecomendaciones(e.target.value)}
          placeholder="Uso de inmovilizador, cuidados de herida, cita de seguimiento, datos de alarma..."
          rows={4} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
      </div>

      <ConsultaRapida />

      <button
        onClick={imprimir}
        disabled={!paciente}
        className="w-full flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50"
      >
        <Printer size={18} /> Imprimir Receta
      </button>
    </div>
  )
}
