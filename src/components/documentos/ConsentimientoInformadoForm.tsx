'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { AlertTriangle, Check, EyeOff, Printer, ShieldCheck, ShieldOff } from 'lucide-react'
import { flushSync } from 'react-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { generateDocFileName } from '@/lib/patientUtils'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { generarPdf } from '@/lib/mobileShare'
import { useToast } from '@/components/ui/Toast'
import ModalDocumentoGenerado from '@/components/documentos/ModalDocumentoGenerado'
import SeccionPlegable from '@/components/documentos/SeccionPlegable'
import { usePlantillasDocumento, type ContenidoPlantilla } from '@/components/documentos/PlantillasDocumento'
import { createClient } from '@/lib/supabase/client'
import { hoyEnTZ, desplazarFecha } from '@/lib/dates'
import { enfocarYAcercar } from '@/lib/scrollDoc'

/**
 * Consentimiento informado — GUIA_FORM_CONSENTIMIENTO.md — y su contrario, la
 * denegación o revocación — GUIA_FORM_DENEGACION.md —.
 *
 * ── DOS DOCUMENTOS EXCLUYENTES EN UN FORMULARIO ─────────────────────────────
 * El conmutador de la cabecera elige cuál se emite, como el de recibo y
 * cotización en Honorarios. Comparten los datos de identificación; al elegir
 * denegación se pliegan las siete secciones clínicas y las dos autorizaciones,
 * que no aplican, y lo escrito en ellas se conserva y se declara al pie.
 *
 * La denegación SUSTITUYE al consentimiento, no se le anexa: si el paciente
 * deniega, no se imprimen las siete hojas que explican y otorgan lo que acaba
 * de rechazar. Por eso son dos `documentos.tipo` distintos y dos series de
 * folio —`CI-` y `DEN-`—, y por eso se retiró la casilla «Incluir hoja de
 * Denegación» que las imprimía juntas: además de duplicar la vía de denegar,
 * guardaba el rechazo como `consentimiento_informado` con folio `CI-`, así que
 * quien buscara «¿este paciente autorizó?» veía un consentimiento donde hubo
 * un rechazo.
 *
 * ── LO QUE ESTE PASE **NO** HACE ────────────────────────────────────────────
 * El flujo de firmado electrónico (GUIA_FORMULARIOS_05) es su propio paso: los
 * tres botones de la barra, el borrador, la captura de firmas y las fotos de
 * identificación. Aquí la barra sigue teniendo los dos de siempre —«Guardar
 * como plantilla» + imprimir—, así que «Guardar como plantilla» se queda en la
 * barra y NO sube a la card de plantilla: la excepción de §1.2 existe para no
 * dejar cuatro botones en una barra que hoy tiene dos. Sube cuando suba el
 * tercero.
 */

interface Props {
  pacienteInicial?: string
  pacienteId?: string
  diagnosticoInicial?: string
  /**
   * Edad de la ficha, ya redactada («45 años»). Se prellena y queda EDITABLE
   * (§5): si el paciente cumplió años entre la ficha y la consulta, corregirlo
   * aquí es más rápido que ir a la ficha y volver.
   */
  edadInicial?: string
  offlineMode?: boolean
  onOfflineSave?: () => void
  /** Reporta al host si el formulario sigue vacío (guía 04 §6.1 y §6.2). */
  onVacioChange?: (vacio: boolean) => void
  /**
   * El panel de plantillas sustituye al formulario en su mismo espacio, y
   * mientras está abierto el selector de tipo del host se oculta (spec 02 §3.1).
   */
  onPanelPlantillasChange?: (abierto: boolean) => void
}

const FECHA_MIN = '1900-01-01'

/** Cuál de los dos documentos excluyentes se está emitiendo. */
type TipoDoc = 'consentimiento' | 'denegacion'

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
type Secciones = Record<SeccionKey, string>

const SECCIONES_ORDEN = Object.keys(SECCIONES_DEFAULT) as SeccionKey[]

/**
 * Las dos que nacen vacías y bloquean la emisión. No es una decisión de este
 * pase: son la validación legal auditada del formato (NOM-004-SSA3-2012) y se
 * conserva entera. Lo que cambia es cómo se enseña —badge en la cabecera y
 * banner de faltantes, en vez de un toast al pulsar imprimir—.
 */
const SECCIONES_OBLIGATORIAS: readonly SeccionKey[] = ['descripcion', 'riesgosEspecificos']

const LABELS: Record<SeccionKey, { titulo: string; hint: string }> = {
  preoperatorio:      { titulo: '1 · Preoperatorio',                hint: 'Describe los estudios realizados, el diagnóstico y el procedimiento recomendado.' },
  beneficios:         { titulo: '2 · Beneficios esperados',          hint: 'Explica los objetivos y resultados esperados del procedimiento.' },
  anestesia:          { titulo: '3 · Anestesia',                     hint: 'Indica el tipo de anestesia prevista y quién informará al paciente.' },
  descripcion:        { titulo: '4 · Descripción del procedimiento', hint: 'Detalla la técnica quirúrgica, vía de abordaje e implantes a utilizar.' },
  riesgosComunes:     { titulo: '5 · Riesgos comunes',               hint: 'Riesgos inherentes a cualquier procedimiento quirúrgico.' },
  riesgosEspecificos: { titulo: '6 · Riesgos específicos',           hint: 'Riesgos propios de esta cirugía en particular.' },
  alternativas:       { titulo: '7 · Alternativas de tratamiento',   hint: 'Opciones disponibles en lugar del procedimiento propuesto.' },
}

interface EstadoVacio {
  paciente: string
  pacienteInicial: string
  edad: string
  edadInicial: string
  diagnostico: string
  diagnosticoInicial: string
  lugar: string
  procedimiento: string
  familiar: string
  testigo1: string
  testigo2: string
  autorizaTransfusion: 'si' | 'no' | null
  autorizaFotos: boolean
  secciones: Secciones
}

/**
 * Predicado único de «formulario vacío». Mismo criterio que los demás: lo que
 * llega solo no cuenta como escrito hasta que se edita. Aquí eso son cuatro
 * cosas —paciente, edad y diagnóstico de la ficha, y las cinco secciones que
 * nacen con texto por defecto—, y la fecha de hoy no entra por lo mismo.
 *
 * El tipo elegido tampoco entra, igual que en Honorarios: conmutar no es
 * escribir, y si contara, cambiar a denegación encendería el aviso de «se
 * perderá lo escrito» del selector de tipo del host con el formulario vacío.
 */
function isFormEmpty(e: EstadoVacio): boolean {
  const pacienteIntacto = e.paciente.trim() === '' || e.paciente.trim() === e.pacienteInicial.trim()
  const edadIntacta = e.edad.trim() === '' || e.edad.trim() === e.edadInicial.trim()
  const dxIntacto = e.diagnostico.trim() === '' || e.diagnostico.trim() === e.diagnosticoInicial.trim()
  const seccionesIntactas = SECCIONES_ORDEN.every(k => e.secciones[k] === SECCIONES_DEFAULT[k])
  return pacienteIntacto && edadIntacta && dxIntacto && seccionesIntactas
    && e.lugar.trim() === '' && e.procedimiento.trim() === ''
    && e.familiar.trim() === '' && e.testigo1.trim() === '' && e.testigo2.trim() === ''
    && e.autorizaTransfusion === null && !e.autorizaFotos
}

export default function ConsentimientoInformadoForm({
  pacienteInicial = '', pacienteId, diagnosticoInicial = '', edadInicial = '',
  offlineMode, onOfflineSave, onVacioChange, onPanelPlantillasChange,
}: Props) {
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

  // ── Identificación: once controles en cuatro filas (§2) ─────────────
  const [fecha, setFecha]                 = useState(hoyEnTZ())
  const [lugar, setLugar]                 = useState('')
  const [paciente, setPaciente]           = useState(pacienteInicial)
  const [edad, setEdad]                   = useState(edadInicial)
  const [diagnostico, setDiagnostico]     = useState(diagnosticoInicial)
  const [procedimiento, setProcedimiento] = useState('')
  // Campo FUSIONADO (§5): firma uno de los dos, nunca los dos.
  const [familiar, setFamiliar]           = useState('')
  const [testigo1, setTestigo1]           = useState('')
  const [testigo2, setTestigo2]           = useState('')
  const [autorizaTransfusion, setAutorizaTransfusion] = useState<'si' | 'no' | null>(null)
  const [autorizaFotos, setAutorizaFotos] = useState(false)

  const [secciones, setSecciones] = useState<Secciones>({ ...SECCIONES_DEFAULT })

  const [tipoDoc, setTipoDoc] = useState<TipoDoc>('consentimiento')
  const [imprimiendo, setImprimiendo] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [docGenerado, setDocGenerado] = useState<{ blob: Blob; guardado: boolean } | null>(null)
  // El banner de faltantes NO existe hasta el primer intento de imprimir: un
  // formulario recién abierto no acusa de nada. Después permanece y se
  // actualiza en vivo.
  const [intentado, setIntentado] = useState(false)

  const formRef = useRef<HTMLDivElement>(null)
  const fechaRef = useRef<HTMLInputElement>(null)
  const lugarRef = useRef<HTMLInputElement>(null)
  const pacienteRef = useRef<HTMLInputElement>(null)
  const edadRef = useRef<HTMLInputElement>(null)
  const diagnosticoRef = useRef<HTMLInputElement>(null)
  const procedimientoRef = useRef<HTMLInputElement>(null)
  const familiarRef = useRef<HTMLInputElement>(null)

  const esDenegacion = tipoDoc === 'denegacion'
  /** El `documentos.tipo` emitido. De él sale el prefijo del folio: CI o DEN. */
  const tipoTabla = esDenegacion ? 'denegacion_consentimiento' : 'consentimiento_informado'
  const nombreCorto = esDenegacion ? 'denegación' : 'consentimiento'

  const vacio = isFormEmpty({
    paciente, pacienteInicial, edad, edadInicial, diagnostico, diagnosticoInicial,
    lugar, procedimiento, familiar, testigo1, testigo2,
    autorizaTransfusion, autorizaFotos, secciones,
  })
  useEffect(() => { onVacioChange?.(vacio) }, [vacio, onVacioChange])

  // ── Plantillas (spec 02) ────────────────────────────────────────
  // Se guarda TODO menos los datos del paciente, y aquí eso deja fuera más de lo
  // habitual: además de paciente, edad, diagnóstico y fecha, quedan fuera el
  // familiar, los dos testigos y LAS DOS AUTORIZACIONES. Las autorizaciones no
  // se omiten por descuido ni por simetría: son decisiones del paciente (§2), y
  // una plantilla que llegue con «Sí autoriza transfusión» marcado afirmaría en
  // un documento legal algo que el paciente no dijo.
  //
  // Consecuencia buscada: ni aplicar una plantilla ni «Vaciar formulario» tocan
  // ninguno de esos siete. Es exactamente lo que promete el aviso del selector
  // —«los datos del paciente no cambiaron»—, y hace que Deshacer los devuelva
  // intactos porque nunca se movieron.
  const plantillas = usePlantillasDocumento({
    tipo: 'consentimiento_informado',
    vacio,
    // El búnker no tiene red ni sesión de Supabase: el sistema no se monta.
    desactivado: !!offlineMode,
    onPanelChange: onPanelPlantillasChange,
    // El tipo elegido NO viaja en la plantilla, al revés que en Honorarios: allí
    // una plantilla de cotización lo es entera —vigencia y orígenes incluidos—,
    // y aquí las dos comparten lo único plantillable, que son lugar,
    // procedimiento y las secciones. Una «plantilla de denegación» sería la
    // misma plantilla con las secciones sin usar, así que el tipo se queda como
    // lo que es: la decisión de qué documento estoy emitiendo ahora.
    leer: () => ({
      _v: 1, lugar, procedimiento,
      secciones: { ...secciones },
    }),
    aplicar: (c: ContenidoPlantilla) => {
      // Solo las claves que existen HOY en el formulario, y comprobando el tipo
      // de cada una: el jsonb pudo guardarse con otra versión del formulario.
      // Los `else` NO son defensa de sobra: «Vaciar formulario» aplica un
      // contenido sin ninguna clave, así que es justo lo que repone el estado
      // inicial.
      setLugar(typeof c.lugar === 'string' ? c.lugar : '')
      setProcedimiento(typeof c.procedimiento === 'string' ? c.procedimiento : '')
      // Las plantillas guardadas antes de este pase traen `imprimirDenegacion`.
      // La clave se ignora y no rompe nada: la casilla que la escribía ya no
      // existe, y la denegación es ahora un documento propio.
      setSecciones(leerSecciones(c.secciones))
    },
  })

  // G-10: foco al primer campo editable vacío al montar. preventScroll para no
  // arrastrar la página hasta él. En móvil esto abre el teclado en cada montaje.
  useEffect(() => {
    const primero = formRef.current?.querySelector<HTMLElement>('input:not([type="date"]), textarea')
    if (primero instanceof HTMLInputElement && !primero.value) primero.focus({ preventScroll: true })
  }, [])

  function updateSeccion(key: SeccionKey, val: string): void {
    setSecciones(s => ({ ...s, [key]: val }))
  }

  // ── Validación (§3.8) ───────────────────────────────────────────
  // Los NUEVE obligatorios auditados del formato, en el orden de lectura del
  // formulario. Ninguno de los cinco campos retirados en este pase era uno de
  // ellos, así que la validación legal sale intacta: lo único que cambia es el
  // nombre del fusionado en el banner (§4 y §8).
  //
  // La denegación exige SEIS de los nueve. Suelta las dos secciones clínicas
  // obligatorias, que ni se muestran, y el diagnóstico. Ninguno de los tres se
  // suelta por no salir impreso —el diagnóstico SÍ sale, dentro de la
  // declaración (GUIA_FORM_DENEGACION §5)— sino porque exigirlos bloquearía la
  // emisión de un rechazo por no haber redactado antes lo que el paciente
  // acaba de rechazar. Cuando falta, la declaración se compone sin su inciso.
  // El familiar SÍ sigue exigido: firma el documento en las dos variantes (§8).
  const faltantes: { clave: string; nombre: string }[] = []
  if (!fecha) faltantes.push({ clave: 'fecha', nombre: 'Fecha' })
  if (!lugar.trim()) faltantes.push({ clave: 'lugar', nombre: 'Lugar' })
  if (!paciente.trim()) faltantes.push({ clave: 'paciente', nombre: 'Paciente' })
  if (!edad.trim()) faltantes.push({ clave: 'edad', nombre: 'Edad del paciente' })
  if (!esDenegacion && !diagnostico.trim()) faltantes.push({ clave: 'diagnostico', nombre: 'Diagnóstico' })
  if (!procedimiento.trim()) faltantes.push({ clave: 'procedimiento', nombre: 'Procedimiento' })
  if (!familiar.trim()) {
    faltantes.push({ clave: 'familiar', nombre: 'Familiar responsable o representante legal' })
  }
  if (!esDenegacion) {
    for (const k of SECCIONES_OBLIGATORIAS) {
      if (!secciones[k].trim()) faltantes.push({ clave: `seccion-${k}`, nombre: LABELS[k].titulo.slice(4) })
    }
  }

  // ── Franja de lo conservado ─────────────────────────────────────
  // Conmutar no borra nada: lo que la denegación no lleva deja de mostrarse y
  // de imprimirse, pero sigue escrito y se declara aquí con su valor. Solo
  // entran valores ESCRITOS —un prellenado no es algo que el médico
  // escribiera—, y por eso las secciones cuentan las EDITADAS y no las siete.
  const conservado: string[] = []
  if (esDenegacion) {
    const editadas = SECCIONES_ORDEN.filter(k => secciones[k] !== SECCIONES_DEFAULT[k]).length
    if (editadas > 0) {
      conservado.push(editadas === 1 ? '1 sección clínica editada' : `${editadas} secciones clínicas editadas`)
    }
    if (autorizaTransfusion !== null) {
      conservado.push(`transfusión (${autorizaTransfusion === 'si' ? 'Sí' : 'No'})`)
    }
    if (autorizaFotos) conservado.push('uso de fotografías (autorizado)')
    const testigos = [testigo1.trim(), testigo2.trim()].filter(t => t !== '')
    if (testigos.length > 0) conservado.push(`testigos (${testigos.join(', ')})`)
    // El diagnóstico NO entra aquí: sale impreso, dentro de la declaración.
  }

  function textoFaltantes(): string {
    const n = faltantes.length
    return n === 1 ? 'Falta 1 campo' : `Faltan ${n} campos`
  }

  function irA(clave: string): void {
    // Una sección obligatoria puede estar plegada, y entonces su textarea no
    // está en el árbol: el destino es su cabecera, que sí lo está siempre y es
    // pulsable. `SeccionPlegable` publica ese id como parte de su contrato.
    if (clave.startsWith('seccion-')) {
      enfocarYAcercar(document.getElementById(`consentimiento-${clave.slice(8)}-cabecera`))
      return
    }
    const destinos: Record<string, RefObject<HTMLInputElement | null>> = {
      fecha: fechaRef, lugar: lugarRef, paciente: pacienteRef, edad: edadRef,
      diagnostico: diagnosticoRef, procedimiento: procedimientoRef, familiar: familiarRef,
    }
    enfocarYAcercar(destinos[clave]?.current ?? null)
  }

  async function imprimir(): Promise<void> {
    // El primario nunca está gris por faltantes: un botón apagado no enseña qué
    // falta, el banner sí. Al pulsar con faltantes no emite y lleva al primero.
    if (faltantes.length > 0) {
      setIntentado(true)
      irA(faltantes[0].clave)
      return
    }

    flushSync(() => { setErrorGuardado(''); setImprimiendo(true) })

    // 1. Feedback instantáneo
    toast.info(esDenegacion ? 'Generando denegación…' : 'Generando consentimiento informado...')

    // 2. Identidad — UUID v4 puro como clientId
    const clientId = crypto.randomUUID()

    // 3. Contenido persistido — el documento EMITIDO, no el estado del
    //    formulario. Lo que la denegación no lleva se conserva en pantalla y se
    //    declara en la franja, pero no viaja a la fila: allí significaría que
    //    este papel lo lleva, y no lo lleva.
    //    El FOLIO no está aquí: lo asigna la base en el trigger BEFORE INSERT,
    //    con prefijo CI o DEN según este mismo `tipo` de la tabla.
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const contenido: Record<string, unknown> = esDenegacion
      // El diagnóstico entra: no está en el riel, pero SÍ en la declaración
      // (§5), así que es parte del documento emitido y se guarda como tal.
      ? { paciente, lugar, fecha, edad, procedimiento, diagnostico, familiar, timezone }
      : {
        paciente, lugar, fecha, edad, procedimiento, diagnostico,
        familiar, testigo1, testigo2, autorizaTransfusion, autorizaFotos,
        secciones, timezone,
      }

    // Flags de tracking para diferenciar errores
    let pdfGenerated = false
    // El blob y el desenlace de la persistencia se leen en el finally para
    // montar el modal posterior a la generación. Ver ModalDocumentoGenerado.
    let pdfBlob: Blob | null = null
    let guardado = false

    try {
      // 4. PDF PRIMERO — si falla, abortamos antes de persistir.
      //    CRÍTICO en consentimiento: evita registros legales huérfanos
      //    en DB sin documento físico entregable al paciente.
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
      const fechaFmt = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })

      const consultorioData = consultorioActivo ? {
        nombre: consultorioActivo.nombre,
        direccion: consultorioActivo.direccion,
        telefono: consultorioActivo.telefono,
      } : undefined

      const { blob, storagePath } = await generarPdf({
        tipo: tipoTabla,
        pacienteId,
        medico: medicoData,
        data: esDenegacion
          ? { paciente, lugar, fecha: fechaFmt, edad, procedimiento, diagnostico, familiar }
          : {
            paciente, lugar, fecha: fechaFmt, edad,
            procedimiento, diagnostico, familiar,
            testigo1, testigo2, autorizaTransfusion, autorizaFotos,
            secciones,
          },
        logoUrl,
        filename: generateDocFileName(paciente, esDenegacion ? 'Denegacion_Consentimiento' : 'Consentimiento_Informado'),
        consultorio: consultorioData,
        // El búnker offline queda intacto: sigue entregando el PDF él mismo y
        // no monta el modal — onOfflineSave desmonta el formulario al guardar.
        entregar: !!offlineMode,
      })

      pdfGenerated = true
      pdfBlob = blob

      // 5. Persistencia
      if (offlineMode) {
        const { addDocument } = await import('@/lib/offline/db')
        const { getOfflineIdentity } = await import('@/lib/offline/identity')
        await addDocument({
          id: crypto.randomUUID(),
          temp_patient_id: pacienteId ?? 'unknown',
          tipo: tipoTabla,
          contenido,
          created_at: new Date().toISOString(),
          medico_id: getOfflineIdentity()?.userId ?? 'anonymous',
          _syncStatus: 'pending',
        })
        toast.success(esDenegacion
          ? 'Denegación guardada en bunker offline'
          : 'Consentimiento informado guardado en bunker offline')
        onOfflineSave?.()
      } else {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No autenticado')

        const insertPayload: Record<string, unknown> = {
          tipo: tipoTabla,
          contenido,
          client_id: clientId,
          pdf_url: storagePath,
          subido_por: user.id,
        }
        if (pacienteId) insertPayload.paciente_id = pacienteId

        const { error } = await supabase.from('documentos').insert(insertPayload)
        if (error) throw error

        // Sin storagePath la fila se inserta igual pero sin PDF en Storage:
        // mobileShare captura el error de subida y no lo relanza. El documento
        // no queda recuperable desde la lista y el modal tiene que decirlo.
        guardado = storagePath !== null
        toast.success(esDenegacion ? 'Denegación guardada' : 'Consentimiento guardado')
      }
    } catch (err) {
      if (!pdfGenerated) {
        toast.error('No se pudo generar el PDF. Intenta de nuevo.')
        setErrorGuardado('No se pudo generar el PDF. Intenta de nuevo.')
      } else {
        // Enteras y no compuestas por piezas: el género del artículo no se
        // resuelve concatenando `nombreCorto`, que es masculino en uno de los
        // dos. Mismo criterio que la franja de Honorarios.
        toast.error(esDenegacion
          ? 'La denegación se generó pero no se pudo guardar. Revisa errores de sincronización.'
          : 'El consentimiento se generó pero no se pudo guardar. Revisa errores de sincronización.')
        setErrorGuardado(esDenegacion
          ? 'Error al guardar la denegación.'
          : 'Error al guardar el consentimiento.')
      }
      // eslint-disable-next-line no-console
      console.error('[ConsentimientoInformadoForm] imprimir falló:', err)
    } finally {
      setImprimiendo(false)
      // También cuando la persistencia falló: el PDF existe y con el paciente
      // enfrente lo urgente es poder imprimirlo.
      if (pdfBlob && !offlineMode) setDocGenerado({ blob: pdfBlob, guardado })
    }
  }

  const senalar = (clave: string) => intentado && faltantes.some(f => f.clave === clave)
  const maxFecha = desplazarFecha(hoyEnTZ(), { anios: 1 })

  return (
    <div ref={formRef} className="sp-doc-form">
      {/* El árbol del formulario NO se desmonta cuando el panel de plantillas
          está abierto: se apaga con display:none y el panel se monta como
          hermano, en el mismo contenedor de scroll (spec 02 §3.1). */}
      <div className="sp-doc-formbody" style={plantillas.panelAbierto ? { display: 'none' } : undefined}>

      {plantillas.selector}

      <section className="sp-card sp-doc-card">
        {/* El segmentado vive en la cabecera de la primera card, como en
            Honorarios: una card entera para dos botones sería una card de más,
            y el orden de las cards no cambia al conmutar. */}
        <div className="sp-doc-cardhead sp-doc-consent-head">
          {/* El escudo sigue al tipo: un escudo con paloma junto al rótulo
              «Denegación» afirmaría lo contrario del documento. */}
          <div className="sp-icobox sp-icobox--sm">{esDenegacion ? <ShieldOff /> : <ShieldCheck />}</div>
          <h2 className="sp-label">Datos de identificación</h2>
          <div className="sp-doc-segmented sp-doc-segmented--tipo" role="group" aria-label="Tipo de documento">
            {([
              { key: 'consentimiento', label: 'Consentimiento' },
              { key: 'denegacion', label: 'Denegación' },
            ] as { key: TipoDoc; label: string }[]).map(({ key, label }) => (
              <button key={key} type="button" aria-pressed={tipoDoc === key}
                onClick={() => setTipoDoc(key)} className="sp-doc-segmented__opt">
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="sp-doc-cardbody">
          <div className="sp-doc-grid sp-doc-consent-id" data-cols="3">

            {/* Fila 1 — Fecha · Lugar · Paciente */}
            <div className="sp-doc-field">
              <label htmlFor="consentimiento-fecha" className="sp-label-field">
                Fecha <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                <span className="sr-only">obligatorio</span>
              </label>
              <input ref={fechaRef} id="consentimiento-fecha" type="date" value={fecha}
                min={FECHA_MIN} max={maxFecha}
                onChange={e => setFecha(e.target.value)}
                aria-invalid={senalar('fecha') || undefined}
                className={`sp-input ${senalar('fecha') ? 'sp-doc-invalid' : ''}`} />
            </div>
            {/* Sin cambio (§5): lo escribe el médico cada vez, no viene del
                consultorio. Lo que sí hace es entrar en la plantilla. */}
            <div className="sp-doc-field">
              <label htmlFor="consentimiento-lugar" className="sp-label-field">
                Lugar <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                <span className="sr-only">obligatorio</span>
              </label>
              <input ref={lugarRef} id="consentimiento-lugar" type="text" value={lugar}
                onChange={e => setLugar(e.target.value)} placeholder="Ej: Monterrey, N.L."
                aria-invalid={senalar('lugar') || undefined}
                className={`sp-input ${senalar('lugar') ? 'sp-doc-invalid' : ''}`} />
            </div>
            <div className="sp-doc-field">
              <label htmlFor="consentimiento-paciente" className="sp-label-field">
                Paciente <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                <span className="sr-only">obligatorio</span>
              </label>
              <input ref={pacienteRef} id="consentimiento-paciente" type="text" value={paciente}
                onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo"
                aria-invalid={senalar('paciente') || undefined}
                className={`sp-input ${senalar('paciente') ? 'sp-doc-invalid' : ''}`} />
              {pacienteInicial && <p className="sp-hint">De la ficha · editable</p>}
            </div>

            {/* Fila 2 — Edad · Diagnóstico · Procedimiento */}
            <div className="sp-doc-field">
              <label htmlFor="consentimiento-edad" className="sp-label-field">
                Edad del paciente <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                <span className="sr-only">obligatorio</span>
              </label>
              <input ref={edadRef} id="consentimiento-edad" type="text" value={edad}
                onChange={e => setEdad(e.target.value)} placeholder="Ej: 45 años"
                aria-invalid={senalar('edad') || undefined}
                className={`sp-input ${senalar('edad') ? 'sp-doc-invalid' : ''}`} />
              {edadInicial && <p className="sp-hint">De la ficha · editable</p>}
            </div>
            <div className="sp-doc-field">
              {/* El asterisco sigue a la validación: la denegación no exige
                  diagnóstico porque su hoja no lo lleva. Un campo marcado como
                  obligatorio que no bloquea nada enseña una regla falsa. */}
              <label htmlFor="consentimiento-diagnostico" className="sp-label-field">
                Diagnóstico
                {!esDenegacion && <>
                  {' '}<span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                  <span className="sr-only">obligatorio</span>
                </>}
              </label>
              <input ref={diagnosticoRef} id="consentimiento-diagnostico" type="text" value={diagnostico}
                onChange={e => setDiagnostico(e.target.value)} placeholder="Diagnóstico principal"
                aria-invalid={senalar('diagnostico') || undefined}
                className={`sp-input ${senalar('diagnostico') ? 'sp-doc-invalid' : ''}`} />
              {diagnosticoInicial && <p className="sp-hint">Del diagnóstico de la consulta</p>}
            </div>
            <div className="sp-doc-field">
              <label htmlFor="consentimiento-procedimiento" className="sp-label-field">
                Procedimiento <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                <span className="sr-only">obligatorio</span>
              </label>
              <input ref={procedimientoRef} id="consentimiento-procedimiento" type="text" value={procedimiento}
                onChange={e => setProcedimiento(e.target.value)}
                placeholder="Ej: Artrodesis cervical anterior"
                aria-invalid={senalar('procedimiento') || undefined}
                className={`sp-input ${senalar('procedimiento') ? 'sp-doc-invalid' : ''}`} />
            </div>

            {/* Fila 3 — el campo fusionado · Testigo 1 · Testigo 2 */}
            <div className="sp-doc-field">
              <label htmlFor="consentimiento-familiar" className="sp-label-field">
                Familiar responsable o representante legal{' '}
                <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                <span className="sr-only">obligatorio</span>
              </label>
              <input ref={familiarRef} id="consentimiento-familiar" type="text" value={familiar}
                onChange={e => setFamiliar(e.target.value)} placeholder="Nombre completo"
                aria-invalid={senalar('familiar') || undefined}
                className={`sp-input ${senalar('familiar') ? 'sp-doc-invalid' : ''}`} />
            </div>
            <div className="sp-doc-field">
              <label htmlFor="consentimiento-testigo1" className="sp-label-field">Testigo 1</label>
              <input id="consentimiento-testigo1" type="text" value={testigo1}
                onChange={e => setTestigo1(e.target.value)} placeholder="Nombre del testigo"
                className="sp-input" />
            </div>
            <div className="sp-doc-field">
              <label htmlFor="consentimiento-testigo2" className="sp-label-field">Testigo 2</label>
              <input id="consentimiento-testigo2" type="text" value={testigo2}
                onChange={e => setTestigo2(e.target.value)} placeholder="Nombre del testigo"
                className="sp-input" />
            </div>

            {/* Fila 4 — bajo divisor: no son datos de identificación, son
                decisiones del paciente (§2). La denegación no las lleva: quien
                rechaza el procedimiento no autoriza nada dentro de él. */}
            {!esDenegacion && (
            <div className="sp-doc-consent-auth">
              <div className="sp-doc-field">
                <span className="sp-label-field" id="consentimiento-transfusion">
                  Autoriza transfusión de sangre
                </span>
                <div className="sp-doc-segmented sp-doc-segmented--field" role="group"
                  aria-labelledby="consentimiento-transfusion">
                  {(['si', 'no'] as const).map(v => (
                    <button key={v} type="button" aria-pressed={autorizaTransfusion === v}
                      onClick={() => setAutorizaTransfusion(v)} className="sp-doc-segmented__opt">
                      {v === 'si' ? 'Sí' : 'No'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sp-doc-field">
                <span className="sp-label-field">Uso de fotografías</span>
                {/* El `<label>` envuelve al control, así que el nombre accesible
                    de la casilla es su propio texto: el rótulo de arriba agrupa
                    la celda, no nombra la casilla. */}
                <label className="sp-check sp-doc-consent-fotos">
                  <input id="consentimiento-fotos" type="checkbox" className="sr-only"
                    checked={autorizaFotos} onChange={e => setAutorizaFotos(e.target.checked)} />
                  <span className="sp-check__box"><Check aria-hidden="true" /></span>
                  <span className="sp-check__label">
                    Autoriza su uso con fines educativos y de publicación académica
                  </span>
                </label>
              </div>
            </div>
            )}

          </div>
        </div>
      </section>

      {/* Las siete nacen PLEGADAS (§3): abiertas, el formulario mide ≈2.400px
          antes de escribir nada. El badge de la cabecera es lo que hace que
          plegar resuma en vez de esconder.
          En denegación no se muestran: son las hojas que explican y otorgan
          justo lo que el paciente rechaza. Lo escrito en ellas sigue en el
          estado —conmutar no borra— y se declara en la franja de abajo. */}
      {!esDenegacion && SECCIONES_ORDEN.map(key => (
        <SeccionPlegable
          key={key}
          id={`consentimiento-${key}`}
          titulo={LABELS[key].titulo}
          resumen={resumenSeccion(key, secciones[key])}
        >
          <p className="sp-hint" style={{ marginBottom: 'var(--sp-gap-label)' }}>{LABELS[key].hint}</p>
          <label htmlFor={`consentimiento-${key}-texto`} className="sr-only">{LABELS[key].titulo}</label>
          <textarea id={`consentimiento-${key}-texto`} value={secciones[key]}
            onChange={e => updateSeccion(key, e.target.value)}
            rows={6} className="sp-textarea" />
        </SeccionPlegable>
      ))}

      {/* Franja de lo conservado. Conmutar no borra nada: lo que la denegación
          no lleva deja de verse y de imprimirse, pero sigue escrito y se
          declara aquí con su valor, para que volver al consentimiento no sea
          un acto de fe. */}
      {conservado.length > 0 && (
        <p className="sp-banner sp-banner--info">
          <EyeOff size={17} />
          <span>
            Se conserva escrito, pero no sale en la denegación: {conservado.join(' · ')}.
          </span>
        </p>
      )}

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
            {textoFaltantes()}:{' '}
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
                <span className="sp-doc-long">Imprimir {nombreCorto}</span>
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
        titulo={esDenegacion ? 'Denegación generada' : 'Consentimiento generado'}
        guardadoEnExpediente={docGenerado?.guardado ?? false}
      />
    </div>
  )
}

/**
 * Badge de la cabecera plegada (§3). `Editada` cuando el texto difiere del
 * defecto y nada cuando está intacto —eso es la spec—, con una salvedad: las
 * dos que nacen vacías Y bloquean la emisión dicen `Obligatoria` mientras lo
 * estén. Sin ella, el único aviso de un campo obligatorio viviría dentro de una
 * card plegada, que es donde no se ve.
 */
function resumenSeccion(key: SeccionKey, valor: string): string | undefined {
  if (valor === SECCIONES_DEFAULT[key]) {
    return SECCIONES_OBLIGATORIAS.includes(key) ? 'Obligatoria' : undefined
  }
  return valor.trim() === '' && SECCIONES_OBLIGATORIAS.includes(key) ? 'Obligatoria' : 'Editada'
}

/**
 * Lee las siete secciones de una plantilla comprobando cada clave: el jsonb pudo
 * guardarse con otra versión del formulario. Lo que falte vuelve a su texto por
 * defecto, que es de lo que depende «Vaciar formulario».
 */
function leerSecciones(bruto: unknown): Secciones {
  const src = (bruto && typeof bruto === 'object') ? bruto as Record<string, unknown> : {}
  const out = { ...SECCIONES_DEFAULT }
  for (const k of SECCIONES_ORDEN) {
    const v = src[k]
    if (typeof v === 'string') out[k] = v
  }
  return out
}
