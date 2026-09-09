'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, RotateCw } from 'lucide-react'
import Link from 'next/link'
import type { Paciente, Documento } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { puedeComponer } from '@/lib/mobileShare'
import { folioImpreso } from '@/lib/documentos/folio'
import { esSinVisor, type TipoDocumentoBD } from '@/lib/documentos/familias'
import { AvisoColumna } from '@/components/dashboard/piezasBanda2'
import ModalShell from '@/components/ui/ModalShell'
import CarrilDocumentos from './CarrilDocumentos'
import VisorDocumento from './VisorDocumento'
import type { EstadoDescarga } from './AccionesDocumento'

/**
 * La pestaña Documentos: carril + visor. Sin modales de lista ni de visor.
 *
 * ⚠️ AQUÍ VIVEN LAS TRES ACCIONES QUE ESTABAN REPARTIDAS ENTRE DOS MODALES:
 * regenerar y eliminar venían de `ModalDocumentos`, y enviar por correo de
 * `ModalVisorDocumento`. Sus condiciones son las del documento de estructura §5,
 * no las que cada modal aplicaba por su cuenta.
 *
 * ⚠️ LOS TIPOS SIN VISOR NO SE LISTAN, PERO SÍ SE ABREN. «Resultado de
 * laboratorio» y «Estudio de imagen» son archivos subidos y viven en
 * «Mediciones y archivos»; «Informe clínico» es un formato heredado. El carril
 * los filtra, pero un enlace `?documento=` puede nombrarlos y ese camino no
 * puede terminar en blanco: el visor los recibe y `CuerpoDocumento` los explica.
 */

/** Una hora, el mismo TTL con el que firmaba el modal. */
const TTL_FIRMA = 3600
const FORMATO_POR_DEFECTO = 1

/**
 * Nombre con el que debe guardarse el PDF al descargarlo. `pdf_url` es la ruta
 * dentro del bucket, así que su último segmento ya es el nombre que se produjo
 * al emitir. Sin esto Storage responde sin `Content-Disposition` y el archivo se
 * guarda con el identificador que el navegador deduce de la url firmada.
 */
function nombreDescarga(doc: Documento): string {
  return doc.pdf_url?.split('/').pop()?.trim() || `${doc.tipo}.pdf`
}

export default function PanelDocumentos({
  paciente, documentos, totalDocumentos, cargandoActividad, errorActividad,
  onReintentarActividad, onRecargarDocumentos, documentoSolicitadoId,
  onSeleccionarDocumento, onIrAArchivos,
}: {
  paciente: Paciente
  documentos: Documento[]
  totalDocumentos: number | undefined
  cargandoActividad: boolean
  errorActividad: boolean
  onReintentarActividad: () => void
  /** Refresca la lista tras regenerar o eliminar. */
  onRecargarDocumentos: () => void
  documentoSolicitadoId: string | null
  onSeleccionarDocumento: (id: string) => void
  onIrAArchivos: () => void
}) {
  const router = useRouter()
  const { profile } = useProfile()

  const [filtro, setFiltro] = useState<TipoDocumentoBD | 'todos'>('todos')
  const [firmadas, setFirmadas] = useState<Record<string, string>>({})
  const [estadoFirma, setEstadoFirma] = useState<EstadoDescarga>('preparando')
  const [intentoFirma, setIntentoFirma] = useState(0)
  const [regenerando, setRegenerando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [correoAlterno, setCorreoAlterno] = useState<string | null>(null)
  const peticionFirma = useRef(0)

  /* El carril lista solo lo que esta pestaña compone; el visor sí acepta el
     resto, para que un enlace directo no acabe en blanco. */
  const listables = useMemo(() => documentos.filter(d => !esSinVisor(d.tipo)), [documentos])

  const doc = useMemo(() => {
    if (documentos.length === 0) return null
    /* Se busca en TODOS, no solo en los listables: el enlace directo a un
       archivo subido tiene que resolver. Si no corresponde a ninguno, el
       primero listable. */
    return documentos.find(d => d.id === documentoSolicitadoId) ?? listables[0] ?? null
  }, [documentos, listables, documentoSolicitadoId])

  /* ── Firma de la url de descarga ────────────────────────────────────────
     ⚠️ SE FIRMA POR ADELANTADO Y SOLO LA DEL DOCUMENTO ABIERTO. Firmar es
     asíncrono: con el `await` dentro del onClick, para cuando la url existía la
     activación del gesto ya se había consumido y Safari bloqueaba la apertura
     —en silencio en iOS—. Con la url ya firmada el control es un `<a href>` real
     y entre el toque y la navegación no queda asincronía.
     El modal firmaba las 50 de golpe al abrirse; aquí basta con una. */
  useEffect(() => {
    if (!doc?.pdf_url) { setEstadoFirma('fallido'); return }
    const mia = ++peticionFirma.current
    setEstadoFirma('preparando')
    createClient().storage
      .from('documentos-pdf')
      .createSignedUrl(doc.pdf_url, TTL_FIRMA, { download: nombreDescarga(doc) })
      .then(({ data, error }: { data: { signedUrl: string } | null; error: Error | null }) => {
        if (mia !== peticionFirma.current) return
        if (error || !data?.signedUrl) { setEstadoFirma('fallido'); return }
        setFirmadas(prev => ({ ...prev, [doc.id]: data.signedUrl }))
        setEstadoFirma('listo')
      })
  }, [doc?.id, doc?.pdf_url, intentoFirma, doc])

  const cerrarAviso = useCallback(() => setAviso(null), [])

  /* ── Regenerar ─────────────────────────────────────────────────────────── */
  async function regenerar() {
    if (!doc?.contenido || regenerando) return
    setRegenerando(true)
    setAviso(null)
    try {
      const formatoVersion = doc.formato_version ?? FORMATO_POR_DEFECTO
      const { generarPdf } = await import('@/lib/mobileShare')
      const { getDoctorProfile } = await import('@/lib/offline/doctorProfile')
      const { generateDocFileName } = await import('@/lib/patientUtils')
      const perfil = getDoctorProfile()

      const { storagePath } = await generarPdf({
        tipo: doc.tipo,
        medico: perfil ? {
          nombre: perfil.nombre,
          especialidad: perfil.especialidad,
          cedula_profesional: perfil.cedula_profesional,
          cedula_especialidad: perfil.cedula_especialidad,
          universidad: perfil.universidad || null,
          color_primario: perfil.color_primario,
          color_secundario: perfil.color_secundario,
          direccion_consultorio: perfil.direccion_consultorio,
          telefono_consultorio: perfil.telefono_consultorio,
          firma_url: perfil.firma_base64,
        } : null,
        data: {
          ...(doc.contenido as Record<string, unknown>),
          /* ⚠️ EL FOLIO CON EL QUE SE EMITIÓ, Y EL ORDEN DEL `??` IMPORTA.
             `contenido.folio` primero: es el que el papel llevaba impreso. Las
             recetas anteriores a agosto de 2026 guardaron ahí un `R-a3f9…` y
             caen por la izquierda; las nuevas caen a `folioImpreso()`, que es
             quien sabe qué formatos imprimen la columna. Invertirlo regeneraría
             las viejas con un número que su papel no dice. */
          folio: doc.contenido.folio ?? folioImpreso(doc.tipo, doc.folio),
        },
        logoUrl: perfil?.logo_base64 ?? undefined,
        filename: generateDocFileName(
          (doc.contenido as Record<string, unknown>).paciente as string ?? 'documento',
          doc.tipo.replace(/_/g, '-'),
        ),
        pacienteId: doc.paciente_id ?? undefined,
        entregar: false,
        formatoVersion,
      })

      if (storagePath) {
        await createClient().from('documentos').update({ pdf_url: storagePath }).eq('id', doc.id)
        /* ⚠️ SE RECARGA LA LISTA EN VEZ DE MUTAR `doc.pdf_url` EN SITIO. Eso
           último es la deuda técnica #1 del CLAUDE.md: mutaba el objeto por
           referencia y el botón de descarga no reaparecía hasta refetch manual.
           Recargando, la url nueva llega por props y la firma vuelve sola a
           «preparando», que es lo que el §6.2 pide. */
        onRecargarDocumentos()
        setAviso('El documento se regeneró y quedó guardado.')
      } else {
        setAviso('El documento se regeneró, pero no se pudo guardar. Descárgalo antes de salir.')
      }
    } catch {
      setAviso('No se pudo regenerar el documento.')
    } finally {
      setRegenerando(false)
    }
  }

  /* ── Enviar al paciente ────────────────────────────────────────────────── */
  async function enviar(confirmar = false) {
    if (!doc || enviando) return
    setEnviando(true)
    setAviso(null)
    setCorreoAlterno(null)
    try {
      const res = await fetch('/api/email/enviar-documento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentoId: doc.id,
          pacienteEmail: paciente.email,
          confirmarEmailAlterno: confirmar,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        /* El servidor avisa de que el correo escrito no coincide con el de la
           ficha. No se envía: se pregunta antes, enseñando los dos. */
        if (data.error === 'email_mismatch') { setCorreoAlterno(data.emailRegistrado ?? ''); return }
        setAviso(data.error || 'No se pudo enviar el documento.')
        return
      }
      setAviso('Documento enviado. Si el paciente no lo recibe, pídele que revise su carpeta de correo no deseado.')
    } catch {
      setAviso('No se pudo enviar el documento.')
    } finally {
      setEnviando(false)
    }
  }

  /* ── Eliminar ──────────────────────────────────────────────────────────── */
  async function eliminar() {
    if (!doc || borrando) return
    setBorrando(true)
    const res = await fetch(`/api/documentos/${doc.id}`, { method: 'DELETE' })
    setBorrando(false)
    setConfirmarBorrado(false)
    if (!res.ok) { setAviso('No se pudo eliminar el documento.'); return }
    onRecargarDocumentos()
  }

  /* ── Condiciones de cada acción (estructura §5) ─────────────────────────── */
  const esBorrador = doc?.estado === 'borrador'
  const esComponible = !!doc && !esSinVisor(doc.tipo)
  const hayArchivo = !!doc?.pdf_url
  const esAutor = !!doc?.subido_por && !!profile?.id && doc.subido_por === profile.id

  const bloqueoEnviar =
    esBorrador ? 'Este documento es un borrador. Emítelo antes de enviarlo.'
    : !esAutor ? 'Solo el médico que emitió el documento puede enviarlo.'
    : !hayArchivo ? 'No hay archivo que adjuntar; genera el PDF primero.'
    : !paciente.email ? 'El paciente no tiene correo registrado.'
    : undefined

  /* Dos condiciones, no una: el §1 del spec dice que basta con la plantilla
     porque saca los subidos de la pestaña, pero un enlace directo puede traer
     uno y sobre un archivo no hay nada que volver a dibujar. */
  const bloqueoRegenerar =
    !esComponible ? 'Este archivo se subió; no hay datos con los que componerlo.'
    : doc && !puedeComponer(doc.tipo, doc.formato_version ?? FORMATO_POR_DEFECTO)
      ? 'Se emitió con una plantilla anterior. Se conserva tal cual para que el archivo recuperado sea el que se entregó.'
      : undefined

  if (errorActividad) {
    return <AvisoColumna icono={RotateCw} mensaje="No se pudieron cargar los documentos." onReintentar={onReintentarActividad} />
  }
  if (cargandoActividad) {
    return (
      <div className="flex flex-col gap-[var(--sp-4)] lg:flex-row lg:items-start">
        <div className="skeleton hidden h-[300px] w-[236px] shrink-0 rounded-[var(--sp-r-card)] lg:block" />
        <div className="skeleton h-[300px] min-w-0 flex-1 rounded-[var(--sp-r-card)]" />
      </div>
    )
  }
  if (listables.length === 0 && !doc) {
    return (
      <div className="flex flex-col items-center gap-[var(--sp-2-5)] rounded-[var(--sp-r-card)] border border-dashed border-[color:var(--sp-line-card)] px-[var(--sp-pad-row-x)] py-[var(--sp-10)]">
        <FileText size={20} className="text-[var(--sp-ink-150)]" />
        <p className="text-center text-[length:var(--sp-fs-body-sm)] text-[var(--sp-ink-500)]">
          Este paciente todavía no tiene documentos.
        </p>
        <Link
          href={`/expediente/${paciente.id}/documentos`}
          prefetch={false}
          className="sp-btn sp-btn--primary mt-[var(--sp-2)]"
          style={{ height: 'var(--sp-tap)', paddingTop: 0, paddingBottom: 0, fontSize: 'var(--sp-fs-body-sm)' }}
        >
          Crear documento
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[var(--sp-4)] lg:flex-row lg:items-start">
      <CarrilDocumentos
        documentos={listables}
        total={totalDocumentos}
        activoId={doc?.id ?? null}
        onSelect={onSeleccionarDocumento}
        filtro={filtro}
        onFiltrar={setFiltro}
      />

      <div className="min-w-0 flex-1">
        {doc && (
          <VisorDocumento
            doc={doc}
            onIrAArchivos={onIrAArchivos}
            acciones={{
              descarga: {
                estado: hayArchivo ? estadoFirma : 'fallido',
                href: firmadas[doc.id] ?? null,
                onReintentar: () => setIntentoFirma(n => n + 1),
              },
              enviar: { onClick: () => void enviar(), bloqueo: bloqueoEnviar, ocupada: enviando },
              regenerar: { onClick: () => void regenerar(), bloqueo: bloqueoRegenerar, ocupada: regenerando },
              eliminar: {
                onClick: () => setConfirmarBorrado(true),
                rotulo: esBorrador ? 'Cancelar borrador' : 'Eliminar documento',
                ocupada: borrando,
              },
              /* Solo consentimientos en borrador. En cualquier otro, no se dibuja. */
              seguirEditando: esBorrador && doc.tipo === 'consentimiento_informado'
                ? () => router.push(`/expediente/${paciente.id}/documentos?tipo=consentimiento&doc=${doc.id}`)
                : null,
            }}
          />
        )}

        {aviso && (
          <p className="mt-[var(--sp-2-5)] flex items-start justify-between gap-[var(--sp-3)] rounded-[var(--sp-r-field-sm)] bg-[var(--sp-surface-muted)] px-[var(--sp-3)] py-[var(--sp-2)] text-[length:var(--sp-fs-hint)] text-[var(--sp-ink-700)]">
            {aviso}
            <button type="button" onClick={cerrarAviso} className="shrink-0 font-semibold text-[var(--sp-primary)]">Cerrar</button>
          </p>
        )}
      </div>

      {/* ── Confirmación de borrado ─────────────────────────────────────── */}
      {confirmarBorrado && doc && (
        <ModalShell
          open
          onClose={() => setConfirmarBorrado(false)}
          title="¿Eliminar documento?"
          maxWidth="max-w-sm"
          footer={
            <div className="flex justify-end gap-[var(--sp-2)] px-[var(--sp-5)] py-[var(--sp-3)]">
              <button type="button" onClick={() => setConfirmarBorrado(false)} className="sp-btn sp-btn--secondary">
                Cancelar
              </button>
              {/* La destructiva, en MENOR peso visual que cancelar. */}
              <button
                type="button"
                onClick={() => void eliminar()}
                disabled={borrando}
                className="sp-btn"
                style={{ background: 'transparent', color: 'var(--sp-danger)', fontSize: 'var(--sp-fs-btn-sm)', padding: '13px 20px' }}
              >
                {esBorrador ? 'Cancelar borrador' : 'Eliminar documento'}
              </button>
            </div>
          }
        >
          <p className="px-[var(--sp-5)] py-[var(--sp-4)] text-[length:var(--sp-fs-body-sm)] text-[var(--sp-ink-700)]">
            Esta acción no se puede deshacer.
          </p>
        </ModalShell>
      )}

      {/* ── El correo escrito no coincide con el de la ficha ─────────────── */}
      {correoAlterno !== null && (
        <ModalShell
          open
          onClose={() => setCorreoAlterno(null)}
          title="El correo no coincide"
          maxWidth="max-w-sm"
          footer={
            <div className="flex justify-end gap-[var(--sp-2)] px-[var(--sp-5)] py-[var(--sp-3)]">
              <button type="button" onClick={() => setCorreoAlterno(null)} className="sp-btn sp-btn--secondary">Cancelar</button>
              <button type="button" onClick={() => void enviar(true)} className="sp-btn sp-btn--primary">Enviar de todos modos</button>
            </div>
          }
        >
          {/* Los dos correos como pares rótulo/valor, NO como campos editables:
              cambiar el correo del paciente es otra tarea. */}
          <div className="flex flex-col gap-[var(--sp-2)] px-[var(--sp-5)] py-[var(--sp-4)]">
            <p className="text-[length:var(--sp-fs-legal)] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
              Se enviará a
              <span className="ml-[var(--sp-2)] normal-case tracking-normal text-[length:var(--sp-fs-meta)] font-semibold text-[var(--sp-ink-800)]">{paciente.email}</span>
            </p>
            <p className="text-[length:var(--sp-fs-legal)] font-bold uppercase tracking-[var(--sp-ls-label)] text-[var(--sp-ink-350)]">
              Registrado en la ficha
              <span className="ml-[var(--sp-2)] normal-case tracking-normal text-[length:var(--sp-fs-meta)] font-semibold text-[var(--sp-ink-800)]">{correoAlterno || '—'}</span>
            </p>
          </div>
        </ModalShell>
      )}
    </div>
  )
}
