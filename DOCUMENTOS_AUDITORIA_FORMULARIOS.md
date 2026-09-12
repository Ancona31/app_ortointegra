# Auditoría de los 8 formularios de documentos

**Fecha:** 2026-08-06 · **Rama:** `feature/documentos-v2` · **Commit base:** `8deda48`
**Alcance:** solo lectura. Ningún archivo modificado. Este documento es un
inventario, no una propuesta de rediseño.

---

## 0 · Cómo leer este documento

### 0.1 Los dos puntos de montaje (y un tercero que existe)

| Montaje | Archivo | Contenedor |
|---|---|---|
| **A — Página** | `src/app/(app)/expediente/[id]/documentos/page.tsx:97-104` | `max-w-4xl mx-auto` dentro de `(app)/layout.tsx:48-49` |
| **B — Overlay** | `src/app/(app)/expediente/[id]/nueva-nota/page.tsx:1972-1995` | panel `max-w-3xl`, altura fija `85vh`, portal a `body` |
| **C — Standalone** | `src/app/(app)/documentos/page.tsx:232-264` | igual que A, pero con selector de paciente arriba |

El montaje C **no estaba en el encargo** pero monta los mismos 8 componentes con
las mismas props que A. Todo lo dicho para A aplica a C. Lo menciono porque
cualquier corrección hecha "en la página" toca dos rutas, no una.

### 0.2 Anchos reales de contenido (calculados, no medidos)

Derivados de las clases de contenedor. Son aritmética de CSS estático, no
renderizado; los doy porque sin ellos no se puede razonar sobre las rejillas.

**Montaje A** — `main flex-1 lg:ml-64` + `px-4 lg:px-8` + `max-w-4xl`:

| Viewport | Sidebar | Ancho de contenido |
|---|---|---|
| 390 (móvil) | oculto | **358 px** |
| 820 (tablet vertical) | oculto | **788 px** |
| 1180 (tablet horizontal) | 256 px | **860 px** |
| 1440 (escritorio) | 256 px | **896 px** (tope `max-w-4xl`) |

**Montaje B** — `fixed inset-0 p-4 sm:p-8` → panel `max-w-3xl` → contenido `p-4 sm:p-6`:

| Viewport | Panel | Ancho de contenido | Alto útil de scroll* |
|---|---|---|---|
| 390 | 358 | **326 px** | ≈ 625 px |
| 820 | 756 | **708 px** | ≈ 911 px |
| 1180 | 768 | **720 px** | ≈ 605 px |
| 1440 | 768 | **720 px** | ≈ 620 px |

\* `85vh` menos el header de dos filas del overlay (`nueva-nota/page.tsx:1922-1963`,
≈ 92 px). Alturas de viewport asumidas: 844 / 1180 / 820 / 900.

**Consecuencia que gobierna casi todo lo demás:** en tablet horizontal el overlay
es **140 px más estrecho** que la página, y su alto útil es el **más pequeño de
las cuatro combinaciones** (605 px). El iPad en horizontal, dentro del overlay,
es el peor caso de los ocho anchos posibles. No es el caso que uno esperaría.

### 0.3 La trampa de los breakpoints

Los breakpoints de Tailwind (`sm:` 640, `lg:` 1024) miden el **viewport**, no el
contenedor. El panel del overlay está topado en 768 px. Por tanto:

- A 1180 y 1440, `lg:grid-cols-4` (`PlanSuplementacionForm.tsx:411`) y
  `lg:grid-cols-3` (`ConsentimientoInformadoForm.tsx:314`) **se activan dentro de
  un contenedor de 720 px**, porque el viewport cumple el umbral aunque el
  contenedor no haya crecido.
- Es el mismo mecanismo en los dos formularios y no ocurre en el montaje A, donde
  el contenedor sí crece con el viewport.

Esto no es deducible mirando un formulario aislado. Es la causa raíz de los dos
hallazgos que más impactan al iPad en horizontal.

### 0.4 Sobre las etiquetas

- **IMPIDE LLENAR** — solo lo que verifiqué en código con certeza y bloquea
  completar o emitir el documento. Son pocos. No inflé la categoría.
- **INCÓMODO** — todo lo demás.
- **⚠️ POR VERIFICAR** — hipótesis con mecanismo identificado que **no puedo
  confirmar sin renderizar**. Están separadas en §6 con mi predicción explícita.
  Ninguna está en la tabla principal como IMPIDE LLENAR.

---

## 1 · Resumen — los 5 hallazgos que más pesan

### 1 · La rejilla de conceptos de Honorarios tiene columnas en píxeles fijos

`NotaHonorariosForm.tsx:632` y `:643` — `grid-cols-[1fr_140px_36px] gap-2`. Sin
variante responsive en ningún breakpoint. A 390 px dentro del overlay, la columna
`1fr` recibe **94 px calculados** (326 − 40 de padding de card − 140 − 36 − 16 de
gaps). Es la única rejilla de los 8 formularios que no se adapta, y es
precisamente la de la tabla de ítems, que es donde el encargo anticipaba el
fallo. Ver también **⚠️ V-01**: hay motivo para pensar que además desborda.

### 2 · "Guardar como plantilla" está muerto en los tres montajes

`NotaHonorariosForm.tsx:102-109` — `resolvedClinicaId` cae a un bloque
`try/catch` que **retorna `null` incondicionalmente** (el comentario en `:107` lo
admite: "secureStorage cifra — no podemos leer directo. Fallback: null"). El
único otro origen es la prop `clinicaId`, y **ninguno de los tres puntos de
montaje la pasa** (A `:104`, B `:1994`, C `:260-263`). Por tanto `:219` siempre
falla y el médico recibe *"No se pudo determinar tu usuario o clínica"* cada vez.
La carga de plantillas sí funciona (`:152-167`, va por RLS sin filtro), así que
el desperfecto es asimétrico: se leen plantillas que ya no se pueden crear.

Esto importa doble porque el encargo pide llevar plantillas a los otros 7
formularios: **el único precedente que existe está roto**.

### 3 · Dos paradigmas de validación incompatibles conviviendo

Siete formularios deshabilitan el botón (`disabled={!paciente || ...}`) y **no
dicen qué falta**. Consentimiento hace lo contrario: deja el botón vivo y al
pulsarlo lanza un toast con la lista de campos faltantes
(`ConsentimientoInformadoForm.tsx:156-170`). El médico que aprendió un modelo se
encuentra el otro sin aviso. Y en los siete del primer grupo, un botón gris sin
explicación es indistinguible de un botón roto.

Agrava: en el montaje A el botón **no es sticky** (`globals.css:747` scopa
`position:sticky` a `.doc-modal-scroll`, que solo existe en el overlay), así que
en Consentimiento hay que recorrer ~2.400 px de scroll para descubrir que el
botón está gris.

### 4 · Objetivos táctiles de 14–15 px en los controles de borrar

`RecetaForm.tsx:455` y `SolicitudLabForm.tsx:258` — `<button className="text-red-400
hover:text-red-600"><Trash2 size={14} /></button>`. Sin padding, sin ancho: el
área activa es el propio icono, **14 × 14 px**. Internamiento (`:324`) usa 15 px.
Honorarios (`:664`) es el único decente con `w-9 h-9` (36 px) y aun así queda
bajo el mínimo de 44 pt. En un iPad con el dedo, borrar un medicamento es una
operación de puntería.

Ninguno de los ~90 campos de texto de los 8 formularios alcanza 44 pt tampoco:
todos son `px-3 py-2 text-sm` ≈ 38 px de alto.

### 5 · Cero adopción del sistema de diseño

**0 ocurrencias** de clases `sp-*` o `var(--sp-*)` en los 8 formularios
(verificado por grep sobre `src/components/documentos/*Form.tsx`). **74
ocurrencias de hex hardcodeado.** El único componente del directorio que sí usa
tokens es `ModalDocumentoGenerado.tsx` (15 ocurrencias), que es el más reciente.

| Archivo | Hex hardcodeados | `sp-*` |
|---|---|---|
| `NotaHonorariosForm.tsx` | 30 | 0 |
| `RecetaForm.tsx` | 19 | 0 |
| `PlanSuplementacionForm.tsx` | 15 | 0 |
| `SolicitudInternamientoForm.tsx` | 13 | 0 |
| `SolicitudLabForm.tsx` | 11 | 0 |
| `SolicitudImagenForm.tsx` | 11 | 0 |
| `ConsentimientoInformadoForm.tsx` | 10 | 0 |
| `EscritoMedicoForm.tsx` | 5 | 0 |
| — `ModalDocumentoGenerado.tsx` | 0 | **15** |

Los ocho son anteriores al sistema de tokens y ninguno se migró.

---

## 2 · Tabla de hallazgos

Orden: por formulario. `G-` = global / transversal.

| id | Formulario | Ancho afectado | Severidad | Descripción | Archivo:línea |
|---|---|---|---|---|---|
| **G-01** | Los 8 | todos | INCÓMODO | Cero uso de `sp-*` / `--sp-*`; 74 hex hardcodeados. Ver desglose en §1.5 y §7.1 | `*Form.tsx` |
| **G-02** | Los 8 | todos | INCÓMODO | Ninguna `<label>` de campo de texto tiene `htmlFor` ni envuelve su input → ninguna asociación label↔campo. ~90 campos afectados | p. ej. `RecetaForm.tsx:427`, `:432`, `:437` |
| **G-03** | Los 8 | todos | INCÓMODO | 0 ocurrencias de `aria-label`, `role` o `tabIndex` en los 8 formularios y en los 2 autocompletes. Los botones de borrar son icon-only y sin nombre accesible | `*Form.tsx`, `Autocomplete*.tsx` |
| **G-04** | Los 8 | todos | INCÓMODO | Ningún campo alcanza 44 pt de alto (`px-3 py-2 text-sm` ≈ 38 px). Solo el botón de imprimir (`py-3` ≈ 48 px) cumple | todos |
| **G-05** | 7 de 8 | todos | INCÓMODO | Botón deshabilitado sin explicar qué falta. Consentimiento usa el patrón contrario | ver §7.4 |
| **G-06** | Los 8 | montaje A/C | INCÓMODO | El botón de imprimir solo es sticky dentro del overlay: `.doc-modal-scroll .doc-print-btn`. En la página queda al final del flujo | `globals.css:747-752` |
| **G-07** | Los 8 | todos | INCÓMODO | `useMedicoInfo()` expone `isLoading` y **ningún formulario lo consume**. El botón de imprimir está activo antes de que resuelva el perfil → PDF con encabezado vacío si se pulsa rápido | `useMedicoInfo.ts:44`; p. ej. `RecetaForm.tsx:141` |
| **G-08** | Los 8 | montaje B | INCÓMODO | El overlay no tiene manejador de `Escape` ni bloqueo de scroll del `body`. Solo cierra por backdrop (`:1916`) o por la X (`:1935`). Detrás sigue desplazándose con el dedo | `nueva-nota/page.tsx:1912-1917` |
| **G-09** | Los 8 | montaje B | INCÓMODO | El contenedor de scroll lleva `overflow-x-hidden`: lo que exceda 720/326 px se **recorta sin scroll horizontal** para recuperarlo | `nueva-nota/page.tsx:1966` |
| **G-10** | Los 8 | todos | INCÓMODO | Sin foco automático al abrir. En el overlay, tras cambiar de tipo de documento (`:1953`) el foco queda en el icono de la barra, no en el primer campo | `nueva-nota/page.tsx:1951-1958` |
| **R-01** | Receta | — | INCÓMODO | Emite receta **sin ningún medicamento**: `disabled` solo comprueba `paciente`, y `medsData` filtra por `nombre_comercial` pudiendo quedar vacío | `RecetaForm.tsx:559`, `:294` |
| **R-02** | Receta | 390 | INCÓMODO | En `grid-cols-2` móvil, `sm:col-span-2` no aplica: "Nombre comercial" cae a **157 px** (montaje A) / **143 px** (montaje B). Es el campo con autocomplete | `RecetaForm.tsx:460-469` |
| **R-03** | Receta | 390 | INCÓMODO | El desplegable del autocomplete hereda `left-0 right-0` del contenedor → 143-157 px de ancho para dos líneas de texto (nombre · presentación / principio — dosis) | `AutocompleteMedicamento.tsx:79-90` |
| **R-04** | Receta | todos | INCÓMODO | Botón de borrar medicamento de 14 × 14 px sin padding | `RecetaForm.tsx:455-457` |
| **R-05** | Receta | todos | INCÓMODO | El `<select>` de recomendaciones predeterminadas tiene 9 opciones con emoji y **inserta acumulando** (`prev + '\n\n' + bloque`). No hay forma de quitar un bloque insertado por error salvo editar a mano el textarea | `RecetaForm.tsx:524-541` |
| **R-06** | Receta | todos | INCÓMODO | `updateMed(i, 'via_administracion' as any, ...)` — `any` explícito, prohibido por `CLAUDE.md` | `RecetaForm.tsx:477` |
| **L-01** | Lab | todos | INCÓMODO | Los chips de "Estudios frecuentes" y la lista manual son **dos estados no sincronizados en un sentido**: `togglePreset` mete/saca del array, pero editar la fila manual a mano deja el chip sin reflejar | `SolicitudLabForm.tsx:80-83` |
| **L-02** | Lab | todos | INCÓMODO | Botón de borrar estudio de 14 × 14 px sin padding | `SolicitudLabForm.tsx:258` |
| **L-03** | Lab | 390/todos | INCÓMODO | El desplegable de `AutocompleteEstudio` es `absolute` dentro del contenedor con `overflow-y-auto`: en la última fila queda por debajo del borde visible del panel | `AutocompleteEstudio.tsx:87` + `nueva-nota/page.tsx:1966` |
| **I-01** | Imagen | todos | INCÓMODO | **No existe forma de eliminar un estudio.** Hay `addEstudio` (`:66`) y no hay `removeEstudio`. Una fila añadida por error es permanente hasta desmontar el formulario | `SolicitudImagenForm.tsx:66`, `:219-253` |
| **I-02** | Imagen | 390 | INCÓMODO | Rejilla `grid-cols-2 sm:grid-cols-4`: en móvil, "Tipo de estudio" y "Región anatómica" pierden su `sm:col-span-2` y caen a media columna cada uno | `SolicitudImagenForm.tsx:226-239` |
| **I-03** | Imagen | 390 | INCÓMODO | "Proyecciones" ocupa 1 columna y "Indicación clínica" 3 (`sm:col-span-3` inactivo en móvil → 2 de 2): la fila queda desalineada respecto a la anterior | `SolicitudImagenForm.tsx:240-249` |
| **I-04** | Imagen | todos | INCÓMODO | Usa `<datalist>` (`:229-233`) donde Lab usa un autocomplete propio. Comportamiento y aspecto distintos en el mismo gesto | `SolicitudImagenForm.tsx:229` vs `SolicitudLabForm.tsx:253` |
| **I-05** | Imagen | todos | INCÓMODO | "+ Agregar" es texto plano sin icono, a diferencia de los otros cuatro formularios con listas | `SolicitudImagenForm.tsx:222` |
| **S-01** | Suplementación | 1180/1440 | INCÓMODO | `lg:grid-cols-4` se activa por viewport dentro del panel de 720 px del overlay → 4 columnas de **158 px**, una de ellas un `input type="date"`. Ver **⚠️ V-02** | `PlanSuplementacionForm.tsx:411` |
| **S-02** | Suplementación | todos | INCÓMODO | Los 9 botones de suplemento incluyen el `beneficio_clinico` completo (3-4 líneas). La rejilla de selección mide ~1.100 px de alto antes de elegir nada | `PlanSuplementacionForm.tsx:453-476` |
| **S-03** | Suplementación | todos | INCÓMODO | Los inputs de "Personalizar dosis" usan `py-1.5` mientras el resto del formulario usa `py-2` — dos alturas de campo en la misma pantalla | `PlanSuplementacionForm.tsx:498`, `:508` vs `:403` |
| **S-04** | Suplementación | todos | INCÓMODO | "Recalcular dosis" solo aparece si ya hay peso **y** hay selección (`:444`). Cambiar el peso después de seleccionar no recalcula solo; hay que descubrir el botón | `PlanSuplementacionForm.tsx:444-451` |
| **S-05** | Suplementación | todos | INCÓMODO | Es el único formulario que **no inserta fila** cuando no hay `pacienteId` (`:355`). Desde los montajes A/B/C siempre lo hay, pero la asimetría existe en el código | `PlanSuplementacionForm.tsx:354-383` |
| **H-01** | Honorarios | todos | **IMPIDE LLENAR** | "Guardar como plantilla" falla siempre: `resolvedClinicaId` es `null` por construcción y ningún montaje pasa `clinicaId`. Impide guardar la plantilla, no emitir el documento | `NotaHonorariosForm.tsx:102-109`, `:219-222` |
| **H-02** | Honorarios | 390 (y 820 en overlay) | INCÓMODO | `grid-cols-[1fr_140px_36px]` sin variante responsive. Columna de concepto ≈ **94 px** a 390 en overlay, ≈ 126 px a 390 en página. Ver **⚠️ V-01** | `NotaHonorariosForm.tsx:632`, `:643` |
| **H-03** | Honorarios | 390 | INCÓMODO | La fila de "Guardar como plantilla" abierta (`:771`) es `flex items-center gap-2` **sin stack en móvil**: input + botón Guardar + botón Cancelar compartiendo 326 px | `NotaHonorariosForm.tsx:770-797` |
| **H-04** | Honorarios | todos | INCÓMODO | El modal de confirmación va a `z-[10000]`, por encima de los toasts (`z-[9999]`) y de la alerta de sin conexión. Es el último elemento de los formularios que rompe la política de capas fijada en `nueva-nota/page.tsx:1896-1911` | `NotaHonorariosForm.tsx:803` |
| **H-05** | Honorarios | todos | INCÓMODO | El folio se genera una vez al montar (`:118`) con `hh:mm:ss` como secuencia. Dos documentos emitidos en el mismo segundo desde dos pestañas colisionan | `NotaHonorariosForm.tsx:41-47` |
| **H-06** | Honorarios | todos | INCÓMODO | Es el único formulario cuyo botón primario **no es `w-full`** (usa `flex-1` junto al secundario) | `NotaHonorariosForm.tsx:750-760` |
| **N-01** | Internamiento | 820/1180/1440 | INCÓMODO | Rejilla `sm:grid-cols-3` con 6 campos y luego dos bloques a ancho completo fuera de la rejilla (`:284`, `:296`): "Hospital" (obligatorio) queda visualmente separado de los otros obligatorios | `SolicitudInternamientoForm.tsx:252-299` |
| **N-02** | Internamiento | todos | INCÓMODO | Dos textareas precargadas de `rows={7}` y `rows={8}` (`:379`, `:392`) al final. Suman ≈ 500 px que casi siempre se dejan sin tocar y que empujan el botón fuera de pantalla | `SolicitudInternamientoForm.tsx:371-395` |
| **N-03** | Internamiento | todos | INCÓMODO | Es el único formulario con cards de color (ámbar `:371`, azul `:384`) y con emoji como icono (`📋`, `🏥`). Nadie más usa ninguna de las dos cosas | `SolicitudInternamientoForm.tsx:371-395` |
| **N-04** | Internamiento | todos | INCÓMODO | Los dos textareas de color redefinen la clase inline y **no usan** `inputCls` (`:244`): distinto foco, distinto borde | `SolicitudInternamientoForm.tsx:380`, `:394` |
| **E-01** | Escrito | 390 | INCÓMODO | La barra del editor tiene 14 controles en `flex-wrap`. A 326 px se reparte en 3-4 filas y consume ~110 px antes de la primera letra | `EscritoMedicoForm.tsx:352-384` |
| **E-02** | Escrito | todos | INCÓMODO | Botones de la barra a `p-1.5` + icono 14 → área activa ≈ 26 px. Catorce de ellos | `EscritoMedicoForm.tsx:278-280` |
| **E-03** | Escrito | 1180 (overlay) | INCÓMODO | El área de escritura fija `min-h-[380px]` (`:127`). Con la barra (~110 px en estrecho, ~40 px en ancho) y el header, en el overlay a 1180 el editor ocupa **el 70-80 % del alto útil de 605 px** | `EscritoMedicoForm.tsx:127` |
| **E-04** | Escrito | todos | INCÓMODO | Inyecta un `<style>` sin scope de componente en cada montaje (`:288-327`). Es el único formulario que lo hace | `EscritoMedicoForm.tsx:288` |
| **E-05** | Escrito | todos | INCÓMODO | El `<select>` de tamaño de bloque usa `text-xs` + `px-2 py-1` — el control más pequeño de los ocho formularios | `EscritoMedicoForm.tsx:354-360` |
| **C-01** | Consentimiento | 1180/1440 | INCÓMODO | `lg:grid-cols-3` se activa por viewport dentro del panel de 720 px → 3 columnas de **216 px** para 15 campos de nombre completo e identificación oficial | `ConsentimientoInformadoForm.tsx:314` |
| **C-02** | Consentimiento | todos | INCÓMODO | Las 7 secciones abren **todas desplegadas** (`useState(true)`, `:56`), 5 filas de textarea cada una. El formulario mide ≈ 2.400 px antes de escribir nada | `ConsentimientoInformadoForm.tsx:56`, `:414-422` |
| **C-03** | Consentimiento | todos | INCÓMODO | Único formulario que valida al pulsar con toast en lugar de deshabilitar (`:156-170`), y el toast enumera hasta 9 campos en una sola línea | `ConsentimientoInformadoForm.tsx:156-170` |
| **C-04** | Consentimiento | todos | INCÓMODO | Pide "Edad del paciente" y "No. Expediente" a mano (`:328`, `:332`) teniendo ambos disponibles: la página ya hace `select` de `fecha_nacimiento` y `numero_expediente` | `ConsentimientoInformadoForm.tsx:328`, `:332` vs `documentos/page.tsx:56` |
| **C-05** | Consentimiento | todos | INCÓMODO | `autorizaTransfusion` arranca en `null` y **no está en la lista de obligatorios** (`:156-166`): se puede emitir un consentimiento sin respuesta sobre transfusión | `ConsentimientoInformadoForm.tsx:135`, `:156` |
| **C-06** | Consentimiento | todos | INCÓMODO | El texto de ayuda de cada sección usa `text-slate-400` sobre blanco → contraste 2.8:1 | `ConsentimientoInformadoForm.tsx:77` |
| **C-07** | Consentimiento | todos | INCÓMODO | "(si aplica)" en `text-slate-300` → contraste 1.9:1, ilegible | `ConsentimientoInformadoForm.tsx:356`, `:364` |

---

## 3 · Ficha por formulario

Esqueleto idéntico en los ocho.

---

### 3.1 · RecetaForm

**Archivo:** `src/components/documentos/RecetaForm.tsx` · 576 líneas
**Props recibidas:** `pacienteInicial`, `diagnosticoInicial`, `pacienteId`, `medicamentosIniciales` (solo montaje B, `:1973`)

**Campos y agrupación (10 controles con 1 medicamento)**

| Bloque | Campos | Rejilla |
|---|---|---|
| Datos del paciente (`:423`) | fecha, paciente\*, diagnóstico | `grid-cols-1 sm:grid-cols-3` |
| Medicamentos (`:445`) | ×N: nombre comercial, presentación, vía, principio activo, indicaciones | `grid-cols-2 sm:grid-cols-3` |
| Recomendaciones (`:512`) | select de 9 plantillas + textarea `rows=6` | — |

**Orden:** sigue la consulta real. Paciente → fármaco → indicaciones al paciente.
Es de los mejor ordenados de los ocho.

**Siempre visible que podría plegarse:** el textarea de recomendaciones a
`rows={6}` (`:546`) ocupa ~150 px permanentes aunque el flujo típico sea insertar
un bloque predeterminado y no escribir nada.

**Camino más corto a emitir** (montado desde expediente, paciente y dx ya vienen):
escribir nombre comercial → 1 toque en la sugerencia del autocomplete → escribir
indicaciones → **Imprimir Receta** → **Visualizar** → **Cerrar**.
**4 toques + 2 campos de escritura.**

**Comportamiento responsive**

- **390:** la rejilla de medicamentos pasa a 2 columnas y `sm:col-span-2` deja de
  aplicar → "Nombre comercial" y "Presentación" quedan a 157 px (A) / 143 px (B).
  El desplegable del autocomplete hereda ese ancho (**R-02**, **R-03**).
- **820:** 3 columnas de ~244 px (A) / ~217 px (B). Cómodo.
- **1180:** A da 268 px por columna; B da 217 px. Cómodo en ambos.
- **1440:** 280 px (A) / 217 px (B). Cómodo.

**Lo específicamente roto:** emite sin medicamentos (**R-01**); borrar es un
objetivo de 14 px (**R-04**); las recomendaciones solo se acumulan (**R-05**).

**Lo que no encaja con lo que viene:** el catálogo de vías **ya está corregido**
(`:24` — sin `Parenteral`, con `Transdérmica`). Es el único ítem del §4 del
encargo que ya no hace falta tocar.

---

### 3.2 · SolicitudLabForm

**Archivo:** `src/components/documentos/SolicitudLabForm.tsx` · 290 líneas
**Props:** `pacienteInicial`, `diagnosticoInicial`, `pacienteId`

**Campos y agrupación (5 controles + 10 chips)**

| Bloque | Campos | Rejilla |
|---|---|---|
| Datos del paciente (`:218`) | fecha, paciente\*, diagnóstico | `grid-cols-1 sm:grid-cols-3` |
| Estudios frecuentes (`:231`) | 10 chips toggle | `flex-wrap` |
| Estudios solicitados (`:244`) | ×N autocomplete | fila `flex` |
| Notas (`:264`) | textarea `rows=2` | — |

**Orden:** correcto y corto. Es el formulario más ligero de los ocho.

**Siempre visible que podría plegarse:** nada relevante.

**Camino más corto:** 1 toque en un chip → **Imprimir Solicitud** → **Visualizar**
→ **Cerrar**. **4 toques, cero escritura.** Es el más rápido de los ocho.

**Comportamiento responsive**

- **390:** los chips en `flex-wrap` se reparten sin problema; la fila de estudio es
  `número + input flex-1 + papelera`, que a 326 px deja ~270 px de input. Bien.
- **820 / 1180 / 1440:** sin observaciones.

**Lo específicamente roto:** la doble fuente de verdad chips ↔ lista (**L-01**);
papelera de 14 px (**L-02**); el desplegable del autocomplete cae fuera del área
visible en la última fila dentro del overlay (**L-03**).

**Lo que no encaja con lo que viene:** no hay ningún hueco natural para el
selector de plantilla — el bloque de "Estudios frecuentes" ocupa exactamente la
posición donde en Honorarios está la plantilla.

---

### 3.3 · SolicitudImagenForm

**Archivo:** `src/components/documentos/SolicitudImagenForm.tsx` · 275 líneas
**Props:** `pacienteInicial`, `diagnosticoInicial`, `pacienteId`

**Campos y agrupación (8 controles con 1 estudio)**

| Bloque | Campos | Rejilla |
|---|---|---|
| Datos del paciente (`:203`) | fecha, paciente\*, diagnóstico + casilla URGENTE | `grid-cols-1 sm:grid-cols-3` + fila suelta |
| Estudios de imagen (`:219`) | ×N: tipo (datalist), región, proyecciones, indicación | `grid-cols-2 sm:grid-cols-4` |

**Orden:** correcto.

**Siempre visible que podría plegarse:** "Proyecciones" e "Indicación clínica
específica" son opcionales y ocupan una fila entera cada uno.

**Camino más corto:** escribir/elegir tipo → escribir región → **Imprimir
Solicitud** → **Visualizar** → **Cerrar**. **3 toques + 2 campos.**

**Comportamiento responsive**

- **390:** `sm:col-span-2` y `sm:col-span-3` dejan de aplicar. Tipo y Región caen a
  media columna (≈157/143 px) y la fila Proyecciones/Indicación queda 1+2 en una
  rejilla de 2 → desalineada (**I-02**, **I-03**).
- **820 / 1180 / 1440:** 4 columnas; en el overlay a 1180 son ~172 px por columna,
  estrechas para "Región anatómica" pero utilizables.

**Lo específicamente roto:** **no se puede eliminar un estudio** (**I-01**). Es el
único de los cinco formularios con listas que carece de la operación.

**Lo que no encaja con lo que viene:** usa `<datalist>` donde Lab usa autocomplete
propio (**I-04**); cualquier unificación futura obliga a elegir uno de los dos.

---

### 3.4 · PlanSuplementacionForm

**Archivo:** `src/components/documentos/PlanSuplementacionForm.tsx` · 569 líneas
**Props:** `pacienteInicial`, `diagnosticoInicial`, `pacienteId`

**Campos y agrupación (10 controles + 9 toggles)**

| Bloque | Campos | Rejilla |
|---|---|---|
| Datos del paciente (`:409`) | fecha, paciente\*, diagnóstico, peso | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` |
| Seleccionar suplementos (`:441`) | 9 botones toggle con texto clínico completo | `grid-cols-1 sm:grid-cols-2` |
| Personalizar dosis (`:480`) | ×seleccionado: dosis, justificación | `grid-cols-1 sm:grid-cols-2` |
| Notas y control (`:520`) | notas `rows=3`, cita de control | `grid-cols-1 sm:grid-cols-2` |

**Orden:** sigue el esquema de datos, no la consulta. El peso —que gobierna todo
el cálculo de dosis— está en la cuarta posición de la primera fila, después de
diagnóstico; conceptualmente pertenece antes de la selección.

**Siempre visible que podría plegarse:** los `beneficio_clinico` de los 9
suplementos (**S-02**). Son ~1.100 px de texto médico que se leen una vez.

**Camino más corto:** 1 toque en un suplemento → **Imprimir Plan** →
**Visualizar** → **Cerrar**. **4 toques.** (Sin peso, cae a la dosis por defecto.)

**Comportamiento responsive**

- **390:** todo a 1 columna. Largo pero sin conflictos.
- **820:** 2 columnas en datos y en selección. Correcto.
- **1180 / 1440:** `lg:grid-cols-4` se activa. En montaje A da 4 × 197 px
  (aceptable); **en el overlay da 4 × 158 px**, y una de esas columnas es
  `input type="date"` (**S-01**, ver **⚠️ V-02**).

**Lo específicamente roto:** la altura del bloque de selección (**S-02**); dos
alturas de input distintas en el mismo formulario (**S-03**); recálculo manual y
oculto (**S-04**).

**Lo que no encaja con lo que viene:** es el formulario donde el "selector de
plantilla" tiene más sentido clínico (protocolos de suplementación) y donde menos
espacio queda arriba.

---

### 3.5 · NotaHonorariosForm

**Archivo:** `src/components/documentos/NotaHonorariosForm.tsx` · 857 líneas — **el más grande**
**Props:** `pacienteInicial`, `pacienteId`, `userId?`, `clinicaId?` (**las dos últimas nunca se pasan**)

**Campos y agrupación (~16 controles con 1 línea)**

| Bloque | Campos | Rejilla |
|---|---|---|
| Plantilla (`:470`) | select + papelera | `flex` |
| Tipo de documento (`:505`) | 2 botones excluyentes | `flex` |
| Datos del documento (`:525`) | fecha, paciente, folio (readonly) | `grid-cols-1 sm:grid-cols-3` |
| Seguro de gastos médicos (`:551`) | toggle + (aseguradora, póliza, cobertura) | `grid-cols-1 sm:grid-cols-3` |
| Conceptos\* (`:627`) | ×N: concepto, precio, borrar + total | **`grid-cols-[1fr_140px_36px]`** |
| Pago (`:697`) | forma de pago, divisa | `grid-cols-1 sm:grid-cols-2` |
| Notas (`:731`) | textarea `rows=3` | — |

**Orden:** sigue el esquema de datos. El seguro de gastos médicos —plegado y poco
frecuente— se interpone entre los datos y los conceptos, que es lo que el médico
viene a llenar.

**Siempre visible que podría plegarse:** la card entera de "Plantilla" (`:470`)
mientras no haya plantillas guardadas — y hoy no puede haberlas (**H-01**).

**Camino más corto:** escribir concepto → escribir precio → **Imprimir Recibo** →
**Visualizar** → **Cerrar**. **3 toques + 2 campos.**

**Comportamiento responsive**

- **390:** la rejilla de conceptos no cambia. Columna de concepto ≈ 126 px (A) /
  **94 px (B)** (**H-02**, ver **⚠️ V-01**). La fila de guardar plantilla abierta
  no apila (**H-03**).
- **820:** columna de concepto ≈ 556 px (A) / 476 px (B). Cómodo.
- **1180 / 1440:** ≈ 628-664 px (A) / 488 px (B). Cómodo.

**Lo específicamente roto:** guardar plantilla **nunca funciona** (**H-01**);
folio colisionable (**H-05**); `z-[10000]` fuera de la política de capas
(**H-04**).

**Lo que no encaja con lo que viene:** es el **único precedente** de plantillas y
está roto. Cualquier extensión a los otros 7 debe partir de arreglarlo primero,
no de copiarlo.

---

### 3.6 · SolicitudInternamientoForm

**Archivo:** `src/components/documentos/SolicitudInternamientoForm.tsx` · 422 líneas
**Props:** `pacienteInicial`, `diagnosticoInicial`, `pacienteId`

**Campos y agrupación (~16 controles + 7 chips)**

| Bloque | Campos | Rejilla |
|---|---|---|
| Datos generales (`:250`) | fecha, paciente\*, fecha ingreso, tipo, días, ASA | `grid-cols-1 sm:grid-cols-3` |
| — fuera de la rejilla (`:284`, `:296`) | hospital\*, casilla URGENTE | ancho completo |
| Diagnósticos (`:303`) | principal\* + N secundarios | apilado |
| Procedimiento (`:336`) | textarea `rows=2` | — |
| Requerimientos (`:344`) | 7 chips + campo libre | `flex-wrap` |
| Justificación (`:363`) | textarea `rows=4` | — |
| Instrucciones al paciente (`:371`) | textarea `rows=7` **precargado** | card ámbar |
| Indicaciones de piso (`:384`) | textarea `rows=8` | card azul |

**Orden:** razonable hasta "Justificación". Los dos últimos bloques son los más
altos del formulario y los menos editados.

**Siempre visible que podría plegarse:** los dos textareas finales (**N-02**),
≈ 500 px combinados. El de instrucciones viene precargado con un texto de 6 viñetas
que casi nunca se modifica.

**Camino más corto:** escribir hospital → **Imprimir Solicitud de Internamiento**
→ **Visualizar** → **Cerrar** (paciente y dx vienen prellenados; ambos son
obligatorios en `disabled`, `:405`). **3 toques + 1 campo.**

**Comportamiento responsive**

- **390:** todo a 1 columna. El formulario supera los 2.000 px; en el overlay son
  más de 3 pantallas de scroll.
- **820 / 1180 / 1440:** 3 columnas en datos generales; hospital y URGENTE quedan
  a ancho completo debajo, separados visualmente del resto de obligatorios
  (**N-01**).

**Lo específicamente roto:** las dos cards de color y los emoji rompen el lenguaje
visual (**N-03**); sus textareas ignoran `inputCls` (**N-04**).

**Lo que no encaja con lo que viene:** es el formulario con más texto plantillable
(las instrucciones de ingreso) y ninguna infraestructura para plantillas.

---

### 3.7 · EscritoMedicoForm

**Archivo:** `src/components/documentos/EscritoMedicoForm.tsx` · 419 líneas
**Props:** `pacienteInicial`, `pacienteId` (**no recibe `diagnosticoInicial`** — A `:102`, B `:1988`)

**Campos y agrupación (3 campos + 14 controles de barra + editor)**

| Bloque | Campos | Rejilla |
|---|---|---|
| Datos del documento (`:330`) | fecha, paciente (opcional), asunto | `grid-cols-1 sm:grid-cols-3` |
| Editor (`:349`) | barra de 14 controles + área TipTap `min-h-380px` | `flex-wrap` |

**Orden:** correcto.

**Siempre visible que podría plegarse:** la barra completa; en móvil se convierte
en 3-4 filas (**E-01**).

**Camino más corto:** escribir el cuerpo → **Imprimir Escrito Médico** →
**Visualizar** → **Cerrar**. **3 toques + 1 campo.**

**Comportamiento responsive**

- **390:** barra en 3-4 filas ≈ 110 px (**E-01**); botones de 26 px (**E-02**).
- **820:** la barra cabe en 1-2 filas.
- **1180 (overlay):** el peor caso vertical de los ocho — barra + `min-h-[380px]`
  dentro de 605 px de alto útil (**E-03**).
- **1440:** sin observaciones.

**Lo específicamente roto:** `<style>` global inyectado por montaje (**E-04**);
el select más pequeño de los ocho (**E-05**).

**Lo que no encaja con lo que viene:** el encargo pide "título del Escrito
Médico". Hoy existe `asunto` (`:117`, `:343`), etiquetado *"Asunto / Tipo de
documento"*, y es lo que el PDF usa como encabezado. Un "título" separado es un
campo nuevo, no un renombrado — hay que decidir si conviven o si `asunto` pasa a
ser el título.

---

### 3.8 · ConsentimientoInformadoForm

**Archivo:** `src/components/documentos/ConsentimientoInformadoForm.tsx` · 464 líneas
**Props:** `pacienteInicial`, `pacienteId`, `diagnosticoInicial`

**Campos y agrupación (~25 controles — el más pesado)**

| Bloque | Campos | Rejilla |
|---|---|---|
| Datos de identificación (`:309`) | 15 campos: lugar\*, fecha\*, paciente\*, edad\*, expediente, ID paciente, procedimiento\*, dx\*, familiar\*, ID familiar, representante, ID representante, anestesiólogo, testigo 1, testigo 2 | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` |
| Autorizaciones (`:378`) | transfusión (sí/no), uso de fotos | `grid-cols-1 sm:grid-cols-2` |
| 7 secciones clínicas (`:414`) | textarea `rows=5` cada una, **todas abiertas** | apilado |
| Hoja de denegación (`:425`) | casilla | — |

**Orden:** sigue el documento legal, que es lo correcto aquí. El problema no es el
orden sino el volumen presentado de golpe.

**Siempre visible que podría plegarse:** las 5 secciones que vienen precargadas
con texto estándar (`:26-38`). Solo `descripcion` y `riesgosEspecificos` llegan
vacías y son obligatorias — y son la 4.ª y la 6.ª de siete (**C-02**).

**Camino más corto:** lugar → edad → procedimiento → familiar → sección 4 →
sección 6 → **Generar Consentimiento Informado** → **Visualizar** → **Cerrar**.
**3 toques + 6 campos**, y hay que localizar dos de esos campos entre ~2.400 px
de scroll. **El más caro de los ocho por margen amplio.**

**Comportamiento responsive**

- **390:** 1 columna, 15 campos apilados ≈ 1.000 px solo en identificación.
- **820:** 2 columnas de ~360 px (A) / ~320 px (B). Cómodo.
- **1180 / 1440:** `lg:grid-cols-3`. En A da ~264-278 px por columna; **en el
  overlay da 216 px** para campos como "Identificación del representante"
  (**C-01**).

**Lo específicamente roto:** validación por toast (**C-03**); pide edad y
expediente que ya están en la base (**C-04**); permite emitir sin respuesta de
transfusión (**C-05**); dos fallos de contraste (**C-06**, **C-07**).

**Lo que no encaja con lo que viene:** `expediente` es el **único** campo de los
ocho formularios que ya tiene la forma que pide el encargo (`numero_expediente`),
y está capturado a mano. Es el punto de partida natural para el cableado.

---

## 4 · Inconsistencias entre los 8

Los ocho hacen lo mismo con la misma forma. Cada diferencia de abajo es un
accidente de haberse escrito en momentos distintos, no una decisión.

### 4.1 · Sistema de diseño

| Aspecto | Estado |
|---|---|
| Clases `sp-*` | **0 en los 8** |
| `var(--sp-*)` | **0 en los 8** |
| Hex hardcodeados | **74** (desglose en §1.5) |
| Referencia que sí lo hace bien | `ModalDocumentoGenerado.tsx` — 15 usos de `sp-*`, 0 hex |

### 4.2 · La clase de input

Tres variantes conviviendo:

| Variante | Formularios | Diferencia observable |
|---|---|---|
| `inputCls` con `focus:border-[#1e5fa8]` | Suplementación `:403`, Honorarios `:464`, Internamiento `:244`, Escrito `:277`, Consentimiento `:303` | anillo **y** cambio de color de borde al enfocar |
| Clase inline **sin** `focus:border` | Receta (`:429`, `:434`, `:439`, `:473`, `:478`, `:485`, `:491`), Lab (`:222`, `:224`, `:226`, `:267`), Imagen (`:207`, `:209`, `:211`, `:230`, `:238`, `:243`, `:248`) | solo anillo |
| Excepciones **dentro** de un archivo que sí define `inputCls` | Suplementación `:498`, `:508`, `:528`, `:538`; Internamiento `:380`, `:394` | mezcla ambos en la misma pantalla |

Además, `AutocompleteMedicamento.tsx:76` también carece de `focus:border`,
mientras que `AutocompleteEstudio.tsx:83` sí lo tiene. Dos campos con autocomplete
en dos formularios hermanos, con foco distinto.

### 4.3 · Cabeceras de card

| Patrón | Dónde |
|---|---|
| `p-5` + `<h2 class="font-semibold text-slate-700 text-sm mb-4">` | Receta `:424`, Lab `:219`, Imagen `:204`, Suplementación `:410`, Honorarios `:526`, Internamiento `:251`, Escrito `:331` |
| Franja gris `px-5 py-3 bg-slate-50 border-b` | Receta `:446`, Lab `:245`, Imagen `:220`, Suplementación `:482`, Internamiento `:304` |
| Card de color con emoji | Internamiento `:371` (ámbar), `:384` (azul) |
| Cabecera-botón plegable con numeral | Consentimiento `:61-73` |

Cuatro lenguajes distintos para "esto es una sección".

### 4.4 · Añadir y quitar ítems de una lista

Cinco patrones para el mismo gesto:

| Formulario | Añadir | Posición | Quitar | Área activa |
|---|---|---|---|---|
| Receta `:502-507`, `:455` | `<Plus 14/> Agregar medicamento` | pie de la lista | Trash2 14, oculto si N=1 | **14 px** |
| Lab `:247`, `:258` | `<Plus 14/> Agregar` | cabecera de card | Trash2 14, oculto si N=1 | **14 px** |
| Imagen `:222` | `"+ Agregar"` texto plano | cabecera de card | **no existe** | — |
| Internamiento `:315`, `:324` | `<Plus 12/> Agregar` | encima de la lista | Trash2 15, oculto si N=1 | **15 px** |
| Honorarios `:680-685`, `:664` | `<Plus 14/> Agregar concepto` | pie de la lista | Trash2 15, **visible y `disabled`** si N=1 | 36 px |

Tres posiciones distintas para el botón de añadir, tres tamaños de icono, y dos
criterios opuestos para el botón de borrar cuando queda un solo elemento (ocultarlo
frente a deshabilitarlo).

Color de la papelera, además: `text-red-400 → red-600` (Receta, Lab) frente a
`text-slate-300 → red-400` (Internamiento, Honorarios). En dos formularios el
control de borrado es rojo en reposo y en dos es gris.

### 4.5 · Bloque de error

| Formulario | Elemento | Clases |
|---|---|---|
| Receta `:551-555` | `<p>` | `text-sm text-red-600 bg-red-50 border border-red-200 rounded-**lg** px-4 py-3` |
| Los otros 7 | `<div>` | `bg-red-50 border border-red-200 text-red-**700** px-4 py-3 rounded-**xl** text-sm` |

Distinto elemento, distinto tono de rojo, distinto radio. Receta es el impar.

### 4.6 · Validación y marcado de obligatorios

| Formulario | Marca `*` | Condición real de `disabled` | ¿Coinciden? |
|---|---|---|---|
| Receta | paciente | `!paciente` | sí (pero falta exigir medicamento — **R-01**) |
| Lab | paciente | `!paciente \|\| sin estudios` | **no** — el requisito de estudios no está marcado |
| Imagen | paciente | `!paciente \|\| sin estudio completo` | **no** — ídem |
| Suplementación | paciente | `!paciente \|\| sin selección` | **no** — ídem |
| Honorarios | Conceptos | `!puedeImprimir` (≥1 línea válida) | sí; **paciente no es obligatorio aquí** |
| Internamiento | paciente, hospital, dx principal | los tres | sí |
| Escrito | ninguno | `isEmpty` del editor | n/a — paciente marcado "(opcional)" |
| Consentimiento | 9 campos | `imprimiendo` únicamente → **toast al pulsar** | patrón opuesto al de los otros 7 |

Tres criterios distintos sobre si el nombre del paciente es obligatorio (sí en 6,
no en Honorarios, explícitamente opcional en Escrito) para documentos que todos
acaban en el mismo expediente.

### 4.7 · Texto y colocación del botón primario

| Formulario | Texto | Ancho |
|---|---|---|
| Receta | "Imprimir Receta" | `w-full` |
| Lab | **"Imprimir Solicitud"** | `w-full` |
| Imagen | **"Imprimir Solicitud"** | `w-full` |
| Suplementación | "Imprimir Plan de Suplementación" | `w-full` |
| Internamiento | "Imprimir Solicitud de Internamiento" | `w-full` |
| Escrito | "Imprimir Escrito Médico" | `w-full` |
| Consentimiento | **"Generar** Consentimiento Informado" | `w-full` |
| Honorarios | "Imprimir {Recibo de Honorarios \| Cotización}" | `flex-1` + secundario |

Lab e Imagen comparten literal idéntico. Consentimiento usa "Generar" donde los
otros siete usan "Imprimir". Honorarios es el único que no ocupa el ancho completo.

### 4.8 · Toasts de confirmación

`'Receta guardada'` · `'Solicitud guardada'` (Lab **e** Imagen, idénticos) ·
`'Plan guardado'` / `'Plan generado'` (bifurca por `pacienteId`) ·
`'Solicitud guardada'` (Internamiento — **tercer** uso del mismo literal) ·
`'Escrito guardado'` · `'Consentimiento guardado'` ·
`'Recibo guardado'` / `'Cotizacion guardado'` (concordancia de género incorrecta,
`NotaHonorariosForm.tsx:442-443`).

Tres documentos distintos producen el mismo mensaje "Solicitud guardada".

### 4.9 · Lo que sí es idéntico en los ocho

Para no dar la impresión contraria: la lógica de emisión está **muy bien
homogeneizada**. Los ocho siguen exactamente la misma secuencia —
`flushSync` → toast informativo → PDF primero → persistencia → `catch` que
distingue fallo-de-PDF de fallo-de-guardado → `finally` que monta
`ModalDocumentoGenerado`. Los ocho reciben `entregar: !!offlineMode`. Los ocho
tienen el mismo bloque `offlineProfile`/`medicoInfo` de ~25 líneas.

Esa duplicación (~25 líneas × 8) es deuda conocida, pero es duplicación
*consistente*: el comportamiento no diverge. El problema de este documento está en
la capa de presentación, no en la de emisión.

### 4.10 · Capas (z-index)

`nueva-nota/page.tsx:1896-1911` documenta con detalle por qué el overlay bajó de
`z-[9999]` a `z-50` y ordena no volver a subirlo. Dentro de esa política:

- `ModalDocumentoGenerado` → `ModalShell elevated` → `z-[60]`, portalado. Correcto.
- **`NotaHonorariosForm.tsx:803` → `z-[10000]`**, portalado. Queda por encima de
  los toasts (`z-[9999]`), de la alerta de sin conexión y de ⌘K — exactamente lo
  que esa nota vino a corregir. Es el último resto (**H-04**).

---

## 5 · Huecos frente a lo que viene

Para cada control que va a llegar: dónde cabría hoy y qué habría que mover.

### 5.1 · Selector de plantilla y "guardar como plantilla"

**Estado actual:** existe **solo** en Honorarios (`:470-502` el selector,
`:762-797` el guardado) y **el guardado no funciona en ningún montaje** (**H-01**).
La tabla `plantillas_honorarios` tiene `nombre` y `contenido` jsonb.

**Dónde cabría en los otros 7:** el patrón de Honorarios pone una card propia
*antes* de todo lo demás. Trasladándolo:

| Formulario | Qué ocupa hoy esa posición | Qué habría que mover |
|---|---|---|
| Receta | "Datos del paciente" | nada; entra encima |
| Lab | "Datos del paciente" | nada, pero compite conceptualmente con "Estudios frecuentes" (`:231`), que ya es un mecanismo de plantilla rudimentario |
| Imagen | "Datos del paciente" | nada; entra encima |
| Suplementación | "Datos del paciente" | nada; entra encima. Es donde más valor tiene |
| Internamiento | "Datos generales" | nada, pero el contenido plantillable real son los textareas del final (`:379`, `:392`) |
| Escrito | "Datos del documento" | nada; entra encima. Segundo mayor valor |
| Consentimiento | "Datos de identificación" | nada; entra encima. El contenido plantillable son las 7 secciones |

**Coste oculto:** la fila de guardado abierta de Honorarios (`:770-797`) no apila
en móvil (**H-03**). Replicarla tal cual multiplica ese defecto por ocho.
Y la card de plantilla añade ~90 px permanentes al principio de cada formulario,
justo donde el overlay tiene menos alto útil.

**Bloqueante:** arreglar `resolvedClinicaId` antes de replicar. Hoy no hay
precedente funcional que copiar.

### 5.2 · Casilla "anexar al expediente"

**Estado actual:** no existe control. El comportamiento está cableado:
- 7 formularios insertan en `documentos` siempre que haya `pacienteId`
  (p. ej. `RecetaForm.tsx:389`).
- Suplementación es el único que condiciona el insert entero a `pacienteId`
  (`:355`) — sin paciente ni siquiera lo intenta.

**Dónde cabría:** junto al botón de imprimir. Es el último gesto antes de emitir
y no debe quedar a 2.000 px de scroll del botón (Consentimiento, Internamiento).

**Qué habría que mover:** nada estructural, pero **cambia la semántica de
`ModalDocumentoGenerado`**. Hoy `guardadoEnExpediente={false}` significa
inequívocamente *"se intentó guardar y falló"*, y el modal lo comunica como
advertencia con `sp-banner--warn` (`ModalDocumentoGenerado.tsx:119-127`). Con una
casilla de opt-out ese mismo `false` puede significar *"no se guardó porque no
quisiste"*, que no es una advertencia. El modal necesita un tercer estado, no un
booleano.

### 5.3 · Campos por cablear

| Campo | Estado hoy | Dónde cabría | Qué falta además |
|---|---|---|---|
| `numero_expediente` | La página **ya lo consulta** (`documentos/page.tsx:56`) y **nunca lo usa**. Consentimiento lo pide a mano (`:332`, `:333`) | Card de datos de los 8 | Solo `ConsentimientoInformadoPdf.tsx:19` acepta `expediente`. Los otros 7 PDFs no tienen el campo |
| `sexo` | La página **ya lo consulta** (`:56`) y no lo pasa. **Receta lo re-consulta por su cuenta** (`RecetaForm.tsx:173-200`) | Derivado, no capturado | Solo `RecetaPdf.tsx:14`, `:528` lo renderiza. Los otros 7 PDFs no |
| `hora` | **No existe en ningún formulario.** Los ocho tienen solo `fecha` (`type="date"`) | Junto a fecha en la card de datos | Ningún PDF acepta `hora`. Cambia la rejilla de datos de 3 a 4 columnas en los 8 |
| Título del Escrito Médico | Existe `asunto` (`EscritoMedicoForm.tsx:117`, `:343`), etiquetado *"Asunto / Tipo de documento"*, y es lo que encabeza el PDF | — | Decisión pendiente: ¿título nuevo junto a asunto, o `asunto` renombrado? Afecta a `EscritoMedicoPdf.tsx` y a los documentos ya emitidos |
| `tituloPie` | **No existe en ningún formulario ni PDF** | Card de datos | Campo nuevo + prop nueva en los 8 renderizadores |
| Subtítulo de documento | **No existe.** `subtitulo` solo aparece en `HojaFrontalPdf.tsx:254` y se refiere a la *clínica*, no al documento | Card de datos | Campo nuevo + prop nueva en los 8 renderizadores |

**Observación transversal:** `documentos/page.tsx:56` ya trae
`fecha_nacimiento, sexo, numero_expediente` y solo usa el nombre y la fecha de
nacimiento (para el subtítulo del header, `:74`). Receta duplica esa consulta
porque no recibe los datos. Los otros 6 formularios **no consultan al paciente en
absoluto**: solo reciben `pacienteInicial` como cadena. Cablear estos campos
significa o bien pasar un objeto paciente por props a los 8, o bien replicar la
consulta de Receta seis veces más.

### 5.4 · Catálogo de vías corregido

**Ya está hecho.** `RecetaForm.tsx:24`:

```
['Oral', 'Tópica', 'Intramuscular', 'Intravenosa', 'Subcutánea', 'Sublingual',
 'Oftálmica', 'Ótica', 'Nasal', 'Inhalatoria', 'Rectal', 'Transdérmica']
```

No contiene `Parenteral` y sí contiene `Transdérmica`. Verificado por grep en todo
`src`: el literal `Parenteral` no aparece en ningún archivo, y `VIAS` existe solo
aquí. Los consumidores del campo (`RecetaPdf.tsx:584`, `app/r/[folio]/page.tsx:140`)
lo leen sin validar contra catálogo, así que las recetas históricas con
`Parenteral` en `contenido` seguirían mostrándolo — **pero no se pueden crear
nuevas**. Este ítem del encargo puede darse por cerrado salvo que se quiera además
migrar datos antiguos.

### 5.5 · Validación bloqueante por perfil incompleto

**Estado actual: no hay ninguna.** Los ocho degradan en silencio:
- Receta (`:296-301`) sustituye por `'Médico'` y `''`.
- Los otros siete construyen `medicoData` como `null` si no hay `medicoInfo`
  (p. ej. `SolicitudLabForm.tsx:114`), y `generarPdf` lo acepta.
- `universidad` solo se pasa en Receta (`:349`).

**Dónde cabría:** un guard al principio de `imprimir()` en los ocho, más un aviso
persistente encima del botón. La forma más barata sería una comprobación única,
pero eso es una abstracción nueva y el §4 de `CLAUDE.md` la prohíbe sin OK
explícito.

**Lo que hay que resolver antes:** **G-07**. `useMedicoInfo()` expone `isLoading`
y ningún formulario lo lee. Sin eso, una validación de perfil dispararía falsos
positivos durante la carga: el botón estaría activo con `medicoInfo === null` y el
guard rechazaría a un médico con el perfil completo.

### 5.6 · Receta: exigir al menos un medicamento

**Estado actual (confirmado):**
- `RecetaForm.tsx:559` — `disabled={!paciente || imprimiendo}`. No mira los medicamentos.
- `RecetaForm.tsx:294` — `medsData = medicamentos.filter(m => m.nombre_comercial)`,
  que puede quedar vacío y se pasa igual al PDF.

Receta es el **único** de los formularios con lista que no exige contenido: Lab
(`:276`), Imagen (`:261`) y Suplementación (`:551`) sí lo hacen. La corrección es
alinear la condición con la de sus tres hermanos.

**Efecto secundario a considerar:** en el montaje B, Receta puede llegar con
`medicamentosIniciales` desde la nota (`nueva-nota/page.tsx:1973`). Si la nota
traía medicamentos, la condición ya se cumple al montar; si no, el botón nacería
deshabilitado, que es un estado que hoy no ocurre en ese montaje.

---

## 6 · ⚠️ Pendiente de comprobar en navegador

Estas **no** están marcadas como IMPIDE LLENAR porque no las verifiqué
renderizando. Doy el mecanismo y mi predicción para que la comprobación sea rápida.

### V-01 · Desbordamiento de la rejilla de conceptos en Honorarios

**Dónde:** `NotaHonorariosForm.tsx:632`, `:643` — `grid-cols-[1fr_140px_36px]`.

**Mecanismo:** un `<input>` sin `size` tiene un ancho intrínseco mínimo de ~20
caracteres. En una pista `1fr` (`minmax(auto, 1fr)`), el mínimo automático se
resuelve por el tamaño min-content del ítem, y un `width:100%` porcentual no
definido no lo sustituye. Si ese mínimo ronda los 175 px, la fila pide
175 + 140 + 36 + 16 ≈ **367 px** dentro de un contenedor de 286 px (overlay a 390)
o 318 px (página a 390).

**Predicción:** la fila desborda a la derecha. En el **montaje B** el
`overflow-x-hidden` del contenedor de scroll (`nueva-nota/page.tsx:1966`) recorta
lo que sobra **sin dejar forma de desplazarse hasta ello** — es decir, el botón de
borrar de la columna de 36 px quedaría fuera de alcance. En el montaje A no hay
`overflow-x-hidden`, así que probablemente aparezca scroll horizontal o desborde
del card.

**Si se confirma en el montaje B, esto es IMPIDE LLENAR.** Es el candidato más
fuerte a corrección fuera de plazo. Comprobar a 390 px de ancho con el overlay
abierto en "Honorarios / Cotización".

### V-02 · `input type="date"` a 158 px en Suplementación

**Dónde:** `PlanSuplementacionForm.tsx:411` (`lg:grid-cols-4`) + `:414`.

**Mecanismo:** en el overlay a viewport ≥1024 la rejilla pasa a 4 columnas dentro
de un contenedor de 720 px → 158 px por columna. Los `input type="date"` nativos
tienen un ancho intrínseco mínimo que en Safari/iPadOS ronda los 150-190 px y no
se comprime por debajo de él.

**Predicción:** en iPad horizontal (1180), dentro del overlay, la fila de datos
del paciente desborda o el campo de fecha se recorta. En el montaje A a 1180 hay
197 px por columna y probablemente no ocurra.

**Comprobar:** iPad horizontal → nueva-nota → "Plan de suplementación".

### V-03 · Desplegables de autocomplete recortados en el overlay

**Dónde:** `AutocompleteMedicamento.tsx:79` y `AutocompleteEstudio.tsx:87`, ambos
`absolute z-50`, dentro de `nueva-nota/page.tsx:1966`
(`overflow-y-auto overflow-x-hidden`).

**Mecanismo:** un descendiente absoluto cuyo bloque contenedor está dentro del
scroller queda recortado por la caja de relleno de ese scroller. Contribuye al
overflow desplazable, así que se puede alcanzar desplazando — pero no es visible
en el momento de escribir.

**Predicción:** al escribir en el **último** medicamento o el **último** estudio de
la lista, la lista de sugerencias aparece cortada por el borde inferior del panel
y hay que desplazar para verla, momento en que se pierde de vista el campo.
INCÓMODO, no bloqueante. En el montaje A no debería ocurrir (no hay scroller
intermedio).

### V-04 · Objetivos táctiles de 14 px con el dedo

**Dónde:** `RecetaForm.tsx:455`, `SolicitudLabForm.tsx:258`,
`SolicitudInternamientoForm.tsx:324`.

**Mecanismo:** área activa = tamaño del icono, sin padding.

**Predicción:** alcanzable con lápiz o con puntería; frustrante con el dedo.
Lo dejo en INCÓMODO porque la operación es posible. Si en iPad resulta que no se
acierta de forma fiable, sube a IMPIDE LLENAR para Receta y Lab (no se puede
quitar un medicamento o un estudio equivocado).

### V-05 · Alto real del overlay en iPad horizontal

**Dónde:** `nueva-nota/page.tsx:1920` — `style={{ height: '85vh' }}`.

**Mecanismo:** `vh` en Safari iOS/iPadOS se mide contra el viewport grande, no el
pequeño; con barras de navegación visibles el panel puede exceder el área útil.

**Predicción:** en iPad horizontal (820 px de alto → panel de 697 px) el margen es
holgado y no debería haber recorte. Lo listo porque afecta a los 8 y porque
`Escrito Médico` (**E-03**) es el que menos margen tiene.

---

## 7 · Anexo — cómo verificar cada cifra

Todos los números de este documento salen de:

```
# adopción de tokens
grep -c "sp-" src/components/documentos/*.tsx
grep -rn "sp-btn\|sp-input\|sp-card\|var(--sp" src/components/documentos/*.tsx

# hex hardcodeados por archivo
for f in src/components/documentos/*Form.tsx; do
  printf "%-58s %s\n" "$(basename $f)" \
    "$(grep -o '#1e5fa8\|#1a3a5c\|#0f2540\|#94a3b8\|#EF5350\|#1d1d1f\|#3d3d3f\|#FEF2F2\|#EFF6FF' $f | wc -l)"
done

# accesibilidad
grep -rn "tabIndex\|aria-label\|role=" src/components/documentos/*Form.tsx \
  src/components/AutocompleteMedicamento.tsx src/components/AutocompleteEstudio.tsx
# → 0 resultados

# contraste
grep -o 'text-slate-400\|text-slate-300' src/components/documentos/*Form.tsx | wc -l
# → 20

# catálogo de vías
grep -rn "Parenteral\|parenteral\|VIAS\b" src
# → sin 'Parenteral' en ningún archivo
```

Contrastes calculados sobre blanco: `slate-300` #cbd5e1 → **1.9:1**;
`slate-400` #94a3b8 → **2.8:1**; `slate-500` #64748b → **4.8:1** (pasa AA).
Los dos primeros no alcanzan el 4.5:1 de AA para texto normal.

---

## 8 · Lo que esta auditoría **no** cubre

Para que el rediseño no dé por auditado lo que no lo está:

- **No abrí navegador.** Todo lo responsive sale de aritmética sobre las clases de
  contenedor. Las cinco hipótesis de §6 son las que sé que no puedo cerrar así;
  puede haber otras que no detecté por el mismo motivo.
- **No revisé los 8 renderizadores de PDF** más allá de comprobar qué props
  aceptan para §5.3.
- **No revisé el modo offline** (`offlineMode`, `onOfflineSave`). Ninguno de los
  tres montajes lo activa; solo el búnker lo haría.
- **No revisé `DiagnosticosEditor.tsx` ni `TipTapViewer.tsx`**, que están en el
  mismo directorio pero no son de los ocho.
- **No comprobé el comportamiento con teclado externo en iPad**, que es un modo de
  uso plausible y donde G-02 (labels sin asociar) y G-10 (sin foco inicial) pesan
  más que con el dedo.
