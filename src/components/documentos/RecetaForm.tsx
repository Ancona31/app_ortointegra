'use client'

import { generateDocFileName, calcularEdad } from '@/lib/patientUtils'
import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Printer, AlertTriangle, Pill } from 'lucide-react'
import { flushSync } from 'react-dom'
import QRCode from 'qrcode'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Medicamento } from '@/types'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { useProfile } from '@/hooks/useProfile'
import { createClient } from '@/lib/supabase/client'
import { generarPdf, VERSION_DE_EMISION, versionQueEmite } from '@/lib/mobileShare'
import { hoyEnTZ, desplazarFecha } from '@/lib/dates'
import { enfocarYAcercar } from '@/lib/scrollDoc'
import { MEDICAMENTOS, type MedicamentoDB } from '@/data/medicamentos'
import ComboEscribible from '@/components/documentos/ComboEscribible'
import { usePlantillasDocumento, type ContenidoPlantilla } from '@/components/documentos/PlantillasDocumento'
import { useToast } from '@/components/ui/Toast'
import ModalDocumentoGenerado from '@/components/documentos/ModalDocumentoGenerado'

type MedicamentoConVia = Medicamento & { via_administracion?: string }

const VIAS = ['Oral', 'Tópica', 'Intramuscular', 'Intravenosa', 'Subcutánea', 'Sublingual', 'Oftálmica', 'Ótica', 'Nasal', 'Inhalatoria', 'Rectal', 'Transdérmica']

const FECHA_MIN = '1900-01-01'

const MED_VACIO: MedicamentoConVia = {
  nombre_comercial: '', presentacion: '', dosis: '',
  principio_activo: '', indicacion: '', via_administracion: 'Oral',
}

/**
 * Etiqueta → fila del catálogo, para el desplegable del nombre comercial.
 *
 * El nombre comercial NO identifica una fila: «Keral» son dos —tabletas de
 * 25 mg y solución inyectable— y hay dos docenas de casos iguales. Por eso la
 * etiqueta lleva la presentación. Y lleva el principio activo porque
 * `ComboEscribible` filtra por el texto de la etiqueta, y buscar por
 * denominación genérica —«diclofenaco»— es media búsqueda real del médico.
 *
 * El `Map` dedupe por construcción: si dos filas produjeran la misma etiqueta,
 * colapsan en una y ninguna clave se repite. Es lo que necesita la lista, que
 * usa la cadena como `key`.
 */
const CATALOGO = new Map<string, MedicamentoDB>(
  MEDICAMENTOS.map(m => [`${m.nombre_comercial} · ${m.presentacion} · ${m.principio_activo}`, m]),
)
const ETIQUETAS_CATALOGO = [...CATALOGO.keys()]

/** Pista por bloque. Vive fuera del medicamento para no viajar al PDF ni al jsonb. */
type Pista = { dosisSugerida: string; principioDelCatalogo: boolean }
const PISTA_VACIA: Pista = { dosisSugerida: '', principioDelCatalogo: false }

/**
 * Alguno de los cuatro campos de texto tiene contenido. La vía NO cuenta:
 * llega con «Oral» puesta y un bloque intacto no es un bloque escrito.
 */
function conTexto(m: MedicamentoConVia): boolean {
  return !!(m.nombre_comercial.trim() || m.presentacion?.trim()
    || m.principio_activo?.trim() || m.indicacion.trim())
}

/** Los dos obligatorios del formato: comercial y denominación genérica (§4). */
function estaCompleto(m: MedicamentoConVia): boolean {
  return !!(m.nombre_comercial.trim() && m.principio_activo?.trim())
}

/**
 * Lee un medicamento guardado en jsonb, campo a campo y desconfiando de todo:
 * el contenido pudo escribirse con otra versión del formulario.
 */
function leerMedicamento(bruto: unknown): MedicamentoConVia | null {
  if (typeof bruto !== 'object' || bruto === null) return null
  const fila = bruto as Record<string, unknown>
  const texto = (v: unknown): string => (typeof v === 'string' ? v : '')
  const m: MedicamentoConVia = {
    nombre_comercial: texto(fila.nombre_comercial),
    presentacion: texto(fila.presentacion),
    dosis: texto(fila.dosis),
    principio_activo: texto(fila.principio_activo),
    indicacion: texto(fila.indicacion),
    via_administracion: texto(fila.via_administracion) || 'Oral',
  }
  return conTexto(m) ? m : null
}

/**
 * Predicado único de «formulario vacío». Mismo criterio que Laboratorio: los
 * campos que llegan prellenados de la ficha —paciente y diagnóstico— NO cuentan
 * como escritos hasta que se editan, porque llegaron solos. La fecha tampoco:
 * es dato de paciente y nunca entra en la plantilla.
 *
 * Los medicamentos SÍ cuentan aunque lleguen por `medicamentosIniciales`: no
 * son contexto del paciente sino el contenido del documento, y una receta que
 * llega con tres fármacos de la nota no es un formulario vacío.
 */
function isFormEmpty(
  medicamentos: MedicamentoConVia[], recomendaciones: string,
  paciente: string, pacienteInicial: string,
  diagnostico: string, diagnosticoInicial: string,
): boolean {
  const pacienteIntacto = paciente.trim() === '' || paciente.trim() === pacienteInicial.trim()
  const dxIntacto = diagnostico.trim() === '' || diagnostico.trim() === diagnosticoInicial.trim()
  return pacienteIntacto && dxIntacto && recomendaciones.trim() === '' && !medicamentos.some(conTexto)
}

interface Props {
  pacienteInicial?: string
  diagnosticoInicial?: string
  pacienteId?: string
  medicamentosIniciales?: MedicamentoConVia[]
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

export default function RecetaForm({ pacienteInicial = '', diagnosticoInicial = '', pacienteId, medicamentosIniciales, offlineMode, onOfflineSave, onVacioChange, onPanelPlantillasChange }: Props) {
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
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial)
  const [pacienteData, setPacienteData] = useState<{ edad?: number | null; sexo?: string } | null>(null)

  useEffect(() => {
    if (!pacienteId) return

    async function cargarDatosPaciente() {
      // Helper: aplicar datos (edad + sexo) al state desde cualquier fuente
      const aplicar = (fechaNac: string | null, sexo: string | null | undefined) => {
        const edad = fechaNac ? calcularEdad(fechaNac).anios : null
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
    : [{ ...MED_VACIO }]

  const [fecha, setFecha] = useState(hoyEnTZ())
  const [medicamentos, setMedicamentos] = useState<MedicamentoConVia[]>(medInicial)
  const [pistas, setPistas] = useState<Pista[]>(medInicial.map(() => ({ ...PISTA_VACIA })))
  const [recomendaciones, setRecomendaciones] = useState('')
  const [errorGuardado, setErrorGuardado] = useState('')
  const [imprimiendo, setImprimiendo] = useState(false)
  const [docGenerado, setDocGenerado] = useState<{ blob: Blob; guardado: boolean } | null>(null)
  // El banner de faltantes NO existe hasta el primer intento de imprimir: un
  // formulario recién abierto no acusa de nada. Después permanece y se
  // actualiza en vivo.
  const [intentado, setIntentado] = useState(false)

  const formRef = useRef<HTMLDivElement>(null)
  const pacienteRef = useRef<HTMLInputElement>(null)

  const vacio = isFormEmpty(medicamentos, recomendaciones, paciente, pacienteInicial, diagnostico, diagnosticoInicial)
  useEffect(() => { onVacioChange?.(vacio) }, [vacio, onVacioChange])

  // ── Plantillas (spec 02) ────────────────────────────────────────
  // Se guarda TODO menos los datos del paciente. Aquí eso deja fuera paciente,
  // diagnóstico y fecha: los tres son suyos aunque los teclee el médico, y una
  // plantilla con la fecha congelada es un defecto.
  const plantillas = usePlantillasDocumento({
    tipo: 'receta',
    vacio,
    // El búnker no tiene red ni sesión de Supabase: el sistema no se monta.
    desactivado: !!offlineMode,
    onPanelChange: onPanelPlantillasChange,
    leer: () => ({ _v: 1, medicamentos: medicamentos.filter(conTexto), recomendaciones }),
    aplicar: (c: ContenidoPlantilla) => {
      // Solo las claves que existen HOY en el formulario, campo a campo. Los
      // dos valores de repuesto NO son defensa de sobra: «Vaciar formulario»
      // aplica un contenido sin ninguna clave, así que es justo lo que repone
      // el estado inicial. El paciente y el diagnóstico no se tocan aquí, y por
      // eso sobreviven al vaciado.
      const guardados = Array.isArray(c.medicamentos)
        ? c.medicamentos.map(leerMedicamento).filter((m): m is MedicamentoConVia => m !== null)
        : []
      const filas = guardados.length > 0 ? guardados : [{ ...MED_VACIO }]
      setMedicamentos(filas)
      // Las pistas son del catálogo, no del jsonb: una plantilla aplicada no
      // trae sugerencia de posología ni presume de dónde salió el principio.
      setPistas(filas.map(() => ({ ...PISTA_VACIA })))
      setRecomendaciones(typeof c.recomendaciones === 'string' ? c.recomendaciones : '')
    },
  })

  // G-10: foco al primer campo editable vacío al montar. preventScroll para no
  // arrastrar la página hasta él. En móvil esto abre el teclado en cada montaje.
  useEffect(() => {
    const primero = formRef.current?.querySelector<HTMLElement>('input:not([type="date"]), textarea')
    if (primero instanceof HTMLInputElement && !primero.value) primero.focus({ preventScroll: true })
  }, [])

  function addMed(i: number) {
    setMedicamentos(prev => [...prev.slice(0, i + 1), { ...MED_VACIO }, ...prev.slice(i + 1)])
    setPistas(prev => [...prev.slice(0, i + 1), { ...PISTA_VACIA }, ...prev.slice(i + 1)])
  }

  function removeMed(i: number) {
    setMedicamentos(prev => prev.filter((_, idx) => idx !== i))
    setPistas(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateMed(i: number, campo: keyof MedicamentoConVia, val: string) {
    setMedicamentos(prev => prev.map((m, idx) => idx === i ? { ...m, [campo]: val } : m))
    // Escribir el principio activo a mano retira el sello del catálogo: la
    // pista dejaría de describir lo que hay en el campo.
    if (campo === 'principio_activo') {
      setPistas(prev => prev.map((p, idx) => idx === i ? { ...p, principioDelCatalogo: false } : p))
    }
  }

  /**
   * Elegir del desplegable escribe la etiqueta compuesta; aquí se cambia por la
   * fila real antes de que llegue al estado, así que el campo nunca muestra la
   * etiqueta. Si lo escrito no es una etiqueta del catálogo, es texto libre.
   */
  function alEscribirNombre(i: number, val: string) {
    const med = CATALOGO.get(val)
    if (!med) { updateMed(i, 'nombre_comercial', val); return }
    setMedicamentos(prev => prev.map((m, idx) => idx === i ? {
      ...m,
      nombre_comercial: med.nombre_comercial,
      presentacion: med.presentacion,
      principio_activo: med.principio_activo,
    } : m))
    setPistas(prev => prev.map((p, idx) => idx === i
      ? { dosisSugerida: med.dosis_sugerida, principioDelCatalogo: true }
      : p))
  }

  // ── Validación (§3.8) ───────────────────────────────────────────
  // El bloque de referencia es el primero con algo escrito, o el primero a
  // secas: nombrar «Nombre comercial» sin decir de qué bloque solo tiene
  // sentido si el banner lleva luego hasta él.
  const hayCompleto = medicamentos.some(estaCompleto)
  const iRef = Math.max(0, medicamentos.findIndex(conTexto))

  const faltantes: { clave: string; nombre: string }[] = []
  if (!paciente.trim()) faltantes.push({ clave: 'receta-paciente', nombre: 'Paciente' })
  if (!hayCompleto) {
    if (!medicamentos[iRef]?.nombre_comercial.trim()) {
      faltantes.push({ clave: `receta-nombre-${iRef}`, nombre: 'Nombre comercial' })
    }
    if (!medicamentos[iRef]?.principio_activo?.trim()) {
      faltantes.push({ clave: `receta-principio-${iRef}`, nombre: 'Principio activo' })
    }
  }

  function irA(clave: string) {
    if (clave === 'receta-paciente') { enfocarYAcercar(pacienteRef.current); return }
    enfocarYAcercar(formRef.current?.querySelector<HTMLElement>(`#${clave}`) ?? null)
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

    // 1. Feedback instantáneo — el usuario ve progreso en <50ms
    toast.info('Generando receta...')

    // 2. Construcción de identidad — el folio sirve DOBLE propósito:
    //    - Identificador público del documento (QR de verificación)
    //    - clientId para idempotencia (idempotencia garantizada por el
    //      índice único parcial en la tabla documentos)
    const folio = `R-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
    // Un bloque a medias no llega ni al PDF ni al expediente, y ya no puede
    // desaparecer en silencio: imprimir con uno incompleto es imposible.
    const medsData = medicamentos.filter(estaCompleto)
    const contenido = {
      folio,
      paciente,
      diagnostico,
      medicamentos: medsData,
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

    // El blob y el desenlace de la persistencia se leen en el finally para
    // montar el modal posterior a la generación. Ver ModalDocumentoGenerado.
    let pdfBlob: Blob | null = null
    let guardado = false
    let filaId: string | null = null
    let folioSerie: string | null = null

    try {
      // ── 3 · LA FILA PRIMERO ───────────────────────────────────────────
      //    Invierte el orden que este formulario tenía —PDF, subida, fila—,
      //    como los otros seis, para que la fila exista antes de renderizar.
      //
      //    ⚠ **AQUÍ EL FOLIO IMPRESO NO CAMBIA, Y ES EL ÚNICO DE LOS SIETE.**
      //    La receta ya llevaba folio en el papel: el `R-…` de arriba, que es lo
      //    que resuelve el QR de verificación pública (`/r/[folio]`) y lo que
      //    esa página muestra. La base asigna ADEMÁS su `RX-…` de serie, y
      //    imprimir los dos obligaría a decidir cuál se cita. Se imprime el que
      //    verifica; `folioImpreso()` lo declara en un solo sitio y por eso este
      //    formulario no lo pasa al PDF aunque lo tenga aquí.
      //
      //    Va con el cliente de SESIÓN del médico, nunca con privilegios de
      //    servicio: el trigger exenta por completo a quien no trae JWT.
      const supabase = offlineMode ? null : createClient()
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No autenticado')

        const insertPayload: Record<string, unknown> = {
          tipo: 'receta',
          contenido,
          client_id: folio,
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
        folioSerie = data.folio
        // La fila está en el expediente. Aunque el PDF falle después, la receta
        // es recuperable desde la lista con su botón de regenerar — y el QR ya
        // resuelve, porque lo que busca esa página es la fila, no el PDF.
        guardado = true
      }

      // ── 4 · El PDF ────────────────────────────────────────────────────
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

      const consultorioData = consultorioActivo ? {
        nombre: consultorioActivo.nombre,
        direccion: consultorioActivo.direccion,
        telefono: consultorioActivo.telefono,
      } : undefined

      const { blob, storagePath } = await generarPdf({
        tipo: 'receta',
        pacienteId,
        medico: {
          nombre: doctorNombre,
          titulo: medicoInfo?.titulo ?? null,
          nombres: medicoInfo?.nombres ?? null,
          apellido_paterno: medicoInfo?.apellido_paterno ?? null,
          apellido_materno: medicoInfo?.apellido_materno ?? null,
          especialidad: doctorEspecialidad,
          cedula_profesional: cedProf,
          cedula_especialidad: cedEsp,
          // También aquí, y no solo dentro de `data`: el membrete de v2 la lee
          // del médico, como las cédulas, y `data.universidad` es la ranura que
          // v1 usa para el mismo dato. Las dos apuntan al mismo perfil.
          universidad: medicoInfo?.universidad ?? null,
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
          universidad: medicoInfo?.universidad || undefined,
        },
        logoUrl,
        filename: generateDocFileName(paciente, 'Receta'),
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
          tipo: 'receta',
          contenido,
          created_at: new Date().toISOString(),
          medico_id: getOfflineIdentity()?.userId ?? 'anonymous',
          _syncStatus: 'pending',
        })
        toast.success('Receta guardada en bunker offline')
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
          if (error) console.error('[RecetaForm] update pdf_url:', error.message)
        }
        // El folio del toast es el de SERIE, no el impreso: es el que se cita
        // dentro de la clínica y el único que el buscador de folios encuentra.
        toast.success(folioSerie ? `Receta guardada · ${folioSerie}` : 'Receta guardada')
      }
    } catch (err) {
      // Tres desenlaces, y el del medio es nuevo: con la fila escrita antes que
      // el PDF, un fallo de render deja una receta emitida y un folio consumido.
      let msg: string
      if (offlineMode) {
        msg = 'No se pudo generar el PDF. Intenta de nuevo.'
      } else if (filaId === null) {
        msg = 'No se pudo guardar la receta, así que no se generó el PDF. Intenta de nuevo.'
      } else {
        msg = `La receta quedó registrada${folioSerie ? ` con folio ${folioSerie}` : ''}, pero no se `
          + 'pudo generar el PDF. Búscala en la lista de documentos del paciente y recupérala desde ahí.'
      }
      toast.error(msg)
      setErrorGuardado(msg)
      // eslint-disable-next-line no-console
      console.error('[RecetaForm] imprimir falló:', err)
    } finally {
      setImprimiendo(false)
      // También cuando la persistencia falló: el PDF existe y con el paciente
      // enfrente lo urgente es poder imprimirlo.
      if (pdfBlob && !offlineMode) setDocGenerado({ blob: pdfBlob, guardado })
    }
  }

  const senalar = (clave: string) => intentado && faltantes.some(f => f.clave === clave)

  return (
    <div ref={formRef} className="sp-doc-form">
      {/* El árbol del formulario NO se desmonta cuando el panel de plantillas
          está abierto: se apaga con display:none y el panel se monta como
          hermano, en el mismo contenedor de scroll (spec 02 §3.1). */}
      <div className="sp-doc-formbody" style={plantillas.panelAbierto ? { display: 'none' } : undefined}>

      {plantillas.selector}

      <section className="sp-card sp-doc-card">
        <div className="sp-doc-cardhead">
          <h2 className="sp-label">Datos del paciente</h2>
        </div>
        <div className="sp-doc-cardbody">
          <div className="sp-doc-grid" data-cols="3">
            <div className="sp-doc-field">
              <label htmlFor="receta-fecha" className="sp-label-field">Fecha</label>
              <input id="receta-fecha" type="date" value={fecha}
                min={FECHA_MIN} max={desplazarFecha(hoyEnTZ(), { anios: 1 })}
                onChange={e => setFecha(e.target.value)} className="sp-input" />
            </div>
            <div className="sp-doc-field">
              <label htmlFor="receta-paciente" className="sp-label-field">
                Paciente <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                <span className="sr-only">obligatorio</span>
              </label>
              <input ref={pacienteRef} id="receta-paciente" type="text" value={paciente}
                onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo"
                aria-invalid={senalar('receta-paciente') || undefined}
                className={`sp-input ${senalar('receta-paciente') ? 'sp-doc-invalid' : ''}`} />
              {pacienteInicial && <p className="sp-hint">De la ficha · editable</p>}
            </div>
            <div className="sp-doc-field">
              <label htmlFor="receta-diagnostico" className="sp-label-field">Diagnóstico</label>
              <input id="receta-diagnostico" type="text" value={diagnostico}
                onChange={e => setDiagnostico(e.target.value)} placeholder="Diagnóstico principal"
                className="sp-input" />
              {diagnosticoInicial && <p className="sp-hint">Del diagnóstico de la consulta</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="sp-card sp-doc-card">
        {/* La cabecera se queda solo con su etiqueta: «Agregar medicamento» va
            al pie de CADA bloque (§2.2). Con cuatro fármacos, un botón único al
            final obliga a bajar hasta abajo y volver a subir. */}
        <div className="sp-doc-cardhead">
          <div className="sp-icobox sp-icobox--sm"><Pill /></div>
          <h2 className="sp-label">Medicamentos</h2>
        </div>
        <div className="sp-doc-cardbody">
          {medicamentos.map((med, i) => (
            <div key={i} className="sp-doc-medblock">
              <div className="sp-doc-medhead">
                <span className="sp-label">Medicamento {i + 1}</span>
                <button type="button" onClick={() => removeMed(i)} disabled={medicamentos.length === 1}
                  aria-label={med.nombre_comercial.trim()
                    ? `Eliminar ${med.nombre_comercial.trim()}`
                    : `Eliminar medicamento ${i + 1}`}
                  className="sp-doc-iconbtn">
                  <Trash2 />
                </button>
              </div>

              <div className="sp-doc-grid" data-cols="3">
                <div className="sp-doc-field sp-doc-span-2">
                  <label htmlFor={`receta-nombre-${i}`} className="sp-label-field">
                    Nombre comercial <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                    <span className="sr-only">obligatorio</span>
                  </label>
                  <ComboEscribible
                    id={`receta-nombre-${i}`}
                    value={med.nombre_comercial}
                    onChange={val => alEscribirNombre(i, val)}
                    sugerencias={ETIQUETAS_CATALOGO}
                    minCaracteres={2}
                    placeholder="Ej: Voltaren"
                    pie="Ninguno encaja: escribe el nombre y se usa tal cual."
                    invalido={senalar(`receta-nombre-${i}`)}
                    claseExtra={senalar(`receta-nombre-${i}`) ? 'sp-doc-invalid' : ''}
                  />
                </div>

                <div className="sp-doc-field">
                  <label htmlFor={`receta-presentacion-${i}`} className="sp-label-field">Presentación</label>
                  <input id={`receta-presentacion-${i}`} type="text" value={med.presentacion ?? ''}
                    onChange={e => updateMed(i, 'presentacion', e.target.value)}
                    placeholder="Tabletas 50 mg" className="sp-input" />
                </div>

                <div className="sp-doc-field">
                  <label htmlFor={`receta-via-${i}`} className="sp-label-field">Vía de administración</label>
                  <select id={`receta-via-${i}`} value={med.via_administracion || 'Oral'}
                    onChange={e => updateMed(i, 'via_administracion', e.target.value)}
                    className="sp-input">
                    {VIAS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>

                {/* Se queda como campo EDITABLE y no como texto informativo: es
                    la denominación genérica que exige el formato, y el catálogo
                    no la trae siempre. Como texto, los fármacos fuera de
                    catálogo perderían el dato exigible (§4). */}
                <div className="sp-doc-field sp-doc-span-2">
                  <label htmlFor={`receta-principio-${i}`} className="sp-label-field">
                    Principio activo <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                    <span className="sr-only">obligatorio</span>
                  </label>
                  <input id={`receta-principio-${i}`} type="text" value={med.principio_activo ?? ''}
                    onChange={e => updateMed(i, 'principio_activo', e.target.value)}
                    placeholder="Diclofenaco sódico"
                    aria-invalid={senalar(`receta-principio-${i}`) || undefined}
                    className={`sp-input ${senalar(`receta-principio-${i}`) ? 'sp-doc-invalid' : ''}`} />
                  {pistas[i]?.principioDelCatalogo && <p className="sp-hint">Del catálogo · editable</p>}
                </div>

                <div className="sp-doc-field sp-doc-span-all">
                  <label htmlFor={`receta-indicacion-${i}`} className="sp-label-field">Indicaciones</label>
                  <textarea id={`receta-indicacion-${i}`} value={med.indicacion}
                    onChange={e => updateMed(i, 'indicacion', e.target.value)}
                    placeholder="Tomar 1 tableta cada 8 hrs con alimentos por 7 días"
                    className="sp-textarea" />
                  {pistas[i]?.dosisSugerida && (
                    <p className="sp-hint">Sugerencia del catálogo: {pistas[i].dosisSugerida}</p>
                  )}
                </div>
              </div>

              <div className="sp-doc-medfoot">
                <button type="button" onClick={() => addMed(i)}
                  className="sp-btn sp-btn--compact">
                  <Plus size={17} /> Agregar medicamento
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* El selector de recomendaciones predeterminadas se eliminó entero, con
          sus nueve bloques y sus emoji (R-05): insertaba acumulando y no había
          forma de quitar un bloque. Lo que resolvía —repetir el mismo texto— lo
          cubren las plantillas, que además guardan los medicamentos. */}
      <section className="sp-card sp-doc-card">
        <div className="sp-doc-cardhead">
          <h2 className="sp-label">Recomendaciones</h2>
        </div>
        <div className="sp-doc-cardbody">
          <label htmlFor="receta-recomendaciones" className="sr-only">Recomendaciones</label>
          <textarea id="receta-recomendaciones" value={recomendaciones}
            onChange={e => setRecomendaciones(e.target.value)}
            placeholder="Indicaciones generales, cuidados, datos de alarma…"
            className="sp-textarea" />
        </div>
      </section>

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
                <span className="sp-doc-long">Imprimir receta</span>
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
        titulo="Receta generada"
        guardadoEnExpediente={docGenerado?.guardado ?? false}
      />
    </div>
  )
}
