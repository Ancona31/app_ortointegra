'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Loader2, AlertCircle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import ModalShell from '@/components/ui/ModalShell'
import { createClient } from '@/lib/supabase/client'
import { initCornerstone } from '@/lib/dicom/init'
import type { Documento } from '@/types'

const SIGNED_URL_TTL = 300

type EngineRefs = {
  engineId: string
  viewportId: string
  toolGroupId: string
  engine: { destroy: () => void } | null
}

interface Props {
  documento: Documento | null
  onClose: () => void
}

export default function ModalPreviewDocumento({ documento, onClose }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loadingUrl, setLoadingUrl] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [pathSnapshot, setPathSnapshot] = useState<string | null>(null)

  const currentPath = documento?.storage_path ?? null

  // Render-time sync: reset del estado cuando cambia el documento objetivo.
  // Evita cascading-render al usar setState dentro de useEffect.
  if (pathSnapshot !== currentPath) {
    setPathSnapshot(currentPath)
    setSignedUrl(null)
    setUrlError(null)
    setLoadingUrl(!!currentPath && !!documento?.storage_bucket)
  }

  useEffect(() => {
    if (!documento?.storage_path || !documento?.storage_bucket) return
    let cancelled = false
    const supabase = createClient()
    supabase.storage
      .from(documento.storage_bucket)
      .createSignedUrl(documento.storage_path, SIGNED_URL_TTL)
      .then(({ data, error }: { data: { signedUrl: string } | null; error: Error | null }) => {
        if (cancelled) return
        if (error || !data?.signedUrl) {
          setUrlError(error?.message ?? 'No se pudo generar el enlace al documento.')
        } else {
          setSignedUrl(data.signedUrl)
        }
        setLoadingUrl(false)
      })
    return () => { cancelled = true }
  }, [documento?.storage_path, documento?.storage_bucket])

  if (!documento) return null

  const mime = documento.mime_type ?? ''
  const isPdf = mime === 'application/pdf'
  const isImage = mime.startsWith('image/')
  const isDicom = mime === 'application/dicom'
  const nombre = documento.nombre_original ?? 'Documento'
  const fecha = documento.created_at
    ? format(parseISO(documento.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })
    : undefined

  const footer = signedUrl ? (
    <div className="flex items-center justify-end gap-2 px-5 py-3">
      <a
        href={signedUrl}
        download={nombre}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 text-slate-700 rounded-xl text-[13px] font-medium hover:bg-slate-200 transition-colors"
      >
        <Download size={14} /> Descargar
      </a>
      <button
        type="button"
        onClick={onClose}
        className="px-3.5 py-2 text-[13px] font-medium text-slate-700 hover:text-slate-900 transition-colors"
      >
        Cerrar
      </button>
    </div>
  ) : undefined

  return (
    <ModalShell
      open
      onClose={onClose}
      title={nombre}
      subtitle={fecha}
      maxWidth="max-w-4xl"
      footer={footer}
    >
      <div className="p-4">
        {loadingUrl && (
          <div className="flex items-center justify-center py-12 text-slate-500 text-sm gap-2">
            <Loader2 size={16} className="animate-spin" /> Cargando documento…
          </div>
        )}

        {urlError && (
          <div className="flex items-center justify-center py-12 text-red-500 text-sm gap-2">
            <AlertCircle size={16} /> {urlError}
          </div>
        )}

        {signedUrl && isPdf && (
          <iframe
            src={signedUrl}
            className="w-full h-[75vh] rounded-xl border border-slate-200"
            title={nombre}
          />
        )}

        {signedUrl && isImage && (
          <div className="flex items-center justify-center bg-slate-50 rounded-xl p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signedUrl}
              alt={nombre}
              className="max-w-full max-h-[75vh] object-contain rounded-lg"
            />
          </div>
        )}

        {signedUrl && isDicom && <DicomPreview url={signedUrl} />}

        {signedUrl && !isPdf && !isImage && !isDicom && (
          <div className="text-center py-12 text-slate-500 text-sm">
            Formato sin vista previa inline. Usa Descargar para verlo.
          </div>
        )}
      </div>
    </ModalShell>
  )
}

function uniqueId(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return `${prefix}-${rand}`
}

function DicomPreview({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const refs = useRef<EngineRefs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(1)

  useEffect(() => {
    let cancelled = false
    const engineId = uniqueId('preview-engine')
    const viewportId = uniqueId('preview-vp')
    const toolGroupId = uniqueId('preview-tg')
    refs.current = { engineId, viewportId, toolGroupId, engine: null }

    async function setup() {
      try {
        await initCornerstone()
        if (cancelled) return

        const res = await fetch(url)
        if (!res.ok) throw new Error('No se pudo descargar el archivo DICOM.')
        const blob = await res.blob()
        if (cancelled) return

        const cs = await import('@cornerstonejs/core')
        const csTools = await import('@cornerstonejs/tools')
        const { wadouri } = await import('@cornerstonejs/dicom-image-loader')

        const file = new File([blob], 'preview.dcm', { type: 'application/dicom' })
        const imageId = wadouri.fileManager.add(file)

        if (!containerRef.current || cancelled) return

        const engine = new cs.RenderingEngine(engineId)
        refs.current!.engine = engine

        engine.enableElement({
          viewportId,
          type: cs.Enums.ViewportType.STACK,
          element: containerRef.current,
          defaultOptions: { background: [0, 0, 0] as [number, number, number] },
        })

        const {
          ToolGroupManager, addTool, StackScrollTool, WindowLevelTool,
          ZoomTool, PanTool, Enums: csToolsEnums,
        } = csTools
        ;[StackScrollTool, WindowLevelTool, ZoomTool, PanTool].forEach(t => {
          try { addTool(t) } catch { /* ya registrado */ }
        })
        try { ToolGroupManager.destroyToolGroup(toolGroupId) } catch { /* ok */ }
        const tg = ToolGroupManager.createToolGroup(toolGroupId)!
        tg.addViewport(viewportId, engineId)
        tg.addTool(StackScrollTool.toolName)
        tg.addTool(WindowLevelTool.toolName)
        tg.addTool(ZoomTool.toolName)
        tg.addTool(PanTool.toolName)
        tg.setToolActive(StackScrollTool.toolName, {
          bindings: [{ mouseButton: csToolsEnums.MouseBindings.Wheel }],
        })
        tg.setToolActive(WindowLevelTool.toolName, {
          bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
        })
        tg.setToolActive(ZoomTool.toolName, {
          bindings: [{ mouseButton: csToolsEnums.MouseBindings.Secondary }],
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const viewport = engine.getViewport(viewportId) as any
        await viewport.setStack([imageId], 0)
        viewport.render()

        if (cancelled) return
        const ids: string[] = viewport.getImageIds?.() ?? [imageId]
        setTotal(ids.length || 1)
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Error al cargar el DICOM.')
        setLoading(false)
      }
    }

    setup()

    return () => {
      cancelled = true
      const r = refs.current
      if (!r) return
      import('@cornerstonejs/tools').then(({ ToolGroupManager }) => {
        try { ToolGroupManager.destroyToolGroup(r.toolGroupId) } catch { /* ok */ }
      }).catch(() => {})
      try { r.engine?.destroy() } catch { /* ok */ }
    }
  }, [url])

  return (
    <div className="relative w-full h-[70vh] bg-black rounded-xl overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-sm gap-2">
          <Loader2 size={16} className="animate-spin" /> Cargando DICOM…
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm gap-2 bg-black/80">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {!loading && !error && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-white text-[11px] px-3 py-1.5 rounded-full">
          {total > 1 ? `${total} frames · scroll para navegar · ` : ''}
          arrastra para W/L · clic derecho + arrastra para zoom
        </div>
      )}
    </div>
  )
}
