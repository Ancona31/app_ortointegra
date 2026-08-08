# Spec de diseño — Sistema de documentos Spinus

Documento de extracción para programación. Todos los valores salen de los archivos
de diseño, leídos uno por uno. Nada está derivado, redondeado ni completado.

**Unidades.** Página 612 × 792 pt. Caja de texto 486 pt de ancho. Los valores que
aparecen abajo están en pt tal como están escritos en el diseño.

> **Advertencia de lectura.** La hoja espécimen es un lienzo de documentación: su
> propio marco (títulos de sección, fichas explicativas, numeración 01–13) está en
> **px** y es solo de pantalla. Los especímenes —las tarjetas blancas de 486 pt— están
> en **pt** y son la geometría real de impresión. Solo los valores en pt son
> normativos. Ninguna conversión px→pt aparece en este documento; donde el diseño
> dice px y el dato es de pantalla, se omite por no ser implementable.

---

## Estado de esta entrega

| Parte | Estado |
|---|---|
| A · Hoja espécimen (chasis) | **Completa.** Extraída de `Sistema - Hoja Especimen v2.dc.html` |
| B · Las 8 hojas de formato | **No extraída.** Ver «Parte B — declaración de hueco» al final |

La Parte A es la que marcaste como más urgente y es la que está completa y verificada
contra el archivo. La Parte B requiere abrir ocho archivos más y extraerlos con el
mismo rigor; hacerlo de memoria en esta misma pasada produciría exactamente el defecto
que pediste evitar. Abajo dejo identificado, archivo por archivo, cuál es la versión
aprobada de cada formato y qué cambió después, que es el paso 1 de tus reglas y lo que
permite que la extracción siguiente no mezcle rondas.

---

# A) HOJA ESPÉCIMEN — EL CHASIS

**Versión aprobada:** `Sistema - Hoja Especimen v2.dc.html`. La identifico así: existen
dos archivos de espécimen, `Sistema - Hoja Especimen.dc.html` (v1) y `… v2.dc.html`.
La v1 fue rechazada explícitamente por el cliente («quedó visualmente plano», con
corrección del brief que introdujo densidad gráfica, panel circular, color visible y
supresión de la serif). La v2 se construyó contra ese brief corregido y recibió
«Aprobado» explícito tras las correcciones de banda de pie, contraste y leyenda. La v1
se conserva solo como referencia histórica y **ninguno de sus valores debe usarse**:
usa Source Serif 4, que el sistema eliminó.

**Cambios posteriores a la aprobación:** sí, cuatro. Están listados al final de esta
parte, en «A.12 — Cambios posteriores». No están mezclados en las tablas de abajo.

---

## A.1 · Papel, márgenes y zona segura

| Valor | Medida |
|---|---|
| Página | 612 × 792 pt (Carta, 216 × 279 mm) |
| Margen superior | 54 pt |
| Margen izquierdo | 72 pt (mayor, para perforación y engrapado) |
| Margen derecho | 54 pt |
| Margen inferior | 68 pt |
| Desglose del margen inferior | 36 pt de papel intocable + 16 pt de banda de pie + 16 pt de aire |
| Ancho útil de la caja de texto | 486 pt |
| Alto útil de la caja de texto | 670 pt (792 − 54 − 68) |
| Zona segura | 36 pt por los cuatro lados. Ningún elemento con tinta la cruza |
| Justificación de la zona segura | Cubre el área no imprimible de 4–5 mm de una impresora de consultorio |

**Regla dura declarada:** la banda de pie es tinta, no sangre. Vive **dentro** de la
zona segura. No se mide el margen inferior hasta la banda.

## A.2 · Retícula de 12 columnas

| Valor | Medida |
|---|---|
| Columnas | 12 |
| Ancho de columna | 32.25 pt |
| Medianil | 9 pt |
| Ancho útil | 486 pt |
| Zona de texto | columnas 1–8 · 321 pt · ≈ 66 caracteres |
| Zona de riel de datos | columnas 9–12 · 156 pt |
| Línea base | 16 pt |
| Escala de espaciado vertical | 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 pt |
| Base | 4 pt |

**⚠ Inconsistencia reportada, no resuelta.** El bloque 01 declara la retícula como
12 × 32.25 pt con medianil de 9 pt. Pero el riel de identificación del bloque 06 se
compone con `grid-template-columns: repeat(12, 1fr)` **sin gap**, lo que da columnas de
40.5 pt sin medianil, y la separación entre celdas la hace el `padding` de cada celda
(10 pt) más una regla vertical de 0.5 pt. Son dos retículas distintas conviviendo:
la de 32.25 + 9 para bloques de texto, y una de 12 partes iguales sin medianil para el
riel. **No las unifiqué.** Hay que decidir cuál rige antes de escribir el módulo de
constantes.

## A.3 · Familias tipográficas

| Rol | Familia | Uso |
|---|---|---|
| Neo-grotesca | **Archivo** | Identidad, títulos, datos, tablas, etiquetas, cifras |
| Humanista | **IBM Plex Sans** | Texto corrido largo, subtítulos, notas de firma |
| Mono | **IBM Plex Mono** | Solo el marco de documentación de la hoja espécimen. **No se usa en los documentos impresos del chasis** |

Pesos cargados: Archivo 400/500/600 · IBM Plex Sans 400/500 · IBM Plex Mono 400/500.
No hay serif en el sistema.

### ⚠ VERSALITAS — respuesta explícita

**No son versalitas reales de la fuente. Son mayúsculas con tracking.**

Todo lo que en el diseño se llama «versalita» está implementado como
`text-transform: uppercase` más un `letter-spacing` positivo. No aparece
`font-variant-caps`, `font-feature-settings` ni ninguna llamada a small caps en
ningún punto del sistema. Archivo se carga sin variante de versalitas.

Consecuencia para la implementación: en el motor de PDF hay que transformar la cadena
a mayúsculas y aplicar tracking. Si se sustituye por versalitas reales, **todos los
valores de tracking de este documento dejan de ser válidos** y la altura de las
etiquetas cambia.

## A.4 · Escala tipográfica del chasis

Extraída de la tabla del bloque 02 de la hoja espécimen (la tabla que la propia hoja
declara como escala del sistema).

| Rol | Familia | Cuerpo / interlineado | Peso | Tracking | Color |
|---|---|---|---|---|---|
| Nombre del médico | Archivo | 26 / 26 pt | 600 | −0.012 em | #101010 |
| Especialidad (2 líneas) | Archivo | 7.5 / 12 pt | 500 | 0.34 em | #454545 |
| Título de documento | Archivo | 17 / 20 pt | 600 | 0.02 em | #101010 |
| Subtítulo | IBM Plex Sans | 10.5 / 15 pt | 400 | 0 | #454545 |
| Encabezado de sección | Archivo | 10 / 14 pt | 600 | 0.14 em | #101010 |
| Texto corrido | IBM Plex Sans | 10.5 / 16 pt | 400 | 0 | #101010 |
| Etiqueta de campo | Archivo | 7 / 11 pt | 600 | 0.22 em | #737373 |
| Valor de campo | Archivo | 12 / 16 pt | 400 | 0 | #101010 |
| Tabla · celda | Archivo | 9.5 / 14 pt | 400 | 0 | #101010 |
| Pie y cédulas | Archivo | 7.5 / 11 pt | 400 | 0.06 em | #454545 |

Todos los roles con cifras llevan `font-variant-numeric: tabular-nums`: valor de campo,
tabla, pie y cédulas, folio.

**Roles que pediste y que la escala del chasis NO fija — NO DEFINIDO en la hoja
espécimen:**

- **Ancla de entrada** — NO DEFINIDO en el chasis. Es un componente que nace en la
  Receta Médica, no en la hoja espécimen.
- **Línea secundaria de entrada** — NO DEFINIDO en el chasis. Íd.
- **Número de entrada** — NO DEFINIDO en la tabla de escala. El bloque 08 lo compone
  a **Archivo 15 / 15 pt, peso 600, color acento tipográfico**, y la tabla del bloque
  09 lo compone a **Archivo 10 / 15 pt** (1 fila) y **9 / 14 pt** (25 filas). Son tres
  valores distintos para lo que el plan de código llama un solo rol. **Reportado, no
  resuelto.**
- **Nombre bajo la firma** — no está en la tabla de escala, pero el bloque 10 lo fija:
  ver A.9.

**⚠ Inconsistencia reportada.** La escala declara «Nombre del médico 26 / 26 pt», pero
los dos especímenes de membrete del bloque 05 lo componen distinto: la variante A (con
logo) a **24 / 26 pt** y la variante B (monograma) a **26 / 28 pt**. Hay tres valores
para el mismo rol. No elegí uno.

## A.5 · Color

| Token | Valor | Uso |
|---|---|---|
| Tinta | `#101010` | Texto principal, filetes negros |
| Tinta secundaria | `#454545` | Subtítulos, cédulas, indicaciones de tabla |
| Gris de etiqueta | `#737373` | Etiquetas en versalita, notas de firma |
| Regla hairline | `#D9D6D0` | Reglas verticales del riel, cierre de fila |
| Regla de fila | `#EDEAE4` | Separación entre filas de tabla larga |
| Regla suave | `#C9C5BD` | Filete fino secundario, anillo interior del panel |
| Acento (por defecto) | `#1C3A5E` | Azul marino |
| Acento tipográfico | derivado — ver abajo | Números de sección, cifras de tabla, folio, monograma |
| Acento de banda | derivado — ver abajo | Relleno de la banda de pie |

### Derivación del acento — algoritmo, no porcentaje fijo

El acento del médico es configurable. Los dos tonos derivados **no** son un porcentaje
fijo: se calculan mezclando el acento con negro `#101010` hasta alcanzar un contraste
mínimo sobre blanco.

```
darkenToContrast(hex, objetivo, tMax):
  BLACK = (16, 16, 16)
  t = tMax
  mientras t > 0.02 y contraste(mezcla(hex, BLACK, t)) < objetivo:
      t = t − 0.01
  devuelve mezcla(hex, BLACK, t)

  mezcla(c, BLACK, t) = round(c · t + BLACK · (1 − t))  por canal
  contraste(c)        = 1.05 / (luminancia_relativa(c) + 0.05)   // WCAG, sobre blanco
```

| Tono | Objetivo de contraste | tMax |
|---|---|---|
| Acento tipográfico (`--aink`) | **4.5 : 1** | 0.82 |
| Acento de banda (`--aband`) | **7 : 1** | 0.65 |

Con el acento por defecto `#1C3A5E` el resultado no baja de tMax porque ya cumple; con
un acento claro como mostaza `#D6A429` el algoritmo lo oscurece hasta cumplir. Esto es
lo que permite que el sistema acepte cualquier acento sin romper la legibilidad.

**Regla dura:** el acento nunca es color de texto en su forma pura. Solo aparece como
filete, cuadro sólido, fondo tenue, o como acento tipográfico derivado.

Fondo del disco del panel: acento al **6 %** sobre blanco.
Fondo tenue permitido: hasta **12 %**.

## A.6 · Panel circular de identidad

Geometría, idéntica en los ocho formatos y para todos los médicos.

| Elemento | Medida |
|---|---|
| Diámetro exterior | **56 pt** |
| Anillo exterior | **1.5 pt**, color acento |
| Relleno del disco | acento al **6 %** sobre blanco |
| Diámetro del círculo interior | **47 pt** |
| Anillo interior | **0.5 pt**, color `#C9C5BD` |
| Caja útil del logo | **33 × 19 pt**, centrada. El logo se contiene, **no se recorta a círculo** |
| Monograma (variante sin logo) | Archivo **19 pt**, peso 600, `line-height: 1`, color acento tipográfico |

Holgura entre el anillo exterior y el interior: 4.5 pt por lado ((56 − 47) / 2).

## A.7 · Membrete

Dos variantes: **A · con logo** y **B · monograma**. Comparten estructura; difieren
en el contenido del panel y en el cuerpo del nombre.

**Estructura, de arriba a abajo:**

1. Fila superior — panel circular · nombre y especialidad · (nada a la derecha)
   - `display: flex`, `align-items: center`, medianil **18 pt**
   - Panel 56 pt, `flex: none`
   - Bloque de nombre: `flex: 1`
2. Aire de **14 pt**
3. Filete principal grueso-fino
4. Aire de **6 pt**
5. Línea fina de contacto y cédulas

| Elemento | Variante A (con logo) | Variante B (monograma) |
|---|---|---|
| Nombre | Archivo 24 / 26 pt, 600, −0.012 em, `nowrap` | Archivo 26 / 28 pt, 600, −0.012 em, `nowrap` |
| Aire nombre → especialidad | 7 pt | 7 pt |
| Especialidad línea 1 | Archivo 7.5 / 12 pt, 500, 0.34 em, mayúsculas, #454545 | igual |
| Especialidad línea 2 | igual, sin margen superior | igual |

**Filete principal (grueso-fino):**
- Segmento grueso: **96 pt de ancho × 2.5 pt de alto**, color acento, a la izquierda
- Resto: **0.8 pt de alto**, color `#101010`, hasta el borde derecho de la caja
- Los dos segmentos están alineados por su base (`align-items: flex-end`)

**Línea fina bajo el filete** — dos columnas, `justify-content: space-between`,
`align-items: flex-start`, medianil 24 pt, Archivo 7.5 / 11 pt, color #454545:
- Izquierda, dos renglones:
  `Calle 20 Núm. 110-J, entre 23 y 25, Centro, Umán, Yucatán 97390`
  `Tel. 999 222 3173 · Univ. Autónoma de Sinaloa`
- Derecha, dos renglones, alineados a la derecha, `nowrap`, cifras tabulares, con
  regla vertical de **0.5 pt `#D9D6D0`** a su izquierda y **12 pt** de sangría:
  `Céd. Prof. 9552456`
  `Céd. Esp. 12085805`

## A.8 · Título de documento y riel de identificación

**Bloque de título** — dos columnas, `align-items: flex-start`, medianil 9 pt:

| Zona | Ancho | Contenido |
|---|---|---|
| Izquierda | **321 pt** | Título + subtítulo |
| Derecha | **156 pt** | Folio, alineado a la derecha |

- Título: Archivo 17 / 20 pt, 600, 0.02 em, mayúsculas
- Subtítulo: IBM Plex Sans 10.5 / 15 pt, #454545, margen superior **3 pt**
- Etiqueta `FOLIO`: Archivo 7 / **12 pt**, 600, 0.22 em, mayúsculas, #737373
  *(⚠ interlineado 12 pt, no 11 pt como el resto de etiquetas de campo. Inconsistencia reportada.)*
- Valor de folio: Archivo 11 / 14 pt, peso **500**, 0.03 em, color acento tipográfico, cifras tabulares
- Aire título → filete: **10 pt**
- Filete: mismo grueso-fino del membrete (96 × 2.5 pt acento + 0.8 pt negro)

**Aire filete → riel de identificación: 20 pt**

**Riel de identificación** — `grid-template-columns: repeat(12, 1fr)`, sin gap,
abierto y cerrado por regla de **0.8 pt `#101010`**.

| Celda | Columnas | Padding | Regla izquierda | Regla superior |
|---|---|---|---|---|
| Paciente | span 5 | `8pt 10pt 10pt 0` | — | — |
| Edad | span 2 | `8pt 10pt 10pt` | 0.5 pt `#D9D6D0` | — |
| Sexo | span 2 | `8pt 10pt 10pt` | 0.5 pt | — |
| Expediente | span 3 | `8pt 0 10pt 10pt` | 0.5 pt | — |
| Diagnóstico | span 5 | `8pt 10pt 10pt 0` | — | 0.5 pt |
| Fecha | span 4 | `8pt 10pt 10pt` | 0.5 pt | 0.5 pt |
| Hora | span 3 | `8pt 0 10pt 10pt` | 0.5 pt | 0.5 pt |

Etiqueta de cada celda: Archivo 7 / 11 pt, 600, 0.22 em, mayúsculas, #737373.
Valor: Archivo 12 / 16 pt. El valor de Paciente lleva peso **500**; el resto peso 400.
El valor de Diagnóstico es la excepción de familia: **IBM Plex Sans 11 / 16 pt**.

## A.9 · Los tres estados del campo

| Estado | Composición |
|---|---|
| 1 · Con valor | Etiqueta en versalita gris + valor debajo. Sin caja, sin fondo |
| 2 · Vacío, requerido | Etiqueta + **línea de 0.8 pt `#101010`** con **16 pt** de altura de escritura |
| 3 · Vacío, opcional | **Colapsa por completo.** La retícula se cierra y el renglón lo toma el campo siguiente |

En el estado 3 no se imprime ni la etiqueta ni la línea ni un placeholder. En la hoja
espécimen aparece dibujado con marco punteado y el rótulo `NO SE IMPRIME`, que es
notación de la lámina, **no** parte del documento.

## A.10 · Encabezado de sección

- Abre con regla de **0.8 pt `#101010`** a todo el ancho
- `padding-top` **8 pt**
- Dos columnas, `display: flex`, medianil **9 pt**:
  - Riel del número: **23.25 pt**, `flex: none`
  - Caja de texto: **321 pt**
- Número: Archivo **15 / 15 pt**, 600, color acento tipográfico, cifras tabulares
- Título: Archivo 10 / 14 pt, 600, 0.14 em, mayúsculas
- Aire título → párrafo: **8 pt**
- Párrafo: IBM Plex Sans 10.5 / 16 pt, `text-align: justify`, `hyphens: auto`
- Aire entre secciones: **24 pt**

**⚠ Nota de versión.** El párrafo del espécimen está **justificado**. En rondas
posteriores el sistema pasó a bandera izquierda en todos los formatos. Ver A.12.

## A.11 · Tabla

Modo grid de tres columnas. Sin zebra, sin bordes verticales.

`grid-template-columns: 23.25pt 1fr 132pt`, medianil **9 pt**.

| Elemento | Valor |
|---|---|
| Cabecera | Archivo 7 / 11 pt, 600, 0.22 em, mayúsculas, #737373 |
| `padding-bottom` de la cabecera | 6 pt |
| Filete bajo la cabecera | **2 pt sólido, color acento** |
| Fila — padding vertical (1 fila) | 8 pt |
| Fila — padding vertical (25 filas) | 5 pt |
| Regla entre filas (1 fila) | 0.5 pt `#D9D6D0` |
| Regla entre filas (25 filas) | 0.5 pt `#EDEAE4` |
| Cierre de tabla | 0.8 pt `#101010`, con `margin-top: -0.5pt` |
| Aire cierre → total | 6 pt |
| Fila de total | Archivo 7 pt, 600, 0.22 em, mayúsculas, #737373, cifras tabulares |

Cuerpos de celda: **1 fila** → número 10 / 15 pt, nombre 10.5 / 15 pt, indicación
IBM Plex Sans 9.5 / 15 pt #454545. **25 filas** → número 9 / 14 pt, nombre 9.5 / 14 pt,
indicación IBM Plex Sans 9 / 14 pt #454545. El número va en color acento tipográfico y
alineado a la derecha en ambos casos.

Cadenas literales de la cabecera y el total en el espécimen:
`#` · `Estudio solicitado` · `Indicación` · `Total de estudios`

## A.12 · Bloque de firmas

| Caso | Composición |
|---|---|
| 1 firma | Caja de **222 pt**. Espacio de escritura **44 pt** cerrado por línea de 0.8 pt |
| 6 firmas | `grid-template-columns: 1fr 1fr`, gap `0 24pt`, padding de celda `14pt 0 4pt`. Espacio de escritura **34 pt** por celda |

- Rol: Archivo 7 / 11 pt, 600, 0.22 em, mayúsculas, #737373 — **encima** de la línea
- Nombre bajo la línea (1 firma): Archivo **11.5 / 16 pt**, 600, −0.012 em, margen superior 5 pt
- Nombre bajo la línea (6 firmas): Archivo **10 / 14 pt**, peso 400, margen superior 4 pt
- Cédulas (1 firma): Archivo 7.5 / 11 pt, #454545, cifras tabulares
- Nota (6 firmas): IBM Plex Sans 7.5 / 11 pt, #737373

Roles y notas del caso de 6, literales:

| Rol | Nombre | Nota |
|---|---|---|
| `Paciente` | `Prueba Prueba` | `Nombre y firma` |
| `Médico tratante` | `Dr. Ángel M. Ancona Pérez` | `Céd. Prof. 9552456` |
| `Familiar responsable` | `Nombre y firma` | `Parentesco` |
| `Anestesiólogo` | `Nombre y firma` | `Céd. Esp. — colapsa si no aplica` |
| `Testigo 1` | `Nombre y firma` | `Identificación oficial` |
| `Testigo 2` | `Nombre y firma` | `Identificación oficial` |

**⚠ Nota de versión.** El anestesiólogo fue eliminado del Consentimiento en una ronda
posterior; los altos de escritura se recalibraron. Ver A.14.

## A.13 · Zona de QR y folio · Banda de pie

**Zona de QR** — marco parcial de dos lados:
- Filete superior e izquierdo: **2 pt sólido, color acento**
- Padding: `12pt 14pt 14pt`
- QR: **56 × 56 pt**, `flex: none`
- Medianil QR → texto: **14 pt**
- Caja de texto: **132 pt**
- Etiqueta `Verificación`: Archivo 7 / 11 pt, 600, 0.22 em, mayúsculas, #737373
- Leyenda: IBM Plex Sans 9 / 13 pt, #454545, margen superior 3 pt
  → `Escanee para confirmar la autenticidad de este documento.`
- Filete corto sobre el folio: **40 × 1.6 pt**, color acento, margen superior 10 pt
- Folio: Archivo 10 / 14 pt, peso 500, 0.03 em, acento tipográfico, cifras tabulares

**Banda de pie** — presente en todas las páginas:

| Valor | Medida |
|---|---|
| Alto | **16 pt** |
| Posición | `left: 72pt`, `right: 54pt`, `bottom: 36pt` — alineada a la caja de texto, dentro de la zona segura |
| Relleno | acento de banda (derivado, objetivo 7 : 1) |
| Color de texto | `#fff` |
| Retícula | `auto auto 1fr`, medianil 10 pt, padding lateral 8 pt |
| Zona 1 · folio | Archivo 7 pt, 0.1 em, `nowrap` |
| Zona 2 · paginación | Archivo 7 pt, 600, 0.22 em, mayúsculas, `nowrap` |
| Zona 3 · leyenda | Archivo 6 pt, 0.05 em, alineada a la derecha, `nowrap` |

Cadenas literales:
- `Folio L-08240BF7F996` — prefijo `Folio ` + folio
- `Página 1 de 4` — se compone `Página X de Y`
- `Documento generado por Spinus · Expediente clínico electrónico · spinus.com.mx`

**La banda no sangra.** No repite la dirección ni el teléfono.

## A.14 · Marca de estado

Único uso permitido de la diagonal en el sistema.

| Valor | Medida |
|---|---|
| Rotación | **−28°** |
| Cuerpo | Archivo, 600, tracking 0.05 em |
| Relleno | `transparent` — letra hueca |
| Contorno | **0.7 pt**, `rgba(0,0,0,.45)` |
| Posición | centrada sobre la hoja, `pointer-events: none` |

Estados literales del espécimen: `SIN FIRMAR` · `BORRADOR` · `COPIA`

El cuerpo está en px en la lámina (38 px) porque la lámina es una miniatura de
pantalla. **El cuerpo en pt para impresión NO ESTÁ DEFINIDO en la hoja espécimen.**
Los formatos que la usan lo fijan por su cuenta.

## A.15 · Espaciados verticales entre bloques

Los que la hoja espécimen fija dentro de los especímenes en pt:

| Transición | Medida |
|---|---|
| Membrete: fila superior → filete | 14 pt |
| Membrete: filete → línea fina | 6 pt |
| Título: bloque → filete | 10 pt |
| Título: filete → riel de identificación | 20 pt |
| Encabezado de sección: título → párrafo | 8 pt |
| Entre secciones numeradas | 24 pt |
| Tabla: cabecera → filete de acento | 6 pt |
| Tabla: cierre → fila de total | 6 pt |
| Contenido → banda de pie | 16 pt |

## A.16 · Componentes presentes en la hoja espécimen

Pediste el mapeo 9 vs 14. **No puedo hacerlo: nunca recibí `DOCUMENTOS_SPEC.md` ni la
lista de los 14 componentes del plan de código.** Sin esa lista, cualquier asignación
sería inventada.

Lo que sí puedo dar es el inventario verificado de la hoja. La hoja tiene 13 secciones
numeradas, pero cuatro de ellas son documentación, no componentes:

| # | Sección | ¿Componente? |
|---|---|---|
| 01 | Papel y retícula | No — especificación |
| 02 | Dos sans / escala tipográfica | No — especificación |
| 03 | Recursos gráficos | No — catálogo de siete dispositivos gráficos |
| 04 | Panel circular de identidad | **Sí** |
| 05 | Membrete | **Sí** |
| 06 | Título de documento | **Sí** |
| 06 | Riel de identificación | **Sí** (comparte sección con el título) |
| 07 | Campo · tres estados | **Sí** |
| 08 | Encabezado de sección | **Sí** |
| 09 | Tabla | **Sí** |
| 10 | Bloque de firmas | **Sí** |
| 11 | Zona de QR y folio | **Sí** |
| 11 | Banda de pie | **Sí** (comparte sección con el QR) |
| 12 | Marca de estado | **Sí** |
| 13 | Prueba de acento y fotocopia | No — prueba de validación |

**Son 10 componentes, no 9.** Si el handoff dice 9, probablemente cuenta la sección 06
o la 11 como un solo componente. No lo resuelvo: hay que cotejarlo contra la lista de 14.

Los siete dispositivos gráficos de la sección 03, que son vocabulario y no componentes:
filete grueso-fino · riel de datos · versalitas con tracking (.14 / .22 / .34) ·
contraste de escala 4:1 · número colgado en el margen · marco parcial de dos lados ·
reglas verticales como separadores.

---

## A.17 · Cambios posteriores a la aprobación de la hoja espécimen

Estos valores **superseden** los de las tablas de arriba, pero se decidieron después
y viven en los archivos de formato, no en la hoja espécimen. La hoja espécimen **no**
se actualizó con ellos: hoy está desincronizada del sistema en estos cuatro puntos.

| # | Qué cambió | Valor en la hoja espécimen | Valor vigente | Dónde se decidió |
|---|---|---|---|---|
| 1 | **Texto corrido** | IBM Plex Sans 10.5 / 16 pt, justificado, medida 321 pt | IBM Plex Sans **11.5 / 18 pt**, **bandera izquierda**, medida **486 pt** | Decisión explícita del cliente. Aplicado a Receta y Suplementación |
| 2 | **Campo vacío requerido** | línea 0.8 pt, alto de escritura 16 pt, ancho variable | línea 0.8 pt, alto de escritura **20 pt** (7.06 mm, pautado de cuaderno profesional), ancho **246 pt** para todo campo manuscrito | Ronda de recalibración de campo vacío |
| 3 | **Contador de lista** | `Total de estudios · NN` fijo | Dos formas: hoja intermedia `<ÍTEMS> EN ESTA HOJA · NN DE MM`; hoja final `TOTAL DE <ÍTEMS> · MM`. El encabezado de lista lleva el sustantivo solo | Unificación de contador en el chasis |
| 4 | **Espacio de firma manuscrita** | 44 pt (1 firma) / 34 pt (6 firmas) | Parametrizado por número de firmas en la hoja: hasta 2 → **77 pt**; de 3 a 6 → **28 pt** (piso del sistema). El trazo capturado es **77 pt invariable** | Internamiento, ronda de firmas |

**⚠ Decisión abierta que afecta al #4.** Quedó sin resolver si se adopta un token único
de 77 pt para toda firma manuscrita. Si se adopta, el Consentimiento Informado necesita
una hoja adicional para los testigos. Hasta que se decida, el parámetro de dos tramos
es lo vigente.

---

# B) LAS 8 HOJAS DE FORMATO — declaración de hueco

**No extraídas en esta pasada.** Lo que sigue es el paso 1 de tus reglas: la
identificación de cuál archivo contiene la versión aprobada de cada formato, para que
la extracción siguiente no mezcle rondas. Los valores, cadenas literales y órdenes de
bloque de cada formato están **PENDIENTES**.

| # | Formato | Archivo de la versión aprobada | Cómo lo identifico | Cambios posteriores |
|---|---|---|---|---|
| 1 | Solicitud de Laboratorio | `Solicitud de Laboratorio.dc.html` | Archivo único, sin variantes. Aprobado tras la ronda de firma 77 pt y reglas 1–3 de observaciones | Cuerpo de texto corrido a 11.5 / 18 pt (cambio de chasis, no aplicado a este archivo — **verificar**) |
| 2 | Consentimiento Informado | `Consentimiento Informado.dc.html` | Archivo único. Aprobado tras la ronda de anexo en hoja propia y eliminación de `Tipo y número de identificación` de las firmas | Token de firma manuscrita (ver A.17 #4) |
| 3 | Recibo / Cotización | `Recibo y Cotizacion.dc.html` | Archivo único. Aprobado con la hoja 2 conservada y el aviso canónico del chasis | Ninguno conocido |
| 4 | Receta Médica | **`Receta Medica.dc.html`** | ⚠ **Ver advertencia abajo** | Cuerpo a 11.5 / 18 pt, aplicado |
| 5 | Plan de Suplementación | `Plan de Suplementacion.dc.html` | Archivo único. Aprobado tras unificar el contador y la medida a 486 pt | Cuerpo a 11.5 / 18 pt, aplicado |
| 6 | Solicitud de Imagenología | `Solicitud de Imagen.dc.html` | Archivo único. Aprobado tras el cambio de título a `SOLICITUD DE IMAGENOLOGÍA` y el contador unificado | Ninguno conocido |
| 7 | Solicitud de Internamiento | `Solicitud de Internamiento.dc.html` | Archivo único. Aprobado tras la sintaxis de bloques de texto plano y la eliminación del contador de requerimientos | Ninguno conocido |
| 8 | Escrito Médico | `Escrito Medico.dc.html` | ⚠ **Ver advertencia abajo** | Ninguno posterior |

### ⚠ Receta Médica — cuatro archivos, riesgo de mezcla

Existen **cuatro** archivos de Receta. Solo uno es el formato; los otros tres son
láminas de exploración y **no deben extraerse como si fueran el documento**:

| Archivo | Qué es | ¿Extraer? |
|---|---|---|
| `Receta Medica.dc.html` | El formato. Contiene los casos A–G | **Sí** |
| `Receta - Flujo y ancho.dc.html` | Ronda 4–5: reglas de flujo y ancho pleno. Contiene el spec de flujo del chasis y la regla de última hoja | **Solo el spec de flujo**, que es de chasis |
| `Receta - Entrada, tres estados.dc.html` | Lámina de los tres estados de la entrada, a escala 2× | Solo como referencia del campo vacío (A.17 #2) |
| `Receta - Comparacion de via.dc.html` | Test X/Y del destaque de vía | **No** |
| `Receta - Test de pictograma.dc.html` | Test de pictogramas, **descartado** | **No** |

**Decisión abierta sin resolver:** el test X vs Y del destaque de vía —bloque en
negativo en las 13 vías, o solo en las no orales— **nunca recibió respuesta**.
`Receta Medica.dc.html` está hoy en la variante «solo no orales» y
`Receta - Comparacion de via.dc.html` presenta ambas. **No elijo por defecto.** Hasta
que se decida, el catálogo de vías y su composición quedan PENDIENTES.

### ⚠ Escrito Médico — la decisión revertida

Marcaste este caso. Lo verifiqué: la decisión que se pulió durante seis rondas y
después se revirtió es **la posición de la fecha de emisión**.

Secuencia real:

1. La fecha estaba como `Umán, Yucatán, a 4 de agosto de 2026` dentro del cuerpo, en el
   encabezado, alineada a la derecha
2. Se decidió sacarla del área de escritura y **bajarla al pie**
3. Seis rondas de corrección del pie: retícula de tres zonas → columna de fecha con
   elipsis → retícula de cuatro columnas
4. **Todo ese trabajo se descartó por instrucción explícita**

**Estado vigente y aprobado:**
- El pie tiene **tres zonas**: paginación · título del documento · leyenda. **Sin fecha**
- La fecha de emisión va en el **encabezado**, a la derecha, a la altura del título,
  **sin rótulo**, Archivo **9 pt**, color `#737373`, token corto (`4 ago 2026`), sin lugar
- Alineación con título de varias líneas: `align-items: baseline` — la fecha se alinea
  a la **primera** línea; el título crece hacia abajo
- El formato **no lleva folio** — es el único de los ocho
- La línea de lugar y fecha larga la escribe el médico **dentro del cuerpo** si el
  trámite la exige

**Toda referencia a «fecha en el pie», «columna auto de la fecha», «elipsis del título»
o «retícula de cuatro celdas» pertenece a la serie descartada y no debe implementarse.**

---

## Inconsistencias abiertas — resumen para decidir antes de programar

1. **Dos retículas conviviendo** — 12 × 32.25 pt con medianil 9 pt (bloques de texto)
   contra `repeat(12, 1fr)` sin medianil (riel de identificación). A.2
2. **Tres cuerpos para el nombre del médico** — 26 pt (escala), 24 pt (membrete A),
   26 pt con interlineado 28 (membrete B). A.4
3. **Tres cuerpos para el número de entrada** — 15 pt (sección), 10 pt (tabla 1 fila),
   9 pt (tabla 25 filas). A.4
4. **Interlineado de la etiqueta de folio** — 12 pt contra los 11 pt del resto de
   etiquetas de campo. A.8
5. **La hoja espécimen está desincronizada** del sistema en los cuatro puntos de A.17.
   Si se implementa la hoja espécimen tal cual, se implementan valores superados
6. **Destaque de vía X vs Y** — sin decidir. Bloquea el spec de la Receta
7. **Token de firma manuscrita** — sin decidir si es 77 pt único. Bloquea el
   Consentimiento
8. **Cuerpo en pt de la marca de estado** — NO DEFINIDO en el chasis. A.14

---

## Qué falta para que este documento cumpla el criterio de verificación

Hoy alguien puede escribir el módulo de constantes del **chasis** sin abrir un archivo.
No puede escribir el de los **ocho formatos**. Para completarlo hace falta:

1. Resolver las decisiones 6 y 7 de la lista de arriba, que bloquean dos formatos
2. Recibir `DOCUMENTOS_SPEC.md` o la lista de los 14 componentes, para el mapeo de A.16
3. Una segunda pasada de extracción, formato por formato, sobre los ocho archivos ya
   identificados en la tabla de la Parte B
