'use client'

/**
 * src/components/agenda/BuscadorCitas.tsx
 *
 * Buscar las citas de un paciente (bloque F, F3.6, detrás del interruptor).
 * Va detrás de un botón con lupa en la barra de escritorio y en la banda del
 * teléfono; `/` lo enfoca. Archivo nuevo de F3, sin enchufar todavía: el
 * llamador lo pone en su desplegable y, al elegir una cita, hace `gotoDate` +
 * Día y abre su tarjeta.
 *
 * Dos pasos dentro del mismo combobox: primero PACIENTES (y, con v2, citas por
 * ligar cuyo nombre de reserva casa), después las CITAS del paciente elegido.
 * Las consultas son de `buscarCitasPaciente.ts`, con la RLS mandando.
 *
 * Accesibilidad (APG, combobox con lista): `role="combobox"` en el campo, con
 * `aria-expanded`, `aria-controls` y `aria-activedescendant`; la lista es un
 * `listbox` de `option`s. Flechas mueven la opción activa, Enter la elige,
 * Escape limpia y cierra, y un segundo Escape cierra el buscador.
 * El foco NO sale del campo nunca: las opciones se señalan, no se enfocan.
 * Por eso el campo sigue activo en el segundo paso (desactivarlo se llevaría el
 * foco al `<body>` y con él las flechas y Escape): volver a escribir vuelve al
 * primer paso.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import { ArrowLeft, Search } from 'lucide-react'
import type { PacienteBusqueda } from '@/components/agenda/AppointmentModal'
import { STATUS_CONFIG } from '@/lib/agenda/tarjetasAgenda'
import { idDeOpcion, indiceTrasTecla } from '@/lib/agenda/opcionesLista'
import {
  buscarCitasDePaciente, buscarCitasPorLigar, buscarPacientes, limpiarTextoBusqueda, type CitaEncontrada,
} from '@/lib/agenda/buscarCitasPaciente'

interface Props {
  agendaV2: boolean
  alElegirCita: (cita: CitaEncontrada) => void
  alCerrar?: () => void
}

/** Lo que ofrece la lista en cada momento: pacientes (y por ligar) o citas. */
type Opcion =
  | { tipo: 'paciente'; paciente: PacienteBusqueda }
  | { tipo: 'cita'; cita: CitaEncontrada }

const FMT_CITA = new Intl.DateTimeFormat('es-MX', {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
})

function textoCita(c: CitaEncontrada): { principal: string; meta: string } {
  return { principal: FMT_CITA.format(new Date(c.start_time)), meta: `${c.reserva_nombre ?? c.title} · ${STATUS_CONFIG[c.status].label}` }
}

function textoOpcion(o: Opcion): { principal: string; meta: string } {
  if (o.tipo === 'cita') return textoCita(o.cita)
  return { principal: `${o.paciente.nombre} ${o.paciente.apellidos}`, meta: o.paciente.telefono ?? 'Ver sus citas' }
}

/** La búsqueda del primer paso, con espera de 300 ms como el modal. */
function useResultados(texto: string, agendaV2: boolean, activo: boolean): Opcion[] {
  const [opciones, setOpciones] = useState<{ para: string; lista: Opcion[] }>({ para: '', lista: [] })
  const q = limpiarTextoBusqueda(texto)
  useEffect(() => {
    if (!activo || !q) return
    let vigente = true
    const t = setTimeout(async () => {
      const [pacientes, porLigar] = await Promise.all([buscarPacientes(q), agendaV2 ? buscarCitasPorLigar(q) : []])
      if (!vigente) return
      setOpciones({ para: q, lista: [
        ...pacientes.map(p => ({ tipo: 'paciente' as const, paciente: p })),
        ...porLigar.map(c => ({ tipo: 'cita' as const, cita: c })),
      ] })
    }, 300)
    return () => { vigente = false; clearTimeout(t) }
  }, [q, agendaV2, activo])
  return q && opciones.para === q ? opciones.lista : []
}

/**
 * El segundo paso: el paciente elegido y sus citas. `peticion` sube en cada
 * elección y en cada vuelta, así que una respuesta de un paciente anterior (o
 * que llega con el buscador ya desmontado) no pisa la lista del actual.
 */
function usePacienteElegido(): {
  paciente: PacienteBusqueda | null; citas: CitaEncontrada[] | null
  elegirPaciente: (p: PacienteBusqueda) => Promise<void>; volver: () => void
} {
  const [paciente, setPaciente] = useState<PacienteBusqueda | null>(null)
  const [citas, setCitas] = useState<CitaEncontrada[] | null>(null)
  const peticion = useRef(0)
  useEffect(() => () => { peticion.current++ }, [])
  async function elegirPaciente(p: PacienteBusqueda): Promise<void> {
    const mia = ++peticion.current
    setPaciente(p); setCitas(null)
    const lista = await buscarCitasDePaciente(p.id)
    if (mia === peticion.current) setCitas(lista)
  }
  function volver(): void { peticion.current++; setPaciente(null); setCitas(null) }
  return { paciente, citas, elegirPaciente, volver }
}

export default function BuscadorCitas({ agendaV2, alElegirCita, alCerrar }: Props): ReactElement {
  const [texto, setTexto] = useState('')
  const [activa, setActiva] = useState(-1)
  const { paciente, citas, elegirPaciente, volver: volverPaso } = usePacienteElegido()
  const idLista = useId()
  const resultados = useResultados(texto, agendaV2, paciente === null)
  const opciones: Opcion[] = paciente ? (citas ?? []).map(c => ({ tipo: 'cita', cita: c })) : resultados
  const abierta = opciones.length > 0 || (paciente !== null && citas !== null)

  async function elegir(o: Opcion): Promise<void> {
    if (o.tipo === 'cita') { alElegirCita(o.cita); return }
    setActiva(-1)
    await elegirPaciente(o.paciente)
  }
  function volver(): void { volverPaso(); setActiva(-1) }
  function alTeclear(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (texto || paciente) { setTexto(''); volver() } else alCerrar?.()
      return
    }
    if (e.key === 'Enter' && activa >= 0 && opciones[activa]) { e.preventDefault(); void elegir(opciones[activa]); return }
    const i = indiceTrasTecla(activa, opciones.length, e.key, 'vertical')
    if (i !== null) { e.preventDefault(); setActiva(i) }
  }

  return (
    <div className="ag-buscador">
      {paciente && (
        <button type="button" className="ag-capa-boton" onClick={volver}>
          <ArrowLeft size={14} aria-hidden="true" /> {paciente.nombre} {paciente.apellidos}
        </button>
      )}
      <label className="ag-capa-campo">
        <span><Search size={12} aria-hidden="true" /> Buscar citas de un paciente</span>
        <input
          type="search" role="combobox" autoFocus value={texto}
          aria-expanded={abierta} aria-controls={idLista} aria-autocomplete="list"
          aria-activedescendant={activa >= 0 ? idDeOpcion(idLista, activa) : undefined}
          onChange={e => { setTexto(e.target.value); volver() }} onKeyDown={alTeclear}
        />
      </label>
      <ListaOpciones id={idLista} opciones={opciones} activa={activa} alElegir={o => void elegir(o)}
        vacio={paciente && citas?.length === 0 ? 'Sin citas entre hace 30 días y dentro de un año.' : null} />
    </div>
  )
}

interface PropsLista { id: string; opciones: Opcion[]; activa: number; alElegir: (o: Opcion) => void; vacio: string | null }

function ListaOpciones({ id, opciones, activa, alElegir, vacio }: PropsLista): ReactElement | null {
  if (vacio) return <p className="ag-opciones-vacio" role="status">{vacio}</p>
  if (opciones.length === 0) return null
  return (
    <ul id={id} role="listbox" aria-label="Resultados" className="ag-opciones">
      {opciones.map((o, i) => {
        const t = textoOpcion(o)
        return (
          <li key={o.tipo === 'cita' ? o.cita.id : o.paciente.id} id={idDeOpcion(id, i)} role="option"
            aria-selected={i === activa} className="ag-opcion"
            onMouseDown={e => e.preventDefault()} onClick={() => alElegir(o)}>
            <span>{t.principal}</span>
            <span className="ag-opcion-meta">{t.meta}</span>
          </li>
        )
      })}
    </ul>
  )
}
