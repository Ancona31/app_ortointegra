# GUIA_FORM · Escrito médico

Spec de implementación por formulario. **Base transversal:** spec 01 §1, §3.1–3.3, §3.7–3.9, §5
y su Anexo de radios. Plantillas: spec 02. Modal posterior: spec 03. Tarjetas: spec 04.

El más desnudo de los ocho: cuatro datos y un editor. Tres particularidades que ningún otro
comparte: **título variable** (y omisible), **título del pie como campo aparte** y **cuerpo de
texto enriquecido**.

---

## 0 · Anchos de contenedor

| Viewport | Contenedor | Datos | Barra del editor (útil) | Nivel | Área de escritura |
|---|---|---|---|---|---|
| 390 | 358 | 1 col · 316 | 332 | 1 | 240 px de mínimo |
| 820 | 788 | 2 col · 365 | 762 | 3 | 320 px de mínimo |
| 1180 | 860 | 2 col · 401 | 834 | 3 | 320 px de mínimo |
| 1440 | 896 | 2 col · 419 | 870 | 3 | 320 px de mínimo |

Barra útil = contenedor − 2 (bordes de card) − 24 (padding 12 lateral).

---

## 1 · Estructura

1. Selector de tipo (spec 04) · 2. Card **Plantilla** (spec 02 §1)
3. Card **Datos del documento** — `data-cols="2"`
4. Card **Cuerpo del escrito** — barra + área de escritura
5. Barra de acciones sticky

En este formulario las plantillas valen más que en ningún otro: un escrito es casi siempre una
variante de otro que ya se escribió.

---

## 2 · Datos del documento

`data-cols="2"`, cuatro campos en tres filas:

| Fila | Celdas |
|---|---|
| 1 | Fecha · Paciente *(opcional)* |
| 2 | **Título del documento** — `.sp-doc-span-all` |
| 3 | **Título del pie** — `.sp-doc-span-all`, con el enlace `Usar el título` a la derecha |

Dos columnas y no tres: los dos títulos necesitan la fila entera, y con tres columnas la primera
fila quedaría con una celda coja.

### 2.1 · Título del documento

**Es `asunto` renombrado**, no un campo nuevo: es el que hoy se etiqueta «Asunto / Tipo de
documento» y ya encabeza el PDF. Se cambia la etiqueta y **se conserva la clave `asunto`** en
`contenido`, así que los documentos ya emitidos siguen leyéndose. Cierra el NO DEFINIDO de
«¿título nuevo o `asunto` renombrado?» por el lado que no rompe nada.

Sin asterisco y sin validación. Vacío es un caso legítimo: el documento arranca con el cuerpo
bajo el filete del membrete y con algo más de aire arriba.
Hint: `Encabeza el documento. Puede quedar vacío.`

### 2.2 · Título del pie — campo nuevo

No existe hoy en ningún formulario ni renderizador. Imprime un **nombre corto** en el pie de cada
página, y **no es un truncado del título**: recortar por caracteres produce
«Constancia de atención médica y valoración ortopé…», que no identifica nada.

| Comportamiento | Valor |
|---|---|
| Por defecto | Copia el título mientras nadie lo toque |
| Al editarlo | Se desengancha y deja de seguir al título |
| Volver a engancharlo | Enlace `.sp-link-alt` `Usar el título`, `flex: 0 0 auto` a la derecha del campo |
| Hint | `Se imprime en el pie de cada página. Por defecto copia el título; en cuanto lo editas, deja de seguirlo.` |
| Requisito técnico | Prop nueva **solo** en el renderizador del escrito, no en los ocho |

Ejemplo canónico: encabezado
`Constancia de atención médica y valoración ortopédica para trámite escolar ante la Secretaría de Educación`
→ pie `Constancia de atención médica`.

---

## 3 · El editor

### 3.1 · Inventario real: trece controles

Bloque (`<select>`: `Normal` · `Título` · `Subtítulo`) · negrita · cursiva · **subrayado** ·
lista con viñetas · lista numerada · **alinear izquierda, centro, derecha y justificado** ·
separador · quitar formato. **No hay deshacer ni rehacer, y no se añaden**: `⌘Z`/`⌘⇧Z` y el gesto
de sacudir del iPad ya lo hacen, y dos objetivos más obligarían a bajar otra cosa al menú.

### 3.2 · Primero juntar: las cuatro alineaciones son un botón

Cuatro objetivos para elegir un valor de uno. Se juntan en **un botón que muestra la alineación
actual y abre las cuatro**. Trece pasan a **diez** —nueve más el bloque— sin perder función.
Sin esto ningún reparto cabe en una fila a 358 px de contenedor.

### 3.3 · Tres niveles, una sola regla

**Caben las que caben en una fila de 44 px; el resto va al menú, en el mismo orden.**
Orden canónico: negrita · cursiva · viñetas · numerada · subrayado · alineación · cita ·
separador · quitar formato.

| Nivel | Contenedor | Bloque | En la barra | En el menú | Cuenta |
|---|---|---|---|---|---|
| 1 | < 520 | **Botón de 52×44** con el glifo del bloque actual (`¶`) + chevron 13 px | Negrita · Cursiva · Viñetas · Numerada | Subrayado · Alineación · Cita · Separador · Quitar formato | 52 + 4×44 + 44 + 5 gaps de 6 = **302** de 332 |
| 2 | 520–759 | `<select>` de **128 px** | + Subrayado · Alineación | Cita · Separador · Quitar formato | 128 + 6×44 + 44 + 7 gaps de 6 = **478** de 494 |
| 3 | ≥ 760 | `<select>` de **150 px** | Las nueve | — (el botón de menú **no se renderiza**) | 150 + 9×44 + 9 gaps de 8 = **618** de 734 |

La barra **nunca pasa de una fila**: alto 60 px (8 + 44 + 8) en los tres niveles, contra los
~110 px de hoy en 3-4 filas.

### 3.4 · Botones y menú

| Parte | Valor |
|---|---|
| Botón de la barra | 44×44, radio `--sp-r-btn-sm` 8, icono 18 px, color `--sp-ink-700` |
| Activo | Fondo `--sp-primary-bg-faint` + color `--sp-ink-900` — estado por fondo, no solo por color de icono |
| Barra | `padding: 8px 12px`, fondo `--sp-surface-sunken`, `border-bottom: 1px solid var(--sp-line-divider)`, `flex-wrap: nowrap`, gap 6 (niveles 1-2) / 8 (nivel 3) |
| Botón de menú | 44×44 con `MoreHorizontal` 18 px, borde 1 px `--sp-line-input`, `margin-left:auto` — separado del grupo de formato para no pulsarlo al ir a por las listas |
| Menú | `position:absolute; right:0; top: calc(100% + 8px)`, `z-index:5`, `min-width: 212px`, radio 12, sombra `0 12px 28px rgba(16,42,73,.14)`, padding 4 |
| Fila del menú | 44 px, icono 20 px + **nombre escrito** — en un menú no hay que adivinar |

### 3.5 · Área de escritura

`min-height: 240px` bajo 760 px de contenedor y **320 px** desde 760; crece con el contenido.
**No** `min-h-[380px]` fijo: es lo que ahoga el editor donde menos alto útil hay.
El scroll es el del formulario, no uno propio del editor.

Estilos del contenido (`p`, `h2`, `ul`, `ol`, `blockquote`, `hr`) con clases del sistema:
cuerpo 15 px / `--sp-lh-body` 1.7; subtítulo 17 px/800 `--sp-ink-900`; cita con
`border-left: 3px solid var(--sp-line-input)`, `padding-left: 16px`, cursiva `--sp-ink-500`;
separador `border-top: 1px solid var(--sp-line-card)`.

Contador en la cabecera de la card: `.sp-badge` con el número de bloques (`6 bloques` / `Vacío`),
el mismo recuento que usa `isFormEmpty`. Sirve sobre todo tras aplicar una plantilla.

---

## 4 · Cadenas literales

| Dónde | Texto |
|---|---|
| Primario | `Imprimir escrito médico` — XS: `Imprimir` |
| Toast de éxito | `Escrito guardado` |
| `titulo` del modal 03 | `Escrito médico generado` |
| Cabeceras | `DATOS DEL DOCUMENTO` · `CUERPO DEL ESCRITO` |
| Etiquetas | `Fecha` · `Paciente` + `opcional` · `Título del documento` · `Título del pie` |
| Placeholders | `Sin paciente` · `Sin título` · `Redacta aquí el contenido del documento…` |
| Opciones de bloque | `Normal` · `Título` · `Subtítulo` |
| Nombres del menú | `Subrayado` · `Alineación` · `Cita` · `Separador` · `Quitar formato` |
| Enlace del pie | `Usar el título` |
| Hint de título vacío | `Sin título, el documento arranca con el cuerpo bajo el filete del membrete.` |
| Hint de paciente vacío | `Se puede emitir sin paciente` |
| Banner de faltantes | `Falta el cuerpo del escrito. Es el único campo obligatorio.` |
| Pie sin título (propuesto) | `Escrito médico` |

---

## 5 · Campos: obligatorios, opcionales, nuevos

| Campo | Qué pasa | Motivo |
|---|---|---|
| **Cuerpo** | **Único obligatorio** | El editor `isEmpty` es la única condición para imprimir |
| **Paciente** | **Opcional**, prellenado y vaciable | Único junto a Honorarios que puede emitirse sin él, y aquí sí tiene sentido: una carta de recomendación o un resumen para un colega no siempre son de un paciente. Sin `pacienteId`, el modal posterior no ofrece anexar ni la casilla de guardar el correo |
| Título del documento | `asunto` renombrado, sin validar | §2.1 |
| Título del pie | **Campo nuevo**, por defecto = título | §2.2 |
| Fecha | Prellenada con hoy | — |
| Diagnóstico | **No lo recibe y no se añade** | Único de los ocho sin `diagnosticoInicial`; aquí el diagnóstico, si hace falta, se escribe en el cuerpo con sus palabras |
| Cuatro alineaciones | Pasan a un control | §3.2 |
| Cita | **Control nuevo** | El cuerpo la admite y el renderizador la imprime, pero hoy no hay forma de insertarla: solo aparece si se pega de fuera |

---

## 6 · Colisiones que resuelve

| Id | Cómo |
|---|---|
| **E-01** | Barra de una sola fila en los tres niveles (§3.3); cierra además el NO DEFINIDO de qué seis controles son de primer nivel |
| **E-02** | Botones de 44 px con icono de 18 (§3.4) — hoy `p-1.5` + icono 14 = área de 26 px, trece veces |
| **E-03** | `min-height` de 240/320 px en vez de 380 fijo (§3.5) |
| **E-04** | Los estilos del contenido pasan a clases del sistema; se retira el `<style>` global inyectado por montaje. Deuda de implementación, pero mientras siga ahí dos escritos abiertos pueden pisarse |
| **E-05** | El `<select>` de bloque sube a 44 px (§3.3) — hoy es el control más pequeño de los ocho |
| **G-02 · G-03 · G-07 · G-10** | Como en spec 01, con id `escrito-{campo}` |

---

## 7 · Decisiones, una línea cada una

- **La regla de la barra en una línea** — caben las que caben en 44 px; el resto al menú, en el mismo orden y con nombre escrito.
- **Primero juntar, luego repartir** — las cuatro alineaciones eligen un valor de uno: son un botón.
- **Deshacer y rehacer no se añaden** — ya están en el teclado y en el gesto del iPad.
- **El pie no es el título recortado** — el nombre corto lo decide quien escribe; por eso es un campo.
- **El pie copia el título por defecto** — el caso normal (título corto) no cuesta ni un toque.
- **Sin título es un caso, no un error** — el campo no valida, y la ayuda lo dice antes de que pase.
- **`asunto` renombrado y no campo nuevo** — los documentos ya emitidos siguen leyéndose.
- **Dos niveles de encabezado** — un tercero, en un documento de una o dos páginas, no jerarquiza nada.
- **Paciente opcional** — no todo escrito es de un paciente del sistema.

---

## 8 · NO DEFINIDO

- **El sanitizador.** `cuerpo` guarda HTML, no texto. Al aplicar una plantilla hay que pasarlo por
  el mismo sanitizador que el editor usa al pegar. **Falta** el nombre del que está en uso hoy;
  es la única pieza que no se puede cerrar leyendo la pantalla.
- **El pie cuando no hay ningún título.** Propuesta: el genérico `Escrito médico`, para que la
  hoja no salga sin identificar. Alternativa: pie con solo el folio y la paginación. Es una
  palabra, pero sale impresa en cada página.
