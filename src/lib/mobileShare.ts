/**
 * Genera PDFs 100% en el CLIENTE con @react-pdf/renderer.
 * Sin dependencia del servidor — funciona online y offline.
 *
 * Estrategia de entrega: una sola, en todas las plataformas — abrir el PDF en
 * una pestaña nueva con el visor nativo del navegador, desde donde el usuario
 * decide imprimir, descargar o cerrar sin guardar.
 *
 * Hubo una segunda rama, para móvil, que ofrecía la hoja de compartir del
 * sistema vía navigator.share. Se eliminó: entraba por detección de user agent
 * (que no reconocía al iPad desde iPadOS 13) y, sobre todo, navigator.share
 * exige activación transitoria igual que la apertura de pestaña. Como la fase 6
 * corre después de segundos de trabajo asíncrono, el gesto ya está gastado, el
 * share lanza NotAllowedError y caía al mismo abrirBlobEnPestana. Aterrizaba
 * donde aterriza esto, con un rodeo.
 *
 * generarPdf() — genera PDF vía react-pdf en todas las plataformas.
 */

import type { PdfMedicoData, PdfConsultorioData } from '@/lib/pdf/PdfStyles'

type DocType =
  | 'solicitud_lab'
  | 'solicitud_imagen'
  | 'receta'
  | 'plan_suplementacion'
  | 'nota_honorarios'
  | 'solicitud_internamiento'
  | 'escrito_medico'
  | 'consentimiento_informado'
  | 'denegacion_consentimiento'
  | 'nota_evolucion'
  | 'expediente_completo'

/** Guard de concurrencia — evita ejecuciones paralelas por multi-clic */
let isGenerating = false

/**
 * QUÉ VERSIONES DE CHASIS SABE COMPONER ESTA COMPILACIÓN, POR FORMATO.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 *
 * Un documento se emite con un chasis y **se reimprime con ese mismo chasis o
 * no es el mismo documento** (`DOCUMENTOS_SPEC.md` §I.3.9). Con v2 encendido
 * conviven en la tabla filas de las dos versiones, así que el botón de
 * regenerar tiene que leer `documentos.formato_version` y pedir esa: los mil y
 * pico documentos v1 no pueden perder su botón porque el generador haya
 * avanzado, y un v2 no puede salir con la cara de v1.
 *
 * ── POR QUÉ UN CONJUNTO Y NO UNA CONSTANTE ──────────────────────────────────
 *
 * `ModalDocumentos` guardaba `FORMATO_VERSION_GENERADOR = 1`, un número suelto
 * con una nota que pedía acordarse de moverlo el día que este `switch`
 * ramificara. Un espejo manual es una promesa, no una garantía. Aquí la
 * pregunta se responde donde vive la respuesta, y `puedeComponer()` es lo único
 * que el modal necesita saber.
 *
 * ── ESTADO HOY: SOLO v1, EN LOS ONCE ────────────────────────────────────────
 *
 * Ningún formato tiene todavía adaptador v2 —los nueve componentes de
 * `src/lib/pdf/v2/formatos/` reciben props tipadas y nadie construye esas props
 * desde el `contenido` que guardan los formularios—, y **ninguna fila puede
 * traer 2**: la columna `formato_version` no está aplicada y nada la escribe.
 * Así que este mapa describe la realidad y no la anticipa. Cada formato entra
 * en la lista de v2 en el mismo commit que su adaptador, ni antes ni después.
 */
const VERSIONES_POR_TIPO: Readonly<Record<string, readonly number[]>> = {
  receta: [1],
  solicitud_lab: [1],
  solicitud_imagen: [1],
  plan_suplementacion: [1],
  nota_honorarios: [1],
  solicitud_internamiento: [1],
  escrito_medico: [1],
  consentimiento_informado: [1],
  denegacion_consentimiento: [1],
  nota_evolucion: [1],
  expediente_completo: [1],
}

/** Chasis con el que se emite un documento nuevo mientras v2 esté apagado. */
export const FORMATO_VERSION_POR_DEFECTO = 1

/**
 * ¿Puede esta compilación reproducir este documento con SU chasis?
 *
 * Lo pregunta el botón de regenerar antes de intentarlo. Un `false` no es un
 * error: es un documento emitido con un chasis que este build no lleva —o un
 * tipo que no genera PDF, como una subida clínica— y la respuesta correcta es
 * decirlo, no imprimir otra cosa.
 */
export function puedeComponer(tipo: string, formatoVersion: number): boolean {
  return VERSIONES_POR_TIPO[tipo]?.includes(formatoVersion) ?? false
}

/**
 * Importa dinámicamente el renderer correcto y genera el elemento react-pdf.
 *
 * ── PUNTO ÚNICO DE RAMIFICACIÓN v1 / v2 ─────────────────────────────────────
 * Este `switch` es el lugar donde se decide entre el renderer v1
 * (`@/lib/pdf/…`) y el v2 (`@/lib/pdf/v2/…`) de cada formato. No hay otro punto
 * en el que la app elija renderer: los 12 call sites de `generarPdf` pasan por
 * aquí.
 *
 * **La versión entra por parámetro y no se deduce de nada**: quien emite la
 * decide por el flag del médico, quien regenera la lee de la fila. Deducirla
 * aquí —de una constante global, del flag, de lo que sea— haría que el mismo
 * documento se compusiera distinto según cuándo se pida, que es exactamente lo
 * que la inmutabilidad prohíbe.
 *
 * HOY SIEMPRE CAE EN v1 porque ningún formato tiene adaptador v2 todavía; ver
 * `VERSIONES_POR_TIPO`. La guarda de arriba es lo que impide que un documento
 * v2 se cuele por la rama de v1 el día que existan filas con 2.
 */
async function buildClientElement(
  tipo: string,
  medico: PdfMedicoData | null,
  data: Record<string, unknown>,
  formatoVersion: number,
  logoUrl?: string,
  consultorio?: PdfConsultorioData,
) {
  const props = { medico, data, logoUrl, consultorio }

  // Un tipo que este build no sabe componer en esa versión no se compone «casi
  // bien»: no se compone. `generarPdf` lo convierte en el mismo error que un
  // tipo desconocido, que es lo que es.
  if (!puedeComponer(tipo, formatoVersion)) return null

  switch (tipo as DocType) {
    case 'receta': {
      const { renderReceta } = await import('@/lib/pdf/RecetaPdf')
      return renderReceta({ medico: props.medico, data: props.data as never, logoUrl: props.logoUrl, consultorio: props.consultorio })
    }
    case 'solicitud_lab': {
      const { renderSolicitudLab } = await import('@/lib/pdf/SolicitudLabPdf')
      return renderSolicitudLab({ medico: props.medico, data: props.data as never, logoUrl: props.logoUrl, consultorio: props.consultorio })
    }
    case 'solicitud_imagen': {
      const { renderSolicitudImagen } = await import('@/lib/pdf/SolicitudImagenPdf')
      return renderSolicitudImagen({ medico: props.medico, data: props.data as never, logoUrl: props.logoUrl, consultorio: props.consultorio })
    }
    case 'plan_suplementacion': {
      const { renderPlanSuplementacion } = await import('@/lib/pdf/PlanSuplementacionPdf')
      return renderPlanSuplementacion({ medico: props.medico, data: props.data as never, logoUrl: props.logoUrl, consultorio: props.consultorio })
    }
    case 'nota_honorarios': {
      const { renderNotaHonorarios } = await import('@/lib/pdf/NotaHonorariosPdf')
      return renderNotaHonorarios({ medico: props.medico, data: props.data as never, logoUrl: props.logoUrl, consultorio: props.consultorio })
    }
    case 'solicitud_internamiento': {
      const { renderSolicitudInternamiento } = await import('@/lib/pdf/SolicitudInternamientoPdf')
      return renderSolicitudInternamiento({ medico: props.medico, data: props.data as never, logoUrl: props.logoUrl, consultorio: props.consultorio })
    }
    case 'escrito_medico': {
      const { renderEscritoMedico } = await import('@/lib/pdf/EscritoMedicoPdf')
      return renderEscritoMedico({ medico: props.medico, data: props.data as never, logoUrl: props.logoUrl, consultorio: props.consultorio })
    }
    case 'consentimiento_informado': {
      const { renderConsentimiento } = await import('@/lib/pdf/ConsentimientoInformadoPdf')
      return renderConsentimiento({ medico: props.medico, data: props.data as never, logoUrl: props.logoUrl, consultorio: props.consultorio })
    }
    case 'denegacion_consentimiento': {
      // ⚠ PUENTE DECLARADO. La denegación es un formato v2, pero v2 entero
      // sigue apagado —ninguno de sus formatos se usa en producción— y
      // cablearlo es el paso posterior que describe la nota de arriba. Hasta
      // entonces se emite con la hoja del renderer v1, que ya la tenía medida:
      // era su hoja 4 opcional. Cuando v2 se cablee, este caso cambia de
      // destino como los otros ocho, no antes. Ver `soloDenegacion` en
      // ConsentimientoInformadoPdf.tsx.
      const { renderDenegacion } = await import('@/lib/pdf/ConsentimientoInformadoPdf')
      return renderDenegacion({ medico: props.medico, data: props.data as never, logoUrl: props.logoUrl, consultorio: props.consultorio })
    }
    case 'nota_evolucion': {
      const { renderNotaEvolucion } = await import('@/lib/pdf/NotaEvolucionPdf')
      return renderNotaEvolucion({ medico: props.medico, data: props.data as never, logoUrl: props.logoUrl, consultorio: props.consultorio })
    }
    case 'expediente_completo': {
      // Documento compuesto: hoja frontal + N notas. No lleva `medico` ni
      // `consultorio` — todo viaja dentro de `data`.
      const { renderExpedienteCompleto } = await import('@/lib/pdf/ExpedienteCompletoPdf')
      return renderExpedienteCompleto({ data: props.data as never, logoUrl: props.logoUrl })
    }
    default:
      return null
  }
}

/**
 * Abre el blob en una pestaña nueva con el visor PDF nativo del navegador.
 * El usuario decide desde el visor si imprimir, descargar o cerrar sin guardar.
 *
 * Usa <a target="_blank"> y no window.open porque el clic programático en un
 * anchor pasa el bloqueo de popups en más navegadores.
 *
 * ⚠️ NO SOBREVIVE AL TRABAJO ASÍNCRONO — esta función decía lo contrario y era
 * falso. Sin activación transitoria viva, Safari bloquea la apertura igual: en
 * escritorio con aviso de ventana bloqueada, en iOS y en la PWA en silencio. Es
 * el bug que se corrigió en los 8 formularios de documentos moviendo la
 * apertura a un botón que el médico pulsa cuando el trabajo ya terminó (ver
 * ModalDocumentoGenerado.tsx).
 *
 * Es decir: llamar a esto DESPUÉS de un await equivale a no entregar el PDF en
 * Safari. Todo llamador nuevo debe dispararlo desde el handler del gesto.
 */
function abrirBlobEnPestana(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 60s: el visor PDF necesita la URL viva mientras el usuario tenga la
  // pestaña abierta. Tras la carga inicial el browser mantiene copia interna
  // y revocar es seguro.
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  // filename no se usa: el browser deriva el nombre del slug del blob.
  // El nombre real ya quedó persistido en Storage; descargas desde el visor
  // recibirán nombre genérico, aceptable.
  void filename
}

export interface GenerarPdfResult {
  blob: Blob
  storagePath: string | null
}

/**
 * Genera PDF 100% en el cliente.
 * Si se pasa pacienteId, sube el PDF a Supabase Storage (documentos-pdf)
 * y retorna el storagePath. Si el upload falla, retorna storagePath=null
 * pero el PDF se entrega al usuario normalmente.
 *
 * `entregar: false` corta la Fase 6 y devuelve el blob sin abrir nada. Lo usan
 * los 8 formularios de documentos: la entrega automática se hacía después de
 * varios segundos de trabajo asíncrono (fetch del logo, imports dinámicos,
 * render, subida a Storage), para cuando la activación transitoria del gesto ya
 * se había consumido y Safari bloqueaba la apertura — en silencio en iOS. En su
 * lugar el formulario muestra un modal con un botón "Visualizar" que el médico
 * pulsa cuando el trabajo YA terminó, así el gesto está intacto. Ver
 * ModalDocumentoGenerado.tsx.
 */
export async function generarPdf(params: {
  tipo: string
  medico: PdfMedicoData | null
  data: Record<string, unknown>
  logoUrl?: string
  filename?: string
  pacienteId?: string
  consultorio?: PdfConsultorioData
  /** Default true — abrir/compartir el PDF al terminar (Fase 6). */
  entregar?: boolean
  /**
   * CHASIS CON EL QUE SE COMPONE. Sin él, v1.
   *
   * Lo pasa quien REGENERA, leyéndolo de `documentos.formato_version`: un
   * documento se reimprime con el chasis con que se emitió o deja de ser el
   * mismo documento. Los formularios no lo pasan todavía —todos emiten v1—;
   * cuando el flag `usa_documentos_v2` se encienda, lo pasarán junto con el
   * valor que escriban en la fila, que tienen que ser el mismo.
   */
  formatoVersion?: number
}): Promise<GenerarPdfResult> {
  // Guard de concurrencia: ignorar multi-clics
  if (isGenerating) {
    console.warn('[generarPdf] ya hay una generación en curso — ignorando llamada duplicada')
    throw new Error('Generación en curso')
  }

  isGenerating = true
  const {
    tipo, medico, data, logoUrl, filename, pacienteId, consultorio,
    entregar = true, formatoVersion = FORMATO_VERSION_POR_DEFECTO,
  } = params
  const defaultFilename = `${tipo.replace(/_/g, '-')}.pdf`

  let phase = 'inicio'

  try {
    console.log('[generarPdf] 1/6 inicio — tipo:', tipo)

    // ── Fase 1: resolver logo ──
    phase = 'resolviendo logo'
    let effectiveLogoUrl: string | undefined = undefined

    if (logoUrl && logoUrl.startsWith('https://')) {
      try {
        const res = await fetch(logoUrl)
        if (res.ok) {
          const fetchedBlob = await res.blob()
          effectiveLogoUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(fetchedBlob)
          })
        }
      } catch (e) {
        console.warn('[generarPdf] fetch de logo falló, usando fallback:', e)
      }
    }

    if (!effectiveLogoUrl) {
      const { LOGO_BASE64 } = await import('@/lib/pdf/logo')
      effectiveLogoUrl = LOGO_BASE64
    }

    // ── Fase 2: construir elemento react-pdf ──
    phase = 'construyendo elemento react-pdf'
    const element = await buildClientElement(
      tipo, medico, data, formatoVersion, effectiveLogoUrl, consultorio,
    )
    if (!element) throw new Error(`No se compone ${tipo} en la versión ${formatoVersion}`)
    console.log('[generarPdf] 2/6 elemento construido')

    // ── Fase 3: renderizar a blob ──
    phase = 'renderizando PDF'
    const { generatePdfClient } = await import('@/lib/pdfClientFallback')
    const rawBlob = await generatePdfClient(element)

    // ── Fase 4: blindar MIME type ──
    phase = 'blindando MIME type'
    const pdfBlob = new Blob([rawBlob], { type: 'application/pdf' })
    console.log('[generarPdf] 3/6 blob generado — size:', pdfBlob.size, 'bytes')

    // ── Fase 5: upload a Storage (si hay pacienteId Y hay red) ──
    let storagePath: string | null = null
    const hasNetwork = typeof navigator === 'undefined' || navigator.onLine !== false
    if (pacienteId && hasNetwork) {
      phase = 'subiendo a Storage'
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const finalName = filename ?? defaultFilename
        const path = `${pacienteId}/${finalName}`

        const { error: uploadError } = await supabase.storage
          .from('documentos-pdf')
          .upload(path, pdfBlob, {
            contentType: 'application/pdf',
            upsert: true,
          })

        if (uploadError) {
          console.error('[generarPdf] upload falló:', uploadError.message)
        } else {
          storagePath = path
          console.log('[generarPdf] 4/6 subido a Storage:', path)
        }
      } catch (storageErr) {
        console.error('[generarPdf] Storage error:', storageErr)
        // No lanzar — el PDF se entrega al usuario de todos modos
      }
    }

    // ── Fase 6: disparar entrega al usuario ──
    // Se salta con entregar:false — el llamador entrega el blob él mismo, desde
    // un gesto del usuario. Ver la nota en la firma de generarPdf.
    if (entregar) {
      phase = 'disparando entrega'
      abrirBlobEnPestana(pdfBlob, filename ?? defaultFilename)
    }

    console.log('[generarPdf] 6/6 completado', storagePath ? '(con Storage)' : '(sin Storage)', entregar ? '' : '(sin entrega)')

    return { blob: pdfBlob, storagePath }
  } catch (err) {
    console.error(`[generarPdf] falló en fase "${phase}":`, err)
    throw new Error('No se pudo generar el PDF.')
  } finally {
    isGenerating = false
  }
}
