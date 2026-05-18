'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, Save, Hash, Mail, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useProfile } from '@/hooks/useProfile'
import { validarEmail, validarTelefono, formatearTelefono } from '@/lib/validaciones'
import { secureStorage } from '@/lib/secureStorage'
import { toTitleCase, fechaHoyISO, FECHA_MIN_NACIMIENTO, edadAFechaFicticia } from '@/lib/patientUtils'
import type { DuplicatePatientResponse } from '@/types'

type Medico = {
  id: string
  nombre: string
  titulo: string | null
  especialidad: string | null
}

const MEDICOS_CACHE_KEY = 'cache_medicos_clinica'

const inputCls = 'w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8] focus:bg-white transition-all'
const labelCls = 'block text-xs font-medium text-[#86868b] mb-1'

export default function NuevoPacientePage() {
  const router = useRouter()
  const { profile } = useProfile()
  const [form, setForm] = useState<Record<string, string>>({})
  const [edad, setEdad] = useState('')
  const [medicoSeleccionado, setMedicoSeleccionado] = useState('')
  const [medicos, setMedicos] = useState<Medico[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandido, setExpandido] = useState(false)
  const [consentimiento, setConsentimiento] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<{ id: string; nombre: string; apellidos: string; numero_expediente: string | null } | null>(null)
  const forceCreateRef = useRef(false)

  const isSecretaria = profile?.role === 'secretaria'

  // Cargar lista de médicos (secretaria) — red primero, cache como fallback
  useEffect(() => {
    if (!isSecretaria) return

    let cancelled = false

    async function cargarMedicos() {
      // Intento online
      try {
        const r = await fetch('/api/clinica/medicos')
        if (!r.ok) throw new Error('fetch failed')
        const { medicos: lista } = await r.json() as { medicos: Medico[] }
        if (cancelled) return
        const rows = lista || []
        setMedicos(rows)
        // Cachear para futuros accesos offline
        secureStorage.set(MEDICOS_CACHE_KEY, rows).catch(() => {})
      } catch {
        // Fallback offline: leer del cache
        try {
          const cached = await secureStorage.get<Medico[]>(MEDICOS_CACHE_KEY)
          if (!cancelled && Array.isArray(cached)) setMedicos(cached)
        } catch {
          // silencioso
        }
      }
    }

    cargarMedicos()
    return () => { cancelled = true }
  }, [isSecretaria])

  function set(key: string, val: string) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  function parseTallaCm(val: string): number | null {
    const n = parseFloat(val)
    if (!n || n <= 0) return null
    return n <= 3 ? Math.round(n * 100 * 10) / 10 : Math.round(n * 10) / 10
  }

  function calcularIMC() {
    const peso = parseFloat(form.peso_kg || '0')
    const tallaCm = parseTallaCm(form.talla_cm || '0')
    if (!peso || !tallaCm) return null
    return (peso / Math.pow(tallaCm / 100, 2)).toFixed(1)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSecretaria && !medicoSeleccionado) {
      setError('Debes seleccionar un médico para asignar el paciente')
      return
    }
    if (!consentimiento) {
      setError('Debes marcar el consentimiento del aviso de privacidad')
      return
    }
    const errTel = validarTelefono(form.telefono || '')
    const errEmail = validarEmail(form.email || '')
    if (errTel || errEmail) {
      setError(errTel || errEmail || 'Revisa los campos')
      return
    }
    setLoading(true)
    setError('')

    const tallaCm = parseTallaCm(form.talla_cm || '')
    const imc = calcularIMC()

    // Resolver fecha_nacimiento priorizando fecha explícita sobre edad
    let fecha_nacimiento: string | null = null
    if (form.fecha_nacimiento) {
      fecha_nacimiento = form.fecha_nacimiento
    } else if (edad.trim()) {
      const edadNum = parseInt(edad, 10)
      if (!isNaN(edadNum) && edadNum >= 0 && edadNum <= 120) {
        fecha_nacimiento = edadAFechaFicticia(edadNum)
      }
    }

    const payload = {
      ...form,
      nombre: toTitleCase(form.nombre ?? ''),
      apellidos: toTitleCase(form.apellidos ?? ''),
      fecha_nacimiento,
      peso_kg: form.peso_kg ? Math.round(parseFloat(form.peso_kg) * 10) / 10 : null,
      talla_cm: tallaCm,
      imc: imc ? parseFloat(imc) : null,
      medico_id: isSecretaria ? medicoSeleccionado : undefined,
      consentimiento_otorgado: true,
      ...(forceCreateRef.current ? { forceCreate: true } : {}),
    }

    // Intento online con try/catch
    try {
      const res = await fetch('/api/pacientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))

      if (res.status === 409 && (data as DuplicatePatientResponse).error === 'DUPLICATE_PATIENT') {
        const dupData = data as DuplicatePatientResponse
        setDuplicateWarning({
          id: dupData.existingPatient.id,
          nombre: dupData.existingPatient.nombre,
          apellidos: dupData.existingPatient.apellidos,
          numero_expediente: dupData.existingPatient.numero_expediente,
        })
        setLoading(false)
        return
      }

      if (!res.ok) {
        setError('Error al guardar: ' + (data.error || 'Error desconocido'))
        setLoading(false)
        return
      }
      router.push(`/expediente/${data.id}`)
    } catch {
      setError("Error de conexion. Verifica tu internet e intenta de nuevo.")
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto py-2 animate-slide-up">

      {/* Header macOS */}
      <div className="flex items-center gap-2 mb-5">
        <Link href="/expediente" className="flex items-center gap-1 text-[#1e5fa8] hover:text-[#1a3a5c] text-sm font-medium transition-colors">
          <ArrowLeft size={16} strokeWidth={2.5} />
          <span>Pacientes</span>
        </Link>
        <span className="text-slate-300 select-none">/</span>
        <div>
          <h1 className="text-sm font-semibold text-[#1d1d1f]">Nuevo paciente</h1>
        </div>
      </div>

      {/* Aviso email */}
      <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl mb-3">
        <Mail size={15} className="text-amber-500 flex-shrink-0" />
        <p className="text-xs text-amber-700">
          Para poder enviarle documentos al paciente, agrega su <strong>email</strong> en los datos adicionales
        </p>
      </div>

      {/* Badge expediente */}
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-2xl mb-6">
        <Hash size={15} className="text-blue-400 flex-shrink-0" />
        <p className="text-xs text-blue-600">
          El número de expediente se genera automáticamente al guardar
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Asignación — solo secretaria */}
        {isSecretaria && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">Asignación</p>
            <label className={labelCls}>Médico responsable <span className="text-red-400">*</span></label>
            <select value={medicoSeleccionado} onChange={e => setMedicoSeleccionado(e.target.value)} required className={inputCls}>
              <option value="">Seleccionar médico...</option>
              {medicos.map(m => (
                <option key={m.id} value={m.id}>
                  {m.titulo ?? 'Dr.'} {m.nombre}{m.especialidad ? ` — ${m.especialidad}` : ''}
                </option>
              ))}
            </select>
            {medicos.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-2">
                No hay médicos disponibles. Si estás sin conexión, conéctate al menos una vez para sincronizar la lista.
              </p>
            )}
          </div>
        )}

        {/* Datos esenciales */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">Datos del paciente</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nombre(s) <span className="text-red-400">*</span></label>
              <input type="text" value={form.nombre || ''} onChange={e => set('nombre', e.target.value)}
                placeholder="Juan Carlos" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Apellidos <span className="text-red-400">*</span></label>
              <input type="text" value={form.apellidos || ''} onChange={e => set('apellidos', e.target.value)}
                placeholder="García López" required className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Fecha de nacimiento</label>
              <input type="date" value={form.fecha_nacimiento || ''} onChange={e => set('fecha_nacimiento', e.target.value)}
                min={FECHA_MIN_NACIMIENTO} max={fechaHoyISO()} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Edad (opcional)</label>
              <input
                type="number"
                min={0}
                max={120}
                value={edad}
                onChange={e => setEdad(e.target.value)}
                placeholder="Ej. 35"
                className={inputCls}
              />
              <p className="text-xs text-slate-500 mt-1.5">Si no conoces la fecha exacta, ingresa solo la edad</p>
            </div>
            <div>
              <label className={labelCls}>Sexo <span className="text-red-400">*</span></label>
              <select value={form.sexo || ''} onChange={e => set('sexo', e.target.value)} required className={inputCls}>
                <option value="">Seleccionar...</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
          </div>
        </div>

        {/* Datos adicionales — colapsados */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setExpandido(e => !e)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
          >
            <div>
              <p className="text-sm font-semibold text-[#1d1d1f]">Datos adicionales</p>
              <p className="text-xs text-[#86868b] mt-0.5">Contacto, antropometría y antecedentes — puedes completarlos después</p>
            </div>
            <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${expandido ? 'rotate-180' : ''}`} />
          </button>

          {expandido && (
            <div className="px-5 pb-5 space-y-5 border-t border-slate-100 pt-4">

              {/* Contacto */}
              <div>
                <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">Contacto</p>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Teléfono</label>
                    <input type="tel" inputMode="numeric" value={form.telefono || ''} onChange={e => set('telefono', formatearTelefono(e.target.value))}
                      placeholder="999 123 4567" maxLength={12} className={inputCls} />
                    {form.telefono && validarTelefono(form.telefono) && (
                      <p className="text-[10px] text-red-500 mt-1">{validarTelefono(form.telefono)}</p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className={`${labelCls} mb-0`}>Email</label>
                      <span className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                        <Mail size={9} />
                        Necesario para enviar documentos
                      </span>
                    </div>
                    <input type="email" value={form.email || ''} onChange={e => set('email', e.target.value)}
                      placeholder="paciente@email.com" className={inputCls} />
                    {form.email && validarEmail(form.email) && (
                      <p className="text-[10px] text-red-500 mt-1">{validarEmail(form.email)}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Dirección</label>
                    <input type="text" value={form.direccion || ''} onChange={e => set('direccion', e.target.value)}
                      placeholder="Calle, colonia, ciudad" className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Antropometría */}
              <div>
                <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">Antropometría</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Peso (kg)</label>
                    <input type="number" value={form.peso_kg || ''} onChange={e => set('peso_kg', e.target.value)}
                      placeholder="70" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Talla (cm o m)</label>
                    <input type="number" value={form.talla_cm || ''} onChange={e => set('talla_cm', e.target.value)}
                      placeholder="170 ó 1.70" className={inputCls} />
                  </div>
                </div>
                {calcularIMC() && (
                  <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl">
                    <p className="text-xs text-blue-700">IMC calculado: <strong>{calcularIMC()} kg/m²</strong></p>
                  </div>
                )}
              </div>

              {/* Antecedentes */}
              <div>
                <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-3">Antecedentes</p>
                <div className="space-y-3">
                  {[
                    { key: 'alergias',             label: 'Alergias',                    placeholder: 'Medicamentos, alimentos...' },
                    { key: 'ant_patologicos',       label: 'Antecedentes patológicos',    placeholder: 'DM2, HTA, hipotiroidismo...' },
                    { key: 'ant_quirurgicos',       label: 'Antecedentes quirúrgicos',    placeholder: 'Cirugías previas...' },
                    { key: 'ant_familiares',        label: 'Antecedentes familiares',     placeholder: 'Enfermedades relevantes en familia...' },
                    { key: 'medicamentos_actuales', label: 'Medicamentos actuales',       placeholder: 'Lista de medicamentos...' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className={labelCls}>{label}</label>
                      <textarea value={form[key] || ''} onChange={e => set(key, e.target.value)}
                        placeholder={placeholder} rows={2}
                        className={`${inputCls} resize-none`} />
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

        {duplicateWarning && (
          <div className="bg-amber-50 border border-amber-300 px-4 py-4 rounded-xl space-y-3">
            <p className="text-sm text-amber-800 font-medium">
              ⚠️ Ya existe un paciente: {duplicateWarning.nombre} {duplicateWarning.apellidos}
              {duplicateWarning.numero_expediente ? ` (Exp. #${duplicateWarning.numero_expediente})` : ''}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.push(`/expediente/${duplicateWarning.id}`)}
                className="flex-1 px-3 py-2 text-sm font-medium text-[#1e5fa8] bg-white border border-[#1e5fa8]/30 rounded-xl hover:bg-blue-50 transition-colors"
              >
                Ir al expediente existente
              </button>
              <button
                type="button"
                onClick={() => {
                  setDuplicateWarning(null)
                  forceCreateRef.current = true
                  // Re-submit programmatically
                  const formEl = document.querySelector('form')
                  if (formEl) formEl.requestSubmit()
                }}
                className="flex-1 px-3 py-2 text-sm font-medium text-amber-700 bg-white border border-amber-300 rounded-xl hover:bg-amber-50 transition-colors"
              >
                Crear de todos modos
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
        )}

        {/* Consentimiento de privacidad — LFPDPPP Art. 9 */}
        <label className="flex items-start gap-3 cursor-pointer py-2">
          <input
            type="checkbox"
            checked={consentimiento}
            onChange={e => setConsentimiento(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#1e5fa8] focus:ring-[#1e5fa8]/30"
          />
          <span className="text-xs text-slate-500 leading-relaxed">
            Paciente informado del{' '}
            <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="text-[#1e5fa8] hover:underline font-medium">
              aviso de privacidad
            </a>
          </span>
        </label>

        {/* Acciones */}
        <div className="flex gap-3 pb-8">
          <Link href="/expediente"
            className="flex-1 text-center px-4 py-3 bg-slate-50 border border-slate-200 text-[#86868b] rounded-xl text-sm font-medium hover:bg-white transition-all">
            Cancelar
          </Link>
          <button type="submit" disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-[#1e5fa8] text-white px-4 py-3 rounded-xl text-sm font-semibold hover:bg-[#1a3a5c] active:scale-[0.98] transition-all disabled:opacity-60 shadow-sm">
            {loading ? <><Loader2 size={15} className="animate-spin" /> Guardando...</> : <><Save size={15} /> Registrar e ir al expediente</>}
          </button>
        </div>

      </form>
    </div>
  )
}
