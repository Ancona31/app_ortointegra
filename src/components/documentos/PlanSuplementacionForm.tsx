'use client'
import { generateDocFileName } from '@/lib/patientUtils'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useProfile } from '@/hooks/useProfile'

import { useState, useCallback } from 'react'
import { Printer, Loader2, RefreshCw } from 'lucide-react'
import { flushSync } from 'react-dom'
import { generarPdf } from '@/lib/mobileShare'
import { useToast } from '@/components/ui/Toast'
import QRCode from 'qrcode'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { hoyEnTZ } from '@/lib/dates'

type Presentacion = {
  tipo: string      // 'cápsula' | 'tableta' | 'cucharada' | 'scoop'
  contenido: number // cantidad por unidad, en la misma unidad que `unidad` del suplemento
  nota?: string     // texto adicional en el PDF, ej: "+ 1 tableta Vitamina C 1,000 mg"
}

type Suplemento = {
  nombre: string
  dosis_default: string
  dosis_por_kg: string | null
  min_kg: number | null
  max_kg: number | null
  unidad: string
  presentacion: Presentacion | null  // null = mostrar mg/UI en PDF (sin conversión)
  beneficio_clinico: string          // texto médico — visible en tarjetas de selección (médico)
  beneficio_paciente: string         // lenguaje amigable — aparece en el PDF (paciente)
}

const SUPLEMENTOS: Suplemento[] = [
  {
    nombre: 'Vitamina D3',
    dosis_default: '5,000 UI/día',
    dosis_por_kg: '70–100 UI/kg/día',
    min_kg: 70, max_kg: 100, unidad: 'UI',
    presentacion: null, // sin conversión a cápsulas — se muestra en UI/día
    beneficio_clinico: 'Absorción de calcio y mineralización ósea. Con IMC elevado se requieren dosis de carga para saturar receptores. Clave para unión ósea en cirugía de columna y artroplastia.',
    beneficio_paciente: 'Ayuda a que tus huesos absorban el calcio correctamente y se mantengan fuertes. Es especialmente importante después de una cirugía de columna o articulaciones para que la recuperación sea más rápida y sólida.',
  },
  {
    nombre: 'Vitamina K2 (MK-7)',
    dosis_default: '100 mcg/día',
    dosis_por_kg: '1.5–2 mcg/kg/día',
    min_kg: 1.5, max_kg: 2, unidad: 'mcg',
    presentacion: { tipo: 'cápsula', contenido: 100 },
    beneficio_clinico: 'Activa la osteocalcina y dirige el calcio al hueso. Evita calcificación de ligamentos y arterias. Sinergia indispensable con Vitamina D3.',
    beneficio_paciente: 'Trabaja en equipo con la Vitamina D3 para que el calcio llegue exactamente a donde debe estar: tus huesos. Evita que ese calcio se acumule en lugares donde puede hacer daño, como las arterias o los ligamentos.',
  },
  {
    nombre: 'Omega-3 (EPA/DHA)',
    dosis_default: '2–3 g/día con alimentos',
    dosis_por_kg: '30–40 mg/kg/día',
    min_kg: 30, max_kg: 40, unidad: 'mg',
    presentacion: { tipo: 'cápsula', contenido: 640 }, // Nordic Naturals: 2 caps = 1,280 mg → 640 mg/cap
    beneficio_clinico: 'A >3 g/día modula la cascada del ácido araquidónico. Reduce inflamación en entesis y discos intervertebrales. Alternativa coadyuvante a AINEs en radiculopatía crónica.',
    beneficio_paciente: 'Reduce la inflamación de forma natural en articulaciones, nervios y discos de la columna. A dosis terapéuticas ayuda a controlar el dolor crónico sin irritar el estómago como lo hacen algunos antiinflamatorios convencionales.',
  },
  {
    nombre: 'Colágeno Hidrolizado + Vitamina C',
    dosis_default: '10–15 g + 500 mg en ayunas',
    dosis_por_kg: '0.10–0.15 g/kg/día',
    min_kg: 0.10, max_kg: 0.15, unidad: 'g',
    presentacion: { tipo: 'cucharada', contenido: 5, nota: '+ 1 tableta de Vitamina C 1,000 mg — tomar en ayunas' },
    beneficio_clinico: 'Aporta glicina y prolina para reparación de fascia y anillo fibroso del disco. Tomar en ayunas con vitamina C para máxima biodisponibilidad.',
    beneficio_paciente: 'El colágeno es el material de construcción natural de tus tendones, ligamentos y los discos que amortiguan tu columna. Tomarlo en ayunas con vitamina C ayuda a reparar y fortalecer esos tejidos desde adentro.',
  },
  {
    nombre: 'Creatina Monohidratada',
    dosis_default: '5 g/día',
    dosis_por_kg: '0.07–0.10 g/kg/día',
    min_kg: 0.07, max_kg: 0.10, unidad: 'g',
    presentacion: { tipo: 'scoop', contenido: 5 },
    beneficio_clinico: 'Síntesis de ATP muscular y retención de nitrógeno. Previene sarcopenia y atrofia por desuso. Mejora potencia en rehabilitación incluso con déficit calórico.',
    beneficio_paciente: 'Le da más energía a tus músculos para que trabajen mejor durante la rehabilitación. Evita que el músculo se pierda cuando estás en reposo o en un proceso de recuperación, y mejora tu fuerza de forma progresiva.',
  },
  {
    nombre: 'Magnesio Glicinato',
    dosis_default: '300–400 mg/día',
    dosis_por_kg: '4–6 mg/kg/día',
    min_kg: 4, max_kg: 6, unidad: 'mg',
    presentacion: { tipo: 'cápsula', contenido: 500 },
    beneficio_clinico: 'Relajación de musculatura paravertebral y cofactor en formación de matriz ósea. Alta biodisponibilidad sin efectos laxantes del óxido o citrato.',
    beneficio_paciente: 'Relaja los músculos de la espalda y ayuda a reducir los espasmos y la tensión. También es necesario para formar hueso sano y mejora la calidad del sueño, que es cuando el cuerpo más se repara.',
  },
  {
    nombre: 'Cúrcuma (Curcumina 95%)',
    dosis_default: '500–1,000 mg/día',
    dosis_por_kg: '8–10 mg/kg/día',
    min_kg: 8, max_kg: 10, unidad: 'mg',
    presentacion: { tipo: 'cápsula', contenido: 500 },
    beneficio_clinico: 'Inhibidor natural de NF-kB y COX-2. Reduce dolor articular crónico sin daño gástrico. Efecto comparable a dosis bajas de diclofenaco después de 4 semanas continuas.',
    beneficio_paciente: 'Es un antiinflamatorio natural muy potente extraído de la cúrcuma. Con uso continuo de 4 semanas ayuda a controlar el dolor crónico en articulaciones y espalda, sin los efectos secundarios que tienen los antiinflamatorios de farmacia.',
  },
  {
    nombre: 'HMB (Beta-hidroxi-beta-metilbutirato)',
    dosis_default: '3 g/día (3 tomas)',
    dosis_por_kg: '30–40 mg/kg/día',
    min_kg: 30, max_kg: 40, unidad: 'mg',
    presentacion: { tipo: 'cápsula', contenido: 1000 },
    beneficio_clinico: 'Anticatabólico. Protege masa muscular en déficit calórico y periodos de estrés quirúrgico o posoperatorio.',
    beneficio_paciente: 'Protege tu músculo cuando el cuerpo está bajo estrés, como después de una cirugía o durante una dieta. Evita que el organismo "consuma" el músculo que tanto trabajo cuesta ganar o mantener.',
  },
  {
    nombre: 'Ashwagandha KSM-66',
    dosis_default: '1 cápsula al día',
    dosis_por_kg: null,
    min_kg: null, max_kg: null, unidad: 'mg',
    presentacion: { tipo: 'cápsula', contenido: 600 },
    beneficio_clinico: 'Modulador de cortisol. Reduce gluconeogénesis inducida por estrés, protegiendo masa muscular. Indicado en pacientes con alta carga laboral o entrenamiento de alta intensidad.',
    beneficio_paciente: 'Ayuda a reducir el estrés y equilibrar el cortisol, que es la hormona que el cuerpo libera cuando está bajo presión. Cuando el cortisol está elevado por mucho tiempo, destruye músculo y dificulta la recuperación; esta planta ayuda a controlarlo.',
  },
]

function calcularDosis(sup: Suplemento, pesoKg: number): string {
  if (!sup.min_kg || !sup.max_kg) return sup.dosis_default
  const min = sup.min_kg * pesoKg
  const max = sup.max_kg * pesoKg

  // mg → g when ≥ 1000 mg
  if (sup.unidad === 'mg' && min >= 1000) {
    return `${(min / 1000).toFixed(1)}–${(max / 1000).toFixed(1)} g/día`
  }

  const fmt = (n: number) => {
    if (sup.unidad === 'g') return parseFloat(n.toFixed(1)).toString()
    if (n >= 1000) return Math.round(n).toLocaleString('es-MX')
    if (n >= 10) return Math.round(n).toString()
    return parseFloat(n.toFixed(1)).toString()
  }

  return `${fmt(min)}–${fmt(max)} ${sup.unidad}/día`
}

// Devuelve la dosis en cápsulas/cucharadas para el PDF del paciente (dosis mínima por peso)
function dosisEnCapsulas(sup: Suplemento, pesoKg: number): string | null {
  if (!sup.presentacion) return null

  let n: number
  if (!sup.min_kg) {
    // Dosis fija — 1 unidad como mínimo práctico
    n = 1
  } else {
    const dosis_min = sup.min_kg * pesoKg
    n = Math.max(1, Math.round(dosis_min / sup.presentacion.contenido))
  }

  const t = sup.presentacion.tipo
  const label = n === 1 ? t
    : t === 'cucharada' ? 'cucharadas'
    : t === 'cápsula'   ? 'cápsulas'
    : t === 'tableta'   ? 'tabletas'
    : t + 's'

  const base = `${n} ${label} al día`
  return sup.presentacion.nota ? `${base} — ${sup.presentacion.nota}` : base
}

type SupSelec = { nombre: string; dosis: string; justificacion: string }

interface Props {
  pacienteInicial?: string
  diagnosticoInicial?: string
  pacienteId?: string
  offlineMode?: boolean
  onOfflineSave?: () => void
}

export default function PlanSuplementacionForm({ pacienteInicial = '', diagnosticoInicial = '', pacienteId, offlineMode, onOfflineSave }: Props) {
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
  const { isSuperAdmin } = useProfile()
  const toast = useToast()
  const [paciente, setPaciente] = useState(pacienteInicial)
  const [fecha, setFecha] = useState(hoyEnTZ())
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial)
  const [pesoKg, setPesoKg] = useState('')
  const [seleccionados, setSeleccionados] = useState<SupSelec[]>([])
  const [notas, setNotas] = useState('')
  const [seguimiento, setSeguimiento] = useState('')
  const [imprimiendo, setImprimiendo] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')

  function dosisParaForm(sup: Suplemento, peso: number): string {
    if (peso > 0) {
      const caps = dosisEnCapsulas(sup, peso)
      if (caps) return caps
      if (sup.min_kg) return calcularDosis(sup, peso)
    }
    return sup.dosis_default
  }

  const toggleSup = useCallback((sup: Suplemento) => {
    if (seleccionados.find(s => s.nombre === sup.nombre)) {
      setSeleccionados(prev => prev.filter(s => s.nombre !== sup.nombre))
    } else {
      const peso = parseFloat(pesoKg)
      setSeleccionados(prev => [...prev, { nombre: sup.nombre, dosis: dosisParaForm(sup, peso), justificacion: '' }])
    }
  }, [seleccionados, pesoKg])

  function updateSup(nombre: string, field: keyof SupSelec, val: string) {
    setSeleccionados(prev => prev.map(s => s.nombre === nombre ? { ...s, [field]: val } : s))
  }

  const recalcularTodas = useCallback(() => {
    const peso = parseFloat(pesoKg)
    if (!peso) return
    setSeleccionados(prev => prev.map(s => {
      const sup = SUPLEMENTOS.find(x => x.nombre === s.nombre)
      if (!sup) return s
      return { ...s, dosis: dosisParaForm(sup, peso) }
    }))
  }, [pesoKg])

  async function imprimir() {
    flushSync(() => { setErrorGuardado(''); setImprimiendo(true) })

    // 1. Feedback instantáneo
    toast.info('Generando plan de suplementación...')

    // 2. Identidad — UUID v4 puro como clientId
    const clientId = crypto.randomUUID()
    const contenido = { paciente, diagnostico, pesoKg, seleccionados, notas, seguimiento, fecha }

    // Flags de tracking para diferenciar errores
    let pdfGenerated = false

    try {
      // 3. PDF PRIMERO — si falla, abortamos antes de persistir
      const cp = medicoInfo?.color_primario || '#1a3a5c'
      const blogQrDataUrl = isSuperAdmin
        ? await QRCode.toDataURL(
            'https://dranconacolumna.com/articulos.html#61bea08b-ea34-455b-a2b5-15c431987c64',
            { width: 80, margin: 1, color: { dark: cp, light: '#ffffff' } }
          )
        : ''
      const fechaFormat = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })
      const peso = parseFloat(pesoKg)

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

      const { storagePath } = await generarPdf({
        tipo: 'plan_suplementacion',
        pacienteId,
        medico: medicoData,
        data: {
          paciente, fecha: fechaFormat, diagnostico, peso,
          suplementos: seleccionados.map(s => {
            const sup = SUPLEMENTOS.find(x => x.nombre === s.nombre)
            const dosisPersonalizada = (sup && peso > 0)
              ? (dosisEnCapsulas(sup, peso) ?? s.dosis)
              : s.dosis
            // Convertir presentacion (objeto) a string para el PDF
            const pres = sup?.presentacion
            const presTexto = pres
              ? `${pres.contenido} ${sup.unidad}/${pres.tipo}${pres.nota ? ` (${pres.nota})` : ''}`
              : null

            return {
              nombre: s.nombre, dosis: dosisPersonalizada, presentacion: presTexto,
              beneficio_clinico: sup?.beneficio_clinico ?? '',
              beneficio_paciente: sup?.beneficio_paciente ?? '',
              justificacion: s.justificacion,
            }
          }),
          notas: notas || undefined,
          citaControl: seguimiento || undefined,
          blogQrDataUrl: blogQrDataUrl || undefined,
        },
        logoUrl,
        filename: generateDocFileName(paciente, 'Plan_Suplementacion'),
      })

      pdfGenerated = true

      // 4. Persistencia
      if (offlineMode) {
        const { addDocument } = await import('@/lib/offline/db')
        const { getOfflineIdentity } = await import('@/lib/offline/identity')
        await addDocument({
          id: crypto.randomUUID(),
          temp_patient_id: pacienteId ?? 'unknown',
          tipo: 'plan_suplementacion',
          contenido,
          created_at: new Date().toISOString(),
          medico_id: getOfflineIdentity()?.userId ?? 'anonymous',
          _syncStatus: 'pending',
        })
        toast.success('Plan de suplementacion guardado en bunker offline')
        onOfflineSave?.()
      } else {
        // Persistencia — CONDICIONAL a pacienteId
        if (pacienteId) {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) throw new Error('No autenticado')

          const insertPayload: Record<string, unknown> = {
            tipo: 'plan_suplementacion',
            contenido,
            client_id: clientId,
            paciente_id: pacienteId,
            pdf_url: storagePath,
            subido_por: user.id,
          }

          const { error } = await supabase.from('documentos').insert(insertPayload)
          if (error) throw error
        }

        if (!pacienteId) {
          toast.success('Plan generado')
        } else {
          toast.success('Plan guardado')
        }
      }
    } catch (err) {
      if (!pdfGenerated) {
        toast.error('No se pudo generar el PDF. Intenta de nuevo.')
        setErrorGuardado('No se pudo generar el PDF. Intenta de nuevo.')
      } else {
        toast.error('Plan generado pero no se pudo guardar. Revisa errores de sincronización.')
        setErrorGuardado('Error al guardar el plan.')
      }
      // eslint-disable-next-line no-console
      console.error('[PlanSuplementacionForm] imprimir falló:', err)
    } finally {
      setImprimiendo(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]'

  return (
    <div className="space-y-5">

      {/* Datos del paciente */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-4">Datos del paciente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Paciente <span className="text-red-400">*</span></label>
            <input type="text" value={paciente} onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Diagnóstico</label>
            <input type="text" value={diagnostico} onChange={e => setDiagnostico(e.target.value)} placeholder="Diagnóstico principal" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Peso (kg) <span className="text-slate-400 font-normal">— calcula dosis por peso</span>
            </label>
            <input
              type="number"
              value={pesoKg}
              onChange={e => setPesoKg(e.target.value)}
              placeholder="Ej: 75"
              min="20" max="300" step="0.5"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Selección de suplementos */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-700 text-sm">Seleccionar suplementos</h2>
          {pesoKg && seleccionados.length > 0 && (
            <button
              onClick={recalcularTodas}
              className="flex items-center gap-1.5 text-xs text-[#1e5fa8] hover:text-[#1a3a5c] font-medium px-3 py-1.5 bg-blue-50 rounded-lg transition-colors"
            >
              <RefreshCw size={12} /> Recalcular dosis ({pesoKg} kg)
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SUPLEMENTOS.map(s => {
            const sel = seleccionados.find(x => x.nombre === s.nombre)
            return (
              <button
                key={s.nombre}
                onClick={() => toggleSup(s)}
                className={`text-left px-4 py-3 rounded-lg border-2 text-sm transition-all ${
                  sel
                    ? 'border-[#1e5fa8] bg-blue-50 text-[#1a3a5c]'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <span className="font-medium">{sel ? '✓ ' : ''}{s.nombre}</span>
                <span className="block text-xs text-slate-400 mt-0.5">
                  {s.dosis_por_kg ?? s.dosis_default}
                </span>
                <span className="block text-xs mt-1.5 leading-relaxed" style={{ color: sel ? '#1e5fa8cc' : '#94a3b8' }}>
                  {s.beneficio_clinico}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Personalizar dosis */}
      {seleccionados.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700 text-sm">Personalizar dosis y justificación</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {seleccionados.map(s => {
              const sup = SUPLEMENTOS.find(x => x.nombre === s.nombre)
              return (
                <div key={s.nombre} className="p-4 space-y-2">
                  <p className="font-medium text-slate-700 text-sm">{s.nombre}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-slate-400">Dosis</label>
                      <input
                        type="text"
                        value={s.dosis}
                        onChange={e => updateSup(s.nombre, 'dosis', e.target.value)}
                        className="w-full mt-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Nota / Justificación (opcional)</label>
                      <input
                        type="text"
                        value={s.justificacion}
                        onChange={e => updateSup(s.nombre, 'justificacion', e.target.value)}
                        placeholder="Ej: Vitamina D 18 ng/mL en laboratorio"
                        className="w-full mt-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Notas y control */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-2">Notas adicionales</label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Indicaciones generales..."
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-2">Cita de control</label>
          <input
            type="text"
            value={seguimiento}
            onChange={e => setSeguimiento(e.target.value)}
            placeholder="Ej: En 3 meses con nuevos laboratorios"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30"
          />
        </div>
      </div>

      {errorGuardado && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {errorGuardado}
        </div>
      )}

      <button
        onClick={imprimir}
        disabled={!paciente || seleccionados.length === 0 || imprimiendo}
        className="doc-print-btn w-full flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50"
      >
        {imprimiendo
          ? <><Loader2 size={18} className="animate-spin" /> Generando PDF...</>
          : <><Printer size={18} /> Imprimir Plan de Suplementación</>
        }
      </button>
    </div>
  )
}
