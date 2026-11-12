import type { ReactElement } from 'react'
import { etiquetaDia, fechaEnZona, horaEnZona } from './clienteReserva'

interface Props {
  medico: string
  consultorio: { nombre: string; direccion: string | null; telefono: string | null; zona: string }
  inicio: string
}

/** El comprobante en pantalla. Sin tipo de cita (lista A, 10). */
export default function Comprobante({ medico, consultorio, inicio }: Props): ReactElement {
  return (
    <section aria-label="Cita reservada" className="space-y-2 text-sm text-slate-700">
      <h2 className="text-lg font-semibold text-slate-800">Tu cita quedó agendada</h2>
      <p><span className="capitalize">{etiquetaDia(fechaEnZona(inicio, consultorio.zona))}</span>, {horaEnZona(inicio, consultorio.zona)} h</p>
      <p>{medico}</p>
      <p>{consultorio.nombre}{consultorio.direccion ? ` · ${consultorio.direccion}` : ''}</p>
      {consultorio.telefono && <p>Teléfono: {consultorio.telefono}</p>}
      <p className="text-slate-500">Para cambiar o cancelar, comunícate con el consultorio.</p>
    </section>
  )
}
