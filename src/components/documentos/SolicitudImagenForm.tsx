'use client'
import { generateDocFileName } from '@/lib/patientUtils'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'
import { useEffect, useRef, useState } from 'react'

import { Plus, Check, AlertTriangle, ScanLine } from 'lucide-react'
import PieAccionesDocumento from '@/components/documentos/PieAccionesDocumento'
import { flushSync } from 'react-dom'
import { generarPdf, VERSION_DE_EMISION, versionQueEmite } from '@/lib/mobileShare'
import { useToast } from '@/components/ui/Toast'
import ModalShell from '@/components/ui/ModalShell'
import ModalDocumentoGenerado from '@/components/documentos/ModalDocumentoGenerado'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import EditorEstudioImagen from '@/components/documentos/EditorEstudioImagen'
import LineaEstudioImagen from '@/components/documentos/LineaEstudioImagen'
import {
  componer, ESTUDIO_EDITOR_VACIO, estaVacio, faltasDe, interpretar, siguienteCampo,
  type EstudioEditor, type Falta, type Siguiente,
} from '@/components/documentos/imagenCompuesta'
import { usePlantillasDocumento, type ContenidoPlantilla } from '@/components/documentos/PlantillasDocumento'
import { folioImpreso } from '@/lib/documentos/folio'
import { createClient } from '@/lib/supabase/client'
import { hoyEnTZ, desplazarFecha, TZ_CLINICA } from '@/lib/dates'
import { enfocarYAcercar } from '@/lib/scrollDoc'
import { escucharSalida } from '@/components/documentos/salidaPlegable'

const FECHA_MIN = '1900-01-01'

type Estudio = { tipo: string; region: string; proyecciones?: string; indicacion?: string }

/** Alguno de los cuatro campos tiene texto. Gobierna qué filas van a plantilla. */
function conTexto(e: Estudio): boolean {
  return !!(e.tipo.trim() || e.region.trim() || e.proyecciones?.trim() || e.indicacion?.trim())
}

/**
 * Lee una fila guardada en jsonb, campo a campo y desconfiando de todo: el
 * contenido pudo escribirse con otra versión del formulario.
 */
function leerEstudio(bruto: unknown): Estudio | null {
  if (typeof bruto !== 'object' || bruto === null) return null
  const fila = bruto as Record<string, unknown>
  const texto = (v: unknown): string => (typeof v === 'string' ? v : '')
  const e: Estudio = {
    tipo: texto(fila.tipo),
    region: texto(fila.region),
    proyecciones: texto(fila.proyecciones),
    indicacion: texto(fila.indicacion),
  }
  return conTexto(e) ? e : null
}

/** Predicado único de «formulario vacío». Mismo criterio que Honorarios. */
function isFormEmpty(
  estudios: EstudioEditor[], urgente: boolean,
  paciente: string, pacienteInicial: string,
  diagnostico: string, diagnosticoInicial: string,
): boolean {
  const pacienteIntacto = paciente.trim() === '' || paciente.trim() === pacienteInicial.trim()
  const dxIntacto = diagnostico.trim() === '' || diagnostico.trim() === diagnosticoInicial.trim()
  return pacienteIntacto && dxIntacto && !urgente && estudios.every(estaVacio)
}

/** Clave estable de React de cada estudio (no el índice: quitar uno no pierde el foco). */
let ultimaClave = 0
function claveNueva(): number { ultimaClave += 1; return ultimaClave }

/** Ids del DOM de cada campo de un estudio, por su clave estable. */
type CampoImg = 'buscar' | 'tipo' | 'region' | 'lado' | 'contraste' | 'indicacion' | 'tipolibre' | 'regionlibre'
const GRUPOS_DE_FICHAS: readonly CampoImg[] = ['tipo', 'region', 'lado', 'contraste']
const CAMPO_SIGUIENTE: Record<Siguiente, CampoImg> = {
  tipo: 'tipo', region: 'region', lado: 'lado', contraste: 'contraste', indicacion: 'indicacion', tipoLibre: 'tipolibre',
}
/** El elemento enfocable de un campo; en un grupo de fichas, su botón con tabindex 0. */
function elementoDe(raiz: HTMLElement | null, clave: number, campo: CampoImg): HTMLElement | null {
  const sel = GRUPOS_DE_FICHAS.includes(campo) ? `#imagen-${campo}-${clave} [tabindex="0"]` : `#imagen-${campo}-${clave}`
  return raiz?.querySelector<HTMLElement>(sel) ?? null
}
const ROTULO_FALTA: Record<Falta, string> = { tipo: 'Tipo de estudio', region: 'Región', lado: 'Lado', contraste: 'Contraste' }
function campoDeFalta(f: Falta, e: EstudioEditor): CampoImg {
  if (e.modalidad === 'otro') return f === 'region' ? 'regionlibre' : 'tipolibre'
  return f
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

export default function SolicitudImagenForm({ pacienteInicial = '', diagnosticoInicial = '', pacienteId, offlineMode, onOfflineSave, onVacioChange, onCerrarTrasEmitir, onPanelPlantillasChange }: Props) {
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
  const [diagnostico, setDiagnostico] = useState(diagnosticoInicial)
  const [estudios, setEstudios] = useState<EstudioEditor[]>([{ ...ESTUDIO_EDITOR_VACIO }])
  const [claves, setClaves] = useState<number[]>(() => [claveNueva()])
  // Solicitud compacta: UN estudio abierto a la vez (su clave), los demás
  // plegados a una línea. Nace abierto el primero.
  const [abierto, setAbierto] = useState<number | null>(() => claves[0] ?? null)
  const [urgente, setUrgente] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [errorAbierto, setErrorAbierto] = useState(false)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [docGenerado, setDocGenerado] = useState<{ blob: Blob; guardado: boolean; documentoId: string | null } | null>(null)
  // Nada acusa antes del primer intento de imprimir; después todo se actualiza
  // en vivo. Gobierna el banner (§3.8) Y el teñido del bloque a medias (§2.4):
  // sin esto, el bloque se pone rojo mientras se teclea el tipo y antes de que
  // dé tiempo a llegar a la región.
  const [intentado, setIntentado] = useState(false)

  const formRef = useRef<HTMLDivElement>(null)
  const pacienteRef = useRef<HTMLInputElement>(null)

  /* Lo que decide «¿está vacío?». La tupla se extiende sobre `isFormEmpty`, así
     que el compilador impide que diverja de su firma.
     ⚠️ SE LLAMA `paraVacio` Y NO `contenido`: `imprimir()` declara su propio
     `contenido` con lo que se manda a imprimir, y dos nombres iguales en dos
     ámbitos anidados es una trampa de lectura. */
  const paraVacio = [estudios, urgente, paciente, pacienteInicial, diagnostico, diagnosticoInicial] as const
  const vacio = isFormEmpty(...paraVacio)

  useEffect(() => { onVacioChange?.(vacio) }, [vacio, onVacioChange])

  // ── Plantillas (spec 02) ────────────────────────────────────────
  // Se guarda TODO menos los datos del paciente: fuera paciente, diagnóstico y
  // fecha. Los estudios se guardan aunque estén a medias —una plantilla es un
  // punto de partida, no un documento— y el filtro del par tipo+región sigue
  // gobernando la emisión, no el guardado.
  const plantillas = usePlantillasDocumento({
    tipo: 'solicitud_imagen',
    vacio,
    // El búnker no tiene red ni sesión de Supabase: el sistema no se monta.
    desactivado: !!offlineMode,
    onPanelChange: onPanelPlantillasChange,
    // Las cuatro cadenas de siempre, compuestas: la plantilla no cambia de forma.
    leer: () => ({ _v: 1, estudios: estudios.map(componer).filter(conTexto), urgente }),
    aplicar: (c: ContenidoPlantilla) => {
      // Solo las claves que existen HOY en el formulario, campo a campo.
      // Los dos valores de repuesto NO son defensa de sobra: «Vaciar
      // formulario» aplica un contenido sin ninguna clave, así que es justo lo
      // que repone el estado inicial. El paciente y el diagnóstico no se tocan
      // aquí, y por eso sobreviven al vaciado.
      // Cada estudio se RECONOCE en el catálogo sólo si al volver a componerse
      // da exactamente el mismo texto; si no, se abre en «Otro» intacto.
      const guardados = Array.isArray(c.estudios)
        ? c.estudios.map(leerEstudio).filter((e): e is Estudio => e !== null).map(interpretar)
        : []
      const filas = guardados.length > 0 ? guardados : [{ ...ESTUDIO_EDITOR_VACIO }]
      const nuevas = filas.map(() => claveNueva())
      setEstudios(filas)
      setClaves(nuevas)
      // Aplicada, todo plegado (se ve la solicitud entera); vaciada, el único
      // estudio queda abierto para escribir.
      setAbierto(filas.length === 1 && estaVacio(filas[0]) ? nuevas[0] : null)
      setUrgente(c.urgente === true)
    },
  })

  // G-10: foco al primer campo editable vacío al montar. preventScroll para no
  // arrastrar la página hasta él. En móvil esto abre el teclado en cada montaje.
  useEffect(() => {
    const primero = formRef.current?.querySelector<HTMLElement>('input:not([type="date"]):not([type="checkbox"])')
    if (primero instanceof HTMLInputElement && !primero.value) primero.focus({ preventScroll: true })
  }, [])

  // ── Solicitud compacta: abrir, plegar, agregar y quitar (como la receta) ──
  const listaRef = useRef<HTMLDivElement>(null)
  const agregarRef = useRef<HTMLButtonElement>(null)
  const indiceDe = (clave: number): number => claves.indexOf(clave)

  /**
   * Enfoca un campo de un estudio ya pintado y lo acerca al borde de arriba,
   * para que el teclado en pantalla no lo tape. En `tel`/`iv` el encabezado
   * fundido flota SOBRE el scroller: el margen es el relleno de arriba del
   * contenido (`.app-contenido`), que ya lo descuenta.
   */
  function enfocarCampo(clave: number, campo: CampoImg) {
    const contenido = formRef.current?.closest<HTMLElement>('.app-contenido')
    const margen = contenido ? parseFloat(getComputedStyle(contenido).paddingTop) || 24 : 24
    enfocarYAcercar(elementoDe(listaRef.current, clave, campo), Math.max(24, margen))
  }

  /** El abierto, si está totalmente vacío y no es el único: al plegarse se quita. */
  function vacioQueSobra(): number | null {
    if (abierto === null || estudios.length < 2) return null
    const i = indiceDe(abierto)
    return i >= 0 && estaVacio(estudios[i]) ? abierto : null
  }

  function quitarSinFoco(clave: number) {
    const i = indiceDe(clave)
    if (i < 0) return
    setEstudios(prev => prev.filter((_, idx) => idx !== i))
    setClaves(prev => prev.filter((_, idx) => idx !== i))
  }

  /** Abre un estudio (plegando el que estuviera abierto) y enfoca un campo. */
  function abrirEn(clave: number, campo: CampoImg = 'buscar') {
    const sobra = vacioQueSobra()
    flushSync(() => {
      if (sobra !== null && sobra !== clave) quitarSinFoco(sobra)
      setAbierto(clave)
    })
    enfocarCampo(clave, campo)
  }

  /**
   * Pliega el abierto al tocar o enfocar FUERA de la lista. Vacío y no único:
   * se quita. Único y vacío: se queda abierto. Si el foco ya volvió dentro de
   * la lista (lo abrió otra acción), no hace nada.
   */
  function plegar() {
    if (abierto === null || listaRef.current?.contains(document.activeElement)) return
    const sobra = vacioQueSobra()
    if (sobra !== null) quitarSinFoco(sobra)
    else if (estudios.length === 1 && estaVacio(estudios[0])) return
    setAbierto(null)
  }
  const plegarRef = useRef(plegar)
  useEffect(() => { plegarRef.current = plegar })

  /* «Plegado al salir»: la escucha compartida (`salidaPlegable.ts`, con la
     causa del defecto del texto de una casilla). */
  useEffect(() => escucharSalida(el => !!(listaRef.current?.contains(el) || agregarRef.current?.contains(el)), () => plegarRef.current()), [])

  /** «Agregar estudio» y Ctrl/⌘+Enter: pliega el actual, crea otro al final y va a su buscador. */
  function agregar() {
    const i = abierto === null ? -1 : indiceDe(abierto)
    if (abierto !== null && i >= 0 && estaVacio(estudios[i])) { enfocarCampo(abierto, 'buscar'); return }
    const k = claveNueva()
    flushSync(() => {
      setEstudios(prev => [...prev, { ...ESTUDIO_EDITOR_VACIO }])
      setClaves(prev => [...prev, k])
      setAbierto(k)
    })
    enfocarCampo(k, 'buscar')
  }

  /** Quitar: el foco va al vecino (el siguiente, o el anterior si era el último), abierto. */
  function quitar(clave: number) {
    const i = indiceDe(clave)
    if (i < 0 || estudios.length < 2) return
    const restantes = claves.filter(k => k !== clave)
    const vecino = restantes[Math.min(i, restantes.length - 1)]
    flushSync(() => { quitarSinFoco(clave); setAbierto(vecino) })
    enfocarCampo(vecino, 'buscar')
  }

  /** Tras una elección (`seguir`), el foco va a lo siguiente que falta o a la indicación. */
  function cambiar(clave: number, nuevo: EstudioEditor, seguir: boolean) {
    const i = indiceDe(clave)
    flushSync(() => setEstudios(prev => prev.map((e, idx) => idx === i ? nuevo : e)))
    if (seguir) enfocarCampo(clave, CAMPO_SIGUIENTE[siguienteCampo(nuevo)])
  }

  // ── Validación (solicitud compacta) ─────────────────────────────
  // Un estudio con datos y a medias bloquea la impresión, se abre y se dice qué
  // le falta (como la receta): tipo y región, el lado donde la región lo lleva
  // y el contraste en TC y RM (salvo angio). «Otro» exige lo de antes: tipo y
  // región. Los estudios del todo vacíos se ignoran.
  const faltasDeCadaUno: Falta[][] = estudios.map(faltasDe)
  const vivos = estudios.filter(e => !estaVacio(e))

  type Faltante = { clave: string; nombre: string; est?: { clave: number; campo: CampoImg } }
  const faltantes: Faltante[] = []
  faltasDeCadaUno.forEach((fs, i) => {
    const k = claves[i]
    const deCual = estudios.length > 1 ? ` (estudio ${i + 1})` : ''
    for (const f of fs) {
      const nombre = f === 'contraste' && estudios[i].modalidad === 'mx' ? 'Tipo de mastografía' : ROTULO_FALTA[f]
      faltantes.push({ clave: `${f}-${k}`, nombre: nombre + deCual, est: { clave: k, campo: campoDeFalta(f, estudios[i]) } })
    }
  })
  if (!paciente.trim()) faltantes.push({ clave: 'paciente', nombre: 'Paciente' })
  if (vivos.length === 0) faltantes.push({ clave: 'estudios', nombre: 'un estudio con tipo y región', est: { clave: claves[0], campo: 'buscar' } })

  function irA(f: Faltante) {
    if (f.est) { abrirEn(f.est.clave, f.est.campo); return }
    enfocarYAcercar(pacienteRef.current)
  }

  async function imprimir() {
    // El primario nunca está gris por faltantes: un botón apagado no enseña qué
    // falta, el banner sí. Al pulsar con faltantes no emite y lleva al primero.
    if (faltantes.length > 0) {
      setIntentado(true)
      irA(faltantes[0])
      return
    }
    flushSync(() => { setErrorGuardado(''); setImprimiendo(true) })

    // 1. Feedback instantáneo
    toast.info('Generando solicitud de imagenología...')

    // 2. Identidad — UUID v4 puro (las solicitudes de imagen no tienen
    //    verificación pública ni folio visible)
    const clientId = crypto.randomUUID()
    // El filtro sobrevive, pero ya no descarta nada en silencio: emitir con un
    // estudio a medias es imposible, y los del todo vacíos se ignoran a
    // propósito (§2.4).
    const completos = vivos.map(componer)
    const contenido = {
      paciente,
      diagnostico,
      estudios: completos,
      urgente,
      fecha,
    }

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
      //    Va con el cliente de SESIÓN del médico, nunca con privilegios de
      //    servicio: el trigger exenta por completo a quien no trae JWT y la
      //    fila quedaría emitida con folio nulo para siempre.
      const supabase = offlineMode ? null : createClient()
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No autenticado')

        const insertPayload: Record<string, unknown> = {
          tipo: 'solicitud_imagen',
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

      // ── 4 · El PDF, ya con el número que la base acaba de asignar ─────
      const fechaFormat = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })

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
        tipo: 'solicitud_imagen',
        pacienteId,
        medico: medicoData,
        data: {
          paciente,
          fecha: fechaFormat,
          diagnostico,
          estudios: completos,
          urgente,
          // En el búnker offline no hay fila ni base, así que llega undefined y
          // el papel sale sin número, igual que hasta ahora.
          folio: folioImpreso('solicitud_imagen', folio),
        },
        logoUrl,
        // IMAGENOLOGÍA Y NO IMAGEN, también en el nombre del archivo: el título
        // del documento cambió en las tres capas a la vez —el PDF, la pantalla y
        // el archivo que se descarga— para que quien busque el papel en su
        // carpeta lo encuentre por el mismo nombre con que lo pidió. Ver
        // `DOCUMENTOS_HANDOFF.md` §8, cambio 4.
        filename: generateDocFileName(paciente, 'Solicitud_Imagenologia'),
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
          tipo: 'solicitud_imagen',
          contenido,
          created_at: new Date().toISOString(),
          medico_id: getOfflineIdentity()?.userId ?? 'anonymous',
          _syncStatus: 'pending',
        })
        toast.success('Solicitud de imagenología guardada en bunker offline')
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
          if (error) console.error('[SolicitudImagenForm] update pdf_url:', error.message)
        }
        toast.success(folio
          ? `Solicitud de imagenología guardada · ${folio}`
          : 'Solicitud de imagenología guardada')
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
      console.error('[SolicitudImagenForm] imprimir falló:', err)
    } finally {
      setImprimiendo(false)
      // También cuando la persistencia falló: el PDF existe y con el paciente
      // enfrente lo urgente es poder imprimirlo.
      if (pdfBlob && !offlineMode) { setDocGenerado({ blob: pdfBlob, guardado, documentoId: filaId }) }
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
        <div className="sp-doc-cardbody sp-lab-datos">
          <div className="sp-doc-grid" data-cols="3">
            <div className="sp-doc-field">
              <label htmlFor="imagen-fecha" className="sp-label-field">Fecha</label>
              <input id="imagen-fecha" type="date" value={fecha}
                min={FECHA_MIN} max={desplazarFecha(hoyEnTZ(TZ_CLINICA), { anios: 1 })}
                onChange={e => setFecha(e.target.value)} className="sp-input" />
            </div>
            <div className="sp-doc-field">
              <label htmlFor="imagen-paciente" className="sp-label-field">
                Paciente <span aria-hidden="true" style={{ color: 'var(--sp-danger)' }}>*</span>
                <span className="sr-only">obligatorio</span>
              </label>
              <input ref={pacienteRef} id="imagen-paciente" type="text" value={paciente}
                onChange={e => setPaciente(e.target.value)} placeholder="Nombre completo"
                aria-invalid={senalar('paciente') || undefined}
                className={`sp-input ${senalar('paciente') ? 'sp-doc-invalid' : ''}`} />
            </div>
            <div className="sp-doc-field">
              <label htmlFor="imagen-diagnostico" className="sp-label-field">Diagnóstico</label>
              <input id="imagen-diagnostico" type="text" value={diagnostico}
                onChange={e => setDiagnostico(e.target.value)} placeholder="Dx de envío" className="sp-input" />
            </div>

            {/* El rojo se reserva al badge, que además es el que sale en el PDF:
                la etiqueta entera en rojo competía con los errores de campo. */}
            <div className="sp-doc-span-all">
              <label className="sp-check">
                <input type="checkbox" checked={urgente}
                  onChange={e => setUrgente(e.target.checked)} className="sr-only" />
                <span className="sp-check__box"><Check aria-hidden="true" /></span>
                <span className="sp-check__label">Marcar como urgente</span>
                {urgente && <span className="sp-badge sp-badge--danger">URGENTE</span>}
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Solicitud compacta (maqueta `solicitud-imagen.html`, aprobada por el
          dueño): un estudio abierto, los demás plegados a una línea. El editor
          pide sólo lo que aplica al tipo y la región. Sin «Frecuentes»
          (decisión del dueño). Todo local, sin red (lo comparte el búnker). */}
      <section className="sp-card sp-doc-card sp-rx sp-img">
        <div className="sp-doc-cardhead">
          <div className="sp-icobox sp-icobox--sm"><ScanLine /></div>
          <h2 className="sp-label">Estudios de imagen</h2>
        </div>
        <div className="sp-doc-cardbody sp-rx-cuerpo">
          <div ref={listaRef} className="sp-rx-meds">
            {estudios.map((e, i) => {
              const k = claves[i]
              return k === abierto ? (
                <EditorEstudioImagen key={k} numero={i + 1} clave={k} estudio={e}
                  faltas={intentado ? faltasDeCadaUno[i] : []} puedeQuitar={estudios.length > 1}
                  onCambio={(nuevo, seguir) => cambiar(k, nuevo, seguir)}
                  onQuitar={() => quitar(k)} onAgregar={agregar} />
              ) : (
                <LineaEstudioImagen key={k} numero={i + 1} estudio={e} faltas={faltasDeCadaUno[i]}
                  onAbrir={() => abrirEn(k)} />
              )
            })}
          </div>
        </div>
        <div className="sp-rx-agregar">
          <button ref={agregarRef} type="button" onClick={agregar} className="k-b k-b-tonal sp-rx-agregar-b">
            <Plus aria-hidden="true" /> Agregar estudio
            <span className="sp-rx-atajo" aria-hidden="true"><kbd>Ctrl</kbd><kbd>Enter</kbd></span>
          </button>
        </div>
      </section>

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
                <button type="button" onClick={() => irA(f)}
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
        titulo="Solicitud de imagenología generada"
        guardadoEnExpediente={docGenerado?.guardado ?? false}
        documentoId={docGenerado?.documentoId ?? null}
      />
    </div>
  )
}
