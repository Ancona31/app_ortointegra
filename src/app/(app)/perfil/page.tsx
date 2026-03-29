'use client'

import { useState, useEffect } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { useRouter } from 'next/navigation'
import { Loader2, Save, UserCircle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

type FormData = {
  titulo: string
  especialidad: string
  cedula_profesional: string
  cedula_especialidad: string
  direccion_consultorio: string
  telefono_consultorio: string
}

export default function PerfilPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const router = useRouter()
  const toast = useToast()
  const [form, setForm] = useState<FormData>({
    titulo: '',
    especialidad: '',
    cedula_profesional: '',
    cedula_especialidad: '',
    direccion_consultorio: '',
    telefono_consultorio: '',
  })
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!loadingProfile && profile && !['medico', 'admin', 'super_admin'].includes(profile.role)) {
      router.push('/dashboard')
    }
  }, [profile, loadingProfile, router])

  useEffect(() => {
    fetch('/api/me/perfil-medico')
      .then(r => r.json())
      .then(({ medico }) => {
        if (medico) {
          setForm({
            titulo: medico.titulo || 'Dr.',
            especialidad: medico.especialidad || '',
            cedula_profesional: medico.cedula_profesional || '',
            cedula_especialidad: medico.cedula_especialidad || '',
            direccion_consultorio: medico.direccion_consultorio || '',
            telefono_consultorio: medico.telefono_consultorio || '',
          })
        }
        setLoading(false)
      })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    setExito(false)

    const res = await fetch('/api/me/perfil-medico', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setGuardando(false)

    if (!res.ok) {
      toast.error(data.error || 'Error al guardar')
    } else {
      toast.success('Perfil actualizado correctamente')
    }
  }

  if (loading || loadingProfile) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-slate-300" />
    </div>
  )

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <UserCircle size={24} className="text-[#1a3a5c]" />
        <h1 className="text-2xl font-bold text-[#1a3a5c]">Mi perfil</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-slate-700 text-sm">Datos profesionales</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Título</label>
              <select value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30">
                <option value="Dr.">Dr.</option>
                <option value="Dra.">Dra.</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Especialidad</label>
              <input type="text" value={form.especialidad} onChange={e => setForm({ ...form, especialidad: e.target.value })}
                placeholder="Ej: Cirugía de Columna"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Cédula profesional</label>
              <input type="text" value={form.cedula_profesional} onChange={e => setForm({ ...form, cedula_profesional: e.target.value })}
                placeholder="Ej: 12085805"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Cédula de especialidad</label>
              <input type="text" value={form.cedula_especialidad} onChange={e => setForm({ ...form, cedula_especialidad: e.target.value })}
                placeholder="Ej: CMOT 26/5567/25"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-slate-700 text-sm">
            Datos del consultorio
            <span className="ml-2 text-xs font-normal text-slate-400">Requeridos en recetas (RIS)</span>
          </h2>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Dirección del consultorio</label>
            <input type="text" value={form.direccion_consultorio} onChange={e => setForm({ ...form, direccion_consultorio: e.target.value })}
              placeholder="Ej: Calle 60 #400, Col. Centro, Mérida, Yucatán"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Teléfono del consultorio</label>
            <input type="tel" value={form.telefono_consultorio} onChange={e => setForm({ ...form, telefono_consultorio: e.target.value })}
              placeholder="Ej: (999) 123-4567"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
          </div>
        </div>

        <button type="submit" disabled={guardando}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#1e5fa8] text-white rounded-xl font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-60">
          {guardando ? <><Loader2 size={16} className="animate-spin" /> Guardando...</> : <><Save size={16} /> Guardar cambios</>}
        </button>
      </form>
    </div>
  )
}
