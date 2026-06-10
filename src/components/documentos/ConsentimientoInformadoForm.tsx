'use client'

import { generateDocFileName } from '@/lib/patientUtils'
import { useState } from 'react'
import { Printer, Loader2, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react'
import { flushSync } from 'react-dom'
import { generarPdf } from '@/lib/mobileShare'
import { useToast } from '@/components/ui/Toast'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { hoyEnTZ } from '@/lib/dates'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'

interface Props {
  pacienteInicial?: string
  pacienteId?: string
  diagnosticoInicial?: string
  offlineMode?: boolean
  onOfflineSave?: () => void
}

const SECCIONES_DEFAULT = {
  preoperatorio: `Después de haberle realizado historia clínica y estudios diagnósticos pertinentes (análisis de laboratorio, estudios de imagen u otros según el caso), se ha establecido el diagnóstico descrito y, habiendo agotado otras alternativas de tratamiento, se le recomienda someterse al procedimiento indicado. Se le indicará el tiempo necesario de ayuno previo y las indicaciones preoperatorias correspondientes.`,

  beneficios: `El fin primordial del procedimiento es corregir la condición diagnosticada, proteger las estructuras anatómicas involucradas, mantener o restaurar la función y evitar la progresión de la enfermedad, la cual podría producir lesiones más serias o dolor incapacitante. Los resultados esperados incluyen mejoría del dolor, recuperación funcional y mejora en la calidad de vida, aunque estos no pueden garantizarse en su totalidad, ya que dependen de múltiples factores individuales.`,

  anestesia: `La intervención puede precisar anestesia, cuyo tipo y modalidad serán valorados en forma individual de acuerdo con las características del paciente y del procedimiento. El médico anestesiólogo le informará cuál es la alternativa más adecuada para su caso y resolverá cualquier duda al respecto.`,

  descripcion: ``,

  riesgosComunes: `Cualquier procedimiento quirúrgico conlleva riesgos comunes independientemente de la técnica empleada, que incluyen pero no se limitan a: sangrado transoperatorio o postoperatorio, infección superficial o profunda de la herida quirúrgica, reacciones adversas a la anestesia o medicamentos, trombosis venosa profunda, tromboembolismo pulmonar, cicatrización anómala (cicatriz hipertrófica o queloide), dehiscencia de herida, y en casos excepcionales, complicaciones graves que podrían requerir tratamientos complementarios médicos o quirúrgicos e incluso, en un mínimo porcentaje de casos, ser causa de muerte.\n\nCuando sea médicamente necesario, el paciente autoriza la transfusión de sangre y/o hemoderivados en la cantidad y frecuencia requeridas, habiendo sido informado de que las transfusiones no siempre producen el resultado deseado y que existe la posibilidad de resultados no favorables.`,

  riesgosEspecificos: ``,

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
  seccionKey, value, onChange, requerido,
}: { seccionKey: SeccionKey; value: string; onChange: (v: string) => void; requerido?: boolean }) {
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
        <span className="font-semibold text-slate-700 text-sm flex-1">
          {titulo}{requerido && <span className="text-red-400 ml-1">*</span>}
        </span>
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

export default function ConsentimientoInformadoForm({ pacienteInicial = '', pacienteId, diagnosticoInicial = '', offlineMode, onOfflineSave }: Props) {
  const { medicoInfo: onlineMedicoInfo } = useMedicoInfo()

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

  // Campos de identificación
  const [paciente, setPaciente]               = useState(pacienteInicial)
  const [lugar, setLugar]                     = useState('')
  const [fecha, setFecha]                     = useState(hoyEnTZ())
  const [expediente, setExpediente]           = useState('')
  const [edad, setEdad]                       = useState('')
  const [idPaciente, setIdPaciente]           = useState('')
  const [procedimiento, setProcedimiento]     = useState('')
  const [diagnostico, setDiagnostico]         = useState(diagnosticoInicial)
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
  const [errorGuardado, setErrorGuardado] = useState('')
  const [imprimirDenegacion, setImprimirDenegacion] = useState(false)

  function updateSeccion(key: SeccionKey, val: string) {
    setSecciones(s => ({ ...s, [key]: val }))
  }

  async function imprimir() {
    // ══════════════════════════════════════════════════════════════════
    // VALIDACIÓN LEGAL — 9 campos obligatorios (NOM-004-SSA3-2012)
    // Se preserva exactamente como estaba. Ejecuta ANTES de flushSync
    // para que el botón no entre en estado "Generando..." si falta algo.
    // ══════════════════════════════════════════════════════════════════
    const faltantes = [
      { val: paciente,                    label: 'Nombre del paciente' },
      { val: lugar,                       label: 'Lugar' },
      { val: fecha,                       label: 'Fecha' },
      { val: edad,                        label: 'Edad' },
      { val: procedimiento,               label: 'Procedimiento' },
      { val: diagnostico,                 label: 'Diagnóstico' },
      { val: familiar,                    label: 'Familiar responsable' },
      { val: secciones.descripcion,       label: 'Descripción del procedimiento' },
      { val: secciones.riesgosEspecificos, label: 'Riesgos específicos' },
    ].filter(c => !c.val.trim()).map(c => c.label)
    if (faltantes.length > 0) {
      toast.error(`Campos obligatorios faltantes: ${faltantes.join(', ')}`)
      return
    }

    flushSync(() => { setErrorGuardado(''); setImprimiendo(true) })

    // 1. Feedback instantáneo
    toast.info('Generando consentimiento informado...')

    // 2. Identidad — UUID v4 puro como clientId
    const clientId = crypto.randomUUID()

    // 3. Contenido persistido — NO incluye imprimirDenegacion (es una
    //    opción de impresión, no parte del consentimiento legal)
    const contenido = {
      paciente, lugar, fecha, expediente, edad, idPaciente, procedimiento, diagnostico,
      familiar, idFamiliar, representante, idRepresentante, anestesiologo,
      testigo1, testigo2, autorizaTransfusion, autorizaFotos,
      secciones,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }

    // Flags de tracking para diferenciar errores
    let pdfGenerated = false

    try {
      // 4. PDF PRIMERO — si falla, abortamos antes de persistir.
      //    CRÍTICO en consentimiento: evita registros legales huérfanos
      //    en DB sin documento físico entregable al paciente.
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
      const fechaFmt = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })

      const { storagePath } = await generarPdf({
        tipo: 'consentimiento_informado',
        pacienteId,
        medico: medicoData,
        data: {
          paciente, lugar, fecha: fechaFmt, expediente, edad, idPaciente,
          procedimiento, diagnostico, familiar, idFamiliar,
          representante, idRepresentante, anestesiologo,
          testigo1, testigo2, autorizaTransfusion, autorizaFotos,
          secciones, imprimirDenegacion,
        },
        logoUrl,
        filename: generateDocFileName(paciente, 'Consentimiento_Informado'),
      })

      pdfGenerated = true

      // 5. Persistencia
      if (offlineMode) {
        const { addDocument } = await import('@/lib/offline/db')
        const { getOfflineIdentity } = await import('@/lib/offline/identity')
        await addDocument({
          id: crypto.randomUUID(),
          temp_patient_id: pacienteId ?? 'unknown',
          tipo: 'consentimiento_informado',
          contenido,
          created_at: new Date().toISOString(),
          medico_id: getOfflineIdentity()?.userId ?? 'anonymous',
          _syncStatus: 'pending',
        })
        toast.success('Consentimiento informado guardado en bunker offline')
        onOfflineSave?.()
      } else {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No autenticado')

        const insertPayload: Record<string, unknown> = {
          tipo: 'consentimiento_informado',
          contenido,
          client_id: clientId,
          pdf_url: storagePath,
          subido_por: user.id,
        }
        if (pacienteId) insertPayload.paciente_id = pacienteId

        const { error } = await supabase.from('documentos').insert(insertPayload)
        if (error) throw error

        toast.success('Consentimiento guardado')
      }
    } catch (err) {
      if (!pdfGenerated) {
        toast.error('No se pudo generar el PDF. Intenta de nuevo.')
        setErrorGuardado('No se pudo generar el PDF. Intenta de nuevo.')
      } else {
        toast.error('Consentimiento generado pero no se pudo guardar. Revisa errores de sincronización.')
        setErrorGuardado('Error al guardar el consentimiento.')
      }
      // eslint-disable-next-line no-console
      console.error('[ConsentimientoInformadoForm] imprimir falló:', err)
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
            <label className="text-xs font-medium text-slate-500 block mb-1">Lugar <span className="text-red-400">*</span></label>
            <input type="text" value={lugar} onChange={e => setLugar(e.target.value)} placeholder="Ej: Monterrey, N.L." className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Fecha <span className="text-red-400">*</span></label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Paciente <span className="text-red-400">*</span></label>
            <input type="text" value={paciente} onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Edad del paciente <span className="text-red-400">*</span></label>
            <input type="text" value={edad} onChange={e => setEdad(e.target.value)} placeholder="Ej: 45 años" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">No. Expediente</label>
            <input type="text" value={expediente} onChange={e => setExpediente(e.target.value)} placeholder="Ej: 2024-001" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Identificado con</label>
            <input type="text" value={idPaciente} onChange={e => setIdPaciente(e.target.value)} placeholder="Ej: INE 123456789" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Procedimiento <span className="text-red-400">*</span></label>
            <input type="text" value={procedimiento} onChange={e => setProcedimiento(e.target.value)} placeholder="Ej: Artrodesis cervical anterior" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Diagnóstico <span className="text-red-400">*</span></label>
            <input type="text" value={diagnostico} onChange={e => setDiagnostico(e.target.value)} placeholder="Diagnóstico principal" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Familiar responsable <span className="text-red-400">*</span></label>
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
          requerido={key === 'descripcion' || key === 'riesgosEspecificos'}
        />
      ))}

      {/* Opción: incluir hoja de denegación */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3.5 flex items-center gap-3">
        <input
          type="checkbox"
          id="imprimirDenegacion"
          checked={imprimirDenegacion}
          onChange={e => setImprimirDenegacion(e.target.checked)}
          className="w-4 h-4 accent-[#1e5fa8] flex-shrink-0"
        />
        <label htmlFor="imprimirDenegacion" className="text-sm text-slate-600 cursor-pointer leading-snug">
          Incluir hoja de <strong>Denegación o Revocación</strong> del consentimiento (hoja 4 opcional)
        </label>
      </div>

      {errorGuardado && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {errorGuardado}
        </div>
      )}

      <button
        onClick={imprimir}
        disabled={imprimiendo}
        className="doc-print-btn w-full flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50"
      >
        {imprimiendo
          ? <><Loader2 size={18} className="animate-spin" /> Generando PDF...</>
          : <><Printer size={18} /> Generar Consentimiento Informado</>
        }
      </button>
    </div>
  )
}
