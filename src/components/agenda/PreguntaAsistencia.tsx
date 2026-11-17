'use client'

/**
 * src/components/agenda/PreguntaAsistencia.tsx — Tanda I (punto 11 de Angel).
 *
 * UNA ventana, al abrir la agenda, con las citas agendadas o confirmadas cuya
 * hora pasó hace más de 48 horas y siguen sin nota clínica (las calcula el
 * servidor: `asistenciaServidor.ts`, y viajan con la página). Por cada una:
 * «Sí asistió» → atendida; «No asistió» → no asistió. «Decidir después» (o la
 * ✕, o Escape) cierra sin cambiar nada; vuelve a salir la próxima vez que se
 * abra la agenda. Sin ofrecer la nota: sólo cierra el ciclo de la cita.
 *
 * NADA CAMBIA SOLO: cada respuesta es el mismo PUT de siempre
 * (`cambiarEstadoCita`, con su firma, su auditoría y, en una cita nacida de
 * una reserva, la incidencia del candado al marcar «No asistió»).
 *
 * Detrás del interruptor: sólo se monta con la v2 (`AgendaCliente`), dentro del
 * chunk de `HerramientasV2`. Si la promesa trae `null` o nada, no pinta nada.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import ModalShell from '@/components/ui/ModalShell'
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from '@/components/agenda/configuracion/clasesConfig'
import { horaEnTZ } from '@/lib/agenda/fechasAgenda'
import type { CambiarEstadoCita } from '@/lib/agenda/contratosV2'
import type { CitaPorAsistir } from '@/lib/agenda/asistenciaServidor'

export interface PropsPreguntaAsistencia {
  /** La lista del servidor (`page.tsx`); `null` = no se pregunta. */
  pendientes: Promise<CitaPorAsistir[] | null>
  /** El PUT de la agenda; sin él no hay con qué responder y no se pregunta. */
  cambiarEstado?: CambiarEstadoCita
  zonaVisor: string
}

type Respuesta = 'attended' | 'no_show'

/** La lista UNA vez por apertura de la agenda: lo que se responde sale de ella. */
function useCitasPorAsistir(pendientes: Promise<CitaPorAsistir[] | null>): [CitaPorAsistir[] | null, (id: string) => void] {
  const [citas, setCitas] = useState<CitaPorAsistir[] | null>(null)
  useEffect(() => {
    let vigente = true
    pendientes.then(
      lista => { if (vigente && lista && lista.length > 0) setCitas(lista) },
      () => {},
    )
    return () => { vigente = false }
  }, [pendientes])
  const quitar = (id: string): void => setCitas(c => (c ? c.filter(x => x.id !== id) : c))
  return [citas, quitar]
}

/** «Mar 17 nov · 10:00» en la zona de quien mira. Copia del formato de `cuandoDeTarjeta`
    (accionesTarjeta): importarlo partía ese módulo en un archivo aparte, uno más al abrir la agenda. */
function cuandoDeFila(inicio: string, zona: string): string {
  try {
    const partes = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: zona })
      .formatToParts(new Date(inicio))
    const parte = (t: string): string => (partes.find(p => p.type === t)?.value ?? '').replace('.', '')
    const semana = parte('weekday')
    return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${parte('day')} ${parte('month')} · ${horaEnTZ(inicio, zona)}`
  } catch {
    return horaEnTZ(inicio, zona)
  }
}

interface PropsFila { cita: CitaPorAsistir; zonaVisor: string; responder: (cita: CitaPorAsistir, r: Respuesta) => void; ocupada: boolean }

function FilaAsistencia({ cita, zonaVisor, responder, ocupada }: PropsFila): ReactElement {
  const cuando = cuandoDeFila(cita.start_time, zonaVisor)
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5" data-asistencia-cita={cita.id}>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold" style={{ color: 'var(--ag-text)' }}>{cita.nombre}</p>
        <p className="text-xs" style={{ color: 'var(--ag-muted2)' }}>{cuando}</p>
      </div>
      <div className="flex gap-2">
        {/* El nombre accesible dice de quién: en la lista se repiten. */}
        <button type="button" className={BOTON_PRIMARIO} disabled={ocupada} aria-label={`Sí asistió: ${cita.nombre}, ${cuando}`}
          onClick={() => responder(cita, 'attended')}>Sí asistió</button>
        <button type="button" className={BOTON_SECUNDARIO} disabled={ocupada} aria-label={`No asistió: ${cita.nombre}, ${cuando}`}
          onClick={() => responder(cita, 'no_show')}>No asistió</button>
      </div>
    </li>
  )
}

export default function PreguntaAsistencia({ pendientes, cambiarEstado, zonaVisor }: PropsPreguntaAsistencia): ReactElement | null {
  const [citas, quitar] = useCitasPorAsistir(pendientes)
  const [cerrada, setCerrada] = useState(false)
  const [enVuelo, setEnVuelo] = useState<string | null>(null)
  const despuesRef = useRef<HTMLButtonElement>(null)
  if (!cambiarEstado || cerrada || !citas || citas.length === 0) return null
  /* La fila respondida sale de la lista: el foco pasa a «Decidir después», no al vacío. */
  const responder = (cita: CitaPorAsistir, r: Respuesta): void => {
    setEnVuelo(cita.id)
    void cambiarEstado(cita.id, r)
      .then(ok => { if (ok) { quitar(cita.id); despuesRef.current?.focus() } })
      .finally(() => setEnVuelo(null))
  }
  const despues = (): void => setCerrada(true)
  return (
    <ModalShell
      open onClose={despues} title="¿Asistió el paciente?"
      subtitle="Más de 48 horas y sin nota clínica."
      footer={<div className="flex justify-end px-5 py-3"><button ref={despuesRef} type="button" className={BOTON_SECUNDARIO} onClick={despues}>Decidir después</button></div>}
    >
      <ul className="divide-y px-5" style={{ borderColor: 'var(--ag-border-card)' }} aria-label="Citas por cerrar">
        {citas.map(c => (
          <FilaAsistencia key={c.id} cita={c} zonaVisor={zonaVisor} responder={responder} ocupada={enVuelo !== null} />
        ))}
      </ul>
    </ModalShell>
  )
}
