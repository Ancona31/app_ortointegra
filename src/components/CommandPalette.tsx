'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, User, X, Loader2, UserPlus, ChevronLeft, ChevronRight, FileText } from 'lucide-react'
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
    /* B4 del rediseño · la paleta, ANCLADA ARRIBA y centrada en el área de
       contenido (CALMA §28), con el velo del kit. Ahora es un diálogo de verdad:
       `role="dialog"`, `aria-modal` y nombre (PLAN §7.1). Su colocación por
       formato (barra, riel, franjas) vive en `globals.css`, `.nav-paleta`. Los
       textos no cambian: tampoco la promesa del registro rápido ni la cita
       legal, que son deuda anotada aparte. */
    <div className="nav-paleta" role="dialog" aria-modal="true" aria-label="Buscar paciente o folio"
      onClick={() => setOpen(false)}>
      <div className="nav-capa-velo" aria-hidden="true" />
      <div className="nav-paleta-tarjeta" onClick={e => e.stopPropagation()}>
        {!modoCrear && (
          <>
            <CampoBusqueda inputRef={inputRef} query={query} loading={loading}
              alEscribir={setQuery} alTeclear={handleKey} alCerrar={() => setOpen(false)} />
            {documento && <FilaDocumento documento={documento} alAbrir={() => abrirDocumento(documento)} />}
            {(results.length > 0 || mostrarOpcionCrear) && (
              <ul className="nav-paleta-lista">
                {results.map((p, i) => (
                  <FilaPaciente key={p.id} p={p} activo={i === selected}
                    alAbrir={() => navegar(p.id)} alPasar={() => setSelected(i)} />
                ))}
                {mostrarOpcionCrear && (
                  <FilaCrear query={query} activo={selected === results.length}
                    alAbrir={abrirCrear} alPasar={() => setSelected(results.length)} />
                )}
              </ul>
            )}
            {query && !loading && results.length === 0 && !documento && !mostrarOpcionCrear && (
              <SinResultados query={query} esFolio={esFolio} />
            )}
            {!query && (
              <p className="px-4 py-3 text-[13px] text-tinta2">Nombre del paciente, o folio del documento</p>
            )}
            <div className="nav-paleta-teclas">
              <span><kbd>↑↓</kbd> navegar</span>
              <span><kbd>↵</kbd> abrir</span>
              <span><kbd>Esc</kbd> cerrar</span>
            </div>
          </>
        )}

        {modoCrear && (
          <form ref={formRef} onSubmit={handleCrear}>
            <CabeceraRegistro alVolver={() => setModoCrear(false)} alCerrar={() => setOpen(false)} />
            {duplicateWarning && (
              <AvisoDuplicado aviso={duplicateWarning}
                alIr={() => {
                  const id = duplicateWarning.existingPatient.id
                  setDuplicateWarning(null)
                  setOpen(false)
                  router.push(isSecretary ? '/expediente' : `/expediente/${id}`)
                }}
                alCrearIgual={() => {
                  forceCreateRef.current = true
                  setDuplicateWarning(null)
                  formRef.current?.requestSubmit()
                }}
                alCancelar={() => setDuplicateWarning(null)} />
            )}
            <CamposRegistro nombre={formNombre} apellidos={formApellidos} fecha={formFechaNac}
              consentimiento={formConsentimiento} alNombre={setFormNombre} alApellidos={setFormApellidos}
              alFecha={setFormFechaNac} alConsentimiento={setFormConsentimiento} />
            <div className="nav-paleta-pie">
              <button type="button" onClick={() => setModoCrear(false)} className="k-b-tonal">Cancelar</button>
              <button type="submit" className="k-b-prim inline-flex items-center gap-2"
                disabled={creando || !formNombre.trim() || !formFechaNac || !formConsentimiento}>
                {creando ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
                {creando ? 'Creando...' : 'Crear e ir al expediente'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

/* ─── Piezas de la paleta (B4) ────────────────────────────────────────────── */

interface CampoBusquedaProps {
  inputRef: React.RefObject<HTMLInputElement | null>
  query: string
  loading: boolean
  alEscribir: (v: string) => void
  alTeclear: (e: React.KeyboardEvent) => void
  alCerrar: () => void
}

function CampoBusqueda({ inputRef, query, loading, alEscribir, alTeclear, alCerrar }: CampoBusquedaProps) {
  return (
    <div className="nav-paleta-campo">
      {loading
        ? <Loader2 size={18} className="flex-none animate-spin text-tinta2" aria-hidden="true" />
        : <Search size={18} className="flex-none text-tinta2" aria-hidden="true" />}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={e => alEscribir(e.target.value)}
        onKeyDown={alTeclear}
        aria-label="Buscar paciente por nombre o documento por folio"
        placeholder="Buscar paciente por nombre o documento por folio..."
        className="min-w-0 flex-1 bg-transparent text-tinta placeholder:text-tinta3 focus:outline-none"
      />
      <button type="button" onClick={alCerrar} aria-label="Cerrar" className="nav-paleta-icono">
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  )
}

/** Resultado por folio — uno como mucho: el índice es único. */
function FilaDocumento({ documento, alAbrir }: { documento: DocumentoConFolio; alAbrir: () => void }) {
  return (
    <ul className="nav-paleta-lista">
      <li>
        <button type="button" onClick={alAbrir} className="nav-paleta-fila" data-activa="true">
          <span className="nav-paleta-avatar bg-tonal text-tonal-tinta" aria-hidden="true"><FileText size={16} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-tinta">
              <span className="k-num">{documento.folio}</span>{' · '}{ETIQUETA_TIPO[documento.tipo] ?? documento.tipo}
            </span>
            <span className="block truncate text-[13px] text-tinta2">
              {nombreDePaciente(documento.pacientes)}{' · '}
              {new Date(documento.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </span>
          <ChevronRight size={18} className="flex-none text-tinta3" aria-hidden="true" />
        </button>
      </li>
    </ul>
  )
}

interface FilaProps { activo: boolean; alAbrir: () => void; alPasar: () => void }

function FilaPaciente({ p, activo, alAbrir, alPasar }: FilaProps & { p: Paciente }) {
  const edad = p.fecha_nacimiento ? calcularEdad(p.fecha_nacimiento) : null
  return (
    <li>
      <button type="button" onClick={alAbrir} onMouseEnter={alPasar} className="nav-paleta-fila"
        data-activa={activo ? 'true' : undefined}>
        <span className="nav-paleta-avatar bg-tonal text-tonal-tinta" aria-hidden="true">{p.nombre[0]}{p.apellidos[0]}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-tinta">{p.nombre} {p.apellidos}</span>
          <span className="block truncate text-[13px] text-tinta2">
            {edad !== null ? edad.textoElegante : ''}
            {edad !== null && p.sexo ? ' · ' : ''}
            {p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Femenino' : ''}
            {p.numero_expediente ? ` · ${p.numero_expediente}` : ''}
          </span>
        </span>
        <ChevronRight size={18} className="flex-none text-tinta3" aria-hidden="true" />
      </button>
    </li>
  )
}

function FilaCrear({ query, activo, alAbrir, alPasar }: FilaProps & { query: string }) {
  return (
    <li className="border-t border-linea">
      <button type="button" onClick={alAbrir} onMouseEnter={alPasar} className="nav-paleta-fila"
        data-activa={activo ? 'true' : undefined}>
        <span className="nav-paleta-avatar bg-ok-fondo text-ok-tinta" aria-hidden="true"><UserPlus size={16} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ok-tinta">
            Crear registro para: <span className="font-bold">&quot;{query}&quot;</span>
          </span>
          <span className="block text-[13px] text-tinta2">Registro rápido — solo nombre, teléfono y motivo</span>
        </span>
        <ChevronRight size={18} className="flex-none text-tinta3" aria-hidden="true" />
      </button>
    </li>
  )
}

/* Sin resultados (sin mostrar la opción de crear, que ya está arriba). En modo
   folio el vacío es ambiguo y hay que desambiguarlo: el folio puede no existir,
   o existir y ser de otro médico —la RLS lo oculta—, o ser de los documentos
   anteriores a la columna, que llevan el folio dentro de `contenido`. Sin la
   segunda línea, las tres se leen como «no existe». */
function SinResultados({ query, esFolio }: { query: string; esFolio: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-tinta2">
      {esFolio ? <FileText size={32} className="opacity-40" aria-hidden="true" /> : <User size={32} className="opacity-40" aria-hidden="true" />}
      <p className="text-[15px]">Sin resultados para &quot;{query}&quot;</p>
      {esFolio && (
        <p className="text-[13px] leading-[18px]">
          Ningún documento tuyo con ese folio. Los emitidos antes del
          folio correlativo no se encuentran por aquí.
        </p>
      )}
    </div>
  )
}

function CabeceraRegistro({ alVolver, alCerrar }: { alVolver: () => void; alCerrar: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b border-linea px-2 py-2">
      <button type="button" onClick={alVolver} aria-label="Volver a la búsqueda" className="nav-paleta-icono">
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-bold leading-[22px] text-tinta">Registro rápido</p>
        <p className="text-[13px] text-tinta2">Puedes completar el expediente después</p>
      </div>
      <button type="button" onClick={alCerrar} aria-label="Cerrar" className="nav-paleta-icono">
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  )
}

interface AvisoDuplicadoProps {
  aviso: DuplicatePatientResponse
  alIr: () => void
  alCrearIgual: () => void
  alCancelar: () => void
}

function AvisoDuplicado({ aviso, alIr, alCrearIgual, alCancelar }: AvisoDuplicadoProps) {
  return (
    <div className="px-4 pt-4">
      <div className="rounded-[16px] bg-aviso-fondo p-4">
        <p className="mb-3 text-[15px] font-semibold text-aviso-tinta">
          ⚠️ Este paciente ya está en tu lista de pacientes:{' '}
          {aviso.existingPatient.nombre} {aviso.existingPatient.apellidos}
          {aviso.existingPatient.numero_expediente && (
            <> (Exp. #{aviso.existingPatient.numero_expediente})</>
          )}
        </p>
        {/* Tres salidas apiladas, la principal arriba (CALMA §23.7). */}
        <div className="flex flex-col gap-2">
          <button type="button" onClick={alIr} className="k-b-prim w-full">Ir a su expediente</button>
          <button type="button" onClick={alCrearIgual} className="k-b-tonal w-full">Es otra persona, crear de todos modos</button>
          <button type="button" onClick={alCancelar} className="k-b-texto w-full">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

interface CamposRegistroProps {
  nombre: string
  apellidos: string
  fecha: string
  consentimiento: boolean
  alNombre: (v: string) => void
  alApellidos: (v: string) => void
  alFecha: (v: string) => void
  alConsentimiento: (v: boolean) => void
}

function CamposRegistro(c: CamposRegistroProps) {
  return (
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="k-etq-campo mb-1 block text-[13px] font-semibold text-tinta2">Nombre <span className="text-mal-tinta">*</span></span>
          <input autoFocus type="text" value={c.nombre} onChange={e => c.alNombre(e.target.value)} required
            placeholder="Juan" className="k-campo nav-paleta-input" />
        </label>
        <label className="block">
          <span className="k-etq-campo mb-1 block text-[13px] font-semibold text-tinta2">Apellidos</span>
          <input type="text" value={c.apellidos} onChange={e => c.alApellidos(e.target.value)}
            placeholder="García López" className="k-campo nav-paleta-input" />
        </label>
      </div>
      <label className="block">
        <span className="k-etq-campo mb-1 block text-[13px] font-semibold text-tinta2">Fecha de nacimiento <span className="text-mal-tinta">*</span></span>
        <input type="date" value={c.fecha} onChange={e => c.alFecha(e.target.value)} required className="k-campo nav-paleta-input" />
      </label>
      <label className="flex cursor-pointer items-start gap-2">
        <input type="checkbox" checked={c.consentimiento} onChange={e => c.alConsentimiento(e.target.checked)}
          className="mt-0.5 h-5 w-5 flex-none accent-[var(--accion)]" />
        <span className="text-[13px] leading-[18px] text-tinta2">
          {/* Privacidad 2026-12: el mismo texto de las cuatro altas, sin enlace y sin artículo. */}
          Informé al paciente del aviso de privacidad del consultorio <span className="text-mal-tinta">*</span>
        </span>
      </label>
    </div>
  )
}
