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
 * Importa dinámicamente el renderer correcto y genera el elemento react-pdf.
 *
 * ── PUNTO ÚNICO DE RAMIFICACIÓN v1 / v2 ─────────────────────────────────────
 * Este `switch` es el lugar donde, en un paso futuro, se decidirá entre el
 * renderer v1 (`@/lib/pdf/…`) y el v2 (`@/lib/pdf/v2/…`) de cada formato.
 * No hay otro punto en el que la app elija renderer: los 12 call sites de
 * `generarPdf` pasan por aquí.
 *
 * HOY NO RAMIFICA, y eso es deliberado. Estado actual de la firma:
 *  - `buildClientElement` no recibe ninguna noción de versión de formato.
 *  - `generarPdf` (:153-161) tampoco: sus params son
 *    `{ tipo, medico, data, logoUrl, filename, pacienteId, consultorio }`.
 *    `medico` es `PdfMedicoData`, que son datos de impresión, NO identidad —
 *    no hay ahí un id de médico con el que leer el feature flag
 *    `profiles.usa_documentos_v2`.
 *
 * Es decir: para ramificar hace falta meter versión (o identidad del médico)
 * en la firma de `generarPdf`, y eso toca los 12 call sites. Por eso no se
 * hace en el Paso 0.a, cuyo contrato es que el andamiaje quede inerte y los
 * 8 formatos generen exactamente el mismo PDF que hoy.
 * ─────────────────────────────────────────────────────────────────────────────
 */
async function buildClientElement(
  tipo: string,
  medico: PdfMedicoData | null,
  data: Record<string, unknown>,
  logoUrl?: string,
  consultorio?: PdfConsultorioData,
) {
  const props = { medico, data, logoUrl, consultorio }

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
}): Promise<GenerarPdfResult> {
  // Guard de concurrencia: ignorar multi-clics
  if (isGenerating) {
    console.warn('[generarPdf] ya hay una generación en curso — ignorando llamada duplicada')
    throw new Error('Generación en curso')
  }

  isGenerating = true
  const { tipo, medico, data, logoUrl, filename, pacienteId, consultorio, entregar = true } = params
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
    const element = await buildClientElement(tipo, medico, data, effectiveLogoUrl, consultorio)
    if (!element) throw new Error(`Tipo de documento no válido: ${tipo}`)
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
