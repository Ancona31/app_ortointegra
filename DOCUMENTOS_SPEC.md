# Spec del sistema de documentos PDF — Spinus

> **Fuente de verdad de implementación.** Consolida el diseño aprobado en
> `DOCUMENTOS_HANDOFF.md`. Donde este documento y el handoff difieran, manda
> este: las diferencias son correcciones acordadas, no reinterpretaciones, y
> cada una lleva su nota.
>
> `DOCUMENTOS_DECISIONES.md` es histórico. `DOCUMENTOS_AUDITORIA.md` describe
> el sistema viejo: sirve para saber qué campos existen y qué bugs no repetir,
> nunca como referencia de diseño.

**Estado de redacción**

| Sección | Estado |
|---|---|
| §0 · Cómo se lee | escrita |
| I.1 · Tokens | **cerrada.** Sin pendientes: los doce sitios tipográficos tienen valor |
| I.3 · Invariantes del sistema | escrita |
| Anexo A · Divergencias | **cerrado.** Las 44, resueltas |
| I.2 · Componentes | **cerrada.** Veintiún componentes |
| II · Por formato | **cerrada.** Los ocho |

---

## §0 · Cómo se lee

Esta sección no contiene ningún valor. Solo establece cómo se nombra y cómo se
verifica lo que sigue.

### Convención de nombres

Los tokens se nombran `grupo.token`, en minúsculas, en español, separados por
punto. El grupo corresponde a la subsección de I.1 donde vive la definición.
Ejemplos: `caja.ancho`, `filete.alarma`, `manuscrito.alto`.

Un token **derivado** se escribe con su fórmula, no con su resultado. El
resultado se anota entre paréntesis como valor de referencia, para poder
revisarlo, pero **lo que se implementa es la fórmula**. Si el resultado aparece
como literal en el código, el token no está implementado.

### Dónde vive cada cosa

| Pregunta, en este orden | Si la respuesta es sí |
|---|---|
| 1. ¿Es miembro de una escala declarada? | **CHASIS.** El formato declara cuál miembro usa |
| 2. ¿Es comportamiento o variante de un componente del chasis? | **CHASIS**, como variante nombrada. El formato declara cuál activa |
| 3. ¿Lo usan dos o más formatos **por la misma razón**? | **CHASIS** |
| 4. Ninguna de las anteriores | **FORMATO** |

Las preguntas 1 y 2 pesan más que el conteo de formatos: un valor que hoy usa
un solo formato pero pertenece a una escala del sistema es chasis, o el
formato #9 no hereda nada.

La pregunta 3 dice «por la misma razón», no «el mismo número». Dos valores
iguales por causas distintas se mantienen separados y se anota la coincidencia,
para que nadie los fusione después.

### Las tres comprobaciones de cierre

1. **Cada token tiene exactamente un sitio de definición.** La comprobación es
   sobre nombres, no sobre cifras.
2. **La sección II no contiene `pt`, `mm`, `%` ni `#`.** Los dígitos permitidos
   ahí solo cuentan contenido: 13 vías, 5 firmantes, 2 secciones. **Única
   excepción:** las notas `CONCILIA`, que citan el valor superado para dejar
   constancia de qué se descartó. Son notas históricas, no especificación.
3. **Todo nombre de variante citado en II existe declarado en I.2.**

Si un formato necesita escribir un número con unidad, el chasis no tiene el
token o la variante. El arreglo es agregarla al chasis, nunca escribir el
número en el formato.

### Marcas

- `CONCILIA Dnn` — resuelve una divergencia entre este spec y el diseño
  aprobado. El anexo A las lista todas con su criterio.
- `COINCIDENCIA` — dos tokens comparten valor por casualidad. No se fusionan.
- `CORRIGE HANDOFF` — diferencia deliberada respecto de `DOCUMENTOS_HANDOFF.md`.

Ya no quedan sitios `PENDIENTE`: la extracción del diseño cerró los doce
tipográficos que faltaban.

---

# SECCIÓN I — CHASIS

## I.1 · Tokens

Módulo único de constantes tipadas. Sin componentes, sin JSX. Ningún literal
numérico de layout puede existir fuera de aquí.

> **Procedencia.** Salvo donde se indique, todo valor de I.1 está extraído de
> `SPEC_DISENO.md` Parte A y de `SPEC_DISENO_PARTE_B.md`, que a su vez se
> leyeron de los archivos de diseño aprobados. Los valores marcados
> `CONCILIA Dnn` resuelven una divergencia registrada; el anexo A los lista
> todos con su criterio.

### I.1.1 · Papel y caja

| Token | Valor | Nota |
|---|---|---|
| `papel.ancho` | 612 pt | Carta, 216 mm |
| `papel.alto` | 792 pt | Carta, 279 mm |
| `caja.ancho` | 486 pt | Token único de texto corrido en todo el sistema |
| `caja.alto` | `papel.alto − margen.superior − margen.inferior` (670 pt) | **Derivado: se implementa como fórmula.** Un 670 literal en el código significa que el token no está implementado (§0) |
| `zona.segura` | 36 pt | Por los cuatro lados. **Ningún elemento con tinta la cruza** |

La zona segura cubre el área no imprimible de 4–5 mm de una impresora de
consultorio.

> El 453.75 pt que apareció en Plan de Suplementación queda eliminado. No
> existe un segundo ancho de caja.

### I.1.2 · Márgenes

| Token | Valor |
|---|---|
| `margen.superior` | 54 pt |
| `margen.izquierdo` | 72 pt |
| `margen.derecho` | 54 pt |
| `margen.inferior` | 68 pt |

El margen izquierdo es el mayor: la hoja se perfora y se engrapa por ese borde.

**Desglose del margen inferior**, que es la parte que hay que respetar al
implementar: 36 pt de papel intocable + 16 pt de banda de pie + 16 pt de aire.

> **La banda de pie es tinta, no sangre: vive dentro de la zona segura y fuera
> de la caja de texto.** El margen inferior no se mide hasta la banda. Una
> versión anterior de este spec decía que el pie ocupaba la última banda de la
> caja; era falso.

### I.1.3 · Retícula

| Token | Valor |
|---|---|
| `reticula.columnas` | 12 |
| `reticula.columna` | 32.25 pt |
| `reticula.medianil` | 9 pt |
| `reticula.riel` | 23.25 pt |
| `reticula.lineaBase` | 16 pt |
| `riel.celda` | 40.5 pt |

`12 × 32.25 + 11 × 9 = 486` = `caja.ancho`. El riel del número más un medianil
equivale a una columna: `23.25 + 9 = 32.25`.

**Zonas declaradas por el diseño**

| Zona | Columnas | Ancho |
|---|---|---|
| Texto | 1–8 | 321 pt |
| Riel de datos | 9–12 | 156 pt |

**La fila de cierre**

Es la última fila de la hoja, la que reparte el pie del contenido entre lo que se
firma y lo que se cuenta. La misma en los ocho formatos: la caja de firma vive en
su columna derecha, y en el Recibo esa columna es la que ocupa `RielImportes`.

| Token | Valor |
|---|---|
| `cierre.derecha` | 246 pt |
| `cierre.medianil` | 24 pt |
| `cierre.izquierda` | `caja.ancho − cierre.derecha − cierre.medianil` (216 pt) |

`cierre.izquierda` es **derivado: se implementa como fórmula** (§0). Un 216
literal en el código significa que el token no está implementado.

> **No sale de `reticula.columna` y no tiene por qué.** Esta fila no es una
> partición de doce: es un reparto de dos columnas con un medianil propio, medido
> en la hoja aprobada. Es la tercera partición de la misma caja de 486 pt, y
> convive con las otras dos por la misma razón que ellas conviven entre sí — cada
> una separa cosas distintas con separadores distintos (`CONCILIA D-retícula`).
>
> `COINCIDENCIA` — `cierre.derecha` mide lo mismo que `manuscrito.ancho`
> (246 pt). **Distinto valor por distinta causa** y no se fusionan: uno es el
> ancho de una columna de maquetación y el otro el de una línea destinada a
> llenarse con pluma, medida contra la presentación más larga del catálogo. Cuál
> derivó de cuál no lo dice el archivo de diseño. Si algún día cambia el ancho de
> la línea de escritura, la columna de cierre **no se mueve**.

> `CONCILIA D-retícula` — el diseño tiene **dos retículas conviviendo**: la de
> 32.25 + 9 para bloques de texto, y una de 12 partes iguales sin medianil para
> el riel de identificación. **No es un defecto y no se unifica.** Son dos
> particiones de la misma caja de 486 con separadores distintos: los bloques de
> texto se separan con aire (el medianil), y las celdas del riel se separan con
> una regla vertical más padding. Donde hay regla no hace falta medianil.
> Quedan como dos tokens con nombre propio: `reticula.columna` y `riel.celda`.
> `486 / 12 = 40.5`.

### I.1.4 · Tipografía

| Token | Valor |
|---|---|
| `fuente.neogrotesca` | Archivo — identidad, títulos, datos, tablas, etiquetas, cifras |
| `fuente.humanista` | IBM Plex Sans — texto corrido largo, subtítulos, notas de firma |

Pesos cargados: Archivo 400 / 500 / 600 · IBM Plex Sans 400 / 500.

**Prohibidas:** Roboto, Arial, Helvetica, cualquier fuente de sistema, cualquier
serif, y **IBM Plex Mono**, que solo existe en el marco de documentación de las
láminas de diseño.

> `CONCILIA D13, D20, D30` — la mono aparece impresa en tres documentos
> aprobados: la leyenda de vía de Receta, el eco de peso de Suplementación y la
> raya de ítem de Internamiento. En los tres se sustituye por la neo-grotesca.
> La leyenda de Receta además **no debe imprimirse en absoluto**: ver II.3.

#### Escala tipográfica

| Rol | Token | Familia | Cuerpo / interlineado | Peso | Tracking | Color |
|---|---|---|---|---|---|---|
| Nombre del médico | `medico.nombre` | Archivo | 26 / 28 pt | 600 | −0.012 em | `tinta.negra` |
| Especialidad | `medico.especialidad` | Archivo | 7.5 / 12 pt | 500 | 0.34 em | `tinta.secundaria` |
| Contacto y cédulas | `medico.credencial` | Archivo | 7.5 / 11 pt | 400 | 0.06 em | `tinta.secundaria` |
| Título de documento | `titulo.documento` | Archivo | 17 / 20 pt | 600 | 0.02 em | `tinta.negra` |
| Subtítulo de documento o de sección | `titulo.subtitulo` | IBM Plex Sans | 10.5 / 15 pt | 400 | 0 | `tinta.secundaria` |
| Encabezado de sección | `titulo.seccion` | Archivo | 10 / 14 pt | 600 | 0.14 em | `tinta.negra` |
| Número de sección | `seccion.numero` | Archivo | 15 / 15 pt | 600 | 0 | `acento.tinta` |
| Etiqueta en versalita | `etiqueta` | Archivo | 7 / 11 pt | 600 | 0.22 em | `tinta.etiqueta` |
| Valor de campo | `dato` | Archivo | 12 / 16 pt | 400 | 0 | `tinta.negra` |
| Texto corrido | `texto.corrido` | IBM Plex Sans | 11.5 / 18 pt | 400 | 0 | `tinta.negra` |
| Celda de tabla | `tabla.celda` | Archivo | 9.5 / 14 pt | 400 | 0 | `tinta.negra` |
| Ancla de entrada | `entrada.ancla` | Archivo | 11 / 15 pt | 600 | 0 | `tinta.negra` |
| Línea secundaria de entrada | `entrada.secundario` | Archivo | 9.5 / 14 pt | 400 | 0 | `tinta.negra` |
| Número de entrada | `entrada.numero` | Archivo | 13 / 17 pt | 600 | 0 | `acento.tinta` |
| Nombre bajo la firma | `firma.nombre` | Archivo | 11.5 / 16 pt | 600 | −0.012 em | `tinta.negra` |
| Rol sobre la línea de firma | `firma.rol` | Archivo | 7 / 11 pt | 600 | 0.22 em | `tinta.etiqueta` |
| Credencial bajo la firma | `firma.credencial` | Archivo | 7.5 / 11 pt | 400 | 0.06 em | `tinta.secundaria` |
| Pie de página | `pie` | Archivo | 7 / 11 pt | 400 | 0.10 em | `tinta.papel` |
| Leyenda del pie | `pie.leyenda` | Archivo | 6 / 11 pt | 400 | 0.05 em | `tinta.papel` |
| Folio | `folio` | Archivo | 11 / 14 pt | 500 | 0.03 em | `acento.tinta` |
| Cuerpo de alarma | `alarma.cuerpo` | IBM Plex Sans | 12 / 18 pt | 500 | 0 | `tinta.negra` |
| Fecha del encabezado | `fecha.encabezado` | Archivo | 9 / 11 pt | 400 | 0 | `tinta.etiqueta` |
| Marca de estado | `marca.estado` | Archivo | 22 pt | 600 | 0.05 em | contorno |

Todos los roles con cifras llevan cifras tabulares: `dato`, `tabla.celda`,
`entrada.numero`, `folio`, `medico.credencial`, `firma.credencial`, `pie`.

**Los seis roles conciliados**, con el criterio de cada uno:

| Token | Valores que había | Elegido | Criterio |
|---|---|---|---|
| `medico.nombre` | 26/26 · 24/26 · 26/28 · 22 | **26 / 28** | Variante de monograma del espécimen. Los 22 pt de los formatos son de otra generación (D7) |
| `entrada.numero` | 15 · 13/17 · 13/16 · 14/17 · 10/15 · 9/14 · 9/11.5 | **13 / 17** | El único que aparece en dos formatos distintos por la misma razón. El 15 es número de sección, no de entrada (D11) |
| `firma.nombre` | 11.5/16 · 11.5/15 · 11/15 · 10/14 | **11.5 / 16** | El de la hoja espécimen, que es el chasis (D29) |
| `etiqueta` | 7/11 y 7/12 en folio | **7 / 11** | Siete de ocho coinciden. El 12 del folio es un desliz (D-folio) |
| `texto.corrido` | 11.5/18 · 10.5/17 · 10.5/16 · 9.5/14 | **11.5 / 18** | Decisión explícita ya tomada. Tres formatos ya cumplen (D8, D19, D28, D33) |
| `marca.estado` | 22 pt / −9° y NO DEFINIDO / −28° | **22 pt** | El espécimen no lo fija en pt; Receta sí (D18, C) |

**Versalitas.** No son versalitas reales de la fuente: son **mayúsculas con
tracking**. Archivo no se carga con `font-variant-caps` y ningún punto del
sistema lo usa. En el motor de PDF se transforma la cadena a mayúsculas y se
aplica el tracking de la tabla. **Sustituirlas por versalitas reales invalidaría
todos los valores de tracking de este documento** y cambiaría la altura de las
etiquetas. **Esta declaración manda sobre la composición**; I.3.1 no la
contradice: cruza esta escala contra la lista del gate, dice cuáles de sus
elementos llevan tracking y ordena la escalera de remedios por si la extracción
falla.

**Medida.** 486 pt a 11.5 pt son ≈ 85 caracteres. El handoff decía ≈ 93; el
diseño mide 85. Se registra el valor medido.

#### Desviaciones declaradas de un rol

Un componente puede necesitar un rol de la escala **con un cambio enumerado**.
Eso no es un rol nuevo y no se le pone nombre de token: se cita el rol y se
declara qué cambia y por qué, en la ficha del componente. El patrón lo fijó la
zona 2 de 2.M, que pide `pie` y declara los dos valores que altera.

**Una desviación no asciende a rol** hasta que un segundo componente necesite
exactamente la misma, **color incluido**. Mientras la use uno solo, un nombre
propio en I.1.4 sería un rol sin plural; y si dos la usan con distinta tinta, lo
que comparten no es un rol, porque un rol lleva su color dentro.

| Desviación | Base | Qué cambia | Quién la usa |
|---|---|---|---|
| `dato` en peso 500 | `dato` | peso 500 | 2.D, celda de paciente |
| `etiqueta` sobre negativo | `etiqueta` | color → `tinta.papel` | 2.H |
| **`pie` en versalita** | `pie` | peso 600 · tracking `0.22 em` | 2.K · 2.M zona 2 · 2.N |
| **`seccion.numero` a 26 pt** | `seccion.numero` | cuerpo 26 pt | 2.Q |

**`pie` en versalita** es la única con más de un consumidor, y aun así **no sube
a rol**: los tres la usan con **color distinto**, que lo fija el sitio —
`tinta.papel` sobre la banda de acento (2.M), `tinta.secundaria` en el área de
contenido (2.K y 2.N)—. Un rol lleva su color dentro; esto no puede. Los dos
valores que sí comparte son los de la versalita del sistema: peso 600 y tracking
`0.22 em` son los de `etiqueta` y `firma.rol`.

**`seccion.numero` a 26 pt** cambia solo el cuerpo. Familia, peso, tracking y
`acento.tinta` los sigue poniendo el rol, y el interlineado sale de la razón 1
que el rol declara (15 / 15), así que a 26 pt es 26.

#### Las once piezas que no tenían rol, y cómo se cerraron

Salieron del barrido de las veinte fichas de I.2 (anexo A, P2-11) y se cerraron
**derivando del propio spec**, no eligiendo (anexo A, P2-14). Ninguna necesitó un
rol nuevo: los valores ya estaban en el diseño y lo que faltaba era el nombre.
Cada fila dice qué la sostiene — una jerarquía ya declarada, un rol vecino que
hace el mismo trabajo, o una regla del sistema.

**Diez por derivación; H9, por medición** (anexo A, P2-23). Está abajo, con el
aire entre entradas que apareció al cerrar H4: los dos únicos que no se podían
resolver leyendo, solo mirando la lámina.

| # | Pieza | Ficha | Cerrada como | De qué se deriva |
|---|---|---|---|---|
| H1 | Filete de `instrucciones` | 2.I | **`filete.acento`** (2 pt) | La jerarquía de 2.I es alarma > instrucciones > cita y su regla 1 dice que **la carga el grosor**. Entre `filete.alarma` (3) y `filete.cita` (1.6) la escala tiene un solo miembro |
| H2 | Encabezado de bloque del parser | 2.J | **`etiqueta`** | Es la versalita con la que el sistema nombra lo que va debajo. Su gemelo `firma.rol` —mismos valores, otro nombre— ya hace ese trabajo fuera de un campo. No puede ser `titulo.seccion`: el bloque vive **dentro** de una sección ya abierta por 2.P y compartir rol aplanaría un nivel |
| H3 | Sangría del ítem colgante | 2.J | **`reticula.riel` + `reticula.medianil`** | Un ítem con raya colgada es la anatomía de 2.G y 2.P: riel del número + medianil + caja de texto. I.1.3 declara que esa suma **es** `reticula.columna` |
| H4 | Ancla → secundario, secundario → nota | 2.G | **`espacio.4`** y **`espacio.8`** | Mismo criterio que el subtítulo de 2.C. El secundario es la segunda línea del mismo dato y va al mínimo de la escala; la nota cambia de familia y de registro, así que sube un miembro. Dos niveles, los dos menores de la escala |
| H5 | `pie` en versalita | 2.K · 2.M | **Desviación declarada**, tabla de arriba | El patrón de 2.M, aplicado a 2.K. Los dos valores que comparte son los de la versalita del sistema |
| H6 | Número de apertura, 26 pt | 2.Q | **`seccion.numero` a 26 pt**, desviación declarada | Es el número de una sección, igual que el de 2.P. Suena más fuerte porque el propósito declarado de 2.Q es ser más fuerte que 2.P, y la ficha ya fija el cuerpo |
| H7 | Rótulo de sección · subtítulo de lector | 2.Q | **`titulo.seccion`** · **`titulo.subtitulo`** | 2.Q es 2.P un nivel arriba y 2.P compone su título con `titulo.seccion`. El subtítulo es la única línea secundaria del sistema —humanista, `tinta.secundaria`, bajo un título— y su alcance se amplía a sección en la tabla de arriba |
| H8 | Total del recibo, Archivo 22 / 600 | 2.T | **Geometría del componente**, declarada entera | Criterio de los anillos de 2.A: un valor que usa un solo componente en un solo sitio no es un rol. La regla 2 de 2.T lo dice ella misma — no hay segundo uso |
| H9 | Ancho de la caja de importes | 2.T | **`cierre.derecha`** (246 pt), token nuevo de I.1.3 | No se deriva: se **mide**. Es la columna derecha de la fila de cierre, la de la caja de firma, no `manuscrito.ancho`. Ver abajo |
| H10 | Los tres avisos de pie | 2.N | **`pie` en versalita**, en `tinta.secundaria` | Misma posición que el contador de 2.K —al pie del área de contenido, no en la banda—, mismo registro y misma forma de cadena. Pueden salir en la misma hoja: si no comparten tratamiento, compiten |
| H11 | Contorno «negro al 45 %» | 2.S | **Geometría derivada de 2.S**: `tinta.negra` al 45 % sobre blanco, por mezcla opaca | La misma derivación que `acento.velo`, que es `acento.base` al 6 % sobre blanco. Mezcla y no alfa, por el mismo motivo de I.1.8: un alfa depende del visor y del driver de impresión |

**H9 QUEDA CERRADO, y no era lo que parecía.** Los 246 pt de la caja de importes
de 2.T no salieron de `manuscrito.ancho`: son el ancho de la **columna derecha de
la fila de cierre**, la misma donde vive la caja de firma en los ocho formatos.
Medido en el archivo aprobado: 486 − 246 − 24 de medianil = 216 pt para la
columna izquierda. El token es `cierre.derecha` y vive en I.1.3, con
`cierre.medianil` y `cierre.izquierda`; la coincidencia con `manuscrito.ancho`
queda registrada como `COINCIDENCIA` en los dos sitios. Lo que hacía irresoluble
este hueco era buscar el 246 en la retícula de doce, que es la partición
equivocada: la fila de cierre es de dos columnas.

**Y el que apareció al cerrar H4 —el aire entre entradas de 2.G— también queda
cerrado**, y tampoco por derivación: **medido**. Son 12.5 pt, y no son un miembro
de la escala sino tres cifras con reparto propio —7 pt de padding inferior,
`filete.regla`, 5 pt de padding superior—, con la regla deliberadamente
descentrada. Es geometría interna del componente y está declarada entera en la
ficha de 2.G.

**Las once piezas quedan cerradas.** Nueve por derivación del propio spec, dos
—las dos que exigían mirar una lámina— por medición. Ninguna necesitó un token
tipográfico nuevo; la única que estrenó nombre estrenó **tres**, y son de
retícula, no de escala.

#### Tres tratamientos que son geometría de componente POR DECISIÓN

El monograma de 2.A (Archivo 19 / 600), la celda de diagnóstico de 2.D (IBM Plex
Sans 11 / 16) y la leyenda de 2.R (IBM Plex Sans 9 / 13) **no están en esta
escala y no es un olvido.** Los tres están declarados enteros en su ficha
—familia, cuerpo, interlineado, peso, tracking y color— y los tres los usa un
solo componente en un solo sitio.

Es la misma línea que I.1.7 traza para el espaciado: la escala gobierna lo que se
comparte, y la geometría interna de un componente se declara en su ficha aunque
no sea miembro de nada. **No los «corrijas» metiéndolos en I.1.4.** Un rol existe
para tener plural; subir aquí un valor con un único consumidor no ordena el
sistema, solo mueve el sitio donde hay que ir a leerlo.

Se revisa si aparece un cuarto: tres excepciones son tres decisiones, cuatro
empiezan a ser una escala incompleta.

### I.1.5 · Escritura manuscrita

| Token | Valor | Medido contra |
|---|---|---|
| `manuscrito.alto` | 20 pt (7.06 mm) | Pautado de cuaderno profesional, 7.1 mm |
| `manuscrito.ancho` | 246 pt | Presentación más larga del catálogo × 1.8 |
| `manuscrito.grosor` | 0.8 pt | Es `filete.fino` |

> `CONCILIA D12, D27` — había tres valores de alto: 20 pt (chasis), 16 pt
> (espécimen y Recibo) y 11 pt (lámina de Receta). **Gana el 20 pt**, que es el
> único medido contra una referencia física en vez de contra el hueco
> disponible. Los otros dos son anteriores a la ronda de recalibración.

Aplica a: líneas de campo vacío requerido, bloques rayados, líneas de firma
manuscrita y cualquier espacio destinado a llenarse con pluma.

> `COINCIDENCIA` — `manuscrito.ancho` mide lo mismo que `cierre.derecha` de
> I.1.3, y **no son el mismo valor**: este se midió contra la presentación más
> larga del catálogo, aquel es el ancho de la columna derecha de la fila de
> cierre. Es el mismo cuidado que ya se tuvo con los dos 20 pt del alto: un token
> de escritura a mano no presta su medida a la maquetación. **Ver 246 pt en dos
> sitios no significa que sobre uno.**

### I.1.6 · Filetes

| Token | Grosor | Uso |
|---|---|---|
| `filete.transicion` | 4 pt | Apertura de sección (Internamiento) |
| `filete.alarma` | 3 pt | Bloque de alarma (Receta) |
| `filete.acento` | 2 pt | Cabecera de tabla · marco parcial de dos lados · marco del QR |
| `filete.cita` | 1.6 pt | Bloque de cita · filete corto sobre el folio |
| `filete.fino` | 0.8 pt | Escritura, firma, cierre de membrete, apertura y cierre de riel |
| `filete.regla` | 0.5 pt | Regla entre entradas, entre celdas de riel, contorno de marca de estado |

> `CONCILIA D-filetes` — el diseño usa nueve grosores. Tres de ellos **no son
> miembros de la escala del sistema sino geometría interna de un componente** y
> se declaran en su ficha, no aquí: el 2.5 pt del segmento grueso del filete
> principal (2.O), y el 1.5 pt y el 0.5 pt de los anillos del panel circular
> (2.A). El contorno de la marca de estado se unifica a `filete.regla` (había
> 0.7 y 0.5).
>
> Se elimina también la columna «reservado a» de la versión anterior de este
> spec: **era falsa**. El 2 pt no es de Internamiento —lo usan la tabla y el
> QR— y el 1.6 pt no es de Suplementación, lo usa también el folio. Un grosor
> es un grosor; quién lo usa se declara en la Sección II.

### I.1.7 · Espaciado

`espacio.base` = 4 pt. La escala es: `espacio.4` · `espacio.8` · `espacio.12` ·
`espacio.16` · `espacio.24` · `espacio.32` · `espacio.48` · `espacio.64`.

> **Alcance de la escala, corregido.** La escala gobierna la **separación
> vertical entre bloques de primer nivel**. La geometría interna de un
> componente —el aire entre el panel y el nombre, el padding de una celda de
> riel, el medianil de la zona de QR— se declara en la ficha del componente con
> el valor extraído del diseño, aunque no sea múltiplo de 4.
>
> La versión anterior de este spec exigía que **todo** espacio fuera miembro de
> la escala. Al conciliar contra el diseño resultó insostenible: el espécimen
> aprobado usa 14, 18, 10, 7, 6, 5 y 3 pt dentro de sus componentes. Forzarlos
> a la escala sería rediseñar hojas aprobadas para satisfacer una regla que el
> propio diseño nunca siguió.

**Transiciones entre bloques declaradas por el diseño**

Nueve separaciones con dos extremos identificables cada una. Son tokens con
nombre propio, no miembros de la escala.

| Token | Valor | Separa |
|---|---|---|
| `transicion.membreteFilete` | 14 pt | Fila superior del membrete → filete de cierre |
| `transicion.membreteLineaFina` | 6 pt | Filete de cierre del membrete → línea fina |
| `transicion.tituloFilete` | 10 pt | Bloque de título → su filete |
| `transicion.tituloRiel` | 20 pt | Filete del título → riel de identificación |
| `transicion.seccionParrafo` | 8 pt | Encabezado de sección → su párrafo |
| `transicion.entreSecciones` | 24 pt | Cierre de una sección numerada → apertura de la siguiente |
| `transicion.tablaFilete` | 6 pt | Cabecera de tabla → filete de acento |
| `transicion.tablaTotal` | 6 pt | Cierre de tabla → fila de total |
| `transicion.contenidoPie` | 16 pt | Último bloque de contenido → banda de pie |

> **No se fusionan con la escala de espaciado, aunque varios coincidan en
> valor.** `transicion.seccionParrafo` vale lo mismo que `espacio.8`,
> `transicion.contenidoPie` que `espacio.16` y `transicion.entreSecciones` que
> `espacio.24`; los tres son `COINCIDENCIA`, no identidad. El criterio de uso es
> el que decide: la escala se usa donde la separación es genérica y el valor
> podría ser cualquier miembro; estos tokens donde la separación tiene **dos
> extremos identificables** y tiene que poder cambiar sola sin arrastrar a todo
> lo demás que hoy mide igual. Mover `espacio.16` para ajustar el aire sobre la
> banda de pie sería mover también toda sangría de bloque destacado del sistema.
>
> Los otros tres —14, 6 y 10 pt— no son miembros de la escala y nunca lo fueron:
> esa es la razón por la que esta tabla existe.
>
> No confundir el grupo `transicion.*` con `filete.transicion` (I.1.6), que es
> un grosor de línea.
>
> **`espacio.20` no existe.** Se instanciaba en 2.C y en II.8 §5 para el
> arranque del cuerpo del Escrito Médico bajo el filete del membrete cuando el
> título colapsa, y nunca fue miembro de la escala de ocho. Ese uso pasa a
> `transicion.tituloRiel`, que vale lo mismo por la misma razón: lo que va bajo
> el filete cuando el título está ausente ocupa el sitio del riel de
> identificación.

### I.1.8 · Color

| Token | Valor | Uso |
|---|---|---|
| `tinta.negra` | `#101010` | Texto principal, filetes negros, fondo del bloque en negativo |
| `tinta.secundaria` | `#454545` | Subtítulos, cédulas, indicaciones de tabla |
| `tinta.etiqueta` | `#737373` | Etiquetas en versalita, notas de firma |
| `tinta.hairline` | `#D9D6D0` | Reglas verticales del riel, cierre de fila |
| `tinta.reglaFila` | `#EDEAE4` | Separación entre filas de tabla larga |
| `tinta.reglaSuave` | `#C9C5BD` | Filete fino secundario, anillo interior del panel |
| `tinta.papel` | `#FFFFFF` | Texto sobre banda de pie y sobre bloque en negativo |
| `acento.base` | `#1C3A5E` por defecto | Configurable por médico |

**Ningún texto usa `tinta.hairline`, `tinta.reglaFila` ni `tinta.reglaSuave`.**
Son grosores de regla, no colores de texto.

#### Derivación del acento

El acento del médico es configurable y los dos tonos derivados **no son un
porcentaje fijo**: se calculan mezclando el acento contra `tinta.negra` hasta
alcanzar un contraste mínimo sobre blanco.

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

| Token derivado | Objetivo de contraste | tMax | Uso |
|---|---|---|---|
| `acento.tinta` | **4.5 : 1** | 0.82 | Números de sección y de entrada, cifras de tabla, folio, monograma |
| `acento.banda` | **7 : 1** | 0.65 | Relleno de la banda de pie, con texto `tinta.papel` encima |
| `acento.velo` | — | — | `acento.base` al **6 %** sobre blanco. Disco del panel y fondos tenues |

**Regla dura: el acento nunca es color de texto en su forma pura.** Solo aparece
como filete, cuadro sólido, fondo tenue, o como `acento.tinta` derivado. Esto
es lo que permite aceptar cualquier acento sin romper la legibilidad: con un
mostaza `#D6A429` el algoritmo lo oscurece hasta cumplir.

> `CONCILIA D25` — el velo tenía dos valores, 6 % en el panel y 8 % en la celda
> de vigencia del Recibo. **Gana el 6 %**, que es el del chasis. El máximo
> admitido para cualquier fondo tenue es 12 %.

### I.1.9 · Firmas y umbral de flujo

#### Espacio de escritura

| Token | Valor |
|---|---|
| `firma.espacio` | **77 pt**, único para toda firma manuscrita del sistema |

> `CONCILIA D37, D35, A.17 #4` — **se retira el tramo de 28 pt.** Se había
> declarado como piso del sistema para el Consentimiento, pero el Consentimiento
> aprobado usa 77 pt repartiendo las firmas en dos hojas, y **ningún archivo del
> sistema instancia el 28**. Un miembro de escala sin consumidores es deuda, no
> escala. Con el anestesiólogo fuera quedan cinco firmantes y el reparto en dos
> hojas ya existe, así que el token único no cuesta ninguna hoja adicional.
>
> Consecuencia: el médico **sí** imprime su rúbrica renderizada en el
> Consentimiento, como ya hace el archivo aprobado. La instrucción contraria
> queda revocada.

#### Composición del bloque de firma

```
firma.bloque.alto(renglones) =
      firma.rol
    + firma.espacio
    + filete.fino
    + espacio.4
    + Σ(renglones de identificación)
```

El **rol va encima de la línea**, en versalita; el nombre y las credenciales van
debajo.

| Rol | Renglones de identificación | Alto |
|---|---|---|
| Médico tratante | Nombre + céd. profesional + céd. de especialidad | **130.8 pt** |
| Anestesiólogo | Nombre + céd. profesional | 119.8 pt |
| Paciente · familiar · representante · testigo | Nombre + rol o parentesco | 119.8 pt |

Sumando del médico tratante, cada término por su token y su valor:

```
firma.rol         11        (interlineado del rol en versalita, sobre la línea)
firma.espacio     77        (espacio de escritura)
filete.fino        0.8      (la línea)
espacio.4          4        (margen superior del nombre)
firma.nombre      16        (interlineado)
firma.credencial  11        (céd. profesional)
firma.credencial  11        (céd. de especialidad)
                 ─────
                 130.8 pt
```

Los otros dos roles son la misma suma con un renglón de `firma.credencial`
menos: **119.8 pt**.

> **CORRIGE 131.8** — este bloque medía 131.8 pt en la versión anterior de este
> spec, y era un doble conteo: la suma ya incluía `filete.fino`, y la línea
> siguiente volvía a sumarlo al declarar «131.8 pt incluyendo el filete». **No
> falta ninguna ranura en la composición: sobraba la aritmética.** La suma de
> arriba tiene los mismos siete términos que tenía.
>
> Se detectó al transcribir I.1 a la capa de tokens: implementada la fórmula, los
> **tres** roles salían 1 pt por debajo de su valor declarado, con desfase
> constante. Un renglón faltante habría desviado un rol, no los tres por igual.
>
> Es el tercer valor de este bloque en tres generaciones —120 pt en el handoff,
> 119.8 pt en la versión anterior, 130.8 pt ahora— y las tres veces **la fórmula
> aguantó**: lo que cambió fue qué ranuras la componen y cuánto mide cada una,
> nunca su estructura. Ese es exactamente el motivo de escribirla como fórmula y
> no como constante. El 120 y el 119.8 de médico tratante quedan muertos.
>
> `COINCIDENCIA` — el 119.8 pt de anestesiólogo y firmante coincide en cifra con
> el 119.8 pt muerto del médico tratante. Son valores distintos por causas
> distintas: aquel era el médico sin el renglón del rol, este es un firmante con
> un renglón de credencial menos. No se fusionan y ver un 119.8 en el código no
> significa que el valor muerto haya vuelto.

#### Umbral de la regla 1

```
umbral.firma = firma.bloque.alto(médico)
             + espacio.16
             + 3 × texto.corrido.interlineado
             = 130.8 + 16 + 54
             = 200.8 pt
```

El 3 de la fórmula es `flujo.arrastre`: son las tres líneas que la regla 1 de
2.N baja con la firma, no un tercer valor independiente.

> `CONCILIA D43` — convivían dos umbrales: 185 pt en el diseño y 189.8 pt en la
> versión anterior de este spec. **Los dos son de generaciones muertas.** Los
> 185 se calcularon con renglón de 17 pt, que pertenece a la generación de
> 10.5 / 16 que el propio diseño declara superada en su A.17: el diseño corrigió
> el texto corrido y no propagó la corrección a sus constantes de flujo. Los
> 189.8 usaban una composición de firma sin el renglón del rol.
>
> **El renglón es 18 pt y no hay debate.** El umbral no se implementa como
> constante sino como la fórmula, que es lo que hizo posible recalcularlo tres
> veces sin discutirlo: 185, 189.8, 201.8 y ahora 200.8, y en ninguna de las
> tres el debate fue sobre el umbral.
>
> `COINCIDENCIA` — evaluado para anestesiólogo o firmante, cuyo bloque mide
> 119.8 pt, el umbral da 189.8 pt, cifra idéntica al umbral muerto de la versión
> anterior. Distinto valor por distinta causa: aquel era el médico con una
> composición incompleta, este es otro rol con un renglón menos. 2.N lo invoca
> como `umbral.firma(variante)` precisamente porque depende del rol.

#### Umbrales de párrafo

| Token | Valor |
|---|---|
| `flujo.orphans` | 2 |
| `flujo.widows` | 2 |
| `flujo.arrastre` | 3 líneas |

---

## I.2 · Componentes

Orden de dependencia: cada componente solo cita tokens de I.1 y componentes
anteriores. Ficha idéntica en los veintiuno.

> **Son veintiuno, no catorce.** La conciliación contra el diseño encontró seis
> componentes reales que el plan de código no listaba: `FileteGruesoFino`,
> `ZonaQR`, `MarcaEstado`, `EncabezadoSeccion`, `AperturaSeccion` y
> `RielImportes`. Sin ellos, cada formato los recompone por su cuenta, que es
> exactamente el origen de buena parte de las 44 divergencias del anexo A.
>
> **El veintiuno llegó midiendo, no conciliando.** `MarcoParcial` (2.U) sale de la
> medición del Recibo: el marco en acento no era una variante de `BloqueDestacado`
> sino un dispositivo gráfico que envuelve contenidos de anatomía distinta, y ya
> estaba declarado dos veces —en 2.R y, por su nombre, en II.5— sin dueño (anexo
> A, P2-24).
>
> Se evaluó y se descartó meter `EncabezadoSeccion` dentro de `EntradaNumerada`:
> un encabezado de sección no es un ítem de lista, no participa del contador, y
> su número es de sección y no de entrada. Sería un uso forzado que arrastraría
> el contador detrás.

---

### 2.A · `PanelCircular`

**Propósito.** La marca del documento. Doble anillo con disco al velo del
acento, y dentro el logo del médico o su monograma.

**Variantes declaradas**

| Variante | Cuándo |
|---|---|
| `logo` | El médico tiene logo normalizado en el perfil |
| `monograma` | No hay logo, o el logo subido no pasó la normalización del ingest. Iniciales en `fuente.neogrotesca` |
| `oculto` | El médico eligió membrete tipográfico sin marca. Es una alternativa legítima, no un estado degradado |

**Geometría** — idéntica en los ocho formatos y para todos los médicos.

| Elemento | Medida |
|---|---|
| Diámetro exterior | 56 pt |
| Anillo exterior | 1.5 pt, `acento.base` |
| Relleno del disco | `acento.velo` |
| Diámetro del círculo interior | 47 pt |
| Anillo interior | 0.5 pt, `tinta.reglaSuave` |
| Caja del logo | El círculo interior completo. **No hay caja aparte** |
| Monograma | Archivo 19 pt, peso 600, interlineado 1, `acento.tinta` |

Holgura entre anillos: 4.5 pt por lado. Los grosores de 1.5 y 0.5 pt son
geometría de este componente, **no miembros de `filete.*`** (I.1.6).

**Reglas**

1. **El logo llena el círculo interior y se recorta a él**, centrado y
   conservando su proporción. Se escala por su lado menor hasta cubrir los 47 pt
   y lo que sobra del lado mayor queda fuera del círculo. Nunca se deforma: el
   recorte es la alternativa a estirar. El médico sube el logo que tenga —
   cuadrado, apaisado o vertical— y el panel se adapta; no al revés.

   > **CORRIGE 2.A** — la versión anterior de esta ficha declaraba una «caja útil
   > del logo» de 33 × 19 pt con la regla «se escala para caber sin recortar,
   > nunca se recorta al círculo». **Las dos cosas quedan retiradas.** Esa caja
   > deja el logo en un cuarto de la superficie del panel: una miniatura en el
   > centro de un círculo vacío.
   >
   > La corrección sale de comparar contra v1 al implementar el componente: el
   > spec describía un comportamiento **que la app nunca tuvo** y que empeora el
   > resultado. v1 recorta al círculo con `overflow: hidden` sobre el envoltorio
   > redondo desde la primera versión.
   >
   > Nota de fidelidad: v1 no cubre el círculo entero — mete la imagen en una
   > caja de 80 × 40 pt y la recorta después, así que un logo cuadrado le queda
   > al 68 % del diámetro sin recortarse y solo lo más apaisado que ~1.5:1 pierde
   > bordes. Esta ficha declara el comportamiento **completo** —cubrir y
   > recortar, cualquier proporción—, que es el que v1 aproximaba con una caja
   > intermedia y el que hace que el logo se vea del tamaño del panel.
2. El ráster llega **normalizado desde el ingest del perfil**. El render no
   normaliza, no redimensiona y no convierte formatos: si el asset no sirve,
   la variante es `monograma`.
3. **El panel aparece solo en la primera hoja.** En las hojas de continuación
   lo que importa es folio, paginación y paciente, que viven en el pie y en el
   riel. Repetirlo cuesta peso —la auditoría documenta el logo instanciado dos
   veces por página desde el mismo PNG de 195 KB— sin agregar identificación.
4. El panel no se escala por hoja ni por cantidad de contenido.

**Verificación visible.** Cambiar el color de acento en el perfil y reemitir
cualquier documento: el anillo y el disco de la hoja 1 cambian de tono, y
**ningún texto del documento cambia de color**. Si cambia texto, el acento se
está usando fuera de sus cuatro roles.

---

### 2.B · `Membrete`

**Propósito.** Identidad del médico y del consultorio donde se emite.

**Contenido.** Nombre · especialidad · cédulas (una línea por cédula) ·
**universidad emisora** · riel del consultorio activo (domicilio y teléfono).

**Rol tipográfico de cada pieza**

| Pieza | Rol |
|---|---|
| Nombre | `medico.nombre` |
| Especialidad | `medico.especialidad` |
| Cada línea de cédula | `medico.credencial` |
| Domicilio y teléfono del consultorio | `medico.credencial` |
| **Universidad emisora** | `medico.credencial` |

La universidad va en `medico.credencial` porque es una credencial más, no un dato
de contacto ni una etiqueta: comparte renglón, cuerpo y color con las cédulas.
La ficha no le asignaba rol y hubo que decidirlo al implementar.

La redacción de cada línea de cédula **no se declara aquí**: el componente recibe
las líneas ya compuestas. «Una línea por cédula» es la regla; cómo se rotula cada
una lo decide quien llama.

**Variantes declaradas**

| Variante | Cuándo |
|---|---|
| `completo` | Hoja 1 de todos los formatos |
| `continuacion` | Hojas 2+. Nombre y cédula principal. Sin panel, sin riel de consultorio |

**Tokens que consume.** `medico.nombre` · `medico.especialidad` ·
`medico.credencial` · `caja.ancho` · `filete.regla` (regla vertical de cédulas) ·
`tinta.hairline` (su color) · `transicion.membreteFilete` ·
`transicion.membreteLineaFina` · `acento.base`, vía `FileteGruesoFino`.

> **CORRIGE 2.B** — la lista anterior citaba `etiqueta.cuerpo`,
> `etiqueta.tracking` y `dato.cuerpo`, y ninguno de los tres se usa aquí: **el
> membrete no tiene etiquetas ni campos.** Tiene nombre, especialidad y
> credenciales, que I.1.4 declara como roles `medico.*` con ese nombre exacto
> —«Nombre del médico», «Especialidad», «Contacto y cédulas»—. Tampoco citaba
> `filete.fino`, que sí se usa, pero dentro de `FileteGruesoFino`, no aquí.
>
> Esa lista es de la primera versión de la ficha, **anterior a que existiera la
> escala tipográfica de I.1.4**, y sobrevivió a la conciliación porque nadie la
> cruzó contra la escala. Se detectó al implementar 2.B: los roles que el
> componente necesitaba no estaban en su propia lista, y los que estaban no
> tenían contenido que los usara.

**Reglas**

1. **Es el único componente que imprime los datos del consultorio activo**, y los
   recibe **por prop**: la lectura del contexto ocurre en el sitio que construye
   el documento, una sola vez (I.3.6). Un `useContext` dentro de este componente
   imprimiría el consultorio equivocado en silencio — ver la nota de I.3.6 antes
   de tocarlo.
2. **Nada aquí colapsa por ausencia.** Universidad, cédulas y domicilio son
   exigibles: si faltan, la emisión está bloqueada aguas arriba (I.3.7). El
   membrete nunca dibuja un membrete incompleto en silencio, que es
   exactamente el defecto nivel 1 del sistema viejo.
3. La especialidad **nunca se abrevia** para que quepa. Si no cabe, rompe a dos
   líneas.
4. El membrete cierra con `FileteGruesoFino` (2.O) a todo `caja.ancho`. Ese
   filete es estructural: `TituloDocumento` en su variante `ausente` se apoya
   en él.

**Geometría interna**

| Transición | Medida |
|---|---|
| Medianil panel → bloque de nombre | 18 pt |
| Nombre → especialidad | 7 pt |
| Fila superior → filete | 14 pt |
| Filete → línea fina | 6 pt |
| Medianil de la línea fina (contacto ↔ cédulas) | 24 pt |
| Sangría de la regla vertical de cédulas | 12 pt |

La línea fina bajo el filete tiene dos columnas: a la izquierda domicilio y
teléfono más universidad, a la derecha las cédulas alineadas a la derecha, con
regla vertical de `filete.regla` en `tinta.hairline` a su izquierda.

> **La línea fina NO es un `RielDatos`**, aunque el contenido de arriba la llame
> «riel del consultorio» y la tabla de variantes de 2.F la reclamara como
> consumidora de `una línea`. No tiene rótulos, sus anchos no salen de
> `riel.celda` —la columna de contacto es flexible y la de cédulas se dimensiona
> por su contenido—, su texto va en `medico.credencial` y una de sus dos columnas
> apila tres renglones, que no es «un dato corto con su etiqueta». Su geometría es
> la de la tabla de arriba y se compone aquí. Lo único que comparte con 2.F es la
> regla vertical, que es un token y no un componente.

> `CONCILIA D23` — Laboratorio y Recibo emiten hoy **sin línea de cédulas**.
> No es una variante: es el defecto nivel 1 de I.3.7. Los ocho formatos llevan
> membrete completo.

**Verificación visible.** Cambiar de consultorio activo en la app y reemitir el
mismo documento: **domicilio y teléfono del membrete cambian**, y el resto del
documento es carácter por carácter idéntico. Si cambia algo más, hay un segundo
consumidor del contexto y eso es un defecto.

---

### 2.C · `TituloDocumento`

**Propósito.** Nombrar el documento. Es la primera lectura del receptor —
farmacia, admisión, laboratorio.

**Contenido.** Título · subtítulo · fecha del encabezado. El subtítulo lo exige
el preámbulo de la Sección II para los ocho formatos (`CONCILIA D2`) y **no
tiene otro sitio donde vivir**: es parte del bloque de título, y se declara aquí
desde el cierre del componente (anexo A, P2-6).

**Variantes declaradas**

| Variante | Cuándo |
|---|---|
| `fijo` | 7 de los 8 formatos. El texto es constante del formato |
| `variable` | Escrito Médico. Lo escribe el médico |
| `ausente` | Escrito Médico sin título. El filete del membrete hace doble trabajo: cierra el membrete y abre el cuerpo |

**Tokens que consume.** `titulo.documento` · `titulo.subtitulo` ·
`fecha.encabezado` —los tres roles de I.1.4 traen familia, cuerpo, interlineado,
peso, tracking y color, así que no se listan por separado— · `espacio.4`
(título → subtítulo, ver regla 5) · `reticula.medianil` (título ↔ fecha) ·
`transicion.tituloFilete` · `transicion.tituloRiel` (arranque del cuerpo en
`ausente`: lo que va bajo el filete cuando el título colapsa ocupa el sitio del
riel). Cierra con `FileteGruesoFino` (2.O), del que hereda `filete.fino` y el
segmento grueso en `acento.base`.

> **CORRIGE 2.C** — la lista anterior era de antes de la escala tipográfica y
> anotaba `tinta.secundaria` como «(fecha)». Es al revés: la **fecha** va en
> `tinta.etiqueta` y quien va en `tinta.secundaria` es el **subtítulo**. Ninguna
> de las dos tintas se instancia suelta: llegan dentro de su rol.

**Reglas**

1. Los títulos fijos **caben en un renglón por diseño**. Un título fijo que
   rompe a dos líneas es un error de redacción del título, no un caso de
   flujo — fue lo que obligó a acortar el de Imagenología.
2. El título variable **sí puede romper a dos líneas** y el encabezado no se
   desalinea por ello.
3. Cuando hay fecha en el encabezado, se alinea por **línea base con la primera
   línea del título**, no con la última y no con el centro del bloque.
4. La variante `ausente` **colapsa entera**: no deja hueco reservado.
5. El **subtítulo** va bajo el título, separado por `espacio.4`, y colapsa si no
   viene. El valor sale de la **escala** y no de la geometría interna del
   componente porque aquí no hay nada que transcribir: el diseño nunca inventarió
   el subtítulo, así que no existe una cifra medida que declarar. De la escala se
   elige el mínimo por **jerarquía**: título y subtítulo son un solo bloque, y su
   separación interna tiene que ser estrictamente menor que la que cierra el
   bloque —`transicion.tituloFilete`, 10 pt— y que la que lo separa del riel
   —`transicion.tituloRiel`, 20 pt—. Con 4 pt el orden queda 4 < 10 < 20 y el
   subtítulo se lee pegado a su título; con `espacio.8`, que es el 80 % del que
   cierra el bloque, empieza a flotar sobre el filete en vez de pertenecer al
   título. **No se usa `transicion.seccionParrafo`** aunque la relación sea
   análoga —encabezado y el texto que lo explica—: ese token tiene dos extremos
   declarados y I.1.7 prohíbe leer la coincidencia de valor como identidad.

**Geometría derivada — desplazamiento de la línea base de la fecha.**

La regla 3 pide alinear la fecha por línea base con la primera línea del título.
**react-pdf no puede hacerlo**: no le da a Yoga una función de línea base para
los nodos de texto, así que `alignItems: 'baseline'` alinea por el borde inferior
del nodo y, con un título de dos líneas, la fecha caería a la **segunda** — justo
lo que la regla prohíbe.

Lo implementado alinea los **bordes inferiores** de las dos cajas de línea: la
caja de la fecha mide una línea de título de alto y su texto se apoya abajo. Eso
garantiza lo que la regla existe para garantizar —la fecha en la primera línea,
nunca en la segunda ni centrada entre ambas— y deja las dos líneas base
desplazadas. El desplazamiento es **derivado y se declara como fórmula**, no como
cifra (§0): la línea base se sitúa a `ascendente × cuerpo` del borde superior de
la caja, y la caja mide el interlineado.

```
desplazamiento =   (titulo.documento.interlineado − fecha.encabezado.interlineado)
                 − ascendente(Archivo) × (titulo.documento.cuerpo − fecha.encabezado.cuerpo)
               =   (20 − 11) − 0.878 × (17 − 9)   =   1.976 pt
```

El ascendente de Archivo es 878/1000 em, leído del TTF del repo. La fecha queda
1.976 pt **por debajo** de la línea base del título: **0.70 mm**, invisible en
papel. Valor medido contra el flujo de contenido de un PDF real, no estimado.

**No es un defecto y no se «arregla».** Un desplazamiento duro que lo compensara
dependería del ascendente de la familia y de los dos cuerpos, y se rompería en
silencio al cambiar cualquiera de los tres.

**Verificación visible.** En Escrito Médico, escribir un título de ~60
caracteres: rompe a dos líneas, **la fecha queda alineada con la primera
línea**, y el bloque de paciente baja lo que creció el título, sin solaparse.
Después borrar el título: el cuerpo arranca directamente bajo el filete del
membrete y no queda ninguna banda vacía donde estaba.

---

### 2.D · `BloquePaciente`

**Propósito.** Identificar al paciente en la hoja. Es un requisito de
seguridad, no de maquetación: en el hospital las hojas se separan.

**Contenido.** Riel único de **siete celdas en dos filas**, no dos rieles
separados: paciente · edad · sexo · expediente · diagnóstico · fecha · hora.

| Celda | Columnas de `riel.celda` | Familia del valor |
|---|---|---|
| Paciente | 5 | `dato`, peso 500 |
| Edad | 2 | `dato` |
| Sexo | 2 | `dato` |
| Expediente | 3 | `dato` |
| Diagnóstico | 5 | **IBM Plex Sans 11 / 16 pt, peso 400, tracking 0, `tinta.negra`** — única excepción de familia |
| Fecha | 4 | `dato` |
| Hora | 3 | `dato` |

La composición del riel —padding de celda, reglas, filetes de apertura y cierre,
y el reparto de anchos al colapsar— **la declara 2.F**, que es de quien 2.D toma
el riel. Aquí solo viven las siete celdas de arriba y sus dos excepciones
tipográficas.

> **La celda de diagnóstico no es un rol de la escala.** No aparece en la tabla
> de I.1.4 y no debe subir a ella: es geometría interna de este componente, que
> es donde I.1.7 manda declararla. Una versión anterior de esta ficha solo
> declaraba familia, cuerpo e interlineado y dejaba peso, tracking y color sin
> decir, así que al construir 2.D hubo que suponerlos. **Quedan declarados
> arriba** y el criterio de cada uno es el mismo: comportarse como cualquier otro
> valor del riel. Peso 400 —el único que usa cualquier rol humanista de I.1.4—,
> tracking 0 —ningún rol humanista lleva tracking— y `tinta.negra`, como todo
> valor de campo. Si algún día 11 / 16 en humanista aparece en un segundo
> componente, entonces sí es un rol y sube a I.1.4 con nombre propio.

> `CONCILIA D6` — la versión anterior de este spec declaraba dos componentes,
> `BloquePaciente` y un `RielDatos` con fecha y diagnóstico. El diseño tiene
> **uno solo**. Se unifica.

**Variantes declaradas**

| Variante | Cuándo |
|---|---|
| `completo` | Hoja 1 |
| `reducido` | Hojas de continuación. Nombre y expediente en un riel de una línea |

**Tokens que consume.** `RielDatos` (2.F) para su composición, y de él vienen las
reglas, los filetes y el reparto de anchos. Propio de esta ficha: `riel.celda`
—las columnas de la tabla de arriba—, los roles `etiqueta` y `dato`, y la
excepción de familia del diagnóstico, declarada entera en la nota de arriba.

> **CORRIGE 2.D** — la lista anterior pedía `etiqueta.*` —un comodín sobre un rol
> que no tiene miembros que desplegar— y `dato.cuerpo`, un fragmento que no
> existe. Es la **cuarta** de las cinco fichas ya implementadas con la misma lista
> pre-escala, no la tercera: se descubrió al barrer de 2.F a 2.T y cruzar el
> resultado contra las que ya estaban construidas (anexo A, P2-11).

**Reglas**

1. Cada dato ausente se comporta según `Campo` (2.E). El nombre nunca está
   ausente: los 8 formularios lo bloquean, salvo Honorarios y Escrito Médico,
   donde es opcional por decisión de producto.
2. La variante `reducido` **no es opcional cuando el documento tiene más de una
   hoja.** Una hoja de indicaciones sin nombre de paciente es un riesgo
   clínico.
3. `sexo`, `numero_expediente` y `hora` **no llegan hoy desde ningún
   formulario**. El expediente se consulta en el hub y no se pasa; la hora
   existe en el nombre del archivo y no en el documento. Es cableado, no campo
   nuevo (Paso 5 del plan). Hasta que exista el cable, los tres se comportan
   como campo vacío opcional y colapsan.

**Verificación visible.** Generar un documento que ocupe dos hojas: la hoja 2
muestra **nombre y expediente del paciente** en su riel superior. Taparse la
hoja 1 con la mano y comprobar que la hoja 2 sigue identificando al paciente.

---

### 2.E · `Campo`

**Propósito.** Resolver, de una sola manera en todo el sistema, qué pasa cuando
un dato no viene.

**Los tres estados**

| Estado | Composición | Alto del bloque |
|---|---|---|
| `con valor` | Rótulo en versalita + valor | `etiqueta` + `dato` = **27 pt** |
| `vacío requerido` | Rótulo en versalita + línea de `manuscrito.ancho` y `manuscrito.alto`, grosor `filete.fino`. Se llena a mano | `etiqueta` + `manuscrito.alto` = **31 pt** |
| `vacío opcional` | **Colapsa entero.** Ni rótulo, ni línea, ni hueco | **0 pt** |

**El estado no se pasa: se resuelve.** El componente recibe el rótulo, el valor
—que puede no venir— y si el formato lo declara requerido, y de ahí sale el
estado. Es lo que quiere decir «de una sola manera en todo el sistema»: si el
estado entrara por prop, cada sitio de llamada podría equivocarse y volveríamos
al defecto §8.8 por otra puerta.

> **Los dos estados con tinta NO miden lo mismo, y es a propósito.** Difieren en
> `manuscrito.alto − dato.interlineado` = **4 pt**, que es lo que el espacio de
> escritura mide de más que un renglón de texto. No se comprime el espacio de
> escritura para igualarlos: `manuscrito.alto` es el único valor tipográfico del
> sistema medido contra una referencia física —pautado de cuaderno profesional,
> 7.1 mm (I.1.5)— e I.3.4 prohíbe cambiar una medida para cuadrar una caja. Lo
> que sí es idéntico en los dos estados es la posición del rótulo: la diferencia
> vive entera **debajo** de él. Una fila de campos mezclados alinea por arriba,
> nunca por abajo.

**Tokens que consume.** `etiqueta` · `dato` —los dos roles de I.1.4, que traen
familia, cuerpo, interlineado, peso, tracking y color— · `manuscrito.ancho` ·
`manuscrito.alto` · `manuscrito.grosor`, que es `filete.fino` por identidad ·
`tinta.negra` para la línea.

> **CORRIGE 2.E** — la lista anterior era de antes de la escala tipográfica y
> pedía `etiqueta.cuerpo`, `etiqueta.tracking` y `dato.cuerpo` sueltos. Esos
> fragmentos no existen como tokens: I.1.4 declara **roles completos**, y un rol
> se consume entero o no se consume. Es la misma corrección que ya se aplicó a
> 2.B (P2-2) y a 2.C (P2-6).

**Reglas**

1. **Nunca una caja con etiqueta y nada debajo.** Es el defecto §8.8 del
   sistema viejo y es el que más daño médico-legal hace, más que los campos
   obligatorios, que sí están protegidos.
2. El estado `vacío requerido` **no lleva leyenda de error**. Nada de «FALTA
   DATO OBLIGATORIO» impreso: el rótulo y la línea ya dicen qué falta y dónde
   se escribe.
3. Qué campo es requerido y cuál opcional lo declara el formato en la
   Sección II. El componente no lo decide.
4. El colapso es **total**: no deja aire donde estaba el campo. Los elementos
   vecinos se cierran.

**Verificación visible.** En Receta, dejar el genérico vacío: aparece el rótulo
`GENÉRICO` con una línea llenable a pluma. En Imagenología, dejar
`proyecciones` vacío: **no queda ni rótulo ni hueco** — la entrada se cierra
sobre sí misma y la siguiente sube. Medir con el borde de una hoja que los dos
casos se ven distintos.

---

### 2.F · `RielDatos`

**Propósito.** Presentar varios datos cortos en una banda horizontal, cada uno
con su etiqueta.

**Variantes declaradas**

| Variante | Cuándo |
|---|---|
| `celdas` | Varias filas. El número de celdas por fila lo declara el formato |
| `una línea` | Riel comprimido de una sola fila. Hoy: `BloquePaciente` reducido |

> **CORRIGE 2.F — las tres «variantes» no eran tres alternativas.** `celdas` y
> `una línea` son formas de componer y se excluyen entre sí; `sin contador` **no
> compone nada**: declara que el riel no participa del conteo de `ContadorLista`
> (2.K regla 3), y un riel puede ser `celdas` **y** `sin contador` a la vez. No es
> una tercera variante sino una propiedad ortogonal, y por eso baja a su propia
> línea:
>
> **`sin contador`.** El riel no entra en el conteo de lista. Existe porque el
> catálogo que presenta es abierto —el médico agrega y quita requerimientos
> especiales de Internamiento— y «3 de 7» sería una cifra falsa. **No cambia nada
> del render**, así que entra como prop cuando exista 2.K, que es quien la lee.
> Implementarla antes sería una prop que nadie consulta.
>
> **La prop ya existe, y su lector no es 2.K.** Construido 2.K, resultó que ese
> componente recibe cifras ya contadas y no ve los rieles de la hoja: quien lee la
> prop es el sitio que compone el documento, que es el único que tiene delante el
> riel y el contador a la vez. Detalle en 2.K regla 3 y en el anexo A (P2-18).
> **Que ningún `if` de 2.F la consulte no es un olvido:** no cambia el render, y si
> algún día aparece uno aquí, la propiedad dejó de ser ortogonal.
>
> **Y `una línea` pierde un consumidor: la línea fina del membrete no es un
> `RielDatos`.** No tiene rótulos, sus anchos no salen de `riel.celda` —la columna
> de contacto es flexible y la de cédulas se dimensiona por contenido—, su texto
> va en `medico.credencial` y una de sus dos celdas apila tres renglones, que no
> es «un dato corto con su etiqueta». Meterla aquí obligaría a que las reglas 1 y
> 2 de esta ficha llevaran excepciones, y un componente con excepciones en sus
> reglas es el componente equivocado. Su geometría ya estaba declarada en 2.B —
> medianil de 24 y sangría de regla de 12— y ahí se queda.

**Tokens que consume.** `etiqueta` · `dato` —los dos roles de I.1.4, que traen
familia, cuerpo, interlineado, peso, tracking y color— · `riel.celda` ·
`filete.fino` y `tinta.negra` (apertura y cierre del riel) · `filete.regla` y
`tinta.hairline` (reglas entre celdas y entre filas).

> **CORRIGE 2.F** — la lista anterior tenía **dos** defectos. Pedía
> `etiqueta.cuerpo`, `etiqueta.tracking` y `dato.cuerpo`, que son fragmentos de
> rol y no existen. Y apoyaba el riel en `reticula.columna` y
> `reticula.medianil`, que es **la retícula equivocada**: I.1.3 declara las dos
> que conviven y dice cuál va aquí. Las celdas del riel se separan con una regla
> vertical más padding, así que su partición es de doce partes iguales **sin
> medianil**, `riel.celda` = 40.5 pt. Donde hay regla no hace falta medianil. La
> regla 1 queda reescrita en consecuencia.

**Reglas**

1. Las celdas se apoyan en `riel.celda`: su ancho es un número entero de
   columnas de riel, **sin medianil que sumar**. Ningún ancho arbitrario.
2. Las reglas entre celdas son `filete.regla` en `tinta.hairline`. **Nunca
   texto en `tinta.hairline`** (I.1.8).
3. Si una celda colapsa por `Campo` vacío opcional, **las restantes
   redistribuyen** y el riel no deja hueco. Un riel con un agujero delata que
   faltaba un dato, que es justo lo que el colapso evita.
4. **`Campo` (2.E) no compone las celdas de este riel, y no es un olvido.**
   Colapsar dentro de un riel no es dejar de pintar un rótulo: es quitar la celda
   entera —ancho, padding y regla— y repartir el sobrante, que es geometría de
   aquí y no puede vivir en 2.E. Repartir la garantía §8.8 entre quien decide y
   quien pinta sería peor que dejarla entera en cualquiera de los dos. Se suma
   que de los consumidores de riel del sistema **solo el del paciente tiene
   celdas con rótulo**, y que el estado `vacío requerido` de 2.E **no cabe aquí**:
   su línea mide `manuscrito.ancho` = 246 pt y la celda más ancha del riel son 5
   columnas = 202.5 pt.

   Lo que sí se comparte, y una sola vez en el sistema, es **la regla de qué
   cuenta como dato ausente**: la exporta 2.E y la importa este componente. Si
   cada uno se escribiera la suya, bastaría con que una dejara de recortar los
   espacios para que un valor en blanco colapsara en un sitio e imprimiera un
   rótulo huérfano en el otro — el §8.8 apareciendo por la costura.

**Geometría interna** — es la del riel, no la de sus consumidores. Padding de
celda `8 10 10`; regla izquierda de `filete.regla` en `tinta.hairline` salvo en
la primera celda de cada fila; regla superior en toda fila que no sea la primera
**viva**; el riel abre y cierra con `filete.fino` en `tinta.negra`.

> Esta declaración vivía en la ficha de 2.D, que fue quien la necesitó primero.
> Baja aquí con el componente: dos fichas declarando el padding del mismo objeto
> es la divergencia que I.3.5 persigue. 2.D conserva solo lo suyo — qué celdas
> hay, cuántas columnas ocupa cada una y sus dos excepciones tipográficas.
>
> **«La primera fila viva», no «la primera fila».** Si la fila de arriba colapsa
> entera, la que queda arriba del todo no lleva regla superior: quedaría una línea
> horizontal flotando bajo el filete de apertura, sin nada encima.

**Verificación visible.** En Suplementación, emitir con peso y sin peso: con
peso, el riel de paciente muestra la celda `BASE DEL CÁLCULO`; sin peso, esa
celda desaparece y **las demás celdas se ensanchan hasta ocupar el riel
completo**. Las dosis se imprimen igual en ambos casos.

---

### 2.G · `EntradaNumerada`

**Propósito.** El ítem de lista del sistema. Base de Receta, Plan de
Suplementación e Imagenología.

**Anatomía**

| Ranura | Contenido | Composición |
|---|---|---|
| Riel del número | `01`, `02`… | `reticula.riel`, rol `entrada.numero` |
| `ancla` | Los dos datos de mayor peso, al mismo cuerpo | rol `entrada.ancla` |
| `secundario` | Dato de apoyo bajo el ancla | rol `entrada.secundario`, que ya va en **`tinta.negra`, nunca un gris** |
| `marca` | Bloque en negativo, si el formato lo usa | 2.H |
| `nota` | Texto en humanista | rol `texto.corrido` |

Qué dato ocupa cada ranura lo declara el formato en la Sección II. El
componente declara las ranuras, no su contenido.

> **CIERRA 2.G — dónde va la `marca`, que la anatomía no situaba.** Va **en la
> fila del `ancla`, a la derecha**, no en el flujo vertical. Lo dice la tabla de
> separaciones internas de aquí abajo: declara `ancla` → `secundario` y
> `secundario` → `nota` y **no declara ningún tramo que toque la marca**. Con la
> marca en el flujo, esa tabla tendría un hueco; fuera de él, está completa. Y
> encaja con lo que la marca es: califica el renglón del ancla —esta presentación,
> por esta vía—, no es un renglón más. El medianil entre el ancla y la marca no lo
> declara la ficha: se usa `reticula.medianil`, el separador de columnas del
> sistema, en vez de inventar una cifra (mismo criterio que 2.C con la fecha).
>
> **La `nota` se compone con `ParserBloques` (2.J).** El rol es el mismo que la
> ficha ya declaraba —`texto.corrido`, que es lo que 2.J usa por defecto— y la
> lista de bloques con esa sintaxis de 2.J incorpora esta ranura. En la práctica
> la indicación es prosa y de ahí sale prosa; si el médico escribe viñetas, salen
> como lista en vez de como una tirada de guiones sueltos. Raya y no número: una
> indicación enumera sin orden (anexo A, P2-25).

**Separaciones internas**

| Separa | Valor |
|---|---|
| `ancla` → `secundario` | `espacio.4` |
| `secundario` → `nota` | `espacio.8` |
| Entre entradas, alrededor de la regla | **12.5 pt**, con reparto propio — ver abajo |

**Geometría interna: el aire entre entradas.** Medido en la lámina aprobada. No
es un miembro de la escala de espaciado y no debe forzarse a serlo (I.1.7): es
geometría del componente, como los anillos de 2.A o el padding de celda de 2.F.

| Tramo | Valor |
|---|---|
| Padding inferior de la entrada que **termina** | 7 pt |
| Regla | `filete.regla` (0.5 pt) en `tinta.hairline` |
| Padding superior de la entrada que **empieza** | 5 pt |
| **Total** | **12.5 pt** |

> **LA REGLA NO ESTÁ CENTRADA, Y ES DELIBERADO.** Queda 2 pt más cerca de la
> entrada que abre que de la que cierra, así que se lee como **apertura de la
> siguiente** y no como cierre de la anterior — que es lo que hace que una lista
> larga se recorra hacia abajo en vez de leerse como bloques sueltos. **Conserva
> el desfase.** Un 6/6 «para que quede centrado» es la corrección que hay que no
> hacer: no es un descuido de medición.
>
> `CONCILIA D-entradas` — el archivo trae **tres calibraciones del mismo
> espacio**: 5/7, 8/10 y 9/11, todas con la misma regla y **todas con el desfase
> de 2 pt**. Gana la de 5/7, que es la de las láminas con varios medicamentos, es
> decir el caso real; las otras dos son de láminas de un solo medicamento. El
> precedente es D4: **un documento no cambia de métrica según cuántos ítems
> tenga**, y una lista que se aprieta al crecer es exactamente lo que I.3.4
> prohíbe. Una sola calibración.

> **CIERRA H4.** Mismo criterio que el subtítulo de 2.C: dentro de un bloque, la
> separación es tanto menor cuanto más pegadas estén las dos piezas. El
> `secundario` es «dato de apoyo **bajo el ancla**» —la segunda línea del mismo
> dato, misma familia y mismo registro—, así que va al **mínimo de la escala**. La
> `nota` cambia de familia y de registro —es humanista, texto corrido, otra voz—,
> así que sube un miembro. Dos niveles de pertenencia, los dos miembros menores de
> la escala, en orden: 4 < 8.
>
> Con `espacio.4` en las dos, la nota se leería como un tercer renglón del mismo
> dato; con `espacio.12` en la segunda, empezaría a competir con la separación
> entre entradas.
>
> **El aire entre entradas ya no se deriva: está medido**, arriba. La cota que
> esta nota dejaba escrita —mayor que `espacio.8`— la cumple: 12.5 > 8. Y confirma
> por qué no se eligió `espacio.12` en su día: el valor real no es un miembro de
> la escala ni está centrado, así que la elección «razonable» habría fijado una
> cifra parecida con el reparto equivocado (anexo A, P2-23).

**Tokens que consume.** `entrada.numero` · `entrada.ancla` ·
`entrada.secundario` · `texto.corrido` · `reticula.riel` ·
`reticula.medianil` · `filete.regla` · `tinta.hairline` · `espacio.4` ·
`espacio.8`. **Componentes:** 2.H en la ranura `marca`, 2.J en la ranura `nota`.

> **CORRIGE 2.G** — la anatomía pedía `entrada.numero.cuerpo`,
> `entrada.ancla.cuerpo`, `entrada.secundario.cuerpo` y `texto.corrido.*`: cuatro
> fragmentos de rol que no existen. Un rol de I.1.4 **se consume entero**, y con
> él vienen la familia y el color, así que `fuente.neogrotesca`, `fuente.humanista`
> y el `tinta.negra` del secundario sobraban de la lista — no porque no apliquen,
> sino porque ya viajan dentro del rol. La lista tenía además dos comodines:
> `entrada.*`, que se despliega a los tres roles, y `espacio.*`, que no se podía
> desplegar porque no había nada declarado detrás. Las dos separaciones internas
> quedan cerradas arriba (H4); la tercera, el aire entre entradas, sigue
> **NO DEFINIDA** y también está arriba.

**Reglas**

1. La numeración lleva **cero a la izquierda**: `01`, no `1`. Dos dígitos
   hasta 99.
2. **Una sola entrada sí se numera.** Distíngase de la regla de viñetas de
   `ParserBloques` (2.J), donde un solo ítem no se numera: son dos listas
   distintas y la confusión entre ambas es previsible.
3. Regla `filete.regla` entre entradas, no antes de la primera ni después de la
   última.
4. `break-inside: avoid`. Una entrada nunca se parte entre hojas.
5. El `secundario` va en **tinta plena**. En Receta ese renglón es la
   denominación genérica: es el único campo obligatorio por normativa y no
   puede componerse como dato de segunda.

**Verificación visible.** En Receta, emitir con 3 medicamentos: los números
salen `01 02 03` en el riel izquierdo, alineados entre sí, y **la denominación
genérica se lee tan negra como el nombre comercial** — más chica, no más gris.
Fotocopiar la hoja: si el genérico se aclara respecto del comercial, está en
gris y es un defecto.

---

### 2.H · `BloqueNegativo`

**Propósito.** Marcar un dato crítico de modo que sobreviva a la fotocopia, al
fax y a la lectura de reojo en un mostrador.

**Composición.** Fondo `tinta.negra`, rol `etiqueta` **con el color sustituido
por `tinta.papel`**. Ancho variable según la palabra.

**Variantes declaradas**

| Variante | Cuándo |
|---|---|
| `via` | Vía de administración dentro de una `EntradaNumerada` |
| `urgente` | Badge del documento, bajo el título |
| `urgente reducido` | Repetición del badge en hojas de continuación |

**Tokens que consume.** `etiqueta` · `tinta.negra` · `tinta.papel` ·
`espacio.4` · `espacio.8`.

> **CORRIGE 2.H** — pedía `etiqueta.cuerpo` y `etiqueta.tracking`, fragmentos que
> no existen. Va el rol `etiqueta` entero, **con una salvedad que hay que
> implementar a mano**: el rol trae `tinta.etiqueta`, un gris de 7 : 1 pensado
> para papel blanco. Aquí el texto va sobre fondo negro y el color se sustituye
> por `tinta.papel`. Componer este bloque pidiendo el rol tal cual imprimiría gris
> sobre negro y lo dejaría ilegible, que es lo contrario de lo que el componente
> existe para conseguir.

**Geometría interna** — el padding es lo único que el componente tiene además del
fondo y del texto, y es lo que separa a `urgente reducido` de las otras dos:

| Variante | Padding |
|---|---|
| `via` · `urgente` | `espacio.4` vertical · `espacio.8` horizontal |
| `urgente reducido` | `espacio.4` por los cuatro lados |

> **CIERRA 2.H — qué reduce `urgente reducido`, y cuál de los dos espacios va
> dónde.** La ficha citaba `espacio.4` y `espacio.8` sin decir cuál era cuál, y
> declaraba la variante reducida sin decir qué reduce. Las dos se cierran con lo
> único que las reglas dejan libre: **el cuerpo y el tracking están congelados por
> la regla 2 y el texto entero por la 1**, así que la única dimensión que una
> variante puede reducir es el aire alrededor de la palabra. El horizontal es el
> mayor de los dos miembros citados, porque es el eje en que el bloque crece con
> la palabra; el vertical es el menor y **no cambia entre variantes**, o el badge
> reducido cambiaría de alto y dejaría de alinearse con lo que tiene al lado.
> **No es una reducción del cuerpo:** la palabra se imprime al mismo tamaño en la
> hoja de continuación que en la hoja 1 (anexo A, P2-15).

**La cadena `URGENTE` es del componente, no del formato.** A diferencia del
título de 2.C, que el formato entrega como cadena, aquí el formato entrega un
booleano: II.2 §2 y II.6 §2 declaran el campo `urgente` como «no requerido · si
viene vacío, sin badge», y ningún formato declara el texto del badge. Hacerlo
entrar por prop abriría la puerta a que una hoja de continuación imprimiera
`URG.`, que es exactamente lo que prohíbe la regla 1. La palabra de la variante
`via` sí viene del formato: son las trece de II.3 §5, y el componente no las
conoce.

**Reglas**

1. **Nunca se abrevia.** No hay `I.M.` ni `SUBCUT.`. El bloque crece hasta que
   la palabra cabe entera.
2. No se escala el texto ni se reduce el tracking para que quepa. El ancho es
   la variable; el cuerpo no.
3. No se trunca ni se pone elipsis. Un dato de vía truncado es un error de
   administración.
4. `urgente` marca **el documento**, no un ítem de la lista.

**Verificación visible.** Emitir una receta con un medicamento oral y otro
intramuscular: **los dos bloques negros tienen anchos claramente distintos** y
ambas palabras se leen completas. Si tienen el mismo ancho, alguien puso un
ancho fijo y la palabra larga está comprimida o cortada.

---

### 2.I · `BloqueDestacado`

**Propósito.** Separar del cuerpo un pasaje que el lector debe leer aunque lea
en diagonal. Se distingue **por filete, nunca por fondo de color**.

**Variantes declaradas**

| Variante | Filete | Usada por |
|---|---|---|
| `alarma` | `filete.alarma`, superior e izquierdo | Receta |
| `instrucciones` | `filete.acento`, izquierdo | Internamiento |
| `cita` | `filete.cita`, izquierdo | Suplementación |

> **CIERRA H1** — la variante `instrucciones` citaba un `filete.instrucciones`
> que no existe. El grosor **se deriva, no se elige**: la regla 1 de esta ficha
> dice que la jerarquía la carga el grosor del filete, y la jerarquía de las tres
> variantes es alarma > instrucciones > cita. Entre `filete.alarma` (3 pt) y
> `filete.cita` (1.6 pt) la escala de I.1.6 tiene **un solo miembro**,
> `filete.acento` (2 pt), así que no hay nada que decidir.
>
> Que `filete.acento` ya lo usen la cabecera de tabla y el marco del QR no
> estorba: la columna «reservado a» de I.1.6 se retiró en la conciliación por ser
> falsa. Un grosor es un grosor, y quién lo usa se declara en la Sección II.

**Tokens que consume.** `alarma.cuerpo` (variante `alarma`) · `texto.corrido`
(variantes `instrucciones` y `cita`) · `filete.alarma` · `filete.acento` ·
`filete.cita` · `espacio.16` (sangría) · `tinta.negra`.

> **CORRIGE 2.I** — dos defectos más. (1) `texto.corrido.*` es un fragmento de
> rol, y `fuente.humanista` sobra porque el rol ya la trae. (2) Faltaba `alarma.cuerpo`,
> que es el rol con el que se compone la variante `alarma` —IBM Plex Sans 12 / 18,
> peso 500, por `CONCILIA D16`— y que **ninguna ficha citaba**, pese a existir en
> I.1.4 desde la conciliación. Un rol sin consumidor declarado es un rol que el
> primer implementador no encuentra.

**Reglas**

1. **Ninguna variante lleva fondo de color.** Ni al velo del acento. La
   jerarquía la carga el grosor del filete, que es lo único que sobrevive
   intacto a una fotocopia.
2. La sangría del texto respecto del filete es `espacio.16` en las tres
   variantes. **En `alarma`, que tiene dos filetes, se aplica a los dos**: el
   texto guarda `espacio.16` con el de la izquierda y otro tanto con el de
   arriba.

   > `CORRIGE HANDOFF` — figuraba como 14 pt en el bloque de alarma, fuera de
   > la escala de espaciado. Se resuelve aquí, como quedó anotado en I.1.7. No
   > hay razón de alineación que exija 14: la sangría no se alinea con la
   > retícula, se alinea con el filete.
   >
   > **CIERRA 2.I — la regla decía «el filete», en singular, y `alarma` tiene
   > dos.** Leerlo como «solo el izquierdo» dejaría el texto de la alarma pegado a
   > un filete de 3 pt, el más grueso del sistema después del de transición y
   > justamente el que más aire necesita. La sangría es del texto respecto de su
   > filete: donde hay filete, hay sangría (anexo A, P2-16).
3. `break-inside: avoid`. Un bloque destacado no se parte entre hojas.
4. La variante `instrucciones` compone **lista numerada**, no con raya: la
   secuencia significa algo (primero presentarse, después el ayuno).

   > **La numeración es de 2.J, y la ranura ya está ocupada.** Quien compone la
   > lista es `ParserBloques`, que recibe **una sola cadena** (`CONCILIA D10`) —
   > que es la forma en que el pasaje entra en este componente—. El cambio fue
   > interno y la entrada de 2.I no se movió, como quedó anunciado.
   >
   > **Las tres variantes componen a través de 2.J**, no solo `instrucciones`: el
   > pasaje entra como cadena en las tres y la Receta compone su alarma «con
   > `ParserBloques` dentro» (II.3 §3). Lo que cada variante declara es **la marca
   > de lista** —número en `instrucciones`, raya en las otras dos— y **el rol del
   > cuerpo** —`alarma.cuerpo` en la alarma, `texto.corrido` en las otras dos—, que
   > entra por la ranura de rol de 2.J. Una prosa sin viñetas sale de ahí como
   > prosa: es la degradación segura del parser, no una excepción de 2.I.

**NO HAY CUARTA VARIANTE. El marco parcial es 2.U, y este componente es uno de
sus consumidores, no su dueño.** La medición del Recibo cerró la duda que esta
ficha dejó abierta —si el marco envolvía prosa o envolvía bloques— y la respuesta
es la segunda: de los tres bloques enmarcados, **la caja de aseguradora es un
`RielDatos` enmarcado y la leyenda no fiscal es una declaración de dos líneas**;
solo la declaración del Consentimiento comparte anatomía con este componente. Un
dispositivo que envuelve cosas de anatomía distinta no es una variante de una de
ellas.

El segundo argumento es de tinta y basta por sí solo: **las tres variantes de
aquí van en `tinta.negra` y el marco va en acento.** En la hoja espécimen, además,
el marco parcial figura en el bloque de **dispositivos gráficos**, no en el de
componentes.

`CONCILIA D26, D34` — las dos divergencias se reportaron por separado —una en
II.5, otra en II.7— sin ver que eran el mismo objeto. Quedan unificadas en 2.U.
**Si alguien vuelve a proponer una variante `acento` de `BloqueDestacado`, esto es
lo que hay que contestar.**

**Verificación visible.** En Receta, emitir con y sin recomendaciones: con
ellas aparece un filete grueso al costado y arriba del bloque, **sin ninguna
trama ni fondo detrás del texto**. Fotocopiar: el filete sigue igual de negro.

---

### 2.J · `ParserBloques`

**Propósito.** Convertir **una sola cadena** de texto libre en una estructura
de encabezados, ítems y párrafos. La estructura la trae el texto prellenado por
plantilla; el sistema no recibe arrays.

**Es el componente de mayor riesgo del proyecto.** Se escribe con su batería de
pruebas al lado, no después.

**Reglas del parser**

| Entrada | Salida |
|---|---|
| Línea que empieza con viñeta | **Ítem** |
| Línea sin viñeta **con ítems debajo** | **Encabezado de bloque** |
| Línea sin viñeta **sin ítems debajo** | **Párrafo suelto**, sin versalita, sin numerar |
| Línea vacía | Corte, se descarta |

**El lookahead es obligatorio.** Decidir el tipo de una línea exige mirar la
siguiente. Sin él, la prosa sin viñetas se compone en versalita como si fuera
título: fue el bug que apareció en el mockup de Internamiento.

> **CIERRA 2.J — el lookahead mira la línea SIGUIENTE, no la siguiente no vacía.**
> «Corte» significa corte: una línea vacía cierra el bloque, así que un encabezado
> separado de sus viñetas por un renglón en blanco **no es encabezado**, es
> párrafo. Es la lectura conservadora y es deliberada — si el lookahead saltara
> los blancos, esto
>
>     El paciente ingresa hoy.
>     ⏎
>     - Dieta blanda
>
> ascendería la primera línea a versalita **por una lista que no es suya**, que es
> el caso 2 entrando por la otra puerta. El precio del corte es un encabezado
> compuesto como prosa, con su lista intacta debajo: exactamente lo que promete la
> degradación segura (anexo A, P2-21).

**Qué cuenta como viñeta.** Guion, raya, semirraya, punto y asterisco —
`- – — • *` —, más el **prefijo numérico** que produce cualquier editor cuando
alguien teclea una lista ordenada (`1.`, `2)`). El prefijo numérico se reconoce
**como viñeta y se descarta** igual que los demás: si la lista va numerada, el
número lo pone el sistema y corrido, o se imprimirían dos numeraciones — que es
la regla 1 de composición.

**La viñeta exige un espacio detrás.** Sin esa condición, una línea de prosa que
empiece por raya —«—dijo el paciente»— se leería como ítem. Con ella, el error
posible es el contrario: un ítem mal tecleado se compone como prosa, que es el
lado seguro.

**Composición**

1. La viñeta del dato **se sustituye** por la raya del sistema. Nunca se
   imprimen las dos.
2. Un ítem puede ocupar varias líneas: la raya cuelga y el texto sangra. Es
   **geometría de render**: en el DATO, una línea sin viñeta no es continuación
   del ítem de arriba sino un bloque nuevo, que es lo que hay que explicarle al
   médico en el textarea (II.6 §5).
3. **Degradación segura.** La viñeta vive en el dato, no en el render. Si el
   parser falla, el texto sigue siendo una lista legible, nunca un párrafo
   apelmazado. Es requisito, no efecto colateral.

**Raya contra número**

| Recurso | Cuándo |
|---|---|
| Raya | Enumeración sin orden — dieta, soluciones, medicamentos |
| Número | La secuencia significa algo — instrucciones al paciente |

**Con un solo ítem no se numera:** se compone como párrafo. Distíngase de
`EntradaNumerada` (2.G), donde una sola entrada **sí** lleva su número.

> **CIERRA 2.J — el alcance de esa regla es la CADENA ENTERA, no el bloque.** Dos
> razones. La ficha la contrasta con 2.G, y ahí «una sola entrada» es del
> documento entero. Y por bloque, dos ítems separados por un renglón en blanco
> serían dos listas de uno y perderían los dos su raya — el apelmazamiento que la
> degradación segura prohíbe. Cuando el ítem único se degrada, **el encabezado que
> tenga encima sigue siendo encabezado**: lo decidió el lookahead sobre el texto
> de origen, donde sí había un ítem debajo (anexo A, P2-21).

**Separación entre nodos**

| Separa | Valor |
|---|---|
| Nodos del mismo bloque — encabezado → ítem, ítem → ítem, párrafo → párrafo | `espacio.4` |
| Entre bloques | `espacio.8` |

> **CIERRA 2.J — la ficha no declaraba el aire y se cierra con el criterio de
> H4**, el mismo que ya cerró las separaciones internas de 2.G y el subtítulo de
> 2.C: dentro de un bloque la separación es tanto menor cuanto más pegadas están
> las piezas. Un encabezado y sus ítems son un solo bloque y van al mínimo de la
> escala; el cambio de bloque sube un miembro. Dos niveles, los dos menores de la
> escala, en orden: 4 < 8. Con `espacio.4` en las dos, los bloques dejarían de
> leerse como bloques; con `espacio.12` en la segunda, el bloque competiría con la
> separación entre bloques de primer nivel (anexo A, P2-20).

**Batería mínima de pruebas.** El caso 2 se prueba **antes que ningún otro**.

| # | Entrada | Salida esperada |
|---|---|---|
| 1 | Encabezado + 2 ítems | Bloque normal |
| 2 | **Prosa sin viñetas, sin ítems debajo** | **Párrafo suelto, sin versalita, sin numerar** |
| 3 | Viñetas antes del primer encabezado | Ítems con raya, no concatenados |
| 4 | Un solo ítem | No se numera |
| 5 | Ítem con dos puntos en medio | No se confunde con encabezado |
| 6 | Cadena vacía | Colapsa entero |
| 7 | Varios bloques con contador corrido | Sin números repetidos |

Los siete viven en `src/lib/tests/parserBloques.test.ts`, en ese orden y con el 2
abriendo el archivo, más las lecturas que cerró P2-21. Son pruebas del **análisis**
—qué es cada línea y en qué orden queda—; lo que se ve se comprueba en el taller.
Por eso el análisis vive en `parserBloques.ts`, separado del componente que
compone: es la mitad testable de un solo componente, no una capa nueva.

**Bloques del sistema que usan esta sintaxis.** Recomendaciones generales de
Receta · notas adicionales de Suplementación · notas para el servicio de
Imagenología · instrucciones al paciente de Internamiento · indicaciones de
ingreso a piso · **la ranura `nota` de `EntradaNumerada`** (2.G).

> La última entró al construir 2.G. Es la única de la lista que **no** es un
> bloque de texto libre sino un renglón de un ítem, y por eso faltaba: la
> indicación de un medicamento es prosa y sale prosa. Pasa por el parser de todas
> formas porque el dato viene de un textarea y nada impide que el médico escriba
> viñetas ahí — y entonces salen como lista, no como una tirada de guiones dentro
> de un párrafo.

**Tokens que consume.** `etiqueta`, para el encabezado de bloque ·
`texto.corrido`, para ítems y párrafos · `reticula.riel` y `reticula.medianil`,
para la sangría del ítem colgante · `espacio.4` y `espacio.8`, para el aire entre
nodos · `fuente.neogrotesca`, **solo para la marca** del ítem.

> **CIERRA 2.J — la marca del ítem y el rol del cuerpo, que faltaban los dos.**
>
> **La marca.** El signo es la **raya** (—), no el guion ni la semirraya: es el
> que abre elemento de lista en ortografía española. Se compone en
> `fuente.neogrotesca` aunque el texto del ítem vaya en humanista (`CONCILIA
> D30`), que es lo que sustituye a la IBM Plex Mono con que la compone hoy el
> sistema viejo — la única aparición de la mono como contenido y no como notación,
> y por eso su retirada pasa por aquí. Cuerpo e interlineado los hereda del cuerpo
> del ítem; lo único que cambia es la familia. En la forma numerada, la marca es el
> ordinal seguido de punto —`1.`— **sin cero a la izquierda**: el cero es de 2.G y
> es de un identificador, no de un conteo, igual que en 2.K.
>
> **El rol del cuerpo entra por ranura.** `texto.corrido` es el caso normal, pero
> la Receta compone su alarma «con `ParserBloques` dentro» (II.3 §3) y esa alarma
> va en `alarma.cuerpo`, un punto por encima (II.3 §5). El rol lo declara la ficha
> del CONSUMIDOR —2.I— y 2.J solo declara que existe la ranura, exactamente como
> 2.F con la excepción tipográfica de celda. La ranura está cerrada a esos dos
> roles: abierta a los 23 de I.1.4 sería una puerta para componer el cuerpo con
> cualquier cosa (anexo A, P2-22).

> **CIERRA H2 — el encabezado de bloque va en `etiqueta`.** Se compone en
> versalita, y de los 23 roles de I.1.4 la versalita del sistema es una sola
> —peso 600, tracking `0.22 em`— con dos nombres: `etiqueta` y `firma.rol`. Que
> existan los dos es la prueba de que ese tratamiento **no es exclusivo de un
> campo**: `firma.rol` no rotula un dato, rotula lo que va debajo de él, que es
> exactamente el trabajo del encabezado de bloque. De los dos nombres se toma el
> genérico.
>
> **No es `titulo.seccion`**, aunque también sea un encabezado: el bloque del
> parser vive **dentro** de una sección que ya abrió `EncabezadoSeccion` (2.P) con
> ese rol. Darle el mismo aplanaría dos niveles en uno, y el nivel es justo lo que
> el lookahead existe para distinguir.
>
> El gris `tinta.etiqueta` que trae el rol es correcto aquí y no contradice la
> regla 5 de 2.G: aquello prohíbe componer en gris un **dato** —la denominación
> genérica—, no el rótulo que lo agrupa.

> **CIERRA H3 — la sangría del ítem es `reticula.riel` + `reticula.medianil`.**
> Un ítem con la raya colgada es la misma anatomía que una entrada con su número
> en el riel (2.G) y que una sección con el suyo (2.P): riel a la izquierda,
> medianil, y la caja de texto. 2.P la escribe explícita —«dos columnas, medianil
> `reticula.medianil`: riel del número (`reticula.riel`) y caja de texto»— y aquí
> se instancia igual, con la raya en el sitio del número.
>
> La suma cierra sola: I.1.3 declara que `reticula.riel` + `reticula.medianil`
> = 23.25 + 9 = 32.25 **es** `reticula.columna`. La sangría del ítem es una
> columna exacta, así que un ítem que rompe a varias líneas sangra a retícula y no
> a un valor suelto.

> **CORRIGE 2.J** — era la única ficha sin lista de tokens.

**Verificación visible.** Pegar en indicaciones de ingreso a piso un texto que
empiece con dos renglones de prosa corrida y siga con un encabezado y sus
viñetas. Los dos primeros renglones deben salir **en minúsculas, en humanista,
sin raya y sin número**. Si salen en versalita, no hay lookahead.

---

### 2.K · `ContadorLista`

**Propósito.** Que quien recibe una hoja suelta sepa si le falta otra.

| Hoja | Formato |
|---|---|
| Intermedia | `<ÍTEMS> EN ESTA HOJA · NN DE MM` — NN es lo impreso en esa hoja |
| Final | `TOTAL DE <ÍTEMS> · MM` |

**Las cifras van sin cero a la izquierda.** `NN` y `MM` son marcadores de
posición de un conteo, no un formato de dos dígitos. El cero a la izquierda es la
regla 1 de 2.G y pertenece al número de **entrada**, que es un identificador: un
`07 DE 13` aquí imitaría ese identificador y haría creer que el contador señala a
un ítem concreto de la lista (anexo A, P2-17).

**Tokens que consume.** **`pie` en versalita**, la desviación declarada en I.1.4,
en color `tinta.secundaria`.

> **CIERRA H5** — pedía `pie.cuerpo` y `etiqueta.tracking`, dos fragmentos de rol
> que no existen, y describía sin nombrarlo el mismo tratamiento que la zona 2 de
> 2.M. Los dos pasan a citar la desviación, que **se declara una sola vez** en
> I.1.4 y no dos: rol `pie` con peso 600 y tracking `0.22 em`, que son los de la
> versalita del sistema.
>
> **El color no viaja con la desviación y por eso no es un rol.** El rol `pie` va
> en `tinta.papel` porque vive sobre la banda de acento; el contador NO vive ahí
> —vive en el área de contenido—, así que pedirlo tal cual lo imprimiría blanco
> sobre blanco. Aquí es `tinta.secundaria`. Es el mismo cuidado que 2.H, por la
> razón inversa.

**Reglas**

1. `<ÍTEMS>` es una palabra que **declara el formato** en la Sección II:
   estudios, medicamentos, suplementos. El componente no la conoce.
2. Un documento de una sola hoja cuenta como **final**.
3. **No aplica a listas no paginables** ni a `RielDatos` en variante
   `sin contador`: un catálogo abierto no tiene total verdadero.

   > **CIERRA 2.K — quién lee la prop `sin contador`, ahora que este componente
   > existe.** 2.F la declaró como propiedad ortogonal que «entra como prop cuando
   > exista 2.K, que es quien la lee» (anexo A, P2-12). **No la lee 2.K:** este
   > componente recibe cifras ya contadas y no ve los rieles de la hoja, así que
   > no puede consultarla ni queriendo. La lee **el sitio que compone el
   > documento**, que es quien tiene delante los dos —el riel y el contador— y el
   > único que puede a la vez no sumar esos ítems al total y no instanciar el
   > contador. Misma forma que tomó el consultorio activo en P2-3: la lectura vive
   > en el sitio que construye el documento, no dentro del componente que imprime.
   >
   > **Tampoco hay aquí una prop para desactivarse.** Un contador que se pinta a
   > sí mismo vacío seguiría ocupando sitio y afirmando algo. La regla se cumple
   > **no instanciándolo** (anexo A, P2-18).

> `CONCILIA D24` — el Recibo no instancia el contador ni en su hoja intermedia.
> Lo instancia: `<ÍTEMS>` = CONCEPTOS.

**Verificación visible.** Emitir una receta con suficientes medicamentos para
ocupar dos hojas: la hoja 1 dice cuántos medicamentos lleva **esa** hoja, la
hoja 2 dice el total. Los dos números son distintos. Si la hoja 1 muestra el
total, está contando el documento y no la hoja.

---

### 2.L · `BloqueFirmas`

**Propósito.** El espacio donde se firma. De 1 a 6 firmas por hoja.

**Variantes declaradas**

| Variante | Cuándo |
|---|---|
| `simple` | Una firma. Caja de 222 pt |
| `pareja` | Dos firmas en la misma fila |
| `retícula` | De 3 a 6 firmas. Dos columnas, medianil 24 pt, padding de celda `14 0 4` |

**El espacio de escritura es 77 pt en todas las variantes** (I.1.9). Lo que
cambia entre variantes es cuántas firmas caben en la fila, no el alto de la
firma.

**Anatomía de una firma**

| Ranura | Token |
|---|---|
| Rol, **encima** de la línea | `firma.rol` |
| Espacio de escritura | `firma.espacio` |
| Línea | `filete.fino` |
| Nombre, bajo la línea | `firma.nombre`, margen superior `espacio.4` |
| Credenciales o nota | `firma.credencial` |

**Inventario de renglones por rol**

| Rol | Renglones bajo la línea |
|---|---|
| Médico tratante | Nombre · céd. profesional · céd. de especialidad |
| Anestesiólogo | Nombre · céd. profesional |
| Paciente · familiar · representante · testigo | Nombre · rol o parentesco |

**Tokens que consume.** `firma.rol` · `firma.nombre` · `firma.credencial` ·
`firma.espacio` · `filete.fino` · `tinta.negra` (color de la línea) ·
`espacio.4` · `manuscrito.ancho`.

> **REVISADA 2.L** — es la única de las quince cuya lista ya nombraba roles
> completos y tokens existentes. Solo se le añade `tinta.negra`: la ficha
> declaraba el grosor de la línea de firma y no su color, y un grosor sin tinta
> no se puede pintar.

**Reglas**

1. **El alto de la firma no depende de la hoja ni del hueco sobrante.** Es
   `firma.espacio`, invariable. Si no caben todas en una hoja, se reparten en
   dos; nunca se comprimen.
2. El bloque se ancla **al final del contenido**, no al pie de la caja. El aire
   sobrante queda debajo de la rúbrica (I.3.4).
3. `break-inside: avoid`.
4. El bloque **nunca se solapa con `PieDocumento`**. Es el bug §8.1 del sistema
   viejo, presente en las dos páginas de Internamiento y en Consentimiento.
5. La rúbrica del médico es un trazo capturado; la de los demás firmantes es
   espacio en blanco sobre la línea, del alto de la variante.

**Verificación visible.** Emitir un consentimiento y una receta uno junto al
otro y medir con el borde de una hoja: **el espacio de escritura sobre la línea
es idéntico en los dos**. Si en el consentimiento es más bajo, alguien repuso
el tramo de 28 pt. Poner el dedo sobre la banda del pie en ambos: no debe tapar
ninguna letra del nombre ni de las cédulas.

---

### 2.M · `PieDocumento`

**Propósito.** Atar cada hoja al documento del que salió.

**Variantes declaradas**

| Variante | Zonas |
|---|---|
| `completo` | Folio · paginación · leyenda |
| `sin folio` | Paginación · título del documento · leyenda. **Solo Escrito Médico** |

**Geometría** — la banda vive **fuera de la caja de texto y dentro de la zona
segura**: `left: margen.izquierdo`, `right: margen.derecho`,
`bottom: zona.segura`. Alto 16 pt. Relleno `acento.banda`, texto `tinta.papel`.
Retícula `auto auto 1fr`, medianil 10 pt, padding lateral 8 pt.

| Zona | Contenido | Token |
|---|---|---|
| 1 | `Folio <folio>` | `pie` |
| 2 | `Página X de Y` en versalita | **`pie` en versalita**, en `tinta.papel` |
| 3 | Leyenda, alineada a la derecha | `pie.leyenda` |

**Tokens que consume.** `pie` · `pie.leyenda` · `acento.banda` · `tinta.papel` ·
`zona.segura` · `margen.izquierdo` · `margen.derecho`.

> **REVISADA 2.M** — lista correcta. Esta ficha es la que **fijó el patrón** de
> desviación declarada: la zona 2 pedía el rol `pie` con peso y tracking
> cambiados y escribía los dos valores exactos en su tabla, en vez de inventar un
> nombre de token para la variación. De ahí salió la tabla de desviaciones de
> I.1.4, y la zona 2 pasa ahora a citarla por su nombre (H5). El color sigue
> siendo cosa del sitio: aquí `tinta.papel`, porque el texto va sobre la banda.

**Reglas**

1. **En todas las hojas, sin excepción.** Un consentimiento de cuatro hojas
   firmado solo en la última no tiene nada que ate la hoja 1 a la de firmas.
   Es el hallazgo más grave de la auditoría.
2. Paginación siempre en forma `PÁGINA X DE Y`, con la Y real del documento.
3. **La banda no sangra y no repite domicilio ni teléfono.** Es la única
   excepción admitida a la prohibición de barra sólida (I.3.2): está acotada a
   16 pt de alto, va en `acento.banda` calculado a 7 : 1, y no cruza la zona
   segura.
4. La variante `sin folio` existe porque el Escrito Médico **no es un documento
   seriado**. Está declarada aquí para que nadie reponga el folio por
   consistencia mal entendida.
5. El pie no invade el bloque de firmas ni al revés.

**Verificación visible.** Emitir un Escrito Médico de dos hojas: en el pie
aparecen paginación, el título que escribió el médico y la leyenda — **y en
ningún lugar de ninguna de las dos hojas aparece un folio**. Emitir una receta:
ahí sí aparece, y en las dos hojas es el mismo número.

---

### 2.N · `MotorFlujo`

**Propósito.** Decidir qué se queda en cada hoja. **Solo mueve bloques.**

**Las tres reglas**

1. **La firma nunca va sola.** Si en la hoja no caben
   `umbral.firma(variante)`, las últimas tres líneas del contenido bajan con la
   firma.
2. **Sin viudas ni huérfanas.** `flujo.orphans` y `flujo.widows` en todo
   párrafo de texto corrido.
3. **Bloques indivisibles.** `break-inside: avoid` en bloque de alarma, entrada
   numerada, bloque de firmas y bloques destacados.

   > `CONCILIA D44` — el spec de flujo del diseño declara **tres**: alarma,
   > entrada y firma. Son cuatro: Suplementación e Internamiento ya aplican
   > `break-inside: avoid` a cita e instrucciones en la práctica, sin
   > declararlo. Se declara.

**Prohibido cambiar cuerpo, interlineado o márgenes para cuadrar una hoja**
(I.3.4).

**Los tres avisos de pie**

| Aviso | Cuándo |
|---|---|
| `CONTINÚA EN LA HOJA N · <ÍTEMS> X A Y` | La lista no terminó en esta hoja |
| `LAS <ÍTEMS> CONTINÚAN EN LA HOJA N` | La lista cerró, el texto corrido sigue |
| `RESERVADO PARA LA FIRMA · CONTINÚA EN LA HOJA N` | Todo cerró y solo falta la firma (regla 1) |

**Zona derecha del aviso:** `SIN FIRMA NO ES VÁLIDO`, invariable.

> `CONCILIA D5, D22` — hoy el aviso no existe como sistema. Hay cuatro
> construcciones de la zona izquierda que no son ninguna de las tres canónicas
> (`La solicitud continúa…`, `El consentimiento continúa…`, `El escrito
> continúa…`, `Continúa en la hoja 2 · instrucciones y firmas`) y **seis
> cadenas distintas en la zona derecha**, incluida una concordancia de género
> parametrizada por formato (`válida` / `válido`). Se unifican a las tres formas
> y a una sola cadena derecha. La concordancia se resuelve con el masculino del
> sustantivo elidido «documento», que es lo que el aviso predica: ningún formato
> declina su propio nombre en el pie.

**Composición de la última hoja.** El bloque de firma se ancla al final del
contenido. El aire sobrante queda debajo de la rúbrica, no encima.

**Tokens que consume.** `umbral.firma` —derivado, se implementa como fórmula— ·
`flujo.orphans` · `flujo.widows` · `flujo.arrastre` · **`pie` en versalita**, en
`tinta.secundaria`, para los tres avisos y para la zona derecha.

> **CORRIGE 2.N** — no tenía lista, aunque su propio cuerpo nombra los cuatro
> primeros tokens. Las «últimas tres líneas» de la regla 1 son `flujo.arrastre`,
> que ya existe y es el mismo 3 que entra en la fórmula de `umbral.firma`: no es
> un literal.

> **CIERRA H10 — los avisos van en `pie` en versalita, en `tinta.secundaria`: el
> mismo tratamiento que el contador de 2.K.** Los tres se derivan de dónde viven y
> de qué son. **No van en la banda de pie**: 2.M declara sus tres zonas —folio,
> paginación y leyenda— y ninguna es esta, así que el aviso es un bloque al pie
> del **área de contenido**, que es justo donde vive el contador de 2.K. Comparten
> además la forma de cadena —una versalita con separador de punto medio que
> informa de paginación— y pueden salir en la misma hoja: dos avisos de la misma
> naturaleza, a un palmo uno de otro, compuestos distinto, compiten por la misma
> mirada sin que la diferencia signifique nada.

**Verificación visible.** Construir un caso donde el contenido termine a media
hoja y la firma no quepa: la hoja debe cerrar con
`RESERVADO PARA LA FIRMA · CONTINÚA EN LA HOJA 2`, y la hoja 2 debe traer
**las tres últimas líneas del contenido más la firma**, no la firma sola.
Medir con una regla que el cuerpo del texto es idéntico en ambas hojas: si en
la hoja 1 es más chico, el motor comprimió y eso es un defecto.


---

### 2.O · `FileteGruesoFino`

**Propósito.** El filete estructural del sistema. Cierra el membrete y separa el
bloque de título del riel de identificación. Se instancia tres o cuatro veces
por hoja en los ocho formatos.

**Composición.** Dos segmentos alineados por su base:

| Segmento | Medida | Color |
|---|---|---|
| Grueso, a la izquierda | 96 × **2.5 pt** | `acento.base` |
| Fino, hasta el borde derecho de la caja | 0.8 pt | `tinta.negra` |

Los 2.5 pt son geometría de este componente, no un miembro de `filete.*`. **Los
0.8 pt del segmento fino sí lo son: son `filete.fino`**, no una cifra suelta.

**Tokens que consume.** `filete.fino` · `tinta.negra` · `acento.base` ·
`caja.ancho`.

> **CORRIGE 2.O** — no tenía lista. Su tabla de composición escribía el grosor del
> segmento fino como «0.8 pt», que es exactamente la forma en que un token se
> convierte en literal al implementarlo: los 2.5 pt del segmento grueso llevan su
> aviso de «geometría del componente» y el 0.8 no llevaba ninguno, así que se leía
> como si fuera del mismo tipo. No lo es.

**Reglas**

1. El segmento grueso es de ancho fijo, **no proporcional** al contenido.
2. Los dos segmentos comparten línea base. Nunca se centran entre sí.
3. Es el único lugar donde el acento aparece como barra sólida, y está acotado
   a 96 pt: no cruza la caja.

**Verificación visible.** Cambiar el acento del médico: **el segmento izquierdo
del filete cambia de color y el resto de la línea sigue negro**. Si toda la
línea cambia, se implementó como un solo filete con degradado o con color único.

---

### 2.P · `EncabezadoSeccion`

**Propósito.** Abrir una sección numerada de texto corrido. Lo usan
Consentimiento e Internamiento.

**Composición**

- Abre con regla de `filete.fino` a todo `caja.ancho`
- Padding superior 8 pt — geometría interna, entre el filete y la cabecera
- Dos columnas, medianil `reticula.medianil`: riel del número
  (`reticula.riel`) y caja de texto
- Número en `seccion.numero`; título en `titulo.seccion`
- Aire título → párrafo: `transicion.seccionParrafo`
- Aire entre secciones: `transicion.entreSecciones`

**Tokens que consume.** `seccion.numero` · `titulo.seccion` · `texto.corrido` ·
`reticula.riel` · `reticula.medianil` · `caja.ancho` · `filete.fino` ·
`tinta.negra` · `transicion.seccionParrafo` · `transicion.entreSecciones`.

> **CORRIGE 2.P** — no tenía lista, y su composición escribía **como cifras
> sueltas las dos separaciones que I.1.7 nombró expresamente para esta ficha**:
> los 8 pt del aire título → párrafo son `transicion.seccionParrafo` y los 24 del
> aire entre secciones son `transicion.entreSecciones`. El segundo estaba además
> escrito como `espacio.24`, que es justo la confusión contra la que I.1.7 avisa:
> valen lo mismo y **no son el mismo token**. Mover `espacio.24` para ajustar el
> aire entre secciones movería con él todo lo demás del sistema que hoy mide 24.

**Reglas**

1. **No es una `EntradaNumerada`.** No participa de `ContadorLista`, su número
   es de sección y no de entrada, y no lleva ranuras de ancla ni de marca.
2. El párrafo va en `texto.corrido`, **bandera izquierda**. El espécimen lo
   tiene justificado con partición; queda superado por I.3.2.

**Verificación visible.** En el Consentimiento, el borde derecho de los
párrafos debe quedar **desigual**. Si está alineado, quedó justificado y hay
palabras partidas con guion en alguna línea.

---

### 2.Q · `AperturaSeccion`

**Propósito.** La transición entre las dos secciones de Internamiento. Es más
fuerte que un `EncabezadoSeccion` porque cambia de lector, no de tema.

**Composición.** `filete.transicion` a todo `caja.ancho` + número colgado en el
riel + cabecera con el rótulo de sección y el subtítulo de lector.

| Elemento | Rol |
|---|---|
| Número colgado en el riel | **`seccion.numero` a 26 pt**, desviación declarada (I.1.4) |
| Rótulo de sección | `titulo.seccion` |
| Subtítulo de lector | `titulo.subtitulo` |

**Tokens que consume.** `seccion.numero` · `titulo.seccion` ·
`titulo.subtitulo` · `filete.transicion` · `caja.ancho` · `reticula.riel` ·
`tinta.negra`.

> **CIERRA H6 y H7.** No tenía lista y sus tres elementos con texto no tenían rol.
> Los tres se derivan de 2.P, que hace **el trabajo análogo un nivel más abajo**:
> abrir una sección con su número colgado en el riel y su título al lado.
>
> **El número.** 2.P compone el suyo con `seccion.numero`, y el de aquí es el
> número de una sección igual que aquel — la cabecera dice `SECCIÓN 2 DE 2`. Del
> rol vienen familia, peso, tracking y `acento.tinta`; lo único que cambia es el
> cuerpo, que esta ficha ya fijaba en 26 pt y que **es coherente con el propósito
> declarado del componente**: 2.Q es más fuerte que 2.P porque cambia de lector, y
> ya lleva el filete más grueso del sistema. Un número que sonara igual que el de
> 2.P contradiría eso. Queda como desviación declarada y no como rol nuevo: un
> solo consumidor.
>
> **El rótulo de sección** hace lo mismo que el título de 2.P, así que va en el
> mismo rol.
>
> **El subtítulo de lector** es la única línea secundaria que el sistema tiene
> —humanista, `tinta.secundaria`, colgada de un título—, y 2.C ya la usa así bajo
> el título del documento. Inventar una segunda para las secciones sería, en la
> capa de tokens, lo que I.3.5 prohíbe en la de componentes. Lo que sí cambia es
> el **alcance declarado del rol**, que en I.1.4 pasa de «subtítulo de documento»
> a «de documento o de sección».

**Reglas**

1. La cabecera dice `SECCIÓN 2 DE 2`. **Nunca «continuación».** Una hoja de
   indicaciones de enfermería no es la continuación de la hoja del paciente: es
   otro documento dentro del mismo folio.
2. Es el filete más grueso del sistema y su uso está limitado a este
   componente.

**Verificación visible.** El filete de apertura debe verse **claramente más
grueso que cualquier otro filete del documento**, incluido el del membrete.

---

### 2.R · `ZonaQR`

**Propósito.** Verificación por terceros: farmacia, hospital, aseguradora.

**Composición.** `MarcoParcial` (2.U) con padding `12 14 14`.

> **CORRIGE 2.R** — esta ficha describía el marco entera —«dos lados, filete
> superior e izquierdo de `filete.acento`»— y era **la segunda declaración del
> mismo objeto** en el spec. El marco baja a 2.U, que es el dispositivo; aquí se
> queda lo que sí es de 2.R: qué envuelve y con cuánta sangría. Es la misma
> operación que llevó la composición del riel de 2.D a 2.F (anexo A, P2-13).

| Elemento | Medida |
|---|---|
| QR | 56 × 56 pt |
| Medianil QR → texto | 14 pt |
| Caja de texto | 132 pt |
| Etiqueta | `etiqueta` |
| Leyenda | IBM Plex Sans 9 / 13 pt, `tinta.secundaria`, margen superior 3 pt |
| Filete corto sobre el folio | 40 × `filete.cita`, `acento.base`, margen superior 10 pt |
| Folio | `folio` |

**Tokens que consume.** `etiqueta` · `folio` · `filete.acento` · `filete.cita` ·
`acento.base` · `tinta.secundaria`.

> **REVISADA 2.R** — no tenía lista; los tokens que su tabla ya citaba eran todos
> reales y con nombre completo, incluido el rol `etiqueta`, que aquí sí está bien
> escrito. Lo que queda señalado es la **leyenda**: IBM Plex Sans 9 / 13 pt no es
> ningún rol de I.1.4. La ficha la declara entera —familia, cuerpo, interlineado y
> color—, así que es geometría interna válida y no un hueco a medias, pero es el
> **segundo** cuerpo humanista fuera de la escala tras el diagnóstico de 2.D
> (11 / 16). Dos ya son un patrón que conviene mirar antes de que sean tres.

**Reglas**

1. **La zona de QR vive en el cuerpo de la última hoja, no en el pie.** El pie
   lleva el folio como texto; el QR es un bloque del contenido.
2. Solo en la última hoja, una vez por documento.
3. En el QR va únicamente el token de acceso, nunca el folio ni datos del
   paciente.

**Verificación visible.** En un documento de dos hojas, el QR aparece **una sola
vez, en la hoja 2, dentro del área de contenido y por encima de la banda de
pie**. El folio aparece en las dos hojas, en la banda.

---

### 2.S · `MarcaEstado`

**Propósito.** Declarar que un documento no es definitivo. Sustituye a la marca
de agua de logo, que queda prohibida (I.3.2).

**Composición**

| Valor | Medida |
|---|---|
| Cuerpo | `marca.estado` |
| Rotación | −9° |
| Relleno | transparente — letra hueca |
| Contorno | `filete.regla`, en el gris derivado de abajo |
| Posición | anclada al pie del área de contenido |

**Geometría derivada: el gris del contorno.** `tinta.negra` al **45 %** sobre
blanco, **por mezcla opaca**, con la misma operación que I.1.8 usa para
`acento.velo`.

> **CIERRA H11.** El «negro al 45 %» era el único color del sistema que vivía
> suelto en una ficha, sin token y sin fórmula. No necesita entrada propia en
> I.1.8 —lo usa un solo componente en un solo sitio, que es el criterio de 2.A—
> pero sí necesita **decir de dónde sale**, o el primero que lo implemente
> escribirá un hexadecimal a mano.
>
> Sale de donde salen todos los tonos derivados del sistema: mezclando contra un
> extremo, en proporción declarada, **con la mezcla opaca de I.1.8 y nunca con un
> alfa**. El motivo es el mismo que allí: un alfa en PDF depende del visor y del
> driver de impresión, y una mezcla opaca imprime igual en todas partes. La
> proporción es la que la regla 2 de esta ficha exige — el contorno tiene que
> quedar por debajo del texto que cruza, o el sello compite con lo que hay que
> leer.

**Estados:** `SIN FIRMAR` · `BORRADOR` · `COPIA` · `SIN VALIDEZ — VISTA PREVIA`.

**Tokens que consume.** `marca.estado` · `filete.regla` · `tinta.negra`, del que
se deriva el gris del contorno.

> **REVISADA 2.S** — no tenía lista; los dos tokens que su tabla citaba son
> reales. `marca.estado` es además el único rol de I.1.4 **sin interlineado y sin
> relleno**: declara `contorno`, no un color de texto, y la capa de tokens lo
> respeta devolviendo el estilo sin `color`. El gris del contorno queda cerrado
> arriba como geometría derivada (H11).

**Reglas**

1. Es el **único uso permitido de la diagonal** en el sistema.
2. Letra hueca siempre: rellena taparía el texto y desaparecería en fotocopia.

> `CONCILIA D18` — había dos rotaciones (−28° y −9°) y dos contornos (0.7 y
> 0.5 pt). Gana el par que instancia un formato real sobre el de la lámina.

**Verificación visible.** Emitir un consentimiento en borrador: la palabra
`BORRADOR` cruza la hoja en diagonal, **hueca**, y todo el texto que hay debajo
sigue siendo legible.

---

### 2.T · `RielImportes`

**Propósito.** El cierre económico del Recibo. Es el único bloque del sistema
con jerarquía de cifra.

**Composición.** Caja de ancho **`cierre.derecha`** alineada a la derecha,
retícula `1fr auto`. Filas: subtotales → total → anticipo → saldo.

| Fila | Cuerpo |
|---|---|
| Subtotal, anticipo, saldo | `dato` |
| Total | Geometría de este componente — ver abajo |

**Geometría del componente: la cifra del total.** Archivo **22 / sin
interlineado propio**, peso 600, tracking 0, `tinta.negra`, cifras tabulares.

> **CIERRA H8 — el total es geometría de 2.T, no un rol.** Criterio de los
> anillos del panel de 2.A: un valor que usa **un solo componente en un solo
> sitio** se declara en su ficha y no en la escala. Aquí lo dice la propia regla 2
> —no hay segundo uso del cuerpo de 22 pt en una cifra—, y un rol existe para
> tener plural.
>
> Los tres valores que la ficha no declaraba se derivan del riel en el que vive.
> **Tracking 0**, que es el de todos los roles con cifra de I.1.4 —`dato`,
> `tabla.celda`, `entrada.numero`— salvo `folio`. **`tinta.negra`**, porque la
> regla 1 exige que la columna «sume visualmente» y una columna que cambia de
> tinta entre sus filas y su total deja de leerse como una columna. **Sin
> interlineado propio**, como `marca.estado`, que es el otro 22 pt del sistema y
> el único rol que I.1.4 deja sin interlineado: el total es una sola línea y la
> altura de su fila es del riel, no de la cifra.
>
> El cuerpo coincide con `marca.estado` y **no se fusionan**: una es una cifra y
> el otro un sello hueco y girado. La regla 2 queda corregida abajo, porque decía
> que no había segundo uso de 22 pt y sí lo hay.

**Tokens que consume.** `dato` · `tinta.negra` · `cierre.derecha`.

> **CIERRA H9 — la caja mide `cierre.derecha` (246 pt), y NO es `manuscrito.ancho`.**
> Medido en el Recibo aprobado: el riel de importes no tiene ancho propio, ocupa
> **la columna derecha de la fila de cierre**, la misma donde vive la caja de
> firma en los ocho formatos. Por eso 246 no salía de la retícula de doce — la
> fila de cierre es de dos columnas, con su medianil de 24 pt, y está declarada en
> I.1.3.
>
> **Que coincida con `manuscrito.ancho` es real y es `COINCIDENCIA`**, no
> identidad: cuál derivó de cuál no lo dice el archivo. Si algún día cambia el
> ancho de la línea de escritura a mano, esta caja no se mueve. **No sustituyas
> `cierre.derecha` por `manuscrito.ancho` porque «es el mismo número»:** es el
> error que este componente ya cometió una vez, y es lo que dejó H9 abierto
> durante toda la conciliación.
>
> Corolario para 2.L: la caja de firma vive en esta misma columna. Cuando se
> construya, el token es este y no uno nuevo.

**Reglas**

1. **Cifras tabulares en todas las filas**, alineadas por la unidad. Es el único
   bloque donde una columna de números tiene que sumar visualmente.
2. El total es la única **cifra** del sistema que sube de escala. Comparte cuerpo
   con `marca.estado`, que también es 22 pt: es `COINCIDENCIA` y no identidad — un
   sello hueco y girado no es una cifra— y **no se fusionan**.
3. Anticipo y saldo colapsan por separado.

**Verificación visible.** Emitir con cuatro conceptos de importes de distinta
longitud: los cuatro quedan alineados **por la unidad, no por la izquierda**, y
el total se lee claramente mayor que ellos.

---

### 2.U · `MarcoParcial`

**Propósito.** Enmarcar sin encerrar. Es el **dispositivo gráfico** con el que el
sistema acota un contenido que hay que mirar aparte, sin barra, sin fondo y sin
caja cerrada.

**Composición.** Filete **superior e izquierdo** de `filete.acento`, en
`acento.base`. Nada más: ni los otros dos lados, ni relleno, ni velo.

**Sin variantes.** El marco es uno solo. Lo que cambia entre usos es **qué
envuelve**, y eso no es una variante suya.

**Tokens que consume.** `filete.acento` · `acento.base`.

**Reglas**

1. **Dos lados, siempre los mismos: superior e izquierdo.** Nunca los cuatro y
   nunca con fondo (`CONCILIA D34`, I.3.2). Un marco de cuatro lados con trama es
   lo que hace el sistema viejo y es lo que este dispositivo sustituye.
2. **Va en acento**, y es uno de los usos que I.1.8 admite para el acento — como
   filete, nunca como color de texto.
3. **Envuelve; no compone.** No conoce el rol de lo que hay dentro, no impone
   familia ni cuerpo, y por eso puede envolver cosas de anatomía distinta: un
   `RielDatos`, una declaración de dos líneas o un pasaje de prosa. **Ahí está la
   diferencia con `BloqueDestacado`** (2.I), que sí compone su contenido en un rol
   propio y va en `tinta.negra`.
4. **La sangría respecto del filete la declara el consumidor**, no este
   dispositivo: un riel enmarcado y una leyenda de dos líneas no la llevan igual.
   2.R ya declara la suya —padding `12 14 14`—. **`NO DEFINIDO`** la de las tres
   cajas del Recibo: se mide al construir II.5, con la lámina delante.
5. **En fotocopia sigue significando** (I.3.3): lo que informa es el marco, no su
   tono. Que el acento salga gris no le quita nada — sigue siendo dos filetes de
   2 pt donde no había ninguno.

**Quién lo instancia**

| Sitio | Qué envuelve |
|---|---|
| 2.R · `ZonaQR` | El QR, su leyenda y su folio. **Ya lo componía por su cuenta** |
| II.5 · Recibo | Caja de aseguradora (un `RielDatos`), leyenda no fiscal y declaración |
| II.7 · Consentimiento | El bloque de motivo (`CONCILIA D34`) |

> **DE DÓNDE SALE ESTE COMPONENTE.** De medir el Recibo. La ficha de 2.I había
> dejado abierto si el marco en acento era su cuarta variante o no lo era; la
> medición dice que los tres bloques enmarcados **no comparten anatomía entre sí**
> —uno es un riel, otro una declaración de dos líneas— y que solo uno se parece a
> un bloque destacado. Un dispositivo que envuelve cosas distintas no pertenece a
> ninguna de ellas. Se suma la tinta: las tres variantes de 2.I van en negro y
> esto va en acento.
>
> **No contradice I.3.5.** Esa regla prohíbe el componente PARALELO —uno que hace
> lo mismo que otro con otro nombre— y esto es lo contrario: retira de 2.I una
> variante que no le pertenecía y le quita a 2.R una composición que ya estaba
> duplicando en solitario. Donde había dos declaraciones del mismo marco y una
> tercera reclamada por el componente equivocado, queda una.
>
> `CONCILIA D26, D34` — las dos divergencias eran el mismo objeto visto desde dos
> formatos. Quedan unificadas aquí (anexo A, P2-24).

**Verificación visible.** Poner juntas la `ZonaQR` de una receta y la caja de
aseguradora de un recibo: **el marco es idéntico en las dos** —mismo grosor,
mismos dos lados, mismo tono— aunque dentro haya un QR en una y un riel de celdas
en la otra. Si un marco tiene los cuatro lados, o trama detrás, es el sistema
viejo asomando.

---

## I.3 · Invariantes del sistema

Lo que no es token ni componente: reglas que ningún formato puede desactivar.

### I.3.1 · Gate de extracción de texto

**Es el Paso 3 del plan y es bloqueante.** Se corre en cuanto exista el primer
PDF real de react-pdf, antes de implementar el resto de formatos.

**Procedimiento.** Generar el PDF de un formato con datos reales y correr
`pdftotext` sobre él.

**Deben aparecer como texto real, no como trazo ni como carácter de reemplazo:**

- [ ] Denominación genérica
- [ ] Nombre comercial
- [ ] Presentación y gramaje
- [ ] Vía de administración
- [ ] Indicación
- [ ] Números de entrada (`01`, `02`…)
- [ ] Folio
- [ ] `PÁGINA X DE Y`
- [ ] Etiquetas en versalita, **sin fragmentar**: `PACIENTE`, nunca `PAC IE NT E`
- [ ] Ligaduras: `superficie`, nunca `super�cie`

**La lista no cambia.** Es la misma de siempre y sigue siendo la que decide si
el gate pasa o falla.

**El riesgo, cruzado contra la escala**

El mecanismo está confirmado hasta el operador PDF en la auditoría §8.5:
`letterSpacing` hace que el avance de cada glifo difiera de su anchura nominal,
y react-pdf entonces **puede** partir el operador `TJ` en un segmento por glifo;
si lo hace, el extractor devuelve la cadena letra por letra. Ese riesgo **no
corre parejo por toda la lista**, y saber dónde corre es lo que dimensiona el
problema. Cruzada contra I.1.4, la lista se parte en dos:

| Elemento del gate | Quién lo compone | Rol | Tracking |
|---|---|---|---|
| Denominación genérica | 2.G, ranura `secundario` | `entrada.secundario` | **0** |
| Nombre comercial | 2.G, ranura `ancla` | `entrada.ancla` | **0** |
| Presentación y gramaje | 2.G, ranura `ancla` | `entrada.ancla` | **0** |
| Indicación | 2.G, ranura `nota` | `texto.corrido` | **0** |
| Ligaduras (`superficie`) | Todo texto corrido | `texto.corrido` | **0** |
| Números de entrada (`01`) | 2.G, riel del número | `entrada.numero` | **0** |
| Folio | 2.M zona 1 · 2.R | `folio` | 0.03 em |
| `PÁGINA X DE Y` | 2.M zona 2 | `pie` en versalita | 0.22 em |
| Etiquetas en versalita | 2.E · 2.F · 2.J | `etiqueta` | 0.22 em |
| **Vía de administración** | **2.H** | **`etiqueta`** sobre negativo | **0.22 em** |

**Seis de los diez van con tracking 0** y no pueden fragmentarse por esta causa,
incluidos los cuatro campos clínicos que sostienen el motivo de todo el gate: la
genérica, el comercial, el gramaje y la indicación.

**De los cuatro que llevan tracking, tres son metadatos** —folio, paginación y
etiquetas—: un folio fragmentado estorba a una búsqueda, no a una dispensación.

**Y el cuarto no lo es: la vía de administración.** No va en `dato` ni en
`texto.corrido`: 2.H la compone con el rol `etiqueta` sobre fondo negro, así que
carga los mismos `0.22 em` que un rótulo. **Es el único elemento del gate que es
a la vez clínico y traqueado**, y por eso es el primero que hay que mirar cuando
el gate corra y el primero al que se le baja el tracking si falla. Que un
`INTRAMUSCULAR` salga como `I N T R A M U S C U L A R` de un extractor no es un
problema de búsqueda: es el dato que decide cómo se administra el fármaco.

**Escalera de remedios, en este orden**

1. **Correr el gate contra un PDF real de react-pdf.** El primer remedio es
   medir: el mecanismo de §8.5 es real, pero que rompa la extracción en esta
   versión del renderer, con estas fuentes y con este extractor, **está sin
   comprobar**. No se rediseña la escala tipográfica contra un riesgo que nadie
   ha visto fallar.
2. **Si falla: bajar o eliminar el tracking en los elementos del gate que lo
   llevan**, y solo en ellos — los cuatro de la tabla, empezando por la vía.
   Cuatro sitios acotados, con su rol y su componente ya identificados. El resto
   del chasis no se toca: un rol traqueado que no está en la lista del gate no
   tiene por qué cambiar.
3. **Solo si eso no basta: revisar la escala.** Es el remedio caro —mueve
   `etiqueta` y `firma.rol`, y con ellos toda versalita del sistema— y por eso va
   el último, no el primero.

**Las versalitas reales quedan descartadas, y no se vuelven a proponer.** Una
versión anterior de esta sección las exigía; es un remedio que **no existe en
este renderer**: el `Style` de react-pdf no tiene `fontVariant` ni selección de
*features* OpenType, y Archivo no se carga con un corte de versalitas. La única
forma sería registrar un TTF de versalitas como familia aparte, lo que
invalidaría todos los trackings de I.1.4 y cambiaría la altura de las etiquetas
—que es justo lo que I.1.4 advierte— para resolver un fallo que todavía no se ha
medido. Si alguien vuelve a proponerlo, esto es lo que hay que contestar.

**Quién manda sobre qué.** **I.1.4 gobierna la composición**: ahí se declara que
las versalitas del sistema son mayúsculas con tracking, y esta sección no lo
contradice ni lo prohíbe. **Esta sección gobierna qué hacer si el gate falla**:
la escalera de arriba, en ese orden. Las dos secciones se contradecían mientras
I.3.1 ordenaba un remedio inexistente; ya no (anexo A, P2-19).

**Consecuencia declarada.** Si el gate falla, **no se avanza a otros formatos**
hasta que pase. No se documenta como deuda, no se difiere, no se implementa
«mientras tanto» un segundo formato. Lo que cambia con la escalera es **qué se
arregla**, no la exigencia de arreglarlo antes de seguir.

**Motivo.** La denominación genérica es el único campo obligatorio por
normativa. Un expediente cuyo dato legalmente exigible no es legible por
máquina es exactamente lo que se revisa en la certificación NOM-024.

### I.3.2 · Prohibiciones de diseño

Ninguna admite excepción por formato:

- Barras de color sólido a todo lo ancho
- Sombreado alternado de filas (zebra) — delata origen HTML y desaparece en fotocopia
- Marca de agua de logo en el área de contenido
- Iconos decorativos
- Degradados, sombras, esquinas muy redondeadas
- Texto justificado
- Ornamento clásico: orlas, molduras, guilloches

### I.3.3 · Supervivencia en fotocopia

**El color nunca es el único portador de significado.** Todo debe seguir
significando en fotocopia monocroma. Si dos elementos solo se distinguen por
tono de acento, el diseño está mal: la distinción se resuelve con peso, cuerpo,
grosor de filete o posición.

### I.3.4 · El motor solo mueve bloques

**Prohibido cambiar cuerpo, interlineado o márgenes para cuadrar una hoja.**
Cuando el contenido no cabe, el motor mueve bloques; no comprime.

Corolario: el bloque de firma se ancla **al final del contenido**, no al pie de
la caja. El aire sobrante queda **debajo** de la rúbrica. Aplica a todos los
formatos.

### I.3.5 · Regla anti-divergencia

Si un formato necesita algo que un componente del chasis no hace, se agrega una
**variante declarada** al componente existente. **Nunca un componente
paralelo.** Si aparece la tentación de crear uno, el chasis está mal y se
arregla el chasis.

Criterio medible heredado de `DOCUMENTOS_DECISIONES.md` §1: ningún archivo de
formato contiene un color, un cuerpo de fuente o un padding literal. Un formato
de 300 líneas es un chasis incompleto.

### I.3.6 · Consultorio activo

**El invariante: el consultorio activo se lee UNA SOLA VEZ por documento.** Los 8
formatos toman siempre los datos del consultorio activo: sin instantáneas, sin
respaldo a los campos heredados del perfil (`direccion_consultorio`,
`telefono_consultorio`), sin excepciones para documentos nuevos.

**Dónde ocurre la lectura: en el sitio que CONSTRUYE el documento**, es decir el
formulario o el call site que arma el árbol de react-pdf antes de renderizarlo.
`Membrete` es el único componente que **imprime** esos datos, y los recibe **por
prop**.

> **CORRIGE I.3.6** — la versión anterior decía que `ConsultorioActivoContext` se
> consumía «en `Membrete`», con un `useContext` dentro del componente. Al
> implementar 2.B resultó que **eso no puede funcionar**: el PDF se renderiza con
> `pdf()`, que monta su propio árbol **fuera del árbol de providers de la app**.
> Un `useContext` ahí no falla ni avisa: devuelve el valor por defecto e imprime
> el consultorio equivocado **en silencio**, que es exactamente el defecto que
> esta regla existe para evitar.
>
> **No lo «arregles» metiendo el contexto dentro del componente.** Si ves
> `Membrete` recibiendo `consultorio` por prop, está bien. Lo que hay que vigilar
> es que **solo un sitio por documento lea el contexto**: si aparece un segundo
> `useConsultorioActivo()` en la ruta de emisión de un formato, ese es el defecto
> que describe la verificación visible de 2.B. El invariante es sobre el número de
> lecturas, no sobre qué componente las hace.
>
> Los formularios de v1 ya lo hacen así —leen el contexto y pasan
> `consultorioData` al PDF—, así que la corrección alinea el spec con lo que la
> app hace y con lo único que el renderer permite.

### I.3.7 · La validación bloquea, no colapsa

Un dato que la normativa exige **no se colapsa cuando falta: impide emitir**.
Aplica a universidad emisora, cédulas y domicilio del consultorio.

Hoy `PdfHeader` los renderiza condicionales a truthy y un médico con perfil
incompleto emite recetas sin universidad y sin domicilio, en silencio
(auditoría, nivel 1). No es un defecto de diseño: es un defecto de producto, y
se corrige en el formulario, no en el render.

Distíngase del **campo vacío legítimo**, que sí tiene tres comportamientos
declarados en I.2 · `Campo`: con valor, vacío requerido con línea para llenar a
mano, vacío opcional que colapsa. Lo que nunca existe es una caja con etiqueta
y nada debajo.

### I.3.8 · Restricciones de react-pdf

- `<Image>` acepta **solo JPG, PNG o base64**. No GIF, no EPS, no SVG como archivo.
- El vector va por primitivas `<Svg>` / `<Path>` / `<G>`.
- Todo asset ráster se vigila por peso. El logo PNG del sistema viejo pesa
  195 KB y es el 80 % del peso de cada archivo generado.
- **La hifenación va desactivada.** react-pdf parte palabras con guion por
  defecto —en el taller salió `RECOMEN-DACIONES`— y su algoritmo además corrompe
  caracteres acentuados, que es la razón por la que v1 ya lo desactiva. Se apaga
  en el registro de fuentes con `Font.registerHyphenationCallback(p => [p])`, que
  es **global al renderer, no por familia**: una sola llamada cubre las dos
  familias y cualquiera que se registre después. El motivo que obliga no es
  estético: sin desactivarla, la **denominación genérica** de una receta puede
  salir partida con guion, y es el único campo obligatorio por normativa que
  tiene que ser legible por máquina en el gate de I.3.1. `RECOMEN-DACIONES` es
  feo; `AMOXICI-LINA` es un problema legal.
- No existe alineación por **línea base** entre nodos de texto: no hay función de
  línea base registrada en Yoga, así que `alignItems: 'baseline'` alinea por el
  borde inferior del nodo. Una regla del spec que pida alinear líneas base se
  implementa alineando bordes inferiores de cajas de línea, y el desplazamiento
  residual se declara en la ficha del componente (primer caso: 2.C).
- **`flexBasis` es de caja de CONTENIDO; `width` es de caja de BORDE.** Es la
  trampa de cualquier riel de celdas, y la forma «obvia» de repartir en
  proporción —`flexBasis: 0` más `flexGrow: columnas`— cae justo en ella.

  **Síntoma:** las celdas salen más estrechas de lo declarado y el error es mayor
  cuantas más columnas tenga la celda. En 2.D, con padding `8 10 10` y regla de
  0.5, la celda de paciente salió de **188.54 pt** en vez de los **202.5** que
  son sus 5 columnas de `riel.celda`. El riel se ve bien —suma 486 y no deja
  hueco—, así que el defecto **no se nota mirando**: solo aparece al medir contra
  la retícula, o al poner dos rieles distintos uno debajo del otro y ver que sus
  reglas verticales no coinciden.

  **Causa:** el padding y la regla se suman **por fuera** del basis, así que el
  reparto proporcional se hace sobre `486 − Σ(padding + regla)` y no sobre 486.

  **Forma correcta:** `width: columnas × riel.celda` **más** `flexGrow: columnas`.
  El `width` da el ancho declarado en el caso nominal —los anchos suman la caja y
  no sobra espacio que repartir— y el `flexGrow` solo entra cuando una celda
  colapsa, que es cuando sí hay que redistribuir. Los dos, y en ese orden.

### I.3.9 · Inmutabilidad

Los documentos ya emitidos **no se regeneran**. Un documento con
`formato_version = 1` no puede reimprimirse con el chasis nuevo: si se necesita
otro papel, se emite uno nuevo con fecha nueva. Alterar el aspecto de un
documento entregado —o firmado— no es una mejora visual, es una alteración
documental.

---

# SECCIÓN II — POR FORMATO

Esqueleto idéntico y obligatorio en los ocho. Un hueco se ve por comparación de
columnas, no por lectura.

**Ningún apartado de esta sección contiene `pt`, `mm`, `%` ni `#`.** Los
dígitos que aparecen cuentan contenido: 13 vías, 6 firmantes, 2 secciones. Si
un formato necesitara un número con unidad, el chasis está incompleto y se
arregla el chasis.

El inventario de campos proviene del Bloque 9 de `DOCUMENTOS_AUDITORIA.md`,
corregido con §8 del handoff y con `SPEC_DISENO_PARTE_B.md`. La columna «si
viene vacío» describe el comportamiento del componente `Campo` (I.2 · 2.E), no
la validación del formulario.

**Dos reglas que aplican a los ocho:**

1. **El título se almacena en capitalización de oración y se compone en
   mayúsculas** por transformación, no se almacena en mayúsculas. Las cadenas
   de abajo se escriben como se ven impresas (`CONCILIA D1`).
2. **Todos los formatos admiten subtítulo**, en `titulo.subtitulo`, bajo el
   título, en `titulo.subtitulo`. Colapsa si no viene. La versión anterior de
   este spec no lo inventariaba (`CONCILIA D2`).

---

## II.1 · Solicitud de Laboratorio

Arquetipo A. **El chasis desnudo.** Es el primero que se construye: si aquí
falla algo, el defecto es del chasis, no del formato.

### 1 · Identidad

| | |
|---|---|
| Título | `SOLICITUD DE LABORATORIO`, variante `fijo` |
| Folio | Sí |
| QR | **No** |
| Firmas | Una: médico tratante |

> **Decisión.** El título del sistema viejo era «Solicitud de Estudios de
> Laboratorio». Se acorta. La regla 1 de `TituloDocumento` exige que un título
> fijo quepa en un renglón, y el de Imagenología ya tuvo que acortarse por
> romper a dos líneas y desalinear el encabezado: el de Laboratorio es más
> largo todavía. Se cambia también en la app y en el nombre del archivo
> descargado (Paso 5), o el médico busca un documento que se llama distinto en
> pantalla y en disco.

> **Sin QR, por arquetipo.** Una solicitud no autoriza nada: en México los
> estudios se contratan sin solicitud médica. Un QR de verificación sugiere una
> autorización que el papel no otorga.

### 2 · Campos

| Campo | Requerido | Si viene vacío |
|---|---|---|
| `fecha` | No | Colapsa |
| `paciente` | **Bloquea emisión** | — |
| `diagnostico` | No | Colapsa |
| `estudios[]` | **Bloquea emisión** (al menos uno) | — |
| `notas` | No | Colapsa |

### 3 · Composición

`Membrete` completo → `TituloDocumento` fijo → `BloquePaciente` completo →
`RielDatos` una línea (fecha, diagnóstico) → lista de `EntradaNumerada` →
`ParserBloques` (notas) → `BloqueFirmas` amplia → `PieDocumento` completo.

`ContadorLista` con `<ÍTEMS>` = **ESTUDIOS**.

### 4 · Ancla de entrada

| Ranura | Contenido |
|---|---|
| `ancla` | Nombre del estudio |
| `secundario` | — colapsa |
| `marca` | — colapsa |
| `nota` | Indicación del estudio |

Es la entrada mínima del sistema: dos ranuras ocupadas. Que funcione así
demuestra que `EntradaNumerada` no necesita todas sus ranuras.

> `CONCILIA D3, D4` — el diseño lo compone como `Tabla` en modo grid de tres
> columnas y con dos calibraciones de fila según el número de estudios, sin
> umbral declarado. Es la misma `EntradaNumerada` con dos ranuras: **una sola
> calibración**, la de `entrada.*` de I.1.4. Un documento no cambia de cuerpo
> según cuántos ítems tenga (I.3.4).

### 5 · Excepciones

- **La lista es de una sola columna.** El renderer viejo dibujaba el encabezado
  de una segunda columna sin filas debajo (auditoría §8.2). No se repone.

### 6 · Verificación visible

Emitir con dos estudios y sin notas: se ven `01` y `02` en el riel izquierdo,
**no hay ninguna banda ni encabezado a la derecha de los nombres**, y bajo la
lista no queda ningún hueco donde estarían las notas — la firma sube.

---

## II.2 · Solicitud de Imagenología

Arquetipo A. Gemelo de Laboratorio con entrada de cuatro datos y badge.

### 1 · Identidad

| | |
|---|---|
| Título | `SOLICITUD DE IMAGENOLOGÍA`, variante `fijo` |
| Folio | Sí |
| QR | **No** — mismo argumento que II.1 |
| Firmas | Una: médico tratante |
| Badge | `BloqueNegativo` variante `urgente`, bajo el título |

El cambio de título aplica también a la app y al nombre del archivo descargado
(Paso 5).

### 2 · Campos

| Campo | Requerido | Si viene vacío |
|---|---|---|
| `fecha` | No | Colapsa |
| `paciente` | **Bloquea emisión** | — |
| `diagnostico` | No | Colapsa |
| `urgente` | No | Sin badge |
| `estudios[].tipo` | **Bloquea emisión**, en par con `region` | — |
| `estudios[].region` | **Bloquea emisión**, en par con `tipo` | — |
| `estudios[].proyecciones` | No | Colapsa |
| `estudios[].indicacion` | No | Colapsa |

### 3 · Composición

`Membrete` completo → `TituloDocumento` fijo → `BloqueNegativo` urgente →
`BloquePaciente` completo → `RielDatos` una línea (fecha, diagnóstico) → lista
de `EntradaNumerada` → `ParserBloques` (notas al servicio) → `BloqueFirmas`
amplia → `PieDocumento` completo.

`ContadorLista` con `<ÍTEMS>` = **ESTUDIOS**.

### 4 · Ancla de entrada

| Ranura | Contenido |
|---|---|
| `ancla` | Tipo · Región |
| `secundario` | Proyecciones |
| `marca` | — colapsa |
| `nota` | Indicación clínica **de ese estudio** |

Proyecciones e indicación colapsan **por separado**: una entrada puede tener
proyecciones sin indicación y al revés.

### 5 · Excepciones

- **`URGENTE` marca el documento, no el estudio.** Se repite en la variante
  `urgente reducido` en las hojas de continuación, porque en el servicio de
  imagen las hojas llegan separadas.
- **El diagnóstico va una sola vez, arriba.** La indicación clínica es por
  estudio y no lo repite.
- Un estudio con tipo pero sin región **hoy se descarta en silencio** del PDF.
  El formulario debe exigir el par (Paso 5); el render no inventa el faltante.

### 6 · Verificación visible

Emitir marcando urgente, con dos estudios de los que solo el primero tiene
proyecciones: el badge negro aparece **una sola vez, bajo el título**, la
entrada `01` muestra su renglón de proyecciones y la `02` **cierra sin dejar el
hueco** donde estaría.

---

## II.3 · Receta Médica

Arquetipo B. El más complejo y el de mayor volumen. Valida jerarquía de
entrada, bloque negativo, alarma, reglas de flujo y campo vacío requerido.

### 1 · Identidad

| | |
|---|---|
| Título | `RECETA MÉDICA`, variante `fijo` |
| Folio | Sí |
| QR | **Uno solo**, de verificación. El QR del blog sale |
| Firmas | Una: médico tratante |
| Membrete | Con **universidad emisora obligatoria** |

### 2 · Campos

| Campo | Requerido | Si viene vacío |
|---|---|---|
| `fecha` | No | Colapsa |
| `paciente` | **Bloquea emisión** | — |
| `diagnostico` | No | Colapsa |
| `medicamentos[]` | **Bloquea emisión** (al menos uno) | — |
| `medicamentos[].nombre_comercial` | No | Colapsa la primera mitad del ancla |
| `medicamentos[].presentacion` | No | **Vacío requerido: rótulo y línea** |
| `medicamentos[].via_administracion` | No, por defecto oral | Bloque de vía por defecto |
| `medicamentos[].principio_activo` | No | **Vacío requerido: rótulo `GENÉRICO` y línea** |
| `medicamentos[].indicacion` | No | Colapsa |
| `recomendaciones` | No | Colapsa el bloque de alarma entero |

### 3 · Composición

`Membrete` completo → `TituloDocumento` fijo → `BloquePaciente` →
lista de `EntradaNumerada` → `BloqueDestacado` alarma con `ParserBloques`
dentro → `ZonaQR` → `BloqueFirmas` simple → `PieDocumento`.

> `CONCILIA D17` — la `ZonaQR` va en el cuerpo de la última hoja, no dentro del
> pie. La versión anterior de este spec decía «`PieDocumento` completo con QR».
> Aplica igual a II.4 y II.5.

`ContadorLista` con `<ÍTEMS>` = **MEDICAMENTOS**.

### 4 · Ancla de entrada

| Ranura | Contenido |
|---|---|
| `ancla` | Comercial · Presentación y gramaje, **al mismo peso alto** |
| `secundario` | Denominación genérica, cuerpo menor, **tinta plena** |
| `marca` | Vía de administración, `BloqueNegativo` |
| `nota` | Indicación, en humanista |

**La jerarquía va invertida respecto del sistema viejo.** El gramaje es dato de
seguridad: es lo que más se equivoca en el mostrador, así que sube al ancla.

### 5 · Excepciones

- **Trece vías**, todas en bloque negativo: oral, sublingual, tópica,
  transdérmica, oftálmica, ótica, nasal, inhalación, intramuscular,
  intravenosa, subcutánea, rectal, vaginal. **`parenteral` no es vía**: es la
  categoría que agrupa intravenosa, intramuscular y subcutánea. Fuera del
  catálogo (Paso 5).
- **El genérico vacío se compone con rótulo y línea, sin leyenda de error.** Ni
  «falta dato obligatorio» ni nada equivalente impreso.
- **Bug conocido:** hoy se puede emitir una receta sin ningún medicamento,
  porque el filtro previo al PDF es sobre el nombre comercial. El formulario
  debe exigir al menos uno (Paso 5).
- **La leyenda `Vía no oral en negativo` no se imprime.** Es notación de la
  lámina de prueba que quedó dentro del documento aprobado, y además está en
  IBM Plex Mono, que no es familia del sistema (`CONCILIA D13`).
- **El bloque de alarma usa `alarma.cuerpo`**, un punto por encima del texto
  corrido. Es el único cuerpo con ventaja declarada sobre `texto.corrido`
  (`CONCILIA D16`).
- Rótulo de la firma: `FIRMA Y SELLO DEL MÉDICO`, igual que en las dos
  solicitudes (`CONCILIA D14`).

### 6 · Verificación visible

Emitir con tres medicamentos, uno de ellos sin principio activo y con vía
intramuscular: el `02` muestra el rótulo `GENÉRICO` sobre una línea llenable a
pluma, y su bloque de vía es **visiblemente más ancho** que el de los orales.
Fotocopiar: los genéricos de los otros dos se leen **tan negros** como sus
nombres comerciales.

---

## II.4 · Plan de Suplementación

Arquetipo B. Hereda casi todo de Receta. **Valida que la variante con menos
ranuras ocupadas funcione sin componente paralelo.**

### 1 · Identidad

| | |
|---|---|
| Título | `PLAN DE SUPLEMENTACIÓN`, variante `fijo` |
| Folio | Sí |
| QR | Sí, de verificación |
| Firmas | Una: médico tratante |

### 2 · Campos

| Campo | Requerido | Si viene vacío |
|---|---|---|
| `fecha` | No | Colapsa |
| `paciente` | **Bloquea emisión** | — |
| `diagnostico` | No | Colapsa |
| `pesoKg` | No | **Colapsa la celda `BASE DEL CÁLCULO`.** Las dosis se imprimen igual |
| `seleccionados[]` | **Bloquea emisión** (al menos uno) | — |
| `seleccionados[].dosis` | No | Colapsa la segunda mitad del ancla |
| `seleccionados[].justificacion` | No | Colapsa |
| `notas` | No | Colapsa |
| `seguimiento` | No | Colapsa el bloque de cita entero |

### 3 · Composición

`Membrete` completo → `TituloDocumento` fijo → `BloquePaciente` con celda de
peso → lista de `EntradaNumerada` → `ParserBloques` (notas) → `BloqueDestacado`
cita → `ZonaQR` → `BloqueFirmas` simple → `PieDocumento`.

`ContadorLista` con `<ÍTEMS>` = **SUPLEMENTOS**.

Junto al título de la lista va el rótulo `Dosis calculada para NN kg`, que
colapsa con el peso.

### 4 · Ancla de entrada

| Ranura | Contenido |
|---|---|
| `ancla` | Nombre · Dosis |
| `secundario` | — colapsa |
| `marca` | — colapsa |
| `nota` | Justificación |

**Sin vía, sin presentación, sin genérico.** Es la misma `EntradaNumerada` de
Receta con dos ranuras vacías. Si alguien crea un componente aparte para esto,
el chasis está mal.

### 5 · Excepciones

- El peso vive en el riel de paciente con rótulo `BASE DEL CÁLCULO`, no en la
  lista.
- **Deuda de producto conocida:** es el único formato cuyo registro en base de
  datos es condicional a que haya paciente asociado. Sin paciente el PDF se
  entrega pero no queda registro. No es del render; se resuelve en el
  formulario.

### 6 · Verificación visible

Emitir el mismo plan dos veces, con peso y sin peso. Con peso: la celda
`BASE DEL CÁLCULO` aparece en el riel y el rótulo `Dosis calculada para NN kg`
junto al título de la lista. Sin peso: **desaparecen los dos y las celdas
restantes del riel se ensanchan hasta llenarlo**, y las dosis impresas son las
mismas.

---

## II.5 · Recibo de Honorarios / Cotización

Arquetipo E. Único formato con lógica de cálculo.

### 1 · Identidad

| | |
|---|---|
| Título | `RECIBO DE HONORARIOS` o `COTIZACIÓN`, variante `fijo` con dos valores |
| Folio | Sí, autogenerado |
| QR | Sí, de verificación |
| Firmas | Una: médico tratante |

> El título tiene dos valores porque el documento tiene dos usos, pero **no es
> la variante `variable`**: el médico no lo escribe, lo selecciona. La variante
> `variable` es exclusiva de Escrito Médico.

La leyenda `Documento informativo — no es comprobante fiscal (CFDI)` va en
jerarquía visible, **no en gris pequeño al pie**.

### 2 · Campos

| Campo | Requerido | Si viene vacío |
|---|---|---|
| `tipoDoc` | No, por defecto honorarios | Título de honorarios |
| `fecha` | No | Colapsa |
| `paciente` | **No** — único formato donde no lo es | Colapsa |
| `aseguradora.nombre` | No | Colapsa el riel de seguro entero |
| `aseguradora.poliza` | No | Colapsa la celda |
| `aseguradora.cobertura` | No | Colapsa la celda |
| `lineas[].concepto` | **Bloquea emisión** (al menos una) | — |
| `lineas[].precio` | **Bloquea emisión**, mayor que cero | — |
| `formaPago` | No | Colapsa. No aplica a cotización |
| `divisa` | No, por defecto MXN | — |
| `notas` | No | Colapsa |

### 3 · Composición

`Membrete` completo → `TituloDocumento` fijo → `BloquePaciente` →
`RielDatos` de aseguradora → lista de `EntradaNumerada` → `RielImportes` →
`ParserBloques` (notas) → leyenda de no fiscal → `ZonaQR` →
`BloqueFirmas` simple → `PieDocumento`.

`ContadorLista` con `<ÍTEMS>` = **CONCEPTOS**.

### 4 · Ancla de entrada

| Ranura | Contenido |
|---|---|
| `ancla` | Concepto · Importe |
| `secundario` | — colapsa |
| `marca` | — colapsa |
| `nota` | — colapsa |

Los importes usan **cifras tabulares**, alineadas por la unidad. Es el único
formato donde una columna de números tiene que sumar visualmente.

### 5 · Excepciones

- **Único formato donde el paciente no es obligatorio.** Cuando falta, colapsa;
  no imprime un guion ni una línea, porque nadie va a llenarlo a mano.
- Es donde vive el aviso `RESERVADO PARA LA FIRMA` con más frecuencia: el
  documento suele ser corto y el total cae cerca del final de la caja.
- **Las notas van en bandera izquierda**, no justificadas con partición como
  hoy (`CONCILIA D28`).
- Las cajas de aseguradora, leyenda no fiscal y declaración van con
  **`MarcoParcial`** (2.U), el dispositivo gráfico del chasis (`CONCILIA D26`).
  **No son bloques destacados** y `BloqueDestacado` no tiene variante `acento`:
  las tres envuelven anatomías distintas —la de aseguradora es un `RielDatos`, la
  leyenda es una declaración de dos líneas— y el marco va en acento, no en
  `tinta.negra`. La sangría de las tres queda por medir (2.U regla 4).

### 6 · Verificación visible

Emitir una cotización con cuatro conceptos de importes de distinta longitud: el
título dice `COTIZACIÓN`, **no aparece forma de pago**, y los cuatro importes
quedan alineados por la unidad, no por la izquierda. Cambiar a recibo: el
título cambia y aparece la forma de pago, sin que se mueva nada más.

---

## II.6 · Solicitud de Internamiento

Especial. **Dos secciones, dos lectores.** Valida `ParserBloques` en producción
y la transición de sección.

### 1 · Identidad

| | |
|---|---|
| Título | `SOLICITUD DE INTERNAMIENTO`, variante `fijo` |
| Folio | Sí, **en todas las hojas** |
| QR | **No** |
| Firmas | Sección 1: paciente y médico. Sección 2: solo médico |
| Badge | `BloqueNegativo` variante `urgente` |

**Sección 1** la leen el paciente y Admisión. **Sección 2** la leen enfermería y
el residente.

### 2 · Campos

| Campo | Requerido | Si viene vacío |
|---|---|---|
| `fecha` | No | Colapsa |
| `paciente` | **Bloquea emisión** | — |
| `fechaIngreso` | No | Colapsa |
| `tipoInternamiento` | No | Colapsa |
| `diasEstimados` | No | Colapsa |
| `asa` | No | Colapsa |
| `lugar` | **Bloquea emisión** | — |
| `urgente` | No | Sin badge |
| `diagnostico` | **Bloquea emisión** | — |
| `diagnosticosSecundarios[]` | No | Colapsa |
| `procedimiento` | No | Colapsa |
| `requerimientos[]` | No | Colapsa el riel entero |
| `justificacion` | No | Colapsa |
| `instruccionesPaciente` | No, prellenado | Colapsa el bloque destacado |
| `indicacionesPiso` | No | **Colapsa la sección 2 entera** |

### 3 · Composición

**Sección 1** — `Membrete` completo → `TituloDocumento` fijo →
`BloqueNegativo` urgente → `BloquePaciente` completo → `RielDatos` de ingreso →
diagnósticos y procedimiento → `RielDatos` de requerimientos, variante
`sin contador` → `ParserBloques` (justificación) → `BloqueDestacado`
instrucciones con lista **numerada** → `BloqueFirmas` amplia con dos firmas.

**Transición** — `AperturaSeccion` (2.Q). La cabecera dice `SECCIÓN 2 DE 2`,
**nunca «continuación»**.

**Sección 2** — `BloquePaciente` reducido → `ParserBloques` (indicaciones de
ingreso a piso) → `BloqueFirmas` amplia con una firma.

`PieDocumento` completo en todas las hojas.

### 4 · Ancla de entrada

No usa `EntradaNumerada`. Sus listas salen de `ParserBloques` y de `RielDatos`.

### 5 · Excepciones

- **Folio, paginación y `BloquePaciente` reducido en TODAS las hojas.** En el
  hospital las hojas se separan: una hoja de indicaciones sin nombre de
  paciente es un riesgo de seguridad, no un descuido de maquetación. El sistema
  viejo emitía la página 2 casi vacía y sin nombre (auditoría §8.3).
- **Requerimientos especiales sin contador:** el catálogo es abierto, el médico
  agrega y quita. Un total sería una cifra falsa.
- **Instrucciones al paciente con lista numerada**, no con raya: primero
  presentarse, después el ayuno. La secuencia significa.
- El textarea de indicaciones necesita una nota que explique que un renglón sin
  viñeta crea un bloque (Paso 5). Sin eso la sintaxis existe y nadie la usa.
- **La raya de ítem se compone en `fuente.neogrotesca`**, no en IBM Plex Mono
  como hoy. Es la única aparición de la mono como contenido y no como notación
  (`CONCILIA D30`).

### 6 · Verificación visible

Emitir con indicaciones de piso escritas como dos renglones de prosa seguidos
de un encabezado con sus viñetas. La sección 2 empieza con un **filete
claramente más grueso que cualquier otro del documento**, su cabecera dice
`SECCIÓN 2 DE 2`, lleva el nombre del paciente arriba, y **los dos primeros
renglones salen en minúsculas y sin raya**. Separar la hoja 2 de la hoja 1: por
sí sola identifica paciente, folio y página.

---

## II.7 · Consentimiento Informado

Arquetipo D. Multipágina, hasta seis firmas. Valida el piso de la escala de
firmas y el ciclo de vida del documento.

### 1 · Identidad

| | |
|---|---|
| Título | `CARTA DE CONSENTIMIENTO INFORMADO`, variante `fijo` |
| Folio | Sí, en todas las hojas |
| QR | **Sí**, `ZonaQR` en la última hoja |
| Firmas | Cinco firmantes → `BloqueFirmas` variante `retícula`, repartido en dos hojas |
| Marca de estado | **Sí**, `MarcaEstado` (2.S) |

**Las cuatro decisiones de conciliación de este formato:**

> `CONCILIA D32` — el título es `CARTA DE CONSENTIMIENTO INFORMADO`, no
> `CONSENTIMIENTO MÉDICO INFORMADO` como imprime el diseño. La NOM-004 usa
> «carta de consentimiento informado» como término del expediente, y este es el
> documento que más se lee en sede legal: que su título coincida con el de la
> norma pesa más que la preferencia tipográfica.
>
> `CONCILIA D37, D35` — se adopta `firma.espacio` único de 77 pt y se retira el
> tramo de 28 pt, que ningún archivo instancia. El médico **sí** imprime su
> rúbrica renderizada, como ya hace el archivo aprobado.
>
> `CONCILIA D33` — el texto corrido pasa a `texto.corrido` (11.5 / 18) en
> bandera izquierda y medida `caja.ancho`. Hoy va a 10.5 / 16 justificado con
> partición en 381 pt, y nunca recibió la corrección. **Consecuencia: el
> documento repagina entero y su número de hojas puede cambiar.** No es un
> ajuste tipográfico.
>
> `CONCILIA D36` — lleva `ZonaQR` y `MarcaEstado`, aunque el diseño no los
> instancie. Es el documento donde la verificación por un tercero —aseguradora,
> CONAMED— tiene más valor, y los cuatro estados estaban comprometidos desde la
> partición en dos entregas para no rediseñarlo dos veces.

### 2 · Campos

| Campo | Requerido | Si viene vacío |
|---|---|---|
| `lugar`, `fecha`, `paciente`, `edad` | **Bloquean emisión** | — |
| `procedimiento`, `diagnostico`, `familiar` | **Bloquean emisión** | — |
| `expediente` | No | Colapsa |
| `idPaciente`, `idFamiliar` | No | Colapsa |
| `representante`, `idRepresentante` | No | Colapsa |
| `anestesiologo` | **Eliminado del formato** | — |
| `testigo1`, `testigo2` | No | **La firma permanece**: los dos testigos son fijos por NOM-004 |
| `autorizaTransfusion` | No, tri-estado | Colapsa si no se respondió |
| `autorizaFotos` | No | Colapsa |
| `secciones.descripcion` | **Bloquea emisión** | — |
| `secciones.riesgosEspecificos` | **Bloquea emisión** | — |
| Las otras cinco secciones | No, prellenadas | Colapsa la sección |
| `imprimirDenegacion` | No | Sin hoja de denegación |

### 3 · Composición

`Membrete` completo → `TituloDocumento` fijo → `BloquePaciente` →
siete `EncabezadoSeccion` con su texto corrido → autorizaciones →
`BloqueFirmas` retícula, repartido en dos hojas → `ZonaQR` → `PieDocumento`.
Hoja de denegación o revocación al final, opcional. Hoja de anexo de
identificaciones al final, segunda entrega.

`BloquePaciente` reducido en todas las hojas de continuación.

### 4 · Ancla de entrada

No usa `EntradaNumerada`. Es el formato de texto corrido más extenso del
sistema: su carga cae sobre las reglas de viudas y huérfanas.

### 5 · Excepciones

- **El anestesiólogo salió del formato.** Quedan cinco firmantes: paciente,
  familiar responsable, testigo 1, testigo 2 y médico tratante. Los dos testigos
  siguen siendo fijos por NOM-004: un testigo sin nombre deja su línea para
  firmar a mano (`CONCILIA D-anestesiólogo`).
- **El bloque de motivo va con `MarcoParcial`** (2.U), no con borde en los cuatro
  lados y fondo como hoy. El chasis solo declara marcos parciales
  (`CONCILIA D34`). Es el mismo dispositivo que enmarca las tres cajas del Recibo:
  D26 y D34 eran el mismo objeto visto desde dos formatos.
- La bandera `identificacion` por firmante es código muerto: el marcado ya no
  la lee. Se retira al implementar (`CONCILIA D38`).
- **La marca de estado sustituye a la marca de agua de logo**, que queda
  prohibida en el área de contenido (I.3.2). Los cuatro estados se reservan
  ahora aunque la captura de firmas llegue en la segunda entrega, o el formato
  se rediseña dos veces.
- El documento sellado guarda el **texto consentido congelado**. No contradice
  la regla del consultorio activo: los datos de presentación son siempre
  vigentes, la evidencia se congela.
- Hoja de anexo `ANEXO — IDENTIFICACIÓN DE FIRMANTES` al final, cuando existan
  identificaciones capturadas. Segunda entrega.

### 6 · Verificación visible

Emitir un consentimiento con anestesiólogo y otro sin él, ambos con los dos
testigos vacíos. En los dos, **las líneas de los testigos siguen ahí, listas
para firmarse a mano**; la del anestesiólogo solo aparece en el primero. Poner
la hoja de firmas junto a una receta: **la rúbrica del médico es aquí
visiblemente más baja**. Contar: ninguna hoja carece de folio ni de paginación.

---

## II.8 · Escrito Médico

Especial. **El chasis más desnudo.** Valida título variable, pie sin folio y la
escala del cuerpo viniendo del editor.

### 1 · Identidad

| | |
|---|---|
| Título | Variante **`variable`**. Lo escribe el médico. Variante `ausente` si no lo pone |
| Folio | **No. Único formato sin folio** |
| QR | **No** |
| Firmas | Una: médico tratante |
| Pie | `PieDocumento` variante **`sin folio`**: paginación · título · leyenda |

> **Declarado para que nadie lo reponga.** El Escrito Médico no es un documento
> seriado: es una hoja membretada multiuso —certificado, constancia, carta de
> recomendación, resumen para un colega—. Sin folio no hay identificador humano
> que mostrar en la página de verificación, y por eso tampoco lleva QR. Si
> alguien agrega folio «por consistencia», está inventando una serie que no
> existe.

### 2 · Campos

| Campo | Requerido | Si viene vacío |
|---|---|---|
| `fecha` | No | Colapsa |
| `paciente` | **No** | Colapsa el bloque de paciente entero |
| `titulo` | No | `TituloDocumento` variante `ausente` |
| Cuerpo (editor) | **Bloquea emisión** | — |

### 3 · Composición

`Membrete` completo con fecha en el encabezado → `TituloDocumento` variable →
`BloquePaciente` completo, si hay paciente → cuerpo en texto corrido →
`BloqueFirmas` amplia → `PieDocumento` sin folio.

### 4 · Ancla de entrada

No usa `EntradaNumerada`. Las listas del cuerpo vienen del editor, no de
`ParserBloques`.

### 5 · Excepciones

- **La fecha va en el encabezado, a la derecha, sin rótulo**, en
  `fecha.encabezado`, en forma corta (`4 ago 2026`). Sin lugar. Se alinea por
  línea base con la **primera** línea del título. En las hojas de continuación
  el diseño la rotula `Emisión` y le cambia el cuerpo; **se unifica al
  tratamiento de la hoja 1** (`CONCILIA D40`).
- Toda referencia a «fecha en el pie», «columna auto de la fecha», «elipsis del
  título» o «retícula de cuatro celdas» pertenece a la serie descartada de seis
  rondas y **no se implementa** (`CONCILIA D39`).
- **La línea formal de lugar y fecha la escribe el médico dentro del cuerpo**,
  según lo que exija el trámite. El sistema no la impone.
- Sin título, el filete del membrete hace doble trabajo: cierra el membrete y
  abre el cuerpo, que arranca a `transicion.tituloRiel` bajo él: sin título no
  hay riel de identificación que separar, y el cuerpo ocupa ese sitio.
- El cuerpo viene de un editor con soporte markdown. **Hay errores de detección
  de caracteres pendientes de revisar en código**, dentro del alcance de este
  formato.
- Único formato que puede emitirse sin nombre de paciente además de Honorarios.
- **`tituloPie` es un campo aparte, no un truncado automático del título.**
  Puede diferir del título del encabezado. Es cambio de formulario, no de render
  (`CONCILIA D41`).
- La variante `cita` de `BloqueDestacado` lleva aquí solo filete izquierdo y en
  Suplementación superior e izquierdo. Se unifica a **solo izquierdo**, que es
  lo que la distingue de la alarma (`CONCILIA D42`).

### 6 · Verificación visible

Emitir tres veces el mismo texto. Con título corto: la fecha se alinea con él.
Con título de unos sesenta caracteres: rompe a dos líneas y **la fecha queda
alineada con la primera**. Sin título: **el cuerpo arranca directamente bajo el
filete del membrete, sin banda vacía**. En los tres, revisar el pie de todas las
hojas: **no aparece ningún folio en ninguna parte**.

---

# ANEXO A — Las 44 divergencias, resueltas

Numeración de `SPEC_DISENO_PARTE_B.md`. Tres criterios de resolución:

- **CHASIS** — el diseño derivó entre rondas y hay varios valores para un mismo
  rol. Se colapsa a uno. No es una decisión de diseño: es lo que la capa de
  tokens existe para hacer.
- **DISEÑO** — este spec estaba mal. Se corrige contra el archivo aprobado.
- **DECIDIDO** — había una decisión real abierta. Se resolvió y queda su
  argumento en la ficha correspondiente.

| # | Resolución | Gana | Dónde queda |
|---|---|---|---|
| D1 | Título en capitalización de oración, compuesto en mayúsculas | DISEÑO | II preámbulo |
| D2 | El subtítulo existe y se inventaría en los ocho | DISEÑO | II preámbulo · `titulo.subtitulo` |
| D3 | `EntradaNumerada` con ancla y nota, no `Tabla` | CHASIS | II.1 §4 |
| D4 | Una sola calibración de fila. Un documento no cambia de cuerpo según cuántos ítems tenga | CHASIS | II.1 §4 · I.3.4 |
| D5 | Tres formas canónicas de aviso, sin construcciones propias | CHASIS | 2.N |
| D6 | Un riel de siete celdas, no dos rieles | DISEÑO | 2.D |
| D7 | `medico.nombre` = 26 / 28 pt | CHASIS | I.1.4 |
| D8 | `texto.corrido` = 11.5 / 18 pt | CHASIS | I.1.4 |
| D9 | `firma.credencial` = Archivo 7.5 / 11, `tinta.secundaria` | CHASIS | I.1.4 |
| D10 | `ParserBloques` recibe una cadena, nunca un array | CHASIS | 2.J |
| D11 | `entrada.numero` = 13 / 17 pt. Eran seis valores | CHASIS | I.1.4 |
| D12 | `manuscrito.alto` = 20 pt, `manuscrito.ancho` = 246 pt | CHASIS | I.1.5 |
| D13 | La leyenda de vía **no se imprime**. Era notación de la lámina | CHASIS | II.3 §5 |
| D14 | `FIRMA Y SELLO DEL MÉDICO` en los tres formatos | CHASIS | II.3 §5 |
| D15 | Sangría de `BloqueDestacado` = `espacio.16` | CHASIS | 2.I |
| D16 | Alarma a 12 / 18 pt, peso 500. Token declarado | DISEÑO | II.3 §5 |
| D17 | `ZonaQR` vive en el cuerpo de la última hoja | DISEÑO | 2.R · II.3 §3 |
| D18 | `MarcaEstado` a 22 pt, −9°, contorno `filete.regla` | CHASIS | 2.S |
| D19 | Suplementación imprime 11.5 / 18. La ficha vieja decía otra cosa | CHASIS | I.1.4 |
| D20 | Sin IBM Plex Mono en documento impreso | CHASIS | I.1.4 |
| D21 | Sangría única de `espacio.16` en las tres variantes | CHASIS | 2.I |
| D22 | `SIN FIRMA NO ES VÁLIDO`, invariable | CHASIS | 2.N |
| D23 | Los ocho formatos llevan membrete completo con cédulas | CHASIS | 2.B · I.3.7 |
| D24 | El Recibo instancia `ContadorLista` con CONCEPTOS | CHASIS | 2.K · II.5 §3 |
| D25 | `acento.velo` = 6 %. Máximo de fondo tenue 12 % | CHASIS | I.1.8 |
| D26 | El marco en acento del Recibo es `MarcoParcial` (2.U), **no una variante de `BloqueDestacado`** | DISEÑO | II.5 §5 · **2.U** |
| D27 | `manuscrito.alto` = 20 pt. Eran tres valores | CHASIS | I.1.5 |
| D28 | Notas del Recibo en bandera izquierda | CHASIS | II.5 §5 · I.3.2 |
| D29 | `firma.nombre` = 11.5 / 16 pt | CHASIS | I.1.4 |
| D30 | La raya de ítem en `fuente.neogrotesca` | CHASIS | II.6 §5 |
| D31 | `AperturaSeccion` pasa a ser componente | DISEÑO | 2.Q |
| D32 | `CARTA DE CONSENTIMIENTO INFORMADO`, término de la NOM-004 | **DECIDIDO** | II.7 §1 |
| D33 | Consentimiento a 11.5 / 18, bandera izquierda, 486 pt. **Repagina** | **DECIDIDO** | II.7 §1 |
| D34 | Marco parcial, no borde de cuatro lados con fondo | CHASIS | II.7 §5 · **2.U** |
| D35 | El médico **sí** imprime rúbrica. Se revoca la instrucción contraria | **DECIDIDO** | I.1.9 · II.7 §1 |
| D36 | El Consentimiento lleva `ZonaQR` y `MarcaEstado` | **DECIDIDO** | II.7 §1 |
| D37 | `firma.espacio` único de 77 pt. Se retira el tramo de 28 | **DECIDIDO** | I.1.9 |
| D38 | La bandera `identificacion` es código muerto. Se retira | DISEÑO | II.7 §5 |
| D39 | La serie descartada de la fecha no se implementa | DISEÑO | II.8 §5 |
| D40 | Fecha sin rótulo también en hojas de continuación | CHASIS | II.8 §5 |
| D41 | `tituloPie` es campo aparte. Cambio de formulario | DISEÑO | II.8 §5 · Paso 5 |
| D42 | Variante `cita` con filete solo izquierdo | CHASIS | II.8 §5 |
| D43 | `umbral.firma` = 200.8 pt, por fórmula. 185 y 189.8 quedan muertos | CHASIS | I.1.9 |
| D44 | Cuatro bloques indivisibles, no tres | CHASIS | 2.N |

**Cuatro más que no venían numeradas y también se resolvieron:** las dos
retículas conviviendo (I.1.3), la escala de nueve filetes (I.1.6), el alcance de
la escala de espaciado (I.1.7) y el interlineado de la etiqueta de folio
(I.1.4).

## Correcciones posteriores a la conciliación

Salieron todas de **ejecutar** el spec con el anexo A ya cerrado: las `P1-*` de
transcribir I.1 a la capa de tokens (Paso 1), las `P2-*` de construir los
componentes de I.2 (Paso 2). No son divergencias entre el diseño y este spec:
son defectos del propio spec que solo se ven cuando el valor se ejecuta. Se
registran aquí para que nadie las lea como reinterpretaciones ni intente
«restaurar» lo anterior.

| # | Corrección | Por qué apareció al implementar | Dónde queda |
|---|---|---|---|
| P1-1 | El bloque de firma mide **130.8 pt**, no 131.8, y el umbral **200.8**, no 201.8. Era doble conteo de `filete.fino` | La fórmula, implementada, daba los tres roles 1 pt por debajo de su valor declarado, con desfase constante | I.1.9 · A D43 |
| P1-2 | Las nueve separaciones entre bloques pasan de prosa sin nombre a tokens con nombre, grupo `transicion.*` | Sin nombre de token, el paso de componentes las habría escrito como literales, que es lo que I.1 prohíbe | I.1.7 · 2.C |
| P1-3 | **`espacio.20` retirado.** Su único uso pasa a `transicion.tituloRiel` | Se instanciaba en dos sitios sin ser miembro de la escala de ocho: no había nada que importar | I.1.7 · 2.C · II.8 §5 |
| P2-1 | **El logo llena el círculo interior y se recorta a él.** Retiradas la «caja útil del logo» de 33 × 19 pt y la regla de no recortar | Al construir 2.A se comparó contra v1: el spec describía un comportamiento que la app nunca tuvo y que deja el logo en un cuarto del panel | 2.A |
| P2-2 | **La lista de tokens de 2.B era de antes de la escala tipográfica.** Fuera `etiqueta.*` y `dato.cuerpo`, que el membrete no usa; dentro los tres roles `medico.*`. Declarado el rol de la universidad, que faltaba | Al construir 2.B, los roles que el componente necesitaba no estaban en su propia lista y los que estaban no tenían contenido que los usara | 2.B |
| P2-3 | **El consultorio activo se lee en el sitio que construye el documento, no dentro de `Membrete`.** El invariante sigue siendo una lectura por documento | `pdf()` monta su árbol fuera de los providers: un `useContext` en el componente devolvería el valor por defecto e imprimiría el consultorio equivocado en silencio | I.3.6 · 2.B regla 1 |
| P2-4 | **La hifenación queda desactivada en el registro de fuentes de v2.** No es preferencia tipográfica: es lo que impide que la denominación genérica de una receta salga partida con guion y falle el gate de I.3.1 | El taller imprimió `RECOMEN-DACIONES` en cuanto un título rompió a dos líneas. v1 ya lo desactivaba por otra causa —la corrupción de acentuados— y el spec no lo declaraba en ninguna parte | I.3.8 · `v2/fonts.ts` |
| P2-5 | **El desplazamiento entre las líneas base de la fecha y del título es de 1.976 pt y se declara como geometría derivada de 2.C**, en forma de fórmula. No se corrige | La regla 3 pide alinear por línea base y react-pdf no expone ninguna: hay que alinear bordes inferiores de caja de línea, y eso deja un residuo que sin declarar se lee como defecto y alguien intenta parchearlo con un valor duro | 2.C · I.3.8 |
| P2-6 | **El subtítulo se declara en la ficha de 2.C**, con separación `espacio.4` respecto del título. Corregida de paso la lista de tokens de 2.C, que anotaba `tinta.secundaria` «(fecha)»: la fecha va en `tinta.etiqueta` y la secundaria es del subtítulo | D2 lo inventarió para los ocho formatos pero ninguna ficha lo alojaba, así que al construir 2.C hubo que implementarlo sin separación declarada — es decir, a merced del interlineado de dos roles | 2.C · II preámbulo |
| P2-7 | **La celda de diagnóstico de 2.D queda declarada entera**: IBM Plex Sans 11 / 16, peso 400, tracking 0, `tinta.negra`. Y queda dicho que NO sube a I.1.4: es geometría interna del componente | La ficha declaraba familia, cuerpo e interlineado y callaba los otros tres, así que al construir 2.D hubo que suponerlos. Una suposición que solo vive en un comentario del código es un hueco del spec que únicamente ve quien abre el archivo | 2.D |
| P2-8 | **`flexBasis` es de caja de contenido y `width` de caja de borde.** Un riel de celdas se compone con `width` + `flexGrow`, nunca con `flexBasis: 0` + `flexGrow` | El reparto proporcional «obvio» dejó la celda de paciente de 2.D en 188.54 pt en vez de 202.5: el padding y la regla se suman por fuera del basis. El riel sigue sumando 486 y sin hueco, así que el defecto no se ve mirando — solo midiendo | I.3.8 · 2.D |
| P2-9 | **La lista de tokens de 2.E pedía fragmentos de rol** —`etiqueta.cuerpo`, `etiqueta.tracking`, `dato.cuerpo`—, que no existen. Pasa a los roles completos `etiqueta` y `dato` | Tercera vez que aparece la misma lista pre-escala, tras 2.B (P2-2) y 2.C (P2-6). I.1.4 declara roles, no fragmentos: un rol se consume entero | 2.E |
| P2-10 | **Los dos estados con tinta de 2.E no miden lo mismo: 27 y 31 pt.** La diferencia de 4 pt se declara, con su motivo, y se declara también que el ESTADO se resuelve dentro del componente en vez de entrar por prop | Al construir 2.E hubo que decidir si el espacio de escritura se comprimía a un renglón de texto para igualar alturas. No se comprime —I.1.5 e I.3.4—, pero sin declararlo el siguiente que componga una fila de campos mixtos va a leer los 4 pt como defecto de alineación | 2.E |
| P2-11 | **Barrido de las listas de tokens de las quince fichas restantes (2.F a 2.T)**, cruzadas contra los nombres reales de I.1. Seis fichas citaban fragmentos de rol o comodines, seis no tenían lista, 2.F apoyaba el riel en la retícula equivocada, 2.I citaba un `filete.instrucciones` inexistente y 2.P escribía como cifras sueltas las dos transiciones que I.1.7 había nombrado para ella. **De paso apareció una cuarta ficha ya implementada con el mismo defecto, 2.D**, que el barrido no cubría. Las once piezas sin rol quedan listadas en I.1.4, señaladas y sin resolver — **se cierran en P2-14**, salvo una | Tres de las cinco fichas ya implementadas —2.B, 2.C y 2.E— traían la misma lista pre-escala, y al barrer resultaron ser cuatro. No es casualidad: son listas escritas antes de que I.1.4 existiera, que sobrevivieron a la conciliación porque nadie las cruzó contra ella. Barrerlas de golpe cuesta una sesión; tropezar quince veces cuesta quince | I.1.4 · 2.D · 2.F a 2.T |
| P2-12 | **Las tres «variantes» de 2.F no eran tres alternativas.** `celdas` y `una línea` componen y se excluyen; `sin contador` es una propiedad ortogonal que no cambia el render y que lee 2.K. Y `una línea` **pierde un consumidor**: la línea fina del membrete no es un `RielDatos` | Al implementar 2.F hubo que elegir un tipo para sus props y las tres variantes no formaban una unión: un riel puede ser `celdas` y `sin contador` a la vez. Al buscar el segundo consumidor de `una línea` resultó que el del membrete no tiene rótulos, ni anchos de `riel.celda`, ni el rol `dato` | 2.F · 2.B |
| P2-13 | **La composición del riel baja de la ficha de 2.D a la de 2.F**: padding `8 10 10`, reglas, filetes de apertura y cierre y reparto de anchos. 2.D conserva solo sus siete celdas y sus dos excepciones tipográficas. Y la regla superior va en toda fila que no sea **la primera viva**, no «la segunda» | 2.D declaró el riel porque lo necesitó antes de que 2.F existiera. Dejar la declaración en las dos fichas es la divergencia que I.3.5 persigue. El matiz de «la primera viva» aparece solo al implementar el colapso: con la fila de arriba colapsada, «la segunda fila» deja una regla flotando bajo el filete de apertura | 2.F · 2.D |
| P2-14 | **Cerrados diez de los once huecos de rol de I.1.4, derivando del spec y sin inventar ninguno.** Ninguno necesitó un token nuevo: los valores ya estaban, sin nombre asignado. Salió de ahí un patrón que faltaba nombrar —la **desviación declarada de un rol**, tabla nueva en I.1.4— que ya practicaban 2.D, 2.H y 2.M sin llamarla así. **H9 queda `NO DEFINIDO`**, y con él el aire entre entradas de 2.G, que apareció al cerrar H4 — **los dos se cierran midiendo en P2-23** | Diez huecos y cero tokens nuevos es la comprobación de que eran huecos de **nombre**, no de valor: el diseño ya los tenía resueltos y lo que faltaba era cruzarlos contra la escala. Los dos que no se cierran son los dos que exigen medir una hoja aprobada, que es información que este documento no contiene | I.1.4 · 2.G · 2.I · 2.J · 2.K · 2.M · 2.N · 2.Q · 2.S · 2.T |
| P2-15 | **2.H declaraba `espacio.4` y `espacio.8` sin decir cuál iba dónde, y una variante `urgente reducido` sin decir qué reduce.** Cierran las dos juntas: padding `4` vertical y `8` horizontal en `via` y `urgente`; `4` por los cuatro lados en la reducida. **Lo que se reduce es el aire, nunca el cuerpo** | Al implementar 2.H hubo que escribir un padding, y las tres variantes no se distinguían en nada: con el cuerpo y el tracking congelados por la regla 2 y el texto entero por la 1, el aire es lo único que una variante puede cambiar. Una variante que no cambia nada es una variante que el primer implementador borra | 2.H |
| P2-16 | **La sangría de 2.I se aplica a los dos filetes de la variante `alarma`**, no solo al izquierdo. Y **la cadena `URGENTE` es del componente 2.H, no del formato**: II declara un booleano, no un texto | La regla 2 de 2.I dice «el filete» en singular y `alarma` tiene dos: sin cerrarlo, el texto queda pegado al filete de 3 pt. Lo de 2.H apareció al elegir el tipo de sus props: si el texto entrara por prop, una hoja de continuación podría imprimir `URG.`, que es lo que prohíbe su regla 1 | 2.H · 2.I |
| P2-17 | **Las cifras de 2.K van sin cero a la izquierda.** `NN` y `MM` son marcadores de posición de un conteo, no un formato de dos dígitos | El cero a la izquierda existe en el sistema —regla 1 de 2.G— y al componer la cadena había que decidir si aplicaba. No aplica: es del número de **entrada**, que es un identificador, y un `07 DE 13` en el contador imitaría ese identificador | 2.K · 2.G |
| P2-18 | **La prop `sin contador` de 2.F no la lee 2.K.** La lee el sitio que compone el documento: 2.K recibe cifras ya contadas y no ve los rieles de la hoja. Y 2.K **no tiene una prop para desactivarse**: la regla 3 se cumple no instanciándolo | P2-12 dejó escrito que la prop entraría «cuando exista 2.K, que es quien la lee». Existe 2.K y no puede leerla: es la misma corrección que P2-3 —la lectura vive en el sitio que construye el documento, no dentro del componente que imprime—, que aquí aparece por segunda vez y por la misma causa | 2.F · 2.K · I.3.6 |
| P2-19 | **I.3.1 reescrita: I.1.4 e I.3.1 se contradecían de frente.** I.1.4 declara que las versalitas del sistema son mayúsculas con tracking; I.3.1 prohibía exactamente eso y exigía versalitas reales. **La lista de campos del gate no cambia y sigue siendo bloqueante**; lo que cambia es el remedio: se cruza la lista contra la escala —seis de diez elementos van con tracking 0— y la prohibición se sustituye por una escalera de tres peldaños, con las versalitas reales descartadas por escrito. Aparece de paso el hallazgo que dimensiona el riesgo: **la vía de administración es el único elemento del gate que es clínico y traqueado a la vez**, porque 2.H la compone con el rol `etiqueta` | La contradicción venía de la entrega del diseño: I.3.1 se escribió con el hallazgo de la auditoría §8.5 delante y **nunca se actualizó** cuando la conciliación fijó la escala de I.1.4 y declaró la versalita del sistema como mayúsculas con tracking. Quedó dormida porque ningún componente la ejecutaba; salió al construir 2.H y 2.K, que son versalita entera. El remedio que ordenaba tampoco existe: el `Style` de react-pdf no tiene `fontVariant` ni *features* OpenType, verificado en `@react-pdf/stylesheet` | I.3.1 · I.1.4 · 2.H · 2.K |
| P2-20 | **El aire entre nodos de 2.J**, que la ficha no declaraba: `espacio.4` dentro del bloque, `espacio.8` entre bloques. Cerrado con el criterio de H4, no elegido | Sin declararlo, el parser componía encabezado, ítems y párrafos pegados por el interlineado y el bloque dejaba de leerse como bloque. Es el tercer sitio donde sirve el mismo criterio —2.C, 2.G y ahora 2.J—, lo que empieza a ser un patrón y no una derivación suelta | 2.J · I.1.7 |
| P2-21 | **Las dos lecturas del parser que la ficha dejaba abiertas.** (1) El lookahead mira la línea **siguiente**, no la siguiente no vacía: una línea vacía corta de verdad. (2) «Con un solo ítem no se numera» tiene alcance de **cadena entera**, no de bloque. Y queda declarado qué cuenta como viñeta —`- – — • *` y el prefijo numérico, que se descarta— y que la viñeta exige un espacio detrás | Las dos salieron de escribir la batería: cada una tenía dos comportamientos posibles y los dos eran defendibles leyendo la ficha. Se resolvieron por el mismo criterio que ordena todo este componente —cuál de las dos degrada mejor cuando se equivoca— y cada una tiene ya su prueba, así que la próxima vez no se vuelve a decidir | 2.J |
| P2-22 | **2.J compone el cuerpo con `texto.corrido` salvo dentro de la alarma, que declara `alarma.cuerpo`** (II.3 §5): el rol entra por ranura, lo declara la ficha del consumidor y la ranura está cerrada a esos dos roles. Declarada también la **marca del ítem**: la raya (—) en `fuente.neogrotesca` (`CONCILIA D30`), y el ordinal como `1.` sin cero a la izquierda | Al conectar 2.J a 2.I chocaron dos listas de tokens: la de 2.J pedía `texto.corrido` para todo y la de 2.I declara `alarma.cuerpo` para la alarma, que compone con el parser dentro. Ninguna estaba mal; faltaba decir por dónde entra el rol. Lo de la marca es el hueco gemelo: la ficha decía «la raya del sistema» sin declarar qué signo ni en qué familia | 2.J · 2.I · II.3 |
| P2-23 | **Los dos huecos que exigían mirar una lámina, cerrados midiendo.** El aire entre entradas de 2.G son **12.5 pt** con reparto propio —7 de padding inferior, `filete.regla`, 5 de padding superior— y la regla queda **descentrada a propósito**, 2 pt más cerca de la entrada que abre. El ancho de la caja de importes de 2.T es **`cierre.derecha`**, token nuevo de I.1.3, no `manuscrito.ancho` | Ninguno de los dos se podía derivar y los dos se habían dejado escritos como `NO DEFINIDO` con su cota. Las cotas aguantaron —12.5 > 8, como exigía 2.G— pero el valor real no es miembro de la escala ni está centrado: elegir `espacio.12` «porque es el siguiente» habría fijado una cifra parecida con el reparto equivocado. El archivo traía además **tres calibraciones** del mismo espacio (5/7, 8/10, 9/11), resueltas a una sola por el precedente de D4 | I.1.3 · I.1.4 · 2.G · 2.T |
| P2-24 | **`MarcoParcial` (2.U): el chasis pasa de veinte a veintiún componentes.** El marco en acento no es una variante de `BloqueDestacado` sino un **dispositivo gráfico** que envuelve contenidos de anatomía distinta. Se retira la cuarta variante `acento` de 2.I, se corrige II.5 §5, que la citaba por nombre, y baja a 2.U la composición del marco que 2.R declaraba por su cuenta. **D26 y D34 quedan unificadas** | La ficha de 2.I dejó la duda planteada al construirla y la medición la resolvió por partida triple: los tres bloques enmarcados del Recibo no comparten anatomía entre sí —uno es un `RielDatos`, otro una declaración de dos líneas—, el marco va en acento y las tres variantes de 2.I en negro, y en la hoja espécimen el marco figura entre los **dispositivos gráficos**, no entre los componentes. D26 y D34 se habían reportado por separado, cada una desde su formato, sin ver que describían el mismo objeto | I.2 · 2.I · 2.R · 2.U · II.5 · II.7 |
| P2-25 | **Dos ranuras de 2.G que la anatomía no situaba.** La `marca` va **en la fila del `ancla`, a la derecha** —lo dice la tabla de separaciones internas, que no declara ningún tramo que la toque— con `reticula.medianil` de separador. Y la `nota` se compone con **2.J**, que suma esta ranura a su lista de bloques con sintaxis de viñetas | Al montar las cinco ranuras hubo que decidir dónde caía la marca, y las dos lecturas —renglón propio o fuera del flujo— daban entradas de alto distinto para todo medicamento no oral. La tabla de separaciones desempata sin inventar nada: está completa si la marca no está en el flujo, y con hueco si lo está | 2.G · 2.J |
Una cuarta, menor, sin fila propia: `caja.alto` queda marcado en I.1.1 como
derivado que **se implementa como fórmula**. El Paso 0 lo había escrito como
literal 670.

## Lo que queda abierto

| Qué | Por qué no se cierra aquí |
|---|---|
| El destaque de vía es binario: negativo solo en las no orales | Resuelto y aplicado en II.3, pero **revierte una línea del handoff** que decía «13 vías, todas en bloque negativo». Queda registrado como reversión consciente |
| Repaginación del Consentimiento | Consecuencia de D33. No se puede estimar sin generar el PDF |
| La sangría de las tres cajas enmarcadas del Recibo | 2.U regla 4. El dispositivo no la impone —un riel enmarcado y una leyenda de dos líneas no la llevan igual— y el archivo solo trae medida la de 2.R (`12 14 14`). Se mide al construir II.5 |
| Gate de extracción de texto | I.3.1. No se resuelve en papel: se corre contra el primer PDF real de react-pdf. **Lo que sí quedó resuelto en papel es qué hacer si falla**: la escalera de remedios de I.3.1, con la vía de administración como primer sitio a mirar por ser el único elemento del gate que es clínico y traqueado a la vez |
