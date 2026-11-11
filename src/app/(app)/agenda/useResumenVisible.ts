'use client'

/**
 * src/app/(app)/agenda/useResumenVisible.ts
 *
 * Tres ganchos sobre lo mismo que `useVentanaRejilla`: lo que la vista
 * tiene pintado ahora mismo. `useConteoVisible` lleva el conteo del
 * subtítulo, `usePanelDelMes` el panel del mes en el teléfono y
 * `useResumenDelDia` el resumen y los huecos de la vista Día. Movido tal
 * cual desde `AgendaCliente.tsx` (A2.5.3, movimiento puro, con sus
 * comentarios); sólo cambiaron los parámetros, el retorno y las
 * dependencias de los efectos, que ahora leen de `calendarRef` recibido
 * por parámetro en vez de la clausura del componente.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type FullCalendar from '@fullcalendar/react'
import type { EventApi, ViewApi, DayCellContentArg } from '@fullcalendar/core'
import { differenceInCalendarDays } from 'date-fns'
import type { RangosDeVista } from '@/lib/agenda/fechasAgenda'
import {
  type FilaDelDia, filasDelDia, firmaDeFilas,
  type ConteoVisible,
  type EventoParaConteo, contarVisibles,
} from '@/lib/agenda/conteoAgenda'
import {
  type ResumenDia, resumenDelDia, firmaDelResumen,
} from '@/lib/agenda/huecosAgenda'
import type { Horario } from '@/lib/configApp'

type CalRef = RefObject<InstanceType<typeof FullCalendar> | null>

const CONTEO_VACIO: ConteoVisible = { citas: 0, eventos: 0, google: 0 }

/* ── EL CONTEO DEL SUBTÍTULO ─────────────────────────────────────────
   Mismo patrón que la ventana de la rejilla, y por el mismo motivo: cuelga de
   `eventsSet`, que se emite en cada llegada de fetch —DOS por navegación, una
   por fuente—, en cada alta optimista, en cada baja, en cada re-hidratación
   tras un arrastre y en cada eco de Realtime.

   ⚠️  EL ESTADO GUARDA LA SALIDA —tres enteros—, NO LOS EVENTOS DE LOS QUE
   SALE. Es lo mismo que hace `ventana` con sus dos cadenas, y por la misma
   razón: el array que llega en `eventsSet` NO se puede comparar, porque se
   construye recorriendo un mapa (`buildEventApis` sobre `eventStore`) y su
   ORDEN cambia con altas, bajas y refetches. Un reordenamiento sin ningún
   cambio real diría «cambió». Tres números no tienen esa trampa.

   La diferencia con la ventana, que conviene saber: esto NO alimenta ninguna
   prop de FullCalendar, así que una escritura de más aquí es un render de más
   y no un candidato a salto de scroll. La guarda sigue haciendo falta —dos
   emisiones por navegación son dos renders del árbol entero— pero el precio de
   fallarla es menor que allí. No la quites; sí sepas que no es lo mismo. */
export function useConteoVisible({
  calendarRef, diasOcultos, rangoDeVista,
}: {
  calendarRef: CalRef
  diasOcultos: readonly number[]
  rangoDeVista: () => RangosDeVista | null
}) {
  const [conteo, setConteo] = useState<ConteoVisible>(CONTEO_VACIO)

  /* Por ref y no por deps, igual que `horarioRef` y `compactarRef`: mete
     `diasOcultos` en las deps y `aplicarConteo` se recrea con cada pliegue. */
  const diasOcultosRef = useRef(diasOcultos)
  // eslint-disable-next-line react-hooks/refs -- patrón último valor: FullCalendar lee en componentDidMount/Update, antes de los efectos del padre
  diasOcultosRef.current = diasOcultos

  /* ⚠️ YA NO RECIBE LA VISTA, Y ESO ES DEL BLOQUE 5. Llevaba un `vista: string`
     con su propia nota —llegaba por parámetro y no del estado `currentView`
     porque en `datesSet` el `setCurrentView` de al lado todavía no ha llegado al
     render—, pero su ÚNICO consumidor era la reja `sinAllDay` de
     `contarVisibles`, que se retiró al encender la banda. Sin ella el parámetro
     quedaba muerto, y con él el `view.type` que los tres llamadores calculaban
     sólo para pasárselo. El conteo no depende de la vista.

     Si algún día vuelve a hacer falta la vista aquí, el motivo de arriba sigue
     en pie: sácala del `arg` del handler, nunca de `currentView`. */
  const aplicarConteo = useCallback((
    eventos: readonly EventoParaConteo[],
    rangos: RangosDeVista | null,
  ) => {
    const nuevo = contarVisibles(
      eventos,
      rangos?.activo ?? null,
      diasOcultosRef.current,
    )
    /* Forma funcional devolviendo `prev` tal cual cuando no cambia, para que
       React se salte el re-render por bail-out de identidad. Calcado de
       `setVentana` y `setDiasOcultos`. */
    setConteo(prev =>
      prev.citas === nuevo.citas && prev.eventos === nuevo.eventos && prev.google === nuevo.google
        ? prev
        : nuevo
    )
  }, [])

  /* `diasOcultos` es la TERCERA entrada del conteo y la escribe `aplicarVentana`
     DESPUÉS de que los handlers hayan contado: dentro del handler el ref todavía
     vale lo viejo. Este efecto es quien cubre esa entrada, igual que los dos de
     más arriba cubren al horario y al botón. Y de paso hace el conteo del
     montaje, antes del primer `eventsSet`. */
  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    aplicarConteo(api.getEvents(), rangoDeVista())
  }, [calendarRef, diasOcultos, aplicarConteo, rangoDeVista])

  return { conteo, aplicarConteo }
}

/* ── EL DÍA QUE ENSEÑA EL PANEL DEL MES ────────────────────────────────
   Sólo lo consume la vista Mes del teléfono. En cualquier otra queda inerte:
   ni se pinta el panel ni se marca ninguna celda. */
export function usePanelDelMes({
  calendarRef, isMobile,
}: {
  calendarRef: CalRef
  isMobile: boolean
}) {
  const [diaSel, setDiaSel] = useState<Date | null>(null)
  const [filasDia, setFilasDia] = useState<readonly FilaDelDia[]>([])

  /* Por ref y no por deps, igual que `horarioRef` y `compactarRef`: con
     `diaSel` en las deps, `aplicarPanel` se recrearía en cada toque de celda. */
  const diaSelRef = useRef(diaSel)
  // eslint-disable-next-line react-hooks/refs -- patrón último valor: FullCalendar lee en componentDidMount/Update, antes de los efectos del padre
  diaSelRef.current = diaSel

  const aplicarPanel = useCallback((eventos: readonly EventApi[]) => {
    const dia = diaSelRef.current
    const nuevas = dia ? filasDelDia(eventos, dia) : []
    setFilasDia(prev => (firmaDeFilas(prev) === firmaDeFilas(nuevas) ? prev : nuevas))
  }, [])

  /* El día seleccionado es la SEGUNDA entrada del panel y no llega por ningún
     handler del calendario: la escribe el toque en una celda y el cambio de mes.
     Este efecto es quien la cubre, igual que los de más arriba cubren al horario,
     al botón y a `diasOcultos`. */
  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    aplicarPanel(api.getEvents())
  }, [calendarRef, diaSel, aplicarPanel])

  /* ⚠️ EL MES SE COMPARA CON UN REF, Y SIN ESO EL PANEL NO SE PODRÍA USAR.
     La regla es «al navegar de mes, el panel muestra el primer día del mes», y
     el sitio donde se sabe que el rango cambió es `datesSet`. Pero `datesSet` SE
     REEMITE en cada cambio de la ventana vertical aunque el rango no se mueva
     (la cadena está en la cabecera de `ventanaRejilla.ts`), así que escribir el
     día en cada emisión borraría la selección del médico un fotograma después de
     hacerla. Comparando la clave del mes, sólo escribe cuando el mes es otro. */
  const mesDelPanelRef = useRef('')
  const sincronizarDiaDelPanel = useCallback((vista: ViewApi) => {
    if (vista.type !== 'dayGridMonth') { mesDelPanelRef.current = ''; return }
    const clave = vista.currentStart.toISOString()
    if (mesDelPanelRef.current === clave) return
    mesDelPanelRef.current = clave
    setDiaSel(vista.currentStart)
  }, [])

  /* La marca del día seleccionado. CONTORNO, no relleno: el relleno es de HOY, y
     dos rellenos en la misma cuadrícula no se distinguen de un vistazo.
     ⚠️ ACOTADA A MÓVIL A PROPÓSITO. `sincronizarDiaDelPanel` corre también en el
     Mes de escritorio —es el mismo `datesSet`—, así que sin este `isMobile` el
     día 1 aparecería contorneado en un escritorio donde no hay panel al que
     corresponda ni forma de cambiar la selección. */
  const dayCellClassNames = useCallback((arg: DayCellContentArg): string[] => (
    isMobile && diaSel && differenceInCalendarDays(arg.date, diaSel) === 0 ? ['ag-mes-dia-sel'] : []
  ), [isMobile, diaSel])

  return { diaSel, setDiaSel, filasDia, aplicarPanel, sincronizarDiaDelPanel, dayCellClassNames }
}

/* ── EL RESUMEN Y LOS HUECOS DE LA VISTA DÍA (bloque 8) ────────────────
   Mismo patrón que `conteo` y que el panel del mes, y por el mismo motivo:
   cuelga de los dos disparadores del calendario, guarda LA SALIDA y no los
   eventos de los que sale, y se protege con una firma para que las dos
   emisiones por navegación no sean dos renders del árbol entero.

   ⚠️ SE CALCULA EN EL CLIENTE Y SOBRE LO QUE YA ESTÁ CARGADO. Ni ruta nueva
   ni consulta al servidor: los eventos del día ya están en el `eventStore` y
   el horario ya llegó por SWR para `businessHours`. Un endpoint de
   disponibilidad sería una segunda fuente de verdad sobre las mismas filas.

   ⚠️ INERTE FUERA DE `timeGridDay`. Vale `null` en cualquier otra vista, así
   que en Semana, en Mes y en las listas esto no cuesta ni un recorrido: la
   guarda de vista está ANTES del cálculo, no después. */
export function useResumenDelDia({
  calendarRef, horario, horarioRef, rangoDeVista,
}: {
  calendarRef: CalRef
  horario: Horario
  horarioRef: RefObject<Horario>
  rangoDeVista: () => RangosDeVista | null
}) {
  const [resumenDia, setResumenDia] = useState<ResumenDia | null>(null)

  const aplicarResumen = useCallback((
    eventos: readonly EventApi[],
    rangos: RangosDeVista | null,
    vista: string,
  ) => {
    /* El día es `activeStart` y no `new Date()`: el panel sigue al calendario,
       no compite con él (§8.3). En `timeGridDay` el rango activo es ese único
       día, así que «el primer día del rango» y «el día pintado» son lo mismo y
       no hace falta la rama de «hoy si cae dentro» que pide el spec para las
       vistas de varios días — aquí no hay ninguna. */
    const nuevo = vista === 'timeGridDay' && rangos
      ? resumenDelDia(eventos, rangos.activo.activeStart, horarioRef.current)
      : null
    setResumenDia(prev => (firmaDelResumen(prev) === firmaDelResumen(nuevo) ? prev : nuevo))
  }, [horarioRef])

  /* El horario es la SEGUNDA entrada del resumen y llega por SWR, que puede
     resolver DESPUÉS del último `eventsSet`. Este efecto es quien cubre esa
     entrada —igual que el gemelo que cubre la ventana de la rejilla— y de paso
     hace el primer cálculo del montaje. */
  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    // El plan preveía este disable también en los efectos E1 y E5, que no lo necesitaron; E8 (este) sí, por el mismo patrón que ya existe en AgendaCliente.tsx (L784 cargaVisible, L1159 auto-apagado de compactar).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza estado derivado de la API imperativa de FullCalendar (no hay render que lo calcule); guardado por firma para no re-renderizar de más
    aplicarResumen(api.getEvents(), rangoDeVista(), api.view.type)
  }, [calendarRef, horario, aplicarResumen, rangoDeVista])

  return { resumenDia, aplicarResumen }
}
