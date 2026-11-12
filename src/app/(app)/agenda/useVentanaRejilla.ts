'use client'

/**
 * src/app/(app)/agenda/useVentanaRejilla.ts
 *
 * La ventana vertical de la rejilla (`slotMinTime`/`slotMaxTime`), las
 * columnas que el botón «Compactar» pliega, y todo lo que ese botón
 * necesita (su estado, la hora de arranque del scroll y el aviso de
 * recorte). Movido tal cual desde `AgendaCliente.tsx` (A2.5.2, movimiento
 * puro, con sus comentarios); sólo cambiaron los parámetros, el retorno y
 * las dependencias de los efectos, que ahora leen de `horario`/
 * `currentView` recibidos por parámetro en vez de la clausura del
 * componente.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type FullCalendar from '@fullcalendar/react'
import {
  avisoDeRecorte,
  calcularVentanaRejilla,
  diasOcultables,
  type EventoParaVentana,
  type VentanaRejilla,
} from '@/lib/agenda/ventanaRejilla'
import { type RangosDeVista, rangosDeLaVista } from '@/lib/agenda/fechasAgenda'
import { DIAS, HORARIO_DEFAULT } from '@/lib/agenda/horarioAgenda'
import { vistaAdmiteCompactar } from '@/lib/agenda/vistasAgenda'
import type { Horario } from '@/lib/configApp'

type CalRef = RefObject<InstanceType<typeof FullCalendar> | null>

interface Params {
  calendarRef: CalRef
  horario: Horario
  currentView: string
}

/** F1.5 · ¿El horario tiene algún día cerrado? Decide el «Compactar» inicial. */
function hayDiasCerrados(horario: Horario): boolean {
  return DIAS.some(d => !horario[d.key]?.activo)
}

export function useVentanaRejilla({ calendarRef, horario, currentView }: Params) {
  /* ── Ventana vertical de la rejilla ──────────────────────
     Antes `slotMinTime`/`slotMaxTime` eran dos cadenas clavadas en 07:00–21:00
     y una cita a las 23:00 —hay cinco en producción— existía sin poder verse.
     Ahora la ventana se deriva de horario ∪ eventos visibles ∪ el mismo suelo
     de antes; el cálculo entero vive en `@/lib/agenda/ventanaRejilla`.

     ⚠️  EL ESTADO GUARDA LA SALIDA, no los tramos ni los eventos de los que
     sale. No es una simplificación, es lo que hace FIABLE la guarda de
     igualdad. La alternativa —comparar el array que llega en `eventsSet`— no
     sirve: ese array se construye recorriendo un mapa (`buildEventApis` sobre
     `eventStore`), así que su ORDEN cambia con altas, bajas y refetches. Un
     reordenamiento sin ningún cambio real diría «cambió» y volvería a escribir
     estado. Dos cadenas no tienen esa trampa.

     ⚠️  Y POR LO MISMO EL RANGO VISIBLE NO SE GUARDA: se lee de la vista en el
     momento de calcular. Guardado, cada `datesSet` traería `Date` nuevos con
     las mismas fechas — y `datesSet` SE REEMITE en cada cambio de ventana,
     aunque el rango no se mueva (la cadena está en la cabecera de
     `ventanaRejilla.ts`). La comparación por identidad diría «cambió» y daría
     la vuelta de más: ventana → datesSet → estado → recálculo → misma ventana. */
  /* ── EL BOTÓN «COMPACTAR» ──────────────────────────────────────────────
     Colapsa lo que la clínica no usa, en los dos ejes: quita el suelo de
     07:00–21:00 del cálculo de la ventana (las FILAS caen al horario real) y
     esconde con `hiddenDays` los días cerrados y sin ningún evento (las
     COLUMNAS). La regla es la misma arriba y a los lados: hay evento, no se
     colapsa; no hay evento, se colapsa.

     NO SE PERSISTE, y es a propósito: es una lente para mirar la semana de hoy,
     no una preferencia de la clínica. Que se apague solo al recargar evita el
     peor final posible —abrir la agenda un lunes, encontrarla recortada por una
     decisión de hace tres semanas y no saber qué la recortó.

     ⚠️  DECLARADO ANTES QUE `ventana`: su inicializador lo lee en el render.

     F1.5 · ENCENDIDO AL ABRIR SI EL HORARIO TIENE DÍAS CERRADOS (decisión 13).
     Se decide UNA vez y sigue sin recordarse: lo que el médico apague se queda
     apagado hasta recargar. Pliega sólo lo cerrado y sin citas
     (`diasOcultables`), y la banda dice qué se ocultó.
     ⚠️ SE DECIDE CON EL HORARIO DE LA CLÍNICA, NO CON `HORARIO_DEFAULT`. A1.6
     siembra la config desde el layout y casi siempre llega en el montaje; si esa
     semilla falló, `AgendaCliente` pasa el objeto `HORARIO_DEFAULT` mismo (su
     `?? HORARIO_DEFAULT`), que trae el fin de semana cerrado, y decidir con él
     encendería «Compactar» en una clínica abierta los siete días. Por eso se
     compara por IDENTIDAD con la constante: mientras sea ella, no se decide, y
     el efecto de abajo decide una vez cuando llega el de verdad. Si no llega
     nunca, queda apagado, como hasta F1.5. */
  const [compactar, setCompactar] = useState(() => horario !== HORARIO_DEFAULT && hayDiasCerrados(horario))
  const compactarDecididoRef = useRef(horario !== HORARIO_DEFAULT)
  useEffect(() => {
    if (compactarDecididoRef.current || horario === HORARIO_DEFAULT) return
    compactarDecididoRef.current = true
    setCompactar(hayDiasCerrados(horario))
  }, [horario])

  const [ventana, setVentana] = useState<VentanaRejilla>(
    () => calcularVentanaRejilla([], null, horario, { compacta: false }),
  )

  /* ── LA HORA A LA QUE ARRANCA LA REJILLA ────────────────────────────────
     `scrollTime` estuvo INERTE hasta el bloque 3C: con `height="auto"` no había
     scroller interno que posicionar. Con la altura acotada despierta, y sus dos
     defaults son hostiles — de ahí esto y el `scrollTimeReset={false}` de abajo.

     El default es `06:00:00`, una hora a la que no atiende ninguna clínica, así
     que la rejilla abría con una franja muerta arriba. Aquí se apunta a la
     APERTURA MÁS TEMPRANA de los días activos: en Semana se ven varios días a la
     vez, así que tomar la de uno concreto dejaría fuera la primera cita de otro.

     Sobre el orden: `inicio` es «HH:MM» con cero delante, así que el orden
     alfabético y el cronológico coinciden y basta con `sort()`.

     ⚠️ ESTE VALOR SÓLO SE LEE AL MONTAR. `ScrollResponder` lo captura en el
     `componentDidMount` de la vista (`core/internal-common.js:2359-2361`), y con
     `scrollTimeReset={false}` no vuelve a dispararse. Dos consecuencias que NO
     son defectos: que cambie después no mueve la rejilla, y como `horario` llega
     por SWR, el primer montaje puede usar `HORARIO_DEFAULT` (09:00) si la config
     aún no ha respondido. Afecta a la posición inicial del scroll y a nada más. */
  const scrollTime = useMemo(() => {
    const aperturas = DIAS.map(d => horario[d.key]).filter(h => h?.activo).map(h => h.inicio)
    return aperturas.length ? `${aperturas.sort()[0]}:00` : ventana.slotMinTime
  }, [horario, ventana.slotMinTime])

  /** Índices `fc` de los días plegados. Vacío = la semana entera a la vista. */
  const [diasOcultos, setDiasOcultos] = useState<number[]>([])

  /* `horario` se lee del ref, no de la clausura, para que `aplicarVentana`
     conserve identidad con deps `[]`: la llaman los dos handlers del calendario
     y el efecto de abajo, y recrearla no aporta nada. */
  const horarioRef = useRef(horario)
  // eslint-disable-next-line react-hooks/refs -- patrón último valor: FullCalendar lee en componentDidMount/Update, antes de los efectos del padre
  horarioRef.current = horario

  /* Y `compactar` por el mismo camino y por el mismo motivo. Meterlo en las
     deps recrearía `aplicarVentana` en cada pulsación del botón, y con ella los
     handlers que la cierran. El ref se escribe en render, igual que el de
     arriba: cuando el efecto de más abajo llame, ya vale lo nuevo. */
  const compactarRef = useRef(compactar)
  // eslint-disable-next-line react-hooks/refs -- patrón último valor: FullCalendar lee en componentDidMount/Update, antes de los efectos del padre
  compactarRef.current = compactar

  /* ⚠️  LOS DOS EJES USAN RANGOS DISTINTOS, Y ES DELIBERADO. NO LOS UNIFIQUES.

     · La ALTURA (`calcularVentanaRejilla`) va con el rango ACTIVO, el pintado.
       Tiene que reflejar sólo lo que se ve: contar los eventos de una columna
       oculta para estirar el alto daría una rejilla alta con franjas vacías y
       sin nada a la vista que las justifique — el médico vería hueco muerto de
       06:00 a 09:00 sin una sola cita dentro.

     · Las COLUMNAS (`diasOcultables`) van con el rango COMPLETO, sin recortar.
       Con el activo el día oculto no puede volver JAMÁS: `trimHiddenDays` lo
       saca del rango, así que sus eventos caen fuera del filtro, así que sigue
       vacío, así que sigue oculto. Un punto fijo del que sólo se sale
       recargando la página. Aquí hace falta preguntar por días que ahora mismo
       NO se están pintando, que es justo lo que el otro eje no debe hacer. */
  const aplicarVentana = useCallback((
    eventos: readonly EventoParaVentana[],
    rangos: RangosDeVista | null,
  ) => {
    const compacta = compactarRef.current
    /* ⚠️ LA MITAD DEL ALTO SE APAGA EN MES, Y NO ES UNA OPTIMIZACIÓN. `compacta`
       quita el suelo de 07:00-21:00 del cálculo de la ventana vertical, y esa
       ventana es `slotMinTime`/`slotMaxTime`: dos opciones que `dayGridMonth` NI
       SIQUIERA LEE —no tiene rejilla de horas—. Encendida ahí no cambia nada de
       lo que se ve… salvo `avisoDeRecorte`, que sí la mira: la frase diría
       «horas fuera de horario recortadas» sobre una vista sin ninguna hora a la
       vista. O sea que la línea que confiesa el recorte MENTIRÍA. En Mes
       compactar es sólo el eje de las COLUMNAS, y eso es lo que queda vivo dos
       líneas más abajo. */
    const compactaElAlto = compacta && !(rangos?.esMes ?? false)
    const nueva = calcularVentanaRejilla(eventos, rangos?.activo ?? null, horarioRef.current, { compacta: compactaElAlto })
    /* Forma funcional, y devolviendo `prev` tal cual cuando no cambia: React se
       salta el re-render por su propio camino (bail-out por identidad). Un `if`
       alrededor del `setState` haría lo mismo, pero habría que repetirlo en los
       tres llamadores y basta olvidarlo en uno para reabrir la vuelta extra.

       ⚠️⚠️ DESDE EL BLOQUE 3C ESTA GUARDA YA NO ES UNA OPTIMIZACIÓN: ES CARGA
       ESTRUCTURAL, Y RELAJARLA SE VE EN PANTALLA. Al acotar la altura del
       calendario despertó el scroller interno, y con él `scrollTime`. Escribir
       esta ventana mueve `slotMinTime`/`slotMaxTime` → FullCalendar reconstruye
       el `dateProfile` → `timegrid/internal.js:969` avisa al `ScrollResponder`
       de que las fechas son nuevas. Hoy eso no salta porque el `<FullCalendar>`
       lleva `scrollTimeReset={false}`, pero la cadena está viva: una escritura
       de más aquí es un candidato a SALTO DE SCROLL, no sólo un render de más.
       Quien piense «comparar dos cadenas es redundante, esto ya lo hace React»
       está mirando la mitad del coste. Las dos piezas —esta guarda y el
       `scrollTimeReset={false}`— se sostienen la una a la otra. */
    setVentana(prev =>
      prev.slotMinTime === nueva.slotMinTime && prev.slotMaxTime === nueva.slotMaxTime
        ? prev
        : nueva
    )

    /* ⚠️  LA MISMA DISCIPLINA PARA LAS COLUMNAS, Y AQUÍ HACE MÁS FALTA TODAVÍA.
       `diasOcultables` devuelve un array NUEVO cada vez, así que sin comparar
       elemento a elemento cada `eventsSet` escribiría estado, y cada escritura
       mueve `hiddenDays` → nuevo `dateProfileGenerator` → `datesSet` → otra
       vuelta. Con la comparación, la segunda vuelta muere en el bail-out.
       Y con el rango COMPLETO el ciclo sí converge de verdad: el conjunto no
       depende de qué se recortó, así que la segunda vuelta da lo mismo que la
       primera y muere ahí. */
    const ocultos = compacta
      ? diasOcultables(eventos, rangos?.completo ?? null, horarioRef.current, DIAS)
      : []
    setDiasOcultos(prev =>
      prev.length === ocultos.length && prev.every((d, i) => d === ocultos[i])
        ? prev
        : ocultos
    )
  }, [])

  /** Los dos rangos de la vista. `null` antes del primer `datesSet`. */
  const rangoDeVista = useCallback((): RangosDeVista | null => {
    const vista = calendarRef.current?.getApi().view
    return vista ? rangosDeLaVista(vista) : null
  }, [calendarRef])

  /* El horario es la TERCERA entrada del cálculo y llega por SWR. Si la
     configuración resuelve DESPUÉS del último `eventsSet` —cache frío—, la
     rejilla se quedaría con una ventana calculada sin él. Esto no es un tercer
     disparador del calendario: es el que cubre a su propia entrada. */
  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    aplicarVentana(api.getEvents(), rangoDeVista())
  }, [calendarRef, horario, aplicarVentana, rangoDeVista])

  /* Pulsar el botón no es navegación ni alta de eventos: no llega `datesSet` ni
     `eventsSet`, así que nadie recalcularía. Este efecto es el disparador del
     propio botón, calcado del de arriba —que cubre al horario— porque cubre a
     la CUARTA entrada del cálculo. `aplicarVentana` lee `compactarRef`, que ya
     vale lo nuevo: el ref se escribe en render y el efecto corre después. */
  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    aplicarVentana(api.getEvents(), rangoDeVista())
  }, [calendarRef, compactar, aplicarVentana, rangoDeVista])

  /* ⚠️  EL ESTADO SE APAGA DONDE NO HAY BOTÓN, y esta guarda SE REESCRIBIÓ en el
     paso 9 en vez de relajarse. Decía `isMobile || !currentView.startsWith(
     'timeGrid')`, o sea que apagaba en Mes y apagaba en todo el móvil.
     Las dos mitades caducaron a la vez: Mes ahora pliega columnas —es el único
     eje que le sirve— y el botón existe también en la banda móvil, así que ya no
     hay ningún sitio donde el estado pueda quedarse encendido sin salida.
     LO QUE SIGUE EN PIE, y es todo el motivo de que la guarda exista: en móvil
     Semana y Día son LISTAS (`listWeek` / `listDay`), y una lista no tiene ni
     columnas que plegar ni rejilla que encoger. `vistaAdmiteCompactar` contesta
     `false` para las dos, así que el apagado automático sigue cubriéndolas — y
     ése era el caso de verdad, no «el móvil». */
  useEffect(() => {
    if (!compactar) return
    if (!vistaAdmiteCompactar(currentView)) setCompactar(false)
  }, [compactar, currentView])

  /* Sólo con el botón encendido: apagado no hay nada que confesar. El `!isMobile`
     que había aquí se fue con el botón de la banda — el aviso tiene que salir
     allí donde se pueda haber encendido, y ahora eso incluye el teléfono.
     En Mes la frase sólo puede hablar de columnas: la mitad del alto va gateada
     en `aplicarVentana`, así que `ventana` no se estrecha y `avisoDeRecorte` no
     tiene nada que decir de las horas. */
  const avisoRecorte = compactar ? avisoDeRecorte(ventana, diasOcultos, DIAS) : null

  /* En Mes el recorte es SÓLO de columnas, así que los rótulos cambian: hablar
     de «rejilla» y de «horario» ahí describe algo que no está en pantalla. */
  const compactaElMes = compactar && currentView === 'dayGridMonth'

  return {
    compactar,
    setCompactar,
    ventana,
    diasOcultos,
    scrollTime,
    horarioRef,
    aplicarVentana,
    rangoDeVista,
    avisoRecorte,
    compactaElMes,
  }
}
