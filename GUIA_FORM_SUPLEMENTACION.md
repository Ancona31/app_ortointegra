# GUIA_FORM · Plan de suplementación

Spec de implementación por formulario. **Base transversal:** spec 01 §1, §3.1–3.3, §3.7–3.9, §5
y su Anexo de radios. Plantillas: spec 02. Modal posterior: spec 03. Tarjetas: spec 04.

---

## 0 · Anchos de contenedor

| Viewport | Contenedor | Tramo | Datos | Ancho de tarjeta |
|---|---|---|---|---|
| 390 | 358 | XS | 1 col · 316 | 316 |
| 820 | 788 | MD | 3 col · 238 | 746 |
| 1180 | 860 | LG | **4 col · 192** | 818 |
| 1440 | 896 | LG | 4 col · 201 | 854 |

La rejilla de datos es `data-cols="4"`: la cuarta columna abre **a partir de 840 px de
contenedor** y nunca antes (cierra S-01, que la activaba por viewport dentro de un panel de
720 px y producía cuatro columnas de 158 px).

Las nueve tarjetas van en **columna única en los cuatro anchos** (§2.2).

---

## 1 · Estructura

1. Selector de tipo (spec 04) · 2. Card **Plantilla** (spec 02 §1)
3. Card **Datos del paciente** — `data-cols="4"`: fecha · paciente · diagnóstico · **peso (kg)**
4. Card **Suplementos** — nueve tarjetas, columna única, con recuento en la cabecera
5. Card **Notas y control** — `data-cols="2"`: notas adicionales · cita de control
6. Barra de acciones sticky

Peso va en la card de datos porque es **dato de paciente**, no de suplemento.

---

## 2 · Tarjetas de suplemento

### 2.1 · Anatomía

| Parte | Valor |
|---|---|
| Contenedor | Padding 14, radio `--sp-r-field-sm+4` 13, `cursor:pointer`; apagada: fondo `--sp-surface`, borde 1 px `--sp-line-soft`; **activa**: fondo `--sp-primary-bg-faint`, borde **1.5 px** `--sp-primary` |
| Casilla | `.sp-check` 22×22, radio 6, borde 1.5 px; marcada: fondo y borde `--sp-primary` con `Check` 14 px `#fff` |
| Nombre | `--sp-fs-body` 14.5 / `--sp-fw-bold` / `--sp-ink-900` |
| Dosis de referencia | 12.5 px `--sp-ink-350` bajo el nombre — permite comprobar el cálculo |
| Beneficio clínico | 13 px / `--sp-lh-body` 1.55, `-webkit-line-clamp: 3` |
| «Ver completo» | `.sp-link-alt` 13 px, `align-self:flex-start`, alto 32; **no se renderiza** si el texto cabe en tres líneas |
| Campo de dosis | Aparece al seleccionar: etiqueta `DOSIS` + `.sp-input` 44 px con el valor calculado, **editable** |
| Rejilla | `align-items: start` — abrir una tarjeta no estira a ninguna otra |
| Objetivo táctil | La tarjeta completa alterna la selección |

Recuento en la cabecera de la card: `.sp-badge` `0 de 9` … `9 de 9`.

### 2.2 · Por qué columna única también en escritorio

Cada tarjeta tiene alto distinto según su beneficio, así que en dos columnas la vecina nunca
empieza donde la vista la busca y hay que leer en zigzag. Medidas de la rejilla de nueve:
**1.591 px** a 860 y 896 de contenedor · **1.612 px** a 788 · **1.833 px** a 358. En dos
columnas eran 1.062 px: el intercambio aceptado es más scroll a cambio de leer en un solo eje.

### 2.3 · Cálculo

`dosis = round(dosisPorKg × peso, 2)` + unidad + `/día`. Sin peso no se calcula nada y las
nueve tarjetas se muestran sin dosis. El valor nace calculado y es **editable**: lo que el
médico escribe manda.

Ejemplo canónico: D3 a 75 UI/kg con 75 kg → `5625 UI/día`.
Ashwagandha KSM-66 no es por peso: `1 cápsula al día`.

---

## 3 · Cadenas literales

| Dónde | Texto |
|---|---|
| Primario | `Imprimir plan de suplementación` — XS: `Imprimir` |
| Toast de éxito | `Plan de suplementación guardado` |
| `titulo` del modal 03 | `Plan de suplementación generado` |
| Cabeceras | `DATOS DEL PACIENTE` · `SUPLEMENTOS` · `NOTAS Y CONTROL` |
| Etiqueta de peso | `Peso (kg)` + `*` |
| Hint de peso | `Calcula las dosis por peso` |
| Hints de datos | `De la ficha · editable` · `Del diagnóstico de la consulta` |
| Recuento | `2 de 9` |
| Enlace de beneficio | `Ver completo` |
| Placeholders | `Ej: 75` · `Indicaciones generales…` · `Ej: En 3 meses con nuevos laboratorios` |
| Banner de faltantes | `Faltan 2 campos: Peso · Suplementos` |
| Aviso de recálculo (propuesto) | `Se recalcularon 3 dosis; 1 se conservó porque la editaste` |

---

## 4 · Campos: obligatorios, prellenados, retirados

| Campo | Qué pasa | Motivo |
|---|---|---|
| **Peso** | Pasa a **obligatorio** | Sin peso no hay dosis, y una hoja sin dosis no sirve |
| Paciente | Prellenado, **obligatorio** | De la ficha, editable |
| Diagnóstico | Prellenado | Del diagnóstico de la consulta |
| ≥ 1 suplemento | **Obligatorio** | Hoy se exige pero no se marca |
| Beneficio clínico | **Visible siempre**, recortado a 3 líneas | Es la referencia con la que el médico elige: se acota, no se esconde (S-02) |
| Dosis personalizada | Sube a 44 px | S-03: hoy `py-1.5` mientras el resto usa `py-2` — dos alturas en la misma pantalla |
| Notas · cita de control | Sin cambio | Dos campos a dos columnas desde 600 px de contenedor |
| `justificacion{}` | Sin interfaz — ver §7 | El estado lo guarda y ninguna pantalla lo pide |

---

## 5 · Colisiones que resuelve

| Id | Cómo |
|---|---|
| **S-01** | `data-cols="4"` por contenedor: cuarta columna desde 840 px, nunca por viewport |
| **S-02** | Beneficio acotado a 3 líneas + `Ver completo`; la rejilla de selección deja de medir ≈1.100 px de puro texto suelto |
| **S-03** | Dosis personalizada a 44 px, `.sp-input` |
| **S-05** | Sin `pacienteId` no se anexa: el modal posterior no renderiza la acción (spec 03) |
| **G-02 · G-03 · G-07 · G-10** | Como en spec 01, con id `suplementacion-{campo}-{i}` |

---

## 6 · Decisiones, una línea cada una

- **La dosis se calcula pero se puede escribir encima** — el cálculo es una propuesta, no una orden.
- **La dosis de referencia por kilo queda visible** — sin ella no se puede comprobar el cálculo.
- **El beneficio no se esconde: se acota** — es la guía con la que se elige, así que se lee sin pedir nada.
- **Columna única también en escritorio** — dos columnas con alturas distintas obligan a leer en zigzag.
- **Tarjeta entera pulsable** — la casilla es la señal, no el objetivo.
- **Peso en la card de datos** — es dato de paciente, no de suplemento.
- **Peso obligatorio** — sin él las nueve tarjetas no pueden calcular nada.

---

## 7 · NO DEFINIDO

- **S-04 · recalcular al cambiar el peso.** Si el médico corrige el peso después de elegir,
  recalcular borraría las dosis tocadas a mano. **Propuesta:** recalcular solo las no editadas y
  avisar con `.sp-banner--info` — `Se recalcularon 3 dosis; 1 se conservó porque la editaste`.
  **Falta** el sí.
- **`justificacion{}` por suplemento.** El estado la guarda y ninguna pantalla la pide ni la
  muestra. O es campo muerto que se retira del modelo, o falta la interfaz —un campo de texto por
  suplemento elegido— y hay que decidir si va en la tarjeta o solo en el PDF. **Falta** saber si
  el renderizador la imprime hoy.
