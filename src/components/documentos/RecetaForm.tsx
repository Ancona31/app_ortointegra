'use client'

import { generateDocFileName } from '@/lib/patientUtils'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Printer, Loader2 } from 'lucide-react'
import { flushSync } from 'react-dom'
import QRCode from 'qrcode'
import { Medicamento, MedicoInfo } from '@/types'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useProfile } from '@/hooks/useProfile'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { generarPdf } from '@/lib/mobileShare'
import AutocompleteMedicamento from '@/components/AutocompleteMedicamento'
import { MedicamentoDB } from '@/data/medicamentos'
import { useToast } from '@/components/ui/Toast'

type MedicamentoConVia = Medicamento & { via_administracion?: string }

const VIAS = ['Oral', 'Tópica', 'Intramuscular', 'Intravenosa', 'Subcutánea', 'Sublingual', 'Oftálmica', 'Ótica', 'Nasal', 'Inhalatoria', 'Rectal', 'Transdérmica']

const RECOMENDACIONES_PREDETERMINADAS: { label: string; texto: string }[] = [
  {
    label: '🦒 Columna Cervical (Cuello)',
    texto: `Postura: Mantenga la mirada al frente al usar el celular o computadora; evite flexionar el cuello por tiempo prolongado.

Descanso: Use una almohada cervical o una que mantenga su cabeza alineada con la columna.

Calor local: Aplique compresas húmedas-calientes por 15-20 min para relajar la musculatura.

🚨 Datos de Alarma: Pérdida de fuerza en manos, sensación de "toques eléctricos" hacia los brazos o dificultad para abotonarse la camisa.`,
  },
  {
    label: '🎒 Columna Dorsal (Espalda Media)',
    texto: `Carga: Evite cargar mochilas o bolsas pesadas sobre un solo hombro.

Movilidad: Realice ejercicios de extensión torácica y respiraciones profundas varias veces al día.

Ergonomía: Asegúrese de que su silla tenga un soporte adecuado en la zona media de la espalda.

🚨 Datos de Alarma: Dolor opresivo que impide la respiración profunda o dolor que se corre hacia las costillas (tipo cinturón).`,
  },
  {
    label: '🧘 Columna Lumbar (Espalda Baja)',
    texto: `Higiene de Columna: Al levantarse de la cama, hágalo de lado apoyando los brazos. No se doble de cintura para recoger objetos; flexione las rodillas.

Peso: Mantenga su peso ideal para reducir la carga mecánica sobre los discos intervertebrales.

Asientos: Evite sillones muy blandos o permanecer sentado más de 50 minutos seguidos.

🚨 Datos de Alarma: Adormecimiento en la zona genital (silla de montar), pérdida de control de esfínteres o "pie caído" (tropiezos constantes).`,
  },
  {
    label: '⚾ Hombro y Codo',
    texto: `Reposo relativo: Evite levantar el brazo por encima del nivel de la cabeza o cargar objetos pesados con el brazo estirado.

Crioterapia: Aplique hielo envuelto en una toalla por 15 min después de realizar actividades físicas.

Movimiento: Realice ejercicios pendulares (deje colgar el brazo y haga círculos suaves) si su médico lo autorizó.

🚨 Datos de Alarma: Imposibilidad total para elevar el brazo o deformidad evidente ("signo del Popeye").`,
  },
  {
    label: '🖐️ Muñeca y Mano',
    texto: `Férulas: Si se le indicó férula, úsela especialmente durante la noche para evitar posturas viciosas.

Pausas: Si trabaja en computadora, realice estiramientos de flexores y extensores cada hora.

Edema: Mantenga la mano elevada por encima del nivel del corazón si presenta mucha inflamación.

🚨 Datos de Alarma: Dedos morados/fríos o pérdida total de la sensibilidad (anestesia) en las yemas.`,
  },
  {
    label: '🦵 Rodilla',
    texto: `Impacto: Evite saltar, correr en superficies duras o subir/bajar escaleras innecesariamente.

Calzado: Use zapatos con buena amortiguación; evite tacones altos o sandalias totalmente planas.

Control de carga: No permanezca de pie por periodos prolongados.

🚨 Datos de Alarma: Rodilla "trabada" (incapacidad para estirar o doblar), aumento de temperatura local intensa o sensación de inestabilidad ("se le va la rodilla").`,
  },
  {
    label: '🦶 Tobillo y Pie',
    texto: `Elevación: Mantenga el pie elevado con dos almohadas al estar sentado o acostado.

Vendaje: Si usa vendaje elástico, asegúrese de que no esté demasiado apretado; debe poder introducir un dedo bajo la venda.

Apoyo: Respete el tiempo de "no apoyo" si se le indicó el uso de muletas o andadera.

🚨 Datos de Alarma: Hinchazón excesiva de la pantorrilla con dolor al tocarla (posible coágulo) o cambios de coloración en los dedos.`,
  },
  {
    label: '📍 Fisioterapia y Rehabilitación',
    texto: `Asistencia: Cumplir con un ciclo inicial de 10 sesiones para asegurar resultados.

Frecuencia: Se sugiere acudir de 2 a 3 veces por semana según la disponibilidad.

Objetivos: Enfoque en higiene de columna, fortalecimiento de core y estiramientos analíticos.

Modalidades: Aplicación de medios físicos, electrotermoterapia y terapia manual.

Restricciones: Evitar cargar objetos pesados (>5 kg) y movimientos de rotación brusca.

Seguimiento: Al concluir las sesiones, solicitar reporte de evolución para su revaloración en consulta.

💡 Nota importante: La constancia en su rehabilitación es la clave para una recuperación exitosa y para prevenir futuras lesiones. ¡Su esfuerzo hoy es su movilidad mañana!`,
  },
  {
    label: '✂️ Cuidados de la Herida Quirúrgica (Postoperados)',
    texto: `Limpieza: Lave la herida solo con agua y jabón neutro durante el baño diario. Seque con toques suaves usando una gasa estéril o toalla limpia exclusiva.

Exposición: Mantenga la herida cubierta con una gasa seca a menos que su cirujano indique dejarla al aire.

Prohibido: No aplique alcohol, agua oxigenada, pomadas, cremas, remedios caseros o "chochitos" sobre la incisión.

Actividad: Evite esfuerzos físicos que puedan "estirar" la cicatriz y causar que se abra (dehiscencia).

🚨 Datos de Alarma en la Herida:
• Salida de líquido amarillento, espeso o con mal olor (pus).
• Enrojecimiento que se extiende más allá de los bordes de la herida.
• Fiebre mayor a 38°C persistente.
• Apertura de los puntos de sutura.`,
  },
]

interface Props {
  pacienteInicial?: string
  diagnosticoInicial?: string
  pacienteId?: string
  medicamentosIniciales?: MedicamentoConVia[]
}

export default function RecetaForm({ pacienteInicial = '', diagnosticoInicial = '', pacienteId, medicamentosIniciales }: Props) {
  const { medicoInfo } = useMedicoInfo()
  const { isSuperAdmin } = useProfile()
  const toast = useToast()
  const [paciente, setPaciente] = useState(pacienteInicial)
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial)
  const [pacienteData, setPacienteData] = useState<{ edad?: number | null; sexo?: string } | null>(null)

  useEffect(() => {
    if (!pacienteId) return

    async function cargarDatosPaciente() {
      // Helper: aplicar datos (edad + sexo) al state desde cualquier fuente
      const aplicar = (fechaNac: string | null, sexo: string | null | undefined) => {
        const edad = fechaNac
          ? Math.floor((Date.now() - new Date(fechaNac).getTime()) / (365.25 * 24 * 3600 * 1000))
          : null
        setPacienteData({ edad, sexo: sexo ?? undefined })
      }

      try {
        const supabase = createClient()
        const res = await supabase
          .from('pacientes')
          .select('fecha_nacimiento, sexo')
          .eq('id', pacienteId)
          .single() as { data: { fecha_nacimiento: string | null; sexo: string | null } | null; error: unknown }

        if (res.data) {
          aplicar(res.data.fecha_nacimiento, res.data.sexo)
        }
      } catch {
        // Sin red — no hacer nada
      }
    }

    cargarDatosPaciente()
  }, [pacienteId])

  const medInicial: MedicamentoConVia[] = medicamentosIniciales && medicamentosIniciales.length > 0
    ? medicamentosIniciales
    : [{ nombre_comercial: '', presentacion: '', dosis: '', principio_activo: '', indicacion: '', via_administracion: 'Oral' }]

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [medicamentos, setMedicamentos] = useState<MedicamentoConVia[]>(medInicial)
  const [sugerenciasDosis, setSugerenciasDosis] = useState<string[]>(medInicial.map(() => ''))
  const [recomendaciones, setRecomendaciones] = useState('')
  const [errorGuardado, setErrorGuardado] = useState('')
  const [imprimiendo, setImprimiendo] = useState(false)

  function addMed() {
    setMedicamentos([...medicamentos, { nombre_comercial: '', presentacion: '', dosis: '', principio_activo: '', indicacion: '', via_administracion: 'Oral' }])
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

  async function imprimir() {
    flushSync(() => { setErrorGuardado(''); setImprimiendo(true) })

    // 1. Feedback instantáneo — el usuario ve progreso en <50ms
    toast.info('Generando receta...')

    // 2. Construcción de identidad — el folio sirve DOBLE propósito:
    //    - Identificador público del documento (QR de verificación)
    //    - clientId para idempotencia (idempotencia garantizada por el
    //      índice único parcial en la tabla documentos)
    const folio = `R-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
    const contenido = {
      folio,
      paciente,
      diagnostico,
      medicamentos,
      recomendaciones,
      fecha,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      medico_nombre: medicoInfo?.nombre || '',
      medico_especialidad: medicoInfo?.especialidad || '',
      medico_cedula_profesional: medicoInfo?.cedula_profesional || '',
      medico_cedula_especialidad: medicoInfo?.cedula_especialidad || '',
      clinica_nombre: medicoInfo?.clinica_nombre || '',
      color_primario: medicoInfo?.color_primario || '#1a3a5c',
      color_secundario: medicoInfo?.color_secundario || '#1e5fa8',
    }

    // Flags de tracking para diferenciar errores de PDF vs persistencia
    let pdfGenerated = false

    try {
      // 3. PDF PRIMERO — si falla, abortamos antes de escribir nada.
      //    Evita orphan records donde el outbox tiene una receta que el
      //    médico nunca vio porque el PDF nunca se generó.
      const verificacionUrl = `${window.location.origin}/r/${folio}`
      const [qrDataUrl, blogQrDataUrl] = await Promise.all([
        QRCode.toDataURL(verificacionUrl, {
          width: 96,
          margin: 1,
          color: { dark: '#1a3a5c', light: '#ffffff' },
        }),
        isSuperAdmin
          ? QRCode.toDataURL('https://dranconacolumna.com/articulos.html', {
              width: 64,
              margin: 1,
              color: { dark: medicoInfo?.color_primario || '#1a3a5c', light: '#ffffff' },
            })
          : Promise.resolve(''),
      ])

      const fechaFormat = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })
      const medsData = medicamentos.filter(m => m.nombre_comercial)

      const doctorNombre = medicoInfo?.nombre || 'Médico'
      const doctorEspecialidad = medicoInfo?.especialidad || ''
      const cedProf = medicoInfo?.cedula_profesional || ''
      const cedEsp = medicoInfo?.cedula_especialidad || ''
      const direccion = medicoInfo?.direccion_consultorio || ''
      const telefono = medicoInfo?.telefono_consultorio || ''
      const logoUrl =
        medicoInfo?.logo_url && medicoInfo.logo_url.startsWith('https://')
          ? medicoInfo.logo_url
          : `${window.location.origin}/logo.png`
      const cp = medicoInfo?.color_primario || '#1a3a5c'
      const cs = medicoInfo?.color_secundario || '#1e5fa8'
      const edadPaciente = pacienteData?.edad
      const sexoPaciente =
        pacienteData?.sexo === 'M' ? 'Masculino' :
        pacienteData?.sexo === 'F' ? 'Femenino' :
        pacienteData?.sexo || ''

      await generarPdf({
        tipo: 'receta',
        medico: {
          nombre: doctorNombre,
          especialidad: doctorEspecialidad,
          cedula_profesional: cedProf,
          cedula_especialidad: cedEsp,
          color_primario: cp,
          color_secundario: cs,
          direccion_consultorio: direccion,
          telefono_consultorio: telefono,
          firma_url: medicoInfo?.firma_url ?? null,
        },
        data: {
          paciente,
          fecha: fechaFormat,
          diagnostico,
          edad: edadPaciente != null ? `${edadPaciente} años` : undefined,
          sexo: sexoPaciente || undefined,
          folio,
          medicamentos: medsData,
          recomendaciones: recomendaciones || undefined,
          qrDataUrl,
          blogQrDataUrl: blogQrDataUrl || undefined,
        },
        logoUrl,
        filename: generateDocFileName(paciente, 'Receta'),
      })

      pdfGenerated = true

      // 4. Persistencia — insertar directamente en Supabase
      const supabase = createClient()
      const insertPayload: Record<string, unknown> = {
        tipo: 'receta',
        contenido,
        client_id: folio,
      }
      if (pacienteId) insertPayload.paciente_id = pacienteId

      const { error } = await supabase.from('documentos').insert(insertPayload)
      if (error) throw error

      toast.success('Receta guardada')
    } catch (err) {
      if (!pdfGenerated) {
        // El error ocurrió antes/durante el PDF → ningún orphan record
        toast.error('No se pudo generar el PDF. Intenta de nuevo.')
        setErrorGuardado('No se pudo generar el PDF. Intenta de nuevo.')
      } else {
        // PDF OK pero persistencia fallida
        toast.error('Receta generada pero no se pudo guardar. Revisa errores de sincronización.')
        setErrorGuardado('Error al guardar la receta.')
      }
      // eslint-disable-next-line no-console
      console.error('[RecetaForm] imprimir falló:', err)
    } finally {
      setImprimiendo(false)
    }
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
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700 text-sm">Medicamentos</h2>
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
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Vía de administración</label>
                  <select value={(med as MedicamentoConVia).via_administracion || 'Oral'} onChange={e => updateMed(i, 'via_administracion' as any, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30">
                    {VIAS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
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
          {/* Botón al pie del último medicamento */}
          <div className="px-4 py-3">
            <button onClick={addMed}
              className="flex items-center gap-1.5 text-xs font-medium text-[#1e5fa8] hover:text-[#1a3a5c] transition-colors">
              <Plus size={14} /> Agregar medicamento
            </button>
          </div>
        </div>
      </div>

      {/* Recomendaciones */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-700">Recomendaciones / Notas</label>
          {recomendaciones && (
            <button
              onClick={() => setRecomendaciones('')}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors"
            >
              Limpiar
            </button>
          )}
        </div>
        <select
          defaultValue=""
          onChange={e => {
            if (!e.target.value) return
            const rec = RECOMENDACIONES_PREDETERMINADAS.find(r => r.label === e.target.value)
            if (rec) {
              const bloque = `${rec.label}\n${rec.texto}`
              setRecomendaciones(prev => prev ? prev + '\n\n' + bloque : bloque)
            }
            e.target.value = ''
          }}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 bg-slate-50"
        >
          <option value="">＋ Insertar recomendaciones predeterminadas...</option>
          {RECOMENDACIONES_PREDETERMINADAS.map(r => (
            <option key={r.label} value={r.label}>{r.label}</option>
          ))}
        </select>
        <textarea
          value={recomendaciones}
          onChange={e => setRecomendaciones(e.target.value)}
          placeholder="Selecciona un segmento arriba o escribe tus propias recomendaciones..."
          rows={6}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30"
        />
      </div>

      {errorGuardado && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {errorGuardado}
        </p>
      )}

      <button
        onClick={imprimir}
        disabled={!paciente || imprimiendo}
        className="doc-print-btn w-full flex items-center justify-center gap-2 py-3 bg-[#1a3a5c] text-white rounded-xl font-medium hover:bg-[#0f2540] transition-colors disabled:opacity-50"
      >
        {imprimiendo
          ? <><Loader2 size={18} className="animate-spin" /> Generando PDF...</>
          : <><Printer size={18} /> Imprimir Receta</>}
      </button>
    </div>
  )
}
