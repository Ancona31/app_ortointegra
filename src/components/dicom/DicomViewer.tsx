'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { initCornerstone } from '@/lib/dicom/init'
import DicomToolbar, { type DicomTool } from './DicomToolbar'
import { Upload, FolderOpen, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'

const RENDERING_ENGINE_ID = 'dicom-engine'
const VIEWPORT_ID = 'dicom-viewport'
const TOOL_GROUP_ID = 'dicom-tools'

export default function DicomViewer() {
  const viewportRef   = useRef<HTMLDivElement>(null)
  const engineRef     = useRef<any>(null)
  const toolGroupRef  = useRef<any>(null)
  const toolNamesRef  = useRef<Record<string, string>>({})

  const [ready, setReady]               = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [imageIds, setImageIds]         = useState<string[]>([])
  const [currentSlice, setCurrentSlice] = useState(0)
  const [activeTool, setActiveTool]     = useState<DicomTool>('WindowLevel')
  const [inverted, setInverted]         = useState(false)

  useEffect(() => {
    async function setup() {
      try {
        await initCornerstone()

        // Imports dinámicos — Turbopack no los analiza en build time
        const cs        = await import('@cornerstonejs/core')
        const csTools   = await import('@cornerstonejs/tools')
        const { wadouri } = await import('@cornerstonejs/dicom-image-loader')

        const {
          ZoomTool, PanTool, WindowLevelTool, LengthTool,
          AngleTool, StackScrollTool, ToolGroupManager, addTool,
          Enums: csToolsEnums,
        } = csTools

        // Guardar nombres para usarlos en handlers
        toolNamesRef.current = {
          Zoom:        ZoomTool.toolName,
          Pan:         PanTool.toolName,
          WindowLevel: WindowLevelTool.toolName,
          Length:      LengthTool.toolName,
          Angle:       AngleTool.toolName,
          StackScroll: StackScrollTool.toolName,
        }

        // Registrar herramientas
        ;[ZoomTool, PanTool, WindowLevelTool, LengthTool, AngleTool, StackScrollTool]
          .forEach(t => { try { addTool(t) } catch { /* ya registrado */ } })

        // Engine + viewport
        const engine = new cs.RenderingEngine(RENDERING_ENGINE_ID)
        engineRef.current = engine

        if (!viewportRef.current) return

        engine.enableElement({
          viewportId: VIEWPORT_ID,
          type: cs.Enums.ViewportType.STACK,
          element: viewportRef.current,
          defaultOptions: { background: [0, 0, 0] as [number, number, number] },
        })

        // Tool group
        const tg = ToolGroupManager.createToolGroup(TOOL_GROUP_ID)!
        toolGroupRef.current = tg
        tg.addViewport(VIEWPORT_ID, RENDERING_ENGINE_ID)

        Object.values(toolNamesRef.current).forEach(name => tg.addTool(name))

        // Scroll con rueda siempre activo
        tg.setToolActive(StackScrollTool.toolName, {
          bindings: [{ mouseButton: csToolsEnums.MouseBindings.Wheel }],
        })

        // WindowLevel como tool inicial
        tg.setToolActive(WindowLevelTool.toolName, {
          bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
        })

        setReady(true)
      } catch (e) {
        console.error('Error inicializando cornerstone:', e)
        setError('No se pudo inicializar el visor. Usa Chrome o Edge.')
      }
    }

    setup()

    return () => {
      try {
        const { ToolGroupManager } = require('@cornerstonejs/tools')
        ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID)
        engineRef.current?.destroy()
      } catch { /* cleanup silencioso */ }
    }
  }, [])

  const handleToolChange = useCallback((tool: DicomTool) => {
    if (tool === 'Reset') {
      const viewport = engineRef.current?.getViewport(VIEWPORT_ID)
      if (viewport) {
        viewport.resetCamera()
        viewport.resetProperties()
        setInverted(false)
        viewport.render()
      }
      return
    }

    const tg = toolGroupRef.current
    if (!tg) return

    const names = toolNamesRef.current
    const prev  = names[activeTool]
    if (prev && prev !== names.StackScroll) tg.setToolPassive(prev)

    import('@cornerstonejs/tools').then(({ Enums: csToolsEnums }) => {
      tg.setToolActive(names[tool], {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
      })
    })

    setActiveTool(tool)
  }, [activeTool])

  const handleInvert = useCallback(() => {
    const viewport = engineRef.current?.getViewport(VIEWPORT_ID)
    if (!viewport) return
    const props = viewport.getProperties()
    const next  = !inverted
    viewport.setProperties({ invert: next, voiRange: props.voiRange })
    viewport.render()
    setInverted(next)
  }, [inverted])

  const loadFiles = useCallback(async (files: FileList) => {
    if (!ready || !engineRef.current) return
    setLoading(true)
    setError(null)
    setInverted(false)

    try {
      const { wadouri } = await import('@cornerstonejs/dicom-image-loader')

      const dcmFiles = Array.from(files).filter(f =>
        f.name.toLowerCase().endsWith('.dcm') ||
        f.type === 'application/dicom' ||
        f.type === ''
      )

      if (dcmFiles.length === 0) {
        setError('No se encontraron archivos DICOM (.dcm) en la selección.')
        setLoading(false)
        return
      }

      dcmFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

      const ids = dcmFiles.map(f => wadouri.fileManager.add(f))

      setImageIds(ids)
      setCurrentSlice(0)

      const viewport = engineRef.current.getViewport(VIEWPORT_ID)
      await viewport.setStack(ids, 0)
      viewport.resetCamera()
      viewport.render()
    } catch (e) {
      console.error('Error cargando DICOM:', e)
      setError('Error al cargar el archivo. Verifica que sea un archivo DICOM válido.')
    } finally {
      setLoading(false)
    }
  }, [ready])

  const goToSlice = useCallback(async (index: number) => {
    if (!engineRef.current || imageIds.length === 0) return
    const clamped = Math.max(0, Math.min(index, imageIds.length - 1))
    const viewport = engineRef.current.getViewport(VIEWPORT_ID)
    await viewport.setImageIdIndex(clamped)
    viewport.render()
    setCurrentSlice(clamped)
  }, [imageIds])

  return (
    <div className="flex flex-col gap-3 h-full">
      <DicomToolbar
        activeTool={activeTool}
        inverted={inverted}
        onToolChange={handleToolChange}
        onInvert={handleInvert}
        disabled={!ready || imageIds.length === 0}
      />

      <div className="flex gap-3 flex-1 min-h-0">
        {/* Viewport */}
        <div className="relative flex-1 bg-black rounded-lg overflow-hidden min-h-[500px]">
          <div ref={viewportRef} className="w-full h-full" />

          {ready && imageIds.length === 0 && !loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3 pointer-events-none">
              <Upload size={40} className="opacity-30" />
              <p className="text-sm">Selecciona un archivo DICOM para comenzar</p>
            </div>
          )}

          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 size={18} className="animate-spin" />
                Inicializando motor de renderizado...
              </div>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="flex items-center gap-2 text-white text-sm">
                <Loader2 size={18} className="animate-spin" />
                Cargando estudio...
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="flex items-center gap-2 text-red-400 text-sm bg-black/80 px-4 py-3 rounded-lg max-w-xs text-center">
                <AlertCircle size={18} className="shrink-0" />
                {error}
              </div>
            </div>
          )}

          {imageIds.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full">
              <button onClick={() => goToSlice(currentSlice - 1)} disabled={currentSlice === 0}
                className="disabled:opacity-30 hover:text-[#1e5fa8]"><ChevronLeft size={14} /></button>
              <span>{currentSlice + 1} / {imageIds.length}</span>
              <button onClick={() => goToSlice(currentSlice + 1)} disabled={currentSlice === imageIds.length - 1}
                className="disabled:opacity-30 hover:text-[#1e5fa8]"><ChevronRight size={14} /></button>
            </div>
          )}
        </div>

        {/* Panel lateral */}
        <div className="w-48 flex flex-col gap-2 shrink-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Abrir estudio</p>

          <label className="flex flex-col items-center gap-2 p-3 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-[#1e5fa8] hover:bg-slate-50 transition-colors text-center">
            <Upload size={20} className="text-slate-400" />
            <span className="text-xs text-slate-500">Archivo(s) .dcm</span>
            <input type="file" accept=".dcm,application/dicom" multiple className="hidden"
              onChange={e => e.target.files && loadFiles(e.target.files)} />
          </label>

          <label className="flex flex-col items-center gap-2 p-3 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-[#1e5fa8] hover:bg-slate-50 transition-colors text-center">
            <FolderOpen size={20} className="text-slate-400" />
            <span className="text-xs text-slate-500">Carpeta de serie</span>
            <input type="file"
              // @ts-expect-error — webkitdirectory no está en los tipos estándar
              webkitdirectory=""
              className="hidden"
              onChange={e => e.target.files && loadFiles(e.target.files)} />
          </label>

          {imageIds.length > 0 && (
            <div className="mt-2 p-2 bg-slate-50 rounded-lg text-xs text-slate-500">
              <p className="font-medium text-slate-700">{imageIds.length} imagen{imageIds.length > 1 ? 'es' : ''}</p>
              <p className="mt-0.5">Scroll para navegar entre slices</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
