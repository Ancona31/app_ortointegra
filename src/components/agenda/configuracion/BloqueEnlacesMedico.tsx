'use client'

/**
 * La ficha de enlaces de reserva de UN médico en la pantalla de configuración
 * (tanda T2, punto 9: «el enlace de cada médico vive en su ficha»): su enlace
 * fijo (o el botón para crearlo), sus enlaces de un solo uso vigentes y el
 * alta de uno nuevo. La lista ya llega filtrada a los vigentes por el
 * servidor (`GET /api/agenda/enlaces`). Lo monta `SeccionEnlacesReserva`.
 *
 * Punto 8: cada enlace que no abrirá lleva su aviso (`avisoDeEnlace`, la regla
 * de la página pública) y, si al médico le falta algo, la caja que lo pide ahí
 * mismo (`FaltaParaEnlace`). Crear el enlace se sigue pudiendo: el aviso dice
 * que no abrirá, no lo impide (la opción que menos cambia lo de hoy).
 */
import { useState, type FormEvent } from 'react'
import FilaEnlaceReserva from '@/components/agenda/configuracion/FilaEnlaceReserva'
import FaltaParaEnlace from '@/components/agenda/configuracion/FaltaParaEnlace'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO, CAMPO, TEXTO_SUAVE } from '@/components/agenda/configuracion/clasesConfig'
import { avisoDeEnlace, type MotivoApertura } from '@/lib/reserva/aperturaEnlace'
import type { EnlaceReserva } from '@/lib/reserva/gestionReserva'

const FECHA = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

interface Props {
  /** `null` = sin título (quien mira sólo ve los suyos). */
  nombre: string | null
  enlaces: EnlaceReserva[]
  /** Por qué el enlace de este médico no abriría; `null` si no se pudo calcular. */
  motivos: MotivoApertura[] | null
  esPropio: boolean
  puedeCrearTipos: boolean
  alCrearTipo: () => void
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
  const aviso = p.motivos ? avisoDeEnlace(p.motivos) : null
  async function emitirUnico(ev: FormEvent): Promise<void> {
    ev.preventDefault()
    await p.onEmitirUnico(etiqueta.trim() || null)
    setEtiqueta('')
  }
  return (
    <div className="flex flex-col gap-[var(--ag-3)] border-t border-[var(--ag-border-card)] pt-[var(--ag-4)]">
      {p.nombre && <h4 className="text-sm font-semibold text-[var(--ag-text)]">{p.nombre}</h4>}
      {p.motivos && (
        <FaltaParaEnlace motivos={p.motivos} esPropio={p.esPropio} puedeCrearTipos={p.puedeCrearTipos} alResolver={p.alCrearTipo} />
      )}
      <ul className="divide-y divide-[var(--ag-border-card)]">
        {fijo ? (
          <FilaEnlaceReserva titulo="Enlace fijo" detalle={`desde el ${FECHA.format(new Date(fijo.created_at))}`} aviso={aviso}
            url={p.urls[fijo.id] ?? null} ocupado={p.ocupado} onMostrar={() => p.onMostrar(fijo.id)}
            onRevocar={() => p.onRevocar(fijo)} onRegenerar={p.puedeEmitir ? p.onRegenerar : undefined} />
        ) : (
          <li className="flex flex-wrap items-center justify-between gap-[var(--ag-3)] py-[var(--ag-2)]">
            <span className={TEXTO_SUAVE}>Aún no hay enlace fijo: se comparte una vez y sirve siempre.</span>
            {p.puedeEmitir && <button type="button" className={BOTON_PRIMARIO} disabled={p.ocupado} onClick={p.onCrearFijo}>Crear enlace fijo</button>}
          </li>
        )}
        {unicos.map(e => (
          <FilaEnlaceReserva key={e.id} titulo={e.etiqueta ? `Un solo uso · ${e.etiqueta}` : 'Un solo uso'} aviso={aviso}
            detalle={e.caduca_en ? `caduca el ${FECHA.format(new Date(e.caduca_en))}` : ''} url={p.urls[e.id] ?? null}
            ocupado={p.ocupado} onMostrar={() => p.onMostrar(e.id)} onRevocar={() => p.onRevocar(e)} />
        ))}
      </ul>
      {p.puedeEmitir && (
        <form onSubmit={ev => void emitirUnico(ev)} className="flex flex-wrap items-end gap-[var(--ag-3)]">
          <label className="flex min-w-0 flex-1 basis-56 flex-col gap-[var(--ag-1)] text-sm text-[var(--ag-text)]">Etiqueta (opcional)
            <input className={CAMPO} value={etiqueta} maxLength={60} onChange={ev => setEtiqueta(ev.target.value)}
              placeholder="Para uso interno" />
          </label>
          <button type="submit" className={BOTON_SECUNDARIO} disabled={p.ocupado}>Emitir enlace de un solo uso</button>
          {p.vigenciaDias !== null && (
            <span className={`basis-full ${TEXTO_SUAVE}`}>
              Uno de un solo uso vale {p.vigenciaDias} {p.vigenciaDias === 1 ? 'día' : 'días'} y una sola reserva.
            </span>
          )}
        </form>
      )}
    </div>
  )
}
