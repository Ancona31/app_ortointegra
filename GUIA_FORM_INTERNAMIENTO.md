# GUIA_FORM · Solicitud de internamiento

Spec de implementación por formulario. **Base transversal:** spec 01 §1, §3.1–3.3, §3.7–3.9, §5
y su Anexo de radios. Plantillas: spec 02. Modal posterior: spec 03. Tarjetas: spec 04.

---

## 0 · Anchos de contenedor

| Viewport | Contenedor | Tramo | 1 col | 3 col | span-2 |
|---|---|---|---|---|---|
| 390 | 358 | XS | 316 | — | 316 |
| 820 | 788 | MD | — | 238 | 492 |
| 1180 | 860 | LG | — | 262 | 540 |
| 1440 | 896 | LG | — | 274 | 564 |

---

## 1 · Estructura — seis bloques

1. Selector de tipo (spec 04) · 2. Card **Plantilla** (spec 02 §1)
3. Card **Datos generales** — `data-cols="3"`
4. Card **Diagnósticos** — principal + lista de secundarios
5. Card **Procedimiento**
6. Card **Requerimientos especiales** — chips + «Otro requerimiento»
7. Card **Justificación clínica** — `.sp-textarea`
8. Card **Instrucciones al paciente** — `.sp-section` plegable
9. Card **Indicaciones de ingreso a piso** — `.sp-section` plegable, control de dos niveles
10. Barra de acciones sticky

Las dos secciones de texto largo van **al final y plegadas**: son las dos más altas abiertas
y cuestan 58 px cada una plegadas (56 de cabecera + 2 de bordes) = 116 px entre ambas.

---

## 2 · Datos generales

`data-cols="3"`. Siete campos + la casilla de urgente:

| Fila (MD/LG) | Celdas |
|---|---|
| 1 | Fecha · Paciente · Tipo de internamiento |
| 2 | Días estimados · ASA · Diagnóstico principal |
| 3 | **Hospital / lugar** `.sp-doc-span-2` · (hueco) |
| 4 | `Marcar como URGENTE` con `.sp-doc-span-all` |

**N-01:** hospital vive hoy fuera de la rejilla, así que dos de los tres obligatorios están
dentro y el tercero debajo. Entra en la rejilla con `span-2`.

Días estimados es **texto libre** (`3-5 días`), no numérico: el rango es la respuesta habitual.
Tipo de internamiento y ASA son `<select>` nativos con `.sp-input` + chevron 18 px, 44 px de alto.
Casilla de urgente: `.sp-check` 22×22 en contenedor de 44 px, etiqueta en `--sp-ink-700`
y badge `URGENTE` en `--sp-danger` al marcarla — el rojo va al badge, no a la etiqueta.

Alto de la card de requerimientos: **249 px** a 788 de contenedor · **519 px** a 358, porque los
siete chips pasan a fila por chip (las etiquetas largas no comparten línea con 316 px útiles).

---

## 3 · Indicaciones de ingreso a piso — control de dos niveles

Sustituye el texto libre. En diez documentos de producción hay **cuatro sintaxis distintas**,
ninguna coincide con la que el sistema espera, y los reales miden entre 97 y 225 caracteres
(tres o cuatro indicaciones).

### 3.1 · Grupos

Cuatro fijos, **en orden clínico y no de activación**:
`Dieta` · `Soluciones` · `Medicamentos` · `Cuidados de enfermería`.
Los propios se añaden a la derecha de los cuatro, y se listan al final.

Chips `.sp-chip` de 44 px, `aria-pressed`. Activar un chip crea su bloque; la papelera del
bloque lo borra entero y apaga el chip.

### 3.2 · Bloque de grupo

| Parte | Valor |
|---|---|
| Contenedor | Borde 1 px `--sp-line-card`, radio `--sp-r-field-sm` 9, padding 14 |
| Cabecera | Nombre del grupo `.sp-label-field` + recuento `1 renglón` / `2 renglones` + papelera 44×44 |
| Renglón | `.sp-input` 44 px, uno por fila, gap `--sp-2-5` 10 |
| Añadir renglón | `.sp-btn--compact` al pie del bloque: `Agregar renglón` |
| Quitar renglón | 44×44, `Trash2` 18 px `--sp-ink-icon` |

**Sin numerar y sin guiones.** El renglón se escribe limpio (`Ayuno estricto de 8 horas`);
la numeración, los guiones y los dos puntos del grupo los pone el renderizador del PDF.

### 3.3 · Estados

| Estado | Qué se ve |
|---|---|
| Ningún grupo activo | Chips apagados + zona punteada de 96 px: `Elige un grupo para empezar. La numeración y los guiones los pone el documento.` |
| Con grupos | Bloques en orden clínico, cada uno con su recuento |
| Añadiendo grupo propio | Fila bajo los chips con el foco puesto: `.sp-input` 44 px + `✕` + `.sp-btn--compact` `Añadir` |

### 3.4 · Resumen en la cabecera de la sección

Plegada: `2 grupos · 3 renglones`. Abierta: `2 grupos` — el detalle ya se ve.
Plegar resume, no esconde.

---

## 4 · Instrucciones al paciente — se quedan como texto

566 caracteres prellenados, casi siempre idénticos (presentarse en Admisión con
identificación y estudios, ayuno de 8 horas, no traer objetos de valor, venir acompañado,
no suspender antihipertensivos, ropa cómoda).

- **Forma:** `.sp-textarea`. Se retiran la card ámbar y el emoji `📋` (N-03).
- **Origen del texto por defecto:** pasa a ser **plantilla**, así que editarlo una vez lo deja
  editado para siempre en vez de reescribirlo en cada internamiento.
- **Por qué no llevan estructura:** las de piso las ejecuta enfermería y cada renglón es una
  orden; estas las lee el paciente de corrido y su valor está en el tono. Estructurarlas
  obligaría a teclear seis renglones para obtener el párrafo que hoy ya viene escrito.
- Resumen en cabecera plegada: badge `Editada` si difiere del texto por defecto.

---

## 5 · Cadenas literales

| Dónde | Texto |
|---|---|
| Primario | `Imprimir solicitud de internamiento` — XS: `Imprimir` |
| Toast de éxito | `Solicitud de internamiento guardada` |
| `titulo` del modal 03 | `Solicitud de internamiento generada` |
| Cabeceras | `DATOS GENERALES` · `DIAGNÓSTICOS` · `PROCEDIMIENTO` · `REQUERIMIENTOS ESPECIALES` · `JUSTIFICACIÓN CLÍNICA` · `INSTRUCCIONES AL PACIENTE` · `INDICACIONES DE INGRESO A PISO` |
| Grupos fijos | `Dieta` · `Soluciones` · `Medicamentos` · `Cuidados de enfermería` |
| Vacío del control | `Elige un grupo para empezar. La numeración y los guiones los pone el documento.` |
| Recuentos | `1 renglón` · `2 renglones` · `2 grupos · 3 renglones` |
| Casilla | `Marcar como URGENTE` |
| Banner de faltantes | `Faltan 3 campos: Paciente · Hospital · Diagnóstico principal` |

---

## 6 · Campos: obligatorios, prellenados, retirados

| Campo | Qué pasa | Motivo |
|---|---|---|
| Paciente | Prellenado, **obligatorio** | De la ficha, editable, con hint |
| Diagnóstico principal | Prellenado, **obligatorio** | Del diagnóstico de la consulta |
| Hospital / lugar | **Obligatorio**, entra en la rejilla | N-01 |
| Cards de color ámbar y azul | **Se quitan** | N-03: único formulario con cards de color y con emoji como icono |
| Emoji `📋` y `🏥` | **Se quitan** | Ídem; pasan a `.sp-icobox--sm` |
| Textareas con clase propia | **Se unifican** en `.sp-textarea` | N-04: distinto foco y borde que el resto |
| Diagnósticos secundarios | Patrón de lista del sistema | Hoy «+ Agregar» es texto plano y no hay forma de quitar una fila añadida por error |
| Requerimientos | Chips + `Otro requerimiento` | La lista manda, el chip proyecta — patrón de estudios frecuentes |
| Indicaciones de piso | Texto libre **retirado** | Cuatro sintaxis en producción, ninguna válida |

---

## 7 · Colisiones que resuelve

| Id | Cómo |
|---|---|
| **N-01** | Hospital dentro de `data-cols="3"` con `span-2`; urgente con `span-all` |
| **N-02** | Alturas de control a 44 px (spec 01 §3.3) |
| **N-03** | Fuera cards de color y emoji; cabecera estándar |
| **N-04** | Los dos textareas pasan a `.sp-textarea` |
| **G-02 · G-03 · G-07 · G-10** | Como en spec 01, con id `internamiento-{campo}-{i}` |

---

## 8 · Decisiones, una línea cada una

- **Grupo y renglón, no lista plana** — una lista plana obliga a escribir «Dieta:» delante, que es una de las cuatro sintaxis a eliminar.
- **Orden clínico y no de activación** — enfermería lee siempre en el mismo orden.
- **Sin numerar y sin guiones** — la lámina la compone el renderizador, que es el único que sabe cómo se ve.
- **Sin texto libre en las indicaciones de piso** — el texto libre es lo que produjo las cuatro sintaxis.
- **Instrucciones al paciente siguen siendo texto** — las lee el paciente de corrido; su valor está en el tono.
- **El texto por defecto pasa a plantilla** — editarlo una vez debería bastar para siempre.
- **Las dos secciones nacen plegadas** — son las dos más altas y van al final; plegadas resumen en la cabecera.
- **Los documentos ya emitidos no se convierten** — un PDF emitido es inmutable y reinterpretar cuatro sintaxis es adivinar.

---

## 9 · NO DEFINIDO

- **Borradores de texto libre.** Si llegan a existir borradores de internamiento, uno guardado
  antes del cambio traería un solo bloque de texto. Propuesta: cargarlo entero como renglones
  de un grupo llamado `Indicaciones`, sin intentar dividirlo. **Falta** confirmar que hoy no hay
  borradores de internamiento.
- **Máximo de renglones por grupo.** Los datos reales dan tres o cuatro indicaciones en total y
  no pongo tope; si la lámina del PDF tiene caja de alto fijo para estas indicaciones, hay un
  número a partir del cual desbordan. **Falta** ese dato de la lámina.
