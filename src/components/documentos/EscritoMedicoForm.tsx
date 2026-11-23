'use client'
import { generateDocFileName } from '@/lib/patientUtils'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'
import { useConsultorioActivo } from '@/contexts/ConsultorioActivoContext'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { AlertTriangle, Plus, X } from 'lucide-react'
import PieAccionesDocumento from '@/components/documentos/PieAccionesDocumento'
import { flushSync } from 'react-dom'
import { generarPdf, VERSION_DE_EMISION, versionQueEmite } from '@/lib/mobileShare'
import { useToast } from '@/components/ui/Toast'
import ModalShell from '@/components/ui/ModalShell'
import ModalDocumentoGenerado from '@/components/documentos/ModalDocumentoGenerado'
import EditorEscrito from '@/components/documentos/EditorEscrito'
import { usePlantillasDocumento, type ContenidoPlantilla } from '@/components/documentos/PlantillasDocumento'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { hoyEnTZ, desplazarFecha, TZ_CLINICA } from '@/lib/dates'
import { enfocarYAcercar } from '@/lib/scrollDoc'
import DOMPurify from 'dompurify'
import { decodificarNbsp } from '@/lib/textUtils'

import { useEditor } from '@tiptap/react'
import { generateHTML, type JSONContent } from '@tiptap/core'
import { editorExtensions } from '@/lib/documentos/editorExtensions'
import { DOMParser as PMDOMParser, Slice } from '@tiptap/pm/model'
import { contarPalabras, htmlPegadoAlEsquema, markdownAHtml } from '@/lib/documentos/pegadoEscrito'

const FECHA_MIN = '1900-01-01'

// Sanitización con DOMPurify — cubre SVG scripts, iframes, event handlers
// y todos los vectores de XSS conocidos.
// `blockquote` entra en la lista con el control de cita (§5): sin él, DOMPurify
// desenvolvía la etiqueta y la cita llegaba al campo `cuerpo` como párrafo raso.
function sanitizeEditorHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'h2', 'h3', 'div', 'span', 'hr', 'ul', 'ol', 'li', 'blockquote'],
    ALLOWED_ATTR: ['style', 'class'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'link'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'onfocus'],
  })
}

// Aplana el HTML producido por TipTap para que el parser regex actual
// de EscritoMedicoPdf.tsx (Phase 3 lo reemplaza) no pierda información:
//   <h1> → <h2>     (parser legacy solo conoce h2/h3)
//   <ul><li>x</li>… → <p>• x</p>…
//   <ol><li>x</li>… → <p>1. x</p>…
// Listas anidadas no soportadas — se aplanan al primer nivel.
// Las alineaciones quedan como style="text-align:…" e igual son
// ignoradas por el parser legacy (mismo comportamiento que pre-refactor).
// TEMPORAL — se elimina junto al campo `cuerpo` en Phase 5.
function postProcesarParaParserLegacy(html: string): string {
  let out = html
  out = out.replace(/<h1(\s[^>]*)?>/gi, '<h2$1>').replace(/<\/h1>/gi, '</h2>')
  out = out.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_m, inner: string) => {
    const items = (inner.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [])
      .map(li => li
        .replace(/<\/?li(?:\s[^>]*)?>/gi, '')
        .replace(/<\/?p(?:\s[^>]*)?>/gi, '')
        .trim()
      )
    return items.map(t => `<p>• ${t}</p>`).join('')
  })
  out = out.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_m, inner: string) => {
    const items = (inner.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? [])
      .map(li => li
        .replace(/<\/?li(?:\s[^>]*)?>/gi, '')
        .replace(/<\/?p(?:\s[^>]*)?>/gi, '')
        .trim()
      )
    return items.map((t, i) => `<p>${i + 1}. ${t}</p>`).join('')
  })
  return out
}

/**
 * Documento guardado en una plantilla. Llega de `jsonb` y pudo escribirse con
 * otra versión del formulario, así que se comprueba antes de dárselo al editor.
 */
function leerDoc(bruto: unknown): JSONContent | null {
  if (typeof bruto !== 'object' || bruto === null) return null
  const d = bruto as Record<string, unknown>
  return d.type === 'doc' && Array.isArray(d.content) ? (d as JSONContent) : null
}

/**
 * Predicado único de «formulario vacío». Mismo criterio que Laboratorio: lo que
 * llega prellenado de la ficha NO cuenta como escrito hasta que se edita.
 *
 * La fecha no entra —llega sola— y el título del pie tampoco mientras siga
 * enganchado al título: enganchado no tiene valor propio, copia.
 */
function isFormEmpty(
  cuerpoVacio: boolean, asunto: string,
  piePropio: string, pieEnganchado: boolean,
  paciente: string, pacienteInicial: string,
): boolean {
  const pacienteIntacto = paciente.trim() === '' || paciente.trim() === pacienteInicial.trim()
  const pieIntacto = pieEnganchado || piePropio.trim() === ''
  return pacienteIntacto && asunto.trim() === '' && pieIntacto && cuerpoVacio
}

interface Props {
  pacienteInicial?: string
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

export default function EscritoMedicoForm({ pacienteInicial = '', pacienteId, offlineMode, onOfflineSave, onVacioChange, onCerrarTrasEmitir, onPanelPlantillasChange }: Props) {
  const { medicoInfo: onlineMedicoInfo, isLoading: cargandoPerfil } = useMedicoInfo()
  const { consultorioActivo } = useConsultorioActivo()

  // En offline mode, leer perfil del médico de localStorage (pre-fetched
  // con assets en Base64).
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
  const [paciente, setPaciente]       = useState(pacienteInicial)
  // `TZ_CLINICA` explícito, no el huso del dispositivo: este inicializador de
  // `useState` corre TAMBIÉN en la pasada de SSR, donde `tzDispositivo()`
  // devolvería UTC de Vercel y el cliente lo corregiría al hidratar — fecha
  // parpadeante en un formulario que emite un documento legal. Y la fecha del
  // documento es de la clínica de todos modos (LA REGLA, en `@/lib/dates`).
  const [fecha, setFecha]             = useState(hoyEnTZ(TZ_CLINICA))
  const [asunto, setAsunto]           = useState('')
  // El pie NO es un truncado del título: recortar por caracteres produce
  // «Constancia de atención médica y valoración ortopé…», que no identifica
  // nada. Es un segundo campo que copia al título mientras nadie lo toque, y en
  // cuanto se edita se desengancha. Dos estados y no uno: el valor mostrado se
  // deriva de ellos, así que no pueden desincronizarse.
  const [piePropio, setPiePropio]         = useState('')
  const [pieEnganchado, setPieEnganchado] = useState(true)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [errorAbierto, setErrorAbierto] = useState(false)
  const [docGenerado, setDocGenerado] = useState<{ blob: Blob; guardado: boolean; documentoId: string | null } | null>(null)
  // El banner de faltantes NO existe hasta el primer intento de imprimir: un
  // formulario recién abierto no acusa de nada. Después permanece y se
  // actualiza en vivo.
  const [intentado, setIntentado] = useState(false)
  // La hoja (maqueta aprobada): «Paciente · fecha · Cambiar» se abre para editar;
  // «＋ Título del pie» aparece al pedirlo (o si ya tiene valor propio).
  const [editandoDatos, setEditandoDatos] = useState(false)
  const [pieVisible, setPieVisible] = useState(false)
  const hojaRef = useRef<HTMLElement>(null)

  const formRef = useRef<HTMLDivElement>(null)
  /** El último atajo fue Ctrl/⌘+Mayús+V: el pegado que sigue va sin formato. */
  const sinFormatoRef = useRef(false)

  const editor = useEditor({
    extensions: editorExtensions,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'sp-ed-prose' },
      /*
       * MARKDOWN PEGADO COMO TEXTO PLANO → FORMATO REAL. Sólo cuando el
       * portapapeles NO trae HTML (con HTML manda el HTML, como siempre) y no se
       * pegó con Ctrl/⌘+Mayús+V, que sigue pegando sin formato. Sin estructura
       * Markdown, `markdownAHtml` devuelve `null` y el pegado es el de siempre.
       * El HTML resultante lo parsea el ESQUEMA del editor: no entra nada que el
       * editor no sepa ya representar.
       */
      /*
       * Del HTML pegado, antes de parsearlo: las tablas llegaban con las celdas
       * fundidas en un párrafo y ahora son renglones («campo: valor»), y `h4`–`h6`
       * caían a párrafo y ahora son Subtítulo. Ver `htmlPegadoAlEsquema`.
       */
      transformPastedHTML: html => htmlPegadoAlEsquema(html),
      handleKeyDown: (_vista, e) => {
        sinFormatoRef.current = (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'v'
        return false
      },
      handlePaste: (vista, e) => {
        const sinFormato = sinFormatoRef.current
        sinFormatoRef.current = false
        const datos = e.clipboardData
        if (sinFormato || !datos || datos.getData('text/html')) return false
        const html = markdownAHtml(datos.getData('text/plain'))
        if (html === null) return false
        const caja = document.createElement('div')
        caja.innerHTML = html
        // Trozo CERRADO (bloques enteros): uno abierto fundía el primer bloque
        // pegado —p. ej. un «## Título»— con el párrafo donde estaba el cursor.
        const pegado = PMDOMParser.fromSchema(vista.state.schema).parse(caja)
        vista.dispatch(vista.state.tr.replaceSelection(new Slice(pegado.content, 0, 0)).scrollIntoView())
        return true
      },
    },
  })

  const isEmpty = editor?.isEmpty ?? true
  const palabras = editor ? contarPalabras(editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ', ' ')) : 0
  const bloques = editor?.state.doc.childCount ?? 0
  const tituloPie = pieEnganchado ? asunto : piePropio

  /* Lo que decide «¿está vacío?». La tupla se extiende sobre `isFormEmpty`, así
     que el compilador impide que diverja de su firma.
     ⚠️ SE LLAMA `paraVacio` Y NO `contenido`: `imprimir()` declara su propio
     `contenido` con lo que se manda a imprimir, y dos nombres iguales en dos
     ámbitos anidados es una trampa de lectura. */
  const paraVacio = [isEmpty, asunto, piePropio, pieEnganchado, paciente, pacienteInicial] as const
  const vacio = isFormEmpty(...paraVacio)

  useEffect(() => { onVacioChange?.(vacio) }, [vacio, onVacioChange])

  // ── Plantillas (spec 02) ────────────────────────────────────────
  // Se guarda TODO menos los datos del paciente: aquí eso deja fuera paciente y
  // fecha. El título, el título del pie y el cuerpo SÍ entran — en este formato
  // la plantilla es justamente el escrito anterior, que es de lo que casi
  // siempre se parte.
  //
  // El cuerpo se guarda como JSON de ProseMirror y no como HTML, y eso cierra
  // el NO DEFINIDO del sanitizador de la guía §8: no hay HTML que sanear al
  // aplicar, porque lo que filtra es el esquema del editor. El sanitizador que
  // sigue en uso, para el campo `cuerpo` del documento emitido, es DOMPurify.
  const plantillas = usePlantillasDocumento({
    tipo: 'escrito_medico',
    vacio,
    // El búnker no tiene red ni sesión de Supabase: el sistema no se monta.
    desactivado: !!offlineMode,
    onPanelChange: onPanelPlantillasChange,
    leer: () => ({ _v: 1, asunto, piePropio, pieEnganchado, doc: editor?.getJSON() ?? null }),
    aplicar: (c: ContenidoPlantilla) => {
      // Solo las claves que existen HOY, y comprobando el tipo de cada una. Los
      // `else` NO son defensa de sobra: «Vaciar formulario» aplica un contenido
      // sin ninguna clave, así que son justo lo que repone el estado inicial. El
      // paciente y la fecha no se tocan aquí, y por eso sobreviven al vaciado.
      setAsunto(typeof c.asunto === 'string' ? c.asunto : '')
      setPiePropio(typeof c.piePropio === 'string' ? c.piePropio : '')
      setPieEnganchado(typeof c.pieEnganchado === 'boolean' ? c.pieEnganchado : true)
      const doc = leerDoc(c.doc)
      try {
        if (doc) editor?.commands.setContent(doc, false)
        else editor?.commands.clearContent()
      } catch (err) {
        editor?.commands.clearContent()
        toast.error('El cuerpo de esa plantilla no se pudo abrir. El resto sí se aplicó.')
        console.error('[EscritoMedicoForm] setContent falló:', err)
      }
    },
  })

  // G-10: foco al primer campo editable vacío al montar. preventScroll para no
  // arrastrar la página hasta él. En móvil esto abre el teclado en cada montaje.
  useEffect(() => {
    const primero = formRef.current?.querySelector<HTMLElement>('input:not([type="date"]), textarea')
    if (primero instanceof HTMLInputElement && !primero.value) primero.focus({ preventScroll: true })
  }, [])

  /**
   * EL ALTO DE LA HOJA: el del área de contenido menos sus rellenos de arriba y
   * de abajo, los avisos que sigan a la hoja y el pie de acciones, medido (nada de alturas mágicas: el relleno de
   * `.app-contenido` cambia por formato y lleva las franjas). Con el teclado en
   * pantalla (iPad/teléfono) manda `visualViewport`, para que el cursor no quede
   * bajo el teclado; entonces el pie de acciones queda detrás de él y no cuenta.
   * Sin `<main>` (el búnker), la ventana.
   */
  useEffect(() => {
    const hoja = hojaRef.current
    if (!hoja) return
    const main = hoja.closest('main')
    const medir = (): void => {
      const cont = hoja.closest<HTMLElement>('.app-contenido')
      const pie = formRef.current?.querySelector<HTMLElement>('.sp-doc-actions')
      const arriba = cont ? parseFloat(getComputedStyle(cont).paddingTop) || 0 : 0
      const ventana = main?.clientHeight ?? window.innerHeight
      const vv = window.visualViewport
      const teclado = vv !== null && ventana - vv.height > 120
      const visible = teclado && vv ? vv.height : ventana
      // Al fondo del desplazamiento, bajo la hoja van —en flujo— los avisos que
      // haya, el pie y el relleno de abajo de `.app-contenido` (que lleva la
      // franja): todo eso se resta, o la hoja (sticky) los tapa (auditoría H1).
      const hueco = parseFloat(getComputedStyle(hoja.parentElement ?? hoja).rowGap) || 0
      let entre = 0
      for (let el = hoja.nextElementSibling; el && el !== pie; el = el.nextElementSibling) {
        if (el instanceof HTMLElement && el.offsetHeight > 0) entre += el.offsetHeight + hueco
      }
      const relleno = cont ? parseFloat(getComputedStyle(cont).paddingBottom) || 0 : 0
      const abajo = teclado ? 8 : entre + (pie?.offsetHeight ?? 0) + hueco + relleno
      hoja.style.setProperty('--esc-arriba', `${arriba}px`)
      hoja.style.setProperty('--esc-alto', `${Math.max(280, Math.round(visible - arriba - abajo))}px`)
    }
    medir()
    const ro = new ResizeObserver(medir)
    if (main) ro.observe(main)
    const pie = formRef.current?.querySelector('.sp-doc-actions')
    if (pie) ro.observe(pie)
    // El cuerpo del formulario crece cuando aparece un aviso entre hoja y pie.
    const cuerpo = hoja.parentElement
    if (cuerpo) ro.observe(cuerpo)
    window.visualViewport?.addEventListener('resize', medir)
    window.addEventListener('resize', medir)
    return () => {
      ro.disconnect()
      window.visualViewport?.removeEventListener('resize', medir)
      window.removeEventListener('resize', medir)
    }
  }, [])

  /**
   * Al ENTRAR a escribir en el cuerpo, la hoja sube hasta quedar pegada arriba:
   * así se ve entera —título, barra, cuerpo y su pie— y desde ahí sólo se
   * desplaza el cuerpo. Antes de escribir, la cabecera de la página sigue a la
   * vista (el foco inicial no la esconde).
   */
  useEffect(() => {
    if (!editor) return
    const pegar = (): void => {
      const hoja = hojaRef.current
      const main = hoja?.closest('main')
      if (!hoja || !main) return
      const arriba = parseFloat(hoja.style.getPropertyValue('--esc-arriba')) || 0
      const delta = hoja.getBoundingClientRect().top - main.getBoundingClientRect().top - arriba
      if (delta > 1) main.scrollBy({ top: delta, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
    editor.on('focus', pegar)
    return () => { editor.off('focus', pegar) }
  }, [editor])

  /** Enter en los datos los cierra y lleva al título. */
  function teclaDatos(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') { e.preventDefault(); cerrarDatos() }
  }
  function cerrarDatos(): void {
    flushSync(() => setEditandoDatos(false))
    document.getElementById('escrito-titulo')?.focus()
  }

  function editarPie(valor: string): void {
    setPieEnganchado(false)
    setPiePropio(valor)
  }

  /** Vuelve a engancharlo. El valor propio se descarta: reengancharse es eso. */
  function reengancharPie(): void {
    setPieEnganchado(true)
    setPiePropio('')
  }

  async function imprimir() {
    // El primario nunca está gris por faltantes: un botón apagado no enseña qué
    // falta, el banner sí. Al pulsar con el cuerpo vacío no emite y lleva a él.
    if (!editor || editor.isEmpty) {
      setIntentado(true)
      enfocarYAcercar(formRef.current?.querySelector<HTMLElement>('.sp-ed-prose') ?? null)
      return
    }

    const docJson      = editor.getJSON()
    const htmlBruto    = generateHTML(docJson, editorExtensions)
    const htmlAplanado = postProcesarParaParserLegacy(htmlBruto)
    const cuerpoSanitizado = decodificarNbsp(sanitizeEditorHtml(htmlAplanado))
    if (!cuerpoSanitizado.trim()) return

    const asuntoLimpio = decodificarNbsp(asunto)
    const pieLimpio    = decodificarNbsp(tituloPie)

    flushSync(() => { setErrorGuardado(''); setImprimiendo(true) })
    toast.info('Generando escrito médico...')

    const clientId = crypto.randomUUID()
    const docContenido = {
      paciente,
      fecha,
      asunto: asuntoLimpio,
      tituloPie: pieLimpio,
      doc: { schema: 'tiptap-doc-v1' as const, content: docJson },
      cuerpo: cuerpoSanitizado,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }

    // El blob y el desenlace de la persistencia se leen en el finally para
    // montar el modal posterior a la generación. Ver ModalDocumentoGenerado.
    let pdfBlob: Blob | null = null
    let guardado = false
    let filaId: string | null = null

    try {
      // ── LA FILA PRIMERO ───────────────────────────────────────────────
      //    Invierte el orden que este formulario tenía —PDF, subida, fila—,
      //    como los otros seis. **Aquí no hay folio que ganar y se invierte
      //    igual**: el escrito médico es el único formato sin clase de folio —el
      //    generador no lo contempla y su columna queda NULL, porque no son
      //    documentos seriados—. Lo que se gana es un solo orden en los siete
      //    formularios: quien lea el siguiente no tiene que averiguar cuál de
      //    los dos sigue este.
      const supabase = offlineMode ? null : createClient()
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('No autenticado')

        const insertPayload: Record<string, unknown> = {
          tipo: 'escrito_medico',
          contenido: docContenido,
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
          .select('id')
          .single()
        if (error) throw error
        filaId = data.id
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
      const fechaFmt = format(new Date(fecha + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: es })

      const consultorioData = consultorioActivo ? {
        nombre: consultorioActivo.nombre,
        direccion: consultorioActivo.direccion,
        telefono: consultorioActivo.telefono,
      } : undefined

      const { blob, storagePath } = await generarPdf({
        tipo: 'escrito_medico',
        pacienteId,
        medico: medicoData,
        // `tituloPie` viaja ya: el renderizador v1 lo ignora y el formato v2 lo
        // compone. Ver la nota del pie en el informe del paso.
        data: { paciente, fecha: fechaFmt, asunto: asuntoLimpio, tituloPie: pieLimpio, cuerpo: cuerpoSanitizado, doc: { schema: 'tiptap-doc-v1' as const, content: docJson } },
        logoUrl,
        filename: generateDocFileName(paciente, 'Escrito_Medico'),
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
          tipo: 'escrito_medico',
          contenido: docContenido,
          created_at: new Date().toISOString(),
          medico_id: getOfflineIdentity()?.userId ?? 'anonymous',
          _syncStatus: 'pending',
        })
        toast.success('Escrito medico guardado en bunker offline')
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
          if (error) console.error('[EscritoMedicoForm] update pdf_url:', error.message)
        }
        toast.success('Escrito guardado')
      }
    } catch (err) {
      // Tres desenlaces, como en los otros seis, y sin folio que citar en el del
      // medio: este formato no lo tiene.
      let msg: string
      if (offlineMode) {
        msg = 'No se pudo generar el PDF. Intenta de nuevo.'
      } else if (filaId === null) {
        msg = 'No se pudo guardar el escrito, así que no se generó el PDF. Intenta de nuevo.'
      } else {
        msg = 'El escrito quedó registrado, pero no se pudo generar el PDF. Búscalo en la lista de '
          + 'documentos del paciente y recupéralo desde ahí.'
      }
      setErrorGuardado(msg)
      setErrorAbierto(true)
      console.error('[EscritoMedicoForm] imprimir falló:', err)
    } finally {
      setImprimiendo(false)
      // También cuando la persistencia falló: el PDF existe y con el paciente
      // enfrente lo urgente es poder imprimirlo.
      if (pdfBlob && !offlineMode) { setDocGenerado({ blob: pdfBlob, guardado, documentoId: filaId }) }
    }
  }

  return (
    <div ref={formRef} className="sp-doc-form">
      {/* El árbol del formulario NO se desmonta cuando el panel de plantillas
          está abierto: se apaga con display:none y el panel se monta como
          hermano, en el mismo contenedor de scroll (spec 02 §3.1). Aquí importa
          el doble: desmontarlo tiraría la instancia de TipTap y con ella el
          texto que el médico lleve escrito. */}
      <div className="sp-doc-formbody" style={plantillas.panelAbierto ? { display: 'none' } : undefined}>

      {plantillas.selector}

      {/* LA HOJA (maqueta `escrito.html`, aprobada): datos en una línea, el
          título como título, la barra y el cuerpo. Mide el alto disponible del
          área de contenido (`--esc-alto`, ver el efecto de arriba) y SOLO el
          cuerpo se desplaza: título y barra quedan siempre a la vista. */}
      <section ref={hojaRef} className="sp-esc-hoja" aria-label="Escrito">
        {editandoDatos ? (
          <div className="sp-esc-datos">
            {/* Único junto a Honorarios que puede emitirse sin paciente: una carta
                de recomendación o un resumen para un colega no siempre son de un
                paciente del sistema. */}
            <div className="sp-rx-campo">
              <label htmlFor="escrito-paciente" className="sp-rx-rot">Paciente</label>
              <input id="escrito-paciente" type="text" value={paciente} autoComplete="off"
                onChange={e => setPaciente(e.target.value)} onKeyDown={teclaDatos}
                placeholder="Sin paciente" aria-label="Paciente (opcional)" className="sp-rx-fi" />
            </div>
            <div className="sp-rx-campo">
              <label htmlFor="escrito-fecha" className="sp-rx-rot">Fecha</label>
              <input id="escrito-fecha" type="date" value={fecha}
                min={FECHA_MIN} max={desplazarFecha(hoyEnTZ(TZ_CLINICA), { anios: 1 })}
                onChange={e => setFecha(e.target.value)} onKeyDown={teclaDatos} className="sp-rx-fi" />
            </div>
            <button type="button" onClick={cerrarDatos} className="k-b k-b-tonal sp-esc-listo">Listo</button>
            {!paciente.trim() && <p className="sp-esc-nota">Se puede emitir sin paciente</p>}
          </div>
        ) : (
          <button type="button" className="sp-esc-meta" aria-expanded={false}
            onClick={() => { flushSync(() => setEditandoDatos(true)); document.getElementById('escrito-paciente')?.focus() }}>
            <b>{paciente.trim() || 'Sin paciente'}</b>
            <span aria-hidden="true">·</span>
            <span>{fecha ? format(new Date(fecha + 'T12:00:00'), "d 'de' MMMM 'de' yyyy", { locale: es }) : 'Sin fecha'}</span>
            <span className="sp-esc-cambiar">Cambiar</span>
          </button>
        )}

        {/* Es `asunto` renombrado y no un campo nuevo: la clave de `contenido` no
            cambia. Sin asterisco y sin validación: vacío es un caso legítimo.
            Enter (o ↓) pasa al cuerpo. */}
        <input id="escrito-titulo" type="text" value={asunto} autoComplete="off"
          onChange={e => setAsunto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); editor?.commands.focus('start') } }}
          placeholder="Título del documento" aria-label="Título del documento"
          aria-describedby="escrito-titulo-nota" className="sp-esc-titulo" />
        <span id="escrito-titulo-nota" className="sr-only">
          {asunto.trim() === ''
            ? 'Sin título, el documento arranca con el cuerpo bajo el filete del membrete.'
            : 'Encabeza el documento. Puede quedar vacío.'}
        </span>

        <EditorEscrito editor={editor} />

        <div className="sp-esc-pieh">
          {pieVisible || !pieEnganchado ? (
            <div className="sp-esc-piecampo">
              <div className="sp-rx-campo">
                <label htmlFor="escrito-pie" className="sp-rx-rot">Pie</label>
                <input id="escrito-pie" type="text" value={tituloPie} autoComplete="off"
                  onChange={e => editarPie(e.target.value)} placeholder="Igual que el título"
                  aria-label="Título del pie" aria-describedby="escrito-pie-nota" className="sp-rx-fi" />
                {!pieEnganchado && (
                  <button type="button" onClick={reengancharPie} className="k-b k-b-texto sp-esc-usar">Usar el título</button>
                )}
                <button type="button" tabIndex={-1} aria-label="Quitar el título del pie" className="k-b k-b-icono sp-int-quitar"
                  onClick={() => { reengancharPie(); setPieVisible(false) }}>
                  <X aria-hidden="true" />
                </button>
              </div>
              <p id="escrito-pie-nota" className="sp-esc-nota">
                Se imprime en el pie de cada página. Por defecto copia el título; en cuanto lo editas, deja de seguirlo.
              </p>
            </div>
          ) : (
            <button type="button" className="k-b k-b-texto"
              onClick={() => { flushSync(() => setPieVisible(true)); document.getElementById('escrito-pie')?.focus() }}>
              <Plus aria-hidden="true" /> Título del pie
            </button>
          )}
          {/* Sirve sobre todo tras aplicar una plantilla: dice de un vistazo
              cuánto trajo. Sin estimar páginas: no se sabe sin componer el PDF. */}
          <span className="sp-esc-cnt" aria-live="polite">
            {isEmpty ? 'Vacío' : `${palabras} ${palabras === 1 ? 'palabra' : 'palabras'} · ${bloques} ${bloques === 1 ? 'bloque' : 'bloques'}`}
          </span>
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

      {intentado && isEmpty && (
        <p className="sp-banner sp-banner--warn" aria-live="polite">
          <AlertTriangle size={17} />
          <span>Falta el cuerpo del escrito. Es el único campo obligatorio.</span>
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
        titulo="Escrito médico generado"
        guardadoEnExpediente={docGenerado?.guardado ?? false}
        documentoId={docGenerado?.documentoId ?? null}
      />
    </div>
  )
}
