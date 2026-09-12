# GUIA_FORM · Receta

Spec de implementación por formulario. **Base transversal:** spec 01 §1, §3.1–3.3, §3.7–3.9, §5
y su Anexo de radios. Plantillas: spec 02. Modal posterior: spec 03. Tarjetas: spec 04.

---

## 0 · Anchos de contenedor

| Viewport | Contenedor | Tramo | 1 col | 3 col | span-2 | span-all |
|---|---|---|---|---|---|---|
| 390 | 358 | XS | 316 | — | 316 | 316 |
| 820 | 788 | MD | — | 238 | 492 | 746 |
| 1180 | 860 | LG | — | 262 | 540 | 818 |
| 1440 | 896 | LG | — | 274 | 564 | 854 |

`span-2` = 2 columnas + un gap de 16. `span-all` = contenedor − 42.
En XS, `.sp-doc-span-2` cae a `grid-column: auto` (spec 01 §1.2).

---

## 1 · Estructura

1. Selector de tipo (spec 04)
2. Card **Plantilla** (spec 02 §1) — primer bloque
3. Card **Datos del paciente** — `data-cols="3"`: fecha · paciente · diagnóstico
4. Card **Medicamentos** — N bloques, cada uno con su rejilla `data-cols="3"` y su pie
5. Card **Recomendaciones** — una etiqueta y un `.sp-textarea`
6. Barra de acciones sticky

---

## 2 · Bloque de medicamento

Cada medicamento es un bloque con borde propio: `border: 1px solid var(--sp-line-card)`,
radio `--sp-r-field-sm` 9 px, fondo `--sp-surface`, padding `14px`.
Cabecera del bloque: `MEDICAMENTO {n}` en `.sp-label` 11.5 px `--sp-ink-350` +
papelera a la derecha. Separación entre bloques: `--sp-3` 12 px.

### 2.1 · Rejilla interior — `data-cols="3"`

| Fila | Celdas | Reparto |
|---|---|---|
| 1 | **Nombre comercial** `.sp-doc-span-2` · **Presentación** | 492 + 238 a 788 |
| 2 | **Vía de administración** · **Principio activo** `.sp-doc-span-2` | 238 + 492 a 788 |
| 3 | **Indicaciones** `.sp-doc-span-all` | 746 a 788 |

Cinco campos en nueve celdas, ninguna vacía. Receta **no** tiene rejilla de 4:
LG solo cambia el ancho de columna, no el reparto.

### 2.2 · Pie del bloque

`.sp-btn--compact` de 44 px con `Plus` 17 px + `Agregar medicamento`, al **pie de cada
bloque**, alineado a la izquierda. En XS, a ancho completo.
La cabecera de la card se queda solo con su etiqueta: no hay botón de añadir arriba.

### 2.3 · Papelera de medicamento

44×44, radio `--sp-r-btn-sm` 8, `Trash2` 18 px `--sp-ink-icon`; hover `--sp-danger` sobre
`--sp-danger-bg`; con un solo medicamento, **visible y `disabled`** con `opacity:.4`.
`aria-label`: `Eliminar {nombre comercial}` · vacío: `Eliminar medicamento {n}`.

### 2.4 · Autocomplete de medicamento

`.sp-input` a ancho de la celda (316 en XS, 492 desde MD). Desplegable en portal a `body`,
`position:fixed` desde `getBoundingClientRect()`, `z-index: 55`, ancho del input con
`min-width: 260px`, apertura hacia arriba si no caben 200 px, reposición en `scroll` y
`resize`, máximo 4 filas visibles. Cierra R-03.

Al elegir del catálogo: el **principio activo se escribe en su campo** como valor editable
y aparece el hint `Del catálogo · editable`. Si el medicamento no está en catálogo, el
campo llega vacío y hay que escribirlo.

---

## 3 · Cadenas literales

| Dónde | Texto |
|---|---|
| Primario | `Imprimir receta` — XS: `Imprimir` |
| Toast de éxito | `Receta guardada` |
| `titulo` del modal 03 | `Receta generada` |
| Cabeceras | `DATOS DEL PACIENTE` · `MEDICAMENTOS` · `RECOMENDACIONES` |
| Cabecera de bloque | `MEDICAMENTO 1`, `MEDICAMENTO 2`… |
| Botón del pie | `Agregar medicamento` |
| Etiquetas | `Nombre comercial` · `Presentación` · `Vía de administración` · `Principio activo` · `Indicaciones` |
| Hint de principio activo | `Del catálogo · editable` |
| Hints de datos | `De la ficha · editable` · `Del diagnóstico de la consulta` |
| Banner de faltantes | `Faltan 2 campos: Nombre comercial · Principio activo` |

---

## 4 · Campos: obligatorios, prellenados, retirados

| Campo | Qué pasa | Motivo |
|---|---|---|
| Paciente | Prellenado, **obligatorio** | De la ficha, editable, con hint |
| Diagnóstico | Prellenado | Del diagnóstico de la consulta; hoy llega por prop sin decir de dónde |
| Fecha | Prellenada con hoy | — |
| **Nombre comercial** | Pasa a **obligatorio** | R-01: hoy se emite receta sin un solo medicamento |
| **Principio activo** | Se queda y es **obligatorio** | Denominación genérica exigida por normativa del formato; el catálogo lo prellena cuando existe, pero como valor editable — no como texto informativo, porque los medicamentos fuera de catálogo perderían el dato exigible |
| Presentación · Vía · Indicaciones | Sin cambio | Ninguno es derivable |
| Recomendaciones · **selector predeterminado** | **Se elimina** | R-05: se cierra quitando el control, no sustituyéndolo. Con él se van los nueve bloques y sus emoji |
| Recomendaciones · textarea | Se queda | Lo que el selector resolvía —repetir el mismo bloque— lo cubren las plantillas, que además guardan medicamentos |

**Obligatorios:** paciente · ≥ 1 medicamento con nombre comercial **y** principio activo.

---

## 5 · Colisiones que resuelve

| Id | Qué falla hoy | Cómo queda |
|---|---|---|
| **R-01** | `disabled` solo comprueba paciente: `medsData` filtra por `nombre_comercial` y puede quedar vacío | Obligatorios de §4 + banner que nombra lo que falta |
| **R-02** | `grid-cols-2 sm:grid-cols-3`: el autocomplete cae a 143 px en móvil | `data-cols="3"` + `.sp-doc-span-2`: 316 px en XS, 492 desde MD |
| **R-03** | Desplegable `absolute` dentro del scroller: en la última fila queda fuera de vista | Portal `fixed` con reposición (§2.4) |
| **R-04** | Papelera de 15 px sin padding | 44×44 con icono de 18 (§2.3) |
| **R-05** | El select de recomendaciones inserta acumulando (`prev + '\n\n' + bloque`) y no hay forma de quitar un bloque | El selector se elimina entero; sin control derivado del texto no hay estado que se desincronice |
| **R-06** | `updateMed(i, 'via_administracion' as any, …)` — `any` explícito, prohibido por CLAUDE.md | Fuera del alcance de diseño; corregir al tocar el archivo. Se declara para que no se pierda |

---

## 6 · Decisiones, una línea cada una

- **«Agregar medicamento» al pie de cada bloque** — al final de la lista obligaría a bajar y volver a subir con tres o cuatro medicamentos.
- **Principio activo editable y no texto informativo** — el catálogo no siempre lo trae, y sin él la receta pierde el dato exigido por normativa.
- **Nombre comercial obligatorio** — es el obligatorio real del formato; sin medicamento no hay receta.
- **Selector de recomendaciones fuera** — las plantillas cubren el caso y no dejan estado derivado que divergir.
- **Bloque con borde por medicamento** — cinco campos juntos necesitan que se vea dónde acaba uno.
- **Sin rejilla de 4** — cinco campos en tres columnas dan tres filas exactas; una cuarta columna dejaría celdas cojas.

---

## 7 · NO DEFINIDO

Ninguno propio. R-06 queda anotado como deuda de implementación, no de diseño.
