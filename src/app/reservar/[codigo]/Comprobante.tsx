import type { ReactElement } from 'react'
import ResumenCita from './ResumenCita'
import { etiquetaDia, fechaEnZona, horaEnZona, type ConsultorioPagina } from './clienteReserva'

interface Props {
  medico: string
  consultorio: ConsultorioPagina
  inicio: string
}

/** «Viernes, 13 de noviembre · 10:45» en la zona del consultorio. */
export function cuandoEnZona(inicio: string, zona: string): string {
  return `${etiquetaDia(fechaEnZona(inicio, zona))} · ${horaEnZona(inicio, zona)}`
}

/** El comprobante en pantalla. Sin tipo de cita (lista A, 10); con la dirección completa (punto 2). */
export default function Comprobante({ medico, consultorio, inicio }: Props): ReactElement {
  return (
    <section aria-label="Cita reservada" className="rp-paso">
      <div className="rp-exito">
        <span className="rp-exito__icono" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
        </span>
        <h2 className="rp-titulo" tabIndex={-1} data-titulo-paso>Tu cita quedó agendada</h2>
        <p className="rp-sub">Te enviamos el comprobante por correo.</p>
      </div>
      <ResumenCita consultorio={consultorio} cuando={cuandoEnZona(inicio, consultorio.zona)} medico={medico} telefono />
      <p className="rp-nota">Para cambiar o cancelar, comunícate con el consultorio.</p>
    </section>
  )
}
