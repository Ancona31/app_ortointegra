'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, User, X, ArrowRight, Loader2, UserPlus, ChevronLeft } from 'lucide-react'
import { toTitleCase, calcularEdad, fechaHoyISO, FECHA_MIN_NACIMIENTO } from '@/lib/patientUtils'
import { useProfile } from '@/hooks/useProfile'
import type { DuplicatePatientResponse } from '@/types'

type Paciente = {
  id: string
  nombre: string
  apellidos: string
  fecha_nacimiento?: string | null
  numero_expediente?: string | null
  sexo?: string | null
}

function parsearNombre(q: string) {
  const partes = q.trim().split(/\s+/)
  if (partes.length === 1) return { nombre: partes[0], apellidos: '' }
  return { nombre: partes[0], apellidos: partes.slice(1).join(' ') }
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function ConsultaRapidaModal({ open, onClose }: Props) {
  const router = useRouter()
  const { profile } = useProfile()
  const esMedicoInvitado = profile?.role === 'medico' && profile?.es_admin_de_clinica !== true
  const [offlineMsg, setOfflineMsg] = useState("")

  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<Paciente[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)

  const [modoCrear, setModoCrear]     = useState(false)
  const [formNombre, setFormNombre]   = useState('')
  const [formApellidos, setFormApellidos] = useState('')
  const [formFechaNac, setFormFechaNac] = useState('')
  const [formConsentimiento, setFormConsentimiento] = useState(false)
  const [creando, setCreando]         = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<{ id: string; nombre: string; apellidos: string; numero_expediente: string | null; existingPatientIsMine: boolean } | null>(null)
  const [vincularError, setVincularError] = useState<string | null>(null)
  const [vinculando, setVinculando] = useState(false)
  const forceCreateRef = useRef(false)

  const inputRef    = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      setQuery(''); setResults([]); setSelected(0)
      setModoCrear(false); setOfflineMsg('')
      setFormNombre(''); setFormApellidos(''); setFormFechaNac('')
      setFormConsentimiento(false)
      setDuplicateWarning(null)
      setVincularError(null)
      setVinculando(false)
      forceCreateRef.current = false
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const buscar = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    setOfflineMsg('')

    const supabase = createClient()
    const { data } = await supabase
      .from('pacientes')
      .select('id, nombre, apellidos, fecha_nacimiento, numero_expediente, sexo')
      .neq('activo', false)
      .or(`nombre.ilike.%${q}%,apellidos.ilike.%${q}%`)
      .order('apellidos')
      .limit(8)
    setResults(data || [])
    setLoading(false)
    setSelected(0)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscar(query), 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, buscar])

  const mostrarOpcionCrear = query.trim().length >= 2 && !loading && results.length < 8
  const totalOpciones = results.length + (mostrarOpcionCrear ? 1 : 0)

  function handleKey(e: React.KeyboardEvent) {
    if (modoCrear) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, totalOpciones - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selected]) { navegar(results[selected].id); return }
      if (mostrarOpcionCrear && selected === results.length) abrirCrear()
    }
  }

  function navegar(id: string) {
    onClose()
    router.push(`/expediente/${id}/nueva-nota`)
  }

  function abrirCrear() {
    const { nombre, apellidos } = parsearNombre(query)
    setFormNombre(nombre)
    setFormApellidos(apellidos)
    setModoCrear(true)
  }

  const [formError, setFormError] = useState('')

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    if (!formNombre.trim()) { setFormError('El nombre es requerido.'); return }
    if (!formConsentimiento) { setFormError('El consentimiento es obligatorio.'); return }
    setCreando(true)
    setFormError('')

    try {
      const res = await fetch('/api/pacientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: toTitleCase(formNombre),
          apellidos: toTitleCase(formApellidos),
          sexo: null,
          fecha_nacimiento: formFechaNac || null,
          consentimiento_otorgado: true,
          ...(forceCreateRef.current ? { forceCreate: true } : {}),
        }),
      })
      const data = await res.json() as Record<string, unknown>

      if (res.status === 409 && data.error === 'DUPLICATE_PATIENT') {
        const dupData = data as unknown as DuplicatePatientResponse
        setDuplicateWarning({
          id: dupData.existingPatient.id,
          nombre: dupData.existingPatient.nombre,
          apellidos: dupData.existingPatient.apellidos,
          numero_expediente: dupData.existingPatient.numero_expediente,
          existingPatientIsMine: (dupData.existingPatientIsMine ?? false),
        })
        setCreando(false)
        return
      }

      if (!res.ok) {
        setFormError((data.message as string) ?? (data.error as string) ?? 'Error al crear paciente')
        return
      }
      if (data.id) {
        onClose()
        router.push(`/expediente/${data.id as string}/nueva-nota`)
      }
    } catch {
      setFormError('Error de conexión. Intenta de nuevo.')
    } finally {
      setCreando(false)
    }
  }

  async function handleVincular() {
    if (!duplicateWarning) return
    setVinculando(true)
    setVincularError(null)
    try {
      const res = await fetch(`/api/pacientes/${duplicateWarning.id}/vincular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        setVincularError('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.')
        setVinculando(false)
        return
      }
      // Éxito: mismo flujo que la creación normal → iniciar nota del paciente existente
      onClose()
      router.push(`/expediente/${duplicateWarning.id}/nueva-nota`)
    } catch {
      setVincularError('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.')
      setVinculando(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-start justify-center pt-[15vh] px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {offlineMsg && (
          <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            <span>{offlineMsg}</span>
          </div>
        )}

        {!modoCrear && (
          <>
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
              {loading
                ? <Loader2 size={18} className="text-slate-400 animate-spin flex-shrink-0" />
                : <Search size={18} className="text-slate-400 flex-shrink-0" />
              }
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Buscar paciente por nombre..."
                className="flex-1 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none bg-transparent"
              />
              <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-colors">
                <X size={16} />
              </button>
            </div>

            {(results.length > 0 || mostrarOpcionCrear) && (
              <ul className="py-2 max-h-80 overflow-y-auto">
                {results.map((p, i) => {
                  const edadInfo = p.fecha_nacimiento
                    ? calcularEdad(p.fecha_nacimiento)
                    : null
                  const activo = i === selected
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => navegar(p.id)}
                        onMouseEnter={() => setSelected(i)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activo ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                      >
                        <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-semibold text-xs flex-shrink-0">
                          {p.nombre[0]}{p.apellidos[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 text-sm truncate">{p.nombre} {p.apellidos}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {edadInfo ? edadInfo.textoElegante : ''}
                            {edadInfo && p.sexo ? ' · ' : ''}
                            {p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Femenino' : ''}
                            {p.numero_expediente ? ` · ${p.numero_expediente}` : ''}
                          </p>
                        </div>
                        {activo && <ArrowRight size={14} className="text-slate-400 flex-shrink-0" />}
                      </button>
                    </li>
                  )
                })}

                {mostrarOpcionCrear && (
                  <li>
                    <button
                      onClick={abrirCrear}
                      onMouseEnter={() => setSelected(results.length)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-t border-slate-100 ${
                        selected === results.length ? 'bg-emerald-50' : 'hover:bg-emerald-50'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <UserPlus size={15} className="text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-emerald-700 text-sm">
                          Crear registro para: <span className="font-bold">"{query}"</span>
                        </p>
                        <p className="text-xs text-emerald-600/70 mt-0.5">Registro rápido — nombre, teléfono y motivo</p>
                      </div>
                      {selected === results.length && <ArrowRight size={14} className="text-emerald-500 flex-shrink-0" />}
                    </button>
                  </li>
                )}
              </ul>
            )}

            {query && !loading && results.length === 0 && !mostrarOpcionCrear && (
              <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                <User size={32} className="opacity-30" />
                <p className="text-sm">Sin resultados para "{query}"</p>
              </div>
            )}

            {!query && (
              <div className="px-4 py-3 text-xs text-slate-400">
                Escribe el nombre del paciente para buscarlo o registrarlo
              </div>
            )}

            <div className="px-4 py-2 border-t border-slate-100 flex gap-4 text-[10px] text-slate-400">
              <span><kbd className="font-mono bg-slate-100 px-1 rounded">↑↓</kbd> navegar</span>
              <span><kbd className="font-mono bg-slate-100 px-1 rounded">↵</kbd> abrir</span>
              <span><kbd className="font-mono bg-slate-100 px-1 rounded">Esc</kbd> cerrar</span>
            </div>
          </>
        )}

        {modoCrear && (
          <form onSubmit={handleCrear}>
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
              <button
                type="button"
                onClick={() => setModoCrear(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800">Registro rápido</p>
                <p className="text-[11px] text-slate-400">Puedes completar el expediente después</p>
              </div>
              <button type="button" onClick={onClose} className="text-slate-300 hover:text-slate-500">
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {formError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}

              {duplicateWarning && (
                <div className="bg-amber-50 border border-amber-300 px-3 py-3 rounded-xl space-y-2">
                  {duplicateWarning.existingPatientIsMine ? (
                    <p className="text-xs text-amber-800 font-medium">
                      ⚠️ Este paciente ya está en tu lista de pacientes: {duplicateWarning.nombre} {duplicateWarning.apellidos}
                      {duplicateWarning.numero_expediente ? ` (Exp. #${duplicateWarning.numero_expediente})` : ''}
                    </p>
                  ) : esMedicoInvitado ? (
                    <p className="text-xs text-amber-800 font-medium">
                      ⚠️ Este paciente ya está registrado en tu clínica, pero no aparece en tu lista porque aún no es tu paciente: {duplicateWarning.nombre} {duplicateWarning.apellidos}
                      {duplicateWarning.numero_expediente ? ` (Exp. #${duplicateWarning.numero_expediente})` : ''}. ¿Deseas vincularlo a tus pacientes?
                    </p>
                  ) : (
                    <p className="text-xs text-amber-800 font-medium">
                      ⚠️ Ya existe un paciente con los mismos datos: {duplicateWarning.nombre} {duplicateWarning.apellidos}
                      {duplicateWarning.numero_expediente ? ` (Exp. #${duplicateWarning.numero_expediente})` : ''}. ¿Es el mismo paciente o una persona distinta?
                    </p>
                  )}
                  {vincularError && <p className="text-[11px] text-red-600">{vincularError}</p>}
                  <div className="flex flex-col gap-2">
                    {duplicateWarning.existingPatientIsMine ? (
                      <button
                        type="button"
                        onClick={() => {
                          onClose()
                          router.push(`/expediente/${duplicateWarning.id}/nueva-nota`)
                        }}
                        className="w-full px-2 py-1.5 text-[11px] font-semibold text-white bg-[#1e5fa8] rounded-lg hover:bg-[#1a3a5c] transition-colors"
                      >
                        Ir a su expediente
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleVincular}
                        disabled={vinculando}
                        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold text-white bg-[#1e5fa8] rounded-lg hover:bg-[#1a3a5c] transition-colors disabled:opacity-50"
                      >
                        {vinculando ? <><Loader2 size={12} className="animate-spin" /> Vinculando...</> : 'Es el mismo paciente'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={vinculando}
                      onClick={() => {
                        setDuplicateWarning(null)
                        setVincularError(null)
                        forceCreateRef.current = true
                        const formEl = document.querySelector<HTMLFormElement>('form')
                        if (formEl) formEl.requestSubmit()
                      }}
                      className="w-full px-2 py-1.5 text-[11px] font-medium text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50"
                    >
                      Es otra persona, crear de todos modos
                    </button>
                    <button
                      type="button"
                      disabled={vinculando}
                      onClick={() => { setDuplicateWarning(null); setVincularError(null) }}
                      className="w-full px-2 py-1.5 text-[11px] font-medium text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">Nombre <span className="text-red-400">*</span></label>
                  <input
                    autoFocus
                    type="text"
                    value={formNombre}
                    onChange={e => setFormNombre(e.target.value)}
                    required
                    placeholder="Juan"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">Apellidos</label>
                  <input
                    type="text"
                    value={formApellidos}
                    onChange={e => setFormApellidos(e.target.value)}
                    placeholder="García López"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 block mb-1">Fecha de nacimiento</label>
                <input
                  type="date"
                  value={formFechaNac}
                  onChange={e => setFormFechaNac(e.target.value)}
                  min={FECHA_MIN_NACIMIENTO}
                  max={fechaHoyISO()}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
                />
                {formFechaNac && (
                  <p className="text-[11px] text-[#1e5fa8] mt-1 font-medium">{calcularEdad(formFechaNac).textoElegante}</p>
                )}
                <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">Recomendable para que la edad aparezca en recetas y documentos. Si se deja vacío, el campo edad quedará en blanco.</p>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formConsentimiento}
                  onChange={e => setFormConsentimiento(e.target.checked)}
                  className="mt-0.5 accent-[#1e5fa8]"
                />
                <span className="text-[11px] text-slate-500 leading-tight">
                  El paciente ha leído y acepta el{' '}
                  <a href="/privacidad" target="_blank" className="text-[#1e5fa8] underline">Aviso de Privacidad</a>
                  {' '}(LFPDPPP Art. 9) <span className="text-red-400">*</span>
                </span>
              </label>
            </div>

            <div className="px-4 pb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setModoCrear(false)}
                className="flex-1 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creando || vinculando || !formNombre.trim() || !formConsentimiento}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#1e5fa8] rounded-xl hover:bg-[#1a3a5c] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 min-w-0"
              >
                {creando
                  ? <Loader2 size={14} className="animate-spin shrink-0" />
                  : <UserPlus size={14} className="shrink-0" />}
                <span className="truncate">{creando ? 'Creando...' : 'Crear e iniciar consulta'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
