'use client'

/**
 * Los enlaces de reserva de UN médico en la pantalla de configuración: su
 * enlace fijo (o el botón para crearlo), sus enlaces de un solo uso vigentes y
 * el alta de uno nuevo. La lista ya llega filtrada a los vigentes por el
 * servidor (`GET /api/agenda/enlaces`). Lo monta `SeccionEnlacesReserva`.
 */
import { useState, type FormEvent } from 'react'
import FilaEnlaceReserva from '@/components/agenda/configuracion/FilaEnlaceReserva'
import type { EnlaceReserva } from '@/lib/reserva/gestionReserva'

const FECHA = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
const BOTON_PRIMARIO = 'px-3 py-2 rounded-xl text-sm font-semibold text-white bg-[#1e5fa8] hover:bg-[#1a4f8c] disabled:opacity-50'
const CAMPO = 'px-2 py-1.5 text-sm rounded-lg border border-[var(--ag-border-card)] bg-[var(--ag-surface)] text-[var(--ag-text)]'

interface Props {
  /** `null` = sin título (quien mira sólo ve los suyos). */
  nombre: string | null
  enlaces: EnlaceReserva[]
  /** La dirección completa de cada enlace cuyo código ya se pidió. */
  urls: Record<string, string>
  ocupado: boolean
  puedeEmitir: boolean
  vigenciaDias: number | null
  onCrearFijo: () => void
  onRegenerar: () => void
  onEmitirUnico: (etiqueta: string | null) => Promise<void>
  onMostrar: (id: string) => void
  onRevocar: (e: EnlaceReserva) => void
}

export default function BloqueEnlacesMedico(p: Props) {
  const [etiqueta, setEtiqueta] = useState('')
  const fijo = p.enlaces.find(e => e.clase === 'fijo') ?? null
  const unicos = p.enlaces.filter(e => e.clase === 'unico')
  async function emitirUnico(ev: FormEvent): Promise<void> {
    ev.preventDefault()
    await p.onEmitirUnico(etiqueta.trim() || null)
    setEtiqueta('')
  }
  return (
    <div className="space-y-2 border-t border-[var(--ag-border-card)] pt-4">
      {p.nombre && <h3 className="text-sm font-semibold text-[var(--ag-text)]">{p.nombre}</h3>}
      <ul className="divide-y divide-[var(--ag-border-card)]">
        {fijo ? (
          <FilaEnlaceReserva titulo="Enlace fijo" detalle={`desde el ${FECHA.format(new Date(fijo.created_at))}`}
            url={p.urls[fijo.id] ?? null} ocupado={p.ocupado} onMostrar={() => p.onMostrar(fijo.id)}
            onRevocar={() => p.onRevocar(fijo)} onRegenerar={p.puedeEmitir ? p.onRegenerar : undefined} />
        ) : (
          <li className="py-2 flex flex-wrap items-center gap-3">
            <span className="text-sm text-[var(--ag-muted)]">Sin enlace fijo.</span>
            {p.puedeEmitir && <button type="button" className={BOTON_PRIMARIO} disabled={p.ocupado} onClick={p.onCrearFijo}>Crear enlace fijo</button>}
          </li>
        )}
        {unicos.map(e => (
          <FilaEnlaceReserva key={e.id} titulo={e.etiqueta ? `Un solo uso · ${e.etiqueta}` : 'Un solo uso'}
            detalle={e.caduca_en ? `caduca el ${FECHA.format(new Date(e.caduca_en))}` : ''} url={p.urls[e.id] ?? null}
            ocupado={p.ocupado} onMostrar={() => p.onMostrar(e.id)} onRevocar={() => p.onRevocar(e)} />
        ))}
      </ul>
      {p.puedeEmitir && (
        <form onSubmit={ev => void emitirUnico(ev)} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm text-[var(--ag-text)]">Etiqueta (opcional)
            <input className={`${CAMPO} w-56`} value={etiqueta} maxLength={60} onChange={ev => setEtiqueta(ev.target.value)}
              placeholder="Para uso interno" />
          </label>
          <button type="submit" className={BOTON_PRIMARIO} disabled={p.ocupado}>Emitir enlace de un solo uso</button>
          {p.vigenciaDias !== null && (
            <span className="text-sm text-[var(--ag-muted)]">Vale {p.vigenciaDias} {p.vigenciaDias === 1 ? 'día' : 'días'} y una sola reserva.</span>
          )}
        </form>
      )}
    </div>
  )
}
