'use client'

import { useState } from 'react'
import { useConsultorios } from '@/hooks/useConsultorios'
import { useProfile } from '@/hooks/useProfile'
import { useSubscriptionGate } from '@/components/billing/SubscriptionGateProvider'
import { useToast } from '@/components/ui/Toast'
import ModalShell from '@/components/ui/ModalShell'
import { Consultorio } from '@/types'
import { ZONAS_MEXICO, CHIPS_RAPIDOS } from '@/lib/consultorios/zonas-mexico'

export default function PrimerConsultorioModal() {
  const { isDoctor } = useProfile()
  const { consultorios, lecturaConfirmada, mutate } = useConsultorios()
  const { state } = useSubscriptionGate()
  const toast = useToast()

  const [nombre, setNombre] = useState('')
  const [nombreCorto, setNombreCorto] = useState('')
  const [direccion, setDireccion] = useState('')
  const [telefono, setTelefono] = useState('')
  const [timezone, setTimezone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  /* ⚠ ESTE MODAL ESCRIBE (POST /api/consultorios) Y ES BLOQUEANTE: no se cierra
     con Escape ni tiene botón de cerrar. No puede dispararse por AUSENCIA DE
     EVIDENCIA — solo ante una lectura afirmativa de cero consultorios.
     `lecturaConfirmada` sustituye al viejo `isLoading`, que era la única barrera
     y no distinguía «todavía no sé» de «ya no sé»: bastaba con que algo vaciara
     la caché de `/api/me/config` —el logout lo hacía en cada cierre de sesión—
     para que el hook quedara en `consultorios: []` con `isLoading: false` y este
     modal saliera encima de un médico que sí tiene consultorios. Con el agregado
     mintiendo (200 con `[]` ante un fallo de base de datos) el POST además
     pasaba, y le creaba un consultorio de más. */
  if (!isDoctor) return null
  if (!lecturaConfirmada) return null
  if (consultorios.length > 0) return null
  if (state.isBlocked) return null

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
      await mutate(
        (cur) => ({ consultorios: [...(cur?.consultorios ?? []), consultorio] }),
        { revalidate: false }
      )
      toast.success('Consultorio creado. Puedes agregar más desde tu perfil → Mis consultorios.')
      // El camino de éxito normalmente desmonta este modal (la guarda de
      // `consultorios.length > 0` de arriba), pero si el `mutate` no dejara la
      // lista poblada, sin esto el botón se quedaba en «Guardando…» para
      // siempre y el modal —que es bloqueante— dejaba al médico encerrado.
      setSubmitting(false)
    } catch {
      toast.error('Error de red. Verifica tu conexión.')
      setSubmitting(false)
    }
  }

  return (
    <ModalShell
      open={true}
      onClose={() => { /* bloqueante: no-op intencional */ }}
      hideClose
      title="Configura tu consultorio"
      subtitle="Paso único de configuración"
      maxWidth="max-w-lg"
      footer={
        <div className="flex flex-col gap-2 px-5 py-3.5">
          <p className="text-[11px] text-slate-500 text-center">
            Configuración completa disponible en tu perfil.
          </p>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[var(--cp)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Guardando…' : 'Guardar consultorio'}
          </button>
        </div>
      }
    >
      <div className="px-5 py-5 space-y-4">
        <p className="text-sm text-slate-600">
          Spinus ahora soporta múltiples consultorios. Configura tu consultorio principal para continuar.
        </p>

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
