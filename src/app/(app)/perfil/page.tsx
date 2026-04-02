'use client'

import { useState, useEffect, useRef } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { useRouter } from 'next/navigation'
import { Loader2, Save, UserCircle, Palette, Upload, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

type FormData = {
  titulo: string
  especialidad: string
  cedula_profesional: string
  cedula_especialidad: string
  direccion_consultorio: string
  telefono_consultorio: string
}

type Apariencia = {
  color_primario: string
  color_secundario: string
  logo_url: string | null
}

const PALETAS = [
  { nombre: 'OrtoIntegra (defecto)', primario: '#1a3a5c', secundario: '#1e5fa8' },
  { nombre: 'Verde médico',          primario: '#134e4a', secundario: '#0d9488' },
  { nombre: 'Morado',                primario: '#3b0764', secundario: '#7c3aed' },
  { nombre: 'Rojo burdeos',          primario: '#7f1d1d', secundario: '#dc2626' },
  { nombre: 'Café cálido',           primario: '#451a03', secundario: '#b45309' },
  { nombre: 'Pizarra oscuro',        primario: '#0f172a', secundario: '#475569' },
]

export default function PerfilPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const router = useRouter()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormData>({
    titulo: '', especialidad: '', cedula_profesional: '',
    cedula_especialidad: '', direccion_consultorio: '', telefono_consultorio: '',
  })
  const [apariencia, setApariencia] = useState<Apariencia>({
    color_primario: '#1a3a5c', color_secundario: '#1e5fa8', logo_url: null,
  })
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendoLogo, setSubiendoLogo] = useState(false)

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

  useEffect(() => {
    if (!loadingProfile && profile && !['medico', 'admin', 'super_admin'].includes(profile.role)) {
      router.push('/dashboard')
    }
  }, [profile, loadingProfile, router])

  useEffect(() => {
    Promise.all([
      fetch('/api/me/perfil-medico').then(r => r.json()),
      fetch('/api/me/clinica').then(r => r.json()),
    ]).then(([perfilData, clinicaData]) => {
      if (perfilData.medico) {
        setForm({
          titulo: perfilData.medico.titulo || 'Dr.',
          especialidad: perfilData.medico.especialidad || '',
          cedula_profesional: perfilData.medico.cedula_profesional || '',
          cedula_especialidad: perfilData.medico.cedula_especialidad || '',
          direccion_consultorio: perfilData.medico.direccion_consultorio || '',
          telefono_consultorio: perfilData.medico.telefono_consultorio || '',
        })
      }
      if (clinicaData.clinica) {
        setApariencia({
          color_primario: clinicaData.clinica.color_primario || '#1a3a5c',
          color_secundario: clinicaData.clinica.color_secundario || '#1e5fa8',
          logo_url: clinicaData.clinica.logo_url || null,
        })
      }
      setLoading(false)
    })
  }, [])

  function onSelectLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function quitarLogo() {
    setLogoFile(null)
    setLogoPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)

    // Guardar perfil médico
    const r1 = await fetch('/api/me/perfil-medico', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    // Guardar colores (solo admin)
    if (isAdmin) {
      await fetch('/api/me/clinica', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          color_primario: apariencia.color_primario,
          color_secundario: apariencia.color_secundario,
        }),
      })

      // Subir logo si hay uno nuevo
      if (logoFile) {
        setSubiendoLogo(true)
        const fd = new FormData()
        fd.append('logo', logoFile)
        const r = await fetch('/api/me/logo', { method: 'POST', body: fd })
        const d = await r.json()
        setSubiendoLogo(false)
        if (!r.ok) {
          toast.error(d.error || 'Error al subir el logo')
          setGuardando(false)
          return
        }
        setApariencia(a => ({ ...a, logo_url: d.url }))
        setLogoFile(null)
        setLogoPreview(null)
      }
    }

    setGuardando(false)
    if (!r1.ok) {
      const d = await r1.json()
      toast.error(d.error || 'Error al guardar')
    } else {
      toast.success('Cambios guardados correctamente')
    }
  }

  if (loading || loadingProfile) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={24} className="animate-spin text-slate-300" />
    </div>
  )

  const logoMostrado = logoPreview || apariencia.logo_url

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <UserCircle size={24} className="text-[#1a3a5c]" />
        <h1 className="text-2xl font-bold text-[#1a3a5c]">Mi perfil</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Datos profesionales */}
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

        {/* Consultorio */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h2 className="font-semibold text-slate-700 text-sm">
            Datos del consultorio
            <span className="ml-2 text-xs font-normal text-slate-400">Requeridos en recetas (RIS)</span>
          </h2>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Dirección</label>
            <input type="text" value={form.direccion_consultorio} onChange={e => setForm({ ...form, direccion_consultorio: e.target.value })}
              placeholder="Ej: Calle 60 #400, Col. Centro, Mérida, Yucatán"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Teléfono</label>
            <input type="tel" value={form.telefono_consultorio} onChange={e => setForm({ ...form, telefono_consultorio: e.target.value })}
              placeholder="Ej: (999) 123-4567"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30" />
          </div>
        </div>

        {/* Apariencia — solo admin */}
        {isAdmin && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
            <div className="flex items-center gap-2">
              <Palette size={15} className="text-[#1a3a5c]" />
              <h2 className="font-semibold text-slate-700 text-sm">Apariencia</h2>
              <span className="text-xs text-slate-400">Se aplica en documentos y PDFs</span>
            </div>

            {/* Logo */}
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-2">Logo del consultorio</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 flex-shrink-0">
                  {logoMostrado
                    ? <img src={logoMostrado} alt="Logo" className="w-full h-full object-contain p-1" />
                    : <Upload size={20} className="text-slate-300" />
                  }
                </div>
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                    {logoMostrado ? 'Cambiar logo' : 'Subir logo'}
                  </button>
                  {logoMostrado && (
                    <button type="button" onClick={quitarLogo}
                      className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1">
                      <X size={11} /> Quitar
                    </button>
                  )}
                  <p className="text-xs text-slate-400">PNG, JPG, SVG · máx. 2 MB</p>
                </div>
              </div>
              <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp,.svg"
                onChange={onSelectLogo} className="hidden" />
            </div>

            {/* Paletas predefinidas */}
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-2">Paleta de colores</label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {PALETAS.map(p => (
                  <button key={p.nombre} type="button"
                    onClick={() => setApariencia(a => ({ ...a, color_primario: p.primario, color_secundario: p.secundario }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs text-left transition-colors
                      ${apariencia.color_primario === p.primario && apariencia.color_secundario === p.secundario
                        ? 'border-[#1e5fa8] bg-blue-50'
                        : 'border-slate-200 hover:bg-slate-50'}`}>
                    <div className="flex gap-1 flex-shrink-0">
                      <span className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ background: p.primario }} />
                      <span className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ background: p.secundario }} />
                    </div>
                    <span className="text-slate-600 truncate">{p.nombre}</span>
                  </button>
                ))}
              </div>

              {/* Colores personalizados */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Color primario</label>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
                    <input type="color" value={apariencia.color_primario}
                      onChange={e => setApariencia(a => ({ ...a, color_primario: e.target.value }))}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent" />
                    <span className="text-xs font-mono text-slate-600">{apariencia.color_primario}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Color secundario</label>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2">
                    <input type="color" value={apariencia.color_secundario}
                      onChange={e => setApariencia(a => ({ ...a, color_secundario: e.target.value }))}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent" />
                    <span className="text-xs font-mono text-slate-600">{apariencia.color_secundario}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-2">Vista previa del encabezado en PDFs</label>
              <div className="rounded-lg overflow-hidden border border-slate-200">
                <div style={{ background: `linear-gradient(135deg, ${apariencia.color_primario}, ${apariencia.color_secundario})` }}
                  className="p-4 flex items-center gap-3">
                  {logoMostrado && (
                    <div className="w-10 h-10 rounded-full bg-white/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                      <img src={logoMostrado} alt="Logo" className="w-8 h-8 object-contain" />
                    </div>
                  )}
                  <div>
                    <p className="text-white font-bold text-sm">{form.titulo} {profile?.nombre}</p>
                    <p className="text-white/70 text-xs">{form.especialidad || 'Especialidad'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <button type="submit" disabled={guardando || subiendoLogo}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#1e5fa8] text-white rounded-xl font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-60">
          {guardando || subiendoLogo
            ? <><Loader2 size={16} className="animate-spin" /> {subiendoLogo ? 'Subiendo logo...' : 'Guardando...'}</>
            : <><Save size={16} /> Guardar cambios</>}
        </button>
      </form>
    </div>
  )
}
