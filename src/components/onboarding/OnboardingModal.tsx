'use client'

import { useState, useCallback } from 'react'
import { CheckCircle2, ChevronRight, Loader2, X } from 'lucide-react'
import EspecialidadSelector from '@/components/ui/EspecialidadSelector'
import FirmaCaptura from '@/components/perfil/FirmaCaptura'
import { validarCedula } from '@/lib/validaciones'
import { useToast } from '@/components/ui/Toast'
import { mutate } from 'swr'
import { canManageClinica } from '@/lib/permissions'
import type { Role } from '@/hooks/useProfile'

interface Props {
  onComplete: () => void
  role: string
  esAdminDeClinica: boolean
}

type Paso = 1 | 2 | 3 | 4 | 5

const PASOS = [
  { num: 1 as Paso, label: 'Datos', requerido: true },
  { num: 2 as Paso, label: 'Cédulas', requerido: true },
  { num: 3 as Paso, label: 'Consultorio', requerido: false },
  { num: 4 as Paso, label: 'Logo', requerido: false },
  { num: 5 as Paso, label: 'Firma', requerido: false },
]

const TITULOS = ['Dr.', 'Dra.', 'Mtro.', 'Mtra.', 'Lic.', 'Ing.']

export default function OnboardingModal({ onComplete, role, esAdminDeClinica }: Props) {
  const toast = useToast()
  const isAdmin = canManageClinica({ role: role as Role, es_admin_de_clinica: esAdminDeClinica })

  const [paso, setPaso] = useState<Paso>(1)
  const [guardando, setGuardando] = useState(false)

  // Paso 1: Datos personales
  const [titulo, setTitulo] = useState('Dr.')
  const [nombres, setNombres] = useState('')
  const [apellidoPaterno, setApellidoPaterno] = useState('')
  const [apellidoMaterno, setApellidoMaterno] = useState('')
  const [especialidades, setEspecialidades] = useState<string[]>([''])
  const [universidad, setUniversidad] = useState('')

  // Paso 2: Cédulas
  const [cedula_profesional, setCedulaProfesional] = useState('')
  const [cedula_especialidad, setCedulaEspecialidad] = useState('')
  const [errorCedula, setErrorCedula] = useState('')

  // Paso 3: Consultorio
  const [direccion, setDireccion] = useState('')
  const [telefono, setTelefono] = useState('')

  // Paso 4: Logo (solo admin)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [subiendoLogo, setSubiendoLogo] = useState(false)

  // Paso 5: Firma
  const [firmaUrl, setFirmaUrl] = useState<string | null>(null)

  const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8] bg-white'

  // ── Guardar paso 1 ──────────────────────────────────────────
  async function guardarPaso1(): Promise<boolean> {
    if (!nombres.trim()) { toast.error('El nombre es obligatorio'); return false }
    if (!apellidoPaterno.trim()) { toast.error('El apellido paterno es obligatorio'); return false }
    const especialidad = especialidades.filter(Boolean).join(', ')
    if (!especialidad) { toast.error('La especialidad es obligatoria'); return false }

    setGuardando(true)
    try {
      const res = await fetch('/api/me/perfil-medico', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          nombres: nombres.trim(),
          apellido_paterno: apellidoPaterno.trim(),
          apellido_materno: apellidoMaterno.trim() || null,
          especialidad,
          universidad: universidad.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      await mutate('/api/me/perfil-medico')
      return true
    } catch {
      toast.error('Error al guardar. Intenta de nuevo.')
      return false
    } finally {
      setGuardando(false)
    }
  }

  // ── Guardar paso 2 ──────────────────────────────────────────
  async function guardarPaso2(): Promise<boolean> {
    if (!cedula_profesional.trim()) { toast.error('La cédula profesional es obligatoria'); return false }
    if (!cedula_especialidad.trim()) { toast.error('La cédula de especialidad es obligatoria'); return false }

    const errCedPro = validarCedula(cedula_profesional)
    const errCedEsp = validarCedula(cedula_especialidad)
    if (errCedPro || errCedEsp) {
      setErrorCedula(errCedPro || errCedEsp || '')
      return false
    }
    setErrorCedula('')

    setGuardando(true)
    try {
      const res = await fetch('/api/me/perfil-medico', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula_profesional: cedula_profesional.trim(), cedula_especialidad: cedula_especialidad.trim() }),
      })
      if (!res.ok) throw new Error()
      await mutate('/api/me/perfil-medico')
      return true
    } catch {
      toast.error('Error al guardar. Intenta de nuevo.')
      return false
    } finally {
      setGuardando(false)
    }
  }

  // ── Guardar paso 3 ──────────────────────────────────────────
  async function guardarPaso3(): Promise<boolean> {
    if (!direccion.trim() && !telefono.trim()) return true // totalmente opcional
    setGuardando(true)
    try {
      const res = await fetch('/api/me/perfil-medico', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direccion_consultorio: direccion.trim(), telefono_consultorio: telefono.trim() }),
      })
      if (!res.ok) throw new Error()
      await mutate('/api/me/perfil-medico')
      return true
    } catch {
      toast.error('Error al guardar.')
      return false
    } finally {
      setGuardando(false)
    }
  }

  // ── Subir logo ──────────────────────────────────────────────
  const handleLogoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('El logo no debe superar 2 MB'); return }
    setLogoFile(file)
    const url = URL.createObjectURL(file)
    setLogoPreview(url)
  }, [toast])

  async function subirLogo(): Promise<boolean> {
    if (!logoFile) return true
    setSubiendoLogo(true)
    try {
      const fd = new FormData()
      fd.append('logo', logoFile)
      const res = await fetch('/api/me/logo', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      await mutate('/api/me/perfil-medico')
      return true
    } catch {
      toast.error('Error al subir el logo.')
      return false
    } finally {
      setSubiendoLogo(false)
    }
  }

  // ── Avanzar paso ───────────────────────────────────────────
  async function avanzar() {
    let ok = true
    if (paso === 1) ok = await guardarPaso1()
    else if (paso === 2) ok = await guardarPaso2()
    else if (paso === 3) ok = await guardarPaso3()
    else if (paso === 4) ok = await subirLogo()

    if (!ok) return

    if (paso === 5) {
      onComplete()
      return
    }
    // Saltar paso 4 (logo) si no es admin
    const siguiente = (paso + 1) as Paso
    if (siguiente === 4 && !isAdmin) {
      setPaso(5)
    } else {
      setPaso(siguiente)
    }
  }

  function saltarPaso() {
    if (paso === 5) { onComplete(); return }
    const siguiente = (paso + 1) as Paso
    if (siguiente === 4 && !isAdmin) {
      setPaso(5)
    } else {
      setPaso(siguiente)
    }
  }

  // Pasos visibles según rol
  const pasosVisibles = PASOS.filter(p => p.num !== 4 || isAdmin)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop blur */}
      <div className="absolute inset-0 bg-[#0f1923]/70 backdrop-blur-sm" />

      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#1a3a5c] px-6 pt-6 pb-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Configura tu perfil</h2>
              <p className="text-xs text-white/60 mt-0.5">Solo toma 2 minutos · Aparece en tus documentos PDF</p>
            </div>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-1">
            {pasosVisibles.map((p, i) => {
              const activo = p.num === paso
              const completado = p.num < paso
              return (
                <div key={p.num} className="flex items-center gap-1 flex-1">
                  <div className={`flex items-center gap-1.5 ${activo ? 'flex-1' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                      completado ? 'bg-green-400 text-white' :
                      activo ? 'bg-white text-[#1a3a5c]' :
                      'bg-white/20 text-white/50'
                    }`}>
                      {completado ? <CheckCircle2 size={14} /> : p.num}
                    </div>
                    {activo && (
                      <span className="text-xs font-medium text-white">{p.label}</span>
                    )}
                  </div>
                  {i < pasosVisibles.length - 1 && (
                    <div className={`h-px flex-1 ${completado ? 'bg-green-400' : 'bg-white/20'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Contenido del paso */}
        <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
          {paso === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">¿Cómo aparecerás en tus documentos médicos?</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Título</label>
                  <select value={titulo} onChange={e => setTitulo(e.target.value)} className={inputCls}>
                    {TITULOS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-500 block mb-1">Nombre(s) <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={nombres}
                    onChange={e => setNombres(e.target.value)}
                    placeholder="Ej: Juan"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Apellido paterno <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={apellidoPaterno}
                    onChange={e => setApellidoPaterno(e.target.value)}
                    placeholder="Ej: García"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Apellido materno</label>
                  <input
                    type="text"
                    value={apellidoMaterno}
                    onChange={e => setApellidoMaterno(e.target.value)}
                    placeholder="Ej: López"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Especialidad <span className="text-red-400">*</span></label>
                <EspecialidadSelector
                  value={especialidades}
                  onChange={setEspecialidades}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Universidad / Institución (opcional)</label>
                <input
                  type="text"
                  value={universidad}
                  onChange={e => setUniversidad(e.target.value)}
                  placeholder="Ej: UNAM, IPN, UAG..."
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {paso === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Tus cédulas aparecerán al pie de cada documento oficial.</p>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Cédula profesional <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={cedula_profesional}
                  onChange={e => { setCedulaProfesional(e.target.value); setErrorCedula('') }}
                  placeholder="7 u 8 dígitos"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Cédula de especialidad <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={cedula_especialidad}
                  onChange={e => { setCedulaEspecialidad(e.target.value); setErrorCedula('') }}
                  placeholder="7 u 8 dígitos"
                  className={inputCls}
                />
              </div>
              {errorCedula && (
                <p className="text-xs text-red-500">{errorCedula}</p>
              )}
              <p className="text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
                Las cédulas son datos que amparan legalmente tus documentos médicos bajo la NOM-004-SSA3-2012.
              </p>
            </div>
          )}

          {paso === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Datos de contacto que aparecen en el encabezado de tus documentos.</p>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Dirección del consultorio</label>
                <textarea
                  value={direccion}
                  onChange={e => setDireccion(e.target.value)}
                  placeholder="Ej: Av. Insurgentes Sur 3600, Col. Pedregal, CDMX"
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Teléfono del consultorio</label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                  placeholder="Ej: 55 1234 5678"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {paso === 4 && isAdmin && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">El logo de tu clínica aparece en el encabezado de todos los documentos.</p>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                {logoPreview ? (
                  <div className="space-y-3">
                    <img src={logoPreview} alt="Logo" className="h-20 mx-auto object-contain rounded-lg" />
                    <button
                      onClick={() => { setLogoFile(null); setLogoPreview(null) }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Quitar logo
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl">🏥</span>
                    </div>
                    <p className="text-sm font-medium text-slate-700">Haz clic para subir el logo</p>
                    <p className="text-xs text-slate-400 mt-1">PNG o JPG · Máximo 2 MB</p>
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} className="hidden" />
                  </label>
                )}
              </div>
              {subiendoLogo && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 size={14} className="animate-spin" /> Subiendo logo...
                </div>
              )}
            </div>
          )}

          {paso === 5 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">Tu firma autógrafa aparece sobre la línea de firma en todos tus documentos PDF.</p>
              <FirmaCaptura
                firmaActual={firmaUrl}
                onFirmaCambiada={url => setFirmaUrl(url)}
              />
            </div>
          )}
        </div>

        {/* Footer con botones */}
        <div className="px-6 pb-6 pt-2 flex items-center justify-between border-t border-slate-100">
          {PASOS.find(p => p.num === paso)?.requerido ? (
            <span className="text-xs text-slate-400">Paso requerido</span>
          ) : (
            <button
              onClick={saltarPaso}
              disabled={guardando}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Omitir por ahora
            </button>
          )}

          <button
            onClick={avanzar}
            disabled={guardando || subiendoLogo}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1e5fa8] text-white rounded-xl text-sm font-medium hover:bg-[#1a3a5c] transition-colors disabled:opacity-60"
          >
            {guardando ? (
              <><Loader2 size={15} className="animate-spin" /> Guardando...</>
            ) : paso === 5 ? (
              <><CheckCircle2 size={15} /> Finalizar</>
            ) : (
              <>Continuar <ChevronRight size={15} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
