'use client'
import { generateDocFileName } from '@/lib/patientUtils'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, BedDouble, Check, Plus, Printer, Trash2 } from 'lucide-react'
import { flushSync } from 'react-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { generarPdf, VERSION_DE_EMISION, versionQueEmite } from '@/lib/mobileShare'
import { useToast } from '@/components/ui/Toast'
import ModalDocumentoGenerado from '@/components/documentos/ModalDocumentoGenerado'
import SeccionPlegable from '@/components/documentos/SeccionPlegable'
import IndicacionesPiso, {
  contarRenglones, leerGrupos, resumenIndicaciones, textoIndicaciones,
  type GrupoIndicaciones,
} from '@/components/documentos/IndicacionesPiso'
import { usePlantillasDocumento, type ContenidoPlantilla } from '@/components/documentos/PlantillasDocumento'
import { folioImpreso } from '@/lib/documentos/folio'
import { createClient } from '@/lib/supabase/client'
import { hoyEnTZ, desplazarFecha } from '@/lib/dates'
import { enfocarYAcercar } from '@/lib/scrollDoc'

interface Props {
  pacienteInicial?: string
  diagnosticoInicial?: string
  pacienteId?: string
  offlineMode?: boolean
  onOfflineSave?: () => void
  /** Reporta al host si el formulario sigue vacío (guía 04 §6.1 y §6.2). */
  onVacioChange?: (vacio: boolean) => void
  /**
   * El panel de plantillas sustituye al formulario en su mismo espacio, y
   * mientras está abierto el selector de tipo del host se oculta (spec 02 §3.1):
   * elegir otro tipo desde ahí tiraría el formulario sobre el que el panel
   * opera.
   */
  onPanelPlantillasChange?: (abierto: boolean) => void
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

const FECHA_MIN = '1900-01-01'

/**
 * Las instrucciones al paciente **no se estructuran** (§4). Las de piso las
 * ejecuta enfermería y cada renglón es una orden con destinatario; estas las lee
 * el paciente de corrido y su valor está en el tono. Estructurarlas obligaría a
 * teclear seis renglones para obtener el párrafo que ya viene escrito.
 *
 * Lo que cambia es de dónde sale el texto por defecto: entra en la plantilla, de
 * modo que editarlo una vez lo deja editado para siempre en vez de reescribirlo
 * en cada internamiento. La constante sigue aquí porque es el original contra el
 * que se compara para decir `Editada`.
 */
const INSTRUCCIONES_DEFECTO =
`• Presentarse en Admisión Hospitalaria con: identificación oficial vigente, esta hoja de internamiento, estudios recientes (laboratorios, radiografías, resonancias) y Valoración preoperatoria (Muy Importante).
• Ayuno estricto de 8 horas antes del procedimiento. La cena deberá de ser ligera.
• No traer objetos de valor, joyas ni alhajas.
• Venir acompañado de un familiar mayor de edad responsable.
• Si toma medicamentos antihipertensivos o de la tiroides, NO los suspenda sin consultarnos antes.
• Traer ropa cómoda y artículos de aseo personal para su estancia.`

interface EstadoVacio {
  paciente: string
  pacienteInicial: string
  diagnostico: string
  diagnosticoInicial: string
  secundarios: readonly string[]
  fechaIngreso: string
  tipoInternamiento: string
  diasEstimados: string
  asa: string
  lugar: string
  urgente: boolean
  procedimiento: string
  requerimientos: readonly string[]
  requerimientosExtra: string
  justificacion: string
  instruccionesPaciente: string
  grupos: readonly GrupoIndicaciones[]
}

/**
 * Predicado único de «formulario vacío». Mismo criterio que Laboratorio: lo que
 * llega solo no cuenta como escrito hasta que se edita. Aquí eso son tres cosas
 * —paciente y diagnóstico de la ficha, e instrucciones al paciente del texto por
 * defecto—, no dos.
 */
function isFormEmpty(e: EstadoVacio): boolean {
  const pacienteIntacto = e.paciente.trim() === '' || e.paciente.trim() === e.pacienteInicial.trim()
  const dxIntacto = e.diagnostico.trim() === '' || e.diagnostico.trim() === e.diagnosticoInicial.trim()
  const instruccionesIntactas = e.instruccionesPaciente === INSTRUCCIONES_DEFECTO
  return pacienteIntacto && dxIntacto && instruccionesIntactas
    && e.secundarios.every(d => d.trim() === '')
    && e.fechaIngreso === '' && e.tipoInternamiento === '' && e.diasEstimados.trim() === ''
    && e.asa === '' && e.lugar.trim() === '' && !e.urgente
    && e.procedimiento.trim() === '' && e.requerimientos.length === 0
    && e.requerimientosExtra.trim() === '' && e.justificacion.trim() === ''
    && contarRenglones(e.grupos) === 0
}

export default function SolicitudInternamientoForm({ pacienteInicial = '', diagnosticoInicial = '', pacienteId, offlineMode, onOfflineSave, onVacioChange, onPanelPlantillasChange }: Props) {
  const { medicoInfo: onlineMedicoInfo, isLoading: cargandoPerfil } = useMedicoInfo()
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

  // Imprimir antes de que resuelva el perfil produce un PDF con el encabezado
  // vacío: sin nombre, sin cédulas, sin domicilio. Solo bloquea mientras carga;
  // si resuelve sin datos el botón se habilita igual.
  const perfilPendiente = cargandoPerfil && !medicoInfo
  const toast = useToast()
  const [paciente, setPaciente] = useState(pacienteInicial)
  const [fecha, setFecha] = useState(hoyEnTZ())
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
  const [instruccionesPaciente, setInstruccionesPaciente] = useState(INSTRUCCIONES_DEFECTO)
  const [gruposPiso, setGruposPiso] = useState<GrupoIndicaciones[]>([])
  const [imprimiendo, setImprimiendo] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [docGenerado, setDocGenerado] = useState<{ blob: Blob; guardado: boolean; documentoId: string | null } | null>(null)
  // El banner de faltantes NO existe hasta el primer intento de imprimir: un
  // formulario recién abierto no acusa de nada. Después permanece y se
  // actualiza en vivo.
  const [intentado, setIntentado] = useState(false)

  const formRef = useRef<HTMLDivElement>(null)
  const pacienteRef = useRef<HTMLInputElement>(null)
  const lugarRef = useRef<HTMLInputElement>(null)
  const diagnosticoRef = useRef<HTMLInputElement>(null)
  const ingresoRef = useRef<HTMLInputElement>(null)

  const vacio = isFormEmpty({
    paciente, pacienteInicial, diagnostico, diagnosticoInicial,
    secundarios: diagnosticosSecundarios, fechaIngreso, tipoInternamiento,
    diasEstimados, asa, lugar, urgente, procedimiento, requerimientos,
    requerimientosExtra, justificacion, instruccionesPaciente, grupos: gruposPiso,
  })
  useEffect(() => { onVacioChange?.(vacio) }, [vacio, onVacioChange])

  // ── Plantillas (spec 02) ────────────────────────────────────────
  // Se guarda TODO menos los datos del paciente. Aquí eso deja fuera paciente,
  // diagnóstico, secundarios y las dos fechas: los cinco son suyos aunque los
  // teclee el médico, y una plantilla con la fecha congelada es un defecto.
  //
  // `urgente` SÍ entra, y no es descuido: sin él «Vaciar formulario» —que aplica
  // un contenido sin ninguna clave— dejaría la casilla marcada de la sesión
  // anterior, que es peor que una plantilla que la traiga y se vea marcada.
  const plantillas = usePlantillasDocumento({
    tipo: 'solicitud_internamiento',
    vacio,
    // El búnker no tiene red ni sesión de Supabase: el sistema no se monta.
    desactivado: !!offlineMode,
    onPanelChange: onPanelPlantillasChange,
    leer: () => ({
      _v: 1, tipoInternamiento, diasEstimados, asa, lugar, urgente, procedimiento,
      requerimientos, requerimientosExtra, justificacion, instruccionesPaciente,
      gruposPiso: gruposPiso.map(g => ({ nombre: g.nombre, renglones: [...g.renglones] })),
    }),
    aplicar: (c: ContenidoPlantilla) => {
      // Solo las claves que existen HOY en el formulario, y comprobando el tipo
      // de cada una: el jsonb pudo guardarse con otra versión del formulario.
      // Los `else` NO son defensa de sobra: «Vaciar formulario» aplica un
      // contenido sin ninguna clave, así que es justo lo que repone el estado
      // inicial. El paciente y el diagnóstico no se tocan aquí, y por eso
      // sobreviven al vaciado.
      setTipoInternamiento(typeof c.tipoInternamiento === 'string' ? c.tipoInternamiento : '')
      setDiasEstimados(typeof c.diasEstimados === 'string' ? c.diasEstimados : '')
      setAsa(typeof c.asa === 'string' ? c.asa : '')
      setLugar(typeof c.lugar === 'string' ? c.lugar : '')
      setUrgente(c.urgente === true)
      setProcedimiento(typeof c.procedimiento === 'string' ? c.procedimiento : '')
      setRequerimientos(Array.isArray(c.requerimientos)
        ? c.requerimientos.filter((r): r is string => typeof r === 'string')
        : [])
      setRequerimientosExtra(typeof c.requerimientosExtra === 'string' ? c.requerimientosExtra : '')
      setJustificacion(typeof c.justificacion === 'string' ? c.justificacion : '')
      setInstruccionesPaciente(typeof c.instruccionesPaciente === 'string'
        ? c.instruccionesPaciente
        : INSTRUCCIONES_DEFECTO)
      setGruposPiso(leerGrupos(c.gruposPiso))
    },
  })

  // G-10: foco al primer campo editable vacío al montar. preventScroll para no
  // arrastrar la página hasta él. En móvil esto abre el teclado en cada montaje.
  useEffect(() => {
    const primero = formRef.current?.querySelector<HTMLElement>('input:not([type="date"]), textarea')
    if (primero instanceof HTMLInputElement && !primero.value) primero.focus({ preventScroll: true })
  }, [])

  function toggleRequerimiento(r: string): void {
    setRequerimientos(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  }

  function addDx() { setDiagnosticosSecundarios(prev => [...prev, '']) }
  function updateDx(i: number, val: string) {
    setDiagnosticosSecundarios(prev => prev.map((d, idx) => idx === i ? val : d))
  }
  function removeDx(i: number) {
    setDiagnosticosSecundarios(prev => prev.filter((_, idx) => idx !== i))
  }

  // ── Validación (§3.8) ───────────────────────────────────────────
  // El orden es el del literal de §5: `Paciente · Hospital · Diagnóstico
  // principal`.
  const faltantes: { clave: string; nombre: string }[] = []
  if (!paciente.trim()) faltantes.push({ clave: 'paciente', nombre: 'Paciente' })
  if (!lugar.trim()) faltantes.push({ clave: 'lugar', nombre: 'Hospital' })
  if (!diagnostico.trim()) faltantes.push({ clave: 'diagnostico', nombre: 'Diagnóstico principal' })
  /*
    LA FECHA DE INGRESO BLOQUEA, como el hospital. Es lo que Admisión necesita para
    agendar la cama: una solicitud que no dice qué día entra el paciente no se puede
    programar, y hasta ahora se podía emitir sin ella —el papel salía con la celda
    colapsada y el hospital tenía que llamar a preguntar—.
  */
  if (!fechaIngreso.trim()) faltantes.push({ clave: 'fechaIngreso', nombre: 'Fecha de ingreso' })

  function textoFaltantes(): string {
    const n = faltantes.length
    const cabeza = faltantes.slice(0, 3).map(f => f.nombre).join(' · ')
    const resto = n > 3 ? ` y ${n - 3} más` : ''
    return `${n === 1 ? 'Falta 1 campo' : `Faltan ${n} campos`}: ${cabeza}${resto}`
  }

  function irA(clave: string) {
    if (clave === 'paciente') { enfocarYAcercar(pacienteRef.current); return }
    if (clave === 'lugar') { enfocarYAcercar(lugarRef.current); return }
    if (clave === 'fechaIngreso') { enfocarYAcercar(ingresoRef.current); return }
    enfocarYAcercar(diagnosticoRef.current)
  }

  async function imprimir() {
    // El primario nunca está gris por faltantes: un botón apagado no enseña qué
    // falta, el banner sí. Al pulsar con faltantes no emite y lleva al primero.
    if (faltantes.length > 0) {
      setIntentado(true)
      irA(faltantes[0].clave)
      return
    }
    flushSync(() => { setErrorGuardado(''); setImprimiendo(true) })

    // 1. Feedback instantáneo
    toast.info('Generando solicitud de internamiento...')

    // 2. Identidad — UUID v4 puro como clientId
    const clientId = crypto.randomUUID()

    // 3. Contenido persistido — requerimientos y requerimientosExtra
    //    quedan SEPARADOS (se fusionan solo para el PDF).
    //
    //    Las indicaciones de piso se guardan DOS VECES y a propósito:
    //    `indicacionesGrupos` es lo que el médico tecleó, y `indicacionesPiso`
    //    es su composición para el analizador de 2.J. La cadena es la que leen
    //    el PDF de hoy y los documentos ya emitidos —que no se convierten—; la
    //    estructura es el dato de verdad, y sin ella el grupo y el renglón se
    //    pierden en cuanto la cadena se compone.
    const indicacionesPiso = textoIndicaciones(gruposPiso)
    const contenido = {
      paciente, fecha, fechaIngreso, lugar, diagnostico,
      diagnosticosSecundarios: diagnosticosSecundarios.filter(Boolean),
      tipoInternamiento, procedimiento, diasEstimados,
      asa, urgente, requerimientos, requerimientosExtra, justificacion,
      instruccionesPaciente, indicacionesPiso,
      indicacionesGrupos: gruposPiso.map(g => ({ nombre: g.nombre, renglones: [...g.renglones] })),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }

    // El blob y el desenlace de la persistencia se leen en el finally para
    // montar el modal posterior a la generación. Ver ModalDocumentoGenerado.
    let pdfBlob: Blob | null = null
    let guardado = false
    let filaId: string | null = null
    let folio: string | null = null

    try {
      // ── 4 · LA FILA PRIMERO ───────────────────────────────────────────
      //    Invierte el orden que este formulario tenía —PDF, subida, fila—,
      //    como los otros seis, para que la fila exista antes de renderizar.
      //
      //    ⚠ **Y AQUÍ EL PAPEL SIGUE SIN LLEVAR EL FOLIO, A PROPÓSITO.** La base
      //    asigna `INT-…` y la fila lo lleva —el expediente numera todo lo que
      //    emite, porque una serie con huecos no se audita—, pero nadie va a
      //    citar ese número desde el hospital y el formato no compone su ranura.
      //    Decisión reconfirmada: ver `DOCUMENTOS_RANURAS_MUERTAS.md` §2 y
      //    `folioImpreso()`, que es donde está escrito y donde el botón de
      //    regenerar lee lo mismo.
      const supabase = offlineMode ? null : createClient()
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No autenticado')

        const insertPayload: Record<string, unknown> = {
          tipo: 'solicitud_internamiento',
          contenido,
          client_id: clientId,
          subido_por: user.id,
          // CON QUÉ CHASIS SALE EL PAPEL. La fila nace emitida, así que la
          // versión se fija aquí y a partir de este INSERT es inmutable
          // (`20260813_formato_version_inmutable.sql`). Tiene que ser el mismo
          // número que recibe `generarPdf` más abajo.
          formato_version: VERSION_DE_EMISION,
        }
        if (pacienteId) insertPayload.paciente_id = pacienteId

        const { data, error } = await supabase
          .from('documentos')
          .insert(insertPayload)
          .select('id, folio')
          .single()
        if (error) throw error
        filaId = data.id
        folio = data.folio
        // La fila está en el expediente. Aunque el PDF falle después, el
        // documento es recuperable desde la lista con su botón de regenerar.
        guardado = true
      }

      // ── 5 · El PDF ────────────────────────────────────────────────────
      const medicoData = medicoInfo ? {
        nombre: medicoInfo.nombre,
        titulo: medicoInfo.titulo ?? null,
        nombres: medicoInfo.nombres ?? null,
        apellido_paterno: medicoInfo.apellido_paterno ?? null,
        apellido_materno: medicoInfo.apellido_materno ?? null,
        especialidad: medicoInfo.especialidad,
        cedula_profesional: medicoInfo.cedula_profesional,
        cedula_especialidad: medicoInfo.cedula_especialidad,
        // El membrete de v2 la exige por normativa (I.3.7) y sin ella el
        // renglón sale sin universidad, en silencio.
        universidad: medicoInfo.universidad ?? null,
        color_primario: medicoInfo.color_primario,
        color_secundario: medicoInfo.color_secundario,
        direccion_consultorio: medicoInfo.direccion_consultorio,
        telefono_consultorio: medicoInfo.telefono_consultorio,
        firma_url: medicoInfo.firma_url ?? null,
      } : null
      const logoUrl = medicoInfo?.logo_url?.startsWith('https://') ? medicoInfo.logo_url : undefined
      const fechaFormat = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })
      const fechaIngresoFormat = fechaIngreso ? format(new Date(fechaIngreso + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es }) : undefined

      const consultorioData = consultorioActivo ? {
        nombre: consultorioActivo.nombre,
        direccion: consultorioActivo.direccion,
        telefono: consultorioActivo.telefono,
      } : undefined

      const { blob, storagePath } = await generarPdf({
        tipo: 'solicitud_internamiento',
        pacienteId,
        medico: medicoData,
        data: {
          paciente, fecha: fechaFormat, fechaIngreso: fechaIngresoFormat, lugar,
          diagnostico, diagnosticosSecundarios: diagnosticosSecundarios.filter(Boolean),
          tipoInternamiento, procedimiento, diasEstimados, asa, urgente,
          requerimientos: [...requerimientos, ...(requerimientosExtra ? [requerimientosExtra] : [])].filter(Boolean),
          justificacion, instruccionesPaciente, indicacionesPiso,
          // Devuelve undefined SIEMPRE para este formato: la fila lleva el folio
          // y el papel no lo dice. Ver arriba.
          folio: folioImpreso('solicitud_internamiento', folio),
        },
        logoUrl,
        filename: generateDocFileName(paciente, 'Solicitud_Internamiento'),
        consultorio: consultorioData,
        // El mismo número que acaba de escribirse en la fila. Ver `versionQueEmite`.
        formatoVersion: versionQueEmite(offlineMode),
        // El búnker offline queda intacto: sigue entregando el PDF él mismo y
        // no monta el modal — onOfflineSave desmonta el formulario al guardar.
        entregar: !!offlineMode,
      })

      pdfBlob = blob

      // ── 6 · La ruta del archivo, sobre la fila que ya existe ──────────
      if (offlineMode) {
        const { addDocument } = await import('@/lib/offline/db')
        const { getOfflineIdentity } = await import('@/lib/offline/identity')
        await addDocument({
          id: crypto.randomUUID(),
          temp_patient_id: pacienteId ?? 'unknown',
          tipo: 'solicitud_internamiento',
          contenido,
          created_at: new Date().toISOString(),
          medico_id: getOfflineIdentity()?.userId ?? 'anonymous',
          _syncStatus: 'pending',
        })
        toast.success('Solicitud de internamiento guardada en bunker offline')
        onOfflineSave?.()
      } else {
        if (storagePath && filaId && supabase) {
          // Este UPDATE no toca ni el estado ni el folio, así que el trigger lo
          // deja pasar. No es fatal si falla: la fila está y el PDF se entrega
          // igual; lo que se pierde es la descarga desde la lista, que el botón
          // de regenerar repone.
          const { error } = await supabase
            .from('documentos')
            .update({ pdf_url: storagePath })
            .eq('id', filaId)
          if (error) console.error('[SolicitudInternamientoForm] update pdf_url:', error.message)
        }
        // El folio SÍ va en el toast aunque no vaya en el papel: en pantalla es
        // donde el médico puede leerlo y anotarlo si lo necesita.
        toast.success(folio
          ? `Solicitud de internamiento guardada · ${folio}`
          : 'Solicitud de internamiento guardada')
      }
    } catch (err) {
      // Tres desenlaces, y el del medio es nuevo: con la fila escrita antes que
      // el PDF, un fallo de render deja un documento emitido y un folio
      // consumido. Decirlo con el número delante es lo que permite encontrarlo
      // en la lista y recuperar el PDF desde ahí.
      let msg: string
      if (offlineMode) {
        msg = 'No se pudo generar el PDF. Intenta de nuevo.'
      } else if (filaId === null) {
        msg = 'No se pudo guardar la solicitud, así que no se generó el PDF. Intenta de nuevo.'
      } else {
        msg = `La solicitud quedó registrada${folio ? ` con folio ${folio}` : ''}, pero no se pudo `
          + 'generar el PDF. Búscala en la lista de documentos del paciente y recupérala desde ahí.'
      }
      toast.error(msg)
      setErrorGuardado(msg)
      // eslint-disable-next-line no-console
      console.error('[SolicitudInternamientoForm] imprimir falló:', err)
    } finally {
      setImprimiendo(false)
      // También cuando la persistencia falló: el PDF existe y con el paciente
      // enfrente lo urgente es poder imprimirlo.
      if (pdfBlob && !offlineMode) setDocGenerado({ blob: pdfBlob, guardado, documentoId: filaId })
    }
  }

  const senalar = (clave: string) => intentado && faltantes.some(f => f.clave === clave)
  const conNumeral = diagnosticosSecundarios.length >= 2
  const maxFecha = desplazarFecha(hoyEnTZ(), { anios: 1 })

  return (
    <div ref={formRef} className="sp-doc-form">
      {/* El árbol del formulario NO se desmonta cuando el panel de plantillas
          está abierto: se apaga con display:none y el panel se monta como
          hermano, en el mismo contenedor de scroll (spec 02 §3.1). */}
      <div className="sp-doc-formbody" style={plantillas.panelAbierto ? { display: 'none' } : undefined}>

      {plantillas.selector}

      <section className="sp-card sp-doc-card">
        <div className="sp-doc-cardhead">
          <div className="sp-icobox sp-icobox--sm"><BedDouble /></div>
          <h2 className="sp-label">Datos generales</h2>
        </div>
        <div className="sp-doc-cardbody">
          <div className="sp-doc-grid" data-cols="3">
            <div className="sp-doc-field">
              <label htmlFor="internamiento-fecha" className="sp-label-field">Fecha</label>
              <input id="internamiento-fecha" type="date" value={fecha}
                min={FECHA_MIN} max={maxFecha}
                onChange={e => setFecha(e.target.value)} className="sp-input" />
            </div>
            <div className="sp-doc-field">
              <label htmlFor="internamiento-paciente" className="sp-label-field">
                Paciente <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                <span className="sr-only">obligatorio</span>
              </label>
              <input ref={pacienteRef} id="internamiento-paciente" type="text" value={paciente}
                onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo"
                aria-invalid={senalar('paciente') || undefined}
                className={`sp-input ${senalar('paciente') ? 'sp-doc-invalid' : ''}`} />
            </div>
            <div className="sp-doc-field">
              <label htmlFor="internamiento-tipo" className="sp-label-field">Tipo de internamiento</label>
              <select id="internamiento-tipo" value={tipoInternamiento}
                onChange={e => setTipoInternamiento(e.target.value)} className="sp-input">
                <option value="">Seleccionar…</option>
                {TIPOS_INTERNAMIENTO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="sp-doc-field">
              <label htmlFor="internamiento-ingreso" className="sp-label-field">
                Fecha propuesta de ingreso <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                <span className="sr-only">obligatorio</span>
              </label>
              <input ref={ingresoRef} id="internamiento-ingreso" type="date" value={fechaIngreso}
                min={FECHA_MIN} max={maxFecha}
                onChange={e => setFechaIngreso(e.target.value)}
                aria-invalid={senalar('fechaIngreso') || undefined}
                className={`sp-input ${senalar('fechaIngreso') ? 'sp-doc-invalid' : ''}`} />
            </div>
            {/* Texto libre y no numérico: `3-5 días` es la respuesta habitual. */}
            <div className="sp-doc-field">
              <label htmlFor="internamiento-dias" className="sp-label-field">Días estimados</label>
              <input id="internamiento-dias" type="text" value={diasEstimados}
                onChange={e => setDiasEstimados(e.target.value)}
                placeholder="Ej: 3-5 días" className="sp-input" />
            </div>
            <div className="sp-doc-field">
              <label htmlFor="internamiento-asa" className="sp-label-field">Clasificación ASA</label>
              <select id="internamiento-asa" value={asa}
                onChange={e => setAsa(e.target.value)} className="sp-input">
                <option value="">Seleccionar…</option>
                {ASA.map(a => <option key={a} value={`ASA ${a}`}>ASA {a}</option>)}
              </select>
            </div>
            {/* N-01: el hospital vivía fuera de la rejilla, y es obligatorio. */}
            <div className="sp-doc-field sp-doc-span-2">
              <label htmlFor="internamiento-lugar" className="sp-label-field">
                Hospital / lugar de internamiento <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                <span className="sr-only">obligatorio</span>
              </label>
              <input ref={lugarRef} id="internamiento-lugar" type="text" value={lugar}
                onChange={e => setLugar(e.target.value)}
                placeholder="Ej: Hospital Ángeles Lomas"
                aria-invalid={senalar('lugar') || undefined}
                className={`sp-input ${senalar('lugar') ? 'sp-doc-invalid' : ''}`} />
            </div>
            {/* El rojo va al badge y no a la etiqueta: en rojo, la casilla
                competía con los errores del formulario. */}
            <div className="sp-doc-span-all">
              <label className="sp-check">
                <input id="internamiento-urgente" type="checkbox" className="sr-only"
                  checked={urgente} onChange={e => setUrgente(e.target.checked)} />
                <span className="sp-check__box"><Check aria-hidden="true" /></span>
                <span className="sp-check__label">Marcar como URGENTE</span>
                {urgente && <span className="sp-badge sp-badge--danger">URGENTE</span>}
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="sp-card sp-doc-card">
        <div className="sp-doc-cardhead">
          <h2 className="sp-label">Diagnósticos</h2>
          <button type="button" onClick={addDx} aria-label="Agregar diagnóstico secundario"
            className="sp-btn sp-btn--compact sp-doc-add">
            <Plus size={17} /><span className="sp-doc-long">Agregar</span>
          </button>
        </div>
        <div className="sp-doc-cardbody">
          <div className="sp-doc-field">
            <label htmlFor="internamiento-diagnostico" className="sp-label-field">
              Diagnóstico principal <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
              <span className="sr-only">obligatorio</span>
            </label>
            <input ref={diagnosticoRef} id="internamiento-diagnostico" type="text" value={diagnostico}
              onChange={e => setDiagnostico(e.target.value)}
              placeholder="Diagnóstico principal de ingreso"
              aria-invalid={senalar('diagnostico') || undefined}
              className={`sp-input ${senalar('diagnostico') ? 'sp-doc-invalid' : ''}`} />
          </div>

          <p className="sp-label-field" style={{ margin: 'var(--sp-4) 0 var(--sp-gap-label)' }}>
            Diagnósticos secundarios
          </p>
          <div className={diagnosticosSecundarios.length >= 4 ? 'sp-doc-list--long' : undefined}>
            {diagnosticosSecundarios.map((d, i) => (
              <div key={i} className="sp-doc-listrow">
                {conNumeral && <span className="sp-label sp-doc-listnum">{i + 1}.</span>}
                <input id={`internamiento-secundario-${i}`} type="text" value={d}
                  onChange={e => updateDx(i, e.target.value)}
                  aria-label={`Diagnóstico secundario ${i + 1}`}
                  placeholder={`Secundario ${i + 1}`}
                  style={{ flex: 1, minWidth: 0 }} className="sp-input" />
                <button type="button" onClick={() => removeDx(i)}
                  disabled={diagnosticosSecundarios.length === 1}
                  aria-label={d.trim() ? `Eliminar ${d.trim()}` : `Eliminar secundario ${i + 1}`}
                  className="sp-doc-iconbtn">
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sp-card sp-doc-card">
        <div className="sp-doc-cardhead">
          <h2 className="sp-label">Procedimiento</h2>
        </div>
        <div className="sp-doc-cardbody">
          <label htmlFor="internamiento-procedimiento" className="sr-only">Procedimiento / cirugía solicitada</label>
          <textarea id="internamiento-procedimiento" value={procedimiento}
            onChange={e => setProcedimiento(e.target.value)}
            placeholder="Ej: Artrodesis posterolateral L4-L5 con tornillos pediculares e injerto óseo autólogo…"
            className="sp-textarea" />
        </div>
      </section>

      <section className="sp-card sp-doc-card">
        <div className="sp-doc-cardhead">
          <h2 className="sp-label">Requerimientos especiales</h2>
        </div>
        <div className="sp-doc-cardbody">
          <div className="sp-doc-chips">
            {REQUERIMIENTOS.map(r => (
              <button key={r} type="button" onClick={() => toggleRequerimiento(r)}
                aria-pressed={requerimientos.includes(r)} className="sp-chip">
                {r}
              </button>
            ))}
          </div>
          <div className="sp-doc-field" style={{ marginTop: 'var(--sp-4)' }}>
            <label htmlFor="internamiento-requerimiento-otro" className="sp-label-field">Otro requerimiento</label>
            <input id="internamiento-requerimiento-otro" type="text" value={requerimientosExtra}
              onChange={e => setRequerimientosExtra(e.target.value)}
              placeholder="El que no esté en la lista" className="sp-input" />
          </div>
        </div>
      </section>

      <section className="sp-card sp-doc-card">
        <div className="sp-doc-cardhead">
          <h2 className="sp-label">Justificación clínica</h2>
        </div>
        <div className="sp-doc-cardbody">
          <label htmlFor="internamiento-justificacion" className="sr-only">Justificación clínica</label>
          <textarea id="internamiento-justificacion" value={justificacion}
            onChange={e => setJustificacion(e.target.value)}
            placeholder="Evolución del padecimiento, hallazgos, fracaso del tratamiento conservador…"
            className="sp-textarea" />
        </div>
      </section>

      {/* Las dos últimas y las más altas, y por eso nacen plegadas: 58px cada
          una en vez de las dos que estiraban el formulario antes de escribir
          nada. El resumen de la cabecera es lo que hace que plegar resuma. */}
      <SeccionPlegable
        id="internamiento-instrucciones"
        titulo="Instrucciones al paciente"
        resumen={instruccionesPaciente !== INSTRUCCIONES_DEFECTO ? 'Editada' : undefined}
      >
        <label htmlFor="internamiento-instrucciones-texto" className="sr-only">Instrucciones al paciente</label>
        <textarea id="internamiento-instrucciones-texto" value={instruccionesPaciente}
          onChange={e => setInstruccionesPaciente(e.target.value)}
          rows={8} className="sp-textarea" />
      </SeccionPlegable>

      <SeccionPlegable
        id="internamiento-piso"
        titulo="Indicaciones de ingreso a piso"
        resumen={resumenIndicaciones(gruposPiso, false)}
        resumenAbierta={resumenIndicaciones(gruposPiso, true)}
      >
        <IndicacionesPiso grupos={gruposPiso} onChange={setGruposPiso} />
      </SeccionPlegable>

      {errorGuardado && <p className="sp-banner sp-banner--danger">{errorGuardado}</p>}

      {!cargandoPerfil && !medicoInfo && (
        <p className="sp-banner sp-banner--warn">
          <AlertTriangle size={17} />
          <span style={{ flex: 1 }}>Completa tu perfil para que el documento salga con tu encabezado.</span>
          <Link href="/perfil" className="sp-link-alt">Ir a mi perfil</Link>
        </p>
      )}

      {intentado && faltantes.length > 0 && (
        <p className="sp-banner sp-banner--warn" aria-live="polite">
          <AlertTriangle size={17} />
          <span>
            {textoFaltantes().split(':')[0]}:{' '}
            {faltantes.slice(0, 3).map((f, i) => (
              <span key={f.clave}>
                {i > 0 && ' · '}
                <button type="button" onClick={() => irA(f.clave)}
                  className="sp-link-alt" style={{ color: 'var(--sp-warn-strong)' }}>
                  {f.nombre}
                </button>
              </span>
            ))}
            {faltantes.length > 3 && ` y ${faltantes.length - 3} más`}
          </span>
        </p>
      )}

      {/* «Guardar como plantilla» va aquí y no arriba: se guarda cuando el
          formulario YA está lleno, así que su sitio es junto al de imprimir. */}
      <div className="sp-doc-actions">
        {plantillas.botonGuardar}
        <button type="button" onClick={imprimir} disabled={imprimiendo || perfilPendiente}
          className="sp-btn sp-btn--primary">
          {imprimiendo ? <><span className="sp-spinner" /> Generando PDF…</>
            : perfilPendiente ? <><span className="sp-spinner" /> Cargando tu perfil…</>
            : <>
                <Printer size={17} />
                <span className="sp-doc-long">Imprimir solicitud de internamiento</span>
                <span className="sp-doc-short">Imprimir</span>
              </>}
        </button>
      </div>

      </div>

      {plantillas.panel}
      {plantillas.dialogos}

      <ModalDocumentoGenerado
        open={docGenerado !== null}
        onClose={() => setDocGenerado(null)}
        blob={docGenerado?.blob ?? null}
        titulo="Solicitud de internamiento generada"
        guardadoEnExpediente={docGenerado?.guardado ?? false}
        documentoId={docGenerado?.documentoId ?? null}
      />
    </div>
  )
}
