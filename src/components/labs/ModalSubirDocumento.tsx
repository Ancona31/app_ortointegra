'use client'

import { useState, useRef, useMemo } from 'react'
import { UploadCloud, X, FileText, Image as ImageIcon, FileArchive, Loader2, CheckCircle } from 'lucide-react'
import ModalShell from '@/components/ui/ModalShell'
import { createClient } from '@/lib/supabase/client'
import {
  validarArchivo,
  comprimirSiImagen,
  construirPath,
  inferirMime,
  formatearBytes,
  type TipoDocUpload,
} from '@/lib/labs/upload-utils'

const BUCKET = 'labs-documentos'
const MAX_DESCRIPCION = 200

type ArchivoPendiente = {
  id: string
  file: File
  mimeNormalizado: string
  tipo: TipoDocUpload
  descripcion: string
  fecha: string
  errorCarga: string | null
}

type Resultado = {
  nombre: string
  ok: boolean
  error?: string
}

interface Props {
  open: boolean
  onClose: () => void
  pacienteId: string
  clinicaId: string
  userId: string
  onSuccess: () => void
  /**
   * Archivos que ya venían soltados sobre la galería, para que el modal abra
   * con ellos dentro en vez de pedirlos otra vez.
   *
   * ⚠️ SE SIEMBRAN UNA SOLA VEZ, AL MONTAR. El modal se monta cuando se abre y
   * se desmonta al cerrarse (`{modalSubir && …}` en la sección), así que no hace
   * falta sincronizar nada: si se reabre con otra tanda, es otro montaje. Meterlo
   * en un efecto con dependencias volvería a añadirlos en cada render.
   */
  archivosIniciales?: File[]
}

function iconoPorMime(mime: string) {
  /* Iconos de formato en `--tinta2` (CALMA §3): el color de tipo se reserva a
     los archivos ya guardados, cuyo tipo se conoce. */
  if (mime === 'application/pdf') return <FileText size={20} aria-hidden="true" className="text-tinta2" />
  if (mime.startsWith('image/')) return <ImageIcon size={20} aria-hidden="true" className="text-tinta2" />
  if (mime === 'application/dicom') return <FileArchive size={20} aria-hidden="true" className="text-tinta2" />
  return <FileText size={20} aria-hidden="true" className="text-tinta2" />
}

function mapearErrorSupabase(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const lower = msg.toLowerCase()
  if (lower.includes('100 documentos clínicos') || lower.includes('100 documentos clinicos')) {
    return 'Este paciente ya tiene 100 documentos. Elimina alguno para subir más.'
  }
  if (lower.includes('check_violation')) {
    return 'Este paciente ya tiene 100 documentos. Elimina alguno para subir más.'
  }
  if (lower.includes('row-level security') || lower.includes('permission denied') || lower.includes('42501')) {
    return 'No tienes permiso para subir a esta clínica.'
  }
  if (lower.includes('payload too large') || lower.includes('413')) {
    return 'Archivo demasiado grande. Máx 50MB.'
  }
  if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('offline')) {
    return 'Error de conexión. Intenta de nuevo.'
  }
  return msg || 'Error al subir. Intenta de nuevo.'
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function hoyISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ModalSubirDocumento({
  open,
  onClose,
  pacienteId,
  clinicaId,
  userId,
  onSuccess,
  archivosIniciales,
}: Props) {
  const [archivos, setArchivos] = useState<ArchivoPendiente[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [progresoIdx, setProgresoIdx] = useState(0)
  const [resultados, setResultados] = useState<Resultado[] | null>(null)
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null)
  const [sembrado, setSembrado] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  if (!sembrado) {
    setSembrado(true)
    if (archivosIniciales && archivosIniciales.length > 0) agregarArchivos(archivosIniciales)
  }

  const puedeSubir = useMemo(
    () => archivos.length > 0 && !subiendo && !resultados,
    [archivos, subiendo, resultados],
  )

  function agregarArchivos(list: FileList | File[]) {
    const nuevos: ArchivoPendiente[] = []
    Array.from(list).forEach(file => {
      const v = validarArchivo(file)
      if (!v.ok) {
        nuevos.push({
          id: uuid(),
          file,
          mimeNormalizado: inferirMime(file),
          tipo: 'resultado_laboratorio',
          descripcion: '',
          fecha: hoyISO(),
          errorCarga: v.error,
        })
        return
      }
      nuevos.push({
        id: uuid(),
        file,
        mimeNormalizado: v.mime,
        tipo: 'resultado_laboratorio',
        descripcion: '',
        fecha: hoyISO(),
        errorCarga: null,
      })
    })
    setArchivos(prev => [...prev, ...nuevos])
    setErrorGlobal(null)
  }

  function quitarArchivo(id: string) {
    setArchivos(prev => prev.filter(a => a.id !== id))
  }

  function actualizarTipo(id: string, tipo: TipoDocUpload) {
    setArchivos(prev => prev.map(a => (a.id === id ? { ...a, tipo } : a)))
  }

  function actualizarDescripcion(id: string, descripcion: string) {
    setArchivos(prev =>
      prev.map(a => (a.id === id ? { ...a, descripcion: descripcion.slice(0, MAX_DESCRIPCION) } : a)),
    )
  }

  function actualizarFecha(id: string, fecha: string) {
    setArchivos(prev => prev.map(a => (a.id === id ? { ...a, fecha } : a)))
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      agregarArchivos(e.dataTransfer.files)
    }
  }

  function cerrarModal() {
    if (subiendo) return
    setArchivos([])
    setResultados(null)
    setErrorGlobal(null)
    setProgresoIdx(0)
    onClose()
  }

  async function subir() {
    if (!puedeSubir) return
    const validos = archivos.filter(a => !a.errorCarga)
    if (validos.length === 0) {
      setErrorGlobal('No hay archivos válidos para subir.')
      return
    }

    setSubiendo(true)
    setErrorGlobal(null)
    const supabase = createClient()
    const res: Resultado[] = []

    for (let i = 0; i < validos.length; i++) {
      const item = validos[i]
      setProgresoIdx(i)
      try {
        const procesado = await comprimirSiImagen(item.file)
        const id = uuid()
        const storagePath = construirPath(clinicaId, pacienteId, item.file.name, id)

        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, procesado, {
            contentType: item.mimeNormalizado,
            upsert: false,
          })
        if (upErr) throw upErr

        const contenido: Record<string, unknown> = {}
        if (item.descripcion.trim()) contenido.descripcion = item.descripcion.trim()
        if (item.fecha) contenido.fecha_estudio = item.fecha

        const { error: insertErr } = await supabase.from('documentos').insert({
          paciente_id: pacienteId,
          tipo: item.tipo,
          contenido,
          storage_bucket: BUCKET,
          storage_path: storagePath,
          mime_type: item.mimeNormalizado,
          'tamaño_bytes': procesado.size,
          nombre_original: item.file.name,
          subido_por: userId,
        })

        if (insertErr) {
          await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {})
          throw insertErr
        }

        res.push({ nombre: item.file.name, ok: true })
      } catch (err) {
        res.push({ nombre: item.file.name, ok: false, error: mapearErrorSupabase(err) })
      }
    }

    setSubiendo(false)
    setResultados(res)

    if (res.every(r => r.ok)) {
      onSuccess()
      // Auto-cerrar si todos OK tras un breve delay visual
      setTimeout(() => {
        setArchivos([])
        setResultados(null)
        setProgresoIdx(0)
        onClose()
      }, 900)
    } else if (res.some(r => r.ok)) {
      onSuccess()
    }
  }

  const totalVisible = archivos.length
  const exitosos = resultados ? resultados.filter(r => r.ok).length : 0
  const fallidos = resultados ? resultados.filter(r => !r.ok) : []

  const footer = (
    <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-3 iv:justify-center">
      <button
        type="button"
        onClick={cerrarModal}
        disabled={subiendo}
        className="k-b k-b-capa k-b-quieto min-w-[104px]"
      >
        {resultados ? 'Cerrar' : 'Cancelar'}
      </button>
      {!resultados && (
        <button
          type="button"
          onClick={subir}
          disabled={!puedeSubir}
          className="k-b k-b-capa k-b-prim min-w-[104px]"
        >
          {subiendo ? (
            <>
              <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Subiendo {progresoIdx + 1} de {archivos.filter(a => !a.errorCarga).length}…
            </>
          ) : (
            <>
              <UploadCloud size={16} aria-hidden="true" />
              Subir {totalVisible} {totalVisible === 1 ? 'archivo' : 'archivos'}
            </>
          )}
        </button>
      )}
    </div>
  )

  return (
    <ModalShell
      open={open}
      cierraConVelo={false}
      onClose={cerrarModal}
      title="Subir documento clínico"
      subtitle="PDF, JPG, PNG o DICOM"
      icon={<UploadCloud size={16} />}
      iconBg="bg-tonal text-tonal-tinta"
      maxWidth="max-w-xl"
      footer={footer}
    >
      <div className="px-5 py-4 space-y-4">
        {!resultados && (
          <label
            onDragEnter={e => { e.preventDefault(); setDragActive(true) }}
            onDragOver={e => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={e => { e.preventDefault(); setDragActive(false) }}
            onDrop={onDrop}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed px-4 py-6 text-center transition-colors ${
              dragActive ? 'border-accion bg-tonal' : 'border-borde hover:bg-sup2'
            }`}
          >
            <UploadCloud size={24} aria-hidden="true" className="text-tinta2" />
            <p className="text-[15px] font-semibold leading-5 text-tinta">
              Arrastra archivos aquí o click para seleccionar
            </p>
            <p className="k-campo-ayuda">
              PDF, JPG, PNG, DCM · máx 50MB por archivo
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.dcm,application/pdf,image/jpeg,image/png,application/dicom"
              className="hidden"
              onChange={e => {
                if (e.target.files && e.target.files.length > 0) {
                  agregarArchivos(e.target.files)
                  e.target.value = ''
                }
              }}
            />
          </label>
        )}

        {errorGlobal && !resultados && (
          <p role="alert" className="k-campo-error">{errorGlobal}</p>
        )}

        {archivos.length > 0 && !resultados && (
          <ul className="k-lista">
            {archivos.map((a) => (
              <li
                key={a.id}
                className="py-3"
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 shrink-0">{iconoPorMime(a.mimeNormalizado)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-5 text-tinta [overflow-wrap:anywhere]" title={a.file.name}>
                      {a.file.name}
                    </p>
                    <p className="k-num text-[13px] leading-[18px] text-tinta2">
                      {formatearBytes(a.file.size)}
                    </p>
                    {a.errorCarga && (
                      <p className="k-campo-error mt-1">{a.errorCarga}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => quitarArchivo(a.id)}
                    disabled={subiendo}
                    className="k-b k-b-icono -mr-2 -mt-2 shrink-0"
                    aria-label="Quitar archivo"
                  >
                    <X aria-hidden="true" />
                  </button>
                </div>

                {!a.errorCarga && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="k-campo-g">
                      <span className="k-etiqueta">
                        Tipo
                      </span>
                      <select
                        value={a.tipo}
                        onChange={e => actualizarTipo(a.id, e.target.value as TipoDocUpload)}
                        disabled={subiendo}
                        className="k-campo"
                      >
                        <option value="resultado_laboratorio">Resultado de laboratorio</option>
                        <option value="estudio_imagen">Estudio de imagen</option>
                      </select>
                    </label>
                    <label className="k-campo-g">
                      <span className="k-etiqueta">
                        Fecha del estudio
                      </span>
                      <input
                        type="date"
                        value={a.fecha}
                        onChange={e => actualizarFecha(a.id, e.target.value)}
                        disabled={subiendo}
                        className="k-campo"
                      />
                    </label>
                    <label className="k-campo-g sm:col-span-2">
                      <span className="k-etiqueta">
                        Descripción (opcional)
                      </span>
                      <input
                        type="text"
                        value={a.descripcion}
                        onChange={e => actualizarDescripcion(a.id, e.target.value)}
                        disabled={subiendo}
                        maxLength={MAX_DESCRIPCION}
                        placeholder="Ej. Biometría hemática de control"
                        className="k-campo"
                      />
                    </label>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {resultados && (
          <div className="space-y-3">
            <div role="status" className="flex items-center gap-2 text-[15px] font-semibold text-tinta">
              <CheckCircle size={20} aria-hidden="true" className="text-ok-tinta" />
              {exitosos} de {resultados.length} archivos subidos
            </div>
            {fallidos.length > 0 && (
              <div role="alert" className="rounded-[12px] bg-mal-fondo p-3">
                <p className="mb-1 text-[14px] font-semibold text-mal-tinta">
                  {fallidos.length} {fallidos.length === 1 ? 'archivo falló' : 'archivos fallaron'}
                </p>
                <ul className="space-y-1">
                  {fallidos.map((f, i) => (
                    <li key={i} className="text-[13px] leading-[18px] text-mal-tinta">
                      <span className="font-medium">{f.nombre}</span>
                      {f.error && <span> — {f.error}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  )
}
