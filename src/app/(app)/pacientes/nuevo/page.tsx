'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, User, Hash } from 'lucide-react'
import Link from 'next/link'
import { useProfile } from '@/hooks/useProfile'

type Campo = {
  label: string
  key: string
  type?: string
  placeholder?: string
  options?: { value: string; label: string }[]
  required?: boolean
  section: string
}

type Medico = {
  id: string
  nombre: string
  titulo: string | null
  especialidad: string | null
}

const campos: Campo[] = [
  { section: 'personal', label: 'Nombre(s)', key: 'nombre', required: true, placeholder: 'Ej: Juan Carlos' },
  { section: 'personal', label: 'Apellidos', key: 'apellidos', required: true, placeholder: 'Ej: García López' },
  { section: 'personal', label: 'Fecha de nacimiento', key: 'fecha_nacimiento', type: 'date', required: true },
  { section: 'personal', label: 'Sexo', key: 'sexo', options: [{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Femenino' }, { value: 'Otro', label: 'Otro' }], required: true },
  { section: 'antro', label: 'Peso (kg)', key: 'peso_kg', type: 'number', placeholder: '70' },
  { section: 'antro', label: 'Talla (cm o m)', key: 'talla_cm', type: 'number', placeholder: '170 ó 1.70' },
  { section: 'contacto', label: 'Teléfono', key: 'telefono', type: 'tel', placeholder: 'Ej: 999 123 4567' },
  { section: 'contacto', label: 'Email', key: 'email', type: 'email', placeholder: 'paciente@email.com' },
  { section: 'contacto', label: 'Dirección', key: 'direccion', placeholder: 'Calle, colonia, ciudad' },
  { section: 'antecedentes', label: 'Antecedentes patológicos', key: 'ant_patologicos', placeholder: 'DM2, HTA, hipotiroidismo...' },
  { section: 'antecedentes', label: 'Antecedentes quirúrgicos', key: 'ant_quirurgicos', placeholder: 'Cirugías previas...' },
  { section: 'antecedentes', label: 'Antecedentes familiares', key: 'ant_familiares', placeholder: 'Enfermedades relevantes en familia...' },
  { section: 'antecedentes', label: 'Alergias', key: 'alergias', placeholder: 'Medicamentos, alimentos...' },
  { section: 'antecedentes', label: 'Medicamentos actuales', key: 'medicamentos_actuales', placeholder: 'Lista de medicamentos...' },
]

const secciones = [
  { key: 'personal', label: 'Datos Personales' },
  { key: 'antro', label: 'Antropometría' },
  { key: 'contacto', label: 'Contacto' },
  { key: 'antecedentes', label: 'Antecedentes' },
]

export default function NuevoPacientePage() {
  const router = useRouter()
  const { profile } = useProfile()
  const [form, setForm] = useState<Record<string, string>>({})
  const [medicoSeleccionado, setMedicoSeleccionado] = useState('')
  const [medicos, setMedicos] = useState<Medico[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isSecretaria = profile?.role === 'secretaria'
  const [expPreview] = useState(`EXP-${new Date().getFullYear()}-????`)

  useEffect(() => {
    if (isSecretaria) {
      fetch('/api/clinica/medicos')
        .then(r => r.json())
        .then(({ medicos }) => setMedicos(medicos || []))
    }
  }, [isSecretaria])

  function parseTallaCm(val: string): number | null {
    const n = parseFloat(val)
    if (!n || n <= 0) return null
    return n <= 3 ? Math.round(n * 100 * 10) / 10 : Math.round(n * 10) / 10
  }

  function calcularIMC() {
    const peso = parseFloat(form.peso_kg || '0')
    const tallaCm = parseTallaCm(form.talla_cm || '0')
    if (!peso || !tallaCm) return null
    const tallaM = tallaCm / 100
    return (peso / (tallaM * tallaM)).toFixed(1)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (isSecretaria && !medicoSeleccionado) {
      setError('Debes seleccionar un médico para asignar el paciente')
      return
    }

    setLoading(true)
    setError('')

    const imc = calcularIMC()
    const tallaCm = parseTallaCm(form.talla_cm || '')

    const res = await fetch('/api/pacientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        peso_kg: form.peso_kg ? Math.round(parseFloat(form.peso_kg) * 10) / 10 : null,
        talla_cm: tallaCm,
        imc: imc ? parseFloat(imc) : null,
        medico_id: isSecretaria ? medicoSeleccionado : undefined,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError('Error al guardar: ' + (data.error || 'Error desconocido'))
      setLoading(false)
    } else {
      router.push(`/expediente/${data.id}`)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/expediente" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-[#1a3a5c] flex items-center gap-2">
          <User size={22} /> Nuevo Paciente
        </h1>
      </div>

      {/* Badge número de expediente */}
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
        <Hash size={16} className="text-blue-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-700">Número de expediente automático</p>
          <p className="text-xs text-blue-500 mt-0.5">Se asignará <strong>{expPreview}</strong> al guardar</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Selector de médico — solo para secretaria */}
        {isSecretaria && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
              <h2 className="font-semibold text-slate-700 text-sm">Asignación</h2>
            </div>
            <div className="p-5">
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Médico responsable <span className="text-red-400">*</span>
              </label>
              <select
                value={medicoSeleccionado}
                onChange={e => setMedicoSeleccionado(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
              >
                <option value="">Seleccionar médico...</option>
                {medicos.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.titulo ?? 'Dr.'} {m.nombre}{m.especialidad ? ` — ${m.especialidad}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {secciones
          .filter(sec => isSecretaria ? sec.key !== 'antecedentes' : true)
          .map(sec => {
            const camposSec = campos.filter(c => c.section === sec.key)
            return (
              <div key={sec.key} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-700 text-sm">{sec.label}</h2>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {camposSec.map(campo => (
                    <div key={campo.key} className={campo.key.includes('ant_') || campo.key === 'medicamentos_actuales' || campo.key === 'direccion' ? 'sm:col-span-2' : ''}>
                      <label className="block text-sm font-medium text-slate-600 mb-1">
                        {campo.label} {campo.required && <span className="text-red-400">*</span>}
                      </label>
                      {campo.options ? (
                        <select
                          value={form[campo.key] || ''}
                          onChange={e => setForm({ ...form, [campo.key]: e.target.value })}
                          required={campo.required}
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
                        >
                          <option value="">Seleccionar...</option>
                          {campo.options.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (campo.key.includes('ant_') || campo.key === 'medicamentos_actuales') ? (
                        <textarea
                          value={form[campo.key] || ''}
                          onChange={e => setForm({ ...form, [campo.key]: e.target.value })}
                          placeholder={campo.placeholder}
                          rows={2}
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8] resize-none"
                        />
                      ) : (
                        <input
                          type={campo.type || 'text'}
                          value={form[campo.key] || ''}
                          onChange={e => setForm({ ...form, [campo.key]: e.target.value })}
                          placeholder={campo.placeholder}
                          required={campo.required}
                          className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
                        />
                      )}
                    </div>
                  ))}
                  {sec.key === 'antro' && calcularIMC() && (
                    <div className="sm:col-span-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5">
                      <span className="text-sm text-blue-700">
                        <strong>IMC calculado:</strong> {calcularIMC()} kg/m²
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3 pb-6">
          <Link
            href="/expediente"
            className="flex-1 text-center px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-[#1e5fa8] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-60"
          >
            <Save size={16} />
            {loading ? 'Guardando...' : 'Guardar Paciente'}
          </button>
        </div>
      </form>
    </div>
  )
}
