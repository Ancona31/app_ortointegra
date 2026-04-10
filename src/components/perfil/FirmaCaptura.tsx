'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, PenLine, Trash2, Check, Loader2, RefreshCw, Eraser } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

type Paso = 'captura' | 'preview'
type ModoCaptura = 'subir' | 'dibujar'

interface Props {
  firmaActual: string | null
  onFirmaCambiada: (url: string | null) => void
}

/** Procesa una imagen (canvas o img): grayscale → threshold → fondo transparente → auto-crop → resize 400×200 */
async function procesarImagen(source: HTMLCanvasElement | HTMLImageElement): Promise<Blob> {
  const w = source instanceof HTMLCanvasElement ? source.width : source.naturalWidth
  const h = source instanceof HTMLCanvasElement ? source.height : source.naturalHeight
  if (w === 0 || h === 0) throw new Error('Imagen vacía')

  const offscreen = document.createElement('canvas')
  offscreen.width = w
  offscreen.height = h
  const ctx = offscreen.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')
  ctx.drawImage(source, 0, 0)

  const imageData = ctx.getImageData(0, 0, w, h)
  const d = imageData.data

  // Grayscale + threshold (L < 150 → trazo negro opaco; resto → transparente)
  for (let i = 0; i < d.length; i += 4) {
    const L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    if (L < 150) {
      d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 255
    } else {
      d[i + 3] = 0
    }
  }
  ctx.putImageData(imageData, 0, 0)

  // Auto-crop: bounding box de píxeles opacos
  let minX = w, maxX = 0, minY = h, maxY = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (minX > maxX) throw new Error('No se detectó ningún trazo. Usa mejor iluminación o contraste.')

  const pad = 12
  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(w, maxX + pad)
  maxY = Math.min(h, maxY + pad)

  const cropW = maxX - minX
  const cropH = maxY - minY

  // Escalar a máximo 400×200 manteniendo aspect ratio
  const scale = Math.min(400 / cropW, 200 / cropH, 1)
  const finalW = Math.round(cropW * scale)
  const finalH = Math.round(cropH * scale)

  const final = document.createElement('canvas')
  final.width = finalW
  final.height = finalH
  const fctx = final.getContext('2d')
  if (!fctx) throw new Error('Canvas final no disponible')
  fctx.drawImage(offscreen, minX, minY, cropW, cropH, 0, 0, finalW, finalH)

  return new Promise<Blob>((resolve, reject) => {
    final.toBlob(blob => blob ? resolve(blob) : reject(new Error('Error al generar PNG')), 'image/png')
  })
}

export default function FirmaCaptura({ firmaActual, onFirmaCambiada }: Props) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [paso, setPaso] = useState<Paso>('captura')
  const [modoCaptura, setModoCaptura] = useState<ModoCaptura>('subir')
  const [blobProcesado, setBlobProcesado] = useState<Blob | null>(null)
  const [urlPreview, setUrlPreview] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [estasDibujando, setEstasDibujando] = useState(false)
  const [tieneTrazo, setTieneTrazo] = useState(false)
  const [firmaUrl, setFirmaUrl] = useState<string | null>(firmaActual)

  const lastPt = useRef<{ x: number; y: number } | null>(null)

  // Sincronizar con prop externa
  useEffect(() => { setFirmaUrl(firmaActual) }, [firmaActual])

  // Inicializar canvas al cambiar a modo dibujar
  useEffect(() => {
    if (modoCaptura !== 'dibujar' || paso !== 'captura') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    setTieneTrazo(false)
  }, [modoCaptura, paso])

  function getPos(clientX: number, clientY: number): { x: number; y: number } {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function iniciarTrazo(x: number, y: number) {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    setEstasDibujando(true)
    lastPt.current = { x, y }
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function continuarTrazo(x: number, y: number) {
    if (!estasDibujando || !lastPt.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const midX = (lastPt.current.x + x) / 2
    const midY = (lastPt.current.y + y) / 2
    ctx.quadraticCurveTo(lastPt.current.x, lastPt.current.y, midX, midY)
    ctx.stroke()
    lastPt.current = { x, y }
    setTieneTrazo(true)
  }

  function terminarTrazo() {
    setEstasDibujando(false)
    lastPt.current = null
  }

  function limpiarCanvas() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setTieneTrazo(false)
  }

  async function onArchivoSeleccionado(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setProcesando(true)
    try {
      const img = new window.Image()
      const objectUrl = URL.createObjectURL(file)
      img.src = objectUrl
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej })
      const blob = await procesarImagen(img)
      URL.revokeObjectURL(objectUrl)
      mostrarPreview(blob)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al procesar la imagen')
    } finally {
      setProcesando(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function procesarDibujo() {
    if (!canvasRef.current || !tieneTrazo) return
    setProcesando(true)
    try {
      const blob = await procesarImagen(canvasRef.current)
      mostrarPreview(blob)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al procesar la firma')
    } finally {
      setProcesando(false)
    }
  }

  function mostrarPreview(blob: Blob) {
    if (urlPreview) URL.revokeObjectURL(urlPreview)
    const url = URL.createObjectURL(blob)
    setBlobProcesado(blob)
    setUrlPreview(url)
    setPaso('preview')
  }

  async function subirFirma() {
    if (!blobProcesado) return
    setSubiendo(true)
    try {
      const fd = new FormData()
      fd.append('firma', blobProcesado, 'firma.png')
      const r = await fetch('/api/me/firma', { method: 'POST', body: fd })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Error al guardar la firma')
      setFirmaUrl(data.url)
      onFirmaCambiada(data.url)
      toast.success('Firma guardada correctamente')
      resetear()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSubiendo(false)
    }
  }

  async function eliminarFirma() {
    setEliminando(true)
    try {
      const r = await fetch('/api/me/firma', { method: 'DELETE' })
      if (!r.ok) throw new Error('Error al eliminar')
      setFirmaUrl(null)
      onFirmaCambiada(null)
      toast.success('Firma eliminada')
    } catch {
      toast.error('No se pudo eliminar la firma')
    } finally {
      setEliminando(false)
    }
  }

  function resetear() {
    setPaso('captura')
    setBlobProcesado(null)
    if (urlPreview) { URL.revokeObjectURL(urlPreview); setUrlPreview(null) }
    if (fileInputRef.current) fileInputRef.current.value = ''
    setTieneTrazo(false)
  }

  // ── Vista: firma ya guardada ────────────────────────────────────────────────
  if (firmaUrl && paso === 'captura') {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-4">
          <div className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-center min-h-[80px]">
            <img src={firmaUrl} alt="Firma guardada" className="max-h-[60px] max-w-full object-contain" />
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => { setFirmaUrl(null); setModoCaptura('subir') }}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cambiar firma
            </button>
            <button
              type="button"
              onClick={eliminarFirma}
              disabled={eliminando}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {eliminando ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              Eliminar
            </button>
          </div>
        </div>
        <p className="text-[10px] text-[#86868b]">
          La firma aparece encima de la línea punteada en todos los documentos PDF.
        </p>
      </div>
    )
  }

  // ── Vista: preview del resultado procesado ─────────────────────────────────
  if (paso === 'preview' && urlPreview) {
    return (
      <div className="space-y-4">
        <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">Vista previa</p>

        <div className="grid grid-cols-2 gap-3">
          {/* Fondo blanco — receta / documento */}
          <div className="space-y-1">
            <p className="text-[10px] text-[#86868b]">Sobre fondo blanco</p>
            <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-center min-h-[80px]">
              <img src={urlPreview} alt="Preview firma" className="max-h-[60px] max-w-full object-contain" />
            </div>
          </div>
          {/* Fondo de color — encabezado */}
          <div className="space-y-1">
            <p className="text-[10px] text-[#86868b]">Sobre fondo oscuro</p>
            <div className="rounded-xl border border-slate-200 p-4 flex items-center justify-center min-h-[80px]"
              style={{ background: 'linear-gradient(135deg, #1a3a5c, #1e5fa8)' }}>
              <img src={urlPreview} alt="Preview firma" className="max-h-[60px] max-w-full object-contain"
                style={{ filter: 'invert(1)' }} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={resetear}
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors">
            <RefreshCw size={13} /> Subir otra
          </button>
          <button type="button" onClick={subirFirma} disabled={subiendo}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#1e5fa8] text-white rounded-xl hover:bg-[#1a3a5c] transition-colors disabled:opacity-60">
            {subiendo ? <><Loader2 size={13} className="animate-spin" /> Guardando...</> : <><Check size={13} /> Aceptar firma</>}
          </button>
        </div>
      </div>
    )
  }

  // ── Vista: captura (subir o dibujar) ───────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Selector de modo */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setModoCaptura('subir')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
            modoCaptura === 'subir'
              ? 'border-[#1e5fa8] bg-[#1e5fa8]/5 text-[#1e5fa8]'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Upload size={12} /> Subir imagen
        </button>
        <button
          type="button"
          onClick={() => setModoCaptura('dibujar')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
            modoCaptura === 'dibujar'
              ? 'border-[#1e5fa8] bg-[#1e5fa8]/5 text-[#1e5fa8]'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          }`}
        >
          <PenLine size={12} /> Dibujar firma
        </button>
      </div>

      {/* Subir imagen */}
      {modoCaptura === 'subir' && (
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={procesando}
            className="w-full flex flex-col items-center gap-3 py-8 border-2 border-dashed border-slate-200 rounded-xl hover:border-[#1e5fa8]/40 hover:bg-slate-50/50 transition-all disabled:opacity-50"
          >
            {procesando
              ? <Loader2 size={24} className="text-[#1e5fa8] animate-spin" />
              : <Upload size={24} className="text-slate-300" />
            }
            <span className="text-sm text-slate-400">
              {procesando ? 'Procesando imagen...' : 'Toca para seleccionar foto de tu firma'}
            </span>
            <span className="text-[10px] text-slate-300">JPG, PNG, WEBP · Máx. 10 MB · Se procesará automáticamente</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onArchivoSeleccionado}
            className="hidden"
          />
        </div>
      )}

      {/* Canvas para dibujar */}
      {modoCaptura === 'dibujar' && (
        <div className="space-y-2">
          <div className="relative rounded-xl border-2 border-slate-200 overflow-hidden bg-white"
            style={{ touchAction: 'none' }}>
            <canvas
              ref={canvasRef}
              width={600}
              height={220}
              className="w-full cursor-crosshair"
              style={{ display: 'block' }}
              onMouseDown={e => iniciarTrazo(...Object.values(getPos(e.clientX, e.clientY)) as [number, number])}
              onMouseMove={e => continuarTrazo(...Object.values(getPos(e.clientX, e.clientY)) as [number, number])}
              onMouseUp={terminarTrazo}
              onMouseLeave={terminarTrazo}
              onTouchStart={e => { e.preventDefault(); const t = e.touches[0]; iniciarTrazo(...Object.values(getPos(t.clientX, t.clientY)) as [number, number]) }}
              onTouchMove={e => { e.preventDefault(); const t = e.touches[0]; continuarTrazo(...Object.values(getPos(t.clientX, t.clientY)) as [number, number]) }}
              onTouchEnd={terminarTrazo}
            />
            {!tieneTrazo && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-slate-300 text-sm select-none">Firma aquí con el dedo o mouse</p>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center">
            <button type="button" onClick={limpiarCanvas} disabled={!tieneTrazo}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors">
              <Eraser size={12} /> Limpiar
            </button>
            <button
              type="button"
              onClick={procesarDibujo}
              disabled={!tieneTrazo || procesando}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#1e5fa8] text-white rounded-xl hover:bg-[#1a3a5c] transition-colors disabled:opacity-50"
            >
              {procesando ? <><Loader2 size={13} className="animate-spin" /> Procesando...</> : 'Guardar firma →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
