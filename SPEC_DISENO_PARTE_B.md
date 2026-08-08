# Spec de diseño — Parte B · Los 8 formatos

Continuación de `SPEC_DISENO.md`. Mismas reglas: valores extraídos del archivo, no
recordados. Nada derivado, redondeado ni completado. `NO DEFINIDO` donde el diseño no
fija el valor.

**Unidades.** Todos los valores en pt, tal como están escritos en el archivo.

**Referencia cruzada.** Los valores del chasis (membrete, riel de identificación, banda
de pie, panel circular) están en `SPEC_DISENO.md` Parte A y no se repiten aquí. Cada
ficha solo declara lo propio del formato y las divergencias que encuentre.

---

## Las dos decisiones bloqueantes — recibidas y aplicadas

| Decisión | Resolución recibida |
|---|---|
| Destaque de vía en Receta | Gana **variante Y**: bloque en negativo solo para vías no orales. La oral se compone como texto plano en la misma ranura, nunca se omite. `Receta Medica.dc.html` ya está en esa variante |
| Token de firma manuscrita | **No** se adopta 77 pt único. Queda el parámetro de dos tramos: hasta 2 firmas → 77 pt; de 3 a 6 → 28 pt. En el Consentimiento el médico **no** imprime rúbrica renderizada: firma a mano como los demás |

Archivos que **no** se extraen, por instrucción: `Receta - Comparacion de via.dc.html`,
`Receta - Test de pictograma.dc.html`.

---

# B.1 · SOLICITUD DE LABORATORIO

**Versión aprobada:** `Solicitud de Laboratorio.dc.html`, versión `v1785604085119714`.
Archivo único, sin variantes ni láminas paralelas. Lo identifico como aprobado porque es
el archivo sobre el que se aplicaron y verificaron las tres reglas de observaciones
(condicionalidad, desborde sin mínimo de filas, anclaje de firma) y la firma de 77 pt,
y no hubo ronda posterior sobre este formato.

**Cambios posteriores a la aprobación:** **ninguno aplicado al archivo.** Pero hay una
desincronización con el chasis, resuelta abajo en «Pregunta A».

## 1 · Título exacto

Cadena literal en el archivo: `Solicitud de laboratorio`

Se compone con `text-transform: uppercase`, así que **imprime** `SOLICITUD DE
LABORATORIO`. La cadena fuente está en capitalización de oración; la mayúscula es de
presentación, no del dato.

> ⚠ **Divergencia con `DOCUMENTOS_SPEC.md` II.1.** El spec de implementación declara el
> título como `SOLICITUD DE LABORATORIO` en mayúsculas literales. El diseño lo tiene en
> capitalización de oración más `uppercase`. Si la implementación escribe la constante en
> mayúsculas y además aplica `uppercase`, no hay daño; pero si alguien decide quitar el
> `uppercase` confiando en la constante, el resultado depende de cuál de las dos fuentes
> se tomó. **Reportado, no resuelto.**

**Subtítulo.** Existe y no está en `DOCUMENTOS_SPEC.md`. Es texto libre bajo el título,
IBM Plex Sans 10.5 / 14 pt, color `#454545`, margen superior 2 pt. Valores observados en
los tres casos del archivo:
`Protocolo preoperatorio completo` · `Examen general de orina` · `Protocolo preoperatorio ampliado`

> ⚠ **Campo no inventariado.** `DOCUMENTOS_SPEC.md` II.1 §2 no lista ningún campo de
> subtítulo. El diseño lo tiene en las tres hojas. **Reportado.**

## 2 · Orden de bloques

**Hoja 1 (y hoja única):**

1. Membrete completo — panel circular · nombre · especialidad · filete grueso-fino · línea de dirección y teléfono
2. Aire 12 pt
3. Bloque de título — título + subtítulo a la izquierda, riel de folio de 156 pt a la derecha
4. Filete grueso-fino (96 × 2.5 pt acento + 0.8 pt negro), a 4 pt del bloque de título
5. Aire 8 pt
6. Riel de identificación — 7 celdas en dos filas
7. Aire 12 pt
8. Cabecera de tabla + filete de acento de 2 pt
9. Filas de estudios
10. Filete de cierre 0.8 pt
11. Contador de lista, a 5 pt del cierre
12. **Observaciones del laboratorio** — condicional
13. Espaciador flexible
14. Bloque de firma
15. Banda de pie (absoluta)

**Hoja de continuación** — lo que cambia:

| Bloque | Hoja 1 | Hoja de continuación |
|---|---|---|
| Panel circular | Sí | **No** |
| Nombre del médico | 22 / 23 pt | **14 / 18 pt** |
| Especialidad | Sí | **No** |
| Rótulo de continuación | — | `Solicitud de laboratorio · continuación`, 7 / 11 pt, 600, 0.22 em, uppercase, #737373 |
| Línea de dirección y teléfono | Sí | **No** |
| Filete tras el membrete | Sí | Sí, a 6 pt (no 8) |
| Subtítulo | Sí | **No** |
| Riel de folio de 156 pt | Sí | Sustituido por riel derecho sin ancho fijo |
| Riel de identificación | 7 celdas | **3 celdas**: Paciente (span 5) · Expediente (span 4) · Fecha (span 3) |
| Formato de fecha | `31 de julio de 2026` | **`31 jul 2026`** (token corto) |
| Firma | Sí | Sí |

## 3 · Ranuras de la entrada

**Este formato no usa `EntradaNumerada`.** Usa la **variante grid** del componente
`Tabla`, de tres columnas:

`grid-template-columns: 23.25pt 1fr 132pt`, medianil 9 pt.

| Columna | Ancho | Contenido | Alineación |
|---|---|---|---|
| 1 | 23.25 pt | Número de dos dígitos | derecha |
| 2 | `1fr` (= 312.75 pt) | Nombre del estudio | izquierda |
| 3 | 132 pt | Indicación | izquierda |

> ⚠ **Divergencia estructural con `DOCUMENTOS_SPEC.md` II.1 §3–4.** El spec de
> implementación declara «lista de `EntradaNumerada`» con `ancla` = nombre del estudio y
> las otras tres ranuras colapsadas. El diseño aprobado **no** usa entradas numeradas:
> usa una tabla de tres columnas con cabecera y una columna de indicación de 132 pt que
> el spec no menciona. Son dos estructuras distintas, no dos nombres de la misma.
> **Reportado, no resuelto.** Si se implementa como `EntradaNumerada`, la columna de
> indicación y la cabecera de tabla desaparecen.

**Cuerpos de fila, por densidad** — el archivo tiene dos calibraciones distintas:

| Caso | Padding vertical | Regla | Número | Nombre | Indicación |
|---|---|---|---|---|---|
| Lista larga (18 / 19 filas) | 1.75 pt | 0.5 pt `#EDEAE4` | 9 / 11.5 pt | 9.5 / 11.5 pt | IBM Plex Sans 9 / 11.5 pt |
| Lista corta (1 fila) | 5 pt | 0.5 pt `#D9D6D0` | 9.5 / 14 pt | 10.5 / 14 pt | IBM Plex Sans 9.5 / 14 pt |

El número va en `--aink` (acento tipográfico) y cifras tabulares en ambos casos.
La indicación va en `#454545` en ambos casos.

> ⚠ **Dos calibraciones para la misma tabla.** El archivo cambia cuerpo, interlineado,
> padding y color de regla según cuántas filas haya. No hay regla declarada de cuándo
> aplica cada una: la lista de 1 fila usa la corta, las de 18 y 19 la larga, y el
> resto de la hoja 2 del caso 19 (1 fila) usa la corta. **Reportado.** La implementación
> necesita un umbral que el diseño no fija.

## 4 · Cadenas literales impresas

**Cabecera de tabla:**
```
#
Estudio solicitado
Indicación
```

**Contador de lista:**
```
Total de estudios            ← hoja final y hoja única
Estudios en esta hoja        ← hoja intermedia
```
Cifra de la hoja intermedia, compuesta: `18 de 19` (formato `NN de MM`, sin cero a la
izquierda en el MM del archivo: `19`, y con cero en el NN cuando aplica).

**Observaciones:**
```
Observaciones del laboratorio
```

**Aviso de continuación** — dos zonas, `space-between`, 8 / 12 pt, peso 600, 0.18 em, uppercase:
```
La solicitud continúa en la hoja 2          ← izquierda, tinta negra
Firma en la última hoja                     ← derecha, #737373
```

> ⚠ **Divergencia con `DOCUMENTOS_SPEC.md` I.2 · 2.N.** El chasis declara tres avisos
> canónicos: `CONTINÚA EN LA HOJA N · <ÍTEMS> X A Y`, `LAS <ÍTEMS> CONTINÚAN EN LA HOJA N`,
> `RESERVADO PARA LA FIRMA · CONTINÚA EN LA HOJA N`. **Ninguno de los tres es el que
> imprime este archivo.** El diseño usa una construcción propia de dos zonas.
> **Reportado, no resuelto.**

**Rótulo de continuación (hoja 2):**
```
Solicitud de laboratorio · continuación
```

**Bloque de firma:**
```
Firma y sello del médico
Dr. Ángel M. Ancona Pérez
Céd. Prof. 9552456 · Céd. Esp. 12085805
```

**Banda de pie** — tres zonas:
```
Folio L-7C15A0E4D2B9
Página 1 de 2
Documento generado por Spinus · Expediente clínico electrónico · spinus.com.mx
```

**Etiquetas del riel de identificación:**
`Paciente` · `Edad` · `Sexo` · `Expediente` · `Diagnóstico` · `Fecha` · `Hora`

**Prefijos de folio observados:** `L-` en los tres casos (`L-3391C2E70A48`,
`L-08240BF7F996`, `L-7C15A0E4D2B9`).

## 5 · Valores propios del formato

**Presupuesto vertical declarado en el código del archivo** (objeto `M`, en pt):

| Token del archivo | Valor | Qué mide |
|---|---|---|
| `util` | 670 | 792 − 54 superior − 68 inferior |
| `encabezado` | 217 | Membrete + filetes + título + riel de identificación |
| `cabTabla` | 16.8 | Cabecera de tabla + filete de acento + filete de cierre |
| `fila` | 15 | Altura de una fila de tabla |
| `total` | 16 | Línea de total o de continuación |
| `firma` | 119.8 | Etiqueta + 77 de rúbrica + línea + nombre + cédulas |
| `separacion` | 20 | Aire antes de observaciones o de la firma |
| `etiquetaObs` | 15 | Etiqueta de observaciones + su margen |
| `renglon` | 16 | Alto de un renglón rayado de observaciones |
| `contHoja` | 60 | Encabezado reducido de las hojas de continuación |

**Capacidades derivadas por fórmula en el archivo:**

| Constante | Valor | Fórmula |
|---|---|---|
| `MAX_CON_FIRMA` | 18 filas | Literal en el archivo |
| `maxPrimeraHoja` | 26 filas | `⌊(670 − 217 − 16.8 − 16 − 42.6) / 15⌋` — el 42.6 es aire + filete + aviso de continuación |
| `MIN_RENGLONES` | 3 | Umbral por debajo del cual observaciones no se imprime |

**Reglas de reparto, textuales del archivo:**

```
reparto(total):
  si total ≤ 18 → toda la lista en una hoja
  si no        → corte = min(maxPrimeraHoja, total − 1)
                 hoja 1 = [0, corte)   hoja final = [corte, total)
```
La última hoja siempre conserva al menos una fila. **No hay mínimo de 8 filas** — se
eliminó por instrucción.

```
renglonesObs(filas, {conFirma, continuacion}):
  ocupado = (continuacion ? 60 : 217) + 16.8 + filas×15 + 16
            + (conFirma ? 20 + 119.8 : 0)
  libre   = 670 − ocupado − 20 − 15
  → ⌊libre / 16⌋      ;  se imprime si ≥ 3
```

**Bloque de observaciones — composición:**
- Contenedor `flex: 1`, `min-height: 63pt`, margen superior 20 pt
- Etiqueta 7 / 11 pt, 600, 0.22 em, uppercase, #737373
- Zona rayada: `flex: 1`, margen superior 4 pt,
  `repeating-linear-gradient(to bottom, transparent 0, transparent 15.5pt, #D9D6D0 15.5pt, #D9D6D0 16pt)`
  → renglón de 16 pt con regla de 0.5 pt

**Filete del aviso de continuación** (distinto del filete principal):
- Segmento grueso: **48 × 1.6 pt**, color acento
- Resto: **0.5 pt**, color `#C9C5BD`

**Bloque de firma:**
- Ancho de la caja: **246 pt**
- Etiqueta 7 / 11 pt, 600, 0.22 em, uppercase, #737373
- Rúbrica: **77 pt** de alto, `overflow: hidden`
- Línea: 0.8 pt `#101010`
- Nombre: Archivo 11.5 / 15 pt, 600, −0.012 em, margen superior 5 pt
- Cédulas: Archivo 7.5 / 11 pt, #454545, cifras tabulares

**Trazo de rúbrica** — SVG, `viewBox="0 0 246 110"`,
`preserveAspectRatio="xMinYMax meet"`, trazo `#101010`, `linecap`/`linejoin` redondos,
cinco paths con grosores 2 · 2 · 1.6 · 1.2 · 1.8. Los datos de path están en el archivo
y se reproducen íntegros en el anexo de esta ficha si la implementación los necesita.

## 6 · Componentes del chasis que instancia

| Componente | Variante | Nota |
|---|---|---|
| `PanelCircular` | `monograma` | Iniciales `AA`, 19 pt, 600, `--aink` |
| `Membrete` | `completo` / `continuacion` | Ver tabla del §2 |
| `TituloDocumento` | `fijo` | Con subtítulo, que el chasis no declara |
| `BloquePaciente` | `completo` / `reducido` | 7 celdas / 3 celdas |
| `RielDatos` | `celdas` | Fecha, hora y diagnóstico van **dentro** del mismo riel de paciente, no en un riel aparte |
| `Campo` | `con valor` únicamente | El archivo no muestra ningún campo vacío en este formato |
| `Tabla` | **modo grid** | ⚠ No `EntradaNumerada` — ver §3 |
| `ContadorLista` | dos formas | Ver §4 |
| `BloqueFirmas` | `amplia` | Una firma, 77 pt |
| `PieDocumento` | `completo` | Tres zonas |
| `MotorFlujo` | — | Reglas propias en código, ver §5 |

> ⚠ **Divergencia con `DOCUMENTOS_SPEC.md` II.1 §3.** El spec declara la composición como
> `BloquePaciente` completo → `RielDatos` una línea (fecha, diagnóstico). El diseño tiene
> **un solo riel** de 7 celdas que incluye paciente, edad, sexo, expediente, diagnóstico,
> fecha y hora. No hay dos rieles. **Reportado.**

## Preguntas transversales

**A · Los cuatro desincronizados** — resuelto, ya no queda «verificar»:

| Desincronizado | Estado en este archivo |
|---|---|
| Texto corrido 11.5 / 18 pt, bandera izquierda | **No aplicable.** Este formato no tiene ningún párrafo de texto corrido. El único texto en humanista son el subtítulo (10.5 / 14 pt) y la celda de indicación (9 / 11.5 pt o 9.5 / 14 pt), que son datos, no prosa. **El cambio de chasis no lo toca** |
| Campo vacío 20 pt de alto y 246 pt de ancho | **No aplicable.** El archivo no instancia ningún campo vacío requerido |
| Contador de lista en dos formas | **Aplicado.** Hoja intermedia `Estudios en esta hoja · 18 de 19`; hoja final y única `Total de estudios · NN` |
| Espacio de firma parametrizado | **Aplicado.** Una firma → 77 pt (tramo `amplia`) |

**B · Las tres divergencias de A.4:**

| Divergencia | Valor real en este archivo |
|---|---|
| Nombre del médico | **22 / 23 pt**, 600, −0.012 em (hoja 1). **14 / 18 pt** en continuación. Ninguno de los tres valores del espécimen (26, 24, 26/28) |
| Número de entrada | **9 / 11.5 pt** en lista larga, **9.5 / 14 pt** en lista corta. Ninguno es el 15 pt del encabezado de sección del espécimen |
| Interlineado de la etiqueta de folio | **11 pt** — coincide con el resto de etiquetas de campo, no con los 12 pt del espécimen |

**C · Cuerpo de la marca de estado:** este formato **no instancia marca de estado.**
NO DEFINIDO aquí.

**D · Anestesiólogo:** no aplica a este formato.


---

# B.2 · SOLICITUD DE IMAGENOLOGÍA

**Versión aprobada:** `Solicitud de Imagen.dc.html`, versión `v1785856069259788`.
Archivo único. Lo identifico como aprobado porque incorpora las dos correcciones de la
ronda de ajuste —título acortado a «Solicitud de imagenología» y contador de lista
unificado— y no hubo ronda posterior sobre este formato.

**Cambios posteriores a la aprobación:** **ninguno.**

## 1 · Título exacto

Cadena literal: `Solicitud de imagenología` — capitalización de oración más
`text-transform: uppercase`, así que imprime `SOLICITUD DE IMAGENOLOGÍA`.

Se compone en una caja de **ancho fijo 287 pt**, que es lo que garantiza que no colisione
con el riel derecho de 190 pt (287 + 9 de medianil + 190 = 486). Ese ancho fijo es la
solución al problema que obligó a acortar el título.

**No hay subtítulo** en este formato. (Contrasta con Laboratorio, que sí lo tiene — D2.)

## 2 · Orden de bloques

**Hoja 1:**

1. Membrete completo — panel · nombre · especialidad
2. Filete grueso-fino a 8 pt
3. Línea de dirección y teléfono, a 6 pt
4. **Línea de cédulas y universidad** — segunda línea del membrete, sin margen propio
5. Aire 12 pt
6. Bloque de título — título (caja 287 pt) + badge `URGENTE` debajo, a 4 pt / riel derecho de 190 pt con **dos celdas**: `Emisión` y `Folio`
7. Filete grueso-fino a 6 pt
8. Aire 10 pt
9. Riel de identificación — 5 celdas: Paciente · Edad · Sexo · Expediente en la primera fila; **Diagnóstico a span 12** en la segunda
10. Aire 14 pt
11. Encabezado de lista + filete de **64 × 2 pt** acento + 0.8 pt negro, a 5 pt
12. Entradas de estudio
13. Filete de cierre 0.8 pt
14. Contador de lista, a 5 pt
15. Notas para el servicio — condicional
16. Firma — condicional
17. Espaciador flexible
18. Aviso de continuación — condicional
19. Banda de pie (absoluta)

**Hoja de continuación** — lo que cambia:

| Bloque | Hoja 1 | Continuación |
|---|---|---|
| Panel circular | Sí | **No** |
| Nombre | 22 / 23 pt | **14 / 18 pt** |
| Especialidad, dirección, cédulas | Sí | **No** |
| Rótulo | — | `Solicitud de imagenología · continuación` |
| Riel derecho | Emisión + Folio | **Solo Folio**, 10 / 14 pt |
| Riel de identificación | 5 celdas | **Una línea de texto**, 7.5 / 12 pt, #737373: `Paciente · Prueba Prueba · 25 años · Exp. 2026-0184` |
| Badge urgente | 8 / 10 pt bajo el título | **7 / 9 pt**, a la derecha de la línea de paciente |
| Aire tras la cabecera | 14 pt | **16 pt** |

## 3 · Ranuras de la entrada

**Sí usa `EntradaNumerada`, variante `estudio`.** Estructura flex, no grid:
`display: flex`, medianil **9 pt**.

| Ranura | Ancho | Contenido | Composición |
|---|---|---|---|
| Riel del número | **23.25 pt**, `flex: none` | `01`, `02`… | Archivo **13 / 17 pt**, 600, `--aink`, cifras tabulares |
| `ancla` | `flex: 1` | Tipo ` · ` Región | Archivo **12.5 / 17 pt**, 600, **−0.005 em** |
| `secundario` | — | Proyecciones | Archivo **10 / 13 pt**, peso **500**, **#454545**. Colapsa sola |
| `marca` | — | **No se usa.** El urgente marca el documento | — |
| `nota` | — | Indicación clínica del estudio | Rótulo colgado + IBM Plex Sans **10.5 / 16 pt**. Colapsa sola |

**El ancla se construye por concatenación:** `tipo + ' · ' + region`. El separador es
punto medio con espacio a ambos lados.

**Ranura `nota` — composición del rótulo colgado.** Es un flex de dos partes, margen
superior 2 pt, medianil 6 pt:
- Rótulo `Indicación`: Archivo **6.5 pt / 16 pt de interlineado**, 600, tracking **0.2 em**, uppercase, #737373, `flex: none`
- Texto: IBM Plex Sans 10.5 / 16 pt, `flex: 1`, `text-align: left`, `text-wrap: pretty`, `orphans: 2`, `widows: 2`

El rótulo existe para distinguir la indicación **del estudio** del diagnóstico **del
documento**, que va una sola vez en el riel.

**Ritmo de la entrada:** padding `5pt 0 6pt`, regla inferior **0.5 pt `#D9D6D0`**,
`break-inside: avoid`.

**Los cuatro estados** están instanciados en la hoja «C y D» del archivo:

| Estado | Proyecciones | Indicación |
|---|---|---|
| 1 · Completa | sí | sí |
| 2 · Sin proyecciones | **colapsa** | sí |
| 3 · Sin indicación clínica | sí | **colapsa** |
| 4 · Solo tipo y región | **colapsa** | **colapsa** |

Colapsan **por separado**: no hay dependencia entre las dos.

## 4 · Cadenas literales impresas

**Encabezado de lista** (Archivo 10 / 14 pt, 600, 0.14 em, uppercase):
```
Estudios                      ← hoja 1 y hoja única
Estudios · continuación       ← hoja de continuación
```

**Contador de lista:**
```
Estudios en esta hoja         ← hoja intermedia · cifra «03 de 06»
Total de estudios             ← hoja final y única · cifra «01», «06»
```

**Badge urgente:** `Urgente` (se compone con `uppercase` → `URGENTE`)

**Notas al servicio** (Archivo 9 / 13 pt, 600, 0.14 em, uppercase):
```
Notas para el servicio de imagen
```

**Rótulo de la ranura `nota`:** `Indicación`

**Aviso de continuación** — dos zonas:
```
Continúa en la hoja 2 · estudios 04 a 06        ← izquierda, tinta negra
Sin firma no es válida                          ← derecha, #737373
```

> Este aviso **sí** sigue la construcción canónica del chasis
> (`CONTINÚA EN LA HOJA N · <ÍTEMS> X A Y`), a diferencia de Laboratorio (D5).
> La zona derecha `Sin firma no es válida` es añadido propio y no está en el chasis.

**Bloque de firma:**
```
Firma y sello del médico
Dr. Ángel M. Ancona Pérez
Céd. Prof. 9552456 · Céd. Esp. 12085805
```

**Etiquetas del riel derecho del encabezado:** `Emisión` · `Folio`
Formato del valor de emisión: `4 ago 2026 · 11:05` — token corto de fecha + hora,
separados por punto medio.

**Etiquetas del riel de identificación:**
`Paciente` · `Edad` · `Sexo` · `Expediente` · `Diagnóstico`

**Segunda línea del membrete:**
```
Céd. Prof. 9552456 · Céd. Esp. 12085805        ← izquierda
Univ. Autónoma de Sinaloa                       ← derecha
```

**Prefijos de folio observados:** `I-` (`I-5B92C4F70AD1`, `I-77E3A0D5C182`)

**Catálogo de tipos de estudio instanciado en el archivo** (el brief declaraba seis):
`Radiografía` · `Resonancia magnética` · `Tomografía computarizada` ·
`Densitometría ósea` · `Ultrasonido`. El sexto valor del catálogo, `otro`, **no
aparece instanciado**. NO DEFINIDO cómo se compone.

## 5 · Valores propios del formato

| Valor | Medida | Nota |
|---|---|---|
| Caja del título | **287 pt** de ancho fijo | Garantiza no colisión con el riel derecho |
| Riel derecho del encabezado | **190 pt**, `flex: none`, medianil interno 16 pt | Dos celdas alineadas a la derecha |
| Filete del encabezado de lista | **64 × 2 pt** acento + 0.8 pt negro | Más corto y fino que el filete principal (96 × 2.5) |
| Badge urgente · hoja 1 | 8 / 10 pt, 600, 0.18 em, padding `2pt 6pt 2.5pt` | Fondo `#101010`, texto `#fff` |
| Badge urgente · continuación | 7 / 9 pt, 600, 0.18 em, padding `1.5pt 5pt 2pt` | Íd. |
| Diagnóstico en el riel | `span 12`, IBM Plex Sans **11 / 15 pt** | Ocupa fila completa, no comparte con fecha ni hora |
| Notas al servicio · medida | **486 pt** | Ancho pleno de la caja |
| Notas al servicio · cuerpo | IBM Plex Sans 10.5 / **17 pt** | ⚠ Ver divergencia D8 |
| Aire antes de la firma | **26 pt** | |
| Aire antes de las notas | **16 pt** | Más filete 0.5 pt `#C9C5BD` y padding 6 pt |
| Firma · caja | **246 pt**, `break-inside: avoid` | |
| Firma · nombre | Archivo **11 / 15 pt**, 600, −0.012 em, margen 4 pt | |
| Firma · cédulas | **IBM Plex Sans** 7.5 / 11 pt, **#737373** | ⚠ Laboratorio usa Archivo 7.5 / 11 pt en #454545 — ver D9 |
| Filete del aviso | 48 × 1.6 pt acento + 0.5 pt `#C9C5BD` | Igual que Laboratorio |

**Reparto de hojas del caso de seis estudios:** 3 en la hoja 1, 3 en la hoja 2. El
archivo lo fija por literal (`slice(0,3)` y `slice(3)`), **no por fórmula**. NO
DEFINIDO cuántos estudios caben realmente por hoja: este formato no tiene el objeto de
presupuesto vertical que sí tiene Laboratorio.

**Sin QR.** Confirmado: no hay ningún elemento de QR en el archivo. El spec del formato
lo declara textualmente: `Arquetipo A · la solicitud no autoriza nada · folio para
trazabilidad`.

## 6 · Componentes del chasis que instancia

| Componente | Variante |
|---|---|
| `PanelCircular` | `monograma` |
| `Membrete` | `completo` / `continuacion` — con línea de cédulas y universidad |
| `TituloDocumento` | `fijo`, caja de 287 pt |
| `BloquePaciente` | `completo` (5 celdas) / `reducido` (línea de texto) |
| `RielDatos` | `celdas` — un solo riel, con diagnóstico a span 12 |
| `EntradaNumerada` | **variante `estudio`** — ancla, secundario, nota. Sin `marca` |
| `BloqueNegativo` | `urgente` / `urgente reducido` |
| `ParserBloques` | Notas al servicio — instanciado como array de párrafos, **no como cadena única** |
| `ContadorLista` | dos formas, `<ÍTEMS>` = ESTUDIOS |
| `BloqueFirmas` | `amplia` — una firma, 77 pt |
| `PieDocumento` | `completo` — sin QR |
| `MotorFlujo` | `break-inside: avoid` en entrada y en firma |

> ⚠ **D10.** `ParserBloques` está declarado en `DOCUMENTOS_SPEC.md` como parser de
> **una sola cadena** con sintaxis de viñetas. En este archivo las notas son un **array de
> dos párrafos** sin viñetas ni encabezados. El diseño no ejercita la sintaxis del parser
> en este formato. **Reportado.**

## Preguntas transversales

**A · Los cuatro desincronizados:**

| Desincronizado | Estado en este archivo |
|---|---|
| Texto corrido 11.5 / 18 pt, bandera izquierda | **Parcial.** La alineación **sí** es bandera izquierda (`text-align: left` explícito en los tres párrafos). El cuerpo **no**: las notas al servicio van a **10.5 / 17 pt** y la indicación clínica a **10.5 / 16 pt**. Ninguno es 11.5 / 18 |
| Campo vacío 20 pt y 246 pt | **No aplicable.** El archivo no instancia ningún campo vacío requerido; todos los campos opcionales colapsan |
| Contador en dos formas | **Aplicado.** `Estudios en esta hoja · 03 de 06` / `Total de estudios · 06` |
| Espacio de firma parametrizado | **Aplicado.** Una firma → 77 pt |

**B · Las tres divergencias de A.4:**

| Divergencia | Valor real |
|---|---|
| Nombre del médico | **22 / 23 pt** hoja 1, **14 / 18 pt** continuación. **Idéntico a Laboratorio** |
| Número de entrada | **13 / 17 pt**, 600. Distinto de Laboratorio (9 y 9.5 pt) y del espécimen (15 pt) |
| Etiqueta de folio | **11 pt** de interlineado. **Idéntico a Laboratorio**, distinto del espécimen |

**C · Marca de estado:** no instanciada. NO DEFINIDO aquí.

**D · Anestesiólogo:** no aplica.


---

# B.3 · RECETA MÉDICA

**Versión aprobada:** `Receta Medica.dc.html`, versión `v1785856977395436`.

Cómo lo identifico: de los cinco archivos de Receta, este es el único que contiene el
documento; los otros cuatro son láminas de test o de exploración. Dentro de este archivo
hay **dos versiones de la misma hoja conviviendo**, y el propio archivo las distingue por
etiqueta:

| Hoja | Etiqueta | Estado |
|---|---|---|
| B | `B · 1 medicamento · corregida` | **Aprobada** |
| B anterior | `B anterior · ronda 2` | **Descartada.** Conservada solo para comparar |

La hoja aprobada es la que aplica la regla de composición de última hoja (firma anclada
al final del contenido, aire debajo de la rúbrica) y el QR abajo. La descartada tiene el
QR **dentro del membrete** y la firma anclada al pie con el folio repetido sobre la
rúbrica. **No extraer valores de la hoja «B anterior».**

**Cambios posteriores a la aprobación:** **ninguno.** La decisión de vía (variante Y) ya
está implementada en este archivo.

## 1 · Título exacto

Cadena literal: `Receta médica` + `uppercase` → imprime `RECETA MÉDICA`.
Sin caja de ancho fijo (`flex: 1; min-width: 0`); el riel derecho mide **210 pt**.
Sin subtítulo.

## 2 · Orden de bloques

**Hoja 1 de 2:**

1. Membrete completo — panel · nombre · especialidad
2. Filete grueso-fino a 8 pt
3. Línea de dirección y teléfono a 6 pt
4. Línea de cédulas y universidad, sin margen propio
5. Aire **10 pt** (14 pt en la hoja de un medicamento)
6. Bloque de título — título / riel derecho de **210 pt** con `Emisión` y `Folio`, medianil interno **20 pt**
7. Filete grueso-fino a 5 pt (6 pt en la hoja de un medicamento)
8. Aire 8 pt (10 pt en la de un medicamento)
9. Riel de identificación — 5 celdas, diagnóstico a span 12
10. Aire 10 pt (20 pt en la de un medicamento)
11. Encabezado de lista + nota de leyenda a la derecha + filete 64 × 2 pt
12. Entradas de medicamento
13. Filete de cierre + contador
14. Espaciador flexible
15. Aviso de continuación
16. Banda de pie

**Hoja 2 de 2 (última):**

1. Cabecera de continuación — rótulo + nombre a 14 / 18 pt / riel de folio
2. Filete grueso-fino a 6 pt
3. Línea de paciente **y fecha de emisión**, 7.5 / 12 pt, #737373
4. Aire 14 pt
5. Encabezado `Medicamentos · continuación` — 9 / 13 pt, **#454545**
6. Filete **48 × 1.6 pt** + 0.5 pt `#C9C5BD` (más discreto que el de la hoja 1)
7. Entradas restantes
8. Filete de cierre + contador
9. Aire 14 pt
10. **Recomendaciones generales** — filete 0.5 pt `#C9C5BD` + padding 6 pt
11. Aire 12 pt
12. **Bloque de alarma**
13. Aire 26 pt
14. Fila de cierre: firma a la izquierda (246 pt) · QR y folio de verificación a la derecha
15. Espaciador flexible
16. Banda de pie

## 3 · Ranuras de la entrada

`EntradaNumerada`, variante `medicamento`. Flex, medianil 9 pt.

**Jerarquía invertida respecto del sistema viejo**, confirmada en el archivo:

| Ranura | Contenido | Composición (lista de 7) | Composición (lista de 1) |
|---|---|---|---|
| Riel del número | `01`… | Archivo **13 / 16 pt**, 600, `--aink` | Archivo **14 / 17 pt**, 600 |
| `ancla` | Comercial ` · ` Presentación | Archivo **12 / 16 pt**, 600, −0.005 em | Archivo **12.5 / 17 pt**, 600, −0.005 em |
| `secundario` | **Genérico** | Archivo **10 / 13 pt**, peso **500**, **sin color declarado → hereda `#101010`** | Archivo **10.5 / 14 pt**, 500 |
| `marca` | Vía — dos tratamientos, ver abajo | | |
| `nota` | Indicación | IBM Plex Sans **10 / 14 pt**, medida **381 pt**, margen 3 pt | IBM Plex Sans **10.5 / 16 pt**, medida **381 pt**, margen 4 pt |

**El genérico va en tinta plena.** El archivo no declara `color` en ese div, así que
hereda `#101010` del contenedor de la sección. Esto cumple la regla 5 de
`EntradaNumerada` del spec de implementación.

**El ancla se construye por concatenación:** `comercial + ' · ' + presentacion`.

### Ranura `marca` — tratamiento binario de la vía (variante Y, aprobada)

El archivo decide por `oral = (via === 'Oral')`:

**Vía oral — texto plano, no bloque:**
```
<Vía> Oral      ← «Vía» en #737373, el valor hereda #101010
```
Archivo **7.5 pt / 13 pt de interlineado**, peso 600, tracking **0.2 em**, uppercase.
Sin margen superior propio.

**Vía no oral — bloque en negativo:**
```
Vía Subcutánea
```
`display: inline-block`, fondo `#101010`, texto `#fff`, padding **`2pt 6pt 2.5pt`**,
Archivo **8 pt / 10 pt**, peso 600, tracking **0.18 em**, uppercase.
Contenedor con margen superior **2 pt**.

**La palabra «Vía» va dentro del bloque**, no fuera: la cadena es `Vía ` + nombre.

### Los tres estados de la entrada

Instanciados en la hoja `D y G`. Ambos campos vacíos usan **rótulo + línea, sin
leyenda**:

| Estado | Composición |
|---|---|
| 1 · Completa | Ancla + genérico normales |
| 2 · Sin genérico | Ancla normal; el genérico se sustituye por rótulo `Genérico` + línea |
| 3 · Sin presentación | El ancla se reduce a solo el comercial (`Tempra`); la presentación se sustituye por rótulo `Presentación` + línea, debajo |

**Composición del campo vacío en la lámina de estados:**
- Contenedor flex, `align-items: baseline`, medianil **5 pt**, margen superior 2 pt
- Rótulo: Archivo **6 pt / 9 pt**, 600, tracking **0.18 em**, uppercase, #737373
- Línea: `flex: 1`, `border-bottom: 0.8pt solid #101010`, **alto 11 pt**

> ⚠ **D12 — el campo vacío de la lámina no cumple el token del chasis.** El chasis fija
> `manuscrito.alto` = **20 pt** y `manuscrito.ancho` = **246 pt**. La lámina de estados
> usa alto **11 pt** y ancho `flex: 1` dentro de una celda de un tercio de la caja.
> Es la lámina a escala reducida (tres estados lado a lado), así que puede ser una
> reducción de presentación y no el valor normativo — pero **el archivo no lo declara**.
> El valor a 2× está en `Receta - Entrada, tres estados.dc.html`, que no extraje.
> **Reportado, no resuelto.** NO DEFINIDO cuál es el valor normativo en este archivo.

## 4 · Cadenas literales impresas

**Encabezado de lista y su nota:**
```
Medicamentos                              ← 10 / 14 pt, 600, 0.14 em, uppercase
Vía no oral en negativo                   ← IBM Plex Mono 7.5 pt, 0.1 em, #737373
Medicamentos · continuación               ← hoja 2, 9 / 13 pt, #454545
```

> ⚠ **D13.** La nota `Vía no oral en negativo` es una leyenda **explicativa del sistema
> de diseño**, en IBM Plex Mono, impresa en el documento que recibe el paciente. Está en
> las hojas A1, B, C, F1 del archivo. IBM Plex Mono no es una familia del chasis para
> documentos impresos. **Reportado:** probablemente es notación de la lámina que quedó
> dentro del documento, pero el archivo no la distingue del contenido.

**Contador de lista:**
```
Medicamentos en esta hoja     · cifra «04 de 07»
Total de medicamentos         · cifra «07», «01»
```

**Aviso de continuación:**
```
Continúa en la hoja 2 · medicamentos 05 a 07      ← izquierda
Sin firma no es válida                            ← derecha, #737373
```

**Recomendaciones generales:**
```
Recomendaciones generales
```

**Bloque de alarma — encabezado y cuerpo:**
```
Acuda de inmediato a urgencias si presenta
```

**Firma:**
```
Firma del médico                    ← nota: no dice «Firma y sello», a diferencia de Laboratorio e Imagenología
Dr. Ángel M. Ancona Pérez
Céd. Prof. 9552456 · Céd. Esp. 12085805
```

> ⚠ **D14.** El rótulo de la firma es `Firma del médico` en Receta y
> `Firma y sello del médico` en Laboratorio e Imagenología. **Reportado.**

**Zona de verificación:**
```
Verificación
P-B8570E3FA164
```

**Vista previa — riel derecho:**
```
Emisión        → valor «Pendiente»
Estado         → valor «Vista previa» (10 / 14 pt, 600, 0.14 em, uppercase)
```
La celda de `Folio` **se sustituye** por la de `Estado`; el riel pasa de 210 a **246 pt**.
En la banda de pie, la zona de folio se sustituye por `Sin validez · Vista previa`.
**No hay contradicción de folio:** no aparece en ninguna de las dos posiciones.

**Marca de estado (solo en la hoja de vista previa):**
```
Sin validez · Vista previa
```

**Etiquetas del riel de identificación:** `Paciente` · `Edad` · `Sexo` · `Expediente` · `Diagnóstico`

**Prefijo de folio:** `P-` (`P-B8570E3FA164`, `P-6C41A9D2E870`)

**Catálogo de las 13 vías**, en el orden literal del archivo:
```
Oral · Sublingual · Tópica · Transdérmica · Oftálmica · Ótica · Nasal ·
Inhalación · Intramuscular · Intravenosa · Subcutánea · Rectal · Vaginal
```
`Transdérmica` **está presente**, en cuarta posición. `parenteral` no aparece.

## 5 · Valores propios del formato

**Bloque de alarma** — el único del sistema con filete de 3 pt:

| Valor | Medida |
|---|---|
| Filete superior e izquierdo | **3 pt sólido `#101010`** — no acento |
| Padding | `6pt 0 8pt 14pt` → sangría izquierda **14 pt** |
| Ancho | **486 pt**, `box-sizing: border-box` |
| Encabezado | Archivo **9.5 / 13 pt**, 600, tracking **0.22 em**, uppercase |
| Cuerpo | IBM Plex Sans **12 / 18 pt**, peso **500**, bandera izquierda |

> ⚠ **D15.** La sangría es **14 pt**. El chasis (`DOCUMENTOS_SPEC.md` I.2 · 2.I y I.1.7)
> declara `espacio.16` y marca el 14 como `CORRIGE HANDOFF` porque no es múltiplo de 4.
> El diseño aprobado sigue en 14. **Reportado, no resuelto.**

> ⚠ **D16.** El cuerpo de la alarma es **12 / 18 pt peso 500**, mayor que el texto corrido
> de 11.5 / 18. Es deliberado (jerarquía por peso y cuerpo, no por color), pero **el
> chasis no declara un miembro de escala para él**. NO DEFINIDO como token.

**Recomendaciones generales:**
- Filete de apertura: 0.5 pt `#C9C5BD`, padding superior 6 pt
- Encabezado: Archivo 9 / 13 pt, 600, 0.14 em, uppercase
- Cuerpo: IBM Plex Sans **11.5 / 18 pt**, medida **486 pt**, bandera izquierda, margen 4 pt

**Este es el único bloque del sistema que sí usa el cuerpo de texto corrido del chasis
(11.5 / 18 pt) y la medida de 486 pt.**

**Fila de cierre de la última hoja** — flex, `justify-content: space-between`,
`align-items: flex-end`, medianil 24 pt:
- Izquierda: bloque de firma de **246 pt**
- Derecha: flex de medianil 12 pt con la etiqueta `Verificación` + folio, y el QR de **56 × 56 pt**

**Aire antes de la fila de cierre:** 26 pt (hoja de 7) · **28 pt** (hoja de 1)

**Marca de estado — valores en pt** (responde la pregunta C):

| Valor | Medida |
|---|---|
| Rotación | **−9°** |
| Cuerpo | **22 pt**, `line-height: 1` |
| Peso | 600 |
| Tracking | **0.14 em** |
| Relleno | `transparent` |
| Contorno | **0.5 pt**, `rgba(0,0,0,.5)` |
| Posición | Contenedor `position: relative` del aviso de pie; la marca es `absolute`, `bottom: 20pt`, centrada, `pointer-events: none` |

> Difiere del espécimen: **−9° contra −28°**, contorno **0.5 pt contra 0.7 pt**, y la
> zona es el **pie de la hoja**, no el centro. Es la reubicación pedida en la ronda 2
> para que no cruce los nombres de los medicamentos. **El valor de este archivo es el
> vigente para Receta.** NO DEFINIDO para los demás formatos.

**Riel del número — relación con el margen, declarada en el spec del archivo:**
```
23.25 pt + 9 pt de medianil = 32.25 pt = 1 columna de 12
Margen izq. 72 pt → el texto de la entrada arranca a 104.25 pt del borde
```
Esto **confirma** el 23.25 pt del spec de implementación (I.1.3 `reticula.riel`).

**Ancho máximo del bloque de vía, declarado en el archivo:** `«Vía Intramuscular» 108 pt`

**Reparto de hojas del caso de 7:** 4 en la hoja 1, 3 en la hoja 2. Fijado por literal
(`slice(0,4)`, `slice(4)`), **no por fórmula.** NO DEFINIDO cuántos medicamentos caben
por hoja.

## 6 · Componentes del chasis que instancia

| Componente | Variante |
|---|---|
| `PanelCircular` | `monograma` |
| `Membrete` | `completo` / `continuacion` |
| `TituloDocumento` | `fijo`, sin caja fija, riel de 210 pt (246 en vista previa) |
| `BloquePaciente` | `completo` (5 celdas) / `reducido` (línea con paciente **y fecha**) |
| `RielDatos` | `celdas` |
| `Campo` | `con valor` y **`vacío requerido`** (genérico y presentación) |
| `EntradaNumerada` | variante `medicamento` — las cuatro ranuras ocupadas |
| `BloqueNegativo` | `via`, **solo para no orales** |
| `BloqueDestacado` | `alarma` — filete 3 pt superior e izquierdo |
| `ParserBloques` | Recomendaciones — **un solo párrafo literal, sin viñetas** |
| `ContadorLista` | dos formas, `<ÍTEMS>` = MEDICAMENTOS |
| `BloqueFirmas` | `amplia` — 77 pt |
| `PieDocumento` | `completo` con QR en el cuerpo (no en el pie) |
| Marca de estado | `SIN VALIDEZ · VISTA PREVIA` |

> ⚠ **D17.** El QR vive en el **cuerpo** de la última hoja, en la fila de cierre junto a
> la firma, no en el pie. `DOCUMENTOS_SPEC.md` II.3 lo lista bajo «Identidad» y su
> composición dice `PieDocumento completo con QR`. Son dos ubicaciones distintas.
> **Reportado.**

## Preguntas transversales

**A · Los cuatro desincronizados:**

| Desincronizado | Estado en este archivo |
|---|---|
| Texto corrido 11.5 / 18 pt, bandera izquierda | **Parcial y mezclado.** Recomendaciones generales: **11.5 / 18 pt** ✔. Alarma: **12 / 18 pt peso 500** (deliberado). Indicación de la entrada: **10 / 14 pt** (lista de 7) y **10.5 / 16 pt** (lista de 1), medida **381 pt** ✘. Bandera izquierda: sí en todos |
| Campo vacío 20 pt y 246 pt | **No cumplido en la lámina de estados**: 11 pt de alto, ancho flexible. Ver D12 |
| Contador en dos formas | **Aplicado** |
| Espacio de firma parametrizado | **Aplicado.** Una firma → 77 pt |

**B · Las tres divergencias de A.4:**

| Divergencia | Valor real |
|---|---|
| Nombre del médico | **22 / 23 pt** hoja 1, **14 / 18 pt** continuación. **Idéntico a Laboratorio e Imagenología** |
| Número de entrada | **13 / 16 pt** (lista de 7), **14 / 17 pt** (lista de 1). Quinto y sexto valor del sistema |
| Etiqueta de folio | **11 pt**. **Idéntico a Laboratorio e Imagenología** |

**C · Marca de estado:** **22 pt**, rotación −9°, contorno 0.5 pt, tracking 0.14 em,
anclada al pie. Ver §5.

**D · Anestesiólogo:** no aplica.


---

# B.4 · PLAN DE SUPLEMENTACIÓN

**Versión aprobada:** `Plan de Suplementacion.dc.html`, versión `v1785856977395436`.
Archivo único. Lo identifico como aprobado porque aplica las dos correcciones de su
última ronda —contador unificado en las dos hojas y medida de texto corrido a 486 pt,
eliminando los 453.75 pt— y no hubo ronda posterior.

**Cambios posteriores a la aprobación:** **ninguno.**

## 1 · Título exacto

Cadena literal: `Plan de suplementación` + `uppercase` → `PLAN DE SUPLEMENTACIÓN`.
Sin caja fija; riel derecho de **210 pt**, igual que Receta. Sin subtítulo.

## 2 · Orden de bloques

**Hoja 1:** membrete completo (con línea de cédulas y universidad) → filete a 8 pt →
dirección a 6 pt → cédulas → aire **12 pt** → título / riel de 210 pt → filete a 5 pt →
aire 10 pt → riel de identificación → aire **14 pt** → encabezado de lista + eco del peso
→ filete 64 × 2 pt → entradas → cierre + contador → notas → cita → firma → espaciador →
aviso → banda.

**Hoja de continuación:** rótulo + nombre 14 / 18 pt / riel de folio → filete a 6 pt →
**línea de paciente con peso y fecha** → aire 16 pt → encabezado `Suplementos ·
continuación` → resto.

**Riel de identificación — la fila del peso.** Es la aportación estructural del formato:

| Celda | Columnas | Notas |
|---|---|---|
| Paciente | span 5 | |
| Edad | span 2 | regla izq. 0.5 pt |
| Sexo | span 2 | regla izq. 0.5 pt |
| Expediente | span 3 | regla izq. 0.5 pt |
| **Peso** | span **4** con diagnóstico · span **12** sin diagnóstico | regla sup. 0.5 pt · **borde derecho 2 pt acento** |
| Diagnóstico | span 8 | regla sup. 0.5 pt · colapsa |

El `pesoSpan` es una prop del archivo: **4 si hay diagnóstico, 12 si no**. Cuando el peso
colapsa, el diagnóstico permanece a span 8 y el riel **no** redistribuye. NO DEFINIDO qué
pasa con el hueco de 4 columnas en ese caso — el archivo no instancia esa combinación.

## 3 · Ranuras de la entrada

`EntradaNumerada`, variante `suplemento`. **Solo dos ranuras ocupadas.**

| Ranura | Contenido | Composición |
|---|---|---|
| Riel del número | `01`… | Archivo **13 / 17 pt**, 600, `--aink`, tabulares |
| `ancla` | Nombre ` · ` Dosis | Archivo **12.5 / 17 pt**, 600, −0.005 em, **cifras tabulares** |
| `secundario` | — colapsa | |
| `marca` | — **no aplica en este formato** | |
| `nota` | Justificación | IBM Plex Sans **11.5 / 18 pt**, medida **486 pt**, margen 2 pt, `orphans: 2`, `widows: 2`. Colapsa entera |

**Ritmo:** padding `5pt 0 6pt`, regla 0.5 pt `#D9D6D0`, `break-inside: avoid`.

**El ancla lleva cifras tabulares**, a diferencia de Receta e Imagenología: la dosis es
numérica y se alinea.

> ⚠ **D19 — el spec del propio archivo se contradice con su marcado.** La ficha F del
> archivo declara la justificación como `Plex Sans 10.5 / 16 pt · 486 pt`. El marcado la
> compone a **11.5 / 18 pt**. El valor del marcado es el que imprime y es el que cumple el
> token del chasis; la ficha quedó sin actualizar tras el cambio de interlineado.
> **Reportado.**

## 4 · Cadenas literales impresas

**Encabezado de lista y su eco:**
```
Suplementos                                ← 10 / 14 pt, 600, 0.14 em, uppercase
Suplementos · continuación                 ← hoja 2
Dosis calculada para 72.5 kg               ← IBM Plex Mono 7.5 pt, 0.1 em, #737373
```
El eco del peso colapsa con el peso.

> ⚠ **D20.** El eco va en IBM Plex Mono, igual que la leyenda de Receta (D13). Es la
> segunda aparición de la mono en un documento impreso. **Reportado.**

**Contador:**
```
Suplementos en esta hoja      · cifra «06 de 09»
Total de suplementos          · cifra «09», «01»
```

**Peso — dos rótulos en la misma celda:**
```
Peso                    ← 7 / 10 pt, 600, 0.22 em, #737373
Base del cálculo        ← 6.5 / 10 pt, 600, 0.18 em, #101010
72.5 kg                 ← 14 / 16 pt, 600, tabulares
```
Los dos rótulos van en un flex `align-items: baseline`, medianil 6 pt. El segundo va en
**tinta plena**, no en gris: es lo que declara la función del dato.

**Notas adicionales:**
```
Notas adicionales
```

**Cita de control:**
```
Cita de control                              ← 7.5 / 11 pt, 600, 0.22 em, #454545
4 de noviembre de 2026                       ← 14 / 18 pt, 600, −0.01 em, tabulares
a 3 meses                                    ← IBM Plex Mono 8 pt, 0.06 em, #454545
Traer densitometría y biometría de control.  ← Plex Sans 9.5 / 13 pt, #454545
```

**Aviso de continuación:**
```
Continúa en la hoja 2 · suplementos 07 a 09     ← izquierda
Sin firma no es válido                          ← derecha, #737373
```
> Nota de género: `no es válido` (masculino, concuerda con «plan»), contra
> `no es válida` de Receta e Imagenología (concuerda con «receta» / «solicitud»). Es
> correcto gramaticalmente, pero significa que **la cadena de la zona derecha del aviso
> se parametriza por formato**, no es constante del chasis.

**Firma:** `Firma del médico` — igual que Receta, distinto de Laboratorio (D14).

**Verificación:** `Verificación` + folio + QR de 56 × 56 pt, en fila de cierre con la
firma. Misma composición que Receta.

**Prefijos de folio:** `S-` (`S-3D71E0B4C296`, `S-90C42F18AE73`)

**Catálogo de los 9 suplementos**, en el orden literal del archivo:
```
Vitamina D3 · Citrato de calcio · Magnesio · Colágeno hidrolizado · Omega 3 ·
Vitamina C · Complejo B · Zinc · Ácido fólico
```

## 5 · Valores propios del formato

**Cita de control** — `BloqueDestacado` variante `cita`:

| Valor | Medida |
|---|---|
| Filete superior e izquierdo | **1.6 pt sólido `#101010`** — la mitad de la alarma, no acento |
| Padding | `6pt 0 7pt 12pt` → sangría izquierda **12 pt** |
| Ancho | **294 pt**, `box-sizing: border-box` — no ocupa la caja completa |
| `break-inside` | `avoid` |
| Aire antes | 14 pt |

> ⚠ **D21.** La sangría de la cita es **12 pt** y la de la alarma de Receta **14 pt**. El
> chasis (2.I regla 2) declara `espacio.16` **para las tres variantes**. Ninguna de las
> dos cumple, y además difieren entre sí. **Reportado, no resuelto.**

**Celda de peso — marca de función:** `border-right: 2pt solid var(--accent)`. Es el
único uso de un filete de acento como borde de celda en todo el sistema extraído.

**Notas adicionales:** filete de apertura 0.5 pt `#C9C5BD` + padding 6 pt; encabezado
Archivo 9 / 13 pt, 600, 0.14 em; párrafos IBM Plex Sans **11.5 / 18 pt**, medida **486 pt**,
margen 5 pt, con `orphans` y `widows` a 2.

**Fila de cierre:** idéntica a Receta — firma de 246 pt a la izquierda, verificación y QR
a la derecha, medianil 24 pt, aire previo **26 pt**, `break-inside: avoid`.

**Reparto del caso de 9:** 6 en la hoja 1, 3 en la hoja 2. Por literal, no por fórmula.
NO DEFINIDO cuántos suplementos caben por hoja.

## 6 · Componentes del chasis que instancia

| Componente | Variante |
|---|---|
| `PanelCircular` | `monograma` |
| `Membrete` | `completo` / `continuacion` |
| `TituloDocumento` | `fijo`, riel de 210 pt |
| `BloquePaciente` | `completo` (con celda de peso) / `reducido` (línea con peso y fecha) |
| `RielDatos` | `celdas` — con span condicional |
| `Campo` | `con valor` y `vacío opcional` (peso, diagnóstico, justificación, notas, cita colapsan) |
| `EntradaNumerada` | variante `suplemento` — dos ranuras |
| `BloqueNegativo` | **no se usa** |
| `BloqueDestacado` | `cita` — filete 1.6 pt |
| `ParserBloques` | Notas — array de párrafos, sin viñetas (igual que Imagenología, D10) |
| `ContadorLista` | dos formas, `<ÍTEMS>` = SUPLEMENTOS |
| `BloqueFirmas` | `amplia` — 77 pt |
| `PieDocumento` | `completo`, QR en el cuerpo (D17) |

## Preguntas transversales

**A · Los cuatro desincronizados:**

| Desincronizado | Estado |
|---|---|
| Texto corrido 11.5 / 18 pt, bandera izquierda | **Aplicado por completo.** Justificación, notas: 11.5 / 18 pt, 486 pt, bandera izquierda. **Es el formato que mejor cumple el token** |
| Campo vacío 20 pt y 246 pt | **No aplicable.** Todos los campos ausentes son opcionales y colapsan; no hay ningún vacío requerido |
| Contador en dos formas | **Aplicado** |
| Espacio de firma parametrizado | **Aplicado.** Una firma → 77 pt |

**B · Las tres divergencias de A.4:**

| Divergencia | Valor real |
|---|---|
| Nombre del médico | **22 / 23 pt** / **14 / 18 pt**. Idéntico a Lab, Imagen y Receta — **cuatro formatos coinciden** |
| Número de entrada | **13 / 17 pt**. Idéntico a Imagenología |
| Etiqueta de folio | **11 pt**. Idéntico a los tres anteriores — **cuatro formatos coinciden** |

**C · Marca de estado:** no instanciada. NO DEFINIDO aquí.

**D · Anestesiólogo:** no aplica.


---

# B.5 · RECIBO DE HONORARIOS / COTIZACIÓN

**Versión aprobada:** `Recibo y Cotizacion.dc.html`, versión `v1785857035134486`.
Archivo único. Lo identifico como aprobado porque incorpora las cuatro correcciones de
su última ronda —forma de pago reducida al método, QR solo en cotización, columna
`Origen` colapsada cuando no hay terceros con marca tipográfica en vez de chip, y fecha
del anticipo— más la decisión de conservar la hoja 2 con el aviso canónico.

**Cambios posteriores a la aprobación:** **ninguno.**

## 1 · Título exacto — dos valores

| Valor | Cadena literal | Imprime |
|---|---|---|
| Cotización | `Cotización` | `COTIZACIÓN` |
| Recibo | `Recibo de honorarios` | `RECIBO DE HONORARIOS` |

Riel derecho de **156 pt** (no 210 como Receta y Suplementación).

**Subtítulo con rótulo** — es el único formato que rotula su subtítulo:
```
Procedimiento o motivo          ← 7 / 11 pt, 600, 0.22 em, uppercase, #737373, margen 4 pt
Artrodesis lumbar instrumentada L4-L5    ← Plex Sans 11 / 15 pt
```

## 2 · Orden de bloques

**Cotización (hoja única):** membrete **sin línea de cédulas** → aire 12 pt → título +
rótulo + subtítulo / riel de 156 pt → filete a 6 pt → aire 8 pt → riel de identificación
de **3 celdas** → aire 10 pt → **bloque de aseguradora** → aire 12 pt → tabla de
**4 columnas** → cierre → aire 10 pt → **fila de cierre de dos columnas** → espaciador →
banda.

**Recibo de 14 (hoja 1 de 2):** igual hasta el riel, que es de **2 celdas**; tabla de
**3 columnas** (sin `Origen`); cierre; aire 10 pt; fila de cierre con nota a la izquierda
y rail de importes a la derecha; espaciador; **aviso canónico**; banda.

**Recibo de 14 (hoja 2 de 2):** cabecera de continuación → línea de paciente **con eco
del total** → aire 24 pt → columna única de 246 pt con forma de pago y firma → espaciador
→ banda.

**Recibo mínimo (hoja única):** igual que el de 14 pero con paciente en **campo vacío
requerido**, una fila, fila de cierre, y **bloque de observaciones rayado** al final.

> ⚠ **D23.** El membrete de este formato **no lleva la línea de cédulas y universidad**
> que sí tienen Imagenología, Receta y Suplementación. Solo dirección y teléfono, como
> Laboratorio. Dos membretes distintos conviviendo en el sistema. **Reportado.**

## 3 · Ranuras de la entrada

**No usa `EntradaNumerada`.** Usa `Tabla` en modo grid, con **dos anchos de retícula
distintos según haya mezcla de origen**:

**Con mezcla (cotización):** `grid-template-columns: 23.25pt 1fr 66pt 96pt`, medianil 9 pt

| Columna | Ancho | Contenido | Alineación |
|---|---|---|---|
| 1 | 23.25 pt | Número | derecha |
| 2 | `1fr` | Concepto | izquierda |
| 3 | **66 pt** | **Origen** | izquierda |
| 4 | 96 pt | Precio | derecha |

**Sin mezcla (recibo):** `grid-template-columns: 23.25pt 1fr 96pt` — la columna `Origen`
**desaparece de la retícula**, no queda vacía.

**Marca de origen — tipográfica, sin caja.** Archivo **7 pt / 13 pt**, tracking 0.18 em,
uppercase, y se distingue por **peso y tinta**:

| Origen | Peso | Tinta |
|---|---|---|
| `Propio` | **600** | `#101010` |
| `Tercero` | **400** | `#737373` |

El archivo lo justifica: en fotocopia la diferencia entre 600 negro y 400 gris se
conserva; la de un cuadro relleno frente a uno hueco, no.

**Filas — tres calibraciones:**

| Caso | Padding | Regla | Número | Concepto | Precio |
|---|---|---|---|---|---|
| Cotización (4) | 3.5 pt | 0.5 pt `#EDEAE4` | 9 / 13 pt | 10.5 / 13 pt | 10.5 / 13 pt |
| Recibo (14) | 2 pt | 0.5 pt `#EDEAE4` | 9 / 12.5 pt | 10 / 12.5 pt | 10 / 12.5 pt |
| Recibo mínimo (1) | 4 pt | 0.5 pt `#D9D6D0` | 9.5 / 14 pt | 10.5 / 14 pt | 10.5 / 14 pt |

Todas con `align-items: baseline` y cifras tabulares en número y precio.

**No hay contador de lista en ninguna hoja de este formato.** El cierre de tabla es solo
el filete de 0.8 pt.

> ⚠ **D24.** `DOCUMENTOS_SPEC.md` II.5 §3 declara `ContadorLista` con
> `<ÍTEMS>` = CONCEPTOS. **El diseño no lo instancia.** Ni en la hoja 1 del recibo de 14,
> que es hoja intermedia y según la regla del chasis debería llevarlo. **Reportado.**

## 4 · Cadenas literales impresas

**Cabecera de tabla:**
```
#   Concepto   Origen   Precio     ← con mezcla
#   Concepto   Precio               ← sin mezcla
```

**Valores de origen:** `Propio` · `Tercero`

**Bloque de aseguradora:**
```
Aseguradora                        ← 7 / 11 pt, 600, 0.22 em, #737373
Grupo Nacional Provincial          ← 11 / 15 pt, peso 500
Póliza      → GNP-4471-882301      ← rótulo 6.5 / 10 pt, valor 10 / 13 pt tabular
Cobertura   → Gastos mayores       ← rótulo 6.5 / 10 pt, valor 10 / 13 pt
```

**Rail de importes — cotización (con subtotales):**
```
Honorarios del médico    $45,000.00
Estimado de terceros    $145,000.00
Total estimado                        ← 8 / 11 pt, 600, 0.22 em
MXN · Pesos mexicanos                 ← IBM Plex Mono 7.5 / 11 pt, 0.1 em, #454545
$190,000.00                           ← 22 / 24 pt, 600, −0.012 em, tabular
```

**Rail de importes — recibo (sin subtotales, con anticipo):**
```
Total
USD · Dólares estadounidenses
$18,400.00
Anticipo recibido        −$6,000.00
12 jul 2026                           ← IBM Plex Mono 6.5 / 10 pt, 0.06 em, #737373, margen −2 pt
Saldo pendiente          $12,400.00   ← rótulo peso 600, cifra 12 / 15 pt peso 600
```

**Leyenda no fiscal** — marco parcial de 2 pt acento:
```
Documento informativo                                       ← 9.5 / 13.5 pt, 600, 0.02 em
No es un Comprobante Fiscal Digital por Internet (CFDI).    ← Plex Sans 9.5 / 13.5 pt
```

**Nota que sustituye a la columna Origen:**
```
Origen de los conceptos
Todos los conceptos de esta relación corresponden a honorarios del médico que suscribe. No incluye costos de hospital, anestesiología ni material.     ← recibo de 14
Honorarios del médico que suscribe.                                                    ← recibo mínimo
```

**Notas y consideraciones** (solo cotización):
```
Notas y consideraciones
Los importes marcados como estimado de terceros son referencia de costos de hospital, anestesiología y material, sujetos a la tarifa vigente de cada proveedor el día del procedimiento. No se facturan ni se reciben por este consultorio.
```

**Forma de pago:**
```
Forma de pago
Método    → Transferencia electrónica    /    Efectivo
```
Rótulo `Método` en IBM Plex Mono 6.5 pt, 0.1 em, uppercase, #737373. Valor 9.5 / 13 pt.

**Aviso de continuación — el canónico del chasis:**
```
Reservado para la firma · continúa en la hoja 2      ← izquierda
El recibo no es válido sin ella                      ← derecha, #737373
```

**Eco del total en la hoja 2:**
```
Paciente · Prueba Prueba
14 conceptos · total $18,400.00 USD en la hoja 1
```

**Observaciones (recibo mínimo):** `Observaciones` — sin «del laboratorio».

**Etiquetas de riel:** `Paciente` · `Fecha de emisión` · `Vigencia`

**Prefijos de folio:** `Q-` cotización, `R-` recibo

## 5 · Valores propios del formato

**Celda de vigencia — único fondo de color del sistema:**
```
background: color-mix(in srgb, var(--accent) 8%, #fff)
```
Rótulo `Vigencia` en **#454545** (no #737373, como el resto de etiquetas del riel), valor
11.5 / 13 pt **peso 600** (el resto del riel va en 400).

> ⚠ **D25.** Es el único fondo de color aplicado a una celda en los cinco formatos
> extraídos. `DOCUMENTOS_SPEC.md` I.3.3 exige que el color nunca sea el único portador de
> significado; aquí la vigencia se distingue **además** por peso y por tinta del rótulo,
> así que sobrevive la fotocopia. Pero el token `acento.velo` del chasis está definido al
> **94 %** (≈6 %) y esta celda usa **8 %**. Dos valores de velo. **Reportado.**

**Bloque de aseguradora** — marco parcial de dos lados:
- Filete superior e izquierdo **2 pt acento**
- Padding `6pt 12pt 8pt`, ancho **426 pt**
- Colapsa entero, no por celdas

**Leyenda no fiscal** — mismo recurso: filete 2 pt acento superior e izquierdo, padding
`6pt 10pt 8pt`.

> Tres bloques del sistema usan el marco parcial de **2 pt acento**: aseguradora, leyenda
> no fiscal (Recibo) y la declaración del Consentimiento. `BloqueDestacado` del chasis
> declara solo tres variantes —alarma 3 pt, instrucciones 2 pt, cita 1.6 pt— **todas en
> tinta negra**. El marco de 2 pt **en acento** no está declarado como variante.
> **Reportado como D26.**

**Rail de importes:** ancho **246 pt**, `flex: none`. Retícula interna
`grid-template-columns: 1fr auto`, medianil `0 14pt`.

**Cifra del total:** Archivo **22 / 24 pt**, 600, −0.012 em, cifras tabulares. Es el
cuerpo más grande del sistema después del nombre del médico.

**Fila de cierre — dos disposiciones distintas:**

| Caso | Izquierda | Derecha |
|---|---|---|
| Cotización | QR + verificación, y debajo la firma | Rail de importes + leyenda + notas |
| Recibo de 14 (hoja 1) | Nota de origen, `flex: 1`, padding derecho 24 pt | Rail de importes + leyenda |
| Recibo de 14 (hoja 2) | Forma de pago + firma, 246 pt | **vacía** |
| Recibo mínimo | Forma de pago + firma | Rail + nota de origen + leyenda |

**Zona de QR — solo cotización.** Composición distinta de la de Receta:
- QR 56 × 56 pt a la **izquierda**, medianil 14 pt
- Etiqueta `Verificación` + filete corto **40 × 1.6 pt** acento + folio 10 / 14 pt

**Presupuesto vertical declarado en el archivo:**

| Token | Valor | Qué mide |
|---|---|---|
| `util` | 670 | |
| `cierre` | **290** | Importes + leyenda + firma de 77 pt · **bloque indivisible** |
| `fila` | 17.5 | |
| `cabTabla` | 16 | |
| `aviso` | 46 | |

```
filasPorHoja(encabezado, conCierre) =
  ⌊(670 − encabezado − 16 − (conCierre ? 290 + 10 : 46)) / 17.5⌋
```

**Firma:** nombre a **10 / 14 pt** (no 11 / 15 como Receta y Suplementación, ni 11.5 / 15
como Laboratorio). Cuarto valor del sistema para el nombre bajo la firma.

## 6 · Componentes del chasis que instancia

| Componente | Variante |
|---|---|
| `PanelCircular` | `monograma` |
| `Membrete` | `completo` **sin línea de cédulas** (D23) / `continuacion` |
| `TituloDocumento` | `fijo` con **dos valores**, riel de 156 pt, con rótulo de subtítulo |
| `BloquePaciente` | `completo` (2–3 celdas) / `reducido` |
| `RielDatos` | `celdas` · más un segundo riel para aseguradora |
| `Campo` | `con valor`, **`vacío requerido`** (paciente en el mínimo: línea 0.8 pt, **alto 16 pt**), `vacío opcional` |
| `Tabla` | modo grid, **3 o 4 columnas según mezcla** |
| `ContadorLista` | **no instanciado** (D24) |
| `BloqueDestacado` | marco 2 pt **acento** — variante no declarada (D26) |
| `ParserBloques` | Notas — párrafo literal |
| `BloqueFirmas` | `amplia` — 77 pt |
| `PieDocumento` | `completo`; QR solo en cotización |
| `MotorFlujo` | Aviso canónico `RESERVADO PARA LA FIRMA` |

> ⚠ **D27.** El campo vacío de paciente en el recibo mínimo usa **alto 16 pt**. El chasis
> fija `manuscrito.alto` = **20 pt**. Tercer valor del sistema para el mismo token, tras
> los 16 pt del espécimen y los 11 pt de la lámina de Receta. **Reportado.**

## Preguntas transversales

**A · Los cuatro desincronizados:**

| Desincronizado | Estado |
|---|---|
| Texto corrido 11.5 / 18 pt, bandera izquierda | **No cumplido en ninguno de los dos ejes.** Las notas van a **9.5 / 14 pt** y, en la cotización, **justificadas con `hyphens: auto`**. Es el único texto justificado que queda en el sistema extraído, y el chasis lo prohíbe sin excepción (I.3.2). **Reportado como D28** |
| Campo vacío 20 pt y 246 pt | **No cumplido.** 16 pt de alto, ancho de celda (D27) |
| Contador en dos formas | **No instanciado** (D24) |
| Espacio de firma parametrizado | **Aplicado.** Una firma → 77 pt |

**B · Las tres divergencias de A.4:**

| Divergencia | Valor real |
|---|---|
| Nombre del médico | **22 / 23 pt** / **14 / 18 pt**. **Cinco formatos coinciden** |
| Número de entrada | **9 / 13**, **9 / 12.5**, **9.5 / 14 pt**. No usa entrada numerada |
| Etiqueta de folio | **11 pt**. **Cinco formatos coinciden** |

**C · Marca de estado:** no instanciada.

**D · Anestesiólogo:** aparece como **concepto de la tabla**
(`Honorarios del anestesiólogo`), no como firmante. No aplica.


---

# B.6 · SOLICITUD DE INTERNAMIENTO

**Versión aprobada:** `Solicitud de Internamiento.dc.html`, versión `v1785858815394923`.
Archivo único. Lo identifico como aprobado porque incorpora las tres correcciones de su
última ronda —contador de requerimientos eliminado, bloques generados por parser de texto
plano, y regla raya/número— y no hubo ronda posterior.

**Cambios posteriores a la aprobación:** **ninguno.**

## 1 · Título exacto

Cadena literal: `Solicitud de internamiento` + `uppercase`.
Caja de **297 pt** de ancho fijo (Imagenología usa 287). Riel derecho de **190 pt**.

**Título de la sección 2:** `Indicaciones de ingreso a piso`, mismo cuerpo que el título
del documento (17 / 20 pt), con subtítulo de lector:
`Para personal de enfermería y médico residente`

## 2 · Orden de bloques

Es el único formato con **dos secciones** y tres hojas.

**Hoja 1 — sección 1:** membrete completo (con cédulas) → aire 10 pt → título + badge
urgente / riel de 190 pt → filete a 5 pt → aire 8 pt → **riel de identificación de 7
celdas en dos filas** → aire 12 pt → Diagnósticos → Procedimiento → Requerimientos →
Justificación → espaciador → aviso → banda.

**Hoja 2 — sección 1, cierre:** cabecera de continuación → línea de paciente **con
hospital** + badge urgente reducido → aire 14 pt → bloque de instrucciones → aire 8 pt →
**firma doble** → espaciador → banda.

**Hoja 3 — sección 2:** cabecera de continuación con rótulo propio → **apertura de
sección** → indicaciones de ingreso → aire 24 pt → firma del médico → espaciador → banda.

**Riel de identificación — 7 celdas:**

| Celda | Columnas | Fila |
|---|---|---|
| Paciente | span 5 | 1 |
| Edad | span 2 | 1 |
| Sexo | span 2 | 1 |
| Expediente | span 3 | 1 |
| Hospital o lugar | span 5 | 2 |
| Tipo de internamiento | span 4 | 2 |
| Días est. | span 2 | 2 |
| ASA | span **1** | 2 |

La celda de ASA a span 1 (32.25 pt de ancho neto) es la más estrecha del sistema.

## 3 · Ranuras de la entrada

**No usa `EntradaNumerada`.** Sus listas salen de `ParserBloques` y de `RielDatos`.

### El parser — implementado en el archivo, no simulado

Este es el único archivo del sistema donde `ParserBloques` **existe como código**:

```
parsear(texto):
  lineas = texto.split('\n').trim().filter(no vacías)
  mientras queden líneas:
    si la línea empieza con «•»           → nodo 'items'   (consume las viñetas seguidas)
    si no, y la SIGUIENTE empieza con «•» → nodo 'bloque'  (título + sus viñetas)
    si no                                 → nodo 'prosa'
```

**El lookahead está implementado** (`lineas[i+1].startsWith('•')`), que es el requisito
que `DOCUMENTOS_SPEC.md` 2.J marca como obligatorio. La viñeta se elimina del texto con
`replace(/^•\s*/, '')` y se sustituye por la raya del sistema.

**Numeración corrida:** el contador `n` incrementa **solo en nodos `bloque`**, así que
los ítems sueltos y la prosa no consumen número.

**Aire entre nodos:** `14pt`, salvo el último que recibe `0pt`.

### Cuatro tipos de bloque, con composición distinta

| Tipo | Cuándo | Composición |
|---|---|---|
| `numero` | Nodo `bloque` de indicaciones | Filete **0.8 pt** superior + número colgado **15 / 15 pt** en acento + título **10 / 14 pt** 600 tracking 0.14 + ítems con raya |
| `simple` | Diagnósticos, procedimiento, justificación, nodo `items` suelto | Filete **0.5 pt `#C9C5BD`** + título **9 / 12 pt** 600 tracking 0.14 + texto y/o ítems |
| `parrafoSuelto` | Nodo `prosa` | Párrafo IBM Plex Sans **11.5 / 18 pt**, medida **486 pt**, sin filete, sin título, sin marca |
| `requerimientos` | Riel de datos | Ver §5 |
| `instrucciones` | Bloque destacado | Ver §5 |

**Ítem con raya:** flex de medianil **8 pt**, margen superior 3 pt (2 pt en `simple`):
- Raya: **IBM Plex Mono 9 pt**, interlineado 18 pt, color **#737373**, ancho fijo **9 pt**
- Texto: IBM Plex Sans **11.5 / 18 pt**, bandera izquierda

> ⚠ **D30.** La raya del sistema es el carácter `—` compuesto en **IBM Plex Mono**.
> Tercera aparición de la mono en documento impreso (tras D13 y D20), y esta sí es
> contenido, no notación. **Reportado.**

## 4 · Cadenas literales impresas

**Títulos de bloque de la sección 1:**
```
Diagnósticos
Procedimiento o cirugía
Requerimientos especiales
Justificación clínica
Instrucciones para el paciente
```

**Apertura de sección 2:**
```
2                                                    ← 26 / 26 pt, 600, acento
Indicaciones de ingreso a piso                       ← 17 / 20 pt, 600, 0.02 em
Para personal de enfermería y médico residente       ← 8 / 12 pt, 600, 0.22 em, #454545
```

**Rótulos de cabecera de continuación** — el archivo usa tres distintos:
```
Solicitud de internamiento · continuación
Solicitud de internamiento · sección 2 de 2
Casos de la sintaxis de bloques              ← solo en hojas de demostración
Instrucciones al paciente · caso de un ítem  ← solo en hojas de demostración
```

**Línea de paciente reducida:**
```
Paciente · Prueba Prueba · 25 años · Exp. 2026-0184 · Star Médica Mérida
```

**Avisos de continuación:**
```
Continúa en la hoja 2 · instrucciones y firmas     ← izquierda
Sección 1 de 2                                     ← derecha, #737373
```
> La zona derecha lleva aquí el **número de sección**, no la advertencia de firma. Cuarta
> construcción distinta de la zona derecha del aviso, tras `Sin firma no es válida`,
> `Sin firma no es válido`, `Firma en la última hoja` y
> `El recibo no es válido sin ella`. **Refuerza D22.**

**Rótulos de firma — los dos:**
```
Firma del paciente o familiar
Nombre y firma · parentesco si aplica     ← nota, Plex Sans 7.5 / 11 pt, #737373
Firma y sello del médico
```

**Catálogo de requerimientos**, orden literal:
```
Sangre y hemoderivados · Profilaxis antibiótica · Tromboprofilaxis ·
Unidad de cuidados intensivos · Material de osteosíntesis ·
Implante especial · Ayuno preoperatorio
```

**Las seis instrucciones prellenadas**, orden literal:
```
01  Presentarse en Admisión a las 06:00 h del día programado, con este documento impreso.
02  Ayuno absoluto de ocho horas: sin alimentos, agua, café ni chicle.
03  No suspender los antihipertensivos: tomarlos con un sorbo mínimo de agua.
04  Llevar identificación oficial, póliza de seguro y estudios previos en disco.
05  Retirar esmalte de uñas, joyería, lentes de contacto y prótesis dentales.
06  Acudir acompañado por un adulto que pueda permanecer durante el internamiento.
```

**Etiquetas del riel:** `Paciente` · `Edad` · `Sexo` · `Expediente` ·
`Hospital o lugar` · `Tipo de internamiento` · `Días est.` · `ASA`

**Prefijo de folio:** `H-`

## 5 · Valores propios del formato

**Apertura de sección** — el recurso más pesado del sistema:

| Valor | Medida |
|---|---|
| Filete de apertura | **144 × 4 pt** acento + 0.8 pt `#101010` |
| Número de sección | Archivo **26 / 26 pt**, 600, acento, en riel de 23.25 pt |
| Aire filete → número | 8 pt |
| Aire tras el bloque | 14 pt |

Los 4 pt son el grosor máximo declarado y están reservados a este uso.

**Bloque de instrucciones** — `BloqueDestacado` variante `instrucciones`:

| Valor | Medida |
|---|---|
| Filete superior e izquierdo | **2 pt sólido `#101010`** |
| Padding | `6pt 0 8pt 14pt` → sangría **14 pt** |
| Ancho | **486 pt** |
| Título | Archivo **9.5 / 13 pt**, 600, tracking **0.22 em** |
| Número de ítem | Archivo **9 pt / 18 pt**, 600, **acento**, ancho fijo **14 pt** |
| Texto de ítem | IBM Plex Sans **11.5 / 18 pt**, peso **500** |
| Medianil número–texto | 8 pt |

**Es idéntico al bloque de alarma de Receta salvo en dos cosas:** el filete es 2 pt en
vez de 3, y la lista va numerada en vez de ser párrafo. El padding y la sangría son los
mismos (14 pt) — lo que confirma **D15** y **D21**: la sangría real del sistema es 14 pt
en alarma e instrucciones, 12 pt en cita, y el chasis pide 16 en las tres.

**Con un solo ítem no se numera:** el archivo lo implementa
(`if (items.length === 1)` → `unico`), y compone un párrafo de 11.5 / 18 pt peso 500
sin número.

**Riel de requerimientos:**

| Valor | Medida |
|---|---|
| Retícula | `repeat(3, 1fr)` en el documento · `repeat(2, 1fr)` en la lámina de demostración |
| Filete de apertura y cierre | **0.8 pt `#101010`** |
| Regla entre filas | 0.5 pt `#EDEAE4` |
| Regla entre columnas | 0.5 pt `#D9D6D0`, **solo si no es la primera de su fila** |
| Sangría de celda | 10 pt si lleva regla izquierda, 0 si es la primera |
| Padding | `4pt 10pt 5pt 0` (documento) · `3pt 8pt 4pt 0` (lámina) |
| Cuerpo | **10.5 / 14 pt**, peso 500 (documento) · **9.5 / 13 pt** (lámina) |
| Contador | **ninguno** — el catálogo es abierto |

La lógica de reglas está en la función `req(lista, columnas)`:
`filete = (i % columnas === 0) ? '0' : '0.5pt solid #D9D6D0'`.

**Firma doble** — flex de medianil **30 pt**, dos cajas de **246 pt**:

| Firmante | Espacio | Composición |
|---|---|---|
| Paciente o familiar | **77 pt** con `border-bottom: 0.8pt` | **En blanco** — no lleva trazo |
| Médico | **77 pt** con el trazo dentro | `overflow: hidden` + línea 0.8 pt debajo |

**Los dos miden 77 pt**: dos firmas en la hoja → tramo `amplia`. Confirma el parámetro de
dos tramos.

**Nombre bajo la firma:** **10 / 14 pt** en la firma doble (peso 400 el paciente, 600 el
médico) y **11 / 15 pt** en la firma sola de la hoja 3. Dos valores dentro del mismo
archivo.

## 6 · Componentes del chasis que instancia

| Componente | Variante |
|---|---|
| `PanelCircular` | `monograma` |
| `Membrete` | `completo` con cédulas / `continuacion` |
| `TituloDocumento` | `fijo`, caja de 297 pt |
| `BloquePaciente` | `completo` (7 celdas) / `reducido` (línea con hospital) |
| `RielDatos` | `celdas` · **`sin contador`** para requerimientos |
| `Campo` | `con valor` y `vacío opcional` |
| `BloqueNegativo` | `urgente` / `urgente reducido` |
| `BloqueDestacado` | `instrucciones` — filete 2 pt, lista numerada |
| `ParserBloques` | **Implementado como código.** Único formato que lo ejercita |
| `ContadorLista` | **no instanciado** |
| `BloqueFirmas` | `amplia` × 2 en la hoja 2, `amplia` × 1 en la hoja 3 |
| `PieDocumento` | `completo`, **sin QR** |
| Apertura de sección | **Componente propio, no declarado en los 14** |

> ⚠ **D31.** La apertura de sección —filete de 4 pt + número de 26 pt + subtítulo de
> lector— no corresponde a ninguno de los 14 componentes de `DOCUMENTOS_SPEC.md`.
> El spec la menciona en II.6 §3 como «`filete.transicion` con número colgado», pero no
> hay un componente que la encapsule. **Reportado.**

## Preguntas transversales

**A · Los cuatro desincronizados:**

| Desincronizado | Estado |
|---|---|
| Texto corrido 11.5 / 18 pt, bandera izquierda | **Aplicado por completo.** Todos los párrafos, ítems e instrucciones van a 11.5 / 18 pt, bandera izquierda. Medida 486 pt en párrafos sueltos y textos de bloque. **Segundo formato que cumple del todo, tras Suplementación** |
| Campo vacío 20 pt y 246 pt | **No aplicable.** No instancia ningún campo vacío requerido |
| Contador en dos formas | **No instanciado** — correcto: sus listas no son paginables |
| Espacio de firma parametrizado | **Aplicado y demostrado.** Dos firmas en la hoja 2 → 77 pt cada una |

**B · Las tres divergencias de A.4:**

| Divergencia | Valor real |
|---|---|
| Nombre del médico | **22 / 23 pt** / **14 / 18 pt**. **Seis formatos coinciden** |
| Número de entrada | **15 / 15 pt** en bloques numerados y **9 / 18 pt** en ítems de instrucciones. El 15 pt **coincide con el encabezado de sección del espécimen** |
| Etiqueta de folio | **11 pt**. **Seis formatos coinciden** |

**C · Marca de estado:** no instanciada.

**D · Anestesiólogo:** aparece en el texto de una indicación
(`Ayuno absoluto hasta valoración del anestesiólogo`), no como firmante. No aplica.


---

# B.7 · CONSENTIMIENTO INFORMADO

**Versión aprobada:** `Consentimiento Informado.dc.html`, versión `v1785608133655521`.
Archivo único, pero contiene **tres capas de contenido** que hay que distinguir:

| Capa | Etiquetas | Qué es |
|---|---|---|
| Documento | `Consentimiento · 1 de 6` … `6 de 6` | **El formato aprobado** |
| Variantes por sustitución | `… · por sustitución` | Ramas del mismo formato, aprobadas |
| Caso de estrés | `Estrés · 2 de 8` … | **Demostración de reglas de flujo, no el formato** |

Lo identifico como aprobado porque incorpora las últimas correcciones recibidas —
otorgamiento en la misma hoja de la declaración, anestesiólogo eliminado, campo de
identificación fuera de las firmas, anexo en hoja propia, `Verificada en consulta`
eliminada — y no hubo ronda posterior.

**Cambios posteriores a la aprobación:** **ninguno.** Pero la decisión recibida en este
turno sobre la rúbrica del médico **no está aplicada al archivo**: ver §5.

## 1 · Título exacto

Cadena literal: `Consentimiento médico informado` + `uppercase`.
Riel derecho de **156 pt**. Con subtítulo sin rótulo:
`Artrodesis lumbar instrumentada L4-L5`, IBM Plex Sans 10.5 / 14 pt, #454545.

> ⚠ **D32.** `DOCUMENTOS_SPEC.md` II.7 declara el título como
> `CARTA DE CONSENTIMIENTO INFORMADO`. El diseño imprime
> `CONSENTIMIENTO MÉDICO INFORMADO` — sin «Carta de». **Reportado, no resuelto.**

## 2 · Orden de bloques · seis hojas

| Hoja | Contenido |
|---|---|
| 1 | Membrete completo **sin cédulas** → título → **fundamento legal** → `Datos de identificación` → §1 Preoperatorio → aviso |
| 2 | Cabecera reducida → §2 Beneficios → §3 Anestesia → §4 Descripción (zona de escritura) |
| 3 | Cabecera → §5 Riesgos comunes (2 párrafos) → §6 Riesgos específicos (zona de escritura) → §7 Alternativas |
| 4 | Cabecera → **Declaración de consentimiento** → casilla de sustitución → **nivel 1 · Otorgamiento** |
| 5 | Cabecera → **nivel 2 · Representación** → **nivel 3 · Testigos** |
| 6 | Cabecera → **Anexo · Identificación de firmantes** |

**Riel de identificación — 8 celdas en cuatro filas:**

| Celda | Columnas | Fila | Notas |
|---|---|---|---|
| Paciente | span 5 | 1 | |
| Edad | span 2 | 1 | |
| Expediente | span 2 | 1 | |
| Fecha | span 3 | 1 | |
| **Familiar o responsable** | span **12** | 2 | **campo vacío requerido**, línea 0.8 pt, **alto 16 pt** |
| Diagnóstico | span 12 | 3 | IBM Plex Sans 10.5 / 14 pt |
| **Hospital o clínica** | span 8 | 4 | **12.5 / 16 pt**, peso 500, −0.01 em — el valor más destacado del riel |
| Lugar | span 4 | 4 | 11 / 16 pt |

El riel se abre con el rótulo `Datos de identificación` (Archivo 9 / 13 pt, 600,
tracking **0.2 em**) y una regla de 0.8 pt a 5 pt.

**No hay campo de sexo** en este formato, a diferencia de los otros seis.

## 3 · Ranuras de la entrada

**No usa `EntradaNumerada`.** Es el formato de texto corrido más extenso.

**Sección clínica numerada** — siete instancias, composición uniforme:
- Filete **0.8 pt `#101010`** superior, padding 7 pt
- Flex, medianil 9 pt: riel de **23.25 pt** + caja de **381 pt**
- Número: Archivo **15 / 15 pt**, 600, acento, tabulares
- Título: Archivo **10 / 14 pt**, 600, tracking **0.14 em**, uppercase
- Párrafo: IBM Plex Sans **10.5 / 16 pt**, **justificado**, `hyphens: auto`, `orphans: 2`, `widows: 2`, margen 7 pt
- `break-inside: avoid` en las secciones de solo prosa (§1, §2, §3, §5, §7)
- §4 y §6 **no** llevan `break-inside: avoid`: son `flex: 1` con zona de escritura

**Zona de escritura de §4 y §6** — misma técnica que las observaciones de Laboratorio:
`repeating-linear-gradient` de renglón **16 pt** con regla 0.5 pt `#D9D6D0`,
`min-height` **96 pt** (§4) y **64 pt** (§6), margen superior 8 pt.
La entradilla de la zona va en **#454545** y sin justificar.

> ⚠ **D33 — el texto corrido del Consentimiento va justificado con partición.** Los siete
> párrafos de sección, los tres de la declaración y el fundamento legal usan
> `text-align: justify; hyphens: auto`. El chasis lo prohíbe sin excepción (I.3.2) y el
> cliente lo corrigió a bandera izquierda en Receta y Suplementación. **Este formato
> nunca recibió esa corrección.** Junto con D28 (notas de la cotización), son los dos
> únicos focos de justificado que quedan. **Reportado, no resuelto.**

## 4 · Cadenas literales impresas

**Fundamento legal** — marco parcial 2 pt acento, ancho **381 pt**, padding `8pt 12pt 10pt`:
```
Fundamento legal
De conformidad con la Norma Oficial Mexicana NOM-004-SSA3-2012 del Expediente Clínico, la Ley General de Salud (Art. 80 y 81) y el Reglamento de la Ley General de Salud en Materia de Prestación de Servicios de Atención Médica (Art. 80), este documento informa al paciente o a su representante legal sobre el procedimiento propuesto, sus riesgos, beneficios y alternativas, a fin de obtener su consentimiento libre, voluntario e informado.
```
Cuerpo del párrafo: IBM Plex Sans **9 / 13.5 pt** — el cuerpo de prosa más pequeño del sistema.

**Los siete títulos de sección**, orden literal:
```
1  Preoperatorio
2  Beneficios esperados
3  Anestesia
4  Descripción del procedimiento
5  Riesgos comunes
6  Riesgos específicos
7  Alternativas de tratamiento
```

**Entradillas de las zonas de escritura:**
```
A completar por el médico tratante, en términos comprensibles para el paciente.
Derivados de la localización anatómica y de las condiciones particulares del paciente. Se le han explicado de forma verbal y se detallan a continuación.
```

**Rótulos de bloque:**
```
Datos de identificación
Declaración de consentimiento
Anexo · Identificación de firmantes
```
Los tres a Archivo **11 / 15 pt** (el de identificación a 9 / 13 pt), 600, tracking **0.2 em**.

**Casilla de sustitución:**
```
El paciente no puede firmar por sí mismo; firma en su lugar el familiar o responsable, cuyos datos se asientan en el recuadro de la derecha.
```
IBM Plex Sans **8 / 11 pt**, ancho del bloque **426 pt**, medianil 7 pt.
Casilla: **9 × 9 pt**, borde 0.8 pt `#101010`, marca interior **5 × 5 pt** sólida.

**Bloque de constancia de motivo** (solo variante por sustitución):
```
Motivo por el que el paciente no firma
Imposibilidad física para firmar. Motivo valorado y asentado por el médico tratante.
```
Caja de **426 pt**, borde **0.5 pt `#D9D6D0`** completo (los cuatro lados), fondo
**`#FAF9F7`**, padding `7pt 9pt`. Rótulo 6.5 / 10 pt, texto Plex Sans 9.5 / 13 pt.

> Es el único bloque del sistema con **borde en los cuatro lados y fondo**. El chasis solo
> declara marcos parciales. **Reportado como D34.**

**Los tres rótulos de nivel de firma** — con número colgado y filete de cierre:
```
1  Otorgamiento
2  Representación        ← desaparece en la variante por sustitución
3  Testigos              ← pasa a ser «2» en la variante por sustitución
```
Número: Archivo **11 / 13 pt**, 600, acento. Rótulo: 7 / 11 pt, 600, 0.22 em, #737373.
Filete: `flex: 1`, **0.5 pt `#D9D6D0`**. Medianil 8 pt, margen inferior 6 pt.

**Los cinco firmantes**, del array del archivo:

| Rol | Nombre | Nota | Extras |
|---|---|---|---|
| `Médico tratante` | `Dr. Ángel M. Ancona Pérez` | `Céd. Prof. 9552456 · Céd. Esp. 12085805` | — |
| `Paciente` | `Prueba Prueba` | `Nombre y firma` | — |
| `Familiar o responsable` | `Nombre y firma` | `Representante del paciente` | `parentesco: true` |
| `Testigo 1` | `Nombre y firma` | `Mayor de edad` | — |
| `Testigo 2` | `Nombre y firma` | `Mayor de edad` | — |

**El anestesiólogo NO está** — responde la pregunta D. Ver §5.

**Campo de parentesco** (solo el familiar):
```
Parentesco con el paciente
```
Rótulo 6.5 / 10 pt, 600, 0.22 em. Línea **0.5 pt `#101010`**, **alto 13 pt**, margen 6 pt.

**Anexo — entradilla y placeholders:**
```
Reproducción de la identificación oficial del paciente y de las personas que firman el consentimiento.
FOTOGRAFÍA DE LA / IDENTIFICACIÓN OFICIAL      ← IBM Plex Mono 8 pt, 0.1 em, #B5B0A6
No se capturó fotografía de la identificación de este firmante.
```

**Los cuatro identificados del anexo:**
```
Paciente               · Prueba Prueba        · Credencial para votar · PRPR010412HYN04
Familiar o responsable · María Prueba Canul   · Credencial para votar · PRCM780921MYN08
Testigo 1              · Juan Canul Uc        · Credencial para votar · CAUJ850614HYN02
Testigo 2              · Rosa Pech Ek         · Credencial para votar · PEER900228MYN01
```
En la variante por sustitución los dos primeros roles se reescriben:
`Paciente · no firma` y `Familiar o responsable · firma`.

**Aviso de la hoja 1:** `El consentimiento continúa en la hoja 2` — **una sola zona**, sin
la zona derecha que llevan los otros formatos.

**Prefijo de folio:** `C-`

## 5 · Valores propios del formato

**Retícula de firmas:** `grid-template-columns: 1fr 1fr`, gap `0 30pt`. Cada celda es
`break-inside: avoid`.

**Espacio de firma — 77 pt en TODAS las celdas.** El archivo compone las cinco firmas con
`height: 77pt; overflow: hidden`, en los tres niveles.

**Cómo se distribuye el trazo capturado, según el archivo:**

| Nivel | Firmante | Trazo |
|---|---|---|
| 1 | Médico tratante | `this.trazo` — **trazo completo renderizado** |
| 1 | Paciente / Familiar | `this.trazo2` — variante de trazo |
| 2 | Familiar o responsable | `this.trazo3` — variante de trazo |
| 3 | Testigo 1 y 2 | `''` — **cadena vacía: espacio en blanco** |

> ⚠ **D35 — la decisión recibida en este turno no está aplicada.** La instrucción dice:
> «en el Consentimiento el médico **NO** imprime su rúbrica renderizada, firma a mano como
> los demás firmantes. Todas las celdas son espacio en blanco del mismo alto y ninguna
> imagen se escala.»
>
> El archivo aprobado **sí renderiza trazos**: uno para el médico, y variantes `trazo2` y
> `trazo3` para paciente y familiar. Solo los testigos van en blanco.
>
> **No lo modifiqué**, porque la instrucción de esta pasada es extraer, no rediseñar. Pero
> **el archivo y la decisión están en conflicto** y hay que resolverlo antes de programar:
> si se aplica la decisión, las cinco celdas quedan en blanco a 77 pt y los tres getters
> de trazo desaparecen. **Reportado.**

**Los tres altos de espacio manuscrito de este archivo:**

| Uso | Alto |
|---|---|
| Celda de firma | **77 pt** |
| Campo `Familiar o responsable` del riel | **16 pt** |
| Campo `Parentesco con el paciente` | **13 pt** |

Ninguno de los dos últimos es el `manuscrito.alto` de 20 pt del chasis. **Refuerza D27**:
el sistema tiene ahora cuatro valores para el mismo token (20, 16, 13, 11).

**Declaración de consentimiento:** marco parcial 2 pt acento, ancho **426 pt**, padding
`9pt 12pt 11pt`, `break-inside: avoid`. Tres párrafos de 10.5 / 16 pt justificados,
margen 6 pt entre ellos. Las dos menciones destacadas van en `<strong>` con
`font-weight: 500` — **no 600**.

**Anexo — recuadro de identificación:**

| Valor | Medida |
|---|---|
| Retícula | `1fr 1fr`, gap `20pt 30pt` |
| Número | Archivo **15 / 15 pt**, 600, acento |
| Rol | 7 / 11 pt, 600, 0.22 em, #737373 |
| Nombre | **11 / 15 pt**, peso 500, −0.012 em |
| Filete sobre la foto | **2 pt acento**, ancho completo de la celda, margen 5 pt |
| Caja de foto | **alto 144 pt**, borde 0.5 pt `#D9D6D0` **sin borde superior**, fondo `#FAF9F7` |
| Caja sin foto | mismo alto y borde, **sin fondo**, padding lateral 24 pt |
| Pie de recuadro | Plex Sans 7.5 / 11 pt, #737373, flex `space-between`, margen 4 pt |

El ancho de la celda es `(486 − 30) / 2 = 228 pt`, así que la caja de foto es
**228 × 144 pt** — proporción 1.583, cercana a la de una credencial mexicana.

**Reglas de colapso implementadas en el archivo:**
```
numerar(lista)  → añade n de dos dígitos y sinFoto = !p.foto
seImprime(lista) → lista.some(p => p.foto)   ; si false, la hoja de anexo no se imprime
```
El tipo y número de identificación **se imprimen haya o no foto** — corrección aplicada.

## 6 · Componentes del chasis que instancia

| Componente | Variante |
|---|---|
| `PanelCircular` | `monograma` |
| `Membrete` | `completo` **sin cédulas** (como Lab y Recibo) / `continuacion` |
| `TituloDocumento` | `fijo` con subtítulo, riel de 156 pt |
| `BloquePaciente` | `completo` (8 celdas, **sin sexo**) / `reducido` |
| `RielDatos` | `celdas` |
| `Campo` | `con valor`, **`vacío requerido`** (familiar 16 pt, parentesco 13 pt), `vacío opcional` |
| `EntradaNumerada` | **no se usa** |
| `BloqueNegativo` | **no se usa** |
| `BloqueDestacado` | marco 2 pt **acento** (fundamento legal, declaración) — no declarado (D26) · más el bloque de motivo con **borde completo y fondo** (D34) |
| `ContadorLista` | **no instanciado** |
| `BloqueFirmas` | **`amplia` (77 pt) en las cinco celdas**, en tres niveles de jerarquía |
| `PieDocumento` | `completo`, **sin QR** |
| Marca de estado | **no instanciada** |

> ⚠ **D36.** `DOCUMENTOS_SPEC.md` II.7 declara QR de verificación y marca de estado
> (`SIN FIRMAR` · `BORRADOR` · `COPIA` · `SIN VALIDEZ — VISTA PREVIA`) para este formato.
> **El diseño aprobado no instancia ninguno de los dos.** **Reportado.**

> ⚠ **D37.** El spec declara `BloqueFirmas` variante **`compacta`** (28 pt) para el
> Consentimiento, porque son hasta seis firmas. El diseño usa **`amplia` (77 pt)** y
> resuelve el espacio **repartiendo las firmas en dos hojas** (nivel 1 en la hoja 4,
> niveles 2 y 3 en la hoja 5) en vez de comprimirlas. Es coherente con la decisión de no
> adoptar el token único, pero **contradice la variante declarada en el spec**. **Reportado.**

## Preguntas transversales

**A · Los cuatro desincronizados:**

| Desincronizado | Estado |
|---|---|
| Texto corrido 11.5 / 18 pt, bandera izquierda | **No cumplido en ninguno de los dos ejes.** Todo el texto corrido va a **10.5 / 16 pt** y **justificado con partición**. Medida **381 pt**, no 486. Es el formato más alejado del token (D33) |
| Campo vacío 20 pt y 246 pt | **No cumplido.** 16 pt y 13 pt de alto; anchos de celda, no 246 pt |
| Contador en dos formas | **No instanciado** — correcto: no tiene lista paginable |
| Espacio de firma parametrizado | **Aplicado en su tramo `amplia`**: 77 pt en todas las celdas, con reparto en dos hojas. Contradice el spec, que pide `compacta` (D37) |

**B · Las tres divergencias de A.4:**

| Divergencia | Valor real |
|---|---|
| Nombre del médico | **22 / 23 pt** / **14 / 18 pt**. **Siete formatos coinciden** |
| Número de entrada | **15 / 15 pt** en secciones y en el anexo; **11 / 13 pt** en rótulos de nivel. El 15 pt coincide con Internamiento y con el espécimen |
| Etiqueta de folio | **11 pt**. **Siete formatos coinciden** |

**C · Marca de estado:** **no instanciada**, pese a que el spec la declara (D36).

**D · Anestesiólogo — respuesta directa:**

**No está.** El array de firmantes del archivo aprobado tiene **cinco entradas** y ninguna
es el anestesiólogo; el comentario del código lo dice explícitamente: *«El anestesiólogo no
firma aquí: en México entrega su propio consentimiento»*.

**Cómo se reacomoda la retícula** — tres niveles de jerarquía en dos hojas:

| Hoja | Nivel | Celdas | Retícula |
|---|---|---|---|
| 4 | 1 · Otorgamiento | Médico tratante · Paciente **o** Familiar | `1fr 1fr`, dos celdas llenas |
| 5 | 2 · Representación | Familiar o responsable | `1fr 1fr`, **una celda llena, la segunda vacía** |
| 5 | 3 · Testigos | Testigo 1 · Testigo 2 | `1fr 1fr`, dos celdas llenas |

**La variante por sustitución elimina el nivel 2 completo**: el familiar ya firmó en el
nivel 1, así que el nivel 3 se renumera a `2 · Testigos`. El archivo lo implementa con
listas distintas (`nivel1` / `nivel1Sustitucion`) y hojas 5 separadas.

Y la corrección aplicada: el campo `Tipo y número de identificación` **no aparece** en
ninguna celda de firma — solo en el anexo. El array conserva una bandera
`identificacion: true/false` por firmante que **el marcado ya no lee**: es código muerto.
**Reportado como D38.**


---

# B.8 · ESCRITO MÉDICO

**Versión aprobada:** `Escrito Medico.dc.html`, versión `v1785862133780959`.

Este es el caso que marcaste. Lo verifiqué línea por línea contra el archivo. **La
decisión que se pulió durante seis rondas y después se revirtió es la posición de la
fecha de emisión.** Estado actual del archivo, que es el aprobado:

| Punto | Estado en el archivo |
|---|---|
| Fecha | **En el encabezado**, a la derecha del título, sin rótulo, Archivo 9 pt, #737373 |
| Pie | **Tres zonas**: paginación · título del documento · leyenda. **Sin fecha** |
| Folio | **No existe** en ninguna parte |

**Toda referencia a «fecha en el pie», «columna auto de la fecha», «retícula de cuatro
celdas» o «elipsis del título como cuarta zona» pertenece a la serie descartada.** La
elipsis sí existe, pero sobre el **título** en la zona central del pie de tres zonas, no
como columna de fecha.

> ⚠ **Contradicción interna del archivo — D39.** La ficha de spec del propio archivo
> conserva dos filas de la serie descartada:
> `Sin folio · Riel del encabezado → «Colapsa: sin folio su único dato era la fecha, que
> ahora vive en el pie»`. **Eso ya no es cierto**: la fecha vive en el encabezado. La fila
> quedó sin actualizar tras la reversión. **Reportado.** El marcado es la fuente correcta.

**Cambios posteriores a la aprobación:** **ninguno.**

## 1 · Título exacto — variable

**No hay cadena fija.** El médico lo escribe. Los cuatro estados instanciados:

| Estado | Cadena | Renglones |
|---|---|---|
| Corto | `Certificado médico` | 1 |
| Medio | `Carta de recomendación` | 1 |
| Largo | `Constancia de atención médica y valoración ortopédica para trámite escolar ante la Secretaría de Educación` | **3** |
| Ausente | — | 0, colapsa |

Composición: Archivo **17 / 20 pt**, 600, tracking **0.02 em**, uppercase, `flex: 1`,
`min-width: 0`. **Sin caja de ancho fijo**: toma los 486 pt completos, porque no hay riel
de folio a su derecha.

**Comportamiento del título largo — declarado:** envuelve en los renglones de 20 pt que
necesite. **Nunca reduce cuerpo ni recorta.** Cada renglón extra resta 20 pt a la caja de
contenido de esa hoja; el caso medido son 3 renglones = 60 pt.

**Alineación de la fecha:** el contenedor es `align-items: baseline`, medianil 16 pt. La
fecha va `flex: none` con `white-space: nowrap` y `line-height: 20pt`, así que se alinea
a la **primera** línea del título y no se desplaza ni se recorta nunca.

## 2 · Orden de bloques

**Hoja 1 con título:** membrete completo **con cédulas** → aire **16 pt** → título + fecha
→ filete grueso-fino a 5 pt → aire **20 pt** → cuerpo → aire 32 pt → firma → espaciador →
aviso → banda.

**Hoja 1 sin título:** membrete → aire 16 pt → **fecha sola, alineada a la derecha** →
filete → aire 20 pt → cuerpo. El bloque de título colapsa pero **la fecha y el filete
permanecen**.

**Hoja de continuación:** rótulo `<título> · continuación` + nombre 14 / 18 pt / riel
derecho con `Emisión` y fecha **10 / 14 pt peso 500** → filete a 6 pt → línea de cédulas
7.5 / 12 pt #737373 → aire 24 pt → cuerpo.

> La hoja de continuación **sí rotula la fecha** (`Emisión`) y la compone a 10 pt peso
> 500; la hoja 1 la deja **sin rótulo** a 9 pt en #737373. Dos tratamientos de la misma
> fecha dentro del formato. **Reportado como D40.**

**Qué ata la hoja 2 sin folio** — declarado en el spec del archivo: título + fecha +
médico con cédula.

## 3 · Ranuras de la entrada

**No usa `EntradaNumerada`.** El cuerpo es una lista de nodos generados por siete
constructores:

| Constructor | Produce | Aire antes |
|---|---|---|
| `p(t, aire)` | Párrafo | **8 pt** por defecto |
| `h1(t)` | Encabezado nivel 1 | **20 pt** |
| `h2(t)` | Encabezado nivel 2 | **16 pt** |
| `ul(...t)` | Lista con viñeta | **8 pt** |
| `ol(...t)` | Lista numerada | **8 pt** |
| `cita(t)` | Cita o destacado | **16 pt** |
| `hr()` | Separador | **16 pt** |

Todos los aires son múltiplos de 4: **8 · 16 · 20 · 24 · 32**. El archivo lo declara.

## 4 · Escala tipográfica del cuerpo — el entregable principal

| Marca | Familia | Cuerpo / interlineado | Peso | Tracking | Color | Extras |
|---|---|---|---|---|---|---|
| **Párrafo** | IBM Plex Sans | **11.5 / 18 pt** | 400 | 0 | `#101010` | medida **486 pt**, bandera izquierda, `orphans: 2`, `widows: 2`, `text-wrap: pretty` |
| **Encabezado 1** | Archivo | **13 / 18 pt** | 600 | **0.08 em** | `#101010` | uppercase, `break-after: avoid` |
| **Encabezado 2** | Archivo | **10 / 14 pt** | 600 | **0.14 em** | **`#454545`** | uppercase, `break-after: avoid` |
| **Negrita** | IBM Plex Sans | 11.5 / 18 pt | **500** | 0 | hereda | `<strong>` |
| **Cursiva** | IBM Plex Sans | 11.5 / 18 pt | 400 itálica | 0 | hereda | `<em>` |
| **Ítem de lista** | IBM Plex Sans | 11.5 / 18 pt | 400 | 0 | hereda | `flex: 1` |
| **Marca de viñeta** | **IBM Plex Mono** | **9 pt / 18 pt** | 400 | 0 | `#737373` | riel **14 pt**, `text-align: right`, carácter `—` |
| **Marca numerada** | IBM Plex Mono | 9 pt / 18 pt | 400 | 0 | `#737373` | riel 14 pt, derecha, tabulares, formato `1.` |
| **Cita** | IBM Plex Sans | 11.5 / 18 pt | **500** | 0 | hereda | filete **1.6 pt izq.**, sangría **12 pt**, ancho 486 pt, `break-inside: avoid` |
| **Separador** | — | — | — | — | `#C9C5BD` | filete **0.5 pt**, ancho 486 pt, 16 pt de aire arriba y abajo |

**Medianil marca–texto en listas: 8 pt.** Viñeta y numerada comparten eje.

**El techo de los encabezados es deliberado:** 13 pt contra los 22 pt del nombre del
médico. El archivo lo declara: *«nunca compiten»*.

> La cursiva exige el peso itálico de IBM Plex Sans: el `<link>` de este archivo carga
> `ital,wght@0,400;0,500;1,400`. **Es el único de los ocho que carga la itálica.**

## 5 · Cadenas literales impresas

**Rótulos del encabezado:**
```
Emisión                                   ← solo en hoja de continuación
<título> · continuación                   ← rótulo de cabecera reducida
```

**Firma:**
```
Firma y sello del médico
Dr. Ángel M. Ancona Pérez
Céd. Prof. 9552456 · Céd. Esp. 12085805
```

**Aviso de continuación:**
```
El escrito continúa en la hoja 2      ← izquierda
Sin firma no es válido                ← derecha, #737373
```

**Banda de pie — tres zonas, retícula `auto minmax(0,1fr) auto`:**
```
Página 1 de 2                                                    ← 7 pt, 600, 0.22 em, uppercase
Resumen clínico                                                  ← 7 pt, 0.1 em, con elipsis
Documento generado por Spinus · Expediente clínico electrónico · spinus.com.mx
```

**La zona central es la única del sistema con `overflow: hidden; text-overflow: ellipsis`
y `min-width: 0`**, porque el título es variable y podría desbordar la banda.

**Valores de `tituloPie` observados:** `Certificado médico` · `Carta de recomendación` ·
`Resumen clínico` · `Constancia de atención médica` · `Escrito médico` (por defecto).

> El `tituloPie` puede **no coincidir** con el título del encabezado: el caso de título
> largo imprime `Constancia de atención médica y valoración ortopédica para trámite
> escolar ante la Secretaría de Educación` arriba y `Constancia de atención médica`
> abajo. Es un segundo campo, no un truncado automático. **Reportado como D41.**

**Fecha:** `4 ago 2026` — token corto, sin lugar.

## 6 · Componentes del chasis que instancia

| Componente | Variante |
|---|---|
| `PanelCircular` | `monograma` |
| `Membrete` | `completo` **con cédulas y universidad** / `continuacion` |
| `TituloDocumento` | **`variable`** y **`ausente`** — único formato con ambas |
| `BloquePaciente` | **no se usa** |
| `RielDatos` | **no se usa en la hoja 1**; la continuación lleva un riel de una celda |
| `Campo` | **no se usa** |
| `EntradaNumerada` | no se usa |
| `BloqueNegativo` | no se usa |
| `BloqueDestacado` | **`cita`** — filete 1.6 pt **solo izquierdo**, sin filete superior |
| `ParserBloques` | **no se usa** — el cuerpo viene del editor, no de una cadena con viñetas |
| `ContadorLista` | no se usa |
| `BloqueFirmas` | `amplia` — 77 pt |
| `PieDocumento` | **`sin folio`** — único formato |
| `MotorFlujo` | `break-after: avoid` en encabezados, `break-inside: avoid` en cita y firma |

> **Nota sobre la variante `cita`.** Suplementación la compone con filete superior **e**
> izquierdo; Escrito Médico solo con el izquierdo. Mismo grosor de 1.6 pt, dos geometrías.
> **Reportado como D42.**

**Membrete — sin variante propia.** El spec del archivo lo declara explícitamente: *«El
componente aprobado sin cambios: lo separa del cuerpo el bloque de título»*. Responde la
pregunta del brief sobre si el membrete necesitaba una variante para sostenerse solo: **no
la necesita.**

## Preguntas transversales

**A · Los cuatro desincronizados:**

| Desincronizado | Estado |
|---|---|
| Texto corrido 11.5 / 18 pt, bandera izquierda | **Aplicado por completo y en todos los nodos.** 11.5 / 18 pt, medida 486 pt, `text-align: left`. **Tercer formato que cumple del todo**, junto a Suplementación e Internamiento |
| Campo vacío 20 pt y 246 pt | **No aplicable.** No instancia `Campo` |
| Contador en dos formas | **No aplicable.** No tiene lista paginable |
| Espacio de firma parametrizado | **Aplicado.** Una firma → 77 pt |

**B · Las tres divergencias de A.4:**

| Divergencia | Valor real |
|---|---|
| Nombre del médico | **22 / 23 pt** / **14 / 18 pt**. **Los ocho formatos coinciden** |
| Número de entrada | No usa. Las marcas de lista van a **9 pt / 18 pt** en mono |
| Etiqueta de folio | **No existe.** El único formato sin folio |

**C · Marca de estado:** no instanciada.

**D · Anestesiólogo:** no aplica.


---

# C · SPEC DE FLUJO DEL CHASIS

**Fuente:** `Receta - Flujo y ancho.dc.html`. Extraído solo su spec de flujo, por
instrucción. Pertenece al **chasis**, no a la Receta.

## C.1 · Constantes de flujo declaradas

Objeto `FLUJO` del archivo, en pt:

| Constante | Valor | Qué mide |
|---|---|---|
| `firma` | **120** | Bloque de firma completo: rúbrica + línea + nombre + credenciales |
| `linea` | **17** | Altura de una línea de texto corrido |
| `minArrastre` | **3** | Líneas que bajan con la firma |
| `minViuda` | **2** | Mínimo de líneas a cada lado de un corte de párrafo |
| `aire` | **14** | Aire sobre el bloque de firma |

**Umbral derivado, por fórmula:**
```
costeArrastre = firma + aire + minArrastre × linea
              = 120 + 14 + 3 × 17
              = 185 pt
```

> ⚠ **D43 — dos generaciones del umbral conviven.** `DOCUMENTOS_SPEC.md` I.1.9 declara
> este 185 pt como obsoleto: *«el umbral figuraba como 185 pt, calculado con renglón de
> 17 pt, resto de una versión anterior del texto corrido. El renglón correcto es 18 pt»*, y
> lo recalcula a **189.8 pt** con una composición distinta del bloque de firma (119.8 pt
> en vez de 120, aire 16 en vez de 14).
>
> **El diseño aprobado sigue en 185 pt con renglón de 17 pt.** El spec de implementación ya
> lo corrigió. Las tres diferencias son: renglón 17 vs 18, bloque 120 vs 119.8, aire 14 vs
> 16. **Reportado, no resuelto.** La fórmula es la misma; solo cambian los insumos.

## C.2 · Las tres reglas, textuales del archivo

**Regla 1 · La firma nunca va sola**
> El bloque de firma se ancla a las últimas líneas del contenido. Antes de colocarlo, el
> motor comprueba que en la hoja quepan la firma y al menos tres líneas de texto; si no
> caben, esas tres líneas bajan con ella.

Implementación declarada: `firma 120 pt + aire 14 pt + 3 × 17 pt = 185 pt mínimos`

**Regla 2 · Sin viudas ni huérfanas**
> Ningún párrafo deja una sola línea al final ni al principio de una hoja. Si el corte
> produjera una línea suelta, se arrastran dos para que el párrafo nunca quede partido en
> uno.

Implementación declarada: `orphans: 2 · widows: 2 en todo párrafo de texto corrido`

**Regla 3 · La alarma es indivisible**
> El bloque de alarma no se parte entre hojas: o cabe entero o salta entero a la siguiente.
> Es señal, no texto corrido, y media señal no advierte de nada.

Implementación declarada: `break-inside: avoid en el bloque completo, filete y texto incluidos`

## C.3 · Bloques indivisibles y arrastre

| Concepto | Valor declarado |
|---|---|
| Bloques que no se parten | Alarma · entrada de medicamento · bloque de firma |
| Qué viaja con la firma | Las últimas **3 líneas** del último bloque de texto corrido |
| Ajustes prohibidos | Cambiar cuerpo, interlineado o márgenes para cuadrar una hoja |

> El inventario de indivisibles del diseño son **tres**. `DOCUMENTOS_SPEC.md` 2.N lista
> **cuatro**: alarma, entrada numerada, bloque de firma **y bloques destacados** (que
> incluye instrucciones y cita). El diseño lo cumple en la práctica —Suplementación e
> Internamiento llevan `break-inside: avoid` en cita e instrucciones— pero **no lo declara
> en su spec de flujo**. **Reportado como D44.**

## C.4 · Composición de la última hoja

| Concepto | Valor declarado |
|---|---|
| Anclaje de la firma | **Al final del contenido**, no al pie de la caja |
| Aire sobrante | **Debajo** de la rúbrica |

Es la regla de chasis que el cliente elevó desde el caso de un medicamento. El archivo
tiene las dos versiones lado a lado para comparar: `B3 · desborde (3 de 3) · recompuesta`
(aprobada, `firmaArriba: true`) y `B3 anterior · firma al pie` (descartada,
`hayFirma: true`). **No extraer valores de la descartada.**

## C.5 · Los tres avisos de pie

Extraídos del uso real en los ocho formatos, más el spec del archivo:

| # | Aviso | Cuándo | Formato donde se observa |
|---|---|---|---|
| 1 | `Continúa en la hoja N · <ítems> X a Y` | La lista no terminó en esta hoja | Receta, Imagenología, Suplementación |
| 2 | `Las recomendaciones continúan en la hoja N` | La lista cerró, el texto corrido sigue | Declarado; **no observado literalmente** — Receta usa `Recomendaciones generales · continuación` como encabezado de bloque, no como aviso de pie |
| 3 | `Reservado para la firma · continúa en la hoja N` | Todo cerró y solo falta la firma | **Recibo** (única instancia observada) |

**Construcciones propias que no son ninguno de los tres:**

| Formato | Aviso izquierdo |
|---|---|
| Laboratorio | `La solicitud continúa en la hoja 2` |
| Consentimiento | `El consentimiento continúa en la hoja 2` |
| Internamiento | `Continúa en la hoja 2 · instrucciones y firmas` |
| Escrito Médico | `El escrito continúa en la hoja 2` |

**Zona derecha del aviso — seis cadenas distintas observadas:**
```
Firma en la última hoja              ← Laboratorio
Sin firma no es válida               ← Imagenología, Receta
Sin firma no es válido               ← Suplementación, Escrito Médico
El recibo no es válido sin ella      ← Recibo
Sección 1 de 2                       ← Internamiento
(ninguna)                            ← Consentimiento
```

> **Refuerza D5 y D22.** El aviso de pie **no está unificado en el sistema**: hay cuatro
> construcciones de la zona izquierda que no son canónicas y seis cadenas distintas en la
> derecha. Solo Receta, Imagenología, Suplementación y Recibo usan alguna de las tres
> formas canónicas. **Reportado, no resuelto.**

## C.6 · Medidas de texto corrido declaradas

| Concepto | Valor |
|---|---|
| Medida | **486 pt** · token único · **≈ 85 caracteres** a 11.5 pt |
| Cuerpo | **11.5 / 18 pt** |
| Alineación | **Bandera izquierda** · nunca justificado a esta medida |
| Alarma | **12 / 18 pt** · conserva un punto de ventaja sobre el texto corrido |

---

# D · MAPEO DE LOS 14 COMPONENTES

Cierra el A.16 con `DOCUMENTOS_SPEC.md` a la vista.

## D.1 · Los 14 del plan contra los componentes de la hoja espécimen

| # | Componente del plan | ¿En la hoja espécimen? | Correspondencia |
|---|---|---|---|
| 2.A | `PanelCircular` | **Sí** | Bloque 04 · Panel circular de identidad |
| 2.B | `Membrete` | **Sí** | Bloque 05 · Membrete |
| 2.C | `TituloDocumento` | **Sí** | Bloque 06, primera mitad |
| 2.D | `BloquePaciente` | **Sí** | Bloque 06, segunda mitad · Riel de identificación |
| 2.E | `Campo` | **Sí** | Bloque 07 · Campo, tres estados |
| 2.F | `RielDatos` | **Sí** | Bloque 03-B · Riel de datos (como dispositivo gráfico) y bloque 06 (como componente) |
| 2.G | `EntradaNumerada` | **No** | Nace en la Receta. El espécimen solo tiene `Tabla` en modo grid |
| 2.H | `BloqueNegativo` | **No** | Nace en la Receta, ronda 3 |
| 2.I | `BloqueDestacado` | **Parcial** | Bloque 03-F · Marco parcial de dos lados, como dispositivo. Las tres variantes nacen en los formatos |
| 2.J | `ParserBloques` | **No** | Nace en Internamiento |
| 2.K | `ContadorLista` | **Parcial** | Bloque 09 lo tiene como `Total de estudios`, sin la forma de hoja intermedia |
| 2.L | `BloqueFirmas` | **Sí** | Bloque 10 · Bloque de firmas |
| 2.M | `PieDocumento` | **Sí** | Bloque 11, segunda mitad · Banda de pie |
| 2.N | `MotorFlujo` | **No** | No es visual. Nace en la ronda de flujo de la Receta |

**Están en la hoja espécimen: 8 completos + 3 parciales.** No nacen ahí: `EntradaNumerada`,
`BloqueNegativo`, `ParserBloques`, `MotorFlujo`.

> **Sobre el «9 componentes» del handoff.** Con este mapeo, la cuenta más defendible es
> **8 completos** (A, B, C, D, E, F, L, M). El noveno sería `ContadorLista` o
> `BloqueDestacado`, ambos parciales. **No resuelvo cuál cuenta el handoff.**

## D.2 · Componentes del diseño SIN equivalente en los 14

Confirmo tus cuatro candidatos y corrijo uno:

| Candidato tuyo | Veredicto |
|---|---|
| **Filete grueso-fino** | ✅ **Confirmado.** No hay componente. Está en la hoja espécimen (bloque 03-A) como dispositivo gráfico y se instancia 3–4 veces por hoja en los ocho formatos. El plan solo tiene la escala `filete.*` en I.1.6, que da grosores pero no la **composición** de segmento grueso + resto fino |
| **Zona de QR** | ✅ **Confirmado.** No hay componente. Bloque 11 del espécimen. El plan lo menciona como propiedad de identidad de cada formato (`QR: Sí/No`) y en la composición de II.3–II.5 como «`PieDocumento` con QR», pero **el QR del diseño no vive en el pie**: vive en el cuerpo de la última hoja (D17). Sin componente, cada formato lo recompone |
| **Marca de estado** | ✅ **Confirmado.** No hay componente. Bloque 12 del espécimen. `DOCUMENTOS_SPEC.md` la menciona en II.7 §1 y §5 como propiedad del Consentimiento, y en I.3.2 prohíbe la marca de agua que sustituye — pero no la declara como componente. Y sus valores divergen entre espécimen y Receta (D18) |
| **Encabezado de sección** | ⚠️ **Corrijo.** Sí tiene equivalente **parcial**: es la composición de `EntradaNumerada` sin ranuras opcionales —riel de número + título + prosa— y así lo usan Consentimiento e Internamiento. Pero el plan declara `EntradaNumerada` como «el ítem de lista del sistema», y un encabezado de sección **no es un ítem de lista**: no lleva contador, no participa de `ContadorLista` y su número es de sección, no de entrada. **Es un uso forzado, no una correspondencia.** Cuenta como faltante |

**Dos que faltan y no estaban en tu lista:**

| Componente del diseño | Dónde | Por qué falta |
|---|---|---|
| **Apertura de sección** | Internamiento, hoja 3 | Filete de 4 pt + número de 26 pt + subtítulo de lector. El plan lo menciona en II.6 §3 como «`filete.transicion` con número colgado», sin componente. Ver D31 |
| **Riel de importes** | Recibo / Cotización | Subtotales + total de 22 pt + anticipo + saldo, en caja de 246 pt con retícula `1fr auto`. El plan no lo declara: II.5 §3 dice «lista de conceptos con importes → total», sin componente. Es el único bloque del sistema con jerarquía de cifra |

**Lista final de componentes del diseño sin equivalente en los 14: seis.**
Filete grueso-fino · Zona de QR · Marca de estado · Encabezado de sección ·
Apertura de sección · Riel de importes.

---

## Resumen de cumplimiento del token de texto corrido

Es el desincronizado que más varía, así que lo consolido:

| Formato | Cuerpo | Alineación | Medida | ¿Cumple? |
|---|---|---|---|---|
| Laboratorio | — | — | — | **No aplicable** (sin prosa) |
| Imagenología | 10.5 / 17 y 10.5 / 16 | izquierda ✔ | 486 ✔ / 381 | **Parcial** |
| Receta | 11.5 / 18 ✔ (recom.) · 10 / 14 (indicación) | izquierda ✔ | 486 ✔ / 381 | **Parcial** |
| Suplementación | **11.5 / 18** ✔ | izquierda ✔ | **486** ✔ | **Sí** |
| Recibo | 9.5 / 14 | **justificado** ✘ | celda | **No** |
| Internamiento | **11.5 / 18** ✔ | izquierda ✔ | **486** ✔ | **Sí** |
| Consentimiento | 10.5 / 16 | **justificado** ✘ | 381 | **No** |
| Escrito Médico | **11.5 / 18** ✔ | izquierda ✔ | **486** ✔ | **Sí** |

**Tres cumplen, dos parciales, dos no cumplen, uno no aplica.** Los dos que no cumplen son
además los dos que conservan justificado con partición (D28, D33), que el chasis prohíbe
sin excepción.

---

## Estado de la Parte B

| # | Formato | Ficha |
|---|---|---|
| 1 | Solicitud de Laboratorio | **Completa** |
| 2 | Solicitud de Imagenología | **Completa** |
| 3 | Receta Médica | **Completa** |
| 4 | Plan de Suplementación | **Completa** |
| 5 | Recibo / Cotización | **Completa** |
| 6 | Solicitud de Internamiento | **Completa** |
| 7 | Consentimiento Informado | **Completa** |
| 8 | Escrito Médico | **Completa** |
| — | Spec de flujo del chasis (`Receta - Flujo y ancho.dc.html`) | **Completa** — sección C |
| — | Mapeo de los 14 componentes | **Completa** — sección D |

## Divergencias acumuladas contra `DOCUMENTOS_SPEC.md`

Numeradas para poder referirlas. Ninguna resuelta por mi parte.

| # | Divergencia | Dónde |
|---|---|---|
| D1 | Título: capitalización de oración + `uppercase` en el diseño, mayúsculas literales en el spec | B.1 §1 |
| D2 | El subtítulo del documento existe en el diseño y no está inventariado en el spec | B.1 §1 |
| D3 | Laboratorio usa `Tabla` en modo grid de 3 columnas, el spec declara `EntradaNumerada` | B.1 §3 |
| D4 | Dos calibraciones de fila sin umbral declarado | B.1 §3 |
| D5 | Los avisos de continuación del diseño no son ninguno de los tres canónicos del spec | B.1 §4 |
| D6 | Un solo riel de 7 celdas en el diseño, dos rieles en el spec | B.1 §6 |
| D7 | El nombre del médico mide 22 pt en formato y 26 / 24 / 26 en el espécimen | B.1 · Pregunta B |
| D8 | Cuerpo de texto corrido: 10.5 / 17 pt en notas de Imagenología, 10.5 / 16 en su indicación, 11.5 / 18 exigido por el chasis. Tres valores | B.2 §5 |
| D9 | Cédulas bajo la firma: Archivo #454545 en Laboratorio, IBM Plex Sans #737373 en Imagenología | B.2 §5 |
| D10 | `ParserBloques` recibe una cadena con viñetas según el spec; en Imagenología recibe un array de párrafos | B.2 §6 |
| D11 | Número de entrada: seis valores en el sistema — 9 / 11.5 y 9.5 / 14 (Lab), 13 / 17 (Imagen), 13 / 16 y 14 / 17 (Receta), 15 (espécimen) | B.3 · Pregunta B |
| D12 | El campo vacío de la lámina de Receta usa 11 pt de alto y ancho flexible; el chasis fija 20 pt y 246 pt | B.3 §3 |
| D13 | La leyenda `Vía no oral en negativo` se imprime en el documento, en IBM Plex Mono, que no es familia del chasis | B.3 §4 |
| D14 | Rótulo de firma: `Firma del médico` en Receta, `Firma y sello del médico` en Lab e Imagen | B.3 §4 |
| D15 | Sangría de la alarma: 14 pt en el diseño, `espacio.16` exigido por el chasis | B.3 §5 |
| D16 | Cuerpo de la alarma 12 / 18 pt peso 500 — sin token declarado en el chasis | B.3 §5 |
| D17 | El QR de Receta vive en el cuerpo de la última hoja, no en el pie como dice el spec | B.3 §6 |
| D18 | Marca de estado: −9° y contorno 0.5 pt en Receta, −28° y 0.7 pt en el espécimen | B.3 §5 |
| D19 | La ficha de spec de Suplementación dice 10.5 / 16 pt; su marcado imprime 11.5 / 18 pt | B.4 §3 |
| D20 | Segunda aparición de IBM Plex Mono en documento impreso: el eco del peso | B.4 §4 |
| D21 | Sangría de `BloqueDestacado`: 14 pt (alarma), 12 pt (cita), `espacio.16` exigido por el chasis | B.4 §5 |
| D22 | La zona derecha del aviso de continuación se parametriza por formato (`válida` / `válido`), no es constante | B.4 §4 |
| D23 | Dos membretes: Lab y Recibo sin línea de cédulas; Imagen, Receta y Suplementación con ella | B.5 §2 |
| D24 | Recibo no instancia `ContadorLista`, ni en su hoja intermedia; el spec lo declara | B.5 §3 |
| D25 | Velo de acento: 6 % en el panel circular, **8 %** en la celda de vigencia. Dos valores | B.5 §5 |
| D26 | Marco parcial de 2 pt **en acento** (aseguradora, leyenda no fiscal, declaración) no está declarado como variante de `BloqueDestacado` | B.5 §5 |
| D27 | `manuscrito.alto`: 20 pt (chasis), 16 pt (espécimen y Recibo), 11 pt (lámina de Receta). Tres valores | B.5 §6 |
| D28 | **Las notas de la cotización van justificadas con `hyphens: auto`.** El chasis prohíbe el justificado sin excepción (I.3.2) | B.5 · Pregunta A |
| D29 | Nombre bajo la firma: 11.5 / 15 (Lab), 11 / 15 (Imagen, Receta, Supl.), 10 / 14 (Recibo e Internamiento firma doble). Tres valores, uno de ellos dentro del mismo archivo | B.6 §5 |
| D30 | La raya de ítem se compone en IBM Plex Mono. Tercera aparición de la mono, y la primera como contenido y no notación | B.6 §3 |
| D31 | La apertura de sección no corresponde a ninguno de los 14 componentes del spec | B.6 §6 |
| D32 | Título: el spec dice `CARTA DE CONSENTIMIENTO INFORMADO`, el diseño imprime `CONSENTIMIENTO MÉDICO INFORMADO` | B.7 §1 |
| D33 | **El Consentimiento va justificado con partición en todo su texto corrido**, a 10.5 / 16 pt y medida 381 pt. Nunca recibió la corrección a bandera izquierda | B.7 §3 |
| D34 | El bloque de motivo tiene borde en los cuatro lados y fondo; el chasis solo declara marcos parciales | B.7 §4 |
| D35 | **La decisión de que el médico no imprima rúbrica en el Consentimiento no está aplicada al archivo**: hay tres getters de trazo activos | B.7 §5 |
| D36 | El spec declara QR y marca de estado para el Consentimiento; el diseño no instancia ninguno | B.7 §6 |
| D37 | El spec pide `BloqueFirmas` `compacta` (28 pt); el diseño usa `amplia` (77 pt) repartida en dos hojas | B.7 §6 |
| D38 | La bandera `identificacion` de cada firmante es código muerto: el marcado ya no la lee | B.7 · Pregunta D |
| D39 | La ficha de spec del Escrito Médico conserva dos filas de la serie descartada que dicen que la fecha vive en el pie | B.8 · encabezado |
| D40 | La fecha va sin rótulo a 9 pt #737373 en la hoja 1, y rotulada `Emisión` a 10 pt peso 500 en la continuación | B.8 §2 |
| D41 | `tituloPie` es un segundo campo que puede diferir del título del encabezado, no un truncado automático | B.8 §5 |
| D42 | Variante `cita` de `BloqueDestacado`: filete superior e izquierdo en Suplementación, solo izquierdo en Escrito Médico | B.8 §6 |
| D43 | **Umbral de la regla 1: 185 pt en el diseño (renglón 17, firma 120, aire 14) contra 189.8 pt en el spec (renglón 18, firma 119.8, aire 16)** | C.1 |
| D44 | El diseño declara tres bloques indivisibles; el spec declara cuatro (añade bloques destacados) | C.3 |
