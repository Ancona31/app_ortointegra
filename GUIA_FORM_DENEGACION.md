# Guía de composición — Denegación o Revocación del Consentimiento

Documento **independiente** de una hoja. Se emite **en lugar** del consentimiento, no como
parte de él. Medido en `Denegacion de Consentimiento.dc.html`, coordenadas absolutas desde
el borde del papel (612 × 792 pt).

**Dos variantes**, ambas en una hoja y sin desborde:

| Lámina | Firmantes | Desborde V | Desborde H |
|---|---|---|---|
| `Denegación · firma el paciente` | 3 | **0** | 0 |
| `Denegación · por sustitución` | 2 | **0** | 0 |

---

## 1 · Cómo se elige

Conmutador en el formulario, como el de recibo / cotización en Honorarios. Comparte los
datos de identificación con el consentimiento; al elegir denegación se pliegan las siete
secciones clínicas y las autorizaciones, que no aplican.

**No hay anexo de identificaciones** en este documento. Con ello queda cerrado el
`NO DEFINIDO` de la numeración: siempre es `Página 1 de 1`.

---

## 2 · Encabezado completo

Es primera hoja, así que lleva membrete entero. **No hay línea de paciente reducida:** el
paciente va en el riel.

| Punto | Y | Alto |
|---|---|---|
| Abre membrete | 54 | **59** |
| Cierra membrete | 113 | |
| Filete principal (96 × 2.5 + 0.8) | 121 → 123.49 | 2.5 |
| Banda de dirección | 129.49 → 141.49 | 12 |
| **Espaciador** | 141.49 → 153.49 | **12** |
| **Bloque de título** | 153.49 → 209.48 | **55.99** |
| Filete de título (96 × 2.5 + 0.8) | 213.48 → 215.98 | 2.5 |
| Espaciador | 215.98 → 223.97 | 8 |
| **Riel de identificación** | 223.97 → 293.84 | **69.86** |
| Filete de cierre del riel | 293.84 → 294.59 | 0.75 |

**Alto total del encabezado: 240.59 pt** (54 → 294.59).

**Banda de dirección: un solo renglón**, Archivo 7.5 / 12 pt, peso 400, `#454545`, margen
superior 6, dos zonas con `space-between`. Sin cédulas ni universidad — igual que el
consentimiento.

```
Calle 20 Núm. 110-J, entre 23 y 25, Centro, Umán, Yucatán 97390 | Tel. 999 222 3173
```

---

## 3 · Bloque de título

Caja de **321 pt**, riel de folio de **156 pt** a la derecha, medianil 9 pt.

| Parte | Familia | Cuerpo / int. | Peso | Tracking | Color |
|---|---|---|---|---|---|
| Título | Archivo | **17 / 20 pt** | **600** | 0.02 em | `#101010` |
| Subtítulo | IBM Plex Sans | 10.5 / 14 pt | 400 | normal | `#454545`, margen 2 |
| Rótulo `Folio` | Archivo | 7 / 11 pt | 600 | 0.22 em | `#737373` |
| Valor del folio | Archivo | 11 / 14 pt | **500** | 0.03 em | `#1a3250` |

**El título ocupa dos renglones** en la caja de 321 pt: 40 pt de los 55.99 del bloque.

**Sin bloque en negativo.** Con título propio duplicaba la función y competía con él a dos
renglones de distancia; la distinción de un vistazo la da el título.

---

## 4 · Riel de identificación

Seis celdas en dos filas. Celda base **32.99 pt** = padding 4 + rótulo 10 + valor 14 +
padding 5. Sin diagnóstico ni expediente.

| Celda | Span | Ancho | Alto | Composición del valor |
|---|---|---|---|---|
| `Paciente` | 5 | 202.5 | 32.99 | Archivo 11.5 / 14, peso **500** |
| `Edad` | 2 | 81 | 32.99 | Archivo 11.5 / 14, tabular |
| `Fecha` | 5 | 202.5 | 32.99 | Archivo 11.5 / 14, tabular |
| **`Familiar o responsable`** | 4 | 162 | **36.12** | **campo vacío requerido** |
| `Hospital o clínica` | 5 | 202.5 | 36.12 | Archivo **12.5 / 16**, peso 500, −0.01 em |
| `Lugar` | 3 | 121.5 | 36.12 | Archivo 11 / 16 |

Rótulos: Archivo 7 / 10 pt, peso 600, tracking 0.22 em, uppercase, `#737373`.
Reglas: 0.5 pt `#D9D6D0` entre celdas; 0.8 pt `#101010` arriba y abajo del riel.

**`Familiar o responsable` es campo vacío requerido:** línea de escritura de **16 pt** con
`border-bottom: 0.8 pt #101010`, anclada al fondo de la celda con `margin-top: auto`.
El familiar se queda en el riel, como en el consentimiento.

---

## 5 · La declaración

Marco parcial de dos lados, **el mismo de la declaración de otorgamiento**: comparten
anatomía, y lo que las diferencia es el título del documento.

| Valor | Medida |
|---|---|
| Filete superior e izquierdo | **2 pt** `#1C3A5E` (acento) |
| Padding | `9 / 12 / 11 pt` |
| Ancho | **426 pt** |
| `break-inside` | `avoid` |
| **Alto medido** | **177.89 pt** |
| Y | 306.59 → 484.48 |

**Párrafos:** IBM Plex Sans **10.5 / 16 pt**, peso 400, `#101010`, medida **400.13 pt**,
`text-align: justify` con `hyphens: auto`, `orphans: 2`, `widows: 2`. Margen entre
párrafos **6 pt**. Datos destacados en `<strong>` con **peso 500**.

**Cadenas literales**, con los tres ajustes aprobados:

```
Yo, [PACIENTE], declaro que he sido informado de manera clara y completa sobre el
procedimiento [PROCEDIMIENTO], sus riesgos, beneficios y alternativas, por el [MÉDICO].

No obstante, en pleno uso de mis facultades y de forma libre y voluntaria, manifiesto mi
decisión de no autorizar o revocar la autorización previamente otorgada para la
realización del procedimiento descrito, asumiendo las consecuencias que de ello puedan
derivarse, las cuales me han sido explicadas.

Se me ha informado que puedo cambiar de opinión y otorgar mi consentimiento en cualquier
momento.
```

Alturas de párrafo: 48.01 · 64.01 · 32 pt.

---

## 6 · La casilla de sustitución

Va debajo de la declaración, fuera del marco, en las **dos** variantes. Es el mismo
recurso medido en la variante por sustitución del consentimiento, hoja 4.

| Valor | Medida |
|---|---|
| Y | 496.48 → 518.47 |
| **Alto** | **22 pt** (dos renglones) |
| Ancho del bloque | 426 pt |
| Margen superior | 12 pt |
| Medianil casilla–texto | 7 pt |
| **Casilla** | **9 × 9 pt**, borde 0.8 pt `#101010`, `box-sizing: border-box` |
| Marca interior | **5 × 5 pt** sólida `#101010`, solo cuando está marcada |
| Texto | IBM Plex Sans **8 / 11 pt**, peso 400, `#101010` |

```
El paciente no puede firmar por sí mismo; firma en su lugar el familiar o responsable,
cuyos datos se asientan en el recuadro de la derecha.
```

---

## 7 · La constancia del motivo

**Solo en la variante por sustitución.** Responde a tu pregunta de si el documento necesita
decir en el texto que el paciente no firma: **sí, y la fórmula sale de la hoja 4 del
consentimiento**, donde ya está resuelta y medida. No inventé texto nuevo.

| Valor | Medida |
|---|---|
| Y | 530.47 → 568.22 |
| **Alto** | **37.75 pt** |
| Ancho | 426 pt |
| Borde | **0.5 pt `#D9D6D0` en los cuatro lados** |
| Fondo | **`#FAF9F7`** |
| Padding | `7 / 9 pt` |
| Margen superior | 12 pt |

```
Motivo por el que el paciente no firma          ← Archivo 6.5 / 10, 600, 0.22 em, #737373
Imposibilidad física para firmar. Motivo valorado y asentado por el médico tratante.
                                                ← IBM Plex Sans 9.5 / 13, 400
```

Es el único bloque del sistema con borde completo y fondo: se lee como constancia impresa,
no como campo por llenar. La caja crece con su contenido (`min-height`, no `height`), así
que aguanta un motivo más largo sin romperse.

---

## 8 · La retícula de firmas

**Regla: tantas columnas como firmantes.** Una sola fila siempre, sin media fila vacía.

| Variante | Firmantes | Columnas | Ancho de celda | Y | Alto |
|---|---|---|---|---|---|
| Firma el paciente | 3 | **3** | **142 pt** | 530.47 | 117.74 |
| Por sustitución | 2 | **2** | **228 pt** | 580.22 | 117.74 |

Medianil **30 pt** horizontal. `break-inside: avoid` por celda.
Verificado a 142 pt: rol, nombre y nota entran **en un renglón cada uno**, sin saltos.

**Desglose de la celda — 117.74 pt:**

| # | Contenido | Alto | Composición |
|---|---|---|---|
| 1 | Rol | 11 | Archivo 7 / 11, peso 600, 0.22 em, uppercase, `#737373` |
| 2 | **Espacio de firma** | **77** | `overflow: hidden` |
| 3 | Filete | 0.8 | `#101010` |
| 4 | Nombre | 14 | Archivo 10 / 14, peso 600, −0.012 em, margen 4 |
| 5 | Nota | 11 | IBM Plex Sans 7.5 / 11, `#737373`, tabular |

**Los 77 pt del sistema, sin comprimir.** Es el tramo `amplia` del parámetro de dos tramos.

**Sin niveles y sin campo de parentesco.** Los tres firman el mismo acto, así que no hay
jerarquía de otorgamiento; el parentesco ya está asentado en el riel.

**Los firmantes:**

| Variante | # | Rol | Nombre | Nota | Rúbrica |
|---|---|---|---|---|---|
| A | 1 | `Médico tratante` | `Dr. Ángel M. Ancona Pérez` | `Céd. Prof. 9552456 · Céd. Esp. 12085805` | sí |
| A | 2 | `Paciente` | `Prueba Prueba` | `Nombre y firma` | sí |
| A | 3 | `Familiar o responsable` | `Nombre y firma` | `Representante del paciente` | sí |
| B | 1 | `Médico tratante` | ídem | ídem | sí |
| B | 2 | `Familiar o responsable` | `Nombre y firma` | **`Firma en representación del paciente`** | sí |

Fuera el anestesiólogo —entrega su propio consentimiento— y fuera los testigos, opcionales
en una revocación.

**Por sustitución la celda del paciente desaparece** y el familiar deja de ser opcional:
su nota cambia a `Firma en representación del paciente`.

La rúbrica se renderiza por firmante de forma independiente: quien firmó en pantalla sale
con su trazo, quien no, con el espacio en blanco de 77 pt. Ninguna imagen se escala.

---

## 9 · Espaciados verticales

| Entre | pt |
|---|---|
| Membrete → filete principal | 8 |
| Filete → banda de dirección | 6 |
| Dirección → espaciador → título | **12** |
| Título → filete de título | 4 |
| Filete → espaciador → riel | **8** |
| Riel → espaciador → declaración | **12** |
| Declaración → casilla | **12** |
| Casilla → constancia *(solo B)* | **12** |
| Casilla o constancia → firmas | **12** |
| Firmas → fin de caja | A: 75.79 · B: 26.04 |

Todos múltiplos de 4.

---

## 10 · Pie y folio

**Banda de 16 pt**, y = 740 → 756, dentro de la zona segura: `left: 72pt`, `right: 54pt`,
`bottom: 36pt`. Fondo `#182b43` (acento + 35 % negro). Retícula `auto auto 1fr`, padding
lateral 8 pt, las tres zonas con `nowrap`.

| Zona | Contenido | Cuerpo | Peso | Tracking |
|---|---|---|---|---|
| Izquierda | `Folio D-6E19B4C0A73F` | 7 | 400 | 0.1 em |
| Centro | `Página 1 de 1` | 7 | **600** | 0.22 em, uppercase |
| Derecha | `Documento generado por Spinus · Expediente clínico electrónico · spinus.com.mx` | **6** | 400 | 0.05 em |

**Prefijo de folio: `D-`.** Libre — los ocho en uso son `L- I- P- S- Q- R- H- C-`.

**Sin QR.** El documento no autoriza nada; es la constancia de que no se autorizó.

---

## 11 · Holgura y límites

| Variante | Contenido termina en | Holgura hasta 724 |
|---|---|---|
| Firma el paciente | 648.21 | **75.79 pt** |
| Por sustitución | 697.96 | **26.04 pt** |

**La variante por sustitución es la más ajustada del documento.** Los 26 pt de holgura los
consume la constancia del motivo (37.75) más su espaciador (12).

**Riesgo declarado:** si el nombre del procedimiento fuera mucho más largo, la declaración
crece y la variante B es la primera que desbordaría. **NO DEFINIDO** qué hacer entonces —
el reparto de este documento en dos hojas no está resuelto, y no debería estarlo sin
decidir antes si una revocación en dos hojas es aceptable.

---

## 12 · Componentes del chasis que instancia

| Componente | Variante |
|---|---|
| `PanelCircular` | `monograma` |
| `Membrete` | `completo` sin cédulas |
| `TituloDocumento` | `fijo` con subtítulo, caja 321 pt, riel 156 pt |
| `BloquePaciente` | `completo`, 6 celdas |
| `RielDatos` | `celdas` |
| `Campo` | `con valor` y **`vacío requerido`** (familiar, línea de 16 pt) |
| `BloqueDestacado` | marco 2 pt **en acento** (declaración) · borde completo con fondo (constancia) |
| `BloqueFirmas` | **`amplia`** — 77 pt, columnas = firmantes |
| `PieDocumento` | `completo`, sin QR |
| `EntradaNumerada` · `BloqueNegativo` · `ParserBloques` · `ContadorLista` | **no se usan** |

**Dos recursos que el chasis no declara** y este documento usa:

- **Retícula de firmas con columnas = firmantes.** El chasis fija 2 columnas de 228 pt.
  Aquí 3 firmantes en 2 columnas desbordaban 62 pt y dejaban media fila vacía; 3 columnas
  de 142 pt caben en una fila sin saltos de línea. **Es un parámetro nuevo del componente,
  no un componente nuevo — pero hay que declararlo.**
- **Bloque con borde completo y fondo** (la constancia). Ya existía sin declarar en la
  hoja 4 del consentimiento; este documento es el segundo consumidor.
