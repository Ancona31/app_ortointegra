# Riesgos de implementación · Agenda Spinus

Compañero de `SPEC Agenda Spinus.md`. Aquí va **solo dónde se puede romper la estética al
implementarla**: qué falla, cómo se ve cuando falla, y qué lo evita.

No es una lista de bugs de la app. Es la lista de puntos donde el CSS o los *render hooks*
pelean con cómo FullCalendar hace las cosas.

Orden: por lo caro que resulta descubrirlo tarde.

---

## 1. `min-width: 0` en el wrapper del calendario — ALTO

**Qué pasa.** El panel lateral se sale de la pantalla, o el calendario se come el ancho del
`aside` y lo deja en 40 px.

**Por qué.** FullCalendar renderiza un `<table>`. Un `<table>` dentro de un hijo flex tiene
`min-width: auto`, así que **no se encoge por debajo de su contenido** y desborda el
contenedor.

```css
.dia__cal { flex: 1; min-width: 0 }   /* ← sin esto, roto */
```

**Cómo lo ves.** Al abrir la vista Día en una pantalla de 1280 px o menos. En 1920 no se nota,
y por eso llega a producción.

---

## 2. `height: 'auto'` desalinea el panel — ALTO

**Qué pasa.** Las cards del panel y la rejilla arrancan a distinta altura, o el panel queda
flotando sobre un calendario más corto.

**Por qué.** Con `height: 'auto'` FC crece según su contenido, y el contenido cambia con
`slotMinTime`/`slotMaxTime`. El `aside` no sabe nada de eso.

**Qué hacer.** `height: '100%'` en las opciones de FC, dentro de un wrapper de altura fija o
determinada por el flex padre. La altura la manda el layout, nunca el contenido.

---

## 3. Eventos concurrentes rompen la tarjeta de la vista Día — ALTO

**Qué pasa.** La fila horizontal (icono 26 px · hora · nombre · motivo · píldora) se atropella
en cuanto hay dos citas a la misma hora: FC parte la columna en dos al 50 % y esa fila queda en
~340 px.

**Por qué.** El diseño de §7.4 del spec asume ancho completo, y el ancho completo solo existe
mientras no haya concurrencia.

**Qué hacer.** El apilado vertical es el caso base; la fila horizontal, el caso ancho.

```css
.fc-timegrid-event-harness { container-type: inline-size }
.fc-timeGridDay-view .ev__wrap { flex-direction: column; align-items: flex-start; gap: 2px }
@container (min-width: 420px) {
  .fc-timeGridDay-view .ev__wrap { flex-direction: row; align-items: center; gap: var(--ag-4) }
}
@container (max-width: 300px) { .fc-timeGridDay-view .ev__meta { display: none } }
```

Con `slotEventOverlap: false` los concurrentes quedan lado a lado sin encimarse — correcto en
una agenda clínica: dos citas a la misma hora es un error que hay que **ver**, no disimular.

**Cómo lo ves.** El primer día con dos citas solapadas. Pruébalo a propósito.

---

## 4. `mask-image` necesita el prefijo — ALTO

**Qué pasa.** El icono del evento **no aparece**: en su lugar queda un cuadrado del color del
evento. O nada.

**Por qué.** `mask` sin `-webkit-mask` falla en Safari y en WebKit de iOS, que es donde más se
va a usar la app en móvil.

```css
.ev__ico {
  -webkit-mask: var(--ev-icono) center / contain no-repeat;   /* PRIMERO */
          mask: var(--ev-icono) center / contain no-repeat;
}
```

**Y la segunda mitad:** si `--ev-icono` no está definida, `mask` no recibe imagen y **el
elemento se pinta lleno** — el cuadrado de color. Hay que dar salida al caso sin icono:

```css
.ev__ico { display: none }                              /* por defecto, nada */
.ev--evento .ev__ico, .ev--gcal .ev__ico { display: block }
```

**Cómo lo ves.** En Safari, o en cualquier evento al que le falte el campo `icono`.

---

## 5. `--ev-color` no definida pinta el evento transparente — MEDIO

**Qué pasa.** Un evento propio sin color aparece sin fondo, sin borde y con la hora invisible.

**Por qué.** `background: var(--ev-bg)` sin valor cae a `unset`. No hay fallback.

**Qué hacer.** Fallback en cada uso, con la pizarra como color neutro por defecto:

```css
.ev--evento { background: var(--ev-bg, #ebedef);
              border-color: var(--ev-brd, #c2c6cc);
              border-left-color: var(--ev-color, #334155) }
```

Es una línea y elimina una clase entera de eventos invisibles.

---

## 6. Portales de React en la vista de mes — MEDIO

**Qué pasa.** Cambiar de mes se siente pesado; el scroll del mes engancha.

**Por qué.** Con `@fullcalendar/react`, un `eventContent` que devuelve JSX monta **un portal de
React por evento**. Un mes cargado son 150–300 portales.

**Qué hacer.** En `dayGridMonth` **no uses `eventContent`**: con `eventDisplay: 'list-item'` el
chip nativo con el dot re-coloreado por CSS ya *es* el diseño del spec. Un condicional por
`arg.view.type` basta.

Y memoiza `eventContent` fuera del render del componente, o se recrea en cada pintado y FC
vuelve a montar todo.

**Cómo lo ves.** Solo con datos reales de un mes lleno. Con tres eventos de prueba no se nota.

---

## 7. `hour12` mezclado — MEDIO

**Qué pasa.** El gutter dice «10:00» y la tarjeta «10:00 a. m.». O al revés.

**Por qué.** `slotLabelFormat` y `eventTimeFormat` son opciones distintas. Con `locale: 'es'`,
FC decide por su cuenta en la que no especifiques.

```js
slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
```

Las dos, explícitas. Y `meridiem: false` si algún formato se sigue colando.

---

## 8. Los defaults de `.fc-bg-event` se ven como error de render — MEDIO

**Qué pasa.** La comida sale translúcida, con el texto en cursiva y desplazado.

**Por qué.** FC pinta los eventos de fondo con `opacity: .3` y el título en `italic`. Sobre el
gris de fuera de horario eso se lee como «algo se rompió».

```css
.fc-bg-event { background: var(--ag-surface-muted); opacity: 1 }
.fc-bg-event .fc-event-title { font-style: normal; font-size: 11px; font-weight: 600;
                               color: var(--ag-ink-400); padding: 2px var(--ag-2-5) }
```

---

## 9. El rayado de fuera de horario compite con los eventos — MEDIO

**Qué pasa.** La rejilla se ve texturizada y sucia; los eventos claros (agendada, atendida) se
pierden encima.

**Por qué.** El default de `--fc-non-business-color` es un gris con más peso del que este
diseño tolera.

**Qué hacer.** `--fc-non-business-color: #f1f4f7`, plano y muy claro. El fuera de horario tiene
que verse **inerte**, no rayado.

---

## 10. `container-type` sobre el harness puede afectar la posición — MEDIO

**Qué pasa.** Los eventos de `timeGrid` se descolocan verticalmente unos píxeles después de
añadir el container query del riesgo 3.

**Por qué.** `container-type: inline-size` crea contención de tamaño en el eje inline. No
debería tocar el eje de bloque, pero `.fc-timegrid-event-harness` es el nodo que FC posiciona
con `top`/`bottom` inline, así que **hay que verificarlo, no asumirlo**.

**Alternativa si falla:** poner `container-type` en el hijo (`.fc-timegrid-event`) en vez del
harness, o resolverlo con una media query sobre el ancho de la ventana en lugar del container
query. Menos elegante, cero riesgo.

**Verifícalo con dos eventos concurrentes y uno solo, comparando la posición.**

---

## 11. `.fc-list-event-graphic` y la máscara del dot — MEDIO

**Qué pasa.** En las listas móviles el icono no aparece, o aparece como un punto redondo normal.

**Por qué.** El diseño del spec convierte `.fc-list-event-dot` en el icono, quitándole
`border-radius` y `border` y metiéndole la máscara. Depende de que FC siga renderizando ese nodo
como un `<span>` con el dot dentro de `.fc-list-event-graphic`.

Es estable en v6, **pero es la única regla del spec que redefine por completo un nodo de FC en
vez de decorarlo.** Es el primer sitio donde mirar si un patch de FullCalendar rompe algo.

```css
.ev--evento .fc-list-event-dot, .ev--gcal .fc-list-event-dot {
  width: 21px; height: 21px; border: 0; border-radius: 0;
  background: var(--ev-color, #334155);
  -webkit-mask: var(--ev-icono) center / contain no-repeat;
          mask: var(--ev-icono) center / contain no-repeat;
}
```

**Plan B si se rompe:** ocultar el dot (`.fc-list-event-dot { display: none }`) y meter el icono
como primer hijo del título dentro de `eventContent`. Se pierde la columna alineada, se gana
independencia del DOM de FC.

---

## 12. La columna estrecha del sábado — BAJO

**Qué pasa.** `width: 60%` sobre `.fc-day-sat` no hace nada, o descuadra toda la semana.

**Por qué.** FC genera `<col>` por día, y los anchos de columna en un `<table>` con
`table-layout: fixed` se reparten de forma proporcional, no absoluta. Un porcentaje ahí se
interpreta contra el ancho de la tabla, no contra las otras columnas.

**Qué hacer.** Probar con el selector sobre el `<col>` y no sobre la celda:

```css
.agenda--compacta .fc-timegrid col.fc-day-sat { width: 6% }
```

Y si no cuadra, **déjalo**: es una mejora opcional del spec, no un requisito. El sábado en gris
de fuera de horario ya comunica la media jornada.

---

## 13. Tabular-nums olvidado en un sitio — BAJO pero visible

**Qué pasa.** La columna de horas tiembla al navegar entre días; los números del resumen
cambian de ancho al pasar de 9 a 10.

**Por qué.** Se aplicó `font-variant-numeric` a la tarjeta pero no al gutter, o al gutter pero
no a los tiles.

```css
.fc, .agenda { font-variant-numeric: tabular-nums }
```

**Global, una vez.** Es el detalle que más delata un calendario mal hecho y el más fácil de
dejar a medias.

---

## 14. `env(safe-area-inset-*)` sin `viewport-fit` — BAJO

**Qué pasa.** La banda azul no se mete bajo la status bar; queda una franja blanca arriba en
iPhone.

**Por qué.** `env(safe-area-inset-top)` devuelve `0` si el viewport no lo pide.

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#123a63">
```

Los dos. El `theme-color` es lo que tiñe la barra de Android del mismo azul y evita la costura.

---

## 15. Las `<option>` blancas sobre blanco — BAJO

**Qué pasa.** El desplegable de médico se abre y no se ve nada.

**Por qué.** El `<select>` de la banda azul lleva `color: #fff` para el texto cerrado, y las
`<option>` heredan ese blanco en el menú nativo de Android, que se pinta sobre fondo blanco.

```css
.banda select { color: #fff }
.banda select option { color: #173156; background: #fff }
```

Bug real, no un detalle. Se descubre solo en un Android físico.

---

## 16. `box-shadow` en las tarjetas — BAJO

**Qué pasa.** Una columna con 10 citas se ve como papilla gris.

**Por qué.** Diez sombras apiladas a 28 px de distancia se suman.

**Qué hacer.** `box-shadow: none` en `.fc-event`, ya está en el spec. La jerarquía la da la
barra de color y el fondo, no la elevación. Si alguien "mejora" el diseño añadiendo sombras,
esto es lo que pasa.

---

## 17. `color-mix()` anidado en runtime — BAJO

**Qué pasa.** El primer pintado del mes se siente lento sin motivo aparente.

**Por qué.** Un `color-mix()` que referencia una variable que a su vez es un `color-mix()` se
resuelve por elemento. A 200 eventos se mide.

**Qué hacer.** Los tonos derivados (fondo al 8 %, borde al 30 %) **como hex literal** en el
CSS. Ya vienen calculados en la tabla de §5 del spec. Fue un problema real en el mockup.

---

## 18. `aria-label` compuesto que se olvida en un tipo — BAJO

**Qué pasa.** Un lector de pantalla lee «10 30 Hugo Interián control postoperatorio agendada»
como fragmentos sueltos, o lee el chip «EVENTO» dos veces.

**Por qué.** `eventDidMount` compone la etiqueta, pero si un tipo (`gcal`, `bloqueo`) no entra
en el `switch`, se lee el DOM crudo.

**Qué hacer.** El `switch` cubre los cuatro tipos, con un `default` que al menos dé título y
hora. Y los `display: 'background'` llevan `aria-hidden="true"`, o la comida se lee en medio de
las citas.

---

## Lo que verificaría antes de comprometer el sprint

Tres cosas, media hora:

1. **La máscara del icono sobre `.fc-list-event-dot`** (riesgo 11) — en Safari y en Android.
2. **El container query sobre el harness** (riesgo 10) — comparando la posición vertical de un
   evento solo contra dos concurrentes.
3. **La vista Día a 1280 px de ancho** (riesgos 1 y 2) — con el panel montado.

Todo lo demás del spec es CSS sobre clases públicas de FullCalendar v6 y opciones documentadas.
