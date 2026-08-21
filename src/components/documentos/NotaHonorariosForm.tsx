'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, EyeOff, Plus, Printer, Receipt, Trash2 } from 'lucide-react'
import { flushSync } from 'react-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { generateDocFileName } from '@/lib/patientUtils'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { generarPdf, VERSION_DE_EMISION, versionQueEmite } from '@/lib/mobileShare'
import { useToast } from '@/components/ui/Toast'
import ModalDocumentoGenerado from '@/components/documentos/ModalDocumentoGenerado'
import ComboEscribible from '@/components/documentos/ComboEscribible'
import { usePlantillasDocumento, type ContenidoPlantilla } from '@/components/documentos/PlantillasDocumento'
import { folioImpreso } from '@/lib/documentos/folio'
import { createClient } from '@/lib/supabase/client'
import { hoyEnTZ, desplazarFecha, TZ_CLINICA } from '@/lib/dates'
import { enfocarYAcercar } from '@/lib/scrollDoc'
import type { AseguradoraInfo } from '@/types'

/**
 * Recibo de honorarios y cotización — GUIA_FORM_HONORARIOS.md.
 *
 * ── DOS DOCUMENTOS, UN COMPONENTE ───────────────────────────────────────────
 * Son trece diferencias medidas (guía §3) y ninguna justifica un segundo
 * archivo: escribir la cotización, cobrarla y emitir el recibo son el mismo
 * trámite con diez minutos de diferencia, y dos archivos serían dos sitios
 * donde arreglar el mismo defecto. Las diferencias viven en `esCotizacion` y en
 * `data-tipo` del CSS; no hay una segunda rama de componente en ningún sitio.
 *
 * **Cambiar de tipo no borra nada.** Los campos del otro tipo siguen en este
 * mismo estado; solo dejan de mostrarse y de imprimirse. Y se DECLARA: la
 * franja de §4.6 dice cuáles se conservaron y con qué valores, porque ocultar
 * sin avisar deja al médico sin saber si lo que escribió sigue ahí.
 */

type TipoDoc = 'honorarios' | 'cotizacion'
type Divisa = 'MXN' | 'USD'

interface LineaConcepto {
  id: number
  concepto: string
  /** Solo cotización. Texto libre: los subtotales agrupan por lo escrito. */
  origen: string
  precio: number
}

const FECHA_MIN = '1900-01-01'

const FORMAS_PAGO = [
  'Efectivo', 'Transferencia bancaria', 'Tarjeta de crédito', 'Tarjeta de débito', 'Cheque',
] as const

/**
 * Sugerencias de origen, ordenadas por quién cobra. **No es una lista cerrada**
 * (§4.3): ninguna aguanta la facturación real. El campo acepta texto libre
 * encima y los subtotales agrupan por el texto tal cual, así que un origen
 * escrito a mano genera su propio subtotal.
 */
const ORIGENES = [
  'Honorarios médicos', 'Hospital', 'Anestesiólogo', 'Material e implantes',
] as const

/** Etiqueta del subtotal de las líneas que no dicen de quién es el cobro. */
const SIN_ORIGEN = 'Sin origen'

/**
 * `.sp-select` con las 20 aseguradoras y `Otra` (§4.5), en vez del `<datalist>`
 * que había: no filtra igual en Safari iOS y no se lee como campo con opciones.
 */
const ASEGURADORAS = [
  'MetLife', 'GNP Seguros', 'AXA Seguros', 'Quálitas',
  'Seguros Monterrey New York Life', 'Banorte Seguros', 'Mapfre', 'Inbursa',
  'Zurich', 'Seguros Atlas', 'Allianz', 'ABA Seguros (Chubb)', 'Afirme', 'Bupa',
  'Plan Seguro', 'La Latinoamericana', 'General de Salud', 'Multiva',
  'HDI Seguros', 'Pan-American México',
] as const

/** Centinela del `<option>` que abre el campo de texto. No es una aseguradora. */
const OTRA = '__otra__'

const ASEGURADORA_VACIA: AseguradoraInfo = { nombre: '', poliza: '', cobertura: '' }

/**
 * Vigencias en días. Prellenada a 30 y por eso **nunca entra en los faltantes**:
 * la cotización siempre sale con una, como sale con fecha. Es obligatoria en el
 * sentido de la guía —la cotización no se emite sin ella—, no en el de un campo
 * que el médico pueda dejar en blanco.
 */
const VIGENCIAS = [15, 30, 60, 90] as const
const VIGENCIA_INICIAL = 30

const LINEA_VACIA = { concepto: '', origen: '', precio: 0 } as const

function roundCurrency(n: number): number {
  return Math.round(n * 100) / 100
}

function fmt(n: number, divisa: Divisa): string {
  return roundCurrency(n).toLocaleString(divisa === 'MXN' ? 'es-MX' : 'en-US', {
    style: 'currency',
    currency: divisa,
  })
}

/**
 * Un importe, tal y como se teclea.
 *
 * **Acepta la coma como separador decimal.** En México se teclea el punto, pero
 * la coma sale sola de algunos teclados del sistema y de quien viene de Excel;
 * rechazar la cifra por eso es peor que normalizarla, porque el médico no ve
 * qué carácter escribió, ve que el precio no entra.
 *
 * ⚠️ Y ACEPTARLA OBLIGA A DECIDIR LOS MILLARES. Si la coma fuera siempre
 * decimal, `30,000` valdría 30 y el recibo saldría con tres ceros de menos. La
 * regla, que es la que usa un humano al leer: **el último separador es decimal
 * solo si lo siguen uno o dos dígitos**; cualquier otro es de millares y se
 * descarta. Así `30,000.00`, `30,000`, `12,5` y `1.234.567` se leen todos como
 * se ven.
 *
 * Consecuencia declarada: `12.345` se lee 12 345 y no 12.345, porque aquí el
 * dinero tiene dos decimales y el importe de tres cifras es el caso real.
 *
 * Lo que no es dígito ni separador se descarta, así que el campo no puede
 * acabar con letras dentro. El signo se descarta con lo demás y por eso no hay
 * importes negativos: aquí no existe el cobro en negativo.
 */
function aImporte(texto: string): number {
  const limpio = texto.replace(/[^0-9.,]/g, '')
  const decimal = /[.,](\d{1,2})$/.exec(limpio)
  const entero = (decimal ? limpio.slice(0, decimal.index) : limpio).replace(/[.,]/g, '')
  const n = parseFloat(decimal ? `${entero}.${decimal[1]}` : entero)
  return Number.isFinite(n) && n > 0 ? roundCurrency(n) : 0
}

function fechaLarga(iso: string): string {
  return format(new Date(`${iso}T12:00:00`), "d 'de' MMMM 'de' yyyy", { locale: es })
}

/** Una línea cuenta como escrita cuando tiene concepto o precio. */
function conTexto(l: LineaConcepto): boolean {
  return l.concepto.trim() !== '' || l.origen.trim() !== '' || l.precio > 0
}

/** Lo que llega al documento: concepto con precio. Precio 0 es «sin escribir». */
function esEmitible(l: LineaConcepto): boolean {
  return l.concepto.trim() !== '' && l.precio > 0
}

/**
 * Un subtotal por origen usado, en orden de aparición (§4.4). Agrupa por el
 * texto tal cual: es lo que hace que un origen escrito a mano tenga el suyo.
 */
function subtotalesDe(lineas: LineaConcepto[]): { origen: string; total: number }[] {
  const acc = new Map<string, number>()
  for (const l of lineas) {
    if (!esEmitible(l)) continue
    const clave = l.origen.trim() || SIN_ORIGEN
    acc.set(clave, roundCurrency((acc.get(clave) ?? 0) + l.precio))
  }
  return [...acc].map(([origen, total]) => ({ origen, total }))
}

/** Lee una línea guardada en jsonb desconfiando de todo: el contenido pudo
 *  escribirse con otra versión del formulario. */
function leerLinea(bruto: unknown, id: number): LineaConcepto | null {
  if (typeof bruto !== 'object' || bruto === null) return null
  const fila = bruto as Record<string, unknown>
  const texto = (v: unknown): string => (typeof v === 'string' ? v : '')
  const precio = typeof fila.precio === 'number' && Number.isFinite(fila.precio)
    ? roundCurrency(Math.max(0, fila.precio))
    : 0
  const l: LineaConcepto = { id, concepto: texto(fila.concepto), origen: texto(fila.origen), precio }
  return conTexto(l) ? l : null
}

/**
 * Predicado único de «formulario vacío». Mismo criterio que los otros siete: lo
 * que llegó prellenado NO cuenta como escrito hasta que se edita —el paciente
 * de la ficha, la fecha, la divisa, la forma de pago y la vigencia—.
 *
 * El TIPO DE DOCUMENTO queda fuera a propósito: elegir «Cotización» sin
 * escribir nada no es haber llenado nada, y si contara, el selector de tipo del
 * host preguntaría antes de descartar un formulario que está vacío.
 */
function isFormEmpty(
  lineas: LineaConcepto[], notas: string, paciente: string, pacienteInicial: string,
  formaPago: string, divisa: Divisa, vigenciaDias: number,
  anticipo: number, aseguradora: AseguradoraInfo | null,
): boolean {
  const pacienteIntacto = paciente.trim() === '' || paciente.trim() === pacienteInicial.trim()
  return (
    pacienteIntacto
    && notas.trim() === ''
    && !lineas.some(conTexto)
    && formaPago === FORMAS_PAGO[0]
    && divisa === 'MXN'
    && vigenciaDias === VIGENCIA_INICIAL
    && anticipo === 0
    && aseguradora === null
  )
}

interface Props {
  pacienteInicial?: string
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

export default function NotaHonorariosForm({
  pacienteInicial = '', pacienteId, offlineMode, onOfflineSave,
  onVacioChange, onPanelPlantillasChange,
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

  // ─── Estado ────────────────────────────────────────────────────────────────
  const [tipoDoc, setTipoDoc]         = useState<TipoDoc>('honorarios')
  const [paciente, setPaciente]       = useState(pacienteInicial)
  // `TZ_CLINICA` explícito, no el huso del dispositivo: este inicializador de
  // `useState` corre TAMBIÉN en la pasada de SSR, donde `tzDispositivo()`
  // devolvería UTC de Vercel y el cliente lo corregiría al hidratar — fecha
  // parpadeante en un formulario que emite un documento legal. Y la fecha del
  // documento es de la clínica de todos modos (LA REGLA, en `@/lib/dates`).
  const [fecha, setFecha]             = useState(hoyEnTZ(TZ_CLINICA))
  const [vigenciaDias, setVigencia]   = useState<number>(VIGENCIA_INICIAL)
  const [lineas, setLineas]           = useState<LineaConcepto[]>([{ id: 1, ...LINEA_VACIA }])
  const [nextId, setNextId]           = useState(2)
  const [divisa, setDivisa]           = useState<Divisa>('MXN')
  const [formaPago, setFormaPago]     = useState<string>(FORMAS_PAGO[0])
  const [anticipo, setAnticipo]       = useState(0)
  const [notas, setNotas]             = useState('')
  const [aseguradora, setAseguradora] = useState<AseguradoraInfo | null>(null)
  /**
   * Lo tecleado en un campo de importe MIENTRAS se teclea, por clave de campo.
   * El estado de verdad sigue siendo el número; esto es solo lo que se ve en el
   * campo hasta salir de él.
   *
   * Existe porque un importe a medio escribir no es un importe: «12,» y «1.2.3»
   * se escriben de paso. Guardarlo aparte es lo que permite no bloquear ninguna
   * tecla —con teclas bloqueadas, borrar y corregir se vuelve incómodo— y aun
   * así no dejar que entre basura en el número.
   */
  const [borradores, setBorradores]   = useState<Record<string, string>>({})
  // «Otra» no se puede derivar del nombre: recién elegida, el nombre está vacío
  // y el select volvería solo a «— Elegir —» con el campo de texto abierto.
  const [otraAseguradora, setOtra]    = useState(false)

  const [imprimiendo, setImprimiendo]     = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [docGenerado, setDocGenerado]     = useState<{ blob: Blob; guardado: boolean; documentoId: string | null } | null>(null)
  // El banner de faltantes NO existe hasta el primer intento de imprimir: un
  // formulario recién abierto no acusa de nada. Después permanece y se
  // actualiza en vivo.
  const [intentado, setIntentado] = useState(false)

  const formRef     = useRef<HTMLDivElement>(null)
  const pacienteRef = useRef<HTMLInputElement>(null)

  // ─── Derivados ─────────────────────────────────────────────────────────────
  const esCotizacion  = tipoDoc === 'cotizacion'
  const nombreCorto   = esCotizacion ? 'cotización' : 'recibo'
  const lineasValidas = lineas.filter(esEmitible)
  const total         = roundCurrency(lineasValidas.reduce((s, l) => s + l.precio, 0))
  const subtotales    = subtotalesDe(lineas)
  const saldo         = roundCurrency(total - anticipo)
  const vigenciaHasta = desplazarFecha(fecha, { dias: vigenciaDias })
  const simbolo       = divisa === 'MXN' ? '$' : 'US$'

  const vacio = isFormEmpty(
    lineas, notas, paciente, pacienteInicial,
    formaPago, divisa, vigenciaDias, anticipo, aseguradora,
  )
  useEffect(() => { onVacioChange?.(vacio) }, [vacio, onVacioChange])

  // ── Plantillas (spec 02) ────────────────────────────────────────
  // Se guarda TODO menos los datos del paciente. Aquí eso deja fuera al
  // paciente, la fecha, el anticipo —dinero que ESTE paciente ya pagó— y el
  // seguro entero, que lleva el número de póliza y es dato suyo aunque lo
  // teclee el médico.
  const plantillas = usePlantillasDocumento({
    tipo: 'nota_honorarios',
    vacio,
    // El búnker no tiene red ni sesión de Supabase: el sistema no se monta.
    desactivado: !!offlineMode,
    onPanelChange: onPanelPlantillasChange,
    leer: () => ({
      _v: 1,
      tipo_doc: tipoDoc,
      lineas: lineas.filter(conTexto).map(l => ({ concepto: l.concepto, origen: l.origen, precio: l.precio })),
      divisa,
      forma_pago: formaPago,
      vigencia_dias: vigenciaDias,
      notas,
    }),
    aplicar: (c: ContenidoPlantilla) => {
      // Solo las claves que existen HOY, comprobando el tipo de cada una. Los
      // valores de repuesto NO son defensa de sobra: «Vaciar formulario» aplica
      // un contenido sin ninguna clave, así que son justo lo que repone el
      // estado inicial.
      const guardadas = Array.isArray(c.lineas)
        ? c.lineas.map((x, i) => leerLinea(x, i + 1)).filter((l): l is LineaConcepto => l !== null)
        : []
      setLineas(guardadas.length > 0 ? guardadas : [{ id: 1, ...LINEA_VACIA }])
      setNextId(Math.max(2, guardadas.length + 1))
      // Los borradores de importe son de lo que había ANTES: dejarlos taparía
      // los precios recién aplicados con lo que se estaba tecleando.
      setBorradores({})
      setDivisa(c.divisa === 'USD' ? 'USD' : 'MXN')
      setFormaPago(typeof c.forma_pago === 'string' && c.forma_pago !== '' ? c.forma_pago : FORMAS_PAGO[0])
      setVigencia(typeof c.vigencia_dias === 'number' ? c.vigencia_dias : VIGENCIA_INICIAL)
      setNotas(typeof c.notas === 'string' ? c.notas : '')
      // EXCEPCIÓN DECLARADA: el tipo solo se toca si la plantilla trae uno. Una
      // plantilla de cotización lo es entera —vigencia y orígenes incluidos— y
      // aplicarla sin cambiar el tipo dejaría esos campos escritos y ocultos;
      // pero «Vaciar formulario» limpia el CONTENIDO, no la decisión de qué
      // documento estoy emitiendo, y por eso no lo devuelve a recibo.
      if (c.tipo_doc === 'cotizacion' || c.tipo_doc === 'honorarios') setTipoDoc(c.tipo_doc)
    },
  })

  // G-10: foco al primer campo editable vacío al montar. preventScroll para no
  // arrastrar la página hasta él. En móvil esto abre el teclado en cada montaje.
  useEffect(() => {
    const primero = formRef.current?.querySelector<HTMLElement>('input:not([type="date"]), textarea')
    if (primero instanceof HTMLInputElement && !primero.value) primero.focus({ preventScroll: true })
  }, [])

  // ─── Operaciones de línea ──────────────────────────────────────────────────
  function agregarLinea(): void {
    setLineas(prev => [...prev, { id: nextId, ...LINEA_VACIA }])
    setNextId(n => n + 1)
  }

  function eliminarLinea(id: number): void {
    setLineas(prev => (prev.length === 1 ? prev : prev.filter(l => l.id !== id)))
  }

  function updateLinea(id: number, campo: 'concepto' | 'origen', valor: string): void {
    setLineas(prev => prev.map(l => (l.id === id ? { ...l, [campo]: valor } : l)))
  }

  // ─── Campos de importe ─────────────────────────────────────────────────────
  // Se ACEPTA todo lo que se teclee y se limpia al salir del campo. Ninguna
  // tecla se bloquea: un campo que rechaza pulsaciones hace incómodo borrar y
  // corregir, que es lo que más se hace al escribir una cifra.

  /** Lo que muestra el campo: lo tecleado si se está escribiendo, el número si no. */
  function importeVisible(clave: string, valor: number): string {
    return borradores[clave] ?? (valor === 0 ? '' : String(valor))
  }

  /** Mientras se escribe, el número sigue al borrador: el total no se congela. */
  function escribirImporte(clave: string, texto: string, aplicar: (n: number) => void): void {
    setBorradores(prev => ({ ...prev, [clave]: texto }))
    aplicar(aImporte(texto))
  }

  /** Al salir del campo se retira el borrador y queda a la vista el número ya
   *  normalizado: «12,50» se ve como «12.5» y «30 000 pesos» como «30000». */
  function limpiarImporte(clave: string): void {
    setBorradores(prev => {
      if (!(clave in prev)) return prev
      const resto = { ...prev }
      delete resto[clave]
      return resto
    })
  }

  function campoAseguradora(campo: keyof AseguradoraInfo, valor: string): void {
    setAseguradora(prev => ({ ...(prev ?? ASEGURADORA_VACIA), [campo]: valor }))
  }

  function elegirAseguradora(valor: string): void {
    setOtra(valor === OTRA)
    campoAseguradora('nombre', valor === OTRA ? '' : valor)
  }

  // ─── Validación (§3.8) ─────────────────────────────────────────────────────
  const faltantes: { clave: string; nombre: string }[] = []
  if (!paciente.trim()) faltantes.push({ clave: 'honorarios-paciente', nombre: 'Paciente' })
  if (lineasValidas.length === 0) faltantes.push({ clave: 'honorarios-concepto-0', nombre: 'Conceptos' })

  function irA(clave: string): void {
    if (clave === 'honorarios-paciente') { enfocarYAcercar(pacienteRef.current); return }
    enfocarYAcercar(formRef.current?.querySelector<HTMLElement>(`#${clave}`) ?? null)
  }

  const senalar = (clave: string): boolean => intentado && faltantes.some(f => f.clave === clave)

  // ─── Imprimir / persistir ──────────────────────────────────────────────────
  async function imprimir(): Promise<void> {
    // El primario nunca está gris por faltantes: un botón apagado no enseña qué
    // falta, el banner sí. Al pulsar con faltantes no emite y lleva al primero.
    if (faltantes.length > 0) {
      setIntentado(true)
      irA(faltantes[0].clave)
      return
    }
    flushSync(() => { setErrorGuardado(''); setImprimiendo(true) })
    toast.info(esCotizacion ? 'Generando cotización…' : 'Generando recibo…')

    const clientId = crypto.randomUUID()
    // Lo que se guarda es el documento EMITIDO, no el estado del formulario: los
    // campos del otro tipo se conservan en pantalla (§4.6) y no viajan a la
    // fila, donde significarían que este papel los lleva y no los lleva.
    // El FOLIO no está aquí: lo asigna la base en el trigger BEFORE INSERT, con
    // prefijo NOH o COT según este mismo `tipo_doc` (§4.1).
    const contenido: Record<string, unknown> = {
      paciente,
      fecha,
      tipo_doc: tipoDoc,
      lineas: lineasValidas.map(l => (esCotizacion
        ? { concepto: l.concepto, origen: l.origen, precio: l.precio }
        : { concepto: l.concepto, precio: l.precio })),
      monto: total,
      divisa,
      notas,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...(esCotizacion
        ? {
          vigencia_dias: vigenciaDias,
          vigencia_hasta: vigenciaHasta,
          subtotales,
          aseguradora,
        }
        : {
          forma_pago: formaPago,
          anticipo,
          saldo,
        }),
    }

    // El blob y el desenlace de la persistencia se leen en el finally para
    // montar el modal posterior a la generación. Ver ModalDocumentoGenerado.
    let pdfBlob: Blob | null = null
    let guardado = false
    let filaId: string | null = null
    let folio: string | null = null

    try {
      // ── LA FILA PRIMERO, porque de ella sale el folio ─────────────────
      //    Invierte el orden que este formulario tenía —PDF, subida, fila—. El
      //    trigger asigna el folio en el INSERT, y aquí decide además la SERIE
      //    leyendo `contenido->>tipo_doc`: NOH o COT (§4.1). El número solo
      //    existe DESPUÉS de escribir, así que renderizar antes imprimía un
      //    papel sin él — y este formulario ya enseñaba «Se asigna al emitir» en
      //    su campo de folio, prometiendo un número que el papel no llevaba.
      //
      //    Va con el cliente de SESIÓN del médico, nunca con privilegios de
      //    servicio: el trigger exenta por completo a quien no trae JWT.
      const supabase = offlineMode ? null : createClient()
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No autenticado')

        const insertPayload: Record<string, unknown> = {
          tipo: 'nota_honorarios',
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
        tipo: 'nota_honorarios',
        pacienteId,
        medico: medicoData,
        data: {
          paciente,
          fecha: fechaLarga(fecha),
          tipoDoc,
          lineas: lineasValidas.map(l => (esCotizacion
            ? { concepto: l.concepto, origen: l.origen, precio: l.precio }
            : { concepto: l.concepto, precio: l.precio })),
          total,
          divisa,
          notas: notas || undefined,
          // En el búnker offline no hay fila ni base, así que llega undefined y
          // el papel sale sin número, igual que hasta ahora.
          folio: folioImpreso('nota_honorarios', folio),
          /*
           * LOS DOS NOMBRES DE LO MISMO, Y VIAJAN LOS DOS.
           *
           * `tipoDoc` y `total` son los que lee el renderizador v1; `tipo_doc` y
           * `monto` son los que este formulario PERSISTE, y por tanto los únicos
           * que existen al regenerar. El adaptador de v2 lee de los segundos —ver
           * su cabecera—, así que aquí se añaden en vez de sustituirse: el búnker
           * sigue emitiendo con v1 y necesita los primeros.
           */
          tipo_doc: tipoDoc,
          monto: total,
          // Las seis diferencias nuevas viajan; el renderizador v1 imprime hoy
          // las que ya conocía. v2 las compone todas: la vigencia la redacta su
          // adaptador desde estas dos claves, no desde la cadena de v1.
          ...(esCotizacion
            ? {
              vigencia: `${vigenciaDias} días · hasta ${fechaLarga(vigenciaHasta)}`,
              vigencia_dias: vigenciaDias,
              vigencia_hasta: vigenciaHasta,
              subtotales,
              aseguradora,
            }
            : {
              formaPago,
              forma_pago: formaPago,
              anticipo,
              saldo,
            }),
        },
        logoUrl,
        filename: generateDocFileName(paciente, esCotizacion ? 'Cotizacion' : 'Nota_Honorarios'),
        consultorio: consultorioData,
        // El mismo número que acaba de escribirse en la fila. Ver `versionQueEmite`.
        formatoVersion: versionQueEmite(offlineMode),
        // El búnker offline queda intacto: sigue entregando el PDF él mismo y
        // no monta el modal — onOfflineSave desmonta el formulario al guardar.
        entregar: !!offlineMode,
      })

      pdfBlob = blob

      // La ruta del archivo, sobre la fila que ya existe.
      if (offlineMode) {
        const { addDocument } = await import('@/lib/offline/db')
        const { getOfflineIdentity } = await import('@/lib/offline/identity')
        await addDocument({
          id: crypto.randomUUID(),
          temp_patient_id: pacienteId ?? 'unknown',
          tipo: 'nota_honorarios',
          contenido,
          created_at: new Date().toISOString(),
          medico_id: getOfflineIdentity()?.userId ?? 'anonymous',
          _syncStatus: 'pending',
        })
        toast.success(esCotizacion
          ? 'Cotización guardada en bunker offline'
          : 'Recibo guardado en bunker offline')
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
          if (error) console.error('[NotaHonorariosForm] update pdf_url:', error.message)
        }
        const nombreDoc = esCotizacion ? 'Cotización guardada' : 'Recibo guardado'
        toast.success(folio ? `${nombreDoc} · ${folio}` : nombreDoc)
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
        msg = 'No se pudo guardar el documento, así que no se generó el PDF. Intenta de nuevo.'
      } else {
        msg = `El documento quedó registrado${folio ? ` con folio ${folio}` : ''}, pero no se pudo `
          + 'generar el PDF. Búscalo en la lista de documentos del paciente y recupéralo desde ahí.'
      }
      toast.error(msg)
      setErrorGuardado(msg)
      // eslint-disable-next-line no-console
      console.error('[NotaHonorariosForm] imprimir falló:', err)
    } finally {
      setImprimiendo(false)
      // También cuando la persistencia falló: el PDF existe y con el paciente
      // enfrente lo urgente es poder imprimirlo.
      if (pdfBlob && !offlineMode) setDocGenerado({ blob: pdfBlob, guardado, documentoId: filaId })
    }
  }

  // ─── Franja de lo conservado (§4.6) ────────────────────────────────────────
  // Solo en cotización y solo con valores ESCRITOS: la forma de pago llega
  // prellenada en «Efectivo» y un prellenado no es algo que el médico escribiera.
  // Las tres redacciones van enteras y no compuestas por piezas: el género del
  // participio no se resuelve concatenando.
  const pagoEscrito = esCotizacion && formaPago !== FORMAS_PAGO[0]
  const anticipoEscrito = esCotizacion && anticipo > 0
  const conservado =
    pagoEscrito && anticipoEscrito
      ? `Forma de pago (${formaPago}) y anticipo (${fmt(anticipo, divisa)}) se conservan escritos, pero no salen en la cotización.`
      : pagoEscrito
        ? `La forma de pago (${formaPago}) se conserva escrita, pero no sale en la cotización.`
        : anticipoEscrito
          ? `El anticipo (${fmt(anticipo, divisa)}) se conserva escrito, pero no sale en la cotización.`
          : ''

  const nombreAseguradora = aseguradora?.nombre ?? ''
  const valorSelectAseguradora = otraAseguradora
    || (nombreAseguradora !== '' && !ASEGURADORAS.some(a => a === nombreAseguradora))
    ? OTRA
    : nombreAseguradora

  return (
    <div ref={formRef} className="sp-doc-form">
      {/* El árbol del formulario NO se desmonta cuando el panel de plantillas
          está abierto: se apaga con display:none y el panel se monta como
          hermano, en el mismo contenedor de scroll (spec 02 §3.1). */}
      <div className="sp-doc-formbody" style={plantillas.panelAbierto ? { display: 'none' } : undefined}>

      {plantillas.selector}

      {/* ── Datos del documento ───────────────────────────────────────────── */}
      <section className="sp-card sp-doc-card">
        <div className="sp-doc-cardhead sp-doc-honohead">
          <h2 className="sp-label">Datos del documento</h2>
          {/* El segmentado vive AQUÍ y no en una card propia: una card entera
              para dos botones (§6). El orden de las cards no cambia al conmutar. */}
          <div className="sp-doc-segmented sp-doc-segmented--tipo" role="group" aria-label="Tipo de documento">
            {([
              { key: 'honorarios', label: 'Recibo' },
              { key: 'cotizacion', label: 'Cotización' },
            ] as { key: TipoDoc; label: string }[]).map(({ key, label }) => (
              <button key={key} type="button" aria-pressed={tipoDoc === key}
                onClick={() => setTipoDoc(key)} className="sp-doc-segmented__opt">
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="sp-doc-cardbody">
          {/* Cuatro campos en cotización y tres en recibo, y por eso dos
              rejillas: la primitiva de cuatro abre a tres columnas en 600 y ahí
              el folio se queda en 165 px (§0). */}
          <div className={esCotizacion ? 'sp-doc-honodatos' : 'sp-doc-grid'}
            data-cols={esCotizacion ? undefined : '3'}>
            <div className="sp-doc-field">
              <label htmlFor="honorarios-fecha" className="sp-label-field">Fecha</label>
              <input id="honorarios-fecha" type="date" value={fecha}
                min={FECHA_MIN} max={desplazarFecha(hoyEnTZ(TZ_CLINICA), { anios: 1 })}
                onChange={e => setFecha(e.target.value)} className="sp-input" />
            </div>

            <div className="sp-doc-field">
              <label htmlFor="honorarios-paciente" className="sp-label-field">
                Paciente <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                <span className="sr-only">obligatorio</span>
              </label>
              <input ref={pacienteRef} id="honorarios-paciente" type="text" value={paciente}
                onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo"
                aria-invalid={senalar('honorarios-paciente') || undefined}
                className={`sp-input ${senalar('honorarios-paciente') ? 'sp-doc-invalid' : ''}`} />
              {pacienteInicial && <p className="sp-hint">De la ficha · editable</p>}
            </div>

            <div className="sp-doc-field">
              <label htmlFor="honorarios-folio" className="sp-label-field">Folio</label>
              <input id="honorarios-folio" type="text" readOnly value="Se asigna al emitir"
                className="sp-input sp-doc-folio" />
              <p className="sp-hint">Lo genera la base · prefijo {esCotizacion ? 'COT' : 'NOH'}</p>
            </div>

            {esCotizacion && (
              <div className="sp-doc-field">
                <label htmlFor="honorarios-vigencia" className="sp-label-field">Vigencia</label>
                <select id="honorarios-vigencia" value={vigenciaDias}
                  onChange={e => setVigencia(Number(e.target.value))} className="sp-input">
                  {VIGENCIAS.map(d => <option key={d} value={d}>{d} días</option>)}
                </select>
                <p className="sp-hint">{vigenciaDias} días · hasta {fechaLarga(vigenciaHasta)}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Seguro de gastos médicos — solo cotización ────────────────────── */}
      {esCotizacion && (
        <section className="sp-card sp-doc-card">
          <div className="sp-doc-cardhead">
            <h2 className="sp-label">Seguro de gastos médicos</h2>
            {/* Nace cerrada: la mayoría de las cotizaciones no llevan seguro. */}
            <button type="button" role="switch" aria-checked={aseguradora !== null}
              aria-label="Cotización con seguro de gastos médicos"
              onClick={() => { setAseguradora(prev => (prev ? null : { ...ASEGURADORA_VACIA })); setOtra(false) }}
              className="sp-doc-switch">
              <span className="sp-doc-switch__track"><span className="sp-doc-switch__knob" /></span>
            </button>
          </div>
          {aseguradora && (
            <div className="sp-doc-cardbody">
              <div className="sp-doc-grid" data-cols="3">
                <div className="sp-doc-field">
                  <label htmlFor="honorarios-aseguradora" className="sp-label-field">Aseguradora</label>
                  <select id="honorarios-aseguradora" value={valorSelectAseguradora}
                    onChange={e => elegirAseguradora(e.target.value)} className="sp-input">
                    <option value="">— Elegir —</option>
                    {ASEGURADORAS.map(a => <option key={a} value={a}>{a}</option>)}
                    <option value={OTRA}>Otra</option>
                  </select>
                  {valorSelectAseguradora === OTRA && (
                    <input type="text" value={aseguradora.nombre}
                      onChange={e => campoAseguradora('nombre', e.target.value)}
                      aria-label="Nombre de la aseguradora"
                      placeholder="Nombre de la aseguradora" className="sp-input" />
                  )}
                </div>
                <div className="sp-doc-field">
                  <label htmlFor="honorarios-poliza" className="sp-label-field">Número de póliza</label>
                  <input id="honorarios-poliza" type="text" value={aseguradora.poliza}
                    onChange={e => campoAseguradora('poliza', e.target.value)}
                    placeholder="Ej: POL-123456" className="sp-input" />
                </div>
                <div className="sp-doc-field">
                  <label htmlFor="honorarios-cobertura" className="sp-label-field">Cobertura</label>
                  <input id="honorarios-cobertura" type="text" value={aseguradora.cobertura}
                    onChange={e => campoAseguradora('cobertura', e.target.value)}
                    placeholder="Ej: 80%" className="sp-input" />
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Conceptos ─────────────────────────────────────────────────────── */}
      <section className="sp-card sp-doc-card">
        <div className="sp-doc-cardhead">
          <div className="sp-icobox sp-icobox--sm"><Receipt /></div>
          <h2 className="sp-label">
            Conceptos <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
            <span className="sr-only">obligatorio</span>
          </h2>
          <button type="button" onClick={agregarLinea} aria-label="Agregar"
            className="sp-btn sp-btn--compact sp-doc-add">
            <Plus size={17} /><span className="sp-doc-long">Agregar</span>
          </button>
        </div>
        <div className="sp-doc-cardbody">
          <div className="sp-doc-honofilas" data-tipo={tipoDoc}>
            {/* La cabecera de columnas la enciende el CSS en los trazados de una
                línea; apilada, cada celda lleva su etiqueta y esta sobra. */}
            <div className="sp-doc-honofila sp-doc-honocols" aria-hidden="true">
              <span data-cell="c" className="sp-label">Concepto</span>
              {esCotizacion && <span data-cell="o" className="sp-label">Origen</span>}
              <span data-cell="p" className="sp-label">Precio ({divisa})</span>
              <span data-cell="d" />
            </div>

            {lineas.map((linea, i) => {
              const precioInvalido = linea.concepto.trim() !== '' && linea.precio <= 0
              // El faltante «Conceptos» señala la PRIMERA fila y no las cinco:
              // es la que el banner enfoca, y cinco campos en ámbar dicen que
              // hay cinco errores donde hay uno.
              const faltaConcepto = i === 0 && senalar('honorarios-concepto-0')
              return (
                <div key={linea.id} className="sp-doc-honofila">
                  <div data-cell="c">
                    <label htmlFor={`honorarios-concepto-${i}`} className="sp-label-field sp-doc-honocell-label">
                      Concepto
                    </label>
                    <input id={`honorarios-concepto-${i}`} type="text" value={linea.concepto}
                      onChange={e => updateLinea(linea.id, 'concepto', e.target.value)}
                      placeholder="Ej: Consulta de ortopedia"
                      aria-invalid={faltaConcepto || undefined}
                      className={`sp-input ${faltaConcepto ? 'sp-doc-invalid' : ''}`} />
                  </div>

                  {esCotizacion && (
                    <div data-cell="o">
                      <label htmlFor={`honorarios-origen-${i}`} className="sp-label-field sp-doc-honocell-label">
                        Origen
                      </label>
                      <ComboEscribible
                        id={`honorarios-origen-${i}`}
                        value={linea.origen}
                        onChange={val => updateLinea(linea.id, 'origen', val)}
                        sugerencias={ORIGENES}
                        placeholder="De quién es el cobro"
                        pie="Ninguno encaja: escribe el origen y se usa tal cual."
                      />
                    </div>
                  )}

                  <div data-cell="p">
                    <label htmlFor={`honorarios-precio-${i}`} className="sp-label-field sp-doc-honocell-label">
                      Precio ({divisa})
                    </label>
                    <div className="sp-doc-precio" data-divisa={divisa}>
                      <span aria-hidden="true" className="sp-doc-precio__sim">{simbolo}</span>
                      {/* `text` + `inputMode="decimal"`, y no `type="number"`:
                          en el iPad el numérico abre el teclado completo, y con
                          una coma dentro el navegador devuelve cadena vacía —el
                          importe desaparecería sin decir por qué—. */}
                      <input id={`honorarios-precio-${i}`} type="text" inputMode="decimal"
                        autoComplete="off"
                        value={importeVisible(`precio-${linea.id}`, linea.precio)}
                        onChange={e => escribirImporte(`precio-${linea.id}`, e.target.value,
                          n => setLineas(prev => prev.map(l => (l.id === linea.id ? { ...l, precio: n } : l))))}
                        onBlur={() => limpiarImporte(`precio-${linea.id}`)}
                        placeholder="0.00"
                        aria-invalid={precioInvalido || undefined}
                        className={`sp-input ${precioInvalido ? 'sp-doc-invalid' : ''}`} />
                    </div>
                    {precioInvalido && (
                      <p className="sp-hint" style={{ color: 'var(--sp-warn)' }}>El precio debe ser mayor a 0</p>
                    )}
                  </div>

                  <button type="button" data-cell="d" onClick={() => eliminarLinea(linea.id)}
                    disabled={lineas.length === 1}
                    aria-label={linea.concepto.trim() ? `Eliminar ${linea.concepto.trim()}` : `Eliminar concepto ${i + 1}`}
                    className="sp-doc-iconbtn">
                    <Trash2 />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Bloque de cierre — SIEMPRE visible, también con total en cero. */}
          <div className="sp-doc-cierre">
            {esCotizacion ? (
              <>
                {subtotales.map(s => (
                  <div key={s.origen} className="sp-doc-cierrefila">
                    <span className="sp-doc-cierrelabel" title={s.origen}>Subtotal · {s.origen}</span>
                    <span className="sp-doc-cierrecifra">{fmt(s.total, divisa)}</span>
                  </div>
                ))}
                <div className="sp-doc-cierrefila sp-doc-cierrefila--final">
                  <span className="sp-doc-cierrelabel">Total cotizado</span>
                  <span className="sp-doc-cierrecifra">{fmt(total, divisa)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="sp-doc-cierrefila">
                  <span className="sp-doc-cierrelabel">Total</span>
                  <span className="sp-doc-cierrecifra">{fmt(total, divisa)}</span>
                </div>
                <div className="sp-doc-cierrefila">
                  <label htmlFor="honorarios-anticipo" className="sp-doc-cierrelabel">Anticipo recibido</label>
                  <div className="sp-doc-precio sp-doc-anticipo" data-divisa={divisa}>
                    <span aria-hidden="true" className="sp-doc-precio__sim">{simbolo}</span>
                    <input id="honorarios-anticipo" type="text" inputMode="decimal"
                      autoComplete="off"
                      value={importeVisible('anticipo', anticipo)}
                      onChange={e => escribirImporte('anticipo', e.target.value, setAnticipo)}
                      onBlur={() => limpiarImporte('anticipo')}
                      placeholder="0.00" className="sp-input" />
                  </div>
                </div>
                <div className="sp-doc-cierrefila sp-doc-cierrefila--final">
                  <span className="sp-doc-cierrelabel">Saldo pendiente</span>
                  <span className="sp-doc-cierrecifra">{fmt(saldo, divisa)}</span>
                </div>
                {/* NO bloquea la emisión: puede haber saldo a favor legítimo y el
                    médico sabe mejor que el sistema (§4.4). */}
                {anticipo > total && (
                  <p className="sp-banner sp-banner--warn" aria-live="polite" style={{ marginTop: 'var(--sp-2)' }}>
                    <AlertTriangle size={17} />
                    <span>El anticipo supera el total. Revísalo antes de emitir.</span>
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Pago (recibo) / Condiciones (cotización) ──────────────────────── */}
      <section className="sp-card sp-doc-card">
        <div className="sp-doc-cardhead">
          <h2 className="sp-label">{esCotizacion ? 'Condiciones' : 'Pago'}</h2>
        </div>
        <div className="sp-doc-cardbody">
          <div className="sp-doc-grid" data-cols="2">
            {!esCotizacion && (
              <div className="sp-doc-field">
                <label htmlFor="honorarios-formapago" className="sp-label-field">Forma de pago</label>
                <select id="honorarios-formapago" value={formaPago}
                  onChange={e => setFormaPago(e.target.value)} className="sp-input">
                  {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            )}
            <div className="sp-doc-field">
              <span className="sp-label-field" id="honorarios-divisa">Divisa</span>
              <div className="sp-doc-segmented sp-doc-segmented--field" role="group" aria-labelledby="honorarios-divisa">
                {(['MXN', 'USD'] as Divisa[]).map(d => (
                  <button key={d} type="button" aria-pressed={divisa === d}
                    onClick={() => setDivisa(d)} className="sp-doc-segmented__opt">
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="sp-doc-field sp-doc-span-all">
              <label htmlFor="honorarios-notas" className="sp-label-field">Notas y consideraciones</label>
              <textarea id="honorarios-notas" value={notas} onChange={e => setNotas(e.target.value)}
                placeholder="Observaciones adicionales, indicaciones especiales…"
                className="sp-textarea" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Franja de lo conservado (§4.6) ────────────────────────────────── */}
      {conservado !== '' && (
        <p className="sp-banner sp-banner--info">
          <EyeOff size={17} />
          <span>{conservado}</span>
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
            {faltantes.length === 1 ? 'Falta 1 campo' : `Faltan ${faltantes.length} campos`}:{' '}
            {faltantes.map((f, i) => (
              <span key={f.clave}>
                {i > 0 && ' · '}
                <button type="button" onClick={() => irA(f.clave)}
                  className="sp-link-alt" style={{ color: 'var(--sp-warn-strong)' }}>
                  {f.nombre}
                </button>
              </span>
            ))}
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

      {/* La frase entera, y aquí especialmente: los dos papeles de este
          formulario no comparten género —«Cotización generada» contra «Recibo
          generado»—, así que ningún participio fijo sirve para ambos. */}
      <ModalDocumentoGenerado
        open={docGenerado !== null}
        onClose={() => setDocGenerado(null)}
        blob={docGenerado?.blob ?? null}
        titulo={esCotizacion ? 'Cotización generada' : 'Recibo generado'}
        guardadoEnExpediente={docGenerado?.guardado ?? false}
        documentoId={docGenerado?.documentoId ?? null}
      />
    </div>
  )
}

// El único de los ocho SIN anexar al expediente: no tiene valor clínico
// (guía §8, spec 03 §3). No hay nada que apagar aquí — el botón de anexar
// todavía no existe en el modal, en ningún formato.
