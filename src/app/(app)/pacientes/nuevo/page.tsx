'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, User } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type Campo = {
  label: string
  key: string
  type?: string
  placeholder?: string
  options?: { value: string; label: string }[]
  required?: boolean
  section: string
}

const campos: Campo[] = [
  // Datos personales
  { section: 'personal', label: 'Nombre(s)', key: 'nombre', required: true, placeholder: 'Ej: Juan Carlos' },
  { section: 'personal', label: 'Apellidos', key: 'apellidos', required: true, placeholder: 'Ej: García López' },
  { section: 'personal', label: 'Fecha de nacimiento', key: 'fecha_nacimiento', type: 'date', required: true },
  { section: 'personal', label: 'Sexo', key: 'sexo', options: [{ value: 'M', label: 'Masculino' }, { value: 'F', label: 'Femenino' }, { value: 'Otro', label: 'Otro' }], required: true },
  { section: 'personal', label: 'N° Expediente', key: 'numero_expediente', placeholder: 'Ej: OI-2025-001' },
  // Antropometría
  { section: 'antro', label: 'Peso (kg)', key: 'peso_kg', type: 'number', placeholder: '70' },
  { section: 'antro', label: 'Talla (cm o m)', key: 'talla_cm', type: 'number', placeholder: '170 ó 1.70' },
  // Contacto
  { section: 'contacto', label: 'Teléfono', key: 'telefono', type: 'tel', placeholder: 'Ej: 999 123 4567' },
  { section: 'contacto', label: 'Email', key: 'email', type: 'email', placeholder: 'paciente@email.com' },
  { section: 'contacto', label: 'Dirección', key: 'direccion', placeholder: 'Calle, colonia, ciudad' },
  // Antecedentes
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
  const [form, setForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
    setLoading(true)
    setError('')

    const imc = calcularIMC()
    const tallaCm = parseTallaCm(form.talla_cm || '')
    const supabase = createClient()

    const formLimpio = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''))
    const { data: nuevo, error: err } = await supabase.from('pacientes').insert({
      ...formLimpio,
      peso_kg: form.peso_kg ? Math.round(parseFloat(form.peso_kg) * 10) / 10 : null,
      talla_cm: tallaCm,
      imc: imc ? parseFloat(imc) : null,
    }).select('id').single()

    if (err) {
      setError('Error al guardar: ' + err.message)
      setLoading(false)
    } else {
      router.push(`/expediente/${nuevo.id}`)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/pacientes" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-[#1a3a5c] flex items-center gap-2">
          <User size={22} /> Nuevo Paciente
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {secciones.map(sec => {
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
