'use client'

/**
 * «Disponibilidad» en la pantalla de configuración (B4 + B5; P6 y P7): los
 * consultorios activos que la RLS deja ver —el médico, los suyos; la
 * secretaria, todos los de la clínica—, cada uno con el horario que manda para
 * ofrecer turnos. Cada médico edita sólo los suyos.
 *
 * Decide los turnos que se ofrecen (reserva por enlace, bloque D) y, desde la
 * tanda G4 (puntos 10 a 13), también lo que pinta la agenda: con la v2 la
 * rejilla se dibuja con el horario de los consultorios (`fuenteDeLaRejilla`).
 */
import Link from 'next/link'
import TarjetaSeccion from '@/components/agenda/configuracion/TarjetaSeccion'
import { TEXTO_SUAVE } from '@/components/agenda/configuracion/clasesConfig'
import FilaDisponibilidad from '@/components/agenda/configuracion/FilaDisponibilidad'
import type { ActualizarConfig } from '@/components/agenda/configuracion/ConfiguracionCalendario'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import type { Horario, MedicoConfig } from '@/lib/configApp'
import type { Consultorio } from '@/types'
import type { TipoCita } from '@/lib/agenda/tiposCita'

interface Props {
  /** `null` mientras el agregado no ha llegado o si falló (`fallo`). */
  consultorios: Consultorio[] | null
  fallo: boolean
  horarioClinica: Horario | null
  medicos: readonly MedicoConfig[]
  usuarioId: string
  actualizarConfig: ActualizarConfig
  /** Tras guardar: «Primeros pasos» y los avisos de los enlaces se recalculan. */
  alCambiar?: () => void
  /** G2: la duración distinta por consultorio vive en su fila. */
  tipos?: readonly TipoCita[] | null
  alCambiarTipos?: () => void
}

export default function SeccionDisponibilidad(props: Props) {
  const { consultorios, fallo, horarioClinica, medicos, usuarioId, actualizarConfig, alCambiar } = props
  const nombreDe = (id: string) => {
    const m = medicos.find(x => x.id === id)
    return m ? componerNombreMedicoCompleto(m) : null
  }
  return (
    <TarjetaSeccion id="config-disponibilidad" titulo="Disponibilidad por consultorio"
      ayuda="Qué días y horas atiende cada consultorio. Si uno no tiene horario propio, usa el de la clínica. Cada médico cambia los de sus consultorios.">
      {!consultorios ? (
        <p className={TEXTO_SUAVE}>{fallo ? 'No se pudieron cargar los consultorios. Recarga la página.' : 'Cargando los consultorios…'}</p>
      ) : consultorios.length === 0 ? (
        <p className={TEXTO_SUAVE}>
          Aún no hay consultorios activos. Se dan de alta en{' '}
          <Link href="/perfil" className="font-medium text-[var(--ag-text)] underline underline-offset-2">Mi perfil</Link>.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--ag-border-card)]">
          {consultorios.map(c => (
            <FilaDisponibilidad key={c.id} consultorio={c} horarioClinica={horarioClinica} esDueno={c.medico_id === usuarioId}
              nombreMedico={nombreDe(c.medico_id)} actualizarConfig={actualizarConfig} alCambiar={alCambiar}
              tipos={props.tipos} alCambiarTipos={props.alCambiarTipos} />
          ))}
        </ul>
      )}
    </TarjetaSeccion>
  )
}
