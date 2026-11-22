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
      /* ⚠️ EL FALLO AL DECODIFICAR SE NOMBRA AQUÍ, y no se deja caer al mensaje
         genérico del `catch`. `onerror` rechaza con un Event, no con un Error,
         así que el `err instanceof Error` de abajo daba false y el médico que
         elegía un HEIC del iPhone —lo que da la cámara por defecto, y `accept`
         lo permite— leía «Error al procesar la imagen» sin saber que el
         problema era el formato.
         NO se comprueba el tamaño de lo elegido: este canvas reduce a 400×200 y
         entrega un PNG de unos kilobytes, así que una foto enorme se acepta hoy
         y se seguirá aceptando. Lo que la ruta juzga es ESE PNG, no el archivo
         de aquí. */
      await new Promise<void>((res, rej) => {
        img.onload = () => res()
        img.onerror = () => rej(new Error(
          'No pudimos leer esa imagen. Usa un PNG o un JPG, o dibuja la firma aquí mismo.',
        ))
      })
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
      // El motivo lo sabe la ruta; el `catch` de abajo cubre el fallo de red,
      // que es el único caso en el que no llega ninguno.
      if (!r.ok) {
        const datos = await r.json().catch(() => ({}))
        throw new Error(datos.error ?? 'No se pudo eliminar la firma.')
      }
      setFirmaUrl(null)
      onFirmaCambiada(null)
      toast.success('Firma eliminada')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo eliminar la firma')
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

  /* Rediseño B10 (maqueta `perfil`): botones y textos del kit. La firma se
     pinta SIEMPRE sobre papel blanco (`style`, no `bg-white`, que la hoja de
     traducción del oscuro repinta): es tinta negra sobre transparente y en
     oscuro desaparecía. Lo comparten Mi perfil y el onboarding. */

  // ── Vista: firma ya guardada ────────────────────────────────────────────────
  if (firmaUrl && paso === 'captura') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-h-[80px] min-w-[180px] flex-1 items-center justify-center rounded-[12px] border border-linea p-4" style={{ background: 'white' }}>
            <img src={firmaUrl} alt="Firma guardada" className="max-h-[60px] max-w-full object-contain" />
          </div>
          <div className="flex shrink-0 flex-col items-start gap-1">
            <button
              type="button"
              onClick={() => { setFirmaUrl(null); setModoCaptura('subir') }}
              className="k-b k-b-tonal"
            >
              Cambiar firma
            </button>
            <button
              type="button"
              onClick={eliminarFirma}
              disabled={eliminando}
              className="k-b k-b-texto px-2 text-[14px] text-mal-tinta"
            >
              {eliminando ? <Loader2 size={16} aria-hidden="true" className="animate-spin" /> : <Trash2 size={16} aria-hidden="true" />}
              Eliminar
            </button>
          </div>
        </div>
        <p className="text-[13px] leading-[18px] text-tinta2">
          La firma aparece encima de la línea punteada en todos los documentos PDF.
        </p>
      </div>
    )
  }

  // ── Vista: preview del resultado procesado ─────────────────────────────────
  if (paso === 'preview' && urlPreview) {
    return (
      <div className="flex flex-col gap-3">
        <p className="k-t-rotulo">Vista previa</p>

        <div className="grid grid-cols-2 gap-3">
          {/* Fondo blanco — receta / documento */}
          <div className="flex flex-col gap-1">
            <p className="text-[12px] leading-4 text-tinta2">Sobre fondo blanco</p>
            <div className="flex min-h-[80px] items-center justify-center rounded-[12px] border border-linea p-4" style={{ background: 'white' }}>
              <img src={urlPreview} alt="Preview firma" className="max-h-[60px] max-w-full object-contain" />
            </div>
          </div>
          {/* Fondo de color — encabezado */}
          <div className="flex flex-col gap-1">
            <p className="text-[12px] leading-4 text-tinta2">Sobre fondo oscuro</p>
            <div className="flex min-h-[80px] items-center justify-center rounded-[12px] p-4"
              style={{ background: 'linear-gradient(135deg, #1a3a5c, #1e5fa8)' }}>
              <img src={urlPreview} alt="Preview firma" className="max-h-[60px] max-w-full object-contain"
                style={{ filter: 'invert(1)' }} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={resetear} className="k-b k-b-quieto">
            <RefreshCw size={16} aria-hidden="true" /> Subir otra
          </button>
          <button type="button" onClick={subirFirma} disabled={subiendo} className="k-b k-b-prim">
            {subiendo ? <><Loader2 size={16} aria-hidden="true" className="animate-spin" /> Guardando...</> : <><Check size={16} aria-hidden="true" /> Aceptar firma</>}
          </button>
        </div>
      </div>
    )
  }

  // ── Vista: captura (subir o dibujar) ───────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      {/* Selector de modo: el segmentado del kit (`.k-seg`). */}
      <div className="k-seg self-start" role="group" aria-label="Cómo capturar la firma">
        <button
          type="button"
          aria-pressed={modoCaptura === 'subir'}
          onClick={() => setModoCaptura('subir')}
          className="k-seg-op gap-1.5"
        >
          <Upload size={15} aria-hidden="true" /> Subir imagen
        </button>
        <button
          type="button"
          aria-pressed={modoCaptura === 'dibujar'}
          onClick={() => setModoCaptura('dibujar')}
          className="k-seg-op gap-1.5"
        >
          <PenLine size={15} aria-hidden="true" /> Dibujar firma
        </button>
      </div>

      {/* Subir imagen */}
      {modoCaptura === 'subir' && (
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={procesando}
            className="k-pulsable flex w-full flex-col items-center gap-1.5 rounded-[14px] border border-dashed border-tinta3 px-4 py-6 text-center disabled:opacity-50"
          >
            {procesando
              ? <Loader2 size={22} aria-hidden="true" className="animate-spin text-enlace" />
              : <Upload size={22} aria-hidden="true" className="text-tinta2" />
            }
            <span className="text-[15px] font-semibold leading-5 text-tinta">
              {procesando ? 'Procesando imagen...' : 'Toca para seleccionar foto de tu firma'}
            </span>
            <span className="text-[12px] leading-4 text-tinta2">JPG, PNG, WEBP · Máx. 10 MB · Se procesará automáticamente</span>
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
        <div className="flex flex-col gap-2">
          <div className="relative overflow-hidden rounded-[14px] border border-borde"
            style={{ touchAction: 'none', background: 'white' }}>
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
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="select-none text-[14px]" style={{ color: '#5B6478' }}>Firma aquí con el dedo o mouse</p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={limpiarCanvas} disabled={!tieneTrazo} className="k-b k-b-texto px-2 text-[14px] text-tinta2">
              <Eraser size={16} aria-hidden="true" /> Limpiar
            </button>
            <button
              type="button"
              onClick={procesarDibujo}
              disabled={!tieneTrazo || procesando}
              className="k-b k-b-prim"
            >
              {procesando ? <><Loader2 size={16} aria-hidden="true" className="animate-spin" /> Procesando...</> : 'Guardar firma →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
