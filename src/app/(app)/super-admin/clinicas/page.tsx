'use client'

import { useState, useEffect, useRef } from 'react'
import { Building2, Plus, Pencil, Check, X, Loader2, Palette, Upload, ImageIcon, UserCircle, Stethoscope, Trash2, AlertTriangle } from 'lucide-react'
import { useProfile } from '@/hooks/useProfile'
import { useRouter } from 'next/navigation'

type Clinica = {
  id: string
  nombre: string
  tipo: 'clinica' | 'independiente'
  nombre_display: string | null
  subtitulo: string | null
  color_primario: string | null
  color_secundario: string | null
  logo_url: string | null
  max_medicos: number | null
  max_secretarias: number | null
  count_medicos: number
  count_secretarias: number
  admin: { id: string; nombre: string; email: string | null } | null
}

export default function SuperAdminClinicasPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const router = useRouter()
  const [clinicas, setClinicas] = useState<Clinica[]>([])
  const [loading, setLoading] = useState(true)

  // Modal nueva clínica
  const [showFormClinica, setShowFormClinica] = useState(false)
  const [formClinica, setFormClinica] = useState({ nombre: '', max_medicos: '', max_secretarias: '', adminNombre: '', adminEmail: '', adminPassword: '' })

  // Modal asignar admin a clínica existente
  const [modalAdmin, setModalAdmin] = useState<Clinica | null>(null)
  const [formAdmin, setFormAdmin] = useState({ nombre: '', email: '', password: '' })
  const [guardandoAdmin, setGuardandoAdmin] = useState(false)
  const [errorAdmin, setErrorAdmin] = useState('')

  // Modal nuevo usuario independiente
  const [showFormIndep, setShowFormIndep] = useState(false)
  const [formIndep, setFormIndep] = useState({
    nombre: '', email: '', password: '', titulo: 'Dr.', especialidad: '', cedula_profesional: '',
  })

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Modal eliminar usuario independiente
  const [confirmDeleteIndep, setConfirmDeleteIndep] = useState<Clinica | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState('')

  // Edición de límites inline
  const [editandoLimites, setEditandoLimites] = useState<string | null>(null)
  const [editLimitesForm, setEditLimitesForm] = useState<Record<string, { max_medicos: string; max_secretarias: string }>>({})

  // Modal personalización
  const [personalizando, setPersonalizando] = useState<Clinica | null>(null)
  const [persForm, setPersForm] = useState({
    nombre_display: '',
    subtitulo: '',
    color_primario: '#1a3a5c',
    color_secundario: '#1e5fa8',
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [guardandoPers, setGuardandoPers] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loadingProfile && profile && profile.role !== 'super_admin') {
      router.push('/dashboard')
    }
  }, [profile, loadingProfile, router])

  useEffect(() => {
    if (!loadingProfile && profile?.role === 'super_admin') cargarClinicas()
  }, [profile, loadingProfile])

  async function cargarClinicas() {
    try {
      const res = await fetch('/api/super-admin/clinicas')
      const data = await res.json()
      setClinicas(data.clinicas || [])
    } catch {
      // Error de red — mostrar lista vacía
    } finally {
      setLoading(false)
    }
  }

  async function crearClinica(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    const res = await fetch('/api/super-admin/clinicas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: formClinica.nombre,
        max_medicos: formClinica.max_medicos ? parseInt(formClinica.max_medicos) : null,
        max_secretarias: formClinica.max_secretarias ? parseInt(formClinica.max_secretarias) : null,
        adminNombre: formClinica.adminNombre || undefined,
        adminEmail: formClinica.adminEmail || undefined,
        adminPassword: formClinica.adminPassword || undefined,
      }),
    })
    const data = await res.json()
    setGuardando(false)
    if (!res.ok) { setError(data.error || 'Error al crear clínica'); return }
    setFormClinica({ nombre: '', max_medicos: '', max_secretarias: '', adminNombre: '', adminEmail: '', adminPassword: '' })
    setShowFormClinica(false)
    cargarClinicas()
  }

  async function crearUsuarioIndependiente(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    const res = await fetch('/api/super-admin/usuarios-independientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formIndep),
    })
    const data = await res.json()
    setGuardando(false)
    if (!res.ok) { setError(data.error || 'Error al crear usuario'); return }
    setFormIndep({ nombre: '', email: '', password: '', titulo: 'Dr.', especialidad: '', cedula_profesional: '' })
    setShowFormIndep(false)
    cargarClinicas()
  }

  async function asignarAdmin(e: React.FormEvent) {
    e.preventDefault()
    if (!modalAdmin) return
    setGuardandoAdmin(true)
    setErrorAdmin('')
    const res = await fetch(`/api/super-admin/clinicas/${modalAdmin.id}/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formAdmin),
    })
    const data = await res.json()
    setGuardandoAdmin(false)
    if (!res.ok) { setErrorAdmin(data.error || 'Error al crear admin'); return }
    setModalAdmin(null)
    setFormAdmin({ nombre: '', email: '', password: '' })
    cargarClinicas()
  }

  async function actualizarLimites(id: string) {
    const ef = editLimitesForm[id]
    if (!ef) return
    setGuardando(true)
    await fetch('/api/super-admin/clinicas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        max_medicos: ef.max_medicos ? parseInt(ef.max_medicos) : null,
        max_secretarias: ef.max_secretarias ? parseInt(ef.max_secretarias) : null,
      }),
    })
    setGuardando(false)
    setEditandoLimites(null)
    cargarClinicas()
  }

  function abrirPersonalizacion(c: Clinica) {
    setPersonalizando(c)
    setPersForm({
      nombre_display: c.nombre_display ?? '',
      subtitulo: c.subtitulo ?? '',
      color_primario: c.color_primario ?? '#1a3a5c',
      color_secundario: c.color_secundario ?? '#1e5fa8',
    })
    setLogoFile(null)
    setLogoPreview(c.logo_url)
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function guardarPersonalizacion() {
    if (!personalizando) return
    setGuardandoPers(true)

    if (logoFile) {
      const fd = new FormData()
      fd.append('file', logoFile)
      fd.append('clinicaId', personalizando.id)
      await fetch('/api/super-admin/clinicas/logo', { method: 'POST', body: fd })
    }

    await fetch('/api/super-admin/clinicas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: personalizando.id,
        nombre_display: persForm.nombre_display || null,
        subtitulo: persForm.subtitulo || null,
        color_primario: persForm.color_primario,
        color_secundario: persForm.color_secundario,
      }),
    })

    setGuardandoPers(false)
    setPersonalizando(null)
    cargarClinicas()
  }

  async function eliminarUsuarioIndependiente() {
    if (!confirmDeleteIndep) return
    setEliminando(true)
    setErrorEliminar('')

    const res = await fetch('/api/super-admin/usuarios-independientes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicaId: confirmDeleteIndep.id }),
    })
    const data = await res.json()
    setEliminando(false)

    if (!res.ok) {
      setErrorEliminar(data.error || 'Error al eliminar')
      return
    }

    setConfirmDeleteIndep(null)
    cargarClinicas()
  }

  if (loadingProfile || loading) return <div className="text-center py-12 text-slate-400">Cargando...</div>

  const listaClinicas = clinicas.filter(c => c.tipo !== 'independiente')
  const listaIndep = clinicas.filter(c => c.tipo === 'independiente')

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* ── Modal nueva clínica ── */}
      {showFormClinica && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><Building2 size={18} /> Nueva clínica</h2>
              <button onClick={() => setShowFormClinica(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={crearClinica} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Nombre de la clínica</label>
                <input type="text" value={formClinica.nombre} onChange={e => setFormClinica({ ...formClinica, nombre: e.target.value })}
                  placeholder="Ej: Clínica Ortointegra Norte" required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Máx. médicos</label>
                  <input type="number" min="0" value={formClinica.max_medicos} onChange={e => setFormClinica({ ...formClinica, max_medicos: e.target.value })}
                    placeholder="Sin límite"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Máx. asistentes</label>
                  <input type="number" min="0" value={formClinica.max_secretarias} onChange={e => setFormClinica({ ...formClinica, max_secretarias: e.target.value })}
                    placeholder="Sin límite"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                </div>
              </div>
              {/* Sección admin */}
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                  Administrador de clínica
                  <span className="font-normal text-slate-400">(opcional — máx. 1 por clínica)</span>
                </p>
                <div className="space-y-2">
                  <input type="text" placeholder="Nombre del admin"
                    value={formClinica.adminNombre} onChange={e => setFormClinica({ ...formClinica, adminNombre: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                  <input type="email" placeholder="Email"
                    value={formClinica.adminEmail} onChange={e => setFormClinica({ ...formClinica, adminEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                  <input type="password" placeholder="Contraseña (mín. 8 caracteres)"
                    value={formClinica.adminPassword} onChange={e => setFormClinica({ ...formClinica, adminPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowFormClinica(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={guardando}
                  className="flex-1 py-2.5 bg-[#1e5fa8] text-white rounded-xl text-sm font-medium hover:bg-[#1a3a5c] disabled:opacity-60 flex items-center justify-center gap-2">
                  {guardando ? <><Loader2 size={14} className="animate-spin" /> Creando...</> : 'Crear clínica'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal nuevo usuario independiente ── */}
      {showFormIndep && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><UserCircle size={18} /> Nuevo usuario independiente</h2>
              <button onClick={() => { setShowFormIndep(false); setError('') }} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={crearUsuarioIndependiente} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Título</label>
                  <select value={formIndep.titulo} onChange={e => setFormIndep({ ...formIndep, titulo: e.target.value })}
                    className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 bg-white">
                    <option>Dr.</option>
                    <option>Dra.</option>
                    <option>Lic.</option>
                    <option>Mtro.</option>
                    <option>Mtra.</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-500 block mb-1">Nombre completo</label>
                  <input type="text" value={formIndep.nombre} onChange={e => setFormIndep({ ...formIndep, nombre: e.target.value })}
                    placeholder="Nombre Apellidos" required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Especialidad</label>
                <input type="text" value={formIndep.especialidad} onChange={e => setFormIndep({ ...formIndep, especialidad: e.target.value })}
                  placeholder="Ej: Traumatología y Ortopedia"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Cédula profesional</label>
                <input type="text" value={formIndep.cedula_profesional} onChange={e => setFormIndep({ ...formIndep, cedula_profesional: e.target.value })}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
              </div>
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-medium text-slate-500 mb-2">Credenciales de acceso</p>
                <div className="space-y-2">
                  <input type="email" value={formIndep.email} onChange={e => setFormIndep({ ...formIndep, email: e.target.value })}
                    placeholder="correo@ejemplo.com" required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                  <input type="password" value={formIndep.password} onChange={e => setFormIndep({ ...formIndep, password: e.target.value })}
                    placeholder="Contraseña temporal" required minLength={8}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowFormIndep(false); setError('') }}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={guardando}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2">
                  {guardando ? <><Loader2 size={14} className="animate-spin" /> Creando...</> : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal asignar admin ── */}
      {modalAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-slate-800">Asignar administrador</h2>
                <p className="text-xs text-slate-400 mt-0.5">{modalAdmin.nombre_display || modalAdmin.nombre}</p>
              </div>
              <button onClick={() => { setModalAdmin(null); setErrorAdmin('') }} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <form onSubmit={asignarAdmin} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Nombre completo</label>
                <input type="text" required value={formAdmin.nombre} onChange={e => setFormAdmin({ ...formAdmin, nombre: e.target.value })}
                  placeholder="Nombre del administrador"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Email</label>
                <input type="email" required value={formAdmin.email} onChange={e => setFormAdmin({ ...formAdmin, email: e.target.value })}
                  placeholder="admin@ejemplo.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Contraseña temporal</label>
                <input type="password" required minLength={8} value={formAdmin.password} onChange={e => setFormAdmin({ ...formAdmin, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
              </div>
              {errorAdmin && <p className="text-sm text-red-600">{errorAdmin}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setModalAdmin(null); setErrorAdmin('') }}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={guardandoAdmin}
                  className="flex-1 py-2.5 bg-[#1e5fa8] text-white rounded-xl text-sm font-medium hover:bg-[#1a3a5c] disabled:opacity-60 flex items-center justify-center gap-2">
                  {guardandoAdmin ? <><Loader2 size={14} className="animate-spin" /> Creando...</> : 'Crear admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal personalización ── */}
      {personalizando && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Palette size={18} />
                {personalizando.tipo === 'independiente' ? 'Personalizar cuenta' : 'Personalizar clínica'}
              </h2>
              <button onClick={() => setPersonalizando(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              {/* Logo */}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-2">Logo</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                    {logoPreview
                      ? <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
                      : <ImageIcon size={24} className="text-slate-300" />
                    }
                  </div>
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                    <Upload size={14} /> Subir imagen
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </div>
                <p className="text-xs text-slate-400 mt-1">PNG o JPG, fondo transparente recomendado</p>
              </div>

              {/* Nombre display */}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">
                  {personalizando.tipo === 'independiente' ? 'Nombre a mostrar' : 'Nombre debajo del logo'}
                </label>
                <input type="text" value={persForm.nombre_display}
                  onChange={e => setPersForm({ ...persForm, nombre_display: e.target.value })}
                  placeholder={personalizando.nombre}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
              </div>

              {/* Subtítulo */}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Subtítulo</label>
                <input type="text" value={persForm.subtitulo}
                  onChange={e => setPersForm({ ...persForm, subtitulo: e.target.value })}
                  placeholder={personalizando.tipo === 'independiente' ? 'Ej: Traumatología · Ortopedia' : 'Ej: Especialidad · Subespecialidad'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
              </div>

              {/* Colores */}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-2">Colores</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Color principal (sidebar)</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={persForm.color_primario}
                        onChange={e => setPersForm({ ...persForm, color_primario: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer border border-slate-200 p-0.5 bg-white" />
                      <span className="text-xs text-slate-500 font-mono">{persForm.color_primario}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Color secundario (activo)</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={persForm.color_secundario}
                        onChange={e => setPersForm({ ...persForm, color_secundario: e.target.value })}
                        className="w-10 h-10 rounded cursor-pointer border border-slate-200 p-0.5 bg-white" />
                      <span className="text-xs text-slate-500 font-mono">{persForm.color_secundario}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-2">Vista previa del sidebar</label>
                <div className="rounded-xl overflow-hidden shadow-md w-44" style={{ backgroundColor: persForm.color_primario }}>
                  <div className="flex flex-col items-center gap-2 px-4 py-4 border-b border-white/10">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center overflow-hidden">
                      {logoPreview
                        ? <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                        : <ImageIcon size={16} className="text-slate-300" />
                      }
                    </div>
                    <p className="text-white text-xs font-semibold text-center leading-tight">
                      {persForm.nombre_display || personalizando.nombre}
                    </p>
                    <p className="text-blue-300 text-[10px] text-center leading-tight">
                      {persForm.subtitulo || 'Subtítulo'}
                    </p>
                  </div>
                  <div className="px-2 py-2 space-y-1">
                    {['Inicio', 'Expediente', 'Laboratorios'].map((item, i) => (
                      <div key={item} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                        style={i === 0 ? { backgroundColor: persForm.color_secundario, color: 'white' } : { color: 'rgb(147 197 253)' }}>
                        <div className="w-2 h-2 rounded-full bg-current opacity-60" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setPersonalizando(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={guardarPersonalizacion} disabled={guardandoPers}
                className="flex-1 py-2.5 bg-[#1e5fa8] text-white rounded-xl text-sm font-medium hover:bg-[#1a3a5c] disabled:opacity-60 flex items-center justify-center gap-2">
                {guardandoPers ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal eliminar usuario independiente ── */}
      {confirmDeleteIndep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800 text-lg">¿Eliminar usuario independiente?</h2>
                <p className="text-sm text-slate-500">{confirmDeleteIndep.nombre_display || confirmDeleteIndep.nombre}</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 space-y-1">
              <p className="font-semibold">Esta acción es irreversible.</p>
              <p>Se eliminarán permanentemente todos los datos de esta cuenta:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-red-600">
                <li>Todos los pacientes registrados</li>
                <li>Notas médicas y consultas</li>
                <li>Resultados de laboratorio</li>
                <li>Recetas y documentos</li>
                <li>Cuenta de acceso (email y contraseña)</li>
              </ul>
            </div>

            {errorEliminar && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errorEliminar}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setConfirmDeleteIndep(null); setErrorEliminar('') }}
                disabled={eliminando}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={eliminarUsuarioIndependiente}
                disabled={eliminando}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {eliminando
                  ? <><Loader2 size={15} className="animate-spin" /> Eliminando...</>
                  : <><Trash2 size={15} /> Sí, eliminar definitivamente</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sección: Clínicas ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1a3a5c] flex items-center gap-2">
              <Building2 size={24} /> Clínicas
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">Cuentas multi-usuario con equipo médico</p>
          </div>
          <button
            onClick={() => { setShowFormClinica(true); setError('') }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1e5fa8] text-white rounded-lg text-sm font-medium hover:bg-[#1a3a5c] transition-colors"
          >
            <Plus size={16} /> Nueva clínica
          </button>
        </div>

        <div className="space-y-3">
          {listaClinicas.map(c => (
            <TarjetaCuenta key={c.id} c={c}
              editandoLimites={editandoLimites}
              editLimitesForm={editLimitesForm}
              guardando={guardando}
              onEditar={() => {
                setEditandoLimites(c.id)
                setEditLimitesForm(prev => ({ ...prev, [c.id]: { max_medicos: c.max_medicos?.toString() ?? '', max_secretarias: c.max_secretarias?.toString() ?? '' } }))
              }}
              onCancelarEditar={() => setEditandoLimites(null)}
              onGuardarLimites={() => actualizarLimites(c.id)}
              onChangeLimites={(field, val) => setEditLimitesForm(prev => ({ ...prev, [c.id]: { ...prev[c.id], [field]: val } }))}
              onPersonalizar={() => abrirPersonalizacion(c)}
              onAsignarAdmin={!c.admin ? () => { setModalAdmin(c); setFormAdmin({ nombre: '', email: '', password: '' }); setErrorAdmin('') } : undefined}
            />
          ))}
          {listaClinicas.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">No hay clínicas registradas</div>
          )}
        </div>
      </div>

      {/* ── Sección: Usuarios independientes ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">
              <UserCircle size={22} /> Usuarios independientes
            </h2>
            <p className="text-slate-500 text-sm mt-0.5">Médicos en práctica individual sin equipo</p>
          </div>
          <button
            onClick={() => { setShowFormIndep(true); setError('') }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus size={16} /> Nuevo usuario
          </button>
        </div>

        <div className="space-y-3">
          {listaIndep.map(c => (
            <TarjetaCuenta key={c.id} c={c}
              editandoLimites={editandoLimites}
              editLimitesForm={editLimitesForm}
              guardando={guardando}
              onEditar={() => {}}
              onCancelarEditar={() => setEditandoLimites(null)}
              onGuardarLimites={() => {}}
              onChangeLimites={() => {}}
              onPersonalizar={() => abrirPersonalizacion(c)}
              onEliminar={() => { setConfirmDeleteIndep(c); setErrorEliminar('') }}
            />
          ))}
          {listaIndep.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">No hay usuarios independientes registrados</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Componente tarjeta reutilizable ──────────────────────────────────────────
function TarjetaCuenta({
  c, editandoLimites, editLimitesForm, guardando,
  onEditar, onCancelarEditar, onGuardarLimites, onChangeLimites, onPersonalizar, onEliminar, onAsignarAdmin,
}: {
  c: Clinica
  editandoLimites: string | null
  editLimitesForm: Record<string, { max_medicos: string; max_secretarias: string }>
  guardando: boolean
  onEditar: () => void
  onCancelarEditar: () => void
  onGuardarLimites: () => void
  onChangeLimites: (field: string, val: string) => void
  onPersonalizar: () => void
  onEliminar?: () => void
  onAsignarAdmin?: () => void
}) {
  const esIndep = c.tipo === 'independiente'

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4">
        {/* Encabezado */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {c.logo_url ? (
              <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200">
                <img src={c.logo_url} alt="Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: c.color_primario ?? '#1a3a5c' }}>
                {esIndep
                  ? <Stethoscope size={18} className="text-white" />
                  : <Building2 size={18} className="text-white" />
                }
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-800">{c.nombre_display || c.nombre}</h2>
                {esIndep && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    Independiente
                  </span>
                )}
              </div>
              {c.subtitulo && <p className="text-xs text-slate-400">{c.subtitulo}</p>}
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={onPersonalizar}
              className="text-slate-400 hover:text-violet-600 p-1.5 hover:bg-violet-50 rounded-lg transition-colors"
              title="Personalizar">
              <Palette size={15} />
            </button>
            {esIndep && onEliminar && (
              <button onClick={onEliminar}
                className="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar usuario">
                <Trash2 size={15} />
              </button>
            )}
            {!esIndep && (
              editandoLimites !== c.id ? (
                <button onClick={onEditar}
                  className="text-slate-400 hover:text-[#1e5fa8] p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Editar límites">
                  <Pencil size={15} />
                </button>
              ) : (
                <>
                  <button onClick={onGuardarLimites} disabled={guardando}
                    className="text-emerald-600 hover:text-emerald-700 p-1.5 hover:bg-emerald-50 rounded-lg transition-colors">
                    <Check size={15} />
                  </button>
                  <button onClick={onCancelarEditar}
                    className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-lg transition-colors">
                    <X size={15} />
                  </button>
                </>
              )
            )}
          </div>
        </div>

        {/* Colores */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: c.color_primario ?? '#1a3a5c' }} />
          <div className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: c.color_secundario ?? '#1e5fa8' }} />
          <span className="text-xs text-slate-400">{c.color_primario ?? '#1a3a5c'} · {c.color_secundario ?? '#1e5fa8'}</span>
        </div>

        {/* Contadores — solo para clínicas */}
        {!esIndep && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-blue-50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-blue-500 font-medium mb-1">Médicos</p>
                {editandoLimites === c.id ? (
                  <input type="number" min="0"
                    value={editLimitesForm[c.id]?.max_medicos ?? ''}
                    onChange={e => onChangeLimites('max_medicos', e.target.value)}
                    placeholder="Sin límite"
                    className="w-full px-2 py-1 border border-blue-200 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-300" />
                ) : (
                  <p className="text-sm font-semibold text-blue-700">
                    {c.count_medicos} <span className="text-blue-400 font-normal">/ {c.max_medicos ?? '∞'}</span>
                  </p>
                )}
              </div>
              <div className="bg-violet-50 rounded-lg px-3 py-2.5">
                <p className="text-xs text-violet-500 font-medium mb-1">Asistentes</p>
                {editandoLimites === c.id ? (
                  <input type="number" min="0"
                    value={editLimitesForm[c.id]?.max_secretarias ?? ''}
                    onChange={e => onChangeLimites('max_secretarias', e.target.value)}
                    placeholder="Sin límite"
                    className="w-full px-2 py-1 border border-violet-200 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-violet-300" />
                ) : (
                  <p className="text-sm font-semibold text-violet-700">
                    {c.count_secretarias} <span className="text-violet-400 font-normal">/ {c.max_secretarias ?? '∞'}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Admin */}
            <div className="bg-slate-50 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500 font-medium mb-0.5">Administrador</p>
                {c.admin ? (
                  <p className="text-sm font-semibold text-slate-700">
                    {c.admin.nombre}
                    {c.admin.email && <span className="font-normal text-slate-400 ml-1.5 text-xs">{c.admin.email}</span>}
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 font-medium">Sin administrador asignado</p>
                )}
              </div>
              {!c.admin && onAsignarAdmin && (
                <button onClick={onAsignarAdmin}
                  className="text-xs font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a3a5c] px-3 py-1.5 rounded-lg transition-colors shrink-0">
                  + Asignar admin
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
