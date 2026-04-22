import imageCompression from 'browser-image-compression'

export type TipoDocUpload = 'resultado_laboratorio' | 'estudio_imagen'

const MAX_IMG_BYTES = 5 * 1024 * 1024
const MAX_PDF_BYTES = 15 * 1024 * 1024
const MAX_DICOM_BYTES = 50 * 1024 * 1024
const COMPRESSION_BYPASS_BYTES = 500_000

const MSG_FORMATO = 'Formato no soportado. Convierte a PDF, JPG o PNG antes de subir.'

type ValidacionOk = { ok: true; mime: string }
type ValidacionFail = { ok: false; error: string }
export type Validacion = ValidacionOk | ValidacionFail

export function getExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.')
  return parts.length > 1 ? parts.pop()! : ''
}

/**
 * Algunos navegadores reportan DICOM como `application/octet-stream`.
 * Normalizamos por extensión para que el visor y el filtro por tipo
 * siempre vean `application/dicom`.
 */
export function inferirMime(file: File): string {
  const ext = getExtension(file.name)
  if (ext === 'dcm') return 'application/dicom'
  if (file.type === 'application/dicom') return 'application/dicom'
  return file.type || 'application/octet-stream'
}

export function validarArchivo(file: File): Validacion {
  const ext = getExtension(file.name)
  const mime = inferirMime(file)

  if (mime === 'image/jpeg' || mime === 'image/png' || ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
    if (file.size > MAX_IMG_BYTES) {
      return { ok: false, error: 'Imagen demasiado grande. Máx 5MB.' }
    }
    const normalized = ext === 'png' ? 'image/png' : 'image/jpeg'
    return { ok: true, mime: normalized }
  }

  if (mime === 'application/pdf' || ext === 'pdf') {
    if (file.size > MAX_PDF_BYTES) {
      return { ok: false, error: 'PDF demasiado grande. Máx 15MB.' }
    }
    return { ok: true, mime: 'application/pdf' }
  }

  if (mime === 'application/dicom' || ext === 'dcm') {
    if (file.size > MAX_DICOM_BYTES) {
      return { ok: false, error: 'DICOM demasiado grande. Máx 50MB.' }
    }
    return { ok: true, mime: 'application/dicom' }
  }

  return { ok: false, error: MSG_FORMATO }
}

export async function comprimirSiImagen(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.size < COMPRESSION_BYPASS_BYTES) return file
  try {
    const comprimido = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    })
    return comprimido
  } catch {
    return file
  }
}

export function construirPath(
  clinicaId: string,
  pacienteId: string,
  nombreOriginal: string,
  uuid: string,
): string {
  const ext = getExtension(nombreOriginal) || 'bin'
  return `clinicas/${clinicaId}/pacientes/${pacienteId}/${uuid}.${ext}`
}

export function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
