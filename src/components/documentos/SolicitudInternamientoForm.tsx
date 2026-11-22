'use client'
import { generateDocFileName } from '@/lib/patientUtils'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { AlertTriangle, Check, Plus, X } from 'lucide-react'
import PieAccionesDocumento from '@/components/documentos/PieAccionesDocumento'
import { flushSync } from 'react-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { generarPdf, VERSION_DE_EMISION, versionQueEmite } from '@/lib/mobileShare'
import { useToast } from '@/components/ui/Toast'
import ModalShell from '@/components/ui/ModalShell'
import ModalDocumentoGenerado from '@/components/documentos/ModalDocumentoGenerado'
import SeccionPaso from '@/components/documentos/SeccionPaso'
import OpcionesRapidas from '@/components/documentos/OpcionesRapidas'
import MenuRequerimientos from '@/components/documentos/MenuRequerimientos'
import IndicacionesPiso from '@/components/documentos/IndicacionesPiso'
import {
  contarRenglones, gruposDeHoja, hojaDeGrupos, leerGrupos, resumenDiagnostico, resumenGenerales,
  resumenInstrucciones, resumenPiso, resumenRequerimientos, seccionDe, SECCIONES, textoIndicaciones,
  type GrupoIndicaciones, type Resumen, type SeccionInternamiento,
} from '@/components/documentos/internamientoCompacto'
import { usePlantillasDocumento, type ContenidoPlantilla } from '@/components/documentos/PlantillasDocumento'
import { folioImpreso } from '@/lib/documentos/folio'
import { createClient } from '@/lib/supabase/client'
import { hoyEnTZ, desplazarFecha, TZ_CLINICA } from '@/lib/dates'
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
   * El modal de «documento generado» se cerró — o sea, el documento ya salió y
   * el médico terminó con él.
   *
   * ⚠️⚠️ ESTO ES LO ÚNICO QUE IMPIDE EDITAR UN DOCUMENTO YA EMITIDO, y quien
   * venga a quitarlo tiene que saberlo. El host responde deseleccionando el
   * tipo, y eso DESMONTA este formulario. Esa es toda la garantía: entre emitir
   * y desmontar no hay ventana editable —el modal tapa el formulario, atrapa el
   * foco (`ModalShell:153-176`) y bloquea el scroll—, así que cuando el
   * formulario vuelve a existir es uno nuevo y vacío.
   *
   * Aquí hubo una segunda red —una huella del contenido al emitir, comparada
   * con la de cada render, que devolvía el diálogo de descarte si el médico
   * seguía escribiendo— y se retiró: con el desmontaje no llegaba a dispararse
   * nunca. Si algún día el host deja de desmontar, ese caso se reabre y esa red
   * hay que reponerla.
   *
   * Existe para que el HOST pueda replegar su selector y volver a la rejilla de
   * los ocho tipos: el formulario no puede hacerlo solo porque no es dueño del
   * `value` del selector, y a estas alturas seguir enseñando la receta recién
   * emitida no ayuda a nadie.
   *
   * ⚠️ SE DISPARA AL CERRAR EL MODAL Y NO AL EMITIR, y la diferencia importa:
   * este mismo componente RENDERIZA ese modal, así que soltar la señal al
   * emitir haría que el host lo desmontara con el PDF todavía en pantalla.
   *
   * Opcional: el búnker y cualquier montaje sin selector lo omiten y no pasa
   * nada.
   */
  onCerrarTrasEmitir?: () => void
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

/* Los botones de un toque guardan EXACTAMENTE los valores del `<select>` de
   antes: el tipo tal cual y el ASA como «ASA I» … «ASA E (Emergencia)». */
const OPCIONES_TIPO = TIPOS_INTERNAMIENTO.map(t => ({ valor: t, etiqueta: t }))
const OPCIONES_ASA = ASA.map(a => ({ valor: `ASA ${a}`, etiqueta: a }))

/** Ajusta el alto del área de texto a su contenido: una línea que crece, sin tirador. */
function ajustarAlto(t: HTMLTextAreaElement | null): void {
  if (!t) return
  t.style.height = 'auto'
  t.style.height = `${t.scrollHeight}px`
}

/** Lo que el Tab recorre dentro de una sección, en orden de documento. */
function enfocables(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>('input, textarea, select, button, [tabindex]'))
    .filter(el => el.tabIndex >= 0 && !el.hasAttribute('disabled') && el.getClientRects().length > 0)
}

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

export default function SolicitudInternamientoForm({ pacienteInicial = '', diagnosticoInicial = '', pacienteId, offlineMode, onOfflineSave, onVacioChange, onCerrarTrasEmitir, onPanelPlantillasChange }: Props) {
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
  // `TZ_CLINICA` explícito, no el huso del dispositivo: este inicializador de
  // `useState` corre TAMBIÉN en la pasada de SSR, donde `tzDispositivo()`
  // devolvería UTC de Vercel y el cliente lo corregiría al hidratar — fecha
  // parpadeante en un formulario que emite un documento legal. Y la fecha del
  // documento es de la clínica de todos modos (LA REGLA, en `@/lib/dates`).
  const [fecha, setFecha] = useState(hoyEnTZ(TZ_CLINICA))
  const [fechaIngreso, setFechaIngreso] = useState('')
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial)
  // Nacen sin ninguno: «＋ Diagnóstico secundario» (o Enter en uno) los añade.
  // Al emitir se filtran los vacíos igual que antes, así que lo guardado es lo mismo.
  const [diagnosticosSecundarios, setDiagnosticosSecundarios] = useState<string[]>([])
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
  // La HOJA de órdenes: los cuatro grupos fijos siempre. Lo que se guarda y se
  // imprime sale de `gruposDeHoja(hoja)`, con la forma de siempre.
  const [hojaPiso, setHojaPiso] = useState<GrupoIndicaciones[]>(() => hojaDeGrupos([]))
  // Una sección abierta a la vez (maqueta aprobada). Nace abierta la primera.
  const [abierta, setAbierta] = useState<SeccionInternamiento | null>('gen')
  const [imprimiendo, setImprimiendo] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [errorAbierto, setErrorAbierto] = useState(false)
  const [docGenerado, setDocGenerado] = useState<{ blob: Blob; guardado: boolean; documentoId: string | null } | null>(null)
  // El banner de faltantes NO existe hasta el primer intento de imprimir: un
  // formulario recién abierto no acusa de nada. Después permanece y se
  // actualiza en vivo.
  const [intentado, setIntentado] = useState(false)

  const formRef = useRef<HTMLDivElement>(null)
  const seccionesRef = useRef<HTMLDivElement>(null)
  const pacienteRef = useRef<HTMLInputElement>(null)
  const lugarRef = useRef<HTMLInputElement>(null)
  const diagnosticoRef = useRef<HTMLInputElement>(null)
  const ingresoRef = useRef<HTMLInputElement>(null)
  const procedimientoRef = useRef<HTMLTextAreaElement>(null)
  const justificacionRef = useRef<HTMLTextAreaElement>(null)
  const instruccionesRef = useRef<HTMLTextAreaElement>(null)
  // Las tres áreas de texto son una línea que crece (las de instrucciones
  // nacen altas por su texto). Se miden al cambiar y al abrir su sección.
  useLayoutEffect(() => {
    ajustarAlto(procedimientoRef.current)
    ajustarAlto(justificacionRef.current)
    ajustarAlto(instruccionesRef.current)
  }, [procedimiento, justificacion, instruccionesPaciente, abierta])

  /* Lo que decide «¿está vacío?». La tupla se extiende sobre `isFormEmpty`, así
     que el compilador impide que diverja de su firma.
     ⚠️ SE LLAMA `paraVacio` Y NO `contenido`: `imprimir()` declara su propio
     `contenido` con lo que se manda a imprimir, y dos nombres iguales en dos
     ámbitos anidados es una trampa de lectura. */
  const paraVacio = {
    paciente, pacienteInicial, diagnostico, diagnosticoInicial,
    secundarios: diagnosticosSecundarios, fechaIngreso, tipoInternamiento,
    diasEstimados, asa, lugar, urgente, procedimiento, requerimientos,
    requerimientosExtra, justificacion, instruccionesPaciente, grupos: hojaPiso,
  }
  const vacio = isFormEmpty(paraVacio)

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
      // Sólo los grupos con texto, como cuando un grupo «apagado» no existía.
      gruposPiso: gruposDeHoja(hojaPiso).map(g => ({ nombre: g.nombre, renglones: [...g.renglones] })),
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
      // Los grupos fijos que la plantilla no trae se muestran vacíos.
      setHojaPiso(hojaDeGrupos(leerGrupos(c.gruposPiso)))
      // Aplicada, todo plegado (se ve la solicitud entera); vaciada (un
      // contenido sin claves), la primera abierta para escribir.
      setAbierta(Object.keys(c).length === 0 ? 'gen' : null)
    },
  })

  // G-10: foco al primer campo editable vacío al montar. preventScroll para no
  // arrastrar la página hasta él. En móvil esto abre el teclado en cada montaje.
  useEffect(() => {
    const primero = formRef.current?.querySelector<HTMLElement>('input:not([type="date"]), textarea')
    if (primero instanceof HTMLInputElement && !primero.value) primero.focus({ preventScroll: true })
  }, [])

  // ── Secciones: abrir, plegar y Tab al final (maqueta aprobada) ───────────
  /**
   * Abre una sección (plegando la que estuviera abierta) y enfoca `el` o, si no
   * se da, su primer campo. Lo acerca al borde de arriba: en `tel`/`iv` el
   * encabezado fundido flota SOBRE el scroller y su alto es el relleno de
   * arriba de `.app-contenido`.
   */
  function abrir(s: SeccionInternamiento, el?: () => HTMLElement | null): void {
    flushSync(() => setAbierta(s))
    const cuerpo = document.getElementById(`internamiento-${s}-cuerpo`)
    const destino = el?.() ?? (cuerpo ? enfocables(cuerpo)[0] : null)
    const contenido = formRef.current?.closest<HTMLElement>('.app-contenido')
    const margen = contenido ? parseFloat(getComputedStyle(contenido).paddingTop) || 24 : 24
    enfocarYAcercar(destino ?? null, Math.max(24, margen))
  }

  /** Tab (sin Mayús) en el último control de una sección: la resume y abre la siguiente. */
  function teclaCuerpo(s: SeccionInternamiento, e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key !== 'Tab' || e.shiftKey || e.altKey || e.ctrlKey || e.defaultPrevented) return
    const sig = SECCIONES[SECCIONES.indexOf(s) + 1]
    const todos = enfocables(e.currentTarget)
    if (!sig || document.activeElement !== todos[todos.length - 1]) return
    e.preventDefault()
    abrir(sig)
  }

  /** Pliega la abierta al tocar o enfocar fuera de las secciones (si el foco no volvió dentro). */
  function plegar(): void {
    if (abierta === null || seccionesRef.current?.contains(document.activeElement)) return
    setAbierta(null)
  }
  const plegarRef = useRef(plegar)
  useEffect(() => { plegarRef.current = plegar })

  /*
   * La escucha de «salir» de la receta. Con el puntero se pliega al SOLTAR y con
   * un `setTimeout`: plegar cambia el alto de la página, y hacerlo en el
   * `pointerdown` movería el destino antes del `mouseup` y el clic caería en
   * otro sitio. Un desplazamiento con el dedo termina en `pointercancel` y no
   * pliega. Con el teclado (Tab que sale), en el `focusin`. Las capas
   * (diálogos, alertas, listas, menús) no cuentan como fuera.
   */
  useEffect(() => {
    let abajoFuera = false
    const fuera = (t: EventTarget | null): boolean => t instanceof Element
      && !seccionesRef.current?.contains(t)
      && !t.closest('[role="dialog"], [role="alertdialog"], [role="listbox"], [role="menu"]')
    const alBajar = (e: PointerEvent) => { abajoFuera = fuera(e.target) }
    const alSoltar = () => {
      if (!abajoFuera) return
      abajoFuera = false
      setTimeout(() => plegarRef.current(), 0)
    }
    const alCancelar = () => { abajoFuera = false }
    const alEnfocar = (e: FocusEvent) => { if (!abajoFuera && fuera(e.target)) plegarRef.current() }
    document.addEventListener('pointerdown', alBajar, true)
    document.addEventListener('pointerup', alSoltar, true)
    document.addEventListener('pointercancel', alCancelar, true)
    document.addEventListener('focusin', alEnfocar)
    return () => {
      document.removeEventListener('pointerdown', alBajar, true)
      document.removeEventListener('pointerup', alSoltar, true)
      document.removeEventListener('pointercancel', alCancelar, true)
      document.removeEventListener('focusin', alEnfocar)
    }
  }, [])

  // ── Diagnósticos secundarios: Enter añade otro; Retroceso en uno vacío lo quita ──
  const idSecundario = (i: number): string => `internamiento-secundario-${i}`
  function secundarios(nuevos: string[], foco: number | null): void {
    flushSync(() => setDiagnosticosSecundarios(nuevos))
    const el = foco === null ? diagnosticoRef.current : document.getElementById(idSecundario(foco))
    el?.focus()
  }
  function teclaSecundario(e: KeyboardEvent<HTMLInputElement>, i: number): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      secundarios([...diagnosticosSecundarios.slice(0, i + 1), '', ...diagnosticosSecundarios.slice(i + 1)], i + 1)
    } else if (e.key === 'Backspace' && e.currentTarget.value === '') {
      e.preventDefault()
      const quedan = diagnosticosSecundarios.filter((_, j) => j !== i)
      secundarios(quedan, quedan.length === 0 ? null : Math.max(0, i - 1))
    }
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

  /** Abre la sección del faltante y enfoca su campo. */
  function irA(clave: string) {
    const ref = clave === 'paciente' ? pacienteRef
      : clave === 'lugar' ? lugarRef
        : clave === 'fechaIngreso' ? ingresoRef
          : diagnosticoRef
    abrir(seccionDe(clave), () => ref.current)
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
    //    Los dos salen de `gruposDeHoja`: la hoja tiene los cuatro grupos fijos
    //    siempre, y lo guardado sólo los que llevan texto, como antes.
    const gruposPiso = gruposDeHoja(hojaPiso)
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
      setErrorGuardado(msg)
      setErrorAbierto(true)
      // eslint-disable-next-line no-console
      console.error('[SolicitudInternamientoForm] imprimir falló:', err)
    } finally {
      setImprimiendo(false)
      // También cuando la persistencia falló: el PDF existe y con el paciente
      // enfrente lo urgente es poder imprimirlo.
      if (pdfBlob && !offlineMode) { setDocGenerado({ blob: pdfBlob, guardado, documentoId: filaId }) }
    }
  }

  const senalar = (clave: string) => intentado && faltantes.some(f => f.clave === clave)
  const maxFecha = desplazarFecha(hoyEnTZ(TZ_CLINICA), { anios: 1 })

  /**
   * Lo que dice cada sección plegada. Tras intentar imprimir, la que tenga un
   * obligatorio sin llenar lo dice en rojo («Falta Paciente · Hospital»).
   */
  function cabecera(s: SeccionInternamiento, r: Resumen) {
    const suyos = intentado ? faltantes.filter(f => seccionDe(f.clave) === s) : []
    const falta = suyos.length > 0
    return {
      id: s, resumen: falta ? `Falta ${suyos.map(f => f.nombre).join(' · ')}` : r.texto,
      completa: r.completa && !falta, falta, abierta: abierta === s,
      onAlternar: () => (abierta === s ? setAbierta(null) : abrir(s)),
      onTeclaCuerpo: (e: KeyboardEvent<HTMLDivElement>) => teclaCuerpo(s, e),
    }
  }
  const generales = resumenGenerales({ tipoInternamiento, fechaIngreso, diasEstimados, asa, lugar, urgente })
  const campo = (clave: string, extra = '') => `sp-rx-campo${extra}${senalar(clave) ? ' sp-rx-campo--falta' : ''}`
  const obligatorio = <><span aria-hidden="true" className="sp-int-ob">*</span><span className="sr-only"> obligatorio</span></>

  return (
    <div ref={formRef} className="sp-doc-form">
      {/* El árbol del formulario NO se desmonta cuando el panel de plantillas
          está abierto: se apaga con display:none y el panel se monta como
          hermano, en el mismo contenedor de scroll (spec 02 §3.1). */}
      <div className="sp-doc-formbody" style={plantillas.panelAbierto ? { display: 'none' } : undefined}>

      {plantillas.selector}

      {/* Solicitud compacta (maqueta `internamiento.html`, aprobada por el
          dueño): cinco secciones numeradas, UNA abierta a la vez y las demás
          resumidas en una línea. Tab en el último control de una sección la
          resume y abre la siguiente; tocar fuera pliega la abierta. Todo local,
          sin red (lo comparte el búnker). */}
      <div ref={seccionesRef} className="sp-int">

      <SeccionPaso numero={1} titulo="Datos generales" {...cabecera('gen', generales)}>
        <div className={campo('paciente')}>
          <label htmlFor="internamiento-paciente" className="sp-rx-rot">Paciente{obligatorio}</label>
          <input ref={pacienteRef} id="internamiento-paciente" type="text" value={paciente}
            onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo" autoComplete="off"
            aria-invalid={senalar('paciente') || undefined} className="sp-rx-fi" />
        </div>
        <div className="sp-int-blo">
          <span className="sp-int-rot" aria-hidden="true">Tipo</span>
          <OpcionesRapidas id="internamiento-tipo" nombre="Tipo de internamiento" opciones={OPCIONES_TIPO}
            valor={tipoInternamiento} onCambio={setTipoInternamiento} />
        </div>
        <div className="sp-rx-par">
          <div className={campo('fechaIngreso')}>
            <label htmlFor="internamiento-ingreso" className="sp-rx-rot">Ingreso{obligatorio}</label>
            <input ref={ingresoRef} id="internamiento-ingreso" type="date" value={fechaIngreso}
              min={FECHA_MIN} max={maxFecha} onChange={e => setFechaIngreso(e.target.value)}
              aria-label="Fecha propuesta de ingreso (obligatorio)"
              aria-invalid={senalar('fechaIngreso') || undefined} className="sp-rx-fi" />
          </div>
          {/* Texto libre y no numérico: `3-5 días` es la respuesta habitual. */}
          <div className="sp-rx-campo">
            <label htmlFor="internamiento-dias" className="sp-rx-rot">Días</label>
            <input id="internamiento-dias" type="text" value={diasEstimados} autoComplete="off"
              onChange={e => setDiasEstimados(e.target.value)} aria-label="Días estimados"
              placeholder="Ej: 3-5 días" className="sp-rx-fi" />
          </div>
        </div>
        <div className="sp-int-blo">
          <span className="sp-int-rot" aria-hidden="true">ASA</span>
          <OpcionesRapidas id="internamiento-asa" nombre="Clasificación ASA" opciones={OPCIONES_ASA}
            valor={asa} onCambio={setAsa} />
        </div>
        <div className={campo('lugar')}>
          <label htmlFor="internamiento-lugar" className="sp-rx-rot">Hospital{obligatorio}</label>
          <input ref={lugarRef} id="internamiento-lugar" type="text" value={lugar} autoComplete="off"
            onChange={e => setLugar(e.target.value)} placeholder="Ej: Hospital Ángeles Lomas"
            aria-label="Hospital / lugar de internamiento (obligatorio)"
            aria-invalid={senalar('lugar') || undefined} className="sp-rx-fi" />
        </div>
        <div className="sp-rx-par">
          <div className="sp-rx-campo">
            <label htmlFor="internamiento-fecha" className="sp-rx-rot">Fecha</label>
            <input id="internamiento-fecha" type="date" value={fecha} min={FECHA_MIN} max={maxFecha}
              onChange={e => setFecha(e.target.value)} aria-label="Fecha del documento" className="sp-rx-fi" />
          </div>
          {/* El rojo va al badge y no a la etiqueta: en rojo, la casilla
              competía con los errores del formulario. */}
          <label className="sp-check sp-int-urgente">
            <input id="internamiento-urgente" type="checkbox" className="sr-only"
              checked={urgente} onChange={e => setUrgente(e.target.checked)} />
            <span className="sp-check__box"><Check aria-hidden="true" /></span>
            <span className="sp-check__label">Marcar como URGENTE</span>
            {urgente && <span className="sp-badge sp-badge--danger">URGENTE</span>}
          </label>
        </div>
      </SeccionPaso>

      <SeccionPaso numero={2} titulo="Diagnóstico y procedimiento"
        {...cabecera('dx', resumenDiagnostico(diagnostico, diagnosticosSecundarios, procedimiento))}>
        <div className={campo('diagnostico')}>
          <label htmlFor="internamiento-diagnostico" className="sp-rx-rot">Dx principal{obligatorio}</label>
          <input ref={diagnosticoRef} id="internamiento-diagnostico" type="text" value={diagnostico} autoComplete="off"
            onChange={e => setDiagnostico(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); procedimientoRef.current?.focus() } }}
            placeholder="Diagnóstico principal de ingreso" aria-label="Diagnóstico principal (obligatorio)"
            aria-invalid={senalar('diagnostico') || undefined} className="sp-rx-fi" />
        </div>
        {diagnosticosSecundarios.map((d, i) => (
          <div key={i} className="sp-rx-campo">
            <label htmlFor={idSecundario(i)} className="sp-rx-rot">Sec. {i + 1}</label>
            <input id={idSecundario(i)} type="text" value={d} autoComplete="off"
              onChange={e => setDiagnosticosSecundarios(prev => prev.map((x, j) => (j === i ? e.target.value : x)))}
              onKeyDown={e => teclaSecundario(e, i)}
              aria-label={`Diagnóstico secundario ${i + 1}`} placeholder="Diagnóstico secundario" className="sp-rx-fi" />
            <button type="button" tabIndex={-1} className="k-b k-b-icono sp-int-quitar"
              onClick={() => secundarios(diagnosticosSecundarios.filter((_, j) => j !== i), null)}
              aria-label={d.trim() ? `Eliminar ${d.trim()}` : `Eliminar secundario ${i + 1}`}>
              <X aria-hidden="true" />
            </button>
          </div>
        ))}
        <div>
          <button type="button" className="k-b k-b-texto"
            onClick={() => secundarios([...diagnosticosSecundarios, ''], diagnosticosSecundarios.length)}>
            <Plus aria-hidden="true" size={16} /> Diagnóstico secundario
          </button>
        </div>
        <div className="sp-rx-campo sp-rx-campo--texto">
          <label htmlFor="internamiento-procedimiento" className="sp-rx-rot">Procedimiento</label>
          <textarea ref={procedimientoRef} id="internamiento-procedimiento" rows={1} value={procedimiento}
            onChange={e => setProcedimiento(e.target.value)} aria-label="Procedimiento / cirugía solicitada"
            placeholder="Ej: Artrodesis posterolateral L4-L5 con tornillos pediculares e injerto óseo autólogo…"
            className="sp-rx-fi sp-rx-ta" />
        </div>
      </SeccionPaso>

      <SeccionPaso numero={3} titulo="Requerimientos y justificación"
        {...cabecera('req', resumenRequerimientos([...requerimientos, requerimientosExtra], justificacion))}>
        <MenuRequerimientos requerimientos={requerimientos} extra={requerimientosExtra}
          onRequerimientos={setRequerimientos} onExtra={setRequerimientosExtra} />
        <div className="sp-rx-campo sp-rx-campo--texto">
          <label htmlFor="internamiento-justificacion" className="sp-rx-rot">Justificación</label>
          <textarea ref={justificacionRef} id="internamiento-justificacion" rows={1} value={justificacion}
            onChange={e => setJustificacion(e.target.value)} aria-label="Justificación clínica"
            placeholder="Evolución del padecimiento, hallazgos, fracaso del tratamiento conservador…"
            className="sp-rx-fi sp-rx-ta" />
        </div>
      </SeccionPaso>

      <SeccionPaso numero={4} titulo="Instrucciones al paciente"
        {...cabecera('ins', resumenInstrucciones(instruccionesPaciente !== INSTRUCCIONES_DEFECTO))}>
        <div className="sp-rx-campo sp-rx-campo--texto">
          <textarea ref={instruccionesRef} id="internamiento-instrucciones-texto" rows={6} value={instruccionesPaciente}
            onChange={e => setInstruccionesPaciente(e.target.value)} aria-label="Instrucciones al paciente"
            className="sp-rx-fi sp-rx-ta sp-int-ins" />
        </div>
        <div>
          <button type="button" className="k-b k-b-texto" onClick={() => setInstruccionesPaciente(INSTRUCCIONES_DEFECTO)}>
            Restablecer el texto estándar
          </button>
        </div>
      </SeccionPaso>

      <SeccionPaso numero={5} titulo="Indicaciones de ingreso a piso" {...cabecera('piso', resumenPiso(hojaPiso))}>
        <IndicacionesPiso hoja={hojaPiso} onChange={setHojaPiso} />
      </SeccionPaso>

      </div>

      {/* Un solo mensaje cuando falla el guardado (rediseño B9; CALMA §20): antes
          salía dos veces, en un aviso y en una banda. El texto se queda en
          `errorGuardado` mientras la alerta sale, para que no se vacíe a medias. */}
      <ModalShell
        open={errorAbierto && errorGuardado !== ''}
        onClose={() => setErrorAbierto(false)}
        variante="alerta"
        tono="destruir"
        elevated
        icon={<AlertTriangle aria-hidden="true" />}
        title="No se pudo guardar"
        footer={
          <button type="button" autoFocus data-principal onClick={() => setErrorAbierto(false)} className="k-b k-b-capa k-b-prim">
            Aceptar
          </button>
        }
      >
        <p>{errorGuardado}</p>
      </ModalShell>

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
      <PieAccionesDocumento
        botonGuardar={plantillas.botonGuardar}
        onImprimir={imprimir}
        imprimiendo={imprimiendo}
        perfilPendiente={perfilPendiente}
      />

      </div>

      {plantillas.panel}
      {plantillas.dialogos}

      <ModalDocumentoGenerado
        open={docGenerado !== null}
        /* Cerrar el modal es el final del documento: se suelta la señal para
           que el host repliegue su selector. `setDocGenerado(null)` primero,
           para que el modal se desmonte por su cuenta y no de rebote al
           desmontarse este formulario entero. */
        onClose={() => { setDocGenerado(null); onCerrarTrasEmitir?.() }}
        blob={docGenerado?.blob ?? null}
        titulo="Solicitud de internamiento generada"
        guardadoEnExpediente={docGenerado?.guardado ?? false}
        documentoId={docGenerado?.documentoId ?? null}
      />
    </div>
  )
}
