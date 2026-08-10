# GUIA_FORM · Solicitud de laboratorio

Spec de implementación por formulario. **Base transversal:** `GUIA_FORMULARIOS_01_LABORATORIO.md`
§1 (reglas, `.sp-doc-form`, primitivas de rejilla), §3.1–3.3 (card, cabecera, input),
§3.7–3.9 (barra, validación, perfil), §5 (migración de color) y su Anexo de radios.
Plantillas: spec 02. Modal posterior: spec 03. Tarjetas de tipo: spec 04.
Tokens: nombres reales de `spinus-tokens.css`. Ningún hex a mano.

---

## 0 · Anchos de contenedor

| Viewport | Contenedor | Tramo | 1 col | 3 col |
|---|---|---|---|---|
| 390 | 358 | XS | 316 | — |
| 820 | 788 | MD | — | 238 |
| 1180 | 860 | LG | — | 262 |
| 1440 | 896 | LG | — | 274 |

Tramos por **contenedor**: XS < 380 · SM 380–599 · MD 600–839 · LG ≥ 840.
Ancho de campo = contenedor − 40 (padding de card) − 2 (bordes) − gaps, entre columnas.

---

## 1 · Estructura

1. Selector de tipo de documento (spec 04)
2. Card **Plantilla** (spec 02 §1) — **primer bloque del formulario**
3. Card **Datos del paciente** — `.sp-doc-grid[data-cols="3"]`
4. Card **Estudios frecuentes** — chips
5. Card **Estudios solicitados** — lista
6. Card **Indicaciones / Notas** — un `.sp-textarea`
7. Barra de acciones sticky, con «Guardar como plantilla» a la izquierda del primario

Separación entre bloques: `--sp-gap-block` 18 px.

---

## 2 · Elementos propios

### 2.1 · Chips de estudios frecuentes

`.sp-chip` — 44 px de alto, padding `0 18px`, radio `--sp-r-pill`, borde 1 px
`--sp-line-chip`, texto `--sp-fs-chip` 14 / `--sp-fw-semi` / `--sp-primary-ink`,
gap entre chips `--sp-gap-item` 10 px. Hover: borde `--sp-primary-track`, fondo
`--sp-primary-bg-faint`. Activo (`aria-pressed="true"`): fondo y borde `--sp-primary`,
texto `#fff`.

**L-01 · una sola fuente de verdad.** El estado vive en `estudios[]`. Pulsar el chip
inserta la fila; el encendido es derivado (`estudios.some(e => e === preset)`). Editar o
borrar la fila apaga el chip. No hay segundo array.

Consecuencia declarada: los diez presets son cadenas fijas sin id ni versión y la
comparación es de texto exacto. Un estudio guardado puede no tener chip.

Cadenas, en orden literal:
`Biometría Hemática` · `Glucosa` · `Urea` · `Creatinina` · `Examen General de Orina` ·
`TP` · `TPT` · `Perfil Tiroideo Completo` · `Urocultivo` · `Cultivo de Secreción`

### 2.2 · Lista de estudios solicitados

| Aspecto | Valor |
|---|---|
| Añadir | `.sp-btn--compact` en la cabecera, `margin-left:auto`, `Plus` 17 px + `Agregar` |
| Añadir en XS | 44×44 sin texto, `aria-label="Agregar"` |
| Fila | `display:flex; align-items:center; gap: var(--sp-2-5)` (10) |
| Numeral | `.sp-label` 13 px `--sp-ink-350`, columna de 20 px, **solo con ≥ 2 filas** |
| Input | `.sp-input` (AutocompleteEstudio), `flex:1`, `min-width:0` |
| Quitar | 44×44, radio `--sp-r-btn-sm` 8, `Trash2` 18 px, `--sp-ink-icon`; hover `--sp-danger` sobre `--sp-danger-bg` |
| Quitar con 1 fila | visible y `disabled`, `opacity:.4` — nunca oculto |
| `aria-label` | `Eliminar {estudio}` · vacío: `Eliminar estudio {n}` |
| Entre filas | `--sp-3` 12 px sin divisor; con ≥ 4 filas, `border-top` `--sp-line-divider` + 12 px |
| Lista vacía | Bloque de 96 px: `.sp-icobox--sm` sobre `--sp-surface-empty` + `.sp-hint` `Sin estudios. Usa «Agregar».` |

Ancho de input a 358 de contenedor: 316 − 20 (numeral) − 20 (gaps) − 44 (papelera) = **232**.

### 2.3 · Autocomplete escribible

Patrón de sistema, definido en `GUIA_FORM_IMAGENOLOGIA.md` §2.2 y aplicado aquí:
sugerencias en menú, texto libre encima. Desplegable en portal a `body`,
`position:fixed` desde `getBoundingClientRect()`, `z-index: 55`, ancho del input con
`min-width: 260px`, apertura hacia arriba si no caben 200 px debajo, reposición en
`scroll` y `resize`. **Máximo 4 filas visibles** (176 px) + `overflow-y:auto`. Cierra L-03.

---

## 3 · Cadenas literales

| Dónde | Texto |
|---|---|
| Primario | `Imprimir solicitud de laboratorio` — XS: `Imprimir` |
| Primario imprimiendo | `Generando PDF…` |
| Primario, perfil cargando | `Cargando tu perfil…` |
| Secundario | `Guardar como plantilla` |
| Toast de éxito | `Solicitud de laboratorio guardada` |
| `titulo` del modal 03 | `Solicitud de laboratorio generada` |
| Cabeceras | `DATOS DEL PACIENTE` · `ESTUDIOS FRECUENTES` · `ESTUDIOS SOLICITADOS` · `INDICACIONES / NOTAS` |
| Placeholders | `Nombre completo` · `Dx de envío` · `Nombre del estudio` · `Indicaciones especiales, ayuno requerido…` |
| Banner de faltantes | `Faltan 2 campos: Paciente · Estudios` |
| Perfil incompleto | `Completa tu perfil para que el documento salga con tu encabezado.` |

Capitalización de frase, no de título.

---

## 4 · Campos: obligatorios, prellenados, retirados

| Campo | Estado | Motivo |
|---|---|---|
| Paciente | **Obligatorio**, prellenado de la ficha | Sin nombre no hay documento; el prellenado no cuenta como dato tecleado en `isFormEmpty` |
| Fecha | Prellenada con `hoyEnTZ()`, `min` 1900-01-01, `max` +1 año | Corrige la falta de acotación |
| Diagnóstico | Prellenado del diagnóstico de la consulta, editable | Se escribe solo en el 90 % de los casos |
| ≥ 1 estudio con texto | **Obligatorio** | Es el contenido del documento |
| Notas | Opcional | — |
| Franja `bg-slate-50` de cabecera | **Retirada** | Un solo lenguaje de cabecera en los ocho (auditoría §4.3) |

---

## 5 · Colisiones que resuelve

| Id | Cómo |
|---|---|
| **L-01** | Chips derivados de `estudios[]` (§2.1) |
| **L-02** | Papelera 44×44 con icono de 18 px (§2.2) |
| **L-03** | Desplegable en portal `fixed` con reposición y 4 filas visibles (§2.3) |
| **G-02** | `<label htmlFor>` + `id` derivado `laboratorio-{campo}-{i}` |
| **G-03** | `aria-label` en los botones de icono |
| **G-06** | Se elimina el scoping `.doc-modal-scroll .doc-print-btn` |
| **G-07** | `perfilPendiente` en el `disabled` del primario |
| **G-10** | Foco al primer campo editable vacío al montar |
| **G-08 · G-09 · E-03** | Cerrados por cambio de estructura: el montaje en overlay ya no existe |

---

## 6 · Decisiones, una línea cada una

- **44 px único** — dos alturas en la misma pantalla era S-03; el piso táctil no admite excepciones.
- **Etiqueta de sección en mayúsculas y no título de 20 px** — con seis cards, seis títulos compiten con los campos.
- **Papelera visible y deshabilitada con un ítem** — ocultarla mueve la interfaz al añadir el segundo.
- **Chips derivados** — dos arrays divergen siempre.
- **Primario habilitado con faltantes** — un botón gris no enseña qué falta; el banner sí.
- **Banner solo tras el primer intento** — el formulario recién abierto no acusa de nada.
- **Perfil sin datos no bloquea** — el PDF sale sin encabezado, pero sale.
- **Selector de plantilla arriba, guardar abajo** — se elige plantilla antes de llenar y se guarda cuando ya está llena (spec 02 §1–§2, fijado con Honorarios).
- **`@container` sin fallback** — iPadOS 26 en el parque real.

---

## 7 · NO DEFINIDO

Ninguno propio. **H-05** (colisión de folio) no aplica: laboratorio no tiene folio público.
