import type { ReactElement } from 'react'
import type { ConsultorioPagina, TipoPagina } from './clienteReserva'

interface Props {
  consultorio: ConsultorioPagina
  /** Sólo en los pasos, y sólo si la persona eligió entre varios: el comprobante NO lo lleva (lista A, 10). */
  tipo?: TipoPagina | null
  /** «Viernes, 13 de noviembre · 10:45», o nada si aún no hay hora. */
  cuando?: string | null
  medico?: string | null
  telefono?: boolean
}

/**
 * Lo elegido hasta ahora, en cada paso y en la pantalla final (tanda G1,
 * punto 2): el consultorio va SIEMPRE con su dirección completa, también con
 * un solo consultorio, para que nadie se equivoque de lugar.
 */
export default function ResumenCita({ consultorio, tipo, cuando, medico, telefono }: Props): ReactElement {
  return (
    <dl className="rp-resumen" aria-label="Tu cita">
      {cuando && <><dt>Cuándo</dt><dd>{cuando}</dd></>}
      {medico && <><dt>Médico</dt><dd>{medico}</dd></>}
      <dt>Consultorio</dt>
      <dd data-consultorio>{consultorio.nombre}{consultorio.direccion && <small data-direccion>{consultorio.direccion}</small>}</dd>
      {telefono && consultorio.telefono && <><dt>Teléfono</dt><dd>{consultorio.telefono}</dd></>}
      {tipo && <><dt>Tipo</dt><dd>{tipo.nombre} · {tipo.duracionMin} min</dd></>}
    </dl>
  )
}
