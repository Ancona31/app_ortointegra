'use client'

import { useState, useEffect } from 'react'
import { Users, Plus, Trash2, Loader2, Shield, UserCheck, X, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'

type Usuario = {
  id: string
  role: 'super_admin' | 'admin' | 'medico' | 'secretaria'
  nombre: string | null
  email: string
}

type LicenciaInfo = {
  max_medicos: number | null
  max_secretarias: number | null
}

export default function AdminUsuariosPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const router = useRouter()
  const toast = useToast()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [licencia, setLicencia] = useState<LicenciaInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Usuario | null>(null)
  const [form, setForm] = useState({ email: '', password: '', nombre: '', role: 'secretaria', titulo: 'Dr.', especialidad: '', cedula_profesional: '', cedula_especialidad: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loadingProfile && profile && !['admin', 'super_admin'].includes(profile.role)) {
      router.push('/dashboard')
    }
  }, [profile, loadingProfile, router])

  useEffect(() => {
    cargarUsuarios()
  }, [])

  async function cargarUsuarios() {
    try {
      const res = await fetch('/api/admin/usuarios')
      const data = await res.json()
      setUsuarios(data.usuarios || [])
      setLicencia(data.licencia ?? null)
    } catch {
      setError('Error al cargar usuarios. Verifica tu conexión.')
    } finally {
      setLoading(false)
    }
  }

  async function crearUsuario(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    setExito('')

    const res = await fetch('/api/admin/crear-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setGuardando(false)

    if (!res.ok) { setError(data.error || 'Error al crear usuario'); return }

    toast.success(`Usuario ${form.email} creado exitosamente`)
    setForm({ email: '', password: '', nombre: '', role: 'secretaria', titulo: 'Dr.', especialidad: '', cedula_profesional: '', cedula_especialidad: '' })
    setShowForm(false)
    cargarUsuarios()
  }

  async function eliminarUsuario(usuario: Usuario) {
    if (usuario.id === profile?.id) { toast.error('No puedes eliminar tu propia cuenta'); return }
    setConfirmDelete(usuario)
  }

  async function confirmarEliminar() {
    if (!confirmDelete) return
    await fetch('/api/admin/usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: confirmDelete.id }),
    })
    toast.success(`Usuario ${confirmDelete.nombre || confirmDelete.email} eliminado`)
    setConfirmDelete(null)
    cargarUsuarios()
  }

  if (loadingProfile || loading) return (
    <div className="max-w-2xl mx-auto space-y-4">
      {[1,2,3].map(i => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-200" />
            <div className="space-y-1.5">
              <div className="h-3 w-32 bg-slate-200 rounded" />
              <div className="h-2.5 w-48 bg-slate-100 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a5c] flex items-center gap-2">
            <Users size={24} /> Gestión de usuarios
          </h1>
          <p className="text-slate-500 text-sm mt-1">Crea y administra los accesos al sistema</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError('') }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1e5fa8] text-white rounded-lg text-sm font-medium hover:bg-[#1a3a5c] transition-colors"
        >
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      {/* Modal nuevo usuario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Plus size={18} /> Nuevo usuario
              </h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={crearUsuario} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Nombre completo</label>
                <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: María González" required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Correo electrónico</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="correo@email.com" required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Contraseña</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres" required minLength={6}
                    className="w-full px-3 py-2 pr-9 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Rol</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30">
                  <option value="secretaria">Secretaria</option>
                  <option value="medico">Médico</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {form.role === 'medico' && (
                <>
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
                      placeholder="Ej: Cirugía de Columna · Traumatología"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                  </div>
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
                </>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" disabled={guardando}
                  className="flex-1 py-2.5 bg-[#1e5fa8] text-white rounded-xl text-sm font-medium hover:bg-[#1a3a5c] disabled:opacity-60 flex items-center justify-center gap-2">
                  {guardando ? <><Loader2 size={14} className="animate-spin" /> Creando...</> : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Indicadores de licencia */}
      {licencia && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-500 font-medium">Médicos</p>
            <p className="text-lg font-bold text-blue-700 mt-0.5">
              {usuarios.filter(u => u.role === 'medico').length}
              <span className="text-sm font-normal text-blue-400"> / {licencia.max_medicos ?? '∞'}</span>
            </p>
          </div>
          <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
            <p className="text-xs text-violet-500 font-medium">Secretarias</p>
            <p className="text-lg font-bold text-violet-700 mt-0.5">
              {usuarios.filter(u => u.role === 'secretaria').length}
              <span className="text-sm font-normal text-violet-400"> / {licencia.max_secretarias ?? '∞'}</span>
            </p>
          </div>
        </div>
      )}

      {/* Modal confirmación borrado */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Eliminar usuario</h3>
                <p className="text-sm text-slate-500 mt-1">
                  ¿Estás seguro de eliminar a <strong>{confirmDelete.nombre || confirmDelete.email}</strong>? Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={confirmarEliminar}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors">
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista de usuarios */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
          <h2 className="font-semibold text-slate-700 text-sm">Usuarios registrados</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {usuarios.map(u => (
            <div key={u.id} className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${u.role === 'medico' ? 'bg-blue-100' : 'bg-violet-100'}`}>
                  {u.role === 'medico'
                    ? <Shield size={16} className="text-blue-700" />
                    : <UserCheck size={16} className="text-violet-700" />}
                </div>
                <div>
                  <p className="font-medium text-slate-800 text-sm">{u.nombre || 'Sin nombre'}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{u.email}</p>
                  <p className="text-xs text-slate-300 capitalize">{u.role}</p>
                </div>
              </div>
              {u.id !== profile?.id && (
                <button onClick={() => eliminarUsuario(u)}
                  title="Eliminar usuario"
                  className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={15} />
                </button>
              )}
              {u.id === profile?.id && (
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">Tú</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
