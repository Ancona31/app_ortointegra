'use client'

import { useEffect, useState, type ReactElement } from 'react'
import {
  agruparTurnos, etiquetaDia, horaEnZona, hoyEn, leerDias, mensajeDeError, partesDia, pedir, primerDiaConTurnos, rangoSemana,
  sumarDias, type DiaPagina, type TurnoPagina,
} from './clienteReserva'

interface Props {
  codigo: string
  consultorioId: string
  tipoId: string
  zona: string
  /** Primer día de la semana que se enseña (lo guarda el padre para volver a ella). */
  desde: string
  onDesde: (desde: string) => void
  /** El día elegido en la tira, o null. */
  dia: string | null
  onDia: (dia: string | null) => void
  elegido: TurnoPagina | null
  onElegir: (t: TurnoPagina) => void
}

type Estado = { tipo: 'cargando' } | { tipo: 'error'; texto: string } | { tipo: 'listo'; dias: DiaPagina[] }

/** Cargando: la forma de la tira y de la rejilla, sin contenido. */
function Huesos(): ReactElement {
  return (
    <div aria-busy="true" className="rp-grupo">
      <p className="sr-only" role="status">Buscando horarios…</p>
      <div className="rp-dias" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <div key={i} className="rp-hueso rp-hueso--dia" />)}</div>
      <div className="rp-horas" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <div key={i} className="rp-hueso rp-hueso--hora" />)}</div>
    </div>
  )
}

function Tira({ dias, dia, onDia }: { dias: DiaPagina[]; dia: string | null; onDia: (d: string) => void }): ReactElement {
  return (
    <div className="rp-dias" role="group" aria-label="Días de la semana">
      {dias.map(d => {
        const p = partesDia(d.fecha)
        const libre = d.turnos.length > 0
        return (
          <button key={d.fecha} type="button" className="rp-dia" data-fecha={d.fecha} disabled={!libre} aria-pressed={d.fecha === dia}
            aria-label={`${etiquetaDia(d.fecha)}${libre ? '' : ', sin horarios'}`} onClick={() => onDia(d.fecha)}>
            <small>{p.semana}</small><b>{p.numero}</b><i />
          </button>
        )
      })}
    </div>
  )
}

interface PropsGrupo { titulo: string; turnos: TurnoPagina[]; zona: string; elegido: TurnoPagina | null; onElegir: (t: TurnoPagina) => void }

function Grupo({ titulo, turnos, zona, elegido, onElegir }: PropsGrupo): ReactElement {
  return (
    <section className="rp-grupo" aria-label={titulo}>
      <h3 className="rp-etiqueta" style={{ margin: 0 }}>{titulo}</h3>
      {turnos.length === 0 ? <p className="rp-vacio" style={{ margin: 0 }}>Sin horarios</p> : (
        <ul className="rp-horas">
          {turnos.map(t => (
            <li key={t.inicio}>
              <button type="button" className="rp-hora" data-inicio={t.inicio} aria-pressed={elegido?.inicio === t.inicio} onClick={() => onElegir(t)}>
                {horaEnZona(t.inicio, zona)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Una semana de turnos libres: tira de fechas y, debajo, sólo los del día
 * elegido en Mañana y Tarde. Se monta al entrar al paso 2, así que volver a él
 * (también tras un 409 «ocupado») vuelve a pedir la semana.
 */
export default function SelectorTurno(props: Props): ReactElement {
  const { codigo, consultorioId, tipoId, zona, desde, onDesde, dia, onDia, elegido, onElegir } = props
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vivo = true
    const q = new URLSearchParams({ consultorio: consultorioId, tipo: tipoId, desde })
    pedir(`/api/reservar/${encodeURIComponent(codigo)}/turnos?${q}`, 'GET').then(r => {
      if (!vivo) return
      if (r.status !== 200) { setEstado({ tipo: 'error', texto: mensajeDeError(r) }); return }
      const dias = leerDias(r.cuerpo)
      setEstado({ tipo: 'listo', dias })
      if (!dias.some(d => d.fecha === dia && d.turnos.length > 0)) onDia(primerDiaConTurnos(dias))
    })
    return () => { vivo = false }
    // `dia` y `onDia` no van: elegir otro día no vuelve a pedir la semana.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo, consultorioId, tipoId, desde, intento])

  const cambiarSemana = (dias: number) => { setEstado({ tipo: 'cargando' }); onDesde(sumarDias(desde, dias)) }
  const delDia = estado.tipo === 'listo' ? estado.dias.find(d => d.fecha === dia)?.turnos ?? [] : []
  const grupos = agruparTurnos(delDia, zona)

  return (
    <section aria-label="Horarios disponibles" className="rp-grupo" style={{ gap: 'var(--ag-4)' }}>
      <div className="rp-semana">
        <button type="button" className="rp-flecha" aria-label="Semana anterior" disabled={desde <= hoyEn(zona)} onClick={() => cambiarSemana(-7)}>‹</button>
        <span aria-live="polite">{estado.tipo === 'listo' ? rangoSemana(estado.dias) : ''}</span>
        <button type="button" className="rp-flecha" aria-label="Semana siguiente" onClick={() => cambiarSemana(7)}>›</button>
      </div>
      {estado.tipo === 'cargando' && <Huesos />}
      {estado.tipo === 'error' && (
        <div className="rp-grupo">
          <p role="alert" className="rp-nota rp-nota--error">{estado.texto}</p>
          <button type="button" className="rp-btn rp-btn--sec" onClick={() => { setEstado({ tipo: 'cargando' }); setIntento(i => i + 1) }}>Reintentar</button>
        </div>
      )}
      {estado.tipo === 'listo' && <Tira dias={estado.dias} dia={dia} onDia={onDia} />}
      {estado.tipo === 'listo' && !dia && (
        <div className="rp-grupo">
          <p className="rp-vacio" style={{ margin: 0 }}>No hay horarios libres esta semana.</p>
          <button type="button" className="rp-btn rp-btn--sec" onClick={() => cambiarSemana(7)}>Ver la semana siguiente</button>
        </div>
      )}
      {estado.tipo === 'listo' && dia && (
        <>
          <Grupo titulo="Mañana" turnos={grupos.manana} zona={zona} elegido={elegido} onElegir={onElegir} />
          <Grupo titulo="Tarde" turnos={grupos.tarde} zona={zona} elegido={elegido} onElegir={onElegir} />
        </>
      )}
    </section>
  )
}
