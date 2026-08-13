'use client'

import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import {
  Banknote, BedDouble, ClipboardList, Download, Eye, File, FileText,
  FlaskConical, Loader2, PenLine, Pill, RefreshCw, ScanLine, ShieldCheck, ShieldOff, Trash2,
} from 'lucide-react'
import type { Documento } from '@/types'
import ModalShell from '@/components/ui/ModalShell'
import ModalDocumentoGenerado from '@/components/documentos/ModalDocumentoGenerado'
import { FORMATO_VERSION_POR_DEFECTO, puedeComponer } from '@/lib/mobileShare'
import { folioImpreso } from '@/lib/documentos/folio'
import { createClient } from '@/lib/supabase/client'
import { useSubscriptionGate } from '@/components/billing/SubscriptionGateProvider'
import { useToast } from '@/components/ui/Toast'
import { useMedicoInfo } from '@/hooks/useMedicoInfo'

/** Vigencia de las URLs firmadas al abrir el modal. */
const SIGNED_URL_TTL = 900 // 15 min

// Duplicado de TabDocumentos.tsx — Fase 7 eliminará TabDocumentos y esta queda como única fuente
const TIPO_DOC_LABEL: Record<string, string> = {
  receta: 'Receta',
  solicitud_lab: 'Solicitud de Laboratorio',
  solicitud_imagen: 'Solicitud de Imagenología',
  plan_suplementacion: 'Plan de Suplementación',
  informe_clinico: 'Informe Clínico',
  escrito_medico: 'Escrito Médico',
  solicitud_internamiento: 'Solicitud de Internamiento',
  consentimiento_informado: 'Consentimiento Informado',
  // El acto contrario, y con etiqueta propia por eso mismo: sin ella la lista
  // mostraría `denegacion_consentimiento` en crudo, y quien busque «¿este
  // paciente autorizó?» tendría que abrir el documento para saber que no.
  denegacion_consentimiento: 'Denegación o Revocación',
  nota_honorarios: 'Honorarios / Cotización',
}

// Duplicado de TabDocumentos.tsx — Fase 7 eliminará TabDocumentos y esta queda como única fuente
const TIPO_DOC_COLOR: Record<string, string> = {
  receta: 'bg-blue-100 text-blue-700',
  solicitud_lab: 'bg-emerald-100 text-emerald-700',
  solicitud_imagen: 'bg-violet-100 text-violet-700',
  plan_suplementacion: 'bg-amber-100 text-amber-700',
  informe_clinico: 'bg-slate-100 text-slate-600',
  escrito_medico: 'bg-teal-100 text-teal-700',
  solicitud_internamiento: 'bg-rose-100 text-rose-700',
  consentimiento_informado: 'bg-indigo-100 text-indigo-700',
  denegacion_consentimiento: 'bg-red-100 text-red-700',
  nota_honorarios: 'bg-orange-100 text-orange-700',
}

function iconForTipo(tipo: string) {
  switch (tipo) {
    case 'receta':                   return <Pill size={16} className="text-blue-600" />
    case 'solicitud_lab': case 'lab': return <FlaskConical size={16} className="text-emerald-600" />
    case 'solicitud_imagen': case 'imagen': return <ScanLine size={16} className="text-violet-600" />
    case 'plan_suplementacion':      return <ClipboardList size={16} className="text-amber-600" />
    case 'solicitud_internamiento':  return <BedDouble size={16} className="text-rose-600" />
    case 'escrito_medico':           return <PenLine size={16} className="text-teal-600" />
    case 'consentimiento_informado': return <ShieldCheck size={16} className="text-indigo-600" />
    case 'denegacion_consentimiento': return <ShieldOff size={16} className="text-red-600" />
    case 'nota_honorarios':          return <Banknote size={16} className="text-orange-600" />
    case 'informe_clinico':          return <FileText size={16} className="text-slate-600" />
    default:                          return <File size={16} className="text-slate-400" />
  }
}

/**
 * Nombre con el que debe guardarse el PDF al descargarlo.
 *
 * `pdf_url` es la ruta dentro del bucket (`<pacienteId>/<archivo>.pdf`), así que
 * su último segmento ya es el nombre que `generateDocFileName` produjo al emitir
 * el documento. Se pasa a `createSignedUrl({ download })` para que Storage
 * responda con `Content-Disposition: attachment; filename=…`; sin eso el archivo
 * se guarda con el identificador que el navegador deduce de la URL firmada.
 */
function nombreArchivoDescarga(doc: Documento): string {
  const base = doc.pdf_url?.split('/').pop()?.trim()
  return base || `${doc.tipo}.pdf`
}

type ModalDocumentosProps = {
  open: boolean
  onClose: () => void
  documentos: Documento[]
  pacienteId: string
  onVerDocumento: (doc: Documento) => void
  onEliminarDocumento: (docId: string) => Promise<void>
}

export default function ModalDocumentos({
  open,
  onClose,
  documentos,
  pacienteId,
  onVerDocumento,
  onEliminarDocumento,
}: ModalDocumentosProps) {
  const [docAEliminar, setDocAEliminar] = useState<string | null>(null)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [docRegenerado, setDocRegenerado] = useState<{ blob: Blob; titulo: string; guardado: boolean } | null>(null)
  const [bloqueoRegeneracion, setBloqueoRegeneracion] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [firmandoUrls, setFirmandoUrls] = useState(false)
  const [falloFirma, setFalloFirma] = useState(false)
  const { state: subState, openBloqueoModal } = useSubscriptionGate()
  const { medicoInfo } = useMedicoInfo()

  // El objeto que devuelve useToast se recrea en cada render del provider. Si
  // entrara como dependencia del efecto de firma, un toast de error volvería a
  // disparar el efecto que lo emitió.
  const toast = useToast()
  const toastRef = useRef(toast)
  useEffect(() => { toastRef.current = toast })

  /**
   * Firma las URLs de descarga POR ADELANTADO, al abrir el modal.
   *
   * Firmar es asíncrono. Cuando el `await` vivía dentro del onClick, para cuando
   * la URL existía la activación transitoria del gesto ya se había consumido y
   * Safari bloqueaba la apertura: en escritorio con aviso de "popup bloqueado",
   * en iOS en silencio — el botón simplemente no hacía nada. Con la URL ya
   * firmada el icono es un `<a href>` real y entre el toque y la navegación no
   * queda ninguna asincronía.
   *
   * `firmaKey` incluye `pdf_url` a propósito: `regenerarYSubirPdf` muta ese
   * campo in situ sin reemplazar el array (deuda técnica #1), así que la
   * identidad de `documentos` no basta para detectar que hay un PDF nuevo que
   * firmar.
   */
  const firmaKey = documentos.map(d => `${d.id}:${d.pdf_url ?? ''}`).join('|')

  useEffect(() => {
    if (!open) return
    const conPdf = documentos.filter(d => d.pdf_url)
    if (conPdf.length === 0) return

    let cancelled = false
    setFirmandoUrls(true)
    setFalloFirma(false)

    const supabase = createClient()
    Promise.all(conPdf.map(doc =>
      supabase.storage
        .from('documentos-pdf')
        .createSignedUrl(doc.pdf_url!, SIGNED_URL_TTL, { download: nombreArchivoDescarga(doc) })
        // Anotación explícita como en ModalPreviewDocumento.tsx: los tipos de
        // storage-js no llegan a inferirse a través del cliente.
        .then(({ data, error }: { data: { signedUrl: string } | null; error: Error | null }) => {
          if (error || !data?.signedUrl) {
            console.error('[ModalDocumentos] signed URL error:', error?.message)
            return null
          }
          return [doc.id, data.signedUrl] as const
        })
    ))
      .then(resultados => {
        if (cancelled) return
        const firmadas = resultados.filter((r): r is readonly [string, string] => r !== null)
        setSignedUrls(Object.fromEntries(firmadas))
        setFirmandoUrls(false)
        const fallos = resultados.length - firmadas.length
        if (fallos > 0) {
          setFalloFirma(true)
          toastRef.current.error(
            fallos === resultados.length
              ? 'No se pudieron preparar las descargas de los documentos.'
              : `No se pudo preparar la descarga de ${fallos} documento${fallos > 1 ? 's' : ''}.`
          )
        }
      })
      .catch(err => {
        if (cancelled) return
        console.error('[ModalDocumentos] firma de URLs:', err)
        setFirmandoUrls(false)
        setFalloFirma(true)
        toastRef.current.error('No se pudieron preparar las descargas. Revisa tu conexión.')
      })

    return () => { cancelled = true }
  }, [open, firmaKey, documentos])

  // Duplicado de TabDocumentos.tsx — Fase 7 eliminará TabDocumentos y esta queda como única fuente
  /**
   * Recupera el PDF de un documento que NO tiene archivo en Storage.
   *
   * No sobrescribe nada: el botón que llama aquí vive en la rama `else` del
   * ternario `doc.pdf_url ? … : doc.contenido ? …` de más abajo, así que solo
   * existe cuando `pdf_url` es null. El caso real son los documentos generados
   * en otro dispositivo cuyo archivo nunca llegó a subir. No hay papel
   * entregado que quede huérfano porque no hay papel.
   *
   * ── SE REGENERA CON EL CHASIS CON QUE SE EMITIÓ, NO CON EL DE HOY ─────────
   *
   * `formato_version` de la fila viaja hasta `generarPdf`, que elige el
   * renderer: v1 para las filas viejas y v2 para las nuevas. Antes esto era un
   * guard de igualdad contra una constante local —«si no eres la versión que
   * genero hoy, no te regenero»—, y el día que v2 se encienda eso habría dejado
   * sin botón a los mil y pico documentos v1, que es justo lo contrario de lo
   * que este botón existe para hacer.
   *
   * Lo que sí sigue bloqueándose es lo que este build NO sabe componer: un
   * documento emitido con un chasis que esta versión de la app no lleva. Quien
   * responde es `puedeComponer()`, en el mismo archivo que elige el renderer —
   * ver su nota: la constante espejo que había aquí era una promesa de
   * acordarse, no una garantía.
   *
   * `?? FORMATO_VERSION_POR_DEFECTO` no es un atajo: la migración
   * `20260804_documentos_formato_version.sql` declara la columna
   * `NOT NULL DEFAULT 1`, o sea «todo lo que ya existe es v1». Mientras no se
   * aplique, `formato_version` llega `undefined` a runtime y sin esta
   * normalización el guard bloquearía los documentos que viene a recuperar.
   *
   * ── Y CON EL FOLIO CON QUE SE EMITIÓ ─────────────────────────────────────
   *
   * `contenido.folio` primero: es el que el papel llevaba impreso —la receta
   * guarda ahí el suyo, el del QR de verificación—. Si no hay, el de la columna,
   * y solo para los formatos que lo imprimen: `folioImpreso()` es quien lo sabe,
   * y es la misma función que usan los siete formularios al emitir. Sin ella,
   * regenerar imprimiría el `INT-…` que la solicitud de internamiento
   * deliberadamente no lleva.
   */
  async function regenerarYSubirPdf(doc: Documento) {
    if (!doc.contenido || regeneratingId) return

    const formatoVersion = doc.formato_version ?? FORMATO_VERSION_POR_DEFECTO
    if (!puedeComponer(doc.tipo, formatoVersion)) {
      setBloqueoRegeneracion(true)
      return
    }

    setRegeneratingId(doc.id)
    // El blob se lee en el finally para montar el modal de entrega. Antes,
    // `generarPdf` abría la pestaña él mismo al terminar; con el gesto ya
    // consumido por el trabajo asíncrono, Safari la bloqueaba y el médico se
    // quedaba sin el PDF que acababa de recuperar. Ver ModalDocumentoGenerado.
    let pdfBlob: Blob | null = null
    let guardado = false
    try {
      const { generarPdf } = await import('@/lib/mobileShare')
      const { getDoctorProfile } = await import('@/lib/offline/doctorProfile')
      const profile = getDoctorProfile()

      const medicoData = profile ? {
        nombre: profile.nombre,
        titulo: medicoInfo?.titulo ?? null,
        nombres: medicoInfo?.nombres ?? null,
        apellido_paterno: medicoInfo?.apellido_paterno ?? null,
        apellido_materno: medicoInfo?.apellido_materno ?? null,
        especialidad: profile.especialidad,
        cedula_profesional: profile.cedula_profesional,
        cedula_especialidad: profile.cedula_especialidad,
        // El membrete de v2 la exige (I.3.7), así que sin ella un documento
        // regenerado saldría sin universidad donde el original la llevaba. El
        // perfil espejo la guarda; `medicoInfo` es el respaldo si llega vacía.
        universidad: profile.universidad || medicoInfo?.universidad || null,
        color_primario: profile.color_primario,
        color_secundario: profile.color_secundario,
        direccion_consultorio: profile.direccion_consultorio,
        telefono_consultorio: profile.telefono_consultorio,
        firma_url: profile.firma_base64,
      } : null

      const logoUrl = profile?.logo_base64 ?? undefined
      const pacienteNombre = (doc.contenido as Record<string, unknown>).paciente as string ?? 'documento'

      const { generateDocFileName } = await import('@/lib/patientUtils')
      const tipoLabel = doc.tipo.replace(/_/g, '-')

      const { blob, storagePath } = await generarPdf({
        tipo: doc.tipo,
        medico: medicoData,
        data: {
          ...(doc.contenido as Record<string, unknown>),
          folio: doc.contenido.folio ?? folioImpreso(doc.tipo, doc.folio),
        },
        logoUrl,
        filename: generateDocFileName(pacienteNombre, tipoLabel),
        pacienteId: doc.paciente_id ?? undefined,
        entregar: false,
        formatoVersion,
      })

      pdfBlob = blob
      // Derivado solo de storagePath: el error del .update() de abajo sigue sin
      // comprobarse, igual que antes de este cambio. Sin storagePath es seguro
      // que el documento NO quedó recuperable, que es lo que el modal advierte.
      guardado = storagePath !== null

      if (storagePath) {
        const supabase = createClient()
        await supabase.from('documentos').update({ pdf_url: storagePath }).eq('id', doc.id)
        doc.pdf_url = storagePath // bug conocido — ver CLAUDE.md § Deuda técnica #1
      }
    } catch (err) {
      console.error('[ModalDocumentos] regenerarPdf:', err)
    } finally {
      setRegeneratingId(null)
      if (pdfBlob) {
        setDocRegenerado({
          blob: pdfBlob,
          titulo: TIPO_DOC_LABEL[doc.tipo] || doc.tipo,
          guardado,
        })
      }
    }
  }

  async function handleConfirmDelete() {
    if (!docAEliminar || eliminando) return
    setEliminando(true)
    try {
      await onEliminarDocumento(docAEliminar)
    } finally {
      setEliminando(false)
      setDocAEliminar(null)
    }
  }

  const headerRight = (
    <Link
      href={`/expediente/${pacienteId}/documentos`}
      onClick={(e) => {
        // Fase 8.2 hotfix: este Link era el único punto de entrada a
        // /expediente/[id]/documentos no cubierto por intercept de UI.
        if (subState.isBlocked) {
          e.preventDefault()
          openBloqueoModal()
          return
        }
        onClose()
      }}
      className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors px-2"
    >
      + Nuevo documento
    </Link>
  )

  return (
    <>
      <ModalShell
        open={open}
        onClose={onClose}
        title={`Documentos · ${documentos.length}`}
        icon={<FileText size={16} />}
        iconBg="bg-sky-50 text-sky-600"
        maxWidth="max-w-xl"
        headerRight={headerRight}
      >
        {documentos.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <FileText size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600 font-medium">Sin documentos generados</p>
            <p className="text-slate-400 text-sm mt-1">Recetas, solicitudes y otros documentos aparecerán aquí</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {documentos.map(doc => {
              // Un borrador es trabajo en curso, no un documento emitido: no
              // tiene folio, no tiene PDF y solo lo ve su autor. Se distingue
              // con TRES señales —borde punteado, distintivo ámbar y «sin
              // firmar» en la línea de estado— porque una sola se pasa por alto,
              // y de él solo cuelgan dos acciones: retomarlo o cancelarlo.
              const esBorrador = doc.estado === 'borrador'
              return (
              <div key={doc.id}
                className={`flex items-center gap-3 px-4 py-3${esBorrador ? ' border border-dashed border-amber-300 bg-amber-50/40 rounded-xl my-1' : ''}`}>
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  {iconForTipo(doc.tipo)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_DOC_COLOR[doc.tipo] || 'bg-slate-100 text-slate-600'}`}>
                    {TIPO_DOC_LABEL[doc.tipo] || doc.tipo}
                  </span>
                  {esBorrador && (
                    <span className="text-xs px-2 py-0.5 ml-1.5 rounded-full font-medium bg-amber-100 text-amber-700">
                      Borrador
                    </span>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {esBorrador && 'Tu borrador · guardado el '}
                    {doc.created_at ? format(parseISO(doc.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es }) : ''}
                    {esBorrador
                      ? ', sin firmar'
                      : doc.contenido?.diagnostico ? ` · ${doc.contenido.diagnostico}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {esBorrador ? (
                    /* Sin descarga y sin «Ver»: no hay PDF que enseñar. Y sin
                       regenerar, que subiría a Storage el papel de un documento
                       que todavía no se ha emitido. */
                    <Link
                      href={`/expediente/${pacienteId}/documentos?tipo=consentimiento&borrador=${doc.id}`}
                      onClick={(e) => {
                        // Mismo intercept que «+ Nuevo documento»: es otra
                        // entrada a la misma pantalla de escritura.
                        if (subState.isBlocked) {
                          e.preventDefault()
                          openBloqueoModal()
                          return
                        }
                        onClose()
                      }}
                      className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 font-medium px-2.5 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
                      title="Seguir editándolo"
                    >
                      <PenLine size={14} /> Retomar
                    </Link>
                  ) : doc.pdf_url ? (
                    signedUrls[doc.id] ? (
                      /* <a href> con la URL ya firmada: cero asincronía entre el
                         toque y la navegación (ver el efecto de firma arriba).
                         El atributo `download` lo ignora el navegador por ser
                         cross-origin; el nombre real lo impone el
                         Content-Disposition que trae la URL firmada. */
                      <a
                        href={signedUrls[doc.id]}
                        download={nombreArchivoDescarga(doc)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-xs text-emerald-600 hover:text-emerald-700 px-2 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                        title="Descargar PDF"
                      >
                        <Download size={14} />
                      </a>
                    ) : (
                      <span
                        aria-disabled="true"
                        title={falloFirma ? 'No se pudo preparar la descarga' : 'Preparando descarga…'}
                        className="flex items-center text-xs text-slate-300 px-2 py-1.5 rounded-lg cursor-default"
                      >
                        {firmandoUrls ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      </span>
                    )
                  ) : doc.contenido ? (
                    <button
                      onClick={() => regenerarYSubirPdf(doc)}
                      disabled={regeneratingId === doc.id}
                      className="flex items-center text-xs text-blue-600 hover:text-blue-700 px-2 py-1.5 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
                      title="Regenerar PDF"
                    >
                      {regeneratingId === doc.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    </button>
                  ) : null}
                  {!esBorrador && (
                    <button
                      onClick={() => onVerDocumento(doc)}
                      className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-medium px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Ver documento"
                    >
                      <Eye size={14} /> Ver
                    </button>
                  )}
                  <button
                    onClick={() => setDocAEliminar(doc.id)}
                    className="flex items-center text-xs text-red-400 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    title={esBorrador ? 'Cancelar borrador' : 'Eliminar documento'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              )
            })}
          </div>
        )}
      </ModalShell>

      {/* Confirm-delete — ModalShell anidado con elevated para apilarse sobre el principal */}
      <ModalShell
        open={docAEliminar !== null}
        onClose={() => !eliminando && setDocAEliminar(null)}
        title="¿Eliminar documento?"
        elevated
        maxWidth="max-w-sm"
      >
        <div className="px-5 py-4">
          <p className="text-sm text-slate-600 mb-5">
            Esta acción no se puede deshacer.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDocAEliminar(null)}
              disabled={eliminando}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={eliminando}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {eliminando && <Loader2 size={14} className="animate-spin" />}
              Eliminar
            </button>
          </div>
        </div>
      </ModalShell>

      {/* Aviso del guard de formato — ver regenerarYSubirPdf */}
      <ModalShell
        open={bloqueoRegeneracion}
        onClose={() => setBloqueoRegeneracion(false)}
        title="Este documento usa otro diseño"
        elevated
        maxWidth="max-w-sm"
      >
        <div className="px-5 py-4">
          {/* «Otro» y no «anterior»: desde que la regeneración elige el chasis de
              la fila, lo que este aviso significa es que esta versión de la app
              no lleva ese diseño — y puede ser uno más nuevo, si el documento se
              emitió desde un dispositivo ya actualizado. */}
          <p className="text-sm text-slate-600 mb-5">
            Este documento se emitió con un diseño que esta versión de la
            aplicación no puede componer. No puede reproducirse tal como se
            entregó: el PDF saldría con otra apariencia. Actualiza la aplicación
            o, si necesitas una copia ahora, emite un documento nuevo con la
            fecha de hoy.
          </p>
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setBloqueoRegeneracion(false)}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-700 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      </ModalShell>

      {/* Entrega del PDF recuperado. Va apilado sobre la lista (elevated,
          z-[60]) igual que los dos confirmatorios de arriba; nunca coinciden
          con una regeneración en curso.
          NO se aprovecha el <a> de descarga que la fila ya tiene: la deuda
          técnica #1 (:263 muta doc.pdf_url por referencia, sin setState) impide
          que la fila se re-renderice, así que ese botón no llega a aparecer.
          Cerrarla exige que el padre reemplace la fila en su estado — otro
          alcance, y esta vía sirve casi solo a documentos históricos. */}
      <ModalDocumentoGenerado
        open={docRegenerado !== null}
        onClose={() => setDocRegenerado(null)}
        blob={docRegenerado?.blob ?? null}
        titulo={docRegenerado?.titulo ?? 'Documento'}
        guardadoEnExpediente={docRegenerado?.guardado ?? false}
      />
    </>
  )
}
