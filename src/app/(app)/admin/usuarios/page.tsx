'use client'

import { useState, useEffect } from 'react'
import { Users, Plus, Trash2, Loader2, Shield, UserCheck, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/hooks/useProfile'
import { useRouter } from 'next/navigation'

type Usuario = {
  id: string
  role: 'super_admin' | 'admin' | 'medico' | 'secretaria'
  nombre: string | null
  email: string
}

export default function AdminUsuariosPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', nombre: '', role: 'secretaria' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  useEffect(() => {
    if (!loadingProfile && profile?.role !== 'medico') router.push('/dashboard')
  }, [profile, loadingProfile, router])

  useEffect(() => {
    cargarUsuarios()
  }, [])

  async function cargarUsuarios() {
    const res = await fetch('/api/admin/usuarios')
    const data = await res.json()
    setUsuarios(data.usuarios || [])
    setLoading(false)
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

    setExito(`Usuario ${form.email} creado exitosamente`)
    setForm({ email: '', password: '', nombre: '', role: 'secretaria' })
    setShowForm(false)
    cargarUsuarios()
  }

  async function eliminarUsuario(id: string) {
    if (id === profile?.id) { setError('No puedes eliminar tu propia cuenta'); return }
    await fetch('/api/admin/usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    })
    cargarUsuarios()
  }

  if (loadingProfile || loading) return <div className="text-center py-12 text-slate-400">Cargando...</div>

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
          onClick={() => { setShowForm(true); setError(''); setExito('') }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1e5fa8] text-white rounded-lg text-sm font-medium hover:bg-[#1a3a5c] transition-colors"
        >
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      {exito && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm mb-4">
          {exito}
        </div>
      )}

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
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres" required minLength={6}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
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
                <button onClick={() => eliminarUsuario(u.id)}
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
