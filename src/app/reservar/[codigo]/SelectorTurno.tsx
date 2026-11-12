'use client'

import { useEffect, useState, type ReactElement } from 'react'
import { etiquetaDia, horaEnZona, hoyEn, leerDias, mensajeDeError, pedir, sumarDias, type DiaPagina, type TurnoPagina } from './clienteReserva'

interface Props {
  codigo: string
  consultorioId: string
  tipoId: string
  zona: string
  onElegir: (t: TurnoPagina) => void
}

type Estado = { tipo: 'cargando' } | { tipo: 'error'; texto: string } | { tipo: 'listo'; dias: DiaPagina[] }

/** Una semana de turnos libres del consultorio y tipo elegidos. Sólo libre u ocupado. */
export default function SelectorTurno({ codigo, consultorioId, tipoId, zona, onElegir }: Props): ReactElement {
  const [desde, setDesde] = useState(() => hoyEn(zona))
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' })

  useEffect(() => {
    let vivo = true
    const q = new URLSearchParams({ consultorio: consultorioId, tipo: tipoId, desde })
    pedir(`/api/reservar/${encodeURIComponent(codigo)}/turnos?${q}`, 'GET').then(r => {
      if (!vivo) return
      setEstado(r.status === 200 ? { tipo: 'listo', dias: leerDias(r.cuerpo) } : { tipo: 'error', texto: mensajeDeError(r) })
    })
    return () => { vivo = false }
  }, [codigo, consultorioId, tipoId, desde])

  const cambiarSemana = (dias: number) => { setEstado({ tipo: 'cargando' }); setDesde(d => sumarDias(d, dias)) }
  const hoy = hoyEn(zona)

  return (
    <section aria-label="Horarios disponibles" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="text-sm text-[#1e5fa8] disabled:text-slate-300" disabled={desde <= hoy}
          onClick={() => cambiarSemana(-7)}>Semana anterior</button>
        <button type="button" className="text-sm text-[#1e5fa8]" onClick={() => cambiarSemana(7)}>Semana siguiente</button>
      </div>
      {estado.tipo === 'cargando' && <p className="text-sm text-slate-500">Buscando horarios…</p>}
      {estado.tipo === 'error' && <p role="alert" className="text-sm text-red-700">{estado.texto}</p>}
      {estado.tipo === 'listo' && estado.dias.every(d => d.turnos.length === 0) && (
        <p className="text-sm text-slate-500">No hay horarios libres esta semana.</p>
      )}
      {estado.tipo === 'listo' && estado.dias.filter(d => d.turnos.length > 0).map(d => (
        <div key={d.fecha}>
          <h3 className="text-sm font-medium text-slate-700 capitalize">{etiquetaDia(d.fecha)}</h3>
          <ul className="mt-1 flex flex-wrap gap-2">
            {d.turnos.map(t => (
              <li key={t.inicio}>
                <button type="button" data-inicio={t.inicio} onClick={() => onElegir(t)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 hover:border-[#1e5fa8] hover:text-[#1e5fa8]">
                  {horaEnZona(t.inicio, zona)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
