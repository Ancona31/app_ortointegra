'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Eye, EyeOff, CheckCircle, Building2 } from 'lucide-react'

type Step = 'form' | 'enviado'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('form')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: '',
    nombreClinica: '',
    titulo: 'Dr.',
    especialidad: '',
    cedula_profesional: '',
    cedula_especialidad: '',
  })

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      if (res.status === 409) {
        setError(data.error)
        // Small delay then redirect to login
        setTimeout(() => router.push('/login'), 2000)
      } else {
        setError(data.error || 'Error al crear la cuenta. Intenta de nuevo.')
      }
      return
    }

    setStep('enviado')
  }

  if (step === 'enviado') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg mb-4 overflow-hidden">
              <img src="/logo.png" alt="Logo OrtoIntegra" className="w-20 h-20 object-contain"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
            </div>
            <h1 className="text-2xl font-bold text-[#1a3a5c]">OrtoIntegra</h1>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">¡Cuenta creada!</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-6">
              Te enviamos un correo de confirmación a <strong className="text-slate-700">{form.email}</strong>.
              Revísalo y haz clic en el enlace para activar tu cuenta.
            </p>
            <p className="text-xs text-slate-400">
              ¿No lo ves? Revisa tu carpeta de <strong>spam o correo no deseado</strong>.
            </p>
            <div className="mt-6 pt-4 border-t border-slate-100">
              <Link href="/login" className="text-sm text-[#1e5fa8] hover:underline">
                Volver al inicio de sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f4f8] px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg mb-4 overflow-hidden">
            <img src="/logo.png" alt="Logo OrtoIntegra" className="w-16 h-16 object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          </div>
          <h1 className="text-2xl font-bold text-[#1a3a5c]">OrtoIntegra</h1>
          <p className="text-xs text-slate-400 mt-1 text-center">Crea tu cuenta gratuita</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center gap-2 mb-6">
            <Building2 size={16} className="text-[#1a3a5c]" />
            <h2 className="font-semibold text-slate-700">Crear cuenta</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Sección: datos personales */}
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Datos del médico</p>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Título</label>
                <select value={form.titulo} onChange={set('titulo')}
                  className="w-full px-2 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]">
                  <option value="Dr.">Dr.</option>
                  <option value="Dra.">Dra.</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-500 block mb-1">Nombre completo *</label>
                <input type="text" value={form.nombre} onChange={set('nombre')}
                  placeholder="Ej: Juan Pérez" required
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Especialidad *</label>
              <input type="text" value={form.especialidad} onChange={set('especialidad')}
                placeholder="Ej: Medicina General · Cardiología" required
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Cédula profesional *</label>
                <input type="text" value={form.cedula_profesional} onChange={set('cedula_profesional')}
                  placeholder="Ej: 12345678" required
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Cédula especialidad</label>
                <input type="text" value={form.cedula_especialidad} onChange={set('cedula_especialidad')}
                  placeholder="Opcional"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-1" />

            {/* Sección: consultorio */}
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Consultorio / Clínica</p>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Nombre del consultorio *</label>
              <input type="text" value={form.nombreClinica} onChange={set('nombreClinica')}
                placeholder="Ej: Consultorio Médico del Norte" required
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
            </div>

            <div className="border-t border-slate-100 pt-1" />

            {/* Sección: acceso */}
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Acceso</p>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Correo electrónico *</label>
              <input type="email" value={form.email} onChange={set('email')}
                placeholder="correo@ejemplo.com" required
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Contraseña *</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={form.password} onChange={set('password')}
                  placeholder="Mínimo 8 caracteres" required minLength={8}
                  className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]" />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-[#1e5fa8] text-white rounded-xl font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Creando cuenta...</>
                : 'Crear cuenta gratuita'
              }
            </button>

            <p className="text-center text-xs text-slate-400 pt-1">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-[#1e5fa8] hover:underline font-medium">
                Inicia sesión
              </Link>
            </p>
          </form>
        </div>

        <p className="text-center text-xs text-slate-300 mt-6">
          © 2026 OrtoIntegra · Todos los derechos reservados
        </p>
      </div>
    </div>
  )
}
