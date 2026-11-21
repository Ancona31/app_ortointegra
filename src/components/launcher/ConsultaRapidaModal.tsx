'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Search, User, X, ArrowRight, Loader2, UserPlus, ChevronLeft, AlertTriangle } from 'lucide-react'
import Avatar, { inicialesDe } from '@/components/ui/Avatar'
import { useCapaMontada } from '@/components/ui/ModalShell'
import Portal from '@/components/ui/Portal'
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

/** A dónde entra el paciente elegido. El default es la consulta, que es el
 *  flujo con el que nació este modal. */
const A_NUEVA_NOTA = (id: string) => `/expediente/${id}/nueva-nota`

interface Props {
  open: boolean
  onClose: () => void
  /**
   * Ruta a la que se navega con el paciente ya resuelto — se elija de la lista,
   * se acabe de crear o se vincule un duplicado. Los CUATRO caminos de salida
   * pasan por aquí; si añades un quinto, hazlo pasar también.
   *
   * ⚠️ NO ES UNA URL SINO UNA FUNCIÓN, y el motivo es que el id no existe
   * todavía cuando el host monta el modal: en el alta rápida lo devuelve
   * `POST /api/pacientes` a mitad del flujo.
   *
   * Omitirla deja el comportamiento original intacto: «Nueva consulta» no pasa
   * nada y sigue entrando a la nota.
   */
  destino?: (id: string) => string
  /** Rótulo del botón que cierra el alta rápida. El default nombra la consulta. */
  rotuloCrear?: string
  /**
   * Qué se está creando, dicho durante la búsqueda.
   *
   * ⚠️ EXISTE PARA QUE NO SE REPITA UN DEFECTO CONOCIDO. En la pantalla que este
   * flujo sustituye, quien entraba por «Receta médica» del menú pasaba el paso
   * de elegir paciente sin ninguna señal de que la receta seguía elegida, y
   * acababa dudando si tendría que volver a decirlo. El tipo viaja: lo que
   * faltaba era enseñarlo.
   *
   * Omitirla no pinta nada — «Nueva consulta» entra por el botón que ya lo
   * dice, así que no necesita repetirlo.
   */
  titulo?: string
}

export default function ConsultaRapidaModal({
  open,
  onClose,
  destino = A_NUEVA_NOTA,
  rotuloCrear = 'Crear e iniciar consulta',
  titulo,
}: Props) {
  const router = useRouter()
  const { profile } = useProfile()
  const esMedicoInvitado = profile?.role === 'medico' && profile?.es_admin_de_clinica !== true
  const [offlineMsg, setOfflineMsg] = useState("")
  const montada = useCapaMontada(open)

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
    router.push(destino(id))
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
        navegar(data.id as string)
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
      // Éxito: mismo flujo que la creación normal → entrar con el paciente existente
      navegar(duplicateWarning.id)
    } catch {
      setVincularError('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.')
      setVinculando(false)
    }
  }

  if (!montada) return null

  /* Capa del catálogo (rediseño B3; `.k-capa` de `sistema.css`), anclada
     ARRIBA en el área de contenido (`data-modo="arriba"`): es un buscador, y
     con el teclado virtual una hoja desde abajo quedaría tapada. Sale animada
     (`useCapaMontada`); mientras sale, inerte. En un portal: montada dentro
     de la barra lateral o de una página, su velo no tapaba la navegación. */
  return (
    <Portal>
    <div
      className="k-capa fixed inset-0 z-[9998]" data-modo="arriba" data-fase={open ? 'abierta' : 'sale'}
      data-variante={modoCrear && duplicateWarning ? 'alerta' : undefined}
      inert={!open || undefined} aria-hidden={!open || undefined}
    >
      <div className="k-velo" onClick={onClose} />

      <div className="k-capa-panel max-w-lg" lang="es">
        {offlineMsg && (
          <p className="mx-4 mt-3 rounded-[10px] bg-mal-fondo px-3 py-2 text-[13px] leading-[18px] text-mal-tinta">{offlineMsg}</p>
        )}

        {!modoCrear && (
          <>
            {titulo && <p className="k-t-rotulo px-5 pt-3.5">{titulo}</p>}
            <div className={`flex items-center gap-3 pl-5 pr-2 border-b border-linea ${titulo ? 'pt-1 pb-2' : 'py-2'}`}>
              {loading
                ? <Loader2 size={20} className="text-tinta3 animate-spin flex-shrink-0" />
                : <Search size={20} className="text-tinta3 flex-shrink-0" />
              }
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Buscar paciente por nombre..."
                className="flex-1 min-w-0 h-11 bg-transparent text-[16px] text-tinta placeholder:text-tinta3 focus:outline-none esc:text-[15px] ih:text-[15px]"
              />
              <button type="button" onClick={onClose} className="k-b k-b-icono" aria-label="Cerrar">
                <X aria-hidden="true" />
              </button>
            </div>

            {(results.length > 0 || mostrarOpcionCrear) && (
              <ul className="k-lista py-1 max-h-80 overflow-y-auto overscroll-contain">
                {results.map((p, i) => {
                  const edadInfo = p.fecha_nacimiento
                    ? calcularEdad(p.fecha_nacimiento)
                    : null
                  const activo = i === selected
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => navegar(p.id)}
                        onMouseEnter={() => setSelected(i)}
                        className={`k-fila px-5 ${activo ? 'bg-fondo' : ''}`}
                      >
                        <Avatar texto={inicialesDe(p.nombre, p.apellidos)} indice={i} />
                        <span className="k-fila-t">
                          <span className="k-fila-n truncate">{p.nombre} {p.apellidos}</span>
                          <span className="k-fila-s">
                            {edadInfo ? edadInfo.textoElegante : ''}
                            {edadInfo && p.sexo ? ' · ' : ''}
                            {p.sexo === 'M' ? 'Masculino' : p.sexo === 'F' ? 'Femenino' : ''}
                            {p.numero_expediente ? ` · ${p.numero_expediente}` : ''}
                          </span>
                        </span>
                        {activo && <ArrowRight size={16} className="k-fila-chev" />}
                      </button>
                    </li>
                  )
                })}

                {mostrarOpcionCrear && (
                  <li>
                    <button
                      type="button"
                      onClick={abrirCrear}
                      onMouseEnter={() => setSelected(results.length)}
                      className={`k-fila px-5 ${selected === results.length ? 'bg-fondo' : ''}`}
                    >
                      <span className="k-avatar bg-tonal text-enlace"><UserPlus size={18} aria-hidden="true" /></span>
                      <span className="k-fila-t">
                        <span className="k-fila-n text-enlace">
                          Crear registro para: <span className="font-bold">&quot;{query}&quot;</span>
                        </span>
                        <span className="k-fila-s">Registro rápido — nombre, teléfono y motivo</span>
                      </span>
                      {selected === results.length && <ArrowRight size={16} className="k-fila-chev" />}
                    </button>
                  </li>
                )}
              </ul>
            )}

            {query && !loading && results.length === 0 && !mostrarOpcionCrear && (
              <div className="flex flex-col items-center gap-2 py-10 text-tinta2">
                <User size={32} className="text-tinta3" aria-hidden="true" />
                <p className="text-[15px]">Sin resultados para &quot;{query}&quot;</p>
              </div>
            )}

            {!query && (
              <p className="px-5 py-3 text-[13px] leading-[18px] text-tinta2">
                Escribe el nombre del paciente para buscarlo o registrarlo
              </p>
            )}

            <div className="px-5 py-2 border-t border-linea flex gap-4 text-[12px] leading-4 text-tinta2 ext:hidden tel:hidden">
              <span><kbd className="font-mono bg-sup2 px-1 rounded">↑↓</kbd> navegar</span>
              <span><kbd className="font-mono bg-sup2 px-1 rounded">↵</kbd> abrir</span>
              <span><kbd className="font-mono bg-sup2 px-1 rounded">Esc</kbd> cerrar</span>
            </div>
          </>
        )}

        {modoCrear && (
          <form onSubmit={handleCrear} className="flex min-h-0 flex-1 flex-col">
            {duplicateWarning ? (
              <div className="k-al">
                <span className="k-al-i k-al-i-avisar" aria-hidden="true"><AlertTriangle /></span>
                <h2 className="k-al-tit">Paciente duplicado</h2>
                <div className="k-al-t">
                  {duplicateWarning.existingPatientIsMine ? (
                    <p>
                      Este paciente ya está en tu lista de pacientes: {duplicateWarning.nombre} {duplicateWarning.apellidos}
                      {duplicateWarning.numero_expediente ? ` (Exp. #${duplicateWarning.numero_expediente})` : ''}
                    </p>
                  ) : esMedicoInvitado ? (
                    <p>
                      Este paciente ya está registrado en tu clínica, pero no aparece en tu lista porque aún no es tu paciente: {duplicateWarning.nombre} {duplicateWarning.apellidos}
                      {duplicateWarning.numero_expediente ? ` (Exp. #${duplicateWarning.numero_expediente})` : ''}. ¿Deseas vincularlo a tus pacientes?
                    </p>
                  ) : (
                    <p>
                      Ya existe un paciente con los mismos datos: {duplicateWarning.nombre} {duplicateWarning.apellidos}
                      {duplicateWarning.numero_expediente ? ` (Exp. #${duplicateWarning.numero_expediente})` : ''}. ¿Es el mismo paciente o una persona distinta?
                    </p>
                  )}
                  <p>Si es otra persona, se creará el registro de todos modos.</p>
                  {vincularError && <p className="k-campo-error">{vincularError}</p>}
                </div>
                <div className="k-al-b k-al-pila">
                  {duplicateWarning.existingPatientIsMine ? (
                    <button type="button" data-principal onClick={() => navegar(duplicateWarning.id)} className="k-b k-b-capa k-b-prim">
                      Ir a su expediente
                    </button>
                  ) : (
                    <button type="button" data-principal onClick={handleVincular} disabled={vinculando} className="k-b k-b-capa k-b-prim">
                      {vinculando ? <><Loader2 size={16} className="animate-spin" /> Vinculando...</> : 'Es el mismo paciente'}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={vinculando}
                    onClick={e => {
                      setDuplicateWarning(null)
                      setVincularError(null)
                      forceCreateRef.current = true
                      /* El formulario de ESTA capa, no el primero del documento
                         (`document.querySelector('form')` podía dar con otro de
                         la página de detrás). */
                      e.currentTarget.form?.requestSubmit()
                    }}
                    className="k-b k-b-capa k-b-tonal"
                  >
                    Es otra persona
                  </button>
                  <button
                    type="button"
                    disabled={vinculando}
                    onClick={() => { setDuplicateWarning(null); setVincularError(null) }}
                    className="k-b k-b-capa k-b-quieto"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="k-capa-cab pl-2 ext:pl-1">
                  <button type="button" onClick={() => setModoCrear(false)} className="k-b k-b-icono" aria-label="Volver">
                    <ChevronLeft aria-hidden="true" />
                  </button>
                  <div className="k-capa-tits">
                    <h2 className="k-capa-tit">Registro rápido</h2>
                    <p className="k-capa-sub">Puedes completar el expediente después</p>
                  </div>
                  <button type="button" onClick={onClose} className="k-b k-b-icono" aria-label="Cerrar">
                    <X aria-hidden="true" />
                  </button>
                </div>

                <div className="k-capa-cuerpo">
                  <div className="px-6 pt-2 pb-5 ext:px-5 flex flex-col gap-3.5">
                    {formError && <p className="k-campo-error">{formError}</p>}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="k-campo-g">
                        <label className="k-etiqueta">Nombre <span className="text-mal-tinta">*</span></label>
                        <input autoFocus type="text" value={formNombre} onChange={e => setFormNombre(e.target.value)}
                          required placeholder="Juan" className="k-campo" />
                      </div>
                      <div className="k-campo-g">
                        <label className="k-etiqueta">Apellidos</label>
                        <input type="text" value={formApellidos} onChange={e => setFormApellidos(e.target.value)}
                          placeholder="García López" className="k-campo" />
                      </div>
                    </div>
                    <div className="k-campo-g">
                      <label className="k-etiqueta">Fecha de nacimiento</label>
                      <input type="date" value={formFechaNac} onChange={e => setFormFechaNac(e.target.value)}
                        min={FECHA_MIN_NACIMIENTO} max={fechaHoyISO()} className="k-campo" />
                      {formFechaNac && <p className="k-campo-ayuda">{calcularEdad(formFechaNac).textoElegante}</p>}
                      <p className="k-campo-ayuda">Recomendable para que la edad aparezca en recetas y documentos. Si se deja vacío, el campo edad quedará en blanco.</p>
                    </div>
                    {/* La casilla a la DERECHA de su texto (CALMA §20). */}
                    <label className="flex items-center gap-3 cursor-pointer min-h-11">
                      <span className="flex-1 text-[13px] leading-[18px] text-tinta2">
                        El paciente ha leído y acepta el{' '}
                        <a href="/privacidad" target="_blank" className="font-semibold text-enlace underline">Aviso de Privacidad</a>
                        {' '}(LFPDPPP Art. 9) <span className="text-mal-tinta">*</span>
                      </span>
                      <input type="checkbox" checked={formConsentimiento} onChange={e => setFormConsentimiento(e.target.checked)}
                        className="size-5 flex-none accent-[var(--accion)]" />
                    </label>
                  </div>
                </div>

                <div className="k-capa-pie flex justify-end gap-2 px-6 pt-3 pb-5 ext:px-4 ext:pb-4 tel:px-5">
                  <button type="button" onClick={() => setModoCrear(false)} className="k-b k-b-capa k-b-quieto ext:flex-auto tel:flex-auto">
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={creando || vinculando || !formNombre.trim() || !formConsentimiento}
                    className="k-b k-b-capa k-b-prim min-w-0 ext:flex-auto tel:flex-auto"
                  >
                    {creando
                      ? <Loader2 size={16} className="animate-spin shrink-0" />
                      : <UserPlus size={16} className="shrink-0" />}
                    <span className="truncate">{creando ? 'Creando...' : rotuloCrear}</span>
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </div>
    </Portal>
  )
}
