# Spec estético · Agenda Spinus sobre FullCalendar 6.1.20

**Alcance de este documento: cómo se ve.** Valores exactos, CSS y los *render hooks* de
FullCalendar necesarios para producirlos. Nada de lógica de negocio, nada de FullCalendar
Premium.

Referencia visual: `Agenda Spinus Accesible.dc.html` — turnos **6a** (móvil) y **5a**
(escritorio). Los riesgos de implementación van en `RIESGOS Agenda Spinus.md`.

**Solo plugins gratuitos:** `dayGrid`, `timeGrid`, `list`, `interaction`. Nada de
`resourceTimeGrid`, `resourceTimeline` ni `scrollGrid`.

---

## 1. Tokens

### 1.1 Estados de cita

Se redefinen los `--ag-*` que ya existen en `globals.css`. **Los nombres se conservan**; solo
cambia el valor. Si algún `--ag-*` actual no aparece aquí, déjalo como está.

Los valores de estado reflejan la rotación decidida en §4 (ámbar → agendada, azul →
confirmada, verde → atendida). Repintarlos es CSS: la base guarda nombres.

```css
:root {
  --ag-agendada:    #d97706;  --ag-agendada-bg:    #fef6e7;  --ag-agendada-brd:    #f4dfae;
  --ag-agendada-tx: #b45309;
  --ag-confirmada:  #1e5fa8;  --ag-confirmada-bg:  #eaf1f9;  --ag-confirmada-brd:  #c7dcef;
  --ag-confirmada-tx: #1e5fa8;
  --ag-atendida:    #16a34a;  --ag-atendida-bg:    #e9f7ef;  --ag-atendida-brd:    #cfe6d6;
  --ag-atendida-tx: #0f7a52;
  --ag-cancelada:   #c0392b;  --ag-cancelada-bg:   #fdf2f2;  --ag-cancelada-brd:   #f3c9c9;
  --ag-cancelada-tx: #c0392b;
  --ag-nopresento:  #64748b;  --ag-nopresento-bg:  #f4f6f8;  --ag-nopresento-brd:  #dfe5ec;
  --ag-nopresento-tx: #5a6b81;

  /* paleta de eventos genéricos — 6 valores, el identificador va a la base */
  --ag-ev-indigo:  #3730a3;  --ag-ev-magenta: #a21caf;  --ag-ev-carmin:  #be185d;
  --ag-ev-oliva:   #4d7c0f;  --ag-ev-bronce:  #78350f;  --ag-ev-grafito: #1f2937;

  --ag-gcal:        #7c3aed;  --ag-gcal-bg:        #f4effd;  --ag-gcal-brd:        #d8c9f7;
}
```

`-tx` es el color de la **hora**, no del nombre. El nombre es `#173156` en los cinco estados
(ver §4).

### 1.2 Neutrales y superficies

```css
:root {
  --ag-ink-900: #14345c;   /* título de página */
  --ag-ink-800: #173156;   /* nombre de paciente, título de card */
  --ag-ink-700: #3b4a5c;   /* cuerpo */
  --ag-ink-600: #4b5b6e;   /* meta sobre gris */
  --ag-ink-500: #5a6b81;   /* secundario, duración de hueco */
  --ag-ink-400: #6b7b8f;   /* terciario */
  --ag-ink-350: #8a99ac;   /* etiquetas en mayúsculas */
  --ag-ink-150: #b7c2cf;   /* icono de estado vacío */
  --ag-ink-100: #c3ccd8;   /* chevron inerte */

  --ag-surface:        #ffffff;
  --ag-surface-sunken: #f7f9fb;   /* fondo de botón de hueco */
  --ag-surface-muted:  #f1f4f7;   /* fuera de horario */
  --ag-app-bg:         #f4f7fa;   /* lienzo detrás del calendario */

  --ag-line-card:    #e3e9f0;
  --ag-line-input:   #dbe3ec;   /* líneas de la rejilla */
  --ag-line-divider: #edf1f6;   /* separadores internos */
  --ag-line-dash:    #c3ccd8;   /* borde discontinuo de hueco */

  --ag-primary:          #1e5fa8;
  --ag-primary-bg:       #eaf1f9;
  --ag-primary-bg-faint: #f5f8fc;   /* fondo del día de hoy */
  --ag-primary-focus:    rgba(30,95,168,.08);

  --ag-navy-1: #123a63;   /* banda móvil, arriba */
  --ag-navy-2: #16456f;   /* banda móvil, abajo */
  --ag-navy-tx: #a9c4de;  /* subtítulo sobre navy */
}
```

### 1.3 Espaciado, radios, medidas

| Token | Valor | Uso |
|---|---|---|
| `--ag-1` … `--ag-8` | 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 32 px | escala |
| `--ag-r-note` | 6 px | tarjeta de evento |
| `--ag-r-btn-sm` | 8 px | contenedor de icono |
| `--ag-r-btn` | 10 px | botón, chip de vista |
| `--ag-r-card` | 12 px | card del panel, aviso |
| `--ag-r-pill` | 999 px | píldora de estado |
| `--ag-tap` | 44 px | mínimo táctil |
| `--ag-rail-w` | 300 px | ancho del panel lateral |
| `--ag-gutter` | 78 px | columna de horas en escritorio |
| `--ag-slot-h` | 28 px | alto de slot de 30 min |

**Los tonos claros derivados se escriben como hex literal, no con `color-mix()`.** En el
mockup los `color-mix` anidados costaban paint medible; a 200 eventos en el mes se nota.

---

## 2. Tipografía

| Uso | px | Peso | Notas |
|---|---|---|---|
| Título de vista (toolbar) | 22 | 800 | |
| Etiqueta de fecha | 15 | 700 | |
| Nombre en tarjeta `timeGrid` | 12.5 | 600 | |
| Nombre en tarjeta `timeGridDay` | 15 | 600 | |
| Nombre en fila de lista | 15.5–16 | 600 | |
| Hora en tarjeta | 11.5 | 700 | **tabular-nums** |
| Hora en fila de lista | 13 | 700 | **tabular-nums** |
| Chip del mes | 11 | 400 | hora dentro en 700 |
| Píldora de estado | 10.5 | 700 | mayúsculas, `ls: .04em` |
| Número del resumen | 24 | 900 | **tabular-nums** |
| Etiqueta de tile | 10.5 | 600 | |
| Encabezado de columna de día | 11.5 | 700 | mayúsculas |
| Etiqueta de hora (gutter) | 11 | 600 | **tabular-nums** |

```css
.fc, .agenda { font-variant-numeric: tabular-nums }
```

Global y de entrada. Sin esto los dígitos cambian de ancho y la columna de horas tiembla al
navegar entre días. Es el detalle que más delata un calendario mal hecho.

Piso: **10.5 px** en cualquier texto; **12.5 px** en texto que se lee de verdad (nombres,
motivos). Nada de 9 px «porque no cabe» — si no cabe, sobra contenido.

---

## 3. Anatomía de la tarjeta de evento

Un solo `eventContent` para todas las vistas. **La vista decide qué se ve con CSS, no qué se
renderiza.**

```jsx
eventContent: (arg) => (
  <div className="ev__wrap">
    <span className="ev__ico"    aria-hidden="true" />
    <span className="ev__hora">  {arg.timeText}</span>
    <span className="ev__nombre">{arg.event.title}</span>
    <span className="ev__meta">  {arg.event.extendedProps.motivo}</span>
    <span className="ev__estado">{etiquetaEstado(arg.event)}</span>
  </div>
)
```

```css
.fc-event { border-radius: var(--ag-r-note); border-width: 1px; border-left-width: 3px;
            padding: 3px var(--ag-2-5); overflow: hidden; box-shadow: none }
.ev__wrap { display: flex; flex-direction: column; gap: 1px; min-width: 0; line-height: 1.3 }
.ev__hora   { font-size: 11.5px; font-weight: 700 }
.ev__nombre { font-size: 12.5px; font-weight: 600; color: var(--ag-ink-800);
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.ev__meta, .ev__estado { display: none }        /* se activan por vista */
```

**La barra de color es `border-left: 3px`, no una píldora.** Una píldora dentro de una
tarjeta de 28 px no cabe. `box-shadow: none` es deliberado: 12 sombras en una columna
convierten la rejilla en papilla.

### Clasificación

```js
eventClassNames: (a) => {
  const { tipo, estado } = a.event.extendedProps;
  return ['ev', 'ev--' + (tipo === 'cita' ? estado : tipo)];
}
```

Una sola función para todos los tipos. Nada de condicionales por vista.

---

## 4. Los cinco estados

| Estado | Barra | Hora | Fondo | Borde |
|---|---|---|---|---|
| Agendada | `#d97706` | `#b45309` | `#fef6e7` | `#f4dfae` |
| Confirmada | `#1e5fa8` | `#1e5fa8` | `#eaf1f9` | `#c7dcef` |
| Atendida | `#16a34a` | `#0f7a52` | `#e9f7ef` | `#cfe6d6` |
| Cancelada | `#c0392b` | `#c0392b` | `#fdf2f2` | `#f3c9c9` |
| No asistió | `#64748b` | `#5a6b81` | `#f4f6f8` | `#dfe5ec` |

### La rotación respecto de producción — decisión

Producción tiene hoy **azul → agendada, verde → confirmada, teal → atendida**. Esta tabla
mantiene **ámbar → agendada, azul → confirmada, verde → atendida**, y esa es la que gana. Tres
razones, en orden de peso:

1. **Producción no tiene color de «pendiente».** «Agendada» es el único estado que **pide una
   acción** —hay que llamar y confirmar— y en azul se lee como resuelto. En ámbar se ve desde
   el otro lado de la sala cuántas llamadas quedan por hacer. Es el estado que más se mira y
   el que peor está codificado hoy.
2. **Verde para «atendida» es la lectura universal de «terminado».** Verde para «confirmada»
   gasta el color más terminal del semáforo en un estado que todavía no ha ocurrido, y deja a
   «atendida» con un teal que nadie lee como cierre.
3. **Libera el teal**, que es el mejor color de evento que había y hoy está bloqueado (§5).

**El costo real es bajo:** la base guarda nombres de estado, no hex, así que repintar los
cinco es **CSS, no migración**. Y «atendida» se estrenó el 21 de agosto: el aprendizaje
acumulado son días, no meses. Este es el momento barato de corregirlo; dentro de seis meses ya
no lo será.

Se adopta `#64748b` de producción para «no asistió» en vez del `#6b7b8f` que traía este
documento: la diferencia es invisible y no hay razón para tocar lo que ya está pintado.

**Si se decide mantener la asignación de producción**, lo único que cambia en el resto del
documento es que `teal #155e75` **no puede volver** a la paleta de eventos de §5, que se
queda en seis para siempre. Todo lo demás —formas, píldoras, puntos, CSS— es idéntico.

```css
.ev--agendada   { background:var(--ag-agendada-bg);   border-color:var(--ag-agendada-brd);
                  border-left-color:var(--ag-agendada) }
.ev--agendada   .ev__hora { color:var(--ag-agendada-tx) }
.ev--confirmada { background:var(--ag-confirmada-bg); border-color:var(--ag-confirmada-brd);
                  border-left-color:var(--ag-confirmada) }
.ev--confirmada .ev__hora { color:var(--ag-confirmada-tx) }
.ev--atendida   { background:var(--ag-atendida-bg);   border-color:var(--ag-atendida-brd);
                  border-left-color:var(--ag-atendida) }
.ev--atendida   .ev__hora { color:var(--ag-atendida-tx) }
.ev--cancelada  { background:var(--ag-cancelada-bg);  border-color:var(--ag-cancelada-brd);
                  border-left-color:var(--ag-cancelada) }
.ev--cancelada  .ev__hora   { color:var(--ag-cancelada-tx) }
.ev--cancelada  .ev__nombre { text-decoration: line-through }
.ev--nopresento { background:var(--ag-nopresento-bg); border-color:var(--ag-nopresento-brd);
                  border-left-color:var(--ag-nopresento) }
.ev--nopresento .ev__hora { color:var(--ag-nopresento-tx) }
```

**El nombre es `#173156` en los cinco.** El estado se codifica en la barra y en la hora, nunca
en la legibilidad del nombre: un nombre en gris claro no se lee, y el paciente no deja de
existir porque canceló.

**Cancelada** lleva tachado. **No asistió** no: la cita sí ocurrió en la agenda, el paciente
no llegó. Son cosas distintas y se ven distintas.

### Píldora de estado

Solo donde hay ancho: vista Día de escritorio y `listDay` móvil.

```css
.fc-timeGridDay-view .ev__estado,
.fc-list-table .ev__estado {
  display: inline-flex; align-items: center; min-height: 20px;
  padding: 0 var(--ag-2); border-radius: var(--ag-r-pill);
  border: 1px solid currentColor; background: #fff;
  font-size: 10.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
}
```

Hereda el color por estado con `currentColor` — una regla en vez de cinco.

### Punto en el mes

```css
.fc-daygrid-event-dot { width: 7px; height: 7px; border: 0; border-radius: 50%;
                        background: var(--dot-color) }
.ev--evento .fc-daygrid-event-dot,
.ev--gcal   .fc-daygrid-event-dot { border-radius: 2px }   /* cuadrado = no es cita */
```

El punto **cuadrado** distingue evento de cita sin depender del color. A 7 px un icono es
ruido, un punto cuadrado se lee.

---

## 5. Eventos propios: color e icono

`tipo: 'evento'`. Sin estado. Color e icono elegidos por el usuario.

### Paleta — 7 opciones

| Identificador (base) | Etiqueta (UI) | Hex | Fondo (8 %) | Borde (30 %) |
|---|---|---|---|---|
| `indigo` | Índigo | `#3730a3` | `#ebeaf5` | `#c3c1e0` |
| `magenta` | Magenta | `#a21caf` | `#f6ebf7` | `#e0bde5` |
| `carmin` | Carmín | `#be185d` | `#f9ebf1` | `#e8bccf` |
| `oliva` | Oliva | `#4d7c0f` | `#eef3e7` | `#c7d8b0` |
| `bronce` | Bronce | `#78350f` | `#f2ebe7` | `#d7c2b5` |
| `grafito` | Grafito | `#1f2937` | `#e9eaec` | `#bcbfc4` |

**Seis, no siete.** `teal` y `pizarra` salieron porque chocaban con estados que viven en el
mismo calendario: «atendida» es teal `#0f766e` y «no asistió» es `#64748b`. `grafito`
`#1f2937` cubre el hueco del neutro con un tono y un nombre que no se confunden con «no
asistió». `magenta` en vez de `fucsia`: con `carmin` al lado la distinción se lee igual y el
nombre es más reconocible.

Si se adopta la rotación de estados de §4, **`teal` queda libre** y puede volver como séptimo
color — pero eso ya es una migración (el `CHECK` de la base fija los seis), así que no entra
en este documento.

**La base guarda el identificador, nunca el hex.** El hex vive solo en el CSS: si mañana se
ajusta un tono, no hay migración de datos. El identificador va sin acentos y en minúsculas.

`color` es **NOT NULL con default `'grafito'`**. No hay estado «sin color»: la barra izquierda
y el punto del mes siempre pintan algo, así que un nulo solo significaría «el usuario no
eligió y le tocó el neutro» — mejor que sea el default explícito.

### El criterio de separación: claridad, no tono

Esto corrige un criterio de versiones anteriores de este documento y es lo que hay que aplicar
al añadir cualquier color futuro. **Separar por hue no basta.** Medido contra los colores que
ya conviven en el calendario:

| Par | Δ hue | Qué los separa de verdad |
|---|---|---|
| `grafito` vs. no asistió `#64748b` | **0.4°** | claridad: 25 puntos de luminosidad |
| `indigo` vs. Google `#7c3aed` | 11.4° | claridad + saturación |
| `bronce` vs. cancelada `#c0392b` | 21.7° | claridad: bronce es mucho más oscuro |
| `carmin` vs. cancelada `#c0392b` | 24.9° | **solo 8.6 puntos — el par más apretado** |

`grafito` está a **cero grados** del gris de «no asistió» y aun así no se confunden, porque
uno es casi negro y el otro es un gris medio. Eso es la regla:

> **Un color nuevo entra si se separa de todos los existentes por hue O por claridad.
> Si empata en las dos, no entra.**

Los seis pasan AA con texto blanco; el más apretado es `oliva` con **4.99:1**.

### El par a vigilar: `carmin` vs. cancelada

24.9° de hue y 8.6 puntos de luminosidad, 1.25:1 entre ellos. Es el punto débil de la paleta:
a 7 px de punto en la vista de mes, un evento en carmín y una cita cancelada se parecen.

**Propuesta: bajar `carmin` a `#9d174d`.** Gana ~7 puntos de luminosidad contra el rojo de
cancelada —la separación pasa de 8.6 a ~15— y empuja el hue otros 6° hacia el púrpura. Fondo
`#f5e8ed`, borde `#e0b5c6`. Es CSS: la base guarda `carmin`, no el hex.

Y la nota honesta: **dos rosas cálidos en una paleta que además tiene un estado rojo nunca van
a estar cómodos.** Si tras el ajuste sigue costando distinguirlos en el mes, la solución no es
seguir retiñendo, es retirar `carmin` y quedarse en cinco. Con `magenta` cubriendo el rango
rosa, la pérdida es menor de lo que parece.

Siete hues repartidos por la rueda, todos con luminancia entre 25 % y 40 %: texto blanco
encima siempre pasa AA y ninguno se confunde con los cinco estados.

**Siete y no ocho: el violeta salió del selector**, reservado para Google (§6). Un evento
propio en violeta sería indistinguible de uno sincronizado.

### Iconografía — Health Icons

**healthicons.org · CC0, dominio público.** Sin atribución, sin restricción comercial.
Iconos de dominio clínico real: hay bisturí, no una carita. Set `outline`, 24×24.

Se sirven como SVG en `/public/icons/` y se pintan con **`mask-image` + `background`**, así
un solo archivo sirve para los siete colores. No hay 7 × 16 variantes.

**Quirófano y hospital** · `cirugia` `instrumental` `urgencias` `internamiento` `ronda`
**Especialidad y estudios** · `columna` `ortopedia` `imagen` `ultrasonido` `rehabilitacion` `laboratorio` `vacuna`
**No asistencial** · `junta` `videollamada` `docencia` `congreso` `viaje` `comida` `personal` `bloqueo`

`icono` es **nullable**: `NULL` significa «sin icono» y es un estado válido del diseño (la
tarjeta muestra hora y nombre, y `.ev__ico` queda en `display: none`). El identificador es
**exactamente el nombre del archivo sin `.svg`**.

| Identificador | Archivo | Ruta en healthicons.org (verificada) |
|---|---|---|
| `cirugia` | `cirugia.svg` | `outline/specialties/surgical-department` |
| `instrumental` | `instrumental.svg` | `outline/devices/surgical-tools` |
| `urgencias` | `urgencias.svg` | `outline/specialties/accident-and-emergency` |
| `internamiento` | `internamiento.svg` | `outline/devices/hospital-bed` |
| `ronda` | `ronda.svg` | `outline/devices/stethoscope` |
| `columna` | `columna.svg` | `outline/body/spine` |
| `ortopedia` | `ortopedia.svg` | `outline/specialties/orthopaedics` |
| `imagen` | `imagen.svg` | `outline/specialties/radiology` |
| `ultrasonido` | `ultrasonido.svg` | `outline/devices/ultrasound-device` |
| `rehabilitacion` | `rehabilitacion.svg` | `outline/specialties/physical-therapy` |
| `laboratorio` | `laboratorio.svg` | `outline/devices/microscope` |
| `vacuna` | `vacuna.svg` | `outline/devices/syringe-vaccine` |
| `junta` | `junta.svg` | `outline/people/group-discussion` |
| `videollamada` | `videollamada.svg` | `outline/symbols/telemedicine` |
| `docencia` | `docencia.svg` | `outline/people/training` |
| `congreso` | `congreso.svg` | `outline/objects/megaphone` |
| `viaje` | `viaje.svg` | `outline/vehicles/small-airplane` |
| `comida` | `comida.svg` | `outline/objects/utensils` |
| `personal` | `personal.svg` | `outline/places/home` |
| `bloqueo` | `bloqueo.svg` | `outline/objects/calendar` |

**20 identificadores. Lista cerrada.** Los cuatro últimos (`laboratorio`, `vacuna`, `viaje`,
`personal`) cierran huecos que la base actual ya anticipaba —`avion` = viaje,
`candado` = personal— más dos casos clínicos que faltaban. Entrar todos ahora ahorra una
migración después.

Las rutas de esta tabla están **verificadas contra el catálogo de healthicons.org**. Los
*slugs* son el nombre visible en kebab-case, que es el patrón de las URLs del sitio:
`healthicons.org/icon/outline/<categoría>/<slug>`. La forma práctica de bajarlos es el
`icons.zip` del sitio («Download all») y sacar los 20 de `outline/24px`.

**El identificador de la base no depende de la ruta.** Si un icono de origen cambia de sitio o
se sustituye por otro glifo, solo cambia el archivo del disco: la migración no se toca.

**Los veinte están fijados en un `CHECK` de la base: ampliar la lista es una migración.** Y el
criterio para cualquier candidato futuro, además del `CHECK`: **el icono se pinta a 10–11 px
en las tarjetas de `timeGrid`**, así que un SVG con mucho trazo fino se convierte en una
mancha. `columna.svg` son 5 KB de trazos y a ese tamaño está en el límite. Antes de añadir
uno, míralo a 10 px, no a 24 — si a 10 px no se distingue de otro del set, no entra.

### Inyección

> ### ✅ CONSTRUIDO POR OTRA VÍA — esta sección describe lo que HAY
>
> El plan era `eventDidMount` escribiendo dos custom properties sobre el `<td>`
> del evento, y el CSS leyéndolas. **No se hizo así, y no queda pendiente:** el
> icono lo pinta un componente de React, `IconoDelEvento`, desde dentro de
> `eventContent`. **No hay un solo `eventDidMount` en la agenda.**
>
> Por qué salió así: las tarjetas se acabaron construyendo enteras en React
> —`MemoizedEventContent`, `MonthChip`, `GoogleEventCard`, `ChipDeBanda`—, y una
> vez ahí dentro el icono es un hijo más. `eventDidMount` habría sido un segundo
> camino, imperativo y sobre el DOM ya pintado, para decidir lo mismo que el
> renderizador acababa de decidir con los datos en la mano.
>
> Lo que sí sobrevive del plan es la MECÁNICA: sigue siendo una máscara CSS sobre
> el SVG, para que el icono herede el color en vez de traerlo horneado. Lo que
> cambia es quién la aplica.

Lo que hay, en `agenda/page.tsx`:

```tsx
function IconoDelEvento({ nombre, size, color }: {…}) {
  const archivo = `url(/icons/${nombre}.svg)`
  return <span aria-hidden="true" style={{
    background: color ?? 'currentColor',
    WebkitMaskImage: archivo, maskImage: archivo, …
  }} />
}
```

Sin `color`, hereda `currentColor` — que es como se comporta cualquier icono de
la librería a la que sustituye. El color del evento lo resuelve el propio
renderizador con la precedencia de §5, y se lo pasa.

⚠️ **Si algún día vuelve a hacer falta una custom property por evento**, el sitio
NO es `eventDidMount` sino `eventClassNames` + una regla de CSS, o el `style` del
propio componente. Volver a montar un hook de DOM sobre las tarjetas reabre el
problema de las dos fuentes de verdad.

### Tamaño de icono por vista

| Vista | Tamaño |
|---|---|
| `dayGridMonth` | — (punto cuadrado de 7 px) |
| `timeGridWeek` | 16 px, en la línea de la hora |
| `timeGridDay` | **26 px, columna propia** |
| `listDay` móvil | 34 px en contenedor de fondo suave |
| `listWeek` móvil | 11 px |

**La columna propia de la vista Día es la pieza a entender.** El icono no vive en la línea de
texto: tiene su propia celda con `gap: var(--ag-4)`. Sale nativo porque `eventContent`
devuelve tu markup y ese markup es un flex — la celda del icono es un hijo más.

```css
.fc-timeGridDay-view .ev__wrap { flex-direction: row; align-items: center; gap: var(--ag-4) }
.fc-timeGridDay-view .ev__ico  { width: 26px; height: 26px }
.fc-timeGridDay-view .ev__nombre { font-size: 15px }
.fc-timeGridDay-view .ev__meta { display: block; flex: 1; min-width: 0;
                                 font-size: 12.5px; color: var(--ag-ink-600);
                                 white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
```

En las **listas** la columna ya existe: FC renderiza `.fc-list-event-graphic` como celda
aparte con `.fc-list-event-dot` dentro. Se le da ancho y el dot se pinta con la máscara.
**El icono *es* el dot.**

```css
.fc-list-event-graphic { width: 34px }
.ev--evento .fc-list-event-dot, .ev--gcal .fc-list-event-dot {
  width: 21px; height: 21px; border: 0; border-radius: 0;
  background: var(--ev-color);
  -webkit-mask: var(--ev-icono) center / contain no-repeat;
          mask: var(--ev-icono) center / contain no-repeat;
}
```

### Bloqueos

`tipo: 'bloqueo'` (comida, cierres) → `display: 'background'`. Sin tarjeta, sin borde, con
título visible.

```css
.fc-bg-event { background: var(--ag-surface-muted); opacity: 1 }
.fc-bg-event .fc-event-title { font-size: 11px; font-weight: 600; color: var(--ag-ink-400);
                               font-style: normal; padding: 2px var(--ag-2-5) }
```

`opacity: 1` y `font-style: normal` porque los defaults de FC son translúcido y cursiva, y las
dos cosas se ven como error de render.

---

## 6. Eventos de Google

Ya existen en la app. El diseño los conserva.

- **Violeta `#7c3aed`** reservado. Fondo `#f4effd`, borde `#d8c9f7`.
- **Marca de Google** (logo de 4 colores) a la izquierda de la hora. **No se tiñe** con
  `--ev-color`: es una marca, va en sus colores. Única excepción a la regla de máscara de §5.
- **Chip `EVENTO`**: 10.5 px, 700, borde `#d8c9f7`, texto violeta.
- **Sin estado** (no es una cita) y **sin icono elegible** (no es un evento propio).

```css
.ev--gcal { background: var(--ag-gcal-bg); border-color: var(--ag-gcal-brd);
            border-left-color: var(--ag-gcal) }
.ev--gcal .ev__hora { color: var(--ag-gcal) }
.ev--gcal .ev__ico  { background: none; mask: none;   /* la marca va a color */
                      background-image: url(/icons/google.svg);
                      background-size: contain; background-repeat: no-repeat }
```

La marca SVG a color se sirve como archivo aparte, `/public/icons/google.svg`. No es una
máscara.

### El interruptor de visibilidad

- **Escritorio:** en la leyenda, junto al ítem «Google Calendar». `role="switch"`,
  `aria-checked`, texto «Mostrando · Ocultar». Está donde el usuario ve el color que quiere
  quitar.
- **Móvil:** en el menú ☰, sección «Mostrar en la agenda».

---

## 7. Las tres vistas

### 7.1 Config visual base

```js
{
  locale: esLocale, firstDay: 1,
  headerToolbar: false,          // el toolbar es propio
  height: '100%',
  nowIndicator: true,
  slotDuration: '00:30',
  slotLabelInterval: '01:00',
  slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
  eventTimeFormat:  { hour: '2-digit', minute: '2-digit', hour12: false },
  scrollTime: '08:00',
  allDaySlot: true, allDayText: 'todo el día',
  slotEventOverlap: false,       // concurrentes lado a lado, sin encimarse
  dayHeaderFormat: { weekday: 'short', day: 'numeric' },
}
```

`hour12: false` en los dos formatos, o FC mezcla «10:30» con «10:30 a. m.» entre la rejilla y
el gutter.

### 7.2 Mes — `dayGridMonth`

```js
{ dayMaxEvents: 3, fixedWeekCount: false, showNonCurrentDates: false,
  expandRows: false, eventDisplay: 'list-item', moreLinkClick: 'popover' }
```

- `expandRows: false` + `fixedWeekCount: false` → **el mes ocupa solo sus semanas reales y las
  filas se encogen a su contenido.** Una semana con dos citas no mide lo mismo que una con
  doce. Es la mitad de la respuesta al espacio desperdiciado.
- `eventDisplay: 'list-item'` → chip con punto, no bloque sólido. Con 3+ eventos por celda es
  la diferencia entre leer y adivinar.
- Chip: punto de 7 px + hora en 700 tabular + título truncado.

```css
.fc-daygrid-day-number { font-size: 12.5px; font-weight: 700; color: var(--ag-ink-600);
                         padding: var(--ag-1-5) }
.fc-day-today .fc-daygrid-day-number {
  background: var(--ag-primary); color: #fff; border-radius: 50%;
  min-width: 24px; height: 24px; display: grid; place-items: center }
.fc-daygrid-event { border: 0; background: transparent; padding: 0 var(--ag-1-5);
                    min-height: 22px; border-radius: 4px }
.fc-daygrid-more-link { font-size: 10.5px; font-weight: 700; color: var(--ag-primary) }
```

El número de hoy en círculo relleno es la única marca de «hoy» que se lee de reojo.

### 7.3 Semana — `timeGridWeek`

- 7 columnas, fila `allDay` arriba, `nowIndicator` en la columna de hoy.
- Tarjeta en **2 líneas**: hora + nombre. A `slotDuration: '00:30'` una cita de 30 min mide
  28 px: **dos líneas es el techo real.** No metas una tercera.
- Encabezado «MIÉ 19» con píldora **HOY** en el día actual.

```js
dayHeaderContent: (a) => (
  <span className="dh">
    <span className="dh__dia">{fmtDia(a.date)}</span>
    <span className="dh__num">{a.date.getDate()}</span>
    {a.isToday && <span className="dh__hoy">HOY</span>}
  </span>
)
```

```css
.fc-col-header-cell { background: var(--ag-surface); padding: var(--ag-2) 0 }
.dh { display: flex; flex-direction: column; align-items: center; gap: 2px }
.dh__dia { font-size: 11.5px; font-weight: 700; text-transform: uppercase;
           letter-spacing: .04em; color: var(--ag-ink-350) }
.dh__num { font-size: 17px; font-weight: 800; color: var(--ag-ink-800) }
.dh__hoy { font-size: 9.5px; font-weight: 700; letter-spacing: .06em;
           padding: 1px 6px; border-radius: var(--ag-r-pill);
           background: var(--ag-primary); color: #fff }
.fc-day-today .dh__num { color: var(--ag-primary) }
```

### 7.4 Día — `timeGridDay`

Una columna a ancho completo. Tarjeta en **fila horizontal**: icono 26 px · hora · nombre ·
motivo · píldora de estado. Es la única vista con ancho para eso.

Y el **panel lateral** de §8. Solo aquí.

### 7.5 Móvil: Día y Semana son listas

En móvil, `timeGrid` no funciona: 7 columnas en 360 px son 45 px por columna, y una rejilla de
12 h da tarjetas de 28 px con texto ilegible.

| Chip | Vista real móvil |
|---|---|
| Día | `listDay` |
| Semana | `listWeek` |
| Mes | `dayGridMonth` + panel del día debajo |

No es una degradación: es la vista correcta para el tamaño. Y de paso las listas **sí** son
navegables por teclado, y `timeGrid` no (§10).

```css
.fc-list-event { min-height: var(--ag-tap) }
.fc-list-event th, .fc-list-event td { padding: var(--ag-2-5) var(--ag-4);
                                       border-bottom: 1px solid var(--ag-line-divider) }
.fc-list-event-time { width: 52px; font-size: 13px; font-weight: 700;
                      color: var(--ag-ink-800) }
.fc-list-event-title a { font-size: 15.5px; font-weight: 600; color: var(--ag-ink-800);
                         text-decoration: none }
.fc-list-day-cushion { background: var(--ag-surface-sunken);
                       font-size: 12.5px; font-weight: 700; text-transform: uppercase;
                       letter-spacing: .04em; color: var(--ag-ink-500) }
.fc-list-event:hover td { background: var(--ag-primary-bg-faint) }
```

Los `allDay` aparecen al inicio del grupo de su día con «todo el día» en la columna de hora.

### 7.6 Qué se esconde en cada tamaño

| Elemento | Escritorio | Móvil |
|---|---|---|
| Toolbar | barra blanca sobre `--ag-app-bg` | **banda azul** (§9) |
| Selector de médico | en el toolbar | en la banda azul, fila propia |
| Engrane de Horario | en el toolbar | en la banda azul, a la derecha del selector |
| Leyenda de estados | fila bajo el toolbar | oculta |
| Panel de resumen y huecos | solo `timeGridDay` | oculto |
| «Nueva cita» | botón primario en el toolbar | **barra inferior fija, 56 px** |
| Navegación de fecha | ‹ · etiqueta · › | fila propia, botones 44×44 |
| `dayMaxEvents` | 3 | 2 |

Umbral **1024 px**. Entre 768 y 1024 va el layout de escritorio **sin panel lateral**.

---

## 8. Compactar y el panel lateral

### 8.1 Compactar — el resultado visual

**Alcance:** la agenda solo bloquea **columnas de día completas** y **horarios corridos**.
Nunca tramos intermedios. Por eso el colapso siempre es de fila o columna completa, y sale de
dos opciones nativas.

```js
calendar.batchRendering(() => {
  calendar.setOption('hiddenDays', [0]);        // columna fuera del DOM
  calendar.setOption('slotMinTime', '08:00');   // filas de arriba fuera
  calendar.setOption('slotMaxTime', '18:00');   // filas de abajo fuera
});
```

`hiddenDays` **no encoge la columna: la elimina** y el ancho se redistribuye. Sin domingo, las
6 columnas restantes ganan ~16 % cada una.

**La media jornada no colapsa, y es correcto.** `slotMaxTime` es global a la vista: recortar a
las 13:00 por el sábado borraría las tardes de toda la semana. El sábado muestra su
13:00–18:00 en gris de fuera de horario, que es lo que `businessHours` ya sabe.

Opcional — **estrechar la columna del sábado**. FC genera un `<col>` por día, y el ancho hay
que ponerlo **sobre ese `<col>`, no sobre la celda**: en un `<table>` con `table-layout: fixed`
los porcentajes se reparten contra el ancho de la tabla, así que un `60%` sobre `.fc-day-sat`
no hace lo que parece.

```css
.agenda--compacta .fc-timegrid col.fc-day-sat { width: 6% }
```

Si no cuadra a la primera, **déjalo**: es una mejora opcional, no un requisito. El sábado en
gris de fuera de horario ya comunica la media jornada. Ver riesgo 12.

> Se colapsa lo que está cerrado por completo. Lo que está parcialmente abierto se atenúa, no
> se colapsa.

Interruptor: botón «Compactar» en el toolbar con `aria-pressed`, y debajo una línea que
declara qué se ocultó: «Domingo y 07:00–08:00 ocultos». Un calendario que esconde información
sin decirlo es un calendario en el que no se confía.

### 8.2 El panel lateral — layout

```css
.dia { display: flex; gap: var(--ag-4-5);
       padding: var(--ag-4) var(--ag-6) var(--ag-5) }
.dia__cal   { flex: 1; min-width: 0 }        /* min-width:0 OBLIGATORIO */
.dia__aside { width: var(--ag-rail-w); flex: none;
              display: flex; flex-direction: column; gap: var(--ag-3-5) }
```

**El `min-width: 0` no es opcional:** sin él el `<table>` de FullCalendar desborda el flex y
el panel se sale de la pantalla. Y el calendario va con `height: '100%'` dentro de un wrapper
de altura fija — con `height: 'auto'` el panel y la rejilla dejan de alinearse.

Solo en `timeGridDay`. El montaje se decide por el tipo de vista que reporta FC, no con un
media query.

### 8.3 Card 1 · Resumen del día

Cuatro tiles en `grid-template-columns: 1fr 1fr; gap: var(--ag-2-5)`:

| Tile | Color del número |
|---|---|
| citas | `--ag-ink-800` |
| eventos | color del evento |
| h ocupadas | `--ag-ink-800` |
| h libres | `--ag-primary` |

```css
.tile { display: flex; flex-direction: column; gap: 1px; padding: var(--ag-2-5);
        background: var(--ag-surface-sunken); border-radius: var(--ag-r-btn-sm) }
.tile__n { font-size: 24px; font-weight: 900; line-height: 1.1 }
.tile__l { font-size: 10.5px; font-weight: 600; color: var(--ag-ink-500) }
```

Debajo, separado por `border-top: 1px solid var(--ag-line-divider)`, el desglose por estado:
punto de 9 px + «2 confirmadas». **Los estados con cero no se listan** — es un resumen, no una
tabla.

### Qué día resume, y qué cuenta

Reglas de producto, no de estilo. Cambian lo que el panel muestra, así que van aquí:

- **Habla de HOY si hoy cae en el rango pintado; si no, del primer día del rango.** Sin
  selector propio de fecha: el panel sigue al calendario, no compite con él.
- **Usa el desplegable de médico que la agenda ya tiene arriba.** No hay un segundo filtro. Con
  un médico filtrado, el encabezado lo dice: «Resumen · Dra. X».
- **`cancelada` NO cuenta como hora ocupada.** Ese tramo está libre y es el caso de negocio que
  crea huecos: alguien canceló, ¿qué me queda? Sí cuenta en el número de citas —existe y hay
  que verla—, no en las horas. Igual para `no asistió`.
- **Los eventos de día completo de Google no cuentan en horas ocupadas, pero sí se nombran en
  el resumen.** Hoy son invisibles en Semana y Día (`allDaySlot: false`), así que sumarlos
  dejaría un día sin huecos y sin nada en pantalla que lo explique. Se nombran en una línea
  bajo el desglose: «1 evento de día completo en Google».
- **Con el interruptor de Google APAGADO, esos eventos siguen ocupando**, y el resumen lo dice:
  «2 h ocupadas por eventos de Google ocultos». Ocultar y liberar a la vez es exactamente cómo
  la secretaria agenda encima de un evento del administrador. **El interruptor es de
  visibilidad, nunca de disponibilidad.**
- **Los eventos de Google pertenecen a quien conectó Google.** Se muestran con el filtro en
  «Todos los médicos» o en ese usuario, y desaparecen al filtrar por otro médico.

### 8.4 Card 2 · Huecos disponibles

```css
.hueco { display: flex; align-items: center; min-height: var(--ag-tap);
         padding: 0 var(--ag-3); border-radius: var(--ag-r-btn-sm);
         border: 1px dashed var(--ag-line-dash);
         background: var(--ag-surface-sunken); cursor: pointer }
.hueco:hover, .hueco:focus-visible {
         background: var(--ag-primary-bg-faint); border-color: var(--ag-primary) }
.hueco__rango { font-size: 13px; font-weight: 700; color: var(--ag-ink-800) }
.hueco__dur   { margin-left: auto; font-size: 10.5px; color: var(--ag-ink-500) }
```

**El borde discontinuo no es decoración:** es lo que distingue «espacio disponible» de «evento
existente» sin depender del color.

Qué resta y qué no, con las mismas reglas del resumen:

| Resta el hueco | No lo resta |
|---|---|
| Citas agendada, confirmada, atendida | Citas **canceladas** y **no asistió** |
| Eventos propios (`tipo:'evento'`) | Bloqueos (`display:'background'`) — ya están fuera de `businessHours` |
| Eventos de Google **con hora**, visibles u **ocultos** | Eventos de Google de **día completo** |

Los dos errores que esto previene: filtrar solo por `tipo === 'cita'` deja que se agende encima
de una cirugía; y tratar el interruptor de Google como si liberara el tramo hace que se agende
encima de un evento del administrador.

Al pulsar, `calendar.select(inicio, fin)` **antes** de abrir el formulario, para que el usuario
vea en la rejilla el tramo que va a ocupar. Requiere `selectable: true`.

```css
.fc-highlight { background: var(--ag-primary-bg); border-radius: var(--ag-r-note) }
```

**Sin huecos**, la card no se oculta: muestra «Día completo · No queda ningún tramo de 60 min
libre entre 08:00 y 18:00», icono en `--ag-ink-150`. Una card que desaparece parece un error
de carga.

### 8.5 Etiquetas de procedencia

En el mockup cada card lleva un chip pequeño (`getEvents()`, `eventsSet`) que documenta el
origen del dato. **Son para el handoff: no van a producción.**

---

## 9. Banda azul del header móvil

Hoy el header móvil es blanco. **Esto es trabajo nuevo, no un ajuste de estilo.**

```css
.banda {
  background: linear-gradient(180deg, var(--ag-navy-1) 0%, var(--ag-navy-2) 100%);
  padding: var(--ag-1-5) var(--ag-4) var(--ag-3-5);
  padding-top: calc(env(safe-area-inset-top) + var(--ag-1-5));
  display: flex; flex-direction: column; gap: var(--ag-3);
}
.banda__ctrl { background: rgba(255,255,255,.14);
               border: 1px solid rgba(255,255,255,.24);
               border-radius: var(--ag-r-btn); color: #fff;
               min-width: 44px; min-height: 44px }
```

- **El gradiente es el mismo del sidebar de escritorio** (`Sidebar.tsx`), a propósito: móvil y
  escritorio comparten cromo.
- Se extiende **por debajo de la status bar**: `env(safe-area-inset-top)` más
  `<meta name="theme-color" content="#123a63">` para que la barra de Android/iOS se tiña del
  mismo azul y no haya costura.
- Contenido, en orden:
  1. ☰ 44×44
  2. «Agenda» 19 px 700 blanco + subtítulo «Umán · 3 citas · 3 eventos» en `#a9c4de` 12.5 px
  3. Conmutador Día/Semana/Mes — pista `rgba(0,0,0,.22)`, pestaña activa **blanca** con texto
     `#173156`
  4. Fila del filtro de médico (`<select>` en `flex: 1`) + engrane 44×44
  5. Navegación ‹ · etiqueta · ›, botones 44×44
- Los controles van en `rgba(255,255,255,.14)`, **nunca en blanco sólido** — competirían con
  «Nueva cita».
- Las `<option>` del `<select>` necesitan `color: #173156` explícito o quedan blanco sobre
  blanco en el desplegable nativo de Android.
- El filtro de médico y el engrane **sí van en la banda**. La app ya los tiene en móvil; no los
  muevas al menú ☰.
- **«Nueva cita» no va en la banda:** barra inferior fija, ancho completo, 56 px,
  `--ag-primary`, con `padding-bottom: env(safe-area-inset-bottom)`.

---

## 10. Aviso del primer evento de Google

Banda horizontal **entre el toolbar y el calendario**, ancho completo del área de calendario.
No modal (bloquea), no toast (desaparece antes de leerse), no tooltip anclado al evento (se
pierde al hacer scroll).

> **[marca de Google]  Estos eventos vienen de tu Google Calendar**
> Se muestran para que veas tu día completo, pero **no se pueden editar desde Spinus**: se
> modifican en Google y se actualizan aquí en la siguiente sincronización.
>
> ☐ No mostrar este aviso otra vez    [ Entendido ]

```css
.aviso-gcal { background: var(--ag-gcal-bg); border: 1px solid var(--ag-gcal-brd);
              border-radius: var(--ag-r-card); padding: var(--ag-3-5) var(--ag-4) }
.aviso-gcal__t { font-size: 14px; font-weight: 700; color: var(--ag-gcal) }
.aviso-gcal__b { font-size: 12.5px; line-height: 1.55; color: var(--ag-ink-700) }
```

- Casilla de 20×20 con `<label>` asociado y área táctil de 44 px.
- «Entendido» = botón secundario, cierra **para la sesión**. Solo la casilla lo suprime en
  firme.
- ✕ en la esquina, 44×44, `aria-label="Cerrar aviso"`.
- `role="status"`: se anuncia sin robar el foco.
- Móvil: mismo bloque entre la banda azul y la lista, texto en dos líneas, casilla debajo.

El texto explica **por qué** no se puede editar, no solo que no se puede. Un usuario que
entiende la causa no reintenta.

---

## 11. Estados vacíos y de carga

### Carga

- **Primera carga:** la rejilla de FC se pinta **ya con su estructura**, y encima van 3–4
  bloques `--ag-surface-sunken` con shimmer en las horas típicas. La rejilla no debe aparecer
  de golpe: verla estable reduce la sensación de espera.
- **Navegación entre fechas:** **no** skeleton. La rejilla anterior se queda con
  `opacity: .5; pointer-events: none` y una barra de 2 px `--ag-primary` bajo el toolbar.
  Parpadear a skeleton en cada `next()` es peor que esperar.
- **Panel lateral:** los tiles muestran «—» en `#aab6c4`, **no `0`**. Un cero es un dato falso.
- Bajo 150 ms no se muestra nada. Evita el flash.

### Vacío por vista

| Vista | Qué se muestra |
|---|---|
| `timeGridDay` con horario | Rejilla normal. En el panel: «Día libre · 10 h disponibles» |
| `timeGridDay` sin horario | Rejilla atenuada + «Consultorio cerrado los domingos» + «Configurar horario» |
| `timeGridWeek` | Rejilla normal + banda: «Sin citas esta semana» + «Nueva cita» |
| `dayGridMonth` | Rejilla normal + banda: «Sin citas en agosto» |
| `listDay` / `listWeek` | **`noEventsContent`** — icono `--ag-ink-150`, «Sin citas este día», «Nueva cita» |
| Filtrado sin resultados | «Ningún evento de Dra. X este día» + «Ver todos los médicos» |

**La regla: en las vistas de rejilla nunca se oculta la rejilla.** Un calendario vacío sigue
siendo un calendario y el usuario necesita poder hacer clic en una hora. El vacío se comunica
con una banda. En las listas sí se reemplaza: una lista sin filas no es nada.

### Error

Banda `#fdf2f2` con borde `#f3c9c9`: «No se pudo cargar la agenda» + «Reintentar». La rejilla
se queda con el último dato bueno, atenuada.

Si falla **solo** Google: banda violeta discreta «No se pudo sincronizar con Google Calendar ·
Reintentar», y las citas propias se muestran normal.

---

## 12. Accesibilidad visual

> ### 🔴 TRES COSAS DE ESTA SECCIÓN NO SE CONSTRUYERON, Y NO ESTÁN PENDIENTES
>
> Se decidieron **descartar** al cerrar el bloque 9 (2026-08-28), con el trabajo
> de accesibilidad de los modales ya hecho y a la vista de lo que costaba cada
> una. **No son deuda, no son un olvido y no hay que «terminarlas»:** son las
> tres que están marcadas ⛔ abajo. Si vuelves a proponerlas, que sea como
> trabajo NUEVO y con su propio argumento, no como el remate de éste.
>
> Lo que SÍ se construyó de accesibilidad en esta rama, y funciona: rol de
> diálogo, nombre accesible, foco inicial, foco atrapado, cierre con Escape y
> devolución del foco en los cuatro modales de la agenda y en `ModalShell`, que
> lo reparte a otras veintiséis pantallas. Eso no está en esta sección porque
> cuando se escribió el spec no se había mirado.


### Contraste — pares verificados

| Par | Ratio |
|---|---|
| `#173156` sobre `#fff` | 11.6:1 |
| `#173156` sobre `#fef6e7` | 10.8:1 |
| `#b45309` sobre `#fef6e7` | 5.2:1 |
| `#1e5fa8` sobre `#eaf1f9` | 5.6:1 |
| `#0f7a52` sobre `#e9f7ef` | 5.0:1 |
| `#c0392b` sobre `#fdf2f2` | 5.4:1 |
| `#5a6b81` sobre `#f4f6f8` | 4.7:1 |
| blanco sobre `#123a63` | 10.9:1 |
| `#a9c4de` sobre `#123a63` | 5.9:1 |

Todo AA (4.5:1); los ≥ 19 px cumplen AAA.

**El color nunca es la única señal:** el estado se distingue por la etiqueta de su píldora, la
cancelada por el tachado, los huecos por el borde discontinuo, Google por la marca, los
eventos propios por su icono, y evento vs. cita en el mes por el punto cuadrado. Un usuario con
deuteranopia lee la agenda completa sin color.

### Tamaños táctiles

- **44×44** mínimo en todo control: ☰, flechas, engrane, chips de vista, botones de hueco,
  filas de lista, ✕.
- «Nueva cita» móvil: **56 px**, ancho completo.
- Celdas del mes móvil: 44 px de alto mínimo.
- Los chips dentro de una celda del mes **no** llegan a 44 px. Es la excepción aceptada, y por
  eso existe el panel del día debajo del mes: es la ruta táctil real.

### Foco — ⛔ DESCARTADO

> **Decisión de 2026-08-28: el anillo global de 3 px NO se hace.** El argumento
> de abajo sigue siendo bueno; lo que se descartó es la REGLA GLOBAL, por su
> alcance: `.fc *` y `.agenda *` con especificidad cero pisan —o son pisados
> por— los anillos que ya declaran a mano el botón de hueco, el número de día,
> la cabecera navegable y la salida de la banda compacta, y auditar esos cuatro
> más los controles de FullCalendar no cabía en el bloque. Lo que hay hoy es el
> anillo por defecto del navegador más esos cuatro propios.
>
> Si se retoma, va con una auditoría de foco de la agenda entera, no como una
> regla suelta al final de la hoja.

La regla que se planeaba, para quien la retome:

```css
.fc *:focus-visible, .agenda *:focus-visible {
  outline: 3px solid #1B5FA8; outline-offset: 2px; border-radius: 6px;
}
```

**3 px, no 2:** sobre las tarjetas de color un anillo fino se pierde. Nunca `outline: none` sin
reemplazo.

Orden de tabulación: toolbar → chips → navegación → filtro → calendario → panel. El panel
**después** del calendario: es apoyo, no contenido principal.

### Etiqueta para lector de pantalla — ⛔ DESCARTADO

> **Decisión de 2026-08-28: la etiqueta compuesta NO se hace.** El diagnóstico de
> abajo es correcto —el DOM de la tarjeta está fragmentado y se lee como una sopa
> de spans— y aun así se descartó, por dos razones:
>
> 1. **No hay ningún `eventDidMount` en la agenda**, y montarlo sólo para esto
>    reabre lo que §5 cerró: un segundo camino imperativo sobre el DOM ya pintado
>    para decir lo que el renderizador de React acaba de decidir. Si esta etiqueta
>    vuelve, el sitio es `eventContent` —un `aria-label` en el nodo raíz de cada
>    tarjeta— y no un hook de montaje.
> 2. El riesgo 18 de `RIESGOS_AGENDA.md` describe exactamente cómo se rompe: un
>    `switch` que se olvida de un tipo. Con cuatro tipos de tarjeta ya escritos en
>    componentes distintos, el trabajo real no es componer la frase sino
>    garantizar que los cuatro la componen.
>
> **La agenda hoy NO es utilizable con lector de pantalla al nivel que esta
> sección describe.** Queda dicho aquí para que nadie lo descubra creyendo que
> estaba hecho.

Lo que se planeaba, para quien lo retome:

```
"Hugo Interián, 10:30 a 11:00, control postoperatorio, agendada"
"Sesión de quirófano, 12:00 a 13:30, Star Médica quirófano 2, evento"
"Cita pancho francisco, 14:00 a 15:00, evento de Google Calendar, solo lectura"
"Comida, 13:00 a 14:00, consultorio cerrado"
```

Patrón: **título, rango de horas, contexto, naturaleza.** La naturaleza va al final porque es
lo que menos cambia.

Los `display: 'background'` llevan `aria-hidden="true"`: son decoración informativa.

### Los dos límites de FullCalendar

1. **No hay recorrido por teclado celda a celda en `timeGrid`.** No existe en v6. Ruta alterna:
   `listWeek`, completamente navegable. En móvil es gratis: Día y Semana **son** listas.

   > **⛔ El «Ver como lista» de ESCRITORIO está descartado (2026-08-28), y no
   > volverá.** El spec lo pedía visible en el toolbar y no escondido en un menú.
   > No se hizo, y la decisión es firme: `FORMATOS_DE_VISTA` en `agenda/page.tsx`
   > ata cada vista a un formato **por ancho** —`timeGridWeek` ↔ `listWeek`,
   > `timeGridDay` ↔ `listDay`—, así que un conmutador de escritorio no sería un
   > botón más: convertiría «vista × formato» en un tercer eje que hoy no existe,
   > con el `changeView` del segmentado, el efecto del `resize` y la idempotencia
   > de `vistaEnElOtroFormato` colgando de él.
   >
   > **Consecuencia asumida, escrita para que nadie la descubra sola:** en
   > escritorio la rejilla de `timeGrid` NO tiene ruta de teclado alterna. Quien
   > navegue sólo con teclado depende de estrechar la ventana por debajo de
   > 1024 px, que es donde las listas aparecen solas.
2. **`nowIndicator` solo existe en `timeGrid`.** En `listDay` la hora actual se marca con un
   separador propio entre filas.

Y dos menores que afectan al diseño: los encabezados de las vistas de lista **no tienen hook de
contenido** (solo `listDayFormat` / `listDaySideFormat`, por eso no llevan conteo), y
`dayMaxEvents` **no aplica** a las listas.

---

## 13. Tema de FullCalendar

Se cablea una vez y el look default desaparece.

```css
.fc {
  --fc-border-color:            var(--ag-line-input);
  --fc-page-bg-color:           var(--ag-surface);
  --fc-neutral-bg-color:        var(--ag-surface-sunken);
  --fc-non-business-color:      var(--ag-surface-muted);
  --fc-today-bg-color:          var(--ag-primary-bg-faint);
  --fc-now-indicator-color:     #c0392b;
  --fc-event-selected-overlay-color: var(--ag-primary-focus);
  --fc-timegrid-slot-height:    var(--ag-slot-h);
  --fc-list-event-hover-bg-color: var(--ag-primary-bg-faint);
}
.fc-timegrid-slot-label { font-size: 11px; font-weight: 600; color: var(--ag-ink-350) }
.fc-timegrid-axis { width: var(--ag-gutter) }
.fc-timegrid-slot-minor { border-top-style: dotted }
.fc-scrollgrid { border-radius: var(--ag-r-card); overflow: hidden }
```

**`--fc-non-business-color` plano y muy claro es deliberado:** el rayado default de FC compite
con los eventos. El fuera de horario tiene que verse inerte, no texturizado.

`.fc-timegrid-slot-minor` punteado en vez de sólido: la media hora se insinúa, la hora en punto
se afirma. Es lo que da ritmo a la rejilla.

---

## 14. Resumen de dependencias de CSS

Lo que este spec toca del DOM de FullCalendar. Todo son clases públicas de v6:

| Clase | Para qué |
|---|---|
| `.fc-event`, `.fc-event-*` | tarjeta de evento |
| `.fc-bg-event` | bloqueos |
| `.fc-daygrid-event`, `.fc-daygrid-event-dot` | chip y punto del mes |
| `.fc-daygrid-day-number`, `.fc-daygrid-more-link` | número de día, «+N más» |
| `.fc-timegrid-slot`, `-slot-label`, `-slot-minor`, `-axis` | rejilla y gutter |
| `.fc-timegrid-event-harness` | contenedor de posición del evento |
| `.fc-col-header-cell` | encabezado de columna |
| `.fc-day-today`, `.fc-day-sat` | hoy, sábado |
| `.fc-list-event`, `-event-time`, `-event-title`, `-event-graphic`, `-event-dot` | filas de lista |
| `.fc-list-day-cushion` | encabezado de día en lista |
| `.fc-highlight` | selección de `calendar.select()` |
| `.fc-scrollgrid` | marco exterior |
| `--fc-*` custom properties | tema (§13) |

**Ninguna regla depende de la estructura interna de esos nodos** — solo de la clase y de los
hijos propios que mete `eventContent`. Es lo que hace el CSS estable frente a un patch de
FullCalendar.

---

## 15. El conmutador «Cita | Evento» del modal de creación

Encaja con el sistema, y reusar los tokens del conmutador de vistas del toolbar es la decisión
correcta: es el mismo gesto —elegir entre dos modos excluyentes— y el usuario ya lo conoce de
la barra superior. Tres precisiones sobre cómo se comporta.

### Forma

Pista `--ag-surface-sunken` con `border-radius: var(--ag-r-btn)`, dos posiciones de ancho
igual, la activa en `--ag-surface` con `box-shadow: 0 1px 2px rgba(20,52,92,.10)` y texto
`--ag-ink-800`; la inactiva en `--ag-ink-500`. Altura **44 px** — es un control de creación, no
un filtro, y se toca en móvil.

Va **arriba del todo del modal, antes del primer campo**, y **solo en creación**. En edición no
se muestra: cambiar de tipo una cita existente no es un cambio de formulario, es borrar y
crear.

```html
<div role="radiogroup" aria-label="Tipo de registro">
  <button role="radio" aria-checked="true">Cita</button>
  <button role="radio" aria-checked="false">Evento</button>
</div>
```

`radiogroup` y no `tablist`: no son dos vistas del mismo contenido, son dos cosas distintas que
se van a crear. El lector de pantalla debe decir «Cita, seleccionado, 1 de 2».

### Que remonte el modal está bien. Que lo haga en silencio, no

Perder lo escrito al cambiar de posición es la decisión correcta —evita arrastrar un paciente a
un evento— pero **silenciosa es hostil**: alguien teclea un nombre, toca «Evento» por
curiosidad y el trabajo desaparece sin explicación.

La regla, en dos tramos:

- **Formulario intacto** (ningún campo tocado): el cambio es libre e inmediato. Es el caso del
  99 % — el usuario se equivocó de botón al abrir.
- **Formulario con contenido**: confirmación de una línea antes de remontar.
  «¿Cambiar a Evento? Se perderá lo que llevas escrito.» · [Cancelar] [Cambiar]

Es la diferencia entre un control que protege datos y uno que los pierde.

### Las dos posiciones no muestran el mismo formulario

Y ahí está el motivo real de que el conmutador exista, así que la diferencia tiene que verse:

| | Cita | Evento |
|---|---|---|
| Paciente | buscador, obligatorio | no existe |
| Estado | selector de los cinco | no existe |
| Color | no existe (lo da el estado) | selector de 6 (§5) |
| Icono | no existe | selector de 20 (§5) |
| Título | derivado del paciente | campo libre, obligatorio |

En el lado **Evento** el selector de color e icono va **inmediatamente bajo el título**, no al
final: es lo que hace reconocible el evento de un vistazo en la rejilla, y enterrarlo abajo
hace que todo el mundo se quede con el default.
