'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'
import ModalShell from '@/components/ui/ModalShell'
import { Consultorio } from '@/types'
import { ZONAS_MEXICO, CHIPS_RAPIDOS } from '@/lib/consultorios/zonas-mexico'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (creado: Consultorio) => void
  /** K3 (punto 12): el huso de la clínica (`clinicas.timezone`), que sale ya elegido; `null` = como antes, sin elegir. */
  husoDeFabrica?: string | null
}

export default function AddConsultorioModal({ open, onClose, onSuccess, husoDeFabrica = null }: Props) {
  const toast = useToast()

  const [nombre, setNombre] = useState('')
  const [nombreCorto, setNombreCorto] = useState('')
  const [direccion, setDireccion] = useState('')
  const [telefono, setTelefono] = useState('')
  const [timezone, setTimezone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset al abrir (la instancia puede reusarse entre creaciones)
  useEffect(() => {
    if (open) {
      setNombre('')
      setNombreCorto('')
      setDireccion('')
      setTelefono('')
      setTimezone(husoDeFabrica && ZONAS_MEXICO.some(z => z.value === husoDeFabrica) ? husoDeFabrica : '')
      setSubmitting(false)
    }
  }, [open, husoDeFabrica])

  const requiereNombreCorto = nombre.trim().length > 12
  const canSubmit =
    nombre.trim().length > 0 &&
    direccion.trim().length > 0 &&
    timezone.length > 0 &&
    (!requiereNombreCorto || nombreCorto.trim().length > 0) &&
    !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)

    try {
      const body: Record<string, unknown> = {
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        timezone,
      }
      if (requiereNombreCorto) {
        body.nombre_corto = nombreCorto.trim()
      }
      if (telefono.trim().length > 0) {
        body.telefono = telefono.trim()
      }

      const res = await fetch('/api/consultorios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Error al crear el consultorio. Intenta de nuevo.')
        setSubmitting(false)
        return
      }

      const { consultorio } = await res.json() as { consultorio: Consultorio }
      toast.success('Consultorio creado.')
      onSuccess(consultorio)
      onClose()
    } catch {
      toast.error('Error de red. Verifica tu conexión.')
      setSubmitting(false)
    }
  }

  /* Rediseño B10: la misma capa que «Editar consultorio» (maqueta `perfil`):
     filas «rótulo — campo» en una tarjeta `--fondo`, y el pie con el
     secundario a la izquierda y el principal a la derecha (CALMA §23.1). */
  return (
    <ModalShell
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Agregar consultorio"
      maxWidth="max-w-[520px]"
      footer={
        <div className="flex items-center justify-end gap-2 px-6 py-3 max-sm:grid max-sm:grid-cols-2 ext:px-5">
          <button
            type="button"
            onClick={submitting ? undefined : onClose}
            disabled={submitting}
            className="k-b k-b-quieto min-w-[104px]"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`k-b ${canSubmit ? 'k-b-prim' : 'k-b-quieto'} min-w-[104px]`}
          >
            {submitting ? 'Guardando…' : 'Guardar consultorio'}
          </button>
        </div>
      }
    >
      <div className="px-6 pt-2 pb-5 ext:px-5">
        <div className="flex flex-col divide-y divide-linea rounded-[14px] bg-fondo px-4 py-1">
          <Fila etiqueta="Nombre del consultorio" obligatorio htmlFor="cons-alta-nombre">
            <input
              id="cons-alta-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Consultorio Centro"
              className={CAMPO}
            />
          </Fila>

          {requiereNombreCorto && (
            <Fila
              etiqueta="Nombre corto (máx. 12 caracteres)"
              obligatorio
              htmlFor="cons-alta-corto"
              ayuda="Se muestra en el sidebar y en agenda cuando el nombre completo es muy largo."
            >
              <input
                id="cons-alta-corto"
                type="text"
                value={nombreCorto}
                onChange={(e) => setNombreCorto(e.target.value)}
                maxLength={12}
                placeholder="Ej: Centro"
                className={CAMPO}
              />
            </Fila>
          )}

          <Fila etiqueta="Dirección" obligatorio htmlFor="cons-alta-direccion">
            <input
              id="cons-alta-direccion"
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Ej: Calle 60 #400, Mérida, Yucatán"
              className={CAMPO}
            />
          </Fila>

          <Fila etiqueta="Teléfono" opcional htmlFor="cons-alta-telefono">
            <input
              id="cons-alta-telefono"
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Ej: 999 123 4567"
              className={CAMPO}
            />
          </Fila>

          <Fila etiqueta="Zona horaria" obligatorio htmlFor="cons-alta-zona">
            <div className="flex flex-col gap-1 py-1.5">
              <div className="flex flex-wrap gap-2">
                {CHIPS_RAPIDOS.map((chip) => {
                  const seleccionado = timezone === chip.value
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      aria-pressed={seleccionado}
                      onClick={() => setTimezone(chip.value)}
                      className={`k-b h-9 rounded-full px-3 text-[13px] ${seleccionado ? 'bg-tonal text-tonal-tinta outline-2 -outline-offset-2 outline-accion' : 'k-b-quieto'}`}
                    >
                      {chip.label}
                    </button>
                  )
                })}
              </div>

              <select
                id="cons-alta-zona"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className={CAMPO}
              >
                <option value="">— Selecciona tu zona —</option>
                {ZONAS_MEXICO.map((z) => (
                  <option key={z.value} value={z.value}>
                    {z.label}
                  </option>
                ))}
              </select>
            </div>
          </Fila>
        </div>
      </div>
    </ModalShell>
  )
}

/** El control de una fila: sin caja, a 15 px, alto táctil de 44. */
const CAMPO = 'block w-full min-h-11 border-0 bg-transparent p-0 text-[15px] leading-5 text-tinta placeholder:text-tinta3 outline-none focus:outline-none [html.dark_&&]:!bg-transparent'

/** Rótulo y control: apilados en teléfono, en dos columnas desde 640. La fila entera marca el foco. */
function Fila({ etiqueta, obligatorio, opcional, ayuda, htmlFor, children }: {
  etiqueta: string
  obligatorio?: boolean
  opcional?: boolean
  ayuda?: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="-mx-2 grid min-w-0 grid-cols-1 gap-0.5 rounded-[10px] px-2 pt-2.5 pb-1 focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-enlace sm:grid-cols-[168px_minmax(0,1fr)] sm:items-start sm:gap-3 sm:py-1">
      <label htmlFor={htmlFor} className="text-[13px] leading-[18px] text-tinta2 sm:pt-[13px]">
        {etiqueta}
        {obligatorio && <span className="text-mal-tinta"> *</span>}
        {opcional && <span className="text-tinta2"> (opcional)</span>}
      </label>
      <div className="min-w-0">
        {children}
        {ayuda && <p className="pb-2 text-[13px] leading-[18px] text-tinta2">{ayuda}</p>}
      </div>
    </div>
  )
}
