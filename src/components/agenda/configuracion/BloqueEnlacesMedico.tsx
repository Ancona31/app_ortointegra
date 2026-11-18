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
 * G2 (punto 5): con un enlace ya creado, la caja la abre «Completar» en su
 * fila (la maqueta); sin enlace, sale sola encima de «Crear enlace fijo», para
 * que crearlo nunca deje un callejón sin salida.
 */
import { useState, type FormEvent } from 'react'
import FilaEnlaceReserva from '@/components/agenda/configuracion/FilaEnlaceReserva'
import FaltaParaEnlace from '@/components/agenda/configuracion/FaltaParaEnlace'
import { BOTON_FILA, BOTON_PRIMARIO, BOTON_SECUNDARIO, CAMPO, TEXTO_SUAVE } from '@/components/agenda/configuracion/clasesConfig'
import { avisoDeEnlace, type MotivoApertura } from '@/lib/reserva/aperturaEnlace'

/** Lo que se arregla desde la ficha (lo demás lo decide la base o ya pasó). */
const ARREGLABLES: readonly MotivoApertura[] = ['sin_consultorio', 'sin_tipos', 'sin_disponibilidad']
import type { EnlaceReserva } from '@/lib/reserva/gestionReserva'

const FECHA = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })

interface Props {
  medicoId: string
  /** `null` = sin título (quien mira sólo ve los suyos). */
  nombre: string | null
  enlaces: EnlaceReserva[]
  /** Por qué el enlace de este médico no abriría; `null` si no se pudo calcular. */
  motivos: MotivoApertura[] | null
  esPropio: boolean
  /** Lo que le falta a quien mira ya lo pide «Primeros pasos»: aquí, sólo a petición. */
  faltaEnPasos?: boolean
  puedeCrearTipos: boolean
  alCrearTipo: () => void
  /** La dirección completa de cada enlace cuyo código ya se pidió. */
  urls: Record<string, string>
  ocupado: boolean
  puedeEmitir: boolean
  vigenciaDias: number | null
  onCrearFijo: () => void
  onRegenerar: () => void
  onEmitirUnico: (etiqueta: string | null, correo: string | null) => Promise<void>
  onMostrar: (id: string) => void
  onRevocar: (e: EnlaceReserva) => void
}

/**
 * El alta de un enlace de un solo uso, con su etiqueta interna opcional y
 * (tanda J, punto 3) el correo del paciente, opcional: el comprobante y los
 * avisos de esa cita van sólo ahí, nunca al que teclee quien reserva.
 */
function FormUnico(p: { ocupado: boolean; vigenciaDias: number | null; onEmitir: (etiqueta: string | null, correo: string | null) => Promise<void> }) {
  const [etiqueta, setEtiqueta] = useState('')
  const [correo, setCorreo] = useState('')
  async function emitirUnico(ev: FormEvent): Promise<void> {
    ev.preventDefault()
    await p.onEmitir(etiqueta.trim() || null, correo.trim() || null)
    setEtiqueta('')
    setCorreo('')
  }
  return (
    <form onSubmit={ev => void emitirUnico(ev)} className="flex flex-wrap items-end gap-[var(--ag-3)]">
      <label className="flex min-w-0 flex-1 basis-56 flex-col gap-[var(--ag-1)] text-sm text-[var(--ag-text)]">Etiqueta (opcional)
        <input className={CAMPO} value={etiqueta} maxLength={60} onChange={ev => setEtiqueta(ev.target.value)}
          placeholder="Para uso interno" />
      </label>
      <label className="flex min-w-0 flex-1 basis-56 flex-col gap-[var(--ag-1)] text-sm text-[var(--ag-text)]">Correo del paciente (opcional)
        <input className={CAMPO} type="email" autoComplete="off" value={correo} maxLength={254} onChange={ev => setCorreo(ev.target.value)} />
      </label>
      <button type="submit" className={BOTON_SECUNDARIO} disabled={p.ocupado}>Emitir enlace de un solo uso</button>
      {p.vigenciaDias !== null && (
        <span className={`basis-full ${TEXTO_SUAVE}`}>
          Uno de un solo uso vale {p.vigenciaDias} {p.vigenciaDias === 1 ? 'día' : 'días'} y una sola reserva.
        </span>
      )}
      <span className={`basis-full ${TEXTO_SUAVE}`}>El comprobante y los avisos de la cita irán sólo a este correo; sin él, no se manda ninguno.</span>
    </form>
  )
}

/** Sin enlace fijo: la frase, «Ver qué falta» si «Primeros pasos» ya lo pide, y «Crear enlace fijo». */
function SinFijo(p: { verFalta: boolean; onVerFalta?: () => void; puedeEmitir: boolean; ocupado: boolean; onCrearFijo: () => void }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-[var(--ag-3)] py-[var(--ag-2)]">
      <span className={TEXTO_SUAVE}>Aún no hay enlace fijo: se comparte una vez y sirve siempre.</span>
      {p.verFalta && <button type="button" className={BOTON_FILA} onClick={p.onVerFalta}>Ver qué falta</button>}
      {p.puedeEmitir && <button type="button" className={BOTON_PRIMARIO} disabled={p.ocupado} onClick={p.onCrearFijo}>Crear enlace fijo</button>}
    </li>
  )
}

/** K3 (punto 14): el fijo que su médico apagó sin revocar; al prenderlo, la misma dirección. */
const AVISO_PAUSADO = 'No abrirá: el enlace está apagado. Al prenderlo vuelve a servir la misma dirección.'

export default function BloqueEnlacesMedico(p: Props) {
  const [completando, setCompletando] = useState(false)
  const fijo = p.enlaces.find(e => e.clase === 'fijo') ?? null
  const unicos = p.enlaces.filter(e => e.clase === 'unico')
  const aviso = p.motivos ? avisoDeEnlace(p.motivos) : null
  const arreglable = p.motivos?.some(m => ARREGLABLES.includes(m)) ?? false
  const completar = arreglable ? () => setCompletando(c => !c) : undefined
  const verFalta = Boolean(p.motivos) && (completando || (p.enlaces.length === 0 && !p.faltaEnPasos))
  return (
    <div className="flex flex-col gap-[var(--ag-3)] border-t border-[var(--ag-border-card)] pt-[var(--ag-4)]">
      {p.nombre && <h4 className="text-sm font-semibold text-[var(--ag-text)]">{p.nombre}</h4>}
      {verFalta && p.motivos && (
        <FaltaParaEnlace motivos={p.motivos} medicoId={p.medicoId} esPropio={p.esPropio} puedeCrearTipos={p.puedeCrearTipos}
          alResolver={() => { setCompletando(false); p.alCrearTipo() }} />
      )}
      <ul className="divide-y divide-[var(--ag-border-card)]">
        {fijo ? (
          <FilaEnlaceReserva titulo="Enlace fijo" detalle={`desde el ${FECHA.format(new Date(fijo.created_at))}`}
            aviso={fijo.pausado_en ? AVISO_PAUSADO : aviso}
            textoAbre={fijo.pausado_en ? 'Apagado' : 'Activo'} onCompletar={completar}
            url={p.urls[fijo.id] ?? null} ocupado={p.ocupado} onMostrar={() => p.onMostrar(fijo.id)}
            onRevocar={() => p.onRevocar(fijo)} onRegenerar={p.puedeEmitir ? p.onRegenerar : undefined} />
        ) : (
          <SinFijo verFalta={p.faltaEnPasos === true && completar !== undefined && !completando} onVerFalta={completar}
            puedeEmitir={p.puedeEmitir} ocupado={p.ocupado} onCrearFijo={p.onCrearFijo} />
        )}
        {unicos.map(e => (
          <FilaEnlaceReserva key={e.id} titulo={e.etiqueta ? `Un solo uso · ${e.etiqueta}` : 'Un solo uso'} aviso={aviso}
            textoAbre="Sin usar" onCompletar={completar}
            detalle={e.caduca_en ? `caduca el ${FECHA.format(new Date(e.caduca_en))}` : ''} url={p.urls[e.id] ?? null}
            ocupado={p.ocupado} onMostrar={() => p.onMostrar(e.id)} onRevocar={() => p.onRevocar(e)} />
        ))}
      </ul>
      {p.puedeEmitir && <FormUnico ocupado={p.ocupado} vigenciaDias={p.vigenciaDias} onEmitir={p.onEmitirUnico} />}
    </div>
  )
}
