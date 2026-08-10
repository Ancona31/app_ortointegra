# GUIA_FORM · Consentimiento informado

Spec de implementación por formulario. **Base transversal:** spec 01 §1, §3.1–3.3, §3.7–3.9, §5
y su Anexo de radios. Plantillas: spec 02 (con su **excepción §6**). Modal posterior: spec 03.
Tarjetas de tipo: spec 04. **Flujo de firmado: spec 05.**

---

## 0 · Anchos de contenedor

| Viewport | Contenedor | Tramo | 1 col | 3 col |
|---|---|---|---|---|
| 390 | 358 | XS | 316 | — |
| 820 | 788 | MD | — | 238 |
| 1180 | 860 | LG | — | 262 |
| 1440 | 896 | LG | — | 274 |

---

## 1 · Estructura

1. Selector de tipo (spec 04)
2. Card **Plantilla** — primer bloque. **Excepción del sistema:** aquí «Guardar como plantilla»
   sube a esta card junto a «Gestionar» (rejilla `1fr auto auto`), porque la barra de acciones ya
   lleva tres botones (spec 02 §6, spec 05 §…). En XS los dos botones caen debajo, uno por fila.
3. Card **Datos de identificación** — `.sp-doc-grid[data-cols="3"]`, 11 controles en 4 filas
4. Las **7 secciones de texto**, cada una `.sp-section` plegable, **todas plegadas al montar**
5. Barra de acciones sticky (tres botones, spec 05)

---

## 2 · Rejilla de identificación

Nueve campos de texto + dos autorizaciones = **once controles**, en cuatro filas.

| Fila | Contenido | Notas |
|---|---|---|
| 1 | Fecha · Lugar · Paciente | Paciente prellenado |
| 2 | Edad · Diagnóstico · Procedimiento | Edad prellenada |
| 3 | Familiar responsable o representante legal · Testigo 1 · Testigo 2 | Campo fusionado |
| 4 | **Divisor** + Transfusión (segmentado) + Uso de fotografías (casilla) | `.sp-doc-span-all` en XS |

| Contenedor | Columnas | Ancho de campo | Etiqueta |
|---|---|---|---|
| < 380 | 1 | 316 | 1 línea; sin reserva de alto |
| 600–839 | 3 | 238 | `min-height: 34px` — «Familiar responsable o representante legal» ocupa 2 líneas y las tres columnas arrancan a la misma altura |
| ≥ 840 | 3 | 262 / 274 | la etiqueta larga entra en una línea |

Divisor antes de las autorizaciones: `border-top: 1px solid var(--sp-line-divider)`,
`margin-top: var(--sp-4)`, `padding-top: var(--sp-4)`, `grid-column: 1 / -1`.
Las dos autorizaciones **no son datos de identificación**: son decisiones del paciente.

Alto de la card a 860 de contenedor: **543 px** = 56 (cabecera) + 484 (rejilla con padding) + 3 (bordes).

Segmentado de transfusión: `.sp-doc-segmented`, dos opciones, 44 px, `grid-column: 1 / -1` en XS
(partirlo en dos columnas de 155 px deja los botones por debajo de lo cómodo).
Casilla de fotografías: `.sp-check` 22×22, radio 6, borde 1.5 px `--sp-line-strong`, contenedor de 44 px.

---

## 3 · Secciones de texto

`.sp-section` (mecánica de §3.A.3 de la propuesta):

| Estado | Valor |
|---|---|
| Cabecera | 56 px, pulsable entera, `aria-expanded`, chevron 18 px `--sp-ink-icon` a la derecha |
| Resumen en cabecera | Badge `.sp-badge` con `Editada` si difiere del texto por defecto; nada si está intacta |
| Plegada | 58 px (56 + 2 de bordes) |
| Abierta | `.sp-textarea`, `min-height: 88px`, `resize: vertical` |
| Al montar | **Las siete plegadas** — corrige C-02: hoy abren todas y el formulario mide ≈ 2.400 px antes de escribir |

---

## 4 · Cadenas literales

| Dónde | Texto |
|---|---|
| Primario | `Imprimir consentimiento` — XS: `Imprimir` |
| Toast de éxito | `Consentimiento guardado` |
| `titulo` del modal 03 | `Consentimiento generado` |
| Cabecera de la card | `DATOS DE IDENTIFICACIÓN` |
| Campo fusionado | `Familiar responsable o representante legal` |
| Hint de paciente | `De la ficha · editable` |
| Hint de edad | `De la ficha · editable` |
| Banner de faltantes (ejemplo de 3) | `Faltan 5 campos: Lugar · Edad · Procedimiento y 2 más` |
| Nombre del campo fusionado en el banner | `Familiar responsable o representante legal` |

---

## 5 · Campos: retirados, fusionados, prellenados

| Campo | Qué pasa | Motivo |
|---|---|---|
| No. Expediente | **Se quita** | Se genera automáticamente |
| Identificado con | **Se quita** | El dato lo da la foto de la INE del flujo de firmado (spec 05) |
| Identificación del familiar | **Se quita** | Ídem, foto de la INE del familiar que firma |
| Identificación del representante | **Se quita** | Ídem, y el campo al que acompañaba desaparece en la fusión |
| Médico anestesiólogo | **Se quita** | Tiene su propio consentimiento |
| Familiar responsable + Representante legal | **Se fusionan** | Firma uno de los dos, nunca los dos |
| Paciente | Prellenado de la ficha, editable | Obligatorio |
| Edad del paciente | Prellenada de la ficha, editable | Si cumplió años entre ficha y consulta, corregir aquí es más rápido que ir y volver |
| Lugar | Sin cambio | Lo escribe el médico cada vez; no viene del consultorio |
| Fecha · Procedimiento · Diagnóstico | Sin cambio | Los tres obligatorios de siempre |
| Testigo 1 · Testigo 2 | Sin cambio | Opcionales, y omitibles también en la firma |
| Transfusión · Uso de fotografías | Sin cambio, bajo divisor | No son identificación |

**Cuenta:** 17 − 5 retirados = 12; la fusión convierte dos en uno → **11 controles**.

**Obligatorios:** paciente · edad · lugar · procedimiento · diagnóstico.

---

## 6 · Colisiones que resuelve

| Id | Cómo |
|---|---|
| **C-01** | `lg:grid-cols-3` se activaba por viewport dentro de un panel de 720 px → `data-cols="3"` por contenedor (§2) |
| **C-02** | Las siete secciones nacen plegadas (§3) |
| **C-04** | `fecha_nacimiento` y `numero_expediente` ya se consultan: edad se prellena; expediente se retira por autogenerado |
| **G-02 · G-03 · G-07 · G-10** | Como en spec 01 §5, con id `consentimiento-{campo}` |

---

## 7 · Decisiones, una línea cada una

- **Cinco campos fuera** — cuatro los aporta la foto de la INE y el quinto tiene su propio consentimiento.
- **Un campo en vez de dos para familiar y representante** — firma uno de los dos, nunca los dos.
- **Edad prellenada y editable** — el dato existe en la ficha y puede haber caducado por un cumpleaños.
- **Autorizaciones bajo divisor** — no son identificación, son decisiones del paciente.
- **Siete secciones plegadas al abrir** — 2.400 px de formulario antes de escribir no es un formulario.
- **«Guardar como plantilla» en la card de plantilla** — cuatro botones en la barra son un tablero (spec 02 §6).
- **Reserva de 34 px en la etiqueta en modo multicolumna** — una etiqueta de dos líneas desalinea la fila entera.

---

## 8 · NO DEFINIDO

Ninguno propio abierto. Consecuencia declarada: la tabla canónica de obligatorios
(§3.A.5 de la propuesta) cambia el nombre de un campo — `familiar responsable` pasa a
`familiar responsable o representante legal` en el banner de faltantes.
