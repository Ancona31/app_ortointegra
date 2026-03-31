'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { initCornerstone } from '@/lib/dicom/init'
import DicomToolbar, { type DicomTool, type DicomAction, type MprPanels } from './DicomToolbar'
import DicomMetadataPanel, { type DicomMeta } from './DicomMetadataPanel'
import DicomSeriesPanel, { type SeriesInfo } from './DicomSeriesPanel'
import { Upload, FolderOpen, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'

const ENGINE_ID    = 'dicom-engine'
const VIEWPORT_ID  = 'dicom-viewport'
const TOOL_GROUP_ID = 'dicom-tools'

// MPR viewport IDs
const VP_AXIAL    = 'vp-axial'
const VP_SAGITTAL = 'vp-sagittal'
const VP_CORONAL  = 'vp-coronal'

// Window/Level presets [center, width]
const WL_PRESETS = {
  PresetBone:        [400,  1500],
  PresetSoftTissue:  [40,   400],
  PresetLung:        [-600, 1500],
} as Record<string, [number, number]>

function parseDicomDate(raw?: string): string | undefined {
  if (!raw || raw.length < 8) return raw
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
}

function readDicomMeta(file: File): Promise<DicomMeta> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const dicomParser = require('dicom-parser')
        const buf    = e.target!.result as ArrayBuffer
        const ds     = dicomParser.parseDicom(new Uint8Array(buf))
        const g = (tag: string) => { try { return ds.string(tag) } catch { return undefined } }
        resolve({
          patientName:       g('x00100010')?.replace(/\^/g, ' ').trim(),
          patientId:         g('x00100020'),
          studyDate:         parseDicomDate(g('x00080020')),
          modality:          g('x00080060'),
          studyDescription:  g('x00081030'),
          seriesDescription: g('x0008103e'),
          sliceThickness:    g('x00500088') || g('x00180050'),
          kvp:               g('x00180060'),
          rows:              g('x00280010'),
          columns:           g('x00280011'),
          instanceNumber:    g('x00200013'),
          manufacturer:      g('x00080070'),
        })
      } catch { resolve({}) }
    }
    reader.onerror = () => resolve({})
    reader.readAsArrayBuffer(file.slice(0, 4096))
  })
}

function isVolumetricSeries(files: File[]): boolean {
  return files.length >= 3
}

function readSeriesInfo(file: File): Promise<{
  uid: string; description: string; number: number; modality: string
}> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const dicomParser = require('dicom-parser')
        const ds = dicomParser.parseDicom(new Uint8Array(e.target!.result as ArrayBuffer))
        const g  = (tag: string) => { try { return ds.string(tag) } catch { return '' } }
        resolve({
          uid:         g('x0020000e') || 'unknown',
          description: g('x0008103e') || g('x00081030') || '',
          number:      parseInt(g('x00200011') || '0') || 0,
          modality:    g('x00080060') || '',
        })
      } catch { resolve({ uid: 'unknown', description: '', number: 0, modality: '' }) }
    }
    reader.onerror = () => resolve({ uid: 'unknown', description: '', number: 0, modality: '' })
    reader.readAsArrayBuffer(file.slice(0, 4096))
  })
}

/**
 * Sort imageIds by their spatial position along the slice-normal vector.
 * Without this the volume is assembled in filename order which scrambles the MPR.
 */
function getPanelStyle(
  plane: 'axial' | 'sagittal' | 'coronal',
  mprPanels: MprPanels,
): React.CSSProperties {
  const idx = { axial: 0, sagittal: 1, coronal: 2 }[plane]
  if (mprPanels === '3panels') {
    // Side-by-side thirds
    return { position: 'absolute', top: 0, bottom: 0, left: `${idx * 33.333}%`, width: '33.333%' }
  }
  if (mprPanels === plane) {
    // Full-screen
    return { position: 'absolute', inset: 0 }
  }
  // Collapsed but still mounted — 1×1 px keeps cornerstone alive without painting
  return { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }
}

function sortByImagePosition(imageIds: string[], getMeta: (type: string, id: string) => any): string[] {
  const firstPlane = getMeta('imagePlaneModule', imageIds[0])
  if (!firstPlane?.rowCosines || !firstPlane?.columnCosines) return imageIds

  const r = firstPlane.rowCosines as number[]
  const c = firstPlane.columnCosines as number[]
  // Normal = row × col direction
  const normal = [
    r[1] * c[2] - r[2] * c[1],
    r[2] * c[0] - r[0] * c[2],
    r[0] * c[1] - r[1] * c[0],
  ]

  return [...imageIds].sort((a, b) => {
    const posA = getMeta('imagePlaneModule', a)?.imagePositionPatient as number[] | undefined
    const posB = getMeta('imagePlaneModule', b)?.imagePositionPatient as number[] | undefined
    if (!posA || !posB) return 0
    const dotA = posA[0] * normal[0] + posA[1] * normal[1] + posA[2] * normal[2]
    const dotB = posB[0] * normal[0] + posB[1] * normal[1] + posB[2] * normal[2]
    return dotA - dotB
  })
}

export default function DicomViewer() {
  const viewportRef  = useRef<HTMLDivElement>(null)
  const axialRef     = useRef<HTMLDivElement>(null)
  const sagittalRef  = useRef<HTMLDivElement>(null)
  const coronalRef   = useRef<HTMLDivElement>(null)
  const engineRef      = useRef<any>(null)
  const toolGroupRef   = useRef<any>(null)
  const toolNamesRef   = useRef<Record<string, string>>({})
  const flipRef        = useRef({ h: false, v: false })
  const dcmFilesRef    = useRef<File[]>([])
  // Always-current refs for MPR callbacks (avoids stale closure in handleAction)
  const activateMPRRef   = useRef<() => Promise<void>>(async () => {})
  const deactivateMPRRef = useRef<() => Promise<void>>(async () => {})

  const [ready, setReady]                   = useState(false)
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [imageIds, setImageIds]             = useState<string[]>([])
  const [currentSlice, setCurrentSlice]     = useState(0)
  const [activeTool, setActiveTool]         = useState<DicomTool>('WindowLevel')
  const [inverted, setInverted]             = useState(false)
  const [mprAvailable, setMprAvailable]     = useState(false)
  const [mprActive, setMprActive]           = useState(false)
  const [metadataVisible, setMetadataVisible] = useState(false)
  const [mprPanels, setMprPanels]             = useState<MprPanels>('3panels')
  const [dicomMeta, setDicomMeta]             = useState<DicomMeta | null>(null)
  const [allSeries, setAllSeries]             = useState<SeriesInfo[]>([])
  const [activeSeriesUid, setActiveSeriesUid] = useState<string | null>(null)
  const [seriesVisible, setSeriesVisible]     = useState(false)
  // Map seriesUID → imageIds (populated on file load)
  const seriesMapRef = useRef<Map<string, string[]>>(new Map())

  // ─── Init cornerstone ────────────────────────────────────────────────────
  useEffect(() => {
    async function setup() {
      try {
        await initCornerstone()

        const cs      = await import('@cornerstonejs/core')
        const csTools = await import('@cornerstonejs/tools')

        const {
          ZoomTool, PanTool, WindowLevelTool, LengthTool, AngleTool,
          CobbAngleTool, ProbeTool, EllipticalROITool, RectangleROITool,
          ArrowAnnotateTool, StackScrollTool, CrosshairsTool,
          ToolGroupManager, addTool, Enums: csToolsEnums,
        } = csTools

        toolNamesRef.current = {
          Zoom:          ZoomTool.toolName,
          Pan:           PanTool.toolName,
          WindowLevel:   WindowLevelTool.toolName,
          Length:        LengthTool.toolName,
          Angle:         AngleTool.toolName,
          CobbAngle:     CobbAngleTool.toolName,
          Probe:         ProbeTool.toolName,
          EllipticalROI: EllipticalROITool.toolName,
          RectangleROI:  RectangleROITool.toolName,
          ArrowAnnotate: ArrowAnnotateTool.toolName,
          StackScroll:   StackScrollTool.toolName,
          Crosshairs:    CrosshairsTool.toolName,
        }

        const allTools = [
          ZoomTool, PanTool, WindowLevelTool, LengthTool, AngleTool,
          CobbAngleTool, ProbeTool, EllipticalROITool, RectangleROITool,
          ArrowAnnotateTool, StackScrollTool, CrosshairsTool,
        ]
        allTools.forEach(t => { try { addTool(t) } catch { /* ya registrado */ } })

        // Cleanup before init (hot reload)
        try { ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID) } catch { /* ok */ }
        try { cs.getRenderingEngine(ENGINE_ID)?.destroy() } catch { /* ok */ }

        const engine = new cs.RenderingEngine(ENGINE_ID)
        engineRef.current = engine

        if (!viewportRef.current) return

        engine.enableElement({
          viewportId: VIEWPORT_ID,
          type: cs.Enums.ViewportType.STACK,
          element: viewportRef.current,
          defaultOptions: { background: [0, 0, 0] as [number, number, number] },
        })

        const tg = ToolGroupManager.createToolGroup(TOOL_GROUP_ID)!
        toolGroupRef.current = tg
        tg.addViewport(VIEWPORT_ID, ENGINE_ID)

        Object.values(toolNamesRef.current)
          .filter(n => n !== CrosshairsTool.toolName)
          .forEach(name => tg.addTool(name))

        tg.setToolActive(StackScrollTool.toolName, {
          bindings: [{ mouseButton: csToolsEnums.MouseBindings.Wheel }],
        })
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
      } catch { /* cleanup */ }
    }
  }, [])

  // ─── Tool change ─────────────────────────────────────────────────────────
  const handleToolChange = useCallback((tool: DicomTool) => {
    if (tool === 'Reset') {
      if (mprActive) {
        // Reset all 3 MPR viewports
        const engine = engineRef.current
        if (!engine) return
        ;[VP_AXIAL, VP_SAGITTAL, VP_CORONAL].forEach(id => {
          try {
            const vp = engine.getViewport(id)
            vp?.resetCamera()
            vp?.render()
          } catch { /* ok */ }
        })
      } else {
        const viewport = engineRef.current?.getViewport(VIEWPORT_ID)
        if (viewport) {
          viewport.resetCamera()
          viewport.resetProperties()
          setInverted(false)
          flipRef.current = { h: false, v: false }
          viewport.render()
        }
      }
      return
    }

    const tg    = toolGroupRef.current
    const names = toolNamesRef.current
    if (!tg) return

    // Deactivate previous tool (always, except persistent background tools)
    const prev = names[activeTool]
    if (prev && prev !== names.StackScroll) {
      try { tg.setToolPassive(prev) } catch { /* ok */ }
    }

    const NAV_TOOLS: DicomTool[] = ['Zoom', 'Pan', 'WindowLevel']
    const isMeasurementTool = !NAV_TOOLS.includes(tool)

    import('@cornerstonejs/tools').then(({ Enums: csToolsEnums }) => {
      if (mprActive) {
        if (isMeasurementTool) {
          // Crosshairs conflicts with measurement tools on Primary — suspend it
          try { tg.setToolPassive(names.Crosshairs) } catch { /* ok */ }
        } else {
          // Returning to a nav tool — restore Crosshairs on Primary
          try {
            tg.setToolActive(names.Crosshairs, {
              bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
            })
          } catch { /* ok */ }
        }
      }

      tg.setToolActive(names[tool], {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
      })
    })

    setActiveTool(tool)
  }, [activeTool, mprActive])

  // ─── Actions ─────────────────────────────────────────────────────────────
  const handleAction = useCallback((action: DicomAction) => {
    const engine  = engineRef.current
    const viewport = engine?.getViewport(VIEWPORT_ID)

    if (action === 'Invert') {
      if (!viewport) return
      const props = viewport.getProperties()
      const next  = !inverted
      viewport.setProperties({ invert: next, voiRange: props.voiRange })
      viewport.render()
      setInverted(next)
      return
    }

    if (action === 'FlipH' || action === 'FlipV') {
      if (!viewport) return
      const camera = viewport.getCamera()
      if (action === 'FlipH') {
        flipRef.current.h = !flipRef.current.h
        viewport.setCamera({ ...camera, flipHorizontal: flipRef.current.h })
      } else {
        flipRef.current.v = !flipRef.current.v
        viewport.setCamera({ ...camera, flipVertical: flipRef.current.v })
      }
      viewport.render()
      return
    }

    if (action in WL_PRESETS) {
      const applyPreset = (vp: any) => {
        if (!vp) return
        const [center, width] = WL_PRESETS[action]
        vp.setProperties({ voiRange: { lower: center - width / 2, upper: center + width / 2 } })
        vp.render()
      }
      if (mprActive) {
        ;[VP_AXIAL, VP_SAGITTAL, VP_CORONAL].forEach(id => {
          try { applyPreset(engine?.getViewport(id)) } catch { /* ok */ }
        })
      } else {
        applyPreset(viewport)
      }
      return
    }

    if (action === 'ExportPNG') {
      const container = mprActive ? axialRef.current : viewportRef.current
      const canvas = container?.querySelector('canvas') as HTMLCanvasElement | null
      if (!canvas) return
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `dicom-${Date.now()}.png`
      a.click()
      return
    }

    if (action === 'ClearAnnotations') {
      import('@cornerstonejs/tools').then(({ annotation }) => {
        annotation.state.removeAllAnnotations()
        engineRef.current?.renderViewports(
          mprActive
            ? [VP_AXIAL, VP_SAGITTAL, VP_CORONAL]
            : [VIEWPORT_ID]
        )
      })
      return
    }

    if (action === 'ToggleSeries') {
      setSeriesVisible(v => !v)
      return
    }

    if (action === 'ToggleMetadata') {
      setMetadataVisible(v => !v)
      return
    }

    if (action === 'ToggleMPR') {
      if (mprActive) deactivateMPRRef.current()
      else activateMPRRef.current()
      return
    }
  }, [inverted, mprActive])

  // ─── Activate MPR ────────────────────────────────────────────────────────
  const activateMPR = useCallback(async () => {
    if (!engineRef.current || imageIds.length < 3) return
    setLoading(true)

    try {
      const cs      = await import('@cornerstonejs/core')
      const csTools = await import('@cornerstonejs/tools')
      const { ToolGroupManager, CrosshairsTool, Enums: csToolsEnums } = csTools
      const { volumeLoader, setVolumesForViewports, cornerstoneStreamingImageVolumeLoader } = cs

      // Register volume loader if not already
      try {
        volumeLoader.registerVolumeLoader(
          'cornerstoneStreamingImageVolume',
          cornerstoneStreamingImageVolumeLoader as any,
        )
      } catch { /* already registered */ }

      // ── Pre-load images in batches so wadouri metadata cache is populated ──
      // cornerstoneStreamingImageVolumeLoader needs imagePlaneModule for every imageId.
      // With wadouri file-based images that metadata only exists after decoding.
      // Batching avoids memory spikes with large series (500+ slices).
      const { imageLoader } = cs
      const BATCH = 40
      for (let i = 0; i < imageIds.length; i += BATCH) {
        await Promise.all(
          imageIds.slice(i, i + BATCH).map(id =>
            imageLoader.loadAndCacheImage(id).catch(() => null)
          )
        )
      }

      // ── Group by SeriesInstanceUID + FrameOfReferenceUID ─────────────────
      // Large folders (500+ files) often contain multiple series: axial, coronal
      // reformats, scout images, dose reports — each with different orientations.
      // Mixing them into one volume causes the misalignment the user sees.
      // We pick the largest coherent series (same series + same frame of reference).
      type SeriesKey = string
      const seriesMap = new Map<SeriesKey, string[]>()
      for (const id of imageIds) {
        const plane  = cs.metaData.get('imagePlaneModule', id)
        const series = cs.metaData.get('generalSeriesModule', id)
        if (!Array.isArray(plane?.imagePositionPatient) || plane.imagePositionPatient.length !== 3) continue
        const key: SeriesKey = [
          series?.seriesInstanceUID ?? 'unknown',
          plane?.frameOfReferenceUID ?? '',
        ].join('|')
        if (!seriesMap.has(key)) seriesMap.set(key, [])
        seriesMap.get(key)!.push(id)
      }

      // Use the series with the most slices (= primary volumetric acquisition)
      const volumeImageIds = [...seriesMap.values()]
        .sort((a, b) => b.length - a.length)[0] ?? []

      if (volumeImageIds.length < 3) {
        setError('MPR requiere datos de posición 3D (TC o RM). Este estudio no los contiene.')
        setLoading(false)
        return
      }

      // Destroy stack viewport + tool group
      const engine = engineRef.current
      try { engine.disableElement(VIEWPORT_ID) } catch { /* ok */ }
      try { ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID) } catch { /* ok */ }

      // Create 3 volume viewports (refs always mounted)
      engine.setViewports([
        {
          viewportId: VP_AXIAL,
          type: cs.Enums.ViewportType.ORTHOGRAPHIC,
          element: axialRef.current,
          defaultOptions: {
            orientation: cs.Enums.OrientationAxis.AXIAL,
            background: [0, 0, 0] as [number, number, number],
          },
        },
        {
          viewportId: VP_SAGITTAL,
          type: cs.Enums.ViewportType.ORTHOGRAPHIC,
          element: sagittalRef.current,
          defaultOptions: {
            orientation: cs.Enums.OrientationAxis.SAGITTAL,
            background: [0, 0, 0] as [number, number, number],
          },
        },
        {
          viewportId: VP_CORONAL,
          type: cs.Enums.ViewportType.ORTHOGRAPHIC,
          element: coronalRef.current,
          defaultOptions: {
            orientation: cs.Enums.OrientationAxis.CORONAL,
            background: [0, 0, 0] as [number, number, number],
          },
        },
      ])

      // Sort spatially by ImagePositionPatient — filename order scrambles the volume
      const sortedIds = sortByImagePosition(volumeImageIds, (type, id) => cs.metaData.get(type, id))

      // Load volume using only images with valid 3D positioning
      const volumeId = `cornerstoneStreamingImageVolume:dicom-volume-${Date.now()}`
      const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds: sortedIds })
      await volume.load()

      await setVolumesForViewports(engine, [{ volumeId }], [VP_AXIAL, VP_SAGITTAL, VP_CORONAL])

      // Apply soft-tissue W/L as default — auto W/L is usually wrong for CT
      const defaultCenter = 40
      const defaultWidth  = 400
      ;[VP_AXIAL, VP_SAGITTAL, VP_CORONAL].forEach(id => {
        try {
          const vp = engine.getViewport(id)
          vp?.setProperties({
            voiRange: {
              lower: defaultCenter - defaultWidth / 2,
              upper: defaultCenter + defaultWidth / 2,
            },
          })
        } catch { /* ok */ }
      })

      // New tool group for MPR
      const tg = ToolGroupManager.createToolGroup(TOOL_GROUP_ID)!
      toolGroupRef.current = tg
      ;[VP_AXIAL, VP_SAGITTAL, VP_CORONAL].forEach(id => tg.addViewport(id, ENGINE_ID))

      const names = toolNamesRef.current
      Object.values(names).forEach(name => {
        try { tg.addTool(name) } catch { /* ok */ }
      })

      // Crosshairs active on all 3 viewports
      tg.setToolActive(names.Crosshairs, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
      })
      tg.setToolActive(names.WindowLevel, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Secondary }],
      })
      tg.setToolActive(names.StackScroll, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Wheel }],
      })

      engine.renderViewports([VP_AXIAL, VP_SAGITTAL, VP_CORONAL])
      setMprActive(true)
      setActiveTool('WindowLevel')
    } catch (e) {
      console.error('Error activando MPR:', e)
      setError('Error al cargar el volumen MPR.')
    } finally {
      setLoading(false)
    }
  }, [imageIds])
  // Keep ref in sync so handleAction always calls the latest version
  activateMPRRef.current = activateMPR

  // ─── Deactivate MPR ──────────────────────────────────────────────────────
  const deactivateMPR = useCallback(async () => {
    setLoading(true)
    try {
      const cs      = await import('@cornerstonejs/core')
      const csTools = await import('@cornerstonejs/tools')
      const { ToolGroupManager, WindowLevelTool, StackScrollTool, Enums: csToolsEnums } = csTools

      const engine = engineRef.current
      try { ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID) } catch { /* ok */ }
      ;[VP_AXIAL, VP_SAGITTAL, VP_CORONAL].forEach(id => {
        try { engine.disableElement(id) } catch { /* ok */ }
      })

      await new Promise(r => setTimeout(r, 50))

      if (!viewportRef.current) { setLoading(false); return }

      engine.enableElement({
        viewportId: VIEWPORT_ID,
        type: cs.Enums.ViewportType.STACK,
        element: viewportRef.current,
        defaultOptions: { background: [0, 0, 0] as [number, number, number] },
      })

      const tg = ToolGroupManager.createToolGroup(TOOL_GROUP_ID)!
      toolGroupRef.current = tg
      tg.addViewport(VIEWPORT_ID, ENGINE_ID)

      const names = toolNamesRef.current
      Object.values(names)
        .filter(n => n !== toolNamesRef.current.Crosshairs)
        .forEach(name => { try { tg.addTool(name) } catch { /* ok */ } })

      tg.setToolActive(StackScrollTool.toolName, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Wheel }],
      })
      tg.setToolActive(WindowLevelTool.toolName, {
        bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
      })

      const viewport = engine.getViewport(VIEWPORT_ID)
      if (viewport && imageIds.length > 0) {
        await viewport.setStack(imageIds, currentSlice)
        viewport.render()
      }

      setMprActive(false)
      setMprPanels('3panels')
      setActiveTool('WindowLevel')
      setInverted(false)
      flipRef.current = { h: false, v: false }
    } catch (e) {
      console.error('Error desactivando MPR:', e)
    } finally {
      setLoading(false)
    }
  }, [imageIds, currentSlice])
  // Keep ref in sync so handleAction always calls the latest version
  deactivateMPRRef.current = deactivateMPR

  // ─── Switch MPR panel layout ──────────────────────────────────────────────
  // Each viewport keeps its own orientation — we only change which one is visible.
  // After the CSS change, tell cornerstone to resize so the canvas fills the new bounds.
  const handleMprPanels = useCallback((panels: MprPanels) => {
    setMprPanels(panels)
    // React re-renders first, then cornerstone detects the resize via ResizeObserver.
    // A small explicit nudge ensures it picks up the new dimensions immediately.
    setTimeout(() => {
      try { engineRef.current?.resize(true) } catch { /* ok */ }
    }, 50)
  }, [])

  // ─── Load files ──────────────────────────────────────────────────────────
  // ─── Switch to a series by UID ───────────────────────────────────────────
  const switchToSeries = useCallback(async (uid: string) => {
    const ids = seriesMapRef.current.get(uid)
    if (!ids || ids.length === 0) return
    if (mprActive) deactivateMPRRef.current()

    setLoading(true)
    setError(null)
    setInverted(false)
    setMprPanels('3panels')
    flipRef.current = { h: false, v: false }

    try {
      const cs = await import('@cornerstonejs/core')
      let viewport = engineRef.current?.getViewport(VIEWPORT_ID)
      if (!viewport && viewportRef.current) {
        engineRef.current.enableElement({
          viewportId: VIEWPORT_ID,
          type: cs.Enums.ViewportType.STACK,
          element: viewportRef.current,
          defaultOptions: { background: [0, 0, 0] as [number, number, number] },
        })
        viewport = engineRef.current.getViewport(VIEWPORT_ID)
      }
      if (!viewport) return

      await viewport.setStack(ids, 0)
      viewport.resetCamera()
      viewport.render()

      setImageIds(ids)
      setCurrentSlice(0)
      setMprAvailable(ids.length >= 3)
      setActiveSeriesUid(uid)
    } catch (e) {
      console.error('Error cambiando serie:', e)
      setError('Error al cargar la serie.')
    } finally {
      setLoading(false)
    }
  }, [mprActive])

  // ─── Load files ──────────────────────────────────────────────────────────
  const loadFiles = useCallback(async (files: FileList) => {
    if (!ready || !engineRef.current) return
    setLoading(true)
    setError(null)
    setInverted(false)
    setMprActive(false)
    setMprPanels('3panels')
    setAllSeries([])
    setSeriesVisible(false)
    flipRef.current = { h: false, v: false }

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
      dcmFilesRef.current = dcmFiles

      // Register all files with wadouri and build id→file map
      const ids = dcmFiles.map(f => wadouri.fileManager.add(f))

      // ── Read series headers in parallel batches (only ~4 KB per file) ───
      const BATCH = 60
      const seriesHeaders: { uid: string; description: string; number: number; modality: string }[] = []
      for (let i = 0; i < dcmFiles.length; i += BATCH) {
        const batch = await Promise.all(dcmFiles.slice(i, i + BATCH).map(readSeriesInfo))
        seriesHeaders.push(...batch)
      }

      // Group imageIds by seriesUID (preserve filename sort order within each series)
      const rawMap = new Map<string, { info: typeof seriesHeaders[0]; ids: string[] }>()
      for (let i = 0; i < seriesHeaders.length; i++) {
        const h = seriesHeaders[i]
        if (!rawMap.has(h.uid)) rawMap.set(h.uid, { info: h, ids: [] })
        rawMap.get(h.uid)!.ids.push(ids[i])
      }

      // Build SeriesInfo list sorted by SeriesNumber
      const seriesList: SeriesInfo[] = [...rawMap.values()]
        .sort((a, b) => (a.info.number || 999) - (b.info.number || 999))
        .map(({ info, ids: sIds }) => ({
          uid:         info.uid,
          description: info.description,
          number:      info.number,
          modality:    info.modality,
          count:       sIds.length,
          imageIds:    sIds,
          isVolumetric: sIds.length >= 3,
        }))

      // Store in ref for fast access
      seriesMapRef.current = new Map(seriesList.map(s => [s.uid, s.imageIds]))
      setAllSeries(seriesList)

      // Auto-select: prefer the series with most slices
      const defaultSeries = [...seriesList].sort((a, b) => b.count - a.count)[0]
      const defaultIds = defaultSeries.imageIds

      setImageIds(defaultIds)
      setCurrentSlice(0)
      setMprAvailable(defaultIds.length >= 3)
      setActiveSeriesUid(defaultSeries.uid)
      if (seriesList.length > 1) setSeriesVisible(true)

      readDicomMeta(dcmFiles[0]).then(setDicomMeta)

      // Load into viewport
      const cs = await import('@cornerstonejs/core')
      const csTools = await import('@cornerstonejs/tools')
      const { ToolGroupManager } = csTools
      let viewport = engineRef.current.getViewport(VIEWPORT_ID)

      if (!viewport && viewportRef.current) {
        engineRef.current.enableElement({
          viewportId: VIEWPORT_ID,
          type: cs.Enums.ViewportType.STACK,
          element: viewportRef.current,
          defaultOptions: { background: [0, 0, 0] as [number, number, number] },
        })
        viewport = engineRef.current.getViewport(VIEWPORT_ID)
        const tg = ToolGroupManager.createToolGroup(TOOL_GROUP_ID) ?? toolGroupRef.current
        toolGroupRef.current = tg
        tg.addViewport(VIEWPORT_ID, ENGINE_ID)
      }

      await viewport.setStack(defaultIds, 0)
      viewport.resetCamera()
      viewport.render()
    } catch (e) {
      console.error('Error cargando DICOM:', e)
      setError('Error al cargar el archivo. Verifica que sea un archivo DICOM válido.')
    } finally {
      setLoading(false)
    }
  }, [ready])

  // ─── Navigate slices ─────────────────────────────────────────────────────
  const goToSlice = useCallback(async (index: number) => {
    if (!engineRef.current || imageIds.length === 0 || mprActive) return
    const clamped  = Math.max(0, Math.min(index, imageIds.length - 1))
    const viewport = engineRef.current.getViewport(VIEWPORT_ID)
    if (!viewport) return
    await viewport.setImageIdIndex(clamped)
    viewport.render()
    setCurrentSlice(clamped)
  }, [imageIds, mprActive])

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-2 h-full">
      <DicomToolbar
        activeTool={activeTool}
        inverted={inverted}
        mprAvailable={mprAvailable}
        mprActive={mprActive}
        mprPanels={mprPanels}
        metadataVisible={metadataVisible}
        seriesVisible={seriesVisible}
        seriesCount={allSeries.length}
        onToolChange={handleToolChange}
        onAction={handleAction}
        onMprPanels={handleMprPanels}
        disabled={!ready || imageIds.length === 0}
      />

      <div className="flex gap-2 flex-1 min-h-0">
        {/* ── Viewport area ── */}
        <div className="relative flex-1 bg-black rounded-lg overflow-hidden min-h-[500px]">

          {/* Stack viewport (2D) — always mounted so ref is valid */}
          <div
            ref={viewportRef}
            className={`w-full h-full ${mprActive ? 'invisible pointer-events-none' : ''}`}
          />

          {/* MPR panels — single stable DOM structure, only inline styles change.
              Refs never move between parent elements so cornerstone never loses the canvas. */}
          <div className={`absolute inset-0 bg-slate-800 ${mprActive ? '' : 'invisible pointer-events-none'}`}>
            <div className="relative w-full h-full">
              <div style={getPanelStyle('axial', mprPanels)}>
                <div ref={axialRef} className="w-full h-full" />
                {(mprPanels === '3panels' || mprPanels === 'axial') && (
                  <span className="absolute top-1 left-2 text-[10px] text-yellow-400 font-semibold pointer-events-none select-none">AXIAL</span>
                )}
              </div>
              <div style={getPanelStyle('sagittal', mprPanels)}>
                <div ref={sagittalRef} className="w-full h-full" />
                {(mprPanels === '3panels' || mprPanels === 'sagittal') && (
                  <span className="absolute top-1 left-2 text-[10px] text-green-400 font-semibold pointer-events-none select-none">SAGITAL</span>
                )}
              </div>
              <div style={getPanelStyle('coronal', mprPanels)}>
                <div ref={coronalRef} className="w-full h-full" />
                {(mprPanels === '3panels' || mprPanels === 'coronal') && (
                  <span className="absolute top-1 left-2 text-[10px] text-red-400 font-semibold pointer-events-none select-none">CORONAL</span>
                )}
              </div>
            </div>
          </div>

          {/* Empty state */}
          {ready && imageIds.length === 0 && !loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3 pointer-events-none">
              <Upload size={40} className="opacity-30" />
              <p className="text-sm">Selecciona un archivo DICOM para comenzar</p>
            </div>
          )}

          {/* Init loading */}
          {!ready && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Loader2 size={18} className="animate-spin" />
                Inicializando motor de renderizado...
              </div>
            </div>
          )}

          {/* File loading */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
              <div className="flex items-center gap-2 text-white text-sm">
                <Loader2 size={18} className="animate-spin" />
                {mprActive ? 'Cargando imágenes y construyendo volumen MPR...' : 'Cargando estudio...'}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <div className="flex items-center gap-2 text-red-400 text-sm bg-black/80 px-4 py-3 rounded-lg max-w-xs text-center">
                <AlertCircle size={18} className="shrink-0" />
                {error}
              </div>
            </div>
          )}

          {/* Slice navigator */}
          {imageIds.length > 1 && !mprActive && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full z-10">
              <button onClick={() => goToSlice(currentSlice - 1)} disabled={currentSlice === 0}
                className="disabled:opacity-30 hover:text-[#1e5fa8]"><ChevronLeft size={14} /></button>
              <span>{currentSlice + 1} / {imageIds.length}</span>
              <button onClick={() => goToSlice(currentSlice + 1)} disabled={currentSlice === imageIds.length - 1}
                className="disabled:opacity-30 hover:text-[#1e5fa8]"><ChevronRight size={14} /></button>
            </div>
          )}

          {/* MPR badge */}
          {mprActive && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-teal-900/80 text-teal-300 text-xs px-3 py-1 rounded-full z-10 pointer-events-none">
              MPR activo — rueda del mouse para navegar · clic derecho para W/L
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-2 shrink-0">

          {/* Series panel */}
          {seriesVisible && allSeries.length > 1 && (
            <DicomSeriesPanel
              series={allSeries}
              activeUid={activeSeriesUid}
              onSelect={uid => { switchToSeries(uid) }}
            />
          )}

          {/* Metadata panel */}
          {metadataVisible && !seriesVisible && (
            <DicomMetadataPanel
              meta={dicomMeta}
              totalSlices={imageIds.length}
              currentSlice={currentSlice}
            />
          )}

          {/* File picker (shown when neither series nor metadata panel is open) */}
          {!seriesVisible && !metadataVisible && (
            <div className="w-48 flex flex-col gap-2">
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
                  // @ts-expect-error — webkitdirectory no está en los tipos
                  webkitdirectory=""
                  className="hidden"
                  onChange={e => e.target.files && loadFiles(e.target.files)} />
              </label>

              {imageIds.length > 0 && (
                <div className="mt-1 p-2 bg-slate-50 rounded-lg text-xs text-slate-500 space-y-1">
                  <p className="font-medium text-slate-700">
                    {imageIds.length} imagen{imageIds.length > 1 ? 'es' : ''}
                  </p>
                  {mprAvailable && !mprActive && (
                    <p className="text-teal-600 font-medium">Serie volumétrica — MPR disponible</p>
                  )}
                  {!mprActive && <p>Scroll para navegar</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
