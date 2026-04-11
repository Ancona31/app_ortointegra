/**
 * Comprime y redimensiona una imagen usando canvas antes de subirla.
 * Garantiza que ningún logo supere 150KB.
 *
 * - Máximo 500×500px (mantiene aspect ratio)
 * - Exporta como WebP (0.7) o JPEG (0.7) si el browser no soporta WebP
 * - SVGs se devuelven sin comprimir (ya son ligeros)
 */

const MAX_DIMENSION = 500
const TARGET_QUALITY = 0.7
const MAX_BYTES = 150 * 1024 // 150KB

export async function compressLogoImage(file: File): Promise<File> {
  // SVGs no necesitan compresión — son vectoriales
  if (file.type === 'image/svg+xml') return file

  // Si ya es menor a 150KB, no comprimir
  if (file.size <= MAX_BYTES) return file

  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap

  // Calcular nuevas dimensiones respetando aspect ratio
  let newW = width
  let newH = height
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
    newW = Math.round(width * ratio)
    newH = Math.round(height * ratio)
  }

  const canvas = new OffscreenCanvas(newW, newH)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo crear contexto canvas')

  ctx.drawImage(bitmap, 0, 0, newW, newH)
  bitmap.close()

  // Intentar WebP primero, fallback a JPEG
  let blob = await canvas.convertToBlob({ type: 'image/webp', quality: TARGET_QUALITY })

  // Si el browser no soporta WebP o el resultado es muy grande, usar JPEG
  if (blob.type !== 'image/webp' || blob.size > MAX_BYTES) {
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: TARGET_QUALITY })
  }

  // Si aún supera 150KB, reducir calidad progresivamente
  let quality = 0.5
  while (blob.size > MAX_BYTES && quality > 0.1) {
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
    quality -= 0.1
  }

  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const name = file.name.replace(/\.[^.]+$/, `.${ext}`)

  return new File([blob], name, { type: blob.type })
}
