'use client'
import { generateDocFileName } from '@/lib/patientUtils'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { generarPdf } from '@/lib/mobileShare'
import { useToast } from '@/components/ui/Toast'

import { useState } from 'react'

import { Plus, Trash2, Printer, Loader2 } from 'lucide-react'
import { flushSync } from 'react-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import AutocompleteEstudio from '@/components/AutocompleteEstudio'
import { createClient } from '@/lib/supabase/client'
import { hoyEnTZ } from '@/lib/dates'

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
  offlineMode?: boolean
  onOfflineSave?: () => void
}

export default function SolicitudLabForm({ pacienteInicial = '', diagnosticoInicial = '', pacienteId, offlineMode, onOfflineSave }: Props) {
  const { medicoInfo: onlineMedicoInfo } = useMedicoInfo()
  const { consultorioActivo } = useConsultorioActivo()

  // In offline mode, read doctor profile from localStorage (pre-fetched with Base64 assets)
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
  const toast = useToast()
  const [paciente, setPaciente] = useState(pacienteInicial)
  const [fecha, setFecha] = useState(hoyEnTZ())
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial)
  const [estudios, setEstudios] = useState<string[]>([''])
  const [notas, setNotas] = useState('')
  const [errorGuardado, setErrorGuardado] = useState('')
  const [imprimiendo, setImprimiendo] = useState(false)

  function addEstudio() { setEstudios([...estudios, '']) }
  function removeEstudio(i: number) { setEstudios(estudios.filter((_, idx) => idx !== i)) }
  function updateEstudio(i: number, val: string) { setEstudios(estudios.map((e, idx) => idx === i ? val : e)) }
  function togglePreset(e: string) {
    if (estudios.includes(e)) setEstudios(estudios.filter(s => s !== e))
    else setEstudios([...estudios.filter(s => s !== ''), e])
  }

  async function imprimir() {
    flushSync(() => { setErrorGuardado(''); setImprimiendo(true) })

    // 1. Feedback instantáneo
    toast.info('Generando solicitud de laboratorio...')

    // 2. Identidad — UUID v4 puro como clientId (las solicitudes de lab
    //    no tienen folio público ni verificación externa, no necesitan
    //    un identificador visible en el PDF)
    const clientId = crypto.randomUUID()
    const contenido = {
      paciente,
      diagnostico,
      estudios: estudios.filter(Boolean),
      notas,
      fecha,
    }

    // Flags de tracking para diferenciar errores
    let pdfGenerated = false

    try {
      // 3. PDF PRIMERO — si falla, abortamos antes de persistir
      const fechaFormat = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })

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

      const consultorioData = consultorioActivo ? {
        nombre: consultorioActivo.nombre,
        direccion: consultorioActivo.direccion,
        telefono: consultorioActivo.telefono,
      } : undefined

      const { storagePath } = await generarPdf({
        tipo: 'solicitud_lab',
        pacienteId,
        medico: medicoData,
        data: {
          paciente,
          fecha: fechaFormat,
          diagnostico,
          estudios: estudios.filter(Boolean),
          notas: notas || undefined,
        },
        logoUrl,
        filename: generateDocFileName(paciente, 'Solicitud_Laboratorio'),
        consultorio: consultorioData,
      })

      pdfGenerated = true

      // 4. Persistencia
      if (offlineMode) {
        const { addDocument } = await import('@/lib/offline/db')
        const { getOfflineIdentity } = await import('@/lib/offline/identity')
        await addDocument({
          id: crypto.randomUUID(),
          temp_patient_id: pacienteId ?? 'unknown',
          tipo: 'solicitud_lab',
          contenido,
          created_at: new Date().toISOString(),
          medico_id: getOfflineIdentity()?.userId ?? 'anonymous',
          _syncStatus: 'pending',
        })
        toast.success('Solicitud de laboratorio guardada en bunker offline')
        onOfflineSave?.()
      } else {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No autenticado')

        const insertPayload: Record<string, unknown> = {
          tipo: 'solicitud_lab',
          contenido,
          client_id: clientId,
          pdf_url: storagePath,
          subido_por: user.id,
        }
        if (pacienteId) insertPayload.paciente_id = pacienteId

        const { error } = await supabase.from('documentos').insert(insertPayload)
        if (error) throw error

        toast.success('Solicitud guardada')
      }
    } catch (err) {
      if (!pdfGenerated) {
        toast.error('No se pudo generar el PDF. Intenta de nuevo.')
        setErrorGuardado('No se pudo generar el PDF. Intenta de nuevo.')
      } else {
        toast.error('Solicitud generada pero no se pudo guardar. Revisa errores de sincronización.')
        setErrorGuardado('Error al guardar la solicitud.')
      }
      // eslint-disable-next-line no-console
      console.error('[SolicitudLabForm] imprimir falló:', err)
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

      {errorGuardado && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {errorGuardado}
        </div>
      )}

      <button onClick={imprimir} disabled={!paciente || estudios.filter(Boolean).length === 0 || imprimiendo}
        className="doc-print-btn w-full flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50">
        {imprimiendo ? <><Loader2 size={18} className="animate-spin" /> Generando PDF...</> : <><Printer size={18} /> Imprimir Solicitud</>}
      </button>
    </div>
  )
}
