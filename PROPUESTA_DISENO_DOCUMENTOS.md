# Propuesta de diseño · 8 formularios de documentos

**Base:** auditoría `DOCUMENTOS_AUDITORIA_FORMULARIOS.md` (57 hallazgos, commit `8deda48`) ·
sistema `spinus-tokens.css` · referencia de implementación `ModalDocumentoGenerado.tsx`.
**Alcance:** presentación, no flujo. Los cinco puntos donde la propuesta cambia cómo se
llena un formulario están marcados **[CAMBIA EL FLUJO]** y justificados en línea.
**Destinatario:** implementación por Claude Code. Todo valor que falte aquí está marcado
**NO DEFINIDO** con lo que hace falta para cerrarlo. No inventar los huecos.

---

## 0 · Índice y orden de implementación

El orden de abajo es de dependencia, no de importancia. §3.C (rejillas) y §3.B (tokens)
son infraestructura: si se hacen después, todo lo demás se escribe dos veces.

| # | Bloque | Depende de | Toca |
|---|---|---|---|
| 0 | §3.C Primitivas de rejilla por contenedor | — | `globals.css` + los 8 |
| 1 | §3.B Migración a tokens + primitivas `sp-doc-*` | 0 | `globals.css` + los 8 |
| 2 | §3.A Simetría (input, cards, listas, validación, botón) | 1 | los 8 |
| 3 | §3.D Barra de tipos de documento | 1 | 3 puntos de montaje |
| 4 | §1 Sistema de plantillas | 1, 2 | los 8 + BD |
| 5 | §2 Modal posterior a imprimir | 1 | `ModalDocumentoGenerado.tsx` |

---

## 0.1 · Vocabulario de anchos (se usa en todo el documento)

La auditoría demuestra que el viewport no predice el ancho de contenido. **A partir de
aquí, ningún valor de esta spec se expresa en viewport.** Se expresa en ancho del
contenedor del formulario, con cuatro tramos:

| Tramo | Ancho de contenedor | Casos reales que caen aquí (§0.2 de la auditoría) |
|---|---|---|
| **XS** | `< 380px` | overlay@390 = 326 · página@390 = 358 |
| **SM** | `380–599px` | ninguno hoy — reservado para rail de 320–580 y split view de iPad |
| **MD** | `600–839px` | overlay@820 = 708 · overlay@1180 = 720 · overlay@1440 = 720 · página@820 = 788 |
| **LG** | `≥ 840px` | página@1180 = 860 · página@1440 = 896 |

Consecuencia declarada: **el overlay (montaje B) nunca alcanza LG.** Tope 720px = MD
permanente. Eso es exactamente lo que hoy falla y lo que §3.C corrige de raíz.

**Presupuesto vertical** (peor caso, overlay@1180, 605px de alto útil):

| Elemento | Alto |
|---|---|
| Barra de tipos, colapsada tras elegir (§3.D) | 44px + 12px gap |
| Selector de plantilla (§1.a) | 76px + 18px gap |
| Barra de acciones sticky (§3.A.7) | 76px |
| **Disponible para campos** | **379px** |

Ese 379px es el número que gobierna todas las decisiones de plegado de §3.A.

---

## 0.2 · Deltas frente a la auditoría (leído el código real)

La auditoría es de `8deda48`. El código de `SolicitudLabForm`, `SolicitudImagenForm`,
`NotaHonorariosForm` y `ModalDocumentoGenerado` que tengo delante ya es posterior en
varios puntos. **Lo que sigue corrige la auditoría; donde discrepen, manda esta tabla.**

| Hallazgo | Estado real | Efecto en esta propuesta |
|---|---|---|
| **G-07** — `isLoading` sin consumir | **Ya resuelto** en los 3 archivos leídos: `const perfilPendiente = cargandoPerfil && !medicoInfo`, y va en el `disabled` del botón. Con el comentario que lo justifica | §3.A.8 se reduce a *propagar el mismo patrón a los 5 restantes* y a añadir el aviso de perfil incompleto |
| **I-01** — Imagen no puede eliminar estudios | **Ya resuelto**: `removeEstudio` existe (`:70`) y el `Trash2` se renderiza con `estudios.length > 1` | §3.A.4 solo cambia tamaño (14→18px), área (→44px) y criterio de ocultar→deshabilitar |
| **§4.9** — modal de generación | **Ya rediseñado y tokenizado**: `.sp-medal`, `.sp-title-state`, `.sp-btn--primary-block --reward`, `.sp-grid-actions`, `.sp-badge--deferred`. Correo **y** WhatsApp están hoy deshabilitados, los dos | §2 se reescribe como extensión de ese componente. Ver §2.0 |
| **Aplicar plantilla** | Honorarios **ya confirma antes de aplicar** si `!isFormEmpty(...)`, y `isFormEmpty` **ya existe** (`:57-66`) | §1.d generaliza esa función en vez de inventarla. §1.a sustituye la confirmación previa por aviso posterior — justificado allí |
| **Editar plantilla** | `saveTemplate` **ya** detecta nombre duplicado y ofrece sobrescribir su contenido (`:243-256`) | Es el mismo mecanismo de §1.c. Se conserva y se le añade la entrada explícita desde el panel |
| **Validación** | Honorarios tiene un **tercer** paradigma que la auditoría no recoge: error inline por fila (`El precio debe ser mayor a 0`, `:668`) más `disabled` global | §3.A.5 lo absorbe: el error por campo se conserva, el `disabled` global desaparece |
| **`guardadoEnExpediente`** | `false` significa **`storagePath === null` o el insert lanzó**. Con `storagePath === null` la fila **sí se inserta**: lo que falta es el PDF en Storage, y el documento no es recuperable desde la lista | §2.5 usa esa semántica exacta, no "no se guardó nada" |
| **Folio** | `applyTemplate` **ya** regenera folio y resetea fecha al aplicar (`:186-187`) | Coincide con las exclusiones de §1.0.2. Confirmado, no propuesto |

### 0.2.1 · Orden de cascada — importante para implementar

`globals.css` importa **Tailwind antes que `spinus-tokens.css`** (documentado en
`ModalDocumentoGenerado.tsx:150-152`). Consecuencia práctica: **las utilidades de Tailwind
NO ganan a las clases `.sp-*`.** El comentario de `spinus-tokens.css` sobre `@layer
components` describe la intención, no lo que ocurre con este orden de importación.

Regla para los 8 formularios: cuando haya que desviarse de una `.sp-*` (un
`justify-content`, un `flex-direction`, un ancho), se hace con **`style` inline** o con una
clase `.sp-doc-*` propia — nunca con una utilidad de Tailwind, que se aplicará en silencio
sin efecto. El precedente ya está en el código (`style={{ flexDirection: 'column' }}` en el
modal).

---

# 1 · Sistema de plantillas

## 1.0 · Modelo y reglas fijas

Comportamiento dado por el encargo, no se discute; se transcribe para que quede en un
solo sitio:

- Alcance: **por médico** (`user_id`), no por clínica.
- Tope: **10 por `tipo_documento`**. La 11 no se crea: se ofrece ir a gestión.
- Contenido: **todo el estado del formulario menos los datos del paciente**.
- Aplicar **sobrescribe** el formulario completo y lo avisa.
- Editar = **sobrescribir desde el formulario actual**. No hay editor de plantillas.

### 1.0.1 · Esquema

Tabla única para los 8, no una por tipo. Sustituye a `plantillas_honorarios`.

```sql
create table plantillas_documento (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  tipo_documento  text not null,      -- enum de 8, ver §1.0.2
  nombre          text not null,
  contenido       jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, tipo_documento, nombre)
);
```

- RLS: `user_id = auth.uid()` en las cuatro operaciones. **No filtrar por clínica.**
  Esto elimina H-01 por construcción: `resolvedClinicaId` deja de existir como concepto.
- El tope de 10 se valida en cliente **y** en un trigger `before insert`. El cliente da
  el mensaje bueno; el trigger evita la carrera de dos pestañas.
- `nombre`: 1–40 caracteres tras `trim()`. Colisión → error 23505 → mensaje de §1.b.
- Migración de `plantillas_honorarios` → `plantillas_documento` con
  `tipo_documento = 'honorarios'`: **NO DEFINIDO** si hay filas en producción que
  conservar. Falta: recuento de filas reales. Si es 0 (probable: H-01 impide crearlas
  desde hace tiempo), se borra la tabla y no hay migración de datos.

### 1.0.2 · Qué guarda cada tipo

`contenido` es el estado del formulario **menos** los campos de paciente. Lista exacta de
exclusiones, idéntica en los 8 y aplicada por una lista de claves, no por omisión:

**Excluir siempre:** `paciente`, `pacienteId`, `diagnostico`, `diagnosticoPrincipal`,
`diagnosticosSecundarios`, `edad`, `expediente`, `sexo`, `fecha`, `folio`, `peso`,
`idPaciente`, `familiar`, `idFamiliar`, `representante`, `idRepresentante`.

| tipo_documento | Se guarda |
|---|---|
| `receta` | `medicamentos[]` (los 5 campos por fila), `recomendaciones` |
| `laboratorio` | `estudios[]`, `notas` |
| `imagen` | `estudios[]` (tipo, región, proyecciones, indicación), `urgente` |
| `suplementacion` | `seleccionados[]`, `dosisPersonalizada{}`, `justificacion{}`, `notas`, `citaControl` |
| `honorarios` | `tipoDoc`, `seguro{}`, `conceptos[]`, `formaPago`, `divisa`, `notas` |
| `internamiento` | `tipoIngreso`, `dias`, `asa`, `hospital`, `urgente`, `procedimiento`, `requerimientos[]`, `justificacion`, `instruccionesPaciente`, `indicacionesPiso` |
| `escrito` | `asunto`, `cuerpo` (HTML de TipTap) |
| `consentimiento` | `lugar`, `procedimiento`, `anestesiologo`, `testigo1`, `testigo2`, `autorizaTransfusion`, `usoFotos`, `hojaDenegacion`, las 7 secciones |

**Decisiones dentro de esa lista, declaradas:**

- **`fecha` se excluye.** Una plantilla con fecha congelada es un defecto. Al aplicar, la
  fecha del formulario **no se toca**.
- **`hospital` (internamiento) SÍ se guarda.** Es del médico, no del paciente. Es el
  campo con más valor plantillable del formulario.
- **`peso` se excluye.** Es del paciente aunque lo teclee el médico.
- **`autorizaTransfusion` SÍ se guarda** aunque sea una decisión del paciente: es la
  postura por defecto del procedimiento, y el médico la revisa siempre (C-05 la vuelve
  obligatoria, §3.A.6).
- **`escrito.cuerpo` guarda HTML**, no texto plano. Sanitizar al aplicar con el mismo
  sanitizador que ya usa TipTap al pegar. **NO DEFINIDO:** cuál es. Falta: nombre del
  sanitizador en uso en `EscritoMedicoForm`.

### 1.0.3 · Versión del contenido

`contenido` lleva `_v: 1` en la raíz. Al aplicar, si `_v` no es el esperado, se aplican
solo las claves que existen hoy en el formulario y se ignoran las demás en silencio. Sin
migraciones de jsonb.

---

## 1.a · Selector de plantilla

Card propia, **primer bloque del formulario**, encima de "Datos del paciente" en los 8.
Estructura idéntica en los 8; solo cambia el `tipo_documento`.

### Geometría

| Propiedad | Valor |
|---|---|
| Contenedor | `.sp-card` — `padding: var(--sp-pad-card)` (18px 20px), `border-radius: var(--sp-r-card)` (16px), `border: 1px solid var(--sp-line-card)`, `background: var(--sp-surface)`, `box-shadow: var(--sp-shadow-flat)` |
| Alto total | **76px** en MD/LG (18+40+18) · **118px** en XS (fila apilada) |
| Separación con la card siguiente | `var(--sp-gap-block)` = 18px |
| Label | `.sp-label` — 13px/700/`--sp-ink-350`/mayúsculas/`ls .04em`, texto **"PLANTILLA"** |
| Gap label → control | `var(--sp-gap-label)` = 6px |

### Fila de control

MD/LG: `display:grid; grid-template-columns: 1fr auto; gap: var(--sp-gap-item)` (10px).
XS: `grid-template-columns: 1fr; gap: var(--sp-2)` (8px) — el botón pasa debajo, ancho
completo. Esto es la corrección directa de H-03, y se aplica desde el principio en los 8.

**Izquierda — `<select class="sp-input">`:**
- Alto 44px (`min-height: var(--sp-tap)`), `padding: 11px 13px`, `font-size: var(--sp-fs-body)` (14.5px).
- Opción 0: `— Sin plantilla —`, `value=""`.
- Opciones 1..N: `nombre`. Orden: `updated_at desc`. Sin fecha en la opción (no cabe en
  XS); la fecha vive en el panel de gestión.
- No se usa `<option disabled>` para el contador. El contador va en el hint.

**Derecha — botón "Gestionar":**
- `.sp-btn .sp-btn--compact`, texto `Gestionar`, icono `Settings2` 17px a la izquierda,
  `min-height: 34px` → **se eleva a 44px** (ver §3.A.1: `--sp-tap` es piso duro, sin excepciones).
- En XS: `width:100%`, texto `Gestionar plantillas`.

**Hint bajo la fila** (`.sp-hint`, 12.5px/`--sp-ink-300`, `margin-top: var(--sp-1)`):
- 0 plantillas → no hay hint (el estado vacío ocupa su lugar, ver abajo).
- 1–9 → `{n} de 10 guardadas`.
- 10 → `10 de 10 · el máximo` en `--sp-warn`.

### Aplicar

`onChange` del select aplica **inmediatamente**. Sin botón "Aplicar" y sin confirmación
previa: la acción es reversible con un solo gesto y una confirmación por cada aplicación
es peaje sobre el caso frecuente.

Tras aplicar, aparece **dentro de la misma card**, debajo de la fila, un
`.sp-banner .sp-banner--info` (fondo `--sp-primary-bg-faint`, sin borde, 13px,
`padding: 14px 16px`, radio `--sp-r-field` 12px):

> `Se aplicó «{nombre}». Se reemplazaron los campos del formulario; los datos del paciente no cambiaron.`  ·  **Deshacer**

- **Deshacer** es `.sp-btn--ghost` inline al final del texto, 13.5px, `--sp-primary`.
  Restaura el snapshot tomado justo antes de aplicar, en un único paso. Un solo nivel;
  no es una pila de undo.
- El banner **no se autodescarta**. Desaparece al primer cambio manual en cualquier campo
  del formulario o al aplicar otra plantilla. Razón: si desaparece solo, el médico que
  miró a otro lado pierde el aviso, que es lo único que le dice que se le borró trabajo.
- `aria-live="polite"` en el contenedor del banner.

**Aplicar sobre un formulario con datos:** mismo comportamiento, sin diálogo extra. El
aviso + Deshacer es la red. Justificación: la regla dada es "sobrescribe y avisa"; un
diálogo previo sería avisar dos veces y bloquear el caso mayoritario (formulario recién
abierto y vacío).

**Esto sustituye a un comportamiento que ya existe.** Honorarios hoy abre un modal de
confirmación antes de aplicar cuando `!isFormEmpty(...)` (`:196-205`). Se retira. Razón:
con plantillas en los 8 formularios y 3-4 por médico, aplicar es la operación frecuente y
un modal delante de ella es peaje diario; Deshacer cubre el error con un toque y sin
bloquear a nadie. Si se prefiere conservar el modal previo, hay que quitar el Deshacer:
las dos redes juntas son redundantes.

**También se retira la papelera junto al select** (`:481-490`, aparece al seleccionar una
plantilla). Eliminar pasa a vivir solo en el panel de §1.c, donde se ve la lista completa
y la fecha. Un borrado destructivo a un toque de distancia del control que se usa cada día
es un riesgo sin contrapartida.

### Estado vacío (0 plantillas) — es el estado del primer uso, y de los 8 el día 1

La card **no se oculta**. Ocultarla haría que "Guardar como plantilla" apareciera de la
nada y que la función no fuese descubrible: hoy 7 de 8 formularios no tienen plantillas y
nadie sabe que existen.

La card cambia de contenido, no de sitio:

```
┌────────────────────────────────────────────────────────────┐
│  [icono]   Sin plantillas de {tipo}                        │
│            Guarda este formulario como plantilla y la      │
│            próxima vez lo llenas de un toque.              │
└────────────────────────────────────────────────────────────┘
```

| Parte | Valor |
|---|---|
| Alto | 84px MD/LG · 104px XS |
| Layout | `display:flex; align-items:flex-start; gap: var(--sp-3)` (12px) |
| Icono | `.sp-icobox .sp-icobox--sm` (38×38, radio 11px, fondo `--sp-primary-bg`, icono `--sp-primary-text` 19px) con `FileText` |
| Título | `.sp-title-sec` — 14.5px/700/`--sp-ink-800`. Texto: `Sin plantillas de {tipo}` con `{tipo}` de la tabla de §3.D.1 en minúscula (`receta`, `laboratorio`, …) |
| Cuerpo | `.sp-hint` — 12.5px/`--sp-ink-300`, `margin-top: 2px`, máx. 2 líneas |
| Fondo | `--sp-surface`. **No** `--sp-surface-muted`: la card vacía no debe pesar más que las llenas |
| Sin botón | El único camino de creación es §1.b, junto a imprimir. Un botón aquí crearía una plantilla vacía |

### Estado de carga

Mientras resuelve la consulta: la card renderiza con el label y, en lugar del select, un
bloque de 44px con `background: var(--sp-surface-muted)`, `border-radius: var(--sp-r-field)`,
sin animación de shimmer. Duración típica < 200ms; un skeleton animado parpadea más de lo
que informa. El botón "Gestionar" se renderiza `disabled`.

**El formulario no se bloquea durante la carga.** El médico puede empezar a teclear.

### Estado de error de carga

Se sustituye el select por un `.sp-banner .sp-banner--warn` de una línea:
`No se pudieron cargar tus plantillas.` + botón `.sp-btn--ghost` **Reintentar**.
El resto del formulario funciona con normalidad. **Guardar como plantilla se deshabilita**
mientras haya error de carga, porque no se puede saber si ya hay 10.

---

## 1.b · Guardar como plantilla

### Ubicación

Dentro de la **barra de acciones sticky** (§3.A.7), a la izquierda del botón primario.
No es una card suelta a mitad del formulario (patrón actual de Honorarios `:762-797`,
que además no apila en XS — H-03).

```
MD / LG:   [ Guardar como plantilla ]  [ ══ Imprimir Receta ══════════════ ]
             ↑ .sp-btn--secondary          ↑ .sp-btn--primary, flex:1
             auto, no encoge (flex:0 0 auto)

XS:        [ ═══ Imprimir Receta ═══════════════════════════ ]   ← primero
           [      Guardar como plantilla                     ]   ← debajo, w-100%
```

Orden en XS: **el primario arriba**. Es el gesto de cada consulta; el otro es ocasional.

Estado del botón secundario:
- **Deshabilitado** si el formulario está vacío según §1.d (misma condición exacta que
  "Sobrescribir" del panel). `title` / `aria-describedby`: `Llena el formulario para poder guardarlo como plantilla.`
- **Habilitado** en cualquier otro caso, **incluso con 10 plantillas.** Con 10 no se
  bloquea: se pulsa y aparece el diálogo de tope (abajo). Un botón gris sin explicación
  es el defecto G-05, no la solución.

### Diálogo de nombre

Es un `ModalShell` (no `elevated`) → `z-50` dentro de la política de capas de
`nueva-nota/page.tsx:1896-1911`. **Nunca `z-[10000]`** (corrige H-04).

Es la única excepción a la regla "no modales dentro del formulario" (§1.c). Se justifica:
es transitorio, de un campo, y no puede vivir en el flujo porque interrumpe la emisión.

| Parte | Valor |
|---|---|
| Ancho | `var(--sp-modal-w-wait)` = 560px · XS: `calc(100vw - 32px)` |
| Header | `padding: var(--sp-pad-modal-head)` (20px 24px), título `.sp-title-modal` 19px/800: **Guardar como plantilla** |
| Subtítulo | `.sp-sub-modal` 13.5px/`--sp-ink-350`: `Se guarda todo menos los datos del paciente.` |
| Cuerpo | `padding: var(--sp-pad-modal-body)` (22px 24px 8px) |
| Campo | `.sp-input`, 44px, `maxlength=40`, autofocus, `placeholder="Prequirúrgico"` |
| Label | `.sp-label-field` — 12px/700/`--sp-ink-800`/mayúsculas: **NOMBRE** |
| Contador | `.sp-hint` a la derecha del label: `{n}/40`. Aparece a partir de 30 caracteres |
| Footer | `padding: var(--sp-pad-modal-foot)` (16px 24px), `border-top: 1px solid var(--sp-line-divider)`, botones a la derecha |
| Botones | `.sp-btn--ghost` **Cancelar** · `.sp-btn--primary` **Guardar** |

Estados:
- Nombre vacío tras `trim()` → **Guardar** deshabilitado.
- Nombre duplicado → al pulsar Guardar, `.sp-banner--warn` bajo el campo:
  `Ya tienes una plantilla con ese nombre. Usa otro, o sobrescríbela desde Gestionar.`
  El campo pasa a `border-color: var(--sp-warn)`.
- Guardando → **Guardar** con spinner `.sp-spinner` 17px y texto `Guardando…`, ambos
  botones deshabilitados. Sin timeout de UI; el error de red lo da el catch.
- Error de red → `.sp-banner--danger` en el cuerpo:
  `No se pudo guardar la plantilla. Revisa tu conexión e inténtalo de nuevo.`
  El diálogo **no se cierra** y conserva el nombre tecleado.
- Éxito → cierra, toast `Plantilla «{nombre}» guardada`, el select de §1.a queda con esa
  plantilla seleccionada, y el hint pasa a `{n+1} de 10 guardadas`.

### Diálogo de tope alcanzado (10/10)

Mismo `ModalShell`, `var(--sp-modal-w-decide)` = 620px.

| Parte | Contenido |
|---|---|
| Título | **Ya tienes 10 plantillas de {tipo}** |
| Cuerpo | `.sp-body` 14.5px/`--sp-ink-700`: `Es el máximo. Para guardar esta, borra o sobrescribe una de las que ya tienes.` |
| Botones | `.sp-btn--ghost` **Cancelar** · `.sp-btn--primary` **Gestionar plantillas** |

**Gestionar plantillas** cierra el diálogo y abre el panel de §1.c. El estado del
formulario se conserva íntegro (el panel no lo desmonta, ver §1.c).

---

## 1.c · Panel de gestión

**No es un modal.** Sustituye el contenido del formulario en su mismo espacio. Razón dada
en el encargo: en el montaje B el formulario ya vive en un overlay, y un modal encima
serían tres capas. Se respeta y se generaliza a los tres montajes: el panel es el mismo
en A, B y C.

### Mecánica de sustitución

- El árbol del formulario **no se desmonta**: se oculta con
  `display:none` en su envoltorio. Si se desmontara, se perdería lo tecleado, y
  "Sobrescribir con el formulario actual" dejaría de tener sentido.
- El panel se monta como hermano, en el mismo contenedor de scroll.
- Transición: `.sp-push-forward` al entrar (320ms, `--sp-ease-inout`), `.sp-push-backward`
  al volver. Ya existen en el sistema.
- El scroll del contenedor va a 0 al entrar y **se restaura** a su posición previa al volver.
- En el montaje B el header del overlay **no cambia**. La barra de tipos de documento
  (§3.D) se **oculta** mientras el panel está abierto: cambiar de tipo desde dentro del
  panel es ambiguo.

### Cabecera del panel

```
┌──────────────────────────────────────────────────────────────┐
│  ←   Plantillas de receta                            3 / 10  │
├──────────────────────────────────────────────────────────────┤
```

| Parte | Valor |
|---|---|
| Alto | 56px, `border-bottom: 1px solid var(--sp-line-divider)`, `margin-bottom: var(--sp-gap-section)` (20px) |
| Volver | Botón 44×44, radio `--sp-r-btn-sm` (10px), icono `ArrowLeft` 20px `--sp-ink-500`. Hover: `background: var(--sp-surface-muted)`. `aria-label="Volver al formulario"` |
| Título | `.sp-title-card` 20px/800/`--sp-ink-800` — `Plantillas de {tipo}`. En XS baja a `--sp-fs-vitals` (18px) |
| Contador | `.sp-badge` a la derecha: `3 / 10`. Con 10: `.sp-badge--warn` |

`Escape` también vuelve al formulario (y §3.A.8 le da a `Escape` un manejador que hoy no
existe — G-08). Con el panel abierto, `Escape` vuelve al formulario; **no** cierra el
overlay. Segunda pulsación sí lo cierra.

### Lista

Una fila por plantilla, `.sp-row` como base:
`display:flex; align-items:center; justify-content:space-between;
border: 1px solid var(--sp-line-soft); border-radius: var(--sp-r-field-sm) (11px);
padding: 12px 14px; background: var(--sp-surface)`.

Separación entre filas: `var(--sp-2-5)` = 10px. Orden: `updated_at desc`.

**MD / LG — una fila, 68px de alto:**

```
┌──────────────────────────────────────────────────────────────┐
│  Prequirúrgico                        [✎]  [⇄]  [🗑]         │
│  Actualizada el 3 de agosto                                  │
└──────────────────────────────────────────────────────────────┘
```

| Parte | Valor |
|---|---|
| Nombre | `.sp-title-sec` 14.5px/700/`--sp-ink-800`, `text-overflow: ellipsis`, 1 línea |
| Fecha | `.sp-hint` 12.5px/`--sp-ink-300`, `margin-top: 2px`. Formato: `Actualizada el {d} de {mes}` si es de este año; `Actualizada el {d} de {mes} de {aaaa}` si no. Sin hora. Locale `es-MX` |
| Acciones | 3 botones de 44×44, radio `--sp-r-btn-sm`, `gap: var(--sp-1)` (4px), iconos 18px |

Iconos y orden, izquierda a derecha — de menos a más destructivo:

| Acción | Icono | Color reposo | Color hover | `aria-label` |
|---|---|---|---|---|
| Renombrar | `Pencil` | `--sp-ink-icon` | `--sp-primary` + fondo `--sp-primary-bg` | `Renombrar {nombre}` |
| Sobrescribir | `RefreshCw` | `--sp-ink-icon` | `--sp-primary` + fondo `--sp-primary-bg` | `Sobrescribir {nombre} con el formulario actual` |
| Eliminar | `Trash2` | `--sp-ink-icon` | `--sp-danger` + fondo `--sp-danger-bg` | `Eliminar {nombre}` |

**Los tres iconos son grises en reposo.** Zanja la incoherencia 4.4 (papelera roja en
Receta/Lab, gris en Internamiento/Honorarios) a favor del gris: el rojo permanente en una
lista de 3–4 filas es ruido, y el sistema ya define `--sp-ink-icon` (#a3b1c4) como "icono
de acción secundaria (✕, editar, borrar)".

**XS — dos filas, 104px de alto:** nombre + fecha arriba; las tres acciones abajo en
`display:grid; grid-template-columns: repeat(3,1fr); gap: var(--sp-2)`, cada una 44px de
alto con **icono + etiqueta** (12px, `--sp-ink-500`): `Renombrar` · `Sobrescribir` ·
`Eliminar`. Con 326px de ancho útil caben (≈98px por celda).

### Sobrescribir — apagado cuando el formulario está vacío

Condición idéntica a la de §1.b (definida en §1.d). Cuando está apagada:

- `opacity: .4`, `cursor: not-allowed`, `disabled`, sin hover.
- Encima de la lista, **una sola vez**, no por fila, un `.sp-banner--info`:
  `El formulario está vacío: no hay nada con lo que sobrescribir.`
- Esta es la razón de que la banda de aviso sea global y no un tooltip por fila: con 10
  filas apagadas, 10 tooltips dicen lo mismo 10 veces.

### Confirmación de sobrescribir

`ModalShell` `var(--sp-modal-w-decide)` = 620px. **Nombra la plantilla, obligatorio.**

| Parte | Contenido |
|---|---|
| Título | **¿Sobrescribir «Prequirúrgico»?** — `.sp-title-modal`, el nombre entre comillas latinas, `--sp-ink-800`; si el nombre supera 40 caracteres se trunca con `…` |
| Cuerpo | `.sp-banner--danger` (fondo `--sp-danger-bg`, borde `--sp-danger-border`, texto `--sp-danger-ink` 14.5px/1.45, radio 13px, `padding: 14px 16px`): `Se reemplaza el contenido guardado de «Prequirúrgico» por lo que hay ahora en el formulario. El nombre y la fecha de creación no cambian. No se puede deshacer.` |
| Botones | `.sp-btn--ghost` **Cancelar** · `.sp-btn--primary` **Sobrescribir** |

El primario **no se pinta de rojo**. El sistema no define una variante `--danger` de
`.sp-btn`, y crearla para un caso es fabricar un componente nuevo, prohibido por el
encargo. El peso lo lleva el banner.

### Confirmación de eliminar

Idéntica en geometría. Título: **¿Eliminar «Prequirúrgico»?**
Cuerpo: `Se borra esta plantilla. Los documentos ya emitidos con ella no cambian.`
Botones: **Cancelar** · **Eliminar**.

### Renombrar

**En sitio, no en modal.** La fila se convierte en un `.sp-input` de 44px con el nombre
seleccionado, y las tres acciones se sustituyen por `✕` (44×44) y `Guardar`
(`.sp-btn--compact`, 44px). `Enter` guarda, `Escape` cancela. Duplicado → borde
`--sp-warn` y `.sp-hint` en `--sp-warn` bajo el campo: `Ya tienes una con ese nombre.`

Razón de no usar modal aquí y sí en el de nombre nuevo de §1.b: en el panel ya se ve la
fila, y editarla en su sitio conserva el contexto de la lista.

### Estados del panel

| Estado | Qué se ve |
|---|---|
| **Cargando** | Cabecera completa con el contador oculto. 3 filas fantasma de 68px: `background: var(--sp-surface-muted)`, `border-radius: var(--sp-r-field-sm)`, sin animación |
| **Vacío** | Bloque centrado, 240px de alto: `.sp-icobox--lg` (56px, radio 15px) en `background: var(--sp-surface-empty)` con `FileText` 28px en `--sp-ink-150`; título `.sp-title-sec` **Todavía no tienes plantillas de {tipo}**; cuerpo `.sp-hint` centrado, máx. 320px: `Llena el formulario y usa «Guardar como plantilla», junto al botón de imprimir.`; botón `.sp-btn--secondary` **Volver al formulario** |
| **Error de carga** | `.sp-banner--warn`: `No se pudieron cargar tus plantillas.` + `.sp-btn--ghost` **Reintentar** |
| **Fila en operación** | La fila entera a `opacity:.55; pointer-events:none` y un `.sp-spinner` 17px sustituyendo el icono de la acción pulsada |
| **Error de operación** | La fila vuelve a su estado normal + `.sp-banner--danger` **encima de la lista**: `No se pudo {renombrar\|sobrescribir\|eliminar} «{nombre}».` + **Reintentar**. La lista **no se recarga**: se conserva lo que el médico ve |

### Los tres montajes

| Montaje | Contenedor del panel | Alto | Comportamiento |
|---|---|---|---|
| **A** — página | El mismo `max-w-4xl` del formulario | Crece con el contenido; scroll de página | Idéntico |
| **B** — overlay | Dentro de `.doc-modal-scroll`, 720/326px de ancho | Máx. 605px, scroll interno | Cabecera del panel **sticky** `top:0`, fondo `--sp-surface`, `z-index: 2`. 10 filas de 68px + 10px = 770px > 605px: scrollea, por eso la cabecera se pega |
| **C** — standalone | Igual que A | Igual que A | El selector de paciente de arriba **permanece visible**: es del chrome de la ruta, no del formulario |

---

## 1.d · Definición de "formulario vacío"

Un solo predicado, `esFormularioVacio()`, usado por **tres** consumidores: el botón de
§1.b, la acción Sobrescribir de §1.c, y nada más. Definirlo dos veces es garantizar que
diverjan.

**Ya existe una versión de esto:** `isFormEmpty(lineas, paciente, notas, pacienteInicial)`
en `NotaHonorariosForm.tsx:57-66`. Lo que sigue la generaliza a los 8; no se escribe desde
cero. Nota de su implementación actual que conviene conservar: compara `paciente` contra
`pacienteInicial`, no contra `''` — el nombre prellenado no cuenta como dato tecleado. Ese
criterio se extiende a todos los campos con valor inicial.

**Regla general:** el formulario está vacío si, tras retirar las claves excluidas de
§1.0.2, todo lo que queda es igual al estado inicial del formulario recién montado.
Comparación profunda contra la constante de estado inicial de cada formulario, no contra
`{}`. Esto hace que los textareas precargados de Internamiento (`instruccionesPaciente`,
6 viñetas) y las 5 secciones precargadas de Consentimiento **cuenten como vacío** hasta
que se editan, que es lo correcto: guardar una plantilla idéntica al texto por defecto no
aporta nada.

Excepciones por formulario, porque "igual al inicial" no basta:

| Formulario | Vacío si además |
|---|---|
| `receta` | ninguna fila con `nombre_comercial` no vacío |
| `laboratorio` | `estudios[]` sin ninguna entrada con texto |
| `imagen` | ninguna fila con `tipo` y `region` |
| `suplementacion` | `seleccionados.length === 0` |
| `honorarios` | ninguna línea con `concepto` no vacío **y** `precio > 0` |
| `internamiento` | `hospital` vacío **y** `procedimiento` vacío **y** `requerimientos.length === 0` |
| `escrito` | `asunto` vacío **y** el editor `isEmpty` |
| `consentimiento` | `procedimiento` vacío **y** las 7 secciones sin editar |

---

# 2 · Modal posterior a imprimir

`ModalDocumentoGenerado.tsx` ya está rediseñado y tokenizado. **Esto es una extensión de
ese componente, no una reescritura.** Lo que ya existe se conserva literal.

## 2.0 · Invariantes del componente actual — no tocar

Estas cuatro decisiones están tomadas y razonadas en el propio archivo. Cualquier cambio
que las rompa es una regresión, no una mejora:

1. **Visualizar es un `<a href>`, no un `onClick`.** Entre el toque y la navegación no
   puede quedar ninguna asincronía o Safari/iOS lo bloquea en silencio. El `pdfUrl` se
   resuelve en `useMemo`, no en un efecto con `setState`.
2. **No hay botón de imprimir.** El visor de PDF ya lo trae en las cuatro plataformas.
3. **Lo deshabilitado va a opacidad plena.** Se comunica con relleno, cursor y badge —
   nunca apagando el texto, porque entonces no se puede leer *qué* es lo que todavía no se
   puede usar. Mismo criterio que el botón de Google en `/login`.
4. **`title=""` + `spinusGeometry="done"`** → `ModalShell` omite el header entero. La
   salida es Cerrar, el backdrop y `Escape`. El título vive en el cuerpo como
   `.sp-title-state`.

## 2.1 · Principio de composición

Cuatro acciones no caben como cuatro botones iguales sin volverse un tablero. La
jerarquía ya es la del componente; solo hay que extenderla:

1. **Visualizar** es lo que el médico hace casi siempre → primario de ancho completo en el
   pie. Ya está.
2. **Enviar por correo** y **Anexar al expediente** → terciarios en `.sp-grid-actions`.
3. **WhatsApp** sigue deshabilitado con `.sp-badge--deferred` **Próximamente**. No se
   esconde: su ausencia se pregunta más de lo que su estado inerte molesta. Ya está.
4. **Cerrar** ghost a ancho completo, al final. Ya está.

El cambio de composición es exactamente uno: **la rejilla pasa de 2 celdas a 3**, y Correo
deja de estar deshabilitado.

## 2.2 · Estructura y geometría

```
┌────────────────────────────────────────────────────────┐   sin header
│                       (medallón)                       │   cuerpo px-4 md:px-6
│                                                        │          pt-8 pb-6
│                   Receta generado                      │   .sp-title-state 27px
│        Ya puedes abrirlo para revisarlo o imprimirlo.  │   .sp-body max-w-xs
├────────────────────────────────────────────────────────┤   pie p-4 md:px-6
│  [ ══════  Visualizar ════════════════════════════ ]   │   --primary-block --reward
│  ──────────────────────────────────────────────────    │   divisor existente
│  [ Enviar por correo ] [ Anexar al expediente     ]    │   .sp-grid-actions
│  [ WhatsApp · Próximamente                        ]    │   ocupa las 2 columnas
│  [                  Cerrar                        ]    │   --ghost, width 100%
└────────────────────────────────────────────────────────┘
```

| Parte | Valor | ¿Cambia? |
|---|---|---|
| Shell | `ModalShell elevated spinusGeometry="done" title=""` → `z-[60]`, portalado | no |
| Ancho | el que fija `spinusGeometry="done"` — `--sp-modal-w-done` = 600px | no |
| Cuerpo | `px-4 md:px-6 pt-8 pb-6`, `flex-col items-center text-center gap-4` | no |
| Medallón éxito | `.sp-medal` 96px + `.sp-medal__core` 70px con `Check` (**no** `CheckCircle2`: parte el arco bajo el `stroke-dasharray`) | no |
| Medallón fallo | círculo 70px, fondo `--sp-warn-bg-badge`, `AlertTriangle` 32px en `--sp-warn` | no |
| Título | `.sp-title-state` 27px/800 — `{titulo} generado` | ver §3.A.9 |
| Cuerpo de éxito | `.sp-body max-w-xs` — `Ya puedes abrirlo para revisarlo o imprimirlo.` | no |
| Pie | `p-4 md:px-6 space-y-2.5` | no |
| Primario | `.sp-btn .sp-btn--primary .sp-btn--primary-block .sp-btn--reward`, `<a href>`, `Eye` 17px, texto **Visualizar** | no |
| Rejilla | `.sp-grid-actions mt-2 pt-3 border-t border-[var(--sp-line-divider)]` | **sí: 2 → 3 celdas** |
| Cerrar | `.sp-btn--ghost`, `style={{ width: '100%' }}` | no |

### La tercera celda

`.sp-grid-actions` es `1fr 1fr`. Con tres acciones:

```
Correo    │  Anexar                      ← fila 1
WhatsApp  (grid-column: 1 / -1)          ← fila 2, ancho completo
```

WhatsApp abajo y a lo ancho porque es el único inerte: agrupar arriba los dos vivos deja
la fila de acción limpia. En **Honorarios**, sin Anexar (§2.4), vuelve a ser
`Correo │ WhatsApp` en una sola fila y WhatsApp pierde el `span`.

El colapso a 1 columna de `.sp-grid-actions` está hoy en `@media (max-width: 768px)`.
**Se cambia a consulta de contenedor**, mismo criterio de §3.C: el modal tiene ancho
propio de 600px y no depende del viewport. Umbral: contenedor `< 420px` → 1 columna,
`gap: var(--sp-2-5)`.

### Los botones terciarios vivos

`.sp-btn--tertiary` tal cual: fondo `--sp-surface`, texto `--sp-ink-700`, borde 1px
`--sp-line-soft`, peso 600, 14px, `padding: 13px`, `min-height: 44px`, radio 12px.
Icono 17px en línea con el texto, `gap: var(--sp-2)` (8px).

**No** llevan `style={{ flexDirection: 'column' }}`: eso es exclusivo de los inertes, que
necesitan una segunda línea para el badge. Los vivos son de una línea. La diferencia de
altura dentro de la misma rejilla la absorbe `align-items: stretch` (por defecto en grid):
las tres celdas toman la altura de la más alta, ≈66px. Se acepta.

Recordatorio de §0.2.1: ese `flexDirection` va **inline y no como utilidad de Tailwind**
porque `.sp-btn` gana a las utilidades con el orden de importación actual.

## 2.3 · Enviar por correo — sustitución en sitio

Pulsar **Enviar por correo** **no abre otro modal**. Sustituye el cuerpo y el pie del
modal, mismo principio que §1.c y por la misma razón de capas.

`ModalShell` no tiene header aquí (`title=""`), así que el sub-panel aporta el suyo dentro
del cuerpo: fila de 44px, `display:flex; align-items:center; gap: var(--sp-3)`,
`border-bottom: 1px solid var(--sp-line-divider)`, `margin-bottom: var(--sp-gap-section)`.
Botón volver 44×44 con `ArrowLeft` 20px `--sp-ink-500` y `aria-label="Volver"`, y a su
derecha `.sp-title-sec` **Enviar por correo**. El medallón y el `.sp-title-state` se
ocultan mientras el sub-panel está abierto: no caben dos títulos.

El contenido del sub-panel es `text-align: left`; el cuerpo del modal es
`items-center text-center` y hay que neutralizarlo con `style` inline (§0.2.1).

### 2.3.a · El paciente tiene correo en el expediente

```
Se enviará a
┌──────────────────────────────────────────────┐
│  ana.perez@correo.com                        │   .sp-card-inner, 44px
└──────────────────────────────────────────────┘
Usar otro correo                                   ← .sp-btn--ghost

[ ═══════════ Enviar ═══════════════════════ ]
```

| Parte | Valor |
|---|---|
| Label | `.sp-label-field` 12px/700/mayúsculas — **SE ENVIARÁ A** |
| Correo | `.sp-card-inner` (fondo `--sp-surface-sunken`, borde `--sp-line-card`, radio 13px, padding 18px 20px) con el correo en `.sp-body` 14.5px/`--sp-ink-700`. No es un input: no se edita por accidente |
| Alterna | `.sp-btn--ghost` **Usar otro correo** → conmuta al caso 2.3.b con el campo vacío |
| Enviar | `.sp-btn--primary-block` |

### 2.3.b · El paciente no tiene correo

```
CORREO
┌──────────────────────────────────────────────┐
│  correo@ejemplo.com                          │   .sp-input, 44px, type=email
└──────────────────────────────────────────────┘
☐  Guardar este correo en el expediente de Prueba 2

[ ═══════════ Enviar ═══════════════════════ ]
```

| Parte | Valor |
|---|---|
| Campo | `.sp-input`, `type="email"`, `inputmode="email"`, `autocomplete="email"`, `autocapitalize="off"`, `spellcheck="false"`, autofocus, 44px |
| Validación | Al perder foco y al pulsar Enviar. Formato inválido → borde `--sp-warn`, `.sp-hint` en `--sp-warn`: `Revisa el correo: falta la arroba o el dominio.` |
| Casilla | `.sp-check` — 22×22, radio 6px, borde 1.5px `--sp-line-strong`, marcada `--sp-primary`. **Desmarcada por defecto**, como pide el encargo. Contenedor `min-height: 44px` |
| Texto de la casilla | `.sp-check__label` 14.5px/`--sp-ink-700` — `Guardar este correo en el expediente de {nombre}`. Sin nombre de paciente disponible: `Guardar este correo en el expediente` |
| Casilla sin paciente | Si no hay `pacienteId` (Escrito y Honorarios pueden emitirse sin paciente), **la casilla no se renderiza**. No hay expediente donde guardar |
| Separación campo → casilla | `var(--sp-4)` = 16px |
| Enviar | `.sp-btn--primary-block`, `margin-top: var(--sp-gap-section)` (20px). Deshabilitado con el campo vacío |

### 2.3.c · Estados del envío

| Estado | Qué se ve |
|---|---|
| **Enviando** | Botón con `.sp-spinner` 17px + `Enviando…`; campo y casilla `disabled` |
| **Enviado** | Vuelve al cuerpo principal del modal. El botón **Enviar por correo** de la rejilla pasa a estado enviado: icono `Check` 18px en `--sp-success`, texto `Enviado`, `border-color: var(--sp-success-border)`, `background: var(--sp-success-bg-alt)`, **sigue pulsable** para reenviar (al pulsarlo vuelve al formulario de correo con el destinatario precargado). Toast: `Documento enviado a {correo}` |
| **Error de envío** | Se queda en el sub-panel. `.sp-banner--danger` sobre el botón: `No se pudo enviar el correo.` + el motivo si el backend lo da. El botón vuelve a **Enviar**. El correo tecleado se conserva |
| **Correo guardado en expediente falló pero el envío salió** | Se envió: se vuelve al cuerpo y el toast añade una segunda línea en `--sp-warn`: `El correo se envió, pero no se pudo guardar en el expediente.` No se reintenta solo |
| **Sin conexión** | El botón **Enviar por correo** de la rejilla nace deshabilitado con `.sp-badge--deferred` **Sin conexión**. Visualizar y Anexar siguen según §2.5 |

**NO DEFINIDO — el envío en sí.** Falta: (1) qué servicio manda el correo y si existe ya
un endpoint; (2) si el PDF viaja adjunto o como enlace firmado, y con qué caducidad;
(3) el asunto y el cuerpo del correo, que son copy clínico-legal y no los invento;
(4) si el envío queda registrado en el expediente como evento. Sin (2) no se puede
decidir si el modal debe advertir de la caducidad del enlace.

## 2.4 · Anexar al expediente

Presente en 7 de 8. **Ausente en Honorarios**, que no tiene valor clínico — regla del
encargo. En Honorarios la rejilla queda: fila 1 = Correo + WhatsApp. Sin hueco vacío.

Es una **acción**, no una casilla previa a imprimir. Se anexa por defecto al emitir (es lo
que ya hace el código: 7 formularios insertan en `documentos` si hay `pacienteId`), así
que en el caso normal el botón **nace ya en estado hecho**:

| Estado | Aspecto del botón |
|---|---|
| **Anexado** (por defecto, caso normal) | Icono `Check` 18px `--sp-success`, texto **Anexado al expediente**, `background: var(--sp-success-bg-alt)`, `border-color: var(--sp-success-border)`, texto `--sp-ink-700`. `aria-disabled="true"`, no pulsable. **No es un botón: es un recibo.** |
| **Falló al guardar** | Icono `RefreshCw`, texto **Reintentar anexar**, `border-color: var(--sp-danger-border)`, texto `--sp-danger-ink`. Pulsable |
| **Reintentando** | `.sp-spinner` 17px + `Anexando…` |
| **Sin paciente** | El botón no se renderiza. Sin `pacienteId` no hay expediente |
| **Honorarios** | El botón no se renderiza nunca |

Esto resuelve el problema que la auditoría señala en §5.2: `guardadoEnExpediente={false}`
deja de ser ambiguo porque **no hay opt-out previo**. El médico que no quiere el documento
en el expediente no lo emite desde el expediente. Si más adelante se quiere el opt-out,
la prop debe pasar de `boolean` a `'ok' | 'error' | 'omitido'` — declarado aquí para que
no se cablee un booleano hoy y haya que romperlo mañana.

**[CAMBIA EL FLUJO]** — mínimamente: hoy no hay control ninguno, así que esto solo añade
visibilidad y un reintento. No cambia cuándo ni cómo se guarda.

## 2.5 · Banner de estado del expediente

Primera cosa del cuerpo del modal, **solo cuando hay algo que decir**. En el caso normal
(guardado bien) **no hay banner**: el estado ya lo comunica el botón Anexado de §2.4.
Un banner verde de "todo bien" en cada emisión es ruido de ocho veces al día.

| Situación | Banner |
|---|---|
| Guardado correctamente | **ninguno** |
| No se pudo guardar | `.sp-banner--warn` (fondo `--sp-warn-bg`, borde `--sp-warn-border`, texto `--sp-warn`, 14px/600, radio 12px, padding 13px 18px), icono `AlertTriangle` 18px: `El PDF se generó, pero no se pudo guardar en el expediente. Puedes reintentarlo abajo.` |
| Emitido sin paciente | `.sp-banner--info` (fondo `--sp-primary-bg-faint`, sin borde, `--sp-ink-500`, 13px): `Este documento no se guardó en ningún expediente porque no hay paciente seleccionado.` |
| Honorarios | **ninguno**. No aplica |

**El modo offline no aparece en esta tabla a propósito:** el búnker entrega el PDF él
mismo (`entregar: !!offlineMode`) y **este modal no se monta**
(`if (pdfBlob && !offlineMode) setDocGenerado(...)`). No hay estado offline que diseñar
aquí.

**Qué significa exactamente `guardadoEnExpediente === false`** (§0.2): o el insert lanzó,
o `storagePath === null`. En el segundo caso **la fila sí se insertó**, pero sin PDF en
Storage, así que el documento no es recuperable desde la lista. Por eso el texto del
banner habla de *no aparecer en la lista de documentos*, y no de *no se guardó nada*. El
literal actual ya lo dice bien y **se conserva**:

> `El documento está listo y puedes abrirlo e imprimirlo ahora, pero no se pudo guardar en el expediente: no va a aparecer en la lista de documentos del paciente.`

El banner de fallo es el que ya existe (`ModalDocumentoGenerado.tsx:119-127`); solo cambia
el texto y se le añade la referencia al reintento.

---

# 3 · Acabado de los formularios

## 3.C · Las rejillas miden el contenedor (se hace primero)

Es la causa raíz. Se resuelve una vez, en CSS, y ningún formulario vuelve a escribir un
breakpoint.

### 3.C.1 · La regla

**Prohibido usar prefijos responsive de Tailwind (`sm:`, `md:`, `lg:`, `xl:`) dentro de
`src/components/documentos/`.** Miden el viewport y el viewport no es el contenedor.
Se sustituyen por consultas de contenedor.

Puerta de CI, ejecutable:

```bash
grep -rnE '\b(sm|md|lg|xl|2xl):' src/components/documentos/ && exit 1
```

### 3.C.2 · El contenedor

El envoltorio raíz de cada uno de los 8 formularios lleva:

```css
.sp-doc-form {
  container-type: inline-size;
  container-name: docform;
  display: flex;
  flex-direction: column;
  gap: var(--sp-gap-block);          /* 18px entre cards */
}
```

`container-type: inline-size` establece contención de tamaño en línea; no afecta al alto.
Los tres montajes lo obtienen gratis porque el envoltorio es del formulario, no de la
página.

### 3.C.3 · Las primitivas

Cuatro clases. **No hay más rejillas en los 8 formularios que estas cuatro.**

```css
/* Rejilla de campos. data-cols = máximo al que puede llegar. */
.sp-doc-grid            { display: grid; gap: var(--sp-4); grid-template-columns: 1fr; }

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

/* Ocupación. Se resuelven contra el número de columnas vigente, sin desbordar. */
.sp-doc-span-2   { grid-column: span 2; }
.sp-doc-span-all { grid-column: 1 / -1; }
@container docform (max-width: 379px) { .sp-doc-span-2 { grid-column: auto; } }
```

`minmax(0, 1fr)` en lugar de `1fr` es obligatorio: es lo que impide que el ancho mínimo
intrínseco de un `<input>` (≈175px, mecanismo de V-01) infle la pista y desborde la fila.
Con esto, **V-01 y V-02 dejan de ser hipótesis: quedan cerradas por construcción.**

Filas de lista con columnas fijas (Honorarios) — la cuarta primitiva:

```css
/* Fila de ítem: contenido flexible + N columnas de tamaño fijo + acción de 44px */
.sp-doc-itemrow {
  display: grid; gap: var(--sp-2-5);          /* 10px */
  grid-template-columns: minmax(0, 1fr) 140px 44px;
  align-items: start;
}
@container docform (max-width: 519px) {
  .sp-doc-itemrow {
    grid-template-columns: minmax(0, 1fr) 44px;
  }
  .sp-doc-itemrow > .sp-doc-itemrow__num { grid-column: 1 / -1; }   /* precio pasa a fila propia */
}
```

En XS (326px de contenido menos 40px de padding de card = 286px), la fila queda
`242px + 44px` para el concepto y luego el precio a ancho completo en la segunda línea.
La columna de concepto pasa de **94px a 242px**. H-02 resuelto.

### 3.C.4 · Sin soporte de consultas de contenedor

```css
@supports not (container-type: inline-size) {
  .sp-doc-grid { grid-template-columns: 1fr !important; }
  .sp-doc-itemrow { grid-template-columns: minmax(0,1fr) 44px !important; }
}
```

Degradación a una columna: correcta siempre, subóptima en pantallas grandes. Es el
fallback seguro. Baseline real: Safari/iPadOS 16 (sep-2022), Chrome 105, Firefox 110.
**NO DEFINIDO:** si la base instalada de iPads de los médicos incluye iPadOS 15 o
anterior. Falta: analítica de versiones de Safari. Si hay tráfico relevante en iPadOS 15,
el fallback de una columna deja el iPad horizontal peor que hoy y habría que sustituirlo
por un `ResizeObserver` que escriba `data-w="xs|sm|md|lg"` en `.sp-doc-form`.
(Ese `ResizeObserver` es, de hecho, la alternativa completa si se prefiere no depender de
CSS moderno: mismas cuatro clases, mismos umbrales, seleccionadas por
`.sp-doc-form[data-w="md"] .sp-doc-grid[data-cols="3"]`.)

### 3.C.5 · Rejilla por formulario, valor exacto

| Formulario | Bloque | Hoy | Nuevo | Ancho de columna resultante en el peor caso (overlay@390 = 286px de contenido de card) |
|---|---|---|---|---|
| Receta | Datos | `grid-cols-1 sm:grid-cols-3` | `data-cols="3"` | 286px (1 col) |
| Receta | Medicamento | `grid-cols-2 sm:grid-cols-3` | `data-cols="3"`; `nombre_comercial` y `presentacion` con `.sp-doc-span-2` | 286px — corrige R-02: el autocomplete deja de tener 143px |
| Lab | Datos | `sm:grid-cols-3` | `data-cols="3"` | 286px |
| Imagen | Datos | `sm:grid-cols-3` | `data-cols="3"` | 286px |
| Imagen | Estudio | `grid-cols-2 sm:grid-cols-4` | `data-cols="4"`; `tipo` y `region` con `.sp-doc-span-2`; `indicacion` con `.sp-doc-span-all` | 286px — corrige I-02 e I-03 |
| Suplementación | Datos | `sm:grid-cols-2 lg:grid-cols-4` | `data-cols="4"` | overlay@1180: 720px de contenedor → **3 columnas de 220px**, no 4 de 158. **S-01/V-02 cerrado** |
| Suplementación | Selección | `sm:grid-cols-2` | `data-cols="2"` | — |
| Suplementación | Dosis | `sm:grid-cols-2` | `data-cols="2"` | — |
| Honorarios | Datos | `sm:grid-cols-3` | `data-cols="3"` | — |
| Honorarios | Seguro | `sm:grid-cols-3` | `data-cols="3"` | — |
| Honorarios | Conceptos | `grid-cols-[1fr_140px_36px]` | `.sp-doc-itemrow` | **H-02 / V-01 cerrado** |
| Honorarios | Pago | `sm:grid-cols-2` | `data-cols="2"` | — |
| Internamiento | Datos | `sm:grid-cols-3` + 2 bloques fuera | `data-cols="3"` con `hospital` **dentro** de la rejilla, `.sp-doc-span-2`, y `urgente` con `.sp-doc-span-all` | corrige N-01: los tres obligatorios en la misma rejilla |
| Escrito | Datos | `sm:grid-cols-3` | `data-cols="3"` | — |
| Consentimiento | Identificación | `sm:grid-cols-2 lg:grid-cols-3` | `data-cols="3"` | overlay@1180: 720px → **3 columnas de 220px**. Sigue estrecho para "Identificación del representante". Ver §3.A.10 |

**Efecto medido de la corrección, iPad horizontal (1180) en el overlay:**

| Bloque | Hoy | Con `@container` |
|---|---|---|
| Suplementación · datos | 4 col × 158px | 3 col × 220px |
| Consentimiento · identificación | 3 col × 216px | 3 col × 220px |
| Honorarios · conceptos @390 | concepto 94px | concepto 242px |

Y, lo importante: **girar el iPad ya no reordena nada** en el overlay, porque el
contenedor del overlay mide 720px en las dos orientaciones. La inversión de expectativa
que describe el encargo desaparece.

---

## 3.B · Migración a tokens

### 3.B.1 · Los 74 hex, uno a uno

| Hex actual | Dónde se usa hoy | Token | Nota |
|---|---|---|---|
| `#1e5fa8` | `focus:border`, botón primario, links | `var(--sp-primary)` | Coincidencia exacta con el fallback del token |
| `#1a3a5c` | hover del primario | `var(--sp-primary-hover)` | Exacta |
| `#0f2540` | títulos oscuros | `var(--sp-ink-900)` (#14345c) | **No es exacta.** ΔE visible pero el token es el rol correcto. Se acepta el desplazamiento |
| `#94a3b8` | texto secundario | `var(--sp-ink-250)` | Exacta |
| `#EF5350` | iconos y textos de error | `var(--sp-danger)` (#c0392b) | **No es exacta.** `#EF5350` no pasa AA sobre blanco (3.5:1); `--sp-danger` sí (5.5:1). Se cambia a propósito |
| `#1d1d1f` | texto de título | `var(--sp-ink-800)` | Rol correcto |
| `#3d3d3f` | cuerpo | `var(--sp-ink-700)` | Rol correcto |
| `#FEF2F2` | fondo de error | `var(--sp-danger-bg)` (#fdf2f2) | Prácticamente exacta |
| `#EFF6FF` | fondo informativo azul | `var(--sp-primary-bg-faint)` | Se tematiza con el médico. Cambio intencional |

### 3.B.2 · Clases de Tailwind → tokens

Las clases `slate-*` y `red-*` son tan numerosas como los hex y son el mismo problema.

| Clase | Token | Nota |
|---|---|---|
| `text-slate-700` | `var(--sp-ink-700)` | cuerpo |
| `text-slate-600` | `var(--sp-ink-600)` | |
| `text-slate-500` | `var(--sp-ink-500)` | pasa AA (4.8:1) |
| `text-slate-400` | `var(--sp-ink-350)` (#8a99ac) | **Sube el contraste**: 2.8:1 → 3.6:1. Corrige C-06 parcialmente |
| `text-slate-300` | `var(--sp-ink-500)` | **Sube dos escalones.** 1.9:1 es ilegible. C-07: `(si aplica)` es texto de contenido, no decoración |
| `bg-slate-50` | `var(--sp-surface-sunken)` | franja de cabecera de card |
| `bg-white` | `var(--sp-surface)` | |
| `border-slate-200` | `var(--sp-line-soft)` | |
| `border-slate-300` | `var(--sp-line-input)` | bordes de control |
| `border-slate-100` | `var(--sp-line-divider)` | divisores |
| `text-red-600` / `text-red-700` | `var(--sp-danger)` | |
| `bg-red-50` | `var(--sp-danger-bg)` | |
| `border-red-200` | `var(--sp-danger-border)` | |
| `text-red-400` (papeleras) | `var(--sp-ink-icon)` | Ver §3.A.4: la papelera es gris en reposo |
| `text-amber-*`, `bg-amber-*` (Internamiento) | eliminar — ver §3.A.3 | Las cards de color desaparecen |
| `bg-blue-50`, `border-blue-200` (Internamiento) | eliminar | Ídem |

**Regla:** tras la migración, `grep -rE '#[0-9a-fA-F]{6}|slate-|red-[0-9]|amber-|blue-'
src/components/documentos/*Form.tsx` debe dar **0**.

**Contrastes verificados sobre `--sp-surface` (#ffffff):** `--sp-ink-700` #3b4a5c = 8.9:1 ·
`--sp-ink-500` #5a6b81 = 5.4:1 · `--sp-ink-350` #8a99ac = 3.0:1 · `--sp-danger` #c0392b = 5.5:1.
`--sp-ink-350` **solo se usa en etiquetas de ≥13px en negrita** (AA grande: 3:1). Nunca
en texto de cuerpo. `--sp-ink-300` y `--sp-ink-200` **solo** en hints y placeholders.

### 3.B.3 · Los dos sistemas de acento, declarados

Existen y deben seguir existiendo separados:

| Sistema | Origen | Dónde manda | Dónde **no** entra |
|---|---|---|---|
| **Acento del médico** | `--cs` / `--cp` del `ThemeProvider`, cableado a `--sp-primary` | Toda la UI de la app: botón primario, foco, chips activos, links, badges. Y **el acento del PDF emitido** | En la barra de tipos de documento (§3.D) |
| **Color del tipo de documento** | Los 9 colores de tipo (§3.D.2) | **Solo** la barra de tipos de documento y el icono de tipo en la cabecera del panel de plantillas | En el PDF, en botones, en bordes de card, en el foco, en cualquier chip |

Son dos sistemas distintos y está bien que lo sean: el del médico es identidad de marca
del documento impreso; el del tipo es orientación dentro de la app. Lo que no puede pasar
es que se mezclen en la misma superficie. Por eso el color de tipo se confina a nueve
tiles y a nada más.

---

## 3.A · Simetría y consistencia

### 3.A.1 · El control. Una sola altura: 44px

Sustituir las tres variantes de `inputCls` (§4.2 de la auditoría) por `.sp-input` /
`.sp-textarea` del sistema, sin excepciones.

| Propiedad | Valor | Sale de |
|---|---|---|
| Alto mínimo | **44px** | `--sp-tap` |
| Padding | `11px 13px` | `.sp-input` |
| Fondo | `--sp-surface-sunken` (#fbfcfe) | |
| Borde | 1px `--sp-line-input` (#d5deea) | |
| Radio | 12px | `--sp-r-field` |
| Tipo | 14.5px / 1.45 / `--sp-ink-700` | `--sp-fs-body` |
| Placeholder | `--sp-ink-200` | |
| **Foco** | `outline:none`, fondo `--sp-surface`, borde **1.5px** `--sp-primary`, `box-shadow: var(--sp-focus-ring)` (0 0 0 4px `--sp-primary-focus`) | Un solo paradigma de foco: anillo **y** color de borde. Zanja §4.2 |
| Textarea | igual + `min-height: 88px`, `resize: vertical`, `line-height: 1.55` | |

Consecuencias que hay que aceptar y están aceptadas:

- **`py-1.5` de Suplementación (`:498`, `:508`) desaparece.** Dos alturas en una pantalla
  era S-03.
- Los textareas de color de Internamiento (`:380`, `:394`) usan `.sp-textarea`. N-04.
- El `<select>` de tamaño de bloque de Escrito (`:354`, `text-xs px-2 py-1`) sube a 44px.
  E-05.
- Los `<select>` usan `.sp-input` + `appearance:none` + chevron `ChevronDown` 18px en
  `--sp-ink-icon`, `right: 13px`, `pointer-events:none`, y `padding-right: 40px`.
- **Los dos autocompletes se unifican**: `AutocompleteMedicamento` y `AutocompleteEstudio`
  usan la misma clase y el mismo foco. `<datalist>` de Imagen (I-04) **se elimina** y pasa
  a `AutocompleteEstudio`, que es el que ya tiene foco correcto.

**Coste vertical:** 38px → 44px son +6px por campo. Consentimiento tiene 15 campos de
identificación: en 3 columnas son 5 filas → **+30px**. Aceptable dentro del presupuesto de
§0.1 gracias a §3.A.5 (plegado).

**Desplegable de autocomplete (L-03 / R-03 / V-03):** el `<ul>` de sugerencias deja de ser
`position:absolute` dentro del scroller y pasa a **portal a `body` con posicionamiento
fijo** calculado desde el `getBoundingClientRect()` del input, `z-index: 55` (por debajo
de `ModalShell elevated` en 60, por encima del overlay en 50). Ancho: el del input, con
`min-width: 260px`. Si no caben 200px por debajo, se abre hacia arriba. Se reposiciona en
`scroll` y `resize` del scroller. Esto cierra los tres hallazgos de una vez y es la única
forma de hacerlo con `overflow-x-hidden` en el scroller.

### 3.A.2 · Cabecera de sección. Un solo patrón

De los cuatro lenguajes de §4.3 sobrevive **uno**:

```
┌──────────────────────────────────────────────────────┐
│  [ico]  MEDICAMENTOS                    + Agregar    │  ← 56px
├──────────────────────────────────────────────────────┤
│                                                      │
│  … campos …                             padding 18px 20px
```

| Parte | Valor |
|---|---|
| Card | `.sp-card` — radio 16px, borde 1px `--sp-line-card`, `--sp-shadow-flat`, fondo `--sp-surface` |
| Cabecera | `display:flex; align-items:center; gap: var(--sp-3)`; `padding: 0 20px`; alto **56px**; `border-bottom: 1px solid var(--sp-line-divider)`; **sin fondo gris** |
| Icono | `.sp-icobox--sm` **solo** en la primera card del formulario y en cards con lista. En cards de campos simples se omite y el título va pegado al borde izquierdo |
| Título | `.sp-label` — 13px/700/`--sp-ink-350`/**mayúsculas**/`ls .04em` |
| Acción | Botón `.sp-btn--compact` a la derecha, `margin-left:auto` |
| Cuerpo | `padding: var(--sp-pad-card)` = 18px 20px |

Se elimina: la franja `bg-slate-50 border-b` (5 formularios), las cards ámbar y azul de
Internamiento y sus emoji 📋 🏥 (N-03), y el `<h2 class="text-sm text-slate-700">` de
cabecera plana.

**Por qué mayúsculas y no el `.sp-title-card` de 20px:** con 5–8 cards por formulario y
379px de presupuesto vertical en el overlay, ocho títulos de 20px/800 son 8 elementos
compitiendo con los campos. `.sp-label` es el rol que el sistema define para "etiqueta de
sección".

### 3.A.3 · Cards plegables. Una sola mecánica

Reemplaza la cabecera-botón con numeral de Consentimiento (`:61-73`) y el "todo abierto"
de C-02.

- Cabecera idéntica a §3.A.2 **más** un `ChevronDown` 18px en `--sp-ink-100` al final,
  que rota 180° en 120ms (`--sp-dur-micro`, `--sp-ease-out`).
- La cabecera entera es el `<button>`, `min-height: 56px`, `aria-expanded`.
- Plegada: solo la cabecera, 56px. El `border-bottom` desaparece.
- **Resumen al plegar:** a la derecha del título, antes del chevron, un `.sp-badge`
  con el recuento (`3 estudios`, `2 conceptos`) o, en secciones de texto, `Editada` /
  nada. Sin resumen, plegar esconde información.
- Sección obligatoria vacía y plegada → `.sp-badge--warn` con `Falta`.

**Qué nace plegado** — la decisión que devuelve el presupuesto vertical:

| Formulario | Nace plegado | Ahorro |
|---|---|---|
| Consentimiento | 5 de las 7 secciones clínicas: las que vienen precargadas. `descripcion` (4.ª) y `riesgosEspecificos` (6.ª) **nacen abiertas** porque llegan vacías y son obligatorias | ≈ **1.100px** de 2.400px |
| Internamiento | `Instrucciones al paciente` e `Indicaciones de piso` | ≈ **500px** (N-02) |
| Suplementación | El `beneficio_clinico` de cada suplemento: pasa a un `Info` 16px por tile que despliega el texto **en el tile**, no siempre visible | ≈ **700px** de 1.100px (S-02) |
| Receta | La card de Recomendaciones (`rows=6`) si el textarea está vacío | ≈ 150px |
| Honorarios | Card de Seguro de gastos médicos (ya lo está hoy) | — |

**[CAMBIA EL FLUJO]** — justificación: en Consentimiento, el camino más corto es "3 toques
+ 6 campos, y hay que localizar dos de esos campos entre 2.400px de scroll" (auditoría
§3.8). Plegar lo precargado **no elimina ningún campo ni cambia ningún orden**: pone los
dos campos obligatorios vacíos a un scroll de distancia en vez de a seis. Es el cambio con
mejor relación de la propuesta. En Suplementación, mover el `beneficio_clinico` a
desplegable sí cambia cómo se lee la pantalla de selección; se justifica porque es texto
de referencia que se lee una vez y se relee nunca, y hoy cuesta 1.100px en el peor
presupuesto vertical de la app.

### 3.A.4 · Listas de ítems. Un solo patrón, cinco corregidos

De los cinco patrones de §4.4 sobrevive **uno**:

| Aspecto | Decisión | Corrige |
|---|---|---|
| **Añadir: dónde** | **Cabecera de la card**, a la derecha (`margin-left:auto`) | Tres posiciones → una |
| **Añadir: qué** | `.sp-btn--compact` con `Plus` **17px** + texto **`Agregar`** (sin sustantivo) | I-05 (texto plano), tres tamaños de icono |
| **Añadir: en XS** | Si no cabe, el texto se oculta y queda el icono en 44×44 con `aria-label="Agregar"` | |
| **Quitar: qué** | Botón **44×44**, radio `--sp-r-btn-sm` (10px), `Trash2` **18px** | R-04, L-02, V-04 · 14/15/36px → 44px |
| **Quitar: color** | Reposo `--sp-ink-icon`. Hover: color `--sp-danger`, fondo `--sp-danger-bg` | Dos criterios de color → uno |
| **Quitar: con 1 ítem** | **Visible y `disabled`** (`opacity:.4`), nunca oculto | Ocultar mueve la interfaz al añadir el segundo. Zanja el criterio opuesto de §4.4 |
| **Quitar: existe** | En los cinco. **Imagen gana `removeEstudio`** | **I-01** |
| **Quitar: nombre accesible** | `aria-label="Eliminar {nombre del ítem o 'estudio 2'}"` | G-03 |
| **Numeración** | Prefijo `{n}` en `.sp-label` 13px `--sp-ink-350`, columna de 20px, solo cuando hay ≥2 | |
| **Fila** | `.sp-doc-itemrow` (§3.C.3) o `.sp-doc-grid` según el formulario | |
| **Separación entre filas** | `var(--sp-3)` = 12px, sin divisor. Con `≥4` filas, `border-top: 1px solid var(--sp-line-divider)` y `padding-top: 12px` | |
| **Lista vacía** | Bloque de 96px: `.sp-icobox--sm` en `--sp-surface-empty`, `.sp-hint` centrado: `Sin {estudios}. Usa «Agregar».` | |

**Chips de "Estudios frecuentes" (Lab) y "Requerimientos" (Internamiento):** `.sp-chip` —
`min-height: 44px`, `padding: 0 18px`, radio pill, borde `--sp-line-chip`, texto
`--sp-primary-ink` 14px/600. Activo (`aria-pressed="true"`): fondo y borde `--sp-primary`,
texto `#fff`. `gap: var(--sp-gap-item)` = 10px.

**L-01, la doble fuente de verdad:** el chip y la lista pasan a ser **una sola**. Pulsar un
chip **inserta la fila** en `estudios[]`; editar o borrar esa fila **apaga el chip** si el
texto deja de coincidir con el preset. El estado vive en `estudios[]`; el chip solo
proyecta `estudios.some(e => e.nombre === preset)`. Es lectura derivada, no un segundo
array.

### 3.A.4b · Controles segmentados y conmutadores

No están en la auditoría pero existen en Honorarios con hex a mano, y sin regla van a
reaparecer inventados en la migración.

**Segmentado** (`Tipo de documento`: Recibo/Cotización · `Divisa`: MXN/USD) —
`.sp-doc-segmented`:

```css
.sp-doc-segmented { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr;
                    gap: var(--sp-2); }
.sp-doc-segmented > button {
  min-height: var(--sp-tap);                       /* 44px, hoy py-2 ≈ 36px */
  border-radius: var(--sp-r-btn);                  /* 12px */
  border: var(--sp-bw-hair) solid var(--sp-line-input);   /* 1px, hoy border-2 */
  background: var(--sp-surface); color: var(--sp-ink-500);
  font-size: var(--sp-fs-body-sm); font-weight: var(--sp-fw-semi);
  transition: all var(--sp-dur-micro) var(--sp-ease-out);
}
.sp-doc-segmented > button:hover { border-color: var(--sp-primary-track);
                                   color: var(--sp-primary); }
.sp-doc-segmented > button[aria-pressed="true"] {
  background: var(--sp-primary); border-color: var(--sp-primary); color: #fff;
  font-weight: var(--sp-fw-bold);
}
```

El borde baja de `border-2` a 1px: el sistema define `--sp-bw-accent` (1.5px) solo para la
card protagonista y la zona de edición activa. Un segmentado no es ninguna de las dos.
`role="group"` en el contenedor, `aria-pressed` en cada botón.

**Conmutador** (`Seguro de gastos médicos`) — se conserva la geometría actual (pista
44×24, pulgar 16px) y solo cambian los colores: apagado `--sp-line-strong`, encendido
`--sp-primary`, pulgar `--sp-surface`. Área táctil: el `<button>` se envuelve en un
contenedor de `min-height: 44px`. `role="switch"`, `aria-checked`,
`aria-label="Seguro de gastos médicos"`.

### 3.A.5 · Validación. Un solo paradigma

Hoy conviven dos (§4.6) y ninguno de los dos funciona: el gris mudo (7 formularios) es
indistinguible de un botón roto, y el toast al pulsar (Consentimiento) enumera 9 campos en
una línea, en una notificación que se va sola.

**Se sustituyen los dos por uno.**

**Regla:** el botón primario **siempre está habilitado**, salvo mientras se imprime.
Encima de él, dentro de la barra de acciones sticky, vive un **resumen de requisitos**.

```
┌──────────────────────────────────────────────────────┐
│  ⚠  Faltan 2 campos:  Procedimiento · Riesgos        │   ← .sp-banner--warn, 44px
│  [ Guardar plantilla ] [ ═══ Imprimir Receta ═══════ ]│
└──────────────────────────────────────────────────────┘
```

| Parte | Valor |
|---|---|
| Banner | `.sp-banner--warn`, `border-radius: var(--sp-r-field)`, `padding: 10px 14px`, 14px/600, icono `AlertTriangle` 17px, `margin-bottom: var(--sp-2-5)` |
| Nombres | Cada campo faltante es un `<button>` inline, subrayado punteado (`.sp-link-alt`), `--sp-warn-strong`. Al pulsarlo: enfoca el campo y despliega su card si está plegada. **No usar `scrollIntoView`**: `container.scrollTop = el.offsetTop - 24` |
| Máximo listado | **3 nombres**. A partir de ahí: `Faltan 5 campos: Lugar · Edad · Procedimiento y 2 más` |
| Aparición | El banner **no aparece hasta el primer intento de imprimir**. Antes, el formulario recién abierto no acusa de nada |
| Tras el primer intento | Permanece visible y se actualiza en vivo al llenar campos. Desaparece cuando no falta nada |
| Al pulsar Imprimir con faltantes | No se emite. Se rellena/actualiza el banner, se enfoca el primer campo faltante, y ese campo pasa a `border-color: var(--sp-warn)` (se limpia al escribir) |
| `aria-live` | `polite` en el banner. `aria-invalid="true"` en cada campo faltante |

**Excepción única al "siempre habilitado":** `perfilPendiente` (§3.A.8). Mientras carga el
perfil el botón sí está `disabled`, con `.sp-spinner` 17px y `Cargando tu perfil…`. Ahí el
gris sí se explica solo porque hay un spinner y un texto.

**El error por campo se conserva donde ya existe.** Honorarios tiene hoy un tercer
paradigma que la auditoría no recoge: `El precio debe ser mayor a 0` bajo la fila
inválida. Eso **no es el patrón que se elimina** — es validación de formato por campo y
es correcta. Se tokeniza (`.sp-hint` en `--sp-danger`, `margin-top: var(--sp-1)`) y se
mantiene. Lo que se elimina es el `disabled` global mudo que la acompaña.

**Marca de obligatorio:** `*` en `--sp-danger` tras el label, con `aria-hidden="true"` y un
`<span class="sr-only">obligatorio</span>`. **La marca y la condición real de `disabled`
deben coincidir en los 8** — hoy no coinciden en 3 (§4.6).

**Tabla canónica de obligatorios** — esta es la lista, no hay otra:

| Formulario | Obligatorios |
|---|---|
| Receta | paciente · **≥1 medicamento con `nombre_comercial`** (R-01) |
| Lab | paciente · **≥1 estudio** (hoy exigido pero no marcado) |
| Imagen | paciente · **≥1 estudio con tipo y región** (hoy exigido pero no marcado) |
| Suplementación | paciente · **≥1 suplemento** (hoy exigido pero no marcado) |
| Honorarios | **≥1 concepto con precio > 0**. Paciente **no** obligatorio |
| Internamiento | paciente · hospital · diagnóstico principal |
| Escrito | cuerpo no vacío. Paciente **no** obligatorio |
| Consentimiento | lugar · fecha · paciente · edad · procedimiento · diagnóstico · familiar · **`autorizaTransfusion` ≠ null** (C-05) · descripción · riesgos específicos |

Las tres asimetrías de "¿es obligatorio el paciente?" se conservan a propósito:
**Honorarios** puede emitirse a un tercero pagador y **Escrito** puede ser un certificado
sin paciente en el sistema. Ambas son decisiones del producto, no accidentes. Se declaran
aquí para que no se "corrijan" sin querer.

**[CAMBIA EL FLUJO]** en 7 de 8: el botón deja de nacer gris. Justificación: G-05 + el
agravante G-06 (en la página hay que recorrer 2.400px para descubrir que está gris). Un
botón habilitado que explica qué falta al pulsarse enseña; un botón gris no enseña nada.

### 3.A.6 · Bloque de error

Uno solo, el de los 7 (§4.5). Receta abandona su variante:

```
.sp-banner .sp-banner--danger
```
Fondo `--sp-danger-bg` · borde 1px `--sp-danger-border` · texto `--sp-danger-ink`
(#8c2f2f) · 14.5px/1.45/400 · radio `--sp-r-card-inner` (13px) · `padding: 14px 16px` ·
`align-items: flex-start` · icono `AlertCircle` 18px.

### 3.A.7 · Barra de acciones

```css
.sp-doc-actions {
  position: sticky; bottom: 0; z-index: 1;
  margin: var(--sp-gap-block) -20px -18px;   /* sangra el padding del contenedor */
  padding: 14px 20px calc(14px + env(safe-area-inset-bottom));
  background: var(--sp-surface);
  border-top: 1px solid var(--sp-line-divider);
  box-shadow: 0 -8px 20px rgba(16, 42, 73, .05);
  display: flex; gap: var(--sp-gap-item); align-items: center;
}
@container docform (max-width: 379px) {
  .sp-doc-actions { flex-direction: column-reverse; }   /* primario arriba */
  .sp-doc-actions > * { width: 100%; }
}
```

**Se elimina el scoping `.doc-modal-scroll .doc-print-btn` de `globals.css:747`.**
`position: sticky` funciona contra el ancestro de scroll más cercano, que en el montaje B
es `.doc-modal-scroll` y en A/C es el viewport. Una sola regla sirve a los tres. **G-06.**

- Alto: **76px** (14 + 48 + 14).
- Primario: `.sp-btn--primary`, `flex: 1`, 48px (`--sp-ctrl-h-desktop`),
  15.5px/700, radio 12px, `box-shadow: var(--sp-shadow-btn)`.
  Deshabilitado: `background: #b6c6da`, sin sombra — **solo mientras imprime**.
- Secundario "Guardar como plantilla": `.sp-btn--secondary`, `flex: 0 0 auto`.
  **En Honorarios desaparece el `flex-1` del primario junto a un secundario propio**
  (H-06): la única disposición es esta.
- El botón `.sp-btn--primary-block` de 100% **no se usa en los formularios**: siempre
  comparte fila con el secundario, salvo en XS donde ya es ancho completo por la regla de
  arriba.

### 3.A.8 · Comportamientos transversales del overlay

| Hallazgo | Corrección |
|---|---|
| **G-08** sin `Escape` | `keydown` en el overlay: `Escape` → si hay panel de plantillas abierto, vuelve al formulario; si hay diálogo abierto, lo cierra; si no, cierra el overlay |
| **G-08** scroll del body | `document.body.style.overflow = 'hidden'` mientras el overlay está montado, restaurado al desmontar |
| **G-09** `overflow-x-hidden` | Se **mantiene**, y ahora es seguro: con `minmax(0,1fr)` en todas las rejillas nada excede el ancho del contenedor |
| **G-10** sin foco inicial | Al montar y al cambiar de tipo de documento, foco al **primer campo editable vacío** del formulario. Si todos vienen llenos, foco al contenedor de scroll con `tabindex="-1"` |
| **G-07** `isLoading` ignorado | **Ya resuelto en Lab, Imagen y Honorarios** con `const perfilPendiente = cargandoPerfil && !medicoInfo` en el `disabled`. **Propagar literal a los 5 restantes.** Bloquea solo mientras carga; si resuelve sin datos el botón se habilita igual — esa asimetría es deliberada y se conserva. **Añadido:** cuando resuelve sin `medicoInfo`, `.sp-banner--warn` sobre la barra de acciones: `Completa tu perfil para que el documento salga con tu encabezado.` + link `Ir a mi perfil`. **No bloquea la emisión** |
| **G-02** labels sin asociar | `<label htmlFor>` + `id` en los ~90 campos. Id derivado: `{tipo}-{campo}-{índice?}` |
| **G-03** sin nombres accesibles | `aria-label` en los ~40 botones de icono, con el patrón de §3.A.4 |
| **H-04** `z-[10000]` | Todos los diálogos de los formularios usan `ModalShell` → `z-50` / `z-[60]` |
| **H-05** folio colisionable | **NO DEFINIDO.** Falta: decidir si el folio se genera en servidor. La solución de UI (regenerar al emitir en vez de al montar) reduce la ventana pero no la elimina. Fuera del alcance de esta propuesta |

### 3.A.9 · Copy. Los literales exactos

**Botón primario** (§4.7 — hoy dos formularios comparten literal y uno usa otro verbo):

| Formulario | Texto |
|---|---|
| Receta | `Imprimir receta` |
| Lab | `Imprimir solicitud de laboratorio` |
| Imagen | `Imprimir solicitud de imagen` |
| Suplementación | `Imprimir plan de suplementación` |
| Honorarios | `Imprimir recibo` / `Imprimir cotización` |
| Internamiento | `Imprimir solicitud de internamiento` |
| Escrito | `Imprimir escrito médico` |
| Consentimiento | `Imprimir consentimiento` |

Los ocho usan **Imprimir**. Consentimiento abandona "Generar": es el mismo gesto físico.
Capitalización de frase, no de título (`Imprimir receta`, no `Imprimir Receta`).

En XS, si el texto no cabe en una línea, se acorta al núcleo: `Imprimir`.

**Toasts de confirmación** (§4.8 — hoy tres documentos dicen lo mismo):

| Formulario | Toast |
|---|---|
| Receta | `Receta guardada` |
| Lab | `Solicitud de laboratorio guardada` |
| Imagen | `Solicitud de imagen guardada` |
| Suplementación | `Plan de suplementación guardado` |
| Honorarios | `Recibo guardado` / `Cotización **guardada**` |
| Internamiento | `Solicitud de internamiento guardada` |
| Escrito | `Escrito guardado` |
| Consentimiento | `Consentimiento guardado` |

La concordancia de género de Honorarios (`'Cotizacion guardado'`, `:442-443`) se corrige,
y además llevaba la palabra sin tilde.

**Título del modal de §2.** Hoy el componente compone `{titulo} generado` con un literal
fijo, y con `titulo="Solicitud de laboratorio"` sale **"Solicitud de laboratorio
generado"**. La concordancia no se puede resolver desde el componente sin saber el género.
Corrección: la prop pasa a llevar **la frase completa**, y `ModalDocumentoGenerado` la
renderiza tal cual.

| Formulario | `titulo` |
|---|---|
| Receta | `Receta generada` |
| Lab | `Solicitud de laboratorio generada` |
| Imagen | `Solicitud de imagen generada` |
| Suplementación | `Plan de suplementación generado` |
| Honorarios | `Recibo generado` / `Cotización generada` |
| Internamiento | `Solicitud de internamiento generada` |
| Escrito | `Escrito médico generado` |
| Consentimiento | `Consentimiento generado` |

Renombrar la prop a `tituloCompleto` o similar para que el cambio de contrato no pase
inadvertido en los 8 llamantes.

### 3.A.10 · Lo que esta propuesta deja abierto

| Hueco | Qué falta |
|---|---|
| **Consentimiento a 220px de columna** | Aun con §3.C, 15 campos a 3 columnas de 220px en el overlay es estrecho para "Identificación oficial del representante". Opciones: (a) forzar `data-cols="2"` solo en ese bloque; (b) acortar los labels. **NO DEFINIDO** — falta ver los labels reales renderizados. Recomendación provisional: `data-cols="2"`, que en overlay da 348px y en página@1440 da 436px |
| **C-04 · edad y expediente a mano** | La página ya consulta `fecha_nacimiento` y `numero_expediente` y no los usa. Cablearlos exige pasar un objeto paciente a los 8 o replicar la consulta 6 veces (auditoría §5.3). **NO DEFINIDO** cuál de las dos. Falta: decisión de arquitectura, que no es de diseño |
| **Título del Escrito Médico** | ¿Campo nuevo junto a `asunto`, o `asunto` renombrado? Afecta a documentos ya emitidos. **NO DEFINIDO.** Falta: decisión de producto |
| **`hora`, `tituloPie`, `subtítulo`** | No existen en ningún formulario ni PDF. Añadirlos cambia la rejilla de datos de 3 a 4 columnas en los 8 y añade props a los 8 renderizadores. **NO DEFINIDO** si entran en este alcance |
| **Modo oscuro** | `spinus-tokens.css` define `html.dark` completo. Usando solo tokens, los 8 formularios funcionarán en oscuro sin trabajo extra. **No verificado**: falta revisar los iconos de tipo de documento (§3.D.2) y el `.sp-btn--primary:disabled` (#b6c6da literal, sin override en dark) |
| **R-05 · recomendaciones que solo acumulan** | Insertar bloques predefinidos sin poder quitarlos. La corrección natural es convertirlos en chips toggle sobre el textarea, pero eso **cambia el flujo** de un control que hoy funciona. **NO DEFINIDO** — falta preguntar al médico si acumular es deliberado |
| **S-04 · recalcular dosis** | Que el peso recalcule solo al cambiar es lo esperable, pero borraría dosis personalizadas ya tecleadas. **NO DEFINIDO** — falta la regla: ¿recalcular solo las no tocadas a mano? |

---

## 3.D · Barra de tipos de documento

### 3.D.1 · El problema, en una frase

Nueve elementos en flujo libre se reparten 3+2+2+1 → 5+3 → 6+2 según el ancho. Cada
reparto pone cada documento en un sitio distinto. Al girar el iPad, el médico pierde la
memoria muscular de dónde está cada uno.

### 3.D.2 · La decisión: matriz fija 3×3

**La barra es una rejilla de 3 columnas × 3 filas en todos los anchos y en los tres
montajes.** El orden nunca cambia. La posición de cada documento es una constante.

```
┌──────────────┬──────────────┬──────────────┐
│  Receta      │ Laboratorio  │  Imagen      │
├──────────────┼──────────────┼──────────────┤
│ Suplement.   │ Internam.    │ Escrito méd. │
├──────────────┼──────────────┼──────────────┤
│ Consent.     │ Honorarios   │              │  ← celda 9 vacía
└──────────────┴──────────────┴──────────────┘
```

Son **8 documentos, no 9** (la captura muestra 9 tiles porque incluye el activo entre los
demás). La novena celda queda **vacía**, no se rellena y no se reparte el espacio: es lo
que hace que las ocho posiciones sean fijas. Si algún día hay un noveno documento, entra
ahí sin mover ninguno.

```css
.sp-doc-typebar {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--sp-gap-item);          /* 10px */
  max-width: 660px;                 /* 3 × 213 + 2 × 10 */
}
```

| Tramo | Tile | Alto de la barra |
|---|---|---|
| **XS** (<380) | Icono 20px **arriba**, label debajo, 11px/600/`lh 1.15`, máx. 2 líneas, `text-align:center`, `padding: 8px 6px` | 3 × 62 + 2 × 10 = **206px** |
| **SM/MD/LG** (≥380) | Icono 18px **a la izquierda**, label 14px/600, `gap: var(--sp-2)` (8px), `padding: 0 14px`, una línea con `ellipsis` | 3 × 44 + 2 × 10 = **152px** |

A 326px de contenido en XS: celda = (326 − 20) / 3 = **102px**. "Suplementación" a 11px
mide ≈ 82px: entra en una línea. "Honorarios / Cotización" se acorta a **`Honorarios`**
en XS y SM. Labels canónicos:

| Orden | tipo_documento | Label ≥380 | Label XS | Icono (lucide) |
|---|---|---|---|---|
| 1 | `receta` | Receta | Receta | `Pill` |
| 2 | `laboratorio` | Laboratorio | Lab | `FlaskConical` |
| 3 | `imagen` | Imagen | Imagen | `ScanLine` |
| 4 | `suplementacion` | Suplementación | Suplem. | `ClipboardList` |
| 5 | `internamiento` | Internamiento | Internam. | `BedDouble` |
| 6 | `escrito` | Escrito médico | Escrito | `PenLine` |
| 7 | `consentimiento` | Consentimiento | Consent. | `ShieldCheck` |
| 8 | `honorarios` | Honorarios / Cotización | Honorarios | `Receipt` |

Iconos tomados de las capturas; coinciden con los que ya se usan.

### 3.D.3 · El color es identidad, y se ve siempre

**Decisión: identidad.** El color de cada documento es visible en los ocho tiles, todo el
tiempo, en el **icono**. La selección se comunica con **peso, fondo y borde**, no con la
aparición del color.

Razón: si el color solo aparece al seleccionar, no ayuda a encontrar nada — cuando lo ves
ya has llegado. Como identidad permanente, el color es un segundo canal de localización
junto a la posición fija de §3.D.2, y hace que la barra se lea de un vistazo en vez de
leerse palabra por palabra.

| Estado | Fondo | Borde | Icono | Label |
|---|---|---|---|---|
| **Reposo** | `--sp-surface` | 1px `--sp-line-chip` | color del tipo, **100%** | `--sp-ink-700`, peso 600 |
| **Hover** | `color-mix(in srgb, var(--doc-color) 6%, #fff)` | 1px `color-mix(in srgb, var(--doc-color) 30%, #fff)` | color del tipo | `--sp-ink-800` |
| **Seleccionado** | `color-mix(in srgb, var(--doc-color) 12%, #fff)` | **1.5px** `--doc-color` | color del tipo | `color-mix(in srgb, var(--doc-color) 40%, var(--sp-ink-700))`, peso **700** |
| **Foco (teclado)** | igual que el estado base | igual | igual | `box-shadow: 0 0 0 4px color-mix(in srgb, var(--doc-color) 18%, transparent)` |

Radio: `--sp-r-btn` (12px). Transición: `--sp-dur-micro` (120ms) `--sp-ease-out`.
Ese `12%` / `40%` es exactamente el patrón que el sistema ya usa para
`--sp-primary-bg` y `--sp-primary-ink`, aplicado a otra base.

**El tile seleccionado no usa `--sp-primary`.** Es la única superficie de la app donde el
acento no es el del médico, y es deliberado: §3.B.3.

**Los 9 valores de `--doc-color`: NO DEFINIDO.** Falta: los hex reales que ya existen en
el código de la barra (la captura muestra Honorarios en un naranja ≈ `#ea580c`, el resto
en gris porque hoy el color es estado, no identidad). Lo que **sí** queda definido y debe
cumplirse al cerrarlos:

1. Se declaran como tokens en `:root`: `--sp-doc-receta`, `--sp-doc-laboratorio`, …, uno
   por tipo. No como literales en el componente.
2. Cada uno debe dar **≥ 4.5:1 sobre `--sp-surface`** en su forma directa (se usa como
   color de icono, que es un glifo de 1.5–2px de trazo; el mínimo de 3:1 para gráficos no
   basta con estos trazos).
3. Los 8 deben ser distinguibles entre sí para un deuteranope: no puede haber dos verdes
   ni un verde y un rojo como único par de contraste. Verificar con simulación.
4. Ninguno puede coincidir con `--sp-primary` de ninguna de las paletas de médico
   disponibles, o el tile seleccionado se confundirá con el acento de la app.
   **NO DEFINIDO:** cuáles son esas paletas. Falta: la lista de valores posibles de `--cs`.
5. Override en `html.dark`: cada `--sp-doc-*` se aclara a
   `color-mix(in srgb, var(--sp-doc-X) 45%, #fff)`, el mismo 45% que el sistema usa para
   `--sp-primary-text` en oscuro.

### 3.D.4 · Comportamiento por montaje

| Montaje | Comportamiento |
|---|---|
| **A** — página | Barra siempre desplegada, 152px. Hay espacio de sobra |
| **C** — standalone | Igual que A, debajo del selector de paciente |
| **B** — overlay | **Colapsa tras elegir.** Ver abajo |

**Colapso en el overlay** — cuesta 152px sobre un presupuesto de 605px:

- Al abrir el overlay sin tipo elegido: la barra 3×3 completa, 152px.
- Al elegir un tipo: la barra se colapsa a **una fila de 44px** que muestra solo el tile
  seleccionado, ancho completo, con un `ChevronDown` 18px a la derecha. Animación 240ms
  (`--sp-dur-base`, `--sp-ease-inout`).
- Pulsar esa fila **vuelve a desplegar la misma matriz 3×3**, en las mismas posiciones.
  Elegir otro tipo la vuelve a colapsar.
- El tile colapsado conserva el color del tipo: es la única pista de "en qué documento
  estoy" cuando la barra no se ve.

Esto conserva la memoria espacial —la matriz es siempre la misma— y devuelve 108px al
peor caso vertical. **[CAMBIA EL FLUJO]**: hoy la barra está siempre visible en el
overlay. Justificación: 152px sobre 605px es el 25% del alto útil dedicado a un control
que se usa una vez por documento.

### 3.D.5 · Accesibilidad de la barra

- Contenedor `role="tablist"`, `aria-label="Tipo de documento"`.
- Cada tile `role="tab"`, `aria-selected`, `aria-controls` al panel del formulario.
- Navegación con flechas: ← → dentro de la fila, ↑ ↓ entre filas (es una rejilla, las
  cuatro flechas deben funcionar). `Home` / `End` van al primero / último.
- El formulario `role="tabpanel"`, `tabindex="-1"`, y recibe el foco al cambiar de tipo
  (G-10).

---

## 4 · Inventario de todo lo nuevo en CSS

Nada de esto es un componente nuevo de React. Son clases en `globals.css`, dentro de
`@layer components`, con prefijo `sp-doc-` para que sea evidente que son del dominio
documentos y no del sistema general.

| Clase | Qué es | §  |
|---|---|---|
| `.sp-doc-form` | Contenedor con `container-type: inline-size` | 3.C.2 |
| `.sp-doc-grid` + `[data-cols]` | Rejilla de campos por contenedor | 3.C.3 |
| `.sp-doc-span-2`, `.sp-doc-span-all` | Ocupación | 3.C.3 |
| `.sp-doc-itemrow` | Fila de ítem con columnas fijas | 3.C.3 |
| `.sp-doc-actions` | Barra de acciones sticky en los tres montajes | 3.A.7 |
| `.sp-doc-segmented` | Control segmentado (tipo de documento, divisa) | 3.A.4b |
| `.sp-doc-typebar` + `.sp-doc-tile` | Barra de tipos 3×3 | 3.D.2 |

Todo lo demás sale del sistema tal cual: `.sp-card`, `.sp-card-inner`, `.sp-row`,
`.sp-input`, `.sp-textarea`, `.sp-btn` (+ `--primary`, `--primary-block`, `--secondary`,
`--tertiary`, `--compact`, `--ghost`), `.sp-chip`, `.sp-badge` (+ `--warn`, `--deferred`),
`.sp-banner` (+ `--warn`, `--danger`, `--info`), `.sp-check`, `.sp-icobox`, `.sp-spinner`,
`.sp-label`, `.sp-label-field`, `.sp-title-sec`, `.sp-title-card`, `.sp-title-modal`,
`.sp-sub-modal`, `.sp-body`, `.sp-hint`, `.sp-secondary`, `.sp-link-alt`,
`.sp-push-forward`, `.sp-push-backward`, `.sp-grid-actions`.

Componentes de React nuevos: **tres**, todos genéricos y compartidos por los 8.

| Componente | Responsabilidad |
|---|---|
| `SelectorPlantilla` | §1.a + §1.b. Props: `tipoDocumento`, `getContenido()`, `aplicar(c)`, `esVacio()` |
| `PanelPlantillas` | §1.c. Props: `tipoDocumento`, `getContenido()`, `esVacio()`, `onVolver()` |
| `BarraTiposDocumento` | §3.D. Props: `activo`, `onChange`, `colapsable` |

`ModalDocumentoGenerado` se extiende, no se duplica.

---

## 5 · Trazabilidad: los 57 hallazgos

| Hallazgos | Dónde se resuelven |
|---|---|
| G-01 | §3.B |
| G-02, G-03 | §3.A.8 |
| G-04 | §3.A.1 (44px), §3.A.4 (botones de icono) |
| G-05 | §3.A.5 |
| G-06 | §3.A.7 |
| **G-07** | **Ya resuelto en 3 de 8** — §0.2. §3.A.8 solo lo propaga a los 5 restantes |
| G-08, G-09, G-10 | §3.A.8 |
| R-01 | §3.A.5 (tabla de obligatorios) |
| R-02, R-03 | §3.C.5, §3.A.1 (portal del autocomplete) |
| R-04 | §3.A.4 |
| R-05 | §3.A.10 — **NO DEFINIDO** |
| R-06 (`any`) | Fuera de alcance de diseño; corregir al tocar el archivo |
| L-01 | §3.A.4 |
| L-02 | §3.A.4 |
| L-03 | §3.A.1 (portal) |
| I-01, I-04, I-05 | §3.A.4. **I-01 ya está resuelto** — `removeEstudio` existe; solo queda el tamaño del control |
| I-02, I-03 | §3.C.5 |
| S-01 | §3.C.3 — cerrado por construcción |
| S-02 | §3.A.3 |
| S-03 | §3.A.1 |
| S-04 | §3.A.10 — **NO DEFINIDO** |
| S-05 | §2.4 (sin `pacienteId` no se anexa, en los 8 igual) |
| H-01 | §1.0.1 — el concepto de clínica desaparece del modelo |
| H-02 | §3.C.3 |
| H-03 | §1.a, §1.b |
| H-04 | §3.A.8 |
| H-05 | §3.A.8 — **NO DEFINIDO** |
| H-06 | §3.A.7 |
| N-01 | §3.C.5 |
| N-02 | §3.A.3 |
| N-03, N-04 | §3.A.2, §3.A.1 |
| E-01, E-02, E-05 | §3.A.1 (44px) + **NO DEFINIDO**: la barra de 14 controles a 326px sigue sin caber con objetivos de 44px. Falta decidir qué 6 controles son de primer nivel y cuáles pasan a un menú "Más" |
| E-03 | §3.A.3 + §3.D.4 (colapso de barra) devuelven ≈108px; `min-h-[380px]` baja a `min-h-[240px]` en contenedor MD |
| E-04 (`<style>` global) | Fuera de alcance de diseño; mover a CSS module al tocar |
| C-01 | §3.C.5 + §3.A.10 |
| C-02 | §3.A.3 |
| C-03 | §3.A.5 |
| C-04 | §3.A.10 — **NO DEFINIDO** |
| C-05 | §3.A.5 (tabla de obligatorios) |
| C-06, C-07 | §3.B.2 |
| V-01, V-02 | §3.C.3 — cerrados por `minmax(0, 1fr)`, no hace falta verificarlos |
| V-03 | §3.A.1 (portal) |
| V-04 | §3.A.4 (44px) |
| V-05 (`85vh` en Safari) | **NO DEFINIDO.** Recomendación: `height: min(85vh, 85dvh)`. Falta verificar en dispositivo |

---

## 6 · Lo que esta propuesta no cubre

- **Los 8 renderizadores de PDF.** Nada de aquí los toca, salvo la declaración de §3.B.3
  de que el acento del PDF sigue siendo el del médico.
- **El modo offline.** `entregar: !!offlineMode` se menciona en §2.5 y nada más.
- **`DiagnosticosEditor.tsx` y `TipTapViewer.tsx`**, que están en el directorio pero no
  son de los ocho.
- **El texto clínico** de las plantillas precargadas (instrucciones de ingreso,
  7 secciones de consentimiento). Se conserva literal.
- **Los mensajes del correo** de §2.3. Copy legal, no se inventa.

