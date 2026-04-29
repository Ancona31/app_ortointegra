/**
 * Comprime y redimensiona una imagen usando canvas antes de subirla.
 * Garantiza, en lo posible, que ningún logo supere 150KB.
 *
 * Salida siempre PNG (cuando se entra a la rama de compresión) para
 * preservar transparencia y porque @react-pdf/renderer no soporta WebP.
 *
 * Estrategia:
 *  - SVGs se devuelven sin tocar (vectoriales, ya son ligeros).
 *  - Si el archivo ya pesa ≤150KB, se devuelve sin tocar.
 *  - Si pesa más, se renderiza a PNG en canvas. Si el PNG sigue >150KB,
 *    se reduce el lado mayor un 10% por iteración (manteniendo aspect
 *    ratio) hasta caber o hasta tocar el piso de 400px en el lado
 *    mayor. Si al piso sigue pesando más, se sube de todos modos.
 */

const MAX_BYTES = 150 * 1024 // 150KB
const MIN_DIMENSION = 400    // piso del lado mayor en px
const REDUCTION_STEP = 0.9   // 10% menos por iteración

export async function compressLogoImage(file: File): Promise<File> {
  // SVGs no necesitan compresión — son vectoriales
  if (file.type === 'image/svg+xml') return file

  // Si ya es menor a 150KB, no comprimir
  if (file.size <= MAX_BYTES) return file

  const bitmap = await createImageBitmap(file)
  const origW = bitmap.width
  const origH = bitmap.height

  let scale = 1
  let blob: Blob | null = null

  try {
    while (true) {
      const w = Math.max(1, Math.round(origW * scale))
      const h = Math.max(1, Math.round(origH * scale))

      const canvas = new OffscreenCanvas(w, h)
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('No se pudo crear contexto canvas')

      ctx.drawImage(bitmap, 0, 0, w, h)

      blob = await canvas.convertToBlob({ type: 'image/png' })
      if (blob.size <= MAX_BYTES) break

      const major = Math.max(w, h)
      // Si ya tocamos el piso, salimos aunque siga >150KB (no rechazar)
      if (major <= MIN_DIMENSION) break

      // Calcular el nuevo lado mayor objetivo respetando el piso
      const newMajor = Math.max(MIN_DIMENSION, Math.round(major * REDUCTION_STEP))
      scale = scale * (newMajor / major)
    }
  } finally {
    bitmap.close()
  }

  if (!blob) throw new Error('No se pudo generar el PNG comprimido')

  const name = file.name.replace(/\.[^.]+$/, '.png')
  return new File([blob], name, { type: 'image/png' })
}
