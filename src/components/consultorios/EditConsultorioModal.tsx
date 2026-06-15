'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/components/ui/Toast'
import ModalShell from '@/components/ui/ModalShell'
import { Consultorio } from '@/types'
import { ZONAS_MEXICO, CHIPS_RAPIDOS } from '@/lib/consultorios/zonas-mexico'

interface Props {
  open: boolean
  onClose: () => void
  consultorio: Consultorio
  onSuccess: (consultorioActualizado: Consultorio) => void
}

export default function EditConsultorioModal({ open, onClose, consultorio, onSuccess }: Props) {
  const toast = useToast()

  const [nombre, setNombre] = useState(consultorio.nombre)
  const [nombreCorto, setNombreCorto] = useState(consultorio.nombre_corto)
  const [direccion, setDireccion] = useState(consultorio.direccion)
  const [telefono, setTelefono] = useState(consultorio.telefono ?? '')
  const [timezone, setTimezone] = useState(consultorio.timezone)
  const [submitting, setSubmitting] = useState(false)

  // Re-sincronizar estado cuando cambia el consultorio o se reabre el modal.
  useEffect(() => {
    if (open) {
      setNombre(consultorio.nombre)
      setNombreCorto(consultorio.nombre_corto)
      setDireccion(consultorio.direccion)
      setTelefono(consultorio.telefono ?? '')
      setTimezone(consultorio.timezone)
      setSubmitting(false)
    }
  }, [open, consultorio])

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
      // Detectar cambios. Solo enviar campos que efectivamente cambiaron.
      const body: Record<string, unknown> = {}

      const nombreTrim = nombre.trim()
      const nombreCortoTrim = nombreCorto.trim()
      const direccionTrim = direccion.trim()
      const telefonoTrim = telefono.trim()

      if (nombreTrim !== consultorio.nombre) {
        body.nombre = nombreTrim
      }
      if (direccionTrim !== consultorio.direccion) {
        body.direccion = direccionTrim
      }
      if (timezone !== consultorio.timezone) {
        body.timezone = timezone
      }

      // Teléfono: si el médico lo borró, enviar null para limpiar.
      const telefonoOriginal = consultorio.telefono ?? ''
      if (telefonoTrim !== telefonoOriginal) {
        body.telefono = telefonoTrim.length > 0 ? telefonoTrim : null
      }

      // Lógica de nombre_corto:
      // - Si nombre cambió y ahora es ≤12: enviar nombre_corto: null para que server recalcule.
      // - Si nombre cambió y ahora es >12: enviar el nombre_corto que escribió el médico.
      // - Si nombre no cambió pero nombre_corto cambió: enviar el nuevo (o null si queda vacío y nombre ≤12).
      // - Si nada cambió: no enviar nombre_corto.
      const nombreCambio = nombreTrim !== consultorio.nombre
      const nombreCortoCambio = nombreCortoTrim !== consultorio.nombre_corto

      if (nombreCambio && nombreTrim.length <= 12) {
        body.nombre_corto = null
      } else if (nombreCambio && nombreTrim.length > 12) {
        body.nombre_corto = nombreCortoTrim
      } else if (!nombreCambio && nombreCortoCambio) {
        if (nombreCortoTrim.length === 0 && nombreTrim.length <= 12) {
          body.nombre_corto = null
        } else {
          body.nombre_corto = nombreCortoTrim
        }
      }

      if (Object.keys(body).length === 0) {
        toast.info('No hay cambios para guardar.')
        setSubmitting(false)
        return
      }

      const res = await fetch(`/api/consultorios/${consultorio.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Error al actualizar el consultorio.')
        setSubmitting(false)
        return
      }

      const { consultorio: actualizado } = await res.json() as { consultorio: Consultorio }
      toast.success('Consultorio actualizado.')
      onSuccess(actualizado)
      onClose()
    } catch {
      toast.error('Error de red. Verifica tu conexión.')
      setSubmitting(false)
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Editar consultorio"
      subtitle={consultorio.nombre}
      maxWidth="max-w-lg"
      footer={
        <div className="flex gap-2 px-5 py-3.5">
          <button
            type="button"
            onClick={submitting ? undefined : onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[var(--cp)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      }
    >
      <div className="px-5 py-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Nombre del consultorio <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Consultorio Centro"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[var(--cp)] transition-colors"
          />
        </div>

        {requiereNombreCorto && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nombre corto (máx. 12 caracteres) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nombreCorto}
              onChange={(e) => setNombreCorto(e.target.value)}
              maxLength={12}
              placeholder="Ej: Centro"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[var(--cp)] transition-colors"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Se muestra en el sidebar y en agenda cuando el nombre completo es muy largo.
            </p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Dirección <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Ej: Calle 60 #400, Mérida, Yucatán"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[var(--cp)] transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Teléfono <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
          <input
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="Ej: 999 123 4567"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[var(--cp)] transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Zona horaria <span className="text-red-500">*</span>
          </label>

          <div className="flex flex-wrap gap-2 mb-2">
            {CHIPS_RAPIDOS.map((chip) => {
              const seleccionado = timezone === chip.value
              return (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setTimezone(chip.value)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    seleccionado
                      ? 'bg-[var(--cp)] text-white border-[var(--cp)]'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>

          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[var(--cp)] transition-colors bg-white"
          >
            <option value="">— Selecciona tu zona —</option>
            {ZONAS_MEXICO.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </ModalShell>
  )
}
