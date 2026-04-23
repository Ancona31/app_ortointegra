'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { User, X, Loader2 } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import { toTitleCase, calcularEdad, fechaHoyISO, FECHA_MIN_NACIMIENTO } from '@/lib/patientUtils'
import type { DuplicatePatientResponse } from '@/types'

type PacienteBusqueda = { id: string; nombre: string; apellidos: string; telefono: string | null }

export default function QuickPatientModal({
  nombreInicial,
  onCreated,
  onClose,
}: {
  nombreInicial: string
  onCreated: (p: PacienteBusqueda) => void
  onClose: () => void
}) {
  const router = useRouter()
  const partes = nombreInicial.trim().split(' ')
  const [nombre,    setNombre]    = useState(partes[0] ?? '')
  const [apellidos, setApellidos] = useState(partes.slice(1).join(' '))
  const [fechaNac,  setFechaNac]  = useState('')
  const [email,     setEmail]     = useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [consentimiento, setConsentimiento] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<{ id: string; nombre: string; apellidos: string; numero_expediente: string | null } | null>(null)
  const forceCreateRef = useRef(false)

  const edadInfo = fechaNac ? calcularEdad(fechaNac) : null

  async function handleCreate() {
    if (!nombre.trim() || !apellidos.trim()) {
      setError('Nombre y apellidos son requeridos.')
      return
    }
    if (!consentimiento) {
      setError('Debes marcar el consentimiento del aviso de privacidad.')
      return
    }
    setSaving(true)
    setError('')

    const nombreLimpio = toTitleCase(nombre)
    const apellidosLimpio = toTitleCase(apellidos)

    try {
      const res = await fetch('/api/pacientes', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          nombre: nombreLimpio,
          apellidos: apellidosLimpio,
          fecha_nacimiento: fechaNac || null,
          email: email.trim() || null,
          consentimiento_otorgado: true,
          ...(forceCreateRef.current ? { forceCreate: true } : {}),
        }),
      })
      const data = await res.json() as Record<string, unknown>

      if (res.status === 409 && data.error === 'DUPLICATE_PATIENT') {
        const dupData = data as unknown as DuplicatePatientResponse
        setDuplicateWarning({
          id: dupData.existingPatient.id,
          nombre: dupData.existingPatient.nombre,
          apellidos: dupData.existingPatient.apellidos,
          numero_expediente: dupData.existingPatient.numero_expediente,
        })
        setSaving(false)
        return
      }

      if (!res.ok) { setError((data.error as string) ?? 'Error al crear paciente'); setSaving(false); return }
      onCreated({ id: (data.id as string) ?? '', nombre: nombreLimpio, apellidos: apellidosLimpio, telefono: null })
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setSaving(false)
    }
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-modal-enter overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <User size={15} className="text-emerald-600" />
            </div>
            <h2 className="font-semibold text-[15px] text-[#1d1d1f]">Registrar paciente</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-3">
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          {duplicateWarning && (
            <div className="bg-amber-50 border border-amber-300 px-3 py-3 rounded-xl space-y-2">
              <p className="text-xs text-amber-800 font-medium">
                ⚠️ Ya existe un paciente: {duplicateWarning.nombre} {duplicateWarning.apellidos}
                {duplicateWarning.numero_expediente ? ` (Exp. #${duplicateWarning.numero_expediente})` : ''}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/expediente/${duplicateWarning.id}`)}
                  className="flex-1 px-2 py-1.5 text-[11px] font-medium text-emerald-700 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors"
                >
                  Ir al expediente existente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDuplicateWarning(null)
                    forceCreateRef.current = true
                    handleCreate()
                  }}
                  className="flex-1 px-2 py-1.5 text-[11px] font-medium text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
                >
                  Crear de todos modos
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">Nombre</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">Apellidos</label>
              <input value={apellidos} onChange={e => setApellidos(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                value={fechaNac}
                onChange={e => setFechaNac(e.target.value)}
                min={FECHA_MIN_NACIMIENTO}
                max={fechaHoyISO()}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
              />
              {edadInfo && (
                <p className="text-[11px] text-emerald-600 mt-1 font-medium">{edadInfo.textoElegante}</p>
              )}
              <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">Recomendable para que la edad aparezca en recetas y documentos. Si se deja vacío, el campo edad quedará en blanco.</p>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-1.5">Correo</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="opcional"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all" />
            </div>
          </div>

          <p className="text-[11px] text-[#86868b]">El expediente completo se puede editar después desde Pacientes.</p>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={consentimiento}
              onChange={e => setConsentimiento(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/30"
            />
            <span className="text-[11px] text-slate-500 leading-relaxed">
              Paciente informado del{' '}
              <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline font-medium">
                aviso de privacidad
              </a>
            </span>
          </label>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl text-sm font-medium text-[#86868b] hover:bg-slate-100 transition-colors disabled:opacity-50">Cancelar</button>
          <button onClick={handleCreate} disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Registrando...</> : 'Crear y continuar'}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  )
}
