'use client'

/**
 * src/hooks/useEscudoTrasRegistro.ts — el escudo tras cerrar `QuickPatientModal`.
 *
 * Nació en `BurbujaAlta.tsx` (H3, punto 12) y se movió aquí en I3 (punto 22 de
 * Angel: «el escudo contra el doble clic, también en el formulario completo y
 * en "Convertir en cita"»). Con tres usos reales —la burbuja, el formulario
 * completo (`AppointmentModal`) y «Convertir en cita» (`ConvertirEnCita`)—, el
 * gancho compartido está justificado (CLAUDE.md, Protocolo 4).
 *
 * LA CAUSA (H3): `QuickPatientModal` se pinta centrado ENCIMA de lo que lo abrió
 * y el alta del paciente contesta en decenas de milisegundos, así que el modal
 * desaparece entre los dos clics de un doble clic sobre «Crear y continuar» (o
 * antes de un segundo clic de «¿lo tomó?»); con «Cancelar», que cierra al
 * instante, igual. Ese segundo clic ya no cae en el modal sino en lo de debajo:
 *   · en la burbuja, una franja de la rejilla: la burbuja se cierra y
 *     FullCalendar abre OTRA vacía (H3);
 *   · en el formulario completo (I3, medido en escritorio a 1280×800), un chip
 *     de «Tipo de cita»: elige un tipo y cambia la duración sin que nadie lo
 *     pidiera; o el velo, que cierra el formulario y pierde lo escrito;
 *   · en «Convertir en cita», el velo o el propio diálogo (su botón principal
 *     convertiría sin que nadie lo pulsara).
 *
 * Por eso, mientras el modal está abierto se apunta dónde se pulsó por última
 * vez y, al cerrarse (creado o cancelado: quien lo usa llama a `activar`),
 * durante `GRACIA_TRAS_REGISTRO_MS` (más que el intervalo de doble clic de los
 * sistemas, 500 ms por omisión) se tragan en captura los eventos del clic que
 * caen A MENOS DE `RADIO_DOBLE_CLIC_PX` de ese punto: el segundo clic del mismo
 * gesto. Un clic en otro sitio pasa. Con `useLayoutEffect`: el oyente queda
 * puesto en el mismo commit que quita el modal, antes de que el navegador pueda
 * entregar el segundo clic. Cada cierre reinicia la gracia (`vez`).
 *
 * `dentroDeDialogos`: la burbuja (H3) deja pasar los clics dentro de un
 * diálogo (por omisión, `false`: su comportamiento, sin cambios). El formulario
 * completo y «Convertir en cita» SON el diálogo de debajo, así que lo encienden.
 * Decisión sin regla previa: 600 ms y 24 px (los de H3).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

const GRACIA_TRAS_REGISTRO_MS = 600
const RADIO_DOBLE_CLIC_PX = 24
const EVENTOS_DEL_CLIC = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchend'] as const
type PuntoPantalla = { x: number; y: number }

function puntoDelEvento(e: Event): PuntoPantalla | null {
  if (e instanceof MouseEvent) return { x: e.clientX, y: e.clientY }
  const t = typeof TouchEvent !== 'undefined' && e instanceof TouchEvent ? e.changedTouches[0] : undefined
  return t ? { x: t.clientX, y: t.clientY } : null
}

export interface OpcionesEscudo {
  /** También se tragan los clics que caen dentro de un diálogo (el que abrió el modal). */
  dentroDeDialogos?: boolean
}

export function useEscudoTrasRegistro(modalAbierto: boolean, opciones: OpcionesEscudo = {}): { activo: boolean; activar: () => void } {
  const [estado, setEstado] = useState({ activo: false, vez: 0 })
  const ultimo = useRef<PuntoPantalla | null>(null)
  const dentroDeDialogos = opciones.dentroDeDialogos === true
  useEffect(() => {
    if (!modalAbierto) return
    const apuntar = (e: PointerEvent): void => { ultimo.current = { x: e.clientX, y: e.clientY } }
    document.addEventListener('pointerdown', apuntar, true)
    return () => document.removeEventListener('pointerdown', apuntar, true)
  }, [modalAbierto])
  useLayoutEffect(() => {
    const origen = ultimo.current
    if (!estado.activo || !origen) return
    const tragar = (e: Event): void => {
      if (!dentroDeDialogos && e.target instanceof Element && e.target.closest('[role="dialog"]')) return
      const p = puntoDelEvento(e)
      if (!p || Math.hypot(p.x - origen.x, p.y - origen.y) > RADIO_DOBLE_CLIC_PX) return
      e.stopImmediatePropagation()
      if (e.cancelable) e.preventDefault()
    }
    for (const t of EVENTOS_DEL_CLIC) document.addEventListener(t, tragar, { capture: true, passive: false })
    const fin = setTimeout(() => setEstado(s => ({ ...s, activo: false })), GRACIA_TRAS_REGISTRO_MS)
    return () => {
      clearTimeout(fin)
      for (const t of EVENTOS_DEL_CLIC) document.removeEventListener(t, tragar, { capture: true })
    }
  }, [estado, dentroDeDialogos])
  const activar = useCallback(() => setEstado(s => ({ activo: true, vez: s.vez + 1 })), [])
  return { activo: estado.activo, activar }
}
