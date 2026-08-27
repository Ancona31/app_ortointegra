# Contraste y movimiento · Agenda Spinus

Extracto literal de `SPEC Agenda Spinus.md` §17 y §18, autocontenido. Los valores de color de
modo claro están en §1.1, §4 y §5 del spec; los de modo oscuro en `MODO OSCURO Agenda
Spinus.md`.

---

# 1 · La hora de un evento genérico va en tinta neutra

**Regla:** en una tarjeta `tipo:'evento'`, la hora se pinta en `--ag-ink-600` (claro) /
`#a8b4c2` (oscuro). **Nunca en `--ev-color`.** El color del evento vive solo en la barra
izquierda, el icono, el punto del mes y el tinte del fondo.

### Por qué, y por qué no se arregla con hexes

Pintar el texto en el mismo color que su propio tinte es un problema **estructural, no de
valores**: el contraste queda acotado por la distancia entre el color y una mezcla de sí mismo,
así que cada color nuevo es una tirada de dados. Cuatro de seis fallan hoy (`oliva` 4.39:1 en
claro; `indigo` 4.16, `bronce` 4.31, `grafito` 4.11 en oscuro) y **los dos que pasan lo hacen
por suerte, no por diseño.** Retiñir los cuatro deja la trampa armada para el séptimo color.

Y una corrección: **subir el porcentaje del tinte empeora el problema en los dos modos.** En
claro el fondo se oscurece hacia el color; en oscuro se aclara hacia él. En ambos casos texto y
fondo se acercan. Bajarlo sí ayuda, pero a costa de la identidad de color de la tarjeta, que es
justo lo que el tinte aporta.

### El caso de los cinco estados es distinto — y explica la asimetría

Un estado **sí** lleva su color en la hora, y debe seguir llevándolo. La diferencia no es de
implementación, es de qué significa el color:

| | Estado de cita | Color de evento |
|---|---|---|
| Quién lo elige | el sistema | un usuario, una vez |
| Cuántos valores | 5 fijos | 6 y creciendo |
| Verificado | sí, uno a uno (§12, §16) | imposible a futuro |
| Qué informa | el dato central de la cita | decoración reconocible |

Cinco valores fijos se verifican una vez y se acabó. Una paleta que crece por migración, no.

**Y el efecto secundario es una mejora:** la hora en color pasa a significar «esto es una cita
con estado», y la hora en neutro «esto es un evento». Un signo de tipo donde antes no había
ninguno.

### La barra de acento ya cumple, sin tocar nada

Es un gráfico, umbral **3:1**. Contra el tinte de su propia tarjeta:

| | Claro | Oscuro |
|---|---|---|
| `indigo` | 12.1:1 | 4.16:1 |
| `magenta` | 8.9:1 | 6.02:1 |
| `carmin` | 9.4:1 | 5.71:1 |
| `oliva` | 4.39:1 | 8.84:1 |
| `bronce` | 10.7:1 | 4.31:1 |
| `grafito` | 14.9:1 | 4.11:1 |

**El mínimo es 4.11:1, un 37 % por encima del umbral.** Los seis pasan con holgura, así que
**no cambia ningún hex**: cero migración y cero re-verificación contra los otros cinco colores
y los cinco estados, que era el trabajo caro.

Las píldoras de fondo opaco (4.79–14.68:1) tampoco se tocan.

### Qué queda expuesto: nada

Inventario del texto sobre tinte en una tarjeta de evento, tras el cambio:

| Elemento | Color | Umbral |
|---|---|---|
| Hora | `--ag-ink-600` / `#a8b4c2` | ✅ 7.9:1+ |
| Nombre / título | `--ag-ink-800` / `#e8ecf1` | ✅ 11:1+ |
| Meta (motivo, sede) | `--ag-ink-600` / `#a8b4c2` | ✅ |
| Píldora | fondo opaco | ✅ |
| Barra, icono, punto | `--ev-color` | ✅ gráfico, 3:1 |

**Ningún texto de la tarjeta depende ya de `--ev-color`.** Un séptimo color añadido mañana no
puede fallar AA: solo tiene que superar 3:1 contra su tinte como gráfico, que es una prueba que
cualquier color usable pasa.

---

---

# 2 · Movimiento

Principio, y de él sale todo lo demás: **una agenda es una herramienta de consulta, no una
pieza de exhibición.** El médico la abre treinta veces al día y navega semanas a golpe de
flecha. Cualquier animación que se note dos veces es una animación que a la trigésima molesta.
El movimiento aquí sirve para **una sola cosa**: que un cambio no aparezca de la nada, para que
el ojo sepa que algo pasó y dónde.

Nada de rebote, nada de *spring*, nada de *overshoot*, nada de escalado en tarjetas.

## 1 La escala: tres duraciones, tres curvas

```css
:root {
  --ag-dur-micro: 120ms;   /* hover, press, focus */
  --ag-dur-base:  180ms;   /* entrada de evento, cambio de vista */
  --ag-dur-lento: 240ms;   /* aviso, panel, remonte del modal */

  --ag-ease-out: cubic-bezier(0, 0, .2, 1);    /* algo llega */
  --ag-ease-in:  cubic-bezier(.4, 0, 1, 1);    /* algo se va */
  --ag-ease:     cubic-bezier(.4, 0, .2, 1);   /* algo se mueve */
}
```

**Nada por encima de 240 ms**, sin excepción. Y solo dos propiedades animables: `opacity`
y `transform: translateY()`. Nunca `height`, `top`, `width` ni nada que provoque *layout* —
FullCalendar recalcula posiciones y el resultado es temblor.

Magnitud de desplazamiento: **4 px** en tarjetas, **6 px** en bloques (aviso, vista, panel). Una
tarjeta de 28 px con un recorrido de 12 px no entra: salta.

## 2 La pregunta del montaje: solo la vista, no cada tarjeta

Animar en cada montaje está mal, por dos razones independientes:

1. **Coste de uso.** Cambiar de semana es la acción más frecuente de la agenda. Fundir 40
   tarjetas cada vez convierte la navegación rápida en una sucesión de destellos, y quien
   revisa cuatro semanas seguidas paga la animación cuatro veces sin obtener nada.
2. **Coste de significado.** Una entrada animada comunica «esto es nuevo». Si entra todo, no
   comunica nada — y se pierde justo el caso que sí importa: la cita que acaba de llegar por
   Realtime mientras el médico mira la pantalla.

Así que se separan los dos casos:

| Caso | Qué se anima |
|---|---|
| Navegar fecha o cambiar vista | **la rejilla entera**, un solo fundido (18.3) |
| Evento genuinamente nuevo (Realtime, o el que acabas de crear) | **esa tarjeta**, y solo esa (18.4) |

Distinguirlos no necesita nada raro: se guarda el conjunto de ids del `eventsSet` anterior y solo
los ausentes reciben la clase.

```js
let idsPrevios = new Set(), primeraCarga = true, nuevos = [];

eventsSet: (events) => {
  const ids = new Set(events.map(e => e.id));
  nuevos = primeraCarga ? [] : [...ids].filter(id => !idsPrevios.has(id));
  idsPrevios = ids;
  primeraCarga = false;
},
eventDidMount: (a) => {
  if (nuevos.includes(a.event.id)) a.el.classList.add('ev--nuevo');
}
```

`primeraCarga` importa: en el primer `eventsSet` **todo** es nuevo, y ahí no se anima nada
individual — de eso se encarga la entrada de la vista.

**Y nunca escalonado.** Un *stagger* de 30 ms sobre 40 tarjetas pone la última 1,2 s tarde.
Rechazado explícitamente.

## 3 Cambio de fecha y de vista — conviviendo con la carga

Esto es lo que más se hace, y ya existe un comportamiento: la rejilla anterior se atenúa
mientras llegan los datos. **No se sustituye: se le pone rampa a los dos extremos**, con la
misma duración, para que la secuencia se lea como un movimiento continuo y no como dos sucesos.

```css
.agenda__cal { transition: opacity var(--ag-dur-base) var(--ag-ease) }
.agenda__cal[data-cargando="true"] { opacity: .55; pointer-events: none }
```

Tres decisiones dentro de esto:

- **Ninguna traslación al cambiar de fecha.** Un deslizamiento obliga a decidir hacia dónde, y
  quien pulsa ‹ ya sabe hacia dónde va. Solo añade latencia.
- **Opacidad a `.55`, no a `.5`.** La rejilla atenuada tiene que seguir siendo legible: es
  contexto, no un velo.
- **Bajo 150 ms no se atenúa nada** (ya está en §11). Con una rampa de 180 ms encima, atenuar
  una carga de 80 ms parpadea peor que no hacer nada.

**El cambio de vista sí lleva traslación**, porque ahí el contenido cambia de naturaleza y no
solo de fecha:

```css
.fc-view-harness > * { animation: ag-vista var(--ag-dur-base) var(--ag-ease-out) both }
@keyframes ag-vista { from { opacity: 0; transform: translateY(6px) } }
```

## 4 La entrada de un evento nuevo

```css
.ev--nuevo { animation: ag-entra var(--ag-dur-base) var(--ag-ease-out) both }
@keyframes ag-entra { from { opacity: 0; transform: translateY(4px) } }
```

Para el caso que de verdad justifica todo esto —una cita que llega por Realtime mientras el
médico mira la pantalla— el fundido solo no basta: aparece en una zona a la que no está
mirando. Un pulso del borde, **una vez**:

```css
.ev--nuevo { animation: ag-entra var(--ag-dur-base) var(--ag-ease-out) both,
                        ag-pulso 900ms var(--ag-ease) 180ms 1 }
@keyframes ag-pulso {
  0%   { box-shadow: 0 0 0 0 rgba(0,0,0,0) }
  40%  { box-shadow: 0 0 0 4px var(--ag-primary-focus) }
  100% { box-shadow: 0 0 0 0 rgba(0,0,0,0) }
}
```

**Una vez, no en bucle.** Un pulso que se repite es una notificación que no se puede cerrar. Y
`box-shadow` a propósito, no `outline`: el `outline` es del foco y no se le roba el lenguaje.

## 5 Micro-interacciones

| Elemento | Qué | Duración |
|---|---|---|
| Tarjeta de evento, hover | `background-color` | 120 ms |
| Botón de hueco, hover/focus | `background-color`, `border-color` | 120 ms |
| Fila de lista, hover | `background-color` | 120 ms |
| Chip de vista, cambio de activo | `background-color`, `color` | 120 ms |
| Anillo de foco | **sin transición** | — |

```css
.fc-event, .hueco, .fc-list-event td {
  transition: background-color var(--ag-dur-micro) var(--ag-ease),
              border-color     var(--ag-dur-micro) var(--ag-ease);
}
```

Dos cosas que **no** se animan, y conviene dejarlas escritas:

- **Nada de `transform` en el hover de una tarjeta.** Levantarla dentro de una rejilla de horas
  desplaza su posición aparente, y la posición *es* el dato: una cita que parece moverse media
  hora al pasar el ratón es un error de lectura.
- **El anillo de foco aparece instantáneo.** Un foco con rampa se siente perezoso justo cuando
  alguien navega con teclado a toda velocidad.

## 6 Panel, aviso y modal

- **Tiles del resumen:** cuando un valor cambia, fundido de 180 ms del contenido del tile. **Sin
  conteo animado** — son cifras clínicas, no un tablero de métricas; un número que sube solo
  invita a esperar a que termine.
- **Lista de huecos:** al recalcularse, fundido de la lista completa (180 ms). No se anima la
  entrada y salida de cada hueco: eso es altura, y la altura no se anima aquí.
- **Aviso de Google:** entra con `opacity` + `translateY(6px)` a 240 ms `ease-out`; sale con
  `opacity` a 180 ms `ease-in`. Sale más rápido de lo que entra, siempre: lo que ya leíste debe
  quitarse de encima sin hacerse esperar.
- **Remonte del modal al cambiar Cita/Evento (§15):** fundido cruzado de 180 ms del cuerpo del
  formulario. Aquí el movimiento **sí es funcional**: el remonte es destructivo, y verlo es lo que
  evita que el usuario crea que solo cambió una pestaña.
- **`nowIndicator`:** no se anima. Se mueve una vez por minuto, y animarlo lleva la vista a algo
  que no ha pasado.

## 7 `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  .fc *, .agenda *, .fc *::before, .fc *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

`.01ms` y no `none`: así los `transitionend` / `animationend` **siguen disparando** y ninguna
lógica que los espere se queda colgada. Es el detalle que convierte un *reset* de movimiento en
un bug.

El estado final se conserva siempre (`both` en cada `animation`), así que desactivar el movimiento
nunca deja un elemento a medio camino ni invisible.

**Lo único que sobrevive a `reduce`:** la atenuación de carga de 18.3. No es una animación, es un
estado — comunica «esto no está actualizado todavía», y quitarlo elimina información, no
decoración.

## 8 Lo que no se anima

Escrito para que no se intente:

- **El plegado de filas de «Compactar».** Lo que cambia es cuántas filas hay, no cuánto miden.
- **El plegado de columnas.** FullCalendar quita el `<td>` del DOM: no hay nada que animar.
- **El arrastre de un evento.** Lo anima FullCalendar. No se le añade nada encima.
- **El cambio de estado de una cita.** Pasar a «atendida» cambia su color, y el color cambia de
  golpe: un cruce de 180 ms entre dos tintes claros no se percibe y solo retrasa la lectura.
