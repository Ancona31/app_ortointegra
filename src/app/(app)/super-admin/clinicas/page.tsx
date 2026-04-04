'use client'

import { useState, useEffect, useRef } from 'react'
import { Building2, Plus, Pencil, Check, X, Loader2, Palette, Upload, ImageIcon, UserCircle, Stethoscope, Trash2, AlertTriangle, PauseCircle, PlayCircle, ChevronDown, ChevronUp, ShieldOff } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import { useProfile } from '@/hooks/useProfile'
import { useRouter } from 'next/navigation'

type UsuarioClinica = { id: string; nombre: string; role: string; email: string | null }

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
  suspendida: boolean
  admin: { id: string; nombre: string; email: string | null } | null
  usuarios: UsuarioClinica[]
}

export default function SuperAdminClinicasPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const router = useRouter()
  const [clinicas, setClinicas] = useState<Clinica[]>([])
  const [loading, setLoading] = useState(true)

  // Modal nueva cuenta — paso 1: selector de tipo
  const [showSelector, setShowSelector]       = useState(false)

  // Modal nueva clínica — paso 2a
  const [showFormClinica, setShowFormClinica] = useState(false)
  const [formClinica, setFormClinica] = useState({ nombre: '', max_medicos: '', max_secretarias: '', adminNombre: '', adminEmail: '', adminPassword: '' })

  // Modal asignar admin a clínica existente
  const [modalAdmin, setModalAdmin] = useState<Clinica | null>(null)
  const [formAdmin, setFormAdmin] = useState({ nombre: '', email: '', password: '' })
  const [guardandoAdmin, setGuardandoAdmin] = useState(false)
  const [errorAdmin, setErrorAdmin] = useState('')

  // Modal nuevo usuario independiente — paso 2b
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

  // Modal eliminar usuario de clínica
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<{ user: UsuarioClinica; clinicaNombre: string } | null>(null)
  const [eliminandoUser, setEliminandoUser] = useState(false)
  const [errorEliminarUser, setErrorEliminarUser] = useState('')

  // Modal suspender / reactivar clínica
  const [confirmSuspender, setConfirmSuspender] = useState<Clinica | null>(null)
  const [suspendiendo, setSuspendiendo] = useState(false)

  // Modal upgrade cuenta independiente → clínica
  const [modalUpgrade, setModalUpgrade] = useState<Clinica | null>(null)
  const [upgradeForm, setUpgradeForm]   = useState({ max_medicos: '3', max_secretarias: '1' })
  const [upgradando,  setUpgradando]    = useState(false)
  const [errorUpgrade, setErrorUpgrade] = useState('')

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

  async function eliminarUsuarioClinica() {
    if (!confirmDeleteUser) return
    setEliminandoUser(true)
    setErrorEliminarUser('')
    const res = await fetch('/api/super-admin/clinicas/usuarios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: confirmDeleteUser.user.id }),
    })
    const data = await res.json()
    setEliminandoUser(false)
    if (!res.ok) { setErrorEliminarUser(data.error || 'Error al eliminar'); return }
    setConfirmDeleteUser(null)
    cargarClinicas()
  }

  async function ejecutarUpgrade() {
    if (!modalUpgrade) return
    setUpgradando(true)
    setErrorUpgrade('')
    const res = await fetch('/api/super-admin/clinicas/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicaId:       modalUpgrade.id,
        max_medicos:     parseInt(upgradeForm.max_medicos)     || 3,
        max_secretarias: parseInt(upgradeForm.max_secretarias) || 1,
        max_pacientes:   null,
      }),
    })
    const data = await res.json()
    setUpgradando(false)
    if (!res.ok) { setErrorUpgrade(data.error || 'Error al actualizar'); return }
    setModalUpgrade(null)
    cargarClinicas()
  }

  async function toggleSuspender() {
    if (!confirmSuspender) return
    setSuspendiendo(true)
    await fetch('/api/super-admin/clinicas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: confirmSuspender.id, suspendida: !confirmSuspender.suspendida }),
    })
    setSuspendiendo(false)
    setConfirmSuspender(null)
    cargarClinicas()
  }

  if (loadingProfile || loading) return <div className="text-center py-12 text-slate-400">Cargando...</div>

  const listaClinicas = clinicas.filter(c => c.tipo !== 'independiente')
  const listaIndep = clinicas.filter(c => c.tipo === 'independiente')

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-slide-up">

      {/* ── Modal selector de tipo de cuenta ── */}
      {showSelector && (
        <Portal><div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-[#1d1d1f]">Nueva cuenta</h2>
              <button onClick={() => setShowSelector(false)} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-[#86868b] transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="px-5 py-5 space-y-3">
              <p className="text-xs text-[#86868b]">Elige el punto de partida — cualquier cuenta puede escalar después</p>
              {/* Opción: Clínica */}
              <button
                onClick={() => { setShowSelector(false); setShowFormClinica(true); setError('') }}
                className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-[#1e5fa8] hover:bg-blue-50 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
                  <Building2 size={20} className="text-[#1e5fa8]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1d1d1f]">Cuenta de clínica</p>
                  <p className="text-xs text-[#86868b] mt-0.5">Equipo médico con múltiples doctores y asistentes. Requiere administrador.</p>
                </div>
              </button>
              {/* Opción: Cuenta básica */}
              <button
                onClick={() => { setShowSelector(false); setShowFormIndep(true); setError('') }}
                className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center shrink-0 transition-colors">
                  <UserCircle size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1d1d1f]">Cuenta básica</p>
                  <p className="text-xs text-[#86868b] mt-0.5">Un solo médico, configuración rápida. Puede escalar a clínica en cualquier momento.</p>
                </div>
              </button>
            </div>
          </div>
        </div></Portal>
      )}

      {/* ── Modal nueva clínica ── */}
      {showFormClinica && (
        <Portal><div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-[#1d1d1f]">Nueva clínica</h2>
              <button onClick={() => setShowFormClinica(false)} className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-[#86868b] transition-colors"><X size={14} /></button>
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
              {/* Sección admin — requerida */}
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-[#1e5fa8] mb-2 flex items-center gap-1.5">
                  Administrador <span className="text-red-400">*</span>
                  <span className="font-normal text-slate-400 ml-0.5">— también tiene acceso médico</span>
                </p>
                <div className="space-y-2">
                  <input type="text" placeholder="Nombre completo" required
                    value={formClinica.adminNombre} onChange={e => setFormClinica({ ...formClinica, adminNombre: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                  <input type="email" placeholder="Correo electrónico" required
                    value={formClinica.adminEmail} onChange={e => setFormClinica({ ...formClinica, adminEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                  <input type="password" placeholder="Contraseña (mín. 8 caracteres)" required minLength={8}
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
        </div></Portal>
      )}

      {/* ── Modal nuevo usuario independiente ── */}
      {showFormIndep && (
        <Portal><div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-sm flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <UserCircle size={15} className="text-emerald-600" />
                </div>
                <h2 className="text-sm font-semibold text-[#1d1d1f]">Nuevo usuario independiente</h2>
              </div>
              <button onClick={() => { setShowFormIndep(false); setError('') }}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-[#86868b] transition-colors">
                <X size={14} />
              </button>
            </div>
            <form onSubmit={crearUsuarioIndependiente} className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Título</label>
                  <select value={formIndep.titulo} onChange={e => setFormIndep({ ...formIndep, titulo: e.target.value })}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:bg-white transition-all">
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:bg-white transition-all" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Especialidad</label>
                <input type="text" value={formIndep.especialidad} onChange={e => setFormIndep({ ...formIndep, especialidad: e.target.value })}
                  placeholder="Ej: Traumatología y Ortopedia"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:bg-white transition-all" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Cédula profesional</label>
                <input type="text" value={formIndep.cedula_profesional} onChange={e => setFormIndep({ ...formIndep, cedula_profesional: e.target.value })}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:bg-white transition-all" />
              </div>
              <div className="border-t border-slate-100 pt-3">
                <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">Credenciales de acceso</p>
                <div className="space-y-2">
                  <input type="email" value={formIndep.email} onChange={e => setFormIndep({ ...formIndep, email: e.target.value })}
                    placeholder="correo@ejemplo.com" required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:bg-white transition-all" />
                  <input type="password" value={formIndep.password} onChange={e => setFormIndep({ ...formIndep, password: e.target.value })}
                    placeholder="Contraseña temporal" required minLength={8}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:bg-white transition-all" />
                </div>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-3 pt-1 pb-1">
                <button type="button" onClick={() => { setShowFormIndep(false); setError('') }}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={guardando}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                  {guardando ? <><Loader2 size={14} className="animate-spin" /> Creando...</> : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div></Portal>
      )}

      {/* ── Modal asignar admin ── */}
      {modalAdmin && (
        <Portal><div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-sm flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-semibold text-[#1d1d1f]">Asignar administrador</h2>
                <p className="text-xs text-[#86868b] mt-0.5">{modalAdmin.nombre_display || modalAdmin.nombre}</p>
              </div>
              <button onClick={() => { setModalAdmin(null); setErrorAdmin('') }}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-[#86868b] transition-colors">
                <X size={14} />
              </button>
            </div>
            <form onSubmit={asignarAdmin} className="px-5 py-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Nombre completo</label>
                <input type="text" required value={formAdmin.nombre} onChange={e => setFormAdmin({ ...formAdmin, nombre: e.target.value })}
                  placeholder="Nombre del administrador"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:bg-white transition-all" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Email</label>
                <input type="email" required value={formAdmin.email} onChange={e => setFormAdmin({ ...formAdmin, email: e.target.value })}
                  placeholder="admin@ejemplo.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:bg-white transition-all" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Contraseña temporal</label>
                <input type="password" required minLength={8} value={formAdmin.password} onChange={e => setFormAdmin({ ...formAdmin, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:bg-white transition-all" />
              </div>
              {errorAdmin && <p className="text-xs text-red-500">{errorAdmin}</p>}
              <div className="flex gap-3 pt-1 pb-1">
                <button type="button" onClick={() => { setModalAdmin(null); setErrorAdmin('') }}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={guardandoAdmin}
                  className="flex-1 py-2.5 bg-[#1e5fa8] text-white rounded-xl text-sm font-medium hover:bg-[#1a3a5c] disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                  {guardandoAdmin ? <><Loader2 size={14} className="animate-spin" /> Creando...</> : 'Crear admin'}
                </button>
              </div>
            </form>
          </div>
        </div></Portal>
      )}

      {/* ── Modal personalización ── */}
      {personalizando && (
        <Portal><div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <Palette size={14} className="text-indigo-600" />
                </div>
                <h2 className="text-sm font-semibold text-[#1d1d1f]">
                  {personalizando.tipo === 'independiente' ? 'Personalizar cuenta' : 'Personalizar clínica'}
                </h2>
              </div>
              <button onClick={() => setPersonalizando(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-[#86868b] transition-colors">
                <X size={14} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
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
                    className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-white transition-all">
                    <Upload size={14} /> Subir imagen
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </div>
                <p className="text-xs text-[#86868b] mt-1">PNG o JPG, fondo transparente recomendado</p>
              </div>

              {/* Nombre display */}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">
                  {personalizando.tipo === 'independiente' ? 'Nombre a mostrar' : 'Nombre debajo del logo'}
                </label>
                <input type="text" value={persForm.nombre_display}
                  onChange={e => setPersForm({ ...persForm, nombre_display: e.target.value })}
                  placeholder={personalizando.nombre}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:bg-white transition-all" />
              </div>

              {/* Subtítulo */}
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Subtítulo</label>
                <input type="text" value={persForm.subtitulo}
                  onChange={e => setPersForm({ ...persForm, subtitulo: e.target.value })}
                  placeholder={personalizando.tipo === 'independiente' ? 'Ej: Traumatología · Ortopedia' : 'Ej: Especialidad · Subespecialidad'}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:bg-white transition-all" />
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

            <div className="px-5 py-3 border-t border-slate-100 flex gap-3">
              <button onClick={() => setPersonalizando(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={guardarPersonalizacion} disabled={guardandoPers}
                className="flex-1 py-2.5 bg-[#1e5fa8] text-white rounded-xl text-sm font-medium hover:bg-[#1a3a5c] disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                {guardandoPers ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div></Portal>
      )}

      {/* ── Modal eliminar usuario independiente — macOS alert ── */}
      {confirmDeleteIndep && (
        <Portal><div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden animate-slide-up">
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#FEF2F2' }}>
                <AlertTriangle size={22} style={{ color: '#EF5350' }} />
              </div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">Eliminar usuario independiente</h2>
              <p className="text-sm text-[#86868b] mt-1">{confirmDeleteIndep.nombre_display || confirmDeleteIndep.nombre}</p>
              <p className="text-[13px] text-[#3d3d3f] mt-3 leading-relaxed">
                Se eliminarán <span className="font-semibold">permanentemente</span> todos los pacientes, notas, labs y documentos de esta cuenta.
              </p>
              {errorEliminar && (
                <p className="text-xs mt-2" style={{ color: '#EF5350' }}>{errorEliminar}</p>
              )}
            </div>
            <div className="border-t border-slate-100 grid grid-cols-2">
              <button onClick={() => { setConfirmDeleteIndep(null); setErrorEliminar('') }} disabled={eliminando}
                className="px-4 py-3.5 text-sm font-medium text-[#1e5fa8] hover:bg-slate-50 transition-colors disabled:opacity-40 border-r border-slate-100">
                Cancelar
              </button>
              <button onClick={eliminarUsuarioIndependiente} disabled={eliminando}
                className="px-4 py-3.5 text-sm font-semibold transition-colors hover:bg-red-50 flex items-center justify-center gap-1.5 disabled:opacity-40"
                style={{ color: '#EF5350' }}>
                {eliminando ? <><Loader2 size={13} className="animate-spin" /> Eliminando...</> : 'Eliminar'}
              </button>
            </div>
          </div>
        </div></Portal>
      )}

      {/* ── Modal eliminar usuario de clínica ── */}
      {confirmDeleteUser && (
        <Portal><div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden animate-slide-up">
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center bg-red-50">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">Eliminar usuario</h2>
              <p className="text-sm text-[#86868b] mt-1 font-medium">{confirmDeleteUser.user.nombre}</p>
              <p className="text-xs text-[#86868b] mt-0.5">{confirmDeleteUser.clinicaNombre}</p>
              <p className="text-[13px] text-[#3d3d3f] mt-3 leading-relaxed">
                Se eliminará su acceso permanentemente. Sus registros clínicos (notas, expedientes) <span className="font-semibold">no se borran</span> para preservar la trazabilidad.
              </p>
              {errorEliminarUser && <p className="text-xs mt-2 text-red-500">{errorEliminarUser}</p>}
            </div>
            <div className="border-t border-slate-100 grid grid-cols-2">
              <button onClick={() => { setConfirmDeleteUser(null); setErrorEliminarUser('') }} disabled={eliminandoUser}
                className="px-4 py-3.5 text-sm font-medium text-[#1e5fa8] hover:bg-slate-50 transition-colors disabled:opacity-40 border-r border-slate-100">
                Cancelar
              </button>
              <button onClick={eliminarUsuarioClinica} disabled={eliminandoUser}
                className="px-4 py-3.5 text-sm font-semibold text-red-500 hover:bg-red-50 flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors">
                {eliminandoUser ? <><Loader2 size={13} className="animate-spin" /> Eliminando...</> : 'Eliminar'}
              </button>
            </div>
          </div>
        </div></Portal>
      )}

      {/* ── Modal suspender / reactivar clínica ── */}
      {confirmSuspender && (
        <Portal><div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden animate-slide-up">
            <div className="px-6 pt-6 pb-4 text-center">
              <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center ${confirmSuspender.suspendida ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                {confirmSuspender.suspendida
                  ? <PlayCircle size={22} className="text-emerald-500" />
                  : <PauseCircle size={22} className="text-amber-500" />
                }
              </div>
              <h2 className="text-base font-semibold text-[#1d1d1f]">
                {confirmSuspender.suspendida ? 'Reactivar clínica' : 'Suspender clínica'}
              </h2>
              <p className="text-sm text-[#86868b] mt-1 font-medium">{confirmSuspender.nombre_display || confirmSuspender.nombre}</p>
              <p className="text-[13px] text-[#3d3d3f] mt-3 leading-relaxed">
                {confirmSuspender.suspendida
                  ? 'La clínica volverá a estar activa. Sus datos permanecen intactos.'
                  : 'Los datos se conservan íntegramente. Esta acción es reversible en cualquier momento.'
                }
              </p>
            </div>
            <div className="border-t border-slate-100 grid grid-cols-2">
              <button onClick={() => setConfirmSuspender(null)} disabled={suspendiendo}
                className="px-4 py-3.5 text-sm font-medium text-[#1e5fa8] hover:bg-slate-50 transition-colors disabled:opacity-40 border-r border-slate-100">
                Cancelar
              </button>
              <button onClick={toggleSuspender} disabled={suspendiendo}
                className={`px-4 py-3.5 text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors ${confirmSuspender.suspendida ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-600 hover:bg-amber-50'}`}>
                {suspendiendo
                  ? <><Loader2 size={13} className="animate-spin" /> Procesando...</>
                  : confirmSuspender.suspendida ? 'Reactivar' : 'Suspender'
                }
              </button>
            </div>
          </div>
        </div></Portal>
      )}

      {/* ── Modal upgrade: básica → clínica ── */}
      {modalUpgrade && (
        <Portal><div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Building2 size={15} className="text-[#1e5fa8]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[#1d1d1f]">Escalar a clínica</h2>
                  <p className="text-[11px] text-[#86868b]">{modalUpgrade.nombre_display || modalUpgrade.nombre}</p>
                </div>
              </div>
              <button onClick={() => { setModalUpgrade(null); setErrorUpgrade('') }}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-[#86868b] transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-[#86868b] leading-relaxed">
                El médico pasará a ser <strong>administrador</strong> de la clínica. Sus pacientes y expedientes se conservan intactos.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Máx. médicos</label>
                  <input type="number" min="1" value={upgradeForm.max_medicos}
                    onChange={e => setUpgradeForm(f => ({ ...f, max_medicos: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Máx. asistentes</label>
                  <input type="number" min="0" value={upgradeForm.max_secretarias}
                    onChange={e => setUpgradeForm(f => ({ ...f, max_secretarias: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
                </div>
              </div>
              <p className="text-[11px] text-[#86868b]">El límite de pacientes pasa a ser ilimitado automáticamente.</p>
              {errorUpgrade && <p className="text-xs text-red-500">{errorUpgrade}</p>}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex gap-3">
              <button onClick={() => { setModalUpgrade(null); setErrorUpgrade('') }}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={ejecutarUpgrade} disabled={upgradando}
                className="flex-1 py-2.5 bg-[#1e5fa8] text-white rounded-xl text-sm font-semibold hover:bg-[#1a3a5c] disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                {upgradando ? <><Loader2 size={14} className="animate-spin" /> Escalando...</> : 'Confirmar upgrade'}
              </button>
            </div>
          </div>
        </div></Portal>
      )}

      {/* ── Sección: Clínicas ── */}
      <div>
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1">Super Admin</p>
            <h1 className="text-[22px] font-bold tracking-tight text-[#1d1d1f]">Clínicas</h1>
            <p className="text-sm text-[#86868b] mt-0.5">Cuentas multi-usuario con equipo médico</p>
          </div>
          <button
            onClick={() => setShowSelector(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1e5fa8] text-white rounded-lg text-sm font-medium hover:bg-[#1a3a5c] transition-colors"
          >
            <Plus size={16} /> Nueva cuenta
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
              onSuspender={() => setConfirmSuspender(c)}
              onEliminarUsuario={(user) => setConfirmDeleteUser({ user, clinicaNombre: c.nombre_display || c.nombre })}
              onUpgrade={undefined}
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
            onClick={() => setShowSelector(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus size={16} /> Nueva cuenta
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
              onSuspender={() => {}}
              onEliminarUsuario={() => {}}
              onUpgrade={() => { setModalUpgrade(c); setUpgradeForm({ max_medicos: '3', max_secretarias: '1' }); setErrorUpgrade('') }}
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
const ROLE_LABEL: Record<string, string> = {
  admin:      'Admin',
  medico:     'Médico',
  secretaria: 'Asistente',
}

function TarjetaCuenta({
  c, editandoLimites, editLimitesForm, guardando,
  onEditar, onCancelarEditar, onGuardarLimites, onChangeLimites,
  onPersonalizar, onEliminar, onAsignarAdmin, onSuspender, onEliminarUsuario, onUpgrade,
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
  onSuspender: () => void
  onEliminarUsuario: (user: UsuarioClinica) => void
  onUpgrade?: () => void
}) {
  const esIndep = c.tipo === 'independiente'
  const [expandUsuarios, setExpandUsuarios] = useState(false)

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-colors ${c.suspendida ? 'border-amber-200' : 'border-slate-200'}`}>
      {/* Banner de suspensión */}
      {c.suspendida && (
        <div className="flex items-center gap-2 px-5 py-2 bg-amber-50 border-b border-amber-100">
          <ShieldOff size={13} className="text-amber-500 shrink-0" />
          <p className="text-xs font-semibold text-amber-700">Clínica suspendida — los datos están intactos</p>
        </div>
      )}

      {/* Banner sin administrador — clínicas multi-usuario */}
      {!esIndep && !c.admin && (
        <div className="flex items-center justify-between gap-3 px-5 py-2.5 bg-red-50 border-b border-red-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={13} className="text-red-500 shrink-0" />
            <p className="text-xs font-semibold text-red-700">Sin administrador asignado</p>
          </div>
          {onAsignarAdmin && (
            <button onClick={onAsignarAdmin}
              className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded-lg transition-colors shrink-0">
              + Asignar ahora
            </button>
          )}
        </div>
      )}

      <div className="px-5 py-4">
        {/* Encabezado */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {c.logo_url ? (
              <div className={`w-10 h-10 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200 ${c.suspendida ? 'opacity-50 grayscale' : ''}`}>
                <img src={c.logo_url} alt="Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${c.suspendida ? 'opacity-50 grayscale' : ''}`}
                style={{ backgroundColor: c.color_primario ?? '#1a3a5c' }}>
                {esIndep
                  ? <Stethoscope size={18} className="text-white" />
                  : <Building2 size={18} className="text-white" />
                }
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className={`font-semibold ${c.suspendida ? 'text-slate-400' : 'text-slate-800'}`}>
                  {c.nombre_display || c.nombre}
                </h2>
                {esIndep && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    Independiente
                  </span>
                )}
              </div>
              {c.subtitulo && <p className="text-xs text-slate-400">{c.subtitulo}</p>}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-1 shrink-0">
            <button onClick={onPersonalizar}
              className="text-slate-400 hover:text-violet-600 p-1.5 hover:bg-violet-50 rounded-lg transition-colors"
              title="Personalizar">
              <Palette size={15} />
            </button>
            {/* Suspender / Reactivar — solo clínicas */}
            {!esIndep && (
              <button onClick={onSuspender}
                className={`p-1.5 rounded-lg transition-colors ${c.suspendida
                  ? 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'
                  : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                }`}
                title={c.suspendida ? 'Reactivar clínica' : 'Suspender clínica'}>
                {c.suspendida ? <PlayCircle size={15} /> : <PauseCircle size={15} />}
              </button>
            )}
            {/* Eliminar — solo independientes */}
            {esIndep && onEliminar && (
              <button onClick={onEliminar}
                className="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar usuario">
                <Trash2 size={15} />
              </button>
            )}
            {/* Editar límites — solo clínicas */}
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

        {/* Cuenta básica — datos del médico + botón upgrade */}
        {esIndep && c.admin && (
          <div className="space-y-2 mb-3">
            <div className="bg-emerald-50 rounded-lg px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-200 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-emerald-800">
                    {c.admin.nombre.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-900">{c.admin.nombre}</p>
                  {c.admin.email && <p className="text-[11px] text-emerald-600">{c.admin.email}</p>}
                </div>
              </div>
              <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full shrink-0">
                {c.count_medicos}/{c.max_medicos ?? 1} médico
              </span>
            </div>
            {onUpgrade && (
              <button onClick={onUpgrade}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-[#1e5fa8] text-[#1e5fa8] text-xs font-semibold hover:bg-blue-50 transition-colors">
                <Building2 size={13} />
                Escalar a clínica
              </button>
            )}
          </div>
        )}

        {/* Contadores — solo para clínicas multi-usuario */}
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
            {c.admin && (
              <div className="bg-slate-50 rounded-lg px-3 py-2.5 flex items-center gap-3 mb-3">
                <div className="w-7 h-7 rounded-full bg-[#1e5fa8] flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-white">{c.admin.nombre.slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 font-medium">Administrador</p>
                  <p className="text-sm font-semibold text-slate-700 truncate">
                    {c.admin.nombre}
                    {c.admin.email && <span className="font-normal text-slate-400 ml-1.5 text-xs">{c.admin.email}</span>}
                  </p>
                </div>
              </div>
            )}

            {/* Lista de usuarios expandible */}
            {c.usuarios && c.usuarios.length > 0 && (
              <div>
                <button
                  onClick={() => setExpandUsuarios(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors mb-1"
                >
                  {expandUsuarios ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {expandUsuarios ? 'Ocultar' : 'Ver'} usuarios ({c.usuarios.length})
                </button>
                {expandUsuarios && (
                  <div className="rounded-xl border border-slate-100 overflow-hidden">
                    {c.usuarios.map((u, i) => (
                      <div key={u.id} className={`flex items-center justify-between px-3 py-2.5 gap-3 ${i > 0 ? 'border-t border-slate-50' : ''}`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-bold text-slate-500">
                              {u.nombre.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{u.nombre}</p>
                            <p className="text-[11px] text-slate-400 truncate">{u.email ?? '—'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                            {ROLE_LABEL[u.role] ?? u.role}
                          </span>
                          <button
                            onClick={() => onEliminarUsuario(u)}
                            className="text-slate-300 hover:text-red-500 p-1 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar usuario">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
