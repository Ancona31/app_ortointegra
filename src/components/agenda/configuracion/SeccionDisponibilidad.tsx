'use client'

/**
 * «Disponibilidad» en la pantalla de configuración (B4 + B5; P6 y P7): los
 * consultorios activos que la RLS deja ver —el médico, los suyos; la
 * secretaria, todos los de la clínica—, cada uno con el horario que manda para
 * ofrecer turnos. Cada médico edita sólo los suyos.
 *
 * ⚠️ LA AGENDA NO LEE ESTO (P6): la rejilla, «Compactar» y los avisos de fuera
 * de horario siguen con el horario de la clínica. Esto decide los turnos que
 * se ofrecen (reserva por enlace, bloque D).
 */
import FilaDisponibilidad from '@/components/agenda/configuracion/FilaDisponibilidad'
import type { ActualizarConfig } from '@/components/agenda/configuracion/ConfiguracionCalendario'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import type { Horario, MedicoConfig } from '@/lib/configApp'
import type { Consultorio } from '@/types'

interface Props {
  /** `null` mientras el agregado no ha llegado o si falló (`fallo`). */
  consultorios: Consultorio[] | null
  fallo: boolean
  horarioClinica: Horario | null
  medicos: readonly MedicoConfig[]
  usuarioId: string
  actualizarConfig: ActualizarConfig
}

export default function SeccionDisponibilidad({ consultorios, fallo, horarioClinica, medicos, usuarioId, actualizarConfig }: Props) {
  const nombreDe = (id: string) => {
    const m = medicos.find(x => x.id === id)
    return m ? componerNombreMedicoCompleto(m) : null
  }
  return (
    <section aria-labelledby="config-disponibilidad" className="rounded-2xl border border-[var(--ag-border-card)] bg-[var(--ag-surface)] p-5 space-y-4">
      <div>
        <h2 id="config-disponibilidad" className="text-base font-semibold text-[var(--ag-text)]">Disponibilidad por consultorio</h2>
        <p className="text-sm text-[var(--ag-muted)]">
          Qué horario se ofrece en cada consultorio: el de la clínica o uno propio. Cada médico cambia el de sus consultorios. La agenda sigue pintando el horario de la clínica.
        </p>
      </div>
      {!consultorios ? (
        <p className="text-sm text-[var(--ag-muted)]">{fallo ? 'No se pudieron cargar los consultorios. Recarga la página.' : 'Cargando los consultorios…'}</p>
      ) : consultorios.length === 0 ? (
        <p className="text-sm text-[var(--ag-muted)]">No hay consultorios activos.</p>
      ) : (
        <ul className="divide-y divide-[var(--ag-border-card)]">
          {consultorios.map(c => (
            <FilaDisponibilidad key={c.id} consultorio={c} horarioClinica={horarioClinica} esDueno={c.medico_id === usuarioId}
              nombreMedico={nombreDe(c.medico_id)} actualizarConfig={actualizarConfig} />
          ))}
        </ul>
      )}
    </section>
  )
}
