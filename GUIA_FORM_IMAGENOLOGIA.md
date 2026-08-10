# GUIA_FORM · Solicitud de imagenología

Spec de implementación por formulario. **Base transversal:** spec 01 §1, §3.1–3.3, §3.7–3.9, §5
y su Anexo de radios. Plantillas: spec 02. Modal posterior: spec 03. Tarjetas: spec 04.

Gemelo de laboratorio, con una diferencia que manda en todo: **un estudio no es un nombre, son
dos datos obligatorios** —tipo y región— más dos opcionales.

---

## 0 · Anchos de contenedor

| Viewport | Contenedor | Datos | Bloque de estudio (interior) | Rejilla del estudio |
|---|---|---|---|---|
| 390 | 358 | 1 col · 316 | 286 | 1 col |
| 820 | 788 | 3 col · 238 | 716 | 4 col · 168 |
| 1180 | 860 | 3 col · 262 | 788 | 4 col · 186 |
| 1440 | 896 | 3 col · 274 | 824 | 4 col · 195 |

Interior del bloque = contenedor − 42 (padding de card y bordes) − 30 (padding del bloque y bordes).
Rejilla del estudio: gap 14. Con 4 columnas, `span 2` = 350 / 386 / 404 y `span 3` = 518 / 586 / 613.

---

## 1 · Estructura

1. Selector de tipo (spec 04) · 2. Card **Plantilla** (spec 02 §1)
3. Card **Datos del paciente** — `data-cols="3"` + fila de urgente con `.sp-doc-span-all`
4. Card **Estudios de imagen** — N bloques con borde propio
5. Barra de acciones sticky

**No lleva card de notas generales** ni **chips de estudios frecuentes** — ver §7.

---

## 2 · Bloque de estudio

Contenedor: borde 1 px `--sp-line-card`, radio 13, fondo `--sp-surface`, padding 14.
Cabecera del bloque: `ESTUDIO {n}` en 11.5 px/800 `--sp-ink-350` + **chip de región** (desde
520 px de bloque, `max-width: 220px`, elipsis) + papelera 44×44 a la derecha.
Con un solo estudio, la papelera queda visible con `opacity:.35` y `disabled`.
Separación entre bloques: `--sp-3` 12 px.

### 2.1 · Rejilla interior — tres trazados por contenedor

| Interior del bloque | Columnas | Tipo | Región | Proyecciones | Indicación |
|---|---|---|---|---|---|
| ≥ 760 | `repeat(4, minmax(0,1fr))` | span 2 | span 2 | span 1 | span 3 |
| 520–759 | `repeat(2, minmax(0,1fr))` | 1 col | 1 col | 1 col | 1 col |
| < 520 | `1fr` | apilado | apilado | apilado | apilado |

Ninguno reparte medias columnas. Cierra **I-02** (tipo y región a 157/143 px en móvil) e
**I-03** (proyecciones e indicación en 1+2 sobre una rejilla de 2).

### 2.2 · Tipo de estudio — desplegable escribible · **patrón de referencia del sistema**

Aquí vive el patrón que Honorarios adopta para el origen del cobro y Laboratorio para el nombre
del estudio.

| Aspecto | Valor |
|---|---|
| Caja | `.sp-input` con `padding-right: 32px` + `ChevronDown` 15 px `--sp-ink-icon`, `pointer-events:none` |
| Escritura | Texto libre siempre; el valor escrito se usa tal cual |
| Menú | Portal a `body`, `position:fixed`, `z-index: 55`, ancho del input con `min-width: 260px`, radio `--sp-r-field+2` 12, sombra `0 12px 28px rgba(16,42,73,.14)` |
| Filas | 44 px, 14 px; la coincidencia con lo escrito va resaltada con fondo `--sp-primary-bg-faint` y texto `--sp-ink-900`/600 |
| **Alto máximo** | **4 filas = 176 px** + `overflow-y: auto`. Ocho filas abiertas tapan el formulario que hay debajo |
| Pie del menú | `Ninguno encaja: escribe el tipo y se usa tal cual.` en 12.5 px `--sp-ink-350` sobre `--sp-surface-sunken` |
| Apertura | Hacia arriba si no caben 200 px debajo; reposición en `scroll` y `resize` |

**Sugerencias (8, orden literal):** `Radiografía` · `Resonancia magnética (RMN)` ·
`Tomografía (TAC)` · `Ultrasonido` · `Densitometría ósea` · `Gammagrafía` ·
`Electromiografía (EMG)` · `Mielograma`.

Cierra **I-04**: el `<datalist>` no filtra igual en Safari iOS y no se ve como campo con
opciones; el gesto pasa a ser el mismo en los ocho.

### 2.3 · Región anatómica

Campo libre, **sin sugerencias**: es lo que más varía —lado, nivel, segmento— y una lista
estorbaría más que ayudaría.

### 2.4 · El par tipo + región

Se exige **el par**, no cada campo por su cuenta. Tres ramas:

| Estado del estudio | Qué pasa |
|---|---|
| Los dos vacíos | Se ignora; no molesta y no bloquea |
| Los dos con valor | Se imprime |
| **Uno de los dos** | **Bloquea la emisión.** El bloque se tiñe (borde `#e8c4c0`, fondo `#fefaf9` — tokens `--sp-danger-border` / `--sp-danger-bg`), el campo que falta pasa a `.sp-input` con borde 1.5 px `--sp-danger` y `aria-invalid`, y bajo él: `Falta la región. Complétala o borra el estudio.` |

Aviso de la barra: **nombra el estudio, no el campo** —
`El estudio 2 tiene tipo sin región: complétalo o bórralo.`
Con dos o tres bloques en pantalla, «falta la región» no localiza nada.

Esto retira el descarte silencioso de `estudios.filter(e => e.tipo && e.region)`: hoy un estudio
a medias no avisa y se cae del PDF.

### 2.5 · Proyecciones e indicación clínica

**Siempre visibles.** La auditoría propone plegarlas por opcionales; no se plegan: son una línea
cada una y son lo que evita la llamada del radiólogo. Plegar cuesta un toque por estudio y ahorra
74 px.

### 2.6 · «Agregar estudio»

`.sp-btn--compact` en la cabecera de la card con `Plus` 17 px + `Agregar estudio`; en XS, 44×44
sin texto con `aria-label="Agregar estudio"`. Cierra **I-05** (hoy es «+ Agregar» en texto plano).

---

## 3 · Urgente

Fila con `.sp-doc-span-all` dentro de la rejilla de datos: `.sp-check` 22×22 en contenedor de
44 px, etiqueta `Marcar como urgente` en `--sp-ink-700` y, al marcarla, badge `URGENTE` en
`--sp-danger` sobre `--sp-danger-bg` (11.5 px/800, radio pill).
Hoy es una casilla de 16 px con la etiqueta entera en rojo, que compite con los errores:
**el rojo se reserva al badge**, que es además el que sale en el PDF.

---

## 4 · Cadenas literales

| Dónde | Texto |
|---|---|
| Primario | `Imprimir solicitud de imagen` — XS: `Imprimir` |
| Toast de éxito | `Solicitud de imagen guardada` |
| `titulo` del modal 03 | `Solicitud de imagen generada` |
| Cabeceras | `DATOS DEL PACIENTE` · `ESTUDIOS DE IMAGEN` |
| Cabecera de bloque | `ESTUDIO 1`, `ESTUDIO 2`… |
| Etiquetas | `Tipo de estudio` * · `Región anatómica` * · `Proyecciones` · `Indicación clínica específica` |
| Placeholders | `Seleccionar o escribir…` · `Ej: Columna lumbar, rodilla der.` · `AP, lateral…` · `Ej: Descartar fractura vertebral` |
| Error de par | `Falta la región. Complétala o borra el estudio.` · `Falta el tipo. Complétalo o borra el estudio.` |
| Aviso de la barra | `El estudio 2 tiene tipo sin región: complétalo o bórralo.` |
| Banner de faltantes | `Faltan 2 campos: Paciente · un estudio con tipo y región` |
| Casilla | `Marcar como urgente` + badge `URGENTE` |

---

## 5 · Campos: obligatorios, prellenados, retirados

| Campo | Qué pasa | Motivo |
|---|---|---|
| Paciente | Prellenado, **obligatorio** | De la ficha, editable, con hint |
| Diagnóstico | Prellenado | Del diagnóstico de la consulta |
| Fecha | Prellenada, **se acota** con `min` 1900-01-01 y `max` +1 año | Hoy sin `min`/`max`, a diferencia de Honorarios |
| **Tipo + región** | **Obligatorios juntos** | §2.4 |
| Proyecciones · Indicación | Opcionales y visibles | §2.5 |
| Urgente | Casilla del sistema | §3 |

**Obligatorios:** paciente · ≥ 1 estudio con tipo **y** región.

---

## 6 · Colisiones que resuelve

| Id | Cómo |
|---|---|
| **I-01** | `removeEstudio` ya existe en el código; lo que cambia es el objetivo: 44×44 con icono de 18 px, gris en reposo, atenuado con un solo estudio |
| **I-02 · I-03** | Tres trazados sin medias columnas (§2.1) |
| **I-04** | `<datalist>` → autocompletado del sistema (§2.2) |
| **I-05** | «+ Agregar» → `.sp-btn--compact` con icono (§2.6) |
| Descarte silencioso | El par se exige en el formulario (§2.4) |
| Casilla de urgente | 22 px, rojo solo en el badge (§3) |
| Fecha sin acotar | `min`/`max` como en Honorarios (§5) |
| **G-02 · G-03 · G-07 · G-10** | Como en spec 01, con id `imagen-{campo}-{i}` |

---

## 7 · Decisiones, una línea cada una

- **O los dos o ninguno** — un estudio a medias no es una petición, y hoy desaparecía del PDF sin decirlo.
- **El aviso nombra el estudio, no el campo** — con dos o tres bloques, el campo no localiza el problema.
- **Aquí vive el desplegable escribible** — es el patrón de referencia del sistema; lo que cambia es la caja, no el gesto.
- **Menú de cuatro filas con desplazamiento** — ocho sugerencias abiertas tapan el formulario.
- **El bloque, no la fila** — cada estudio son cuatro campos: la unidad visual es el bloque, y es lo que permite teñir solo el incompleto.
- **Proyecciones e indicación siempre visibles** — una línea cada una a cambio de no recibir la llamada del radiólogo.
- **Sin chips de frecuentes** — un chip que rellenara «radiografía» dejaría la región vacía: justo el estudio a medias que este formulario prohíbe.
- **Sin notas generales** — la indicación va por estudio, que es donde la lee el radiólogo; no se añade una card para igualar formularios.
- **Región sin sugerencias** — es el dato que más varía.

---

## 8 · NO DEFINIDO

Ninguno propio.
