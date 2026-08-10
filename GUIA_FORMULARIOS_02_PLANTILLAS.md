# 02 · Sistema de plantillas

Spec de implementación. Aplica `PROPUESTA_DISENO_DOCUMENTOS.md` §1 completo.
Común a los 8 formatos. Tokens reales de `spinus-tokens.css`.

---

## 0 · Modelo

- Alcance: **por médico** (`user_id`), no por clínica. RLS `user_id = auth.uid()` en las
  cuatro operaciones. Elimina H-01 por construcción.
- Tope: **10 por `tipo_documento`**. Validado en cliente **y** en trigger `before insert`.
- Contenido: todo el estado del formulario **menos** los campos de paciente (§1.0.2 de la
  propuesta), con `_v: 1` en la raíz.
- Tabla única `plantillas_documento` (§1.0.1). **`plantillas_honorarios` no se migra**: son
  2 filas de abril de 2026, consultadas en producción. Se retira la tabla.
- `nombre`: 1–40 caracteres tras `trim()`. Único por `(user_id, tipo_documento, nombre)`.

### 0.1 · Predicado único de «formulario vacío»

`esFormularioVacio()` — **cuatro consumidores, una definición**: botón «Guardar como
plantilla», acción «Sobrescribir», aviso al cambiar de tipo de documento, y aviso al
concluir la consulta. Un segundo criterio haría que dos partes del sistema discrepen sobre
si hay algo escrito.

Regla: tras retirar las claves excluidas, todo lo que queda es igual a la constante de
estado inicial del formulario. Comparación profunda contra esa constante, no contra `{}`.
Los textos precargados de Internamiento y Consentimiento **cuentan como vacío** hasta que
se editan: llegaron solos.

Excepciones por formulario: §1.d de la propuesta, tabla íntegra. Laboratorio:
`estudios[]` sin ninguna entrada con texto.

---

## 1 · Selector de plantilla

Card propia, **primer bloque del formulario**, encima de «Datos del paciente», en los 8.

> **Confirmado el 2026-08-10, al cerrar Honorarios.** Las dos ubicaciones quedan fijas para los
> ocho: **el selector arriba** (se elige plantilla y después se llena lo que falte; ver los campos
> vacíos y encontrar el selector al final no sirve de nada) y **«Guardar como plantilla» al final**,
> con las acciones (§2). Honorarios es la implementación de referencia: es el único formulario que
> ya tenía las dos piezas en su sitio. Única excepción, la de §6.
>
> Nota de estructura, también de ese cierre: `plantillas_honorarios` se retira sin migrar
> —dos filas en producción, de dos médicos, ambas de abril de 2026— y `plantillas_documento` nace
> limpia. Con la tabla muere **H-01** (`resolvedClinicaId` siempre `null`): no se parchea.
> Ver `GUIA_FORM_HONORARIOS.md` §9.

| Propiedad | Token | px |
|---|---|---|
| Contenedor | `.sp-card` | padding 18/20, radio 16, borde 1 `--sp-line-card`, `--sp-shadow-flat` |
| Alto total | — | **76** en MD/LG (18+40+18) · **118** en XS |
| Separación con la card siguiente | `--sp-gap-block` | 18 |
| Label | `.sp-label`, texto `PLANTILLA` | 13 / 700 / `--sp-ink-350` |
| Gap label → control | `--sp-gap-label` | 6 |

### 1.1 · Fila de control

- MD/LG: `display:grid; grid-template-columns: 1fr auto; gap: var(--sp-gap-item)` (10 px).
- XS: `grid-template-columns: 1fr; gap: var(--sp-2)` (8 px); el botón pasa debajo a ancho
  completo. Corrige H-03.
- **Consentimiento**: `1fr auto auto` — lleva además «Guardar como plantilla» (ver §6).

**Select** (`<select class="sp-input">`) — **se queda nativo**: en iPad abre la rueda del
sistema. La lista desplegada la dibuja el SO y no se estiliza.

| Aspecto | Valor |
|---|---|
| Alto | 44 (`--sp-tap`) · padding `11px 40px 11px 13px` · `--sp-fs-body` 14.5 |
| Opción 0 | `— Sin plantilla —`, `value=""` |
| Opciones 1..N | `nombre`, orden `updated_at desc`. Sin fecha (no cabe en XS) |
| Contador | **no** va en la lista; va en el hint |

**Botón «Gestionar»**: `.sp-btn--compact` elevado a `min-height: 44px`, radio
`--sp-r-btn-xs` 9, icono `Settings2` 17 px, `--sp-fs-meta` 13.5 / `--sp-fw-semi` /
`--sp-primary`. Hover: fondo `--sp-primary-bg`, borde `--sp-primary-track`.
En XS: `width:100%`, texto `Gestionar plantillas`.

### 1.2 · Hint

`.sp-hint` — `--sp-fs-hint` 12.5 / `--sp-ink-300`, `margin-top: var(--sp-1)`.

| n | Texto | Color |
|---|---|---|
| 0 | — (lo ocupa el estado vacío) | — |
| 1–9 | `{n} de 10 guardadas` | `--sp-ink-300` |
| 10 | `10 de 10 · el máximo` | `--sp-warn` |

Con 10 **no se bloquea nada por adelantado**: el tope se explica al intentar guardar la
undécima.

### 1.3 · Aplicar

`onChange` del select aplica **inmediatamente**. Sin botón «Aplicar» y sin confirmación
previa.

Tras aplicar, dentro de la misma card, debajo de la fila:
`.sp-banner--info` — fondo `--sp-primary-bg-faint`, sin borde, `--sp-fs-label` 13 px
`--sp-ink-500`, `padding: 14px 16px`, radio `--sp-r-field` 10, `margin-top: 10px`,
`aria-live="polite"`.

Literal:
`Se aplicó «{nombre}». Se reemplazaron los campos del formulario; los datos del paciente no cambiaron.` + `Deshacer`

| Regla | Valor |
|---|---|
| Deshacer | `.sp-btn--ghost` inline, `--sp-fs-meta` 13.5, `--sp-primary`. Restaura el snapshot previo en **un solo paso**; no es pila |
| Duración | **No se autodescarta.** Sin temporizador |
| Se retira | Al primer cambio manual en cualquier campo, o al aplicar otra plantilla |

**Se retiran de Honorarios:** el modal de confirmación previa (`:196-205`) y la papelera
junto al select (`:481-490`).

### 1.4 · Estado vacío (0 plantillas)

La card **no se oculta**: cambia de contenido.

| Parte | Valor |
|---|---|
| Alto | 84 MD/LG · 104 XS |
| Layout | `display:flex; align-items:flex-start; gap: var(--sp-3)` |
| Icono | `.sp-icobox .sp-icobox--sm` (38, radio 11, fondo `--sp-primary-bg`, `FileText` 19 px `--sp-primary-text`) |
| Título | `.sp-title-sec` 14.5 / 700 / `--sp-ink-800` — `Sin plantillas de {tipo}` |
| Cuerpo | `.sp-hint`, `margin-top: 2px`, máx. 2 líneas |
| Fondo | `--sp-surface`. **No** `--sp-surface-muted` |
| Botón | **ninguno** — el único camino de creación es §2 |

Literal del cuerpo:
`Guarda este formulario como plantilla y la próxima vez lo llenas de un toque.`

`{tipo}` en minúscula: `receta` · `laboratorio` · `imagen` · `suplementación` ·
`internamiento` · `escrito médico` · `consentimiento` · `honorarios`.

### 1.5 · Estados de carga y error

| Estado | Qué se ve |
|---|---|
| Cargando | Label + bloque de 44 px con `background: var(--sp-surface-muted)`, radio `--sp-r-field`, **sin shimmer** (< 200 ms; un skeleton parpadea más de lo que informa). «Gestionar» `disabled`. **El formulario no se bloquea** |
| Error de carga | El select se sustituye por `.sp-banner--warn` de una línea: `No se pudieron cargar tus plantillas.` + `.sp-btn--ghost` **Reintentar**. «Guardar como plantilla» se **deshabilita**: sin la consulta no se sabe si ya hay 10 |

---

## 2 · Guardar como plantilla

**Ubicación:** barra de acciones sticky, a la izquierda del primario (§3.A.7 del spec 01).
Excepción: consentimiento, ver §6.

Argumento, para que no se mueva: se guarda cuando el formulario **ya está lleno**, así que su
sitio es junto al botón de imprimir. En XS cae debajo del primario, a ancho completo
(`flex-direction: column-reverse` de la barra).

| Estado | Regla |
|---|---|
| Deshabilitado | Si `esFormularioVacio()`. `title` / `aria-describedby`: `Llena el formulario para poder guardarlo como plantilla.` |
| Habilitado | En cualquier otro caso, **incluso con 10 plantillas** |

### 2.1 · Diálogo de nombre

`ModalShell` **no** `elevated` → `z-50`. Nunca `z-[10000]` (corrige H-04).

| Parte | Valor |
|---|---|
| Ancho | `--sp-modal-w-wait` 560 px · XS `calc(100vw - 32px)` |
| Header | `--sp-pad-modal-head` (20px 24px), título `.sp-title-modal` 19/800: `Guardar como plantilla` |
| Subtítulo | `.sp-sub-modal` 13.5 `--sp-ink-350`: `Se guarda todo menos los datos del paciente.` |
| Cuerpo | `--sp-pad-modal-body` (22px 24px 8px) |
| Label | `.sp-label-field` 12/700/`--sp-ink-800`: `NOMBRE` |
| Campo | `.sp-input` 44 px, `maxlength=40`, autofocus, placeholder `Prequirúrgico` |
| Contador | `.sp-hint` a la derecha del label: `{n}/40`, **a partir de 30 caracteres** |
| Footer | `--sp-pad-modal-foot` (16px 24px), `border-top: 1px solid var(--sp-line-divider)`, botones a la derecha |
| Botones | `.sp-btn--ghost` `Cancelar` · `.sp-btn--primary` `Guardar` |

| Estado | Qué se ve |
|---|---|
| Vacío tras `trim()` | `Guardar` deshabilitado |
| **Duplicado** | Se comprueba **en cliente mientras se escribe** —las plantillas ya están cargadas para pintar el select—, no al pulsar. Borde `--sp-warn` + `.sp-banner--warn` bajo el campo: `Ya tienes una plantilla con ese nombre. Usa otro, o sobrescríbela desde Gestionar.` El 23505 del servidor queda como red de la carrera entre pestañas |
| Guardando | `Guardando…` + `.sp-spinner` 17 px; ambos botones deshabilitados; sin timeout de UI |
| Error de red | `.sp-banner--danger` en el cuerpo: `No se pudo guardar la plantilla. Revisa tu conexión e inténtalo de nuevo.` El diálogo **no se cierra** y conserva el nombre |
| Éxito | Cierra · toast `Plantilla «{nombre}» guardada` · el select queda con esa plantilla · el hint pasa a `{n+1} de 10 guardadas` |

### 2.2 · Diálogo de tope

`ModalShell`, `--sp-modal-w-decide` 620 px.

| Parte | Contenido |
|---|---|
| Título | `Ya tienes 10 plantillas de {tipo}` |
| Cuerpo | `.sp-body` 14.5 `--sp-ink-700`: `Es el máximo. Para guardar esta, borra o sobrescribe una de las que ya tienes.` |
| Botones | `.sp-btn--ghost` `Cancelar` · `.sp-btn--primary` `Gestionar plantillas` |

`Gestionar plantillas` cierra el diálogo y abre el panel. **El formulario se conserva
íntegro.**

---

## 3 · Panel de gestión

**No es un modal.** Sustituye el contenido del formulario en su mismo espacio.

**Razón (revisada tras eliminarse el overlay):** el panel existe para operar sobre el
formulario que sigue vivo debajo — «Sobrescribir con el formulario actual» solo significa
algo si ese formulario sigue ahí, y un modal comunica lo contrario. *(La razón original
—«no apilar tres capas dentro del overlay»— caducó con el montaje que desapareció.)*

### 3.1 · Mecánica

- El árbol del formulario **no se desmonta**: `display:none` en su envoltorio.
- El panel se monta como hermano, en el mismo contenedor de scroll.
- Entrada `.sp-push-forward` (320 ms, `--sp-dur-slide`, `--sp-ease-inout`), vuelta
  `.sp-push-backward`.
- Scroll a 0 al entrar; **se restaura** la posición previa al volver.
- El selector de tipo de documento se **oculta** mientras el panel está abierto.
- `Escape` vuelve al formulario.

### 3.2 · Cabecera

| Parte | Valor |
|---|---|
| Alto | 56 px, `border-bottom: 1px solid var(--sp-line-divider)`, `margin-bottom: var(--sp-gap-section)` 20 |
| Volver | 44×44, radio `--sp-r-btn-sm` 8, `ArrowLeft` 20 px `--sp-ink-500`, hover fondo `--sp-surface-muted`, `aria-label="Volver al formulario"` |
| Título | `.sp-title-card` 20/800/`--sp-ink-800` — `Plantillas de {tipo}`. XS: `--sp-fs-vitals` 18 px |
| Contador | `.sp-badge` a la derecha: `{n} / 10`. Con 10: `.sp-badge--warn` |

**`position: sticky` retirado**: existía porque 10 filas no cabían en los 605 px de scroll
interno del overlay. Con scroll de página, la cabecera sube con el contenido.

### 3.3 · Lista

Base `.sp-row`: `border: 1px solid var(--sp-line-soft)`, radio `--sp-r-field-sm` 9,
`padding: 12px 14px`, fondo `--sp-surface`. Separación `var(--sp-2-5)` 10 px.
Orden `updated_at desc`.

| Tramo | Alto | Layout |
|---|---|---|
| ≥ 380 | 68 px | Una fila: nombre + fecha a la izquierda, 3 acciones a la derecha |
| < 380 | 104 px | Dos plantas: nombre + fecha arriba; acciones abajo en `repeat(3,1fr)` gap `var(--sp-2)`, 44 px de alto, icono + etiqueta 12 px `--sp-ink-500`. A 318 px de contenido → ≈98 px por celda |

| Parte | Valor |
|---|---|
| Nombre | `.sp-title-sec` 14.5/700/`--sp-ink-800`, `text-overflow: ellipsis`, 1 línea |
| Fecha | `.sp-hint` 12.5 `--sp-ink-300`, `margin-top: 2px`. `Actualizada el {d} de {mes}`; con año si no es de este año. Sin hora. Locale `es-MX` |
| Acciones | 3 botones 44×44, radio `--sp-r-btn-sm` 8, `gap: var(--sp-1)` 4, iconos 18 px |

| Acción | Icono | Reposo | Hover | `aria-label` |
|---|---|---|---|---|
| Renombrar | `Pencil` | `--sp-ink-icon` | `--sp-primary` + fondo `--sp-primary-bg` | `Renombrar {nombre}` |
| Sobrescribir | `RefreshCw` | `--sp-ink-icon` | `--sp-primary` + fondo `--sp-primary-bg` | `Sobrescribir {nombre} con el formulario actual` |
| Eliminar | `Trash2` | `--sp-ink-icon` | `--sp-danger` + fondo `--sp-danger-bg` | `Eliminar {nombre}` |

**Los tres grises en reposo** — zanja la incoherencia 4.4 de la auditoría.

### 3.4 · Sobrescribir apagado

Condición: `esFormularioVacio()`. `opacity:.4`, `cursor:not-allowed`, `disabled`, sin hover.

Encima de la lista, **una sola vez**, `.sp-banner--info`:
`El formulario está vacío: no hay nada con lo que sobrescribir.`
Global y no por fila: con 10 filas apagadas, 10 tooltips dicen lo mismo 10 veces.

### 3.5 · Confirmaciones

`ModalShell`, `--sp-modal-w-decide` 620 px. **Las dos nombran la plantilla.**

**Sobrescribir**
- Título: `¿Sobrescribir «{nombre}»?` — `.sp-title-modal`, comillas latinas, `--sp-ink-800`. Nombre > 40 caracteres: truncar con `…`
- Cuerpo: `.sp-banner--danger` (fondo `--sp-danger-bg`, borde `--sp-danger-border`, texto `--sp-danger-ink` 14.5/1.45, radio `--sp-r-card-inner` 13, `padding: 14px 16px`):
  `Se reemplaza el contenido guardado de «{nombre}» por lo que hay ahora en el formulario. El nombre y la fecha de creación no cambian. No se puede deshacer.`
- Botones: `.sp-btn--ghost` `Cancelar` · `.sp-btn--primary` `Sobrescribir`
- El primario **no se pinta de rojo**: el sistema no define variante danger de `.sp-btn` y crearla para un caso es fabricar componente nuevo.

**Eliminar**
- Título: `¿Eliminar «{nombre}»?`
- Cuerpo: `.sp-body` — `Se borra esta plantilla. Los documentos ya emitidos con ella no cambian.`
- Botones: `Cancelar` · `Eliminar`

### 3.6 · Renombrar

**En sitio, no en modal.** La fila se convierte en:
`.sp-input` 44 px con el nombre seleccionado + `✕` 44×44 + `Guardar` (`.sp-btn--compact`,
44 px). `Enter` guarda, `Escape` cancela. Duplicado → borde `--sp-warn` + `.sp-hint` en
`--sp-warn`: `Ya tienes una con ese nombre.`

### 3.7 · Estados del panel

| Estado | Qué se ve |
|---|---|
| Cargando | Cabecera con el contador oculto + 3 filas fantasma de 68 px: `background: var(--sp-surface-muted)`, radio `--sp-r-field-sm`, sin animación |
| Vacío | Bloque centrado de 240 px: `.sp-icobox--lg` (56, radio `--sp-r-icon-lg` 15) sobre `--sp-surface-empty` con `FileText` 28 px `--sp-ink-150`; `.sp-title-sec` `Todavía no tienes plantillas de {tipo}`; `.sp-hint` centrado máx. 320 px `Llena el formulario y usa «Guardar como plantilla», junto al botón de imprimir.`; `.sp-btn--secondary` `Volver al formulario` |
| Error de carga | `.sp-banner--warn` `No se pudieron cargar tus plantillas.` + `.sp-btn--ghost` `Reintentar` |
| Fila en operación | Fila a `opacity:.55; pointer-events:none` + `.sp-spinner` 17 px sustituyendo el icono de la acción pulsada |
| Error de operación | La fila vuelve a normal + `.sp-banner--danger` **encima de la lista**: `No se pudo {renombrar\|sobrescribir\|eliminar} «{nombre}».` + `Reintentar`. **La lista no se recarga** |

### 3.8 · Comportamiento por montaje

Los dos montajes son de anchura completa y se comportan igual: el panel crece con el
contenido y scrollea la página.

---

## 4 · Anchos

| Contenedor | Selector | Panel |
|---|---|---|
| 358 (XS) | Card 118 px, botón debajo a ancho completo | Filas de 104 px en dos plantas, título 18 px |
| 788 (MD) | Card 76 px, `1fr auto` | Filas de 68 px |
| 860 (LG) | igual | igual |
| 896 (LG) | igual | igual |

El panel no tiene rejilla: no hay nada que reordenar entre tramos.

---

## 5 · Decisiones, una línea cada una

- **Select nativo** — en iPad abre la rueda del sistema, que se maneja con el pulgar; controlar colores no compensa perderla.
- **Aplicar sin confirmación previa** — es la operación diaria; el aviso con Deshacer es la red.
- **El aviso no se autodescarta** — si desaparece solo, quien miró a otro lado pierde el único acuse de que se le borró trabajo.
- **Card vacía visible** — ocultarla haría que «Guardar como plantilla» apareciera de la nada.
- **Panel y no modal** — el panel opera sobre un formulario que sigue vivo debajo.
- **Renombrar en sitio, nombre nuevo en modal** — en el panel ya se ve la fila; al guardar por primera vez no hay fila que editar.
- **Iconos grises en reposo** — el rojo permanente en una lista de 3–4 filas es ruido.
- **Duplicado comprobado en cliente** — las plantillas ya están cargadas; avisar antes de guardar es más barato que después.
- **Tope sin bloqueo previo** — avisar de un límite que casi nunca se alcanza es ruido; basta el hint en ámbar.

---

## 6 · Excepción de consentimiento

La barra de acciones de consentimiento lleva ya tres botones (§ spec 05). El cuarto haría
un tablero, así que **«Guardar como plantilla» sube al selector**, junto a «Gestionar»:
rejilla `1fr auto auto`, ambos botones `.sp-btn--compact` 44 px con `white-space: nowrap`.
En XS los dos caen debajo, a ancho completo, uno por fila.
Es la única asimetría con los otros siete y es deliberada.

---

## 7 · NO DEFINIDO

| Ref | Qué falta |
|---|---|
| §1.0.2 | `escrito.cuerpo` guarda HTML de TipTap y hay que sanitizarlo al aplicar con **el mismo sanitizador que TipTap usa al pegar**. Falta su nombre en `EscritoMedicoForm`. |

Cerrados en esta serie: migración de `plantillas_honorarios` (no se migra), estabilidad de
`ESTUDIOS_PRESET` (no versionable, consecuencia declarada en spec 01 §3.5), y la
comprobación de nombre duplicado (cliente).


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
