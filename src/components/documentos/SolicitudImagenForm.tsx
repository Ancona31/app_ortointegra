'use client'
import { generateDocFileName } from '@/lib/patientUtils'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useState } from 'react'

import { Printer, Loader2 } from 'lucide-react'
import { flushSync } from 'react-dom'
import { generarPdf } from '@/lib/mobileShare'
import { useToast } from '@/components/ui/Toast'
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
  const toast = useToast()
  const [paciente, setPaciente] = useState(pacienteInicial)
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial)
  const [estudios, setEstudios] = useState<Estudio[]>([{ tipo: '', region: '', proyecciones: '', indicacion: '' }])
  const [urgente, setUrgente] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [imprimiendo, setImprimiendo] = useState(false)

  function addEstudio() { setEstudios([...estudios, { tipo: '', region: '', proyecciones: '', indicacion: '' }]) }
  function updateEstudio(i: number, field: keyof Estudio, val: string) {
    setEstudios(estudios.map((e, idx) => idx === i ? { ...e, [field]: val } : e))
  }

  async function imprimir() {
    flushSync(() => { setErrorGuardado(''); setImprimiendo(true) })

    // 1. Feedback instantáneo
    toast.info('Generando solicitud de imagen...')

    // 2. Identidad — UUID v4 puro (las solicitudes de imagen no tienen
    //    verificación pública ni folio visible)
    const clientId = crypto.randomUUID()
    const contenido = {
      paciente,
      diagnostico,
      estudios: estudios.filter(e => e.tipo && e.region),
      urgente,
      fecha,
    }

    // Flags de tracking para diferenciar errores
    let pdfGenerated = false

    try {
      // 3. PDF PRIMERO — si falla, abortamos antes de persistir
      const fechaFormat = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })

      const medicoData = medicoInfo ? {
        nombre: medicoInfo.nombre,
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

      await generarPdf({
        tipo: 'solicitud_imagen',
        medico: medicoData,
        data: {
          paciente,
          fecha: fechaFormat,
          diagnostico,
          estudios: estudios.filter(e => e.tipo && e.region),
          urgente,
        },
        logoUrl,
        filename: generateDocFileName(paciente, 'Solicitud_Imagen'),
      })

      pdfGenerated = true

      // 4. Persistencia — insertar directamente en Supabase
      const supabase = createClient()
      const insertPayload: Record<string, unknown> = {
        tipo: 'solicitud_imagen',
        contenido,
        client_id: clientId,
      }
      if (pacienteId) insertPayload.paciente_id = pacienteId

      const { error } = await supabase.from('documentos').insert(insertPayload)
      if (error) throw error

      toast.success('Solicitud guardada')
    } catch (err) {
      if (!pdfGenerated) {
        toast.error('No se pudo generar el PDF. Intenta de nuevo.')
        setErrorGuardado('No se pudo generar el PDF. Intenta de nuevo.')
      } else {
        toast.error('Solicitud generada pero no se pudo guardar. Revisa errores de sincronización.')
        setErrorGuardado('Error al guardar la solicitud.')
      }
      // eslint-disable-next-line no-console
      console.error('[SolicitudImagenForm] imprimir falló:', err)
    } finally {
      setImprimiendo(false)
    }
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
                <input list={`tipos-${i}`} value={e.tipo} onChange={ev => updateEstudio(i, 'tipo', ev.target.value)} placeholder="Seleccionar o escribir..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                <datalist id={`tipos-${i}`}>
                  {TIPOS_ESTUDIO.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500 block mb-1">Región anatómica</label>
                <input list={`regiones-${i}`} value={e.region} onChange={ev => updateEstudio(i, 'region', ev.target.value)} placeholder="Seleccionar o escribir..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                <datalist id={`regiones-${i}`}>
                  {REGIONES.map(r => <option key={r} value={r} />)}
                </datalist>
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

      {errorGuardado && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {errorGuardado}
        </div>
      )}

      <button onClick={imprimir} disabled={!paciente || estudios.filter(e => e.tipo && e.region).length === 0 || imprimiendo}
        className="doc-print-btn w-full flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50">
        {imprimiendo ? <><Loader2 size={18} className="animate-spin" /> Generando PDF...</> : <><Printer size={18} /> Imprimir Solicitud</>}
      </button>
    </div>
  )
}
