'use client'

/**
 * src/app/(app)/agenda/useAtajosAgenda.ts
 *
 * El oyente de los atajos de teclado de la agenda (bloque F, F3.5, detrás del
 * interruptor). La tabla y la guarda viven en `src/lib/agenda/atajosAgenda.ts`;
 * esto sólo escucha `keydown` en el documento y llama a `alAccion`.
 * Archivo nuevo de F3: se enchufa a `AgendaCliente` después de integrar E.
 *
 * ⚠️ «CUALQUIER CAPA ABIERTA» SE MIRA EN EL DOM ADEMÁS DE EN `capaAbierta`. Los
 * modales de la agenda (cita, horario, confirmación, invitación) y las capas
 * de F (burbuja, tarjeta, ayuda) llevan todos `role="dialog"` y
 * `aria-modal="true"`; preguntar por eso cubre también el modal que alguien
 * añada mañana sin acordarse de este gancho. `capaAbierta` queda para lo que no
 * sea un diálogo (el desplegable del minicalendario, por ejemplo).
 *
 * ⚠️ LA REPETICIÓN DE TECLA SE IGNORA: dejar pulsada la `j` dispararía una
 * navegación —y una traída— por cada repetición del sistema.
 *
 * ⚠️ `alAccion` Y `capaAbierta` ENTRAN POR REF, como `alCerrar` en
 * `useDialogoModal`: como dependencias, el oyente se quitaría y se volvería a
 * poner en cada render de la agenda.
 */
import { useEffect, useRef } from 'react'
import { accionDeTecla, type AccionAtajo, type TeclaPulsada } from '@/lib/agenda/atajosAgenda'

interface Opciones {
  /** El interruptor `agendaV2`. Apagado, no hay ni oyente. */
  activo: boolean
  /** La preferencia «Usar atajos de una tecla» (WCAG 2.1.4). */
  encendidos: boolean
  capaAbierta: boolean
  alAccion: (accion: AccionAtajo) => void
}

function hayDialogoModalAbierto(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null
}

/** Lo que se usa de un `KeyboardEvent`; el real lo cumple. */
export interface EventoTecla extends TeclaPulsada {
  defaultPrevented: boolean
  repeat: boolean
  preventDefault(): void
}

/**
 * Una pulsación: si toca un atajo, lo consume (`preventDefault`) y llama a
 * `alAccion`. Devuelve la acción, o `null`. Exportada para probarla sin DOM.
 */
export function manejarTeclaAtajo(e: EventoTecla, capaAbierta: boolean, alAccion: (a: AccionAtajo) => void): AccionAtajo | null {
  if (e.defaultPrevented || e.repeat) return null
  const accion = accionDeTecla(e, capaAbierta)
  if (!accion) return null
  e.preventDefault()
  alAccion(accion)
  return accion
}

export function useAtajosAgenda({ activo, encendidos, capaAbierta, alAccion }: Opciones): void {
  const alAccionRef = useRef(alAccion)
  const capaRef = useRef(capaAbierta)
  useEffect(() => { alAccionRef.current = alAccion }, [alAccion])
  useEffect(() => { capaRef.current = capaAbierta }, [capaAbierta])

  useEffect(() => {
    if (!activo || !encendidos) return
    function alTeclear(e: KeyboardEvent): void {
      manejarTeclaAtajo(e, capaRef.current || hayDialogoModalAbierto(), a => alAccionRef.current(a))
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [activo, encendidos])
}
