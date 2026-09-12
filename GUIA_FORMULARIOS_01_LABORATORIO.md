# 01 · Solicitud de laboratorio

Spec de implementación. Aplica `PROPUESTA_DISENO_DOCUMENTOS.md` §3.A, §3.B, §3.C y §1.a.
Tokens: nombres reales de `spinus-tokens.css`. Ningún hex a mano en el componente.

> **Este archivo es también la base transversal de los ocho.** §1 (reglas, `.sp-doc-form`,
> primitivas de rejilla), §3.1–3.3 (card, cabecera, input), §3.7–3.9 (barra, validación, perfil),
> §5 (migración de color) y el Anexo de radios los referencian los ocho specs por formulario:
> `GUIA_FORM_LABORATORIO.md` · `GUIA_FORM_CONSENTIMIENTO.md` · `GUIA_FORM_RECETA.md` ·
> `GUIA_FORM_INTERNAMIENTO.md` · `GUIA_FORM_SUPLEMENTACION.md` · `GUIA_FORM_HONORARIOS.md` ·
> `GUIA_FORM_IMAGENOLOGIA.md` · `GUIA_FORM_ESCRITO_MEDICO.md`.
> Lo específico de laboratorio vive a partir de ahora en `GUIA_FORM_LABORATORIO.md`; lo que este
> archivo dice de laboratorio sigue siendo válido y no se contradice con él.

---

## 0 · Contexto de montaje

**Dos montajes, los dos a anchura completa.** El modal flotante de la pantalla de nota
guardada se eliminó; el formulario se despliega en la propia pantalla.

| Montaje | Dónde | Contenedor |
|---|---|---|
| 1 | Pantalla de nota guardada, debajo de «Concluir consulta» | anchura completa |
| 2 | Ruta standalone de documentos | anchura completa |

**Decae de la auditoría:** el montaje B (panel topado en 768 px, alto útil 605 px) ya no
existe. Con él decaen G-08 (Escape y bloqueo de scroll del overlay), G-09
(`overflow-x-hidden` del scroller) y E-03. Márcalos cerrados por cambio de estructura.

### 0.1 · Anchos de contenedor (los cuatro que se miden)

| Viewport | Contenedor | Tramo | Ancho de campo dentro de `.sp-card` |
|---|---|---|---|
| 390 | 358 | XS | 316 (1 columna) |
| 820 | 788 | MD | 238 (3 columnas) |
| 1180 | 860 | LG | 262 (3 columnas) |
| 1440 | 896 | LG | 274 (3 columnas) |

Tramos: **XS** < 380 · **SM** 380–599 · **MD** 600–839 · **LG** ≥ 840.
SM no lo produce hoy ningún montaje — declarado fuera de alcance.

Ancho de campo = contenedor − 40 (padding lateral de card) − 2 (bordes de card) − gaps, dividido entre columnas.

---

## 1 · Reglas transversales

| Regla | Valor |
|---|---|
| Prefijos responsive de Tailwind en `src/components/documentos/` | **prohibidos**. Puerta de CI: `grep -rnE '\b(sm\|md\|lg\|xl\|2xl):' src/components/documentos/ && exit 1` |
| Rejillas | `@container` sobre `.sp-doc-form`, sin fallback (§3.C.4 cerrado: iPadOS 26, sin tráfico en 15) |
| Pistas de rejilla | `minmax(0, 1fr)` siempre — impide que el ancho intrínseco del `<input>` (≈175 px) infle la pista |
| Altura de control | **44 px** (`--sp-tap`), sin excepciones |
| Hex y clases `slate-*`/`red-*` | 0. `grep -rE '#[0-9a-fA-F]{6}\|slate-\|red-[0-9]' src/components/documentos/*Form.tsx` debe dar 0 |
| Desvío de una `.sp-*` | `style` inline o clase `.sp-doc-*`. Nunca utilidad de Tailwind: `globals.css` importa Tailwind **antes** que `spinus-tokens.css`, así que las utilidades no ganan (§0.2.1) |

### 1.1 · Contenedor

```css
.sp-doc-form {
  container-type: inline-size;
  container-name: docform;
  display: flex;
  flex-direction: column;
  gap: var(--sp-gap-block);      /* 18px */
}
```

### 1.2 · Primitivas de rejilla

```css
.sp-doc-grid { display: grid; gap: var(--sp-4); grid-template-columns: 1fr; }

@container docform (min-width: 380px) {
  .sp-doc-grid[data-cols="2"],
  .sp-doc-grid[data-cols="3"],
  .sp-doc-grid[data-cols="4"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container docform (min-width: 600px) {
  .sp-doc-grid[data-cols="3"],
  .sp-doc-grid[data-cols="4"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@container docform (min-width: 840px) {
  .sp-doc-grid[data-cols="4"] { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

.sp-doc-span-2   { grid-column: span 2; }
.sp-doc-span-all { grid-column: 1 / -1; }
@container docform (max-width: 379px) { .sp-doc-span-2 { grid-column: auto; } }
```

Laboratorio usa una sola rejilla: **Datos del paciente**, `data-cols="3"`.

---

## 2 · Estructura de la pantalla

Orden de bloques, de arriba abajo:

1. Selector de tipo de documento — ver `GUIA_FORMULARIOS_04_TARJETAS_TIPO.md`
2. Card **Plantilla** — ver `GUIA_FORMULARIOS_02_PLANTILLAS.md` §1
3. Card **Datos del paciente**
4. Card **Estudios frecuentes**
5. Card **Estudios solicitados**
6. Card **Indicaciones / Notas**
7. Barra de acciones sticky

Separación entre bloques: `var(--sp-gap-block)` = 18 px (lo da `.sp-doc-form`).

---

## 3 · Elementos

### 3.1 · Card contenedora

`.sp-card`

| Propiedad | Token | px |
|---|---|---|
| Fondo | `--sp-surface` | #ffffff |
| Borde | `--sp-bw-hair` `--sp-line-card` | 1 px |
| Radio | `--sp-r-card` | 16 |
| Sombra | `--sp-shadow-flat` | — |
| Padding del cuerpo | `--sp-pad-card` | 18px 20px |

### 3.2 · Cabecera de card

Un solo patrón (sustituye a los cuatro lenguajes de auditoría §4.3).

| Parte | Valor |
|---|---|
| Contenedor | `display:flex; align-items:center; gap: var(--sp-3)`; `padding: 0 20px`; alto **56 px**; `border-bottom: var(--sp-bw-hair) solid var(--sp-line-divider)`; **sin fondo gris** |
| Icono | `.sp-icobox .sp-icobox--sm` (38×38, radio `--sp-r-icon-md` 11 px, fondo `--sp-primary-bg`, glifo `--sp-primary-text` 19 px). Solo en la primera card y en cards con lista |
| Título | `.sp-label` — `--sp-fs-label` 13 px / `--sp-fw-bold` / `--sp-ink-350` / mayúsculas / `--sp-ls-label` |
| Acción | `.sp-btn--compact` a la derecha con `margin-left:auto` |

**Se elimina:** la franja `bg-slate-50 border-b` de los 5 formularios que la tienen.

### 3.3 · Input, select y autocomplete

`.sp-input` / `.sp-textarea` sin variantes.

| Propiedad | Token | px |
|---|---|---|
| Alto mínimo | `--sp-tap` | 44 |
| Padding | — | 11px 13px |
| Fondo | `--sp-surface-sunken` | #fbfcfe |
| Borde | 1 px `--sp-line-input` | #d5deea |
| Radio | `--sp-r-field` | 10 |
| Tipo | `--sp-fs-body` / `--sp-lh-snug` / `--sp-ink-700` | 14.5 / 1.45 |
| Placeholder | `--sp-ink-200` | #aab6c4 |
| Foco | `outline:none`; fondo `--sp-surface`; borde **`--sp-bw-accent` 1.5 px** `--sp-primary`; `box-shadow: var(--sp-focus-ring)` | anillo 4 px |
| Textarea | + `min-height: 88px`, `resize: vertical`, `line-height: var(--sp-lh-body)` | — |
| Select | `.sp-input` + `appearance:none` + `ChevronDown` 18 px `--sp-ink-icon` a `right: 13px`, `pointer-events:none`, `padding-right: 40px` | — |

**Desplegable del autocomplete (L-03):** portal a `body`, `position: fixed`, posición desde
`getBoundingClientRect()` del input, `z-index: 55`, ancho = el del input con
`min-width: 260px`. Si no caben 200 px por debajo, abre hacia arriba. Se reposiciona en
`scroll` y `resize`.

**Máximo 4 filas visibles (176 px) + `overflow-y: auto`** — añadido el 2026-08-10: ocho
sugerencias abiertas de golpe tapan el formulario que hay debajo.

**El autocomplete es escribible en los ocho.** Sugerencias en el menú, texto libre encima, y el
pie del menú diciéndolo con palabras. El patrón está especificado en
`GUIA_FORM_IMAGENOLOGIA.md` §2.2, que es donde ya existía; Honorarios lo usa para el origen del
cobro y laboratorio para el nombre del estudio.

### 3.4 · Rejilla de datos del paciente

`<div class="sp-doc-grid" data-cols="3">` con tres campos: Fecha (`type="date"`),
Paciente (obligatorio), Diagnóstico.

| Contenedor | Columnas | Ancho de campo |
|---|---|---|
| < 380 | 1 | 316 |
| 380–599 | 2 | — (sin caso real hoy) |
| ≥ 600 | 3 | 238 / 262 / 274 |

Label de campo: `.sp-label-field` — `--sp-fs-label-sm` 12 px / `--sp-fw-bold` /
`--sp-ink-800` / mayúsculas / `--sp-ls-label`. Gap label → control:
`var(--sp-gap-label)` 6 px.

Marca de obligatorio: `*` en `--sp-danger` con `aria-hidden="true"` +
`<span class="sr-only">obligatorio</span>`.

### 3.5 · Chips de estudios frecuentes

`.sp-chip`

| Propiedad | Token | px |
|---|---|---|
| Alto | `--sp-tap` | 44 |
| Padding | — | 0 18px |
| Radio | `--sp-r-pill` | 999 |
| Borde | 1 px `--sp-line-chip` | #d7e0ec |
| Texto | `--sp-fs-chip` / `--sp-fw-semi` / `--sp-primary-ink` | 14 |
| Gap entre chips | `--sp-gap-item` | 10 |
| Hover | borde `--sp-primary-track`, fondo `--sp-primary-bg-faint` | — |
| Activo | `aria-pressed="true"` → fondo y borde `--sp-primary`, texto `#fff` | — |

**L-01 — una sola fuente de verdad:** el estado vive en `estudios[]`. Pulsar un chip
inserta la fila; el encendido es derivado: `estudios.some(e => e === preset)`. Editar o
borrar la fila apaga el chip. **No** hay segundo array.

Consecuencia declarada: `ESTUDIOS_PRESET` son diez cadenas fijas sin identificador ni
versión, y la comparación es de texto exacto. Si una cadena cambia, las plantillas
guardadas dejan de encender ese chip, pero el estudio sigue en la lista. **Ni el panel ni
el formulario pueden asumir que un estudio guardado tiene chip.**

Cadenas (orden literal):
`Biometría Hemática` · `Glucosa` · `Urea` · `Creatinina` · `Examen General de Orina` ·
`TP` · `TPT` · `Perfil Tiroideo Completo` · `Urocultivo` · `Cultivo de Secreción`

### 3.6 · Lista de estudios solicitados

| Aspecto | Valor |
|---|---|
| Añadir | `.sp-btn--compact` en la **cabecera** de la card, `margin-left:auto`, `Plus` 17 px + texto `Agregar` |
| Añadir en XS | Sin texto: 44×44 con `aria-label="Agregar"` |
| Fila | `display:flex; align-items:center; gap: var(--sp-2-5)` (10 px) |
| Numeral | `.sp-label` 13 px `--sp-ink-350`, columna de 20 px, **solo con ≥ 2 filas** |
| Input | `.sp-input`, `flex:1`, `min-width:0` (AutocompleteEstudio) |
| Quitar | 44×44, radio `--sp-r-btn-sm` (8 px), `Trash2` **18 px**, color `--sp-ink-icon` |
| Quitar · hover | color `--sp-danger`, fondo `--sp-danger-bg` |
| Quitar · con 1 ítem | **visible y `disabled`**, `opacity:.4`, nunca oculto |
| `aria-label` de quitar | `Eliminar {nombre del estudio}` o `Eliminar estudio {n}` si está vacío |
| Separación entre filas | `var(--sp-3)` 12 px, sin divisor. Con ≥ 4 filas: `border-top: 1px solid var(--sp-line-divider)` + `padding-top: 12px` |
| Lista vacía | Bloque de 96 px: `.sp-icobox--sm` sobre `--sp-surface-empty` + `.sp-hint` centrado `Sin estudios. Usa «Agregar».` |

Ancho de input resultante a 358 de contenedor: 316 − 20 (numeral) − 20 (gaps) − 44
(papelera) = **232 px**.

### 3.7 · Barra de acciones

```css
.sp-doc-actions {
  position: sticky; bottom: 0; z-index: 1;
  margin: var(--sp-gap-block) -20px -18px;
  padding: 14px 20px calc(14px + env(safe-area-inset-bottom));
  background: var(--sp-surface);
  border-top: 1px solid var(--sp-line-divider);
  box-shadow: 0 -8px 20px rgba(16, 42, 73, .05);
  display: flex; gap: var(--sp-gap-item); align-items: center;
}
@container docform (max-width: 379px) {
  .sp-doc-actions { flex-direction: column-reverse; }
  .sp-doc-actions > * { width: 100%; }
}
```

- Alto: **76 px** (14 + 48 + 14).
- Primario: `.sp-btn--primary`, `flex:1`, 48 px (`--sp-ctrl-h-desktop`),
  `--sp-fs-btn-md` 15.5 px / `--sp-fw-bold`, radio `--sp-r-btn` 10, `--sp-shadow-btn`.
- Secundario «Guardar como plantilla»: `.sp-btn--secondary`, `flex: 0 0 auto`,
  `white-space: nowrap`.
- **Se elimina** el scoping `.doc-modal-scroll .doc-print-btn` de `globals.css:747` (G-06):
  una sola regla sirve a los dos montajes.
- La sombra `0 -8px 20px rgba(16,42,73,.05)` no tiene token — **valor literal aceptado**,
  es el único de la hoja.

### 3.8 · Validación

**Un solo paradigma.** El primario **siempre está habilitado** salvo mientras imprime y
mientras carga el perfil.

| Parte | Valor |
|---|---|
| Banner | `.sp-banner--warn`, radio `--sp-r-field` 10, `padding: 10px 14px`, `--sp-fs-body-sm` 14 px / `--sp-fw-semi`, icono `AlertTriangle` 17 px, `margin-bottom: var(--sp-2-5)` |
| Nombres | Cada campo faltante es un `<button>` inline con `.sp-link-alt`, color `--sp-warn-strong` |
| Máximo listado | **3**. A partir de ahí: `Faltan 5 campos: Lugar · Edad · Procedimiento y 2 más` |
| Aparición | **No existe hasta el primer intento de imprimir**. Después permanece y se actualiza en vivo |
| Al pulsar con faltantes | No emite; enfoca el primer faltante; ese campo pasa a `border-color: var(--sp-warn)` y `aria-invalid="true"`, y se limpia al escribir |
| Navegación al campo | `container.scrollTop = el.offsetTop - 24`. **Nunca `scrollIntoView`** |
| `aria-live` | `polite` en el banner |

**Obligatorios de laboratorio:** paciente · ≥ 1 estudio con texto.
Literal del banner con los dos faltantes: `Faltan 2 campos: Paciente · Estudios`.

### 3.9 · Perfil del médico

`const perfilPendiente = cargandoPerfil && !medicoInfo` — ya existe en `SolicitudLabForm`.
Va en el `disabled` del primario.

| Estado | Qué se ve |
|---|---|
| Cargando | Primario `disabled`, fondo `#b6c6da` (literal de `.sp-btn--primary:disabled`), sin sombra, `.sp-spinner` 17 px + `Cargando tu perfil…` |
| Resuelve sin `medicoInfo` | El botón **se habilita igual** (asimetría deliberada) + `.sp-banner--warn` sobre la barra: `Completa tu perfil para que el documento salga con tu encabezado.` + link `Ir a mi perfil`. **No bloquea la emisión** |

---

## 4 · Cadenas literales

| Dónde | Texto |
|---|---|
| Botón primario | `Imprimir solicitud de laboratorio` — en XS, `Imprimir` |
| Botón secundario | `Guardar como plantilla` |
| Botón primario, imprimiendo | `Generando PDF…` |
| Botón primario, perfil cargando | `Cargando tu perfil…` |
| Toast de éxito | `Solicitud de laboratorio guardada` |
| Prop `titulo` del modal posterior | `Solicitud de laboratorio generada` (frase completa, ver spec 03) |
| Cabecera 1 | `DATOS DEL PACIENTE` |
| Cabecera 2 | `ESTUDIOS FRECUENTES` |
| Cabecera 3 | `ESTUDIOS SOLICITADOS` |
| Cabecera 4 | `INDICACIONES / NOTAS` |
| Placeholder de estudio | `Nombre del estudio` |
| Placeholder de paciente | `Nombre completo` |
| Placeholder de diagnóstico | `Dx de envío` |
| Placeholder de notas | `Indicaciones especiales, ayuno requerido…` |
| Lista vacía | `Sin estudios. Usa «Agregar».` |
| Perfil incompleto | `Completa tu perfil para que el documento salga con tu encabezado.` |

Capitalización de frase, no de título. `Imprimir receta`, no `Imprimir Receta`.

---

## 5 · Migración de color (§3.B)

| Hoy | Token | Nota |
|---|---|---|
| `#1e5fa8` | `var(--sp-primary)` | exacta |
| `#1a3a5c` | `var(--sp-primary-hover)` | exacta |
| `#0f2540` | `var(--sp-ink-900)` | no exacta; el rol es el correcto |
| `text-slate-700` | `var(--sp-ink-700)` | — |
| `text-slate-500` | `var(--sp-ink-500)` | AA 5.4:1 |
| `text-slate-400` | `var(--sp-ink-350)` | sube 2.8:1 → 3.0:1; solo en etiquetas ≥13 px en negrita |
| `text-slate-300` | `var(--sp-ink-500)` | sube dos escalones: 1.9:1 es ilegible |
| `bg-slate-50` | `var(--sp-surface-sunken)` | — |
| `border-slate-200` | `var(--sp-line-soft)` | — |
| `border-slate-300` | `var(--sp-line-input)` | — |
| `border-slate-100` | `var(--sp-line-divider)` | — |
| `text-red-400` (asterisco, papelera) | `var(--sp-danger)` / `var(--sp-ink-icon)` | el asterisco sube de 3.5:1 a 5.5:1 |
| `bg-red-50` / `border-red-200` | `var(--sp-danger-bg)` / `var(--sp-danger-border)` | — |

---

## 6 · Decisiones, una línea cada una

- **44 px único** — dos alturas en la misma pantalla era S-03; el piso táctil no admite excepciones.
- **Etiqueta de sección en mayúsculas y no `.sp-title-card`** — con 5–8 cards, ocho títulos de 20 px compiten con los campos.
- **Papelera visible y deshabilitada con un ítem** — ocultarla mueve la interfaz al añadir el segundo.
- **Chips derivados de `estudios[]`** — dos arrays divergen siempre.
- **Primario habilitado con faltantes** — un botón gris no enseña qué falta; el banner sí.
- **Banner solo tras el primer intento** — el formulario recién abierto no acusa de nada.
- **Perfil sin datos no bloquea** — el PDF sale sin encabezado, pero sale.
- **Selector de plantilla arriba, «Guardar como plantilla» abajo** — fijado el 2026-08-10 al cerrar Honorarios; se elige plantilla antes de llenar y se guarda cuando ya está llena (spec 02 §1–§2).
- **`@container` sin fallback** — iPadOS 26 en el parque real; el `ResizeObserver` no se implementa.

---

## 7 · NO DEFINIDO

Ninguno propio de esta pantalla.

Heredado de la propuesta y aún abierto: **H-05** (colisión de folio) no aplica a
laboratorio, que usa `crypto.randomUUID()` como `client_id` y no tiene folio público.


---

## Anexo · Radio de control (cambio de sistema, 2026-08-09)

Aplica a los nueve formularios y a toda la app. **Los contenedores no bajan.**

| Token | Antes | Ahora | Rol |
|---|---|---|---|
| `--sp-r-input` | 14 | **12** | textarea grande |
| `--sp-r-cta` | 14 | **12** | primario a ancho completo |
| `--sp-r-btn` | 12 | **10** | botón |
| `--sp-r-field` | 12 | **10** | input, select, textarea, banner |
| `--sp-r-field-sm` | 11 | **9** | fila e input compactos |
| `--sp-r-btn-sm` | 10 | **8** | botón compacto e icono-botón |
| `--sp-r-card` | 16 | 16 | sin cambio |
| `--sp-r-modal` | 20 | 20 | sin cambio |
| `--sp-r-pill` | 999 | 999 | es una forma, no un radio |

- Un escalón por token: la jerarquía de la escala no se altera.
- La diferencia entre la curva del contenedor y la del control pasa de 4 px a 6 px; es lo que se lee como más limpio.
- Por debajo de 10 px el control entra en el terreno de `--sp-r-note` (8 px), que es para texto embebido.
- **Revisar tras el cambio** los tres sitios donde el radio convive con un borde de 1,5 px: input en foco, tarjeta de tipo seleccionada y card protagonista.
