'use client'

import { useState, useEffect } from 'react'
import { Users, Plus, Trash2, Loader2, Shield, UserCheck, X, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import EspecialidadSelector from '@/components/ui/EspecialidadSelector'
import Portal from '@/components/ui/Portal'
import { createClient } from '@/lib/supabase/client'
import { useProfile, type Role } from '@/hooks/useProfile'
import { canManageClinica, isMedico } from '@/lib/permissions'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { validarCedula } from '@/lib/validaciones'

type Usuario = {
  id: string
  role: Role
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
  const [form, setForm] = useState({ email: '', password: '', nombres: '', apellido_paterno: '', apellido_materno: '', role: 'secretaria', titulo: 'Dr.', cedula_profesional: '', cedula_especialidad: '' })
  const [especialidades, setEspecialidades] = useState<string[]>([''])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loadingProfile && profile && !canManageClinica(profile)) {
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
    if (form.role === 'medico') {
      const errCed = validarCedula(form.cedula_profesional)
      const errCedEsp = validarCedula(form.cedula_especialidad)
      if (errCed || errCedEsp) { setError(errCed || errCedEsp || 'Revisa las cédulas'); return }
    }
    setGuardando(true)
    setError('')

    const res = await fetch('/api/admin/crear-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, especialidad: especialidades.filter(Boolean).join(' · ') }),
    })
    const data = await res.json()
    setGuardando(false)

    if (!res.ok) { setError(data.message || data.error || 'Error al crear usuario'); return }

    toast.success(`Usuario ${form.email} creado exitosamente`)
    setEspecialidades([''])
    setForm({ email: '', password: '', nombres: '', apellido_paterno: '', apellido_materno: '', role: 'secretaria', titulo: 'Dr.', cedula_profesional: '', cedula_especialidad: '' })
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
    <div className="max-w-2xl mx-auto space-y-4 animate-slide-up">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1">Admin</p>
          <h1 className="text-[22px] font-bold tracking-tight text-[#1d1d1f]">Usuarios</h1>
          <p className="text-sm text-[#86868b] mt-0.5">Crea y administra los accesos al sistema</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError('') }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1e5fa8] text-white rounded-xl text-sm font-semibold hover:bg-[#1a3a5c] transition-colors shadow-sm"
        >
          <Plus size={15} strokeWidth={2.5} /> Nuevo usuario
        </button>
      </div>

      {/* Modal nuevo usuario — macOS sheet */}
      {showForm && (
      <Portal>
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-sm flex flex-col max-h-[90vh] animate-slide-up">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-base font-semibold text-[#1d1d1f]">Nuevo usuario</h2>
              <button onClick={() => setShowForm(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-[#86868b] transition-colors">
                <X size={14} />
              </button>
            </div>

            <form id="form-nuevo-usuario" onSubmit={crearUsuario} className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
              {[
                { label: 'Nombre(s)', type: 'text', key: 'nombres', placeholder: 'Ej: María', required: true },
                { label: 'Apellido paterno', type: 'text', key: 'apellido_paterno', placeholder: 'Ej: González', required: true },
                { label: 'Apellido materno', type: 'text', key: 'apellido_materno', placeholder: 'Ej: López (opcional)', required: false },
                { label: 'Correo electrónico', type: 'email', key: 'email', placeholder: 'correo@email.com', required: true },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder} required={f.required}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:border-[#1e5fa8]/50 focus:bg-white transition-all" />
                </div>
              ))}
              <div>
                <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">Contraseña</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres" required minLength={6}
                    className="w-full px-3 py-2.5 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:bg-white transition-all" />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#3d3d3f]">
                    {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">Rol</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:bg-white transition-all">
                  <option value="secretaria">Asistente Médico/a</option>
                  <option value="medico">Médico</option>
                </select>
              </div>

              {form.role === 'medico' && (
                <div className="space-y-3 pt-1 border-t border-slate-100">
                  <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-widest pt-1">Datos médicos</p>
                  <div>
                    <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">Especialidad</label>
                    <EspecialidadSelector value={especialidades} onChange={setEspecialidades} />
                  </div>
                  {[
                    { label: 'Cédula profesional', key: 'cedula_profesional', placeholder: 'Ej: 87654321' },
                    { label: 'Cédula de especialidad', key: 'cedula_especialidad', placeholder: 'Ej: 3890214' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">{f.label}</label>
                      <input type="text" value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                        placeholder={f.placeholder}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:bg-white transition-all" />
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>}
            </form>

            <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-slate-100 flex-shrink-0">
              <button type="button" onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-[#3d3d3f] hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" form="form-nuevo-usuario" disabled={guardando}
                className="flex-1 py-2.5 bg-[#1e5fa8] text-white rounded-xl text-sm font-semibold hover:bg-[#1a3a5c] disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors">
                {guardando ? <><Loader2 size={13} className="animate-spin" /> Creando...</> : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      </Portal>
      )}

      {/* Indicadores de licencia */}
      {licencia && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="grid grid-cols-2 divide-x divide-slate-100">
            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-widest">Médicos</p>
              <p className="text-xl font-bold text-[#1d1d1f] mt-1.5 tabular-nums">
                {usuarios.filter(u => u.role === 'medico').length}
                <span className="text-sm font-normal text-[#86868b]"> / {licencia.max_medicos ?? '∞'}</span>
              </p>
            </div>
            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-widest">Asistentes</p>
              <p className="text-xl font-bold text-[#1d1d1f] mt-1.5 tabular-nums">
                {usuarios.filter(u => u.role === 'secretaria').length}
                <span className="text-sm font-normal text-[#86868b]"> / {licencia.max_secretarias ?? '∞'}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación borrado — macOS alert */}
      {confirmDelete && (
      <Portal>
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden animate-slide-up">
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#FEF2F2' }}>
                <AlertTriangle size={22} style={{ color: '#EF5350' }} />
              </div>
              <h3 className="text-base font-semibold text-[#1d1d1f]">Eliminar usuario</h3>
              <p className="text-sm text-[#86868b] mt-1">
                ¿Eliminar a <span className="font-semibold text-[#3d3d3f]">{confirmDelete.nombre || confirmDelete.email}</span>? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="border-t border-slate-100 grid grid-cols-2">
              <button onClick={() => setConfirmDelete(null)}
                className="px-4 py-3.5 text-sm font-medium text-[#1e5fa8] hover:bg-slate-50 transition-colors border-r border-slate-100">
                Cancelar
              </button>
              <button onClick={confirmarEliminar}
                className="px-4 py-3.5 text-sm font-semibold transition-colors hover:bg-red-50"
                style={{ color: '#EF5350' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </Portal>
      )}

      {/* Lista de usuarios */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">Usuarios registrados</p>
        </div>
        <div className="divide-y divide-slate-100">
          {usuarios.map(u => {
            const esMedico = isMedico({ role: u.role })
            return (
              <div key={u.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${esMedico ? 'bg-blue-50' : 'bg-violet-50'}`}>
                    {esMedico
                      ? <Shield size={15} className="text-[#1e5fa8]" />
                      : <UserCheck size={15} className="text-violet-600" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1d1d1f]">{u.nombre || 'Sin nombre'}</p>
                    <p className="text-[11px] text-[#86868b]">{u.email}</p>
                    <p className="text-[10px] text-[#86868b] capitalize mt-0.5">{u.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {u.id === profile?.id && (
                    <span className="text-[10px] font-semibold text-[#86868b] bg-slate-100 px-2 py-1 rounded-full">Tú</span>
                  )}
                  {u.id !== profile?.id && (
                    <button onClick={() => eliminarUsuario(u)} title="Eliminar usuario"
                      className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors"
                      style={{ color: '#EF5350' }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
