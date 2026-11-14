'use client'

/**
 * «¿Cuánto dura tu consulta?» (G2, puntos 7 y 8 de Angel): 30 min, 45 min,
 * 1 hora u otra. Con la respuesta se crea POR DENTRO el tipo de cita
 * principal del médico (`principal: true`, nombre «Consulta»); ninguno nace con
 * un valor fijo. Con `consultorioId`, la duración distinta SÓLO en ese
 * consultorio (otro principal, con su consultorio). Con `editarId`, cambia la
 * duración de uno que ya existe (sólo quien administra: `tipos_cita_update`).
 *
 * Lo usan «Primeros pasos», la ficha del enlace que no abrirá, el horario de
 * cada consultorio y la sección de duración. Quién puede lo deciden la ruta y
 * la policy (`tipos_cita_insert`: el administrador, o el médico para sí mismo).
 */
import { useId, useState, type FormEvent } from 'react'
import { BOTON_FILA, BOTON_PRIMARIO, CAMPO } from '@/components/agenda/configuracion/clasesConfig'
import { leerMotivoError } from '@/components/agenda/configuracion/leerMotivoError'
import { CrearTipoCitaSchema, EditarTipoCitaSchema, LIMITES_TIPO_CITA } from '@/lib/agenda/tiposCita'

/** Las tres de Angel; «Otra» abre el campo. */
const OPCIONES = [{ min: 30, texto: '30 min' }, { min: 45, texto: '45 min' }, { min: 60, texto: '1 hora' }] as const

/** Una opción: botón de dos estados hecho con el radio (marcado = borde y tinta de marca). */
const OPCION = 'inline-flex h-11 min-w-[4.5rem] cursor-pointer items-center justify-center rounded-[var(--ag-r-btn)] border border-[var(--ag-border-card)] '
  + 'bg-[var(--ag-surface)] px-[var(--ag-3)] text-sm font-medium text-[var(--ag-text)] '
  + 'has-[:checked]:border-[var(--ag-brand-secondary)] has-[:checked]:bg-[var(--ag-primary-bg-faint)] has-[:checked]:text-[var(--ag-brand-legible)] '
  + 'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ag-brand-secondary)]'

/** El nombre del tipo que se crea por dentro (no se le pregunta a nadie). */
export const NOMBRE_CONSULTA = 'Consulta'

interface Props {
  medicoId: string
  consultorioId?: string | null
  /** Cambia la duración de este tipo en vez de crear uno. */
  editarId?: string
  /** La pregunta, p. ej. «¿Cuánto dura tu consulta?». */
  pregunta: string
  actual?: number | null
  textoBoton?: string
  onHecho: () => void
  onCancelar?: () => void
}

async function guardarDuracion(p: Props, minutos: number): Promise<string | null> {
  const r = p.editarId
    ? EditarTipoCitaSchema.safeParse({ duracion_min: minutos })
    : CrearTipoCitaSchema.safeParse({ nombre: NOMBRE_CONSULTA, duracion_min: minutos, medico_id: p.medicoId,
        principal: true, ...(p.consultorioId ? { consultorio_id: p.consultorioId } : {}) })
  if (!r.success) return r.error.issues[0]?.message ?? 'Duración inválida'
  try {
    const res = await fetch(p.editarId ? `/api/agenda/tipos-cita/${p.editarId}` : '/api/agenda/tipos-cita', {
      method: p.editarId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r.data),
    })
    return res.ok ? null : await leerMotivoError(res, 'No se pudo guardar la duración')
  } catch {
    return 'No se pudo guardar la duración'
  }
}

type Eleccion = number | 'otra' | null

/** Las cuatro opciones como radios con aspecto de botón. */
function OpcionesDuracion(p: { nombre: string; pregunta: string; eleccion: Eleccion; elegir: (v: number | 'otra') => void }) {
  return (
    <fieldset className="flex flex-col gap-[var(--ag-2)]">
      <legend className="mb-[var(--ag-2)] text-sm font-medium text-[var(--ag-text)]">{p.pregunta}</legend>
      <div className="flex flex-wrap gap-[var(--ag-2)]">
        {[...OPCIONES.map(o => ({ v: o.min as number | 'otra', texto: o.texto })), { v: 'otra' as const, texto: 'Otra' }].map(o => (
          <label key={String(o.v)} className={OPCION}>
            <input type="radio" name={p.nombre} className="sr-only" checked={p.eleccion === o.v} onChange={() => p.elegir(o.v)} />
            <span>{o.texto}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function DuracionConsulta(p: Props) {
  const id = useId()
  const inicial = p.actual ?? null
  const fija = OPCIONES.some(o => o.min === inicial)
  const [eleccion, setEleccion] = useState<Eleccion>(inicial === null ? null : fija ? inicial : 'otra')
  const [otra, setOtra] = useState(inicial !== null && !fija ? String(inicial) : '')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const minutos = eleccion === 'otra' ? Number(otra) : eleccion

  async function enviar(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (!minutos) { setError('Elige una duración'); return }
    setGuardando(true)
    const motivo = await guardarDuracion(p, minutos)
    setGuardando(false)
    setError(motivo)
    if (!motivo) p.onHecho()
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-[var(--ag-2)]">
      <OpcionesDuracion nombre={`${id}-dur`} pregunta={p.pregunta} eleccion={eleccion} elegir={v => { setEleccion(v); setError(null) }} />
      {eleccion === 'otra' && (
        <label className="flex items-center gap-[var(--ag-2)] text-sm text-[var(--ag-text)]" htmlFor={`${id}-otra`}>
          <input id={`${id}-otra`} className={`${CAMPO} w-24`} type="number" inputMode="numeric" value={otra}
            min={LIMITES_TIPO_CITA.duracionMin} max={LIMITES_TIPO_CITA.duracionMax} step={LIMITES_TIPO_CITA.pasoDuracion}
            onChange={e => setOtra(e.target.value)} />
          minutos
        </label>
      )}
      <div className="flex flex-wrap items-center gap-[var(--ag-2)]">
        <button type="submit" className={BOTON_PRIMARIO} disabled={guardando || minutos === null}>
          {guardando ? 'Guardando…' : p.textoBoton ?? 'Guardar'}
        </button>
        {p.onCancelar && <button type="button" className={`${BOTON_FILA} h-9`} onClick={p.onCancelar}>Cancelar</button>}
      </div>
      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
    </form>
  )
}
