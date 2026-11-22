'use client'
import { generateDocFileName } from '@/lib/patientUtils'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { useProfile } from '@/hooks/useProfile'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, ClipboardList, Plus } from 'lucide-react'
import PieAccionesDocumento from '@/components/documentos/PieAccionesDocumento'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import { generarPdf, VERSION_DE_EMISION, versionQueEmite } from '@/lib/mobileShare'
import { useToast } from '@/components/ui/Toast'
import ModalShell from '@/components/ui/ModalShell'
import ModalDocumentoGenerado from '@/components/documentos/ModalDocumentoGenerado'
import { usePlantillasDocumento, type ContenidoPlantilla } from '@/components/documentos/PlantillasDocumento'
import QRCode from 'qrcode'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { folioImpreso } from '@/lib/documentos/folio'
import { createClient } from '@/lib/supabase/client'
import { hoyEnTZ, desplazarFecha, TZ_CLINICA } from '@/lib/dates'
import { enfocarYAcercar } from '@/lib/scrollDoc'
import LineaSuplemento from '@/components/documentos/LineaSuplemento'
import SuplementoAbierto from '@/components/documentos/SuplementoAbierto'
import type { OpcionSuplemento } from '@/components/documentos/BuscadorSuplemento'
import { filaQueSobra, pesoNumerico, textoCalculo } from '@/components/documentos/suplementosCompacto'

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

const FECHA_MIN = '1900-01-01'

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

/**
 * Dosis propuesta para el campo editable de la tarjeta.
 *
 * Sin peso NO se calcula nada (§2.3): la tarjeta se abre con la dosis vacía y
 * se rellena sola en cuanto el peso llega. Los suplementos que no dosifican por
 * kilo —Ashwagandha— llevan siempre su dosis fija, con peso o sin él.
 */
function dosisParaForm(sup: Suplemento, peso: number): string {
  if (!sup.min_kg) return sup.dosis_default
  if (!(peso > 0)) return ''
  return dosisEnCapsulas(sup, peso) ?? calcularDosis(sup, peso)
}

/**
 * `editada` no viaja al PDF ni al expediente: es la memoria de quién escribió la
 * dosis, y es lo único que permite recalcular al corregir el peso sin pisar lo
 * que el médico puso a mano (S-04).
 */
type SupSelec = { nombre: string; dosis: string; marca: string; justificacion: string; editada: boolean }

/**
 * Fila del plan compacto: un suplemento (o, con `nombre` vacío, el buscador
 * todavía sin elegir) y su clave estable de React —no el índice, para no
 * perder el foco al quitar uno—. La clave no viaja ni al PDF ni al jsonb.
 */
type Fila = SupSelec & { clave: number }
let ultimaClave = 0
function filaNueva(s?: SupSelec): Fila {
  ultimaClave += 1
  return { nombre: '', dosis: '', marca: '', justificacion: '', editada: false, ...s, clave: ultimaClave }
}
const supDe = (nombre: string): Suplemento | undefined => SUPLEMENTOS.find(s => s.nombre === nombre)

/** Aviso de recálculo (§3). Se redacta con los dos números y nada más. */
function textoRecalculo(recalculadas: number, conservadas: number): string {
  const r = recalculadas === 1 ? 'Se recalculó 1 dosis' : `Se recalcularon ${recalculadas} dosis`
  if (conservadas === 0) return `${r}.`
  if (recalculadas === 0) {
    return conservadas === 1
      ? 'No se recalculó ninguna dosis: la editaste a mano.'
      : `No se recalculó ninguna dosis: editaste las ${conservadas}.`
  }
  return conservadas === 1
    ? `${r}; 1 se conservó porque la editaste`
    : `${r}; ${conservadas} se conservaron porque las editaste`
}

/** Lee un suplemento guardado en jsonb. Solo sobreviven los del catálogo de hoy. */
function leerSuplemento(bruto: unknown): SupSelec | null {
  if (typeof bruto !== 'object' || bruto === null) return null
  const fila = bruto as Record<string, unknown>
  const texto = (v: unknown): string => (typeof v === 'string' ? v : '')
  const nombre = texto(fila.nombre)
  if (!SUPLEMENTOS.some(s => s.nombre === nombre)) return null
  return {
    nombre,
    dosis: texto(fila.dosis),
    marca: texto(fila.marca),
    justificacion: texto(fila.justificacion),
    // Una dosis que llega de una plantilla se respeta igual que una escrita a
    // mano: la eligió el médico al guardarla.
    editada: texto(fila.dosis).trim() !== '',
  }
}

/**
 * Predicado único de «formulario vacío». Mismo criterio que Laboratorio: los
 * campos prellenados de la ficha no cuentan hasta que se editan. El peso queda
 * fuera por la misma razón que la fecha y el diagnóstico —la guía lo declara
 * dato de paciente (§1)— y por eso tampoco entra en la plantilla: si contara,
 * teclear solo el peso habilitaría guardar una plantilla sin nada dentro.
 */
function isFormEmpty(
  seleccionados: SupSelec[], notas: string, seguimiento: string,
  paciente: string, pacienteInicial: string,
  diagnostico: string, diagnosticoInicial: string,
): boolean {
  const pacienteIntacto = paciente.trim() === '' || paciente.trim() === pacienteInicial.trim()
  const dxIntacto = diagnostico.trim() === '' || diagnostico.trim() === diagnosticoInicial.trim()
  return pacienteIntacto && dxIntacto && seleccionados.length === 0
    && notas.trim() === '' && seguimiento.trim() === ''
}

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

export default function PlanSuplementacionForm({ pacienteInicial = '', diagnosticoInicial = '', pacienteId, offlineMode, onOfflineSave, onVacioChange, onCerrarTrasEmitir, onPanelPlantillasChange }: Props) {
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
  const { isSuperAdmin } = useProfile()
  const toast = useToast()
  const [paciente, setPaciente] = useState(pacienteInicial)
  // `TZ_CLINICA` explícito, no el huso del dispositivo: este inicializador de
  // `useState` corre TAMBIÉN en la pasada de SSR, donde `tzDispositivo()`
  // devolvería UTC de Vercel y el cliente lo corregiría al hidratar — fecha
  // parpadeante en un formulario que emite un documento legal. Y la fecha del
  // documento es de la clínica de todos modos (LA REGLA, en `@/lib/dates`).
  const [fecha, setFecha] = useState(hoyEnTZ(TZ_CLINICA))
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial)
  const [pesoKg, setPesoKg] = useState('')
  // Plan compacto (maqueta aprobada): UN suplemento abierto a la vez (su clave),
  // los demás plegados a una línea. Nace una fila con el buscador, abierta.
  const [filas, setFilas] = useState<Fila[]>(() => [filaNueva()])
  const [abierta, setAbierta] = useState<number | null>(() => filas[0]?.clave ?? null)
  // Lo elegido, sin la fila del buscador ni la clave: lo mismo que antes se
  // guardaba en el estado `seleccionados`, en el orden en que se eligió.
  const seleccionados: SupSelec[] = filas.filter(f => f.nombre !== '')
    .map(f => ({ nombre: f.nombre, dosis: f.dosis, marca: f.marca, justificacion: f.justificacion, editada: f.editada }))
  const [notas, setNotas] = useState('')
  const [seguimiento, setSeguimiento] = useState('')
  // Notas y cita de control ocultas tras «＋ …» mientras están vacías.
  const [notasAbiertas, setNotasAbiertas] = useState(false)
  const [controlAbierto, setControlAbierto] = useState(false)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [errorAbierto, setErrorAbierto] = useState(false)
  const [docGenerado, setDocGenerado] = useState<{ blob: Blob; guardado: boolean; documentoId: string | null } | null>(null)
  // Aviso de recálculo por cambio de peso (S-04). Nace al corregir el peso con
  // suplementos ya elegidos y desaparece en el siguiente cambio de peso.
  const [recalculo, setRecalculo] = useState<{ recalculadas: number; conservadas: number } | null>(null)
  // Nada acusa antes del primer intento de imprimir; después se actualiza en vivo.
  const [intentado, setIntentado] = useState(false)

  const formRef = useRef<HTMLDivElement>(null)
  const pacienteRef = useRef<HTMLInputElement>(null)

  /* Lo que decide «¿está vacío?». La tupla se extiende sobre `isFormEmpty`, así
     que el compilador impide que diverja de su firma.
     ⚠️ SE LLAMA `paraVacio` Y NO `contenido`: `imprimir()` declara su propio
     `contenido` con lo que se manda a imprimir, y dos nombres iguales en dos
     ámbitos anidados es una trampa de lectura. */
  const paraVacio = [seleccionados, notas, seguimiento, paciente, pacienteInicial, diagnostico, diagnosticoInicial] as const
  const vacio = isFormEmpty(...paraVacio)

  useEffect(() => { onVacioChange?.(vacio) }, [vacio, onVacioChange])

  // ── Plantillas (spec 02) ────────────────────────────────────────
  // Se guarda TODO menos los datos del paciente: fuera paciente, diagnóstico,
  // fecha y peso. El peso es del paciente que está delante, no del plan.
  const plantillas = usePlantillasDocumento({
    tipo: 'plan_suplementacion',
    vacio,
    // El búnker no tiene red ni sesión de Supabase: el sistema no se monta.
    desactivado: !!offlineMode,
    onPanelChange: onPanelPlantillasChange,
    leer: () => ({ _v: 1, seleccionados, notas, seguimiento }),
    aplicar: (c: ContenidoPlantilla) => {
      // Solo las claves que existen HOY, campo a campo. Los valores de repuesto
      // NO son defensa de sobra: «Vaciar formulario» aplica un contenido sin
      // ninguna clave, así que es justo lo que repone el estado inicial.
      const leidos = Array.isArray(c.seleccionados)
        ? c.seleccionados.map(leerSuplemento).filter((s): s is SupSelec => s !== null)
        : []
      // Aplicada, todo plegado (se ve el plan entero); vaciada, el buscador
      // queda abierto para elegir.
      const nuevas = leidos.length > 0 ? leidos.map(s => filaNueva(s)) : [filaNueva()]
      setFilas(nuevas)
      setAbierta(leidos.length > 0 ? null : nuevas[0].clave)
      setNotas(typeof c.notas === 'string' ? c.notas : '')
      setSeguimiento(typeof c.seguimiento === 'string' ? c.seguimiento : '')
      // Con texto se ven solas; sin él vuelven a «＋ Notas» / «＋ Cita de control».
      setNotasAbiertas(false)
      setControlAbierto(false)
      setRecalculo(null)
    },
  })

  // G-10: foco al primer campo editable vacío al montar. preventScroll para no
  // arrastrar la página hasta él. En móvil esto abre el teclado en cada montaje.
  useEffect(() => {
    const primero = formRef.current?.querySelector<HTMLElement>('input:not([type="date"]):not([type="checkbox"])')
    if (primero instanceof HTMLInputElement && !primero.value) primero.focus({ preventScroll: true })
  }, [])

  const [catalogoAbierto, setCatalogoAbierto] = useState(false)

  // ── Plan compacto: elegir, abrir, plegar, agregar y quitar ──────────────
  const listaRef = useRef<HTMLDivElement>(null)
  const accionesRef = useRef<HTMLDivElement>(null)
  const pesoRef = useRef<HTMLInputElement>(null)

  /** Enfoca un campo de una fila ya pintada y lo acerca, como en la receta. */
  function enfocar(clave: number, campo: 'buscar' | 'dosis' | 'marca') {
    const contenido = formRef.current?.closest<HTMLElement>('.app-contenido')
    const margen = contenido ? parseFloat(getComputedStyle(contenido).paddingTop) || 24 : 24
    enfocarYAcercar(document.getElementById(`suplementacion-${campo}-${clave}`), Math.max(24, margen))
  }
  const campoDe = (f: Fila | undefined): 'buscar' | 'dosis' => (f && f.nombre !== '' ? 'dosis' : 'buscar')

  /** Abre una fila (plegando la abierta; la del buscador vacía se quita) y la enfoca. */
  function abrirEn(clave: number) {
    const sobra = filaQueSobra(filas, abierta)
    flushSync(() => {
      if (sobra !== null && sobra !== clave) setFilas(prev => prev.filter(f => f.clave !== sobra))
      setAbierta(clave)
    })
    enfocar(clave, campoDe(filas.find(f => f.clave === clave)))
  }

  /** Pliega la abierta al salir de la lista. La del buscador vacía se quita si no es la única. */
  function plegar() {
    if (abierta === null || listaRef.current?.contains(document.activeElement)) return
    const sobra = filaQueSobra(filas, abierta)
    if (sobra !== null) setFilas(prev => prev.filter(f => f.clave !== sobra))
    else if (filas.length === 1 && filas[0].nombre === '') return
    setAbierta(null)
  }
  const plegarRef = useRef(plegar)
  useEffect(() => { plegarRef.current = plegar })
  /*
   * Escucha de «salir del suplemento» (la misma de la receta). Con el puntero
   * se pliega al SOLTAR y con un `setTimeout`: plegar cambia el alto de la
   * página, y hacerlo en el `pointerdown` movería el destino antes del
   * `mouseup`. Un desplazamiento con el dedo termina en `pointercancel` y no
   * pliega. Con el teclado (Tab que sale), en el `focusin`. Las capas
   * (diálogos, alertas, listas, menús) no cuentan como fuera.
   */
  useEffect(() => {
    let abajoFuera = false
    const fuera = (t: EventTarget | null): boolean => t instanceof Element
      && !listaRef.current?.contains(t) && !accionesRef.current?.contains(t)
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

  /** «Agregar suplemento» y Ctrl/⌘+Enter: pliega la abierta y abre el buscador al final. */
  function agregar() {
    const a = filas.find(f => f.clave === abierta)
    if (a && a.nombre === '') { enfocar(a.clave, 'buscar'); return }
    const libre = filas.find(f => f.nombre === '')
    const n = libre ?? filaNueva()
    flushSync(() => {
      if (!libre) setFilas(prev => [...prev, n])
      setAbierta(n.clave)
    })
    enfocar(n.clave, 'buscar')
  }

  /** Elegir del buscador: entra con la dosis calculada por el peso de ahora. */
  function elegir(clave: number, indice: number) {
    const sup = SUPLEMENTOS[indice]
    const dosis = dosisParaForm(sup, parseFloat(pesoKg))
    flushSync(() => setFilas(prev => prev.map(f => f.clave === clave
      ? { ...f, nombre: sup.nombre, dosis, editada: false } : f)))
    enfocar(clave, dosis ? 'marca' : 'dosis')
  }

  /** Quitar: el foco va a la vecina (la siguiente, o la anterior si era la última). */
  function quitar(clave: number) {
    const i = filas.findIndex(f => f.clave === clave)
    if (i < 0) return
    const restantes = filas.filter(f => f.clave !== clave)
    const lista = restantes.length > 0 ? restantes : [filaNueva()]
    const vecina = lista[Math.min(i, lista.length - 1)]
    flushSync(() => { setFilas(lista); setAbierta(vecina.clave) })
    enfocar(vecina.clave, campoDe(vecina))
  }

  /** El catálogo secundario alterna: quita el elegido o lo añade (en la fila del buscador si la hay). */
  const toggleSup = useCallback((sup: Suplemento) => {
    setFilas(prev => {
      if (prev.some(f => f.nombre === sup.nombre)) {
        const quedan = prev.filter(f => f.nombre !== sup.nombre)
        return quedan.length > 0 ? quedan : [filaNueva()]
      }
      const nuevo = { nombre: sup.nombre, dosis: dosisParaForm(sup, parseFloat(pesoKg)), marca: '', justificacion: '', editada: false }
      const libre = prev.findIndex(f => f.nombre === '')
      return libre >= 0 ? prev.map((f, i) => (i === libre ? { ...f, ...nuevo } : f)) : [...prev, filaNueva(nuevo)]
    })
  }, [pesoKg])

  const updateSup = useCallback((clave: number, campo: 'dosis' | 'marca' | 'justificacion', val: string) => {
    setFilas(prev => prev.map(s => s.clave === clave
      ? { ...s, [campo]: val, editada: campo === 'dosis' ? true : s.editada }
      : s))
  }, [])

  /** «usar la sugerida»: la dosis vuelve a la calculada y se recalcula otra vez con el peso. */
  function usarSugerida(clave: number) {
    setFilas(prev => prev.map(f => {
      const sup = supDe(f.nombre)
      return f.clave === clave && sup ? { ...f, dosis: dosisParaForm(sup, parseFloat(pesoKg)), editada: false } : f
    }))
    enfocar(clave, 'dosis')
  }

  /**
   * S-04 — corregir el peso recalcula SOLO las dosis que nadie ha tocado, y
   * dice cuántas se conservaron. Recalcular todas borraría el trabajo manual;
   * no recalcular ninguna dejaría la hoja mintiendo sobre el peso impreso.
   */
  function cambiarPeso(val: string) {
    setPesoKg(val)
    if (seleccionados.length === 0) { setRecalculo(null); return }
    const peso = parseFloat(val)
    const conservadas = seleccionados.filter(s => s.editada).length
    setFilas(filas.map(s => {
      if (s.nombre === '' || s.editada) return s
      const sup = supDe(s.nombre)
      return sup ? { ...s, dosis: dosisParaForm(sup, peso) } : s
    }))
    setRecalculo(peso > 0
      ? { recalculadas: seleccionados.length - conservadas, conservadas }
      : null)
  }

  /** Enter en el peso lleva a la fila abierta (o a la primera). */
  function pesoEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const f = filas.find(x => x.clave === abierta) ?? filas[0]
    if (f) abrirEn(f.clave)
  }

  function abrirNotas(cual: 'notas' | 'control') {
    flushSync(() => (cual === 'notas' ? setNotasAbiertas(true) : setControlAbierto(true)))
    document.getElementById(cual === 'notas' ? 'suplementacion-notas' : 'suplementacion-control')?.focus()
  }

  // ── Validación (§3.8) ───────────────────────────────────────────
  // La de siempre: paciente, peso y al menos un suplemento. La dosis vacía se
  // dice en la línea plegada, pero —como hoy— no bloquea la impresión.
  const faltantes: { clave: string; nombre: string }[] = []
  if (!paciente.trim()) faltantes.push({ clave: 'suplementacion-paciente', nombre: 'Paciente' })
  if (!(parseFloat(pesoKg) > 0)) faltantes.push({ clave: 'suplementacion-peso', nombre: 'Peso' })
  if (seleccionados.length === 0) faltantes.push({ clave: 'suplementacion-agregar', nombre: 'Suplementos' })

  function irA(clave: string) {
    if (clave === 'suplementacion-paciente') { enfocarYAcercar(pacienteRef.current); return }
    if (clave === 'suplementacion-peso') { enfocarYAcercar(pesoRef.current); return }
    agregar()
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
    toast.info('Generando plan de suplementación...')

    // 2. Identidad — UUID v4 puro como clientId
    const clientId = crypto.randomUUID()
    // `editada` es memoria de la pantalla y no sale de ella.
    const elegidos = seleccionados.map(s => ({
      nombre: s.nombre, dosis: s.dosis, marca: s.marca, justificacion: s.justificacion,
    }))
    const contenido = { paciente, diagnostico, pesoKg, seleccionados: elegidos, notas, seguimiento, fecha }

    // El blob y el desenlace de la persistencia se leen en el finally para
    // montar el modal posterior a la generación. Ver ModalDocumentoGenerado.
    let pdfBlob: Blob | null = null
    let guardado = false
    let filaId: string | null = null
    let folio: string | null = null

    try {
      // ── 3 · LA FILA PRIMERO, porque de ella sale el folio ─────────────
      //    Invierte el orden que este formulario tenía —PDF, subida, fila—. El
      //    trigger asigna el folio en el INSERT, así que el número solo existe
      //    DESPUÉS de escribir y renderizar antes imprimía un papel sin él. Es
      //    el orden que ya seguían el consentimiento y la denegación
      //    (`20260812_documentos_estado.sql`, trampa 2).
      //
      //    ⚠ **SIGUE SIENDO CONDICIONAL A `pacienteId`**, que es lo que este
      //    formulario tiene de propio: un plan generado sin paciente no se
      //    guarda en ningún expediente, así que no hay fila ni folio, y el papel
      //    sale sin número. Ese caso no cambia.
      const supabase = offlineMode || !pacienteId ? null : createClient()
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No autenticado')

        const { data, error } = await supabase
          .from('documentos')
          .insert({
            tipo: 'plan_suplementacion',
            contenido,
            client_id: clientId,
            paciente_id: pacienteId,
            subido_por: user.id,
            // CON QUÉ CHASIS SALE EL PAPEL. La fila nace emitida, así que la
            // versión se fija aquí y a partir de este INSERT es inmutable
            // (`20260813_formato_version_inmutable.sql`). Tiene que ser el mismo
            // número que recibe `generarPdf` más abajo.
            formato_version: VERSION_DE_EMISION,
          })
          .select('id, folio')
          .single()
        if (error) throw error
        filaId = data.id
        folio = data.folio
      }
      // La fila está en el expediente —o no había expediente donde ponerla, y
      // entonces no hay nada que advertir—. Aunque el PDF falle después, el
      // documento es recuperable desde la lista con su botón de regenerar.
      guardado = true

      // ── 4 · El PDF, ya con el número que la base acaba de asignar ─────
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

      const consultorioData = consultorioActivo ? {
        nombre: consultorioActivo.nombre,
        direccion: consultorioActivo.direccion,
        telefono: consultorioActivo.telefono,
      } : undefined

      const { blob, storagePath } = await generarPdf({
        tipo: 'plan_suplementacion',
        pacienteId,
        medico: medicoData,
        data: {
          paciente, fecha: fechaFormat, diagnostico, peso,
          suplementos: elegidos.map(s => {
            const sup = SUPLEMENTOS.find(x => x.nombre === s.nombre)
            // Convertir presentacion (objeto) a string para el PDF
            const pres = sup?.presentacion
            const presTexto = pres
              ? `${pres.contenido} ${sup.unidad}/${pres.tipo}${pres.nota ? ` (${pres.nota})` : ''}`
              : null

            return {
              // La dosis que sale impresa es la del formulario, sin recalcular:
              // lo que el médico dejó escrito manda sobre lo que la fórmula
              // volvería a proponer (§2.3).
              nombre: s.nombre, dosis: s.dosis, presentacion: presTexto,
              marca: s.marca || undefined,
              beneficio_clinico: sup?.beneficio_clinico ?? '',
              beneficio_paciente: sup?.beneficio_paciente ?? '',
              justificacion: s.justificacion,
            }
          }),
          notas: notas || undefined,
          citaControl: seguimiento || undefined,
          blogQrDataUrl: blogQrDataUrl || undefined,
          // Sin fila —búnker offline o plan sin paciente— llega undefined y el
          // papel sale sin número, igual que hasta ahora.
          folio: folioImpreso('plan_suplementacion', folio),
          /*
           * LO QUE ESTE FORMULARIO PERSISTE, JUNTO A LO QUE v1 IMPRIME.
           *
           * `suplementos` de arriba es una lista enriquecida con el catálogo
           * —presentación y beneficios— que NO se guarda en la fila; lo que se
           * guarda es `seleccionados`, con lo que el médico eligió y escribió.
           * v2 lee de eso, que es lo único que existirá al regenerar. Igual el
           * peso: `peso` es la cifra que v1 rotula, `pesoKg` la que va a la fila.
           */
          seleccionados: elegidos,
          pesoKg,
          seguimiento: seguimiento || undefined,
        },
        logoUrl,
        filename: generateDocFileName(paciente, 'Plan_Suplementacion'),
        consultorio: consultorioData,
        // El mismo número que acaba de escribirse en la fila. Ver `versionQueEmite`.
        formatoVersion: versionQueEmite(offlineMode),
        // El búnker offline queda intacto: sigue entregando el PDF él mismo y
        // no monta el modal — onOfflineSave desmonta el formulario al guardar.
        entregar: !!offlineMode,
      })

      pdfBlob = blob

      // ── 5 · La ruta del archivo, sobre la fila que ya existe ──────────
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
        if (storagePath && filaId && supabase) {
          // Este UPDATE no toca ni el estado ni el folio, así que el trigger lo
          // deja pasar. No es fatal si falla: la fila está y el PDF se entrega
          // igual; lo que se pierde es la descarga desde la lista, que el botón
          // de regenerar repone.
          const { error } = await supabase
            .from('documentos')
            .update({ pdf_url: storagePath })
            .eq('id', filaId)
          if (error) console.error('[PlanSuplementacionForm] update pdf_url:', error.message)
        }
        if (!pacienteId) {
          toast.success('Plan generado')
        } else {
          toast.success(folio ? `Plan de suplementación guardado · ${folio}` : 'Plan de suplementación guardado')
        }
      }
    } catch (err) {
      // Tres desenlaces, y el del medio es nuevo: con la fila escrita antes que
      // el PDF, un fallo de render deja un documento emitido y un folio
      // consumido. Decirlo con el número delante es lo que permite encontrarlo
      // en la lista y recuperar el PDF desde ahí.
      let msg: string
      if (offlineMode || !pacienteId) {
        msg = 'No se pudo generar el PDF. Intenta de nuevo.'
      } else if (filaId === null) {
        msg = 'No se pudo guardar el plan, así que no se generó el PDF. Intenta de nuevo.'
      } else {
        msg = `El plan quedó registrado${folio ? ` con folio ${folio}` : ''}, pero no se pudo generar `
          + 'el PDF. Búscalo en la lista de documentos del paciente y recupéralo desde ahí.'
      }
      setErrorGuardado(msg)
      setErrorAbierto(true)
      // eslint-disable-next-line no-console
      console.error('[PlanSuplementacionForm] imprimir falló:', err)
    } finally {
      setImprimiendo(false)
      // También cuando la persistencia falló: el PDF existe y con el paciente
      // enfrente lo urgente es poder imprimirlo.
      if (pdfBlob && !offlineMode) { setDocGenerado({ blob: pdfBlob, guardado, documentoId: filaId }) }
    }
  }

  const senalar = (clave: string) => intentado && faltantes.some(f => f.clave === clave)
  const conPeso = parseFloat(pesoKg) > 0
  const pesoN = pesoNumerico(pesoKg)
  const notasVisibles = notasAbiertas || notas.trim() !== ''
  const controlVisible = controlAbierto || seguimiento.trim() !== ''

  /** Los nueve para el buscador: la dosis que entraría con el peso de ahora. */
  const opciones: OpcionSuplemento[] = SUPLEMENTOS.map(s => ({
    nombre: s.nombre,
    dosis: dosisParaForm(s, pesoN) || (s.dosis_por_kg ?? s.dosis_default),
    beneficio: s.beneficio_clinico,
    ya: filas.some(f => f.nombre === s.nombre),
  }))

  /** Referencia del cálculo por peso del abierto; sin dosificación por kilo o sin peso, nada. */
  function calculoDe(f: Fila): { texto: string; editada: boolean } | null {
    const sup = supDe(f.nombre)
    if (!sup?.min_kg || !sup.dosis_por_kg || !(pesoN > 0)) return null
    const sugerida = dosisParaForm(sup, pesoN)
    const distinta = f.editada && f.dosis.trim() !== sugerida
    return { texto: textoCalculo(distinta, pesoN, sugerida, sup.dosis_por_kg), editada: distinta }
  }

  return (
    <div ref={formRef} className="sp-doc-form">
      {/* El árbol del formulario NO se desmonta cuando el panel de plantillas
          está abierto: se apaga con display:none y el panel se monta como
          hermano, en el mismo contenedor de scroll (spec 02 §3.1). */}
      <div className="sp-doc-formbody" style={plantillas.panelAbierto ? { display: 'none' } : undefined}>

      {plantillas.selector}

      {/* Datos del paciente en una fila (maqueta aprobada; campos de §26.1). El
          peso vive aquí y no en los suplementos: es dato del paciente (§1). Su
          área de escritura mide ≥ 72 px en todos los formatos (§26.8). */}
      <section className="sp-card sp-doc-card sp-sup">
        <div className="sp-doc-cardhead">
          <h2 className="sp-label">Datos del paciente</h2>
        </div>
        <div className="sp-doc-cardbody sp-hon-cuerpo">
          <div className="sp-hon-datos sp-sup-datos">
            <div className={`sp-rx-campo${senalar('suplementacion-paciente') ? ' sp-rx-campo--falta' : ''}`}>
              <label htmlFor="suplementacion-paciente" className="sp-rx-rot">
                Paciente<span aria-hidden="true" className="sp-int-ob">*</span><span className="sr-only"> obligatorio</span>
              </label>
              <input ref={pacienteRef} id="suplementacion-paciente" type="text" value={paciente} autoComplete="off"
                onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo"
                aria-invalid={senalar('suplementacion-paciente') || undefined} className="sp-rx-fi" />
            </div>
            <div className="sp-rx-campo">
              <label htmlFor="suplementacion-diagnostico" className="sp-rx-rot">Dx</label>
              <input id="suplementacion-diagnostico" type="text" value={diagnostico} autoComplete="off"
                onChange={e => setDiagnostico(e.target.value)} placeholder="Diagnóstico principal"
                aria-label="Diagnóstico" className="sp-rx-fi" />
            </div>
            <div className={`sp-rx-campo sp-sup-peso${senalar('suplementacion-peso') ? ' sp-rx-campo--falta' : ''}`}>
              <label htmlFor="suplementacion-peso" className="sp-rx-rot">
                Peso<span aria-hidden="true" className="sp-int-ob">*</span><span className="sr-only"> en kilos, obligatorio</span>
              </label>
              <input ref={pesoRef} id="suplementacion-peso" type="number" inputMode="decimal" value={pesoKg}
                onChange={e => cambiarPeso(e.target.value)} onKeyDown={pesoEnter} placeholder="Ej: 75"
                min="20" max="300" step="0.5" autoComplete="off"
                aria-invalid={senalar('suplementacion-peso') || undefined}
                className="sp-rx-fi sp-sup-pesofi" />
              <span className="sp-sup-kg" aria-hidden="true">kg</span>
            </div>
            <div className="sp-rx-campo">
              <label htmlFor="suplementacion-fecha" className="sp-rx-rot">Fecha</label>
              <input id="suplementacion-fecha" type="date" value={fecha}
                min={FECHA_MIN} max={desplazarFecha(hoyEnTZ(TZ_CLINICA), { anios: 1 })}
                onChange={e => setFecha(e.target.value)} className="sp-rx-fi" />
            </div>
          </div>
          <p className="sp-hon-nota">
            {pacienteInicial && 'Paciente de la ficha · editable. '}
            {diagnosticoInicial && 'Dx del diagnóstico de la consulta. '}
            El peso calcula las dosis.
          </p>

          {recalculo && (
            <p className="sp-banner sp-banner--info" aria-live="polite">
              {textoRecalculo(recalculo.recalculadas, recalculo.conservadas)}
            </p>
          )}
        </div>
      </section>

      {/* Plan compacto (maqueta aprobada, patrón de la receta): un suplemento
          abierto, los demás plegados a una línea; un buscador sobre los nueve.
          El catálogo con su beneficio clínico queda como vista secundaria. */}
      <section className="sp-card sp-doc-card sp-rx">
        <div className="sp-doc-cardhead">
          <div className="sp-icobox sp-icobox--sm"><ClipboardList /></div>
          <h2 className="sp-label">Suplementos</h2>
        </div>
        <div className="sp-doc-cardbody sp-rx-cuerpo">
          <div ref={listaRef} className="sp-rx-meds">
            {filas.map((f, i) => {
              const sup = supDe(f.nombre)
              return f.clave === abierta ? (
                <SuplementoAbierto key={f.clave} numero={i + 1} clave={f.clave}
                  nombre={f.nombre} dosis={f.dosis} marca={f.marca} justificacion={f.justificacion}
                  beneficio={sup?.beneficio_clinico ?? ''} calculo={calculoDe(f)} conPeso={conPeso}
                  opciones={opciones} invalido={senalar('suplementacion-agregar')}
                  puedeQuitar={filas.length > 1 || f.nombre !== ''}
                  onElegir={ix => elegir(f.clave, ix)}
                  onCampo={(campo, val) => updateSup(f.clave, campo, val)}
                  onUsarSugerida={() => usarSugerida(f.clave)}
                  onQuitar={() => quitar(f.clave)} onAgregar={agregar} />
              ) : f.nombre !== '' && (
                <LineaSuplemento key={f.clave} numero={i + 1} nombre={f.nombre} marca={f.marca}
                  dosis={f.dosis} justificacion={f.justificacion} onAbrir={() => abrirEn(f.clave)} />
              )
            })}
          </div>
        </div>
        <div ref={accionesRef} className="sp-rx-agregar sp-sup-acciones">
          <button id="suplementacion-agregar" type="button" onClick={agregar} className="k-b k-b-tonal sp-rx-agregar-b">
            <Plus aria-hidden="true" /> Agregar suplemento
            <span className="sp-rx-atajo" aria-hidden="true"><kbd>Ctrl</kbd><kbd>Enter</kbd></span>
          </button>
          <button type="button" aria-haspopup="dialog" onClick={() => setCatalogoAbierto(true)} className="k-b k-b-texto">
            Ver catálogo <span className="tabular-nums text-tinta2">· {seleccionados.length} de {SUPLEMENTOS.length}</span>
          </button>
        </div>
      </section>

      <CatalogoSuplementos abierto={catalogoAbierto} onCerrar={() => setCatalogoAbierto(false)}
        elegidos={seleccionados} onToggle={toggleSup} />

      {/* Notas y cita de control: ocultas tras «＋ …» mientras están vacías;
          con valor (de una plantilla, o ya escritas) se ven solas. */}
      {(notasVisibles || controlVisible) && (
        <section className="sp-card sp-doc-card">
          <div className="sp-doc-cardhead">
            <h2 className="sp-label">Notas y control</h2>
          </div>
          <div className="sp-doc-cardbody sp-hon-cuerpo">
            {notasVisibles && (
              <div className="sp-rx-campo sp-rx-campo--texto">
                <label htmlFor="suplementacion-notas" className="sp-rx-rot">Notas</label>
                <textarea id="suplementacion-notas" rows={2} value={notas} onChange={e => setNotas(e.target.value)}
                  aria-label="Notas adicionales" placeholder="Indicaciones generales…" className="sp-rx-fi sp-hon-notas" />
              </div>
            )}
            {controlVisible && (
              <div className="sp-rx-campo">
                <label htmlFor="suplementacion-control" className="sp-rx-rot">Control</label>
                <input id="suplementacion-control" type="text" value={seguimiento} autoComplete="off"
                  onChange={e => setSeguimiento(e.target.value)} aria-label="Cita de control"
                  placeholder="Ej: En 3 meses con nuevos laboratorios" className="sp-rx-fi" />
              </div>
            )}
          </div>
        </section>
      )}
      {(!notasVisibles || !controlVisible) && (
        <div className="sp-hon-mas sp-sup-mas">
          {!notasVisibles && (
            <button type="button" onClick={() => abrirNotas('notas')} className="k-b k-b-texto">
              <Plus aria-hidden="true" size={16} /> Notas
            </button>
          )}
          {!controlVisible && (
            <button type="button" onClick={() => abrirNotas('control')} className="k-b k-b-texto">
              <Plus aria-hidden="true" size={16} /> Cita de control
            </button>
          )}
        </div>
      )}

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
            {faltantes.length === 1 ? 'Falta 1 campo' : `Faltan ${faltantes.length} campos`}:{' '}
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
        titulo="Plan de suplementación generado"
        guardadoEnExpediente={docGenerado?.guardado ?? false}
        documentoId={docGenerado?.documentoId ?? null}
      />
    </div>
  )
}

/**
 * El catálogo de nueve con palomitas (CALMA §20; maqueta docs-b, vista 5). Cada
 * fila alterna la selección con la MISMA `toggleSup` que la casilla de la
 * tarjeta: elegir aquí añade el suplemento con su dosis calculada, desmarcar lo
 * quita. El beneficio clínico va entero (la maqueta lo acota con «Ver
 * completo»; entero no pierde nada y se ahorra la medición).
 */
function CatalogoSuplementos({ abierto, onCerrar, elegidos, onToggle }: {
  abierto: boolean; onCerrar: () => void; elegidos: SupSelec[]; onToggle: (sup: Suplemento) => void
}) {
  return (
    <ModalShell open={abierto} onClose={onCerrar} title="Suplementos"
      subtitle={`${elegidos.length} de ${SUPLEMENTOS.length}`}>
      <ul className="flex flex-col divide-y divide-linea px-6 pb-3 ext:px-5">
        {SUPLEMENTOS.map(sup => {
          const on = elegidos.some(s => s.nombre === sup.nombre)
          return (
            <li key={sup.nombre}>
              <button type="button" role="checkbox" aria-checked={on} onClick={() => onToggle(sup)}
                className="k-pulsable flex min-h-[52px] w-full items-start gap-3 py-2.5 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold leading-[22px] text-tinta">{sup.nombre}</span>
                  <span className="block text-[13px] leading-[18px] tabular-nums text-tinta2">{sup.dosis_por_kg ?? sup.dosis_default}</span>
                  <span className="mt-0.5 block text-[13px] leading-[18px] text-tinta2">{sup.beneficio_clinico}</span>
                </span>
                <Check size={20} aria-hidden="true" className={`mt-1 shrink-0 text-enlace ${on ? '' : 'opacity-0'}`} />
              </button>
            </li>
          )
        })}
      </ul>
    </ModalShell>
  )
}
