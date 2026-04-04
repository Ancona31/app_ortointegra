'use client'

import { useState, useEffect, useRef } from 'react'
import { useProfile } from '@/hooks/useProfile'
import { useRouter } from 'next/navigation'
import { Loader2, Save, Palette, Upload, X } from 'lucide-react'
import { PerfilSkeleton } from '@/components/ui/Skeleton'
import { useToast } from '@/components/ui/Toast'
import EspecialidadSelector from '@/components/ui/EspecialidadSelector'

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

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest px-5 pt-4 pb-1">{children}</p>
  )
}

export default function PerfilPage() {
  const { profile, loading: loadingProfile } = useProfile()
  const router = useRouter()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormData>({
    titulo: '', especialidad: '', cedula_profesional: '',
    cedula_especialidad: '', direccion_consultorio: '', telefono_consultorio: '',
  })
  const [especialidades, setEspecialidades] = useState<string[]>([''])
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
        const espRaw = perfilData.medico.especialidad || ''
        const espArray = espRaw ? espRaw.split(' · ').filter(Boolean) : ['']
        setEspecialidades(espArray.length > 0 ? espArray : [''])
        setForm({
          titulo: perfilData.medico.titulo || 'Dr.',
          especialidad: espRaw,
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

    const r1 = await fetch('/api/me/perfil-medico', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, especialidad: especialidades.filter(Boolean).join(' · ') }),
    })

    if (isAdmin) {
      await fetch('/api/me/clinica', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          color_primario: apariencia.color_primario,
          color_secundario: apariencia.color_secundario,
        }),
      })

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

  if (loading || loadingProfile) return <PerfilSkeleton />

  const logoMostrado = logoPreview || apariencia.logo_url

  const inputClass = "w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/25 focus:border-[#1e5fa8]/50 focus:bg-white transition-all"

  return (
    <div className="max-w-lg mx-auto space-y-5 animate-slide-up">

      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1">Cuenta</p>
        <h1 className="text-[22px] font-bold tracking-tight text-[#1d1d1f]">Mi perfil</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Datos profesionales */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <SectionHeader>Datos profesionales</SectionHeader>
          <div className="px-5 pb-5 space-y-3">
            <div>
              <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">Título</label>
              <select value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} className={inputClass}>
                <option value="Dr.">Dr.</option>
                <option value="Dra.">Dra.</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">Especialidad</label>
              <EspecialidadSelector value={especialidades} onChange={setEspecialidades} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">Cédula profesional</label>
                <input type="text" value={form.cedula_profesional} onChange={e => setForm({ ...form, cedula_profesional: e.target.value })}
                  placeholder="Ej: 87654321" className={inputClass} />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">Cédula de especialidad</label>
                <input type="text" value={form.cedula_especialidad} onChange={e => setForm({ ...form, cedula_especialidad: e.target.value })}
                  placeholder="Ej: 3890214" className={inputClass} />
              </div>
            </div>
          </div>
        </div>

        {/* Consultorio */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 pt-4 pb-1 flex items-baseline gap-2">
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">Consultorio</p>
            <span className="text-[10px] text-[#86868b]">Requerido en recetas (RIS)</span>
          </div>
          <div className="px-5 pb-5 space-y-3">
            <div>
              <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">Dirección</label>
              <input type="text" value={form.direccion_consultorio} onChange={e => setForm({ ...form, direccion_consultorio: e.target.value })}
                placeholder="Ej: Calle 60 #400, Col. Centro, Mérida, Yucatán" className={inputClass} />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[#86868b] block mb-1.5">Teléfono</label>
              <input type="tel" value={form.telefono_consultorio} onChange={e => setForm({ ...form, telefono_consultorio: e.target.value })}
                placeholder="Ej: (999) 123-4567" className={inputClass} />
            </div>
          </div>
        </div>

        {/* Apariencia — solo admin */}
        {isAdmin && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 pt-4 pb-1 flex items-center gap-2">
              <Palette size={13} className="text-[#86868b]" />
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">Apariencia</p>
              <span className="text-[10px] text-[#86868b]">Se aplica en documentos y PDFs</span>
            </div>

            <div className="px-5 pb-5 space-y-5">
              {/* Logo */}
              <div>
                <label className="text-[11px] font-medium text-[#86868b] block mb-2">Logo del consultorio</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 flex-shrink-0">
                    {logoMostrado
                      ? <img src={logoMostrado} alt="Logo" className="w-full h-full object-contain p-1" />
                      : <Upload size={18} className="text-slate-300" />
                    }
                  </div>
                  <div className="flex flex-col gap-2">
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                      {logoMostrado ? 'Cambiar logo' : 'Subir logo'}
                    </button>
                    {logoMostrado && (
                      <button type="button" onClick={quitarLogo}
                        className="px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors flex items-center gap-1"
                        style={{ color: '#EF5350', borderColor: '#fecaca' }}>
                        <X size={11} /> Quitar
                      </button>
                    )}
                    <p className="text-[10px] text-[#86868b]">PNG, JPG, SVG · máx. 2 MB</p>
                  </div>
                </div>
                <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp,.svg" onChange={onSelectLogo} className="hidden" />
              </div>

              {/* Paletas */}
              <div>
                <label className="text-[11px] font-medium text-[#86868b] block mb-2">Paleta de colores</label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {PALETAS.map(p => (
                    <button key={p.nombre} type="button"
                      onClick={() => setApariencia(a => ({ ...a, color_primario: p.primario, color_secundario: p.secundario }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs text-left transition-colors
                        ${apariencia.color_primario === p.primario && apariencia.color_secundario === p.secundario
                          ? 'border-[#1e5fa8] bg-blue-50'
                          : 'border-slate-200 hover:bg-slate-50'}`}>
                      <div className="flex gap-1 flex-shrink-0">
                        <span className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ background: p.primario }} />
                        <span className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ background: p.secundario }} />
                      </div>
                      <span className="text-[#3d3d3f] truncate">{p.nombre}</span>
                    </button>
                  ))}
                </div>

                {/* Colores custom */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Color primario', key: 'color_primario' as const },
                    { label: 'Color secundario', key: 'color_secundario' as const },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="text-[10px] text-[#86868b] block mb-1.5">{label}</label>
                      <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50">
                        <input type="color" value={apariencia[key]}
                          onChange={e => setApariencia(a => ({ ...a, [key]: e.target.value }))}
                          className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent" />
                        <span className="text-xs font-mono text-[#3d3d3f]">{apariencia[key]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="text-[11px] font-medium text-[#86868b] block mb-2">Vista previa del encabezado en PDFs</label>
                <div className="rounded-xl overflow-hidden border border-slate-200">
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
          </div>
        )}

        <button type="submit" disabled={guardando || subiendoLogo}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#1e5fa8] text-white rounded-2xl text-sm font-semibold hover:bg-[#1a3a5c] transition-colors disabled:opacity-50 shadow-sm">
          {guardando || subiendoLogo
            ? <><Loader2 size={15} className="animate-spin" /> {subiendoLogo ? 'Subiendo logo...' : 'Guardando...'}</>
            : <><Save size={15} /> Guardar cambios</>}
        </button>

      </form>
    </div>
  )
}
