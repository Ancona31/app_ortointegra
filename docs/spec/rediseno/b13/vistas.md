# B13 · línea VISTAS (AG2 → AG3 → AG4) — registro

Rama `feature/b13-vistas`, sobre `ca1c2cf8` (AG0 + AG1 + su arreglo de alto de cabecera).
Todo lo nuevo actúa sólo con la v2 ENCENDIDA; apagada, las vistas son las de antes
(3 vistas, lista en el teléfono, Semana de tres días en la tableta).

## AG2 · Día y 3 días (cambio de comportamiento aprobado, CALMA §28 y §29.1)

* `src/lib/agenda/vistasAgenda.ts` (**`src/lib/agenda`, presentación de vistas**):
  * la tabla de siempre pasa a llamarse `FORMATOS_DE_VISTA_V1` (la usa `vistaEnElOtroFormato`, sin cambios);
  * `FORMATOS_DE_VISTA` es ahora la de la v2: cuatro filas (Mes, Semana, 3 días, Día) con su vista
    en `rejilla` y en `telefono`; sólo la Semana cambia (lista `listWeek` en `ext`/`tel`);
  * `vistaDelFormato(vista, telefono)` (idempotente; reconoce `listDay` como Día),
    `vistaDeLaV1EnLaV2` (al encenderse: `timeGridTresDias` de la tableta apagada era la Semana),
    `esFormatoTelefono`.
* `opcionesCalendario.ts`: tablas nuevas `VISTAS_FC_V2`, `VISTAS_FC_V2_TABLETA`, `VISTAS_FC_V2_MOVIL`
  (sólo cambian títulos del periodo según la maqueta —«19 – 21 nov 2026» / «19 – 21 de noviembre» /
  «Jue, 19 de noviembre»— y el Mes de AG4). Las de siempre no se tocan.
* `AgendaCliente.tsx`: con la v2 el formato sale de la sonda (`leerFormato`, `alCambiarFormato`), no de
  `innerWidth`: React y las hojas cruzan en el mismo píxel. Estado `formatoV2` (`ancho`/`tableta`/`telefono`)
  elige la tabla (`tablaDeVistas`); `cambiarVista` traduce con `vistaDelFormato`; `esTableta` queda en
  `false` con la v2 (no hay Semana de tres días). `sinHuecoParaAgendar`: en `ext`/`tel` las rejillas no
  seleccionan ni abren el alta al tocar (un bloqueo sí se sigue editando). El arrastre táctil sigue con la
  pulsación larga de FullCalendar (sin tocar).
* `BandaMovil.tsx`, `CabeceraEscritorio.tsx`: `VIEWS_V2` y prop `cuatroVistas` (conmutador de cuatro).
  Rótulos enteros a 13 px; en `ext`/`tel` el conmutador ocupa su propia fila (CSS con `:has(:nth-child(4))`).
* **Alto de 80 px por hora: NO aplicado.** Sigue 36/42/48 (lo de AG1). No se intentó: exige repetir
  `agenda-g2-turnos`, `agenda-arrastre` y `agenda-empalme` 5 veces cada una tras declarar el alto antes del
  primer pintado; queda pendiente. `--cal-hw` tampoco se aplica.

## AG3 · Semana

* `TiraSemana.tsx` (archivo nuevo, presentacional): siete botones (letra, número, hoy en círculo, hasta 3
  puntos contados del DOM de la lista con un `MutationObserver`); tocar lleva la lista a ese día con la misma
  ayuda que abre en hoy (`desplazarListaAHoy`). Se monta en `AvisosAgenda` (prop nueva `tira`, la última de
  la banda) sólo con la v2, en el teléfono y en `listWeek`. Textos nuevos sólo accesibles: grupo «Días de la
  semana» y el nombre de cada día.
* `FilaLista.tsx` + `renderEventContent.tsx`: con la v2 y en `listWeek`, la fila de la maqueta (hora apilada,
  barra del estado, nombre 15/600, «duración · motivo», estado en círculo de 26, chevrón). Mismos
  `data-cita-id` y clases raíz; la celda de hora y el punto del plugin se ocultan en CSS.
* `CabeceraDiaLista.tsx` y `renderSinEventos.tsx` no se tocaron (textos iguales; la cabecera sólo cambia de
  estilo). El enlace de la agenda vacía es de la línea de configuración.
* Siete columnas en `ih`/`iv`/`esc`: lo da AG2 (`timeGridWeek`).

## AG4 · Mes

* `opcionesCalendario.ts`: `MES_V2_ANCHO` (seis semanas, `expandRows`, `dayMaxEventRows: 3`,
  `dayMaxEvents: false`) y `MES_V2_TABLETA` (K = 2, cabeceras cortas, «+N»).
* `AgendaCliente.tsx`: `mesDeTelefono` — con la v2 el Mes de puntos + panel es sólo de `ext`/`tel`; en
  `ih`/`iv` es la rejilla con chips (tocar la celda abre el alta, como en computadora).
* `MonthChip.tsx`: con la v2, nombre corto («Paciente P.», el entero sigue en la etiqueta accesible) y
  variable `--ag-mes-tinta` para la barra de 3 px.
* CSS: celda, número, hoy, otro mes, chip 22 px 12/16 600, «+N» `--enlace`; `iv` en dos renglones, `ih` sólo
  hora; Mes del teléfono con número en círculo de 28, hoy relleno, elegido con anillo `--cal-sel`.
* No hecho: capa «+N más» propia (sigue el popover de FullCalendar), arrastre/estirar del Mes con piezas
  nuevas, panel del teléfono con las filas de la Semana A (`FilaDelPanel` es de AG1), domingo sin horario
  en `--cal-fuera`, número arriba a la izquierda.

## `globals.css`

Un solo bloque nuevo «B13 · VISTAS (AG2 · AG3 · AG4)», justo ANTES del de AG1, con `:root` delante de cada
selector para ganar a igualdad. Todo bajo `.agenda-raiz[data-agenda-v2="encendida"]`. No se tocaron tokens
ni los bloques de AG0/AG1.

## Pruebas

* Unitarias: `vistasTableta.test.ts` (+6 casos de la v2).
* e2e nueva `agenda-b13-vistas.e2e.ts` (teléfono y computadora, encendida y apagada).
* `agenda-f-tableta.e2e.ts`: las tres de siempre se quedan (son de la v2 apagada) y se añade el bloque «con
  la v2» (siete columnas, «3 días» aparte, Mes de rejilla, arrastre con pulsación larga). El arrastre se
  sacó a una función para usarlo en los dos.
* `agenda-f-deslizar.e2e.ts`: las dos pruebas del gesto encendido usaban Día en lista; con la v2 Día es
  rejilla, así que van en la lista de Semana (misma comprobación: umbral, borde, ida y vuelta). La de
  apagado sigue en Día.
* `agenda-movil.e2e.ts` no cambia: es de la v2 apagada y sigue valiendo.

## Peticiones a otras líneas

* CAPAS (AG8, banda/barra): en `tel`/`ext` el título del periodo se corta («23 – 29 de…», «Novie… de
  2026») por falta de ancho en la fila de la banda; la barra de PIEZAS §4 lo resuelve.
* CAPAS (`InteraccionesV2.tsx`, `deslizarActivo`): con la v2, Día y «3 días» del teléfono son rejilla y el
  deslizar sólo vale en listas. Decidir si el gesto debe valer también en esas rejillas.
* Atajo de teclado para «3 días»: no existe (`atajosAgenda.ts`); el segmento no lleva `aria-keyshortcuts`.
