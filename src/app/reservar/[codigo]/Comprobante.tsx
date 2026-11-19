'use client'

import { useEffect, useRef, useState, type ReactElement } from 'react'
import ResumenCita from './ResumenCita'
import { etiquetaDia, fechaEnZona, horaEnZona, type ConsultorioPagina } from './clienteReserva'

interface Props {
  medico: string
  consultorio: ConsultorioPagina
  inicio: string
  /**
   * Tanda I, punto 2: sin correo no se dice que se mandó. Tanda J, punto 3: en
   * el único tampoco se dice nada (el correo, si lo hay, lo escribió la clínica
   * y la página no lo conoce); sólo el fijo, con su correo verificado.
   */
  conCorreo: boolean
  /** Tanda M (punto 8): borra lo guardado de esta reserva en la pestaña (`sessionStorage`), antes de cerrarla. */
  alSalir: () => void
}

/** Lo que se espera a que el navegador cierre la pestaña antes de dar por hecho que no la deja cerrar. */
const ESPERA_CIERRE_MS = 300

/**
 * Tanda M (punto 8): «Salir» borra lo guardado y cierra la pestaña. Un navegador sólo deja cerrar por
 * script la pestaña que abrió un script (o la que no tiene historial); la que se abre desde un correo
 * suele no poder. Si tras un instante sigue abierta (`window.closed` en falso), el botón se sustituye por
 * el texto, que recibe el foco para no dejarlo perdido. Sin JavaScript no se llega a esta pantalla: el
 * paso «Listo» sólo lo pone el navegador al responder el POST de la reserva (el servidor pinta «Lugar»).
 */
function Salir({ alSalir }: { alSalir: () => void }): ReactElement {
  const [sigueAbierta, setSigueAbierta] = useState(false)
  const texto = useRef<HTMLParagraphElement | null>(null)
  const reloj = useRef<number | undefined>(undefined)
  useEffect(() => { if (sigueAbierta) texto.current?.focus() }, [sigueAbierta])
  useEffect(() => () => window.clearTimeout(reloj.current), [])
  if (sigueAbierta) {
    return <p ref={texto} tabIndex={-1} role="status" className="rp-sub rp-cerrar">Ya puedes cerrar esta pestaña</p>
  }
  const salir = (): void => {
    alSalir()
    window.close()
    reloj.current = window.setTimeout(() => { if (!window.closed) setSigueAbierta(true) }, ESPERA_CIERRE_MS)
  }
  return <button type="button" className="rp-btn rp-btn--sec" onClick={salir}>Salir</button>
}

/** «Viernes, 13 de noviembre · 10:45» en la zona del consultorio. */
export function cuandoEnZona(inicio: string, zona: string): string {
  return `${etiquetaDia(fechaEnZona(inicio, zona))} · ${horaEnZona(inicio, zona)}`
}

/** El comprobante en pantalla. Sin tipo de cita (lista A, 10); con la dirección completa (punto 2). */
export default function Comprobante({ medico, consultorio, inicio, conCorreo, alSalir }: Props): ReactElement {
  return (
    <section aria-label="Cita reservada" className="rp-paso">
      <div className="rp-exito">
        <span className="rp-exito__icono" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
        </span>
        <h2 className="rp-titulo" tabIndex={-1} data-titulo-paso>Tu cita quedó agendada</h2>
        {conCorreo && <p className="rp-sub">Te enviamos el comprobante por correo.</p>}
      </div>
      <ResumenCita consultorio={consultorio} cuando={cuandoEnZona(inicio, consultorio.zona)} medico={medico} telefono />
      <p className="rp-nota">Para cambiar o cancelar, comunícate con el consultorio.</p>
      <Salir alSalir={alSalir} />
    </section>
  )
}
