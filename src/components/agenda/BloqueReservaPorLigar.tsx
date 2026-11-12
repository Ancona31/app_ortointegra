'use client'

/**
 * D6 · Quién reservó una cita POR LIGAR, en el modal de la cita: nombre,
 * teléfono y correo que dejó (los datos se quedan en la cita también después
 * de ligarla, lista A punto 9), su historial EN VIVO con ese médico y el botón
 * de bloquear o desbloquear su autoservicio (candado de §2).
 *
 * Ocupa el sitio del campo de paciente mientras la cita no tiene paciente: no
 * hay buscador aquí. La cita se liga al iniciar la consulta (D7).
 *
 * El historial y el botón sólo existen con la agenda v2 encendida (las rutas
 * dan 404 apagado); sin ella queda la instantánea que trajo la reserva. Quién
 * puede bloquear lo decide el servidor (lista A, punto 16); `puedeGestionar`
 * sólo evita ofrecer un botón condenado a un 403.
 */
import { useEffect, useState } from 'react'
import { frasearHistorial, type HistorialContacto } from '@/lib/reserva/gestionReserva'

const FECHA = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' })

interface Props {
  citaId: string
  nombre: string
  telefono: string | null
  correo: string | null
  /** La instantánea de la reserva (cancelaciones + inasistencias al reservar). */
  historialPrevio: number
  enVivo: boolean
  puedeGestionar: boolean
}

type Estado = HistorialContacto | 'error' | null

function esHistorial(x: unknown): x is HistorialContacto {
  return typeof x === 'object' && x !== null && 'bloqueado' in x && typeof x.bloqueado === 'boolean'
    && 'manual' in x && typeof x.manual === 'boolean'
    && 'cancelaciones' in x && typeof x.cancelaciones === 'number' && 'no_shows' in x && typeof x.no_shows === 'number'
}

async function leerHistorial(citaId: string): Promise<HistorialContacto | 'error'> {
  try {
    const res = await fetch(`/api/agenda/reservas/historial?cita=${citaId}`, { cache: 'no-store' })
    if (!res.ok) return 'error'
    const json: unknown = await res.json()
    const h = json && typeof json === 'object' && 'historial' in json ? json.historial : null
    return esHistorial(h) ? h : 'error'
  } catch {
    return 'error'
  }
}

/** Si está bloqueado, por qué y hasta cuándo; `null` si no. */
function lineaBloqueo(h: Estado): string | null {
  if (!esHistorial(h) || !h.bloqueado) return null
  if (h.manual) return 'Bloqueado a mano para reservar por el enlace'
  return `Bloqueado para reservar por el enlace${h.hasta ? ` hasta el ${FECHA.format(new Date(h.hasta))}` : ''}`
}

/** La línea del historial en vivo, o de la instantánea mientras no llega. */
function lineaHistorial(h: Estado, previo: number): string {
  if (h === null || h === 'error') {
    return previo > 0 ? `Al reservar traía ${previo} ${previo === 1 ? 'cancelación o inasistencia' : 'cancelaciones o inasistencias'}` : 'Sin historial al reservar'
  }
  const frase = frasearHistorial(h.cancelaciones, h.no_shows)
  return frase ? `Con este médico: ${frase}` : 'Sin cancelaciones ni inasistencias recientes con este médico'
}

export default function BloqueReservaPorLigar(p: Props) {
  const [historial, setHistorial] = useState<Estado>(null)
  const [ocupado, setOcupado] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  useEffect(() => {
    if (!p.enVivo) return
    let vivo = true
    void leerHistorial(p.citaId).then(h => { if (vivo) setHistorial(h) })
    return () => { vivo = false }
  }, [p.citaId, p.enVivo])

  async function marcar(accion: 'bloquear' | 'desbloquear'): Promise<void> {
    setOcupado(true)
    setFallo(null)
    try {
      const res = await fetch('/api/agenda/reservas/contactos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cita_id: p.citaId, accion }),
      })
      if (!res.ok) setFallo(accion === 'bloquear' ? 'No se pudo bloquear el contacto.' : 'No se pudo desbloquear el contacto.')
      setHistorial(await leerHistorial(p.citaId))
    } catch {
      setFallo('No se pudo guardar el cambio.')
    }
    setOcupado(false)
  }

  const bloqueado = lineaBloqueo(historial) !== null
  return (
    <div className="px-3 py-2.5 rounded-xl border space-y-1.5" style={{ background: 'var(--ag-patient-card-bg)', borderColor: 'var(--ag-patient-card-border)' }}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[.06em] px-1.5 rounded-full border" style={{ color: 'var(--ag-ink-600)', borderColor: 'currentColor' }}>Por ligar</span>
        <span className="text-[11px]" style={{ color: 'var(--ag-muted)' }}>Reservó por enlace</span>
      </div>
      <p className="text-sm font-semibold" style={{ color: 'var(--ag-ink)' }}>{p.nombre}</p>
      {(p.telefono || p.correo) && (
        <p className="text-[12px]" style={{ color: 'var(--ag-brand-secondary)' }}>{[p.telefono, p.correo].filter(Boolean).join(' · ')}</p>
      )}
      <p className="text-[12px]" style={{ color: 'var(--ag-muted)' }}>{lineaHistorial(historial, p.historialPrevio)}</p>
      {bloqueado && <p className="text-[12px] font-semibold text-red-600">{lineaBloqueo(historial)}</p>}
      {p.enVivo && p.puedeGestionar && esHistorial(historial) && (
        <button type="button" disabled={ocupado} onClick={() => void marcar(bloqueado ? 'desbloquear' : 'bloquear')}
          className="text-[12px] font-bold underline-offset-2 hover:underline disabled:opacity-50" style={{ color: 'var(--ag-text)' }}>
          {bloqueado ? 'Desbloquear contacto' : 'Bloquear contacto'}
        </button>
      )}
      {fallo && <p className="text-[12px] text-red-600">{fallo}</p>}
      <p className="text-[11px]" style={{ color: 'var(--ag-muted)' }}>Se liga a un paciente al iniciar la consulta.</p>
    </div>
  )
}
