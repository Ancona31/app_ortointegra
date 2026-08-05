# Sistema de documentos PDF de Spinus — Traspaso a fase de programación

> Documento de continuidad. Cierra la fase de diseño y abre la de código.
> Generado al término de la sesión de rediseño de los 8 formatos.
> **Este archivo es la fuente de verdad del diseño.** Donde contradiga a
> `DOCUMENTOS_DECISIONES.md`, manda este.

---

## 0 · Estado

**Los 8 formatos están diseñados y aprobados.** No queda trabajo de diseño pendiente.

| # | Formato | Arquetipo | Estado |
|---|---------|-----------|--------|
| — | Hoja espécimen (9 componentes) | chasis | cerrado |
| 1 | Solicitud de Laboratorio | A | cerrado |
| 2 | Consentimiento Informado | C | cerrado |
| 3 | Recibo de Honorarios / Cotización | D | cerrado |
| 4 | Receta Médica | B | cerrado |
| 5 | Plan de Suplementación | B | cerrado |
| 6 | Solicitud de Imagenología | A | cerrado |
| 7 | Solicitud de Internamiento | especial | cerrado |
| 8 | Escrito Médico | especial | cerrado |

Lo que sigue: **Fase 1 del código**, plantillas, cambios de formulario, y la prueba de extracción de texto.

---

## 1 · Corrección a `DOCUMENTOS_DECISIONES.md`

El §2 quedó con reglas superadas por el brief v2. **No implementar desde ahí.**

| Dice §2 (obsoleto) | Rige (brief v2 + esta sesión) |
|---|---|
| Serif de texto para párrafos largos | **Sin serif.** Dos sans: neo-grotesca + humanista |
| Chasis neutro, negro y grises, acento en 3–4 lugares | El acento del médico presente trabajando: anillo, filete, reglas |

---

## 2 · Tokens del chasis

### Papel y retícula
| Token | Valor |
|---|---|
| Papel | Carta 216 × 279 mm |
| Margen | Izquierdo mayor que el derecho (se perfora en hospitales) |
| Base de espaciado | 4 pt |
| Caja de texto | **486 pt** |
| Retícula | 12 columnas de 32.25 pt + 11 medianiles de 9 pt = 486 pt |
| Riel del número | 23.25 pt (+ 9 pt de medianil = 1 columna) |

### Tipografía
| Token | Valor |
|---|---|
| Neo-grotesca | Archivo — identidad, títulos, datos, tablas, etiquetas |
| Humanista | IBM Plex Sans — texto corrido largo |
| Texto corrido | **11.5 / 18 pt**, bandera izquierda, **nunca justificado** |
| Medida | 486 pt ≈ 93 caracteres |
| Prohibidas | Roboto, Arial, Helvetica, fuentes de sistema |

> **Token único de texto corrido: 486 pt.** Elimina el 453.75 pt que apareció en Suplementación. Un solo valor en todo el sistema.

### Escritura manuscrita
| Token | Valor | Medido contra |
|---|---|---|
| Alto de escritura | **20 pt (7.06 mm)** | Pautado de cuaderno profesional, 7.1 mm |
| Ancho de línea de campo vacío | **246 pt** (genérico y presentación comparten valor) | Presentación más larga del catálogo × 1.8 de factor manuscrito |
| Grosor de línea | 0.8 pt (el mismo de la línea de firma) |

Aplica a: líneas de campo vacío requerido · bloques rayados · líneas de firma manuscrita · cualquier espacio destinado a llenarse con pluma.

### Filetes — jerarquía de grosores
| Grosor | Uso | Reservado a |
|---|---|---|
| 4 pt | Transición de sección | Internamiento (el más grueso del sistema) |
| 3 pt | Bloque de alarma | Receta |
| 2 pt | Instrucciones al paciente | Internamiento |
| 1.6 pt | Cita de control | Suplementación |
| 0.8 pt | Línea de escritura y de firma | todos |
| 0.5 pt | Regla entre entradas | todos |

### Bloque en negativo
Fondo `#101010`, texto blanco, versalita con tracking. Ancho variable según la palabra, **nunca se abrevia**.
Usos: vías de administración (13) · badge `URGENTE`.

### Firmas
| Caso | Alto |
|---|---|
| Hasta 2 firmas por hoja | 77 pt |
| De 3 a 6 firmas | 28 pt (piso del sistema — Consentimiento) |

Lo fija cuántas firmas comparten la hoja, **no** el hueco sobrante. Es una imagen: no admite escala por hoja.

---

## 3 · Reglas de flujo y paginación

### Las tres reglas
1. **La firma nunca va sola.** Se ancla a las últimas líneas del contenido. Mínimo requerido: firma 120 pt + aire 14 pt + 3 × 17 pt = **185 pt**. Si no caben, esas 3 líneas bajan con la firma.
2. **Sin viudas ni huérfanas.** `orphans: 2` · `widows: 2` en todo párrafo de texto corrido.
3. **Bloques indivisibles.** `break-inside: avoid` en: bloque de alarma · entrada de medicamento/suplemento/estudio · bloque de firma · bloques de indicaciones.

**Prohibido** cambiar cuerpo, interlineado o márgenes para cuadrar una hoja. El motor solo mueve bloques.

### Composición de última hoja (regla del chasis)
El bloque de firma se ancla **al final del contenido**, no al pie de la caja. El aire sobrante queda **debajo** de la rúbrica. Aplica a todos los formatos.

### Los tres avisos de pie
| Aviso | Cuándo |
|---|---|
| `CONTINÚA EN LA HOJA N · <ÍTEMS> X A Y` | La lista no terminó en esta hoja |
| `LAS <ÍTEMS> CONTINÚAN EN LA HOJA N` | La lista cerró, el texto corrido sigue |
| `RESERVADO PARA LA FIRMA · CONTINÚA EN LA HOJA N` | Todo cerró y solo falta la firma (regla 1) |

### Contador de lista
| Hoja | Formato |
|---|---|
| Intermedia | `<ÍTEMS> EN ESTA HOJA · NN DE MM` (NN = lo impreso en esa hoja) |
| Final | `TOTAL DE <ÍTEMS> · MM` |

Un documento de una sola hoja cuenta como final.
**No aplica** a bloques no paginables — p. ej. requerimientos especiales de Internamiento, cuyo catálogo es abierto.

---

## 4 · Sintaxis de bloques de texto plano

Los campos de texto libre que se presentan como lista salen de **una sola cadena**, no de arrays. La estructura la trae el texto prellenado por plantilla.

### Reglas del parser
| Entrada | Salida |
|---|---|
| Línea que empieza con `•` | **Ítem** |
| Línea sin viñeta **con ítems debajo** | **Encabezado de bloque** |
| Línea sin viñeta **sin ítems debajo** | **Párrafo suelto**, sin numerar |
| Línea vacía | Corte, se descarta |

> **El lookahead es obligatorio.** Sin él, la prosa sin viñetas se compone en versalita como si fuera título. Fue el bug que apareció y se corrigió en Internamiento. **Es el primer caso a probar al escribir el parser.**

### Composición
- La viñeta del dato **se sustituye** por la raya del sistema. Nunca se imprimen las dos.
- Un ítem puede ocupar varias líneas: la raya cuelga y el texto sangra.
- **Degradación segura:** la viñeta vive en el dato, así que si el parser falla el texto sigue siendo una lista legible, nunca un párrafo apelmazado. Es requisito, no efecto colateral.

### Raya contra número
| Recurso | Cuándo |
|---|---|
| Raya | Enumeración sin orden (dieta, soluciones, medicamentos) |
| Número | **La secuencia significa algo** (instrucciones al paciente: primero presentarse, luego el ayuno) |

Con **un solo ítem no se numera**: se compone como párrafo.

### Bloques del sistema que usan esta sintaxis
Recomendaciones generales de receta · notas adicionales de suplementación · notas para el servicio de imagenología · instrucciones al paciente · indicaciones de ingreso a piso.

---

## 5 · Prohibiciones del sistema

- Barras de color sólido a todo lo ancho
- Sombreado alternado de filas (zebra) — delata origen HTML y desaparece en fotocopia
- Marca de agua de logo
- Iconos decorativos
- Degradados, sombras, esquinas muy redondeadas
- Texto justificado
- Ornamento clásico: orlas, molduras, guilloches
- **Color como único portador de significado** — todo debe sobrevivir en fotocopia monocroma

---

## 6 · Decisiones por formato

### Receta Médica
- **Jerarquía de la entrada** (invertida respecto a v1): ancla = `COMERCIAL · PRESENTACIÓN Y GRAMAJE` al mismo peso alto → genérico debajo, cuerpo menor pero **en tinta plena, nunca gris** → bloque de vía en negativo → indicación en humanista.
- El gramaje es dato de seguridad: es lo que más se equivoca en el mostrador.
- **13 vías**, todas en bloque negativo: oral · sublingual · tópica · transdérmica · oftálmica · ótica · nasal · inhalación · intramuscular · intravenosa · subcutánea · rectal · vaginal.
- `parenteral` **no es vía**: es la categoría que agrupa IV, IM y SC. Fuera del catálogo.
- Membrete con **universidad emisora obligatoria** (`extraCredencial`).
- **Un solo QR** (verificación). El QR del blog sale.
- Estados de campo vacío: rótulo `GENÉRICO` + línea. **Sin** leyenda «FALTA DATO OBLIGATORIO».
- Alarma: filete 3 pt sup+izq, sangría 14 pt.

### Plan de Suplementación
- Sin vía, sin presentación, sin genérico/comercial. Ancla = `NOMBRE · DOSIS`.
- **Peso** en el riel de paciente, con rótulo `BASE DEL CÁLCULO`. Colapsa si no viene; las dosis se imprimen igual.
- Rótulo junto al título de lista: `Dosis calculada para NN kg`.
- Cita de control: filete 1.6 pt, sin fondo de color.

### Solicitud de Imagenología
- **Título: `SOLICITUD DE IMAGENOLOGÍA`.** Cabe en un renglón; el anterior rompía a dos y desalineaba el encabezado.
- Ancla = `TIPO · REGIÓN`. Proyecciones y indicación clínica colapsan por separado.
- La indicación clínica es **por estudio**; el diagnóstico va una sola vez arriba.
- `URGENTE` marca el **documento**, no el estudio. Va bajo el título; se repite en tamaño menor en hojas de continuación, porque pueden llegar separadas.
- **Sin QR.** Arquetipo A: la solicitud no autoriza nada. En México los estudios se contratan sin solicitud médica.

### Solicitud de Internamiento
- **Dos secciones, dos lectores.** Sección 1: paciente y Admisión, con firma del paciente. Sección 2: enfermería y residente, solo firma del médico.
- **Folio, paginación y riel de paciente en TODAS las hojas.** En el hospital las hojas se separan; una hoja de indicaciones sin nombre de paciente es un riesgo de seguridad, no un descuido de maquetación.
- Transición de sección: filete 4 pt + número colgado 26 pt. La cabecera dice `SECCIÓN 2 DE 2`, **no** «continuación».
- Requerimientos especiales: riel de datos, **sin contador** — el catálogo es abierto, el médico agrega o quita.
- Instrucciones al paciente: filete 2 pt, lista **numerada** (la secuencia importa).
- Sin QR.

### Escrito Médico
- Hoja membretada multiuso: certificado, constancia, carta de recomendación, resumen para colega.
- **Único formato SIN FOLIO.** No son documentos seriados. Declararlo en el spec para que nadie lo reponga por consistencia mal entendida.
- **Título variable**, lo escribe el médico. Colapsa si no lo pone.
- Fecha de emisión en el **encabezado, derecha, sin rótulo, gris, cuerpo menor**. Sin lugar. `align-items: baseline` → se alinea a la **primera línea** del título.
- Pie de **tres zonas**: paginación · título del documento · leyenda.
- La línea de lugar y fecha formal la escribe el médico **dentro del cuerpo**, según lo que exija el trámite.
- Cuerpo arranca a **20 pt** bajo el filete. Sin título, el filete hace doble trabajo: cierra el membrete y abre el cuerpo.
- Contenido de TipTap con soporte markdown. **Hay errores de detección de caracteres pendientes de revisar en código.**

---

## 7 · Hallazgos técnicos críticos

### 7.1 · Extracción de texto rota — criterio de aceptación del código

En los PDF de mockup, `pdftotext` devuelve:

| Dato | Resultado |
|---|---|
| Nombre genérico (Paracetamol, Ketorolaco…) | **0 ocurrencias** — no es texto |
| Números de entrada (`01`, `02`) | Caracteres de reemplazo |
| `PÁGINA X DE Y` | Caracteres de reemplazo |
| Versalitas con tracking | Fragmentadas: `PACIENTE` → `PAC IE NT E` |
| Ligadura `fi` | `superficie` → `super�cie` |

**Causa probable:** los mockups se exportaron con Firefox → cairo, que convierte a trazos ciertos pesos intermedios de la fuente. Puede no reproducirse en react-pdf.

**Pero** `§8.5` de `DOCUMENTOS_AUDITORIA.md` ya documenta que el `letter-spacing` rompe la extracción en v1. El diseño nuevo usa versalitas con tracking en **todas** las etiquetas del sistema, no en tres títulos.

**Gravedad:** el campo que no extrae es la denominación genérica, el único obligatorio por normativa. Un expediente cuyo dato legalmente exigible no es legible por máquina es exactamente lo que se revisa en la certificación NOM-024.

**Prueba de aceptación obligatoria de Fase 1:** generar el PDF, correr extracción, y verificar que aparezcan como texto real: genérico · comercial · gramaje · vía · indicación · folio · paginación. Si el tracking rompe la extracción, usar versalitas reales de la fuente y **no** `letterSpacing` sobre mayúsculas.

### 7.2 · react-pdf
- `<Image>` acepta **solo JPG, PNG o base64**. No GIF, no EPS, no SVG como archivo.
- El vector va por primitivas `<Svg>` / `<Path>` / `<G>`.
- El logo PNG pesa **195 KB = 80 % del peso de cada archivo**. Vigilar el peso de todo asset ráster.

### 7.3 · Defecto nivel 1 en el membrete
`PdfHeader` renderiza especialidad, cédulas, `extraCredencial` y contacto **condicionales a truthy**. Hoy un médico con perfil incompleto emite recetas sin universidad y sin domicilio, en silencio. La normativa los exige.

**La validación debe bloquear la emisión, no colapsar el dato.** No es diseño: es defecto de producto.

---

## 8 · Cambios de formulario acumulados

Ninguno es de diseño. Todos salieron de esta sesión.

| # | Formato | Cambio |
|---|---|---|
| 1 | Receta | **Bug conocido:** hoy se puede generar sin medicamentos. El botón debe exigir al menos uno. El filtro previo al PDF es sobre `nombre_comercial` |
| 2 | Receta | Catálogo de vías: quitar `parenteral`, agregar `transdérmica` → 13 |
| 3 | Receta | Decisión aparte: ¿separar dosis / frecuencia / duración del campo `indicacion`? |
| 4 | Imagenología | Cambiar el título **también** en la app y en el nombre del archivo descargado, no solo en el PDF |
| 5 | Escrito Médico | Campo de título del documento |
| 6 | Internamiento | `placeholder` o nota bajo el textarea explicando que un renglón sin viñeta crea un bloque. Sin eso, la sintaxis existe y nadie la usa |
| 7 | Todos | Validación que bloquee emisión si falta universidad, cédulas o domicilio |
| 8 | Todos | `numero_expediente` se consulta en el hub pero **no se pasa a ningún formulario**. Es cableado, no campo nuevo |

---

## 9 · Pendientes abiertos

### 9.1 · Consolidar el spec
El spec quedó repartido: hay filas de chasis dentro de specs de formato. La regla de firmas apareció en Internamiento, la sintaxis de viñetas tiene hoja propia, el título variable está en Escrito Médico.

**Antes de la primera línea de código:** separar qué es chasis y qué es formato, o se implementan tokens duplicados.

### 9.2 · Plantillas
Ahora sí es posible: los 8 esquemas de campos están fijados.
- Tabla única `plantillas_documento`
- Payload validado por Zod **por tipo de documento**
- Sin firma del médico en el payload: se toma del perfil al generar cada instancia
- Aplica a los 8 formatos, no a algunos

### 9.3 · NOM-024 y firma electrónica avanzada
**Sin verificar.** Varias fuentes afirman que la NOM-024 exige firma electrónica avanzada, pero **todas son blogs de proveedores de software** que se copian entre sí. Ninguna cita numeral.

La NOM-004 sí es clara: acepta firma **autógrafa, electrónica o digital** — es disyuntiva. Con el trazo autógrafo digitalizado se cumple.

**Resolución:** bajar el texto de la NOM-024-SSA3-2012 del DOF y leer el capítulo de seguridad y la guía de intercambio (GIIS). Media hora de lectura.

Si resultara exigible, **no implica custodiar llaves**: la firma puede hacerse del lado del cliente con `CryptoKey` no extraíble, o mediante un PSC. El costo real no está en el bucket sino en el **ciclo de vida del certificado** — la e.firma caduca a los 4 años y puede revocarse, así que se necesita sellado de tiempo (TSA) y validación de revocación. Ese es el argumento fuerte para no construirlo solo.

### 9.4 · Pictogramas de vía — archivados
Se evaluaron, se vectorizaron 12 SVG, y **se descartaron**: en una receta real la mayoría de las entradas son orales y el icono repetido siete veces es ruido sin información. La vía se resuelve con el bloque en negativo.

Los SVG existen por si se quieren para otra cosa. La licencia de USP quedó descartada por sus restricciones (no modificar, no mezclar con símbolos propios, solo la versión más reciente).

---

## 10 · Método de trabajo — lo que funcionó y lo que no

**Escrito Médico se llevó seis rondas puliendo una decisión ya revertida.** Las correcciones llegaron encimadas y se perdió cuál mandaba.

Lo que destrabó: **dar un criterio de verificación visible en el prompt.** «Después de este cambio, la hoja X debe verse distinta en su encabezado. Si al terminar no hay diferencia visible ahí, no aplicaste el cambio.»

Úsalo al trabajar con Claude Code: cada prompt debe declarar qué tiene que verse distinto y dónde.
