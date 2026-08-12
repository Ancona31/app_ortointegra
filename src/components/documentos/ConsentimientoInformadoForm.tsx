'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { AlertTriangle, Check, EyeOff, FileClock, PenLine, Printer, ShieldCheck, ShieldOff } from 'lucide-react'
import { flushSync } from 'react-dom'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { generateDocFileName } from '@/lib/patientUtils'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { generarPdf } from '@/lib/mobileShare'
import { useToast } from '@/components/ui/Toast'
import ModalShell from '@/components/ui/ModalShell'
import ModalDocumentoGenerado from '@/components/documentos/ModalDocumentoGenerado'
import SeccionPlegable from '@/components/documentos/SeccionPlegable'
import FirmadoConsentimiento, { type FirmaCapturada } from '@/components/documentos/FirmadoConsentimiento'
import type { IdentificacionImpresa } from '@/lib/pdf/ConsentimientoInformadoPdf'
import { huellaDocumento } from '@/lib/documentos/firmaTrazo'
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
 * ── EL BORRADOR, Y POR QUÉ LA FILA VA ANTES QUE EL PDF ──────────────────────
 * GUIA_FORMULARIOS_05 §0 y §9. El consentimiento es el único de los ocho que
 * cambia de estado en el tiempo: `borrador` → `emitido_firma_manual` (imprimir
 * sin firma) o → `firmado` (sellar con firmas, paso siguiente). Los dos
 * finales son TERMINALES; de ellos no se vuelve.
 *
 * El folio lo asigna la base al SALIR de borrador, así que **la fila se escribe
 * antes de renderizar el PDF, en las dos ramas** —la del borrador emitido y la
 * del consentimiento que se imprime de una—. Antes era al revés y el papel
 * salía sin folio: un número que no está impreso no sirve para que nadie te
 * cite el documento por teléfono.
 *
 * Precio de la inversión, aceptado: si el render falla, la fila ya existe y el
 * folio ya se consumió. No queda huérfana —aparece en la lista con su botón de
 * regenerar— y el mensaje de error lo dice con el folio delante.
 *
 * ⚠ Los otros SIETE formatos siguen generando el PDF antes de escribir la fila,
 * así que su papel sale sin folio. Se corrige en el cableado de v2, cuando se
 * toquen todos a la vez; aquí solo se arreglan los dos de este archivo.
 *
 * ── EL FIRMADO ELECTRÓNICO, Y EL ORDEN DE LAS TRES OPERACIONES ──────────────
 * GUIA_FORMULARIOS_05 §4 a §7. El primario abre `FirmadoConsentimiento`, que
 * reúne los cuatro desenlaces y devuelve las firmas capturadas. Sellar son tres
 * operaciones en un orden que NO es el intuitivo y que ninguna regla admite
 * cambiar (cabecera de `20260813_firmas_documento.sql`):
 *
 *   1. insertar las firmas
 *   2. UPDATE del documento a `firmado`, devolviendo el folio
 *   3. renderizar el PDF
 *
 * Las firmas van ANTES del sellado porque el guardián de la base solo admite
 * firmar un BORRADOR: si se sella primero, la firma que llegue después ve el
 * estado ya cambiado y se rechaza. Y el sellado va antes de renderizar porque
 * el folio lo asigna ese UPDATE.
 *
 * Las tres van con el cliente de SESIÓN del médico, nunca con privilegios de
 * servicio: el guardián exenta del gate de clínica a quien no trae JWT.
 *
 * ── LO QUE ESTE PASE **NO** HACE ────────────────────────────────────────────
 * Las fotos de identificación (spec 05 §6) son el paso siguiente. Por eso el
 * resumen del firmado dice `Firmó` a secas y no `Firmó · sin foto`.
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
  /**
   * Borrador que se retoma, desde `?borrador=` de la lista de documentos (§9).
   * Se carga en el MISMO formulario, editable: editar y firmar son la misma
   * tarea sin terminar, no dos pantallas.
   */
  borradorId?: string
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

/** La fila de `documentos` en estado `borrador`, con lo justo para retomarla. */
interface FilaBorrador {
  id: string
  contenido: Record<string, unknown> | null
  created_at: string
}

/**
 * Una fila de `public.firmas_documento`, tal como se inserta.
 *
 * `trazo` admite null SOLO en el médico —lo impone `firmas_documento_trazo_check`—
 * y por eso el tipo lo declara así: sin la unión, TypeScript infiere `string` del
 * primer elemento y la fila del médico no compilaría.
 *
 * `firmado_en_servidor` no está aquí a propósito: lo impone el trigger de la
 * base pase lo que pase, y mandarlo desde el cliente solo daría la ilusión de
 * que la hora del servidor la decide el cliente.
 */
interface FilaFirma {
  documento_id: string
  rol: 'medico' | 'paciente' | 'familiar' | 'testigo_1' | 'testigo_2'
  trazo: string | null
  firmado_en: string
  huella: string
  dispositivo: string
  /**
   * La ruta de la foto de identificación dentro del bucket cerrado, o `null` si
   * se siguió sin foto. La foto YA está subida cuando esta fila se escribe: la
   * fila es inmutable, así que insertarla primero y fallar la subida dejaría una
   * ruta muerta imposible de corregir. Lo dice la migración junto a
   * `firmas_documento_identificacion_check`.
   */
  identificacion_path: string | null
  creado_por: string
}

/** Lee una clave de texto del jsonb: pudo guardarse con otra versión del formulario. */
function texto(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** El rol de la firma, ya redactado como lo imprime la hoja de anexo. */
const TITULO_ROL: Record<FirmaCapturada['rol'], string> = {
  paciente: 'Paciente',
  familiar: 'Familiar o responsable',
  testigo_1: 'Testigo 1',
  testigo_2: 'Testigo 2',
}

/**
 * Trae una foto de identificación del bucket CERRADO para incrustarla en el PDF.
 *
 * El bucket deniega a todos los usuarios —también al médico que la subió—, así
 * que la única puerta es la ruta de servidor, que comprueba la propiedad del
 * documento y la saca con privilegios de servicio.
 *
 * ⚠ FALLA EN SILENCIO, A PROPÓSITO. Aquí el documento ya está SELLADO: el folio
 * está consumido y la fila es inmutable. Tumbar la generación del PDF porque una
 * foto no se pudo traer dejaría al médico sin papel por lo accesorio, cuando el
 * recuadro sabe componerse sin ella —lleva su leyenda de que no se capturó—.
 */
async function traerFoto(documentoId: string, ruta: string | null): Promise<string | undefined> {
  if (ruta === null) return undefined
  try {
    const res = await fetch(
      `/api/documentos/${documentoId}/identificacion?path=${encodeURIComponent(ruta)}`,
    )
    if (!res.ok) throw new Error(`GET ${res.status}`)
    const { dataUrl } = (await res.json()) as { dataUrl?: string }
    return dataUrl
  } catch (err) {
    console.error('[ConsentimientoInformadoForm] traerFoto falló:', err)
    return undefined
  }
}

const SECCIONES_DEFAULT = {
  preoperatorio: `Después de haberle realizado historia clínica y estudios diagnósticos pertinentes (análisis de laboratorio, estudios de imagen u otros según el caso), se ha establecido el diagnóstico descrito y, habiendo agotado otras alternativas de tratamiento, se le recomienda someterse al procedimiento indicado. Se le indicará el tiempo necesario de ayuno previo y las indicaciones previas correspondientes.`,

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
  // ⚠ LA CLAVE SIGUE SIENDO `preoperatorio` Y NO SE TOCA. Es la clave del jsonb
  // en `documentos.contenido.secciones` de todos los consentimientos ya
  // emitidos: renombrarla dejaría su sección 1 vacía al regenerar el PDF y
  // borraría el texto de los borradores al retomarlos. Lo que cambia es el
  // rótulo, que es lo único que se lee.
  preoperatorio:      { titulo: '1 · Evaluación y decisión terapéutica', hint: 'Describe los estudios realizados, el diagnóstico y el procedimiento recomendado.' },
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
  pacienteNoPuedeFirmar: boolean
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
    && e.autorizaTransfusion === null && !e.autorizaFotos && !e.pacienteNoPuedeFirmar
}

export default function ConsentimientoInformadoForm({
  pacienteInicial = '', pacienteId, diagnosticoInicial = '', edadInicial = '',
  borradorId: borradorIdInicial, offlineMode, onOfflineSave, onVacioChange,
  onPanelPlantillasChange,
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
  /**
   * ⚠ VIVE EN EL FORMULARIO Y NO EN LA CAPTURA, Y ESO ES LO QUE LA HACE ÚTIL.
   *
   * Marcarla convierte al familiar en quien consiente, así que su NOMBRE pasa a
   * ser exigible y su firma también. Reclamar ese nombre solo tiene sentido
   * ANTES de iniciar el firmado: descubrirlo en mitad del flujo dejaría al
   * médico rellenando la ficha con el paciente y el dispositivo delante, o
   * peor, con una firma ya capturada que habría que tirar al salir.
   *
   * Además es un hecho clínico que el médico conoce antes de entregar el
   * dispositivo —inconsciencia, minoría de edad, imposibilidad física—, no algo
   * que se averigüe al ver el lienzo.
   *
   * El modo de firmado la recibe como dato y no la vuelve a preguntar: dos
   * sitios donde declarar lo mismo es uno de más.
   */
  const [pacienteNoPuedeFirmar, setPacienteNoPuedeFirmar] = useState(false)

  const [secciones, setSecciones] = useState<Secciones>({ ...SECCIONES_DEFAULT })

  const [tipoDoc, setTipoDoc] = useState<TipoDoc>('consentimiento')
  const [imprimiendo, setImprimiendo] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [docGenerado, setDocGenerado] = useState<{ blob: Blob; guardado: boolean } | null>(null)
  // El banner de faltantes NO existe hasta el primer intento de imprimir: un
  // formulario recién abierto no acusa de nada. Después permanece y se
  // actualiza en vivo.
  const [intentado, setIntentado] = useState(false)

  // ── Borrador (§9) ───────────────────────────────────────────────
  // `borradorId` es la fila viva que se está editando; null mientras el
  // consentimiento no se haya guardado nunca. `borradorPrevio` es el borrador
  // propio que YA existía al abrir el formulario y todavía no se ha resuelto:
  // sobrevive a cerrar el diálogo para que guardar no cree un segundo.
  const [borradorId, setBorradorId] = useState<string | null>(null)
  const [borradorFecha, setBorradorFecha] = useState<string | null>(null)
  const [guardandoBorrador, setGuardandoBorrador] = useState(false)
  const [borradorPrevio, setBorradorPrevio] = useState<FilaBorrador | null>(null)
  const [dialogoPrevio, setDialogoPrevio] = useState(false)
  const [reemplazando, setReemplazando] = useState(false)

  // ── Firmado electrónico (spec 05) ───────────────────────────────
  // Mientras `firmando` no es null, el modo a pantalla completa está montado y
  // el formulario sigue vivo detrás con display:none. Lleva CONGELADO el
  // contenido que se acaba de escribir y su huella: a partir de ahí el
  // contenido no se vuelve a tocar —el sellado solo mueve `estado`—, que es lo
  // que sostiene que lo firmado sea lo guardado.
  const [firmando, setFirmando] = useState<
    { documentoId: string; huella: string; contenido: Record<string, unknown> } | null
  >(null)
  const [sellando, setSellando] = useState(false)
  const [errorSellado, setErrorSellado] = useState('')

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
    autorizaTransfusion, autorizaFotos, pacienteNoPuedeFirmar, secciones,
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

  // ── Borrador · carga (§9.2) ─────────────────────────────────────
  /**
   * Vuelca la fila en el formulario. Cada clave se comprueba por separado, como
   * en las plantillas: el jsonb pudo escribirse con otra versión del formulario
   * y lo que falte vuelve a su valor inicial, no a `undefined`.
   */
  const aplicarBorrador = useCallback((fila: FilaBorrador): void => {
    const c = fila.contenido ?? {}
    setFecha(texto(c.fecha) || hoyEnTZ())
    setLugar(texto(c.lugar))
    setPaciente(texto(c.paciente))
    setEdad(texto(c.edad))
    setDiagnostico(texto(c.diagnostico))
    setProcedimiento(texto(c.procedimiento))
    setFamiliar(texto(c.familiar))
    setTestigo1(texto(c.testigo1))
    setTestigo2(texto(c.testigo2))
    setAutorizaTransfusion(c.autorizaTransfusion === 'si' || c.autorizaTransfusion === 'no'
      ? c.autorizaTransfusion : null)
    setAutorizaFotos(c.autorizaFotos === true)
    setPacienteNoPuedeFirmar(c.pacienteNoPuedeFirmar === true)
    setSecciones(leerSecciones(c.secciones))
    setBorradorId(fila.id)
    setBorradorFecha(fila.created_at)
    setBorradorPrevio(null)
    setDialogoPrevio(false)
  }, [])

  /**
   * Al montar: o se retoma el borrador que pide la URL, o se comprueba si el
   * médico ya tiene uno propio de este paciente (§9.3).
   *
   * `subido_por = auth.uid()` es redundante con la policy de SELECT, que ya
   * esconde los ajenos, y va explícito de todos modos: el criterio de producto
   * —un borrador por paciente Y por médico— no debe depender de leerse en otro
   * archivo para entenderse aquí.
   *
   * El búnker offline no entra: no tiene sesión ni red.
   */
  useEffect(() => {
    if (offlineMode || !pacienteId) return
    let cancelado = false

    void (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelado) return

      let q = supabase
        .from('documentos')
        .select('id, contenido, created_at')
        .eq('paciente_id', pacienteId)
        .eq('tipo', 'consentimiento_informado')
        .eq('estado', 'borrador')
        .eq('subido_por', user.id)
      if (borradorIdInicial) q = q.eq('id', borradorIdInicial)

      const { data } = await q.order('created_at', { ascending: false }).limit(1)
      const fila = (data?.[0] ?? null) as FilaBorrador | null
      if (cancelado || !fila) return

      if (borradorIdInicial) {
        aplicarBorrador(fila)
      } else {
        setBorradorPrevio(fila)
        setDialogoPrevio(true)
      }
    })()

    return () => { cancelado = true }
  }, [offlineMode, pacienteId, borradorIdInicial, aplicarBorrador])

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
  // El familiar ya NO es obligatorio siempre: su nombre vacío es la forma de
  // decir que no hay familiar que firme, y entonces sale del flujo de firmado
  // igual que un testigo sin nombre. Una firma sin nombre no acredita a nadie.
  //
  // ⚠ SALVO SI EL PACIENTE NO PUEDE FIRMAR, que es la excepción que da sentido
  // a todo el flujo: ahí el familiar es QUIEN CONSIENTE, no un acompañante, así
  // que su nombre vuelve a ser exigible —y su firma también, porque sin nombre
  // no entra al flujo y sin él en el flujo el documento no lo consiente nadie—.
  //
  // En DENEGACIÓN se queda como estaba, exigido siempre: aquella hoja no pasa
  // por el flujo de firmado —se emite en el momento y se firma a mano—, así que
  // nada de lo de arriba le aplica, y su obligatoriedad era una decisión
  // auditada del formato (§8 de su guía). Aflojarla de rebote sería cambiar un
  // documento que nadie pidió tocar.
  if (!familiar.trim() && (esDenegacion || pacienteNoPuedeFirmar)) {
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

  /**
   * El contenido persistido del CONSENTIMIENTO — el mismo para el borrador y
   * para el emitido, porque son la misma fila en dos momentos. La denegación
   * arma el suyo en `imprimir`: lleva seis campos y ninguna sección.
   *
   * El FOLIO no está aquí: es columna propia y lo escribe la base.
   */
  function contenidoConsentimiento(): Record<string, unknown> {
    return {
      paciente, lugar, fecha, edad, procedimiento, diagnostico,
      familiar, testigo1, testigo2, autorizaTransfusion, autorizaFotos,
      // Entra en el contenido, y por tanto en la HUELLA: es lo que explica que
      // el papel no lleve firma del paciente, así que forma parte de lo que se
      // firmó y no puede quedar fuera de lo que la huella acredita.
      pacienteNoPuedeFirmar,
      secciones, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
  }

  // ── Borrador · guardar (§9) ─────────────────────────────────────
  /**
   * Guarda SIN emitir. La fila nace en `borrador` y por tanto SIN folio: lo
   * asigna la base al salir de ese estado, así que un borrador que nunca se
   * imprime no deja un hueco en la serie.
   *
   * Sin validación de faltantes a propósito: un borrador incompleto es
   * exactamente lo que este botón existe para permitir.
   */
  /**
   * Escribe el contenido en la fila del borrador —creándola si no existe— y
   * devuelve su id. Lanza si falla; el mensaje lo compone quien la llama.
   *
   * Recibe el contenido en vez de leerlo: el firmado necesita que lo que se
   * guarda y lo que se resume en la huella sean el MISMO objeto, no dos
   * lecturas del estado separadas por un `await`.
   */
  async function persistirBorrador(contenido: Record<string, unknown>): Promise<string> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No autenticado')

    if (borradorId) {
      // `.eq('estado','borrador')` + recuento de filas: la policy de UPDATE
      // exige `subido_por = auth.uid()`, así que tocar el borrador de otro
      // médico devuelve CERO filas y NINGÚN error.
      const { data, error } = await supabase
        .from('documentos')
        .update({ contenido })
        .eq('id', borradorId)
        .eq('estado', 'borrador')
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('SIN_FILAS')
      return borradorId
    }

    const { data, error } = await supabase
      .from('documentos')
      .insert({
        tipo: 'consentimiento_informado',
        estado: 'borrador',
        contenido,
        client_id: crypto.randomUUID(),
        paciente_id: pacienteId,
        subido_por: user.id,
      })
      .select('id, created_at')
      .single()
    if (error) throw error
    setBorradorId(data.id)
    setBorradorFecha(data.created_at)
    return data.id
  }

  async function guardarBorrador(): Promise<void> {
    if (guardandoBorrador || imprimiendo) return
    // Guardar sin resolver el que ya había crearía el segundo borrador que la
    // regla prohíbe. Cerrar el diálogo no es responderlo.
    if (!borradorId && borradorPrevio) { setDialogoPrevio(true); return }

    setErrorGuardado('')
    setGuardandoBorrador(true)
    try {
      await persistirBorrador(contenidoConsentimiento())
      toast.success('Borrador guardado. No se ha emitido nada todavía.')
    } catch (err) {
      const msg = err instanceof Error && err.message === 'SIN_FILAS'
        ? 'No se pudo guardar el borrador: no es tuyo o ya se emitió.'
        : 'No se pudo guardar el borrador. Revisa tu conexión e intenta de nuevo.'
      toast.error(msg)
      setErrorGuardado(msg)
      console.error('[ConsentimientoInformadoForm] guardarBorrador falló:', err)
    } finally {
      setGuardandoBorrador(false)
    }
  }

  /**
   * Abre el modo de firmado (spec 05 §2). Antes GUARDA, y no por comodidad: las
   * firmas cuelgan de un `documento_id` que tiene que existir y estar en
   * `borrador`, y la huella se calcula sobre el contenido que se acaba de
   * escribir. Sin ese guardado, la huella acreditaría un texto que no está en
   * ninguna parte.
   *
   * Exige el formulario completo, al contrario que «Guardar borrador»: firmar
   * es el paso previo a emitir, y no se le pide a un paciente que firme un
   * documento al que le faltan campos.
   */
  async function iniciarFirmado(): Promise<void> {
    if (guardandoBorrador || imprimiendo || firmando) return
    if (faltantes.length > 0) {
      setIntentado(true)
      irA(faltantes[0].clave)
      return
    }
    if (!borradorId && borradorPrevio) { setDialogoPrevio(true); return }

    setErrorGuardado('')
    setErrorSellado('')
    setGuardandoBorrador(true)
    try {
      const contenido = contenidoConsentimiento()
      const documentoId = await persistirBorrador(contenido)
      setFirmando({ documentoId, huella: await huellaDocumento(contenido), contenido })
    } catch (err) {
      const causa = err instanceof Error ? err.message : ''
      const msg = causa === 'SIN_FILAS'
        ? 'No se pudo abrir el firmado: el borrador no es tuyo o ya se emitió.'
        : causa === 'SIN_CRYPTO_SUBTLE'
        ? 'Este navegador no puede calcular la huella del documento porque la página no se '
          + 'abrió por HTTPS. Ábrela por HTTPS o desde localhost para firmar.'
        : 'No se pudo abrir el firmado. Revisa tu conexión e intenta de nuevo.'
      toast.error(msg)
      setErrorGuardado(msg)
      console.error('[ConsentimientoInformadoForm] iniciarFirmado falló:', err)
    } finally {
      setGuardandoBorrador(false)
    }
  }

  /** Reemplaza el borrador previo por uno nuevo: se borra y el formulario sigue en blanco. */
  async function reemplazarBorrador(): Promise<void> {
    if (!borradorPrevio || reemplazando) return
    setReemplazando(true)
    try {
      const res = await fetch(`/api/documentos/${borradorPrevio.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`DELETE ${res.status}`)
      setBorradorPrevio(null)
      setDialogoPrevio(false)
      toast.success('Borrador anterior eliminado')
    } catch (err) {
      toast.error('No se pudo eliminar el borrador anterior. Intenta de nuevo.')
      console.error('[ConsentimientoInformadoForm] reemplazarBorrador falló:', err)
    } finally {
      setReemplazando(false)
    }
  }

  /**
   * Los datos de impresión que comparten el consentimiento sellado y el que se
   * imprime sin firma. Se lee dos veces en este archivo y en ningún otro sitio.
   */
  function datosDePapel() {
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
    return {
      medicoData,
      logoUrl: medicoInfo?.logo_url?.startsWith('https://') ? medicoInfo.logo_url : undefined,
      consultorio: consultorioActivo ? {
        nombre: consultorioActivo.nombre,
        direccion: consultorioActivo.direccion,
        telefono: consultorioActivo.telefono,
      } : undefined,
      fechaFmt: format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es }),
    }
  }

  /**
   * Las TRES OPERACIONES DEL SELLADO, en el único orden que las reglas admiten.
   * Ver la cabecera del archivo: firmas → sellado → PDF, y ninguna de las dos
   * precedencias es de estilo.
   */
  async function sellar(firmas: FirmaCapturada[], previstos: number): Promise<void> {
    if (!firmando || sellando) return
    setSellando(true)
    setErrorSellado('')

    let pdfBlob: Blob | null = null
    let folio: string | null = null
    let selladoOk = false

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const selladoEn = new Date().toISOString()
      const dispositivo = navigator.userAgent.slice(0, 500)

      // ── 1 · LAS FIRMAS, ANTES DEL SELLADO ────────────────────────────
      //    El guardián de la base solo admite firmar un BORRADOR: si el
      //    documento se sellara primero, estas filas verían el estado ya
      //    cambiado y se rechazarían.
      //
      //    Un solo INSERT con todas: PostgREST lo manda como una sentencia, así
      //    que o entran las cinco o no entra ninguna. Cinco llamadas dejarían
      //    documentos con la mitad de sus firmas y sin forma de completarlas,
      //    porque una firma no se edita.
      const filas: FilaFirma[] = firmas.map(f => ({
        documento_id: firmando.documentoId,
        rol: f.rol,
        trazo: f.trazo,
        firmado_en: f.firmadoEn,
        huella: firmando.huella,
        dispositivo,
        identificacion_path: f.identificacionPath,
        creado_por: user.id,
      }))
      // El médico no firma en el flujo —su rúbrica sale del perfil— pero SÍ se
      // registra, con la hora del sellado, que es el acto que reúne las demás.
      filas.push({
        documento_id: firmando.documentoId,
        rol: 'medico',
        trazo: null,
        firmado_en: selladoEn,
        huella: firmando.huella,
        dispositivo,
        // El anexo reproduce la identificación de quien CONSIENTE, no la de
        // quien informa: al médico no se le pregunta y no tiene ruta.
        identificacion_path: null,
        creado_por: user.id,
      })
      const { error: errFirmas } = await supabase.from('firmas_documento').insert(filas)
      if (errFirmas) throw errFirmas

      // ── 2 · EL SELLADO, que es lo que asigna el folio ────────────────
      //    Solo `estado`. El contenido NO se toca: la huella de las firmas se
      //    calculó sobre lo que hay guardado, y reescribirlo aquí la invalidaría
      //    en el mismo acto que la registra.
      const { data, error } = await supabase
        .from('documentos')
        .update({ estado: 'firmado' })
        .eq('id', firmando.documentoId)
        .eq('estado', 'borrador')
        .select('id, folio')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('SELLADO_SIN_FILAS')
      folio = data[0].folio
      selladoOk = true

      // ── 3 · EL PDF, ya con el folio, las rúbricas y los sellos ───────
      //    Antes, las fotos: el PDF se compone en el NAVEGADOR y las lleva
      //    DENTRO, incrustadas, así que reimprimir dentro de un año no depende
      //    de que la foto siga existiendo. Una fila por firmante que firmó,
      //    tenga foto o no: el recuadro sin ella lleva su leyenda.
      const nombresPorRol: Record<FirmaCapturada['rol'], string> = {
        paciente, familiar, testigo_1: testigo1, testigo_2: testigo2,
      }
      const identificaciones: IdentificacionImpresa[] = await Promise.all(
        firmas.map(async f => ({
          rol: TITULO_ROL[f.rol],
          nombre: nombresPorRol[f.rol].trim() || TITULO_ROL[f.rol],
          foto: await traerFoto(firmando.documentoId, f.identificacionPath),
        })),
      )

      const papel = datosDePapel()
      const { blob, storagePath } = await generarPdf({
        tipo: 'consentimiento_informado',
        pacienteId,
        medico: papel.medicoData,
        // El contenido CONGELADO, no una lectura nueva del estado: lo que se
        // imprime tiene que ser lo mismo que se guardó y lo mismo que resume la
        // huella. Solo la fecha se recompone, porque el papel la lleva
        // redactada y la fila la guarda en ISO.
        data: {
          ...firmando.contenido,
          fecha: papel.fechaFmt,
          folio: folio ?? undefined,
          firmas: [
            ...firmas.map(f => ({ rol: f.rol, trazo: f.trazo, firmadoEn: f.firmadoEn })),
            { rol: 'medico', trazo: null, firmadoEn: selladoEn },
          ],
          selladoEn,
          huella: firmando.huella,
          // Cuántos firmantes PIDIÓ el flujo, que ya no son cuatro fijos: solo
          // entran los que tenían nombre. No se puede deducir de las firmas
          // capturadas, así que viaja desde el modo hasta el papel.
          previstos,
          // La hoja de anexo solo se imprime si al menos una trae fotografía.
          identificaciones,
        },
        logoUrl: papel.logoUrl,
        filename: generateDocFileName(paciente, 'Consentimiento_Informado'),
        consultorio: papel.consultorio,
        entregar: false,
      })
      pdfBlob = blob

      if (storagePath) {
        // No toca ni el estado ni el folio, así que el trigger lo deja pasar.
        const { error: errPdf } = await supabase
          .from('documentos')
          .update({ pdf_url: storagePath })
          .eq('id', firmando.documentoId)
        if (errPdf) console.error('[ConsentimientoInformadoForm] update pdf_url:', errPdf.message)
      }

      setFirmando(null)
      setBorradorId(null)
      setBorradorFecha(null)
      toast.success(folio ? `Consentimiento sellado · ${folio}` : 'Consentimiento sellado')
    } catch (err) {
      const sinFilas = err instanceof Error && err.message === 'SELLADO_SIN_FILAS'
      // 23514 es `check_violation`. En esta tabla el único CHECK que puede
      // fallar con datos bien formados es el del reloj: el techo de
      // `firmado_en` es `firmado_en_servidor + 1 día`, así que un dispositivo
      // con la fecha adelantada tumba el INSERT entero. Decirlo con esas
      // palabras ahorra buscarlo en el lado equivocado.
      const relojAdelantado = !selladoOk
        && typeof err === 'object' && err !== null && 'code' in err
        && (err as { code?: unknown }).code === '23514'
      let msg: string
      if (sinFilas) {
        msg = 'No se pudo sellar: el borrador no es tuyo o ya se había emitido.'
      } else if (relojAdelantado) {
        msg = 'La base rechazó las firmas: la fecha y hora de este dispositivo están adelantadas. '
          + 'Corrígelas y vuelve a firmar.'
      } else if (!selladoOk) {
        msg = 'No se pudieron guardar las firmas, así que el documento no se selló. Intenta de nuevo.'
      } else {
        // El caso incómodo: el documento ya es terminal y el folio ya se
        // consumió. Cerrar el modo es lo correcto —no hay nada más que firmar—
        // y el mensaje lleva el número delante para poder encontrarlo.
        msg = `El consentimiento quedó sellado${folio ? ` con folio ${folio}` : ''}, pero no se pudo `
          + 'generar el PDF. Búscalo en la lista de documentos del paciente y recupéralo desde ahí.'
      }
      toast.error(msg)
      if (selladoOk) {
        setErrorGuardado(msg)
        setFirmando(null)
        setBorradorId(null)
        setBorradorFecha(null)
      } else {
        setErrorSellado(msg)
      }
      console.error('[ConsentimientoInformadoForm] sellar falló:', err)
    } finally {
      setSellando(false)
      if (pdfBlob) setDocGenerado({ blob: pdfBlob, guardado: true })
    }
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
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const contenido: Record<string, unknown> = esDenegacion
      // El diagnóstico entra: no está en el riel, pero SÍ en la declaración
      // (§5), así que es parte del documento emitido y se guarda como tal.
      ? { paciente, lugar, fecha, edad, procedimiento, diagnostico, familiar, timezone }
      : contenidoConsentimiento()

    // El borrador cargado se emite solo si lo que se imprime es un
    // CONSENTIMIENTO. La denegación no tiene borrador —se emite en el momento,
    // no se prepara con calma—, así que conmutar a denegación con un borrador
    // abierto emite una fila nueva y deja el borrador donde estaba.
    const idBorrador = esDenegacion ? null : borradorId

    // El blob y el desenlace de la persistencia se leen en el finally para
    // montar el modal posterior a la generación. Ver ModalDocumentoGenerado.
    let pdfBlob: Blob | null = null
    let guardado = false
    let filaId: string | null = null
    let folio: string | null = null

    try {
      // ── 4 · LA FILA PRIMERO, porque de ella sale el folio ─────────────
      //    Invierte el orden que tenían los ocho formatos —PDF, subida, fila—.
      //    El trigger asigna el folio al INSERT si el documento nace emitido, y
      //    al salir de `borrador` si venía de uno; en los dos casos el número
      //    solo existe DESPUÉS de escribir, así que renderizar antes imprimía
      //    un papel sin él.
      //
      //    Va con el cliente de SESIÓN del médico, nunca con privilegios de
      //    servicio: el trigger exenta por completo a quien no trae JWT, y el
      //    documento quedaría emitido con folio nulo PARA SIEMPRE —un segundo
      //    intento no lo arregla, porque la asignación exige venir de borrador—.
      const supabase = offlineMode ? null : createClient()
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No autenticado')

        if (idBorrador) {
          const { data, error } = await supabase
            .from('documentos')
            .update({ contenido, estado: 'emitido_firma_manual' })
            .eq('id', idBorrador)
            .eq('estado', 'borrador')
            .select('id, folio')
          if (error) throw error
          // Cero filas SIN error: la policy exige que el documento sea propio.
          // Sin esta comprobación la interfaz creería que emitió.
          if (!data || data.length === 0) throw new Error('EMISION_SIN_FILAS')
          filaId = data[0].id
          folio = data[0].folio
        } else {
          const insertPayload: Record<string, unknown> = {
            tipo: tipoTabla,
            // Explícito aunque sea el DEFAULT de la columna: aquí se lee que el
            // documento nace emitido, que es lo que le gana el folio en el INSERT.
            estado: 'emitido_firma_manual',
            contenido,
            client_id: clientId,
            subido_por: user.id,
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
        }
        // La fila está en el expediente. Aunque el PDF fallara después, el
        // documento es recuperable desde la lista con su botón de regenerar.
        guardado = true
      }

      // ── 5 · El PDF, ya con el número que la base acaba de asignar ─────
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
        // `folio` va en las dos ramas: es lo único que la inversión de orden
        // existe para conseguir. En el búnker offline no hay fila ni base, así
        // que llega undefined y el papel sale sin número, igual que hoy.
        data: esDenegacion
          ? { paciente, lugar, fecha: fechaFmt, edad, procedimiento, diagnostico, familiar,
              folio: folio ?? undefined }
          : {
            paciente, lugar, fecha: fechaFmt, edad,
            procedimiento, diagnostico, familiar,
            testigo1, testigo2, autorizaTransfusion, autorizaFotos,
            secciones, folio: folio ?? undefined,
          },
        logoUrl,
        filename: generateDocFileName(paciente, esDenegacion ? 'Denegacion_Consentimiento' : 'Consentimiento_Informado'),
        consultorio: consultorioData,
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
        if (storagePath && filaId && supabase) {
          // Este UPDATE no toca ni el estado ni el folio, así que el trigger lo
          // deja pasar: solo rechaza salir de un estado terminal o mover el folio.
          const { error } = await supabase
            .from('documentos')
            .update({ pdf_url: storagePath })
            .eq('id', filaId)
          if (error) {
            // No es fatal: la fila está y el PDF se entrega igual. Lo que se
            // pierde es la descarga desde la lista, que el botón de regenerar
            // repone.
            console.error('[ConsentimientoInformadoForm] update pdf_url:', error.message)
          }
        }
        // Emitido: el borrador dejó de serlo y la barra vuelve a su forma.
        if (idBorrador) {
          setBorradorId(null)
          setBorradorFecha(null)
        }
        const nombreDoc = esDenegacion ? 'Denegación guardada' : 'Consentimiento guardado'
        toast.success(folio ? `${nombreDoc} · ${folio}` : nombreDoc)
      }
    } catch (err) {
      // Tres desenlaces distintos, y el del medio es nuevo: con la fila escrita
      // antes que el PDF, un fallo de render deja un documento emitido y un
      // folio consumido. Decirlo con el número delante es lo que permite
      // encontrarlo en la lista y recuperar el PDF desde ahí.
      const emisionSinFilas = err instanceof Error && err.message === 'EMISION_SIN_FILAS'
      let msg: string
      if (emisionSinFilas) {
        msg = 'No se pudo emitir el borrador: no es tuyo o ya se había emitido.'
      } else if (offlineMode) {
        // En el búnker no hay fila ni folio que perder: el único fallo posible
        // es el render.
        msg = 'No se pudo generar el PDF. Intenta de nuevo.'
      } else if (filaId === null) {
        msg = esDenegacion
          ? 'No se pudo guardar la denegación, así que no se generó el PDF. Intenta de nuevo.'
          : 'No se pudo guardar el consentimiento, así que no se generó el PDF. Intenta de nuevo.'
      } else {
        msg = `El documento quedó registrado${folio ? ` con folio ${folio}` : ''}, pero no se pudo generar el PDF. `
          + 'Búscalo en la lista de documentos del paciente y recupéralo desde ahí.'
      }
      toast.error(msg)
      setErrorGuardado(msg)
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
      {/* Con el firmado abierto el formulario sigue MONTADO y apagado, no
          desmontado (§2): al salir del modo el médico vuelve a lo que estaba
          escribiendo, sin haberlo traspasado a ninguna parte. */}
      <div className="sp-doc-formbody"
        style={plantillas.panelAbierto || firmando ? { display: 'none' } : undefined}>

      {/* Banner del borrador retomado (§9.2). Arriba del todo: lo primero que
          hay que saber al abrir esta pantalla es que nada se ha emitido. */}
      {borradorId && !esDenegacion && (
        <p className="sp-banner sp-banner--warn">
          <FileClock size={17} />
          <span>
            {borradorFecha
              ? `Borrador guardado el ${format(parseISO(borradorFecha), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}. `
              : 'Borrador guardado. '}
            Sigue editándolo o continúa con el firmado; nada se ha emitido todavía.
          </span>
        </p>
      )}

      {plantillas.selector}

      {/* «Guardar como plantilla» sube aquí, junto al selector (spec 05 §1):
          abajo hay ya tres botones y un cuarto en la misma fila es un tablero. */}
      {plantillas.botonGuardar && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {plantillas.botonGuardar}
        </div>
      )}

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
              {/* El asterisco sigue a la validación, como en Diagnóstico: en
                  consentimiento el familiar solo es obligatorio si el paciente
                  no puede firmar. Un campo marcado como obligatorio que no
                  bloquea nada enseña una regla falsa. */}
              <label htmlFor="consentimiento-familiar" className="sp-label-field">
                Familiar responsable o representante legal
                {(esDenegacion || pacienteNoPuedeFirmar) && <>
                  {' '}<span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                  <span className="sr-only">obligatorio</span>
                </>}
              </label>
              <input ref={familiarRef} id="consentimiento-familiar" type="text" value={familiar}
                onChange={e => setFamiliar(e.target.value)} placeholder="Nombre completo"
                aria-invalid={senalar('familiar') || undefined}
                className={`sp-input ${senalar('familiar') ? 'sp-doc-invalid' : ''}`} />
              {/* La casilla va PEGADA al campo que vuelve obligatorio, no con las
                  autorizaciones: marcarla cambia la regla del control de arriba,
                  y esa relación tiene que verse de un vistazo. En denegación no
                  se muestra — esa hoja no tiene flujo de firmado. */}
              {!esDenegacion && (
                <label className="sp-check sp-doc-consent-nofirma">
                  <input id="consentimiento-nofirma" type="checkbox" className="sr-only"
                    checked={pacienteNoPuedeFirmar}
                    onChange={e => setPacienteNoPuedeFirmar(e.target.checked)} />
                  <span className="sp-check__box"><Check aria-hidden="true" /></span>
                  <span className="sp-check__label">El paciente no puede firmar</span>
                </label>
              )}
              {pacienteNoPuedeFirmar && (
                <p className="sp-hint">
                  El familiar responsable firma en su lugar: su nombre pasa a ser obligatorio.
                </p>
              )}
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

      {/* Orden del DOM = orden en fila desde 380px (§1). En XS `.sp-doc-actions`
          es `column-reverse`, así que el primario queda arriba sin más. */}
      <div className="sp-doc-actions">
        {esDenegacion ? (
          /* La denegación no tiene borrador ni firmado: se emite en el momento.
             Su barra es la de siempre. */
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
        ) : (
          <>
            <button type="button" onClick={guardarBorrador}
              disabled={guardandoBorrador || imprimiendo || vacio}
              title={vacio ? 'Escribe algo antes de guardarlo como borrador.' : undefined}
              className="sp-btn sp-btn--ghost" style={{ flex: '0 0 auto' }}>
              {guardandoBorrador ? <><span className="sp-spinner" /> Guardando…</> : 'Guardar borrador'}
            </button>
            <button type="button" onClick={imprimir}
              disabled={imprimiendo || guardandoBorrador || perfilPendiente}
              className="sp-btn sp-btn--secondary"
              style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}>
              {imprimiendo ? <><span className="sp-spinner" /> Generando PDF…</>
                : perfilPendiente ? <><span className="sp-spinner" /> Cargando tu perfil…</>
                : <><Printer size={17} /> Imprimir sin firma</>}
            </button>
            {/* No se apaga por faltantes, igual que el de imprimir: un botón
                gris no enseña qué falta, el banner sí. Al pulsar con faltantes
                no abre el firmado y lleva al primero. */}
            <button type="button" onClick={iniciarFirmado}
              disabled={imprimiendo || guardandoBorrador || perfilPendiente}
              className="sp-btn sp-btn--primary">
              <PenLine size={18} />
              {borradorId ? 'Continuar firmado' : 'Iniciar firmado electrónico'}
            </button>
          </>
        )}
      </div>

      </div>

      {plantillas.panel}
      {plantillas.dialogos}

      {/* El modo de firmado, a pantalla completa (spec 05 §2). Salir sin sellar
          no deshace nada: el borrador ya está escrito con este contenido. */}
      {firmando && (
        <FirmadoConsentimiento
          nombres={{ paciente, familiar, testigo_1: testigo1, testigo_2: testigo2 }}
          documentoId={firmando.documentoId}
          pacienteNoPuedeFirmar={pacienteNoPuedeFirmar}
          onSalir={() => { if (!sellando) { setFirmando(null); setErrorSellado('') } }}
          onSellar={sellar}
          sellando={sellando}
          errorSellado={errorSellado}
        />
      )}

      {/* §9.3 · ya hay un borrador PROPIO de este paciente. Retomar es el
          primario: casi siempre es el mismo procedimiento y lo que el médico
          quiere es seguir. */}
      <ModalShell
        open={dialogoPrevio && borradorPrevio !== null}
        onClose={() => !reemplazando && setDialogoPrevio(false)}
        spinusGeometry="decide"
        title={`${pacienteInicial.trim() || 'Este paciente'} ya tiene un consentimiento a medias`}
        footer={
          <div className="flex items-center gap-2 p-4 md:px-6">
            <button type="button" onClick={reemplazarBorrador} disabled={reemplazando}
              className="sp-btn sp-btn--ghost">
              {reemplazando ? <><span className="sp-spinner" /> Eliminando…</> : 'Reemplazarlo'}
            </button>
            <div className="flex-1" />
            <button type="button" disabled={reemplazando}
              onClick={() => borradorPrevio && aplicarBorrador(borradorPrevio)}
              className="sp-btn sp-btn--primary">
              Retomar el borrador
            </button>
          </div>
        }
      >
        <div className="p-4 md:p-6">
          <p className="sp-body">
            Solo puedes tener un borrador de consentimiento por paciente. Este es tuyo:
          </p>
          {/* Nombra el PROCEDIMIENTO y no solo la fecha: los borradores no
              caducan, así que este diálogo puede salir meses después. */}
          <div style={{
            marginTop: 'var(--sp-gap-item)',
            border: '1px dashed var(--sp-line-dash)',
            borderRadius: 'var(--sp-r-field-sm)',
            background: 'var(--sp-surface-sunken)',
            padding: '12px 14px',
          }}>
            <p className="sp-body" style={{ fontWeight: 'var(--sp-fw-bold)' }}>
              {texto(borradorPrevio?.contenido?.procedimiento) || 'Sin procedimiento anotado'}
            </p>
            <p className="sp-hint" style={{ marginTop: 2 }}>
              {borradorPrevio
                ? `Guardado el ${format(parseISO(borradorPrevio.created_at), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })} · sin firmar`
                : ''}
            </p>
          </div>
          <p className="sp-hint" style={{ marginTop: 'var(--sp-gap-item)' }}>
            Si lo reemplazas, se pierde lo que tenía escrito. No se puede deshacer.
          </p>
        </div>
      </ModalShell>

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
