'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, User, X, ArrowRight, Loader2, UserPlus, ChevronLeft, FileText } from 'lucide-react'
import { calcularEdad } from '@/lib/patientUtils'
import { useProfile } from '@/hooks/useProfile'
import { normalizarFolio } from '@/lib/documentos/folio'
import type { DuplicatePatientResponse } from '@/types'

type Paciente = {
  id: string
  nombre: string
  apellidos: string
  fecha_nacimiento?: string | null
  numero_expediente?: string | null
  sexo?: string | null
}

/**
 * El documento que devuelve una búsqueda por folio.
 *
 * `pacientes` admite objeto o arreglo porque PostgREST devuelve la relación
 * embebida de una u otra forma según cómo infiera la cardinalidad, y este
 * cliente no lleva tipos generados. Se resuelve abajo, en `nombreDePaciente()`.
 */
type DocumentoConFolio = {
  id: string
  folio: string
  tipo: string
  created_at: string
  paciente_id: string
  pacientes?: NombrePaciente | NombrePaciente[] | null
}

type NombrePaciente = { nombre: string; apellidos: string }

/** Cómo se lee cada `documentos.tipo` de los formatos que llevan folio. */
const ETIQUETA_TIPO: Record<string, string> = {
  receta: 'Receta médica',
  nota_honorarios: 'Honorarios / Cotización',
  consentimiento_informado: 'Consentimiento informado',
  // Buscar `DEN-2026-0001` sin esta línea encuentra el documento y lo lee
  // `denegacion_consentimiento`, que es el único sitio donde el buscador de
  // folios enseña el valor de la columna en crudo.
  denegacion_consentimiento: 'Denegación o revocación',
}

function nombreDePaciente(p: DocumentoConFolio['pacientes']): string {
  const uno = Array.isArray(p) ? p[0] : p
  if (!uno) return 'Paciente sin nombre'
  return `${uno.nombre} ${uno.apellidos}`.trim()
}

/* Descompone el query en nombre/apellidos si tiene espacio */
function parsearNombre(q: string) {
  const partes = q.trim().split(/\s+/)
  if (partes.length === 1) return { nombre: partes[0], apellidos: '' }
  return { nombre: partes[0], apellidos: partes.slice(1).join(' ') }
}

export default function CommandPalette() {
  const router = useRouter()
  const { isSecretary } = useProfile()
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<Paciente[]>([])
  const [documento, setDocumento] = useState<DocumentoConFolio | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)

  /* Registro rápido */
  const [modoCrear, setModoCrear] = useState(false)
  const [formNombre, setFormNombre]     = useState('')
  const [formApellidos, setFormApellidos] = useState('')
  const [formFechaNac, setFormFechaNac] = useState('')
  const [formConsentimiento, setFormConsentimiento] = useState(false)
  const [creando, setCreando]       = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicatePatientResponse | null>(null)
  const forceCreateRef = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)

  const inputRef    = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Ctrl+K / Cmd+K */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  /* Reset al abrir */
  useEffect(() => {
    if (open) {
      setQuery(''); setResults([]); setDocumento(null); setSelected(0)
      setModoCrear(false)
      setFormNombre(''); setFormApellidos(''); setFormFechaNac('')
      setFormConsentimiento(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  /* Búsqueda con debounce */
  const buscar = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setDocumento(null); return }
    setLoading(true)
    const supabase = createClient()

    /*
      BÚSQUEDA POR FOLIO — el modo lo decide la FORMA de lo escrito, no un
      conmutador. `RX-2026-0042` no se parece a ningún nombre de paciente, así
      que `normalizarFolio()` devuelve `null` para todo lo demás y la búsqueda
      sigue siendo la de siempre. Quien llama por teléfono dicta el número y el
      médico lo teclea tal cual: sin ceros, en minúsculas o con espacios.

      Es GLOBAL a propósito: quien tiene el papel en la mano no sabe de qué
      paciente es, que es justo lo que hace inútil buscar dentro de un expediente.

      El alcance lo pone la RLS, no esta consulta. `documentos_select` limita a
      `subido_por = auth.uid()` dentro de la propia clínica, así que un folio de
      otro médico no aparece aunque se teclee entero. No se toca esa frontera
      desde aquí.
    */
    const folio = normalizarFolio(q)
    if (folio !== null) {
      const { data } = await supabase
        .from('documentos')
        .select('id, folio, tipo, created_at, paciente_id, pacientes(nombre, apellidos)')
        .eq('folio', folio)
        .maybeSingle()
      setDocumento(data ?? null)
      setResults([])
      setLoading(false)
      setSelected(0)
      return
    }

    setDocumento(null)
    const qNorm = q.trim().replace(/\s+/g, ' ')
    const { data } = await supabase
      .from('pacientes')
      .select('id, nombre, apellidos, fecha_nacimiento, numero_expediente, sexo')
      .neq('activo', false)
      .or(`nombre.ilike.%${qNorm}%,apellidos.ilike.%${qNorm}%`)
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

  /* Lo tecleado tiene forma de folio: el buscador está en modo documento. */
  const esFolio = normalizarFolio(query) !== null

  /*
    Total de opciones navegables: resultados + opción "Crear" si aplica.
    En modo folio no se ofrece crear: nadie quiere un paciente llamado
    «RX-2026-0042».
  */
  const mostrarOpcionCrear = !esFolio && query.trim().length >= 2 && !loading && results.length < 8
  const totalOpciones = results.length + (mostrarOpcionCrear ? 1 : 0)

  function handleKey(e: React.KeyboardEvent) {
    if (modoCrear) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, totalOpciones - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (documento) { abrirDocumento(documento); return }
      if (results[selected]) { navegar(results[selected].id); return }
      if (mostrarOpcionCrear && selected === results.length) abrirCrear()
    }
  }

  function navegar(id: string) {
    setOpen(false)
    router.push(isSecretary ? '/expediente' : `/expediente/${id}`)
  }

  /*
    Un folio lleva al expediente de SU paciente, a la pestaña de documentos:
    quien busca por folio ya sabe qué documento quiere y lo que le falta es el
    contexto. La secretaria va al listado, como en `navegar()`: la regla de a
    dónde puede entrar cada rol no cambia por haber llegado desde un folio.
  */
  function abrirDocumento(doc: DocumentoConFolio) {
    setOpen(false)
    router.push(isSecretary ? '/expediente' : `/expediente/${doc.paciente_id}/documentos`)
  }

  function abrirCrear() {
    const { nombre, apellidos } = parsearNombre(query)
    setFormNombre(nombre)
    setFormApellidos(apellidos)
    setModoCrear(true)
  }

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    if (!formNombre.trim()) return
    setCreando(true)
    try {
      const res = await fetch('/api/pacientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formNombre.trim(),
          apellidos: formApellidos.trim(),
          sexo: null,
          fecha_nacimiento: formFechaNac || null,
          consentimiento_otorgado: formConsentimiento,
          ...(forceCreateRef.current ? { forceCreate: true } : {}),
        }),
      })
      const data = await res.json()

      if (res.status === 409 && data.error === 'DUPLICATE_PATIENT') {
        setDuplicateWarning(data as DuplicatePatientResponse)
        return
      }

      if (data.id) {
        setOpen(false)
        setDuplicateWarning(null)
        router.push(isSecretary ? '/expediente' : `/expediente/${data.id}`)
      }
    } finally {
      setCreando(false)
      forceCreateRef.current = false
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-start justify-center pt-[15vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-slide-up"
        style={{ animationDuration: '0.2s' }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── MODO BÚSQUEDA ───────────────────────────────── */}
        {!modoCrear && (
          <>
            {/* Input */}
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
                placeholder="Buscar paciente por nombre o documento por folio..."
                className="flex-1 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none bg-transparent"
              />
              <button onClick={() => setOpen(false)} className="text-slate-300 hover:text-slate-500 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Resultado por folio — uno como mucho: el índice es único */}
            {documento && (
              <ul className="py-2">
                <li>
                  <button
                    onClick={() => abrirDocumento(documento)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <FileText size={15} className="text-[#1e5fa8]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 text-sm truncate">
                        <span className="font-mono">{documento.folio}</span>
                        {' · '}
                        {ETIQUETA_TIPO[documento.tipo] ?? documento.tipo}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {nombreDePaciente(documento.pacientes)}
                        {' · '}
                        {new Date(documento.created_at).toLocaleDateString('es-MX', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </div>
                    <ArrowRight size={14} className="text-slate-400 flex-shrink-0" />
                  </button>
                </li>
              </ul>
            )}

            {/* Resultados */}
            {(results.length > 0 || mostrarOpcionCrear) && (
              <ul className="py-2 max-h-80 overflow-y-auto">
                {results.map((p, i) => {
                  const edad = p.fecha_nacimiento
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
                            {edad !== null ? edad.textoElegante : ''}
                            {edad !== null && p.sexo ? ' · ' : ''}
                            {p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Femenino' : ''}
                            {p.numero_expediente ? ` · ${p.numero_expediente}` : ''}
                          </p>
                        </div>
                        {activo && <ArrowRight size={14} className="text-slate-400 flex-shrink-0" />}
                      </button>
                    </li>
                  )
                })}

                {/* Opción registro rápido */}
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
                        <p className="text-xs text-emerald-600/70 mt-0.5">Registro rápido — solo nombre, teléfono y motivo</p>
                      </div>
                      {selected === results.length && <ArrowRight size={14} className="text-emerald-500 flex-shrink-0" />}
                    </button>
                  </li>
                )}
              </ul>
            )}

            {/* Sin resultados (sin mostrar la opción de crear, que ya está arriba) */}
            {query && !loading && results.length === 0 && !documento && !mostrarOpcionCrear && (
              <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                {esFolio ? <FileText size={32} className="opacity-30" /> : <User size={32} className="opacity-30" />}
                <p className="text-sm">Sin resultados para &quot;{query}&quot;</p>
                {/*
                  En modo folio el vacío es ambiguo y hay que desambiguarlo: el
                  folio puede no existir, o existir y ser de otro médico —la RLS
                  lo oculta—, o ser de los 421 documentos anteriores a la
                  columna, que llevan el folio dentro de `contenido` y no aquí.
                  Sin esta línea, las tres se leen como «no existe».
                */}
                {esFolio && (
                  <p className="text-xs text-center px-8 leading-relaxed">
                    Ningún documento tuyo con ese folio. Los emitidos antes del
                    folio correlativo no se encuentran por aquí.
                  </p>
                )}
              </div>
            )}

            {!query && (
              <div className="px-4 py-3 text-xs text-slate-400 flex items-center justify-between">
                <span>Nombre del paciente, o folio del documento</span>
                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">Esc</span>
              </div>
            )}

            <div className="px-4 py-2 border-t border-slate-100 flex gap-4 text-[10px] text-slate-400">
              <span><kbd className="font-mono bg-slate-100 px-1 rounded">↑↓</kbd> navegar</span>
              <span><kbd className="font-mono bg-slate-100 px-1 rounded">↵</kbd> abrir</span>
              <span><kbd className="font-mono bg-slate-100 px-1 rounded">Esc</kbd> cerrar</span>
            </div>
          </>
        )}

        {/* ── MODO REGISTRO RÁPIDO ────────────────────────── */}
        {modoCrear && (
          <form ref={formRef} onSubmit={handleCrear}>
            {/* Header */}
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
              <button type="button" onClick={() => setOpen(false)} className="text-slate-300 hover:text-slate-500">
                <X size={16} />
              </button>
            </div>

            {duplicateWarning && (
              <div className="px-4 pt-4">
                <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
                  <p className="mb-3 text-sm font-semibold text-amber-800">
                    ⚠️ Este paciente ya está en tu lista de pacientes:{' '}
                    {duplicateWarning.existingPatient.nombre} {duplicateWarning.existingPatient.apellidos}
                    {duplicateWarning.existingPatient.numero_expediente && (
                      <> (Exp. #{duplicateWarning.existingPatient.numero_expediente})</>
                    )}
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const id = duplicateWarning.existingPatient.id;
                        setDuplicateWarning(null);
                        setOpen(false);
                        router.push(isSecretary ? '/expediente' : `/expediente/${id}`);
                      }}
                      className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Ir a su expediente
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        forceCreateRef.current = true;
                        setDuplicateWarning(null);
                        formRef.current?.requestSubmit();
                      }}
                      className="w-full rounded-xl border-2 border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
                    >
                      Es otra persona, crear de todos modos
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicateWarning(null)}
                      className="w-full rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Campos */}
            <div className="p-4 space-y-3">
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
                <label className="text-[11px] font-medium text-slate-500 block mb-1">Fecha de nacimiento <span className="text-red-400">*</span></label>
                <input
                  type="date"
                  value={formFechaNac}
                  onChange={e => setFormFechaNac(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e5fa8]/30 focus:border-[#1e5fa8]"
                />
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

            {/* Botones */}
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
                disabled={creando || !formNombre.trim() || !formFechaNac || !formConsentimiento}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#1e5fa8] rounded-xl hover:bg-[#1a3a5c] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {creando ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                {creando ? 'Creando...' : 'Crear e ir al expediente'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}
